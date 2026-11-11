"use strict";
/* PHASE 5 — 게임 고르기 · 하루 1개 · 승인 대기 상한 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { createFakeUpstash } = require("../core/memory-redis");
const { createStore } = require("../core/store");
const { DEFAULTS, merge, validate } = require("../core/settings");
const { scoreGames, planToday, produceGate } = require("../core/planner");
const { addClip, gameHash } = require("../core/clips");

const ROOT = path.resolve(__dirname, "../..");
const NOW = Date.parse("2026-11-09T08:10:00+09:00");
const DAY = 86400000;

function ctxWith(contents = []) {
  const mem = createFakeUpstash({ jitter: false });
  const store = createStore({ url: mem.url, token: mem.token, fetchImpl: mem.fetchImpl });
  const settings = validate(merge(DEFAULTS, {}));
  return { store, settings, seed: () => Promise.all(contents.map((c, i) => store.saveContent({ id: `2026-11-0${i}-feed-a${i}`, slot: "feed", ...c }))) };
}
const made = (game, daysAgo, status = "PUBLISHED") => ({ source: { sourceType: "game", sourceId: game }, status, createdAt: new Date(NOW - daysAgo * DAY).toISOString(), dateKey: "2026-11-01" });

test("GitHub Actions: PC 에서 녹화하는 게임(지금은 5개 모두)은 재고가 있을 때만 후보", async () => {
  const c = ctxWith();
  let ranked = await scoreGames(c, { now: NOW, runner: "actions" });
  assert.deepEqual(ranked.filter((g) => g.eligible && g.score >= 0).map((g) => g.id), [], "재고가 없으면 고를 게임 없음");
  assert.equal((await planToday(c, { now: NOW, runner: "actions" })).plan, null);
  await addClip(c.store, { id: "lava-clip-1", gameId: "lava-surfers", url: "https://blob.test/l.mp4", gameHash: gameHash(ROOT, "lava-surfers"), recordedAt: new Date(NOW - 3600e3).toISOString(), durationSec: 46 });
  ranked = await scoreGames(c, { now: NOW, runner: "actions" });
  assert.ok(ranked.find((g) => g.id === "lava-surfers").score > 0);
  ranked = await scoreGames(c, { now: NOW, runner: "pc" });
  assert.equal(ranked.filter((g) => g.score >= 0).length, 5, "PC 에서는 모두 후보");
});

test("최근 14일 안에 홍보한 게임은 뒤로 · 직전 게임은 제외 · 오래된 게임이 먼저", async () => {
  const c = ctxWith([made("reaction", 2), made("claw-master", 20), made("lava-surfers", 40)]);
  await c.seed();
  const ranked = await scoreGames(c, { now: NOW, runner: "pc" });
  const by = Object.fromEntries(ranked.map((g) => [g.id, g]));
  assert.ok(by["sky-island"].score > by.reaction.score, "홍보한 적 없는 게임 > 2일 전");
  assert.ok(by["claw-master"].score > by.reaction.score, "20일 전 > 2일 전");
  const { plan } = await planToday(c, { now: NOW, runner: "pc" });
  assert.notEqual(plan.sourceId, "reaction");
  assert.match(plan.reason, /게임 선정/);
});

test("직전과 같은 게임은 다시 고르지 않음 (점수가 높아도)", async () => {
  const c = ctxWith([made("reaction", 30, "FAILED"), made("claw-master", 0.5, "READY_FOR_APPROVAL")]);
  await c.seed();
  const ranked = await scoreGames(c, { now: NOW, runner: "pc" });
  assert.equal(ranked.find((g) => g.id === "claw-master").eligible, false);
  const { plan } = await planToday(c, { now: NOW, runner: "pc" });
  assert.notEqual(plan.sourceId, "claw-master");
  assert.equal(ranked.find((g) => g.id === "reaction").score, 130, "실패한 건 홍보한 것으로 치지 않음 (홍보한 적 없음 100 + 오래됨 30)");
});

test("하루 1개 · 승인 대기 상한", () => {
  const s = validate(merge(DEFAULTS, {}));
  assert.equal(produceGate([], s, "2026-11-09").ok, true);
  assert.equal(produceGate([{ dateKey: "2026-11-09", slot: "feed", status: "READY_FOR_APPROVAL" }], s, "2026-11-09").ok, false);
  assert.equal(produceGate([{ dateKey: "2026-11-09", slot: "feed", status: "FAILED" }], s, "2026-11-09").ok, true, "오늘 실패한 것만 있으면 다시");
  const waiting = [1, 2, 3].map((i) => ({ dateKey: `2026-11-0${i}`, slot: "feed", status: "READY_FOR_APPROVAL" }));
  assert.match(produceGate(waiting, s, "2026-11-09").reason, /승인 대기가 3개/);
});
