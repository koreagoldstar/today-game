(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const COLORS = ["#ff8ab5", "#7ec8ff", "#ffe27a", "#6fd6b0", "#c9a0ff", "#ffa86b"];

  const BUBBLE_NAMES = [
    "맑은 하늘", "방울 축제", "바람 언덕", "깜짝 방울", "구름 놀이",
    "파란 소풍", "골드 샤워", "바람 속으로", "팝팝 광장", "검은 방울주의",
    "스피드 팝", "하늘 미로", "별방울 비", "최종 연습", "폭풍 방울",
    "무지개 팝", "타임 어택", "마스터 팝", "전설의 방울", "팝팝 왕관",
    "솜구름 팝", "바람 축제", "골드 미로", "별방울 질주", "검은 폭풍",
    "파란 레이스", "팝팝 신전", "구름 결전", "스피드 왕국", "방울 신화",
    "하늘 요새", "골드 왕좌", "무지개 폭풍", "타임 마스터", "별방울 전설",
    "바람의 왕", "팝팝 대서사", "검은 미로", "최종 샤워", "방울 왕관",
    "구름 신화", "스피드 결전", "골드 신전", "파란 왕좌", "별방울 왕국",
    "폭풍 마스터", "무지개 전설", "팝팝 신화", "하늘 대서사", "방울 전설",
  ];

  const STAGES = Array.from({ length: 50 }, (_, i) => ({
    // 초반부터 길게·빡세게: 목표↑, 시간 대비 밀도↑, 나쁜 방울↑
    goal: 40 + i * 8,
    time: Math.max(22, 30 - Math.floor(i * 0.45)),
    spawn: Math.max(0.14, 0.36 - i * 0.011),
    speed: 1.15 + i * 0.085,
    badRate: Math.min(0.36, 0.14 + i * 0.012),
    name: BUBBLE_NAMES[i] || `스테이지 ${i + 1}`,
  }));

  const bubbleImgs = { pink: null, cyan: null, gold: null, bad: null, star: null };
  const BUBBLE_KEYS = ["pink", "cyan", "gold", "bad", "star"];

  function loadBubbleAssets() {
    return Promise.all(
      BUBBLE_KEYS.map(
        (key) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              bubbleImgs[key] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/${key}.png`;
          })
      )
    );
  }

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
  let stageScore = 0;
  let timeLeft = 30;
  let bubbles = [];
  let pops = [];
  let floats = [];
  let clouds = [];
  let combo = 0;
  let comboTimer = 0;
  let shake = 0;
  let spawnAcc = 0;
  let last = 0;
  let raf = 0;

  function makeClouds() {
    clouds = Array.from({ length: 6 }, () => ({
      x: Math.random() * W,
      y: 60 + Math.random() * (H - 220),
      s: 0.6 + Math.random() * 0.9,
      speed: 6 + Math.random() * 14,
    }));
  }

  function resetStage() {
    const st = STAGES[stageIndex];
    stageScore = 0;
    timeLeft = st.time;
    bubbles = [];
    pops = [];
    floats = [];
    combo = 0;
    comboTimer = 0;
    spawnAcc = 0;
    updateHud();
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-goal").textContent = String(st.goal);
    document.getElementById("hud-time").textContent = String(Math.max(0, Math.ceil(timeLeft)));
    document.getElementById("goal-fill").style.width = `${Math.min(100, (stageScore / st.goal) * 100)}%`;
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.9, vy: -46 });
  }

  function comboMultiplier() {
    if (combo >= 8) return 3;
    if (combo >= 4) return 2;
    return 1;
  }

  function spawnBubble() {
    const st = STAGES[stageIndex];
    const bad = Math.random() < st.badRate;
    const gold = !bad && Math.random() < 0.12;
    const r = gold ? 16 + Math.random() * 10 : 18 + Math.random() * 24;
    bubbles.push({
      x: 28 + Math.random() * (W - 56),
      y: H + r + 8,
      r,
      vy: -(65 + Math.random() * 80) * st.speed,
      color: bad ? "#2a2a32" : gold ? "#ffd056" : COLORS[Math.floor(Math.random() * COLORS.length)],
      bad,
      gold,
      key: bad ? "bad" : gold ? "gold" : Math.random() > 0.5 ? "pink" : "cyan",
      wobble: Math.random() * 10,
      face: Math.random() > 0.35,
    });
  }

  function addPop(x, y, color) {
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * Math.PI * 2;
      pops.push({
        x,
        y,
        vx: Math.cos(a) * (50 + Math.random() * 90),
        vy: Math.sin(a) * (50 + Math.random() * 90),
        life: 0.35 + Math.random() * 0.25,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function startGame() {
    stageIndex = 0;
    score = 0;
    if (window.TodayGameRank) TodayGameRank.reset();
    makeClouds();
    resetStage();
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stageClear() {
    const timeBonus = Math.floor(Math.max(0, timeLeft)) * 10;
    score += timeBonus;
    updateHud();
    state = "clear";
    document.getElementById("clear-title").textContent = `STAGE ${stageIndex + 1} CLEAR!`;
    document.getElementById("clear-detail").textContent = `${STAGES[stageIndex].name} · 점수 ${score}`;
    document.getElementById("next-btn").textContent =
      stageIndex >= STAGES.length - 1 ? "최종 결과" : "다음 스테이지";
    overlays.clear.classList.remove("hidden");
  }

  function nextStage() {
    overlays.clear.classList.add("hidden");
    if (stageIndex >= STAGES.length - 1) {
      document.getElementById("all-detail").textContent = `총 점수 ${score}점으로 완주!`;
      overlays.all.classList.remove("hidden");
      state = "all";
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "bubble-pop", gameTitle: "팝팝 방울", formParent: overlays.all });
      TodayGameRank.open(score);
    }
      return;
    }
    stageIndex += 1;
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function fail() {
    state = "over";
    document.getElementById("over-detail").textContent = `STAGE ${stageIndex + 1} · 점수 ${score}`;
    overlays.over.classList.remove("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "bubble-pop", gameTitle: "팝팝 방울", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function update(dt) {
    const st = STAGES[stageIndex];
    timeLeft -= dt;
    updateHud();
    if (timeLeft <= 0) {
      fail();
      return;
    }

    if (shake > 0) shake -= dt;
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    clouds.forEach((c) => {
      c.x += c.speed * dt;
      if (c.x - 60 * c.s > W) {
        c.x = -60 * c.s;
        c.y = 60 + Math.random() * (H - 220);
      }
    });

    spawnAcc += dt;
    if (spawnAcc > st.spawn) {
      spawnAcc = 0;
      spawnBubble();
    }

    bubbles.forEach((b) => {
      b.y += b.vy * dt;
      b.x += Math.sin((b.wobble += dt * 2.8)) * 0.9;
    });
    bubbles = bubbles.filter((b) => b.y + b.r > -30);

    pops.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    pops = pops.filter((p) => p.life > 0);

    floats.forEach((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.96;
    });
    floats = floats.filter((f) => f.life > 0);
  }

  function drawBubble(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const img = bubbleImgs[b.key];
    if (img) {
      const size = b.r * 2.35;
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    const grd = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.35, 2, 0, 0, b.r);
    if (b.bad) {
      grd.addColorStop(0, "#555566");
      grd.addColorStop(1, "#1c1c24");
    } else {
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(0.18, b.color);
      grd.addColorStop(1, b.color);
    }
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawCloud(c) {
    const s = c.s;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 34 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x - 24 * s, c.y + 6 * s, 22 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + 26 * s, c.y + 5 * s, 24 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    const sx = shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
    ctx.save();
    ctx.translate(sx, sy);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#9fd8ff");
    g.addColorStop(0.55, "#d9f1ff");
    g.addColorStop(1, "#eef7ff");
    ctx.fillStyle = g;
    ctx.fillRect(-12, -12, W + 24, H + 24);

    clouds.forEach(drawCloud);

    // soft hills
    ctx.fillStyle = "rgba(126, 217, 87, 0.35)";
    ctx.beginPath();
    ctx.ellipse(60, H - 20, 120, 50, 0, 0, Math.PI * 2);
    ctx.ellipse(250, H - 10, 160, 55, 0, 0, Math.PI * 2);
    ctx.fill();

    bubbles.forEach(drawBubble);

    pops.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2.2);
      if (bubbleImgs.star && p.life > 0.2) {
        const s = p.size * 3.2;
        ctx.drawImage(bubbleImgs.star, p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
      ctx.fillStyle = f.color;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      ctx.font = "bold 18px Jua";
      ctx.textAlign = "center";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (combo >= 2 && comboTimer > 0) {
      ctx.globalAlpha = Math.min(1, comboTimer);
      ctx.fillStyle = combo >= 8 ? "#ff5f97" : combo >= 4 ? "#ff8ab5" : "#7ec8ff";
      ctx.font = "bold 30px 'Bagel Fat One', Jua";
      ctx.textAlign = "center";
      ctx.fillText(`${combo} COMBO`, W / 2, 120);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "14px Jua";
    ctx.textAlign = "center";
    ctx.fillText(STAGES[stageIndex].name, W / 2, H - 16);

    ctx.restore();
  }

  function loop(t) {
    if (state !== "play") return;
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    if (state === "play") {
      draw();
      raf = requestAnimationFrame(loop);
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;

    for (let i = bubbles.length - 1; i >= 0; i -= 1) {
      const b = bubbles[i];
      const dx = b.x - x;
      const dy = b.y - y;
      if (dx * dx + dy * dy <= (b.r + 10) * (b.r + 10)) {
        if (b.bad) {
          timeLeft = Math.max(0, timeLeft - 4);
          addPop(b.x, b.y, "#ff6b6b");
          addFloat(b.x, b.y, "-4초", "#ff6b6b");
          combo = 0;
          comboTimer = 0;
          shake = 0.3;
          bubbles.splice(i, 1);
          updateHud();
          if (timeLeft <= 0) fail();
          return;
        }
        combo += 1;
        comboTimer = 1.6;
        const mult = comboMultiplier();
        const base = b.gold ? 5 : Math.max(1, Math.round(36 / b.r));
        const gain = base * mult;
        stageScore += gain;
        score += gain;
        addPop(b.x, b.y, b.color);
        addFloat(b.x, b.y - b.r, mult > 1 ? `+${gain} x${mult}` : `+${gain}`, b.gold ? "#ffb800" : "#ff5f97");
        bubbles.splice(i, 1);
        updateHud();
        if (stageScore >= STAGES[stageIndex].goal) stageClear();
        return;
      }
    }
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "bubble-pop",
      gameTitle: "팝팝 방울",
      formParent: overlays.over || overlays.all || document.body,
    });
  }

  loadBubbleAssets().then(() => {
    makeClouds();
    draw();
  });
})();
