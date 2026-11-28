"use strict";
/* 두더지 팡팡: 올라온 두더지(window.WhackMole.holes 읽기)를 사람 반응 속도로 망치질. 폭탄 · 토끼는 피하고, 가끔 늦어 놓친다. */
const { sleep, rand } = require("../io");

const AVOID = ["bomb", "bunny"];

module.exports = {
  id: "whack-mole",
  level: "easy",
  strategy: "E",
  genre: "arcade",
  hooks: ["몇 마리 잡을 수 있어?", "폭탄은 치면 안 돼요!", "손이 눈보다 빨라야 한다"],
  captions: { score: ["팡!", "잡았다!", "연속 팡팡!"], fail: ["놓쳤다!", "폭탄 조심!"], clear: ["스테이지 클리어!"] },
  thumbText: ["몇 마리?", "두더지 팡팡"],

  async start(io) {
    await io.page.waitForSelector("#start-btn", { state: "visible", timeout: 8000 });
    await sleep(700);
    await io.click("#start-btn");
    await sleep(800);
    if (await io.visible("#new-ok")) await io.click("#new-ok");
    const ok = await io.page.evaluate(() => window.WhackMole && window.WhackMole.s.screen === "play").catch(() => false);
    if (ok) io.mark("start", "게임 시작", 0);
    return ok;
  },

  async play(io) {
    let score = 0;
    let hearts = null;
    const seen = new Set();
    while (io.running()) {
      for (const b of ["#new-ok", "#next-btn", "#retry-btn"]) {
        if (await io.visible(b)) {
          if (b === "#next-btn") io.mark("clear", "스테이지 클리어!", 4);
          if (b === "#retry-btn") io.mark("fail", "실패", 2);
          await sleep(rand(900, 1400));
          await io.click(b);
        }
      }
      const s = await io.page.evaluate(() => {
        const W = window.WhackMole;
        const st = W.s;
        return { screen: st.screen, score: st.score, hearts: st.hearts, combo: st.combo, holes: W.holes().map((h, i) => ({ i, type: h.mole && h.mole.type, up: h.mole ? h.mole.up : 0, state: h.mole && h.mole.state, id: h.mole ? h.mole.wob : 0 })) };
      }).catch(() => null);
      if (!s || s.screen !== "play") {
        await sleep(120);
        continue;
      }
      if (s.score > score) io.mark("score", `+${s.score - score}`, s.combo >= 5 ? 2.5 : 1.2);
      if (hearts !== null && s.hearts < hearts) io.mark("fail", "놓쳤다", 1.5);
      score = s.score;
      hearts = s.hearts;
      const target = s.holes.find((h) => h.type && !AVOID.includes(h.type) && h.up >= 0.45 && h.state !== "hit" && h.state !== "gone" && !seen.has(h.id));
      if (!target) {
        await sleep(30);
        continue;
      }
      seen.add(target.id);
      if (seen.size > 40) seen.clear();
      await sleep(rand(160, 320)); // 사람 반응 속도 — 가끔 늦어 놓친다
      await io.page.evaluate((i) => window.WhackMole.tapHole(window.WhackMole.holes()[i]), target.i).catch(() => {});
    }
  },
};
