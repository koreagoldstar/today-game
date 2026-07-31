(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GROUND = 590;
  const CLIMB_Y = 455;
  const TREE_GAP_MIN = 280;
  const TREE_GAP_MAX = 420;
  const VIEW_AHEAD = 520;
  const VIEW_BEHIND = 220;

  const WEAPONS = [
    { id: "pistol", name: "권총", kills: 0, dmg: 1, rate: 0.34, speed: 720, pellets: 1, spray: 0.008, pierce: 0, color: "#ffe8a8" },
    { id: "shotgun", name: "샷건", kills: 8, dmg: 1, rate: 0.5, speed: 620, pellets: 4, spray: 0.1, pierce: 0, color: "#ffc078" },
    { id: "rifle", name: "소총", kills: 20, dmg: 2.4, rate: 0.3, speed: 900, pellets: 1, spray: 0.006, pierce: 0, color: "#b8ffd0" },
    { id: "assault", name: "돌격소총", kills: 38, dmg: 1.5, rate: 0.1, speed: 820, pellets: 1, spray: 0.02, pierce: 0, color: "#9fd8ff" },
    { id: "plasma", name: "플라즈마", kills: 65, dmg: 3.2, rate: 0.16, speed: 860, pellets: 1, spray: 0.008, pierce: 2, color: "#e0a8ff" },
  ];

  const DINO_TYPES = {
    raptor: { hp: 2, speed: 92, score: 120, w: 104, h: 86, flying: false, damage: 10, gait: 12 },
    stego: { hp: 5, speed: 44, score: 180, w: 132, h: 76, flying: false, damage: 14, gait: 7 },
    triceratops: { hp: 7, speed: 54, score: 240, w: 140, h: 78, flying: false, damage: 16, gait: 8 },
    ptera: { hp: 3, speed: 74, score: 200, w: 122, h: 76, flying: true, damage: 10, gait: 10 },
    quetz: { hp: 9, speed: 58, score: 380, w: 176, h: 108, flying: true, damage: 18, gait: 7 },
    trex: { hp: 16, speed: 40, score: 520, w: 164, h: 112, flying: false, damage: 24, gait: 6 },
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const ui = {
    title: document.getElementById("title"),
    upgrade: document.getElementById("upgrade"),
    over: document.getElementById("game-over"),
    coach: document.getElementById("coach"),
    kills: document.getElementById("hud-kills"),
    score: document.getElementById("hud-score"),
    weapon: document.getElementById("hud-weapon-name"),
    xp: document.getElementById("hud-xp"),
    upgradeTitle: document.getElementById("upgrade-title"),
    upgradeDetail: document.getElementById("upgrade-detail"),
    overDetail: document.getElementById("over-detail"),
    finalKills: document.getElementById("final-kills"),
    finalWeapon: document.getElementById("final-weapon"),
    finalScore: document.getElementById("final-score"),
  };

  const images = {};
  const imageFiles = {
    bg: "assets/bg.jpg",
    bg2: "assets/bg2.jpg",
    bg3: "assets/bg3.jpg",
    hunter: "assets/hunter.png",
    tree: "assets/tree.png",
    raptor: "assets/raptor.png",
    stego: "assets/stego.png",
    triceratops: "assets/triceratops.png",
    ptera: "assets/ptera.png",
    quetz: "assets/quetz.png",
    trex: "assets/trex.png",
  };
  Object.entries(imageFiles).forEach(([key, src]) => {
    const img = new Image();
    img.src = src;
    images[key] = img;
  });
  const BG_KEYS = ["bg", "bg2", "bg3"];
  let bgIndex = 0;
  let bgFade = 0;
  let nextBgIndex = 0;
  let lastWaveBg = 1;

  let phase = "title";
  let last = performance.now();
  let score = 0;
  let kills = 0;
  let weaponIndex = 0;
  let fireCd = 0;
  let spawnAcc = 0;
  let wave = 1;
  let shake = 0;
  let flash = 0;
  let paused = false;
  let dinos = [];
  let bullets = [];
  let particles = [];
  let floats = [];
  let blood = [];
  let trees = [];
  let cameraX = 0;
  let nextTreeX = 180;
  let farthestX = 0;
  let moveLeft = false;
  let moveRight = false;
  let autoFire = false;
  let aimSX = W * 0.72;
  let aimSY = GROUND - 90;
  let aiming = false;
  let muzzleFlash = 0;

  const player = {
    x: 80,
    y: GROUND,
    vx: 0,
    face: 1,
    hp: 100,
    inv: 0,
    climbing: false,
    climbState: "ground", // ground | up | perch | down
    tree: null,
    climbProgress: 0,
    hurtFlash: 0,
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function weapon() {
    return WEAPONS[weaponIndex];
  }
  function nextWeaponNeed() {
    return weaponIndex + 1 < WEAPONS.length ? WEAPONS[weaponIndex + 1].kills : null;
  }
  function loadImgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }
  function setCoach(text) {
    ui.coach.textContent = text;
  }
  function sx(x) {
    return x - cameraX;
  }
  function worldX(screenX) {
    return screenX + cameraX;
  }
  function aimWX() {
    return worldX(aimSX);
  }
  function aimWY() {
    return aimSY;
  }

  function dinoHitbox(d) {
    const padX = d.w * 0.52;
    const top = d.y - d.h * 0.98;
    const bottom = d.y - d.h * 0.02;
    return {
      left: d.x - padX,
      right: d.x + padX,
      top,
      bottom,
      cx: d.x,
      cy: (top + bottom) * 0.5,
    };
  }

  function segmentHitsBox(x0, y0, x1, y1, box, radius) {
    const steps = 6;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = lerp(x0, x1, t);
      const y = lerp(y0, y1, t);
      if (
        x + radius >= box.left &&
        x - radius <= box.right &&
        y + radius >= box.top &&
        y - radius <= box.bottom
      ) {
        return true;
      }
    }
    return false;
  }

  function updateHud() {
    ui.kills.textContent = String(kills);
    ui.score.textContent = score.toLocaleString("ko-KR");
    ui.weapon.textContent = weapon().name;
    const need = nextWeaponNeed();
    const prev = WEAPONS[weaponIndex].kills;
    const ratio = need == null ? 1 : clamp((kills - prev) / Math.max(1, need - prev), 0, 1);
    ui.xp.style.width = `${Math.round(ratio * 100)}%`;
  }

  function burst(x, y, color, count = 10, speed = 120) {
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.3, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: rand(0.25, 0.55),
        max: 0.55,
        size: rand(2, 5),
        color,
      });
    }
  }

  function floatText(x, y, text, color = "#fff") {
    floats.push({ x, y, text, color, life: 0.9 });
  }

  function pickBgForWave() {
    if (wave === lastWaveBg) return;
    lastWaveBg = wave;
    if (wave === 1) return;
    nextBgIndex = (bgIndex + 1 + Math.floor(Math.random() * (BG_KEYS.length - 1))) % BG_KEYS.length;
    if (nextBgIndex === bgIndex) nextBgIndex = (bgIndex + 1) % BG_KEYS.length;
    bgFade = 0.001;
  }

  function addTree(x) {
    trees.push({ x, climbY: CLIMB_Y });
  }

  function ensureTrees() {
    const needUntil = player.x + VIEW_AHEAD + 200;
    while (nextTreeX < needUntil) {
      addTree(nextTreeX);
      nextTreeX += rand(TREE_GAP_MIN, TREE_GAP_MAX);
    }
    trees = trees.filter((t) => t.x > player.x - VIEW_BEHIND - 200 || (player.climbing && player.tree === t));
  }

  function spawnDino(forced) {
    const roll = Math.random();
    let type = "raptor";
    if (forced) type = forced;
    else if (wave >= 8 && roll > 0.92) type = "trex";
    else if (wave >= 6 && roll > 0.84) type = "quetz";
    else if (wave >= 4 && roll > 0.72) type = "triceratops";
    else if (wave >= 3 && roll > 0.54) type = "ptera";
    else if (wave >= 2 && roll > 0.36) type = "stego";

    const def = DINO_TYPES[type];
    const ahead = Math.random() < 0.72;
    const spawnX = ahead
      ? player.x + rand(W * 0.55, VIEW_AHEAD)
      : player.x - rand(80, VIEW_BEHIND);
    const dir = spawnX < player.x ? 1 : -1;
    const flying = def.flying;
    const flyY = type === "quetz" ? rand(180, 250) : rand(210, 300);
    dinos.push({
      type,
      x: spawnX,
      y: flying ? flyY : GROUND,
      baseY: flying ? flyY : GROUND,
      cruiseY: flyY,
      vx: dir * def.speed * (0.9 + Math.random() * 0.15) * (1 + wave * 0.025),
      vy: 0,
      desiredSpeed: def.speed * (1 + wave * 0.025),
      hp: def.hp + Math.floor(wave * 0.28),
      maxHp: def.hp + Math.floor(wave * 0.28),
      w: def.w,
      h: def.h,
      flying,
      damage: def.damage,
      score: def.score,
      gait: def.gait,
      phase: Math.random() * Math.PI * 2,
      hitFlash: 0,
      lean: 0,
      flyMode: flying ? "cruise" : null,
      diveCd: flying ? rand(0.6, 1.8) : 0,
      diveT: 0,
    });
  }

  function nearestTree() {
    let best = null;
    let bestD = 58;
    trees.forEach((t) => {
      const d = Math.abs(player.x - t.x);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    });
    return best;
  }

  function syncClimbButton() {
    const btn = document.getElementById("climb-btn");
    if (!btn) return;
    if (player.climbState === "perch" || player.climbState === "up") {
      btn.textContent = "내려오기";
    } else {
      btn.textContent = "나무 타기";
    }
  }

  function tryClimb() {
    if (phase !== "play") return;
    if (player.climbState === "up" || player.climbState === "down") return;

    if (player.climbState === "perch") {
      player.climbState = "down";
      player.climbing = true;
      setCoach("내려오는 중…");
      syncClimbButton();
      return;
    }

    const tree = nearestTree();
    if (!tree) {
      setCoach("나무 가까이에서 탈 수 있어요");
      return;
    }
    player.climbing = true;
    player.climbState = "up";
    player.tree = tree;
    player.x = tree.x;
    player.climbProgress = 0;
    player.vx = 0;
    setCoach("낮은 가지 위! 비행 공룡 급강하를 조심하세요");
    syncClimbButton();
  }

  function updateFacing() {
    // Face walk direction first; when idle, face aim
    if (Math.abs(player.vx) > 18) {
      player.face = player.vx > 0 ? 1 : -1;
      return;
    }
    if (moveLeft && !moveRight) {
      player.face = -1;
      return;
    }
    if (moveRight && !moveLeft) {
      player.face = 1;
      return;
    }
    const ax = aimWX();
    if (Math.abs(ax - player.x) > 12) player.face = ax >= player.x ? 1 : -1;
  }

  function playerSpriteSize() {
    if (player.climbing) return { w: 64, h: 96 };
    return { w: 76, h: 118 };
  }

  function checkUpgrade() {
    while (weaponIndex + 1 < WEAPONS.length && kills >= WEAPONS[weaponIndex + 1].kills) {
      weaponIndex += 1;
      const wpn = weapon();
      phase = "upgrade";
      ui.upgrade.classList.remove("hidden");
      ui.upgradeTitle.textContent = `${wpn.name} 해금!`;
      ui.upgradeDetail.textContent = "화력이 강해졌습니다. 더 많은 공룡을 처치하세요!";
      burst(player.x, player.y - 70, wpn.color, 24, 180);
      flash = 0.35;
      break;
    }
  }

  function resumeAfterUpgrade() {
    ui.upgrade.classList.add("hidden");
    phase = "play";
    last = performance.now();
    setCoach(`${weapon().name} 장착 완료`);
  }

  function muzzlePos() {
    // Sprite faces right; drawn from (-0.45w, -h) to (0.55w, 0). Gun tip ≈ right edge, ~45% down.
    const { w, h } = playerSpriteSize();
    return {
      x: player.x + player.face * w * 0.52,
      y: player.y - h * 0.55,
    };
  }

  function pointerToGame(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * W, 8, W - 8),
      y: clamp(((e.clientY - rect.top) / rect.height) * H, 8, H - 8),
    };
  }

  function setAimFromPointer(e) {
    const p = pointerToGame(e);
    if (p.y > 610) return false;
    aimSX = p.x;
    aimSY = p.y;
    updateFacing();
    return true;
  }

  function fire() {
    if (phase !== "play" || fireCd > 0) return;
    const wpn = weapon();
    fireCd = wpn.rate;
    const muzzle = muzzlePos();
    const targetX = aimWX();
    const targetY = aimWY();
    const baseAng = Math.atan2(targetY - muzzle.y, targetX - muzzle.x);
    for (let i = 0; i < wpn.pellets; i += 1) {
      const ang = baseAng + rand(-wpn.spray, wpn.spray);
      const speed = wpn.speed * (wpn.pellets > 1 ? rand(0.92, 1.05) : 1);
      bullets.push({
        x: muzzle.x,
        y: muzzle.y,
        px: muzzle.x,
        py: muzzle.y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        dmg: wpn.dmg,
        pierce: wpn.pierce,
        life: 0.85,
        color: wpn.color,
        r: wpn.id === "plasma" ? 4.2 : 2.6,
      });
    }
    if (Math.abs(player.vx) <= 18 && !moveLeft && !moveRight) {
      player.face = targetX >= player.x ? 1 : -1;
    }
    muzzleFlash = 0.08;
    burst(muzzle.x, muzzle.y, "#fff1b0", 4, 55);
    shake = Math.max(shake, 1.4);
    kickSound();
  }

  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function kickSound() {
    try {
      const ac = ensureAudio();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "square";
      o.frequency.value = 180 + weaponIndex * 40;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
      o.stop(ac.currentTime + 0.09);
    } catch (_) {}
  }
  function hitSound() {
    try {
      const ac = ensureAudio();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sawtooth";
      o.frequency.value = 90;
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
      o.stop(ac.currentTime + 0.13);
    } catch (_) {}
  }

  function hurtPlayer(amount) {
    if (player.inv > 0) return;
    player.hp -= amount;
    player.inv = 1.35;
    player.hurtFlash = 0.3;
    shake = 8;
    flash = 0.2;
    setCoach(d.flying ? "급강하를 피하거나 쏘세요!" : "공격당했습니다! 나무로 피하세요");
    if (player.hp <= 0) endGame();
  }

  function updateCamera() {
    const target = player.x - W * 0.34;
    cameraX = lerp(cameraX, Math.max(0, target), 0.14);
  }

  function startGame() {
    phase = "play";
    score = 0;
    kills = 0;
    weaponIndex = 0;
    fireCd = 0;
    spawnAcc = -0.6;
    wave = 1;
    lastWaveBg = 1;
    bgIndex = Math.floor(Math.random() * BG_KEYS.length);
    nextBgIndex = bgIndex;
    bgFade = 0;
    dinos = [];
    bullets = [];
    particles = [];
    floats = [];
    blood = [];
    trees = [];
    nextTreeX = 160;
    farthestX = 80;
    cameraX = 0;
    player.x = 80;
    player.y = GROUND;
    player.vx = 0;
    player.face = 1;
    player.hp = 100;
    player.inv = 2.2;
    player.climbing = false;
    player.climbState = "ground";
    player.tree = null;
    player.climbProgress = 0;
    ensureTrees();
    syncClimbButton();
    ui.title.classList.add("hidden");
    ui.upgrade.classList.add("hidden");
    ui.over.classList.add("hidden");
    updateHud();
    setCoach("앞으로 가며 조준·사격하세요");
    spawnDino("raptor");
    aimSX = W * 0.72;
    aimSY = GROUND - 90;
    if (window.TodayGameRank) window.TodayGameRank.reset();
    if (window.TodayBGM) window.TodayBGM.start("dino-hunt");
    last = performance.now();
  }

  function endGame() {
    phase = "over";
    ui.over.classList.remove("hidden");
    ui.overDetail.textContent = `${kills}마리 처치 · ${weapon().name}까지 해금`;
    ui.finalKills.textContent = String(kills);
    ui.finalWeapon.textContent = weapon().name;
    ui.finalScore.textContent = score.toLocaleString("ko-KR");
    if (window.TodayGameRank) {
      window.TodayGameRank.open(score, { label: `${kills}킬 · ${weapon().name}` });
    }
  }

  function updateDino(d, dt) {
    d.phase += dt * d.gait;
    d.hitFlash = Math.max(0, d.hitFlash - dt);

    const toPlayer = player.x - d.x;
    const dir = Math.sign(toPlayer) || (d.vx >= 0 ? 1 : -1);
    const want = dir * d.desiredSpeed;

    if (d.flying) {
      d.diveCd = Math.max(0, d.diveCd - dt);
      const cruise = d.cruiseY || (d.type === "quetz" ? 210 : 250);
      const targetBodyY = player.y - (player.climbing ? 50 : 70);

      if (d.flyMode === "cruise") {
        d.vx = lerp(d.vx, want * 0.95, 1 - Math.pow(0.08, dt));
        d.vy = lerp(d.vy, 0, 0.12);
        d.baseY = lerp(d.baseY, cruise, 1 - Math.pow(0.25, dt));
        d.y = d.baseY + Math.sin(d.phase) * (d.type === "quetz" ? 16 : 12);
        d.lean = lerp(d.lean, clamp(d.vx / 160, -0.18, 0.18), 0.2);

        const dx = Math.abs(toPlayer);
        const inView = dx < 210 && dx > 28;
        if (inView && d.diveCd <= 0) {
          d.flyMode = "telegraph";
          d.diveT = 0.38;
          setCoach(d.type === "quetz" ? "케찰이 급강하합니다!" : "프테라가 급강하합니다!");
        }
      } else if (d.flyMode === "telegraph") {
        d.diveT -= dt;
        d.vx = lerp(d.vx, dir * d.desiredSpeed * 0.35, 0.15);
        d.baseY = lerp(d.baseY, cruise - 18, 0.2);
        d.y = d.baseY;
        d.lean = lerp(d.lean, dir * 0.35, 0.25);
        // Warning flaps
        if (Math.random() < 0.4) {
          particles.push({
            x: d.x + rand(-20, 20),
            y: d.y - d.h * 0.4,
            vx: rand(-30, 30),
            vy: rand(20, 60),
            life: 0.25,
            max: 0.25,
            size: rand(2, 4),
            color: "rgba(255,210,120,.7)",
          });
        }
        if (d.diveT <= 0) {
          d.flyMode = "dive";
          const ang = Math.atan2(targetBodyY - d.y, player.x - d.x);
          const diveSp = (d.type === "quetz" ? 340 : 290) * (1 + wave * 0.02);
          d.vx = Math.cos(ang) * diveSp;
          d.vy = Math.sin(ang) * diveSp;
          d.diveT = 1.15;
        }
      } else if (d.flyMode === "dive") {
        d.diveT -= dt;
        // Home slightly so dodge still matters but they commit
        const ang = Math.atan2(targetBodyY - d.y, player.x - d.x);
        const diveSp = Math.hypot(d.vx, d.vy) || 280;
        d.vx = lerp(d.vx, Math.cos(ang) * diveSp, 0.08);
        d.vy = lerp(d.vy, Math.sin(ang) * diveSp, 0.08);
        d.y += d.vy * dt;
        d.baseY = d.y;
        d.lean = lerp(d.lean, clamp(d.vy / 220, -0.55, 0.55) + clamp(d.vx / 260, -0.2, 0.2), 0.3);
        if (Math.random() < 0.55) {
          particles.push({
            x: d.x - Math.sign(d.vx || 1) * 18,
            y: d.y - d.h * 0.2,
            vx: -d.vx * 0.05 + rand(-20, 20),
            vy: -d.vy * 0.05 + rand(-10, 10),
            life: 0.22,
            max: 0.22,
            size: rand(2, 5),
            color: "rgba(200,220,255,.45)",
          });
        }
        const passed =
          d.diveT <= 0 ||
          d.y > GROUND - 40 ||
          (Math.sign(d.vx) === Math.sign(d.x - player.x) && Math.abs(d.x - player.x) > 90 && d.y > targetBodyY - 20);
        if (passed) {
          d.flyMode = "climb";
          d.diveT = 0.9;
          d.vy = d.type === "quetz" ? -210 : -240;
          d.vx = dir * d.desiredSpeed * 1.1;
        }
      } else if (d.flyMode === "climb") {
        d.diveT -= dt;
        d.vy = lerp(d.vy, -180, 0.1);
        d.vx = lerp(d.vx, want * 1.05, 0.1);
        d.y += d.vy * dt;
        d.baseY = d.y;
        d.lean = lerp(d.lean, -0.25, 0.2);
        if (d.y <= cruise + 10 || d.diveT <= 0) {
          d.flyMode = "cruise";
          d.y = Math.min(d.y, cruise);
          d.baseY = d.y;
          d.vy = 0;
          d.cruiseY = cruise;
          d.diveCd = d.type === "quetz" ? rand(1.8, 2.8) : rand(1.3, 2.2);
        }
      }
      d.x += d.vx * dt;
      return;
    }

    d.vx = lerp(d.vx, want, 1 - Math.pow(0.12, dt));
    const hop = Math.abs(Math.sin(d.phase)) * (d.type === "raptor" ? 10 : 6);
    d.y = GROUND - hop;
    d.lean = lerp(d.lean, clamp(-d.vx / 220, -0.12, 0.12), 0.25);
    if (Math.sin(d.phase) > 0.92 && Math.random() < 0.35) {
      particles.push({
        x: d.x + rand(-10, 10),
        y: GROUND - 4,
        vx: rand(-20, 20),
        vy: rand(-30, -10),
        life: 0.28,
        max: 0.28,
        size: rand(2, 4),
        color: "rgba(120,90,50,.55)",
      });
    }
    d.x += d.vx * dt;
  }

  function update(dt) {
    if (phase !== "play" || paused) return;
    fireCd = Math.max(0, fireCd - dt);
    player.inv = Math.max(0, player.inv - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    shake = Math.max(0, shake - dt * 18);
    flash = Math.max(0, flash - dt);
    muzzleFlash = Math.max(0, muzzleFlash - dt);

    if (bgFade > 0) {
      bgFade = clamp(bgFade + dt * 0.7, 0, 1);
      if (bgFade >= 1) {
        bgIndex = nextBgIndex;
        bgFade = 0;
      }
    }

    wave = 1 + Math.floor(kills / 6) + Math.floor(Math.max(0, farthestX) / 1400);
    pickBgForWave();
    ensureTrees();

    spawnAcc += dt;
    const spawnEvery = Math.max(0.8, 2.2 - wave * 0.07);
    if (spawnAcc >= spawnEvery) {
      spawnAcc = 0;
      spawnDino();
      if (wave >= 6 && Math.random() < 0.28) spawnDino();
    }

    if (player.climbState === "ground") {
      const speed = 210;
      if (moveLeft) player.vx = -speed;
      else if (moveRight) player.vx = speed;
      else player.vx *= Math.pow(0.02, dt);
      player.x = Math.max(40, player.x + player.vx * dt);
      player.y = GROUND;
      player.climbing = false;
      updateFacing();
    } else if (player.tree) {
      player.vx = 0;
      player.climbing = true;
      player.x = player.tree.x;
      if (player.climbState === "up") {
        player.climbProgress = clamp(player.climbProgress + dt * 2.0, 0, 1);
        player.y = lerp(GROUND, player.tree.climbY, easeInOutCubic(player.climbProgress));
        if (player.climbProgress >= 1) {
          player.climbState = "perch";
          player.y = player.tree.climbY;
          syncClimbButton();
        }
      } else if (player.climbState === "down") {
        player.climbProgress = clamp(player.climbProgress - dt * 1.85, 0, 1);
        player.y = lerp(GROUND, player.tree.climbY, easeInOutCubic(player.climbProgress));
        if (player.climbProgress <= 0) {
          player.climbState = "ground";
          player.climbing = false;
          player.tree = null;
          player.y = GROUND;
          setCoach("지상으로 내려왔습니다");
          syncClimbButton();
        }
      } else {
        // perch
        player.climbProgress = 1;
        player.y = player.tree.climbY;
        updateFacing();
      }
    }

    if (player.x > farthestX) {
      const gained = player.x - farthestX;
      farthestX = player.x;
      score += Math.floor(gained * 0.12);
      updateHud();
    }

    updateCamera();
    if (autoFire) fire();

    bullets.forEach((b) => {
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    });

    dinos.forEach((d) => updateDino(d, dt));

    bullets.forEach((b) => {
      if (b.life <= 0) return;
      dinos.forEach((d) => {
        if (d.hp <= 0 || b.life <= 0) return;
        const box = dinoHitbox(d);
        if (!segmentHitsBox(b.px, b.py, b.x, b.y, box, b.r + 2)) return;
        d.hp -= b.dmg;
        d.hitFlash = 0.14;
        b.pierce -= 1;
        if (b.pierce < 0) b.life = 0;
        burst(b.x, b.y, "#ff6b6b", 8, 140);
        hitSound();
        if (d.hp <= 0) {
          kills += 1;
          score += d.score + wave * 15;
          floatText(d.x, d.y - d.h, `+${d.score}`, "#ffe56a");
          burst(d.x, d.y - d.h * 0.4, "#c45a3a", 18, 180);
          blood.push({ x: d.x, y: GROUND - 6, life: 0.8 });
          d.hp = 0;
          updateHud();
          checkUpgrade();
        }
      });
    });

    dinos.forEach((d) => {
      if (d.hp <= 0) return;
      // Ground dinos can't reach perch; flying ones dive-bomb everywhere
      const canReach = d.flying || player.climbState === "ground" || player.climbProgress < 0.55;
      if (!canReach) return;
      // Only diving flyers (or contact while low) hurt — cruise altitude doesn't clip
      if (d.flying && d.flyMode !== "dive" && d.y < player.y - 110) return;
      const box = dinoHitbox(d);
      const px = player.x;
      const py = player.y - 48;
      const hit =
        px > box.left + 12 &&
        px < box.right - 12 &&
        py > box.top + 6 &&
        py < box.bottom + 10;
      if (hit) {
        hurtPlayer(d.flying && d.flyMode === "dive" ? Math.round(d.damage * 1.25) : d.damage);
        if (d.flying && d.flyMode === "dive") {
          d.flyMode = "climb";
          d.diveT = 0.85;
          d.vy = -220;
          d.diveCd = d.type === "quetz" ? 2.4 : 1.8;
        }
      }
    });

    const cullL = player.x - VIEW_BEHIND - 180;
    const cullR = player.x + VIEW_AHEAD + 220;
    dinos = dinos.filter((d) => d.hp > 0 && d.x > cullL && d.x < cullR);
    bullets = bullets.filter(
      (b) => b.life > 0 && b.x > cullL && b.x < cullR && b.y > -40 && b.y < H + 40
    );
    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);
    floats.forEach((f) => {
      f.y -= 28 * dt;
      f.life -= dt;
    });
    floats = floats.filter((f) => f.life > 0);
    blood.forEach((b) => {
      b.life -= dt;
    });
    blood = blood.filter((b) => b.life > 0);

    if (player.hp < 35 && player.climbState === "ground") setCoach("체력이 낮아요! 나무로 피하세요");
  }

  function drawOneBgTile(key, alpha, offsetX) {
    const img = images[key];
    ctx.globalAlpha = alpha;
    if (loadImgReady(img)) {
      const tileW = W;
      let start = -((offsetX % tileW) + tileW) % tileW;
      for (let x = start; x < W + tileW; x += tileW) {
        ctx.drawImage(img, x, 0, tileW, H);
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#6fa8c8");
      g.addColorStop(0.45, "#4f8a52");
      g.addColorStop(1, "#2d5a34");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }

  function drawBg() {
    const parallax = cameraX * 0.35;
    drawOneBgTile(BG_KEYS[bgIndex], 1, parallax);
    if (bgFade > 0) drawOneBgTile(BG_KEYS[nextBgIndex], bgFade, parallax);
    ctx.fillStyle = "rgba(8, 24, 12, 0.16)";
    ctx.fillRect(0, GROUND - 6, W, H - GROUND + 6);
  }

  function drawTrees() {
    trees.forEach((t) => {
      const x = sx(t.x);
      if (x < -100 || x > W + 100) return;
      if (loadImgReady(images.tree)) {
        const tw = 132;
        const th = 210;
        ctx.drawImage(images.tree, x - tw / 2, GROUND - th + 10, tw, th);
      } else {
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(x - 12, GROUND - 150, 24, 150);
        ctx.fillStyle = "#2f7a3a";
        ctx.beginPath();
        ctx.arc(x, GROUND - 155, 42, 0, Math.PI * 2);
        ctx.fill();
      }
      if (player.climbState === "ground" && Math.abs(player.x - t.x) < 58) {
        ctx.fillStyle = "rgba(255, 225, 110, 0.9)";
        ctx.font = "800 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("▲ 나무", x, t.climbY - 28);
      }
    });
  }

  function drawPlayer() {
    const img = images.hunter;
    const { w, h } = playerSpriteSize();
    const px = sx(player.x);
    ctx.save();
    ctx.translate(px, player.y);
    if (player.hurtFlash > 0) ctx.globalAlpha = 0.45 + Math.sin(performance.now() / 30) * 0.25;
    // Slight lean while climbing so ascent/descent feels less stiff
    if (player.climbState === "up") ctx.rotate(-0.08);
    else if (player.climbState === "down") ctx.rotate(0.1);
    ctx.scale(player.face, 1);
    if (loadImgReady(img)) ctx.drawImage(img, -w * 0.45, -h, w, h);
    else {
      ctx.fillStyle = "#d9c08a";
      ctx.fillRect(-18, -90, 36, 90);
    }
    ctx.restore();

    const hpW = 54;
    const barY = player.y - (player.climbing ? 108 : 132);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(px - hpW / 2, barY, hpW, 6);
    ctx.fillStyle = player.hp > 35 ? "#58e07a" : "#ff5b6a";
    ctx.fillRect(px - hpW / 2, barY, hpW * clamp(player.hp / 100, 0, 1), 6);
  }

  function drawDinos() {
    dinos.forEach((d) => {
      const x = sx(d.x);
      if (x < -160 || x > W + 160) return;
      const img = images[d.type];
      const face = d.vx >= 0 ? -1 : 1;
      ctx.save();
      ctx.translate(x, d.y);
      ctx.rotate(d.lean || 0);
      if (d.hitFlash > 0) ctx.filter = "brightness(2.1)";
      else if (d.flying && d.flyMode === "telegraph") ctx.filter = "brightness(1.35) saturate(1.2)";
      else if (d.flying && d.flyMode === "dive") ctx.filter = "brightness(1.15)";
      ctx.scale(face, 1);
      const bobScale = d.flying ? 1 : 1 + Math.abs(Math.sin(d.phase)) * 0.03;
      ctx.scale(bobScale, 2 - bobScale);
      if (loadImgReady(img)) ctx.drawImage(img, -d.w / 2, -d.h, d.w, d.h);
      else {
        ctx.fillStyle = "#6b8f4e";
        ctx.fillRect(-d.w / 2, -d.h, d.w, d.h);
      }
      ctx.filter = "none";
      ctx.restore();

      const ratio = clamp(d.hp / d.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(x - 28, d.y - d.h - 12, 56, 5);
      ctx.fillStyle = ratio > 0.4 ? "#8cff7a" : "#ff6a6a";
      ctx.fillRect(x - 28, d.y - d.h - 12, 56 * ratio, 5);
    });
  }

  function drawBullets() {
    bullets.forEach((b) => {
      const x = sx(b.x);
      if (x < -40 || x > W + 40) return;
      const ang = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(x, b.y);
      ctx.rotate(ang);
      ctx.fillStyle = "#fff8e6";
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(5, b.r * 2.2), Math.max(1.4, b.r * 0.55), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-10, -0.8, 8, 1.6);
      ctx.restore();
    });
  }

  function drawAim() {
    if (phase !== "play") return;
    const muzzle = muzzlePos();
    const mx = sx(muzzle.x);
    const my = muzzle.y;
    ctx.save();
    ctx.strokeStyle = "rgba(255,245,180,.28)";
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(aimSX, aimSY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (muzzleFlash > 0) {
      ctx.fillStyle = `rgba(255,230,140,${muzzleFlash * 8})`;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = aiming ? "rgba(255,240,160,.95)" : "rgba(255,240,160,.7)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(aimSX, aimSY, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aimSX - 17, aimSY);
    ctx.lineTo(aimSX - 6, aimSY);
    ctx.moveTo(aimSX + 6, aimSY);
    ctx.lineTo(aimSX + 17, aimSY);
    ctx.moveTo(aimSX, aimSY - 17);
    ctx.lineTo(aimSX, aimSY - 6);
    ctx.moveTo(aimSX, aimSY + 6);
    ctx.lineTo(aimSX, aimSY + 17);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,240,160,.85)";
    ctx.beginPath();
    ctx.arc(aimSX, aimSY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFx() {
    blood.forEach((b) => {
      const x = sx(b.x);
      ctx.globalAlpha = clamp(b.life / 0.8, 0, 1) * 0.45;
      ctx.fillStyle = "#7a1f1f";
      ctx.beginPath();
      ctx.ellipse(x, b.y, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    particles.forEach((p) => {
      const x = sx(p.x);
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    floats.forEach((f) => {
      const x = sx(f.x);
      ctx.globalAlpha = clamp(f.life / 0.9, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = "900 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(f.text, x, f.y);
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawBg();
    drawTrees();
    drawDinos();
    drawPlayer();
    drawBullets();
    drawFx();
    drawAim();
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,230,140,${flash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(now) {
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindHold(el, on, off) {
    const start = (e) => {
      e.preventDefault();
      on();
    };
    const end = (e) => {
      e.preventDefault();
      off();
    };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointerleave", end);
    el.addEventListener("pointercancel", end);
  }

  bindHold(document.getElementById("left-btn"), () => { moveLeft = true; }, () => { moveLeft = false; });
  bindHold(document.getElementById("right-btn"), () => { moveRight = true; }, () => { moveRight = false; });
  bindHold(
    document.getElementById("fire-btn"),
    () => {
      autoFire = true;
      fire();
    },
    () => {
      autoFire = false;
    }
  );
  document.getElementById("climb-btn").addEventListener("click", tryClimb);
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("upgrade-btn").addEventListener("click", resumeAfterUpgrade);

  canvas.addEventListener("pointermove", (e) => {
    if (phase !== "play") return;
    setAimFromPointer(e);
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (phase !== "play") return;
    e.preventDefault();
    aiming = true;
    if (!setAimFromPointer(e)) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    fire();
  });
  canvas.addEventListener("pointerup", () => {
    aiming = false;
  });
  canvas.addEventListener("pointercancel", () => {
    aiming = false;
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = true;
    if (e.code === "Space") {
      e.preventDefault();
      fire();
    }
    if (e.code === "KeyW" || e.code === "ArrowUp") tryClimb();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = false;
  });

  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => phase === "play",
      isPaused: () => paused,
      pause: () => {
        paused = true;
      },
      resume: () => {
        paused = false;
        last = performance.now();
      },
    });
  }

  if (window.TodayGameRank) {
    window.TodayGameRank.mount({
      gameId: "dino-hunt",
      gameTitle: "공룡 헌터",
      formParent: ui.over,
    });
  }

  updateHud();
  requestAnimationFrame(loop);
})();
