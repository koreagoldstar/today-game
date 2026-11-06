(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BEST_KEY = "today-doodle-best";
  const NAME_KEY = "today-doodle-name";
  const GRAVITY = 2100;
  const JUMP = -720;
  const SPRING_JUMP = -1080;
  const MOVE_ACC = 3200;
  const MOVE_MAX = 340;
  const FRICTION = 0.86;

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
    over: document.getElementById("over"),
  };

  const sprites = { hero: null, pad: {} };
  // 원본 그림(hero 1024², pads 1536x1024) 안에서 실제로 그려진 영역
  const HERO_BOX = [115, 211, 791, 557];
  const HERO_FACE = [0.67, 0.284, 0.168]; // 잘라 낸 개구리 기준 얼굴 위치 · 반지름
  const PAD_BOX = { move: [51, 515, 445, 200], solid: [546, 514, 445, 201], spring: [1037, 463, 439, 343] };
  const PAD_H = 24; // 발판 두께 (화면 단위)

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /** 큰 원본을 한 번만 필요한 크기로 줄여 둔다 (매 프레임 큰 그림을 줄이면 휴대폰이 느려짐) */
  function cut(img, box, h) {
    const k = (h * dpr) / box[3];
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(box[2] * k));
    c.height = Math.max(1, Math.round(box[3] * k));
    const x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(img, box[0], box[1], box[2], box[3], 0, 0, c.width, c.height);
    return c;
  }

  /** 초록 발판을 과자색으로: 부서지는 발판 */
  function biscuit(src) {
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const x = c.getContext("2d");
    x.drawImage(src, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      d[i] = Math.min(255, g * 1.02 + 6);
      d[i + 1] = Math.min(255, g * 0.66 + b * 0.08);
      d[i + 2] = Math.min(255, r * 0.3 + b * 0.12);
    }
    x.putImageData(data, 0, 0);
    // 금 간 자국
    x.strokeStyle = "rgba(110,50,10,.75)";
    x.lineWidth = Math.max(1.5, c.height * 0.05);
    x.lineJoin = "round";
    x.beginPath();
    const w = c.width;
    const h = c.height;
    x.moveTo(w * 0.42, h * 0.12);
    x.lineTo(w * 0.5, h * 0.4);
    x.lineTo(w * 0.44, h * 0.62);
    x.lineTo(w * 0.53, h * 0.88);
    x.moveTo(w * 0.5, h * 0.4);
    x.lineTo(w * 0.62, h * 0.48);
    x.stroke();
    return c;
  }

  async function loadAssets() {
    const [hero, pads] = await Promise.all([
      loadImg("assets/hero.png"),
      loadImg("assets/pads.png"),
    ]);
    if (hero) sprites.hero = cut(hero, HERO_BOX, 64);
    if (pads) {
      sprites.pad.solid = cut(pads, PAD_BOX.solid, PAD_H);
      sprites.pad.move = cut(pads, PAD_BOX.move, PAD_H);
      sprites.pad.spring = cut(pads, PAD_BOX.spring, PAD_H * (343 / 200));
      sprites.pad.break = biscuit(sprites.pad.solid);
    }
  }

  let state = "title";
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0");
  let player = null;
  let platforms = [];
  let cameraY = 0;
  let maxHeight = 0;
  let clouds = [];
  let particles = [];
  let keys = { left: false, right: false };
  let touchX = null;
  let last = 0;
  let raf = 0;
  let flash = 0;
  let submitted = false;
  let facing = 1;
  let debris = [];
  let squash = 0; // 착지할 때 납작해졌다 펴진다
  let tNow = 0;

  document.getElementById("hud-best").textContent = String(best);
  const nameInput = document.getElementById("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";

  function showOverlay(key) {
    Object.entries(overlays).forEach(([k, el]) => el.classList.toggle("hidden", k !== key));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeClouds() {
    clouds = Array.from({ length: 10 }, (_, i) => ({
      x: rand(0, W),
      y: i * 90 + rand(-20, 20),
      s: rand(0.6, 1.3),
      v: rand(8, 22),
    }));
  }

  function platformGap() {
    const t = Math.min(1, maxHeight / 8000);
    return rand(52, 78) + t * 38;
  }

  function pickType() {
    const t = Math.min(1, maxHeight / 6000);
    const r = Math.random();
    if (r < 0.08 + t * 0.06) return "spring";
    if (r < 0.2 + t * 0.1) return "move";
    if (r < 0.32 + t * 0.12) return "break";
    return "solid";
  }

  function makePlatform(y) {
    const type = pickType();
    const w = type === "spring" ? 62 : rand(58, 92);
    return {
      x: rand(16, W - w - 16),
      y,
      w,
      h: 16,
      type,
      vx: type === "move" ? (Math.random() < 0.5 ? -1 : 1) * rand(55, 110) : 0,
      alive: true,
      breaking: 0,
      boing: 0,
    };
  }

  function seedPlatforms() {
    platforms = [];
    // 시작 발판
    platforms.push({
      x: W / 2 - 50,
      y: H - 80,
      w: 100,
      h: 16,
      type: "solid",
      vx: 0,
      alive: true,
      breaking: 0,
      boing: 0,
    });
    let y = H - 80;
    while (y > -H * 2) {
      y -= platformGap();
      platforms.push(makePlatform(y));
    }
  }

  function resetRun() {
    cameraY = 0;
    maxHeight = 0;
    score = 0;
    flash = 0;
    submitted = false;
    facing = 1;
    particles = [];
    debris = [];
    squash = 0;
    player = {
      x: W / 2,
      y: H - 140,
      w: 42,
      h: 46,
      vx: 0,
      vy: 0,
    };
    seedPlatforms();
    document.getElementById("hud-score").textContent = "0";
    document.getElementById("rank-msg").textContent = "";
    document.getElementById("submit-btn").disabled = false;
    const shareEl = document.getElementById("share-rank-btn");
    if (shareEl) shareEl.hidden = true;
  }

  function worldToScreen(y) {
    return y - cameraY;
  }

  function updateScore() {
    const climbed = Math.max(0, Math.floor(Math.max(0, -cameraY) / 10));
    if (climbed !== score) {
      score = climbed;
      document.getElementById("hud-score").textContent = String(score);
    }
  }

  function bounce(mult = 1) {
    player.vy = JUMP * mult;
    squash = 1;
    const big = mult > 1.1;
    for (let i = 0; i < (big ? 14 : 7); i += 1) {
      const a = big ? (i / 14) * Math.PI * 2 : Math.PI + (i / 6) * Math.PI;
      const sp = big ? rand(160, 260) : rand(60, 130);
      particles.push({
        x: player.x,
        y: player.y + player.h / 2,
        vx: Math.cos(a) * sp,
        vy: big ? Math.sin(a) * sp : rand(10, 60),
        life: 0.35 + Math.random() * 0.25,
        size: big ? rand(4, 7) : rand(4, 8),
        star: big,
        color: big ? ["#fff", "#ffe27a", "#ff9ec4", "#8ff0c8"][i % 4] : "rgba(255,255,255,.9)",
      });
    }
  }

  function endRun() {
    state = "over";
    flash = 0.3;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      document.getElementById("hud-best").textContent = String(best);
    }
    document.getElementById("over-detail").textContent = `높이 ${score} · 최고 ${best}`;
    showOverlay("over");
    if (window.TodayVisit) {
      TodayVisit.compareAndShow("doodle", score, true, document.getElementById("over"));
    }
  }

  function startGame() {
    resetRun();
    state = "play";
    showOverlay(null);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function ensurePlatforms() {
    const topNeeded = cameraY - 40;
    let highest = Infinity;
    platforms.forEach((p) => {
      if (p.alive) highest = Math.min(highest, p.y);
    });
    if (highest === Infinity) highest = cameraY + H; // 남은 발판이 없으면 화면 아래부터 (무한 반복 방지)
    while (highest > topNeeded) {
      highest -= platformGap();
      platforms.push(makePlatform(highest));
    }
    platforms = platforms.filter((p) => p.y < cameraY + H + 80);
  }

  function update(dt) {
    tNow += dt;
    if (flash > 0) flash -= dt;
    squash = Math.max(0, squash - dt * 6);
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
    });
    particles = particles.filter((p) => p.life > 0);
    debris.forEach((d) => {
      d.life -= dt;
      d.vy += GRAVITY * 0.6 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
    });
    debris = debris.filter((d) => d.life > 0);

    clouds.forEach((c) => {
      c.x += c.v * dt * 0.15;
      if (c.x > W + 60) c.x = -60;
    });

    if (state !== "play" || !player) return;

    let ax = 0;
    if (keys.left) ax -= 1;
    if (keys.right) ax += 1;
    if (touchX != null) {
      const nx = touchX / W;
      ax = Math.max(-1, Math.min(1, (nx - 0.5) * 2.4));
    }

    if (ax !== 0) {
      player.vx += ax * MOVE_ACC * dt;
      facing = ax > 0 ? 1 : -1;
    } else {
      player.vx *= FRICTION;
    }
    player.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, player.vx));

    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // wrap horizontal
    if (player.x < -20) player.x = W + 20;
    if (player.x > W + 20) player.x = -20;

    platforms.forEach((p) => {
      if (!p.alive) return;
      if (p.type === "move") {
        p.x += p.vx * dt;
        if (p.x < 8 || p.x + p.w > W - 8) p.vx *= -1;
      }
      if (p.breaking > 0) {
        p.breaking -= dt;
        if (p.breaking <= 0) {
          p.alive = false;
          // 반으로 쪼개져 떨어진다
          for (const side of [0, 1]) debris.push({ x: p.x + (side ? p.w * 0.75 : p.w * 0.25), y: p.y + PAD_H * 0.5, w: p.w / 2, side, vx: side ? 70 : -70, vy: -60, rot: 0, vr: side ? 4 : -4, life: 1 });
        }
      }
      if (p.boing > 0) p.boing -= dt;
    });

    // land on platforms only when falling
    if (player.vy > 0) {
      const feet = player.y + player.h / 2;
      const prevFeet = feet - player.vy * dt;
      for (const p of platforms) {
        if (!p.alive) continue;
        const top = p.y;
        if (prevFeet <= top && feet >= top) {
          const left = player.x - player.w * 0.28;
          const right = player.x + player.w * 0.28;
          if (right > p.x && left < p.x + p.w) {
            player.y = top - player.h / 2;
            player.vy = 0;
            if (p.type === "spring") {
              bounce(SPRING_JUMP / JUMP);
              p.boing = 0.3;
            } else if (p.type === "break") {
              bounce(1);
              p.breaking = 0.12;
            } else {
              bounce(1);
            }
            break;
          }
        }
      }
    }

    // camera follow
    const screenY = worldToScreen(player.y);
    if (screenY < H * 0.38) {
      const dy = H * 0.38 - screenY;
      cameraY -= dy;
      maxHeight = Math.max(maxHeight, -cameraY);
    }

    ensurePlatforms();
    updateScore();

    if (worldToScreen(player.y) > H + 40) {
      endRun();
    }
  }

  // 높이(점수)에 따라 아침 → 노을 → 저녁 → 별 하늘
  const SKY = [
    [0, [58, 168, 255], [128, 210, 255], [214, 246, 255]],
    [450, [72, 140, 255], [255, 166, 120], [255, 222, 150]],
    [1000, [54, 52, 160], [150, 88, 210], [255, 150, 190]],
    [1700, [12, 16, 60], [36, 28, 104], [84, 52, 150]],
  ];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function skyAt(h) {
    let i = 0;
    while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i += 1;
    const A = SKY[i];
    const B = SKY[i + 1];
    const t = Math.max(0, Math.min(1, (h - A[0]) / (B[0] - A[0])));
    return [1, 2, 3].map((k) => mix(A[k], B[k], t));
  }
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const STARS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97.3) % W, y: (i * 151.7) % H, s: 0.8 + ((i * 37) % 10) / 6, p: i }));

  function cloud(x, y, k, fill, edge) {
    const parts = [[0, 0, 30], [-30, 8, 21], [30, 7, 23], [-12, -14, 22], [14, -12, 20], [-48, 14, 13], [50, 14, 14]];
    ctx.beginPath();
    for (const [dx, dy, r] of parts) {
      ctx.moveTo(x + dx * k + r * k, y + dy * k);
      ctx.arc(x + dx * k, y + dy * k, r * k, 0, Math.PI * 2);
    }
    ctx.lineWidth = 4 * k;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
    // 아래 그늘
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(120,150,220,.18)";
    ctx.fillRect(x - 70 * k, y + 8 * k, 140 * k, 30 * k);
    ctx.restore();
  }

  function drawSky() {
    const h = Math.max(0, -cameraY) / 10;
    const [top, mid, bot] = skyAt(h);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(top));
    g.addColorStop(0.55, rgb(mid));
    g.addColorStop(1, rgb(bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const night = Math.max(0, Math.min(1, (h - 800) / 700));
    if (night > 0) {
      for (const st of STARS) {
        const sy = (((st.y - cameraY * 0.05) % H) + H) % H;
        ctx.fillStyle = `rgba(255,255,255,${night * (0.45 + Math.sin(tNow * 2 + st.p) * 0.35)})`;
        ctx.fillRect(st.x, sy, st.s * 1.6, st.s * 1.6);
      }
      // 큰 행성 하나
      if (night > 0.6) {
        const py = 150 + (((-cameraY * 0.03) % 900) + 900) % 900 - 300;
        ctx.globalAlpha = (night - 0.6) * 2.5;
        const pg = ctx.createRadialGradient(300, py - 12, 4, 310, py, 40);
        pg.addColorStop(0, "#ffe2b0");
        pg.addColorStop(1, "#e2708f");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(310, py, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,230,190,.8)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(310, py, 56, 13, -0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // 처음 땅: 사탕 언덕 (올라가면 아래로 사라진다)
    const groundY = H - 26 + Math.max(0, -cameraY) * 0.35;
    if (groundY < H + 140) {
      ctx.fillStyle = "#ffb3d1";
      ctx.strokeStyle = "#e0709c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, H + 200);
      ctx.lineTo(0, groundY - 30);
      ctx.quadraticCurveTo(70, groundY - 90, 150, groundY - 40);
      ctx.quadraticCurveTo(250, groundY - 110, W, groundY - 50);
      ctx.lineTo(W, H + 200);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#7fe0a8";
      ctx.strokeStyle = "#2fa86c";
      ctx.beginPath();
      ctx.moveTo(0, H + 200);
      ctx.lineTo(0, groundY);
      ctx.quadraticCurveTo(120, groundY - 50, 220, groundY - 8);
      ctx.quadraticCurveTo(320, groundY - 44, W, groundY - 10);
      ctx.lineTo(W, H + 200);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 막대사탕 나무
      for (const [x, k, c] of [[46, 1, "#ff6fa5"], [338, 0.8, "#ffb43a"], [262, 0.65, "#8a7bff"]]) {
        const by = groundY - 18 * k;
        ctx.fillStyle = "#fff";
        ctx.fillRect(x - 2.5 * k, by - 60 * k, 5 * k, 60 * k);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, by - 72 * k, 18 * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.lineWidth = 4 * k;
        ctx.beginPath();
        ctx.arc(x, by - 72 * k, 9 * k, 0.4, Math.PI * 1.7);
        ctx.stroke();
      }
    }
    // 구름: 멀리 · 가까이 두 겹
    const cf = rgb(mix([255, 255, 255], [150, 140, 210], night));
    const ce = rgb(mix([150, 195, 240], [90, 80, 160], night), 0.9);
    clouds.forEach((c, i) => {
      const far = i % 2 === 0;
      const sp = far ? 0.12 : 0.32;
      const sy = ((c.y - cameraY * sp) % (H + 140) + H + 140) % (H + 140) - 70;
      ctx.globalAlpha = far ? 0.55 : 0.95;
      cloud(c.x, sy, c.s * (far ? 0.55 : 0.85), cf, ce);
    });
    ctx.globalAlpha = 1;
  }

  function drawPlatform(p) {
    if (!p.alive) return;
    const sy = worldToScreen(p.y);
    if (sy < -60 || sy > H + 60) return;
    const shake = p.breaking > 0 ? (Math.random() - 0.5) * 5 : 0;
    const x = p.x + shake;
    const img = sprites.pad[p.type] || sprites.pad.solid;
    if (!img) {
      const colors = { solid: "#2fbf8a", move: "#e04f84", break: "#e07840", spring: "#e0a83a" };
      ctx.fillStyle = colors[p.type] || colors.solid;
      roundRect(x, sy, p.w, 16, 8);
      ctx.fill();
      return;
    }
    // 그림자
    ctx.fillStyle = "rgba(30,40,90,.18)";
    ctx.beginPath();
    ctx.ellipse(x + p.w / 2, sy + PAD_H + 6, p.w * 0.42, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.type === "spring") {
      const k = p.boing > 0 ? 1 - Math.sin((p.boing / 0.3) * Math.PI) * 0.28 : 1;
      const h = PAD_H * (343 / 200);
      const top = sy + h * (1 - k) * 0.6;
      ctx.drawImage(img, x, top, p.w, h * k + h * (1 - k) * 0.4);
      return;
    }
    // 세 조각으로: 둥근 끝은 그대로, 가운데만 늘린다
    const iw = img.width;
    const ih = img.height;
    const cap = iw * 0.3;
    const capW = PAD_H * (cap / ih);
    const mid = Math.max(0, p.w - capW * 2);
    ctx.drawImage(img, 0, 0, cap, ih, x, sy, capW, PAD_H);
    ctx.drawImage(img, cap, 0, iw - cap * 2, ih, x + capW, sy, mid, PAD_H);
    ctx.drawImage(img, iw - cap, 0, cap, ih, x + capW + mid, sy, capW, PAD_H);
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

  function drawPlayer() {
    const sx = player.x;
    const sy = worldToScreen(player.y);
    const feet = sy + player.h / 2;
    // 납작해졌다 펴지고, 빠르게 오를 때는 길쭉하게
    const rise = Math.max(0, Math.min(1, -player.vy / 900));
    const kx = 1 + squash * 0.22 - rise * 0.08;
    const ky = 1 - squash * 0.2 + rise * 0.1;
    ctx.save();
    ctx.translate(sx, feet);
    ctx.rotate(Math.max(-0.25, Math.min(0.25, player.vx / 1400)));
    ctx.scale(facing * kx, ky);
    if (sprites.hero) {
      const pw = 72;
      const ph = pw * (HERO_BOX[3] / HERO_BOX[2]);
      ctx.drawImage(sprites.hero, -pw / 2, -ph, pw, ph);
      if (window.TodayFace) TodayFace.drawOnSprite(ctx, -pw / 2, -ph, pw, ph, HERO_FACE);
    } else {
      ctx.fillStyle = "#6fd6b0";
      ctx.beginPath();
      ctx.ellipse(0, -player.h / 2, player.w * 0.42, player.h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    drawSky();
    platforms.forEach(drawPlatform);

    debris.forEach((d) => {
      const img = sprites.pad.break;
      if (!img) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life);
      ctx.translate(d.x, worldToScreen(d.y));
      ctx.rotate(d.rot);
      const half = img.width / 2;
      ctx.drawImage(img, d.side ? half : 0, 0, half, img.height, -d.w / 2, -PAD_H / 2, d.w, PAD_H);
      ctx.restore();
    });

    particles.forEach((p) => {
      const sy = worldToScreen(p.y);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.5));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.star) {
        const r = p.size;
        for (let i = 0; i < 10; i += 1) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const q = i % 2 ? r * 0.45 : r;
          ctx.lineTo(p.x + Math.cos(a) * q, sy + Math.sin(a) * q);
        }
        ctx.closePath();
      } else ctx.arc(p.x, sy, p.size * (0.5 + (1 - p.life) * 0.8), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (player) drawPlayer();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    if (e.code === "Space" && state === "title") {
      e.preventDefault();
      startGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  });

  function setTouch(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const rect = canvas.getBoundingClientRect();
    touchX = ((t.clientX - rect.left) / rect.width) * W;
  }
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (state === "title") startGame();
    else setTouch(e);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    setTouch(e);
  }, { passive: false });
  canvas.addEventListener("touchend", () => {
    touchX = null;
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    if (state === "title") startGame();
    else {
      const rect = canvas.getBoundingClientRect();
      touchX = ((e.clientX - rect.left) / rect.width) * W;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || state !== "play") return;
    if (e.buttons) {
      const rect = canvas.getBoundingClientRect();
      touchX = ((e.clientX - rect.left) / rect.width) * W;
    }
  });
  canvas.addEventListener("pointerup", () => {
    touchX = null;
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  let lastRank = { rankDay: null, rankWeek: null };
  const shareBtn = document.getElementById("share-rank-btn");

  document.getElementById("rank-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitted) return;
    const name = nameInput.value.trim();
    if (name.length < 2 || name.length > 8) {
      document.getElementById("rank-msg").textContent = "이름은 2~8자로 적어 주세요";
      return;
    }
    localStorage.setItem(NAME_KEY, name);
    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    document.getElementById("rank-msg").textContent = "등록 중…";
    if (!window.TodayScores) {
      document.getElementById("rank-msg").textContent = "랭킹 모듈을 불러오지 못했어요";
      btn.disabled = false;
      return;
    }
    const res = await window.TodayScores.submitScore("doodle", name, score);
    if (res.ok) {
      submitted = true;
      lastRank = { rankDay: res.rankDay || res.rank, rankWeek: res.rankWeek };
      document.getElementById("rank-msg").textContent =
        window.TodayScores.formatRankMessage
          ? window.TodayScores.formatRankMessage(res)
          : res.rank
            ? `오늘 ${res.rank}위에 등록됐어요!`
            : "등록 완료!";
      if (shareBtn) shareBtn.hidden = false;
      if (window.TodayGameRank && TodayGameRank.afterSubmit) {
        await TodayGameRank.afterSubmit({
          gameId: "doodle",
          gameTitle: "폴짝 하늘",
          name,
          score,
          rankDay: lastRank.rankDay,
          label: `${score.toLocaleString("ko-KR")}점`,
        });
      }
    } else {
      document.getElementById("rank-msg").textContent = "등록 실패 · 다시 시도해 주세요";
      btn.disabled = false;
    }
  });

  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim() || "나";
      const result = await window.TodayScores.shareRank({
        gameTitle: "폴짝 하늘",
        name,
        score,
        rankDay: lastRank.rankDay,
        rankWeek: lastRank.rankWeek,
        url: "https://www.todaygame.co.kr/games/doodle/",
      });
      const msg = document.getElementById("rank-msg");
      msg.textContent = window.TodayScores.formatShareResult
        ? window.TodayScores.formatShareResult(result)
        : result.mode === "copy"
          ? "복사됨! 카톡·SNS에 붙여넣기 하세요"
          : result.error === "cancel"
            ? "공유를 취소했어요"
            : !result.ok
              ? "공유에 실패했어요"
              : "";
      if (result.mode === "share") msg.textContent = "";
    });
  }

  makeClouds();
  resetRun();
  showOverlay("title");
  loadAssets().then(() => {
    draw();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  });

  // 점검용: ?test=1 이면 높이를 바로 바꿔 하늘 색을 확인할 수 있다
  if (/[?&]test=1/.test(location.search)) {
    window.DoodleTest = {
      ready: () => !!sprites.hero && !!sprites.pad.break,
      drop() {
        player.y = cameraY + H + 60; // 화면 아래로: 다음 프레임에 끝
      },
      get state() {
        return state;
      },
      get score() {
        return score;
      },
      climb(h) {
        cameraY = -h * 10;
        player.y = cameraY + H * 0.5;
        player.vy = JUMP;
        platforms = [];
        let y = cameraY + H;
        while (y > cameraY - 40) {
          platforms.push(makePlatform(y));
          y -= platformGap();
        }
      },
    };
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
