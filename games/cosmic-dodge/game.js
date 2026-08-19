(() => {
  "use strict";

  const GAME_ID = "cosmic-dodge";
  const GAME_TITLE = "우주 회피";

  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // High-Res Scrolling Background
  const bgImg = new Image();
  bgImg.src = "assets/bg.jpg";
  let bgScrollY = 0;

  // Real 3D Sprite Assets
  const sprites = { player: null, boss: null, meteor: null };

  function chromaKey(img) {
    if (!img) return null;
    try {
      const c = document.createElement("canvas");
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return img;
      c.width = w;
      c.height = h;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const data = x.getImageData(0, 0, w, h);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (r < 32 && g < 32 && b < 32) {
          d[i + 3] = 0;
        }
      }
      x.putImageData(data, 0, 0);
      return c;
    } catch (_) {
      return img;
    }
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(chromaKey(img) || img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  Promise.all([
    loadImg("assets/player.png"),
    loadImg("assets/boss.png"),
    loadImg("assets/meteor.png"),
  ]).then(([playerSprite, bossSprite, meteorSprite]) => {
    sprites.player = playerSprite;
    sprites.boss = bossSprite;
    sprites.meteor = meteorSprite;
  });

  // HUD & UI Elements
  const hudStage = document.getElementById("hud-stage");
  const hudStageMax = document.getElementById("hud-stage-max");
  const hudScore = document.getElementById("hud-score");
  const hudLives = document.getElementById("hud-lives");
  const hudShield = document.getElementById("hud-shield");
  const hudBomb = document.getElementById("hud-bomb");

  const bossBar = document.getElementById("boss-bar");
  const bossNameEl = document.getElementById("boss-name");
  const bossFillEl = document.getElementById("boss-fill");

  const titleOverlay = document.getElementById("title");
  const clearOverlay = document.getElementById("clear");
  const overOverlay = document.getElementById("over");
  const clearTitle = document.getElementById("clear-title");
  const clearDetail = document.getElementById("clear-detail");
  const overDetail = document.getElementById("over-detail");

  const startBtn = document.getElementById("start-btn");
  const nextBtn = document.getElementById("next-btn");
  const retryBtn = document.getElementById("retry-btn");
  const rankContainer = document.getElementById("rank-form-container");

  // Touch Pad Buttons
  const leftBtn = document.getElementById("left-btn");
  const rightBtn = document.getElementById("right-btn");
  const fireBtn = document.getElementById("fire-btn");
  const bombBtn = document.getElementById("bomb-btn");

  // Web Audio Synth
  let audioCtx = null;
  function getAudioCtx() {
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    } catch (_) {}
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ac = getAudioCtx();
      if (!ac) return;
      const now = ac.currentTime;

      if (type === "laser") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(850, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "star") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.06);
        osc.frequency.setValueAtTime(784, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === "bomb") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === "hit") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.linearRampToValueAtTime(35, now + 0.25);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "boss") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(650, now + 0.4);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (_) {}
  }

  // Canvas DPI & Resolution setup
  let W = 390;
  let H = 700;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width || 390;
    H = rect.height || 700;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
  }
  window.addEventListener("resize", resize);
  resize();

  // Game Engine State
  let state = "title"; // "title", "playing", "paused", "clear", "over"
  let stage = 1;
  const MAX_STAGE = 50;
  let score = 0;
  let lives = 3;
  let bombs = 2;
  let invulnerableTimer = 0;
  let screenShake = 0;

  // Player Spacecraft
  const player = {
    x: W / 2,
    y: H - 140,
    r: 26,
    vx: 0,
    hasShield: false,
    weaponLevel: 1,
    fireCooldown: 0,
    tilt: 0,
  };

  // Touch & Drag Position Tracking
  let touchX = W / 2;
  let touchY = H - 140;
  let isPointerDown = false;

  // Boss State
  let boss = null;

  // Starfield & Game Objects
  let stars = [];
  let bullets = [];
  let hazards = [];
  let items = [];
  let particles = [];
  let warnings = [];

  function initStarfield() {
    stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 2.8 + 0.6,
        speed: Math.random() * 2.5 + 0.8,
        alpha: Math.random() * 0.9 + 0.1,
      });
    }
  }
  initStarfield();

  // Input Controls (Touch Drag + Keyboard + Pad Buttons)
  const keys = {};
  let isPadLeft = false;
  let isPadRight = false;

  function getPosFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    return { x, y };
  }

  function handleTouchStart(e) {
    getAudioCtx();
    if (state !== "playing") return;
    const target = e.target;
    // Don't override if touching UI buttons
    if (target && target.classList && (target.classList.contains("pad") || target.classList.contains("fire") || target.classList.contains("primary"))) {
      return;
    }
    isPointerDown = true;
    const pos = getPosFromEvent(e);
    touchX = pos.x;
    touchY = pos.y - 35; // offset slightly above fingertip for vision
  }

  function handleTouchMove(e) {
    if (state !== "playing" || !isPointerDown) return;
    const pos = getPosFromEvent(e);
    touchX = pos.x;
    touchY = pos.y - 35;
  }

  function handleTouchEnd() {
    isPointerDown = false;
  }

  const stageEl = document.querySelector(".stage") || canvas;

  stageEl.addEventListener("pointerdown", handleTouchStart);
  stageEl.addEventListener("pointermove", handleTouchMove);
  window.addEventListener("pointerup", handleTouchEnd);
  window.addEventListener("pointercancel", handleTouchEnd);

  stageEl.addEventListener("touchstart", (e) => {
    handleTouchStart(e);
  }, { passive: true });

  stageEl.addEventListener("touchmove", (e) => {
    handleTouchMove(e);
  }, { passive: true });

  window.addEventListener("touchend", handleTouchEnd);

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (state === "playing") {
      if (e.key === " " || e.key === "b" || e.key === "B") useBomb();
      if (e.key === "f" || e.key === "F") fireBullet();
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  function bindPad(btn, onDown, onUp) {
    if (!btn) return;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      getAudioCtx();
      onDown();
    });
    btn.addEventListener("pointerup", (e) => {
      e.preventDefault();
      onUp();
    });
    btn.addEventListener("pointercancel", onUp);
  }

  bindPad(leftBtn, () => { isPadLeft = true; }, () => { isPadLeft = false; });
  bindPad(rightBtn, () => { isPadRight = true; }, () => { isPadRight = false; });
  bindPad(fireBtn, () => { fireBullet(); }, () => {});
  bindPad(bombBtn, () => { useBomb(); }, () => {});

  function fireBullet() {
    if (state !== "playing" || player.fireCooldown > 0) return;
    player.fireCooldown = 0.13;
    playSound("laser");

    if (player.weaponLevel === 1) {
      bullets.push({ x: player.x, y: player.y - 30, vx: 0, vy: -15, r: 6 });
    } else if (player.weaponLevel === 2) {
      bullets.push({ x: player.x - 14, y: player.y - 26, vx: 0, vy: -15, r: 6 });
      bullets.push({ x: player.x + 14, y: player.y - 26, vx: 0, vy: -15, r: 6 });
    } else {
      bullets.push({ x: player.x, y: player.y - 30, vx: 0, vy: -16, r: 7 });
      bullets.push({ x: player.x - 16, y: player.y - 24, vx: -3.5, vy: -14.5, r: 6 });
      bullets.push({ x: player.x + 16, y: player.y - 24, vx: 3.5, vy: -14.5, r: 6 });
    }
  }

  function useBomb() {
    if (state !== "playing" || bombs <= 0) return;
    bombs--;
    updateHUD();
    playSound("bomb");
    screenShake = 24;

    hazards.forEach((h) => {
      addExplosion(h.x, h.y, "#ff9e00", 24);
      score += 100;
    });
    hazards = [];
    warnings = [];

    if (boss) {
      boss.hp -= 35;
      addExplosion(boss.x, boss.y, "#ff0055", 40);
      if (boss.hp <= 0) destroyBoss();
    }
  }

  function addExplosion(x, y, color, count = 18) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6.5 + 2.0;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 5 + 2,
        color,
        life: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  }

  function updateHUD() {
    if (hudStage) hudStage.textContent = stage;
    if (hudStageMax) hudStageMax.textContent = MAX_STAGE;
    if (hudScore) hudScore.textContent = score.toLocaleString("ko-KR");
    if (hudLives) hudLives.textContent = "❤️".repeat(Math.max(0, lives));
    if (hudShield) {
      hudShield.textContent = player.hasShield ? "ON" : "OFF";
      hudShield.style.color = player.hasShield ? "#00f0ff" : "#a0c4ff";
    }
    if (hudBomb) hudBomb.textContent = `💣 x${bombs}`;
  }

  let stageTimer = 0;
  let stageDuration = 25;
  let spawnTimer = 0;
  let itemTimer = 0;
  let warningTimer = 0;

  function setupStage() {
    stageTimer = 0;
    spawnTimer = 0;
    itemTimer = 0;
    warningTimer = 0;
    hazards = [];
    bullets = [];
    items = [];
    warnings = [];
    boss = null;
    if (bossBar) bossBar.classList.add("hidden");

    if (stage % 5 === 0) {
      const maxHp = 70 + stage * 22;
      boss = {
        x: W / 2,
        y: -90,
        targetY: 100,
        hp: maxHp,
        maxHp: maxHp,
        vx: 2.4,
        patternTimer: 0,
      };
      if (bossNameEl) bossNameEl.textContent = `우주 거함 보스 (Stage ${stage})`;
      if (bossFillEl) bossFillEl.style.width = "100%";
      if (bossBar) bossBar.classList.remove("hidden");
      playSound("boss");
    }

    updateHUD();
  }

  function destroyBoss() {
    playSound("bomb");
    addExplosion(boss.x, boss.y, "#ff0055", 65);
    addExplosion(boss.x - 35, boss.y, "#ffd166", 45);
    addExplosion(boss.x + 35, boss.y, "#00f0ff", 45);
    score += 3500 + stage * 500;
    boss = null;
    if (bossBar) bossBar.classList.add("hidden");
    stageClear();
  }

  function spawnHazard() {
    const isMine = Math.random() < 0.28;
    const size = isMine ? 20 : Math.random() * 20 + 18;
    const speed = (Math.random() * 2.4 + 2.6) * (1 + stage * 0.04);

    hazards.push({
      x: Math.random() * (W - 60) + 30,
      y: -40,
      r: size,
      type: isMine ? "mine" : "meteor",
      vy: speed,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.09,
      hp: isMine ? 1 : Math.ceil(size / 9),
    });
  }

  function spawnWarningLaser() {
    const x = Math.random() * (W - 80) + 40;
    warnings.push({
      x,
      timer: 1.1,
      duration: 0.85,
      active: false,
    });
  }

  function spawnItem() {
    const r = Math.random();
    let type = "star";
    if (r < 0.20 && !player.hasShield) type = "shield";
    else if (r < 0.35 && bombs < 3) type = "bomb";
    else if (r < 0.50 && player.weaponLevel < 3) type = "weapon";

    items.push({
      x: Math.random() * (W - 60) + 30,
      y: -30,
      r: 18,
      type,
      vy: Math.random() * 1.5 + 2.2,
    });
  }

  let lastTime = performance.now();

  function update(dt) {
    bgScrollY = (bgScrollY + dt * 45) % H;

    stars.forEach((s) => {
      s.y += s.speed;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    });

    if (state !== "playing") return;

    if (invulnerableTimer > 0) invulnerableTimer -= dt;
    if (screenShake > 0) screenShake -= dt * 30;
    if (player.fireCooldown > 0) player.fireCooldown -= dt;

    stageTimer += dt;
    spawnTimer += dt;
    itemTimer += dt;
    warningTimer += dt;

    // Keyboard / Touch Pad Movement Delta
    let kbX = 0;
    let kbY = 0;
    if (keys["ArrowLeft"] || keys["a"] || keys["A"] || isPadLeft) kbX -= 380 * dt;
    if (keys["ArrowRight"] || keys["d"] || keys["D"] || isPadRight) kbX += 380 * dt;
    if (keys["ArrowUp"] || keys["w"] || keys["W"]) kbY -= 380 * dt;
    if (keys["ArrowDown"] || keys["s"] || keys["S"]) kbY += 380 * dt;

    if (kbX !== 0 || kbY !== 0) {
      touchX = player.x + kbX;
      touchY = player.y + kbY;
    }

    touchX = Math.max(player.r, Math.min(W - player.r, touchX));
    touchY = Math.max(player.r + 60, Math.min(H - player.r - 40, touchY));

    const dx = touchX - player.x;
    const dy = touchY - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 2) {
      const step = Math.min(dist, 500 * dt);
      player.x += (dx / dist) * step;
      player.y += (dy / dist) * step;
      player.tilt = (dx / dist) * Math.min(1, dist / 35) * 0.35;
    } else {
      player.tilt *= 0.8;
    }

    // Auto Fire bullets whenever touching screen or holding keys
    if (isPointerDown || keys[" "] || keys["f"] || keys["F"]) {
      fireBullet();
    }

    // Engine Thruster Flame Particles
    if (Math.random() < 0.95) {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 16,
        y: player.y + 24,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 4 + 4,
        r: Math.random() * 4 + 1.5,
        color: player.hasShield ? "#00f0ff" : "#ffb703",
        life: 1,
        decay: 0.08,
      });
    }

    // Bullets Update
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      if (b.y < -20 || b.x < -20 || b.x > W + 20) {
        bullets.splice(i, 1);
        continue;
      }

      if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < 55) {
        boss.hp--;
        addExplosion(b.x, b.y, "#ff9e00", 5);
        bullets.splice(i, 1);
        if (bossFillEl) bossFillEl.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
        if (boss.hp <= 0) {
          destroyBoss();
          return;
        }
        continue;
      }

      let hit = false;
      for (let j = hazards.length - 1; j >= 0; j--) {
        const h = hazards[j];
        if (Math.hypot(b.x - h.x, b.y - h.y) < b.r + h.r) {
          h.hp--;
          hit = true;
          addExplosion(b.x, b.y, "#ffd166", 6);
          if (h.hp <= 0) {
            score += h.type === "mine" ? 150 : 80;
            playSound("hit");
            addExplosion(h.x, h.y, "#ff5500", 18);
            hazards.splice(j, 1);
          }
          break;
        }
      }
      if (hit) bullets.splice(i, 1);
    }

    // Boss Behavior
    if (boss) {
      if (boss.y < boss.targetY) boss.y += 2;
      boss.x += boss.vx;
      if (boss.x < 65 || boss.x > W - 65) boss.vx *= -1;

      boss.patternTimer += dt;
      if (boss.patternTimer > 1.1) {
        boss.patternTimer = 0;
        hazards.push({ x: boss.x - 28, y: boss.y + 38, r: 10, type: "mine", vy: 4.8, rot: 0, vRot: 0, hp: 1 });
        hazards.push({ x: boss.x + 28, y: boss.y + 38, r: 10, type: "mine", vy: 4.8, rot: 0, vRot: 0, hp: 1 });
      }
    } else {
      const spawnInterval = Math.max(0.28, 1.0 - stage * 0.02);
      if (spawnTimer > spawnInterval) {
        spawnTimer = 0;
        spawnHazard();
      }

      if (stage >= 3 && warningTimer > 5.5) {
        warningTimer = 0;
        spawnWarningLaser();
      }

      if (itemTimer > 2.8) {
        itemTimer = 0;
        spawnItem();
      }

      if (stageTimer > stageDuration) {
        stageClear();
        return;
      }
    }

    // Warning Lasers
    for (let i = warnings.length - 1; i >= 0; i--) {
      const w = warnings[i];
      if (!w.active) {
        w.timer -= dt;
        if (w.timer <= 0) w.active = true;
      } else {
        w.duration -= dt;
        if (Math.abs(player.x - w.x) < 22) {
          playerHit();
        }
        if (w.duration <= 0) warnings.splice(i, 1);
      }
    }

    // Hazards
    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i];
      h.y += h.vy;
      h.rot += h.vRot;

      const dist = Math.hypot(h.x - player.x, h.y - player.y);
      if (dist < h.r + player.r - 4) {
        playerHit();
        hazards.splice(i, 1);
      } else if (h.y > H + 50) {
        hazards.splice(i, 1);
      }
    }

    // Items
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy;

      if (Math.hypot(it.x - player.x, it.y - player.y) < it.r + player.r) {
        if (it.type === "star") {
          score += 500;
          playSound("star");
          addExplosion(it.x, it.y, "#ffd166", 12);
        } else if (it.type === "shield") {
          player.hasShield = true;
          playSound("star");
          addExplosion(it.x, it.y, "#00f0ff", 16);
        } else if (it.type === "bomb") {
          bombs = Math.min(3, bombs + 1);
          playSound("star");
          addExplosion(it.x, it.y, "#ff0055", 16);
        } else if (it.type === "weapon") {
          player.weaponLevel = Math.min(3, player.weaponLevel + 1);
          playSound("star");
          addExplosion(it.x, it.y, "#70e000", 16);
        }
        updateHUD();
        items.splice(i, 1);
      } else if (it.y > H + 40) {
        items.splice(i, 1);
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function playerHit() {
    if (invulnerableTimer > 0) return;

    if (player.hasShield) {
      player.hasShield = false;
      invulnerableTimer = 1.0;
      playSound("hit");
      addExplosion(player.x, player.y, "#00f0ff", 24);
      updateHUD();
      return;
    }

    lives--;
    playSound("hit");
    screenShake = 18;
    addExplosion(player.x, player.y, "#ff0055", 36);
    invulnerableTimer = 1.8;
    updateHUD();

    if (lives <= 0) {
      gameOver();
    }
  }

  // Canvas Frame Rendering
  function render() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // High-Res Scrolling Background
    if (bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, bgScrollY, W, H);
      ctx.drawImage(bgImg, 0, bgScrollY - H, W, H);
      ctx.fillStyle = "rgba(5, 8, 17, 0.35)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "#050811";
      ctx.fillRect(0, 0, W, H);
    }

    // Render Starfield Particles
    ctx.fillStyle = "#ffffff";
    stars.forEach((s) => {
      ctx.globalAlpha = s.alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Render Plasma Warnings
    warnings.forEach((w) => {
      if (!w.active) {
        ctx.strokeStyle = "rgba(255, 0, 85, 0.6)";
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(w.x, 0);
        ctx.lineTo(w.x, H);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = "rgba(255, 0, 85, 0.9)";
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 22;
        ctx.fillRect(w.x - 18, 0, 36, H);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(w.x - 5, 0, 10, H);
      }
    });

    // Render 3D Boss Ship Sprite
    if (boss) {
      ctx.save();
      ctx.translate(boss.x, boss.y);
      if (sprites.boss) {
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 25;
        ctx.drawImage(sprites.boss, -70, -70, 140, 140);
      } else {
        ctx.fillStyle = "#ff0055";
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render 3D Hazards (Meteors & Mines)
    hazards.forEach((h) => {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);

      if (h.type === "mine") {
        ctx.fillStyle = "#ff0055";
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, h.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, h.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        if (sprites.meteor) {
          ctx.shadowColor = "#ff9e00";
          ctx.shadowBlur = 16;
          ctx.drawImage(sprites.meteor, -h.r * 1.35, -h.r * 1.35, h.r * 2.7, h.r * 2.7);
        } else {
          ctx.fillStyle = "#f4a261";
          ctx.shadowColor = "#ffb703";
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 0, h.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    // Render Laser Bullets
    bullets.forEach((b) => {
      ctx.fillStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render Items
    items.forEach((it) => {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (it.type === "star") ctx.fillText("⭐", 0, 0);
      else if (it.type === "shield") ctx.fillText("🛡️", 0, 0);
      else if (it.type === "bomb") ctx.fillText("💣", 0, 0);
      else if (it.type === "weapon") ctx.fillText("⚡", 0, 0);
      ctx.restore();
    });

    // Render Explosion Particles
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Render 3D Player Spacecraft Sprite
    if ((state === "playing" || state === "title") && (invulnerableTimer <= 0 || Math.floor(Date.now() / 80) % 2 === 0)) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.tilt || 0);

      // Energy Shield Aura Ring
      if (player.hasShield) {
        ctx.strokeStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 22;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, player.r + 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (sprites.player) {
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 18;
        ctx.drawImage(sprites.player, -player.r * 1.6, -player.r * 1.6, player.r * 3.2, player.r * 3.2);
      } else {
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "#00f0ff";
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(-26, 20);
        ctx.lineTo(26, 20);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (!window.TodayPause || !window.TodayPause.isPaused || !window.TodayPause.isPaused()) {
      update(dt);
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function startGame() {
    getAudioCtx();
    stage = 1;
    score = 0;
    lives = 3;
    bombs = 2;
    player.weaponLevel = 1;
    player.hasShield = false;
    player.x = W / 2;
    player.y = H - 140;
    touchX = W / 2;
    touchY = H - 140;

    state = "playing";
    if (titleOverlay) titleOverlay.classList.add("hidden");
    if (clearOverlay) clearOverlay.classList.add("hidden");
    if (overOverlay) overOverlay.classList.add("hidden");

    setupStage();
  }

  function stageClear() {
    state = "clear";
    playSound("star");

    if (stage >= MAX_STAGE) {
      if (clearTitle) clearTitle.textContent = "🏆 전 은하 제압!";
      if (clearDetail) clearDetail.textContent = `축하합니다! 50스테이지 완파!\n최종 점수: ${score.toLocaleString("ko-KR")}점`;
      if (nextBtn) nextBtn.textContent = "처음부터";
    } else {
      if (clearTitle) clearTitle.textContent = `STAGE ${stage} CLEAR!`;
      if (clearDetail) clearDetail.textContent = `점수: ${score.toLocaleString("ko-KR")}점 · 다음 구역 진입`;
      if (nextBtn) nextBtn.textContent = "다음 스테이지";
    }
    if (clearOverlay) clearOverlay.classList.remove("hidden");
  }

  function nextStage() {
    if (stage >= MAX_STAGE) {
      startGame();
      return;
    }
    stage++;
    state = "playing";
    if (clearOverlay) clearOverlay.classList.add("hidden");
    setupStage();
  }

  function gameOver() {
    state = "over";
    if (overDetail) overDetail.textContent = `STAGE ${stage} · 최종 점수: ${score.toLocaleString("ko-KR")}점`;
    if (overOverlay) overOverlay.classList.remove("hidden");

    if (window.TodayGameRank) {
      window.TodayGameRank.mount({
        gameId: GAME_ID,
        gameTitle: GAME_TITLE,
        formParent: rankContainer,
      });
      window.TodayGameRank.open(score, { label: `Stage ${stage} (${score.toLocaleString("ko-KR")}점)` });
    }
  }

  if (startBtn) startBtn.addEventListener("click", startGame);
  if (nextBtn) nextBtn.addEventListener("click", nextStage);
  if (retryBtn) retryBtn.addEventListener("click", startGame);

  if (window.TodayPause && window.TodayPause.mount) {
    window.TodayPause.mount({
      canPause: () => state === "playing",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "playing") return false;
        state = "paused";
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "playing";
        lastTime = performance.now();
        return true;
      },
    });
  }
})();
