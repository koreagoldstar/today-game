"use strict";
/* 조종 코드 공통 (tools/game-reels/adapters/_base.js 의 clickStart) */
const { sleep } = require("../io");

/** 시작 버튼을 누르고, 제목 화면이 닫혔는지로 시작을 확인한다 */
async function clickStart(io, { button = "#start-btn", titleId = "title", wait = 600 } = {}) {
  await io.page.waitForSelector(button, { state: "visible", timeout: 8000 });
  await sleep(700); // 그림이 올라올 시간
  await io.click(button);
  await sleep(wait);
  const stillTitle = titleId ? await io.overlayOpen(titleId) : false;
  if (!stillTitle) io.mark("start", "게임 시작", 0);
  return !stillTitle;
}

module.exports = { clickStart };
