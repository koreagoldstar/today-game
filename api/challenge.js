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
   * 매일 로테이션 챌린지 풀 (고정 순서)
   * 제외: 핀볼·가위바위보·홀짝·듀얼패드·슬라이드비트·펄스탭·홀인원골프·워들·상자야굴러가·고전
   */
  const POOL = [
    { id: "minesweeper", title: "지뢰찾기", href: "/games/minesweeper/", metric: "score" },
    { id: "flappy", title: "펄럭 병아리", href: "/games/flappy/", metric: "score" },
    { id: "doodle", title: "폴짝 하늘", href: "/games/doodle/", metric: "score" },
    { id: "tetris", title: "블록 팡팡", href: "/games/tetris/", metric: "score" },
    { id: "jump-run", title: "콩콩 점프", href: "/games/jump-run/", metric: "score" },
    { id: "ninja-dodge", title: "닌자 표창 피하기", href: "/games/ninja-dodge/", metric: "score" },
    { id: "stork-stride", title: "서빙왕", href: "/games/stork-stride/", metric: "score" },
    { id: "snake", title: "애플 스네이크", href: "/games/snake/", metric: "score" },
    { id: "slide-2048", title: "두배두배", href: "/games/slide-2048/", metric: "score" },
    { id: "memory", title: "짝짝 사천성", href: "/games/memory/", metric: "score" },
    { id: "whack-mole", title: "두더지 팡팡", href: "/games/whack-mole/", metric: "score" },
    { id: "brick", title: "별똥별 벽돌깨기", href: "/games/brick/", metric: "score" },
    { id: "alggagi", title: "알까기", href: "/games/alggagi/", metric: "score" },
    { id: "omok", title: "오목", href: "/games/omok/", metric: "score" },
    { id: "rhythm", title: "리듬 톡톡", href: "/games/rhythm/", metric: "score" },
    { id: "racing", title: "스피드 삐약이", href: "/games/racing/", metric: "score" },
    { id: "drift-chick", title: "드리프트 삐약이", href: "/games/drift-chick/", metric: "score" },
    { id: "crossy", title: "삐약이 건너기", href: "/games/crossy/", metric: "score" },
    { id: "cute-shoot", title: "귀염뽀짝 쏘세요", href: "/games/cute-shoot/", metric: "score" },
    { id: "puzzle-bubble", title: "팝샷 버블", href: "/games/puzzle-bubble/", metric: "score" },
    { id: "ttamogi", title: "땅땅 차지", href: "/games/ttamogi/", metric: "score" },
    { id: "diff", title: "다른 그림 찾기", href: "/games/diff/", metric: "score" },
    { id: "suika", title: "수박 합치기", href: "/games/suika/", metric: "score" },
    { id: "tower", title: "흔들흔들 스카이", href: "/games/tower/", metric: "score" },
    { id: "fruit-catch", title: "과일 바스켓", href: "/games/fruit-catch/", metric: "score" },
    { id: "bubble-pop", title: "팝팝 방울", href: "/games/bubble-pop/", metric: "score" },
  ];

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

  function sortBoard(list) {
    return list.slice().sort((a, b) => b.score - a.score);
  }

  function normalizeBoard(raw) {
    if (!Array.isArray(raw)) return [];
    const cleaned = raw
      .filter((e) => e && typeof e.name === "string" && Number.isFinite(Number(e.score)))
      .map((e) => ({
        name: String(e.name).slice(0, 8),
        score: Math.floor(Number(e.score)),
      }));
    return sortBoard(cleaned).slice(0, MAX_TOP);
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
      return normalizeBoard(JSON.parse(String(r.result)));
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
    let changed = false;
    if (idx >= 0) {
      if (score > board[idx].score) {
        board[idx].score = score;
        changed = true;
      }
    } else {
      board.push({ name, score });
      changed = true;
    }
    const next = sortBoard(board).slice(0, MAX_TOP);
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

  function formatBest(value) {
    if (value == null || !Number.isFinite(value)) return null;
    return `${value.toLocaleString("ko-KR")}점`;
  }

  function formatScores(list) {
    return list.map((e, i) => ({
      rank: i + 1,
      name: e.name,
      score: e.score,
      label: formatBest(e.score),
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
  const game = pickGame(day);
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
      bestLabel: top ? formatBest(top.score) : null,
      top10: formatScores(board),
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
        bestLabel: formatBest(result.best),
        top10: formatScores(result.board),
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
