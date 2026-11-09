"use strict";
/* PHASE 8 — 신작 감지(C4) · Threads · Facebook · YouTube 어댑터 (가짜 플랫폼 서버로) · 한 채널이 실패해도 나머지는 게시 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { makeCtx, WHO, TMP } = require("./helpers");
const { produce } = require("../core/pipeline");
const { publishDue } = require("../core/publisher");
const { planSlot } = require("../core/planner");
const newGame = require("../sources/new-game");
const threads = require("../channels/threads");
const facebook = require("../channels/facebook");
const youtube = require("../channels/youtube");

const ENV = { MKT_TOKEN_KEY: "test-key-0123456789-abcdefghijklmnop" };
const noSleep = async () => {};
const json = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Map(Object.entries(headers)), json: async () => body });

/** 주소 · 방법으로 응답을 고르는 가짜 서버. calls 에 모든 요청을 남긴다 */
function fakeServer(routes) {
  const calls = [];
  async function fetchImpl(url, init = {}) {
    const u = new URL(url);
    const params = Object.fromEntries(u.searchParams);
    if (init.body && typeof init.body === "string") Object.assign(params, init.body.startsWith("{") ? JSON.parse(init.body) : Object.fromEntries(new URLSearchParams(init.body)));
    const call = { method: init.method || "GET", url: `${u.origin}${u.pathname}`, params, headers: init.headers || {}, body: init.body };
    calls.push(call);
    for (const [re, fn] of routes) if (re.test(`${call.method} ${call.url}`)) return fn(call);
    return json(404, { error: { message: `없는 주소 ${call.method} ${call.url}`, code: 100 } });
  }
  return { fetchImpl, calls };
}

const reelItem = (over = {}) => ({ contentId: "c1", version: 1, kind: "reel", slot: "feed", files: [{ role: "video", url: "https://media.test/r.mp4" }, { role: "cover", url: "https://media.test/c.jpg" }], copy: { caption: "블록 팡팡 한 판 어때요?\n프로필 링크에서!", hashtags: ["#오늘의게임", "#퍼즐게임"], link: "https://todaygame.co.kr/games/tetris/?utm_source=x", title: "블록 팡팡" }, ...over });

/* ---------------- 신작 감지 ---------------- */

test("신작: 처음엔 기준만 저장 · 새 id 감지 → 썸네일 이미지 제작 → 알린 뒤엔 다시 안 잡힘 · 프로필 있으면 릴스", async () => {
  const base = makeCtx();
  base.registry.register("source", "new-game", newGame);
  base.registry.register("renderer", "image", require("../renderers/image"));
  const first = await newGame.detect({ store: base.store });
  assert.equal(first.initialized, true);
  assert.deepEqual(first.fresh, [], "처음 실행에서 기존 게임을 신작으로 잡지 않음");
  assert.equal((await newGame.detect({ store: base.store })).fresh.length, 0);

  await base.store.run("SREM", "seen:games", "tetris", "reaction"); // 테스트용 신작 2개
  const { plans } = await planSlot(base.ctx, "feed", { types: ["new-game"], runner: "pc" });
  assert.equal(plans.length, 1);
  const p = plans[0];
  assert.equal(p.sourceType, "new-game");
  const order = newGame.promotable();
  const expectId = order.find((id) => id === "tetris" || id === "reaction");
  assert.equal(p.sourceId, expectId);
  assert.equal(p.kind, expectId === "reaction" ? "reel" : "image", "녹화 프로필(reaction)이 있으면 릴스, 없으면 이미지");

  const imgPlan = { slot: "feed", kind: "image", sourceType: "new-game", sourceId: "tetris", renderer: "image", channels: ["instagram"], reason: "시험" };
  const d = await produce(base.ctx, imgPlan);
  assert.equal(d.status, "READY_FOR_APPROVAL", JSON.stringify(d.failure || (d.qc && d.qc.checks.filter((c) => !c.ok))));
  assert.equal(d.source.facts.title, "블록 팡팡");
  assert.equal(d.source.facts.isNew, true);
  assert.deepEqual(d.render.files.map((f) => [f.role, f.w, f.h]), [["image", 1080, 1350]]);
  const after = await newGame.detect({ store: base.store });
  assert.ok(!after.fresh.includes("tetris"), "알린 신작은 다시 안 잡힘");
  assert.ok((await base.store.run("SMEMBERS", "seen:games")).includes("tetris"), "기준 목록으로 옮김");
  const again = await produce(base.ctx, imgPlan);
  assert.equal(again.status, "CANCELLED", "이미 알린 신작은 만들지 않음 (NO_DATA)");

  // Actions 에서는 PC 녹화 재고가 없으면 릴스 대신 이미지
  const onActions = await planSlot(base.ctx, "feed", { types: ["new-game"], runner: "actions" });
  if (onActions.plans[0] && onActions.plans[0].sourceId === "reaction") assert.equal(onActions.plans[0].kind, "image");
});

