"use strict";
/*
 * 실제 화면 녹화: Chrome 의 화면 캡처(CDP screencast)로 렌더링된 프레임을 그대로 받는다.
 * 소리는 페이지 안 녹음기(browser.js)에서 받는다. 이벤트(점수·성공·실패)는 시간과 함께 기록한다.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class Recorder {
  constructor(page, dir) {
    this.page = page;
    this.dir = dir;
    this.framesDir = path.join(dir, "frames");
    this.frames = []; // { file, t, hash, size }
    this.events = []; // { t, type, label, weight }
    this.t0 = 0;
    this.cdp = null;
    this.audioStartedAt = 0;
  }

  now() {
    return (Date.now() - this.t0) / 1000;
  }

  /** 하이라이트 후보 기록 */
  mark(type, label = "", weight = 1) {
    if (!this.t0) return;
    this.events.push({ t: +this.now().toFixed(3), type, label, weight });
  }

  async start() {
    fs.mkdirSync(this.framesDir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    let n = 0;
    this.cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
      try {
        await this.cdp.send("Page.screencastFrameAck", { sessionId });
      } catch (_) {}
      if (!this.t0 || this.stopped) return;
      const buf = Buffer.from(data, "base64");
      const file = path.join(this.framesDir, `f${String(n++).padStart(6, "0")}.jpg`);
      try {
        fs.writeFileSync(file, buf);
      } catch (_) {
        return; // 실패 처리로 작업 폴더가 지워진 뒤 늦게 온 프레임 (예전에는 여기서 프로그램 전체가 멈췄다)
      }
      const t = metadata.timestamp ? metadata.timestamp - this.t0 / 1000 : this.now();
      this.frames.push({ file, t, size: buf.length, hash: crypto.createHash("md5").update(buf).digest("hex").slice(0, 12) });
    });
    this.t0 = Date.now();
    // 크기를 안 주면 CSS 크기(405x720)로 줄여 보낸다 → 실제 화면 밀도(2배 = 810x1440)로 받는다
    const vp = this.page.viewportSize() || { width: 405, height: 720 };
    const dpr = await this.page.evaluate(() => window.devicePixelRatio || 1).catch(() => 1);
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1, maxWidth: Math.round(vp.width * dpr), maxHeight: Math.round(vp.height * dpr) });
    this.audioStartedAt = await this.page.evaluate(() => (window.__reelAudioStart ? window.__reelAudioStart() : 0)).catch(() => 0);
  }

  async stop() {
    if (this.stopped) return { frames: this.frames, events: this.events, duration: this.now(), audio: null };
    this.stopped = true;
    const duration = this.now();
    try {
      await this.cdp.send("Page.stopScreencast");
    } catch (_) {}
    let audio = null;
    try {
      const a = await this.page.evaluate(() => (window.__reelAudioStop ? window.__reelAudioStop() : null));
      if (a && a.base64) {
        const file = path.join(this.dir, "audio.webm");
        fs.writeFileSync(file, Buffer.from(a.base64, "base64"));
        audio = { file, offset: (a.startedAt - this.t0) / 1000, sources: a.streams };
      }
    } catch (_) {}
    this.frames.sort((a, b) => a.t - b.t);
    return { frames: this.frames, events: this.events, duration, audio };
  }
}

/** 프레임 목록 → 30fps 원본 MP4 (프레임 사이 시간 그대로 유지) */
function framesToConcatList(frames, duration) {
  const lines = ["ffconcat version 1.0"];
  for (let i = 0; i < frames.length; i++) {
    const cur = frames[i];
    const next = i + 1 < frames.length ? frames[i + 1].t : duration;
    const d = Math.max(0.001, next - cur.t);
    lines.push(`file '${cur.file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${d.toFixed(4)}`);
  }
  // concat 규칙: 마지막 파일은 한 번 더 적어야 마지막 duration 이 적용된다
  if (frames.length) lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, "/")}'`);
  return lines.join("\n");
}

/** 실제로 게임 화면이 움직였는지 확인 (정지 화면·빈 화면 녹화를 걸러낸다) */
function motionStats(frames, from = 0, to = Infinity) {
  const inWin = frames.filter((f) => f.t >= from && f.t <= to);
  const unique = new Set(inWin.map((f) => f.hash)).size;
  const span = Math.max(0.001, Math.min(to, inWin.length ? inWin[inWin.length - 1].t : 0) - from);
  return { frames: inWin.length, unique, fps: inWin.length / span };
}

module.exports = { Recorder, framesToConcatList, motionStats };
