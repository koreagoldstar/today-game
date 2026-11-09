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
  for (const id of listProfiles()) {
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

/** 오늘 새로 만들어도 되는지: 오늘 피드가 이미 있거나(하루 1개) 승인 대기가 상한만큼 쌓였으면 안 만든다 */
function produceGate(list, settings, today) {
  if (list.some((d) => d.dateKey === today && d.slot === "feed" && !["FAILED", "CANCELLED"].includes(d.status))) return { ok: false, reason: "오늘 피드 콘텐츠가 이미 있습니다" };
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

module.exports = { planToday, scoreGames, produceGate };
