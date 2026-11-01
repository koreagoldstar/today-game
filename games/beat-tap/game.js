/*
 * 펄스 탭 — 네온 무대 원버튼 리듬
 *  - 빛나는 노트가 도로를 타고 내려와 아래 링에 닿을 때 화면 아무 데나 탭
 *  - 음악은 진짜 곡(mp3). 시계는 재생 위치(currentTime) → 음악이 끊겨도 노트가 같이 멈춤
 *  - 음표는 곡의 실제 박자 위에 있음 (songs.js)
 *  - 그림은 코드로 그린 네온. 번짐은 미리 그린 그림을 겹쳐서 (휴대폰에서도 빠르게)
 *  - 점검: window.PulseTap (scripts/test-beat-tap.js)
 */
(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const CX = W / 2;
  const VP_Y = 166; // 도로가 사라지는 곳
  const PAD_Y = 590; // 판정 링
  const PAD_R = 62;
  const ROAD_BOTTOM = 196; // 화면 아래에서 도로 절반 너비
  const ROAD_TOP = 14;
  const TAU = Math.PI * 2;
  const LATENCY = 0.03;
  const { COURSES, SONGS } = window.PulseSongs;
  const STARS_KEY = "beat-tap-stars-v3";
  const BEST_KEY = "beat-tap-best-v3";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const $ = (id) => document.getElementById(id);
  const overlays = { title: $("title"), songs: $("songs"), clear: $("clear"), over: $("over"), all: $("allclear") };

  /* ---------- 저장 ---------- */
  const stars = new Array(SONGS.length).fill(0);
  const best = new Array(SONGS.length).fill(0);
  try {
    const s = JSON.parse(localStorage.getItem(STARS_KEY) || "null");
    const b = JSON.parse(localStorage.getItem(BEST_KEY) || "null");
    if (Array.isArray(s)) s.forEach((v, i) => i < stars.length && (stars[i] = Number(v) || 0));
    if (Array.isArray(b)) b.forEach((v, i) => i < best.length && (best[i] = Number(v) || 0));
  } catch (_) {
    /* 저장소를 못 써도 게임은 계속 */
  }
  function saveAll() {
    try {
      localStorage.setItem(STARS_KEY, JSON.stringify(stars));
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch (_) {
      /* 저장소를 못 써도 게임은 계속 */
    }
  }
  const totalStars = () => stars.reduce((a, b) => a + b, 0);
  const totalBest = () => best.reduce((a, b) => a + b, 0);
  const nextSong = () => {
    const i = stars.findIndex((v) => v === 0);
    return i < 0 ? 0 : i;
  };

  /* ---------- 음악 · 시계 ---------- */
  const clock = { mode: "perf", t0: 0, manual: 0, pausedPerf: 0 };
  let musicEl = null;
  let waitT = 0;
  function musicElement() {
    if (!musicEl) {
      musicEl = new Audio();
      musicEl.preload = "auto";
      if (window.TodayAudio && TodayAudio.trackMedia) TodayAudio.trackMedia(musicEl);
    }
    return musicEl;
  }
  function setVolume(v) {
    if (!musicEl) return;
    if (window.TodayAudio && TodayAudio.isMuted && TodayAudio.isMuted()) return;
    musicEl.volume = v;
  }
  function startMusic(s) {
    const el = musicElement();
    if (!el.src.endsWith(s.src)) el.src = s.src;
    el.playbackRate = 1;
    const seek = () => {
      if (Math.abs(el.currentTime - s.startAt) > 0.3) {
        try {
          el.currentTime = s.startAt;
        } catch (_) {
          /* 정보가 오면 다시 */
        }
      }
    };
    seek();
    el.onloadedmetadata = seek;
    setVolume(0.9);
    clock.mode = "audio";
    waitT = 0;
    const p = el.play();
    if (p && p.catch) p.catch(() => useSilentClock());
  }
  /** 음악을 못 틀면 소리 없이라도 게임은 진행 */
  function useSilentClock() {
    if (clock.mode !== "audio" || state !== "play") return;
    clock.mode = "perf";
    clock.t0 = performance.now();
  }
  function stopMusic() {
    if (musicEl) musicEl.pause();
  }
  function now() {
    if (clock.mode === "manual") return clock.manual;
    if (clock.mode === "audio" && song) return musicEl.currentTime - song.startAt - LATENCY;
    return (performance.now() - clock.t0) / 1000;
  }

  /* ---------- 효과음 (음악 키와 상관없는 타악기) ---------- */
  let ac = null;
  let noiseBuf = null;
  function audioCtx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          ac = new AC();
          noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
        } catch (_) {
          ac = null;
        }
      }
    }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  }
  function noise(dur, freq, type, vol) {
    if (!ac || ac.state !== "running") return;
    const t = ac.currentTime;
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(ac.destination);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
  function tone(freq, dur, type, vol, delay = 0) {
    if (!ac || ac.state !== "running") return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const sfx = {
    hit(perfect) {
      noise(0.09, 1800, "highpass", perfect ? 0.34 : 0.26);
      noise(0.05, 700, "bandpass", 0.2);
      if (perfect) noise(0.035, 7500, "highpass", 0.2);
    },
    miss() {
      tone(150, 0.14, "sine", 0.16);
    },
    tap() {
      noise(0.025, 3000, "highpass", 0.06);
    },
    combo() {
      [880, 1320, 1760].forEach((f, i) => tone(f, 0.12, "square", 0.035, i * 0.05));
    },
    clear() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.05, i * 0.09));
    },
    star(i) {
      tone(880 + i * 280, 0.22, "square", 0.05);
    },
    fail() {
      [330, 262, 196].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.05, i * 0.14));
    },
  };

  /* ---------- 상태 ---------- */
  let state = "title";
  let songIndex = 0;
  let song = null;
  let course = COURSES[0];
  let notes = [];
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hearts = 0;
  let hits = 0;
  let perfects = 0;
  let earned = 0;
  let floats = [];
  let parts = [];
  let waves = [];
  let pillar = 0;
  let pillarCol = 0;
  let padFlash = 0;
  let padPress = 0;
  let missDim = 0;
  let screenFlash = 0;
  let beatPulse = 0;
  let barPulse = 0;
  let lastBeat = -1;
  let timeAnim = 0;
  let last = 0;
  let bg = null;
  let bgKey = -1;

  /* ---------- 미리 그려 둔 빛 ---------- */
  const NEON = [
    { c: "#ff4fa3", l: "#ffb0d6", d: "#b0125f", rgb: "255,79,163" },
    { c: "#ffd23f", l: "#fff0a8", d: "#c98500", rgb: "255,210,63" },
    { c: "#27e3ff", l: "#b8f6ff", d: "#0a7fb0", rgb: "39,227,255" },
    { c: "#b06bff", l: "#e0c4ff", d: "#5d24c2", rgb: "176,107,255" },
  ];
  const THEMES = [
    { top: "#0b0626", mid: "#2b0f63", low: "#4a1786", railA: 0, railB: 2, horizon: "rgba(255,79,163,0.5)" },
    { top: "#031420", mid: "#07304a", low: "#0d5a6e", railA: 2, railB: 3, horizon: "rgba(39,227,255,0.5)" },
    { top: "#1c0733", mid: "#6a1a5e", low: "#d6502f", railA: 1, railB: 0, horizon: "rgba(255,170,70,0.75)" },
    { top: "#03051e", mid: "#120f52", low: "#2c1a86", railA: 3, railB: 2, horizon: "rgba(150,120,255,0.55)" },
  ];
  function sprite(size, draw) {
    const c = document.createElement("canvas");
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.translate(size / 2, size / 2);
    draw(g, size);
    return c;
  }
  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
  }
  /** 음표 모양 (가운데 기준) */
  function noteGlyph(g, r) {
    g.beginPath();
    g.ellipse(-r * 0.26, r * 0.42, r * 0.3, r * 0.22, -0.35, 0, TAU);
    g.fill();
    g.fillRect(r * 0.0, -r * 0.62, r * 0.13, r * 1.06);
    g.beginPath();
    g.moveTo(r * 0.06, -r * 0.62);
    g.quadraticCurveTo(r * 0.5, -r * 0.52, r * 0.56, -r * 0.08);
    g.quadraticCurveTo(r * 0.36, -r * 0.3, r * 0.06, -r * 0.3);
    g.closePath();
    g.fill();
  }
  function drawNoteArt(g, C, R) {
    const gl = g.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 1.5);
    gl.addColorStop(0, `rgba(${C.rgb},0.65)`);
    gl.addColorStop(1, `rgba(${C.rgb},0)`);
    g.fillStyle = gl;
    circle(g, 0, 0, R * 1.5);
    g.fill();
    const d = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
    d.addColorStop(0, C.l);
    d.addColorStop(0.55, C.c);
    d.addColorStop(1, C.d);
    g.fillStyle = d;
    circle(g, 0, 0, R);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.92)";
    g.lineWidth = R * 0.085;
    circle(g, 0, 0, R * 0.95);
    g.stroke();
    g.fillStyle = "#fff";
    noteGlyph(g, R * 0.86);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.ellipse(-R * 0.36, -R * 0.5, R * 0.3, R * 0.16, -0.6, 0, TAU);
    g.fill();
  }
  function drawPadArt(g, R, hot, colA, colB) {
    const A = hot ? NEON[1] : colA;
    const B = hot ? NEON[1] : colB;
    const gl = g.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 1.6);
    gl.addColorStop(0, `rgba(${A.rgb},${hot ? 0.75 : 0.45})`);
    gl.addColorStop(1, `rgba(${B.rgb},0)`);
    g.fillStyle = gl;
    circle(g, 0, 0, R * 1.6);
    g.fill();
    // 안쪽 유리
    const inner = g.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R);
    inner.addColorStop(0, hot ? "rgba(255,240,170,0.5)" : "rgba(70,40,130,0.72)");
    inner.addColorStop(1, hot ? "rgba(255,190,60,0.3)" : "rgba(10,6,34,0.86)");
    g.fillStyle = inner;
    circle(g, 0, 0, R * 0.92);
    g.fill();
    // 고리 두 겹
    const ring = g.createLinearGradient(-R, -R, R, R);
    ring.addColorStop(0, A.l);
    ring.addColorStop(0.5, A.c);
    ring.addColorStop(1, B.c);
    g.strokeStyle = ring;
    g.lineWidth = R * 0.14;
    circle(g, 0, 0, R);
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = R * 0.035;
    circle(g, 0, 0, R);
    g.stroke();
    g.strokeStyle = `rgba(${B.rgb},0.8)`;
    g.lineWidth = R * 0.03;
    circle(g, 0, 0, R * 0.72);
    g.stroke();
    // 글자
    g.fillStyle = hot ? "#fff" : "rgba(255,255,255,0.86)";
    g.font = `700 ${Math.round(R * 0.46)}px "Chakra Petch", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("TAP", 0, 1);
  }
  const noteSprites = [];
  let padSprites = [];
  const sparkSprites = [];
  function buildSprites() {
    if (!noteSprites.length) {
      NEON.forEach((C) => noteSprites.push(sprite(180, (g) => drawNoteArt(g, C, 60))));
      NEON.forEach((C) =>
        sparkSprites.push(
          sprite(40, (g) => {
            const r = g.createRadialGradient(0, 0, 0, 0, 0, 20);
            r.addColorStop(0, "rgba(255,255,255,1)");
            r.addColorStop(0.25, `rgba(${C.rgb},0.9)`);
            r.addColorStop(1, `rgba(${C.rgb},0)`);
            g.fillStyle = r;
            circle(g, 0, 0, 20);
            g.fill();
          })
        )
      );
    }
  }
  function buildPad(ci) {
    const T = THEMES[ci];
    padSprites = [false, true].map((hot) => sprite(240, (g) => drawPadArt(g, PAD_R * 1.25, hot, NEON[T.railA], NEON[T.railB])));
  }

  /* ---------- 배경 (코스마다 · 미리 그림) ---------- */
  function seeded(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  }
  /** y 에서 도로 절반 너비 */
  function roadHalf(y) {
    const u = (y - VP_Y) / (H - VP_Y);
    return ROAD_TOP + (ROAD_BOTTOM - ROAD_TOP) * Math.max(0, u);
  }
  function paintBg(g, ci) {
    const T = THEMES[ci];
    const r = seeded(555 + ci * 91);
    const sky = g.createLinearGradient(0, 0, 0, VP_Y + 40);
    sky.addColorStop(0, T.top);
    sky.addColorStop(0.65, T.mid);
    sky.addColorStop(1, T.low);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // 성운
    for (let i = 0; i < 7; i += 1) {
      const x = r() * W;
      const y = r() * VP_Y;
      const rad = 60 + r() * 90;
      const col = NEON[Math.floor(r() * 4)].rgb;
      const n = g.createRadialGradient(x, y, 0, x, y, rad);
      n.addColorStop(0, `rgba(${col},0.16)`);
      n.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = n;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // 별
    for (let i = 0; i < (ci === 3 ? 170 : 90); i += 1) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.75})`;
      circle(g, r() * W, r() * (VP_Y + 10), 0.5 + r() * 1.1);
      g.fill();
    }
    // 코스별 배경 큰 그림
    if (ci === 2) {
      // 레트로 해
      const sun = g.createLinearGradient(0, VP_Y - 96, 0, VP_Y + 10);
      sun.addColorStop(0, "#ffe27a");
      sun.addColorStop(0.5, "#ff8f4a");
      sun.addColorStop(1, "#ff2f8e");
      g.fillStyle = sun;
      circle(g, CX, VP_Y - 18, 92);
      g.fill();
      g.fillStyle = T.mid;
      for (let i = 0; i < 6; i += 1) g.fillRect(CX - 100, VP_Y - 44 + i * 12, 200, 2 + i * 0.9);
    } else if (ci === 3) {
      // 고리 행성
      const pl = g.createRadialGradient(64, 92, 4, 76, 104, 44);
      pl.addColorStop(0, "#d8c8ff");
      pl.addColorStop(1, "#5a3fc0");
      g.fillStyle = pl;
      circle(g, 76, 104, 34);
      g.fill();
      g.strokeStyle = "rgba(255,226,140,0.85)";
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(76, 104, 56, 14, -0.3, 0, TAU);
      g.stroke();
    }
    // 도시 실루엣 (창에 네온)
    const ground = VP_Y + 6;
    for (const k of [0, 1]) {
      let x = -6;
      while (x < W + 10) {
        const w = 16 + r() * 26;
        const h = (k ? 24 : 44) + r() * (k ? 40 : 58);
        g.fillStyle = k ? "#0c0726" : "rgba(20,12,60,0.85)";
        g.fillRect(x, ground - h, w, h + 8);
        if (!k) {
          for (let wy = ground - h + 5; wy < ground - 2; wy += 8)
            for (let wx = x + 3; wx < x + w - 3; wx += 6) {
              if (r() < 0.34) {
                g.fillStyle = `rgba(${NEON[Math.floor(r() * 4)].rgb},0.75)`;
                g.fillRect(wx, wy, 2.6, 3.6);
              }
            }
        }
        x += w + 1;
      }
    }
    // 땅 + 양옆 그물 바닥
    const floor = g.createLinearGradient(0, ground, 0, H);
    floor.addColorStop(0, "#150a38");
    floor.addColorStop(1, "#04020f");
    g.fillStyle = floor;
    g.fillRect(0, ground, W, H - ground);
    g.fillStyle = T.horizon;
    g.fillRect(0, ground - 1, W, 2.5);
    g.strokeStyle = `rgba(${NEON[T.railB].rgb},0.14)`;
    g.lineWidth = 1;
    for (let i = -14; i <= 14; i += 1) {
      g.beginPath();
      g.moveTo(CX + i * 14, ground);
      g.lineTo(CX + i * 70, H);
      g.stroke();
    }
    for (let i = 1; i < 12; i += 1) {
      const y = ground + (H - ground) * Math.pow(i / 12, 2);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // 도로
    const road = g.createLinearGradient(0, VP_Y, 0, H);
    road.addColorStop(0, "#1c1046");
    road.addColorStop(1, "#090420");
    g.fillStyle = road;
    g.beginPath();
    g.moveTo(CX - ROAD_TOP, VP_Y);
    g.lineTo(CX + ROAD_TOP, VP_Y);
    g.lineTo(CX + ROAD_BOTTOM, H);
    g.lineTo(CX - ROAD_BOTTOM, H);
    g.closePath();
    g.fill();
    // 네온 난간 (번짐 + 심)
    for (const [k, c] of [[-1, NEON[T.railA]], [1, NEON[T.railB]]]) {
      for (const [lw, a] of [[12, 0.16], [6, 0.35], [2.4, 1]]) {
        g.strokeStyle = lw === 2.4 ? c.l : `rgba(${c.rgb},${a})`;
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(CX + k * ROAD_TOP, VP_Y);
        g.lineTo(CX + k * ROAD_BOTTOM, H);
        g.stroke();
      }
    }
    // DJ 부스 + 아치
    const A = NEON[T.railA];
    const B = NEON[T.railB];
    for (const [lw, al] of [[12, 0.14], [6, 0.32], [2.5, 1]]) {
      g.strokeStyle = lw === 2.5 ? A.l : `rgba(${A.rgb},${al})`;
      g.lineWidth = lw;
      g.beginPath();
      g.arc(CX, VP_Y + 8, 112, Math.PI * 1.04, Math.PI * 1.96);
      g.stroke();
    }
    // 스피커 탑
    for (const k of [-1, 1]) {
      const sx = CX + k * 128;
      g.fillStyle = "#120a30";
      g.strokeStyle = `rgba(${B.rgb},0.8)`;
      g.lineWidth = 1.6;
      g.beginPath();
      g.roundRect(sx - 20, VP_Y - 54, 40, 62, 5);
      g.fill();
      g.stroke();
      for (const [yy, rad] of [[-36, 8], [-12, 13]]) {
        g.fillStyle = "#07041a";
        circle(g, sx, VP_Y + yy, rad);
        g.fill();
        g.stroke();
      }
    }
  }
  function ensureBg(ci) {
    if (bgKey === ci && bg) return;
    bgKey = ci;
    bg = bg || document.createElement("canvas");
    bg.width = Math.round(W * dpr);
    bg.height = Math.round(H * dpr);
    const g = bg.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBg(g, ci);
    buildPad(ci);
  }

  /* ---------- DJ 고양이 ---------- */
  function drawDJ(g, x, y, s, o = {}) {
    const beat = o.beat || 0;
    const headOn = o.mood === "happy" ? -0.08 : 0;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.lineJoin = "round";
    g.lineWidth = 3;
    const line = "#191133";
    g.strokeStyle = line;
    // 몸 (후드)
    const hood = g.createLinearGradient(0, 22, 0, 84);
    hood.addColorStop(0, "#3d2a86");
    hood.addColorStop(1, "#1d1250");
    g.fillStyle = hood;
    g.beginPath();
    g.moveTo(-34, 84);
    g.quadraticCurveTo(-36, 34, 0, 30);
    g.quadraticCurveTo(36, 34, 34, 84);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#ff4fa3";
    g.font = "700 15px 'Chakra Petch', sans-serif";
    g.textAlign = "center";
    g.fillText("DJ", 0, 62);
    // 머리
    g.save();
    g.translate(0, -beat * 3 + 8);
    g.rotate(Math.sin((o.t || 0) * 3.1) * 0.05 + headOn);
    for (const k of [-1, 1]) {
      g.fillStyle = "#f6f3ff";
      g.beginPath();
      g.moveTo(k * 34, -16);
      g.lineTo(k * 37, -50);
      g.lineTo(k * 9, -36);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#ffb0d6";
      g.beginPath();
      g.moveTo(k * 30, -22);
      g.lineTo(k * 32, -42);
      g.lineTo(k * 15, -33);
      g.closePath();
      g.fill();
    }
    const head = g.createRadialGradient(-10, -16, 4, 0, -2, 44);
    head.addColorStop(0, "#ffffff");
    head.addColorStop(1, "#d6d0f0");
    g.fillStyle = head;
    g.beginPath();
    g.ellipse(0, -4, 38, 32, 0, 0, TAU);
    g.fill();
    g.stroke();
    // 선글라스
    g.fillStyle = "#14102c";
    for (const k of [-1, 1]) {
      g.beginPath();
      g.roundRect(k * 16 - 13, -14, 26, 15, 5);
      g.fill();
    }
    g.fillRect(-4, -11, 8, 3);
    g.fillStyle = "rgba(39,227,255,0.85)";
    for (const k of [-1, 1]) {
      g.beginPath();
      g.moveTo(k * 16 - 9, -2);
      g.lineTo(k * 16 - 2, -12);
      g.lineTo(k * 16 + 2, -12);
      g.lineTo(k * 16 - 5, -2);
      g.closePath();
      g.fill();
    }
    // 코 · 입
    g.fillStyle = "#ff7fb8";
    g.beginPath();
    g.moveTo(-3.5, 6);
    g.lineTo(3.5, 6);
    g.lineTo(0, 10);
    g.closePath();
    g.fill();
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(-5, 10, 5, 0.1, Math.PI - 0.5);
    g.arc(5, 10, 5, 0.5, Math.PI - 0.1);
    g.stroke();
    // 수염
    g.lineWidth = 1.6;
    for (const k of [-1, 1]) {
      for (const dy of [4, 11]) {
        g.beginPath();
        g.moveTo(k * 24, dy);
        g.lineTo(k * 37, dy - 3 + (dy > 5 ? 5 : 0));
        g.stroke();
      }
    }
    // 헤드폰
    g.lineWidth = 6;
    g.strokeStyle = "#ff4fa3";
    g.beginPath();
    g.arc(0, -8, 40, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = line;
    for (const k of [-1, 1]) {
      const pad = g.createLinearGradient(k * 30, -16, k * 48, 12);
      pad.addColorStop(0, "#27e3ff");
      pad.addColorStop(1, "#b06bff");
      g.fillStyle = pad;
      g.beginPath();
      g.ellipse(k * 39, -2, 11, 17, 0, 0, TAU);
      g.fill();
      g.stroke();
    }
    g.restore();
    g.restore();
  }

  /* ---------- 진행 ---------- */
  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (name && overlays[name]) {
      overlays[name].classList.remove("hidden");
      overlays[name].scrollTop = 0;
    }
    document.querySelector(".hud").classList.toggle("hidden", state !== "play");
  }
  const STAR_AT = [0.5, 0.75, 0.92];
  const ratio = () => (notes.length ? earned / notes.length : 0);
  const starsFor = (k) => STAR_AT.filter((v) => k >= v - 1e-9).length;
  function paintHud() {
    $("hud-title").textContent = song.name;
    $("hud-score").textContent = score.toLocaleString("ko-KR");
    const k = ratio();
    $("hud-fill").style.width = `${Math.min(100, k * 100)}%`;
    [...$("hud-stars").children].forEach((s, i) => s.classList.toggle("on", k >= STAR_AT[i]));
    const el = $("hud-lives");
    if (!course.hearts) el.innerHTML = "";
    else {
      if (el.childElementCount !== course.hearts) {
        el.innerHTML = "";
        for (let i = 0; i < course.hearts; i += 1) el.appendChild(document.createElement("span"));
      }
      [...el.children].forEach((d, i) => (d.className = "life" + (i < hearts ? "" : " empty")));
    }
  }
  function startSong(i) {
    songIndex = i;
    song = SONGS[i];
    course = COURSES[song.course];
    notes = song.chart.map((n, idx) => ({ time: n.time, idx, bar: n.bar, status: "pending", col: Math.floor(n.bar / 2) % 4 }));
    score = 0;
    combo = 0;
    maxCombo = 0;
    hits = 0;
    perfects = 0;
    earned = 0;
    hearts = course.hearts;
    floats = [];
    parts = [];
    waves = [];
    pillar = 0;
    missDim = 0;
    screenFlash = 0;
    lastBeat = -1;
    ensureBg(song.course);
    state = "play";
    showOverlay(null);
    paintHud();
    if (clock.mode !== "manual") {
      audioCtx();
      startMusic(song);
    } else clock.manual = 0;
  }
  function nearestNote(t) {
    let bestN = null;
    let bestD = Infinity;
    for (const n of notes) {
      if (n.status !== "pending") continue;
      const d = Math.abs(n.time - t);
      if (d < bestD) {
        bestD = d;
        bestN = n;
      }
      if (n.time > t + 1.5) break;
    }
    return bestN;
  }
  function addFloat(text, color, size, y = PAD_Y - 112) {
    floats.push({ x: CX, y, text, color, size, life: 0.6, max: 0.6, vy: -30 });
  }
  function burst(n, col, sp = 240) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = sp * (0.35 + Math.random() * 0.9);
      parts.push({ x: CX + Math.cos(a) * PAD_R * 0.7, y: PAD_Y + Math.sin(a) * PAD_R * 0.7, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.32 + Math.random() * 0.4, max: 0.7, s: 6 + Math.random() * 14, c: col });
    }
  }
  function hit(n, perfect) {
    n.status = "hit";
    hits += 1;
    if (perfect) perfects += 1;
    earned += perfect ? 1 : 0.8;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    score += (perfect ? 100 : 60) + Math.min(combo, 50) * (perfect ? 4 : 2);
    padFlash = 1;
    pillar = 1;
    pillarCol = n.col;
    screenFlash = perfect ? 0.14 : 0.08;
    waves.push({ r: PAD_R, life: 0.32, max: 0.32, c: n.col });
    if (perfect) waves.push({ r: PAD_R * 0.7, life: 0.42, max: 0.42, c: (n.col + 2) % 4 });
    burst(perfect ? 16 : 8, n.col);
    addFloat(perfect ? "PERFECT" : "GOOD", perfect ? "#fff0a8" : "#b8f6ff", perfect ? 34 : 28);
    sfx.hit(perfect);
    if (combo % 10 === 0) {
      burst(26, (n.col + 1) % 4, 340);
      sfx.combo();
    }
    if (course.hearts && combo % 8 === 0 && hearts < course.hearts) hearts += 1;
    paintHud();
  }
  function miss(n) {
    n.status = "missed";
    combo = 0;
    missDim = 1;
    addFloat("MISS", "#a79fc9", 24);
    sfx.miss();
    if (course.hearts) {
      hearts -= 1;
      if (hearts <= 0) {
        hearts = 0;
        paintHud();
        fail();
        return;
      }
    }
    paintHud();
  }
  function tap() {
    if (state !== "play") return;
    audioCtx();
    padPress = 1;
    const t = now();
    const n = nearestNote(t);
    if (!n) return;
    const d = Math.abs(t - n.time);
    if (d <= course.perfect) hit(n, true);
    else if (d <= course.good) hit(n, false);
    else sfx.tap(); // 너무 일찍은 벌점 없음
  }
  function update(dt) {
    timeAnim += dt;
    updateFx(dt);
    if (state !== "play") return;
    // 음악이 끝내 안 나오면 소리 없이 진행
    if (clock.mode === "audio" && musicEl) {
      if (musicEl.readyState < 2 || musicEl.paused) waitT += dt;
      else waitT = 0;
      if (waitT > 7) useSilentClock();
    }
    const t = now();
    for (const n of notes) {
      if (n.status === "pending" && t > n.time + course.good) {
        miss(n);
        if (state !== "play") return;
      } else if (n.time > t + 1) break;
    }
    const beat = Math.floor(t / song.beatSec);
    if (beat !== lastBeat && t >= 0) {
      lastBeat = beat;
      beatPulse = 1;
      if (beat % 4 === 0) barPulse = 1;
    }
    // 끝나기 전에 소리 줄이기
    const left = song.end - t;
    if (clock.mode === "audio" && left < 1.4) setVolume(Math.max(0, left / 1.4) * 0.9);
    if (left <= 0 && notes.every((n) => n.status !== "pending")) clearSong();
  }
  function updateFx(dt) {
    beatPulse = Math.max(0, beatPulse - dt * 4.5);
    barPulse = Math.max(0, barPulse - dt * 2.2);
    padFlash = Math.max(0, padFlash - dt * 5);
    padPress = Math.max(0, padPress - dt * 7);
    pillar = Math.max(0, pillar - dt * 5.5);
    missDim = Math.max(0, missDim - dt * 3);
    screenFlash = Math.max(0, screenFlash - dt * 1.2);
    for (const f of floats) {
      f.life -= dt;
      f.y += f.vy * dt;
    }
    floats = floats.filter((f) => f.life > 0);
    for (const p of parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    parts = parts.filter((p) => p.life > 0);
    for (const w of waves) {
      w.life -= dt;
      w.r += dt * 300;
    }
    waves = waves.filter((w) => w.life > 0);
  }
  function clearSong() {
    state = "clear";
    stopMusic();
    const got = starsFor(ratio());
    const newBest = score > best[songIndex];
    if (got > stars[songIndex]) stars[songIndex] = got;
    if (newBest) best[songIndex] = score;
    saveAll();
    if (songIndex === SONGS.length - 1 && got > 0) {
      $("all-detail").textContent = `모은 별 ${totalStars()}개 · 총점 ${totalBest().toLocaleString("ko-KR")}`;
      showOverlay("all");
      rankAt(overlays.all);
    } else {
      $("clear-badge").textContent = got ? "CLEAR" : "TRY AGAIN";
      $("clear-title").textContent = song.name;
      const S = $("clear-stars");
      S.innerHTML = "";
      for (let i = 0; i < 3; i += 1) {
        const e = document.createElement("span");
        e.textContent = "★";
        if (i < got) {
          e.className = "on";
          e.style.animationDelay = `${0.15 + i * 0.2}s`;
          setTimeout(() => sfx.star(i), 150 + i * 200);
        }
        S.appendChild(e);
      }
      $("clear-detail").textContent = `SCORE ${score.toLocaleString("ko-KR")} · 최대 콤보 ${maxCombo} · 맞힘 ${hits} / ${notes.length}${newBest ? " · 새 기록!" : ""}`;
      $("next-btn").textContent = got ? "다음 곡" : "다시 도전";
      $("next-btn").dataset.again = got ? "" : "1";
      showOverlay("clear");
      if (got && (songIndex + 1) % 5 === 0) rankAt($("clear-rank"));
      else $("clear-rank").innerHTML = "";
    }
    if (got) {
      sfx.clear();
      burst(40, 0, 420);
    } else sfx.fail();
  }
  function fail() {
    state = "over";
    stopMusic();
    if (score > best[songIndex]) {
      best[songIndex] = score;
      saveAll();
    }
    sfx.fail();
    $("over-detail").textContent = `${song.name} · 맞힘 ${hits}개 · SCORE ${score.toLocaleString("ko-KR")}`;
    showOverlay("over");
    if (totalBest() > 0) rankAt(overlays.over);
  }
  function rankAt(parent) {
    if (!window.TodayGameRank) return;
    try {
      TodayGameRank.reset();
      TodayGameRank.mount({ gameId: "beat-tap", gameTitle: "펄스 탭", formParent: parent });
      TodayGameRank.open(totalBest(), { label: `총점 ${totalBest().toLocaleString("ko-KR")}점` });
    } catch (_) {
      /* 순위 없이도 진행 */
    }
  }

  /* ---------- 곡 고르기 ---------- */
  function paintSongs() {
    const box = $("song-list");
    box.innerHTML = "";
    $("songs-stars").textContent = `★ ${totalStars()} / ${SONGS.length * 3}`;
    COURSES.forEach((c, ci) => {
      const sec = document.createElement("section");
      sec.className = `course c${ci}`;
      const h = document.createElement("h3");
      h.innerHTML = `<b>STAGE ${ci + 1}</b> ${c.name}`;
      if (!c.hearts) {
        const e = document.createElement("em");
        e.textContent = "실패 없음";
        h.appendChild(e);
      }
      sec.appendChild(h);
      SONGS.forEach((s, i) => {
        if (s.course !== ci) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "song-item" + (i === nextSong() ? " next" : "");
        const st = [0, 1, 2].map((k) => (k < stars[i] ? "<b>★</b>" : "★")).join("");
        b.innerHTML = `<span class="n">${i + 1}</span><span class="t">${s.name}</span><span class="m">${s.bpm} BPM</span><span class="st">${st}</span>`;
        b.addEventListener("click", () => startSong(i));
        sec.appendChild(b);
      });
      box.appendChild(sec);
    });
  }
  function paintTitle() {
    const total = totalStars();
    $("start-btn").textContent = total ? `이어서 PLAY · ${nextSong() + 1}번 곡` : "PLAY";
    $("title-stars").textContent = total ? `★ ${total} / ${SONGS.length * 3}` : "";
  }

  /* ---------- 그리기 ---------- */
  const noteProgress = (left) => 1 - left / course.approach;
  function pathY(p) {
    return VP_Y + (PAD_Y - VP_Y) * Math.pow(Math.max(0, p), 1.55);
  }
  function drawSpots(t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const T = THEMES[bgKey];
    const swings = [
      [40, 0.55 + Math.sin(t * 0.8) * 0.3, T.railA],
      [W - 40, -0.55 - Math.sin(t * 0.9 + 1) * 0.3, T.railB],
      [130, 0.1 + Math.sin(t * 1.1 + 2) * 0.32, T.railB],
      [W - 130, -0.1 - Math.sin(t * 1.2) * 0.32, T.railA],
    ];
    for (const [x, ang, ci] of swings) {
      const L = 560;
      const a = 0.05 + barPulse * 0.07 + beatPulse * 0.025;
      ctx.save();
      ctx.translate(x, -6);
      ctx.rotate(ang);
      const gr = ctx.createLinearGradient(0, 0, 0, L);
      gr.addColorStop(0, `rgba(${NEON[ci].rgb},${a * 2.2})`);
      gr.addColorStop(1, `rgba(${NEON[ci].rgb},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.lineTo(62, L);
      ctx.lineTo(-62, L);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  /** 양옆 이퀄라이저 */
  function drawEQ(t) {
    const T = THEMES[bgKey];
    const n = 7;
    const bw = 11;
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i += 1) {
        const x = side < 0 ? 5 + i * (bw + 3) : W - 5 - bw - i * (bw + 3);
        const wob = Math.abs(Math.sin(t * (2.1 + i * 0.47) + i * 1.9 + side));
        const h = (18 + (n - i) * 13) * (0.34 + 0.46 * wob + beatPulse * 0.34);
        const y = H - 4 - h;
        const C = NEON[side < 0 ? T.railA : T.railB];
        const g = ctx.createLinearGradient(0, y, 0, H);
        g.addColorStop(0, C.l);
        g.addColorStop(0.35, C.c);
        g.addColorStop(1, `rgba(${C.rgb},0.15)`);
        ctx.fillStyle = g;
        for (let yy = H - 4; yy > y; yy -= 7) ctx.fillRect(x, yy - 5, bw, 5);
      }
    }
  }
  /** 도로 위 흐르는 가로줄 · 가운데 점선 (박자에 맞춰) */
  function drawFlow(t) {
    const T = THEMES[bgKey];
    const speed = song ? 1 / song.beatSec / 2 : 1;
    const N = 8;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < N; i += 1) {
      const u = (i / N + t * speed * (1 / N) * 2) % 1;
      const y = VP_Y + (H - VP_Y) * Math.pow(u, 2.1);
      const hw = roadHalf(y);
      const a = 0.05 + u * 0.22 + beatPulse * 0.1;
      ctx.strokeStyle = `rgba(${NEON[T.railB].rgb},${a})`;
      ctx.lineWidth = 1 + u * 4;
      ctx.beginPath();
      ctx.moveTo(CX - hw, y);
      ctx.lineTo(CX + hw, y);
      ctx.stroke();
    }
    // 박에 맞춰 난간이 번쩍
    const glow = beatPulse * 0.5 + barPulse * 0.3;
    if (glow > 0.01) {
      for (const [k, c] of [[-1, NEON[T.railA]], [1, NEON[T.railB]]]) {
        ctx.strokeStyle = `rgba(${c.rgb},${glow * 0.75})`;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(CX + k * ROAD_TOP, VP_Y);
        ctx.lineTo(CX + k * ROAD_BOTTOM, H);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  /** 심장 박동 선 (펄스) */
  function drawPulseLine(t) {
    const T = THEMES[bgKey];
    const beatT = song ? song.beatSec : 0.47;
    const yBase = VP_Y - 92;
    const ph = ((t / beatT) % 2) / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [lw, al] of [[7, 0.14], [3.5, 0.3], [1.6, 1]]) {
      ctx.strokeStyle = lw === 1.6 ? NEON[T.railA].l : `rgba(${NEON[T.railA].rgb},${al})`;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let x = 16; x <= W - 16; x += 3) {
        const u = x / W;
        const d = ((u - ph + 1) % 1) - 0.5;
        let v = 0;
        const q = Math.abs(d);
        if (q < 0.1) {
          const z = d / 0.1;
          v = (z < -0.5 ? (z + 1) * 8 : z < 0 ? -(z + 0.5) * 2 * 26 + 4 : z < 0.5 ? (z - 0.25) * 4 * 18 - 0 : (1 - z) * 6) * (0.5 + beatPulse * 0.6 + 0.4);
        }
        const y = yBase - v;
        if (x === 16) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawBooth(t) {
    const T = THEMES[bgKey];
    drawDJ(ctx, CX, VP_Y - 62, 0.62, { beat: beatPulse, t: timeAnim, mood: state === "clear" ? "happy" : "" });
    // 부스 (음표가 나오는 곳)
    const A = NEON[T.railA];
    const B = NEON[T.railB];
    ctx.fillStyle = "#120a30";
    ctx.strokeStyle = A.c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(CX - 58, VP_Y - 22, 116, 28, 6);
    ctx.fill();
    ctx.stroke();
    for (const k of [-1, 1]) {
      ctx.save();
      ctx.translate(CX + k * 34, VP_Y - 8);
      ctx.rotate((t * 3.4 * k) % TAU);
      ctx.fillStyle = "#07041a";
      circle(ctx, 0, 0, 10);
      ctx.fill();
      ctx.strokeStyle = B.c;
      ctx.lineWidth = 1.4;
      circle(ctx, 0, 0, 10);
      ctx.stroke();
      ctx.fillStyle = B.l;
      ctx.fillRect(0, -1, 9, 2);
      ctx.restore();
    }
    ctx.fillStyle = `rgba(${A.rgb},${0.5 + beatPulse * 0.5})`;
    for (let i = 0; i < 3; i += 1) ctx.fillRect(CX - 7 + i * 5, VP_Y - 14, 3, 12);
    // 스피커 울림
    if (beatPulse > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const k of [-1, 1]) {
        ctx.strokeStyle = `rgba(${B.rgb},${beatPulse * 0.8})`;
        ctx.lineWidth = 2.5;
        circle(ctx, CX + k * 128, VP_Y - 12, 13 + beatPulse * 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawNotes(t) {
    // 뒤(먼 음표)부터
    const list = [];
    for (const n of notes) {
      if (n.status !== "pending") continue;
      const left = n.time - t;
      if (left > course.approach) break;
      list.push({ n, left });
    }
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const { n, left } = list[i];
      const p = noteProgress(left);
      const y = pathY(p);
      const s = 0.2 + 0.8 * Math.pow(Math.max(0, p), 1.3);
      const r = 52 * s * (1 + beatPulse * 0.05);
      // 꼬리 빛
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const y0 = pathY(p - 0.16);
      const gr = ctx.createLinearGradient(0, y0, 0, y);
      gr.addColorStop(0, `rgba(${NEON[n.col].rgb},0)`);
      gr.addColorStop(1, `rgba(${NEON[n.col].rgb},0.5)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(CX - r * 0.18, y0);
      ctx.lineTo(CX + r * 0.18, y0);
      ctx.lineTo(CX + r * 0.75, y);
      ctx.lineTo(CX - r * 0.75, y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const d = (r / 60) * 90;
      ctx.drawImage(noteSprites[n.col], CX - d, y - d, d * 2, d * 2);
    }
  }
  function drawPad(t, pend) {
    const inWin = pend && Math.abs(pend.time - t) <= course.good;
    const scale = 1 + beatPulse * 0.04 - padPress * 0.06 + (inWin ? 0.03 : 0);
    const dim = 1 - missDim * 0.45;
    const size = 120 * scale;
    ctx.save();
    ctx.globalAlpha = dim;
    ctx.drawImage(padSprites[0], CX - size, PAD_Y - size, size * 2, size * 2);
    if (inWin || padFlash > 0) {
      ctx.globalAlpha = Math.max(inWin ? 0.75 : 0, padFlash);
      ctx.drawImage(padSprites[1], CX - size, PAD_Y - size, size * 2, size * 2);
    }
    ctx.restore();
    // 큰 빛기둥
    if (pillar > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const C = NEON[pillarCol];
      const gr = ctx.createLinearGradient(0, VP_Y, 0, PAD_Y);
      gr.addColorStop(0, `rgba(${C.rgb},0)`);
      gr.addColorStop(1, `rgba(${C.rgb},${pillar * 0.55})`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(CX - 10, VP_Y);
      ctx.lineTo(CX + 10, VP_Y);
      ctx.lineTo(CX + PAD_R, PAD_Y);
      ctx.lineTo(CX - PAD_R, PAD_Y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  function drawFx() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const w of waves) {
      const k = w.life / w.max;
      ctx.strokeStyle = `rgba(${NEON[w.c].rgb},${k * 0.9})`;
      ctx.lineWidth = 2 + k * 7;
      circle(ctx, CX, PAD_Y, w.r);
      ctx.stroke();
    }
    for (const p of parts) {
      const k = Math.min(1, p.life * 2.6);
      const s = p.s * k;
      ctx.globalAlpha = k;
      ctx.drawImage(sparkSprites[p.c % 4], p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floats) {
      const k = f.life / f.max;
      const pop = k > 0.78 ? 1 + (k - 0.78) * 1.4 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.4);
      ctx.font = `${Math.round(f.size * pop)}px 'Bagel Fat One', sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(20,8,60,0.9)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
  function drawCombo() {
    if (combo < 3) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const s = 1 + padFlash * 0.14;
    ctx.translate(CX, 318);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.92;
    ctx.font = "54px 'Bagel Fat One', sans-serif";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(20,8,60,0.75)";
    ctx.strokeText(String(combo), 0, 0);
    const g = ctx.createLinearGradient(0, -26, 0, 26);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, NEON[combo >= 30 ? 1 : combo >= 10 ? 0 : 2].c);
    ctx.fillStyle = g;
    ctx.fillText(String(combo), 0, 0);
    ctx.font = "700 14px 'Chakra Petch', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("COMBO", 0, 34);
    ctx.restore();
  }
  function drawCount(t) {
    if (t < -0.15) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "20px Jua";
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.fillText("곡 불러오는 중…", CX, 360);
      ctx.restore();
      return;
    }
    const left = song.lead - t;
    if (left <= 0.02 || left > song.beatSec * 3 + 0.05) return;
    const n = Math.ceil(left / song.beatSec);
    const ph = (left / song.beatSec) % 1;
    ctx.save();
    ctx.translate(CX, 340);
    ctx.scale(1 + ph * 0.35, 1 + ph * 0.35);
    ctx.globalAlpha = 0.45 + ph * 0.55;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "84px 'Bagel Fat One', sans-serif";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(20,8,60,0.85)";
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }
  function drawHelp(t) {
    if (songIndex !== 0 || hits >= 3 || t > 16) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "17px Jua";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(10,4,40,0.9)";
    const msg = "노트가 링에 닿을 때 화면 아무 데나 탭!";
    ctx.strokeText(msg, CX, PAD_Y - 84);
    ctx.fillStyle = "#fff";
    ctx.fillText(msg, CX, PAD_Y - 84);
    ctx.restore();
  }
  function draw(t) {
    if (!bg) ensureBg(0);
    ctx.drawImage(bg, 0, 0, W, H);
    const tt = song && (state === "play" || state === "paused") ? t : timeAnim;
    drawSpots(tt);
    drawPulseLine(tt);
    drawBooth(tt);
    drawFlow(tt);
    drawEQ(tt);
    if (state === "play" || state === "paused") {
      const pend = nearestNote(t);
      drawPad(t, pend);
      drawCombo();
      drawNotes(t);
      drawCount(t);
      drawHelp(t);
    } else {
      drawPad(0, null);
    }
    drawFx();
    if (screenFlash > 0.003) {
      ctx.fillStyle = `rgba(255,255,255,${screenFlash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  let raf = 0;
  function loop(ts) {
    const dt = Math.max(0, Math.min(0.05, (ts - last) / 1000 || 0.016));
    last = ts;
    if (state !== "paused") {
      update(dt);
    }
    // 메뉴에서도 박자가 살아 있게
    if (state !== "play" && state !== "paused") {
      const b = Math.floor(timeAnim / 0.47);
      if (b !== lastBeat) {
        lastBeat = b;
        beatPulse = 1;
        if (b % 4 === 0) barPulse = 1;
      }
    }
    draw(song ? now() : 0);
    raf = requestAnimationFrame(loop);
  }

  /* ---------- 입력 ---------- */
  const stage = document.querySelector(".stage");
  stage.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    if (e.target.closest("button, a, .today-pause-overlay")) return;
    e.preventDefault();
    tap();
  });
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (!["Space", "Enter", "KeyF", "KeyJ", "KeyZ", "KeyK"].includes(e.code)) return;
    e.preventDefault();
    if (state === "play") tap();
    else if (state === "title" && (e.code === "Space" || e.code === "Enter")) $("start-btn").click();
    else if (state === "clear" && (e.code === "Space" || e.code === "Enter")) $("next-btn").click();
    else if (state === "over" && (e.code === "Space" || e.code === "Enter")) $("retry-btn").click();
  });
  $("start-btn").addEventListener("click", () => startSong(nextSong()));
  $("pick-btn").addEventListener("click", () => {
    state = "songs";
    paintSongs();
    showOverlay("songs");
  });
  $("songs-back").addEventListener("click", () => {
    state = "title";
    paintTitle();
    showOverlay("title");
  });
  $("next-btn").addEventListener("click", () => {
    if ($("next-btn").dataset.again === "1") startSong(songIndex);
    else startSong(Math.min(SONGS.length - 1, songIndex + 1));
  });
  $("again-btn2").addEventListener("click", () => startSong(songIndex));
  $("retry-btn").addEventListener("click", () => startSong(songIndex));
  const toSongs = () => {
    state = "songs";
    stopMusic();
    paintSongs();
    showOverlay("songs");
  };
  $("menu-btn").addEventListener("click", toSongs);
  $("menu-btn2").addEventListener("click", toSongs);
  $("again-btn").addEventListener("click", toSongs);

  /* ---------- 시작 ---------- */
  buildSprites();
  ensureBg(0);
  paintTitle();
  showOverlay("title");
  last = performance.now();
  raf = requestAnimationFrame(loop);
  // 글꼴이 늦게 오면 링 글자를 다시 그림
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => buildPad(bgKey < 0 ? 0 : bgKey));

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: "beat-tap", gameTitle: "펄스 탭", formParent: overlays.over });
  }
  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        if (clock.mode === "audio") stopMusic();
        else clock.pausedPerf = performance.now();
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        if (clock.mode === "audio") {
          const p = musicEl.play();
          if (p && p.catch) p.catch(() => useSilentClock());
        } else if (clock.mode === "perf") clock.t0 += performance.now() - clock.pausedPerf;
        last = performance.now();
        return true;
      },
    });
  }

  /* ---------- 점검용 · 썸네일용 ---------- */
  window.PulseTap = {
    SONGS,
    COURSES,
    start: startSong,
    manual() {
      cancelAnimationFrame(raf);
      clock.mode = "manual";
    },
    tick(dt) {
      clock.manual += dt;
      update(dt);
    },
    tap,
    draw() {
      draw(song ? now() : 0);
    },
    get state() {
      return state;
    },
    get notes() {
      return notes;
    },
    get time() {
      return now();
    },
    get hearts() {
      return hearts;
    },
    get hits() {
      return hits;
    },
    get clockMode() {
      return clock.mode;
    },
    get musicEl() {
      return musicEl;
    },
    stars: () => stars.slice(),
    ratio,
    art: { drawDJ, drawNoteArt, drawPadArt, noteGlyph, paintBg, NEON, THEMES, VP_Y, PAD_Y, PAD_R },
  };
})();
