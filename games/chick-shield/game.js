(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GAME_ID = "chick-shield";
  const GAME_TITLE = "막아요 쏴요";
  const BEST_KEY = "today-chick-shield-best";
  const NAME_KEY = "today-chick-shield-name";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  const overlays = {
    title: document.getElementById("title"),
    over: document.getElementById("over"),
  };
  const hintEl = document.getElementById("hint");
  const nameInput = document.getElementById("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";

  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
  document.getElementById("hud-best").textContent = String(best);

  let state = "title";
  let score = 0;
  let lives = 3;
  let wave = 1;
  let playTime = 0;
  let last = 0;
  let raf = 0;
  let submitted = false;
  let lastRank = { rankDay: null, rankWeek: null };
  let shield = false;
  let fireAcc = 0;
  let spawnAcc = 0;
  let invuln = 0;
  let shake = 0;
  let flash = 0;
  let keys = Object.create(null);
  let pointerId = null;
  let dragX = null;
  let holding = false;

  const player = {
    x: W / 2,
    y: H - 110,
    r: 22,
  };

  /** @type {Array<{x:number,y:number,vx:number,vy:number,hp:number,t:number,shoot:number,hue:number}>} */
  let enemies = [];
  /** @type {Array<{x:number,y:number,vy:number,friendly:boolean}>} */
  let bullets = [];
  /** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,t:number,color:string}>} */
  let particles = [];
  /** @type {Array<{x:number,y:number,text:string,t:number,color:string}>} */
  let floats = [];
  let clouds = [];

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (name && overlays[name]) overlays[name].classList.remove("hidden");
  }

  function updateHud() {
    document.getElementById("hud-wave").textContent = String(wave);
    document.getElementById("hud-score").textContent = String(Math.floor(score));
    document.getElementById("hud-best").textContent = String(best);
    const livesEl = document.getElementById("hud-lives");
    livesEl.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const d = document.createElement("div");
      d.className = "life" + (i < lives ? "" : " empty");
      livesEl.appendChild(d);
    }
  }

  function saveBest() {
    if (score > best) {
      best = Math.floor(score);
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function difficulty() {
    const t = Math.min(1, playTime / 160);
    return {
      spawn: Math.max(0.55, 1.55 - t * 0.9),
      enemySpeed: 28 + t * 55,
      enemyHp: t > 0.55 ? 3 : t > 0.28 ? 2 : 1,
      shootGap: Math.max(0.9, 2.1 - t * 1.1),
      bulletSpeed: 140 + t * 120,
      fireRate: Math.max(0.18, 0.32 - t * 0.08),
      multi: t > 0.4 ? 2 : 1,
    };
  }

  function resetRun() {
    score = 0;
    lives = 3;
    wave = 1;
    playTime = 0;
    shield = false;
    fireAcc = 0;
    spawnAcc = 0;
    invuln = 0;
    shake = 0;
    flash = 0;
    enemies = [];
    bullets = [];
    particles = [];
    floats = [];
    player.x = W / 2;
    submitted = false;
    lastRank = { rankDay: null, rankWeek: null };
    document.getElementById("rank-msg").textContent = "";
    const shareBtn = document.getElementById("share-rank-btn");
    if (shareBtn) shareBtn.hidden = true;
    seedClouds();
    updateHud();
  }

  function seedClouds() {
    clouds = [];
    for (let i = 0; i < 5; i += 1) {
      clouds.push({
        x: Math.random() * W,
        y: 40 + Math.random() * 220,
        s: 0.6 + Math.random() * 0.8,
        v: 8 + Math.random() * 14,
      });
    }
  }

  function startGame() {
    resetRun();
    state = "play";
    showOverlay(null);
    hintEl.classList.remove("dim");
    last = performance.now();
    if (window.TodayGameRank) TodayGameRank.reset();
  }

  function gameOver() {
    state = "over";
    saveBest();
    updateHud();
    document.getElementById("over-detail").textContent =
      `웨이브 ${wave} · ${Math.floor(score).toLocaleString("ko-KR")}점`;
    showOverlay("over");
  }

  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        t: 0,
        color,
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, t: 0, color });
  }

  function spawnEnemy() {
    const d = difficulty();
    const lane = 40 + Math.random() * (W - 80);
    enemies.push({
      x: lane,
      y: -30,
      vx: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * d.enemySpeed),
      vy: 35 + Math.random() * 25,
      hp: d.enemyHp,
      t: 0,
      shoot: 0.4 + Math.random() * 0.8,
      hue: 200 + Math.random() * 120,
    });
  }

  function firePlayer() {
    bullets.push({ x: player.x, y: player.y - 28, vy: -420, friendly: true });
  }

  function hitPlayer() {
    if (invuln > 0) return;
    lives -= 1;
    invuln = 1.1;
    shake = 10;
    flash = 0.25;
    spawnBurst(player.x, player.y, "#ff6b8a", 14);
    updateHud();
    if (lives <= 0) gameOver();
  }

  function update(dt) {
    playTime += dt;
    wave = 1 + Math.floor(playTime / 18);
    const d = difficulty();

    let move = 0;
    if (keys.ArrowLeft || keys.a) move -= 1;
    if (keys.ArrowRight || keys.d) move += 1;
    if (dragX != null) {
      const target = dragX;
      const dx = target - player.x;
      player.x += Math.max(-320 * dt, Math.min(320 * dt, dx * 12 * dt));
    } else {
      player.x += move * 260 * dt;
    }
    player.x = Math.max(28, Math.min(W - 28, player.x));

    shield = holding || !!(keys[" "] || keys.Spacebar || keys.ShiftLeft || keys.ShiftRight);
    if (shield) hintEl.classList.add("dim");

    if (!shield) {
      fireAcc += dt;
      if (fireAcc >= d.fireRate) {
        fireAcc = 0;
        firePlayer();
      }
    } else {
      fireAcc = d.fireRate;
    }

    spawnAcc += dt;
    if (spawnAcc >= d.spawn) {
      spawnAcc = 0;
      const n = d.multi;
      for (let i = 0; i < n; i += 1) spawnEnemy();
    }

    if (invuln > 0) invuln -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 28);
    if (flash > 0) flash = Math.max(0, flash - dt);

    clouds.forEach((c) => {
      c.x += c.v * dt;
      if (c.x > W + 60) c.x = -60;
    });

    enemies.forEach((e) => {
      e.t += dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < 28 || e.x > W - 28) e.vx *= -1;
      e.shoot -= dt;
      if (e.shoot <= 0 && e.y > 20 && e.y < H - 160) {
        e.shoot = d.shootGap * (0.75 + Math.random() * 0.5);
        bullets.push({
          x: e.x,
          y: e.y + 16,
          vy: d.bulletSpeed,
          friendly: false,
        });
      }
    });
    enemies = enemies.filter((e) => e.y < H + 40 && e.hp > 0);

    bullets.forEach((b) => {
      b.y += b.vy * dt;
    });

    // collisions
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      if (b.y < -40 || b.y > H + 40) {
        bullets.splice(i, 1);
        continue;
      }
      if (b.friendly) {
        for (let j = enemies.length - 1; j >= 0; j -= 1) {
          const e = enemies[j];
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy < 28 * 28) {
            bullets.splice(i, 1);
            e.hp -= 1;
            spawnBurst(e.x, e.y, `hsl(${e.hue} 80% 60%)`, 6);
            if (e.hp <= 0) {
              const gain = 100 + wave * 8;
              score += gain;
              floatText(e.x, e.y, `+${gain}`, "#ff8a4c");
              spawnBurst(e.x, e.y, "#ffd76a", 16);
              enemies.splice(j, 1);
            }
            updateHud();
            break;
          }
        }
      } else {
        const dx = player.x - b.x;
        const dy = player.y - b.y;
        const shieldR = 46;
        const bodyR = player.r + 6;
        if (shield && dx * dx + dy * dy < shieldR * shieldR && b.y < player.y + 8) {
          bullets.splice(i, 1);
          score += 10;
          floatText(b.x, b.y, "+10", "#5ce1ff");
          spawnBurst(b.x, b.y, "#5ce1ff", 8);
          updateHud();
          continue;
        }
        if (invuln <= 0 && dx * dx + dy * dy < bodyR * bodyR) {
          bullets.splice(i, 1);
          hitPlayer();
        }
      }
    }

    // enemy body bump
    if (invuln <= 0) {
      for (const e of enemies) {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (dx * dx + dy * dy < 36 * 36) {
          if (shield && e.y < player.y) {
            e.vy = -Math.abs(e.vy) - 40;
            e.y = player.y - 40;
            score += 5;
          } else {
            hitPlayer();
          }
          break;
        }
      }
    }

    particles.forEach((p) => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
    });
    particles = particles.filter((p) => p.t < p.life);

    floats.forEach((f) => {
      f.t += dt;
      f.y -= 40 * dt;
    });
    floats = floats.filter((f) => f.t < 0.8);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#8fd0ff");
    g.addColorStop(0.55, "#b8e4ff");
    g.addColorStop(1, "#ffe8b8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      const s = 28 * c.s;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, s * 1.6, s * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - s * 0.7, c.y + 4, s, s * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + s * 0.8, c.y + 2, s * 1.1, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // ground strip
    ctx.fillStyle = "#8fd67f";
    ctx.fillRect(0, H - 54, W, 54);
    ctx.fillStyle = "#7bc86e";
    ctx.fillRect(0, H - 54, W, 10);
  }

  function drawChick(x, y, blinking) {
    ctx.save();
    ctx.translate(x, y);
    if (blinking) ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 60));

    // body
    ctx.fillStyle = "#ffd84a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // belly
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.ellipse(0, 6, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = "#2a3a55";
    ctx.beginPath();
    ctx.arc(-7, -4, 3.2, 0, Math.PI * 2);
    ctx.arc(7, -4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-6, -5, 1.1, 0, Math.PI * 2);
    ctx.arc(8, -5, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = "#ff8a4c";
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(4, 2);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();

    // feet
    ctx.strokeStyle = "#ff8a4c";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, 20);
    ctx.lineTo(-4, 26);
    ctx.moveTo(8, 20);
    ctx.lineTo(4, 26);
    ctx.stroke();

    ctx.restore();
  }

  function drawShield(x, y) {
    const pulse = 1 + Math.sin(performance.now() / 120) * 0.04;
    ctx.save();
    ctx.translate(x, y - 6);
    ctx.scale(pulse, pulse);
    const grd = ctx.createRadialGradient(0, 0, 8, 0, 0, 48);
    grd.addColorStop(0, "rgba(92, 225, 255, 0.55)");
    grd.addColorStop(0.7, "rgba(92, 225, 255, 0.18)");
    grd.addColorStop(1, "rgba(92, 225, 255, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 40, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.sin(e.t * 4) * 0.08);
    ctx.fillStyle = `hsl(${e.hue} 70% 58%)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(-6, -3, 4, 0, Math.PI * 2);
    ctx.arc(6, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a3a55";
    ctx.beginPath();
    ctx.arc(-6, -3, 2, 0, Math.PI * 2);
    ctx.arc(6, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    if (e.hp > 1) {
      ctx.fillStyle = "#fff";
      ctx.font = "12px Jua";
      ctx.textAlign = "center";
      ctx.fillText(String(e.hp), 0, 28);
    }
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawSky();

    enemies.forEach(drawEnemy);

    bullets.forEach((b) => {
      ctx.fillStyle = b.friendly ? "#ff8a4c" : "#ff5a7a";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.friendly ? 4.5 : 5.5, 0, Math.PI * 2);
      ctx.fill();
      if (b.friendly) {
        ctx.fillStyle = "#ffe0a0";
        ctx.beginPath();
        ctx.arc(b.x, b.y + 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (shield) drawShield(player.x, player.y);
    drawChick(player.x, player.y, invuln > 0);

    particles.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    floats.forEach((f) => {
      ctx.globalAlpha = 1 - f.t / 0.8;
      ctx.fillStyle = f.color;
      ctx.font = "16px Jua";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,100,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (state !== "play") {
      if (state === "title") {
        drawSky();
        drawChick(W / 2, H - 140, false);
      }
      return;
    }
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    canvas.setPointerCapture(e.pointerId);
    pointerId = e.pointerId;
    holding = true;
    const p = canvasPos(e);
    dragX = p.x;
  });

  canvas.addEventListener("pointermove", (e) => {
    if (state !== "play" || e.pointerId !== pointerId) return;
    dragX = canvasPos(e).x;
  });

  function endPointer(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    holding = false;
    dragX = null;
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (["ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  document.getElementById("rank-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submit-btn");
    const name = nameInput.value.trim();
    if (name.length < 2) return;
    localStorage.setItem(NAME_KEY, name);
    if (submitted) {
      document.getElementById("rank-msg").textContent = "이미 등록했어요";
      return;
    }
    btn.disabled = true;
    if (!window.TodayScores) {
      document.getElementById("rank-msg").textContent = "랭킹 모듈을 불러오지 못했어요";
      btn.disabled = false;
      return;
    }
    const res = await window.TodayScores.submitScore(GAME_ID, name, Math.floor(score));
    if (res.ok) {
      submitted = true;
      lastRank = { rankDay: res.rankDay || res.rank, rankWeek: res.rankWeek };
      document.getElementById("rank-msg").textContent = window.TodayScores.formatRankMessage
        ? window.TodayScores.formatRankMessage(res)
        : res.rank
          ? `오늘 ${res.rank}위에 등록됐어요!`
          : "등록 완료!";
      const shareBtn = document.getElementById("share-rank-btn");
      if (shareBtn) shareBtn.hidden = false;
      if (window.TodayGameRank && TodayGameRank.afterSubmit) {
        await TodayGameRank.afterSubmit({
          gameId: GAME_ID,
          gameTitle: GAME_TITLE,
          name,
          score: Math.floor(score),
          rankDay: lastRank.rankDay,
          label: `${Math.floor(score).toLocaleString("ko-KR")}점`,
        });
      }
    } else {
      document.getElementById("rank-msg").textContent = res.error || "등록 실패";
    }
    btn.disabled = false;
  });

  document.getElementById("share-rank-btn").addEventListener("click", async () => {
    const name = nameInput.value.trim() || "나";
    const msg = document.getElementById("rank-msg");
    if (!window.TodayScores || !TodayScores.shareRank) return;
    const result = await window.TodayScores.shareRank({
      gameTitle: GAME_TITLE,
      name,
      score: Math.floor(score),
      rankDay: lastRank.rankDay,
      rankWeek: lastRank.rankWeek,
      url: `https://www.todaygame.co.kr/games/${GAME_ID}/`,
    });
    msg.textContent = window.TodayScores.formatShareResult
      ? window.TodayScores.formatShareResult(result)
      : result.mode === "copy"
        ? "복사됨! 카톡·SNS에 붙여넣기 하세요"
        : result.error === "cancel"
          ? "공유를 취소했어요"
          : !result.ok
            ? "공유에 실패했어요"
            : "공유했어요!";
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: GAME_ID,
      gameTitle: GAME_TITLE,
      formParent: document.getElementById("over"),
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
        last = performance.now();
        return true;
      },
    });
  }

  seedClouds();
  updateHud();
  showOverlay("title");
  raf = requestAnimationFrame(frame);
})();
