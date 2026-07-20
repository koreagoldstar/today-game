(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BEST_KEY = "drift-chick-best";
  const TRACK_HALF = 52;
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
  hud.best.textContent = String(best);

  let path = [];
  let car = null;
  let score = 0;
  let dist = 0;
  let combo = 0;
  let maxCombo = 0;
  let smoke = [];
  let sparks = [];
  let cam = { x: 0, y: 0 };
  let shake = 0;
  let driftBoost = 0;
  let cornerBonusReady = false;
  let hintTimer = 4;

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

  /** 구불구불한 트랙 포인트 생성 */
  function buildPath() {
    const pts = [];
    let x = 0;
    let y = 0;
    let ang = -Math.PI / 2;
    pts.push({ x, y, ang, curve: 0 });

    let targetCurve = 0;
    let segment = 0;
    for (let i = 0; i < 900; i += 1) {
      segment -= 1;
      if (segment <= 0) {
        const roll = Math.random();
        if (roll < 0.38) {
          targetCurve = 0;
          segment = 18 + Math.floor(Math.random() * 28);
        } else {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const sharp = 0.012 + Math.random() * 0.022;
          targetCurve = dir * sharp;
          segment = 22 + Math.floor(Math.random() * 34);
        }
      }
      const prev = pts[pts.length - 1].curve;
      const curve = lerp(prev, targetCurve, 0.12);
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
    // search near last index for speed
    const start = car ? Math.max(0, car.idx - 4) : 0;
    const end = Math.min(path.length - 1, (car ? car.idx : 0) + 40);
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
    // occasional wider search if lost
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
    const p0 = path[2];
    car = {
      x: p0.x,
      y: p0.y,
      ang: p0.ang,
      speed: 210,
      idx: 2,
      drift: 0,
    };
    score = 0;
    dist = 0;
    combo = 0;
    maxCombo = 0;
    smoke = [];
    sparks = [];
    cam = { x: car.x, y: car.y };
    shake = 0;
    driftBoost = 0;
    cornerBonusReady = false;
    hintTimer = 3.5;
    holding = false;
    updateHud();
  }

  function updateHud() {
    hud.dist.textContent = String(Math.floor(dist));
    hud.combo.textContent = String(combo);
    hud.score.textContent = String(Math.floor(score));
    hud.best.textContent = String(best);
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
    shake = 10;
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
    holding = v;
    if (state === "play" && v) cornerBonusReady = true;
  }

  function spawnSmoke(x, y, ang) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const ox = Math.cos(ang + Math.PI / 2) * side * 10;
    const oy = Math.sin(ang + Math.PI / 2) * side * 10;
    smoke.push({
      x: x + ox,
      y: y + oy,
      r: 4 + Math.random() * 6,
      life: 0.35 + Math.random() * 0.35,
      t: 0,
      vx: Math.cos(ang + Math.PI) * (20 + Math.random() * 30) + ox * 2,
      vy: Math.sin(ang + Math.PI) * (20 + Math.random() * 30) + oy * 2,
    });
  }

  function spawnSparks(x, y) {
    for (let i = 0; i < 8; i += 1) {
      const a = Math.random() * Math.PI * 2;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * (40 + Math.random() * 80),
        vy: Math.sin(a) * (40 + Math.random() * 80),
        life: 0.25 + Math.random() * 0.3,
        t: 0,
        c: Math.random() < 0.5 ? "#fff6a8" : "#7dffc2",
      });
    }
  }

  function update(dt) {
    if (state !== "play" || !car) return;

    hintTimer -= dt;
    if (hint && hintTimer <= 0) hint.classList.add("hidden");

    const near = nearestOnPath(car.x, car.y);
    car.idx = near.i;
    const pathAng = near.p.ang;
    const curv = Math.abs(near.p.curve);

    // speed scales with distance
    const base = 200 + Math.min(160, dist * 0.08);
    car.speed = base + driftBoost * 50;

    if (holding) {
      car.drift = Math.min(1, car.drift + dt * 4.5);
      // turn toward track tangent (drift)
      const turnRate = 2.4 + curv * 80;
      car.ang = angLerp(car.ang, pathAng, clamp(dt * turnRate, 0, 1));
      // slight slide toward outside for style
      const out = Math.sign(near.p.curve || 0.0001);
      car.x += Math.cos(pathAng + Math.PI / 2) * out * 18 * car.drift * dt;
      car.y += Math.sin(pathAng + Math.PI / 2) * out * 18 * car.drift * dt;
      if (curv > 0.004) {
        spawnSmoke(car.x, car.y, car.ang);
        score += dt * (40 + combo * 8);
        if (cornerBonusReady && car.drift > 0.55) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          score += 15 + combo * 3;
          driftBoost = 1;
          cornerBonusReady = false;
          spawnSparks(car.x, car.y);
        }
      }
    } else {
      if (car.drift > 0.4 && curv < 0.003 && combo > 0) {
        // clean exit from corner
        score += 20;
      }
      car.drift = Math.max(0, car.drift - dt * 5);
      // straight: keep heading, do not auto-align
    }

    driftBoost = Math.max(0, driftBoost - dt * 0.8);

    car.x += Math.cos(car.ang) * car.speed * dt;
    car.y += Math.sin(car.ang) * car.speed * dt;

    dist += (car.speed * dt) / 12;
    score += dt * 8;

    const check = nearestOnPath(car.x, car.y);
    car.idx = check.i;
    if (check.dist > TRACK_HALF - CAR_R * 0.35) {
      gameOver();
      return;
    }

    // missed a curve while not holding
    if (!holding && Math.abs(check.p.curve) > 0.01 && check.dist > TRACK_HALF * 0.55) {
      combo = 0;
    }
    if (!holding && Math.abs(angNorm(car.ang - check.p.ang)) > 1.1 && Math.abs(check.p.curve) > 0.008) {
      combo = 0;
    }

    cam.x = lerp(cam.x, car.x + Math.cos(car.ang) * 40, 1 - Math.pow(0.001, dt));
    cam.y = lerp(cam.y, car.y + Math.sin(car.ang) * 40, 1 - Math.pow(0.001, dt));
    shake = Math.max(0, shake - dt * 18);

    smoke.forEach((s) => {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.92;
      s.vy *= 0.92;
    });
    smoke = smoke.filter((s) => s.t < s.life);
    sparks.forEach((s) => {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    });
    sparks = sparks.filter((s) => s.t < s.life);

    updateHud();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#8fd6ff");
    g.addColorStop(0.55, "#c8f0ff");
    g.addColorStop(1, "#ffe6f2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function worldToScreen(x, y) {
    const sx = x - cam.x + W / 2;
    const sy = y - cam.y + H * 0.62;
    return { x: sx, y: sy };
  }

  function drawTrack() {
    if (path.length < 2) return;
    const start = Math.max(0, car.idx - 8);
    const end = Math.min(path.length - 1, car.idx + 55);

    // grass soft blobs
    ctx.fillStyle = "rgba(120, 210, 130, 0.35)";
    for (let i = start; i < end; i += 5) {
      const p = path[i];
      const s = worldToScreen(p.x + Math.cos(p.ang + 1.2) * 90, p.y + Math.sin(p.ang + 1.2) * 90);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 28, 18, p.ang, 0, Math.PI * 2);
      ctx.fill();
    }

    // road body
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#5a6578";
    ctx.lineWidth = TRACK_HALF * 2 + 18;
    ctx.beginPath();
    for (let i = start; i <= end; i += 1) {
      const s = worldToScreen(path[i].x, path[i].y);
      if (i === start) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();

    ctx.strokeStyle = "#7b879c";
    ctx.lineWidth = TRACK_HALF * 2 + 4;
    ctx.beginPath();
    for (let i = start; i <= end; i += 1) {
      const s = worldToScreen(path[i].x, path[i].y);
      if (i === start) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();

    // pastel curb
    ctx.strokeStyle = "#ff9ec4";
    ctx.lineWidth = TRACK_HALF * 2;
    ctx.beginPath();
    for (let i = start; i <= end; i += 1) {
      const s = worldToScreen(path[i].x, path[i].y);
      if (i === start) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();

    ctx.strokeStyle = "#9aa7bd";
    ctx.lineWidth = TRACK_HALF * 2 - 14;
    ctx.beginPath();
    for (let i = start; i <= end; i += 1) {
      const s = worldToScreen(path[i].x, path[i].y);
      if (i === start) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();

    // center dashes
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
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

  function drawSmoke() {
    smoke.forEach((s) => {
      const p = worldToScreen(s.x, s.y);
      const a = 1 - s.t / s.life;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.r * (1 + s.t * 2), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSparks() {
    sparks.forEach((s) => {
      const p = worldToScreen(s.x, s.y);
      const a = 1 - s.t / s.life;
      ctx.fillStyle = s.c;
      ctx.globalAlpha = a;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
  }

  function drawCar() {
    if (!car) return;
    const s = worldToScreen(car.x, car.y);
    const driftTilt = car.drift * 0.45 * (holding ? 1 : 0.4);

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(car.ang + Math.PI / 2 + driftTilt);

    // shadow
    ctx.fillStyle = "rgba(60,40,70,0.22)";
    ctx.beginPath();
    ctx.ellipse(2, 6, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // boost glow
    if (driftBoost > 0.2) {
      ctx.fillStyle = `rgba(125,255,194,${0.25 * driftBoost})`;
      ctx.beginPath();
      ctx.ellipse(0, 10, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // body
    const body = ctx.createLinearGradient(-14, -18, 14, 18);
    body.addColorStop(0, "#fff0a8");
    body.addColorStop(0.5, "#ffd24a");
    body.addColorStop(1, "#ff9f2e");
    ctx.fillStyle = body;
    roundRect(-13, -18, 26, 34, 10);
    ctx.fill();

    // roof / chick belly
    ctx.fillStyle = "#ffe9a0";
    roundRect(-9, -6, 18, 14, 7);
    ctx.fill();

    // chick face
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.arc(0, -10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3d2a45";
    ctx.beginPath();
    ctx.arc(-3.2, -11, 1.6, 0, Math.PI * 2);
    ctx.arc(3.2, -11, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff7a3a";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(4, -6.5);
    ctx.lineTo(0, -5);
    ctx.closePath();
    ctx.fill();

    // wheels
    ctx.fillStyle = "#3d2a45";
    roundRect(-15, -12, 5, 10, 2);
    roundRect(10, -12, 5, 10, 2);
    roundRect(-15, 6, 5, 10, 2);
    roundRect(10, 6, 5, 10, 2);

    // drift spark under rear
    if (car.drift > 0.3 && holding) {
      ctx.fillStyle = "rgba(255,246,168,0.85)";
      ctx.fillRect(-3, 14, 6, 3);
    }

    ctx.restore();
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

  function drawHoldCue() {
    if (state !== "play" || !holding) return;
    ctx.fillStyle = "rgba(255,79,139,0.12)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,79,139,0.85)";
    ctx.font = '700 14px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("DRIFT!", W / 2, 64);
  }

  function render() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawBackground();
    drawTrack();
    drawSmoke();
    drawSparks();
    drawCar();
    drawHoldCue();
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    update(dt);
    render();
    if (state === "play" || shake > 0) raf = requestAnimationFrame(loop);
  }

  // input
  function onDown(e) {
    if (e && e.cancelable) e.preventDefault();
    setHold(true);
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
      setHold(true);
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

  // idle preview render
  resetRun();
  cam = { x: car.x, y: car.y };
  render();
})();
