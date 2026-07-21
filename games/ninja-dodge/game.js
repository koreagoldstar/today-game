(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GROUND = H - 118;
  const BEST_KEY = "today-ninja-dodge-best";
  const NAME_KEY = "today-ninja-dodge-name";

  const STAGE_NAMES = [
    "밤의 입문",
    "대나무 그림자",
    "달빛 표창",
    "재빠른 몸놀림",
    "황금 표창",
    "좌우 협공",
    "공중의 위험",
    "연속 회피",
    "닌자 시험",
    "표창 소나기",
    "그림자 술법",
    "고수의 길",
    "폭풍 회피",
    "달의 수행",
    "절정의 감각",
    "금빛 난무",
    "전설의 밤",
    "죽림의 후예",
    "표창 마스터",
    "닌자 고수",
  ];

  let playTime = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;

  function getDifficulty() {
    // ramp over ~3 minutes to max; start gentler than old stage 0
    const t = Math.min(1, playTime / 180);
    const level = 1 + Math.floor(playTime / 12);
    return {
      level,
      name: STAGE_NAMES[Math.min(STAGE_NAMES.length - 1, Math.floor(playTime / 12))] || `수행 ${level}`,
      meter: (playTime % 12) / 12,
      // easier early: slower spawn, slower shots, longer warn, no multi/top at start
      spawn: Math.max(0.42, 1.4 - t * 0.95),
      speed: 150 + t * 430,
      goldRate: Math.min(0.28, 0.04 + t * 0.24),
      multi: t < 0.18 ? 1 : t < 0.45 ? 2 : 3,
      topRate: Math.min(0.35, Math.max(0, (t - 0.1) * 0.45)),
      warn: Math.max(0.38, 1.05 - t * 0.6),
      lives: 3,
    };
  }

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
  const padEl = document.getElementById("pad");
  const nameInput = document.getElementById("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";
  document.getElementById("hud-best").textContent = String(best);

  const rawImgs = {
    idle: null,
    crouch: null,
    jump: null,
    shuriken: null,
    gold: null,
  };
  const sprites = {
    idle: null,
    crouch: null,
    jump: null,
    shuriken: null,
    gold: null,
  };

  let state = "title";
  let score = 0;
  let lives = 3;
  let combo = 0;
  let comboTimer = 0;
  let spawnAcc = 0;
  let invuln = 0;
  let slashT = 0;
  let flash = 0;
  let shake = 0;
  let last = 0;
  let raf = 0;
  let submitted = false;
  let keys = Object.create(null);
  let holdCrouch = false;
  let jumpPressed = false;
  let jumpArmed = true;
  let pointerX = null;
  let warnings = [];
  let shots = [];
  let particles = [];
  let floats = [];
  let leaves = [];
  let moonGlow = 0;

  const player = {
    x: W / 2,
    y: GROUND,
    vx: 0,
    pose: "idle",
    jumpV: 0,
    onGround: true,
    face: 1,
    w: 46,
    h: 70,
  };

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
    const [idle, crouch, jump, shu, gold] = await Promise.all([
      loadImg("assets/ninja-idle.png"),
      loadImg("assets/ninja-crouch.png"),
      loadImg("assets/ninja-jump.png"),
      loadImg("assets/shuriken.png"),
      loadImg("assets/shuriken-gold.png"),
    ]);
    rawImgs.idle = idle;
    rawImgs.crouch = crouch;
    rawImgs.jump = jump;
    rawImgs.shuriken = shu;
    rawImgs.gold = gold;
    if (idle) sprites.idle = punchBg(idle);
    if (crouch) sprites.crouch = punchBg(crouch);
    if (jump) sprites.jump = punchBg(jump);
    if (shu) sprites.shuriken = punchBg(shu);
    if (gold) sprites.gold = punchBg(gold);
  }

  function showOverlay(name) {
    Object.keys(overlays).forEach((k) => {
      overlays[k].classList.toggle("hidden", k !== name);
    });
    padEl.classList.toggle("show", name == null && state === "play");
  }

  function hideOverlays() {
    Object.keys(overlays).forEach((k) => overlays[k].classList.add("hidden"));
    padEl.classList.add("show");
  }

  function updateHud() {
    const st = getDifficulty();
    document.getElementById("hud-stage").textContent = String(st.level);
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-best").textContent = String(best);
    document.getElementById("goal-fill").style.width = `${Math.min(100, st.meter * 100)}%`;
    const livesEl = document.getElementById("hud-lives");
    livesEl.innerHTML = "";
    for (let i = 0; i < st.lives; i += 1) {
      const d = document.createElement("div");
      d.className = "life" + (i < lives ? "" : " empty");
      livesEl.appendChild(d);
    }
  }

  function makeLeaves() {
    leaves = Array.from({ length: 18 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.4 + Math.random() * 0.8,
      v: 18 + Math.random() * 28,
      r: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 2,
    }));
  }

  function resetStage() {
    lives = getDifficulty().lives;
    combo = 0;
    comboTimer = 0;
    spawnAcc = 0;
    invuln = 0.8;
    slashT = 0;
    flash = 0;
    shake = 0;
    warnings = [];
    shots = [];
    particles = [];
    floats = [];
    player.x = W / 2;
    player.y = GROUND;
    player.vx = 0;
    player.jumpV = 0;
    player.onGround = true;
    player.pose = "idle";
    updateHud();
  }

  function startGame(fromTitle) {
    if (fromTitle) {
      playTime = 0;
      score = 0;
    }
    submitted = false;
    document.getElementById("rank-msg").textContent = "";
    document.getElementById("submit-btn").disabled = false;
    const shareEl = document.getElementById("share-rank-btn");
    if (shareEl) shareEl.hidden = true;
    state = "play";
    hideOverlays();
    resetStage();
  }

  function spawnFloat(x, y, text, color) {
    floats.push({ x, y, text, color: color || "#ffe9a8", t: 0, life: 0.9 });
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        t: 0,
        life: 0.35 + Math.random() * 0.4,
        color,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function laneY(lane) {
    if (lane === "high") return GROUND - 78;
    if (lane === "low") return GROUND - 18;
    return GROUND - 46;
  }

  function queueWarning() {
    const st = getDifficulty();
    const roll = Math.random();
    let dir;
    let lane;
    if (roll < st.topRate) {
      dir = "top";
      lane = "mid";
    } else if (roll < 0.5 + st.topRate * 0.2) {
      dir = "left";
      lane = Math.random() < 0.34 ? "high" : Math.random() < 0.5 ? "low" : "mid";
    } else {
      dir = "right";
      lane = Math.random() < 0.34 ? "high" : Math.random() < 0.5 ? "low" : "mid";
    }
    const gold = Math.random() < st.goldRate;
    const y = dir === "top" ? 40 : laneY(lane);
    const x = dir === "left" ? 18 : dir === "right" ? W - 18 : 40 + Math.random() * (W - 80);
    warnings.push({
      dir,
      lane,
      gold,
      x,
      y,
      t: 0,
      life: st.warn,
      speed: st.speed * (gold ? 1.15 : 1) * (0.92 + Math.random() * 0.2),
    });
  }

  function fireWarning(w) {
    let x = w.x;
    let y = w.y;
    let vx = 0;
    let vy = 0;
    if (w.dir === "left") {
      x = -24;
      vx = w.speed;
    } else if (w.dir === "right") {
      x = W + 24;
      vx = -w.speed;
    } else {
      y = -24;
      x = Math.max(40, Math.min(W - 40, player.x + (Math.random() - 0.5) * 70));
      vy = w.speed * 0.95;
    }
    shots.push({
      x,
      y,
      vx,
      vy,
      r: w.gold ? 16 : 14,
      gold: w.gold,
      lane: w.lane,
      rot: 0,
      spin: (w.dir === "right" ? -1 : 1) * (10 + Math.random() * 8),
      alive: true,
    });
  }

  function hitbox() {
    if (player.pose === "crouch") {
      return { x: player.x, y: player.y - 22, w: 40, h: 36 };
    }
    if (player.pose === "jump") {
      return { x: player.x, y: player.y - 78, w: 38, h: 52 };
    }
    return { x: player.x, y: player.y - 58, w: 40, h: 58 };
  }

  function circleRect(cx, cy, cr, hb) {
    const nearestX = Math.max(hb.x - hb.w / 2, Math.min(cx, hb.x + hb.w / 2));
    const nearestY = Math.max(hb.y - hb.h / 2, Math.min(cy, hb.y + hb.h / 2));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy < cr * cr;
  }

  function trySlash() {
    if (state !== "play" || slashT > 0) return;
    slashT = 0.22;
    player.face = player.vx >= 0 ? 1 : player.face;
    let hit = 0;
    shots.forEach((s) => {
      if (!s.alive) return;
      const dx = s.x - player.x;
      const dy = s.y - (player.y - 40);
      const dist = Math.hypot(dx, dy);
      const range = s.gold ? 78 : 52;
      if (dist < range) {
        s.alive = false;
        hit += 1;
        const gain = s.gold ? 40 + combo * 5 : 15 + combo * 2;
        combo += 1;
        comboTimer = 1.6;
        score += gain;
        burst(s.x, s.y, s.gold ? "#ffd76a" : "#c9e8ff", s.gold ? 16 : 10);
        spawnFloat(s.x, s.y - 10, s.gold ? `튕김! +${gain}` : `베기 +${gain}`, s.gold ? "#ffd76a" : "#fff");
      }
    });
    if (!hit) burst(player.x + player.face * 28, player.y - 40, "rgba(255,230,160,0.8)", 6);
    updateHud();
  }

  function hurt() {
    if (invuln > 0) return;
    lives -= 1;
    invuln = 1.2;
    flash = 0.35;
    shake = 10;
    combo = 0;
    burst(player.x, player.y - 40, "#ff7eb6", 18);
    spawnFloat(player.x, player.y - 80, "아야!", "#ff9ec8");
    updateHud();
    if (lives <= 0) {
      state = "over";
      padEl.classList.remove("show");
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
        document.getElementById("hud-best").textContent = String(best);
      }
      submitted = false;
      document.getElementById("rank-msg").textContent = "";
      document.getElementById("submit-btn").disabled = false;
      const st = getDifficulty();
      document.getElementById("over-detail").textContent =
        `${st.name} · 점수 ${score}점 · 최고 ${best}`;
      showOverlay("over");
    }
  }

  function updatePlayer(dt) {
    let move = 0;
    if (keys.ArrowLeft || keys.a || keys.A) move -= 1;
    if (keys.ArrowRight || keys.d || keys.D) move += 1;
    if (pointerX != null) {
      const dx = pointerX - player.x;
      if (Math.abs(dx) > 6) move = Math.sign(dx);
      player.x += dx * Math.min(1, dt * 10);
    } else {
      player.vx = move * 280;
      player.x += player.vx * dt;
    }
    if (move) player.face = move;

    const wantCrouch = holdCrouch || keys.ArrowDown || keys.s || keys.S;
    const wantJump =
      jumpPressed || keys.ArrowUp || keys.w || keys.W || keys[" "];

    if (wantJump && jumpArmed && player.onGround && !wantCrouch) {
      player.onGround = false;
      player.jumpV = -520;
      player.pose = "jump";
      jumpArmed = false;
    }
    if (!wantJump && player.onGround) jumpArmed = true;
    jumpPressed = false;

    if (!player.onGround) {
      player.jumpV += 1600 * dt;
      player.y += player.jumpV * dt;
      if (player.y >= GROUND) {
        player.y = GROUND;
        player.jumpV = 0;
        player.onGround = true;
      } else {
        player.pose = "jump";
      }
    } else if (wantCrouch) {
      player.pose = "crouch";
    } else {
      player.pose = "idle";
    }

    player.x = Math.max(36, Math.min(W - 36, player.x));
  }

  function update(dt) {
    if (state !== "play") return;
    playTime += dt;
    const st = getDifficulty();

    moonGlow += dt;
    invuln = Math.max(0, invuln - dt);
    slashT = Math.max(0, slashT - dt);
    flash = Math.max(0, flash - dt);
    if (shake > 0) shake *= 0.86;
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    updatePlayer(dt);

    leaves.forEach((L) => {
      L.y += L.v * dt;
      L.x += Math.sin(L.y * 0.02) * 12 * dt;
      L.r += L.spin * dt;
      if (L.y > H + 20) {
        L.y = -20;
        L.x = Math.random() * W;
      }
    });

    spawnAcc += dt;
    if (spawnAcc >= st.spawn) {
      spawnAcc = 0;
      const n = st.multi;
      for (let i = 0; i < n; i += 1) queueWarning();
    }

    warnings.forEach((w) => {
      w.t += dt;
    });
    warnings = warnings.filter((w) => {
      if (w.t >= w.life) {
        fireWarning(w);
        return false;
      }
      return true;
    });

    const hb = hitbox();
    shots.forEach((s) => {
      if (!s.alive) return;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;

      if (s.x < -60 || s.x > W + 60 || s.y > H + 60) {
        s.alive = false;
        combo += 1;
        comboTimer = 1.4;
        const gain = 8 + Math.min(20, combo);
        score += gain;
        spawnFloat(Math.max(40, Math.min(W - 40, s.x)), Math.max(80, s.y), `회피 +${gain}`, "#b8f0ff");
        return;
      }

      // near miss
      const dist = Math.hypot(s.x - hb.x, s.y - hb.y);
      if (dist < s.r + 28 && dist > s.r + 10 && Math.random() < 0.02) {
        score += 2;
      }

      if (invuln <= 0 && circleRect(s.x, s.y, s.r * 0.72, hb)) {
        s.alive = false;
        hurt();
      }
    });
    shots = shots.filter((s) => s.alive);

    particles.forEach((p) => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
    });
    particles = particles.filter((p) => p.t < p.life);
    floats.forEach((f) => {
      f.t += dt;
      f.y -= 40 * dt;
    });
    floats = floats.filter((f) => f.t < f.life);

    updateHud();
  }

  function drawBamboo(x, baseY, h, shade) {
    ctx.fillStyle = shade;
    ctx.fillRect(x - 5, baseY - h, 10, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x - 3, baseY - h, 3, h);
    for (let y = baseY - 18; y > baseY - h; y -= 28) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x - 5, y, 10, 3);
    }
    // leaves
    ctx.fillStyle = "rgba(90, 200, 140, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x + 14, baseY - h + 10, 16, 6, 0.5, 0, Math.PI * 2);
    ctx.ellipse(x - 12, baseY - h + 18, 14, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBackground() {
    // moonlit temple courtyard matching thumb
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0c0a28");
    g.addColorStop(0.4, "#1a1450");
    g.addColorStop(0.7, "#2a1858");
    g.addColorStop(1, "#1a1028");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // huge full moon (thumb center)
    const mx = W / 2;
    const my = 118;
    const mg = ctx.createRadialGradient(mx, my, 20, mx, my, 110);
    mg.addColorStop(0, "rgba(255, 250, 230, 1)");
    mg.addColorStop(0.35, "rgba(255, 240, 200, 0.75)");
    mg.addColorStop(0.7, "rgba(255, 210, 160, 0.2)");
    mg.addColorStop(1, "rgba(255, 180, 140, 0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 100 + Math.sin(moonGlow * 1.2) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8e8";
    ctx.beginPath();
    ctx.arc(mx, my, 42, 0, Math.PI * 2);
    ctx.fill();

    // temple silhouette + lanterns
    ctx.fillStyle = "rgba(10, 8, 28, 0.85)";
    ctx.beginPath();
    ctx.moveTo(90, GROUND - 40);
    ctx.lineTo(120, GROUND - 130);
    ctx.lineTo(270, GROUND - 130);
    ctx.lineTo(300, GROUND - 40);
    ctx.closePath();
    ctx.fill();
    // curved roof
    ctx.fillStyle = "rgba(20, 14, 40, 0.95)";
    ctx.beginPath();
    ctx.moveTo(80, GROUND - 120);
    ctx.quadraticCurveTo(195, GROUND - 170, 310, GROUND - 120);
    ctx.lineTo(290, GROUND - 110);
    ctx.quadraticCurveTo(195, GROUND - 148, 100, GROUND - 110);
    ctx.closePath();
    ctx.fill();

    // paper lanterns
    [[150, GROUND - 95], [240, GROUND - 95]].forEach(([lx, ly]) => {
      const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 28);
      lg.addColorStop(0, "rgba(255, 180, 60, 0.9)");
      lg.addColorStop(1, "rgba(255, 120, 40, 0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffb040";
      ctx.beginPath();
      ctx.ellipse(lx, ly, 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // bamboo frames
    for (let i = 0; i < 5; i += 1) {
      drawBamboo(12 + i * 18, GROUND + 20, 220 + (i % 3) * 35, i % 2 ? "#1e4a38" : "#163828");
      drawBamboo(W - 20 - i * 18, GROUND + 20, 200 + (i % 3) * 40, i % 2 ? "#163828" : "#1e4a38");
    }

    // wooden deck floor
    const gg = ctx.createLinearGradient(0, GROUND - 10, 0, H);
    gg.addColorStop(0, "#3a2848");
    gg.addColorStop(0.3, "#2a1830");
    gg.addColorStop(1, "#120c1a");
    ctx.fillStyle = gg;
    ctx.fillRect(0, GROUND + 4, W, H - GROUND);

    ctx.strokeStyle = "rgba(80, 50, 70, 0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const y = GROUND + 18 + i * 22;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // dojo mat highlight
    ctx.fillStyle = "rgba(120, 60, 100, 0.35)";
    ctx.beginPath();
    ctx.ellipse(W / 2, GROUND + 18, 130, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // cherry blossom petals (pink)
    leaves.forEach((L) => {
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.r);
      ctx.fillStyle = "rgba(255, 160, 200, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6 * L.s, 3.5 * L.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawSprite(img, x, y, w, h, flip) {
    if (!img) return false;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
    return true;
  }

  function drawFallbackNinja() {
    const hb = hitbox();
    ctx.fillStyle = "#2a2448";
    ctx.beginPath();
    ctx.arc(hb.x, hb.y, Math.min(hb.w, hb.h) * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb0c8";
    ctx.beginPath();
    ctx.arc(player.x, player.y - (player.pose === "crouch" ? 36 : 70), 14, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
    if (blink) return;

    let img = sprites.idle;
    let h = 96;
    let w = 96;
    let y = player.y + 6;
    if (player.pose === "crouch") {
      img = sprites.crouch || sprites.idle;
      h = 78;
      w = 90;
      y = player.y + 10;
    } else if (player.pose === "jump") {
      img = sprites.jump || sprites.idle;
      h = 100;
      w = 96;
    }

    if (slashT > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 220, 120, 0.85)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y - 40, 48, -0.9 * player.face, 0.9 * player.face);
      ctx.stroke();
      ctx.restore();
    }

    const ok = drawSprite(img, player.x, y, w, h, player.face < 0);
    if (!ok) drawFallbackNinja();

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(player.x, GROUND + 14, player.pose === "jump" ? 18 : 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFallbackShuriken(x, y, r, gold, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = gold ? "#ffd76a" : "#d8e6ff";
    ctx.strokeStyle = gold ? "#c98a20" : "#6a7a9a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + 0.4) * r * 0.28, Math.sin(a + 0.4) * r * 0.28);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = gold ? "#fff3b0" : "#fff";
    ctx.fill();
    ctx.restore();
  }

  function drawShuriken(s) {
    const img = s.gold ? sprites.gold : sprites.shuriken;
    const size = s.r * 2.6;
    // purple-gold motion trail like thumb
    ctx.save();
    ctx.globalAlpha = 0.35;
    const trail = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, size * 0.7);
    trail.addColorStop(0, s.gold ? "rgba(255,215,100,0.8)" : "rgba(180,100,255,0.7)");
    trail.addColorStop(1, "rgba(255,200,80,0)");
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.arc(s.x, s.y, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (img) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      drawFallbackShuriken(s.x, s.y, s.r, s.gold, s.rot);
    }
  }

  function drawWarnings() {
    warnings.forEach((w) => {
      const pulse = 0.45 + Math.sin(w.t * 18) * 0.35;
      ctx.save();
      ctx.globalAlpha = pulse;
      if (w.dir === "left" || w.dir === "right") {
        ctx.fillStyle = w.gold ? "#ffd76a" : "#ff6b9d";
        const x = w.dir === "left" ? 8 : W - 8;
        ctx.beginPath();
        ctx.moveTo(x, w.y);
        ctx.lineTo(x + (w.dir === "left" ? 16 : -16), w.y - 10);
        ctx.lineTo(x + (w.dir === "left" ? 16 : -16), w.y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(w.dir === "left" ? 26 : W - 70, w.y - 2, 44, 4);
      } else {
        ctx.fillStyle = w.gold ? "#ffd76a" : "#ff6b9d";
        ctx.beginPath();
        ctx.moveTo(w.x, 10);
        ctx.lineTo(w.x - 10, 26);
        ctx.lineTo(w.x + 10, 26);
        ctx.closePath();
        ctx.fill();
      }
      // lane hint text
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#fff";
      ctx.font = "11px Jua";
      ctx.textAlign = "center";
      const tip =
        w.lane === "high" ? "숙여!" : w.lane === "low" ? "점프!" : w.gold ? "베기?" : "피하기";
      const tx = w.dir === "left" ? 56 : w.dir === "right" ? W - 56 : w.x;
      const ty = w.dir === "top" ? 40 : w.y - 14;
      ctx.fillText(tip, tx, ty);
      ctx.restore();
    });
  }

  function draw() {
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(sx, sy);
    drawBackground();
    drawWarnings();
    shots.forEach(drawShuriken);
    drawPlayer();

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      ctx.fillStyle = f.color;
      ctx.font = "bold 16px Jua";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (combo > 1 && state === "play") {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "bold 18px Jua";
      ctx.textAlign = "center";
      ctx.fillText(`COMBO x${combo}`, W / 2, 108);
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,120,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches && e.touches[0] ? e.touches[0] : e;
    return {
      x: ((src.clientX - rect.left) / rect.width) * W,
      y: ((src.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    if (e.target.closest && e.target.closest(".pad")) return;
    const p = pointerPos(e);
    if (p.y < H - 120) pointerX = p.x;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (state !== "play" || pointerX == null) return;
    pointerX = pointerPos(e).x;
  });
  canvas.addEventListener("pointerup", () => {
    pointerX = null;
  });
  canvas.addEventListener("pointercancel", () => {
    pointerX = null;
  });

  function bindHold(btn, on, off) {
    const down = (e) => {
      e.preventDefault();
      btn.classList.add("held");
      on();
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove("held");
      off();
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }

  bindHold(
    document.getElementById("btn-crouch"),
    () => {
      holdCrouch = true;
    },
    () => {
      holdCrouch = false;
    }
  );
  document.getElementById("btn-jump").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    document.getElementById("btn-jump").classList.add("held");
    jumpPressed = true;
  });
  const jumpUp = (e) => {
    e.preventDefault();
    document.getElementById("btn-jump").classList.remove("held");
  };
  document.getElementById("btn-jump").addEventListener("pointerup", jumpUp);
  document.getElementById("btn-jump").addEventListener("pointerleave", jumpUp);
  document.getElementById("btn-jump").addEventListener("pointercancel", jumpUp);
  document.getElementById("btn-slash").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    trySlash();
  });

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (state !== "play") return;
    if (e.key === "z" || e.key === "Z" || e.key === "Enter") {
      e.preventDefault();
      trySlash();
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  document.getElementById("start-btn").addEventListener("click", () => startGame(true));
  document.getElementById("retry-btn").addEventListener("click", () => startGame(true));

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
    const res = await window.TodayScores.submitScore("ninja-dodge", name, score);
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
          gameId: "ninja-dodge",
          gameTitle: "닌자 표창 피하기",
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
        gameTitle: "닌자 표창 피하기",
        name,
        score,
        rankDay: lastRank.rankDay,
        rankWeek: lastRank.rankWeek,
        url: "https://www.todaygame.co.kr/games/ninja-dodge/",
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

  makeLeaves();
  loadAssets().then(() => {
    showOverlay("title");
    last = performance.now();
    raf = requestAnimationFrame(loop);
  });

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
