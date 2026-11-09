"use strict";
/**
 * 웹 관리자 화면용 자료 (게임 목록 · 녹화 프로필 · 재고 · 채널 상태) — 실제로 게시하는 이 실행 환경 기준.
 * Vercel 함수는 사이트 파일 · 채널 열쇠를 읽지 않고 이것만 보여 준다.
 */
async function writeSnapshot(ctx) {
  const { store, registry } = ctx;
  const { readCatalog } = require("../sources/game");
  const { promotable } = require("../sources/new-game");
  const { listProfiles, loadProfile, ROOT } = require("../renderers/reel/record");
  const { availableClips, gameHash } = require("./clips");
  const profiles = listProfiles();
  const ids = new Set(promotable());
  const last = {};
  for (const d of await store.listContents(200)) if (d.source && ["game", "new-game"].includes(d.source.sourceType) && d.status === "PUBLISHED" && !last[d.source.sourceId]) last[d.source.sourceId] = d.createdAt;
  const games = [];
  for (const g of readCatalog()) {
    if (!ids.has(g.id)) continue;
    const p = profiles.includes(g.id) ? loadProfile(g.id) : null;
    const stock = p && p.runner === "pc" ? (await availableClips(store, g.id, gameHash(ROOT, g.id), Date.now())).length : null;
    games.push({ id: g.id, title: g.title, category: g.category, added: g.added || null, profile: p ? { runner: p.runner, rawSec: p.rawSec, hooks: (p.hooks || []).length } : null, stock, lastPublished: last[g.id] || null });
  }
  const channels = {};
  for (const name of registry.names("channel")) {
    const c = registry.get("channel", name);
    channels[name] = { mode: c.mock ? "mock" : "live", health: await c.health().catch((e) => ({ ok: false, reason: e.message })) };
  }
  await store.setJson("admin:snapshot", { at: new Date().toISOString(), runner: process.env.MKT_RUNNER || "pc", games, channels });
}


module.exports = { writeSnapshot };
