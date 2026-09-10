/**
 * Korean TTS audio for Hangul games.
 * Serves MPEG so phones without a local Korean voice still hear the same clip.
 * GET /api/speak?q=기역
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const q = String(req.query.q || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (!q) {
    res.status(400).json({ error: "q required" });
    return;
  }

  const encoded = encodeURIComponent(q);
  const urls = [
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=ko&q=${encoded}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ko&q=${encoded}`,
  ];
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
    Referer: "https://translate.google.com/",
  };

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) continue;
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length < 200) continue;
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.status(200).send(buf);
      return;
    } catch (_) {
      /* try next */
    }
  }

  res.status(502).json({ error: "tts unavailable" });
};
