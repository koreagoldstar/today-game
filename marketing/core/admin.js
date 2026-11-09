"use strict";
/*
 * 웹 관리자 API (api/mkt-admin.js 가 부른다) — 텔레그램과 같은 저장소 · 같은 상태 머신 · 같은 승인 모듈(core/approval.js).
 *  잠금: 환경 변수 MKT_ADMIN_KEY (24자 이상). 모니터실(api/monitor.js) 방식 그대로:
 *   POST { action: "login", key } → { token } (7일) · 이후 모든 요청 Authorization: Bearer <token>
 *   틀린 키: 같은 곳(IP)에서 15분에 5번 넘으면 15분 잠금, 전체로 1시간에 30번 넘으면 1시간 잠금
 *  쿠키를 쓰지 않고 Authorization 헤더로만 인증 → 다른 사이트가 관리자 대신 요청을 보낼 수 없음(CSRF 없음).
 *  CORS 허용 헤더를 주지 않으므로 다른 사이트의 스크립트는 응답을 읽지도 못한다.
 *  상태 바꾸기는 모두 버전 확인 + 잠금 (텔레그램과 동시에 눌러도 한 번만 반영).
 */
const crypto = require("crypto");
const { loadSettings, saveSettings, seoulDay, DAYS, FEED_TYPES, STORY_TYPES, CHANNELS } = require("./settings");
const { createApproval, ActionError } = require("./approval");
const { KO } = require("./state");
const { createRegistry } = require("./registry");
const { createMockChannel } = require("../channels/mock");

const SESSION_TTL = 7 * 86400;
const IP_LIMIT = 5;
const IP_WINDOW = 15 * 60;
const ALL_LIMIT = 30;
const ALL_WINDOW = 3600;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const ACTIONS = ["approve", "reject", "editCopy", "redo", "cancel", "setChannels", "setTime"];
const GROUPS = {
  pending: ["READY_FOR_APPROVAL"],
  scheduled: ["APPROVED", "SCHEDULED", "PUBLISHING"],
  published: ["PUBLISHED"],
  failed: ["FAILED", "EXPIRED", "REJECTED", "CANCELLED"],
  making: ["PLANNED", "COLLECTING", "RENDERING", "COPYWRITING", "QC"],
};

/** 화면에 필요한 것만 (로컬 파일 경로 · 해시 · 내부 기록은 빼고) */
function brief(d) {
  const r = d.render || {};
  return {
    id: d.id,
    status: d.status,
    statusKo: KO[d.status] || d.status,
    slot: d.slot,
    kind: r.kind || (d.plan && d.plan.kind),
    title: (r.meta && r.meta.title) || (d.source && d.source.facts && d.source.facts.title) || (d.plan && d.plan.sourceId),
    sourceType: d.plan && d.plan.sourceType,
    version: d.version,
    channels: d.channels,
    createdAt: d.createdAt,
    scheduledAt: d.scheduledAt,
    validDay: d.plan && d.plan.validDay,
    reason: d.plan && d.plan.reason,
    files: (r.files || []).filter((f) => f.url).map((f) => ({ role: f.role, url: f.url, w: f.w, h: f.h })),
    meta: r.meta ? { durationSec: r.meta.durationSec, comment: r.meta.comment, hook: r.meta.hook, template: r.meta.template } : null,
    copy: d.copy,
    qc: d.qc ? { passed: d.qc.passed, total: d.qc.checks.length, failed: d.qc.checks.filter((c) => !c.ok).map((c) => c.reason) } : null,
    approval: d.approval,
    rejection: d.rejection,
    failure: d.failure,
    skipped: d.skipped,
    redo: d.redo,
    posts: d.posts,
    insights: d.insights || null,
    history: (d.history || []).slice(-8),
  };
}

function capsRegistry() {
  const r = createRegistry();
  for (const ch of CHANNELS) r.register("channel", ch, createMockChannel(ch)); // 형식 · 글자 수 확인용 (여기서는 아무것도 게시하지 않음)
  return r;
}

