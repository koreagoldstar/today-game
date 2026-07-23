/**
 * 플레이 카운트 + 하루 1회 인기순 스냅샷
 *
 * POST { game } → 카운트 +1 (백그라운드, 홈 속도 무관)
 * GET → 오늘자 캐시된 plays/order 반환 (하루 1번만 재계산)
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const ALLOWED = new Set([
    "flappy",
    "tetris",
    "doodle",
    "jump-run",
    "ninja-dodge",
    "stork-stride",
    "snake",
    "minesweeper",
    "alggagi",
    "whack-mole",
    "omok",
    "rhythm",
    "racing",
    "drift-chick",
    "crossy",
    "cute-shoot",
    "brick",
    "puzzle-bubble",
    "ttamogi",
    "memory",
    "diff",
    "suika",
    "slide-2048",
    "tower",
    "fruit-catch",
    "bubble-pop",
    "pinball",
    "rps",
    "odd-even",
    "dual-pad",
    "slide-beat",
    "beat-tap",
    "minigolf",
    "wordle",
    "sokoban",
    "reaction",
    "order-memo",
    "donkey-kong",
    "prince",
    "lemmings",
    "bubble-bobble",
    "pacman-classic",
    "galaga",
    "lode-runner",
    "goindol",
    "sinseokgi",
  ]);

  /** 콜드스타트/폴백 순서 */
  const SEED = [
    "flappy",
    "tetris",
    "doodle",
    "jump-run",
    "snake",
    "slide-2048",
    "suika",
    "minesweeper",
    "wordle",
    "stork-stride",
    "ninja-dodge",
    "whack-mole",
    "brick",
    "puzzle-bubble",
    "memory",
    "cute-shoot",
    "racing",
    "drift-chick",
    "crossy",
    "bubble-pop",
    "fruit-catch",
    "tower",
    "omok",
    "alggagi",
    "ttamogi",
    "diff",
    "sokoban",
    "rhythm",
    "minigolf",
    "beat-tap",
    "slide-beat",
    "dual-pad",
  ];

  const REDIS_PLAYS = "todaygame:plays";
  const ABACUS_NS = "todaygamekr";

  function seoulDay() {
    return new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });
      const data = await response.json();
      if (!response.ok) return { ok: false, error: data };
      return { ok: true, result: data.result };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
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

  function hgetallToObject(result) {
    const plays = {};
    if (!result) return plays;
    if (Array.isArray(result)) {
      for (let i = 0; i + 1 < result.length; i += 2) {
        const id = String(result[i]);
        const n = Number(result[i + 1]) || 0;
        if (id && n > 0) plays[id] = n;
      }
      return plays;
    }
    if (typeof result === "object") {
      for (const [id, val] of Object.entries(result)) {
        const n = Number(val) || 0;
        if (n > 0) plays[id] = n;
      }
    }
    return plays;
  }

  function buildOrder(plays) {
    const ids = [...ALLOWED];
    ids.sort((a, b) => {
      const pa = Number(plays[a]) || 0;
      const pb = Number(plays[b]) || 0;
      if (pa !== pb) return pb - pa;
      const sa = SEED.indexOf(a);
      const sb = SEED.indexOf(b);
      const ra = sa >= 0 ? sa : 900;
      const rb = sb >= 0 ? sb : 900;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
    return ids;
  }

  function secondsUntilSeoulMidnight() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
    const elapsed = (map.hour || 0) * 3600 + (map.minute || 0) * 60 + (map.second || 0);
    return Math.max(60, 86400 - elapsed);
  }

  async function abacusHit(game) {
    const response = await fetch(
      `https://abacus.jasoncameron.dev/hit/${ABACUS_NS}/plays-${encodeURIComponent(game)}`
    );
    const data = await response.json();
    return Number(data.value ?? data.count ?? 0) || 0;
  }

  if (req.method === "POST") {
    res.setHeader("Cache-Control", "no-store");
    const body = parseBody(req);
    const game = String(body.game || "").trim();
    if (!ALLOWED.has(game)) {
      res.status(400).json({ ok: false, error: "unknown game" });
      return;
    }
    try {
      if (redisConfigured()) {
        const inc = await redis(["HINCRBY", REDIS_PLAYS, game, 1]);
        if (inc.ok) {
          res.status(200).json({ ok: true, game, count: Number(inc.result) || 0, store: "redis" });
          return;
        }
      }
      const count = await abacusHit(game);
      res.status(200).json({ ok: true, game, count, store: "abacus" });
    } catch (_) {
      res.status(200).json({ ok: false, game, error: "counter unavailable" });
    }
    return;
  }

  if (req.method === "GET") {
    const day = seoulDay();
    const dailyKey = `todaygame:popularity:${day}`;

    try {
      if (redisConfigured()) {
        const cached = await redis(["GET", dailyKey]);
        if (cached.ok && cached.result) {
          try {
            const parsed = JSON.parse(String(cached.result));
            if (parsed && parsed.day === day) {
              res.status(200).json({
                ok: true,
                day,
                plays: parsed.plays || {},
                order: parsed.order || [],
                store: "daily-cache",
                rebuilt: false,
              });
              return;
            }
          } catch (_) {
            /* rebuild below */
          }
        }

        const all = await redis(["HGETALL", REDIS_PLAYS]);
        const plays = all.ok ? hgetallToObject(all.result) : {};
        const order = buildOrder(plays);
        const payload = { day, plays, order, at: new Date().toISOString() };
        await redis(["SET", dailyKey, JSON.stringify(payload), "EX", secondsUntilSeoulMidnight()]);
        res.status(200).json({
          ok: true,
          day,
          plays,
          order,
          store: "redis",
          rebuilt: true,
        });
        return;
      }

      // Redis 없으면 실시간 집계 안 함 — 시드만 (느린 Abacus 전체조회 금지)
      res.status(200).json({
        ok: true,
        day,
        plays: {},
        order: SEED,
        store: "seed",
        rebuilt: false,
      });
    } catch (_) {
      res.status(200).json({
        ok: true,
        day,
        plays: {},
        order: SEED,
        store: "seed",
        error: "counter unavailable",
      });
    }
    return;
  }

  res.status(405).json({ ok: false, error: "method not allowed" });
};
