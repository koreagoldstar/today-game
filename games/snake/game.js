/*
 * 애플 스네이크
 *  - 움직임: 칸을 뛰지 않고 칸 사이를 매끄럽게 이어 감. 한 칸 시작 직후에 누른 방향은 바로 꺾음.
 *    벽 · 돌 · 몸 바로 앞에서는 잠깐 멈춰 기다려 줌(방향을 바꿀 틈) → 그래도 그대로면 부딪힘.
 *  - 그림: 몸은 굵기가 줄어드는 한 줄(무늬 · 윤기), 얼굴은 사과를 쳐다보고 입을 벌림, 먹은 사과가 몸을 타고 내려감.
 *  - 판: 50스테이지 · 테마 5가지(10스테이지마다) · 돌 배치 9가지 · 황금 사과 · 느림 열매 · 꼬리 버섯.
 *  - 테스트: window.AppleSnake (scripts/test-snake.js)
 */
(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const COLS = 15;
  const ROWS = 22;
  const GRID_TOP = 98;
  const CELL = Math.floor(Math.min((W - 18) / COLS, (H - GRID_TOP - 16) / ROWS));
  const GW = COLS * CELL;
  const GH = ROWS * CELL;
  const OX = Math.floor((W - GW) / 2);
  const OY = GRID_TOP + Math.floor((H - GRID_TOP - GH) / 2);
  const BEST_KEY = "snake-best-v1";
  const PROG_KEY = "snake-progress-v1";
  const TOTAL_STAGES = 50;
  const GRACE = 0.17; // 부딪히기 직전 기다려 주는 시간

  const STAGE_NAMES = [
    "첫 먹이", "느긋한 산책", "초원 탐험", "달콤한 길", "빠른 꼬리",
    "돌멩이 숲", "좁은 틈", "콤보 연습", "황금 사과", "위험한 코너",
    "번개 속도", "꽃잎 길", "연속 먹기", "마스터 코스", "지렁이 러시",
    "최종 시험", "전설의 먹이", "지렁이 고수",
  ];

  /* ---------- 테마 (10스테이지마다) ---------- */
  const THEMES = [
    { key: "meadow", name: "햇살 초원", sky: ["#6ec3ff", "#c6ecff"], hill: ["#7ccf6c", "#58b458"], a: "#9fdc62", b: "#8fd253", speck: "rgba(60,120,30,0.16)", fence: "#b98a54", fenceD: "#8a6236", deco: ["#ff8fb6", "#fff0a0", "#ffffff"], rock: ["#a7a79e", "#7c7c74"], fx: "none", ink: "#2a4838" },
    { key: "spring", name: "벚꽃 언덕", sky: ["#ffc6dc", "#fff0f4"], hill: ["#f2a6c4", "#d98bb0"], a: "#b6e07a", b: "#a6d66c", speck: "rgba(90,130,40,0.15)", fence: "#a97a60", fenceD: "#7f5842", deco: ["#ffb6d0", "#ff8fb6", "#ffffff"], rock: ["#b0a5a2", "#857a78"], fx: "petal", ink: "#5a2f46" },
    { key: "autumn", name: "단풍 숲", sky: ["#ffb36b", "#ffe2b8"], hill: ["#d9772f", "#b35a22"], a: "#d7b25a", b: "#cda44c", speck: "rgba(120,70,20,0.18)", fence: "#8a5a34", fenceD: "#5f3c20", deco: ["#e8602c", "#f2a62e", "#a83a22"], rock: ["#a0927e", "#766a58"], fx: "leaf", ink: "#4a2c14" },
    { key: "snow", name: "눈 덮인 들판", sky: ["#a8d6f5", "#e8f6ff"], hill: ["#dcecf7", "#b9d3e6"], a: "#eef7fc", b: "#e0eef7", speck: "rgba(120,160,200,0.16)", fence: "#8e7a68", fenceD: "#675648", deco: ["#ffffff", "#bfe0f5", "#ff8f8f"], rock: ["#9fb0bd", "#74858f"], fx: "snow", ink: "#27425a" },
    { key: "night", name: "반딧불 밤", sky: ["#141c44", "#32407c"], hill: ["#1f3a4e", "#16283a"], a: "#2f5d55", b: "#28524b", speck: "rgba(0,20,20,0.26)", fence: "#4a3f58", fenceD: "#2f2838", deco: ["#a8fff0", "#ffe88a", "#c9b5ff"], rock: ["#5a6474", "#3e4654"], fx: "fly", ink: "#dfeee8" },
  ];

  /* ---------- 돌 배치 (가운데 줄 왼쪽 4칸부터는 비움 → 출발 자리) ---------- */
  const rect = (x, y, w, h) => {
    const out = [];
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) out.push([x + i, y + j]);
    return out;
  };
  const PATTERNS = [
    () => [],
    () => [...rect(2, 2, 3, 1), ...rect(2, 3, 1, 2), ...rect(10, 2, 3, 1), ...rect(12, 3, 1, 2), ...rect(2, 19, 3, 1), ...rect(2, 17, 1, 2), ...rect(10, 19, 3, 1), ...rect(12, 17, 1, 2)],
    () => [...rect(3, 3, 1, 6), ...rect(11, 3, 1, 6), ...rect(3, 13, 1, 6), ...rect(11, 13, 1, 6)],
    () => [...rect(3, 6, 9, 1), ...rect(3, 16, 9, 1)],
    () => [[3, 4], [7, 4], [11, 4], [3, 8], [7, 8], [11, 8], [3, 14], [7, 14], [11, 14], [3, 18], [7, 18], [11, 18]].flatMap(([x, y]) => rect(x, y, 2, 1)),
    () => [...rect(2, 3, 3, 1), ...rect(4, 4, 3, 1), ...rect(6, 5, 3, 1), ...rect(6, 17, 3, 1), ...rect(8, 18, 3, 1), ...rect(10, 19, 3, 1)],
    () => [...rect(7, 2, 1, 6), ...rect(7, 15, 1, 5), ...rect(1, 11, 2, 1), ...rect(13, 11, 1, 1)],
    () => [...rect(2, 6, 4, 1), ...rect(9, 6, 4, 1), ...rect(2, 16, 4, 1), ...rect(9, 16, 4, 1), ...rect(2, 7, 1, 2), ...rect(12, 7, 1, 2), ...rect(2, 14, 1, 2), ...rect(12, 14, 1, 2)],
    () => [...rect(2, 4, 8, 1), ...rect(5, 8, 8, 1), ...rect(2, 14, 8, 1), ...rect(5, 18, 8, 1)],
    () => [...rect(3, 6, 4, 1), ...rect(8, 6, 4, 1), ...rect(3, 16, 4, 1), ...rect(8, 16, 4, 1), ...rect(3, 7, 1, 3), ...rect(11, 7, 1, 3), ...rect(3, 13, 1, 3), ...rect(11, 13, 1, 3)],
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
    goal: Math.min(28, 6 + Math.floor(i * 0.7)),
    interval: Math.max(0.082, 0.185 * Math.pow(0.975, i)),
    goldRate: Math.min(0.26, 0.1 + i * 0.006),
    itemRate: i < 6 ? 0 : Math.min(0.2, 0.08 + i * 0.003),
    lives: i < 10 ? 3 : 4,
    pattern: i < 5 ? 0 : 1 + ((i - 5) % (PATTERNS.length - 1)),
    theme: Math.min(THEMES.length - 1, Math.floor(i / 10)),
  }));

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };
  const $ = (id) => document.getElementById(id);

  let state = "title";
  let endless = false;
  let stageIndex = 0;
  let score = 0;
  let stageStartedAt = 0;
  let best = 0;
  let saved = 0;
  let stageEaten = 0;
  let lives = 3;
  let livesLost = 0;
  let snake = []; // 꼬리 → 머리 (칸)
  let next = null; // 지금 향하는 칸
  let dir = DIRS.right; // 나가는 방향
  let dirIn = DIRS.right; // 지금 칸에 들어온 방향
  let dirQueue = [];
  let grow = 0;
  let waitT = 0; // 막혔을 때 기다린 시간
  let holdT = 0; // 출발 전 준비 시간
  let apple = null;
  let item = null;
  let walls = new Set();
  let moveAcc = 0;
  let moveInterval = 0.16;
  let slowT = 0;
  let combo = 0;
  let comboTimer = 0;
  let particles = [];
  let floats = [];
  let bulges = [];
  let ambient = [];
  let flash = 0;
  let shake = 0;
  let gulp = 0;
  let safeT = 0; // 다시 시작 직후 깜빡임
  let blinkT = 2;
  let tongueT = 3;
  let banner = null;
  let time = 0;
  let last = 0;
  let raf = 0;
  let swipeStart = null;
  let boardCanvas = null;
  let boardKey = "";
  let lastTheme = null;

  try {
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
    saved = Math.min(TOTAL_STAGES - 1, Number(localStorage.getItem(PROG_KEY)) || 0);
  } catch (_) {
    best = 0;
    saved = 0;
  }

  /* ---------- 소리 ---------- */
  let ac = null;
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
  function tone(freq, dur, type = "triangle", vol = 0.12, slide = 1, delay = 0) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  const sfx = {
    eat(n) {
      const f = 520 + Math.min(10, n) * 42;
      tone(f, 0.09, "triangle", 0.13, 1.5);
    },
    gold() {
      [880, 1175, 1568].forEach((f, i) => tone(f, 0.14, "triangle", 0.1, 1, i * 0.06));
    },
    item() {
      tone(660, 0.1, "sine", 0.13, 1.4);
      tone(990, 0.14, "sine", 0.1, 1, 0.08);
    },
    turn() {
      tone(240, 0.03, "sine", 0.03);
    },
    hit() {
      tone(170, 0.26, "sawtooth", 0.13, 0.4);
    },
    clear() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, "triangle", 0.12, 1, i * 0.1));
    },
    over() {
      [392, 330, 262].forEach((f, i) => tone(f, 0.3, "triangle", 0.11, 0.95, i * 0.15));
    },
  };

  /* ---------- 화면 · 저장 ---------- */
  function showOverlay(name) {
    Object.keys(overlays).forEach((k) => overlays[k].classList.toggle("hidden", k !== name));
  }
  function hideOverlays() {
    Object.keys(overlays).forEach((k) => overlays[k].classList.add("hidden"));
  }
  function saveBest() {
    if (score <= best) return;
    best = score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (_) {
      /* 저장소를 못 써도 게임은 계속 */
    }
  }
  function saveProgress() {
    if (stageIndex <= saved) return;
    saved = stageIndex;
    try {
      localStorage.setItem(PROG_KEY, String(saved));
    } catch (_) {
      /* 저장소를 못 써도 게임은 계속 */
    }
    paintContinue();
  }
  function paintContinue() {
    const b = $("continue-btn");
    if (!b) return;
    b.hidden = saved <= 0;
    b.textContent = `이어하기 · 스테이지 ${saved + 1}`;
  }
  function updateHud() {
    const st = endless ? null : STAGES[stageIndex];
    $("hud-stage").textContent = endless ? "∞" : String(stageIndex + 1);
    $("hud-score").textContent = String(score);
    $("hud-best").textContent = String(best);
    $("hud-goal").textContent = endless ? `${stageEaten}` : `${stageEaten} / ${st.goal}`;
    const pct = endless ? (stageEaten % 10) * 10 : Math.min(100, (stageEaten / st.goal) * 100);
    $("goal-fill").style.width = `${pct}%`;
    const el = $("hud-lives");
    const maxL = endless ? 3 : st.lives;
    if (el.childElementCount !== maxL) {
      el.innerHTML = "";
      for (let i = 0; i < maxL; i += 1) el.appendChild(document.createElement("span"));
    }
    [...el.children].forEach((d, i) => (d.className = "life" + (i < lives ? "" : " empty")));
  }
  const center = (x, y) => ({ x: OX + x * CELL + CELL / 2, y: OY + y * CELL + CELL / 2 });
  const key = (x, y) => x * 100 + y;
  const theme = () => (endless ? THEMES[Math.floor(stageEaten / 12) % THEMES.length] : THEMES[STAGES[stageIndex].theme]);

  /* ---------- 판 준비 ---------- */
  function setWalls(pattern) {
    walls = new Set();
    for (const [x, y] of PATTERNS[pattern]()) walls.add(key(x, y));
  }
  function resetSnake() {
    const sy = Math.floor(ROWS / 2);
    const sx = 6;
    snake = [
      { x: sx - 2, y: sy },
      { x: sx - 1, y: sy },
      { x: sx, y: sy },
    ];
    dir = DIRS.right;
    dirIn = DIRS.right;
    dirQueue = [];
    grow = 0;
    next = null;
    moveAcc = 0;
    waitT = 0;
    bulges = [];
  }
  function occupied(x, y) {
    return snake.some((s) => s.x === x && s.y === y);
  }
  /** 머리에서 닿을 수 있는 빈칸 */
  function reachable() {
    const head = snake[snake.length - 1];
    const seen = new Set([key(head.x, head.y)]);
    const out = [];
    const q = [head];
    while (q.length) {
      const c = q.shift();
      for (const d of [DIRS.up, DIRS.down, DIRS.left, DIRS.right]) {
        const nx = c.x + d.x;
        const ny = c.y + d.y;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        const k = key(nx, ny);
        if (seen.has(k) || walls.has(k) || occupied(nx, ny)) continue;
        seen.add(k);
        out.push({ x: nx, y: ny });
        q.push({ x: nx, y: ny });
      }
    }
    return out;
  }
  function freeSpot(avoid) {
    const head = snake[snake.length - 1];
    const open = reachable().filter((c) => !(avoid && avoid.x === c.x && avoid.y === c.y));
    const far = open.filter((c) => Math.abs(c.x - head.x) + Math.abs(c.y - head.y) >= 3);
    const list = far.length ? far : open;
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }
  function spawnApple() {
    const rate = endless ? Math.min(0.26, 0.12 + Math.floor(stageEaten / 12) * 0.02) : STAGES[stageIndex].goldRate;
    const c = freeSpot(item);
    if (!c) {
      apple = null;
      return;
    }
    const gold = Math.random() < rate;
    apple = { x: c.x, y: c.y, gold, t: 0, life: gold ? 7 : 0, wobble: Math.random() * 6 };
  }
  function maybeItem() {
    if (item) return;
    const rate = endless ? 0.12 : STAGES[stageIndex].itemRate;
    if (Math.random() >= rate) return;
    const c = freeSpot(apple);
    if (!c) return;
    const cut = snake.length > 12 && Math.random() < 0.5;
    item = { x: c.x, y: c.y, kind: cut ? "cut" : "slow", t: 0, life: 8 };
  }
  function startCommon() {
    moveAcc = 0;
    combo = 0;
    comboTimer = 0;
    particles = [];
    floats = [];
    flash = 0;
    shake = 0;
    item = null;
    slowT = 0;
    holdT = 0.9;
    safeT = 0;
    time = 0;
  }
  function resetStage() {
    stageStartedAt = performance.now();
    const st = STAGES[stageIndex];
    stageEaten = 0;
    lives = st.lives;
    livesLost = 0;
    moveInterval = st.interval;
    startCommon();
    setWalls(st.pattern);
    resetSnake();
    spawnApple();
    banner = { big: `STAGE ${stageIndex + 1}`, small: st.name, t: 1.3, life: 1.3 };
    ensureBoard();
    initAmbient();
    updateHud();
  }
  function resetEndless() {
    lives = 3;
    stageEaten = 0;
    moveInterval = 0.17;
    startCommon();
    setWalls(0);
    resetSnake();
    spawnApple();
    banner = { big: "무한 모드", small: "오래 살아남아요", t: 1.2, life: 1.2 };
    ensureBoard();
    initAmbient();
    updateHud();
  }
  function startGame(isEndless, fromStage) {
    endless = !!isEndless;
    stageIndex = fromStage || 0;
    score = 0;
    if (window.TodayGameRank) TodayGameRank.reset();
    hideOverlays();
    if (endless) resetEndless();
    else resetStage();
    state = "play";
    ensureLoop();
  }
  function ensureLoop() {
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- 효과 ---------- */
  const comboMult = () => (combo >= 12 ? 4 : combo >= 8 ? 3 : combo >= 4 ? 2 : 1);
  function burst(x, y, colors, n = 10, sp0 = 40, sp1 = 130) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = sp0 + Math.random() * (sp1 - sp0);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.35 + Math.random() * 0.4, max: 0.75, color: colors[i % colors.length], r: 1.6 + Math.random() * 3 });
    }
  }
  function addFloat(x, y, text, color, size = 18) {
    floats.push({ x, y, text, color, life: 0.9, vy: -46, size });
  }
  function initAmbient() {
    ambient = [];
    const fx = theme().fx;
    lastTheme = fx;
    if (fx === "none") return;
    const n = fx === "fly" ? 14 : 16;
    for (let i = 0; i < n; i += 1) ambient.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.8, p: Math.random() * 6.28 });
  }

  /* ---------- 움직임 ---------- */
  function head() {
    return snake[snake.length - 1];
  }
  /** 이 칸으로 갈 수 있나 (꼬리 칸은 곧 비므로 통과) */
  function blockedAt(x, y) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    if (walls.has(key(x, y))) return true;
    for (let i = grow > 0 ? 0 : 1; i < snake.length; i += 1) if (snake[i].x === x && snake[i].y === y) return true;
    return false;
  }
  function chooseNext() {
    const h = head();
    while (dirQueue.length) {
      const d = dirQueue[0];
      if (!blockedAt(h.x + d.x, h.y + d.y)) {
        dir = d;
        dirQueue.shift();
        break;
      }
      if (dirQueue.length === 1 && blockedAt(h.x + dir.x, h.y + dir.y)) break; // 둘 다 막힘 → 기다림
      dirQueue.shift();
    }
    const nx = h.x + dir.x;
    const ny = h.y + dir.y;
    next = blockedAt(nx, ny) ? null : { x: nx, y: ny };
  }
  function setDirection(d) {
    if (!d || state !== "play") return;
    audio();
    if (holdT > 0) holdT = 0;
    // 칸을 막 떠난 참이면 바로 꺾음 (누르는 대로 반응)
    if (next && !dirQueue.length && moveAcc / curInterval() < 0.24 && !(d.x === dir.x && d.y === dir.y) && !(dirIn.x + d.x === 0 && dirIn.y + d.y === 0)) {
      const h = head();
      if (!blockedAt(h.x + d.x, h.y + d.y)) {
        dir = d;
        next = { x: h.x + d.x, y: h.y + d.y };
        moveAcc *= 0.4;
        sfx.turn();
        return;
      }
    }
    const base = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if (base.x + d.x === 0 && base.y + d.y === 0) return;
    if (base.x === d.x && base.y === d.y) return;
    if (dirQueue.length >= 2) dirQueue[dirQueue.length - 1] = d;
    else dirQueue.push(d);
    sfx.turn();
  }
  const curInterval = () => moveInterval * (slowT > 0 ? 1.45 : 1);

  function arrive() {
    const n = next;
    snake.push({ x: n.x, y: n.y });
    dirIn = dir;
    if (grow > 0) grow -= 1;
    else snake.shift();
    next = null;
    if (apple && n.x === apple.x && n.y === apple.y) eatApple(n);
    if (state !== "play") return;
    if (item && n.x === item.x && n.y === item.y) eatItem(n);
  }
  function eatApple(n) {
    combo += 1;
    comboTimer = 2.6;
    const mult = comboMult();
    const gain = (apple.gold ? 15 : 5) * mult;
    score += gain;
    stageEaten += 1;
    grow += 1;
    gulp = 1;
    bulges.push({ d: 0 });
    const c = center(n.x, n.y);
    burst(c.x, c.y, apple.gold ? ["#ffe27a", "#fff6c0", "#ffb52e"] : ["#ff6b6b", "#ffd0c8", "#7fd34e"], apple.gold ? 20 : 12);
    addFloat(c.x, c.y - 14, mult > 1 ? `+${gain} x${mult}` : `+${gain}`, apple.gold ? "#ffe27a" : "#fff");
    if (apple.gold) sfx.gold();
    else sfx.eat(combo);
    saveBest();
    if (endless) {
      moveInterval = Math.max(0.082, moveInterval - 0.0022);
      if (stageEaten % 12 === 0) {
        banner = { big: "속도 UP!", small: theme().name, t: 1, life: 1 };
        ensureBoard();
        initAmbient();
      }
    } else if (stageEaten >= STAGES[stageIndex].goal) {
      updateHud();
      stageClear();
      return;
    }
    updateHud();
    apple = null;
    maybeItem();
    spawnApple();
  }
  function eatItem(n) {
    const c = center(n.x, n.y);
    if (item.kind === "slow") {
      slowT = 5;
      addFloat(c.x, c.y - 14, "느려져요!", "#9fd8ff");
      burst(c.x, c.y, ["#7fc4ff", "#d0ecff"], 14);
    } else {
      const cut = Math.min(4, snake.length - 3);
      if (cut > 0) snake.splice(0, cut);
      addFloat(c.x, c.y - 14, `꼬리 -${cut}`, "#ffb0e0");
      burst(c.x, c.y, ["#ff9ad6", "#ffe0f2"], 14);
    }
    score += 10;
    item = null;
    sfx.item();
    updateHud();
  }
  function die(reason) {
    lives -= 1;
    livesLost += 1;
    combo = 0;
    comboTimer = 0;
    flash = 0.4;
    shake = 0.34;
    const h = head();
    const c = center(h.x, h.y);
    burst(c.x, c.y, ["#ff7eb6", "#ffd0e0", "#ffffff"], 20, 60, 190);
    addFloat(c.x, c.y - 20, reason || "쿵!", "#ffc0d4", 22);
    sfx.hit();
    updateHud();
    if (navigator.vibrate) navigator.vibrate(60);
    if (lives <= 0) {
      saveBest();
      state = "over";
      $("over-detail").textContent = endless ? `무한 모드 · 점수 ${score} · 최고 ${best}` : `스테이지 ${stageIndex + 1} ${STAGES[stageIndex].name} · 점수 ${score} · 최고 ${best}`;
      showOverlay("over");
      sfx.over();
      if (window.TodayGameRank) {
        TodayGameRank.mount({ gameId: "snake", gameTitle: "애플 스네이크", formParent: overlays.over });
        TodayGameRank.open(score);
      }
      return;
    }
    resetSnake();
    if (apple && occupied(apple.x, apple.y)) spawnApple();
    if (item && occupied(item.x, item.y)) item = null;
    holdT = 1.1;
    safeT = 1.1;
    banner = { big: "다시 출발!", small: "방향을 누르면 바로 가요", t: 1.1, life: 1.1 };
  }
  function stageClear() {
    const elapsed = (performance.now() - stageStartedAt) / 1000;
    score += Math.max(0, Math.floor(30 - elapsed)) * 6 + lives * 30;
    saveBest();
    updateHud();
    state = "clear";
    sfx.clear();
    if (stageIndex >= TOTAL_STAGES - 1) {
      $("all-detail").textContent = `총 ${score}점 · 최고 기록 ${best}점!`;
      showOverlay("all");
      if (window.TodayGameRank) {
        TodayGameRank.mount({ gameId: "snake", gameTitle: "애플 스네이크", formParent: overlays.all });
        TodayGameRank.open(score);
      }
      return;
    }
    const stars = livesLost === 0 ? 3 : livesLost === 1 ? 2 : 1;
    $("clear-stars").innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? "on" : ""}" style="animation-delay:${0.1 + i * 0.16}s">★</span>`).join("");
    const nextTheme = STAGES[stageIndex + 1].theme !== STAGES[stageIndex].theme ? ` · 다음은 ${THEMES[STAGES[stageIndex + 1].theme].name}!` : "";
    $("clear-detail").textContent = `${STAGES[stageIndex].name} · 점수 ${score}${nextTheme}`;
    const center0 = center(head().x, head().y);
    burst(center0.x, center0.y, ["#ffe27a", "#ff7eb6", "#7aefb0"], 30, 60, 240);
    stageIndex += 1;
    saveProgress();
    stageIndex -= 1;
    showOverlay("clear");
  }
  function nextStage() {
    hideOverlays();
    stageIndex += 1;
    resetStage();
    state = "play";
    ensureLoop();
  }

  function update(dt) {
    time += dt;
    // 떠다니는 것
    updateFx(dt);
    if (state !== "play") return;
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    flash = Math.max(0, flash - dt);
    shake = Math.max(0, shake - dt);
    gulp = Math.max(0, gulp - dt * 4);
    slowT = Math.max(0, slowT - dt);
    safeT = Math.max(0, safeT - dt);
    // 몸이 길어 닿을 빈칸이 없었으면 자리가 나는 대로 다시
    if (!apple) spawnApple();
    if (apple) {
      apple.wobble += dt * 3.2;
      apple.t += dt;
      if (apple.gold && apple.t > apple.life) {
        // 황금 사과는 시간이 지나면 보통 사과로
        apple.gold = false;
      }
    }
    if (item) {
      item.t += dt;
      if (item.t > item.life) item = null;
    }
    blinkT -= dt;
    if (blinkT < -0.12) blinkT = 1.6 + Math.random() * 2.6;
    tongueT -= dt;
    if (tongueT < -0.35) tongueT = 1.8 + Math.random() * 3;
    for (const b of bulges) b.d += (dt * CELL * 2.4) / Math.max(0.09, curInterval());
    bulges = bulges.filter((b) => b.d < snake.length * CELL + 20);
    if (holdT > 0) {
      holdT -= dt;
      return;
    }
    advance(dt);
  }
  function advance(dt) {
    if (!next) {
      chooseNext();
      if (!next) {
        waitT += dt;
        if (waitT >= GRACE) {
          const h = head();
          const nx = h.x + dir.x;
          const ny = h.y + dir.y;
          const wall = nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS;
          die(wall ? "벽에 쿵!" : walls.has(key(nx, ny)) ? "돌에 쿵!" : "몸에 쿵!");
        }
        return;
      }
      waitT = 0;
    }
    moveAcc += dt;
    let guard = 0;
    while (moveAcc >= curInterval() && guard < 6) {
      guard += 1;
      moveAcc -= curInterval();
      arrive();
      if (state !== "play") return;
      chooseNext();
      if (!next) {
        moveAcc = 0;
        return;
      }
    }
  }
  function updateFx(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      p.vx *= 1 - dt * 1.5;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floats) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 1 - dt * 2.5;
    }
    floats = floats.filter((f) => f.life > 0);
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }
    const fx = lastTheme;
    for (const a of ambient) {
      a.p += dt;
      if (fx === "snow") {
        a.y += dt * 26 * a.s;
        a.x += Math.sin(a.p) * dt * 12;
      } else if (fx === "petal" || fx === "leaf") {
        a.y += dt * 30 * a.s;
        a.x += (Math.sin(a.p * 1.3) * 22 + 12) * dt;
      } else if (fx === "fly") {
        a.x += Math.sin(a.p * 0.9 + a.s * 6) * dt * 20;
        a.y += Math.cos(a.p * 0.7 + a.s * 4) * dt * 16;
      }
      if (a.y > H + 10) a.y = -10;
      if (a.x > W + 10) a.x = -10;
      if (a.x < -10) a.x = W + 10;
      if (a.y < -10) a.y = H + 10;
    }
  }

  /* ---------- 판 그림 (미리 그려 둠) ---------- */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function seeded(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  }
  function drawRock(g, x, y, T, r) {
    const c = center(x, y);
    const R = CELL * 0.48;
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.beginPath();
    g.ellipse(c.x + 1, c.y + R * 0.72, R * 0.95, R * 0.34, 0, 0, Math.PI * 2);
    g.fill();
    // 울퉁불퉁한 돌
    const pts = [];
    const n = 9;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.82 + r() * 0.2;
      pts.push([c.x + Math.cos(a) * R * k, c.y + Math.sin(a) * R * k * 0.92]);
    }
    g.beginPath();
    pts.forEach(([px, py], i) => {
      const [qx, qy] = pts[(i + 1) % n];
      const mx = (px + qx) / 2;
      const my = (py + qy) / 2;
      if (i === 0) g.moveTo(mx, my);
      else g.quadraticCurveTo(px, py, mx, my);
    });
    g.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    g.closePath();
    const gr = g.createLinearGradient(c.x, c.y - R, c.x, c.y + R);
    gr.addColorStop(0, T.rock[0]);
    gr.addColorStop(1, T.rock[1]);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.28)";
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.beginPath();
    g.ellipse(c.x - R * 0.26, c.y - R * 0.34, R * 0.32, R * 0.15, -0.4, 0, Math.PI * 2);
    g.fill();
    if (T.key === "snow") {
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.beginPath();
      g.ellipse(c.x, c.y - R * 0.5, R * 0.62, R * 0.26, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = "rgba(90,130,60,0.55)";
      g.beginPath();
      g.ellipse(c.x + R * 0.28, c.y + R * 0.38, R * 0.3, R * 0.13, 0.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  function ensureBoard() {
    const T = theme();
    const pat = endless ? 0 : STAGES[stageIndex].pattern;
    const k = `${T.key}-${pat}-${dpr}`;
    if (boardKey === k && boardCanvas) return;
    boardKey = k;
    const c = boardCanvas || document.createElement("canvas");
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    boardCanvas = c;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = seeded(1234 + pat * 7 + T.key.length * 31);
    // 하늘
    const sky = g.createLinearGradient(0, 0, 0, OY + 40);
    sky.addColorStop(0, T.sky[0]);
    sky.addColorStop(1, T.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // 멀리 언덕 두 겹
    for (let k2 = 0; k2 < 2; k2 += 1) {
      g.fillStyle = T.hill[k2];
      g.globalAlpha = k2 === 0 ? 0.65 : 1;
      g.beginPath();
      g.moveTo(0, OY);
      const base = OY - 30 + k2 * 16;
      for (let x = 0; x <= W; x += 30) g.lineTo(x, base - Math.sin(x * 0.018 + k2 * 2.1) * (16 - k2 * 5) - Math.sin(x * 0.05 + k2) * 4);
      g.lineTo(W, OY);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = T.hill[1];
    g.fillRect(0, OY - 4, W, H);
    // 칸 무늬 + 풀 결
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        g.fillStyle = (x + y) % 2 === 0 ? T.a : T.b;
        g.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
      }
    }
    for (let i = 0; i < 900; i += 1) {
      g.fillStyle = T.speck;
      const x = OX + r() * GW;
      const y = OY + r() * GH;
      g.fillRect(x, y, 1 + r() * 1.4, 2 + r() * 3);
    }
    // 작은 꽃 · 무늬 (돌 없는 칸)
    for (let i = 0; i < 26; i += 1) {
      const x = OX + r() * GW;
      const y = OY + r() * GH;
      const col = T.deco[Math.floor(r() * T.deco.length)];
      g.globalAlpha = 0.72;
      g.fillStyle = col;
      if (T.key === "snow") {
        g.beginPath();
        g.arc(x, y, 1.2 + r() * 1.4, 0, Math.PI * 2);
        g.fill();
      } else if (T.key === "autumn") {
        g.save();
        g.translate(x, y);
        g.rotate(r() * 6);
        g.beginPath();
        g.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      } else {
        for (let k3 = 0; k3 < 5; k3 += 1) {
          const a = (k3 / 5) * Math.PI * 2;
          g.beginPath();
          g.arc(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.6, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "#ffd84a";
        g.beginPath();
        g.arc(x, y, 1.3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    // 판 안쪽 그늘 (가장자리)
    const inner = g.createRadialGradient(W / 2, OY + GH / 2, GH * 0.3, W / 2, OY + GH / 2, GH * 0.72);
    inner.addColorStop(0, "rgba(0,0,0,0)");
    inner.addColorStop(1, "rgba(0,0,0,0.14)");
    g.fillStyle = inner;
    g.fillRect(OX, OY, GW, GH);
    // 나무 울타리 틀
    const f = 6;
    g.fillStyle = T.fenceD;
    roundRect(g, OX - f - 1, OY - f - 1, GW + f * 2 + 2, GH + f * 2 + 3, 9);
    g.fill();
    g.save();
    roundRect(g, OX - f, OY - f, GW + f * 2, GH + f * 2, 8);
    g.clip();
    g.fillStyle = T.fence;
    g.fillRect(OX - f, OY - f, GW + f * 2, GH + f * 2);
    g.fillStyle = "rgba(0,0,0,0.13)";
    for (let x = OX - f; x < OX + GW + f; x += 12) g.fillRect(x, OY - f, 1, GH + f * 2);
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.fillRect(OX - f, OY - f, GW + f * 2, 2);
    g.restore();
    // 판 다시 (틀 안쪽 비움)
    g.save();
    g.beginPath();
    g.rect(OX, OY, GW, GH);
    g.clip();
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        g.fillStyle = (x + y) % 2 === 0 ? T.a : T.b;
        g.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
      }
    }
    const r2 = seeded(777 + pat);
    for (let i = 0; i < 900; i += 1) {
      g.fillStyle = T.speck;
      g.fillRect(OX + r2() * GW, OY + r2() * GH, 1 + r2() * 1.4, 2 + r2() * 3);
    }
    for (let i = 0; i < 22; i += 1) {
      const x = OX + r2() * GW;
      const y = OY + r2() * GH;
      g.globalAlpha = 0.72;
      g.fillStyle = T.deco[Math.floor(r2() * T.deco.length)];
      for (let k3 = 0; k3 < 5; k3 += 1) {
        const a = (k3 / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.5, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.fillStyle = inner;
    g.fillRect(OX, OY, GW, GH);
    // 위쪽 틀이 드리운 그늘
    const sh = g.createLinearGradient(0, OY, 0, OY + 12);
    sh.addColorStop(0, "rgba(0,0,0,0.24)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh;
    g.fillRect(OX, OY, GW, 12);
    g.restore();
    // 돌
    const r3 = seeded(99 + pat * 3);
    const list = PATTERNS[pat]();
    for (const [x, y] of list) drawRock(g, x, y, T, r3);
  }

  /* ---------- 뱀 그림 ---------- */
  const SKIN = {
    meadow: { o: "#2f8a55", m: "#59cf86", h: "#a6f0c0", s: "#3aa86a", belly: "#c8f7d4" },
    spring: { o: "#2f8a6e", m: "#5fd2a8", h: "#b0f2d8", s: "#3bab86", belly: "#d4f9e8" },
    autumn: { o: "#3d6e2a", m: "#79b84a", h: "#c0e590", s: "#578f33", belly: "#e0f2b8" },
    snow: { o: "#2a6f8f", m: "#4fb4dc", h: "#a8e4fb", s: "#338fb8", belly: "#d0f2ff" },
    night: { o: "#6d3a9c", m: "#a768e0", h: "#dcb6ff", s: "#8246be", belly: "#ecd8ff" },
  };
  /** 몸의 중심선: 꼬리 → 머리 (모서리는 둥글게) */
  function bodyPath() {
    const t = next ? Math.min(1, moveAcc / curInterval()) : 0;
    const pts = [];
    const n = snake.length;
    const cs = snake.map((s) => center(s.x, s.y));
    // 꼬리: 다음 칸으로 다가가는 중 (자라는 중이면 그대로)
    const tail = grow > 0 || !next ? cs[0] : { x: cs[0].x + (cs[1].x - cs[0].x) * t, y: cs[0].y + (cs[1].y - cs[0].y) * t };
    const headPos = next ? (() => { const nc = center(next.x, next.y); const hc = cs[n - 1]; return { x: hc.x + (nc.x - hc.x) * t, y: hc.y + (nc.y - hc.y) * t }; })() : cs[n - 1];
    pts.push(tail);
    const add = (x, y) => pts.push({ x, y });
    for (let i = 1; i < n; i += 1) {
      const p = cs[i];
      const a = cs[i - 1];
      const b = i === n - 1 ? headPos : cs[i + 1];
      const dax = p.x - a.x;
      const day = p.y - a.y;
      const dbx = b.x - p.x;
      const dby = b.y - p.y;
      const straight = Math.abs(dax * dby - day * dbx) < 0.01;
      if (straight || (dbx === 0 && dby === 0)) {
        add(p.x, p.y);
      } else {
        // 모서리: 칸 안에서 둥글게 돌아감
        const la = Math.hypot(dax, day) || 1;
        const lb = Math.hypot(dbx, dby) || 1;
        const rr = Math.min(CELL * 0.5, lb, la * 0.5);
        const sx = p.x - (dax / la) * rr;
        const sy = p.y - (day / la) * rr;
        const ex = p.x + (dbx / lb) * rr;
        const ey = p.y + (dby / lb) * rr;
        for (let k = 0; k <= 4; k += 1) {
          const u = k / 4;
          const v = 1 - u;
          add(v * v * sx + 2 * v * u * p.x + u * u * ex, v * v * sy + 2 * v * u * p.y + u * u * ey);
        }
      }
    }
    pts.push(headPos);
    return pts;
  }
  /** 머리에서 d 만큼 뒤 위치 */
  function pointBack(pts, d) {
    let left = d;
    for (let i = pts.length - 1; i > 0; i -= 1) {
      const a = pts[i];
      const b = pts[i - 1];
      const l = Math.hypot(a.x - b.x, a.y - b.y);
      if (l >= left && l > 0) {
        const k = left / l;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
      left -= l;
    }
    return null;
  }
  function strokePath(pts, from, width, color, dash) {
    if (pts.length - from < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[from].x, pts[from].y);
    for (let i = from + 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }
  function drawSnake() {
    const T = theme();
    const S = SKIN[T.key];
    const pts = bodyPath();
    if (pts.length < 2) return;
    // 깜빡임 (다시 시작 직후)
    if (safeT > 0 && Math.floor(time * 10) % 2 === 0) ctx.globalAlpha = 0.55;
    const w = CELL * 0.78;
    // 꼬리 끝 쪽은 원으로 가늘게
    let total = 0;
    const lens = [0];
    for (let i = 1; i < pts.length; i += 1) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      lens.push(total);
    }
    const taper = Math.min(CELL * 2.4, total * 0.55);
    let from = 0;
    while (from < pts.length - 2 && lens[from] < taper) from += 1;
    const circles = [];
    const stepLen = 3;
    let idx = 0;
    for (let d = 0; d <= lens[from]; d += stepLen) {
      while (idx < lens.length - 2 && lens[idx + 1] < d) idx += 1;
      const seg = lens[idx + 1] - lens[idx] || 1;
      const k = (d - lens[idx]) / seg;
      circles.push({ x: pts[idx].x + (pts[idx + 1].x - pts[idx].x) * k, y: pts[idx].y + (pts[idx + 1].y - pts[idx].y) * k, r: (w / 2) * (0.38 + 0.62 * (d / Math.max(1, lens[from]))) });
    }
    const paintCircles = (extra, color, oy = 0) => {
      ctx.fillStyle = color;
      for (const c of circles) {
        ctx.beginPath();
        ctx.arc(c.x, c.y + oy, Math.max(0.5, c.r + extra), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    // 그림자
    ctx.save();
    ctx.translate(1.5, 4);
    paintCircles(0, "rgba(0,0,0,0.16)");
    strokePath(pts, from, w, "rgba(0,0,0,0.16)");
    ctx.restore();
    // 윤곽 → 몸 → 배쪽 → 무늬 → 윤기
    paintCircles(1.6, S.o);
    strokePath(pts, from, w + 3.2, S.o);
    // 삼킨 사과 불룩
    for (const b of bulges) {
      const p = pointBack(pts, b.d + CELL * 0.6);
      if (!p) continue;
      ctx.fillStyle = S.o;
      ctx.beginPath();
      ctx.arc(p.x, p.y, w * 0.68 + 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    paintCircles(0, S.m);
    strokePath(pts, from, w, S.m);
    for (const b of bulges) {
      const p = pointBack(pts, b.d + CELL * 0.6);
      if (!p) continue;
      ctx.fillStyle = S.m;
      ctx.beginPath();
      ctx.arc(p.x, p.y, w * 0.68, 0, Math.PI * 2);
      ctx.fill();
    }
    // 등 무늬 (둥근 점 · 몸에 붙어 같이 움직임)
    strokePath(pts, from, w * 0.42, S.s, [0.1, CELL * 0.92]);
    // 윤기
    ctx.save();
    ctx.translate(-w * 0.13, -w * 0.17);
    strokePath(pts, from, w * 0.2, S.h);
    ctx.restore();
    ctx.globalAlpha = 1;
    drawHead(pts, S);
  }
  function drawHead(pts, S) {
    const p = pts[pts.length - 1];
    // 방향: 마지막 구간 (거의 멈춰 있으면 지금 방향)
    let ang = Math.atan2(dir.y, dir.x);
    const q = pts[Math.max(0, pts.length - 3)];
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    if (Math.hypot(dx, dy) > 1.5) ang = Math.atan2(dy, dx);
    const R = CELL * 0.58 * (1 + gulp * 0.12);
    const near = apple ? Math.hypot(center(apple.x, apple.y).x - p.x, center(apple.x, apple.y).y - p.y) : 999;
    const mouth = near < CELL * 2.3 ? Math.min(1, (CELL * 2.3 - near) / (CELL * 1.2)) : gulp;
    ctx.save();
    if (safeT > 0 && Math.floor(time * 10) % 2 === 0) ctx.globalAlpha = 0.55;
    ctx.translate(p.x, p.y);
    // 그림자
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.ellipse(1.5, 4, R * 1.02, R * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(ang);
    // 혀
    if (tongueT < 0 && mouth < 0.3) {
      ctx.strokeStyle = "#ff4f7a";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(R * 0.9, 0);
      ctx.lineTo(R * 1.45, 0);
      ctx.moveTo(R * 1.45, 0);
      ctx.lineTo(R * 1.7, -3);
      ctx.moveTo(R * 1.45, 0);
      ctx.lineTo(R * 1.7, 3);
      ctx.stroke();
    }
    // 머리
    ctx.fillStyle = S.o;
    ctx.beginPath();
    ctx.ellipse(R * 0.06, 0, R * 1.08 + 1.4, R * 0.94 + 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    const hg = ctx.createRadialGradient(-R * 0.1, -R * 0.42, R * 0.1, 0, 0, R * 1.2);
    hg.addColorStop(0, S.h);
    hg.addColorStop(0.55, S.m);
    hg.addColorStop(1, S.s);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(R * 0.06, 0, R * 1.08, R * 0.94, 0, 0, Math.PI * 2);
    ctx.fill();
    // 입
    if (mouth > 0.05) {
      ctx.fillStyle = "#7a2440";
      ctx.beginPath();
      ctx.ellipse(R * 0.72, 0, R * 0.34 * mouth + 1, R * 0.52 * mouth, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8fa8";
      ctx.beginPath();
      ctx.ellipse(R * 0.68, 0, R * 0.2 * mouth, R * 0.28 * mouth, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = S.o;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(R * 0.72, 0, R * 0.28, -0.8, 0.8);
      ctx.stroke();
    }
    ctx.restore();
    // 얼굴 켜기 (내 얼굴로 플레이)
    if (window.TodayFace && TodayFace.drawHead(ctx, p.x, p.y, CELL * 0.42)) return;
    // 눈: 사과를 쳐다봄
    ctx.save();
    ctx.translate(p.x, p.y);
    const look = apple ? Math.atan2(center(apple.x, apple.y).y - p.y, center(apple.x, apple.y).x - p.x) : ang;
    const ex = Math.cos(ang);
    const ey = Math.sin(ang);
    const nx = -ey;
    const ny = ex;
    for (const s of [-1, 1]) {
      const cx = ex * R * 0.3 + nx * s * R * 0.48;
      const cy = ey * R * 0.3 + ny * s * R * 0.48;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      if (blinkT < 0) {
        ctx.strokeStyle = "#3a2850";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx - nx * R * 0.26, cy - ny * R * 0.26);
        ctx.lineTo(cx + nx * R * 0.26, cy + ny * R * 0.26);
        ctx.stroke();
      } else {
        const px = cx + Math.cos(look) * R * 0.12;
        const py = cy + Math.sin(look) * R * 0.12;
        ctx.fillStyle = "#2c2040";
        ctx.beginPath();
        ctx.arc(px, py, R * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(px - R * 0.06, py - R * 0.08, R * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      // 볼
      ctx.fillStyle = "rgba(255,120,150,0.3)";
      ctx.beginPath();
      ctx.arc(ex * R * 0.62 + nx * s * R * 0.62, ey * R * 0.62 + ny * s * R * 0.62, R * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- 사과 · 아이템 ---------- */
  function drawAppleShape(x, y, r, gold) {
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.08, 0, 0, r * 1.15);
    if (gold) {
      g.addColorStop(0, "#fffbd0");
      g.addColorStop(0.45, "#ffd650");
      g.addColorStop(1, "#d98e10");
    } else {
      g.addColorStop(0, "#ffb3a6");
      g.addColorStop(0.45, "#f0404a");
      g.addColorStop(1, "#b0182e");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.bezierCurveTo(r * 0.5, -r * 1.08, r * 1.18, -r * 0.7, r * 1.04, 0.02 * r);
    ctx.bezierCurveTo(r * 0.96, r * 0.74, r * 0.46, r * 1.14, 0, r * 0.92);
    ctx.bezierCurveTo(-r * 0.46, r * 1.14, -r * 0.96, r * 0.74, -r * 1.04, 0.02 * r);
    ctx.bezierCurveTo(-r * 1.18, -r * 0.7, -r * 0.5, -r * 1.08, 0, -r * 0.72);
    ctx.fill();
    ctx.strokeStyle = gold ? "#a86a08" : "#7e1022";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 꼭지 · 잎
    ctx.strokeStyle = "#6b4426";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.04, -r * 1.05, r * 0.16, -r * 1.2);
    ctx.stroke();
    ctx.fillStyle = "#6cc544";
    ctx.beginPath();
    ctx.moveTo(r * 0.12, -r * 0.92);
    ctx.quadraticCurveTo(r * 0.6, -r * 1.4, r * 0.92, -r * 0.98);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.7, r * 0.12, -r * 0.92);
    ctx.fill();
    // 윤기
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.44, -r * 0.34, r * 0.2, r * 0.32, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawApple() {
    if (!apple) return;
    const c = center(apple.x, apple.y);
    const bob = Math.sin(apple.wobble) * 1.8;
    const r = CELL * 0.38 * (1 + Math.sin(apple.wobble * 1.3) * 0.03);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + CELL * 0.36, r * (0.86 - bob * 0.02), r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (apple.gold) {
      const glow = ctx.createRadialGradient(c.x, c.y + bob, 3, c.x, c.y + bob, CELL * 0.95);
      glow.addColorStop(0, "rgba(255,226,110,0.65)");
      glow.addColorStop(1, "rgba(255,226,110,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, CELL * 0.95, 0, Math.PI * 2);
      ctx.fill();
      // 남은 시간 고리
      const k = Math.max(0, 1 - apple.t / apple.life);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, CELL * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
    }
    drawAppleShape(c.x, c.y + bob, r, apple.gold);
  }
  function drawItem() {
    if (!item) return;
    const c = center(item.x, item.y);
    const bob = Math.sin(time * 3.4) * 1.6;
    const fade = item.life - item.t < 2 && Math.floor(time * 8) % 2 === 0 ? 0.5 : 1;
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + CELL * 0.36, CELL * 0.3, CELL * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    const y = c.y + bob;
    if (item.kind === "slow") {
      // 파란 열매 세 알
      for (const [dx, dy] of [
        [-CELL * 0.17, CELL * 0.08],
        [CELL * 0.17, CELL * 0.08],
        [0, -CELL * 0.17],
      ]) {
        const g = ctx.createRadialGradient(c.x + dx - 2, y + dy - 2, 1, c.x + dx, y + dy, CELL * 0.2);
        g.addColorStop(0, "#d6efff");
        g.addColorStop(0.5, "#4e9dff");
        g.addColorStop(1, "#2256c0");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x + dx, y + dy, CELL * 0.19, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#58b84a";
      ctx.beginPath();
      ctx.ellipse(c.x + 3, y - CELL * 0.36, CELL * 0.14, CELL * 0.07, -0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 버섯
      ctx.fillStyle = "#f5e8d4";
      roundRect(ctx, c.x - CELL * 0.13, y - CELL * 0.03, CELL * 0.26, CELL * 0.34, 4);
      ctx.fill();
      const g = ctx.createLinearGradient(0, y - CELL * 0.4, 0, y + CELL * 0.04);
      g.addColorStop(0, "#ff7fc4");
      g.addColorStop(1, "#c93a8a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c.x - CELL * 0.38, y + CELL * 0.04);
      ctx.quadraticCurveTo(c.x, y - CELL * 0.68, c.x + CELL * 0.38, y + CELL * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      for (const [dx, dy, rr] of [
        [-0.14, -0.1, 0.07],
        [0.12, -0.16, 0.08],
        [0.02, -0.02, 0.05],
      ]) {
        ctx.beginPath();
        ctx.arc(c.x + dx * CELL, y + dy * CELL, rr * CELL, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 그리기 ---------- */
  function drawAmbient() {
    const fx = lastTheme;
    if (!ambient.length) return;
    for (const a of ambient) {
      if (fx === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.2 + a.s, 0, Math.PI * 2);
        ctx.fill();
      } else if (fx === "petal" || fx === "leaf") {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.p);
        ctx.fillStyle = fx === "petal" ? "rgba(255,175,205,0.9)" : a.s > 1 ? "rgba(226,104,44,0.9)" : "rgba(240,170,50,0.9)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 4 * a.s + 1, 2 * a.s + 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (fx === "fly") {
        const k = 0.5 + Math.sin(a.p * 2.4) * 0.5;
        ctx.fillStyle = `rgba(210,255,150,${0.16 * k})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(240,255,190,${0.35 + 0.6 * k})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
    if (boardCanvas) ctx.drawImage(boardCanvas, 0, 0, W, H);
    const T = theme();
    drawItem();
    drawApple();
    if (snake.length > 1) drawSnake();
    drawAmbient();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.4));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.font = `bold ${f.size}px Jua`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(40,30,50,0.65)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (combo >= 2 && comboTimer > 0) {
      ctx.globalAlpha = Math.min(1, comboTimer);
      ctx.font = "26px 'Bagel Fat One', Jua";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(40,30,50,0.55)";
      ctx.strokeText(`${combo} COMBO`, W / 2, OY + 34);
      ctx.fillStyle = combo >= 8 ? "#ffe27a" : combo >= 4 ? "#ff9ac6" : "#9dffe0";
      ctx.fillText(`${combo} COMBO`, W / 2, OY + 34);
      ctx.globalAlpha = 1;
    }
    if (slowT > 0) {
      ctx.fillStyle = "rgba(90,170,255,0.09)";
      ctx.fillRect(OX, OY, GW, GH);
      ctx.font = "13px Jua";
      ctx.fillStyle = T.key === "night" ? "#cfe8ff" : "#215f9e";
      ctx.fillText(`느림 ${slowT.toFixed(1)}초`, W / 2, OY + GH - 10);
    }
    if (banner && state === "play") {
      const a = Math.min(1, banner.t * 3, (banner.life - banner.t) * 6 + 0.2);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "rgba(25,22,40,0.5)";
      roundRect(ctx, W / 2 - 138, OY + GH * 0.27, 276, 78, 16);
      ctx.fill();
      ctx.font = "32px 'Bagel Fat One', Jua";
      ctx.fillStyle = "#fff";
      ctx.fillText(banner.big, W / 2, OY + GH * 0.27 + 38);
      ctx.font = "15px Jua";
      ctx.fillStyle = "#ffe8a8";
      ctx.fillText(banner.small, W / 2, OY + GH * 0.27 + 63);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,70,110,${flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  function loop(t) {
    const dt = Math.max(0, Math.min(0.05, (t - last) / 1000 || 0.016));
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- 입력 ---------- */
  const SWIPE_MIN = 16;
  function applySwipeDelta(dx, dy) {
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return false;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? DIRS.right : DIRS.left);
    else setDirection(dy > 0 ? DIRS.down : DIRS.up);
    return true;
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    swipeStart = { x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* 없어도 됨 */
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!swipeStart || state !== "play") return;
    if (applySwipeDelta(e.clientX - swipeStart.x, e.clientY - swipeStart.y)) swipeStart = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (swipeStart) {
      applySwipeDelta(e.clientX - swipeStart.x, e.clientY - swipeStart.y);
      swipeStart = null;
    }
  });
  canvas.addEventListener("pointercancel", () => {
    swipeStart = null;
  });
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key) && state !== "title") e.preventDefault();
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      if (state === "clear" && stageIndex < TOTAL_STAGES - 1) {
        nextStage();
        return;
      }
    }
    if (e.repeat) return;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") setDirection(DIRS.up);
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") setDirection(DIRS.down);
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") setDirection(DIRS.left);
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") setDirection(DIRS.right);
  });

  $("start-btn").addEventListener("click", () => {
    audio();
    startGame(false, 0);
  });
  $("continue-btn").addEventListener("click", () => {
    audio();
    startGame(false, saved);
  });
  $("endless-btn").addEventListener("click", () => {
    audio();
    startGame(true, 0);
  });
  $("next-btn").addEventListener("click", nextStage);
  $("retry-btn").addEventListener("click", () => {
    hideOverlays();
    if (window.TodayGameRank) TodayGameRank.reset();
    score = 0;
    if (endless) resetEndless();
    else resetStage();
    state = "play";
    ensureLoop();
  });
  $("again-btn").addEventListener("click", () => startGame(false, 0));

  /* ---------- 시작 ---------- */
  setWalls(0);
  resetSnake();
  spawnApple();
  updateHud();
  ensureBoard();
  initAmbient();
  paintContinue();
  showOverlay("title");
  ensureLoop();

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: "snake", gameTitle: "애플 스네이크", formParent: overlays.over || overlays.all || document.body });
  }
  if (window.TodayPause) {
    TodayPause.mount({
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

  /* ---------- 점검용 ---------- */
  window.AppleSnake = {
    start: (stage) => startGame(false, stage),
    get state() {
      return state;
    },
    get stage() {
      return stageIndex;
    },
    get eaten() {
      return stageEaten;
    },
    get lives() {
      return lives;
    },
    get snake() {
      return snake;
    },
    get apple() {
      return apple;
    },
    get dir() {
      return dir;
    },
    get next() {
      return next;
    },
    get score() {
      return score;
    },
    goal: (i) => STAGES[i].goal,
    interval: (i) => STAGES[i].interval,
    isWall: (x, y) => walls.has(key(x, y)),
    COLS,
    ROWS,
    DIRS,
    setDirection,
    next_: nextStage,
    tick(dt) {
      update(dt);
    },
    draw,
    pauseLoop() {
      cancelAnimationFrame(raf);
    },
    /** 돌 배치가 판을 가르지 않는지 (빈칸이 모두 이어져 있는지) */
    patternConnected(i) {
      const ws = new Set(PATTERNS[i]().map(([x, y]) => key(x, y)));
      let total = 0;
      for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) if (!ws.has(key(x, y))) total += 1;
      const seen = new Set([key(6, 11)]);
      const q = [[6, 11]];
      while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
          const k = key(nx, ny);
          if (ws.has(k) || seen.has(k)) continue;
          seen.add(k);
          q.push([nx, ny]);
        }
      }
      // 출발 자리(가운데 줄)가 막히지 않았나
      const startOk = ![4, 5, 6, 7, 8, 9].some((x) => ws.has(key(x, 11)));
      return seen.size === total && startOk;
    },
    PATTERN_COUNT: PATTERNS.length,
    TOTAL_STAGES,
  };
})();
