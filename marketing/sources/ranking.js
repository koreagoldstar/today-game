"use strict";
/*
 * Source "ranking" (C5 주간 TOP): 지난주 실제 랭킹 — 사이트 Redis 키 todaygame:scores:{game}:week:{주} 를 **읽기만** 한다.
 * 기록이 게임당 minEntriesPerGame 개 미만이면 그 게임은 빼고, 남는 게임이 없으면 만들지 않는다 (지어낸 순위 금지).
 * 닉네임은 사이트에 나쁜 말 거르기가 없어 모두 가린다 (결정 7): "삐약이" → "삐*이". 순위 · 점수는 원본 숫자 그대로.
 */
const vm = require("vm");
const { literal, read } = require("./site-data");
const { readCatalog } = require("./game");

const FILE = "api/scores.js";

function weekIdOf(t) {
  // 사이트(api/scores.js)의 seoulDay · seoulWeekId 를 그대로 (서울 기준 ISO 주)
  const day = new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return `${utc.getUTCFullYear()}-W${String(Math.ceil(((utc - yearStart) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}

/** 사이트가 랭킹 화면에 쓰는 점수 표시 함수 그대로 (js/rankable.js — ms · 초 · m · 점) */
function siteFormat() {
  const ctx = { window: {} };
  vm.runInNewContext(read("js/rankable.js"), ctx, { timeout: 2000 });
  return ctx.window.TodayRankMeta.formatScore;
}

const mask = (name) => {
  const s = [...String(name)];
  if (s.length <= 1) return "*";
  if (s.length === 2) return `${s[0]}*`;
  return `${s[0]}${"*".repeat(s.length - 2)}${s[s.length - 1]}`;
};

module.exports = {
  siteFormat,
  weekIdOf,
  mask,
  async collect({ store, settings, now = () => Date.now(), plan }) {
    const t = typeof now === "function" ? now() : now;
    const week = (plan && plan.week) || weekIdOf(t - 7 * 86400000); // 지난주
    const allowed = [...literal(FILE, "ALLOWED")];
    const lower = literal(FILE, "LOWER_BETTER");
    const titles = Object.fromEntries(readCatalog().map((g) => [g.id, g.title]));
    const min = settings.ranking.minEntriesPerGame;
    const format = siteFormat();
    const games = [];
    for (const id of allowed) {
      if (!titles[id]) continue; // 카탈로그에 없는 내부 키(스테이지 등)는 뺌
      const raw = await store.readSite(`todaygame:scores:${id}:week:${week}`);
      let list = [];
      try {
        list = JSON.parse(raw || "[]").filter((e) => e && typeof e.name === "string" && Number.isFinite(Number(e.score)));
      } catch (_) {}
      if (list.length < min) continue;
      list.sort((a, b) => (lower.has(id) ? a.score - b.score : b.score - a.score));
      games.push({ id, title: titles[id], entries: list.length, lowerBetter: lower.has(id), top: list.slice(0, 3).map((e, i) => ({ rank: i + 1, name: settings.ranking.maskNames ? mask(e.name) : e.name, score: Math.floor(Number(e.score)), text: format(id, e.score) })), full: list.length >= 50 });
    }
    if (!games.length) throw Object.assign(new Error(`${week} 주간 기록이 기준(게임당 ${min}건)에 못 미쳐 만들지 않습니다.`), { code: "NO_DATA" });
    games.sort((a, b) => b.entries - a.entries);
    return { sourceType: "ranking", sourceId: `ranking-${week}`, facts: { title: "지난주 TOP 랭킹", week, url: "/rankings/", games: games.slice(0, 4) }, assets: {} };
  },
};
