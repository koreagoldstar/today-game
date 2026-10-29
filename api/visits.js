/**
 * 방문자 수 — 모두 우리 저장소(Upstash Redis)에서 센다
 *  - 오늘 방문: todaygame:stats:visitors:YYYY-MM-DD (서울 날짜 · 모니터실과 같은 숫자 · 400일 보관)
 *    2026-10-28 까지는 외부 카운터(abacus)에 날짜별로 셌다 — 그 기록은 모니터실이 그대로 읽는다
 *  - 누적 방문: todaygame:visits:total
 *  - 같은 브라우저는 하루 한 번만 센다 (홈 · 게임 페이지가 브라우저 쪽에서 막음)
 *
 * GET            → { today, total, day }  (세지 않고 읽기만)
 * GET ?count=1 · POST → 한 명 더 세고 { today, total, day }
 * 저장소에는 한 번만 다녀온다 (명령 여러 개를 한 묶음으로)
 */
const stats = require("./_stats");

const TOTAL_KEY = "todaygame:visits:total";
// 누적 숫자가 혹시 사라지면 1 이 아니라 여기서부터 (2026-10-29 바꿀 때 누적 1,487명)
const TOTAL_FLOOR = 1487;

const num = (r) => (r && !r.error && r.result != null ? Number(r.result) : null);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const day = stats.seoulDay();
  const shouldCount = req.method === "POST" || (req.query && req.query.count === "1");
  const todayKey = stats.dayKey("visitors", day);

  const out = await stats.pipeline(
    shouldCount
      ? [
          ["INCR", todayKey],
          ["EXPIRE", todayKey, stats.TTL],
          ["SET", TOTAL_KEY, String(TOTAL_FLOOR), "NX"],
          ["INCR", TOTAL_KEY],
        ]
      : [
          ["GET", todayKey],
          ["GET", TOTAL_KEY],
        ]
  );

  if (!out) {
    res.status(200).json({ today: null, total: null, day, error: "counter unavailable" });
    return;
  }
  // 읽기만 할 때 오늘 키가 없으면 아직 0명
  const today = shouldCount ? num(out[0]) : out[0] && !out[0].error ? Number(out[0].result) || 0 : null;
  const total = num(shouldCount ? out[3] : out[1]);
  if (today == null) {
    res.status(200).json({ today: null, total, day, error: "counter unavailable" });
    return;
  }
  res.status(200).json({ today, total, day });
};
