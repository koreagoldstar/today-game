(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GRAVITY = 1180;
  const HOOP = { x: 195, y: 198, rim: 38 };
  const START = { x: 195, y: 508, r: 16 };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const raw = { idle: new Image(), shoot: new Image() };
  raw.idle.src = "assets/player.png";
  raw.shoot.src = "assets/player-shoot.png";
  const spr = { idle: null, shoot: null };

  const ui = {
    title: document.getElementById("title"),
    over: document.getElementById("game-over"),
    coach: document.getElementById("coach"),
    time: document.getElementById("hud-time"),
    score: document.getElementById("hud-score"),
    streak: document.getElementById("hud-streak"),
    overTitle: document.getElementById("over-title"),
    overDetail: document.getElementById("over-detail"),
    made: document.getElementById("final-made"),
    att: document.getElementById("final-att"),
    bestStreakEl: document.getElementById("final-streak"),
  };

  let running = false;
  let timeLeft = 60;
  let score = 0;
  let made = 0;
  let attempts = 0;
  let streak = 0;
  let bestStreak = 0;
  let swishCount = 0;
  let ball = resetBall();
  let dragging = false;
  let drag = { x: START.x, y: START.y };
  let netWobble = 0;
  let particles = [];
  let pop = null;
  let shake = 0;
  let last = 0;
  let paused = false;
  let audioCtx = null;
  let acc = 0;

  function resetBall() {
    return {
      x: START.x,
      y: START.y,
      vx: 0,
      vy: 0,
      r: START.r,
      flying: false,
      scored: false,
      rim: false,
      board: false,
      spin: 0,
      trail: [],
      age: 0,
    };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    if (r > 220 && g < 40 && b > 220) return true;
    if (r > 185 && b > 175 && g < 145 && r + b > g * 2.1) return true;
    if (r > 210 && b > 200 && g < 160 && Math.abs(r - b) < 90) return true;
    if (r > 220 && g > 160 && b > 190 && r > g + 20 && b > g + 10 && (r + g + b) / 3 > 195) return true;
    if (r > 230 && g > 190 && b > 210 && Math.abs(r - b) < 50) return true;
    if (r > 235 && g > 210 && b > 225) return true;
    return false;
  }

  function punchBg(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) d[i + 3] = 0;
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function tryPunch(key, img) {
    if (spr[key] || !img.complete || !img.naturalWidth) return;
    spr[key] = punchBg(img);
    if (key === "idle") {
      const hero = document.querySelector(".title-hero");
      if (hero) hero.src = spr[key].toDataURL();
    }
  }

  function showOnly(name) {
    ui.title.classList.toggle("hidden", name !== "title");
    ui.over.classList.toggle("hidden", name !== "over");
  }

  function tone(freq, duration, type = "sine", volume = 0.05, delay = 0) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const start = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration);
    } catch {
      /* optional */
    }
  }

  function updateHUD() {
    ui.time.textContent = String(Math.max(0, Math.ceil(timeLeft)));
    ui.score.textContent = String(score);
    ui.streak.textContent = String(streak);
  }

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(50, 200);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: rand(0.4, 0.8), max: 0.8, color, r: rand(2, 4),
      });
    }
  }

  function say(text, color) {
    pop = { text, color, t: 0 };
  }

  function startGame() {
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* */ }
    running = true;
    timeLeft = 60;
    score = 0;
    made = 0;
    attempts = 0;
    streak = 0;
    bestStreak = 0;
    swishCount = 0;
    ball = resetBall();
    dragging = false;
    particles = [];
    pop = null;
    ui.coach.textContent = "공을 당겨서 놓고 슛!";
    updateHUD();
    showOnly(null);
  }

  function endGame() {
    running = false;
    dragging = false;
    const pct = attempts ? Math.round((made / attempts) * 100) : 0;
    ui.overTitle.textContent = score >= 40 ? "슈팅 머신!" : score >= 22 ? "좋은 손맛!" : "다시 던져봐요!";
    ui.overDetail.innerHTML = `점수 <b>${score}</b> · 성공률 ${pct}%`;
    ui.made.textContent = String(made);
    ui.att.textContent = String(attempts);
    ui.bestStreakEl.textContent = String(bestStreak);
    showOnly("over");
    if (window.TodayGameRank) {
      window.TodayGameRank.open(score, { label: `${score}점 · ${made}/${attempts}` });
    }
  }

  function aimVec() {
    const dx = START.x - drag.x;
    const dy = START.y - drag.y;
    const dist = Math.hypot(dx, dy);
    return { dx, dy, dist };
  }

  function launch() {
    const { dx, dy, dist } = aimVec();
    if (dist < 12) return;
    const power = clamp(dist, 20, 150);
    const nx = dx / dist;
    const ny = dy / dist;
    ball.flying = true;
    ball.scored = false;
    ball.rim = false;
    ball.board = false;
    ball.age = 0;
    ball.trail = [];
    ball.vx = nx * power * 7.2;
    ball.vy = ny * power * 8.4;
    ball.spin = nx * 14;
    attempts += 1;
    dragging = false;
    tone(240, 0.06, "triangle", 0.05);
  }

  function bounceCircle(cx, cy, cr) {
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy) || 0.001;
    const min = ball.r + cr;
    if (dist >= min) return false;
    const nx = dx / dist;
    const ny = dy / dist;
    ball.x = cx + nx * min;
    ball.y = cy + ny * min;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx = (ball.vx - 1.55 * vn * nx) * 0.62;
      ball.vy = (ball.vy - 1.55 * vn * ny) * 0.62;
    }
    return true;
  }

  function physics(dt) {
    if (!ball.flying) return;
    ball.age += dt;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.spin += dt * 10;
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 12) ball.trail.shift();

    const left = { x: HOOP.x - HOOP.rim, y: HOOP.y };
    const right = { x: HOOP.x + HOOP.rim, y: HOOP.y };
    if (bounceCircle(left.x, left.y, 5) || bounceCircle(right.x, right.y, 5)) {
      ball.rim = true;
      tone(180, 0.05, "square", 0.03);
    }

    const boardY = HOOP.y - 46;
    const boardL = HOOP.x - 52;
    const boardR = HOOP.x + 52;
    if (ball.y - ball.r < boardY && ball.y + ball.r > boardY - 8 && ball.x > boardL && ball.x < boardR && ball.vy < 0) {
      ball.y = boardY + ball.r;
      ball.vy *= -0.42;
      ball.vx *= 0.82;
      ball.board = true;
      tone(140, 0.05, "sawtooth", 0.03);
    }

    if (!ball.scored && ball.vy > 20 && Math.abs(ball.x - HOOP.x) < HOOP.rim - 6 && Math.abs(ball.y - HOOP.y) < 14) {
      ball.scored = true;
      const swish = !ball.rim && !ball.board;
      const extra = streak >= 2 ? 1 : 0;
      const pts = (swish ? 3 : 2) + extra;
      score += pts;
      made += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      if (swish) swishCount += 1;
      netWobble = 1;
      shake = swish ? 7 : 4;
      say(swish ? `SWISH +${pts}` : `GOAL +${pts}`, swish ? "#ffd84c" : "#7dffb0");
      burst(HOOP.x, HOOP.y + 10, swish ? "#ffd84c" : "#ff8c42", swish ? 22 : 12);
      tone(swish ? 980 : 620, 0.1, "sine", 0.07);
      if (swish) tone(1320, 0.12, "sine", 0.05, 0.06);
      ui.coach.textContent = streak >= 3 ? `${streak}연속!` : swish ? "깨끗한 스와이시!" : "나이스 샷!";
      updateHUD();
    }

    if (ball.y > H + 50 || ball.x < -60 || ball.x > W + 60 || ball.age > 3.4) {
      if (!ball.scored) {
        streak = 0;
        say("MISS", "#ff6b3d");
        tone(140, 0.12, "sawtooth", 0.04);
        ui.coach.textContent = "각도나 세기를 조금만 바꿔봐요";
        updateHUD();
      }
      ball = resetBall();
    }
  }

  function update(dt) {
    if (paused || !running) {
      netWobble = Math.max(0, netWobble - dt * 2);
      return;
    }
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame();
    }
    physics(dt);
    netWobble = Math.max(0, netWobble - dt * 2.2);
    shake = Math.max(0, shake - dt * 20);
    if (pop) {
      pop.t += dt;
      if (pop.t > 0.8) pop = null;
    }
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
    });
    particles = particles.filter((p) => p.life > 0);
    acc += dt;
    if (acc > 0.2) {
      acc = 0;
      updateHUD();
    }
  }

  function drawCourt() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4a2414");
    g.addColorStop(0.18, "#c98442");
    g.addColorStop(1, "#a86228");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? "#fff" : "#000";
      ctx.fillRect(0, 120 + i * 42, W, 42);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,.62)";
    ctx.lineWidth = 3;
    ctx.strokeRect(72, HOOP.y + 16, 246, 318);
    ctx.beginPath();
    ctx.arc(195, HOOP.y + 334, 80, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(72, HOOP.y + 16);
    ctx.lineTo(318, HOOP.y + 16);
    ctx.stroke();
  }

  function drawHoop() {
    ctx.fillStyle = "#2a1a12";
    ctx.fillRect(HOOP.x - 7, HOOP.y - 70, 14, 78);
    ctx.fillStyle = "#f3f1ea";
    ctx.fillRect(HOOP.x - 58, HOOP.y - 78, 116, 42);
    ctx.strokeStyle = "#d0cdc4";
    ctx.lineWidth = 2;
    ctx.strokeRect(HOOP.x - 58, HOOP.y - 78, 116, 42);
    ctx.strokeStyle = "#e24b5a";
    ctx.lineWidth = 5;
    ctx.strokeRect(HOOP.x - 28, HOOP.y - 68, 56, 24);

    ctx.strokeStyle = "#ff4d3a";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(HOOP.x, HOOP.y, HOOP.rim, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(HOOP.x, HOOP.y, HOOP.rim - 3, 5, 0, Math.PI, 0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 1.5;
    const wob = Math.sin(performance.now() / 50) * netWobble * 5;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(HOOP.x + i * (HOOP.rim / 5.2), HOOP.y + 4);
      ctx.quadraticCurveTo(HOOP.x + i * 5 + wob, HOOP.y + 22, HOOP.x + i * 3.5, HOOP.y + 40);
      ctx.stroke();
    }
  }

  function drawAim() {
    if (!dragging || ball.flying) return;
    const { dx, dy, dist } = aimVec();
    if (dist < 8) return;
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = "rgba(255,255,255,.7)";
    ctx.lineWidth = 2.5;
    let x = START.x;
    let y = START.y;
    let vx = (dx / dist) * clamp(dist, 20, 150) * 7.2;
    let vy = (dy / dist) * clamp(dist, 20, 150) * 8.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 16; i++) {
      vy += GRAVITY * 0.03;
      x += vx * 0.03;
      y += vy * 0.03;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawBall() {
    ball.trail.forEach((p, i) => {
      ctx.globalAlpha = (i / ball.trail.length) * 0.35;
      ctx.fillStyle = "#ff8c42";
      ctx.beginPath();
      ctx.arc(p.x, p.y, ball.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.spin * 0.15);
    const grd = ctx.createRadialGradient(-5, -6, 3, 0, 0, ball.r);
    grd.addColorStop(0, "#ffb06a");
    grd.addColorStop(1, "#d65a18");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6b2e0c";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, ball.r * 0.72, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-ball.r, 0);
    ctx.lineTo(ball.r, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const img = ball.flying ? spr.shoot : spr.idle;
    if (!img) return;
    const bob = ball.flying ? -10 : Math.sin(performance.now() / 380) * 3;
    ctx.drawImage(img, START.x - 52, START.y + 8 + bob, 104, 118);
  }

  function drawFx() {
    particles.forEach((p) => {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (pop) {
      ctx.globalAlpha = 1 - pop.t / 0.8;
      ctx.fillStyle = pop.color;
      ctx.font = '700 28px "Bagel Fat One", Jua, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(pop.text, HOOP.x, HOOP.y - 70 - pop.t * 30);
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawCourt();
    drawHoop();
    drawAim();
    if (!ball.flying) drawPlayer();
    drawBall();
    if (ball.flying) drawPlayer();
    drawFx();
    ctx.restore();
  }

  function pos(e) {
    const box = canvas.getBoundingClientRect();
    const sx = W / box.width;
    const sy = H / box.height;
    return { x: (e.clientX - box.left) * sx, y: (e.clientY - box.top) * sy };
  }

  function onDown(e) {
    if (!running || ball.flying || paused) return;
    const p = pos(e);
    if (Math.hypot(p.x - ball.x, p.y - ball.y) < 64) {
      dragging = true;
      drag = p;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
    }
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    drag = pos(e);
    e.preventDefault();
  }

  function onUp(e) {
    if (!dragging) return;
    drag = pos(e);
    launch();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    tryPunch("idle", raw.idle);
    tryPunch("shoot", raw.shoot);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => running,
      isPaused: () => paused,
      pause() { paused = true; return true; },
      resume() { paused = false; last = performance.now(); return true; },
    });
  }
  if (window.TodayGameRank) {
    window.TodayGameRank.mount({
      gameId: "basketball-shootout",
      gameTitle: "농구 슛아웃",
      formParent: ui.over,
    });
  }
  showOnly("title");
  requestAnimationFrame(loop);
})();
