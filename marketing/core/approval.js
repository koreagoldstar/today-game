"use strict";
/*
 * 관리자 행동 — 텔레그램 · 웹 관리자가 같은 함수를 쓴다.
 *  모든 행동은 화면에서 본 버전(version)을 같이 보내야 한다. 그사이 바뀌었으면 거부 → 두 경로에서 동시에 눌러도 한 번만 반영.
 *  승인 뒤 문구 · 파일 · 채널 · 게시 시각이 바뀌면 승인 무효 (state.invalidate).
 */
const { transition, invalidate } = require("./state");
const { seoulDay, atSeoul } = require("./settings");

class ActionError extends Error {
  constructor(message, code = "BAD_ACTION") {
    super(message);
    this.code = code;
  }
}

const anyPosted = (doc) => Object.values(doc.posts || {}).some((p) => p && (p.status === "PUBLISHED" || p.status === "PUBLISHING"));

function sameVersion(doc, version) {
  if (Number(version) !== doc.version) throw new ActionError("그사이 내용이 바뀌었습니다. 새로 받은 내용을 확인한 뒤 다시 눌러 주세요.", "STALE");
}

/** 그날 같은 자리(feed/story)에 이미 잡힌 콘텐츠 수 */
function slotCounts(list, slot, exceptId) {
  const m = {};
  for (const d of list) {
    if (d.id === exceptId || d.slot !== slot || !["SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(d.status) || !d.scheduledAt) continue;
    const day = seoulDay(Date.parse(d.scheduledAt));
    m[day] = (m[day] || 0) + 1;
  }
  return m;
}

const slotCap = (settings, doc) => Math.min(...doc.channels.map((ch) => (settings.dailyCaps[ch] || {})[doc.slot] || 0));

/** 설정한 시각(서울) 중 10분 뒤 이후이고 그날 자리가 남은 첫 시각 */
function nextSlot(settings, doc, counts, now = Date.now()) {
  const cap = slotCap(settings, doc);
  let day = seoulDay(now);
  const only = doc.plan && doc.plan.validDay; // 그날만 맞는 콘텐츠: 그날 안에서만, 시각이 지났으면 10분 뒤
  if (only) {
    if (only !== day) throw new ActionError(`${only} 에만 맞는 콘텐츠라 지금은 올릴 수 없습니다.`);
    if ((counts[day] || 0) >= cap) throw new ActionError(`오늘 ${doc.slot === "story" ? "스토리" : "피드"} 자리가 이미 찼습니다.`);
    return new Date(Math.max(atSeoul(day, settings.postTimes[doc.slot]), now + 10 * 60000)).toISOString();
  }
  for (let i = 0; i < 30; i++) {
    const at = atSeoul(day, settings.postTimes[doc.slot]);
    if (at >= now + 10 * 60000 && (counts[day] || 0) < cap) return new Date(at).toISOString();
    day = seoulDay(atSeoul(day, "12:00") + 86400000);
  }
  throw new ActionError("30일 안에 빈 게시 자리가 없습니다.");
}

function checkTime(settings, doc, counts, iso, now) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) throw new ActionError("게시 시각이 올바르지 않습니다.");
  if (t < now + 60000) throw new ActionError("게시 시각은 지금부터 1분 뒤 이후로 정해 주세요.");
  if (t > now + 30 * 86400000) throw new ActionError("게시 시각은 30일 안으로 정해 주세요.");
  const day = seoulDay(t);
  if (doc.plan && doc.plan.validDay && doc.plan.validDay !== day) throw new ActionError(`이 콘텐츠는 ${doc.plan.validDay} 에만 올릴 수 있습니다.`);
  const cap = slotCap(settings, doc);
  if ((counts[day] || 0) >= cap) throw new ActionError(`${day} ${doc.slot === "story" ? "스토리" : "피드"} 자리가 이미 찼습니다 (하루 ${cap}개).`);
  return new Date(t).toISOString();
}

