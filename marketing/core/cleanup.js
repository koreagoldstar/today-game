"use strict";
/*
 * 하루 한 번: 오래된 Blob 파일 지우기 — Vercel Blob Hobby 포함분(저장 1GB)을 넘으면 30일 동안 Blob 을 못 쓴다.
 *  - 콘텐츠 결과물: 끝난 상태(게시 완료 · 반려 · 실패 · 취소 · 기한 지남)로 contentDays(30일) 지난 것.
 *    플랫폼은 게시할 때 이미 파일을 가져갔으므로 지워도 게시물은 그대로다. 콘텐츠 기록은 남기고 render.mediaRemovedAt 만 표시.
 *  - PC 녹화 재고: 쓴 지 clipUsedDays(3일) 지난 것, 녹화 clipMaxDays(25일) 지난 것 (저장소 기록이 30일 뒤 사라지기 전에).
 */
const { listClips } = require("./clips");
const { listProfiles } = require("../renderers/reel/record");

const DAY = 86400000;
const DONE = ["PUBLISHED", "REJECTED", "FAILED", "CANCELLED", "EXPIRED"];

async function cleanupMedia(ctx, now = Date.now(), { contentDays = 30, clipUsedDays = 3, clipMaxDays = 25 } = {}) {
  const { store, registry } = ctx;
  if (!registry.has("media", "default") || typeof registry.get("media", "default").remove !== "function") return { skipped: "미디어 저장소 없음" };
  const media = registry.get("media", "default");
  const out = { contents: 0, files: 0, clips: 0, errors: 0 };
  for (const d of await store.listContents(500)) {
    if (!DONE.includes(d.status) || !d.render || d.render.mediaRemovedAt || now - Date.parse(d.updatedAt) < contentDays * DAY) continue;
    let ok = true;
    for (const f of d.render.files || []) {
      if (!f.url) continue;
      try {
        await media.remove(f.url);
        out.files++;
      } catch (_) {
        ok = false;
        out.errors++;
      }
    }
    if (ok) {
      await store.updateContent(d.id, (x) => void (x.render.mediaRemovedAt = new Date(now).toISOString()));
      out.contents++;
    }
  }
  for (const game of listProfiles()) {
    for (const c of await listClips(store, game)) {
      const old = now - Date.parse(c.recordedAt) > clipMaxDays * DAY;
      const usedOld = c.used && now - Date.parse(c.used.at) > clipUsedDays * DAY;
      if (!old && !usedOld) continue;
      try {
        await media.remove(c.url);
        await store.batch([
          ["DEL", `clip:${c.id}`],
          ["ZREM", `clips:${game}`, c.id],
        ]);
        out.clips++;
      } catch (_) {
        out.errors++;
      }
    }
  }
  return out;
}

module.exports = { cleanupMedia };
