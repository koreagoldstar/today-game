/**
 * 카카오 피드용 결과 카드 이미지
 * POST { image: dataUrl } → { ok, id, url }
 * GET ?id= → image/png
 */
const crypto = require("crypto");

const MAX_BYTES = 380000;
const TTL_SEC = 60 * 60 * 2;

function store() {
  if (!globalThis.__todayShareCards) globalThis.__todayShareCards = new Map();
  return globalThis.__todayShareCards;
}

function parseDataUrl(image) {
  const raw = String(image || "");
  const m = raw.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  if (!buf.length || buf.length > MAX_BYTES) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return buf;
}

async function redisCmd(args) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) return null;
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    const id = String((req.query && req.query.id) || "").replace(/[^a-f0-9]/g, "");
    if (id.length < 8) {
      res.status(404).end();
      return;
    }
    let buf = store().get(id);
    if (!buf) {
      const hit = await redisCmd(["GET", `share-card:${id}`]);
      if (hit && typeof hit.result === "string") {
        buf = Buffer.from(hit.result, "base64");
      }
    }
    if (!buf) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.status(200).send(buf);
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  let body = req.body || {};
  try {
    if (typeof body === "string") body = JSON.parse(body || "{}");
  } catch (_) {
    res.status(400).json({ ok: false, error: "json" });
    return;
  }
  const buf = parseDataUrl(body.image);
  if (!buf) {
    res.status(400).json({ ok: false, error: "image" });
    return;
  }

  const id = crypto.randomBytes(8).toString("hex");
  store().set(id, buf);
  setTimeout(() => store().delete(id), TTL_SEC * 1000).unref?.();
  await redisCmd(["SET", `share-card:${id}`, buf.toString("base64"), "EX", String(TTL_SEC)]);

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "www.todaygame.co.kr");
  const proto = host.includes("localhost") ? "http" : "https";
  const url = `${proto}://${host}/api/share-card?id=${id}`;
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, id, url });
};
