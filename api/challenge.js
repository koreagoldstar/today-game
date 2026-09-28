module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  /**
   * 매일 로테이션 챌린지 풀 (고정 순서) — 기록형 게임만.
   * 기록 챌린지 3종이 고르게 돌아오도록 사이사이에 섞었다.
   * lower: 낮을수록 좋은 기록 (10초 맞추기 오차 ms, 번쩍 반응 ms)
   * unit: 표시 단위 (ms·s3=초 소수 3자리·cs=초 소수 2자리·점)
   */
  const POOL = [
    { id: "10-second", title: "10초 정확히 맞추기", href: "/games/10-second/", metric: "time", lower: true, unit: "s3" },
    { id: "flappy", title: "펄럭 병아리", href: "/games/flappy/", metric: "score" },
    { id: "number-hole", title: "넘버 홀", href: "/games/number-hole/", metric: "score" },
    { id: "rhythm", title: "리듬 톡톡", href: "/games/rhythm/", metric: "score" },
    { id: "tower", title: "흔들흔들 스카이", href: "/games/tower/", metric: "score" },
    { id: "reaction", title: "번쩍 반응", href: "/games/reaction/", metric: "time", lower: true, unit: "ms" },
    { id: "color-reaction", title: "색깔 반응 테스트", href: "/games/color-reaction/", metric: "score" },
    { id: "cosmic-dodge", title: "우주 회피", href: "/games/cosmic-dodge/", metric: "score" },
    { id: "chick-defense", title: "둥지 디펜스", href: "/games/chick-defense/", metric: "score" },
    { id: "fish-rush", title: "황금 낚시", href: "/games/fish-rush/", metric: "score" },
    { id: "tetris", title: "블록 팡팡", href: "/games/tetris/", metric: "score" },
    { id: "doodle", title: "폴짝 하늘", href: "/games/doodle/", metric: "score" },
    { id: "bomb-dodge", title: "폭탄 피하기", href: "/games/bomb-dodge/", metric: "time", unit: "cs" },
    { id: "ninja-dodge", title: "닌자 표창 피하기", href: "/games/ninja-dodge/", metric: "score" },
    { id: "stork-stride", title: "서빙왕", href: "/games/stork-stride/", metric: "score" },
    { id: "fruit-catch", title: "과일 바스켓", href: "/games/fruit-catch/", metric: "score" },
    { id: "jump-run", title: "콩콩 점프", href: "/games/jump-run/", metric: "score" },
    { id: "slide-2048", title: "두배두배", href: "/games/slide-2048/", metric: "score" },
    { id: "crossy", title: "삐약이 건너기", href: "/games/crossy/", metric: "score" },
    { id: "brick", title: "별똥별 벽돌깨기", href: "/games/brick/", metric: "score" },
  ];
  const POOL_BY_ID = new Map(POOL.map((g) => [g.id, g]));

  const ABACUS_NS = "todaygame-challenge";
  const MAX_TOP = 10;

  function seoulDay(date = new Date()) {
    return date.toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  }

  function seoulDayNum(dayStr) {
    const [y, m, d] = dayStr.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  function endsAtMs(dayStr) {
    const [y, m, d] = dayStr.split("-").map(Number);
    return Date.UTC(y, m - 1, d + 1) - 9 * 3600 * 1000;
  }

  function pickGame(dayStr) {
    const idx = ((seoulDayNum(dayStr) % POOL.length) + POOL.length) % POOL.length;
    return { ...POOL[idx], index: idx };
  }

  /** 저장된 게임에 현재 풀의 설정(lower·unit·제목)을 덧입힌다. 풀에서 빠진 게임이면 null */
  function withPoolInfo(game) {
    const meta = game && POOL_BY_ID.get(game.id);
    if (!meta) return null;
    return { ...meta, index: POOL.indexOf(meta) };
  }

  function dailyGameKey(dayStr) {
    return `todaygame:challenge:game:${dayStr}`;
  }

  function parseStoredGame(raw) {
    if (raw == null || raw === "") return null;
    try {
      const game = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!game || typeof game !== "object") return null;
      if (!game.id || !game.title || !game.href) return null;
      return {
        id: String(game.id),
        title: String(game.title),
        href: String(game.href),
        metric: String(game.metric || "score"),
        index: Number.isInteger(game.index) ? game.index : -1,
      };
    } catch {
      return null;
    }
  }

  async function pickDailyGame(dayStr) {
    const fallback = pickGame(dayStr);
    if (!redisConfigured()) return fallback;

    const key = dailyGameKey(dayStr);
    const stored = await redis(["GET", key]);
    const existing = stored.ok ? withPoolInfo(parseStoredGame(stored.result)) : null;
    if (existing) return existing;

    // 저장된 게임이 없거나, 풀에서 빠진 게임(기록형이 아닌 게임)이면 오늘 게임을 새로 고정한다
    const hadStale = stored.ok && stored.result != null && stored.result !== "";
    if (hadStale) await redis(["SET", key, JSON.stringify(fallback), "EX", 60 * 60 * 24 * 3]);
    else await redis(["SET", key, JSON.stringify(fallback), "NX", "EX", 60 * 60 * 24 * 3]);

    // 동시에 여러 지역에서 첫 요청이 와도 Redis에서 먼저 고정된 하나를 사용한다.
    const locked = await redis(["GET", key]);
    return (locked.ok && withPoolInfo(parseStoredGame(locked.result))) || fallback;
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
      if (!response.ok) return { ok: false };
      return { ok: true, result: data.result };
    } catch {
      return { ok: false };
    }
  }

  async function abacus(path) {
    try {
      const response = await fetch(`https://abacus.jasoncameron.dev/${path}`);
      const data = await response.json();
      return Number(data.value ?? data.count ?? 0) || 0;
    } catch {
      return null;
    }
  }

  function boardKey(day, gameId) {
    return `todaygame:challenge:board:${day}:${gameId}`;
  }

  function bestKey(day, gameId) {
    return `todaygame:challenge:best:${day}:${gameId}`;
  }

  function sanitizeName(raw) {
    const name = String(raw || "")
      .replace(/[<>&"'`\\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (name.length < 2 || name.length > 8) return null;
    return name;
  }

  function isLower(gameId) {
    const g = POOL_BY_ID.get(gameId);
    return Boolean(g && g.lower);
  }

  function sortBoard(list, gameId) {
    const lower = isLower(gameId);
    return list.slice().sort((a, b) => (lower ? a.score - b.score : b.score - a.score));
  }

  function normalizeBoard(raw, gameId) {
    if (!Array.isArray(raw)) return [];
    const cleaned = raw
      .filter((e) => e && typeof e.name === "string" && Number.isFinite(Number(e.score)))
      .map((e) => ({
        name: String(e.name).slice(0, 8),
        score: Math.floor(Number(e.score)),
      }));
    return sortBoard(cleaned, gameId).slice(0, MAX_TOP);
  }

  async function readBoard(day, gameId) {
    if (!redisConfigured()) return [];
    const r = await redis(["GET", boardKey(day, gameId)]);
    if (!r.ok || r.result == null || r.result === "") {
      const legacy = await redis(["GET", bestKey(day, gameId)]);
      if (!legacy.ok || legacy.result == null || legacy.result === "") return [];
      try {
        const parsed = JSON.parse(String(legacy.result));
        if (parsed && typeof parsed === "object" && parsed.name) {
          const n = Math.floor(Number(parsed.value ?? parsed.score));
          if (Number.isFinite(n)) return [{ name: String(parsed.name).slice(0, 8), score: n }];
        }
      } catch {
        /* ignore */
      }
      return [];
    }
    try {
      return normalizeBoard(JSON.parse(String(r.result)), gameId);
    } catch {
      return [];
    }
  }

  async function writeBoardEntry(day, gameId, name, score) {
    if (!redisConfigured()) {
      return { updated: false, board: [], best: null, name: null, configured: false };
    }
    const board = await readBoard(day, gameId);
    const idx = board.findIndex((e) => e.name === name);
    const lower = isLower(gameId);
    let changed = false;
    if (idx >= 0) {
      // 같은 이름은 더 좋은 기록만 (낮을수록 좋은 게임은 더 낮은 값)
      if (lower ? score < board[idx].score : score > board[idx].score) {
        board[idx].score = score;
        changed = true;
      }
    } else {
      board.push({ name, score });
      changed = true;
    }
    const next = sortBoard(board, gameId).slice(0, MAX_TOP);
    if (changed) {
      await redis(["SET", boardKey(day, gameId), JSON.stringify(next), "EX", 60 * 60 * 24 * 4]);
      const top = next[0] || null;
      if (top) {
        await redis([
          "SET",
          bestKey(day, gameId),
          JSON.stringify({ value: top.score, name: top.name }),
          "EX",
          60 * 60 * 24 * 4,
        ]);
      }
    }
    const top = next[0] || null;
    return {
      updated: changed,
      board: next,
      best: top ? top.score : null,
      name: top ? top.name : null,
      configured: true,
    };
  }

  function formatBest(value, gameId) {
    if (value == null || !Number.isFinite(value)) return null;
    const unit = (POOL_BY_ID.get(gameId) || {}).unit;
    if (unit === "s3") return `${(value / 1000).toFixed(3)}초`;
    if (unit === "cs") return `${(value / 100).toFixed(2)}초`;
    if (unit === "ms") return `${value.toLocaleString("ko-KR")}ms`;
    return `${value.toLocaleString("ko-KR")}점`;
  }

  function formatScores(list, gameId) {
    return list.map((e, i) => ({
      rank: i + 1,
      name: e.name,
      score: e.score,
      label: formatBest(e.score, gameId),
    }));
  }

  function parseBody(req) {
    if (!req.body) return {};
    if (typeof req.body === "object") return req.body;
    try {
      return JSON.parse(String(req.body));
    } catch {
      return {};
    }
  }

  const day = seoulDay();
  const game = await pickDailyGame(day);
  const endsAt = endsAtMs(day);

  if (req.method === "GET") {
    const participants = await abacus(`get/${ABACUS_NS}/day-${day}-${game.id}`);
    const board = await readBoard(day, game.id);
    const top = board[0] || null;
    res.status(200).json({
      ok: true,
      day,
      endsAt,
      remainingMs: Math.max(0, endsAt - Date.now()),
      game,
      poolSize: POOL.length,
      participants,
      best: top ? top.score : null,
      bestName: top ? top.name : null,
      bestLabel: top ? formatBest(top.score, game.id) : null,
      top10: formatScores(board, game.id),
    });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const action = String(body.action || req.query.action || "join");

    if (action === "join") {
      const participants = await abacus(`hit/${ABACUS_NS}/day-${day}-${game.id}`);
      res.status(200).json({ ok: true, day, game, participants, endsAt });
      return;
    }

    if (action === "best") {
      const reported = String(body.game || "");
      if (reported && reported !== game.id) {
        res.status(200).json({ ok: true, skipped: true, reason: "not-today-game" });
        return;
      }
      const value = Math.floor(Number(body.value ?? body.score));
      if (!Number.isFinite(value) || value < 0 || value > 9_999_999) {
        res.status(400).json({ ok: false, error: "invalid value" });
        return;
      }
      const name = sanitizeName(body.name);
      if (!name) {
        res.status(400).json({ ok: false, error: "invalid name" });
        return;
      }
      const result = await writeBoardEntry(day, game.id, name, value);
      const myIdx = result.board.findIndex((e) => e.name === name);
      const rank = myIdx >= 0 ? myIdx + 1 : null;
      const participants = await abacus(`get/${ABACUS_NS}/day-${day}-${game.id}`);
      const total = Math.max(
        result.board.length,
        participants == null ? 0 : Number(participants) || 0
      );
      res.status(200).json({
        ok: true,
        day,
        game,
        best: result.best,
        bestName: result.name,
        bestLabel: formatBest(result.best, game.id),
        top10: formatScores(result.board, game.id),
        rank,
        total,
        participants,
        updated: result.updated,
        configured: result.configured !== false,
      });
      return;
    }

    res.status(400).json({ ok: false, error: "invalid action" });
    return;
  }

  res.status(405).json({ ok: false, error: "method not allowed" });
};
