"use strict";
/* 삐약이 3종 공통: 페이지 안에서 도는 봇을 심고, 화면 상태(s)를 보며 사건을 남기고, 결과 화면 버튼을 누른다.
   봇 판단은 scripts/test-chick-games.js 의 봇과 같고, 조작은 게임의 입력 함수(버튼 · 키를 누를 때 부르는 것과 같은 함수). */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

function makePlayer({ id, global, bot, hooks, captions, thumbText, genre = "sports", scoreKey = "score" }) {
  return {
    id,
    level: "medium",
    strategy: "E",
    genre,
    hooks,
    captions,
    thumbText,
    async start(io) {
      const ok = await clickStart(io, { titleId: "title" });
      await io.page.evaluate(bot);
      return ok;
    },
    async play(io) {
      let score = 0;
      let hearts = null;
      let state = "play";
      while (io.running()) {
        const s = await io.page.evaluate((g) => window[g] && window[g].s, global).catch(() => null);
        if (!s) {
          await sleep(100);
          continue;
        }
        if (s.state === "play") {
          if (s[scoreKey] >= score + 50) {
            io.mark("score", `+${Math.round(s[scoreKey] - score)}`, 1); // 점수가 계속 오르는 게임이라 50점마다 한 번만
            score = s[scoreKey];
          } else if (s[scoreKey] < score) score = s[scoreKey];
          if (hearts !== null && s.hearts < hearts) io.mark("fail", "쾅!", 2);
          hearts = s.hearts;
        }
        if (state === "play" && s.state !== "play") {
          if (s.state === "clear" || s.state === "all") io.mark("clear", "스테이지 클리어!", 4);
          else if (s.state === "over") io.mark("fail", "게임 끝", 2);
        }
        state = s.state;
        if (s.state === "clear" || s.state === "over" || s.state === "all") {
          await sleep(rand(1300, 1800));
          for (const b of ["#next-btn", "#retry-btn", "#restart-btn", "#start-btn"]) {
            if (await io.visible(b)) {
              await io.click(b);
              break;
            }
          }
          score = 0;
          hearts = null;
          await sleep(500);
          await io.page.evaluate(bot);
        }
        await sleep(90);
      }
    },
  };
}

module.exports = { makePlayer };
