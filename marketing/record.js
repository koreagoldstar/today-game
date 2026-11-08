#!/usr/bin/env node
"use strict";
/*
 * 게임 녹화 (원본 클립) — 결과는 marketing/out/clips/<게임>/ (git 제외)
 *   node marketing/record.js reaction claw-master       게임 지정
 *   node marketing/record.js --runner pc                 이 PC 에서 녹화할 게임 (3D)
 *   node marketing/record.js --runner actions            GitHub Actions 에서 녹화할 게임 (2D)
 *   node marketing/record.js all --render cpu            GPU 없는 조건으로 (러너와 같은 조건 확인용)
 *   옵션: --headed (창 보이기)
 */
const path = require("path");
const { recordGame, loadProfile, listProfiles } = require("./renderers/reel/record");

const argv = process.argv.slice(2);
const opt = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};
const flags = new Set(["--render", "--runner"]);
const ids = argv.filter((a, i) => !a.startsWith("--") && !flags.has(argv[i - 1]));
const runner = opt("--runner");
const render = opt("--render");

(async () => {
  let targets = ids.length && ids[0] !== "all" ? ids : listProfiles();
  let profiles = targets.map(loadProfile);
  if (runner) profiles = profiles.filter((p) => p.runner === runner);
  if (!profiles.length) throw new Error("녹화할 게임이 없습니다.");
  const outDir = path.join(__dirname, "out", "clips");
  const results = [];
  for (const p of profiles) results.push(await recordGame(p, { outDir, render: render || undefined, headless: !argv.includes("--headed"), log: (m) => console.log(m) }));
  console.log("\n결과");
  for (const r of results) {
    console.log(
      r.ok
        ? `  성공  ${r.gameId} (${r.render}) ${r.durationSec}초 · 초당 ${r.captureFps}장 · 장면 ${r.uniqueFrames} · 이벤트 ${r.events.filter((e) => e.type !== "start").length} · 소리 ${r.hasAudio ? "있음" : "없음"} · /api 막음 ${r.apiBlocked} · 운영 요청 ${r.prodRequests.length} → ${r.file}`
        : `  실패  ${r.gameId} (${r.render}) [${r.stage}] ${r.reason}`
    );
  }
  process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
