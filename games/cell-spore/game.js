(() => {
  "use strict";

  const GAME_ID = "cell-spore";
  const W = 390;
  const H = 700;
  const WORLD = 2400;

  const ERAS = [
    { id: "cell", name: "세포", need: 0, color: "#5fd4c8" },
    { id: "creature", name: "생물", need: 28, color: "#7dffc2" },
    { id: "tribe", name: "부족", need: 55, color: "#a78bfa" },
    { id: "civ", name: "문명", need: 90, color: "#f0c44a" },
    { id: "space", name: "우주", need: 130, color: "#7aa2ff" },
  ];

  const PARTS = {
    mouth: { cost: 4, label: "입", max: 3 },
    eye: { cost: 5, label: "눈", max: 3 },
    spike: { cost: 6, label: "가시", max: 4 },
    flagella: { cost: 5, label: "편모", max: 4 },
    shell: { cost: 7, label: "갑피", max: 2 },
    leg: { cost: 10, label: "다리", max: 4 },
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const overlays = {
    title: document.getElementById("title"),
    over: document.getElementById("over"),
  };
  const hint = document.getElementById("hint");
  const shop = document.getElementById("shop");
  const eraBanner = document.getElementById("era-banner");
  const eraText = document.getElementById("era-text");

  let state = "title";
  let score = 0;
  let dna = 0;
  let dnaSpent = 0;
  let eraIndex = 0;
  let player = null;
  let foods = [];
  let foes = [];
  let allies = [];
  let nests = [];
  let particles = [];
  let floats = [];
  let bubbles = [];
  let lands = [];
  let stars = [];
  let shake = 0;
  let flash = 0;
  let bannerT = 0;
  let hintTimer = 0;
  let spawnAcc = 0;
  let foeAcc = 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let pointerId = null;
  let stick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
  let keys = { up: false, down: false, left: false, right: false };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function era() {
    return ERAS[eraIndex];
  }
  function nextEraNeed() {
    return eraIndex + 1 < ERAS.length ? ERAS[eraIndex + 1].need : ERAS[ERAS.length - 1].need + 40;
  }

  function countPart(type) {
    return player ? player.parts.filter((p) => p.type === type).length : 0;
  }

  function bodyRadius() {
    if (!player) return 16;
    return 14 + Math.log2(1 + player.parts.length + dnaSpent * 0.15) * 4.2 + eraIndex * 2;
  }

  function moveSpeed() {
    const flags = countPart("flagella");
    const legs = countPart("leg");
    const base = eraIndex >= 1 ? 155 : 175;
    return base + flags * 22 + legs * 12 - countPart("shell") * 8;
  }

  function updateHud() {
    document.getElementById("hud-era").textContent = era().name;
    document.getElementById("hud-score").textContent = String(Math.floor(score));
    document.getElementById("hud-dna").textContent = String(dna);
    document.getElementById("hud-hp").textContent = player ? String(Math.max(0, Math.ceil(player.hp))) : "3";
    const need = nextEraNeed();
    const prev = ERAS[eraIndex].need;
    const pct = eraIndex >= ERAS.length - 1
      ? 100
      : clamp(((dnaSpent + dna) - prev) / Math.max(1, need - prev), 0, 1) * 100;
    document.getElementById("dna-fill").style.width = `${pct}%`;
    document.querySelectorAll(".part-btn").forEach((btn) => {
      const type = btn.dataset.part;
      const def = PARTS[type];
      const locked = type === "leg" && eraIndex < 1;
      btn.disabled = locked || !player || dna < def.cost || countPart(type) >= def.max;
      btn.style.display = locked ? "none" : "";
      btn.querySelector("span").textContent = String(def.cost);
    });
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.9, vy: -46 });
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < Math.min(n, 16); i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(30, 150);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.25, 0.55), r: rand(1.5, 4), color,
      });
    }
  }

  function showEraBanner(name) {
    eraText.textContent = `${name} 시대!`;
    eraBanner.classList.remove("hidden");
    bannerT = 1.8;
  }

  function attachPart(type) {
    const def = PARTS[type];
    if (!player || !def || dna < def.cost || countPart(type) >= def.max) return false;
    if (type === "leg" && eraIndex < 1) return false;
    dna -= def.cost;
    dnaSpent += def.cost;
    const n = countPart(type);
    const ang = (Math.PI * 2 * (player.parts.length + n * 0.3)) / 8 + rand(-0.2, 0.2);
    player.parts.push({
      type, ang, pulse: rand(0, Math.PI * 2),
    });
    burst(player.x, player.y, "#7dffc2", 12);
    addFloat(player.x, player.y - 24, `+${def.label}`, "#7dffc2");
    flash = 0.1;
    shake = 0.12;
    score += def.cost * 2;
    checkEraAdvance();
    updateHud();
    return true;
  }

  function checkEraAdvance() {
    const total = dnaSpent + dna;
    while (eraIndex + 1 < ERAS.length && total >= ERAS[eraIndex + 1].need) {
      eraIndex += 1;
      showEraBanner(ERAS[eraIndex].name);
      score += 40 + eraIndex * 25;
      flash = 0.2;
      shake = 0.25;
      onEraEnter(eraIndex);
    }
    if (eraIndex >= ERAS.length - 1 && total >= ERAS[ERAS.length - 1].need + 35) {
      endGame("space");
    }
  }

  function onEraEnter(i) {
    if (i === 1) {
      // Creature: land patches
      for (let k = 0; k < 5; k++) {
        lands.push({
          x: rand(200, WORLD - 200),
          y: rand(200, WORLD - 200),
          r: rand(90, 160),
        });
      }
      hint.textContent = "다리가 열렸어요! 육지로 올라가 보세요";
      hint.classList.remove("fade");
      hintTimer = 3;
    }
    if (i === 2) {
      // Tribe: spawn allies
      for (let k = 0; k < 3; k++) spawnAlly();
      hint.textContent = "부족 동료가 생겼어요!";
      hint.classList.remove("fade");
      hintTimer = 3;
    }
    if (i === 3) {
      nests.push({ x: player.x + 40, y: player.y, r: 28, pulse: 0 });
      hint.textContent = "문명의 둥지! 근처에 있으면 DNA가 생깁니다";
      hint.classList.remove("fade");
      hintTimer = 3;
    }
    if (i === 4) {
      for (let k = 0; k < 40; k++) {
        stars.push({
          x: rand(0, WORLD), y: rand(0, WORLD),
          r: rand(0.8, 2.2), tw: rand(0, Math.PI * 2),
        });
      }
      hint.textContent = "우주로! 별을 모으며 최종 진화하세요";
      hint.classList.remove("fade");
      hintTimer = 3;
    }
  }

  function makeFood() {
    const meat = eraIndex >= 1 && Math.random() < 0.35;
    return {
      x: rand(80, WORLD - 80),
      y: rand(80, WORLD - 80),
      r: rand(5, 10),
      kind: meat ? "meat" : "plant",
      bob: rand(0, Math.PI * 2),
      val: meat ? 3 : 2,
    };
  }

  function makeFoe() {
    const parts = [];
    const types = ["mouth", "spike", "flagella", "eye", "shell"];
    const n = 1 + Math.floor(Math.random() * (1 + eraIndex));
    for (let i = 0; i < n; i++) {
      parts.push({
        type: types[Math.floor(Math.random() * types.length)],
        ang: rand(0, Math.PI * 2),
        pulse: rand(0, Math.PI * 2),
      });
    }
    let x;
    let y;
    do {
      x = rand(120, WORLD - 120);
      y = rand(120, WORLD - 120);
    } while (player && Math.hypot(x - player.x, y - player.y) < 280);
    return {
      x, y, parts,
      hp: 1 + eraIndex * 0.6 + parts.filter((p) => p.type === "shell").length,
      r: 12 + parts.length * 2,
      facing: rand(0, Math.PI * 2),
      think: rand(0.2, 0.8),
      color: `hsl(${rand(0, 40)},65%,55%)`,
      hurt: 0,
    };
  }

  function spawnAlly() {
    allies.push({
      x: player.x + rand(-40, 40),
      y: player.y + rand(-40, 40),
      ang: rand(0, Math.PI * 2),
      r: 9,
      phase: rand(0, Math.PI * 2),
    });
  }

  function resetWorld() {
    score = 0;
    dna = 6;
    dnaSpent = 0;
    eraIndex = 0;
    foods = [];
    foes = [];
    allies = [];
    nests = [];
    particles = [];
    floats = [];
    lands = [];
    stars = [];
    shake = 0;
    flash = 0;
    bannerT = 0;
    player = {
      x: WORLD / 2, y: WORLD / 2,
      facing: 0, mouth: 0, hp: 3, maxHp: 3,
      invuln: 1.2, parts: [
        { type: "mouth", ang: 0, pulse: 0 },
        { type: "eye", ang: -0.8, pulse: 0 },
      ],
    };
    for (let i = 0; i < 28; i++) foods.push(makeFood());
    foes.push(makeFoe(), makeFoe(), makeFoe());
    for (let i = 0; i < 50; i++) {
      bubbles.push({
        x: rand(0, WORLD), y: rand(0, WORLD),
        r: rand(2, 8), a: rand(0, Math.PI * 2), sp: rand(8, 22),
      });
    }
    hintTimer = 4;
    hint.classList.remove("fade");
    hint.textContent = "드래그로 헤엄 · DNA로 신체 부위 부착 · 진화하세요!";
    shop.classList.add("show");
    updateHud();
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    overlays.title.classList.add("hidden");
    overlays.over.classList.add("hidden");
    eraBanner.classList.add("hidden");
    resetWorld();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function endGame(reason) {
    state = "over";
    shop.classList.remove("show");
    const badge = document.getElementById("over-badge");
    const title = document.getElementById("over-title");
    if (reason === "dead") {
      badge.textContent = "EXTINCT";
      badge.className = "badge";
      title.textContent = "멸종…";
    } else if (reason === "space") {
      badge.textContent = "COSMIC";
      badge.className = "badge soft";
      title.textContent = "우주 문명 달성!";
      score += 120;
    } else {
      badge.textContent = "EVOLVED";
      badge.className = "badge soft";
      title.textContent = "여정 종료";
    }
    document.getElementById("over-detail").textContent =
      `점수 ${Math.floor(score).toLocaleString()} · ${era().name} 시대 · 부위 ${player ? player.parts.length : 0}개 · DNA ${dnaSpent + dna}`;
    overlays.over.classList.remove("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "셀 스포어", formParent: overlays.over });
      TodayGameRank.open(Math.floor(score));
    }
  }

  function hurtPlayer(amt) {
    if (!player || player.invuln > 0) return;
    const shell = countPart("shell");
    const dmg = Math.max(0.35, amt - shell * 0.35);
    player.hp -= dmg;
    player.invuln = 0.9;
    shake = 0.25;
    flash = 0.15;
    burst(player.x, player.y, "#ff6b7a", 12);
    if (player.hp <= 0) endGame("dead");
    updateHud();
  }

  function tryEat(f, i, dt) {
    const mouths = countPart("mouth");
    if (f.kind === "meat" && mouths < 2 && eraIndex < 1) return;
    const dist = Math.hypot(f.x - player.x, f.y - player.y);
    const reach = bodyRadius() + f.r + mouths * 3;
    if (dist < reach) {
      dna += f.val;
      score += f.val * 3;
      burst(f.x, f.y, f.kind === "meat" ? "#ff7a68" : "#7dffc2", 8);
      addFloat(f.x, f.y - 10, `+${f.val} DNA`, "#a78bfa");
      foods.splice(i, 1);
      if (player.hp < player.maxHp && Math.random() < 0.15) {
        player.hp = Math.min(player.maxHp, player.hp + 0.5);
      }
      checkEraAdvance();
      updateHud();
    } else if (dist < reach + 40 + countPart("eye") * 15) {
      const ang = Math.atan2(player.y - f.y, player.x - f.x);
      f.x += Math.cos(ang) * 55 * dt;
      f.y += Math.sin(ang) * 55 * dt;
    }
  }

  function updateFoe(f, dt) {
    f.think -= dt;
    if (f.hurt > 0) f.hurt -= dt;
    if (f.think <= 0) {
      f.think = rand(0.4, 1);
      if (player && Math.hypot(player.x - f.x, player.y - f.y) < 260) {
        const aggressive = f.parts.some((p) => p.type === "spike" || p.type === "mouth");
        if (aggressive && player.parts.length <= f.parts.length + 1) {
          f.target = { x: player.x, y: player.y };
        } else {
          f.target = { x: f.x + (f.x - player.x), y: f.y + (f.y - player.y) };
        }
      } else {
        f.target = { x: rand(100, WORLD - 100), y: rand(100, WORLD - 100) };
      }
    }
    if (f.target) {
      const ang = Math.atan2(f.target.y - f.y, f.target.x - f.x);
      const sp = 70 + f.parts.filter((p) => p.type === "flagella").length * 15;
      f.x = clamp(f.x + Math.cos(ang) * sp * dt, 40, WORLD - 40);
      f.y = clamp(f.y + Math.sin(ang) * sp * dt, 40, WORLD - 40);
      f.facing = ang;
    }
    f.parts.forEach((p) => { p.pulse += dt * 4; });

    if (!player) return;
    const dist = Math.hypot(f.x - player.x, f.y - player.y);
    const sumR = bodyRadius() + f.r;

    // Player spikes damage foe
    const spikes = countPart("spike");
    if (spikes > 0 && dist < sumR * 1.05) {
      f.hp -= spikes * 1.2 * dt;
      f.hurt = 0.15;
      if (f.hp <= 0) {
        dna += 4 + f.parts.length;
        score += 15 + f.parts.length * 5;
        burst(f.x, f.y, f.color, 14);
        addFloat(f.x, f.y - 12, "사냥!", "#ff9a4a");
        f.dead = true;
        checkEraAdvance();
        updateHud();
        return;
      }
    }

    // Foe spikes / contact hurt player
    const foeSpikes = f.parts.filter((p) => p.type === "spike").length;
    if (dist < sumR * 0.9) {
      if (foeSpikes > 0 || f.parts.length >= player.parts.length) {
        hurtPlayer(0.8 + foeSpikes * 0.25);
      }
    }
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) eraBanner.classList.add("hidden");
    }
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hint.classList.add("fade");
    }

    let mx = 0;
    let my = 0;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (stick.active && (Math.abs(stick.dx) > 6 || Math.abs(stick.dy) > 6)) {
      mx = stick.dx;
      my = stick.dy;
    }
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      const sp = moveSpeed();
      player.x += (mx / len) * sp * dt;
      player.y += (my / len) * sp * dt;
      player.facing = Math.atan2(my, mx);
      player.mouth = (player.mouth + dt * 10) % (Math.PI * 2);
    } else {
      player.mouth *= 0.9;
    }
    player.x = clamp(player.x, 40, WORLD - 40);
    player.y = clamp(player.y, 40, WORLD - 40);
    player.parts.forEach((p) => { p.pulse += dt * 5; });

    // Nest DNA drip
    for (const n of nests) {
      n.pulse += dt;
      if (Math.hypot(n.x - player.x, n.y - player.y) < 80) {
        dna += dt * 1.2;
        score += dt * 2;
      }
    }

    // Space stars collect
    if (eraIndex >= 4) {
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.tw += dt * 3;
        if (Math.hypot(s.x - player.x, s.y - player.y) < bodyRadius() + 20) {
          dna += 2;
          score += 8;
          burst(s.x, s.y, "#ffe27a", 6);
          stars.splice(i, 1);
          checkEraAdvance();
        }
      }
    }

    for (let i = foods.length - 1; i >= 0; i--) {
      foods[i].bob += dt * 3;
      tryEat(foods[i], i, dt);
    }

    for (let i = foes.length - 1; i >= 0; i--) {
      updateFoe(foes[i], dt);
      if (foes[i].dead) foes.splice(i, 1);
    }

    // Allies follow and nibble food
    allies.forEach((a, i) => {
      a.phase += dt * 3;
      const ox = player.x + Math.cos(time + i * 2.1) * (50 + i * 12);
      const oy = player.y + Math.sin(time * 0.9 + i * 1.7) * (50 + i * 12);
      a.x += (ox - a.x) * Math.min(1, dt * 3);
      a.y += (oy - a.y) * Math.min(1, dt * 3);
      for (let fi = foods.length - 1; fi >= 0; fi--) {
        const f = foods[fi];
        if (Math.hypot(f.x - a.x, f.y - a.y) < 16) {
          dna += 1;
          score += 2;
          foods.splice(fi, 1);
          updateHud();
        }
      }
    });

    spawnAcc += dt;
    if (spawnAcc > 0.85 && foods.length < 36) {
      spawnAcc = 0;
      foods.push(makeFood());
    }
    foeAcc += dt;
    if (foeAcc > 4.5 && foes.length < 4 + eraIndex) {
      foeAcc = 0;
      foes.push(makeFoe());
    }

    bubbles.forEach((b) => {
      b.a += dt * 0.5;
      b.y -= b.sp * dt * 0.15;
      if (b.y < 0) b.y = WORLD;
    });

    if (particles.length > 90) particles.splice(0, particles.length - 90);
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

    // Slow score drip for survival
    score += dt * (1 + eraIndex * 0.5);
    updateHud();
  }

  function worldToScreen(x, y) {
    return {
      x: (x - player.x) + W / 2,
      y: (y - player.y) + H / 2,
    };
  }

  function drawPart(g, part, cx, cy, facing, scale, colorTint) {
    const ang = facing + part.ang;
    const reach = bodyRadius() * scale * 0.85;
    const px = cx + Math.cos(ang) * reach;
    const py = cy + Math.sin(ang) * reach;
    const pulse = 1 + Math.sin(part.pulse) * 0.08;
    g.save();
    g.translate(px, py);
    g.rotate(ang);

    if (part.type === "mouth") {
      g.fillStyle = colorTint || "#ff6b7a";
      g.beginPath();
      g.moveTo(4 * pulse, 0);
      g.lineTo(-6, -7 * pulse);
      g.lineTo(-6, 7 * pulse);
      g.closePath();
      g.fill();
    } else if (part.type === "eye") {
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(0, 0, 5 * pulse, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1a2030";
      g.beginPath();
      g.arc(1.5, 0, 2.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(0.5, -1, 0.8, 0, Math.PI * 2);
      g.fill();
    } else if (part.type === "spike") {
      g.fillStyle = colorTint || "#c084fc";
      g.beginPath();
      g.moveTo(10 * pulse, 0);
      g.lineTo(-2, -4);
      g.lineTo(-2, 4);
      g.closePath();
      g.fill();
    } else if (part.type === "flagella") {
      g.strokeStyle = colorTint || "#5fd4c8";
      g.lineWidth = 2.5;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-8, Math.sin(part.pulse) * 8, -16, Math.sin(part.pulse + 1) * 6);
      g.stroke();
    } else if (part.type === "shell") {
      g.strokeStyle = colorTint || "#f0c44a";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, 7 * pulse, -0.9, 0.9);
      g.stroke();
    } else if (part.type === "leg") {
      g.strokeStyle = colorTint || "#8b6a4a";
      g.lineWidth = 3;
      g.lineCap = "round";
      const kick = Math.sin(part.pulse) * 5;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(6, 8 + kick);
      g.lineTo(2, 14 + kick);
      g.stroke();
    }
    g.restore();
  }

  function drawCreature(g, ent, isPlayer) {
    const s = worldToScreen(ent.x, ent.y);
    const rad = (isPlayer ? bodyRadius() : ent.r);
    if (s.x < -80 || s.y < -80 || s.x > W + 80 || s.y > H + 80) return;

    g.save();
    g.translate(s.x, s.y);

    // shadow
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.beginPath();
    g.ellipse(2, rad * 0.55, rad * 0.7, rad * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    const blink = isPlayer && player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    if (!blink) {
      const parts = isPlayer ? player.parts : ent.parts;
      const facing = isPlayer ? player.facing : ent.facing;
      const tint = isPlayer ? null : ent.color;
      parts.forEach((p) => drawPart(g, p, 0, 0, facing, 1, tint));

      const grd = g.createRadialGradient(-rad * 0.3, -rad * 0.3, rad * 0.1, 0, 0, rad);
      if (isPlayer) {
        grd.addColorStop(0, "#d8fff6");
        grd.addColorStop(0.45, era().color);
        grd.addColorStop(1, "#1a4a48");
        g.shadowColor = era().color;
        g.shadowBlur = 12;
      } else {
        grd.addColorStop(0, "#ffe0d8");
        grd.addColorStop(0.4, ent.color);
        grd.addColorStop(1, "#3a1820");
        if (ent.hurt > 0) g.globalAlpha = 0.7;
      }
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, rad, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.globalAlpha = 1;

      g.fillStyle = "rgba(255,255,255,0.35)";
      g.beginPath();
      g.ellipse(-rad * 0.28, -rad * 0.3, rad * 0.28, rad * 0.16, -0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function draw(g) {
    if (!player) return;
    g.save();
    if (shake > 0) g.translate(rand(-2, 2) * shake * 5, rand(-2, 2) * shake * 5);

    // Background by era
    if (eraIndex >= 4) {
      g.fillStyle = "#050814";
      g.fillRect(0, 0, W, H);
      for (const s of stars) {
        const p = worldToScreen(s.x, s.y);
        g.globalAlpha = 0.4 + Math.sin(s.tw) * 0.4;
        g.fillStyle = "#ffe9a8";
        g.beginPath();
        g.arc(p.x, p.y, s.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    } else {
      const bg = g.createRadialGradient(W * 0.5, H * 0.4, 30, W * 0.5, H * 0.5, H);
      bg.addColorStop(0, eraIndex >= 3 ? "#1a3a2a" : eraIndex >= 1 ? "#0e3a48" : "#0a3a44");
      bg.addColorStop(1, "#041018");
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
    }

    // Bubbles / particles in water eras
    if (eraIndex < 4) {
      for (const b of bubbles) {
        const s = worldToScreen(b.x, b.y);
        if (s.x < -20 || s.y < -20 || s.x > W + 20 || s.y > H + 20) continue;
        g.strokeStyle = "rgba(150,220,230,0.15)";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(s.x, s.y, b.r, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // Land
    for (const L of lands) {
      const s = worldToScreen(L.x, L.y);
      g.fillStyle = "rgba(90,140,70,0.35)";
      g.beginPath();
      g.ellipse(s.x, s.y, L.r, L.r * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(120,170,80,0.25)";
      g.beginPath();
      g.ellipse(s.x, s.y - 4, L.r * 0.7, L.r * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }

    // Nests
    for (const n of nests) {
      const s = worldToScreen(n.x, n.y);
      g.fillStyle = "rgba(240,196,74,0.25)";
      g.beginPath();
      g.arc(s.x, s.y, n.r + Math.sin(n.pulse * 3) * 3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#f0c44a";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "#ffe27a";
      g.font = '700 11px "Jua"';
      g.textAlign = "center";
      g.fillText("둥지", s.x, s.y + 4);
    }

    for (const f of foods) {
      const s = worldToScreen(f.x, f.y);
      const bob = Math.sin(f.bob) * 2;
      if (s.x < -20 || s.y < -20 || s.x > W + 20 || s.y > H + 20) continue;
      g.fillStyle = f.kind === "meat" ? "#ff7a68" : "#7dff9a";
      g.beginPath();
      g.arc(s.x, s.y + bob, f.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.beginPath();
      g.arc(s.x - 2, s.y + bob - 2, f.r * 0.35, 0, Math.PI * 2);
      g.fill();
    }

    for (const a of allies) {
      const s = worldToScreen(a.x, a.y);
      g.fillStyle = "#a78bfa";
      g.beginPath();
      g.arc(s.x, s.y, a.r, 0, Math.PI * 2);
      g.fill();
    }

    for (const f of foes) drawCreature(g, f, false);
    drawCreature(g, player, true);

    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      g.globalAlpha = Math.max(0, p.life * 2);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(s.x, s.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    for (const f of floats) {
      const s = worldToScreen(f.x, f.y);
      g.globalAlpha = Math.min(1, f.life * 1.4);
      g.fillStyle = f.color;
      g.font = '700 14px "Jua"';
      g.textAlign = "center";
      g.fillText(f.text, s.x, s.y);
    }
    g.globalAlpha = 1;

    // minimap
    const mw = 64;
    const mh = 64;
    const mx = W - mw - 12;
    const my = H - mh - 120;
    g.fillStyle = "rgba(6,24,36,0.8)";
    g.strokeStyle = "rgba(95,212,200,0.3)";
    g.lineWidth = 1.5;
    g.beginPath();
    const rr = 10;
    g.moveTo(mx + rr, my);
    g.arcTo(mx + mw, my, mx + mw, my + mh, rr);
    g.arcTo(mx + mw, my + mh, mx, my + mh, rr);
    g.arcTo(mx, my + mh, mx, my, rr);
    g.arcTo(mx, my, mx + mw, my, rr);
    g.closePath();
    g.fill();
    g.stroke();
    const sx = mw / WORLD;
    const sy = mh / WORLD;
    foes.forEach((f) => {
      g.fillStyle = f.color;
      g.beginPath();
      g.arc(mx + f.x * sx, my + f.y * sy, 2, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = era().color;
    g.beginPath();
    g.arc(mx + player.x * sx, my + player.y * sy, 3, 0, Math.PI * 2);
    g.fill();

    if (stick.active) {
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.beginPath();
      g.arc(stick.ox, stick.oy, 34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(95,212,200,0.5)";
      g.beginPath();
      g.arc(stick.ox + clamp(stick.dx, -22, 22), stick.oy + clamp(stick.dy, -22, 22), 13, 0, Math.PI * 2);
      g.fill();
    }

    if (flash > 0) {
      g.fillStyle = `rgba(125,255,194,${flash * 0.3})`;
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
      console.error("[cell-spore]", err);
    }
    if (state === "play" || state === "paused") raf = requestAnimationFrame(loop);
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
    if (ev.target.closest && ev.target.closest(".shop")) return;
    pointerId = ev.pointerId;
    try { canvas.setPointerCapture(pointerId); } catch (_) { /* ignore */ }
    const p = canvasPos(ev);
    stick.active = true;
    stick.ox = p.x; stick.oy = p.y;
    stick.dx = 0; stick.dy = 0;
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (state !== "play" || ev.pointerId !== pointerId || !stick.active) return;
    const p = canvasPos(ev);
    stick.dx = p.x - stick.ox;
    stick.dy = p.y - stick.oy;
  });
  canvas.addEventListener("pointerup", (ev) => {
    if (ev.pointerId === pointerId) {
      pointerId = null;
      stick.active = false;
      stick.dx = 0; stick.dy = 0;
    }
  });
  canvas.addEventListener("pointercancel", () => {
    pointerId = null;
    stick.active = false;
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") { keys.left = true; ev.preventDefault(); }
    if (ev.code === "ArrowRight" || ev.code === "KeyD") { keys.right = true; ev.preventDefault(); }
    if (ev.code === "ArrowUp" || ev.code === "KeyW") { keys.up = true; ev.preventDefault(); }
    if (ev.code === "ArrowDown" || ev.code === "KeyS") { keys.down = true; ev.preventDefault(); }
    if (ev.code === "Digit1") attachPart("mouth");
    if (ev.code === "Digit2") attachPart("eye");
    if (ev.code === "Digit3") attachPart("spike");
    if (ev.code === "Digit4") attachPart("flagella");
    if (ev.code === "Digit5") attachPart("shell");
    if (ev.code === "Digit6") attachPart("leg");
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") keys.left = false;
    if (ev.code === "ArrowRight" || ev.code === "KeyD") keys.right = false;
    if (ev.code === "ArrowUp" || ev.code === "KeyW") keys.up = false;
    if (ev.code === "ArrowDown" || ev.code === "KeyS") keys.down = false;
  });

  document.querySelectorAll(".part-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state === "play") attachPart(btn.dataset.part);
    });
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "셀 스포어", formParent: overlays.title });
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

  // Title idle
  player = {
    x: WORLD / 2, y: WORLD / 2, facing: 0, mouth: 0, hp: 3, maxHp: 3, invuln: 0,
    parts: [
      { type: "mouth", ang: 0, pulse: 0 },
      { type: "eye", ang: -0.9, pulse: 0 },
      { type: "spike", ang: 1.2, pulse: 0 },
      { type: "flagella", ang: Math.PI, pulse: 0 },
    ],
  };
  for (let i = 0; i < 20; i++) foods.push(makeFood());
  foes.push(makeFoe());
  for (let i = 0; i < 40; i++) {
    bubbles.push({
      x: rand(0, WORLD), y: rand(0, WORLD),
      r: rand(2, 8), a: rand(0, Math.PI * 2), sp: rand(8, 22),
    });
  }
  last = performance.now();
  raf = requestAnimationFrame(function idle(now) {
    if (state !== "title") return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    player.facing = Math.sin(time * 0.5) * 0.4;
    player.mouth = time * 6;
    player.x = WORLD / 2 + Math.cos(time * 0.35) * 40;
    player.y = WORLD / 2 + Math.sin(time * 0.3) * 30;
    player.parts.forEach((p) => { p.pulse += dt * 4; });
    foods.forEach((f) => { f.bob += dt * 3; });
    draw(ctx);
    raf = requestAnimationFrame(idle);
  });
})();
