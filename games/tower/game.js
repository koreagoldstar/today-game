(() => {
  "use strict";

  const W = 390;
  const H = 620;
  const BLOCK_H = 32;
  const COLORS = ["#ff8ab5", "#ffe27a", "#b5ff9a", "#d4a0ff", "#7ec8ff", "#ff9a6b", "#6fd6b0"];
  const sprites = { hook: null, blocks: [] };

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [hook, ...blocks] = await Promise.all([
      loadImg("assets/hook.png"),
      loadImg("assets/block0.png"),
      loadImg("assets/block1.png"),
      loadImg("assets/block2.png"),
      loadImg("assets/block3.png"),
      loadImg("assets/block4.png"),
    ]);
    sprites.hook = hook;
    sprites.blocks = blocks.filter(Boolean);
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  const overlays = {
    title: document.getElementById("title"),
    over: document.getElementById("over"),
  };

  let state = "title";
  let score = 0;
  let best = Number(localStorage.getItem("tower-best") || "0");
  let blocks = [];
  let current = null;
  let hookX = W / 2;
  let hookDir = 1;
  let hookSpeed = 2.4;
  let cameraY = 0;
  let targetCamY = 0;
  let perfectFlash = 0;
  let shake = 0;
  let last = 0;
  let raf = 0;

  document.getElementById("best").textContent = String(best);

  function resetGame() {
    score = 0;
    blocks = [{ x: W / 2 - 80, y: H - 80, w: 160, h: BLOCK_H, color: COLORS[0], face: 0 }];
    hookSpeed = 2.4;
    cameraY = 0;
    targetCamY = 0;
    spawnBlock();
    updateHud();
  }

  function stackBlocks() {
    return blocks.filter((b) => !b.falling);
  }

  function spawnBlock() {
    const prev = stackBlocks()[stackBlocks().length - 1];
    const w = prev.w;
    const y = prev.y - BLOCK_H - 4;
    current = {
      x: W / 2 - w / 2,
      y: y - 120,
      w,
      h: BLOCK_H,
      color: COLORS[blocks.length % COLORS.length],
      face: blocks.length % Math.max(1, sprites.blocks.length || COLORS.length),
      dropping: false,
      vy: 0,
    };
    hookX = W / 2;
    hookDir = 1;
    hookSpeed = Math.min(4.2, 2.2 + blocks.length * 0.04);
  }

  function updateHud() {
    document.getElementById("score").textContent = String(score);
  }

  function dropBlock() {
    if (state !== "play" || !current || current.dropping) return;
    current.dropping = true;
    current.vy = 0;
  }

  function endGame() {
    state = "over";
    if (score > best) {
      best = score;
      localStorage.setItem("tower-best", String(best));
      document.getElementById("best").textContent = String(best);
    }
    document.getElementById("over-detail").textContent = `점수 ${score} · 최고 ${best}`;
    overlays.over.classList.remove("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "tower", gameTitle: "흔들흔들 스카이", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    overlays.title.classList.add("hidden");
    overlays.over.classList.add("hidden");
    resetGame();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function settleBlock() {
    const prev = stackBlocks()[stackBlocks().length - 1];
    const cur = current;
    const overlapLeft = Math.max(prev.x, cur.x);
    const overlapRight = Math.min(prev.x + prev.w, cur.x + cur.w);
    const overlap = overlapRight - overlapLeft;

    if (overlap <= 8) {
      shake = 0.35;
      endGame();
      return;
    }

    const perfect = Math.abs(overlap - prev.w) < 6;
    const newW = overlap;
    const newX = overlapLeft;

    blocks.push({
      x: newX,
      y: prev.y - BLOCK_H - 4,
      w: newW,
      h: BLOCK_H,
      color: cur.color,
      face: cur.face || 0,
    });

    if (!perfect && overlap < prev.w) {
      const cutSide = cur.x < prev.x ? "left" : "right";
      const cutW = prev.w - overlap;
      const cutX = cutSide === "left" ? cur.x : cur.x + overlap;
      blocks.push({
        x: cutX,
        y: cur.y,
        w: cutW,
        h: BLOCK_H,
        color: cur.color,
        face: cur.face || 0,
        falling: true,
        vy: 0,
        rot: cutSide === "left" ? -0.08 : 0.08,
      });
    }

    score += perfect ? 2 : 1;
    if (perfect) perfectFlash = 0.5;
    updateHud();
    spawnBlock();

    const topY = stackBlocks()[stackBlocks().length - 1].y;
    if (topY < H * 0.45) {
      targetCamY = H * 0.45 - topY;
    }
  }

  function update(dt) {
    if (perfectFlash > 0) perfectFlash -= dt;
    if (shake > 0) shake -= dt;

    if (current && !current.dropping) {
      hookX += hookDir * hookSpeed * 60 * dt;
      const margin = current.w / 2 + 12;
      if (hookX < margin) {
        hookX = margin;
        hookDir = 1;
      }
      if (hookX > W - margin) {
        hookX = W - margin;
        hookDir = -1;
      }
      current.x = hookX - current.w / 2;
    }

    if (current && current.dropping) {
      current.vy += 1800 * dt;
      current.y += current.vy * dt;
      const prev = stackBlocks()[stackBlocks().length - 1];
      const landY = prev.y - BLOCK_H - 4;
      if (current.y >= landY) {
        current.y = landY;
        settleBlock();
      }
    }

    blocks.forEach((b) => {
      if (!b.falling) return;
      b.vy = (b.vy || 0) + 1200 * dt;
      b.y += b.vy * dt;
      b.rot = (b.rot || 0) + 0.06;
      if (b.y > H + 80) b.dead = true;
    });
    blocks = blocks.filter((b) => !b.dead);

    cameraY += (targetCamY - cameraY) * Math.min(1, dt * 6);
  }

  function drawBlock(b, cam) {
    const x = b.x;
    const y = b.y + cam;
    const face = b.face || 0;
    ctx.save();
    if (b.falling) {
      ctx.translate(x + b.w / 2, y + b.h / 2);
      ctx.rotate(b.rot || 0);
      ctx.translate(-(x + b.w / 2), -(y + b.h / 2));
    }

    const spr = sprites.blocks.length ? sprites.blocks[face % sprites.blocks.length] : null;
    if (spr && b.w < 120) {
      ctx.drawImage(spr, x, y, b.w, b.h);
    } else {
      const g = ctx.createLinearGradient(x, y, x, y + b.h);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.28, b.color);
      g.addColorStop(1, shade(b.color, -28));
      ctx.fillStyle = g;
      roundRect(x, y, b.w, b.h, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,40,50,0.35)";
      ctx.lineWidth = 2.2;
      roundRect(x, y, b.w, b.h, 10);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      roundRect(x + 5, y + 4, b.w * 0.4, 6, 4);
      ctx.fill();

      // kawaii face
      const eyeY = y + b.h * 0.48;
      ctx.fillStyle = "#3a2430";
      ctx.beginPath();
      ctx.arc(x + b.w * 0.35, eyeY, 3.2, 0, Math.PI * 2);
      ctx.arc(x + b.w * 0.65, eyeY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + b.w * 0.32, eyeY - 1.1, 1.1, 0, Math.PI * 2);
      ctx.arc(x + b.w * 0.62, eyeY - 1.1, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a2430";
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (face % 3 === 1) {
        ctx.arc(x + b.w * 0.65, eyeY - 0.5, 3.5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.moveTo(x + b.w * 0.42, y + b.h * 0.62);
        ctx.arc(x + b.w / 2, y + b.h * 0.58, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
      } else {
        ctx.arc(x + b.w / 2, y + b.h * 0.56, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(255,140,170,0.45)";
      ctx.beginPath();
      ctx.ellipse(x + b.w * 0.22, eyeY + 4, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.ellipse(x + b.w * 0.78, eyeY + 4, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
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
    const cam = cameraY;
    const sx = shake > 0 ? (Math.random() - 0.5) * 8 * shake : 0;
    ctx.save();
    ctx.translate(sx, 0);

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#7ec8ff");
    sky.addColorStop(0.5, "#b8e4ff");
    sky.addColorStop(1, "#ffe8f5");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // decorative stars
    const t = Date.now() * 0.001;
    for (let i = 0; i < 10; i += 1) {
      const sx2 = (i * 73 + 20) % W;
      const sy = 30 + (i * 47) % 180;
      ctx.fillStyle = ["#ffe27a", "#ff8ab5", "#7ec8ff"][i % 3];
      ctx.globalAlpha = 0.55 + Math.sin(t + i) * 0.2;
      ctx.beginPath();
      const r = 3 + (i % 3);
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
        const a2 = a + Math.PI / 5;
        const ox = sx2 + Math.cos(a) * r;
        const oy = sy + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
        ctx.lineTo(sx2 + Math.cos(a2) * r * 0.4, sy + Math.sin(a2) * r * 0.4);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // fluffy pink/white clouds
    for (let i = 0; i < 7; i += 1) {
      const cx = (i * 97 + (Date.now() * 0.012) % 90) % (W + 80) - 40;
      const cy = 50 + i * 42 + cam * 0.12;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.7)" : "rgba(255,200,220,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 38, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 22, cy + 2, 28, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 18, cy + 3, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // soft cloud ground
    ctx.fillStyle = "rgba(255, 210, 230, 0.85)";
    ctx.beginPath();
    ctx.ellipse(W * 0.25, H - 20 + cam, 120, 36, 0, 0, Math.PI * 2);
    ctx.ellipse(W * 0.55, H - 10 + cam, 140, 40, 0, 0, Math.PI * 2);
    ctx.ellipse(W * 0.85, H - 22 + cam, 110, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    blocks.forEach((b) => drawBlock(b, cam));

    if (current && !current.dropping) {
      const hx = hookX;
      const hy = current.y + current.h + cam - 8;
      ctx.strokeStyle = "#3a2430";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hx, -20);
      ctx.lineTo(hx, hy - 10);
      ctx.stroke();
      if (sprites.hook) {
        const hw = 28;
        const hh = 40;
        ctx.drawImage(sprites.hook, hx - hw / 2, hy - hh + 6, hw, hh);
      } else {
        ctx.fillStyle = "#ff8ab5";
        ctx.beginPath();
        ctx.arc(hx, hy, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      drawBlock({ ...current, y: current.y }, cam);
    } else if (current) {
      drawBlock({ ...current, y: current.y }, cam);
    }

    if (perfectFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${perfectFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px Jua, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PERFECT!", W / 2, H * 0.35);
    }

    ctx.restore();
  }

  function loop(t) {
    if (state !== "play") return;
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "title") return;
    dropBlock();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      dropBlock();
    }
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  loadAssets().then(() => draw());
  draw();

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "tower",
      gameTitle: "흔들흔들 스카이",
      formParent: overlays.over || document.body,
    });
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
        if (typeof last !== "undefined") last = performance.now();
        return true;
      },
    });
  }

})();
