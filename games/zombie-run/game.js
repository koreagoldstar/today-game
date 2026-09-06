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

  const SPRITE_FRAMES = 4;
  const ASSET_V = "14";
  let spritesReady = false;
  let animTime = 0;

  // High-quality sprite sheets (4-frame walk cycles, 512px per frame)
  const sprites = {
    hero_chick: null,
    hero_rabbit: null,
    hero_bear: null,
    hero_bird: null,
    tank: null,
    chopper: null,
    zombie: null,
    zombie_mutant: null,
    boss: null,
  };

  function isReady(img) {
    if (!img) return false;
    if (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) return true;
    return Boolean(img.complete && (img.naturalWidth > 0 || img.width > 0));
  }

  function getAnimFrame(cycle, frameCount = SPRITE_FRAMES) {
    return Math.abs(Math.floor(cycle || 0)) % frameCount;
  }

  function drawGroundShadow(width, yOffset) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, yOffset, width * 0.42, width * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSpriteWithFlash(img, frameIndex, frameCount, dx, dy, dw, dh, flash) {
    const ok = drawSpriteSheet(img, frameIndex, frameCount, dx, dy, dw, dh);
    if (ok && flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(0.75, flash * 5);
      drawSpriteSheet(img, frameIndex, frameCount, dx, dy, dw, dh);
      ctx.restore();
    }
    return ok;
  }

  function drawVehicleSprite(type, frameIndex, size, hoverY) {
    const img = type === "tank" ? sprites.tank : sprites.chopper;
    const hy = hoverY || 0;
    drawGroundShadow(size, size * 0.38);
    return drawSpriteSheet(img, frameIndex, SPRITE_FRAMES, -size / 2, -size / 2 + hy, size, size);
  }

  function drawSpriteSheet(img, frameIndex, frameCount, dx, dy, dw, dh) {
    if (!isReady(img)) return false;
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    const fw = nw / frameCount;
    const sx = Math.floor(frameIndex * fw);
    const sw = Math.ceil(fw);
    ctx.imageSmoothingEnabled = true;
    if (typeof ctx.imageSmoothingQuality !== "undefined") {
      ctx.imageSmoothingQuality = "high";
    }
    ctx.drawImage(img, sx, 0, sw, nh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    return true;
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `${src}?v=${ASSET_V}`;
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
    loadImg("assets/zombie_mutant.png"),
    loadImg("assets/boss.png"),
  ]).then(([chick, rabbit, bear, bird, tank, chopper, zombie, zombieMutant, boss]) => {
    sprites.hero_chick = chick;
    sprites.hero_rabbit = rabbit;
    sprites.hero_bear = bear;
    sprites.hero_bird = bird;
    sprites.tank = tank;
    sprites.chopper = chopper;
    sprites.zombie = zombie;
    sprites.zombie_mutant = zombieMutant;
    sprites.boss = boss;
    spritesReady = Boolean(chick && rabbit && bear && bird && zombie && zombieMutant && boss);
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
  const bossBar = document.getElementById("boss-bar");
  const bossNameEl = document.getElementById("boss-name");
  const bossHpTextEl = document.getElementById("boss-hp-text");
  const bossFillEl = document.getElementById("boss-fill");

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
  const hudShopBtn = document.getElementById("hud-shop-btn");
  const clearShopBtn = document.getElementById("clear-shop-btn");
  const overShopBtn = document.getElementById("over-shop-btn");
  let shopReturnState = "title";
  const nextBtn = document.getElementById("next-btn");
  const retryBtn = document.getElementById("retry-btn");

  function hideAllOverlays() {
    if (titleOverlay) titleOverlay.classList.add("hidden");
    if (shopOverlay) shopOverlay.classList.add("hidden");
    if (clearOverlay) clearOverlay.classList.add("hidden");
    if (overOverlay) overOverlay.classList.add("hidden");
  }

  function showOverlayForState(targetState) {
    hideAllOverlays();
    if (targetState === "title" && titleOverlay) titleOverlay.classList.remove("hidden");
    else if (targetState === "clear" && clearOverlay) clearOverlay.classList.remove("hidden");
    else if (targetState === "over" && overOverlay) overOverlay.classList.remove("hidden");
  }

  function resumeGameplayClock() {
    lastTime = performance.now();
  }

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
      } else if (type === "explosion") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const filter = ac.createBiquadFilter();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.55);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.linearRampToValueAtTime(80, now + 0.55);
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (type === "missile_launch") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.18);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.18);
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
  const STAGE_BASE_DIST = 5200;
  let bossArming = false;
  let bossSpawnTimerId = null;
  let screenShake = 0;
  let lastTime = performance.now();

  const MISSILE_MAX = 3;
  const MISSILE_START = 2;
  let missileAmmo = MISSILE_START;
  let stageMissileSpawned = false;

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
    tilt: 0,
    runCycle: 0,
    vehicle: null,
    vehicleAnim: 0,
    recoil: 0,
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
  let missilePickups = [];
  let coinPickups = [];
  let particles = [];
  let explosions = [];
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
    if (player.vehicle?.type === "tank") player.recoil = 1;

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

  function applyMissileBlast(m) {
    const dmg = m.dmg;

    for (let j = zombies.length - 1; j >= 0; j--) {
      const z = zombies[j];
      z.hp -= dmg;
      z.hitFlash = 0.2;
      if (z.hp <= 0) {
        score += z.isMutant ? 150 : 80;
        coins += z.isMutant ? 5 : 2;
        addExplosion(z.x, z.y, "#ff0055", 12);
        zombies.splice(j, 1);
      }
    }

    if (boss) {
      boss.hp -= dmg * 1.4;
      boss.hitFlash = 0.2;
      if (boss.hp <= 0) destroyBoss();
    }
  }

  function detonateMissile(m) {
    addMissileExplosion(m.x, m.y, m.splashR);
    applyMissileBlast(m);
  }

  function fireMissile() {
    if (state !== "playing" || missileAmmo <= 0) return;

    missileAmmo--;
    updateHUD();
    playSound("missile_launch");

    const dmg = 45 + upgrades.missileLv * 15;
    const launchX = player.x;
    const launchY = player.y - (player.vehicle ? 42 : 28);

    addSmoke(launchX, launchY + 8, 6, 2.5);
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: launchX + (Math.random() - 0.5) * 10,
        y: launchY + 6,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1,
        r: Math.random() * 3 + 1,
        color: "#ffd166",
        life: 1,
        decay: 0.06,
        kind: "spark",
      });
    }

    missiles.push({
      x: launchX,
      y: launchY,
      vx: 0,
      vy: -34,
      r: 11,
      dmg,
      splashR: W * 0.92,
      age: 0,
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
        kind: "spark",
      });
    }
  }

  function addSmoke(x, y, count, spread) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * spread + 0.5;
      particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.5,
        r: Math.random() * 10 + 8,
        color: `rgba(${120 + Math.random() * 40 | 0},${115 + Math.random() * 30 | 0},${110 + Math.random() * 20 | 0},0.55)`,
        life: 1,
        decay: Math.random() * 0.015 + 0.012,
        kind: "smoke",
        grow: 1.04,
      });
    }
  }

  function addMissileExplosion(x, y, splashR) {
    playSound("explosion");
    screenShake = Math.min(22, 10 + splashR * 0.08);

    explosions.push({ x, y, r: 6, maxR: splashR * 0.35, life: 1, type: "ring", color: "#ffffff", width: 4 });
    explosions.push({ x, y, r: 10, maxR: splashR * 0.65, life: 1, type: "ring", color: "#ffd166", width: 3 });
    explosions.push({ x, y, r: 14, maxR: splashR, life: 1, type: "ring", color: "#ff6b00", width: 2 });
    explosions.push({ x, y, r: 0, maxR: splashR * 0.45, life: 0.7, type: "flash", color: "#fff4cc" });

    addExplosion(x, y, "#ff4500", 38);
    addExplosion(x, y, "#ffd166", 28);
    addExplosion(x, y, "#ff0055", 18);
    addSmoke(x, y, 16, 4.5);

    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * (Math.random() * 3 + 1),
        vy: Math.sin(a) * (Math.random() * 3 + 1),
        r: Math.random() * 3 + 1,
        color: "#fff8e7",
        life: 1,
        decay: 0.08,
        kind: "spark",
      });
    }
  }

  function drawMissile(m) {
    const angle = Math.atan2(m.vy, m.vx) + Math.PI / 2;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(angle);

    const bodyL = m.r * 2.8;
    const bodyW = m.r * 0.85;

    // Exhaust flame
    const flame = 0.55 + Math.sin(m.age * 40) * 0.25;
    const gradFlame = ctx.createLinearGradient(0, bodyL * 0.35, 0, bodyL * 1.4);
    gradFlame.addColorStop(0, `rgba(255, 240, 120, ${0.95 * flame})`);
    gradFlame.addColorStop(0.35, `rgba(255, 120, 30, ${0.85 * flame})`);
    gradFlame.addColorStop(1, "rgba(255, 40, 0, 0)");
    ctx.fillStyle = gradFlame;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.55, bodyL * 0.45);
    ctx.lineTo(0, bodyL * 1.35);
    ctx.lineTo(bodyW * 0.55, bodyL * 0.45);
    ctx.closePath();
    ctx.fill();

    // Smoke trail wisps
    ctx.fillStyle = "rgba(180, 180, 180, 0.35)";
    for (let i = 0; i < 3; i++) {
      const ty = bodyL * (0.55 + i * 0.18);
      ctx.beginPath();
      ctx.ellipse((i - 1) * 3, ty, 4 + i, 7 + i * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fins
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.moveTo(-bodyW * 1.05, bodyL * 0.15);
    ctx.lineTo(-bodyW * 0.55, bodyL * 0.45);
    ctx.lineTo(-bodyW * 0.55, bodyL * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bodyW * 1.05, bodyL * 0.15);
    ctx.lineTo(bodyW * 0.55, bodyL * 0.45);
    ctx.lineTo(bodyW * 0.55, bodyL * 0.05);
    ctx.closePath();
    ctx.fill();

    // Body
    const gradBody = ctx.createLinearGradient(-bodyW, 0, bodyW, 0);
    gradBody.addColorStop(0, "#5a5f68");
    gradBody.addColorStop(0.45, "#dfe4ec");
    gradBody.addColorStop(1, "#4d525a");
    ctx.fillStyle = gradBody;
    ctx.beginPath();
    ctx.moveTo(0, -bodyL * 0.55);
    ctx.lineTo(bodyW * 0.55, bodyL * 0.42);
    ctx.lineTo(0, bodyL * 0.32);
    ctx.lineTo(-bodyW * 0.55, bodyL * 0.42);
    ctx.closePath();
    ctx.fill();

    // Warhead tip
    ctx.fillStyle = "#ff3344";
    ctx.beginPath();
    ctx.moveTo(0, -bodyL * 0.78);
    ctx.lineTo(bodyW * 0.35, -bodyL * 0.35);
    ctx.lineTo(-bodyW * 0.35, -bodyL * 0.35);
    ctx.closePath();
    ctx.fill();

    // Stripe + glow window
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-bodyW * 0.45, -bodyL * 0.05, bodyW * 0.9, bodyW * 0.22);
    ctx.fillStyle = "#00f0ff";
    ctx.globalAlpha = 0.75 + Math.sin(m.age * 24) * 0.15;
    ctx.beginPath();
    ctx.arc(0, -bodyL * 0.18, bodyW * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function getStageMaxDist() {
    return STAGE_BASE_DIST + stage * 80;
  }

  function getStageDifficulty() {
    return {
      spawnInterval: Math.max(0.22, 1.05 - stage * 0.016),
      scrollSpeed: 95 + stage * 0.45,
      zombieHpMul: 1 + stage * 0.11,
      mutantChance: Math.min(0.62, 0.18 + stage * 0.013),
      bossHp: Math.floor(300 + stage * 115),
      bossSpeed: 2.0 + stage * 0.055,
      bossPattern: Math.max(0.55, 1.25 - stage * 0.011),
      minionHp: Math.floor(28 + stage * 4),
    };
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color: color || "#ffd166", life: 1, vy: -40 });
  }

  function updateHUD() {
    if (hudStage) hudStage.textContent = stage;
    if (hudScore) hudScore.textContent = score.toLocaleString("ko-KR");
    if (hudHp) hudHp.textContent = `${Math.max(0, Math.floor(player.hp))}%`;
    if (hudCoin) hudCoin.textContent = coins.toLocaleString("ko-KR");

    if (missileBtn) {
      missileBtn.disabled = missileAmmo <= 0;
    }
    const missileCountEl = document.getElementById("missile-count");
    if (missileCountEl) missileCountEl.textContent = `${missileAmmo}/${MISSILE_MAX}`;

    if (distFill) {
      const maxDist = getStageMaxDist();
      if (boss) {
        distFill.style.width = "100%";
      } else {
        distFill.style.width = `${Math.min(100, (stageDist / maxDist) * 100)}%`;
      }
    }

    if (boss) {
      if (bossBar) bossBar.classList.remove("hidden");
      if (bossNameEl) bossNameEl.textContent = boss.name || `👑 STAGE ${stage} 보스`;
      const bpct = Math.max(0, Math.floor((boss.hp / boss.maxHp) * 100));
      if (bossHpTextEl) bossHpTextEl.textContent = `${bpct}%`;
      if (bossFillEl) bossFillEl.style.width = `${bpct}%`;
    } else if (bossBar) {
      bossBar.classList.add("hidden");
    }

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
    const diff = getStageDifficulty();
    const isMutant = Math.random() < diff.mutantChance;
    const r = isMutant ? 28 + Math.min(stage * 0.3, 8) : 20;
    const baseHp = isMutant ? 60 : 25;
    const hp = baseHp * diff.zombieHpMul;

    zombies.push({
      x: Math.random() * (W - 60) + 30,
      y: -35,
      r,
      hp,
      maxHp: hp,
      vy: Math.random() * 1.5 + 2.0 + stage * 0.035,
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

  function spawnMissilePickup() {
    missilePickups.push({
      x: Math.random() * (W - 80) + 40,
      y: -40,
      r: 22,
      vy: 2.3,
      spin: Math.random() * Math.PI * 2,
    });
  }

  function cancelBossSpawnTimer() {
    if (bossSpawnTimerId) {
      clearTimeout(bossSpawnTimerId);
      bossSpawnTimerId = null;
    }
  }

  function spawnBoss() {
    const diff = getStageDifficulty();
    screenShake = 16;
    bossArming = false;
    boss = {
      x: W / 2,
      y: -160,
      targetY: 130,
      r: 58 + Math.min(stage * 1.2, 26),
      hp: diff.bossHp,
      maxHp: diff.bossHp,
      vx: diff.bossSpeed,
      patternTimer: 0,
      patternCd: diff.bossPattern,
      walkCycle: 0,
      hitFlash: 0,
      name: `👑 STAGE ${stage} 킹 좀비`,
    };
    addFloat(W / 2, 120, "보스 등장!", "#ff0055");
    playSound("vehicle");
    updateHUD();
  }

  function triggerBossPhase() {
    if (boss || bossArming) return;
    bossArming = true;
    addFloat(W / 2, 90, "⚠️ 보스 접근중…", "#ffd166");
    cancelBossSpawnTimer();
    bossSpawnTimerId = window.setTimeout(() => {
      bossSpawnTimerId = null;
      bossArming = false;
      if (state === "playing" && !boss) spawnBoss();
    }, 900);
  }

  let spawnTimer = 0;
  let vehicleTimer = 0;

  function setupStage() {
    cancelBossSpawnTimer();
    stageDist = 0;
    spawnTimer = 0;
    vehicleTimer = 0;
    stageMissileSpawned = false;
    bullets = [];
    missiles = [];
    zombies = [];
    vehiclePickups = [];
    missilePickups = [];
    coinPickups = [];
    particles = [];
    explosions = [];
    floats = [];
    boss = null;
    bossArming = false;
    updateHUD();
  }

  function update(dt) {
    animTime += dt;
    bgScrollY = (bgScrollY + dt * 60) % H;

    if (state !== "playing") return;

    if (screenShake > 0) screenShake -= dt * 25;
    if (player.fireCd > 0) player.fireCd -= dt;

    if (!boss) {
      const diff = getStageDifficulty();
      stageDist += dt * diff.scrollSpeed;
    }

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

    if (player.recoil > 0) player.recoil -= dt * 6;

    if (player.vehicle) {
      const vSpeed = player.vehicle.type === "chopper" ? 16 : 10;
      player.vehicleAnim = (player.vehicleAnim || 0) + dt * vSpeed;
      const moving = Math.hypot(dx, dy) > 1 || isPointerDown || isPadLeft || isPadRight;
      if (moving && player.vehicle.type === "tank" && Math.random() < dt * 12) {
        particles.push({
          x: player.x + (Math.random() - 0.5) * 28,
          y: player.y + player.r * 0.55,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 2 + 1,
          r: Math.random() * 4 + 2,
          color: "rgba(180, 170, 150, 0.7)",
          life: 1,
          decay: 0.04,
        });
      }
      if (moving && player.vehicle.type === "chopper" && Math.random() < dt * 8) {
        particles.push({
          x: player.x + (Math.random() - 0.5) * 40,
          y: player.y + player.r * 0.7,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * 1.5 + 0.5,
          r: Math.random() * 3 + 1,
          color: "rgba(0, 240, 255, 0.35)",
          life: 1,
          decay: 0.05,
        });
      }
    } else if (Math.hypot(dx, dy) > 1 || isPointerDown || isPadLeft || isPadRight) {
      player.runCycle = (player.runCycle || 0) + dt * 11;
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
        boss.hitFlash = 0.12;
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

    // Homing Missiles — fast forward blast
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.age = (m.age || 0) + dt;
      m.y += m.vy;
      m.x += m.vx;

      if (Math.random() < 0.9) {
        particles.push({
          x: m.x + (Math.random() - 0.5) * 6,
          y: m.y + 12,
          vx: (Math.random() - 0.5) * 1.2,
          vy: Math.random() * 2 + 2,
          r: Math.random() * 4 + 2,
          color: Math.random() < 0.5 ? "rgba(255,170,60,0.85)" : "rgba(200,200,200,0.45)",
          life: 1,
          decay: Math.random() * 0.05 + 0.04,
          kind: "trail",
        });
      }

      let exploded = m.y < 70;

      if (!exploded) {
        for (let j = 0; j < zombies.length; j++) {
          const z = zombies[j];
          if (Math.hypot(m.x - z.x, m.y - z.y) < m.r + z.r) {
            exploded = true;
            break;
          }
        }
      }

      if (!exploded && boss && Math.hypot(m.x - boss.x, m.y - boss.y) < m.r + boss.r) {
        exploded = true;
      }

      if (exploded) {
        detonateMissile(m);
        missiles.splice(i, 1);
      }
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      e.life -= dt * (e.type === "flash" ? 3.2 : 1.8);
      e.r += (e.maxR - e.r) * dt * 7;
      if (e.life <= 0) explosions.splice(i, 1);
    }

    // Missile ammo pickups
    for (let i = missilePickups.length - 1; i >= 0; i--) {
      const mp = missilePickups[i];
      mp.y += mp.vy;
      mp.spin = (mp.spin || 0) + dt * 4;

      if (Math.hypot(mp.x - player.x, mp.y - player.y) < mp.r + player.r) {
        if (missileAmmo < MISSILE_MAX) {
          missileAmmo++;
          playSound("coin");
          addFloat(player.x, player.y - 30, "🚀 미사일 +1", "#ff9e00");
        } else {
          addFloat(mp.x, mp.y - 20, "미사일 MAX", "#888");
        }
        addExplosion(mp.x, mp.y, "#ff9e00", 14);
        missilePickups.splice(i, 1);
        updateHUD();
      } else if (mp.y > H + 40) {
        missilePickups.splice(i, 1);
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
        player.vehicleAnim = 0;
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
      if (boss.y < boss.targetY) boss.y += 2.8;
      boss.x += boss.vx;
      if (boss.x < boss.r + 20 || boss.x > W - boss.r - 20) boss.vx *= -1;
      boss.walkCycle = (boss.walkCycle || 0) + dt * 6;
      if (boss.hitFlash > 0) boss.hitFlash -= dt;

      boss.patternTimer += dt;
      const diff = getStageDifficulty();
      if (boss.patternTimer > boss.patternCd) {
        boss.patternTimer = 0;
        const mh = diff.minionHp;
        zombies.push({ x: boss.x - 24, y: boss.y + 38, r: 20, hp: mh, maxHp: mh, vy: 3.2 + stage * 0.02, isMutant: stage >= 8, walkCycle: 0, hitFlash: 0 });
        zombies.push({ x: boss.x + 24, y: boss.y + 38, r: 20, hp: mh, maxHp: mh, vy: 3.2 + stage * 0.02, isMutant: stage >= 8, walkCycle: 0, hitFlash: 0 });
      }
    } else {
      const diff = getStageDifficulty();
      if (spawnTimer > diff.spawnInterval) {
        spawnTimer = 0;
        spawnZombie();
      }

      if (vehicleTimer > 14 && !player.vehicle && Math.random() < 0.4) {
        vehicleTimer = 0;
        spawnVehiclePickup();
      }

      const maxDist = getStageMaxDist();
      const missileDropDist = maxDist * (0.38 + (stage % 2) * 0.08);
      if (!stageMissileSpawned && stage >= 2 && stageDist >= missileDropDist) {
        stageMissileSpawned = true;
        spawnMissilePickup();
      }

      if (stageDist >= maxDist) {
        triggerBossPhase();
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

    if (boss) {
      if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.r + player.r - 10) {
        playerHit(16 + stage * 0.8);
      }
      updateHUD();
    }

    // Particles Update
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === "smoke" || p.kind === "trail") {
        p.vx *= 0.96;
        p.vy *= 0.96;
        if (p.grow) p.r *= p.grow;
      }
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
    bossArming = false;
    updateHUD();
    stageClear();
  }

  function stageClear() {
    cancelBossSpawnTimer();
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
    showOverlayForState("clear");
  }

  function nextStage() {
    if (stage >= MAX_STAGE) {
      startGame();
      return;
    }
    cancelBossSpawnTimer();
    if (shopOverlay) shopOverlay.classList.add("hidden");
    stage++;
    state = "playing";
    hideAllOverlays();
    resumeGameplayClock();
    setupStage();
    updateHUD();
  }

  function gameOver() {
    cancelBossSpawnTimer();
    state = "over";
    showOverlayForState("over");
    if (overDetail) overDetail.textContent = `STAGE ${stage} · 최종 점수: ${score.toLocaleString("ko-KR")}점`;

    if (window.TodayGameRank) {
      window.TodayGameRank.mount({ gameId: GAME_ID, gameTitle: GAME_TITLE, formParent: overOverlay });
      window.TodayGameRank.open(score);
    }
  }

  function startGame() {
    getAudioCtx();
    stage = 1;
    score = 0;
    missileAmmo = MISSILE_START;
    player.hp = 100;
    player.vehicle = null;
    player.x = W / 2;
    player.y = H - 140;

    state = "playing";
    hideAllOverlays();
    resumeGameplayClock();

    setupStage();
    updateHUD();
  }

  // Shop System Upgrades
  function openShop(fromState) {
    shopReturnState = fromState || state;
    state = "shop";
    hideAllOverlays();
    updateShopUI();
    if (shopOverlay) shopOverlay.classList.remove("hidden");
  }

  function closeShop() {
    if (shopOverlay) shopOverlay.classList.add("hidden");
    const returnTo = shopReturnState || "title";

    if (returnTo === "playing" || returnTo === "paused") {
      state = returnTo;
      resumeGameplayClock();
      if (returnTo === "playing" && stageDist >= getStageMaxDist() && !boss && !bossArming) {
        triggerBossPhase();
      }
      return;
    }

    state = returnTo;
    showOverlayForState(returnTo);
    resumeGameplayClock();
  }

  function updateShopUI() {
    const costDmg = 100 * upgrades.dmgLv;
    const costRate = 150 * upgrades.rateLv;
    const costMissile = 200 * upgrades.missileLv;
    const costEvo = 300 * upgrades.evoLv;

    const elDmg = document.getElementById("cost-dmg");
    const elRate = document.getElementById("cost-rate");
    const elMissile = document.getElementById("cost-missile");
    const elEvo = document.getElementById("cost-evo");
    const elShopCoin = document.getElementById("shop-coin");
    const lvDmg = document.getElementById("shop-dmg-lv");
    const lvRate = document.getElementById("shop-rate-lv");
    const lvMissile = document.getElementById("shop-missile-lv");
    const lvEvo = document.getElementById("shop-evo-lv");

    if (elShopCoin) elShopCoin.textContent = coins.toLocaleString("ko-KR");
    if (lvDmg) lvDmg.textContent = `Lv.${upgrades.dmgLv} (+${upgrades.dmgLv * 15}% 공격)`;
    if (lvRate) lvRate.textContent = `Lv.${upgrades.rateLv} (연사 ${Math.max(8, 10 - upgrades.rateLv)}%↑)`;
    if (lvMissile) lvMissile.textContent = `Lv.${upgrades.missileLv} (폭발 ${45 + upgrades.missileLv * 15} dmg)`;
    if (lvEvo) {
      const evoNames = ["아기 형태", "성장 형태", "성체 진화", "MAX 코스튬"];
      lvEvo.textContent = `Lv.${upgrades.evoLv} ${evoNames[Math.min(upgrades.evoLv - 1, 3)]}`;
    }

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
    shopBtn.addEventListener("click", () => openShop("title"));
  }

  if (hudShopBtn) {
    hudShopBtn.addEventListener("click", () => openShop("playing"));
  }

  if (clearShopBtn) {
    clearShopBtn.addEventListener("click", () => openShop("clear"));
  }

  if (overShopBtn) {
    overShopBtn.addEventListener("click", () => openShop("over"));
  }

  if (shopCloseBtn) {
    shopCloseBtn.addEventListener("click", closeShop);
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

    // 1. Missile & vehicle pickups
    missilePickups.forEach((mp) => {
      ctx.save();
      ctx.translate(mp.x, mp.y);
      const bob = Math.sin((mp.spin || 0) * 2) * 3;
      ctx.strokeStyle = "rgba(255, 158, 0, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, bob, mp.r + 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(mp.spin || 0);
      ctx.fillStyle = "#ff3344";
      ctx.beginPath();
      ctx.moveTo(0, -mp.r * 0.9 + bob);
      ctx.lineTo(mp.r * 0.45, mp.r * 0.55 + bob);
      ctx.lineTo(-mp.r * 0.45, mp.r * 0.55 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(-mp.r * 0.22, mp.r * 0.1 + bob, mp.r * 0.44, mp.r * 0.18);
      ctx.font = 'bold 11px "Jua", sans-serif';
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText("+1", 0, mp.r * 0.24 + bob);
      ctx.restore();
    });

    vehiclePickups.forEach((vp) => {
      ctx.save();
      ctx.translate(vp.x, vp.y);
      const pulse = Math.sin(animTime * 4 + vp.x) * 2;
      ctx.strokeStyle = "rgba(0, 240, 255, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, vp.r + 10 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      const vFrame = getAnimFrame(animTime * 8);
      const vSize = vp.r * 4.2;
      if (!drawVehicleSprite(vp.type, vFrame, vSize, 0)) {
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(vp.type === "tank" ? "🚜" : "🚁", 0, 0);
      }
      ctx.restore();
    });

    // 2. Zombies & Boss — sprite-sheet walk animation
    zombies.forEach((z) => {
      ctx.save();
      ctx.translate(z.x, z.y);

      const zSprite = z.isMutant ? sprites.zombie_mutant : sprites.zombie;
      const zFrame = getAnimFrame(z.walkCycle);
      const sz = z.r * (z.isMutant ? 4.2 : 3.8);

      drawGroundShadow(sz, sz * 0.4);
      if (!drawSpriteWithFlash(zSprite, zFrame, SPRITE_FRAMES, -sz / 2, -sz / 2, sz, sz, z.hitFlash)) {
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
      const bsz = boss.r * 5.2;
      drawGroundShadow(bsz, bsz * 0.42);

      const bFrame = getAnimFrame(boss.walkCycle);
      if (!drawSpriteWithFlash(sprites.boss, bFrame, SPRITE_FRAMES, -bsz / 2, -bsz / 2, bsz, bsz, boss.hitFlash || 0)) {
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
      ctx.save();
      ctx.shadowBlur = 0;
      if (b.type === "tank_shell") {
        ctx.fillStyle = "#ff9e00";
        ctx.fillRect(b.x - b.r, b.y - b.r * 1.6, b.r * 2, b.r * 3.2);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 2, b.r * 0.8, b.r * 1.2);
      } else {
        ctx.fillStyle = "#00f0ff";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r * 0.7, b.r * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y - b.r * 0.3, b.r * 0.25, b.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    missiles.forEach((m) => drawMissile(m));

    // 4. Explosion shockwaves & flash
    explosions.forEach((e) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, e.life);
      if (e.type === "flash") {
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
        g.addColorStop(0, "rgba(255, 245, 210, 0.85)");
        g.addColorStop(0.45, "rgba(255, 120, 40, 0.45)");
        g.addColorStop(1, "rgba(255, 0, 0, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = e.width || 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 5. Particles
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life * (p.kind === "smoke" ? 0.55 : 1));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 6. Floating Score Text
    floats.forEach((f) => {
      ctx.font = 'bold 16px "Jua", sans-serif';
      ctx.fillStyle = f.color;
      ctx.textAlign = "center";
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    // 7. Player Hero & Boarded Vehicles
    if (state === "playing" || state === "title") {
      ctx.save();
      ctx.translate(player.x, player.y);
      const lean = player.tilt || 0;
      ctx.rotate(lean * (player.vehicle ? 0.35 : 1));

      const heroDef = HERO_DEFS[selectedHeroKey] || HERO_DEFS.chick;
      const heroSprite = sprites[heroDef.spriteKey];
      const heroFrame = getAnimFrame(player.runCycle);

      if (player.vehicle) {
        const vType = player.vehicle.type;
        const vFrame = getAnimFrame(player.vehicleAnim);
        const hover = vType === "chopper" ? Math.sin(animTime * 10) * 3 : 0;
        const recoilY = vType === "tank" ? player.recoil * 5 : 0;
        const vsz = player.r * (vType === "tank" ? 5.4 : 5.0);

        drawVehicleSprite(vType, vFrame, vsz, hover - recoilY);

        // Hatch gunner — small hero upper body on tank/chopper
        if (isReady(heroSprite)) {
          const headW = player.r * 1.35;
          const headH = player.r * 1.55;
          const headY = vType === "tank" ? -player.r * 1.05 - recoilY : -player.r * 0.55 + hover;
          drawSpriteSheet(heroSprite, heroFrame, SPRITE_FRAMES, -headW / 2, headY - headH * 0.55, headW, headH);
        }

        if (player.recoil > 0.2 && vType === "tank") {
          ctx.fillStyle = "rgba(255, 158, 0, 0.75)";
          ctx.beginPath();
          ctx.arc(0, -vsz * 0.42 - recoilY * 2, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const sz = player.r * 3.8 * (1 + (upgrades.evoLv - 1) * 0.15);
        drawGroundShadow(sz, sz * 0.4);
        if (!drawSpriteSheet(heroSprite, heroFrame, SPRITE_FRAMES, -sz / 2, -sz / 2, sz, sz)) {
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
