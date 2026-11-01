/*
 * 펄스 탭 — 위에서 떨어지는 먹이가 입에 들어올 때 콕! 누르면 냠!
 *  - 누를 때마다 노래의 그 음이 울려서 아이가 직접 연주하는 느낌
 *  - 코스 1(5곡)은 실패 없음 · 2박에 한 번 · 판정 넓음. 코스가 오를수록 조금씩 촘촘해짐
 *  - 그림은 전부 코드로 그림. 음악도 코드로 연주 (시계는 AudioContext → 소리와 화면이 어긋나지 않음)
 *  - 점검: window.PulseTap (scripts/test-beat-tap.js)
 */
(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const CX = W / 2;
  const LANE_TOP = 96;
  const MOUTH_Y = 448;
  const BUDDY_S = 0.92;
  const { COURSES, SONGS, freqOf } = window.PulseSongs;
  const STARS_KEY = "beat-tap-stars-v2";
  const BEST_KEY = "beat-tap-best-v2";
  const TAU = Math.PI * 2;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const $ = (id) => document.getElementById(id);
  const overlays = { title: $("title"), songs: $("songs"), clear: $("clear"), over: $("over"), all: $("allclear") };
  const tapPad = $("tap-pad");

  /* ---------- 저장 ---------- */
  let stars = new Array(SONGS.length).fill(0);
  let best = new Array(SONGS.length).fill(0);
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

  /* ---------- 소리 ---------- */
  let ac = null;
  let bus = null;
  let evIdx = 0;
  const clock = { mode: "perf", t0: 0, manual: 0, pausedAt: 0 };

  function audioCtx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          ac = new AC();
        } catch (_) {
          ac = null;
        }
      }
    }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  }
  function note(freq, t, dur, type, vol, dest) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  /** 오르골 소리 (누를 때 · 멜로디) */
  function bell(midi, t, vol, dest, len = 0.55) {
    const f = freqOf(midi + 12);
    note(f, t, len, "sine", vol, dest);
    note(f * 2, t, len * 0.55, "sine", vol * 0.32, dest);
    note(f * 4, t, len * 0.25, "sine", vol * 0.12, dest);
  }
  function playEvent(ev, t) {
    if (ev.type === "click") note(ev.high ? 1320 : 990, t, 0.06, "square", 0.05, bus);
    else if (ev.type === "melody") bell(ev.midi, t, 0.1, bus, Math.min(0.8, ev.dur + 0.25));
    else if (ev.type === "bass") note(freqOf(ev.midi), t, 0.34, "triangle", 0.17, bus);
    else if (ev.type === "chord") for (const k of ev.tones) note(freqOf(60 + k), t, 0.16, "triangle", 0.035, bus);
  }
  function schedule() {
    if (clock.mode !== "ctx" || state !== "play" || !song) return;
    const nowT = ac.currentTime - clock.t0;
    while (evIdx < song.events.length && song.events[evIdx].t < nowT + 0.25) {
      const ev = song.events[evIdx];
      if (ev.t >= nowT - 0.05) playEvent(ev, Math.max(ac.currentTime, clock.t0 + ev.t));
      evIdx += 1;
    }
  }
  setInterval(schedule, 80);
  const sfx = {
    hit(n, perfect) {
      if (!ac || !bus) return;
      const t = ac.currentTime;
      if (n) bell(n.midi, t, perfect ? 0.3 : 0.24, ac.destination, 0.6);
      note(perfect ? 880 : 660, t, 0.07, "sine", 0.12, ac.destination);
      note(perfect ? 1320 : 990, t + 0.03, 0.08, "sine", 0.07, ac.destination);
    },
    miss() {
      if (!ac) return;
      const t = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.2);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + 0.24);
    },
    tap() {
      if (ac) note(520, ac.currentTime, 0.04, "sine", 0.04, ac.destination);
    },
    cheer() {
      if (!ac) return;
      [660, 880, 1100].forEach((f, i) => note(f, ac.currentTime + i * 0.07, 0.14, "triangle", 0.09, ac.destination));
    },
    clear() {
      if (!ac) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, ac.currentTime + i * 0.11, 0.3, "triangle", 0.12, ac.destination));
    },
    star(i) {
      if (ac) note(880 + i * 220, ac.currentTime, 0.2, "triangle", 0.12, ac.destination);
    },
    sad() {
      if (!ac) return;
      [440, 392, 330].forEach((f, i) => note(f, ac.currentTime + i * 0.16, 0.3, "triangle", 0.09, ac.destination));
    },
  };
  function now() {
    if (clock.mode === "manual") return clock.manual;
    if (clock.mode === "ctx") return ac.currentTime - clock.t0 - (ac.outputLatency || 0);
    return (performance.now() - clock.t0) / 1000;
  }

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
  let flying = [];
  let ripples = [];
  let ambient = [];
  let mouth = 0.6;
  let chew = 0;
  let sad = 0;
  let cheer = 0;
  let blink = 2;
  let beatPulse = 0;
  let padPress = 0;
  let last = 0;
  let timeAnim = 0;
  let bg = null;
  let bgKey = -1;
  let lastBeat = -1;
  let endT = 0;
  let clearAt = 0;

  /* ---------- 친구 그림 ---------- */
  const BUDDIES = {
    hippo: { body: "#b9a5f0", dark: "#8069cc", belly: "#f1e8ff", ear: "#f4a9c8", line: "#4d3b8a" },
    whale: { body: "#6dc3f7", dark: "#3b90d2", belly: "#e8f9ff", ear: "#4fa8e6", line: "#1f5b92" },
    bear: { body: "#d09a68", dark: "#9d6c41", belly: "#f7e3c8", ear: "#f3bfa0", line: "#5b3a1f" },
    alien: { body: "#93e67e", dark: "#58b84c", belly: "#e9ffdb", ear: "#ffd65c", line: "#2c6b25" },
  };
  function blob(g, x, y, rx, ry, rot = 0) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, TAU);
  }
  /** (x, y) 가 입 가운데. o: open 0~1 · blink · squash · mood(happy/sad) · arm(팔 올림 0~1) · lookX · lookY */
  function drawBuddy(g, kind, x, y, s, o = {}) {
    const C = BUDDIES[kind];
    const open = o.open == null ? 0.7 : o.open;
    const sq = o.squash || 0;
    const arm = o.arm || 0;
    g.save();
    g.translate(x, y);
    g.scale(s * (1 + sq * 0.05), s * (1 - sq * 0.05));
    g.lineWidth = 3;
    g.lineJoin = "round";
    g.strokeStyle = C.line;
    // 그림자
    g.fillStyle = "rgba(20,10,40,0.18)";
    blob(g, 0, 208, 104, 14);
    g.fill();
    // 발
    g.fillStyle = C.dark;
    for (const k of [-1, 1]) {
      blob(g, k * 52, 196, 32, 16);
      g.fill();
      g.stroke();
    }
    // 몸
    let gr = g.createLinearGradient(0, 80, 0, 200);
    gr.addColorStop(0, C.body);
    gr.addColorStop(1, C.dark);
    g.fillStyle = gr;
    blob(g, 0, 140, 86, 62);
    g.fill();
    g.stroke();
    g.fillStyle = C.belly;
    blob(g, 0, 152, 56, 42);
    g.fill();
    // 팔 (박자에 맞춰 · 신나면 번쩍)
    for (const k of [-1, 1]) {
      g.save();
      g.translate(k * 82, 108);
      g.rotate(k * (0.5 - arm * 1.9));
      g.fillStyle = C.body;
      blob(g, k * 8, 22, 18, 32);
      g.fill();
      g.stroke();
      g.restore();
    }
    // 머리
    gr = g.createLinearGradient(0, -60, 0, 110);
    gr.addColorStop(0, C.body);
    gr.addColorStop(1, C.dark);
    g.fillStyle = gr;
    blob(g, 0, 28, 112, 84);
    g.fill();
    g.stroke();
    // 종류별 장식
    if (kind === "hippo") {
      for (const k of [-1, 1]) {
        g.fillStyle = C.body;
        blob(g, k * 106, -24, 18, 22, k * 0.5);
        g.fill();
        g.stroke();
        g.fillStyle = C.ear;
        blob(g, k * 106, -24, 9, 12, k * 0.5);
        g.fill();
      }
    } else if (kind === "whale") {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 6;
      g.lineCap = "round";
      for (const k of [-1, 1]) {
        g.beginPath();
        g.moveTo(k * 100, -30);
        g.quadraticCurveTo(k * 104, -64, k * 124, -70);
        g.stroke();
      }
      g.strokeStyle = C.line;
      g.lineWidth = 3;
      g.fillStyle = C.ear;
      for (const k of [-1, 1]) {
        blob(g, k * 114, 62, 22, 12, k * 0.7);
        g.fill();
        g.stroke();
      }
    } else if (kind === "bear") {
      for (const k of [-1, 1]) {
        g.fillStyle = C.body;
        blob(g, k * 100, -34, 28, 28);
        g.fill();
        g.stroke();
        g.fillStyle = C.ear;
        blob(g, k * 100, -34, 15, 15);
        g.fill();
      }
    } else if (kind === "alien") {
      for (const k of [-1, 1]) {
        g.beginPath();
        g.moveTo(k * 100, -24);
        g.quadraticCurveTo(k * 118, -62, k * 106, -84);
        g.stroke();
        g.fillStyle = C.ear;
        blob(g, k * 106, -90, 11, 11);
        g.fill();
        g.stroke();
      }
    }
    // 눈 언덕 + 눈 (입 양옆 · 먹이 길을 비움)
    const lx = o.lookX || 0;
    const ly = o.lookY == null ? -0.8 : o.lookY;
    for (const k of [-1, 1]) {
      const ex = k * 72;
      const ey = -36;
      g.fillStyle = C.body;
      blob(g, ex, ey, 38, 36);
      g.fill();
      g.stroke();
      g.fillStyle = "#fff";
      blob(g, ex, ey, 29, 28);
      g.fill();
      if (o.mood === "happy") {
        g.strokeStyle = C.line;
        g.lineWidth = 5;
        g.lineCap = "round";
        g.beginPath();
        g.arc(ex, ey + 6, 16, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
        g.lineWidth = 3;
      } else if (o.blink) {
        g.strokeStyle = C.line;
        g.lineWidth = 5;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(ex - 16, ey);
        g.lineTo(ex + 16, ey);
        g.stroke();
        g.lineWidth = 3;
      } else {
        const px = ex + lx * 10;
        const py = ey + ly * 10;
        g.fillStyle = "#2b2140";
        blob(g, px, py, 16, 17);
        g.fill();
        g.fillStyle = "#fff";
        blob(g, px - 5, py - 6, 5.5, 6);
        g.fill();
        blob(g, px + 5, py + 5, 2.6, 2.6);
        g.fill();
        if (o.mood === "sad") {
          g.strokeStyle = C.line;
          g.lineWidth = 4;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(ex - k * 22, ey - 30);
          g.lineTo(ex + k * 18, ey - 36);
          g.stroke();
          g.lineWidth = 3;
        }
      }
      g.strokeStyle = C.line;
    }
    // 볼
    g.fillStyle = "rgba(255,110,160,0.42)";
    for (const k of [-1, 1]) {
      blob(g, k * 84, 34, 19, 13);
      g.fill();
    }
    // 입
    const rx = 46 + open * 14;
    const ry = 7 + open * 37;
    if (open > 0.12) {
      g.fillStyle = "#7c1f3e";
      blob(g, 0, 8, rx, ry);
      g.fill();
      g.lineWidth = 4;
      g.stroke();
      g.lineWidth = 3;
      g.save();
      blob(g, 0, 8, rx - 2, ry - 2);
      g.clip();
      g.fillStyle = "#ff7f9f";
      blob(g, 0, 8 + ry * 0.72, rx * 0.68, ry * 0.58);
      g.fill();
      g.fillStyle = "#ffa9bf";
      blob(g, -rx * 0.16, 8 + ry * 0.58, rx * 0.22, ry * 0.14);
      g.fill();
      g.restore();
      if (kind === "hippo" || kind === "bear") {
        g.fillStyle = "#fff";
        for (const k of [-1, 1]) {
          g.beginPath();
          g.roundRect(k * rx * 0.42 - 7, 8 - ry + 1, 14, Math.min(16, ry * 0.46), 4);
          g.fill();
        }
      }
    } else {
      // 입 다묾: 우물우물 웃는 입
      g.lineWidth = 5;
      g.lineCap = "round";
      g.beginPath();
      if (o.mood === "sad") g.arc(0, 34, 26, Math.PI * 1.2, Math.PI * 1.8);
      else g.arc(0, -4, 38, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
      g.lineWidth = 3;
    }
    g.restore();
  }

  /* ---------- 먹이 그림 ---------- */
  const FOODS = [
    ["apple", "strawberry", "orange", "grape", "pear"],
    ["fish", "starfish", "shell", "fish2", "jelly"],
    ["cookie", "donut", "candy", "cupcake", "lolli"],
    ["star", "planet", "moon", "comet", "star2"],
  ];
  function shine(g, x, y, r) {
    g.fillStyle = "rgba(255,255,255,0.7)";
    blob(g, x, y, r * 0.24, r * 0.15, -0.6);
    g.fill();
  }
  function starPath(g, x, y, r, n = 5, inner = 0.48, rot = -Math.PI / 2) {
    g.beginPath();
    for (let i = 0; i < n * 2; i += 1) {
      const a = rot + (i * Math.PI) / n;
      const q = i % 2 ? r * inner : r;
      if (i) g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
      else g.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    g.closePath();
  }
  function drawFood(g, kind, x, y, r, rot = 0) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.lineWidth = Math.max(1.5, r * 0.08);
    g.lineJoin = "round";
    const fill = (c1, c2) => {
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.15);
      gr.addColorStop(0, c1);
      gr.addColorStop(1, c2);
      return gr;
    };
    if (kind === "apple" || kind === "pear" || kind === "orange") {
      const set = { apple: ["#ff9a8c", "#e02b3c", "#8f1224"], pear: ["#f6f3a0", "#b5cf3e", "#6f8a1e"], orange: ["#ffd98a", "#f58f1f", "#a85a0a"] }[kind];
      g.fillStyle = fill(set[0], set[1]);
      g.strokeStyle = set[2];
      if (kind === "pear") {
        g.beginPath();
        g.moveTo(0, -r);
        g.bezierCurveTo(r * 0.5, -r, r * 0.42, -r * 0.3, r * 0.9, r * 0.28);
        g.bezierCurveTo(r * 1.1, r * 0.95, -r * 1.1, r * 0.95, -r * 0.9, r * 0.28);
        g.bezierCurveTo(-r * 0.42, -r * 0.3, -r * 0.5, -r, 0, -r);
      } else blob(g, 0, 0, r, r * 0.95);
      g.fill();
      g.stroke();
      if (kind !== "orange") {
        g.strokeStyle = "#6b4426";
        g.lineWidth = r * 0.12;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(0, -r * 0.85);
        g.quadraticCurveTo(r * 0.05, -r * 1.15, r * 0.18, -r * 1.25);
        g.stroke();
      }
      g.fillStyle = "#62c23f";
      g.strokeStyle = "#3b8a24";
      g.lineWidth = Math.max(1, r * 0.05);
      g.beginPath();
      g.moveTo(r * 0.1, -r * 0.9);
      g.quadraticCurveTo(r * 0.55, -r * 1.35, r * 0.85, -r * 0.95);
      g.quadraticCurveTo(r * 0.5, -r * 0.7, r * 0.1, -r * 0.9);
      g.fill();
      g.stroke();
      shine(g, -r * 0.42, -r * 0.34, r * 1.4);
    } else if (kind === "strawberry") {
      g.fillStyle = fill("#ff9db0", "#e8264f");
      g.strokeStyle = "#a01437";
      g.beginPath();
      g.moveTo(0, r);
      g.bezierCurveTo(-r * 1.2, r * 0.3, -r * 1.1, -r * 0.9, 0, -r * 0.75);
      g.bezierCurveTo(r * 1.1, -r * 0.9, r * 1.2, r * 0.3, 0, r);
      g.fill();
      g.stroke();
      g.fillStyle = "#ffe98a";
      for (const [a, b] of [[-0.5, -0.2], [0, -0.3], [0.5, -0.2], [-0.3, 0.2], [0.3, 0.2], [0, 0.55]]) {
        blob(g, a * r, b * r, r * 0.06, r * 0.09);
        g.fill();
      }
      g.fillStyle = "#58b83a";
      starPath(g, 0, -r * 0.8, r * 0.5, 5, 0.45, Math.PI / 2);
      g.fill();
    } else if (kind === "grape") {
      g.strokeStyle = "#4a2a86";
      for (const [a, b] of [[-0.5, -0.4], [0, -0.5], [0.5, -0.4], [-0.27, 0.05], [0.27, 0.05], [0, 0.5]]) {
        g.fillStyle = fill("#d3b2ff", "#7d4fd6");
        blob(g, a * r, b * r, r * 0.38, r * 0.38);
        g.fill();
        g.stroke();
      }
      g.fillStyle = "#62c23f";
      blob(g, r * 0.2, -r * 0.92, r * 0.34, r * 0.16, -0.4);
      g.fill();
    } else if (kind === "fish" || kind === "fish2") {
      const c = kind === "fish" ? ["#ffd27a", "#f58a1f", "#a85a0a"] : ["#ffb0d6", "#ee4f9c", "#9f1c63"];
      g.rotate(Math.PI / 2);
      g.fillStyle = c[1];
      g.strokeStyle = c[2];
      g.beginPath();
      g.moveTo(-r * 0.7, 0);
      g.lineTo(-r * 1.2, -r * 0.5);
      g.lineTo(-r * 1.2, r * 0.5);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = fill(c[0], c[1]);
      blob(g, r * 0.05, 0, r * 0.92, r * 0.62);
      g.fill();
      g.stroke();
      g.fillStyle = "#fff";
      blob(g, r * 0.46, -r * 0.12, r * 0.18, r * 0.18);
      g.fill();
      g.fillStyle = "#222";
      blob(g, r * 0.5, -r * 0.12, r * 0.09, r * 0.09);
      g.fill();
    } else if (kind === "starfish") {
      g.fillStyle = fill("#ffc2a6", "#ff6f6a");
      g.strokeStyle = "#b52f35";
      starPath(g, 0, 0, r * 1.1, 5, 0.52);
      g.fill();
      g.stroke();
      g.fillStyle = "#fff0dc";
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        blob(g, Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48, r * 0.09, r * 0.09);
        g.fill();
      }
    } else if (kind === "shell") {
      g.fillStyle = fill("#fff0f4", "#ff9fbe");
      g.strokeStyle = "#c95a83";
      g.beginPath();
      g.moveTo(0, r);
      g.lineTo(-r * 0.32, r * 0.72);
      g.bezierCurveTo(-r * 1.25, r * 0.1, -r * 0.9, -r, 0, -r);
      g.bezierCurveTo(r * 0.9, -r, r * 1.25, r * 0.1, r * 0.32, r * 0.72);
      g.closePath();
      g.fill();
      g.stroke();
      g.lineWidth = Math.max(1, r * 0.05);
      for (const k of [-0.7, -0.35, 0, 0.35, 0.7]) {
        g.beginPath();
        g.moveTo(0, r * 0.8);
        g.quadraticCurveTo(k * r * 0.6, 0, k * r, -r * 0.82 + Math.abs(k) * r * 0.25);
        g.stroke();
      }
    } else if (kind === "jelly") {
      g.fillStyle = "rgba(190,150,255,0.9)";
      g.strokeStyle = "#6b3fc4";
      g.beginPath();
      g.arc(0, -r * 0.05, r * 0.9, Math.PI, 0);
      g.lineTo(r * 0.9, r * 0.1);
      g.quadraticCurveTo(0, r * 0.32, -r * 0.9, r * 0.1);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = "#a57cf0";
      g.lineWidth = r * 0.11;
      g.lineCap = "round";
      for (const k of [-0.55, 0, 0.55]) {
        g.beginPath();
        g.moveTo(k * r, r * 0.22);
        g.quadraticCurveTo((k + 0.15) * r, r * 0.6, k * r, r);
        g.stroke();
      }
      shine(g, -r * 0.36, -r * 0.42, r * 1.3);
    } else if (kind === "cookie") {
      g.fillStyle = fill("#f2c88a", "#c88a48");
      g.strokeStyle = "#7f5224";
      blob(g, 0, 0, r, r);
      g.fill();
      g.stroke();
      g.fillStyle = "#4e2f18";
      for (const [a, b] of [[-0.4, -0.4], [0.3, -0.5], [0.5, 0.1], [-0.1, 0.05], [-0.5, 0.4], [0.2, 0.55]]) {
        blob(g, a * r, b * r, r * 0.14, r * 0.13);
        g.fill();
      }
    } else if (kind === "donut") {
      g.fillStyle = "#e8b06a";
      g.strokeStyle = "#90602a";
      blob(g, 0, 0, r, r);
      g.fill();
      g.stroke();
      g.fillStyle = "#ff8ec2";
      blob(g, 0, -r * 0.04, r * 0.92, r * 0.88);
      g.fill();
      const cols = ["#fff", "#ffe066", "#7fd8ff", "#a6f07a"];
      for (let i = 0; i < 12; i += 1) {
        const a = (i * TAU) / 12;
        g.save();
        g.translate(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
        g.rotate(a * 2.3);
        g.fillStyle = cols[i % 4];
        g.fillRect(-r * 0.1, -r * 0.03, r * 0.2, r * 0.06);
        g.restore();
      }
      g.fillStyle = "#7a2f5a";
      blob(g, 0, 0, r * 0.3, r * 0.3);
      g.fill();
      g.fillStyle = "rgba(0,0,0,0)";
    } else if (kind === "candy") {
      g.fillStyle = "#ffb347";
      g.strokeStyle = "#b5661a";
      for (const k of [-1, 1]) {
        g.beginPath();
        g.moveTo(k * r * 0.7, 0);
        g.lineTo(k * r * 1.28, -r * 0.46);
        g.lineTo(k * r * 1.28, r * 0.46);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.fillStyle = fill("#ffe9a8", "#ff8f3a");
      blob(g, 0, 0, r * 0.8, r * 0.8);
      g.fill();
      g.stroke();
      g.strokeStyle = "#fff";
      g.lineWidth = r * 0.13;
      g.beginPath();
      g.arc(0, 0, r * 0.42, 0.4, 2.6);
      g.stroke();
    } else if (kind === "cupcake") {
      g.fillStyle = "#ffd98a";
      g.strokeStyle = "#a9722b";
      g.beginPath();
      g.moveTo(-r * 0.7, 0);
      g.lineTo(r * 0.7, 0);
      g.lineTo(r * 0.5, r);
      g.lineTo(-r * 0.5, r);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = fill("#fff", "#ff9ed0");
      g.strokeStyle = "#c95a93";
      blob(g, 0, -r * 0.1, r * 0.92, r * 0.42);
      g.fill();
      g.stroke();
      blob(g, 0, -r * 0.48, r * 0.62, r * 0.36);
      g.fill();
      g.stroke();
      g.fillStyle = "#ee2f4f";
      blob(g, 0, -r * 0.88, r * 0.2, r * 0.2);
      g.fill();
    } else if (kind === "lolli") {
      g.fillStyle = "#fff";
      g.strokeStyle = "#a57";
      g.fillRect(-r * 0.08, 0, r * 0.16, r * 1.2);
      g.fillStyle = fill("#fff", "#ff5fa2");
      g.strokeStyle = "#b92a6e";
      blob(g, 0, -r * 0.1, r * 0.9, r * 0.9);
      g.fill();
      g.stroke();
      g.strokeStyle = "#fff";
      g.lineWidth = r * 0.12;
      g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i < 26; i += 1) {
        const a = i * 0.5;
        const q = (i / 26) * r * 0.78;
        const px = Math.cos(a) * q;
        const py = Math.sin(a) * q - r * 0.1;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.stroke();
    } else if (kind === "star" || kind === "star2") {
      const set = kind === "star" ? ["#fff6b8", "#ffc62e", "#c98506"] : ["#ffd8f4", "#ff7fd0", "#b32d8f"];
      g.fillStyle = fill(set[0], set[1]);
      g.strokeStyle = set[2];
      starPath(g, 0, 0, r * 1.14, 5, 0.54);
      g.fill();
      g.stroke();
      g.fillStyle = "#3a2a10";
      for (const k of [-1, 1]) {
        blob(g, k * r * 0.24, -r * 0.08, r * 0.08, r * 0.11);
        g.fill();
      }
      g.strokeStyle = "#3a2a10";
      g.lineWidth = r * 0.07;
      g.beginPath();
      g.arc(0, r * 0.06, r * 0.2, 0.3, Math.PI - 0.3);
      g.stroke();
    } else if (kind === "planet") {
      g.fillStyle = fill("#bde3ff", "#4a7fe0");
      g.strokeStyle = "#274a9c";
      blob(g, 0, 0, r * 0.82, r * 0.82);
      g.fill();
      g.stroke();
      g.strokeStyle = "#ffd98a";
      g.lineWidth = r * 0.15;
      blob(g, 0, 0, r * 1.25, r * 0.34, -0.35);
      g.stroke();
    } else if (kind === "moon") {
      g.fillStyle = fill("#fffbe0", "#f3d65f");
      g.strokeStyle = "#b5942a";
      g.beginPath();
      g.arc(0, 0, r, 0.9, 5.4);
      g.quadraticCurveTo(-r * 0.05, 0, r * 0.62, r * 0.78);
      g.closePath();
      g.fill();
      g.stroke();
    } else if (kind === "comet") {
      g.fillStyle = "rgba(255,190,90,0.55)";
      g.beginPath();
      g.moveTo(-r * 0.5, -r * 0.55);
      g.lineTo(-r * 0.1, -r * 1.5);
      g.lineTo(r * 0.5, -r * 0.55);
      g.closePath();
      g.fill();
      g.fillStyle = fill("#fff3c0", "#ff8a3a");
      g.strokeStyle = "#b5501a";
      blob(g, 0, 0, r * 0.8, r * 0.8);
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  /* ---------- 배경 (코스마다 · 미리 그려 둠) ---------- */
  function seeded(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  }
  function buildBg(ci) {
    if (bgKey === ci && bg) return;
    bgKey = ci;
    bg = bg || document.createElement("canvas");
    bg.width = Math.round(W * dpr);
    bg.height = Math.round(H * dpr);
    const g = bg.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBg(g, ci);
  }
  function hills(g, y, amp, col, seed) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x * 0.016 + seed) * amp + Math.sin(x * 0.041 + seed * 2) * amp * 0.3);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  }
  function paintBg(g, ci) {
    const r = seeded(321 + ci * 57);
    let gr = g.createLinearGradient(0, 0, 0, H);
    if (ci === 0) {
      gr.addColorStop(0, "#74c8ff");
      gr.addColorStop(0.62, "#d4f3ff");
      gr.addColorStop(1, "#bff0a0");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      // 해
      const sun = g.createRadialGradient(330, 120, 8, 330, 120, 90);
      sun.addColorStop(0, "rgba(255,236,120,1)");
      sun.addColorStop(0.4, "rgba(255,226,100,0.8)");
      sun.addColorStop(1, "rgba(255,226,100,0)");
      g.fillStyle = sun;
      g.fillRect(230, 20, 200, 200);
      hills(g, 500, 26, "#8fdc78", 1);
      hills(g, 556, 20, "#6fcb5c", 3);
      // 꽃
      for (let i = 0; i < 34; i += 1) {
        const x = r() * W;
        const y = 540 + r() * 150;
        if (Math.abs(x - CX) < 90 && y < 660) continue;
        const col = ["#ff8fb6", "#fff0a0", "#ffffff", "#ffb35c"][Math.floor(r() * 4)];
        g.fillStyle = col;
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * TAU;
          blob(g, x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.6, 3.6);
          g.fill();
        }
        g.fillStyle = "#ffcf33";
        blob(g, x, y, 2.6, 2.6);
        g.fill();
      }
    } else if (ci === 1) {
      gr.addColorStop(0, "#5ad0ec");
      gr.addColorStop(0.6, "#2a86c8");
      gr.addColorStop(1, "#1a5d9e");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      // 빛줄기
      g.fillStyle = "rgba(255,255,255,0.09)";
      for (let i = 0; i < 6; i += 1) {
        const x = r() * W;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 40, 0);
        g.lineTo(x - 30, 420);
        g.lineTo(x - 90, 420);
        g.closePath();
        g.fill();
      }
      // 모래 · 해초
      hills(g, 620, 14, "#f0d9a0", 2);
      for (let i = 0; i < 12; i += 1) {
        const x = r() * W;
        if (Math.abs(x - CX) < 120) continue;
        const h = 50 + r() * 70;
        g.strokeStyle = i % 2 ? "#2fb57a" : "#42cf8a";
        g.lineWidth = 8;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(x, 650);
        g.bezierCurveTo(x + 18, 650 - h * 0.4, x - 18, 650 - h * 0.7, x + 4, 650 - h);
        g.stroke();
      }
      for (let i = 0; i < 16; i += 1) {
        g.fillStyle = ["#ff9db0", "#ffd27a", "#fff"][i % 3];
        blob(g, r() * W, 640 + r() * 50, 4 + r() * 4, 3 + r() * 2);
        g.fill();
      }
    } else if (ci === 2) {
      gr.addColorStop(0, "#ffc8e4");
      gr.addColorStop(0.6, "#ffe9d0");
      gr.addColorStop(1, "#ffd9a8");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      // 솜사탕 구름
      for (let i = 0; i < 7; i += 1) {
        const x = r() * W;
        const y = 30 + r() * 180;
        g.fillStyle = "rgba(255,255,255,0.7)";
        for (let k = 0; k < 4; k += 1) {
          blob(g, x + k * 24 - 36, y + (k % 2) * 8, 24, 18);
          g.fill();
        }
      }
      hills(g, 520, 24, "#ffb6d2", 2);
      hills(g, 570, 18, "#f7d29a", 5);
      // 초콜릿 시럽
      g.fillStyle = "#a9673a";
      g.fillRect(0, 590, W, 110);
      g.fillStyle = "#c98a55";
      for (let i = 0; i < 30; i += 1) {
        blob(g, r() * W, 610 + r() * 80, 3 + r() * 6, 2 + r() * 3);
        g.fill();
      }
      // 막대사탕 나무
      for (const [x, y, s, c] of [[42, 500, 1.1, "#ff6fae"], [346, 492, 1.2, "#7fd8ff"], [86, 560, 0.8, "#ffd24a"], [312, 566, 0.8, "#a6f07a"]]) {
        g.fillStyle = "#fff";
        g.fillRect(x - 3 * s, y, 6 * s, 90 * s);
        g.fillStyle = c;
        blob(g, x, y - 6 * s, 30 * s, 30 * s);
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.8)";
        g.lineWidth = 4 * s;
        g.beginPath();
        g.arc(x, y - 6 * s, 16 * s, 0, 4.5);
        g.stroke();
      }
    } else {
      gr.addColorStop(0, "#0d1140");
      gr.addColorStop(0.6, "#2a1f73");
      gr.addColorStop(1, "#4a2a8e");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 150; i += 1) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
        blob(g, r() * W, r() * 620, 0.6 + r() * 1.3, 0.6 + r() * 1.3);
        g.fill();
      }
      drawFood(g, "planet", 334, 170, 38, 0.2);
      drawFood(g, "moon", 54, 250, 26, 0);
      hills(g, 610, 14, "#6c5bb0", 3);
      g.fillStyle = "#5a4a9c";
      for (let i = 0; i < 14; i += 1) {
        blob(g, r() * W, 630 + r() * 60, 8 + r() * 14, 3 + r() * 5);
        g.fill();
      }
    }
    // 먹이 길 (둥근 띠)
    const lane = g.createLinearGradient(0, LANE_TOP, 0, MOUTH_Y);
    lane.addColorStop(0, "rgba(255,255,255,0)");
    lane.addColorStop(0.25, ci === 3 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.32)");
    lane.addColorStop(1, ci === 3 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)");
    g.fillStyle = lane;
    g.beginPath();
    g.roundRect(CX - 42, LANE_TOP - 16, 84, MOUTH_Y - LANE_TOP + 16, 42);
    g.fill();
  }

  /* ---------- 진행 ---------- */
  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (name && overlays[name]) overlays[name].classList.remove("hidden");
    tapPad.classList.toggle("hidden", state !== "play");
    document.querySelector(".hud").classList.toggle("hidden", state !== "play");
    if (name) overlays[name].scrollTop = 0;
  }
  function paintHearts() {
    const el = $("hud-lives");
    if (!course.hearts) {
      el.innerHTML = "";
      return;
    }
    if (el.childElementCount !== course.hearts) {
      el.innerHTML = "";
      for (let i = 0; i < course.hearts; i += 1) el.appendChild(document.createElement("span"));
    }
    [...el.children].forEach((d, i) => (d.className = "life" + (i < hearts ? "" : " empty")));
  }
  function ratio() {
    return notes.length ? earned / notes.length : 0;
  }
  const STAR_AT = [0.4, 0.7, 0.9];
  function starsFor(k) {
    return STAR_AT.filter((v) => k >= v - 1e-9).length;
  }
  function paintHud() {
    $("hud-title").textContent = song.name;
    $("hud-song").textContent = `${songIndex + 1}번 노래`;
    $("hud-score").textContent = score.toLocaleString("ko-KR");
    const k = ratio();
    $("hud-fill").style.width = `${Math.min(100, k * 100)}%`;
    [...$("hud-stars").children].forEach((s, i) => s.classList.toggle("on", k >= STAR_AT[i]));
    paintHearts();
  }
  function initAmbient(ci) {
    ambient = [];
    const r = seeded(77 + ci);
    const n = ci === 3 ? 10 : 8;
    for (let i = 0; i < n; i += 1) ambient.push({ x: r() * W, y: r() * H, s: 0.6 + r() * 0.9, p: r() * 6 });
  }
  function startSong(i) {
    songIndex = i;
    song = SONGS[i];
    course = COURSES[song.course];
    notes = song.chart.map((n, idx) => ({ time: n.time, midi: n.midi, idx, status: "pending", food: FOODS[song.course][(idx * 3 + i) % 5] }));
    score = 0;
    combo = 0;
    maxCombo = 0;
    hits = 0;
    perfects = 0;
    earned = 0;
    hearts = course.hearts;
    floats = [];
    parts = [];
    flying = [];
    ripples = [];
    sad = 0;
    cheer = 0;
    chew = 0;
    evIdx = 0;
    lastBeat = -1;
    endT = 0;
    buildBg(song.course);
    initAmbient(song.course);
    state = "play";
    showOverlay(null);
    paintHud();
    // 시계 시작
    if (clock.mode !== "manual") {
      const c = audioCtx();
      if (bus) {
        try {
          bus.disconnect();
        } catch (_) {
          /* 이미 끊김 */
        }
      }
      if (c && c.state === "running") {
        bus = c.createGain();
        bus.gain.value = 1;
        bus.connect(c.destination);
        clock.mode = "ctx";
        clock.t0 = c.currentTime + 0.12;
      } else {
        bus = c ? c.createGain() : null;
        if (bus) bus.connect(c.destination);
        clock.mode = "perf";
        clock.t0 = performance.now() + 120;
        // 소리가 곧 켜지면 소리 시계로 갈아탐
        if (c) {
          c.resume()
            .then(() => {
              if (clock.mode === "perf" && state === "play") {
                const t = now();
                clock.mode = "ctx";
                clock.t0 = c.currentTime - t;
                const nowT = c.currentTime - clock.t0;
                while (evIdx < song.events.length && song.events[evIdx].t < nowT) evIdx += 1;
              }
            })
            .catch(() => {});
        }
      }
    } else clock.manual = -0.05;
    schedule();
  }
  function stopMusic() {
    if (bus && ac) {
      try {
        bus.gain.setTargetAtTime(0, ac.currentTime, 0.04);
      } catch (_) {
        /* 없어도 됨 */
      }
    }
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
      if (n.time > t + 2) break;
    }
    return bestN;
  }
  function addFloat(text, color, size, y = MOUTH_Y - 92, x = CX) {
    floats.push({ x, y, text, color, size, life: 0.75, max: 0.75, vy: -44 });
  }
  function burst(x, y, n, cols, sp = 170) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = sp * (0.4 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5 + Math.random() * 0.45, max: 0.9, r: 3 + Math.random() * 5, c: cols[i % cols.length], rot: Math.random() * 6, star: Math.random() < 0.6 });
    }
  }
  function confetti() {
    const cols = ["#ff6fae", "#ffd24a", "#6fd8ff", "#8fe27a", "#c49bff"];
    for (let i = 0; i < 46; i += 1) parts.push({ x: Math.random() * W, y: -10 - Math.random() * 80, vx: (Math.random() - 0.5) * 50, vy: 80 + Math.random() * 140, life: 1.6 + Math.random(), max: 2.6, r: 3 + Math.random() * 4, c: cols[i % 5], rot: Math.random() * 6, star: false, slow: true });
  }
  function hit(n, t, perfect) {
    n.status = "hit";
    hits += 1;
    if (perfect) perfects += 1;
    earned += perfect ? 1 : 0.85;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    score += (perfect ? 100 : 60) + Math.min(combo, 40) * (perfect ? 5 : 3);
    chew = 0.2;
    flying.push({ kind: n.food, x: CX, y: MOUTH_Y + 6, vx: 0, vy: 0, rot: 0, life: 0.1, max: 0.1, eat: true });
    burst(CX, MOUTH_Y - 6, perfect ? 12 : 7, perfect ? ["#ffd24a", "#fff3a8", "#ff8fb6"] : ["#fff", "#9fe8ff"]);
    addFloat(perfect ? "최고!" : "좋아!", perfect ? "#ffb31a" : "#2fb4e8", perfect ? 36 : 30);
    sfx.hit(n, perfect);
    // 콤보 고비
    if (combo % 10 === 0) {
      cheer = 1;
      confetti();
      sfx.cheer();
      addFloat(`${combo} 콤보!`, "#ff5fa2", 40, 250);
    }
    if (course.hearts && combo % 8 === 0 && hearts < course.hearts) {
      hearts += 1;
      addFloat("하트 +1", "#ff5f8f", 24, 300);
    }
    paintHud();
  }
  function miss(n) {
    n.status = "missed";
    combo = 0;
    sad = 0.55;
    const dir = Math.random() < 0.5 ? -1 : 1;
    flying.push({ kind: n.food, x: CX, y: MOUTH_Y - 18, vx: dir * 190, vy: -230, rot: 0, life: 0.85, max: 0.85 });
    addFloat("앗!", "#8d7fb0", 28);
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
  function tap(px, py) {
    if (state !== "play") return;
    audioCtx();
    padPress = 1;
    if (px != null) ripples.push({ x: px, y: py, life: 0.28 });
    const t = now();
    const n = nearestNote(t);
    if (!n) return;
    const d = Math.abs(t - n.time);
    if (d <= course.perfect) hit(n, t, true);
    else if (d <= course.good) hit(n, t, false);
    else {
      // 너무 일찍 눌러도 벌점 없음
      chew = 0.08;
      sfx.tap();
    }
  }
  function update(dt) {
    timeAnim += dt;
    updateFx(dt);
    if (state !== "play") {
      mouth += (0.85 - mouth) * Math.min(1, dt * 6);
      return;
    }
    const t = now();
    for (const n of notes) {
      if (n.status === "pending" && t > n.time + course.good) {
        miss(n);
        if (state !== "play") return;
      } else if (n.time > t + 1) break;
    }
    // 박자
    const beat = Math.floor(t / song.beatSec);
    if (beat !== lastBeat && t >= 0) {
      lastBeat = beat;
      beatPulse = 1;
    }
    // 입: 먹이가 가까우면 크게
    const pend = nearestNote(t);
    const near = pend ? Math.max(0, 1 - Math.abs(pend.time - t) / 0.7) : 0;
    const target = chew > 0 ? 0 : 0.5 + near * 0.5;
    mouth += (target - mouth) * Math.min(1, dt * (chew > 0 ? 40 : 14));
    if (t > song.end && notes.every((n) => n.status !== "pending")) clearSong();
  }
  function updateFx(dt) {
    chew = Math.max(0, chew - dt);
    sad = Math.max(0, sad - dt);
    cheer = Math.max(0, cheer - dt * 1.1);
    padPress = Math.max(0, padPress - dt * 6);
    beatPulse = Math.max(0, beatPulse - dt * 5);
    blink -= dt;
    if (blink < -0.12) blink = 1.8 + Math.random() * 2.6;
    for (const f of floats) {
      f.life -= dt;
      f.y += f.vy * dt;
    }
    floats = floats.filter((f) => f.life > 0);
    for (const p of parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.slow) p.vy += 460 * dt;
      p.rot += dt * 5;
    }
    parts = parts.filter((p) => p.life > 0 && p.y < H + 20);
    for (const q of flying) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (!q.eat) q.vy += 620 * dt;
      q.rot += dt * 9;
    }
    flying = flying.filter((q) => q.life > 0);
    for (const q of ripples) q.life -= dt;
    ripples = ripples.filter((q) => q.life > 0);
    const ci = bgKey;
    for (const a of ambient) {
      a.p += dt;
      if (ci === 1) {
        a.y -= dt * 24 * a.s;
        a.x += Math.sin(a.p) * dt * 8;
      } else if (ci === 3) {
        // 반짝이: 제자리
      } else {
        a.x += dt * 9 * a.s;
      }
      if (a.y < -20) a.y = H;
      if (a.x > W + 60) a.x = -60;
    }
  }
  function clearSong() {
    state = "clear";
    clearAt = timeAnim;
    stopMusic();
    const k = ratio();
    const got = starsFor(k);
    const newBest = score > best[songIndex];
    if (got > stars[songIndex]) stars[songIndex] = got;
    if (newBest) best[songIndex] = score;
    saveAll();
    const all = songIndex === SONGS.length - 1 && got > 0;
    if (all) {
      $("all-detail").textContent = `모은 별 ${totalStars()}개 · 총점 ${totalBest().toLocaleString("ko-KR")}`;
      showOverlay("all");
      rankAt(overlays.all);
    } else {
      $("clear-title").textContent = got ? "다 먹었어요!" : "거의 다 왔어요!";
      $("clear-song").textContent = song.name;
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
      $("clear-detail").textContent = `먹은 수 ${hits} / ${notes.length} · 점수 ${score.toLocaleString("ko-KR")}${newBest ? " · 새 기록!" : ""}`;
      $("next-btn").textContent = got ? "다음 노래" : "다시 해 볼래요";
      $("next-btn").dataset.again = got ? "" : "1";
      showOverlay("clear");
      // 코스 끝마다 순위 안내
      if (got && (songIndex + 1) % 5 === 0) rankAt($("clear-rank"));
      else $("clear-rank").innerHTML = "";
    }
    if (got) {
      sfx.clear();
      confetti();
    } else sfx.sad();
  }
  function fail() {
    state = "over";
    stopMusic();
    if (score > best[songIndex]) {
      best[songIndex] = score;
      saveAll();
    }
    sfx.sad();
    $("over-detail").textContent = `${song.name} · 먹은 수 ${hits}개 · 점수 ${score.toLocaleString("ko-KR")}`;
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

  /* ---------- 노래 고르기 ---------- */
  function paintSongs() {
    const box = $("song-list");
    box.innerHTML = "";
    $("songs-stars").textContent = `★ ${totalStars()} / ${SONGS.length * 3}`;
    COURSES.forEach((c, ci) => {
      const sec = document.createElement("section");
      sec.className = `course c${ci}`;
      const h = document.createElement("h3");
      h.textContent = `${ci + 1}코스 · ${c.name}`;
      if (!c.hearts) {
        const e = document.createElement("em");
        e.textContent = "실패 없어요";
        h.appendChild(e);
      }
      sec.appendChild(h);
      const row = document.createElement("div");
      row.className = "song-row";
      SONGS.forEach((s, i) => {
        if (s.course !== ci) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "song-item" + (i === nextSong() ? " next" : "");
        const st = [0, 1, 2].map((k) => (k < stars[i] ? "<b>★</b>" : "★")).join("");
        b.innerHTML = `<span class="n">${i + 1}</span><span class="t">${s.name}</span><span class="st">${st}</span>`;
        b.addEventListener("click", () => {
          audioCtx();
          startSong(i);
        });
        row.appendChild(b);
      });
      sec.appendChild(row);
      box.appendChild(sec);
    });
  }
  function paintTitle() {
    const total = totalStars();
    const i = nextSong();
    $("start-btn").textContent = total ? `이어서 하기 · ${i + 1}번 노래` : "시작!";
    $("title-stars").textContent = total ? `모은 별 ★ ${total} / ${SONGS.length * 3}` : "";
  }

  /* ---------- 그리기 ---------- */
  function drawStar(x, y, r, rot, c) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = c;
    starPath(ctx, 0, 0, r, 5, 0.5);
    ctx.fill();
    ctx.restore();
  }
  function drawAmbient() {
    const ci = bgKey;
    for (const a of ambient) {
      if (ci === 0 || ci === 2) {
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        const y = 40 + (a.y % 170);
        for (let k = 0; k < 3; k += 1) {
          blob(ctx, a.x + k * 22 * a.s, y + (k === 1 ? -7 : 0) * a.s, 18 * a.s, 13 * a.s);
          ctx.fill();
        }
      } else if (ci === 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        blob(ctx, a.x, a.y, 7 * a.s, 7 * a.s);
        ctx.stroke();
      } else {
        const k = 0.5 + Math.sin(a.p * 3) * 0.5;
        ctx.globalAlpha = 0.35 + k * 0.65;
        drawStar(a.x, (a.y % 560) + 30, 3 + k * 3 * a.s, a.p * 0.3, "#fff6b8");
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawRing(t, pend) {
    const inWin = pend && Math.abs(pend.time - t) <= course.good;
    const inPerfect = pend && Math.abs(pend.time - t) <= course.perfect;
    const R = 46 + beatPulse * 3 + (inWin ? 5 : 0);
    ctx.save();
    if (inWin) {
      ctx.fillStyle = inPerfect ? "rgba(255,226,90,0.42)" : "rgba(255,226,90,0.22)";
      blob(ctx, CX, MOUTH_Y, R + 12, R + 12);
      ctx.fill();
    }
    ctx.strokeStyle = inPerfect ? "#ffb31a" : inWin ? "#ffd24a" : "rgba(255,255,255,0.92)";
    ctx.lineWidth = inWin ? 8 : 5;
    ctx.setLineDash(inWin ? [] : [10, 9]);
    ctx.lineDashOffset = -timeAnim * 30;
    blob(ctx, CX, MOUTH_Y, R, R);
    ctx.stroke();
    ctx.restore();
    // 말풍선 (처음 두 코스)
    if (inWin && song.course < 2) {
      const bx = CX + 92;
      const by = MOUTH_Y - 92;
      const s = 1 + beatPulse * 0.08;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(s, s);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#ff8a3d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-40, -22, 80, 44, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff6a1f";
      ctx.font = "26px 'Bagel Fat One', Jua";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("콕!", 0, 2);
      ctx.restore();
    }
  }
  function drawFoods(t) {
    const dist = MOUTH_Y - LANE_TOP;
    for (let i = notes.length - 1; i >= 0; i -= 1) {
      const n = notes[i];
      if (n.status !== "pending") continue;
      const left = n.time - t;
      if (left > course.approach) continue;
      const y = MOUTH_Y - (left / course.approach) * dist;
      const grow = Math.min(1, (course.approach - left) / 0.3);
      const r = 25 * grow * (1 + beatPulse * 0.06);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      blob(ctx, CX + 2, y + r + 2, r * 0.7, r * 0.2);
      ctx.fill();
      drawFood(ctx, n.food, CX, y, r, Math.sin(timeAnim * 3 + n.idx) * 0.12);
    }
  }
  function drawFx() {
    for (const q of flying) {
      const k = q.life / q.max;
      ctx.globalAlpha = q.eat ? 1 : Math.min(1, k * 1.5);
      drawFood(ctx, q.kind, q.x, q.y, q.eat ? 25 * k : 25, q.rot);
      ctx.globalAlpha = 1;
    }
    for (const p of parts) {
      ctx.globalAlpha = Math.min(1, p.life * 2.2);
      if (p.star) drawStar(p.x, p.y, p.r * 1.3, p.rot, p.c);
      else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floats) {
      const k = f.life / f.max;
      const pop = k > 0.8 ? 1 + (k - 0.8) * 1.6 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.font = `${Math.round(f.size * pop)}px 'Bagel Fat One', Jua`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#fff";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    for (const q of ripples) {
      ctx.strokeStyle = `rgba(255,255,255,${q.life * 3})`;
      ctx.lineWidth = 4;
      blob(ctx, q.x, q.y, 30 * (1 - q.life / 0.28) + 8, 30 * (1 - q.life / 0.28) + 8);
      ctx.stroke();
    }
  }
  function drawCountIn(t) {
    if (t < 0 || t >= song.lead - 0.02) return;
    const left = Math.ceil((song.lead - t) / song.beatSec);
    if (left > 4) return;
    const ph = ((song.lead - t) / song.beatSec) % 1;
    const s = 1 + ph * 0.25;
    ctx.save();
    ctx.translate(CX, 210);
    ctx.scale(s, s);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "80px 'Bagel Fat One', Jua";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(String(left), 0, 0);
    ctx.fillStyle = "#ff6fae";
    ctx.fillText(String(left), 0, 0);
    ctx.restore();
  }
  function drawHelp(t) {
    // 첫 곡 앞부분: 무엇을 할지 큰 글씨로
    if (songIndex === 0 && hits < 2 && t < 12) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "19px Jua";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      const msg = "과일이 동그라미에 들어오면 콕!";
      ctx.strokeText(msg, CX, 134);
      ctx.fillStyle = "#5a3ea0";
      ctx.fillText(msg, CX, 134);
      ctx.restore();
    }
  }
  function drawBuddyNow(t, pend) {
    const kind = song ? COURSES[song.course].buddy : "hippo";
    const dance = Math.sin((t / (song ? song.beatSec : 0.6)) * Math.PI) ;
    const mood = sad > 0 ? "sad" : state === "clear" || cheer > 0.4 ? "happy" : "";
    const bob = state === "play" ? beatPulse * 4 : Math.abs(Math.sin(timeAnim * 3.4)) * 8;
    const lookX = 0;
    let lookY = -0.85;
    if (pend) {
      const d = pend.time - t;
      lookY = Math.max(-0.9, Math.min(0.2, -d * 0.7));
    }
    drawBuddy(ctx, kind, CX, MOUTH_Y + bob * 0.5, BUDDY_S, {
      open: state === "clear" ? 0.1 : mouth,
      blink: blink < 0,
      squash: beatPulse * 0.7 + (chew > 0 ? 0.8 : 0),
      mood,
      arm: state === "clear" ? 0.5 + Math.sin(timeAnim * 8) * 0.4 : cheer > 0 ? 0.9 : Math.max(0, dance) * 0.18,
      lookX,
      lookY,
    });
  }
  function draw(t) {
    if (!bg) buildBg(0);
    ctx.drawImage(bg, 0, 0, W, H);
    drawAmbient();
    if (state === "play" || state === "paused") {
      const pend = nearestNote(t);
      drawBuddyNow(t, pend);
      drawRing(t, pend);
      drawFoods(t);
      drawCountIn(t);
      drawHelp(t);
    } else if (song) {
      drawBuddyNow(t, null);
    }
    drawFx();
    tapPad.style.setProperty("--press", String(padPress));
  }
  function loop(ts) {
    const dt = Math.max(0, Math.min(0.05, (ts - last) / 1000 || 0.016));
    last = ts;
    if (state !== "paused") update(dt);
    draw(song ? now() : 0);
    raf = requestAnimationFrame(loop);
  }
  let raf = 0;

  /* ---------- 입력 ---------- */
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  });
  tapPad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  });
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const tapKey = ["Space", "Enter", "KeyF", "KeyJ", "KeyZ", "KeyK"].includes(e.code);
    if (!tapKey) return;
    e.preventDefault();
    if (state === "play") tap();
    else if (state === "title" && (e.code === "Space" || e.code === "Enter")) $("start-btn").click();
    else if (state === "clear" && (e.code === "Space" || e.code === "Enter")) $("next-btn").click();
    else if (state === "over" && (e.code === "Space" || e.code === "Enter")) $("retry-btn").click();
  });
  $("start-btn").addEventListener("click", () => {
    audioCtx();
    startSong(nextSong());
  });
  $("pick-btn").addEventListener("click", () => {
    audioCtx();
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
    audioCtx();
    if ($("next-btn").dataset.again === "1") startSong(songIndex);
    else startSong(Math.min(SONGS.length - 1, songIndex + 1));
  });
  $("again-btn2").addEventListener("click", () => {
    audioCtx();
    startSong(songIndex);
  });
  $("retry-btn").addEventListener("click", () => {
    audioCtx();
    startSong(songIndex);
  });
  const toSongs = () => {
    state = "songs";
    stopMusic();
    paintSongs();
    showOverlay("songs");
  };
  $("menu-btn").addEventListener("click", toSongs);
  $("menu-btn2").addEventListener("click", toSongs);
  $("again-btn").addEventListener("click", () => {
    state = "songs";
    paintSongs();
    showOverlay("songs");
  });

  /* ---------- 시작 ---------- */
  buildBg(0);
  paintTitle();
  showOverlay("title");
  last = performance.now();
  raf = requestAnimationFrame(loop);

  if (window.TodayPause) {
    let pausedPerf = 0;
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        if (clock.mode === "ctx") ac.suspend().catch(() => {});
        else pausedPerf = performance.now();
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        if (clock.mode === "ctx") ac.resume().catch(() => {});
        else if (clock.mode === "perf") clock.t0 += performance.now() - pausedPerf;
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
    /** 시계를 직접 돌림 (자동 점검) */
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
    stars: () => stars.slice(),
    ratio,
    art: { drawBuddy, drawFood, paintBg, FOODS },
  };
})();
