/*
 * 🌊 바다괴물 탐험대 — 시작 파일
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

if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Bagel Fat One"').catch(() => {});
  document.fonts.load('20px "Jua"').catch(() => {});
}

// 게임 중 브라우저가 스크롤되지 않게 (목록 · 카드는 스크롤)
document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(".panel-body, .result-card")) e.preventDefault();
  },
  { passive: false }
);

document.body.classList.add("ready");
window.SeaMonster = game;
