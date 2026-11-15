/**
 * 어른이용 게임 투표 집계 (이상형 월드컵 우승 · 밸런스 게임 선택)
 *
 * GET  /api/poll?id=wc-yasik            → { ok, counts: { chicken: 12, ... }, total }
 * GET  /api/poll?ids=bal-1,bal-2        → { ok, polls: { "bal-1": { a: 3, b: 5 }, ... } }
 * POST /api/poll { id, pick }           → 해당 항목 +1, 집계 반환
 *
 * 저장소(Upstash)가 없으면 { ok: false } — 화면은 "집계 준비 중"으로 처리
 */
const { pipeline } = require("./_stats");

const PREFIX = "todaygame:poll";
const TTL = 60 * 60 * 24 * 800;
const ID_RE = /^(wc|bal)-[a-z0-9-]{1,40}$/;
const PICK_RE = /^[a-z0-9-]{1,40}$/;

function toCounts(flat) {
  const out = {};
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const n = Number(flat[i + 1]);
    if (PICK_RE.test(String(flat[i])) && Number.isFinite(n)) out[flat[i]] = n;
  }
  return out;
}

function total(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (_) {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (_) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const q = req.query || {};

  if (req.method === "GET") {
    const ids = String(q.ids || q.id || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => ID_RE.test(s))
      .slice(0, 40);
    if (!ids.length) {
      res.status(400).json({ ok: false, error: "id" });
      return;
    }
    const result = await pipeline(ids.map((id) => ["HGETALL", `${PREFIX}:${id}`]));
    if (!result) {
      res.status(200).json({ ok: false, error: "store" });
      return;
    }
    const polls = {};
    ids.forEach((id, i) => {
      polls[id] = toCounts(result[i] && result[i].result);
    });
    if (q.id && ids.length === 1) {
      const counts = polls[ids[0]];
      res.status(200).json({ ok: true, counts, total: total(counts) });
      return;
    }
    res.status(200).json({ ok: true, polls });
    return;
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const id = String(body.id || "");
    const pick = String(body.pick || "");
    if (!ID_RE.test(id) || !PICK_RE.test(pick)) {
      res.status(400).json({ ok: false, error: "bad" });
      return;
    }
    const key = `${PREFIX}:${id}`;
    const result = await pipeline([
      ["HINCRBY", key, pick, 1],
      ["EXPIRE", key, TTL],
      ["HGETALL", key],
    ]);
    if (!result) {
      res.status(200).json({ ok: false, error: "store" });
      return;
    }
    const counts = toCounts(result[2] && result[2].result);
    res.status(200).json({ ok: true, counts, total: total(counts) });
    return;
  }

  res.status(405).json({ ok: false });
};
