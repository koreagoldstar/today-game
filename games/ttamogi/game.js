(() => {
  "use strict";

  const COLS = 100;
  const ROWS = 64;
  const EMPTY = 0;
  const FILL = 1;
  const TRAIL = 2;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const CW = canvas.width;
  const CH = canvas.height;
  const CW_CELL = CW / COLS;
  const CH_CELL = CH / ROWS;

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const images = [];
  const sprites = { bunny: null, dragon: null };
  let bgReady = false;

  const keys = { up: false, down: false, left: false, right: false };
  let wantedDir = { x: 0, y: 0 };

  let state = "title";
  let stage = 1;
  let score = 0;
  let runStartedAt = 0;
  let stageStartedAt = 0;
  let lives = 3;
  let grid = null;
  let player = null;
  let snakes = [];
  let trailing = false;
  let trailCells = [];
  let moveAcc = 0;
  let snakeAcc = 0;
  let last = 0;
  let raf = 0;
  let claimPct = 0;
  let flash = 0;

  function stageConfig(n) {
    // 38 stages: dragons 1→8, faster, goal 60→78%
    const dragons = 1 + Math.floor((n - 1) / 5);
    const snakeSpeed = 12.5 + (n - 1) * 0.38;
    const playerSpeed = 15 + Math.min(5, (n - 1) * 0.06);
    const goal = Math.min(78, 60 + Math.floor((n - 1) / 2));
    const segLen = 12 + Math.min(14, Math.floor((n - 1) / 2.5));
    return { snakes: Math.min(8, dragons), snakeSpeed, playerSpeed, goal, segLen };
  }

  function loadImages() {
    const srcs = ["assets/bg1.png", "assets/bg2.png", "assets/bg3.png"];
    const charSrcs = ["assets/bunny.png", "assets/dragon.png"];
    return Promise.all([
      ...srcs.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
          })
      ),
      ...charSrcs.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
          })
      ),
    ]).then((list) => {
      list.slice(0, 3).forEach((img) => {
        if (img) images.push(img);
      });
      sprites.bunny = list[3];
      sprites.dragon = list[4];
      bgReady = images.length > 0;
    });
  }

  function bgImage() {
    if (!images.length) return null;
    return images[(stage - 1) % images.length];
  }

  function makeGrid() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
    const border = 2;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (x < border || y < border || x >= COLS - border || y >= ROWS - border) {
          grid[y][x] = FILL;
        }
      }
    }
  }

  function makePlayer() {
    player = {
      x: Math.floor(COLS / 2),
      y: ROWS - 3,
      dir: { x: 0, y: 0 },
    };
    trailing = false;
    trailCells = [];
  }

  function emptySpot() {
    for (let tries = 0; tries < 300; tries += 1) {
      const x = 4 + Math.floor(Math.random() * (COLS - 8));
      const y = 4 + Math.floor(Math.random() * (ROWS - 8));
      if (grid[y][x] === EMPTY) return { x, y };
    }
    return { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
  }

  function makeSnakes(cfg) {
    const palettes = [
      ["#ff9ad5", "#ff5f97", "#ffe0f0"],
      ["#ffb8e0", "#ff6b9d", "#fff0f8"],
      ["#ffe27a", "#ffb347", "#fff3c4"],
      ["#b5ff9a", "#6fd6b0", "#e8ffe0"],
      ["#d4a0ff", "#9b7ede", "#f0e6ff"],
      ["#7cf0ff", "#4aa3ef", "#c9f7ff"],
    ];
    snakes = [];
    for (let i = 0; i < cfg.snakes; i += 1) {
      const start = emptySpot();
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
        { x: 1, y: -1 },
        { x: -1, y: -1 },
      ];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const body = [];
      for (let s = 0; s < cfg.segLen; s += 1) {
        body.push({
          x: start.x - dir.x * s * 0.55,
          y: start.y - dir.y * s * 0.55,
        });
      }
      snakes.push({
        body,
        dir: { ...dir },
        palette: palettes[i % palettes.length],
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function cellFilledPct() {
    let fill = 0;
    const total = COLS * ROWS;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (grid[y][x] === FILL) fill += 1;
      }
    }
    return (fill / total) * 100;
  }

  function updateHud() {
    const cfg = stageConfig(stage);
    claimPct = cellFilledPct();
    document.getElementById("hud-stage").textContent = String(stage);
    document.getElementById("hud-pct").textContent = claimPct.toFixed(1);
    document.getElementById("hud-goal").textContent = String(cfg.goal);
    document.getElementById("meter-fill").style.width = `${Math.min(100, (claimPct / cfg.goal) * 100)}%`;
    const livesEl = document.getElementById("hud-lives");
    livesEl.textContent = "♥".repeat(Math.max(0, lives)) + "♡".repeat(Math.max(0, 3 - lives));
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS;
  }

  function claimArea() {
    // trail becomes fill
    for (const c of trailCells) {
      if (inBounds(c.x, c.y)) grid[c.y][c.x] = FILL;
    }
    trailCells = [];
    trailing = false;

    // mark empty cells reachable by snakes
    const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const q = [];
    snakes.forEach((sn) => {
      const hx = Math.round(sn.body[0].x);
      const hy = Math.round(sn.body[0].y);
      if (inBounds(hx, hy) && grid[hy][hx] === EMPTY && !seen[hy][hx]) {
        seen[hy][hx] = true;
        q.push([hx, hy]);
      }
    });

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny) || seen[ny][nx]) continue;
        if (grid[ny][nx] !== EMPTY) continue;
        seen[ny][nx] = true;
        q.push([nx, ny]);
      }
    }

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (grid[y][x] === EMPTY && !seen[y][x]) grid[y][x] = FILL;
      }
    }

    flash = 0.35;
    updateHud();
    const cfg = stageConfig(stage);
    if (claimPct >= cfg.goal) stageClear();
  }

  function clearTrailDeath() {
    for (const c of trailCells) {
      if (inBounds(c.x, c.y) && grid[c.y][c.x] === TRAIL) grid[c.y][c.x] = EMPTY;
    }
    trailCells = [];
    trailing = false;
    player.x = Math.floor(COLS / 2);
    player.y = ROWS - 3;
    player.dir = { x: 0, y: 0 };
    wantedDir = { x: 0, y: 0 };
  }

  function loseLife() {
    lives -= 1;
    flash = 0.45;
    clearTrailDeath();
    updateHud();
    if (lives <= 0) {
      state = "over";
      document.getElementById("over-detail").textContent = `STAGE ${stage} · 영역 ${claimPct.toFixed(1)}%`;
      overlays.over.classList.remove("hidden");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "ttamogi", gameTitle: "땅땅 차지", formParent: overlays.over });
      TodayGameRank.open(score);
    }
    }
  }

  function resetStage() {
    stageStartedAt = performance.now();
    const cfg = stageConfig(stage);
    makeGrid();
    makePlayer();
    makeSnakes(cfg);
    updateHud();
  }

  function startGame() {
    stage = 1;
    lives = 3;
    score = 0;
    runStartedAt = performance.now();
    if (window.TodayGameRank) TodayGameRank.reset();
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stageClear() {
    const elapsed = (performance.now() - stageStartedAt) / 1000;
    score += stage * 100 + Math.max(0, Math.floor(20 - elapsed)) * 8;
    state = "clear";
    document.getElementById("clear-title").textContent = `STAGE ${stage} CLEAR!`;
    document.getElementById("clear-detail").textContent = `영역 ${claimPct.toFixed(1)}% 확보 · 점수 ${score}`;
    document.getElementById("next-btn").textContent = stage >= 38 ? "최종 결과" : "다음 스테이지";
    overlays.clear.classList.remove("hidden");
  }

  function nextStage() {
    overlays.clear.classList.add("hidden");
    if (stage >= 38) {
      document.getElementById("all-detail").textContent = `숨겨진 귀여운 친구들을 모두 만났어요! 점수 ${score}`;
      overlays.all.classList.remove("hidden");
      state = "all";
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "ttamogi", gameTitle: "땅땅 차지", formParent: overlays.all });
      TodayGameRank.open(score);
    }
      return;
    }
    stage += 1;
    if (lives < 3) lives += 1;
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function trySetDir(dx, dy) {
    // no reverse while trailing into yourself awkwardly
    if (trailing && player.dir.x === -dx && player.dir.y === -dy) return;
    wantedDir = { x: dx, y: dy };
  }

  function segmentRadius(i, len) {
    const taper = 1 - i / len;
    const base = (0.95 + taper * 0.85) * (0.55 + taper * 0.45);
    return i === 0 ? 1.35 : base;
  }

  function checkDragonCollisions() {
    if (state !== "play") return true;

    const px = player.x + 0.5;
    const py = player.y + 0.5;
    const playerR = 1.05;

    for (const sn of snakes) {
      for (let i = 0; i < sn.body.length; i += 1) {
        const s = sn.body[i];
        const sx = s.x + 0.5;
        const sy = s.y + 0.5;
        const segR = segmentRadius(i, sn.body.length);
        const hitR = segR + playerR;
        const dx = sx - px;
        const dy = sy - py;

        if (dx * dx + dy * dy < hitR * hitR) {
          loseLife();
          return true;
        }

        const probe = [
          [Math.floor(s.x), Math.floor(s.y)],
          [Math.ceil(s.x), Math.floor(s.y)],
          [Math.floor(s.x), Math.ceil(s.y)],
          [Math.ceil(s.x), Math.ceil(s.y)],
        ];
        for (const [tx, ty] of probe) {
          if (inBounds(tx, ty) && grid[ty][tx] === TRAIL) {
            loseLife();
            return true;
          }
        }
      }
    }
    return false;
  }

  function stepPlayer() {
    if (wantedDir.x !== 0 || wantedDir.y !== 0) {
      player.dir = { ...wantedDir };
    }
    if (player.dir.x === 0 && player.dir.y === 0) return;

    const nx = player.x + player.dir.x;
    const ny = player.y + player.dir.y;
    if (!inBounds(nx, ny)) return;

    const next = grid[ny][nx];

    if (next === FILL) {
      if (trailing) {
        player.x = nx;
        player.y = ny;
        claimArea();
      } else {
        player.x = nx;
        player.y = ny;
      }
      checkDragonCollisions();
      return;
    }

    // empty or trail
    if (next === TRAIL) {
      // hit own trail
      loseLife();
      return;
    }

    // start / continue trail on empty
    trailing = true;
    player.x = nx;
    player.y = ny;
    grid[ny][nx] = TRAIL;
    trailCells.push({ x: nx, y: ny });
    checkDragonCollisions();
  }

  function bounceSnake(sn) {
    const head = sn.body[0];
    sn.phase += 0.2;
    let nx = head.x + sn.dir.x * 0.85;
    let ny = head.y + sn.dir.y * 0.85;

    const cx = Math.round(nx);
    const cy = Math.round(ny);
    let hit = false;
    if (!inBounds(cx, cy) || grid[cy][cx] === FILL) {
      hit = true;
    }

    if (hit) {
      if (Math.random() > 0.45) sn.dir.x *= -1;
      else sn.dir.y *= -1;
      if (sn.dir.x === 0 && sn.dir.y === 0) sn.dir = { x: 1, y: 0 };
      nx = head.x + sn.dir.x * 0.55;
      ny = head.y + sn.dir.y * 0.55;
    }

    if (Math.random() < 0.035 + stage * 0.0008) {
      const opts = [
        { x: sn.dir.x, y: sn.dir.y },
        { x: sn.dir.y, y: -sn.dir.x || 0 },
        { x: -sn.dir.y || 0, y: sn.dir.x },
      ];
      sn.dir = opts[Math.floor(Math.random() * opts.length)];
      if (sn.dir.x === 0 && sn.dir.y === 0) sn.dir = { x: 1, y: 0 };
    }

    for (let i = sn.body.length - 1; i > 0; i -= 1) {
      sn.body[i].x = sn.body[i - 1].x;
      sn.body[i].y = sn.body[i - 1].y;
    }
    sn.body[0].x = nx;
    sn.body[0].y = ny;
    checkDragonCollisions();
  }

  function update(dt) {
    if (flash > 0) flash -= dt;
    const cfg = stageConfig(stage);

    moveAcc += dt * cfg.playerSpeed;
    while (moveAcc >= 1) {
      moveAcc -= 1;
      stepPlayer();
      if (state !== "play") return;
    }

    snakeAcc += dt * cfg.snakeSpeed;
    while (snakeAcc >= 1) {
      snakeAcc -= 1;
      snakes.forEach((sn) => bounceSnake(sn));
      if (state !== "play") return;
    }
  }

  function drawDragon(sn, t) {
    const cell = Math.min(CW_CELL, CH_CELL);
    const [c0, c1, c2] = sn.palette;
    const head = sn.body[0];

    for (let i = sn.body.length - 1; i >= 1; i -= 1) {
      const s = sn.body[i];
      const taper = 1 - i / sn.body.length;
      const r = cell * (0.95 + taper * 0.85) * (0.55 + taper * 0.45);
      const x = s.x * CW_CELL + CW_CELL / 2;
      const y = s.y * CH_CELL + CH_CELL / 2 + Math.sin(sn.phase + i * 0.45) * 1.2;

      ctx.beginPath();
      ctx.arc(x, y, Math.max(4, r), 0, Math.PI * 2);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, c2);
      g.addColorStop(0.45, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.55 + taper * 0.45;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const hx = head.x * CW_CELL + CW_CELL / 2;
    const hy = head.y * CH_CELL + CH_CELL / 2 + Math.sin(sn.phase) * 1.2;
    const hr = cell * 1.55;

    if (sprites.dragon) {
      const size = hr * 2.4;
      ctx.drawImage(sprites.dragon, hx - size / 2, hy - size / 2, size, size);
    } else {
      const hg = ctx.createRadialGradient(hx - hr * 0.25, hy - hr * 0.3, 2, hx, hy, hr);
      hg.addColorStop(0, "#fff");
      hg.addColorStop(0.35, c2);
      hg.addColorStop(1, c1);
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fillStyle = hg;
      ctx.fill();
    }

    const spark = 0.55 + Math.sin((t || 0) * 0.01 + sn.phase) * 0.45;
    ctx.globalAlpha = spark;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(hx + hr * 0.85, hy - hr * 0.7, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const px = player.x * CW_CELL + CW_CELL / 2;
    const py = player.y * CH_CELL + CH_CELL / 2;
    const r = Math.min(CW_CELL, CH_CELL) * 1.35;

    ctx.beginPath();
    ctx.ellipse(px, py + r * 0.85, r * 0.75, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();

    if (trailing) {
      ctx.beginPath();
      ctx.arc(px, py, r * 1.45, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,220,80,0.75)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    if (sprites.bunny) {
      const size = r * 2.6;
      ctx.drawImage(sprites.bunny, px - size / 2, py - size / 2 - r * 0.15, size, size);
    } else {
      const accent = trailing ? "#ff3f7a" : "#ff7eb3";
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(t) {
    const img = bgImage();
    ctx.fillStyle = "#1b2436";
    ctx.fillRect(0, 0, CW, CH);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const v = grid[y][x];
        const px = x * CW_CELL;
        const py = y * CH_CELL;
        if (v === FILL) {
          if (img) {
            ctx.drawImage(
              img,
              (x / COLS) * img.width,
              (y / ROWS) * img.height,
              img.width / COLS,
              img.height / ROWS,
              px,
              py,
              CW_CELL + 0.5,
              CH_CELL + 0.5
            );
          } else {
            ctx.fillStyle = "#ffd6e8";
            ctx.fillRect(px, py, CW_CELL + 0.5, CH_CELL + 0.5);
          }
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(px, py, CW_CELL + 0.5, CH_CELL + 0.5);
        } else if (v === TRAIL) {
          ctx.fillStyle = "#ffe27a";
          ctx.fillRect(px, py, CW_CELL + 0.5, CH_CELL + 0.5);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(px, py, CW_CELL + 0.5, CH_CELL * 0.35);
        } else {
          ctx.fillStyle = "rgba(18, 16, 42, 0.72)";
          ctx.fillRect(px, py, CW_CELL + 0.5, CH_CELL + 0.5);
        }
      }
    }

    snakes.forEach((sn) => drawDragon(sn, t));
    drawPlayer();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,120,${flash * 0.35})`;
      ctx.fillRect(0, 0, CW, CH);
    }
  }

  function loop(t) {
    if (state !== "play") return;
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    if (state === "play") {
      draw(t);
      raf = requestAnimationFrame(loop);
    }
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "ArrowUp" || e.code === "KeyW") trySetDir(0, -1);
    if (e.code === "ArrowDown" || e.code === "KeyS") trySetDir(0, 1);
    if (e.code === "ArrowLeft" || e.code === "KeyA") trySetDir(-1, 0);
    if (e.code === "ArrowRight" || e.code === "KeyD") trySetDir(1, 0);
  });

  document.querySelectorAll(".ctrl").forEach((btn) => {
    const map = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const on = (e) => {
      e.preventDefault();
      const d = map[btn.dataset.dir];
      if (d) trySetDir(d[0], d[1]);
    };
    btn.addEventListener("pointerdown", on);
  });

  // 휴대폰 스와이프로도 이동
  let swipeX = 0;
  let swipeY = 0;
  const canvasEl = document.getElementById("game");
  canvasEl.addEventListener(
    "pointerdown",
    (e) => {
      swipeX = e.clientX;
      swipeY = e.clientY;
      try {
        canvasEl.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    },
    { passive: true }
  );
  canvasEl.addEventListener("pointerup", (e) => {
    const dx = e.clientX - swipeX;
    const dy = e.clientY - swipeY;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) trySetDir(dx > 0 ? 1 : -1, 0);
    else trySetDir(0, dy > 0 ? 1 : -1);
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  loadImages().then(() => {
    makeGrid();
    makePlayer();
    draw(0);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "ttamogi",
      gameTitle: "땅땅 차지",
      formParent: overlays.over || overlays.all || document.body,
    });
  }
})();
