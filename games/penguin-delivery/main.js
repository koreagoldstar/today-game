/*
 * 펭귄 택배 대작전 — 시작 파일 (불러오기 화면 → 게임)
 *  WebGL 이 없거나 불러오기에 실패하면 안내를 보여 준다.
 */
const bar = document.getElementById("boot-bar");
const txt = document.getElementById("boot-t");
const TIPS = ["펭귄이 택배를 꽁꽁 묶는 중…", "얼음길에 왁스 칠하는 중…", "눈사람에게 인사하는 중…", "금빛 생선 세는 중…"];
let tipI = 0;
const tipTimer = setInterval(() => {
  tipI = (tipI + 1) % TIPS.length;
  if (txt) txt.textContent = TIPS[tipI];
}, 900);
const progress = (k, t) => {
  if (bar) bar.style.width = `${Math.round(k * 100)}%`;
  if (t && txt) txt.textContent = t;
};
const fail = (e) => {
  console.error(e);
  clearInterval(tipTimer);
  document.getElementById("boot").classList.add("hidden");
  document.getElementById("fallback").classList.remove("hidden");
};
function webglOk() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch (_) {
    return false;
  }
}
progress(0.15, TIPS[0]);
if (!webglOk()) fail(new Error("WebGL2 없음"));
else
  import("./js/app.js?v=2")
    .then(({ startApp }) => {
      progress(0.5, "눈꽃 마을을 짓는 중…");
      return new Promise((res) => setTimeout(res, 30)).then(() => startApp({ progress }));
    })
    .then(() => {
      clearInterval(tipTimer);
      document.getElementById("boot").classList.add("hidden");
    })
    .catch(fail);

// 게임 중 브라우저가 스크롤 · 확대되지 않게 (덮는 화면 안은 스크롤)
document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(".overlay, input")) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
