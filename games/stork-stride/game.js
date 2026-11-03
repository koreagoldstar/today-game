(() => {
  "use strict";

  /*
   * 서빙왕
   *  - 연회장을 달리는 횡스크롤 장면 (월드마다 벽 · 바닥 · 조명이 다름)
   *  - 접시 탑이 한 장씩 출렁이고, 테이블에 서빙하면 줄고 주방에서 올려 주면 늘어남
   *  - 앞에서 오는 일을 미리 보여 줌: 고양이 손님 · 물웅덩이 · 돌풍
   *  - 쓰러지면 접시가 한 장씩 날아가 깨짐
   *  조작과 균형 공식은 예전 서빙왕 그대로 (기울면 반대로 짧게 보정)
   */
  const MAX_LEAN = 1;
  const BEST_KEY = "serving-king-best";
  const GAME_ID = "stork-stride";
  const TAU = Math.PI * 2;
  const FIXED = 1 / 120;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);

  const ZONES = [
    { name: "황금 연회장", wall: ["#8a5a33", "#5f3a20"], paper: "rgba(255,214,150,.09)", trim: "#e0b45a", wains: "#4a2a16", floor: ["#7a4a28", "#4d2c16"], plank: "rgba(30,14,4,.3)", carpet: "#a92f33", carpetD: "#7c1f25", edge: "#e8c46a", light: "chand", sky: ["#26305e", "#6a4a7c"], glow: "rgba(255,205,130,.5)" },
    { name: "장미 테라스", wall: ["#4f6f58", "#33503f"], paper: "rgba(255,190,200,.1)", trim: "#e8d9b0", wains: "#2c4234", floor: ["#a08e77", "#6e6050"], plank: "rgba(50,40,30,.24)", carpet: "#8f3f69", carpetD: "#6a2d4e", edge: "#f0d8a8", light: "lantern", sky: ["#f09a78", "#ffd9a6"], glow: "rgba(255,190,140,.42)" },
    { name: "달빛 발코니", wall: ["#37407c", "#232a5a"], paper: "rgba(170,190,255,.09)", trim: "#b8c8ff", wains: "#1b2148", floor: ["#454b84", "#2a2e5c"], plank: "rgba(10,12,40,.3)", carpet: "#2f78a8", carpetD: "#1f567d", edge: "#cfe4ff", light: "chand", sky: ["#0c1240", "#2c3a86"], glow: "rgba(170,200,255,.42)" },
    { name: "왕실 대연회장", wall: ["#6e3370", "#472049"], paper: "rgba(255,210,120,.1)", trim: "#f0c64e", wains: "#351737", floor: ["#6b4426", "#432813"], plank: "rgba(30,14,4,.3)", carpet: "#c3902f", carpetD: "#946a1d", edge: "#fff0b0", light: "chand", sky: ["#1a1040", "#5a2a80"], glow: "rgba(255,210,120,.5)" },
  ];
  const ZONE_TILES = 7;
  const DISHES = ["steak", "pasta", "salad", "cake", "lobster"];

  /* ---------- 소리 ---------- */
  const Sound = {
    ctx: null,
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
          this.ctx = new AC();
        } catch (_) {
          return;
        }
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = 0.9;
        const comp = c.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(c.destination);
        this.buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = this.buf.getChannelData(0);
        for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    },
    tone(f, dur, type, peak, slide = 1, delay = 0) {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.03);
    },
    noise(dur, freq, type, peak, delay = 0, attack = 0.004) {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = c.currentTime + delay;
      const s = c.createBufferSource();
      s.buffer = this.buf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.03);
    },
    step() {
      this.noise(0.035, 900 + Math.random() * 300, "bandpass", 0.05);
    },
    clink() {
      const f = 2300 + Math.random() * 1100;
      this.tone(f, 0.08, "sine", 0.05);
      this.tone(f * 1.5, 0.05, "sine", 0.025);
    },
    warn() {
      this.tone(880, 0.09, "triangle", 0.14);
      this.tone(880, 0.09, "triangle", 0.14, 1, 0.16);
    },
    bump() {
      this.noise(0.08, 500, "lowpass", 0.34);
      this.tone(180, 0.1, "sine", 0.18, 0.6);
    },
    splash() {
      this.noise(0.26, 1800, "bandpass", 0.28, 0, 0.012);
      this.tone(560, 0.12, "sine", 0.1, 1.5, 0.05);
    },
    wind() {
      this.noise(1.1, 700, "bandpass", 0.3, 0, 0.3);
    },
    serve() {
      [1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.15, 1, i * 0.07));
    },
    perfect() {
      [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.17, 1, i * 0.06));
    },
    add() {
      this.tone(1500, 0.05, "sine", 0.08);
      this.noise(0.03, 3200, "bandpass", 0.08);
    },
    crash(k = 1) {
      this.noise(0.18 + Math.random() * 0.1, 3800, "highpass", 0.2 * k);
      for (let i = 0; i < 3; i += 1) this.tone(1800 + Math.random() * 2600, 0.1, "square", 0.022 * k, 0.8, i * 0.018);
    },
    fall() {
      this.tone(520, 0.45, "triangle", 0.16, 0.34);
    },
    lose() {
      [392, 370, 349, 262].forEach((f, i) => this.tone(f, i === 3 ? 0.6 : 0.24, "triangle", 0.14, i === 3 ? 0.72 : 1, i * 0.2));
    },
    ui() {
      this.tone(740, 0.05, "sine", 0.12);
    },
  };

  /* ---------- 상태 ---------- */
  const stageEl = $("stage");
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  let VW = 390;
  let VH = 700;
  let DPR = 1;
  let L = {};
  const sprites = { waiter: null, guest: null };
  const tiles = [];
  const floors = [];
  let dishSprites = {};
  let chandSprite = null;
  let lanternSprite = null;

  let rnd = Math.random;
  let state = "title";
  let distance = 0;
  let score = 0;
  let tips = 0;
  let best = 0;
  try {
    best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
  } catch (_) {
    best = 0;
  }
  let combo = 0;
  let maxCombo = 0;
  let stableT = 0;
  let lean = 0;
  let leanVel = 0;
  let visualLean = 0;
  const held = { left: false, right: false };
  let botHold = null;
  let stepPhase = 0;
  let scroll = 0;
  let plates = [];
  let serves = 0;
  let perfects = 0;
  let nextAdd = 18;
  let tables = [];
  let nextTableM = 16;
  let nextServeM = 24;
  let ev = null;
  let nextEvent = 6;
  let shakeT = 0;
  let fallT = 0;
  let fallDir = 0;
  let flying = [];
  let bodies = [];
  let shards = [];
  let parts = [];
  let floats = [];
  let streaks = [];
  let titleT = 0;
  let toastT = 0;
  let lastZone = 0;
  let acc = 0;
  let lastT = performance.now();
  let clinkT = 0;
  let stepSnd = 0;
  let lastScore = 0;
  let botT = 0;

  /* ---------- 배치 ---------- */
  function layout() {
    const r = stageEl.getBoundingClientRect();
    VW = Math.max(1, r.width);
    VH = Math.max(1, r.height);
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
    const land = VW > VH * 1.2;
    const padH = land ? 74 : 92;
    const feet = land ? VH - 62 : VH - padH - Math.max(26, VH * 0.05);
    const hudB = land ? 66 : 96;
    // 머리 위 접시 12장까지 들어가게 키를 정함
    const room = feet - hudB;
    const waiterH = clamp(room / 2.02, 78, 250);
    const gap = waiterH * 0.082;
    L = {
      land,
      feet,
      waiterH,
      waiterW: (waiterH * 610) / 900,
      gap,
      plateW: waiterH * 0.68,
      wallB: feet - waiterH * 0.44,
      px: waiterH * 0.34,
      x: land ? VW * 0.4 : VW * 0.44,
      hudB,
    };
    L.tileW = Math.max(300, L.wallB * 0.82);
    bakeAll();
  }
  function mk(w, h, scale = 1.5) {
    const c = document.createElement("canvas");
    const k = Math.min(DPR, scale);
    c.width = Math.ceil(w * k);
    c.height = Math.ceil(h * k);
    const g = c.getContext("2d");
    g.scale(k, k);
    return [c, g];
  }
  function bakeAll() {
    tiles.length = 0;
    floors.length = 0;
    ZONES.forEach((Z, zi) => {
      const list = [];
      for (let v = 0; v < 3; v += 1) list.push(bakeWall(Z, v, zi));
      tiles.push(list);
      floors.push(bakeFloor(Z));
    });
    dishSprites = {};
    for (const d of DISHES) dishSprites[d] = bakeDish(d);
    chandSprite = bakeChandelier();
    lanternSprite = bakeLantern();
  }
  function bakeWall(Z, variant, zi) {
    const W = L.tileW;
    const H = L.wallB + 2;
    const [c, g] = mk(W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, Z.wall[0]);
    gr.addColorStop(1, Z.wall[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // 벽지 무늬
    g.fillStyle = Z.paper;
    for (let y = 18; y < H; y += 40) {
      for (let x = (y % 80 === 18 ? 0 : 22); x < W; x += 44) {
        g.beginPath();
        g.moveTo(x, y - 8);
        g.quadraticCurveTo(x + 7, y, x, y + 8);
        g.quadraticCurveTo(x - 7, y, x, y - 8);
        g.fill();
      }
    }
    const wainH = H * 0.22;
    const midX = W / 2;
    const frameW = W * 0.5;
    const frameH = (H - wainH) * 0.68;
    const frameY = (H - wainH) * 0.17;
    const fx = midX - frameW / 2;
    if (variant === 0) {
      // 아치 창문: 바깥 하늘 + 달 + 커튼
      const sky = g.createLinearGradient(0, frameY, 0, frameY + frameH);
      sky.addColorStop(0, Z.sky[0]);
      sky.addColorStop(1, Z.sky[1]);
      const arch = () => {
        g.beginPath();
        g.moveTo(fx, frameY + frameH);
        g.lineTo(fx, frameY + frameW / 2);
        g.arc(midX, frameY + frameW / 2, frameW / 2, Math.PI, 0);
        g.lineTo(fx + frameW, frameY + frameH);
        g.closePath();
      };
      g.save();
      arch();
      g.clip();
      g.fillStyle = sky;
      g.fillRect(fx, frameY, frameW, frameH);
      if (zi !== 1) {
        g.fillStyle = "#fff";
        for (let i = 0; i < 14; i += 1) g.fillRect(fx + ((i * 73) % frameW), frameY + ((i * 41) % (frameH * 0.7)), 1.6, 1.6);
        g.fillStyle = "#fff7d6";
        g.beginPath();
        g.arc(midX + frameW * 0.16, frameY + frameH * 0.28, frameW * 0.12, 0, TAU);
        g.fill();
      } else {
        g.fillStyle = "#fff2c0";
        g.beginPath();
        g.arc(midX, frameY + frameH * 0.72, frameW * 0.2, 0, TAU);
        g.fill();
      }
      g.fillStyle = "rgba(0,0,0,.28)";
      g.beginPath();
      g.moveTo(fx, frameY + frameH);
      for (let x = 0; x <= frameW; x += 8) g.lineTo(fx + x, frameY + frameH * 0.86 - Math.sin(x * 0.09) * 7 - Math.sin(x * 0.2) * 3);
      g.lineTo(fx + frameW, frameY + frameH);
      g.fill();
      g.restore();
      g.strokeStyle = Z.trim;
      g.lineWidth = 5;
      arch();
      g.stroke();
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(midX, frameY);
      g.lineTo(midX, frameY + frameH);
      g.moveTo(fx, frameY + frameH * 0.55);
      g.lineTo(fx + frameW, frameY + frameH * 0.55);
      g.stroke();
      // 커튼
      for (const s of [-1, 1]) {
        const cx = s < 0 ? fx - 6 : fx + frameW + 6;
        g.fillStyle = Z.carpet;
        g.beginPath();
        g.moveTo(cx, frameY - 8);
        g.lineTo(cx - s * W * 0.15, frameY - 8);
        g.quadraticCurveTo(cx - s * W * 0.03, frameY + frameH * 0.5, cx - s * W * 0.1, frameY + frameH + 4);
        g.lineTo(cx + s * 6, frameY + frameH + 4);
        g.closePath();
        g.fill();
        g.fillStyle = Z.edge;
        g.fillRect(cx - s * W * 0.075 - 3, frameY + frameH * 0.56, 8, 6);
      }
    } else if (variant === 1) {
      // 왕 고양이 초상화
      const h2 = frameH * 0.8;
      const y2 = frameY + frameH * 0.1;
      g.fillStyle = Z.trim;
      g.fillRect(fx - 8, y2 - 8, frameW + 16, h2 + 16);
      g.fillStyle = "rgba(0,0,0,.25)";
      g.fillRect(fx - 2, y2 - 2, frameW + 4, h2 + 4);
      const p = g.createLinearGradient(0, y2, 0, y2 + h2);
      p.addColorStop(0, "#3c2c50");
      p.addColorStop(1, "#6b4a58");
      g.fillStyle = p;
      g.fillRect(fx, y2, frameW, h2);
      if (sprites.guest) {
        const k = Math.min((frameW * 0.92) / sprites.guest.width, (h2 * 0.94) / sprites.guest.height);
        g.drawImage(sprites.guest, midX - (sprites.guest.width * k) / 2, y2 + h2 - sprites.guest.height * k, sprites.guest.width * k, sprites.guest.height * k);
      }
    } else {
      // 거울 + 벽 등
      const h2 = frameH * 0.86;
      const y2 = frameY + frameH * 0.06;
      g.fillStyle = Z.trim;
      g.beginPath();
      g.ellipse(midX, y2 + h2 / 2, frameW * 0.42, h2 / 2, 0, 0, TAU);
      g.fill();
      const m = g.createLinearGradient(fx, y2, fx + frameW, y2 + h2);
      m.addColorStop(0, "#dbeaf5");
      m.addColorStop(0.5, "#9eb9cf");
      m.addColorStop(1, "#d4e4ef");
      g.fillStyle = m;
      g.beginPath();
      g.ellipse(midX, y2 + h2 / 2, frameW * 0.37, h2 / 2 - 7, 0, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.6)";
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(midX - frameW * 0.16, y2 + h2 * 0.28);
      g.lineTo(midX - frameW * 0.02, y2 + h2 * 0.14);
      g.stroke();
    }
    // 벽 아래 판
    g.fillStyle = Z.wains;
    g.fillRect(0, H - wainH, W, wainH);
    g.fillStyle = Z.trim;
    g.fillRect(0, H - wainH - 4, W, 4);
    g.strokeStyle = "rgba(255,255,255,.1)";
    g.lineWidth = 2;
    const pn = 3;
    for (let i = 0; i < pn; i += 1) {
      const pw = W / pn;
      g.strokeRect(i * pw + 12, H - wainH + 10, pw - 24, wainH - 22);
    }
    // 기둥: 타일 경계
    for (const x of [0, W]) {
      const pg = g.createLinearGradient(x - 16, 0, x + 16, 0);
      pg.addColorStop(0, "rgba(0,0,0,.28)");
      pg.addColorStop(0.5, Z.trim);
      pg.addColorStop(1, "rgba(0,0,0,.28)");
      g.fillStyle = pg;
      g.fillRect(x - 14, 0, 28, H);
    }
    // 그늘
    const sh = g.createLinearGradient(0, 0, 0, H);
    sh.addColorStop(0, "rgba(10,5,20,.34)");
    sh.addColorStop(0.3, "rgba(10,5,20,0)");
    sh.addColorStop(0.8, "rgba(10,5,20,0)");
    sh.addColorStop(1, "rgba(10,5,20,.3)");
    g.fillStyle = sh;
    g.fillRect(0, 0, W, H);
    return c;
  }
  function bakeFloor(Z) {
    const W = 320;
    const H = VH - L.wallB + 4;
    const [c, g] = mk(W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, Z.floor[1]);
    gr.addColorStop(0.3, Z.floor[0]);
    gr.addColorStop(1, Z.floor[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // 비스듬한 마루 (이음매가 맞도록 주기를 맞춤)
    g.strokeStyle = Z.plank;
    g.lineWidth = 1.6;
    const step = 40;
    for (let x = -H; x < W + H; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + H * 0.5, H);
      g.stroke();
    }
    g.lineWidth = 1;
    for (let y = 8, i = 0; y < H; y += 8 + i * 2.2, i += 1) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // 카펫
    const top = L.feet - L.wallB - L.waiterH * 0.13;
    const bot = L.feet - L.wallB + L.waiterH * 0.11;
    g.fillStyle = "rgba(0,0,0,.2)";
    g.fillRect(0, bot, W, 5);
    const cg = g.createLinearGradient(0, top, 0, bot);
    cg.addColorStop(0, Z.carpetD);
    cg.addColorStop(0.4, Z.carpet);
    cg.addColorStop(1, Z.carpetD);
    g.fillStyle = cg;
    g.fillRect(0, top, W, bot - top);
    g.fillStyle = Z.edge;
    g.fillRect(0, top, W, 3);
    g.fillRect(0, bot - 3, W, 3);
    g.fillStyle = "rgba(255,255,255,.1)";
    for (let x = 16; x < W; x += 64) {
      const m = (top + bot) / 2;
      const hh = (bot - top) * 0.28;
      g.beginPath();
      g.moveTo(x, m - hh);
      g.lineTo(x + 16, m);
      g.lineTo(x, m + hh);
      g.lineTo(x - 16, m);
      g.closePath();
      g.fill();
    }
    return c;
  }
  /** 접시 한 장 + 음식 */
  function bakeDish(type) {
    const W = 200;
    const H = 96;
    const [c, g] = mk(W, H, 2);
    const cx = W / 2;
    const cy = 62;
    g.fillStyle = "rgba(40,20,10,.22)";
    g.beginPath();
    g.ellipse(cx, cy + 12, 92, 19, 0, 0, TAU);
    g.fill();
    const rim = g.createLinearGradient(0, cy - 22, 0, cy + 22);
    rim.addColorStop(0, "#ffffff");
    rim.addColorStop(1, "#d6d2ca");
    g.fillStyle = rim;
    g.beginPath();
    g.ellipse(cx, cy, 94, 25, 0, 0, TAU);
    g.fill();
    g.strokeStyle = "#d9b45a";
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(cx, cy, 88, 22, 0, 0, TAU);
    g.stroke();
    g.fillStyle = "#f7f4ee";
    g.beginPath();
    g.ellipse(cx, cy - 1, 66, 15, 0, 0, TAU);
    g.fill();
    const blob = (x, y, rx, ry, col, rot = 0) => {
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(x, y, rx, ry, rot, 0, TAU);
      g.fill();
    };
    if (type === "steak") {
      blob(cx, cy - 12, 48, 20, "#6b3418");
      blob(cx - 6, cy - 16, 40, 13, "#8f4a22");
      g.strokeStyle = "#3f1d0c";
      g.lineWidth = 3;
      for (const d of [-22, -6, 10, 26]) {
        g.beginPath();
        g.moveTo(cx + d - 8, cy - 25);
        g.lineTo(cx + d + 8, cy - 7);
        g.stroke();
      }
      blob(cx + 44, cy - 10, 11, 9, "#e23b32");
      blob(cx + 41, cy - 13, 3.5, 2.5, "#ff9a90");
      blob(cx - 46, cy - 8, 13, 7, "#5fb04c");
    } else if (type === "pasta") {
      blob(cx, cy - 11, 50, 20, "#f0c04a");
      g.strokeStyle = "#ffdf80";
      g.lineWidth = 3.4;
      for (let i = 0; i < 9; i += 1) {
        g.beginPath();
        g.arc(cx - 30 + i * 8, cy - 11 + Math.sin(i) * 5, 12, i, i + 3.4);
        g.stroke();
      }
      blob(cx, cy - 22, 24, 9, "#c9342c");
      blob(cx + 6, cy - 26, 6, 4, "#67b34f");
    } else if (type === "salad") {
      for (const [dx, dy, rx, col] of [[-30, -10, 19, "#5fb84a"], [-8, -16, 22, "#7ccf5c"], [20, -11, 20, "#4ea53e"], [38, -6, 13, "#8bd96a"], [-42, -4, 12, "#6fc454"]]) blob(cx + dx, cy + dy, rx, rx * 0.68, col);
      blob(cx - 14, cy - 21, 8, 7, "#e6443a");
      blob(cx + 22, cy - 19, 7, 6, "#ffcf3f");
      blob(cx + 2, cy - 11, 6, 5, "#e6443a");
    } else if (type === "cake") {
      g.fillStyle = "#ffe0ea";
      g.beginPath();
      g.roundRect(cx - 36, cy - 44, 72, 40, 8);
      g.fill();
      g.fillStyle = "#f2a0b8";
      g.fillRect(cx - 36, cy - 28, 72, 7);
      blob(cx, cy - 44, 36, 9, "#fff6f8");
      blob(cx, cy - 53, 9, 9, "#d9304a");
      blob(cx - 3, cy - 56, 2.6, 2, "#ffb0bc");
    } else {
      // 랍스터
      blob(cx, cy - 13, 46, 15, "#d8402e");
      blob(cx - 12, cy - 18, 26, 8, "#ef6a50");
      for (const s of [-1, 1]) {
        blob(cx + s * 50, cy - 20, 15, 9, "#c9301f", s * -0.5);
        blob(cx + s * 58, cy - 26, 8, 5, "#ef6a50", s * -0.5);
      }
      blob(cx - 28, cy - 22, 3.4, 3.4, "#161018");
      blob(cx - 18, cy - 23, 3.4, 3.4, "#161018");
      blob(cx + 40, cy - 4, 11, 6, "#ffd84a");
    }
    return c;
  }
  function bakeChandelier() {
    const S = 240;
    const [c, g] = mk(S, S, 1.5);
    const cx = S / 2;
    g.strokeStyle = "#7a5a22";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, 0);
    g.lineTo(cx, 86);
    g.stroke();
    const glow = g.createRadialGradient(cx, 112, 8, cx, 112, 114);
    glow.addColorStop(0, "rgba(255,226,150,.5)");
    glow.addColorStop(1, "rgba(255,226,150,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = "#d9ae4a";
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(cx, 106, 78, 19, 0, 0, Math.PI);
    g.stroke();
    g.fillStyle = "#e9c25c";
    g.beginPath();
    g.ellipse(cx, 96, 15, 19, 0, 0, TAU);
    g.fill();
    for (const dx of [-74, -38, 0, 38, 74]) {
      const y = 106 + Math.sqrt(Math.max(0, 1 - (dx / 78) ** 2)) * 19;
      g.fillStyle = "#fff6e0";
      g.fillRect(cx + dx - 3.5, y - 22, 7, 22);
      g.fillStyle = "#ffd76a";
      g.beginPath();
      g.ellipse(cx + dx, y - 28, 5, 9, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#fff8c8";
      g.beginPath();
      g.ellipse(cx + dx, y - 26, 2.4, 5, 0, 0, TAU);
      g.fill();
    }
    return c;
  }
  function bakeLantern() {
    const S = 240;
    const [c, g] = mk(S, 120, 1.5);
    g.strokeStyle = "rgba(40,30,20,.7)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 8);
    g.quadraticCurveTo(S / 2, 46, S, 8);
    g.stroke();
    const cols = ["#ffd76a", "#ff9fb0", "#9fe0ff", "#ffd76a", "#c8f09a"];
    cols.forEach((col, i) => {
      const t = (i + 0.5) / cols.length;
      const x = t * S;
      const y = 8 + 4 * t * (1 - t) * 38;
      const gl = g.createRadialGradient(x, y + 12, 1, x, y + 12, 26);
      gl.addColorStop(0, "rgba(255,230,160,.55)");
      gl.addColorStop(1, "rgba(255,230,160,0)");
      g.fillStyle = gl;
      g.fillRect(x - 26, y - 14, 52, 52);
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(x, y + 12, 8, 10, 0, 0, TAU);
      g.fill();
    });
    return c;
  }

  /* ---------- 게임 ---------- */
  function difficulty() {
    const soft = distance / 42;
    const late = Math.max(0, distance - 40) / 55;
    return Math.min(2.6, soft + late * 0.85);
  }
  function newPlate() {
    return { dish: DISHES[Math.floor(rnd() * DISHES.length)], w: 0, v: 0, drop: 0 };
  }
  function resetRun() {
    distance = 0;
    tips = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    stableT = 0;
    lean = 0;
    leanVel = 0;
    visualLean = 0;
    stepPhase = 0;
    plates = [];
    for (let i = 0; i < 5; i += 1) plates.push(newPlate());
    serves = 0;
    perfects = 0;
    nextAdd = 16;
    tables = [];
    nextTableM = 4;
    nextServeM = 22;
    ev = null;
    nextEvent = 5 + rnd() * 2.5;
    fallT = 0;
    fallDir = 0;
    flying = [];
    bodies = [];
    shards = [];
    parts = [];
    floats = [];
    streaks = [];
    lastZone = 0;
    $("warn").classList.remove("on");
    for (const id of ["pad-back", "pad-front"]) $(id).classList.remove("need");
    if (window.TodayGameRank) window.TodayGameRank.reset();
    updateHud();
  }
  function start() {
    state = "play";
    showOverlay(null);
    resetRun();
    acc = 0;
    lastT = performance.now();
    document.body.classList.add("in-play");
    Sound.unlock();
  }
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("on");
    toastT = 1.3;
  }
  function addFloat(text, x, y, color = "#fff", size = 20, big = false) {
    floats.push({ text, x, y, color, size, big, t: 0, life: big ? 1 : 0.85 });
  }
  function zoneAtWorld(wx) {
    const i = Math.floor(wx / L.tileW);
    return (((Math.floor(i / ZONE_TILES) % ZONES.length) + ZONES.length) % ZONES.length);
  }
  function towerTopY() {
    return L.feet - L.waiterH * 0.98 - plates.length * L.gap;
  }
  function spawnEvent(diff) {
    const dir = rnd() > 0.5 ? 1 : -1;
    const pool = distance < 22 ? ["cat"] : distance < 45 ? ["cat", "puddle"] : ["cat", "puddle", "wind"];
    const type = pool[Math.floor(rnd() * pool.length)];
    const warn = Math.max(0.75, 1.2 - diff * 0.12);
    ev = { type, dir, warn, t: 0, active: false, dur: type === "wind" ? 0.9 + Math.min(0.5, diff * 0.14) : 0.4 + Math.min(0.25, diff * 0.08), power: 1.65 + diff * 0.95, hitDone: false };
    if (type === "wind") ev.power *= 0.72;
    Sound.warn();
    const w = $("warn");
    const icon = { cat: "고양이 손님", puddle: "물웅덩이", wind: "돌풍" }[type];
    $("warn-text").textContent = `${icon}! ${dir > 0 ? "앞으로" : "뒤로"} 밀려요`;
    w.classList.toggle("back", dir < 0);
    w.classList.add("on");
    // 반대쪽 단추를 빛냄
    $(dir > 0 ? "pad-back" : "pad-front").classList.add("need");
  }
  function endEvent(diff) {
    ev = null;
    $("warn").classList.remove("on");
    const gap = Math.max(2.8, 6.2 - diff * 1.1);
    nextEvent = gap + rnd() * Math.max(1.2, 3.2 - diff * 0.5);
  }
  function fireEvent() {
    ev.active = true;
    ev.t = 0;
    shakeT = 0.22;
    if (ev.type === "cat") {
      Sound.bump();
      addFloat("쿵!", L.x, L.feet - L.waiterH * 0.6, "#ffe0a8", 26, true);
    } else if (ev.type === "puddle") {
      Sound.splash();
      addFloat("미끌!", L.x, L.feet - L.waiterH * 0.5, "#bfe8ff", 26, true);
      for (let i = 0; i < 16; i += 1) {
        const a = -Math.PI * rnd();
        parts.push({ x: L.x, y: L.feet, vx: Math.cos(a) * (60 + rnd() * 160), vy: Math.sin(a) * (80 + rnd() * 180), g: 700, t: 0, life: 0.5, size: 2 + rnd() * 3, color: "#a8e0ff" });
      }
    } else Sound.wind();
  }
  function serveTable(tb) {
    const top = plates.pop();
    if (!top) return;
    const perfect = Math.abs(lean) < 0.26;
    const gain = perfect ? 40 : Math.abs(lean) < 0.55 ? 20 : 10;
    tips += gain;
    serves += 1;
    if (perfect) perfects += 1;
    const tx = (tb.m - distance) * L.px + L.x;
    flying.push({ dish: top.dish, x: L.x, y: towerTopY(), tb, t: 0, life: 0.55 });
    tb.served = true;
    tb.joy = 1.4;
    if (perfect) {
      Sound.perfect();
      addFloat("완벽 서빙!", tx, L.wallB - L.waiterH * 0.34, "#ffe45c", 26, true);
    } else {
      Sound.serve();
      addFloat("서빙 완료", tx, L.wallB - L.waiterH * 0.34, "#fff", 20, true);
    }
    addFloat(`+${gain}`, tx, L.wallB - L.waiterH * 0.14, "#ffd76a", 20);
    leanVel *= 0.9;
  }
  function fail() {
    if (state !== "play") return;
    state = "falling";
    fallDir = lean >= 0 ? 1 : -1;
    fallT = 0;
    shakeT = 0.4;
    Sound.fall();
    $("warn").classList.remove("on");
    document.body.classList.add("ending");
    // 접시가 한 장씩 날아감
    const pts = plateChain();
    plates.forEach((pl, i) => {
      const q = pts[i];
      bodies.push({ dish: pl.dish, x: q.x, y: q.y, vx: fallDir * (90 + rnd() * 150 + i * 16) + (rnd() - 0.5) * 70, vy: -90 - rnd() * 170 - i * 6, r: q.a, vr: fallDir * (2 + rnd() * 5), floor: L.feet + (rnd() - 0.3) * L.waiterH * 0.18, delay: (plates.length - 1 - i) * 0.03 });
    });
    plates = [];
  }
  function shatter(x, y) {
    Sound.crash(0.8);
    shakeT = Math.max(shakeT, 0.1);
    for (let i = 0; i < 9; i += 1) {
      const a = -Math.PI * rnd();
      const v = 50 + rnd() * 190;
      shards.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd() * 6, spin: (rnd() - 0.5) * 12, t: 0, life: 0.65 + rnd() * 0.3, w: 5 + rnd() * 9, color: i % 3 === 0 ? "#d9b45a" : "#f4f1ea" });
    }
  }
  function endGame() {
    state = "over";
    document.body.classList.remove("in-play");
    document.body.classList.remove("ending");
    score = Math.floor(distance) + tips;
    lastScore = score;
    const newBest = score > best;
    if (newBest) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (_) {
        /* 저장이 막혀 있어도 계속 */
      }
    }
    updateHud();
    Sound.lose();
    $("over-title").textContent = newBest ? "오늘의 서빙왕!" : "접시가 쏟아졌어요";
    $("over-score").textContent = score.toLocaleString("ko-KR");
    $("over-detail").textContent = `${distance.toFixed(1)}m 달림`;
    $("over-serves").textContent = `${serves}번`;
    $("over-perfect").textContent = `${perfects}번`;
    $("over-stable").textContent = `${Math.floor(maxCombo)}초`;
    $("over-best").textContent = best.toLocaleString("ko-KR");
    showOverlay("over");
    if (window.TodayGameRank) {
      window.TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "서빙왕", formParent: $("over-rank") });
      window.TodayGameRank.open(Math.max(1, score), { label: `${score.toLocaleString("ko-KR")}점 · ${Math.floor(distance)}m` });
    }
    if (window.TodayVisit) {
      try {
        window.TodayVisit.compareAndShow(GAME_ID, lastScore, true, $("over"));
      } catch (_) {
        /* 비교 표시는 없어도 됨 */
      }
    }
  }
  function steerNow() {
    if (botHold !== null) return botHold;
    return (held.right ? 1 : 0) + (held.left ? -1 : 0);
  }
  /** 물리 한 걸음 */
  function tick(dt) {
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) $("toast").classList.remove("on");
    }
    visualLean = lerp(visualLean, lean, 1 - Math.pow(0.0008, dt));
    if (shakeT > 0) shakeT -= dt;
    updateFx(dt);
    if (state === "title" || state === "over") {
      titleT += dt;
      if (state === "title") {
        lean = Math.sin(titleT * 0.7) * 0.14;
        stepPhase += dt * 4.5;
        scroll += dt * 50;
        ensureTables(scroll / L.px + 30);
        if (!plates.length) for (let i = 0; i < 7; i += 1) plates.push(newPlate());
        animatePlates(dt, 1.2);
      }
      return;
    }
    if (state === "falling") {
      fallT += dt;
      lean += fallDir * dt * 2.2;
      if (fallT > 1.35) endGame();
      return;
    }
    if (state !== "play") return;

    const diff = difficulty();
    const speed = 1.35 + Math.min(diff, 2.2) * 1.85;
    distance += speed * dt;
    scroll = distance * L.px;
    stepPhase += dt * (5 + Math.min(diff, 2) * 3.6);
    if (Math.floor(stepPhase / Math.PI) !== stepSnd) {
      stepSnd = Math.floor(stepPhase / Math.PI);
      Sound.step();
      for (const pl of plates) pl.v += (rnd() - 0.5) * 0.3;
    }
    ensureTables(distance + 40);

    // 주방에서 접시를 올려 줌
    if (distance >= nextAdd) {
      nextAdd += 15 + rnd() * 5;
      if (plates.length < 12) {
        const pl = newPlate();
        pl.drop = 1;
        plates.push(pl);
        Sound.add();
        leanVel += (rnd() - 0.5) * 0.25;
      }
    }
    // 서빙
    for (const tb of tables) {
      if (tb.serve && !tb.served && distance >= tb.m && plates.length > 2) serveTable(tb);
    }
    // 앞에서 오는 일
    nextEvent -= dt;
    if (!ev && nextEvent <= 0) spawnEvent(diff);
    if (ev) {
      ev.t += dt;
      if (!ev.active) {
        if (ev.t >= ev.warn) fireEvent();
      } else {
        leanVel += ev.dir * ev.power * dt;
        if (ev.t >= ev.dur) {
          $("pad-back").classList.remove("need");
          $("pad-front").classList.remove("need");
          endEvent(diff);
        }
      }
    }
    const steer = steerNow();
    const tip = lean * (0.55 + Math.min(diff, 2.2) * 1.55) * (1 + (plates.length - 5) * 0.015);
    const noise = (rnd() - 0.5) * (0.18 + Math.min(diff, 2.2) * 0.72);
    leanVel += (tip + noise) * dt;
    leanVel += steer * 7.2 * dt;
    leanVel = clamp(leanVel, -2.35, 2.35);
    leanVel *= Math.pow(0.07, dt);
    lean += leanVel * dt;

    if (Math.abs(lean) < 0.2) {
      combo += dt;
      stableT += dt;
      if (combo > maxCombo) maxCombo = combo;
      if (stableT >= 8) {
        stableT = 0;
        tips += 15;
        addFloat("안정 보너스 +15", L.x, towerTopY() - 12, "#c8ffb0", 18);
      }
    } else {
      combo = Math.max(0, combo - dt * 1.6);
      if (Math.abs(lean) > 0.3) stableT = 0;
    }
    // 많이 기울면 반대쪽 단추가 빛남
    if (!ev) {
      $("pad-back").classList.toggle("need", lean > 0.34);
      $("pad-front").classList.toggle("need", lean < -0.34);
    }
    animatePlates(dt, Math.abs(lean));
    if (Math.abs(lean) > 0.46) {
      clinkT -= dt;
      if (clinkT <= 0) {
        clinkT = 0.17 - Math.min(0.1, (Math.abs(lean) - 0.46) * 0.25);
        Sound.clink();
      }
      if (rnd() < dt * 12) parts.push({ x: L.x + (rnd() - 0.5) * 24, y: L.feet - L.waiterH * 0.86, vx: (rnd() - 0.5) * 80, vy: -70 - rnd() * 40, g: 460, t: 0, life: 0.45, size: 2.4 + rnd() * 1.8, color: "#a8e0ff" });
    }
    const z = zoneAtWorld(scroll * 0.6 + L.x);
    if (z !== lastZone) {
      lastZone = z;
      toast(ZONES[z].name);
    }
    if (Math.abs(lean) >= MAX_LEAN) {
      fail();
      return;
    }
    score = Math.floor(distance) + tips;
    botT += dt;
    if (botT > 0.05) {
      botT = 0;
      updateHud();
    }
  }
  function animatePlates(dt, k) {
    plates.forEach((pl, i) => {
      const stiff = 90 - i * 3.5;
      pl.v += (-pl.w * stiff - pl.v * 7 + leanVel * (1 + i * 0.16) * 4) * dt;
      pl.w += pl.v * dt;
      if (pl.drop > 0) pl.drop = Math.max(0, pl.drop - dt * 3.4);
    });
    void k;
  }
  function updateFx(dt) {
    for (const f of flying) f.t += dt;
    flying = flying.filter((f) => f.t < f.life);
    for (const tb of tables) if (tb.joy > 0) tb.joy -= dt;
    for (const b of bodies) {
      if (b.delay > 0) {
        b.delay -= dt;
        continue;
      }
      b.vy += 900 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.r += b.vr * dt;
      if (b.y >= b.floor && !b.gone) {
        b.gone = true;
        shatter(b.x, b.floor);
      }
    }
    bodies = bodies.filter((b) => !b.gone);
    for (const s of shards) {
      s.t += dt;
      s.vy += 720 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;
    }
    shards = shards.filter((s) => s.t < s.life);
    for (const p of parts) {
      p.t += dt;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    parts = parts.filter((p) => p.t < p.life);
    for (const f of floats) {
      f.t += dt;
      f.y -= (f.big ? 22 : 40) * dt;
    }
    floats = floats.filter((f) => f.t < f.life);
    // 돌풍 줄무늬
    if (ev && ev.type === "wind") {
      const strong = ev.active ? 1 : 0.35;
      if (rnd() < dt * 60 * strong) streaks.push({ x: ev.dir > 0 ? -60 : VW + 60, y: rnd() * L.feet, len: 60 + rnd() * 110, v: ev.dir * (700 + rnd() * 500), t: 0 });
    }
    for (const s of streaks) {
      s.t += dt;
      s.x += s.v * dt;
    }
    streaks = streaks.filter((s) => s.t < 1.2);
  }
  function ensureTables(until) {
    while (nextTableM < until) {
      const isServe = state === "play" && nextTableM >= nextServeM;
      if (isServe) nextServeM = nextTableM + 26 + rnd() * 18;
      tables.push({ m: nextTableM, serve: isServe, served: false, kind: Math.floor(rnd() * 3), joy: 0, dish: DISHES[Math.floor(rnd() * DISHES.length)] });
      nextTableM += 7 + rnd() * 7;
    }
    if (tables.length > 24) tables.splice(0, tables.length - 24);
  }
  function updateHud() {
    $("hud-score").textContent = (Math.floor(distance) + tips).toLocaleString("ko-KR");
    $("hud-dist").textContent = `${Math.floor(distance)}m`;
    $("hud-best").textContent = best.toLocaleString("ko-KR");
    $("hud-plates").textContent = plates.length;
    const a = Math.abs(visualLean);
    $("meter-needle").style.left = `${clamp((visualLean / MAX_LEAN) * 0.5 + 0.5, 0.02, 0.98) * 100}%`;
    const bar = $("meter");
    bar.classList.toggle("warn", a > 0.45);
    bar.classList.toggle("danger", a > 0.72);
    $("mood").textContent = a < 0.2 ? `안정 ${Math.floor(combo)}초` : a < 0.45 ? "살짝 기울어요" : lean > 0 ? "앞으로 기울어요! 뒤로" : "뒤로 기울어요! 앞으로";
  }
  function showOverlay(name) {
    $("title").classList.toggle("hidden", name !== "title");
    $("over").classList.toggle("hidden", name !== "over");
  }

  /* ---------- 그리기 ---------- */
  function plateChain() {
    // 머리 위부터 한 장씩 쌓음: 위로 갈수록 더 기움
    const ang = visualLean * 0.72 + (state === "falling" ? fallDir * fallT * 1.1 : 0);
    const out = [];
    const step = Math.sin(stepPhase);
    const bob = state === "title" || state === "play" ? Math.abs(step) * L.waiterH * 0.016 : 0;
    // 몸 기울기에 맞춘 머리 위치
    const bodyA = ang * 0.35;
    const headH = L.waiterH * 0.965;
    let x = L.x + Math.sin(bodyA) * headH;
    let y = L.feet + bob - Math.cos(bodyA) * headH;
    let a = ang * 0.9;
    plates.forEach((pl, i) => {
      a += ang * 0.055 + pl.w * 0.09;
      x += Math.sin(a) * L.gap;
      y -= Math.cos(a) * L.gap;
      out.push({ x, y: y - pl.drop * L.waiterH * 1.2, a, pl, i });
    });
    return out;
  }
  function drawDish(dish, x, y, a, s = 1) {
    const im = dishSprites[dish];
    if (!im) return;
    const w = L.plateW * s;
    const h = (w * 96) / 200;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.drawImage(im, -w / 2, -h * 0.65, w, h);
    ctx.restore();
  }
  function drawWaiter() {
    const img = sprites.waiter;
    const ang = visualLean * 0.72 + (state === "falling" ? fallDir * Math.min(1.5, fallT * 2.2) : 0);
    const step = Math.sin(stepPhase);
    const moving = state === "play" || state === "title";
    const bob = moving ? Math.abs(step) * L.waiterH * 0.016 : 0;
    const w = L.waiterW;
    const h = L.waiterH;
    // 그림자
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(L.x + visualLean * 12, L.feet + 2, w * 0.42, h * 0.045, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(L.x, L.feet + bob);
    ctx.rotate(ang * 0.35);
    if (state === "falling") ctx.translate(fallDir * fallT * 30, Math.min(h * 0.2, fallT * fallT * h * 0.3));
    const sq = moving ? 1 + Math.abs(step) * 0.018 : 1;
    ctx.scale(1 / sq, sq);
    if (img) {
      // 윗몸과 다리를 나눠 달리는 느낌을 줌
      const split = 0.6;
      const iw = img.width;
      const ih = img.height;
      const sy = ih * split;
      const skew = moving ? Math.sin(stepPhase * 1) * 0.2 : 0;
      ctx.save();
      ctx.translate(0, -h * (1 - split));
      ctx.transform(1, 0, -skew, 1, 0, 0);
      ctx.drawImage(img, 0, sy, iw, ih - sy, -w / 2, 0, w, h * (1 - split));
      ctx.restore();
      ctx.drawImage(img, 0, 0, iw, sy + 1, -w / 2, -h, w, h * split + 1);
      if (window.TodayFace) window.TodayFace.drawOnSprite(ctx, -w / 2, -h, w, h, [0.44, 0.26, 0.2]);
      // 땀방울
      if (Math.abs(visualLean) > 0.42) {
        ctx.fillStyle = "#a8e0ff";
        const sway = Math.sin(titleT * 20 + stepPhase) * 2;
        ctx.beginPath();
        ctx.ellipse(w * 0.3 + sway, -h * 0.86, 3.5, 5, 0.3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawTable(tb) {
    const x = (tb.m - distance) * L.px + L.x + (state === "title" ? (distance - scroll / L.px) * L.px : 0);
    if (x < -L.waiterH * 1.4 || x > VW + L.waiterH * 1.4) return;
    const k = L.waiterH * 0.5;
    const y = L.wallB - k * 0.02;
    // 고양이 손님
    const g = sprites.guest;
    if (g) {
      const gh = k * (tb.serve ? 1.3 : 1.02);
      const gw = (gh * g.width) / g.height;
      const hop = tb.joy > 0 ? Math.abs(Math.sin(tb.joy * 9)) * k * 0.14 : Math.sin(titleT * 2 + tb.m) * 1.2;
      ctx.drawImage(g, x - gw / 2, y + k * 0.08 - gh - hop, gw, gh);
      if (state === "falling" || state === "over") {
        ctx.font = `400 ${k * 0.3}px "Bagel Fat One","Jua",sans-serif`;
        ctx.fillStyle = "#ff6b5e";
        ctx.textAlign = "center";
        ctx.fillText("!", x + gw * 0.42, y - gh * 0.7);
      }
    }
    // 식탁
    const tw = k * 1.2;
    const th = k * 0.46;
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(x, y + th + 3, tw * 0.56, 7, 0, 0, TAU);
    ctx.fill();
    const cloth = ctx.createLinearGradient(0, y, 0, y + th);
    cloth.addColorStop(0, "#ffffff");
    cloth.addColorStop(1, "#d9d5cd");
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(x - tw * 0.56, y + th);
    ctx.lineTo(x - tw * 0.5, y);
    ctx.quadraticCurveTo(x, y - k * 0.05, x + tw * 0.5, y);
    ctx.lineTo(x + tw * 0.56, y + th);
    for (let i = 5; i >= 0; i -= 1) ctx.quadraticCurveTo(x + tw * 0.56 - (tw * 1.12 * (5 - i + 0.5)) / 6, y + th + 5, x + tw * 0.56 - (tw * 1.12 * (5 - i + 1)) / 6, y + th);
    ctx.closePath();
    ctx.fill();
    // 초 · 받은 접시
    ctx.fillStyle = "#e9c25c";
    ctx.fillRect(x - tw * 0.32, y - k * 0.14, 3, k * 0.13);
    ctx.fillStyle = "#ffcf5c";
    ctx.beginPath();
    ctx.ellipse(x - tw * 0.32 + 1.5, y - k * 0.18, 2.6, 5, 0, 0, TAU);
    ctx.fill();
    if (tb.served) {
      const im = dishSprites[tb.dish];
      if (im) ctx.drawImage(im, x - tw * 0.26, y - k * 0.15, tw * 0.52, (tw * 0.52 * 96) / 200);
    }
    // 서빙할 손님 표시
    if (tb.serve && !tb.served) {
      const by = y - k * 1.5 + Math.sin(titleT * 5) * 4;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(x - k * 0.5, by - k * 0.2, k, k * 0.36, k * 0.16);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 6, by + k * 0.15);
      ctx.lineTo(x + 6, by + k * 0.15);
      ctx.lineTo(x, by + k * 0.27);
      ctx.fill();
      ctx.font = `400 ${k * 0.21}px "Jua",sans-serif`;
      ctx.fillStyle = "#c2571f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("주문이요!", x, by - k * 0.015);
      ctx.textBaseline = "alphabetic";
    }
    if (tb.joy > 0) {
      ctx.fillStyle = "#ff7a9c";
      for (let i = 0; i < 3; i += 1) {
        const hx = x + (i - 1) * k * 0.28;
        const hy = y - k * 0.95 - ((1.4 - tb.joy) * k * 0.5 + i * 6);
        heart(hx, hy, k * 0.075);
      }
    }
  }
  function heart(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.2, x, y - r * 0.35);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    ctx.fill();
  }
  function drawEvent() {
    if (!ev) return;
    const u = clamp(ev.t / ev.warn, 0, 1);
    if (ev.type === "puddle" && !ev.active) {
      const speed = (1.35 + Math.min(difficulty(), 2.2) * 1.85) * L.px;
      const x = L.x + (1 - u) * ev.warn * speed;
      const y = L.feet + 2;
      ctx.fillStyle = "rgba(120,200,255,.72)";
      ctx.beginPath();
      ctx.ellipse(x, y, L.waiterH * 0.34, L.waiterH * 0.06, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x - 6, y - 1, L.waiterH * 0.18, L.waiterH * 0.024, 0, 0, TAU);
      ctx.stroke();
      arrowAt(x, y - L.waiterH * 0.2, ev.dir);
    } else if (ev.type === "cat") {
      const g = sprites.guest;
      if (!g) return;
      const gh = L.waiterH * 0.62;
      const gw = (gh * g.width) / g.height;
      let x;
      if (!ev.active) x = L.x - ev.dir * ((1 - u) * VW * 0.62 + L.waiterW * 0.46);
      else x = L.x - ev.dir * (L.waiterW * 0.46 + (ev.t / ev.dur) * VW * 0.4);
      const hop = Math.abs(Math.sin(titleT * 16)) * gh * 0.06;
      ctx.fillStyle = "rgba(0,0,0,.26)";
      ctx.beginPath();
      ctx.ellipse(x, L.feet + 2, gw * 0.42, gh * 0.06, 0, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.translate(x, L.feet - hop);
      if (ev.dir > 0) ctx.scale(1, 1);
      else ctx.scale(-1, 1);
      ctx.rotate(0.1 * (ev.active ? -1 : 1));
      ctx.drawImage(g, -gw / 2, -gh, gw, gh);
      ctx.restore();
      if (!ev.active) arrowAt(x, L.feet - gh - 18, ev.dir);
    }
  }
  function arrowAt(x, y, dir) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = "#ff5a4a";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(0, -12);
    ctx.lineTo(0, -5);
    ctx.lineTo(-14, -5);
    ctx.lineTo(-14, 5);
    ctx.lineTo(0, 5);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    if (shakeT > 0) ctx.translate((rnd() - 0.5) * shakeT * 24, (rnd() - 0.5) * shakeT * 24);
    // 벽 (느리게)
    const wx = scroll * 0.6;
    const tw = L.tileW;
    const first = Math.floor((wx - L.x) / tw) - 1;
    const wallH = L.wallB + 2;
    for (let i = first; i < first + Math.ceil(VW / tw) + 3; i += 1) {
      const z = zoneAtWorld((i + 0.5) * tw);
      const v = ((i * 7 + 3) % 3 + 3) % 3;
      ctx.drawImage(tiles[z][v], i * tw - wx + L.x, 0, tw, wallH);
    }
    // 조명 (조금 더 빠르게)
    const lx = scroll * 0.75;
    const lg = Math.max(300, tw * 0.9);
    const lf = Math.floor((lx - L.x) / lg) - 1;
    for (let i = lf; i < lf + Math.ceil(VW / lg) + 3; i += 1) {
      const sx = (i + 0.5) * lg - lx + L.x;
      const z = zoneAtWorld((sx - L.x + wx));
      if (ZONES[z].light === "lantern") {
        ctx.drawImage(lanternSprite, sx - lg / 2, 0, lg, lg * 0.5);
      } else {
        const s = L.wallB * 0.56;
        const sway = Math.sin(titleT * 1.2 + i) * 0.02 + (shakeT > 0 ? Math.sin(titleT * 30) * 0.03 : 0);
        ctx.save();
        ctx.translate(sx, 0);
        ctx.rotate(sway);
        ctx.drawImage(chandSprite, -s / 2, 0, s, s);
        ctx.restore();
      }
    }
    // 바닥
    const fw = 320;
    const floorH = VH - L.wallB + 4;
    const ff = Math.floor((scroll - L.x) / fw) - 1;
    for (let i = ff; i < ff + Math.ceil(VW / fw) + 3; i += 1) {
      const fx = i * fw - scroll + L.x;
      const z = zoneAtWorld((fx + fw / 2 - L.x) * 0.6 + wx);
      ctx.drawImage(floors[z], fx, L.wallB - 2, fw, floorH);
    }
    // 벽과 바닥 사이 그늘
    const sh = ctx.createLinearGradient(0, L.wallB - 2, 0, L.wallB + 22);
    sh.addColorStop(0, "rgba(0,0,0,.34)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, L.wallB - 2, VW, 24);
    // 식탁
    const shown = state === "title" ? tables.filter((t) => t.m * L.px - scroll + L.x > -300) : tables;
    for (const tb of shown) {
      if (state === "title") {
        const sx = tb.m * L.px - scroll + L.x;
        if (sx < -200 || sx > VW + 200) continue;
        const save = distance;
        distance = (L.x - sx) / L.px + tb.m;
        drawTable(tb);
        distance = save;
      } else drawTable(tb);
    }
    drawEvent();
    // 서빙 중인 접시
    for (const f of flying) {
      const u = clamp(f.t / f.life, 0, 1);
      const tx = (f.tb.m - distance) * L.px + L.x;
      const ty = L.wallB - L.waiterH * 0.02;
      drawDish(f.dish, lerp(f.x, tx, u), lerp(f.y, ty, u) - Math.sin(u * Math.PI) * L.waiterH * 0.4, u * 0.2, lerp(1, 0.62, u));
    }
    // 접시 탑은 사람 뒤 · 머리 위
    const pts = plateChain();
    drawWaiter();
    for (const q of pts) drawDish(q.pl.dish, q.x, q.y, q.a);
    for (const b of bodies) if (!(b.delay > 0)) drawDish(b.dish, b.x, b.y, b.r);
    for (const s of shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = clamp(1.4 - s.t / s.life, 0, 1);
      ctx.beginPath();
      ctx.moveTo(-s.w / 2, -s.w * 0.22);
      ctx.lineTo(s.w / 2, -s.w * 0.1);
      ctx.lineTo(s.w * 0.2, s.w * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const p of parts) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = clamp(1.3 - p.t / p.life, 0, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 돌풍
    if (streaks.length) {
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const s of streaks) {
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - Math.sign(s.v) * s.len, s.y);
      }
      ctx.stroke();
    }
    ctx.restore();
    for (const f of floats) {
      const u = f.t / f.life;
      const pop = f.big ? 1 + (1 - Math.min(1, u * 5)) * 0.4 : 1;
      ctx.globalAlpha = u > 0.65 ? (1 - u) / 0.35 : 1;
      ctx.font = `400 ${f.size * pop}px "Bagel Fat One","Jua",sans-serif`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(50,20,10,.88)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
  function update(dt) {
    acc += Math.min(dt, 0.1);
    let n = 0;
    while (acc >= FIXED && n < 16) {
      tick(FIXED);
      acc -= FIXED;
      n += 1;
    }
  }
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = clamp((t - lastT) / 1000, 0, 0.1);
    lastT = t;
    if (state !== "paused") update(dt);
    titleT += state === "paused" ? 0 : 0;
    render();
  }

  /* ---------- 입력 ---------- */
  function setHeld(dir, on) {
    if (dir < 0) held.left = on;
    else held.right = on;
    $(dir < 0 ? "pad-back" : "pad-front").classList.toggle("down", on);
    if (on) Sound.unlock();
  }
  function bind() {
    $("start-btn").addEventListener("click", () => {
      Sound.unlock();
      Sound.ui();
      start();
    });
    $("retry-btn").addEventListener("click", () => {
      Sound.ui();
      start();
    });
    document.querySelectorAll(".pad").forEach((btn) => {
      const dir = Number(btn.dataset.dir);
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        setHeld(dir, true);
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_) {
          /* 무시 */
        }
      });
      const up = (e) => {
        e.preventDefault();
        setHeld(dir, false);
      };
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("lostpointercapture", () => setHeld(dir, false));
    });
    addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") setHeld(-1, true);
      if (e.code === "ArrowRight" || e.code === "KeyD") setHeld(1, true);
      if (e.code === "Space" && (state === "title" || state === "over")) {
        e.preventDefault();
        start();
      }
    });
    addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") setHeld(-1, false);
      if (e.code === "ArrowRight" || e.code === "KeyD") setHeld(1, false);
    });
    addEventListener("blur", () => {
      setHeld(-1, false);
      setHeld(1, false);
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (state !== "play") return;
      const r = canvas.getBoundingClientRect();
      setHeld((e.clientX - r.left) / r.width < 0.5 ? -1 : 1, true);
    });
    const clearTouch = () => {
      setHeld(-1, false);
      setHeld(1, false);
    };
    canvas.addEventListener("pointerup", clearTouch);
    canvas.addEventListener("pointercancel", clearTouch);
    addEventListener("resize", layout);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);
  }
  function loadImg(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  bind();
  // 내 얼굴 칩: 공용 코드가 첫 화면 끝에 붙이므로 시작 단추 위로 옮김
  function placeFaceChip() {
    const first = document.querySelector(".title-first");
    const startBtn = $("start-btn");
    if (!first || !startBtn) return;
    const chip = [...document.querySelectorAll("#title > *")].find((el) => el !== first && !el.classList.contains("seo-about") && /얼굴/.test(el.textContent || ""));
    if (chip) first.insertBefore(chip, startBtn);
  }
  placeFaceChip();
  setTimeout(placeFaceChip, 400);
  Promise.all([loadImg("assets/serving-waiter.png"), loadImg("assets/serving-guest.png")]).then(([w, g]) => {
    sprites.waiter = w;
    sprites.guest = g;
    layout();
    for (let i = 0; i < 7; i += 1) plates.push(newPlate());
    updateHud();
    $("title-best").textContent = best > 0 ? `최고 ${Math.floor(best).toLocaleString("ko-KR")}점` : "";
    lastT = performance.now();
    requestAnimationFrame(loop);
    window.ServingKing.ready = true;
  });
  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        lastT = performance.now();
        return true;
      },
    });
  }
  if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "서빙왕", formParent: $("over-rank") });

  // 점검용
  window.ServingKing = {
    get s() {
      return { state, distance, score: Math.floor(distance) + tips, lean, leanVel, serves, perfects, plates: plates.length, combo, tips, best };
    },
    start,
    tick,
    update,
    hold(v) {
      botHold = v;
    },
    toTitle() {
      state = "title";
      botHold = null;
      resetRun();
      plates = [];
      showOverlay("title");
      document.body.classList.remove("in-play");
      document.body.classList.remove("ending");
    },
    setLean(v) {
      lean = v;
      leanVel = Math.sign(v) * 1;
    },
    seed(v) {
      let a = v >>> 0;
      rnd = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    layout() {
      const pts = plateChain();
      return { feet: L.feet, waiterH: L.waiterH, towerTop: L.feet - L.waiterH * 0.98 - 12 * L.gap, top: pts.length ? pts[pts.length - 1].y : 0 };
    },
  };
})();
