"use strict";
/* 드리프트 삐약이: 커브를 0.25초 늦게 보고 그쪽으로 누름 (scripts/test-chick-games.js 봇) */
const { makePlayer } = require("./chick-common");

function bot() {
  const D = window.DriftChick;
  if (!D || window.__dcBot) return;
  const hist = [];
  window.__dcBot = setInterval(() => {
    const s = D.s;
    if (s.state !== "play") return;
    hist.push(s.curve);
    if (hist.length > 60) hist.shift();
    const c = hist[Math.max(0, hist.length - 1 - 15)]; // 60fps 기준 0.25초 전
    if (Math.abs(c) > 0.0065) D.input(true, Math.sign(c));
    else D.input(false, 0);
  }, 1000 / 60);
}

module.exports = makePlayer({
  id: "drift-chick",
  global: "DriftChick",
  bot,
  hooks: ["커브에서 미끄러져라!", "드리프트 몇 콤보?", "이 각도 실화?"],
  captions: { score: ["드리프트!", "콤보!", "깔끔하게"], fail: ["벽에 쿵!", "미끄러졌다"] },
  thumbText: ["드리프트!", "드리프트 삐약이"],
});
