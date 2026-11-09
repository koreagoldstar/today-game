"use strict";
/* PHASE 7 — 이미지 콘텐츠: 퀴즈 캐러셀 · 운세 · 랭킹 · 챌린지 · 스토리 재활용, 요일 편성, 그날만 맞는 콘텐츠, 첫 댓글 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { makeCtx, WHO, TMP } = require("./helpers");
const { produce } = require("../core/pipeline");
const { publishDue } = require("../core/publisher");
const { planSlot, produceGate } = require("../core/planner");
const { nextSlot } = require("../core/approval");
const { isExpired } = require("../core/state");
const { DEFAULTS, merge, validate } = require("../core/settings");
const { literal } = require("../sources/site-data");
const quiz = require("../sources/quiz");
const fortune = require("../sources/fortune");
const ranking = require("../sources/ranking");
const challenge = require("../sources/challenge");
const image = require("../renderers/image");
const { templateCopy, checkAi } = require("../copy/copywriter");
const { createTelegram } = require("../approval/telegram");

const ROOT = path.resolve(__dirname, "../..");
const SOURCES = ["quiz", "fortune", "ranking", "challenge", "recycle"];
const plan = (sourceType, kind, slot = kind === "story" ? "story" : "feed") => ({ slot, kind, sourceType, sourceId: sourceType, renderer: "image", channels: ["instagram"], reason: "시험" });

function withImage(base) {
  for (const s of SOURCES) base.registry.register("source", s, require(`../sources/${s}`));
  base.registry.register("renderer", "image", image);
  return base;
}

test("퀴즈: 사이트 문항 · 정답 그대로, 90일 안에 쓴 문제는 다시 안 씀", async () => {
  const { store, clock } = makeCtx();
  const a = await quiz.collect({ store, now: clock.now });
  const b = await quiz.collect({ store, now: clock.now });
  const bank = quiz.bank();
  assert.equal(a.facts.questions.length, 4);
  for (const q of a.facts.questions) {
    const src = bank.find((x) => x.q === q.q);
    assert.ok(src, "사이트 문항에 있는 문제");
    assert.equal(q.answer, src.a[src.c]);
    assert.equal(JSON.stringify(q.a), JSON.stringify(src.a));
  }
  assert.ok(!b.facts.questions.some((q) => a.facts.questions.some((x) => x.id === q.id)), "같은 문제를 다시 쓰지 않음");
});

test("운세: 사이트 문구 · 날짜 계산 그대로 (같은 날은 누구에게나 같은 결과)", () => {
  const d = fortune.todays("2026-11-09");
  assert.deepEqual(fortune.todays("2026-11-09"), d);
  const CATS = literal("games/fortune-draw/game.js", "CATS");
  for (const [k, v] of Object.entries(d)) assert.ok(CATS[k].pool.some((p) => p.t === v.t && p.d === v.d), `${k} 문구가 사이트 목록에 있음`);
});

test("랭킹: 지난주 실제 기록만 · 낮을수록 좋은 게임 순서 · 닉네임 가림 · 사이트 표시 단위 · 모자라면 만들지 않음", async () => {
  const { store, fake, settings, clock } = makeCtx(); // 2026-11-09(월) → 지난주 2026-W45
  await assert.rejects(ranking.collect({ store, settings, now: clock.now }), (e) => e.code === "NO_DATA");
  const list = [["삐약이", 300], ["토끼", 120], ["가나다라", 55], ["abc", 999], ["zz", 400]].map(([name, score]) => ({ name, score }));
  fake.data.set("todaygame:scores:10-second:week:2026-W45", { t: "s", v: JSON.stringify(list), exp: 0 });
  const r = await ranking.collect({ store, settings, now: clock.now });
  assert.equal(r.facts.week, "2026-W45");
  assert.match(r.facts.title, /지난주/);
  const g = r.facts.games.find((x) => x.id === "10-second");
  assert.deepEqual(g.top.map((t) => t.name), ["가**라", "토*", "삐*이"]);
  assert.deepEqual(g.top.map((t) => t.text), ["0.055초", "0.120초", "0.300초"]);
  assert.equal(g.entries, 5);
  const site = [...fake.keysSeen].filter((k) => !k.startsWith("todaygame:mkt:"));
  assert.ok(site.length && site.every((k) => /^todaygame:scores:[\w-]+:week:2026-W45$/.test(k)), "사이트 키는 지난주 랭킹만 (readSite 는 GET 만)");
});

test("챌린지: 운영 /api/challenge 를 GET 으로만 읽고, 참여 0명이면 숫자를 넣지 않음", async () => {
  const seen = [];
  const fetchImpl = async (url, init = {}) => {
    seen.push([url, init.method || "GET"]);
    return { ok: true, json: async () => ({ day: "2026-11-09", game: { id: "reaction", title: "반응속도 테스트", href: "/games/reaction/" }, participants: 0 }) };
  };
  const r = await challenge.collect({ fetchImpl });
  assert.deepEqual(seen, [["https://www.todaygame.co.kr/api/challenge", "GET"]]);
  assert.equal(r.facts.game, "반응속도 테스트");
  assert.equal("participants" in r.facts, false);
});

test("편성: 월=랭킹→릴스, 수=퀴즈 캐러셀, 금=신작은 Source 없으면 건너뜀, 스토리는 날마다 돌아가며 · 인스타만 · 그날만 맞는 표시", async () => {
  const base = withImage(makeCtx({ settings: { channels: ["instagram", "threads"] } }));
  base.registry.register("source", "game", require("../sources/game"));
  const at = (iso) => ({ now: Date.parse(iso), runner: "pc" });
  const mon = await planSlot(base.ctx, "feed", at("2026-11-09T08:10:00+09:00"));
  assert.deepEqual(mon.plans.map((p) => [p.sourceType, p.kind]), [["ranking", "image"], ["game", "reel"]]);
  const wed = await planSlot(base.ctx, "feed", at("2026-11-11T08:10:00+09:00"));
  assert.deepEqual(wed.plans.map((p) => [p.sourceType, p.kind, p.renderer]), [["quiz", "carousel", "image"]]);
  assert.deepEqual(wed.plans[0].channels, ["instagram", "threads"]);
  const fri = await planSlot(base.ctx, "feed", at("2026-11-13T08:10:00+09:00"));
  assert.deepEqual(fri.plans.map((p) => p.sourceType), ["game"]);
  const s1 = await planSlot(base.ctx, "story", at("2026-11-09T08:10:00+09:00"));
  const s2 = await planSlot(base.ctx, "story", at("2026-11-10T08:10:00+09:00"));
  assert.equal(s1.plans.length, 3);
  assert.notEqual(s1.plans[0].sourceType, s2.plans[0].sourceType, "날마다 다른 유형부터");
  assert.ok(s1.plans.every((p) => p.kind === "story" && p.slot === "story" && p.channels.join() === "instagram"), "스레드는 스토리를 못 받음");
  assert.equal(s1.plans.find((p) => p.sourceType === "fortune").validDay, "2026-11-09");
  assert.equal(s1.plans.find((p) => p.sourceType === "recycle").validDay, undefined);
  const s = validate(merge(DEFAULTS, {}));
  assert.equal(produceGate([{ dateKey: "2026-11-09", slot: "feed", status: "READY_FOR_APPROVAL" }], s, "2026-11-09", "story").ok, true, "피드가 있어도 스토리는 따로");
  assert.equal(produceGate([{ dateKey: "2026-11-09", slot: "story", status: "SCHEDULED" }], s, "2026-11-09", "story").ok, false);
});

test("자료가 모자라면(NO_DATA) 실패 알림 없이 취소 — 다음 후보로 넘어갈 수 있게", async () => {
  const base = withImage(makeCtx());
  const d = await produce(base.ctx, plan("ranking", "image"));
  assert.equal(d.status, "CANCELLED");
  assert.match(d.skipped, /기준/);
  assert.deepEqual(base.events, [], "실패 알림 없음");
  const r = await produce(base.ctx, plan("recycle", "story"));
  assert.equal(r.status, "CANCELLED", "게시된 피드가 없으면 재활용 안 함");
});

test("그날만 맞는 콘텐츠(운세 · 챌린지): 시각이 지났으면 10분 뒤, 다음 날로 미루지 않고, 날이 지나면 기한 지남", () => {
  const s = validate(merge(DEFAULTS, {}));
  const doc = { slot: "story", channels: ["instagram"], plan: { validDay: "2026-11-09" }, status: "READY_FOR_APPROVAL", readyAt: "2026-11-08T23:10:00Z" };
  const t = Date.parse("2026-11-09T10:00:00+09:00");
  assert.equal(nextSlot(s, doc, {}, t), new Date(t + 600000).toISOString());
  assert.equal(nextSlot(s, doc, {}, Date.parse("2026-11-09T07:00:00+09:00")), new Date("2026-11-09T08:30:00+09:00").toISOString());
  assert.throws(() => nextSlot(s, doc, {}, Date.parse("2026-11-10T07:00:00+09:00")), /2026-11-09 에만/);
  assert.throws(() => nextSlot(s, doc, { "2026-11-09": 1 }, t), /자리가 이미/);
  assert.equal(isExpired(doc, Date.parse("2026-11-09T23:59:00+09:00")), false);
  assert.equal(isExpired(doc, Date.parse("2026-11-10T00:01:00+09:00")), true);
});

test("퀴즈 캐러셀: 실제로 그려 검수 통과 → 텔레그램 앨범 → 승인 → 게시 뒤 첫 댓글에 정답", async () => {
  const base = withImage(makeCtx());
  const sent = [];
  const fetchImpl = async (url, init) => {
    const method = url.split("/").pop();
    let params = {};
    if (init.body instanceof FormData) for (const [k, v] of init.body.entries()) params[k] = typeof v === "string" ? v : "[파일]";
    else params = JSON.parse(init.body);
    sent.push({ method, params });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: method === "sendMediaGroup" ? [{ message_id: 1 }] : { message_id: sent.length + 10 } }) };
  };
  const tg = createTelegram({ store: base.store, approval: base.approval, settings: base.settings, token: "1:T", chatId: 42, fetchImpl, logger: base.ctx.logger, now: base.clock.now });
  base.registry.register("notifier", "default", tg.notifier);

  const d = await produce(base.ctx, plan("quiz", "carousel"));
  assert.equal(d.status, "READY_FOR_APPROVAL", JSON.stringify(d.failure || (d.qc && d.qc.checks.filter((c) => !c.ok))));
  assert.equal(d.render.kind, "carousel");
  assert.equal(d.render.files.length, 6, "표지 + 4문제 + 마지막 장");
  assert.ok(d.render.files.every((f) => f.role === "slide" && f.w === 1080 && f.h === 1350 && f.url));
  assert.ok(d.qc.checks.some((c) => c.id === "i:count" && c.ok) && d.qc.checks.some((c) => c.id === "text:overflow" && c.ok));
  for (const q of d.source.facts.questions) assert.ok(d.render.meta.comment.includes(q.answer), "정답은 첫 댓글에");

  const album = sent.find((c) => c.method === "sendMediaGroup");
  assert.ok(album, "승인 요청에 앨범");
  assert.equal(JSON.parse(album.params.media).length, 6);
  assert.match(sent.find((c) => c.method === "sendMessage").params.text, /첫 댓글/);

  await base.approval.approve(d.id, { version: d.version, ...WHO });
  base.clock.set("2026-11-09T19:05:00+09:00");
  await publishDue(base.ctx);
  const after = await base.store.getContent(d.id);
  assert.equal(after.status, "PUBLISHED");
  assert.match(after.posts.instagram.commentId, /^mock-comment-/);
});

test("첫 댓글이 실패해도 게시는 완료로 남고 이유만 기록", async () => {
  const base = makeCtx();
  base.registry.register("renderer", "withComment", {
    kinds: ["reel"],
    async render(s) {
      const file = path.join(TMP, `${crypto.randomBytes(4).toString("hex")}.mp4`);
      fs.writeFileSync(file, crypto.randomBytes(64));
      return { kind: "reel", files: [{ role: "video", path: file }], meta: { title: s.facts.title, durationSec: 18, comment: "정답: 1번" } };
    },
  });
  base.instagram.comment = async () => {
    throw new Error("권한 없음 (instagram_business_manage_comments)");
  };
  const d = await produce(base.ctx, { slot: "feed", sourceType: "fake", renderer: "withComment", channels: ["instagram"], reason: "시험" });
  await base.approval.approve(d.id, { version: d.version, ...WHO });
  base.clock.set("2026-11-09T19:05:00+09:00");
  await publishDue(base.ctx);
  const after = await base.store.getContent(d.id);
  assert.equal(after.status, "PUBLISHED");
  assert.match(after.posts.instagram.commentError, /권한 없음/);
});

test("운세 스토리 · 스토리 재활용: 1080x1920 한 장, 재활용은 최근 게시된 피드 커버로 (한 번만)", async () => {
  const base = withImage(makeCtx());
  const fo = await produce(base.ctx, plan("fortune", "story"));
  assert.equal(fo.status, "READY_FOR_APPROVAL", JSON.stringify(fo.failure || (fo.qc && fo.qc.checks.filter((c) => !c.ok))));
  assert.deepEqual(fo.render.files.map((f) => [f.role, f.w, f.h]), [["image", 1080, 1920]]);
  assert.equal(fo.plan.validDay, undefined, "plan 을 직접 줄 때는 그대로");

  const coverFile = path.join(ROOT, "games/basketball-shootout/assets/court.jpg");
  await base.store.saveContent({ id: "2026-11-08-feed-aaaaaa", slot: "feed", dateKey: "2026-11-08", status: "PUBLISHED", createdAt: "2026-11-08T00:00:00Z", updatedAt: "2026-11-08T10:05:00Z", source: { sourceType: "game", facts: { url: "/games/demo/" } }, render: { kind: "reel", meta: { title: "데모 게임" }, files: [{ role: "cover", url: "https://media.test/cover.jpg" }] } });
  base.ctx.fetchImpl = async (url) => {
    assert.equal(url, "https://media.test/cover.jpg");
    return { ok: true, arrayBuffer: async () => fs.readFileSync(coverFile) };
  };
  const re = await produce(base.ctx, plan("recycle", "story"));
  assert.equal(re.status, "READY_FOR_APPROVAL", JSON.stringify(re.failure || (re.qc && re.qc.checks.filter((c) => !c.ok))));
  assert.equal(re.source.facts.feedId, "2026-11-08-feed-aaaaaa");
  const again = await produce(base.ctx, plan("recycle", "story"));
  assert.equal(again.status, "CANCELLED", "같은 피드는 한 번만 재활용");
});

test("문구: 유형별 틀 문구 · AI 가 퀴즈 정답을 캡션에 쓰면 거부", () => {
  const facts = { title: "오늘의 상식퀴즈", url: "/games/wisdom-quiz/", questions: [{ id: "a", q: "콜롬비아의 수도는?", a: ["베이징", "보고타"], c: 1, answer: "보고타" }] };
  const out = templateCopy({ source: { sourceType: "quiz", sourceId: "q", facts }, render: { kind: "carousel", meta: {} }, channels: ["instagram", "threads"] });
  assert.match(out.instagram.caption, /정답은 첫 댓글/);
  assert.ok(!out.instagram.caption.includes("보고타"));
  assert.ok(out.instagram.hashtags.includes("#상식퀴즈") && out.instagram.hashtags.length >= 5 && out.instagram.hashtags.length <= 10);
  const ai = { instagram: { caption: "오늘의 상식퀴즈! 정답은 보고타\n프로필 링크에서 플레이!", hashtags: ["#오늘의게임", "#a", "#b", "#c", "#d"] } };
  assert.ok(checkAi(ai, { source: { sourceType: "quiz", facts }, channels: ["instagram"], recent: [] }).some((x) => /정답/.test(x)));
});
