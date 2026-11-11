"use strict";
/*
 * 3D 녹화본 재고 (ARCHITECTURE §11) — GPU 가 있는 PC 가 켜져 있을 때 녹화해 올리고, GitHub Actions 제작이 꺼내 쓴다.
 *  clip:{id}         녹화본 1개 (30일 보관)
 *  clips:{게임}      게임별 목록 (ZSET, 녹화 시각)
 * 꺼낼 때: 안 쓴 것 · 30일 안 · 게임 지문(gameHash)이 지금 사이트와 같은 것만 → 바로 "사용함" 표시 (두 콘텐츠가 같은 클립을 쓰지 않게)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEEP_SEC = 30 * 86400;
const ID = /^[\w-]{4,80}$/;

/** 텍스트 파일은 줄바꿈을 LF 로 맞춘다 — 윈도(CRLF) PC 와 리눅스(LF) 러너가 같은 게임에 같은 지문을 내게 (git 과 같은 판정: 앞 8000바이트에 NUL 이 없으면 텍스트) */
function normalized(buf) {
  return buf.subarray(0, 8000).includes(0) ? buf : Buffer.from(buf.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
}

/** 게임 폴더 내용의 지문 — 게임이 바뀌면 달라져서 옛 화면 클립을 쓰지 않게 */
function gameHash(siteRoot, gameId) {
  if (!/^[\w-]+$/.test(gameId)) throw new Error(`게임 id 가 올바르지 않습니다: ${gameId}`);
  const dir = path.join(siteRoot, "games", gameId);
  const h = crypto.createHash("sha256");
  (function walk(d) {
    for (const name of fs.readdirSync(d).sort()) {
      const f = path.join(d, name);
      if (fs.statSync(f).isDirectory()) walk(f);
      else h.update(path.relative(dir, f).replace(/\\/g, "/")).update(normalized(fs.readFileSync(f)));
    }
  })(dir);
  return h.digest("hex").slice(0, 16);
}

async function addClip(store, clip) {
  const need = ["id", "gameId", "url", "gameHash", "recordedAt", "durationSec"];
  const miss = need.filter((k) => clip[k] == null || clip[k] === "");
  if (miss.length) throw new Error(`녹화본 정보가 모자랍니다: ${miss.join(", ")}`);
  if (!ID.test(clip.id) || !/^[\w-]+$/.test(clip.gameId)) throw new Error("녹화본 id 또는 게임 id 가 올바르지 않습니다.");
  if (!/^https:\/\//.test(clip.url)) throw new Error("녹화본 주소는 https 공개 주소여야 합니다.");
  await store.batch([
    ["SET", `clip:${clip.id}`, JSON.stringify({ ...clip, used: null }), "EX", KEEP_SEC],
    ["ZADD", `clips:${clip.gameId}`, Date.parse(clip.recordedAt), clip.id],
    ["EXPIRE", `clips:${clip.gameId}`, KEEP_SEC],
  ]);
  return clip;
}

async function listClips(store, gameId) {
  const ids = (await store.run("ZREVRANGE", `clips:${gameId}`, 0, 99)) || [];
  return (await store.mget(ids.map((id) => `clip:${id}`))).map(store.parse).filter(Boolean);
}

const usable = (c, hash, now) => !c.used && c.gameHash === hash && now - Date.parse(c.recordedAt) < KEEP_SEC * 1000;

async function availableClips(store, gameId, hash, now = Date.now()) {
  return (await listClips(store, gameId)).filter((c) => usable(c, hash, now));
}

/** 가장 최근의 쓸 수 있는 클립을 꺼내 "사용함" 표시. 없으면 null */
async function takeClip(store, gameId, hash, contentId, now = Date.now()) {
  return store.withLock(`clips:${gameId}`, 30, async () => {
    const c = (await availableClips(store, gameId, hash, now))[0];
    if (!c) return null;
    c.used = { by: contentId, at: new Date(now).toISOString() };
    await store.run("SET", `clip:${c.id}`, JSON.stringify(c), "KEEPTTL");
    return c;
  });
}

module.exports = { gameHash, addClip, listClips, availableClips, takeClip, KEEP_SEC };
