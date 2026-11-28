"use strict";
/* 별똥별 벽돌깨기: 내려오는 공(window.BrickGame.S 읽기) 아래로 실제 마우스를 옮겨 받아친다. 조금씩 빗나가 가끔 놓친다. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

const W = 390;

module.exports = {
  id: "brick",
  level: "easy",
  strategy: "E",
  genre: "action",
  hooks: ["벽돌 다 깰 수 있을까?", "공 하나로 몇 개까지?", "마지막 한 개가 안 깨진다"],
  captions: { score: ["와장창!", "한 번에 여러 개!", "깨졌다!"], fail: ["공을 놓쳤다!", "앗, 떨어졌다"], clear: ["스테이지 클리어!"] },
  thumbText: ["다 깨 보자", "벽돌깨기"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    const box = await io.box("canvas");
    const toX = (x) => box.x + (x / W) * box.width;
    const y = box.y + box.height * 0.8;
    let score = 0;
    let lives = null;
    let miss = rand(-18, 18);
    while (io.running()) {
      for (const b of ["#next-btn", "#retry-btn", "#again-btn"]) {
        if (await io.visible(b)) {
          io.mark(b === "#next-btn" ? "clear" : "fail", b === "#next-btn" ? "스테이지 클리어!" : "게임 끝", b === "#next-btn" ? 4 : 2);
          await sleep(rand(1000, 1500));
          await io.click(b);
        }
      }
      const s = await io.page.evaluate(() => {
        const S = window.BrickGame.S;
        return { screen: S.screen, score: S.score, lives: S.lives, px: S.paddle.x, balls: S.balls.map((b) => ({ x: b.x, y: b.y, vy: b.vy, stuck: !!b.stuck })) };
      }).catch(() => null);
      if (!s || s.screen !== "play") {
        await sleep(100);
        continue;
      }
      if (s.score > score) io.mark("score", `+${s.score - score}`, Math.min(3, 1 + (s.score - score) / 200));
      if (lives !== null && s.lives < lives) io.mark("fail", "공을 놓쳤다", 1.8);
      score = s.score;
      lives = s.lives;
      if (s.balls.some((b) => b.stuck)) {
        await io.mouse.move(toX(s.px + rand(-30, 30)), y);
        await sleep(rand(300, 700));
        await io.mouse.down();
        await sleep(60);
        await io.mouse.up();
        continue;
      }
      const ball = s.balls.filter((b) => b.vy > 0).sort((a, b) => b.y - a.y)[0] || s.balls[0];
      if (!ball) {
        await sleep(40);
        continue;
      }
      if (Math.random() < 0.02) miss = rand(-22, 22);
      await io.mouse.move(toX(Math.max(20, Math.min(W - 20, ball.x + miss))), y, { steps: 3 });
      await sleep(16);
    }
  },
};
