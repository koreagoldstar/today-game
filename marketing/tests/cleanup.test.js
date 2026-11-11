"use strict";
/* PHASE 11 — 오래된 Blob 정리: 끝난 콘텐츠 30일 · 쓴 녹화본 3일 · 녹화 25일. 승인 대기 · 최근 것 · 안 쓴 재고는 그대로 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { makeCtx } = require("./helpers");
const { cleanupMedia } = require("../core/cleanup");
const { addClip, listClips, gameHash } = require("../core/clips");

const ROOT = path.resolve(__dirname, "../..");
const DAY = 86400000;
const NOW = Date.parse("2026-12-20T09:00:00+09:00");
const iso = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const doc = (id, status, daysAgo) => ({ id, slot: "feed", dateKey: iso(daysAgo).slice(0, 10), status, createdAt: iso(daysAgo), updatedAt: iso(daysAgo), render: { kind: "image", meta: {}, files: [{ role: "image", url: `https://blob.test/${id}.jpg` }] } });

test("Blob 정리: 지울 것만 지우고 콘텐츠 기록은 남김", async () => {
  const base = makeCtx();
  const removed = [];
  base.registry.register("media", "default", { put: async () => ({}), remove: async (u) => void removed.push(u) });
  await base.store.saveContent(doc("2026-11-10-feed-old001", "PUBLISHED", 40));
  await base.store.saveContent(doc("2026-11-11-feed-old002", "EXPIRED", 35));
  await base.store.saveContent(doc("2026-12-01-feed-new001", "PUBLISHED", 19));
  await base.store.saveContent(doc("2026-11-10-feed-wait01", "READY_FOR_APPROVAL", 40));
  const hash = gameHash(ROOT, "reaction");
  await addClip(base.store, { id: "clip-used-old", gameId: "reaction", url: "https://blob.test/c1.mp4", gameHash: hash, recordedAt: iso(6), durationSec: 45 });
  await addClip(base.store, { id: "clip-fresh", gameId: "reaction", url: "https://blob.test/c2.mp4", gameHash: hash, recordedAt: iso(2), durationSec: 45 });
  await addClip(base.store, { id: "clip-stale", gameId: "reaction", url: "https://blob.test/c3.mp4", gameHash: hash, recordedAt: iso(26), durationSec: 45 });
  const c1 = JSON.parse((await base.store.run("GET", "clip:clip-used-old")));
  c1.used = { by: "x", at: iso(4) };
  await base.store.run("SET", "clip:clip-used-old", JSON.stringify(c1));

  const r = await cleanupMedia(base.ctx, NOW);
  assert.deepEqual(r, { contents: 2, files: 2, clips: 2, errors: 0 });
  assert.deepEqual(removed.sort(), ["https://blob.test/2026-11-10-feed-old001.jpg", "https://blob.test/2026-11-11-feed-old002.jpg", "https://blob.test/c1.mp4", "https://blob.test/c3.mp4"]);
  assert.ok((await base.store.getContent("2026-11-10-feed-old001")).render.mediaRemovedAt, "기록은 남기고 지운 날만 표시");
  assert.equal((await base.store.getContent("2026-12-01-feed-new001")).render.mediaRemovedAt, undefined);
  assert.equal((await base.store.getContent("2026-11-10-feed-wait01")).render.mediaRemovedAt, undefined, "승인 대기는 안 지움");
  assert.deepEqual((await listClips(base.store, "reaction")).map((c) => c.id), ["clip-fresh"]);
  assert.deepEqual(await cleanupMedia(base.ctx, NOW), { contents: 0, files: 0, clips: 0, errors: 0 }, "두 번 지우지 않음");

  const none = makeCtx();
  assert.deepEqual(await cleanupMedia(none.ctx, NOW), { skipped: "미디어 저장소 없음" }, "helpers 의 media 에는 remove 가 없음");
});
