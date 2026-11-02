(() => {
  "use strict";

  /*
   * 드리프트 삐약이
   *  - 카메라가 차를 따라 돌고, 땅 · 길 · 나무가 모두 세상에 붙어 있음
   *  - 차는 길을 따라가고 좌우 위치만 움직임: 커브에서 안 누르면 바깥으로 밀리고, 꺾이는 쪽을 누르면 미끄러지며 버팀
   *  - 화면 픽셀에 맞춰 그려 또렷함
   *  - 코스 밖으로 나가면 하트가 줄고 길로 돌아옴 (3번째에 끝)
   *  - 800m 마다 풍경이 바뀜
   */
  const W = 390;
  const BEST_KEY = "drift-chick-best";
  const TRACK_HALF = 74;
  const CAR_R = 18;
  const KART_W = 74;
  const KART_H = KART_W * (666 / 504);
  const FACE = [0.523, 0.72, 0.17];
  const SECTION = 800;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);
  const angNorm = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const angLerp = (a, b, t) => a + angNorm(b - a) * t;

  const THEMES = [
    { name: "초록 들판", ground: ["#86d662", "#74c853"], blob: "rgba(255,255,255,0.1)", tuft: "rgba(40,100,30,0.28)", road: ["#566072", "#69748a"], curb: "#ff5f7a", tree: "tree", flowers: ["#fff", "#ffd84a", "#ff9cc2"] },
    { name: "벚꽃 길", ground: ["#a3e27f", "#92d670"], blob: "rgba(255,190,220,0.3)", tuft: "rgba(50,110,40,0.25)", road: ["#5c6176", "#6e7389"], curb: "#ff7fae", tree: "tree_pink", flowers: ["#ffb3d1", "#fff", "#ff8ab5"], weather: "petal" },
    { name: "바닷가 모래밭", ground: ["#f6e3ab", "#eed693"], blob: "rgba(200,160,90,0.15)", tuft: "rgba(160,120,60,0.25)", road: ["#566577", "#68788c"], curb: "#39b6e8", tree: "tree", flowers: ["#fff", "#ffd27a", "#f7c1a0"] },
    { name: "단풍 고개", ground: ["#d3cc66", "#c5bd56"], blob: "rgba(214,110,50,0.2)", tuft: "rgba(120,90,30,0.28)", road: ["#5c5a68", "#6e6c7c"], curb: "#ff8a3c", tree: "tree_fall", flowers: ["#ff9a4a", "#ffd24a", "#e8643c"], weather: "leaf" },
    { name: "눈 쌓인 길", ground: ["#f0f6fb", "#e2edf6"], blob: "rgba(150,190,230,0.24)", tuft: "rgba(120,160,200,0.25)", road: ["#4e586b", "#616c82"], curb: "#6ec6ff", tree: "tree_snow", flowers: ["#fff", "#cfe6ff", "#fff"], weather: "snow" },
  ];

  const NAMES = ["player", "tree", "tree_pink", "tree_fall", "tree_snow", "cone"];
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
        this.buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const d = this.buf.getChannelData(0);
        for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
        // 엔진 + 타이어 소리 (계속 틀어 두고 크기만 조절)
        const c = this.ctx;
        const o = c.createOscillator();
        o.type = "sawtooth";
        const f = c.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 360;
        const g = c.createGain();
        g.gain.value = 0;
        o.connect(f);
        f.connect(g);
        g.connect(c.destination);
        o.start();
        const s = c.createBufferSource();
        s.buffer = this.buf;
        s.loop = true;
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1500;
        bp.Q.value = 2.4;
        const sg = c.createGain();
        sg.gain.value = 0;
        s.connect(bp);
        bp.connect(sg);
        sg.connect(c.destination);
        s.start();
        this.eng = { o, g, sg };
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    },
    loopSet(speed, drift, on) {
      if (!this.eng) return;
      const t = this.ctx.currentTime;
      this.eng.o.frequency.setTargetAtTime(52 + speed * 0.22, t, 0.08);
      this.eng.g.gain.setTargetAtTime(on ? 0.026 : 0, t, 0.1);
      this.eng.sg.gain.setTargetAtTime(on ? drift * 0.085 : 0, t, 0.05);
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
      s.start(t, Math.random());
      s.stop(t + dur + 0.03);
    },
    combo(n) {
      const f = 660 * Math.pow(2, Math.min(n, 10) / 12);
      this.tone(f, 0.12, "triangle", 0.13);
      this.tone(f * 1.5, 0.16, "sine", 0.09, 1, 0.06);
    },
    coin(n) {
      const f = 880 * Math.pow(2, Math.min(n, 8) / 12);
      this.tone(f, 0.08, "sine", 0.12);
    },
    crash() {
      this.noise(0.4, 700, "lowpass", 0.5);
      this.tone(160, 0.28, "square", 0.13, 0.4);
    },
    boost() {
      this.tone(320, 0.5, "sawtooth", 0.09, 3);
      this.noise(0.45, 1800, "highpass", 0.11);
    },
    section() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.13, 1, i * 0.09));
    },
    heart() {
      [660, 880, 1175].forEach((f, i) => this.tone(f, 0.14, "sine", 0.13, 1, i * 0.07));
    },
  };

  /* ---------- 화면 ---------- */
  const stageEl = $("stage");
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  let H = 700;
  let PX = 1;
  let CY = 500;
  const patterns = new Map();
  let puff = null;
  let coinSprite = null;

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
    CY = H * 0.74;
    patterns.clear();
    puff = null;
    coinSprite = null;
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
  const TILE = 512;
  /** 땅 무늬: 사방으로 이어지는 타일 */
  function groundPattern(i) {
    const key = `g${i}`;
    if (patterns.has(key)) return patterns.get(key);
    const T = THEMES[i];
    const [c, g] = mk(TILE, TILE);
    const r = rnd(i * 91 + 7);
    g.fillStyle = T.ground[0];
    g.fillRect(0, 0, TILE, TILE);
    const wrap = (x, y, rad, draw) => {
      for (const ox of [-TILE, 0, TILE]) {
        for (const oy of [-TILE, 0, TILE]) {
          if (x + ox + rad < 0 || x + ox - rad > TILE || y + oy + rad < 0 || y + oy - rad > TILE) continue;
          draw(x + ox, y + oy);
        }
      }
    };
    for (let k = 0; k < 42; k += 1) {
      const x = r() * TILE;
      const y = r() * TILE;
      const rx = 26 + r() * 70;
      const ry = 16 + r() * 44;
      const rot = r() * 3;
      const dark = r() < 0.6;
      wrap(x, y, rx, (ax, ay) => {
        g.fillStyle = dark ? T.ground[1] : T.blob;
        g.beginPath();
        g.ellipse(ax, ay, rx, ry, rot, 0, TAU);
        g.fill();
      });
    }
    for (let k = 0; k < 420; k += 1) {
      g.fillStyle = T.tuft;
      g.fillRect(r() * TILE, r() * TILE, 1.4, 4.5);
    }
    for (let k = 0; k < 90; k += 1) {
      const x = r() * TILE;
      const y = r() * TILE;
      const col = T.flowers[Math.floor(r() * T.flowers.length)];
      wrap(x, y, 6, (ax, ay) => {
        g.fillStyle = col;
        for (let a = 0; a < 5; a += 1) {
          g.beginPath();
          g.arc(ax + Math.cos((a / 5) * TAU) * 2.3, ay + Math.sin((a / 5) * TAU) * 2.3, 1.6, 0, TAU);
          g.fill();
        }
        g.fillStyle = "#ffcf3f";
        g.beginPath();
        g.arc(ax, ay, 1.3, 0, TAU);
        g.fill();
      });
    }
    const p = ctx.createPattern(c, "repeat");
    p.setTransform(new DOMMatrix().scale(1 / PX));
    patterns.set(key, p);
    return p;
  }
  /** 아스팔트 알갱이 */
  function roadPattern(i) {
    const key = `r${i}`;
    if (patterns.has(key)) return patterns.get(key);
    const T = THEMES[i];
    const [c, g] = mk(256, 256);
    g.fillStyle = T.road[0];
    g.fillRect(0, 0, 256, 256);
    const r = rnd(i * 17 + 3);
    for (let k = 0; k < 2400; k += 1) {
      g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.07)";
      g.fillRect(r() * 256, r() * 256, 1 + r() * 1.6, 1 + r() * 1.6);
    }
    const p = ctx.createPattern(c, "repeat");
    p.setTransform(new DOMMatrix().scale(1 / PX));
    patterns.set(key, p);
    return p;
  }
  function getPuff() {
    if (puff) return puff;
    const [c, g] = mk(64, 64);
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.55, "rgba(255,255,255,0.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    puff = c;
    return c;
  }
  function getCoin() {
    if (coinSprite) return coinSprite;
    const [c, g] = mk(40, 40);
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.beginPath();
    g.ellipse(21, 35, 11, 3.6, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#c98a12";
    g.beginPath();
    g.arc(20, 20, 13.5, 0, TAU);
    g.fill();
    const gr = g.createLinearGradient(0, 7, 0, 33);
    gr.addColorStop(0, "#fff0a0");
    gr.addColorStop(1, "#ffc21f");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(20, 19, 12, 0, TAU);
    g.fill();
    g.fillStyle = "#e89a0c";
    g.font = '400 15px "Bagel Fat One", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("삐", 20, 20);
    coinSprite = c;
    return c;
  }

  /* ---------- 상태 ---------- */
  const overlays = { title: $("title"), over: $("over") };
  let state = "title";
  let holding = false;
  let steerInput = 0;
  let last = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let path = [];
  let decor = [];
  let coins = [];
  let items = [];
  let signs = [];
  let car = null;
  let score = 0;
  let dist = 0;
  let combo = 0;
  let maxCombo = 0;
  let hearts = 3;
  let invT = 0;
  let smoke = [];
  let sparks = [];
  let skids = [[], []];
  let skidOn = false;
  let shake = 0;
  let driftBoost = 0;
  let cornerBonusReady = false;
  let exitBonusReady = false;
  let time = 0;
  let floats = [];
  let curveWarn = 0;
  let perfectStreak = 0;
  let speedLines = 0;
  let section = 0;
  let themeI = 0;
  let themeFrom = 0;
  let themeMix = 1;
  let coinChain = 0;
  let weather = [];
  let hudTick = 0;
  let pathGen = null;
  let pathProgress = 0;
  let themeForDecor = 0;

  function show(id) {
    for (const k of Object.keys(overlays)) overlays[k].classList.toggle("hidden", k !== id);
    document.body.classList.toggle("in-play", !id);
  }

  /* ---------- 길 만들기 ---------- */
  function pushPathPoint(step, curve) {
    pathGen.ang += curve;
    pathGen.x += Math.cos(pathGen.ang) * step;
    pathGen.y += Math.sin(pathGen.ang) * step;
    pathGen.s += step;
    path.push({ x: pathGen.x, y: pathGen.y, ang: pathGen.ang, curve, s: pathGen.s });
  }
  function appendCurveSegment() {
    pathProgress += 1;
    const progress = Math.min(1, pathProgress / 35);
    const roll = Math.random();
    const curveBias = 0.78 + progress * 0.15;
    if (roll > curveBias) {
      const len = 3 + Math.floor(Math.random() * 5);
      for (let k = 0; k < len; k += 1) pushPathPoint(20, 0);
      return;
    }
    const kind = Math.random();
    const dir = Math.random() < 0.7 ? -pathGen.lastDir : pathGen.lastDir;
    pathGen.lastDir = dir;
    const scale = 0.95 + progress * 0.4;
    if (kind < 0.2) {
      const sharp = (0.018 + Math.random() * 0.01) * scale;
      const len = 28 + Math.floor(Math.random() * 16);
      for (let k = 0; k < len; k += 1) pushPathPoint(19, dir * sharp);
    } else if (kind < 0.7) {
      const sharp = (0.015 + Math.random() * 0.008) * scale;
      const a = 26 + Math.floor(Math.random() * 14);
      const b = 26 + Math.floor(Math.random() * 14);
      for (let k = 0; k < a; k += 1) pushPathPoint(19, dir * sharp);
      for (let k = 0; k < 3; k += 1) pushPathPoint(20, 0);
      for (let k = 0; k < b; k += 1) pushPathPoint(19, -dir * sharp);
      if (Math.random() < 0.4) {
        for (let k = 0; k < 3; k += 1) pushPathPoint(20, 0);
        const c = 20 + Math.floor(Math.random() * 12);
        for (let k = 0; k < c; k += 1) pushPathPoint(19, dir * sharp);
        pathGen.lastDir = dir;
      } else {
        pathGen.lastDir = -dir;
      }
    } else {
      const sharp = (0.014 + Math.random() * 0.009) * scale;
      const len = 24 + Math.floor(Math.random() * 16);
      for (let k = 0; k < len; k += 1) pushPathPoint(19, dir * sharp);
    }
  }
  /** 길 옆 나무 · 콘 · 표지판 · 모이 */
  function populate(startIdx) {
    themeForDecor = themeI;
    for (let i = Math.max(startIdx, 2); i < path.length - 2; i += 1) {
      const p = path[i];
      const nx = Math.cos(p.ang + Math.PI / 2);
      const ny = Math.sin(p.ang + Math.PI / 2);
      if (i % 3 === 0) {
        const side = Math.random() < 0.5 ? 1 : -1;
        const out = TRACK_HALF + 34 + Math.random() * 110;
        const kindR = Math.random();
        const kind = kindR < 0.62 ? "tree" : kindR < 0.74 ? "cone" : "bush";
        decor.push({ x: p.x + nx * side * out, y: p.y + ny * side * out, kind, s: 0.72 + Math.random() * 0.5, theme: themeForDecor });
      }
      // 커브 입구에 화살표 판
      const prev = path[i - 1];
      if (Math.abs(p.curve) > 0.0065 && Math.abs(prev.curve) < 0.0065) {
        const dir = Math.sign(p.curve);
        const back = path[Math.max(0, i - 6)];
        const bx = Math.cos(back.ang + Math.PI / 2);
        const by = Math.sin(back.ang + Math.PI / 2);
        const off = (TRACK_HALF + 22) * -dir;
        signs.push({ x: back.x + bx * off, y: back.y + by * off, dir });
      }
      // 커브 안쪽 줄에 모이
      if (Math.abs(p.curve) > 0.0065 && i % 4 === 0 && Math.random() < 0.55) {
        const lat = Math.sign(p.curve) * 20;
        coins.push({ x: p.x + nx * lat, y: p.y + ny * lat });
      }
      // 직선의 부스터
      if (Math.abs(p.curve) < 0.001 && i > 60 && Math.random() < 0.018) {
        items.push({ type: "boost", x: p.x, y: p.y, ang: p.ang });
      } else if (i > 200 && Math.abs(p.curve) < 0.001 && Math.random() < 0.004) {
        items.push({ type: "heart", x: p.x, y: p.y });
      }
    }
    if (decor.length > 460) decor.splice(0, decor.length - 460);
    if (coins.length > 200) coins.splice(0, coins.length - 200);
    if (signs.length > 40) signs.splice(0, signs.length - 40);
    if (items.length > 30) items.splice(0, items.length - 30);
  }
  function ensurePathAhead(minAhead = 90) {
    if (!car || !pathGen) return;
    while (path.length - 1 - car.idx < minAhead) {
      const before = path.length;
      appendCurveSegment();
      populate(before);
    }
    if (car.idx > 180 && path.length > 420) {
      const cut = car.idx - 80;
      path = path.slice(cut);
      car.idx -= cut;
      car.u -= cut;
    }
  }
  function buildPath() {
    path = [];
    pathProgress = 0;
    pathGen = { x: 0, y: 0, ang: -Math.PI / 2, lastDir: 1, s: 0 };
    path.push({ x: 0, y: 0, ang: pathGen.ang, curve: 0, s: 0 });
    for (let i = 0; i < 34; i += 1) pushPathPoint(20, 0);
    for (let i = 0; i < 30; i += 1) pushPathPoint(20, -0.014);
    for (let i = 0; i < 5; i += 1) pushPathPoint(20, 0);
    for (let i = 0; i < 30; i += 1) pushPathPoint(20, 0.014);
    for (let i = 0; i < 6; i += 1) pushPathPoint(20, 0);
    while (path.length < 220) appendCurveSegment();
  }
  /** 차 위치 = 길 위 지점 + 좌우 거리 */
  function placeCar() {
    const n = path.length - 2;
    car.u = clamp(car.u, 0, n);
    const i = Math.floor(car.u);
    const t = car.u - i;
    const a = path[i];
    const b = path[i + 1];
    car.idx = i;
    const ang = a.ang + angNorm(b.ang - a.ang) * t;
    car.pathAng = ang;
    const nx = Math.cos(ang + Math.PI / 2);
    const ny = Math.sin(ang + Math.PI / 2);
    car.x = lerp(a.x, b.x, t) + nx * car.lat;
    car.y = lerp(a.y, b.y, t) + ny * car.lat;
    car.ang = ang + car.yaw;
    return a;
  }

  function resetRun() {
    decor = [];
    coins = [];
    items = [];
    signs = [];
    themeI = 0;
    themeFrom = 0;
    themeMix = 1;
    section = 0;
    buildPath();
    populate(0);
    car = { u: 8, lat: 0, latV: 0, yaw: 0, x: 0, y: 0, ang: path[8].ang, pathAng: path[8].ang, camAng: path[8].ang, speed: 175, idx: 8, drift: 0, lastSteer: 0 };
    placeCar();
    score = 0;
    dist = 0;
    combo = 0;
    maxCombo = 0;
    hearts = 3;
    invT = 0;
    smoke = [];
    sparks = [];
    skids = [[], []];
    skidOn = false;
    floats = [];
    shake = 0;
    driftBoost = 0;
    cornerBonusReady = false;
    exitBonusReady = false;
    holding = false;
    steerInput = 0;
    time = 0;
    curveWarn = 0;
    perfectStreak = 0;
    speedLines = 0;
    coinChain = 0;
    fillWeather();
    paintHearts();
    updateHud();
  }
  function fillWeather() {
    weather = [];
    const k = THEMES[themeI].weather;
    if (!k) return;
    const n = k === "snow" ? 46 : 26;
    for (let i = 0; i < n; i += 1) weather.push({ x: Math.random() * W, y: Math.random() * H, z: 0.5 + Math.random() * 0.8, p: Math.random() * TAU });
  }
  function paintHearts() {
    let html = "";
    for (let i = 0; i < 3; i += 1) html += `<i class="${i < hearts ? "on" : ""}"></i>`;
    $("hud-hearts").innerHTML = html;
  }
  function updateHud() {
    $("hud-dist").textContent = Math.floor(dist).toLocaleString("ko-KR");
    $("hud-combo").textContent = String(combo);
    $("hud-score").textContent = Math.floor(score).toLocaleString("ko-KR");
    const pct = ((dist % SECTION) / SECTION) * 100;
    $("hud-bar").style.width = `${pct}%`;
  }
  function renderTitle() {
    $("title-best").textContent = `최고 ${best.toLocaleString("ko-KR")}점`;
  }
  function spawnFloat(text, color, big = false) {
    floats.push({ text, color: color || "#ff4f8b", life: 0.95, t: 0, y: 0, big });
    if (floats.length > 4) floats.shift();
  }
  function startGame() {
    if (window.TodayGameRank) window.TodayGameRank.reset();
    Sound.unlock();
    resetRun();
    show(null);
    $("hint").classList.remove("hidden");
    hintT = 4.5;
    state = "play";
    last = performance.now();
  }
  let hintT = 0;
  let comboGrace = 0;
  function gameOver() {
    if (state !== "play") return;
    state = "over";
    shake = 14;
    holding = false;
    Sound.loopSet(0, 0, false);
    if (score > best) {
      best = Math.floor(score);
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    $("over-detail").textContent = `${Math.floor(dist).toLocaleString("ko-KR")}m · ${Math.floor(score).toLocaleString("ko-KR")}점 · 최고 콤보 ${maxCombo}`;
    setTimeout(() => {
      show("over");
      renderTitle();
      if (window.TodayGameRank) window.TodayGameRank.open(Math.max(1, Math.floor(score)), { label: `${Math.floor(dist)}m` });
    }, 700);
  }

  /* ---------- 입력 ---------- */
  function updateSteerFromPointer(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const raw = (x - W / 2) / (W * 0.3);
    const sign = Math.sign(raw) || 1;
    steerInput = sign * clamp(Math.abs(raw), 0.75, 1);
  }
  function setHold(v, e) {
    const was = holding;
    holding = v;
    if (v && e) updateSteerFromPointer(e.clientX);
    if (!v) steerInput = 0;
    if (state === "play" && v && !was) {
      cornerBonusReady = true;
      exitBonusReady = true;
    }
  }

  /* ---------- 효과 ---------- */
  function spawnSmoke(x, y, ang, side) {
    const ox = Math.cos(ang + Math.PI / 2) * side * 18;
    const oy = Math.sin(ang + Math.PI / 2) * side * 18;
    smoke.push({
      x: x + ox - Math.cos(ang) * 26,
      y: y + oy - Math.sin(ang) * 26,
      r: 9 + Math.random() * 9,
      life: 0.5 + Math.random() * 0.4,
      t: 0,
      vx: Math.cos(ang + Math.PI) * (30 + Math.random() * 40) + ox * 1.1,
      vy: Math.sin(ang + Math.PI) * (30 + Math.random() * 40) + oy * 1.1,
    });
    if (smoke.length > 90) smoke.shift();
  }
  function spawnSparks(x, y, colors = ["#fff6a8", "#7dffc2"], n = 18, speed = 160) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = speed * (0.4 + Math.random());
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.4, t: 0, c: colors[Math.floor(Math.random() * colors.length)] });
    }
  }
  function pushSkid(x, y, ang) {
    const sx = Math.cos(ang + Math.PI / 2);
    const sy = Math.sin(ang + Math.PI / 2);
    const bx = Math.cos(ang) * 24;
    const by = Math.sin(ang) * 24;
    [-1, 1].forEach((side, k) => {
      skids[k].push({ x: x + sx * side * 24 - bx, y: y + sy * side * 24 - by, t: time, brk: !skidOn });
      if (skids[k].length > 180) skids[k].shift();
    });
    skidOn = true;
  }

  /* ---------- 진행 ---------- */
  function hitBarrier() {
    hearts -= 1;
    paintHearts();
    Sound.crash();
    shake = 13;
    spawnSparks(car.x, car.y, ["#ff6b6b", "#ffb347", "#fff"], 24, 210);
    combo = 0;
    perfectStreak = 0;
    driftBoost = 0;
    car.drift = 0;
    car.yaw = 0;
    car.latV = 0;
    skidOn = false;
    if (hearts <= 0) {
      spawnFloat("코스 아웃!", "#ff5a6a", true);
      gameOver();
      return;
    }
    spawnFloat(`앗! 하트 ${hearts}개`, "#ff5a6a", true);
    car.lat *= 0.45;
    invT = 1.8;
  }
  function update(dt) {
    time += dt;
    tickWeather(dt);
    if (state === "title") {
      // 첫 화면: 길 가운데를 혼자 달림
      if (!car) return;
      ensurePathAhead(120);
      car.u += (130 * dt) / 20;
      car.lat = 0;
      car.yaw = 0;
      placeCar();
      car.camAng = angLerp(car.camAng, car.pathAng, clamp(dt * 6, 0, 1));
      return;
    }
    if (state !== "play" || !car) {
      tickFx(dt);
      return;
    }
    if (hintT > 0) {
      hintT -= dt;
      if (hintT <= 0) $("hint").classList.add("hidden");
    }
    if (invT > 0) invT -= dt;

    ensurePathAhead(120);
    const here = path[car.idx];
    const curv = Math.abs(here.curve);
    const curveDir = Math.sign(here.curve || 0);
    const onCurve = curv > 0.0065;

    const look = path[Math.min(path.length - 1, car.idx + 20)];
    const look2 = path[Math.min(path.length - 1, car.idx + 34)];
    const aheadCurve = (look.curve + look2.curve) * 0.5;
    curveWarn = onCurve ? curveDir : Math.abs(aheadCurve) > 0.007 ? Math.sign(aheadCurve) : 0;

    const base = 175 + Math.min(130, dist * 0.07);
    car.speed = base + driftBoost * 55 + car.drift * 18;
    speedLines = lerp(speedLines, driftBoost > 0.25 || car.drift > 0.55 ? 1 : 0, 1 - Math.pow(0.01, dt));

    const pressing = holding && Math.abs(steerInput) > 0.06;
    const steerSign = Math.sign(steerInput);
    // 원심력: 커브 바깥으로 밀림 / 누르는 힘: 누른 쪽으로 감. 맞는 쪽을 누르면 언제나 버틸 수 있음
    const press = 92 + car.speed * 0.24;
    const out = onCurve ? Math.min(112, (curv / 0.015) * 40 * (car.speed / 190)) : 0;
    let wantV;
    if (pressing && (!onCurve || steerSign === curveDir)) {
      // 맞게 누르면 안쪽 줄을 탐 (연석에 딱 붙지 않아 S자에서도 바로 부딪히지 않음)
      wantV = clamp((steerSign * (onCurve ? 20 : 30) - car.lat) * 3.2, -press, press);
    } else if (pressing) {
      wantV = -curveDir * out + steerSign * press * 0.3;
    } else if (onCurve) {
      wantV = -curveDir * out;
    } else {
      wantV = clamp(-car.lat * 2.4, -110, 110);
    }
    car.latV = lerp(car.latV, wantV, 1 - Math.pow(0.0015, dt));
    car.lat += car.latV * dt;

    const yawTarget = pressing ? steerSign * (0.3 + car.drift * 0.26 + (onCurve ? 0.08 : 0)) : 0;
    car.yaw = lerp(car.yaw, yawTarget, 1 - Math.pow(0.004, dt));

    if (pressing) {
      if (steerSign !== car.lastSteer) {
        car.lastSteer = steerSign;
        cornerBonusReady = true;
      }
      car.drift = Math.min(1, car.drift + dt * 3.2);
      const correct = onCurve && steerSign === curveDir;
      if (correct) {
        comboGrace = 0.45;
        score += dt * (55 + combo * 14);
        driftBoost = Math.min(1, driftBoost + dt * 0.4);
        if (cornerBonusReady && car.drift > 0.28) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          perfectStreak += 1;
          score += 22 + combo * 6;
          cornerBonusReady = false;
          spawnSparks(car.x, car.y);
          shake = Math.max(shake, 3 + Math.min(3, combo * 0.2));
          const labels = ["DRIFT!", "NICE!", "SUPER!", "야호!", "PERFECT!"];
          const idx = Math.min(labels.length - 1, perfectStreak - 1);
          spawnFloat(combo > 1 ? `${labels[idx]} x${combo}` : labels[idx], perfectStreak >= 4 ? "#7dffc2" : "#ffd84a");
          Sound.combo(combo);
        }
      } else if (onCurve) {
        combo = 0;
        perfectStreak = 0;
      }
      pushSkid(car.x, car.y, car.ang);
      if (Math.random() < dt * 34) {
        spawnSmoke(car.x, car.y, car.ang, 1);
        spawnSmoke(car.x, car.y, car.ang, -1);
      }
    } else {
      skidOn = false;
      if (exitBonusReady && car.drift > 0.35 && !onCurve) {
        score += 28 + combo * 3;
        exitBonusReady = false;
        spawnFloat("클린!", "#7dffc2");
        driftBoost = Math.max(driftBoost, 0.7);
      }
      car.drift = Math.max(0, car.drift - dt * 2.8);
      if (onCurve) {
        comboGrace -= dt;
        if (comboGrace <= 0) {
          combo = 0;
          perfectStreak = 0;
        }
      }
    }
    if (!onCurve) cornerBonusReady = true;
    driftBoost = Math.max(0, driftBoost - dt * 0.5);

    const seg = Math.max(1, Math.hypot(path[car.idx + 1].x - here.x, path[car.idx + 1].y - here.y));
    car.u += (car.speed * dt) / seg;
    dist += (car.speed * dt) / 12;
    score += dt * 6;

    // 구간이 바뀌면 풍경 전환
    const sec = Math.floor(dist / SECTION);
    if (sec !== section) {
      section = sec;
      themeFrom = themeI;
      themeI = sec % THEMES.length;
      themeMix = 0;
      score += 300;
      fillWeather();
      Sound.section();
      spawnFloat(`${THEMES[themeI].name} +300`, "#fff", true);
      spawnSparks(car.x, car.y, ["#ffd84a", "#ff9ec4", "#6ff0ff", "#fff"], 30, 240);
    }
    if (themeMix < 1) themeMix = Math.min(1, themeMix + dt / 1.4);

    // 바깥으로 밀려 나가면 하트가 줄고, 안쪽 · 직선은 연석을 타고 미끄러짐
    const limit = TRACK_HALF - CAR_R * 0.9;
    if (Math.abs(car.lat) > limit) {
      const outward = onCurve && Math.sign(car.lat) === -curveDir;
      if (outward && invT <= 0) {
        hitBarrier();
        if (state !== "play") {
          tickFx(dt);
          return;
        }
      } else {
        if (Math.random() < dt * 24) spawnSparks(car.x, car.y, ["#fff6a8", "#fff"], 3, 90);
        car.lat = clamp(car.lat, -limit, limit);
        car.latV = 0;
      }
    }
    placeCar();
    car.camAng = angLerp(car.camAng, car.pathAng + car.yaw * 0.25, clamp(dt * 7, 0, 1));
    ensurePathAhead(100);

    // 먹기
    for (const c of coins) {
      if (c.got) continue;
      const dx = c.x - car.x;
      const dy = c.y - car.y;
      if (dx * dx + dy * dy < 1000) {
        c.got = true;
        coinChain += 1;
        score += 10;
        Sound.coin(coinChain);
        spawnSparks(c.x, c.y, ["#ffe27a", "#fff"], 5, 80);
      }
    }
    coins = coins.filter((c) => !c.got);
    for (const it of items) {
      if (it.got) continue;
      const dx = it.x - car.x;
      const dy = it.y - car.y;
      if (dx * dx + dy * dy < 1900) {
        it.got = true;
        if (it.type === "boost") {
          driftBoost = 1;
          Sound.boost();
          spawnFloat("부스터!", "#6ff0ff", true);
          spawnSparks(car.x, car.y, ["#6ff0ff", "#fff"], 14);
        } else if (hearts < 3) {
          hearts += 1;
          paintHearts();
          Sound.heart();
          spawnFloat("하트 +1", "#ff6f91", true);
        } else {
          score += 100;
          Sound.heart();
          spawnFloat("+100", "#ff6f91");
        }
      }
    }
    items = items.filter((it) => !it.got);
    Sound.loopSet(car.speed, holding ? car.drift : 0, true);
    tickFx(dt);
    hudTick += dt;
    if (hudTick > 0.08) {
      hudTick = 0;
      updateHud();
    }
  }
  function tickFx(dt) {
    shake = Math.max(0, shake - dt * 18);
    for (const s of smoke) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.97;
      s.vy *= 0.97;
    }
    smoke = smoke.filter((s) => s.t < s.life);
    for (const s of sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    sparks = sparks.filter((s) => s.t < s.life);
    for (const f of floats) {
      f.t += dt;
      f.y -= 44 * dt;
    }
    floats = floats.filter((f) => f.t < f.life);
    if (themeMix < 1) themeMix = Math.min(1, themeMix + dt / 1.4);
  }
  function tickWeather(dt) {
    const k = THEMES[themeI].weather;
    for (const w of weather) {
      w.y += (k === "snow" ? 90 : 110) * w.z * dt;
      w.x += Math.sin(time * 1.3 + w.p) * 22 * dt;
      if (w.y > H + 10) {
        w.y = -10;
        w.x = Math.random() * W;
      }
    }
  }

  /* ---------- 그리기 ---------- */
  function camAngle() {
    return -car.camAng - Math.PI / 2;
  }
  function worldToScreen(x, y) {
    const dx = x - car.x;
    const dy = y - car.y;
    const a = camAngle();
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: dx * c - dy * s + W / 2, y: dx * s + dy * c + CY };
  }
  function applyCamera() {
    ctx.translate(W / 2, CY);
    ctx.rotate(camAngle());
    ctx.translate(-car.x, -car.y);
  }
  function drawGround(R) {
    ctx.fillStyle = groundPattern(themeMix < 1 ? themeFrom : themeI);
    ctx.fillRect(car.x - R, car.y - R, R * 2, R * 2);
    if (themeMix < 1) {
      ctx.globalAlpha = themeMix;
      ctx.fillStyle = groundPattern(themeI);
      ctx.fillRect(car.x - R, car.y - R, R * 2, R * 2);
      ctx.globalAlpha = 1;
    }
  }
  function drawTrack() {
    const T = THEMES[themeI];
    const start = Math.max(0, car.idx - 18);
    const end = Math.min(path.length - 1, car.idx + 60);
    const stroke = (style, width, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = start; i <= end; i += 1) {
        const p = path[i];
        if (i === start) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    ctx.lineJoin = "round";
    ctx.lineCap = "butt";
    const hw = TRACK_HALF * 2;
    stroke("rgba(20,40,20,0.2)", hw + 40);
    stroke("#ffffff", hw + 20);
    // 연석 (길과 함께 움직이게 시작 거리에 맞춤)
    ctx.setLineDash([28, 28]);
    ctx.lineDashOffset = path[start].s;
    stroke(T.curb, hw + 20);
    ctx.setLineDash([]);
    stroke("rgba(0,0,0,0.2)", hw + 3);
    stroke(roadPattern(themeI), hw);
    stroke(T.road[1], hw - 46, 0.32);
    stroke(T.road[1], hw - 84, 0.3);
    // 가운데 점선
    ctx.setLineDash([22, 26]);
    ctx.lineDashOffset = path[start].s;
    stroke("#ffe566", 4.5);
    ctx.setLineDash([]);
    // 양쪽 흰 선
    for (const side of [-1, 1]) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = start; i <= end; i += 1) {
        const p = path[i];
        const x = p.x + Math.cos(p.ang + Math.PI / 2) * side * (TRACK_HALF - 9);
        const y = p.y + Math.sin(p.ang + Math.PI / 2) * side * (TRACK_HALF - 9);
        if (i === start) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 부스터 칸
    for (const it of items) {
      if (it.type !== "boost") continue;
      const dx = it.x - car.x;
      const dy = it.y - car.y;
      if (dx * dx + dy * dy > 500000) continue;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.ang + Math.PI / 2);
      ctx.fillStyle = "rgba(20,160,220,0.92)";
      ctx.beginPath();
      ctx.roundRect(-34, -34, 68, 68, 12);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 2; i += 1) {
        const off = ((time * 48 + i * 22) % 44) - 22;
        ctx.globalAlpha = 1 - Math.abs(off) / 26;
        ctx.beginPath();
        ctx.moveTo(0, -14 - off);
        ctx.lineTo(19, 5 - off);
        ctx.lineTo(10, 5 - off);
        ctx.lineTo(0, -5 - off);
        ctx.lineTo(-10, 5 - off);
        ctx.lineTo(-19, 5 - off);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
  function drawSkids() {
    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    for (const line of skids) {
      for (let i = 1; i < line.length; i += 1) {
        const a = line[i - 1];
        const b = line[i];
        if (b.brk) continue;
        const age = time - b.t;
        if (age > 3) continue;
        ctx.strokeStyle = `rgba(24,22,32,${0.32 * (1 - age / 3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  function drawSmoke() {
    const img = getPuff();
    for (const s of smoke) {
      const u = s.t / s.life;
      const r = s.r * (1 + u * 2.3);
      ctx.globalAlpha = 0.62 * (1 - u);
      ctx.drawImage(img, s.x - r, s.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    for (const s of sparks) {
      ctx.globalAlpha = 1 - s.t / s.life;
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x - 2.5, s.y - 2.5, 5, 5);
    }
    ctx.globalAlpha = 1;
  }
  /** 길 밖 물건들: 카메라가 돌아도 늘 똑바로 서 있음 */
  function drawUpright() {
    const list = [];
    const R = Math.max(W, H) + 90;
    const near = (x, y) => Math.abs(x - car.x) < R && Math.abs(y - car.y) < R;
    for (const d of decor) if (near(d.x, d.y)) list.push(d);
    for (const s of signs) if (near(s.x, s.y)) list.push(Object.assign(s, { kind: "sign" }));
    for (const c of coins) if (near(c.x, c.y)) list.push(Object.assign(c, { kind: "coin" }));
    for (const it of items) if (it.type === "heart" && near(it.x, it.y)) list.push(Object.assign(it, { kind: "heart" }));
    const shown = [];
    for (const o of list) {
      const p = worldToScreen(o.x, o.y);
      if (p.y < -110 || p.y > H + 130 || p.x < -90 || p.x > W + 90) continue;
      shown.push({ o, p });
    }
    shown.sort((a, b) => a.p.y - b.p.y);
    const ground = (x, y, rx, ry) => {
      ctx.fillStyle = "rgba(25,40,25,0.22)";
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
      ctx.fill();
    };
    for (const { o, p } of shown) {
      if (o.kind === "coin") {
        const c = getCoin();
        const b = Math.sin(time * 5 + o.x * 0.1) * 2;
        ctx.drawImage(c, p.x - 15, p.y - 22 + b, 30, 30);
      } else if (o.kind === "heart") {
        const k = 1 + Math.sin(time * 6) * 0.08;
        ground(p.x, p.y + 2, 12, 4);
        ctx.save();
        ctx.translate(p.x, p.y - 16);
        ctx.scale(k, k);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#fff";
        heartPath(0, 0, 16);
        ctx.stroke();
        ctx.fillStyle = "#ff5a7e";
        heartPath(0, 0, 16);
        ctx.fill();
        ctx.restore();
      } else if (o.kind === "sign") {
        ground(p.x, p.y + 1, 15, 4);
        ctx.fillStyle = "#5a6478";
        ctx.fillRect(p.x - 14, p.y - 14, 4, 15);
        ctx.fillRect(p.x + 10, p.y - 14, 4, 15);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(p.x - 25, p.y - 41, 50, 29, 6);
        ctx.fill();
        ctx.fillStyle = "#ff5f6e";
        for (let i = 0; i < 3; i += 1) {
          const cx = p.x + o.dir * (-13 + i * 13);
          ctx.beginPath();
          ctx.moveTo(cx + o.dir * 7, p.y - 26.5);
          ctx.lineTo(cx - o.dir * 3, p.y - 37);
          ctx.lineTo(cx - o.dir * 8, p.y - 37);
          ctx.lineTo(cx + o.dir * 2, p.y - 26.5);
          ctx.lineTo(cx - o.dir * 8, p.y - 16);
          ctx.lineTo(cx - o.dir * 3, p.y - 16);
          ctx.closePath();
          ctx.fill();
        }
      } else if (o.kind === "bush") {
        const r = 15 * o.s;
        ground(p.x, p.y + 1, r * 1.2, r * 0.36);
        const cols = themeI === 4 ? ["#cfe2ef", "#eaf3fa"] : themeI === 3 ? ["#c8843a", "#e0a653"] : themeI === 1 ? ["#f09bbd", "#ffc2d9"] : ["#4fa648", "#74c75f"];
        ctx.fillStyle = cols[0];
        ctx.beginPath();
        ctx.arc(p.x - r * 0.7, p.y - r * 0.5, r * 0.72, 0, TAU);
        ctx.arc(p.x + r * 0.7, p.y - r * 0.5, r * 0.72, 0, TAU);
        ctx.arc(p.x, p.y - r * 0.8, r * 0.95, 0, TAU);
        ctx.fill();
        ctx.fillStyle = cols[1];
        ctx.beginPath();
        ctx.arc(p.x - r * 0.25, p.y - r * 1.05, r * 0.44, 0, TAU);
        ctx.arc(p.x + r * 0.5, p.y - r * 0.75, r * 0.3, 0, TAU);
        ctx.fill();
      } else {
        const key = o.kind === "cone" ? "cone" : THEMES[themeI].tree;
        const img = imgs[key];
        if (!img) continue;
        const h = (o.kind === "cone" ? 30 : 86) * o.s;
        const w = h * (img.width / img.height);
        ground(p.x, p.y - 1, w * 0.34, w * 0.11);
        ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
      }
    }
  }
  function heartPath(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.95);
    ctx.bezierCurveTo(x - s * 1.5, y + s * 0.05, x - s * 0.8, y - s * 0.95, x, y - s * 0.28);
    ctx.bezierCurveTo(x + s * 0.8, y - s * 0.95, x + s * 1.5, y + s * 0.05, x, y + s * 0.95);
    ctx.closePath();
  }
  function drawCar() {
    const img = imgs.player;
    if (!img) return;
    const tilt = angNorm(car.ang - car.camAng) * 0.95;
    const blink = invT > 0 && Math.sin(time * 26) < 0;
    ctx.save();
    ctx.translate(W / 2, CY);
    ctx.fillStyle = "rgba(20,24,36,0.3)";
    ctx.beginPath();
    ctx.ellipse(4, 8, KART_W * 0.52, KART_H * 0.5, tilt, 0, TAU);
    ctx.fill();
    if (driftBoost > 0.15) {
      const glow = ctx.createRadialGradient(0, KART_H * 0.5, 3, 0, KART_H * 0.5, 50);
      glow.addColorStop(0, `rgba(125,255,194,${0.7 * driftBoost})`);
      glow.addColorStop(1, "rgba(125,255,194,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-50, KART_H * 0.5 - 50, 100, 100);
    }
    ctx.rotate(tilt);
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.drawImage(img, -KART_W / 2, -KART_H / 2, KART_W, KART_H);
    if (window.TodayFace) window.TodayFace.drawOnSprite(ctx, -KART_W / 2, -KART_H / 2, KART_W, KART_H, FACE);
    ctx.globalAlpha = 1;
    if (driftBoost > 0.3) {
      const flame = 12 + Math.random() * 12 * driftBoost;
      for (const dx of [-12, 12]) {
        ctx.fillStyle = "#6ff0ff";
        ctx.beginPath();
        ctx.moveTo(dx - 5, KART_H / 2 - 3);
        ctx.lineTo(dx, KART_H / 2 + flame);
        ctx.lineTo(dx + 5, KART_H / 2 - 3);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(dx - 2.5, KART_H / 2 - 3);
        ctx.lineTo(dx, KART_H / 2 + flame * 0.5);
        ctx.lineTo(dx + 2.5, KART_H / 2 - 3);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawWeather() {
    const k = THEMES[themeI].weather;
    if (!k) return;
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
  function drawHud() {
    if (state !== "play") return;
    // 커브 예고
    if (curveWarn !== 0 && !(holding && Math.sign(steerInput) === curveWarn)) {
      const pulse = 0.7 + Math.sin(time * 10) * 0.3;
      const y = 108;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = "rgba(255,95,122,0.95)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 92, y - 21, 184, 40, 20);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.font = '400 21px "Bagel Fat One", "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(curveWarn < 0 ? "◀ 왼쪽 누르기" : "오른쪽 누르기 ▶", W / 2, y);
      ctx.textBaseline = "alphabetic";
    }
    // 누르는 쪽 표시
    if (holding && Math.abs(steerInput) > 0.06) {
      const left = steerInput < 0;
      const g = ctx.createLinearGradient(left ? 0 : W, 0, left ? 110 : W - 110, 0);
      g.addColorStop(0, "rgba(255,216,74,0.34)");
      g.addColorStop(1, "rgba(255,216,74,0)");
      ctx.fillStyle = g;
      ctx.fillRect(left ? 0 : W - 110, 0, 110, H);
    }
    if (speedLines > 0.05) {
      ctx.strokeStyle = `rgba(255,255,255,${0.32 * speedLines})`;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (let i = 0; i < 10; i += 1) {
        const x = 12 + ((i * 41 + 13) % (W - 24));
        const y = (i * 90 + time * 620) % H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 18 + speedLines * 24);
        ctx.stroke();
      }
    }
    for (const f of floats) {
      const u = f.t / f.life;
      ctx.globalAlpha = u > 0.65 ? (1 - u) / 0.35 : 1;
      ctx.font = `400 ${f.big ? 30 : 26}px "Bagel Fat One", "Jua", sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(30,30,55,0.85)";
      ctx.strokeText(f.text, W / 2, H * 0.4 + f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, W / 2, H * 0.4 + f.y);
    }
    ctx.globalAlpha = 1;
  }
  function render() {
    if (!car) return;
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.save();
    applyCamera();
    drawGround(Math.hypot(W, H) + 40);
    drawTrack();
    drawSkids();
    drawSmoke();
    ctx.restore();
    drawUpright();
    drawCar();
    drawWeather();
    ctx.restore();
    drawHud();
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000 || 0.016, 0, 0.033);
    last = now;
    if (state !== "paused") update(dt);
    render();
  }

  /* ---------- 입력 연결 ---------- */
  canvas.addEventListener("pointerdown", (e) => {
    if (e.cancelable) e.preventDefault();
    if (state !== "play") return;
    Sound.unlock();
    setHold(true, e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!holding || state !== "play") return;
    updateSteerFromPointer(e.clientX);
  });
  const up = () => setHold(false);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("blur", up);
  window.addEventListener("keydown", (e) => {
    if (state !== "play" || e.repeat) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      Sound.unlock();
      holding = true;
      steerInput = -1;
      cornerBonusReady = true;
      exitBonusReady = true;
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      Sound.unlock();
      holding = true;
      steerInput = 1;
      cornerBonusReady = true;
      exitBonusReady = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(e.code)) {
      holding = false;
      steerInput = 0;
    }
  });
  $("start-btn").addEventListener("click", startGame);
  $("retry-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: "drift-chick", gameTitle: "드리프트 삐약이", formParent: overlays.over });
  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        Sound.loopSet(0, 0, false);
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
  resetRun();
  renderTitle();
  show("title");
  loadAssets().then(() => {
    last = performance.now();
    requestAnimationFrame(loop);
  });

  // 점검용
  window.DriftChick = {
    get s() {
      const near = car && path[car.idx] ? path[car.idx] : null;
      return { state, score, dist, hearts, combo, maxCombo, invT, curve: near ? near.curve : 0, ahead: curveWarn, section, themeI, lateral: car ? car.lat : 0, speed: car ? car.speed : 0, coins: coins.length, signs: signs.length, PX, H };
    },
    update,
    input(hold, steer) {
      if (hold && !holding) {
        cornerBonusReady = true;
        exitBonusReady = true;
      }
      holding = hold;
      steerInput = hold ? steer : 0;
    },
    setDist(v) {
      dist = v;
    },
    start: startGame,
    curveAt(k) {
      return path[Math.min(path.length - 1, car.idx + k)].curve;
    },
  };
})();
