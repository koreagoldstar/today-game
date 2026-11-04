/* 콩콩 점프 — 다시 만든 판
 *
 * - 발판은 점프 물리로 계산해서 놓는다. 닿을 수 없는 발판은 나오지 않는다 (airTime · 안내 코인).
 * - 땅(초원)처럼 보이던 바닥은 구름 바다로: 떨어지면 끝이라는 것이 눈에 보이게.
 * - 고정 걸음 1/120초. 세계 좌표를 쓴다 (예전엔 스크롤이 두 번 계산돼 판이 몇 화면씩 미리 만들어졌다).
 */
(() => {
  "use strict";

  const W = 390;
  let H = 700;
  let GROUND_Y = H - 90;
  const STEP = 1 / 120;
  const BEST_KEY = "today-jump-run-best";
  const NAME_KEY = "today-jump-run-name";
  const PLAYER_X = 104;
  const GRAVITY = 1950;
  const JUMP_V = -680;
  const SPRING_V = JUMP_V * 1.38;
  const WING_V = JUMP_V * 0.88;
  const COYOTE = 0.12;
  const JUMP_BUF = 0.13;
  const LOOP = 780;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const $ = (id) => document.getElementById(id);
  const mod = (v, m) => ((v % m) + m) % m;

  const STAGE_NAMES = [
    "햇살 초원", "구름 산책", "콩콩 연습", "코인 마을", "가시 주의", "하늘 다리", "점프 축제", "바람 언덕", "무지개 길", "고공 비행",
    "챔피언 코스", "콩콩 왕국", "스프링 파크", "흔들 구름", "별똥별 길", "무너지는 탑", "돌풍 계곡", "새떼 주의", "최종 질주", "콩콩 전설",
    "구름 미끄럼", "캔디 절벽", "회오리 점프", "골드 레인", "야간 비행", "폭풍 다리", "슈퍼 스프링", "별빛 질주", "끝없는 하늘", "콩콩 마스터",
    "달빛 질주", "솜사탕 다리", "번개 점프", "오로라 코스", "빙글 구름", "황금 가시밭", "바람의 왕", "별가루 레이스", "천공 미로", "콩콩 시련",
    "폭풍의 정상", "무지개 절벽", "슈퍼노바 점프", "유성 고속도로", "구름 요새", "최종 돌풍", "전설의 스프링", "무한 하늘", "왕관 질주", "콩콩 신화",
  ];

  // 하늘 다섯 가지. 레벨이 오르면 천천히 바뀐다.
  const BIOMES = [
    { name: "낮", sky: ["#5cbcf5", "#9be0ff", "#d6f3ff"], hillFar: "#a8dcc4", hillNear: "#86cf8f", sea: "#ffffff", seaD: "#d2ecfb", cloud: 0.95, hue: 0, sun: { x: 300, y: 150, c: "#ffe27a", glow: "255,236,160" }, stars: 0, body: 0 },
    { name: "높은 하늘", sky: ["#6f9cf0", "#a9c8ff", "#f2e8ff"], hillFar: "#c4cff5", hillNear: "#aab9ee", sea: "#f6f2ff", seaD: "#cfd2f7", cloud: 1, hue: 62, sun: { x: 90, y: 176, c: "#fff2b0", glow: "255,246,190" }, stars: 0.1, body: 0.1 },
    { name: "노을", sky: ["#6a55b8", "#f08a7a", "#ffd98a"], hillFar: "#c97c8e", hillNear: "#a85a78", sea: "#ffe0c8", seaD: "#f2a8a0", cloud: 0.86, hue: -74, sun: { x: 290, y: 190, c: "#ffb060", glow: "255,170,110" }, stars: 0.15, body: 0.2 },
    { name: "밤", sky: ["#0e1440", "#28307a", "#5a4aa0"], hillFar: "#28306e", hillNear: "#1c2358", sea: "#6a6cc0", seaD: "#3c3f8e", cloud: 0.32, hue: 150, sun: { x: 300, y: 150, c: "#f6f4ff", glow: "210,216,255" }, stars: 1, body: 0.55 },
    { name: "오로라", sky: ["#08203e", "#1a6a78", "#6fd8b4"], hillFar: "#1f5f70", hillNear: "#174b5c", sea: "#b4f0dc", seaD: "#5cb4a8", cloud: 0.5, hue: 110, sun: { x: 300, y: 150, c: "#e0fff4", glow: "160,255,220" }, stars: 0.8, body: 0.4 },
  ];
  const BIOME_LEVELS = 6;

  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const stageEl = document.querySelector(".stage");
  let scale = 1;

  const overlays = { title: $("title"), over: $("over") };
  const images = { hero: null, platform: null, coin: null, spike: null, cloud: null };
  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;

  let state = "title";
  let score = 0;
  let distance = 0;
  let camX = 0;
  let coinsTaken = 0;
  let last = 0;
  let accum = 0;
  let flash = 0;
  let flashCol = "255,255,255";
  let shake = 0;
  let hintTimer = 0;
  let holdJump = false;
  let jumpBuf = 0;
  let coyote = 0;
  let submitted = false;
  let time = 0;
  let deadTimer = 0;
  let runAnim = 0;
  let squash = 0;
  let squashV = 0;
  let bannerText = "";
  let bannerT = 0;
  let lastLevel = 0;
  let cooldownChunks = 0;
  let chainT = 0;
  let chain = 0;
  let blinkT = 2;
  let shieldOn = false;
  let wingT = 0;
  let magnetT = 0;
  let airJumpUsed = false;
  let noCut = false; // 스프링 · 방패로 튕긴 것은 손을 떼도 짧아지지 않는다
  let invT = 0;
  let deathCause = "";
  let biomeFrom = 0;
  let biomeTo = 0;
  let biomeK = 1;
  let startedAtX = 0;

  const nameInput = $("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";

  let platforms = [];
  let coins = [];
  let spikes = [];
  let birds = [];
  let winds = [];
  let items = [];
  let triggers = [];
  let particles = [];
  let floats = [];
  let clouds = [];
  let genX = 0;
  const stats = { maxLevel: 1, jumps: 0, coins: 0 };

  const player = { y: GROUND_Y - 42, vy: 0, w: 34, h: 42, onGround: false, plat: null, rot: 0 };
  const px = () => camX + PLAYER_X;

  /* ---------- 난이도 ---------- */
  function levelNow() {
    return Math.floor(distance / 1100);
  }
  function getDifficulty() {
    const level = Math.min(49, levelNow());
    const k = clamp(level / 16, 0, 1);
    return {
      level: level + 1,
      name: STAGE_NAMES[level] || `레벨 ${level + 1}`,
      meter: (distance % 1100) / 1100,
      speed: Math.min(340, 165 + Math.min(level, 12) * 10 + Math.max(0, level - 12) * 2.5),
      comfort: lerp(0.5, 0.84, k),
      upMax: lerp(44, 86, k),
      downMax: lerp(70, 150, k),
      wMin: lerp(150, 86, k),
      wMax: lerp(214, 150, k),
      special: lerp(0.12, 0.62, clamp(level / 12, 0, 1)),
      coinRate: lerp(0.75, 0.5, k),
      rawLevel: level,
    };
  }

  // 점프해서 높이 차 dy(아래가 +) 인 곳에 내려앉기까지 걸리는 시간
  function airTime(dy, v0 = JUMP_V, g = GRAVITY) {
    const disc = v0 * v0 + 2 * g * dy;
    if (disc <= 0) return 0;
    return (-v0 + Math.sqrt(disc)) / g;
  }
  const apex = (v0 = JUMP_V, g = GRAVITY) => (v0 * v0) / (2 * g);

  /* ---------- 그림 ---------- */
  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  async function loadAssets() {
    const [hero, platform, coin, spike, cloud] = await Promise.all([
      loadImg("assets/hero.webp"),
      loadImg("assets/platform.webp"),
      loadImg("assets/coin.webp"),
      loadImg("assets/spike.webp"),
      loadImg("assets/cloud.webp"),
    ]);
    Object.assign(images, { hero, platform, coin, spike, cloud });
  }

  // 발판 그림: 풀 부분만 색을 돌려 하늘마다 다른 발판으로
  const skinCache = {};
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h;
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hslToRgb(h, s, l) {
    h = mod(h, 360) / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      t = mod(t, 1);
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  function platformSkin(b) {
    if (skinCache[b]) return skinCache[b];
    const im = images.platform;
    if (!im) return null;
    const c = mk(im.naturalWidth, im.naturalHeight);
    const x = c.getContext("2d");
    x.drawImage(im, 0, 0);
    const biome = BIOMES[b];
    if (biome.hue || biome.body) {
      const data = x.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 8) continue;
        const r = d[i];
        const g = d[i + 1];
        const bl = d[i + 2];
        if (g > r * 0.92 && g > bl) {
          const [h, s, l] = rgbToHsl(r, g, bl);
          const out = hslToRgb(h + biome.hue, s * 0.92, l);
          d[i] = out[0];
          d[i + 1] = out[1];
          d[i + 2] = out[2];
        } else if (biome.body) {
          const k = 1 - biome.body * 0.55;
          d[i] = r * k + 40 * (1 - k);
          d[i + 1] = g * k + 34 * (1 - k);
          d[i + 2] = bl * k + 70 * (1 - k);
        }
      }
      x.putImageData(data, 0, 0);
    }
    skinCache[b] = c;
    return c;
  }

  // 하늘마다 언덕 · 구름 바다를 구워 둔다
  const backCache = {};
  function bakeBack(b) {
    const key = `${b}:${H}`;
    if (backCache[key]) return backCache[key];
    const biome = BIOMES[b];
    const bs = Math.min(scale, 2);
    const hillsTop = GROUND_Y - 230;
    const hillsH = H - hillsTop;
    const hills = mk(LOOP * bs, hillsH * bs);
    const hx = hills.getContext("2d");
    hx.scale(bs, bs);
    hx.translate(0, -hillsTop);
    const lump = (x, y, w, h, c) => {
      for (const q of [x, x - LOOP, x + LOOP]) {
        hx.fillStyle = c;
        hx.beginPath();
        hx.ellipse(q, y, w, h, 0, Math.PI, 0);
        hx.fill();
      }
    };
    const seedList = [60, 190, 330, 470, 610, 730];
    seedList.forEach((x, i) => lump(x, GROUND_Y + 30, 150 + (i % 3) * 30, 120 + (i % 2) * 70, biome.hillFar));
    hx.fillStyle = biome.hillFar;
    hx.fillRect(0, GROUND_Y + 30, LOOP, H);
    const near = mk(LOOP * bs, hillsH * bs);
    const nx = near.getContext("2d");
    nx.scale(bs, bs);
    nx.translate(0, -hillsTop);
    [20, 170, 300, 440, 600, 700].forEach((x, i) => {
      for (const q of [x, x - LOOP, x + LOOP]) {
        nx.fillStyle = biome.hillNear;
        nx.beginPath();
        nx.ellipse(q, GROUND_Y + 50, 130 + (i % 3) * 26, 70 + (i % 2) * 44, 0, Math.PI, 0);
        nx.fill();
      }
    });
    nx.fillStyle = biome.hillNear;
    nx.fillRect(0, GROUND_Y + 50, LOOP, H);
    // 구름 바다 (떨어지면 끝)
    const seaH = H - GROUND_Y + 40;
    const sea = mk(LOOP * bs, seaH * bs);
    const sx = sea.getContext("2d");
    sx.scale(bs, bs);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const puffs = (color, y0, rMin, rMax, n) => {
      sx.fillStyle = color;
      for (let i = 0; i < n; i += 1) {
        const x = (i / n) * LOOP + rnd() * 20;
        const r = rMin + rnd() * (rMax - rMin);
        const y = y0 + rnd() * 14;
        for (const q of [x, x - LOOP, x + LOOP]) {
          sx.beginPath();
          sx.arc(q, y, r, 0, Math.PI * 2);
          sx.fill();
        }
      }
    };
    puffs(biome.seaD, 44, 22, 40, 34);
    sx.fillStyle = biome.seaD;
    sx.fillRect(0, 60, LOOP, seaH);
    puffs(biome.sea, 66, 20, 36, 36);
    sx.fillStyle = biome.sea;
    sx.fillRect(0, 82, LOOP, seaH);
    const out = { hills, near, sea, hillsTop, hillsH, seaH };
    backCache[key] = out;
    return out;
  }

  function resize() {
    const r = stageEl.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    scale = canvas.width / W;
    const old = GROUND_Y;
    H = Math.max(520, Math.round((W * r.height) / Math.max(1, r.width)));
    GROUND_Y = H - 90;
    const dy = GROUND_Y - old;
    if (dy) {
      platforms.forEach((p) => {
        p.y += dy;
        p.baseY += dy;
      });
      coins.forEach((c) => (c.y += dy));
      spikes.forEach((s) => (s.y += dy));
      birds.forEach((b) => {
        b.y += dy;
        b.baseY += dy;
      });
      items.forEach((c) => (c.y += dy));
      player.y += dy;
    }
  }

  /* ---------- 소리 ---------- */
  const Sfx = {
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
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
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
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
      g.gain.setValueAtTime(0.0008, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    jump() {
      this.tone(330, 0.16, "sine", 0.2, 1.9);
      this.tone(660, 0.1, "triangle", 0.06, 1.5);
    },
    airJump() {
      this.tone(520, 0.16, "triangle", 0.16, 1.7);
    },
    land() {
      this.tone(150, 0.08, "sine", 0.16, 0.6);
    },
    coin(n) {
      const scale2 = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      const f = 880 * Math.pow(2, scale2[Math.min(n, scale2.length - 1)] / 12);
      this.tone(f, 0.11, "triangle", 0.13);
      this.tone(f * 1.5, 0.14, "sine", 0.06, 1, 0.04);
    },
    star() {
      [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.13, 1, i * 0.05));
    },
    spring() {
      this.tone(220, 0.3, "square", 0.08, 3.2);
      this.tone(330, 0.26, "sine", 0.18, 2.6);
    },
    crumble() {
      this.tone(160, 0.2, "sawtooth", 0.07, 0.5);
    },
    level() {
      [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.12, 1, i * 0.08));
    },
    hit() {
      this.tone(420, 0.34, "square", 0.13, 0.25);
      this.tone(210, 0.4, "sine", 0.18, 0.3);
    },
    shield() {
      this.tone(660, 0.2, "sine", 0.14, 0.6);
      this.tone(1320, 0.12, "triangle", 0.06, 0.7);
    },
    item() {
      [659, 880, 1046].forEach((f, i) => this.tone(f, 0.14, "sine", 0.14, 1, i * 0.06));
    },
  };

  /* ---------- 화면 ---------- */
  function show(el, on) {
    el.classList.toggle("hidden", !on);
  }
  function hideAll() {
    Object.values(overlays).forEach((o) => show(o, false));
  }
  function updateHud() {
    const st = getDifficulty();
    $("hud-stage").textContent = String(st.level);
    $("hud-score").textContent = String(Math.floor(score));
    $("hud-dist").textContent = String(Math.floor(distance));
    $("hud-best").textContent = String(Math.floor(best));
    $("goal-fill").style.width = `${Math.min(100, st.meter * 100)}%`;
  }
  function saveBest() {
    const s = Math.floor(score);
    if (s > best) {
      best = s;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }
  function makeClouds() {
    clouds = [];
    for (let i = 0; i < 8; i += 1) clouds.push({ x: rand(0, 900), y: rand(60, GROUND_Y - 220), w: rand(70, 150), far: i < 4 });
  }
  function banner(text) {
    bannerText = text;
    bannerT = 1.7;
  }

  /* ---------- 판 만들기 ---------- */
  function yBounds() {
    return { top: Math.max(H * 0.4, GROUND_Y - 300), bottom: GROUND_Y - 8 };
  }

  function addPlatform(x, y, w, opts = {}) {
    const p = {
      x,
      y,
      baseY: y,
      w,
      kind: opts.kind || "normal",
      phase: rand(0, 6.28),
      amp: opts.amp || 0,
      spd: opts.spd || 0,
      crumble: 0,
      falling: false,
      fallVy: 0,
      flower: Math.random() < 0.3,
      squash: 0,
    };
    platforms.push(p);
    genX = x + w;
    return p;
  }

  function addCoin(x, y, star = false) {
    coins.push({ x, y, r: star ? 14 : 10, bob: Math.random() * 6.28, star, value: star ? 50 : 10, taken: false });
  }

  // 점프 궤적을 따라 코인을 놓는다 — 어디서 뛰면 되는지 알려 주는 안내
  function coinArc(fromX, fromY, speed, v0 = JUMP_V, landDy = 0, count = 5) {
    const T = airTime(landDy, v0);
    for (let i = 1; i <= count; i += 1) {
      const t = (T * i) / (count + 1);
      addCoin(fromX + speed * t, fromY - 30 + v0 * t + 0.5 * GRAVITY * t * t);
    }
  }

  function nextSpot(prev, st, opts = {}) {
    const b = yBounds();
    const dy0 = opts.dy != null ? opts.dy : rand(-st.upMax, st.downMax * 0.55);
    const y = clamp(prev.baseY + dy0, b.top, b.bottom);
    const dy = y - prev.baseY - (prev.amp || 0); // 움직이는 발판이면 가장 나쁜 경우로
    const margin = (opts.amp || 0) * 1.1;
    const T = airTime(dy - margin, opts.v0 || JUMP_V);
    const reach = st.speed * T;
    const frac = rand(opts.minK != null ? opts.minK : Math.max(0.28, st.comfort - 0.36), opts.maxK != null ? opts.maxK : st.comfort);
    const gap = clamp(reach * frac, 34, reach * 0.92);
    return { x: prev.x + prev.w + gap, y, gap, T };
  }

  function addFlowers(p) {
    // 작은 꽃 · 새싹은 그리기에서 처리 (p.flower)
    return p;
  }

  function chunkPlain(prev, st) {
    const s = nextSpot(prev, st);
    const w = rand(st.wMin, st.wMax);
    if (Math.random() < st.coinRate) coinArc(prev.x + prev.w - st.speed * 0.08, prev.baseY, st.speed, JUMP_V, s.y - prev.baseY, 4);
    const p = addPlatform(s.x, s.y, w);
    if (Math.random() < 0.45) {
      const n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i += 1) addCoin(p.x + w * 0.25 + (i * w * 0.5) / Math.max(1, n - 1), p.y - 30);
    }
    return p;
  }

  function chunkBridge(prev, st) {
    // 작은 발판을 톡톡
    trigger(prev.x + prev.w + 50, "하늘 다리!");
    let p = prev;
    const n = 3 + ((st.rawLevel / 12) | 0);
    for (let i = 0; i < Math.min(n, 5); i += 1) {
      const s = nextSpot(p, st, { dy: (i % 2 ? 1 : -1) * rand(8, 22), minK: 0.34, maxK: Math.min(0.62, st.comfort) });
      p = addPlatform(s.x, s.y, Math.max(64, st.speed * 0.3));
      addCoin(p.x + p.w / 2, p.y - 30);
    }
    return chunkWide(p, st);
  }

  function chunkWide(prev, st, k = 1.5) {
    const s = nextSpot(prev, st, { maxK: Math.min(0.62, st.comfort), dy: rand(-30, 40) });
    return addPlatform(s.x, s.y, Math.max(st.wMax * k, st.speed * 0.8));
  }

  function chunkSpring(prev, st) {
    trigger(prev.x + prev.w + 40, "스프링!");
    const s0 = nextSpot(prev, st, { dy: rand(0, 30), maxK: 0.6 });
    const pad = addPlatform(s0.x, s0.y, Math.max(110, st.speed * 0.42), { kind: "spring" });
    const b = yBounds();
    const y = clamp(pad.baseY + rand(-60, 30), b.top, b.bottom);
    const D = st.speed * airTime(y - pad.baseY, SPRING_V);
    coinArc(pad.x + pad.w * 0.5, pad.baseY, st.speed, SPRING_V, y - pad.baseY, 7);
    // 스프링 판 어디를 밟아도(앞끝 ~ 뒤끝) 다음 발판 위에 내려앉는다
    const x = pad.x + D - rand(26, 44);
    return addPlatform(Math.max(pad.x + pad.w + 40, x), y, pad.w + rand(90, 170));
  }

  function chunkSpike(prev, st) {
    trigger(prev.x + prev.w + 20, "가시 주의!");
    const s = nextSpot(prev, st, { maxK: Math.min(0.66, st.comfort) });
    const count = st.rawLevel >= 8 && Math.random() < 0.5 ? 2 : 1;
    const land = st.speed * 0.55 + 40; // 내려앉아 보고 뛸 여유
    const between = st.speed * 0.92 + 36;
    const w = land + count * between + 50;
    const p = addPlatform(s.x, s.y, w);
    for (let i = 0; i < count; i += 1) {
      const sx = p.x + land + i * between + 8;
      spikes.push({ x: sx, y: p.y, w: 26, h: 24 });
      // 넘는 궤적의 코인
      coinArc(sx + 13 - (st.speed * airTime(0)) / 2, p.y, st.speed, JUMP_V, 0, 3);
    }
    return p;
  }

  function chunkBirds(prev, st) {
    trigger(prev.x + prev.w + 20, "새떼 주의! 뛰지 말고 지나가요");
    const s = nextSpot(prev, st, { dy: rand(-10, 30), maxK: Math.min(0.62, st.comfort) });
    const w = Math.max(300, st.speed * 1.5);
    const p = addPlatform(s.x, s.y, w);
    const n = st.rawLevel > 10 ? 2 : 1;
    for (let i = 0; i < n; i += 1) {
      const vx = rand(46, 84);
      // 플레이어와 발판 중간쯤에서 마주치도록 x 를 맞춘다
      const meet = p.x + w * (0.42 + i * 0.26);
      const lead = (W - PLAYER_X + 60) / (st.speed + vx);
      const bx = meet + vx * lead;
      birds.push({ x: bx, y: p.y - 92, baseY: p.y - 92, w: 34, h: 22, vx: -vx, flap: rand(0, 6), active: false, warned: false });
    }
    return p;
  }

  function chunkMove(prev, st) {
    trigger(prev.x + prev.w + 20, "흔들 구름!");
    let p = prev;
    for (let i = 0; i < 2; i += 1) {
      const amp = rand(14, 26);
      const s = nextSpot(p, st, { amp, dy: rand(-24, 24), maxK: Math.min(0.68, st.comfort) });
      p = addPlatform(s.x, s.y, Math.max(100, rand(st.wMin, st.wMax)), { kind: "move", amp, spd: rand(1.5, 2.4) });
      addCoin(p.x + p.w / 2, p.baseY - 34);
    }
    return p;
  }

  function chunkCrumble(prev, st) {
    trigger(prev.x + prev.w + 20, "무너지는 발판! 얼른 뛰어요");
    let p = prev;
    for (let i = 0; i < 3; i += 1) {
      const s = nextSpot(p, st, { dy: rand(-20, 26), maxK: Math.min(0.64, st.comfort) });
      p = addPlatform(s.x, s.y, Math.max(84, st.speed * 0.4), { kind: "crumble" });
      addCoin(p.x + p.w / 2, p.y - 30);
    }
    return chunkWide(p, st, 1.2);
  }

  function chunkWind(prev, st) {
    trigger(prev.x + prev.w + 10, "상승 기류! 꾹 누르면 둥실");
    const s = nextSpot(prev, st, { dy: rand(-30, 10), minK: 0.9, maxK: 0.9 });
    const gap = (s.x - (prev.x + prev.w)) * 1.3;
    const x = prev.x + prev.w + gap;
    winds.push({ x: prev.x + prev.w + 6, w: gap - 12, up: true });
    for (let i = 0; i < 4; i += 1) addCoin(prev.x + prev.w + (gap * (i + 1)) / 5, s.y - 96 - Math.sin(((i + 1) / 5) * Math.PI) * 26);
    return addPlatform(x, s.y, st.wMax * 1.2);
  }

  function chunkGift(prev, st) {
    const p = chunkWide(prev, st, 1.15);
    const kinds = ["shield", "wing", "magnet"];
    const kind = kinds[(Math.random() * kinds.length) | 0];
    items.push({ kind, x: p.x + p.w * 0.5, y: p.y - 74, bob: rand(0, 6) });
    return p;
  }

  function chunkStarArc(prev, st) {
    trigger(prev.x + prev.w + 30, "코인 아치!");
    const s = nextSpot(prev, st, { dy: rand(-30, 30), maxK: Math.min(0.7, st.comfort) });
    coinArc(prev.x + prev.w - st.speed * 0.1, prev.baseY, st.speed, JUMP_V, s.y - prev.baseY, 6);
    const p = addPlatform(s.x, s.y, rand(st.wMin, st.wMax) * 1.15);
    addCoin(p.x + p.w * 0.5, p.y - 54, true);
    return p;
  }

  function trigger(x, text) {
    triggers.push({ x, text, done: false });
  }

  function generateAhead() {
    while (genX < camX + W + 360) {
      if (platforms.length === 0) {
        addPlatform(camX + 20, GROUND_Y - 40, 320);
        continue;
      }
      const st = getDifficulty();
      const prev = platforms[platforms.length - 1];
      const L = st.rawLevel;
      if (cooldownChunks > 0 || Math.random() > st.special) {
        cooldownChunks = Math.max(0, cooldownChunks - 1);
        chunkPlain(prev, st);
        continue;
      }
      const options = [["star", 2]];
      if (L >= 1) options.push(["gift", 1.2]);
      if (L >= 2) options.push(["spike", 3], ["bridge", 2]);
      if (L >= 3) options.push(["spring", 2.2]);
      if (L >= 4) options.push(["move", 2]);
      if (L >= 5) options.push(["birds", 2]);
      if (L >= 6) options.push(["crumble", 2]);
      if (L >= 7) options.push(["wind", 1.6]);
      const sum = options.reduce((a, o) => a + o[1], 0);
      let r = Math.random() * sum;
      let kind = "star";
      for (const [k, v] of options) {
        r -= v;
        if (r <= 0) {
          kind = k;
          break;
        }
      }
      if (kind === "star") chunkStarArc(prev, st);
      else if (kind === "gift") chunkGift(prev, st);
      else if (kind === "spike") chunkSpike(prev, st);
      else if (kind === "bridge") chunkBridge(prev, st);
      else if (kind === "spring") chunkSpring(prev, st);
      else if (kind === "move") chunkMove(prev, st);
      else if (kind === "birds") chunkBirds(prev, st);
      else if (kind === "crumble") chunkCrumble(prev, st);
      else if (kind === "wind") chunkWind(prev, st);
      cooldownChunks = L < 8 ? 2 : 1;
    }
  }

  /* ---------- 효과 ---------- */
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(speed * 0.3, speed);
      const life = rand(0.35, 0.7);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life, max: life, r: rand(2, 5), color, g: 400, star: Math.random() < 0.3 });
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);
  }
  function dust(x, y, n = 6) {
    for (let i = 0; i < n; i += 1) {
      const life = rand(0.2, 0.45);
      particles.push({ x: x + rand(-10, 10), y, vx: rand(-70, 10), vy: rand(-60, -10), life, max: life, r: rand(2, 5), color: "rgba(255,250,235,0.9)", g: 200, star: false });
    }
  }
  function floatText(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.85, vy: -55 });
    if (floats.length > 16) floats.shift();
  }

  /* ---------- 시작 · 끝 ---------- */
  function resetStage() {
    score = 0;
    distance = 0;
    camX = 0;
    genX = 0;
    coinsTaken = 0;
    platforms = [];
    coins = [];
    spikes = [];
    birds = [];
    winds = [];
    items = [];
    triggers = [];
    particles = [];
    floats = [];
    flash = 0;
    shake = 0;
    coyote = 0;
    jumpBuf = 0;
    holdJump = false;
    deadTimer = 0;
    squash = 0;
    squashV = 0;
    runAnim = 0;
    bannerT = 0;
    lastLevel = 0;
    cooldownChunks = 3;
    chain = 0;
    chainT = 0;
    shieldOn = true; // 처음 한 번은 실수해도 괜찮게
    wingT = 0;
    magnetT = 0;
    invT = 0;
    airJumpUsed = false;
    noCut = false;
    deathCause = "";
    biomeFrom = 0;
    biomeTo = 0;
    biomeK = 1;
    stats.maxLevel = 1;
    stats.jumps = 0;
    stats.coins = 0;
    player.vy = 0;
    player.rot = 0;
    makeClouds();
    generateAhead();
    const p0 = platforms[0];
    player.y = p0.y - player.h;
    player.onGround = true;
    player.plat = p0;
    coyote = COYOTE;
    updateHud();
  }

  function startGame() {
    Sfx.unlock();
    hideAll();
    state = "play";
    submitted = false;
    $("rank-msg").textContent = "";
    $("submit-btn").disabled = false;
    const shareEl = $("share-rank-btn");
    if (shareEl) shareEl.hidden = true;
    resetStage();
    hintTimer = 3;
    $("hint").classList.add("show");
    banner(`1단계 · ${STAGE_NAMES[0]}`);
    last = performance.now();
    accum = 0;
    if (window.TodayGameRank && TodayGameRank.reset) TodayGameRank.reset();
  }

  function doJump() {
    const grounded = coyote > 0 || player.onGround;
    if (grounded) {
      player.vy = JUMP_V;
      player.onGround = false;
      player.plat = null;
      coyote = 0;
      jumpBuf = 0;
      squash = -0.9;
      squashV = 0;
      airJumpUsed = false;
      stats.jumps += 1;
      dust(px() + player.w / 2, player.y + player.h, 5);
      Sfx.jump();
      return true;
    }
    if (wingT > 0 && !airJumpUsed) {
      airJumpUsed = true;
      player.vy = WING_V;
      jumpBuf = 0;
      squash = -0.7;
      stats.jumps += 1;
      burst(px() + player.w / 2, player.y + player.h, "#ffffff", 10, 120);
      Sfx.airJump();
      return true;
    }
    return false;
  }

  function hurtOrDie(reason) {
    if (invT > 0) return;
    if (shieldOn) {
      shieldOn = false;
      invT = 1.1;
      flash = 0.3;
      flashCol = "160,220,255";
      shake = 6;
      burst(px() + player.w / 2, player.y + player.h / 2, "#a8e4ff", 24, 240);
      floatText(px() + player.w / 2, player.y - 18, "방패가 막았어요!", "#3a9fd0");
      Sfx.shield();
      if (reason === "fall") {
        // 떨어질 때 방패: 튕겨 올라 다시 기회
        player.vy = JUMP_V * 1.25;
        noCut = true;
        player.y = Math.min(player.y, GROUND_Y + 10);
        player.onGround = false;
        wingT = Math.max(wingT, 1.6);
        airJumpUsed = false;
        // 떨어진 자리 바로 앞 발판까지 다시 뛸 수 있게 잠깐 느리게
        floatText(px() + player.w / 2, player.y - 44, "꾹 눌러 다시 점프!", "#d0559a");
      }
      return;
    }
    kill(reason);
  }

  function kill(reason) {
    if (state !== "play") return;
    state = "dying";
    deathCause = reason;
    deadTimer = 0.95;
    shake = 10;
    flash = 0.35;
    flashCol = "255,255,255";
    burst(px() + player.w / 2, player.y + player.h / 2, "#ffc33a", 18, 220);
    burst(px() + player.w / 2, player.y + player.h / 2, "#fff3c4", 10, 160);
    player.vy = reason === "fall" ? -700 : -420;
    if (reason === "fall") player.y = Math.min(player.y, GROUND_Y + 30);
    Sfx.hit();
    saveBest();
    updateHud();
  }

  function finishDying() {
    state = "over";
    show(overlays.over, true);
    const st = getDifficulty();
    const why = deathCause === "spike" ? "가시에 찔렸어요" : deathCause === "bird" ? "새와 부딪혔어요" : "구름 아래로 떨어졌어요";
    $("over-title").textContent = deathCause === "fall" ? "앗, 떨어졌어요" : "앗, 부딪혔어요";
    $("over-detail").innerHTML = `${why}<br />${st.level}단계 ${st.name} · 점수 <b>${Math.floor(score)}</b><br />거리 ${Math.floor(distance)} · 코인 ${coinsTaken} · 최고 ${best}`;
    if (window.TodayVisit) {
      TodayVisit.compareAndShow("jump-run", Math.floor(score), true, overlays.over);
    }
    submitted = false;
    $("rank-msg").textContent = "";
    $("submit-btn").disabled = false;
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /* ---------- 걸음 ---------- */
  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i -= 1) {
      const f = floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  function update(dt) {
    time += dt;
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) $("hint").classList.remove("show");
    }
    if (flash > 0) flash -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 28);
    if (bannerT > 0) bannerT -= dt;
    // 몸 찌그러짐 (용수철)
    squashV += (-squash * 190 - squashV * 16) * dt;
    squash += squashV * dt;
    updateFx(dt);

    if (biomeK < 1) biomeK = Math.min(1, biomeK + dt / 2.4);

    if (state === "title") {
      camX += 26 * dt;
      return;
    }

    if (state === "dying") {
      deadTimer -= dt;
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      player.rot += dt * 7;
      if (deadTimer <= 0) finishDying();
      return;
    }
    if (state !== "play") return;

    const st = getDifficulty();
    invT = Math.max(0, invT - dt);
    wingT = Math.max(0, wingT - dt);
    magnetT = Math.max(0, magnetT - dt);
    if (chainT > 0) {
      chainT -= dt;
      if (chainT <= 0) chain = 0;
    }
    if (blinkT > -0.12) blinkT -= dt;
    else blinkT = rand(1.8, 4);

    if (jumpBuf > 0) {
      jumpBuf -= dt;
      doJump();
    }

    const speed = st.speed;
    camX += speed * dt;
    runAnim += dt * (speed / 165);
    const distGain = speed * dt * 0.55;
    distance += distGain;
    score += distGain * 0.35;

    // 단계가 오르면
    const lv = st.rawLevel;
    if (lv !== lastLevel) {
      lastLevel = lv;
      stats.maxLevel = Math.max(stats.maxLevel, lv + 1);
      banner(`${lv + 1}단계 · ${st.name}`);
      Sfx.level();
      const nb = Math.floor(lv / BIOME_LEVELS) % BIOMES.length;
      if (nb !== biomeTo) {
        biomeFrom = biomeTo;
        biomeTo = nb;
        biomeK = 0;
      }
    }

    for (const p of platforms) {
      if (p.kind === "move" && !p.falling) {
        const before = p.y;
        p.phase += dt * p.spd;
        p.y = p.baseY + Math.sin(p.phase) * p.amp;
        if (player.plat === p) player.y += p.y - before;
      }
      if (p.falling) {
        p.fallVy += GRAVITY * 0.55 * dt;
        p.y += p.fallVy * dt;
      } else if (p.kind === "crumble" && p.crumble > 0) {
        p.crumble -= dt;
        if (p.crumble <= 0) {
          p.falling = true;
          p.fallVy = 40;
          burst(p.x + p.w / 2, p.y, "#e8d5b8", 10, 140);
          Sfx.crumble();
          if (player.plat === p) {
            player.plat = null;
            player.onGround = false;
          }
        }
      }
      if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 5);
    }

    for (const b of birds) {
      if (!b.active && b.x - camX < W + 60) b.active = true;
      if (b.active) {
        b.flap += dt * 10;
        b.x += b.vx * dt;
        b.y = b.baseY + Math.sin(b.flap * 0.45) * 7;
      }
    }

    // 지나간 것 치우기
    const left = camX - 90;
    platforms = platforms.filter((p) => p.x + p.w > left && p.y < H + 120);
    coins = coins.filter((c) => !c.taken && c.x > left);
    spikes = spikes.filter((s) => s.x > left);
    birds = birds.filter((b) => b.x > left);
    winds = winds.filter((w) => w.x + w.w > left);
    items = items.filter((c) => !c.taken && c.x > left);
    generateAhead();
    for (const t of triggers) {
      if (!t.done && t.x - camX < W - 40) {
        t.done = true;
        banner(t.text);
      }
    }
    triggers = triggers.filter((t) => !t.done);

    const wasGround = player.onGround;
    const midX = px() + player.w * 0.5;

    let g = GRAVITY;
    for (const w of winds) {
      if (midX > w.x && midX < w.x + w.w) {
        g = holdJump ? GRAVITY - 1420 : GRAVITY - 820;
        if (Math.random() < dt * 30) particles.push({ x: midX + rand(-20, 20), y: player.y + 50, vx: 0, vy: -180, life: 0.4, max: 0.4, r: 2, color: "rgba(255,255,255,0.8)", g: 0, star: false });
      }
    }
    player.vy += g * dt;
    // 손을 떼면 점프가 짧아진다
    if (noCut && player.vy >= 0) noCut = false;
    if (!holdJump && !noCut && player.vy < -220) player.vy = lerp(player.vy, -220, 1 - Math.pow(0.0001, dt));

    let nextY = player.y + player.vy * dt;
    player.onGround = false;

    const feetL = px() + 3;
    const feetR = px() + player.w - 3;
    if (player.vy >= 0) {
      for (const p of platforms) {
        if (p.falling) continue;
        const prevBottom = player.y + player.h;
        const nextBottom = nextY + player.h;
        if (feetR > p.x + 2 && feetL < p.x + p.w - 2 && prevBottom <= p.y + 8 && nextBottom >= p.y) {
          nextY = p.y - player.h;
          if (p.kind === "spring") {
            player.vy = SPRING_V;
            noCut = true;
            player.plat = null;
            p.squash = 1;
            squash = -1;
            airJumpUsed = false;
            burst(midX, p.y, "#7dffc2", 14, 200);
            floatText(midX, p.y - 18, "콩!", "#1f9f70");
            shake = Math.max(shake, 4);
            Sfx.spring();
          } else {
            player.onGround = true;
            player.plat = p;
            player.vy = 0;
            airJumpUsed = false;
            if (!wasGround) {
              squash = 1;
              dust(midX, p.y, 6);
              Sfx.land();
            }
            if (p.kind === "crumble" && p.crumble <= 0) p.crumble = 0.72;
          }
          break;
        }
      }
    } else {
      player.plat = null;
    }
    if (!player.onGround) player.plat = null;
    player.y = nextY;

    if (player.onGround) coyote = COYOTE;
    else coyote = Math.max(0, coyote - dt);

    const wantRot = player.onGround ? 0 : clamp(player.vy / 1600, -0.3, 0.42);
    player.rot = lerp(player.rot, wantRot, 1 - Math.pow(0.0005, dt));

    if (player.onGround && Math.sin(runAnim * 16) > 0.97 && Math.random() < 0.5) dust(px() + 6, player.y + player.h, 1);

    // 코인
    for (const c of coins) {
      if (c.taken) continue;
      c.bob += dt * 4;
      if (magnetT > 0) {
        const dx = midX - c.x;
        const dy = player.y + player.h / 2 - c.y;
        const d = Math.hypot(dx, dy);
        if (d < 190) {
          const pull = 460 * dt;
          c.x += (dx / d) * pull;
          c.y += (dy / d) * pull;
        }
      }
      const hitR = c.star ? c.r * 1.2 : c.r + 3;
      if (aabb(px() + 2, player.y + 2, player.w - 4, player.h - 4, c.x - hitR, c.y - hitR, hitR * 2, hitR * 2)) {
        c.taken = true;
        chain = chainT > 0 ? chain + 1 : 0;
        chainT = 0.95;
        const val = c.value + Math.floor(chain / 3) * 2;
        score += val;
        coinsTaken += 1;
        stats.coins += 1;
        burst(c.x, c.y, c.star ? "#fff6a0" : "#ffd76a", c.star ? 18 : 8, c.star ? 240 : 150);
        floatText(c.x, c.y - 10, c.star ? `+${val}★` : `+${val}`, c.star ? "#ff8a3a" : "#e8a020");
        if (c.star) {
          flash = Math.max(flash, 0.18);
          flashCol = "255,250,210";
          Sfx.star();
        } else Sfx.coin(chain);
      }
    }
    coins = coins.filter((c) => !c.taken);

    // 아이템
    for (const it of items) {
      it.bob += dt * 3.4;
      if (!it.taken && aabb(px(), player.y, player.w, player.h, it.x - 18, it.y - 18, 36, 36)) {
        it.taken = true;
        Sfx.item();
        burst(it.x, it.y, "#ffffff", 16, 200);
        if (it.kind === "shield") {
          shieldOn = true;
          floatText(it.x, it.y - 22, "방패!", "#3a9fd0");
        } else if (it.kind === "wing") {
          wingT = 12;
          floatText(it.x, it.y - 22, "날개! 공중에서 한 번 더", "#d0559a");
        } else {
          magnetT = 10;
          floatText(it.x, it.y - 22, "자석!", "#d04a4a");
        }
      }
    }

    // 가시 · 새
    for (const s of spikes) {
      if (aabb(px() + 7, player.y + 12, player.w - 14, player.h - 12, s.x + 3, s.y - s.h + 3, s.w - 6, s.h - 3)) {
        hurtOrDie("spike");
        if (state !== "play") return;
      }
    }
    for (const b of birds) {
      if (aabb(px() + 5, player.y + 5, player.w - 10, player.h - 9, b.x + 3, b.y + 2, b.w - 6, b.h - 4)) {
        hurtOrDie("bird");
        if (state !== "play") return;
      }
    }

    if (player.y > GROUND_Y + 50) {
      hurtOrDie("fall");
      if (state !== "play") return;
    }

    updateHud();
  }

  /* ---------- 그리기 ---------- */
  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = hex(a);
    const B = hex(b);
    return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
  }
  function loopDraw(img, top, hh, offset, alpha) {
    const off = mod(offset, LOOP);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, -off, top, LOOP, hh);
    if (off > LOOP - W - 2) ctx.drawImage(img, LOOP - off - 0.6, top, LOOP, hh);
    ctx.globalAlpha = 1;
  }

  function drawSkyBodies(b, alpha) {
    const s = b.sun;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 78);
    g.addColorStop(0, `rgba(${s.glow},0.85)`);
    g.addColorStop(1, `rgba(${s.glow},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.c;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 25, 0, Math.PI * 2);
    ctx.fill();
    if (b.stars > 0.5) {
      // 달 그림자
      ctx.fillStyle = "rgba(170,175,220,0.5)";
      ctx.beginPath();
      ctx.arc(s.x - 8, s.y - 6, 5, 0, Math.PI * 2);
      ctx.arc(s.x + 7, s.y + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.stars > 0) {
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 40; i += 1) {
        const x = (i * 97) % W;
        const y = ((i * 53) % (GROUND_Y * 0.62)) + 10;
        ctx.globalAlpha = alpha * b.stars * (0.35 + Math.sin(time * 2 + i) * 0.3);
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawAurora(alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.34;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i += 1) {
      const y = 90 + i * 34;
      const g = ctx.createLinearGradient(0, y - 20, 0, y + 90);
      g.addColorStop(0, "rgba(120,255,200,0)");
      g.addColorStop(0.5, i === 1 ? "rgba(170,140,255,0.8)" : "rgba(120,255,200,0.8)");
      g.addColorStop(1, "rgba(120,255,200,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.02 + time * 0.5 + i) * 18);
      ctx.lineTo(W, y + 110);
      ctx.lineTo(0, y + 110);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBackground() {
    const A = BIOMES[biomeFrom];
    const B = BIOMES[biomeTo];
    const k = biomeK;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, mix(A.sky[0], B.sky[0], k));
    g.addColorStop(0.55, mix(A.sky[1], B.sky[1], k));
    g.addColorStop(1, mix(A.sky[2], B.sky[2], k));
    ctx.fillStyle = g;
    ctx.fillRect(-12, -12, W + 24, H + 24);
    if (k < 1) drawSkyBodies(A, 1 - k);
    drawSkyBodies(B, k);
    if (biomeTo === 4) drawAurora(k);
    else if (biomeFrom === 4 && k < 1) drawAurora(1 - k);

    const cloudAlpha = lerp(A.cloud, B.cloud, k);
    if (images.cloud) {
      for (const c of clouds) {
        const q = mod(c.x - camX * (c.far ? 0.08 : 0.22), W + 320) - 160;
        ctx.globalAlpha = (c.far ? 0.55 : 0.9) * cloudAlpha;
        const h = c.w * 0.52;
        ctx.drawImage(images.cloud, q - c.w / 2, c.y - h / 2, c.w, h);
      }
      ctx.globalAlpha = 1;
    }

    const back = bakeBack(biomeTo);
    const backA = k < 1 ? bakeBack(biomeFrom) : null;
    if (backA) {
      loopDraw(backA.hills, backA.hillsTop, backA.hillsH, camX * 0.12, 1);
      loopDraw(backA.near, backA.hillsTop, backA.hillsH, camX * 0.24, 1);
    }
    loopDraw(back.hills, back.hillsTop, back.hillsH, camX * 0.12, k);
    loopDraw(back.near, back.hillsTop, back.hillsH, camX * 0.24, k);
    return { back, backA, k };
  }

  function drawSea(info) {
    const { back, backA, k } = info;
    const top = GROUND_Y - 6 + Math.sin(time * 0.9) * 2;
    if (backA) loopDraw(backA.sea, top, backA.seaH, camX * 0.72 + time * 8, 1);
    loopDraw(back.sea, top, back.seaH, camX * 0.72 + time * 8, k);
  }

  function drawLeaf(x, y, scale2, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale2, scale2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-4, -2, 5, 3, -0.6, 0, Math.PI * 2);
    ctx.ellipse(4, -3, 5, 3, 0.5, 0, Math.PI * 2);
    ctx.ellipse(0, -8, 3.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlatform(p) {
    const x = p.x - camX;
    if (x > W + 30 || x + p.w < -30) return;
    const skin = platformSkin(biomeTo);
    const y0 = p.y + (p.kind === "crumble" && p.crumble > 0 ? Math.sin(time * 70) * 1.4 : 0);
    const xs = p.kind === "crumble" && p.crumble > 0 ? Math.sin(time * 90) * 1.6 : 0;
    const hh = 46;
    const topOff = hh * 0.18;
    const yTop = y0 - topOff + p.squash * 6;
    ctx.save();
    if (p.falling) ctx.globalAlpha = 0.6;
    if (skin) {
      const iw = skin.width;
      const ih = skin.height;
      const capS = 118;
      const capD = (capS / ih) * hh;
      const dx = x - 6 + xs;
      const dw = p.w + 12;
      const cap = Math.min(capD, dw / 2);
      const capSrc = (cap / hh) * ih;
      ctx.drawImage(skin, 0, 0, capSrc, ih, dx, yTop, cap, hh);
      const midW = dw - cap * 2;
      if (midW > 0) {
        const tile = iw - capS * 2;
        const tileD = (tile / ih) * hh;
        let done = 0;
        while (done < midW - 0.1) {
          const d = Math.min(tileD, midW - done);
          ctx.drawImage(skin, capS, 0, (d / tileD) * tile, ih, dx + cap + done - 0.4, yTop, d + 0.8, hh);
          done += d;
        }
      }
      ctx.drawImage(skin, iw - capSrc, 0, capSrc, ih, dx + dw - cap, yTop, cap, hh);
    } else {
      ctx.fillStyle = "#7bd86f";
      roundRect(x, y0, p.w, 30, 12);
      ctx.fill();
    }
    if (p.kind === "spring") {
      // 스프링 패드
      const sq = p.squash * 7;
      const cx = x + p.w / 2;
      const cy = y0 + 1;
      ctx.strokeStyle = "#8a97a8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const yy = cy - i * (2.6 - sq * 0.05) - 1;
        ctx.moveTo(cx - 16, yy);
        ctx.lineTo(cx + 16, yy - 1.5);
      }
      ctx.stroke();
      ctx.fillStyle = "#ff5f8f";
      roundRect(cx - 26, cy - 15 + sq, 52, 8, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      roundRect(cx - 20, cy - 14 + sq, 22, 3, 2);
      ctx.fill();
    } else if (p.kind === "move") {
      // 작은 날개 두 개
      const fl = Math.sin(time * 18) * 3;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      for (const [wx, sgn] of [
        [x - 8, -1],
        [x + p.w + 8, 1],
      ]) {
        ctx.beginPath();
        ctx.ellipse(wx + sgn * 6, y0 + 8 + fl * sgn * 0.3, 12, 6 + fl * 0.5, sgn * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === "crumble") {
      // 금
      ctx.strokeStyle = "rgba(70,40,20,0.65)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      const n = Math.floor(p.w / 34);
      for (let i = 1; i <= n; i += 1) {
        const q = x + (p.w * i) / (n + 1);
        ctx.beginPath();
        ctx.moveTo(q, y0 - 1);
        ctx.lineTo(q + 4, y0 + 10);
        ctx.lineTo(q - 3, y0 + 18);
        ctx.lineTo(q + 3, y0 + 28);
        ctx.stroke();
      }
    } else if (p.flower) {
      const fx = x + p.w * 0.55;
      const fy = y0 - 5;
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * 4.5, fy + Math.sin(a) * 4.5, 3.5, 2.6, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpike(s) {
    const x = s.x - camX;
    if (x > W + 30 || x < -50) return;
    const im = images.spike;
    if (im) {
      const ih = s.h * 1.7;
      const iw = (ih * im.naturalWidth) / im.naturalHeight;
      const wob = Math.sin(time * 4 + s.x) * 0.04;
      ctx.save();
      ctx.translate(x + s.w / 2, s.y + 3);
      ctx.rotate(wob);
      ctx.drawImage(im, -iw / 2, -ih, iw, ih);
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#5a7a4a";
    ctx.beginPath();
    ctx.moveTo(x, s.y);
    ctx.lineTo(x + s.w / 2, s.y - s.h);
    ctx.lineTo(x + s.w, s.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawCoin(c) {
    const x = c.x - camX;
    if (x > W + 30 || x < -30) return;
    const y = c.y + Math.sin(c.bob) * 3;
    ctx.save();
    ctx.translate(x, y);
    const turn = c.star ? 1 : Math.abs(Math.cos(c.bob * 0.7)) * 0.45 + 0.55;
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, c.r * 2.2);
    glow.addColorStop(0, c.star ? "rgba(255,170,70,0.5)" : "rgba(255,225,110,0.4)");
    glow.addColorStop(1, "rgba(255,225,110,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, c.r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.scale(turn * (c.star ? 1.25 : 1), c.star ? 1.25 : 1);
    if (images.coin) {
      const s = c.r * 2.6;
      ctx.drawImage(images.coin, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = "#ffd76a";
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (c.star) {
      ctx.fillStyle = "#ff8a3a";
      ctx.font = '12px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("★", 0, 4);
    }
    ctx.restore();
  }

  function drawBird(b) {
    const q = b.x - camX;
    if (q > W + 40 || q < -50) return;
    ctx.save();
    ctx.translate(q + b.w / 2, b.y + b.h / 2);
    ctx.scale(-1, 1);
    const wing = Math.sin(b.flap) * 0.5;
    ctx.fillStyle = "#566b82";
    ctx.beginPath();
    ctx.ellipse(0, 1, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7f95ad";
    ctx.beginPath();
    ctx.ellipse(-3, -3 + wing * 8, 12, 5, -0.4 + wing, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9a4a";
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(21, 3);
    ctx.lineTo(13, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(7, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(8, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBirdWarnings() {
    for (const b of birds) {
      const q = b.x - camX;
      if (q > W - 6 && q < W + 240) {
        const y = b.baseY + 8;
        ctx.save();
        ctx.fillStyle = "#ffd23f";
        ctx.strokeStyle = "#5a3a10";
        ctx.lineWidth = 2;
        const pulse = 1 + Math.sin(time * 14) * 0.08;
        ctx.translate(W - 20, y);
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#5a3a10";
        ctx.font = '18px "Jua", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText("!", 0, 6);
        ctx.restore();
      }
    }
  }

  function drawWind(w) {
    const x = w.x - camX;
    if (x > W + 20 || x + w.w < -20) return;
    ctx.save();
    const g = ctx.createLinearGradient(0, 110, 0, GROUND_Y);
    g.addColorStop(0, "rgba(160,235,255,0)");
    g.addColorStop(1, "rgba(160,235,255,0.42)");
    ctx.fillStyle = g;
    roundRect(x, 110, w.w, GROUND_Y - 110, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i += 1) {
      const qx = x + 12 + (i * (w.w - 24)) / 5;
      const drift = mod(time * 170 + i * 70, GROUND_Y - 170);
      const y = GROUND_Y - 30 - drift;
      ctx.beginPath();
      ctx.moveTo(qx, y);
      ctx.quadraticCurveTo(qx + 5, y - 15, qx, y - 30);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawItem(it) {
    const x = it.x - camX;
    if (x > W + 30 || x < -30) return;
    const y = it.y + Math.sin(it.bob) * 5;
    ctx.save();
    ctx.translate(x, y);
    const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
    gl.addColorStop(0, "rgba(255,255,255,0.75)");
    gl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = it.kind === "shield" ? "#59b8ff" : it.kind === "wing" ? "#ff8fc2" : "#ff6a6a";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    if (it.kind === "shield") {
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(9, -6);
      ctx.quadraticCurveTo(9, 6, 0, 11);
      ctx.quadraticCurveTo(-9, 6, -9, -6);
      ctx.closePath();
      ctx.fill();
    } else if (it.kind === "wing") {
      ctx.beginPath();
      ctx.ellipse(-5, -2, 9, 5, -0.6, 0, Math.PI * 2);
      ctx.ellipse(5, -2, 9, 5, 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, -1, 7, Math.PI, 0);
      ctx.moveTo(-7, -1);
      ctx.lineTo(-7, 6);
      ctx.moveTo(7, -1);
      ctx.lineTo(7, 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHero(cx, feetY) {
    const im = images.hero;
    if (!im) return;
    const aspect = im.naturalWidth / im.naturalHeight;
    const baseH = 66;
    const sq = clamp(squash, -1, 1);
    const sy = 1 - sq * 0.2;
    const sx = 1 + sq * 0.2;
    const h = baseH * sy;
    const w = baseH * aspect * sx;
    ctx.save();
    ctx.translate(cx, feetY + 3);
    ctx.rotate(player.rot);
    const run = player.onGround ? Math.sin(runAnim * 16) : 0;
    const bob = player.onGround ? Math.abs(run) * 2.2 : 0;
    ctx.translate(0, -bob);
    const iw = im.naturalWidth;
    const ih = im.naturalHeight;
    // 다리만 앞뒤로 (아래 22%)
    const legY = 0.78;
    const legOff = run * 4.5;
    ctx.drawImage(im, 0, legY * ih, iw * 0.5, (1 - legY) * ih, -w / 2 - legOff, -h + legY * h, w * 0.5, (1 - legY) * h);
    ctx.drawImage(im, iw * 0.5, legY * ih, iw * 0.5, (1 - legY) * ih, legOff, -h + legY * h, w * 0.5, (1 - legY) * h);
    ctx.drawImage(im, 0, 0, iw, legY * ih + 1, -w / 2, -h, w, legY * h + 0.5);
    // 눈 깜빡
    if (blinkT < 0) {
      ctx.fillStyle = "#ffcb28";
      ctx.beginPath();
      ctx.ellipse(-w / 2 + w * 0.69, -h + h * 0.335, w * 0.105, h * 0.085, 0, 0, Math.PI * 2);
      ctx.ellipse(-w / 2 + w * 0.905, -h + h * 0.335, w * 0.065, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (window.TodayFace) TodayFace.drawHead(ctx, -w / 2 + w * 0.63, -h + h * 0.3, w * 0.3);
    ctx.restore();
  }

  function drawPlayer() {
    const cx = PLAYER_X + player.w / 2;
    const feet = player.y + player.h;
    // 그림자: 아래 발판에
    if (state === "play") {
      let under = null;
      for (const p of platforms) {
        const x = p.x - camX;
        if (cx > x && cx < x + p.w && p.y >= feet - 2 && !p.falling && (!under || p.y < under.y)) under = p;
      }
      if (under) {
        const dist = under.y - feet;
        ctx.fillStyle = `rgba(30,50,60,${Math.max(0.05, 0.28 - dist / 700)})`;
        ctx.beginPath();
        ctx.ellipse(cx, under.y + 1, Math.max(8, 20 - dist / 18), 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (wingT > 0) {
      const fl = Math.sin(time * 26) * 0.5;
      const fade = wingT < 2 && Math.floor(wingT * 8) % 2 ? 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(cx - 14, feet - 34);
      ctx.rotate(-0.8 + fl);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#ffb0d4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-14, 0, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (invT > 0 && Math.floor(invT * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    drawHero(cx, feet);
    ctx.globalAlpha = 1;
    if (shieldOn) {
      const r = 42 + Math.sin(time * 6) * 2;
      const g = ctx.createRadialGradient(cx, feet - 30, r * 0.55, cx, feet - 30, r);
      g.addColorStop(0, "rgba(120,210,255,0)");
      g.addColorStop(0.85, "rgba(120,210,255,0.28)");
      g.addColorStop(1, "rgba(200,240,255,0.8)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, feet - 30, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFx() {
    particles.forEach((p) => {
      const x = p.x - camX;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      if (p.star) {
        const s = p.r * 1.4;
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const r = i % 2 ? s * 0.35 : s;
          const a = (i * Math.PI) / 4;
          ctx.lineTo(x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life / 0.85);
      ctx.font = '16px "Jua", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(f.text, f.x - camX, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - camX, f.y);
    });
    ctx.globalAlpha = 1;
  }

  function drawStatus() {
    const pills = [];
    if (shieldOn) pills.push(["방패", "#59b8ff", 1]);
    if (wingT > 0) pills.push([`날개 ${Math.ceil(wingT)}`, "#ff8fc2", wingT / 12]);
    if (magnetT > 0) pills.push([`자석 ${Math.ceil(magnetT)}`, "#ff6a6a", magnetT / 10]);
    let x = W - 12;
    const y = 88;
    ctx.font = '13px "Jua", sans-serif';
    for (const [text, col] of pills) {
      const tw = ctx.measureText(text).width + 18;
      x -= tw;
      ctx.fillStyle = col;
      roundRect(x, y, tw, 22, 11);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(text, x + tw / 2, y + 16);
      x -= 6;
    }
  }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    const info = drawBackground();
    winds.forEach(drawWind);
    drawSea(info);
    if (state === "title") {
      ctx.restore();
      return;
    }
    platforms.forEach(drawPlatform);
    spikes.forEach(drawSpike);
    items.forEach(drawItem);
    coins.forEach(drawCoin);
    birds.forEach(drawBird);
    drawPlayer();
    drawFx();
    drawBirdWarnings();
    drawStatus();

    if (flash > 0) {
      ctx.fillStyle = `rgba(${flashCol},${Math.min(0.6, flash * 0.6)})`;
      ctx.fillRect(-12, -12, W + 24, H + 24);
    }

    if (state === "play" && bannerT > 0) {
      const a = Math.min(1, bannerT * 2.2, (1.7 - bannerT) * 6);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '20px "Jua", sans-serif';
      const tw = ctx.measureText(bannerText).width + 34;
      const y = H * 0.17 + 6;
      ctx.fillStyle = "rgba(30,50,90,0.66)";
      roundRect(W / 2 - tw / 2, y, tw, 38, 18);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(bannerText, W / 2, y + 26);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function loop(t) {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000 || 0));
    last = t;
    if (state !== "paused") {
      accum += dt;
      let guard = 0;
      while (accum >= STEP && guard < 12) {
        update(STEP);
        accum -= STEP;
        guard += 1;
      }
      if (accum > 0.1) accum = 0;
    }
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------- 조작 ---------- */
  function onJumpDown() {
    Sfx.unlock();
    if (state === "over" || state === "paused" || state === "title") return;
    holdJump = true;
    if (state === "play" && !doJump()) jumpBuf = JUMP_BUF; // 착지 직전에 누른 것만 기억
  }
  function onJumpUp() {
    holdJump = false;
  }

  $("start-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });
  $("retry-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });

  let lastRank = { rankDay: null, rankWeek: null };
  const shareBtn = $("share-rank-btn");

  $("rank-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitted) return;
    const name = nameInput.value.trim();
    if (name.length < 2 || name.length > 8) {
      $("rank-msg").textContent = "이름은 2~8자로 적어 주세요";
      return;
    }
    localStorage.setItem(NAME_KEY, name);
    const btn = $("submit-btn");
    btn.disabled = true;
    $("rank-msg").textContent = "등록 중…";
    if (!window.TodayScores) {
      $("rank-msg").textContent = "랭킹 모듈을 불러오지 못했어요";
      btn.disabled = false;
      return;
    }
    const res = await window.TodayScores.submitScore("jump-run", name, Math.floor(score));
    if (res.ok) {
      submitted = true;
      lastRank = { rankDay: res.rankDay || res.rank, rankWeek: res.rankWeek };
      $("rank-msg").textContent = window.TodayScores.formatRankMessage
        ? window.TodayScores.formatRankMessage(res)
        : res.rank
          ? `오늘 ${res.rank}위에 등록됐어요!`
          : "등록 완료!";
      if (shareBtn) shareBtn.hidden = false;
      if (window.TodayGameRank && TodayGameRank.afterSubmit) {
        await TodayGameRank.afterSubmit({
          gameId: "jump-run",
          gameTitle: "콩콩 점프",
          name,
          score: Math.floor(score),
          rankDay: lastRank.rankDay,
          label: `${Math.floor(score).toLocaleString("ko-KR")}점`,
        });
      }
    } else {
      $("rank-msg").textContent = "등록 실패 · 다시 시도해 주세요";
      btn.disabled = false;
    }
  });

  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim() || "나";
      const result = await window.TodayScores.shareRank({
        gameTitle: "콩콩 점프",
        name,
        score: Math.floor(score),
        rankDay: lastRank.rankDay,
        rankWeek: lastRank.rankWeek,
        url: "https://www.todaygame.co.kr/games/jump-run/",
      });
      const msg = $("rank-msg");
      msg.textContent = window.TodayScores.formatShareResult
        ? window.TodayScores.formatShareResult(result)
        : result.mode === "copy"
          ? "복사됨! 카톡·SNS에 붙여넣기 하세요"
          : result.error === "cancel"
            ? "공유를 취소했어요"
            : !result.ok
              ? "공유에 실패했어요"
              : "";
      if (result.mode === "share") msg.textContent = "";
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (state === "title") startGame();
      else onJumpDown();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      onJumpUp();
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onJumpDown();
  });
  window.addEventListener("pointerup", onJumpUp);
  window.addEventListener("pointercancel", onJumpUp);

  $("hud-best").textContent = String(best);

  window.addEventListener("resize", resize);
  resize();
  makeClouds();
  loadAssets().then(() => {
    last = performance.now();
    requestAnimationFrame(loop);
    if (window.JumpRun) window.JumpRun.ready = true;
  });

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        holdJump = false;
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        last = performance.now();
        accum = 0;
        return true;
      },
    });
  }

  // 자동 점검용
  window.JumpRun = {
    ready: false,
    STEP,
    PLAYER_X,
    JUMP_V,
    GRAVITY,
    airTime,
    apex,
    update,
    start: startGame,
    down: onJumpDown,
    up: onJumpUp,
    difficulty: getDifficulty,
    get state() {
      return state;
    },
    get player() {
      return player;
    },
    get camX() {
      return camX;
    },
    get platforms() {
      return platforms;
    },
    get coins() {
      return coins;
    },
    get spikes() {
      return spikes;
    },
    get birds() {
      return birds;
    },
    get winds() {
      return winds;
    },
    get items() {
      return items;
    },
    get distance() {
      return distance;
    },
    set distance(v) {
      distance = v;
    },
    get score() {
      return score;
    },
    get cause() {
      return deathCause;
    },
    get genX() {
      return genX;
    },
    get shield() {
      return shieldOn;
    },
    stats,
    H: () => H,
    ground: () => GROUND_Y,
  };
})();
