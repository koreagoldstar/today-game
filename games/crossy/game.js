(() => {
  "use strict";

  /*
   * 삐약이 건너기
   *  - 그림 파일 이름이 뒤바뀌어 도로에 병아리, 풀밭에 차가 깔리던 것을 바로잡음 (앞 · 옆 · 뒤 병아리 + 차)
   *  - 화면 픽셀에 맞춰 그려 또렷함 · 줄마다 미리 그려 빠름
   *  - 하트 3개 · 스테이지 50개 · 진행 저장 · 기차 경보 · 통나무 · 연잎
   */
  const W = 390;
  const COLS = 9;
  const TILE = W / COLS;
  const HOP = 0.13;
  const MARGIN = 5;
  const SPAN = COLS + MARGIN * 2;
  const TOTAL = 50;
  const SAVE_KEY = "crossy-save-v2";
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);

  const WORLDS = [
    { name: "봄 마을", grass: ["#a9e47e", "#9bdb72"], dirt: "#7d9c4c", tree: "tree", flowers: ["#fff", "#ffd84a", "#ff9cc2"], water: ["#58c4f2", "#3daee4"] },
    { name: "벚꽃 동산", grass: ["#b9e98f", "#acdf83"], dirt: "#86a056", tree: "tree_pink", flowers: ["#ffb3d1", "#fff", "#ff8ab5"], water: ["#6ccdf2", "#4cb7e6"], weather: "petal" },
    { name: "여름 냇가", grass: ["#8fe36c", "#80d960"], dirt: "#6d9440", tree: "tree", flowers: ["#ffe34a", "#fff", "#ff8f6e"], water: ["#3fc0e8", "#25a8da"] },
    { name: "단풍 고개", grass: ["#ddd070", "#d1c462"], dirt: "#9a8a40", tree: "tree_fall", flowers: ["#ff9a4a", "#ffd24a", "#e8643c"], water: ["#5ab4d8", "#4298c4"], weather: "leaf" },
    { name: "눈 내린 마을", grass: ["#f2f8fc", "#e5eff7"], dirt: "#9db4c8", tree: "tree_snow", flowers: ["#fff", "#cfe6ff", "#fff"], water: ["#7fcdea", "#5fb7dd"], weather: "snow" },
  ];
  const worldOf = (i) => WORLDS[Math.min(WORLDS.length - 1, Math.floor(i / 10))];
  const stageGoal = (i) => 12 + Math.round(i * 0.9);

  const NAMES = ["chick_front", "chick_side", "chick_back", "chick_wave", "car_pink", "car_blue", "car_green", "car_purple", "car_yellow", "car_red", "tree", "tree_pink", "tree_fall", "tree_snow"];
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
    hop() {
      this.tone(520, 0.09, "sine", 0.11, 1.7);
    },
    bump() {
      this.tone(170, 0.08, "sine", 0.14, 0.7);
    },
    corn(n) {
      this.tone(880 * Math.pow(2, Math.min(n, 8) / 12), 0.09, "sine", 0.12);
    },
    squish() {
      this.noise(0.14, 900, "lowpass", 0.3);
      this.tone(420, 0.28, "triangle", 0.14, 0.32);
      this.tone(760, 0.2, "sine", 0.08, 0.5, 0.06);
    },
    splash() {
      this.noise(0.42, 1400, "lowpass", 0.36);
      for (let i = 0; i < 4; i += 1) this.tone(320 + i * 90, 0.08, "sine", 0.08, 2, 0.05 + i * 0.06);
    },
    horn() {
      this.tone(330, 0.5, "square", 0.05);
      this.tone(415, 0.5, "square", 0.05);
    },
    ding() {
      this.tone(1320, 0.12, "triangle", 0.07);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.15, 1, i * 0.1));
    },
    star(i) {
      this.tone(880 + i * 220, 0.2, "triangle", 0.15);
    },
  };

  /* ---------- 화면 ---------- */
  const stageEl = $("stage");
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  let H = 700;
  let PX = 1;
  let baseY = 480;
  const strips = new Map();
  const logCache = new Map();
  let busCache = null;
  let cornCache = null;

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
    baseY = H - 150;
    strips.clear();
    logCache.clear();
    busCache = null;
    cornCache = null;
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

  /* ---------- 상태 ---------- */
  let state = "title";
  let stageIndex = 0;
  let endless = false;
  let score = 0;
  let scoreAtStart = 0;
  let hearts = 3;
  let goal = 12;
  let lanes = new Map();
  let genZ = 0;
  let genR = rnd(1);
  let cornChain = 0;
  let player = null;
  let hop = null;
  let queued = null;
  let camZ = 0;
  let maxZ = 0;
  let lastSafe = { x: 4, z: 0 };
  let invT = 0;
  let idleT = 0;
  let waveT = 0;
  let deathT = 0;
  let deathKind = "";
  let finishT = 0;
  let time = 0;
  let last = 0;
  let shake = 0;
  let particles = [];
  let floats = [];
  let weather = [];
  let world = WORLDS[0];
  let swipe = null;

  const save = (() => {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return { stage: clamp(Number(d.stage) || 0, 0, TOTAL - 1), score: Number(d.score) || 0, best: Number(d.best) || 0 };
    } catch (_) {
      return { stage: 0, score: 0, best: 0 };
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
  function showOverlay(name) {
    for (const [k, el] of Object.entries(overlays)) el.classList.toggle("hidden", k !== name);
    document.body.classList.toggle("in-play", !name);
  }

  /* ---------- 코스 만들기 ---------- */
  function diff() {
    return endless ? 1 : clamp(stageIndex / (TOTAL - 1), 0, 1);
  }
  function makeGrass(z, treesMax) {
    const r = genR;
    const trees = [];
    const count = treesMax > 0 ? Math.floor(r() * (treesMax + 1)) : 0;
    let tries = 0;
    while (trees.length < count && tries < 30) {
      tries += 1;
      const x = Math.floor(r() * COLS);
      // 나무 사이나 벽 옆에 한 칸만 남는 자리는 피함 (늘 두 칸 이상 비어 있어 갇히지 않음)
      if (x === 1 || x === COLS - 2 || trees.some((t) => Math.abs(t - x) <= 2)) continue;
      trees.push(x);
    }
    const coin = r() < 0.24 ? Math.floor(r() * COLS) : -1;
    return { z, type: "grass", trees, coin: trees.includes(coin) ? -1 : coin, ents: [], v: 0, variant: Math.floor(r() * 6) };
  }
  function makeRoad(z) {
    const r = genR;
    const t = diff();
    const dir = r() > 0.5 ? 1 : -1;
    const speed = 1.4 + r() * 1 + t * 1.6;
    // 빠른 길일수록 차 사이를 넓혀 뛰어들 틈을 줌
    const wantGap = 3.4 + speed * 0.75 + r() * 1.2 - t * 0.6;
    const count = clamp(Math.floor(SPAN / (1.6 + wantGap)), 2, 4);
    const gap = SPAN / count;
    const ents = [];
    const off = r() * SPAN;
    for (let i = 0; i < count; i += 1) {
      const bus = r() < 0.2 + t * 0.14;
      ents.push({ x: ((off + i * gap + (r() - 0.5) * gap * 0.4) % SPAN) - MARGIN, w: bus ? 2.5 : 1.28, kind: bus ? "bus" : ["car_pink", "car_blue", "car_green", "car_purple", "car_yellow", "car_red"][Math.floor(r() * 6)] });
    }
    const coin = r() < 0.16 ? Math.floor(r() * COLS) : -1;
    return { z, type: "road", ents, v: dir * speed, dir, coin };
  }
  function makeRiver(z) {
    const r = genR;
    const t = diff();
    // 옆줄 강은 반대로 흐름 (같은 쪽으로 비슷하게 흐르면 통나무가 어긋난 채로 안 맞음)
    const prevLane = lanes.get(z - 1);
    const dir = prevLane && prevLane.type === "river" && prevLane.dir && !prevLane.lily ? -prevLane.dir : r() > 0.5 ? 1 : -1;
    const speed = 0.9 + r() * 0.7 + t * 1;
    const minW = lerp(3.2, 2.1, t);
    const ents = [];
    let x = r() * 2 - MARGIN;
    while (x < COLS + MARGIN - minW) {
      const w = minW + r() * 1.4;
      ents.push({ x, w, kind: "log" });
      x += w + 1 + r() * lerp(1.5, 2.3, t);
    }
    return { z, type: "river", ents, v: dir * speed, dir, coin: -1 };
  }
  function makeLily(z) {
    const r = genR;
    const ents = [];
    for (let i = 0; i < COLS; i += 1) if (r() < 0.55) ents.push({ x: i, w: 1, kind: "lily", ph: r() * 6 });
    if (ents.length < 3) ents.push({ x: 4, w: 1, kind: "lily", ph: 1 });
    return { z, type: "river", lily: true, ents, v: 0, dir: 1, coin: -1 };
  }
  function makeRail(z) {
    const r = genR;
    return { z, type: "rail", ents: [], v: 0, dir: r() > 0.5 ? 1 : -1, timer: 1.5 + r() * 3, warn: false, train: null, coin: -1 };
  }
  /** 다음 묶음(풀 · 도로 · 강 · 선로)을 이어 붙임 */
  function generateGroup() {
    const r = genR;
    const t = diff();
    const put = (lane) => {
      lanes.set(lane.z, lane);
      genZ = lane.z + 1;
    };
    if (!endless && genZ > goal) {
      put(makeGrass(genZ, 3));
      return;
    }
    const z0 = genZ;
    if (z0 <= 2) {
      const g = makeGrass(z0, 0);
      g.coin = -1;
      put(g);
      return;
    }
    if (!endless && z0 === goal) {
      const g = makeGrass(z0, 0);
      g.goal = true;
      g.coin = -1;
      put(g);
      return;
    }
    const allowRiver = stageIndex >= 2 || endless;
    const allowRail = stageIndex >= 5 || endless;
    const k = r();
    const prev = lanes.get(z0 - 1);
    const afterHazard = prev && prev.type !== "grass";
    const grassP = afterHazard ? 0.62 - t * 0.28 : 0.2;
    const left = endless ? 99 : goal - z0;
    // 위험한 줄이 너무 길게 이어지지 않게 (뒤로 갈수록 조금 길어짐)
    let run = 0;
    for (let zz = z0 - 1; zz >= 0 && lanes.get(zz) && lanes.get(zz).type !== "grass"; zz -= 1) run += 1;
    const maxRun = 3 + Math.round(t * 2);
    const room = maxRun - run;
    if (k < grassP || left <= 1 || room <= 0) {
      const n = 1 + (r() < 0.3 ? 1 : 0);
      for (let i = 0; i < n && (endless || genZ < goal); i += 1) put(makeGrass(genZ, 3));
      return;
    }
    const q = r();
    // 기찻길 앞은 늘 풀밭 (통나무나 찻길 위에서는 기차를 기다릴 곳이 없음)
    if (allowRail && q < 0.14 && prev && prev.type === "grass") {
      put(makeRail(genZ));
      return;
    }
    if (allowRiver && q < 0.42) {
      if (r() < 0.22 && prev && prev.type === "grass" && left > 2) {
        // 연잎 앞 풀밭의 나무를 치워 어느 연잎으로든 갈 수 있게
        prev.trees = [];
        put(makeLily(genZ));
        const after = makeGrass(genZ, 0);
        put(after);
        return;
      }
      const n = Math.min(room, 1 + Math.floor(r() * Math.min(3, 1 + Math.floor(stageIndex / 12))));
      for (let i = 0; i < n && (endless || genZ < goal); i += 1) put(makeRiver(genZ));
      return;
    }
    const n = Math.min(room, 1 + Math.floor(r() * Math.min(4, 1 + Math.floor(stageIndex / 8) + 1)));
    for (let i = 0; i < n && (endless || genZ < goal); i += 1) put(makeRoad(genZ));
  }
  function ensureLanes(z) {
    while (genZ <= z) generateGroup();
  }
  function laneAt(z) {
    if (z < 0) {
      if (!lanes.has(z)) {
        const r = rnd(z * -17 + 3);
        const trees = [];
        for (let i = 0; i < COLS; i += 1) if (r() < 0.38) trees.push(i);
        lanes.set(z, { z, type: "grass", trees, coin: -1, ents: [], v: 0, variant: Math.floor(r() * 6) });
      }
      return lanes.get(z);
    }
    ensureLanes(z);
    return lanes.get(z);
  }
  function resetStage() {
    world = endless ? WORLDS[4] : worldOf(stageIndex);
    goal = endless ? Infinity : stageGoal(stageIndex);
    lanes = new Map();
    genZ = 0;
    genR = rnd(1000 + stageIndex * 77 + (endless ? 991 : 0));
    ensureLanes(30);
    player = { x: 4, z: 0, dir: 0, on: null };
    hop = null;
    queued = null;
    camZ = 0;
    maxZ = 0;
    lastSafe = { x: 4, z: 0 };
    hearts = 3;
    invT = 0;
    idleT = 0;
    deathT = 0;
    finishT = 0;
    cornChain = 0;
    particles = [];
    floats = [];
    fillWeather();
    paintHearts();
    updateHud();
  }
  function fillWeather() {
    weather = [];
    if (!world.weather) return;
    const n = world.weather === "snow" ? 44 : 22;
    for (let i = 0; i < n; i += 1) weather.push({ x: Math.random() * W, y: Math.random() * H, z: 0.5 + Math.random() * 0.8, p: Math.random() * TAU });
  }
  function paintHearts() {
    let html = "";
    for (let i = 0; i < 3; i += 1) html += `<i class="${i < hearts ? "on" : ""}"></i>`;
    $("hud-hearts").innerHTML = html;
  }
  function updateHud() {
    $("hud-stage").textContent = endless ? "∞" : String(stageIndex + 1);
    $("hud-score").textContent = score.toLocaleString("ko-KR");
    const pct = endless ? 100 : clamp(maxZ / goal, 0, 1) * 100;
    $("hud-bar").style.width = `${pct}%`;
  }
  function renderTitle() {
    const n = save.stage;
    $("start-btn").textContent = n > 0 ? `이어서 건너기 · ${n + 1}` : "시작!";
    $("restart-btn").hidden = n === 0;
    $("title-best").textContent = `최고 ${save.best.toLocaleString("ko-KR")}점`;
  }
  function startStage(i) {
    stageIndex = i;
    scoreAtStart = score;
    resetStage();
    state = "play";
    showOverlay(null);
    Sound.unlock();
    last = performance.now();
  }
  function startFromTitle() {
    if (window.TodayGameRank) window.TodayGameRank.reset();
    endless = false;
    score = save.score;
    startStage(save.stage);
  }

  /* ---------- 움직임 ---------- */
  const treeAt = (lane, x) => lane.type === "grass" && lane.trees.includes(Math.round(x));
  function tryMove(dx, dz) {
    if (state !== "play") return;
    Sound.unlock();
    if (hop) {
      queued = [dx, dz];
      return;
    }
    const riding = Boolean(player.on);
    const nz = player.z + dz;
    if (nz < 0 || (dz < 0 && nz < maxZ - 4)) {
      Sound.bump();
      return;
    }
    const lane = laneAt(nz);
    let nx = player.x + dx;
    if (lane.type !== "river") nx = Math.round(nx);
    if (lane.type !== "river" && riding && !dx) nx = clamp(Math.round(player.x), 0, COLS - 1);
    if (nx < -0.2 || nx > COLS - 0.8) {
      Sound.bump();
      return;
    }
    nx = clamp(nx, 0, COLS - 1);
    if (treeAt(lane, nx)) {
      player.dir = dx > 0 ? 1 : dx < 0 ? 3 : dz > 0 ? 0 : 2;
      bumpT = 0.14;
      Sound.bump();
      return;
    }
    player.dir = dx > 0 ? 1 : dx < 0 ? 3 : dz > 0 ? 0 : 2;
    hop = { fx: player.x, fz: player.z, tx: nx, tz: nz, t: 0 };
    player.on = null;
    idleT = 0;
    Sound.hop();
  }
  let bumpT = 0;
  const deaths = {};
  function landed() {
    player.x = hop.tx;
    player.z = hop.tz;
    hop = null;
    const lane = laneAt(player.z);
    if (lane.type === "river") {
      const log = logUnder(lane, player.x);
      if (!log) {
        die("splash");
        return;
      }
      player.on = log;
      player.x = clamp(player.x, log.x - 0.12, log.x + log.w - 0.88);
      burst(xPx(player.x + 0.5), rowMid(player.z) + 8, ["#fff", "#cfefff"], 5, 60, 2.6);
    } else {
      player.on = null;
      if (lane.type === "grass") lastSafe = { x: player.x, z: player.z };
    }
    if (player.z > maxZ) {
      score += 10 * (player.z - maxZ);
      maxZ = player.z;
      ensureLanes(maxZ + 34);
      updateHud();
    }
    if (lane.coin != null && lane.coin >= 0 && Math.abs(lane.coin - player.x) < 0.7) {
      lane.coin = -1;
      cornChain += 1;
      score += 20;
      Sound.corn(cornChain);
      burst(xPx(player.x + 0.5), rowMid(player.z) - 10, ["#ffe27a", "#fff"], 8, 90, 3);
      float("+20", "#ffe27a");
      updateHud();
    }
    if (!endless && player.z >= goal) {
      finishStage();
      return;
    }
    if (queued) {
      const q = queued;
      queued = null;
      tryMove(q[0], q[1]);
    }
  }
  function logUnder(lane, x) {
    // 넉넉하게: 몸 양쪽 끝이 조금만 걸쳐도 태워 줌
    const left = x + 0.14;
    const right = x + 0.86;
    let best = null;
    let bestD = Infinity;
    for (const e of lane.ents) {
      if (right > e.x && left < e.x + e.w) {
        const d = Math.abs(x + 0.5 - (e.x + e.w / 2));
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
    }
    return best;
  }
  function vehicleHit(lane, x) {
    const l = x + 0.2;
    const r = x + 0.8;
    for (const e of lane.ents) {
      if (r > e.x + 0.06 && l < e.x + e.w - 0.06) return true;
    }
    return false;
  }
  function trainHit(lane, x) {
    if (!lane.train) return false;
    const l = x + 0.1;
    const r = x + 0.9;
    return r > lane.train.x && l < lane.train.x + lane.train.w;
  }
  function moveLanes(dt) {
    const lo = Math.floor(camZ) - 9;
    const hi = Math.floor(camZ) + 30;
    for (let z = Math.max(0, lo); z <= hi; z += 1) {
      const lane = laneAt(z);
      if (lane.v) {
        for (const e of lane.ents) {
          e.x += lane.v * dt;
          if (lane.v > 0 && e.x > COLS + MARGIN) e.x -= SPAN;
          if (lane.v < 0 && e.x + e.w < -MARGIN) e.x += SPAN;
        }
      }
      if (lane.type === "rail") {
        if (lane.train) {
          lane.train.x += lane.dir * 16 * dt;
          if ((lane.dir > 0 && lane.train.x > COLS + 2) || (lane.dir < 0 && lane.train.x + lane.train.w < -2)) {
            lane.train = null;
            lane.warn = false;
            lane.timer = 2.8 + Math.random() * 3.4;
          }
        } else {
          lane.timer -= dt;
          const nearby = Math.abs(lane.z - (hop ? hop.tz : player ? player.z : 0)) < 12;
          if (lane.timer < 1.2 && !lane.warn) {
            lane.warn = true;
            if (nearby && state === "play") Sound.ding();
          }
          if (lane.warn && nearby && state === "play" && Math.floor(lane.timer * 3) !== Math.floor((lane.timer + dt) * 3)) Sound.ding();
          if (lane.timer <= 0) {
            const w = 9 + Math.floor(Math.random() * 6);
            lane.train = { x: lane.dir > 0 ? -w - 1 : COLS + 1, w };
            if (nearby && state === "play") Sound.horn();
          }
        }
      }
    }
  }
  function die(kind) {
    if (state !== "play") return;
    state = "dying";
    deathKind = kind;
    deathT = 0;
    hop = null;
    queued = null;
    player.on = null;
    hearts -= 1;
    deaths[kind] = (deaths[kind] || 0) + 1;
    paintHearts();
    cornChain = 0;
    shake = kind === "splash" ? 3 : 9;
    const cx = xPx(player.x + 0.5);
    const cy = rowMid(player.z);
    if (kind === "splash") {
      Sound.splash();
      burst(cx, cy, ["#fff", "#bfeaff", "#7fd0f5"], 22, 130, 4);
    } else {
      Sound.squish();
      burst(cx, cy, ["#ffe27a", "#fff", "#ffb0c4"], 20, 150, 4);
    }
    float(hearts > 0 ? `하트 ${hearts}개` : "앗!", "#ff5a7e", true);
  }
  function respawnOrOver() {
    if (hearts > 0) {
      const lane = laneAt(lastSafe.z);
      let x = lastSafe.x;
      if (treeAt(lane, x)) x = [...Array(COLS).keys()].find((c) => !lane.trees.includes(c)) ?? 4;
      player.x = x;
      player.z = lastSafe.z;
      player.dir = 0;
      player.on = null;
      invT = 1.7;
      idleT = 0;
      state = "play";
      return;
    }
    state = "over";
    if (score > save.best) {
      save.best = score;
      persist();
    }
    $("over-detail").textContent = `${endless ? "무한 모드" : `스테이지 ${stageIndex + 1}`} · 점수 ${score.toLocaleString("ko-KR")}`;
    showOverlay("over");
    if (window.TodayGameRank) window.TodayGameRank.open(Math.max(1, score));
  }
  function finishStage() {
    state = "finish";
    finishT = 0;
    Sound.win();
    score += hearts * 50;
    updateHud();
    for (let i = 0; i < 80; i += 1) {
      particles.push({ conf: true, x: Math.random() * W, y: -10 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 40, vy: 110 + Math.random() * 150, life: 2.2, t: 0, size: 4 + Math.random() * 5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10, color: ["#ffd24a", "#ff6f91", "#5fd0ff", "#8ff07a", "#ffffff"][i % 5] });
    }
  }
  function showClear() {
    state = "clear";
    save.stage = Math.min(TOTAL - 1, stageIndex + 1);
    save.score = score;
    if (score > save.best) save.best = score;
    persist();
    if (stageIndex >= TOTAL - 1) {
      $("all-detail").textContent = `50스테이지 완주! 점수 ${score.toLocaleString("ko-KR")}`;
      showOverlay("all");
      if (window.TodayGameRank) {
        window.TodayGameRank.mount({ gameId: "crossy", gameTitle: "삐약이 건너기", formParent: overlays.all });
        window.TodayGameRank.open(Math.max(1, score));
      }
      return;
    }
    $("clear-title").textContent = `스테이지 ${stageIndex + 1} 클리어!`;
    $("clear-detail").textContent = `점수 ${score.toLocaleString("ko-KR")}`;
    const next = worldOf(stageIndex + 1);
    $("clear-next").textContent = next !== worldOf(stageIndex) ? `다음 마을: ${next.name}` : "";
    document.querySelectorAll("#clear-stars i").forEach((el, i) => {
      el.classList.remove("on");
      if (i < hearts) {
        setTimeout(() => {
          el.classList.add("on");
          Sound.star(i);
        }, 180 + i * 220);
      }
    });
    showOverlay("clear");
  }

  /* ---------- 진행 ---------- */
  function burst(x, y, colors, n = 10, speed = 110, size = 3.5) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = speed * (0.3 + Math.random());
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.35 + Math.random() * 0.35, t: 0, color: colors[Math.floor(Math.random() * colors.length)], size: size * (0.5 + Math.random()) });
    }
  }
  function float(text, color, big = false) {
    floats.push({ text, color, t: 0, life: 0.9, x: clamp(xPx(player.x + 0.5), 70, W - 70), y: rowMid(player.z) - 34, big });
  }
  function update(dt) {
    time += dt;
    for (const w of weather) {
      w.y += (world.weather === "snow" ? 44 : 60) * w.z * dt;
      w.x += Math.sin(time * 1.3 + w.p) * 18 * dt;
      if (w.y > H + 10) {
        w.y = -10;
        w.x = Math.random() * W;
      }
    }
    if (!player) return;
    if (state !== "clear" && state !== "over" && state !== "all") moveLanes(dt);
    if (state === "play") {
      if (invT > 0) invT -= dt;
      if (bumpT > 0) bumpT -= dt;
      if (hop) {
        hop.t += dt / HOP;
        if (hop.t >= 1) landed();
      } else {
        idleT += dt;
      }
      if (state === "play") {
        const z = hop ? (hop.t > 0.5 ? hop.tz : hop.fz) : player.z;
        const x = hop ? lerp(hop.fx, hop.tx, hop.t) : player.x;
        const lane = laneAt(z);
        if (!hop && player.on) {
          player.x += lane.v * dt;
          if (player.x < -0.62 || player.x > COLS - 0.38) die("splash");
        }
        if (state === "play" && invT <= 0) {
          if (lane.type === "road" && vehicleHit(lane, x)) die("squish");
          else if (lane.type === "rail" && trainHit(lane, x)) die("train");
        }
      }
    } else if (state === "dying") {
      deathT += dt;
      if (deathT > 0.8) respawnOrOver();
    } else if (state === "finish") {
      finishT += dt;
      if (finishT > 1.3) showClear();
    }
    const targetCam = (hop ? lerp(hop.fz, hop.tz, hop.t) : player.z) - 0.5;
    camZ += (Math.max(0, targetCam) - camZ) * Math.min(1, dt * 7);
    for (const p of particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.conf) p.rot += p.spin * dt;
      else p.vy += 240 * dt;
    }
    particles = particles.filter((p) => p.t < p.life);
    for (const f of floats) {
      f.t += dt;
      f.y -= 40 * dt;
    }
    floats = floats.filter((f) => f.t < f.life);
    shake = Math.max(0, shake - dt * 22);
  }

  /* ---------- 그리기: 좌표 ---------- */
  const xPx = (x) => x * TILE;
  const rowTop = (z) => baseY - (z - camZ) * TILE - TILE;
  const rowMid = (z) => rowTop(z) + TILE / 2;

  /** 줄 하나를 미리 그려 둠 */
  function strip(lane) {
    const T = world;
    const up = lanes.get(lane.z + 1);
    const down = lanes.get(lane.z - 1);
    const key =
      lane.type === "grass"
        ? `g${lane.variant}${lane.z % 2 ? 1 : 0}${down && down.type !== "grass" ? 1 : 0}`
        : lane.type === "road"
          ? `r${up && up.type === "road" ? 1 : 0}${down && down.type === "road" ? 1 : 0}`
          : lane.type === "river"
            ? `w${lane.z % 2 ? 1 : 0}`
            : "t";
    const full = `${WORLDS.indexOf(T)}:${key}`;
    if (strips.has(full)) return strips.get(full);
    const [c, g] = mk(W, TILE + 1);
    const r = rnd(lane.type === "grass" ? lane.variant * 41 + 5 : 7);
    if (lane.type === "grass") {
      g.fillStyle = T.grass[lane.z % 2 ? 0 : 1];
      g.fillRect(0, 0, W, TILE + 1);
      // 칸 무늬 살짝
      for (let i = 0; i < COLS; i += 1) {
        if (i % 2) continue;
        g.fillStyle = "rgba(255,255,255,0.07)";
        g.fillRect(i * TILE, 0, TILE, TILE + 1);
      }
      for (let i = 0; i < 26; i += 1) {
        g.fillStyle = "rgba(50,100,30,0.2)";
        g.fillRect(r() * W, r() * TILE, 1.3, 4);
      }
      for (let i = 0; i < 5; i += 1) {
        const x = r() * W;
        const y = 5 + r() * (TILE - 10);
        const col = T.flowers[Math.floor(r() * T.flowers.length)];
        g.fillStyle = col;
        for (let a = 0; a < 5; a += 1) {
          g.beginPath();
          g.arc(x + Math.cos((a / 5) * TAU) * 2.3, y + Math.sin((a / 5) * TAU) * 2.3, 1.6, 0, TAU);
          g.fill();
        }
        g.fillStyle = "#ffcf3f";
        g.beginPath();
        g.arc(x, y, 1.3, 0, TAU);
        g.fill();
      }
      if (down && down.type !== "grass") {
        g.fillStyle = T.dirt;
        g.fillRect(0, TILE - 6, W, 7);
        g.fillStyle = "rgba(0,0,0,0.16)";
        g.fillRect(0, TILE - 1.5, W, 2.5);
      }
    } else if (lane.type === "road") {
      const gr = g.createLinearGradient(0, 0, 0, TILE);
      gr.addColorStop(0, "#5f6776");
      gr.addColorStop(1, "#555d6c");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, TILE + 1);
      for (let i = 0; i < 240; i += 1) {
        g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
        g.fillRect(r() * W, r() * TILE, 1 + r() * 1.5, 1 + r() * 1.5);
      }
      g.fillStyle = "rgba(255,255,255,0.9)";
      if (!(up && up.type === "road")) g.fillRect(0, 2, W, 2.5);
      else {
        for (let i = 0; i < COLS + 1; i += 1) {
          g.beginPath();
          g.roundRect(i * TILE + 8, -1.5, TILE - 18, 3, 1.5);
          g.fill();
        }
      }
      if (!(down && down.type === "road")) {
        g.fillRect(0, TILE - 4.5, W, 2.5);
      }
    } else if (lane.type === "river") {
      const gr = g.createLinearGradient(0, 0, 0, TILE);
      gr.addColorStop(0, T.water[lane.z % 2 ? 0 : 1]);
      gr.addColorStop(1, T.water[lane.z % 2 ? 1 : 0]);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, TILE + 1);
    } else {
      g.fillStyle = "#9a9080";
      g.fillRect(0, 0, W, TILE + 1);
      for (let i = 0; i < 160; i += 1) {
        g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.14)" : "rgba(50,40,30,0.18)";
        g.beginPath();
        g.arc(r() * W, r() * TILE, 0.8 + r() * 1.5, 0, TAU);
        g.fill();
      }
      g.fillStyle = "#6d4c35";
      for (let x = 4; x < W; x += 18) g.fillRect(x, 6, 9, TILE - 12);
      g.fillStyle = "#c9ced6";
      g.fillRect(0, TILE * 0.28, W, 3.5);
      g.fillRect(0, TILE * 0.66, W, 3.5);
      g.fillStyle = "rgba(0,0,0,0.26)";
      g.fillRect(0, TILE * 0.28 + 3.5, W, 1.3);
      g.fillRect(0, TILE * 0.66 + 3.5, W, 1.3);
    }
    strips.set(full, c);
    return c;
  }
  function logSprite(w) {
    const key = Math.round(w * 4);
    if (logCache.has(key)) return logCache.get(key);
    const pw = w * TILE;
    const ph = TILE * 0.72;
    const [c, g] = mk(pw + 4, ph + 6);
    g.fillStyle = "rgba(10,50,80,0.28)";
    g.beginPath();
    g.roundRect(3, 6, pw - 2, ph, ph / 2);
    g.fill();
    const gr = g.createLinearGradient(0, 0, 0, ph);
    gr.addColorStop(0, "#d9a266");
    gr.addColorStop(0.5, "#b47a43");
    gr.addColorStop(1, "#83522a");
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(1, 1, pw - 2, ph, ph / 2);
    g.fill();
    const r = rnd(key * 13 + 1);
    g.strokeStyle = "rgba(80,45,20,0.45)";
    g.lineWidth = 1.5;
    for (let i = 0; i < 8; i += 1) {
      const y = 5 + r() * (ph - 10);
      const x = 12 + r() * (pw - 44);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 12 + r() * 20, y);
      g.stroke();
    }
    g.fillStyle = "rgba(255,240,210,0.3)";
    g.beginPath();
    g.roundRect(ph * 0.35, 4, pw - ph * 0.8, 3.5, 2);
    g.fill();
    // 끝 나이테
    g.fillStyle = "#ecc78e";
    g.beginPath();
    g.ellipse(pw - ph * 0.3, ph / 2 + 1, ph * 0.26, ph * 0.46, 0, 0, TAU);
    g.fill();
    g.strokeStyle = "#a9733b";
    g.lineWidth = 1.5;
    for (const k of [0.16, 0.3]) {
      g.beginPath();
      g.ellipse(pw - ph * 0.3, ph / 2 + 1, ph * k * 0.9, ph * k * 1.5, 0, 0, TAU);
      g.stroke();
    }
    logCache.set(key, c);
    return c;
  }
  /** 왼쪽을 보는 귀여운 버스 */
  function busSprite() {
    if (busCache) return busCache;
    const w = TILE * 2.5;
    const h = TILE * 1.05;
    const [c, g] = mk(w + 8, h + 8);
    g.translate(4, 4);
    g.lineJoin = "round";
    const body = () => {
      g.beginPath();
      g.roundRect(2, 3, w - 4, h - 12, 12);
    };
    g.lineWidth = 7;
    g.strokeStyle = "#fff";
    body();
    g.stroke();
    g.lineWidth = 2.6;
    g.strokeStyle = "#5c3d10";
    body();
    g.stroke();
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#ffe25a");
    gr.addColorStop(1, "#ffb81f");
    g.fillStyle = gr;
    body();
    g.fill();
    g.fillStyle = "#fff4c2";
    g.fillRect(4, h * 0.56, w - 8, 4);
    for (let i = 0; i < 4; i += 1) {
      g.fillStyle = "#bdeafa";
      g.beginPath();
      g.roundRect(w * 0.27 + i * w * 0.17, h * 0.13, w * 0.14, h * 0.32, 4);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.fillRect(w * 0.29 + i * w * 0.17, h * 0.16, 3, h * 0.25);
    }
    // 앞 얼굴
    g.fillStyle = "#26263a";
    g.beginPath();
    g.arc(w * 0.08, h * 0.32, 4.4, 0, TAU);
    g.arc(w * 0.19, h * 0.32, 4.4, 0, TAU);
    g.fill();
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(w * 0.087, h * 0.3, 1.5, 0, TAU);
    g.arc(w * 0.197, h * 0.3, 1.5, 0, TAU);
    g.fill();
    g.strokeStyle = "#26263a";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(w * 0.135, h * 0.42, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.fillStyle = "rgba(255,120,120,0.6)";
    g.beginPath();
    g.ellipse(w * 0.05, h * 0.44, 4, 2.6, 0, 0, TAU);
    g.ellipse(w * 0.225, h * 0.44, 4, 2.6, 0, 0, TAU);
    g.fill();
    // 바퀴
    for (const x of [w * 0.2, w * 0.78]) {
      g.fillStyle = "#2b2b38";
      g.beginPath();
      g.arc(x, h - 9, 8.5, 0, TAU);
      g.fill();
      g.fillStyle = "#c7ccd6";
      g.beginPath();
      g.arc(x, h - 9, 3.4, 0, TAU);
      g.fill();
    }
    busCache = c;
    return c;
  }
  function cornSprite() {
    if (cornCache) return cornCache;
    const [c, g] = mk(30, 34);
    g.translate(15, 17);
    g.fillStyle = "#6dbb48";
    g.beginPath();
    g.ellipse(-5, 5, 4.5, 10, -0.45, 0, TAU);
    g.ellipse(5, 5, 4.5, 10, 0.45, 0, TAU);
    g.fill();
    g.fillStyle = "#ffc928";
    g.beginPath();
    g.ellipse(0, -1, 6.5, 12, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#ffe680";
    for (let y = -10; y < 10; y += 4) {
      for (let x = -4; x <= 4; x += 4) {
        if (Math.hypot(x / 6.5, y / 12) > 0.86) continue;
        g.beginPath();
        g.arc(x + (y % 8 ? 2 : 0) * 0, y, 1.3, 0, TAU);
        g.fill();
      }
    }
    cornCache = c;
    return c;
  }
  function drawShadow(x, y, rx, ry, a = 0.2) {
    ctx.fillStyle = `rgba(20,35,25,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }
  function drawVehicle(e, lane, top) {
    const ex = xPx(e.x);
    const flip = lane.dir > 0;
    const bottom = top + TILE - 1;
    if (e.kind === "bus") {
      const w = TILE * 2.5;
      const h = TILE * 1.05;
      drawShadow(ex + w / 2, bottom - 4, w * 0.48, 6);
      const img = busSprite();
      ctx.save();
      ctx.translate(ex + w / 2, bottom - h / 2 - 2);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
      ctx.restore();
      return;
    }
    const img = imgs[e.kind];
    if (!img) return;
    const w = TILE * e.w * 1.08;
    const h = w * (img.height / img.width);
    drawShadow(ex + (TILE * e.w) / 2, bottom - 4, w * 0.44, 5.5);
    ctx.save();
    ctx.translate(ex + (TILE * e.w) / 2, bottom - h / 2 - 1 + Math.sin(time * 14 + e.x) * 0.5);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  function drawTrain(lane, top) {
    const t = lane.train;
    if (!t) return;
    const x0 = xPx(t.x);
    const total = t.w * TILE;
    const carLen = TILE * 3;
    const y = top - TILE * 0.28;
    const h = TILE * 1.16;
    drawShadow(x0 + total / 2, top + TILE - 5, total * 0.5, 7);
    const head = lane.dir > 0 ? x0 + total - carLen : x0;
    for (let cx = x0; cx < x0 + total - 1; cx += carLen) {
      const isHead = Math.abs(cx - head) < carLen * 0.6;
      if (cx > W + 8 || cx + carLen < -8) continue;
      const gr = ctx.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, isHead ? "#ff7183" : "#68c6f0");
      gr.addColorStop(1, isHead ? "#d92f50" : "#3a97cc");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.roundRect(cx + 2, y, carLen - 4, h - 7, 11);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx + 4, y + h * 0.56, carLen - 8, 4);
      ctx.fillStyle = "#d9f4ff";
      for (let wx = cx + 12; wx < cx + carLen - 24; wx += 26) {
        ctx.beginPath();
        ctx.roundRect(wx, y + 8, 17, h * 0.34, 4);
        ctx.fill();
      }
      ctx.fillStyle = "#2b2b38";
      for (const k of [0.22, 0.78]) {
        ctx.beginPath();
        ctx.arc(cx + carLen * k, y + h - 7, 6.5, 0, TAU);
        ctx.fill();
      }
      if (isHead) {
        const fx = lane.dir > 0 ? cx + carLen - 16 : cx + 16;
        ctx.fillStyle = "#26263a";
        ctx.beginPath();
        ctx.arc(fx - 6, y + h * 0.36, 3.4, 0, TAU);
        ctx.arc(fx + 6, y + h * 0.36, 3.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#ffe27a";
        ctx.beginPath();
        ctx.arc(lane.dir > 0 ? cx + carLen - 5 : cx + 5, y + h * 0.66, 4.5, 0, TAU);
        ctx.fill();
      }
    }
  }
  function drawRailSignal(lane, top) {
    const x = lane.dir > 0 ? 12 : W - 12;
    ctx.fillStyle = "#3d4256";
    ctx.fillRect(x - 1.5, top - TILE * 0.5, 3, TILE * 1.25);
    ctx.fillStyle = "#23263a";
    ctx.beginPath();
    ctx.roundRect(x - 11, top - TILE * 0.62, 22, 13, 6);
    ctx.fill();
    const on = lane.warn || lane.train;
    const blink = Math.sin(time * 14) > 0;
    ctx.fillStyle = on && blink ? "#ff4040" : "#5c2c34";
    ctx.beginPath();
    ctx.arc(x - 5.5, top - TILE * 0.62 + 6.5, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = on && !blink ? "#ff4040" : "#5c2c34";
    ctx.beginPath();
    ctx.arc(x + 5.5, top - TILE * 0.62 + 6.5, 4, 0, TAU);
    ctx.fill();
    if (on) {
      ctx.fillStyle = `rgba(255,60,60,${0.1 + (blink ? 0.08 : 0)})`;
      ctx.fillRect(0, top, W, TILE);
    }
  }
  function drawLily(e, top) {
    const cx = xPx(e.x + 0.5);
    const cy = top + TILE / 2 + Math.sin(time * 1.6 + e.ph) * 1.2;
    drawShadow(cx + 1, cy + 3, TILE * 0.44, TILE * 0.34, 0.22);
    ctx.fillStyle = "#5fc25a";
    ctx.beginPath();
    ctx.ellipse(cx, cy, TILE * 0.43, TILE * 0.34, 0, 0.32, TAU - 0.32);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - TILE * 0.28, cy - TILE * 0.14);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - TILE * 0.2, cy + TILE * 0.2);
    ctx.stroke();
  }
  function drawWaves(lane, top) {
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i += 1) {
      const wx = ((lane.z * 37 + i * 97 + time * (lane.v * 14 + 8)) % (W + 60) + W + 60) % (W + 60) - 30;
      const y = top + 8 + ((i * 11 + lane.z * 5) % (TILE - 14));
      ctx.beginPath();
      ctx.moveTo(wx, y);
      ctx.quadraticCurveTo(wx + 9, y - 4, wx + 18, y);
      ctx.quadraticCurveTo(wx + 27, y + 4, wx + 36, y);
      ctx.stroke();
    }
  }
  function drawGoal(top) {
    const y = top + TILE - 4;
    // 양쪽 기둥 + 체크 띠
    ctx.fillStyle = "#fff";
    ctx.fillRect(10, y - TILE * 1.9, 6, TILE * 1.9);
    ctx.fillRect(W - 16, y - TILE * 1.9, 6, TILE * 1.9);
    const bannerY = y - TILE * 2.05;
    ctx.fillStyle = "#ff5f8f";
    ctx.beginPath();
    ctx.roundRect(4, bannerY, W - 8, 30, 9);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = '400 19px "Bagel Fat One", "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("도착!", W / 2, bannerY + 16);
    ctx.textBaseline = "alphabetic";
    const s = TILE / 4;
    for (let r = 0; r < 2; r += 1) {
      for (let i = 0; i < COLS * 4; i += 1) {
        ctx.fillStyle = (r + i) % 2 ? "#fff" : "#26263a";
        ctx.fillRect(i * s, top + TILE / 2 - s + r * s, s + 0.4, s + 0.4);
      }
    }
  }
  function drawChick() {
    let x = player.x;
    let zv = player.z;
    let lift = 0;
    let sx = 1;
    let sy = 1;
    if (hop) {
      x = lerp(hop.fx, hop.tx, hop.t);
      zv = lerp(hop.fz, hop.tz, hop.t);
      lift = Math.sin(hop.t * Math.PI) * 17;
      const k = Math.sin(hop.t * Math.PI);
      sx = 1 - k * 0.1;
      sy = 1 + k * 0.1;
    } else if (idleT < 0.12) {
      const k = 1 - idleT / 0.12;
      sx = 1 + k * 0.12;
      sy = 1 - k * 0.14;
    } else {
      sy = 1 + Math.sin(time * 3) * 0.015;
    }
    if (state === "finish") lift = Math.abs(Math.sin(finishT * 8)) * 16;
    const cx = xPx(x + 0.5) + (bumpT > 0 ? Math.sin(bumpT * 60) * 2 : 0);
    const groundY = rowTop(zv) + TILE - 6;
    let key = "chick_back";
    if (player.dir === 1 || player.dir === 3) key = "chick_side";
    if (player.dir === 2) key = "chick_front";
    if (!hop && idleT > 0.75) key = (time + 1) % 5 < 0.7 ? "chick_wave" : "chick_front";
    const faceOn = window.TodayFace && window.TodayFace.ready && window.TodayFace.ready();
    if (faceOn) key = "chick_front";
    if (state === "finish") key = "chick_wave";
    const img = imgs[key];
    if (!img) return;
    const h = TILE * 1.2;
    const w = h * (img.width / img.height);
    if (state === "dying") {
      if (deathKind === "splash") {
        const u = deathT / 0.8;
        ctx.strokeStyle = `rgba(255,255,255,${1 - u})`;
        ctx.lineWidth = 3;
        for (const k of [0.6, 1]) {
          ctx.beginPath();
          ctx.ellipse(cx, groundY - 8, TILE * 0.6 * u * k + 6, TILE * 0.26 * u * k + 3, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, groundY - 6);
        ctx.clip();
        ctx.globalAlpha = 1 - u * 0.7;
        ctx.drawImage(img, cx - w / 2, groundY - h + u * h, w, h);
        ctx.restore();
        return;
      }
      if (deathKind === "train") {
        const u = deathT / 0.8;
        ctx.save();
        ctx.translate(cx + u * 120, groundY - h / 2 - Math.sin(u * Math.PI) * 120);
        ctx.rotate(u * 9);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.translate(cx, groundY);
      ctx.scale(1.45, 0.24);
      ctx.drawImage(imgs.chick_front || img, -w / 2, -h, w, h);
      ctx.restore();
      for (let i = 0; i < 3; i += 1) {
        const a = time * 5 + (i / 3) * TAU;
        ctx.fillStyle = "#ffe27a";
        ctx.font = '400 13px "Jua", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText("★", cx + Math.cos(a) * 19, groundY - 22 + Math.sin(a) * 5);
      }
      return;
    }
    drawShadow(cx, groundY - 1, TILE * (0.3 - lift * 0.004), TILE * 0.095, 0.26);
    if (invT > 0 && Math.sin(time * 26) < 0) ctx.globalAlpha = 0.45;
    ctx.save();
    ctx.translate(cx, groundY - lift);
    ctx.scale(player.dir === 3 && key === "chick_side" ? -sx : sx, sy);
    ctx.drawImage(img, -w / 2, -h, w, h);
    if (faceOn && window.TodayFace) window.TodayFace.drawHead(ctx, 0, -h * 0.6, h * 0.27);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    if (!player) {
      ctx.fillStyle = world.grass[0];
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    const nearZ = Math.floor(camZ - (H - baseY) / TILE) - 1;
    const farZ = Math.floor(camZ + baseY / TILE) + 2;
    // 줄 바닥
    for (let z = farZ; z >= nearZ; z -= 1) {
      const lane = laneAt(z);
      const top = rowTop(z);
      ctx.drawImage(strip(lane), -0.5, top - 0.5, W + 1, TILE + 1.5);
      if (lane.type === "river") drawWaves(lane, top);
    }
    // 위에 놓이는 것: 먼 줄부터
    const pz = hop ? (hop.t > 0.5 ? hop.tz : hop.fz) : player.z;
    for (let z = farZ; z >= nearZ; z -= 1) {
      const lane = laneAt(z);
      const top = rowTop(z);
      if (lane.goal) drawGoal(top);
      if (lane.type === "river") {
        for (const e of lane.ents) {
          if (e.kind === "lily") drawLily(e, top);
          else {
            const img = logSprite(e.w);
            ctx.drawImage(img, xPx(e.x), top + TILE * 0.13, (e.w * TILE) + 4, TILE * 0.72 + 6);
          }
        }
      }
      if (lane.coin != null && lane.coin >= 0) {
        const b = Math.sin(time * 4 + z) * 2;
        ctx.drawImage(cornSprite(), xPx(lane.coin + 0.5) - 13, top + 6 + b, 26, 30);
      }
      if (lane.type === "grass") {
        const img = imgs[world.tree];
        for (const t of lane.trees) {
          if (!img) continue;
          const h = TILE * 1.62;
          const w = h * (img.width / img.height);
          const cx = xPx(t + 0.5);
          const gy = top + TILE - 5;
          drawShadow(cx, gy, w * 0.34, TILE * 0.13);
          ctx.drawImage(img, cx - w / 2, gy - h, w, h);
        }
      }
      if (lane.type === "rail") drawRailSignal(lane, top);
      if (z === pz) drawChick();
      if (lane.type === "road") for (const e of lane.ents) drawVehicle(e, lane, top);
      if (lane.type === "rail") drawTrain(lane, top);
    }
    for (const p of particles) {
      if (p.conf) {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const w of weather) {
      if (world.weather === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(w.x, w.y, 1.4 + w.z * 1.1, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = world.weather === "petal" ? "#ffc4d9" : w.p > 3 ? "#e8863a" : "#d9a636";
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, 4 * w.z, 2.2 * w.z, time * 2 + w.p, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    for (const f of floats) {
      const u = f.t / f.life;
      ctx.globalAlpha = u > 0.6 ? (1 - u) / 0.4 : 1;
      ctx.font = `400 ${f.big ? 26 : 19}px "Bagel Fat One", "Jua", sans-serif`;
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
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000 || 0.016, 0, 0.033);
    last = now;
    if (state !== "paused") update(dt);
    draw();
  }

  /* ---------- 입력 ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (state !== "play" || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w" || k === " ") {
      e.preventDefault();
      tryMove(0, 1);
    } else if (k === "arrowdown" || k === "s") {
      e.preventDefault();
      tryMove(0, -1);
    } else if (k === "arrowleft" || k === "a") {
      e.preventDefault();
      tryMove(-1, 0);
    } else if (k === "arrowright" || k === "d") {
      e.preventDefault();
      tryMove(1, 0);
    }
  });
  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const d = btn.dataset.dir;
      if (d === "up") tryMove(0, 1);
      else if (d === "down") tryMove(0, -1);
      else if (d === "left") tryMove(-1, 0);
      else if (d === "right") tryMove(1, 0);
    });
  });
  canvas.addEventListener("pointerdown", (e) => {
    swipe = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!swipe || state !== "play") return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) tryMove(0, 1);
    else if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
    else tryMove(0, dy < 0 ? 1 : -1);
  });
  $("start-btn").addEventListener("click", startFromTitle);
  $("restart-btn").addEventListener("click", () => {
    save.stage = 0;
    save.score = 0;
    persist();
    renderTitle();
    startFromTitle();
  });
  $("next-btn").addEventListener("click", () => startStage(stageIndex + 1));
  $("retry-btn").addEventListener("click", () => {
    if (window.TodayGameRank) window.TodayGameRank.reset();
    score = endless ? save.score : scoreAtStart;
    startStage(stageIndex);
  });
  $("endless-btn").addEventListener("click", () => {
    if (window.TodayGameRank) window.TodayGameRank.reset();
    endless = true;
    startStage(TOTAL - 1);
  });

  if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: "crossy", gameTitle: "삐약이 건너기", formParent: overlays.over });
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
        last = performance.now();
        return true;
      },
    });
  }
  addEventListener("resize", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  fit();
  renderTitle();
  stageIndex = save.stage;
  resetStage();
  state = "title";
  showOverlay("title");
  loadAssets().then(() => {
    last = performance.now();
    requestAnimationFrame(loop);
  });

  // 점검용
  window.CrossyChick = {
    get s() {
      return { state, stageIndex, hearts, score, goal, maxZ, x: player.x, z: player.z, hop: Boolean(hop), on: Boolean(player.on), invT, PX, H, camZ };
    },
    update,
    tryMove,
    startStage,
    laneAt,
    vehicleHit,
    trainHit,
    logUnder,
    treeAt,
    HOP,
    COLS,
    save,
    stageGoal,
    WORLDS,
    die,
    deaths,
    finishNow() {
      if (state === "finish") finishT = 2;
    },
    clearAll() {
      score = 0;
    },
  };
})();
