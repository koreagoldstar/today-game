"use strict";
/* 삐약이 건너기: 앞이 안전할 때 뛰고, 위험하면 비키거나 물러남 (scripts/test-chick-games.js 봇, 판단 0.08~0.18초) */
const { makePlayer } = require("./chick-common");

function bot() {
  const C = window.CrossyChick;
  if (!C || window.__crBot) return;
  const after = (lane, e, t) => e.x + lane.v * t;
  const roadSafe = (lane, x, t0, t1) => {
    for (const e of lane.ents) {
      for (let t = t0; t <= t1; t += 0.05) {
        const ex = after(lane, e, t);
        if (x + 0.8 + 0.12 > ex && x + 0.2 - 0.12 < ex + e.w) return false;
      }
    }
    return true;
  };
  const landSafe = (z, x) => {
    const lane = C.laneAt(z);
    if (lane.type === "grass") return !C.treeAt(lane, x);
    if (lane.type === "road") return roadSafe(lane, Math.round(x), 0, C.HOP + 0.2);
    if (lane.type === "rail") return !lane.train && !lane.warn && lane.timer > 1.4;
    if (lane.type === "river") {
      for (const e of lane.ents) {
        const ex = after(lane, e, C.HOP);
        if (x + 0.72 > ex && x + 0.28 < ex + e.w) {
          const rest = x - ex;
          return rest >= -0.1 && rest <= e.w - 0.9 + 0.1;
        }
      }
      return false;
    }
    return false;
  };
  const inDanger = (z, x) => {
    const lane = C.laneAt(z);
    if (lane.type === "road") return !roadSafe(lane, x, 0, 0.32);
    if (lane.type === "rail") return lane.warn || Boolean(lane.train);
    if (lane.type === "river") return (lane.v < 0 && x < 1.4) || (lane.v > 0 && x > C.COLS - 2.4);
    return false;
  };
  let nextAt = 0;
  window.__crBot = setInterval(() => {
    const s = C.s;
    if (s.state === "finish" && C.finishNow) return C.finishNow();
    if (s.state !== "play" || s.hop) return;
    const now = performance.now();
    if (now < nextAt) return;
    nextAt = now + 80 + Math.random() * 100;
    const x = s.x;
    const z = s.z;
    const danger = inDanger(z, x);
    const forwardX = C.laneAt(z + 1).type === "river" ? x : Math.round(x);
    if (forwardX >= 0 && forwardX <= C.COLS - 1 && landSafe(z + 1, forwardX)) return C.tryMove(0, 1);
    const lane = C.laneAt(z);
    const next = C.laneAt(z + 1);
    const opts = [];
    const staticBlock = (c) => (next.type === "grass" && next.trees.includes(c)) || (next.lily && !next.ents.some((e) => e.x === c));
    if (lane.type !== "river" && staticBlock(Math.round(x))) {
      const here = lane.type === "grass" ? lane.trees : [];
      let target = null;
      for (const dir of [-1, 1]) {
        for (let c = Math.round(x) + dir; c >= 0 && c < C.COLS; c += dir) {
          if (here.includes(c)) break;
          if (!staticBlock(c) && (target == null || Math.abs(c - x) < Math.abs(target - x))) target = c;
        }
      }
      if (target != null) opts.push(target > x ? 1 : -1);
      else if (z > 0 && landSafe(z - 1, Math.round(x))) return C.tryMove(0, -1);
    }
    if (danger && z > 0 && lane.type !== "river" && C.laneAt(z - 1).type === "grass" && landSafe(z - 1, Math.round(x))) return C.tryMove(0, -1);
    if (danger) opts.push(x < C.COLS / 2 ? 1 : -1, x < C.COLS / 2 ? -1 : 1);
    for (const dx of opts) {
      const nx = lane.type === "river" ? x + dx : Math.round(x) + dx;
      if (nx < 0 || nx > C.COLS - 1) continue;
      if (landSafe(z, nx)) return C.tryMove(dx, 0);
    }
    if (danger && z > 0) {
      const backX = C.laneAt(z - 1).type === "river" ? x : Math.round(x);
      if (backX >= 0 && backX <= C.COLS - 1 && landSafe(z - 1, backX)) C.tryMove(0, -1);
    }
  }, 16);
}

module.exports = makePlayer({
  id: "crossy",
  global: "CrossyChick",
  bot,
  hooks: ["이 길 건널 수 있을까?", "기차 온다! 지금이야?", "통나무 타고 강 건너기"],
  captions: { score: ["한 칸 더!", "휴, 살았다", "건넜다!"], fail: ["앗, 치였다!", "풍덩!"], clear: ["도착!"] },
  thumbText: ["건널 수 있어?", "삐약이 건너기"],
  genre: "action",
});
