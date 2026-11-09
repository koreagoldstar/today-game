#!/usr/bin/env node
"use strict";
/*
 * 자동 실행 명령 (GitHub Actions · 이 PC 공용)
 *   node marketing/run.js produce [--force] [--game <id>]   매일 08:00 — 게임 고르기 → 녹화/재고 → 편집 → 문구 → 검수 → 승인 요청
 *   node marketing/run.js publish                            30분마다 — 텔레그램 답 처리 → 기한 지남 · 멈춘 제작 정리 → 승인 + 시각 지난 것만 게시
 *   node marketing/run.js redo                               관리자가 누른 "문구 다시 · 다시 제작" 처리
 *   node marketing/run.js status                             최근 콘텐츠 상태
 * 필요한 환경 변수: UPSTASH_REDIS_REST_URL · UPSTASH_REDIS_REST_TOKEN (없으면 멈춤)
 *   선택: TG_BOT_TOKEN · TG_ADMIN_CHAT_ID (없으면 콘솔 알림) · BLOB_READ_WRITE_TOKEN · LLM_API_KEY · CHANNEL_MODE_*
 * 공개 저장소라 Actions 로그는 누구나 본다 → 문구 · 미디어 주소 · 토큰은 찍지 않는다.
 */
const fs = require("fs");
const path = require("path");
const { loadEnvFile } = require("./core/env");
loadEnvFile(path.join(__dirname, ".env.local"));

const { createStore } = require("./core/store");
const { createRegistry } = require("./core/registry");
const { createLogger } = require("./core/logger");
const { loadSettings, seoulDay } = require("./core/settings");
const { createApproval } = require("./core/approval");
const { produce, runQueued } = require("./core/pipeline");
const { publishDue } = require("./core/publisher");
const { KO } = require("./core/state");
const { registerChannels } = require("./channels");
const { createCopywriter } = require("./copy/copywriter");
const { createTelegram, consoleNotifier } = require("./approval/telegram");

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);

async function setup() {
  const store = createStore();
  const settings = await loadSettings(store);
  const registry = createRegistry();
  const modes = registerChannels(registry, process.env, { store });
  const logger = createLogger(store);
  registry.register("source", "game", require("./sources/game"));
  registry.register("copywriter", "default", createCopywriter({ store, profileTags: (id) => (require("./renderers/reel/record").loadProfile(id).hashtags || []) }));
  if (process.env.BLOB_READ_WRITE_TOKEN) registry.register("media", "default", require("./media/blob").createBlobMedia());
  const approval = createApproval({ store, settings, registry });
  let telegram = null;
  if (process.env.TG_BOT_TOKEN && process.env.TG_ADMIN_CHAT_ID) {
    telegram = createTelegram({ store, approval, settings, token: process.env.TG_BOT_TOKEN, chatId: process.env.TG_ADMIN_CHAT_ID, logger });
    registry.register("notifier", "default", telegram.notifier);
  } else registry.register("notifier", "default", consoleNotifier);
  const ctx = { store, registry, settings, logger };
  console.log(`채널 ${Object.entries(modes).map(([k, v]) => `${k}:${v}`).join(" ")} · 텔레그램 ${telegram ? "연결" : "미연결"} · 미디어 ${process.env.BLOB_READ_WRITE_TOKEN ? "Blob" : "로컬"} · 문구 ${process.env.LLM_API_KEY ? "AI" : "틀"}`);
  return { ctx, store, settings, registry, telegram, approval };
}

