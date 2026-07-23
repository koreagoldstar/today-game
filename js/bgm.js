(() => {
  "use strict";

  /**
   * 오늘의 게임 공통 BGM
   * 사용: <body data-bgm="tetris"> + <script src="/js/bgm.js"></script>
   * 첫 터치/클릭 후 재생 (브라우저 자동재생 정책)
   */
  const THEMES = {
    "chick-shield": {
      bpm: 148,
      scale: [392.0, 440.0, 523.25, 587.33, 659.25, 783.99],
      style: "arcade",
    },
    "cute-shoot": {
      bpm: 140,
      scale: [392, 466.16, 523.25, 587.33, 698.46, 783.99],
      style: "arcade",
    },
    goindol: {
      bpm: 128,
      scale: [261.63, 329.63, 392.0, 493.88, 523.25, 659.25],
      style: "adventure",
    },
    tetris: {
      bpm: 148,
      scale: [329.63, 392.0, 440.0, 493.88, 587.33, 659.25],
      style: "chip",
    },
    flappy: {
      bpm: 150,
      scale: [392.0, 466.16, 523.25, 587.33, 698.46, 783.99],
      style: "arcade",
    },
    doodle: {
      bpm: 136,
      scale: [349.23, 415.3, 466.16, 523.25, 622.25, 698.46],
      style: "bounce",
    },
    wordle: {
      bpm: 118,
      scale: [329.63, 392.0, 440.0, 523.25, 587.33, 659.25],
      style: "puzzle",
    },
    tower: {
      bpm: 132,
      scale: [349.23, 415.3, 466.16, 523.25, 622.25, 698.46],
      style: "bounce",
    },
    "slide-2048": {
      bpm: 126,
      scale: [293.66, 349.23, 392.0, 440.0, 523.25, 587.33],
      style: "puzzle",
    },
    brick: {
      bpm: 152,
      scale: [246.94, 311.13, 369.99, 466.16, 554.37, 698.46],
      style: "rock",
    },
    memory: {
      bpm: 134,
      scale: [392.0, 440.0, 493.88, 587.33, 659.25, 783.99],
      style: "match",
    },
    "fruit-catch": {
      bpm: 138,
      scale: [369.99, 440.0, 523.25, 587.33, 659.25, 783.99],
      style: "tropical",
    },
    "bubble-pop": {
      bpm: 144,
      scale: [415.3, 493.88, 554.37, 659.25, 739.99, 880.0],
      style: "pop",
    },
    ttamogi: {
      bpm: 136,
      scale: [311.13, 369.99, 415.3, 466.16, 554.37, 622.25],
      style: "chase",
    },
    suika: {
      bpm: 130,
      scale: [329.63, 392.0, 466.16, 523.25, 587.33, 698.46],
      style: "juicy",
    },
    "puzzle-bubble": {
      bpm: 142,
      scale: [349.23, 415.3, 493.88, 523.25, 622.25, 739.99],
      style: "candy",
    },
    diff: {
      bpm: 128,
      scale: [392.0, 466.16, 523.25, 587.33, 659.25, 783.99],
      style: "curious",
    },
    sokoban: {
      bpm: 120,
      scale: [261.63, 311.13, 349.23, 392.0, 466.16, 523.25],
      style: "puzzle",
    },
    crossy: {
      bpm: 146,
      scale: [293.66, 349.23, 440.0, 523.25, 587.33, 698.46],
      style: "run",
    },
    "stork-stride": {
      bpm: 108,
      scale: [220.0, 261.63, 329.63, 392.0, 440.0, 523.25],
      style: "adventure",
    },
    "ninja-dodge": {
      bpm: 156,
      scale: [246.94, 311.13, 369.99, 440.0, 554.37, 659.25],
      style: "chase",
    },
    alggagi: {
      bpm: 130,
      scale: [349.23, 392.0, 440.0, 523.25, 587.33, 659.25],
      style: "sport",
    },
    "whack-mole": {
      bpm: 148,
      scale: [369.99, 440.0, 523.25, 587.33, 659.25, 783.99],
      style: "bounce",
    },
    reaction: {
      bpm: 132,
      scale: [392.0, 466.16, 523.25, 587.33, 698.46, 783.99],
      style: "arcade",
    },
    "order-memo": {
      bpm: 126,
      scale: [349.23, 392.0, 466.16, 523.25, 587.33, 698.46],
      style: "puzzle",
    },
    "jump-run": {
      bpm: 168,
      scale: [329.63, 392.0, 466.16, 523.25, 622.25, 740.0, 880.0],
      style: "hype",
    },
    pinball: {
      bpm: 150,
      scale: [311.13, 392.0, 466.16, 554.37, 659.25, 783.99],
      style: "arcade",
    },
    rps: {
      bpm: 172,
      scale: [329.63, 392.0, 466.16, 523.25, 622.25, 740.0, 880.0],
      style: "hype",
    },
    "odd-even": {
      bpm: 180,
      scale: [349.23, 415.3, 493.88, 587.33, 698.46, 830.61, 987.77],
      style: "rush",
    },
    "donkey-kong": {
      bpm: 148,
      scale: [293.66, 349.23, 392.0, 466.16, 554.37, 659.25],
      style: "arcade",
    },
    omok: {
      bpm: 118,
      scale: [261.63, 311.13, 392.0, 466.16, 523.25, 622.25],
      style: "puzzle",
    },
    snake: {
      bpm: 140,
      scale: [329.63, 392.0, 440.0, 523.25, 587.33, 698.46],
      style: "chip",
    },
    minesweeper: {
      bpm: 112,
      scale: [277.18, 329.63, 392.0, 440.0, 523.25, 587.33],
      style: "curious",
    },
    prince: {
      bpm: 126,
      scale: [293.66, 349.23, 415.3, 466.16, 554.37, 659.25],
      style: "adventure",
    },
    lemmings: {
      bpm: 134,
      scale: [349.23, 392.0, 466.16, 523.25, 587.33, 698.46],
      style: "bounce",
    },
    "bubble-bobble": {
      bpm: 146,
      scale: [392.0, 466.16, 523.25, 587.33, 698.46, 783.99],
      style: "pop",
    },
    "pacman-classic": {
      bpm: 152,
      scale: [329.63, 392.0, 493.88, 587.33, 659.25, 783.99],
      style: "arcade",
    },
    galaga: {
      bpm: 160,
      scale: [311.13, 392.0, 466.16, 554.37, 659.25, 783.99],
      style: "rock",
    },
    "lode-runner": {
      bpm: 136,
      scale: [261.63, 329.63, 392.0, 440.0, 523.25, 622.25],
      style: "chase",
    },
    racing: {
      bpm: 158,
      scale: [311.13, 392.0, 466.16, 523.25, 622.25, 783.99],
      style: "race",
    },
    "drift-chick": {
      bpm: 148,
      scale: [329.63, 392.0, 440.0, 523.25, 587.33, 698.46],
      style: "race",
    },
    minigolf: {
      bpm: 122,
      scale: [349.23, 392.0, 440.0, 523.25, 587.33, 659.25],
      style: "sport",
    },
    rhythm: {
      bpm: 150,
      scale: [329.63, 392.0, 493.88, 587.33, 659.25, 783.99],
      style: "club",
    },
    hub: {
      bpm: 118,
      scale: [392.0, 440.0, 523.25, 587.33, 659.25, 783.99],
      style: "party",
    },
  };

  let ctx = null;
  let timer = null;
  let step = 0;
  let currentId = null;
  let unlocked = false;
  let muted = false;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when) {
    if (!ctx || muted) return;
    const t0 = when != null ? when : ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(Math.max(0.0001, vol), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, when, hp) {
    if (!ctx || muted) return;
    const t0 = when != null ? when : ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp || 900;
    src.buffer = buf;
    gain.gain.setValueAtTime(Math.max(0.0001, vol), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function leadType(style) {
    if (style === "chip" || style === "arcade" || style === "race") return "square";
    if (style === "rock" || style === "chase") return "sawtooth";
    return "triangle";
  }

  function tickTheme(theme) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const scale = theme.scale;
    const style = theme.style;
    const bass = scale[0] / 2;
    const lt = leadType(style);

    // kick — always energetic four-on-floor variants
    if (style === "race" || style === "rock" || style === "chase" || style === "hype" || style === "rush") {
      if (s % 4 === 0 || s === 6 || s === 10) {
        tone(100, 0.08, "sine", style === "rush" ? 0.22 : 0.18, t);
        tone(48, 0.14, "triangle", style === "rush" ? 0.15 : 0.12, t);
      }
      if ((style === "hype" || style === "rush") && (s === 2 || s === 8 || s === 14)) {
        tone(90, 0.05, "sine", style === "rush" ? 0.1 : 0.08, t);
      }
      if (style === "rush" && s === 0) {
        tone(55, 0.12, "sine", 0.16, t);
        tone(110, 0.06, "triangle", 0.08, t + 0.04);
      }
    } else if (style === "puzzle" || style === "curious" || style === "sport") {
      if (s === 0 || s === 8 || s === 4 || s === 12) {
        tone(95, 0.1, "sine", 0.15, t);
        tone(50, 0.14, "triangle", 0.1, t);
      }
    } else {
      if (s % 4 === 0) {
        tone(108, 0.09, "sine", 0.18, t);
        tone(52, 0.15, "triangle", 0.12, t);
      }
    }

    // hats
    if (s % 2 === 1) noise(0.03, style === "hype" || style === "rush" ? 0.065 : 0.045, t, 1800);
    else if (style === "club" || style === "party" || style === "pop" || style === "hype" || style === "rush") {
      noise(0.02, style === "rush" ? 0.05 : style === "hype" ? 0.04 : 0.025, t, 2200);
    }

    // snare / clap
    if (s === 4 || s === 12) {
      noise(0.09, style === "rush" ? 0.13 : style === "hype" ? 0.11 : 0.085, t, 700);
      tone(190, 0.07, "triangle", 0.04, t);
    }
    if ((style === "hype" || style === "rush" || style === "race" || style === "arcade") && (s === 10 || s === 14)) {
      noise(0.05, style === "rush" ? 0.075 : 0.06, t, 1200);
    }

    // bass
    if (s % 2 === 0) {
      const root = bass * (bar % 2 === 0 ? 1 : style === "hype" || style === "rush" ? 1.33 : 1.25);
      const btype = style === "chip" ? "square" : "sawtooth";
      tone(root, 0.14, btype, style === "rush" ? 0.07 : style === "hype" ? 0.06 : 0.045, t);
      tone(root * 0.5, 0.16, "sine", 0.035, t);
      if ((style === "hype" || style === "rush") && s % 4 === 0) {
        tone(root * 1.5, 0.08, "square", style === "rush" ? 0.03 : 0.02, t + 0.03);
      }
    }

    // melody hooks — unique-ish by style index
    const melEvery =
      style === "chip" || style === "arcade" || style === "race" || style === "run" || style === "hype" || style === "rush"
        ? 1
        : style === "puzzle" || style === "sport"
          ? 2
          : 2;
    if (s % melEvery === 0 || s === 3 || s === 11) {
      const idx = (step + bar * 3 + (style.length % 5)) % scale.length;
      const note = scale[idx];
      const lead = style === "hype" || style === "rush" ? "sawtooth" : lt;
      tone(note, style === "rush" ? 0.085 : style === "hype" ? 0.09 : 0.1, lead, style === "rush" ? 0.06 : style === "hype" ? 0.055 : 0.05, t);
      if (style === "tropical" || style === "juicy" || style === "candy" || style === "pop") {
        tone(note * 1.5, 0.08, "sine", 0.025, t + 0.015);
      }
      if (style === "electro" || style === "club" || style === "race" || style === "hype" || style === "rush") {
        tone(note * 2, 0.06, "square", style === "rush" ? 0.032 : style === "hype" ? 0.028 : 0.02, t + 0.02);
      }
      if (style === "rush" && (s === 0 || s === 8)) {
        tone(note * 1.25, 0.1, "sawtooth", 0.035, t + 0.04);
      }
    }

    // style flourishes
    if (style === "bounce" && s === 0) tone(scale[4], 0.2, "triangle", 0.04, t);
    if (style === "match" && (s === 2 || s === 6)) tone(scale[5], 0.08, "sine", 0.035, t);
    if (style === "adventure" && s === 0) {
      tone(scale[0], 0.12, "triangle", 0.04, t);
      tone(scale[2], 0.12, "triangle", 0.035, t + 0.08);
      tone(scale[4], 0.16, "triangle", 0.035, t + 0.16);
    }
    if (style === "chillparty" && s % 8 === 0) tone(scale[3] * 2, 0.18, "sine", 0.03, t);
    if (style === "hype" || style === "rush") {
      if (s === 0) {
        tone(scale[5], 0.12, "sawtooth", style === "rush" ? 0.05 : 0.04, t);
        tone(scale[6] || scale[5] * 1.2, 0.1, "square", style === "rush" ? 0.04 : 0.03, t + 0.06);
      }
      if (s === 7 || s === 15) noise(0.04, style === "rush" ? 0.07 : 0.05, t, 2500);
      if (style === "rush" && (s === 3 || s === 11)) {
        tone(scale[4] * 2, 0.05, "square", 0.03, t);
        noise(0.03, 0.04, t + 0.02, 3000);
      }
    }

    step += 1;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    currentId = null;
  }

  function start(id) {
    if (muted) return;
    const theme = THEMES[id] || THEMES.hub;
    if (!ensureCtx()) return;
    if (currentId === id && timer) return;
    stop();
    currentId = id;
    step = Math.floor(Math.random() * 8);
    const stepMs = (60 / theme.bpm) * 1000 * 0.5;
    timer = setInterval(() => tickTheme(theme), stepMs);
    tickTheme(theme);
  }

  function unlock() {
    unlocked = true;
    ensureCtx();
  }

  function setMuted(v) {
    muted = !!v;
    if (muted) stop();
  }

  function bindAuto(id) {
    if (!id || id === "rhythm") return; // rhythm has its own per-song BGM
    const kick = () => {
      unlock();
      start(id);
    };
    document.addEventListener(
      "pointerdown",
      () => {
        kick();
      },
      { once: true, capture: true }
    );
    document.addEventListener(
      "keydown",
      () => {
        kick();
      },
      { once: true, capture: true }
    );
    const bindButtons = () => {
      ["start-btn", "retry-btn", "again-btn", "next-btn", "endless-btn"].forEach((name) => {
        const el = document.getElementById(name);
        if (el) {
          el.addEventListener("click", () => {
            unlock();
            start(id);
          });
        }
      });
    };
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", bindButtons);
    } else {
      bindButtons();
    }
  }

  window.TodayBGM = { start, stop, unlock, setMuted, themes: THEMES };

  const autoId = document.body && document.body.dataset ? document.body.dataset.bgm : null;
  if (autoId) bindAuto(autoId);

  /** 게임 페이지 오픈 시 플레이 카운트 (+세션당 1회) */
  function trackPlayOpen() {
    try {
      const path = String(location.pathname || "");
      const m = path.match(/\/games\/([^/]+)\//);
      const game = m ? m[1] : "";
      if (!game || game === "hidden") return;
      const flag = `today-game-play-hit-${game}`;
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
      const body = JSON.stringify({ game });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/plays", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch (_) {
      /* ignore */
    }
  }
  trackPlayOpen();
})();
