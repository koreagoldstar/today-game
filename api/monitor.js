/**
 * 모니터실 (운영자 전용) — 사이트 방문 · 게임별 참여 · 랭킹 등록을 날짜별로
 *
 * 잠금: Vercel 환경 변수 MONITOR_KEY (비밀번호) — 코드 · 저장소에는 비밀번호를 두지 않는다.
 *   POST { action: "login", pin }  → { token }   (30일 동안 그 기기에서 유지)
 *   POST { action: "logout" }      + Authorization: Bearer <token>
 *   GET  ?days=30                  + Authorization: Bearer <token>  → 통계
 * 틀린 비밀번호: 같은 곳(IP)에서 15분에 5번 넘으면 15분 잠금 · 전체로 1시간에 30번 넘으면 1시간 잠금
 */
const crypto = require("crypto");
const stats = require("./_stats");
const SEO = require("../scripts/game-seo-data.js");

const ABACUS = "https://abacus.jasoncameron.dev";
const NAMESPACE = "todaygamekr";
const SESSION_TTL = 60 * 60 * 24 * 30;
const IP_LIMIT = 5;
const IP_WINDOW = 60 * 15;
const ALL_LIMIT = 30;
const ALL_WINDOW = 60 * 60;
const VISITS_SINCE = "2026-07-15"; // 날짜별 방문자 기록(외부 카운터)이 시작된 날
const OWN_VISITS_SINCE = "2026-10-29"; // 이날부터 방문자는 우리 저장소에서만 셈 (그 전 날짜는 외부 카운터 기록)
const ABACUS_CACHE = "todaygame:monitor:abacus"; // 지난 날 방문자 수 (외부 카운터) 모아 둔 것
const EXTRA_TITLES = { "bowling-strike": "볼링 스트라이크", goindol: "고인돌" };

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function titles() {
  const out = { ...EXTRA_TITLES };
  for (const g of SEO) if (g && g.id && g.title) out[g.id] = g.title;
  return out;
}

function clientIp(req) {
  const xf = String((req.headers && req.headers["x-forwarded-for"]) || "");
  return (xf.split(",")[0] || (req.socket && req.socket.remoteAddress) || "unknown").trim();
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body));
  } catch (_) {
    return {};
  }
}

function bearer(req) {
  const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || "");
  const m = h.match(/^Bearer\s+([a-f0-9]{64})$/i);
  return m ? m[1].toLowerCase() : "";
}