function output(key, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

const brief = (d) => `${d.id} ${KO[d.status] || d.status}${d.failure ? ` [${d.failure.stage}] ${d.failure.reason}` : ""}`;

async function runProduce() {
  const { ctx, store, settings } = await setup();
  const { planToday, produceGate } = require("./core/planner");
  ctx.registry.register("renderer", "reel", require("./renderers/reel"));
  const job = await store.jobStart("produce");
  let result = null;
  try {
    result = await store.withLock("produce", 3600, async () => {
      const gate = produceGate(await store.listContents(100), settings, seoulDay());
      if (!gate.ok && !argv.includes("--force")) return { skipped: gate.reason };
      const { plan, ranked } = await planToday(ctx);
      console.log(`게임 순위: ${ranked.map((g) => `${g.id}(${g.eligible ? g.score : "제외"})`).join(" ")}`);
      const game = opt("--game");
      if (game && !/^[\w-]{1,60}$/.test(game)) throw new Error("게임 id 형식이 올바르지 않습니다.");
      const p = game ? { slot: "feed", kind: "reel", sourceType: "game", sourceId: game, renderer: "reel", channels: settings.channels, reason: `관리자 지정: ${game}` } : plan;
      if (!p) return { skipped: "고를 수 있는 게임이 없습니다" };
      return { doc: await produce(ctx, p) };
    });
  } catch (e) {
    await store.jobEnd(job, { status: "FAILED", error: e.message });
    throw e;
  }
  await store.jobEnd(job, { status: result.doc && result.doc.status === "FAILED" ? "FAILED" : "DONE", result: result.skipped || (result.doc && result.doc.id) });
  console.log(result.skipped ? `건너뜀: ${result.skipped}` : `제작: ${brief(result.doc)}`);
  if (result.doc && result.doc.status === "FAILED") process.exitCode = 1;
}

async function runPublish() {
  const { ctx, store, telegram } = await setup();
  const job = await store.jobStart("publish");
  if (telegram) console.log(`텔레그램: ${JSON.stringify(await telegram.processUpdates())}`);
  // 하루 한 번: 인스타 토큰 만료 확인 · 7일 전부터 갱신 (실패하면 텔레그램)
  if (await store.setJson(`ig:checked:${seoulDay()}`, 1, { nx: true, ex: 2 * 86400 })) {
    const { refreshInstagram } = require("./channels/instagram");
    const notify = (event, extra) => ctx.registry.get("notifier", "default").notify(event, { id: "instagram" }, extra);
    console.log(`인스타 토큰: ${JSON.stringify(await refreshInstagram(store, { notify }))}`);
  }
  const r = await publishDue(ctx);
  await store.jobEnd(job, { result: r });
  console.log(`게시: ${JSON.stringify(r)}`);
  const queued = (await store.listContents(100)).filter((d) => d.redo).length;
  output("redo", queued ? "true" : "false");
  if (queued) console.log(`다시 만들기 대기 ${queued}개`);
  if (r.failed && r.failed.length) process.exitCode = 1; // GitHub 가 실패 메일을 보낸다 (텔레그램 알림과 별도)
}

async function runRedo() {
  const { ctx, store } = await setup();
  ctx.registry.register("renderer", "reel", require("./renderers/reel"));
  const out = await store.withLock("produce", 3600, () => runQueued(ctx));
  for (const d of out) console.log(`다시 만들기: ${brief(d)}`);
}

async function runStatus() {
  const { store } = await setup();
  for (const d of await store.listContents(20)) console.log(brief(d));
}

/** 인스타 계정 연결: 토큰은 명령 인자가 아니라 환경 변수 IG_NEW_TOKEN 으로 (프로세스 목록 · 로그에 안 남게) */
async function runIgConnect() {
  const { store } = await setup();
  const { connectInstagram } = require("./channels/instagram");
  const r = await connectInstagram(store, process.env.IG_NEW_TOKEN);
  console.log(`연결됨: @${r.username} (${r.accountType}) · 만료 ${r.expiresAt.slice(0, 10)}${r.expiresEstimated ? " (60일 추정)" : ""}`);
}

async function runIgStatus() {
  const { store, ctx } = await setup();
  const { instagramStatus } = require("./channels/instagram");
  console.log(JSON.stringify(await instagramStatus(store)));
  console.log(JSON.stringify(await ctx.registry.get("channel", "instagram").health()));
}

const COMMANDS = { produce: runProduce, publish: runPublish, redo: runRedo, status: runStatus, "ig-connect": runIgConnect, "ig-status": runIgStatus };
if (!COMMANDS[cmd]) {
  console.error(`명령: ${Object.keys(COMMANDS).join(" | ")}`);
  process.exit(2);
}
COMMANDS[cmd]().catch((e) => {
  console.error(`실패: ${e.message}`);
  process.exit(1);
});
