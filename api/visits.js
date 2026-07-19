module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const day = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  const namespace = "todaygamekr";
  const key = `day-${day}`;

  const shouldCount = req.method === "POST" || req.query.count === "1";

  try {
    const endpoint = shouldCount
      ? `https://abacus.jasoncameron.dev/hit/${namespace}/${key}`
      : `https://abacus.jasoncameron.dev/get/${namespace}/${key}`;
    const response = await fetch(endpoint);
    const data = await response.json();
    const value = Number(data.value ?? data.count ?? 0) || 0;
    res.status(200).json({ today: value, day });
  } catch (err) {
    res.status(200).json({ today: null, day, error: "counter unavailable" });
  }
};
