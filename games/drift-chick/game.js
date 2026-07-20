(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BEST_KEY = "drift-chick-best";
  const TRACK_HALF = 62;
  const CAR_R = 18;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  const hud = {
    dist: document.getElementById("hud-dist"),
    combo: document.getElementById("hud-combo"),
    score: document.getElementById("hud-score"),
    best: document.getElementById("hud-best"),
  };
  const hint = document.getElementById("hint");
  const overlays = {
    title: document.getElementById("title"),
    over: document.getElementById("over"),
  };

  const playerImg = new Image();
  playerImg.src = "assets/player.png";
  const treeImg = new Image();
  treeImg.src = "assets/tree.png";

  let state = "title";
  let holding = false;
  let steerInput = 0; // -1 left … +1 right (screen)
  let pointerX = W / 2;
  let last = 0;
  let raf = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  if (hud.best) hud.best.textContent = String(best);

  let path = [];
  let decor = [];
  let car = null;
  let score = 0;
  let dist = 0;
  let combo = 0;
  let maxCombo = 0;
  let smoke = [];
  let sparks = [];
  let skids = [];
  let flowers = [];
  let shake = 0;
  let driftBoost = 0;
  let cornerBonusReady = false;
  let exitBonusReady = false;
  let hintTimer = 4;
  let skidAcc = 0;
  let time = 0;

  function show(id) {
    Object.keys(overlays).forEach((k) => overlays[k].classList.toggle("hidden", k !== id));
  }

  function hideOverlays() {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function angNorm(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function angLerp(a, b, t) {
    return a + angNorm(b - a) * t;
  }

  function buildPath() {
    const pts = [];
    let x = 0;
    let y = 0;
    let ang = -Math.PI / 2;
    pts.push({ x, y, ang, curve: 0 });

    let targetCurve = 0;
    let segment = 0;

    for (let i = 0; i < 36; i += 1) {
      x += Math.cos(ang) * 20;
      y += Math.sin(ang) * 20;
      pts.push({ x, y, ang, curve: 0 });
    }

    for (let i = 0; i < 900; i += 1) {
      segment -= 1;
      if (segment <= 0) {
        const progress = i / 900;
        const curveChance = 0.32 + progress * 0.38;
        if (Math.random() > curveChance) {
          targetCurve = 0;
          segment = 14 + Math.floor(Math.random() * (28 - progress * 10));
        } else {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const sharp = (0.01 + Math.random() * 0.02) * (0.75 + progress * 0.5);
          targetCurve = dir * sharp;
          segment = 18 + Math.floor(Math.random() * (34 - progress * 12));
        }
      }
      const prev = pts[pts.length - 1].curve;
      const curve = lerp(prev, targetCurve, 0.16);
      ang += curve;
      x += Math.cos(ang) * 20;
      y += Math.sin(ang) * 20;
      pts.push({ x, y, ang, curve });
    }
    return pts;
  }

  function buildDecor() {
    const items = [];
    const blooms = [];
    for (let i = 8; i < path.length - 8; i += 3) {
      const p = path[i];
      const side = i % 2 === 0 ? 1 : -1;
      const distOut = TRACK_HALF + 38 + (i % 5) * 10;
      const ox = Math.cos(p.ang + Math.PI / 2) * side * distOut;
      const oy = Math.sin(p.ang + Math.PI / 2) * side * distOut;
      if (i % 6 === 0) {
        items.push({ type: "tree", x: p.x + ox, y: p.y + oy, s: 0.7 + (i % 4) * 0.08 });
      } else if (i % 4 === 0) {
        items.push({ type: "bush", x: p.x + ox * 0.92, y: p.y + oy * 0.92, s: 14 + (i % 3) * 4 });
      }
      if (i % 2 === 0) {
        blooms.push({
          x: p.x + ox * (0.7 + (i % 5) * 0.05),
          y: p.y + oy * (0.7 + (i % 5) * 0.05),
          c: ["#ff8ab5", "#ffd24a", "#fff", "#7dffc2"][i % 4],
          r: 2 + (i % 3),
        });
      }
    }
    return { items, blooms };
  }

  function nearestOnPath(px, py) {
    let bestI = 0;
    let bestD = Infinity;
    const start = car ? Math.max(0, car.idx - 8) : 0;
    const end = Math.min(path.length - 1, (car ? car.idx : 0) + 55);
    for (let i = start; i <= end; i += 1) {
      const p = path[i];
      const dx = px - p.x;
      const dy = py - p.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    if (bestD > TRACK_HALF * TRACK_HALF * 5) {
      for (let i = 0; i < path.length; i += 4) {
        const p = path[i];
        const dx = px - p.x;
        const dy = py - p.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
    }
    const p = path[bestI];
    const dx = px - p.x;
    const dy = py - p.y;
    const lateral = -Math.sin(p.ang) * dx + Math.cos(p.ang) * dy;
    return { i: bestI, p, dist: Math.sqrt(bestD), lateral };
  }

  function resetRun() {
    path = buildPath();
    const d = buildDecor();
    decor = d.items;
    flowers = d.blooms;
    const p0 = path[8];
    car = {
      x: p0.x,
      y: p0.y,
      ang: p0.ang,
      speed: 195,
      idx: 8,
      drift: 0,
      slip: 0,
    };
    score = 0;
    dist = 0;
    combo = 0;
    maxCombo = 0;
    smoke = [];
    sparks = [];
    skids = [];
    shake = 0;
    driftBoost = 0;
    cornerBonusReady = false;
    exitBonusReady = false;
    hintTimer = 4;
    holding = false;
    steerInput = 0;
    skidAcc = 0;
    time = 0;
    updateHud();
  }

  function updateHud() {
    if (hud.dist) hud.dist.textContent = String(Math.floor(dist));
    if (hud.combo) hud.combo.textContent = String(combo);
    if (hud.score) hud.score.textContent = String(Math.floor(score));
    if (hud.best) hud.best.textContent = String(best);
  }

  function startGame() {
    resetRun();
    hideOverlays();
    if (hint) hint.classList.remove("hidden");
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    if (state !== "play") return;
    state = "over";
    shake = 14;
    if (score > best) {
      best = Math.floor(score);
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    const detail = document.getElementById("over-detail");
    if (detail) {
      detail.textContent = `${Math.floor(dist)}m · ${Math.floor(score)}점 · 콤보 ${maxCombo}`;
    }
    show("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({
        gameId: "drift-chick",
        gameTitle: "드리프트 삐약이",
        formParent: overlays.over,
      });
      TodayGameRank.open(Math.max(1, Math.floor(score)), {
        label: `${Math.floor(dist)}m`,
      });
    }
  }

  function updateSteerFromPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    pointerX = x;
    // 화면 중앙 기준 좌/우. 가장자리일수록 강하게
    const raw = (x - W / 2) / (W * 0.42);
    steerInput = clamp(raw, -1, 1);
  }

  function setHold(v, e) {
    const was = holding;
    holding = v;
    if (v && e) updateSteerFromPointer(e.clientX, e.clientY);
    if (!v) steerInput = 0;
    if (state === "play" && v && !was) {
      cornerBonusReady = true;
      exitBonusReady = true;
    }
  }

  function spawnSmoke(x, y, ang, side) {
    const ox = Math.cos(ang + Math.PI / 2) * side * 12;
    const oy = Math.sin(ang + Math.PI / 2) * side * 12;
    smoke.push({
      x: x + ox - Math.cos(ang) * 8,
      y: y + oy - Math.sin(ang) * 8,
      r: 6 + Math.random() * 8,
      life: 0.45 + Math.random() * 0.35,
      t: 0,
      vx: Math.cos(ang + Math.PI) * (30 + Math.random() * 40) + ox,
      vy: Math.sin(ang + Math.PI) * (30 + Math.random() * 40) + oy,
    });
  }

  function spawnSparks(x, y) {
    for (let i = 0; i < 12; i += 1) {
      const a = Math.random() * Math.PI * 2;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * (60 + Math.random() * 100),
        vy: Math.sin(a) * (60 + Math.random() * 100),
        life: 0.3 + Math.random() * 0.35,
        t: 0,
        c: Math.random() < 0.5 ? "#fff6a8" : "#7dffc2",
      });
    }
  }

  function pushSkid(x, y, ang) {
    const sx = Math.cos(ang + Math.PI / 2);
    const sy = Math.sin(ang + Math.PI / 2);
    [-1, 1].forEach((side) => {
      skids.push({
        x: x + sx * side * 10,
        y: y + sy * side * 10,
        ang,
        life: 2.2,
        t: 0,
      });
    });
    if (skids.length > 260) skids.splice(0, skids.length - 260);
  }

  function update(dt) {
    if (state !== "play" || !car) return;
    time += dt;

    hintTimer -= dt;
    if (hint && hintTimer <= 0) hint.classList.add("hidden");

    const near = nearestOnPath(car.x, car.y);
    car.idx = near.i;
    const pathAng = near.p.ang;
    const curv = Math.abs(near.p.curve);

    const base = 190 + Math.min(175, dist * 0.08);
    car.speed = base + driftBoost * 60;

    if (holding && Math.abs(steerInput) > 0.08) {
      // 터치한 화면 방향으로 선회 (좌=-, 우=+)
      // 차는 위쪽이 전방이므로, 화면 좌/우 = 진행 방향 기준 좌/우
      const turn = steerInput * (2.8 + car.drift * 1.4);
      car.ang += turn * dt;
      car.drift = Math.min(1, car.drift + dt * 3.8);
      car.slip = lerp(car.slip, steerInput * 28, 1 - Math.pow(0.001, dt));

      // 옆으로 미끄러지는 드리프트
      car.x += Math.cos(car.ang + Math.PI / 2) * car.slip * dt;
      car.y += Math.sin(car.ang + Math.PI / 2) * car.slip * dt;

      skidAcc += dt;
      if (skidAcc > 0.035) {
        skidAcc = 0;
        pushSkid(car.x, car.y, car.ang);
        spawnSmoke(car.x, car.y, car.ang, Math.sign(steerInput) || 1);
        spawnSmoke(car.x, car.y, car.ang, -(Math.sign(steerInput) || 1));
      }

      if (curv > 0.003 && Math.sign(steerInput) === Math.sign(near.p.curve || steerInput)) {
        score += dt * (50 + combo * 12);
        if (cornerBonusReady && car.drift > 0.45) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          score += 20 + combo * 5;
          driftBoost = 1;
          cornerBonusReady = false;
          spawnSparks(car.x, car.y);
          shake = Math.max(shake, 4);
        }
      }
    } else {
      if (exitBonusReady && car.drift > 0.4) {
        score += 22 + combo * 2;
        exitBonusReady = false;
      }
      car.drift = Math.max(0, car.drift - dt * 4.5);
      car.slip = lerp(car.slip, 0, 1 - Math.pow(0.002, dt));

      // 손 떼면 트랙 중앙·방향으로 자동 직진
      car.ang = angLerp(car.ang, pathAng, clamp(dt * 3.2, 0, 1));
      const pull = clamp(-near.lateral * 2.4, -70, 70);
      car.x += Math.cos(pathAng + Math.PI / 2) * pull * dt;
      car.y += Math.sin(pathAng + Math.PI / 2) * pull * dt;
    }

    driftBoost = Math.max(0, driftBoost - dt * 0.8);

    car.x += Math.cos(car.ang) * car.speed * dt;
    car.y += Math.sin(car.ang) * car.speed * dt;

    dist += (car.speed * dt) / 12;
    score += dt * 8;

    const check = nearestOnPath(car.x, car.y);
    car.idx = check.i;
    if (check.dist > TRACK_HALF - CAR_R * 0.25) {
      gameOver();
      return;
    }

    if (holding && Math.abs(steerInput) > 0.2 && Math.sign(steerInput) !== Math.sign(check.p.curve || 0) && Math.abs(check.p.curve) > 0.01) {
      // 반대 방향 드리프트면 콤보 끊김
      if (check.dist > TRACK_HALF * 0.45) combo = 0;
    }

    shake = Math.max(0, shake - dt * 20);

    smoke.forEach((s) => {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.88;
      s.vy *= 0.88;
    });
    smoke = smoke.filter((s) => s.t < s.life);
    sparks.forEach((s) => {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    });
    sparks = sparks.filter((s) => s.t < s.life);
    skids.forEach((s) => {
      s.t += dt;
    });
    skids = skids.filter((s) => s.t < s.life);

    updateHud();
  }

  /** 월드 → 화면: 차는 항상 화면 하단 중앙, 전방이 위 */
  function worldToScreen(x, y) {
    const dx = x - car.x;
    const dy = y - car.y;
    const a = -car.ang - Math.PI / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return {
      x: dx * c - dy * s + W / 2,
      y: dx * s + dy * c + H * 0.72,
    };
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#6ec4ff");
    g.addColorStop(0.35, "#9fdfff");
    g.addColorStop(0.7, "#b8ecb0");
    g.addColorStop(1, "#8fd489");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // soft clouds
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let i = 0; i < 5; i += 1) {
      const cx = ((i * 97 + time * 12) % (W + 80)) - 40;
      const cy = 40 + (i % 3) * 28;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 36, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 22, cy + 4, 28, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDecor() {
    if (!car) return;
    const start = Math.max(0, car.idx - 12);
    const end = Math.min(path.length - 1, car.idx + 50);

    flowers.forEach((f, i) => {
      if (i < start * 2 || i > end * 2) return;
      const p = worldToScreen(f.x, f.y);
      if (p.y < -20 || p.y > H + 20 || p.x < -30 || p.x > W + 30) return;
      ctx.fillStyle = f.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    });

    decor.forEach((d, i) => {
      // rough cull by index spacing
      const p = worldToScreen(d.x, d.y);
      if (p.y < -80 || p.y > H + 80 || p.x < -80 || p.x > W + 80) return;
      if (d.type === "tree") {
        if (treeImg.complete && treeImg.naturalWidth) {
          const s = 52 * d.s;
          ctx.drawImage(treeImg, p.x - s / 2, p.y - s * 0.85, s, s);
        } else {
          ctx.fillStyle = "#3d8f4a";
          ctx.beginPath();
          ctx.arc(p.x, p.y - 10, 16 * d.s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#8b5a2b";
          ctx.fillRect(p.x - 3, p.y, 6, 12);
        }
      } else {
        ctx.fillStyle = "#5cb86a";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, d.s, d.s * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function drawTrack() {
    if (!car || path.length < 2) return;
    const start = Math.max(0, car.idx - 12);
    const end = Math.min(path.length - 1, car.idx + 55);

    const strokeRibbon = (color, width, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = start; i <= end; i += 1) {
        const s = worldToScreen(path[i].x, path[i].y);
        if (i === start) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // soft ground shadow under road
    strokeRibbon("rgba(40,70,40,0.18)", TRACK_HALF * 2 + 36);

    // dark asphalt edge
    strokeRibbon("#4a5568", TRACK_HALF * 2 + 22);

    // red-white curb (draw as thick then overlay dashed feel with two colors)
    strokeRibbon("#ff6b8a", TRACK_HALF * 2 + 8);
    ctx.save();
    ctx.setLineDash([16, 16]);
    strokeRibbon("#ffffff", TRACK_HALF * 2 + 8);
    ctx.restore();

    // main asphalt with subtle banding
    strokeRibbon("#5c667a", TRACK_HALF * 2 - 4);
    strokeRibbon("#6f7a90", TRACK_HALF * 2 - 18, 0.9);
    strokeRibbon("#818ca3", TRACK_HALF * 2 - 34, 0.55);

    // center dashed line
    ctx.save();
    ctx.setLineDash([16, 14]);
    strokeRibbon("#ffe566", 4);
    ctx.restore();

    // edge reflectors
    for (let i = start; i <= end; i += 2) {
      const p = path[i];
      const sL = worldToScreen(
        p.x + Math.cos(p.ang + Math.PI / 2) * (TRACK_HALF - 2),
        p.y + Math.sin(p.ang + Math.PI / 2) * (TRACK_HALF - 2)
      );
      const sR = worldToScreen(
        p.x + Math.cos(p.ang - Math.PI / 2) * (TRACK_HALF - 2),
        p.y + Math.sin(p.ang - Math.PI / 2) * (TRACK_HALF - 2)
      );
      ctx.fillStyle = i % 4 === 0 ? "#fff" : "#ff6b8a";
      ctx.beginPath();
      ctx.arc(sL.x, sL.y, 2.2, 0, Math.PI * 2);
      ctx.arc(sR.x, sR.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSkids() {
    skids.forEach((s) => {
      const a = 1 - s.t / s.life;
      const p = worldToScreen(s.x, s.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(s.ang - car.ang);
      ctx.fillStyle = `rgba(30, 28, 40,${0.35 * a})`;
      ctx.fillRect(-6, -1.5, 12, 3);
      ctx.restore();
    });
  }

  function drawSmoke() {
    smoke.forEach((s) => {
      const p = worldToScreen(s.x, s.y);
      const a = 1 - s.t / s.life;
      ctx.fillStyle = `rgba(255,255,255,${0.45 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.r * (1 + s.t * 2.4), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSparks() {
    sparks.forEach((s) => {
      const p = worldToScreen(s.x, s.y);
      ctx.globalAlpha = 1 - s.t / s.life;
      ctx.fillStyle = s.c;
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
      ctx.globalAlpha = 1;
    });
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

  /** 크게 보이는 탑다운 삐약이 카 */
  function drawChickCar() {
    const cx = W / 2;
    const cy = H * 0.72;
    const tilt = car.slip * 0.014 + (holding ? steerInput * 0.22 : 0);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);

    // shadow
    ctx.fillStyle = "rgba(40,30,50,0.3)";
    ctx.beginPath();
    ctx.ellipse(5, 22, 40, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    if (driftBoost > 0.15) {
      const glow = ctx.createRadialGradient(0, 30, 4, 0, 30, 52);
      glow.addColorStop(0, `rgba(125,255,194,${0.55 * driftBoost})`);
      glow.addColorStop(1, "rgba(125,255,194,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 34, 52, 0, Math.PI * 2);
      ctx.fill();
    }

    if (playerImg.complete && playerImg.naturalWidth > 0) {
      const iw = 108;
      const ih = 108;
      ctx.save();
      ctx.rotate(Math.PI); // 스프라이트 노즈가 아래 → 전방(위)으로
      ctx.shadowColor = "rgba(255, 180, 60, 0.45)";
      ctx.shadowBlur = 16;
      ctx.drawImage(playerImg, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();
    } else {
      drawChickFallback();
    }

    if (holding && car.drift > 0.25) {
      ctx.fillStyle = "rgba(255,246,168,0.95)";
      ctx.fillRect(-10, 44, 20, 6);
      ctx.fillStyle = "rgba(125,255,194,0.85)";
      ctx.fillRect(-6, 52, 12, 5);
    }

    ctx.restore();
  }

  function drawChickFallback() {
    // rear wing
    ctx.fillStyle = "#ff4f7a";
    roundRect(-24, 30, 48, 14, 5);
    ctx.fill();
    ctx.fillStyle = "#ffd24a";
    ctx.fillRect(-6, 28, 5, 18);
    ctx.fillRect(1, 28, 5, 18);

    // body
    const body = ctx.createLinearGradient(-30, -42, 30, 42);
    body.addColorStop(0, "#fff6c2");
    body.addColorStop(0.45, "#ffd24a");
    body.addColorStop(1, "#ff9a2e");
    ctx.fillStyle = body;
    roundRect(-28, -40, 56, 74, 20);
    ctx.fill();

    // racing stripes
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-7, -36, 5, 62);
    ctx.fillRect(2, -36, 5, 62);

    // front bumper
    ctx.fillStyle = "#ff4f7a";
    roundRect(-22, -46, 44, 12, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-12, -40, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(12, -40, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // wheels
    ctx.fillStyle = "#1f1a2e";
    roundRect(-38, -26, 14, 26, 5);
    roundRect(24, -26, 14, 26, 5);
    roundRect(-38, 8, 14, 26, 5);
    roundRect(24, 8, 14, 26, 5);
    ctx.fillStyle = "#4fd2ff";
    roundRect(-35, -18, 8, 12, 3);
    roundRect(27, -18, 8, 12, 3);
    roundRect(-35, 16, 8, 12, 3);
    roundRect(27, 16, 8, 12, 3);

    // chick body
    ctx.fillStyle = "#ffe566";
    ctx.beginPath();
    ctx.arc(0, -4, 26, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-9, -10, 8.5, 0, Math.PI * 2);
    ctx.arc(9, -10, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2438";
    ctx.beginPath();
    ctx.arc(-8, -9, 4, 0, Math.PI * 2);
    ctx.arc(10, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-6.5, -11, 1.6, 0, Math.PI * 2);
    ctx.arc(11.5, -11, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // blush + beak
    ctx.fillStyle = "rgba(255,120,150,0.5)";
    ctx.beginPath();
    ctx.ellipse(-16, 2, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(16, 2, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8a3a";
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(12, 4);
    ctx.lineTo(-1, 8);
    ctx.closePath();
    ctx.fill();

    // tiny wings on wheel
    ctx.fillStyle = "#ffe566";
    ctx.beginPath();
    ctx.ellipse(-22, 4, 8, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(22, 4, 8, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSteerCue() {
    if (state !== "play") return;

    // side zones
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, H * 0.55, W * 0.28, H * 0.45);
    ctx.fillRect(W * 0.72, H * 0.55, W * 0.28, H * 0.45);

    if (!holding) return;

    const side = steerInput < -0.08 ? "LEFT" : steerInput > 0.08 ? "RIGHT" : "HOLD";
    ctx.fillStyle = "rgba(255,79,139,0.12)";
    if (steerInput < -0.08) ctx.fillRect(0, 0, W * 0.45, H);
    if (steerInput > 0.08) ctx.fillRect(W * 0.55, 0, W * 0.45, H);

    ctx.fillStyle = "rgba(255,79,139,0.95)";
    ctx.font = '700 16px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(car.drift > 0.35 ? `DRIFT ${side}` : side, W / 2, 58);

    // finger marker
    ctx.fillStyle = "rgba(255,79,139,0.55)";
    ctx.beginPath();
    ctx.arc(pointerX, H - 36, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawBackground();
    drawDecor();
    drawTrack();
    drawSkids();
    drawSmoke();
    drawSparks();
    if (car) drawChickCar();
    drawSteerCue();
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (state === "play") update(dt);
    else time += dt;
    render();
    if (state === "play" || state === "title" || state === "over" || shake > 0) {
      raf = requestAnimationFrame(loop);
    }
  }

  function onDown(e) {
    if (e && e.cancelable) e.preventDefault();
    if (state !== "play") return;
    setHold(true, e);
  }
  function onMove(e) {
    if (!holding || state !== "play") return;
    if (e && e.cancelable) e.preventDefault();
    updateSteerFromPointer(e.clientX, e.clientY);
  }
  function onUp(e) {
    if (e && e.cancelable) e.preventDefault();
    setHold(false);
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("blur", () => setHold(false));
  window.addEventListener("keydown", (e) => {
    if (state !== "play") return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      holding = true;
      steerInput = -1;
      pointerX = W * 0.2;
      cornerBonusReady = true;
      exitBonusReady = true;
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      holding = true;
      steerInput = 1;
      pointerX = W * 0.8;
      cornerBonusReady = true;
      exitBonusReady = true;
    }
    if (e.code === "Space") {
      e.preventDefault();
      holding = true;
      // 스페이스는 마지막 포인터 쪽 유지, 없으면 오른쪽
      if (Math.abs(steerInput) < 0.05) {
        steerInput = pointerX < W / 2 ? -1 : 1;
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (
      e.code === "ArrowLeft" ||
      e.code === "KeyA" ||
      e.code === "ArrowRight" ||
      e.code === "KeyD" ||
      e.code === "Space"
    ) {
      holding = false;
      steerInput = 0;
    }
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "drift-chick",
      gameTitle: "드리프트 삐약이",
      formParent: overlays.over,
    });
  }

  resetRun();
  last = performance.now();
  raf = requestAnimationFrame(loop);
})();
