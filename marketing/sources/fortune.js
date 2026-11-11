"use strict";
/*
 * Source "fortune" (C3 오늘의 운세 카드): games/fortune-draw/game.js 의 실제 문구와 사이트의 날짜 계산 함수 그대로.
 * 사이트는 `서울날짜_분류` 를 씨앗으로 고르므로 그날은 누구에게나 같은 결과 — 사이트에서 뽑은 것과 똑같다. AI 가 지어내지 않는다.
 */
const { literal, fn, kstDay } = require("./site-data");

const FILE = "games/fortune-draw/game.js";

function todays(day) {
  const CATS = literal(FILE, "CATS");
  const seedFromString = fn(FILE, "seedFromString");
  const mulberry32 = fn(FILE, "mulberry32");
  const out = {};
  for (const [key, cat] of Object.entries(CATS)) {
    const rand = mulberry32(seedFromString(`${day}_${key}`));
    const item = cat.pool[Math.floor(rand() * cat.pool.length)];
    out[key] = { title: cat.title, emoji: cat.emoji, t: item.t, d: item.d };
  }
  return out;
}

module.exports = {
  todays,
  async collect({ now = () => Date.now() }) {
    const day = kstDay(typeof now === "function" ? now() : now);
    const items = todays(day);
    return { sourceType: "fortune", sourceId: `fortune-${day}`, facts: { title: "오늘의 운세", day, url: "/games/fortune-draw/", items }, assets: {} };
  },
};
