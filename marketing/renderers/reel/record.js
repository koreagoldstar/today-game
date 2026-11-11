"use strict";
/*
 * 게임 1개 녹화 → 원본 MP4 + 메타 JSON (편집 전 클립)
 *  로컬 서버(이 저장소 사본)에서 실행 · /api 는 서버와 브라우저 양쪽에서 막음 · 서비스워커 차단 · 로컬 밖으로 나간 요청은 기록
 *  실패하면 실패로 남긴다: 시작 못 함 · 화면이 거의 안 움직임 · 게임 안에서 일어난 일이 없음 · 화면 갱신이 너무 느림(GPU 없는 3D 등)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { startServer } = require("./server");
const { launch, newGameContext } = require("./browser");
const { Recorder, motionStats } = require("./recorder");
const { GameIO } = require("./io");
const { checkFfmpeg, makeRaw, probe } = require("./encode");
const { gameHash } = require("../../core/clips");

const ROOT = path.resolve(__dirname, "../../..");
const PROFILES = path.join(ROOT, "marketing", "profiles");

class RecordError extends Error {
  constructor(stage, message) {
    super(message);
    this.stage = stage;
  }
}

function loadProfile(id) {
  const file = path.join(PROFILES, `${id}.json`);
  if (!/^[\w-]+$/.test(id) || !fs.existsSync(file)) throw new Error(`녹화 프로필이 없습니다: ${id}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const listProfiles = () => fs.readdirSync(PROFILES).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));

function playerFor(profile) {
  if (profile.player === "autopilot") return require("./players/autopilot").create(profile);
  return require(`./players/${profile.player}`);
}

/**
 * @param {object} profile  marketing/profiles/<id>.json
 * @param {{ render?: "gpu"|"cpu", outDir: string, siteRoot?: string, headless?: boolean, log?: Function }} o
 */
async function recordGame(profile, o) {
  const siteRoot = o.siteRoot || ROOT;
  const render = o.render || (profile.needsGpu ? "gpu" : "cpu");
  const log = o.log || (() => {});
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const id = `${profile.id}-${stamp}-${crypto.randomBytes(2).toString("hex")}`;
  const outDir = path.join(o.outDir, profile.id);
  const work = path.join(o.outDir, "_work", id);
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const logFile = path.join(outDir, `${id}.log`);
  const meta = { id, gameId: profile.id, profile: profile.id, render, recordedAt: new Date().toISOString(), gameHash: gameHash(siteRoot, profile.id), ok: false };
  const pageErrors = [];
  let server, browser, ctx, rec;
  try {
    checkFfmpeg();
    server = await startServer(siteRoot);
    browser = await launch({ headless: o.headless !== false, render, scale: profile.dpr || 2 });
    const player = playerFor(profile);
    const made = await newGameContext(browser, { viewport: profile.viewport, dpr: profile.dpr, mobile: profile.mobile, localHost: new URL(server.url).host, instrument: player.instrument });
    ctx = made.ctx;
    const page = await ctx.newPage();
    page.on("pageerror", (e) => pageErrors.push(e.message));
    const resp = await page.goto(server.url + profile.path, { waitUntil: "load", timeout: 60000 }).catch((e) => {
      throw new RecordError("load", `게임을 열지 못함: ${e.message}`);
    });
    if (!resp || !resp.ok()) throw new RecordError("load", `게임을 열지 못함: HTTP ${resp && resp.status()}`);
    if (profile.ready) await page.waitForFunction(profile.ready, null, { timeout: 45000 }).catch(() => {
      throw new RecordError("load", "게임이 준비되지 않음 (첫 화면을 기다리다 시간 초과)");
    });

    rec = new Recorder(page, work);
    await rec.start();
    const io = new GameIO(page, rec, { id: profile.id });
    log(`${profile.id}: 시작 (${render})`);
    const started = await player.start(io).catch((e) => {
      throw new RecordError("start", `게임 시작 실패: ${e.message}`);
    });
    if (!started) throw new RecordError("start", "게임 시작 실패 (플레이 화면으로 넘어가지 않음)");
    io.deadline = Date.now() + profile.rawSec * 1000;
    await player.play(io).catch((e) => {
      throw new RecordError("play", `자동 플레이 중 오류: ${e.message}`);
    });
    const raw = await rec.stop();

    // 가짜 성공 금지: 실제로 움직이고 게임 안에서 일이 일어났는지
    const m = motionStats(raw.frames);
    const fps = raw.frames.length / Math.max(1, raw.duration);
    const playEvents = raw.events.filter((e) => e.type !== "start");
    Object.assign(meta, { durationSec: +raw.duration.toFixed(2), frames: raw.frames.length, uniqueFrames: m.unique, captureFps: +fps.toFixed(1), events: raw.events.map(({ t, type, label, weight }) => ({ t, type, label, weight })) });
    if (fps < (profile.minFps || 20)) throw new RecordError("record", `화면 갱신이 너무 느림 (초당 ${fps.toFixed(1)}장, 최소 ${profile.minFps || 20}장) — ${render === "cpu" ? "GPU 없는 환경에서는 녹화할 수 없는 게임" : "PC 상태 확인 필요"}`);
    if (m.unique < raw.duration * 5) throw new RecordError("record", `화면이 거의 움직이지 않음 (서로 다른 장면 ${m.unique}개)`);
    if (!playEvents.length) throw new RecordError("play", "게임 안에서 일어난 일이 기록되지 않음 (조종이 안 됐을 수 있음)");

    const file = path.join(outDir, `${id}.mp4`);
    const out = await makeRaw(raw, work, file, logFile);
    const info = probe(file);
    if (!info || !info.width) throw new RecordError("encode", "원본 영상 확인 실패");
    Object.assign(meta, {
      ok: true,
      file: path.relative(ROOT, file).replace(/\\/g, "/"),
      bytes: fs.statSync(file).size,
      video: info,
      hasAudio: out.hasAudio,
      apiBlocked: made.blocked.length,
      apiBlockedList: [...new Set(made.blocked)],
      externalHosts: [...new Set(made.external.map((x) => x.split(" ")[1].split("/")[0]))],
      prodRequests: made.external.filter((x) => /todaygame\.co\.kr/.test(x)),
      pageErrors,
    });
    log(`${profile.id}: 완료 ${meta.durationSec}초 · 초당 ${meta.captureFps}장 · 이벤트 ${playEvents.length}`);
  } catch (e) {
    Object.assign(meta, { ok: false, stage: e.stage || "unknown", reason: e.message, pageErrors });
    log(`${profile.id}: 실패 — ${e.message}`);
  } finally {
    if (rec) await rec.stop().catch(() => {});
    if (ctx) await ctx.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
    fs.rmSync(work, { recursive: true, force: true });
    fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(meta, null, 2));
  }
  return meta;
}

module.exports = { recordGame, loadProfile, listProfiles, gameHash, ROOT };
