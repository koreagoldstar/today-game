"use strict";
/* PHASE 10 — 게시 1·3·7일 지표(실제 게시만) · 팔로워 · 주간 요약 · 성과 가중치(최대 2배) · 클릭 세기(/api/mkt-go) */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { makeCtx } = require("./helpers");
const { createFakeUpstash } = require("../core/memory-redis");
const insights = require("../core/insights");
const { scoreGames } = require("../core/planner");
const { templateCopy } = require("../copy/copywriter");

const DAY = 86400000;
const H = 3600000;

/** 실제(live) 채널 흉내: 지표 · 팔로워를 주는 가짜 */
function liveFake(name, { views = 100, followers = 500, fail = false } = {}) {
  const calls = [];
  return {
    name,
    mock: false,
    calls,
    capabilities: () => ({ kinds: ["reel", "image", "carousel", "story"], caption: { maxChars: 2200, maxHashtags: 30 } }),
    publish: async () => ({ postId: "x" }),
    verify: async () => ({ ok: true }),
    health: async () => ({ ok: true, mode: "live" }),
    async insights(id) {
      calls.push(id);
      if (fail) throw new Error("일시 오류");
      return [{ metric: "views", value: views }, { metric: "likes", value: 7 }];
    },
    async followers() {
      return followers;
    },
  };
}

const posted = (id, game, publishedAt, posts, extra = {}) => ({ id, slot: "feed", dateKey: publishedAt.slice(0, 10), status: "PUBLISHED", createdAt: publishedAt, updatedAt: publishedAt, source: { sourceType: "game", sourceId: game, facts: { title: game } }, render: { kind: "reel", meta: { title: game }, files: [] }, posts, ...extra });

test("지표: 실제 게시만 1 · 3 · 7일 뒤에 모으고, 모의 게시는 건드리지 않음 · 실패해도 다음에 다시", async () => {
  const base = makeCtx();
  const ig = liveFake("instagram");
  base.registry.register("channel", "instagram", ig);
  const t0 = Date.parse("2026-11-01T10:00:00Z");
  await base.store.saveContent(posted("2026-11-01-feed-aaaa01", "reaction", "2026-11-01T10:00:00.000Z", { instagram: { status: "PUBLISHED", platformId: "ig1", publishedAt: "2026-11-01T10:00:00.000Z" }, threads: { status: "PUBLISHED", platformId: "mock-post-1", publishedAt: "2026-11-01T10:00:00.000Z", mock: true } }));
  assert.deepEqual(await insights.collectInsights(base.ctx, t0 + 12 * H), [], "하루가 안 됐으면 아직");
  const a = await insights.collectInsights(base.ctx, t0 + 1 * DAY + H);
  assert.deepEqual(a.map((x) => [x.channel, x.days]), [["instagram", [1]]], "모의(threads)는 모으지 않음");
  assert.deepEqual(await insights.collectInsights(base.ctx, t0 + 2 * DAY), [], "같은 시점은 한 번만");
  const b = await insights.collectInsights(base.ctx, t0 + 8 * DAY);
  assert.deepEqual(b.map((x) => x.days), [[3, 7]], "놓친 시점은 한 번에");
  const doc = await base.store.getContent("2026-11-01-feed-aaaa01");
  assert.deepEqual(Object.keys(doc.insights.instagram.checkpoints), ["1", "3", "7"]);
  assert.equal(doc.insights.threads, undefined);
  assert.deepEqual(doc.insights.instagram.metrics, [{ metric: "views", value: 100 }, { metric: "likes", value: 7 }]);

  const flaky = makeCtx();
  flaky.registry.register("channel", "instagram", liveFake("instagram", { fail: true }));
  await flaky.store.saveContent(posted("2026-11-01-feed-aaaa02", "reaction", "2026-11-01T10:00:00.000Z", { instagram: { status: "PUBLISHED", platformId: "ig2", publishedAt: "2026-11-01T10:00:00.000Z" } }));
  assert.deepEqual(await insights.collectInsights(flaky.ctx, t0 + 2 * DAY), []);
  assert.equal((await flaky.store.getContent("2026-11-01-feed-aaaa02")).insights, undefined, "실패하면 기록 안 함 → 다음 실행에서 다시");
});

test("성과 가중치: 실제 조회 수가 있는 게임만, 최대 2배 · 최소 0.5배 → 게임 고르기 점수에 곱함", async () => {
  const s = makeCtx().settings;
  const m = (views) => ({ instagram: { metrics: [{ metric: "views", value: views }] } });
  const list = [posted("a", "reaction", "2026-10-01T00:00:00Z", {}, { insights: m(1000) }), posted("b", "lava-surfers", "2026-10-02T00:00:00Z", {}, { insights: m(100) }), posted("c", "sky-island", "2026-10-03T00:00:00Z", {}, { insights: m(400) }), posted("d", "dragon-statue", "2026-10-04T00:00:00Z", {})];
  const w = insights.performanceWeights(list, s);
  assert.equal(w.reaction, 2, "평균의 2배 넘어도 2배까지");
  assert.equal(w["lava-surfers"], 0.5);
  assert.equal(w["sky-island"], 0.8);
  assert.equal(w["dragon-statue"], undefined, "지표 없는 게임은 가중치 없음");

  const base = makeCtx();
  for (const d of list) await base.store.saveContent({ ...d, id: `2026-10-0${list.indexOf(d) + 1}-feed-w${list.indexOf(d)}abcd` });
  const ranked = await scoreGames(base.ctx, { now: Date.parse("2026-11-10T08:00:00+09:00"), runner: "pc" });
  const by = Object.fromEntries(ranked.map((g) => [g.id, g]));
  assert.ok(by.reaction.reasons.includes("성과 x2"));
  assert.ok(by.reaction.score > by["sky-island"].score);
});

