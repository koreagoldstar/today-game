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
  assert.equal(ranked.filter((g) => g.score >= 0).length, ranked.length, "PC 에서는 모두 후보");
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

test("실제로 게시한 게임은 다시 고르지 않음 (14일이 지나도) · 모의 게시는 제외 안 함 · 오래돼 목록에서 빠진 것은 posted:games 로", async () => {
  const real = { ...made("reaction", 40), posts: { instagram: { status: "PUBLISHED", platformId: "ig1" } } };
  const mock = { ...made("claw-master", 50), posts: { instagram: { status: "PUBLISHED", platformId: "m1", mock: true } } };
  const c = ctxWith([real, mock]);
  await c.seed();
  await c.store.run("SADD", "posted:games", "sky-island");
  const by = Object.fromEntries((await scoreGames(c, { now: NOW, runner: "pc" })).map((g) => [g.id, g]));
  assert.deepEqual([by.reaction.eligible, by.reaction.reasons], [false, ["이미 게시함"]]);
  assert.equal(by["sky-island"].eligible, false);
  assert.equal(by["claw-master"].eligible, true, "모의 게시는 인스타에 없음");
  const { plan } = await planToday(c, { now: NOW, runner: "pc" });
  assert.ok(!["reaction", "sky-island"].includes(plan.sourceId));
});

test("게시가 끝나면 그 게임을 posted:games 에 남김 — 실제 게시만", async () => {
  const { makeCtx, PLAN, WHO } = require("./helpers");
  const { produce } = require("../core/pipeline");
  const { publishDue } = require("../core/publisher");
  for (const mock of [false, true]) {
    const base = makeCtx();
    base.registry.register("source", "game", { collect: async () => ({ sourceType: "game", sourceId: "reaction", facts: { title: "번쩍 반응", url: "/games/reaction/" }, assets: {} }) });
    if (!mock) base.registry.register("channel", "instagram", { name: "instagram", mock: false, capabilities: () => ({ kinds: ["reel"], caption: { maxChars: 2200, maxHashtags: 30 } }), publish: async () => ({ postId: "ig1" }), verify: async () => ({ ok: true }), health: async () => ({ ok: true }), insights: async () => [] });
    const d = await produce(base.ctx, { ...PLAN, sourceType: "game" });
    await base.approval.approve(d.id, { version: d.version, ...WHO });
    base.clock.set("2026-11-09T19:05:00+09:00");
    await publishDue(base.ctx);
    assert.equal((await base.store.getContent(d.id)).status, "PUBLISHED");
    assert.deepEqual(await base.store.run("SMEMBERS", "posted:games"), mock ? [] : ["reaction"]);
  }
});

test("하루 1개 · 승인 대기 상한", () => {
  const s = validate(merge(DEFAULTS, {}));
  assert.equal(produceGate([], s, "2026-11-09").ok, true);
  assert.equal(produceGate([{ dateKey: "2026-11-09", slot: "feed", status: "READY_FOR_APPROVAL" }], s, "2026-11-09").ok, false);
  assert.equal(produceGate([{ dateKey: "2026-11-09", slot: "feed", status: "FAILED" }], s, "2026-11-09").ok, true, "오늘 실패한 것만 있으면 다시");
  const waiting = [1, 2, 3].map((i) => ({ dateKey: `2026-11-0${i}`, slot: "feed", status: "READY_FOR_APPROVAL" }));
  assert.match(produceGate(waiting, s, "2026-11-09").reason, /승인 대기가 3개/);
});

test("성장 3단계: 유형 비율 — 가장 모자란 유형 · 그 유형을 만들 수 있는 후보를 앞으로 · 후킹 5개", async () => {
  const { wantedType, hookOptions, canMake, classify } = require("../core/strategy");
  assert.equal(wantedType([]).type, "challenge", "아무것도 없으면 목표가 가장 큰 도전형");
  const w = wantedType(["challenge", "challenge", "record", "discover"]);
  assert.equal(w.type, "fail", "실패형 0개 (목표 25%)");
  assert.match(w.reason, /실패·반전형 0개/);
  assert.equal(wantedType(["fail", "fail", "record", "record"], { challenge: 40, fail: 25, record: 25, discover: 10 }).type, "challenge");

  const facts = { title: "타자 소나기", tag: "단어 막기 타자 연습 · 타수 기록" };
  const used = ["마지막 순간에 무너졌다"];
  const hooks = hookOptions({ type: "fail", facts, used });
  assert.equal(hooks.length, 5);
  assert.equal(new Set(hooks).size, 5);
  assert.ok(!hooks.includes(used[0]), "최근 쓴 문구는 뺌");
  for (const t of ["challenge", "fail", "record", "discover"]) for (const h of hookOptions({ type: t, facts })) assert.ok(!/\d/.test(h.replace(/\d+/g, (n) => (JSON.stringify(facts).includes(n) ? "" : n))), `${t}: 원본에 없는 숫자 금지 (${h})`);
  const rec = hookOptions({ type: "record", facts, profileHooks: ["몇 타까지 버틸 수 있어?", "한컴타자 기억나요?"] });
  assert.equal(rec[0], "몇 타까지 버틸 수 있어?", "게임 전용 문구 중 유형에 맞는 것 먼저");

  assert.ok(canMake({ sourceType: "game" }, "fail") && canMake({ sourceType: "spotlight" }, "discover") && !canMake({ sourceType: "spotlight" }, "challenge"));
  const s = classify({ plan: { wantType: "fail", wantReason: "x" }, source: { sourceType: "game", facts }, render: { meta: { hook: "초록불에 바로 탭!", captions: [] } } });
  assert.equal(s.type, "challenge", "실패 장면이 없으면 실패형이라고 하지 않음");
  assert.equal(s.wanted, "fail");
  assert.equal(s.hooks.length, 5);
  assert.ok(s.expect);
});
