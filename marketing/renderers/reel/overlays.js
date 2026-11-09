"use strict";
/*
 * 영상 위 글자 · 틀을 크롬으로 그려 투명 PNG 로 (tools/game-reels/lib/overlays.js 에서 가져옴)
 * 바꾼 점: 폰트 Pretendard(OFL, npm pretendard 공식 배포) · 레이아웃 템플릿 3종(pop · neon · ribbon) · 엔딩 문구(지시서) ·
 *          글자를 줄여도 칸을 넘으면 기록(자막 잘림 검수) · 그리는 브라우저 컨텍스트 하나로 재사용
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const FONT_DIR = path.join(ROOT, "marketing", "node_modules", "pretendard", "dist", "web", "static", "woff2");
const FONT_WEIGHTS = { 700: "Bold", 800: "ExtraBold", 900: "Black" };
const FONTS = ["Pretendard"]; // 검수 허용 목록과 맞춤

const OUT = { w: 1080, h: 1920 };
const TOP = 250; // 위 디자인 영역
const GAME = { w: 878, h: 1560 }; // 9:16 게임 화면을 비율 그대로 (잘림 없음)
GAME.x = Math.round((OUT.w - GAME.w) / 2);
GAME.y = TOP;
const SITE = "todaygame.co.kr";

// 장르별 색 (사이트 카탈로그의 category)
const GENRE = {
  sports: { accent: "#ff7a1a", accent2: "#ffd23f" },
  rhythm: { accent: "#22c9ff", accent2: "#ff4fd8" },
  action: { accent: "#ff4757", accent2: "#ffd23f" },
  puzzle: { accent: "#2fbf8a", accent2: "#c9f7dd" },
  arcade: { accent: "#ff4f8b", accent2: "#ffd23f" },
  edu: { accent: "#ff9f1c", accent2: "#ffe27a" },
};
// 레이아웃 템플릿 — 같은 장르여도 돌아가며 쓴다
const TEMPLATES = ["pop", "neon", "ribbon"];

function pickTemplate(recent = []) {
  return TEMPLATES.find((t) => !recent.slice(0, TEMPLATES.length - 1).includes(t)) || TEMPLATES[0];
}

const look = (genre, template) => ({ ...(GENRE[genre] || GENRE.arcade), template: TEMPLATES.includes(template) ? template : "pop" });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function chickDataUrl() {
  try {
    return "data:image/svg+xml;base64," + fs.readFileSync(path.join(ROOT, "assets/edu/edu_chick.svg")).toString("base64");
  } catch (_) {
    return "";
  }
}

const FONT_CSS = Object.entries(FONT_WEIGHTS)
  .map(([w, n]) => `@font-face{font-family:"Pretendard";font-weight:${w};src:url("https://fonts.reel.local/Pretendard-${n}.woff2") format("woff2")}`)
  .join("");

const BASE_CSS = `${FONT_CSS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${OUT.w}px;height:${OUT.h}px;background:transparent;overflow:hidden}
body{font-family:"Pretendard",sans-serif;font-weight:800;color:#fff;-webkit-font-smoothing:antialiased;word-break:keep-all}
.abs{position:absolute}
.stroke{paint-order:stroke fill;-webkit-text-stroke:12px rgba(20,12,30,.9)}`;

const page = (inner, css = "") => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${inner}</body></html>`;

/* 항상 보이는 틀: 브랜드(글자 로고), 게임 테두리, 아래 주소 */
function baseHtml(L) {
  const chick = chickDataUrl();
  const brand = `${chick ? `<img src="${chick}">` : ""}<span>오늘의 게임</span>`;
  const t = L.template;
  return page(
    `${t === "ribbon" ? `<div class="abs rib"></div>` : ""}${t === "neon" ? `<div class="abs neonbar"></div>` : ""}
<div class="abs brand ${t}">${brand}</div>
<div class="abs frame ${t}" style="left:${GAME.x - 6}px;top:${GAME.y - 6}px;width:${GAME.w + 12}px;height:${GAME.h + 12}px"></div>
<div class="abs url" style="left:0;top:${GAME.y + GAME.h + 26}px;width:${OUT.w}px">${SITE}</div>`,
    `
.brand{left:40px;top:30px;display:flex;align-items:center;gap:10px;padding:8px 24px 8px 10px;border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 5px 0 rgba(0,0,0,.2)}
.brand img{width:46px;height:46px}.brand span{font-size:32px;font-weight:900;color:${L.accent};letter-spacing:-1px}
.brand.neon{background:rgba(10,8,24,.85);box-shadow:0 0 0 3px ${L.accent},0 0 24px ${L.accent}}.brand.neon span{color:#fff}
.brand.ribbon{left:50%;transform:translateX(-50%)}
.rib{left:0;top:0;width:${OUT.w}px;height:${TOP - 12}px;background:linear-gradient(135deg,${L.accent},${L.accent2});opacity:.92}
.neonbar{left:0;top:0;width:${OUT.w}px;height:${TOP - 12}px;background:linear-gradient(180deg,rgba(8,6,22,.92),rgba(8,6,22,.55))}
.frame{border:6px solid rgba(255,255,255,.92);border-radius:44px;box-shadow:0 10px 40px rgba(0,0,0,.35)}
.frame.neon{border-color:${L.accent};box-shadow:0 0 30px ${L.accent},0 0 60px ${L.accent2}}
.frame.ribbon{border-color:${L.accent2}}
.url{text-align:center;font-size:40px;font-weight:800;color:#fff;opacity:.95;text-shadow:0 3px 10px rgba(0,0,0,.6);letter-spacing:1px}`
  );
}