function createApproval({ store, settings, registry, now = () => Date.now() }) {
  const who = ({ by, via }) => {
    // cli: 관리자가 이 PC 에서 직접 (run.js approve) — 자동 실행(Actions)에는 이 명령이 없다
    if (!by || !["telegram", "web", "cli"].includes(via)) throw new ActionError("누가 · 어디서 했는지가 없습니다.");
    return `${via}:${by}`;
  };

  async function act(id, args, fn) {
    // 일정 자리 계산이 서로 겹치지 않게 승인 · 시각 변경은 한 번에 하나씩
    return store.withLock("approval", 30, () => store.updateContent(id, (doc) => fn(doc, who(args))));
  }

  return {
    /** 승인 (+ 게시 시각). 시각을 안 주면 다음 빈 자리 */
    approve: (id, args) =>
      act(id, args, async (doc, by) => {
        sameVersion(doc, args.version);
        if (doc.status !== "READY_FOR_APPROVAL") throw new ActionError("승인 대기 상태인 콘텐츠만 승인할 수 있습니다.");
        if (!doc.qc || !doc.qc.passed) throw new ActionError("검수를 통과하지 못한 콘텐츠는 승인할 수 없습니다.");
        if (!doc.channels || !doc.channels.length) throw new ActionError("게시할 채널이 없습니다.");
        const counts = slotCounts(await store.listContents(200), doc.slot, doc.id);
        const t = now();
        doc.scheduledAt = args.scheduledAt ? checkTime(settings, doc, counts, args.scheduledAt, t) : nextSlot(settings, doc, counts, t);
        transition(doc, "APPROVED", { by, now: t });
        doc.approval = { version: doc.version, at: new Date(t).toISOString(), by, channels: [...doc.channels], scheduledAt: doc.scheduledAt };
        doc.rejection = null;
        transition(doc, "SCHEDULED", { by, note: `게시 예정 ${doc.scheduledAt}`, now: t });
      }),

    reject: (id, args) =>
      act(id, args, (doc, by) => {
        sameVersion(doc, args.version);
        const reason = String(args.reason || "").trim().slice(0, 500);
        if (!reason) throw new ActionError("반려 사유를 적어 주세요.");
        transition(doc, "REJECTED", { by, note: reason });
        doc.rejection = { reason, at: new Date(now()).toISOString(), by, version: doc.version };
      }),

    /** 문구 직접 고치기 (텔레그램 답장 · 웹) */
    editCopy: (id, args) =>
      act(id, args, (doc, by) => {
        sameVersion(doc, args.version);
        if (anyPosted(doc)) throw new ActionError("이미 게시가 시작된 콘텐츠는 고칠 수 없습니다.");
        if (!["READY_FOR_APPROVAL", "APPROVED", "SCHEDULED"].includes(doc.status)) throw new ActionError("지금 상태에서는 문구를 고칠 수 없습니다.");
        const ch = args.channel;
        if (!doc.copy || !doc.copy[ch]) throw new ActionError("그 채널의 문구가 없습니다.");
        const caption = String(args.caption || "").replace(/\r\n/g, "\n").trim();
        if (!caption) throw new ActionError("문구가 비어 있습니다.");
        const caps = registry.get("channel", ch).capabilities();
        const hashtags = args.hashtags == null ? doc.copy[ch].hashtags || [] : args.hashtags.map((t) => String(t).trim()).filter(Boolean);
        if ([caption, hashtags.join(" ")].join("\n\n").length > caps.caption.maxChars) throw new ActionError(`글자 수가 ${caps.caption.maxChars}자를 넘습니다.`);
        doc.copy[ch] = { ...doc.copy[ch], caption, hashtags, edited: true };
        invalidate(doc, { by, note: `${ch} 문구 수정`, now: now() });
      }),

    /** 문구 다시 만들기 · 다시 제작: 작업 서버가 다음 실행 때 이어서 만든다 */
    redo: (id, args) =>
      act(id, args, (doc, by) => {
        sameVersion(doc, args.version);
        if (anyPosted(doc)) throw new ActionError("이미 게시가 시작된 콘텐츠는 다시 만들 수 없습니다.");
        const stage = args.stage === "render" ? "RENDERING" : "COPYWRITING";
        if (doc.status === "APPROVED" || doc.status === "SCHEDULED") invalidate(doc, { by, note: "다시 만들기 요청", now: now() });
        else doc.version += 1;
        transition(doc, stage, { by, note: stage === "RENDERING" ? "다시 제작 요청" : "문구 다시 만들기 요청", now: now() });
        doc.redo = { stage, at: new Date(now()).toISOString(), by };
      }),

    cancel: (id, args) =>
      act(id, args, (doc, by) => {
        sameVersion(doc, args.version);
        transition(doc, "CANCELLED", { by, note: args.reason || "게시 취소" });
      }),

    setChannels: (id, args) =>
      act(id, args, (doc, by) => {
        sameVersion(doc, args.version);
        if (anyPosted(doc)) throw new ActionError("이미 게시가 시작된 콘텐츠는 채널을 바꿀 수 없습니다.");
        if (!["READY_FOR_APPROVAL", "APPROVED", "SCHEDULED"].includes(doc.status)) throw new ActionError("지금 상태에서는 채널을 바꿀 수 없습니다.");
        const list = [...new Set(args.channels || [])];
        if (!list.length) throw new ActionError("채널을 하나 이상 골라 주세요.");
        for (const ch of list) {
          if (!registry.has("channel", ch)) throw new ActionError(`쓸 수 없는 채널: ${ch}`);
          if (doc.render && !registry.get("channel", ch).capabilities().kinds.includes(doc.render.kind)) throw new ActionError(`${ch} 는 이 형식(${doc.render.kind})을 올릴 수 없습니다.`);
          if (!doc.copy || !doc.copy[ch]) throw new ActionError(`${ch} 문구가 없습니다. 문구 다시 만들기를 먼저 해 주세요.`);
        }
        doc.channels = list;
        invalidate(doc, { by, note: `채널 변경: ${list.join(", ")}`, now: now() });
      }),

    setTime: (id, args) =>
      act(id, args, async (doc, by) => {
        sameVersion(doc, args.version);
        if (anyPosted(doc)) throw new ActionError("이미 게시가 시작된 콘텐츠는 시각을 바꿀 수 없습니다.");
        if (!["READY_FOR_APPROVAL", "APPROVED", "SCHEDULED"].includes(doc.status)) throw new ActionError("지금 상태에서는 시각을 바꿀 수 없습니다.");
        const counts = slotCounts(await store.listContents(200), doc.slot, doc.id);
        doc.scheduledAt = checkTime(settings, doc, counts, args.scheduledAt, now());
        invalidate(doc, { by, note: `게시 시각 변경: ${doc.scheduledAt}`, now: now() });
      }),
  };
}

module.exports = { createApproval, ActionError, nextSlot, slotCounts };
