(() => {
  "use strict";

  /* ---------- 판 크기 · 물리 ---------- */
  const W = 390;
  const H = 700;
  const TAU = Math.PI * 2;
  const R = 11; // 공 반지름
  const STEP = 1 / 240; // 물리는 화면 주사율과 상관없이 1/240초씩 (어느 기기에서나 같은 느낌으로 굴러감)
  const MAX_V = 1400; // 공 최고 속도 (px/초)
  const BEST_KEY = "today-pinball-best";
  const TOTAL_STAGES = 50;
  const START_BALLS = 3;
  const MID = 184; // 놀이판 가운데 (왼쪽 벽 24 · 발사길 안쪽 벽 344)
  const LANE_X = 362; // 발사길 가운데 (벽 344 · 380)
  const PLUNGER_Y = 646; // 발사대 윗면 (당기기 전)
  const PULL_MAX = 28;
  const WALL_R = 6; // 벽 두께의 절반 (그림과 부딪힘이 같게)
  const ARCH = { cx: 202, cy: 225, rx: 178, ry: 150 };
  // 날개: 길이 · 뿌리/끝 두께 · 쉬는 각도(아래) · 든 각도(위) · 올라가는/내려가는 빠르기(라디안/초)
  const FL = { len: 68, rb: 11, rt: 6, rest: 0.52, up: -0.5, wUp: 22, wDown: 13, e: 0.28 };
  const SHIELD_Y = 678; // 구름 보호막 높이
  const BOT = /[?&]bot=1\b/.test(location.search);

  /* ---------- 테마 10가지 (스테이지마다 돌아가며) ---------- */
  const THEMES = [
    { name: "사탕 마을", sky: ["#ffd3e6", "#ffeef6"], floor: "#fff7fb", dots: "#ffdbeb", wall: "#ff7eb3", wallDark: "#e0558f", wallHi: "#ffd6e8", apron: "#ffc4dd", accent: "#ff5c9a", flip: "#ff6fa8", animals: ["cat", "bunny", "bear"], colors: ["#ff9cc8", "#ffc46b", "#8fd0ff"], deco: "heart" },
    { name: "구름 놀이터", sky: ["#bfe0ff", "#eaf5ff"], floor: "#f7fbff", dots: "#d9ebff", wall: "#6fb2ff", wallDark: "#4a8fe0", wallHi: "#d6eaff", apron: "#b8d9ff", accent: "#3f8fea", flip: "#5aa6ff", animals: ["bunny", "chick", "bear"], colors: ["#9fd0ff", "#ffd56b", "#ffa3c8"], deco: "cloud" },
    { name: "바닷속 친구들", sky: ["#aeeee9", "#e2fbf8"], floor: "#f1fffd", dots: "#c9f2ed", wall: "#38c3b8", wallDark: "#1f9f95", wallHi: "#c2f4ef", apron: "#97e3db", accent: "#16a99e", flip: "#2fbcb1", animals: ["frog", "cat", "chick"], colors: ["#7fe0d6", "#ffb37a", "#a7b8ff"], deco: "bubble" },
    { name: "숲속 소풍", sky: ["#d3f2bd", "#f1fbe7"], floor: "#fbfff4", dots: "#dff4cc", wall: "#79c757", wallDark: "#57a238", wallHi: "#d7f2c6", apron: "#bae4a4", accent: "#4ea12e", flip: "#6dbd4c", animals: ["bear", "frog", "chick"], colors: ["#d4ab84", "#9ee07a", "#ffd166"], deco: "flower" },
    { name: "별빛 밤하늘", sky: ["#4d51a8", "#8579d4"], floor: "#f4f1ff", dots: "#e2dbff", wall: "#7d6cf2", wallDark: "#5946d6", wallHi: "#d9d2ff", apron: "#b6aaf7", accent: "#5a48d8", flip: "#7a68f0", animals: ["cat", "bunny", "pig"], colors: ["#b8a8ff", "#ffe07a", "#ff9cc8"], deco: "star" },
    { name: "딸기 케이크", sky: ["#ffcdd4", "#fff1e8"], floor: "#fffaf3", dots: "#ffe2e6", wall: "#ff6b84", wallDark: "#e04862", wallHi: "#ffd3da", apron: "#ffb4c0", accent: "#e8475f", flip: "#ff6f86", animals: ["pig", "bunny", "cat"], colors: ["#ff8fa3", "#fff0c2", "#ffb8d0"], deco: "heart" },
    { name: "눈사람 나라", sky: ["#d4ecff", "#ffffff"], floor: "#fbfdff", dots: "#e3f0ff", wall: "#86b4ff", wallDark: "#5f8fe0", wallHi: "#dde9ff", apron: "#c1d8ff", accent: "#4f7fd6", flip: "#7aa8ff", animals: ["bear", "bunny", "chick"], colors: ["#ffffff", "#ffd1e3", "#bfe3ff"], deco: "snow" },
    { name: "꿀벌 정원", sky: ["#ffee9e", "#fffbe5"], floor: "#fffdf1", dots: "#fff0b3", wall: "#ffbb33", wallDark: "#e09500", wallHi: "#ffe9ad", apron: "#ffdb80", accent: "#e09000", flip: "#ffb31f", animals: ["chick", "frog", "bear"], colors: ["#ffd84d", "#ff9cc8", "#a6e07a"], deco: "flower" },
    { name: "무지개 다리", sky: ["#ffd8ef", "#d8f0ff"], floor: "#fffcfe", dots: "#f2e4ff", wall: "#bf78ff", wallDark: "#9a4fe0", wallHi: "#eed6ff", apron: "#dcb6ff", accent: "#9b4be0", flip: "#b06cff", animals: ["bunny", "cat", "pig"], colors: ["#ff9cc8", "#7fd8ff", "#ffd56b"], deco: "star" },
    { name: "우주 놀이공원", sky: ["#363a8a", "#6a5cc6"], floor: "#f3f4ff", dots: "#e0e3ff", wall: "#ff78c6", wallDark: "#dc4ba0", wallHi: "#ffd3ee", apron: "#ffb4de", accent: "#e0459e", flip: "#ff6fbd", animals: ["frog", "cat", "bunny"], colors: ["#8fe3ff", "#ffb0e0", "#c4f07a"], deco: "planet" },
  ];

  // 범퍼 친구들 자리 5가지 (사이로 공이 지나갈 틈을 남김)
  const LAYOUTS = [
    [[144, 278], [224, 278], [184, 352]],
    [[130, 288], [238, 288], [184, 358]],
    [[184, 268], [134, 344], [234, 344]],
    [[146, 274], [222, 274], [184, 348]],
    [[120, 308], [184, 266], [248, 308]],
  ];
  // 10스테이지부터 한 친구가 살랑살랑 움직임
  const MOVERS = [
    { i: 2, ax: "x", amp: 34 },
    { i: 2, ax: "x", amp: 30 },
    { i: 0, ax: "x", amp: 34 },
    { i: 2, ax: "x", amp: 34 },
    { i: 1, ax: "y", amp: 15 },
  ];

  function goalFor(i) {
    return Math.round((3000 + i * 450 + i * i * 6) / 100) * 100;
  }

  function stageInfo(i) {
    const theme = THEMES[i % THEMES.length];
    const round = Math.floor(i / THEMES.length);
    const lay = i % LAYOUTS.length;
    return {
      theme,
      name: round ? `${theme.name} ${round + 1}` : theme.name,
      goal: goalFor(i),
      gravity: 600 + i * 6,
      kick: 1 + i * 0.005,
      layout: LAYOUTS[lay],
      mover: i >= 9 ? MOVERS[lay] : null,
      moveSpeed: 0.8 + Math.min(1, i / 45) * 0.9,
      saver: i < 10 ? 15 : i < 25 ? 10 : 8,
      // 날개 길이: 1~5스테이지는 날개 끝 사이로 공이 못 빠짐(가만히 있으면 날개 끝에 걸쳐 쉼) · 갈수록 짧아짐
      flipLen: i < 5 ? 72 : i < 15 ? 70 : i < 30 ? 68 : 66,
    };
  }

  /* ---------- 화면 ---------- */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const staticCanvas = document.createElement("canvas");
  let pxScale = 1;
  const isTouch = window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };
  const el = {
    stage: document.getElementById("hud-stage"),
    score: document.getElementById("hud-score"),
    goal: document.getElementById("hud-goal"),
    lives: document.getElementById("hud-lives"),
    goalFill: document.getElementById("goal-fill"),
    fever: document.getElementById("hud-fever"),
    titleBest: document.getElementById("title-best"),
    clearDetail: document.getElementById("clear-detail"),
    overDetail: document.getElementById("over-detail"),
    allDetail: document.getElementById("all-detail"),
  };

  /* ---------- 상태 ---------- */
  let state = "title";
  let stageIndex = 0;
  let stage = stageInfo(0);
  let score = 0;
  let stageScore = 0;
  let ballsLeft = START_BALLS;
  let best = readBest();
  let T = 0; // 판 시간 (놀 때만 흐름)
  let visT = 0; // 그림 움직임 시간
  let acc = 0;
  let lastT = 0;
  let ball = null;
  let respawnT = 0;
  let overT = 0;
  let clearT = 0;
  let clearBonus = 0;
  let combo = 0;
  let comboT = 0;
  let multShown = 1;
  let feverT = 0;
  let shield = { t: 0, pop: 0 };
  let halfGift = false;
  let holeCool = 0;
  let lanesResetT = 0;
  let dropsResetT = 0;
  let pull = 0;
  let charging = false;
  let plungerVis = 0;
  let plungerVel = 0;
  let particles = [];
  let floats = [];
  let banner = null;
  let shake = 0;
  let trail = [];
  const usedFlip = [false, false];

  let segs = [];
  let bumpers = [];
  let posts = [];
  let slings = [];
  let drops = [];
  let lanes = [];
  let hole = { x: 300, y: 206, glow: 0 };
  const flippers = [
    { side: 1, px: 106, py: 606, a: FL.rest, pa: FL.rest, w: 0, pressed: false },
    { side: -1, px: 2 * MID - 106, py: 606, a: FL.rest, pa: FL.rest, w: 0, pressed: false },
  ];

  const keys = { left: false, right: false, both: false, plunger: false };
  const pointers = new Map();
  let plungerHeld = false;
  const bot = BOT ? { on: false, mode: "good", l: 0, r: 0, charge: 0, speed: 1 } : null;
  const stats = { escapes: 0, nudges: 0, drains: 0, saves: 0, holes: 0, launches: 0, bumps: 0, slings: 0, posts: 0, drops: 0, stars: 0, maxCombo: 0 };

  function readBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (_) {}
  }

  const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- 소리 (짧은 효과음은 직접 만들어 냄 · 공용 소리 끄기 버튼을 따름) ---------- */
  const SFX = (() => {
    let ac = null;
    const lastAt = {};
    function audio() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          ac = new AC();
        } catch (_) {
          return null;
        }
      }
      if (ac.state === "suspended") ac.resume().catch(() => {});
      return ac;
    }
    function tone(f, d, type, v, f2, at) {
      const a = audio();
      if (!a) return;
      const t = a.currentTime + (at || 0);
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(a.destination);
      o.start(t);
      o.stop(t + d + 0.03);
    }
    function noise(d, v, freq) {
      const a = audio();
      if (!a) return;
      const n = Math.max(1, Math.floor(a.sampleRate * d));
      const buf = a.createBuffer(1, n, a.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = a.createBufferSource();
      src.buffer = buf;
      const f = a.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq || 1800;
      const g = a.createGain();
      g.gain.value = v;
      src.connect(f);
      f.connect(g);
      g.connect(a.destination);
      src.start();
    }
    function play(name, k) {
      const now = performance.now();
      const gap = name === "tok" ? 70 : name === "bumper" ? 30 : 25;
      if (lastAt[name] && now - lastAt[name] < gap) return;
      lastAt[name] = now;
      switch (name) {
        case "bumper": {
          const up = 1 + Math.min(12, combo) * 0.045;
          const base = [392, 494, 587][k % 3] * up;
          tone(base, 0.13, "sine", 0.2, base * 1.6);
          tone(base * 2, 0.06, "triangle", 0.06);
          break;
        }
        case "sling":
          tone(720, 0.08, "triangle", 0.12, 420);
          break;
        case "flip":
          noise(0.035, 0.12, 2400);
          tone(190, 0.05, "sine", 0.08, 120);
          break;
        case "tok":
          tone(240 + Math.min(200, (k || 0) / 6), 0.04, "sine", 0.05);
          break;
        case "post":
          tone(880, 0.07, "triangle", 0.1, 1100);
          break;
        case "star":
          tone(988, 0.09, "sine", 0.12);
          tone(1319, 0.12, "sine", 0.1, 0, 0.07);
          break;
        case "stars3":
        case "fever":
          [660, 880, 1046, 1319].forEach((f, i) => tone(name === "fever" ? f * 0.89 : f, 0.14, "triangle", 0.11, 0, i * 0.07));
          break;
        case "drop":
          tone(330, 0.1, "square", 0.06, 160);
          noise(0.05, 0.06, 900);
          break;
        case "hole":
          tone(220, 0.32, "sine", 0.14, 640);
          break;
        case "pop":
          tone(520, 0.08, "triangle", 0.1, 300);
          break;
        case "launch":
          noise(0.22, 0.09, 700);
          tone(240, 0.24, "sine", 0.1, 820);
          break;
        case "boing":
          tone(300, 0.28, "sine", 0.16, 900);
          tone(600, 0.18, "triangle", 0.05, 1500);
          break;
        case "drain":
          tone(620, 0.42, "sine", 0.12, 210);
          break;
        case "clear":
          [523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, 0.2, "triangle", 0.12, 0, i * 0.09));
          break;
        case "combo":
          tone(1046, 0.08, "square", 0.05, 1568);
          break;
        default:
          break;
      }
    }
    return { play, unlock: audio };
  })();

  /* ---------- 판 만들기 ---------- */
  function archPoints(n) {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const t = Math.PI + (k / n) * Math.PI;
      pts.push([ARCH.cx + Math.cos(t) * ARCH.rx, ARCH.cy + Math.sin(t) * ARCH.ry]);
    }
    return pts;
  }
  const ARCH_PTS = archPoints(36);
  const BOUNDARY = [[24, 530], ...ARCH_PTS, [380, 704]];

  function addSeg(ax, ay, bx, by, r = WALL_R, e = 0.42, kind = "wall", ref = null) {
    const pad = r + R;
    segs.push({
      ax,
      ay,
      bx,
      by,
      r,
      e,
      kind,
      ref,
      len2: (bx - ax) ** 2 + (by - ay) ** 2 || 1,
      x0: Math.min(ax, bx) - pad,
      x1: Math.max(ax, bx) + pad,
      y0: Math.min(ay, by) - pad,
      y1: Math.max(ay, by) + pad,
    });
  }

  function buildTable() {
    segs = [];
    bumpers = [];
    posts = [];
    slings = [];
    drops = [];
    lanes = [];
    // 바깥 벽: 왼쪽 → 둥근 지붕 → 오른쪽
    for (let k = 0; k < BOUNDARY.length - 1; k++) addSeg(BOUNDARY[k][0], BOUNDARY[k][1], BOUNDARY[k + 1][0], BOUNDARY[k + 1][1], WALL_R, 0.4);
    addSeg(344, 268, 344, 704); // 발사길 안쪽 벽
    addSeg(24, 530, 100, 601); // 아래 미끄럼틀 (날개로 이어짐)
    addSeg(344, 530, 268, 601);
    addSeg(100, 601, 100, 760); // 미끄럼틀 아래 막힌 곳 (날개 밑으로 공이 새지 않게 · 그림 없음)
    addSeg(268, 601, 268, 760);
    for (const x of [124, 164, 204, 244]) addSeg(x, 126, x, 164, 4, 0.5, "divider");
    addSeg(344, 268, 380, 245, 3, 0.35, "gate"); // 발사길 문: 나간 공은 다시 못 들어옴
    // 젤리 새총 (왼쪽 · 오른쪽)
    for (const side of [1, -1]) {
      const X = (x) => (side > 0 ? x : 2 * MID - x);
      const A = [X(62), 452];
      const B = [X(62), 514];
      const C = [X(100), 546];
      const s = { side, pts: [A, B, C], wob: 0, cool: 0 };
      slings.push(s);
      addSeg(A[0], A[1], B[0], B[1], 5, 0.4);
      addSeg(B[0], B[1], C[0], C[1], 5, 0.4);
      addSeg(A[0], A[1], C[0], C[1], 5, 0.5, "sling", s);
    }
    // 막대사탕 기둥
    // 막대사탕 기둥: 새총 위쪽 바깥 (날개로 쏜 공 길을 막지 않게)
    posts.push({ x: 64, y: 410, r: 10, lit: 0, cool: 0 }, { x: 2 * MID - 64, y: 410, r: 10, lit: 0, cool: 0 });
    // 선물상자 (왼쪽 벽)
    [300, 338, 376].forEach((y, k) => {
      const d = { y, k, down: false, pop: 0 };
      drops.push(d);
      addSeg(24, y - 12, 24, y + 12, 7, 0.45, "drop", d);
    });
    // 별 길 3개
    [144, 184, 224].forEach((x) => lanes.push({ x, y: 146, on: false, inside: false, glow: 0 }));
    hole = { x: 300, y: 206, glow: 0 };
    // 범퍼 친구들
    stage.layout.forEach(([x, y], k) => {
      bumpers.push({ bx: x, by: y, x, y, vx: 0, vy: 0, r: 24, lit: 0, pop: 0, cool: 0, k, kind: stage.theme.animals[k], color: stage.theme.colors[k] });
    });
  }

  /* ---------- 공 ---------- */
  function newBall() {
    // 공 겉의 사탕 점 6개 (판 위를 실제로 구르는 것처럼 3D로 돌림)
    const spots = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    const b = { x: LANE_X, y: PLUNGER_Y - R - 0.5, px: LANE_X, py: PLUNGER_Y - R - 0.5, vx: 0, vy: 0, inLane: true, hold: null, squash: 0, sqAng: 0, still: 0, spots };
    // 처음 모양을 조금 비틀어 둠
    rollBy(b, 0.7, 0.6, 0.8);
    rollBy(b, -0.4, 0.9, 0.5);
    return b;
  }

  function rollBy(b, kx, ky, ang) {
    const l = Math.hypot(kx, ky) || 1;
    kx /= l;
    ky /= l;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    for (const p of b.spots) {
      const dot = kx * p[0] + ky * p[1];
      const cx = ky * p[2];
      const cy = -kx * p[2];
      const cz = kx * p[1] - ky * p[0];
      const x = p[0] * c + cx * s + kx * dot * (1 - c);
      const y = p[1] * c + cy * s + ky * dot * (1 - c);
      const z = p[2] * c + cz * s;
      const n = Math.hypot(x, y, z) || 1;
      p[0] = x / n;
      p[1] = y / n;
      p[2] = z / n;
    }
  }

  function spawnBall() {
    ball = newBall();
    trail = [];
    charging = false;
    pull = 0;
    combo = 0;
    multShown = 1;
  }

  /* ---------- 부딪힘 ---------- */
  let hitNx = 0;
  let hitNy = 0;

  // 공을 밖으로 밀고, 튕김(e) 적용. 다가오던 빠르기를 돌려줌 (0 이상)
  function contact(b, nx, ny, pen, svx, svy, e) {
    b.x += nx * pen;
    b.y += ny * pen;
    hitNx = nx;
    hitNy = ny;
    const rvx = b.vx - svx;
    const rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    const ee = vn > -45 ? 0 : e; // 살짝 닿은 공은 통통 떨지 않고 미끄러짐
    b.vx -= (1 + ee) * vn * nx;
    b.vy -= (1 + ee) * vn * ny;
    if (vn < -260) {
      b.squash = Math.min(0.2, -vn / 3200);
      b.sqAng = Math.atan2(ny, nx);
    }
    return -vn;
  }

  function hitSeg(b, s) {
    const abx = s.bx - s.ax;
    const aby = s.by - s.ay;
    let t = ((b.x - s.ax) * abx + (b.y - s.ay) * aby) / s.len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const dx = b.x - (s.ax + abx * t);
    const dy = b.y - (s.ay + aby * t);
    const rr = R + s.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 < 1e-9) return -1;
    const d = Math.sqrt(d2);
    return contact(b, dx / d, dy / d, rr - d, 0, 0, s.e);
  }

  function hitCircle(b, cx, cy, cr, svx, svy, e) {
    const dx = b.x - cx;
    const dy = b.y - cy;
    const rr = R + cr;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 < 1e-9) return -1;
    const d = Math.sqrt(d2);
    return contact(b, dx / d, dy / d, rr - d, svx, svy, e);
  }

  function flipperAngle(f, a) {
    return f.side > 0 ? a : Math.PI - a;
  }

  function hitFlipper(b, f) {
    const ang = flipperAngle(f, f.a);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    let t = (b.x - f.px) * ux + (b.y - f.py) * uy;
    if (t < 0) t = 0;
    else if (t > FL.len) t = FL.len;
    const cx = f.px + ux * t;
    const cy = f.py + uy * t;
    const rad = FL.rb + (FL.rt - FL.rb) * (t / FL.len);
    const dx = b.x - cx;
    const dy = b.y - cy;
    const rr = R + rad;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 < 1e-9) return;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    // 날개 겉면이 움직이는 빠르기 (돌아가는 막대: ω × r)
    const qx = cx + nx * rad - f.px;
    const qy = cy + ny * rad - f.py;
    const ww = f.side > 0 ? f.w : -f.w;
    contact(b, nx, ny, rr - d, -ww * qy, ww * qx, FL.e);
  }

  function plungerTop() {
    return PLUNGER_Y + Math.max(0, plungerVis) * PULL_MAX;
  }

  function plungerReady() {
    return !!ball && ball.inLane && !ball.hold && ball.y + R >= plungerTop() - 4 && Math.abs(ball.vy) < 140;
  }

  function collide(b) {
    for (const s of segs) {
      if (b.x < s.x0 || b.x > s.x1 || b.y < s.y0 || b.y > s.y1) continue;
      if (s.kind === "gate" && b.inLane) continue;
      if (s.kind === "drop" && s.ref.down) continue;
      const imp = hitSeg(b, s);
      if (imp < 0) continue;
      if (s.kind === "sling") slingHit(b, s.ref, imp);
      else if (s.kind === "drop") {
        if (imp > 120) dropHit(s.ref);
      } else if (imp > 330) SFX.play("tok", imp);
    }
    for (const p of posts) {
      const imp = hitCircle(b, p.x, p.y, p.r, 0, 0, 0.72);
      if (imp > 60) postHit(p);
    }
    for (const bp of bumpers) {
      if (hitCircle(b, bp.x, bp.y, bp.r, bp.vx, bp.vy, 0.6) >= 0) bumperHit(b, bp);
    }
    for (const f of flippers) hitFlipper(b, f);
    // 발사대 윗면
    if (b.x > 344) {
      const top = plungerTop();
      if (b.y + R > top) {
        b.y = top - R;
        if (b.vy > 0) b.vy = b.vy > 90 ? -b.vy * 0.25 : 0;
        b.vx *= 0.9;
      }
    }
  }

  /* ---------- 맞혔을 때 ---------- */
  function comboMult() {
    return combo >= 16 ? 3 : combo >= 8 ? 2 : 1;
  }

  function bumpCombo() {
    combo += 1;
    if (combo > stats.maxCombo) stats.maxCombo = combo;
    comboT = 1.3;
    const m = comboMult();
    if (m > multShown && ball) {
      addFloat(MID, 420, `콤보 ×${m}!`, { size: 26, color: "#fff", stroke: stage.theme.accent, life: 1.1 });
      SFX.play("combo");
    }
    multShown = m;
  }

  function addScore(base, x, y) {
    const mult = comboMult() * (feverT > 0 ? 2 : 1);
    const gain = base * mult;
    score += gain;
    stageScore += gain;
    if (score > best) {
      best = score;
      saveBest();
    }
    addFloat(x, y, `+${gain}`, { size: gain >= 400 ? 20 : 16, color: "#fff", stroke: feverT > 0 ? "#f0a000" : stage.theme.wallDark });
    // 목표의 절반을 넘으면 구름 보호막 선물
    if (!halfGift && stageScore >= stage.goal / 2 && stageScore < stage.goal && ball) {
      halfGift = true;
      shield = { t: Math.max(shield.t, 15), pop: 1 };
      addFloat(MID, 450, "절반 왔어요! 구름 선물!", { size: 22, color: "#fff", stroke: "#4a8fe0", life: 1.6 });
      SFX.play("stars3");
    }
    updateHud();
    if (state === "playing" && stageScore >= stage.goal) startClear();
  }

  function bumperHit(b, bp) {
    const nx = hitNx;
    const ny = hitNy;
    const K = 430 * stage.kick;
    const vn = (b.vx - bp.vx) * nx + (b.vy - bp.vy) * ny;
    if (vn < K) {
      b.vx += nx * (K - vn);
      b.vy += ny * (K - vn);
    }
    b.vx += rand(-20, 20);
    if (bp.cool > 0) return;
    bp.cool = 0.1;
    stats.bumps += 1;
    bp.lit = 0.45;
    bp.pop = 1;
    bumpCombo();
    addScore(100, bp.x, bp.y - bp.r - 8);
    SFX.play("bumper", bp.k);
    burst(b.x - nx * R, b.y - ny * R, 7, [bp.color, "#fff", stage.theme.accent], "heart");
    shake = Math.max(shake, 1.6);
  }

  function slingHit(b, s, imp) {
    // 세게 부딪힌 공만 튕김 (살살 굴러온 공 · 양쪽 새총 사이 끝없는 핑퐁 방지) · 조금 위쪽으로
    if (s.cool > 0 || imp < 150) return;
    let dx = hitNx;
    let dy = hitNy - 0.55;
    const l = Math.hypot(dx, dy);
    dx /= l;
    dy /= l;
    const K = 400 * stage.kick;
    const vd = b.vx * dx + b.vy * dy;
    if (vd < K) {
      b.vx += dx * (K - vd);
      b.vy += dy * (K - vd);
    }
    s.cool = 0.12;
    stats.slings += 1;
    s.wob = 1;
    addScore(10, b.x, b.y - 18);
    SFX.play("sling");
    burst(b.x - hitNx * R, b.y - hitNy * R, 4, ["#fff", stage.theme.wallHi], "dot");
  }

  function postHit(p) {
    p.lit = 0.35;
    if (p.cool > 0) return;
    p.cool = 0.15;
    stats.posts += 1;
    addScore(50, p.x, p.y - 20);
    SFX.play("post");
  }

  function dropHit(d) {
    stats.drops += 1;
    d.down = true;
    d.pop = 1;
    addScore(200, 60, d.y - 10);
    SFX.play("drop");
    burst(34, d.y, 10, [stage.theme.colors[d.k], "#fff", "#ffd23f"], "star");
    if (drops.every((q) => q.down)) {
      feverT = 10;
      dropsResetT = 2.2;
      addScore(1000, MID, 380);
      addFloat(MID, 430, "선물 팡! 점수 2배!", { size: 24, color: "#fff", stroke: "#f0a000", life: 1.6 });
      SFX.play("fever");
      updateHud();
    }
  }

  function allStars() {
    lanesResetT = 1.4;
    addScore(1000, MID, 196);
    shield = { t: 20, pop: 1 };
    addFloat(MID, 430, "별 3개! 구름 보호막!", { size: 24, color: "#fff", stroke: "#4a8fe0", life: 1.6 });
    SFX.play("stars3");
    for (const l of lanes) burst(l.x, l.y, 8, ["#ffd23f", "#fff", "#ffe98a"], "star");
  }

  function sensors(b) {
    for (const l of lanes) {
      const inside = (b.x - l.x) ** 2 + (b.y - l.y) ** 2 < 15 * 15;
      if (inside && !l.inside && !l.on && lanesResetT <= 0) {
        l.on = true;
        stats.stars += 1;
        l.glow = 1;
        addScore(200, l.x, l.y - 22);
        SFX.play("star");
        if (lanes.every((q) => q.on)) allStars();
      }
      l.inside = inside;
    }
    if (holeCool <= 0 && (b.x - hole.x) ** 2 + (b.y - hole.y) ** 2 < 12 * 12) {
      b.hold = { t: 0, dur: 0.9, x0: b.x, y0: b.y, x1: hole.x, y1: hole.y, mode: "hole" };
      b.vx = 0;
      b.vy = 0;
      hole.glow = 1;
      stats.holes += 1;
      bumpCombo();
      addScore(500, hole.x, hole.y - 26);
      addFloat(hole.x - 10, hole.y + 32, "냠냠!", { size: 20, color: "#fff", stroke: "#d98a00", life: 1 });
      SFX.play("hole");
      burst(hole.x, hole.y, 10, ["#ffcf5a", "#fff", "#ff9cc8"], "star");
      return;
    }
    // 구름 보호막: 아래로 빠지는 공을 받아서 가운데로 다시 쏴 줌
    if (shield.t > 0 && b.vy > 0 && b.y + R >= SHIELD_Y && b.y < SHIELD_Y + 24 && Math.abs(b.x - MID) < 84) {
      b.hold = { t: 0, dur: 0.45, x0: b.x, y0: b.y, x1: MID, y1: SHIELD_Y - R - 35, mode: "cloud" };
      b.vx = 0;
      b.vy = 0;
      shield = { t: 0, pop: 1 };
      stats.saves += 1;
      addFloat(MID, SHIELD_Y - 50, "구름이 받아 줬어요!", { size: 18, color: "#fff", stroke: "#4a8fe0", life: 1.3 });
      SFX.play("boing");
    }
  }

  function holdStep(b, dt) {
    const h = b.hold;
    h.t += dt;
    const k = Math.min(1, h.t / (h.mode === "hole" ? 0.16 : 0.3));
    const e = 1 - (1 - k) ** 3;
    b.x = h.x0 + (h.x1 - h.x0) * e;
    b.y = h.y0 + (h.y1 - h.y0) * e;
    if (h.t < h.dur) return;
    b.hold = null;
    const gs = Math.sqrt(stage.gravity / 760);
    if (h.mode === "hole") {
      b.vx = -rand(200, 290);
      b.vy = rand(150, 220);
      holeCool = 0.8;
      SFX.play("pop");
    } else {
      b.vx = (Math.random() < 0.5 ? -1 : 1) * rand(220, 300) * gs;
      b.vy = -980 * gs;
      SFX.play("launch");
    }
  }

  /* ---------- 한 걸음 (1/240초) ---------- */
  function timers(dt) {
    if (comboT > 0) {
      comboT -= dt;
      if (comboT <= 0) {
        combo = 0;
        multShown = 1;
      }
    }
    if (feverT > 0) {
      feverT -= dt;
      if (feverT <= 0) {
        feverT = 0;
        updateHud();
      }
    }
    if (shield.t > 0) shield.t -= dt;
    if (holeCool > 0) holeCool -= dt;
    for (const bp of bumpers) if (bp.cool > 0) bp.cool -= dt;
    for (const s of slings) if (s.cool > 0) s.cool -= dt;
    for (const p of posts) if (p.cool > 0) p.cool -= dt;
    if (lanesResetT > 0) {
      lanesResetT -= dt;
      if (lanesResetT <= 0) for (const l of lanes) l.on = false;
    }
    if (dropsResetT > 0) {
      dropsResetT -= dt;
      if (dropsResetT <= 0) {
        // 공이 상자 자리에 있으면 조금 뒤에 다시 세움
        if (ball && ball.x < 24 + 7 + R + 2 && ball.y > 280 && ball.y < 396) dropsResetT = 0.3;
        else
          for (const d of drops) {
            d.down = false;
            d.pop = 1;
          }
      }
    }
  }

  function updateFlippers(dt) {
    for (const f of flippers) {
      f.pa = f.a;
      const want = f.pressed ? FL.up : FL.rest;
      const sp = f.pressed ? FL.wUp : FL.wDown;
      if (f.a > want) f.a = Math.max(want, f.a - sp * dt);
      else if (f.a < want) f.a = Math.min(want, f.a + sp * dt);
      f.w = (f.a - f.pa) / dt;
    }
  }

  function updateMovers() {
    for (const bp of bumpers) {
      bp.vx = 0;
      bp.vy = 0;
    }
    const m = stage.mover;
    if (!m) return;
    const bp = bumpers[m.i];
    const ph = T * stage.moveSpeed;
    const off = Math.sin(ph) * m.amp;
    const v = Math.cos(ph) * m.amp * stage.moveSpeed;
    if (m.ax === "x") {
      bp.x = bp.bx + off;
      bp.vx = v;
    } else {
      bp.y = bp.by + off;
      bp.vy = v;
    }
  }

  function step(dt) {
    T += dt;
    timers(dt);
    updateFlippers(dt);
    updateMovers();
    if (charging) pull = Math.min(1, pull + dt / 0.85);
    if (bot && bot.on) botThink(dt);
    if (bot && bot.trace && ball && Math.floor(T * 60) !== Math.floor((T - dt) * 60)) bot.trace.push([ball.x, ball.y]);
    if (!ball) {
      if (respawnT > 0) {
        respawnT -= dt;
        if (respawnT <= 0) spawnBall();
      }
      if (overT > 0) {
        overT -= dt;
        if (overT <= 0) gameOver();
      }
      return;
    }
    const b = ball;
    b.px = b.x;
    b.py = b.y;
    if (b.hold) {
      holdStep(b, dt);
      return;
    }
    b.vy += stage.gravity * dt;
    const damp = 1 - 0.035 * dt;
    b.vx *= damp;
    b.vy *= damp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    collide(b);
    const sp = Math.hypot(b.vx, b.vy);
    const cap = MAX_V * Math.sqrt(stage.gravity / 760);
    if (sp > cap) {
      b.vx *= cap / sp;
      b.vy *= cap / sp;
    }
    // 판 위를 구르는 공: 굴러간 거리만큼 겉면이 돌아감
    if (sp > 1) rollBy(b, b.vy, -b.vx, (Math.min(sp, cap) * dt) / R);
    if (b.inLane && (b.y < 240 || b.x < 340)) b.inLane = false;
    sensors(b);
    if (b.hold) return;
    if (b.y > H + 24) {
      drain();
      return;
    }
    if (b.x < 8 || b.x > 388 || b.y < 60) {
      // 혹시 판 밖으로 나가면 벌점 없이 발사대로
      stats.escapes += 1;
      if (bot && bot.trace) bot.escapeAt = { x: b.x, y: b.y, vx: b.vx, vy: b.vy, tail: bot.trace.slice(-30) };
      spawnBall();
      return;
    }
    // 멈춰 버린 공은 톡 건드려 줌
    if (!b.inLane && sp < 22) {
      b.still += dt;
      const resting = b.y > 590 && Math.abs(b.x - MID) < 40;
      if (resting && b.still > 1.2 && !b.told) {
        b.told = true;
        addFloat(MID, 560, isTouch ? "화면을 눌러서 탁!" : "Z · X 로 탁!", { size: 18, color: "#fff", stroke: stage.theme.accent, life: 1.6 });
      }
      if (b.still > (resting ? 3.2 : 2.2)) {
        const cradling = b.y > 520 && (flippers[0].pressed || flippers[1].pressed);
        if (!cradling) {
          stats.nudges += 1;
          b.vx += (b.x < MID ? 1 : -1) * 140;
          b.vy -= 460;
          addFloat(b.x, b.y - 24, "톡!", { size: 16, color: "#fff", stroke: stage.theme.wallDark });
        }
        b.still = 0;
      }
    } else b.still = 0;
  }

  /* ---------- 발사 ---------- */
  function doLaunch() {
    const power = 0.25 + 0.75 * pull;
    const ready = plungerReady();
    charging = false;
    plungerVel = -8 - 10 * pull;
    pull = 0;
    if (!ready) return;
    const gs = Math.sqrt(stage.gravity / 760);
    ball.vy = -(940 + 440 * power) * gs;
    ball.vx = 0;
    stats.launches += 1;
    SFX.play("launch");
    if (shield.t <= 0) shield = { t: stage.saver, pop: 1 };
  }

  /* ---------- 흐름 ---------- */
  function drain() {
    const x = ball.x;
    stats.drains += 1;
    if (bot && bot.trace) (bot.drainTails = bot.drainTails || []).push(bot.trace.slice(-50));
    ball = null;
    charging = false;
    pull = 0;
    combo = 0;
    multShown = 1;
    shield.t = 0;
    ballsLeft -= 1;
    updateHud();
    SFX.play("drain");
    burst(Math.max(110, Math.min(260, x)), H - 16, 12, ["#fff", stage.theme.wallHi, stage.theme.accent], "dot");
    shake = 5;
    if (ballsLeft <= 0) {
      overT = 1.1;
      banner = { t: 0, dur: 1.2, title: "앗!", sub: "공이 다 떨어졌어요" };
    } else {
      respawnT = 1.1;
      banner = { t: 0, dur: 1.4, title: "괜찮아요!", sub: `남은 공 ${ballsLeft}개` };
    }
  }

  function setupStage() {
    stage = stageInfo(stageIndex);
    FL.len = stage.flipLen;
    buildTable();
    buildStatic();
    T = 0;
    stageScore = 0;
    combo = 0;
    comboT = 0;
    multShown = 1;
    feverT = 0;
    shield = { t: 0, pop: 0 };
    halfGift = false;
    holeCool = 0;
    lanesResetT = 0;
    dropsResetT = 0;
    respawnT = 0;
    overT = 0;
    particles = [];
    floats = [];
    for (const f of flippers) {
      f.a = f.pa = FL.rest;
      f.w = 0;
    }
    spawnBall();
    banner = { t: 0, dur: 2.1, title: `스테이지 ${stageIndex + 1}`, sub: stage.name };
    acc = 0;
    updateHud();
  }

  function startGame(fromScratch) {
    SFX.unlock();
    if (fromScratch) {
      stageIndex = 0;
      score = 0;
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    ballsLeft = START_BALLS;
    setupStage();
    state = "playing";
    showOverlay(null);
  }

  function nextStage() {
    SFX.unlock();
    stageIndex = Math.min(TOTAL_STAGES - 1, stageIndex + 1);
    ballsLeft = Math.min(START_BALLS, ballsLeft + 1);
    setupStage();
    state = "playing";
    showOverlay(null);
  }

  function startClear() {
    state = "clearing";
    clearT = 1.5;
    clearBonus = ballsLeft * 300;
    score += clearBonus;
    if (score > best) {
      best = score;
      saveBest();
    }
    charging = false;
    pull = 0;
    updateHud();
    SFX.play("clear");
    banner = { t: 0, dur: 1.5, title: "클리어!", sub: `남은 공 보너스 +${fmt(clearBonus)}` };
    for (let k = 0; k < 46; k++) {
      particles.push({ x: rand(30, 340), y: rand(-20, 60), vx: rand(-40, 40), vy: rand(60, 200), life: rand(1.2, 2), max: 2, kind: k % 3 ? "star" : "heart", color: [stage.theme.accent, "#ffd23f", "#8fd0ff", "#ff9cc8", "#a6e07a"][k % 5], size: rand(4, 7), rot: rand(0, TAU), vr: rand(-4, 4), g: 120 });
    }
  }

  function showClear() {
    if (stageIndex >= TOTAL_STAGES - 1) {
      state = "allclear";
      el.allDetail.textContent = `50스테이지를 모두 깼어요! 최종 ${fmt(score)}점 · 최고 ${fmt(best)}점`;
      showOverlay("all");
      if (window.TodayGameRank) {
        TodayGameRank.mount({ gameId: "pinball", gameTitle: "핀볼팡팡", formParent: overlays.all });
        TodayGameRank.open(score);
      }
      return;
    }
    state = "clear";
    el.clearDetail.textContent = `${stage.name} 클리어! 남은 공 보너스 +${fmt(clearBonus)} · 지금 ${fmt(score)}점`;
    showOverlay("clear");
  }

  function gameOver() {
    state = "over";
    el.overDetail.textContent = `스테이지 ${stageIndex + 1}까지 · ${fmt(score)}점 · 최고 ${fmt(best)}점`;
    showOverlay("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "pinball", gameTitle: "핀볼팡팡", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function showOverlay(name) {
    for (const [k, node] of Object.entries(overlays)) if (node) node.classList.toggle("hidden", k !== name);
    if (name === "title" && el.titleBest) el.titleBest.textContent = best > 0 ? `최고 점수 ${fmt(best)}점` : "";
  }

  function updateHud() {
    el.stage.textContent = String(stageIndex + 1);
    el.score.textContent = fmt(score);
    el.goal.textContent = `${fmt(Math.min(stageScore, stage.goal))} / ${fmt(stage.goal)}`;
    el.goalFill.style.width = `${Math.min(100, (stageScore / stage.goal) * 100).toFixed(1)}%`;
    if (el.lives.childElementCount !== START_BALLS) el.lives.innerHTML = "<i></i>".repeat(START_BALLS);
    [...el.lives.children].forEach((d, k) => d.classList.toggle("used", k >= ballsLeft));
    el.lives.setAttribute("aria-label", `남은 공 ${Math.max(0, ballsLeft)}개`);
    if (el.fever) el.fever.classList.toggle("hidden", !(feverT > 0 && state === "playing"));
  }

  /* ---------- 반짝이 · 점수 글자 ---------- */
  function burst(x, y, n, colors, kind) {
    for (let k = 0; k < n; k++) {
      const a = rand(0, TAU);
      const sp = rand(60, 220);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rand(0.4, 0.8), max: 0.8, kind, color: colors[k % colors.length], size: rand(2.5, 5), rot: rand(0, TAU), vr: rand(-6, 6), g: 320 });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function addFloat(x, y, text, o = {}) {
    floats.push({ x, y, text, size: o.size || 16, color: o.color || "#fff", stroke: o.stroke || stage.theme.wallDark, life: o.life || 0.8, max: o.life || 0.8 });
    if (floats.length > 24) floats.shift();
  }

  /* ---------- 그림 도구 ---------- */
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(h, a) {
    const [r, g, b] = hexRgb(h);
    return `rgba(${r},${g},${b},${a})`;
  }
  function shade(h, k) {
    const c = hexRgb(h);
    const to = k > 0 ? 255 : 40;
    const t = Math.abs(k);
    return `rgb(${c.map((v) => Math.round(v + (to - v) * t)).join(",")})`;
  }
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function pathPts(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
  }
  function roundPoly(g, pts, r) {
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]);
    g.beginPath();
    g.moveTo(m0[0], m0[1]);
    for (let k = 0; k < n; k++) {
      const p = pts[k];
      const m = mid(p, pts[(k + 1) % n]);
      g.arcTo(p[0], p[1], m[0], m[1], r);
    }
    g.closePath();
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function starPath(g, x, y, ro, ri, rot = -Math.PI / 2) {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? ri : ro;
      const a = rot + (k * Math.PI) / 5;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.closePath();
  }
  function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.75, y - s * 1, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.75, y - s * 1, x + s * 1.25, y + s * 0.05, x, y + s * 0.9);
    g.closePath();
  }
  function ellipse(g, x, y, rx, ry, rot = 0) {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  }
  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, TAU);
  }
  function outlined(g, text, x, y, size, fill, stroke, font) {
    g.font = `${size}px ${font || '"Jua"'}, system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = Math.max(3, size * 0.24);
    g.strokeStyle = stroke;
    g.strokeText(text, x, y);
    g.fillStyle = fill;
    g.fillText(text, x, y);
  }

  // 사탕 막대 모양 벽 (진한 테두리 · 몸통 · 하이라이트)
  function tube(g, pts, w, th) {
    g.lineCap = "round";
    g.lineJoin = "round";
    pathPts(g, pts);
    g.strokeStyle = th.wallDark;
    g.lineWidth = w;
    g.stroke();
    pathPts(g, pts);
    g.strokeStyle = th.wall;
    g.lineWidth = w - 4;
    g.stroke();
    g.save();
    g.translate(-0.8, -1.4);
    pathPts(g, pts);
    g.strokeStyle = th.wallHi;
    g.globalAlpha = 0.9;
    g.lineWidth = Math.max(1.6, w * 0.2);
    g.stroke();
    g.restore();
  }

  function drawDeco(g, kind, x, y, s, col) {
    g.fillStyle = col;
    g.strokeStyle = col;
    if (kind === "heart") {
      heartPath(g, x, y, s);
      g.fill();
    } else if (kind === "star") {
      starPath(g, x, y, s, s * 0.45);
      g.fill();
    } else if (kind === "cloud") {
      circle(g, x - s * 0.6, y + s * 0.15, s * 0.5);
      g.fill();
      circle(g, x, y - s * 0.15, s * 0.7);
      g.fill();
      circle(g, x + s * 0.65, y + s * 0.15, s * 0.5);
      g.fill();
      roundRect(g, x - s * 1.1, y + s * 0.05, s * 2.2, s * 0.6, s * 0.3);
      g.fill();
    } else if (kind === "bubble") {
      g.lineWidth = s * 0.18;
      circle(g, x, y, s * 0.8);
      g.stroke();
      circle(g, x - s * 0.28, y - s * 0.3, s * 0.16);
      g.fill();
    } else if (kind === "flower") {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        circle(g, x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.42);
        g.fill();
      }
    } else if (kind === "snow") {
      g.lineWidth = s * 0.16;
      g.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        g.beginPath();
        g.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
        g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        g.stroke();
      }
    } else if (kind === "planet") {
      circle(g, x, y, s * 0.6);
      g.fill();
      g.lineWidth = s * 0.16;
      ellipse(g, x, y, s * 1.1, s * 0.32, -0.35);
      g.stroke();
    }
  }

  /* ---------- 고정 그림 (스테이지 시작 때 한 번만 그림) ---------- */
  function floorPath(g) {
    g.beginPath();
    g.moveTo(24, 704);
    for (const p of ARCH_PTS) g.lineTo(p[0], p[1]);
    g.lineTo(380, 704);
    g.closePath();
  }

  function buildStatic() {
    const th = stage.theme;
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    const g = staticCanvas.getContext("2d");
    g.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    // 하늘
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const rnd = seeded(stageIndex * 97 + 13);
    g.fillStyle = "rgba(255,255,255,0.6)";
    for (let k = 0; k < 40; k++) {
      circle(g, rnd() * W, rnd() * H, 0.8 + rnd() * 2);
      g.fill();
    }
    // 놀이판 바닥
    g.save();
    floorPath(g);
    g.fillStyle = th.floor;
    g.fill();
    g.clip();
    g.fillStyle = th.dots;
    for (let y = 80, row = 0; y < H; y += 24, row++) {
      for (let x = row % 2 ? 24 : 12; x < W; x += 24) {
        circle(g, x, y, 2.4);
        g.fill();
      }
    }
    // 큰 장식 무늬
    const decoCol = rgba(th.wall, 0.16);
    for (const [x, y, s] of [
      [74, 168, 14],
      [118, 212, 8],
      [268, 160, 9],
      [114, 440, 10],
      [254, 440, 10],
      [184, 404, 12],
      [60, 250, 8],
      [318, 330, 9],
    ])
      drawDeco(g, th.deco, x, y, s, decoCol);
    // 판 이름
    g.font = '24px "Bagel Fat One", "Jua", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = rgba(th.wall, 0.22);
    g.fillText("핀볼팡팡", MID, 520);
    // 가장자리는 살짝 어둡게 (입체감)
    const vg = g.createRadialGradient(MID, 390, 140, MID, 390, 430);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, rgba(th.wallDark, 0.16));
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    // 발사길 홈
    g.fillStyle = rgba(th.wallDark, 0.07);
    g.fillRect(344, 230, 36, 480);
    // 공이 빠지는 쪽
    const dg = g.createLinearGradient(0, 612, 0, 704);
    dg.addColorStop(0, "rgba(0,0,0,0)");
    dg.addColorStop(1, rgba(th.wallDark, 0.24));
    g.fillStyle = dg;
    g.fillRect(100, 612, 168, 92);
    g.restore();
    // 미끄럼틀 아래 (막힌 곳)
    for (const side of [1, -1]) {
      const X = (x) => (side > 0 ? x : 2 * MID - x);
      g.fillStyle = th.apron;
      pathPts(g, [
        [X(24), 530],
        [X(100), 601],
        [X(100), 704],
        [X(24), 704],
      ]);
      g.closePath();
      g.fill();
      g.fillStyle = rgba(th.wallHi, 0.8);
      starPath(g, X(48), 690, 5, 2.2);
      g.fill();
      circle(g, X(84), 690, 2.5);
      g.fill();
    }
    // 벽
    tube(g, BOUNDARY, 13, th);
    tube(g, [[344, 704], [344, 268]], 13, th);
    tube(g, [[24, 530], [100, 601]], 13, th);
    tube(g, [[344, 530], [268, 601]], 13, th);
    for (const x of [124, 164, 204, 244]) tube(g, [[x, 126], [x, 164]], 9, th);
    // 발사길 문
    g.lineCap = "round";
    g.strokeStyle = th.wallDark;
    g.lineWidth = 6;
    pathPts(g, [[344, 268], [380, 245]]);
    g.stroke();
    g.strokeStyle = th.wallHi;
    g.lineWidth = 2;
    pathPts(g, [[346, 266], [378, 246]]);
    g.stroke();
  }

  /* ---------- 움직이는 그림 ---------- */
  function drawAnimal(g, kind, x, y, r, col, happy, blink) {
    const dark = shade(col, -0.45);
    const light = shade(col, 0.5);
    const line = "#5a3a50";
    g.save();
    g.translate(x, y);
    g.lineWidth = 2;
    g.strokeStyle = line;
    g.fillStyle = col;
    if (kind === "cat" || kind === "pig") {
      for (const s of [-1, 1]) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(s * r * 0.95, -r * 0.18);
        g.lineTo(s * r * 0.86, -r * (kind === "pig" ? 1.0 : 1.18));
        g.lineTo(s * r * 0.2, -r * 0.86);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = "#ffb3c9";
        g.beginPath();
        g.moveTo(s * r * 0.8, -r * 0.42);
        g.lineTo(s * r * 0.76, -r * (kind === "pig" ? 0.86 : 0.98));
        g.lineTo(s * r * 0.42, -r * 0.8);
        g.closePath();
        g.fill();
      }
    } else if (kind === "bear") {
      for (const s of [-1, 1]) {
        g.fillStyle = col;
        circle(g, s * r * 0.7, -r * 0.72, r * 0.36);
        g.fill();
        g.stroke();
        g.fillStyle = "#ffc2d4";
        circle(g, s * r * 0.7, -r * 0.72, r * 0.18);
        g.fill();
      }
    } else if (kind === "bunny") {
      for (const s of [-1, 1]) {
        g.fillStyle = col;
        ellipse(g, s * r * 0.42, -r * 1.02, r * 0.22, r * 0.46, s * 0.2);
        g.fill();
        g.stroke();
        g.fillStyle = "#ffb3c9";
        ellipse(g, s * r * 0.42, -r * 1.0, r * 0.1, r * 0.32, s * 0.2);
        g.fill();
      }
    } else if (kind === "frog") {
      for (const s of [-1, 1]) {
        g.fillStyle = col;
        circle(g, s * r * 0.48, -r * 0.74, r * 0.34);
        g.fill();
        g.stroke();
      }
    } else if (kind === "chick") {
      g.fillStyle = col;
      for (const a of [-0.5, 0, 0.5]) {
        ellipse(g, Math.sin(a) * r * 0.3, -r * 1.02, r * 0.1, r * 0.24, a);
        g.fill();
        g.stroke();
      }
    }
    // 얼굴
    const gr = g.createRadialGradient(-r * 0.35, -r * 0.42, r * 0.1, 0, 0, r);
    gr.addColorStop(0, light);
    gr.addColorStop(1, col);
    g.fillStyle = gr;
    circle(g, 0, 0, r);
    g.fill();
    g.stroke();
    // 눈
    const frog = kind === "frog";
    const ey = frog ? -r * 0.74 : -r * 0.1;
    const ex = frog ? r * 0.48 : r * 0.36;
    if (frog) {
      g.fillStyle = "#fff";
      for (const s of [-1, 1]) {
        circle(g, s * ex, ey, r * 0.22);
        g.fill();
      }
    }
    g.fillStyle = "#3b2635";
    g.strokeStyle = "#3b2635";
    g.lineCap = "round";
    if (happy) {
      g.lineWidth = 2.4;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(s * ex, ey + r * 0.07, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      }
    } else if (blink) {
      g.lineWidth = 2.2;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * ex - r * 0.11, ey);
        g.lineTo(s * ex + r * 0.11, ey);
        g.stroke();
      }
    } else {
      for (const s of [-1, 1]) {
        circle(g, s * ex, ey, r * 0.12);
        g.fill();
      }
      g.fillStyle = "#fff";
      for (const s of [-1, 1]) {
        circle(g, s * ex + r * 0.04, ey - r * 0.05, r * 0.045);
        g.fill();
      }
    }
    // 볼
    g.fillStyle = "rgba(255,105,150,0.45)";
    for (const s of [-1, 1]) {
      ellipse(g, s * r * 0.6, r * 0.2, r * 0.17, r * 0.11);
      g.fill();
    }
    // 입
    if (kind === "chick") {
      g.fillStyle = "#ff9f2e";
      g.strokeStyle = "#c86a10";
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(-r * 0.16, r * 0.1);
      g.lineTo(r * 0.16, r * 0.1);
      g.lineTo(0, r * (happy ? 0.38 : 0.3));
      g.closePath();
      g.fill();
      g.stroke();
    } else if (kind === "pig") {
      g.fillStyle = shade(col, 0.25);
      g.strokeStyle = dark;
      g.lineWidth = 1.5;
      ellipse(g, 0, r * 0.24, r * 0.27, r * 0.18);
      g.fill();
      g.stroke();
      g.fillStyle = dark;
      for (const s of [-1, 1]) {
        ellipse(g, s * r * 0.09, r * 0.24, r * 0.04, r * 0.07);
        g.fill();
      }
    } else if (happy) {
      g.fillStyle = "#e0506f";
      g.beginPath();
      g.arc(0, r * 0.18, r * 0.16, 0, Math.PI);
      g.closePath();
      g.fill();
    } else {
      g.lineWidth = 1.8;
      g.strokeStyle = "#3b2635";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(s * r * 0.08, r * 0.2, r * 0.08, 0, Math.PI);
        g.stroke();
      }
    }
    // 반짝
    g.fillStyle = "rgba(255,255,255,0.7)";
    ellipse(g, -r * 0.42, -r * 0.5, r * 0.16, r * 0.09, -0.6);
    g.fill();
    g.restore();
  }

  function drawBumpers(g) {
    const th = stage.theme;
    for (const bp of bumpers) {
      const s = 1 + 0.2 * bp.pop * Math.cos((1 - bp.pop) * 9);
      g.fillStyle = "rgba(70,30,60,0.16)";
      ellipse(g, bp.x + 3, bp.y + 6, bp.r + 4, bp.r + 2);
      g.fill();
      // 받침 고리
      circle(g, bp.x, bp.y, (bp.r + 5) * s);
      g.fillStyle = bp.lit > 0 ? "#fff6a0" : "#fff";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = bp.lit > 0 ? "#ffb020" : th.wallDark;
      g.stroke();
      const blink = (visT * 0.8 + bp.k * 1.37) % 3.4 < 0.13;
      drawAnimal(g, bp.kind, bp.x, bp.y, (bp.r - 2) * s, bp.color, bp.lit > 0, blink);
    }
  }

  function drawSlings(g) {
    const th = stage.theme;
    for (const s of slings) {
      const [A, B, C] = s.pts;
      const mx = (A[0] + C[0]) / 2;
      const my = (A[1] + C[1]) / 2;
      let nx = -(C[1] - A[1]);
      let ny = C[0] - A[0];
      const l = Math.hypot(nx, ny);
      nx /= l;
      ny /= l;
      if ((B[0] - mx) * nx + (B[1] - my) * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const bulge = s.wob * 9 * Math.cos((1 - s.wob) * 14);
      // 젤리 몸통 (위 꼭짓점이 뾰족해서 둥글림은 작게)
      roundPoly(g, s.pts, 3.5);
      const gr = g.createLinearGradient(B[0], B[1], mx, my);
      gr.addColorStop(0, th.wall);
      gr.addColorStop(1, th.apron);
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = th.wallDark;
      g.stroke();
      // 고무줄
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(A[0], A[1]);
      g.quadraticCurveTo(mx + nx * bulge, my + ny * bulge, C[0], C[1]);
      g.strokeStyle = "#fff";
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = s.wob > 0.2 ? "#ffd23f" : th.accent;
      g.lineWidth = 2.5;
      g.stroke();
      // 얼굴
      const gx = (A[0] + B[0] + C[0]) / 3 + nx * 2;
      const gy = (A[1] + B[1] + C[1]) / 3 + ny * 2 + 2;
      g.fillStyle = "#3b2635";
      g.strokeStyle = "#3b2635";
      g.lineWidth = 1.8;
      if (s.wob > 0.3) {
        for (const k of [-1, 1]) {
          g.beginPath();
          g.moveTo(gx + k * 5 - 2.5 * k, gy - 6);
          g.lineTo(gx + k * 5 + 1.5 * k, gy - 4);
          g.lineTo(gx + k * 5 - 2.5 * k, gy - 2);
          g.stroke();
        }
      } else {
        for (const k of [-1, 1]) {
          circle(g, gx + k * 5, gy - 4, 1.9);
          g.fill();
        }
      }
      g.beginPath();
      g.arc(gx, gy + 1, 2.6, 0.15, Math.PI - 0.15);
      g.stroke();
    }
  }

  function drawPosts(g) {
    const th = stage.theme;
    for (const p of posts) {
      if (p.lit > 0) {
        circle(g, p.x, p.y, p.r + 6);
        g.fillStyle = `rgba(255,240,140,${Math.min(0.7, p.lit * 2)})`;
        g.fill();
      }
      g.fillStyle = "rgba(70,30,60,0.15)";
      circle(g, p.x + 2, p.y + 3, p.r);
      g.fill();
      circle(g, p.x, p.y, p.r);
      g.fillStyle = "#fff";
      g.fill();
      g.save();
      circle(g, p.x, p.y, p.r);
      g.clip();
      g.strokeStyle = th.accent;
      g.lineWidth = 2.6;
      g.beginPath();
      for (let a = 0; a < 5.5 * Math.PI; a += 0.25) {
        const rr = (a / (5.5 * Math.PI)) * p.r;
        const ang = a + visT * 2;
        g.lineTo(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr);
      }
      g.stroke();
      g.restore();
      circle(g, p.x, p.y, p.r);
      g.lineWidth = 2;
      g.strokeStyle = th.wallDark;
      g.stroke();
    }
  }

  function drawDrops(g) {
    const th = stage.theme;
    for (const d of drops) {
      // 벽에 반쯤 박힌 선물상자 (정면으로 맞혀야 쓰러짐)
      const x = 20;
      const y = d.y - 13;
      if (d.down) {
        g.setLineDash([3, 3]);
        roundRect(g, x + 1, y + 2, 11, 22, 4);
        g.strokeStyle = rgba(th.wallDark, 0.35);
        g.lineWidth = 1.5;
        g.stroke();
        g.setLineDash([]);
        continue;
      }
      const s = 1 + 0.25 * d.pop * Math.cos((1 - d.pop) * 10);
      g.save();
      g.translate(x + 6.5, d.y);
      g.scale(s, s);
      roundRect(g, -6.5, -13, 13, 26, 4);
      g.fillStyle = th.colors[d.k] === "#ffffff" ? "#ffe3ef" : th.colors[d.k];
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = "#5a3a50";
      g.stroke();
      g.fillStyle = "#fff";
      g.fillRect(-1.5, -13, 3, 26);
      g.fillRect(-6.5, -1.5, 13, 3);
      // 리본
      g.fillStyle = "#ff5c9a";
      ellipse(g, 4, -3.6, 3.8, 2.4, -0.5);
      g.fill();
      ellipse(g, 4, 3.6, 3.8, 2.4, 0.5);
      g.fill();
      circle(g, 2, 0, 2.2);
      g.fill();
      g.restore();
    }
  }

  function drawLanes(g) {
    const th = stage.theme;
    const party = lanesResetT > 0 && Math.floor(visT * 10) % 2 === 0;
    for (const l of lanes) {
      const on = l.on && !party;
      if (on) {
        circle(g, l.x, l.y, 15);
        g.fillStyle = "rgba(255,225,90,0.35)";
        g.fill();
      }
      const s = 1 + 0.35 * l.glow;
      starPath(g, l.x, l.y, 10 * s, 4.6 * s);
      g.fillStyle = on ? "#ffd23f" : "rgba(255,255,255,0.9)";
      g.fill();
      g.lineWidth = 2;
      g.lineJoin = "round";
      g.strokeStyle = on ? "#e89a00" : rgba(th.wallDark, 0.45);
      g.stroke();
      // 아래 화살표
      g.beginPath();
      g.moveTo(l.x, l.y + 30);
      g.lineTo(l.x - 6, l.y + 39);
      g.lineTo(l.x + 6, l.y + 39);
      g.closePath();
      g.fillStyle = on ? "#ffc21f" : rgba(th.wall, 0.3);
      g.fill();
    }
  }

  function drawHole(g) {
    const glow = hole.glow;
    if (glow > 0) {
      circle(g, hole.x, hole.y, 24 + glow * 6);
      g.fillStyle = `rgba(255,214,90,${glow * 0.45})`;
      g.fill();
    }
    circle(g, hole.x, hole.y, 18);
    g.fillStyle = "#ffcf5a";
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = "#c98a10";
    g.stroke();
    // 꿀 방울
    g.fillStyle = "#ffcf5a";
    for (const [dx, dy, r] of [
      [-12, 14, 4],
      [3, 18, 3.4],
      [13, 12, 3],
    ]) {
      circle(g, hole.x + dx, hole.y + dy, r);
      g.fill();
    }
    const gr = g.createRadialGradient(hole.x - 3, hole.y - 4, 2, hole.x, hole.y, 13);
    gr.addColorStop(0, "#5a3415");
    gr.addColorStop(1, "#8a5a2b");
    circle(g, hole.x, hole.y, 12.5);
    g.fillStyle = gr;
    g.fill();
    outlined(g, "+500", hole.x, hole.y - 27, 11, "#fff", "#d98a00");
  }

  function drawFlipper(g, f, a) {
    const th = stage.theme;
    const ang = flipperAngle(f, a);
    const L = FL.len;
    const shape = () => {
      g.beginPath();
      g.moveTo(0, -FL.rb);
      g.lineTo(L, -FL.rt);
      g.arc(L, 0, FL.rt, -Math.PI / 2, Math.PI / 2);
      g.lineTo(0, FL.rb);
      g.arc(0, 0, FL.rb, Math.PI / 2, Math.PI * 1.5);
      g.closePath();
    };
    // 그림자
    g.save();
    g.translate(f.px + 3, f.py + 5);
    g.rotate(ang);
    if (f.side < 0) g.scale(1, -1);
    shape();
    g.fillStyle = "rgba(70,30,60,0.18)";
    g.fill();
    g.restore();
    g.save();
    g.translate(f.px, f.py);
    g.rotate(ang);
    if (f.side < 0) g.scale(1, -1);
    shape();
    const gr = g.createLinearGradient(0, -FL.rb, 0, FL.rb);
    gr.addColorStop(0, shade(th.flip, 0.35));
    gr.addColorStop(1, th.flip);
    g.fillStyle = gr;
    g.fill();
    // 사탕 줄무늬
    g.save();
    shape();
    g.clip();
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = 4;
    for (let x = -8; x < L + 12; x += 13) {
      g.beginPath();
      g.moveTo(x, FL.rb);
      g.lineTo(x + 10, -FL.rb);
      g.stroke();
    }
    g.restore();
    shape();
    g.lineWidth = 2.2;
    g.strokeStyle = shade(th.flip, -0.4);
    g.stroke();
    // 하이라이트 · 축
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineCap = "round";
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(5, -FL.rb * 0.5);
    g.lineTo(L - 4, -FL.rt * 0.45);
    g.stroke();
    circle(g, 0, 0, 4.2);
    g.fillStyle = "#fff";
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = shade(th.flip, -0.4);
    g.stroke();
    g.restore();
  }

  function drawPlunger(g) {
    const th = stage.theme;
    const top = PLUNGER_Y + plungerVis * PULL_MAX;
    // 용수철
    g.strokeStyle = th.wallDark;
    g.lineWidth = 2.6;
    g.lineJoin = "round";
    g.beginPath();
    const y0 = top + 9;
    const n = 7;
    for (let k = 0; k <= n; k++) {
      const y = y0 + ((704 - y0) * k) / n;
      g.lineTo(k % 2 ? 372 : 352, y);
    }
    g.stroke();
    roundRect(g, 349, top - 1, 26, 11, 5);
    g.fillStyle = th.accent;
    g.fill();
    g.lineWidth = 1.8;
    g.strokeStyle = shade(th.accent, -0.35);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.7)";
    roundRect(g, 353, top + 1, 18, 3, 1.5);
    g.fill();
    // 발사길 화살표 (힘 표시)
    const waiting = plungerReady() && state === "playing";
    for (let k = 0; k < 5; k++) {
      const y = 600 - k * 30;
      let lit = false;
      if (charging) lit = pull * 5 > k + 0.05;
      else if (waiting) lit = Math.floor(visT * 6) % 6 === k;
      g.beginPath();
      g.moveTo(LANE_X - 7, y + 5);
      g.lineTo(LANE_X, y - 3);
      g.lineTo(LANE_X + 7, y + 5);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.lineWidth = 3.4;
      g.strokeStyle = lit ? (charging && k >= 4 ? "#ffb020" : th.accent) : rgba(th.wallDark, 0.2);
      g.stroke();
    }
  }

  function drawCloud(g) {
    const on = shield.t > 0;
    const pop = shield.pop;
    if (!on && pop <= 0.02) return;
    let a = on ? 1 : pop;
    if (on && shield.t < 2 && Math.floor(visT * 8) % 2 === 0) a = 0.45;
    const s = on ? 1 + 0.12 * pop * Math.cos((1 - pop) * 10) : 0.7 + 0.3 * pop;
    g.save();
    g.globalAlpha = a;
    g.translate(MID, SHIELD_Y + 12);
    g.scale(s, s);
    g.fillStyle = "#fff";
    g.strokeStyle = "#9cc8ff";
    g.lineWidth = 2.5;
    const parts = [
      [-46, 4, 15],
      [-24, -6, 20],
      [2, -10, 23],
      [28, -5, 19],
      [50, 5, 14],
    ];
    for (const [x, y, r] of parts) {
      circle(g, x, y, r);
      g.stroke();
    }
    for (const [x, y, r] of parts) {
      circle(g, x, y, r - 1);
      g.fill();
    }
    g.fillRect(-58, 0, 116, 16);
    // 얼굴
    g.strokeStyle = "#5a3a50";
    g.lineWidth = 2;
    g.lineCap = "round";
    for (const k of [-1, 1]) {
      g.beginPath();
      g.arc(k * 9, -6, 3.5, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, -1, 4, 0.2, Math.PI - 0.2);
    g.stroke();
    g.fillStyle = "rgba(255,120,160,0.45)";
    for (const k of [-1, 1]) {
      ellipse(g, k * 17, -1, 4, 2.6);
      g.fill();
    }
    g.restore();
  }

  function drawBall(g, x, y, b) {
    const th = stage.theme;
    let scale = 1;
    if (b.hold && b.hold.mode === "hole") scale = 1 - 0.28 * Math.sin(Math.min(1, b.hold.t / b.hold.dur) * Math.PI);
    // 꼬리
    for (let k = 0; k < trail.length; k++) {
      const p = trail[k];
      const f = (k + 1) / (trail.length + 1);
      circle(g, p[0], p[1], R * (0.35 + 0.55 * f));
      g.fillStyle = rgba(th.wall, 0.12 * f);
      g.fill();
    }
    // 그림자
    g.fillStyle = "rgba(70,30,60,0.2)";
    ellipse(g, x + 3, y + 5, R * scale, R * 0.85 * scale);
    g.fill();
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    if (b.squash > 0.01) {
      g.rotate(b.sqAng);
      g.scale(1 - b.squash, 1 + b.squash * 0.6);
      g.rotate(-b.sqAng);
    }
    circle(g, 0, 0, R);
    g.fillStyle = "#fffafc";
    g.fill();
    // 굴러가는 사탕 점
    g.save();
    circle(g, 0, 0, R);
    g.clip();
    const cols = ["#ff7fb0", "#ffc845", "#6cc4ff", "#7fdc9a", "#b494ff", "#ff9a5c"];
    b.spots.forEach((p, k) => {
      if (p[2] > 0.3) return;
      const fz = Math.max(0.1, -p[2]);
      g.save();
      g.translate(p[0] * R, p[1] * R);
      g.rotate(Math.atan2(p[1], p[0]));
      g.scale(fz, 1);
      circle(g, 0, 0, R * 0.47);
      g.restore();
      g.fillStyle = cols[k];
      g.fill();
    });
    // 동그란 입체감
    const sh = g.createRadialGradient(-3, -4, 1, 0, 0, R + 1);
    sh.addColorStop(0, "rgba(255,255,255,0.35)");
    sh.addColorStop(0.55, "rgba(255,255,255,0)");
    sh.addColorStop(1, "rgba(80,30,90,0.38)");
    g.fillStyle = sh;
    g.fillRect(-R - 2, -R - 2, R * 2 + 4, R * 2 + 4);
    g.restore();
    circle(g, 0, 0, R);
    g.lineWidth = 1.3;
    g.strokeStyle = "rgba(90,40,90,0.45)";
    g.stroke();
    // 빛 (늘 같은 자리)
    g.fillStyle = "rgba(255,255,255,0.92)";
    ellipse(g, -3.6, -4.4, 3.4, 2.2, -0.7);
    g.fill();
    circle(g, 3.6, 4.2, 1.1);
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.fill();
    g.restore();
  }

  function drawParticles(g) {
    for (const p of particles) {
      const a = Math.max(0, Math.min(1, p.life / (p.max * 0.6)));
      g.globalAlpha = a;
      g.fillStyle = p.color;
      if (p.kind === "star") {
        starPath(g, p.x, p.y, p.size, p.size * 0.45, p.rot);
        g.fill();
      } else if (p.kind === "heart") {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot * 0.3);
        heartPath(g, 0, 0, p.size * 0.8);
        g.fill();
        g.restore();
      } else {
        circle(g, p.x, p.y, p.size * 0.6);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  function drawFloats(g) {
    for (const f of floats) {
      const k = 1 - f.life / f.max;
      const s = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
      g.globalAlpha = Math.min(1, f.life / (f.max * 0.35));
      outlined(g, f.text, f.x, f.y, f.size * s, f.color, f.stroke);
    }
    g.globalAlpha = 1;
  }

  function bubble(g, x, y, w, h, text, size, th) {
    roundRect(g, x - w / 2, y - h / 2, w, h, h / 2);
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = th.wall;
    g.stroke();
    g.font = `${size}px "Jua", system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = th.wallDark;
    g.fillText(text, x, y + 1);
  }

  function drawHints(g) {
    if (state !== "playing" || !ball) return;
    const th = stage.theme;
    if (plungerReady() && !charging) {
      const s = 1 + 0.04 * Math.sin(visT * 6);
      g.save();
      g.translate(MID + 6, 470);
      g.scale(s, s);
      bubble(g, 0, 0, isTouch ? 164 : 190, 34, isTouch ? "꾹~ 눌렀다 떼면 슝!" : "스페이스 꾹~ 떼면 슝!", 16, th);
      g.restore();
      // 발사대를 가리키는 화살표 (오른쪽 아래 막힌 곳 위)
      const ax = 324 + Math.sin(visT * 6) * 3;
      g.fillStyle = th.accent;
      g.beginPath();
      g.moveTo(ax + 13, 630);
      g.lineTo(ax, 620);
      g.lineTo(ax, 640);
      g.closePath();
      g.fill();
      outlined(g, "발사!", ax - 20, 630, 14, "#fff", th.accent);
    }
    if (!usedFlip[0] || !usedFlip[1]) {
      const a = 0.75 + 0.25 * Math.sin(visT * 5);
      g.globalAlpha = a;
      if (!usedFlip[0]) bubble(g, 62, 664, 64, 28, isTouch ? "◀ 탁!" : "Z 탁!", 15, th);
      if (!usedFlip[1]) bubble(g, 2 * MID - 62, 664, 64, 28, isTouch ? "탁! ▶" : "X 탁!", 15, th);
      g.globalAlpha = 1;
    }
  }

  function drawBanner(g) {
    if (!banner) return;
    const th = stage.theme;
    const k = banner.t / banner.dur;
    const inK = Math.min(1, banner.t / 0.25);
    const outK = Math.min(1, (banner.dur - banner.t) / 0.3);
    const s = 0.7 + 0.3 * (1 - (1 - inK) ** 3) + (k < 0.2 ? 0.05 * Math.sin(inK * Math.PI) : 0);
    g.save();
    g.globalAlpha = Math.max(0, outK);
    g.translate(MID, 400);
    g.scale(s, s);
    roundRect(g, -118, -42, 236, 84, 26);
    g.fillStyle = "rgba(255,255,255,0.96)";
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = th.wall;
    g.stroke();
    outlined(g, banner.title, 0, -12, 30, th.accent, "#fff", '"Bagel Fat One", "Jua"');
    g.font = '17px "Jua", system-ui, sans-serif';
    g.fillStyle = th.wallDark;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(banner.sub, 0, 22);
    g.restore();
  }

  function render(alpha) {
    const g = ctx;
    g.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    g.save();
    if (shake > 0.05) g.translate(rand(-shake, shake), rand(-shake, shake));
    g.drawImage(staticCanvas, 0, 0, W, H);
    drawLanes(g);
    drawHole(g);
    drawDrops(g);
    drawSlings(g);
    drawPosts(g);
    drawBumpers(g);
    drawPlunger(g);
    for (const f of flippers) drawFlipper(g, f, f.pa + (f.a - f.pa) * alpha);
    drawCloud(g);
    if (ball) {
      const x = ball.px + (ball.x - ball.px) * alpha;
      const y = ball.py + (ball.y - ball.py) * alpha;
      drawBall(g, x, y, ball);
    }
    drawParticles(g);
    drawFloats(g);
    drawHints(g);
    drawBanner(g);
    g.restore();
  }

  /* ---------- 그림 움직임 (멈춤 중에는 멈춤) ---------- */
  function animate(dt) {
    visT += dt;
    const fall = Math.exp(-dt * 7);
    for (const bp of bumpers) {
      if (bp.lit > 0) bp.lit -= dt;
      bp.pop *= Math.exp(-dt * 6);
    }
    for (const s of slings) s.wob *= Math.exp(-dt * 5);
    for (const p of posts) if (p.lit > 0) p.lit -= dt;
    for (const l of lanes) l.glow *= fall;
    for (const d of drops) d.pop *= Math.exp(-dt * 6);
    hole.glow *= Math.exp(-dt * 3);
    shield.pop *= Math.exp(-dt * 4);
    shake *= Math.exp(-dt * 12);
    if (ball) {
      ball.squash *= Math.exp(-dt * 16);
      const sp = Math.hypot(ball.vx, ball.vy);
      if (sp > 420 && !ball.hold) trail.push([ball.x, ball.y]);
      else if (trail.length) trail.shift();
      if (trail.length > 7) trail.shift();
    } else trail = [];
    // 발사대 용수철
    if (charging) {
      plungerVis = pull;
      plungerVel = 0;
    } else {
      plungerVel += (-plungerVis * 900 - plungerVel * 16) * dt;
      plungerVis += plungerVel * dt;
      if (Math.abs(plungerVis) < 0.002 && Math.abs(plungerVel) < 0.02) plungerVis = plungerVel = 0;
    }
    for (const p of particles) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floats) {
      f.y -= 34 * dt;
      f.life -= dt;
    }
    floats = floats.filter((f) => f.life > 0);
    if (banner) {
      banner.t += dt;
      if (banner.t >= banner.dur) banner = null;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    if (state === "paused") {
      render(1);
      return;
    }
    if (state === "playing") {
      acc += dt * (bot && bot.on ? bot.speed : 1);
      if (acc > 0.25) acc = 0.25;
      while (acc >= STEP && state === "playing") {
        step(STEP);
        acc -= STEP;
      }
    } else acc = 0;
    if (state === "clearing") {
      clearT -= dt;
      if (clearT <= 0) showClear();
    }
    animate(dt);
    if (el.fever) el.fever.classList.toggle("hidden", !(feverT > 0 && state === "playing"));
    render(state === "playing" ? acc / STEP : 1);
  }

  /* ---------- 조작 ---------- */
  function setFlip(f, on) {
    if (on && !f.pressed && state === "playing") {
      SFX.play("flip");
      usedFlip[f.side > 0 ? 0 : 1] = true;
    }
    f.pressed = on;
  }

  function syncInput() {
    let l = keys.left || keys.both;
    let r = keys.right || keys.both;
    let p = keys.plunger;
    pointers.forEach((k) => {
      if (k === "left") l = true;
      else if (k === "right") r = true;
      else if (k === "plunger") p = true;
    });
    if (bot && bot.on) {
      l = l || bot.l > 0;
      r = r || bot.r > 0;
    }
    setFlip(flippers[0], l);
    setFlip(flippers[1], r);
    if (p && !plungerHeld && plungerReady()) charging = true;
    if (!p && plungerHeld && charging) doLaunch();
    plungerHeld = p;
  }

  function sideOf(clientX) {
    const rect = canvas.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2 ? "left" : "right";
  }

  function ignoreTarget(t) {
    return !!(t && t.closest && t.closest("button, a, input, textarea, select, label, .overlay, .today-pause-overlay, .seo-about, .today-brand, .today-mute-btn"));
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (state !== "playing" || ignoreTarget(e.target)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      SFX.unlock();
      pointers.set(e.pointerId, plungerReady() ? "plunger" : sideOf(e.clientX));
      if (e.cancelable) e.preventDefault();
      syncInput();
    },
    { passive: false },
  );
  const pointerEnd = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    syncInput();
  };
  document.addEventListener("pointerup", pointerEnd);
  document.addEventListener("pointercancel", pointerEnd);
  window.addEventListener("blur", () => {
    pointers.clear();
    keys.left = keys.right = keys.both = keys.plunger = false;
    syncInput();
  });

  function keyKind(e) {
    const k = e.key;
    if (k === "z" || k === "Z" || k === "ArrowLeft" || k === "a" || k === "A") return "left";
    if (k === "x" || k === "X" || k === "ArrowRight" || k === "/" || k === "m" || k === "M") return "right";
    if (k === " " || k === "Spacebar" || k === "ArrowDown" || k === "ArrowUp" || k === "Enter") return "space";
    return null;
  }

  window.addEventListener("keydown", (e) => {
    if (state !== "playing") return;
    const kind = keyKind(e);
    if (!kind) return;
    e.preventDefault();
    if (e.repeat) return;
    SFX.unlock();
    if (kind === "left") keys.left = true;
    else if (kind === "right") keys.right = true;
    else if (plungerReady() || charging) keys.plunger = true;
    else keys.both = true; // 공이 판 위에 있을 때 스페이스는 양쪽 날개
    syncInput();
  });

  window.addEventListener("keyup", (e) => {
    const kind = keyKind(e);
    if (!kind) return;
    if (kind === "left") keys.left = false;
    else if (kind === "right") keys.right = false;
    else {
      keys.plunger = false;
      keys.both = false;
    }
    syncInput();
  });

  /* ---------- 자동 점검용 (주소에 ?bot=1 일 때만) ---------- */
  function botThink(dt) {
    bot.l = Math.max(-1, bot.l - dt);
    bot.r = Math.max(-1, bot.r - dt);
    if (ball && plungerReady() && !charging) {
      charging = true;
      bot.charge = rand(0.15, 0.8);
    }
    if (charging) {
      bot.charge -= dt;
      if (bot.charge <= 0) doLaunch();
    }
    if (ball && !ball.inLane && !ball.hold) {
      if (bot.mode === "good") {
        for (const f of flippers) {
          const ang = flipperAngle(f, FL.rest);
          const ux = Math.cos(ang);
          const uy = Math.sin(ang);
          const rx = ball.x - f.px;
          const ry = ball.y - f.py;
          const along = rx * ux + ry * uy;
          const above = -(rx * -uy + ry * ux) * f.side; // 날개 윗면에서 떨어진 거리
          const key = f.side > 0 ? "l" : "r";
          if (along > 18 && along < FL.len + 14 && above > -4 && above < 30 && ball.vy > -60 && bot[key] <= -0.2) bot[key] = 0.22;
        }
      } else if (bot.mode === "kid" && ball.y > 430 && Math.random() < dt * 1.6) {
        if (Math.random() < 0.5) bot.l = rand(0.1, 0.35);
        else bot.r = rand(0.1, 0.35);
      }
    }
    syncInput();
  }

  if (BOT) {
    window.__pin = {
      bot,
      stats,
      get state() {
        return state;
      },
      get score() {
        return score;
      },
      get stageScore() {
        return stageScore;
      },
      get goal() {
        return stage.goal;
      },
      get balls() {
        return ballsLeft;
      },
      get stage() {
        return stageIndex;
      },
      get T() {
        return T;
      },
      get ball() {
        return ball && { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, inLane: ball.inLane, hold: ball.hold && ball.hold.mode };
      },
      start(i = 0) {
        stageIndex = i;
        score = 0;
        ballsLeft = START_BALLS;
        setupStage();
        state = "playing";
        showOverlay(null);
      },
      goalFor,
      setBalls(n) {
        ballsLeft = n;
      },
      place(x, y, vx = 0, vy = 0) {
        if (!ball) spawnBall();
        Object.assign(ball, { x, y, px: x, py: y, vx, vy, inLane: false, hold: null, still: 0 });
      },
      stepN(n) {
        for (let k = 0; k < n && state === "playing"; k++) step(STEP);
      },
      flippers,
    };
  }

  /* ---------- 시작 ---------- */
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * ((rect.width || W) / W)));
    if (Math.abs(scale - pxScale) < 0.01 && canvas.width === Math.round(W * scale)) return;
    pxScale = scale;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    buildStatic();
  }
  window.addEventListener("resize", fitCanvas);

  document.getElementById("start-btn").addEventListener("click", () => startGame(true));
  document.getElementById("retry-btn").addEventListener("click", () => startGame(true));
  document.getElementById("again-btn").addEventListener("click", () => startGame(true));
  document.getElementById("next-btn").addEventListener("click", () => nextStage());

  buildTable();
  fitCanvas();
  buildStatic();
  showOverlay("title");
  updateHud();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => buildStatic()).catch(() => {});
  lastT = performance.now();
  requestAnimationFrame(frame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "pinball",
      gameTitle: "핀볼팡팡",
      formParent: overlays.over || overlays.all || document.body,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "playing",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "playing") return false;
        state = "paused";
        pointers.clear();
        keys.left = keys.right = keys.both = keys.plunger = false;
        syncInput();
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "playing";
        lastT = performance.now();
        return true;
      },
    });
  }
})();
