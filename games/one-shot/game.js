(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GAME_ID = "one-shot";
  const GAME_TITLE = "한 발 저격";
  const BEST_KEY = "today-one-shot-best";
  const MAX_STAGE = 30;
  const AIM_PAD = { top: 70, bottom: 150, left: 18, right: 18 };

  /** Precision rifle stages — smaller hit radii, careful placement */
  const STAGES = [
    { ammo: 3, targets: [{ type: "balloon", color: "red", x: 195, y: 240, r: 18 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 130, y: 210, r: 16 }, { type: "balloon", color: "yellow", x: 265, y: 250, r: 16 }] },
    { ammo: 3, targets: [{ type: "can", x: 195, y: 300, r: 14 }, { type: "balloon", color: "red", x: 195, y: 170, r: 15 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "yellow", x: 95, y: 200, r: 14 }, { type: "balloon", color: "blue", x: 195, y: 230, r: 14 }, { type: "balloon", color: "red", x: 295, y: 200, r: 14 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "red", x: 195, y: 210, r: 14, move: "sine", amp: 36, speed: 1.2 }] },
    { ammo: 4, targets: [{ type: "can", x: 120, y: 310, r: 13 }, { type: "can", x: 270, y: 310, r: 13 }, { type: "balloon", color: "blue", x: 195, y: 180, r: 14 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "yellow", x: 110, y: 220, r: 13, move: "patrol", amp: 48, speed: 1.0 }, { type: "balloon", color: "red", x: 290, y: 190, r: 13 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "blue", x: 80, y: 170, r: 12 }, { type: "balloon", color: "red", x: 195, y: 140, r: 12 }, { type: "balloon", color: "yellow", x: 310, y: 170, r: 12 }, { type: "can", x: 195, y: 300, r: 12 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "red", x: 150, y: 200, r: 12, move: "sine", amp: 42, speed: 1.4 }, { type: "balloon", color: "blue", x: 250, y: 240, r: 12, move: "sine", amp: 30, speed: 1.1 }] },
    { ammo: 4, targets: [{ type: "can", x: 90, y: 320, r: 12 }, { type: "can", x: 195, y: 320, r: 12 }, { type: "can", x: 300, y: 320, r: 12 }, { type: "balloon", color: "yellow", x: 195, y: 160, r: 12, move: "patrol", amp: 70, speed: 1.15 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 195, y: 150, r: 11, move: "sine", amp: 70, speed: 1.55 }, { type: "can", x: 195, y: 310, r: 12 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "red", x: 70, y: 180, r: 11 }, { type: "balloon", color: "yellow", x: 150, y: 210, r: 11, move: "sine", amp: 26, speed: 1.35 }, { type: "balloon", color: "blue", x: 240, y: 175, r: 11 }, { type: "balloon", color: "red", x: 320, y: 215, r: 11, move: "sine", amp: 24, speed: 1.2 }] },
    { ammo: 3, targets: [{ type: "can", x: 125, y: 280, r: 11, move: "patrol", amp: 36, speed: 0.85 }, { type: "balloon", color: "yellow", x: 280, y: 170, r: 11, move: "sine", amp: 40, speed: 1.5 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "blue", x: 100, y: 150, r: 11, move: "patrol", amp: 36, speed: 1.1 }, { type: "balloon", color: "red", x: 195, y: 190, r: 11, move: "sine", amp: 48, speed: 1.35 }, { type: "balloon", color: "yellow", x: 290, y: 150, r: 11, move: "patrol", amp: 36, speed: 1.1 }] },
    { ammo: 4, targets: [{ type: "can", x: 80, y: 310, r: 11 }, { type: "can", x: 310, y: 310, r: 11 }, { type: "balloon", color: "red", x: 145, y: 175, r: 10, move: "sine", amp: 34, speed: 1.6 }, { type: "balloon", color: "blue", x: 250, y: 175, r: 10, move: "sine", amp: 34, speed: 1.6 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "yellow", x: 195, y: 130, r: 10, move: "patrol", amp: 105, speed: 1.45 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "red", x: 95, y: 160, r: 10, move: "sine", amp: 30, speed: 1.8 }, { type: "balloon", color: "blue", x: 195, y: 205, r: 10, move: "sine", amp: 44, speed: 1.25 }, { type: "balloon", color: "yellow", x: 295, y: 160, r: 10, move: "sine", amp: 30, speed: 1.8 }, { type: "can", x: 195, y: 320, r: 11 }] },
    { ammo: 4, targets: [{ type: "can", x: 115, y: 290, r: 11, move: "patrol", amp: 46, speed: 1.0 }, { type: "can", x: 280, y: 290, r: 11, move: "patrol", amp: 46, speed: 1.0 }, { type: "balloon", color: "red", x: 195, y: 145, r: 10, move: "sine", amp: 55, speed: 1.5 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 125, y: 170, r: 10, move: "patrol", amp: 55, speed: 1.35 }, { type: "balloon", color: "yellow", x: 270, y: 210, r: 10, move: "patrol", amp: 55, speed: 1.35 }] },
    { ammo: 5, targets: [{ type: "balloon", color: "red", x: 70, y: 185, r: 10 }, { type: "balloon", color: "blue", x: 140, y: 145, r: 10 }, { type: "balloon", color: "yellow", x: 210, y: 185, r: 10 }, { type: "balloon", color: "red", x: 280, y: 145, r: 10 }, { type: "balloon", color: "blue", x: 340, y: 185, r: 10 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "yellow", x: 100, y: 155, r: 9, move: "sine", amp: 48, speed: 1.7 }, { type: "balloon", color: "red", x: 195, y: 125, r: 9, move: "patrol", amp: 88, speed: 1.25 }, { type: "balloon", color: "blue", x: 290, y: 155, r: 9, move: "sine", amp: 48, speed: 1.7 }] },
    { ammo: 4, targets: [{ type: "can", x: 90, y: 320, r: 10 }, { type: "can", x: 195, y: 280, r: 10, move: "patrol", amp: 30, speed: 1.1 }, { type: "can", x: 300, y: 320, r: 10 }, { type: "balloon", color: "red", x: 195, y: 135, r: 9, move: "sine", amp: 65, speed: 1.85 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 195, y: 120, r: 9, move: "patrol", amp: 115, speed: 1.65 }, { type: "can", x: 195, y: 300, r: 10 }] },
    { ammo: 5, targets: [{ type: "balloon", color: "red", x: 80, y: 165, r: 9, move: "sine", amp: 26, speed: 1.9 }, { type: "balloon", color: "yellow", x: 160, y: 205, r: 9, move: "sine", amp: 34, speed: 1.45 }, { type: "balloon", color: "blue", x: 240, y: 165, r: 9, move: "sine", amp: 26, speed: 1.9 }, { type: "balloon", color: "red", x: 320, y: 205, r: 9, move: "sine", amp: 34, speed: 1.45 }, { type: "can", x: 195, y: 325, r: 10 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "yellow", x: 110, y: 145, r: 9, move: "patrol", amp: 42, speed: 1.55 }, { type: "balloon", color: "blue", x: 280, y: 145, r: 9, move: "patrol", amp: 42, speed: 1.55 }, { type: "balloon", color: "red", x: 195, y: 205, r: 9, move: "sine", amp: 58, speed: 1.8 }] },
    { ammo: 4, targets: [{ type: "can", x: 100, y: 305, r: 10, move: "patrol", amp: 50, speed: 1.15 }, { type: "can", x: 290, y: 305, r: 10, move: "patrol", amp: 50, speed: 1.15 }, { type: "balloon", color: "yellow", x: 150, y: 155, r: 8, move: "sine", amp: 40, speed: 2.0 }, { type: "balloon", color: "red", x: 250, y: 155, r: 8, move: "sine", amp: 40, speed: 2.0 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 75, y: 175, r: 8, move: "sine", amp: 34, speed: 2.1 }, { type: "balloon", color: "red", x: 195, y: 125, r: 8, move: "patrol", amp: 98, speed: 1.75 }, { type: "balloon", color: "yellow", x: 315, y: 175, r: 8, move: "sine", amp: 34, speed: 2.1 }] },
    { ammo: 5, targets: [{ type: "can", x: 70, y: 318, r: 9 }, { type: "can", x: 150, y: 300, r: 9 }, { type: "can", x: 240, y: 300, r: 9 }, { type: "can", x: 320, y: 318, r: 9 }, { type: "balloon", color: "red", x: 195, y: 135, r: 8, move: "sine", amp: 72, speed: 1.95 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "yellow", x: 100, y: 135, r: 8, move: "patrol", amp: 46, speed: 1.85 }, { type: "balloon", color: "blue", x: 195, y: 185, r: 8, move: "sine", amp: 62, speed: 2.0 }, { type: "balloon", color: "red", x: 290, y: 135, r: 8, move: "patrol", amp: 46, speed: 1.85 }, { type: "can", x: 195, y: 315, r: 9, move: "patrol", amp: 34, speed: 1.1 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "red", x: 90, y: 155, r: 8, move: "sine", amp: 44, speed: 2.2 }, { type: "balloon", color: "blue", x: 195, y: 115, r: 8, move: "patrol", amp: 110, speed: 1.9 }, { type: "balloon", color: "yellow", x: 300, y: 155, r: 8, move: "sine", amp: 44, speed: 2.2 }, { type: "can", x: 155, y: 310, r: 9 }, { type: "can", x: 245, y: 310, r: 9 }] },
  ];

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

  const stageEl = document.querySelector(".stage");
  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    allclear: document.getElementById("allclear"),
  };
  const steadyBtn = document.getElementById("steady-btn");
  const fireBtn = document.getElementById("fire-btn");

  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
  document.getElementById("hud-best").textContent = String(best);

  const imgs = {};
  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let ammo = 0;
  let ammoMax = 0;
  let targets = [];
  let aim = { x: W / 2, y: H * 0.42 };
  let sway = { x: 0, y: 0, t: 0 };
  let steady = false;
  let dragAim = false;
  let lastPointer = null;
  let recoil = 0;
  let flash = 0;
  let muzzle = 0;
  let tracer = null;
  let particles = [];
  let floats = [];
  let clouds = [];
  let last = 0;
  let raf = 0;
  let shake = 0;
  let fireLock = 0;

  function isBg(r, g, b, a) {
    if (a < 12) return true;
    if (r > 185 && b > 170 && g < 150 && r + b > g * 2) return true;
    if (r < 16 && g < 16 && b < 16) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 230 && max - min < 26) return true;
    return false;
  }

  function punchBg(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    const w = c.width;
    const h = c.height;
    const seen = new Uint8Array(w * h);
    const stack = [];
    const push = (px, py) => {
      const i = py * w + px;
      if (seen[i]) return;
      seen[i] = 1;
      stack.push(i);
    };
    for (let px = 0; px < w; px += 1) {
      push(px, 0);
      push(px, h - 1);
    }
    for (let py = 0; py < h; py += 1) {
      push(0, py);
      push(w - 1, py);
    }
    while (stack.length) {
      const i = stack.pop();
      const o = i * 4;
      if (!isBg(d[o], d[o + 1], d[o + 2], d[o + 3])) continue;
      d[o + 3] = 0;
      const px = i % w;
      const py = (i / w) | 0;
      if (px > 0) push(px - 1, py);
      if (px < w - 1) push(px + 1, py);
      if (py > 0) push(px, py - 1);
      if (py < h - 1) push(px, py + 1);
    }
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (isBg(d[i], d[i + 1], d[i + 2], d[i + 3])) d[i + 3] = 0;
      if (d[i + 3] < 12) continue;
      const px = (i / 4) % w;
      const py = ((i / 4) / w) | 0;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    x.putImageData(data, 0, 0);
    if (maxX <= minX) return c;
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const side = Math.max(bw, bh);
    const out = document.createElement("canvas");
    out.width = side;
    out.height = side;
    out
      .getContext("2d")
      .drawImage(c, minX, minY, bw, bh, ((side - bw) / 2) | 0, ((side - bh) / 2) | 0, bw, bh);
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
    const map = {
      chick: "assets/chick.png",
      crosshair: "assets/crosshair.png",
      red: "assets/balloon-red.png",
      blue: "assets/balloon-blue.png",
      yellow: "assets/balloon-yellow.png",
      can: "assets/can.png",
    };
    await Promise.all(
      Object.entries(map).map(async ([k, src]) => {
        const raw = await loadImg(src);
        imgs[k] = raw ? punchBg(raw) : null;
      })
    );
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (name && overlays[name]) overlays[name].classList.remove("hidden");
    stageEl.classList.toggle("playing", name == null);
  }

  function updateHud() {
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-score").textContent = String(Math.floor(score));
    document.getElementById("hud-best").textContent = String(best);
    const ammoEl = document.getElementById("hud-ammo");
    ammoEl.innerHTML = "";
    for (let i = 0; i < ammoMax; i += 1) {
      const d = document.createElement("i");
      if (i >= ammo) d.className = "empty";
      ammoEl.appendChild(d);
    }
  }

  function saveBest() {
    if (score > best) {
      best = Math.floor(score);
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function seedDecor() {
    clouds = [];
    for (let i = 0; i < 5; i += 1) {
      clouds.push({
        x: Math.random() * W,
        y: 50 + Math.random() * 160,
        s: 0.55 + Math.random() * 0.8,
        v: 5 + Math.random() * 12,
      });
    }
  }

  function makeTarget(def) {
    return {
      type: def.type,
      color: def.color || "red",
      baseX: def.x,
      baseY: def.y,
      x: def.x,
      y: def.y,
      r: def.r || 12,
      move: def.move || "none",
      amp: def.amp || 40,
      speed: def.speed || 1.2,
      phase: Math.random() * Math.PI * 2,
      alive: true,
      popT: 0,
    };
  }

  function clampAim() {
    aim.x = Math.max(AIM_PAD.left, Math.min(W - AIM_PAD.right, aim.x));
    aim.y = Math.max(AIM_PAD.top, Math.min(H - AIM_PAD.bottom, aim.y));
  }

  function loadStage() {
    const st = STAGES[stageIndex];
    ammo = st.ammo;
    ammoMax = st.ammo;
    targets = st.targets.map(makeTarget);
    aim = { x: W / 2, y: H * 0.42 };
    sway = { x: 0, y: 0, t: Math.random() * 10 };
    recoil = 0;
    flash = 0;
    muzzle = 0;
    tracer = null;
    particles = [];
    floats = [];
    fireLock = 0;
    updateHud();
  }

  function startRun(fromTitle) {
    if (fromTitle) {
      stageIndex = 0;
      score = 0;
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    state = "play";
    showOverlay(null);
    seedDecor();
    loadStage();
    last = performance.now();
  }

  function starCount() {
    if (ammo >= 2) return 3;
    if (ammo >= 1) return 2;
    return 1;
  }

  function stageClear() {
    const leftover = ammo;
    const bonus = leftover * 90 + 150;
    score += bonus;
    saveBest();
    updateHud();
    const stars = starCount();
    document.getElementById("clear-detail").textContent =
      `스테이지 ${stageIndex + 1} · 남은 탄 ${leftover} · +${bonus}`;
    document.getElementById("clear-stars").textContent =
      "★".repeat(stars) + "☆".repeat(3 - stars);
    if (stageIndex >= MAX_STAGE - 1) {
      state = "allclear";
      document.getElementById("all-detail").textContent =
        `${MAX_STAGE}스테이지 완료 · ${Math.floor(score).toLocaleString("ko-KR")}점`;
      showOverlay("allclear");
      if (window.TodayGameRank) {
        TodayGameRank.mount({
          gameId: GAME_ID,
          gameTitle: GAME_TITLE,
          formParent: document.getElementById("allclear"),
        });
        TodayGameRank.open(score);
      }
    } else {
      state = "clear";
      showOverlay("clear");
    }
  }

  function gameOver() {
    state = "over";
    saveBest();
    document.getElementById("over-detail").textContent =
      `스테이지 ${stageIndex + 1} · ${Math.floor(score).toLocaleString("ko-KR")}점`;
    showOverlay("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({
        gameId: GAME_ID,
        gameTitle: GAME_TITLE,
        formParent: document.getElementById("over"),
      });
      TodayGameRank.open(score);
    }
  }

  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 150;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        t: 0,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, t: 0, color });
  }

  function crosshairPos() {
    return {
      x: aim.x + sway.x + recoil * 0.15,
      y: aim.y + sway.y - recoil * 0.35,
    };
  }

  function fire() {
    if (state !== "play" || ammo <= 0 || fireLock > 0) return;
    ammo -= 1;
    fireLock = 0.22;
    recoil = 18;
    flash = 0.12;
    muzzle = 0.18;
    shake = 5;
    updateHud();

    const c = crosshairPos();
    const muzzleX = W * 0.72;
    const muzzleY = H - 95;
    tracer = { x0: muzzleX, y0: muzzleY, x1: c.x, y1: c.y, t: 0 };

    let hit = null;
    let bestD = Infinity;
    for (const t of targets) {
      if (!t.alive) continue;
      const dx = t.x - c.x;
      const dy = t.y - c.y;
      const d = Math.hypot(dx, dy);
      // precision: must be inside target radius (slight forgiveness 1.15x)
      if (d <= t.r * 1.12 && d < bestD) {
        bestD = d;
        hit = t;
      }
    }

    if (hit) {
      hit.alive = false;
      hit.popT = 0;
      const gain = hit.type === "can" ? 160 : 120;
      const perfect = bestD <= hit.r * 0.35;
      const add = perfect ? gain + 40 : gain;
      score += add;
      floatText(hit.x, hit.y - 18, perfect ? `PERFECT +${add}` : `+${add}`, perfect ? "#ffd76a" : "#ff6b9d");
      spawnBurst(hit.x, hit.y, hit.type === "can" ? "#c48a55" : "#ffb6d0", 20);
      updateHud();
    } else {
      floatText(c.x, c.y - 20, "MISS", "#8a9a88");
      spawnBurst(c.x, c.y, "#fff", 6);
    }

    const alive = targets.some((t) => t.alive);
    if (!alive) {
      setTimeout(() => {
        if (state === "play") stageClear();
      }, 280);
      return;
    }
    if (ammo <= 0) {
      setTimeout(() => {
        if (state === "play" && targets.some((t) => t.alive)) gameOver();
      }, 320);
    }
  }

  function update(dt) {
    clouds.forEach((c) => {
      c.x += c.v * dt;
      if (c.x > W + 70) c.x = -70;
    });
    if (shake > 0) shake = Math.max(0, shake - dt * 26);
    if (recoil > 0) recoil = Math.max(0, recoil - dt * 55);
    if (flash > 0) flash = Math.max(0, flash - dt);
    if (muzzle > 0) muzzle = Math.max(0, muzzle - dt);
    if (fireLock > 0) fireLock = Math.max(0, fireLock - dt);
    if (tracer) {
      tracer.t += dt;
      if (tracer.t > 0.12) tracer = null;
    }

    // breathing / micro sway — reduced while holding steady
    sway.t += dt;
    const amp = steady ? 1.6 : 5.8;
    const speed = steady ? 1.4 : 2.3;
    sway.x = Math.sin(sway.t * speed * 1.7) * amp + Math.sin(sway.t * 3.1) * amp * 0.35;
    sway.y = Math.cos(sway.t * speed * 1.3) * amp * 0.85 + Math.sin(sway.t * 2.4) * amp * 0.25;

    targets.forEach((t) => {
      if (!t.alive) {
        t.popT += dt;
        return;
      }
      t.phase += dt * t.speed;
      if (t.move === "sine") {
        t.x = t.baseX + Math.sin(t.phase) * t.amp;
        t.y = t.baseY + Math.cos(t.phase * 0.85) * (t.amp * 0.22);
      } else if (t.move === "patrol") {
        t.x = t.baseX + Math.sin(t.phase) * t.amp;
        t.y = t.baseY;
      } else {
        t.x = t.baseX;
        t.y = t.baseY + Math.sin(t.phase * 1.1) * 3;
      }
    });

    particles.forEach((p) => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 110 * dt;
    });
    particles = particles.filter((p) => p.t < p.life);
    floats.forEach((f) => {
      f.t += dt;
      f.y -= 34 * dt;
    });
    floats = floats.filter((f) => f.t < 0.9);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#9ec8ff");
    g.addColorStop(0.4, "#c5dff0");
    g.addColorStop(0.7, "#d8e8c8");
    g.addColorStop(1, "#cbb890");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      const s = 26 * c.s;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, s * 1.6, s * 0.68, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - s * 0.7, c.y + 3, s, s * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + s * 0.75, c.y + 2, s * 1.05, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // distant hills
    ctx.fillStyle = "#8fbf7a";
    ctx.beginPath();
    ctx.moveTo(0, H - 210);
    ctx.quadraticCurveTo(90, H - 260, 180, H - 220);
    ctx.quadraticCurveTo(280, H - 180, W, H - 230);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // range board
    ctx.fillStyle = "#d7b48a";
    ctx.fillRect(30, H - 250, W - 60, 14);
    ctx.fillStyle = "#c49a6c";
    ctx.fillRect(30, H - 250, W - 60, 4);
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = "rgba(90,70,40,0.18)";
      ctx.fillRect(48 + i * 64, H - 248, 2, 10);
    }

    // ground / sandbag
    ctx.fillStyle = "#b9a078";
    ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = "#a88b62";
    ctx.fillRect(0, H - 120, W, 8);
  }

  function drawSprite(img, x, y, size, rot) {
    if (!img) return false;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }

  function drawTarget(t) {
    if (!t.alive) {
      if (t.popT < 0.22) {
        ctx.globalAlpha = 1 - t.popT / 0.22;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * (1.2 + t.popT * 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }
    const size = t.type === "can" ? t.r * 3.4 : t.r * 3.6;
    if (t.type === "can") {
      if (!drawSprite(imgs.can, t.x, t.y, size, 0)) {
        ctx.fillStyle = "#7ddea0";
        ctx.fillRect(t.x - t.r, t.y - t.r * 1.3, t.r * 2, t.r * 2.6);
      }
    } else if (!drawSprite(imgs[t.color], t.x, t.y, size, Math.sin(t.phase) * 0.06)) {
      ctx.fillStyle = t.color === "blue" ? "#6bbcff" : t.color === "yellow" ? "#ffd76a" : "#ff7aa8";
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, t.r, t.r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCrosshair() {
    const c = crosshairPos();
    const ok = drawSprite(imgs.crosshair, c.x, c.y, steady ? 54 : 62, 0);
    if (!ok) {
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 16, 0, Math.PI * 2);
      ctx.moveTo(c.x - 24, c.y);
      ctx.lineTo(c.x - 8, c.y);
      ctx.moveTo(c.x + 8, c.y);
      ctx.lineTo(c.x + 24, c.y);
      ctx.moveTo(c.x, c.y - 24);
      ctx.lineTo(c.x, c.y - 8);
      ctx.moveTo(c.x, c.y + 8);
      ctx.lineTo(c.x, c.y + 24);
      ctx.stroke();
      ctx.fillStyle = "#ff6b9d";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawScopeVignette() {
    const strength = steady ? 0.55 : 0.28;
    const grd = ctx.createRadialGradient(W / 2, H * 0.4, 90, W / 2, H * 0.4, 280);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, `rgba(20,30,18,${strength})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  function drawShooter() {
    // rifle chick lower-right
    const ok = drawSprite(imgs.chick, W - 70, H - 78, 110, 0);
    if (!ok) {
      ctx.fillStyle = "#ffd84a";
      ctx.beginPath();
      ctx.ellipse(W - 70, H - 78, 28, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (muzzle > 0) {
      ctx.globalAlpha = muzzle / 0.18;
      ctx.fillStyle = "#ffe9a0";
      ctx.beginPath();
      ctx.ellipse(W - 118, H - 108, 18, 10, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawSky();
    targets.forEach(drawTarget);

    if (tracer) {
      const a = 1 - tracer.t / 0.12;
      ctx.strokeStyle = `rgba(255,230,150,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tracer.x0, tracer.y0);
      ctx.lineTo(tracer.x1, tracer.y1);
      ctx.stroke();
    }

    drawScopeVignette();
    drawShooter();
    drawCrosshair();

    particles.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    floats.forEach((f) => {
      ctx.globalAlpha = 1 - f.t / 0.9;
      ctx.font = "bold 16px Jua";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,220,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    // steady meter
    if (state === "play") {
      ctx.fillStyle = "rgba(255,248,242,0.75)";
      ctx.fillRect(14, H - 148, 110, 8);
      ctx.fillStyle = steady ? "#5ce1ff" : "#c5d2c0";
      ctx.fillRect(14, H - 148, 110 * (steady ? 1 : 0.35), 8);
    }

    ctx.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (state !== "play") {
      if (state === "title") {
        drawSky();
        drawShooter();
      }
      return;
    }
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    if (state === "play") draw();
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    // don't steal clicks meant for buttons
    canvas.setPointerCapture(e.pointerId);
    dragAim = true;
    lastPointer = canvasPos(e);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragAim || state !== "play") return;
    const p = canvasPos(e);
    if (!lastPointer) {
      lastPointer = p;
      return;
    }
    // precision: 1:1 drag, slightly slower when steady (scoped feel)
    const sens = steady ? 0.55 : 0.92;
    aim.x += (p.x - lastPointer.x) * sens;
    aim.y += (p.y - lastPointer.y) * sens;
    clampAim();
    lastPointer = p;
  });

  canvas.addEventListener("pointerup", () => {
    dragAim = false;
    lastPointer = null;
  });
  canvas.addEventListener("pointercancel", () => {
    dragAim = false;
    lastPointer = null;
  });

  function setSteady(on) {
    steady = on;
    steadyBtn.classList.toggle("held", on);
  }

  steadyBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setSteady(true);
  });
  steadyBtn.addEventListener("pointerup", () => setSteady(false));
  steadyBtn.addEventListener("pointerleave", () => setSteady(false));
  steadyBtn.addEventListener("pointercancel", () => setSteady(false));

  fireBtn.addEventListener("click", (e) => {
    e.preventDefault();
    fire();
  });

  window.addEventListener("keydown", (e) => {
    if (state !== "play") return;
    if (e.code === "Space") {
      e.preventDefault();
      fire();
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") setSteady(true);
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") setSteady(false);
  });

  document.getElementById("start-btn").addEventListener("click", () => startRun(true));
  document.getElementById("next-btn").addEventListener("click", () => {
    stageIndex += 1;
    startRun(false);
  });
  document.getElementById("retry-btn").addEventListener("click", () => startRun(true));
  document.getElementById("again-btn").addEventListener("click", () => startRun(true));

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: GAME_ID,
      gameTitle: GAME_TITLE,
      formParent: document.getElementById("allclear"),
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
        last = performance.now();
        return true;
      },
    });
  }

  // hub title update
  const hubTitle = document.querySelector("title");
  if (hubTitle) hubTitle.textContent = GAME_TITLE;

  seedDecor();
  updateHud();
  showOverlay("title");
  loadAssets().then(() => {
    raf = requestAnimationFrame(frame);
  });
})();
