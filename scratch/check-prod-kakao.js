const urls = [
  "https://www.todaygame.co.kr/games/mirror-rhythm/",
  "https://www.todaygame.co.kr/games/neon-runner/",
  "https://www.todaygame.co.kr/games/rhythm-battle/",
  "https://www.todaygame.co.kr/games/fortune-draw/",
  "https://www.todaygame.co.kr/games/wisdom-quiz/",
];

(async () => {
  for (const url of urls) {
    const html = await (await fetch(url, { cache: "no-store" })).text();
    console.log(
      url,
      html.includes("카카오톡 공유") ? "kakao-btn" : "NO-KAKAO",
      html.includes("scores.js?v=7") ? "scores-v7" : "old-scores"
    );
  }
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  const post = await fetch("https://www.todaygame.co.kr/api/share-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
  });
  const data = await post.json();
  console.log("upload", post.status, data);
  if (data && data.url) {
    const get = await fetch(data.url, { cache: "no-store" });
    console.log("fetch-card", get.status, get.headers.get("content-type"), (await get.arrayBuffer()).byteLength);
  }
})();
