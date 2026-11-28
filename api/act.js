/**
 * 이용자 행동 이벤트 받기 (js/act.js 가 보냄) — 날짜별 집계만 저장 (원본 이벤트 · IP 는 저장하지 않음)
 *
 * 저장 키 (서울 날짜 · 400일 보관) — 기존 모니터실 키(todaygame:stats:*)와 섞이지 않게 todaygame:act:*
 *   act:cnt:<날짜>        해시  "<이벤트>" · "<이벤트>|<게임>" → 횟수
 *   act:uv:<날짜>         HLL   그날 이벤트를 보낸 익명 브라우저
 *   act:new:<날짜>        HLL   그날이 첫 방문인 브라우저
 *   act:src:<날짜>        해시  유입 경로 → 세션 수 (site_visit 기준)
 *   act:dev:<날짜>        해시  기기 → 세션 수
 *   act:time:<날짜>       해시  "<게임>|ms" 플레이 시간 합 · "<게임>|n" 잰 판 수
 *   act:coh:<첫날>:all|d1|w7|w30  HLL  첫 방문 날짜별 무리 · 1일째 · 7일 안 · 30일 안에 다시 온 브라우저
 *   act:id:<이벤트 id>    중복 막기 (2일)
 */
const stats = require("./_stats");
const SEO = require("../scripts/game-seo-data.js");

const TTL = 60 * 60 * 24 * 400;
const P = "todaygame:act";
const EVENTS = new Set(["site_visit", "game_view", "game_start", "game_complete", "game_replay", "challenge_start", "challenge_complete", "score_submit", "share_click"]);
const DEVICES = new Set(["mobile", "tablet", "desktop"]);
const GAMES = new Set(["goindol", ...SEO.map((g) => g && g.id).filter(Boolean)]);
const ID = /^[a-f0-9]{16,32}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parse(req) {
  const b = req.body;
  if (!b) return null;
  if (typeof b === "object" && !Buffer.isBuffer(b)) return b;
  try {
    return JSON.parse(Buffer.isBuffer(b) ? b.toString("utf8") : String(b));
  } catch (_) {
    return null;
  }
}
const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

/** 받은 이벤트를 검사해 깨끗한 것만 */
function clean(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const r of list.slice(0, 25)) {
    if (!r || typeof r !== "object" || !EVENTS.has(r.e) || !ID.test(String(r.id)) || !ID.test(String(r.uid)) || !ID.test(String(r.sid))) continue;
    const g = String(r.g || "");
    if (g && !GAMES.has(g)) continue;
    if (r.e !== "site_visit" && r.e !== "share_click" && !g) continue;
    out.push({
      id: r.id,
      e: r.e,
      g,
      uid: r.uid,
      dev: DEVICES.has(r.dev) ? r.dev : "other",
      src: /^[a-z0-9_.-]{1,30}$/.test(String(r.src)) ? r.src : "other",
      fd: DAY.test(String(r.fd)) ? r.fd : null,
      ms: Number.isFinite(r.ms) && r.ms >= 200 && r.ms <= 7200000 ? Math.round(r.ms) : null,
    });
  }
  return out;
}

/** 집계 명령 만들기 (테스트에서도 씀) */
function commands(events, day) {
  const k = (name) => `${P}:${name}:${day}`;
  const cmds = [];
  const touched = new Set();
  const expire = (key) => {
    if (!touched.has(key)) {
      touched.add(key);
      cmds.push(["EXPIRE", key, TTL]);
    }
  };
  for (const ev of events) {
    cmds.push(["HINCRBY", k("cnt"), ev.e, 1]);
    if (ev.g) cmds.push(["HINCRBY", k("cnt"), `${ev.e}|${ev.g}`, 1]);
    expire(k("cnt"));
    cmds.push(["PFADD", k("uv"), ev.uid]);
    expire(k("uv"));
    if (ev.e === "site_visit") {
      cmds.push(["HINCRBY", k("src"), ev.src, 1]);
      cmds.push(["HINCRBY", k("dev"), ev.dev, 1]);
      expire(k("src"));
      expire(k("dev"));
      const fd = ev.fd && ev.fd <= day ? ev.fd : day;
      if (fd === day) {
        cmds.push(["PFADD", k("new"), ev.uid]);
        expire(k("new"));
      }
      // 재방문: 첫 방문 날짜 무리에 넣기
      const n = dayDiff(day, fd);
      if (n <= 400) {
        const ck = (w) => `${P}:coh:${fd}:${w}`;
        cmds.push(["PFADD", ck("all"), ev.uid]);
        expire(ck("all"));
        if (n === 1) {
          cmds.push(["PFADD", ck("d1"), ev.uid]);
          expire(ck("d1"));
        }
        if (n >= 1 && n <= 7) {
          cmds.push(["PFADD", ck("w7"), ev.uid]);
          expire(ck("w7"));
        }
        if (n >= 1 && n <= 30) {
          cmds.push(["PFADD", ck("w30"), ev.uid]);
          expire(ck("w30"));
        }
      }
    }
    if (ev.e === "game_complete" && ev.g && ev.ms != null) {
      cmds.push(["HINCRBY", k("time"), `${ev.g}|ms`, ev.ms]);
      cmds.push(["HINCRBY", k("time"), `${ev.g}|n`, 1]);
      expire(k("time"));
    }
  }
  return cmds;
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  // 받은 즉시 답할 필요 없는 요청(sendBeacon)이라 실패해도 204
  const body = parse(req);
  const events = clean(body && body.events);
  if (!events.length || !stats.creds()) {
    res.status(204).end();
    return;
  }
  try {
    // 같은 이벤트(같은 id)가 두 번 오면 한 번만 (재전송 · 중복 보내기 대비)
    const nx = await stats.pipeline(events.map((ev) => ["SET", `${P}:id:${ev.id}`, "1", "NX", "EX", 172800]));
    const fresh = nx ? events.filter((_, i) => nx[i] && nx[i].result === "OK") : [];
    if (fresh.length) await stats.pipeline(commands(fresh, stats.seoulDay()));
  } catch (_) {
    /* 저장 실패는 조용히 */
  }
  res.status(204).end();
}

module.exports = handler;
module.exports.clean = clean;
module.exports.commands = commands;
module.exports.PREFIX = P;
