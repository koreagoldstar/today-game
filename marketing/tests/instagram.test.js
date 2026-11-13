"use strict";
/* PHASE 6 — 인스타그램 실제 게시 모듈 (가짜 Meta 서버로): 게시 흐름 · permalink · 오류 구분 · 이어가기 · 토큰 암호화 · 만료 · 갱신 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeUpstash } = require("../core/memory-redis");
const { createStore } = require("../core/store");
const { encrypt, decrypt } = require("../core/secret");
const ig = require("../channels/instagram");

const ENV = { MKT_TOKEN_KEY: "test-key-0123456789-abcdefghijklmnop" };
const DAY = 86400000;

function fakeMeta({ accountType = "BUSINESS", statuses = ["IN_PROGRESS", "FINISHED"], failOn = {} } = {}) {
  const calls = [];
  let st = [...statuses];
  const media = new Map();
  async function fetchImpl(url, init = {}) {
    const u = new URL(url);
    const params = Object.fromEntries(init.body ? new URLSearchParams(init.body) : u.searchParams);
    const path = u.pathname.replace(/^\/v\d+\.\d+/, "");
    calls.push({ method: init.method || "GET", path, params });
    const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    for (const [p, err] of Object.entries(failOn)) if (path.includes(p)) return reply({ error: err }, 400);
    if (path === "/me") return reply({ user_id: "1784", username: "todaygame.co.kr", account_type: accountType, followers_count: 12 });
    if (path === "/refresh_access_token") return reply({ access_token: "NEW-LONG-TOKEN", token_type: "bearer", expires_in: 5184000 });
    if (path.endsWith("/content_publishing_limit")) return reply({ data: [{ quota_usage: 1, config: { quota_total: 100 } }] });
    if (path.endsWith("/media_publish")) {
      media.set("m-900", params.creation_id);
      return reply({ id: "m-900" });
    }
    if (path.endsWith("/media") && init.method === "POST") return reply({ id: `c-${calls.length}` });
    if (path.endsWith("/media")) return reply({ data: [] });
    if (path.startsWith("/c-")) return reply({ status_code: st.length > 1 ? st.shift() : st[0] });
    if (path === "/m-900") return reply({ id: "m-900", permalink: "https://www.instagram.com/reel/ABC/", media_product_type: "REELS" });
    if (path.endsWith("/insights")) return params.metric.includes(",") ? reply({ error: { code: 100, message: "metric not supported" } }, 400) : params.metric === "shares" ? reply({ error: { code: 100 } }, 400) : reply({ data: [{ name: params.metric, values: [{ value: 7 }] }] });
    return reply({ error: { code: 1, message: `모르는 경로 ${path}` } }, 500);
  }
  return { fetchImpl, calls };
}

async function setup(opts = {}) {
  const mem = createFakeUpstash({ jitter: false });
  const store = createStore({ url: mem.url, token: mem.token, fetchImpl: mem.fetchImpl });
  const meta = fakeMeta(opts);
  await ig.connectInstagram(store, "LONG-TOKEN-FROM-DASHBOARD", { env: ENV, fetchImpl: meta.fetchImpl, now: opts.connectedAt || Date.now() });
  const ch = ig.create({ env: ENV, store, fetchImpl: meta.fetchImpl, sleep: async () => {}, pollMax: 4 });
  return { store, meta, ch };
}
const reelItem = { contentId: "c1", kind: "reel", files: [{ role: "video", url: "https://blob.test/r.mp4" }, { role: "cover", url: "https://blob.test/c.jpg" }], copy: { caption: "이 인형, 뽑을 수 있을까? 🎮\n프로필 링크에서 플레이!", hashtags: ["#오늘의게임", "#무료게임"] } };

test("토큰 암호화: 되돌릴 수 있고, 열쇠가 다르면 못 읽음, 저장소에는 원문이 없음", async () => {
  const p = encrypt("SECRET-TOKEN", ENV);
  assert.equal(decrypt(p, ENV), "SECRET-TOKEN");
  assert.throws(() => decrypt(p, { MKT_TOKEN_KEY: "another-key-0123456789-abcdefghijkl" }));
  assert.throws(() => encrypt("x", { MKT_TOKEN_KEY: "short" }), /32자/);
  const { store } = await setup();
  const raw = JSON.stringify(await store.getJson("channel:instagram"));
  assert.ok(!raw.includes("LONG-TOKEN-FROM-DASHBOARD"));
});

test("연결: 프로페셔널 계정만 · 상태(남은 날짜, 60일 추정)", async () => {
  await assert.rejects(() => setup({ accountType: "PERSONAL" }), /프로페셔널/);
  const { store } = await setup();
  const s = await ig.instagramStatus(store);
  assert.equal(s.connected, true);
  assert.equal(s.username, "todaygame.co.kr");
  assert.equal(s.expiresEstimated, true);
  assert.ok(s.daysLeft >= 59);
});

test("릴스 게시: 한도 확인 → 컨테이너(REELS · 공개 주소 · 커버 · 문구+해시태그) → 처리 대기 → media_publish → 다시 조회 permalink", async () => {
  const { meta, ch } = await setup();
  const saved = [];
  const r = await ch.publish(reelItem, { save: async (p) => saved.push(p) });
  assert.equal(r.postId, "m-900");
  const c = meta.calls.find((x) => x.method === "POST" && x.path.endsWith("/media"));
  assert.equal(c.params.media_type, "REELS");
  assert.equal(c.params.video_url, "https://blob.test/r.mp4");
  assert.equal(c.params.cover_url, "https://blob.test/c.jpg");
  assert.equal(c.params.caption, "이 인형, 뽑을 수 있을까? 🎮\n프로필 링크에서 플레이!\n\n#오늘의게임 #무료게임");
  assert.equal(c.params.access_token, "LONG-TOKEN-FROM-DASHBOARD");
  assert.ok(meta.calls.some((x) => x.path.endsWith("/content_publishing_limit")));
  assert.deepEqual(saved.map((s) => Object.keys(s)[0]), ["containerId", "platformId"], "id 를 받는 즉시 저장");
  const v = await ch.verify("m-900");
  assert.deepEqual(v, { ok: true, permalink: "https://www.instagram.com/reel/ABC/", productType: "REELS" });
});

test("공개 주소가 없으면 게시하지 않음 · 캐러셀 · 이미지 · 스토리 컨테이너", async () => {
  const { meta, ch } = await setup({ statuses: ["FINISHED"] });
  await assert.rejects(() => ch.publish({ ...reelItem, files: [{ role: "video", path: "C:/local.mp4" }] }), { kind: "INVALID" });
  await ch.publish({ kind: "carousel", files: [1, 2, 3].map((i) => ({ role: "slide", url: `https://blob.test/s${i}.jpg` })), copy: { caption: "퀴즈", hashtags: [] } }, {});
  const posts = meta.calls.filter((x) => x.method === "POST" && x.path.endsWith("/media"));
  assert.equal(posts.filter((p) => p.params.is_carousel_item === "true").length, 3);
  assert.equal(posts.find((p) => p.params.media_type === "CAROUSEL").params.children.split(",").length, 3);
  await ch.publish({ kind: "story", files: [{ role: "image", url: "https://blob.test/st.jpg" }], copy: { caption: "" } }, {});
  assert.ok(meta.calls.some((x) => x.params.media_type === "STORIES" && x.params.image_url));
  await assert.rejects(() => ch.publish({ kind: "carousel", files: [{ role: "slide", url: "https://blob.test/1.jpg" }], copy: { caption: "x" } }), /2~20장/);
});

test("오류 구분: 토큰 · 권한 · 한도 · 미디어 처리 · 요청 값 · 그 밖", () => {
  const k = (status, err) => ig.classify(status, err).kind;
  assert.equal(k(400, { code: 190 }), "TOKEN");
  assert.equal(k(403, { code: 10 }), "PERMISSION");
  assert.equal(k(400, { code: 200 }), "PERMISSION");
  const blocked = ig.classify(400, { code: 200, error_subcode: 5258005, message: "API access blocked." });
  assert.equal(blocked.kind, "BLOCKED", "2026-11-13 실제: 관리자 로그아웃 때 차단 → 다시 로그인하면 풀림");
  assert.equal(blocked.retryable, true);
  assert.match(blocked.message, /다시 로그인/);
  assert.equal(k(400, { code: 4 }), "RATE_LIMIT");
  assert.equal(k(429, {}), "RATE_LIMIT");
  assert.equal(k(400, { code: 9004 }), "MEDIA");
  assert.equal(k(400, { code: 1, error_subcode: 2207026 }), "MEDIA");
  assert.equal(k(400, { code: 100 }), "INVALID");
  assert.equal(k(500, { code: 1 }), "UNKNOWN");
  assert.equal(ig.classify(400, { code: 190 }).retryable, false);
  assert.equal(ig.classify(429, {}).retryable, true);
});

test("Meta 처리 실패(ERROR) → 미디어 오류 · 다시 시도 안 함, 오래 걸리면 다시 시도 가능 오류", async () => {
  const a = await setup({ statuses: ["ERROR"] });
  await assert.rejects(() => a.ch.publish(reelItem), (e) => e.kind === "MEDIA" && e.retryable === false);
  const b = await setup({ statuses: ["IN_PROGRESS"] });
  await assert.rejects(() => b.ch.publish(reelItem), (e) => e.retryable === true);
  const c = await setup({ failOn: { "/media": { code: 190, message: "Invalid OAuth access token" } } });
  await assert.rejects(() => c.ch.publish(reelItem), (e) => e.kind === "TOKEN" && !/LONG-TOKEN/.test(e.message));
});

test("이어가기: 게시 id 가 있으면 끝 · 컨테이너만 있으면 상태 확인 후 게시 · 만료 컨테이너면 새로", async () => {
  const { ch } = await setup({ statuses: ["FINISHED"] });
  assert.deepEqual(await ch.resume({ platformId: "m-1" }, reelItem), { postId: "m-1" });
  assert.deepEqual(await ch.resume({ containerId: "c-77" }, reelItem), { postId: "m-900" });
  const e = await setup({ statuses: ["EXPIRED"] });
  assert.equal(await e.ch.resume({ containerId: "c-77" }, reelItem), null);
});

test("지표: 지원하는 것만 (지원 안 되는 지표는 빼고, 지어내지 않음)", async () => {
  const { ch } = await setup();
  const m = await ch.insights("m-900");
  assert.ok(m.length >= 5);
  assert.ok(!m.some((x) => x.metric === "shares"), "지원 안 되는 지표는 없음");
  assert.ok(m.every((x) => x.value === 7));
});

test("토큰 갱신: 7일 넘게 남으면 그대로 · 7일 안이면 갱신 · 실패하면 알림 · 지나면 만료 알림 · 만료되면 게시 거부", async () => {
  const t0 = Date.parse("2026-11-01T00:00:00Z");
  const { store, meta } = await setup({ connectedAt: t0 });
  assert.equal((await ig.refreshInstagram(store, { env: ENV, fetchImpl: meta.fetchImpl, now: t0 + 10 * DAY })).action, "none");
  const r = await ig.refreshInstagram(store, { env: ENV, fetchImpl: meta.fetchImpl, now: t0 + 55 * DAY });
  assert.equal(r.action, "refreshed");
  const rec = await store.getJson("channel:instagram");
  assert.equal(decrypt(rec.tokenEnc, ENV), "NEW-LONG-TOKEN");
  assert.equal(rec.expiresEstimated, false);

  const events = [];
  const bad = await setup({ connectedAt: t0, failOn: { "/refresh_access_token": { code: 190, message: "expired" } } });
  const f = await ig.refreshInstagram(bad.store, { env: ENV, fetchImpl: bad.meta.fetchImpl, now: t0 + 55 * DAY, notify: async (e) => events.push(e) });
  assert.equal(f.action, "failed");
  const x = await ig.refreshInstagram(bad.store, { env: ENV, fetchImpl: bad.meta.fetchImpl, now: t0 + 61 * DAY, notify: async (e) => events.push(e) });
  assert.equal(x.action, "expired");
  assert.deepEqual(events, ["token_refresh_failed", "token_expired"]);
  const ch = ig.create({ env: ENV, store: bad.store, fetchImpl: bad.meta.fetchImpl, sleep: async () => {} });
  await assert.rejects(() => ch.publish(reelItem), (e) => e.kind === "TOKEN" && e.retryable === false);
});

test("통합 로그인(시스템 사용자 토큰): graph.facebook.com 으로 연결 · 만료 없음 · 갱신 안 함 · 게시도 같은 주소", async () => {
  const mem = createFakeUpstash({ jitter: false });
  const store = createStore({ url: mem.url, token: mem.token, fetchImpl: mem.fetchImpl });
  const hosts = new Set();
  const meta = fakeMeta();
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    hosts.add(u.host);
    if (u.pathname.endsWith("/me")) return { ok: true, status: 200, json: async () => ({ id: "9001", name: "todaygame System User" }) };
    if (u.pathname.endsWith("/1784") && !init.method) return { ok: true, status: 200, json: async () => ({ id: "1784", username: "todaygame.co.kr", followers_count: 4 }) };
    return meta.fetchImpl(url, init);
  };
  await assert.rejects(ig.connectInstagram(store, "EAAXfake", { env: ENV, fetchImpl }), /IG_USER_ID/);
  const r = await ig.connectInstagram(store, "EAAXfake", { env: ENV, fetchImpl, igUserId: "1784" });
  assert.equal(r.mode, "facebook");
  assert.equal(r.neverExpires, true);
  assert.equal(r.username, "todaygame.co.kr");
  assert.ok(!JSON.stringify(await store.getJson("channel:instagram")).includes("EAAXfake"), "토큰은 암호문으로만");
  assert.equal((await ig.refreshInstagram(store, { env: ENV, fetchImpl, now: Date.now() + 400 * DAY })).action, "none", "만료 없는 토큰은 갱신 안 함");
  assert.equal((await ig.instagramStatus(store)).daysLeft, null);
  const ch = ig.create({ env: ENV, store, fetchImpl, sleep: async () => {} });
  assert.equal((await ch.publish(reelItem)).postId, "m-900");
  assert.deepEqual([...hosts], ["graph.facebook.com"], "모든 요청이 graph.facebook.com");
  const h = await ch.health();
  assert.equal(h.ok, true);
  assert.equal(h.login, "facebook");
});
