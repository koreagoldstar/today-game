"use strict";
/* tools/game-reels/adapters/puzzle-bubble.js 에서 가져옴 (2026-11-28) */
/* 팝샷 버블: 지금 쏠 색과 같은 색 중 가장 아래(막히지 않은) 방울을 조준해서 쏜다. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

const W = 390;
const H = 620;

module.exports = {
  id: "puzzle-bubble",
  level: "easy",
  strategy: "B",
  genre: "action",
  instrument: {
    script: /\/games\/puzzle-bubble\/game\.js/,
    expose:
      "() => ({ state, score, busy: !!shot || !!pendingResolve, cur: currentColor, cells: [...grid].map(([k, color]) => { const q = parseKey(k); const p = pos(q.r, q.c); return { x: p.x, y: p.y, color }; }) })",
  },
  hooks: ["한 번에 몇 개 터질까?", "같은 색 3개면 팡!", "이거 한 방에 가능?"],
  captions: { score: ["팡!", "터졌다!"], combo: ["왕창 터졌다!", "한 방에 싹"], clear: ["스테이지 클리어!"], fail: ["앗, 내려온다"] },
  thumbText: ["한 방에 팡!", "몇 개 터질까?"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    const opts = { W, H };
    let lastScore = 0;
    while (io.running()) {
      const s = await io.peek();
      if (!s) break;
      if (s.score > lastScore) {
        const d = s.score - lastScore;
        io.mark(d >= 80 ? "combo" : "score", `+${d}`, Math.min(4.5, 1 + d / 40));
        lastScore = s.score;
      }
      if (s.state !== "play") {
        await sleep(1100);
        for (const [b, ev] of [["#next-btn", "clear"], ["#again-btn", "clear"], ["#retry-btn", "fail"]]) {
          if (await io.visible(b)) {
            io.mark(ev, b, ev === "clear" ? 3.5 : 1.2);
            await io.click(b);
            break;
          }
        }
        lastScore = 0;
        await sleep(500);
        continue;
      }
      if (s.busy) {
        await sleep(40);
        continue;
      }
      const same = s.cells.filter((c) => c.color === s.cur).sort((a, b) => b.y - a.y);
      const target = same.length && Math.random() < 0.9 ? same[0] : s.cells.sort((a, b) => b.y - a.y)[Math.floor(rand(0, Math.min(5, s.cells.length)))];
      if (!target) {
        await sleep(100);
        continue;
      }
      const p = await io.at(target.x + rand(-4, 4), target.y + rand(-2, 4), opts);
      await io.mouse.move(p.x, p.y + 60, { steps: 4 });
      await io.mouse.down();
      await io.mouse.move(p.x, p.y, { steps: 6 });
      await sleep(rand(180, 320)); // 조준선이 보이도록
      await io.mouse.up();
      await sleep(250);
    }
  },
};
