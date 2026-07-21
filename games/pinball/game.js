(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BALL_R = 10;
  const GRAVITY = 0.22;
  const FRICTION = 0.999;
  const WALL_REST = 0.88;
  const MAX_SPEED = 22;
  const BEST_KEY = "today-pinball-best";
  const TOTAL_STAGES = 50;
  const START_BALLS = 3;

  const STAGE_NAMES = [
    "네온 입문",
    "범퍼 스톰",
    "플립퍼 레슨",
    "크롬 레인",
    "하이 볼트",
    "라이트 쇼",
    "스피드 볼",
    "마스터 레인",
    "아케이드 나이트",
    "핀볼 레전드",
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
    // 초반이 빨리 안 끝나게: 1판 14000부터, 이후 가파르게
    goal: 14000 + i * 4500,
    bumperBoost: 0.9 + i * 0.035,
    gravity: GRAVITY + 0.035 + i * 0.012,
  }));

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  /** @type {{ball:HTMLImageElement|null,flipper:HTMLImageElement|null,bumper:HTMLImageElement|null,post:HTMLImageElement|null}} */
  const sprites = { ball: null, flipper: null, bumper: null, post: null };

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [ballImg, flipImg, bumpImg, postImg] = await Promise.all([
      loadImg("assets/ball.png"),
      loadImg("assets/flipper.png"),
      loadImg("assets/bumper.png"),
      loadImg("assets/post.png"),
    ]);
    // soft punch leftover studio edges if any
    const punch = (img) => {
      if (!img) return null;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const data = x.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (r > 200 && b > 200 && g < 120) d[i + 3] = 0;
      }
      x.putImageData(data, 0, 0);
      return c;
    };
    sprites.ball = punch(ballImg) || ballImg;
    sprites.flipper = punch(flipImg) || flipImg;
    sprites.bumper = punch(bumpImg) || bumpImg;
    sprites.post = punch(postImg) || postImg;
  }

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const el = {
    stage: document.getElementById("hud-stage"),
    score: document.getElementById("hud-score"),
    goal: document.getElementById("hud-goal"),
    lives: document.getElementById("hud-lives"),
    goalFill: document.getElementById("goal-fill"),
    comboBar: document.getElementById("combo-bar"),
    combo: document.getElementById("hud-combo"),
    touchHint: document.getElementById("touch-hint"),
    clearDetail: document.getElementById("clear-detail"),
    overDetail: document.getElementById("over-detail"),
    allDetail: document.getElementById("all-detail"),
  };

  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let runStartedAt = 0;
  let stageStartedAt = 0;
  let stageScore = 0;
  let ballsLeft = START_BALLS;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let combo = 0;
  let comboTimer = 0;
  let particles = [];
  let floats = [];
  let lights = [];
  let screenShake = 0;
  let tablePulse = 0;
  let last = 0;

  /** @type {{x:number,y:number,vx:number,vy:number,inLane:boolean,launched:boolean}|null} */
  let ball = null;

  const keys = { left: false, right: false, plunger: false };
  let plungerPower = 0;
  let plungerHeld = false;
  let touchLeft = false;
  let touchRight = false;
  let touchPlunger = false;

  const FLIP_LEN = 72;
  const FLIP_THICK = 14;

  // Rest: tips point down toward drain. Active: sweep UP toward playfield.
  const leftFlip = {
    cx: 95,
    cy: 585,
    rest: 0.55,
    active: -0.72,
    angle: 0.55,
    vel: 0,
    power: 0,
    side: "L",
  };
  const rightFlip = {
    cx: 265,
    cy: 585,
    rest: Math.PI - 0.55,
    active: Math.PI + 0.72,
    angle: Math.PI - 0.55,
    vel: 0,
    power: 0,
    side: "R",
  };

  const walls = [];
  const bumpers = [];
  const posts = [];

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function norm(x, y) {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  }

  function dot(ax, ay, bx, by) {
    return ax * bx + ay * by;
  }

  function flipEnd(f) {
    return {
      x: f.cx + Math.cos(f.angle) * FLIP_LEN,
      y: f.cy + Math.sin(f.angle) * FLIP_LEN,
    };
  }

  function buildTable() {
    walls.length = 0;
    bumpers.length = 0;
    posts.length = 0;
    lights.length = 0;

    const L = 26;
    const R = 334;
    const top = 92;

    // Outer rails
    walls.push([L, 150, L, 540]);
    walls.push([R, 150, R, 420]);
    walls.push([L, 150, 78, top]);
    walls.push([78, top, 312, top]);
    walls.push([312, top, R, 150]);

    // Lower rails into flippers
    walls.push([L, 540, 78, 610]);
    walls.push([R, 420, R, 500]);
    walls.push([R, 500, 282, 610]);

    // Sling guides
    walls.push([48, 470, 88, 555]);
    walls.push([312, 455, 272, 555]);

    // Launch lane
    walls.push([350, 110, 350, 640]);
    walls.push([376, 110, 376, 655]);
    walls.push([350, 110, 376, 110]);
    walls.push([R, 150, 350, 118]);
    walls.push([312, top, 350, 118]);

    // Center gate (narrow gap above drain)
    walls.push([155, 530, 180, 548]);
    walls.push([180, 548, 205, 530]);

    [
      { x: 140, y: 215, r: 24, score: 45, color: "#ff3d2e" },
      { x: 250, y: 215, r: 24, score: 45, color: "#ff5a1a" },
      { x: 195, y: 295, r: 28, score: 70, color: "#ff8a00" },
      { x: 95, y: 355, r: 17, score: 30, color: "#00e5ff" },
      { x: 295, y: 355, r: 17, score: 30, color: "#00b8ff" },
    ].forEach((b) => bumpers.push({ ...b, lit: 0, cooldown: 0 }));

    [
      [78, 195, 9],
      [312, 195, 9],
      [195, 165, 11],
      [115, 455, 10],
      [245, 455, 10],
    ].forEach(([x, y, r]) => posts.push({ x, y, r, lit: 0 }));

    for (let i = 0; i < 10; i++) {
      lights.push({ x: 70 + i * 26, y: 112, phase: i * 0.55 });
    }
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((o) => o.classList.add("hidden"));
    if (name && overlays[name]) overlays[name].classList.remove("hidden");
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    el.stage.textContent = String(stageIndex + 1);
    el.score.textContent = String(score);
    el.goal.textContent = String(st.goal);
    el.goalFill.style.width = `${clamp((stageScore / st.goal) * 100, 0, 100)}%`;
    el.lives.innerHTML = "";
    for (let i = 0; i < START_BALLS; i++) {
      const d = document.createElement("div");
      d.className = "life" + (i < ballsLeft ? "" : " empty");
      el.lives.appendChild(d);
    }
    if (combo >= 2) {
      el.comboBar.classList.remove("hidden");
      el.combo.textContent = String(combo);
    } else {
      el.comboBar.classList.add("hidden");
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.85, vy: -34 });
  }

  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4.5;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.2,
        life: 0.35 + Math.random() * 0.4,
        color,
        r: 1.5 + Math.random() * 2.8,
      });
    }
  }

  function addScore(base, x, y) {
    // 콤보 배율 상한 3배 — 초반 한 번에 클리어 방지
    const mult = Math.min(3, Math.max(1, combo));
    const gain = Math.round(base * mult);
    score += gain;
    stageScore += gain;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    addFloat(x, y - 14, mult > 1 ? `+${gain}×${mult}` : `+${gain}`, "#e8ffff");
    updateHud();
    if (stageScore >= STAGES[stageIndex].goal && state === "playing") stageClear();
  }

  function bumpCombo() {
    combo += 1;
    comboTimer = 0.85;
    updateHud();
  }

  function spawnBallInLane() {
    ball = { x: 363, y: 575, vx: 0, vy: 0, inLane: true, launched: false };
    plungerPower = 0;
    plungerHeld = false;
    combo = 0;
    comboTimer = 0;
    updateHud();
  }

  function startGame(fromScratch) {
    if (fromScratch) {
      stageIndex = 0;
      score = 0;
      runStartedAt = performance.now();
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    stageStartedAt = performance.now();
    stageScore = 0;
    ballsLeft = START_BALLS;
    particles = [];
    floats = [];
    screenShake = 0;
    leftFlip.angle = leftFlip.rest;
    rightFlip.angle = rightFlip.rest;
    leftFlip.power = 0;
    rightFlip.power = 0;
    buildTable();
    spawnBallInLane();
    state = "playing";
    showOverlay(null);
    if (el.touchHint) el.touchHint.classList.remove("hidden");
    updateHud();
  }

  function stageClear() {
    const elapsed = (performance.now() - stageStartedAt) / 1000;
    score += Math.max(0, Math.floor(20 - elapsed)) * 8;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    state = "clear";
    if (el.touchHint) el.touchHint.classList.add("hidden");
    el.clearDetail.textContent = `${STAGES[stageIndex].name} 클리어! 점수 ${score.toLocaleString()}`;
    if (stageIndex >= TOTAL_STAGES - 1) {
      state = "allclear";
      el.allDetail.textContent = `최종 ${score.toLocaleString()} · 최고 ${best.toLocaleString()}`;
      showOverlay("all");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "pinball", gameTitle: "핀볼팡팡", formParent: overlays.all });
      TodayGameRank.open(score);
    }
    } else {
      showOverlay("clear");
    }
  }

  function loseBall() {
    burst(ball ? ball.x : W / 2, H - 50, "#ff4d6d", 18);
    screenShake = 10;
    ball = null;
    ballsLeft -= 1;
    combo = 0;
    updateHud();
    if (ballsLeft <= 0) {
      state = "over";
      if (el.touchHint) el.touchHint.classList.add("hidden");
      el.overDetail.textContent = `점수 ${score.toLocaleString()} · 최고 ${best.toLocaleString()}`;
      showOverlay("over");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "pinball", gameTitle: "핀볼팡팡", formParent: overlays.over });
      TodayGameRank.open(score);
    }
      return;
    }
    setTimeout(() => {
      if (state === "playing") spawnBallInLane();
    }, 450);
  }

  function nextStage() {
    stageIndex += 1;
    stageStartedAt = performance.now();
    stageScore = 0;
    ballsLeft = Math.min(START_BALLS, ballsLeft + 1);
    particles = [];
    floats = [];
    buildTable();
    spawnBallInLane();
    state = "playing";
    showOverlay(null);
    if (el.touchHint) el.touchHint.classList.remove("hidden");
    updateHud();
  }

  function updateFlipper(f, pressed, dt) {
    const prev = f.angle;
    f.power = pressed ? Math.min(1, f.power + dt * 8) : Math.max(0, f.power - dt * 5);
    const target = pressed ? f.active : f.rest;
    const speed = pressed ? 28 : 16;
    const diff = target - f.angle;
    f.angle += clamp(diff, -speed * dt, speed * dt);
    f.vel = (f.angle - prev) / Math.max(dt, 0.0001);
  }

  function collideCircle(cx, cy, cr, bounce, kick) {
    if (!ball) return false;
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    const min = cr + BALL_R;
    if (dist >= min || dist < 1e-4) return false;
    const n = norm(dx, dy);
    const overlap = min - dist + 0.5;
    ball.x += n.x * overlap;
    ball.y += n.y * overlap;
    const vn = dot(ball.vx, ball.vy, n.x, n.y);
    if (vn < 0) {
      ball.vx -= (1 + bounce) * vn * n.x;
      ball.vy -= (1 + bounce) * vn * n.y;
    }
    if (kick > 0) {
      // Bias kick upward so bumpers always pop the ball
      const up = norm(n.x * 0.55, n.y * 0.55 - 0.85);
      ball.vx += up.x * kick;
      ball.vy += up.y * kick;
    }
    return true;
  }

  function collideSegment(x1, y1, x2, y2, bounce = WALL_REST) {
    if (!ball) return false;
    const sx = x2 - x1;
    const sy = y2 - y1;
    const len2 = sx * sx + sy * sy || 1;
    let t = ((ball.x - x1) * sx + (ball.y - y1) * sy) / len2;
    t = clamp(t, 0, 1);
    const px = x1 + sx * t;
    const py = y1 + sy * t;
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist >= BALL_R || dist < 1e-4) return false;
    const n = norm(dx, dy);
    const overlap = BALL_R - dist + 0.4;
    ball.x += n.x * overlap;
    ball.y += n.y * overlap;
    const vn = dot(ball.vx, ball.vy, n.x, n.y);
    if (vn < 0) {
      ball.vx -= (1 + bounce) * vn * n.x;
      ball.vy -= (1 + bounce) * vn * n.y;
    }
    return true;
  }

  function collideFlipper(f) {
    if (!ball) return false;
    const end = flipEnd(f);
    const sx = end.x - f.cx;
    const sy = end.y - f.cy;
    const len2 = sx * sx + sy * sy || 1;
    let t = ((ball.x - f.cx) * sx + (ball.y - f.cy) * sy) / len2;
    t = clamp(t, 0, 1);
    const px = f.cx + sx * t;
    const py = f.cy + sy * t;
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    const thick = FLIP_THICK * 0.55 + BALL_R;
    if (dist >= thick || dist < 1e-4) return false;

    // Prefer contact normal, then force it upward-ish
    let n = norm(dx, dy);
    if (n.y > -0.15) {
      n = norm(n.x * 0.4, n.y - 0.9);
    }

    const overlap = thick - dist + 1;
    ball.x += n.x * overlap;
    ball.y += n.y * overlap;

    // Surface velocity from angular motion (canvas y-down)
    const rx = px - f.cx;
    const ry = py - f.cy;
    const surfVx = -ry * f.vel;
    const surfVy = rx * f.vel;

    const relVx = ball.vx - surfVx;
    const relVy = ball.vy - surfVy;
    const vn = dot(relVx, relVy, n.x, n.y);
    if (vn < 0) {
      ball.vx = surfVx + relVx - (1 + 0.85) * vn * n.x;
      ball.vy = surfVy + relVy - (1 + 0.85) * vn * n.y;
    }

    // Strong launch when flipper is pressed / swinging
    const swinging =
      (f.side === "L" && f.vel < -2) || (f.side === "R" && f.vel > 2) || f.power > 0.15;
    if (swinging) {
      const lever = 0.35 + t * 0.65;
      const kick = (10 + Math.abs(f.vel) * 0.55 + f.power * 8) * lever;
      // Always send ball UP into the table
      const aim = norm(n.x * 0.35 + (f.side === "L" ? 0.35 : -0.35), -1);
      ball.vx += aim.x * kick;
      ball.vy += aim.y * kick;
      // Guarantee upward motion after a hit
      if (ball.vy > -6) ball.vy = -6 - f.power * 8 - Math.abs(f.vel) * 0.2;
      screenShake = Math.max(screenShake, 4);
      burst(px, py, "#00e5ff", 6);
    } else if (ball.vy > 0) {
      // Resting on raised/idle flipper: soft bounce up so it isn't glued
      ball.vy = Math.min(ball.vy, -2.5);
    }

    return true;
  }

  function limitSpeed() {
    if (!ball) return;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAX_SPEED) {
      ball.vx = (ball.vx / sp) * MAX_SPEED;
      ball.vy = (ball.vy / sp) * MAX_SPEED;
    }
  }

  function launchBall() {
    if (!ball || !ball.inLane || ball.launched) return;
    const power = clamp(plungerPower, 0.2, 1);
    ball.vy = -14 - power * 12;
    ball.vx = -0.2;
    ball.launched = true;
    plungerPower = 0;
    plungerHeld = false;
    burst(ball.x, ball.y, "#ffd60a", 10);
  }

  function physics(dt) {
    if (!ball || state !== "playing") return;
    const st = STAGES[stageIndex];
    const steps = Math.min(6, Math.max(2, Math.ceil(dt / 0.006)));
    const h = dt / steps;

    for (let s = 0; s < steps; s++) {
      if (ball.inLane && !ball.launched) {
        ball.y = 575 + plungerPower * 40;
        ball.x = 363;
        ball.vx = 0;
        ball.vy = 0;
        continue;
      }

      ball.vy += st.gravity * h * 60;
      ball.vx *= Math.pow(FRICTION, h * 60);
      ball.vy *= Math.pow(FRICTION, h * 60);
      ball.x += ball.vx * h * 60;
      ball.y += ball.vy * h * 60;

      if (ball.inLane) {
        ball.x = clamp(ball.x, 350 + BALL_R, 376 - BALL_R);
        if (ball.y < 125) {
          ball.inLane = false;
          ball.x = 318;
          ball.y = 135;
          ball.vx = -4.5 - Math.random();
          ball.vy = 0.5;
        }
        for (const w of walls) collideSegment(w[0], w[1], w[2], w[3], 0.75);
        limitSpeed();
        continue;
      }

      for (const w of walls) collideSegment(w[0], w[1], w[2], w[3]);

      for (const p of posts) {
        if (collideCircle(p.x, p.y, p.r, 0.95, 2.2)) {
          p.lit = 0.3;
          addScore(8, p.x, p.y);
          bumpCombo();
          burst(p.x, p.y, "#00e5ff", 6);
        }
      }

      for (const b of bumpers) {
        if (b.cooldown > 0) continue;
        if (collideCircle(b.x, b.y, b.r, 1.05, 9.5 * st.bumperBoost)) {
          b.lit = 0.4;
          b.cooldown = 0.14;
          bumpCombo();
          addScore(b.score, b.x, b.y);
          burst(b.x, b.y, b.color, 16);
          screenShake = Math.max(screenShake, 6);
          tablePulse = 0.3;
        }
      }

      collideFlipper(leftFlip);
      collideFlipper(rightFlip);

      if (ball.x < 18) {
        ball.x = 18;
        ball.vx = Math.abs(ball.vx) * WALL_REST;
      }
      if (ball.x > 340 && ball.y > 140) {
        ball.x = 340;
        ball.vx = -Math.abs(ball.vx) * WALL_REST;
      }
      if (ball.y < 75) {
        ball.y = 75;
        ball.vy = Math.abs(ball.vy) * WALL_REST;
      }

      if (ball.y > H + 30 || (ball.y > 660 && ball.x > 100 && ball.x < 260)) {
        loseBall();
        return;
      }

      limitSpeed();
    }
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function drawNeonLine(x1, y1, x2, y2, color, width) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1.2, width * 0.28);
    ctx.stroke();
    ctx.restore();
  }

  function drawWavyNeon(x0, y0, x1, y1, amp, waves, color, width) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = width;
    ctx.beginPath();
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI * waves) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(232,255,255,0.7)";
    ctx.lineWidth = width * 0.3;
    ctx.stroke();
    ctx.restore();
  }

  function drawBall() {
    if (!ball) return;
    const { x, y } = ball;
    const r = BALL_R;
    ctx.save();
    // premium bloom halo
    const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
    halo.addColorStop(0, "rgba(0,229,255,0.35)");
    halo.addColorStop(0.5, "rgba(255,77,109,0.12)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 22;
    if (sprites.ball) {
      const s = r * 2.55;
      ctx.drawImage(sprites.ball, x - s / 2, y - s / 2, s, s);
    } else {
      const g = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.3, "#c8d0d8");
      g.addColorStop(0.55, "#7ad7ff");
      g.addColorStop(0.75, "#ff6a3d");
      g.addColorStop(1, "#2a3038");
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFlipper(f) {
    ctx.save();
    if (sprites.flipper) {
      const len = FLIP_LEN + 10;
      const thick = FLIP_THICK * 1.55;
      ctx.translate(f.cx, f.cy);
      ctx.rotate(f.angle);
      if (f.side === "R") ctx.scale(1, -1);
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 18;
      ctx.drawImage(sprites.flipper, -6, -thick / 2, len + 8, thick);
      ctx.restore();
      return;
    }

    const end = flipEnd(f);
    ctx.lineCap = "round";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = "#0a1a22";
    ctx.lineWidth = FLIP_THICK + 4;
    ctx.beginPath();
    ctx.moveTo(f.cx, f.cy);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const g = ctx.createLinearGradient(f.cx, f.cy, end.x, end.y);
    g.addColorStop(0, "#f4fbff");
    g.addColorStop(0.45, "#9aa8b4");
    g.addColorStop(1, "#c0c8d0");
    ctx.shadowBlur = 12;
    ctx.strokeStyle = g;
    ctx.lineWidth = FLIP_THICK;
    ctx.beginPath();
    ctx.moveTo(f.cx, f.cy);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.cx, f.cy);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(f.cx, f.cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#e8ffff";
    ctx.fill();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawBumper(b) {
    ctx.save();
    const glow = b.lit > 0 ? 28 : 14;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = glow;
    if (sprites.bumper) {
      const s = b.r * 2.55;
      ctx.globalAlpha = b.lit > 0 ? 1 : 0.92;
      ctx.drawImage(sprites.bumper, b.x - s / 2, b.y - s / 2, s, s);
      if (b.color.startsWith("#00")) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.22 + (b.lit > 0 ? 0.2 : 0);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 1.05, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
    } else {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10,20,28,0.9)";
      ctx.fill();
      const g = ctx.createRadialGradient(b.x - 5, b.y - 6, 2, b.x, b.y, b.r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.25, b.color);
      g.addColorStop(1, "#0a1218");
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = b.color;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = b.lit > 0 ? "#fff" : "rgba(255,255,255,0.55)";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPost(p) {
    ctx.save();
    ctx.shadowColor = p.lit > 0 ? "#ffd60a" : "#00e5ff";
    ctx.shadowBlur = p.lit > 0 ? 16 : 12;
    if (sprites.post) {
      const s = p.r * 2.8;
      ctx.drawImage(sprites.post, p.x - s / 2, p.y - s * 0.55, s, s * 1.15);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.lit > 0 ? "#ffd60a" : "#2a3540";
      ctx.fill();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDrainStarburst(cx, cy, t) {
    ctx.save();
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
    ctx.translate(cx, cy);
    ctx.shadowColor = "#ff5a1a";
    ctx.shadowBlur = 22 * pulse;
    const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, 36);
    rg.addColorStop(0, `rgba(255,180,40,${0.85 * pulse})`);
    rg.addColorStop(0.35, `rgba(255,70,40,${0.45 * pulse})`);
    rg.addColorStop(0.7, `rgba(0,180,255,${0.25 * pulse})`);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = `rgba(0,229,255,${0.35 + 0.35 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.4;
      ctx.strokeStyle = i % 2 ? `rgba(255,90,30,${0.4 * pulse})` : `rgba(0,229,255,${0.35 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTable(t) {
    // Deep noir backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#030508");
    bg.addColorStop(0.45, "#070b12");
    bg.addColorStop(1, "#0a0610");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // subtle hex / circuit etch
    ctx.save();
    ctx.strokeStyle = "rgba(0,229,255,0.035)";
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let x = 0; x < W; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.restore();

    // Playfield plate — dark brushed metal
    const pulse = tablePulse * 0.14;
    const bed = ctx.createLinearGradient(0, 80, 0, 640);
    bed.addColorStop(0, `rgba(16,22,30,${0.98 + pulse})`);
    bed.addColorStop(0.4, "#121820");
    bed.addColorStop(0.75, "#10161e");
    bed.addColorStop(1, "#141018");
    roundRect(ctx, 22, 78, 320, 565, 26);
    ctx.fillStyle = bed;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,229,255,0.45)";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner neon lane guides (cyan top / sides, red lower)
    drawWavyNeon(48, 170, 48, 500, 5, 3.5, "#00e5ff", 3.5);
    drawWavyNeon(318, 170, 318, 430, 5, 3.5, "#00e5ff", 3.5);
    drawWavyNeon(70, 108, 310, 108, 3.5, 4, "#00e5ff", 3);
    drawNeonLine(55, 520, 95, 590, "#ff3d2e", 3.5);
    drawNeonLine(305, 500, 265, 590, "#ff3d2e", 3.5);

    // Marquee — neon sign bar
    roundRect(ctx, 36, 32, 288, 40, 12);
    const marq = ctx.createLinearGradient(36, 32, 324, 72);
    marq.addColorStop(0, "#1a0508");
    marq.addColorStop(0.5, "#061018");
    marq.addColorStop(1, "#1a0508");
    ctx.fillStyle = marq;
    ctx.fill();
    ctx.save();
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 36, 32, 288, 40, 12);
    ctx.stroke();
    ctx.fillStyle = "#e8ffff";
    ctx.font = '700 17px "Bagel Fat One", "Jua", cursive';
    ctx.textAlign = "center";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 12;
    ctx.fillText("NEON PINBALL", W / 2 - 12, 58);
    ctx.restore();

    lights.forEach((l, i) => {
      const on = 0.45 + 0.55 * Math.sin(t * 5 + l.phase);
      const col = i % 3 === 0 ? "#ff3d2e" : i % 3 === 1 ? "#ff8a00" : "#00e5ff";
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 12 * on;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.35 + on * 0.65;
      ctx.fill();
      ctx.restore();
    });

    // Rails — cyan neon
    for (const w of walls) {
      if (w[0] >= 350 && w[2] >= 350) continue;
      const midY = (w[1] + w[3]) / 2;
      const col = midY > 500 ? "#ff4d3a" : "#00e5ff";
      drawNeonLine(w[0], w[1], w[2], w[3], col, 5);
    }

    // Launch lane
    ctx.fillStyle = "rgba(0,229,255,0.07)";
    ctx.fillRect(350, 110, 26, 545);
    ctx.strokeStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.strokeRect(350, 110, 26, 545);
    ctx.shadowBlur = 0;

    // Plunger
    const py = 605 + plungerPower * 40;
    ctx.save();
    ctx.shadowColor = "#ff3d2e";
    ctx.shadowBlur = 14;
    roundRect(ctx, 354, py, 18, 46, 6);
    ctx.fillStyle = "#ff3d2e";
    ctx.fill();
    ctx.restore();
    roundRect(ctx, 356, py + 5, 14, 10, 4);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Drain zone + starburst
    const drain = ctx.createLinearGradient(110, 640, 250, 700);
    drain.addColorStop(0, "rgba(255,61,46,0.04)");
    drain.addColorStop(1, "rgba(255,61,46,0.28)");
    ctx.fillStyle = drain;
    ctx.beginPath();
    ctx.moveTo(95, 640);
    ctx.lineTo(265, 640);
    ctx.lineTo(285, 700);
    ctx.lineTo(75, 700);
    ctx.closePath();
    ctx.fill();
    drawDrainStarburst(180, 655, t);

    posts.forEach(drawPost);
    bumpers.forEach(drawBumper);
    drawFlipper(leftFlip);
    drawFlipper(rightFlip);

    if (ball && ball.inLane && !ball.launched) {
      ctx.fillStyle = "rgba(200,240,255,0.75)";
      ctx.font = '13px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("스페이스 / ↓ 로 발사 · 길게 눌러 파워", W / 2 - 8, 672);

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, 332, 500, 10, 95, 4);
      ctx.fill();
      ctx.fillStyle = "#ff3d2e";
      const ph = plungerPower * 95;
      roundRect(ctx, 332, 595 - ph, 10, ph, 4);
      ctx.fill();
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = clamp(p.life * 2.2, 0, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawFloats(dt) {
    ctx.textAlign = "center";
    ctx.font = '700 14px "Jua", sans-serif';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) {
        floats.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  function tick(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    const t = ts * 0.001;

    updateFlipper(leftFlip, keys.left || touchLeft, dt);
    updateFlipper(rightFlip, keys.right || touchRight, dt);

    if (state === "playing" && ball && ball.inLane && !ball.launched) {
      const holding = keys.plunger || touchPlunger || plungerHeld;
      if (holding) plungerPower = clamp(plungerPower + dt * 1.05, 0, 1);
      else if (plungerPower > 0.1) launchBall();
      else plungerPower = Math.max(0, plungerPower - dt * 2);
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 0;
        updateHud();
      }
    }

    bumpers.forEach((b) => {
      if (b.cooldown > 0) b.cooldown -= dt;
      if (b.lit > 0) b.lit -= dt;
    });
    posts.forEach((p) => {
      if (p.lit > 0) p.lit -= dt;
    });
    if (tablePulse > 0) tablePulse -= dt;
    if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 30);

    physics(dt);

    ctx.save();
    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }
    drawTable(t);
    drawBall();
    drawParticles(dt);
    drawFloats(dt);
    if (state === "playing") {
      ctx.fillStyle = "rgba(0,229,255,0.55)";
      ctx.font = '12px "Jua", sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(STAGES[stageIndex].name, 38, 158);
    }
    ctx.restore();

    requestAnimationFrame(tick);
  }

  function onKey(e, down) {
    const k = e.key.toLowerCase();
    if (k === "z" || k === "arrowleft") {
      keys.left = down;
      e.preventDefault();
    }
    if (k === "x" || k === "arrowright") {
      keys.right = down;
      e.preventDefault();
    }
    if (k === " " || k === "arrowdown" || k === "enter") {
      keys.plunger = down;
      e.preventDefault();
    }
  }

  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    return {
      x: ((src.clientX - rect.left) / rect.width) * W,
      y: ((src.clientY - rect.top) / rect.height) * H,
      id: src.identifier,
    };
  }

  const activeTouches = new Map();

  function classifyTouch(x, y) {
    if (x > 300 && y > 400) return "plunger";
    if (y > 460) {
      if (x < W * 0.42) return "left";
      if (x > W * 0.58) return "right";
    }
    if (x > 325) return "plunger";
    if (x < W * 0.4) return "left";
    if (x > W * 0.6) return "right";
    return null;
  }

  function refreshTouches() {
    touchLeft = false;
    touchRight = false;
    touchPlunger = false;
    activeTouches.forEach((kind) => {
      if (kind === "left") touchLeft = true;
      if (kind === "right") touchRight = true;
      if (kind === "plunger") touchPlunger = true;
    });
  }

  function onPointerDown(e) {
    if (state !== "playing") return;
    e.preventDefault();
    const p = canvasPos(e);
    const kind = classifyTouch(p.x, p.y);
    if (!kind) return;
    const id = e.pointerId != null ? e.pointerId : p.id;
    activeTouches.set(id, kind);
    if (kind === "plunger") plungerHeld = true;
    refreshTouches();
  }

  function onPointerUp(e) {
    const id =
      e.pointerId != null
        ? e.pointerId
        : e.changedTouches && e.changedTouches[0]
          ? e.changedTouches[0].identifier
          : null;
    if (id != null && activeTouches.has(id)) {
      const kind = activeTouches.get(id);
      activeTouches.delete(id);
      if (kind === "plunger") plungerHeld = false;
    } else {
      activeTouches.clear();
      plungerHeld = false;
    }
    refreshTouches();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerUp);

  canvas.addEventListener("mousedown", (e) => {
    if (state !== "playing") return;
    const p = canvasPos(e);
    const kind = classifyTouch(p.x, p.y);
    if (kind === "plunger") {
      plungerHeld = true;
      touchPlunger = true;
    } else if (kind === "left") touchLeft = true;
    else if (kind === "right") touchRight = true;
  });
  window.addEventListener("mouseup", () => {
    plungerHeld = false;
    touchPlunger = false;
    touchLeft = false;
    touchRight = false;
  });

  document.getElementById("start-btn").addEventListener("click", () => startGame(true));
  document.getElementById("retry-btn").addEventListener("click", () => startGame(true));
  document.getElementById("again-btn").addEventListener("click", () => startGame(true));
  document.getElementById("next-btn").addEventListener("click", () => nextStage());

  buildTable();
  showOverlay("title");
  if (el.touchHint) el.touchHint.classList.add("hidden");
  updateHud();
  last = performance.now();

  loadAssets().then(() => {
    requestAnimationFrame(tick);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "pinball",
      gameTitle: "핀볼팡팡",
      formParent: overlays.over || overlays.all || document.body,
    });
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
        if (typeof last !== "undefined") last = performance.now();
        return true;
      },
    });
  }

})();
