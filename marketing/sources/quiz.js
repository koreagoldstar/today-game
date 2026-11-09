"use strict";
/*
 * Source "quiz" (C2 상식퀴즈 캐러셀): games/wisdom-quiz/questions.js 의 실제 문항 · 정답 그대로.
 * 같은 문제는 90일 안에 다시 쓰지 않는다 (todaygame:mkt:seen:quiz). AI 가 정답을 만들거나 고치지 않는다.
 */
const vm = require("vm");
const crypto = require("crypto");
const { read } = require("./site-data");

const KEEP_DAYS = 90;

function bank() {
  const ctx = { window: {} };
  vm.runInNewContext(read("games/wisdom-quiz/questions.js"), ctx, { timeout: 2000 });
  const list = ctx.window.WISDOM_QUIZ_BANK;
  if (!Array.isArray(list) || !list.length) throw new Error("퀴즈 문항을 읽지 못했습니다.");
  return list.filter((x) => x && x.q && Array.isArray(x.a) && x.a.length >= 2 && Number.isInteger(x.c) && x.a[x.c] !== undefined);
}

const qid = (x) => crypto.createHash("sha1").update(x.q).digest("hex").slice(0, 12);

module.exports = {
  bank,
  qid,
  async collect({ store, now = () => Date.now(), plan }) {
    const t = typeof now === "function" ? now() : now;
    const count = (plan && plan.count) || 4;
    const all = bank();
    const recent = new Set(store ? await store.run("ZRANGEBYSCORE", "seen:quiz", t - KEEP_DAYS * 86400000, "+inf") : []);
    const fresh = all.filter((x) => !recent.has(qid(x)));
    if (fresh.length < count) throw new Error(`90일 안에 안 쓴 문제가 ${fresh.length}개뿐입니다.`);
    // 날짜로 정해지는 순서 (같은 날 다시 만들어도 같은 문제) — 무작위가 아니라 재현 가능하게
    const seed = parseInt(crypto.createHash("sha1").update(String(new Date(t).toISOString().slice(0, 10))).digest("hex").slice(0, 8), 16);
    const picked = [];
    for (let i = 0; picked.length < count; i++) {
      const x = fresh[(seed + i * 7919) % fresh.length];
      if (!picked.includes(x)) picked.push(x);
    }
    if (store) await store.batch([...picked.map((x) => ["ZADD", "seen:quiz", t, qid(x)]), ["EXPIRE", "seen:quiz", KEEP_DAYS * 86400]]);
    const questions = picked.map((x) => ({ id: qid(x), q: x.q, a: x.a, c: x.c, answer: x.a[x.c] }));
    return { sourceType: "quiz", sourceId: questions.map((x) => x.id).join("-").slice(0, 60), facts: { title: "오늘의 상식퀴즈", url: "/games/wisdom-quiz/", total: all.length, questions }, assets: {} };
  },
};
