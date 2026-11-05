/* 통통 동물 씨름왕 — 시작 파일 (불러오기 화면 → 게임) */
const bar = document.getElementById("boot-bar");
const txt = document.getElementById("boot-t");
const TIPS = ["씨름판 다지는 중…", "관중석 채우는 중…", "심판 올빼미 깨우는 중…", "뱃살 말랑하게 푸는 중…"];
let tipI = 0;
const tipTimer = setInterval(() => {
  tipI = (tipI + 1) % TIPS.length;
  if (txt) txt.textContent = TIPS[tipI];
}, 800);
if (bar) bar.style.width = "30%";
const fail = (e) => {
  console.error(e);
  clearInterval(tipTimer);
  document.getElementById("boot").classList.add("hidden");
  document.getElementById("fallback").classList.remove("hidden");
};
import("./js/app.js?v=1")
  .then(({ startApp }) => {
    if (bar) bar.style.width = "70%";
    return startApp();
  })
  .then(() => {
    clearInterval(tipTimer);
    document.getElementById("boot").classList.add("hidden");
  })
  .catch(fail);

// 경기 중 브라우저가 스크롤 · 확대되지 않게 (덮는 화면 안은 스크롤)
document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(".overlay, input")) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