/* 게임 화면 둥근 모서리용 마스크 */
function maskHtml() {
  return `<!doctype html><html><head><style>*{margin:0}html,body{width:${GAME.w}px;height:${GAME.h}px;background:#000}
div{width:${GAME.w}px;height:${GAME.h}px;background:#fff;border-radius:38px}</style></head><body><div></div></body></html>`;
}

/* 위 디자인 영역의 큰 문구 (첫 문구 · 게임 이름 · 중간 자막 공통) */
function bandHtml({ text, sub = "", kind = "hook" }, L) {
  const t = L.template;
  const size = kind === "title" ? 76 : 92;
  const color = kind === "title" ? "#fff" : t === "ribbon" ? "#fff" : L.accent2;
  const glow = t === "neon" ? `text-shadow:0 0 18px ${L.accent},0 0 36px ${L.accent2};-webkit-text-stroke:0;` : "";
  const pill = kind === "caption" ? `background:${t === "ribbon" ? "rgba(20,12,30,.85)" : L.accent};padding:6px 34px 14px;border-radius:28px;box-shadow:0 8px 0 rgba(0,0,0,.25);transform:rotate(${t === "pop" ? -2 : 0}deg);` : "";
  return page(
    `<div class="abs wrap" style="left:40px;right:40px;top:104px;height:${TOP - 112}px">
  <div class="t ${t === "neon" ? "" : "stroke"}" style="font-size:${size}px;color:${color};${glow}${pill}">${esc(text)}</div>
  ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
</div>`,
    `.wrap{display:flex;flex-direction:column;align-items:center;justify-content:center}
.t{line-height:1.1;letter-spacing:-2px;white-space:nowrap;font-weight:900}
.sub{margin-top:6px;font-size:34px;font-weight:700;color:#fff;opacity:.95;text-shadow:0 3px 8px rgba(0,0,0,.7);white-space:nowrap}`
  );
}

