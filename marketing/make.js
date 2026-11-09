#!/usr/bin/env node
"use strict";
/*
 * 시험 제작: 게임 → (녹화) → 릴스 편집 · 커버 · 문구 · 검수 → 승인 대기까지. 게시는 하지 않는다.
 *   node marketing/make.js reaction                  지금 녹화해서 만들기
 *   node marketing/make.js reaction lava-surfers --latest   out/clips 의 가장 최근 녹화로
 *   옵션: --template pop|neon|ribbon
 * 저장소는 메모리(운영 Redis 를 건드리지 않음). 결과 파일은 marketing/out/reels/ (git 제외).
 */
const fs = require("fs");
const path = require("path");
const { createFakeUpstash } = require("./core/memory-redis");
const { createStore } = require("./core/store");
const { createRegistry } = require("./core/registry");
const { createLogger } = require("./core/logger");
const { DEFAULTS, merge, validate } = require("./core/settings");
const { produce } = require("./core/pipeline");
const { registerChannels } = require("./channels");
const { createCopywriter } = require("./copy/copywriter");
const { loadProfile } = require("./renderers/reel/record");

const argv = process.argv.slice(2);
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const games = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--template");

function latestClip(game) {
  const dir = path.join(__dirname, "out", "clips", game);
  const ok = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((m) => m.ok && m.file && fs.existsSync(path.join(__dirname, "..", m.file)) && m.video && m.video.width === 810)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  if (!ok.length) throw new Error(`${game}: 쓸 수 있는 녹화가 없습니다. 먼저 node marketing/record.js ${game}`);
  return ok[0].file;
}

(async () => {
  if (!games.length) throw new Error("게임 id 를 적어 주세요. 예: node marketing/make.js reaction");
  const mem = createFakeUpstash({ jitter: false });
  const store = createStore({ url: mem.url, token: mem.token, fetchImpl: mem.fetchImpl });
  const registry = createRegistry();
  registerChannels(registry, {});
  registry.register("source", "game", require("./sources/game"));
  registry.register("renderer", "reel", require("./renderers/reel"));
  const copy = createCopywriter({ store, profileTags: (id) => (loadProfile(id).hashtags || []) });
  registry.register("copywriter", "default", copy);
  const settings = validate(merge(DEFAULTS, {}));
  const logger = createLogger(store);
  const ctx = { store, registry, settings, logger };
  console.log(`문구: ${copy.model ? `AI (${copy.model})` : "틀 문구 (LLM_API_KEY 없음)"} · 저장소: 메모리\n`);

  const summary = [];
  for (const g of games) {
    const plan = { slot: "feed", kind: "reel", sourceType: "game", sourceId: g, renderer: "reel", template: opt("--template"), channels: settings.channels, clipFile: argv.includes("--latest") ? latestClip(g) : null, reason: "시험 제작" };
    const t0 = Date.now();
    const d = await produce(ctx, plan);
    const bad = (d.qc && d.qc.checks.filter((c) => !c.ok)) || [];
    console.log(`\n${g}: ${d.status}  (${Math.round((Date.now() - t0) / 1000)}초, 다시 만들기 ${d.redoCount || 0}번)`);
    if (d.failure) console.log(`  실패: [${d.failure.stage}] ${d.failure.reason}`);
    if (d.render) {
      for (const f of d.render.files) console.log(`  ${f.role}: ${path.relative(path.join(__dirname, ".."), f.path)}`);
      console.log(`  템플릿 ${d.render.meta.template} · 첫 문구 "${d.render.meta.hook}" · ${d.render.meta.durationSec}초 · 게임 소리 ${d.render.meta.gameSound ? "있음" : "없음"}`);
    }
    if (d.qc) console.log(`  검수: ${d.qc.passed ? "통과" : "불합격"} (${d.qc.checks.length}항목${bad.length ? `, 실패 ${bad.map((c) => c.reason).join(" / ")}` : ""})`);
    if (d.copy && d.copy.instagram) console.log(`  인스타 문구 (${d.copy.instagram.source}):\n    ${d.copy.instagram.caption.replace(/\n/g, "\n    ")}\n    ${d.copy.instagram.hashtags.join(" ")}`);
    summary.push({ game: g, status: d.status, redo: d.redoCount || 0, failure: d.failure, files: d.render && d.render.files.map((f) => path.relative(path.join(__dirname, ".."), f.path)), meta: d.render && d.render.meta, qc: d.qc, copy: d.copy });
  }
  fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "out", "make-summary.json"), JSON.stringify(summary, null, 2));
  process.exitCode = summary.every((s) => s.status === "READY_FOR_APPROVAL") ? 0 : 1;
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
