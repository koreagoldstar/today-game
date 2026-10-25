/**
 * 모니터실용 날짜별 기록 (서울 날짜 · 400일 보관)
 *  - todaygame:stats:plays:YYYY-MM-DD    게임별 참여(게임 페이지 열기 · 세션당 1번)  { game: n }
 *  - todaygame:stats:ranks:YYYY-MM-DD    게임별 랭킹 등록                          { game: n }
 *  - todaygame:stats:visitors:YYYY-MM-DD 사이트 방문자 (같은 브라우저 하루 한 번)    n
 *  _ 로 시작하는 파일은 Vercel 이 주소(API)로 내보내지 않는다 — 다른 API 가 불러 쓰는 도우미.
 */
const TTL = 60 * 60 * 24 * 400;
const PREFIX = "todaygame:stats";

function seoulDay(d = new Date()) {
  return d.toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
}

function creds() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** 여러 명령을 한 번에 → [{ result } | { error }] · 저장소가 없거나 실패하면 null */
async function pipeline(commands) {
  const c = creds();
  if (!c) return null;
  try {
    const response = await fetch(`${c.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch (_) {
    return null;
  }
}

const dayKey = (kind, day) => `${PREFIX}:${kind}:${day}`;

/** 게임별 하루 숫자 +1 (plays · ranks) — 실패해도 원래 기능은 그대로 */
async function bumpGame(kind, game) {
  const key = dayKey(kind, seoulDay());
  await pipeline([
    ["HINCRBY", key, game, 1],
    ["EXPIRE", key, TTL],
  ]);
}

/** 사이트 방문자 하루 숫자 +1 */
async function bumpVisitor() {
  const key = dayKey("visitors", seoulDay());
  await pipeline([
    ["INCR", key],
    ["EXPIRE", key, TTL],
  ]);
}

module.exports = { TTL, PREFIX, seoulDay, creds, pipeline, dayKey, bumpGame, bumpVisitor };
