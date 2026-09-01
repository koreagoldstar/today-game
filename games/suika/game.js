(() => {
  "use strict";

  const W = 390;
  const H = 640;
  const GRAVITY = 850;
  const WALL_L = 24;
  const WALL_R = W - 24;
  const FLOOR_Y = H - 28;
  const DANGER_Y = 108;
  const DROP_COOLDOWN = 0.35;
  const DANGER_TIME = 1.4;
  const MAX_TYPE = 10;
  const STORAGE_KEY = "suika-best";

  const FRUIT_COLORS = [
    "#ff4757", "#ff6b9d", "#a55eea", "#ffa502", "#ff6348",
    "#ffeaa7", "#fdcb6e", "#55efc4", "#e17055", "#00b894", "#2ed573",
  ];

  const FRUIT_EMOJIS = [
    "🍒", "🍓", "🍇", "🍊", "🍎",
    "🍋", "🍑", "🥝", "🍅", "🍈", "🍉",
  ];

  const FRUIT_NAMES = [
    "체리", "딸기", "포도", "귤", "사과",
    "레몬", "복숭아", "키위", "석류", "멜론", "수박",
  ];

  function fruitRadius(type) {
    return 15 + type * 5.5;
  }

  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const previewCanvas = document.getElementById("preview");
  const previewCtx = previewCanvas ? previewCanvas.getContext("2d") : null;

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
    );
  }
  loadImages();

  let state = "title";
  let fruits = [];
  let particles = [];
  let floats = [];
  let nextType = 0;
  let dropX = W / 2;
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
    if (hudBest) hudBest.textContent = best;
  }

  function saveBest() {
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
      if (hudBest) hudBest.textContent = best;
    }
  }

  function randNextType() {
    const max = Math.min(4, unlocked);
    return Math.floor(Math.random() * (max + 1));
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => {
      if (el) el.classList.add("hidden");
    });
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
    if (hudScore) hudScore.textContent = "0";
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
      scale: 0.1, // Smooth pop scale-in animation
    };
  }

  function addFloat(x, y, text) {
    floats.push({ x, y, text, life: 1.2, vy: -35 });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 160;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
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

  // Stable Physics Circle Collision Solver (Anti-Jitter)
  function resolveCircle(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const minDist = a.radius + b.radius;
    if (dist >= minDist) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    // Smoother mass-based position relaxation (0.8 damping factor prevents vibration)
    const totalR = a.radius + b.radius;
    const wa = b.radius / totalR;
    const wb = a.radius / totalR;

    a.x -= nx * overlap * wa * 0.85;
    a.y -= ny * overlap * wa * 0.85;
    b.x += nx * overlap * wb * 0.85;
    b.y += ny * overlap * wb * 0.85;

    // Dampen relative velocity to stop endless jitter
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlong = rvx * nx + rvy * ny;

    if (velAlong < 0) {
      const restitution = 0.12;
      const j = -(1 + restitution) * velAlong / 2;
      a.vx -= j * nx * 0.9;
      a.vy -= j * ny * 0.9;
      b.vx += j * nx * 0.9;
      b.vy += j * ny * 0.9;
    }

    // Friction when sliding against each other
    a.vx *= 0.98;
    b.vx *= 0.98;
    return true;
  }

  function mergeFruits(a, b, touching = false) {
    if (a.type !== b.type || a.type >= MAX_TYPE) return false;
    if (a.mergeLock > 0 || b.mergeLock > 0) return false;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (!touching && dist > a.radius + b.radius + 2) return false;

    const newType = a.type + 1;
    const nx = (a.x + b.x) / 2;
    const ny = (a.y + b.y) / 2;
    const pts = (newType + 1) * 10;
    score += pts;
    if (hudScore) hudScore.textContent = score;
    saveBest();

    fruits = fruits.filter((f) => f.id !== a.id && f.id !== b.id);
    const merged = spawnFruit(newType, nx, ny, 0, -60);
    merged.mergeLock = 0.2;
    fruits.push(merged);

    burst(nx, ny, FRUIT_COLORS[newType], 18);
    addFloat(nx, ny - 20, `+${pts}`);

    if (newType >= unlocked) unlocked = Math.min(newType + 1, MAX_TYPE);

    if (newType === MAX_TYPE && !madeWatermelon) {
      madeWatermelon = true;
      if (!showedClear) {
        showedClear = true;
        state = "clear";
        if (clearDetail) clearDetail.textContent = `최종 점수 ${score}점! 수박 완성!`;
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
    // 1. Move & Apply Gravity
    for (const f of fruits) {
      if (f.scale < 1) f.scale = Math.min(1, f.scale + dt * 6);

      f.vy += GRAVITY * dt;
      // Damping velocity
      f.vx *= Math.pow(0.01, dt);
      f.vy *= Math.pow(0.3, dt);

      // Clamp max velocity to prevent wild tunneling/shaking
      const maxSpd = 480;
      const spd = Math.hypot(f.vx, f.vy);
      if (spd > maxSpd) {
        f.vx = (f.vx / spd) * maxSpd;
        f.vy = (f.vy / spd) * maxSpd;
      }

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.mergeLock > 0) f.mergeLock -= dt;

      const r = f.radius;
      // Wall Bounds
      if (f.x - r < WALL_L) {
        f.x = WALL_L + r;
        f.vx = Math.abs(f.vx) * 0.2;
      }
      if (f.x + r > WALL_R) {
        f.x = WALL_R - r;
        f.vx = -Math.abs(f.vx) * 0.2;
      }
      // Floor Bounds
      if (f.y + r > FLOOR_Y) {
        f.y = FLOOR_Y - r;
        f.vy *= -0.15;
        f.vx *= 0.88;
      }
    }

    // 2. Queue Merges
    const mergePairs = [];
    const queued = new Set();
    for (let i = 0; i < fruits.length; i++) {
      for (let j = i + 1; j < fruits.length; j++) {
        const a = fruits[i];
        const b = fruits[j];
        const touching = Math.hypot(b.x - a.x, b.y - a.y) <= a.radius + b.radius + 1;
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

    // 3. Multi-Pass Circle Collision Constraint Solver (8 Passes for Rock-Solid Stability)
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 0; i < fruits.length; i++) {
        for (let j = i + 1; j < fruits.length; j++) {
          resolveCircle(fruits[i], fruits[j]);
        }
      }
      // Re-apply wall/floor bounds inside solver loop
      for (const f of fruits) {
        const r = f.radius;
        if (f.x - r < WALL_L) f.x = WALL_L + r;
        if (f.x + r > WALL_R) f.x = WALL_R - r;
        if (f.y + r > FLOOR_Y) f.y = FLOOR_Y - r;
      }
    }

    // 4. Perform Merges
    for (const [aId, bId] of mergePairs) {
      const a = fruits.find((f) => f.id === aId);
      const b = fruits.find((f) => f.id === bId);
      if (a && b) mergeFruits(a, b, true);
    }

    // 5. Check Resting State
    for (const f of fruits) {
      const speed = Math.hypot(f.vx, f.vy);
      f.resting = speed < 22 && f.y + f.radius >= FLOOR_Y - 8;
    }
  }

  function checkDanger(dt) {
    let above = false;
    for (const f of fruits) {
      if (f.y - f.radius < DANGER_Y && (f.resting || Math.hypot(f.vx, f.vy) < 25)) {
        above = true;
        break;
      }
    }
    if (above) {
      dangerTimer += dt;
      if (dangerTimer >= DANGER_TIME) {
        state = "over";
        saveBest();
        if (overDetail) overDetail.textContent = `최종 점수 ${score}점 · 최고 점수 ${best}점`;
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

  // Ultra-Legible Fruit Renderer with 3D Spherical Shading & High-Contrast Outlines
  function drawFruit(c, f, alpha) {
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;

    const r = f.radius * (f.scale || 1);
    const cx = f.x;
    const cy = f.y;

    // Drop Shadow for 3D Depth
    c.fillStyle = "rgba(40, 20, 30, 0.18)";
    c.beginPath();
    c.ellipse(cx + 2, cy + r * 0.82, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
    c.fill();

    const img = fruitImgs[f.type];
    if (img && img.complete && img.naturalWidth > 0) {
      const d = r * 2.15;
      c.drawImage(img, cx - d / 2, cy - d / 2, d, d);

      // Add clear outer border around image for distinction
      c.strokeStyle = "rgba(255, 255, 255, 0.6)";
      c.lineWidth = Math.max(2, r * 0.06);
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();
    } else {
      // Procedural Spherical Shaded Fruit
      const grad = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.3, FRUIT_COLORS[f.type] || "#ff4757");
      grad.addColorStop(1, "#1a0810");

      c.fillStyle = grad;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();

      // Thick Crisp Outline Ring for max readability
      c.strokeStyle = "#ffffff";
      c.lineWidth = Math.max(2.5, r * 0.08);
      c.stroke();

      c.strokeStyle = "rgba(0,0,0,0.25)";
      c.lineWidth = 1.5;
      c.stroke();

      // Emoji & Name Badge Icon
      c.font = `${Math.max(12, Math.floor(r * 0.85))}px sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(FRUIT_EMOJIS[f.type] || "🍎", cx, cy - (r > 28 ? 4 : 0));

      if (r > 28) {
        c.font = `bold ${Math.max(10, Math.floor(r * 0.32))}px "Jua", sans-serif`;
        c.fillStyle = "#ffffff";
        c.shadowColor = "rgba(0,0,0,0.8)";
        c.shadowBlur = 4;
        c.fillText(FRUIT_NAMES[f.type] || "", cx, cy + r * 0.5);
      }
    }

    c.restore();
  }

  function drawPreview() {
    if (!previewCtx) return;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const r = fruitRadius(nextType);
    const cx = previewCanvas.width / 2;
    const cy = previewCanvas.height / 2;
    const drawR = Math.min(22, r);
    const img = fruitImgs[nextType];

    if (img && img.complete && img.naturalWidth > 0) {
      const d = drawR * 2.15;
      previewCtx.drawImage(img, cx - d / 2, cy - d / 2, d, d);
    } else {
      previewCtx.fillStyle = FRUIT_COLORS[nextType];
      previewCtx.beginPath();
      previewCtx.arc(cx, cy, drawR, 0, Math.PI * 2);
      previewCtx.fill();
      previewCtx.font = "16px sans-serif";
      previewCtx.textAlign = "center";
      previewCtx.textBaseline = "middle";
      previewCtx.fillText(FRUIT_EMOJIS[nextType], cx, cy);
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#fff5fa");
    g.addColorStop(0.45, "#ffe8f2");
    g.addColorStop(1, "#ffd6e8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Pink Fluffy Clouds
    ctx.fillStyle = "rgba(255, 190, 210, 0.45)";
    for (let i = 0; i < 6; i++) {
      const cx = 40 + i * 70;
      const cy = 70 + (i % 3) * 28;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 36, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 22, cy + 6, 20, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 24, cy + 5, 22, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Danger Line
    ctx.strokeStyle = dangerTimer > 0 ? "#ff0055" : "rgba(255, 120, 160, 0.6)";
    ctx.lineWidth = dangerTimer > 0 ? 3 : 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(WALL_L, DANGER_Y);
    ctx.lineTo(WALL_R, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glass Container Walls & Floor
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(0, 0, WALL_L, H);
    ctx.fillRect(WALL_R, 0, W - WALL_R, H);
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    ctx.strokeStyle = "rgba(255, 150, 180, 0.5)";
    ctx.lineWidth = 3;
    ctx.strokeRect(WALL_L, DANGER_Y, WALL_R - WALL_L, FLOOR_Y - DANGER_Y);
  }

  function render() {
    drawBackground();

    // Depth Sorting: Render Larger & Bottom fruits first, smaller fruits on top for legibility
    const sortedFruits = fruits.slice().sort((a, b) => b.radius - a.radius || a.y - b.y);
    for (const f of sortedFruits) {
      drawFruit(ctx, f);
    }

    // Aim Guide Line & Spawning Fruit Preview
    if (state === "play" && dropTimer <= 0) {
      const r = fruitRadius(nextType);

      ctx.strokeStyle = "rgba(255, 100, 150, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(dropX, DANGER_Y);
      ctx.lineTo(dropX, FLOOR_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      drawFruit(ctx, { type: nextType, x: dropX, y: DANGER_Y + r + 4, radius: r, scale: 1 }, 0.85);
    }

    // Render Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.life -= 0.016;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating Score Badges
    for (let i = floats.length - 1; i >= 0; i--) {
      const fl = floats[i];
      fl.y += fl.vy * 0.016;
      fl.life -= 0.016;
      if (fl.life <= 0) {
        floats.splice(i, 1);
        continue;
      }
      ctx.font = 'bold 20px "Jua", sans-serif';
      ctx.fillStyle = "#ff4757";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 6;
      ctx.textAlign = "center";
      ctx.globalAlpha = Math.min(1, fl.life * 1.5);
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    drawPreview();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (state === "play") {
      if (dropTimer > 0) dropTimer -= dt;
      updatePhysics(dt);
      checkDanger(dt);
    }

    render();
    raf = requestAnimationFrame(loop);
  }

  function getXFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    if (e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;
    const r = fruitRadius(nextType);
    const relX = ((clientX - rect.left) / rect.width) * W;
    return Math.max(WALL_L + r, Math.min(WALL_R - r, relX));
  }

  function bindInput() {
    canvas.addEventListener("pointerdown", (e) => {
      if (state !== "play") return;
      dropX = getXFromEvent(e);
      tryDrop();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (state !== "play") return;
      dropX = getXFromEvent(e);
    });

    canvas.addEventListener("touchstart", (e) => {
      if (state !== "play") return;
      e.preventDefault();
      dropX = getXFromEvent(e);
      tryDrop();
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
      if (state !== "play") return;
      e.preventDefault();
      dropX = getXFromEvent(e);
    }, { passive: false });

    const startBtn = document.getElementById("start-btn");
    const retryBtn = document.getElementById("retry-btn");
    const nextBtn = document.getElementById("next-btn");

    if (startBtn) {
      startBtn.addEventListener("click", () => {
        resetGame();
        state = "play";
        showOverlay(null);
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        resetGame();
        state = "play";
        showOverlay(null);
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        resetGame();
        state = "play";
        showOverlay(null);
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      });
    }
  }

  readBest();
  bindInput();
  showOverlay("title");

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

  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
})();
