(() => {
  "use strict";

  /*
   * 두더지 팡팡
   *  - 화면 크기에 맞춰 선명하게 그리는 원근감 있는 정원 (구멍 앞 턱이 두더지를 가림)
   *  - 뽕! 튀어나오는 탄성 · 맞으면 납작 · 망치 휘두르기 · 멈칫 · 흙 튀김
   *  - 일반 · 황금 · 헬멧 · 폭탄 · 토끼 친구 · 얼음 · 왕두더지(보스), 콤보와 피버
   *  - 5개 월드 50단계, 별 3개, 진행 저장
   */
  const TOTAL = 50;
  const SAVE_KEY = "whack-mole-v2";
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);
  const easeBack = (t) => {
    const c = 2.2;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  const THEMES = [
    { name: "꽃밭 정원", top: "#6fc6f5", hor: "#d6f2ff", hill: ["#a6dc84", "#8ccc6b"], g1: "#9ad96f", g2: "#7cc757", stripe: "rgba(255,255,255,.1)", dirt: "#8a5a34", dirtD: "#5f3a1f", hole: "#2c1a10", deco: "garden", light: 1 },
    { name: "당근 농장", top: "#ffc978", hor: "#ffeec2", hill: ["#e2c677", "#c9b05e"], g1: "#c2c565", g2: "#a7ac4e", stripe: "rgba(255,240,180,.13)", dirt: "#9a6438", dirtD: "#6a4020", hole: "#2e1c10", deco: "farm", light: 1 },
    { name: "버섯 숲", top: "#3f9f8d", hor: "#b5e6c8", hill: ["#4f9c70", "#3b8560"], g1: "#58a968", g2: "#3f8f55", stripe: "rgba(255,255,255,.07)", dirt: "#6d4a2c", dirtD: "#452c17", hole: "#1d120b", deco: "forest", light: 0.92 },
    { name: "노을 언덕", top: "#ff8f6b", hor: "#ffd59e", hill: ["#c9757e", "#a85f73"], g1: "#b58f5f", g2: "#99754d", stripe: "rgba(255,210,150,.1)", dirt: "#764430", dirtD: "#4b2a1e", hole: "#23130e", deco: "sunset", light: 0.95 },
    { name: "달빛 왕국", top: "#141a4d", hor: "#4a4c9c", hill: ["#2f3576", "#262b63"], g1: "#3d5c7c", g2: "#2c4768", stripe: "rgba(200,220,255,.07)", dirt: "#4d4465", dirtD: "#2f2a45", hole: "#100d1c", deco: "night", light: 0.85 },
  ];

  /* 새로 나오는 친구 소개 */
  const NEW_AT = {
    2: { type: "gold", name: "황금 두더지", text: "점수가 크고 시간도 늘어나요!" },
    4: { type: "bomb", name: "폭탄", text: "때리면 펑! 하트가 줄어요. 그냥 두세요" },
    7: { type: "helmet", name: "헬멧 두더지", text: "한 번 치면 헬멧이 벗겨져요. 두 번 치세요!" },
    12: { type: "bunny", name: "토끼 친구", text: "친구예요! 때리면 하트가 줄어요" },
    17: { type: "ice", name: "얼음 두더지", text: "치면 잠깐 모두 얼어붙어요. 기회!" },
  };

  function stageInfo(i) {
    const w = Math.floor(i / 10);
    const k = i % 10;
    const t = i / (TOTAL - 1);
    const boss = k === 9;
    const layouts = [[3, 3], [3, 3], [2, 3, 2], [3, 3, 3], [3, 3, 3], [3, 2, 3], [3, 3, 3], [2, 3, 2, 3], [3, 3, 3, 3], [3, 3, 3]];
    const rows = i < 2 ? [2, 3] : layouts[Math.min(layouts.length - 1, Math.floor(i / 5))];
    const goal = boss ? 4 + w * 2 : Math.round(8 + i * 0.62 + k * 0.5);
    const stay = lerp(1.05, 0.5, Math.pow(t, 0.8));
    const gap = lerp(0.82, 0.3, Math.pow(t, 0.75));
    const time = boss ? 26 + w * 4 : Math.round(goal * lerp(1.9, 0.95, t) + 7);
    return {
      i,
      w,
      k,
      boss,
      rows,
      goal,
      stay,
      gap,
      time,
      maxActive: clamp(1 + Math.floor(i / 5), 1, 5),
      gold: i >= 2 ? clamp(0.05 + i * 0.001, 0, 0.09) : 0,
      bomb: i >= 4 ? clamp(0.1 + i * 0.0026, 0, 0.22) : 0,
      helmet: i >= 7 ? clamp(0.12 + i * 0.0034, 0, 0.28) : 0,
      bunny: i >= 12 ? clamp(0.07 + i * 0.0012, 0, 0.13) : 0,
      ice: i >= 17 ? 0.04 : 0,
      hearts: 3,
    };
  }

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
    noise(dur, freq, type, peak, delay = 0) {
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
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.03);
    },
    pop() {
      this.tone(420 + Math.random() * 160, 0.09, "sine", 0.1, 1.9);
    },
    bonk(combo) {
      const up = Math.pow(2, Math.min(combo, 14) / 14);
      this.noise(0.05, 1300, "bandpass", 0.42);
      this.tone(210 * up, 0.09, "square", 0.14, 0.55);
      this.tone(760 * up, 0.12, "triangle", 0.16, 1.3, 0.02);
    },
    clang() {
      this.tone(1500, 0.22, "square", 0.08, 0.92);
      this.tone(2280, 0.26, "sine", 0.1, 0.96);
      this.noise(0.05, 4200, "highpass", 0.2);
    },
    boom() {
      this.noise(0.5, 520, "lowpass", 0.7);
      this.tone(130, 0.36, "square", 0.2, 0.35);
    },
    gold() {
      [988, 1319, 1568, 1976].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.16, 1, i * 0.055));
    },
    freeze() {
      [2093, 1760, 2637, 2349].forEach((f, i) => this.tone(f, 0.26, "sine", 0.1, 1, i * 0.05));
      this.noise(0.3, 6000, "highpass", 0.1);
    },
    ouch() {
      this.tone(620, 0.16, "triangle", 0.18, 0.6);
      this.tone(420, 0.28, "triangle", 0.16, 0.7, 0.12);
    },
    swing() {
      this.noise(0.06, 2300, "bandpass", 0.08);
    },
    fever() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, "square", 0.08, 1, i * 0.06));
    },
    tick() {
      this.tone(1040, 0.05, "square", 0.05);
    },
    win() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.26, "triangle", 0.16, 1, i * 0.09));
    },
    star(i) {
      this.tone(880 + i * 280, 0.24, "triangle", 0.18);
    },
    lose() {
      [392, 370, 349, 262].forEach((f, i) => this.tone(f, i === 3 ? 0.6 : 0.24, "triangle", 0.15, i === 3 ? 0.72 : 1, i * 0.2));
    },
    ui() {
      this.tone(740, 0.05, "sine", 0.12);
    },
  };

  /* ---------- 저장 ---------- */
  const save = (() => {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      const best = {};
      if (d.best && typeof d.best === "object") {
        for (const k of Object.keys(d.best)) {
          const v = d.best[k];
          const id = Number(k);
          if (Number.isInteger(id) && id >= 0 && id < TOTAL && v && Number.isFinite(v.stars) && Number.isFinite(v.score)) best[id] = { stars: clamp(v.stars, 1, 3), score: Math.max(0, v.score) };
        }
      }
      return { best, seen: d.seen && typeof d.seen === "object" ? d.seen : {} };
    } catch (_) {
      return { best: {}, seen: {} };
    }
  })();
  const persist = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_) {
      /* 저장이 막혀 있어도 게임은 계속 */
    }
  };
  const totalScore = () => Object.values(save.best).reduce((a, b) => a + b.score, 0);
  const totalStars = () => Object.values(save.best).reduce((a, b) => a + b.stars, 0);
  const topCleared = () => {
    let t = -1;
    for (const k of Object.keys(save.best)) t = Math.max(t, Number(k));
    return t;
  };
  const isOpen = (i) => i <= topCleared() + 2;
  const nextStage = () => {
    for (let i = 0; i < TOTAL; i += 1) if (!save.best[i]) return i;
    return TOTAL - 1;
  };

  /* ---------- 상태 ---------- */
  const stageEl = $("stage");
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const bg = document.createElement("canvas");
  let VW = 390;
  let VH = 700;
  let DPR = 1;
  let screen = "title";
  let paused = false;
  let now = 0;
  let lastT = performance.now();
  let info = stageInfo(0);
  let themeI = 0;
  let holes = [];
  let baseW = 90;
  let timeLeft = 0;
  let hearts = 3;
  let goalLeft = 0;
  let caught = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let feverGauge = 0;
  let feverT = 0;
  let freezeT = 0;
  let spawnT = 0;
  let readyT = 0;
  let hitStop = 0;
  let shake = 0;
  let lastHole = -1;
  let parts = [];
  let floats = [];
  let rings = [];
  let flyers = [];
  let tickSec = -1;
  let endT = -1;
  let endWin = false;
  let kingHp = 0;
  let kingMax = 0;
  const mallet = { x: 0, y: 0, swing: 0, show: 0, mouse: false };

  /* ---------- 그림 ---------- */
  const spr = { mole: null, mallet: null, cache: {} };
  function loadImg(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")];
  }
  /** 두더지 그림에 색을 입히거나 표정을 바꿔 미리 구워 둠 */
  function bakeSprites() {
    const m = spr.mole;
    const W = 386;
    const H = Math.round((W * (m ? m.height : 721)) / (m ? m.width : 771));
    const base = (tint, op) => {
      const [c, g] = makeCanvas(W, H);
      if (m) g.drawImage(m, 0, 0, W, H);
      if (tint) {
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = tint;
        g.globalAlpha = op;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
      }
      return [c, g];
    };
    const eyes = [[0.3, 0.405], [0.692, 0.4]];
    const fur = (g) => {
      // 눈 위쪽 털 색을 그대로 가져옴
      try {
        const d = g.getImageData(Math.round(W * 0.5), Math.round(H * 0.2), 1, 1).data;
        return `rgb(${d[0]},${d[1]},${d[2]})`;
      } catch (_) {
        return "#4a4544";
      }
    };
    const closeEyes = (g, mode) => {
      const col = fur(g);
      for (const [ex, ey] of eyes) {
        const x = ex * W;
        const y = ey * H;
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(x, y, W * 0.102, H * 0.112, 0, 0, TAU);
        g.fill();
        g.strokeStyle = "#16121a";
        g.lineCap = "round";
        g.lineWidth = W * 0.024;
        if (mode === "x") {
          const r = W * 0.05;
          g.beginPath();
          g.moveTo(x - r, y - r);
          g.lineTo(x + r, y + r);
          g.moveTo(x + r, y - r);
          g.lineTo(x - r, y + r);
          g.stroke();
        } else {
          // 소용돌이
          g.lineWidth = W * 0.014;
          g.beginPath();
          for (let a = 0; a < TAU * 2.2; a += 0.2) {
            const r = 1.5 + a * 2.6;
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r;
            if (a === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.stroke();
        }
      }
    };
    const C = spr.cache;
    {
      const [c] = base();
      C.normal = c;
    }
    {
      const [c, g] = base();
      closeEyes(g, "spiral");
      // 머리 혹
      g.fillStyle = "#ff9fb0";
      g.beginPath();
      g.ellipse(W * 0.5, H * 0.05, W * 0.08, H * 0.06, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.7)";
      g.beginPath();
      g.ellipse(W * 0.48, H * 0.035, W * 0.022, H * 0.016, 0, 0, TAU);
      g.fill();
      C.hit = c;
    }
    {
      const [c] = base("#ffc21f", 0.62);
      C.gold = c;
      const [c2, g2] = base("#ffc21f", 0.62);
      closeEyes(g2, "x");
      C.goldHit = c2;
    }
    {
      const [c] = base("#6fd0ff", 0.55);
      C.ice = c;
      const [c2, g2] = base("#6fd0ff", 0.55);
      closeEyes(g2, "spiral");
      C.iceHit = c2;
    }
    {
      const [c] = base("#8dd5ff", 0.34);
      C.frozen = c;
    }
    // 폭탄
    {
      const [c, g] = makeCanvas(W, H);
      const cx = W / 2;
      const cy = H * 0.56;
      const r = W * 0.36;
      const grd = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.08, cx, cy, r);
      grd.addColorStop(0, "#6a7088");
      grd.addColorStop(0.5, "#2c2e3e");
      grd.addColorStop(1, "#14141f");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.fill();
      g.fillStyle = "#3b3d50";
      g.fillRect(cx - W * 0.075, cy - r - H * 0.05, W * 0.15, H * 0.08);
      g.strokeStyle = "#8a6a44";
      g.lineWidth = W * 0.024;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(cx, cy - r - H * 0.05);
      g.quadraticCurveTo(cx + W * 0.1, cy - r - H * 0.18, cx + W * 0.2, cy - r - H * 0.12);
      g.stroke();
      // 화난 눈
      for (const s of [-1, 1]) {
        g.fillStyle = "#fff";
        g.beginPath();
        g.ellipse(cx + s * r * 0.36, cy - r * 0.02, r * 0.21, r * 0.25, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#14121a";
        g.beginPath();
        g.arc(cx + s * r * 0.32, cy + r * 0.03, r * 0.115, 0, TAU);
        g.fill();
        g.strokeStyle = "#ff5a5a";
        g.lineWidth = W * 0.026;
        g.beginPath();
        g.moveTo(cx + s * r * 0.58, cy - r * 0.34);
        g.lineTo(cx + s * r * 0.14, cy - r * 0.17);
        g.stroke();
      }
      g.strokeStyle = "#fff";
      g.lineWidth = W * 0.02;
      g.beginPath();
      g.moveTo(cx - r * 0.22, cy + r * 0.48);
      g.quadraticCurveTo(cx, cy + r * 0.3, cx + r * 0.22, cy + r * 0.48);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,.34)";
      g.beginPath();
      g.ellipse(cx - r * 0.42, cy - r * 0.56, r * 0.2, r * 0.12, -0.6, 0, TAU);
      g.fill();
      C.bomb = c;
    }
    // 토끼 친구
    {
      const [c, g] = makeCanvas(W, H);
      const cx = W / 2;
      const cy = H * 0.6;
      const r = W * 0.33;
      const white = (x, y, rx, ry, rot = 0, col = "#fffdf8") => {
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(x, y, rx, ry, rot, 0, TAU);
        g.fill();
      };
      for (const s of [-1, 1]) {
        white(cx + s * r * 0.48, cy - r * 1.28, r * 0.27, r * 0.86, s * 0.14);
        white(cx + s * r * 0.48, cy - r * 1.24, r * 0.13, r * 0.62, s * 0.14, "#ffb6c8");
      }
      const grd = g.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.2, cx, cy, r * 1.1);
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(1, "#ece6e0");
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(cx, cy, r * 1.04, r * 0.98, 0, 0, TAU);
      g.fill();
      for (const s of [-1, 1]) {
        white(cx + s * r * 0.44, cy - r * 0.08, r * 0.17, r * 0.2, 0, "#17121c");
        white(cx + s * r * 0.39, cy - r * 0.16, r * 0.06, r * 0.07, 0, "#fff");
        white(cx + s * r * 0.68, cy + r * 0.24, r * 0.18, r * 0.11, 0, "rgba(255,130,150,.65)");
      }
      white(cx, cy + r * 0.13, r * 0.08, r * 0.055, 0, "#ff8fa8");
      g.strokeStyle = "#7a5a5a";
      g.lineWidth = W * 0.011;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(cx - r * 0.13, cy + r * 0.28);
      g.quadraticCurveTo(cx, cy + r * 0.38, cx, cy + r * 0.2);
      g.quadraticCurveTo(cx, cy + r * 0.38, cx + r * 0.13, cy + r * 0.28);
      g.stroke();
      // 품에 안은 당근
      g.save();
      g.translate(cx + r * 0.05, cy + r * 0.76);
      g.rotate(0.5);
      g.fillStyle = "#ff9326";
      g.beginPath();
      g.moveTo(-r * 0.15, -r * 0.1);
      g.quadraticCurveTo(0, -r * 0.2, r * 0.15, -r * 0.1);
      g.lineTo(0, r * 0.32);
      g.closePath();
      g.fill();
      g.fillStyle = "#5fc15a";
      g.beginPath();
      g.ellipse(0, -r * 0.2, r * 0.09, r * 0.14, 0, 0, TAU);
      g.fill();
      g.restore();
      C.bunny = c;
    }
    spr.size = [W, H];
  }

  /* ---------- 배치 ---------- */
  function resize() {
    const r = stageEl.getBoundingClientRect();
    VW = Math.max(1, r.width);
    VH = Math.max(1, r.height);
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
    layoutBoard();
    bakeBg();
  }
  function layoutBoard() {
    const rows = info.rows;
    const n = rows.length;
    const hud = $("hud").getBoundingClientRect();
    const base = stageEl.getBoundingClientRect();
    const top = (hud.height ? hud.bottom - base.top : 92) + 6;
    const bottom = VH - Math.max(14, VH * 0.022);
    const avail = bottom - top;
    const maxCols = Math.max(...rows);
    const sBack = n <= 2 ? 0.86 : 0.74;
    const sFront = 1.08;
    // 가로 · 세로 모두 들어가는 구멍 크기
    let w = (VW * 0.96) / (maxCols * 1.14 * sFront);
    const need = (bw) => {
      let h = bw * 0.82 * sBack;
      for (let i = 1; i < n; i += 1) h += bw * 0.74 * lerp(sBack, sFront, i / (n - 1));
      return h + bw * 0.28 * sFront;
    };
    while (need(w) > avail && w > 40) w -= 2;
    baseW = w;
    const fixed = w * 0.82 * sBack + w * 0.28 * sFront;
    const gaps = need(w) - fixed;
    const gapK = n > 1 ? clamp((avail - fixed) / gaps, 1, 1.9) : 1;
    const used = fixed + gaps * gapK;
    let y = top + (avail - used) * 0.55 + w * 0.82 * sBack;
    const list = [];
    rows.forEach((cols, ri) => {
      const t = n > 1 ? ri / (n - 1) : 1;
      const s = lerp(sBack, sFront, t);
      if (ri > 0) y += w * 0.74 * s * gapK;
      const hw = w * s;
      const spread = Math.min((VW - hw * 0.9) / Math.max(1, cols - 1 || 1), hw * 1.32);
      for (let c = 0; c < cols; c += 1) {
        list.push({ i: list.length, row: ri, x: VW / 2 + (c - (cols - 1) / 2) * spread, y, w: hw, h: hw * 0.36, s, mole: null, dust: 0 });
      }
    });
    const old = holes;
    holes = list;
    // 화면을 돌렸을 때 올라와 있던 두더지는 유지
    old.forEach((h, i) => {
      if (holes[i] && h.mole) holes[i].mole = h.mole;
    });
    keyMap();
  }
  let keys = {};
  function keyMap() {
    keys = {};
    const codes = [["KeyQ", "KeyW", "KeyE", "KeyR"], ["KeyA", "KeyS", "KeyD", "KeyF"], ["KeyZ", "KeyX", "KeyC", "KeyV"], ["Digit1", "Digit2", "Digit3", "Digit4"]];
    let i = 0;
    info.rows.forEach((cols, r) => {
      for (let c = 0; c < cols; c += 1) {
        const code = codes[r % 4][c];
        if (code) keys[code] = i;
        i += 1;
      }
    });
  }

  /* ---------- 배경 굽기 ---------- */
  function bakeBg() {
    bg.width = canvas.width;
    bg.height = canvas.height;
    const g = bg.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const T = THEMES[themeI];
    const first = holes.length ? holes[0].y - baseW * 0.86 : VH * 0.25;
    const horizon = clamp(first, VH * 0.13, VH * 0.42);
    let seed = 9 + themeI * 13;
    const R = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    // 하늘
    const sky = g.createLinearGradient(0, 0, 0, horizon + 20);
    sky.addColorStop(0, T.top);
    sky.addColorStop(1, T.hor);
    g.fillStyle = sky;
    g.fillRect(0, 0, VW, horizon + 30);
    // 해 · 달
    const night = T.deco === "night";
    const sunX = VW * (T.deco === "sunset" ? 0.5 : 0.78);
    const sunY = horizon * (T.deco === "sunset" ? 0.8 : 0.42);
    const sr = Math.min(VW, VH) * (night ? 0.06 : 0.075);
    const halo = g.createRadialGradient(sunX, sunY, sr * 0.5, sunX, sunY, sr * 4.2);
    halo.addColorStop(0, night ? "rgba(220,230,255,.5)" : "rgba(255,248,200,.8)");
    halo.addColorStop(1, "rgba(255,248,200,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, VW, horizon + 30);
    g.fillStyle = night ? "#f4f4ff" : T.deco === "sunset" ? "#fff0a8" : "#fffbd8";
    g.beginPath();
    g.arc(sunX, sunY, sr, 0, TAU);
    g.fill();
    if (night) {
      g.fillStyle = T.top;
      g.beginPath();
      g.arc(sunX + sr * 0.42, sunY - sr * 0.18, sr * 0.86, 0, TAU);
      g.fill();
      for (let i = 0; i < 70; i += 1) {
        g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`;
        g.beginPath();
        g.arc(R() * VW, R() * horizon * 0.95, 0.5 + R() * 1.3, 0, TAU);
        g.fill();
      }
    } else {
      // 구름
      for (let i = 0; i < 5; i += 1) {
        const cx = R() * VW;
        const cy = R() * horizon * 0.6 + horizon * 0.06;
        const k = 0.5 + R() * 0.8;
        g.fillStyle = T.deco === "sunset" ? "rgba(255,225,205,.82)" : "rgba(255,255,255,.88)";
        for (const [dx, dy, r] of [[-34, 4, 20], [-12, -6, 26], [14, -3, 23], [36, 5, 17]]) {
          g.beginPath();
          g.arc(cx + dx * k, cy + dy * k, r * k, 0, TAU);
          g.fill();
        }
        g.fillRect(cx - 44 * k, cy + 2 * k, 90 * k, 18 * k);
      }
    }
    // 먼 언덕
    T.hill.forEach((col, l) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, horizon + 30);
      const off = l * 90 + themeI * 40;
      for (let x = 0; x <= VW + 12; x += 12) {
        const y = horizon - (l ? 8 : 20) - Math.sin((x + off) * 0.011) * (l ? 12 : 22) - Math.sin((x + off) * 0.027) * 7;
        g.lineTo(x, y);
      }
      g.lineTo(VW, horizon + 30);
      g.closePath();
      g.fill();
    });
    drawDeco(g, T, horizon, R);
    // 땅: 멀수록 옅게
    const gr = g.createLinearGradient(0, horizon, 0, VH);
    gr.addColorStop(0, T.g1);
    gr.addColorStop(1, T.g2);
    g.fillStyle = gr;
    g.fillRect(0, horizon, VW, VH - horizon);
    // 원근 줄무늬
    const vp = VW / 2;
    const bands = 7;
    g.fillStyle = T.stripe;
    for (let i = -bands; i < bands; i += 2) {
      g.beginPath();
      g.moveTo(vp + (i * VW * 0.03), horizon);
      g.lineTo(vp + ((i + 1) * VW * 0.03), horizon);
      g.lineTo(vp + ((i + 1) * VW * 0.34), VH);
      g.lineTo(vp + (i * VW * 0.34), VH);
      g.closePath();
      g.fill();
    }
    // 잔디 · 꽃
    const count = Math.round((VW * (VH - horizon)) / 2600);
    for (let i = 0; i < count; i += 1) {
      const y = horizon + 6 + R() * R() * (VH - horizon);
      const x = R() * VW;
      const k = lerp(0.4, 1.25, (y - horizon) / (VH - horizon));
      const kind = R();
      if (kind < 0.72) {
        g.strokeStyle = "rgba(40,90,30,.2)";
        g.lineWidth = 1.2 * k;
        g.lineCap = "round";
        g.beginPath();
        for (const dx of [-3, 0, 3]) {
          g.moveTo(x + dx * k, y);
          g.lineTo(x + dx * k * 1.5, y - 6 * k);
        }
        g.stroke();
      } else {
        const cols = T.deco === "night" ? ["#c9d8ff", "#9fe8ff"] : T.deco === "forest" ? ["#ffe9a8", "#ffd0e8"] : ["#fff", "#ffd84a", "#ff9fc0", "#c8a4ff"];
        const col = cols[Math.floor(R() * cols.length)];
        for (let p = 0; p < 5; p += 1) {
          const a = (p / 5) * TAU;
          g.fillStyle = col;
          g.beginPath();
          g.arc(x + Math.cos(a) * 3.2 * k, y + Math.sin(a) * 2.4 * k, 2.2 * k, 0, TAU);
          g.fill();
        }
        g.fillStyle = "#ffb52e";
        g.beginPath();
        g.arc(x, y, 1.8 * k, 0, TAU);
        g.fill();
      }
    }
    // 구멍 뒤쪽 그림: 흙 둔덕 + 어두운 구멍
    for (const h of holes) drawHoleBack(g, h, T);
    // 가장자리 어둡게
    const v = g.createRadialGradient(VW / 2, VH * 0.52, Math.min(VW, VH) * 0.42, VW / 2, VH * 0.52, Math.max(VW, VH) * 0.78);
    v.addColorStop(0, "rgba(30,20,50,0)");
    v.addColorStop(1, "rgba(30,20,50,.22)");
    g.fillStyle = v;
    g.fillRect(0, 0, VW, VH);
  }
  function drawDeco(g, T, hz, R) {
    const tree = (x, y, k, leaf, leaf2) => {
      g.fillStyle = "#7a5230";
      g.fillRect(x - 5 * k, y - 26 * k, 10 * k, 28 * k);
      g.fillStyle = leaf;
      for (const [dx, dy, r] of [[-14, -32, 17], [14, -32, 17], [0, -48, 21]]) {
        g.beginPath();
        g.arc(x + dx * k, y + dy * k, r * k, 0, TAU);
        g.fill();
      }
      g.fillStyle = leaf2;
      g.beginPath();
      g.arc(x - 6 * k, y - 52 * k, 9 * k, 0, TAU);
      g.fill();
    };
    if (T.deco === "garden") {
      for (const [p, k] of [[0.07, 0.9], [0.92, 1.05], [0.3, 0.6]]) tree(VW * p, hz + 4, k, "#6cc55b", "#92dd7c");
      // 흰 울타리
      g.fillStyle = "#fff";
      for (let x = -6; x < VW + 10; x += 19) {
        g.beginPath();
        g.moveTo(x, hz + 6);
        g.lineTo(x, hz - 20);
        g.lineTo(x + 5, hz - 27);
        g.lineTo(x + 10, hz - 20);
        g.lineTo(x + 10, hz + 6);
        g.closePath();
        g.fill();
      }
      g.fillRect(0, hz - 15, VW, 5);
      g.fillRect(0, hz - 5, VW, 5);
    } else if (T.deco === "farm") {
      // 헛간
      const x = VW * 0.14;
      const k = Math.min(VW, 520) / 390;
      g.fillStyle = "#c9483c";
      g.fillRect(x - 30 * k, hz - 44 * k, 60 * k, 48 * k);
      g.fillStyle = "#8e2f28";
      g.beginPath();
      g.moveTo(x - 38 * k, hz - 42 * k);
      g.lineTo(x, hz - 74 * k);
      g.lineTo(x + 38 * k, hz - 42 * k);
      g.closePath();
      g.fill();
      g.fillStyle = "#fff";
      g.fillRect(x - 12 * k, hz - 26 * k, 24 * k, 30 * k);
      g.fillStyle = "#c9483c";
      g.fillRect(x - 9 * k, hz - 23 * k, 18 * k, 26 * k);
      // 건초 더미
      for (const p of [0.72, 0.86]) {
        g.fillStyle = "#e7c15a";
        g.beginPath();
        g.ellipse(VW * p, hz - 8, 26 * k, 18 * k, 0, 0, TAU);
        g.fill();
      }
      // 당근밭 줄
      g.strokeStyle = "rgba(120,80,40,.5)";
      g.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        g.beginPath();
        g.moveTo(0, hz + 6 + i * 3);
        g.lineTo(VW, hz + 6 + i * 3);
        g.stroke();
      }
    } else if (T.deco === "forest") {
      for (let i = 0; i < 9; i += 1) tree(R() * VW, hz + 6, 0.8 + R() * 0.8, i % 2 ? "#2f8455" : "#3b9663", "#57b37c");
      for (const [p, c] of [[0.12, "#e8574c"], [0.86, "#f08a3c"], [0.5, "#d9507a"]]) {
        const x = VW * p;
        g.fillStyle = "#fff4dc";
        g.fillRect(x - 5, hz - 16, 10, 20);
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x, hz - 16, 18, 12, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = "#fff";
        for (const d of [-8, 1, 9]) {
          g.beginPath();
          g.arc(x + d, hz - 20 + Math.abs(d) * 0.3, 2.5, 0, TAU);
          g.fill();
        }
      }
    } else if (T.deco === "sunset") {
      // 풍차 실루엣과 등불
      const x = VW * 0.82;
      g.fillStyle = "#7c4a55";
      g.beginPath();
      g.moveTo(x - 16, hz + 4);
      g.lineTo(x - 9, hz - 50);
      g.lineTo(x + 9, hz - 50);
      g.lineTo(x + 16, hz + 4);
      g.closePath();
      g.fill();
      g.strokeStyle = "#7c4a55";
      g.lineWidth = 5;
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * TAU + 0.5;
        g.beginPath();
        g.moveTo(x, hz - 50);
        g.lineTo(x + Math.cos(a) * 34, hz - 50 + Math.sin(a) * 34);
        g.stroke();
      }
      for (let i = 0; i < 6; i += 1) {
        const lx = ((i + 0.5) / 6) * VW;
        g.fillStyle = "rgba(255,210,120,.3)";
        g.beginPath();
        g.arc(lx, hz - 4, 12, 0, TAU);
        g.fill();
        g.fillStyle = "#ffdc8a";
        g.beginPath();
        g.arc(lx, hz - 4, 4, 0, TAU);
        g.fill();
      }
    } else {
      // 달빛 성
      const x = VW * 0.24;
      g.fillStyle = "#3a3f8a";
      g.fillRect(x - 46, hz - 44, 92, 48);
      for (const [dx, ht] of [[-46, 74], [0, 92], [46, 74]]) {
        g.fillRect(x + dx - 11, hz - ht, 22, ht);
        g.fillStyle = "#5a4fc9";
        g.beginPath();
        g.moveTo(x + dx - 15, hz - ht);
        g.lineTo(x + dx, hz - ht - 24);
        g.lineTo(x + dx + 15, hz - ht);
        g.closePath();
        g.fill();
        g.fillStyle = "#3a3f8a";
      }
      g.fillStyle = "#ffe48a";
      for (const [dx, dy] of [[-46, 50], [0, 66], [46, 50], [-20, 26], [20, 26]]) g.fillRect(x + dx - 3, hz - dy, 6, 9);
    }
  }
  function drawHoleBack(g, h, T) {
    const { x, y, w, h: hh } = h;
    // 흙 둔덕 그림자
    g.fillStyle = "rgba(20,15,10,.16)";
    g.beginPath();
    g.ellipse(x, y + hh * 0.5, w * 0.64, hh * 0.86, 0, 0, TAU);
    g.fill();
    const d = g.createLinearGradient(0, y - hh, 0, y + hh);
    d.addColorStop(0, T.dirt);
    d.addColorStop(1, T.dirtD);
    g.fillStyle = d;
    g.beginPath();
    g.ellipse(x, y, w * 0.6, hh * 0.86, 0, 0, TAU);
    g.fill();
    // 흙덩이
    let s2 = Math.round(x * 7 + y * 3) + 3;
    const r2 = () => {
      s2 = (s2 * 16807) % 2147483647;
      return s2 / 2147483647;
    };
    for (let i = 0; i < 16; i += 1) {
      const a = r2() * TAU;
      const rr = 0.86 + r2() * 0.18;
      g.fillStyle = r2() < 0.5 ? T.dirt : T.dirtD;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * w * 0.56 * rr, y + Math.sin(a) * hh * 0.82 * rr, w * (0.03 + r2() * 0.035), hh * (0.08 + r2() * 0.08), 0, 0, TAU);
      g.fill();
    }
    // 구멍
    const pit = g.createRadialGradient(x, y + hh * 0.2, hh * 0.1, x, y, w * 0.5);
    pit.addColorStop(0, T.hole);
    pit.addColorStop(0.72, T.hole);
    pit.addColorStop(1, T.dirtD);
    g.fillStyle = pit;
    g.beginPath();
    g.ellipse(x, y, w * 0.46, hh * 0.62, 0, 0, TAU);
    g.fill();
  }
  /** 두더지 앞을 가리는 구멍 앞 턱 */
  function drawHoleFront(h, T) {
    const { x, y, w, h: hh } = h;
    const g = ctx;
    const d = g.createLinearGradient(0, y, 0, y + hh);
    d.addColorStop(0, T.dirt);
    d.addColorStop(1, T.dirtD);
    g.fillStyle = d;
    g.beginPath();
    g.ellipse(x, y, w * 0.6, hh * 0.86, 0, 0, Math.PI);
    g.ellipse(x, y, w * 0.46, hh * 0.62, 0, Math.PI, 0, true);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,240,210,.14)";
    g.beginPath();
    g.ellipse(x, y + hh * 0.42, w * 0.34, hh * 0.1, 0, 0, TAU);
    g.fill();
  }

  /* ---------- 진행 ---------- */
  function startStage(i) {
    info = stageInfo(clamp(i, 0, TOTAL - 1));
    themeI = info.w;
    if (window.TodayGameRank) window.TodayGameRank.reset();
    hearts = info.hearts;
    goalLeft = info.goal;
    caught = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    feverGauge = 0;
    feverT = 0;
    freezeT = 0;
    spawnT = 0.35;
    timeLeft = info.time;
    parts = [];
    floats = [];
    rings = [];
    flyers = [];
    lastHole = -1;
    tickSec = -1;
    endT = -1;
    kingMax = info.boss ? info.goal : 0;
    kingHp = kingMax;
    holes = [];
    setScreen("play");
    layoutBoard();
    bakeBg();
    renderHud();
    const nw = NEW_AT[info.i];
    if (nw && !save.seen[nw.type]) {
      showNewCard(nw);
    } else beginReady();
  }
  function beginReady() {
    readyT = 1.15;
    const r = $("ready");
    r.textContent = info.boss ? "왕두더지 등장!" : `${info.w + 1}-${info.k + 1} 준비!`;
    r.classList.add("on");
  }
  function showNewCard(nw) {
    screen = "newcard";
    paused = false;
    $("newcard").classList.remove("hidden");
    $("new-name").textContent = nw.name;
    $("new-text").textContent = nw.text;
    const c = $("new-art");
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    const key = nw.type === "helmet" ? "normal" : nw.type;
    const im = spr.cache[key];
    if (im) {
      const k = Math.min(c.width / im.width, c.height / im.height);
      g.drawImage(im, (c.width - im.width * k) / 2, c.height - im.height * k, im.width * k, im.height * k);
      if (nw.type === "helmet") drawHelmet(g, c.width / 2, c.height - im.height * k + im.height * k * 0.11, im.width * k * 0.74);
    }
    save.seen[nw.type] = 1;
    persist();
  }
  function activeCount() {
    return holes.filter((h) => h.mole && h.mole.state !== "gone").length;
  }
  function chooseType() {
    const r = Math.random();
    if (feverT > 0) return r < 0.14 ? "gold" : "normal";
    let a = info.gold;
    if (r < a) return "gold";
    a += info.bomb;
    if (r < a) return "bomb";
    a += info.helmet;
    if (r < a) return "helmet";
    a += info.bunny;
    if (r < a) return "bunny";
    a += info.ice;
    if (r < a) return "ice";
    return "normal";
  }
  function spawn(type) {
    const free = holes.filter((h) => !h.mole && h.i !== lastHole);
    if (!free.length) return false;
    const h = free[Math.floor(Math.random() * free.length)];
    lastHole = h.i;
    const stay = type === "king" ? Math.max(0.9, info.stay * 1.5) : type === "gold" ? info.stay * 0.82 : type === "bomb" || type === "bunny" ? info.stay * 1.25 : type === "helmet" ? info.stay * 1.5 : info.stay;
    h.mole = { type, t: 0, state: "rise", stay, hp: type === "helmet" ? 2 : 1, hitT: 0, wob: Math.random() * 6, helmet: type === "helmet", up: 0 };
    if (type === "king") h.mole.hp = 1;
    Sound.pop();
    return true;
  }
  /** 망치로 내려침 */
  function tapHole(h, fromBot) {
    if (screen !== "play" || paused || readyT > 0 || endT >= 0) return false;
    const m = h.mole;
    mallet.x = h.x + h.w * 0.1;
    mallet.y = h.y - h.w * 0.34;
    swingMallet();
    if (!m || m.state === "hit" || m.state === "gone" || m.up < 0.28) {
      // 빈 구멍: 흙만 튐
      dirt(h.x, h.y, 4, h.s);
      return false;
    }
    whack(h, m);
    void fromBot;
    return true;
  }
  function swingMallet() {
    mallet.swing = 1;
    mallet.show = 0.34;
    Sound.swing();
  }
  function addScore(n, x, y, cls) {
    const mul = feverT > 0 ? 2 : 1;
    const gain = Math.round(n * mul * (1 + Math.min(combo, 30) * 0.05));
    score += gain;
    floats.push({ x, y, text: `+${gain}`, t: 0, life: 0.8, size: 22, color: cls || "#fff" });
    return gain;
  }
  function whack(h, m) {
    const x = h.x;
    const y = h.y - h.w * 0.52 * m.up;
    const quick = m.state !== "fall" && m.t < 0.35 && m.state === "rise" ? true : m.reactFast;
    switch (m.type) {
      case "bomb":
        boomAt(x, y, h);
        loseHeart("펑!", x, y);
        h.mole = null;
        return;
      case "bunny":
        m.state = "hit";
        m.hitT = 0;
        Sound.ouch();
        floats.push({ x, y: y - 20, text: "아야! 친구예요", t: 0, life: 1, size: 22, color: "#ffc8d6" });
        loseHeart("", x, y);
        shake = 6;
        return;
      case "helmet":
        if (m.helmet) {
          m.helmet = false;
          m.stay += 0.45;
          m.t = Math.min(m.t, 0.2);
          m.state = "stay";
          m.stun = 0.18;
          Sound.clang();
          flyers.push({ x, y: y - h.w * 0.34, vx: (Math.random() - 0.5) * 260, vy: -420, r: 0, vr: 13, w: h.w * 0.74, t: 0 });
          ring(x, y, h.w * 0.4, "#ffe45c");
          hitStop = 0.03;
          shake = 4;
          floats.push({ x, y: y - h.w * 0.5, text: "한 번 더!", t: 0, life: 0.7, size: 24, color: "#ffe45c" });
          return;
        }
        break;
      default:
        break;
    }
    // 잡았다
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    Sound.bonk(combo);
    hitStop = 0.05;
    shake = Math.max(shake, 5 + Math.min(combo, 10) * 0.4);
    ring(x, y, h.w * 0.56, feverT > 0 ? "#ffd84a" : "#fff");
    burstStars(x, y, h.s, m.type === "gold" ? 16 : 9, m.type === "gold");
    dirt(h.x, h.y, 8, h.s);
    pop("팡!", x, y - h.w * 0.1, h.s);
    m.state = "hit";
    m.hitT = 0;
    let base = 100;
    if (m.type === "gold") {
      base = 500;
      timeLeft = Math.min(info.time + 15, timeLeft + 2);
      Sound.gold();
      floats.push({ x, y: y - h.w * 0.62, text: "+2초", t: 0, life: 0.9, size: 22, color: "#fff2a8" });
    } else if (m.type === "ice") {
      base = 200;
      freezeT = 2.6;
      Sound.freeze();
      floats.push({ x: VW / 2, y: VH * 0.42, text: "꽁꽁!", t: 0, life: 1, size: 44, color: "#bdefff", big: true });
    } else if (m.type === "king") {
      base = 600;
      kingHp -= 1;
      shake = 11;
      hitStop = 0.09;
      burstStars(x, y, h.s * 1.3, 18, true);
    } else if (m.type === "helmet") {
      base = 250;
    }
    addScore(base, x, y - h.w * 0.34, m.type === "gold" ? "#ffe45c" : "#fff");
    if (m.type !== "bomb" && m.type !== "bunny") {
      if (!info.boss || m.type === "king") {
        goalLeft = Math.max(0, goalLeft - 1);
        caught += 1;
      }
      if (feverT <= 0) {
        feverGauge += 1 + (m.type === "gold" ? 2 : 0);
        if (feverGauge >= 12) startFever();
      }
    }
    if (combo > 0 && combo % 5 === 0) floats.push({ x: VW / 2, y: VH * 0.36, text: `${combo} 콤보!`, t: 0, life: 0.9, size: 38, color: "#ffe45c", big: true });
    void quick;
    renderHud();
    if (goalLeft <= 0) finishStage(true);
  }
  function startFever() {
    feverT = 6;
    feverGauge = 0;
    Sound.fever();
    floats.push({ x: VW / 2, y: VH * 0.4, text: "피버 타임!", t: 0, life: 1.2, size: 50, color: "#ffd84a", big: true });
    // 폭탄 · 토끼는 얼른 들어감
    for (const h of holes) {
      if (h.mole && (h.mole.type === "bomb" || h.mole.type === "bunny") && h.mole.state !== "hit") {
        h.mole.state = "fall";
        h.mole.t = 0;
      }
    }
  }
  function loseHeart(text, x, y) {
    hearts -= 1;
    combo = 0;
    feverGauge = Math.max(0, feverGauge - 3);
    if (text) floats.push({ x, y: y - 20, text, t: 0, life: 0.9, size: 46, color: "#ffb14a", big: true });
    $("hud").classList.add("hurt");
    setTimeout(() => $("hud").classList.remove("hurt"), 320);
    renderHud();
    if (hearts <= 0) finishStage(false, "하트가 다 없어졌어요");
  }
  function boomAt(x, y, h) {
    Sound.boom();
    shake = 16;
    ring(x, y, h.w * 1.1, "#ffb14a");
    for (let i = 0; i < 26; i += 1) {
      const a = Math.random() * TAU;
      const v = 80 + Math.random() * 280;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 300, life: 0.5 + Math.random() * 0.4, t: 0, size: 4 + Math.random() * 7, color: ["#ffb14a", "#ff6a3c", "#ffe45c", "#555"][i % 4] });
    }
  }
  function dirt(x, y, n, s) {
    const T = THEMES[themeI];
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI * (0.1 + Math.random() * 0.8);
      const v = (70 + Math.random() * 170) * s;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 720, life: 0.42 + Math.random() * 0.2, t: 0, size: (2.2 + Math.random() * 3.6) * s, color: i % 2 ? T.dirt : T.dirtD });
    }
  }
  function burstStars(x, y, s, n, gold) {
    const cols = gold ? ["#ffe45c", "#fff6c0", "#ffb52e"] : ["#fff", "#ffe45c", "#ff9fc0", "#8fe0ff"];
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = (120 + Math.random() * 220) * s;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 480, life: 0.5 + Math.random() * 0.3, t: 0, size: (4 + Math.random() * 4) * s, color: cols[i % cols.length], star: true, rot: Math.random() * 6 });
    }
  }
  function ring(x, y, r, color) {
    rings.push({ x, y, r, t: 0, life: 0.26, color });
  }
  function pop(text, x, y, s) {
    floats.push({ x, y, text, t: 0, life: 0.42, size: 40 * s, color: "#fff", comic: true, big: true });
  }
  function finishStage(win, why) {
    if (endT >= 0) return;
    endT = 0;
    endWin = win;
    if (!win) {
      Sound.lose();
      $("over-title").textContent = "아쉬워요!";
      $("over-why").textContent = why || "시간이 다 됐어요";
    } else Sound.win();
    for (const h of holes) if (h.mole && h.mole.state !== "hit") h.mole.state = "fall";
  }
  function showClear() {
    const tl = Math.max(0, timeLeft);
    const pct = tl / info.time;
    const stars = 1 + (hearts >= info.hearts ? 1 : 0) + (pct >= 0.22 ? 1 : 0);
    const bonus = Math.round(tl) * 20 + hearts * 150 + maxCombo * 10;
    score += bonus;
    const prev = save.best[info.i];
    save.best[info.i] = { stars: Math.max(stars, prev ? prev.stars : 0), score: Math.max(score, prev ? prev.score : 0) };
    persist();
    const last = info.i >= TOTAL - 1;
    $("clear-stage").textContent = `${info.w + 1}-${info.k + 1} ${THEMES[info.w].name}`;
    $("clear-title").textContent = last ? "두더지왕이 됐어요!" : info.boss ? "왕두더지를 잡았어요!" : "클리어!";
    $("clear-score").textContent = score.toLocaleString("ko-KR");
    $("clear-bonus").textContent = `+${bonus.toLocaleString("ko-KR")}`;
    $("clear-combo").textContent = maxCombo;
    $("clear-hint").textContent = stars < 3 ? [hearts < info.hearts ? "하트를 지키면 별 하나 더" : "", pct < 0.22 ? "시간을 남기면 별 하나 더" : ""].filter(Boolean).join(" · ") : "완벽해요!";
    $("next-btn").classList.toggle("hidden", last);
    document.querySelectorAll("#clear-stars i").forEach((el, i) => {
      el.classList.remove("on");
      if (i < stars) {
        setTimeout(() => {
          el.classList.add("on");
          Sound.star(i);
        }, 240 + i * 240);
      }
    });
    const rank = info.boss || last;
    $("clear-rank").classList.toggle("hidden", !rank);
    setScreen("clear");
    if (rank && window.TodayGameRank) {
      window.TodayGameRank.mount({ gameId: "whack-mole", gameTitle: "두더지 팡팡", formParent: $("clear-rank") });
      window.TodayGameRank.open(Math.max(1, totalScore()), { label: `${info.w + 1}-${info.k + 1}까지 · 총점 ${totalScore().toLocaleString("ko-KR")}` });
    }
  }
  function showOver() {
    $("over-detail").textContent = `${info.w + 1}-${info.k + 1} · 잡은 두더지 ${caught}마리 · 점수 ${score.toLocaleString("ko-KR")}`;
    setScreen("over");
    if (window.TodayGameRank) {
      window.TodayGameRank.mount({ gameId: "whack-mole", gameTitle: "두더지 팡팡", formParent: $("over-rank") });
      const rs = Math.max(score, totalScore());
      window.TodayGameRank.open(Math.max(1, rs), { label: `${info.w + 1}-${info.k + 1} · ${rs.toLocaleString("ko-KR")}점` });
    }
  }

  /* ---------- 매 프레임 계산 ---------- */
  function tick(dt) {
    now += dt;
    if (screen !== "play" && screen !== "clear" && screen !== "over") return;
    if (hitStop > 0) {
      hitStop -= dt;
      return;
    }
    if (readyT > 0) {
      readyT -= dt;
      if (readyT <= 0) $("ready").classList.remove("on");
    }
    const playing = screen === "play" && readyT <= 0 && endT < 0;
    if (playing) {
      timeLeft -= dt;
      if (timeLeft <= 5 && timeLeft > 0) {
        const s = Math.ceil(timeLeft);
        if (s !== tickSec) {
          tickSec = s;
          Sound.tick();
        }
      }
      if (timeLeft <= 0) {
        timeLeft = 0;
        finishStage(false, "시간이 다 됐어요");
      }
      if (feverT > 0) feverT -= dt;
      if (freezeT > 0) freezeT -= dt;
      spawnT -= dt * (feverT > 0 ? 2 : 1);
      if (spawnT <= 0 && freezeT <= 0) {
        spawnT = info.gap * (0.8 + Math.random() * 0.4);
        const limit = Math.min(holes.length - 1, info.maxActive + (feverT > 0 ? 2 : 0));
        if (activeCount() < limit) {
          if (info.boss && !holes.some((h) => h.mole && h.mole.type === "king")) spawn("king");
          else if (info.boss) {
            const t = chooseType();
            spawn(t === "king" ? "normal" : t);
          } else spawn(chooseType());
        }
      }
    }
    if (endT >= 0 && screen === "play") {
      endT += dt;
      if (endT > (endWin ? 1 : 1.1)) {
        if (endWin) showClear();
        else showOver();
      }
    }
    // 두더지 움직임
    for (const h of holes) {
      const m = h.mole;
      if (!m) continue;
      const frozen = freezeT > 0 && m.state !== "hit";
      if (m.stun > 0) m.stun -= dt;
      if (!frozen && !(m.stun > 0)) m.t += dt;
      const riseT = 0.17;
      const fallT = 0.15;
      switch (m.state) {
        case "rise":
          m.up = easeBack(clamp(m.t / riseT, 0, 1));
          if (m.t >= riseT) {
            m.state = "stay";
            m.t = 0;
          }
          break;
        case "stay":
          m.up = 1;
          if (m.t >= m.stay) {
            m.state = "fall";
            m.t = 0;
          }
          break;
        case "fall":
          m.up = 1 - clamp(m.t / fallT, 0, 1) ** 2;
          if (m.t >= fallT) {
            // 놓침: 콤보가 끊김 (폭탄 · 토끼는 괜찮음)
            if (m.type !== "bomb" && m.type !== "bunny" && endT < 0 && screen === "play") combo = 0;
            h.mole = null;
          }
          break;
        case "hit":
          m.hitT += dt;
          m.up = m.hitT < 0.16 ? 0.74 : 0.74 * (1 - clamp((m.hitT - 0.16) / 0.3, 0, 1));
          if (m.hitT >= 0.46) h.mole = null;
          break;
        default:
          break;
      }
    }
    if (mallet.swing > 0) mallet.swing = Math.max(0, mallet.swing - dt * 7);
    if (mallet.show > 0) mallet.show -= dt;
    shake = Math.max(0, shake - dt * 32);
    for (const p of parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.g || 0) * dt;
      if (p.rot !== undefined) p.rot += dt * 8;
    }
    parts = parts.filter((p) => p.t < p.life);
    for (const f of floats) {
      f.t += dt;
      f.y -= (f.big ? 16 : 54) * dt;
    }
    floats = floats.filter((f) => f.t < f.life);
    for (const r of rings) r.t += dt;
    rings = rings.filter((r) => r.t < r.life);
    for (const f of flyers) {
      f.t += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 1100 * dt;
      f.r += f.vr * dt;
    }
    flyers = flyers.filter((f) => f.t < 1.1);
  }

  /* ---------- 그리기 ---------- */
  function drawHelmet(g, x, y, w) {
    g.save();
    g.translate(x, y);
    const grd = g.createLinearGradient(0, -w * 0.4, 0, w * 0.1);
    grd.addColorStop(0, "#ffe45c");
    grd.addColorStop(1, "#f5a81d");
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(0, 0, w * 0.46, w * 0.38, 0, Math.PI, 0);
    g.closePath();
    g.fill();
    g.fillStyle = "#e0920f";
    g.beginPath();
    g.ellipse(0, w * 0.01, w * 0.56, w * 0.085, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#fff4b8";
    g.fillRect(-w * 0.055, -w * 0.38, w * 0.11, w * 0.36);
    g.fillStyle = "rgba(255,255,255,.45)";
    g.beginPath();
    g.ellipse(-w * 0.22, -w * 0.2, w * 0.08, w * 0.05, -0.7, 0, TAU);
    g.fill();
    g.restore();
  }
  function drawCrown(g, x, y, w) {
    g.save();
    g.translate(x, y);
    g.fillStyle = "#ffc62e";
    g.strokeStyle = "#b87a08";
    g.lineWidth = w * 0.03;
    g.beginPath();
    g.moveTo(-w * 0.42, 0);
    g.lineTo(-w * 0.5, -w * 0.38);
    g.lineTo(-w * 0.2, -w * 0.14);
    g.lineTo(0, -w * 0.46);
    g.lineTo(w * 0.2, -w * 0.14);
    g.lineTo(w * 0.5, -w * 0.38);
    g.lineTo(w * 0.42, 0);
    g.closePath();
    g.fill();
    g.stroke();
    for (const [dx, c] of [[-0.24, "#ff4d6d"], [0, "#49c8ff"], [0.24, "#62e07a"]]) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(dx * w, -w * 0.07, w * 0.05, 0, TAU);
      g.fill();
    }
    g.restore();
  }
  function drawMole(h) {
    const m = h.mole;
    if (!m) return;
    const C = spr.cache;
    const [SW, SH] = spr.size;
    const king = m.type === "king";
    const k = king ? 1.32 : 1;
    const w = h.w * 1.02 * k;
    const ht = (w * SH) / SW;
    const base = h.y + h.h * 0.28;
    const up = clamp(m.up, -0.2, 1.3);
    // 뽕 튀어나올 때 늘어나고, 맞으면 납작
    let sy = 1;
    let sx = 1;
    if (m.state === "rise") {
      const e = clamp(m.t / 0.17, 0, 1);
      sy = 1 + (1 - e) * 0.22;
      sx = 1 - (1 - e) * 0.12;
    } else if (m.state === "hit") {
      const e = clamp(m.hitT / 0.16, 0, 1);
      const sq = Math.sin(e * Math.PI) * 0.34 + 0.08;
      sy = 1 - sq;
      sx = 1 + sq * 0.8;
    } else if (m.stun > 0) {
      sy = 0.82;
      sx = 1.14;
    } else {
      const b = Math.sin(now * 7 + m.wob) * 0.018;
      sy = 1 + b;
      sx = 1 - b;
    }
    let im = C.normal;
    const hit = m.state === "hit";
    if (m.type === "gold") im = hit ? C.goldHit : C.gold;
    else if (m.type === "ice") im = hit ? C.iceHit : C.ice;
    else if (m.type === "bomb") im = C.bomb;
    else if (m.type === "bunny") im = C.bunny;
    else if (hit) im = C.hit;
    else if (freezeT > 0) im = C.frozen;
    if (m.stun > 0) im = C.hit;
    const dw = w * sx;
    const dh = ht * sy;
    const top = base - ht * up;
    ctx.save();
    // 구멍 위쪽과 앞 턱 곡선까지만 보임
    ctx.beginPath();
    ctx.rect(h.x - h.w * 1.3, 0, h.w * 2.6, h.y);
    ctx.ellipse(h.x, h.y, h.w * 0.47, h.h * 0.64, 0, 0, Math.PI);
    ctx.clip();
    const wig = m.type === "bunny" ? Math.sin(now * 6 + m.wob) * 0.04 : freezeT > 0 ? Math.sin(now * 40) * 0.008 : 0;
    ctx.translate(h.x, top + ht);
    ctx.rotate(wig);
    ctx.drawImage(im, -dw / 2, -dh, dw, dh);
    const headY = -dh * 0.9;
    if (m.helmet) drawHelmet(ctx, 0, headY + dh * 0.06, dw * 0.74);
    if (king) drawCrown(ctx, 0, headY + dh * 0.02, dw * 0.6);
    if (m.type === "bomb") {
      // 도화선 불꽃
      const fx = dw * 0.2;
      const fy = -dh * 0.97;
      ctx.fillStyle = Math.sin(now * 40) > 0 ? "#ffe45c" : "#ff8a3c";
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU + now * 12;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * dw * 0.035, fy + Math.sin(a) * dw * 0.035, dw * 0.018, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(fx, fy, dw * 0.022, 0, TAU);
      ctx.fill();
    }
    if (m.type === "gold" && !hit) {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 3; i += 1) {
        const a = now * 2 + i * 2.1;
        star(ctx, Math.cos(a) * dw * 0.46, -dh * 0.55 + Math.sin(a * 1.3) * dh * 0.3, dw * 0.05 * (0.6 + 0.4 * Math.sin(now * 8 + i)));
      }
    }
    ctx.restore();
    // 어지러운 별
    if ((hit && m.type !== "bunny") || m.stun > 0) {
      const y = base - ht * Math.max(up, 0.3) - 2;
      ctx.fillStyle = "#ffe45c";
      for (let i = 0; i < 4; i += 1) {
        const a = now * 9 + (i / 4) * TAU;
        star(ctx, h.x + Math.cos(a) * w * 0.38, y + Math.sin(a) * w * 0.09, w * 0.06);
      }
    }
    // 왕두더지 체력
    if (king) {
      const bw = w * 0.9;
      const by = top - 14;
      ctx.fillStyle = "rgba(30,20,20,.65)";
      roundRect(ctx, h.x - bw / 2, by, bw, 10, 5);
      ctx.fill();
      ctx.fillStyle = "#ff5a5f";
      roundRect(ctx, h.x - bw / 2 + 2, by + 2, (bw - 4) * clamp(kingHp / kingMax, 0, 1), 6, 3);
      ctx.fill();
    }
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, Math.max(0.1, w), h, r);
  }
  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const q = i % 2 ? r * 0.45 : r;
      g[i ? "lineTo" : "moveTo"](x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    g.closePath();
    g.fill();
  }
  function drawMallet() {
    if (!spr.mallet) return;
    const show = mallet.mouse ? screen === "play" : mallet.show > 0;
    if (!show) return;
    const sz = clamp(baseW * 1.04, 74, 150);
    const w = sz;
    const h = (sz * spr.mallet.height) / spr.mallet.width;
    const a = lerp(-0.62, 0.55, Math.sin((1 - mallet.swing) * Math.PI * 0.5) * (mallet.swing > 0 ? 1 : 0)) + (mallet.swing > 0 ? 0 : 0);
    ctx.save();
    ctx.translate(mallet.x + w * 0.45, mallet.y + h * 0.62);
    ctx.rotate(mallet.swing > 0 ? lerp(0.5, -1.05, mallet.swing) : -0.12);
    ctx.drawImage(spr.mallet, -w * 0.72, -h * 0.82, w, h);
    ctx.restore();
    void a;
  }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (screen === "title" || screen === "stages") {
      ctx.drawImage(bg, 0, 0, VW, VH);
      return;
    }
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.drawImage(bg, 0, 0, VW, VH);
    const T = THEMES[themeI];
    if (feverT > 0) {
      // 피버: 뒤에서 도는 빛
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.14 + Math.sin(now * 10) * 0.04;
      ctx.translate(VW / 2, VH * 0.55);
      ctx.rotate(now * 0.7);
      ctx.fillStyle = "#ffd84a";
      const R = Math.max(VW, VH);
      for (let i = 0; i < 10; i += 1) {
        ctx.rotate(TAU / 10);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(R, -R * 0.14);
        ctx.lineTo(R, R * 0.14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    const list = holes.slice().sort((a, b) => a.y - b.y);
    for (const h of list) {
      // 올라오기 직전 흙이 들썩임
      drawMole(h);
      drawHoleFront(h, T);
    }
    if (freezeT > 0) {
      ctx.fillStyle = `rgba(150,220,255,${0.16 + Math.sin(now * 8) * 0.03})`;
      ctx.fillRect(0, 0, VW, VH);
    }
    for (const r of rings) {
      const u = r.t / r.life;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - u;
      ctx.lineWidth = 8 * (1 - u) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.3 + u * 1.05), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of parts) {
      ctx.globalAlpha = clamp(1.4 - p.t / p.life, 0, 1);
      ctx.fillStyle = p.color;
      if (p.star) star(ctx, p.x, p.y, p.size);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of flyers) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.r);
      drawHelmet(ctx, 0, 0, f.w);
      ctx.restore();
    }
    drawMallet();
    ctx.restore();
    for (const f of floats) {
      const u = f.t / f.life;
      const scale = f.big ? 1 + (1 - Math.min(1, u * 5)) * 0.5 : 1;
      ctx.globalAlpha = u > 0.65 ? (1 - u) / 0.35 : 1;
      ctx.font = `400 ${f.size * scale}px "Bagel Fat One","Jua",sans-serif`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = f.comic ? 9 : 6;
      ctx.strokeStyle = f.comic ? "#d93f3f" : "rgba(40,25,10,.86)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
  let hudT = 0;
  function renderHud() {
    $("hud-stage").textContent = `${info.w + 1}-${info.k + 1}`;
    $("hud-score").textContent = score.toLocaleString("ko-KR");
    $("hud-goal").textContent = info.boss ? `왕두더지 ${Math.max(0, kingHp)}` : `${caught} / ${info.goal}`;
    $("goal-fill").style.width = `${(caught / info.goal) * 100}%`;
    $("hud-hearts").innerHTML = Array.from({ length: info.hearts }, (_, i) => `<i class="${i < hearts ? "on" : ""}"></i>`).join("");
  }
  function syncHud() {
    const tf = $("time-fill");
    tf.style.width = `${clamp(timeLeft / info.time, 0, 1) * 100}%`;
    tf.classList.toggle("low", timeLeft <= 5);
    $("hud-time").textContent = Math.ceil(Math.max(0, timeLeft));
    const fv = $("fever-fill");
    fv.style.width = `${feverT > 0 ? (feverT / 6) * 100 : (feverGauge / 12) * 100}%`;
    $("fever").classList.toggle("on", feverT > 0);
    $("hud-combo").textContent = combo >= 2 ? `${combo} 콤보` : "";
    $("hud-score").textContent = score.toLocaleString("ko-KR");
  }
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = clamp((t - lastT) / 1000, 0, 0.05);
    lastT = t;
    if (!paused) tick(dt);
    render();
    hudT -= dt;
    if (hudT <= 0 && screen === "play") {
      hudT = 0.05;
      syncHud();
    }
  }

  /* ---------- 화면 ---------- */
  function setScreen(name) {
    screen = name;
    for (const id of ["title", "stages", "clear", "over"]) $(id).classList.toggle("hidden", id !== name);
    $("newcard").classList.add("hidden");
    document.body.classList.toggle("in-play", name === "play");
    document.body.classList.toggle("in-game", name === "play" || name === "clear" || name === "over");
    if (name === "title") renderTitle();
    lastT = performance.now();
  }
  function renderTitle() {
    const n = Object.keys(save.best).length;
    const next = nextStage();
    $("start-btn").textContent = n ? `이어하기 ${Math.floor(next / 10) + 1}-${(next % 10) + 1}` : "시작!";
    $("title-prog").textContent = n ? `별 ${totalStars()} / ${TOTAL * 3} · 총점 ${totalScore().toLocaleString("ko-KR")}` : "5개 월드 · 50단계 · 왕두더지";
  }
  function openStages(w) {
    setScreen("stages");
    renderStages(w === undefined ? Math.floor(nextStage() / 10) : w);
  }
  function renderStages(w) {
    document.querySelectorAll("[data-world]").forEach((b) => b.classList.toggle("on", Number(b.dataset.world) === w));
    $("stages-sum").textContent = `별 ${totalStars()} / ${TOTAL * 3}`;
    const grid = $("stage-grid");
    grid.innerHTML = "";
    for (let i = w * 10; i < w * 10 + 10; i += 1) {
      const open = isOpen(i);
      const best = save.best[i];
      const b = document.createElement("button");
      b.type = "button";
      b.className = `st ${best ? "done" : ""} ${open ? "" : "locked"} ${i % 10 === 9 ? "boss" : ""}`;
      b.disabled = !open;
      b.setAttribute("aria-label", `${w + 1}-${(i % 10) + 1}단계${open ? "" : " (잠김)"}`);
      b.innerHTML = open ? `<b>${(i % 10) + 1}</b><span class="mini">${[0, 1, 2].map((k) => `<i class="${best && best.stars > k ? "on" : ""}"></i>`).join("")}</span>` : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3h1.500v10h-13V11zm2.500 0h5V8a2.500 2.500 0 0 0-5 0z" fill="currentColor"/></svg>`;
      if (open) {
        b.addEventListener("click", () => {
          Sound.unlock();
          Sound.ui();
          startStage(i);
        });
      }
      grid.appendChild(b);
    }
  }

  /* ---------- 입력 ---------- */
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function holeAt(x, y) {
    let best = null;
    let bd = Infinity;
    for (const h of holes) {
      const dx = Math.abs(x - h.x);
      const up = h.mole && h.mole.up > 0.2 ? h.w * 1.02 : h.h;
      const inside = dx < h.w * 0.66 && y < h.y + h.h * 1.1 && y > h.y - up;
      if (!inside) continue;
      // 두더지가 있는 구멍을 먼저
      const d = Math.hypot(dx, y - (h.y - up * 0.4)) - (h.mole && h.mole.state !== "hit" ? h.w : 0);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") {
      mallet.mouse = true;
      const p = pos(e);
      mallet.x = p.x;
      mallet.y = p.y;
    }
  });
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    Sound.unlock();
    if (screen !== "play" || paused) return;
    const p = pos(e);
    mallet.mouse = e.pointerType === "mouse";
    const h = holeAt(p.x, p.y);
    if (h) {
      tapHole(h);
      if (mallet.mouse) {
        mallet.x = p.x;
        mallet.y = p.y;
      }
    } else {
      mallet.x = p.x;
      mallet.y = p.y;
      swingMallet();
    }
  });
  addEventListener("keydown", (e) => {
    if (e.repeat || screen !== "play" || paused) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const i = keys[e.code];
    if (i !== undefined && holes[i]) {
      Sound.unlock();
      tapHole(holes[i]);
    }
  });
  const on = (id, fn) => $(id).addEventListener("click", () => {
    Sound.unlock();
    Sound.ui();
    fn();
  });
  on("start-btn", () => startStage(nextStage()));
  on("stages-btn", () => openStages());
  on("stages-back", () => setScreen("title"));
  on("next-btn", () => startStage(info.i + 1));
  on("replay-btn", () => startStage(info.i));
  on("clear-stages", () => openStages(info.w));
  on("retry-btn", () => startStage(info.i));
  on("over-stages", () => openStages(info.w));
  on("new-ok", () => {
    $("newcard").classList.add("hidden");
    screen = "play";
    beginReady();
  });
  document.querySelectorAll("[data-world]").forEach((b) => b.addEventListener("click", () => {
    Sound.ui();
    renderStages(Number(b.dataset.world));
  }));

  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => screen === "play" && endT < 0,
      isPaused: () => paused,
      pause() {
        if (screen !== "play") return false;
        paused = true;
        return true;
      },
      resume() {
        paused = false;
        lastT = performance.now();
        return true;
      },
    });
  }
  if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: "whack-mole", gameTitle: "두더지 팡팡", formParent: $("over-rank") });
  addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);

  Promise.all([loadImg("assets/mole.png?v=2"), loadImg("assets/mallet.png?v=2")]).then(([m, h]) => {
    spr.mole = m;
    spr.mallet = h;
    bakeSprites();
    setScreen("title");
    resize();
    lastT = performance.now();
    requestAnimationFrame(frame);
    window.WhackMole.ready = true;
  });

  // 점검용
  window.WhackMole = {
    get s() {
      return { screen, stage: info.i, info, timeLeft, hearts, goalLeft, caught, score, combo, maxCombo, feverT, feverGauge, freezeT, readyT, endT, endWin, paused, kingHp, VW, VH, baseW };
    },
    holes: () => holes,
    tick,
    tapHole,
    startStage,
    stageInfo,
    TOTAL,
    save,
    setTime(v) {
      timeLeft = v;
    },
    skipReady() {
      readyT = 0;
      $("ready").classList.remove("on");
    },
    NEW_AT,
    setScreen,
    hit(i) {
      return tapHole(holes[i], true);
    },
  };
})();
