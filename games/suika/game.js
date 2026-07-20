(() => {
  "use strict";

  const W = 390;
  const H = 640;
  const GRAVITY = 980;
  const WALL_L = 24;
  const WALL_R = W - 24;
  const FLOOR_Y = H - 28;
  const DANGER_Y = 108;
  const DROP_COOLDOWN = 0.35;
  const DANGER_TIME = 1.2;
  const MAX_TYPE = 10;
  const STORAGE_KEY = "suika-best";

  const FRUIT_COLORS = [
    "#ff4757", "#ff6b9d", "#a55eea", "#ffa502", "#ff6348",
    "#ffeaa7", "#fdcb6e", "#55efc4", "#e17055", "#00b894", "#2ed573",
  ];

  const FRUIT_NAMES = [
    "체리", "딸기", "포도", "귤", "사과",
    "레몬", "복숭아", "키위", "석류", "멜론", "수박",
  ];

  function fruitRadius(type) {
    return 14 + type * 5.6;
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const previewCanvas = document.getElementById("preview");
  const previewCtx = previewCanvas.getContext("2d");

  const hudScore = document.getElementById("hud-score");
  const hudBest = document.getElementById("hud-best");
  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
  };
  const overDetail = document.getElementById("over-detail");
  const clearDetail = document.getElementById("clear-detail");

  const fruitImgs = Array.from({ length: 12 }, () => null);
  let imgsReady = false;

  function loadImages() {
    return Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            fruitImgs[i] = img;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `assets/f${i}.png`;
        })
      )
    ).then(() => {
      imgsReady = fruitImgs.some(Boolean);
    });
  }

  let state = "title";
  let fruits = [];
  let particles = [];
  let floats = [];
  let nextType = 0;
  let dropX = W / 2;
  let pointerActive = false;
  let score = 0;
  let best = 0;
  let dropTimer = 0;
  let dangerTimer = 0;
  let unlocked = 4;
  let madeWatermelon = false;
  let showedClear = false;
  let last = 0;
  let raf = 0;
  let uid = 0;

  function readBest() {
    best = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
    hudBest.textContent = best;
  }

  function saveBest() {
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
      hudBest.textContent = best;
    }
  }

  function randNextType() {
    const max = Math.min(4, unlocked);
    return Math.floor(Math.random() * (max + 1));
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (name && overlays[name]) overlays[name].classList.remove("hidden");
  }

  function resetGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    fruits = [];
    particles = [];
    floats = [];
    score = 0;
    dropTimer = 0;
    dangerTimer = 0;
    unlocked = 4;
    madeWatermelon = false;
    showedClear = false;
    nextType = randNextType();
    dropX = W / 2;
    hudScore.textContent = "0";
    uid = 0;
  }

  function spawnFruit(type, x, y, vx, vy) {
    const r = fruitRadius(type);
    return {
      id: ++uid,
      type,
      x: Math.max(WALL_L + r, Math.min(WALL_R - r, x)),
      y,
      vx: vx || 0,
      vy: vy || 0,
      radius: r,
      resting: false,
      mergeLock: 0,
    };
  }

  function addFloat(x, y, text) {
    floats.push({ x, y, text, life: 1.2, vy: -40 });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.4,
        color,
        size: 3 + Math.random() * 5,
      });
    }
  }

  function tryDrop() {
    if (state !== "play" || dropTimer > 0) return;
    const r = fruitRadius(nextType);
    const y = DANGER_Y + r + 4;
    fruits.push(spawnFruit(nextType, dropX, y, 0, 0));
    nextType = randNextType();
    dropTimer = DROP_COOLDOWN;
  }

  function resolveCircle(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const minDist = a.radius + b.radius;
    if (dist >= minDist) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const total = a.radius * a.radius + b.radius * b.radius;
    const wa = b.radius * b.radius / total;
    const wb = a.radius * a.radius / total;

    a.x -= nx * overlap * wa;
    a.y -= ny * overlap * wa;
    b.x += nx * overlap * wb;
    b.y += ny * overlap * wb;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlong = rvx * nx + rvy * ny;
    if (velAlong > 0) return true;

    const restitution = 0.15;
    const j = -(1 + restitution) * velAlong / 2;
    a.vx -= j * nx;
    a.vy -= j * ny;
    b.vx += j * nx;
    b.vy += j * ny;
    return true;
  }

  function mergeFruits(a, b, touching = false) {
    if (a.type !== b.type || a.type >= MAX_TYPE) return false;
    if (a.mergeLock > 0 || b.mergeLock > 0) return false;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (!touching && dist > a.radius + b.radius + 1) return false;

    const newType = a.type + 1;
    const nx = (a.x + b.x) / 2;
    const ny = (a.y + b.y) / 2;
    const pts = (newType + 1) * 10;
    score += pts;
    hudScore.textContent = score;
    saveBest();

    fruits = fruits.filter((f) => f.id !== a.id && f.id !== b.id);
    const merged = spawnFruit(newType, nx, ny, 0, -80);
    merged.mergeLock = 0.25;
    fruits.push(merged);

    burst(nx, ny, FRUIT_COLORS[newType], 16);
    addFloat(nx, ny - 20, `+${pts}`);

    if (newType >= unlocked) unlocked = Math.min(newType + 1, MAX_TYPE);

    if (newType === MAX_TYPE && !madeWatermelon) {
      madeWatermelon = true;
      if (!showedClear) {
        showedClear = true;
        state = "clear";
        clearDetail.textContent = `점수 ${score}점! 수박을 만들었어요!`;
        showOverlay("clear");
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "suika", gameTitle: "수박 합치기", formParent: document.getElementById("clear") });
      TodayGameRank.open(score);
    }
      }
    }
    return true;
  }

  function updatePhysics(dt) {
    for (const f of fruits) {
      f.vy += GRAVITY * dt;
      f.vx *= Math.pow(0.02, dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.mergeLock > 0) f.mergeLock -= dt;

      const r = f.radius;
      if (f.x - r < WALL_L) {
        f.x = WALL_L + r;
        f.vx = Math.abs(f.vx) * 0.35;
      }
      if (f.x + r > WALL_R) {
        f.x = WALL_R - r;
        f.vx = Math.abs(f.vx) * -0.35;
      }
      if (f.y + r > FLOOR_Y) {
        f.y = FLOOR_Y - r;
        f.vy *= -0.2;
        f.vx *= 0.92;
      }
      if (f.y - r < DANGER_Y && f.y + r > DANGER_Y - 20) {
        f.y = DANGER_Y + r;
        f.vy *= -0.1;
      }
    }

    const mergePairs = [];
    const queued = new Set();
    for (let i = 0; i < fruits.length; i++) {
      for (let j = i + 1; j < fruits.length; j++) {
        const a = fruits[i];
        const b = fruits[j];
        const touching =
          Math.hypot(b.x - a.x, b.y - a.y) <= a.radius + b.radius;
        if (
          touching &&
          a.type === b.type &&
          a.type < MAX_TYPE &&
          a.mergeLock <= 0 &&
          b.mergeLock <= 0 &&
          !queued.has(a.id) &&
          !queued.has(b.id)
        ) {
          mergePairs.push([a.id, b.id]);
          queued.add(a.id);
          queued.add(b.id);
        }
      }
    }

    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < fruits.length; i++) {
        for (let j = i + 1; j < fruits.length; j++) {
          resolveCircle(fruits[i], fruits[j]);
        }
      }
    }

    for (const [aId, bId] of mergePairs) {
      const a = fruits.find((f) => f.id === aId);
      const b = fruits.find((f) => f.id === bId);
      if (a && b) mergeFruits(a, b, true);
    }

    for (const f of fruits) {
      const speed = Math.hypot(f.vx, f.vy);
      f.resting = speed < 18 && f.y + f.radius >= FLOOR_Y - 4;
    }
  }

  function checkDanger(dt) {
    let above = false;
    for (const f of fruits) {
      if (f.y - f.radius < DANGER_Y && f.resting) {
        above = true;
        break;
      }
      if (f.y - f.radius < DANGER_Y && Math.hypot(f.vx, f.vy) < 30) {
        above = true;
        break;
      }
    }
    if (above) {
      dangerTimer += dt;
      if (dangerTimer >= DANGER_TIME) {
        state = "over";
        saveBest();
        overDetail.textContent = `점수 ${score}점 · 최고 ${best}점`;
        showOverlay("over");
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "suika", gameTitle: "수박 합치기", formParent: document.getElementById("over") });
      TodayGameRank.open(score);
    }
      }
    } else {
      dangerTimer = Math.max(0, dangerTimer - dt * 2);
    }
  }

  function drawFace(cx, cy, r, type) {
    const eyeY = cy - r * 0.12;
    const eyeX = r * 0.28;
    ctx.fillStyle = "#3d2a2a";
    ctx.beginPath();
    ctx.arc(cx - eyeX, eyeY, r * 0.1, 0, Math.PI * 2);
    ctx.arc(cx + eyeX, eyeY, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3d2a2a";
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.15, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    if (type >= 8) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.12, r * 0.08, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFruit(c, f, alpha) {
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;

    // soft circular shadow so fruits read as round balls
    c.fillStyle = "rgba(80, 40, 60, 0.12)";
    c.beginPath();
    c.ellipse(f.x + 2, f.y + f.radius * 0.82, f.radius * 0.72, f.radius * 0.22, 0, 0, Math.PI * 2);
    c.fill();

    const img = fruitImgs[f.type];
    if (img) {
      const d = f.radius * 2.15;
      c.drawImage(img, f.x - d / 2, f.y - d / 2, d, d);
    } else {
      c.fillStyle = FRUIT_COLORS[f.type];
      c.beginPath();
      c.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.45)";
      c.lineWidth = 2;
      c.stroke();
      drawFace(f.x, f.y, f.radius, f.type);
    }
    c.restore();
  }

  function drawPreview() {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const r = fruitRadius(nextType);
    const cx = previewCanvas.width / 2;
    const cy = previewCanvas.height / 2;
    const drawR = Math.min(22, r);
    const img = fruitImgs[nextType];
    if (img) {
      const d = drawR * 2.15;
      previewCtx.drawImage(img, cx - d / 2, cy - d / 2, d, d);
    } else {
      previewCtx.fillStyle = FRUIT_COLORS[nextType];
      previewCtx.beginPath();
      previewCtx.arc(cx, cy, drawR, 0, Math.PI * 2);
      previewCtx.fill();
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#fff5fa");
    g.addColorStop(0.45, "#ffe8f2");
    g.addColorStop(1, "#ffd6e8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // pink fluffy clouds
    ctx.fillStyle = "rgba(255, 190, 210, 0.45)";
    for (let i = 0; i < 6; i += 1) {
      const cx = 40 + i * 70;
      const cy = 70 + (i % 3) * 28;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 36, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 22, cy + 6, 20, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 24, cy + 5, 22, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // sparkles
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 10; i += 1) {
      const sx = 30 + ((i * 67) % (W - 60));
      const sy = 40 + ((i * 93) % 160);
      ctx.beginPath();
      ctx.moveTo(sx, sy - 5);
      ctx.lineTo(sx + 2, sy);
      ctx.lineTo(sx, sy + 5);
      ctx.lineTo(sx - 2, sy);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255, 150, 180, 0.4)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(WALL_L, DANGER_Y);
    ctx.lineTo(WALL_R, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255, 180, 200, 0.12)";
    ctx.fillRect(WALL_L, DANGER_Y, WALL_R - WALL_L, FLOOR_Y - DANGER_Y);

    ctx.strokeStyle = "#ff9ec0";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(WALL_L, 60);
    ctx.lineTo(WALL_L, FLOOR_Y);
    ctx.quadraticCurveTo(WALL_L - 8, FLOOR_Y + 8, WALL_L + 20, FLOOR_Y + 4);
    ctx.moveTo(WALL_R, 60);
    ctx.lineTo(WALL_R, FLOOR_Y);
    ctx.quadraticCurveTo(WALL_R + 8, FLOOR_Y + 8, WALL_R - 20, FLOOR_Y + 4);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 180, 200, 0.55)";
    ctx.fillRect(WALL_L, FLOOR_Y - 4, WALL_R - WALL_L, 8);

    if (state === "play" && dropTimer <= 0) {
      const r = fruitRadius(nextType);
      const ghostY = DANGER_Y + r + 4;
      ctx.globalAlpha = 0.45;
      drawFruit(ctx, { type: nextType, x: dropX, y: ghostY, radius: r }, 0.45);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255, 120, 160, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(dropX, ghostY - r - 8);
      ctx.lineTo(dropX, DANGER_Y - 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (dangerTimer > 0 && state === "play") {
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 120);
      ctx.fillStyle = `rgba(255, 80, 100, ${pulse * (dangerTimer / DANGER_TIME)})`;
      ctx.fillRect(0, 0, W, DANGER_Y);
    }
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      if (p.life <= 0) return false;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });

    floats = floats.filter((fl) => {
      fl.life -= dt;
      fl.y += fl.vy * dt;
      if (fl.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, fl.life);
      ctx.fillStyle = "#e85a8a";
      ctx.font = "bold 18px Jua, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.globalAlpha = 1;
      return true;
    });
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;

    if (state === "play") {
      if (dropTimer > 0) dropTimer -= dt;
      updatePhysics(dt);
      checkDanger(dt);
    }

    drawBackground();
    for (const f of fruits) drawFruit(ctx, f);
    drawParticles(dt);
    drawPreview();

    raf = requestAnimationFrame(tick);
  }

  function setPointer(x) {
    const rect = canvas.getBoundingClientRect();
    const sx = W / rect.width;
    dropX = (x - rect.left) * sx;
    const r = fruitRadius(nextType);
    dropX = Math.max(WALL_L + r, Math.min(WALL_R - r, dropX));
  }

  let didDrag = false;
  let downX = 0;

  function onPointerDown(e) {
    if (state !== "play") return;
    pointerActive = true;
    didDrag = false;
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? dropX;
    downX = x;
    setPointer(x);
    try {
      canvas.setPointerCapture?.(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  }

  function onPointerMove(e) {
    if (!pointerActive && e.type !== "mousemove" && e.type !== "pointermove") return;
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    if (x == null) return;
    if (Math.abs(x - downX) > 6) didDrag = true;
    setPointer(x);
  }

  function onPointerUp(e) {
    if (!pointerActive) return;
    pointerActive = false;
    // 탭하거나 드래그 후 손을 떼면 떨어뜨림 (휴대폰·PC 공통)
    if (state === "play") tryDrop();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  // 구형 브라우저 폴백
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    onPointerDown(e);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    onPointerMove(e);
  }, { passive: false });
  canvas.addEventListener("touchend", onPointerUp);

  window.addEventListener("keydown", (e) => {
    if (state !== "play") return;
    const r = fruitRadius(nextType);
    const step = e.shiftKey ? 28 : 14;
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      e.preventDefault();
      dropX = Math.max(WALL_L + r, dropX - step);
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      e.preventDefault();
      dropX = Math.min(WALL_R - r, dropX + step);
    } else if (
      e.key === " " ||
      e.key === "Enter" ||
      e.key === "ArrowDown" ||
      e.key.toLowerCase() === "s"
    ) {
      e.preventDefault();
      tryDrop();
    }
  });

  document.getElementById("start-btn").addEventListener("click", () => {
    resetGame();
    state = "play";
    showOverlay(null);
  });

  document.getElementById("continue-btn").addEventListener("click", () => {
    state = "play";
    showOverlay(null);
  });

  document.getElementById("retry-btn").addEventListener("click", () => {
    resetGame();
    state = "play";
    showOverlay(null);
  });

  readBest();
  loadImages().then(() => {
    drawPreview();
  });
  showOverlay("title");
  raf = requestAnimationFrame(tick);

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "suika",
      gameTitle: "수박 합치기",
      formParent: document.getElementById("over") || document.body,
    });
  }
})();
