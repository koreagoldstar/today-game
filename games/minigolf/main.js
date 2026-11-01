/*
 * 홀인원 골프 — 시작 파일 (불러오기 화면 → 게임)
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
  document.getElementById("boot").hidden = true;
  document.getElementById("fallback").hidden = false;
};
function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch (_) {
    return false;
  }
}
progress(0.1, "클럽을 챙기는 중…");
if (!webglOk()) fail(new Error("WebGL2 없음"));
else
  import("./js/app.js?v=1")
    .then(({ startApp }) => startApp({ progress }))
    .then(() => {
      document.getElementById("boot").hidden = true;
    })
    .catch(fail);

// 게임 중 브라우저가 스크롤 · 확대되지 않게 (창 안 카드는 스크롤)
document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(".screen, input")) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
