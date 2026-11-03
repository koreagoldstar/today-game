(() => {
  "use strict";

  /*
   * 짝짝 사천성
   *  - 꽉 찬 판 + 마작패처럼 두툼한 타일 (그림은 귀여운 동물 그대로)
   *  - 같은 그림을 꺾임 2번 이내의 선으로 연결. 판 바깥 한 칸으로 돌아가는 길도 됨
   *  - 판마다 없앨 때 타일이 미는 방향이 다름: 아래 · 위 · 왼쪽 · 오른쪽 · 가운데로 · 바깥으로
   *  - 콤보 · 별 3개 · 폭탄 · 진행 저장 · 단계 고르기 · 타임어택
   */
  const TILE_FILES = ["chick", "bear", "cat", "bunny", "calico", "clover", "star", "watermelon", "pig", "fox", "panda", "unicorn", "frog", "penguin", "blossom", "donut", "dog", "tiger", "owl", "hamster", "lemon", "cupcake", "fish", "icecream", "mushroom", "bee", "crab", "moon", "gem", "cactus", "rocket"];
  const BOMB = TILE_FILES.length; // 폭탄 타일 번호
  const TOTAL = 60;
  const SAVE_KEY = "sichuan-v2";
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);

  const WORLDS = [
    { name: "초록 마작판", felt: ["#23845c", "#176445"], frame: ["#9c6a35", "#6b4420"], bg: ["#124a36", "#0a2c20"], accent: "#ffd84a" },
    { name: "원목 찻집", felt: ["#b98a52", "#9a6f3f"], frame: ["#5f3d1e", "#3f2712"], bg: ["#46301c", "#2a1b0f"], accent: "#ffe08a" },
    { name: "벚꽃 정원", felt: ["#f0b3c6", "#e396ae"], frame: ["#b85f7c", "#8f4460"], bg: ["#6b3350", "#431f33"], accent: "#fff3a8" },
    { name: "푸른 바다", felt: ["#2ea3cc", "#1e82a8"], frame: ["#15597c", "#0c3f59"], bg: ["#0f3e5c", "#08273b"], accent: "#ffe27a" },
    { name: "별밤", felt: ["#3d3282", "#2c2466"], frame: ["#8263dc", "#5e44ad"], bg: ["#181238", "#0c0922"], accent: "#ffd84a" },
    { name: "황금 궁전", felt: ["#86242f", "#661822"], frame: ["#ecbf40", "#b78c1e"], bg: ["#37101a", "#20080d"], accent: "#ffe88a" },
  ];
  const MODE_INFO = {
    none: { name: "그대로", icon: "" },
    down: { name: "아래로 떨어져요", icon: "↓" },
    up: { name: "위로 올라가요", icon: "↑" },
    left: { name: "왼쪽으로 밀려요", icon: "←" },
    right: { name: "오른쪽으로 밀려요", icon: "→" },
    vcenter: { name: "위아래 가운데로 모여요", icon: "↕" },
    hcenter: { name: "좌우 가운데로 모여요", icon: "↔" },
    vout: { name: "위아래 바깥으로 벌어져요", icon: "⇕" },
    hout: { name: "좌우 바깥으로 벌어져요", icon: "⇔" },
  };

  function stageInfo(i) {
    const w = Math.floor(i / 10);
    const k = i % 10;
    const sizes = [[6, 8], [6, 10], [7, 10], [8, 10], [8, 12], [9, 12], [10, 12], [10, 14]];
    const idx = i < 3 ? 0 : i < 7 ? 1 : i < 15 ? 2 : i < 27 ? 3 : i < 40 ? 4 : i < 47 ? 5 : i < 53 ? 6 : 7;
    const [a, b] = sizes[idx];
    const pool = w === 0 ? ["none", "none", "down", "left"] : w === 1 ? ["down", "left", "up", "right", "none"] : w === 2 ? ["hcenter", "down", "vcenter", "left", "up", "right"] : ["hcenter", "vout", "down", "hout", "left", "vcenter", "up", "right"];
    const mode = i < 2 ? "none" : pool[(i + w) % pool.length];
    const pairs = (a * b) / 2;
    const t = i / (TOTAL - 1);
    const perPair = lerp(4, 2.6, t);
    return {
      i,
      world: w,
      k,
      a,
      b,
      pairs,
      mode,
      kinds: Math.min(TILE_FILES.length, Math.round(9 + i * 0.42)),
      bombs: i >= 8 && k >= 5 ? 1 + Math.floor(i / 30) : 0,
      perPair,
      boss: k === 9,
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
      g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
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
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(c.destination);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.03);
    },
    tap() {
      // 패 놓는 소리
      this.noise(0.035, 2600, "bandpass", 0.22);
      this.tone(1500, 0.04, "triangle", 0.08, 0.7);
    },
    match(combo) {
      const f = 660 * Math.pow(2, Math.min(combo, 14) / 12);
      this.noise(0.09, 4200, "highpass", 0.1);
      this.tone(f, 0.11, "triangle", 0.15);
      this.tone(f * 1.5, 0.17, "sine", 0.1, 1, 0.06);
    },
    wrong() {
      this.tone(190, 0.13, "sawtooth", 0.09, 0.75);
    },
    slide() {
      this.noise(0.1, 900, "bandpass", 0.08);
    },
    shuffle() {
      for (let i = 0; i < 7; i += 1) this.noise(0.04, 2200, "bandpass", 0.14, i * 0.05);
    },
    boom() {
      this.noise(0.45, 600, "lowpass", 0.5);
      this.tone(120, 0.32, "square", 0.14, 0.4);
    },
    tick() {
      this.tone(980, 0.05, "square", 0.05);
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.26, "triangle", 0.15, 1, i * 0.1));
    },
    star(i) {
      this.tone(880 + i * 220, 0.2, "triangle", 0.15);
    },
    lose() {
      this.tone(330, 0.3, "triangle", 0.13, 0.8);
      this.tone(247, 0.45, "triangle", 0.13, 0.8, 0.24);
    },
    ui() {
      this.tone(720, 0.05, "sine", 0.1);
    },
  };

  /* ---------- 저장 ---------- */
  const save = (() => {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return { best: d.best || {}, last: d.last || 0, bestAttack: d.bestAttack || 0, items: d.items || { hint: 3, shuffle: 2, bolt: 1, clock: 1 } };
    } catch (_) {
      return { best: {}, last: 0, bestAttack: 0, items: { hint: 3, shuffle: 2, bolt: 1, clock: 1 } };
    }
  })();
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_) {
      /* 저장이 막혀 있어도 게임은 계속 */
    }
  }
  const totalStars = () => Object.values(save.best).reduce((a, b) => a + (b.stars || 0), 0);
  const totalScore = () => Object.values(save.best).reduce((a, b) => a + (b.score || 0), 0);
  function isOpen(i) {
    let top = -1;
    for (const k of Object.keys(save.best)) top = Math.max(top, Number(k));
    return i <= top + 3;
  }

  /* ---------- 상태 ---------- */
  const stageEl = $("stage");
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  let VW = 390;
  let VH = 700;
  let DPR = 1;
  let screen = "title";
  let paused = false;
  let time = 0;
  let last = performance.now();

  let info = stageInfo(0);
  let world = WORLDS[0];
  let mode = "none";
  let attack = false;
  let C = 6;
  let R = 8;
  let grid = []; // grid[y][x] = 타일 또는 null
  let remain = 0;
  let selected = null;
  let hintPair = null;
  let idleT = 0;
  let timeLeft = 60;
  let timeMax = 60;
  let score = 0;
  let combo = 0;
  let comboT = 0;
  let bestCombo = 0;
  let shufflesUsed = 0;
  let itemsUsed = 0;
  let fx = [];
  let floats = [];
  let parts = [];
  let lines = [];
  let shake = 0;
  let introT = 1;
  let cell = 40;
  let tileH = 48;
  let ox = 0;
  let oy = 0;
  let boardW = 0;
  let boardH = 0;
  let sprites = new Map();
  let boardCache = null;
  let tickSec = -1;
  let clearT = -1;
  let banner = null;
  const imgs = [];

  function loadAssets() {
    const names = [...TILE_FILES, "bomb"];
    return Promise.all(
      names.map(
        (n, i) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              imgs[i] = im;
              res();
            };
            im.onerror = () => res();
            im.src = `assets/tiles/${n}.png`;
          })
      )
    );
  }

  /* ---------- 판 만들기 ---------- */
  function shuffled(a) {
    const out = a.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function newTile(kind, x, y) {
    return { kind, x, y, rx: x, ry: y, pop: 0, shake: 0, delay: 0 };
  }
  function buildBoard() {
    const landscape = VW > VH * 1.05;
    C = landscape ? Math.max(info.a, info.b) : Math.min(info.a, info.b);
    R = landscape ? Math.min(info.a, info.b) : Math.max(info.a, info.b);
    // 패가 손가락보다 작아지면 줄을 줄임 (짝수 유지)
    while (R > 4 && measure(C, R).cell < 29) R -= 2;
    while (C > 6 && measure(C, R).cell < 29) C -= 2;
    const pairs = (C * R) / 2;
    timeMax = Math.round(pairs * info.perPair + 14);
    const bag = [];
    const kinds = info.kinds;
    for (let i = 0; i < info.bombs; i += 1) bag.push(BOMB, BOMB);
    for (let p = 0; bag.length < pairs * 2; p += 1) bag.push(p % kinds, p % kinds);
    let tries = 0;
    do {
      const list = shuffled(bag);
      grid = [];
      for (let y = 0; y < R; y += 1) {
        const row = [];
        for (let x = 0; x < C; x += 1) row.push(newTile(list[y * C + x], x, y));
        grid.push(row);
      }
      tries += 1;
    } while (countMoves() < Math.min(5, 2 + kinds / 6) && tries < 40);
    remain = C * R;
    grid.forEach((row) =>
      row.forEach((t) => {
        t.delay = (t.x + t.y) * 0.022;
      })
    );
  }
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= C || y >= R ? null : grid[y][x]);

  /* ---------- 길 찾기: 꺾임 2번 이내, 판 바깥 한 칸까지 ---------- */
  function clearLine(x1, y1, x2, y2) {
    if (x1 === x2) {
      const a = Math.min(y1, y2);
      const b = Math.max(y1, y2);
      for (let y = a + 1; y < b; y += 1) if (tileAt(x1, y)) return false;
      return true;
    }
    if (y1 === y2) {
      const a = Math.min(x1, x2);
      const b = Math.max(x1, x2);
      for (let x = a + 1; x < b; x += 1) if (tileAt(x, y1)) return false;
      return true;
    }
    return false;
  }
  function findPath(a, b) {
    if (a === b || a.kind !== b.kind) return null;
    const ax = a.x;
    const ay = a.y;
    const bx = b.x;
    const by = b.y;
    if ((ax === bx || ay === by) && clearLine(ax, ay, bx, by)) return [[ax, ay], [bx, by]];
    let best = null;
    const consider = (pts) => {
      let len = 0;
      for (let i = 1; i < pts.length; i += 1) len += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      if (!best || len < best.len) best = { pts, len };
    };
    // 한 번 꺾임
    for (const [px, py] of [[ax, by], [bx, ay]]) {
      if (!tileAt(px, py) && clearLine(ax, ay, px, py) && clearLine(px, py, bx, by)) consider([[ax, ay], [px, py], [bx, by]]);
    }
    if (best) return best.pts;
    // 두 번 꺾임: 가로로 나갔다가 세로로 / 세로로 나갔다가 가로로
    for (let x = -1; x <= C; x += 1) {
      if (x === ax && x === bx) continue;
      if (tileAt(x, ay) || tileAt(x, by)) continue;
      if (x === ax || x === bx) continue;
      if (clearLine(ax, ay, x, ay) && clearLine(x, ay, x, by) && clearLine(x, by, bx, by)) consider([[ax, ay], [x, ay], [x, by], [bx, by]]);
    }
    for (let y = -1; y <= R; y += 1) {
      if (y === ay || y === by) continue;
      if (tileAt(ax, y) || tileAt(bx, y)) continue;
      if (clearLine(ax, ay, ax, y) && clearLine(ax, y, bx, y) && clearLine(bx, y, bx, by)) consider([[ax, ay], [ax, y], [bx, y], [bx, by]]);
    }
    return best ? best.pts : null;
  }
  function allTiles() {
    const out = [];
    for (let y = 0; y < R; y += 1) for (let x = 0; x < C; x += 1) if (grid[y][x]) out.push(grid[y][x]);
    return out;
  }
  function findPair() {
    const list = allTiles();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (list[i].kind === list[j].kind && findPath(list[i], list[j])) return [list[i], list[j]];
      }
    }
    return null;
  }
  function countMoves() {
    let n = 0;
    const list = allTiles();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (list[i].kind === list[j].kind && findPath(list[i], list[j])) n += 1;
      }
    }
    return n;
  }

  /* ---------- 미는 규칙 ---------- */
  function packLine(tiles, setPos, n, toEnd) {
    tiles.forEach((t, i) => setPos(t, toEnd ? n - tiles.length + i : i));
  }
  function applyGravity() {
    if (mode === "none") return false;
    const before = allTiles().map((t) => [t, t.x, t.y]);
    const next = [];
    for (let y = 0; y < R; y += 1) next.push(new Array(C).fill(null));
    const place = (t, x, y) => {
      t.x = x;
      t.y = y;
      next[y][x] = t;
    };
    const col = (x, a, b) => {
      const out = [];
      for (let y = a; y < b; y += 1) if (grid[y][x]) out.push(grid[y][x]);
      return out;
    };
    const row = (y, a, b) => {
      const out = [];
      for (let x = a; x < b; x += 1) if (grid[y][x]) out.push(grid[y][x]);
      return out;
    };
    const midR = Math.floor(R / 2);
    const midC = Math.floor(C / 2);
    if (mode === "down" || mode === "up") {
      for (let x = 0; x < C; x += 1) packLine(col(x, 0, R), (t, i) => place(t, x, i), R, mode === "down");
    } else if (mode === "left" || mode === "right") {
      for (let y = 0; y < R; y += 1) packLine(row(y, 0, C), (t, i) => place(t, i, y), C, mode === "right");
    } else if (mode === "vcenter" || mode === "vout") {
      const toMid = mode === "vcenter";
      for (let x = 0; x < C; x += 1) {
        packLine(col(x, 0, midR), (t, i) => place(t, x, i), midR, toMid);
        packLine(col(x, midR, R), (t, i) => place(t, x, midR + i), R - midR, !toMid);
      }
    } else {
      const toMid = mode === "hcenter";
      for (let y = 0; y < R; y += 1) {
        packLine(row(y, 0, midC), (t, i) => place(t, i, y), midC, toMid);
        packLine(row(y, midC, C), (t, i) => place(t, midC + i, y), C - midC, !toMid);
      }
    }
    grid = next;
    return before.some(([t, x, y]) => t.x !== x || t.y !== y);
  }

  /* ---------- 진행 ---------- */
  function select(t) {
    if (screen !== "play" || paused || clearT >= 0) return;
    Sound.unlock();
    idleT = 0;
    hintPair = null;
    if (!selected) {
      selected = t;
      t.pop = 1;
      Sound.tap();
      return;
    }
    if (selected === t) {
      selected = null;
      Sound.tap();
      return;
    }
    const path = selected.kind === t.kind ? findPath(selected, t) : null;
    if (path) {
      removePair(selected, t, path);
      selected = null;
    } else {
      // 다른 그림이거나 막혔으면 새 타일을 고름 (막혔으면 살짝 흔듦)
      if (selected.kind === t.kind) {
        selected.shake = 0.28;
        t.shake = 0.28;
        Sound.wrong();
        addFloat(t, "길이 막혔어요", "#ffd0d0", true);
      } else Sound.tap();
      selected = t;
      t.pop = 1;
    }
  }
  function removeTileAt(t) {
    if (grid[t.y][t.x] === t) {
      grid[t.y][t.x] = null;
      remain -= 1;
    }
  }
  function tileXY(t) {
    return [ox + (t.rx + 0.5) * cell, oy + (t.ry + 0.5) * tileH];
  }
  function removePair(a, b, path) {
    const isBomb = a.kind === BOMB;
    selected = null;
    hintPair = null;
    // 선: 움직이기 전 자리로 그림
    lines.push({ pts: path.map((p) => cellPoint(p[0], p[1])), t: 0, life: 0.3, seed: Math.random() * 100 });
    combo = comboT > 0 ? combo + 1 : 0;
    comboT = attack ? 4.5 : 3.6;
    bestCombo = Math.max(bestCombo, combo);
    const gain = 100 + combo * 30;
    score += gain;
    fx.push({ t: 0, life: 0.28, tile: a, x: a.rx, y: a.ry }, { t: 0, life: 0.28, tile: b, x: b.rx, y: b.ry });
    const [ax, ay] = tileXY(a);
    const [bx, by] = tileXY(b);
    burst(ax, ay, 14);
    burst(bx, by, 14);
    removeTileAt(a);
    removeTileAt(b);
    Sound.match(combo);
    floats.push({ x: (ax + bx) / 2, y: (ay + by) / 2, text: `+${gain}`, color: "#fff", t: 0, life: 0.8, size: 19 });
    if (combo >= 1) floats.push({ x: VW / 2, y: oy + boardH * 0.3, text: `${combo + 1} 콤보!`, color: world.accent, t: 0, life: 0.85, size: 30 + Math.min(14, combo * 2), big: true });
    if (attack) {
      timeLeft = Math.min(timeMax, timeLeft + 0.9 + Math.min(1.1, combo * 0.1));
    }
    if (isBomb) explode(a, b);
    if (applyGravity()) Sound.slide();
    updateHud();
    if (remain <= 0) {
      if (attack) nextAttackBoard();
      else stageClear();
      return;
    }
    ensureMoves();
  }
  /** 폭탄: 두 폭탄 주변 타일을 짝까지 함께 없앰 (짝이 안 맞아 못 끝나는 일이 없게) */
  function explode(a, b) {
    Sound.boom();
    shake = 12;
    const victims = new Set();
    for (const c of [a, b]) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const t = tileAt(c.x + dx, c.y + dy);
          if (t) victims.add(t);
        }
      }
    }
    const boom = (t) => {
      fx.push({ t: 0, life: 0.34, tile: t, x: t.rx, y: t.ry });
      const [x, y] = tileXY(t);
      burst(x, y, 10);
      removeTileAt(t);
    };
    for (const t of victims) {
      if (grid[t.y][t.x] !== t) continue;
      boom(t);
      const mate = allTiles().find((m) => m.kind === t.kind);
      if (mate) boom(mate);
      score += 60;
    }
    floats.push({ x: VW / 2, y: oy + boardH * 0.42, text: "펑!", color: "#ffb84a", t: 0, life: 0.8, size: 46, big: true });
  }
  /** 연결할 짝이 없으면 공짜로 섞음 */
  function ensureMoves() {
    let guard = 0;
    while (remain > 0 && !findPair() && guard < 60) {
      shuffleBoard();
      guard += 1;
      if (guard === 1) {
        banner = { text: "짝이 없어서 새로 섞었어요", t: 1.6 };
        Sound.shuffle();
      }
    }
  }
  function shuffleBoard() {
    const list = allTiles();
    const kinds = shuffled(list.map((t) => t.kind));
    list.forEach((t, i) => {
      t.kind = kinds[i];
      t.pop = 0.8;
    });
    selected = null;
    hintPair = null;
    shufflesUsed += 1;
  }
  function updateHud() {
    $("hud-stage").textContent = attack ? "타임어택" : `${info.world + 1}-${info.k + 1}`;
    $("hud-world").textContent = attack ? "시간 안에 많이!" : world.name;
    $("hud-score").textContent = score.toLocaleString("ko-KR");
    $("hud-remain").textContent = remain;
    const mi = MODE_INFO[mode];
    const mEl = $("hud-mode");
    mEl.textContent = mi.icon ? `${mi.icon} ${mi.name}` : "패가 움직이지 않아요";
    for (const key of ["hint", "shuffle", "bolt", "clock"]) {
      $(`n-${key}`).textContent = save.items[key];
      document.querySelector(`[data-item="${key}"]`).classList.toggle("empty", save.items[key] <= 0);
    }
  }
  function startStage(i) {
    attack = false;
    info = stageInfo(clamp(i, 0, TOTAL - 1));
    if (window.TodayGameRank) window.TodayGameRank.reset();
    score = 0;
    setupBoard();
    timeLeft = timeMax;
    updateHud();
    setScreen("play");
  }
  function setupBoard() {
    world = attack ? WORLDS[attackLevel % WORLDS.length] : WORLDS[info.world];
    mode = info.mode;
    resetRuntime();
    document.body.classList.add("in-play");
    buildBoard();
    fitBoard();
    ensureMoves();
    shufflesUsed = 0;
    itemsUsed = 0;
    banner = MODE_INFO[mode].icon ? { text: `${MODE_INFO[mode].icon} ${MODE_INFO[mode].name}`, t: 2 } : null;
  }
  function resetRuntime() {
    selected = null;
    hintPair = null;
    idleT = 0;
    combo = 0;
    comboT = 0;
    bestCombo = 0;
    fx = [];
    floats = [];
    parts = [];
    lines = [];
    shake = 0;
    introT = 0;
    clearT = -1;
    tickSec = -1;
  }
  function startAttack() {
    attack = true;
    score = 0;
    attackLevel = 0;
    info = attackInfo(0);
    if (window.TodayGameRank) window.TodayGameRank.reset();
    setupBoard();
    timeMax = 90;
    timeLeft = 60;
    updateHud();
    setScreen("play");
  }
  let attackLevel = 0;
  function attackInfo(n) {
    const s = stageInfo(Math.min(40, 3 + n * 7));
    const pool = ["down", "left", "hcenter", "up", "right", "vcenter", "hout", "vout"];
    return { ...s, mode: pool[n % pool.length], bombs: 1 };
  }
  function nextAttackBoard() {
    attackLevel += 1;
    score += 500;
    timeLeft = Math.min(timeMax, timeLeft + 20);
    info = attackInfo(attackLevel);
    const keepCombo = combo;
    Sound.win();
    setupBoard();
    timeMax = 90;
    combo = keepCombo;
    comboT = 4.5;
    updateHud();
  }
  function stageClear() {
    clearT = 0;
    selected = null;
    const pct = timeLeft / timeMax;
    const stars = pct >= 0.33 && itemsUsed <= 1 ? 3 : pct >= 0.12 ? 2 : 1;
    const bonus = Math.round(timeLeft) * 12 + stars * 200 + info.i * 20;
    score += bonus;
    const prev = save.best[info.i];
    save.best[info.i] = { stars: Math.max(stars, prev ? prev.stars : 0), score: Math.max(score, prev ? prev.score : 0) };
    save.last = Math.min(TOTAL - 1, info.i + 1);
    // 아이템 보상은 처음 받을 때만 (같은 판을 되풀이해 모으지 않게)
    const reward = [];
    if (stars >= 2 && !(prev && prev.stars >= 2)) {
      const key = ["hint", "shuffle", "bolt", "clock"][info.i % 4];
      save.items[key] = Math.min(9, save.items[key] + 1);
      reward.push(key);
    }
    const bossReward = info.boss && !prev;
    if (bossReward) {
      for (const key of ["hint", "shuffle", "bolt", "clock"]) save.items[key] = Math.min(9, save.items[key] + 1);
    }
    persist();
    Sound.win();
    for (let i = 0; i < 90; i += 1) {
      parts.push({ conf: true, x: Math.random() * VW, y: -10 - Math.random() * VH * 0.5, vx: (Math.random() - 0.5) * 40, vy: 110 + Math.random() * 150, life: 2.2, t: 0, size: 4 + Math.random() * 5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10, color: ["#ffd24a", "#ff6f91", "#5fd0ff", "#8ff07a", "#ffffff"][i % 5] });
    }
    lastClear = { stars, bonus, reward, bossReward };
    updateHud();
  }
  let lastClear = null;
  const ITEM_NAME = { hint: "힌트", shuffle: "섞기", bolt: "번개", clock: "시계" };
  function showClear() {
    const c = lastClear;
    const isLast = info.i >= TOTAL - 1;
    $("clear-title").textContent = isLast ? "사천성 정복!" : info.boss ? `${world.name} 완료!` : "클리어!";
    $("clear-stage").textContent = `${info.world + 1}-${info.k + 1}`;
    $("clear-score").textContent = score.toLocaleString("ko-KR");
    $("clear-bonus").textContent = `+${c.bonus.toLocaleString("ko-KR")}`;
    $("clear-combo").textContent = bestCombo + 1;
    $("clear-reward").textContent = c.bossReward ? "모든 아이템 +1" : c.reward.length ? `${ITEM_NAME[c.reward[0]]} +1` : "";
    document.querySelectorAll("#clear-stars i").forEach((el, i) => {
      el.classList.remove("on");
      if (i < c.stars) {
        setTimeout(() => {
          el.classList.add("on");
          Sound.star(i);
        }, 220 + i * 230);
      }
    });
    $("next-btn").classList.toggle("hidden", isLast);
    const showRank = isLast || info.boss;
    $("clear-rank").classList.toggle("hidden", !showRank);
    setScreen("clear");
    if (showRank && window.TodayGameRank) {
      window.TodayGameRank.mount({ gameId: "memory", gameTitle: "짝짝 사천성", formParent: $("clear-rank") });
      window.TodayGameRank.open(Math.max(1, totalScore()), { label: `${info.world + 1}-${info.k + 1}까지 · 총점 ${totalScore().toLocaleString("ko-KR")}` });
    }
  }
  function fail() {
    Sound.lose();
    if (attack) {
      save.bestAttack = Math.max(save.bestAttack, score);
      persist();
      $("over-title").textContent = "시간 끝!";
      $("over-detail").innerHTML = `타임어택 ${attackLevel + 1}판까지<br />점수 <b>${score.toLocaleString("ko-KR")}</b> · 최고 ${save.bestAttack.toLocaleString("ko-KR")}`;
    } else {
      $("over-title").textContent = "시간이 끝났어요";
      $("over-detail").innerHTML = `${info.world + 1}-${info.k + 1} · 남은 패 ${remain}개<br />점수 <b>${score.toLocaleString("ko-KR")}</b> · 총점 ${totalScore().toLocaleString("ko-KR")}`;
    }
    setScreen("over");
    if (window.TodayGameRank) {
      window.TodayGameRank.mount({ gameId: "memory", gameTitle: "짝짝 사천성", formParent: $("over-rank") });
      const rankScore = attack ? score : Math.max(score, totalScore());
      window.TodayGameRank.open(Math.max(1, rankScore), { label: attack ? `타임어택 · ${score.toLocaleString("ko-KR")}점` : `${info.world + 1}-${info.k + 1} · 총점 ${rankScore.toLocaleString("ko-KR")}` });
    }
  }
  function useItem(key) {
    if (screen !== "play" || paused || clearT >= 0) return;
    if (save.items[key] <= 0) {
      Sound.wrong();
      return;
    }
    Sound.unlock();
    if (key === "hint") {
      const p = findPair();
      if (!p) return;
      hintPair = { a: p[0], b: p[1], t: 0 };
      Sound.ui();
    } else if (key === "shuffle") {
      shuffleBoard();
      ensureMoves();
      Sound.shuffle();
    } else if (key === "bolt") {
      const p = findPair();
      if (!p) return;
      const path = findPath(p[0], p[1]);
      if (path) removePair(p[0], p[1], path);
    } else if (key === "clock") {
      timeLeft = Math.min(timeMax + 20, timeLeft + 20);
      timeMax = Math.max(timeMax, timeLeft);
      Sound.star(2);
      floats.push({ x: VW / 2, y: oy + boardH * 0.3, text: "+20초", color: "#8ff0ff", t: 0, life: 0.9, size: 32, big: true });
    }
    save.items[key] -= 1;
    itemsUsed += 1;
    persist();
    updateHud();
  }

  /* ---------- 화면 전환 ---------- */
  function setScreen(name) {
    screen = name;
    for (const k of ["title", "stages", "clear", "over"]) $(k).classList.toggle("hidden", k !== name);
    const inPlay = name === "play" || name === "clear" || name === "over";
    document.body.classList.toggle("in-play", inPlay);
    if (name === "title") renderTitle();
    last = performance.now();
    if (inPlay) fitBoard();
  }
  function firstOpen() {
    for (let i = save.last; i < TOTAL; i += 1) if (!save.best[i]) return i;
    for (let i = 0; i < TOTAL; i += 1) if (!save.best[i]) return i;
    return Math.min(save.last, TOTAL - 1);
  }
  function renderTitle() {
    const n = Object.keys(save.best).length;
    const next = firstOpen();
    $("start-btn").textContent = n ? `이어하기 · ${Math.floor(next / 10) + 1}-${(next % 10) + 1}` : "시작하기";
    $("title-progress").textContent = n ? `별 ${totalStars()} / ${TOTAL * 3} · 총점 ${totalScore().toLocaleString("ko-KR")}` : "60단계 · 판 6가지 · 타임어택";
  }
  let stagesFrom = "title";
  function openStages(from) {
    stagesFrom = from;
    setScreen("stages");
    renderStages(Math.floor((from === "play" ? info.i : firstOpen()) / 10));
  }
  function renderStages(w) {
    document.querySelectorAll("[data-world]").forEach((b) => b.classList.toggle("on", Number(b.dataset.world) === w));
    $("stages-sum").textContent = `별 ${totalStars()} / ${TOTAL * 3}`;
    const grid2 = $("stage-grid");
    grid2.innerHTML = "";
    for (let i = w * 10; i < w * 10 + 10; i += 1) {
      const open = isOpen(i);
      const best = save.best[i];
      const si = stageInfo(i);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `st ${best ? "done" : ""} ${open ? "" : "locked"} ${si.boss ? "boss" : ""}`;
      b.disabled = !open;
      b.innerHTML = open ? `<b>${(i % 10) + 1}</b><small>${MODE_INFO[si.mode].icon || "·"}</small><span class="mini-stars">${[0, 1, 2].map((k) => `<i class="${best && best.stars > k ? "on" : ""}"></i>`).join("")}</span>` : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3h1.5v10h-13V11zm2.5 0h5V8a2.5 2.5 0 0 0-5 0z" fill="currentColor"/></svg>`;
      b.setAttribute("aria-label", `${Math.floor(i / 10) + 1}-${(i % 10) + 1}단계${open ? "" : " (잠김)"}`);
      if (open) {
        b.addEventListener("click", () => {
          Sound.unlock();
          Sound.ui();
          startStage(i);
        });
      }
      grid2.appendChild(b);
    }
  }

  /* ---------- 배치 ---------- */
  function resize() {
    const r = stageEl.getBoundingClientRect();
    VW = Math.max(1, r.width);
    VH = Math.max(1, r.height);
    DPR = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
    turnBoard();
    fitBoard();
  }
  /** 폰을 돌리면 판도 함께 돌림 */
  function turnBoard() {
    if (!grid.length || screen === "title" || C === R) return;
    if (VW > VH * 1.05 === C > R) return;
    const next = [];
    for (let y = 0; y < C; y += 1) next.push(new Array(R).fill(null));
    for (const t of allTiles()) {
      const { x, y, rx, ry } = t;
      t.x = y;
      t.y = x;
      t.rx = ry;
      t.ry = rx;
      next[t.y][t.x] = t;
    }
    grid = next;
    [C, R] = [R, C];
    applyGravity();
    if (screen === "play" && clearT < 0) ensureMoves();
  }
  /** 판이 쓸 수 있는 칸과 패 크기 */
  function measure(cols, rows) {
    const base = stageEl.getBoundingClientRect();
    let top = 96;
    for (const id of ["hud", "time-row", "mode-row"]) {
      const r = $(id).getBoundingClientRect();
      if (r.height) top = Math.max(id === "hud" ? 0 : top, r.bottom - base.top + 8);
    }
    const items = $("items").getBoundingClientRect();
    // 폰을 눕히면 아이템이 오른쪽에 세로로 섬
    const side = items.height > items.width;
    const bottom = side ? VH - 8 : (items.height ? items.top - base.top : VH - 80) - 8;
    const availW = VW - (side ? (items.width + 12) * 2 : 12);
    const availH = bottom - top;
    const aspect = 1.2;
    const size = Math.min(availW / (cols + 0.9), availH / ((rows + 0.9) * aspect + 0.3));
    return { cell: size, top, availH, aspect };
  }
  function fitBoard() {
    const m = measure(C, R);
    cell = Math.floor(clamp(m.cell, 16, 92) * DPR) / DPR;
    tileH = Math.round(cell * m.aspect * DPR) / DPR;
    boardW = cell * C;
    boardH = tileH * R;
    ox = Math.round(((VW - boardW) / 2) * DPR) / DPR;
    oy = Math.round((m.top + (m.availH - boardH) / 2) * DPR) / DPR;
    sprites = new Map();
    boardCache = null;
  }
  function cellPoint(x, y) {
    // 판 바깥 칸은 틀 안쪽 여백으로 그림
    const px = x < 0 ? ox - cell * 0.26 : x >= C ? ox + boardW + cell * 0.26 : ox + (x + 0.5) * cell;
    const py = y < 0 ? oy - cell * 0.26 : y >= R ? oy + boardH + cell * 0.26 : oy + (y + 0.5) * tileH;
    return [px, py];
  }

  /* ---------- 그리기 ---------- */
  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * DPR);
    c.height = Math.ceil(h * DPR);
    const g = c.getContext("2d");
    g.scale(DPR, DPR);
    return [c, g];
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  }
  /** 마작패 한 장: 초록 뒤판 + 상아색 앞면 + 그림 */
  function tileSprite(kind) {
    if (sprites.has(kind)) return sprites.get(kind);
    const w = cell;
    const h = tileH;
    const depth = Math.max(2.4, cell * 0.085);
    const [c, g] = mk(w + 2, h + 2);
    const fw = w - 2;
    const fh = h - depth - 2;
    const rad = Math.max(3, cell * 0.13);
    // 그림자
    g.fillStyle = "rgba(0,0,0,0.28)";
    rr(g, 1.5, 1.5 + depth, fw + 1, fh + 1, rad);
    g.fill();
    // 초록 뒤판
    const back = g.createLinearGradient(0, h - depth * 2.2, 0, h);
    back.addColorStop(0, "#3fb37f");
    back.addColorStop(1, "#1d7a52");
    g.fillStyle = back;
    rr(g, 1, 1 + depth, fw, fh, rad);
    g.fill();
    // 상아색 두께
    g.fillStyle = "#e4d7b5";
    rr(g, 1, 1 + depth * 0.46, fw, fh, rad);
    g.fill();
    // 앞면
    const face = g.createLinearGradient(0, 1, 0, 1 + fh);
    face.addColorStop(0, "#fffef8");
    face.addColorStop(1, "#f6eed9");
    g.fillStyle = face;
    rr(g, 1, 1, fw, fh, rad);
    g.fill();
    g.strokeStyle = "rgba(160,130,80,0.35)";
    g.lineWidth = Math.max(0.6, cell * 0.018);
    rr(g, 1.6, 1.6, fw - 1.2, fh - 1.2, rad * 0.9);
    g.stroke();
    // 그림
    const img = imgs[kind];
    if (img) {
      const pad = cell * 0.07;
      const boxW = fw - pad * 2;
      const boxH = fh - pad * 2;
      const k = Math.min(boxW / img.width, boxH / img.height);
      const dw = img.width * k;
      const dh = img.height * k;
      g.save();
      rr(g, 1 + pad * 0.6, 1 + pad * 0.6, fw - pad * 1.2, fh - pad * 1.2, rad * 0.65);
      g.clip();
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 1 + (fw - dw) / 2, 1 + (fh - dh) / 2, dw, dh);
      g.restore();
    }
    // 윗면 빛
    g.fillStyle = "rgba(255,255,255,0.5)";
    rr(g, 1 + rad * 0.5, 1.8, fw - rad, Math.max(1, cell * 0.035), 2);
    g.fill();
    sprites.set(kind, c);
    return c;
  }
  /** 판 바탕: 나무 틀 + 천 */
  function boardLayer() {
    if (boardCache) return boardCache;
    const pad = cell * 0.52;
    const fw = boardW + pad * 2;
    const fh = boardH + pad * 2;
    const [c, g] = mk(fw + 8, fh + 10);
    g.translate(4, 3);
    g.fillStyle = "rgba(0,0,0,0.35)";
    rr(g, 0, 4, fw, fh, 16);
    g.fill();
    const fr = g.createLinearGradient(0, 0, 0, fh);
    fr.addColorStop(0, world.frame[0]);
    fr.addColorStop(1, world.frame[1]);
    g.fillStyle = fr;
    rr(g, 0, 0, fw, fh, 16);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.28)";
    g.lineWidth = 1.5;
    rr(g, 1.5, 1.5, fw - 3, fh - 3, 15);
    g.stroke();
    const inset = Math.max(5, cell * 0.14);
    const felt = g.createRadialGradient(fw / 2, fh / 2, 10, fw / 2, fh / 2, Math.max(fw, fh) * 0.72);
    felt.addColorStop(0, world.felt[0]);
    felt.addColorStop(1, world.felt[1]);
    g.fillStyle = felt;
    rr(g, inset, inset, fw - inset * 2, fh - inset * 2, 10);
    g.fill();
    g.save();
    rr(g, inset, inset, fw - inset * 2, fh - inset * 2, 10);
    g.clip();
    let seed = 7;
    const R2 = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < fw * fh * 0.018; i += 1) {
      g.fillStyle = R2() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
      g.fillRect(R2() * fw, R2() * fh, 1.2, 1.2);
    }
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillRect(inset, inset, fw - inset * 2, 3);
    g.restore();
    boardCache = { c, x: ox - pad - 4, y: oy - pad - 3, w: fw + 8, h: fh + 10 };
    return boardCache;
  }
  function drawArrows() {
    const mi = MODE_INFO[mode];
    if (!mi.icon) return;
    // 판 위에 흐르는 방향 화살표
    const dirs = { down: [[0, 1]], up: [[0, -1]], left: [[-1, 0]], right: [[1, 0]] };
    const cx = ox + boardW / 2;
    const cy = oy + boardH / 2;
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = world.accent;
    const arrow = (x, y, a, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.4, -s * 0.85);
      ctx.lineTo(-s * 0.4, s * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    const s = cell * 0.2;
    const edge = cell * 0.26;
    const off = Math.sin(time * 4) * 2;
    if (mode === "down" || mode === "up" || mode === "left" || mode === "right") {
      const [dx, dy] = dirs[mode][0];
      for (let i = 0; i < 3; i += 1) {
        const k = (i - 1) * (dx ? boardH : boardW) * 0.32;
        const x = dx ? (dx > 0 ? ox + boardW + edge : ox - edge) + dx * off : cx + k;
        const y = dy ? (dy > 0 ? oy + boardH + edge : oy - edge) + dy * off : cy + k;
        arrow(x, y, Math.atan2(dy, dx), s);
      }
    } else {
      const inward = mode === "vcenter" || mode === "hcenter";
      const vertical = mode === "vcenter" || mode === "vout";
      for (const side of [-1, 1]) {
        for (let i = 0; i < 2; i += 1) {
          const k = (i - 0.5) * (vertical ? boardW : boardH) * 0.5;
          if (vertical) {
            const y = side < 0 ? oy - edge : oy + boardH + edge;
            arrow(cx + k, y + (inward ? -side : side) * off, inward ? (side < 0 ? Math.PI / 2 : -Math.PI / 2) : side < 0 ? -Math.PI / 2 : Math.PI / 2, s);
          } else {
            const x = side < 0 ? ox - edge : ox + boardW + edge;
            arrow(x + (inward ? -side : side) * off, cy + k, inward ? (side < 0 ? 0 : Math.PI) : side < 0 ? Math.PI : 0, s);
          }
        }
      }
    }
    ctx.restore();
  }
  function burst(x, y, n) {
    const cols = [world.accent, "#ffffff", "#ffb3d1", "#a6e8ff"];
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = 60 + Math.random() * 170;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.38 + Math.random() * 0.3, t: 0, size: cell * (0.05 + Math.random() * 0.06), color: cols[i % cols.length], star: i % 3 === 0 });
    }
  }
  function addFloat(t, text, color, small) {
    const [x, y] = tileXY(t);
    floats.push({ x: clamp(x, 70, VW - 70), y: y - tileH * 0.5, text, color, t: 0, life: 0.85, size: small ? 15 : 22 });
  }
  function drawLine(l) {
    const k = 1 - l.t / l.life;
    const jitter = (seed) => (Math.sin(seed * 12.9898 + l.seed + time * 70) * 0.5) * cell * 0.09 * k;
    const trace = () => {
      ctx.beginPath();
      for (let i = 0; i < l.pts.length; i += 1) {
        const p = l.pts[i];
        if (i === 0) {
          ctx.moveTo(p[0], p[1]);
          continue;
        }
        const q = l.pts[i - 1];
        const seg = Math.max(2, Math.round(Math.hypot(p[0] - q[0], p[1] - q[1]) / (cell * 0.45)));
        for (let s = 1; s <= seg; s += 1) {
          const u = s / seg;
          const x = lerp(q[0], p[0], u);
          const y = lerp(q[1], p[1], u);
          const end = s === seg;
          ctx.lineTo(x + (end ? 0 : jitter(s + i * 7)), y + (end ? 0 : jitter(s * 3 + i)));
        }
      }
    };
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = k;
    ctx.strokeStyle = world.accent;
    ctx.globalAlpha = k * 0.45;
    ctx.lineWidth = cell * 0.3;
    trace();
    ctx.stroke();
    ctx.globalAlpha = k;
    ctx.lineWidth = cell * 0.13;
    trace();
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = cell * 0.05;
    trace();
    ctx.stroke();
    ctx.restore();
  }
  function update(dt) {
    time += dt;
    if (screen === "play" && clearT < 0) {
      if (introT < 1) introT = Math.min(1, introT + dt / 0.65);
      if (introT >= 0.7) {
        timeLeft -= dt;
        if (timeLeft <= 10 && timeLeft > 0) {
          const s = Math.ceil(timeLeft);
          if (s !== tickSec) {
            tickSec = s;
            Sound.tick();
          }
        }
        if (timeLeft <= 0) {
          timeLeft = 0;
          fail();
        }
        if (comboT > 0) {
          comboT -= dt;
          if (comboT <= 0) combo = 0;
        }
        idleT += dt;
        // 오래 멈춰 있으면 초반 판에선 살짝 알려 줌
        if (!attack && info.i < 20 && idleT > (info.i === 0 ? 3 : 9) && !hintPair) {
          const p = findPair();
          if (p) hintPair = { a: p[0], b: p[1], t: 0, soft: true };
        }
      }
    }
    if (clearT >= 0) {
      clearT += dt;
      if (clearT > 1.35 && screen === "play") showClear();
    }
    const R_ = 1 - Math.exp(-dt * 16);
    for (const row of grid) {
      for (const t of row) {
        if (!t) continue;
        t.rx += (t.x - t.rx) * R_;
        t.ry += (t.y - t.ry) * R_;
        if (Math.abs(t.x - t.rx) < 0.002) t.rx = t.x;
        if (Math.abs(t.y - t.ry) < 0.002) t.ry = t.y;
        if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 5);
        if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);
      }
    }
    if (hintPair) hintPair.t += dt;
    for (const f of fx) f.t += dt;
    fx = fx.filter((f) => f.t < f.life);
    for (const l of lines) l.t += dt;
    lines = lines.filter((l) => l.t < l.life);
    for (const p of parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.conf) p.rot += p.spin * dt;
      else p.vy += 300 * dt;
    }
    parts = parts.filter((p) => p.t < p.life);
    for (const f of floats) {
      f.t += dt;
      f.y -= (f.big ? 22 : 40) * dt;
    }
    floats = floats.filter((f) => f.t < f.life);
    shake = Math.max(0, shake - dt * 30);
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }
    if (document.body.classList.contains("in-play")) {
      const pct = clamp(timeLeft / timeMax, 0, 1);
      const bar = $("time-fill");
      bar.style.width = `${pct * 100}%`;
      bar.classList.toggle("low", timeLeft <= 10);
      $("time").textContent = Math.ceil(timeLeft);
      const ce = $("hud-combo");
      ce.textContent = combo >= 1 ? `${combo + 1} 콤보` : "";
      ce.classList.toggle("on", combo >= 1);
      $("hud-remain").textContent = remain;
    }
  }
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingQuality = "high";
    const bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, world.bg[0]);
    bg.addColorStop(1, world.bg[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);
    if (screen === "title" || screen === "stages") {
      drawTitleBg();
      return;
    }
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    const L = boardLayer();
    ctx.drawImage(L.c, L.x, L.y, L.w, L.h);
    drawArrows();
    const blink = hintPair ? 0.55 + Math.sin(hintPair.t * 8) * 0.45 : 0;
    for (let y = 0; y < R; y += 1) {
      for (let x = 0; x < C; x += 1) {
        const t = grid[y][x];
        if (!t) continue;
        const s = tileSprite(t.kind);
        const px = ox + t.rx * cell;
        let py = oy + t.ry * tileH;
        let scale = 1;
        if (introT < 1) {
          const u = clamp((introT * 0.65 - t.delay * 0.55) / 0.22, 0, 1);
          if (u <= 0) continue;
          scale = 0.6 + 0.4 * u;
          py -= (1 - u) * 18;
          ctx.globalAlpha = u;
        }
        const isSel = selected === t;
        if (isSel) {
          py -= cell * 0.06;
          scale = 1.05;
        }
        if (t.pop > 0) scale += Math.sin(t.pop * Math.PI) * 0.08;
        const sx = t.shake > 0 ? Math.sin(t.shake * 60) * cell * 0.05 : 0;
        const dw = (cell + 2) * scale;
        const dh = (tileH + 2) * scale;
        ctx.drawImage(s, px + sx - (dw - cell - 2) / 2, py - (dh - tileH - 2) / 2, dw, dh);
        ctx.globalAlpha = 1;
        const hinted = hintPair && (hintPair.a === t || hintPair.b === t);
        if (isSel || hinted) {
          ctx.save();
          ctx.strokeStyle = isSel ? world.accent : "#6ff0ff";
          ctx.lineWidth = Math.max(2, cell * 0.075);
          ctx.globalAlpha = isSel ? 1 : hintPair.soft ? blink * 0.75 : blink;
          ctx.shadowColor = isSel ? world.accent : "#6ff0ff";
          ctx.shadowBlur = cell * 0.35;
          ctx.beginPath();
          ctx.roundRect(px + sx + 1, py + 1, cell - 2, tileH - cell * 0.085 - 2, cell * 0.13);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    // 사라지는 타일
    for (const f of fx) {
      const u = f.t / f.life;
      const s = tileSprite(f.tile.kind);
      const k = 1 + u * 0.35;
      ctx.globalAlpha = 1 - u;
      ctx.drawImage(s, ox + f.x * cell - (cell * (k - 1)) / 2, oy + f.y * tileH - (tileH * (k - 1)) / 2 - u * 8, (cell + 2) * k, (tileH + 2) * k);
    }
    ctx.globalAlpha = 1;
    for (const l of lines) drawLine(l);
    ctx.restore();
    for (const p of parts) {
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
      if (p.star) {
        const q = p.size * 1.5;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.t * 8);
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * TAU;
          const m = i % 2 ? q * 0.4 : q;
          ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * m, Math.sin(a) * m);
        }
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of floats) {
      const u = f.t / f.life;
      const pop = f.big ? 1 + (1 - Math.min(1, u * 5)) * 0.4 : 1;
      ctx.globalAlpha = u > 0.65 ? (1 - u) / 0.35 : 1;
      ctx.font = `400 ${f.size * pop}px "Bagel Fat One", "Jua", sans-serif`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = f.big ? 7 : 4;
      ctx.strokeStyle = "rgba(20,20,40,0.82)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (banner) {
      ctx.globalAlpha = Math.min(1, banner.t * 2.5);
      const y = oy + boardH * 0.46;
      ctx.font = '400 18px "Jua", sans-serif';
      const w = ctx.measureText(banner.text).width + 44;
      ctx.fillStyle = "rgba(15,15,30,0.84)";
      ctx.beginPath();
      ctx.roundRect(VW / 2 - w / 2, y - 24, w, 48, 24);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(banner.text, VW / 2, y + 1);
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 1;
    }
  }
  /** 첫 화면 뒤: 패가 천천히 흐름 */
  function drawTitleBg() {
    if (!imgs.length) return;
    const size = 54;
    ctx.globalAlpha = 0.16;
    const n = 7;
    for (let y = -1; y < VH / (size * 1.3) + 1; y += 1) {
      for (let x = -1; x < n + 1; x += 1) {
        const kind = (x * 7 + y * 11 + 64) % TILE_FILES.length;
        const im = imgs[Math.abs(kind)];
        if (!im) continue;
        const px = (x + (y % 2) * 0.5) * (VW / n) + ((time * 8) % (VW / n));
        const py = y * size * 1.3 + ((time * 12) % (size * 1.3));
        ctx.drawImage(im, px, py, size, size * 0.95);
      }
    }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (!paused) update(dt);
    draw();
  }

  /* ---------- 입력 ---------- */
  canvas.addEventListener("pointerdown", (e) => {
    if (screen !== "play" || paused || clearT >= 0) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x = Math.floor((px - ox) / cell);
    const y = Math.floor((py - oy) / tileH);
    // 칸 경계를 살짝 벗어나도 가까운 타일로
    const t = tileAt(clamp(x, 0, C - 1), clamp(y, 0, R - 1));
    const inside = px >= ox - cell * 0.2 && px <= ox + boardW + cell * 0.2 && py >= oy - cell * 0.2 && py <= oy + boardH + cell * 0.2;
    if (t && inside) select(t);
    else if (selected) {
      selected = null;
    }
  });
  document.querySelectorAll("[data-item]").forEach((b) => {
    b.addEventListener("click", () => useItem(b.dataset.item));
  });
  $("start-btn").addEventListener("click", () => {
    Sound.unlock();
    Sound.ui();
    startStage(firstOpen());
  });
  $("stages-btn").addEventListener("click", () => {
    Sound.unlock();
    Sound.ui();
    openStages("title");
  });
  $("attack-btn").addEventListener("click", () => {
    Sound.unlock();
    Sound.ui();
    startAttack();
  });
  $("stages-back").addEventListener("click", () => {
    Sound.ui();
    setScreen(stagesFrom === "play" ? "play" : "title");
  });
  $("stage-btn").addEventListener("click", () => openStages("play"));
  $("next-btn").addEventListener("click", () => {
    Sound.ui();
    startStage(info.i + 1);
  });
  $("replay-btn").addEventListener("click", () => {
    Sound.ui();
    startStage(info.i);
  });
  $("clear-stages").addEventListener("click", () => openStages("title"));
  $("retry-btn").addEventListener("click", () => {
    Sound.ui();
    if (attack) startAttack();
    else startStage(info.i);
  });
  $("over-home").addEventListener("click", () => {
    Sound.ui();
    setScreen("title");
  });
  document.querySelectorAll("[data-world]").forEach((b) => {
    b.addEventListener("click", () => {
      Sound.ui();
      renderStages(Number(b.dataset.world));
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (screen !== "play") return;
    const map = { KeyH: "hint", KeyS: "shuffle", KeyB: "bolt", KeyT: "clock" };
    if (map[e.code]) useItem(map[e.code]);
  });

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
        paused = false;
        last = performance.now();
        return true;
      },
    });
  }
  if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: "memory", gameTitle: "짝짝 사천성", formParent: $("over-rank") });
  addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  setScreen("title");
  resize();
  loadAssets().then(() => {
    last = performance.now();
    requestAnimationFrame(frame);
  });

  // 점검용
  window.Sichuan = {
    get s() {
      return { screen, info, mode, C, R, remain, score, combo, timeLeft, timeMax, clearT, shufflesUsed, attack, cell, tileH, ox, oy, boardW, boardH, selected: Boolean(selected), hint: Boolean(hintPair), items: { ...save.items }, attackLevel };
    },
    grid: () => grid,
    findPair,
    findPath,
    select,
    update,
    startStage,
    startAttack,
    stageInfo,
    useItem,
    applyGravity,
    tileAt,
    TOTAL,
    MODE_INFO,
    save,
    showClearNow() {
      if (clearT >= 0) showClear();
    },
    setTime(v) {
      timeLeft = v;
    },
    skipIntro() {
      introT = 1;
    },
    setMode(m) {
      mode = m;
    },
    setScore(v) {
      score = v;
    },
    countMoves,
    allTiles,
    BOMB,
  };
})();