/* ---------------- Threads ---------------- */

async function threadsSetup(routes = []) {
  const base = makeCtx();
  const status = { n: 0 };
  const srv = fakeServer([
    ...routes,
    [/GET .*\/v1\.0\/me$/, () => json(200, { id: "777", username: "todaygame" })],
    [/GET .*\/777\/threads_publishing_limit$/, () => json(200, { data: [{ quota_usage: 3, config: { quota_total: 250 } }] })],
    [/POST .*\/777\/threads$/, (c) => json(200, { id: `cont-${c.params.media_type}-${crypto.randomBytes(2).toString("hex")}` })],
    [/GET .*\/v1\.0\/cont-/, () => json(200, { status: status.n++ === 0 ? "IN_PROGRESS" : "FINISHED" })],
    [/POST .*\/777\/threads_publish$/, () => json(200, { id: "th-post-1" })],
    [/GET .*\/v1\.0\/th-post-1$/, () => json(200, { id: "th-post-1", permalink: "https://www.threads.com/@todaygame/post/abc" })],
  ]);
  await threads.connectThreads(base.store, "THREADS-SECRET-TOKEN", { env: ENV, fetchImpl: srv.fetchImpl, now: Date.parse("2026-11-01T00:00:00Z") });
  const ch = threads.create({ env: ENV, store: base.store, fetchImpl: srv.fetchImpl, sleep: noSleep });
  return { ...base, srv, ch };
}

test("Threads: 토큰 암호화 저장 → 영상 컨테이너(글 + 주소 · 주제 태그 1개) → 처리 기다림 → 게시 → 다시 조회", async () => {
  const { srv, ch, store } = await threadsSetup();
  const rec = await store.getJson("channel:threads");
  assert.ok(!JSON.stringify(rec).includes("THREADS-SECRET-TOKEN"), "토큰은 암호문으로만");
  const saved = [];
  const r = await ch.publish(reelItem(), { save: async (p) => void saved.push(p) });
  assert.equal(r.postId, "th-post-1");
  const cont = srv.calls.find((c) => c.method === "POST" && /\/777\/threads$/.test(c.url));
  assert.equal(cont.params.media_type, "VIDEO");
  assert.equal(cont.params.video_url, "https://media.test/r.mp4");
  assert.match(cont.params.text, /utm_source=x$/);
  assert.ok(cont.params.text.length <= 500);
  assert.equal(cont.params.topic_tag, "오늘의게임");
  assert.equal(srv.calls.filter((c) => /cont-/.test(c.url) && c.method === "GET").length, 2, "FINISHED 까지 기다림");
  assert.deepEqual(saved.map((s) => Object.keys(s)[0]), ["containerId", "platformId"]);
  const v = await ch.verify(r.postId);
  assert.deepEqual(v, { ok: true, permalink: "https://www.threads.com/@todaygame/post/abc" });
});

test("Threads: 캐러셀은 장마다 컨테이너 → 묶음, 한도가 차면 RATE_LIMIT(다시 시도), 연결 안 됐으면 TOKEN(멈춤)", async () => {
  const { srv, ch } = await threadsSetup();
  const slides = [1, 2, 3].map((i) => ({ role: "slide", url: `https://media.test/s${i}.jpg` }));
  await ch.publish(reelItem({ kind: "carousel", files: slides }));
  const posts = srv.calls.filter((c) => c.method === "POST" && /\/777\/threads$/.test(c.url));
  assert.deepEqual(posts.map((c) => c.params.media_type), ["IMAGE", "IMAGE", "IMAGE", "CAROUSEL"]);
  assert.ok(posts.slice(0, 3).every((c) => c.params.is_carousel_item === "true"));
  assert.equal(posts[3].params.children.split(",").length, 3);

  const full = await threadsSetup([[/GET .*threads_publishing_limit$/, () => json(200, { data: [{ quota_usage: 250, config: { quota_total: 250 } }] })]]);
  await assert.rejects(full.ch.publish(reelItem()), (e) => e.kind === "RATE_LIMIT" && e.retryable === true);

  const bare = makeCtx();
  const none = threads.create({ env: ENV, store: bare.store, fetchImpl: srv.fetchImpl });
  await assert.rejects(none.publish(reelItem()), (e) => e.kind === "TOKEN" && e.retryable === false);
  await assert.rejects(ch.publish(reelItem({ kind: "story" })), (e) => e.kind === "INVALID");
});

