"use strict";
/* 타자 소나기: 화면에 떠 있는 단어(?test=1 의 읽기 전용 목록)를 보고, 가장 아래 단어부터 사람 속도로 실제 키 입력 + 스페이스. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

module.exports = {
  id: "typing-rain",
  level: "easy",
  strategy: "E",
  genre: "edu",
  needsCanvas: true,
  hooks: ["단어가 땅에 닿기 전에!", "한컴타자 기억나요?", "몇 타까지 버틸 수 있어?"],
  captions: { score: ["막았다!", "손이 빠르다"], fail: ["놓쳤다!", "앗, 떨어졌다"] },
  thumbText: ["몇 타 나와?", "타자 소나기"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    let level = 1;
    let lives = null;
    // 영상에서 단어가 비처럼 떨어지는 게 보이게: 단어가 판 높이의 절반쯤 내려왔거나 여러 개 쌓였을 때 친다
    const field = await io.box("#game");
    const fieldH = field ? field.height : 500;
    while (io.running()) {
      const st = await io.page.evaluate(() => window.__trTest && { s: window.__trTest.state(), w: window.__trTest.words() }).catch(() => null);
      if (!st) {
        await sleep(60);
        continue;
      }
      if (!st.s.running) {
        if (await io.visible("#again-btn")) {
          await sleep(rand(1200, 1800));
          await io.click("#again-btn");
        } else await sleep(100);
        continue;
      }
      if (st.s.level > level) io.mark("score", `${st.s.level}단계`, 3);
      if (lives !== null && st.s.lives < lives) io.mark("fail", "단어를 놓침", 1.5);
      level = st.s.level;
      lives = st.s.lives;
      const target = st.w.slice().sort((a, b) => b.y - a.y)[0];
      if (!target || (target.y < fieldH * rand(0.4, 0.55) && st.w.length < 4)) {
        await sleep(80);
        continue;
      }
      await io.page.focus("#type-input").catch(() => {});
      await io.keyboard.type(target.text, { delay: rand(170, 260) });
      await sleep(rand(60, 140));
      await io.keyboard.press("Space");
      io.mark("score", target.text, 1);
      await sleep(rand(150, 350));
    }
  },
};
