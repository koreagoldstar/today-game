(() => {
  "use strict";

  /*
   * 스피드 삐약이
   *  - 화면 픽셀에 맞춰 그려 그림이 또렷함 (캔버스를 늘리지 않음)
   *  - 스테이지 50개 · 월드 5개 · 하트 3개 · 진행 저장
   *  - 차들은 같은 줄끼리 같은 속도로 달리고, 한 줄에 늘 빈 차선이 있음
   */
  const W = 390;
  const LANES = 3;
  const ROAD_X = 58;
  const ROAD_W = W - ROAD_X * 2;
  const LANE_W = ROAD_W / LANES;
  const LERP = 15;
  const BASE_SPEED = 210;
  const M_PER_PX = 0.1;
  const BEST_KEY = "speed-bbaek-best";
  const SAVE_KEY = "speed-bbaek-save";
  const TOTAL = 50;
  const TILE_H = 480;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);

  /* 카트 그림에서 병아리 머리 자리 [가로, 세로, 반지름(너비 기준)] */
  const FACE = [0.523, 0.72, 0.17];
  const KART_W = 66;
  const KART_H = KART_W * (666 / 504);
  const CAR_H = 86;

  const WORLDS = [
    { name: "초록 들판", ground: ["#86d662", "#78cb56"], patch: "rgba(255,255,255,0.1)", road: ["#5d6675", "#6c7584"], curb: "#ff5f6e", tree: "tree", flowers: ["#fff", "#ffd84a", "#ff9cc2"] },
    { name: "벚꽃 길", ground: ["#9cdf78", "#8dd46c"], patch: "rgba(255,190,220,0.3)", road: ["#646a7c", "#737a8c"], curb: "#ff7fae", tree: "tree_pink", flowers: ["#ffb3d1", "#fff", "#ff8ab5"], weather: "petal" },
    { name: "바닷가", ground: ["#f6e3ab", "#efd896"], patch: "rgba(200,160,90,0.14)", road: ["#5f6a7a", "#6d7888"], curb: "#39b6e8", tree: "tree", flowers: ["#fff", "#ffd27a", "#f7c1a0"], sea: true },
    { name: "단풍 고개", ground: ["#cfc964", "#c2bb55"], patch: "rgba(214,110,50,0.2)", road: ["#60606e", "#6f6f7e"], curb: "#ff8a3c", tree: "tree_fall", flowers: ["#ff9a4a", "#ffd24a", "#e8643c"], weather: "leaf" },
    { name: "눈 오는 밤", ground: ["#eef5fb", "#e2edf6"], patch: "rgba(150,190,230,0.22)", road: ["#4d5668", "#5a6478"], curb: "#6ec6ff", tree: "tree_snow", flowers: ["#fff", "#cfe6ff", "#fff"], weather: "snow", night: true },
  ];
  const worldOf = (i) => WORLDS[Math.min(WORLDS.length - 1, Math.floor(i / 10))];

  /** 스테이지 값: 뒤로 갈수록 빠르고 차가 많아짐. 줄 간격은 시간으로 잡아 늘 피할 틈이 있음 */
  function stageParams(i) {
    const t = clamp(i / (TOTAL - 1), 0, 1);
    return {
      goal: Math.round(300 + i * 24),
      speed: 1 + t * 1.12,
      rowTime: lerp(1.75, 0.98, t),
      rel: lerp(0.46, 0.42, t),
      double: i < 3 ? 0 : clamp(0.12 + t * 0.54, 0, 0.66),
      changer: i < 10 ? 0 : 0.1 + t * 0.26,
    };
  }

  const NAMES = ["player", "car_red", "car_blue", "car_green", "car_purple", "car_orange", "tree", "tree_pink", "tree_fall", "tree_snow", "cone"];
  const imgs = {};
  function loadAssets() {
    return Promise.all(
      NAMES.map(
        (n) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              imgs[n] = im;
              res();
            };
            im.onerror = () => res();
            im.src = `assets/${n}.webp`;
          })
      )
    );
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
        this.buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
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
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.03);
    },
    noise(dur, freq, type, peak) {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = c.currentTime;
      const s = c.createBufferSource();
      s.buffer = this.buf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(c.destination);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.03);
    },
    engineOn() {
      if (!this.ctx || this.eng) return;
      const c = this.ctx;
      const o = c.createOscillator();
      o.type = "sawtooth";
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 340;
      const g = c.createGain();
      g.gain.value = 0;
      o.connect(f);
      f.connect(g);
      g.connect(c.destination);
      o.start();
      this.eng = { o, g, f };
    },
    engine(v, on) {
      if (!this.eng) return;
      const t = this.ctx.currentTime;
      this.eng.o.frequency.setTargetAtTime(58 + v * 0.17, t, 0.08);
      this.eng.g.gain.setTargetAtTime(on ? 0.028 : 0, t, 0.1);
    },
    move() {
      this.noise(0.09, 1300, "bandpass", 0.08);
    },
    coin(n) {
      const f = 880 * Math.pow(2, Math.min(n, 8) / 12);
      this.tone(f, 0.09, "sine", 0.13);
      this.tone(f * 1.5, 0.13, "sine", 0.09, 1, 0.05);
    },
    near() {
      this.noise(0.18, 2400, "highpass", 0.14);
      this.tone(1040, 0.08, "triangle", 0.09);
    },
    crash() {
      this.noise(0.42, 700, "lowpass", 0.5);
      this.tone(150, 0.3, "square", 0.14, 0.4);
    },
    boost() {
      this.tone(320, 0.5, "sawtooth", 0.09, 3.2);
      this.noise(0.5, 1800, "highpass", 0.12);
    },
    heart() {
      [660, 880, 1175].forEach((f, i) => this.tone(f, 0.14, "sine", 0.13, 1, i * 0.07));
    },
    beep(hi) {
      this.tone(hi ? 1175 : 660, hi ? 0.4 : 0.14, "square", 0.08);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.15, 1, i * 0.1));
    },
    star(i) {
      this.tone(880 + i * 220, 0.2, "triangle", 0.15);
    },
  };

  /* ---------- 화면 맞춤 ---------- */
  const stageEl = $("stage");
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  let H = 700;
  let PX = 1;
  let PLAYER_Y = 520;
  const tiles = new Map();
  let shadowSprite = null;

  function fit() {
    const r = stageEl.getBoundingClientRect();
    const cssW = Math.max(1, r.width);
    const cssH = Math.max(1, r.height);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const scale = cssW / W;
    H = cssH / scale;
    PX = scale * dpr;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    PLAYER_Y = H - 178;
    tiles.clear();
    shadowSprite = null;
  }

  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * PX);
    c.height = Math.ceil(h * PX);
    const g = c.getContext("2d");
    g.scale(PX, PX);
    return [c, g];
  }
  function rnd(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 도로 한 장을 미리 그려 둠 (세로로 이어 붙음) */
  function roadTile(T, idx) {
    const key = idx;
    if (tiles.has(key)) return tiles.get(key);
    const [c, g] = mk(W, TILE_H);
    const r = rnd(idx * 53 + 11);
    g.fillStyle = T.ground[0];
    g.fillRect(0, 0, W, TILE_H);
    // 잔디 결
    g.fillStyle = T.ground[1];
    for (let y = 0; y < TILE_H; y += 80) g.fillRect(0, y, W, 40);
    for (let i = 0; i < 26; i += 1) {
      const side = r() < 0.5;
      const x = side ? r() * (ROAD_X - 12) : W - ROAD_X + 12 + r() * (ROAD_X - 12);
      const y = r() * TILE_H;
      g.fillStyle = T.patch;
      g.beginPath();
      g.ellipse(x, y, 8 + r() * 14, 5 + r() * 8, 0, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 60; i += 1) {
      const side = r() < 0.5;
      const x = side ? r() * (ROAD_X - 16) : W - ROAD_X + 16 + r() * (ROAD_X - 16);
      const y = r() * TILE_H;
      const col = T.flowers[Math.floor(r() * T.flowers.length)];
      if (r() < 0.32) {
        g.fillStyle = col;
        for (let a = 0; a < 5; a += 1) {
          g.beginPath();
          g.arc(x + Math.cos((a / 5) * TAU) * 2.1, y + Math.sin((a / 5) * TAU) * 2.1, 1.5, 0, TAU);
          g.fill();
        }
        g.fillStyle = "#ffcf3f";
        g.beginPath();
        g.arc(x, y, 1.2, 0, TAU);
        g.fill();
      } else {
        g.fillStyle = "rgba(40,90,30,0.2)";
        g.fillRect(x, y, 1.3, 4);
      }
    }
    if (T.sea) {
      // 왼쪽 바다
      const grad = g.createLinearGradient(0, 0, 30, 0);
      grad.addColorStop(0, "#2aa7dc");
      grad.addColorStop(1, "#6fd6ef");
      g.fillStyle = grad;
      g.fillRect(0, 0, 24, TILE_H);
      g.fillStyle = "rgba(255,255,255,0.85)";
      for (let y = 0; y < TILE_H; y += 4) {
        g.fillRect(0, y, 24 + Math.sin((y / TILE_H) * TAU * 6) * 3 + Math.sin((y / TILE_H) * TAU * 14) * 1.5, 0);
      }
      g.beginPath();
      g.moveTo(24, 0);
      for (let y = 0; y <= TILE_H; y += 6) g.lineTo(24 + Math.sin((y / TILE_H) * TAU * 6) * 3 + Math.sin((y / TILE_H) * TAU * 14) * 1.5, y);
      g.lineTo(30, TILE_H);
      g.lineTo(30, 0);
      g.closePath();
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.fill();
    }
    // 길 어깨 그림자
    g.fillStyle = "rgba(20,30,20,0.22)";
    g.fillRect(ROAD_X - 12, 0, 3, TILE_H);
    g.fillRect(W - ROAD_X + 9, 0, 3, TILE_H);
    // 아스팔트
    const road = g.createLinearGradient(ROAD_X, 0, W - ROAD_X, 0);
    road.addColorStop(0, T.road[0]);
    road.addColorStop(0.5, T.road[1]);
    road.addColorStop(1, T.road[0]);
    g.fillStyle = road;
    g.fillRect(ROAD_X, 0, ROAD_W, TILE_H);
    // 알갱이
    for (let i = 0; i < 1500; i += 1) {
      g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
      g.fillRect(ROAD_X + r() * ROAD_W, r() * TILE_H, 1 + r() * 1.5, 1 + r() * 2.5);
    }
    // 바퀴 자국
    g.fillStyle = "rgba(20,24,34,0.1)";
    for (let l = 0; l < LANES; l += 1) {
      const cx = ROAD_X + LANE_W * (l + 0.5);
      g.fillRect(cx - 20, 0, 7, TILE_H);
      g.fillRect(cx + 13, 0, 7, TILE_H);
    }
    // 연석
    const cH = 24;
    for (let y = 0; y < TILE_H; y += cH) {
      const even = (y / cH) % 2 === 0;
      g.fillStyle = even ? "#ffffff" : T.curb;
      g.fillRect(ROAD_X - 9, y, 9, cH);
      g.fillRect(W - ROAD_X, y, 9, cH);
    }
    g.fillStyle = "rgba(0,0,0,0.14)";
    g.fillRect(ROAD_X - 1.5, 0, 1.5, TILE_H);
    g.fillRect(W - ROAD_X, 0, 1.5, TILE_H);
    // 차선
    g.fillStyle = "rgba(255,255,255,0.92)";
    for (let l = 1; l < LANES; l += 1) {
      const x = ROAD_X + LANE_W * l;
      for (let y = 0; y < TILE_H; y += 80) {
        g.beginPath();
        g.roundRect(x - 2, y + 18, 4, 44, 2);
        g.fill();
      }
    }
    tiles.set(key, c);
    return c;
  }
  function getShadow() {
    if (shadowSprite) return shadowSprite;
    const [c, g] = mk(100, 100);
    const gr = g.createRadialGradient(50, 50, 8, 50, 50, 50);
    gr.addColorStop(0, "rgba(16,22,36,0.5)");
    gr.addColorStop(0.65, "rgba(16,22,36,0.26)");
    gr.addColorStop(1, "rgba(16,22,36,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 100, 100);
    shadowSprite = c;
    return c;
  }

  /* ---------- 상태 ---------- */
  let state = "title";
  let stageIndex = 0;
  let endless = false;
  let score = 0;
  let scoreAtStart = 0;
  let bonusFloor = 0;
  let hearts = 3;
  let stageDist = 0;
  let totalDist = 0;
  let scroll = 0;
  let rowT = 0;
  let lastFree = 1;
  let speedNow = 0;
  let recover = 1;
  let boostT = 0;
  let invT = 0;
  let readyT = 0;
  let readyBeep = 4;
  let finishT = 0;
  let finishY = null;
  let shake = 0;
  let hitStop = 0;
  let time = 0;
  let last = 0;
  let coinChain = 0;
  let nearChain = 0;
  let stageCoins = 0;
  let player = { lane: 1, x: laneX(1), target: 1, tilt: 0, y: 0 };
  let enemies = [];
  let coins = [];
  let items = [];
  let decor = [];
  let particles = [];
  let floats = [];
  let weather = [];
  let world = WORLDS[0];
  let params = stageParams(0);

  function laneX(l) {
    return ROAD_X + LANE_W * (l + 0.5);
  }

  const save = (() => {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return { stage: clamp(Number(d.stage) || 0, 0, TOTAL - 1), score: Number(d.score) || 0, stars: d.stars || {} };
    } catch (_) {
      return { stage: 0, score: 0, stars: {} };
    }
  })();
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_) {
      /* 저장이 막혀 있어도 게임은 계속 */
    }
  }

  const overlays = { title: $("title"), clear: $("clear"), over: $("over"), all: $("allclear") };
  function showOverlay(key) {
    for (const [k, el] of Object.entries(overlays)) el.classList.toggle("hidden", k !== key);
    document.body.classList.toggle("in-play", !key);
  }

  function renderTitle() {
    const n = save.stage;
    $("start-btn").textContent = n > 0 ? `이어서 달리기 · ${n + 1}` : "출발!";
    $("restart-btn").hidden = n === 0;
    $("title-best").textContent = `최고 ${Number(localStorage.getItem(BEST_KEY) || 0).toLocaleString("ko-KR")}점`;
  }

  function drawHeartsDom() {
    const box = $("hud-hearts");
    let html = "";
    for (let i = 0; i < 3; i += 1) html += `<i class="${i < hearts ? "on" : ""}"></i>`;
    box.innerHTML = html;
  }
  let hudScore = -1;
  function updateHud() {
    $("hud-stage").textContent = endless ? "∞" : String(stageIndex + 1);
    if (hudScore !== score) {
      hudScore = score;
      $("hud-score").textContent = score.toLocaleString("ko-KR");
    }
    const pct = endless ? (stageDist % 500) / 500 : clamp(stageDist / params.goal, 0, 1);
    $("hud-bar").style.width = `${pct * 100}%`;
    $("hud-kmh").textContent = Math.round(speedNow * 0.62);
  }

  function resetStage() {
    params = endless ? { ...stageParams(TOTAL - 1), goal: Infinity } : stageParams(stageIndex);
    world = endless ? WORLDS[4] : worldOf(stageIndex);
    hearts = 3;
    stageDist = 0;
    rowT = 110;
    lastFree = 1;
    speedNow = 0;
    recover = 1;
    boostT = 0;
    invT = 0;
    readyT = 2.3;
    readyBeep = 4;
    finishT = 0;
    finishY = null;
    shake = 0;
    hitStop = 0;
    coinChain = 0;
    nearChain = 0;
    stageCoins = 0;
    player = { lane: 1, x: laneX(1), target: 1, tilt: 0, y: 0 };
    enemies = [];
    coins = [];
    items = [];
    particles = [];
    floats = [];
    fillDecor();
    fillWeather();
    drawHeartsDom();
    updateHud();
  }
  function fillDecor() {
    decor = [];
    let y = -140;
    while (y < H + 80) {
      decor.push(makeDecor(y));
      y += 54 + Math.random() * 46;
    }
  }
  function makeDecor(y) {
    const left = Math.random() < 0.5;
    const r = Math.random();
    const kind = r < 0.72 ? world.tree : r < 0.86 ? "cone" : "lamp";
    const s = kind === "cone" ? 0.8 + Math.random() * 0.25 : 0.72 + Math.random() * 0.4;
    // 왼쪽 바다에는 안 놓음
    const minX = world.sea ? 28 : 0;
    const x = left ? minX + (ROAD_X - 18 - minX) * (0.25 + Math.random() * 0.55) : W - ROAD_X + 18 + (ROAD_X - 18) * (0.2 + Math.random() * 0.55);
    return { y, x, kind, s, left };
  }
  function fillWeather() {
    weather = [];
    if (!world.weather) return;
    const n = world.weather === "snow" ? 46 : 26;
    for (let i = 0; i < n; i += 1) weather.push({ x: Math.random() * W, y: Math.random() * H, z: 0.5 + Math.random() * 0.8, p: Math.random() * TAU });
  }

  function startStage(i) {
    stageIndex = i;
    scoreAtStart = score;
    bonusFloor = 0;
    resetStage();
    state = "ready";
    showOverlay(null);
    Sound.unlock();
    Sound.engineOn();
    last = performance.now();
  }
  function startFromTitle() {
    if (window.TodayGameRank) window.TodayGameRank.reset();
    endless = false;
    score = save.score;
    totalDist = 0;
    startStage(save.stage);
  }
  function startOver() {
    save.stage = 0;
    save.score = 0;
    persist();
    renderTitle();
    startFromTitle();
  }

  /* ---------- 조작 ---------- */
  function moveLane(dir) {
    if (state !== "play" && state !== "ready") return;
    Sound.unlock();
    const next = clamp(player.target + dir, 0, LANES - 1);
    if (next === player.target) return;
    player.target = next;
    player.tilt = dir;
    Sound.move();
  }

  /* ---------- 놓기 ---------- */
  function spawnRow() {
    const n = Math.random() < params.double ? 2 : 1;
    let free;
    if (n === 2) {
      // 두 대 줄이 이어지면 빈 차선은 옆 칸으로만 (두 칸 건너는 건 시간상 불가능)
      const candidates = [0, 1, 2].filter((l) => Math.abs(l - lastFree) <= 1);
      free = candidates[Math.floor(Math.random() * candidates.length)];
      lastFree = free;
    }
    const lanes = n === 2 ? [0, 1, 2].filter((l) => l !== free) : [Math.floor(Math.random() * LANES)];
    if (n === 1) lastFree = lanes[0] === 1 ? (player.target === 2 ? 2 : 0) : 1;
    for (const l of lanes) {
      const types = ["car_red", "car_blue", "car_green", "car_purple", "car_orange"];
      enemies.push({
        lane: l,
        x: laneX(l),
        y: -70,
        type: types[Math.floor(Math.random() * types.length)],
        near: false,
        changer: n === 1 && Math.random() < params.changer ? { state: 0, to: l === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1, t: 0 } : null,
        spin: 0,
        hit: false,
        dx: 0,
      });
    }
    // 빈 차선에 모이 줄
    if (Math.random() < 0.55) {
      const l = n === 2 ? free : (lanes[0] + 1 + Math.floor(Math.random() * 2)) % LANES;
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i += 1) coins.push({ lane: l, x: laneX(l), y: -170 - i * 34 });
    } else if (Math.random() < 0.12) {
      items.push({ type: "boost", lane: Math.floor(Math.random() * LANES), y: -220 });
    } else if (hearts < 3 && Math.random() < 0.1) {
      items.push({ type: "heart", lane: Math.floor(Math.random() * LANES), y: -220 });
    }
  }

  /* ---------- 효과 ---------- */
  function burst(x, y, colors, count = 10, speed = 130, size = 4) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * TAU;
      const sp = speed * (0.3 + Math.random());
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.35, t: 0, color: colors[Math.floor(Math.random() * colors.length)], size: size * (0.5 + Math.random()), grav: 220 });
    }
  }
  function float(text, color, big = false) {
    floats.push({ text, color, t: 0, life: 0.95, x: clamp(player.x, 90, W - 90), y: PLAYER_Y - 70, big });
    if (floats.length > 5) floats.shift();
  }

  /* ---------- 진행 ---------- */
  function update(dt) {
    time += dt;
    tickWeather(dt);
    if (state === "title") {
      speedNow = lerp(speedNow, 130, 1 - Math.exp(-dt * 2));
      scroll += speedNow * dt;
      tickDecor(speedNow * dt);
      return;
    }
    if (state === "ready") {
      readyT -= dt;
      const n = Math.ceil(readyT / 0.7);
      if (n !== readyBeep && n > 0 && n <= 3) {
        readyBeep = n;
        Sound.beep(false);
      }
      speedNow = lerp(speedNow, readyT < 0.45 ? BASE_SPEED * params.speed * 0.6 : 0, 1 - Math.exp(-dt * 3));
      scroll += speedNow * dt;
      tickDecor(speedNow * dt);
      steerPlayer(dt);
      Sound.engine(speedNow, true);
      if (readyT <= 0) {
        state = "play";
        Sound.beep(true);
        float("출발!", "#fff", true);
      }
      tickFx(dt);
      return;
    }
    if (state === "finish") {
      finishT += dt;
      speedNow = lerp(speedNow, BASE_SPEED * params.speed * 1.5, 1 - Math.exp(-dt * 2));
      scroll += speedNow * dt;
      tickDecor(speedNow * dt);
      if (finishY != null) finishY += speedNow * dt;
      player.y -= (140 + finishT * 520) * dt;
      for (const e of enemies) e.y += speedNow * 0.6 * dt;
      tickFx(dt);
      Sound.engine(speedNow, true);
      if (finishT > 1.25) showClear();
      return;
    }
    if (state !== "play") {
      tickFx(dt);
      return;
    }
    if (hitStop > 0) {
      hitStop -= dt;
      return;
    }

    recover = lerp(recover, 1, 1 - Math.exp(-dt * 1.3));
    if (boostT > 0) boostT -= dt;
    if (invT > 0) invT -= dt;
    const boost = boostT > 0 ? 1.4 : 1;
    const endlessK = endless ? 1 + Math.min(0.5, totalDist / 16000) : 1;
    const target = BASE_SPEED * params.speed * endlessK * recover * boost;
    speedNow = lerp(speedNow, target, 1 - Math.exp(-dt * 3.2));
    const v = speedNow;
    const closure = v * (1 - params.rel);
    scroll += v * dt;
    const gain = v * dt * M_PER_PX;
    stageDist += gain;
    totalDist += gain;
    score += 0;
    bonusFloor += gain;
    if (bonusFloor >= 1) {
      const whole = Math.floor(bonusFloor);
      score += whole;
      bonusFloor -= whole;
    }
    steerPlayer(dt);
    tickDecor(v * dt);
    Sound.engine(v, true);

    // 줄 놓기 (끝나기 직전엔 안 놓음)
    const left = params.goal - stageDist;
    // 줄 간격은 거리로 잼: 부딪혀 느려져도 차들이 다닥다닥 붙지 않음
    rowT -= closure * dt;
    if (rowT <= 0 && left > v * M_PER_PX * 2.4) {
      rowT = params.rowTime * BASE_SPEED * params.speed * (1 - params.rel);
      spawnRow();
    }

    const pb = { l: player.x - 21, r: player.x + 21, t: PLAYER_Y - KART_H / 2 + 9, b: PLAYER_Y + KART_H / 2 - 9 };
    for (const e of enemies) {
      e.y += (e.hit ? v * 1.1 : closure) * dt;
      if (e.hit) {
        e.x += e.dx * dt;
        e.spin += dt * 6 * Math.sign(e.dx || 1);
        continue;
      }
      if (e.changer) {
        const c = e.changer;
        if (c.state === 0 && e.y > 30) {
          c.state = 1;
          c.t = 0.7;
        }
        if (c.state === 1) {
          c.t -= dt;
          if (c.t <= 0) {
            c.state = 2;
            e.lane = c.to;
          }
        }
        if (c.state === 2) e.x = lerp(e.x, laneX(c.to), 1 - Math.exp(-dt * 4.2));
      }
      e.x = e.changer && e.changer.state === 2 ? e.x : laneX(e.lane);
      const h = CAR_H / 2 - 8;
      const eb = { l: e.x - 22, r: e.x + 22, t: e.y - h, b: e.y + h };
      if (pb.l < eb.r && pb.r > eb.l && pb.t < eb.b && pb.b > eb.t) {
        if (boostT > 0) {
          knock(e, 1);
          score += 50;
          float("쾅! +50", "#ffd84a");
          burst(e.x, e.y, ["#fff", "#ffd84a", "#ff9ec4"], 14);
          Sound.near();
          continue;
        }
        if (invT <= 0) {
          crash(e);
          if (state !== "play") return;
        }
        continue;
      }
      // 아슬아슬: 바로 옆 차선으로 스쳐 지나감
      if (!e.near && e.y > PLAYER_Y - 6) {
        e.near = true;
        if (invT <= 0 && Math.abs(e.x - player.x) < LANE_W * 1.12) {
          nearChain += 1;
          const pts = 20 + 5 * Math.min(nearChain, 6);
          score += pts;
          float(nearChain > 1 ? `아슬아슬 x${nearChain} +${pts}` : `아슬아슬! +${pts}`, "#fff");
          burst(player.x + Math.sign(e.x - player.x) * 26, PLAYER_Y - 10, ["#fff", "#ffe27a"], 6, 90, 3);
          Sound.near();
        }
      }
    }
    enemies = enemies.filter((e) => e.y < H + 110 && e.x > -60 && e.x < W + 60);

    for (const c of coins) {
      c.y += v * dt;
      if (!c.got && Math.abs(c.y - PLAYER_Y) < 44 && Math.abs(c.x - player.x) < 34) {
        c.got = true;
        coinChain += 1;
        stageCoins += 1;
        score += 10;
        Sound.coin(coinChain);
        burst(c.x, c.y, ["#ffe27a", "#fff"], 4, 70, 3);
      }
    }
    coins = coins.filter((c) => {
      if (c.y > H + 20 && !c.got) coinChain = 0;
      return !c.got && c.y < H + 20;
    });
    for (const it of items) {
      it.y += v * dt;
      const x = laneX(it.lane);
      if (!it.got && Math.abs(it.y - PLAYER_Y) < 46 && Math.abs(x - player.x) < 36) {
        it.got = true;
        if (it.type === "boost") {
          boostT = 2.6;
          Sound.boost();
          float("부스터!", "#6ff0ff", true);
          burst(player.x, PLAYER_Y, ["#6ff0ff", "#fff"], 14);
        } else {
          hearts = Math.min(3, hearts + 1);
          drawHeartsDom();
          Sound.heart();
          float("하트 +1", "#ff6f91", true);
        }
      }
    }
    items = items.filter((it) => !it.got && it.y < H + 40);

    // 부스터 불꽃 · 배기
    addExhaust(dt);

    if (!endless) {
      if (stageDist >= params.goal - v * M_PER_PX * ((PLAYER_Y + 40) / v) && finishY == null) finishY = -30;
      if (finishY != null) {
        finishY += v * dt;
        if (finishY >= PLAYER_Y - 30) finishStage();
      }
    }
    tickFx(dt);
    updateHud();
  }
  function steerPlayer(dt) {
    player.x += (laneX(player.target) - player.x) * Math.min(1, LERP * dt);
    player.lane = player.target;
    player.tilt *= Math.max(0, 1 - dt * 7);
  }
  function tickDecor(dy) {
    for (const d of decor) d.y += dy;
    decor = decor.filter((d) => d.y < H + 90);
    let top = decor.reduce((m, d) => Math.min(m, d.y), 0);
    while (top > -160) {
      top -= 54 + Math.random() * 46;
      decor.push(makeDecor(top));
    }
  }
  function tickWeather(dt) {
    for (const w of weather) {
      const k = world.weather;
      w.y += (k === "snow" ? 70 : 90) * w.z * dt + speedNow * 0.3 * dt;
      w.x += Math.sin(time * 1.3 + w.p) * 18 * dt;
      if (w.y > H + 10) {
        w.y = -10;
        w.x = Math.random() * W;
      }
    }
  }
  function tickFx(dt) {
    for (const p of particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.grav || 0) * dt;
      if (p.conf) p.rot += p.spin * dt;
    }
    particles = particles.filter((p) => p.t < p.life);
    for (const f of floats) {
      f.t += dt;
      f.y -= 46 * dt;
    }
    floats = floats.filter((f) => f.t < f.life);
    shake = Math.max(0, shake - dt * 26);
  }
  function addExhaust(dt) {
    const rate = boostT > 0 ? 70 : 16;
    if (Math.random() > dt * rate) return;
    const tail = PLAYER_Y + KART_H / 2 - 4;
    if (boostT > 0) {
      particles.push({ x: player.x + (Math.random() - 0.5) * 22, y: tail, vx: (Math.random() - 0.5) * 22, vy: 120 + Math.random() * 90, life: 0.32, t: 0, color: Math.random() < 0.5 ? "#6ff0ff" : "#fff6a8", size: 4 + Math.random() * 3, grow: -8 });
    } else {
      particles.push({ x: player.x + (Math.random() - 0.5) * 14, y: tail, vx: (Math.random() - 0.5) * 8, vy: 60, life: 0.36, t: 0, color: "rgba(255,255,255,0.75)", size: 2.4 + Math.random() * 2, grow: 12 });
    }
  }
  function knock(e, dir) {
    e.hit = true;
    e.dx = (e.x < player.x ? -1 : 1) * 210 * dir;
  }
  function crash(e) {
    hearts -= 1;
    drawHeartsDom();
    knock(e, 1);
    shake = 11;
    hitStop = 0.07;
    recover = 0.42;
    invT = 1.7;
    nearChain = 0;
    coinChain = 0;
    Sound.crash();
    burst(player.x, PLAYER_Y - 16, ["#ff6b6b", "#ffb347", "#fff", "#ffe27a"], 22, 180, 5);
    float(hearts > 0 ? "쾅! 하트 -1" : "쾅!", "#ff6b6b", true);
    if (hearts <= 0) gameOver();
  }
  function gameOver() {
    state = "over";
    Sound.engine(0, false);
    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    if (score > best) localStorage.setItem(BEST_KEY, String(score));
    $("over-detail").textContent = endless ? `무한 질주 ${Math.floor(stageDist)}m · 점수 ${score.toLocaleString("ko-KR")}` : `스테이지 ${stageIndex + 1} · ${Math.floor(stageDist)}m · 점수 ${score.toLocaleString("ko-KR")}`;
    setTimeout(() => {
      showOverlay("over");
      if (window.TodayGameRank) window.TodayGameRank.open(Math.max(1, score));
    }, 650);
    updateHud();
  }
  function finishStage() {
    state = "finish";
    finishT = 0;
    Sound.win();
    const bonus = hearts * 100 + stageCoins * 2;
    score += bonus;
    lastBonus = bonus;
    for (let i = 0; i < 80; i += 1) {
      particles.push({ conf: true, x: Math.random() * W, y: -10 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 40, vy: 120 + Math.random() * 160, life: 2.2, t: 0, size: 4 + Math.random() * 5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10, color: ["#ffd24a", "#ff6f91", "#5fd0ff", "#8ff07a", "#ffffff"][i % 5] });
    }
    updateHud();
  }
  let lastBonus = 0;
  function showClear() {
    state = "clear";
    Sound.engine(0, false);
    const stars = hearts;
    save.stars[stageIndex] = Math.max(stars, save.stars[stageIndex] || 0);
    save.stage = Math.min(TOTAL - 1, stageIndex + 1);
    save.score = score;
    persist();
    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    if (score > best) localStorage.setItem(BEST_KEY, String(score));
    if (stageIndex >= TOTAL - 1) {
      showOverlay("all");
      $("all-detail").textContent = `50단계 완주! 점수 ${score.toLocaleString("ko-KR")}`;
      if (window.TodayGameRank) {
        window.TodayGameRank.mount({ gameId: "racing", gameTitle: "스피드 삐약이", formParent: overlays.all });
        window.TodayGameRank.open(Math.max(1, score));
      }
      return;
    }
    $("clear-title").textContent = `스테이지 ${stageIndex + 1} 완주!`;
    $("clear-detail").textContent = `보너스 +${lastBonus} · 점수 ${score.toLocaleString("ko-KR")}`;
    const next = worldOf(stageIndex + 1);
    $("clear-next").textContent = next !== worldOf(stageIndex) ? `다음 코스: ${next.name}` : "";
    document.querySelectorAll("#clear-stars i").forEach((el, i) => {
      el.classList.remove("on");
      if (i < stars) {
        setTimeout(() => {
          el.classList.add("on");
          Sound.star(i);
        }, 180 + i * 220);
      }
    });
    showOverlay("clear");
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(sx, sy);
    const tile = roadTile(world, WORLDS.indexOf(world));
    const off = ((scroll % TILE_H) + TILE_H) % TILE_H;
    for (let y = off - TILE_H; y < H; y += TILE_H) ctx.drawImage(tile, -6, y - 0.5, W + 12, TILE_H + 1);
    // 바닷가 물결
    if (world.sea) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i += 1) {
        const y = ((i * 130 + scroll * 0.9) % (H + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(3, y);
        ctx.quadraticCurveTo(10, y - 4 + Math.sin(time * 2 + i) * 2, 17, y);
        ctx.stroke();
      }
    }
    if (finishY != null) drawFinish(finishY);
    for (const it of items) drawItem(it);
    for (const c of coins) drawCoin(c);
    // 길가: 먼 것부터
    const sorted = decor.slice().sort((a, b) => a.y - b.y);
    for (const d of sorted) drawDecor(d);
    const shadow = getShadow();
    for (const e of enemies) drawEnemy(e, shadow);
    drawPlayer(shadow);
    for (const p of particles) {
      const u = p.t / p.life;
      if (p.conf) {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = Math.max(0, 1 - u);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.3, p.size + (p.grow || 0) * p.t), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawWeather();
    ctx.restore();
    if (world.night) drawNight();
    if (boostT > 0 && state === "play") drawSpeedLines();
    if (state === "ready") drawCountdown();
    for (const f of floats) {
      const u = f.t / f.life;
      ctx.globalAlpha = u > 0.65 ? (1 - u) / 0.35 : 1;
      const size = f.big ? 28 : 19;
      ctx.font = `400 ${size}px "Bagel Fat One", "Jua", sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(30,30,55,0.8)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
  function drawFinish(y) {
    const s = 13;
    for (let r = 0; r < 3; r += 1) {
      for (let x = ROAD_X; x < W - ROAD_X; x += s) {
        ctx.fillStyle = (r + Math.round((x - ROAD_X) / s)) % 2 ? "#fff" : "#20232e";
        ctx.fillRect(x, y + r * s, s + 0.5, s + 0.5);
      }
    }
    // 아치
    ctx.fillStyle = "#ff5f6e";
    ctx.fillRect(ROAD_X - 12, y - 8, 8, 52);
    ctx.fillRect(W - ROAD_X + 4, y - 8, 8, 52);
  }
  function drawCoin(c) {
    const spin = Math.cos(time * 7 + c.y * 0.02);
    const w = Math.max(2, Math.abs(spin) * 11);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(c.x + 2, c.y + 10, 9, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#c98a12";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 1, w, 11, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createLinearGradient(0, c.y - 11, 0, c.y + 11);
    g.addColorStop(0, "#fff0a0");
    g.addColorStop(1, "#ffc21f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, w * 0.9, 10, 0, 0, TAU);
    ctx.fill();
    if (w > 6) {
      ctx.fillStyle = "#e89a0c";
      ctx.font = '400 12px "Bagel Fat One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("삐", c.x, c.y + 1);
      ctx.textBaseline = "alphabetic";
    }
  }
  function drawItem(it) {
    const x = laneX(it.lane);
    if (it.type === "boost") {
      ctx.save();
      ctx.translate(x, it.y);
      ctx.fillStyle = "rgba(20,160,220,0.9)";
      ctx.beginPath();
      ctx.roundRect(-30, -30, 60, 60, 11);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 2; i += 1) {
        const off = ((time * 42 + i * 19) % 38) - 19;
        ctx.globalAlpha = 1 - Math.abs(off) / 22;
        ctx.beginPath();
        ctx.moveTo(0, -12 - off);
        ctx.lineTo(16, 4 - off);
        ctx.lineTo(9, 4 - off);
        ctx.lineTo(0, -5 - off);
        ctx.lineTo(-9, 4 - off);
        ctx.lineTo(-16, 4 - off);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      const k = 1 + Math.sin(time * 6) * 0.08;
      ctx.save();
      ctx.translate(x, it.y);
      ctx.scale(k, k);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(1, 19, 13, 4, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#fff";
      heartPath(ctx, 0, -2, 17);
      ctx.stroke();
      ctx.fillStyle = "#ff5a7e";
      heartPath(ctx, 0, -2, 17);
      ctx.fill();
      ctx.restore();
    }
  }
  function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.95);
    g.bezierCurveTo(x - s * 1.5, y + s * 0.05, x - s * 0.8, y - s * 0.95, x, y - s * 0.28);
    g.bezierCurveTo(x + s * 0.8, y - s * 0.95, x + s * 1.5, y + s * 0.05, x, y + s * 0.95);
    g.closePath();
  }
  function drawDecor(d) {
    if (d.kind === "lamp") {
      const dir = d.left ? 1 : -1;
      const x = d.left ? ROAD_X - 18 : W - ROAD_X + 18;
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.beginPath();
      ctx.ellipse(x + 3, d.y + 3, 6, 2.5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = world.night ? "#39415a" : "#5a6478";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, d.y);
      ctx.lineTo(x, d.y - 30);
      ctx.quadraticCurveTo(x, d.y - 40, x + dir * 13, d.y - 40);
      ctx.stroke();
      ctx.fillStyle = "#ffe9a0";
      ctx.beginPath();
      ctx.arc(x + dir * 15, d.y - 39, 3.6, 0, TAU);
      ctx.fill();
      return;
    }
    const img = imgs[d.kind];
    if (!img) return;
    const h = (d.kind === "cone" ? 28 : 72) * d.s;
    const w = h * (img.width / img.height);
    ctx.fillStyle = "rgba(20,40,20,0.2)";
    ctx.beginPath();
    ctx.ellipse(d.x + w * 0.05, d.y - 1, w * 0.36, w * 0.11, 0, 0, TAU);
    ctx.fill();
    ctx.drawImage(img, d.x - w / 2, d.y - h, w, h);
  }
  function drawEnemy(e, shadow) {
    const img = imgs[e.type];
    if (!img) return;
    const h = CAR_H;
    const w = h * (img.width / img.height);
    ctx.drawImage(shadow, e.x - w * 0.62 + 3, e.y - h * 0.5 + 6, w * 1.24, h * 1.08);
    ctx.save();
    ctx.translate(e.x, e.y);
    const lean = e.changer && e.changer.state === 2 ? clamp((laneX(e.changer.to) - e.x) * 0.006, -0.14, 0.14) : 0;
    ctx.rotate(e.spin + lean);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    // 깜빡이
    if (e.changer && e.changer.state === 1 && Math.sin(time * 18) > -0.1) {
      const dir = e.changer.to > e.lane ? 1 : -1;
      ctx.fillStyle = "#ffcc1f";
      for (const y of [-h * 0.42, h * 0.42]) {
        ctx.beginPath();
        ctx.arc(dir * w * 0.34, y, 4.6, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dir * w * 0.34, -h * 0.42, 6, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    if (world.night) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,70,70,0.55)";
      for (const dx of [-w * 0.26, w * 0.26]) {
        ctx.beginPath();
        ctx.arc(e.x + dx, e.y + h * 0.46, 5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawPlayer(shadow) {
    const img = imgs.player;
    if (!img) return;
    const y = PLAYER_Y + player.y;
    const blink = invT > 0 && state === "play" && Math.sin(time * 26) < 0;
    ctx.drawImage(shadow, player.x - KART_W * 0.66 + 3, y - KART_H * 0.5 + 6, KART_W * 1.32, KART_H * 1.1);
    if (boostT > 0) {
      const g = ctx.createRadialGradient(player.x, y + KART_H / 2, 3, player.x, y + KART_H / 2, 42);
      g.addColorStop(0, "rgba(111,240,255,0.75)");
      g.addColorStop(1, "rgba(111,240,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(player.x - 42, y + KART_H / 2 - 42, 84, 84);
    }
    ctx.save();
    ctx.translate(player.x, y);
    ctx.rotate(player.tilt * 0.2);
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.drawImage(img, -KART_W / 2, -KART_H / 2, KART_W, KART_H);
    if (window.TodayFace) window.TodayFace.drawOnSprite(ctx, -KART_W / 2, -KART_H / 2, KART_W, KART_H, FACE);
    ctx.restore();
  }
  function drawWeather() {
    if (!weather.length) return;
    const k = world.weather;
    for (const w of weather) {
      if (k === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(w.x, w.y, 1.4 + w.z * 1.1, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = k === "petal" ? "#ffc4d9" : w.p > 3 ? "#e8863a" : "#d9a636";
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, 4 * w.z, 2.2 * w.z, time * 2 + w.p, 0, TAU);
        ctx.fill();
      }
    }
  }
  function drawNight() {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "#8494cc";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const y = PLAYER_Y + player.y - KART_H / 2 + 6;
    const g = ctx.createRadialGradient(player.x, y - 58, 6, player.x, y - 58, 120);
    g.addColorStop(0, "rgba(255,240,190,0.42)");
    g.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = g;
    ctx.fillRect(player.x - 130, y - 190, 260, 260);
    for (const d of decor) {
      if (d.kind !== "lamp") continue;
      const dir = d.left ? 1 : -1;
      const x = (d.left ? ROAD_X - 18 : W - ROAD_X + 18) + dir * 15;
      const lg = ctx.createRadialGradient(x, d.y - 39, 1, x, d.y - 39, 52);
      lg.addColorStop(0, "rgba(255,230,150,0.55)");
      lg.addColorStop(1, "rgba(255,230,150,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(x - 52, d.y - 91, 104, 104);
    }
    ctx.restore();
  }
  function drawSpeedLines() {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 12; i += 1) {
      const x = 8 + ((i * 53 + 17) % (W - 16));
      const y = (i * 91 + scroll * (0.8 + (i % 3) * 0.1)) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 30);
      ctx.stroke();
    }
  }
  function drawCountdown() {
    const n = Math.ceil(readyT / 0.7);
    if (n > 3) return;
    const label = n <= 0 ? "GO!" : String(n);
    const u = 1 - (readyT / 0.7 - Math.floor(readyT / 0.7));
    const k = 1.3 - Math.min(1, u * 3) * 0.3;
    const cx = W / 2;
    const cy = H * 0.34;
    // 신호등
    const on = n;
    ctx.fillStyle = "rgba(22,24,38,0.88)";
    ctx.beginPath();
    ctx.roundRect(cx - 66, cy - 104, 132, 46, 15);
    ctx.fill();
    [3, 2, 1].forEach((v, i) => {
      ctx.fillStyle = on <= v ? (v === 1 ? "#57e36b" : v === 2 ? "#ffd33d" : "#ff5a5a") : "#3b3e50";
      ctx.beginPath();
      ctx.arc(cx - 38 + i * 38, cy - 81, 13, 0, TAU);
      ctx.fill();
    });
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.font = '400 82px "Bagel Fat One", "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 12;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#26324d";
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = "#ffd839";
    ctx.fillText(label, 0, 0);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
    ctx.font = '400 18px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(30,30,55,0.75)";
    const label2 = endless ? "무한 질주" : `스테이지 ${stageIndex + 1} · ${world.name}`;
    ctx.strokeText(label2, cx, cy + 66);
    ctx.fillStyle = "#fff";
    ctx.fillText(label2, cx, cy + 66);
  }

  /* ---------- 돌리기 ---------- */
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = clamp((ts - last) / 1000 || 0.016, 0, 0.033);
    last = ts;
    if (state !== "paused") update(dt);
    draw();
  }

  $("start-btn").addEventListener("click", startFromTitle);
  $("restart-btn").addEventListener("click", startOver);
  $("retry-btn").addEventListener("click", () => {
    if (window.TodayGameRank) window.TodayGameRank.reset();
    score = endless ? save.score : scoreAtStart;
    startStage(stageIndex);
  });
  $("next-btn").addEventListener("click", () => startStage(stageIndex + 1));
  $("endless-btn").addEventListener("click", () => {
    if (window.TodayGameRank) window.TodayGameRank.reset();
    endless = true;
    startStage(TOTAL - 1);
  });
  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      moveLane(btn.dataset.dir === "left" ? -1 : 1);
    });
  });
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      moveLane(-1);
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      moveLane(1);
    }
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play" && state !== "ready") return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    moveLane(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
  });

  if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: "racing", gameTitle: "스피드 삐약이", formParent: overlays.over });
  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        Sound.engine(0, false);
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        last = performance.now();
        return true;
      },
    });
  }
  addEventListener("resize", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  fit();
  fillDecor();
  renderTitle();
  drawHeartsDom();
  showOverlay("title");
  loadAssets().then(() => {
    last = performance.now();
    requestAnimationFrame(loop);
  });

  // 점검용
  window.SpeedChick = {
    get s() {
      return { state, stageIndex, hearts, score, stageDist, speedNow, goal: params.goal, boostT, invT, target: player.target, x: player.x, y: PLAYER_Y, enemies: enemies.map((e) => ({ lane: e.lane, x: e.x, y: e.y, hit: e.hit, changer: e.changer ? e.changer.state : -1, to: e.changer ? e.changer.to : e.lane })), H, PX, count: { coins: coins.length, items: items.length } };
    },
    update,
    moveLane,
    startStage,
    showClear,
    params: stageParams,
    WORLDS,
    setWorld(i) {
      world = WORLDS[i];
      tiles.clear();
      fillDecor();
      fillWeather();
    },
    freeze(on) {
      frozen = on;
    },
    save,
    addScore(n) {
      score += n;
    },
  };
  let frozen = false;
  void frozen;
})();
