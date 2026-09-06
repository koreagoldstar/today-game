(() => {
  "use strict";

  const GAME_ID = "zombie-run";
  const GAME_TITLE = "좀비런 (지혁 제작)";

  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // High-Res Scrolling Background
  const bgImg = new Image();
  bgImg.src = "assets/bg.jpg";
  let bgScrollY = 0;

  // Real Full Body Standing 3D Sprites
  const sprites = {
    hero_chick: null,
    hero_rabbit: null,
    hero_bear: null,
    hero_bird: null,
    tank: null,
    chopper: null,
    zombie: null,
    boss: null,
  };

  function isReady(img) {
    if (!img) return false;
    if (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) return true;
    return Boolean(img.complete && (img.naturalWidth > 0 || img.width > 0));
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  Promise.all([
    loadImg("assets/hero_chick.png"),
    loadImg("assets/hero_rabbit.png"),
    loadImg("assets/hero_bear.png"),
    loadImg("assets/hero_bird.png"),
    loadImg("assets/tank.png"),
    loadImg("assets/chopper.png"),
    loadImg("assets/zombie.png"),
    loadImg("assets/boss.png"),
  ]).then(([chick, rabbit, bear, bird, tank, chopper, zombie, boss]) => {
    sprites.hero_chick = chick;
    sprites.hero_rabbit = rabbit;
    sprites.hero_bear = bear;
    sprites.hero_bird = bird;
    sprites.tank = tank;
    sprites.chopper = chopper;
    sprites.zombie = zombie;
    sprites.boss = boss;
  });

  // HUD & UI Elements
  const hudStage = document.getElementById("hud-stage");
  const hudScore = document.getElementById("hud-score");
  const hudHp = document.getElementById("hud-hp");
  const hudCoin = document.getElementById("hud-coin");
  const distFill = document.getElementById("dist-fill");

  const vehicleBar = document.getElementById("vehicle-bar");
  const vNameEl = document.getElementById("v-name");
  const vHpTextEl = document.getElementById("v-hp-text");
  const vFillEl = document.getElementById("v-fill");

  const titleOverlay = document.getElementById("title");
  const shopOverlay = document.getElementById("shop");
  const clearOverlay = document.getElementById("clear");
  const overOverlay = document.getElementById("over");
  const clearTitle = document.getElementById("clear-title");
  const clearDetail = document.getElementById("clear-detail");
  const overDetail = document.getElementById("over-detail");

  const startBtn = document.getElementById("start-btn");
  const shopBtn = document.getElementById("shop-btn");
  const shopCloseBtn = document.getElementById("shop-close-btn");
  const nextBtn = document.getElementById("next-btn");
  const retryBtn = document.getElementById("retry-btn");

  const buyDmgBtn = document.getElementById("buy-dmg");
  const buyRateBtn = document.getElementById("buy-rate");
  const buyMissileBtn = document.getElementById("buy-missile");
  const buyEvoBtn = document.getElementById("buy-evo");

  const heroCards = document.querySelectorAll(".hero-card");

  // Web Audio Synth Engine
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
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(130, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "cannon") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.35);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "hit") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "coin") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === "vehicle") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (_) {}
  }

  // Canvas Resolution
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

  // Hero Definitions & Growth
  const HERO_DEFS = {
    chick: {
      name: "병아리",
      babyName: "아기 병아리",
      adultName: "메카 파이팅 로스터",
      color: "#ffd166",
      accent: "#ff9e00",
      speed: 380,
      spriteKey: "hero_chick",
      emoji: "🐣",
    },
    rabbit: {
      name: "새끼토끼",
      babyName: "아기 토끼",
      adultName: "사이버 버니 가디언",
      color: "#00f0ff",
      accent: "#0088cc",
      speed: 420,
      spriteKey: "hero_rabbit",
      emoji: "🐰",
    },
    bear: {
      name: "새끼곰",
      babyName: "아기 곰",
      adultName: "그리즐리 파워 타이탄",
      color: "#ff9e00",
      accent: "#b56576",
      speed: 350,
      spriteKey: "hero_bear",
      emoji: "🐻",
    },
    bird: {
      name: "새끼새",
      babyName: "아기 파랑새",
      adultName: "스톰 에메랄드 팔콘",
      color: "#55efc4",
      accent: "#00b894",
      speed: 400,
      spriteKey: "hero_bird",
      emoji: "🐦",
    },
  };

  // Game Engine State
  let state = "title"; // "title", "playing", "shop", "paused", "clear", "over"
  let selectedHeroKey = "chick";
  let stage = 1;
  const MAX_STAGE = 50;
  let score = 0;
  let coins = 0;
  let stageDist = 0;
  const STAGE_MAX_DIST = 2400;
  let screenShake = 0;

  // Player Stats & Upgrades
  let upgrades = {
    dmgLv: 1,
    rateLv: 1,
    missileLv: 1,
    evoLv: 1,
  };

  const player = {
    x: W / 2,
    y: H - 140,
    r: 26,
    hp: 100,
    maxHp: 100,
    fireCd: 0,
    missileCd: 0,
    tilt: 0,
    runCycle: 0,
    vehicle: null,
  };

  // Input Tracking
  let touchX = W / 2;
  let touchY = H - 140;
  let isPointerDown = false;
  const keys = {};
  let isPadLeft = false;
  let isPadRight = false;

  // Game Objects
  let bullets = [];
  let missiles = [];
  let zombies = [];
  let vehiclePickups = [];
  let coinPickups = [];
  let particles = [];
  let floats = [];
  let boss = null;

  // Touch Input Bindings
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
    if (target && target.classList && (target.classList.contains("pad") || target.classList.contains("fire") || target.classList.contains("btn"))) {
      return;
    }
    isPointerDown = true;
    const pos = getPosFromEvent(e);
    touchX = pos.x;
    touchY = pos.y - 30;
  }

  function handleTouchMove(e) {
    if (state !== "playing" || !isPointerDown) return;
    const pos = getPosFromEvent(e);
    touchX = pos.x;
    touchY = pos.y - 30;
  }

  function handleTouchEnd() {
    isPointerDown = false;
  }

  const stageEl = document.querySelector(".stage") || canvas;

  stageEl.addEventListener("pointerdown", handleTouchStart);
  stageEl.addEventListener("pointermove", handleTouchMove);
  window.addEventListener("pointerup", handleTouchEnd);
  window.addEventListener("pointercancel", handleTouchEnd);

  stageEl.addEventListener("touchstart", (e) => { handleTouchStart(e); }, { passive: true });
  stageEl.addEventListener("touchmove", (e) => { handleTouchMove(e); }, { passive: true });
  window.addEventListener("touchend", handleTouchEnd);

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (state === "playing") {
      if (e.key === " " || e.key === "f" || e.key === "F") fireLaser();
      if (e.key === "m" || e.key === "M") fireMissile();
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  // Hero Selection UI Binding
  heroCards.forEach((card) => {
    card.addEventListener("click", () => {
      heroCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      selectedHeroKey = card.getAttribute("data-hero") || "chick";
    });
  });

  // Touch Pad Controls Binding
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

  const leftBtn = document.getElementById("left-btn");
  const rightBtn = document.getElementById("right-btn");
  const fireBtn = document.getElementById("fire-btn");
  const missileBtn = document.getElementById("missile-btn");

  bindPad(leftBtn, () => { isPadLeft = true; }, () => { isPadLeft = false; });
  bindPad(rightBtn, () => { isPadRight = true; }, () => { isPadRight = false; });
  bindPad(fireBtn, () => { fireLaser(); }, () => {});
  bindPad(missileBtn, () => { fireMissile(); }, () => {});

  function fireLaser() {
    if (state !== "playing" || player.fireCd > 0) return;

    const baseRate = 0.18 - (upgrades.rateLv - 1) * 0.02;
    player.fireCd = player.vehicle ? baseRate * 0.7 : baseRate;

    playSound(player.vehicle?.type === "tank" ? "cannon" : "laser");

    const dmg = (15 + upgrades.dmgLv * 4) * (player.vehicle ? 1.8 : 1);

    if (player.vehicle?.type === "tank") {
      bullets.push({ x: player.x - 16, y: player.y - 35, vx: 0, vy: -16, r: 8, dmg, type: "tank_shell" });
      bullets.push({ x: player.x + 16, y: player.y - 35, vx: 0, vy: -16, r: 8, dmg, type: "tank_shell" });
    } else if (player.vehicle?.type === "chopper") {
      bullets.push({ x: player.x - 22, y: player.y - 30, vx: -2, vy: -17, r: 6, dmg, type: "laser" });
      bullets.push({ x: player.x, y: player.y - 35, vx: 0, vy: -18, r: 6, dmg, type: "laser" });
      bullets.push({ x: player.x + 22, y: player.y - 30, vx: 2, vy: -17, r: 6, dmg, type: "laser" });
    } else {
      if (upgrades.evoLv >= 3) {
        bullets.push({ x: player.x - 12, y: player.y - 28, vx: -1.5, vy: -15, r: 6, dmg, type: "laser" });
        bullets.push({ x: player.x + 12, y: player.y - 28, vx: 1.5, vy: -15, r: 6, dmg, type: "laser" });
      } else {
        bullets.push({ x: player.x, y: player.y - 28, vx: 0, vy: -15, r: 6, dmg, type: "laser" });
      }
    }
  }

  function fireMissile() {
    if (state !== "playing" || player.missileCd > 0) return;

    player.missileCd = 1.2;
    playSound("cannon");

    const splashR = 50 + upgrades.missileLv * 15;
    const dmg = 45 + upgrades.missileLv * 15;

    missiles.push({
      x: player.x,
      y: player.y - 30,
      vy: -13,
      r: 10,
      dmg,
      splashR,
    });
  }

  function addExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 7 + 2;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: Math.random() * 5 + 2,
        color,
        life: 1,
        decay: Math.random() * 0.05 + 0.02,
      });
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color: color || "#ffd166", life: 1, vy: -40 });
  }

  function updateHUD() {
    if (hudStage) hudStage.textContent = stage;
    if (hudScore) hudScore.textContent = score.toLocaleString("ko-KR");
    if (hudHp) hudHp.textContent = `${Math.max(0, Math.floor(player.hp))}%`;
    if (hudCoin) hudCoin.textContent = coins.toLocaleString("ko-KR");

    if (distFill) distFill.style.width = `${Math.min(100, (stageDist / STAGE_MAX_DIST) * 100)}%`;

    if (player.vehicle) {
      if (vehicleBar) vehicleBar.classList.remove("hidden");
      if (vNameEl) vNameEl.textContent = player.vehicle.type === "tank" ? "🚜 대형 파괴 탱크" : "🚁 미사일 공격 헬기";
      const pct = Math.max(0, Math.floor((player.vehicle.hp / player.vehicle.maxHp) * 100));
      if (vHpTextEl) vHpTextEl.textContent = `내구도 ${pct}%`;
      if (vFillEl) vFillEl.style.width = `${pct}%`;
    } else {
      if (vehicleBar) vehicleBar.classList.add("hidden");
    }
  }

  function spawnZombie() {
    const isMutant = Math.random() < 0.25 + stage * 0.01;
    const r = isMutant ? 28 : 20;
    const hp = (isMutant ? 60 : 25) * (1 + stage * 0.08);

    zombies.push({
      x: Math.random() * (W - 60) + 30,
      y: -35,
      r,
      hp,
      maxHp: hp,
      vy: Math.random() * 1.5 + 2.0 + stage * 0.03,
      isMutant,
      walkCycle: Math.random() * Math.PI * 2,
      hitFlash: 0,
    });
  }

  function spawnVehiclePickup() {
    const type = Math.random() < 0.5 ? "tank" : "chopper";
    vehiclePickups.push({
      x: Math.random() * (W - 80) + 40,
      y: -40,
      r: 24,
      type,
      vy: 2.2,
    });
  }

  function spawnBoss() {
    const maxHp = 400 + stage * 120;
    boss = {
      x: W / 2,
      y: -80,
      targetY: 110,
      r: 54,
      hp: maxHp,
      maxHp: maxHp,
      vx: 2.2,
      patternTimer: 0,
      name: `STAGE ${stage} 킹 좀비 거함`,
    };
    playSound("vehicle");
  }

  let spawnTimer = 0;
  let vehicleTimer = 0;

  function setupStage() {
    stageDist = 0;
    spawnTimer = 0;
    vehicleTimer = 0;
    bullets = [];
    missiles = [];
    zombies = [];
    vehiclePickups = [];
    coinPickups = [];
    particles = [];
    floats = [];
    boss = null;

    if (stage % 5 === 0) {
      spawnBoss();
    }
    updateHUD();
  }

  function update(dt) {
    bgScrollY = (bgScrollY + dt * 60) % H;

    if (state !== "playing") return;

    if (screenShake > 0) screenShake -= dt * 25;
    if (player.fireCd > 0) player.fireCd -= dt;
    if (player.missileCd > 0) player.missileCd -= dt;

    if (!boss) stageDist += dt * 110;

    spawnTimer += dt;
    vehicleTimer += dt;

    // Movement Interpolation
    let kbX = 0;
    let kbY = 0;
    const heroDef = HERO_DEFS[selectedHeroKey] || HERO_DEFS.chick;
    const speed = heroDef.speed;

    if (keys["ArrowLeft"] || keys["a"] || keys["A"] || isPadLeft) kbX -= speed * dt;
    if (keys["ArrowRight"] || keys["d"] || keys["D"] || isPadRight) kbX += speed * dt;
    if (keys["ArrowUp"] || keys["w"] || keys["W"]) kbY -= speed * dt;
    if (keys["ArrowDown"] || keys["s"] || keys["S"]) kbY += speed * dt;

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
      const step = Math.min(dist, speed * dt);
      player.x += (dx / dist) * step;
      player.y += (dy / dist) * step;
      player.tilt = (dx / dist) * Math.min(1, dist / 35) * 0.3;
    } else {
      player.tilt *= 0.8;
    }

    // Auto Fire when touching screen or holding keys
    if (isPointerDown || keys[" "] || keys["f"] || keys["F"]) {
      fireLaser();
    }

    // Bullets Physics & Collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      if (b.y < -20) {
        bullets.splice(i, 1);
        continue;
      }

      if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < b.r + boss.r) {
        boss.hp -= b.dmg;
        addExplosion(b.x, b.y, "#ffd166", 4);
        bullets.splice(i, 1);
        if (boss.hp <= 0) destroyBoss();
        continue;
      }

      let hit = false;
      for (let j = zombies.length - 1; j >= 0; j--) {
        const z = zombies[j];
        if (Math.hypot(b.x - z.x, b.y - z.y) < b.r + z.r) {
          z.hp -= b.dmg;
          z.hitFlash = 0.1;
          hit = true;
          addExplosion(b.x, b.y, "#00f0ff", 5);
          if (z.hp <= 0) {
            score += z.isMutant ? 150 : 60;
            coins += z.isMutant ? 5 : 2;
            playSound("hit");
            addExplosion(z.x, z.y, "#ff0055", 18);
            zombies.splice(j, 1);
          }
          break;
        }
      }
      if (hit) bullets.splice(i, 1);
    }

    // Homing Missiles
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.y += m.vy;

      if (m.y < -30) {
        missiles.splice(i, 1);
        continue;
      }

      let exploded = false;
      for (let j = zombies.length - 1; j >= 0; j--) {
        const z = zombies[j];
        if (Math.hypot(m.x - z.x, m.y - z.y) < m.r + z.r) {
          exploded = true;
          break;
        }
      }

      if (boss && Math.hypot(m.x - boss.x, m.y - boss.y) < m.r + boss.r) exploded = true;

      if (exploded) {
        playSound("cannon");
        screenShake = 14;
        addExplosion(m.x, m.y, "#ff9e00", 30);

        if (boss && Math.hypot(m.x - boss.x, m.y - boss.y) <= m.splashR) {
          boss.hp -= m.dmg * 1.5;
          if (boss.hp <= 0) destroyBoss();
        }

        for (let j = zombies.length - 1; j >= 0; j--) {
          const z = zombies[j];
          if (Math.hypot(m.x - z.x, m.y - z.y) <= m.splashR) {
            z.hp -= m.dmg;
            z.hitFlash = 0.15;
            if (z.hp <= 0) {
              score += 120;
              coins += 4;
              zombies.splice(j, 1);
            }
          }
        }
        missiles.splice(i, 1);
      }
    }

    // Vehicle Pickups
    for (let i = vehiclePickups.length - 1; i >= 0; i--) {
      const vp = vehiclePickups[i];
      vp.y += vp.vy;

      if (Math.hypot(vp.x - player.x, vp.y - player.y) < vp.r + player.r) {
        player.vehicle = {
          type: vp.type,
          hp: vp.type === "tank" ? 150 : 120,
          maxHp: vp.type === "tank" ? 150 : 120,
        };
        playSound("vehicle");
        addFloat(player.x, player.y - 30, vp.type === "tank" ? "🚜 탱크 탑승!" : "🚁 헬기 탑승!", "#00f0ff");
        addExplosion(player.x, player.y, "#00f0ff", 20);
        vehiclePickups.splice(i, 1);
        updateHUD();
      } else if (vp.y > H + 40) {
        vehiclePickups.splice(i, 1);
      }
    }

    // Zombie Spawning & Behavior
    if (boss) {
      if (boss.y < boss.targetY) boss.y += 2;
      boss.x += boss.vx;
      if (boss.x < 60 || boss.x > W - 60) boss.vx *= -1;

      boss.patternTimer += dt;
      if (boss.patternTimer > 1.2) {
        boss.patternTimer = 0;
        zombies.push({ x: boss.x - 20, y: boss.y + 35, r: 20, hp: 30, maxHp: 30, vy: 3.5, isMutant: false, walkCycle: 0, hitFlash: 0 });
        zombies.push({ x: boss.x + 20, y: boss.y + 35, r: 20, hp: 30, maxHp: 30, vy: 3.5, isMutant: false, walkCycle: 0, hitFlash: 0 });
      }
    } else {
      const spawnInterval = Math.max(0.3, 1.1 - stage * 0.015);
      if (spawnTimer > spawnInterval) {
        spawnTimer = 0;
        spawnZombie();
      }

      if (vehicleTimer > 14 && !player.vehicle && Math.random() < 0.4) {
        vehicleTimer = 0;
        spawnVehiclePickup();
      }

      if (stageDist >= STAGE_MAX_DIST) {
        stageClear();
        return;
      }
    }

    // Zombie Movement & Player Collision
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      z.y += z.vy;
      z.walkCycle = (z.walkCycle || 0) + dt * 10;
      if (z.hitFlash > 0) z.hitFlash -= dt;

      if (Math.hypot(z.x - player.x, z.y - player.y) < z.r + player.r - 4) {
        playerHit(z.isMutant ? 25 : 12);
        zombies.splice(i, 1);
      } else if (z.y > H + 40) {
        zombies.splice(i, 1);
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

  function playerHit(dmg) {
    playSound("hit");
    screenShake = 12;

    if (player.vehicle) {
      player.vehicle.hp -= dmg;
      addExplosion(player.x, player.y, "#ff9e00", 14);
      if (player.vehicle.hp <= 0) {
        addFloat(player.x, player.y - 30, "💥 탈것 파괴!", "#ff0055");
        addExplosion(player.x, player.y, "#ff0055", 35);
        player.vehicle = null;
      }
      updateHUD();
      return;
    }

    player.hp -= dmg;
    addExplosion(player.x, player.y, "#ff0055", 22);
    updateHUD();

    if (player.hp <= 0) {
      gameOver();
    }
  }

  function destroyBoss() {
    playSound("cannon");
    addExplosion(boss.x, boss.y, "#ff0055", 50);
    addExplosion(boss.x - 30, boss.y, "#ffd166", 30);
    addExplosion(boss.x + 30, boss.y, "#00f0ff", 30);
    score += 3000 + stage * 500;
    coins += 50;
    boss = null;
    stageClear();
  }

  function stageClear() {
    state = "clear";
    playSound("coin");

    if (stage >= MAX_STAGE) {
      if (clearTitle) clearTitle.textContent = "🏆 좀비 군단 완전 소탕!";
      if (clearDetail) clearDetail.textContent = `축하합니다! 50스테이지 완파!\n최종 점수: ${score.toLocaleString("ko-KR")}점`;
      if (nextBtn) nextBtn.textContent = "처음부터";
    } else {
      if (clearTitle) clearTitle.textContent = `STAGE ${stage} CLEAR!`;
      if (clearDetail) clearDetail.textContent = `점수: ${score.toLocaleString("ko-KR")}점 · 코인 +${coins}🪙`;
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
      window.TodayGameRank.mount({ gameId: GAME_ID, gameTitle: GAME_TITLE, formParent: overOverlay });
      window.TodayGameRank.open(score);
    }
  }

  function startGame() {
    getAudioCtx();
    stage = 1;
    score = 0;
    player.hp = 100;
    player.vehicle = null;
    player.x = W / 2;
    player.y = H - 140;

    state = "playing";
    if (titleOverlay) titleOverlay.classList.add("hidden");
    if (shopOverlay) shopOverlay.classList.add("hidden");
    if (clearOverlay) clearOverlay.classList.add("hidden");
    if (overOverlay) overOverlay.classList.add("hidden");

    setupStage();
  }

  // Shop System Upgrades
  function updateShopUI() {
    const costDmg = 100 * upgrades.dmgLv;
    const costRate = 150 * upgrades.rateLv;
    const costMissile = 200 * upgrades.missileLv;
    const costEvo = 300 * upgrades.evoLv;

    const elDmg = document.getElementById("cost-dmg");
    const elRate = document.getElementById("cost-rate");
    const elMissile = document.getElementById("cost-missile");
    const elEvo = document.getElementById("cost-evo");

    if (elDmg) elDmg.textContent = costDmg;
    if (elRate) elRate.textContent = costRate;
    if (elMissile) elMissile.textContent = costMissile;
    if (elEvo) elEvo.textContent = costEvo;

    if (buyDmgBtn) buyDmgBtn.disabled = coins < costDmg;
    if (buyRateBtn) buyRateBtn.disabled = coins < costRate;
    if (buyMissileBtn) buyMissileBtn.disabled = coins < costMissile;
    if (buyEvoBtn) buyEvoBtn.disabled = coins < costEvo;
  }

  if (buyDmgBtn) {
    buyDmgBtn.addEventListener("click", () => {
      const cost = 100 * upgrades.dmgLv;
      if (coins >= cost) {
        coins -= cost;
        upgrades.dmgLv++;
        playSound("coin");
        updateShopUI();
        updateHUD();
      }
    });
  }

  if (buyRateBtn) {
    buyRateBtn.addEventListener("click", () => {
      const cost = 150 * upgrades.rateLv;
      if (coins >= cost) {
        coins -= cost;
        upgrades.rateLv++;
        playSound("coin");
        updateShopUI();
        updateHUD();
      }
    });
  }

  if (buyMissileBtn) {
    buyMissileBtn.addEventListener("click", () => {
      const cost = 200 * upgrades.missileLv;
      if (coins >= cost) {
        coins -= cost;
        upgrades.missileLv++;
        playSound("coin");
        updateShopUI();
        updateHUD();
      }
    });
  }

  if (buyEvoBtn) {
    buyEvoBtn.addEventListener("click", () => {
      const cost = 300 * upgrades.evoLv;
      if (coins >= cost) {
        coins -= cost;
        upgrades.evoLv++;
        playSound("coin");
        updateShopUI();
        updateHUD();
      }
    });
  }

  if (shopBtn) {
    shopBtn.addEventListener("click", () => {
      updateShopUI();
      if (shopOverlay) shopOverlay.classList.remove("hidden");
    });
  }

  if (shopCloseBtn) {
    shopCloseBtn.addEventListener("click", () => {
      if (shopOverlay) shopOverlay.classList.add("hidden");
    });
  }

  // Ultra-High Definition 3D Standing Character Renderer
  function render() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // High-Res Scrolling Background
    if (isReady(bgImg)) {
      ctx.drawImage(bgImg, 0, bgScrollY, W, H);
      ctx.drawImage(bgImg, 0, bgScrollY - H, W, H);
      ctx.fillStyle = "rgba(5, 8, 17, 0.35)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "#0c1626";
      ctx.fillRect(0, 0, W, H);
    }

    // 1. Vehicle Drop Pickups (Tank / Chopper)
    vehiclePickups.forEach((vp) => {
      ctx.save();
      ctx.translate(vp.x, vp.y);

      ctx.fillStyle = "rgba(0, 240, 255, 0.28)";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, vp.r + 8, 0, Math.PI * 2);
      ctx.fill();

      const vSprite = vp.type === "tank" ? sprites.tank : sprites.chopper;
      if (isReady(vSprite)) {
        ctx.drawImage(vSprite, -vp.r * 1.5, -vp.r * 1.5, vp.r * 3, vp.r * 3);
      } else {
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(vp.type === "tank" ? "🚜" : "🚁", 0, 0);
      }
      ctx.restore();
    });

    // 2. Zombies & Boss Full Standing Body Render with Animated Walking Stride
    zombies.forEach((z) => {
      ctx.save();
      ctx.translate(z.x, z.y);

      // Walking Stride Rotation & Body Step Bobbing
      const walkTilt = Math.sin(z.walkCycle || 0) * 0.14;
      const walkBob = Math.cos((z.walkCycle || 0) * 2) * 3;
      ctx.rotate(walkTilt);
      ctx.translate(0, walkBob);

      ctx.shadowColor = z.isMutant ? "#ff0055" : "#00b894";
      ctx.shadowBlur = 18;

      if (z.hitFlash > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        ctx.ellipse(0, 0, z.r * 1.2, z.r * 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isReady(sprites.zombie)) {
        const sz = z.r * 3.0; // 1:1 ratio for clean standing body silhouette
        ctx.drawImage(sprites.zombie, -sz / 2, -sz / 2, sz, sz);
      } else {
        ctx.fillStyle = z.isMutant ? "#ff0055" : "#00b894";
        ctx.beginPath();
        ctx.ellipse(0, 0, z.r * 0.9, z.r * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(z.isMutant ? "🧟‍♂️" : "🧟", 0, 0);
      }

      ctx.restore();
    });

    if (boss) {
      ctx.save();
      ctx.translate(boss.x, boss.y);
      const bossBob = Math.sin(Date.now() / 200) * 4;
      ctx.translate(0, bossBob);

      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 32;

      if (isReady(sprites.boss)) {
        const bsz = boss.r * 3.4;
        ctx.drawImage(sprites.boss, -bsz / 2, -bsz / 2, bsz, bsz);
      } else {
        ctx.fillStyle = "#ff0055";
        ctx.beginPath();
        ctx.ellipse(0, 0, boss.r, boss.r * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "40px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("👑", 0, 0);
      }

      ctx.restore();
    }

    // 3. Laser Bullets & Homing Missiles
    bullets.forEach((b) => {
      ctx.fillStyle = b.type === "tank_shell" ? "#ff9e00" : "#00f0ff";
      ctx.shadowColor = b.type === "tank_shell" ? "#ff9e00" : "#00f0ff";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    missiles.forEach((m) => {
      ctx.fillStyle = "#ff0055";
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Particles
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 5. Floating Score Text
    floats.forEach((f) => {
      ctx.font = 'bold 16px "Jua", sans-serif';
      ctx.fillStyle = f.color;
      ctx.textAlign = "center";
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    // 6. Player Hero & Boarded Vehicles 3D Render
    if (state === "playing" || state === "title") {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.tilt || 0);

      const heroDef = HERO_DEFS[selectedHeroKey] || HERO_DEFS.chick;
      const heroSprite = sprites[heroDef.spriteKey];

      player.runCycle = (player.runCycle || 0) + 0.15;
      const runBob = Math.sin(player.runCycle) * 3;

      if (player.vehicle) {
        const vSprite = player.vehicle.type === "tank" ? sprites.tank : sprites.chopper;
        ctx.shadowColor = player.vehicle.type === "tank" ? "#ff9e00" : "#00f0ff";
        ctx.shadowBlur = 24;

        if (isReady(vSprite)) {
          const vsz = player.r * 3.6;
          ctx.drawImage(vSprite, -vsz / 2, -vsz / 2, vsz, vsz);
        } else {
          ctx.font = "46px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(player.vehicle.type === "tank" ? "🚜" : "🚁", 0, 0);
        }

        // Draw Hero Mounted on Vehicle
        if (isReady(heroSprite)) {
          const hszw = player.r * 1.8;
          const hszh = player.r * 2.2;
          ctx.drawImage(heroSprite, -hszw / 2, -hszh * 0.85 + runBob, hszw, hszh);
        }
      } else {
        // Hero On Foot with Running Stride
        ctx.shadowColor = heroDef.color;
        ctx.shadowBlur = 20;

        ctx.translate(0, runBob);

        if (isReady(heroSprite)) {
          const sz = (player.r * 3.0) * (1 + (upgrades.evoLv - 1) * 0.15);
          ctx.drawImage(heroSprite, -sz / 2, -sz / 2, sz, sz);
        } else {
          ctx.fillStyle = heroDef.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, player.r, player.r * 1.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "30px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(heroDef.emoji, 0, 0);
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  let lastTime = performance.now();

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
