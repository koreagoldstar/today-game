(() => {
  "use strict";

  const GAME_ID = "number-hole";
  const W = 390;
  const H = 700;
  const WORLD = 3000;
  const ROUND_TIME = 75;
  const START_POWER = 2;
  const MAX_POWER = 22;
  const MAX_COMBO = 10;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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

  const RIVAL_COLORS = ["#e85d4c", "#3d9fd0", "#5fbf84", "#e09a3a", "#c97bb0"];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  /** Soft-capped size so entities never fill the viewport */
  function powerRadius(p) {
    const n = clamp(p, 1, MAX_POWER);
    return 14 + Math.log2(1 + n) * 5.8;
  }

  function powerSpeed(p) {
    return Math.max(135, 228 - Math.log2(1 + p) * 12);
  }

  function viewZoom() {
    if (!player) return 1;
    return clamp(1 - (player.power - START_POWER) * 0.016, 0.64, 1);
  }

  function xpNeeded(power) {
    return 4 + Math.floor(power * 2.1);
  }

  function updateHud() {
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-power").textContent = player ? String(player.power) : String(START_POWER);
    document.getElementById("hud-combo").textContent = String(combo);
    document.getElementById("hud-time").textContent = String(Math.max(0, Math.ceil(timeLeft)));
    const fill = document.getElementById("xp-fill");
    if (fill && player) {
      if (player.power >= MAX_POWER) fill.style.width = "100%";
      else fill.style.width = `${Math.min(100, (player.xp / xpNeeded(player.power)) * 100)}%`;
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.75, vy: -42 });
  }

  function burst(x, y, color, n = 8) {
    const count = Math.min(n, 14);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(30, 140);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.2, 0.45), r: rand(1.5, 3.5), color,
      });
    }
  }

  function makeFood(forced) {
    const base = player ? player.power : START_POWER;
    let p = forced;
    if (p == null) {
      const roll = Math.random();
      if (roll < 0.7) p = 1;
      else if (roll < 0.92) p = Math.min(2, base);
      else p = Math.max(1, Math.min(base - 1, 3));
    }
    return {
      x: rand(90, WORLD - 90),
      y: rand(90, WORLD - 90),
      power: Math.max(1, p),
      bob: rand(0, Math.PI * 2),
      kind: Math.random() < 0.06 ? "star" : "orb",
    };
  }

  function makeRival(forced) {
    const base = player ? player.power : START_POWER;
    const p = clamp(
      forced ?? Math.round(rand(Math.max(1, base), base + 2.5)),
      1,
      MAX_POWER
    );
    let x;
    let y;
    do {
      x = rand(140, WORLD - 140);
      y = rand(140, WORLD - 140);
    } while (player && Math.hypot(x - player.x, y - player.y) < 360);
    return {
      x, y, power: p, xp: 0, vx: 0, vy: 0,
      color: RIVAL_COLORS[Math.floor(Math.random() * RIVAL_COLORS.length)],
      think: rand(0.25, 0.7), target: null, mouth: 0, facing: 0, alive: true,
    };
  }

  function buildProps() {
    props = [];
    const kinds = [
      { w: 44, h: 58, label: "빌딩", val: 2 },
      { w: 34, h: 26, label: "차", val: 1 },
      { w: 26, h: 26, label: "박스", val: 1 },
      { w: 40, h: 26, label: "벤치", val: 1 },
      { w: 52, h: 34, label: "버스", val: 2 },
      { w: 28, h: 48, label: "등", val: 1 },
      { w: 54, h: 40, label: "상점", val: 2 },
      { w: 36, h: 36, label: "나무", val: 1 },
    ];
    for (let i = 0; i < 42; i++) {
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      props.push({
        x: rand(120, WORLD - 120),
        y: rand(120, WORLD - 120),
        w: k.w, h: k.h, label: k.label, val: k.val,
        hue: rand(178, 200), eaten: false,
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
    player = {
      x: WORLD / 2, y: WORLD / 2,
      power: START_POWER, xp: 0,
      mouth: 0, facing: 0, invuln: 1.4,
    };
    buildProps();
    for (let i = 0; i < 36; i++) foods.push(makeFood());
    rivals.push(makeRival(2), makeRival(3), makeRival(4), makeRival(5));
    hintTimer = 3;
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

  /** Slow growth: XP levels, not raw prey power dump */
  function growPlayer(bite, x, y, label) {
    const xpGain = bite <= 1 ? 1 : bite === 2 ? 2 : 3;
    player.xp += xpGain;
    let leveled = 0;
    while (player.power < MAX_POWER && player.xp >= xpNeeded(player.power)) {
      player.xp -= xpNeeded(player.power);
      player.power += 1;
      leveled += 1;
    }
    if (player.power >= MAX_POWER) player.xp = 0;

    const points = 2 + Math.floor(Math.min(combo, MAX_COMBO) * 0.6) + (leveled ? 5 : 0);
    score += points;
    combo = Math.min(MAX_COMBO, combo + 1);
    maxCombo = Math.max(maxCombo, combo);
    comboTimer = 1.25;

    burst(x, y, "#f0c44a", 5 + Math.min(4, bite));
    addFloat(x, y - 8, leveled ? `Lv.${player.power}` : (label || `+${points}`), leveled ? "#7dffb0" : "#f0c44a");
    if (combo >= 4 && combo % 2 === 0) addFloat(x, y - 24, `${combo} HIT`, "#ff7a68");
    shake = Math.min(0.28, 0.05 + leveled * 0.06);
    flash = leveled ? 0.1 : 0.04;
    updateHud();
  }

  function canAbsorb(eater, prey, dist) {
    return prey < eater && dist < powerRadius(eater) * 0.78;
  }

  function tryEatFood(f, i, dt) {
    const dist = Math.hypot(f.x - player.x, f.y - player.y);
    if (f.power < player.power && dist < powerRadius(player.power) * 1.35 && dist > 2) {
      const ang = Math.atan2(player.y - f.y, player.x - f.x);
      f.x += Math.cos(ang) * 95 * dt;
      f.y += Math.sin(ang) * 95 * dt;
    }
    if (canAbsorb(player.power, f.power, dist)) {
      growPlayer(f.power, f.x, f.y, f.kind === "star" ? "★" : null);
      if (f.kind === "star") {
        player.xp += 1;
        score += 3;
      }
      foods.splice(i, 1);
    } else if (f.power >= player.power && dist < powerRadius(player.power) * 0.7) {
      const ang = Math.atan2(f.y - player.y, f.x - player.x);
      f.x += Math.cos(ang) * 7;
      f.y += Math.sin(ang) * 7;
    }
  }

  function tryEatProp(p) {
    if (p.eaten) return;
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    if (p.val < player.power && dist < powerRadius(player.power) * 0.72) {
      p.eaten = true;
      growPlayer(1, p.x, p.y, p.label);
    }
  }

  function rivalGrow(r, amount) {
    r.xp += amount;
    const need = xpNeeded(r.power);
    if (r.power < MAX_POWER && r.xp >= need) {
      r.xp = 0;
      r.power += 1;
    }
  }

  function rivalAI(r, dt) {
    r.think -= dt;
    if (r.think <= 0 || !r.target) {
      r.think = rand(0.35, 0.85);
      let best = null;
      let bestD = Infinity;
      for (const f of foods) {
        if (f.power >= r.power) continue;
        const d = Math.hypot(f.x - r.x, f.y - r.y);
        if (d < bestD) { bestD = d; best = f; }
      }
      if (player && r.power > player.power) {
        const d = Math.hypot(player.x - r.x, player.y - r.y);
        if (d < 380 && d < bestD * 1.05) best = player;
      }
      if (player && player.power > r.power && Math.hypot(player.x - r.x, player.y - r.y) < 150) {
        r.target = { x: r.x + (r.x - player.x), y: r.y + (r.y - player.y) };
      } else if (best) {
        r.target = { x: best.x, y: best.y };
      } else {
        r.target = { x: rand(120, WORLD - 120), y: rand(120, WORLD - 120) };
      }
    }
    if (r.target) {
      const ang = Math.atan2(r.target.y - r.y, r.target.x - r.x);
      const sp = powerSpeed(r.power) * 0.78;
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
      if (!p.eaten && p.val < r.power && Math.hypot(p.x - r.x, p.y - r.y) < powerRadius(r.power) * 0.65) {
        p.eaten = true;
        rivalGrow(r, 1);
      }
    }
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
      player.mouth = (player.mouth + dt * 11) % (Math.PI * 2);
    } else {
      player.mouth *= 0.88;
    }
    player.x = clamp(player.x, 50, WORLD - 50);
    player.y = clamp(player.y, 50, WORLD - 50);

    for (const f of foods) f.bob += dt * 3.5;
    for (let i = foods.length - 1; i >= 0; i--) tryEatFood(foods[i], i, dt);
    for (const p of props) tryEatProp(p);

    for (let i = rivals.length - 1; i >= 0; i--) {
      const r = rivals[i];
      if (!r.alive) { rivals.splice(i, 1); continue; }
      rivalAI(r, dt);
      const dist = Math.hypot(r.x - player.x, r.y - player.y);

      if (r.power < player.power && dist < powerRadius(player.power) * 1.25 && dist > 2) {
        const ang = Math.atan2(player.y - r.y, player.x - r.x);
        r.x += Math.cos(ang) * 70 * dt;
        r.y += Math.sin(ang) * 70 * dt;
      }

      if (canAbsorb(player.power, r.power, dist)) {
        growPlayer(Math.min(3, r.power), r.x, r.y, "라이벌");
        score += 8;
        burst(r.x, r.y, r.color, 12);
        rivals.splice(i, 1);
        continue;
      }

      if (player.invuln <= 0 && r.power > player.power && dist < powerRadius(r.power) * 0.58) {
        burst(player.x, player.y, "#ff6b5a", 16);
        endGame("eaten");
        return;
      }

      if (r.power === player.power && dist < powerRadius(player.power) * 0.85) {
        const ang = Math.atan2(player.y - r.y, player.x - r.x);
        player.x += Math.cos(ang) * 9;
        player.y += Math.sin(ang) * 9;
        r.x -= Math.cos(ang) * 9;
        r.y -= Math.sin(ang) * 9;
      }
    }

    for (let i = 0; i < rivals.length; i++) {
      for (let j = i + 1; j < rivals.length; j++) {
        const a = rivals[i];
        const b = rivals[j];
        if (!a.alive || !b.alive) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < Math.max(powerRadius(a.power), powerRadius(b.power)) * 0.6) {
          if (a.power > b.power) { rivalGrow(a, 2); b.alive = false; }
          else if (b.power > a.power) { rivalGrow(b, 2); a.alive = false; }
        }
      }
    }
    rivals = rivals.filter((r) => r.alive);

    spawnAcc += dt;
    if (spawnAcc > 0.72 && foods.length < 34) {
      spawnAcc = 0;
      foods.push(makeFood());
    }
    rivalAcc += dt;
    if (rivalAcc > 3.6 && rivals.length < 8) {
      rivalAcc = 0;
      rivals.push(makeRival(player.power + Math.floor(rand(1, 4))));
    }

    if (particles.length > 80) particles.splice(0, particles.length - 80);
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
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawGrid(g) {
    const z = viewZoom();
    const step = 70;
    g.strokeStyle = "rgba(120,160,190,0.08)";
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
    if (s.x < -70 || s.y < -70 || s.x > W + 70 || s.y > H + 70) return;
    g.save();
    g.translate(s.x, s.y);
    const can = player && p.val < player.power;
    g.fillStyle = can ? `hsla(${p.hue},42%,48%,0.9)` : `hsla(${p.hue},18%,32%,0.55)`;
    g.strokeStyle = can ? "rgba(240,196,74,0.55)" : "rgba(255,255,255,0.08)";
    g.lineWidth = 1.5;
    roundRect(g, (-p.w / 2) * z, (-p.h / 2) * z, p.w * z, p.h * z, 6 * z);
    g.fill();
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.font = `600 ${Math.max(10, 12 * z)}px "Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(p.val), 0, 0);
    g.restore();
  }

  function drawOrb(g, x, y, power, color, mouthPhase, facing, isPlayer) {
    const s = worldToScreen(x, y);
    const z = viewZoom();
    const rad = powerRadius(power) * z;
    if (s.x < -50 || s.y < -50 || s.x > W + 50 || s.y > H + 50) return;
    g.save();
    g.translate(s.x, s.y);

    g.fillStyle = "rgba(0,0,0,0.22)";
    g.beginPath();
    g.ellipse(1, rad * 0.5, rad * 0.7, rad * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    if (isPlayer) {
      g.strokeStyle = `rgba(80,200,220,${0.22 + Math.sin(time * 5) * 0.08})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, rad + 5 + Math.sin(time * 4) * 1.2, 0, Math.PI * 2);
      g.stroke();
    }

    const mouth = (0.12 + Math.abs(Math.sin(mouthPhase || 0)) * 0.28) * Math.PI;
    g.rotate(facing || 0);
    g.fillStyle = color;
    g.beginPath();
    if (mouth > 0.04) {
      g.arc(0, 0, rad, mouth * 0.5, Math.PI * 2 - mouth * 0.5);
      g.lineTo(0, 0);
    } else {
      g.arc(0, 0, rad, 0, Math.PI * 2);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.18)";
    g.lineWidth = Math.max(1, rad * 0.06);
    g.stroke();

    g.fillStyle = "rgba(255,255,255,0.28)";
    g.beginPath();
    g.ellipse(-rad * 0.25, -rad * 0.3, rad * 0.28, rad * 0.16, -0.45, 0, Math.PI * 2);
    g.fill();

    g.rotate(-(facing || 0));
    g.fillStyle = isPlayer ? "#1a2430" : "#0f1820";
    g.shadowColor = "rgba(0,0,0,0.25)";
    g.shadowBlur = 2;
    const fs = Math.max(11, Math.min(24, rad * 0.85));
    g.font = `700 ${fs}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(power), 0, 1);
    g.shadowBlur = 0;
    g.restore();
  }

  function drawMinimap(g) {
    const mw = 72;
    const mh = 72;
    const mx = W - mw - 14;
    const my = H - mh - 58;
    g.save();
    g.globalAlpha = 0.88;
    g.fillStyle = "rgba(12,22,34,0.82)";
    g.strokeStyle = "rgba(120,170,200,0.28)";
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
      g.fillStyle = "#f0c44a";
      g.beginPath();
      g.arc(mx + player.x * sx, my + player.y * sy, 3.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function draw(g) {
    if (!player) return;
    g.save();
    if (shake > 0) g.translate(rand(-2, 2) * shake * 4, rand(-2, 2) * shake * 4);

    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#122636");
    bg.addColorStop(1, "#0b1622");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    drawGrid(g);

    for (const p of props) drawProp(g, p);

    for (const f of foods) {
      const s = worldToScreen(f.x, f.y);
      if (s.x < -30 || s.y < -30 || s.x > W + 30 || s.y > H + 30) continue;
      const z = viewZoom();
      const rad = powerRadius(f.power) * 0.42 * z;
      const bob = Math.sin(f.bob) * 2;
      g.save();
      g.translate(s.x, s.y + bob);
      const can = f.power < player.power;
      if (f.kind === "star") {
        g.fillStyle = "#f0c44a";
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          g.lineTo(Math.cos(a) * rad * 1.1, Math.sin(a) * rad * 1.1);
          g.lineTo(Math.cos(a + Math.PI / 5) * rad * 0.45, Math.sin(a + Math.PI / 5) * rad * 0.45);
        }
        g.closePath();
        g.fill();
      } else {
        g.fillStyle = can ? "#4db8d9" : "#5a6d7c";
        g.beginPath();
        g.arc(0, 0, rad, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fff";
        g.font = `600 ${Math.max(9, rad * 0.95)}px "Jua"`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(f.power), 0, 0);
      }
      g.restore();
    }

    for (const r of rivals) drawOrb(g, r.x, r.y, r.power, r.color, r.mouth, r.facing, false);
    const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    if (!blink) drawOrb(g, player.x, player.y, player.power, "#f0c44a", player.mouth, player.facing, true);

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
      g.font = '600 14px "Jua"';
      g.textAlign = "center";
      g.fillText(f.text, s.x, s.y);
    }
    g.globalAlpha = 1;

    drawMinimap(g);

    if (stick.active) {
      g.fillStyle = "rgba(255,255,255,0.1)";
      g.beginPath();
      g.arc(stick.ox, stick.oy, 34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(240,196,74,0.45)";
      g.beginPath();
      g.arc(stick.ox + clamp(stick.dx, -24, 24), stick.oy + clamp(stick.dy, -24, 24), 14, 0, Math.PI * 2);
      g.fill();
    }

    if (flash > 0) {
      g.fillStyle = `rgba(240,196,74,${flash * 0.35})`;
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
    canvas.setPointerCapture(pointerId);
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

  player = { x: WORLD / 2, y: WORLD / 2, power: 6, xp: 0, mouth: 0, facing: 0, invuln: 0 };
  buildProps();
  for (let i = 0; i < 36; i++) foods.push(makeFood(1 + (i % 3)));
  rivals.push(makeRival(4), makeRival(5));
  last = performance.now();
  raf = requestAnimationFrame(function idle(now) {
    if (state !== "title") return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    player.facing += dt * 0.55;
    player.mouth = time * 7;
    player.x = WORLD / 2 + Math.cos(time * 0.35) * 70;
    player.y = WORLD / 2 + Math.sin(time * 0.3) * 50;
    for (const f of foods) f.bob += dt * 3;
    draw(ctx);
    raf = requestAnimationFrame(idle);
  });
})();
