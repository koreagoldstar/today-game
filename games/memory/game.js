(() => {
  "use strict";

  const TILE_FILES = [
    "chick", "bear", "cat", "bunny",
    "calico", "clover", "star", "watermelon",
    "pig", "fox", "panda", "unicorn",
    "frog", "penguin", "blossom", "donut",
    "dog", "tiger", "owl", "hamster",
    "lemon", "cupcake", "fish", "icecream",
    "mushroom", "bee", "crab", "moon",
    "gem", "cactus", "rocket",
  ];
  const TILE_COLORS = [
    "#ffe27a", "#d4a078", "#ffb8d0", "#fff0f5",
    "#ffe8d0", "#b5ff9a", "#ffe89a", "#ff9a8b",
    "#ffc0cb", "#ffb347", "#f0f0f0", "#d4a0ff",
    "#9fe07d", "#a8d8ff", "#ffc1d8", "#e8b88a",
    "#f5d0a0", "#ffb070", "#c9b8ff", "#ffd4a8",
    "#fff39a", "#ffc0e0", "#7ec8ff", "#ffe0f0",
    "#ff9a7a", "#ffe27a", "#ff8a6b", "#c8d8ff",
    "#ff9ad5", "#b5ff9a", "#a0c4ff",
  ].map((bg) => ({ bg, deep: bg }));

  const WALL = "W";
  const BOMB = "B";
  const TOTAL_STAGES = 60;

  const LAYOUTS = [
    "scatter",
    "cluster",
    "ring",
    "plus",
    "diamond",
    "frame",
    "islands",
    "rows",
    "columns",
    "corridor",
    "pyramid",
    "heart",
    "donut",
    "dense",
    "full",
  ];

  const LAYOUT_LABEL = {
    scatter: "흩뿌리기",
    cluster: "뭉치기",
    ring: "링",
    plus: "십자",
    diamond: "다이아",
    frame: "테두리",
    islands: "섬",
    rows: "줄무늬",
    columns: "세로줄",
    corridor: "복도",
    pyramid: "피라미드",
    heart: "하트",
    donut: "도넛",
    dense: "빽빽",
    full: "풀맵",
  };

  function makeStages() {
    const list = [];
    for (let i = 0; i < TOTAL_STAGES; i += 1) {
      // Board stays roomy; puzzle size scales separately
      let cols = 12;
      let rows = 14;
      if (i >= 8) {
        cols = 14;
        rows = 16;
      }
      if (i >= 20) {
        cols = 15;
        rows = 18;
      }
      if (i >= 36) {
        cols = 16;
        rows = 20;
      }

      // 초반부터 어느 정도 밀도·복잡도 유지 (완전 튜토리얼 난이도 제거)
      let pairs;
      if (i < 5) pairs = 14 + i * 2; // 14~22
      else if (i < 12) pairs = 22 + Math.floor((i - 5) * 1.5); // ~22~32
      else if (i < 24) pairs = 32 + Math.floor((i - 12) * 1.5); // ~32~50
      else if (i < 40) pairs = 48 + Math.floor((i - 24) * 1.35); // ~48~69
      else pairs = 65 + Math.floor((i - 40) * 1.5); // ~65~94
      pairs = Math.max(12, pairs);

      let layout;
      if (i < 5) layout = ["ring", "frame", "islands", "rows", "corridor"][i % 5];
      else if (i < 14) layout = ["frame", "donut", "islands", "rows", "corridor", "heart", "pyramid", "columns", "dense"][i % 9];
      else if (i < 28) layout = ["frame", "donut", "islands", "corridor", "rows", "columns", "dense", "heart", "pyramid"][i % 9];
      else if (i < 45) layout = ["dense", "donut", "corridor", "islands", "full", "rows", "frame"][i % 7];
      else layout = ["full", "dense", "donut", "corridor", "full"][i % 5];

      // Cap pairs so sparse layouts stay sparse (shape-first)
      const softCap = {
        scatter: 22,
        cluster: 28,
        ring: 32,
        plus: 28,
        diamond: 30,
        frame: 36,
        islands: 34,
        rows: 44,
        columns: 44,
        corridor: 38,
        pyramid: 32,
        heart: 30,
        donut: 40,
        dense: 74,
        full: 999,
      };
      pairs = Math.min(pairs, softCap[layout] || pairs);
      // leave breathing room vs board size
      const boardCap = Math.floor((cols * rows) * (layout === "full" ? 0.92 : layout === "dense" ? 0.74 : 0.62));
      pairs = Math.min(pairs, Math.floor(boardCap / 2));
      if (pairs % 1 !== 0) pairs = Math.floor(pairs);
      if (pairs < 12) pairs = 12;

      const kinds = Math.min(
        TILE_FILES.length,
        i < 6 ? 10 + i : i < 20 ? 14 + Math.floor((i - 6) / 2) : 18 + Math.floor((i - 20) / 3)
      );
      // 쌍이 늘어난 만큼 시간은 주되, 너무 넉넉하진 않게
      const time = Math.min(220, 48 + pairs * 1.7 + Math.floor(i * 0.55));

      const hasWalls = i >= 2 && (layout === "corridor" || layout === "donut" || layout === "islands" || layout === "frame" || i % 4 === 0 || i >= 24);
      const hasBombs = hasWalls && i >= 4;
      const moving = i >= 7 && (i % 4 === 1 || layout === "rows" || layout === "columns");
      const wallCount = hasWalls ? Math.min(20, 5 + Math.floor(i / 4) + (layout === "corridor" ? 6 : 0)) : 0;
      const bombPairs = hasBombs ? Math.min(3, 1 + Math.floor(i / 16)) : 0;
      const moveEvery = moving ? Math.max(3.0, 5.8 - i * 0.045) : 0;

      const chapter = Math.floor(i / 12) + 1;
      const bits = [LAYOUT_LABEL[layout] || layout];
      if (hasWalls) bits.push("벽");
      if (moving) bits.push("이동");
      list.push({
        cols,
        rows,
        pairs,
        kinds,
        time,
        layout,
        wallCount,
        bombPairs,
        moveEvery,
        name: `제${chapter}장 ${i + 1} · ${bits.join("·")}`,
      });
    }
    return list;
  }

  const STAGES = makeStages();
  /** @type {(HTMLImageElement|null)[]} */
  const tileImgs = TILE_FILES.map(() => null);
  let bombImg = null;

  function loadTileAssets() {
    const jobs = TILE_FILES.map(
      (name, i) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            tileImgs[i] = img;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `assets/tiles/${name}.png`;
        })
    );
    jobs.push(
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          bombImg = img;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = "assets/tiles/bomb.png";
      })
    );
    return Promise.all(jobs);
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  // bigger playfield
  canvas.width = 480;
  canvas.height = 720;

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  let state = "title";
  let stageIndex = 0;
  let grid = [];
  let cols = 10;
  let rows = 12;
  let selected = null;
  let pathLine = null;
  let pathLife = 0;
  let timeLeft = 99;
  let timeMax = 99;
  let remain = 0;
  let hintPair = null;
  let hintLife = 0;
  let particles = [];
  let floats = [];
  let last = 0;
  let raf = 0;
  let cellW = 40;
  let cellH = 40;
  let padX = 3;
  let padY = 3;
  let matches = 0;
  let items = { hint: 3, shuffle: 3, bolt: 2, clock: 2 };
  let busy = false;
  let moveEvery = 0;
  let moveAcc = 0;
  let slideAnim = 0; // visual nudge after move
  let wallCount = 0;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function emptyGrid(c, r) {
    return Array.from({ length: r + 2 }, () => Array(c + 2).fill(null));
  }

  function isWall(v) {
    return v === WALL;
  }
  function isBomb(v) {
    return v === BOMB;
  }
  function isTile(v) {
    return typeof v === "number";
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  /** Build shape mask of playable slots (1-indexed board coords). */
  function buildLayoutMask(layout, c, r) {
    const cx = (c + 1) / 2;
    const cy = (r + 1) / 2;
    const spots = [];

    function push(x, y) {
      if (x >= 1 && y >= 1 && x <= c && y <= r) spots.push({ x, y });
    }

    if (layout === "full") {
      for (let y = 1; y <= r; y += 1) for (let x = 1; x <= c; x += 1) push(x, y);
    } else if (layout === "dense") {
      const marginX = Math.max(1, Math.floor(c * 0.08));
      const marginY = Math.max(1, Math.floor(r * 0.08));
      for (let y = 1 + marginY; y <= r - marginY; y += 1) {
        for (let x = 1 + marginX; x <= c - marginX; x += 1) push(x, y);
      }
    } else if (layout === "scatter" || layout === "cluster") {
      // candidate pool; later sampled to exact tile count
      const radius =
        layout === "scatter"
          ? Math.max(c, r)
          : Math.min(c, r) * 0.38;
      for (let y = 1; y <= r; y += 1) {
        for (let x = 1; x <= c; x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (layout === "scatter") {
            // prefer outer + random feel via checker-ish skip
            if ((x + y) % 3 !== 0) continue;
            push(x, y);
          } else if (dist <= radius) {
            push(x, y);
          }
        }
      }
    } else if (layout === "ring" || layout === "frame" || layout === "donut") {
      const thick = layout === "frame" ? 2 : 1;
      const hole = layout === "donut" ? Math.min(c, r) * 0.28 : Math.min(c, r) * 0.22;
      for (let y = 1; y <= r; y += 1) {
        for (let x = 1; x <= c; x += 1) {
          const edge =
            x <= thick || y <= thick || x > c - thick || y > r - thick;
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + (dy * c) / r);
          if (layout === "frame") {
            if (edge) push(x, y);
          } else if (layout === "ring") {
            if (Math.abs(dist - hole - 1.2) < 1.35) push(x, y);
          } else {
            // donut: outer band
            if (dist >= hole && dist <= hole + 2.8) push(x, y);
            if (edge && (x + y) % 2 === 0) push(x, y);
          }
        }
      }
    } else if (layout === "plus") {
      const arm = Math.max(2, Math.floor(Math.min(c, r) * 0.18));
      for (let y = 1; y <= r; y += 1) {
        for (let x = 1; x <= c; x += 1) {
          if (Math.abs(x - cx) <= arm || Math.abs(y - cy) <= arm) push(x, y);
        }
      }
    } else if (layout === "diamond") {
      const rad = Math.min(c, r) * 0.42;
      for (let y = 1; y <= r; y += 1) {
        for (let x = 1; x <= c; x += 1) {
          if (Math.abs(x - cx) + Math.abs(y - cy) * (c / r) <= rad) push(x, y);
        }
      }
    } else if (layout === "islands") {
      const islands = [
        { x: c * 0.28, y: r * 0.32, rad: Math.min(c, r) * 0.2 },
        { x: c * 0.72, y: r * 0.32, rad: Math.min(c, r) * 0.2 },
        { x: c * 0.5, y: r * 0.72, rad: Math.min(c, r) * 0.22 },
      ];
      for (let y = 1; y <= r; y += 1) {
        for (let x = 1; x <= c; x += 1) {
          if (
            islands.some((isl) => {
              const dx = x - isl.x;
              const dy = y - isl.y;
              return Math.sqrt(dx * dx + dy * dy) <= isl.rad;
            })
          ) {
            push(x, y);
          }
        }
      }
    } else if (layout === "rows") {
      for (let y = 1; y <= r; y += 1) {
        if (y % 2 === 0) continue;
        for (let x = 1; x <= c; x += 1) push(x, y);
      }
    } else if (layout === "columns") {
      for (let x = 1; x <= c; x += 1) {
        if (x % 2 === 0) continue;
        for (let y = 1; y <= r; y += 1) push(x, y);
      }
    } else if (layout === "corridor") {
      // U / H style hallways
      for (let y = 1; y <= r; y += 1) {
        for (let x = 1; x <= c; x += 1) {
          const left = x <= 2;
          const right = x > c - 2;
          const bottom = y > r - 3;
          const mid = Math.abs(y - cy) <= 1;
          if (left || right || bottom || mid) push(x, y);
        }
      }
    } else if (layout === "pyramid") {
      for (let y = 1; y <= r; y += 1) {
        const t = y / r;
        const half = Math.floor((c * t) / 2) + 1;
        for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x += 1) push(x, y);
      }
    } else if (layout === "heart") {
      for (let y = 1; y <= r; y += 1) {
        for (let x = 1; x <= c; x += 1) {
          const nx = (x - cx) / (c * 0.42);
          const ny = (cy - y) / (r * 0.42);
          const a = nx * nx + ny * ny - 1;
          const heart = a * a * a - nx * nx * ny * ny * ny;
          if (heart <= 0) push(x, y);
        }
      }
    } else {
      for (let y = 1; y <= r; y += 1) for (let x = 1; x <= c; x += 1) push(x, y);
    }

    // dedupe
    const seen = new Set();
    const unique = [];
    spots.forEach((s) => {
      const k = cellKey(s.x, s.y);
      if (seen.has(k)) return;
      seen.add(k);
      unique.push(s);
    });
    return unique;
  }

  function wallPatternSlots(layout, c, r, count) {
    if (count <= 0) return [];
    const slots = [];
    const cx = Math.round(c / 2);
    const cy = Math.round(r / 2);
    if (layout === "corridor" || layout === "islands") {
      for (let y = 2; y < r; y += 1) slots.push({ x: cx, y });
      for (let x = 2; x < c; x += 1) {
        if (x === cx) continue;
        slots.push({ x, y: cy });
      }
    } else if (layout === "donut" || layout === "ring") {
      for (let a = 0; a < Math.PI * 2; a += 0.35) {
        slots.push({
          x: Math.round(cx + Math.cos(a) * (Math.min(c, r) * 0.22)),
          y: Math.round(cy + Math.sin(a) * (Math.min(c, r) * 0.22)),
        });
      }
    } else {
      for (let y = 3; y <= r - 2; y += 2) {
        for (let x = 3; x <= c - 2; x += 3) slots.push({ x, y });
      }
    }
    return shuffle(slots)
      .filter((s) => s.x >= 1 && s.y >= 1 && s.x <= c && s.y <= r)
      .slice(0, count);
  }

  function buildBoard() {
    const st = STAGES[stageIndex];
    cols = st.cols;
    rows = st.rows;
    moveEvery = st.moveEvery;
    moveAcc = 0;
    slideAnim = 0;

    let mask = buildLayoutMask(st.layout, cols, rows);
    if (mask.length < 8) {
      mask = buildLayoutMask("cluster", cols, rows);
    }

    const bombSlots = st.bombPairs * 2;
    let needTiles = st.pairs * 2 + bombSlots;
    // need even
    if (needTiles % 2 !== 0) needTiles += 1;

    // Grow mask if shape is too small for this stage's pairs
    if (mask.length < needTiles) {
      const extra = buildLayoutMask("dense", cols, rows);
      const have = new Set(mask.map((s) => cellKey(s.x, s.y)));
      extra.forEach((s) => {
        const k = cellKey(s.x, s.y);
        if (!have.has(k)) {
          have.add(k);
          mask.push(s);
        }
      });
    }
    if (mask.length < needTiles) {
      mask = buildLayoutMask("full", cols, rows);
    }

    // Pick exact tile slots from mask (keeps shape when sparse)
    let tileSpots = shuffle(mask);
    if (tileSpots.length > needTiles) {
      tileSpots = tileSpots.slice(0, needTiles);
    } else {
      needTiles = tileSpots.length - (tileSpots.length % 2);
      tileSpots = tileSpots.slice(0, needTiles);
    }

    const wallWant = st.wallCount || 0;
    const tileKeys = new Set(tileSpots.map((s) => cellKey(s.x, s.y)));
    let walls = wallPatternSlots(st.layout, cols, rows, wallWant).filter(
      (s) => !tileKeys.has(cellKey(s.x, s.y))
    );
    // if not enough free wall slots, take from leftover mask cells
    if (walls.length < wallWant) {
      const leftovers = shuffle(mask.filter((s) => !tileKeys.has(cellKey(s.x, s.y))));
      for (const s of leftovers) {
        if (walls.length >= wallWant) break;
        if (walls.some((w) => w.x === s.x && w.y === s.y)) continue;
        walls.push(s);
      }
    }

    const kinds = Math.max(4, Math.min(st.kinds, Math.max(4, Math.floor(st.pairs / 2) + 2)));
    const useBombs = Math.min(st.bombPairs, Math.max(0, Math.floor(tileSpots.length / 2) - 2));
    const bombUse = Math.max(0, useBombs);
    const pairUse = Math.max(2, Math.floor((tileSpots.length - bombUse * 2) / 2));

    let deck = [];
    for (let p = 0; p < pairUse; p += 1) deck.push(p % kinds);
    deck = shuffle([...deck, ...deck]);
    for (let b = 0; b < bombUse; b += 1) deck.push(BOMB, BOMB);
    // trim/pad to tileSpots length (even)
    while (deck.length > tileSpots.length) deck.pop();
    while (deck.length + 1 < tileSpots.length) {
      const k = Math.floor(deck.length / 2) % kinds;
      deck.push(k, k);
    }
    if (deck.length < tileSpots.length) {
      tileSpots = tileSpots.slice(0, deck.length);
    }
    deck = shuffle(deck);

    grid = emptyGrid(cols, rows);
    wallCount = 0;
    remain = 0;
    walls.forEach((s) => {
      grid[s.y][s.x] = WALL;
      wallCount += 1;
    });
    tileSpots.forEach((s, i) => {
      const v = deck[i];
      grid[s.y][s.x] = v;
      if (v != null && !isWall(v)) remain += 1;
    });

    for (let tries = 0; tries < 60; tries += 1) {
      if (findAnyMatch()) break;
      reshuffleTiles(true);
    }
    ensureSolvable();

    selected = null;
    pathLine = null;
    hintPair = null;
    layout();
    updateHud();
  }

  function layout() {
    const margin = 3;
    cellW = (canvas.width - margin * 2) / cols;
    cellH = (canvas.height - margin * 2) / rows;
    padX = margin;
    padY = margin;
  }

  function tileAt(x, y) {
    if (y < 0 || x < 0 || y >= grid.length || x >= grid[0].length) return null;
    return grid[y][x];
  }

  function isEmpty(x, y) {
    if (y < 0 || x < 0 || y >= grid.length || x >= grid[0].length) return true;
    const v = grid[y][x];
    return v == null;
  }

  // path can go through empty only; walls block
  function clearBetween(x1, y1, x2, y2) {
    if (x1 === x2) {
      const [a, b] = y1 < y2 ? [y1, y2] : [y2, y1];
      for (let y = a + 1; y < b; y += 1) if (!isEmpty(x1, y)) return false;
      return true;
    }
    if (y1 === y2) {
      const [a, b] = x1 < x2 ? [x1, x2] : [x2, x1];
      for (let x = a + 1; x < b; x += 1) if (!isEmpty(x, y1)) return false;
      return true;
    }
    return false;
  }

  function sameType(a, b) {
    const va = tileAt(a.x, a.y);
    const vb = tileAt(b.x, b.y);
    if (va == null || vb == null) return false;
    if (isWall(va) || isWall(vb)) return false;
    return va === vb;
  }

  function findPath(a, b) {
    if (a.x === b.x && a.y === b.y) return null;
    if (!sameType(a, b)) return null;

    if ((a.x === b.x || a.y === b.y) && clearBetween(a.x, a.y, b.x, b.y)) {
      return [a, b];
    }

    function passable(x, y) {
      if ((x === a.x && y === a.y) || (x === b.x && y === b.y)) return true;
      return isEmpty(x, y);
    }

    for (const c of [
      { x: a.x, y: b.y },
      { x: b.x, y: a.y },
    ]) {
      if (!passable(c.x, c.y)) continue;
      if (clearBetween(a.x, a.y, c.x, c.y) && clearBetween(c.x, c.y, b.x, b.y)) {
        return [a, c, b];
      }
    }

    const maxX = cols + 1;
    const maxY = rows + 1;
    for (let y = 0; y <= maxY; y += 1) {
      for (let x = 0; x <= maxX; x += 1) {
        if ((x === a.x && y === a.y) || (x === b.x && y === b.y)) continue;
        if (!isEmpty(x, y)) continue;
        if (x !== a.x && y !== a.y) continue;
        if (!clearBetween(a.x, a.y, x, y)) continue;

        if ((x === b.x || y === b.y) && clearBetween(x, y, b.x, b.y)) {
          return [a, { x, y }, b];
        }

        for (const m of [
          { x, y: b.y },
          { x: b.x, y },
        ]) {
          if (m.x === x && m.y === y) continue;
          if (!passable(m.x, m.y)) continue;
          if (clearBetween(x, y, m.x, m.y) && clearBetween(m.x, m.y, b.x, b.y)) {
            return [a, { x, y }, m, b];
          }
        }
      }
    }
    return null;
  }

  function findAnyMatch() {
    const cells = [];
    for (let y = 1; y <= rows; y += 1) {
      for (let x = 1; x <= cols; x += 1) {
        const v = grid[y][x];
        if (v == null || isWall(v)) continue;
        cells.push({ x, y, t: v });
      }
    }
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        if (cells[i].t !== cells[j].t) continue;
        const path = findPath(cells[i], cells[j]);
        if (path) return { a: cells[i], b: cells[j], path };
      }
    }
    return null;
  }

  function reshuffleTiles(keepWalls = true) {
    const vals = [];
    const spots = [];
    for (let y = 1; y <= rows; y += 1) {
      for (let x = 1; x <= cols; x += 1) {
        const v = grid[y][x];
        if (v == null) continue;
        if (keepWalls && isWall(v)) continue;
        vals.push(v);
        spots.push({ x, y });
        grid[y][x] = null;
      }
    }
    const shuffled = shuffle(vals);
    shuffled.forEach((v, i) => {
      const s = spots[i];
      grid[s.y][s.x] = v;
    });
    selected = null;
  }

  function ensureSolvable() {
    for (let t = 0; t < 40; t += 1) {
      if (findAnyMatch()) return true;
      reshuffleTiles(true);
    }
    // walls may trap tiles — punch a few open
    for (let t = 0; t < 24; t += 1) {
      if (findAnyMatch()) return true;
      const walls = [];
      for (let y = 1; y <= rows; y += 1) {
        for (let x = 1; x <= cols; x += 1) {
          if (isWall(grid[y][x])) walls.push({ x, y });
        }
      }
      if (walls.length) {
        const w = walls[Math.floor(Math.random() * walls.length)];
        grid[w.y][w.x] = null;
        wallCount = Math.max(0, wallCount - 1);
      }
      reshuffleTiles(true);
    }
    return !!findAnyMatch();
  }

  function shiftRows() {
    // odd rows <- , even rows ->
    for (let y = 1; y <= rows; y += 1) {
      const line = [];
      for (let x = 1; x <= cols; x += 1) line.push(grid[y][x]);
      if (y % 2 === 1) {
        const first = line.shift();
        line.push(first);
      } else {
        const last = line.pop();
        line.unshift(last);
      }
      for (let x = 1; x <= cols; x += 1) grid[y][x] = line[x - 1];
    }
    selected = null;
    hintPair = null;
    slideAnim = 0.35;
    if (!findAnyMatch()) {
      reshuffleTiles(true);
      ensureSolvable();
    }
    addFloat(canvas.width / 2, 28, "맵 이동!", "#7ec8ff");
  }

  function explodeBombs(ax, ay, bx, by) {
    const centers = [
      { x: ax, y: ay },
      { x: bx, y: by },
    ];
    let cleared = 0;
    centers.forEach((c) => {
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) > 2) continue;
          const x = c.x + dx;
          const y = c.y + dy;
          if (x < 1 || y < 1 || x > cols || y > rows) continue;
          if (isWall(grid[y][x])) {
            grid[y][x] = null;
            cleared += 1;
            const p = cellCenter(x, y);
            burst(p.x, p.y, "#ffb347");
          }
        }
      }
      const p = cellCenter(c.x, c.y);
      burst(p.x, p.y, "#ff5a3d");
      burst(p.x, p.y, "#ffe27a");
    });
    wallCount = Math.max(0, wallCount - cleared);
    if (cleared > 0) addFloat(canvas.width / 2, 48, `벽 ${cleared}개 파괴!`, "#ffb347");
    else addFloat(canvas.width / 2, 48, "폭탄!", "#ff8ab5");
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    document.getElementById("stage-num").textContent = String(stageIndex + 1);
    const bits = [
      `${cols}×${rows}`,
      `${Math.ceil(remain / 2)}쌍`,
      LAYOUT_LABEL[st.layout] || st.layout,
    ];
    if (wallCount > 0) bits.push(`벽 ${wallCount}`);
    if (st.moveEvery > 0) bits.push("이동");
    document.getElementById("goal-text").textContent = `${st.name} · ${bits.join(" · ")}`;
    document.getElementById("remain").textContent = String(remain);
    document.getElementById("time").textContent = String(Math.max(0, Math.ceil(timeLeft)));
    document.getElementById("time-fill").style.width = `${Math.max(0, (timeLeft / timeMax) * 100)}%`;
    document.getElementById("n-hint").textContent = String(items.hint);
    document.getElementById("n-shuffle").textContent = String(items.shuffle);
    document.getElementById("n-bolt").textContent = String(items.bolt);
    document.getElementById("n-clock").textContent = String(items.clock);
    const stagePill = document.querySelector(".stage-pill");
    if (stagePill) {
      stagePill.innerHTML = `STAGE <span id="stage-num">${stageIndex + 1}</span>/${TOTAL_STAGES}`;
    }
    document.querySelectorAll(".item").forEach((btn) => {
      const key = btn.dataset.item;
      btn.disabled = state !== "play" || items[key] <= 0 || busy;
    });
  }

  function cellCenter(x, y) {
    return {
      x: padX + (x - 0.5) * cellW,
      y: padY + (y - 0.5) * cellH,
    };
  }

  function burst(x, y, color) {
    for (let i = 0; i < 12; i += 1) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * (50 + Math.random() * 120),
        vy: Math.sin(a) * (50 + Math.random() * 120),
        life: 0.35 + Math.random() * 0.3,
        color,
        size: 2 + Math.random() * 3.5,
      });
    }
  }

  function addFloat(x, y, text, color = "#ffe27a") {
    floats.push({ x, y, text, color, life: 0.9, vy: -40 });
  }

  function removePair(a, b, path) {
    const va = grid[a.y][a.x];
    const wasBomb = isBomb(va);
    const style = wasBomb
      ? { bg: "#ff8a3d" }
      : TILE_COLORS[va] || { bg: "#fff" };
    const ca = cellCenter(a.x, a.y);
    const cb = cellCenter(b.x, b.y);
    pathLine = path;
    pathLife = 0.26;
    burst(ca.x, ca.y, style.bg);
    burst(cb.x, cb.y, style.bg);

    grid[a.y][a.x] = null;
    grid[b.y][b.x] = null;
    remain -= 2;
    matches += 1;
    selected = null;
    hintPair = null;

    if (wasBomb) explodeBombs(a.x, a.y, b.x, b.y);

    timeLeft = Math.min(timeMax + 30, timeLeft + 0.7);
    updateHud();

    if (remain <= 0) {
      busy = true;
      setTimeout(stageClear, 300);
      return;
    }
    if (!findAnyMatch()) {
      reshuffleTiles(true);
      ensureSolvable();
      addFloat(canvas.width / 2, 40, "자동 섞기!", "#7ec8ff");
      updateHud();
    }
  }

  function stageClear() {
    state = "clear";
    busy = false;
    const left = Math.max(0, timeLeft);
    const stars = left > timeMax * 0.45 ? 3 : left > timeMax * 0.2 ? 2 : 1;
    const gain = { hint: 0, shuffle: 0, bolt: 0, clock: 0 };
    if (stars >= 2) gain.hint += 1;
    if (stars >= 3) {
      gain.bolt += 1;
      gain.clock += 1;
    }
    if ((stageIndex + 1) % 5 === 0) gain.shuffle += 1;
    items.hint += gain.hint;
    items.shuffle += gain.shuffle;
    items.bolt += gain.bolt;
    items.clock += gain.clock;

    const parts = [];
    if (gain.hint) parts.push(`힌트 +${gain.hint}`);
    if (gain.shuffle) parts.push(`섞기 +${gain.shuffle}`);
    if (gain.bolt) parts.push(`번개 +${gain.bolt}`);
    if (gain.clock) parts.push(`시계 +${gain.clock}`);

    document.getElementById("clear-title").textContent = `STAGE ${stageIndex + 1} CLEAR!`;
    document.getElementById("clear-detail").textContent =
      `${STAGES[stageIndex].name} · 남은 ${Math.ceil(left)}초`;
    document.getElementById("stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    document.getElementById("reward-text").textContent =
      parts.length ? `보상: ${parts.join(" · ")}` : "다음 스테이지로!";
    document.getElementById("next-btn").textContent =
      stageIndex >= TOTAL_STAGES - 1 ? "최종 결과" : "다음 스테이지";
    overlays.clear.classList.remove("hidden");
  }

  function rankScoreNow() {
    return Math.max(1, Math.floor(Math.max(0, timeLeft)) * 20 + stageIndex * 100);
  }

  function fail() {
    state = "over";
    busy = false;
    document.getElementById("over-detail").textContent =
      `STAGE ${stageIndex + 1} · 남은 타일 ${remain}`;
    overlays.over.classList.remove("hidden");
    updateHud();
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "memory", gameTitle: "짝짝 사천성", formParent: overlays.over });
      TodayGameRank.open(rankScoreNow());
    }
  }

  function resetStage() {
    const st = STAGES[stageIndex];
    timeMax = st.time;
    timeLeft = st.time;
    busy = false;
    buildBoard();
  }

  function startGame() {
    stageIndex = 0;
    matches = 0;
    if (window.TodayGameRank) TodayGameRank.reset();
    items = { hint: 3, shuffle: 3, bolt: 2, clock: 2 };
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    updateHud();
  }

  function nextStage() {
    overlays.clear.classList.add("hidden");
    if (stageIndex >= TOTAL_STAGES - 1) {
      document.getElementById("all-detail").textContent =
        `총 ${matches}쌍 연결 · ${TOTAL_STAGES}단계 완주!`;
      overlays.all.classList.remove("hidden");
      state = "all";
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "memory", gameTitle: "짝짝 사천성", formParent: overlays.all });
      TodayGameRank.open(rankScoreNow());
    }
      return;
    }
    stageIndex += 1;
    resetStage();
    state = "play";
    last = performance.now();
    raf = requestAnimationFrame(loop);
    updateHud();
  }

  function pickCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    const gx = Math.floor((x - padX) / cellW) + 1;
    const gy = Math.floor((y - padY) / cellH) + 1;
    if (gx < 1 || gy < 1 || gx > cols || gy > rows) return null;
    const v = grid[gy][gx];
    if (v == null || isWall(v)) return null;
    return { x: gx, y: gy };
  }

  function onSelect(cell) {
    if (busy) return;
    if (!selected) {
      selected = cell;
      return;
    }
    if (selected.x === cell.x && selected.y === cell.y) {
      selected = null;
      return;
    }
    const path = findPath(selected, cell);
    if (path) removePair(selected, cell, path);
    else selected = cell;
  }

  function useItem(kind) {
    if (state !== "play" || busy || items[kind] <= 0) return;
    if (kind === "hint") {
      const m = findAnyMatch();
      if (!m) return;
      items.hint -= 1;
      hintPair = [m.a, m.b];
      hintLife = 2.6;
      addFloat(canvas.width / 2, 36, "HINT!", "#ffe27a");
    } else if (kind === "shuffle") {
      items.shuffle -= 1;
      reshuffleTiles(true);
      ensureSolvable();
      addFloat(canvas.width / 2, 36, "SHUFFLE!", "#7ec8ff");
    } else if (kind === "bolt") {
      const m = findAnyMatch();
      if (!m) return;
      items.bolt -= 1;
      removePair(m.a, m.b, m.path);
      addFloat(canvas.width / 2, 36, "BOLT!", "#ffb347");
    } else if (kind === "clock") {
      items.clock -= 1;
      timeLeft = Math.min(timeMax + 40, timeLeft + 20);
      addFloat(canvas.width / 2, 36, "+20초", "#b5ff9a");
    }
    updateHud();
  }

  function update(dt) {
    if (pathLife > 0) pathLife -= dt;
    if (pathLife <= 0) pathLine = null;
    if (hintLife > 0) hintLife -= dt;
    if (hintLife <= 0) hintPair = null;
    if (slideAnim > 0) slideAnim -= dt;

    if (moveEvery > 0) {
      moveAcc += dt;
      if (moveAcc >= moveEvery) {
        moveAcc = 0;
        shiftRows();
      }
    }

    timeLeft -= dt;
    if (Math.floor(timeLeft * 5) !== Math.floor((timeLeft + dt) * 5)) updateHud();
    if (timeLeft <= 0) {
      fail();
      return;
    }

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
    });
    particles = particles.filter((p) => p.life > 0);
    floats.forEach((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
    });
    floats = floats.filter((f) => f.life > 0);
  }

  function drawWall(tx, ty, tw, th) {
    const rad = Math.max(3, Math.min(tw, th) * 0.15);
    const g = ctx.createLinearGradient(tx, ty, tx, ty + th);
    g.addColorStop(0, "#8a7a6a");
    g.addColorStop(0.5, "#5a4a3a");
    g.addColorStop(1, "#3a2a20");
    ctx.fillStyle = g;
    roundRect(tx, ty, tw, th, rad);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    // brick lines
    ctx.beginPath();
    ctx.moveTo(tx, ty + th / 2);
    ctx.lineTo(tx + tw, ty + th / 2);
    ctx.moveTo(tx + tw / 2, ty);
    ctx.lineTo(tx + tw / 2, ty + th / 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,220,160,0.25)";
    roundRect(tx, ty, tw, th, rad);
    ctx.stroke();
  }

  function drawBombTile(tx, ty, tw, th, highlight) {
    const rad = Math.max(4, Math.min(tw, th) * 0.18);
    if (highlight) {
      ctx.shadowColor = "#ff6b3d";
      ctx.shadowBlur = 14;
    }
    const g = ctx.createLinearGradient(tx, ty, tx, ty + th);
    g.addColorStop(0, "#fff0e0");
    g.addColorStop(0.4, "#ff9a4a");
    g.addColorStop(1, "#d44520");
    ctx.fillStyle = g;
    roundRect(tx, ty, tw, th, rad);
    ctx.fill();
    ctx.strokeStyle = highlight ? "#ffe27a" : "rgba(255,255,255,0.7)";
    ctx.lineWidth = highlight ? 2.4 : 1.2;
    roundRect(tx, ty, tw, th, rad);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (bombImg) {
      const size = Math.min(tw, th) * 0.88;
      ctx.drawImage(bombImg, tx + (tw - size) / 2, ty + (th - size) / 2, size, size);
    }
  }

  function drawTile(x, y, type, highlight) {
    const px = padX + (x - 1) * cellW;
    const py = padY + (y - 1) * cellH;
    const gap = Math.max(1.2, Math.min(cellW, cellH) * 0.04);
    const tw = cellW - gap * 2;
    const th = cellH - gap * 2;
    const tx = px + gap;
    const ty = py + gap;
    const rad = Math.max(4, Math.min(tw, th) * 0.18);

    if (isWall(type)) {
      drawWall(tx, ty, tw, th);
      return;
    }
    if (isBomb(type)) {
      drawBombTile(tx, ty, tw, th, highlight);
      return;
    }

    const style = TILE_COLORS[type] || { bg: "#ddd", deep: "#999" };
    ctx.save();
    if (highlight) {
      ctx.shadowColor = "#ffe27a";
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = "#0d1528";
    roundRect(tx + 1.2, ty + 2, tw, th, rad);
    ctx.fill();

    const g = ctx.createLinearGradient(tx, ty, tx, ty + th);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, style.bg);
    g.addColorStop(1, style.deep);
    ctx.fillStyle = g;
    roundRect(tx, ty, tw, th, rad);
    ctx.fill();
    ctx.strokeStyle = highlight ? "#ffe27a" : "rgba(255,255,255,0.65)";
    ctx.lineWidth = highlight ? 2.3 : 1.1;
    roundRect(tx, ty, tw, th, rad);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const img = tileImgs[type];
    if (img) {
      const size = Math.min(tw, th) * 0.9;
      ctx.drawImage(img, tx + (tw - size) / 2, ty + (th - size) / 2, size, size);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    const shake = slideAnim > 0 ? Math.sin(slideAnim * 40) * 2 : 0;
    ctx.save();
    ctx.translate(shake, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, "#1a2a4a");
    bg.addColorStop(1, "#0e1830");
    ctx.fillStyle = bg;
    ctx.fillRect(-4, 0, canvas.width + 8, canvas.height);

    for (let y = 1; y <= rows; y += 1) {
      for (let x = 1; x <= cols; x += 1) {
        const t = grid[y][x];
        if (t == null) continue;
        const isSel = selected && selected.x === x && selected.y === y;
        const isHint =
          hintPair &&
          ((hintPair[0].x === x && hintPair[0].y === y) ||
            (hintPair[1].x === x && hintPair[1].y === y));
        drawTile(x, y, t, isSel || isHint);
      }
    }

    if (pathLine && pathLife > 0) {
      ctx.strokeStyle = `rgba(255,226,122,${Math.min(1, pathLife * 3.2)})`;
      ctx.lineWidth = Math.max(3, Math.min(cellW, cellH) * 0.2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      pathLine.forEach((p, i) => {
        const c = cellCenter(p.x, p.y);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
    }

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life * 1.4);
      ctx.fillStyle = f.color;
      ctx.font = "bold 18px Jua";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (moveEvery > 0) {
      const left = Math.max(0, moveEvery - moveAcc);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "12px Jua";
      ctx.textAlign = "right";
      ctx.fillText(`이동 ${left.toFixed(1)}s`, canvas.width - 8, 14);
    }

    ctx.restore();
  }

  function loop(t) {
    if (state !== "play") return;
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    if (state === "play") {
      draw();
      raf = requestAnimationFrame(loop);
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    const cell = pickCell(e.clientX, e.clientY);
    if (cell) onSelect(cell);
  });

  document.querySelectorAll(".item").forEach((btn) => {
    btn.addEventListener("click", () => useItem(btn.dataset.item));
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  loadTileAssets().then(() => {
    layout();
    draw();
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "memory",
      gameTitle: "짝짝 사천성",
      formParent: overlays.over || overlays.all || document.body,
    });
  }
})();
