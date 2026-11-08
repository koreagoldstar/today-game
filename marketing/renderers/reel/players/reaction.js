"use strict";
/* 번쩍 반응: 화면이 초록이 되는 순간 탭. 사람처럼 0.18~0.26초 뒤에 누르고, 가끔은 너무 일찍 눌러 실패 장면도. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

module.exports = {
  id: "reaction",
  level: "easy",
  strategy: "E",
  genre: "rhythm",
  needsCanvas: false,
  hooks: ["반응속도 테스트", "초록불에 바로 탭!", "0.2초 안에 누를 수 있어?"],
  captions: { score: ["빠르다!", "반사신경 미쳤다"], fail: ["너무 빨랐다!", "성급했다"] },
  thumbText: ["몇 ms 나와?", "반응속도 테스트"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    const arena = await io.box("#arena");
    const cx = arena.x + arena.width / 2;
    const cy = arena.y + arena.height / 2;
    let tries = 0;
    while (io.running()) {
      if (await io.overlayOpen("result")) {
        const ms = await io.num("#result-ms");
        io.mark("score", `${ms}ms`, ms < 230 ? 3 : 2);
        await sleep(rand(1200, 1700));
        await io.click("#retry-btn");
        continue;
      }
      if (await io.overlayOpen("early")) {
        await sleep(rand(1000, 1400));
        await io.click("#early-btn");
        continue;
      }
      const ready = await io.page.evaluate(() => document.getElementById("arena").classList.contains("mode-ready")).catch(() => false);
      if (ready) {
        await sleep(rand(175, 255));
        await io.tapXY(cx + rand(-40, 40), cy + rand(-40, 40));
        tries += 1;
        await sleep(300);
        continue;
      }
      // 가끔(4번에 1번) 초록이 되기 전에 눌러 버리기
      const waiting = await io.page.evaluate(() => document.getElementById("arena").classList.contains("mode-wait")).catch(() => false);
      if (waiting && tries % 4 === 3 && Math.random() < 0.02) {
        await io.tapXY(cx, cy);
        io.mark("fail", "너무 빨리 누름", 1.5);
        tries += 1;
        await sleep(300);
        continue;
      }
      await sleep(8);
    }
  },
};
