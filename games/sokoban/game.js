(() => {
  "use strict";

  /*
   * 상자야 굴러가
   *  - 그림은 전부 코드로: 벽 · 바닥 · 상자 · 토끼 · 배경 (월드 5개)
   *  - 칸 사이를 부드럽게 움직이고, 빈 칸을 누르면 길을 찾아 걸어가고, 상자를 누르면 밀 수 있는 방향이 나옴
   *  - 별 3개 · 진행 저장 · 되돌리기 · 힌트(푸는 일은 solver.js 가 뒤에서)
   */
  const LEVELS = window.SokobanLevels;
  const Solver = window.SokobanSolver;
  const TOTAL = LEVELS.length;
  const SAVE_KEY = "sokoban-v2";
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  const DEPTH = 0.27; // 벽 높이 (칸 크기 기준)
  const CRATE_H = 0.26;
  const STEP = 0.125; // 한 칸 걷는 시간
  const STEP_FAST = 0.075; // 길찾기로 걸을 때

  /* ---------- 월드 ---------- */
  const WORLDS = [
    { name: "봄 정원", kind: "hedge", sky: ["#6fb9ec", "#c9ecff", "#f4fbe6"], hills: ["#9fd28e", "#79bb6d"], floor: ["#9ccf6c", "#8dc45f"], floorDot: "#7fb653", wallTop: ["#5fa94c", "#478f3d"], wallFront: ["#37762f", "#25561f"], crate: ["#d99a55", "#bd7c3c", "#8a5426"], lock: "#ffc93c", accent: "#ff7aa2", part: "petal", overall: "#3f7fd1" },
    { name: "통나무 숲", kind: "log", sky: ["#2f5d55", "#6d9d7a", "#c8d8a6"], hills: ["#3f6f53", "#2e5a44"], floor: ["#b5935f", "#a98854"], floorDot: "#927346", wallTop: ["#c19560", "#a57a48"], wallFront: ["#7a5432", "#573a20"], crate: ["#e0b070", "#c48f50", "#7f5a2e"], lock: "#ffe07a", accent: "#ffa94d", part: "leaf", overall: "#b5482f" },
    { name: "사막 유적", kind: "stone", sky: ["#e98b4e", "#f6c489", "#fde8c4"], hills: ["#d9a768", "#c28d52"], floor: ["#ecd29c", "#e4c88f"], floorDot: "#cfae74", wallTop: ["#bb8a50", "#a2743f"], wallFront: ["#7d5630", "#5c3d20"], crate: ["#b98a55", "#9a6f40", "#5f4122"], lock: "#5fe0d0", accent: "#27b7a6", part: "sand", overall: "#1f8c8c" },
    { name: "얼음 창고", kind: "ice", sky: ["#1f3f78", "#4f8ccf", "#bfe6f7"], hills: ["#a9d7ee", "#7fbbe0"], floor: ["#d7f0fa", "#c7e8f6"], floorDot: "#a5d6ec", wallTop: ["#9fdcf5", "#70bfe6"], wallFront: ["#3f8bc2", "#2a6697"], crate: ["#c58c58", "#a56f40", "#6b4524"], lock: "#ffe36b", accent: "#ff8e6e", part: "snow", overall: "#d8433f" },
    { name: "네온 공장", kind: "neon", sky: ["#120a2e", "#2a1458", "#4a1f78"], hills: ["#1d1242", "#160d33"], floor: ["#2c2850", "#262245"], floorDot: "#3b3668", wallTop: ["#46407c", "#35306a"], wallFront: ["#1d1a40", "#121030"], crate: ["#7f90b4", "#5f7096", "#2a3350"], lock: "#3dffc2", accent: "#ff4fa8", part: "spark", overall: "#ff4fa8", neon: true },
  ];
  const worldOf = (i) => WORLDS[Math.min(WORLDS.length - 1, Math.floor(i / 10))];
  const stageLabel = (i) => `${Math.floor(i / 10) + 1}-${(i % 10) + 1}`;

  /* ---------- 저장 ---------- */
  const save = (() => {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return { best: d.best || {}, last: d.last || 0 };
    } catch (_) {
      return { best: {}, last: 0 };
    }
  })();
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_) {
      /* 저장이 막혀 있어도 게임은 계속 */
    }
  }
  const cleared = () => Object.keys(save.best).length;
  const totalStars = () => Object.values(save.best).reduce((a, b) => a + b.stars, 0);
  const totalPoints = () => Object.values(save.best).reduce((a, b) => a + b.pts, 0);
  /** 깬 단계 + 앞으로 3단계까지 열어 둠 (막혀도 다음 걸 해 볼 수 있게) */
  function isOpen(i) {
    let top = -1;
    for (const k of Object.keys(save.best)) top = Math.max(top, Number(k));
    return i <= top + 3;
  }
  function starsFor(moves, par, usedHint) {
    let s = 1;
    if (moves <= par * 1.5 + 4) s = 2;
    if (moves <= par * 1.12 + 2) s = 3;
    return usedHint ? Math.min(2, s) : s;
  }
  const pointsFor = (moves, par) => Math.round(1000 * Math.min(1, (par + 2) / Math.max(1, moves)));

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
      g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(c.destination);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.03);
    },
    step() {
      this.noise(0.05, 1500, "bandpass", 0.05);
    },
    push() {
      this.noise(0.13, 420, "lowpass", 0.2);
      this.tone(92, 0.11, "triangle", 0.12, 0.8);
    },
    bump() {
      this.tone(120, 0.09, "sine", 0.2, 0.6);
    },
    lock() {
      this.tone(130, 0.14, "sine", 0.3, 0.6);
      this.tone(784, 0.14, "triangle", 0.16, 1, 0.03);
      this.tone(1175, 0.24, "triangle", 0.14, 1, 0.1);
    },
    undo() {
      this.tone(520, 0.09, "sine", 0.1, 0.62);
    },
    hint() {
      this.tone(880, 0.12, "sine", 0.12);
      this.tone(1320, 0.18, "sine", 0.1, 1, 0.09);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.26, "triangle", 0.16, 1, i * 0.1));
      this.tone(1319, 0.5, "sine", 0.1, 1, 0.42);
    },
    star(i) {
      this.tone(880 + i * 220, 0.2, "triangle", 0.16);
    },
    ui() {
      this.tone(660, 0.05, "sine", 0.1);
    },
  };

  /* ---------- 화면 ---------- */
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  let VW = 390;
  let VH = 700;
  let DPR = 1;
  let screen = "title";
  let paused = false;
  let time = 0;
  let last = performance.now();

  /* ---------- 판 상태 ---------- */
  let stage = 0;
  let W = 0;
  let H = 0;
  let walls = new Uint8Array(0);
  let goals = new Uint8Array(0);
  let floorMask = new Uint8Array(0);
  let liveMask = new Uint8Array(0);
  let crates = [];
  let player = { x: 0, y: 0, rx: 0, ry: 0, dir: 2, walk: 0, push: 0, hop: 0 };
  let parsed = null;
  let moves = 0;
  let pushes = 0;
  let history = [];
  let usedHint = false;
  let anim = null;
  let queued = null;
  let path = [];
  let selected = null;
  let options = [];
  let held = null;
  let shake = 0;
  let introT = 1;
  let clearT = -1;
  let warned = false;
  let hintView = null;
  let cell = 40;
  let ox = 0;
  let oy = 0;
  let layers = null;
  let particles = [];
  let world = WORLDS[0];

  const idx = (x, y) => y * W + x;
  const crateAt = (x, y) => crates.find((c) => c.x === x && c.y === y) || null;
  const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || walls[idx(x, y)] === 1;

  function loadStage(i) {
    stage = clamp(i, 0, TOTAL - 1);
    world = worldOf(stage);
    const map = LEVELS[stage].m;
    parsed = Solver.parse(map);
    W = parsed.w;
    H = parsed.h;
    walls = parsed.walls;
    goals = parsed.goals;
    liveMask = Solver.liveCells(parsed);
    crates = parsed.crates.map((c) => ({ x: c % W, y: Math.floor(c / W), rx: c % W, ry: Math.floor(c / W), bump: 0, drop: 0, lock: 0, glow: goals[c] ? 1 : 0 }));
    const px = parsed.player % W;
    const py = Math.floor(parsed.player / W);
    player = { x: px, y: py, rx: px, ry: py, dir: 2, walk: 0, push: 0, hop: 0, bumpX: 0, bumpY: 0 };
    // 토끼가 갈 수 있는 곳만 바닥 (바깥 빈칸은 하늘 · 안에 갇힌 빈칸은 벽으로)
    floorMask = new Uint8Array(W * H);
    const st = [parsed.player];
    floorMask[parsed.player] = 1;
    while (st.length) {
      const c = st.pop();
      for (const n of [c - W, c + 1, c + W, c - 1]) {
        if (n < 0 || n >= W * H || floorMask[n] || walls[n]) continue;
        if ((c % W === 0 && n === c - 1) || (c % W === W - 1 && n === c + 1)) continue;
        floorMask[n] = 1;
        st.push(n);
      }
    }
    moves = 0;
    pushes = 0;
    history = [];
    usedHint = false;
    anim = null;
    queued = null;
    path = [];
    selected = null;
    options = [];
    held = null;
    warned = false;
    hintView = null;
    clearT = -1;
    introT = 0;
    particles = [];
    save.last = stage;
    persist();
    layoutBoard();
    updateHud();
    setDanger(false);
    $("hint-btn").disabled = false;
  }

  /* ---------- 움직임 ---------- */
  function canAct() {
    return screen === "play" && !paused && clearT < 0 && introT >= 0.5;
  }
  /** 한 칸 시도. fast: 길찾기 걸음 */
  function step(dx, dy, fast = false) {
    if (!canAct()) return false;
    if (anim) {
      queued = { dx, dy, fast };
      return false;
    }
    const nx = player.x + dx;
    const ny = player.y + dy;
    player.dir = dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
    if (isWall(nx, ny)) {
      bump(dx, dy);
      return false;
    }
    const c = crateAt(nx, ny);
    let pushed = null;
    if (c) {
      const bx = nx + dx;
      const by = ny + dy;
      if (isWall(bx, by) || crateAt(bx, by)) {
        bump(dx, dy);
        c.bump = 0.2;
        return false;
      }
      pushed = { c, fx: c.x, fy: c.y, tx: bx, ty: by };
      c.x = bx;
      c.y = by;
      pushes += 1;
    }
    history.push({ x: player.x, y: player.y, dir: player.dir, crate: pushed ? crates.indexOf(pushed.c) : -1, fx: pushed ? pushed.fx : 0, fy: pushed ? pushed.fy : 0, hadPush: Boolean(pushed) });
    anim = { t: 0, dur: fast ? STEP_FAST : pushed ? STEP * 1.25 : STEP, fx: player.x, fy: player.y, tx: nx, ty: ny, crate: pushed };
    player.x = nx;
    player.y = ny;
    moves += 1;
    hintView = null;
    if (pushed) Sound.push();
    else if (moves % 2 === 0) Sound.step();
    updateHud();
    return true;
  }
  function bump(dx, dy) {
    player.bumpX = dx;
    player.bumpY = dy;
    player.bumpT = 0.16;
    path = [];
    queued = null;
    Sound.bump();
  }
  function afterStep() {
    const done = anim;
    anim = null;
    if (done.crate) {
      const c = done.crate.c;
      const k = idx(c.x, c.y);
      if (goals[k]) {
        c.lock = 1;
        Sound.lock();
        spark(c.x, c.y, world.lock, 18);
      } else {
        dust(c.x, c.y, done.tx - done.fx, done.ty - done.fy);
      }
      // 구석에 끼어 다시는 못 빼는 상자 알림
      const dead = crates.some((q) => !goals[idx(q.x, q.y)] && !liveMask[idx(q.x, q.y)]);
      setDanger(dead);
    }
    if (crates.every((c) => goals[idx(c.x, c.y)])) {
      winStage();
      return;
    }
    if (selected) refreshOptions();
    if (queued) {
      const q = queued;
      queued = null;
      path = [];
      step(q.dx, q.dy, q.fast);
    } else if (path.length) {
      const p = path.shift();
      step(p[0], p[1], p[2] !== false);
    } else if (held) step(held[0], held[1]);
    else player.walk = 0;
  }
  function undo() {
    if (!history.length || screen !== "play" || paused || clearT >= 0) return;
    path = [];
    queued = null;
    const h = history.pop();
    anim = null;
    player.x = h.x;
    player.y = h.y;
    player.rx = h.x;
    player.ry = h.y;
    player.dir = h.dir;
    if (h.hadPush) {
      const c = crates[h.crate];
      c.x = h.fx;
      c.y = h.fy;
      c.rx = h.fx;
      c.ry = h.fy;
      pushes -= 1;
    }
    moves -= 1;
    hintView = null;
    Sound.undo();
    setDanger(crates.some((q) => !goals[idx(q.x, q.y)] && !liveMask[idx(q.x, q.y)]));
    if (selected) refreshOptions();
    updateHud();
  }
  function restart() {
    if (screen !== "play") return;
    Sound.ui();
    loadStage(stage);
  }
  function setDanger(on) {
    $("undo-btn").classList.toggle("pulse", on);
    if (on && !warned) {
      warned = true;
      toast("이 상자는 이제 못 옮겨요. 되돌려 보세요!");
    }
    if (!on) warned = false;
  }
  let toastT = 0;
  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove("show"), 2400);
  }

  /* ---------- 길찾기 · 상자 고르기 ---------- */
  function crateMask() {
    const m = new Uint8Array(W * H);
    for (const c of crates) m[idx(c.x, c.y)] = 1;
    return m;
  }
  function pathToDirs(cells) {
    const out = [];
    let at = idx(player.x, player.y);
    for (const c of cells) {
      const d = c - at;
      out.push(d === 1 ? [1, 0] : d === -1 ? [-1, 0] : d === W ? [0, 1] : [0, -1]);
      at = c;
    }
    return out;
  }
  function refreshOptions() {
    options = [];
    if (!selected) return;
    const mask = crateMask();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const tx = selected.x + dx;
      const ty = selected.y + dy;
      const bx = selected.x - dx;
      const by = selected.y - dy;
      if (isWall(tx, ty) || crateAt(tx, ty) || isWall(bx, by) || crateAt(bx, by)) continue;
      const atBehind = player.x === bx && player.y === by;
      const route = atBehind ? [] : Solver.walkPath(parsed, mask, idx(player.x, player.y), idx(bx, by));
      if (route) options.push({ dx, dy, tx, ty, route });
    }
  }
  function goTo(x, y) {
    const mask = crateMask();
    const route = Solver.walkPath(parsed, mask, idx(player.x, player.y), idx(x, y));
    if (!route || !route.length) return false;
    path = pathToDirs(route).map((d) => [d[0], d[1], true]);
    const p = path.shift();
    step(p[0], p[1], true);
    return true;
  }
  function pickOption(o) {
    const dirs = pathToDirs(o.route).map((d) => [d[0], d[1], true]);
    dirs.push([o.dx, o.dy, false]);
    path = dirs;
    const p = path.shift();
    step(p[0], p[1], p[2] !== false);
  }
  function tapCell(x, y) {
    if (!canAct()) return;
    Sound.unlock();
    const o = options.find((q) => q.tx === x && q.ty === y);
    if (o) {
      pickOption(o);
      return;
    }
    const c = crateAt(x, y);
    if (c) {
      selected = selected === c ? null : c;
      refreshOptions();
      if (selected && !options.length) toast("지금은 이 상자를 밀 수 없어요");
      Sound.ui();
      return;
    }
    selected = null;
    options = [];
    if (isWall(x, y) || !floorMask[idx(x, y)]) return;
    if (!goTo(x, y) && !(x === player.x && y === player.y)) toast("거기로 가는 길이 막혀 있어요");
  }

  /* ---------- 힌트 ---------- */
  let hintWorker = null;
  let hintBusy = false;
  function hint() {
    if (!canAct() || hintBusy) return;
    if (hintView) return;
    const map = [];
    for (let y = 0; y < H; y += 1) {
      let row = "";
      for (let x = 0; x < W; x += 1) {
        const g = goals[idx(x, y)];
        if (walls[idx(x, y)]) row += "#";
        else if (crateAt(x, y)) row += g ? "*" : "$";
        else if (player.x === x && player.y === y) row += g ? "+" : "@";
        else row += g ? "." : " ";
      }
      map.push(row);
    }
    hintBusy = true;
    const btn = $("hint-btn");
    btn.classList.add("busy");
    const forStage = stage;
    const done = (r) => {
      hintBusy = false;
      btn.classList.remove("busy");
      if (forStage !== stage || screen !== "play") return;
      if (!r || r.gaveUp) {
        toast("지금은 답을 못 찾았어요. 조금 움직인 뒤 다시 눌러 보세요");
        return;
      }
      if (r.none) {
        toast("이대로는 풀 수 없어요. 되돌려 보세요!");
        $("undo-btn").classList.add("pulse");
        return;
      }
      showHint(r.pushes[0]);
    };
    try {
      if (!hintWorker) hintWorker = new Worker("solver.js");
      hintWorker.onmessage = (e) => done(e.data);
      hintWorker.onerror = () => done(Solver.solve(Solver.parse(map), { budgetMs: 1200 }));
      hintWorker.postMessage({ map, budgetMs: 7000 });
    } catch (_) {
      done(Solver.solve(Solver.parse(map), { budgetMs: 1200 }));
    }
  }
  function showHint(push) {
    if (!push) return;
    usedHint = true;
    updateHud();
    Sound.hint();
    const c = push.crate;
    const d = Solver.DIRS[push.dir];
    hintView = { x: c % W, y: Math.floor(c / W), dx: d[0], dy: d[1], t: 0 };
    toast("이 상자를 화살표 쪽으로 밀어 보세요");
  }

  /* ---------- 클리어 ---------- */
  function winStage() {
    clearT = 0;
    selected = null;
    options = [];
    hintView = null;
    held = null;
    path = [];
    const par = LEVELS[stage].p;
    const stars = starsFor(moves, par, usedHint);
    const pts = pointsFor(moves, par);
    const prev = save.best[stage];
    const record = !prev || moves < prev.moves;
    save.best[stage] = { moves: record ? moves : prev.moves, stars: Math.max(stars, prev ? prev.stars : 0), pts: Math.max(pts, prev ? prev.pts : 0) };
    save.last = Math.min(TOTAL - 1, stage + 1);
    persist();
    lastWin = { stars, pts, record: record && Boolean(prev), moves, par };
    Sound.win();
    for (const c of crates) {
      c.bump = 0.3;
      spark(c.x, c.y, world.lock, 12);
    }
    for (let i = 0; i < 70; i += 1) {
      particles.push({
        kind: "conf",
        x: Math.random() * VW,
        y: -20 - Math.random() * VH * 0.6,
        vx: (Math.random() - 0.5) * 50,
        vy: 90 + Math.random() * 130,
        life: 2.6,
        t: 0,
        size: 5 + Math.random() * 5,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 9,
        color: ["#ffd24a", "#ff6f91", "#5fd0ff", "#8ff07a", "#ffffff"][i % 5],
      });
    }
  }
  let lastWin = null;
  function showClear() {
    screen = "clear";
    const w = lastWin;
    const isLast = stage >= TOTAL - 1;
    const worldEnd = (stage + 1) % 10 === 0;
    $("clear-title").textContent = isLast ? "모든 단계 완료!" : worldEnd ? `${world.name} 완료!` : "클리어!";
    $("clear-stage").textContent = stageLabel(stage);
    $("clear-moves").textContent = w.moves;
    $("clear-par").textContent = w.par;
    $("clear-points").textContent = totalPoints().toLocaleString("ko-KR");
    $("clear-new").hidden = !w.record;
    const starEls = document.querySelectorAll("#clear-stars i");
    starEls.forEach((el, i) => {
      el.classList.remove("on");
      if (i < w.stars) {
        setTimeout(() => {
          el.classList.add("on");
          Sound.star(i);
        }, 240 + i * 230);
      }
    });
    $("next-btn").hidden = isLast;
    $("clear").hidden = false;
    const showRank = isLast || worldEnd;
    $("rank-slot").hidden = !showRank;
    if (showRank && window.TodayGameRank) {
      window.TodayGameRank.reset();
      window.TodayGameRank.open(totalPoints(), { label: `${cleared()}단계 · 별 ${totalStars()}개` });
    }
  }

  /* ---------- 입력 ---------- */
  const KEYS = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
  document.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (screen === "clear" && (k === "enter" || k === " ")) {
      if (!$("next-btn").hidden) $("next-btn").click();
      return;
    }
    if (screen !== "play") return;
    if (k === "z" || k === "backspace" || (k === "z" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      undo();
      return;
    }
    if (k === "r") {
      restart();
      return;
    }
    if (k === "h") {
      hint();
      return;
    }
    const d = KEYS[k];
    if (!d) return;
    e.preventDefault();
    Sound.unlock();
    if (e.repeat) return;
    selected = null;
    options = [];
    path = [];
    held = d;
    step(d[0], d[1]);
  });
  document.addEventListener("keyup", (e) => {
    const d = KEYS[e.key.toLowerCase()];
    if (d && held === d) held = null;
  });
  document.querySelectorAll(".pad-btn").forEach((btn) => {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[btn.dataset.dir];
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      Sound.unlock();
      selected = null;
      options = [];
      path = [];
      held = d;
      btn.classList.add("pressed");
      step(d[0], d[1]);
    });
    const up = () => {
      btn.classList.remove("pressed");
      if (held === d) held = null;
    };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  });
  let press = null;
  canvas.addEventListener("pointerdown", (e) => {
    Sound.unlock();
    press = { x: e.clientX, y: e.clientY, moved: false };
    if (screen === "play" && introT < 0.9) introT = 0.9;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!press || screen !== "play") return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    // 밀어서 이동: 일정 거리마다 한 칸
    if (Math.hypot(dx, dy) < 26) return;
    press.moved = true;
    press.x = e.clientX;
    press.y = e.clientY;
    selected = null;
    options = [];
    path = [];
    if (Math.abs(dx) > Math.abs(dy)) step(dx > 0 ? 1 : -1, 0);
    else step(0, dy > 0 ? 1 : -1);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!press) return;
    const moved = press.moved;
    press = null;
    if (moved || screen !== "play") return;
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    // 상자는 윗면까지 눌러도 그 상자로
    const hit = crates.find((c) => px >= ox + c.x * cell && px < ox + (c.x + 1) * cell && py >= oy + (c.y - CRATE_H) * cell && py < oy + (c.y + 1) * cell);
    if (hit) tapCell(hit.x, hit.y);
    else tapCell(Math.floor((px - ox) / cell), Math.floor((py - oy) / cell));
  });
  canvas.addEventListener("pointercancel", () => {
    press = null;
  });
  $("undo-btn").addEventListener("click", undo);
  $("restart-btn").addEventListener("click", restart);
  $("hint-btn").addEventListener("click", hint);
  $("stage-btn").addEventListener("click", () => openStages("play"));
  $("start-btn").addEventListener("click", () => {
    Sound.unlock();
    Sound.ui();
    startStage(firstOpen());
  });
  $("stages-btn").addEventListener("click", () => openStages("title"));
  $("stages-back").addEventListener("click", () => {
    Sound.ui();
    if (stagesFrom === "play") setScreen("play");
    else setScreen("title");
  });
  $("next-btn").addEventListener("click", () => {
    Sound.ui();
    startStage(stage + 1);
  });
  $("retry-btn").addEventListener("click", () => {
    Sound.ui();
    startStage(stage);
  });
  $("clear-stages-btn").addEventListener("click", () => openStages("title"));
  for (const b of document.querySelectorAll("[data-world]")) {
    b.addEventListener("click", () => {
      Sound.ui();
      renderStages(Number(b.dataset.world));
    });
  }

  function firstOpen() {
    if (cleared() === 0) return 0;
    for (let i = save.last; i < TOTAL; i += 1) if (!save.best[i]) return i;
    for (let i = 0; i < TOTAL; i += 1) if (!save.best[i]) return i;
    return Math.min(save.last, TOTAL - 1);
  }
  function startStage(i) {
    if (window.TodayGameRank) window.TodayGameRank.reset();
    loadStage(i);
    setScreen("play");
  }
  function setScreen(name) {
    screen = name;
    $("title").hidden = name !== "title";
    $("stages").hidden = name !== "stages";
    $("clear").hidden = name !== "clear";
    const play = name === "play" || name === "clear";
    $("hud").hidden = !play;
    $("bar").hidden = !play;
    document.body.classList.toggle("in-play", play);
    if (name === "title") renderTitle();
    last = performance.now();
    if (play) layoutBoard();
    else if (name === "title") layoutTitle();
  }
  let stagesFrom = "title";
  function openStages(from) {
    Sound.ui();
    stagesFrom = from;
    setScreen("stages");
    renderStages(Math.floor((from === "play" ? stage : firstOpen()) / 10));
  }
  function renderStages(w) {
    for (const b of document.querySelectorAll("[data-world]")) b.classList.toggle("on", Number(b.dataset.world) === w);
    const T = WORLDS[w];
    $("stages-sum").textContent = `별 ${totalStars()} / ${TOTAL * 3}`;
    const grid = $("stage-grid");
    grid.style.setProperty("--wa", T.accent);
    grid.innerHTML = "";
    for (let i = w * 10; i < Math.min(TOTAL, w * 10 + 10); i += 1) {
      const open = isOpen(i);
      const b = document.createElement("button");
      b.type = "button";
      const best = save.best[i];
      b.className = `st ${best ? "done" : ""} ${open ? "" : "locked"} ${i === stage && stagesFrom === "play" ? "cur" : ""}`;
      b.disabled = !open;
      b.innerHTML = open ? `<b>${(i % 10) + 1}</b><span class="mini-stars">${[0, 1, 2].map((k) => `<i class="${best && best.stars > k ? "on" : ""}"></i>`).join("")}</span>` : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3h1.5v10h-13V11zm2.5 0h5V8a2.5 2.5 0 0 0-5 0z" fill="currentColor"/></svg>`;
      b.setAttribute("aria-label", `${stageLabel(i)}단계${open ? "" : " (잠김)"}`);
      if (open) b.addEventListener("click", () => {
        Sound.unlock();
        Sound.ui();
        startStage(i);
      });
      grid.appendChild(b);
    }
  }
  function renderTitle() {
    const n = cleared();
    $("start-label").textContent = n ? `이어하기 · ${stageLabel(firstOpen())}` : "시작하기";
    $("title-progress").textContent = n ? `별 ${totalStars()} / ${TOTAL * 3} · ${n}단계 클리어` : "50단계 · 월드 5개";
  }
  function updateHud() {
    $("hud-world").textContent = world.name;
    $("hud-stage").textContent = stageLabel(stage);
    $("hud-moves").textContent = moves;
    const par = LEVELS[stage].p;
    $("hud-par").textContent = Math.round(par * 1.12 + 2);
    const now = starsFor(moves, par, usedHint);
    document.querySelectorAll("#hud-stars i").forEach((el, i) => el.classList.toggle("on", i < now));
    document.body.dataset.world = String(Math.floor(stage / 10));
  }

  /* ---------- 배치 ---------- */
  function resize() {
    const r = $("stage").getBoundingClientRect();
    VW = Math.max(1, r.width);
    VH = Math.max(1, r.height);
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
    scene = null;
    if (screen === "play" || screen === "clear") layoutBoard();
    else layoutTitle();
  }
  function layoutBoard() {
    if (!W) return;
    const top = $("hud").hidden ? 70 : Math.max($("hud").getBoundingClientRect().bottom, 92);
    const barEl = $("bar");
    const land = VW > VH;
    const bottom = barEl.hidden ? VH - 10 : land ? VH - 8 : barEl.getBoundingClientRect().top;
    const leftPad = land ? 8 : 8;
    const rightPad = land && !barEl.hidden ? barEl.getBoundingClientRect().width + 14 : 8;
    const availW = VW - leftPad - rightPad;
    const availH = bottom - top - 12;
    cell = Math.floor(Math.min(availW / W, availH / (H + DEPTH + 0.35)));
    cell = clamp(cell, 16, 84);
    ox = Math.round(leftPad + (availW - W * cell) / 2);
    oy = Math.round(top + 6 + (availH - (H + DEPTH + 0.35) * cell) / 2 + DEPTH * cell);
    layers = null;
    scene = null;
    sprites = null;
  }
  function layoutTitle() {
    world = WORLDS[0];
    layers = null;
  }

  /* ---------- 그림: 무늬 도구 ---------- */
  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * DPR));
    c.height = Math.max(1, Math.round(h * DPR));
    const g = c.getContext("2d");
    g.scale(DPR, DPR);
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
  function rr(g, x, y, w, h, tl, tr = tl, br = tl, bl = tl) {
    g.beginPath();
    g.moveTo(x + tl, y);
    g.lineTo(x + w - tr, y);
    if (tr) g.quadraticCurveTo(x + w, y, x + w, y + tr);
    g.lineTo(x + w, y + h - br);
    if (br) g.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    g.lineTo(x + bl, y + h);
    if (bl) g.quadraticCurveTo(x, y + h, x, y + h - bl);
    g.lineTo(x, y + tl);
    if (tl) g.quadraticCurveTo(x, y, x + tl, y);
    g.closePath();
  }
  function vgrad(g, y0, y1, a, b) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    return gr;
  }

  /* ---------- 배경 ---------- */
  let scene = null;
  function paintScene() {
    const T = world;
    const [c, g] = mk(VW, VH);
    const gr = g.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, T.sky[0]);
    gr.addColorStop(0.62, T.sky[1]);
    gr.addColorStop(1, T.sky[2]);
    g.fillStyle = gr;
    g.fillRect(0, 0, VW, VH);
    const r = rnd(Math.floor(stage / 10) * 13 + 7);
    if (T.neon) {
      for (let i = 0; i < 90; i += 1) {
        g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`;
        g.fillRect(r() * VW, r() * VH * 0.7, 1 + r() * 1.4, 1 + r() * 1.4);
      }
      for (let i = 0; i < 14; i += 1) {
        const w = 30 + r() * 70;
        const h = 60 + r() * VH * 0.3;
        const x = r() * VW;
        g.fillStyle = "#170e38";
        g.fillRect(x, VH - h, w, h);
        for (let k = 0; k < 18; k += 1) {
          g.fillStyle = r() < 0.5 ? "rgba(255,79,168,0.5)" : "rgba(80,220,255,0.45)";
          g.fillRect(x + 5 + r() * (w - 10), VH - h + 6 + r() * (h - 12), 3, 5);
        }
      }
    } else {
      // 해 · 구름
      const sx = VW * 0.78;
      const sy = VH * 0.14;
      const sun = g.createRadialGradient(sx, sy, 4, sx, sy, VW * 0.45);
      sun.addColorStop(0, "rgba(255,250,225,0.95)");
      sun.addColorStop(0.16, "rgba(255,244,205,0.55)");
      sun.addColorStop(1, "rgba(255,240,200,0)");
      g.fillStyle = sun;
      g.fillRect(0, 0, VW, VH);
      for (let i = 0; i < 7; i += 1) {
        const x = r() * VW;
        const y = r() * VH * 0.42 + 40;
        const s = 0.5 + r() * 0.9;
        g.fillStyle = "rgba(255,255,255,0.5)";
        for (const [dx, dy, q] of [[-34, 6, 22], [-8, -6, 30], [24, 0, 25], [50, 8, 15]]) {
          g.beginPath();
          g.ellipse(x + dx * s, y + dy * s, q * s * 1.3, q * s * 0.7, 0, 0, TAU);
          g.fill();
        }
      }
      // 언덕 두 겹
      const ridge = (base, amp, col, ph) => {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(0, VH);
        for (let x = 0; x <= VW + 8; x += 8) g.lineTo(x, base + Math.sin(x * 0.012 + ph) * amp + Math.sin(x * 0.031 + ph * 2) * amp * 0.35);
        g.lineTo(VW, VH);
        g.fill();
      };
      ridge(VH * 0.74, 22, T.hills[0], 0.6);
      ridge(VH * 0.84, 16, T.hills[1], 2.4);
    }
    return c;
  }

  /* ---------- 판: 바닥 · 벽 층 ---------- */
  function paintFloorTile(g, x, y, s, k, T, r) {
    g.fillStyle = T.floor[k % 2];
    g.fillRect(x, y, s, s);
    if (T.kind === "hedge") {
      for (let i = 0; i < 7; i += 1) {
        g.fillStyle = r() < 0.5 ? T.floorDot : "rgba(255,255,255,0.14)";
        const px = x + r() * s;
        const py = y + r() * s;
        g.fillRect(px, py, Math.max(1, s * 0.022), s * 0.07);
      }
      if (r() < 0.09) {
        const fx = x + s * (0.2 + r() * 0.6);
        const fy = y + s * (0.2 + r() * 0.6);
        g.fillStyle = "#fff";
        for (let a = 0; a < 5; a += 1) {
          g.beginPath();
          g.arc(fx + Math.cos((a / 5) * TAU) * s * 0.035, fy + Math.sin((a / 5) * TAU) * s * 0.035, s * 0.026, 0, TAU);
          g.fill();
        }
        g.fillStyle = "#ffd24a";
        g.beginPath();
        g.arc(fx, fy, s * 0.024, 0, TAU);
        g.fill();
      }
    } else if (T.kind === "log") {
      g.strokeStyle = "rgba(90,60,30,0.3)";
      g.lineWidth = Math.max(1, s * 0.016);
      for (let i = 0; i < 3; i += 1) {
        const py = y + ((i + 0.5) / 3) * s;
        g.beginPath();
        g.moveTo(x, py);
        g.lineTo(x + s, py + (r() - 0.5) * s * 0.08);
        g.stroke();
      }
      if (r() < 0.2) {
        g.fillStyle = "rgba(96,140,70,0.4)";
        g.beginPath();
        g.ellipse(x + r() * s, y + r() * s, s * 0.2, s * 0.12, 0, 0, TAU);
        g.fill();
      }
    } else if (T.kind === "stone") {
      g.strokeStyle = "rgba(150,110,60,0.35)";
      g.lineWidth = Math.max(1, s * 0.02);
      g.strokeRect(x + 1, y + 1, s - 2, s - 2);
      for (let i = 0; i < 5; i += 1) {
        g.fillStyle = "rgba(170,130,80,0.25)";
        g.fillRect(x + r() * s, y + r() * s, s * 0.05, s * 0.03);
      }
    } else if (T.kind === "ice") {
      g.strokeStyle = "rgba(255,255,255,0.75)";
      g.lineWidth = Math.max(1, s * 0.014);
      g.beginPath();
      const a = x + r() * s * 0.5;
      g.moveTo(a, y + s * 0.15);
      g.lineTo(a + s * 0.28, y + s * 0.45);
      g.moveTo(a + s * 0.1, y + s * 0.2);
      g.lineTo(a + s * 0.3, y + s * 0.38);
      g.stroke();
      g.strokeStyle = "rgba(120,190,225,0.45)";
      g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    } else {
      g.strokeStyle = T.floorDot;
      g.lineWidth = Math.max(1, s * 0.02);
      g.strokeRect(x + 1, y + 1, s - 2, s - 2);
      g.fillStyle = "rgba(255,255,255,0.14)";
      for (const [dx, dy] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
        g.beginPath();
        g.arc(x + dx * s, y + dy * s, s * 0.018, 0, TAU);
        g.fill();
      }
    }
  }
  function paintGoal(g, x, y, s, T) {
    const cx = x + s / 2;
    const cy = y + s / 2;
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.beginPath();
    g.ellipse(cx, cy + s * 0.02, s * 0.37, s * 0.35, 0, 0, TAU);
    g.fill();
    g.fillStyle = T.neon ? "#17143a" : "#f6f0dd";
    g.beginPath();
    g.ellipse(cx, cy, s * 0.35, s * 0.33, 0, 0, TAU);
    g.fill();
    g.strokeStyle = T.lock;
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.ellipse(cx, cy, s * 0.27, s * 0.255, 0, 0, TAU);
    g.stroke();
    g.fillStyle = T.lock;
    g.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU - Math.PI / 2;
      const q = i % 2 ? s * 0.055 : s * 0.13;
      g[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * q, cy + Math.sin(a) * q);
    }
    g.fill();
  }
  /** 벽 한 칸 */
  function paintWall(g, x, y, s, T, nb, r) {
    const h = s * DEPTH;
    const topY = y - h;
    const rad = s * 0.16;
    // 앞면
    if (!nb.s) {
      const fh = h + (nb.edge ? s * 0.2 : 0);
      g.fillStyle = vgrad(g, y + s - h, y + s - h + fh, T.wallFront[0], T.wallFront[1]);
      rr(g, x, y + s - h, s, fh, 0, 0, nb.edge && !nb.e ? rad * 0.5 : 0, nb.edge && !nb.w ? rad * 0.5 : 0);
      g.fill();
      if (T.kind === "hedge") {
        for (let i = 0; i < 10; i += 1) {
          g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.16)";
          g.beginPath();
          g.arc(x + r() * s, y + s - h + r() * fh, s * (0.04 + r() * 0.04), 0, TAU);
          g.fill();
        }
      } else if (T.kind === "log") {
        const n = 2;
        for (let i = 0; i < n; i += 1) {
          const ly = y + s - h + (i / n) * h;
          g.fillStyle = i % 2 ? "rgba(255,220,170,0.12)" : "rgba(0,0,0,0.12)";
          g.fillRect(x, ly, s, h / n - 1);
          g.fillStyle = "rgba(40,20,5,0.45)";
          g.fillRect(x, ly + h / n - 1.5, s, 1.5);
        }
      } else if (T.kind === "stone") {
        g.fillStyle = "rgba(50,28,8,0.4)";
        g.fillRect(x, y + s - h * 0.52, s, Math.max(1, s * 0.022));
        const off = (Math.floor(x / s) % 2) * 0.5;
        g.fillRect(x + s * (0.28 + off * 0.5), y + s - h, Math.max(1, s * 0.022), h * 0.48);
        g.fillRect(x + s * (0.72 - off * 0.5), y + s - h * 0.5, Math.max(1, s * 0.022), h * 0.5);
      } else if (T.kind === "ice") {
        g.fillStyle = "rgba(255,255,255,0.22)";
        g.beginPath();
        g.moveTo(x + s * 0.12, y + s - h);
        g.lineTo(x + s * 0.38, y + s - h);
        g.lineTo(x + s * 0.2, y + s);
        g.lineTo(x, y + s);
        g.closePath();
        g.fill();
      } else {
        g.fillStyle = "#ff4fa8";
        g.fillRect(x, y + s - h * 0.42, s, Math.max(1.5, s * 0.03));
      }
    }
    // 윗면 (옆 칸이 벽이면 이어 붙임)
    const tl = !nb.n && !nb.w ? rad : 0;
    const tr = !nb.n && !nb.e ? rad : 0;
    const br = !nb.s && !nb.e ? rad : 0;
    const bl = !nb.s && !nb.w ? rad : 0;
    g.fillStyle = vgrad(g, topY, topY + s, T.wallTop[0], T.wallTop[1]);
    rr(g, x, topY, s + (nb.e ? 0.5 : 0), s + (nb.s ? 0.5 : 0), tl, tr, br, bl);
    g.fill();
    g.save();
    rr(g, x, topY, s, s, tl, tr, br, bl);
    g.clip();
    if (T.kind === "hedge") {
      for (let i = 0; i < 22; i += 1) {
        g.fillStyle = r() < 0.55 ? "rgba(200,240,150,0.28)" : "rgba(10,60,15,0.22)";
        g.beginPath();
        g.arc(x + r() * s, topY + r() * s, s * (0.035 + r() * 0.05), 0, TAU);
        g.fill();
      }
    } else if (T.kind === "log") {
      const cx = x + s / 2;
      const cy = topY + s / 2;
      g.strokeStyle = "rgba(100,60,25,0.55)";
      g.lineWidth = Math.max(1, s * 0.02);
      for (let k = 1; k < 4; k += 1) {
        g.beginPath();
        g.arc(cx, cy, s * 0.13 * k, 0, TAU);
        g.stroke();
      }
    } else if (T.kind === "stone") {
      g.strokeStyle = "rgba(90,60,25,0.42)";
      g.lineWidth = Math.max(1, s * 0.02);
      g.strokeRect(x + s * 0.09, topY + s * 0.09, s * 0.82, s * 0.82);
    } else if (T.kind === "ice") {
      g.fillStyle = "rgba(255,255,255,0.4)";
      g.beginPath();
      g.moveTo(x + s * 0.1, topY + s * 0.1);
      g.lineTo(x + s * 0.55, topY + s * 0.1);
      g.lineTo(x + s * 0.1, topY + s * 0.55);
      g.closePath();
      g.fill();
    } else {
      g.strokeStyle = "rgba(80,230,255,0.75)";
      g.lineWidth = Math.max(1, s * 0.022);
      g.strokeRect(x + s * 0.14, topY + s * 0.14, s * 0.72, s * 0.72);
    }
    g.restore();
    // 윗 모서리 빛
    g.strokeStyle = "rgba(255,255,255,0.3)";
    g.lineWidth = Math.max(1, s * 0.025);
    g.beginPath();
    if (!nb.n) {
      g.moveTo(x + tl, topY + 1);
      g.lineTo(x + s - tr, topY + 1);
    }
    if (!nb.w) {
      g.moveTo(x + 1, topY + tl);
      g.lineTo(x + 1, topY + s - bl);
    }
    g.stroke();
  }
  function buildLayers() {
    const T = world;
    const s = cell;
    const pad = s * 1.2;
    const w = W * s + pad * 2;
    const h = H * s + pad * 2;
    const [fc, fg] = mk(w, h);
    const r = rnd(stage * 31 + 5);
    fg.translate(pad, pad);
    // 땅덩이 그림자
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (floorMask[idx(x, y)] || isSolidWall(x, y));
    fg.fillStyle = "rgba(0,0,0,0.22)";
    fg.filter = `blur(${Math.max(2, s * 0.22)}px)`;
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (solid(x, y)) fg.fillRect(x * s + s * 0.08, y * s + s * 0.3, s, s);
    fg.filter = "none";
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (floorMask[idx(x, y)]) paintFloorTile(fg, x * s, y * s, s, x + y, T, r);
      }
    }
    // 벽 그림자 (바닥에 드리움)
    fg.save();
    fg.beginPath();
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (floorMask[idx(x, y)]) fg.rect(x * s, y * s, s, s);
    fg.clip();
    fg.fillStyle = "rgba(10,20,10,0.26)";
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (!isSolidWall(x, y)) continue;
        fg.fillRect(x * s, y * s + s - 1, s, s * 0.2);
        fg.fillRect(x * s + s - 1, y * s, s * 0.14, s);
      }
    }
    fg.restore();
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (goals[idx(x, y)]) paintGoal(fg, x * s, y * s, s, T);
      }
    }
    // 벽은 줄마다 따로 (위 줄 물건을 아래 줄 벽이 가리도록)
    const rows = [];
    for (let y = 0; y < H; y += 1) {
      const [rc, rg] = mk(w, s * (1 + DEPTH + 0.3) + 2);
      rg.translate(pad, s * DEPTH + 1);
      let any = false;
      for (let x = 0; x < W; x += 1) {
        if (!isSolidWall(x, y)) continue;
        any = true;
        const nb = { n: isSolidWall(x, y - 1), s: isSolidWall(x, y + 1), w: isSolidWall(x - 1, y), e: isSolidWall(x + 1, y), edge: !(y + 1 < H && floorMask[idx(x, y + 1)]) };
        paintWall(rg, x * s, 0, s, T, nb, r);
      }
      rows.push(any ? rc : null);
    }
    layers = { floor: fc, rows, pad };
  }
  /** 바닥과 맞닿은 벽만 그림 (바깥에 떠 있는 벽 · 갇힌 빈칸 처리) */
  function isSolidWall(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = idx(x, y);
    if (floorMask[i]) return false;
    if (walls[i]) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && floorMask[idx(nx, ny)]) return true;
        }
      }
      return false;
    }
    // 벽으로 둘러싸인 빈칸: 벽처럼 채움
    return x > 0 && y > 0 && x < W - 1 && y < H - 1 && walls[idx(x - 1, y)] && walls[idx(x + 1, y)] && walls[idx(x, y - 1)] && walls[idx(x, y + 1)];
  }

  /* ---------- 상자 ---------- */
  let sprites = null;
  function paintCrate(s, T, onGoal, danger) {
    const h = s * CRATE_H;
    const m = s * 0.07;
    const [c, g] = mk(s * 1.2, s * 1.5);
    g.translate(s * 0.1, s * 0.1 + h);
    const w = s - m * 2;
    const main = danger ? "#c9543f" : T.crate[0];
    const dark = danger ? "#a03c2c" : T.crate[1];
    const line = danger ? "#6c2418" : T.crate[2];
    // 앞면
    g.fillStyle = vgrad(g, s - m - h, s - m, dark, line);
    rr(g, m, s - m - h, w, h, 0, 0, s * 0.05, s * 0.05);
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 1; i < 4; i += 1) g.fillRect(m + (w * i) / 4, s - m - h, Math.max(1, s * 0.016), h);
    // 윗면
    g.fillStyle = vgrad(g, m - h, s - m - h, main, dark);
    rr(g, m, m - h, w, w, s * 0.06);
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = Math.max(1.2, s * 0.038);
    rr(g, m + s * 0.03, m - h + s * 0.03, w - s * 0.06, w - s * 0.06, s * 0.045);
    g.stroke();
    if (T.neon) {
      g.fillStyle = "rgba(255,255,255,0.1)";
      g.fillRect(m + w * 0.22, m - h + w * 0.22, w * 0.56, w * 0.56);
      g.strokeStyle = onGoal ? T.lock : "#7fe9ff";
      g.lineWidth = Math.max(1, s * 0.03);
      g.strokeRect(m + w * 0.22, m - h + w * 0.22, w * 0.56, w * 0.56);
    } else {
      // X 자 나무 덧댐
      g.save();
      rr(g, m + s * 0.05, m - h + s * 0.05, w - s * 0.1, w - s * 0.1, s * 0.03);
      g.clip();
      g.lineWidth = s * 0.11;
      g.strokeStyle = line;
      g.beginPath();
      g.moveTo(m, m - h);
      g.lineTo(m + w, m - h + w);
      g.moveTo(m + w, m - h);
      g.lineTo(m, m - h + w);
      g.stroke();
      g.lineWidth = s * 0.075;
      g.strokeStyle = main;
      g.beginPath();
      g.moveTo(m, m - h);
      g.lineTo(m + w, m - h + w);
      g.moveTo(m + w, m - h);
      g.lineTo(m, m - h + w);
      g.stroke();
      g.restore();
    }
    // 모서리 쇠
    g.fillStyle = onGoal ? T.lock : "rgba(40,30,20,0.72)";
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const q = s * 0.13;
      g.fillRect(m + dx * (w - q), m - h + dy * (w - q), q, q);
    }
    if (onGoal) {
      // 체크 표시
      const cx = m + w / 2;
      const cy = m - h + w / 2;
      g.fillStyle = T.lock;
      g.beginPath();
      g.arc(cx, cy, s * 0.17, 0, TAU);
      g.fill();
      g.strokeStyle = "#20313a";
      g.lineWidth = s * 0.05;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(cx - s * 0.08, cy);
      g.lineTo(cx - s * 0.02, cy + s * 0.07);
      g.lineTo(cx + s * 0.09, cy - s * 0.07);
      g.stroke();
    }
    return c;
  }
  function getSprites() {
    if (sprites && sprites.s === cell && sprites.T === world) return sprites;
    sprites = { s: cell, T: world, normal: paintCrate(cell, world, false, false), lock: paintCrate(cell, world, true, false), danger: paintCrate(cell, world, false, true) };
    return sprites;
  }

  /* ---------- 토끼 ---------- */
  /** cx, cy: 발 위치. dir: 0 위 1 오른쪽 2 아래 3 왼쪽 */
  function drawBunny(g, cx, cy, s, dir, T, opt = {}) {
    const walk = opt.walk || 0;
    const push = opt.push || 0;
    const hop = opt.hop || 0;
    const t = opt.time || 0;
    const side = dir === 1 || dir === 3;
    const flip = dir === 3 ? -1 : 1;
    const bob = Math.abs(Math.sin(walk)) * s * 0.035;
    const breathe = Math.sin(t * 2.4) * s * 0.006;
    g.save();
    g.translate(cx, cy - hop * s);
    // 그림자
    g.fillStyle = "rgba(0,0,0,0.24)";
    g.beginPath();
    g.ellipse(0, s * 0.01 + hop * s, s * 0.27 * (1 - hop * 0.35), s * 0.085 * (1 - hop * 0.35), 0, 0, TAU);
    g.fill();
    g.translate(0, -bob);
    if (side) g.scale(flip, 1);
    const lean = side ? push * s * 0.05 : 0;
    const leanY = !side ? (dir === 0 ? -1 : 1) * push * s * 0.02 : 0;
    const swing = Math.sin(walk) * s * 0.055;
    // 다리 · 신발
    const white = T.neon ? "#efeaff" : "#fbf7ef";
    const shade = T.neon ? "#c9c1ea" : "#e6dccb";
    const shoe = "#2d2a3a";
    const footY = -s * 0.03;
    const foot = (x, y) => {
      g.fillStyle = shoe;
      rr(g, x - s * 0.075, y - s * 0.03, s * 0.15, s * 0.06, s * 0.03);
      g.fill();
    };
    if (side) {
      g.strokeStyle = T.overall;
      g.lineWidth = s * 0.08;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-s * 0.02 + lean * 0.5, -s * 0.2);
      g.lineTo(-swing, footY);
      g.moveTo(s * 0.02 + lean * 0.5, -s * 0.2);
      g.lineTo(swing, footY);
      g.stroke();
      foot(-swing + s * 0.02, footY + s * 0.005);
      foot(swing + s * 0.02, footY + s * 0.005);
    } else {
      g.strokeStyle = T.overall;
      g.lineWidth = s * 0.085;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-s * 0.07, -s * 0.2);
      g.lineTo(-s * 0.08, footY - Math.max(0, swing));
      g.moveTo(s * 0.07, -s * 0.2);
      g.lineTo(s * 0.08, footY - Math.max(0, -swing));
      g.stroke();
      foot(-s * 0.085, footY - Math.max(0, swing));
      foot(s * 0.085, footY - Math.max(0, -swing));
    }
    // 몸 (멜빵 작업복)
    const by = -s * 0.32 + breathe;
    g.fillStyle = white;
    g.beginPath();
    g.ellipse(lean, by + leanY, s * 0.165, s * 0.17, 0, 0, TAU);
    g.fill();
    g.fillStyle = T.overall;
    g.beginPath();
    g.ellipse(lean, by + s * 0.055 + leanY, s * 0.168, s * 0.125, 0, 0, TAU);
    g.fill();
    if (dir !== 0) {
      g.fillRect(lean - s * 0.09, by - s * 0.055 + leanY, s * 0.18, s * 0.11);
      g.fillStyle = "#ffd24a";
      g.beginPath();
      g.arc(lean - s * 0.065, by - s * 0.035 + leanY, s * 0.017, 0, TAU);
      g.arc(lean + s * 0.065, by - s * 0.035 + leanY, s * 0.017, 0, TAU);
      g.fill();
    } else {
      // 꼬리
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(0, by + s * 0.1, s * 0.055, 0, TAU);
      g.fill();
    }
    // 팔
    g.strokeStyle = white;
    g.lineWidth = s * 0.07;
    g.lineCap = "round";
    g.beginPath();
    if (side) {
      const reach = push > 0.1 ? s * 0.25 : s * 0.05 - swing * 0.6;
      const up = push > 0.1 ? -s * 0.03 : s * 0.1;
      g.moveTo(lean + s * 0.03, by - s * 0.02);
      g.lineTo(lean + reach, by + up);
    } else {
      const up = push > 0.1 ? -s * 0.1 * (dir === 0 ? 1 : -0.4) : s * 0.08;
      g.moveTo(-s * 0.14, by - s * 0.02 + leanY);
      g.lineTo(-s * 0.19, by + up + swing * 0.5 + leanY);
      g.moveTo(s * 0.14, by - s * 0.02 + leanY);
      g.lineTo(s * 0.19, by + up - swing * 0.5 + leanY);
    }
    g.stroke();
    // 머리
    const hx = lean * 1.5;
    const hy = -s * 0.56 + breathe * 1.5 + leanY;
    // 귀
    const earSway = Math.sin(t * 1.7) * 0.05 + Math.sin(walk) * 0.1;
    const ear = (x, rot, bend) => {
      g.save();
      g.translate(hx + x, hy - s * 0.1);
      g.rotate(rot + earSway);
      g.fillStyle = white;
      g.beginPath();
      g.ellipse(0, -s * 0.13, s * 0.055, s * 0.15, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#ffb5c4";
      if (dir !== 0) {
        g.beginPath();
        g.ellipse(0, -s * 0.13, s * 0.028, s * 0.105, 0, 0, TAU);
        g.fill();
      }
      if (bend) {
        g.fillStyle = shade;
        g.beginPath();
        g.ellipse(s * 0.03, -s * 0.26, s * 0.05, s * 0.03, 0.5, 0, TAU);
        g.fill();
      }
      g.restore();
    };
    if (side) {
      ear(-s * 0.05, -0.3, false);
      ear(s * 0.03, -0.1, true);
    } else {
      ear(-s * 0.075, -0.15, false);
      ear(s * 0.075, 0.2, true);
    }
    g.fillStyle = white;
    g.beginPath();
    g.ellipse(hx, hy, s * 0.17, s * 0.15, 0, 0, TAU);
    g.fill();
    g.fillStyle = shade;
    g.beginPath();
    g.ellipse(hx, hy + s * 0.12, s * 0.11, s * 0.028, 0, 0, TAU);
    g.fill();
    let faceOn = false;
    if (opt.face && window.TodayFace && dir !== 0) {
      faceOn = window.TodayFace.drawHead(g, hx, hy, s * 0.165, { ring: Math.max(1, s * 0.015), ringColor: "#fff", flipX: dir === 3 });
    }
    if (!faceOn && dir !== 0) {
      const ink = "#2a2438";
      const blink = (t + (opt.seed || 0)) % 3.4 < 0.1;
      const eye = (x) => {
        if (blink) {
          g.strokeStyle = ink;
          g.lineWidth = s * 0.018;
          g.beginPath();
          g.moveTo(x - s * 0.025, hy);
          g.lineTo(x + s * 0.025, hy);
          g.stroke();
          return;
        }
        g.fillStyle = ink;
        g.beginPath();
        g.ellipse(x, hy - s * 0.002, s * 0.024, s * 0.03, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(x + s * 0.008, hy - s * 0.012, s * 0.008, 0, TAU);
        g.fill();
      };
      if (side) {
        eye(hx + s * 0.075);
        g.fillStyle = "#ff9fb0";
        g.beginPath();
        g.ellipse(hx + s * 0.155, hy + s * 0.03, s * 0.016, s * 0.012, 0, 0, TAU);
        g.fill();
        if (push > 0.1) {
          g.strokeStyle = ink;
          g.lineWidth = s * 0.016;
          g.beginPath();
          g.moveTo(hx + s * 0.04, hy - s * 0.055);
          g.lineTo(hx + s * 0.11, hy - s * 0.04);
          g.stroke();
        }
      } else {
        eye(hx - s * 0.06);
        eye(hx + s * 0.06);
        g.fillStyle = "#ff9fb0";
        g.beginPath();
        g.ellipse(hx, hy + s * 0.04, s * 0.016, s * 0.012, 0, 0, TAU);
        g.fill();
        g.strokeStyle = ink;
        g.lineWidth = s * 0.012;
        g.beginPath();
        g.moveTo(hx - s * 0.016, hy + s * 0.062);
        g.quadraticCurveTo(hx, hy + s * 0.075, hx + s * 0.016, hy + s * 0.062);
        g.stroke();
      }
    }
    g.restore();
  }

  /* ---------- 입자 ---------- */
  function cellCenter(x, y) {
    return [ox + (x + 0.5) * cell, oy + (y + 0.5) * cell];
  }
  function dust(x, y, dx, dy) {
    const [cx, cy] = cellCenter(x - dx * 0.5, y - dy * 0.5);
    const col = world.neon ? "#7fe9ff" : world.kind === "ice" ? "#ffffff" : "#efe2c2";
    for (let i = 0; i < 5; i += 1) {
      particles.push({ kind: "dust", x: cx + (Math.random() - 0.5) * cell * 0.5, y: cy + cell * 0.25, vx: -dx * 18 + (Math.random() - 0.5) * 22, vy: -dy * 18 - 8 - Math.random() * 12, life: 0.42, t: 0, size: cell * 0.09, color: col });
    }
  }
  function spark(x, y, color, n) {
    const [cx, cy] = cellCenter(x, y);
    particles.push({ kind: "ring", x: cx, y: cy - cell * 0.1, life: 0.5, t: 0, size: cell * 0.62, color });
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = 40 + Math.random() * 110;
      particles.push({ kind: "star", x: cx, y: cy - cell * 0.1, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.65, t: 0, size: cell * 0.075, color });
    }
  }
  /* 공중에 떠다니는 것 (꽃잎 · 낙엽 · 모래 · 눈 · 불꽃) */
  const floaters = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), z: 0.5 + Math.random() * 0.7, ph: Math.random() * 6 }));
  function drawFloaters(dt) {
    const T = world;
    for (const f of floaters) {
      const k = T.part;
      const speed = k === "snow" ? 0.05 : k === "sand" ? 0.12 : k === "spark" ? -0.035 : 0.035;
      f.y += speed * dt * f.z;
      f.x += (k === "sand" ? 0.1 : 0.018) * dt * f.z + Math.sin(time + f.ph) * 0.0004;
      if (f.y > 1.04) f.y = -0.04;
      if (f.y < -0.04) f.y = 1.04;
      if (f.x > 1.04) f.x = -0.04;
      const x = f.x * VW;
      const y = f.y * VH;
      const size = 3.2 * f.z;
      ctx.globalAlpha = 0.72;
      if (k === "petal") {
        ctx.fillStyle = "#ffc4d4";
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.55, time + f.ph, 0, TAU);
        ctx.fill();
      } else if (k === "leaf") {
        ctx.fillStyle = f.ph > 3 ? "#e9b24e" : "#c9812f";
        ctx.beginPath();
        ctx.ellipse(x, y, size * 1.2, size * 0.5, time * 0.7 + f.ph, 0, TAU);
        ctx.fill();
      } else if (k === "sand") {
        ctx.fillStyle = "#fff0cf";
        ctx.fillRect(x, y, size * 1.8, 1.1);
      } else if (k === "snow") {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, size * 0.62, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.5 + Math.sin(time * 5 + f.ph) * 0.4;
        ctx.fillStyle = f.ph > 3 ? "#ff7cc4" : "#7fe9ff";
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawParticles(dt) {
    for (const p of particles) {
      p.t += dt;
      const u = p.t / p.life;
      if (u >= 1) continue;
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 1 - u;
        ctx.lineWidth = Math.max(1, cell * 0.08 * (1 - u));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + u), 0, TAU);
        ctx.stroke();
      } else if (p.kind === "star") {
        p.vy += 180 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = p.color;
        const q = p.size * (1 - u * 0.5);
        ctx.fillRect(p.x - q / 2, p.y - q / 2, q, q);
      } else if (p.kind === "dust") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = (1 - u) * 0.75;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + u * 1.3), 0, TAU);
        ctx.fill();
      } else if (p.kind === "conf") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        ctx.globalAlpha = u > 0.8 ? (1 - u) * 5 : 1;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    particles = particles.filter((p) => p.t < p.life);
  }

  /* ---------- 한 프레임 ---------- */
  function update(dt) {
    if (introT < 1) introT = Math.min(1, introT + dt / 0.55);
    if (anim) {
      anim.t += dt;
      const u = Math.min(1, anim.t / anim.dur);
      const e = anim.crate ? u : ease(u);
      player.rx = lerp(anim.fx, anim.tx, e);
      player.ry = lerp(anim.fy, anim.ty, e);
      player.walk += dt * (anim.crate ? 15 : anim.dur < STEP ? 26 : 19);
      if (anim.crate) {
        anim.crate.c.rx = lerp(anim.crate.fx, anim.crate.tx, e);
        anim.crate.c.ry = lerp(anim.crate.fy, anim.crate.ty, e);
        player.push = Math.min(1, player.push + dt * 9);
      } else player.push = Math.max(0, player.push - dt * 7);
      if (u >= 1) {
        player.rx = anim.tx;
        player.ry = anim.ty;
        if (anim.crate) {
          anim.crate.c.rx = anim.crate.tx;
          anim.crate.c.ry = anim.crate.ty;
        }
        afterStep();
      }
    } else player.push = Math.max(0, player.push - dt * 7);
    if (player.bumpT > 0) player.bumpT -= dt;
    for (const c of crates) {
      if (c.bump > 0) c.bump -= dt;
      if (c.lock > 0) c.lock = Math.max(0, c.lock - dt * 2.4);
      const want = goals[idx(c.x, c.y)] ? 1 : 0;
      c.glow = lerp(c.glow, want, 1 - Math.exp(-dt * 8));
    }
    if (hintView) hintView.t += dt;
    if (clearT >= 0) {
      clearT += dt;
      player.hop = Math.abs(Math.sin(clearT * 7)) * 0.2 * Math.max(0, 1 - clearT / 1.5);
      if (clearT > 1.5 && screen === "play") showClear();
    } else player.hop = 0;
  }
  function draw(dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!scene || scene.world !== world || scene.w !== VW || scene.h !== VH) scene = { c: paintScene(), world, w: VW, h: VH };
    ctx.drawImage(scene.c, 0, 0, VW, VH);
    if (screen === "title" || screen === "stages") {
      drawFloaters(dt);
      if (screen === "title") drawTitleArt();
      return;
    }
    if (!layers) buildLayers();
    drawFloaters(dt);
    const s = cell;
    const pad = layers.pad;
    let sx = 0;
    let sy = 0;
    if (player.bumpT > 0) {
      sx = player.bumpX * 2 * Math.sin(player.bumpT * 40);
      sy = player.bumpY * 2 * Math.sin(player.bumpT * 40);
    }
    // 들어올 때 살짝 내려앉음
    const intro = ease(introT);
    ctx.save();
    ctx.globalAlpha = intro;
    ctx.translate(sx, sy + (1 - intro) * -22);
    const fw = layers.floor.width / DPR;
    const fh = layers.floor.height / DPR;
    ctx.drawImage(layers.floor, ox - pad, oy - pad, fw, fh);
    ctx.globalAlpha = 1;
    // 목표 빛 (비어 있으면 깜빡)
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (!goals[idx(x, y)] || crateAt(x, y)) continue;
        const [cx, cy] = cellCenter(x, y);
        ctx.strokeStyle = world.lock;
        ctx.globalAlpha = 0.3 + Math.sin(time * 3.4 + x + y) * 0.2;
        ctx.lineWidth = Math.max(1, s * 0.03);
        const k = 0.37 + ((time * 0.7 + x * 0.3) % 1) * 0.14;
        ctx.beginPath();
        ctx.ellipse(cx, cy, s * k, s * k * 0.95, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // 고른 상자의 방향 표시
    for (const o of options) drawArrow(o.tx, o.ty, o.dx, o.dy, "#ffffff", time);
    if (hintView) drawArrow(hintView.x + hintView.dx, hintView.y + hintView.dy, hintView.dx, hintView.dy, "#ffe14d", time * 1.6);
    const spr = getSprites();
    const drawRows = [];
    for (let y = 0; y < H; y += 1) drawRows[y] = [];
    for (const c of crates) drawRows[clamp(Math.ceil(c.ry - 0.001), 0, H - 1)].push(c);
    const pRow = clamp(Math.ceil(player.ry - 0.001), 0, H - 1);
    for (let y = 0; y < H; y += 1) {
      const row = layers.rows[y];
      if (row) ctx.drawImage(row, ox - pad, oy + y * s - s * DEPTH - 1, row.width / DPR, row.height / DPR);
      const items = drawRows[y];
      const drawPlayerLater = pRow === y;
      for (const c of items) {
        const x = ox + c.rx * s;
        const yy = oy + c.ry * s;
        const onGoal = goals[idx(c.x, c.y)] === 1;
        const dead = !onGoal && !liveMask[idx(c.x, c.y)];
        // 그림자
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(x + s * 0.54, yy + s * 0.88, s * 0.46, s * 0.14, 0, 0, TAU);
        ctx.fill();
        const q = c.lock * 0.14;
        const moving = anim && anim.crate && anim.crate.c === c ? Math.sin(anim.t * 40) * s * 0.012 : 0;
        const bumpK = c.bump > 0 ? Math.sin(c.bump * 40) * s * 0.02 : 0;
        const sc = 1 + q;
        const dw = (s * 1.2) * sc;
        const dh = (s * 1.5) * sc;
        ctx.drawImage(dead ? spr.danger : onGoal ? spr.lock : spr.normal, x - s * 0.1 - (dw - s * 1.2) / 2 + bumpK, yy - s * 0.1 - s * CRATE_H - (dh - s * 1.5) * 0.6 + moving, dw, dh);
        if (c.glow > 0.02) {
          const gl = ctx.createRadialGradient(x + s / 2, yy + s * 0.35, 0, x + s / 2, yy + s * 0.35, s * 0.9);
          gl.addColorStop(0, `${world.lock}55`);
          gl.addColorStop(1, `${world.lock}00`);
          ctx.globalAlpha = c.glow * (0.7 + Math.sin(time * 3 + c.x) * 0.3);
          ctx.fillStyle = gl;
          ctx.fillRect(x - s * 0.4, yy - s * 0.55, s * 1.8, s * 1.8);
          ctx.globalAlpha = 1;
        }
        if (selected === c) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = Math.max(2, s * 0.05);
          ctx.setLineDash([s * 0.14, s * 0.1]);
          ctx.lineDashOffset = -time * 24;
          rr(ctx, x + s * 0.03, yy - s * CRATE_H + s * 0.03, s * 0.94, s * 0.94 + s * CRATE_H, s * 0.12);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      if (drawPlayerLater) {
        const fx = player.bumpT > 0 ? player.bumpX * Math.sin((player.bumpT / 0.16) * Math.PI) * s * 0.1 : 0;
        const fy = player.bumpT > 0 ? player.bumpY * Math.sin((player.bumpT / 0.16) * Math.PI) * s * 0.1 : 0;
        drawBunny(ctx, ox + (player.rx + 0.5) * s + fx, oy + (player.ry + 0.86) * s + fy, s * 1.26, player.dir, world, { walk: player.walk, push: player.push, hop: player.hop, time, face: true });
      }
    }
    ctx.restore();
    drawParticles(dt);
  }
  function drawArrow(x, y, dx, dy, color, t) {
    const [cx, cy] = cellCenter(x, y);
    const a = Math.atan2(dy, dx);
    const s = cell;
    const off = Math.sin(t * 5) * s * 0.05;
    ctx.save();
    ctx.translate(cx + dx * off, cy + dy * off);
    ctx.rotate(a);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 0.19, 0);
    ctx.lineTo(-s * 0.08, -s * 0.17);
    ctx.lineTo(-s * 0.08, -s * 0.06);
    ctx.lineTo(-s * 0.18, -s * 0.06);
    ctx.lineTo(-s * 0.18, s * 0.06);
    ctx.lineTo(-s * 0.08, s * 0.06);
    ctx.lineTo(-s * 0.08, s * 0.17);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  /** 첫 화면: 토끼가 상자를 미는 그림 */
  function drawTitleArt() {
    const heroEl = $("hero-slot");
    if (!heroEl) return;
    const r = heroEl.getBoundingClientRect();
    const base = $("stage").getBoundingClientRect();
    if (!r.width || r.bottom < 0) return;
    const s = Math.min(r.height * 0.92, r.width * 0.46);
    const footY = r.top - base.top + r.height * 0.95;
    const cx = r.left - base.left + r.width / 2;
    const T = WORLDS[0];
    const loop = (time * 0.5) % 1;
    const walk = time * 11;
    // 땅
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.beginPath();
    ctx.ellipse(cx, footY + 2, s * 1.1, s * 0.13, 0, 0, TAU);
    ctx.fill();
    drawBunny(ctx, cx - s * 0.42, footY, s * 1.1, 1, T, { walk, push: 1, time, face: true });
    if (!titleCrate || titleCrate.s !== s) {
      const old = world;
      world = T;
      titleCrate = { s, c: paintCrate(s * 0.62, T, false, false) };
      world = old;
    }
    const w = s * 0.62;
    const wob = Math.sin(time * 11) * s * 0.008;
    ctx.drawImage(titleCrate.c, cx - s * 0.2 - w * 0.1, footY - w * 1.04 - w * 0.1 + wob, w * 1.2, w * 1.5);
    void loop;
  }
  let titleCrate = null;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (!paused) {
      time += dt;
      if (screen === "play" || screen === "clear") update(dt);
    }
    draw(paused ? 0 : dt);
  }

  /* ---------- 공용 ---------- */
  if (window.TodayGameRank) {
    window.TodayGameRank.mount({ gameId: "sokoban", gameTitle: "상자야 굴러가", formParent: $("rank-slot") });
  }
  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => screen === "play" && clearT < 0,
      isPaused: () => paused,
      pause() {
        if (screen !== "play") return false;
        paused = true;
        return true;
      },
      resume() {
        if (!paused) return false;
        paused = false;
        last = performance.now();
        return true;
      },
    });
  }
  /* 공용 '내 얼굴' 버튼은 첫 화면 메뉴 맨 위에 (자동으로 달면 긴 화면 맨 아래로 내려감) */
  if (window.TodayFace && window.TodayFace.mountChip) {
    const menu = document.querySelector(".t-menu");
    if (!document.querySelector(".today-face-chip")) window.TodayFace.mountChip(menu, $("start-btn"));
  }
  addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  setScreen("title");
  resize();
  requestAnimationFrame(frame);

  // 점검 · 썸네일용
  window.Sokoban = {
    get state() {
      return { screen, stage, moves, pushes, clearT, anim: Boolean(anim), introT, player: { x: player.x, y: player.y }, crates: crates.map((c) => ({ x: c.x, y: c.y })), path: path.length, selected: Boolean(selected), options: options.map((o) => [o.tx, o.ty]), hint: hintView, usedHint, W, H, cell, ox, oy };
    },
    loadStage,
    startStage,
    step,
    undo,
    restart,
    hint,
    tapCell,
    save,
    isOpen,
    starsFor,
    pointsFor,
    LEVELS,
    finish() {
      if (clearT >= 0) clearT = 2;
    },
    skipIntro() {
      introT = 1;
    },
    art: { drawBunny, paintCrate, WORLDS, setDpr(d) { DPR = d; } },
  };
})();
