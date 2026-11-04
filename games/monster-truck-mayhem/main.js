/*
 * 몬스터 트럭 대소동 — 시작 파일 (불러오기 화면 → 게임)
 *  WebGL 이 없거나 불러오기에 실패하면 안내를 보여 준다.
 */
const bar = document.getElementById("boot-bar");
const txt = document.getElementById("boot-t");
const TIPS = ["엔진 예열하는 중…", "거대한 타이어에 바람 넣는 중…", "폐차 쌓아 올리는 중…", "폭발 드럼통 조심히 옮기는 중…", "관중 입장시키는 중…"];
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
progress(0.15);
if (!webglOk()) fail(new Error("WebGL2 없음"));
else
  import("./js/app.js?v=1")
    .then(({ startApp }) => {
      progress(0.5, "경기장을 짓는 중…");
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
