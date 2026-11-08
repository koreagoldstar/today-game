"use strict";
/* PHASE 2 — 가짜 Source → 가짜 Renderer → QC → 승인 대기 → Mock 게시, 그리고 승인 · 중복 · 실패 규칙 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeCtx, PLAN, WHO } = require("./helpers");
const { produce, runQueued } = require("../core/pipeline");
const { publishDue } = require("../core/publisher");

const H = 3600 * 1000;

test("제작 흐름: 단계를 건너뛰지 않고 승인 대기까지 간다", async () => {
  const { ctx, events } = makeCtx();
  const doc = await produce(ctx, PLAN);
  assert.equal(doc.status, "READY_FOR_APPROVAL");
  assert.deepEqual(
    doc.history.map((h) => h.to),
    ["PLANNED", "COLLECTING", "RENDERING", "COPYWRITING", "QC", "READY_FOR_APPROVAL"]
  );
  assert.equal(doc.qc.passed, true);
  assert.ok(doc.render.files[0].url.startsWith("https://media.test/"));
  assert.ok(doc.render.files[0].sha256);
  assert.match(doc.copy.instagram.link, /utm_source=instagram/);
  assert.deepEqual(events.map((e) => e.event), ["ready"]);
});

test("승인하지 않으면 아무리 시간이 지나도 게시하지 않고, 72시간 뒤 EXPIRED", async () => {
  const { ctx, clock, instagram, store, events } = makeCtx();
  const doc = await produce(ctx, PLAN);
  clock.add(48 * H);
  await publishDue(ctx);
  assert.equal((await store.getContent(doc.id)).status, "READY_FOR_APPROVAL");
  clock.add(25 * H);
  const r = await publishDue(ctx);
  assert.deepEqual(r.expired, [doc.id]);
  assert.equal((await store.getContent(doc.id)).status, "EXPIRED");
  assert.equal(instagram.published, 0);
  assert.ok(events.some((e) => e.event === "expired"));
});

test("승인 → 예약 시각 전에는 게시 안 함 → 시각이 지나면 Mock 게시 + 다시 조회", async () => {
  const { ctx, clock, approval, instagram, store } = makeCtx(); // 시작 09:00 KST
  const doc = await produce(ctx, PLAN);
  const ok = await approval.approve(doc.id, { version: doc.version, ...WHO });
  assert.equal(ok.status, "SCHEDULED");
  assert.equal(ok.scheduledAt, "2026-11-09T10:00:00.000Z"); // 기본 19:00 KST
  assert.equal(ok.approval.version, 1);
  await publishDue(ctx);
  assert.equal(instagram.published, 0, "예약 시각 전");
  clock.set("2026-11-09T19:05:00+09:00");
  const r = await publishDue(ctx);
  assert.deepEqual(r.published, [doc.id]);
  const after = await store.getContent(doc.id);
  assert.equal(after.status, "PUBLISHED");
  assert.equal(after.posts.instagram.status, "PUBLISHED");
  assert.match(after.posts.instagram.platformId, /^mock-post-/);
  assert.equal(after.posts.instagram.mock, true);
  assert.equal(instagram.published, 1);
});

test("승인 뒤 문구를 고치면 승인이 무효 → 옛 버전으로는 승인 안 됨 → 다시 승인해야 게시", async () => {
  const { ctx, clock, approval, instagram, store } = makeCtx();
  const doc = await produce(ctx, PLAN);
  await approval.approve(doc.id, { version: 1, ...WHO });
  const edited = await approval.editCopy(doc.id, { version: 1, channel: "instagram", caption: "새 문구로 바꿨어요", ...WHO });
  assert.equal(edited.status, "READY_FOR_APPROVAL");
  assert.equal(edited.version, 2);
  assert.equal(edited.approval, null);
  clock.set("2026-11-09T20:00:00+09:00");
  await publishDue(ctx);
  assert.equal(instagram.published, 0, "재승인 전에는 게시 안 됨");
  await assert.rejects(() => approval.approve(doc.id, { version: 1, ...WHO }), { code: "STALE" });
  await approval.approve(doc.id, { version: 2, ...WHO }); // 20:00 이 지나 다음 자리 = 다음 날 19:00
  clock.set("2026-11-10T19:01:00+09:00");
  await publishDue(ctx);
  const after = await store.getContent(doc.id);
  assert.equal(after.status, "PUBLISHED");
  assert.equal(instagram.published, 1);
});

test("게시 시각 · 채널을 바꿔도 승인이 무효", async () => {
  const { ctx, approval } = makeCtx();
  const doc = await produce(ctx, PLAN);
  await approval.approve(doc.id, { version: 1, ...WHO });
  const t = await approval.setTime(doc.id, { version: 1, scheduledAt: "2026-11-09T21:00:00+09:00", ...WHO });
  assert.equal(t.status, "READY_FOR_APPROVAL");
  assert.equal(t.version, 2);
  const again = await approval.approve(doc.id, { version: 2, scheduledAt: "2026-11-09T21:00:00+09:00", ...WHO });
  assert.equal(again.version, 2, "승인 자체는 버전을 바꾸지 않음");
  await assert.rejects(() => approval.setChannels(doc.id, { version: 2, channels: ["instagram", "threads"], ...WHO }), /threads 문구가 없습니다/);
  const ch = await approval.setChannels(doc.id, { version: 2, channels: ["instagram"], ...WHO });
  assert.equal(ch.status, "READY_FOR_APPROVAL");
  assert.equal(ch.version, 3);
});

test("같은 게시를 두 번 · 동시에 돌려도 플랫폼에는 한 번만 올라간다", async () => {
  const { ctx, clock, approval, instagram, store } = makeCtx();
  const doc = await produce(ctx, PLAN);
  await approval.approve(doc.id, { version: 1, ...WHO });
  clock.set("2026-11-09T19:10:00+09:00");
  const [a, b] = await Promise.all([publishDue(ctx), publishDue(ctx)]);
  assert.ok([a, b].some((r) => r.skipped), "하나는 잠금에 막힘");
  await publishDue(ctx);
  await publishDue(ctx);
  assert.equal(instagram.published, 1);
  assert.ok(await store.getJson(`idem:${doc.id}:instagram:v1`));
});

test("텔레그램과 웹에서 동시에 승인해도 한 번만 반영", async () => {
  const { ctx, approval, store } = makeCtx();
  const doc = await produce(ctx, PLAN);
  const rs = await Promise.allSettled([
    approval.approve(doc.id, { version: 1, by: "admin", via: "telegram" }),
    approval.approve(doc.id, { version: 1, by: "admin", via: "web" }),
  ]);
  assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1);
  const after = await store.getContent(doc.id);
  assert.equal(after.history.filter((h) => h.to === "APPROVED").length, 1);
  // 반려도 이미 승인된 것에는 안 먹음
  await assert.rejects(() => approval.reject(doc.id, { version: 1, reason: "늦은 반려", ...WHO }));
});

test("반려 · 취소", async () => {
  const { ctx, approval } = makeCtx();
  const a = await produce(ctx, PLAN);
  await assert.rejects(() => approval.reject(a.id, { version: 1, reason: " ", ...WHO }), /사유/);
  assert.equal((await approval.reject(a.id, { version: 1, reason: "화면이 어두움", ...WHO })).status, "REJECTED");
  const b = await produce(ctx, PLAN);
  await approval.approve(b.id, { version: 1, ...WHO });
  assert.equal((await approval.cancel(b.id, { version: 1, ...WHO })).status, "CANCELLED");
});

test("하루 상한: 같은 날 같은 자리는 하나만 승인, 자동이면 다음 날로", async () => {
  const { ctx, approval } = makeCtx();
  const a = await produce(ctx, PLAN);
  const b = await produce(ctx, PLAN);
  await approval.approve(a.id, { version: 1, ...WHO });
  await assert.rejects(() => approval.approve(b.id, { version: 1, scheduledAt: "2026-11-09T21:00:00+09:00", ...WHO }), /자리가 이미 찼습니다/);
  const ok = await approval.approve(b.id, { version: 1, ...WHO });
  assert.equal(ok.scheduledAt, "2026-11-10T10:00:00.000Z");
});

test("검수 불합격(직전과 같은 파일)이면 2번 다시 만들고 그래도 안 되면 FAILED", async () => {
  const { ctx, events, counts } = makeCtx({ sameBytes: true });
  const first = await produce(ctx, PLAN);
  assert.equal(first.status, "READY_FOR_APPROVAL");
  const second = await produce(ctx, PLAN);
  assert.equal(second.status, "FAILED");
  assert.equal(second.failure.stage, "QC");
  assert.match(second.failure.reason, /같은 파일/);
  assert.equal(second.history.filter((h) => h.from === "QC" && h.to === "RENDERING").length, 2);
  assert.equal(counts().renders, 1 + 3);
  assert.ok(events.some((e) => e.event === "failed" && e.id === second.id));
});

test("한 채널이 실패해도 다른 채널은 게시된다", async () => {
  const { ctx, clock, approval, store, instagram } = makeCtx({ failThreads: { kind: "PERMISSION", retryable: false } });
  const doc = await produce(ctx, { ...PLAN, channels: ["instagram", "threads"] });
  await approval.approve(doc.id, { version: 1, ...WHO });
  clock.set("2026-11-09T19:30:00+09:00");
  await publishDue(ctx);
  const after = await store.getContent(doc.id);
  assert.equal(after.posts.instagram.status, "PUBLISHED");
  assert.equal(after.posts.threads.status, "FAILED");
  assert.equal(after.posts.threads.error.kind, "PERMISSION");
  assert.equal(after.status, "PUBLISHED");
  assert.equal(instagram.published, 1);
});

test("일시적 실패는 백오프 뒤 다시 시도, 횟수를 넘으면 FAILED", async () => {
  const { ctx, clock, approval, store } = makeCtx({ failInstagram: { kind: "RATE_LIMIT", retryable: true, times: 1 } });
  const doc = await produce(ctx, PLAN);
  await approval.approve(doc.id, { version: 1, ...WHO });
  clock.set("2026-11-09T19:00:30+09:00");
  await publishDue(ctx);
  let d = await store.getContent(doc.id);
  assert.equal(d.status, "SCHEDULED");
  assert.equal(d.posts.instagram.status, "PENDING");
  assert.equal(Date.parse(d.posts.instagram.nextTryAt) - clock.now(), 15 * 60000);
  clock.add(10 * 60000);
  await publishDue(ctx);
  assert.equal((await store.getContent(doc.id)).posts.instagram.status, "PENDING", "백오프 시간 전");
  clock.add(6 * 60000);
  await publishDue(ctx);
  d = await store.getContent(doc.id);
  assert.equal(d.status, "PUBLISHED");
  assert.equal(d.posts.instagram.attempts, 2);

  const bad = makeCtx({ failInstagram: { kind: "UNKNOWN", retryable: true } });
  const x = await produce(bad.ctx, PLAN);
  await bad.approval.approve(x.id, { version: 1, ...WHO });
  bad.clock.set("2026-11-09T19:00:30+09:00");
  for (let i = 0; i < 4; i++) {
    await publishDue(bad.ctx);
    bad.clock.add(3 * H);
  }
  const y = await bad.store.getContent(x.id);
  assert.equal(y.status, "FAILED");
  assert.equal(y.posts.instagram.attempts, 3);
  assert.equal(y.failure.stage, "PUBLISH");
  assert.ok(bad.events.some((e) => e.event === "publish_failed"));
});

test("게시 도중 멈춘 경우: 플랫폼 id 가 저장돼 있으면 다시 올리지 않고 이어서 완료", async () => {
  const { ctx, clock, approval, store, instagram } = makeCtx();
  const doc = await produce(ctx, PLAN);
  await approval.approve(doc.id, { version: 1, ...WHO });
  // 게시 id 를 받은 직후 작업이 죽은 상태를 만든다
  await store.updateContent(doc.id, (d) => {
    d.status = "PUBLISHING";
    d.posts.instagram = { status: "PUBLISHING", attempts: 1, containerId: "mock-container-x", platformId: "mock-post-crashed" };
  });
  clock.set("2026-11-09T19:20:00+09:00");
  await publishDue(ctx);
  const after = await store.getContent(doc.id);
  assert.equal(after.status, "PUBLISHED");
  assert.equal(after.posts.instagram.platformId, "mock-post-crashed");
  assert.equal(instagram.published, 0, "다시 올리지 않음");
});

test("중간에 멈춘 제작은 다음 실행이 FAILED 로 정리", async () => {
  const { ctx, clock, store } = makeCtx();
  const doc = await produce(ctx, PLAN);
  await store.updateContent(doc.id, (d) => {
    d.status = "RENDERING";
    d.updatedAt = new Date(clock.now()).toISOString();
  });
  clock.add(4 * H);
  const r = await publishDue(ctx);
  assert.deepEqual(r.interrupted, [doc.id]);
  const after = await store.getContent(doc.id);
  assert.equal(after.status, "FAILED");
  assert.match(after.failure.reason, /멈춤/);
});

test("문구 다시 만들기: 승인 무효 → 작업 서버가 이어서 만들어 다시 승인 대기", async () => {
  const { ctx, approval, counts } = makeCtx();
  const doc = await produce(ctx, PLAN);
  await approval.approve(doc.id, { version: 1, ...WHO });
  const q = await approval.redo(doc.id, { version: 1, stage: "copy", ...WHO });
  assert.equal(q.status, "COPYWRITING");
  assert.equal(q.approval, null);
  const [done] = await runQueued(ctx);
  assert.equal(done.status, "READY_FOR_APPROVAL");
  assert.ok(done.version >= 2);
  assert.equal(counts().copies, 2);
  assert.equal(counts().renders, 1, "문구만 다시");
});
