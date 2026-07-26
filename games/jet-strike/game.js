(() => {
  "use strict";

  const GAME_ID = "jet-strike";
  const W = 390;
  const H = 700;
  const STAGE_COUNT = 50;
  const MAX_MISSILE = 5;
  const MAX_LIVES = 5;
  const START_LIVES = 2;
  const ITEM_DROP_CHANCE = 0.09;

  const STAGE_NAMES = [
    "해상 초계", "섬 상공", "폭풍 전선", "적 함대", "보급 차단",
    "사막 협곡", "모래 폭풍", "요새 접근", "레이더망", "중급 시험",
    "야간 시가전", "네온 상공", "상층 침투", "구름 전투", "중간 보스전",
    "화산 전선", "재구름", "용암 회랑", "흑연 지대", "상급 시험",
    "빙하 상공", "극지 폭풍", "오로라 전선", "동토 요새", "거대 전함",
    "성층권", "궤도 접근", "인공위성 군", "우주 정거장", "전설 시험",
    "적 본대", "함대 결전", "스텔스 침투", "화력 집중", "공중 요새",
    "최종 방어선", "코어 접근", "플라즈마 장", "모함 강습", "최후 돌격",
    "암흑 전선", "차원 균열", "메가 드론", "초월 폭격기", "종말 포탑",
    "최후의 날", "결전의 하늘", "전설의 날개", "절대 영도", "최종 결전",
  ];

  const BOSS_META = [
    { img: "boss1", name: "건쉽 헬리", color: "#c89060" },
    { img: "boss2", name: "스텔스 폭격기", color: "#70d0ff" },
    { img: "boss3", name: "공중 요새", color: "#ff7060" },
    { img: "boss4", name: "모함 드론", color: "#d080ff" },
  ];

  const imgs = {
    player: null, enemy: null, bomber: null, stealth: null,
    boss1: null, boss2: null, boss3: null, boss4: null,
    missile: null, missile1: null, missile2: null, missile3: null,
    missile4: null, missile5: null,
    item: null, bombitem: null, bombblast: null, ebullet: null,
    bg1: null, bg2: null, bg3: null, bg4: null,
  };

  const MISSILE_PALETTE = [
    null,
    { bloom: "#ffe27a", flame: "#ff9040", trail: ["#ffe8a0", "#ffc060"] },
    { bloom: "#ffb050", flame: "#ff7040", trail: ["#ffe27a", "#ffb050", "#ff7040"] },
    { bloom: "#ff9040", flame: "#ff5020", trail: ["#ffe27a", "#ff9040", "#ff6030"] },
    { bloom: "#7ec8ff", flame: "#50a0ff", trail: ["#c8f0ff", "#7ec8ff", "#ffe27a"] },
    { bloom: "#e0b0ff", flame: "#ff60d0", trail: ["#ffffff", "#e0b0ff", "#7ec8ff", "#ffe27a"] },
  ];

  function punchKey(img) {
    if (!img) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if ((r > 185 && b > 175 && g < 145 && r + b > g * 2.1) || (r > 200 && b > 150 && g < 90)) {
        d[i + 3] = 0;
      }
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function loadAssets() {
    const jpgs = new Set(["bg1", "bg2", "bg3", "bg4"]);
    return Promise.all(
      Object.keys(imgs).map(
        (key) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              imgs[key] = jpgs.has(key) ? im : punchKey(im) || im;
              res();
            };
            im.onerror = () => res();
            im.src = jpgs.has(key) ? `assets/${key}.jpg` : `assets/${key}.png`;
          })
      )
    );
  }

  function makeStage(i) {
    const t = i / (STAGE_COUNT - 1);
    const waves = [];
    const n = 22 + Math.floor(i * 1.4);
    const gap = Math.max(0.55, 1.15 - i * 0.02);
    for (let k = 0; k < n; k++) {
      let kind = "enemy";
      const roll = ((i * 17 + k * 29) % 100) / 100;
      if (i >= 2 && roll < 0.22 + t * 0.15) kind = "bomber";
      if (i >= 4 && ((i * 11 + k * 19) % 100) / 100 < 0.18 + t * 0.2) kind = "stealth";
      waves.push({
        kind,
        t: 1.2 + k * gap,
        x: 50 + ((i * 47 + k * 73) % 290),
      });
    }
    const boss = BOSS_META[i % BOSS_META.length];
    return {
      name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
      bg: `bg${(i % 4) + 1}`,
      waves,
      bossDelay: 2.8,
      boss: {
        ...boss,
        hp: 220 + i * 65,
        speed: 55 + i * 3,
        fireRate: Math.max(0.45, 1.1 - i * 0.035),
      },
      enemyHp: 1 + Math.floor(i * 0.35),
      enemySpeed: 70 + i * 6,
      scroll: 40 + i * 4,
    };
  }

  const STAGES = Array.from({ length: STAGE_COUNT }, (_, i) => makeStage(i));

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

  const hudStage = document.getElementById("hud-stage");
  const hudStageMax = document.getElementById("hud-stage-max");
  const hudScore = document.getElementById("hud-score");
  const hudLives = document.getElementById("hud-lives");
  const hudMissile = document.getElementById("hud-missile");
  const hudShield = document.getElementById("hud-shield");
  const hudBomb = document.getElementById("hud-bomb");
  const bossBar = document.getElementById("boss-bar");
  const bossName = document.getElementById("boss-name");
  const bossFill = document.getElementById("boss-fill");
  const hint = document.getElementById("hint");
  const bombBtn = document.getElementById("bomb-btn");
  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const MOVE_SPEED = 340;
  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let lives = START_LIVES;
  let missileLv = 1;
  let shield = 0;
  let bomb = 2;
  let player = null;
  let enemies = [];
  let bullets = [];
  let ebullets = [];
  let items = [];
  let particles = [];
  let floats = [];
  let bombFx = [];
  let boss = null;
  let phase = "wave"; // wave | bossWait | boss | clear
  let spawnQueue = [];
  let spawnAcc = 0;
  let bossWait = 0;
  let fireCd = 0;
  let invuln = 0;
  let bombCd = 0;
  let scrollY = 0;
  let shake = 0;
  let flash = 0;
  let hintTimer = 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let pointerId = null;
  let touchX = 0;
  let touchY = 0;
  let keys = { left: false, right: false, up: false, down: false };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function updateHud() {
    hudStage.textContent = String(stageIndex + 1);
    if (hudStageMax) hudStageMax.textContent = String(STAGE_COUNT);
    hudScore.textContent = String(score);
    hudLives.textContent = String(lives);
    hudMissile.textContent = `Lv.${missileLv}`;
    hudShield.textContent = String(shield);
    hudBomb.textContent = String(bomb);
    bombBtn.disabled = bomb <= 0 || bombCd > 0 || state !== "play";
    bombBtn.classList.toggle("hidden", state !== "play" && state !== "paused");
    if (boss && phase === "boss") {
      bossBar.classList.remove("hidden");
      bossName.textContent = boss.name;
      bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    } else {
      bossBar.classList.add("hidden");
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1, vy: -36 });
  }

  const MAX_PARTICLES = 160;

  function pushParticle(p) {
    if (particles.length >= MAX_PARTICLES) {
      // drop oldest cheaply instead of growing forever (was freezing the tab)
      particles.splice(0, Math.max(8, particles.length - MAX_PARTICLES + 8));
    }
    particles.push(p);
  }

  function burst(x, y, color, n = 10) {
    const room = Math.max(0, MAX_PARTICLES - particles.length);
    const count = Math.min(n, room || 6);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 160);
      pushParticle({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.25, 0.6), r: rand(2, 5), color,
      });
    }
  }

  function resetPlayer() {
    player = {
      x: W / 2,
      y: H - 110,
      r: 18,
      bob: 0,
    };
    touchX = player.x;
    touchY = player.y;
  }

  function resetStage() {
    const st = STAGES[stageIndex];
    enemies = [];
    bullets = [];
    ebullets = [];
    items = [];
    particles = [];
    floats = [];
    bombFx = [];
    boss = null;
    phase = "wave";
    spawnQueue = st.waves.map((w) => ({ ...w }));
    spawnAcc = 0;
    bossWait = 0;
    fireCd = 0;
    bombCd = 0;
    invuln = 1;
    scrollY = 0;
    hintTimer = 2.5;
    hint.classList.remove("fade", "hidden");
    hint.textContent = `${st.name} · 방향키/터치 이동 · 폭탄(B)`;
    if (stageIndex === 0) {
      missileLv = 1;
      shield = 0;
      bomb = 2;
      lives = START_LIVES;
    }
    resetPlayer();
    bombBtn.classList.remove("hidden");
    updateHud();
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    overlays.title.classList.add("hidden");
    overlays.clear.classList.add("hidden");
    overlays.over.classList.add("hidden");
    overlays.all.classList.add("hidden");
    stageIndex = 0;
    score = 0;
    lives = START_LIVES;
    missileLv = 1;
    shield = 0;
    bomb = 2;
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function nextStage() {
    overlays.clear.classList.add("hidden");
    stageIndex += 1;
    if (stageIndex >= STAGE_COUNT) {
      allClear();
      return;
    }
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stageClear() {
    if (state !== "play") return;
    const bonus = 200 + stageIndex * 40 + missileLv * 30 + shield * 40;
    score += bonus;
    // every 3 stages cleared → life item
    const cleared = stageIndex + 1;
    let lifeNote = "";
    if (cleared % 3 === 0 && lives < MAX_LIVES) {
      lives += 1;
      lifeNote = ` · 생명 +1 (현재 ${lives})`;
      dropItem(W / 2, H * 0.4, "life");
    } else if (cleared % 3 === 0 && lives >= MAX_LIVES) {
      score += 100;
      lifeNote = " · 생명 MAX 보너스 +100";
    }
    state = "clear";
    phase = "clear";
    document.getElementById("clear-detail").textContent =
      `${STAGES[stageIndex].name} 클리어 · +${bonus}${lifeNote}`;
    overlays.clear.classList.remove("hidden");
    hint.classList.add("hidden");
    bombBtn.classList.add("hidden");
    updateHud();
  }

  function gameOver() {
    state = "over";
    document.getElementById("over-detail").textContent =
      `STAGE ${stageIndex + 1} · 점수 ${score}`;
    overlays.over.classList.remove("hidden");
    hint.classList.add("hidden");
    bombBtn.classList.add("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "제트 스트라이크", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function allClear() {
    state = "all";
    score += 1000;
    document.getElementById("all-detail").textContent = `최종 점수 ${score}`;
    overlays.all.classList.remove("hidden");
    bombBtn.classList.add("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "제트 스트라이크", formParent: overlays.all });
      TodayGameRank.open(score);
    }
  }

  function hurtPlayer() {
    if (invuln > 0 || state !== "play") return;
    if (shield > 0) {
      shield -= 1;
      invuln = 1.0;
      shake = 0.25;
      burst(player.x, player.y, "#7ec8ff", 14);
      addFloat(player.x, player.y - 30, "실드!", "#7ec8ff");
      updateHud();
      return;
    }
    lives -= 1;
    invuln = 1.4;
    shake = 0.4;
    flash = 0.25;
    burst(player.x, player.y, "#ff6a5a", 22);
    ebullets = [];
    addFloat(player.x, player.y - 40, lives > 0 ? `생명 ${lives}` : "격추!", "#ff8a8a");
    updateHud();
    if (lives <= 0) gameOver();
  }

  function spawnEnemy(kind, x) {
    const st = STAGES[stageIndex];
    const defs = {
      enemy: { hp: st.enemyHp, speed: st.enemySpeed, score: 20, r: 22, w: 52, h: 58, img: "enemy" },
      bomber: { hp: st.enemyHp + 2, speed: st.enemySpeed * 0.65, score: 40, r: 28, w: 70, h: 58, img: "bomber" },
      stealth: { hp: st.enemyHp + 1, speed: st.enemySpeed * 1.35, score: 35, r: 20, w: 48, h: 60, img: "stealth" },
    };
    const d = defs[kind] || defs.enemy;
    enemies.push({
      kind, x, y: -40,
      vx: rand(-30, 30),
      hp: d.hp, maxHp: d.hp,
      speed: d.speed, score: d.score, r: d.r,
      w: d.w, h: d.h, img: d.img,
      fireCd: rand(0.6, 1.4),
      bob: rand(0, Math.PI * 2),
    });
  }

  function startBoss() {
    const st = STAGES[stageIndex];
    const b = st.boss;
    phase = "boss";
    boss = {
      name: b.name,
      img: b.img,
      color: b.color,
      x: W / 2,
      y: 120,
      vx: 70,
      hp: b.hp,
      maxHp: b.hp,
      r: 55,
      w: 140,
      h: 120,
      fireCd: 0.5,
      fireRate: b.fireRate,
      pattern: 0,
      bob: 0,
    };
    showItemRare(true);
    updateHud();
    addFloat(W / 2, 200, "WARNING", "#ff6a5a");
    shake = 0.35;
  }

  function missileStats(lv) {
    const L = Math.max(1, Math.min(MAX_MISSILE, lv));
    return {
      dmg: 1 + Math.floor((L - 1) * 0.8),
      count: L <= 2 ? 1 : L <= 4 ? 2 : 3,
      spread: L <= 2 ? 0 : L === 3 ? 10 : L === 4 ? 14 : 18,
      speed: 520 + L * 30,
      rate: Math.max(0.12, 0.22 - L * 0.015),
      scale: 1.25 + L * 0.32,
      glow: 0.35 + L * 0.12,
    };
  }

  function missileSprite(lv) {
    const L = Math.max(1, Math.min(MAX_MISSILE, lv | 0));
    return imgs[`missile${L}`] || imgs.missile;
  }

  function firePlayer() {
    if (!player) return;
    const ms = missileStats(missileLv);
    const angles = [];
    if (ms.count === 1) angles.push(-Math.PI / 2);
    else if (ms.count === 2) {
      angles.push(-Math.PI / 2 - 0.12, -Math.PI / 2 + 0.12);
    } else {
      angles.push(-Math.PI / 2 - 0.2, -Math.PI / 2, -Math.PI / 2 + 0.2);
    }
    // light muzzle spark (heavy burst was flooding particles)
    if (particles.length < MAX_PARTICLES - 20) {
      burst(player.x, player.y - 28, "#ffe27a", 2 + Math.min(2, missileLv));
    }
    for (const ang of angles) {
      bullets.push({
        x: player.x + Math.cos(ang) * 10,
        y: player.y - 24,
        vx: Math.cos(ang) * ms.speed,
        vy: Math.sin(ang) * ms.speed,
        dmg: ms.dmg,
        r: 12 + missileLv * 2,
        life: 1.4,
        scale: ms.scale,
        glow: ms.glow,
        lv: missileLv,
        trail: true,
        spin: 0,
        trailCd: 0,
      });
    }
  }

  function dropItem(x, y, forceType) {
    const types = ["missile", "missile", "shield", "rapid", "bomb"];
    const type = forceType || types[Math.floor(Math.random() * types.length)];
    items.push({
      x, y, type, r: 18, bob: rand(0, Math.PI * 2), life: 8, vy: 55,
    });
  }

  function showItemRare(fromBoss) {
    if (fromBoss || Math.random() < 0.35) {
      dropItem(rand(80, W - 80), -20, Math.random() < 0.55 ? "missile" : "shield");
    }
  }

  function useBomb() {
    if (state !== "play" || bomb <= 0 || bombCd > 0 || phase === "clear") return;
    bomb -= 1;
    bombCd = 0.7;
    ebullets = [];
    flash = 0.55;
    shake = 0.8;

    // wipe all normal enemies on screen
    for (const e of enemies.slice()) {
      score += e.score;
      burst(e.x, e.y, "#ff9040", 10);
      bombFx.push({
        x: e.x, y: e.y, life: 0.45, max: 0.45, delay: 0, grow: 1.1,
      });
    }
    enemies = [];

    // heavy boss damage (~35% max HP, minimum 90)
    if (boss && phase === "boss") {
      const dmg = Math.max(90, Math.round(boss.maxHp * 0.35));
      boss.hp -= dmg;
      burst(boss.x, boss.y, boss.color, 18);
      bombFx.push({
        x: boss.x, y: boss.y, life: 0.65, max: 0.65, delay: 0, grow: 1.6,
      });
      addFloat(boss.x, boss.y - 20, `-${dmg}`, "#ff9040");
      if (boss.hp <= 0) {
        score += 500 + stageIndex * 50;
        burst(boss.x, boss.y, boss.color, 22);
        addFloat(boss.x, boss.y, "BOSS DOWN", "#ffe27a");
        boss = null;
        phase = "clear";
        updateHud();
        // let bomb blast animate before clear overlay
        setTimeout(() => {
          if (state === "play") stageClear();
        }, 500);
      }
    }

    // cascading screen blasts (image-based)
    const originX = player ? player.x : W / 2;
    const originY = player ? player.y : H * 0.7;
    bombFx.push({ x: originX, y: originY, life: 0.75, max: 0.75, delay: 0, grow: 2.2 });
    for (let i = 0; i < 6; i++) {
      bombFx.push({
        x: rand(50, W - 50),
        y: rand(80, H - 80),
        life: 0.55 + rand(0, 0.2),
        max: 0.7,
        delay: 0.05 + i * 0.05,
        grow: 1.2 + rand(0, 0.6),
      });
    }
    // expanding shock rings (drawn procedurally)
    for (let i = 0; i < 3; i++) {
      bombFx.push({
        x: originX, y: originY,
        life: 0.6 + i * 0.08, max: 0.7,
        delay: i * 0.06,
        grow: 1.4 + i * 0.35,
        ring: true,
      });
    }
    for (let i = 0; i < 22; i++) {
      pushParticle({
        x: rand(20, W - 20),
        y: rand(40, H - 40),
        vx: rand(-120, 120),
        vy: rand(-160, 60),
        life: rand(0.35, 0.75),
        r: rand(3, 8),
        color: Math.random() < 0.45 ? "#ffe27a" : Math.random() < 0.5 ? "#ff9040" : "#ff5030",
      });
    }
    addFloat(originX, originY - 50, "전맵 폭격!", "#ff9040");
    if (bombFx.length > 28) bombFx.splice(0, bombFx.length - 28);
    updateHud();
  }

  function bossPatternCount() {
    const s = stageIndex;
    if (s >= 40) return 10;
    if (s >= 30) return 9;
    if (s >= 22) return 8;
    if (s >= 15) return 7;
    if (s >= 10) return 6;
    if (s >= 6) return 5;
    if (s >= 3) return 4;
    return 3;
  }

  function pushEBullet(x, y, vx, vy, r = 7, life = 4.2) {
    ebullets.push({ x, y, vx, vy, r, life });
  }

  function fireBossAttack() {
    if (!boss || !player) return;
    const tier = bossPatternCount();
    boss.pattern = (boss.pattern + 1) % tier;
    const p = boss.pattern;
    const bx = boss.x;
    const by = boss.y;
    const spdBoost = 1 + stageIndex * 0.012;
    const aim = Math.atan2(player.y - by, player.x - bx);

    if (p === 0) {
      // triple drop
      for (let a = -1; a <= 1; a++) {
        pushEBullet(bx, by + 40, a * 70, 190 * spdBoost, 8);
      }
    } else if (p === 1) {
      // 5-way fan
      for (let k = 0; k < 5; k++) {
        const ang = Math.PI / 2 + (k - 2) * 0.28;
        pushEBullet(bx, by + 30, Math.cos(ang) * 175 * spdBoost, Math.sin(ang) * 175 * spdBoost);
      }
    } else if (p === 2) {
      // aimed triple
      for (let k = 0; k < 3; k++) {
        pushEBullet(
          bx + (k - 1) * 20, by + 35,
          Math.cos(aim) * 205 * spdBoost,
          Math.sin(aim) * 205 * spdBoost, 8
        );
      }
    } else if (p === 3) {
      // full ring
      const n = 10 + Math.floor(stageIndex / 10);
      for (let k = 0; k < n; k++) {
        const ang = (Math.PI * 2 * k) / n + boss.bob * 0.2;
        pushEBullet(bx, by + 10, Math.cos(ang) * 140 * spdBoost, Math.sin(ang) * 140 * spdBoost, 6, 4.5);
      }
    } else if (p === 4) {
      // cross + diagonals
      for (let a = 0; a < 8; a++) {
        const ang = (Math.PI / 4) * a;
        pushEBullet(bx, by + 20, Math.cos(ang) * 165 * spdBoost, Math.sin(ang) * 165 * spdBoost, 7);
      }
    } else if (p === 5) {
      // wide aimed shotgun
      for (let k = -3; k <= 3; k++) {
        const ang = aim + k * 0.14;
        pushEBullet(bx, by + 28, Math.cos(ang) * 195 * spdBoost, Math.sin(ang) * 195 * spdBoost, 6);
      }
    } else if (p === 6) {
      // spiral burst
      const base = boss.bob * 3;
      for (let k = 0; k < 8; k++) {
        const ang = base + k * 0.75;
        pushEBullet(bx, by + 15, Math.cos(ang) * 155 * spdBoost, Math.sin(ang) * 155 * spdBoost, 6, 4.8);
      }
    } else if (p === 7) {
      // rain curtains
      for (let k = 0; k < 7; k++) {
        pushEBullet(40 + k * 50, by + 50, rand(-20, 20), (150 + k * 8) * spdBoost, 7, 5);
      }
    } else if (p === 8) {
      // twin aimed waves
      for (let wave = 0; wave < 2; wave++) {
        for (let k = -2; k <= 2; k++) {
          const ang = aim + k * 0.22 + (wave ? 0.08 : -0.08);
          const sp = (170 + wave * 40) * spdBoost;
          pushEBullet(bx + (wave ? 18 : -18), by + 30, Math.cos(ang) * sp, Math.sin(ang) * sp, 7);
        }
      }
    } else {
      // ultimate: ring + aimed core
      const n = 12;
      for (let k = 0; k < n; k++) {
        const ang = (Math.PI * 2 * k) / n;
        pushEBullet(bx, by + 8, Math.cos(ang) * 130 * spdBoost, Math.sin(ang) * 130 * spdBoost, 6, 4.5);
      }
      for (let k = -2; k <= 2; k++) {
        const ang = aim + k * 0.1;
        pushEBullet(bx, by + 35, Math.cos(ang) * 230 * spdBoost, Math.sin(ang) * 230 * spdBoost, 8, 4);
      }
    }
  }

  function pickup(item) {
    if (item.type === "missile") {
      if (missileLv < MAX_MISSILE) {
        missileLv += 1;
        addFloat(item.x, item.y, `미사일 Lv.${missileLv}`, "#ffe27a");
      } else {
        score += 50;
        addFloat(item.x, item.y, "+50", "#ffe27a");
      }
    } else if (item.type === "shield") {
      shield = Math.min(3, shield + 1);
      addFloat(item.x, item.y, "실드 +1", "#7ec8ff");
    } else if (item.type === "rapid") {
      fireCd = -0.8;
      addFloat(item.x, item.y, "연사!", "#9ae06a");
    } else if (item.type === "bomb") {
      bomb = Math.min(5, bomb + 1);
      addFloat(item.x, item.y, "폭탄 +1", "#ff9040");
    } else if (item.type === "life") {
      if (lives < MAX_LIVES) {
        lives += 1;
        addFloat(item.x, item.y, "생명 +1", "#9ae06a");
      } else {
        score += 80;
        addFloat(item.x, item.y, "+80", "#9ae06a");
      }
    }
    burst(item.x, item.y, "#ffe27a", 12);
    updateHud();
  }

  function killEnemy(e) {
    score += e.score;
    burst(e.x, e.y, "#ffb070", 8);
    addFloat(e.x, e.y - 10, `+${e.score}`, "#ffe27a");
    if (Math.random() < ITEM_DROP_CHANCE) dropItem(e.x, e.y);
    enemies = enemies.filter((x) => x !== e);
    updateHud();
  }

  function update(dt) {
    time += dt;
    const st = STAGES[stageIndex];
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
    if (invuln > 0) invuln -= dt;
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hint.classList.add("fade");
    }

    scrollY += st.scroll * dt;
    if (bombCd > 0) bombCd -= dt;

    // continuous movement: keyboard hold + touch hold
    let mx = 0;
    let my = 0;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      player.x += (mx / len) * MOVE_SPEED * dt;
      player.y += (my / len) * MOVE_SPEED * dt;
    } else if (pointerId != null) {
      const dx = touchX - player.x;
      const dy = touchY - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 3) {
        const step = Math.min(dist, MOVE_SPEED * dt);
        player.x += (dx / dist) * step;
        player.y += (dy / dist) * step;
      }
    }
    player.x = Math.max(28, Math.min(W - 28, player.x));
    player.y = Math.max(80, Math.min(H - 50, player.y));
    player.bob += dt * 8;

    fireCd -= dt;
    if (fireCd <= 0 && phase !== "clear") {
      firePlayer();
      fireCd = missileStats(missileLv).rate;
    }

    // spawn waves → wait → boss
    if (phase === "wave") {
      spawnAcc += dt;
      while (spawnQueue.length && spawnAcc >= spawnQueue[0].t) {
        const s = spawnQueue.shift();
        spawnEnemy(s.kind, s.x);
      }
      if (spawnQueue.length === 0 && enemies.length === 0) {
        phase = "bossWait";
        bossWait = st.bossDelay || 2.8;
        addFloat(W / 2, H * 0.35, "중간 보스 접근 중…", "#ffb0a0");
      }
    } else if (phase === "bossWait") {
      bossWait -= dt;
      if (bossWait <= 0) startBoss();
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.bob += dt * 4;
      e.y += e.speed * dt;
      e.x += e.vx * dt + Math.sin(e.bob) * 20 * dt;
      if (e.x < 30 || e.x > W - 30) e.vx *= -1;
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.y > 40 && e.y < H - 80) {
        e.fireCd = e.kind === "bomber" ? 1.4 : e.kind === "stealth" ? 0.9 : 1.2;
        const ang = Math.atan2(player.y - e.y, player.x - e.x);
        ebullets.push({
          x: e.x, y: e.y + 10,
          vx: Math.cos(ang) * 160,
          vy: Math.sin(ang) * 160 + 40,
          r: 7, life: 4,
        });
      }
      if (e.y > H + 40) enemies.splice(i, 1);
      else if (Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r) {
        hurtPlayer();
        e.hp -= 2;
        if (e.hp <= 0) killEnemy(e);
      }
    }

    // boss
    if (boss && phase === "boss") {
      boss.bob += dt * 2;
      boss.x += boss.vx * dt;
      if (boss.x < 70 || boss.x > W - 70) boss.vx *= -1;
      boss.y = 110 + Math.sin(boss.bob) * 18;
      boss.fireCd -= dt;
      if (boss.fireCd <= 0) {
        boss.fireCd = boss.fireRate;
        fireBossAttack();
      }
      if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.r + player.r - 10) {
        hurtPlayer();
      }
      updateHud();
    }

    // player bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.spin = (b.spin || 0) + dt * 10;
      // throttled trail — every-frame spawn was freezing the browser
      if (b.trail) {
        b.trailCd = (b.trailCd || 0) - dt;
        if (b.trailCd <= 0 && particles.length < MAX_PARTICLES - 10) {
          b.trailCd = b.lv >= 4 ? 0.028 : 0.045;
          const pal = MISSILE_PALETTE[b.lv] || MISSILE_PALETTE[1];
          const colors = pal.trail;
          pushParticle({
            x: b.x + rand(-3, 3),
            y: b.y + 10 + rand(0, 6),
            vx: rand(-20, 20),
            vy: rand(35, 90),
            life: rand(0.16, 0.32),
            r: rand(2.2, 4.5 + b.lv * 0.35),
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }
      }
      let hit = false;
      for (const e of enemies) {
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
          e.hp -= b.dmg;
          hit = true;
          burst(b.x, b.y, "#ffe27a", 4 + Math.min(3, b.lv));
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
      if (!hit && boss && phase === "boss" && Math.hypot(b.x - boss.x, b.y - boss.y) < boss.r) {
        boss.hp -= b.dmg;
        hit = true;
        burst(b.x, b.y, boss.color, 4 + Math.min(3, b.lv));
        if (boss.hp <= 0) {
          score += 500 + stageIndex * 50;
          burst(boss.x, boss.y, boss.color, 28);
          addFloat(boss.x, boss.y, "BOSS DOWN", "#ffe27a");
          boss = null;
          phase = "clear";
          updateHud();
          stageClear();
        }
      }
      if (hit || b.life <= 0 || b.y < -40) bullets.splice(i, 1);
    }

    // enemy bullets
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (Math.hypot(b.x - player.x, b.y - player.y) < player.r + b.r) {
        hurtPlayer();
        ebullets.splice(i, 1);
        continue;
      }
      if (b.life <= 0 || b.y > H + 30 || b.x < -20 || b.x > W + 20) ebullets.splice(i, 1);
    }

    // items
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.bob += dt * 5;
      it.y += it.vy * dt;
      it.life -= dt;
      if (Math.hypot(it.x - player.x, it.y - player.y) < it.r + player.r + 8) {
        pickup(it);
        items.splice(i, 1);
        continue;
      }
      if (it.life <= 0 || it.y > H + 40) items.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
    for (let i = bombFx.length - 1; i >= 0; i--) {
      const fx = bombFx[i];
      if (fx.delay > 0) {
        fx.delay -= dt;
        continue;
      }
      fx.life -= dt;
      if (fx.life <= 0) bombFx.splice(i, 1);
    }
  }

  function drawImg(g, img, x, y, w, h, rot) {
    if (!img) return false;
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.drawImage(img, -w / 2, -h / 2, w, h);
    g.restore();
    return true;
  }

  function draw(g) {
    g.save();
    if (shake > 0) g.translate(rand(-3, 3) * shake * 5, rand(-2, 2) * shake * 5);

    const st = STAGES[stageIndex];
    const bg = imgs[st.bg] || imgs.bg1;
    if (bg) {
      const bh = H;
      const off = scrollY % bh;
      g.drawImage(bg, 0, off - bh, W, bh + 2);
      g.drawImage(bg, 0, off, W, bh + 2);
    } else {
      g.fillStyle = "#0a2040";
      g.fillRect(0, 0, W, H);
    }

    // soft vignette
    const vig = g.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 420);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    // items
    for (const it of items) {
      const bob = Math.sin(it.bob) * 4;
      g.save();
      g.globalAlpha = 0.95;
      let drawn = false;
      if (it.type === "bomb" && imgs.bombitem) {
        drawn = drawImg(g, imgs.bombitem, it.x, it.y + bob, 40, 40, 0);
      } else if (it.type === "missile") {
        const nextLv = Math.min(MAX_MISSILE, missileLv + 1);
        const spr = missileSprite(nextLv);
        drawn = drawImg(g, spr, it.x, it.y + bob, 28, 48, 0);
      } else {
        drawn = drawImg(g, imgs.item, it.x, it.y + bob, 36, 42, 0);
      }
      if (!drawn) {
        g.fillStyle = it.type === "bomb" ? "#ff7040" : "#ffe27a";
        g.beginPath();
        g.arc(it.x, it.y + bob, 14, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      g.fillStyle = "#fff";
      g.font = '10px "Jua"';
      g.textAlign = "center";
      const label =
        it.type === "missile" ? `MIS${Math.min(MAX_MISSILE, missileLv + 1)}` :
        it.type === "shield" ? "SHD" :
        it.type === "bomb" ? "BOM" :
        it.type === "life" ? "LIFE" : "RPD";
      g.fillText(label, it.x, it.y + bob + 28);
    }

    // enemies
    for (const e of enemies) {
      const bob = Math.sin(e.bob) * 2;
      drawImg(g, imgs[e.img], e.x, e.y + bob, e.w, e.h, 0);
      if (e.hp < e.maxHp) {
        const bw = e.w * 0.6;
        g.fillStyle = "rgba(0,0,0,0.4)";
        g.fillRect(e.x - bw / 2, e.y - e.h / 2 - 10, bw, 4);
        g.fillStyle = "#ff6a5a";
        g.fillRect(e.x - bw / 2, e.y - e.h / 2 - 10, bw * (e.hp / e.maxHp), 4);
      }
    }

    // boss
    if (boss) {
      const bob = Math.sin(boss.bob) * 3;
      // soft glow under boss (no square)
      g.fillStyle = boss.color + "33";
      g.beginPath();
      g.ellipse(boss.x, boss.y + bob + 10, 70, 50, 0, 0, Math.PI * 2);
      g.fill();
      drawImg(g, imgs[boss.img], boss.x, boss.y + bob, boss.w, boss.h, 0);
    }

    // bullets — level-specific missile sprites
    for (const b of bullets) {
      const ang = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      const lv = Math.max(1, Math.min(MAX_MISSILE, b.lv || 1));
      const sc = 40 * (b.scale || 1.5);
      const mw = sc * (0.38 + lv * 0.02);
      const mh = sc * (0.95 + lv * 0.04);
      const pulse = 0.75 + Math.sin(time * 18 + (b.spin || 0)) * 0.15;
      const pal = MISSILE_PALETTE[lv] || MISSILE_PALETTE[1];

      g.save();
      g.translate(b.x, b.y);
      g.rotate(ang);

      g.globalAlpha = 0.4 * pulse;
      g.fillStyle = pal.bloom;
      g.beginPath();
      g.ellipse(0, mh * 0.12, 9 + lv * 2, 14 + lv * 2.5, 0, 0, Math.PI * 2);
      g.fill();

      g.globalAlpha = 0.9;
      g.fillStyle = "#fff6c8";
      g.beginPath();
      g.moveTo(-3.5 - lv * 0.7, mh * 0.1);
      g.lineTo(3.5 + lv * 0.7, mh * 0.1);
      g.lineTo(0, mh * 0.52 + lv * 2.2);
      g.closePath();
      g.fill();
      g.fillStyle = pal.flame;
      g.beginPath();
      g.moveTo(-2 - lv * 0.3, mh * 0.16);
      g.lineTo(2 + lv * 0.3, mh * 0.16);
      g.lineTo(0, mh * 0.42 + lv);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;

      if (!drawImg(g, missileSprite(lv), 0, 0, mw, mh, 0)) {
        g.fillStyle = pal.bloom;
        g.beginPath();
        g.moveTo(0, -mh * 0.4);
        g.lineTo(mw * 0.35, mh * 0.2);
        g.lineTo(0, mh * 0.35);
        g.lineTo(-mw * 0.35, mh * 0.2);
        g.closePath();
        g.fill();
      }

      if (lv >= 3) {
        g.fillStyle = "#ffffff";
        g.globalAlpha = 0.9;
        g.beginPath();
        g.arc(0, -mh * 0.3, 2 + lv * 0.35, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      g.restore();
    }
    for (const b of ebullets) {
      if (!drawImg(g, imgs.ebullet, b.x, b.y, 16, 16, 0)) {
        g.fillStyle = "#ff5a4a";
        g.beginPath();
        g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        g.fill();
      }
    }

    // player
    if (player) {
      const bob = Math.sin(player.bob) * 2;
      g.save();
      if (invuln > 0 && Math.floor(time * 18) % 2 === 0) g.globalAlpha = 0.4;
      // engine glow
      g.fillStyle = "rgba(120,200,255,0.35)";
      g.beginPath();
      g.ellipse(player.x, player.y + 28 + bob, 8, 14, 0, 0, Math.PI * 2);
      g.fill();
      drawImg(g, imgs.player, player.x, player.y + bob, 56, 72, 0);
      if (shield > 0) {
        g.strokeStyle = `rgba(120,200,255,${0.35 + Math.sin(time * 6) * 0.15})`;
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(player.x, player.y + bob, 32, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life * 1.5);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // bomb blast sprites + shock rings
    for (const fx of bombFx) {
      if (fx.delay > 0) continue;
      const t = 1 - fx.life / fx.max;
      const alpha = Math.max(0, fx.life / fx.max);
      const size = (70 + t * 160) * (fx.grow || 1);
      if (fx.ring) {
        g.save();
        g.globalAlpha = alpha * 0.85;
        g.strokeStyle = t < 0.4 ? "#fff6c8" : "#ff7040";
        g.lineWidth = 4 - t * 2;
        g.beginPath();
        g.arc(fx.x, fx.y, size * 0.55, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = alpha * 0.35;
        g.strokeStyle = "#ffe27a";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(fx.x, fx.y, size * 0.75, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      } else {
        g.save();
        g.globalAlpha = alpha * 0.95;
        if (!drawImg(g, imgs.bombblast, fx.x, fx.y, size, size, t * 0.4)) {
          g.fillStyle = `rgba(255,160,60,${alpha})`;
          g.beginPath();
          g.arc(fx.x, fx.y, size * 0.35, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
    }

    for (const f of floats) {
      g.globalAlpha = Math.min(1, f.life * 1.4);
      g.fillStyle = f.color;
      g.font = '700 14px "Jua"';
      g.textAlign = "center";
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;

    if (flash > 0) {
      g.fillStyle = `rgba(255,${180 + Math.floor(flash * 60)},${100 + Math.floor(flash * 40)},${Math.min(0.55, flash)})`;
      g.fillRect(0, 0, W, H);
    }

    g.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    try {
      if (state === "play") {
        update(dt);
        draw(ctx);
      } else if (state === "paused") {
        draw(ctx);
      } else {
        draw(ctx);
        return;
      }
    } catch (err) {
      console.error("[jet-strike]", err);
      // keep the loop alive so one bad frame doesn't freeze forever
    }
    if (state === "play" || state === "paused") {
      raf = requestAnimationFrame(loop);
    }
  }

  function canvasPos(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * W,
      y: ((ev.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if (state !== "play") return;
    // ignore if tapping bomb button area handled separately
    pointerId = ev.pointerId;
    canvas.setPointerCapture(pointerId);
    const p = canvasPos(ev);
    touchX = p.x;
    touchY = p.y;
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (state !== "play" || ev.pointerId !== pointerId) return;
    const p = canvasPos(ev);
    touchX = p.x;
    touchY = p.y;
  });
  canvas.addEventListener("pointerup", (ev) => {
    if (ev.pointerId === pointerId) pointerId = null;
  });
  canvas.addEventListener("pointercancel", () => { pointerId = null; });

  window.addEventListener("keydown", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") { keys.left = true; ev.preventDefault(); }
    if (ev.code === "ArrowRight" || ev.code === "KeyD") { keys.right = true; ev.preventDefault(); }
    if (ev.code === "ArrowUp" || ev.code === "KeyW") { keys.up = true; ev.preventDefault(); }
    if (ev.code === "ArrowDown" || ev.code === "KeyS") { keys.down = true; ev.preventDefault(); }
    if (ev.code === "Space" || ev.code === "KeyB") {
      ev.preventDefault();
      useBomb();
    }
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") keys.left = false;
    if (ev.code === "ArrowRight" || ev.code === "KeyD") keys.right = false;
    if (ev.code === "ArrowUp" || ev.code === "KeyW") keys.up = false;
    if (ev.code === "ArrowDown" || ev.code === "KeyS") keys.down = false;
  });

  bombBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    useBomb();
  });
  bombBtn.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "제트 스트라이크", formParent: overlays.title });
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

  hint.classList.add("hidden");
  loadAssets().then(() => {
    resetPlayer();
    draw(ctx);
    last = performance.now();
    raf = requestAnimationFrame(function idle(now) {
      if (state !== "title") return;
      last = now;
      time += 0.016;
      scrollY += 20 * 0.016;
      if (player) player.bob += 0.1;
      draw(ctx);
      raf = requestAnimationFrame(idle);
    });
  });
})();