/** 날짜 목록: 오늘부터 거꾸로 n일 (오래된 날 → 오늘 순서로 돌려줌) */
function lastDays(n, today) {
  const out = [];
  const d = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

async function abacusDay(day) {
  if (day < VISITS_SINCE) return null;
  try {
    const r = await fetch(`${ABACUS}/get/${NAMESPACE}/day-${day}`);
    const data = await r.json();
    if (data && data.value != null) return Number(data.value) || 0;
    if (data && /not found/i.test(String(data.error || ""))) return 0;
    return null;
  } catch (_) {
    return null;
  }
}

/** 동시에 너무 많이 부르지 않게 (외부 카운터 예의) */
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

function hashToObject(result) {
  const o = {};
  if (Array.isArray(result)) {
    for (let i = 0; i + 1 < result.length; i += 2) {
      const n = Number(result[i + 1]) || 0;
      if (n > 0) o[String(result[i])] = n;
    }
  } else if (result && typeof result === "object") {
    for (const [k, v] of Object.entries(result)) {
      const n = Number(v) || 0;
      if (n > 0) o[k] = n;
    }
  }
  return o;
}

async function collect(days) {
  const today = stats.seoulDay();
  const list = lastDays(days, today);
  const cmds = [["GET", "todaygame:visits:total"], ["HGETALL", "todaygame:plays"], ["HGETALL", ABACUS_CACHE]];
  for (const d of list) {
    cmds.push(["HGETALL", stats.dayKey("plays", d)]);
    cmds.push(["HGETALL", stats.dayKey("ranks", d)]);
    cmds.push(["GET", stats.dayKey("visitors", d)]);
  }
  const res = await stats.pipeline(cmds);
  const r = (i) => (res && res[i] && res[i].result != null ? res[i].result : null);
  // 외부 카운터 시절 방문자 수는 바뀌지 않으니 한 번 읽은 것은 저장해 두고 씀 · 그 뒤 날짜는 우리 저장소 숫자
  const cache = hashToObject(r(2));
  const visitors = await mapLimit(list, 6, (d) => (d >= OWN_VISITS_SINCE ? null : d < today && cache[d] != null ? cache[d] : abacusDay(d)));
  const fresh = [];
  list.forEach((d, k) => {
    if (d < today && cache[d] == null && visitors[k] != null && visitors[k] > 0) fresh.push(d, String(visitors[k]));
  });
  if (fresh.length) await stats.pipeline([["HSET", ABACUS_CACHE, ...fresh]]);
  const daysOut = list.map((day, k) => {
    const base = 3 + k * 3;
    const own = r(base + 2);
    const plays = hashToObject(r(base));
    const ranks = hashToObject(r(base + 1));
    return {
      day,
      visitors: visitors[k] != null ? visitors[k] : own != null ? Number(own) || 0 : null,
      plays,
      ranks,
      // 날짜별 기록을 하던 날인가 (없는 해시는 빈 목록으로 오므로 내용 · 우리 방문자 수로 판단)
      tracked: own != null || Object.keys(plays).length > 0 || Object.keys(ranks).length > 0,
    };
  });
  return {
    ok: true,
    today,
    generatedAt: new Date().toISOString(),
    store: !!res,
    visitTotal: r(0) != null ? Number(r(0)) || 0 : null,
    playsTotal: hashToObject(r(1)),
    days: daysOut,
    titles: titles(),
    visitsSince: VISITS_SINCE,
  };
}

async function redis(command) {
  const out = await stats.pipeline([command]);
  return out && out[0] && !out[0].error ? { ok: true, result: out[0].result } : { ok: false };
}

async function checkSession(token) {
  if (!token) return false;
  const got = await redis(["GET", `todaygame:monitor:session:${sha(token)}`]);
  return got.ok && got.result != null;
}

module.exports = async function handler(req, res) {
  // 운영자 전용: 다른 사이트에서 부르지 못하게 (CORS 헤더 없음) · 캐시 금지 · 검색 제외
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (!stats.creds()) {
    res.status(503).json({ ok: false, error: "store-not-configured" });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    if (body.action === "logout") {
      const token = bearer(req);
      if (token) await redis(["DEL", `todaygame:monitor:session:${sha(token)}`]);
      res.status(200).json({ ok: true });
      return;
    }
    if (body.action !== "login") {
      res.status(400).json({ ok: false, error: "bad-request" });
      return;
    }
    const secret = process.env.MONITOR_KEY;
    if (!secret) {
      res.status(503).json({ ok: false, error: "key-not-configured" });
      return;
    }
    const ip = sha(clientIp(req)).slice(0, 24);
    const hour = Math.floor(Date.now() / 1000 / ALL_WINDOW);
    const ipKey = `todaygame:monitor:fail:ip:${ip}`;
    const allKey = `todaygame:monitor:fail:all:${hour}`;
    const fails = await stats.pipeline([
      ["GET", ipKey],
      ["GET", allKey],
    ]);
    const ipFails = Number((fails && fails[0] && fails[0].result) || 0);
    const allFails = Number((fails && fails[1] && fails[1].result) || 0);
    if (ipFails >= IP_LIMIT || allFails >= ALL_LIMIT) {
      res.status(429).json({ ok: false, error: "locked", retryMinutes: ipFails >= IP_LIMIT ? 15 : 60 });
      return;
    }
    const pin = String(body.pin == null ? "" : body.pin);
    const good = crypto.timingSafeEqual(Buffer.from(sha(pin), "hex"), Buffer.from(sha(secret), "hex"));
    if (!good) {
      await stats.pipeline([
        ["INCR", ipKey],
        ["EXPIRE", ipKey, IP_WINDOW],
        ["INCR", allKey],
        ["EXPIRE", allKey, ALL_WINDOW],
      ]);
      res.status(401).json({ ok: false, error: "wrong", left: Math.max(0, IP_LIMIT - ipFails - 1) });
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    await stats.pipeline([
      ["SET", `todaygame:monitor:session:${sha(token)}`, "1", "EX", SESSION_TTL],
      ["DEL", ipKey],
    ]);
    res.status(200).json({ ok: true, token, days: SESSION_TTL / 86400 });
    return;
  }

  if (req.method === "GET") {
    if (!(await checkSession(bearer(req)))) {
      res.status(401).json({ ok: false, error: "login-required" });
      return;
    }
    const days = Math.min(120, Math.max(1, Math.floor(Number(req.query && req.query.days) || 30)));
    try {
      res.status(200).json(await collect(days));
    } catch (e) {
      res.status(500).json({ ok: false, error: "collect-failed" });
    }
    return;
  }

  res.status(405).json({ ok: false, error: "method-not-allowed" });
};

module.exports.collect = collect;
