(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const COLS = 15;
  const ROWS = 22;
  const GRID_TOP = 92;
  const CELL = Math.floor(Math.min(W / COLS, (H - GRID_TOP - 16) / ROWS));
  const GW = COLS * CELL;
  const GH = ROWS * CELL;
  const OX = Math.floor((W - GW) / 2);
  const OY = GRID_TOP + Math.floor((H - GRID_TOP - GH) / 2);
  const BEST_KEY = "snake-best-v1";
  const TOTAL_STAGES = 50;

  const STAGE_NAMES = [
    "첫 먹이", "느긋한 산책", "초원 탐험", "달콤한 길", "빠른 꼬리",
    "사과 비", "네온 미로", "콤보 연습", "황금 사과", "위험한 코너",
    "번개 속도", "좁은 길", "연속 먹기", "마스터 코스", "지렁이 러시",
    "최종 시험", "전설의 먹이", "지렁이 고수",
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
    goal: 6 + i * 2,
    interval: Math.max(0.055, 0.2 - i * 0.008),
    goldRate: Math.min(0.28, 0.1 + i * 0.01),
    lives: i < 10 ? 3 : 4,
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

  const sprites = { head: null, body: null, apple: null, gold: null };

  function isPunchBg(r, g, b, a) {
    if (a < 20) return true;
    // magenta chroma #FF00FF
    if (r > 185 && b > 175 && g < 150 && r + b > g * 2.1) return true;
    if (r > 200 && b > 190 && g < 165 && Math.abs(r - b) < 90) return true;
    return false;
  }

  function punchBg(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    let minX = c.width;
    let minY = c.height;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        d[i + 3] = 0;
        continue;
      }
      const px = (i / 4) % c.width;
      const py = ((i / 4) / c.width) | 0;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    x.putImageData(data, 0, 0);
    if (maxX <= minX || maxY <= minY) return c;
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(c.width - 1, maxX + pad);
    maxY = Math.min(c.height - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d").drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [head, body, appleImg, gold] = await Promise.all([
      loadImg("assets/snake-head.png"),
      loadImg("assets/snake-body.png"),
      loadImg("assets/snake-apple.png"),
      loadImg("assets/snake-gold.png"),
    ]);
    if (head) sprites.head = punchBg(head);
    if (body) sprites.body = punchBg(body);
    if (appleImg) sprites.apple = punchBg(appleImg);
    if (gold) sprites.gold = punchBg(gold);
  }

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  let state = "title";
  let endless = false;
  let stageIndex = 0;
  let score = 0;
  let runStartedAt = 0;
  let stageStartedAt = 0;
  let best = 0;
  let stageEaten = 0;
  let lives = 3;
  let snake = [];
  let dir = DIRS.right;
  let nextDir = DIRS.right;
  let apple = null;
  let moveAcc = 0;
  let moveInterval = 0.16;
  let combo = 0;
  let comboTimer = 0;
  let particles = [];
  let floats = [];
  let flash = 0;
  let pulse = 0;
  let last = 0;
  let raf = 0;
  let keys = Object.create(null);
  let swipeStart = null;

  try {
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (_) {
    best = 0;
  }

  function showOverlay(name) {
    Object.keys(overlays).forEach((k) => {
      overlays[k].classList.toggle("hidden", k !== name);
    });
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
      /* ignore */
    }
  }

  function updateHud() {
    const st = endless ? null : STAGES[stageIndex];
    document.getElementById("hud-stage").textContent = endless ? "∞" : String(stageIndex + 1);
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-best").textContent = String(best);
    document.getElementById("hud-goal").textContent = endless ? "∞" : String(st.goal);
    const goalPct = endless ? Math.min(100, (stageEaten % 10) * 10) : Math.min(100, (stageEaten / st.goal) * 100);
    document.getElementById("goal-fill").style.width = `${goalPct}%`;
    const livesEl = document.getElementById("hud-lives");
    livesEl.innerHTML = "";
    const maxL = endless ? 3 : st.lives;
    for (let i = 0; i < maxL; i += 1) {
      const d = document.createElement("span");
      d.className = "life" + (i < lives ? "" : " empty");
      livesEl.appendChild(d);
    }
  }

  function cellCenter(x, y) {
    return { x: OX + x * CELL + CELL / 2, y: OY + y * CELL + CELL / 2 };
  }

  function resetSnake() {
    const sx = Math.floor(COLS / 2);
    const sy = Math.floor(ROWS / 2);
    snake = [
      { x: sx - 1, y: sy },
      { x: sx, y: sy },
      { x: sx + 1, y: sy },
    ];
    dir = DIRS.right;
    nextDir = DIRS.right;
  }

  function occupied(x, y) {
    return snake.some((s) => s.x === x && s.y === y);
  }

  function spawnApple() {
    const st = endless ? { goldRate: Math.min(0.3, 0.12 + Math.floor(stageEaten / 12) * 0.02) } : STAGES[stageIndex];
    let tries = 0;
    let x;
    let y;
    do {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
      tries += 1;
    } while (occupied(x, y) && tries < 400);
    apple = {
      x,
      y,
      gold: Math.random() < st.goldRate,
      wobble: Math.random() * Math.PI * 2,
    };
  }

  function resetStage() {
    stageStartedAt = performance.now();
    const st = STAGES[stageIndex];
    stageEaten = 0;
    lives = st.lives;
    moveInterval = st.interval;
    moveAcc = 0;
    combo = 0;
    comboTimer = 0;
    particles = [];
    floats = [];
    flash = 0;
    resetSnake();
    spawnApple();
    updateHud();
  }

  function startGame(isEndless, fromTitle) {
    endless = !!isEndless;
    if (fromTitle) {
      stageIndex = 0;
      score = 0;
      runStartedAt = performance.now();
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    hideOverlays();
    if (endless) {
      lives = 3;
      stageEaten = 0;
      moveInterval = 0.16;
      moveAcc = 0;
      combo = 0;
      comboTimer = 0;
      particles = [];
      floats = [];
      flash = 0;
      resetSnake();
      spawnApple();
      updateHud();
    } else {
      resetStage();
    }
    state = "play";
    last = performance.now();
    ensureLoop();
  }

  function ensureLoop() {
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function comboMult() {
    if (combo >= 12) return 4;
    if (combo >= 8) return 3;
    if (combo >= 4) return 2;
    return 1;
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 100;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        color,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.85, vy: -42 });
  }

  function die(reason) {
    lives -= 1;
    combo = 0;
    comboTimer = 0;
    flash = 0.35;
    const head = snake[snake.length - 1];
    const c = cellCenter(head.x, head.y);
    burst(c.x, c.y, "#ff7eb6", 16);
    addFloat(c.x, c.y - 20, reason || "펑!", "#ffb0c8");
    updateHud();
    if (lives <= 0) {
      saveBest();
      state = "over";
      document.getElementById("over-detail").textContent = endless
        ? `무한 모드 · 점수 ${score} · 최고 ${best}`
        : `${STAGES[stageIndex].name} · 점수 ${score} · 최고 ${best}`;
      showOverlay("over");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "snake", gameTitle: "애플 스네이크", formParent: overlays.over });
      TodayGameRank.open(score);
    }
      return;
    }
    resetSnake();
    spawnApple();
    moveAcc = 0;
  }

  function stageClear() {
    const elapsed = (performance.now() - stageStartedAt) / 1000;
    score += Math.max(0, Math.floor(20 - elapsed)) * 8;
    saveBest();
    updateHud();
    state = "clear";
    if (stageIndex >= TOTAL_STAGES - 1) {
      document.getElementById("all-detail").textContent = `총 ${score}점 · 최고 기록 ${best}점!`;
      showOverlay("all");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "snake", gameTitle: "애플 스네이크", formParent: overlays.all });
      TodayGameRank.open(score);
    }
      return;
    }
    document.getElementById("clear-detail").textContent = `${STAGES[stageIndex].name} · 점수 ${score}`;
    showOverlay("clear");
  }

  function nextStage() {
    hideOverlays();
    stageIndex += 1;
    resetStage();
    state = "play";
    ensureLoop();
  }

  function setDirection(d) {
    if (!d) return;
    const opp = dir.x + d.x === 0 && dir.y + d.y === 0;
    if (!opp) nextDir = d;
  }

  function moveSnake() {
    dir = nextDir;
    const head = snake[snake.length - 1];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      die("벽!");
      return;
    }
    if (snake.some((s) => s.x === nx && s.y === ny)) {
      die("몸!");
      return;
    }

    snake.push({ x: nx, y: ny });

    if (apple && nx === apple.x && ny === apple.y) {
      combo += 1;
      comboTimer = 2.2;
      const mult = comboMult();
      const base = apple.gold ? 15 : 5;
      const gain = base * mult;
      score += gain;
      stageEaten += 1;
      pulse = 0.25;
      const c = cellCenter(nx, ny);
      burst(c.x, c.y, apple.gold ? "#ffe27a" : "#ff6b6b", apple.gold ? 18 : 12);
      addFloat(c.x, c.y - 14, mult > 1 ? `+${gain} x${mult}` : `+${gain}`, apple.gold ? "#ffe27a" : "#fff");
      saveBest();
      updateHud();

      if (endless) {
        moveInterval = Math.max(0.06, moveInterval - 0.003);
        if (stageEaten % 10 === 0) addFloat(W / 2, OY + 20, "속도 UP!", "#6fffd2");
      } else if (stageEaten >= STAGES[stageIndex].goal) {
        stageClear();
        return;
      }
      spawnApple();
    } else {
      snake.shift();
    }
  }

  function update(dt) {
    if (state !== "play") return;
    pulse = Math.max(0, pulse - dt);
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (flash > 0) flash -= dt;

    if (keys.ArrowUp || keys.w || keys.W) setDirection(DIRS.up);
    if (keys.ArrowDown || keys.s || keys.S) setDirection(DIRS.down);
    if (keys.ArrowLeft || keys.a || keys.A) setDirection(DIRS.left);
    if (keys.ArrowRight || keys.d || keys.D) setDirection(DIRS.right);

    moveAcc += dt;
    // 프레임 끊김 후에도 바로 움직이도록 누적 이동 처리
    let steps = 0;
    while (moveAcc >= moveInterval && steps < 5) {
      moveAcc -= moveInterval;
      moveSnake();
      steps += 1;
      if (state !== "play") break;
    }

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
    });
    particles = particles.filter((p) => p.life > 0);

    floats.forEach((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
    });
    floats = floats.filter((f) => f.life > 0);

    if (apple) apple.wobble += dt * 4;
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

  function drawGrid() {
    // meadow sky → rolling green hills (thumb style)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#7ec8ff");
    bg.addColorStop(0.32, "#b8e8ff");
    bg.addColorStop(0.55, "#9fe0a8");
    bg.addColorStop(1, "#6bc86a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(60, 100, 48, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(100, 100, 36, 16, 0.1, 0, Math.PI * 2);
    ctx.ellipse(300, 88, 42, 18, -0.1, 0, Math.PI * 2);
    ctx.ellipse(340, 90, 30, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // distant hills
    ctx.fillStyle = "rgba(70, 160, 90, 0.45)";
    ctx.beginPath();
    ctx.moveTo(0, 210);
    ctx.quadraticCurveTo(80, 160, 160, 200);
    ctx.quadraticCurveTo(250, 150, 390, 190);
    ctx.lineTo(390, 260);
    ctx.lineTo(0, 260);
    ctx.fill();

    // pink flower accents
    const flowers = [
      [28, 640], [56, 620], [340, 650], [370, 625], [18, 560], [372, 560],
    ];
    flowers.forEach(([fx, fy]) => {
      ctx.fillStyle = "rgba(255, 150, 190, 0.55)";
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * 7, fy + Math.sin(a) * 7, 6, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255, 220, 80, 0.85)";
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    roundRect(OX - 10, OY - 10, GW + 20, GH + 20, 22);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,180,210,0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();

    roundRect(OX - 4, OY - 4, GW + 8, GH + 8, 16);
    const board = ctx.createLinearGradient(OX, OY, OX, OY + GH);
    board.addColorStop(0, "#e8ffe8");
    board.addColorStop(1, "#d4f5c8");
    ctx.fillStyle = board;
    ctx.fill();

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "rgba(100, 190, 120, 0.14)";
          ctx.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
        }
      }
    }

    roundRect(OX - 4, OY - 4, GW + 8, GH + 8, 16);
    ctx.strokeStyle = "rgba(255,140,180,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawBodyBall(c, scale) {
    const size = CELL * scale;
    if (sprites.body) {
      ctx.drawImage(sprites.body, c.x - size / 2, c.y - size / 2, size, size);
      return;
    }
    const r = size * 0.42;
    const bodyGrad = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.35, r * 0.1, c.x, c.y, r);
    bodyGrad.addColorStop(0, "#d8ffe8");
    bodyGrad.addColorStop(0.45, "#7aefb0");
    bodyGrad.addColorStop(1, "#3cbc7a");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(c.x - r * 0.25, c.y - r * 0.28, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnakeSegment(seg, i, total) {
    const c = cellCenter(seg.x, seg.y);
    const isHead = i === total - 1;
    const isTail = i === 0;

    ctx.fillStyle = "rgba(60, 100, 90, 0.14)";
    ctx.beginPath();
    ctx.ellipse(c.x + 1, c.y + CELL * 0.28, CELL * 0.32, CELL * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isHead) {
      if (sprites.head) {
        const size = CELL * 1.08;
        ctx.save();
        ctx.translate(c.x, c.y);
        let rot = 0;
        if (dir === DIRS.up) rot = -Math.PI / 2;
        else if (dir === DIRS.down) rot = Math.PI / 2;
        else if (dir === DIRS.left) rot = Math.PI;
        ctx.rotate(rot);
        ctx.drawImage(sprites.head, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        drawBodyBall(c, 0.95);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(c.x - 4, c.y - 3, 3.5, 0, Math.PI * 2);
        ctx.arc(c.x + 5, c.y - 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a2850";
        ctx.beginPath();
        ctx.arc(c.x - 3 + dir.x, c.y - 2 + dir.y, 1.7, 0, Math.PI * 2);
        ctx.arc(c.x + 6 + dir.x, c.y - 2 + dir.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    drawBodyBall(c, isTail ? 0.72 : 0.88);
  }

  function drawApple() {
    if (!apple) return;
    const c = cellCenter(apple.x, apple.y);
    const bob = Math.sin(apple.wobble) * 2.5;
    const y = c.y + bob;
    const img = apple.gold ? sprites.gold || sprites.apple : sprites.apple;

    ctx.fillStyle = "rgba(60, 80, 70, 0.16)";
    ctx.beginPath();
    ctx.ellipse(c.x, y + CELL * 0.28, CELL * 0.28, CELL * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    if (apple.gold) {
      const glow = ctx.createRadialGradient(c.x, y, 4, c.x, y, CELL * 0.7);
      glow.addColorStop(0, "rgba(255,220,100,0.55)");
      glow.addColorStop(1, "rgba(255,220,100,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, y, CELL * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    if (img) {
      const size = CELL * 0.95;
      ctx.drawImage(img, c.x - size / 2, y - size / 2, size, size);
      return;
    }

    const r = CELL * 0.34;
    const grad = ctx.createRadialGradient(c.x - r * 0.25, y - r * 0.3, r * 0.1, c.x, y, r);
    if (apple.gold) {
      grad.addColorStop(0, "#fff6b0");
      grad.addColorStop(0.5, "#ffd76a");
      grad.addColorStop(1, "#e8a820");
    } else {
      grad.addColorStop(0, "#ffb0a8");
      grad.addColorStop(0.5, "#ff6b7a");
      grad.addColorStop(1, "#e04060");
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    drawGrid();
    snake.forEach((seg, i) => drawSnakeSegment(seg, i, snake.length));
    drawApple();

    const st = endless ? null : STAGES[stageIndex];
    ctx.font = "14px Jua";
    ctx.fillStyle = "rgba(80, 60, 100, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText(endless ? "무한 모드" : st.name, W / 2, OY - 14);

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
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

    if (combo >= 2 && comboTimer > 0) {
      ctx.globalAlpha = Math.min(1, comboTimer);
      ctx.fillStyle = combo >= 8 ? "#ffe27a" : combo >= 4 ? "#ff7eb6" : "#6fffd2";
      ctx.font = "bold 28px 'Bagel Fat One', Jua";
      ctx.textAlign = "center";
      ctx.fillText(`${combo} COMBO`, W / 2, 56);
      ctx.globalAlpha = 1;
    }

    if (pulse > 0) {
      ctx.fillStyle = `rgba(111,255,210,${pulse * 0.15})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,120,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    // 오버레이 상태에서도 루프 유지 (재시작 시 멈춤 방지)
    raf = requestAnimationFrame(loop);
  }

  function onSwipe(dx, dy) {
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? DIRS.right : DIRS.left);
    else setDirection(dy > 0 ? DIRS.down : DIRS.up);
  }

  canvas.addEventListener("pointerdown", (e) => {
    swipeStart = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!swipeStart) return;
    onSwipe(e.clientX - swipeStart.x, e.clientY - swipeStart.y);
    swipeStart = null;
  });
  canvas.addEventListener("pointercancel", () => {
    swipeStart = null;
  });

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  document.getElementById("start-btn").addEventListener("click", () => startGame(false, true));
  document.getElementById("endless-btn").addEventListener("click", () => startGame(true, true));
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", () => {
    hideOverlays();
    if (endless) {
      lives = 3;
      stageEaten = 0;
      moveInterval = 0.16;
      moveAcc = 0;
      combo = 0;
      comboTimer = 0;
      resetSnake();
      spawnApple();
      updateHud();
    } else {
      resetStage();
    }
    state = "play";
    ensureLoop();
  });
  document.getElementById("again-btn").addEventListener("click", () => startGame(false, true));

  resetSnake();
  spawnApple();
  updateHud();
  loadAssets().then(() => {
    showOverlay("title");
    ensureLoop();
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "snake",
      gameTitle: "애플 스네이크",
      formParent: overlays.over || overlays.all || document.body,
    });
  }
})();
