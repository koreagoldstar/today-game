(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BEST_KEY = "today-doodle-best";
  const NAME_KEY = "today-doodle-name";
  const GRAVITY = 2100;
  const JUMP = -720;
  const SPRING_JUMP = -1080;
  const MOVE_ACC = 3200;
  const MOVE_MAX = 340;
  const FRICTION = 0.86;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const overlays = {
    title: document.getElementById("title"),
    over: document.getElementById("over"),
  };

  const sprites = { hero: null, pads: null };

  function chromaKey(img) {
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
      else if (r > 220 && g < 80 && b > 220) d[i + 3] = 0;
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [hero, pads] = await Promise.all([
      loadImg("assets/hero.png"),
      loadImg("assets/pads.png"),
    ]);
    sprites.hero = chromaKey(hero) || hero;
    sprites.pads = chromaKey(pads) || pads;
  }

  let state = "title";
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0");
  let player = null;
  let platforms = [];
  let cameraY = 0;
  let maxHeight = 0;
  let clouds = [];
  let particles = [];
  let keys = { left: false, right: false };
  let touchX = null;
  let last = 0;
  let raf = 0;
  let flash = 0;
  let submitted = false;
  let facing = 1;

  document.getElementById("hud-best").textContent = String(best);
  const nameInput = document.getElementById("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";

  function showOverlay(key) {
    Object.entries(overlays).forEach(([k, el]) => el.classList.toggle("hidden", k !== key));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeClouds() {
    clouds = Array.from({ length: 10 }, (_, i) => ({
      x: rand(0, W),
      y: i * 90 + rand(-20, 20),
      s: rand(0.6, 1.3),
      v: rand(8, 22),
    }));
  }

  function platformGap() {
    const t = Math.min(1, maxHeight / 8000);
    return rand(52, 78) + t * 38;
  }

  function pickType() {
    const t = Math.min(1, maxHeight / 6000);
    const r = Math.random();
    if (r < 0.08 + t * 0.06) return "spring";
    if (r < 0.2 + t * 0.1) return "move";
    if (r < 0.32 + t * 0.12) return "break";
    return "solid";
  }

  function makePlatform(y) {
    const w = rand(58, 92);
    const type = pickType();
    return {
      x: rand(16, W - w - 16),
      y,
      w,
      h: 16,
      type,
      vx: type === "move" ? (Math.random() < 0.5 ? -1 : 1) * rand(55, 110) : 0,
      alive: true,
      breaking: 0,
    };
  }

  function seedPlatforms() {
    platforms = [];
    // 시작 발판
    platforms.push({
      x: W / 2 - 50,
      y: H - 80,
      w: 100,
      h: 16,
      type: "solid",
      vx: 0,
      alive: true,
      breaking: 0,
    });
    let y = H - 80;
    while (y > -H * 2) {
      y -= platformGap();
      platforms.push(makePlatform(y));
    }
  }

  function resetRun() {
    cameraY = 0;
    maxHeight = 0;
    score = 0;
    flash = 0;
    submitted = false;
    facing = 1;
    particles = [];
    player = {
      x: W / 2,
      y: H - 140,
      w: 42,
      h: 46,
      vx: 0,
      vy: 0,
    };
    seedPlatforms();
    document.getElementById("hud-score").textContent = "0";
    document.getElementById("rank-msg").textContent = "";
    document.getElementById("submit-btn").disabled = false;
    const shareEl = document.getElementById("share-rank-btn");
    if (shareEl) shareEl.hidden = true;
  }

  function worldToScreen(y) {
    return y - cameraY;
  }

  function updateScore() {
    const climbed = Math.max(0, Math.floor(Math.max(0, -cameraY) / 10));
    if (climbed !== score) {
      score = climbed;
      document.getElementById("hud-score").textContent = String(score);
    }
  }

  function bounce(mult = 1) {
    player.vy = JUMP * mult;
    for (let i = 0; i < 6; i += 1) {
      particles.push({
        x: player.x,
        y: player.y + player.h / 2,
        vx: (Math.random() - 0.5) * 120,
        vy: rand(40, 120),
        life: 0.3 + Math.random() * 0.2,
        color: ["#fff", "#9effd0", "#ffe27a", "#ff9ec4"][Math.floor(Math.random() * 4)],
      });
    }
  }

  function endRun() {
    state = "over";
    flash = 0.3;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      document.getElementById("hud-best").textContent = String(best);
    }
    document.getElementById("over-detail").textContent = `높이 ${score} · 최고 ${best}`;
    showOverlay("over");
  }

  function startGame() {
    resetRun();
    state = "play";
    showOverlay(null);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function ensurePlatforms() {
    const topNeeded = cameraY - 40;
    let highest = Infinity;
    platforms.forEach((p) => {
      if (p.alive) highest = Math.min(highest, p.y);
    });
    while (highest > topNeeded) {
      highest -= platformGap();
      platforms.push(makePlatform(highest));
    }
    platforms = platforms.filter((p) => p.y < cameraY + H + 80);
  }

  function update(dt) {
    if (flash > 0) flash -= dt;
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    particles = particles.filter((p) => p.life > 0);

    clouds.forEach((c) => {
      c.x += c.v * dt * 0.15;
      if (c.x > W + 60) c.x = -60;
    });

    if (state !== "play" || !player) return;

    let ax = 0;
    if (keys.left) ax -= 1;
    if (keys.right) ax += 1;
    if (touchX != null) {
      const nx = touchX / W;
      ax = Math.max(-1, Math.min(1, (nx - 0.5) * 2.4));
    }

    if (ax !== 0) {
      player.vx += ax * MOVE_ACC * dt;
      facing = ax > 0 ? 1 : -1;
    } else {
      player.vx *= FRICTION;
    }
    player.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, player.vx));

    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // wrap horizontal
    if (player.x < -20) player.x = W + 20;
    if (player.x > W + 20) player.x = -20;

    platforms.forEach((p) => {
      if (!p.alive) return;
      if (p.type === "move") {
        p.x += p.vx * dt;
        if (p.x < 8 || p.x + p.w > W - 8) p.vx *= -1;
      }
      if (p.breaking > 0) {
        p.breaking -= dt;
        if (p.breaking <= 0) p.alive = false;
      }
    });

    // land on platforms only when falling
    if (player.vy > 0) {
      const feet = player.y + player.h / 2;
      const prevFeet = feet - player.vy * dt;
      for (const p of platforms) {
        if (!p.alive) continue;
        const top = p.y;
        if (prevFeet <= top && feet >= top) {
          const left = player.x - player.w * 0.28;
          const right = player.x + player.w * 0.28;
          if (right > p.x && left < p.x + p.w) {
            player.y = top - player.h / 2;
            player.vy = 0;
            if (p.type === "spring") {
              bounce(SPRING_JUMP / JUMP);
            } else if (p.type === "break") {
              bounce(1);
              p.breaking = 0.18;
            } else {
              bounce(1);
            }
            break;
          }
        }
      }
    }

    // camera follow
    const screenY = worldToScreen(player.y);
    if (screenY < H * 0.38) {
      const dy = H * 0.38 - screenY;
      cameraY -= dy;
      maxHeight = Math.max(maxHeight, -cameraY);
    }

    ensurePlatforms();
    updateScore();

    if (worldToScreen(player.y) > H + 40) {
      endRun();
    }
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#9ad8ff");
    g.addColorStop(0.55, "#c8ecff");
    g.addColorStop(1, "#e8fff4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    clouds.forEach((c) => {
      const sy = ((c.y - cameraY * 0.2) % (H + 100) + H + 100) % (H + 100) - 40;
      ctx.beginPath();
      ctx.ellipse(c.x, sy, 36 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 22 * c.s, sy + 4, 20 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 24 * c.s, sy + 3, 22 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlatform(p) {
    if (!p.alive) return;
    const sy = worldToScreen(p.y);
    if (sy < -40 || sy > H + 40) return;
    const shake = p.breaking > 0 ? (Math.random() - 0.5) * 4 : 0;
    const x = p.x + shake;
    const y = sy;

    const colors = {
      solid: { top: "#7dffc2", side: "#2fbf8a" },
      move: { top: "#ff9ec4", side: "#e04f84" },
      break: { top: "#ffb07a", side: "#e07840" },
      spring: { top: "#ffe27a", side: "#e0a83a" },
    };
    const col = colors[p.type] || colors.solid;

    ctx.fillStyle = col.side;
    roundRect(x, y, p.w, p.h, 8);
    ctx.fill();
    ctx.fillStyle = col.top;
    roundRect(x, y, p.w, p.h - 4, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    roundRect(x + 6, y + 3, p.w - 12, 4, 3);
    ctx.fill();

    if (p.type === "spring") {
      ctx.strokeStyle = "#c98a18";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + p.w * 0.35, y + p.h);
      ctx.lineTo(x + p.w * 0.35, y + p.h + 10);
      ctx.moveTo(x + p.w * 0.65, y + p.h);
      ctx.lineTo(x + p.w * 0.65, y + p.h + 10);
      ctx.stroke();
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

  function drawPlayer() {
    const sx = player.x;
    const sy = worldToScreen(player.y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(facing, 1);
    const pw = player.w;
    const ph = player.h;
    if (sprites.hero) {
      ctx.drawImage(sprites.hero, -pw / 2, -ph / 2, pw, ph);
    } else {
      ctx.fillStyle = "#6fd6b0";
      ctx.beginPath();
      ctx.ellipse(0, 0, pw * 0.42, ph * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(6, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(7, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    drawSky();
    platforms.forEach(drawPlatform);

    particles.forEach((p) => {
      const sy = worldToScreen(p.y);
      ctx.globalAlpha = Math.max(0, p.life * 2.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (player) drawPlayer();

    if (state === "play") {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 40px 'Bagel Fat One', Jua";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(40,80,70,0.22)";
      ctx.lineWidth = 6;
      ctx.strokeText(String(score), W / 2, 84);
      ctx.fillText(String(score), W / 2, 84);
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    if (e.code === "Space" && state === "title") {
      e.preventDefault();
      startGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  });

  function setTouch(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const rect = canvas.getBoundingClientRect();
    touchX = ((t.clientX - rect.left) / rect.width) * W;
  }
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (state === "title") startGame();
    else setTouch(e);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    setTouch(e);
  }, { passive: false });
  canvas.addEventListener("touchend", () => {
    touchX = null;
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    if (state === "title") startGame();
    else {
      const rect = canvas.getBoundingClientRect();
      touchX = ((e.clientX - rect.left) / rect.width) * W;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || state !== "play") return;
    if (e.buttons) {
      const rect = canvas.getBoundingClientRect();
      touchX = ((e.clientX - rect.left) / rect.width) * W;
    }
  });
  canvas.addEventListener("pointerup", () => {
    touchX = null;
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  let lastRank = { rankDay: null, rankWeek: null };
  const shareBtn = document.getElementById("share-rank-btn");

  document.getElementById("rank-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitted) return;
    const name = nameInput.value.trim();
    if (name.length < 2 || name.length > 8) {
      document.getElementById("rank-msg").textContent = "이름은 2~8자로 적어 주세요";
      return;
    }
    localStorage.setItem(NAME_KEY, name);
    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    document.getElementById("rank-msg").textContent = "등록 중…";
    if (!window.TodayScores) {
      document.getElementById("rank-msg").textContent = "랭킹 모듈을 불러오지 못했어요";
      btn.disabled = false;
      return;
    }
    const res = await window.TodayScores.submitScore("doodle", name, score);
    if (res.ok) {
      submitted = true;
      lastRank = { rankDay: res.rankDay || res.rank, rankWeek: res.rankWeek };
      document.getElementById("rank-msg").textContent =
        window.TodayScores.formatRankMessage
          ? window.TodayScores.formatRankMessage(res)
          : res.rank
            ? `오늘 ${res.rank}위에 등록됐어요!`
            : "등록 완료!";
      if (shareBtn) shareBtn.hidden = false;
      if (window.TodayGameRank && TodayGameRank.afterSubmit) {
        await TodayGameRank.afterSubmit({
          gameId: "doodle",
          gameTitle: "폴짝 하늘",
          name,
          score,
          rankDay: lastRank.rankDay,
          label: `${score.toLocaleString("ko-KR")}점`,
        });
      }
    } else {
      document.getElementById("rank-msg").textContent = "등록 실패 · 다시 시도해 주세요";
      btn.disabled = false;
    }
  });

  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim() || "나";
      const result = await window.TodayScores.shareRank({
        gameTitle: "폴짝 하늘",
        name,
        score,
        rankDay: lastRank.rankDay,
        rankWeek: lastRank.rankWeek,
        url: "https://www.todaygame.co.kr/games/doodle/",
      });
      const msg = document.getElementById("rank-msg");
      msg.textContent = window.TodayScores.formatShareResult
        ? window.TodayScores.formatShareResult(result)
        : result.mode === "copy"
          ? "복사됨! 카톡·SNS에 붙여넣기 하세요"
          : result.error === "cancel"
            ? "공유를 취소했어요"
            : !result.ok
              ? "공유에 실패했어요"
              : "";
      if (result.mode === "share") msg.textContent = "";
    });
  }

  makeClouds();
  resetRun();
  showOverlay("title");
  loadAssets().then(() => {
    draw();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  });
})();
