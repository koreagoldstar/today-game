(() => {
  "use strict";

  const GAME_ID = "number-hole";
  const W = 390;
  const H = 700;
  const WORLD = 2600;
  const ROUND_TIME = 75;
  const START_POWER = 2;
  const MAX_POWER = 18;
  const MAX_BUDS = 8;
  const MAX_CELLS = 18;
  const MAX_RIVALS = 5;
  const MAX_COMBO = 10;

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

  let state = "title";
  let score = 0;
  let combo = 0;
  let comboTimer = 0;
  let maxCombo = 0;
  let timeLeft = ROUND_TIME;
  let player = null;
  let cells = [];
  let rivals = [];
  let particles = [];
  let floats = [];
  let links = [];
  let swirls = [];
  let shake = 0;
  let flash = 0;
  let hintTimer = 0;
  let spawnAcc = 0;
  let rivalAcc = 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let pointerId = null;
  let stick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
  let keys = { up: false, down: false, left: false, right: false };

  const RIVAL_PALETTE = [
    { core: "#ff6b5c", bud: "rgba(255,107,92,0.7)" },
    { core: "#4eb6e8", bud: "rgba(78,182,232,0.7)" },
    { core: "#5fd4a0", bud: "rgba(95,212,160,0.7)" },
    { core: "#f0a04b", bud: "rgba(240,160,75,0.7)" },
    { core: "#d48ad0", bud: "rgba(212,138,208,0.7)" },
  ];
  const CELL_COLORS = ["#ff7aa2", "#ff9a4a", "#4ecdc4", "#7aa2ff", "#c084fc", "#f5c842"];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function cellColor(p) {
    return CELL_COLORS[(Math.max(1, p) - 1) % CELL_COLORS.length];
  }

  function powerRadius(p) {
    return 15 + Math.log2(1 + clamp(p, 1, MAX_POWER)) * 5.2;
  }

  function powerSpeed(p, budCount) {
    const drag = 1 - Math.min(0.28, budCount * 0.03);
    return Math.max(130, (232 - Math.log2(1 + p) * 10) * drag);
  }

  function viewZoom() {
    if (!player) return 1;
    const sprawl = player.buds.length * 0.012;
    return clamp(1 - (player.power - START_POWER) * 0.018 - sprawl, 0.58, 1);
  }

  function massNeeded(power) {
    return 2 + Math.floor(power * 0.7);
  }

  function budNeeded(power, budCount) {
    return 3 + budCount + Math.floor(power * 0.4);
  }

  function updateHud() {
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-power").textContent = player ? String(player.power) : String(START_POWER);
    document.getElementById("hud-combo").textContent = String(combo);
    document.getElementById("hud-time").textContent = String(Math.max(0, Math.ceil(timeLeft)));
    const colony = document.getElementById("hud-colony");
    if (colony && player) colony.textContent = String(1 + player.buds.length);
    const fill = document.getElementById("xp-fill");
    if (fill && player) {
      if (player.power >= MAX_POWER) fill.style.width = "100%";
      else fill.style.width = `${Math.min(100, (player.mass / massNeeded(player.power)) * 100)}%`;
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.85, vy: -48 });
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < Math.min(n, 18); i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 170);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.25, 0.55), r: rand(1.5, 4.2), color, glow: true,
      });
    }
  }

  function addLink(ax, ay, bx, by, color, life = 0.35) {
    links.push({ ax, ay, bx, by, color, life, max: life });
  }

  function spawnSwirl(x, y) {
    for (let i = 0; i < 4; i++) {
      swirls.push({
        x, y, a: rand(0, Math.PI * 2), r: rand(16, 36),
        life: rand(0.4, 0.75), w: rand(2, 4),
      });
    }
  }

  function makeBud(owner, angle) {
    const orbit = powerRadius(owner.power) + 18 + rand(0, 10);
    return {
      angle: angle ?? rand(0, Math.PI * 2),
      orbit,
      x: owner.x + Math.cos(angle || 0) * orbit,
      y: owner.y + Math.sin(angle || 0) * orbit,
      r: 7 + rand(0, 3),
      pulse: rand(0, Math.PI * 2),
    };
  }

  /** Mix: smaller / same / larger — not everything edible */
  function rollCellPower(base) {
    const roll = Math.random();
    if (roll < 0.38) return Math.max(1, base - 1 - Math.floor(Math.random() * 2));
    if (roll < 0.62) return base;
    return Math.min(MAX_POWER, base + 1 + Math.floor(Math.random() * 2));
  }

  function makeCell(forced) {
    const base = player ? player.power : START_POWER;
    const p = forced == null ? rollCellPower(base) : forced;
    let x;
    let y;
    do {
      x = rand(100, WORLD - 100);
      y = rand(100, WORLD - 100);
    } while (player && Math.hypot(x - player.x, y - player.y) < 120);
    return {
      x, y, power: Math.max(1, p),
      bob: rand(0, Math.PI * 2),
      mergeLock: 0,
      vx: rand(-20, 20),
      vy: rand(-20, 20),
    };
  }

  function makeRival(forced) {
    const base = player ? player.power : START_POWER;
    const p = clamp(forced ?? Math.round(rand(base, base + 2.5)), 1, MAX_POWER);
    const pal = RIVAL_PALETTE[Math.floor(Math.random() * RIVAL_PALETTE.length)];
    let x;
    let y;
    do {
      x = rand(180, WORLD - 180);
      y = rand(180, WORLD - 180);
    } while (player && Math.hypot(x - player.x, y - player.y) < 450);
    const r = {
      x, y, power: p, mass: 0, budBank: 0,
      buds: [], vx: 0, vy: 0,
      color: pal.core, budColor: pal.bud,
      think: rand(0.3, 0.8), target: null,
      mouth: 0, facing: 0, alive: true, mergeLock: 0, invuln: 0,
    };
    const n = Math.floor(rand(0, 2));
    for (let i = 0; i < n; i++) r.buds.push(makeBud(r, (Math.PI * 2 * i) / Math.max(1, n)));
    return r;
  }

  function resetWorld() {
    score = 0;
    combo = 0;
    comboTimer = 0;
    maxCombo = 0;
    timeLeft = ROUND_TIME;
    shake = 0;
    flash = 0;
    cells = [];
    rivals = [];
    particles = [];
    floats = [];
    links = [];
    swirls = [];
    player = {
      x: WORLD / 2, y: WORLD / 2,
      power: START_POWER, mass: 0, budBank: 0,
      buds: [], mouth: 0, facing: 0,
      invuln: 1.4, mergeLock: 0, squash: 0,
    };
    for (let i = 0; i < 14; i++) cells.push(makeCell());
    rivals.push(makeRival(2), makeRival(3), makeRival(4), makeRival(5));
    hintTimer = 3.5;
    hint.classList.remove("fade", "hidden");
    updateHud();
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    overlays.title.classList.add("hidden");
    overlays.over.classList.add("hidden");
    resetWorld();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function endGame(reason) {
    state = "over";
    const badge = document.getElementById("over-badge");
    const title = document.getElementById("over-title");
    if (reason === "eaten") {
      badge.textContent = "ABSORBED";
      badge.className = "badge";
      title.textContent = "삼켜졌어요!";
    } else {
      badge.textContent = "TIME UP";
      badge.className = "badge soft";
      title.textContent = "시간 종료!";
    }
    const colony = player ? 1 + player.buds.length : 0;
    document.getElementById("over-detail").textContent =
      `점수 ${score.toLocaleString()} · 숫자 ${player ? player.power : 0} · 세력 ${colony} · 콤보 ${maxCombo}`;
    overlays.over.classList.remove("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "넘버 홀", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function trySpawnBud(owner, isPlayer) {
    if (owner.buds.length >= MAX_BUDS) return false;
    while (owner.budBank >= budNeeded(owner.power, owner.buds.length) && owner.buds.length < MAX_BUDS) {
      owner.budBank -= budNeeded(owner.power, owner.buds.length);
      const ang = (Math.PI * 2 * owner.buds.length) / MAX_BUDS + rand(-0.2, 0.2);
      owner.buds.push(makeBud(owner, ang));
      if (isPlayer) {
        addFloat(owner.x, owner.y - 20, "증식!", "#7dffc2");
        burst(owner.x, owner.y, "#7dffc2", 8);
      }
    }
    return true;
  }

  function growCore(owner, bite, isPlayer, x, y, label) {
    const gain = bite <= 1 ? 1 : bite === 2 ? 2 : Math.min(4, bite);
    owner.mass += gain;
    owner.budBank += gain;
    let leveled = 0;
    while (owner.power < MAX_POWER && owner.mass >= massNeeded(owner.power)) {
      owner.mass -= massNeeded(owner.power);
      owner.power += 1;
      leveled += 1;
    }
    if (owner.power >= MAX_POWER) owner.mass = 0;
    trySpawnBud(owner, isPlayer);

    if (isPlayer) {
      const points = 3 + Math.floor(Math.min(combo, MAX_COMBO) * 0.8) + leveled * 8;
      score += points;
      combo = Math.min(MAX_COMBO, combo + 1);
      maxCombo = Math.max(maxCombo, combo);
      comboTimer = 1.3;
      burst(x, y, "#f5c842", 6 + bite);
      spawnSwirl(owner.x, owner.y);
      if (leveled) {
        addFloat(x, y - 12, `${owner.power}!`, "#ffe27a");
        owner.squash = 0.35;
        flash = 0.12;
        shake = 0.2;
      } else {
        addFloat(x, y - 8, label || `+${points}`, "#f0c44a");
      }
      if (combo >= 4 && combo % 2 === 0) addFloat(x, y - 28, `${combo} HIT`, "#ff7a68");
      updateHud();
    }
  }

  /** Same-power merge → +1 (suika-style) */
  function mergeWithCell(owner, cell, isPlayer) {
    if (owner.mergeLock > 0 || cell.mergeLock > 0) return false;
    if (owner.power !== cell.power || owner.power >= MAX_POWER) return false;
    const dist = Math.hypot(owner.x - cell.x, owner.y - cell.y);
    if (dist > powerRadius(owner.power) * 1.15) return false;

    addLink(owner.x, owner.y, cell.x, cell.y, isPlayer ? "#f5c842" : owner.color, 0.4);
    owner.power += 1;
    owner.mergeLock = 0.35;
    owner.squash = 0.45;
    owner.mass = Math.max(0, owner.mass - 1);
    owner.budBank += 2;
    trySpawnBud(owner, isPlayer);

    if (isPlayer) {
      const pts = 18 + combo * 2;
      score += pts;
      combo = Math.min(MAX_COMBO, combo + 1);
      maxCombo = Math.max(maxCombo, combo);
      comboTimer = 1.5;
      addFloat(owner.x, owner.y - 16, `합체 ${owner.power}!`, "#7dffc2");
      burst(owner.x, owner.y, "#7dffc2", 16);
      spawnSwirl(owner.x, owner.y);
      flash = 0.15;
      shake = 0.25;
      updateHud();
    } else {
      burst(owner.x, owner.y, owner.color, 10);
    }
    return true;
  }

  function mergePlayerRival(r) {
    if (player.mergeLock > 0 || r.mergeLock > 0) return false;
    if (player.power !== r.power || player.power >= MAX_POWER) return false;
    const dist = Math.hypot(player.x - r.x, player.y - r.y);
    if (dist > (powerRadius(player.power) + powerRadius(r.power)) * 0.55) return false;

    addLink(player.x, player.y, r.x, r.y, "#ffe27a", 0.5);
    player.power += 1;
    player.mergeLock = 0.4;
    player.squash = 0.5;
    player.budBank += 3 + r.buds.length;
    // Absorb rival buds into player colony
    for (const b of r.buds) {
      if (player.buds.length >= MAX_BUDS) break;
      player.buds.push({
        angle: b.angle, orbit: b.orbit, x: b.x, y: b.y, r: b.r, pulse: b.pulse,
      });
    }
    trySpawnBud(player, true);
    const pts = 28 + r.buds.length * 4;
    score += pts;
    combo = Math.min(MAX_COMBO, combo + 1);
    maxCombo = Math.max(maxCombo, combo);
    comboTimer = 1.6;
    addFloat(player.x, player.y - 18, `세력 합체!`, "#7dffc2");
    burst(player.x, player.y, "#ffe27a", 18);
    flash = 0.18;
    shake = 0.3;
    updateHud();
    r.alive = false;
    return true;
  }

  function updateBuds(owner, dt) {
    const baseR = powerRadius(owner.power);
    owner.buds.forEach((b, i) => {
      b.pulse += dt * 4;
      b.angle += dt * (0.55 + i * 0.04);
      const targetOrbit = baseR + 16 + i * 3;
      b.orbit += (targetOrbit - b.orbit) * Math.min(1, dt * 4);
      const tx = owner.x + Math.cos(b.angle) * b.orbit;
      const ty = owner.y + Math.sin(b.angle) * b.orbit;
      b.x += (tx - b.x) * Math.min(1, dt * 8);
      b.y += (ty - b.y) * Math.min(1, dt * 8);
      b.r = 6.5 + Math.sin(b.pulse) * 0.8 + Math.min(3, owner.power * 0.12);
    });
  }

  function budsAbsorb(owner, isPlayer, dt) {
    for (const b of owner.buds) {
      for (let i = cells.length - 1; i >= 0; i--) {
        const c = cells[i];
        if (c.power >= owner.power) continue;
        const dist = Math.hypot(c.x - b.x, c.y - b.y);
        if (dist < b.r + powerRadius(c.power) * 0.35 + 6) {
          addLink(b.x, b.y, c.x, c.y, isPlayer ? "#f5c842" : owner.color, 0.2);
          growCore(owner, Math.min(2, c.power), isPlayer, c.x, c.y, isPlayer ? "세포" : null);
          if (isPlayer) score += 2;
          cells.splice(i, 1);
        } else if (c.power < owner.power && dist < 55) {
          const ang = Math.atan2(b.y - c.y, b.x - c.x);
          c.x += Math.cos(ang) * 70 * dt;
          c.y += Math.sin(ang) * 70 * dt;
        }
      }
    }
  }

  function canAbsorb(eater, prey, dist) {
    return prey < eater && dist < powerRadius(eater) * 0.8;
  }

  function separate(a, b, push) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = Math.hypot(dx, dy) || 0.001;
    a.x += (dx / d) * push;
    a.y += (dy / d) * push;
    b.x -= (dx / d) * push;
    b.y -= (dy / d) * push;
  }

  function tryEatCell(c, i, dt) {
    if (c.mergeLock > 0) c.mergeLock -= dt;
    c.bob += dt * 3;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.x = clamp(c.x, 60, WORLD - 60);
    c.y = clamp(c.y, 60, WORLD - 60);

    let dist = Math.hypot(c.x - player.x, c.y - player.y);

    // Same power: stretch-link then merge
    if (c.power === player.power && player.mergeLock <= 0) {
      if (dist < powerRadius(player.power) * 1.6) {
        const ang = Math.atan2(player.y - c.y, player.x - c.x);
        c.x += Math.cos(ang) * 90 * dt;
        c.y += Math.sin(ang) * 90 * dt;
        dist = Math.hypot(c.x - player.x, c.y - player.y);
        if (dist < 40) addLink(player.x, player.y, c.x, c.y, "rgba(125,255,194,0.5)", 0.08);
      }
      if (mergeWithCell(player, c, true)) {
        cells.splice(i, 1);
        return;
      }
    }

    if (c.power < player.power && dist < powerRadius(player.power) * 1.5 && dist > 2) {
      const ang = Math.atan2(player.y - c.y, player.x - c.x);
      c.x += Math.cos(ang) * 115 * dt;
      c.y += Math.sin(ang) * 115 * dt;
      dist = Math.hypot(c.x - player.x, c.y - player.y);
    }

    if (canAbsorb(player.power, c.power, dist)) {
      growCore(player, c.power, true, c.x, c.y, null);
      cells.splice(i, 1);
    } else if (c.power > player.power && dist < (powerRadius(player.power) + powerRadius(c.power) * 0.4) * 0.9) {
      const ang = Math.atan2(c.y - player.y, c.x - player.x);
      c.x += Math.cos(ang) * 6;
      c.y += Math.sin(ang) * 6;
    }
  }

  function rivalAI(r, dt) {
    if (r.mergeLock > 0) r.mergeLock -= dt;
    if (r.invuln > 0) r.invuln -= dt;
    r.think -= dt;
    if (r.think <= 0 || !r.target) {
      r.think = rand(0.4, 0.9);
      let best = null;
      let bestD = Infinity;
      let mergeT = null;
      let mergeD = Infinity;
      for (const c of cells) {
        const d = Math.hypot(c.x - r.x, c.y - r.y);
        if (c.power === r.power && d < mergeD) { mergeD = d; mergeT = c; }
        if (c.power < r.power && d < bestD) { bestD = d; best = c; }
      }
      if (player && player.power === r.power) {
        const d = Math.hypot(player.x - r.x, player.y - r.y);
        if (d < 280) mergeT = player;
      }
      if (player && r.power > player.power) {
        const d = Math.hypot(player.x - r.x, player.y - r.y);
        if (d < 320 && d < bestD) best = player;
      }
      if (player && player.power > r.power && Math.hypot(player.x - r.x, player.y - r.y) < 200) {
        r.target = { x: r.x + (r.x - player.x), y: r.y + (r.y - player.y), kind: "flee" };
      } else if (mergeT && mergeD < 220) {
        r.target = { x: mergeT.x, y: mergeT.y, kind: "merge", ref: mergeT };
      } else if (best) {
        r.target = { x: best.x, y: best.y, kind: "eat" };
      } else {
        r.target = { x: rand(120, WORLD - 120), y: rand(120, WORLD - 120), kind: "wander" };
      }
    }
    if (r.target) {
      const ang = Math.atan2(r.target.y - r.y, r.target.x - r.x);
      const sp = powerSpeed(r.power, r.buds.length) * 0.7;
      r.vx = Math.cos(ang) * sp;
      r.vy = Math.sin(ang) * sp;
      r.facing = ang;
    }
    r.x = clamp(r.x + r.vx * dt, 50, WORLD - 50);
    r.y = clamp(r.y + r.vy * dt, 50, WORLD - 50);
    r.mouth = (r.mouth + dt * 9) % (Math.PI * 2);

    updateBuds(r, dt);
    budsAbsorb(r, false, dt);

    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      const dist = Math.hypot(c.x - r.x, c.y - r.y);
      if (c.power === r.power && mergeWithCell(r, c, false)) {
        cells.splice(i, 1);
        continue;
      }
      if (canAbsorb(r.power, c.power, dist)) {
        growCore(r, c.power, false, c.x, c.y);
        cells.splice(i, 1);
      }
    }
  }

  function resolvePlayerRival(r, i, dt) {
    const dist = Math.hypot(r.x - player.x, r.y - player.y);
    const sumR = powerRadius(player.power) + powerRadius(r.power);

    // Same power → merge into player colony
    if (mergePlayerRival(r)) {
      rivals.splice(i, 1);
      return "ate";
    }

    if (r.power < player.power && dist < powerRadius(player.power) * 1.35 && dist > sumR * 0.5) {
      const ang = Math.atan2(player.y - r.y, player.x - r.x);
      r.x += Math.cos(ang) * 50 * dt;
      r.y += Math.sin(ang) * 50 * dt;
    }

    const dist2 = Math.hypot(r.x - player.x, r.y - player.y);

    if (player.power > r.power && canAbsorb(player.power, r.power, dist2)) {
      // Eat rival core → gain buds
      player.budBank += 2 + r.buds.length;
      trySpawnBud(player, true);
      growCore(player, Math.min(3, r.power), true, r.x, r.y, "세력");
      score += 12 + r.buds.length * 3;
      burst(r.x, r.y, r.color, 14);
      rivals.splice(i, 1);
      return "ate";
    }

    if (player.invuln <= 0 && r.power > player.power && dist2 < powerRadius(r.power) * 0.7) {
      burst(player.x, player.y, "#ff6b5a", 18);
      endGame("eaten");
      return "dead";
    }

    // Steal smaller buds on contact
    if (dist2 < sumR * 1.1) {
      for (let bi = r.buds.length - 1; bi >= 0; bi--) {
        const b = r.buds[bi];
        if (player.power > r.power && Math.hypot(b.x - player.x, b.y - player.y) < powerRadius(player.power) * 0.9) {
          r.buds.splice(bi, 1);
          player.budBank += 1;
          trySpawnBud(player, true);
          score += 5;
          burst(b.x, b.y, r.color, 6);
        }
      }
      for (let bi = player.buds.length - 1; bi >= 0; bi--) {
        const b = player.buds[bi];
        if (r.power > player.power && Math.hypot(b.x - r.x, b.y - r.y) < powerRadius(r.power) * 0.9) {
          player.buds.splice(bi, 1);
          r.budBank += 1;
          trySpawnBud(r, false);
          burst(b.x, b.y, "#f5c842", 6);
          updateHud();
        }
      }
    }

    if (dist2 < sumR * 0.85 && player.power === r.power) {
      separate(player, r, 5);
    } else if (dist2 < sumR * 0.5) {
      separate(player, r, 3);
    }
    return "ok";
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (player.mergeLock > 0) player.mergeLock -= dt;
    if (player.squash > 0) player.squash -= dt;
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hint.classList.add("fade");
    }

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame("time");
      return;
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
      const sp = powerSpeed(player.power, player.buds.length);
      player.x += (mx / len) * sp * dt;
      player.y += (my / len) * sp * dt;
      player.facing = Math.atan2(my, mx);
      player.mouth = (player.mouth + dt * 12) % (Math.PI * 2);
    } else {
      player.mouth *= 0.88;
    }
    player.x = clamp(player.x, 50, WORLD - 50);
    player.y = clamp(player.y, 50, WORLD - 50);

    updateBuds(player, dt);
    budsAbsorb(player, true, dt);

    for (let i = cells.length - 1; i >= 0; i--) tryEatCell(cells[i], i, dt);

    for (let i = rivals.length - 1; i >= 0; i--) {
      const r = rivals[i];
      if (!r.alive) { rivals.splice(i, 1); continue; }
      rivalAI(r, dt);
      const res = resolvePlayerRival(r, i, dt);
      if (res === "dead") return;
      if (res === "ate") continue;
    }

    // Rival vs rival
    for (let i = 0; i < rivals.length; i++) {
      for (let j = i + 1; j < rivals.length; j++) {
        const a = rivals[i];
        const b = rivals[j];
        if (!a.alive || !b.alive) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const sumR = powerRadius(a.power) + powerRadius(b.power);
        if (d >= sumR * 0.75) continue;
        if (a.power === b.power && a.power < MAX_POWER && a.mergeLock <= 0 && b.mergeLock <= 0) {
          a.power += 1;
          a.mergeLock = 0.35;
          a.budBank += 2 + b.buds.length;
          for (const bud of b.buds) {
            if (a.buds.length >= MAX_BUDS) break;
            a.buds.push(bud);
          }
          trySpawnBud(a, false);
          b.alive = false;
          burst(a.x, a.y, a.color, 12);
        } else if (a.power > b.power && d < powerRadius(a.power) * 0.75) {
          a.budBank += 1 + b.buds.length;
          trySpawnBud(a, false);
          growCore(a, 2, false, b.x, b.y);
          b.alive = false;
        } else if (b.power > a.power && d < powerRadius(b.power) * 0.75) {
          b.budBank += 1 + a.buds.length;
          trySpawnBud(b, false);
          growCore(b, 2, false, a.x, a.y);
          a.alive = false;
        } else {
          separate(a, b, 4);
        }
      }
    }
    rivals = rivals.filter((r) => r.alive);

    spawnAcc += dt;
    if (spawnAcc > 1.0 && cells.length < MAX_CELLS) {
      spawnAcc = 0;
      cells.push(makeCell());
    }
    rivalAcc += dt;
    if (rivalAcc > 5.0 && rivals.length < MAX_RIVALS) {
      rivalAcc = 0;
      rivals.push(makeRival(player.power + Math.floor(rand(0, 2))));
    }

    if (particles.length > 100) particles.splice(0, particles.length - 100);
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
    for (let i = links.length - 1; i >= 0; i--) {
      links[i].life -= dt;
      if (links[i].life <= 0) links.splice(i, 1);
    }
    for (let i = swirls.length - 1; i >= 0; i--) {
      const s = swirls[i];
      s.life -= dt;
      s.a += dt * 9;
      s.r += dt * 35;
      if (s.life <= 0) swirls.splice(i, 1);
    }
    updateHud();
  }

  function worldToScreen(x, y) {
    const z = viewZoom();
    return {
      x: (x - player.x) * z + W / 2,
      y: (y - player.y) * z + H / 2,
    };
  }

  function roundRect(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function drawMembrane(g, ax, ay, bx, by, color, width, alpha) {
    const sa = worldToScreen(ax, ay);
    const sb = worldToScreen(bx, by);
    const z = viewZoom();
    const mx = (sa.x + sb.x) / 2 + Math.sin(time * 3 + ax * 0.01) * 6 * z;
    const my = (sa.y + sb.y) / 2 + Math.cos(time * 2.5 + ay * 0.01) * 6 * z;
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = width * z;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(sa.x, sa.y);
    g.quadraticCurveTo(mx, my, sb.x, sb.y);
    g.stroke();
    g.restore();
  }

  function drawBud(g, b, color) {
    const s = worldToScreen(b.x, b.y);
    const z = viewZoom();
    const r = b.r * z;
    if (s.x < -30 || s.y < -30 || s.x > W + 30 || s.y > H + 30) return;
    g.save();
    g.translate(s.x, s.y);
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.beginPath();
    g.ellipse(1, r * 0.55, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    const grd = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grd.addColorStop(0, "rgba(255,255,255,0.75)");
    grd.addColorStop(0.4, color);
    grd.addColorStop(1, "rgba(20,30,45,0.55)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.beginPath();
    g.ellipse(-r * 0.25, -r * 0.28, r * 0.28, r * 0.16, -0.4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawColony(g, owner, isPlayer) {
    const coreColor = isPlayer ? "#f5c842" : owner.color;
    const budCol = isPlayer ? "rgba(245,200,66,0.75)" : owner.budColor;
    for (const b of owner.buds) {
      drawMembrane(g, owner.x, owner.y, b.x, b.y, budCol, 5 + b.r * 0.3, 0.45);
    }
    for (const b of owner.buds) drawBud(g, b, budCol);
    drawPacCore(g, owner, isPlayer, coreColor);
  }

  function drawPacCore(g, owner, isPlayer, color) {
    const s = worldToScreen(owner.x, owner.y);
    const z = viewZoom();
    let rad = powerRadius(owner.power) * z;
    if (owner.squash > 0) rad *= 1 + owner.squash * 0.25;
    if (s.x < -60 || s.y < -60 || s.x > W + 60 || s.y > H + 60) return;

    g.save();
    g.translate(s.x, s.y);

    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath();
    g.ellipse(2, rad * 0.55, rad * 0.75, rad * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    if (isPlayer) {
      for (let i = 0; i < 3; i++) {
        const rr = rad + 7 + i * 6 + Math.sin(time * 4 + i) * 2;
        g.strokeStyle = `rgba(80,200,255,${0.26 - i * 0.06})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, rr, time * 2.8 + i, time * 2.8 + i + Math.PI * 1.15);
        g.stroke();
      }
    }

    const mouth = (0.14 + Math.abs(Math.sin(owner.mouth || 0)) * 0.3) * Math.PI;
    g.rotate(owner.facing || 0);

    const grd = g.createRadialGradient(-rad * 0.25, -rad * 0.3, rad * 0.1, 0, 0, rad);
    if (isPlayer) {
      grd.addColorStop(0, "#fff3b0");
      grd.addColorStop(0.45, "#f5c842");
      grd.addColorStop(1, "#d4891a");
      g.shadowColor = "rgba(245,200,66,0.5)";
      g.shadowBlur = 14;
    } else {
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(0.35, color);
      grd.addColorStop(1, "#1a2030");
      g.shadowColor = color;
      g.shadowBlur = 8;
    }

    g.fillStyle = grd;
    g.beginPath();
    if (mouth > 0.05) {
      g.arc(0, 0, rad, mouth * 0.5, Math.PI * 2 - mouth * 0.5);
      g.lineTo(0, 0);
    } else {
      g.arc(0, 0, rad, 0, Math.PI * 2);
    }
    g.closePath();
    g.fill();
    g.shadowBlur = 0;

    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.ellipse(-rad * 0.28, -rad * 0.32, rad * 0.3, rad * 0.17, -0.5, 0, Math.PI * 2);
    g.fill();

    const eyeX = rad * 0.22;
    const eyeY = -rad * 0.28;
    g.fillStyle = "#1a1e28";
    g.beginPath();
    g.arc(eyeX, eyeY, rad * 0.17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(eyeX - rad * 0.04, eyeY - rad * 0.05, rad * 0.055, 0, Math.PI * 2);
    g.fill();

    g.rotate(-(owner.facing || 0));

    const fs = Math.max(12, Math.min(28, rad * 0.95));
    g.font = `700 ${fs}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (isPlayer) {
      g.lineWidth = Math.max(2, fs * 0.12);
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.fillStyle = "#f5c842";
      g.strokeText(String(owner.power), rad * 0.05, rad * 0.12);
      g.fillText(String(owner.power), rad * 0.05, rad * 0.12);
    } else {
      g.fillStyle = "#152028";
      g.fillText(String(owner.power), 0, 2);
    }
    g.restore();
  }

  function drawCell(g, c) {
    const s = worldToScreen(c.x, c.y);
    const z = viewZoom();
    const rad = powerRadius(c.power) * 0.4 * z;
    const bob = Math.sin(c.bob) * 2.5;
    if (s.x < -40 || s.y < -40 || s.x > W + 40 || s.y > H + 40) return;
    const can = player && c.power < player.power;
    const same = player && c.power === player.power;
    const col = cellColor(c.power);

    g.save();
    g.translate(s.x, s.y + bob);
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.beginPath();
    g.ellipse(1, rad * 0.55, rad * 0.65, rad * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    if (same) {
      g.shadowColor = "#7dffc2";
      g.shadowBlur = 14;
    } else if (can) {
      g.shadowColor = col;
      g.shadowBlur = 10;
    }

    const grd = g.createRadialGradient(-rad * 0.3, -rad * 0.35, rad * 0.1, 0, 0, rad);
    grd.addColorStop(0, same ? "#e8fff4" : can ? "#fff6e8" : "#9aa8b4");
    grd.addColorStop(0.4, same ? "#7dffc2" : col);
    grd.addColorStop(1, "#1a222c");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, rad, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;

    g.fillStyle = "rgba(255,255,255,0.45)";
    g.beginPath();
    g.ellipse(-rad * 0.28, -rad * 0.32, rad * 0.28, rad * 0.16, -0.5, 0, Math.PI * 2);
    g.fill();

    if (same) {
      g.strokeStyle = "rgba(125,255,194,0.8)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, rad + 3 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2);
      g.stroke();
    }

    g.fillStyle = "#1a2030";
    g.font = `700 ${Math.max(10, rad * 1.05)}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(c.power), 0, 1);
    g.restore();
  }

  function drawMinimap(g) {
    const mw = 70;
    const mh = 70;
    const mx = W - mw - 12;
    const my = H - mh - 56;
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = "rgba(8,16,28,0.82)";
    g.strokeStyle = "rgba(100,180,230,0.3)";
    g.lineWidth = 1.5;
    roundRect(g, mx, my, mw, mh, 10);
    g.fill();
    g.stroke();
    const sx = mw / WORLD;
    const sy = mh / WORLD;
    for (const r of rivals) {
      g.fillStyle = r.color;
      g.beginPath();
      g.arc(mx + r.x * sx, my + r.y * sy, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    if (player) {
      g.fillStyle = "#f5c842";
      g.beginPath();
      g.arc(mx + player.x * sx, my + player.y * sy, 3.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function draw(g) {
    if (!player) return;
    g.save();
    if (shake > 0) g.translate(rand(-2, 2) * shake * 5, rand(-2, 2) * shake * 5);

    const bg = g.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.5, H * 0.9);
    bg.addColorStop(0, "#1a3a5c");
    bg.addColorStop(0.5, "#0f2438");
    bg.addColorStop(1, "#070e18");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Soft grid
    const z = viewZoom();
    const step = 80;
    g.strokeStyle = "rgba(100,160,220,0.05)";
    g.lineWidth = 1;
    const x0 = Math.floor((player.x - W / z) / step) * step;
    const y0 = Math.floor((player.y - H / z) / step) * step;
    for (let x = x0; x < player.x + W / z + step; x += step) {
      const sx = worldToScreen(x, player.y).x;
      g.beginPath();
      g.moveTo(sx, 0);
      g.lineTo(sx, H);
      g.stroke();
    }
    for (let y = y0; y < player.y + H / z + step; y += step) {
      const sy = worldToScreen(player.x, y).y;
      g.beginPath();
      g.moveTo(0, sy);
      g.lineTo(W, sy);
      g.stroke();
    }

    for (const c of cells) drawCell(g, c);

    for (const lk of links) {
      const a = Math.max(0, lk.life / lk.max);
      drawMembrane(g, lk.ax, lk.ay, lk.bx, lk.by, lk.color, 6, a * 0.7);
    }

    for (const sw of swirls) {
      const p = worldToScreen(sw.x, sw.y);
      g.strokeStyle = `rgba(100,210,255,${Math.max(0, sw.life)})`;
      g.lineWidth = sw.w;
      g.beginPath();
      g.arc(p.x, p.y, sw.r * z, sw.a, sw.a + 1.8);
      g.stroke();
    }

    for (const r of rivals) drawColony(g, r, false);

    const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    if (!blink) drawColony(g, player, true);

    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      g.globalAlpha = Math.max(0, p.life * 2.2);
      if (p.glow) { g.shadowColor = p.color; g.shadowBlur = 8; }
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(s.x, s.y, p.r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;

    for (const f of floats) {
      const s = worldToScreen(f.x, f.y);
      g.globalAlpha = Math.min(1, f.life * 1.5);
      g.fillStyle = f.color;
      g.font = '700 15px "Bagel Fat One","Jua"';
      g.textAlign = "center";
      g.fillText(f.text, s.x, s.y);
    }
    g.globalAlpha = 1;

    drawMinimap(g);

    if (stick.active) {
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.beginPath();
      g.arc(stick.ox, stick.oy, 36, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(120,200,255,0.35)";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "rgba(245,200,66,0.55)";
      g.beginPath();
      g.arc(stick.ox + clamp(stick.dx, -24, 24), stick.oy + clamp(stick.dy, -24, 24), 14, 0, Math.PI * 2);
      g.fill();
    }

    if (flash > 0) {
      g.fillStyle = `rgba(125,255,194,${flash * 0.28})`;
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
      console.error("[number-hole]", err);
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
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") keys.left = false;
    if (ev.code === "ArrowRight" || ev.code === "KeyD") keys.right = false;
    if (ev.code === "ArrowUp" || ev.code === "KeyW") keys.up = false;
    if (ev.code === "ArrowDown" || ev.code === "KeyS") keys.down = false;
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "넘버 홀", formParent: overlays.title });
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

  // Title idle: show colony vibe
  player = {
    x: WORLD / 2, y: WORLD / 2, power: 5, mass: 0, budBank: 0,
    buds: [], mouth: 0, facing: 0, invuln: 0, mergeLock: 0, squash: 0,
  };
  for (let i = 0; i < 4; i++) player.buds.push(makeBud(player, (Math.PI * 2 * i) / 4));
  cells = [makeCell(3), makeCell(5), makeCell(5), makeCell(2), makeCell(4), makeCell(1)];
  cells[1].x = WORLD / 2 + 100; cells[1].y = WORLD / 2;
  cells[2].x = WORLD / 2 + 130; cells[2].y = WORLD / 2 + 50;
  rivals.push(makeRival(4));
  last = performance.now();
  raf = requestAnimationFrame(function idle(now) {
    if (state !== "title") return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    player.facing = Math.sin(time * 0.55) * 0.35;
    player.mouth = time * 8;
    player.x = WORLD / 2 + Math.cos(time * 0.35) * 35;
    player.y = WORLD / 2 + Math.sin(time * 0.3) * 25;
    updateBuds(player, dt);
    for (const c of cells) {
      c.bob += dt * 3;
      if (c.power === player.power) {
        const ang = Math.atan2(player.y - c.y, player.x - c.x);
        c.x += Math.cos(ang) * 18 * dt;
        c.y += Math.sin(ang) * 18 * dt;
      }
    }
    draw(ctx);
    raf = requestAnimationFrame(idle);
  });
})();
