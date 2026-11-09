"use strict";
/* PHASE 9 — 웹 관리자: 키 없이는 못 들어옴 · 틀린 키 잠금 · 텔레그램과 동시에 눌러도 한 번만 · 메뉴 자료 · 설정 · 게임 제외 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { makeCtx } = require("./helpers");
const { produce } = require("../core/pipeline");
const { createAdmin } = require("../core/admin");
const { scoreGames } = require("../core/planner");
const { loadSettings } = require("../core/settings");

const KEY = "admin-test-key-0123456789abcdef";
const PLAN = { slot: "feed", sourceType: "fake", renderer: "fake", channels: ["instagram"], reason: "시험" };

async function login(admin, ip = "1.2.3.4") {
  const r = await admin.handle({ method: "POST", body: { action: "login", key: KEY }, ip });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { authorization: `Bearer ${r.body.token}` };
}

test("잠금: 키 설정 없으면 503 · 틀린 키 401 → 5번이면 잠김 · 토큰 없이는 어떤 메뉴도 안 열림 · 나가면 토큰 무효", async () => {
  const base = makeCtx();
  assert.equal((await createAdmin({ store: base.store, env: {} }).handle({ method: "POST", body: { action: "login", key: "x" } })).status, 503);
  assert.equal((await createAdmin({ store: base.store, env: { MKT_ADMIN_KEY: "short" } }).handle({ method: "POST", body: { action: "login", key: "short" } })).status, 503, "짧은 키는 거부");
  const admin = createAdmin({ store: base.store, env: { MKT_ADMIN_KEY: KEY } });
  for (const op of ["overview", "contents", "settings", "games", "channels", "insights", "logs"]) assert.equal((await admin.handle({ method: "GET", query: { op } })).status, 401, op);
  assert.equal((await admin.handle({ method: "GET", query: { op: "overview" }, headers: { authorization: `Bearer ${"a".repeat(64)}` } })).status, 401, "지어낸 토큰");
  assert.equal((await admin.handle({ method: "POST", body: { action: "approve", id: "x", version: 1 } })).status, 401);
  for (let i = 0; i < 5; i++) assert.equal((await admin.handle({ method: "POST", body: { action: "login", key: "wrong" }, ip: "9.9.9.9" })).status, 401);
  const locked = await admin.handle({ method: "POST", body: { action: "login", key: KEY }, ip: "9.9.9.9" });
  assert.equal(locked.status, 429, "맞는 키여도 잠긴 동안은 못 들어옴");
  const h = await login(admin, "5.5.5.5");
  assert.equal((await admin.handle({ method: "GET", query: { op: "overview" }, headers: h })).status, 200);
  assert.equal((await admin.handle({ method: "POST", body: { action: "logout" }, headers: h })).status, 200);
  assert.equal((await admin.handle({ method: "GET", query: { op: "overview" }, headers: h })).status, 401);
  const keys = [...base.fake.keysSeen];
  assert.ok(keys.every((k) => k.startsWith("todaygame:mkt:")), "관리자 기록도 todaygame:mkt: 키만");
  assert.ok(!keys.some((k) => k.includes(KEY)), "키 · 토큰 원문을 저장하지 않음");
});

test("텔레그램과 웹에서 동시에 승인해도 한 번만 반영 · 웹 반려는 그 뒤 거부", async () => {
  const base = makeCtx();
  const admin = createAdmin({ store: base.store, env: { MKT_ADMIN_KEY: KEY }, now: base.clock.now });
  const h = await login(admin);
  const d = await produce(base.ctx, PLAN);
  const [tg, web] = await Promise.allSettled([base.approval.approve(d.id, { version: d.version, by: "admin", via: "telegram" }), admin.handle({ method: "POST", body: { action: "approve", id: d.id, version: d.version }, headers: h })]);
  const after = await base.store.getContent(d.id);
  assert.equal(after.status, "SCHEDULED");
  assert.equal(after.history.filter((x) => x.to === "APPROVED").length, 1, "승인 기록은 하나");
  const webOk = web.status === "fulfilled" && web.value.status === 200;
  const tgOk = tg.status === "fulfilled";
  assert.equal(Number(webOk) + Number(tgOk), 1, "둘 중 하나만 성공");
  const rej = await admin.handle({ method: "POST", body: { action: "reject", id: d.id, version: after.version, reason: "늦은 반려" }, headers: h });
  assert.equal(rej.status, 409);
});

test("웹 메뉴: 목록 · 문구 고치면 승인 무효 · 형식 못 받는 채널 거부 · 오래된 버전 거부", async () => {
  const base = makeCtx();
  const admin = createAdmin({ store: base.store, env: { MKT_ADMIN_KEY: KEY }, now: base.clock.now });
  const h = await login(admin);
  const d = await produce(base.ctx, PLAN);
  const pending = await admin.handle({ method: "GET", query: { op: "contents", group: "pending" }, headers: h });
  assert.deepEqual(pending.body.items.map((x) => x.id), [d.id]);
  assert.ok(pending.body.items[0].files.every((f) => f.url && !f.path), "로컬 경로는 내보내지 않음");
  const ok = await admin.handle({ method: "POST", body: { action: "approve", id: d.id, version: 1 }, headers: h });
  assert.equal(ok.body.item.status, "SCHEDULED");
  const stale = await admin.handle({ method: "POST", body: { action: "editCopy", id: d.id, version: 0, channel: "instagram", caption: "새 문구" }, headers: h });
  assert.equal(stale.status, 409);
  const edit = await admin.handle({ method: "POST", body: { action: "editCopy", id: d.id, version: 1, channel: "instagram", caption: "새 문구\n프로필 링크에서!", hashtags: ["#오늘의게임"] }, headers: h });
  assert.equal(edit.body.item.status, "READY_FOR_APPROVAL", "문구를 고치면 다시 승인 필요");
  assert.equal(edit.body.item.approval, null);
  const story = await produce(base.ctx, { ...PLAN, slot: "story" });
  await base.store.updateContent(story.id, (x) => void (x.render.kind = "story"));
  const ch = await admin.handle({ method: "POST", body: { action: "setChannels", id: story.id, version: story.version, channels: ["threads"] }, headers: h });
  assert.equal(ch.status, 409);
  assert.match(ch.body.error, /형식/);
  const ov = await admin.handle({ method: "GET", query: { op: "overview" }, headers: h });
  assert.equal(ov.body.count.pending, 2);
  const logs = await admin.handle({ method: "GET", query: { op: "logs" }, headers: h });
  assert.ok(logs.body.logs.some((l) => /웹 관리자: approve/.test(l.msg)), "웹에서 한 일은 기록에 남음");
});

test("편성표 저장: 틀린 값은 이유와 함께 거부 · 바꾼 값만 저장 · 게임 홍보 제외가 게임 고르기에 반영", async () => {
  const base = makeCtx();
  const admin = createAdmin({ store: base.store, env: { MKT_ADMIN_KEY: KEY } });
  const h = await login(admin);
  const bad = await admin.handle({ method: "POST", body: { action: "settings", patch: { schedule: { mon: ["nope"] } } }, headers: h });
  assert.equal(bad.status, 409);
  assert.match(bad.body.error, /없는 유형/);
  assert.equal((await admin.handle({ method: "POST", body: { action: "settings", patch: { qc: { maxRedo: 0 } } }, headers: h })).status, 409, "검수 기준은 웹에서 못 바꿈");
  const good = await admin.handle({ method: "POST", body: { action: "settings", patch: { postTimes: { feed: "20:00" } } }, headers: h });
  assert.equal(good.body.settings.postTimes.feed, "20:00");
  assert.deepEqual(await base.store.getJson("settings"), { postTimes: { feed: "20:00" } }, "바꾼 값만 저장 (기본값이 바뀌면 따라감)");
  await admin.handle({ method: "POST", body: { action: "exclude", gameId: "reaction", excluded: true }, headers: h });
  const settings = await loadSettings(base.store);
  assert.deepEqual(settings.excludeGames, ["reaction"]);
  const ranked = await scoreGames({ store: base.store, settings }, { runner: "pc" });
  assert.equal(ranked.find((g) => g.id === "reaction").eligible, false);
  await admin.handle({ method: "POST", body: { action: "exclude", gameId: "reaction", excluded: false }, headers: h });
  assert.deepEqual((await loadSettings(base.store)).excludeGames, []);
});

test("api/mkt-admin.js: 캐시 안 함 · 검색 제외 · 다른 사이트 허용(CORS) 헤더 없음 · 저장소 없으면 503", async () => {
  const handler = require(path.join(__dirname, "../../api/mkt-admin.js"));
  const res = () => {
    const r = { headers: {}, code: 0, body: null };
    r.setHeader = (k, v) => (r.headers[k.toLowerCase()] = v);
    r.status = (c) => ((r.code = c), r);
    r.json = (b) => ((r.body = b), r);
    return r;
  };
  const saved = { ...process.env };
  for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) delete process.env[k];
  try {
    const r = res();
    await handler({ method: "GET", query: {}, headers: {} }, r);
    assert.equal(r.code, 503);
    assert.equal(r.headers["cache-control"], "no-store");
    assert.equal(r.headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(r.headers["access-control-allow-origin"], undefined);
  } finally {
    Object.assign(process.env, saved);
  }
});