test("Threads: 만료 7일 전부터 th_refresh_token 으로 갱신", async () => {
  const { store } = await threadsSetup();
  const srv = fakeServer([[/GET .*\/refresh_access_token$/, (c) => (c.params.grant_type === "th_refresh_token" ? json(200, { access_token: "NEW-TOKEN", expires_in: 5184000 }) : json(400, { error: { code: 100 } }))]]);
  const early = await threads.refreshThreads(store, { env: ENV, fetchImpl: srv.fetchImpl, now: Date.parse("2026-11-10T00:00:00Z") });
  assert.equal(early.action, "none");
  const r = await threads.refreshThreads(store, { env: ENV, fetchImpl: srv.fetchImpl, now: Date.parse("2026-12-26T00:00:00Z") });
  assert.equal(r.action, "refreshed");
});

/* ---------------- Facebook ---------------- */

function fbSetup(routes = [], env = {}) {
  let polls = 0;
  const srv = fakeServer([
    ...routes,
    [/POST https:\/\/graph\.facebook\.com\/v27\.0\/12345\/video_reels$/, (c) => json(200, c.params.upload_phase === "start" ? { video_id: "vid-9", upload_url: "https://rupload.facebook.com/video-upload/vid-9" } : { success: true })],
    [/POST https:\/\/rupload\.facebook\.com\/video-upload\/v27\.0\/vid-9$/, () => json(200, { success: true })],
    [/GET https:\/\/graph\.facebook\.com\/v27\.0\/vid-9$/, (c) => (c.params.fields === "status" ? json(200, { status: { video_status: polls++ ? "ready" : "processing", publishing_phase: { status: polls > 1 ? "completed" : "in_progress" } } }) : json(200, { id: "vid-9", permalink_url: "/reel/999" }))],
  ]);
  const ch = facebook.create({ env: { FACEBOOK_PAGE_ID: "12345", FACEBOOK_PAGE_TOKEN: "PAGE-SECRET", ...env }, fetchImpl: srv.fetchImpl, sleep: noSleep });
  return { srv, ch };
}

