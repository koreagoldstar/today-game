/* 인형뽑기 마스터 — 시작 파일 (불러오기 화면 → 게임) */
const bar = document.getElementById("boot-bar");
const txt = document.getElementById("boot-t");
const TIPS = ["인형 채우는 중…", "집게 기름칠하는 중…", "반짝이 전구 켜는 중…"];
let i = 0;
const tip = setInterval(() => {
  i = (i + 1) % TIPS.length;
  if (txt) txt.textContent = TIPS[i];
}, 800);
if (bar) bar.style.width = "35%";
const fail = (e) => {
  console.error(e);
  clearInterval(tip);
  document.getElementById("boot").classList.add("hidden");
  document.getElementById("fallback").classList.remove("hidden");
};
import("./js/app.js?v=2")
  .then(({ startApp }) => {
    if (bar) bar.style.width = "75%";
    return startApp();
  })
  .then(() => {
    clearInterval(tip);
    document.getElementById("boot").classList.add("hidden");
  })
  .catch(fail);

// 게임 화면에서 스크롤 · 확대 막기 (덮는 화면 안은 스크롤)
document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(".overlay, .modal, input")) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
