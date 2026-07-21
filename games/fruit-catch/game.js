(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const FRUITS = [
    { key: "strawberry", score: 1 },
    { key: "apple", score: 1 },
    { key: "orange", score: 1 },
    { key: "grape", score: 2 },
    { key: "peach", score: 2 },
    { key: "cherry", score: 3 },
    { key: "starfruit", score: 4 },
  ];

  const FRUIT_NAMES = [
    "과수원 산책", "아침 수확", "과일비", "바구니 연습", "바쁜 수확",
    "달콤한 비", "요란한 과수원", "폭탄 주의", "과일 폭풍", "황금 스타",
    "빠른 손놀림", "과일 레이스", "과즙 폭발", "수확 축제", "야간 과수원",
    "슈퍼 바스켓", "폭탄 소나기", "전설의 수확", "과일 마스터", "왕관 수확",
    "새벽 과수원", "복숭아 비", "체리 폭풍", "포도 레이스", "사과 축제",
    "오렌지 질주", "스타프루트 비", "폭탄 미로", "달콤 결전", "과즙 왕국",
    "야간 수확", "슈퍼 과수원", "과일 신화", "바구니 전설", "황금 수확",
    "폭탄 레이스", "과즙 신전", "스타 폭풍", "최종 과수원", "과일 왕좌",
    "체리 신화", "복숭아 왕관", "포도 대서사", "사과 결전", "오렌지 전설",
    "스타프루트 왕국", "폭탄 왕좌", "수확 신화", "과일 대서사", "왕관 마스터",
  ];

  const STAGES = Array.from({ length: 50 }, (_, i) => ({
    // 초반부터 길게·빡세게: 1스테이지 목표 30, 낙하·폭탄 증가
    goal: 30 + i * 7,
    speed: 1.18 + i * 0.11,
    bombRate: Math.min(0.4, 0.15 + i * 0.014),
    spawn: Math.max(0.26, 0.58 - i * 0.016),
    lives: i < 6 ? 3 : i < 14 ? 3 : 4,
    name: FRUIT_NAMES[i] || `스테이지 ${i + 1}`,
  }));

  const imgs = {
    strawberry: null,
    apple: null,
    orange: null,
    grape: null,
    peach: null,
    cherry: null,
    starfruit: null,
    bomb: null,
    basket: null,
  };

  function loadFruitAssets() {
    return Promise.all(
      Object.keys(imgs).map(
        (key) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              imgs[key] = img;
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
  let lives = 3;
  let items = [];
  let particles = [];
  let floats = [];
  let combo = 0;
  let comboTimer = 0;
  let flashLife = 0;
  let spawnAcc = 0;
  let last = 0;
  let raf = 0;
  let clouds = [];
  let runStartedAt = 0;
  let stageStartedAt = 0;
  const EXPECTED_SEC = 20 * STAGES.length;
  const basket = { x: W / 2, y: H - 88, w: 86, h: 36 };

  function makeClouds() {
    clouds = Array.from({ length: 5 }, (_, i) => ({
      x: i * 90 + Math.random() * 40,
      y: 60 + Math.random() * 120,
      s: 0.5 + Math.random() * 0.5,
      w: 50 + Math.random() * 40,
    }));
  }

  function resetStage() {
    const st = STAGES[stageIndex];
    stageStartedAt = performance.now();
    stageScore = 0;
    lives = st.lives;
    items = [];
    particles = [];
    floats = [];
    combo = 0;
    comboTimer = 0;
    flashLife = 0;
    spawnAcc = 0;
    basket.x = W / 2;
    updateHud();
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-goal").textContent = String(st.goal);
    document.getElementById("goal-fill").style.width = `${Math.min(100, (stageScore / st.goal) * 100)}%`;
    const livesEl = document.getElementById("hud-lives");
    livesEl.innerHTML = "";
    for (let i = 0; i < st.lives; i += 1) {
      const d = document.createElement("span");
      d.className = "life" + (i < lives ? "" : " empty");
      livesEl.appendChild(d);
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 8; i += 1) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x, y,
        vx: Math.cos(a) * (40 + Math.random() * 80),
        vy: Math.sin(a) * (40 + Math.random() * 80) - 30,
        life: 0.4 + Math.random() * 0.3,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function spawnItem() {
    const st = STAGES[stageIndex];
    const isBomb = Math.random() < st.bombRate;
    if (isBomb) {
      items.push({
        x: 36 + Math.random() * (W - 72),
        y: -40,
        vy: (140 + Math.random() * 80) * st.speed,
        r: 22,
        bomb: true,
        key: "bomb",
        rot: 0,
      });
      return;
    }
    const f = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    items.push({
      x: 36 + Math.random() * (W - 72),
      y: -40,
      vy: (150 + Math.random() * 100) * st.speed,
      r: 22,
      bomb: false,
      key: f.key,
      score: f.score,
      rot: Math.random() * Math.PI,
    });
  }

  function startGame() {
    stageIndex = 0;
    score = 0;
    runStartedAt = performance.now();
    if (window.TodayGameRank) TodayGameRank.reset();
    makeClouds();
    resetStage();
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    overlays.title.classList.add("hidden");
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stageClear() {
    const elapsed = (performance.now() - stageStartedAt) / 1000;
    score += Math.max(0, Math.floor(20 - elapsed)) * 8;
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
      document.getElementById("all-detail").textContent = `총 점수 ${score}점으로 과일왕 등극!`;
      overlays.all.classList.remove("hidden");
      state = "all";
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "fruit-catch", gameTitle: "과일 바스켓", formParent: overlays.all });
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

  function gameOver() {
    state = "over";
    document.getElementById("over-detail").textContent = `STAGE ${stageIndex + 1} · 점수 ${score}`;
    overlays.over.classList.remove("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "fruit-catch", gameTitle: "과일 바스켓", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function update(dt) {
    const st = STAGES[stageIndex];
    spawnAcc += dt;
    if (spawnAcc > st.spawn) {
      spawnAcc = 0;
      spawnItem();
    }

    clouds.forEach((c) => {
      c.x += 12 * c.s * dt;
      if (c.x > W + 60) c.x = -80;
    });

    items.forEach((it) => {
      it.y += it.vy * dt;
      it.rot += dt * 2;
    });

    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i];
      const caught =
        it.y > basket.y - 8 &&
        it.y < basket.y + 28 &&
        Math.abs(it.x - basket.x) < basket.w * 0.46;

      if (caught) {
        if (it.bomb) {
          lives -= 1;
          combo = 0;
          comboTimer = 0;
          flashLife = 0.4;
          burst(it.x, it.y, "#ff6b6b");
          addFloat(it.x, it.y, "펑!", "#ff5b5b");
          updateHud();
          items.splice(i, 1);
          if (lives <= 0) {
            gameOver();
            return;
          }
        } else {
          combo += 1;
          comboTimer = 1.8;
          const mult = comboMultiplier();
          const gain = it.score * mult;
          stageScore += gain;
          score += gain;
          burst(it.x, it.y, "#ffe27a");
          addFloat(it.x, it.y - 16, mult > 1 ? `+${gain} x${mult}` : `+${gain}`, "#ff8a3d");
          updateHud();
          items.splice(i, 1);
          if (stageScore >= st.goal) {
            stageClear();
            return;
          }
        }
        continue;
      }

      if (it.y > H + 40) {
        if (!it.bomb) {
          lives -= 1;
          combo = 0;
          comboTimer = 0;
          updateHud();
          if (lives <= 0) {
            gameOver();
            return;
          }
        }
        items.splice(i, 1);
      }
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (flashLife > 0) flashLife -= dt;

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
    });
    particles = particles.filter((p) => p.life > 0);

    floats.forEach((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.96;
    });
    floats = floats.filter((f) => f.life > 0);
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.9, vy: -48 });
  }

  function comboMultiplier() {
    if (combo >= 8) return 3;
    if (combo >= 4) return 2;
    return 1;
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

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#8fd0ff");
    g.addColorStop(0.55, "#d7f0ff");
    g.addColorStop(1, "#ffe6f1");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sun
    ctx.fillStyle = "rgba(255, 226, 122, 0.85)";
    ctx.beginPath();
    ctx.arc(52, 70, 28, 0, Math.PI * 2);
    ctx.fill();

    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.5, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 18, c.y + 4, 18, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 20, c.y + 2, 20, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // ground strip with flower bushes like thumb
    ctx.fillStyle = "#9fe07d";
    ctx.fillRect(0, H - 46, W, 46);
    ctx.fillStyle = "#7ed957";
    ctx.fillRect(0, H - 46, W, 12);

    // bushes
    for (const side of [40, W - 40]) {
      ctx.fillStyle = "#5cb85c";
      ctx.beginPath();
      ctx.arc(side - 18, H - 52, 22, 0, Math.PI * 2);
      ctx.arc(side + 4, H - 58, 26, 0, Math.PI * 2);
      ctx.arc(side + 22, H - 50, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 3; i += 1) {
        const fx = side - 16 + i * 14;
        const fy = H - 62 - (i % 2) * 6;
        ctx.beginPath();
        for (let p = 0; p < 5; p += 1) {
          const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffe27a";
        ctx.beginPath();
        ctx.arc(fx, fy, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
      }
    }

    items.forEach((it) => {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(Math.sin(it.rot) * 0.35);
      const img = imgs[it.key];
      const size = it.r * 2.4;
      if (img) {
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = it.bomb ? "#333" : "#ff8ab5";
        ctx.beginPath();
        ctx.arc(0, 0, it.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // basket
    const bx = basket.x - basket.w / 2;
    const by = basket.y;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(basket.x, by + 34, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (imgs.basket) {
      ctx.drawImage(imgs.basket, basket.x - 52, by - 18, 104, 70);
    } else {
      ctx.fillStyle = "#e2a05d";
      roundRect(bx, by, basket.w, basket.h, 12);
      ctx.fill();
      ctx.fillStyle = "#c8843d";
      roundRect(bx + 8, by + 10, basket.w - 16, basket.h - 16, 8);
      ctx.fill();
      ctx.strokeStyle = "#8b5a2b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx + 10, by + 4);
      ctx.quadraticCurveTo(basket.x, by - 18, bx + basket.w - 10, by + 4);
      ctx.stroke();
    }

    ctx.font = "18px Jua";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(STAGES[stageIndex].name, W / 2, H - 18);

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
      ctx.fillStyle = f.color;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      ctx.font = "bold 20px Jua";
      ctx.textAlign = "center";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (combo >= 2 && comboTimer > 0) {
      ctx.globalAlpha = Math.min(1, comboTimer);
      ctx.fillStyle = combo >= 8 ? "#ff5f97" : combo >= 4 ? "#ff8a3d" : "#5b9fff";
      ctx.font = "bold 30px 'Bagel Fat One', Jua";
      ctx.textAlign = "center";
      ctx.fillText(`${combo} COMBO`, W / 2, 100);
      ctx.globalAlpha = 1;
    }

    if (flashLife > 0) {
      ctx.fillStyle = `rgba(255,80,80,${flashLife * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
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

  function moveTo(clientX) {
    if (state !== "play") return;
    const rect = canvas.getBoundingClientRect();
    basket.x = Math.max(44, Math.min(W - 44, ((clientX - rect.left) / rect.width) * W));
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  });
  canvas.addEventListener("pointermove", (e) => moveTo(e.clientX));

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "fruit-catch",
      gameTitle: "과일 바스켓",
      formParent: overlays.over || overlays.all || document.body,
    });
  }

  loadFruitAssets().then(() => {
    makeClouds();
    draw();
  });

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