test("Facebook 릴스: start → rupload(OAuth 헤더 · file_url) → finish(PUBLISHED · 설명) → 게시 완료까지 확인 → 주소", async () => {
  const { srv, ch } = fbSetup();
  const saved = [];
  const r = await ch.publish(reelItem(), { save: async (p) => void saved.push(p) });
  assert.equal(r.postId, "vid-9");
  const up = srv.calls.find((c) => /rupload/.test(c.url));
  assert.equal(up.headers.Authorization, "OAuth PAGE-SECRET");
  assert.equal(up.headers.file_url, "https://media.test/r.mp4");
  const finish = srv.calls.find((c) => c.params.upload_phase === "finish");
  assert.equal(finish.params.video_state, "PUBLISHED");
  assert.match(finish.params.description, /#오늘의게임/);
  assert.deepEqual(saved, [{ containerId: "vid-9" }, { platformId: "vid-9" }]);
  assert.deepEqual(await ch.verify("vid-9"), { ok: true, permalink: "https://www.facebook.com/reel/999" });
  await assert.rejects(ch.publish(reelItem({ kind: "carousel" })), (e) => e.kind === "INVALID");
  const off = facebook.create({ env: {}, fetchImpl: srv.fetchImpl });
  await assert.rejects(off.publish(reelItem()), (e) => e.kind === "TOKEN" && !e.retryable);
  const bad = fbSetup([[/POST .*video_reels$/, () => json(400, { error: { code: 200, message: "권한 없음" } })]]);
  await assert.rejects(bad.ch.publish(reelItem()), (e) => e.kind === "PERMISSION" && !e.retryable && !String(e.message).includes("PAGE-SECRET"));
});

/* ---------------- YouTube ---------------- */

function ytSetup(routes = []) {
  const env = { YOUTUBE_CLIENT_ID: "cid", YOUTUBE_CLIENT_SECRET: "CLIENT-SECRET", YOUTUBE_REFRESH_TOKEN: "REFRESH-SECRET" };
  const file = path.join(TMP, `yt-${crypto.randomBytes(3).toString("hex")}.mp4`);
  fs.writeFileSync(file, crypto.randomBytes(2048));
  const srv = fakeServer([
    ...routes,
    [/POST https:\/\/oauth2\.googleapis\.com\/token$/, (c) => json(200, c.params.refresh_token === "REFRESH-SECRET" ? { access_token: "ACCESS-1", expires_in: 3599 } : { error: "invalid_grant" })],
    [/POST https:\/\/www\.googleapis\.com\/upload\/youtube\/v3\/videos$/, () => json(200, {}, { location: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=U1" })],
    [/PUT https:\/\/www\.googleapis\.com\/upload\/youtube\/v3\/videos$/, (c) => json(201, { id: "yt-abc", bytes: c.body.length })],
    [/GET https:\/\/www\.googleapis\.com\/youtube\/v3\/videos$/, (c) => json(200, { items: [c.params.part === "statistics" ? { id: "yt-abc", statistics: { viewCount: "12", likeCount: "3" } } : { id: "yt-abc", status: { uploadStatus: "processed", privacyStatus: "public" } }] })],
  ]);
  return { srv, file, ch: youtube.create({ env, fetchImpl: srv.fetchImpl }) };
}

test("YouTube Shorts: 갱신 토큰 → 이어 올리기(메타데이터 → 영상 바이트) → 확인 · 공개 통계만 · 비밀값은 오류에 안 나옴", async () => {
  const { srv, ch, file } = ytSetup();
  const r = await ch.publish(reelItem({ files: [{ role: "video", path: file, url: "https://media.test/r.mp4" }] }));
  assert.equal(r.postId, "yt-abc");
  const init = srv.calls.find((c) => c.method === "POST" && /upload/.test(c.url));
  assert.equal(init.headers.Authorization, "Bearer ACCESS-1");
  assert.equal(init.headers["X-Upload-Content-Type"], "video/mp4");
  assert.equal(init.params.uploadType, "resumable");
  assert.equal(init.params.part, "snippet,status");
  const meta = JSON.parse(init.body);
  assert.equal(meta.snippet.title, "블록 팡팡");
  assert.equal(meta.status.selfDeclaredMadeForKids, false);
  assert.equal(srv.calls.find((c) => c.method === "PUT").body.length, 2048, "로컬 파일 그대로");
  assert.deepEqual(await ch.verify("yt-abc"), { ok: true, permalink: "https://www.youtube.com/shorts/yt-abc", privacy: "public" });
  assert.deepEqual(await ch.insights("yt-abc"), [{ metric: "views", value: 12 }, { metric: "likes", value: 3 }]);

  const quota = ytSetup([[/POST https:\/\/www\.googleapis\.com\/upload/, () => json(403, { error: { message: "quota", errors: [{ reason: "quotaExceeded" }] } })]]);
  await assert.rejects(quota.ch.publish(reelItem({ files: [{ role: "video", path: quota.file }] })), (e) => e.kind === "RATE_LIMIT" && e.retryable);
  const revoked = ytSetup([[/oauth2/, () => json(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." })]]);
  await assert.rejects(revoked.ch.publish(reelItem({ files: [{ role: "video", path: revoked.file }] })), (e) => e.kind === "TOKEN" && !e.retryable && !/SECRET/.test(e.message));
  await assert.rejects(ch.publish(reelItem({ kind: "image" })), (e) => e.kind === "INVALID");
});

/* ---------------- 여러 채널 ---------------- */

test("여러 채널 동시 게시: 실제 어댑터(가짜 서버) — Facebook 성공 · YouTube 권한 실패여도 인스타 · 페북은 게시 완료", async () => {
  const base = makeCtx();
  const fb = fbSetup();
  const yt = ytSetup([[/POST https:\/\/www\.googleapis\.com\/upload/, () => json(403, { error: { message: "forbidden", errors: [{ reason: "forbidden" }] } })]]);
  base.registry.register("channel", "facebook", fb.ch);
  base.registry.register("channel", "youtube", yt.ch);
  base.registry.register("renderer", "reelWithUrl", {
    kinds: ["reel"],
    async render(s) {
      const file = path.join(TMP, `${crypto.randomBytes(4).toString("hex")}.mp4`);
      fs.writeFileSync(file, crypto.randomBytes(64));
      return { kind: "reel", files: [{ role: "video", path: file }], meta: { title: s.facts.title, durationSec: 18 } };
    },
  });
  const d = await produce(base.ctx, { slot: "feed", sourceType: "fake", renderer: "reelWithUrl", channels: ["instagram", "facebook", "youtube"], reason: "시험" });
  assert.equal(d.status, "READY_FOR_APPROVAL", JSON.stringify(d.qc && d.qc.checks.filter((c) => !c.ok)));
  await base.approval.approve(d.id, { version: d.version, ...WHO });
  base.clock.set("2026-11-09T19:05:00+09:00");
  await publishDue(base.ctx);
  const after = await base.store.getContent(d.id);
  assert.equal(after.posts.instagram.status, "PUBLISHED");
  assert.equal(after.posts.facebook.status, "PUBLISHED");
  assert.equal(after.posts.facebook.permalink, "https://www.facebook.com/reel/999");
  assert.equal(after.posts.youtube.status, "FAILED");
  assert.equal(after.posts.youtube.error.kind, "PERMISSION");
  assert.equal(after.status, "PUBLISHED", "일부 채널 실패여도 게시된 채널이 있으면 완료");
});
