"use strict";
/* tools/game-reels/adapters/zombie-run.js 에서 가져옴 (2026-11-28) */
/* 좀비런: 손가락을 누른 채 가장 가까운 좀비 밑으로 이동하며 연사. 가끔 미사일로 큰 폭발 장면. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

module.exports = {
  id: "zombie-run",
  level: "medium",
  strategy: "B",
  genre: "action",
  hashtags: ["#좀비게임"],
  instrument: {
    script: /\/games\/zombie-run\/game\.js/,
    expose:
      "() => ({ state, score, stage, W, H, hp: player.hp, px: player.x, py: player.y, zs: zombies.map((z) => ({ x: z.x, y: z.y })), boss: typeof boss !== 'undefined' && boss ? { x: boss.x, y: boss.y } : null })",
  },
  hooks: ["여기서 피할 수 있으면 인정", "좀비 몇 마리 잡을까?", "끝까지 살아남기"],
  captions: { score: ["처치!", "한 방에!"], combo: ["싹쓸이!", "쓸어버렸다"], clear: ["스테이지 클리어!"], fail: ["위험해!", "으악!"] },
  thumbText: ["살아남을까?", "좀비 싹쓸이"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    let s = await io.peek();
    if (!s) return;
    let pressed = false;
    let lastScore = s.score;
    let lastHp = s.hp;
    let lastKillAt = 0;
    let lastFire = 0;
    let lastMissile = Date.now();
    const release = async () => {
      if (pressed) await io.mouse.up().catch(() => {});
      pressed = false;
    };
    while (io.running()) {
      s = await io.peek();
      if (!s) break;
      if (s.state !== "playing") {
        await release();
        await sleep(900);
        for (const [b, ev] of [["#shop-close-btn", null], ["#next-btn", "clear"], ["#retry-btn", "fail"]]) {
          if (await io.visible(b)) {
            if (ev) io.mark(ev, b, ev === "clear" ? 3 : 1.5);
            await io.click(b);
            break;
          }
        }
        await sleep(500);
        continue;
      }
      if (s.score > lastScore) {
        const now = Date.now();
        const quick = now - lastKillAt < 900;
        io.mark(quick ? "combo" : "score", `+${s.score - lastScore}`, quick ? 2.2 : 1.2);
        lastKillAt = now;
        lastScore = s.score;
      }
      if (s.hp < lastHp - 5) io.mark("fail", "피격", 1);
      lastHp = s.hp;

      // 목표: 가장 아래쪽(가까운) 좀비의 x, 없으면 보스, 없으면 가운데
      const near = s.zs.filter((z) => z.y < s.py - 20).sort((a, b) => b.y - a.y)[0];
      const tx = near ? near.x : s.boss ? s.boss.x : s.W / 2 + Math.sin(Date.now() / 700) * 60;
      const x = Math.max(30, Math.min(s.W - 30, s.px + (tx - s.px) * 0.6));
      const p = await io.at(x, s.py + 30, { W: s.W, H: s.H });
      if (!pressed) {
        await io.mouse.move(p.x, p.y);
        await io.mouse.down();
        pressed = true;
      } else {
        await io.mouse.move(p.x, p.y, { steps: 2 });
      }
      const now = Date.now();
      if (now - lastFire > 110) {
        await io.key(" ", 15);
        lastFire = now;
      }
      if (now - lastMissile > 7000 && s.zs.length >= 4) {
        await io.key("m", 20);
        io.mark("combo", "미사일", 1.5);
        lastMissile = now;
      }
      await sleep(25);
    }
    await release();
  },
};
