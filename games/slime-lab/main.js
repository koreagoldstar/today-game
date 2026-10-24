/* 말랑팡! 슬라임 연구소 · 시작 */
import { Game } from "./js/game.js?v=1";

const canvas = document.getElementById("game");
const field = document.getElementById("field");
try {
  window.SlimeLab = new Game({ canvas, field });
} catch (e) {
  console.error(e);
  document.getElementById("fallback").hidden = false;
}