/* 마지막 엔딩: 로고 · "오늘의 게임에서 플레이" · todaygame.co.kr */
function ctaHtml(L) {
  const chick = chickDataUrl();
  const dark = L.template === "neon";
  return page(
    `<div class="abs dim"></div>
<div class="abs card">
  ${chick ? `<img src="${chick}">` : ""}
  <div class="logo">오늘의 게임</div>
  <div class="l1">오늘의 게임에서 플레이</div>
  <div class="l2">${SITE}</div>
</div>`,
    `.dim{inset:0;background:linear-gradient(180deg,rgba(10,6,20,.2),rgba(10,6,20,.66) 45%,rgba(10,6,20,.74))}
.card{left:70px;right:70px;top:620px;padding:40px 30px 52px;border-radius:48px;text-align:center;
 background:${dark ? "rgba(10,8,24,.95)" : "#fff"};color:${dark ? "#fff" : "#3d2a36"};
 box-shadow:${dark ? `0 0 0 4px ${L.accent},0 0 40px ${L.accent}` : `0 16px 0 ${L.accent},0 30px 60px rgba(0,0,0,.4)`}}
.card img{width:130px;height:130px;margin:-112px auto 4px;display:block;filter:drop-shadow(0 6px 0 rgba(0,0,0,.15))}
.logo{font-size:44px;font-weight:900;color:${L.accent};letter-spacing:-1px}
.l1{font-size:62px;font-weight:900;margin:14px 0 10px;letter-spacing:-2px}
.l2{font-size:58px;font-weight:800;color:${dark ? L.accent2 : L.accent};letter-spacing:0}`
  );
}

/* 커버(첫 화면 이미지)용 큰 글자: 게임 이름 + 한 줄 */
function coverHtml({ title, line }, L) {
  return page(
    `<div class="abs box"><div class="t stroke">${esc(title)}</div>${line ? `<div class="s stroke">${esc(line)}</div>` : ""}</div>`,
    `.box{left:40px;right:40px;top:1120px;display:flex;flex-direction:column;align-items:center;gap:18px}
.t{font-size:120px;font-weight:900;line-height:1.05;letter-spacing:-4px;color:#fff;text-align:center;white-space:nowrap;-webkit-text-stroke:16px rgba(20,12,30,.92)}
.s{font-size:64px;font-weight:900;color:${L.accent2};white-space:nowrap;-webkit-text-stroke:12px rgba(20,12,30,.92)}`
  );
}

/** 그리는 도구: 브라우저 컨텍스트 하나, 폰트는 로컬 파일에서 (바깥으로 요청하지 않음) */
async function createPainter(browser) {
  if (!fs.existsSync(path.join(FONT_DIR, "Pretendard-Black.woff2"))) throw new Error("Pretendard 폰트가 없습니다. marketing 폴더에서 npm install 을 해 주세요.");
  const ctx = await browser.newContext({ viewport: { width: OUT.w, height: OUT.h }, deviceScaleFactor: 1 });
  await ctx.route("https://fonts.reel.local/**", (r) => r.fulfill({ path: path.join(FONT_DIR, path.basename(new URL(r.request().url()).pathname)), contentType: "font/woff2" }));
  await ctx.route((u) => !/^(data|about|https:\/\/fonts\.reel\.local)/.test(u.href), (r) => r.abort());
  const overflow = [];
  return {
    overflow,
    /** html → 투명 PNG. 글자가 칸을 넘으면 줄이고, 최소 크기에서도 넘으면 overflow 에 남긴다 */
    async png(html, file, size = OUT) {
      const p = await ctx.newPage();
      await p.setViewportSize({ width: size.w, height: size.h });
      await p.setContent(html, { waitUntil: "load" });
      await p.evaluate(() => document.fonts.ready);
      const cut = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll(".t,.s,.sub").forEach((el) => {
          const box = el.parentElement.getBoundingClientRect();
          let fs = parseFloat(getComputedStyle(el).fontSize);
          while (fs > 36 && el.scrollWidth > box.width - 4) {
            fs -= 4;
            el.style.fontSize = fs + "px";
          }
          if (el.scrollWidth > box.width - 4) out.push(el.textContent);
        });
        return out;
      });
      overflow.push(...cut);
      await p.screenshot({ path: file, omitBackground: true });
      await p.close();
      return file;
    },
    close: () => ctx.close(),
  };
}

module.exports = { OUT, TOP, GAME, SITE, FONTS, TEMPLATES, GENRE, pickTemplate, look, baseHtml, maskHtml, bandHtml, ctaHtml, coverHtml, createPainter };