function createAdmin({ store, env = process.env, now = () => Date.now() }) {
  const registry = capsRegistry();

  async function login(body, ip) {
    const secret = env.MKT_ADMIN_KEY;
    if (!secret || String(secret).length < 24) return { status: 503, body: { ok: false, error: "관리자 키(MKT_ADMIN_KEY, 24자 이상)가 설정되지 않았습니다." } };
    const ipKey = `admin:fail:ip:${sha(ip).slice(0, 24)}`;
    const allKey = `admin:fail:all:${Math.floor(now() / 1000 / ALL_WINDOW)}`;
    const [ipFails, allFails] = (await store.mget([ipKey, allKey])).map((x) => Number(x || 0));
    if (ipFails >= IP_LIMIT || allFails >= ALL_LIMIT) return { status: 429, body: { ok: false, error: `잠겼습니다. ${ipFails >= IP_LIMIT ? 15 : 60}분 뒤 다시 해 주세요.` } };
    const good = crypto.timingSafeEqual(Buffer.from(sha(body.key == null ? "" : body.key), "hex"), Buffer.from(sha(secret), "hex"));
    if (!good) {
      await store.batch([
        ["INCR", ipKey],
        ["EXPIRE", ipKey, IP_WINDOW],
        ["INCR", allKey],
        ["EXPIRE", allKey, ALL_WINDOW],
      ]);
      return { status: 401, body: { ok: false, error: "키가 틀렸습니다.", left: Math.max(0, IP_LIMIT - ipFails - 1) } };
    }
    const token = crypto.randomBytes(32).toString("hex");
    await store.batch([
      ["SET", `admin:session:${sha(token)}`, "1", "EX", SESSION_TTL],
      ["DEL", ipKey],
    ]);
    return { status: 200, body: { ok: true, token, days: SESSION_TTL / 86400 } };
  }

  const sessionOk = async (token) => /^[a-f0-9]{64}$/.test(token || "") && (await store.run("GET", `admin:session:${sha(token)}`)) === "1";

  async function read(op, q) {
    const settings = await loadSettings(store);
    const list = await store.listContents(200);
    const snap = (await store.getJson("admin:snapshot")) || null;
    const today = seoulDay(now());
    if (op === "overview") {
      const count = Object.fromEntries(Object.entries(GROUPS).map(([k, st]) => [k, list.filter((d) => st.includes(d.status)).length]));
      const jobs = ((await store.run("LRANGE", "jobs", 0, 9)) || []).length ? await store.mget(((await store.run("LRANGE", "jobs", 0, 9)) || []).map((id) => `job:${id}`)) : [];
      return {
        today,
        count,
        todayItems: list.filter((d) => d.dateKey === today).map(brief),
        next: list.filter((d) => d.status === "SCHEDULED").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).slice(0, 3).map(brief),
        jobs: jobs.map((j) => store.parse(j)).filter(Boolean).map((j) => ({ type: j.type, status: j.status, startedAt: j.startedAt, endedAt: j.endedAt, result: j.result, error: j.error })),
        snapshotAt: snap && snap.at,
      };
    }
    if (op === "contents") {
      const st = GROUPS[q.group];
      if (!st) throw new ActionError("목록 종류가 올바르지 않습니다.");
      const items = list.filter((d) => st.includes(d.status));
      if (q.group === "scheduled") items.sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
      return { items: items.map(brief) };
    }
    if (op === "content") {
      const d = await store.getContent(String(q.id || ""));
      if (!d) throw new ActionError("콘텐츠를 찾지 못했습니다.");
      return { item: brief(d) };
    }
    if (op === "settings") return { settings, choices: { days: DAYS, feed: FEED_TYPES, story: STORY_TYPES, channels: CHANNELS } };
    if (op === "games") {
      const games = ((snap && snap.games) || []).map((g) => ({ ...g, excluded: settings.excludeGames.includes(g.id) }));
      return { games, snapshotAt: snap && snap.at };
    }
    if (op === "channels") return { channels: (snap && snap.channels) || null, snapshotAt: snap && snap.at, defaults: settings.channels };
    if (op === "insights") {
      const items = list.filter((d) => d.status === "PUBLISHED").map((d) => ({ ...brief(d), clicks: null }));
      const clicks = (await store.mget(items.map((d) => `clicks:${d.id}`))).map((x) => (x == null ? null : Number(x)));
      items.forEach((d, i) => (d.clicks = clicks[i]));
      return { items, weekly: (await store.getJson("report:weekly")) || null };
    }
    if (op === "logs") {
      const logs = ((await store.run("LRANGE", "logs", 0, 199)) || []).map((s) => store.parse(s)).filter(Boolean);
      return { logs };
    }
    throw new ActionError("알 수 없는 요청입니다.");
  }

  async function write(body) {
    const action = String(body.action || "");
    if (ACTIONS.includes(action)) {
      const settings = await loadSettings(store);
      const approval = createApproval({ store, settings, registry, now });
      const args = { ...body, by: "admin", via: "web" };
      const doc = await approval[action](String(body.id || ""), args);
      return { item: brief(doc) };
    }
    if (action === "settings") {
      const patch = body.patch || {};
      const allowed = ["schedule", "story", "postTimes", "dailyCaps", "channels", "approvalExpiryHours", "maxPending", "repeatDays"];
      const bad = Object.keys(patch).filter((k) => !allowed.includes(k));
      if (bad.length) throw new ActionError(`바꿀 수 없는 설정: ${bad.join(", ")}`);
      try {
        return { settings: await saveSettings(store, patch) };
      } catch (e) {
        if (e.code === "BAD_SETTINGS") throw new ActionError(e.message);
        throw e;
      }
    }
    if (action === "exclude") {
      const id = String(body.gameId || "");
      if (!/^[\w-]{1,60}$/.test(id)) throw new ActionError("게임 id 가 올바르지 않습니다.");
      return store.withLock("settings", 30, async () => {
        const cur = (await loadSettings(store)).excludeGames;
        const next = body.excluded ? [...new Set([...cur, id])] : cur.filter((g) => g !== id);
        return { settings: await saveSettings(store, { excludeGames: next }) };
      });
    }
    throw new ActionError("알 수 없는 요청입니다.");
  }

  /** @returns {{status:number, body:object}} */
  async function handle({ method, query = {}, body = {}, headers = {}, ip = "unknown" }) {
    try {
      if (method === "POST" && body.action === "login") return await login(body, ip);
      const m = String(headers.authorization || headers.Authorization || "").match(/^Bearer\s+([a-f0-9]{64})$/i);
      const token = m ? m[1].toLowerCase() : "";
      if (!(await sessionOk(token))) return { status: 401, body: { ok: false, error: "로그인이 필요합니다." } };
      if (method === "POST" && body.action === "logout") {
        await store.run("DEL", `admin:session:${sha(token)}`);
        return { status: 200, body: { ok: true } };
      }
      if (method === "GET") return { status: 200, body: { ok: true, ...(await read(String(query.op || "overview"), query)) } };
      if (method === "POST") {
        const out = await write(body);
        await store.log({ at: new Date(now()).toISOString(), level: "info", msg: `웹 관리자: ${body.action}${body.id ? ` ${body.id}` : ""}${body.gameId ? ` ${body.gameId}` : ""}` }).catch(() => {});
        return { status: 200, body: { ok: true, ...out } };
      }
      return { status: 405, body: { ok: false, error: "허용하지 않는 방법" } };
    } catch (e) {
      if (e instanceof ActionError || e.code === "BUSY" || e.code === "NOT_FOUND" || e.code === "BAD_TRANSITION") return { status: 409, body: { ok: false, error: e.message, code: e.code || null } };
      return { status: 500, body: { ok: false, error: "서버 오류" } };
    }
  }

  return { handle, brief };
}

module.exports = { createAdmin, brief, GROUPS };
