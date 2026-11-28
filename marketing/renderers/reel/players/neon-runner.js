"use strict";
/* tools/game-reels/adapters/neon-runner.js 에서 가져옴 (2026-11-28) */
/* 네온 러너: 분홍 상자(low)는 점프, 노란 가로막(high)은 슬라이드. 가끔 늦게 반응해서 부딪히는 장면도. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

module.exports = {
  id: "neon-runner",
  level: "easy",
  strategy: "E",
  genre: "rhythm",
  instrument: {
    script: /\/games\/neon-runner\/game\.js/,
    expose:
      "() => ({ state, W, speed, hearts, jumping: player.jumping, sliding: player.sliding, obs: obstacles.map((o) => ({ id: o.__reelId || (o.__reelId = (window.__reelN = (window.__reelN || 0) + 1)), type: o.type, x: o.x, hit: o.hit })) })",
  },
  hooks: ["비트 타고 달려!", "이 박자 따라올 수 있어?", "점프? 슬라이드?"],
  captions: { score: ["나이스!", "가볍게 통과"], combo: ["연속 통과!", "리듬 탔다"], fail: ["쾅!", "아깝다"] },
  thumbText: ["박자 맞춰 점프!", "몇 m 갈까?"],

  async start(io) {
    const ok = await clickStart(io, { titleId: "title" });
    await sleep(3200); // 3·2·1 카운트다운
    return ok;
  },

  async play(io) {
    const acted = new Set();
    const passed = new Set();
    let hearts = null;
    let streak = 0;
    let n = 0;
    while (io.running()) {
      const s = await io.peek();
      if (!s) break;
      if (s.state === "over" || (await io.overlayOpen("over"))) {
        io.mark("fail", "게임 오버", 1.5);
        await sleep(1500);
        if (await io.visible("#retry-btn")) await io.click("#retry-btn");
        else if (await io.visible("#start-btn")) await io.click("#start-btn");
        await sleep(3300);
        hearts = null;
        continue;
      }
      if (hearts !== null && s.hearts < hearts) {
        io.mark("fail", "충돌", 1.6);
        streak = 0;
      }
      hearts = s.hearts;
      const px = s.W * 0.24;
      for (const o of s.obs) {
        const eta = (o.x - px) / s.speed; // 몇 초 뒤에 닿는지
        if (eta < -0.12) {
          if (!o.hit && !passed.has(o.id)) {
            passed.add(o.id);
            streak += 1;
            io.mark(streak % 4 === 0 ? "combo" : "score", `통과 ${streak}`, streak % 4 === 0 ? 2.2 : 0.9);
          }
          continue;
        }
        if (acted.has(o.id)) continue;
        const late = (n + 1) % 9 === 0; // 가끔 반응이 늦는다 (위기 장면)
        const lead = (o.type === "low" ? 0.2 : 0.11) + (late ? -0.13 : rand(-0.02, 0.02));
        if (eta <= lead) {
          acted.add(o.id);
          n += 1;
          if (o.type === "low") await io.key("Space", 30);
          else await io.key("ArrowDown", 30);
        }
      }
      await sleep(10);
    }
  },
};
