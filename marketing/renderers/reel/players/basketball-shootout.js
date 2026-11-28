"use strict";
/* tools/game-reels/adapters/basketball-shootout.js 에서 가져옴 (2026-11-28) */
/* 농구 슛아웃: 공을 뒤로 당겼다 놓는 드래그 슛. 들어가는 각도·힘을 찾아 기억하고, 약간씩 흔들어 성공/실패가 섞이게 한다. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

const W = 390;
const H = 700;
const START = { x: 96, y: 478 };
// 원래 도구는 파일에 저장했음 → 여기서는 한 판 동안만 기억 (처음 값은 2026-09-25 저장값)
let calib = { angle: -1.3506, power: 140.78 };
const loadCalibration = () => calib;
const saveCalibration = (_id, shot) => void (calib = shot);

function dragPoint(angle, power) {
  // 게임은 (START - 드래그 위치)의 방향·길이로 공을 던진다
  return { x: START.x - Math.cos(angle) * power, y: START.y - Math.sin(angle) * power };
}

module.exports = {
  id: "basketball-shootout",
  level: "easy",
  strategy: "B",
  genre: "sports",
  instrument: {
    script: /\/games\/basketball-shootout\/game\.js/,
    expose: "() => ({ running, score, made, attempts, flying: ball.flying, timeLeft })",
  },
  hooks: ["10초 동안 몇 골?", "이거 다 넣을 수 있어?", "농구 슛 감 테스트", "몇 골 연속 가능?"],
  captions: { score: ["골!", "들어갔다!", "연속 골!", "깔끔하게 쏙"], miss: ["아깝다", "한 번 더!"] },
  thumbText: ["몇 골 넣을까?", "연속 골 도전"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    const opts = { W, H };
    let best = loadCalibration(this.id); // { angle, power }
    // 게임 물리(중력 1280, VX_K 5.15, VY_K 7.35)로 계산한 높은 포물선 슛 주변부터 찾는다
    const grid = [];
    for (const a of [-1.32, -1.3, -1.34, -1.28, -1.36]) for (const p of [134, 132, 136, 130, 138]) grid.push({ angle: a, power: p });
    let gi = 0;

    while (io.running()) {
      const s = await io.peek();
      if (!s) break;
      if (!s.running) {
        // 60초가 끝났으면 다시 시작 (결과 화면도 영상 소재)
        io.mark("end", "경기 종료", 1.5);
        await sleep(1500);
        if (await io.visible("#retry-btn")) await io.click("#retry-btn");
        await sleep(600);
        continue;
      }
      if (s.flying) {
        await sleep(80);
        continue;
      }
      // 5번 중 1번쯤은 살짝 빗나가게 (아슬아슬한 장면)
      const wobble = Math.random() < 0.2 ? rand(0.07, 0.11) * (Math.random() < 0.5 ? -1 : 1) : rand(-0.03, 0.03);
      const shot = best ? { angle: best.angle + wobble, power: best.power + rand(-4, 4) } : grid[gi++ % grid.length];
      const before = s.score;
      await io.drag(START, dragPoint(shot.angle, shot.power), { ...opts, durationMs: rand(260, 380) });
      // 공이 날아가서 결과가 날 때까지
      const t0 = Date.now();
      let after = before;
      await sleep(300);
      let marked = false;
      while (Date.now() - t0 < 3500) {
        const n = await io.peek();
        if (n && n.score > before && !marked) {
          // 골이 들어가는 바로 그 순간을 기록 (자막 타이밍)
          marked = true;
          io.mark("score", `+${n.score - before}`, 2 + (n.score - before) / 2);
        }
        if (!n || !n.flying) {
          after = n ? n.score : after;
          break;
        }
        after = n.score;
        await sleep(40);
      }
      if (after > before) {
        if (!best) {
          best = shot;
          saveCalibration(this.id, shot);
        }
      } else {
        io.mark("miss", "노골", 0.6);
      }
      await sleep(rand(150, 350));
    }
  },
};
