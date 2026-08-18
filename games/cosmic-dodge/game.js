(() => {
  "use strict";

  const GAME_ID = "cosmic-dodge";
  const GAME_TITLE = "우주 회피";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

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
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
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
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
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
        osc.frequency.setValueAtTime(200, now);
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
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.25);
        gain.gain.setValueAtTime(0.4, now);
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
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
        gain.gain.setValueAtTime(0.4, now);
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
  let state = "title"; // "title", "playing", "clear", "over"
  let stage = 1;
  const MAX_STAGE = 50;
  let score = 0;
  let lives = 3;
  let bombs = 2;
  let invulnerableTimer = 0;
  let screenShake = 0;

  // Player Starcraft
  const player = {
    x: W / 2,
    y: H - 140,
    r: 22,
    vx: 0,
    targetX: W / 2,
    hasShield: false,
    weaponLevel: 1, // 1: single, 2: double, 3: spread
    fireCooldown: 0,
  };

  // Boss State
  let boss = null; // { x, y, hp, maxHp, vx, patternTimer }

  // Objects
  let stars = [];
  let bullets = [];
  let hazards = [];
  let items = [];
  let particles = [];
  let warnings = [];

  function initStarfield() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 2.5 + 0.8,
        speed: Math.random() * 2.0 + 0.5,
        alpha: Math.random() * 0.85 + 0.15,
      });
    }
  }
  initStarfield();

  // Input Handlers (Touch + Mouse + Keys)
  const keys = {};
  let isPadLeft = false;
  let isPadRight = false;
  let isDragging = false;

  function getXFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
    }
    return clientX - rect.left;
  }

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (state === "playing") {
      if (e.key === " " || e.key === "b" || e.key === "B") {
        useBomb();
      }
      if (e.key === "f" || e.key === "F") {
        fireBullet();
      }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (window.TodayPause) window.TodayPause.toggle();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  canvas.addEventListener("pointerdown", (e) => {
    getAudioCtx();
    if (state !== "playing") return;
    isDragging = true;
    player.targetX = getXFromEvent(e);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (state !== "playing" || !isDragging) return;
    player.targetX = getXFromEvent(e);
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

  // Touch Pad Controls
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

  // Player Actions
  function fireBullet() {
    if (state !== "playing" || player.fireCooldown > 0) return;
    player.fireCooldown = 0.14;
    playSound("laser");

    if (player.weaponLevel === 1) {
      bullets.push({ x: player.x, y: player.y - 24, vx: 0, vy: -12, r: 4 });
    } else if (player.weaponLevel === 2) {
      bullets.push({ x: player.x - 10, y: player.y - 20, vx: 0, vy: -12, r: 4 });
      bullets.push({ x: player.x + 10, y: player.y - 20, vx: 0, vy: -12, r: 4 });
    } else {
      bullets.push({ x: player.x, y: player.y - 24, vx: 0, vy: -13, r: 5 });
      bullets.push({ x: player.x - 12, y: player.y - 20, vx: -2.5, vy: -12, r: 4 });
      bullets.push({ x: player.x + 12, y: player.y - 20, vx: 2.5, vy: -12, r: 4 });
    }
  }

  function useBomb() {
    if (state !== "playing" || bombs <= 0) return;
    bombs--;
    updateHUD();
    playSound("bomb");
    screenShake = 20;

    // Destroy all non-boss hazards
    hazards.forEach((h) => {
      addExplosion(h.x, h.y, "#ff9e00", 16);
      score += 100;
    });
    hazards = [];
    warnings = [];

    // Damage Boss if present
    if (boss) {
      boss.hp -= 25;
      addExplosion(boss.x, boss.y, "#ff0055", 30);
      if (boss.hp <= 0) destroyBoss();
    }
  }

  function addExplosion(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 4 + 2,
        color,
        life: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  }

  function updateHUD() {
    hudStage.textContent = stage;
    hudStageMax.textContent = MAX_STAGE;
    hudScore.textContent = score.toLocaleString("ko-KR");
    hudLives.textContent = "❤️".repeat(Math.max(0, lives));
    hudShield.textContent = player.hasShield ? "ON" : "OFF";
    hudShield.style.color = player.hasShield ? "#00f0ff" : "#a0c4ff";
    hudBomb.textContent = `💣 x${bombs}`;
  }

  // Stage & Boss Spawning Logic
  let stageTimer = 0;
  let stageDuration = 25; // seconds per stage
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
    bossBar.classList.add("hidden");

    // Spawn Boss on Stage 5, 10, 15...
    if (stage % 5 === 0) {
      const maxHp = 60 + stage * 20;
      boss = {
        x: W / 2,
        y: -80,
        targetY: 90,
        hp: maxHp,
        maxHp: maxHp,
        vx: 2.2,
        patternTimer: 0,
      };
      bossNameEl.textContent = `우주 거함 보스 (Stage ${stage})`;
      bossFillEl.style.width = "100%";
      bossBar.classList.remove("hidden");
      playSound("boss");
    }

    updateHUD();
  }

  function destroyBoss() {
    playSound("bomb");
    addExplosion(boss.x, boss.y, "#ff0055", 50);
    addExplosion(boss.x - 30, boss.y, "#ffd166", 30);
    addExplosion(boss.x + 30, boss.y, "#00f0ff", 30);
    score += 3000 + stage * 500;
    boss = null;
    bossBar.classList.add("hidden");
    stageClear();
  }

  function spawnHazard() {
    const isMine = Math.random() < 0.25;
    const size = isMine ? 18 : Math.random() * 16 + 14;
    const speed = (Math.random() * 2.2 + 2.5) * (1 + stage * 0.04);

    hazards.push({
      x: Math.random() * (W - 60) + 30,
      y: -40,
      r: size,
      type: isMine ? "mine" : "meteor",
      vy: speed,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.08,
      hp: isMine ? 1 : Math.ceil(size / 10),
    });
  }

  function spawnWarningLaser() {
    const x = Math.random() * (W - 80) + 40;
    warnings.push({
      x,
      timer: 1.2, // warning duration before laser fires
      duration: 0.8,
      active: false,
    });
  }

  function spawnItem() {
    const r = Math.random();
    let type = "star";
    if (r < 0.18 && !player.hasShield) type = "shield";
    else if (r < 0.32 && bombs < 3) type = "bomb";
    else if (r < 0.45 && player.weaponLevel < 3) type = "weapon";

    items.push({
      x: Math.random() * (W - 60) + 30,
      y: -30,
      r: 16,
      type,
      vy: Math.random() * 1.5 + 2.0,
    });
  }

  // Engine Update (60fps)
  let lastTime = performance.now();

  function update(dt) {
    // Starfield scrolling
    stars.forEach((s) => {
      s.y += s.speed;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    });

    if (state !== "playing") return;

    // Timers
    if (invulnerableTimer > 0) invulnerableTimer -= dt;
    if (screenShake > 0) screenShake -= dt * 30;
    if (player.fireCooldown > 0) player.fireCooldown -= dt;

    stageTimer += dt;
    spawnTimer += dt;
    itemTimer += dt;
    warningTimer += dt;

    // Movement Controls
    if (keys["ArrowLeft"] || keys["a"] || keys["A"] || isPadLeft) {
      player.targetX -= 7;
    }
    if (keys["ArrowRight"] || keys["d"] || keys["D"] || isPadRight) {
      player.targetX += 7;
    }

    player.targetX = Math.max(player.r, Math.min(W - player.r, player.targetX));
    player.x += (player.targetX - player.x) * 0.22;

    // Auto-fire if holding Space/F
    if (keys[" "] || keys["f"] || keys["F"]) {
      fireBullet();
    }

    // Engine thruster particles
    if (Math.random() < 0.8) {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 12,
        y: player.y + 20,
        vx: (Math.random() - 0.5) * 1.2,
        vy: Math.random() * 3 + 3,
        r: Math.random() * 3 + 1,
        color: player.hasShield ? "#00f0ff" : "#ff9e00",
        life: 1,
        decay: 0.07,
      });
    }

    // Update Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      if (b.y < -20 || b.x < -20 || b.x > W + 20) {
        bullets.splice(i, 1);
        continue;
      }

      // Hit Boss
      if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < 45) {
        boss.hp--;
        addExplosion(b.x, b.y, "#ff9e00", 4);
        bullets.splice(i, 1);
        bossFillEl.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
        if (boss.hp <= 0) {
          destroyBoss();
          return;
        }
        continue;
      }

      // Hit Hazards
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
            addExplosion(h.x, h.y, "#ff5500", 14);
            hazards.splice(j, 1);
          }
          break;
        }
      }
      if (hit) bullets.splice(i, 1);
    }

    // Boss Mechanics
    if (boss) {
      if (boss.y < boss.targetY) boss.y += 2;
      boss.x += boss.vx;
      if (boss.x < 50 || boss.x > W - 50) boss.vx *= -1;

      boss.patternTimer += dt;
      if (boss.patternTimer > 1.2) {
        boss.patternTimer = 0;
        // Boss fires lasers
        hazards.push({
          x: boss.x - 20,
          y: boss.y + 30,
          r: 8,
          type: "mine",
          vy: 4.5,
          rot: 0,
          vRot: 0,
          hp: 1,
        });
        hazards.push({
          x: boss.x + 20,
          y: boss.y + 30,
          r: 8,
          type: "mine",
          vy: 4.5,
          rot: 0,
          vRot: 0,
          hp: 1,
        });
      }
    } else {
      // Regular Stage Spawning
      const spawnInterval = Math.max(0.3, 1.1 - stage * 0.02);
      if (spawnTimer > spawnInterval) {
        spawnTimer = 0;
        spawnHazard();
      }

      if (stage >= 3 && warningTimer > 6.0) {
        warningTimer = 0;
        spawnWarningLaser();
      }

      if (itemTimer > 3.0) {
        itemTimer = 0;
        spawnItem();
      }

      // Check Stage Clear (non-boss stage)
      if (stageTimer > stageDuration) {
        stageClear();
        return;
      }
    }

    // Warning Lasers Update
    for (let i = warnings.length - 1; i >= 0; i--) {
      const w = warnings[i];
      if (!w.active) {
        w.timer -= dt;
        if (w.timer <= 0) w.active = true;
      } else {
        w.duration -= dt;
        // Check Laser collision with player
        if (Math.abs(player.x - w.x) < 18) {
          playerHit();
        }
        if (w.duration <= 0) warnings.splice(i, 1);
      }
    }

    // Hazards Update & Collision
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

    // Items Update & Pickup
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy;

      if (Math.hypot(it.x - player.x, it.y - player.y) < it.r + player.r) {
        if (it.type === "star") {
          score += 500;
          playSound("star");
          addExplosion(it.x, it.y, "#ffd166", 10);
        } else if (it.type === "shield") {
          player.hasShield = true;
          playSound("star");
          addExplosion(it.x, it.y, "#00f0ff", 14);
        } else if (it.type === "bomb") {
          bombs = Math.min(3, bombs + 1);
          playSound("star");
          addExplosion(it.x, it.y, "#ff0055", 14);
        } else if (it.type === "weapon") {
          player.weaponLevel = Math.min(3, player.weaponLevel + 1);
          playSound("star");
          addExplosion(it.x, it.y, "#70e000", 14);
        }
        updateHUD();
        items.splice(i, 1);
      } else if (it.y > H + 40) {
        items.splice(i, 1);
      }
    }

    // Particles Update
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
      addExplosion(player.x, player.y, "#00f0ff", 20);
      updateHUD();
      return;
    }

    lives--;
    playSound("hit");
    screenShake = 15;
    addExplosion(player.x, player.y, "#ff0055", 30);
    invulnerableTimer = 1.8;
    updateHUD();

    if (lives <= 0) {
      gameOver();
    }
  }

  // Render Frame
  function render() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Apply Screen Shake
    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // Clear Canvas
    ctx.fillStyle = "#060911";
    ctx.fillRect(0, 0, W, H);

    // Render Starfield
    ctx.fillStyle = "#ffffff";
    stars.forEach((s) => {
      ctx.globalAlpha = s.alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Render Warning Lasers
    warnings.forEach((w) => {
      if (!w.active) {
        // Red warning line
        ctx.strokeStyle = "rgba(255, 0, 85, 0.4)";
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(w.x, 0);
        ctx.lineTo(w.x, H);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Active Laser Beam
        ctx.fillStyle = "rgba(255, 0, 85, 0.85)";
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 18;
        ctx.fillRect(w.x - 14, 0, 28, H);
      }
    });

    // Render Boss
    if (boss) {
      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.fillStyle = "#ff0055";
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 20;

      // Boss Body Polygon
      ctx.beginPath();
      ctx.moveTo(0, 35);
      ctx.lineTo(-45, -20);
      ctx.lineTo(-20, -35);
      ctx.lineTo(20, -35);
      ctx.lineTo(45, -20);
      ctx.closePath();
      ctx.fill();

      // Boss Core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Hazards
    hazards.forEach((h) => {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);

      if (h.type === "mine") {
        ctx.fillStyle = "#ff0055";
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, h.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, h.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Meteor
        ctx.fillStyle = "#e07a5f";
        ctx.shadowColor = "#f4a261";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const rad = h.r * (0.8 + (i % 2 === 0 ? 0.25 : 0.05));
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    // Render Bullets
    bullets.forEach((b) => {
      ctx.fillStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render Items
    items.forEach((it) => {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (it.type === "star") ctx.fillText("⭐", 0, 0);
      else if (it.type === "shield") ctx.fillText("🛡️", 0, 0);
      else if (it.type === "bomb") ctx.fillText("💣", 0, 0);
      else if (it.type === "weapon") ctx.fillText("⚡", 0, 0);
      ctx.restore();
    });

    // Render Particles
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Render Player Starcraft
    if (state === "playing" && (invulnerableTimer <= 0 || Math.floor(Date.now() / 80) % 2 === 0)) {
      ctx.save();
      ctx.translate(player.x, player.y);

      // Shield Aura
      if (player.hasShield) {
        ctx.strokeStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 18;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, player.r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Starcraft Ship
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#00f0ff";

      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(-24, 18);
      ctx.lineTo(-10, 12);
      ctx.lineTo(0, 16);
      ctx.lineTo(10, 12);
      ctx.lineTo(24, 18);
      ctx.closePath();
      ctx.fill();

      // Cockpit Window
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, -6, 5, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (!window.TodayPause || !window.TodayPause.isPaused()) {
      update(dt);
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Game Flow Controls
  function startGame() {
    getAudioCtx();
    stage = 1;
    score = 0;
    lives = 3;
    bombs = 2;
    player.weaponLevel = 1;
    player.hasShield = false;
    player.x = W / 2;
    player.targetX = W / 2;

    state = "playing";
    titleOverlay.classList.add("hidden");
    clearOverlay.classList.add("hidden");
    overOverlay.classList.add("hidden");

    setupStage();
  }

  function stageClear() {
    state = "clear";
    playSound("star");

    if (stage >= MAX_STAGE) {
      clearTitle.textContent = "🏆 전 은하 제압!";
      clearDetail.textContent = `축하합니다! 50스테이지 완파!\n최종 점수: ${score.toLocaleString("ko-KR")}점`;
      nextBtn.textContent = "처음부터";
    } else {
      clearTitle.textContent = `STAGE ${stage} CLEAR!`;
      clearDetail.textContent = `점수: ${score.toLocaleString("ko-KR")}점 · 다음 구역 진입`;
      nextBtn.textContent = "다음 스테이지";
    }
    clearOverlay.classList.remove("hidden");
  }

  function nextStage() {
    if (stage >= MAX_STAGE) {
      startGame();
      return;
    }
    stage++;
    state = "playing";
    clearOverlay.classList.add("hidden");
    setupStage();
  }

  function gameOver() {
    state = "over";
    overDetail.textContent = `STAGE ${stage} · 최종 점수: ${score.toLocaleString("ko-KR")}점`;
    overOverlay.classList.remove("hidden");

    if (window.TodayGameRank) {
      window.TodayGameRank.mount({
        gameId: GAME_ID,
        gameTitle: GAME_TITLE,
        formParent: rankContainer,
      });
      window.TodayGameRank.open(score, { label: `Stage ${stage} (${score.toLocaleString("ko-KR")}점)` });
    }
  }

  startBtn.addEventListener("click", startGame);
  nextBtn.addEventListener("click", nextStage);
  retryBtn.addEventListener("click", startGame);

  // Initialize Pause System
  if (window.TodayPause) {
    window.TodayPause.init({
      gameTitle: GAME_TITLE,
      onPause() {},
      onResume() {},
    });
  }
})();
