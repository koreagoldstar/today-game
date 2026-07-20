(() => {
  "use strict";

  const W = 390;
  const H = 560;
  const BRICK_COLORS = ["#ff8ab5", "#ff9a6b", "#b5ff9a", "#ffe27a", "#7ec8ff", "#d4a0ff"];
  const sprites = { bg: null, paddle: null, ball: null };

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [bg, paddleImg, ballImg] = await Promise.all([
      loadImg("assets/bg.png"),
      loadImg("assets/paddle.png"),
      loadImg("assets/ball.png"),
    ]);
    sprites.bg = bg;
    sprites.paddle = paddleImg;
    sprites.ball = ballImg;
  }

  const BRICK_NAMES = [
    "첫 번째 밤하늘", "반짝이는 은하", "유성우의 밤", "오로라 정원", "별빛 호수",
    "달빛 성", "혜성 골목", "네뷸라 광장", "별똥별 축제", "은하수 다리",
    "흑성 습격", "별가루 폭풍", "코스믹 미로", "달토끼 밤", "유성 레이스",
    "오로라 결전", "별빛 대서사", "우주 정원", "최종 혜성", "별의 왕관",
    "초신성 파도", "암흑성운", "유성 요새", "달그림자 성", "별무리 습격",
    "혜성 고속도로", "네온 성운", "은하 미로", "오로라 폭풍", "별똥별 결전",
    "코스믹 레이스", "달빛 결투", "흑성 왕좌", "별가루 신전", "유성 왕관",
    "네뷸라 심연", "은하수 정상", "달토끼 전설", "초신성 축제", "별빛 신화",
    "암흑 혜성", "오로라 왕국", "우주 요새", "최종 성운", "별무리 왕관",
    "달빛 대서사", "혜성 신화", "은하 결전", "코스믹 왕좌", "별의 전설",
  ];

  const STAGES = Array.from({ length: 50 }, (_, i) => ({
    rows: Math.min(8, 3 + Math.floor(i / 2)),
    cols: Math.min(9, 6 + Math.floor(i / 3)),
    speed: 340 + i * 12,
    name: BRICK_NAMES[i] || `스테이지 ${i + 1}`,
  }));

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let lives = 3;
  let bricks = [];
  let particles = [];
  let stars = [];
  let paddle = { x: W / 2, w: 96, h: 22 };
  let ball = null;
  let launched = false;
  let pointerX = W / 2;
  const keys = { left: false, right: false };
  let last = 0;
  let raf = 0;
  let runStartedAt = 0;
  let stageStartedAt = 0;

  function makeStars() {
    stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.7,
      s: 0.5 + Math.random(),
      tw: Math.random() * Math.PI * 2,
    }));
  }

  function makeBricks() {
    const st = STAGES[stageIndex];
    bricks = [];
    const pad = 14;
    const gap = 6;
    const bw = (W - pad * 2 - gap * (st.cols - 1)) / st.cols;
    const bh = 26;
    for (let r = 0; r < st.rows; r += 1) {
      for (let c = 0; c < st.cols; c += 1) {
        bricks.push({
          x: pad + c * (bw + gap),
          y: 70 + r * (bh + gap),
          w: bw,
          h: bh,
          hp: 1 + Math.floor(r / 2),
          maxHp: 1 + Math.floor(r / 2),
          color: BRICK_COLORS[(r + c) % BRICK_COLORS.length],
          face: 0,
          wobble: Math.random() * Math.PI * 2,
          alive: true,
        });
      }
    }
  }

  function resetBall() {
    const st = STAGES[stageIndex];
    ball = {
      x: paddle.x,
      y: H - 72,
      r: 10,
      vx: 0,
      vy: 0,
      speed: st.speed,
    };
    launched = false;
  }

  function resetStage() {
    stageStartedAt = performance.now();
    makeBricks();
    resetBall();
    paddle.w = Math.max(64, 88 - stageIndex * 4);
    document.getElementById("stage").textContent = String(stageIndex + 1);
    document.getElementById("stage-name").textContent = STAGES[stageIndex].name;
    updateHud();
  }

  function updateHud() {
    document.getElementById("score").textContent = String(score);
    document.getElementById("lives").textContent = "♥".repeat(lives) + "♡".repeat(3 - lives);
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x, y,
        vx: Math.cos(a) * (60 + Math.random() * 120),
        vy: Math.sin(a) * (60 + Math.random() * 120),
        life: 0.35 + Math.random() * 0.25,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function launchBall() {
    if (!ball || launched) return;
    launched = true;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
  }

  function speedUpBall(amount = 1.02) {
    if (!ball) return;
    const st = STAGES[stageIndex];
    const current = Math.hypot(ball.vx, ball.vy) || ball.speed;
    const next = Math.min(st.speed + 130, Math.max(st.speed, current * amount));
    const ratio = next / current;
    ball.vx *= ratio;
    ball.vy *= ratio;
  }

  function loseLife() {
    lives -= 1;
    updateHud();
    if (lives <= 0) {
      state = "over";
      document.getElementById("over-detail").textContent = `점수 ${score} · STAGE ${stageIndex + 1}`;
      overlays.over.classList.remove("hidden");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "brick", gameTitle: "별똥별 벽돌깨기", formParent: overlays.over });
      TodayGameRank.open(score);
    }
      return;
    }
    resetBall();
  }

  function stageClear() {
    const elapsed = (performance.now() - stageStartedAt) / 1000;
    score += Math.max(0, Math.floor(20 - elapsed)) * 8;
    updateHud();
    state = "clear";
    document.getElementById("clear-detail").textContent = `점수 ${score}`;
    document.getElementById("next-btn").textContent = stageIndex >= STAGES.length - 1 ? "최종 결과" : "다음 스테이지";
    overlays.clear.classList.remove("hidden");
  }

  function startGame() {
    stageIndex = 0;
    score = 0;
    lives = 3;
    runStartedAt = performance.now();
    if (window.TodayGameRank) TodayGameRank.reset();
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    makeStars();
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function nextStage() {
    overlays.clear.classList.add("hidden");
    if (stageIndex >= STAGES.length - 1) {
      document.getElementById("all-detail").textContent = `최종 점수 ${score}`;
      overlays.all.classList.remove("hidden");
      state = "all";
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "brick", gameTitle: "별똥별 벽돌깨기", formParent: overlays.all });
      TodayGameRank.open(score);
    }
      return;
    }
    stageIndex += 1;
    resetStage();
    state = "play";
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function collideBallBrick(b, brick) {
    const closestX = Math.max(brick.x, Math.min(b.x, brick.x + brick.w));
    const closestY = Math.max(brick.y, Math.min(b.y, brick.y + brick.h));
    const dx = b.x - closestX;
    const dy = b.y - closestY;
    return dx * dx + dy * dy < b.r * b.r;
  }

  function update(dt) {
    const keyboardDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (keyboardDir !== 0) {
      pointerX += keyboardDir * 520 * dt;
      pointerX = Math.max(paddle.w / 2 + 8, Math.min(W - paddle.w / 2 - 8, pointerX));
    }
    paddle.x += (pointerX - paddle.x) * Math.min(1, dt * 14);
    paddle.x = Math.max(paddle.w / 2 + 8, Math.min(W - paddle.w / 2 - 8, paddle.x));

    if (!launched && ball) {
      ball.x = paddle.x;
      ball.y = H - 72;
      return;
    }

    if (!ball) return;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx *= -1;
    }
    if (ball.x + ball.r > W) {
      ball.x = W - ball.r;
      ball.vx *= -1;
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy *= -1;
    }

    const py = H - 58;
    if (
      ball.y + ball.r >= py &&
      ball.y - ball.r <= py + paddle.h &&
      ball.x >= paddle.x - paddle.w / 2 &&
      ball.x <= paddle.x + paddle.w / 2 &&
      ball.vy > 0
    ) {
      const hit = (ball.x - paddle.x) / (paddle.w / 2);
      const angle = -Math.PI / 2 + hit * 0.65;
      const sp = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.cos(angle) * sp;
      ball.vy = Math.sin(angle) * sp;
      speedUpBall(1.015);
      ball.y = py - ball.r;
    }

    if (ball.y - ball.r > H) {
      loseLife();
      return;
    }

    let aliveCount = 0;
    bricks.forEach((brick) => {
      if (!brick.alive) return;
      aliveCount += 1;
      if (!collideBallBrick(ball, brick)) return;
      brick.hp -= 1;
      burst(ball.x, ball.y, brick.color);
      if (brick.hp <= 0) {
        brick.alive = false;
        score += 10 * brick.maxHp;
        burst(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 14);
        updateHud();
        aliveCount -= 1;
      }
      const overlapX = Math.min(ball.x + ball.r - brick.x, brick.x + brick.w - (ball.x - ball.r));
      const overlapY = Math.min(ball.y + ball.r - brick.y, brick.y + brick.h - (ball.y - ball.r));
      if (overlapX < overlapY) ball.vx *= -1;
      else ball.vy *= -1;
      speedUpBall(1.01);
    });

    if (aliveCount === 0 && state === "play") stageClear();

    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);
  }

  function draw() {
    const t = Date.now() * 0.001;
    if (sprites.bg) {
      ctx.drawImage(sprites.bg, 0, 0, W, H);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#120e28");
      bg.addColorStop(0.7, "#2a1f4a");
      bg.addColorStop(1, "#5a3a7a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    stars.forEach((s) => {
      const a = 0.35 + Math.sin(t * 2 + s.tw) * 0.25;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
    });

    // soft purple cloud bank near paddle
    ctx.fillStyle = "rgba(160, 110, 200, 0.35)";
    for (let i = 0; i < 5; i += 1) {
      const cx = 40 + i * 80;
      const cy = H - 28 + Math.sin(t + i) * 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 48, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    bricks.forEach((brick) => drawBrick(brick, t));

    const py = H - 58;
    const px = paddle.x - paddle.w / 2;
    if (sprites.paddle) {
      const ph = paddle.h + 6;
      ctx.drawImage(sprites.paddle, px - 4, py - 4, paddle.w + 8, ph);
    } else {
      const pg = ctx.createLinearGradient(px, py, px + paddle.w, py);
      pg.addColorStop(0, "#ffe89a");
      pg.addColorStop(0.5, "#ffe27a");
      pg.addColorStop(1, "#ffb347");
      ctx.fillStyle = pg;
      roundRect(px, py, paddle.w, paddle.h, paddle.h / 2);
      ctx.fill();
    }

    if (ball) {
      const glow = ctx.createRadialGradient(ball.x, ball.y, 1, ball.x, ball.y, ball.r * 3.2);
      glow.addColorStop(0, "rgba(255,255,200,0.95)");
      glow.addColorStop(0.35, "rgba(255,220,90,0.55)");
      glow.addColorStop(1, "rgba(255,180,60,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      if (sprites.ball) {
        const s = ball.r * 2.8;
        ctx.drawImage(sprites.ball, ball.x - s / 2, ball.y - s / 2, s, s);
      } else {
        ctx.fillStyle = "#ffe27a";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (!launched && state === "play") {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "15px Jua,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("탭해서 공 발사!", W / 2, H - 100);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBrick(brick, t) {
    if (!brick.alive) return;

    const bob = Math.sin(t * 2.4 + brick.wobble) * 0.7;
    const x = brick.x;
    const y = brick.y + bob;
    const damage = 1 - brick.hp / brick.maxHp;

    ctx.save();
    ctx.shadowColor = brick.color;
    ctx.shadowBlur = 10 + damage * 8;

    const g = ctx.createLinearGradient(x, y, x, y + brick.h);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.28, brick.color);
    g.addColorStop(1, shade(brick.color, -34));
    ctx.fillStyle = g;
    roundRect(x, y, brick.w, brick.h, 8);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = damage > 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    roundRect(x, y, brick.w, brick.h, 8);
    ctx.stroke();

    // Top shine and candy stripe make each target read like a playful object, not a plain box.
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(x + 4, y + 3, brick.w - 8, 5, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + brick.w * 0.18, y + brick.h - 3);
    ctx.lineTo(x + brick.w * 0.35, y + 4);
    ctx.moveTo(x + brick.w * 0.66, y + brick.h - 3);
    ctx.lineTo(x + brick.w * 0.83, y + 4);
    ctx.stroke();

    const eyeY = y + brick.h * 0.47;
    ctx.fillStyle = "#211733";
    ctx.beginPath();
    ctx.arc(x + brick.w * 0.34, eyeY, 2.1, 0, Math.PI * 2);
    ctx.arc(x + brick.w * 0.66, eyeY, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + brick.w * 0.31, eyeY - 0.8, 0.8, 0, Math.PI * 2);
    ctx.arc(x + brick.w * 0.63, eyeY - 0.8, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#211733";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x + brick.w / 2, y + brick.h * 0.55, 4.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    // soft candy speckles instead of cheap symbol text
    ctx.beginPath();
    ctx.arc(x + brick.w * 0.22, y + brick.h * 0.72, 1.6, 0, Math.PI * 2);
    ctx.arc(x + brick.w * 0.78, y + brick.h * 0.3, 1.4, 0, Math.PI * 2);
    ctx.fill();

    if (brick.maxHp > 1) {
      ctx.fillStyle = "rgba(20,14,40,0.7)";
      ctx.beginPath();
      ctx.arc(x + brick.w - 7, y + 7, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px Jua,sans-serif";
      ctx.fillText(String(brick.hp), x + brick.w - 7, y + 10);
    }

    if (damage > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + brick.w * 0.22, y + brick.h * 0.25);
      ctx.lineTo(x + brick.w * 0.34, y + brick.h * 0.46);
      ctx.lineTo(x + brick.w * 0.28, y + brick.h * 0.7);
      ctx.stroke();
    }

    ctx.restore();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function loop(t) {
    if (state !== "play") return;
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = ((e.clientX - rect.left) / rect.width) * W;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    if (state === "play") launchBall();
  });
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = ((e.clientX - rect.left) / rect.width) * W;
  });
  window.addEventListener("keydown", (e) => {
    if (["Space", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "Space") {
      launchBall();
    }
    if (e.code === "ArrowLeft") keys.left = true;
    if (e.code === "ArrowRight") keys.right = true;
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft") keys.left = false;
    if (e.code === "ArrowRight") keys.right = false;
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  makeStars();
  loadAssets().then(() => draw());
  draw();

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "brick",
      gameTitle: "별똥별 벽돌깨기",
      formParent: overlays.over || overlays.all || document.body,
    });
  }
})();
