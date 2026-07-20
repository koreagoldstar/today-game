(() => {
  "use strict";

  const W = 390;
  const H = 620;
  const R = 18;
  const ROW_H = R * Math.sqrt(3);
  const COLS = 11;
  const TOP = 52;
  const SHOOTER_Y = H - 78;
  const DANGER_Y = H - 150;
  const COLOR_COUNT = 6;
  const SHOT_SPEED = 560;
  // 화면 좌표(y↓) 기준: 위쪽이 음수 각도
  const MIN_ANGLE = -Math.PI + 0.28;
  const MAX_ANGLE = -0.28;
  const TOTAL_STAGES = 50;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const sprites = { bg: null, dino: null, nest: null, bubbles: [] };

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [bg, dino, nest, ...bubbles] = await Promise.all([
      loadImg("assets/bg.png"),
      loadImg("assets/dino.png"),
      loadImg("assets/nest.png"),
      loadImg("assets/b0.png"),
      loadImg("assets/b1.png"),
      loadImg("assets/b2.png"),
      loadImg("assets/b3.png"),
      loadImg("assets/b4.png"),
      loadImg("assets/b5.png"),
    ]);
    sprites.bg = bg;
    sprites.dino = dino;
    sprites.nest = nest;
    sprites.bubbles = bubbles;
  }

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const hud = {
    stage: document.getElementById("hud-stage"),
    left: document.getElementById("hud-left"),
    score: document.getElementById("hud-score"),
  };

  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let grid = new Map();
  let currentColor = 0;
  let nextColor = 0;
  let aimAngle = -Math.PI / 2;
  let pointer = { x: W / 2, y: TOP + 80 };
  let shot = null;
  let particles = [];
  let floats = [];
  let shake = 0;
  let pendingResolve = false;
  let last = 0;
  let raf = 0;
  let aiming = false;
  let combo = 0;
  let bgStars = Array.from({ length: 28 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    s: 0.8 + Math.random() * 2.2,
    a: 0.15 + Math.random() * 0.35,
  }));

  const BUBBLE_COLORS = [
    { fill: "#ff5a9a", mid: "#ff8fbc", deep: "#e02070", light: "#ffe0ef", eye: "#3a2030" },
    { fill: "#3ec8ff", mid: "#7adfff", deep: "#1090d0", light: "#d8f6ff", eye: "#1a4058" },
    { fill: "#ffd23a", mid: "#ffe680", deep: "#e0a010", light: "#fff6c8", eye: "#5a4010" },
    { fill: "#5ae88a", mid: "#8ff0b0", deep: "#1cb860", light: "#d8ffe8", eye: "#1a5030" },
    { fill: "#b06aff", mid: "#d0a0ff", deep: "#7a30e0", light: "#f0e0ff", eye: "#3a2060" },
    { fill: "#ff8a40", mid: "#ffb070", deep: "#e05010", light: "#ffe8d0", eye: "#5a2810" },
  ];

  function key(r, c) {
    return `${r},${c}`;
  }

  function parseKey(k) {
    const [r, c] = k.split(",").map(Number);
    return { r, c };
  }

  function pos(r, c) {
    return {
      x: R + c * R * 2 + (r & 1 ? R : 0),
      y: TOP + r * ROW_H,
    };
  }

  function neighbors(r, c) {
    const odd = r & 1;
    return [
      { r: r - 1, c: c - (odd ? 0 : 1) },
      { r: r - 1, c: c + (odd ? 1 : 0) },
      { r, c: c - 1 },
      { r, c: c + 1 },
      { r: r + 1, c: c - (odd ? 0 : 1) },
      { r: r + 1, c: c + (odd ? 1 : 0) },
    ].filter((n) => n.c >= 0 && n.c < COLS && n.r >= 0);
  }

  function randColor(max = COLOR_COUNT) {
    return Math.floor(Math.random() * max);
  }

  function pickColor() {
    const used = new Set(grid.values());
    if (used.size > 0) {
      const pool = [...used];
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return randColor();
  }

  function fillRow(g, r, pattern) {
    for (let c = 0; c < COLS; c += 1) {
      const v = pattern[c];
      if (v >= 0) g.set(key(r, c), v % COLOR_COUNT);
    }
  }

  const STAGE_BUILDERS = [
    () => {
      const g = new Map();
      fillRow(g, 0, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0]);
      fillRow(g, 1, [-1, 1, 2, 3, 4, 5, 4, 3, 2, 1, -1]);
      return g;
    },
    () => {
      const g = new Map();
      fillRow(g, 0, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
      fillRow(g, 1, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 0]);
      fillRow(g, 2, [2, 2, 3, 3, 4, 4, 5, 5, 0, 0, 1]);
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      fillRow(g, 0, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0]);
      fillRow(g, 1, [5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5]);
      fillRow(g, 2, [0, 2, 4, 0, 2, 4, 0, 2, 4, 0, 2]);
      fillRow(g, 3, [1, 3, 5, 1, 3, 5, 1, 3, 5, 1, 3]);
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 5; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (Math.abs(c - 5) <= 5 - r) g.set(key(r, c), (r + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 5; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), c % 3 === 0 ? 0 : c % 3 === 1 ? 2 : 4);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 6; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r * 2 + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 6; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if ((r + c) % 2 === 0) g.set(key(r, c), (r + c / 2) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), Math.floor(c / 2) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r + Math.abs(c - 5)) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r * 3 + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (c !== 5) g.set(key(r, c), (r + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 9; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r % 3) * 2 + (c % 3));
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 9; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), Math.floor((r + c) / 2) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 10; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r + c * 2) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 10; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if ((r + c) % 4 !== 0) g.set(key(r, c), (r + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 11; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r * 2 + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 11; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r + Math.abs(c - 5) * 2) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 12; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (c % 2 === r % 2) g.set(key(r, c), (r + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 12; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), ((r * 3 + c * 2) % 7) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 13; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r + c + Math.floor(r / 3)) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 13; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if ((r + c) % 3) g.set(key(r, c), (r * 2 + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 14; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), (r + c * 3) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 14; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (Math.abs(c - 5) + r < 14) g.set(key(r, c), (r + c) % COLOR_COUNT);
        }
      }
      return g;
    },
    () => {
      const g = new Map();
      for (let r = 0; r < 15; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          g.set(key(r, c), ((r * 5 + c * 3) % 11) % COLOR_COUNT);
        }
      }
      return g;
    },
  ];

  function buildStage(index) {
    if (index < STAGE_BUILDERS.length) {
      return new Map(STAGE_BUILDERS[index]());
    }
    // 후반 스테이지: index로 행 수·밀도·패턴 스케일
    const g = new Map();
    const rows = Math.min(16, 10 + Math.floor(index / 3));
    const mode = index % 6;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        let skip = false;
        if (mode === 1) skip = (r + c) % 4 === 0;
        else if (mode === 3) skip = (r + c) % 3 === 0;
        else if (mode === 5) skip = Math.abs(c - 5) + r > rows;
        if (skip) continue;
        const color =
          mode === 0
            ? (r + c + index) % COLOR_COUNT
            : mode === 2
              ? (r * 2 + c + index) % COLOR_COUNT
              : mode === 4
                ? ((r * 3 + c * 2 + index) % 7) % COLOR_COUNT
                : (r + Math.abs(c - 5) + index) % COLOR_COUNT;
        g.set(key(r, c), color);
      }
    }
    return g;
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
  }

  function updateHud() {
    hud.stage.textContent = String(stageIndex + 1);
    hud.left.textContent = String(grid.size);
    hud.score.textContent = String(score);
  }

  function resetStage() {
    grid = buildStage(stageIndex);
    currentColor = pickColor();
    nextColor = pickColor();
    shot = null;
    particles = [];
    floats = [];
    pendingResolve = false;
    combo = 0;
    aimAngle = -Math.PI / 2;
    updateHud();
  }

  let runStartedAt = 0;
  let stageStartedAt = 0;

  function startGame(fromTitle) {
    if (fromTitle) {
      runStartedAt = performance.now();
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    stageStartedAt = performance.now();
    if (fromTitle) {
      stageIndex = 0;
      score = 0;
    }
    state = "play";
    showOverlay(null);
    resetStage();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 14; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        t: 0,
        color,
        size: 3 + Math.random() * 5,
      });
    }
  }

  function spawnFloat(x, y, text) {
    floats.push({ x, y, text, t: 0, life: 0.9 });
  }

  function floodSame(r, c, color, seen) {
    const k = key(r, c);
    if (seen.has(k)) return seen;
    if (grid.get(k) !== color) return seen;
    seen.add(k);
    neighbors(r, c).forEach((n) => floodSame(n.r, n.c, color, seen));
    return seen;
  }

  function ceilingConnected() {
    const seen = new Set();
    function walk(r, c) {
      const k = key(r, c);
      if (!grid.has(k) || seen.has(k)) return;
      seen.add(k);
      neighbors(r, c).forEach((n) => walk(n.r, n.c));
    }
    for (let c = 0; c < COLS; c += 1) {
      if (grid.has(key(0, c))) walk(0, c);
    }
    return seen;
  }

  function resolveMatches(placedKey) {
    const { r, c } = parseKey(placedKey);
    const color = grid.get(placedKey);
    const group = floodSame(r, c, color, new Set());
    let popped = 0;

    if (group.size >= 3) {
      combo += 1;
      const mult = Math.min(4, combo);
      group.forEach((k) => {
        const p = pos(parseKey(k).r, parseKey(k).c);
        spawnParticles(p.x, p.y, grid.get(k));
        grid.delete(k);
        popped += 1;
      });
      const gain = popped * 10 * mult;
      score += gain;
      shake = 6 + combo;
      spawnFloat(W / 2, TOP + 80, combo > 1 ? `COMBO x${combo}  +${gain}` : `+${gain}`);
    } else {
      combo = 0;
    }

    const attached = ceilingConnected();
    const dangling = [];
    grid.forEach((_, k) => {
      if (!attached.has(k)) dangling.push(k);
    });

    if (dangling.length) {
      dangling.forEach((k) => {
        const p = pos(parseKey(k).r, parseKey(k).c);
        spawnParticles(p.x, p.y, grid.get(k));
        score += 5;
        grid.delete(k);
      });
      shake = Math.max(shake, 4);
    }

    updateHud();
    checkEnd();
  }

  function checkEnd() {
    if (grid.size === 0) {
      const elapsed = (performance.now() - stageStartedAt) / 1000;
      score += Math.max(0, Math.floor(20 - elapsed)) * 8;
      updateHud();
      state = "clear";
      if (stageIndex >= TOTAL_STAGES - 1) {
        document.getElementById("all-detail").textContent = `최종 점수 ${score}점!`;
        showOverlay("all");
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "puzzle-bubble", gameTitle: "팝샷 버블", formParent: document.getElementById("allclear") || overlays.all });
      TodayGameRank.open(score);
    }
      } else {
        document.getElementById("clear-detail").textContent = `점수 ${score}점 · ${stageIndex + 1}단계 완료`;
        showOverlay("clear");
      }
      return;
    }

    let lowest = 0;
    grid.forEach((_, k) => {
      const { r } = parseKey(k);
      lowest = Math.max(lowest, pos(r, 0).y);
    });
    if (lowest >= DANGER_Y) {
      state = "over";
      document.getElementById("over-detail").textContent = `스테이지 ${stageIndex + 1} · 점수 ${score}점`;
      showOverlay("over");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "puzzle-bubble", gameTitle: "팝샷 버블", formParent: document.getElementById("over") || overlays.over });
      TodayGameRank.open(score);
    }
    }
  }

  function nearestEmptyCell(hitX, hitY, refR, refC) {
    const candidates = new Set();
    const addAround = (r, c) => {
      neighbors(r, c).forEach((n) => {
        if (!grid.has(key(n.r, n.c))) candidates.add(key(n.r, n.c));
      });
    };

    if (refR != null) addAround(refR, refC);
    else {
      grid.forEach((_, k) => {
        const { r, c } = parseKey(k);
        addAround(r, c);
      });
    }

    if (hitY <= TOP + R * 1.2) {
      for (let c = 0; c < COLS; c += 1) {
        if (!grid.has(key(0, c))) candidates.add(key(0, c));
      }
    }

    let best = null;
    let bestD = Infinity;
    candidates.forEach((k) => {
      const { r, c } = parseKey(k);
      const p = pos(r, c);
      const d = (p.x - hitX) ** 2 + (p.y - hitY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    return best;
  }

  function attachShot(x, y, refR, refC) {
    if (!shot) return;
    const place = nearestEmptyCell(x, y, refR, refC);
    if (!place) {
      state = "over";
      document.getElementById("over-detail").textContent = "보드가 가득 찼어요! 다시 도전해보세요.";
      showOverlay("over");
      if (window.TodayGameRank) {
        TodayGameRank.mount({ gameId: "puzzle-bubble", gameTitle: "팝샷 버블", formParent: overlays.over });
        TodayGameRank.open(score);
      }
      return;
    }
    grid.set(place, shot.color);
    shot = null;
    currentColor = nextColor;
    nextColor = pickColor();
    pendingResolve = true;
    setTimeout(() => {
      pendingResolve = false;
      resolveMatches(place);
    }, 80);
  }

  function updateShot(dt) {
    if (!shot) return;
    const steps = Math.max(1, Math.ceil((Math.hypot(shot.vx, shot.vy) * dt) / 6));
    const sdt = dt / steps;

    for (let s = 0; s < steps; s += 1) {
      if (!shot) return;
      shot.x += shot.vx * sdt;
      shot.y += shot.vy * sdt;

      if (shot.x <= R) {
        shot.x = R;
        shot.vx = Math.abs(shot.vx);
      } else if (shot.x >= W - R) {
        shot.x = W - R;
        shot.vx = -Math.abs(shot.vx);
      }

      if (shot.y <= TOP + R) {
        const col = Math.max(0, Math.min(COLS - 1, Math.round((shot.x - R) / (R * 2))));
        attachShot(shot.x, TOP + R, 0, col);
        return;
      }

      let hit = null;
      let hitDist = Infinity;
      grid.forEach((_, k) => {
        const { r, c } = parseKey(k);
        const p = pos(r, c);
        const dist = Math.hypot(shot.x - p.x, shot.y - p.y);
        if (dist < R * 1.95 && dist < hitDist) {
          hitDist = dist;
          hit = { r, c };
        }
      });

      if (hit) {
        attachShot(shot.x, shot.y, hit.r, hit.c);
        return;
      }
    }
  }

  function fire() {
    if (shot || pendingResolve || state !== "play") return;
    shot = {
      x: W / 2,
      y: SHOOTER_Y,
      vx: Math.cos(aimAngle) * SHOT_SPEED,
      vy: Math.sin(aimAngle) * SHOT_SPEED,
      color: currentColor,
    };
  }

  function setAim(x, y) {
    const dx = x - W / 2;
    // 항상 위로만 조준 (아래쪽 포인터도 위쪽 각도로 보정)
    const dy = Math.min(y - SHOOTER_Y, -8);
    let a = Math.atan2(dy, dx === 0 ? 0.0001 : dx);
    if (a > 0) a = -a;
    aimAngle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, a));
    pointer = { x, y };
  }

  function faceSeed(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function drawBubbleProcedural(x, y, color, rad, face, seed) {
    const style = BUBBLE_COLORS[color % BUBBLE_COLORS.length];

    const g = ctx.createRadialGradient(
      x - rad * 0.35,
      y - rad * 0.4,
      rad * 0.05,
      x + rad * 0.1,
      y + rad * 0.2,
      rad * 1.05
    );
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.16, style.light);
    g.addColorStop(0.45, style.mid);
    g.addColorStop(0.78, style.fill);
    g.addColorStop(1, style.deep);
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = Math.max(2.4, rad * 0.14);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(x - rad * 0.28, y - rad * 0.34, rad * 0.28, rad * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();

    if (face && rad >= 10) drawBubbleFace(x, y, rad, style, seed);
  }

  function drawBubbleFace(x, y, rad, style, seed) {
    const eyeY = y - rad * 0.02;
    const eyeR = Math.max(1.6, rad * 0.11);
    const wink = seed > 0.88;

    ctx.fillStyle = style.eye;
    if (wink) {
      ctx.lineWidth = Math.max(1.4, rad * 0.08);
      ctx.lineCap = "round";
      ctx.strokeStyle = style.eye;
      ctx.beginPath();
      ctx.moveTo(x - rad * 0.28, eyeY);
      ctx.lineTo(x - rad * 0.12, eyeY - eyeR * 0.3);
      ctx.lineTo(x - rad * 0.02, eyeY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + rad * 0.18, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + rad * 0.15, eyeY - eyeR * 0.35, eyeR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x - rad * 0.18, eyeY, eyeR, 0, Math.PI * 2);
      ctx.arc(x + rad * 0.18, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - rad * 0.22, eyeY - eyeR * 0.35, eyeR * 0.35, 0, Math.PI * 2);
      ctx.arc(x + rad * 0.14, eyeY - eyeR * 0.35, eyeR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = style.eye;
    ctx.lineWidth = Math.max(1.4, rad * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y + rad * 0.22, rad * 0.18, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }

  function drawBubble(x, y, color, scale = 1, face = true) {
    const rad = R * scale;
    const idx = color % BUBBLE_COLORS.length;
    const style = BUBBLE_COLORS[idx];
    const seed = faceSeed(x, y);
    const sprite = sprites.bubbles[idx];

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

    // soft shadow
    ctx.fillStyle = "rgba(80, 50, 90, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 1, y + rad * 0.78, rad * 0.75, rad * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    if (sprite) {
      // 썸네일용 광택 구슬 스프라이트
      const size = rad * 2.12;
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      if (face && rad >= 10) drawBubbleFace(x, y, rad, style, seed);
    } else {
      drawBubbleProcedural(x, y, color, rad, face, seed);
    }

    ctx.restore();
  }

  function drawSparkle(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-s * 0.15, -s, s * 0.3, s * 2);
    ctx.fillRect(-s, -s * 0.15, s * 2, s * 0.3);
    ctx.restore();
  }

  function drawBackground() {
    if (sprites.bg) {
      ctx.drawImage(sprites.bg, 0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#6ec8ff");
      g.addColorStop(0.45, "#b8e8ff");
      g.addColorStop(1, "#ffd6ec");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // soft vignette / playfield wash so bubbles stay readable
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(8, TOP - 8, W - 16, DANGER_Y - TOP + 20);

    bgStars.forEach((s) => {
      if (s.y > DANGER_Y) return;
      drawSparkle(s.x, s.y, s.s * 1.4);
    });

    // ceiling bar
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(0, TOP - 18, W, 14);
    ctx.fillStyle = "rgba(255,140,180,0.4)";
    ctx.fillRect(0, TOP - 10, W, 6);

    ctx.strokeStyle = "rgba(255,80,120,0.55)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, DANGER_Y);
    ctx.lineTo(W - 10, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,80,120,0.7)";
    ctx.font = "11px Jua";
    ctx.textAlign = "right";
    ctx.fillText("위험선", W - 14, DANGER_Y - 6);
  }

  function traceAimPath() {
    const pts = [];
    let x = W / 2;
    let y = SHOOTER_Y;
    let vx = Math.cos(aimAngle);
    let vy = Math.sin(aimAngle);
    const step = 8;
    let bounced = 0;
    for (let i = 0; i < 90; i += 1) {
      x += vx * step;
      y += vy * step;
      if (x <= R) {
        x = R;
        vx = Math.abs(vx);
        bounced += 1;
      } else if (x >= W - R) {
        x = W - R;
        vx = -Math.abs(vx);
        bounced += 1;
      }
      pts.push({ x, y });
      if (y <= TOP + R) break;
      let near = false;
      grid.forEach((_, k) => {
        const p = pos(parseKey(k).r, parseKey(k).c);
        if (Math.hypot(p.x - x, p.y - y) < R * 2.05) near = true;
      });
      if (near || bounced > 3) break;
    }
    return pts;
  }

  function drawAimGuide() {
    if (shot || pendingResolve || state !== "play") return;
    const pts = traceAimPath();
    if (!pts.length) return;

    // pink dotted path like thumbnail
    pts.forEach((p, i) => {
      if (i % 2 !== 0) return;
      const a = Math.max(0.25, 0.85 - i * 0.008);
      ctx.fillStyle = `rgba(255,105,180,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x - 0.6, p.y - 0.6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    });

    const last = pts[pts.length - 1];
    const prev = pts[Math.max(0, pts.length - 4)];
    const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
    ctx.save();
    ctx.translate(last.x, last.y);
    ctx.rotate(ang);
    ctx.fillStyle = "#ff69b4";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, 7);
    ctx.lineTo(-6, -7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawShooter() {
    // golden nest for next bubble (right)
    const nestX = W - 52;
    const nestY = SHOOTER_Y + 28;
    if (sprites.nest) {
      ctx.drawImage(sprites.nest, nestX - 36, nestY - 28, 72, 58);
    } else {
      const gold = ctx.createRadialGradient(nestX, nestY, 4, nestX, nestY, 34);
      gold.addColorStop(0, "#ffe9a0");
      gold.addColorStop(1, "#e0a020");
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.ellipse(nestX, nestY, 30, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawBubble(nestX, nestY - 18, nextColor, 0.82);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(200,120,40,0.5)";
    ctx.lineWidth = 3;
    ctx.font = "bold 11px Jua";
    ctx.textAlign = "center";
    ctx.strokeText("NEXT", nestX, nestY + 26);
    ctx.fillText("NEXT", nestX, nestY + 26);

    // cute dino launcher
    if (sprites.dino) {
      const dw = 96;
      const dh = 114;
      ctx.drawImage(sprites.dino, W / 2 - dw / 2, SHOOTER_Y + 4, dw, dh);
    } else {
      ctx.fillStyle = "#7ed957";
      ctx.beginPath();
      ctx.ellipse(W / 2, SHOOTER_Y + 40, 48, 32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // current bubble in dino's hands / above head
    if (!shot) {
      drawBubble(W / 2, SHOOTER_Y - 6, currentColor, 1.05);
      drawSparkle(W / 2 - 26, SHOOTER_Y - 28, 4);
      drawSparkle(W / 2 + 30, SHOOTER_Y - 10, 3);
    }

    if (combo > 1 && state === "play") {
      ctx.fillStyle = "#ff6b9d";
      ctx.font = "bold 16px Jua";
      ctx.textAlign = "center";
      ctx.fillText(`COMBO x${combo}`, W / 2, TOP + 18);
    }
  }

  function draw() {
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    if (shake > 0) shake *= 0.85;

    ctx.save();
    ctx.translate(sx, sy);
    drawBackground();

    grid.forEach((color, k) => {
      const { r, c } = parseKey(k);
      const p = pos(r, c);
      drawBubble(p.x, p.y, color);
    });

    if (shot) drawBubble(shot.x, shot.y, shot.color);
    drawShooter();
    drawAimGuide();

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      drawBubble(p.x, p.y, p.color, 0.28 + (1 - p.t / p.life) * 0.28, false);
      ctx.globalAlpha = 1;
    });

    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      ctx.fillStyle = "#ff4f8a";
      ctx.font = "bold 20px Jua";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - f.t * 42);
      ctx.globalAlpha = 1;
    });

    if (state === "play" && !shot) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "12px Jua";
      ctx.textAlign = "center";
      ctx.fillText(aiming ? "손을 떼면 발사!" : "드래그로 조준 · 떼면 발사 · ←→키", W / 2, H - 10);
    }

    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (state === "play") {
      updateShot(dt);
      particles.forEach((p) => {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 420 * dt;
      });
      particles = particles.filter((p) => p.t < p.life);
      floats.forEach((f) => {
        f.t += dt;
      });
      floats = floats.filter((f) => f.t < f.life);
    }

    draw();
    raf = requestAnimationFrame(loop);
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches && e.touches[0] ? e.touches[0] : e;
    const cx = src.clientX;
    const cy = src.clientY;
    return {
      x: ((cx - rect.left) / rect.width) * W,
      y: ((cy - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    aiming = true;
    const p = pointerPos(e);
    setAim(p.x, p.y);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (state !== "play") return;
    const p = pointerPos(e);
    if (aiming || e.pointerType === "mouse") setAim(p.x, p.y);
  });

  function endAim(e) {
    if (state !== "play") return;
    if (!aiming) return;
    aiming = false;
    const p = pointerPos(e.changedTouches ? e : e);
    setAim(p.x, p.y);
    fire();
  }

  canvas.addEventListener("pointerup", endAim);
  canvas.addEventListener("pointercancel", () => {
    aiming = false;
  });

  window.addEventListener("keydown", (e) => {
    if (state !== "play") return;
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      e.preventDefault();
      aimAngle = Math.max(MIN_ANGLE, aimAngle - 0.07);
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      e.preventDefault();
      aimAngle = Math.min(MAX_ANGLE, aimAngle + 0.07);
    } else if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp") {
      e.preventDefault();
      fire();
    }
  });

  document.getElementById("start-btn").addEventListener("click", () => startGame(true));
  document.getElementById("next-btn").addEventListener("click", () => {
    stageIndex += 1;
    stageStartedAt = performance.now();
    startGame(false);
  });
  document.getElementById("retry-btn").addEventListener("click", () => startGame(false));
  document.getElementById("again-btn").addEventListener("click", () => startGame(true));

  showOverlay("title");
  last = performance.now();
  loadAssets().then(() => {
    raf = requestAnimationFrame(loop);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "puzzle-bubble",
      gameTitle: "팝샷 버블",
      formParent: document.getElementById("over") || document.body,
    });
  }
})();
