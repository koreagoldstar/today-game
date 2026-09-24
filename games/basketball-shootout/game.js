(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GRAVITY = 1280;
  const FLOOR = 582;
  const START = { x: 96, y: 478, r: 16 };
  const HOOP = { x: 300, y: 250, open: 32 };
  const HOOP_SRC = { w: 864, h: 1152, rimX: 252, rimY: 468, inner: 188 };
  const PULL_MIN = 22;
  const PULL_MAX = 168;
  const VX_K = 5.15;
  const VY_K = 7.35;
  const MAX_SPEED = 980;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const raw = { idle: new Image(), shoot: new Image(), court: new Image(), hoop: new Image() };
  raw.idle.src = "assets/player.png?v=6";
  raw.shoot.src = "assets/player-shoot.png?v=6";
  raw.court.src = "assets/court.png?v=7";
  raw.hoop.src = "assets/hoop.png?v=1";
  const spr = { idle: null, shoot: null, hoop: null };

  function hoopLayout() {
    const s = (HOOP.open * 2.08) / HOOP_SRC.inner;
    return {
      x: HOOP.x - HOOP_SRC.rimX * s,
      y: HOOP.y - HOOP_SRC.rimY * s,
      w: HOOP_SRC.w * s,
      h: HOOP_SRC.h * s,
      s,
    };
  }

  function boardBox() {
    return {
      x: HOOP.x + HOOP.open * 0.78,
      y: HOOP.y - 90,
      w: 12,
      h: 120,
    };
  }

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
  let shootPose = 0;

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
      const sp = rand(50, 220);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: rand(0.4, 0.85), max: 0.85, color, r: rand(2, 4.2),
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
    shootPose = 0;
    ui.coach.textContent = "공을 잡고 당겨 각도를 맞추세요";
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

  function aimLaunch() {
    const dx = START.x - drag.x;
    const dy = START.y - drag.y;
    const dist = Math.hypot(dx, dy);
    const power = clamp(dist, PULL_MIN, PULL_MAX);
    if (dist < 1) return { vx: 0, vy: 0, dist: 0, power: 0, angle: 0 };
    let angle = Math.atan2(dy, dx);
    angle = clamp(angle, -Math.PI * 0.72, -0.18);
    let vx = Math.cos(angle) * power * VX_K;
    let vy = Math.sin(angle) * power * VY_K;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_SPEED) {
      vx *= MAX_SPEED / speed;
      vy *= MAX_SPEED / speed;
    }
    return { vx, vy, dist, power, angle };
  }

  function predictPath(vx, vy, steps = 28) {
    const pts = [];
    let x = START.x;
    let y = START.y;
    const dt = 0.032;
    for (let i = 0; i < steps; i++) {
      vy += GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      pts.push({ x, y });
      if (y > FLOOR + 20 || x > W + 40) break;
    }
    return pts;
  }

  function launch() {
    const aim = aimLaunch();
    if (aim.dist < PULL_MIN) return;
    ball.flying = true;
    ball.scored = false;
    ball.rim = false;
    ball.board = false;
    ball.age = 0;
    ball.trail = [{ x: START.x, y: START.y }];
    ball.vx = aim.vx;
    ball.vy = aim.vy;
    ball.spin = 10 + aim.power * 0.08;
    attempts += 1;
    dragging = false;
    shootPose = 1;
    tone(240, 0.06, "triangle", 0.05);
    tone(380, 0.05, "sine", 0.03, 0.02);
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
      ball.vx = (ball.vx - 1.55 * vn * nx) * 0.64;
      ball.vy = (ball.vy - 1.55 * vn * ny) * 0.64;
    }
    return true;
  }

  function physics(dt) {
    if (!ball.flying) return;
    ball.age += dt;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.spin += dt * 12;
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 36) ball.trail.shift();

    const front = { x: HOOP.x - HOOP.open * 0.88, y: HOOP.y + 1 };
    const back = { x: HOOP.x + HOOP.open * 0.88, y: HOOP.y + 1 };
    if (bounceCircle(front.x, front.y, 5.2) || bounceCircle(back.x, back.y, 5.2)) {
      ball.rim = true;
      tone(180, 0.05, "square", 0.03);
    }

    const board = boardBox();
    if (
      ball.x + ball.r > board.x &&
      ball.x - ball.r < board.x + board.w &&
      ball.y + ball.r > board.y &&
      ball.y - ball.r < board.y + board.h
    ) {
      ball.x = board.x - ball.r;
      if (ball.vx > 0) {
        ball.vx *= -0.38;
        ball.vy *= 0.84;
        ball.board = true;
        tone(140, 0.05, "sawtooth", 0.03);
      }
    }

    if (
      !ball.scored &&
      ball.vy > 30 &&
      ball.x > HOOP.x - HOOP.open * 0.72 &&
      ball.x < HOOP.x + HOOP.open * 0.72 &&
      ball.y > HOOP.y - 2 &&
      ball.y < HOOP.y + 22
    ) {
      ball.scored = true;
      ball.vx *= 0.28;
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
      burst(HOOP.x, HOOP.y + 12, swish ? "#ffd84c" : "#ff8c42", swish ? 24 : 14);
      tone(swish ? 980 : 620, 0.1, "sine", 0.07);
      if (swish) tone(1320, 0.12, "sine", 0.05, 0.06);
      ui.coach.textContent = streak >= 3 ? `${streak}연속!` : swish ? "깨끗한 스와이시!" : "나이스 샷!";
      updateHUD();
    }

    if (ball.y + ball.r >= FLOOR && ball.vy > 0) {
      ball.y = FLOOR - ball.r;
      ball.vy *= -0.32;
      ball.vx *= 0.72;
      if (Math.abs(ball.vy) < 90) ball.vy = 0;
    }

    if (ball.y > H + 40 || ball.x < -80 || ball.x > W + 80 || ball.age > 3.6 || (!ball.vy && ball.y >= FLOOR - ball.r - 1 && ball.age > 0.7)) {
      if (!ball.scored) {
        streak = 0;
        say("MISS", "#ff6b3d");
        tone(140, 0.12, "sawtooth", 0.04);
        ui.coach.textContent = "각도를 더 높여 포물선을 그려보세요";
        updateHUD();
      }
      ball = resetBall();
      shootPose = 0;
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
    shootPose = Math.max(0, shootPose - dt * 0.85);
    netWobble = Math.max(0, netWobble - dt * 2.2);
    shake = Math.max(0, shake - dt * 20);
    if (pop) {
      pop.t += dt;
      if (pop.t > 0.85) pop = null;
    }
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
    });
    particles = particles.filter((p) => p.life > 0);
    acc += dt;
    if (acc > 0.2) {
      acc = 0;
      updateHUD();
    }
  }

  function coverImage(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return true;
  }

  function drawCourt() {
    if (!(raw.court.complete && raw.court.naturalWidth && coverImage(raw.court))) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#2a140c");
      g.addColorStop(0.45, "#7a3d18");
      g.addColorStop(1, "#c98442");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const fade = ctx.createLinearGradient(0, 430, 0, H);
    fade.addColorStop(0, "rgba(80, 36, 12, 0)");
    fade.addColorStop(0.55, "rgba(92, 42, 16, 0.18)");
    fade.addColorStop(1, "rgba(62, 26, 10, 0.35)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 430, W, H - 430);
    ctx.fillStyle = "rgba(255,220,170,.08)";
    ctx.fillRect(0, FLOOR, W, 2);
  }

  function drawHoopSprite() {
    const img = spr.hoop;
    if (!img) return;
    const L = hoopLayout();
    ctx.drawImage(img, L.x, L.y, L.w, L.h);
    const poleX = L.x + 690 * L.s;
    const poleTop = Math.min(L.y + L.h - 8, FLOOR - 8);
    if (poleTop < FLOOR) {
      const pw = Math.max(14, 36 * L.s);
      ctx.fillStyle = "#8e97a1";
      ctx.fillRect(poleX - pw / 2, poleTop, pw, FLOOR - poleTop + 2);
      ctx.fillStyle = "#7d868f";
      ctx.fillRect(poleX - pw * 0.9, FLOOR - 7, pw * 1.8, 8);
    }
  }

  function drawHoopFront() {
    const wob = Math.sin(performance.now() / 45) * netWobble * 6;
    ctx.strokeStyle = "rgba(255,255,255,.88)";
    ctx.lineWidth = 1.35;
    for (let i = -3; i <= 3; i++) {
      const x0 = HOOP.x + i * 5.4;
      ctx.beginPath();
      ctx.moveTo(x0, HOOP.y + 6);
      ctx.quadraticCurveTo(x0 + wob, HOOP.y + 26, HOOP.x + i * 2.8, HOOP.y + 48);
      ctx.stroke();
    }
  }

  function drawAim() {
    if (!dragging || ball.flying) return;
    const aim = aimLaunch();
    if (aim.dist < 10) return;
    const pts = predictPath(aim.vx, aim.vy, 32);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255, 216, 76, 0.22)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(START.x, START.y);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.setLineDash([7, 8]);
    ctx.strokeStyle = "rgba(255, 248, 210, 0.92)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(START.x, START.y);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach((p, i) => {
      if (i % 3) return;
      const t = i / Math.max(1, pts.length - 1);
      ctx.fillStyle = `rgba(255,216,76,${0.85 - t * 0.55})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.1 - t * 1.2, 0, Math.PI * 2);
      ctx.fill();
    });
    const lastPt = pts[Math.min(pts.length - 1, 18)];
    if (lastPt) {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const deg = Math.round((-aim.angle * 180) / Math.PI);
    const pwr = Math.round((aim.power / PULL_MAX) * 100);
    ctx.font = "800 13px Jua, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(20,8,4,.55)";
    ctx.fillText(`각도 ${deg}°  세기 ${pwr}`, 16, FLOOR + 28);
    ctx.fillStyle = "#ffe7b0";
    ctx.fillText(`각도 ${deg}°  세기 ${pwr}`, 15, FLOOR + 27);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(START.x, START.y);
    ctx.lineTo(drag.x, drag.y);
    ctx.stroke();
  }

  function drawBall() {
    if (!ball.flying && !dragging) return;
    const bx = ball.flying ? ball.x : drag.x;
    const by = ball.flying ? ball.y : drag.y;
    if (ball.trail.length > 1) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255, 150, 70, 0.22)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
      ball.trail.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 210, 120, 0.7)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
      ball.trail.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.restore();
    }

    const shadowY = FLOOR + 2;
    const air = clamp((FLOOR - by) / 280, 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.28 - air * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(bx, shadowY, 16 + air * 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ball.spin * 0.16);
    const grd = ctx.createRadialGradient(-5, -6, 3, 0, 0, ball.r);
    grd.addColorStop(0, "#ffc07a");
    grd.addColorStop(0.55, "#ff8a32");
    grd.addColorStop(1, "#c94a10");
    ctx.fillStyle = grd;
    ctx.shadowColor = "rgba(255,140,40,.35)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#6b2e0c";
    ctx.lineWidth = 1.5;
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
    const shooting = ball.flying || shootPose > 0;
    const img = shooting ? (spr.shoot || spr.idle) : spr.idle;
    if (!img) return;
    const bob = shooting ? -14 * Math.min(1, shootPose + (ball.flying ? 0.4 : 0)) : Math.sin(performance.now() / 380) * 3;
    const pw = 168;
    const ph = 192;
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(START.x - 4, FLOOR + 3, 38, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, START.x - 88, FLOOR - ph + 8 + bob, pw, ph);
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
      ctx.save();
      ctx.globalAlpha = 1 - pop.t / 0.85;
      ctx.fillStyle = pop.color;
      ctx.font = '700 30px "Bagel Fat One", Jua, sans-serif';
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 10;
      ctx.fillText(pop.text, HOOP.x - 8, HOOP.y - 58 - pop.t * 36);
      ctx.restore();
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawCourt();
    drawHoopSprite();
    drawPlayer();
    drawAim();
    drawBall();
    drawHoopFront();
    drawFx();
    ctx.restore();
  }

  function pos(e) {
    const box = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - box.left) * (W / box.width),
      y: (e.clientY - box.top) * (H / box.height),
    };
  }

  function onDown(e) {
    if (!running || ball.flying || paused) return;
    const p = pos(e);
    if (p.x < 250 && p.y > 300) {
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
    tryPunch("hoop", raw.hoop);
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
  if (/[?&]play=1\b/.test(location.search)) startGame();
  requestAnimationFrame(loop);
})();
