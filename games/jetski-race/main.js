/*
 * 🏁 제트스키 썬더 레이스 — 시작 파일
 */
import { Game } from "./js/game.js?v=1";

const stage = document.getElementById("stage");
const field = document.getElementById("field");
const canvas = document.getElementById("game");

// 글자 크기를 화면 크기에 맞춘다 (--k = 화면 너비 / 540)
function fitField() {
  const r = canvas.getBoundingClientRect();
  const w = r.width || 360;
  const h = r.height || 640;
  field.style.width = `${w}px`;
  field.style.height = `${h}px`;
  field.style.setProperty("--k", (w / 540).toFixed(4));
}

const game = new Game({ canvas, host: stage });
fitField();
window.addEventListener("resize", () => requestAnimationFrame(fitField));
window.addEventListener("orientationchange", () => setTimeout(fitField, 250));
if (window.ResizeObserver) new ResizeObserver(fitField).observe(canvas);

// 글꼴이 늦게 와도 캔버스 글자가 바로 예쁘게
if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Bagel Fat One"').catch(() => {});
  document.fonts.load('20px "Jua"').catch(() => {});
}

// 게임 중 브라우저가 스크롤되지 않게
document.addEventListener("touchmove", (e) => {
  if (!e.target.closest(".panel-body, .result-card, .rec-tabs")) e.preventDefault();
}, { passive: false });

// 게임 소개(SEO) 글은 메뉴를 가리지 않게 '하는 법' 맨 아래로
const about = document.querySelector(".seo-about");
const howBody = document.querySelector("#howto .panel-body");
if (about && howBody) howBody.appendChild(about);

document.body.classList.add("ready");
window.JetskiRace = game;
