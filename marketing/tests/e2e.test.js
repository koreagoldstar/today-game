"use strict";
/*
 * PHASE 11 통합 시험 — 실제 Source · 실제 이미지 렌더러 · 실제 문구(틀) · 검수 · 텔레그램(가짜 서버) · 웹 관리자 · Mock 게시 · 지표 · 주간 요약을 한 줄로.
 *  수(11/11) 아침: 편성표대로 퀴즈 캐러셀 → 텔레그램 앨범 승인 요청 → 웹에서 승인 → 19:05 Mock 게시 + 첫 댓글
 *  목(11/12) 아침: 스토리 재활용(어제 게시된 퀴즈 표지) → 텔레그램 사진 → 같은 시각 텔레그램 · 웹 동시 승인은 한 번만 → 게시
 *  월(11/16): 주간 요약 (모의 게시뿐이라 지표 없음으로)
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { makeCtx } = require("./helpers");
const { produce } = require("../core/pipeline");
const { publishDue } = require("../core/publisher");
const { planSlot } = require("../core/planner");
const { createAdmin } = require("../core/admin");
const { createTelegram } = require("../approval/telegram");
const { createCopywriter } = require("../copy/copywriter");
const insights = require("../core/insights");

const KEY = "e2e-admin-key-0123456789abcdef";

test("하루 흐름 전체: 편성 → 제작 → 승인(텔레그램 · 웹) → 게시 → 다음 날 재활용 → 주간 요약", async () => {
  const base = makeCtx({ start: "2026-11-11T08:07:00+09:00" });
  const { ctx, store, registry, clock } = base;
  for (const s of ["quiz", "fortune", "ranking", "challenge", "recycle", "new-game"]) registry.register("source", s, require(`../sources/${s}`));
  registry.register("renderer", "image", require("../renderers/image"));
  registry.register("copywriter", "default", createCopywriter({ store, env: {} }));
  const sent = [];
  const tg = createTelegram({
    store,
    approval: base.approval,
    settings: base.settings,
    token: "1:T",
    chatId: 42,
    now: clock.now,
    fetchImpl: async (url, init) => {
      const method = url.split("/").pop();
      sent.push(method);
      return { ok: true, status: 200, json: async () => ({ ok: true, result: method === "sendMediaGroup" ? [{ message_id: 1 }] : { message_id: sent.length } }) };
    },
  });
  registry.register("notifier", "default", tg.notifier);
  const admin = createAdmin({ store, env: { MKT_ADMIN_KEY: KEY }, now: clock.now });
  const h = { authorization: `Bearer ${(await admin.handle({ method: "POST", body: { action: "login", key: KEY } })).body.token}` };
  // 재활용이 표지를 내려받을 때: 테스트용 공개 주소 → 실제로 만든 파일
  ctx.fetchImpl = async (url) => {
    const f = (await store.listContents(50)).flatMap((d) => (d.render && d.render.files) || []).find((x) => x.url === url);
    return { ok: !!f, status: f ? 200 : 404, arrayBuffer: async () => fs.readFileSync(f.path) };
  };

  // 수요일 아침: 편성표 → 퀴즈 캐러셀
  const wed = await planSlot(ctx, "feed");
  assert.equal(wed.plans[0].sourceType, "quiz");
  const quiz = await produce(ctx, wed.plans[0]);
  assert.equal(quiz.status, "READY_FOR_APPROVAL", JSON.stringify(quiz.failure || (quiz.qc && quiz.qc.checks.filter((c) => !c.ok))));
  assert.ok(sent.includes("sendMediaGroup"), "텔레그램 앨범 승인 요청");
  assert.match(quiz.copy.instagram.caption, /정답은 첫 댓글/);
  assert.equal((await admin.handle({ method: "POST", body: { action: "approve", id: quiz.id, version: quiz.version }, headers: h })).status, 200);
  clock.set("2026-11-11T18:00:00+09:00");
  await publishDue(ctx);
  assert.equal((await store.getContent(quiz.id)).status, "SCHEDULED", "19:00 전에는 게시 안 함");
  clock.set("2026-11-11T19:05:00+09:00");
  await publishDue(ctx);
  const q2 = await store.getContent(quiz.id);
  assert.equal(q2.status, "PUBLISHED");
  assert.equal(q2.posts.instagram.mock, true);
  assert.match(q2.posts.instagram.commentId, /^mock-comment-/);
  assert.ok(sent.filter((m) => m === "sendMessage").length >= 2, "게시 완료 알림");

  // 목요일 아침: 스토리 재활용
  clock.set("2026-11-12T08:07:00+09:00");
  const story = await planSlot(ctx, "story", { types: ["recycle"] });
  const re = await produce(ctx, story.plans[0]);
  assert.equal(re.status, "READY_FOR_APPROVAL", JSON.stringify(re.failure || (re.qc && re.qc.checks.filter((c) => !c.ok))));
  assert.equal(re.source.facts.feedId, quiz.id);
  assert.ok(sent.includes("sendPhoto"));
  const [a, b] = await Promise.allSettled([base.approval.approve(re.id, { version: re.version, by: "admin", via: "telegram" }), admin.handle({ method: "POST", body: { action: "approve", id: re.id, version: re.version }, headers: h })]);
  const okCount = Number(a.status === "fulfilled") + Number(b.status === "fulfilled" && b.value.status === 200);
  assert.equal(okCount, 1, "동시 승인은 하나만");
  const r2 = await store.getContent(re.id);
  assert.equal(r2.scheduledAt, new Date("2026-11-12T08:30:00+09:00").toISOString(), "스토리 08:30");
  clock.set("2026-11-12T08:35:00+09:00");
  await publishDue(ctx);
  assert.equal((await store.getContent(re.id)).status, "PUBLISHED");

  // 관리자 화면 · 지표 · 주간 요약
  const ov = await admin.handle({ method: "GET", query: { op: "overview" }, headers: h });
  assert.equal(ov.body.count.published, 2);
  assert.deepEqual(await insights.collectInsights(ctx, Date.parse("2026-11-15T00:00:00+09:00")), [], "모의 게시는 지표를 만들지 않음");
  const weekly = await insights.weeklyReport(ctx, Date.parse("2026-11-16T08:40:00+09:00"));
  assert.match(weekly.text, /게시 2건 — 실제 0 · 모의 2/);
  assert.match(weekly.text, /모의 게시는 지표가 없습니다/);
  const keys = [...base.fake.keysSeen];
  assert.ok(keys.every((k) => k.startsWith("todaygame:mkt:")), `마케팅 키만: ${keys.filter((k) => !k.startsWith("todaygame:mkt:")).join(",")}`);
});
