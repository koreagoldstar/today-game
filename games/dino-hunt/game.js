(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GROUND = 590;
  const TREE_SPOTS = [
    { x: 78, climbY: 250 },
    { x: 312, climbY: 250 },
  ];

  const WEAPONS = [
    { id: "pistol", name: "권총", kills: 0, dmg: 1, rate: 0.42, spread: 520, spread: 1, spray: 0, pierce: 0, color: "#ffd56a" },
    { id: "shotgun", name: "샷건", kills: 8, dmg: 1, rate: 0.55, speed: 460, pellets: 5, spray: 0.22, pierce: 0, color: "#ff9f4a" },
    { id: "rifle", name: "소총", kills: 20, dmg: 2.4, rate: 0.34, speed: 680, pellets: 1, spray: 0.02, pierce: 0, color: "#7dffb0" },
    { id: "assault", name: "돌격소총", kills: 38, dmg: 1.5, rate: 0.12, speed: 620, pellets: 1, spray: 0.05, pierce: 0, color: "#7ad0ff" },
    { id: "plasma", name: "플라즈마", kills: 65, dmg: 3.2, rate: 0.18, speed: 700, pellets: 1, spray: 0.01, pierce: 2, color: "#d57bff" },
  ];

  const DINO_TYPES = {
    raptor: { src: "assets/raptor.png", hp: 2, speed: 72, score: 120, w: 92, h: 78, flying: false, damage: 10 },
    stego: { src: "assets/stego.png", hp: 5, speed: 38, score: 180, w: 120, h: 70, flying: false, damage: 14 },
    triceratops: { src: "assets/triceratops.png", hp: 7, speed: 46, score: 240, w: 128, h: 72, flying: false, damage: 16 },
    ptera: { src: "assets/ptera.png", hp: 3, speed: 64, score: 200, w: 110, h: 70, flying: true, damage: 10 },
    trex: { src: "assets/trex.png", hp: 16, speed: 34, score: 520, w: 150, h: 100, flying: false, damage: 24 },
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
  let aimX = W * 0.72;
  let aimY = GROUND - 80;

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
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.hypot(dx, dy);
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
    const flying = def.flying;
    dinos.push({
      type,
      x: fromLeft ? -80 : W + 80,
      y: flying ? rand(170, 320) : GROUND,
      vx: (fromLeft ? 1 : -1) * def.speed * (0.85 + Math.random() * 0.2) * (1 + wave * 0.028),
      hp: def.hp + Math.floor(wave * 0.28),
      maxHp: def.hp + Math.floor(wave * 0.28),
      w: def.w,
      h: def.h,
      flying,
      damage: def.damage,
      score: def.score,
      bob: Math.random() * Math.PI * 2,
      hitFlash: 0,
    });
  }

  function nearestTree() {
    let best = null;
    let bestD = 54;
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
    setCoach("나무 위! 프테라만 조심하세요");
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
      if (window.TodayBGM) window.TodayBGM.start("dino-hunt");
      break;
    }
  }

  function resumeAfterUpgrade() {
    ui.upgrade.classList.add("hidden");
    phase = "play";
    last = performance.now();
    setCoach(`${weapon().name} 장착 완료`);
  }

  function fire() {
    if (phase !== "play" || fireCd > 0) return;
    const wpn = weapon();
    fireCd = wpn.rate;
    const muzzleX = player.x + player.face * (player.climbing ? 28 : 34);
    const muzzleY = player.y - (player.climbing ? 78 : 92);
    const targetX = aimX;
    const targetY = aimY;
    const baseAng = Math.atan2(targetY - muzzleY, targetX - muzzleX);
    for (let i = 0; i < wpn.pellets; i += 1) {
      const ang = baseAng + rand(-wpn.spray, wpn.spray);
      bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(ang) * wpn.speed,
        vy: Math.sin(ang) * wpn.speed,
        dmg: wpn.dmg,
        pierce: wpn.pierce,
        life: 1.1,
        color: wpn.color,
        r: wpn.id === "plasma" ? 5.5 : 3.2,
      });
    }
    player.face = targetX >= player.x ? 1 : -1;
    burst(muzzleX, muzzleY, "#ffe6a0", 5, 80);
    shake = Math.max(shake, 2.2);
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
    spawnAcc = 0;
    wave = 1;
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
    setCoach("좌우 이동 · 발사 · 나무로 피하세요");
    spawnDino("raptor");
    // give a short grace period before the second spawn
    spawnAcc = -1.2;
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

  function update(dt) {
    if (phase !== "play" || paused) return;
    fireCd = Math.max(0, fireCd - dt);
    player.inv = Math.max(0, player.inv - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    shake = Math.max(0, shake - dt * 18);
    flash = Math.max(0, flash - dt);

    wave = 1 + Math.floor(kills / 6);
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
      if (Math.abs(player.vx) > 12) player.face = player.vx > 0 ? 1 : -1;
      player.y = GROUND;
    } else if (player.tree) {
      player.climbProgress = clamp(player.climbProgress + dt * 1.6, 0, 1);
      player.x = player.tree.x;
      player.y = lerp(GROUND, player.tree.climbY, player.climbProgress);
      player.vx = 0;
    }

    if (autoFire) fire();

    // Prefer aiming at nearest threat
    let nearest = null;
    let nearestD = 1e9;
    dinos.forEach((d) => {
      const dlt = dist(player.x, player.y - 80, d.x, d.y - d.h * 0.35);
      if (dlt < nearestD) {
        nearestD = dlt;
        nearest = d;
      }
    });
    if (nearest) {
      aimX = nearest.x;
      aimY = nearest.y - nearest.h * 0.4;
      if (!moveLeft && !moveRight) player.face = nearest.x >= player.x ? 1 : -1;
    }

    bullets.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    });

    dinos.forEach((d) => {
      d.bob += dt * (d.flying ? 5 : 3);
      d.hitFlash = Math.max(0, d.hitFlash - dt);
      if (d.flying) {
        d.x += d.vx * dt;
        d.y += Math.sin(d.bob) * 18 * dt;
        d.y = clamp(d.y, 140, 360);
        // home slightly toward player if climbing
        if (player.climbing) {
          d.vx += Math.sign(player.x - d.x) * 20 * dt;
          d.vx = clamp(d.vx, -140, 140);
        }
      } else {
        d.x += d.vx * dt;
        d.y = GROUND;
      }
    });

    // collisions bullets vs dinos
    bullets.forEach((b) => {
      if (b.life <= 0) return;
      dinos.forEach((d) => {
        if (d.hp <= 0 || b.life <= 0) return;
        const hit =
          b.x > d.x - d.w * 0.42 &&
          b.x < d.x + d.w * 0.42 &&
          b.y > d.y - d.h * 0.95 &&
          b.y < d.y - d.h * 0.05;
        if (!hit) return;
        d.hp -= b.dmg;
        d.hitFlash = 0.12;
        b.pierce -= 1;
        if (b.pierce < 0) b.life = 0;
        burst(b.x, b.y, "#ff6b6b", 8, 140);
        hitSound();
        if (d.hp <= 0) {
          kills += 1;
          score += d.score + wave * 15;
          floatText(d.x, d.y - d.h, `+${d.score}`, "#ffe56a");
          burst(d.x, d.y - d.h * 0.4, "#c45a3a", 18, 180);
          blood.push({ x: d.x, y: d.y - 8, life: 0.8 });
          d.hp = 0;
          updateHud();
          checkUpgrade();
        }
      });
    });

    // dino vs player
    dinos.forEach((d) => {
      if (d.hp <= 0) return;
      const canReach = d.flying || !player.climbing || player.climbProgress < 0.55;
      if (!canReach) return;
      const px = player.x;
      const py = player.y - 50;
      const hit =
        Math.abs(d.x - px) < (d.flying ? 28 : 30) &&
        Math.abs((d.y - (d.flying ? d.h * 0.35 : d.h * 0.45)) - py) < (d.flying ? 34 : 38);
      if (hit) hurtPlayer(d.damage);
    });

    dinos = dinos.filter((d) => d.hp > 0 && d.x > -120 && d.x < W + 120);
    bullets = bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
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

  function drawBg() {
    if (loadImgReady(images.bg)) {
      ctx.drawImage(images.bg, 0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#6fa8c8");
      g.addColorStop(0.45, "#4f8a52");
      g.addColorStop(1, "#2d5a34");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = "rgba(8, 24, 12, 0.18)";
    ctx.fillRect(0, GROUND - 8, W, H - GROUND + 8);
  }

  function drawTrees() {
    TREE_SPOTS.forEach((t) => {
      if (loadImgReady(images.tree)) {
        const tw = 150;
        const th = 280;
        ctx.drawImage(images.tree, t.x - tw / 2, GROUND - th + 18, tw, th);
      } else {
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(t.x - 14, GROUND - 210, 28, 210);
        ctx.fillStyle = "#2f7a3a";
        ctx.beginPath();
        ctx.arc(t.x, GROUND - 220, 58, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!player.climbing && Math.abs(player.x - t.x) < 54) {
        ctx.fillStyle = "rgba(255, 225, 110, 0.85)";
        ctx.font = "800 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("▲ 나무", t.x, GROUND - 236);
      }
    });
  }

  function drawPlayer() {
    const img = images.hunter;
    const h = player.climbing ? 108 : 118;
    const w = player.climbing ? 70 : 76;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.hurtFlash > 0) ctx.globalAlpha = 0.45 + Math.sin(performance.now() / 30) * 0.25;
    ctx.scale(player.face, 1);
    if (loadImgReady(img)) {
      ctx.drawImage(img, -w * 0.45, -h, w, h);
    } else {
      ctx.fillStyle = "#d9c08a";
      ctx.fillRect(-18, -90, 36, 90);
    }
    ctx.restore();

    // hp bar
    const hpW = 54;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(player.x - hpW / 2, player.y - (player.climbing ? 120 : 132), hpW, 6);
    ctx.fillStyle = player.hp > 35 ? "#58e07a" : "#ff5b6a";
    ctx.fillRect(player.x - hpW / 2, player.y - (player.climbing ? 120 : 132), hpW * clamp(player.hp / 100, 0, 1), 6);
  }

  function drawDinos() {
    dinos.forEach((d) => {
      const img = images[d.type];
      const face = d.vx >= 0 ? 1 : -1;
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.hitFlash > 0) ctx.filter = "brightness(2.2)";
      ctx.scale(face, 1);
      if (loadImgReady(img)) {
        ctx.drawImage(img, -d.w / 2, -d.h, d.w, d.h);
      } else {
        ctx.fillStyle = "#6b8f4e";
        ctx.fillRect(-d.w / 2, -d.h, d.w, d.h);
      }
      ctx.filter = "none";
      ctx.restore();

      // hp
      const ratio = clamp(d.hp / d.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(d.x - 28, d.y - d.h - 10, 56, 5);
      ctx.fillStyle = ratio > 0.4 ? "#8cff7a" : "#ff6a6a";
      ctx.fillRect(d.x - 28, d.y - d.h - 10, 56 * ratio, 5);
    });
  }

  function drawBullets() {
    bullets.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
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

  function drawAim() {
    if (phase !== "play") return;
    ctx.strokeStyle = "rgba(255,240,160,.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(aimX, aimY, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aimX - 14, aimY);
    ctx.lineTo(aimX - 5, aimY);
    ctx.moveTo(aimX + 5, aimY);
    ctx.lineTo(aimX + 14, aimY);
    ctx.moveTo(aimX, aimY - 14);
    ctx.lineTo(aimX, aimY - 5);
    ctx.moveTo(aimX, aimY + 5);
    ctx.lineTo(aimX, aimY + 14);
    ctx.stroke();
  }

  function draw(time) {
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
    draw(now / 1000);
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

  bindHold(
    document.getElementById("left-btn"),
    () => {
      moveLeft = true;
    },
    () => {
      moveLeft = false;
    }
  );
  bindHold(
    document.getElementById("right-btn"),
    () => {
      moveRight = true;
    },
    () => {
      moveRight = false;
    }
  );
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

  canvas.addEventListener("pointerdown", (e) => {
    if (phase !== "play") return;
    const rect = canvas.getBoundingClientRect();
    aimX = ((e.clientX - rect.left) / rect.width) * W;
    aimY = ((e.clientY - rect.top) / rect.height) * H;
    // ignore taps on lower control area roughly
    if (aimY > 620) return;
    fire();
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
