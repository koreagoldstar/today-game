(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BEST_KEY = "drift-chick-best";
  const TRACK_HALF = 56;
  const CAR_R = 14;

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

  let state = "title";
  let holding = false;
  let last = 0;
  let raf = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  if (hud.best) hud.best.textContent = String(best);

  let path = [];
  let car = null;
  let score = 0;
  let dist = 0;
  let combo = 0;
  let maxCombo = 0;
  let smoke = [];
  let sparks = [];
  let skids = [];
  let cam = { x: 0, y: 0, ang: -Math.PI / 2 };
  let shake = 0;
  let driftBoost = 0;
  let cornerBonusReady = false;
  let exitBonusReady = false;
  let hintTimer = 4;
  let skidAcc = 0;

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

  /** 초반은 완만, 뒤로 갈수록 코너 밀도 상승 */
  function buildPath() {
    const pts = [];
    let x = 0;
    let y = 0;
    let ang = -Math.PI / 2;
    pts.push({ x, y, ang, curve: 0 });

    let targetCurve = 0;
    let segment = 0;

    // 쉬운 직진 인트로
    for (let i = 0; i < 40; i += 1) {
      const step = 18;
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      pts.push({ x, y, ang, curve: 0 });
    }

    for (let i = 0; i < 860; i += 1) {
      segment -= 1;
      if (segment <= 0) {
        const progress = i / 860;
        const curveChance = 0.35 + progress * 0.35;
        if (Math.random() > curveChance) {
          targetCurve = 0;
          segment = 16 + Math.floor(Math.random() * (32 - progress * 12));
        } else {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const sharp = (0.008 + Math.random() * 0.018) * (0.7 + progress * 0.55);
          targetCurve = dir * sharp;
          segment = 20 + Math.floor(Math.random() * (36 - progress * 10));
        }
      }
      const prev = pts[pts.length - 1].curve;
      const curve = lerp(prev, targetCurve, 0.14);
      ang += curve;
      const step = 18;
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      pts.push({ x, y, ang, curve });
    }
    return pts;
  }

  function nearestOnPath(px, py) {
    let bestI = 0;
    let bestD = Infinity;
    const start = car ? Math.max(0, car.idx - 6) : 0;
    const end = Math.min(path.length - 1, (car ? car.idx : 0) + 48);
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
    if (bestD > TRACK_HALF * TRACK_HALF * 4) {
      for (let i = 0; i < path.length; i += 3) {
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
    const p0 = path[6];
    car = {
      x: p0.x,
      y: p0.y,
      ang: p0.ang,
      speed: 190,
      idx: 6,
      drift: 0,
    };
    score = 0;
    dist = 0;
    combo = 0;
    maxCombo = 0;
    smoke = [];
    sparks = [];
    skids = [];
    cam = { x: car.x, y: car.y, ang: car.ang };
    shake = 0;
    driftBoost = 0;
    cornerBonusReady = false;
    exitBonusReady = false;
    hintTimer = 3.8;
    holding = false;
    skidAcc = 0;
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
    shake = 12;
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

  function setHold(v) {
    const was = holding;
    holding = v;
    if (state === "play" && v && !was) {
      cornerBonusReady = true;
      exitBonusReady = true;
    }
  }

  function spawnSmoke(x, y, ang) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const ox = Math.cos(ang + Math.PI / 2) * side * 11;
    const oy = Math.sin(ang + Math.PI / 2) * side * 11;
    smoke.push({
      x: x + ox,
      y: y + oy,
      r: 5 + Math.random() * 7,
      life: 0.4 + Math.random() * 0.4,
      t: 0,
      vx: Math.cos(ang + Math.PI) * (24 + Math.random() * 36) + ox * 1.5,
      vy: Math.sin(ang + Math.PI) * (24 + Math.random() * 36) + oy * 1.5,
    });
  }

  function spawnSparks(x, y) {
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * Math.PI * 2;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * (50 + Math.random() * 90),
        vy: Math.sin(a) * (50 + Math.random() * 90),
        life: 0.28 + Math.random() * 0.35,
        t: 0,
        c: Math.random() < 0.5 ? "#fff6a8" : "#7dffc2",
      });
    }
  }

  function pushSkid(x, y, ang, drift) {
    const side = Math.cos(ang + Math.PI / 2);
    const sy = Math.sin(ang + Math.PI / 2);
    skids.push({
      x: x - side * 9,
      y: y - sy * 9,
      ang,
      w: 3 + drift * 2,
      life: 1.6,
      t: 0,
    });
    skids.push({
      x: x + side * 9,
      y: y + sy * 9,
      ang,
      w: 3 + drift * 2,
      life: 1.6,
      t: 0,
    });
    if (skids.length > 220) skids.splice(0, skids.length - 220);
  }

  function update(dt) {
    if (state !== "play" || !car) return;

    hintTimer -= dt;
    if (hint && hintTimer <= 0) hint.classList.add("hidden");

    const near = nearestOnPath(car.x, car.y);
    car.idx = near.i;
    const pathAng = near.p.ang;
    const curv = Math.abs(near.p.curve);

    const base = 185 + Math.min(170, dist * 0.075);
    car.speed = base + driftBoost * 55;

    if (holding) {
      car.drift = Math.min(1, car.drift + dt * 4.2);
      const turnRate = 2.6 + curv * 90;
      car.ang = angLerp(car.ang, pathAng, clamp(dt * turnRate, 0, 1));
      const out = Math.sign(near.p.curve || 0.0001);
      car.x += Math.cos(pathAng + Math.PI / 2) * out * 22 * car.drift * dt;
      car.y += Math.sin(pathAng + Math.PI / 2) * out * 22 * car.drift * dt;

      if (car.drift > 0.25) {
        skidAcc += dt;
        if (skidAcc > 0.04) {
          skidAcc = 0;
          pushSkid(car.x, car.y, car.ang, car.drift);
        }
        spawnSmoke(car.x, car.y, car.ang);
      }

      if (curv > 0.0035) {
        score += dt * (45 + combo * 10);
        if (cornerBonusReady && car.drift > 0.5) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          score += 18 + combo * 4;
          driftBoost = 1;
          cornerBonusReady = false;
          spawnSparks(car.x, car.y);
          shake = Math.max(shake, 3);
        }
      }
    } else {
      if (exitBonusReady && car.drift > 0.35 && curv < 0.0035) {
        score += 25 + combo * 2;
        exitBonusReady = false;
      }
      car.drift = Math.max(0, car.drift - dt * 5.5);
    }

    driftBoost = Math.max(0, driftBoost - dt * 0.85);

    car.x += Math.cos(car.ang) * car.speed * dt;
    car.y += Math.sin(car.ang) * car.speed * dt;

    dist += (car.speed * dt) / 12;
    score += dt * 7;

    const check = nearestOnPath(car.x, car.y);
    car.idx = check.i;
    if (check.dist > TRACK_HALF - CAR_R * 0.3) {
      gameOver();
      return;
    }

    if (!holding && Math.abs(check.p.curve) > 0.01 && check.dist > TRACK_HALF * 0.55) {
      combo = 0;
    }
    if (!holding && Math.abs(angNorm(car.ang - check.p.ang)) > 1.05 && Math.abs(check.p.curve) > 0.007) {
      combo = 0;
    }

    const follow = 1 - Math.pow(0.0008, dt);
    cam.x = lerp(cam.x, car.x + Math.cos(car.ang) * 48, follow);
    cam.y = lerp(cam.y, car.y + Math.sin(car.ang) * 48, follow);
    cam.ang = angLerp(cam.ang, car.ang, follow * 0.65);
    shake = Math.max(0, shake - dt * 18);

    smoke.forEach((s) => {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.9;
      s.vy *= 0.9;
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

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#8fd6ff");
    g.addColorStop(0.5, "#c8f0ff");
    g.addColorStop(1, "#ffe6f2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function worldToScreen(x, y) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    // 살짝 카메라 회전 — 드리프트 방향감
    const a = cam.ang + Math.PI / 2;
    const c = Math.cos(-a);
    const s = Math.sin(-a);
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    return { x: rx + W / 2, y: ry + H * 0.62 };
  }

  function drawTrack() {
    if (path.length < 2 || !car) return;
    const start = Math.max(0, car.idx - 10);
    const end = Math.min(path.length - 1, car.idx + 60);

    ctx.fillStyle = "rgba(120, 210, 130, 0.32)";
    for (let i = start; i < end; i += 4) {
      const p = path[i];
      const s = worldToScreen(
        p.x + Math.cos(p.ang + 1.15) * 95,
        p.y + Math.sin(p.ang + 1.15) * 95
      );
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 30, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const strokePath = (color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = start; i <= end; i += 1) {
        const s = worldToScreen(path[i].x, path[i].y);
        if (i === start) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
    };

    strokePath("#5a6578", TRACK_HALF * 2 + 20);
    strokePath("#7b879c", TRACK_HALF * 2 + 6);
    strokePath("#ff9ec4", TRACK_HALF * 2);
    strokePath("#9aa7bd", TRACK_HALF * 2 - 16);

    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    for (let i = start; i <= end; i += 1) {
      const s = worldToScreen(path[i].x, path[i].y);
      if (i === start) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawSkids() {
    skids.forEach((s) => {
      const a = 1 - s.t / s.life;
      const p = worldToScreen(s.x, s.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      const camA = cam.ang + Math.PI / 2;
      ctx.rotate(s.ang - camA + Math.PI / 2);
      ctx.fillStyle = `rgba(55, 45, 60,${0.28 * a})`;
      ctx.fillRect(-5, -s.w / 2, 10, s.w);
      ctx.restore();
    });
  }

  function drawSmoke() {
    smoke.forEach((s) => {
      const p = worldToScreen(s.x, s.y);
      const a = 1 - s.t / s.life;
      ctx.fillStyle = `rgba(255,255,255,${0.4 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.r * (1 + s.t * 2.2), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSparks() {
    sparks.forEach((s) => {
      const p = worldToScreen(s.x, s.y);
      const a = 1 - s.t / s.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.c;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
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

  function drawCar() {
    if (!car) return;
    const s = worldToScreen(car.x, car.y);
    const driftTilt = car.drift * 0.55 * (holding ? 1 : 0.35);
    const camA = cam.ang + Math.PI / 2;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(car.ang - camA + Math.PI / 2 + driftTilt);

    ctx.fillStyle = "rgba(60,40,70,0.22)";
    ctx.beginPath();
    ctx.ellipse(2, 7, 17, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    if (driftBoost > 0.15) {
      ctx.fillStyle = `rgba(125,255,194,${0.28 * driftBoost})`;
      ctx.beginPath();
      ctx.ellipse(0, 12, 24, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,246,168,${0.55 * driftBoost})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 14, 18, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const body = ctx.createLinearGradient(-14, -18, 14, 18);
    body.addColorStop(0, "#fff0a8");
    body.addColorStop(0.45, "#ffd24a");
    body.addColorStop(1, "#ff9f2e");
    ctx.fillStyle = body;
    roundRect(-13, -18, 26, 34, 11);
    ctx.fill();

    ctx.fillStyle = "#ffe9a0";
    roundRect(-9, -5, 18, 14, 7);
    ctx.fill();

    // chick head
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.arc(0, -11, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3d2a45";
    ctx.beginPath();
    ctx.arc(-3.3, -12, 1.7, 0, Math.PI * 2);
    ctx.arc(3.3, -12, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff7a3a";
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(4.2, -7.2);
    ctx.lineTo(0, -5.5);
    ctx.closePath();
    ctx.fill();

    // blush
    ctx.fillStyle = "rgba(255,120,150,0.35)";
    ctx.beginPath();
    ctx.ellipse(-5.5, -9, 2.2, 1.4, 0, 0, Math.PI * 2);
    ctx.ellipse(5.5, -9, 2.2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3d2a45";
    roundRect(-16, -12, 5, 10, 2);
    roundRect(11, -12, 5, 10, 2);
    roundRect(-16, 6, 5, 10, 2);
    roundRect(11, 6, 5, 10, 2);

    if (car.drift > 0.25 && holding) {
      ctx.fillStyle = "rgba(255,246,168,0.9)";
      ctx.fillRect(-4, 15, 8, 3);
      ctx.fillStyle = "rgba(125,255,194,0.7)";
      ctx.fillRect(-2, 18, 4, 2);
    }

    ctx.restore();
  }

  function drawHoldCue() {
    if (state !== "play" || !holding) return;
    ctx.fillStyle = "rgba(255,79,139,0.08)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,79,139,0.9)";
    ctx.font = '700 15px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(car && car.drift > 0.4 ? "DRIFT!" : "HOLD", W / 2, 62);
  }

  function render() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawBackground();
    drawTrack();
    drawSkids();
    drawSmoke();
    drawSparks();
    drawCar();
    drawHoldCue();
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (state === "play") update(dt);
    else if (state === "title" && car) {
      // 타이틀 살짝 미리보기 패닝
      cam.x = lerp(cam.x, car.x + Math.cos(car.ang) * 20, 0.02);
      cam.y = lerp(cam.y, car.y + Math.sin(car.ang) * 20, 0.02);
    }
    render();
    if (state === "play" || state === "title" || shake > 0) {
      raf = requestAnimationFrame(loop);
    }
  }

  function onDown(e) {
    if (e && e.cancelable) e.preventDefault();
    if (state === "play") setHold(true);
  }
  function onUp(e) {
    if (e && e.cancelable) e.preventDefault();
    setHold(false);
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("blur", () => setHold(false));
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "play") setHold(true);
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      setHold(false);
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
  cam = { x: car.x, y: car.y, ang: car.ang };
  last = performance.now();
  raf = requestAnimationFrame(loop);
})();
