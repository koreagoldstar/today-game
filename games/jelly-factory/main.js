/* 말랑콩떡! 젤리 공장 · 시작 (불러오기에 실패해도 안내가 보이게 동적으로 불러옴) */
const fallback = () => {
  document.getElementById("fallback").hidden = false;
};
import("./js/game.js?v=1")
  .then(({ Game }) => {
    try {
      window.JellyFactory = new Game({ canvas: document.getElementById("game"), field: document.getElementById("field") });
    } catch (e) {
      console.error(e);
      fallback();
    }
  })
  .catch((e) => {
    console.error(e);
    fallback();
  });
