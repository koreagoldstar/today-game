/*
 * NEW 둥지디펜스 — 시작 파일 (불러오기 화면 → 게임)
 *  WebGL 이 없거나 불러오기에 실패하면 안내를 보여 준다.
 */
const bar = document.getElementById("load-bar");
const txt = document.getElementById("load-t");
const progress = (k, t) => {
  if (bar) bar.style.width = `${Math.round(k * 100)}%`;
  if (t && txt) txt.textContent = t;
};
const fail = (e) => {
  console.error(e);
  document.getElementById("loading").hidden = true;
  document.getElementById("fallback").hidden = false;
};

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (_) {
    return false;
  }
}

progress(0.1, "몬스터 군단을 부르는 중…");
if (!webglOk()) fail(new Error("WebGL 없음"));
else
  import("./js/game.js?v=1")
    .then(({ Game }) => {
      try {
        window.NestDefense = new Game({ canvas: document.getElementById("game"), field: document.getElementById("field"), onProgress: progress });
        progress(1, "준비 완료!");
        setTimeout(() => (document.getElementById("loading").hidden = true), 250);
      } catch (e) {
        fail(e);
      }
    })
    .catch(fail);

// 게임 중 브라우저가 스크롤 · 확대되지 않게 (창 안 카드는 스크롤)
document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(".card, .tpanel, .towers")) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
