"use strict";
/*
 * Planner — 오늘 만들 콘텐츠 정하기 (PHASE 5: 게임 플레이 릴스 C1 만. 요일 편성표의 다른 유형은 PHASE 7)
 * 게임 고르기 (지시서 §4 C1):
 *   최근 repeatDays(14일) 안에 홍보하지 않은 게임 우선 → 신작 우선 → 오래 안 한 게임 → (성과 가중치는 PHASE 10) · 직전과 같은 게임 금지
 *   GitHub Actions 에서는 GPU 가 필요한 3D 게임은 PC 가 올린 재고가 있을 때만
 */
const path = require("path");
const { listProfiles, loadProfile } = require("../renderers/reel/record");
const { availableClips, gameHash } = require("./clips");
const { readCatalog } = require("../sources/game");
const { seoulDay, seoulWeekday } = require("./settings");

const ROOT = path.resolve(__dirname, "../..");
const DAY = 86400000;
const USED = ["READY_FOR_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED"]; // 실제로 홍보에 쓰였거나 쓰일 것

async function scoreGames(ctx, { now = Date.now(), runner = process.env.MKT_RUNNER || "pc" } = {}) {
  const { store, settings } = ctx;
  const contents = await store.listContents(200);
  const games = contents.filter((d) => d.source && d.source.sourceType === "game");
  const lastAt = {};
  for (const d of games) if (USED.includes(d.status)) lastAt[d.source.sourceId] = Math.max(lastAt[d.source.sourceId] || 0, Date.parse(d.createdAt));
  const last = games.find((d) => !["FAILED", "CANCELLED"].includes(d.status));
  const catalog = Object.fromEntries(readCatalog().map((g) => [g.id, g]));
  const out = [];
  const excluded = settings.excludeGames || [];
  for (const id of listProfiles()) {
    if (excluded.includes(id)) {
      out.push({ id, score: -1, eligible: false, reasons: ["관리자가 홍보 제외"] });
      continue;
    }
    const p = loadProfile(id);
    const reasons = [];
    if (runner === "actions" && p.runner === "pc") {
      const stock = await availableClips(store, id, gameHash(ROOT, id), now);
      if (!stock.length) {
        out.push({ id, score: -1, eligible: false, reasons: ["GPU 필요 · PC 녹화 재고 없음"] });
        continue;
      }
      reasons.push(`재고 ${stock.length}개`);
    }
    let score = 0;
    const since = lastAt[id] ? (now - lastAt[id]) / DAY : Infinity;
    if (since > settings.repeatDays) {
      score += 100;
      reasons.push(lastAt[id] ? `${Math.floor(since)}일 전 홍보` : "홍보한 적 없음");
    } else reasons.push(`${since.toFixed(1)}일 전 홍보 (${settings.repeatDays}일 안)`);
    const added = catalog[id] && catalog[id].added ? (now - Date.parse(catalog[id].added)) / DAY : Infinity;
    if (added <= 30 && !lastAt[id]) {
      score += 50;
      reasons.push("신작");
    }
    score += Math.min(30, since === Infinity ? 30 : since);
    const eligible = !(last && last.source.sourceId === id); // 직전과 같은 게임 금지
    if (!eligible) reasons.push("직전과 같은 게임");
    out.push({ id, score: +score.toFixed(2), eligible, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** 오늘 새로 만들어도 되는지: 오늘 그 자리(피드 · 스토리)가 이미 있거나(하루 1개) 승인 대기가 상한만큼 쌓였으면 안 만든다 */
function produceGate(list, settings, today, slot = "feed") {
  if (list.some((d) => d.dateKey === today && d.slot === slot && !["FAILED", "CANCELLED"].includes(d.status))) return { ok: false, reason: `오늘 ${slot === "story" ? "스토리" : "피드"} 콘텐츠가 이미 있습니다` };
  const waiting = list.filter((d) => d.status === "READY_FOR_APPROVAL").length;
  if (waiting >= settings.maxPending) return { ok: false, reason: `승인 대기가 ${waiting}개라 새로 만들지 않습니다 (상한 ${settings.maxPending})` };
  return { ok: true };
}

/** 오늘의 계획. 고를 게임이 없으면 null */
async function planToday(ctx, opts = {}) {
  const ranked = await scoreGames(ctx, opts);
  const pick = ranked.find((g) => g.eligible && g.score >= 0);
  if (!pick) return { plan: null, ranked };
  return {
    ranked,
    plan: {
      slot: "feed",
      kind: "reel",
      sourceType: "game",
      sourceId: pick.id,
      renderer: "reel",
      channels: ctx.settings.channels,
      reason: `게임 선정: ${pick.id} (${pick.reasons.join(", ")})`,
    },
  };
}

/* ---------- 요일 편성 (지시서 §8) ---------- */
// 편성표 이름 → 만들 방법. daily: 그날만 맞는 콘텐츠 (다음 날로 미루지 않음)
const TYPES = {
  reel: { kind: "reel", renderer: "reel", sourceType: "game" },
  "new-game": { kind: "reel", renderer: "reel", sourceType: "new-game" },
  quiz: { kind: "carousel", renderer: "image", sourceType: "quiz" },
  ranking: { kind: "image", renderer: "image", sourceType: "ranking" },
  fortune: { kind: "story", renderer: "image", sourceType: "fortune", daily: true },
  challenge: { kind: "story", renderer: "image", sourceType: "challenge", daily: true },
  recycle: { kind: "story", renderer: "image", sourceType: "recycle" },
};

/** 기본 채널 중 이 형식을 받는 채널만 (스토리는 인스타만 등) */
const channelsFor = (ctx, kind) => ctx.settings.channels.filter((ch) => !ctx.registry || !ctx.registry.has("channel", ch) || ctx.registry.get("channel", ch).capabilities().kinds.includes(kind));

/**
 * 한 자리(feed · story)의 후보 계획들 — 앞에서부터 시도하고, 자료가 모자라면(NO_DATA) 다음 것.
 *  feed: 그 요일 편성표 순서 · story: settings.story 를 날마다 하나씩 돌려 가며
 *  opts.types 로 유형을 직접 정할 수 있다 (관리자 지정 · 시험)
 */
async function planSlot(ctx, slot, opts = {}) {
  const now = opts.now || Date.now();
  const day = seoulDay(now);
  let types = opts.types;
  if (!types && slot === "story") {
    const list = ctx.settings.story;
    const n = Math.round(Date.parse(day) / DAY);
    types = list.map((_, i) => list[(n + i) % list.length]);
  }
  if (!types) types = ctx.settings.schedule[seoulWeekday(now)];
  const plans = [];
  let ranked = [];
  for (const name of types) {
    const T = TYPES[name];
    if (!T || (T.kind === "story") !== (slot === "story")) continue;
    if (ctx.registry && !ctx.registry.has("source", T.sourceType)) continue; // 아직 없는 유형
    const channels = channelsFor(ctx, T.kind);
    if (!channels.length) continue;
    const base = { slot, kind: T.kind, sourceType: T.sourceType, renderer: T.renderer, channels, ...(T.daily ? { validDay: day } : {}) };
    if (name === "reel") {
      const r = await planToday(ctx, opts);
      ranked = r.ranked;
      if (r.plan) plans.push({ ...base, sourceId: r.plan.sourceId, reason: r.plan.reason });
    } else if (name === "new-game") {
      // 신작: 녹화할 수 있으면 릴스 (Actions 에서는 PC 재고가 있을 때만), 아니면 썸네일 + 설명 이미지
      const fresh = (await ctx.registry.get("source", "new-game").detect({ store: ctx.store })).fresh.filter((g) => !(ctx.settings.excludeGames || []).includes(g));
      const id = fresh[0];
      if (!id) continue;
      let reel = listProfiles().includes(id);
      const runner = opts.runner || process.env.MKT_RUNNER || "pc";
      if (reel && runner === "actions" && loadProfile(id).runner === "pc") reel = (await availableClips(ctx.store, id, gameHash(ROOT, id), now)).length > 0;
      const kind = reel ? "reel" : "image";
      const ch = channelsFor(ctx, kind);
      if (ch.length) plans.push({ ...base, kind, renderer: reel ? "reel" : "image", channels: ch, sourceId: id, reason: `신작 감지: ${id} (${reel ? "릴스" : "썸네일 이미지"})${fresh.length > 1 ? ` · 대기 신작 ${fresh.length - 1}개` : ""}` });
    } else plans.push({ ...base, sourceId: name, reason: `편성: ${name} (${slot === "story" ? "스토리" : seoulWeekday(now)})` });
  }
  return { plans, ranked };
}

module.exports = { planToday, planSlot, scoreGames, produceGate, TYPES };
