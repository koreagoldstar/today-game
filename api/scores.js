module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

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
  ]);
  /** 점수가 낮을수록 좋은 게임 (반응속도 ms 등) */
  const LOWER_BETTER = new Set(["reaction"]);
  const PERIODS = new Set(["day", "week"]);
  const MAX_KEEP = 50;
  const MAX_NAME = 8;
  const MIN_NAME = 2;
  const TTL_DAY = 60 * 60 * 24 * 4; // 4일
  const TTL_WEEK = 60 * 60 * 24 * 16; // 16일
  const JSONBLOB_ID = process.env.SCORES_JSONBLOB_ID || "019f8512-50b8-7988-81f9-1b253cbf6c68";
  const JSONBLOB_URL = `https://jsonblob.com/api/jsonBlob/${JSONBLOB_ID}`;

  function redisConfigured() {
    return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  }

  async function redis(command) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return { ok: false, configured: false };
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
      if (!response.ok) return { ok: false, configured: true, error: data };
      return { ok: true, configured: true, result: data.result };
    } catch (err) {
      return { ok: false, configured: true, error: String(err && err.message ? err.message : err) };
    }
  }

  function seoulDay(date = new Date()) {
    return date.toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  }

  /** ISO week id in Asia/Seoul, e.g. 2026-W29 */
  function seoulWeekId(date = new Date()) {
    const dayStr = seoulDay(date);
    const [y, m, d] = dayStr.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    const dayNum = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  function periodIds(now = new Date()) {
    return { day: seoulDay(now), week: seoulWeekId(now) };
  }

  function redisKey(game, period, periodId) {
    return `todaygame:scores:${game}:${period}:${periodId}`;
  }

  function blobSlot(period, periodId) {
    return `${period}:${periodId}`;
  }

  function sanitizeName(raw) {
    const name = String(raw || "")
      .replace(/[<>&"'`\\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (name.length < MIN_NAME || name.length > MAX_NAME) return null;
    return name;
  }

  function sanitizeScore(raw) {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0 || n > 9_999_999) return null;
    return n;
  }

  function normalizeList(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && typeof e.name === "string" && Number.isFinite(Number(e.score)))
      .map((e) => ({
        name: String(e.name).slice(0, MAX_NAME),
        score: Math.floor(Number(e.score)),
        at: e.at || null,
      }));
  }

  function sortScores(list, game) {
    const lower = LOWER_BETTER.has(game);
    return [...list].sort((a, b) => {
      if (a.score !== b.score) return lower ? a.score - b.score : b.score - a.score;
      return String(b.at || "").localeCompare(String(a.at || ""));
    });
  }

  /** 같은 닉네임은 기간 내 최고점만 유지 (낮을수록 좋은 게임은 최저점) */
  function upsertBest(list, entry, game) {
    const next = normalizeList(list);
    const lower = LOWER_BETTER.has(game);
    const idx = next.findIndex((e) => e.name === entry.name);
    if (idx >= 0) {
      const better = lower ? entry.score < next[idx].score : entry.score > next[idx].score;
      if (better) next[idx] = entry;
    } else {
      next.push(entry);
    }
    return sortScores(next, game).slice(0, MAX_KEEP);
  }

  function emptyGameBuckets() {
    const out = {};
    for (const game of ALLOWED) out[game] = {};
    return out;
  }

  function normalizeGameBuckets(raw) {
    const out = emptyGameBuckets();
    for (const game of ALLOWED) {
      const val = raw && raw[game];
      if (!val) {
        out[game] = {};
        continue;
      }
      // 구버전(배열)은 누적 랭킹 → 기간 보드로 넘기지 않음(신규 리셋)
      if (Array.isArray(val)) {
        out[game] = {};
        continue;
      }
      if (typeof val === "object") {
        const buckets = {};
        for (const [slot, list] of Object.entries(val)) {
          buckets[slot] = normalizeList(list);
        }
        out[game] = buckets;
      }
    }
    return out;
  }

  async function readBlobStore() {
    try {
      const response = await fetch(JSONBLOB_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return emptyGameBuckets();
      const data = await response.json();
      return normalizeGameBuckets(data);
    } catch {
      return emptyGameBuckets();
    }
  }

  async function writeBlobStore(store) {
    const payload = {};
    for (const game of ALLOWED) {
      const buckets = store[game] || {};
      const trimmed = {};
      for (const [slot, list] of Object.entries(buckets)) {
        trimmed[slot] = normalizeList(list).slice(0, MAX_KEEP);
      }
      payload[game] = trimmed;
    }
    const body = JSON.stringify(payload);
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    let response = await fetch(JSONBLOB_URL, {
      method: "PUT",
      headers,
      body,
    });
    if (response.ok) return true;
    // 기존 blob이 사라졌을 때(404 등) 새 blob 생성은 env 갱신이 필요하므로 실패로 처리
    return false;
  }

  async function readScores(game, period, periodId) {
    const key = redisKey(game, period, periodId);
    if (redisConfigured()) {
      const got = await redis(["GET", key]);
      if (got.ok) {
        if (got.result == null || got.result === "") {
          return { configured: true, backend: "upstash", scores: [] };
        }
        try {
          return { configured: true, backend: "upstash", scores: normalizeList(JSON.parse(got.result)) };
        } catch {
          return { configured: true, backend: "upstash", scores: [] };
        }
      }
    }
    const store = await readBlobStore();
    const slot = blobSlot(period, periodId);
    return {
      configured: true,
      backend: "jsonblob",
      scores: normalizeList((store[game] && store[game][slot]) || []),
    };
  }

  async function writeScores(game, period, periodId, scores) {
    const payload = JSON.stringify(scores.slice(0, MAX_KEEP));
    const key = redisKey(game, period, periodId);
    const ttl = period === "day" ? TTL_DAY : TTL_WEEK;
    if (redisConfigured()) {
      const saved = await redis(["SET", key, payload, "EX", ttl]);
      if (saved.ok) return { ok: true, backend: "upstash" };
    }
    const store = await readBlobStore();
    if (!store[game]) store[game] = {};
    store[game][blobSlot(period, periodId)] = scores.slice(0, MAX_KEEP);
    // 오래된 슬롯 정리 (같은 게임 최대 8개 유지)
    const slots = Object.keys(store[game]).sort();
    if (slots.length > 8) {
      for (const old of slots.slice(0, slots.length - 8)) {
        delete store[game][old];
      }
    }
    const ok = await writeBlobStore(store);
    return { ok, backend: "jsonblob" };
  }

  function parseBody(req) {
    if (!req.body) return {};
    if (typeof req.body === "object") return req.body;
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  function parsePeriod(raw) {
    const p = String(raw || "day").toLowerCase();
    return PERIODS.has(p) ? p : "day";
  }

  if (req.method === "GET") {
    const game = String(req.query.game || "");
    const period = parsePeriod(req.query.period);
    const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
    if (!ALLOWED.has(game)) {
      res.status(400).json({ error: "invalid game", scores: [], configured: true });
      return;
    }
    const ids = periodIds();
    const periodId = ids[period];
    const data = await readScores(game, period, periodId);
    const scores = sortScores(data.scores, game).slice(0, limit);
    res.status(200).json({
      game,
      period,
      periodId,
      day: ids.day,
      week: ids.week,
      scores,
      configured: true,
      backend: data.backend,
      error: null,
    });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const game = String(body.game || "");
    const name = sanitizeName(body.name);
    const score = sanitizeScore(body.score);
    if (!ALLOWED.has(game) || !name || score == null) {
      res.status(400).json({ ok: false, error: "invalid payload", configured: true });
      return;
    }
    const ids = periodIds();
    const entry = { name, score, at: new Date().toISOString() };

    const dayData = await readScores(game, "day", ids.day);
    const weekData = await readScores(game, "week", ids.week);
    const dayNext = upsertBest(dayData.scores, entry, game);
    const weekNext = upsertBest(weekData.scores, entry, game);

    const daySaved = await writeScores(game, "day", ids.day, dayNext);
    const weekSaved = await writeScores(game, "week", ids.week, weekNext);
    if (!daySaved.ok && !weekSaved.ok) {
      res.status(503).json({ ok: false, error: "save failed", configured: true });
      return;
    }

    const rankDay = dayNext.findIndex((e) => e.name === name) + 1;
    const rankWeek = weekNext.findIndex((e) => e.name === name) + 1;

    res.status(200).json({
      ok: true,
      rank: rankDay,
      rankDay,
      rankWeek,
      day: ids.day,
      week: ids.week,
      scores: dayNext.slice(0, 20),
      weekScores: weekNext.slice(0, 20),
      configured: true,
      backend: daySaved.backend || weekSaved.backend,
    });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
};
