/**
 * 방문자 수
 *  - 오늘 방문: 외부 카운터(abacus)에 날짜별로 (예전 그대로) · 같은 브라우저는 하루 한 번만 센다 (홈 · 게임 페이지 공통)
 *  - 누적 방문: 우리 저장소(Redis)에 숫자 하나로 쌓는다.
 *    처음 한 번은 abacus 날짜별 기록으로 시작값을 만든다 (2026-07-15 ~ 2026-10-19 합 1,103명 + 그 뒤 날짜들).
 *
 * GET            → { today, total, day }  (세지 않고 읽기만)
 * GET ?count=1 · POST → 한 명 더 세고 { today, total, day }
 */
const NAMESPACE = "todaygamekr";
const ABACUS = "https://abacus.jasoncameron.dev";
const TOTAL_KEY = "todaygame:visits:total";
const BASE_DAY = "2026-10-19";
const BASE_TOTAL = 1103;

function seoulDay() {
  return new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
}

/** a 다음 날부터 b 전날까지 (YYYY-MM-DD) */
function daysBetween(a, b) {
  const out = [];
  const d = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  for (d.setUTCDate(d.getUTCDate() + 1); d < end && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function abacus(action, key) {
  const response = await fetch(`${ABACUS}/${action}/${NAMESPACE}/${key}`);
  const data = await response.json();
  return Number(data.value ?? data.count ?? 0) || 0;
}

/** 지난 날짜 기록 읽기: 그날 아무도 없었으면 0 · 읽기 실패면 null */
async function abacusPast(key) {
  try {
    const response = await fetch(`${ABACUS}/get/${NAMESPACE}/${key}`);
    const data = await response.json();
    if (data && data.value != null) return Number(data.value) || 0;
    if (data && /not found/i.test(String(data.error || ""))) return 0;
    return null;
  } catch (_) {
    return null;
  }
}

function redisConfigured() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return { ok: false };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data };
    return { ok: true, result: data.result };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/** 누적 방문 (저장소가 없거나 실패하면 null → 화면에 안 보임) */
async function cumulative(counted, today, day) {
  if (!redisConfigured()) return null;
  const cur = await redis(["GET", TOTAL_KEY]);
  if (!cur.ok) return null;
  if (cur.result != null) {
    if (!counted) return Number(cur.result) || 0;
    const inc = await redis(["INCR", TOTAL_KEY]);
    return inc.ok ? Number(inc.result) : null;
  }
  // 처음 한 번: 예전 기록 합 + 그 뒤 날짜들 + 오늘 (오늘 숫자를 못 읽으면 다음에)
  if (today == null) return null;
  let start = BASE_TOTAL + today;
  for (const d of daysBetween(BASE_DAY, day)) {
    const v = await abacusPast(`day-${d}`);
    if (v == null) return null;
    start += v;
  }
  const set = await redis(["SET", TOTAL_KEY, String(start), "NX"]);
  if (set.ok && set.result === "OK") return start;
  // 동시에 다른 요청이 먼저 만들었으면 그 숫자에 이어서
  if (counted) {
    const inc = await redis(["INCR", TOTAL_KEY]);
    return inc.ok ? Number(inc.result) : null;
  }
  const again = await redis(["GET", TOTAL_KEY]);
  return again.ok && again.result != null ? Number(again.result) : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const day = seoulDay();
  const shouldCount = req.method === "POST" || (req.query && req.query.count === "1");

  let today = null;
  try {
    today = await abacus(shouldCount ? "hit" : "get", `day-${day}`);
  } catch (_) {
    today = null;
  }
  let total = null;
  try {
    total = await cumulative(shouldCount, today, day);
  } catch (_) {
    total = null;
  }
  if (today == null) {
    res.status(200).json({ today: null, total, day, error: "counter unavailable" });
    return;
  }
  res.status(200).json({ today, total, day });
};
