"use strict";
/* tools/game-reels/adapters/slide-2048.js 에서 가져옴 (2026-11-28) */
/* 두배두배(2048): 한쪽 구석에 큰 수를 모으는 사람들이 많이 쓰는 방식 (아래·왼쪽 위주, 막히면 오른쪽, 그래도 막히면 위). */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

module.exports = {
  id: "slide-2048",
  level: "easy",
  strategy: "D",
  genre: "puzzle",
  needsCanvas: false,
  hooks: ["2048 만들 수 있어?", "숫자 합치기 챌린지", "머리 좀 쓰는 게임"],
  captions: { score: ["합쳤다!", "쭉쭉 커진다"], combo: ["한 번에 여러 개!", "큰 수 등장"] },
  thumbText: ["어디까지 합칠까?", "2048 가능?"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    const snapshot = () => io.page.evaluate(() => document.getElementById("tiles").innerText).catch(() => "");
    const maxTile = () =>
      io.page.evaluate(() => Math.max(0, ...[...document.querySelectorAll("#tiles *")].map((e) => Number(e.textContent) || 0))).catch(() => 0);
    let last = await io.num("#score");
    let top = await maxTile();
    const order = [["ArrowDown", "ArrowLeft"], ["ArrowRight"], ["ArrowUp"]];
    let flip = false;
    while (io.running()) {
      if (await io.overlayOpen("over")) {
        io.mark("fail", "더 이상 못 움직임", 1.5);
        await sleep(1500);
        await io.click("#retry-btn");
        last = 0;
        continue;
      }
      if (await io.overlayOpen("win")) {
        io.mark("clear", "2048!", 4);
        await io.click("#continue-btn");
        continue;
      }
      const before = await snapshot();
      let moved = false;
      for (const group of order) {
        const keys = group.length > 1 ? (flip ? [...group].reverse() : group) : group;
        for (const k of keys) {
          await io.key(k, 30);
          await sleep(rand(110, 170));
          if ((await snapshot()) !== before) {
            moved = true;
            break;
          }
        }
        if (moved) break;
      }
      flip = !flip;
      const sc = await io.num("#score");
      if (Number.isFinite(sc) && sc > last) {
        const d = sc - last;
        io.mark(d >= 32 ? "combo" : "score", `+${d}`, Math.min(4, 0.6 + d / 24));
        last = sc;
      }
      const mt = await maxTile();
      if (mt > top && mt >= 64) {
        io.mark("clear", `${mt} 달성`, 2 + Math.log2(mt) / 4);
        top = mt;
      }
      await sleep(rand(60, 140));
    }
  },
};
