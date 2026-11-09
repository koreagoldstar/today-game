"use strict";
/*
 * 이미지 템플릿 (HTML → 크롬 스크린샷 JPEG). 글꼴 Pretendard, 사이트와 같은 파스텔 · 병아리 느낌.
 * 피드 1080x1350 (4:5) · 스토리 1080x1920. 글자는 Source 의 facts 그대로 (바꾸거나 지어내지 않음).
 * .fit 상자는 넘치면 글자를 줄이고, 그래도 넘치면 검수 불합격 (overlays.createPainter).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const FEED = { w: 1080, h: 1350 };
const STORY = { w: 1080, h: 1920 };
const PALETTES = {
  pop: ["#ffe3ee", "#ffd6a5", "#ff4f8b"],
  sky: ["#d9f1ff", "#e8e1ff", "#3b82f6"],
  mint: ["#d8f8e7", "#fff6c9", "#16a37f"],
};
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let chick = null;
const chickUrl = () => {
  if (chick === null) {
    try {
      chick = "data:image/svg+xml;base64," + fs.readFileSync(path.join(ROOT, "assets/edu/edu_chick.svg")).toString("base64");
    } catch (_) {
      chick = "";
    }
  }
  return chick;
};
const FONT_CSS = [700, 800, 900].map((w) => `@font-face{font-family:"Pretendard";font-weight:${w};src:url("https://fonts.reel.local/Pretendard-${{ 700: "Bold", 800: "ExtraBold", 900: "Black" }[w]}.woff2") format("woff2")}`).join("");

function page(size, palette, inner, css = "") {
  const [a, b, accent] = PALETTES[palette] || PALETTES.pop;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${size.w}px;height:${size.h}px;overflow:hidden;word-break:keep-all}
body{font-family:"Pretendard",sans-serif;font-weight:800;color:#2f2433;background:linear-gradient(160deg,${a},${b});position:relative}
.brand{position:absolute;left:56px;top:48px;display:flex;align-items:center;gap:12px;padding:10px 26px 10px 12px;background:#fff;border-radius:999px;box-shadow:0 6px 0 rgba(0,0,0,.08)}
.brand img{width:52px;height:52px}.brand span{font-size:34px;font-weight:900;color:${accent}}
.url{position:absolute;left:0;right:0;bottom:44px;text-align:center;font-size:38px;font-weight:800;color:#5b4a5f;letter-spacing:1px}
.card{position:absolute;left:64px;right:64px;background:#fff;border-radius:44px;box-shadow:0 14px 0 ${accent}33,0 24px 50px rgba(0,0,0,.08);padding:48px 52px}
.accent{color:${accent}}
.fit{overflow:hidden}
${css}</style></head><body>
<div class="brand">${chickUrl() ? `<img src="${chickUrl()}">` : ""}<span>오늘의 게임</span></div>
${inner}
<div class="url">todaygame.co.kr</div></body></html>`;
}

/* ---------- C2 퀴즈 캐러셀: 표지 + 문제 + 마지막 장 ---------- */
function quizSlides(f) {
  const slides = [];
  slides.push(page(FEED, "sky", `<div class="card" style="top:300px;bottom:220px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
<div style="font-size:60px">🧠</div><div class="fit" style="height:300px;font-size:104px;font-weight:900;line-height:1.15;margin-top:24px">${esc(f.title)}<br><span class="accent">${f.questions.length}문제</span></div>
<div style="font-size:42px;margin-top:30px;color:#6b5a70">몇 개 맞힐 수 있을까요?</div><div style="font-size:36px;margin-top:40px;color:#8b7a90">옆으로 넘겨 보세요 →</div></div>`));
  f.questions.forEach((x, i) => {
    slides.push(page(FEED, "sky", `<div class="card" style="top:190px;bottom:170px">
<div style="font-size:40px" class="accent">Q${i + 1}.</div>
<div class="fit" style="height:330px;font-size:64px;font-weight:900;line-height:1.3;margin-top:14px;display:flex;align-items:center">${esc(x.q)}</div>
<div style="display:flex;flex-direction:column;gap:18px;margin-top:20px">${x.a.map((c, k) => `<div class="fit" style="height:96px;font-size:44px;padding:20px 30px;border-radius:26px;background:#f4f1ff;display:flex;align-items:center"><b class="accent" style="margin-right:18px">${k + 1}</b>${esc(c)}</div>`).join("")}</div></div>`));
  });
  slides.push(page(FEED, "pop", `<div class="card" style="top:330px;bottom:250px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
<div style="font-size:64px">✅</div><div style="font-size:84px;font-weight:900;margin-top:20px">정답은 <span class="accent">댓글</span>에서!</div>
<div style="font-size:46px;margin-top:34px;color:#6b5a70">더 많은 문제는</div><div style="font-size:54px;margin-top:10px">오늘의 게임 · 상식퀴즈</div></div>`));
  return slides;
}

