"use strict";
/*
 * 저장소 — 사이트와 같은 Upstash Redis(REST)를 쓰되 키는 모두 todaygame:mkt: 로 시작한다.
 * 이 모듈로는 그 밖의 키(랭킹 · 방문 수 등 사이트 데이터)를 읽거나 쓸 수 없다.
 */
const crypto = require("crypto");

const PREFIX = "todaygame:mkt:";
const NAME = /^[\w:.-]{1,200}$/;

class LockError extends Error {
  constructor(name) {
    super("다른 작업이 처리 중입니다. 잠시 뒤 다시 해 주세요.");
    this.code = "BUSY";
    this.lock = name;
  }
}

function createStore({ url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN, fetchImpl = fetch } = {}) {
  if (!url || !token) throw new Error("저장소(Upstash Redis) 주소 · 열쇠가 없습니다 (UPSTASH_REDIS_REST_URL · UPSTASH_REDIS_REST_TOKEN).");
  const base = String(url).replace(/\/$/, "");

  const key = (name) => {
    if (!NAME.test(String(name))) throw new Error(`저장소 키 이름이 올바르지 않습니다: ${name}`);
    return PREFIX + name;
  };

  async function call(path, body) {
    let res;
    try {
      res = await fetchImpl(base + path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error(`저장소에 연결하지 못했습니다: ${e.message}`);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(`저장소 오류 (HTTP ${res.status})`);
    return data;
  }
  const unwrap = (x) => {
    if (x && x.error) throw new Error(`저장소 오류: ${x.error}`);
    return x.result;
  };

  /** 키 하나짜리 명령: run("ZADD", "contents", score, id) — 키 이름에 앞머리가 자동으로 붙는다 */
  const run = async (op, name, ...args) => unwrap(await call("", [op, key(name), ...args.map(String)]));
  /** 여러 명령 한 번에: batch([["SET", "a", 1], ["EXPIRE", "a", 60]]) */
  const batch = async (cmds) => (await call("/pipeline", cmds.map(([op, name, ...a]) => [op, key(name), ...a.map(String)]))).map(unwrap);
  const mget = async (names) => (names.length ? unwrap(await call("", ["MGET", ...names.map(key)])) : []);

  const parse = (s) => {
    if (s == null) return null;
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  };
  const getJson = async (name) => parse(await run("GET", name));
  /** @returns {Promise<boolean>} nx 이면 이미 있을 때 false */
  const setJson = async (name, value, { nx = false, ex = 0 } = {}) => {
    const args = [JSON.stringify(value)];
    if (nx) args.push("NX");
    if (ex) args.push("EX", ex);
    return (await run("SET", name, ...args)) === "OK";
  };

  /** 잠금을 잡고 fn 실행. 못 잡으면 LockError */
  async function withLock(name, ttlSec, fn) {
    const mine = crypto.randomBytes(8).toString("hex");
    if ((await run("SET", `lock:${name}`, mine, "NX", "EX", ttlSec)) !== "OK") throw new LockError(name);
    try {
      return await fn();
    } finally {
      // shortcut: 확인과 지우기가 한 번에 되지 않음 — 잠금 시간 안에 끝나는 작업만 여기에 넣는다
      if ((await run("GET", `lock:${name}`).catch(() => null)) === mine) await run("DEL", `lock:${name}`).catch(() => {});
    }
  }

  /* ---------- 콘텐츠 ---------- */
  const contentKey = (id) => {
    if (!/^[\w-]{4,80}$/.test(String(id))) throw new Error("콘텐츠 id 가 올바르지 않습니다.");
    return `content:${id}`;
  };
  const getContent = (id) => getJson(contentKey(id));
  async function saveContent(doc) {
    await batch([
      ["SET", contentKey(doc.id), JSON.stringify(doc)],
      ["ZADD", "contents", Date.parse(doc.createdAt), doc.id],
    ]);
    return doc;
  }
  async function listContents(limit = 100) {
    const ids = await run("ZREVRANGE", "contents", 0, limit - 1);
    return (await mget((ids || []).map(contentKey))).map(parse).filter(Boolean);
  }
  /** 잠그고 읽어 fn(doc) 으로 고친 뒤 저장. fn 이 false 를 돌려주면 저장 안 함 */
  async function updateContent(id, fn) {
    return withLock(`content:${id}`, 60, async () => {
      const doc = await getContent(id);
      if (!doc) throw Object.assign(new Error("콘텐츠를 찾지 못했습니다."), { code: "NOT_FOUND" });
      const r = await fn(doc);
      if (r !== false) await saveContent(doc);
      return doc;
    });
  }

  /* ---------- 작업 · 기록 ---------- */
  async function jobStart(type, extra = {}) {
    const job = { id: `${type}-${Date.now().toString(36)}-${crypto.randomBytes(2).toString("hex")}`, type, status: "RUNNING", startedAt: new Date().toISOString(), retries: 0, ...extra };
    await batch([
      ["SET", `job:${job.id}`, JSON.stringify(job), "EX", 90 * 86400],
      ["LPUSH", "jobs", job.id],
      ["LTRIM", "jobs", 0, 199],
    ]);
    return job;
  }
  async function jobEnd(job, { status = "DONE", error = null, result = null } = {}) {
    Object.assign(job, { status, error, result, endedAt: new Date().toISOString() });
    await run("SET", `job:${job.id}`, JSON.stringify(job), "EX", 90 * 86400);
    return job;
  }
  async function log(entry) {
    await batch([
      ["LPUSH", "logs", JSON.stringify(entry)],
      ["LTRIM", "logs", 0, 999],
    ]);
  }

  return { PREFIX, key, run, batch, mget, getJson, setJson, withLock, getContent, saveContent, listContents, updateContent, jobStart, jobEnd, log, parse };
}

module.exports = { createStore, LockError, PREFIX };
