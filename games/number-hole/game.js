(() => {
  "use strict";

  const GAME_ID = "number-hole";
  const W = 390;
  const H = 700;
  const WORLD = 2800;
  const ROUND_TIME = 75;
  const START_POWER = 2;
  const MAX_POWER = 20;
  const MAX_COMBO = 8;
  const MAX_FOOD = 16;
  const MAX_RIVALS = 6;

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
  let foods = [];
  let rivals = [];
  let props = [];
  let particles = [];
  let floats = [];
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

  const RIVAL_COLORS = ["#ff6b5c", "#4eb6e8", "#5fd4a0", "#f0a04b", "#d48ad0"];
  const FOOD_COLORS = {
    1: "#ff7aa2",
    2: "#ff9a4a",
    3: "#4ecdc4",
    4: "#7aa2ff",
    5: "#c084fc",
  };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function foodColor(p) {
    return FOOD_COLORS[Math.min(5, Math.max(1, p))] || "#7aa2ff";
  }

  /** Soft-capped size — grows with number, never fills screen */
  function powerRadius(p) {
    const n = clamp(p, 1, MAX_POWER);
    return 15 + Math.log2(1 + n) * 5.4;
  }

  function powerSpeed(p) {
    return Math.max(140, 235 - Math.log2(1 + p) * 11);
  }

  function viewZoom() {
    if (!player) return 1;
    return clamp(1 - (player.power - START_POWER) * 0.018, 0.62, 1);
  }

  /** Mass needed for +1 number — keeps growth visible but not runaway */
  function massNeeded(power) {
    return 2 + Math.floor(power * 0.85);
  }

  function updateHud() {
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-power").textContent = player ? String(player.power) : String(START_POWER);
    document.getElementById("hud-combo").textContent = String(combo);
    document.getElementById("hud-time").textContent = String(Math.max(0, Math.ceil(timeLeft)));
    const fill = document.getElementById("xp-fill");
    if (fill && player) {
      if (player.power >= MAX_POWER) fill.style.width = "100%";
      else fill.style.width = `${Math.min(100, (player.mass / massNeeded(player.power)) * 100)}%`;
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.8, vy: -44 });
  }

  function burst(x, y, color, n = 8) {
    const count = Math.min(n, 16);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 160);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.22, 0.5), r: rand(1.5, 4), color, glow: Math.random() < 0.4,
      });
    }
  }

  function spawnSwirl(x, y) {
    for (let i = 0; i < 3; i++) {
      swirls.push({
        x, y,
        a: rand(0, Math.PI * 2),
        r: rand(18, 42),
        life: rand(0.35, 0.7),
        w: rand(2, 4),
      });
    }
  }

  /** ~35% smaller / 30% equal / 35% larger — not everything is edible */
  function rollFoodPower(base) {
    const roll = Math.random();
    if (roll < 0.35) {
      if (base <= 2) return 1;
      return Math.max(1, base - 1 - Math.floor(Math.random() * 2));
    }
    if (roll < 0.65) return base;
    return Math.min(MAX_POWER, base + 1 + Math.floor(Math.random() * 2));
  }

  function makeFood(forced) {
    const base = player ? player.power : START_POWER;
    const p = forced == null ? rollFoodPower(base) : forced;
    return {
      x: rand(100, WORLD - 100),
      y: rand(100, WORLD - 100),
      power: Math.max(1, p),
      bob: rand(0, Math.PI * 2),
      kind: Math.random() < 0.05 ? "star" : "orb",
    };
  }

  function makeRival(forced) {
    const base = player ? player.power : START_POWER;
    const p = clamp(
      forced ?? Math.round(rand(base, base + 3)),
      1,
      MAX_POWER
    );
    let x;
    let y;
    do {
      x = rand(160, WORLD - 160);
      y = rand(160, WORLD - 160);
    } while (player && Math.hypot(x - player.x, y - player.y) < 420);
    return {
      x, y, power: p, mass: 0, vx: 0, vy: 0,
      color: RIVAL_COLORS[Math.floor(Math.random() * RIVAL_COLORS.length)],
      think: rand(0.3, 0.8), target: null, mouth: 0, facing: 0, alive: true,
    };
  }

  function buildProps() {
    props = [];
    const kinds = [
      { kind: "building", w: 48, h: 70, label: "빌딩", val: 3, hue: 265 },
      { kind: "building", w: 40, h: 56, label: "상점", val: 2, hue: 25 },
      { kind: "car", w: 36, h: 22, label: "차", val: 1, hue: 0 },
      { kind: "tree", w: 32, h: 40, label: "나무", val: 1, hue: 130 },
      { kind: "lamp", w: 18, h: 48, label: "등", val: 2, hue: 45 },
      { kind: "bus", w: 54, h: 30, label: "버스", val: 3, hue: 200 },
      { kind: "box", w: 26, h: 26, label: "박스", val: 1, hue: 35 },
    ];
    for (let i = 0; i < 28; i++) {
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      const val = k.val + (Math.random() < 0.25 ? 1 : 0);
      props.push({
        x: rand(140, WORLD - 140),
        y: rand(140, WORLD - 140),
        w: k.w, h: k.h, label: k.label, val: Math.min(6, val),
        kind: k.kind, hue: k.hue, eaten: false,
      });
    }
  }

  function resetWorld() {
    score = 0;
    combo = 0;
    comboTimer = 0;
    maxCombo = 0;
    timeLeft = ROUND_TIME;
    shake = 0;
    flash = 0;
    foods = [];
    rivals = [];
    particles = [];
    floats = [];
    swirls = [];
    player = {
      x: WORLD / 2, y: WORLD / 2,
      power: START_POWER, mass: 0,
      mouth: 0, facing: 0, invuln: 1.5,
    };
    buildProps();
    // Seed: mix of edible and dangerous
    for (let i = 0; i < 14; i++) foods.push(makeFood());
    rivals.push(makeRival(2), makeRival(3), makeRival(4), makeRival(5));
    hintTimer = 3.2;
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
    document.getElementById("over-detail").textContent =
      `점수 ${score.toLocaleString()} · 숫자 ${player ? player.power : 0} · 최고콤보 ${maxCombo}`;
    overlays.over.classList.remove("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "넘버 홀", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  /** Absorb → number grows (mass → +1 power). Visible growth, soft-capped. */
  function growPlayer(bite, x, y, label) {
    const massGain = bite <= 1 ? 1 : bite === 2 ? 2 : Math.min(4, bite);
    player.mass += massGain;
    let leveled = 0;
    while (player.power < MAX_POWER && player.mass >= massNeeded(player.power)) {
      player.mass -= massNeeded(player.power);
      player.power += 1;
      leveled += 1;
    }
    if (player.power >= MAX_POWER) player.mass = 0;

    const points = 3 + Math.floor(Math.min(combo, MAX_COMBO) * 0.7) + leveled * 6;
    score += points;
    combo = Math.min(MAX_COMBO, combo + 1);
    maxCombo = Math.max(maxCombo, combo);
    comboTimer = 1.2;

    burst(x, y, "#f5c842", 6 + Math.min(5, bite));
    spawnSwirl(player.x, player.y);
    if (leveled) {
      addFloat(x, y - 10, `${player.power}!`, "#ffe27a");
      flash = 0.12;
      shake = 0.22;
    } else {
      addFloat(x, y - 8, label || `+${points}`, "#f0c44a");
      flash = 0.04;
      shake = 0.06;
    }
    if (combo >= 4 && combo % 2 === 0) addFloat(x, y - 26, `${combo} HIT`, "#ff7a68");
    updateHud();
  }

  function bodiesOverlap(ax, ay, ap, bx, by, bp, scale = 0.92) {
    return Math.hypot(ax - bx, ay - by) < (powerRadius(ap) + powerRadius(bp)) * scale;
  }

  function canAbsorb(eater, prey, dist) {
    return prey < eater && dist < powerRadius(eater) * 0.82;
  }

  function separate(a, b, push) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const nx = dx / d;
    const ny = dy / d;
    a.x += nx * push;
    a.y += ny * push;
    b.x -= nx * push;
    b.y -= ny * push;
  }

  function tryEatFood(f, i, dt) {
    let dist = Math.hypot(f.x - player.x, f.y - player.y);
    if (f.power < player.power && dist < powerRadius(player.power) * 1.55 && dist > 2) {
      const ang = Math.atan2(player.y - f.y, player.x - f.x);
      f.x += Math.cos(ang) * 120 * dt;
      f.y += Math.sin(ang) * 120 * dt;
      dist = Math.hypot(f.x - player.x, f.y - player.y);
    }
    if (canAbsorb(player.power, f.power, dist)) {
      growPlayer(f.power, f.x, f.y, f.kind === "star" ? "★" : null);
      if (f.kind === "star") {
        player.mass += 1;
        score += 4;
      }
      foods.splice(i, 1);
    } else if (f.power >= player.power && dist < (powerRadius(player.power) + powerRadius(f.power) * 0.45) * 0.85) {
      const ang = Math.atan2(f.y - player.y, f.x - player.x);
      f.x += Math.cos(ang) * 8;
      f.y += Math.sin(ang) * 8;
    }
  }

  function tryEatProp(p) {
    if (p.eaten) return;
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    const reach = powerRadius(player.power) * 0.75 + Math.max(p.w, p.h) * 0.2;
    if (p.val < player.power && dist < reach) {
      p.eaten = true;
      growPlayer(1, p.x, p.y, p.label);
      burst(p.x, p.y, `hsl(${p.hue},55%,55%)`, 8);
    }
  }

  function rivalGrow(r, amount) {
    r.mass += amount;
    const need = massNeeded(r.power);
    if (r.power < MAX_POWER && r.mass >= need) {
      r.mass = 0;
      r.power += 1;
    }
  }

  function rivalAI(r, dt) {
    r.think -= dt;
    if (r.think <= 0 || !r.target) {
      r.think = rand(0.4, 0.9);
      let best = null;
      let bestD = Infinity;
      for (const f of foods) {
        if (f.power >= r.power) continue;
        const d = Math.hypot(f.x - r.x, f.y - r.y);
        if (d < bestD) { bestD = d; best = f; }
      }
      // Hunt player only if clearly stronger
      if (player && r.power > player.power + 0) {
        const d = Math.hypot(player.x - r.x, player.y - r.y);
        if (d < 340 && d < bestD) best = player;
      }
      // Flee if player is bigger
      if (player && player.power > r.power && Math.hypot(player.x - r.x, player.y - r.y) < 180) {
        r.target = { x: r.x + (r.x - player.x) * 1.2, y: r.y + (r.y - player.y) * 1.2 };
      } else if (best) {
        r.target = { x: best.x, y: best.y };
      } else {
        r.target = { x: rand(120, WORLD - 120), y: rand(120, WORLD - 120) };
      }
    }
    if (r.target) {
      const ang = Math.atan2(r.target.y - r.y, r.target.x - r.x);
      const sp = powerSpeed(r.power) * 0.72;
      r.vx = Math.cos(ang) * sp;
      r.vy = Math.sin(ang) * sp;
      r.facing = ang;
    }
    r.x = clamp(r.x + r.vx * dt, 50, WORLD - 50);
    r.y = clamp(r.y + r.vy * dt, 50, WORLD - 50);
    r.mouth = (r.mouth + dt * 9) % (Math.PI * 2);

    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (canAbsorb(r.power, f.power, Math.hypot(f.x - r.x, f.y - r.y))) {
        rivalGrow(r, f.power <= 1 ? 1 : 2);
        foods.splice(i, 1);
      }
    }
    for (const p of props) {
      if (!p.eaten && p.val < r.power && Math.hypot(p.x - r.x, p.y - r.y) < powerRadius(r.power) * 0.7) {
        p.eaten = true;
        rivalGrow(r, 1);
      }
    }
  }

  function resolvePlayerRival(r, i, dt) {
    const dist = Math.hypot(r.x - player.x, r.y - player.y);
    const sumR = powerRadius(player.power) + powerRadius(r.power);

    // Mild suction only for clearly smaller rivals
    if (r.power < player.power && dist < powerRadius(player.power) * 1.35 && dist > sumR * 0.55) {
      const ang = Math.atan2(player.y - r.y, player.x - r.x);
      r.x += Math.cos(ang) * 55 * dt;
      r.y += Math.sin(ang) * 55 * dt;
    }

    const dist2 = Math.hypot(r.x - player.x, r.y - player.y);

    if (player.power > r.power && canAbsorb(player.power, r.power, dist2)) {
      growPlayer(Math.min(3, r.power), r.x, r.y, "라이벌");
      score += 10;
      burst(r.x, r.y, r.color, 14);
      rivals.splice(i, 1);
      return "ate";
    }

    if (player.invuln <= 0 && r.power > player.power && dist2 < powerRadius(r.power) * 0.72) {
      burst(player.x, player.y, "#ff6b5a", 18);
      endGame("eaten");
      return "dead";
    }

    // Equal (or almost overlapping) → bounce apart cleanly
    if (r.power === player.power && dist2 < sumR * 0.88) {
      separate(player, r, 6);
      player.x = clamp(player.x, 50, WORLD - 50);
      player.y = clamp(player.y, 50, WORLD - 50);
      r.x = clamp(r.x, 50, WORLD - 50);
      r.y = clamp(r.y, 50, WORLD - 50);
    } else if (dist2 < sumR * 0.55 && player.power !== r.power) {
      // Soft body push so they don't clip through each other
      separate(player, r, 3);
    }
    return "ok";
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
    if (player.invuln > 0) player.invuln -= dt;
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
      const sp = powerSpeed(player.power);
      player.x += (mx / len) * sp * dt;
      player.y += (my / len) * sp * dt;
      player.facing = Math.atan2(my, mx);
      player.mouth = (player.mouth + dt * 12) % (Math.PI * 2);
    } else {
      player.mouth *= 0.88;
    }
    player.x = clamp(player.x, 50, WORLD - 50);
    player.y = clamp(player.y, 50, WORLD - 50);

    for (const f of foods) f.bob += dt * 3.2;
    for (let i = foods.length - 1; i >= 0; i--) tryEatFood(foods[i], i, dt);
    for (const p of props) tryEatProp(p);

    for (let i = rivals.length - 1; i >= 0; i--) {
      const r = rivals[i];
      if (!r.alive) { rivals.splice(i, 1); continue; }
      rivalAI(r, dt);
      const res = resolvePlayerRival(r, i, dt);
      if (res === "dead") return;
      if (res === "ate") continue;
    }

    // Rival vs rival: bigger eats smaller; equals push apart
    for (let i = 0; i < rivals.length; i++) {
      for (let j = i + 1; j < rivals.length; j++) {
        const a = rivals[i];
        const b = rivals[j];
        if (!a.alive || !b.alive) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const sumR = powerRadius(a.power) + powerRadius(b.power);
        if (d >= sumR * 0.7) continue;
        if (a.power > b.power && d < powerRadius(a.power) * 0.75) {
          rivalGrow(a, 2);
          b.alive = false;
        } else if (b.power > a.power && d < powerRadius(b.power) * 0.75) {
          rivalGrow(b, 2);
          a.alive = false;
        } else if (a.power === b.power) {
          separate(a, b, 5);
        }
      }
    }
    rivals = rivals.filter((r) => r.alive);

    spawnAcc += dt;
    if (spawnAcc > 1.1 && foods.length < MAX_FOOD) {
      spawnAcc = 0;
      foods.push(makeFood());
    }
    rivalAcc += dt;
    if (rivalAcc > 4.5 && rivals.length < MAX_RIVALS) {
      rivalAcc = 0;
      rivals.push(makeRival(player.power + Math.floor(rand(0, 3))));
    }

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
    for (let i = swirls.length - 1; i >= 0; i--) {
      const s = swirls[i];
      s.life -= dt;
      s.a += dt * 8;
      s.r += dt * 30;
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

  function drawGrid(g) {
    const z = viewZoom();
    const step = 80;
    g.strokeStyle = "rgba(100,160,220,0.06)";
    g.lineWidth = 1;
    const x0 = Math.floor((player.x - W / z) / step) * step;
    const y0 = Math.floor((player.y - H / z) / step) * step;
    for (let x = x0; x < player.x + W / z + step; x += step) {
      const s = worldToScreen(x, player.y).x;
      g.beginPath();
      g.moveTo(s, 0);
      g.lineTo(s, H);
      g.stroke();
    }
    for (let y = y0; y < player.y + H / z + step; y += step) {
      const s = worldToScreen(player.x, y).y;
      g.beginPath();
      g.moveTo(0, s);
      g.lineTo(W, s);
      g.stroke();
    }
  }

  function drawProp(g, p) {
    if (p.eaten) return;
    const s = worldToScreen(p.x, p.y);
    const z = viewZoom();
    if (s.x < -80 || s.y < -80 || s.x > W + 80 || s.y > H + 80) return;
    g.save();
    g.translate(s.x, s.y);
    const can = player && p.val < player.power;
    const w = p.w * z;
    const h = p.h * z;

    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(0, h * 0.42, w * 0.45, h * 0.12, 0, 0, Math.PI * 2);
    g.fill();

    if (p.kind === "car" || p.kind === "bus") {
      const body = can ? "#e84545" : "#5a3a42";
      roundRect(g, -w / 2, -h / 2, w, h * 0.7, 5 * z);
      g.fillStyle = body;
      g.fill();
      g.fillStyle = can ? "#7ad7ff" : "#3a4a55";
      roundRect(g, -w * 0.28, -h * 0.42, w * 0.56, h * 0.28, 3 * z);
      g.fill();
      g.fillStyle = "#1a1a1a";
      g.beginPath();
      g.arc(-w * 0.28, h * 0.22, 4 * z, 0, Math.PI * 2);
      g.arc(w * 0.28, h * 0.22, 4 * z, 0, Math.PI * 2);
      g.fill();
      if (p.kind === "bus") {
        g.fillStyle = "rgba(255,255,255,0.35)";
        for (let i = -1; i <= 1; i++) {
          roundRect(g, i * w * 0.22 - 4 * z, -h * 0.35, 8 * z, 8 * z, 2 * z);
          g.fill();
        }
      }
    } else if (p.kind === "tree") {
      g.fillStyle = can ? "#8b5a2b" : "#3d2e22";
      roundRect(g, -w * 0.12, h * 0.05, w * 0.24, h * 0.4, 2 * z);
      g.fill();
      g.fillStyle = can ? "#3ecf6a" : "#2a5a3a";
      roundRect(g, -w / 2, -h / 2, w, h * 0.55, 6 * z);
      g.fill();
      g.fillStyle = can ? "#2a9e4a" : "#1e4030";
      roundRect(g, -w * 0.35, -h * 0.25, w * 0.7, h * 0.35, 5 * z);
      g.fill();
    } else if (p.kind === "lamp") {
      g.fillStyle = can ? "#6a7380" : "#3a4048";
      roundRect(g, -2 * z, -h * 0.35, 4 * z, h * 0.7, 2 * z);
      g.fill();
      g.fillStyle = can ? "#ffe27a" : "#6a6040";
      g.shadowColor = can ? "rgba(255,220,100,0.7)" : "transparent";
      g.shadowBlur = can ? 12 : 0;
      g.beginPath();
      g.arc(0, -h * 0.38, 7 * z, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    } else if (p.kind === "building") {
      const c1 = can ? `hsl(${p.hue},48%,48%)` : `hsl(${p.hue},18%,28%)`;
      const c2 = can ? `hsl(${p.hue},42%,38%)` : `hsl(${p.hue},14%,22%)`;
      const grad = g.createLinearGradient(-w / 2, 0, w / 2, 0);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      g.fillStyle = grad;
      roundRect(g, -w / 2, -h / 2, w, h, 6 * z);
      g.fill();
      g.fillStyle = can ? "rgba(255,230,140,0.55)" : "rgba(80,90,100,0.35)";
      const cols = 2;
      const rows = 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = -w * 0.28 + c * w * 0.32;
          const wy = -h * 0.32 + r * h * 0.22;
          roundRect(g, wx, wy, w * 0.18, h * 0.12, 2 * z);
          g.fill();
        }
      }
    } else {
      g.fillStyle = can ? `hsl(${p.hue},50%,48%)` : `hsl(${p.hue},15%,30%)`;
      roundRect(g, -w / 2, -h / 2, w, h, 5 * z);
      g.fill();
    }

    // Number badge
    const br = Math.max(9, 11 * z);
    g.fillStyle = can ? "rgba(20,28,40,0.85)" : "rgba(10,14,20,0.7)";
    g.beginPath();
    g.arc(0, 0, br, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = can ? "#f0c44a" : "rgba(255,255,255,0.15)";
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = can ? "#ffe27a" : "#8a9aaa";
    g.font = `700 ${Math.max(10, 12 * z)}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(p.val), 0, 1);
    g.restore();
  }

  function drawNumberOrb(g, x, y, power, bob) {
    const s = worldToScreen(x, y);
    const z = viewZoom();
    const rad = powerRadius(power) * 0.4 * z;
    if (s.x < -40 || s.y < -40 || s.x > W + 40 || s.y > H + 40) return;
    const can = player && power < player.power;
    const col = foodColor(power);

    g.save();
    g.translate(s.x, s.y + bob);

    g.fillStyle = "rgba(0,0,0,0.2)";
    g.beginPath();
    g.ellipse(1, rad * 0.55, rad * 0.65, rad * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    if (can) {
      g.shadowColor = col;
      g.shadowBlur = 10;
    }
    const grd = g.createRadialGradient(-rad * 0.3, -rad * 0.35, rad * 0.1, 0, 0, rad);
    grd.addColorStop(0, can ? "#fff6e8" : "#9aa8b4");
    grd.addColorStop(0.35, col);
    grd.addColorStop(1, can ? "#2a3040" : "#1a222c");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, rad, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;

    g.fillStyle = "rgba(255,255,255,0.45)";
    g.beginPath();
    g.ellipse(-rad * 0.28, -rad * 0.32, rad * 0.28, rad * 0.16, -0.5, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = can ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, rad, 0, Math.PI * 2);
    g.stroke();

    g.fillStyle = "#1a2030";
    g.font = `700 ${Math.max(10, rad * 1.05)}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(power), 0, 1);
    g.restore();
  }

  function drawPacOrb(g, x, y, power, color, mouthPhase, facing, isPlayer) {
    const s = worldToScreen(x, y);
    const z = viewZoom();
    const rad = powerRadius(power) * z;
    if (s.x < -60 || s.y < -60 || s.x > W + 60 || s.y > H + 60) return;

    g.save();
    g.translate(s.x, s.y);

    // Shadow
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath();
    g.ellipse(2, rad * 0.55, rad * 0.75, rad * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    // Vortex ring (player)
    if (isPlayer) {
      for (let i = 0; i < 3; i++) {
        const rr = rad + 8 + i * 7 + Math.sin(time * 4 + i) * 2;
        g.strokeStyle = `rgba(80,200,255,${0.28 - i * 0.07})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, rr, time * 3 + i, time * 3 + i + Math.PI * 1.2);
        g.stroke();
      }
    }

    const mouth = (0.14 + Math.abs(Math.sin(mouthPhase || 0)) * 0.32) * Math.PI;
    g.rotate(facing || 0);

    // Body gradient
    const grd = g.createRadialGradient(-rad * 0.25, -rad * 0.3, rad * 0.1, 0, 0, rad);
    if (isPlayer) {
      grd.addColorStop(0, "#fff3b0");
      grd.addColorStop(0.45, "#f5c842");
      grd.addColorStop(1, "#d4891a");
      g.shadowColor = "rgba(245,200,66,0.55)";
      g.shadowBlur = 16;
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

    // Gloss
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.ellipse(-rad * 0.28, -rad * 0.32, rad * 0.32, rad * 0.18, -0.5, 0, Math.PI * 2);
    g.fill();

    // Single glossy eye (thumbnail style)
    const eyeX = rad * 0.22;
    const eyeY = -rad * 0.28;
    g.fillStyle = "#1a1e28";
    g.beginPath();
    g.arc(eyeX, eyeY, rad * 0.18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(eyeX - rad * 0.04, eyeY - rad * 0.05, rad * 0.06, 0, Math.PI * 2);
    g.fill();

    g.rotate(-(facing || 0));

    // Big side number like thumbnail
    const fs = Math.max(12, Math.min(28, rad * 0.95));
    g.font = `700 ${fs}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = Math.max(2, fs * 0.12);
    g.strokeStyle = isPlayer ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.35)";
    g.fillStyle = isPlayer ? "#f5c842" : "#152028";
    if (isPlayer) {
      g.strokeText(String(power), rad * 0.05, rad * 0.12);
      g.fillText(String(power), rad * 0.05, rad * 0.12);
    } else {
      g.fillStyle = "#152028";
      g.fillText(String(power), 0, 2);
    }
    g.restore();
  }

  function drawVortexFX(g) {
    if (!player) return;
    const s = worldToScreen(player.x, player.y);
    const z = viewZoom();
    const rad = powerRadius(player.power) * z;
    g.save();
    g.translate(s.x, s.y);
    for (let i = 0; i < 10; i++) {
      const a = time * 2.2 + i * 0.63;
      const rr = rad + 14 + (i % 4) * 9;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr * 0.7;
      g.fillStyle = `rgba(120,210,255,${0.15 + (i % 3) * 0.05})`;
      g.fillRect(px - 2, py - 2, 4, 4);
    }
    g.restore();

    for (const sw of swirls) {
      const p = worldToScreen(sw.x, sw.y);
      g.strokeStyle = `rgba(100,210,255,${Math.max(0, sw.life)})`;
      g.lineWidth = sw.w;
      g.beginPath();
      g.arc(p.x, p.y, sw.r * z, sw.a, sw.a + 1.8);
      g.stroke();
    }
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

    const bg = g.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.5, H * 0.85);
    bg.addColorStop(0, "#1a3a5c");
    bg.addColorStop(0.45, "#0f2438");
    bg.addColorStop(1, "#070e18");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Soft vignette glow
    g.fillStyle = "rgba(40,120,180,0.06)";
    g.beginPath();
    g.arc(W / 2, H / 2, 180, 0, Math.PI * 2);
    g.fill();

    drawGrid(g);

    // Depth sort props roughly by y
    const sortedProps = props.slice().sort((a, b) => a.y - b.y);
    for (const p of sortedProps) drawProp(g, p);

    for (const f of foods) {
      if (f.kind === "star") {
        const s = worldToScreen(f.x, f.y);
        const z = viewZoom();
        const rad = powerRadius(f.power) * 0.42 * z;
        const bob = Math.sin(f.bob) * 2;
        g.save();
        g.translate(s.x, s.y + bob);
        g.shadowColor = "#f5c842";
        g.shadowBlur = 12;
        g.fillStyle = "#f5c842";
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          g.lineTo(Math.cos(a) * rad * 1.15, Math.sin(a) * rad * 1.15);
          g.lineTo(Math.cos(a + Math.PI / 5) * rad * 0.45, Math.sin(a + Math.PI / 5) * rad * 0.45);
        }
        g.closePath();
        g.fill();
        g.shadowBlur = 0;
        g.restore();
      } else {
        drawNumberOrb(g, f.x, f.y, f.power, Math.sin(f.bob) * 2.5);
      }
    }

    drawVortexFX(g);

    for (const r of rivals) {
      drawPacOrb(g, r.x, r.y, r.power, r.color, r.mouth, r.facing, false);
    }
    const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    if (!blink) drawPacOrb(g, player.x, player.y, player.power, "#f5c842", player.mouth, player.facing, true);

    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      g.globalAlpha = Math.max(0, p.life * 2.2);
      if (p.glow) {
        g.shadowColor = p.color;
        g.shadowBlur = 8;
      }
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
      g.fillStyle = `rgba(245,200,66,${flash * 0.32})`;
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
    stick.ox = p.x;
    stick.oy = p.y;
    stick.dx = 0;
    stick.dy = 0;
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
      stick.dx = 0;
      stick.dy = 0;
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

  // Title idle preview
  player = { x: WORLD / 2, y: WORLD / 2, power: 7, mass: 0, mouth: 0, facing: 0, invuln: 0 };
  buildProps();
  foods = [
    makeFood(1), makeFood(2), makeFood(3), makeFood(1), makeFood(4), makeFood(2),
  ];
  foods[0].x = WORLD / 2 + 90; foods[0].y = WORLD / 2 - 20;
  foods[1].x = WORLD / 2 + 120; foods[1].y = WORLD / 2 + 40;
  foods[2].x = WORLD / 2 + 70; foods[2].y = WORLD / 2 + 70;
  rivals.push(makeRival(4), makeRival(5));
  last = performance.now();
  raf = requestAnimationFrame(function idle(now) {
    if (state !== "title") return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    player.facing = Math.sin(time * 0.6) * 0.4;
    player.mouth = time * 8;
    player.x = WORLD / 2 + Math.cos(time * 0.4) * 40;
    player.y = WORLD / 2 + Math.sin(time * 0.35) * 30;
    for (const f of foods) {
      f.bob += dt * 3;
      // Pull toward player for title drama
      const ang = Math.atan2(player.y - f.y, player.x - f.x);
      f.x += Math.cos(ang) * 12 * dt;
      f.y += Math.sin(ang) * 12 * dt;
    }
    draw(ctx);
    raf = requestAnimationFrame(idle);
  });
})();