test("팔로워 · 주간 요약: 월요일에 한 번, 실제 · 모의를 나눠 적고 지표가 없으면 없다고", async () => {
  const base = makeCtx();
  base.registry.register("channel", "instagram", liveFake("instagram", { followers: 1200 }));
  await base.store.setJson("followers:instagram:2026-11-02", { n: 1150 });
  assert.deepEqual(await insights.recordFollowers(base.ctx, Date.parse("2026-11-08T23:00:00+09:00")), { instagram: 1200 }, "mock 채널은 건너뜀");
  await base.store.saveContent(posted("2026-11-03-feed-bbbb01", "reaction", "2026-11-03T10:00:00.000Z", { instagram: { status: "PUBLISHED", platformId: "ig9", publishedAt: "2026-11-03T10:00:00.000Z" } }, { insights: { instagram: { metrics: [{ metric: "views", value: 321 }] } } }));
  await base.store.saveContent(posted("2026-11-05-feed-bbbb02", "lava-surfers", "2026-11-05T10:00:00.000Z", { instagram: { status: "PUBLISHED", platformId: "mock-post-x", publishedAt: "2026-11-05T10:00:00.000Z", mock: true } }));
  assert.equal(await insights.weeklyReport(base.ctx, Date.parse("2026-11-08T09:00:00+09:00")), null, "월요일이 아니면 안 보냄");
  const r = await insights.weeklyReport(base.ctx, Date.parse("2026-11-09T09:00:00+09:00"));
  assert.equal(r.week, "2026-W45");
  assert.match(r.text, /게시 2건 — 실제 1 · 모의 1/);
  assert.match(r.text, /조회 합계 321/);
  assert.match(r.text, /가장 많이 본 콘텐츠: reaction/);
  assert.match(r.text, /팔로워: 인스타 1,200 \(\+50\)/);
  assert.match(r.text, /세기 꺼짐/);
  assert.equal(await insights.weeklyReport(base.ctx, Date.parse("2026-11-09T10:00:00+09:00")), null, "같은 주는 한 번만");
  assert.equal((await base.store.getJson("report:weekly")).week, "2026-W45");
});

test("클릭 세기: 설정을 켜야 링크가 /api/mkt-go 를 거침 · 사이트 안으로만 이동 · 미리보기 봇은 안 셈", async () => {
  const facts = { title: "번쩍 반응", url: "/games/reaction/", intro: "반응 게임입니다.", how: "" };
  const src = { sourceType: "game", sourceId: "reaction", facts };
  assert.match(templateCopy({ source: src, render: { kind: "reel", meta: {} }, channels: ["threads"] }).threads.link, /^https:\/\/www\.todaygame\.co\.kr\/games\/reaction\/\?utm_source=threads/);
  const tracked = templateCopy({ source: src, render: { kind: "reel", meta: {} }, channels: ["threads"], linkOpts: { track: true, contentId: "2026-11-10-feed-cccc01" } }).threads.link;
  const u = new URL(tracked);
  assert.equal(u.pathname, "/api/mkt-go");
  assert.equal(u.searchParams.get("c"), "2026-11-10-feed-cccc01");
  assert.match(u.searchParams.get("to"), /^\/games\/reaction\/\?utm_source=threads/);

  const fake = createFakeUpstash({ jitter: false });
  const saved = { env: { ...process.env }, fetch: globalThis.fetch };
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: fake.url, UPSTASH_REDIS_REST_TOKEN: fake.token });
  globalThis.fetch = fake.fetchImpl;
  try {
    const go = require(path.join(__dirname, "../../api/mkt-go.js"));
    for (const bad of ["//evil.example/x", "/\\evil.example", "https://evil.example/", "javascript:alert(1)", "/a b", ""]) assert.equal(go.destination(bad), "https://www.todaygame.co.kr/", `막음: ${bad}`);
    assert.equal(go.destination("/games/reaction/?utm_source=threads"), "https://www.todaygame.co.kr/games/reaction/?utm_source=threads");
    const hit = async (ua) => {
      const res = { headers: {}, statusCode: 0, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end() {} };
      await go({ method: "GET", query: { c: "2026-11-10-feed-cccc01", ch: "threads", to: "/games/reaction/" }, headers: { "user-agent": ua } }, res);
      return res;
    };
    const r1 = await hit("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari");
    assert.equal(r1.statusCode, 302);
    assert.equal(r1.headers.location, "https://www.todaygame.co.kr/games/reaction/");
    await hit("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)");
    await hit("TelegramBot (like TwitterBot)");
    const get = (k) => (fake.data.get(`todaygame:mkt:${k}`) || {}).v;
    assert.equal(get("clicks:2026-11-10-feed-cccc01"), "1", "사람 1번만 셈");
    assert.equal(get("clicks:2026-11-10-feed-cccc01:threads"), "1");
    assert.ok([...fake.keysSeen].every((k) => k.startsWith("todaygame:mkt:")), "마케팅 키만 씀");
  } finally {
    process.env = saved.env;
    globalThis.fetch = saved.fetch;
  }
});
