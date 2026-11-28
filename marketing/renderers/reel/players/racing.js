"use strict";
/* 스피드 삐약이: 0.12초마다 앞에 차 없는 차선으로 한 칸씩 (scripts/test-chick-games.js 봇) */
const { makePlayer } = require("./chick-common");

function bot() {
  const G = window.SpeedChick;
  if (!G || window.__rcBot) return;
  window.__rcBot = setInterval(() => {
    const s = G.s;
    if (s.state !== "play") return;
    const danger = (lane) => {
      let d = 0;
      for (const e of s.enemies) {
        if (e.hit) continue;
        const cx = 58 + (274 / 3) * (lane + 0.5);
        const inLane = Math.abs(e.x - cx) < 66 || (e.changer >= 1 && e.to === lane);
        if (!inLane) continue;
        if (e.y > s.y - 240 && e.y < s.y + 76) d = Math.max(d, 1 + (e.y - (s.y - 240)) / 300);
      }
      return d;
    };
    const cur = s.target;
    const scores = [0, 1, 2].map((l) => danger(l) * 10 + Math.abs(l - cur) * 0.4);
    let best = cur;
    for (const l of [0, 1, 2]) if (scores[l] < scores[best] - 0.2) best = l;
    if (best !== cur && Math.random() > 0.06) G.moveLane(best > cur ? 1 : -1); // 가끔 한 박자 늦음
  }, 120);
}

module.exports = makePlayer({
  id: "racing",
  global: "SpeedChick",
  bot,
  hooks: ["차 사이로 쏙쏙!", "몇 대나 피할 수 있어?", "속도가 점점 빨라진다"],
  captions: { score: ["코인!", "아슬아슬!", "부스터!"], fail: ["쾅!", "부딪혔다"], clear: ["골인!"] },
  thumbText: ["피할 수 있어?", "스피드 삐약이"],
});
