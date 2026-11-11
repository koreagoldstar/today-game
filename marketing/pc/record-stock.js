#!/usr/bin/env node
"use strict";
/*
 * 이 PC(GPU)에서 3D 게임 녹화본을 만들어 재고로 올린다 (ARCHITECTURE §11, 결정 1 ④)
 *   node marketing/pc/record-stock.js            게임마다 쓸 수 있는 재고가 2개 미만이면 녹화 → 압축 → Blob → 재고 등록
 *   node marketing/pc/record-stock.js --dry      녹화 · 압축만 (올리지 않음)
 * 필요: marketing/.env.local 의 UPSTASH_REDIS_REST_URL · UPSTASH_REDIS_REST_TOKEN · BLOB_READ_WRITE_TOKEN
 * 녹화는 이 저장소 사본의 로컬 서버에서 (운영 사이트 아님) · /api 막음 · 봇 치트 옵션 끔 — record.js 그대로
 */
const fs = require("fs");
const path = require("path");
const { loadEnvFile } = require("../core/env");
loadEnvFile(path.join(__dirname, "..", ".env.local"));

const { recordGame, listProfiles, loadProfile, ROOT } = require("../renderers/reel/record");
const { run, FFMPEG, probe } = require("../renderers/reel/encode");
const { addClip, availableClips, gameHash } = require("../core/clips");

const KEEP = 2; // 게임마다 이만큼 재고를 채워 둔다
const dry = process.argv.includes("--dry");

(async () => {
  const store = dry ? null : require("../core/store").createStore();
  const media = dry ? null : require("../media/blob").createBlobMedia();
  const out = path.join(ROOT, "marketing", "out", "clips");
  for (const id of listProfiles().filter((x) => loadProfile(x).runner === "pc")) {
    const hash = gameHash(ROOT, id);
    if (store) {
      const have = (await availableClips(store, id, hash)).length;
      if (have >= KEEP) {
        console.log(`${id}: 재고 ${have}개 — 건너뜀`);
        continue;
      }
    }
    const meta = await recordGame(loadProfile(id), { outDir: out, render: "gpu", log: (m) => console.log(m) });
    if (!meta.ok) {
      console.log(`${id}: 녹화 실패 — ${meta.reason}`);
      process.exitCode = 1;
      continue;
    }
    // 올리기 전에 압축 (원본 45~62MB → Blob 무료 1GB 안에 맞게)
    const raw = path.join(ROOT, meta.file);
    const small = raw.replace(/\.mp4$/, ".stock.mp4");
    await run(FFMPEG, ["-y", "-i", raw, "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", small]);
    const info = probe(small);
    console.log(`${id}: 압축 ${(meta.bytes / 1e6).toFixed(1)}MB → ${(fs.statSync(small).size / 1e6).toFixed(1)}MB (${info.width}x${info.height})`);
    if (dry) continue;
    const up = await media.put({ path: small, contentType: "video/mp4" }, { folder: "clips", contentId: id });
    await addClip(store, {
      id: meta.id,
      gameId: id,
      url: up.url,
      gameHash: hash,
      recordedAt: meta.recordedAt,
      durationSec: meta.durationSec,
      captureFps: meta.captureFps,
      hasAudio: meta.hasAudio,
      render: meta.render,
      events: meta.events,
      bytes: fs.statSync(small).size,
    });
    console.log(`${id}: 재고 등록 ${meta.id}`);
  }
})().catch((e) => {
  console.error(`실패: ${e.message}`);
  process.exit(1);
});
