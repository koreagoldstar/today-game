/*
 * 🌊 바다 물총 대작전 — 시작 파일
 * 엔진(js/blaster) + 바다 콘텐츠(data · art · scenes)를 꽂아서 게임을 만든다.
 * 🚀우주 · 🦖공룡 · 🤖로봇 물총 대작전도 이 파일처럼 콘텐츠만 바꿔 끼우면 된다.
 */
import { BlasterGame } from "../../js/blaster/game.js?v=2";
import { ENEMIES, BOSSES, STAGES, BONUS, PROJECTILES, ITEMS, BOATS, BOOK, TEXTS, MENU_MUSIC } from "./data.js?v=2";
import { makeArt } from "./art/index.js?v=2";
import { createScenes } from "./sea.js?v=2";

const content = {
  id: "ocean-blaster",
  enemies: ENEMIES,
  bosses: BOSSES,
  stages: STAGES,
  bonus: BONUS,
  projectiles: PROJECTILES,
  items: ITEMS,
  boats: BOATS,
  book: BOOK,
  texts: TEXTS,
  menuMusic: MENU_MUSIC,
};
content.art = makeArt(content);
const scenes = createScenes();
content.scenes = scenes;
content.menuScene = (game) => scenes.menu(game);

const stage = document.getElementById("stage");
const field = document.getElementById("field");
const canvas = document.getElementById("game");

// 글자 크기를 화면 크기에 맞춘다 (--k = 화면 너비 / 540)
function fitField() {
  const w = canvas.getBoundingClientRect().width || 360;
  const h = canvas.getBoundingClientRect().height || 640;
  field.style.width = `${w}px`;
  field.style.height = `${h}px`;
  field.style.setProperty("--k", (w / 540).toFixed(4));
}

const game = new BlasterGame({ canvas, host: stage, content });
fitField();
window.addEventListener("resize", () => requestAnimationFrame(fitField));
window.addEventListener("orientationchange", () => setTimeout(fitField, 250));
if (window.ResizeObserver) new ResizeObserver(fitField).observe(canvas);

// 글꼴이 늦게 와도 캔버스 글자가 바로 예쁘게
if (document.fonts && document.fonts.load) {
  document.fonts.load('20px "Bagel Fat One"').catch(() => {});
  document.fonts.load('20px "Jua"').catch(() => {});
}

// 게임 소개(SEO) 글은 메뉴를 가리지 않게 설정 화면 맨 아래로
const about = document.querySelector(".seo-about");
const setBody = document.querySelector("#settings .panel-body");
if (about && setBody) setBody.appendChild(about);

document.body.classList.add("ready");
window.OceanBlaster = game;
