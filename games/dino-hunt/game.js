(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GROUND = 590;
  const TREE_SPOTS = [
    { x: 78, climbY: 455 },
    { x: 312, climbY: 455 },
  ];

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
  let moveLeft = false;
  let moveRight = false;
  let autoFire = false;
  let aimX = W * 0.78;
  let aimY = GROUND - 90;
  let aiming = false;
  let muzzleFlash = 0;

  const player = {
    x: W * 0.5,
    y: GROUND,
    vx: 0,
    face: 1,
    hp: 100,
    inv: 0,
    climbing: false,
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
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
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

  function dinoHitbox(d) {
    // Generous body box: sprites face left by default, feet at d.y
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
    // Point checks + coarse samples along the segment (anti-tunnel)
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

  function spawnDino(forced) {
    const roll = Math.random();
    let type = "raptor";
    if (forced) type = forced;
    else if (wave >= 8 && roll > 0.92) type = "trex";
    else if (wave >= 4 && roll > 0.78) type = "triceratops";
    else if (wave >= 3 && roll > 0.58) type = "ptera";
    else if (wave >= 2 && roll > 0.38) type = "stego";

    const def = DINO_TYPES[type];
    const fromLeft = Math.random() < 0.5;
    const dir = fromLeft ? 1 : -1;
    const flying = def.flying;
    dinos.push({
      type,
      x: fromLeft ? -90 : W + 90,
      y: flying ? rand(210, 300) : GROUND,
      baseY: flying ? rand(210, 300) : GROUND,
      vx: dir * def.speed * (0.9 + Math.random() * 0.15) * (1 + wave * 0.025),
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
    });
  }

  function nearestTree() {
    let best = null;
    let bestD = 58;
    TREE_SPOTS.forEach((t) => {
      const d = Math.abs(player.x - t.x);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    });
    return best;
  }

  function tryClimb() {
    if (phase !== "play") return;
    if (player.climbing) {
      player.climbing = false;
      player.tree = null;
      player.climbProgress = 0;
      player.y = GROUND;
      setCoach("지상으로 내려왔습니다");
      return;
    }
    const tree = nearestTree();
    if (!tree) {
      setCoach("나무 가까이에서 탈 수 있어요");
      return;
    }
    player.climbing = true;
    player.tree = tree;
    player.x = tree.x;
    player.climbProgress = 0;
    setCoach("낮은 가지 위! 프테라만 조심하세요");
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
    return {
      x: player.x + player.face * (player.climbing ? 28 : 36),
      y: player.y - (player.climbing ? 72 : 90),
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
    // Ignore control strip for aiming updates from canvas
    if (p.y > 610) return false;
    aimX = p.x;
    aimY = p.y;
    if (Math.abs(aimX - player.x) > 8) player.face = aimX >= player.x ? 1 : -1;
    return true;
  }

  function fire() {
    if (phase !== "play" || fireCd > 0) return;
    const wpn = weapon();
    fireCd = wpn.rate;
    const muzzle = muzzlePos();
    const targetX = aimX;
    const targetY = aimY;
    const baseAng = Math.atan2(targetY - muzzle.y, targetX - muzzle.x);
    // Keep shots mostly directed; tiny spray only for shotgun
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
    player.face = targetX >= player.x ? 1 : -1;
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
    setCoach("공격당했습니다! 나무로 피하세요");
    if (player.hp <= 0) endGame();
  }

  function startGame() {
    phase = "play";
    score = 0;
    kills = 0;
    weaponIndex = 0;
    fireCd = 0;
    spawnAcc = -1.2;
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
    player.x = W * 0.5;
    player.y = GROUND;
    player.vx = 0;
    player.face = 1;
    player.hp = 100;
    player.inv = 2.2;
    player.climbing = false;
    player.tree = null;
    player.climbProgress = 0;
    ui.title.classList.add("hidden");
    ui.upgrade.classList.add("hidden");
    ui.over.classList.add("hidden");
    updateHud();
    setCoach("화면을 조준한 뒤 발사하세요");
    spawnDino("raptor");
    aimX = player.x + 110;
    aimY = GROUND - 90;
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
      d.vx = lerp(d.vx, want * (player.climbing ? 1.15 : 0.95), 1 - Math.pow(0.08, dt));
      d.baseY = lerp(d.baseY, player.climbing ? player.y - 40 : 250, 1 - Math.pow(0.2, dt));
      d.y = d.baseY + Math.sin(d.phase) * 14;
      d.lean = lerp(d.lean, clamp(d.vx / 160, -0.18, 0.18), 0.2);
    } else {
      // Smooth chase with gallop hop — feet stay near ground
      d.vx = lerp(d.vx, want, 1 - Math.pow(0.12, dt));
      const hop = Math.abs(Math.sin(d.phase)) * (d.type === "raptor" ? 10 : 6);
      d.y = GROUND - hop;
      d.lean = lerp(d.lean, clamp(-d.vx / 220, -0.12, 0.12), 0.25);
      // Dust when landing in hop cycle
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

    wave = 1 + Math.floor(kills / 6);
    pickBgForWave();

    spawnAcc += dt;
    const spawnEvery = Math.max(0.85, 2.4 - wave * 0.07);
    if (spawnAcc >= spawnEvery) {
      spawnAcc = 0;
      spawnDino();
      if (wave >= 6 && Math.random() < 0.28) spawnDino();
    }

    if (!player.climbing) {
      const speed = 190;
      if (moveLeft) player.vx = -speed;
      else if (moveRight) player.vx = speed;
      else player.vx *= Math.pow(0.02, dt);
      player.x = clamp(player.x + player.vx * dt, 36, W - 36);
      // Facing follows aim, not just walk direction
      if (Math.abs(aimX - player.x) > 10) player.face = aimX >= player.x ? 1 : -1;
      player.y = GROUND;
    } else if (player.tree) {
      player.climbProgress = clamp(player.climbProgress + dt * 2.4, 0, 1);
      player.x = player.tree.x;
      player.y = lerp(GROUND, player.tree.climbY, easeOutCubic(player.climbProgress));
      player.vx = 0;
      if (Math.abs(aimX - player.x) > 10) player.face = aimX >= player.x ? 1 : -1;
    }

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
      const canReach = d.flying || !player.climbing || player.climbProgress < 0.7;
      if (!canReach) return;
      const box = dinoHitbox(d);
      const px = player.x;
      const py = player.y - 48;
      const hit =
        px > box.left + 18 &&
        px < box.right - 18 &&
        py > box.top + 10 &&
        py < box.bottom + 8;
      if (hit) hurtPlayer(d.damage);
    });

    dinos = dinos.filter((d) => d.hp > 0 && d.x > -140 && d.x < W + 140);
    bullets = bullets.filter((b) => b.life > 0 && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);
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

    if (player.hp < 35 && !player.climbing) setCoach("체력이 낮아요! 나무로 피하세요");
  }

  function drawOneBg(key, alpha) {
    const img = images[key];
    ctx.globalAlpha = alpha;
    if (loadImgReady(img)) ctx.drawImage(img, 0, 0, W, H);
    else {
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
    drawOneBg(BG_KEYS[bgIndex], 1);
    if (bgFade > 0) drawOneBg(BG_KEYS[nextBgIndex], bgFade);
    ctx.fillStyle = "rgba(8, 24, 12, 0.16)";
    ctx.fillRect(0, GROUND - 6, W, H - GROUND + 6);
  }

  function drawTrees() {
    TREE_SPOTS.forEach((t) => {
      if (loadImgReady(images.tree)) {
        const tw = 132;
        const th = 210;
        // Shorter draw so canopy sits near climb platform
        ctx.drawImage(images.tree, t.x - tw / 2, GROUND - th + 10, tw, th);
      } else {
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(t.x - 12, GROUND - 150, 24, 150);
        ctx.fillStyle = "#2f7a3a";
        ctx.beginPath();
        ctx.arc(t.x, GROUND - 155, 42, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!player.climbing && Math.abs(player.x - t.x) < 58) {
        ctx.fillStyle = "rgba(255, 225, 110, 0.9)";
        ctx.font = "800 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("▲ 나무", t.x, t.climbY - 28);
      }
    });
  }

  function drawPlayer() {
    const img = images.hunter;
    const h = player.climbing ? 96 : 118;
    const w = player.climbing ? 64 : 76;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.hurtFlash > 0) ctx.globalAlpha = 0.45 + Math.sin(performance.now() / 30) * 0.25;
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
    ctx.fillRect(player.x - hpW / 2, barY, hpW, 6);
    ctx.fillStyle = player.hp > 35 ? "#58e07a" : "#ff5b6a";
    ctx.fillRect(player.x - hpW / 2, barY, hpW * clamp(player.hp / 100, 0, 1), 6);
  }

  function drawDinos() {
    dinos.forEach((d) => {
      const img = images[d.type];
      // Sprites face LEFT by default: flip when moving right
      const face = d.vx >= 0 ? -1 : 1;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.lean || 0);
      if (d.hitFlash > 0) ctx.filter = "brightness(2.1)";
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
      ctx.fillRect(d.x - 28, d.y - d.h - 12, 56, 5);
      ctx.fillStyle = ratio > 0.4 ? "#8cff7a" : "#ff6a6a";
      ctx.fillRect(d.x - 28, d.y - d.h - 12, 56 * ratio, 5);
    });
  }

  function drawBullets() {
    bullets.forEach((b) => {
      const ang = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      // Slim tracer round instead of glowing orb
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
    ctx.save();
    ctx.strokeStyle = "rgba(255,245,180,.28)";
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(muzzle.x, muzzle.y);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (muzzleFlash > 0) {
      ctx.fillStyle = `rgba(255,230,140,${muzzleFlash * 8})`;
      ctx.beginPath();
      ctx.arc(muzzle.x, muzzle.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = aiming ? "rgba(255,240,160,.95)" : "rgba(255,240,160,.7)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(aimX, aimY, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aimX - 17, aimY);
    ctx.lineTo(aimX - 6, aimY);
    ctx.moveTo(aimX + 6, aimY);
    ctx.lineTo(aimX + 17, aimY);
    ctx.moveTo(aimX, aimY - 17);
    ctx.lineTo(aimX, aimY - 6);
    ctx.moveTo(aimX, aimY + 6);
    ctx.lineTo(aimX, aimY + 17);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,240,160,.85)";
    ctx.beginPath();
    ctx.arc(aimX, aimY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFx() {
    blood.forEach((b) => {
      ctx.globalAlpha = clamp(b.life / 0.8, 0, 1) * 0.45;
      ctx.fillStyle = "#7a1f1f";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    particles.forEach((p) => {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    floats.forEach((f) => {
      ctx.globalAlpha = clamp(f.life / 0.9, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = "900 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
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

  // Mouse move / touch drag: aim only. Click / tap on field: aim + shoot.
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
