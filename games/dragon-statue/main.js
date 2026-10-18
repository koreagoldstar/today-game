/*
 * 🐉 꼬마 동물단: 드래곤 석상 대작전! — 시작 파일
 */
import { Game } from "./js/game.js?v=1";

const field = document.getElementById("field");
const canvas = document.getElementById("game");

// 글자 · 버튼 크기를 화면에 맞춘다 (--k = 짧은 쪽 기준 / 540)
function fitField() {
  const w = window.innerWidth || 360;
  const h = window.innerHeight || 640;
  const k = Math.max(0.62, Math.min(1.45, Math.min(w, h * 0.72) / 540));
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

if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Bagel Fat One"').catch(() => {});
  document.fonts.load('20px "Jua"').catch(() => {});
}

// 사이트 공용 소리 끄기 (HUD · 타이틀 버튼)
function paintSound() {
  const muted = !!(window.TodayAudio && TodayAudio.isMuted());
  document.querySelectorAll("[data-sound]").forEach((b) => {
    b.innerHTML = muted ? b.dataset.off : b.dataset.on;
    b.setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
    b.setAttribute("aria-pressed", muted ? "true" : "false");
  });
}
document.querySelectorAll("[data-sound]").forEach((b) => {
  b.dataset.on = '<span data-icon="sound"></span>';
  b.dataset.off = '<span data-icon="mute"></span>';
  b.addEventListener("click", () => {
    if (window.TodayAudio) TodayAudio.toggle();
    paintSound();
    import("./js/icons.js?v=1").then((m) => m.paintIcons(document));
  });
});
paintSound();
import("./js/icons.js?v=1").then((m) => m.paintIcons(document));
window.addEventListener("todaygame-mute", () => {
  paintSound();
  import("./js/icons.js?v=1").then((m) => m.paintIcons(document));
});

// 게임 중 브라우저가 스크롤되지 않게 (목록 · 카드는 스크롤)
document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(".panel-body, .result-card, .rule-card, .char-row, .bat-row")) e.preventDefault();
  },
  { passive: false }
);

document.body.classList.add("ready");
window.DragonStatue = game;
