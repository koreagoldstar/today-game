(() => {
  "use strict";

  const CHARACTERS = [
    { id: "chick", name: "쪼꼬", src: "assets/characters/chick.png" },
    { id: "bear", name: "곰곰", src: "assets/characters/bear.png" },
    { id: "cat", name: "냥냥", src: "assets/characters/cat.png" },
    { id: "rabbit", name: "토토", src: "assets/characters/rabbit.png" },
  ];

  const ITEM_TYPES = {
    power: { label: "POWER", color: "#FF6B9D", emoji: "★" },
    missile: { label: "MISSILE", color: "#5B9FFF", emoji: "◆" },
    shield: { label: "SHIELD", color: "#7ED957", emoji: "●" },
    heart: { label: "LIFE", color: "#FF8AB5", emoji: "♥" },
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlays = {
    title: document.getElementById("title-screen"),
    gameover: document.getElementById("gameover-screen"),
  };
  const hud = {
    score: document.getElementById("hud-score"),
    level: document.getElementById("hud-level"),
    lives: document.getElementById("hud-lives"),
    powerBar: document.getElementById("power-bar"),
    touchHint: document.getElementById("touch-hint"),
  };

  const W = 390;
  const H = 700;
  canvas.width = W;
  canvas.height = H;

  const images = {};
  let selectedId = null;
  let state = "title";
  let lastTs = 0;
  let raf = 0;

  const MAX_LIVES = 5;
  /** 이 초만큼 버티면 목숨 +1 */
  const LIFE_INTERVAL_BASE = 12;
  const TOTAL_BOSSES = 50;

  const game = {
    score: 0,
    level: 1,
    lives: 1,
    time: 0,
    scroll: 0,
    player: null,
    bullets: [],
    enemies: [],
    enemyBullets: [],
    items: [],
    particles: [],
    floats: [],
    signs: [],
    clouds: [],
    buildings: [],
    spawnTimer: 0,
    signTimer: 0,
    wave: 0,
    killCount: 0,
    invuln: 0,
    shake: 0,
    touchHintUntil: 0,
    surviveAcc: 0,
    livesEarned: 0,
    nextLifeAt: LIFE_INTERVAL_BASE,
    bossTimer: 28,
    bossCount: 0,
    bossesCleared: 0,
    bossActive: false,
    difficulty: 1,
  };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  /* —— 귀여운 사운드 (Web Audio, 파일 없이 생성) —— */
  let audioCtx = null;
  let muted = false;
  let lastShootSound = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    const ctx = ensureAudio();
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) {
      osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, when) {
    const ctx = ensureAudio();
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (when || 0);
    const len = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const SFX = {
    select() {
      tone(660, 0.08, "triangle", 0.08);
      tone(990, 0.1, "sine", 0.06, 0.06);
    },
    start() {
      tone(523, 0.1, "triangle", 0.1);
      tone(659, 0.1, "triangle", 0.09, 0.09);
      tone(784, 0.14, "sine", 0.1, 0.18);
      tone(1046, 0.18, "sine", 0.08, 0.28);
    },
    shoot() {
      const now = performance.now();
      if (now - lastShootSound < 55) return;
      lastShootSound = now;
      tone(880, 0.045, "square", 0.028, 0, 1400);
      tone(1200, 0.03, "sine", 0.02, 0.01, 1800);
    },
    missile() {
      tone(320, 0.12, "sawtooth", 0.035, 0, 720);
      tone(540, 0.08, "sine", 0.03, 0.05);
    },
    hitEnemy() {
      tone(740, 0.05, "triangle", 0.06, 0, 420);
      noiseBurst(0.05, 0.04);
    },
    explode() {
      tone(280, 0.12, "square", 0.05, 0, 90);
      tone(180, 0.16, "triangle", 0.05, 0.04, 60);
      noiseBurst(0.12, 0.07);
    },
    power() {
      tone(523, 0.08, "sine", 0.08);
      tone(659, 0.08, "sine", 0.08, 0.07);
      tone(784, 0.08, "sine", 0.08, 0.14);
      tone(1046, 0.16, "triangle", 0.09, 0.22);
    },
    shield() {
      tone(400, 0.15, "sine", 0.07, 0, 800);
      tone(800, 0.12, "triangle", 0.05, 0.1);
    },
    life() {
      tone(587, 0.1, "sine", 0.09);
      tone(740, 0.1, "sine", 0.09, 0.1);
      tone(880, 0.12, "triangle", 0.1, 0.2);
      tone(1174, 0.2, "sine", 0.08, 0.32);
    },
    hurt() {
      tone(220, 0.18, "sawtooth", 0.07, 0, 110);
      tone(160, 0.22, "triangle", 0.06, 0.08, 80);
      noiseBurst(0.1, 0.05);
    },
    block() {
      tone(600, 0.06, "square", 0.05);
      tone(900, 0.08, "sine", 0.05, 0.05);
    },
    over() {
      tone(392, 0.18, "triangle", 0.08);
      tone(349, 0.18, "triangle", 0.07, 0.16);
      tone(294, 0.22, "sine", 0.07, 0.32);
      tone(220, 0.35, "sine", 0.06, 0.5);
    },
    bossWarn() {
      tone(300, 0.12, "sawtooth", 0.07);
      tone(450, 0.12, "sawtooth", 0.07, 0.12);
      tone(600, 0.2, "triangle", 0.09, 0.24);
      tone(900, 0.25, "sine", 0.08, 0.4);
    },
    bossClear() {
      tone(523, 0.1, "sine", 0.1);
      tone(659, 0.1, "sine", 0.1, 0.1);
      tone(784, 0.1, "sine", 0.1, 0.2);
      tone(1046, 0.12, "triangle", 0.11, 0.3);
      tone(1318, 0.28, "sine", 0.1, 0.42);
    },
    clear() {
      tone(523, 0.1, "sine", 0.1);
      tone(659, 0.1, "sine", 0.1, 0.1);
      tone(784, 0.1, "sine", 0.1, 0.2);
      tone(1046, 0.12, "triangle", 0.11, 0.3);
      tone(1318, 0.14, "sine", 0.1, 0.42);
      tone(1568, 0.35, "sine", 0.1, 0.56);
    },
  };

  function loadImages() {
    const jobs = CHARACTERS.map(
      (c) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            images[c.id] = img;
            resolve();
          };
          img.onerror = reject;
          img.src = c.src;
        })
    );
    const ads = window.CUTE_SHOOT_ADS || [];
    ads.forEach((ad) => {
      if (!ad.image) return;
      jobs.push(
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images[`ad:${ad.id}`] = img;
            resolve();
          };
          img.onerror = resolve;
          img.src = ad.image;
        })
      );
    });
    return Promise.all(jobs);
  }

  function setupTitle() {
    const grid = document.getElementById("char-grid");
    grid.innerHTML = "";
    CHARACTERS.forEach((c, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "char-btn";
      btn.dataset.id = c.id;
      btn.innerHTML = `<img src="${c.src}" alt="${c.name}" /><span>${c.name}</span>`;
      btn.addEventListener("click", () => {
        ensureAudio();
        selectedId = c.id;
        grid.querySelectorAll(".char-btn").forEach((el) => el.classList.remove("selected"));
        btn.classList.add("selected");
        document.getElementById("start-btn").disabled = false;
        SFX.select();
      });
      grid.appendChild(btn);
      if (index === 0) {
        selectedId = c.id;
        btn.classList.add("selected");
        document.getElementById("start-btn").disabled = false;
      }
    });

    document.getElementById("start-btn").addEventListener("click", startGame);
    document.getElementById("retry-btn").addEventListener("click", () => {
      overlays.gameover.classList.add("hidden");
      startGame();
    });
    document.getElementById("home-btn").addEventListener("click", () => {
      overlays.gameover.classList.add("hidden");
      overlays.title.classList.remove("hidden");
      state = "title";
    });
    const soundBtn = document.getElementById("sound-btn");
    if (soundBtn) {
      soundBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        muted = !muted;
        soundBtn.textContent = muted ? "🔇" : "🔊";
        if (!muted) {
          ensureAudio();
          SFX.select();
        }
      });
    }
  }

  function resetWorld() {
    game.score = 0;
    game.level = 1;
    game.lives = 1;
    game.time = 0;
    game.scroll = 0;
    game.bullets = [];
    game.enemies = [];
    game.enemyBullets = [];
    game.items = [];
    game.particles = [];
    game.floats = [];
    game.signs = [];
    game.spawnTimer = 1.0;
    game.signTimer = 2.5;
    game.wave = 0;
    game.killCount = 0;
    game.invuln = 1.4;
    game.shake = 0;
    game.touchHintUntil = 3.5;
    game.surviveAcc = 0;
    game.livesEarned = 0;
    game.nextLifeAt = LIFE_INTERVAL_BASE;
    game.bossTimer = 22;
    game.bossCount = 0;
    game.bossesCleared = 0;
    game.bossActive = false;
    game.difficulty = 1;

    game.clouds = Array.from({ length: 8 }, () => ({
      x: rand(0, W),
      y: rand(0, H * 0.55),
      r: rand(28, 55),
      speed: rand(8, 22),
      alpha: rand(0.25, 0.55),
    }));

    game.buildings = [];
    let bx = -20;
    while (bx < W + 80) {
      const bw = rand(42, 78);
      game.buildings.push({
        x: bx,
        w: bw,
        h: rand(70, 160),
        color: pick(["#FFD6E7", "#D6EFFF", "#FFE8B8", "#E4D7FF", "#C9F2DE"]),
        window: pick(["#fff8", "#fffc", "#ffe9"]),
      });
      bx += bw + rand(8, 18);
    }

    const enemyPool = CHARACTERS.filter((c) => c.id !== selectedId);
    game.player = {
      x: W / 2,
      y: H - 110,
      r: 28,
      vx: 0,
      vy: 0,
      charId: selectedId,
      power: 1,
      fireCd: 0,
      missile: false,
      missileCd: 0,
      shield: 0,
      targetX: W / 2,
      targetY: H - 110,
    };
    game._enemyPool = enemyPool;
  }

  function startGame() {
    if (!selectedId) return;
    ensureAudio();
    SFX.start();
    resetWorld();
    overlays.title.classList.add("hidden");
    overlays.gameover.classList.add("hidden");
    state = "playing";
    updateHud();
    lastTs = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function endGame(cleared) {
    state = "gameover";
    const badge = document.getElementById("result-badge");
    const title = document.getElementById("result-title");
    if (cleared) {
      SFX.clear();
      if (badge) badge.textContent = "CLEAR!";
      if (title) title.textContent = "클리어했어요!";
    } else {
      SFX.over();
      if (badge) badge.textContent = "GAME OVER";
      if (title) title.textContent = "수고했어요!";
    }
    document.getElementById("final-score").textContent = String(game.score);
    const sec = Math.floor(game.time);
    document.getElementById("final-detail").textContent =
      `중간보스 ${game.bossesCleared}/${TOTAL_BOSSES} · ${sec}초 · 처치 ${game.killCount}` +
      (cleared ? " · 완주!" : "");
    overlays.gameover.classList.remove("hidden");
  }

  function updateHud() {
    hud.score.textContent = String(game.score);
    hud.level.textContent = String(game.level);
    const p = game.player;
    hud.powerBar.style.width = `${(p.power / 5) * 100}%`;
    hud.lives.innerHTML = "";
    const show = Math.max(game.lives, 1);
    for (let i = 0; i < show; i++) {
      const pip = document.createElement("span");
      pip.className = "life-pip" + (i < game.lives ? "" : " empty");
      hud.lives.appendChild(pip);
    }
    const surviveLabel = document.getElementById("hud-survive");
    if (surviveLabel) {
      const left = Math.max(0, game.nextLifeAt - game.surviveAcc);
      surviveLabel.textContent = game.lives >= MAX_LIVES ? "MAX" : `${Math.ceil(left)}s`;
    }
    const bossHud = document.getElementById("hud-boss");
    if (bossHud) {
      bossHud.textContent = `${game.bossesCleared}/${TOTAL_BOSSES}`;
    }
  }

  function onMidBossDefeated(e) {
    game.bossActive = false;
    game.bossesCleared += 1;
    game.difficulty += 1;
    game.level = Math.max(game.level, game.difficulty);
    game.shake = 16;
    // 잡몹 탄 정리 + 난이도 상승 연출
    game.enemyBullets = [];
    game.enemies = game.enemies.filter((en) => !en.boss && Math.random() > 0.45);
    floatText(e.x, e.y - 50, `BOSS ${game.bossesCleared}/${TOTAL_BOSSES}`, "#FFE27A");
    floatText(W / 2, H * 0.42, "난이도 UP!", "#FF6B9D");
    SFX.bossClear();
    spawnItem(e.x - 24, e.y, "power");
    spawnItem(e.x, e.y, "missile");
    spawnItem(e.x + 24, e.y, "shield");
    if (game.lives < MAX_LIVES) {
      game.lives += 1;
      game.livesEarned += 1;
      floatText(e.x, e.y - 70, "+LIFE!", "#FF6B9D");
    }
    if (game.bossesCleared >= TOTAL_BOSSES) {
      updateHud();
      setTimeout(() => {
        if (state === "playing") endGame(true);
      }, 900);
      return;
    }
    game.bossTimer = Math.max(16, 28 - game.bossesCleared * 1.2);
    updateHud();
  }

  function floatText(x, y, text, color) {
    game.floats.push({ x, y, text, color, life: 1.1, max: 1.1 });
  }

  function grantSurvivalLife() {
    if (game.lives >= MAX_LIVES) return;
    game.lives += 1;
    game.livesEarned += 1;
    game.surviveAcc = 0;
    game.nextLifeAt = LIFE_INTERVAL_BASE + game.livesEarned * 2;
    floatText(game.player.x, game.player.y - 40, "+LIFE!", "#FF6B9D");
    burst(game.player.x, game.player.y, "#FF8AB5", 18);
    SFX.life();
    updateHud();
  }

  function fireCuteBullet(x, y, vx, vy, style) {
    const st = style || pick(["heart", "star", "candy", "bubble", "petal"]);
    game.enemyBullets.push({
      x,
      y,
      vx,
      vy,
      r: st === "heart" || st === "star" ? 7 : 6,
      style: st,
      spin: rand(0, Math.PI * 2),
      spinSp: rand(3, 7) * (Math.random() < 0.5 ? 1 : -1),
      t: 0,
    });
  }

  function spawnMidBoss() {
    if (game.bossActive || game.bossesCleared >= TOTAL_BOSSES) return;
    const pool = game._enemyPool;
    const type = pick(pool).id;
    const next = game.bossesCleared + 1;
    game.bossCount = next;
    game.bossActive = true;
    const diff = game.difficulty;
    const hp = 24 + next * 12 + diff * 6;
    const size = 46 + Math.min(10, next);
    game.enemies.push({
      x: W / 2,
      y: -70,
      r: size,
      hp,
      maxHp: hp,
      speed: 55,
      sway: 1.2 + next * 0.08,
      swayAmp: 70 + next * 4,
      phase: 0,
      charId: type,
      tough: true,
      boss: true,
      shootCd: 1.1,
      score: 350 + next * 180,
      pattern: 0,
      intro: true,
      homeY: 120 + (next % 3) * 8,
      stage: next,
    });
    floatText(W / 2, H * 0.35, `중간보스 ${next}/${TOTAL_BOSSES}`, "#FF4F8B");
    SFX.bossWarn();
    game.shake = 10;
    updateHud();
  }

  function spawnEnemy() {
    const pool = game._enemyPool;
    const type = pick(pool).id;
    const tough = Math.random() < 0.12 + game.difficulty * 0.03;
    const x = rand(36, W - 36);
    const hp = tough
      ? 3 + Math.floor(game.difficulty * 0.7)
      : 1 + Math.floor(game.difficulty / 3);
    game.enemies.push({
      x,
      y: -40,
      r: tough ? 32 : 26,
      hp,
      maxHp: hp,
      speed: rand(52, 88) + game.difficulty * 7,
      sway: rand(0.8, 2.0),
      swayAmp: rand(18, 48),
      phase: rand(0, Math.PI * 2),
      charId: type,
      tough,
      boss: false,
      shootCd: rand(1.4, 2.6) / (1 + game.difficulty * 0.04),
      score: tough ? 80 : 30,
    });
  }

  function spawnSign() {
    const ads = window.CUTE_SHOOT_ADS || [];
    if (!ads.length) return;
    const ad = pick(ads);
    const side = Math.random() < 0.5 ? "left" : "right";
    game.signs.push({
      ad,
      side,
      x: side === "left" ? 8 : W - 118,
      y: -120,
      w: 110,
      h: 70,
      speed: 55 + game.level * 2,
    });
  }

  function spawnItem(x, y, forceType) {
    const roll = Math.random();
    let type = forceType;
    if (!type) {
      // 목숨은 아이템으로 잘 안 줌 → 생존으로만 얻기
      if (roll < 0.5) type = "power";
      else if (roll < 0.78) type = "missile";
      else type = "shield";
    }
    game.items.push({
      x,
      y,
      r: 16,
      type,
      vy: 80,
      t: 0,
    });
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 160);
      game.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.35, 0.7),
        max: 0.7,
        color,
        size: rand(2, 5),
      });
    }
  }

  function firePlayer(dt) {
    const p = game.player;
    p.fireCd -= dt;
    p.missileCd -= dt;
    if (p.fireCd > 0) return;
    const interval = Math.max(0.12, 0.28 - p.power * 0.025);
    p.fireCd = interval;

    const mk = (ox, ang, dmg, col, kind) => {
      game.bullets.push({
        x: p.x + ox,
        y: p.y - 24,
        vx: Math.sin(ang) * 40,
        vy: -420 - p.power * 20,
        r: kind === "missile" ? 7 : 5,
        dmg,
        color: col,
        kind,
        life: 2.2,
      });
    };

    if (p.power === 1) mk(0, 0, 1, "#FF6B9D", "shot");
    else if (p.power === 2) {
      mk(-10, 0, 1, "#FF6B9D", "shot");
      mk(10, 0, 1, "#FF8AB5", "shot");
    } else if (p.power === 3) {
      mk(0, 0, 1, "#FF4F8B", "shot");
      mk(-14, -0.12, 1, "#FF8AB5", "shot");
      mk(14, 0.12, 1, "#FF8AB5", "shot");
    } else if (p.power >= 4) {
      mk(0, 0, 1.5, "#FF4F8B", "shot");
      mk(-16, -0.18, 1, "#FF6B9D", "shot");
      mk(16, 0.18, 1, "#FF6B9D", "shot");
      mk(-8, 0, 1, "#FFB4D0", "shot");
      mk(8, 0, 1, "#FFB4D0", "shot");
    }

    if (p.missile && p.missileCd <= 0) {
      p.missileCd = 0.55;
      mk(-18, -0.25, 2.5, "#FF4F8B", "missile");
      mk(18, 0.25, 2.5, "#FF4F8B", "missile");
      SFX.missile();
    } else {
      SFX.shoot();
    }
  }

  function applyItem(type) {
    const p = game.player;
    if (type === "power") {
      p.power = Math.min(5, p.power + 1);
      burst(p.x, p.y, "#FF6B9D", 14);
      floatText(p.x, p.y - 36, `POWER ${p.power}`, "#FF6B9D");
      SFX.power();
    } else if (type === "missile") {
      p.missile = true;
      burst(p.x, p.y, "#5B9FFF", 14);
      floatText(p.x, p.y - 36, "MISSILE!", "#5B9FFF");
      SFX.missile();
      SFX.power();
    } else if (type === "shield") {
      p.shield = Math.max(p.shield, 4.2);
      burst(p.x, p.y, "#7ED957", 12);
      floatText(p.x, p.y - 36, "SHIELD", "#7ED957");
      SFX.shield();
    } else if (type === "heart") {
      if (game.lives < MAX_LIVES) {
        game.lives += 1;
        floatText(p.x, p.y - 36, "+LIFE!", "#FF8AB5");
      }
      burst(p.x, p.y, "#FF8AB5", 12);
      SFX.life();
    }
    updateHud();
  }

  function hitPlayer() {
    if (game.invuln > 0) return;
    const p = game.player;
    if (p.shield > 0) {
      p.shield = 0;
      game.invuln = 1.0;
      burst(p.x, p.y, "#7ED957", 16);
      game.shake = 8;
      floatText(p.x, p.y - 36, "BLOCK!", "#7ED957");
      SFX.block();
      return;
    }
    // 한 대 = 목숨 1개 소모. 여분 없으면 즉사
    game.lives -= 1;
    game.shake = 12;
    p.power = Math.max(1, p.power - 1);
    burst(p.x, p.y, "#FF6B9D", 22);
    SFX.hurt();
    updateHud();
    if (game.lives <= 0) {
      endGame();
      return;
    }
    game.invuln = 1.5;
    floatText(p.x, p.y - 36, "HIT!", "#FF4F8B");
  }

  function circleHit(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const rr = a.r + b.r;
    return dx * dx + dy * dy < rr * rr;
  }

  function update(dt) {
    game.time += dt;
    game.scroll += dt * (70 + game.level * 4);
    game.invuln = Math.max(0, game.invuln - dt);
    game.shake = Math.max(0, game.shake - dt * 30);
    if (game.player.shield > 0) game.player.shield -= dt;

    // 생존 시간 → 목숨 획득
    if (game.lives < MAX_LIVES) {
      game.surviveAcc += dt;
      if (game.surviveAcc >= game.nextLifeAt) grantSurvivalLife();
    }
    if (Math.floor(game.time * 4) !== Math.floor((game.time - dt) * 4)) {
      updateHud();
    }

    const nextLevel = 1 + Math.floor(game.score / 600) + Math.floor(game.time / 40);
    if (nextLevel !== game.level) {
      game.level = nextLevel;
      updateHud();
    }

    // player follow
    const p = game.player;
    p.x += (p.targetX - p.x) * Math.min(1, dt * 14);
    p.y += (p.targetY - p.y) * Math.min(1, dt * 14);
    p.x = clamp(p.x, 28, W - 28);
    p.y = clamp(p.y, H * 0.35, H - 48);
    firePlayer(dt);

    // clouds
    for (const c of game.clouds) {
      c.y += c.speed * dt;
      if (c.y - c.r > H) {
        c.y = -c.r;
        c.x = rand(0, W);
      }
    }

    // signs
    game.signTimer -= dt;
    if (game.signTimer <= 0) {
      spawnSign();
      game.signTimer = rand(4.5, 8.5);
    }
    for (const s of game.signs) s.y += s.speed * dt;
    game.signs = game.signs.filter((s) => s.y < H + 100);

    // enemies — 초반은 여유, 후반만 조금씩 빡세게 / 중간보스
    game.bossTimer -= dt;
    if (
      !game.bossActive &&
      game.bossesCleared < TOTAL_BOSSES &&
      game.time > 18 &&
      game.bossTimer <= 0
    ) {
      spawnMidBoss();
    }

    game.spawnTimer -= dt;
    const earlyEase = game.time < 12 ? 0.35 : 0;
    const bossSlow = game.bossActive ? 0.55 : 0;
    const spawnRate = Math.max(
      0.32,
      1.05 - game.difficulty * 0.055 + earlyEase + bossSlow
    );
    if (game.spawnTimer <= 0) {
      if (!game.bossActive || Math.random() < 0.35) {
        spawnEnemy();
        if (!game.bossActive && Math.random() < 0.18 + game.level * 0.025) spawnEnemy();
      }
      game.spawnTimer = spawnRate;
    }

    for (const e of game.enemies) {
      e.phase += dt * e.sway;
      e.shootCd -= dt;

      if (e.boss) {
        // 등장 후 상단에서 좌우로 떠다니며 탄막
        if (e.intro) {
          e.y += 70 * dt;
          if (e.y >= e.homeY) {
            e.y = e.homeY;
            e.intro = false;
          }
        } else {
          e.x = W / 2 + Math.sin(e.phase) * e.swayAmp;
          e.y = e.homeY + Math.sin(e.phase * 0.7) * 18;
        }
        e.x = clamp(e.x, 50, W - 50);

        if (!e.intro && e.shootCd <= 0) {
          e.pattern = (e.pattern + 1) % 3;
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          const st = e.stage || 1;
          const cool = Math.max(0.55, 1.35 - st * 0.06);
          if (e.pattern === 0) {
            e.shootCd = cool;
            const n = 8 + Math.min(8, st);
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + e.phase;
              const sp = 90 + st * 4;
              fireCuteBullet(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp + 35, "petal");
            }
          } else if (e.pattern === 1) {
            e.shootCd = cool * 0.75;
            const spread = st >= 6 ? 2 : 1;
            for (let i = -spread; i <= spread; i++) {
              fireCuteBullet(
                e.x,
                e.y + 12,
                Math.cos(ang + i * 0.18) * (140 + st * 5),
                Math.sin(ang + i * 0.18) * (140 + st * 5) + 35,
                "heart"
              );
            }
          } else {
            e.shootCd = cool * 0.9;
            const fan = 3 + Math.floor(st / 3);
            for (let i = -fan; i <= fan; i++) {
              const a = Math.PI / 2 + i * 0.16;
              fireCuteBullet(
                e.x,
                e.y + 10,
                Math.cos(a) * (110 + st * 4),
                Math.sin(a) * (130 + st * 4),
                i % 2 ? "star" : "candy"
              );
            }
          }
        }
        continue;
      }

      e.y += e.speed * dt;
      e.x += Math.sin(e.phase) * e.swayAmp * dt;
      e.x = clamp(e.x, 30, W - 30);
      if (e.shootCd <= 0 && e.y > 40 && e.y < H * 0.75) {
        e.shootCd = rand(1.5, 2.8) / (1 + game.level * 0.05);
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        const speed = 130 + game.level * 7;
        fireCuteBullet(
          e.x,
          e.y + 10,
          Math.cos(ang) * speed * 0.32,
          Math.sin(ang) * speed * 0.5 + 85
        );
        if (e.tough && game.level >= 3) {
          fireCuteBullet(
            e.x,
            e.y + 10,
            Math.cos(ang + 0.22) * speed * 0.28,
            Math.sin(ang + 0.22) * speed * 0.45 + 80,
            pick(["heart", "star", "candy"])
          );
        }
      }
    }
    game.enemies = game.enemies.filter((e) => {
      if (e.boss) return e.hp > 0;
      return e.y < H + 60 && e.hp > 0;
    });
    game.bossActive = game.enemies.some((e) => e.boss);

    // bullets
    for (const b of game.bullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.kind === "missile") {
        let nearest = null;
        let best = 1e9;
        for (const e of game.enemies) {
          const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
          if (d < best) {
            best = d;
            nearest = e;
          }
        }
        if (nearest) {
          const ang = Math.atan2(nearest.y - b.y, nearest.x - b.x);
          b.vx += Math.cos(ang) * 520 * dt;
          b.vy += Math.sin(ang) * 520 * dt;
          const sp = Math.hypot(b.vx, b.vy) || 1;
          const maxSp = 480;
          b.vx = (b.vx / sp) * maxSp;
          b.vy = (b.vy / sp) * maxSp;
        }
      }
    }
    game.bullets = game.bullets.filter(
      (b) => b.life > 0 && b.y > -40 && b.x > -40 && b.x < W + 40
    );

    for (const b of game.enemyBullets) {
      b.t += dt;
      b.spin += b.spinSp * dt;
      b.x += b.vx * dt + Math.sin(b.t * 6) * 8 * dt;
      b.y += b.vy * dt;
    }
    game.enemyBullets = game.enemyBullets.filter(
      (b) => b.y < H + 40 && b.y > -40 && b.x > -40 && b.x < W + 40
    );

    // items
    for (const it of game.items) {
      it.t += dt;
      it.y += it.vy * dt;
      it.x += Math.sin(it.t * 3) * 30 * dt;
    }
    game.items = game.items.filter((it) => it.y < H + 40);

    // collisions bullets vs enemies
    for (const b of game.bullets) {
      for (const e of game.enemies) {
        if (e.hp <= 0) continue;
        if (circleHit(b, e)) {
          e.hp -= b.dmg;
          b.life = 0;
          burst(b.x, b.y, b.color, 5);
          if (e.hp <= 0) {
            game.score += e.score;
            game.killCount += 1;
            burst(e.x, e.y, "#fff", e.boss ? 36 : 18);
            if (e.boss) {
              onMidBossDefeated(e);
            } else {
              SFX.explode();
              if (Math.random() < (e.tough ? 0.5 : 0.2)) spawnItem(e.x, e.y);
              updateHud();
            }
          } else {
            SFX.hitEnemy();
          }
          break;
        }
      }
    }
    game.enemies = game.enemies.filter((e) => e.hp > 0);
    game.bullets = game.bullets.filter((b) => b.life > 0);

    // enemy bullets / enemies vs player
    const hitbox = { x: p.x, y: p.y, r: p.r * 0.42 };
    for (const b of game.enemyBullets) {
      if (circleHit(hitbox, b)) {
        b.y = H + 99;
        hitPlayer();
      }
    }
    for (const e of game.enemies) {
      if (circleHit(hitbox, e)) {
        e.hp = 0;
        burst(e.x, e.y, "#fff", 12);
        hitPlayer();
      }
    }

    for (const it of game.items) {
      if (circleHit({ x: p.x, y: p.y, r: p.r }, it)) {
        applyItem(it.type);
        it.y = H + 99;
      }
    }
    game.items = game.items.filter((it) => it.y < H + 40);

    // particles
    for (const pt of game.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    }
    game.particles = game.particles.filter((pt) => pt.life > 0);

    for (const f of game.floats) {
      f.life -= dt;
      f.y -= 38 * dt;
    }
    game.floats = game.floats.filter((f) => f.life > 0);
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#9fd8ff");
    g.addColorStop(0.4, "#c8e4ff");
    g.addColorStop(0.7, "#ffd6ec");
    g.addColorStop(1, "#ffc0e0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // pastel stars like thumb
    for (let i = 0; i < 8; i += 1) {
      const sx = ((i * 97 + game.scroll * 0.15) % (W + 40)) - 20;
      const sy = 40 + (i * 53) % 220;
      const sr = 10 + (i % 3) * 4;
      ctx.fillStyle = i % 3 === 0 ? "#ffe27a" : i % 3 === 1 ? "#ff9ec8" : "#d4b0ff";
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
        const r = p % 2 === 0 ? sr : sr * 0.45;
        ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // soft sparkles
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 14; i += 1) {
      const x = ((i * 61 + game.scroll * 0.2) % W);
      const y = 20 + ((i * 79) % 260);
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 1.5, y);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 1.5, y);
      ctx.closePath();
      ctx.fill();
    }

    // pink fluffy clouds (thumb frame)
    for (const c of game.clouds) {
      ctx.globalAlpha = Math.min(0.95, c.alpha + 0.15);
      ctx.fillStyle = c.y > H * 0.55 ? "#ffc0dc" : "#fff";
      roundCloud(c.x, c.y, c.r);
    }
    ctx.globalAlpha = 1;

    // bottom pink cloud bank
    ctx.fillStyle = "rgba(255, 180, 210, 0.55)";
    ctx.beginPath();
    ctx.ellipse(60, H - 40, 90, 50, 0, 0, Math.PI * 2);
    ctx.ellipse(180, H - 20, 110, 55, 0, 0, Math.PI * 2);
    ctx.ellipse(320, H - 35, 100, 48, 0, 0, Math.PI * 2);
    ctx.fill();

    // cute path
    const roadTop = H * 0.62;
    ctx.fillStyle = "rgba(255, 240, 250, 0.35)";
    ctx.fillRect(0, roadTop, W, H - roadTop);

    ctx.fillStyle = "#ffe8f4";
    ctx.beginPath();
    ctx.moveTo(W * 0.28, roadTop);
    ctx.lineTo(W * 0.72, roadTop);
    ctx.lineTo(W * 0.88, H);
    ctx.lineTo(W * 0.12, H);
    ctx.closePath();
    ctx.fill();

    // confetti bits
    for (let i = 0; i < 10; i += 1) {
      const fx = ((i * 73 + game.scroll * 0.4) % (W + 40)) - 20;
      const fy = 80 + (i * 47) % 280;
      ctx.fillStyle = i % 3 === 0 ? "#7ec8ff" : i % 3 === 1 ? "#ff9ec5" : "#ffb347";
      ctx.fillRect(fx, fy, 6, 10);
    }
  }

  function roundCloud(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.arc(x + r * 0.45, y + 4, r * 0.42, 0, Math.PI * 2);
    ctx.arc(x - r * 0.4, y + 6, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSign(s) {
    const { ad, x, y, w, h } = s;
    // pole
    ctx.fillStyle = "#c9b8a0";
    const poleX = s.side === "left" ? x + 16 : x + w - 22;
    ctx.fillRect(poleX, y + h - 4, 6, 40);

    // board
    ctx.fillStyle = ad.bg || "#fff";
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = ad.accent || "#ff6b9d";
    ctx.lineWidth = 3;
    ctx.stroke();

    const img = images[`ad:${ad.id}`];
    if (img) {
      const pad = 8;
      ctx.drawImage(img, x + pad, y + pad, w - pad * 2, h - pad * 2);
    } else {
      ctx.fillStyle = ad.textColor || "#4a3545";
      ctx.textAlign = "center";
      ctx.font = "bold 14px Jua, sans-serif";
      ctx.fillText(ad.text || "AD", x + w / 2, y + h / 2 - 4);
      ctx.font = "11px Nunito, sans-serif";
      ctx.globalAlpha = 0.75;
      ctx.fillText(ad.subtext || "", x + w / 2, y + h / 2 + 14);
      ctx.globalAlpha = 1;
    }

    // little sparkle
    ctx.fillStyle = ad.accent || "#ff6b9d";
    ctx.beginPath();
    ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChar(id, x, y, size, alpha = 1) {
    const img = images[id];
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.48, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  function drawHeart(s) {
    ctx.beginPath();
    const t = s;
    ctx.moveTo(0, t * 0.3);
    ctx.bezierCurveTo(-t, -t * 0.35, -t * 1.1, t * 0.55, 0, t);
    ctx.bezierCurveTo(t * 1.1, t * 0.55, t, -t * 0.35, 0, t * 0.3);
    ctx.closePath();
  }

  function drawStar(s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? s : s * 0.42;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawEnemyBullet(b) {
    const pulse = 1 + Math.sin(b.t * 10) * 0.08;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.spin);
    ctx.scale(pulse, pulse);

    if (b.style === "heart") {
      ctx.fillStyle = "#FF6B9D";
      drawHeart(8);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(-2, -1, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.style === "star") {
      ctx.fillStyle = "#FFE27A";
      drawStar(8);
      ctx.fill();
      ctx.strokeStyle = "#FFB347";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "#fff8";
      ctx.beginPath();
      ctx.arc(-1.5, -1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.style === "candy") {
      // wrapper ends
      ctx.fillStyle = "#FF8AB5";
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-5, -4);
      ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(5, -4);
      ctx.lineTo(5, 4);
      ctx.closePath();
      ctx.fill();
      // body
      ctx.fillStyle = "#A5E1FF";
      roundRect(-5, -4, 10, 8, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(-1, -4, 2, 8);
    } else if (b.style === "bubble") {
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.45, "rgba(186,230,255,0.85)");
      g.addColorStop(1, "rgba(120,190,255,0.55)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-2.5, -2.5, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // petal / flower
      const colors = ["#FF9EC5", "#FFB4D0", "#FF8AB5"];
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.ellipse(0, -4.5, 3.2, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#FFE27A";
      ctx.beginPath();
      ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (game.shake > 0) {
      ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
    }

    drawBackground();

    for (const s of game.signs) drawSign(s);

    // items
    for (const it of game.items) {
      const meta = ITEM_TYPES[it.type];
      const bob = Math.sin(it.t * 5) * 3;
      ctx.beginPath();
      ctx.fillStyle = meta.color;
      ctx.arc(it.x, it.y + bob, it.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.emoji, it.x, it.y + bob + 1);
    }

    // enemy bullets
    for (const b of game.enemyBullets) drawEnemyBullet(b);

    // enemies
    for (const e of game.enemies) {
      if (e.boss) {
        // 글로우 링
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,95,151,${0.35 + 0.25 * Math.sin(game.time * 6)})`;
        ctx.lineWidth = 4;
        ctx.arc(e.x, e.y, e.r + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,226,122,0.45)";
        ctx.lineWidth = 2;
        ctx.arc(e.x, e.y, e.r + 18, 0, Math.PI * 2);
        ctx.stroke();
        // 왕관
        ctx.fillStyle = "#FFE27A";
        ctx.beginPath();
        ctx.moveTo(e.x - 16, e.y - e.r - 4);
        ctx.lineTo(e.x - 10, e.y - e.r - 18);
        ctx.lineTo(e.x - 4, e.y - e.r - 6);
        ctx.lineTo(e.x, e.y - e.r - 20);
        ctx.lineTo(e.x + 4, e.y - e.r - 6);
        ctx.lineTo(e.x + 10, e.y - e.r - 18);
        ctx.lineTo(e.x + 16, e.y - e.r - 4);
        ctx.closePath();
        ctx.fill();
      }
      drawChar(e.charId, e.x, e.y, e.r * 2.1);
      if (e.maxHp > 1) {
        const bw = e.boss ? e.r * 2.4 : e.r * 1.6;
        const by = e.y - e.r - (e.boss ? 28 : 12);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(e.x - bw / 2, by, bw, e.boss ? 8 : 5, 3);
        ctx.fill();
        ctx.fillStyle = e.boss ? "#FF6B9D" : "#7ED957";
        roundRect(e.x - bw / 2, by, bw * (e.hp / e.maxHp), e.boss ? 8 : 5, 3);
        ctx.fill();
        if (e.boss) {
          ctx.fillStyle = "#fff";
          ctx.font = "bold 11px Jua, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`중간보스 ${e.stage || "?"}/${TOTAL_BOSSES}`, e.x, by - 6);
        }
      }
    }

    // player bullets — 하트
    for (const b of game.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.kind === "missile") {
        ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        ctx.fillStyle = b.color || "#FF4F8B";
        drawHeart(11);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        drawHeart(5);
        ctx.fill();
      } else {
        ctx.fillStyle = b.color || "#FF6B9D";
        drawHeart(7);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(-1.5, -1.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // player
    const p = game.player;
    const blink = game.invuln > 0 && Math.floor(game.time * 12) % 2 === 0;
    if (!blink) {
      // soft shadow
      ctx.beginPath();
      ctx.fillStyle = "rgba(90,60,80,0.15)";
      ctx.ellipse(p.x, p.y + 26, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      drawChar(p.charId, p.x, p.y, 64);
    }
    if (p.shield > 0) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(126,217,87,${0.35 + 0.35 * Math.sin(game.time * 8)})`;
      ctx.lineWidth = 3;
      ctx.arc(p.x, p.y, 38, 0, Math.PI * 2);
      ctx.stroke();
    }

    // particles
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const f of game.floats) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = f.color;
      ctx.font = "bold 16px Jua, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // touch hint
    if (game.time < game.touchHintUntil) {
      hud.touchHint.classList.add("show");
    } else {
      hud.touchHint.classList.remove("show");
    }
  }

  function loop(ts) {
    if (state !== "playing") return;
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    try {
      update(dt);
      draw();
    } catch (err) {
      console.error(err);
    }
    raf = requestAnimationFrame(loop);
  }

  let pointerDown = false;

  function setPointer(clientX, clientY) {
    if (state !== "playing" || !game.player) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    game.player.targetX = clamp(x, 28, W - 28);
    game.player.targetY = clamp(y, H * 0.35, H - 48);
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      pointerDown = true;
      canvas.setPointerCapture(e.pointerId);
      setPointer(e.clientX, e.clientY);
    },
    { passive: true }
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (pointerDown) setPointer(e.clientX, e.clientY);
    },
    { passive: true }
  );
  canvas.addEventListener(
    "pointerup",
    () => {
      pointerDown = false;
    },
    { passive: true }
  );
  canvas.addEventListener(
    "pointercancel",
    () => {
      pointerDown = false;
    },
    { passive: true }
  );

  // idle idle animation on title
  function titleLoop() {
    if (state === "title" || state === "gameover") {
      ctx.clearRect(0, 0, W, H);
      // soft preview bg
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#9fd8ff");
      g.addColorStop(1, "#ffe8f0");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(titleLoop);
  }

    loadImages()
    .then(() => {
      setupTitle();
      titleLoop();
    })
    .catch((err) => {
      console.error(err);
      alert("이미지 로드에 실패했어요. 파일 경로를 확인해 주세요.");
    });
})();
