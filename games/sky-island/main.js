/*
 * ☁️ 하늘섬 대탈출 — 시작 파일
 */
import { Game } from "./js/game.js?v=2";

const field = document.getElementById("field");
const canvas = document.getElementById("game");

// 글자 · 버튼 크기를 화면에 맞춘다 (--k = 짧은 쪽 기준 / 540)
function fitField() {
  const w = window.innerWidth || 360;
  const h = window.innerHeight || 640;
  const k = Math.max(0.62, Math.min(1.4, Math.min(w, h * 0.72) / 540));
  field.style.setProperty("--k", k.toFixed(4));
  document.body.classList.toggle("portrait", w / h < 0.8);
}
fitField();

let game = null;
try {
  game = new Game({ canvas, field });
} catch (e) {
  console.error(e);
  document.getElementById("loading").hidden = true;
  document.getElementById("fallback").hidden = false;
}

let rz = 0;
const onResize = () => {
  cancelAnimationFrame(rz);
  rz = requestAnimationFrame(() => {
    fitField();
    if (game) game.resize();
  });
};
window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", () => setTimeout(onResize, 250));
if (window.ResizeObserver) new ResizeObserver(onResize).observe(field);

// 게임 중 브라우저가 스크롤 · 확대되지 않게 (카드 안은 스크롤)
document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(".card")) e.preventDefault();
  },
  { passive: false }
);

// 페이지를 떠날 때 3D 자원 · 소리 정리 (뒤로가기 캐시로 돌아오면 그대로 이어짐)
window.addEventListener("pagehide", (e) => {
  if (!e.persisted && game && game.renderer) {
    try {
      game.dispose();
    } catch (_) {}
  }
});

document.body.classList.add("ready");
window.SkyIsland = game;
