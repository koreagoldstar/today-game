"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const xml = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
urls.push(
  "https://www.todaygame.co.kr/js/main.js?v=16",
  "https://www.todaygame.co.kr/js/rankable.js?v=5",
  "https://www.todaygame.co.kr/assets/thumbs/wisdom-quiz.png",
  "https://www.todaygame.co.kr/assets/thumbs/fortune-draw.png",
  "https://www.todaygame.co.kr/games/wisdom-quiz/questions.js",
  "https://www.todaygame.co.kr/api/plays",
  "https://www.todaygame.co.kr/api/challenge"
);

(async () => {
  const bad = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });
      if (res.status >= 400) bad.push({ url, status: res.status });
    } catch (err) {
      bad.push({ url, error: String(err.message || err) });
    }
  }
  console.log(JSON.stringify({ checked: urls.length, bad }, null, 2));
})();
