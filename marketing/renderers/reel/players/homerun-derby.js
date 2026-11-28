"use strict";
/* tools/game-reels/adapters/homerun-derby.js 에서 가져옴 (2026-11-28) */
/*
 * 홈런왕: 공이 홈에 올 때 탭. 판정은 스윙 시작 0.075초 뒤의 투구 진행도(pitchT)가 0.74 에 가까울수록 홈런.
 * 대부분 홈런을 노리고, 가끔 일부러 빠르거나 늦게 쳐서 파울·안타가 섞이게 한다.
 */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

const SWEET = 0.74;
const SWING_DELAY = 0.075;

module.exports = {
  id: "homerun-derby",
  level: "easy",
  strategy: "A",
  genre: "sports",
  hashtags: ["#야구게임"],
  instrument: {
    script: /\/games\/homerun-derby\/game\.js/,
    expose: "() => ({ phase, pitchT, pitchDur, score, outcome, pitchIdx })",
  },
  hooks: ["10구 안에 홈런 몇 개?", "이거 홈런 칠 수 있어?", "타이밍만 맞추면 홈런", "홈런 타이밍 테스트"],
  captions: { homerun: ["홈런!", "넘어갔다!", "장외 홈런"], hit: ["안타!", "좋은 타격"], miss: ["헛스윙…", "아깝다"] },
  thumbText: ["홈런 몇 개?", "넘어갔다!"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    while (io.running()) {
      const s = await io.peek();
      if (!s) break;
      if (s.phase === "result") {
        await sleep(rand(500, 800));
        if (await io.visible("#next-btn")) await io.click("#next-btn");
        continue;
      }
      if (s.phase === "over") {
        io.mark("end", "경기 종료", 1);
        await sleep(1600);
        if (await io.visible("#retry-btn")) await io.click("#retry-btn");
        await sleep(500);
        continue;
      }
      if (s.phase !== "pitch") {
        await sleep(40);
        continue;
      }
      // 이번 공의 목표: 70% 홈런, 나머지는 살짝 이르거나 늦게
      const r = Math.random();
      const aimAt = r < 0.7 ? SWEET : r < 0.85 ? SWEET - rand(0.11, 0.16) : SWEET + rand(0.1, 0.18);
      let swung = false;
      const hitPoint = await io.at(250, 480, { W: 390, H: 700 }); // 스윙 직전에 위치 계산을 하지 않도록 미리
      while (io.running()) {
        const p = await io.peek();
        if (!p || p.phase !== "pitch") break;
        const target = aimAt - SWING_DELAY / (p.pitchDur || 0.94) - 0.02; // 입력 지연 보정
        if (!swung && p.pitchT >= target) {
          await io.tapXY(hitPoint.x, hitPoint.y, 20);
          swung = true;
        }
        await sleep(swung ? 30 : 4);
      }
      const done = await io.peek();
      const kind = done && done.outcome;
      if (kind === "homerun") io.mark("homerun", "홈런", 4);
      else if (["triple", "double", "single"].includes(kind)) io.mark("hit", kind, 2);
      else if (kind) io.mark("miss", kind, 0.8);
      await sleep(200);
    }
  },
};
