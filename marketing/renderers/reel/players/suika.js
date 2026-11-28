"use strict";
/* tools/game-reels/adapters/suika.js 에서 가져옴 (2026-11-28) */
/* 수박 합치기: 다음 과일과 같은 종류가 보이는 위쪽 과일 바로 위에 떨어뜨려 합체를 만든다. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

const W = 390;
const H = 640;
const WALL_L = 24;
const WALL_R = W - 24;

module.exports = {
  id: "suika",
  level: "easy",
  strategy: "B",
  genre: "puzzle",
  instrument: {
    script: /\/games\/suika\/game\.js/,
    expose: "() => ({ state, score, nextType, dropTimer, fruits: fruits.map((f) => ({ x: f.x, y: f.y, r: f.radius, t: f.type })) })",
  },
  hooks: ["수박까지 갈 수 있을까?", "같은 과일끼리 합체!", "이거 은근 중독됩니다"],
  captions: { score: ["합체!", "쑥쑥 커진다", "연속 합체!"], combo: ["연쇄 합체!"] },
  thumbText: ["수박까지 가자", "합체!"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    const opts = { W, H };
    let lastScore = 0;
    let lastT = 0;
    while (io.running()) {
      const s = await io.peek();
      if (!s) break;
      if (s.score > lastScore) {
        const d = s.score - lastScore;
        const chain = Date.now() - lastT < 700;
        io.mark(chain ? "combo" : "score", `+${d}`, Math.min(4, 1 + d / 8) + (chain ? 1 : 0));
        lastScore = s.score;
        lastT = Date.now();
      }
      if (s.state !== "play") {
        if (await io.visible("#continue-btn")) {
          io.mark("clear", "수박!", 4);
          await io.click("#continue-btn");
        } else if (await io.visible("#retry-btn")) {
          io.mark("fail", "넘쳤다", 1.5);
          await sleep(1500);
          await io.click("#retry-btn");
          lastScore = 0;
        }
        await sleep(300);
        continue;
      }
      if (s.dropTimer > 0) {
        await sleep(60);
        continue;
      }
      // 같은 종류 중 가장 높이 올라와 있는(=위에서 닿기 쉬운) 과일 위
      const same = s.fruits.filter((f) => f.t === s.nextType).sort((a, b) => a.y - b.y);
      let x;
      if (same.length && Math.random() < 0.85) x = same[0].x + rand(-6, 6);
      else {
        // 없으면 과일이 적은 쪽으로 (한쪽에 쌓여 넘치지 않게)
        const left = s.fruits.filter((f) => f.x < W / 2).length;
        const right = s.fruits.length - left;
        x = left <= right ? rand(WALL_L + 30, W / 2) : rand(W / 2, WALL_R - 30);
      }
      x = Math.max(WALL_L + 20, Math.min(WALL_R - 20, x));
      const p = await io.at(x, 60, opts);
      await io.mouse.move(p.x, p.y, { steps: 5 });
      await sleep(rand(120, 260));
      await io.tapXY(p.x, p.y, 30);
      await sleep(rand(250, 450));
    }
  },
};
