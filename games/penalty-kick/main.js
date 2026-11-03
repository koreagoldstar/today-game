/*
 * 승부차기 히어로 — 시작 파일 (불러오기 화면 → 게임)
 *  WebGL 이 없거나 불러오기에 실패하면 안내를 보여 준다.
 */
const bar = document.getElementById("boot-bar");
const txt = document.getElementById("boot-t");
const progress = (k, t) => {
  if (bar) bar.style.width = `${Math.round(k * 100)}%`;
  if (t && txt) txt.textContent = t;
};
const fail = (e) => {
  console.error(e);
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
progress(0.1, "경기장 불을 켜는 중…");
if (!webglOk()) fail(new Error("WebGL2 없음"));
else
  import("./js/app.js?v=1")
    .then(({ startApp }) => startApp({ progress }))
    .then(() => document.getElementById("boot").classList.add("hidden"))
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