/* ---------- C3 오늘의 운세 (스토리) ---------- */
function fortuneStory(f) {
  const rows = Object.values(f.items)
    .map((x) => `<div class="card" style="position:relative;left:auto;right:auto;margin:0 64px 34px;padding:38px 46px"><div style="font-size:40px" class="accent">${esc(x.emoji)} ${esc(x.title)}</div><div class="fit" style="height:84px;font-size:56px;font-weight:900;margin-top:10px">${esc(x.t)}</div><div class="fit" style="height:120px;font-size:38px;font-weight:700;line-height:1.45;color:#5b4a5f;margin-top:8px">${esc(x.d)}</div></div>`)
    .join("");
  return page(STORY, "pop", `<div style="position:absolute;top:190px;left:0;right:0;text-align:center"><div style="font-size:46px;color:#6b5a70">${esc(f.day.replace(/-/g, ". "))}</div><div style="font-size:110px;font-weight:900;margin-top:6px">오늘의 운세</div></div>
<div style="position:absolute;top:470px;left:0;right:0">${rows}</div>
<div style="position:absolute;bottom:130px;left:0;right:0;text-align:center;font-size:44px">내 운세 뽑기는 <span class="accent">오늘의 게임</span>에서</div>`);
}

/* ---------- C5 주간 TOP 랭킹 (피드 이미지) ---------- */
function rankingImage(f) {
  const medal = ["🥇", "🥈", "🥉"];
  const blocks = f.games
    .map((g) => `<div class="card" style="position:relative;left:auto;right:auto;margin:0 64px 26px;padding:30px 42px"><div class="fit" style="height:60px;font-size:44px;font-weight:900">${esc(g.title)} <span style="font-size:30px;color:#8b7a90">· ${g.entries}명${g.full ? " 이상" : ""} 참여</span></div>
${g.top.map((t, i) => `<div style="display:flex;justify-content:space-between;font-size:38px;margin-top:10px"><span>${medal[i]} ${esc(t.name)}</span><span class="accent">${esc(t.text)}</span></div>`).join("")}</div>`)
    .join("");
  return page(FEED, "mint", `<div style="position:absolute;top:160px;left:0;right:0;text-align:center"><div style="font-size:84px;font-weight:900">지난주 <span class="accent">TOP</span></div><div style="font-size:36px;color:#6b5a70;margin-top:6px">${esc(f.week)} · 사이트 랭킹 기록 그대로</div></div>
<div style="position:absolute;top:350px;bottom:150px;left:0;right:0;display:flex;flex-direction:column;justify-content:center">${blocks}</div>`);
}

/* ---------- C6 오늘의 챌린지 (스토리) ---------- */
function challengeStory(f) {
  return page(STORY, "sky", `<div class="card" style="top:520px;bottom:520px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
<div style="font-size:50px" class="accent">🏆 오늘의 챌린지</div><div class="fit" style="height:240px;font-size:110px;font-weight:900;line-height:1.1;margin-top:26px">${esc(f.game)}</div>
${f.tag ? `<div class="fit" style="height:60px;font-size:40px;color:#6b5a70;margin-top:14px">${esc(f.tag)}</div>` : ""}
${f.participants ? `<div style="font-size:44px;margin-top:26px">지금까지 <span class="accent">${f.participants}명</span> 도전</div>` : ""}
<div style="font-size:46px;margin-top:40px">오늘 하루만 열리는 기록 대결!</div></div>`);
}

/* ---------- C7 스토리 재활용: 피드 커버 + 안내 ---------- */
function recycleStory(f, coverDataUrl) {
  return page(STORY, "pop", `<div style="position:absolute;top:200px;left:110px;right:110px;height:1280px;border-radius:44px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.18);background:#000"><img src="${coverDataUrl}" style="width:100%;height:100%;object-fit:cover"></div>
<div style="position:absolute;top:1530px;left:0;right:0;text-align:center"><div class="fit" style="height:80px;font-size:60px;font-weight:900">${f.kind === "reel" ? "새 영상" : "새 게시물"}: ${esc(f.title)}</div><div style="font-size:42px;margin-top:10px;color:#6b5a70">프로필에서 보고, 오늘의 게임에서 플레이!</div></div>`);
}

module.exports = { FEED, STORY, quizSlides, fortuneStory, rankingImage, challengeStory, recycleStory };
