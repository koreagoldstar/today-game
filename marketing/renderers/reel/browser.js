"use strict";
/* 녹화용 브라우저: 실제 Chrome, 서버 기록 차단, 서비스워커 차단, 게임 소리 녹음, 밖으로 나간 요청 기록
 * (tools/game-reels/lib/browser.js 에서 가져옴 — 탭 표시 동그라미는 게임 화면에 없는 것이라 뺐다) */
const { chromium } = require("playwright");

// 기본 9:16 휴대폰 화면 (게임별 프로필이 바꿀 수 있음). 캡처 해상도 810x1440
const VIEWPORT = { width: 405, height: 720 };
const DPR = 2;
// gpu: 이 PC(RTX) · cpu: GPU 없는 GitHub Actions 러너와 같은 조건(SwiftShader)
const GPU_ARGS = {
  gpu: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist"],
  cpu: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
};

const BLOCK_HOSTS = /googlesyndication|doubleclick|googletagmanager|google-analytics|adservice|kakao\.com|kakaocdn|vercel-insights|va\.vercel-scripts/i;

/* 페이지 안에서 실행: 게임 소리를 그대로 두고 녹음용 사본만 만든다 */
function audioTapScript() {
  const Native = window.AudioContext || window.webkitAudioContext;
  const rec = (window.__reelAudio = { streams: [], chunks: [], mix: null, mixDest: null, recorder: null, startedAt: 0 });
  if (!Native || typeof MediaRecorder === "undefined") return;
  const origConnect = AudioNode.prototype.connect;
  const taps = new WeakMap();

  function attach(stream) {
    if (!rec.mix || !stream || !stream.getAudioTracks().length) return;
    try {
      origConnect.call(rec.mix.createMediaStreamSource(stream), rec.mixDest);
    } catch (_) {}
  }
  function tapFor(ctx) {
    if (typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext) return null;
    if (ctx === rec.mix) return null;
    let d = taps.get(ctx);
    if (!d) {
      d = ctx.createMediaStreamDestination();
      taps.set(ctx, d);
      rec.streams.push(d.stream);
      attach(d.stream);
    }
    return d;
  }
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = origConnect.call(this, dest, ...rest);
    try {
      if (dest && typeof AudioDestinationNode !== "undefined" && dest instanceof AudioDestinationNode) {
        const t = tapFor(dest.context);
        if (t) origConnect.call(this, t, ...rest);
      }
    } catch (_) {}
    return out;
  };
  // <audio> 로 나는 소리 (배경음 등)
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    try {
      if (!this.__reelTapped && this.captureStream) {
        this.__reelTapped = true;
        const s = this.captureStream();
        const add = () => {
          if (s.getAudioTracks().length && !rec.streams.includes(s)) {
            rec.streams.push(s);
            attach(s);
          }
        };
        s.addEventListener("addtrack", add);
        setTimeout(add, 50);
      }
    } catch (_) {}
    return origPlay.apply(this, a);
  };

  window.__reelAudioStart = () => {
    if (rec.recorder) return rec.startedAt;
    rec.mix = new Native();
    rec.mixDest = rec.mix.createMediaStreamDestination();
    rec.streams.forEach(attach);
    // 소리가 하나도 없어도 녹음이 끊기지 않게 무음 신호를 깔아 둔다
    const g = rec.mix.createGain();
    g.gain.value = 0;
    const o = rec.mix.createOscillator();
    origConnect.call(o, g);
    origConnect.call(g, rec.mixDest);
    o.start();
    rec.recorder = new MediaRecorder(rec.mixDest.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 });
    rec.recorder.ondataavailable = (e) => e.data && e.data.size && rec.chunks.push(e.data);
    rec.recorder.start(250);
    rec.startedAt = Date.now();
    return rec.startedAt;
  };
  window.__reelAudioStop = () =>
    new Promise((resolve) => {
      if (!rec.recorder) return resolve(null);
      rec.recorder.onstop = async () => {
        const blob = new Blob(rec.chunks, { type: "audio/webm" });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        resolve({ base64: btoa(bin), startedAt: rec.startedAt, streams: rec.streams.length });
      };
      rec.recorder.stop();
    });
}

async function launch({ headless = true, render = "gpu", scale = DPR } = {}) {
  if (!GPU_ARGS[render]) throw new Error(`render 는 gpu 또는 cpu: ${render}`);
  return chromium.launch({
    channel: "chrome",
    headless,
    // force-device-scale-factor: 없으면 화면 캡처가 CSS 크기(1배)로 와서 릴스 화질이 반으로 떨어진다
    args: ["--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", `--force-device-scale-factor=${scale}`, ...GPU_ARGS[render]],
  });
}

/**
 * 게임 한 판용 새 컨텍스트 (쿠키·기록이 판마다 깨끗하게 시작)
 * @param {{ viewport?, dpr?, mobile?, instrument?: { script: RegExp, expose: string } | null, localHost?: string }} opts
 * @returns {{ ctx, blocked: string[], external: string[] }} blocked = 막은 /api 요청, external = 로컬 서버 밖으로 나간 요청
 */
async function newGameContext(browser, opts = {}) {
  const mobile = opts.mobile !== false;
  const ctx = await browser.newContext({
    viewport: opts.viewport || VIEWPORT,
    deviceScaleFactor: opts.dpr || DPR,
    isMobile: mobile,
    hasTouch: mobile,
    serviceWorkers: "block",
    locale: "ko-KR",
  });
  const blocked = [];
  const external = [];
  ctx.on("request", (req) => {
    const u = new URL(req.url());
    if (/^https?:$/.test(u.protocol) && u.host !== opts.localHost) external.push(`${req.method()} ${u.host}${u.pathname}`);
  });
  // 랭킹·챌린지·방문수·플레이수 등 서버 기록은 모두 차단 (READ / PLAY / RECORD ONLY)
  await ctx.route(/\/api\//, (route) => {
    blocked.push(route.request().method() + " " + new URL(route.request().url()).pathname);
    return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"recording-mode"}' });
  });
  await ctx.route((url) => BLOCK_HOSTS.test(url.hostname), (route) => route.abort());
  if (opts.instrument) await instrumentRoute(ctx, opts.instrument);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("today-game-muted", "0");
    } catch (_) {}
  });
  await ctx.addInitScript(audioTapScript);
  return { ctx, blocked, external };
}

/*
 * 게임 상태 읽기 (선택): 게임 스크립트 끝에 "읽기 전용 창"을 붙인다.
 * 저장소 파일은 그대로이고, 이 녹화 브라우저 안에서만 적용된다.
 * 조작은 여전히 실제 입력 이벤트로만 한다.
 */
async function instrumentRoute(ctx, { script, expose }) {
  await ctx.route(script, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    const at = body.lastIndexOf("})();");
    if (at < 0) return route.fulfill({ response: res, body });
    body = body.slice(0, at) + `\n;try { window.__reel = { peek: ${expose} }; } catch (_) {}\n` + body.slice(at);
    return route.fulfill({ response: res, body, headers: { ...res.headers(), "content-type": "text/javascript; charset=utf-8" } });
  });
}

module.exports = { launch, newGameContext, VIEWPORT, DPR, GPU_ARGS };
