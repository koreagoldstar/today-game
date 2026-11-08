"use strict";
/*
 * 제작 흐름: PLANNED → COLLECTING(Source) → RENDERING(Renderer) → COPYWRITING(Copywriter) → QC → READY_FOR_APPROVAL
 *  - 단계 전환은 잠금 안에서 짧게, 오래 걸리는 일(녹화 · 렌더 · AI)은 잠금 밖에서.
 *  - 일하는 사이 관리자가 취소했으면(상태가 바뀌었으면) 결과를 버리고 멈춘다.
 *  - 검수 불합격이면 최대 settings.qc.maxRedo 번 다시 만들고, 그래도 안 되면 FAILED.
 */
const crypto = require("crypto");
const { transition, MAKING } = require("./state");
const { runQc } = require("./qc");
const { seoulDay } = require("./settings");

class Abort extends Error {}

function newContent(plan, { now = Date.now(), by = "planner" } = {}) {
  const at = new Date(now).toISOString();
  const day = seoulDay(now);
  return {
    id: `${day}-${plan.slot || "feed"}-${crypto.randomBytes(3).toString("hex")}`,
    dateKey: day,
    slot: plan.slot || "feed",
    status: "PLANNED",
    version: 1,
    plan,
    channels: plan.channels,
    createdAt: at,
    updatedAt: at,
    history: [{ from: null, to: "PLANNED", at, by, note: plan.reason || "" }],
    redoCount: 0,
    source: null,
    render: null,
    copy: null,
    qc: null,
    approval: null,
    rejection: null,
    scheduledAt: null,
    posts: {},
    failure: null,
    redo: null,
  };
}

function checkSource(s) {
  if (!s || !s.sourceType || !s.sourceId || !s.facts || typeof s.facts !== "object") throw new Error("Source 결과에 sourceType · sourceId · facts 가 없습니다.");
  return s;
}
function checkRender(r, renderer) {
  if (!r || !renderer.kinds.includes(r.kind) || !Array.isArray(r.files)) throw new Error("Renderer 결과 형식이 올바르지 않습니다 (kind · files).");
  return r;
}
function checkCopy(copy, channels) {
  const missing = channels.filter((ch) => !copy || !copy[ch]);
  if (missing.length) throw new Error(`문구가 없는 채널: ${missing.join(", ")}`);
  return copy;
}

async function notify(ctx, event, doc) {
  if (!ctx.registry.has("notifier", "default")) return;
  await ctx.registry.get("notifier", "default").notify(event, doc).catch((e) => ctx.logger && ctx.logger.warn(`알림 실패: ${e.message}`));
}

/** 잠금 안에서: 상태가 expect 그대로일 때만 patch 를 넣고 다음 상태로 */
const nowOf = (ctx) => (ctx.now ? ctx.now() : Date.now());

function advance(ctx, id, expect, to, patch = {}, note = "") {
  return ctx.store.updateContent(id, (doc) => {
    if (doc.status !== expect) throw new Abort(`상태가 바뀌어 멈춤 (${expect} → ${doc.status})`);
    Object.assign(doc, patch);
    transition(doc, to, { by: "worker", note, now: nowOf(ctx) });
  });
}

async function recentFirstLines(store, exceptId) {
  const list = await store.listContents(20);
  return list
    .filter((d) => d.id !== exceptId && d.copy)
    .flatMap((d) => Object.values(d.copy).map((c) => String((c && c.caption) || "").split("\n")[0].trim()))
    .filter(Boolean);
}

async function uploadMedia(ctx, doc) {
  if (!ctx.registry.has("media", "default")) return doc.render.files;
  const media = ctx.registry.get("media", "default");
  const out = [];
  for (const f of doc.render.files) out.push({ ...f, ...(await media.put(f, { contentId: doc.id })) });
  return out;
}

/**
 * 이어서 만들기: doc 의 지금 상태(COLLECTING 직전 · RENDERING · COPYWRITING)부터 끝까지
 * @param ctx { store, registry, settings, logger }
 */
async function runFrom(ctx, id) {
  const { store, registry, settings } = ctx;
  let doc = await store.getContent(id);
  try {
    if (doc.status === "PLANNED") {
      doc = await advance(ctx, id, "PLANNED", "COLLECTING", { redo: null });
      const source = checkSource(await registry.get("source", doc.plan.sourceType).collect({ ...ctx, plan: doc.plan }));
      doc = await advance(ctx, id, "COLLECTING", "RENDERING", { source });
    }
    for (;;) {
      if (doc.status === "RENDERING") {
        const name = doc.plan.renderer;
        const renderer = registry.get("renderer", name);
        const render = checkRender(await renderer.render(doc.source, doc.plan.template, { ...ctx, doc }), renderer);
        doc = await advance(ctx, id, "RENDERING", "COPYWRITING", { render: { ...render, renderer: name }, redo: null });
      }
      if (doc.status === "COPYWRITING") {
        const recent = await recentFirstLines(store, id);
        const copy = checkCopy(await registry.get("copywriter", doc.plan.copywriter || "default").write({ source: doc.source, render: doc.render, channels: doc.channels, recent, ctx }), doc.channels);
        doc = await advance(ctx, id, "COPYWRITING", "QC", { copy, redo: null });
      }
      const qc = await runQc(doc, ctx);
      if (qc.passed) {
        // 검수 때 계산한 파일 해시를 남기고, 승인 화면 · 플랫폼이 볼 공개 주소로 올린다
        const files = await uploadMedia(ctx, doc);
        doc = await advance(ctx, id, "QC", "READY_FOR_APPROVAL", { qc, render: { ...doc.render, files } });
        await notify(ctx, "ready", doc);
        return doc;
      }
      const reasons = qc.checks.filter((c) => !c.ok).map((c) => c.reason);
      if ((doc.redoCount || 0) < settings.qc.maxRedo) {
        doc = await advance(ctx, id, "QC", "RENDERING", { qc, redoCount: (doc.redoCount || 0) + 1 }, `검수 불합격 → 다시 만들기: ${reasons.join(" / ")}`);
        continue;
      }
      doc = await advance(ctx, id, "QC", "FAILED", { qc, failure: { stage: "QC", reason: reasons.join(" / ") } });
      await notify(ctx, "failed", doc);
      return doc;
    }
  } catch (e) {
    if (e instanceof Abort) return store.getContent(id);
    const failed = await store.updateContent(id, (d) => {
      if (!MAKING.includes(d.status)) return false;
      d.failure = { stage: d.status, reason: e.message };
      transition(d, "FAILED", { by: "worker", note: e.message, now: nowOf(ctx) });
    });
    if (ctx.logger) await ctx.logger.error(`제작 실패 (${id}): ${e.message}`);
    await notify(ctx, "failed", failed);
    return failed;
  }
}

/** 관리자가 요청한 "문구 다시 만들기 · 다시 제작" 처리 (작업 서버가 실행될 때마다) */
async function runQueued(ctx) {
  const queued = (await ctx.store.listContents(100)).filter((d) => d.redo && (d.status === "RENDERING" || d.status === "COPYWRITING"));
  const out = [];
  for (const d of queued) out.push(await runFrom(ctx, d.id));
  return out;
}

/** 새 콘텐츠 하나 만들기 */
async function produce(ctx, plan) {
  const doc = newContent(plan, { now: nowOf(ctx) });
  await ctx.store.saveContent(doc);
  return runFrom(ctx, doc.id);
}

module.exports = { produce, runFrom, runQueued, newContent, Abort };
