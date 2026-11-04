/* 공룡 헌터 — 그림은 그대로 두고 움직임 · 조작 · 타격감을 새로 만든 판
 *
 * - 고정 걸음(1/120초). 그리기는 화면 픽셀로 (흐림 없음).
 * - 한 장짜리 그림을 세로 · 가로 띠로 잘라 다리 · 꼬리 · 날개를 움직인다 (rig).
 * - 휴대폰: 발사를 누르고 있으면 가까운 공룡을 자동 조준. 화면을 누르면 그쪽으로 직접 조준.
 * - 구역 4개 + 구역마다 보스, 다 돌면 더 강해져 다시 돈다 (무한 · 랭킹).
 */
(() => {
  "use strict";

  const W = 390;
  let H = 700;
  let GROUND = H - 130;
  const LOOP = 780;
  const STEP = 1 / 120;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const mod = (v, m) => ((v % m) + m) % m;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 데이터 ---------- */
  const WEAPONS = [
    { id: "pistol", name: "권총", kills: 0, dmg: 1, rate: 0.3, speed: 760, pellets: 1, spray: 0.01, pierce: 0, color: "#ffe8a8", kick: 0.7 },
    { id: "shotgun", name: "샷건", kills: 8, dmg: 1, rate: 0.5, speed: 640, pellets: 5, spray: 0.11, pierce: 0, color: "#ffc078", kick: 1.6 },
    { id: "rifle", name: "소총", kills: 20, dmg: 2.6, rate: 0.28, speed: 920, pellets: 1, spray: 0.006, pierce: 1, color: "#b8ffd0", kick: 1.1 },
    { id: "assault", name: "돌격소총", kills: 38, dmg: 1.5, rate: 0.1, speed: 840, pellets: 1, spray: 0.022, pierce: 0, color: "#9fd8ff", kick: 0.55 },
    { id: "plasma", name: "플라즈마", kills: 65, dmg: 3.2, rate: 0.16, speed: 880, pellets: 1, spray: 0.008, pierce: 2, color: "#e0a8ff", kick: 0.8 },
  ];

  // rig.legs = [왼쪽, 오른쪽, 위, 가르는 곳] (그림 폭 · 높이 비율) · head/tail = [어디부터, 움직임]
  const TYPES = {
    raptor: { file: "raptor", w: 100, h: 97, hp: 2, speed: 100, score: 120, damage: 10, gait: 12, native: -1, flying: false, rig: { legs: [0.42, 0.84, 0.62, 0.6], stride: 8, lift: 6, head: [0.3, 2.4], tail: [0.62, 5] } },
    stego: { file: "stego", w: 142, h: 69, hp: 5, speed: 46, score: 180, damage: 14, gait: 6.5, native: -1, flying: false, rig: { legs: [0.14, 0.64, 0.7, 0.36], stride: 5, lift: 3, head: [0.16, 1.8], tail: [0.72, 4] } },
    triceratops: { file: "triceratops", w: 150, h: 68, hp: 7, speed: 54, score: 240, damage: 16, gait: 8, native: -1, flying: false, rig: { legs: [0.16, 0.82, 0.66, 0.48], stride: 6, lift: 3, head: [0.3, 2], tail: [0.72, 4] } },
    trex: { file: "trex", w: 172, h: 96, hp: 16, speed: 44, score: 520, damage: 24, gait: 6, native: -1, flying: false, rig: { legs: [0.28, 0.72, 0.62, 0.49], stride: 8, lift: 5, head: [0.25, 3.2], tail: [0.66, 6] } },
    ptera: { file: "ptera", w: 122, h: 73, hp: 3, speed: 78, score: 200, damage: 10, gait: 9, native: -1, flying: true, rig: { pivot: 0.72, split: 0.46, big: 1, ampBig: 0.42, ampSmall: 0.12 } },
    quetz: { file: "quetz", w: 170, h: 107, hp: 9, speed: 60, score: 380, damage: 18, gait: 6.5, native: 1, flying: true, rig: { pivot: 0.8, split: 0.46, big: -1, ampBig: 0.4, ampSmall: 0.08 } },
  };

  const ZONES = [
    { name: "황금 정글", img: "bg", goal: 12, boss: "raptor", bossName: "대장 랩터", bossHp: 26, bossScale: 1.5, mix: { raptor: 8, ptera: 2 }, pal: { haze: "255,214,140", mid: "#2f4a22", midD: "#33502a", near: "#22381a", nearL: "#2f4a22", dirt1: "#8f6c3c", dirt2: "#4c3620", grass: "#86a542", grassD: "#5f8232", fore: "#14290f", mote: "#ffe9a8" } },
    { name: "안개 계곡", img: "bg2", goal: 15, boss: "stego", bossName: "대왕 스테고", bossHp: 62, bossScale: 1.45, mix: { raptor: 5, stego: 3, ptera: 2 }, pal: { haze: "200,226,226", mid: "#21483f", midD: "#264f46", near: "#163a32", nearL: "#21483f", dirt1: "#5d5a48", dirt2: "#2f2e24", grass: "#4f9163", grassD: "#37704c", fore: "#0d2622", mote: "#e6fff6" } },
    { name: "노을 협곡", img: "bg3", goal: 18, boss: "quetz", bossName: "케찰 여왕", bossHp: 72, bossScale: 1.25, mix: { raptor: 4, stego: 2, triceratops: 3, ptera: 2, quetz: 1 }, pal: { haze: "255,150,96", mid: "#4a2430", midD: "#532833", near: "#351822", nearL: "#4a2430", dirt1: "#83492a", dirt2: "#3d2014", grass: "#9a7434", grassD: "#6f5226", fore: "#1d0d18", mote: "#ffcf8f" } },
    { name: "달밤 정글", img: "bg2", tint: "rgba(16,24,84,0.62)", goal: 20, boss: "trex", bossName: "티라노 왕", bossHp: 130, bossScale: 1.65, mix: { raptor: 3, stego: 1, triceratops: 3, ptera: 2, quetz: 1, trex: 2 }, pal: { haze: "116,140,220", mid: "#16264a", midD: "#1a2b52", near: "#101d3a", nearL: "#16264a", dirt1: "#39415f", dirt2: "#191d33", grass: "#3c6a79", grassD: "#2a4f62", fore: "#070c1e", mote: "#a8fff0" } },
  ];

  /* ---------- 화면 ---------- */
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  let scale = 1;
  const stageEl = $("stage");

  const ui = {
    title: $("title"),
    over: $("game-over"),
    coach: $("coach"),
    banner: $("banner"),
    kills: $("hud-kills"),
    score: $("hud-score"),
    weapon: $("hud-weapon-name"),
    xp: $("hud-xp"),
    hp: $("hud-hp"),
    hpN: $("hud-hp-n"),
    combo: $("hud-combo"),
    zone: $("hud-zone"),
    zoneFill: $("hud-zone-fill"),
    boss: $("boss"),
    bossName: $("boss-name"),
    bossFill: $("boss-fill"),
    climb: $("climb-btn"),
    overDetail: $("over-detail"),
    finalKills: $("final-kills"),
    finalWeapon: $("final-weapon"),
    finalScore: $("final-score"),
  };

  /* ---------- 그림 ---------- */
  const images = {};
  const IMAGE_FILES = ["bg", "bg2", "bg3", "hunter", "tree", "raptor", "stego", "triceratops", "ptera", "quetz", "trex"];
  const whites = {};
  let imagesReady = false;
  function loadImages() {
    return Promise.all(
      IMAGE_FILES.map(
        (n) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              images[n] = im;
              res();
            };
            im.onerror = () => res();
            im.src = `assets/${n}.webp`;
          })
      )
    ).then(() => {
      for (const n of ["hunter", "raptor", "stego", "triceratops", "ptera", "quetz", "trex"]) {
        const im = images[n];
        if (!im) continue;
        const c = mk(im.naturalWidth, im.naturalHeight);
        const x = c.getContext("2d");
        x.drawImage(im, 0, 0);
        x.globalCompositeOperation = "source-in";
        x.fillStyle = "#fff";
        x.fillRect(0, 0, c.width, c.height);
        whites[n] = c;
      }
      imagesReady = true;
    });
  }
  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /* ---------- 배경 굽기 (구역마다 한 번) ---------- */
  function fern(c, x, y, size, col, rng) {
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineCap = "round";
    const n = 7;
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI + (i / (n - 1)) * Math.PI + (rng() - 0.5) * 0.12;
      const len = size * (0.72 + rng() * 0.38);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len * 0.72 + len * 0.1;
      const cx = x + Math.cos(a) * len * 0.5;
      const cy = y + Math.sin(a) * len * 0.82 - len * 0.06;
      c.lineWidth = Math.max(1, size * 0.03);
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(cx, cy, ex, ey);
      c.stroke();
      const leaves = 8;
      c.lineWidth = Math.max(1, size * 0.045);
      for (let k = 1; k < leaves; k += 1) {
        const t = k / leaves;
        const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
        const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
        const l = size * 0.17 * (1 - t * 0.7);
        const nx = -(ey - y);
        const ny = ex - x;
        const nn = Math.hypot(nx, ny) || 1;
        c.beginPath();
        c.moveTo(px + (nx / nn) * l, py + (ny / nn) * l);
        c.lineTo(px - (nx / nn) * l, py - (ny / nn) * l);
        c.stroke();
      }
    }
  }
  function wrap(x, span, fn) {
    fn(x);
    if (x - span < 0) fn(x + LOOP);
    if (x + span > LOOP) fn(x - LOOP);
  }

  function bakeZone(z) {
    const zone = ZONES[z];
    const p = zone.pal;
    const bs = Math.min(scale, 2);
    const rng = seeded(1234 + z * 77);
    const layer = (hh, draw) => {
      const c = mk(LOOP * bs, hh * bs);
      const x = c.getContext("2d");
      x.scale(bs, bs);
      if (x.imageSmoothingQuality) x.imageSmoothingQuality = "high";
      draw(x);
      return { c, hh };
    };
    // 그림 배경: 좌우로 뒤집어 이어 붙여 이음매가 안 보이게 (그림의 숲 · 길을 그대로 살린다)
    const far = layer(GROUND + 8, (x) => {
      const im = images[zone.img];
      const ph = GROUND + 8;
      if (im) {
        // 뒤집어 붙이면 가운데가 데칼코마니처럼 보인다 → 그대로 이어 붙이고 이음매만 부드럽게 겹친다
        const tw = 460;
        const th = Math.max((tw * 700) / 390, ph * 1.02);
        const tile = mk(tw * bs, ph * bs);
        const tx = tile.getContext("2d");
        tx.scale(bs, bs);
        if (tx.imageSmoothingQuality) tx.imageSmoothingQuality = "high";
        tx.drawImage(im, 0, ph - th * 0.985, tw, th);
        tx.globalCompositeOperation = "destination-in";
        const mask = tx.createLinearGradient(0, 0, 70, 0);
        mask.addColorStop(0, "rgba(0,0,0,0)");
        mask.addColorStop(1, "rgba(0,0,0,1)");
        tx.fillStyle = mask;
        tx.fillRect(0, 0, tw, ph);
        x.fillStyle = "#3a4a2c";
        x.fillRect(0, 0, LOOP, ph);
        for (const q of [-390, 0, 390]) x.drawImage(tile, q, 0, tw, ph);
      } else {
        x.fillStyle = "#6fa8c8";
        x.fillRect(0, 0, LOOP, GROUND);
      }
      if (zone.tint) {
        x.fillStyle = zone.tint;
        x.fillRect(0, 0, LOOP, ph);
        x.fillStyle = "#f6f4ff";
        x.beginPath();
        x.arc(250, 120, 26, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = "rgba(246,244,255,0.1)";
        x.beginPath();
        x.arc(250, 120, 58, 0, Math.PI * 2);
        x.fill();
      }
      // 게임 무대 뒤쪽은 살짝 흐리게 (공룡이 잘 보이게)
      const g = x.createLinearGradient(0, GROUND - 300, 0, GROUND);
      g.addColorStop(0, `rgba(${p.haze},0)`);
      g.addColorStop(1, `rgba(${p.haze},0.3)`);
      x.fillStyle = g;
      x.fillRect(0, GROUND - 300, LOOP, 308);
    });
    // 땅과 그림이 만나는 곳: 어두운 수풀 실루엣
    const midTop = GROUND - 90;
    const mid = layer(H - midTop, (x) => {
      x.translate(0, -midTop);
      for (let i = 0; i < 16; i += 1) {
        const px = (i + rng() * 0.8) * (LOOP / 16);
        const s = 44 + rng() * 36;
        wrap(px, 90, (q) => fern(x, q, GROUND + 2, s, p.midD, seeded(i * 17 + z)));
      }
      const g = x.createLinearGradient(0, GROUND - 26, 0, GROUND + 4);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, p.midD);
      x.fillStyle = g;
      x.fillRect(0, GROUND - 26, LOOP, 30);
    });
    const nearTop = GROUND - 62;
    const near = layer(H - nearTop, (x) => {
      x.translate(0, -nearTop);
      for (let i = 0; i < 12; i += 1) {
        const px = (i + rng() * 0.9) * (LOOP / 12);
        const s = 28 + rng() * 26;
        wrap(px, 70, (q) => fern(x, q, GROUND + 2, s, p.near, seeded(i * 41 + z)));
      }
    });
    // 땅
    const groundTop = GROUND - 8;
    const ground = layer(H - groundTop, (x) => {
      x.translate(0, -groundTop);
      const g = x.createLinearGradient(0, GROUND, 0, H);
      g.addColorStop(0, p.dirt1);
      g.addColorStop(0.5, p.dirt2);
      g.addColorStop(1, p.dirt2);
      x.fillStyle = g;
      x.fillRect(0, GROUND, LOOP, H - GROUND);
      // 흙 얼룩 · 돌멩이
      for (let i = 0; i < 70; i += 1) {
        const px = rng() * LOOP;
        const py = GROUND + 8 + rng() * (H - GROUND - 10);
        const r = 2 + rng() * 9;
        x.fillStyle = rng() < 0.5 ? "rgba(255,240,200,0.05)" : "rgba(0,0,0,0.1)";
        wrap(px, 24, (q) => {
          x.beginPath();
          x.ellipse(q, py, r * 2, r * 0.6, 0, 0, Math.PI * 2);
          x.fill();
        });
      }
      for (let i = 0; i < 18; i += 1) {
        const px = rng() * LOOP;
        const py = GROUND + 12 + rng() * 40;
        const r = 2.5 + rng() * 4.5;
        wrap(px, 12, (q) => {
          x.fillStyle = "rgba(20,14,8,0.35)";
          x.beginPath();
          x.ellipse(q + 1, py + r * 0.5, r * 1.1, r * 0.6, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = "#a0947c";
          x.beginPath();
          x.ellipse(q, py, r, r * 0.68, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = "rgba(255,255,255,0.3)";
          x.beginPath();
          x.ellipse(q - r * 0.3, py - r * 0.25, r * 0.36, r * 0.2, 0, 0, Math.PI * 2);
          x.fill();
        });
      }
      // 풀 띠
      x.fillStyle = p.grassD;
      x.fillRect(0, GROUND - 1, LOOP, 7);
      x.lineCap = "round";
      for (let i = 0; i < 420; i += 1) {
        const px = rng() * LOOP;
        const h = 4 + rng() * 9;
        const lean = (rng() - 0.5) * 6;
        x.strokeStyle = rng() < 0.55 ? p.grass : p.grassD;
        x.lineWidth = 1.2 + rng();
        x.beginPath();
        x.moveTo(px, GROUND + 3 + rng() * 3);
        x.quadraticCurveTo(px + lean * 0.3, GROUND - h * 0.5, px + lean, GROUND - h);
        x.stroke();
      }
    });
    // 맨 앞 잎사귀 (아래쪽 그림자)
    const foreTop = H - 96;
    const fore = layer(H - foreTop, (x) => {
      x.translate(0, -foreTop);
      for (let i = 0; i < 7; i += 1) {
        const px = (i + rng()) * (LOOP / 7);
        const s = 54 + rng() * 34;
        wrap(px, 90, (q) => fern(x, q, H + 6, s, p.fore, seeded(i * 53 + z)));
      }
    });
    return { far, mid, near, ground, fore, foreTop, groundTop, nearTop, midTop };
  }

  let layers = null;
  let oldLayers = null;
  let layerFade = 0;
  let vignette = null;
  let treeImg = null;

  function resize() {
    const r = stageEl.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    scale = canvas.width / W;
    const nh = Math.max(500, Math.round((W * r.height) / Math.max(1, r.width)));
    const changed = nh !== H;
    H = nh;
    GROUND = H - 130;
    player.y = player.climbState === "ground" ? GROUND : player.y;
    if (changed && S) {
      for (const d of S.dinos) if (!d.flying) d.y = GROUND;
      for (const t of S.trees) t.climbY = GROUND - 178;
    }
    if (imagesReady) rebake();
    vignette = mk(W, H);
    const x = vignette.getContext("2d");
    const g = x.createRadialGradient(W / 2, H * 0.48, H * 0.32, W / 2, H * 0.5, H * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }
  function rebake() {
    layers = bakeZone(S.zone);
    oldLayers = null;
    layerFade = 0;
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
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = 0.85;
        const comp = c.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(c.destination);
        this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
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
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise(dur, peak, freq, q = 0.8, delay = 0) {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = c.currentTime + delay;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.02);
    },
    gun(id) {
      if (id === "pistol") {
        this.noise(0.09, 0.22, 1800, 0.7);
        this.tone(220, 0.08, "square", 0.05, 0.4);
      } else if (id === "shotgun") {
        this.noise(0.22, 0.4, 900, 0.5);
        this.tone(120, 0.18, "sawtooth", 0.14, 0.4);
      } else if (id === "rifle") {
        this.noise(0.14, 0.3, 2200, 0.6);
        this.tone(180, 0.12, "square", 0.09, 0.35);
      } else if (id === "assault") {
        this.noise(0.06, 0.16, 2600, 0.7);
        this.tone(260, 0.05, "square", 0.04, 0.5);
      } else {
        this.tone(880, 0.13, "sawtooth", 0.07, 0.3);
        this.tone(440, 0.16, "sine", 0.1, 2.2);
      }
    },
    hit() {
      this.noise(0.05, 0.1, 500, 1.1);
    },
    kill(big) {
      this.tone(big ? 320 : 520, 0.14, "triangle", 0.14, 1.5);
      this.tone(big ? 480 : 780, 0.16, "triangle", 0.1, 1.3, 0.06);
      this.noise(0.18, big ? 0.22 : 0.12, 320, 0.8);
    },
    roar(big) {
      this.tone(big ? 150 : 230, big ? 0.85 : 0.4, "sawtooth", big ? 0.22 : 0.12, 0.45);
      this.tone(big ? 110 : 170, big ? 0.85 : 0.4, "square", big ? 0.1 : 0.05, 0.5);
      this.noise(big ? 0.8 : 0.35, big ? 0.2 : 0.09, 420, 0.5);
    },
    hurt() {
      this.tone(330, 0.22, "square", 0.12, 0.45);
      this.noise(0.12, 0.14, 700, 0.8);
    },
    pick() {
      this.tone(660, 0.1, "triangle", 0.14);
      this.tone(990, 0.16, "triangle", 0.12, 1, 0.08);
    },
    up() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.13, 1, i * 0.08));
    },
    stomp() {
      this.tone(70, 0.24, "sine", 0.3, 0.6);
      this.noise(0.18, 0.2, 180, 0.7);
    },
    tree() {
      this.noise(0.16, 0.1, 1200, 0.5);
    },
  };

  /* ---------- 상태 ---------- */
  const player = {
    x: 80,
    y: GROUND,
    vx: 0,
    vy: 0,
    face: 1,
    hp: 100,
    inv: 0,
    climbState: "ground", // ground | up | perch | down | fall
    tree: null,
    climb: 0,
    hurtFlash: 0,
    walk: 0,
    moving: 0,
    aimA: 0,
    recoil: 0,
    fireFlash: 0,
  };

  const input = { left: false, right: false, fire: false, canvasFire: false };
  const S = {
    phase: "title",
    paused: false,
    score: 0,
    kills: 0,
    zoneKills: 0,
    zone: 0,
    loop: 0,
    weaponIndex: 0,
    fireCd: 0,
    spawnAcc: 0,
    shake: 0,
    flash: 0,
    flashColor: "255,230,140",
    hitStop: 0,
    slowT: 0,
    combo: 0,
    comboT: 0,
    boostT: 0,
    cameraX: 0,
    farthestX: 80,
    nextTreeX: 180,
    dinos: [],
    bullets: [],
    shots: [], // 바위 · 가시
    corpses: [],
    items: [],
    particles: [],
    floats: [],
    trees: [],
    motes: [],
    boss: null,
    nextZoneT: 0,
    manualT: 0,
    mouseAim: false,
    aimX: 280,
    aimY: 300,
    aiming: false,
    target: null,
    time: 0,
    dyingT: 0,
    hints: {},
    hudT: 0,
    damageTaken: 0,
    bossKills: 0,
  };

  const weapon = () => WEAPONS[S.weaponIndex];
  const sx = (x) => x - S.cameraX;

  /* ---------- 글자 알림 ---------- */
  let coachTimer = 0;
  function coach(text, sec = 2.6) {
    ui.coach.textContent = text;
    ui.coach.classList.add("show");
    coachTimer = sec;
  }
  function hint(key, text, sec) {
    if (S.hints[key]) return;
    S.hints[key] = true;
    coach(text, sec);
  }
  let bannerTimer = 0;
  function banner(html, cls = "") {
    const b = ui.banner;
    b.className = "banner";
    void b.offsetWidth;
    b.innerHTML = html;
    b.className = `banner show ${cls}`;
    bannerTimer = 1.9;
  }

  function updateHud() {
    ui.kills.textContent = String(S.kills);
    ui.score.textContent = Math.floor(S.score).toLocaleString("ko-KR");
    ui.weapon.textContent = weapon().name;
    const nxt = S.weaponIndex + 1 < WEAPONS.length ? WEAPONS[S.weaponIndex + 1].kills : null;
    const prev = weapon().kills;
    const ratio = nxt == null ? 1 : clamp((S.kills - prev) / Math.max(1, nxt - prev), 0, 1);
    ui.xp.style.width = `${Math.round(ratio * 100)}%`;
    const hpR = clamp(player.hp / 100, 0, 1);
    ui.hp.style.transform = `scaleX(${hpR})`;
    ui.hp.parentElement.classList.toggle("low", player.hp <= 35);
    ui.hpN.textContent = String(Math.max(0, Math.ceil(player.hp)));
    ui.combo.textContent = S.combo >= 2 ? `${S.combo}콤보` : "";
    const zone = ZONES[S.zone];
    const roundTxt = S.loop > 0 ? `${S.loop + 1}회차 ` : "";
    ui.zone.textContent = `${roundTxt}${S.zone + 1}구역 · ${zone.name}`;
    const goal = zoneGoal();
    ui.zoneFill.style.width = `${Math.round(clamp(S.zoneKills / goal, 0, 1) * 100)}%`;
    if (S.boss) ui.bossFill.style.width = `${Math.round(clamp(S.boss.hp / S.boss.maxHp, 0, 1) * 100)}%`;
    syncClimbButton();
  }

  const zoneGoal = () => ZONES[S.zone].goal + S.loop * 4;
  const hpMul = () => 1 + S.zone * 0.22 + S.loop * 0.75;
  const speedMul = () => 1 + S.zone * 0.05 + S.loop * 0.12;
  const dmgMul = () => 1 + S.loop * 0.25;

  /* ---------- 효과 ---------- */
  function addParticle(p) {
    if (S.particles.length > 260) S.particles.shift();
    S.particles.push(p);
  }
  function burst(x, y, color, count = 10, speed = 120, kind = "dust") {
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.3, speed);
      const life = rand(0.25, 0.6);
      addParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life, max: life, size: rand(2, 5), color, g: 300, kind, rot: rand(0, 6), vr: rand(-8, 8) });
    }
  }
  function dustAt(x, n = 6, power = 40) {
    for (let i = 0; i < n; i += 1) {
      const life = rand(0.25, 0.55);
      addParticle({ x: x + rand(-12, 12), y: GROUND - 2, vx: rand(-power, power), vy: rand(-power * 0.9, -6), life, max: life, size: rand(3, 8), color: "rgba(214,190,150,0.6)", g: 40, kind: "dust", rot: 0, vr: 0 });
    }
  }
  function floatText(x, y, text, color = "#fff", big = false) {
    S.floats.push({ x, y, text, color, life: big ? 1.15 : 0.8, max: big ? 1.15 : 0.8, big });
    if (S.floats.length > 30) S.floats.shift();
  }

  /* ---------- 나무 ---------- */
  function ensureTrees() {
    const need = player.x + 800;
    while (S.nextTreeX < need) {
      S.trees.push({ x: S.nextTreeX, climbY: GROUND - 178, shake: 0 });
      S.nextTreeX += rand(270, 400);
    }
    S.trees = S.trees.filter((t) => t.x > player.x - 500 || player.tree === t);
  }
  function nearestTree() {
    let best = null;
    let bestD = 66;
    for (const t of S.trees) {
      const d = Math.abs(player.x - t.x);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
  let lastClimbText = "";
  function syncClimbButton() {
    const perched = player.climbState === "perch" || player.climbState === "up";
    const txt = perched ? "내려오기" : "나무 타기";
    if (txt !== lastClimbText) {
      ui.climb.textContent = txt;
      lastClimbText = txt;
    }
    ui.climb.classList.toggle("ready", perched || (player.climbState === "ground" && !!nearestTree()));
  }
  function tryClimb() {
    if (S.phase !== "play") return;
    if (player.climbState === "up" || player.climbState === "down" || player.climbState === "fall") return;
    if (player.climbState === "perch") {
      player.climbState = "down";
      Sfx.tree();
      return;
    }
    const t = nearestTree();
    if (!t) {
      coach("나무 가까이에서 탈 수 있어요", 1.4);
      return;
    }
    player.climbState = "up";
    player.tree = t;
    player.climb = 0;
    player.vx = 0;
    Sfx.tree();
    hint("perch", "땅 공룡은 못 올라와요. 대신 나무를 흔들어요!", 2.6);
  }

  /* ---------- 공룡 ---------- */
  function pickType() {
    const zone = ZONES[S.zone];
    const mix = S.loop > 0 ? ZONES[3].mix : zone.mix;
    const entries = Object.entries(mix).filter(([k]) => !(S.loop === 0 && S.zone === 0 && k === "ptera" && S.zoneKills < 3));
    const total = entries.reduce((a, e) => a + e[1], 0);
    let r = Math.random() * total;
    for (const [k, v] of entries) {
      r -= v;
      if (r <= 0) return k;
    }
    return "raptor";
  }

  function spawnDino(type, opts = {}) {
    const def = TYPES[type];
    const k = opts.scale || 1;
    const ahead = opts.side ? opts.side > 0 : Math.random() < 0.74;
    const x = opts.x != null ? opts.x : ahead ? S.cameraX + W + rand(60, 170) : S.cameraX - rand(90, 170);
    const cruise = def.flying ? (opts.cruise != null ? opts.cruise : rand(150, GROUND - 240)) : 0;
    const hp = opts.hp != null ? opts.hp : Math.round((def.hp + S.zoneKills * 0.05) * hpMul() * 10) / 10;
    const d = {
      type,
      def,
      x,
      y: def.flying ? cruise : GROUND,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      w: def.w * k,
      h: def.h * k,
      scale: k,
      speed: def.speed * speedMul() * rand(0.92, 1.1),
      flying: def.flying,
      damage: def.damage * dmgMul(),
      score: def.score,
      gait: def.gait,
      phase: rand(0, 6),
      flash: 0,
      lean: 0,
      state: "walk",
      t: 0,
      cd: rand(0.4, 1.4),
      cruise,
      boss: !!opts.boss,
      summon: 0,
      roared: false,
      face: x < player.x ? 1 : -1,
    };
    S.dinos.push(d);
    return d;
  }

  function spawnBoss() {
    const z = ZONES[S.zone];
    const d = spawnDino(z.boss, {
      boss: true,
      scale: z.bossScale,
      hp: Math.round(z.bossHp * (1 + S.loop * 0.8)),
      side: 1,
      cruise: 150,
      x: S.cameraX + W + 150,
    });
    d.speed *= z.boss === "raptor" ? 1.1 : 1;
    d.score = 800 + S.zone * 500 + S.loop * 800;
    d.cd = 1.5;
    S.boss = d;
    ui.boss.classList.remove("hidden");
    ui.bossName.textContent = z.bossName;
    banner(`보스 등장!<small>${z.bossName}</small>`, "boss-in");
    Sfx.roar(true);
    S.shake = Math.max(S.shake, 8);
    hudNow();
  }

  function hurtPlayer(amount, msg) {
    if (player.inv > 0 || S.phase !== "play") return false;
    player.hp -= amount;
    player.inv = 1.15;
    player.hurtFlash = 0.3;
    S.shake = Math.max(S.shake, 9);
    S.flash = 0.28;
    S.flashColor = "255,80,70";
    S.combo = 0;
    S.damageTaken += amount;
    Sfx.hurt();
    if (msg) coach(msg, 1.8);
    hudNow();
    if (player.hp <= 0) {
      player.hp = 0;
      S.phase = "dying";
      S.dyingT = 0.95;
      S.slowT = 1;
      player.climbState = player.climbState === "ground" ? "ground" : "fall";
      burst(player.x, player.y - 60, "#ffe9a8", 22, 200, "star");
    }
    return true;
  }

  function knockPlayer(fromX) {
    if (player.climbState !== "ground") return;
    player.vx = (player.x >= fromX ? 1 : -1) * 200;
  }

  function shakeOffTree(t) {
    if (player.tree !== t || player.climbState !== "perch") return;
    player.climbState = "fall";
    player.vy = -120;
    player.tree = null;
    t.shake = 0;
    coach("나무에서 떨어졌어요!", 1.6);
    S.shake = Math.max(S.shake, 6);
    Sfx.stomp();
  }

  function startWind(d, t) {
    d.state = "wind";
    d.t = t;
    d.vx *= 0.3;
  }

  function fireSpikes(d) {
    const dir = Math.sign(player.x - d.x) || 1;
    for (let i = 0; i < 5; i += 1) {
      const a = -1.25 + i * 0.22;
      const sp = 300 + i * 22;
      S.shots.push({ kind: "spike", x: d.x + dir * d.w * 0.1, y: d.y - d.h * 0.8, vx: dir * Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 9, rot: 0, hp: 1, life: 3 });
    }
    Sfx.stomp();
    S.shake = Math.max(S.shake, 4);
  }
  function dropRock(x, delay = 0) {
    S.shots.push({ kind: "rock", x, y: -30 - delay * 300, vx: 0, vy: 240, r: 15, rot: rand(0, 6), hp: 1, life: 5 });
  }

  function updateWalker(d, dt, dir) {
    const dist = Math.abs(player.x - d.x);
    const moving = Math.abs(d.vx) / Math.max(1, d.speed);
    d.phase += dt * d.gait * clamp(moving, 0.15, 2.2);
    d.cd = Math.max(0, d.cd - dt);
    const perched = player.climbState === "perch" || (player.climbState === "up" && player.climb > 0.55);

    if (d.state === "walk") {
      // 나무 위로 피하면 나무 밑에서 들이받는다
      if (perched && player.tree && Math.abs(d.x - player.tree.x) < 62 + d.w * 0.2) {
        d.vx = lerp(d.vx, 0, 1 - Math.pow(0.001, dt));
        player.tree.shake += dt * (d.boss ? 2.4 : 1);
        d.lean = Math.sin(S.time * 12 + d.phase) * 0.05;
        if (player.tree.shake > 3.2) hint("shake", "나무가 흔들려요! 쏘거나 내려오세요", 2.2);
        if (player.tree.shake > 6) shakeOffTree(player.tree);
      } else {
        d.vx = lerp(d.vx, dir * d.speed, 1 - Math.pow(0.1, dt));
        d.lean = lerp(d.lean, 0, 0.1);
      }
      if (d.cd <= 0 && !perched) {
        if (d.type === "raptor" && dist < (d.boss ? 200 : 150)) {
          startWind(d, d.boss ? 0.36 : 0.3);
        } else if ((d.type === "triceratops" || d.type === "trex") && dist > 80 && dist < 300) {
          startWind(d, d.type === "trex" ? 0.8 : 0.62);
          if (d.type === "trex") Sfx.roar(d.boss);
          else Sfx.stomp();
          hint("charge", "돌진해요! 나무 위로 피하세요", 2.2);
        } else if (d.type === "stego" && d.boss && dist < 320) {
          startWind(d, 0.75);
          Sfx.roar(true);
        }
      }
      if (d.boss && d.summon < 2 && d.hp < d.maxHp * (d.summon === 0 ? 0.66 : 0.33) && d.type === "raptor") {
        d.summon += 1;
        spawnDino("raptor", { side: 1 });
        spawnDino("raptor", { side: -1 });
        Sfx.roar(false);
      }
    } else if (d.state === "wind") {
      d.t -= dt;
      d.vx *= Math.pow(0.002, dt);
      d.lean = d.type === "raptor" ? -0.1 : Math.sin(S.time * 30) * 0.03;
      if (Math.random() < dt * 22) dustAt(d.x, 1, 30);
      if (d.t <= 0) {
        if (d.type === "raptor") {
          d.state = "air";
          const reach = clamp(dist / 0.74, 170, d.boss ? 420 : 340);
          d.vx = dir * reach;
          d.vy = -350;
          Sfx.roar(false);
        } else if (d.type === "stego") {
          fireSpikes(d);
          d.state = "rest";
          d.t = 0.6;
          d.cd = rand(2.6, 3.8);
        } else {
          d.state = "charge";
          d.t = d.boss ? 1.25 : 1.05;
          d.vx = dir * (d.boss ? 400 : 340);
          S.shake = Math.max(S.shake, d.boss ? 6 : 2);
        }
      }
    } else if (d.state === "air") {
      d.vy += 960 * dt;
      d.y += d.vy * dt;
      d.lean = clamp(d.vy / 900, -0.3, 0.3);
      if (d.y >= GROUND) {
        d.y = GROUND;
        d.vy = 0;
        d.state = "rest";
        d.t = d.boss ? 0.34 : 0.5;
        d.cd = d.boss ? rand(0.8, 1.5) : rand(1.3, 2.4);
        dustAt(d.x, 6, 60);
      }
    } else if (d.state === "charge") {
      d.t -= dt;
      d.lean = 0.05 * Math.sign(d.vx);
      if (Math.random() < dt * 30) dustAt(d.x - Math.sign(d.vx) * d.w * 0.3, 1, 50);
      if (d.t <= 0) {
        d.state = "rest";
        d.t = 0.65;
        d.cd = d.boss ? rand(2.2, 3.2) : rand(2.2, 3.6);
        if (d.boss) {
          // 티라노: 쿵! 바위가 떨어진다
          S.shake = Math.max(S.shake, 9);
          Sfx.stomp();
          for (let i = 0; i < 4; i += 1) dropRock(S.cameraX + rand(30, W - 30), i * 0.3);
          dropRock(player.x + player.vx * 0.5, 0.2);
        }
      }
    } else if (d.state === "rest") {
      d.t -= dt;
      d.vx *= Math.pow(0.01, dt);
      d.lean = lerp(d.lean, 0, 0.12);
      if (d.t <= 0) d.state = "walk";
    }
    d.x += d.vx * dt;
    if (d.state !== "air") {
      const hop = Math.abs(Math.sin(d.phase)) * (d.type === "raptor" ? 3 : 1.5) * moving;
      d.y = GROUND - hop * 0.3;
      if (Math.sin(d.phase) > 0.96 && moving > 0.4 && Math.random() < 0.25) dustAt(d.x, 1, 24);
      if ((d.boss || d.type === "trex") && moving > 0.3 && Math.abs(Math.sin(d.phase)) < 0.04) {
        S.shake = Math.max(S.shake, 2.2);
      }
    }
  }

  function updateFlyer(d, dt, dir) {
    d.phase += dt * d.gait * (d.state === "dive" ? 0.4 : 1);
    d.cd = Math.max(0, d.cd - dt);
    const targetY = player.y - 60;
    const dx = player.x - d.x;
    if (d.state === "walk") {
      const want = dir * d.speed * (Math.abs(dx) < 60 ? 0.5 : 1);
      d.vx = lerp(d.vx, want, 1 - Math.pow(0.08, dt));
      d.y = lerp(d.y, d.cruise + Math.sin(d.phase * 0.35) * 12, 1 - Math.pow(0.2, dt));
      d.lean = lerp(d.lean, clamp(d.vx / 500, -0.12, 0.12), 0.1);
      if (d.boss) {
        // 여왕: 바위 떨구기 + 가끔 급강하
        d.rockCd = (d.rockCd == null ? 2 : d.rockCd) - dt;
        if (d.rockCd <= 0) {
          d.rockCd = rand(2.2, 3);
          for (let i = 0; i < 3; i += 1) dropRock(player.x + (i - 1) * 70 + rand(-14, 14), i * 0.12);
          Sfx.roar(false);
        }
      }
      if (Math.abs(dx) < 220 && Math.abs(dx) > 26 && d.cd <= 0) {
        d.state = "telegraph";
        d.t = d.boss ? 0.8 : 0.62;
        Sfx.roar(false);
        hint("dive", "하늘 공룡이 내려와요! 쏘거나 옆으로 피하세요", 2.2);
      }
    } else if (d.state === "telegraph") {
      d.t -= dt;
      d.vx = lerp(d.vx, dir * d.speed * 0.3, 0.08);
      d.y = lerp(d.y, d.cruise - 20, 0.04);
      d.lean = lerp(d.lean, 0.3 * dir * d.def.native * -1, 0.1);
      if (d.t <= 0) {
        d.state = "dive";
        const a = Math.atan2(targetY - d.y, dx);
        const sp = (d.type === "quetz" ? 330 : 290) * (1 + S.loop * 0.08);
        d.vx = Math.cos(a) * sp;
        d.vy = Math.sin(a) * sp;
        d.t = 1.2;
      }
    } else if (d.state === "dive") {
      d.t -= dt;
      const a = Math.atan2(targetY - d.y, dx);
      const sp = Math.hypot(d.vx, d.vy) || 280;
      d.vx = lerp(d.vx, Math.cos(a) * sp, 0.012);
      d.vy = lerp(d.vy, Math.sin(a) * sp, 0.012);
      d.y += d.vy * dt;
      d.lean = clamp(d.vy / 600, -0.5, 0.5) * (d.vx >= 0 ? -d.def.native : d.def.native);
      const passed = d.t <= 0 || d.y > GROUND - 34 || (Math.sign(d.vx) === Math.sign(d.x - player.x) && Math.abs(d.x - player.x) > 90 && d.y > targetY - 20);
      if (passed) {
        d.state = "climb";
        d.t = 1;
        d.vy = -230;
      }
    } else if (d.state === "climb") {
      d.t -= dt;
      d.vy = lerp(d.vy, -180, 0.02);
      d.vx = lerp(d.vx, dir * d.speed * 1.05, 0.02);
      d.y += d.vy * dt;
      d.lean = lerp(d.lean, 0, 0.05);
      if (d.y <= d.cruise + 8 || d.t <= 0) {
        d.state = "walk";
        d.cd = d.boss ? rand(4, 6) : rand(1.6, 2.8);
      }
    }
    d.x += d.vx * dt;
  }

  function pickTarget() {
    const m = muzzle();
    let best = null;
    let bestS = 1e9;
    for (const d of S.dinos) {
      if (d.hp <= 0) continue;
      const q = sx(d.x);
      if (q < -24 || q > W + 24) continue;
      const cy = d.y - d.h * 0.5;
      let v = Math.hypot(d.x - m.x, cy - m.y);
      if (d.state === "dive" || d.state === "telegraph") v -= 110;
      if (d.state === "charge" || d.state === "wind" || d.state === "air") v -= 60;
      if (Math.sign(d.x - player.x) === player.face) v -= 36;
      if (d.boss) v -= 16;
      if (v < bestS) {
        bestS = v;
        best = d;
      }
    }
    return best;
  }

  /* ---------- 총 ---------- */
  function muzzle() {
    const w = 70;
    const h = 108;
    const px = player.x - 0.03 * w * player.face;
    const py = player.y - 0.53 * h;
    const a = player.aimA;
    const mx = 0.565 * w;
    const my = -0.125 * h;
    return { x: px + player.face * (Math.cos(a) * mx - Math.sin(a) * my), y: py + Math.sin(a) * mx + Math.cos(a) * my, px, py };
  }

  function aimPoint() {
    if (S.mouseAim || S.manualT > 0) return { x: S.cameraX + S.aimX, y: S.aimY, manual: true };
    if (S.target) return { x: S.target.x, y: S.target.y - S.target.h * 0.5, manual: false };
    return null;
  }

  function fire() {
    if (S.phase !== "play" || S.fireCd > 0) return;
    const wpn = weapon();
    S.fireCd = wpn.rate / (S.boostT > 0 ? 1.6 : 1);
    const m = muzzle();
    const aim = aimPoint();
    const base = aim ? Math.atan2(aim.y - m.y, aim.x - m.x) : player.face > 0 ? 0 : Math.PI;
    for (let i = 0; i < wpn.pellets; i += 1) {
      const a = base + rand(-wpn.spray, wpn.spray);
      const sp = wpn.speed * (wpn.pellets > 1 ? rand(0.9, 1.06) : 1);
      S.bullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: wpn.dmg, pierce: wpn.pierce, life: 0.72, color: wpn.color, r: wpn.id === "plasma" ? 5 : 2.6, plasma: wpn.id === "plasma", hit: null });
    }
    player.recoil = 1;
    player.fireFlash = 0.07;
    S.shake = Math.max(S.shake, wpn.kick);
    // 탄피
    addParticle({ x: m.x - player.face * 18, y: m.y + 2, vx: -player.face * rand(40, 90), vy: rand(-130, -70), life: 0.6, max: 0.6, size: 2.2, color: "#e8c35a", g: 620, kind: "shell", rot: rand(0, 6), vr: rand(-16, 16) });
    Sfx.gun(wpn.id);
  }

  function checkUpgrade() {
    while (S.weaponIndex + 1 < WEAPONS.length && S.kills >= WEAPONS[S.weaponIndex + 1].kills) {
      S.weaponIndex += 1;
      const wpn = weapon();
      banner(`${wpn.name} 해금!<small>화력이 강해졌어요</small>`);
      burst(player.x, player.y - 70, wpn.color, 26, 190, "star");
      S.flash = 0.3;
      S.flashColor = "255,230,140";
      S.slowT = Math.max(S.slowT, 0.5);
      Sfx.up();
    }
  }

  function dropItem(x) {
    const r = Math.random();
    const low = player.hp < 60;
    let kind = null;
    if (r < (low ? 0.2 : 0.09)) kind = "meat";
    else if (r < (low ? 0.27 : 0.17)) kind = "boost";
    else if (r < (low ? 0.33 : 0.25)) kind = "star";
    if (kind) S.items.push({ kind, x, y: GROUND - 16, t: 0, life: 10 });
  }

  function killDino(d) {
    d.hp = 0;
    S.kills += 1;
    if (!d.boss) S.zoneKills += 1;
    if (S.comboT > 0) S.combo += 1;
    else S.combo = 1;
    S.comboT = 2.8;
    const mult = 1 + Math.min(S.combo - 1, 10) * 0.1;
    const gain = Math.round((d.score + S.zone * 20) * mult);
    S.score += gain;
    floatText(d.x, d.y - d.h - 6, `+${gain}`, "#ffe56a", d.boss || gain > 400);
    const big = d.w > 130;
    S.corpses.push({ type: d.type, def: d.def, x: d.x, y: d.y, w: d.w, h: d.h, face: d.face, rot: 0, vr: (d.flying ? 3 : 1.6) * (d.face > 0 ? 1 : -1), vy: d.flying ? -60 : -110, vx: d.vx * 0.2, flying: d.flying, life: 1.25, grounded: false });
    burst(d.x, d.y - d.h * 0.5, "#ffe9a8", big ? 20 : 12, big ? 210 : 160, "star");
    dustAt(d.x, big ? 10 : 5, 70);
    Sfx.kill(big);
    S.hitStop = Math.max(S.hitStop, d.boss ? 0.14 : big ? 0.05 : 0.02);
    S.shake = Math.max(S.shake, big ? 5 : 2.4);
    checkUpgrade();
    if (d.boss) {
      S.boss = null;
      S.bossKills += 1;
      ui.boss.classList.add("hidden");
      S.score += 500 * (S.zone + 1);
      S.slowT = 1;
      S.flash = 0.5;
      S.flashColor = "255,245,200";
      S.items.push({ kind: "meat", x: d.x, y: GROUND - 16, t: 0, life: 14 });
      S.items.push({ kind: "star", x: d.x + 34, y: GROUND - 16, t: 0, life: 14 });
      banner(`구역 돌파!<small>+${(500 * (S.zone + 1)).toLocaleString("ko-KR")}점</small>`);
      Sfx.up();
      S.nextZoneT = 2.4;
      for (const o of S.dinos) if (o !== d && !o.boss) o.hp = Math.min(o.hp, 0.5);
    } else {
      dropItem(d.x);
    }
    hudNow();
  }

  function nextZone() {
    const old = S.zone;
    S.zone += 1;
    if (S.zone >= ZONES.length) {
      S.zone = 0;
      S.loop += 1;
    }
    S.zoneKills = 0;
    player.hp = Math.min(100, player.hp + 25);
    if (layers && ZONES[old].img !== undefined) {
      oldLayers = layers;
      layers = bakeZone(S.zone);
      layerFade = 1;
    }
    const z = ZONES[S.zone];
    banner(`${S.zone + 1}구역<small>${S.loop > 0 ? `${S.loop + 1}회차 · ` : ""}${z.name}</small>`);
    makeMotes();
    hudNow();
  }

  function makeMotes() {
    S.motes = Array.from({ length: 22 }, () => ({ x: rand(0, W), y: rand(60, H - 150), s: rand(0.6, 1.8), v: rand(6, 18), p: rand(0, 6) }));
  }

  /* ---------- 시작 · 끝 ---------- */
  function resetState() {
    Object.assign(S, {
      paused: false,
      score: 0,
      kills: 0,
      zoneKills: 0,
      zone: 0,
      loop: 0,
      weaponIndex: 0,
      fireCd: 0,
      spawnAcc: -0.6,
      shake: 0,
      flash: 0,
      hitStop: 0,
      slowT: 0,
      combo: 0,
      comboT: 0,
      boostT: 0,
      cameraX: 0,
      farthestX: 80,
      nextTreeX: 200,
      dinos: [],
      bullets: [],
      shots: [],
      corpses: [],
      items: [],
      particles: [],
      floats: [],
      trees: [],
      boss: null,
      nextZoneT: 0,
      manualT: 0,
      target: null,
      time: 0,
      dyingT: 0,
      damageTaken: 0,
      bossKills: 0,
    });
    Object.assign(player, { x: 80, y: GROUND, vx: 0, vy: 0, face: 1, hp: 100, inv: 2, climbState: "ground", tree: null, climb: 0, hurtFlash: 0, walk: 0, moving: 0, aimA: 0, recoil: 0, fireFlash: 0 });
    ui.boss.classList.add("hidden");
    makeMotes();
    ensureTrees();
  }

  function setPhase(p) {
    S.phase = p;
    document.body.classList.toggle("in-play", p === "play" || p === "dying");
  }

  function startGame() {
    Sfx.unlock();
    resetState();
    setPhase("play");
    if (imagesReady) rebake();
    ui.title.classList.add("hidden");
    ui.over.classList.add("hidden");
    spawnDino("raptor", { side: 1 });
    coach("◀▶ 로 움직이고 발사를 꾹 누르세요", 3.4);
    hudNow();
    if (window.TodayGameRank) window.TodayGameRank.reset();
    if (window.TodayBGM) window.TodayBGM.start("dino-hunt");
  }

  function endGame() {
    setPhase("over");
    input.fire = false;
    input.left = false;
    input.right = false;
    input.canvasFire = false;
    ui.over.classList.remove("hidden");
    const roundTxt = S.loop > 0 ? `${S.loop + 1}회차 ` : "";
    ui.overDetail.textContent = `${roundTxt}${S.zone + 1}구역 · ${S.kills}마리 처치`;
    ui.finalKills.textContent = String(S.kills);
    ui.finalWeapon.textContent = weapon().name;
    ui.finalScore.textContent = Math.floor(S.score).toLocaleString("ko-KR");
    if (window.TodayGameRank) window.TodayGameRank.open(Math.floor(S.score), { label: `${S.kills}마리 · ${weapon().name}` });
  }

  function hudNow() {
    updateHud();
    S.hudT = 0.1;
  }

  /* ---------- 걸음 ---------- */
  function updatePlayer(dt) {
    player.inv = Math.max(0, player.inv - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    player.recoil = Math.max(0, player.recoil - dt * 9);
    player.fireFlash = Math.max(0, player.fireFlash - dt);

    const cs = player.climbState;
    if (cs === "ground") {
      const speed = 214;
      if (input.left && !input.right) player.vx = lerp(player.vx, -speed, 1 - Math.pow(0.0005, dt));
      else if (input.right && !input.left) player.vx = lerp(player.vx, speed, 1 - Math.pow(0.0005, dt));
      else player.vx *= Math.pow(0.004, dt);
      player.x = Math.max(40, player.x + player.vx * dt);
      player.y = GROUND;
      player.moving = clamp(Math.abs(player.vx) / speed, 0, 1);
      player.walk += dt * 13 * player.moving;
      if (player.moving > 0.5 && Math.sin(player.walk) > 0.98 && Math.random() < 0.5) dustAt(player.x, 1, 18);
    } else if (cs === "fall") {
      player.vy += 1300 * dt;
      player.y += player.vy * dt;
      player.moving = 0;
      if (player.y >= GROUND) {
        player.y = GROUND;
        player.vy = 0;
        player.climbState = "ground";
        player.tree = null;
        player.inv = Math.max(player.inv, 1);
        dustAt(player.x, 8, 60);
      }
    } else if (player.tree) {
      const t = player.tree;
      player.vx = 0;
      if (cs === "up") {
        player.climb = clamp(player.climb + dt * 2.3, 0, 1);
        player.moving = 1;
        player.walk += dt * 18;
        if (player.climb >= 1) player.climbState = "perch";
      } else if (cs === "down") {
        player.climb = clamp(player.climb - dt * 2.6, 0, 1);
        player.moving = 1;
        player.walk += dt * 18;
        if (player.climb <= 0) {
          player.climbState = "ground";
          player.tree = null;
          dustAt(player.x, 4, 30);
        }
      } else {
        player.climb = 1;
        player.moving = 0;
        if (input.left || input.right) {
          player.climbState = "down";
          Sfx.tree();
        }
      }
      if (player.tree) {
        const e = easeInOut(player.climb);
        player.y = lerp(GROUND, t.climbY, e);
        player.x = lerp(t.x, t.x + 36, Math.max(0, (player.climb - 0.72) / 0.28));
      }
    }

    // 조준
    S.target = pickTarget();
    S.manualT = Math.max(0, S.manualT - dt);
    const aim = aimPoint();
    const m = muzzle();
    if (aim) {
      const wantFace = aim.x >= player.x ? 1 : -1;
      if (Math.abs(aim.x - player.x) > 12) player.face = wantFace;
      const dx = Math.max(6, (aim.x - m.px) * player.face);
      const a = clamp(Math.atan2(aim.y - m.py, dx), -0.95, 0.55);
      player.aimA = lerp(player.aimA, a, 1 - Math.pow(0.0002, dt));
    } else {
      if (Math.abs(player.vx) > 20) player.face = player.vx > 0 ? 1 : -1;
      player.aimA = lerp(player.aimA, 0, 1 - Math.pow(0.002, dt));
    }

    if (player.x > S.farthestX) {
      S.score += (player.x - S.farthestX) * 0.12;
      S.farthestX = player.x;
    }

    const lookX = player.x - W * (player.face > 0 ? 0.36 : 0.62);
    S.cameraX = lerp(S.cameraX, Math.max(0, lookX), 1 - Math.pow(0.04, dt));
    if (input.fire || input.canvasFire) fire();
  }

  function step(dt) {
    if (S.phase !== "play" && S.phase !== "dying") return;
    if (S.paused) return;
    S.time += dt;
    if (coachTimer > 0) {
      coachTimer -= dt;
      if (coachTimer <= 0) ui.coach.classList.remove("show");
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) ui.banner.className = "banner";
    }
    if (S.hitStop > 0) {
      S.hitStop -= dt;
      return;
    }
    if (S.slowT > 0) {
      S.slowT -= dt;
      dt *= 0.35;
    }
    S.fireCd = Math.max(0, S.fireCd - dt);
    S.shake = Math.max(0, S.shake - dt * 22);
    S.flash = Math.max(0, S.flash - dt);
    S.boostT = Math.max(0, S.boostT - dt);
    if (S.comboT > 0) {
      S.comboT -= dt;
      if (S.comboT <= 0) {
        S.combo = 0;
        hudNow();
      }
    }
    if (layerFade > 0) {
      layerFade = Math.max(0, layerFade - dt * 0.7);
      if (layerFade <= 0) oldLayers = null;
    }

    if (S.phase === "dying") {
      S.dyingT -= dt;
      updateFx(dt);
      if (player.climbState === "fall") {
        player.vy += 1300 * dt;
        player.y = Math.min(GROUND, player.y + player.vy * dt);
      }
      if (S.dyingT <= 0) endGame();
      return;
    }

    updatePlayer(dt);
    ensureTrees();

    // 구역 넘기기
    if (S.nextZoneT > 0) {
      S.nextZoneT -= dt;
      if (S.nextZoneT <= 0) nextZone();
    }

    // 공룡 부르기
    if (!S.boss && S.nextZoneT <= 0) {
      if (S.zoneKills >= zoneGoal()) {
        spawnBoss();
      } else {
        S.spawnAcc += dt;
        const lvl = S.zone + S.loop * 2;
        const every = Math.max(0.8, 2.25 - lvl * 0.2 - S.zoneKills * 0.02);
        const cap = Math.min(9, 3 + lvl);
        if (S.spawnAcc >= every && S.dinos.length < cap) {
          S.spawnAcc = 0;
          spawnDino(pickType());
          if (lvl >= 3 && Math.random() < 0.25) spawnDino(pickType());
        }
      }
    }

    // 공룡 움직임
    for (const d of S.dinos) {
      d.flash = Math.max(0, d.flash - dt);
      const dir = Math.sign(player.x - d.x) || 1;
      if (d.flying) updateFlyer(d, dt, dir);
      else updateWalker(d, dt, dir);
      if (Math.abs(d.vx) > 8) d.face = d.vx > 0 ? 1 : -1;
    }
    // 땅 공룡끼리 겹치지 않게
    for (let i = 0; i < S.dinos.length; i += 1) {
      const a = S.dinos[i];
      if (a.flying || a.state !== "walk") continue;
      for (let j = i + 1; j < S.dinos.length; j += 1) {
        const b = S.dinos[j];
        if (b.flying || b.state !== "walk") continue;
        const dx = a.x - b.x;
        const need = (a.w + b.w) * 0.32;
        if (Math.abs(dx) < need) {
          const push = (need - Math.abs(dx)) * 0.5 * dt * 8 * (dx >= 0 ? 1 : -1);
          a.x += push;
          b.x -= push;
        }
      }
    }
    for (const t of S.trees) {
      if (player.tree !== t || player.climbState !== "perch") t.shake = Math.max(0, t.shake - dt * 2);
      else t.shake = Math.max(0, t.shake - dt * 0.25);
    }

    // 총알
    for (const b of S.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      for (const d of S.dinos) {
        if (d.hp <= 0 || b.hit === d) continue;
        const q = d.w * 0.46;
        if (b.x > d.x - q && b.x < d.x + q && b.y > d.y - d.h && b.y < d.y) {
          d.hp -= b.dmg;
          d.flash = 0.1;
          b.hit = d;
          b.pierce -= 1;
          if (b.pierce < 0) b.life = 0;
          burst(b.x, b.y, "#fff1b0", 5, 130, "spark");
          Sfx.hit();
          floatText(d.x + rand(-14, 14), d.y - d.h - 2, String(Math.round(b.dmg * 10) / 10), "#fff");
          if (!d.boss && !d.flying && d.state === "walk") d.vx += Math.sign(b.vx) * (d.w < 120 ? 34 : 12);
          if (d.hp <= 0) killDino(d);
          break;
        }
      }
      if (b.life > 0) {
        for (const s of S.shots) {
          if (s.hp > 0 && Math.hypot(s.x - b.x, s.y - b.y) < s.r + 4) {
            s.hp = 0;
            b.life = 0;
            S.score += 20;
            burst(s.x, s.y, "#cdb99a", 8, 120, "dust");
            break;
          }
        }
      }
    }

    // 바위 · 가시
    for (const s of S.shots) {
      s.life -= dt;
      s.rot += dt * (s.kind === "rock" ? 3 : 6);
      if (s.kind === "rock") {
        s.vy += 340 * dt;
        s.y += s.vy * dt;
      } else {
        s.vy += 620 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot = Math.atan2(s.vy, s.vx);
      }
      if (s.y >= GROUND - 4) {
        s.hp = 0;
        dustAt(s.x, 5, 50);
        if (s.kind === "rock") {
          S.shake = Math.max(S.shake, 2);
          Sfx.stomp();
        }
        continue;
      }
      const py = player.y - 50;
      if (s.hp > 0 && Math.abs(s.x - player.x) < 18 + s.r && Math.abs(s.y - py) < 48 + s.r) {
        s.hp = 0;
        hurtPlayer(s.kind === "rock" ? 14 : 10);
      }
    }

    // 몸으로 부딪힘
    for (const d of S.dinos) {
      if (d.hp <= 0) continue;
      const lifted = player.climbState === "perch" || (player.climbState === "up" && player.climb > 0.55);
      if (!d.flying && lifted) continue;
      if (d.flying && d.state !== "dive") continue;
      const qx = d.w * (d.flying ? 0.3 : 0.34);
      const top = d.y - d.h * (d.flying ? 0.85 : 0.82);
      const bottom = d.y - (d.flying ? d.h * 0.2 : 0);
      const pTop = player.y - 88;
      const hit = player.x + 15 > d.x - qx && player.x - 15 < d.x + qx && player.y > top && pTop < bottom;
      if (hit) {
        const diving = d.state === "dive";
        const heavy = d.state === "charge" || d.state === "air" || diving;
        const did = hurtPlayer(Math.round(d.damage * (heavy ? 1.2 : 1)), d.state === "charge" ? "돌진은 나무로 피하세요!" : null);
        if (did) {
          knockPlayer(d.x);
          burst(player.x, player.y - 50, "#ffcfa8", 10, 150, "spark");
        }
        if (diving) {
          d.state = "climb";
          d.t = 0.9;
          d.vy = -230;
        }
      }
    }

    // 먹을 것
    for (const it of S.items) {
      it.t += dt;
      it.life -= dt;
      if (player.climbState === "ground" && Math.abs(it.x - player.x) < 34) {
        it.life = 0;
        Sfx.pick();
        if (it.kind === "meat") {
          player.hp = Math.min(100, player.hp + 25);
          floatText(player.x, player.y - 104, "체력 +25", "#9dffa0", true);
        } else if (it.kind === "boost") {
          S.boostT = 8;
          floatText(player.x, player.y - 104, "연사 UP!", "#9fd8ff", true);
        } else {
          S.score += 300;
          floatText(player.x, player.y - 104, "+300", "#ffe56a", true);
        }
        burst(it.x, it.y, "#fff4b8", 12, 130, "star");
        hudNow();
      }
    }

    const cullL = player.x - 620;
    const cullR = player.x + 760;
    // 보스는 멀어져도 지우지 않고 화면 가까이로 데려온다 (지우면 다음 구역으로 못 간다)
    if (S.boss && Math.abs(S.boss.x - player.x) > 460) {
      const side = S.boss.x > player.x ? 1 : -1;
      S.boss.x = player.x + side * 330;
      S.boss.vx = -side * Math.abs(S.boss.vx) * 0.5;
      if (S.boss.state === "charge") {
        S.boss.state = "rest";
        S.boss.t = 0.4;
      }
    }
    S.dinos = S.dinos.filter((d) => d.hp > 0 && (d.boss || (d.x > cullL && d.x < cullR)));
    S.bullets = S.bullets.filter((b) => b.life > 0 && b.y > -40 && b.y < H + 40);
    S.shots = S.shots.filter((s) => s.hp > 0 && s.life > 0);
    S.items = S.items.filter((i) => i.life > 0);
    updateFx(dt);

    if (player.hp <= 35 && player.hp > 0) hint("low", "체력이 낮아요! 고기를 찾거나 나무로 피하세요", 2.4);

    S.hudT -= dt;
    if (S.hudT <= 0) hudNow();
  }

  function updateFx(dt) {
    for (const p of S.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
      if (p.kind === "shell" && p.y > GROUND - 2) {
        p.y = GROUND - 2;
        p.vy *= -0.4;
        p.vx *= 0.6;
      }
    }
    S.particles = S.particles.filter((p) => p.life > 0);
    for (const f of S.floats) {
      f.y -= (f.big ? 34 : 44) * dt;
      f.life -= dt;
    }
    S.floats = S.floats.filter((f) => f.life > 0);
    for (const c of S.corpses) {
      c.life -= dt;
      if (c.flying && !c.grounded) {
        c.vy += 700 * dt;
        c.y += c.vy * dt;
        c.x += c.vx * dt;
        c.rot += c.vr * dt * 0.5;
        if (c.y >= GROUND - 6) {
          c.y = GROUND - 6;
          c.grounded = true;
          dustAt(c.x, 8, 60);
          c.vy = 0;
        }
      } else if (!c.flying) {
        c.rot = lerp(c.rot, 1.4 * Math.sign(c.vr), 1 - Math.pow(0.02, dt));
        c.x += c.vx * dt;
        c.vx *= Math.pow(0.05, dt);
      }
    }
    S.corpses = S.corpses.filter((c) => c.life > 0);
  }

  /* ---------- 그리기 ---------- */
  function drawLayer(l, top, offset, alpha = 1) {
    if (!l) return;
    const off = mod(offset, LOOP);
    ctx.globalAlpha = alpha;
    ctx.drawImage(l.c, -off, top, LOOP, l.hh);
    if (off > LOOP - W - 2) ctx.drawImage(l.c, LOOP - off - 0.6, top, LOOP, l.hh);
    ctx.globalAlpha = 1;
  }

  function drawBackParts(L, a) {
    drawLayer(L.far, 0, S.cameraX * 0.22, a);
    drawLayer(L.mid, L.midTop, S.cameraX * 0.55, a);
    drawLayer(L.near, L.nearTop, S.cameraX * 0.8, a);
    drawLayer(L.ground, L.groundTop, S.cameraX, a);
  }

  function drawRig(img, d, w, h, phase, moving) {
    const rig = d.rig;
    const iw = img.width || img.naturalWidth;
    const ih = img.height || img.naturalHeight;
    if (rig.legs) {
      const [x0, x1, ly, split] = rig.legs;
      const rows = 4;
      for (const [a, b, sign] of [
        [split, x1, -1],
        [x0, split, 1],
      ]) {
        for (let r = 0; r < rows; r += 1) {
          const v0 = ly + ((1 - ly) * r) / rows;
          const v1 = ly + ((1 - ly) * (r + 1)) / rows;
          const depth = (r + 0.5) / rows;
          const dx = sign * Math.sin(phase) * rig.stride * d.k * depth * moving;
          const lift = -Math.max(0, sign * Math.cos(phase)) * rig.lift * d.k * depth * moving;
          ctx.drawImage(img, a * iw, v0 * ih, (b - a) * iw, (v1 - v0) * ih + 0.8, -w / 2 + a * w + dx, -h + v0 * h + lift, (b - a) * w, (v1 - v0) * h + 0.6);
        }
      }
      const n = 12;
      const bob = Math.abs(Math.sin(phase)) * 1.6 * d.k * moving;
      for (let i = 0; i < n; i += 1) {
        const u0 = i / n;
        const u1 = (i + 1) / n;
        const um = (u0 + u1) / 2;
        let dy = -bob;
        if (um < rig.head[0]) dy += (Math.sin(phase * 0.5 + 1) * rig.head[1] * d.k * (rig.head[0] - um)) / rig.head[0];
        if (um > rig.tail[0]) dy += (Math.sin(phase * 0.7 + um * 5) * rig.tail[1] * d.k * (um - rig.tail[0])) / (1 - rig.tail[0]);
        const cut = um > x0 && um < x1 ? ly + 0.01 : 1;
        ctx.drawImage(img, u0 * iw, 0, (u1 - u0) * iw + 0.6, cut * ih, -w / 2 + u0 * w, -h + dy, (u1 - u0) * w + 0.5, cut * h);
      }
    } else {
      // 날개: 몸통을 축으로 세로로 늘였다 줄인다
      const n = 34;
      const s = Math.sin(phase);
      for (let i = 0; i < n; i += 1) {
        const u0 = i / n;
        const u1 = (i + 1) / n;
        const um = (u0 + u1) / 2;
        const side = um - rig.split;
        const isBig = rig.big > 0 ? side > 0 : side < 0;
        const reach = Math.abs(side) / (isBig ? (rig.big > 0 ? 1 - rig.split : rig.split) : rig.big > 0 ? rig.split : 1 - rig.split);
        const a = s * (isBig ? rig.ampBig : rig.ampSmall) * reach;
        const dh = h * (1 + a);
        const top = -h + rig.pivot * h - rig.pivot * dh;
        ctx.drawImage(img, u0 * iw, 0, (u1 - u0) * iw + 0.6, ih, -w / 2 + u0 * w, top, (u1 - u0) * w + 0.5, dh);
      }
    }
  }

  function drawDino(d) {
    const q = sx(d.x);
    if (q < -d.w || q > W + d.w) return;
    const img = images[d.def.file];
    if (!img) return;
    // 그림자
    const hgt = clamp((GROUND - d.y) / 400, 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - hgt * 0.7)})`;
    ctx.beginPath();
    ctx.ellipse(q, GROUND + 2, d.w * (0.36 - hgt * 0.14), 6 * d.scale * (1 - hgt * 0.5), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(q, d.y);
    ctx.rotate(d.lean || 0);
    // 그림이 보는 방향(native)과 가는 방향이 다르면 뒤집는다
    if (d.face !== d.def.native) ctx.scale(-1, 1);
    if (d.state === "wind" && !d.flying) ctx.scale(1.04, 0.95);
    const view = { rig: d.def.rig, k: d.scale };
    const moving = d.flying ? 1 : clamp(Math.abs(d.vx) / Math.max(1, d.speed), 0, 1.4);
    drawRig(img, view, d.w, d.h, d.phase, moving);
    if (d.flash > 0 && whites[d.def.file]) {
      ctx.globalAlpha = Math.min(1, d.flash * 8);
      drawRig(whites[d.def.file], view, d.w, d.h, d.phase, moving);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 경고 표시
    if (d.state === "wind" || d.state === "telegraph") {
      const bx = q;
      const by = d.y - d.h - 20 + Math.sin(S.time * 16) * 2;
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "#5a2a10";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#5a2a10";
      ctx.font = '700 16px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("!", bx, by + 6);
    }
    // 체력
    if (!d.boss && d.hp < d.maxHp) {
      const bw = Math.max(36, d.w * 0.42);
      const ratio = clamp(d.hp / d.maxHp, 0, 1);
      const by = d.y - d.h - 6;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(q - bw / 2 - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = ratio > 0.4 ? "#9dff7a" : "#ff8a5a";
      ctx.fillRect(q - bw / 2, by, bw * ratio, 4);
    }
  }

  function drawCorpse(c) {
    const img = images[c.def.file];
    if (!img) return;
    const alpha = clamp(c.life / 0.5, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx(c.x), c.y - c.h * 0.2);
    ctx.rotate(c.rot * 0.55);
    if (c.face !== c.def.native) ctx.scale(-1, 1);
    ctx.drawImage(img, -c.w / 2, -c.h * 0.8, c.w, c.h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawHunterBody(img, w, h, withFace) {
    const iw = img.width || img.naturalWidth;
    const ih = img.height || img.naturalHeight;
    const waist = 0.48;
    const moving = player.moving;
    const ph = player.walk;
    // 다리 (두 쪽을 가위처럼)
    const rows = 5;
    for (const [a, b, sign] of [
      [0.46, 1, -1],
      [0, 0.46, 1],
    ]) {
      for (let r = 0; r < rows; r += 1) {
        const v0 = waist + ((1 - waist) * r) / rows;
        const v1 = waist + ((1 - waist) * (r + 1)) / rows;
        const depth = (r + 0.5) / rows;
        const dx = sign * Math.sin(ph) * 11 * depth * moving;
        const lift = -Math.max(0, sign * Math.cos(ph)) * 5 * depth * moving;
        ctx.drawImage(img, a * iw, v0 * ih, (b - a) * iw, (v1 - v0) * ih + 0.8, -w * 0.45 + a * w + dx, -h + v0 * h + lift, (b - a) * w, (v1 - v0) * h + 0.5);
      }
    }
    // 윗몸 (조준 방향으로 돌아간다)
    const bob = Math.abs(Math.sin(ph)) * 2 * moving;
    ctx.save();
    ctx.translate(-0.03 * w, -0.53 * h - bob);
    ctx.rotate(player.aimA);
    ctx.translate(-player.recoil * 4, 0);
    ctx.drawImage(img, 0, 0, iw, (waist + 0.01) * ih, -0.42 * w, -0.47 * h, w, (waist + 0.01) * h);
    if (withFace && window.TodayFace) TodayFace.drawHead(ctx, 0.01 * w, -0.375 * h, w * 0.12);
    ctx.restore();
  }

  function drawPlayer() {
    const img = images.hunter;
    if (!img) return;
    const q = sx(player.x);
    if (player.climbState === "ground") {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(q, GROUND + 2, 24, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const blink = player.inv > 0 && Math.floor(player.inv * 14) % 2 === 0 && S.phase === "play";
    ctx.save();
    ctx.translate(q, player.y);
    if (S.phase === "dying") ctx.rotate(player.face * clamp((0.95 - S.dyingT) * 2, 0, 1.3));
    if (blink) ctx.globalAlpha = 0.45;
    if (player.climbState === "up" || player.climbState === "down") ctx.rotate(player.face * Math.sin(player.walk) * 0.05);
    ctx.scale(player.face, 1);
    drawHunterBody(img, 70, 108, true);
    if (player.hurtFlash > 0 && whites.hunter) {
      ctx.globalAlpha = Math.min(1, player.hurtFlash * 3);
      drawHunterBody(whites.hunter, 70, 108, false);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (player.fireFlash > 0) {
      const m = muzzle();
      const mx = sx(m.x);
      const a = player.face > 0 ? player.aimA : Math.PI - player.aimA;
      const color = weapon().color;
      const s = weapon().id === "shotgun" ? 20 : 13;
      ctx.save();
      ctx.translate(mx, m.y);
      ctx.rotate(a);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.35);
      ctx.lineTo(s * 1.6, 0);
      ctx.lineTo(0, s * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(1, 0, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTree(t) {
    const q = sx(t.x);
    if (q < -130 || q > W + 130 || !images.tree) return;
    const tw = 190;
    const th = 348;
    const wob = t.shake > 0.3 ? Math.sin(S.time * 42) * Math.min(3.4, t.shake * 0.7) : 0;
    ctx.save();
    ctx.translate(q + wob, GROUND + 12);
    ctx.drawImage(images.tree, -tw / 2, -th, tw, th);
    ctx.restore();
    if (player.climbState === "ground" && Math.abs(player.x - t.x) < 66 && S.phase === "play") {
      const by = GROUND - 150 + Math.sin(S.time * 6) * 3;
      ctx.fillStyle = "rgba(20,30,14,0.75)";
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(q - 32, by - 14, 64, 22, 11) : ctx.rect(q - 32, by - 14, 64, 22);
      ctx.fill();
      ctx.fillStyle = "#ffe16a";
      ctx.font = '13px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("▲ 나무", q, by + 2);
    }
  }

  function drawItem(it) {
    const q = sx(it.x);
    if (q < -30 || q > W + 30) return;
    const y = it.y - Math.abs(Math.sin(it.t * 3.4)) * 8;
    const fade = it.life < 2 ? (Math.floor(it.life * 8) % 2 ? 0.45 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(q, GROUND + 1, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(q, y, 2, q, y, 24);
    glow.addColorStop(0, "rgba(255,245,180,0.55)");
    glow.addColorStop(1, "rgba(255,245,180,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(q, y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(q, y);
    if (it.kind === "meat") {
      ctx.rotate(-0.5);
      ctx.fillStyle = "#f4efe2";
      ctx.fillRect(4, -2.5, 13, 5);
      ctx.beginPath();
      ctx.arc(17, -3, 3, 0, Math.PI * 2);
      ctx.arc(17, 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b5532e";
      ctx.beginPath();
      ctx.ellipse(-3, 0, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d9794a";
      ctx.beginPath();
      ctx.ellipse(-5, -3, 6, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === "boost") {
      ctx.fillStyle = "#3a8fe0";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff36a";
      ctx.beginPath();
      ctx.moveTo(3, -9);
      ctx.lineTo(-5, 2);
      ctx.lineTo(0, 2);
      ctx.lineTo(-3, 9);
      ctx.lineTo(5, -2);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "#b97f10";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 ? 5.5 : 12;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShot(s) {
    const q = sx(s.x);
    if (s.kind === "rock") {
      // 떨어질 자리 그림자
      const a = clamp(1 - (GROUND - s.y) / (GROUND + 30), 0.15, 0.7);
      ctx.fillStyle = `rgba(90,20,10,${a})`;
      ctx.beginPath();
      ctx.ellipse(q, GROUND + 2, 12 + a * 14, 4 + a * 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(q, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = "#7f7263";
      ctx.beginPath();
      ctx.moveTo(-15, -4);
      ctx.lineTo(-7, -14);
      ctx.lineTo(8, -13);
      ctx.lineTo(15, -2);
      ctx.lineTo(9, 12);
      ctx.lineTo(-8, 13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#a2957f";
      ctx.beginPath();
      ctx.moveTo(-8, -7);
      ctx.lineTo(-3, -11);
      ctx.lineTo(6, -9);
      ctx.lineTo(2, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(q, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = "#c9a15a";
      ctx.strokeStyle = "#5a3c18";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-9, -6);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-9, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of S.bullets) {
      const q = sx(b.x);
      if (q < -40 || q > W + 40) continue;
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(q, b.y);
      ctx.rotate(a);
      if (b.plasma) {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 12);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.4, "rgba(224,168,255,0.7)");
        g.addColorStop(1, "rgba(224,168,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(-22, -1, 22, 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fffdf0";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawAim() {
    if (S.phase !== "play") return;
    const aim = aimPoint();
    if (!aim) return;
    const ax = sx(aim.x);
    const ay = aim.y;
    const m = muzzle();
    const firing = input.fire || input.canvasFire;
    ctx.save();
    ctx.strokeStyle = firing ? "rgba(255,245,180,0.32)" : "rgba(255,245,180,0.18)";
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx(m.x), m.y);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(ax, ay);
    ctx.rotate(S.time * 1.6);
    ctx.strokeStyle = aim.manual ? "rgba(255,240,160,0.95)" : "rgba(255,120,90,0.95)";
    ctx.lineWidth = 2;
    const r = 13 + (firing ? Math.sin(S.time * 30) * 1.2 : 0);
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.arc(0, 0, r, -0.42, 0.42);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r + 2, 0);
      ctx.lineTo(r + 7, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFx() {
    for (const p of S.particles) {
      const q = sx(p.x);
      if (q < -20 || q > W + 20) continue;
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      if (p.kind === "star") {
        ctx.save();
        ctx.translate(q, p.y);
        ctx.rotate(p.rot);
        const s = p.size * 1.3;
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const r = i % 2 ? s * 0.32 : s;
          const a = (i * Math.PI) / 4;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === "shell") {
        ctx.save();
        ctx.translate(q, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-2.4, -1, 4.8, 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(q, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const f of S.floats) {
      ctx.globalAlpha = clamp(f.life / (f.max * 0.5), 0, 1);
      ctx.font = `${f.big ? 22 : 14}px "Jua", sans-serif`;
      ctx.lineWidth = f.big ? 4 : 3;
      ctx.strokeStyle = "rgba(40,20,8,0.8)";
      ctx.strokeText(f.text, sx(f.x), f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx(f.x), f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes() {
    const col = ZONES[S.zone].pal.mote;
    ctx.fillStyle = col;
    for (const m of S.motes) {
      m.y -= m.v * 0.008;
      m.x -= m.v * 0.004;
      if (m.y < 60) m.y = H - 150;
      const px = mod(m.x - S.cameraX * 0.5, W);
      ctx.globalAlpha = 0.25 + Math.sin(S.time * 2 + m.p) * 0.22;
      ctx.beginPath();
      ctx.arc(px, m.y, m.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    const sh = S.shake;
    const ox = sh > 0 ? rand(-sh, sh) : 0;
    const oy = sh > 0 ? rand(-sh, sh) : 0;
    ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "medium";

    if (!layers) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#6fa8c8");
      g.addColorStop(0.6, "#4f8a52");
      g.addColorStop(1, "#2d3a24");
      ctx.fillStyle = g;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      return;
    }

    if (S.phase === "title") {
      S.time += 1 / 60;
      S.cameraX += 0.3;
    }
    drawBackParts(layers, 1);
    if (oldLayers && layerFade > 0) drawBackParts(oldLayers, layerFade);
    drawMotes();

    for (const t of S.trees) drawTree(t);
    for (const it of S.items) drawItem(it);
    for (const c of S.corpses) drawCorpse(c);
    for (const d of S.dinos) if (!d.flying) drawDino(d);
    if (S.phase !== "title") drawPlayer();
    for (const d of S.dinos) if (d.flying) drawDino(d);
    for (const s of S.shots) drawShot(s);
    drawBullets();
    drawFx();

    if (layers.fore) drawLayer(layers.fore, layers.foreTop, S.cameraX * 1.25, 1);

    drawAim();

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (vignette) ctx.drawImage(vignette, 0, 0, W, H);
    if (S.phase === "play" && player.hp <= 35) {
      const a = 0.22 + Math.sin(S.time * 5) * 0.12;
      const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.72);
      g.addColorStop(0, "rgba(255,40,30,0)");
      g.addColorStop(1, `rgba(255,40,30,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (S.flash > 0) {
      ctx.fillStyle = `rgba(${S.flashColor},${Math.min(0.5, S.flash * 0.6)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // 누운 화면 안내용이 아니라, 게임 영역 밖이 보이지 않게
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  let lastT = 0;
  let accum = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000 || 0));
    lastT = now;
    if (!S.paused) {
      accum += dt;
      let guard = 0;
      while (accum >= STEP && guard < 12) {
        step(STEP);
        accum -= STEP;
        guard += 1;
      }
      if (accum > 0.1) accum = 0;
    }
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- 조작 ---------- */
  function bindHold(el, on, off) {
    const start = (e) => {
      e.preventDefault();
      Sfx.unlock();
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      el.classList.add("held");
      on();
    };
    const end = (e) => {
      e.preventDefault();
      el.classList.remove("held");
      off();
    };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("lostpointercapture", () => {
      el.classList.remove("held");
      off();
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  bindHold($("left-btn"), () => (input.left = true), () => (input.left = false));
  bindHold($("right-btn"), () => (input.right = true), () => (input.right = false));
  bindHold(
    $("fire-btn"),
    () => {
      input.fire = true;
      fire();
    },
    () => (input.fire = false)
  );
  ui.climb.addEventListener("click", tryClimb);
  $("start-btn").addEventListener("click", startGame);
  $("retry-btn").addEventListener("click", startGame);

  function pointerToGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * W, 6, W - 6), y: clamp(((e.clientY - r.top) / r.height) * H, 6, H - 6) };
  }
  canvas.addEventListener("pointermove", (e) => {
    if (S.phase !== "play") return;
    const p = pointerToGame(e);
    if (e.pointerType === "mouse") S.mouseAim = true;
    else if (!S.aiming) return;
    S.aimX = p.x;
    S.aimY = p.y;
    if (S.aiming) S.manualT = 1.2;
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (S.phase !== "play") return;
    e.preventDefault();
    Sfx.unlock();
    S.aiming = true;
    const p = pointerToGame(e);
    S.aimX = p.x;
    S.aimY = p.y;
    S.manualT = 1.2;
    if (e.pointerType === "mouse") S.mouseAim = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    input.canvasFire = true;
    fire();
  });
  const endCanvas = () => {
    S.aiming = false;
    input.canvasFire = false;
  };
  canvas.addEventListener("pointerup", endCanvas);
  canvas.addEventListener("pointercancel", endCanvas);

  const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "Space"];
  window.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (!KEYS.includes(e.code)) return;
    e.preventDefault();
    Sfx.unlock();
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
    if (e.code === "Space") input.fire = true;
    if ((e.code === "KeyW" || e.code === "ArrowUp") && !e.repeat) tryClimb();
    if (e.code === "ArrowDown" && !e.repeat && player.climbState === "perch") tryClimb();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
    if (e.code === "Space") input.fire = false;
  });

  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => S.phase === "play",
      isPaused: () => S.paused,
      pause: () => {
        S.paused = true;
        input.fire = false;
        input.left = false;
        input.right = false;
        input.canvasFire = false;
      },
      resume: () => {
        S.paused = false;
        lastT = performance.now();
        accum = 0;
      },
    });
  }
  if (window.TodayGameRank) {
    window.TodayGameRank.mount({ gameId: "dino-hunt", gameTitle: "공룡 헌터", formParent: ui.over });
  }

  window.addEventListener("resize", resize);
  resize();
  makeMotes();
  ensureTrees();
  loadImages().then(() => {
    rebake();
    window.DinoHunt.ready = true;
  });
  updateHud();
  document.body.classList.remove("in-play");
  requestAnimationFrame(frame);

  window.DinoHunt = {
    ready: false,
    S,
    player,
    input,
    TYPES,
    ZONES,
    WEAPONS,
    step,
    start: startGame,
    tryClimb,
    spawnDino,
    get ground() {
      return GROUND;
    },
    get H() {
      return H;
    },
    get screen() {
      return S.phase;
    },
    nearestTree,
    fire,
  };
})();
