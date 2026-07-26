(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GAME_ID = "one-shot";
  const GAME_TITLE = "딱 한 발";
  const BEST_KEY = "today-one-shot-best";
  const MAX_STAGE = 30;
  const GRAVITY = 980;
  const MAX_PULL = 118;
  const ORIGIN = { x: W / 2, y: H - 118 };

  /**
   * Draft stages: ammo + targets.
   * type: balloon | can
   * move: none | sine | patrol
   */
  const STAGES = [
    { ammo: 3, targets: [{ type: "balloon", color: "red", x: 195, y: 220 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 120, y: 200 }, { type: "balloon", color: "yellow", x: 270, y: 240 }] },
    { ammo: 3, targets: [{ type: "can", x: 195, y: 280 }, { type: "balloon", color: "red", x: 195, y: 160 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "yellow", x: 90, y: 180 }, { type: "balloon", color: "blue", x: 195, y: 220 }, { type: "balloon", color: "red", x: 300, y: 180 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "red", x: 195, y: 200, move: "sine", amp: 40, speed: 1.4 }] },
    { ammo: 4, targets: [{ type: "can", x: 120, y: 300 }, { type: "can", x: 270, y: 300 }, { type: "balloon", color: "blue", x: 195, y: 170 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "yellow", x: 100, y: 210, move: "patrol", amp: 55, speed: 1.1 }, { type: "balloon", color: "red", x: 290, y: 180 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "blue", x: 80, y: 160 }, { type: "balloon", color: "red", x: 195, y: 130 }, { type: "balloon", color: "yellow", x: 310, y: 160 }, { type: "can", x: 195, y: 290 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "red", x: 150, y: 190, move: "sine", amp: 50, speed: 1.6 }, { type: "balloon", color: "blue", x: 250, y: 230, move: "sine", amp: 35, speed: 1.2 }] },
    { ammo: 4, targets: [{ type: "can", x: 90, y: 310 }, { type: "can", x: 195, y: 310 }, { type: "can", x: 300, y: 310 }, { type: "balloon", color: "yellow", x: 195, y: 150, move: "patrol", amp: 70, speed: 1.3 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 195, y: 140, move: "sine", amp: 70, speed: 1.8 }, { type: "can", x: 195, y: 300 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "red", x: 70, y: 170 }, { type: "balloon", color: "yellow", x: 150, y: 210, move: "sine", amp: 30, speed: 1.5 }, { type: "balloon", color: "blue", x: 240, y: 170 }, { type: "balloon", color: "red", x: 320, y: 210, move: "sine", amp: 28, speed: 1.3 }] },
    { ammo: 3, targets: [{ type: "can", x: 120, y: 260, move: "patrol", amp: 40, speed: 0.9 }, { type: "balloon", color: "yellow", x: 280, y: 160, move: "sine", amp: 45, speed: 1.7 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "blue", x: 100, y: 140, move: "patrol", amp: 40, speed: 1.2 }, { type: "balloon", color: "red", x: 195, y: 180, move: "sine", amp: 55, speed: 1.5 }, { type: "balloon", color: "yellow", x: 290, y: 140, move: "patrol", amp: 40, speed: 1.2 }] },
    { ammo: 4, targets: [{ type: "can", x: 80, y: 300 }, { type: "can", x: 310, y: 300 }, { type: "balloon", color: "red", x: 140, y: 170, move: "sine", amp: 40, speed: 1.8 }, { type: "balloon", color: "blue", x: 250, y: 170, move: "sine", amp: 40, speed: 1.8 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "yellow", x: 195, y: 120, move: "patrol", amp: 110, speed: 1.6 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "red", x: 90, y: 150, move: "sine", amp: 35, speed: 2 }, { type: "balloon", color: "blue", x: 195, y: 200, move: "sine", amp: 50, speed: 1.4 }, { type: "balloon", color: "yellow", x: 300, y: 150, move: "sine", amp: 35, speed: 2 }, { type: "can", x: 195, y: 310 }] },
    { ammo: 4, targets: [{ type: "can", x: 110, y: 280, move: "patrol", amp: 50, speed: 1.1 }, { type: "can", x: 280, y: 280, move: "patrol", amp: 50, speed: 1.1 }, { type: "balloon", color: "red", x: 195, y: 140, move: "sine", amp: 60, speed: 1.7 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 120, y: 160, move: "patrol", amp: 60, speed: 1.5 }, { type: "balloon", color: "yellow", x: 270, y: 200, move: "patrol", amp: 60, speed: 1.5 }] },
    { ammo: 5, targets: [{ type: "balloon", color: "red", x: 70, y: 180 }, { type: "balloon", color: "blue", x: 140, y: 140 }, { type: "balloon", color: "yellow", x: 210, y: 180 }, { type: "balloon", color: "red", x: 280, y: 140 }, { type: "balloon", color: "blue", x: 340, y: 180 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "yellow", x: 100, y: 150, move: "sine", amp: 55, speed: 1.9 }, { type: "balloon", color: "red", x: 195, y: 120, move: "patrol", amp: 90, speed: 1.4 }, { type: "balloon", color: "blue", x: 290, y: 150, move: "sine", amp: 55, speed: 1.9 }] },
    { ammo: 4, targets: [{ type: "can", x: 90, y: 300 }, { type: "can", x: 195, y: 270, move: "patrol", amp: 35, speed: 1.2 }, { type: "can", x: 300, y: 300 }, { type: "balloon", color: "red", x: 195, y: 130, move: "sine", amp: 70, speed: 2 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 195, y: 110, move: "patrol", amp: 120, speed: 1.8 }, { type: "can", x: 195, y: 290 }] },
    { ammo: 5, targets: [{ type: "balloon", color: "red", x: 80, y: 160, move: "sine", amp: 30, speed: 2.1 }, { type: "balloon", color: "yellow", x: 160, y: 200, move: "sine", amp: 40, speed: 1.6 }, { type: "balloon", color: "blue", x: 240, y: 160, move: "sine", amp: 30, speed: 2.1 }, { type: "balloon", color: "red", x: 320, y: 200, move: "sine", amp: 40, speed: 1.6 }, { type: "can", x: 195, y: 320 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "yellow", x: 110, y: 140, move: "patrol", amp: 45, speed: 1.7 }, { type: "balloon", color: "blue", x: 280, y: 140, move: "patrol", amp: 45, speed: 1.7 }, { type: "balloon", color: "red", x: 195, y: 200, move: "sine", amp: 65, speed: 2 }] },
    { ammo: 4, targets: [{ type: "can", x: 100, y: 300, move: "patrol", amp: 55, speed: 1.3 }, { type: "can", x: 290, y: 300, move: "patrol", amp: 55, speed: 1.3 }, { type: "balloon", color: "yellow", x: 150, y: 150, move: "sine", amp: 45, speed: 2.2 }, { type: "balloon", color: "red", x: 250, y: 150, move: "sine", amp: 45, speed: 2.2 }] },
    { ammo: 3, targets: [{ type: "balloon", color: "blue", x: 70, y: 170, move: "sine", amp: 40, speed: 2.3 }, { type: "balloon", color: "red", x: 195, y: 120, move: "patrol", amp: 100, speed: 1.9 }, { type: "balloon", color: "yellow", x: 320, y: 170, move: "sine", amp: 40, speed: 2.3 }] },
    { ammo: 5, targets: [{ type: "can", x: 70, y: 310 }, { type: "can", x: 150, y: 290 }, { type: "can", x: 240, y: 290 }, { type: "can", x: 320, y: 310 }, { type: "balloon", color: "red", x: 195, y: 130, move: "sine", amp: 80, speed: 2.1 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "yellow", x: 100, y: 130, move: "patrol", amp: 50, speed: 2 }, { type: "balloon", color: "blue", x: 195, y: 180, move: "sine", amp: 70, speed: 2.2 }, { type: "balloon", color: "red", x: 290, y: 130, move: "patrol", amp: 50, speed: 2 }, { type: "can", x: 195, y: 310, move: "patrol", amp: 40, speed: 1.2 }] },
    { ammo: 4, targets: [{ type: "balloon", color: "red", x: 90, y: 150, move: "sine", amp: 50, speed: 2.4 }, { type: "balloon", color: "blue", x: 195, y: 110, move: "patrol", amp: 115, speed: 2 }, { type: "balloon", color: "yellow", x: 300, y: 150, move: "sine", amp: 50, speed: 2.4 }, { type: "can", x: 150, y: 300 }, { type: "can", x: 250, y: 300 }] },
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

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    allclear: document.getElementById("allclear"),
  };
  const hintEl = document.getElementById("hint");

  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
  document.getElementById("hud-best").textContent = String(best);

  const imgs = {};
  let assetsReady = false;

  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let ammo = 0;
  let ammoMax = 0;
  let targets = [];
  let shot = null;
  let aiming = false;
  let pull = { x: 0, y: 0 };
  let particles = [];
  let floats = [];
  let clouds = [];
  let sparkles = [];
  let last = 0;
  let raf = 0;
  let shake = 0;
  let stageShotsUsed = 0;

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
      pebble: "assets/pebble.png",
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
    assetsReady = Object.values(imgs).some(Boolean);
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (name && overlays[name]) overlays[name].classList.remove("hidden");
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
    sparkles = [];
    for (let i = 0; i < 5; i += 1) {
      clouds.push({
        x: Math.random() * W,
        y: 40 + Math.random() * 180,
        s: 0.55 + Math.random() * 0.85,
        v: 6 + Math.random() * 14,
      });
    }
    for (let i = 0; i < 16; i += 1) {
      sparkles.push({
        x: Math.random() * W,
        y: 30 + Math.random() * 320,
        r: 1 + Math.random() * 2,
        a: Math.random(),
        v: 0.35 + Math.random() * 0.7,
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
      r: def.type === "can" ? 22 : 26,
      move: def.move || "none",
      amp: def.amp || 40,
      speed: def.speed || 1.2,
      phase: Math.random() * Math.PI * 2,
      alive: true,
      popT: 0,
    };
  }

  function loadStage() {
    const st = STAGES[stageIndex];
    ammo = st.ammo;
    ammoMax = st.ammo;
    stageShotsUsed = 0;
    targets = st.targets.map(makeTarget);
    shot = null;
    aiming = false;
    pull = { x: 0, y: 0 };
    particles = [];
    floats = [];
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
    hintEl.classList.remove("dim");
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
    const bonus = leftover * 80 + 120;
    score += bonus;
    saveBest();
    updateHud();
    const stars = starCount();
    document.getElementById("clear-detail").textContent =
      `스테이지 ${stageIndex + 1} · 남은 탄 ${leftover} · +${bonus}`;
    const starsEl = document.getElementById("clear-stars");
    starsEl.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
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
      const sp = 60 + Math.random() * 160;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.35,
        t: 0,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, t: 0, color });
  }

  function launch() {
    const len = Math.hypot(pull.x, pull.y);
    if (len < 14 || ammo <= 0 || shot) return;
    const power = Math.min(1, len / MAX_PULL);
    const ang = Math.atan2(-pull.y, -pull.x);
    const speed = 420 + power * 520;
    ammo -= 1;
    stageShotsUsed += 1;
    updateHud();
    shot = {
      x: ORIGIN.x,
      y: ORIGIN.y - 10,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: 9,
      trail: [],
    };
    aiming = false;
    pull = { x: 0, y: 0 };
    hintEl.classList.add("dim");
  }

  function previewPoints() {
    const len = Math.hypot(pull.x, pull.y);
    if (len < 10) return [];
    const power = Math.min(1, len / MAX_PULL);
    const ang = Math.atan2(-pull.y, -pull.x);
    const speed = 420 + power * 520;
    let x = ORIGIN.x;
    let y = ORIGIN.y - 10;
    let vx = Math.cos(ang) * speed;
    let vy = Math.sin(ang) * speed;
    const pts = [];
    const dt = 1 / 45;
    for (let i = 0; i < 28; i += 1) {
      vy += GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      if (i % 2 === 0) pts.push({ x, y });
      if (y > H - 60 || x < -20 || x > W + 20) break;
    }
    return pts;
  }

  function update(dt) {
    clouds.forEach((c) => {
      c.x += c.v * dt;
      if (c.x > W + 70) c.x = -70;
    });
    sparkles.forEach((s) => {
      s.a += s.v * dt;
      if (s.a > 1) s.a -= 1;
    });
    if (shake > 0) shake = Math.max(0, shake - dt * 28);

    targets.forEach((t) => {
      if (!t.alive) {
        t.popT += dt;
        return;
      }
      t.phase += dt * t.speed;
      if (t.move === "sine") {
        t.x = t.baseX + Math.sin(t.phase) * t.amp;
        t.y = t.baseY + Math.cos(t.phase * 0.85) * (t.amp * 0.25);
      } else if (t.move === "patrol") {
        t.x = t.baseX + Math.sin(t.phase) * t.amp;
        t.y = t.baseY;
      } else {
        t.x = t.baseX;
        t.y = t.baseY + Math.sin(t.phase * 1.2) * 4;
      }
    });

    if (shot) {
      shot.vy += GRAVITY * dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.trail.push({ x: shot.x, y: shot.y, a: 1 });
      if (shot.trail.length > 10) shot.trail.shift();
      shot.trail.forEach((p) => {
        p.a *= 0.88;
      });

      for (const t of targets) {
        if (!t.alive) continue;
        const dx = t.x - shot.x;
        const dy = t.y - shot.y;
        const hitR = t.r + shot.r;
        if (dx * dx + dy * dy < hitR * hitR) {
          t.alive = false;
          t.popT = 0;
          const gain = t.type === "can" ? 140 : 100;
          score += gain;
          floatText(t.x, t.y - 20, `+${gain}`, "#ff6b9d");
          spawnBurst(t.x, t.y, t.type === "can" ? "#c48a55" : "#ffb6d0", 18);
          shake = 7;
          shot = null;
          updateHud();
          break;
        }
      }

      if (shot && (shot.y > H - 55 || shot.x < -40 || shot.x > W + 40 || shot.y < -60)) {
        spawnBurst(shot.x, Math.min(shot.y, H - 70), "#c48a55", 8);
        shot = null;
      }
    }

    particles.forEach((p) => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
    });
    particles = particles.filter((p) => p.t < p.life);
    floats.forEach((f) => {
      f.t += dt;
      f.y -= 36 * dt;
    });
    floats = floats.filter((f) => f.t < 0.85);

    const alive = targets.some((t) => t.alive);
    if (!alive && !shot) {
      stageClear();
      return;
    }
    if (!alive) return;
    if (!shot && !aiming && ammo <= 0) gameOver();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#8fd0ff");
    g.addColorStop(0.42, "#c8e9ff");
    g.addColorStop(0.72, "#ffe4f2");
    g.addColorStop(1, "#ffd0e6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    sparkles.forEach((s) => {
      const a = 0.12 + Math.abs(Math.sin(s.a * Math.PI * 2)) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      const s = 28 * c.s;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, s * 1.65, s * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - s * 0.7, c.y + 4, s, s * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + s * 0.8, c.y + 2, s * 1.1, s * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // carnival shelf / ground
    ctx.fillStyle = "#8fd67f";
    ctx.fillRect(0, H - 70, W, 70);
    ctx.fillStyle = "#7bc86e";
    ctx.fillRect(0, H - 70, W, 10);
    ctx.fillStyle = "#d7a074";
    ctx.fillRect(24, H - 92, W - 48, 18);
    ctx.fillStyle = "#c48a55";
    ctx.fillRect(24, H - 92, W - 48, 4);
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(28 + i * 48, H - 88, 44, 10);
    }
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

  function drawSling() {
    const ox = ORIGIN.x;
    const oy = ORIGIN.y - 8;
    const px = ox + pull.x;
    const py = oy + pull.y;
    ctx.strokeStyle = "#6b4a32";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ox - 18, oy - 18);
    ctx.lineTo(px, py);
    ctx.lineTo(ox + 18, oy - 18);
    ctx.stroke();
    if (aiming && Math.hypot(pull.x, pull.y) > 8) {
      previewPoints().forEach((p, i) => {
        ctx.globalAlpha = 0.55 - i * 0.015;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
  }

  function drawChick() {
    const ok = drawSprite(imgs.chick, ORIGIN.x, ORIGIN.y + 8, 78, 0);
    if (!ok) {
      ctx.fillStyle = "#ffd84a";
      ctx.beginPath();
      ctx.ellipse(ORIGIN.x, ORIGIN.y + 8, 26, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTarget(t) {
    if (!t.alive) {
      if (t.popT < 0.25) {
        ctx.globalAlpha = 1 - t.popT / 0.25;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * (1 + t.popT * 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }
    if (t.type === "can") {
      if (!drawSprite(imgs.can, t.x, t.y, 52, 0)) {
        ctx.fillStyle = "#7ddea0";
        ctx.fillRect(t.x - 14, t.y - 20, 28, 40);
      }
    } else {
      const key = t.color;
      if (!drawSprite(imgs[key], t.x, t.y, 56, Math.sin(t.phase) * 0.08)) {
        ctx.fillStyle = t.color === "blue" ? "#6bbcff" : t.color === "yellow" ? "#ffd76a" : "#ff7aa8";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y, 18, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawSky();
    targets.forEach(drawTarget);

    if (shot) {
      shot.trail.forEach((p) => {
        ctx.globalAlpha = p.a * 0.4;
        ctx.fillStyle = "#c48a55";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (!drawSprite(imgs.pebble, shot.x, shot.y, 22, 0)) {
        ctx.fillStyle = "#c48a55";
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawSling();
    drawChick();

    particles.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    floats.forEach((f) => {
      ctx.globalAlpha = 1 - f.t / 0.85;
      ctx.font = "bold 17px Jua";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (state !== "play") {
      if (state === "title") {
        drawSky();
        drawChick();
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
    if (state !== "play" || shot || ammo <= 0) return;
    const p = canvasPos(e);
    if (Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y) > 90) return;
    canvas.setPointerCapture(e.pointerId);
    aiming = true;
    pull = {
      x: Math.max(-MAX_PULL, Math.min(MAX_PULL, p.x - ORIGIN.x)),
      y: Math.max(-20, Math.min(MAX_PULL, p.y - ORIGIN.y)),
    };
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!aiming || state !== "play") return;
    const p = canvasPos(e);
    let dx = p.x - ORIGIN.x;
    let dy = p.y - ORIGIN.y;
    // prefer pulling downward/back
    if (dy < -10) dy = -10;
    const len = Math.hypot(dx, dy);
    if (len > MAX_PULL) {
      dx = (dx / len) * MAX_PULL;
      dy = (dy / len) * MAX_PULL;
    }
    pull = { x: dx, y: dy };
  });

  canvas.addEventListener("pointerup", () => {
    if (!aiming) return;
    launch();
  });
  canvas.addEventListener("pointercancel", () => {
    aiming = false;
    pull = { x: 0, y: 0 };
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

  seedDecor();
  updateHud();
  showOverlay("title");
  loadAssets().then(() => {
    raf = requestAnimationFrame(frame);
  });
})();
