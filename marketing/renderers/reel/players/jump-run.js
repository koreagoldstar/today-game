"use strict";
/* 콩콩 점프: scripts/test-four-games.js 의 점프 봇(발판 끝 · 가시를 보고 누르는 길이를 정함)을 페이지 안에서 실제 시간으로 돌린다.
   누르기 · 떼기는 게임의 입력 함수(J.down / J.up — 화면을 누를 때와 같은 함수). 사람 수준 오차(jit 0.05 · 실수 4%)라 가끔 떨어진다. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

function installBot() {
  const J = window.JumpRun;
  if (!J || window.__jrBot) return;
  const HOLDS = [0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.2, 0.24, 0.28, 0.32, 0.36];
  const flight = (hold, dy) => {
    let vy = J.JUMP_V;
    let y = 0;
    let t = 0;
    while (t < 2.5) {
      vy += J.GRAVITY / 120;
      if (t >= hold && vy < -220) vy += (-220 - vy) * (1 - Math.pow(0.0001, 1 / 120));
      y += vy / 120;
      t += 1 / 120;
      if (vy > 0 && y >= dy) return t;
    }
    return t;
  };
  const jit = 0.05;
  const err = 0.04;
  let upAt = 0;
  let dec = null;
  window.__jrBot = setInterval(() => {
    if (J.state !== "play") return;
    const now = performance.now();
    if (upAt && now >= upAt) {
      J.up();
      upAt = 0;
    }
    const pl = J.player;
    if (upAt || !pl.onGround || !pl.plat) return;
    const speed = J.difficulty().speed;
    const meX = J.camX + J.PLAYER_X;
    const plat = pl.plat;
    const next = J.platforms.filter((q) => !q.falling && q.x > plat.x + plat.w - 1)[0] || { x: plat.x + plat.w + 500, y: plat.y, w: 200, kind: "normal" };
    const edge = plat.x + plat.w - (meX + 3);
    const spike = J.spikes.find((s) => s.x > meX + 20 && s.x < plat.x + plat.w && Math.abs(s.y - plat.y) < 4);
    const dS = spike ? spike.x - (meX + 30) : 1e9;
    if (!dec || dec.plat !== plat || dec.spike !== (spike || null)) dec = { plat, spike: spike || null, off: (Math.random() * 2 - 1) * jit, miss: Math.random() < err };
    const mustEdge = edge < speed * Math.max(0.015, 0.07 + dec.off);
    const mustSpike = dS < speed * (0.11 + dec.off * 0.8) && dS > -30;
    if (dec.miss && !mustSpike) return;
    if (!mustEdge && !mustSpike) return;
    let best = 0.36;
    if (mustSpike && !mustEdge) {
      const room = plat.x + plat.w - meX;
      for (const h of HOLDS) {
        const land = speed * flight(h, 0);
        if (land > dS + 58 && land < room - 6) {
          best = h;
          break;
        }
      }
    } else {
      const dy = next.y - plat.y;
      const near = next.x + 8 - meX;
      const far = next.x + next.w - 8 - meX;
      const mid = next.x + Math.min(next.w * 0.42, 90) - meX;
      let bv = 1e9;
      for (const h of HOLDS) {
        const land = speed * flight(h, dy);
        const v = land < near || land > far ? 1e6 + Math.abs(land - mid) : Math.abs(land - mid);
        if (v < bv) {
          bv = v;
          best = h;
        }
      }
      if (next.kind === "move") best = Math.max(best, 0.2);
    }
    J.down();
    upAt = now + best * 1000;
  }, 8);
}

module.exports = {
  id: "jump-run",
  level: "medium",
  strategy: "E",
  genre: "action",
  hooks: ["떨어지기 전에 뛰어!", "몇 미터까지 갈 수 있어?", "길게 누르면 더 높이"],
  captions: { score: ["코인!", "착지 성공!", "훌쩍!"], fail: ["앗, 떨어졌다!", "가시에 찔렸다"], combo: ["단계 올라감!"] },
  thumbText: ["어디까지 갈까?", "콩콩 점프"],

  async start(io) {
    const ok = await clickStart(io, { titleId: "title" });
    await io.page.evaluate(installBot);
    return ok;
  },

  async play(io) {
    let coins = 0;
    let level = 1;
    let state = "play";
    while (io.running()) {
      const s = await io.page.evaluate(() => {
        const J = window.JumpRun;
        return { state: J.state, level: J.difficulty().level, coins: J.stats ? J.stats.coins : 0 };
      }).catch(() => null);
      if (!s) {
        await sleep(100);
        continue;
      }
      if (s.state === "play" && s.coins > coins) io.mark("score", "코인!", 1);
      if (s.state === "play" && s.level > level) io.mark("combo", `${s.level}단계`, 3);
      if (state === "play" && s.state !== "play" && s.state !== "paused") io.mark("fail", "떨어졌다", 2);
      if (s.state === "over") {
        await sleep(rand(1200, 1700));
        for (const b of ["#retry-btn", "#again-btn", "#start-btn"]) if (await io.visible(b)) {
          await io.click(b);
          break;
        }
        coins = 0;
        level = 1;
      } else {
        coins = s.coins;
        level = s.level;
      }
      state = s.state;
      await sleep(80);
    }
  },
};
