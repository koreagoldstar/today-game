(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GROUND = 96;
  const BEST_KEY = "today-flappy-best";
  const NAME_KEY = "today-flappy-name";

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

  const sprites = { bird: null, pipe: null, thumb: null };

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
    const [bird, pipe, thumb] = await Promise.all([
      loadImg("assets/bird.png"),
      loadImg("assets/pipe.png"),
      loadImg("assets/thumb.png"),
    ]);
    sprites.bird = chromaKey(bird) || bird;
    sprites.pipe = chromaKey(pipe) || pipe;
    sprites.thumb = thumb;
  }

  let state = "title";
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0");
  let bird = null;
  let pipes = [];
  let clouds = [];
  let hills = [];
  let particles = [];
  let scroll = 0;
  let spawnAcc = 0;
  let groundX = 0;
  let last = 0;
  let raf = 0;
  let flash = 0;
  let submitted = false;

  document.getElementById("hud-best").textContent = String(best);
  const nameInput = document.getElementById("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";

  function showOverlay(key) {
    Object.entries(overlays).forEach(([k, el]) => el.classList.toggle("hidden", k !== key));
  }

  function difficulty() {
    // 점수가 오를수록 더 가혹하게 (틈은 플레이 가능하게 유지)
    const t = Math.min(1, score / 40);
    return {
      speed: 168 + score * 5.2 + t * 40,
      gap: Math.max(128, 178 - score * 1.1),
      gravity: 1680 + score * 18,
      flap: -390 - Math.min(40, score * 0.8),
      spawnEvery: Math.max(1.05, 1.55 - score * 0.012),
      pipeW: 64,
    };
  }

  function resetRun() {
    const mid = H * 0.42;
    bird = {
      x: W * 0.32,
      y: mid,
      vy: 0,
      r: 16,
      rot: 0,
      flapT: 0,
    };
    pipes = [];
    particles = [];
    score = 0;
    scroll = 0;
    spawnAcc = 0.9;
    groundX = 0;
    flash = 0;
    submitted = false;
    document.getElementById("hud-score").textContent = "0";
    document.getElementById("rank-msg").textContent = "";
    document.getElementById("submit-btn").disabled = false;
    const shareEl = document.getElementById("share-rank-btn");
    if (shareEl) shareEl.hidden = true;
  }

  function makeDecor() {
    clouds = Array.from({ length: 6 }, (_, i) => ({
      x: (i * 97) % W,
      y: 40 + ((i * 53) % 180),
      s: 0.7 + (i % 3) * 0.2,
      v: 12 + (i % 4) * 4,
    }));
    hills = [
      { x: 0, h: 70, c: "#7bc96f" },
      { x: 140, h: 90, c: "#6bb85f" },
      { x: 280, h: 75, c: "#7bc96f" },
    ];
  }

  function spawnPipe() {
    const d = difficulty();
    const margin = 70;
    const gap = d.gap;
    const topH = margin + Math.random() * (H - GROUND - margin * 2 - gap);
    pipes.push({
      x: W + 20,
      w: d.pipeW,
      top: topH,
      gap,
      scored: false,
    });
  }

  function flap() {
    if (state !== "play") return;
    const d = difficulty();
    bird.vy = d.flap;
    bird.flapT = 0.18;
    for (let i = 0; i < 5; i += 1) {
      particles.push({
        x: bird.x - 8,
        y: bird.y + 4,
        vx: -40 - Math.random() * 40,
        vy: (Math.random() - 0.5) * 60,
        life: 0.25 + Math.random() * 0.2,
        color: "#fff6b0",
      });
    }
  }

  function hitPipe(p) {
    const bx = bird.x;
    const by = bird.y;
    // 보이는 병아리(약 52px)보다 작게 — 관 사이로 지나갈 수 있게
    const hw = 12;
    const hh = 11;
    // 가로: 관 몸통만 (림 확장분 제외)
    if (bx + hw < p.x + 2 || bx - hw > p.x + p.w - 2) return false;
    // 세로: 관 끝을 약간 안쪽으로 인정 (투명 스프라이트/림 오차 보정)
    const gapTop = p.top + 4;
    const gapBot = p.top + p.gap - 4;
    if (by + hh > gapTop && by - hh < gapBot) return false;
    return true;
  }

  function endRun() {
    state = "over";
    flash = 0.35;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      document.getElementById("hud-best").textContent = String(best);
    }
    document.getElementById("over-detail").textContent =
      `점수 ${score} · 최고 ${best}`;
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

  function update(dt) {
    if (flash > 0) flash -= dt;
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    particles = particles.filter((p) => p.life > 0);

    clouds.forEach((c) => {
      c.x -= c.v * dt;
      if (c.x < -80) c.x = W + 40;
    });

    if (state !== "play") return;

    const d = difficulty();
    bird.vy += d.gravity * dt;
    bird.y += bird.vy * dt;
    bird.rot = Math.max(-0.55, Math.min(1.1, bird.vy / 520));
    if (bird.flapT > 0) bird.flapT -= dt;

    groundX = (groundX - d.speed * dt) % 48;
    scroll += d.speed * dt;

    spawnAcc += dt;
    if (spawnAcc >= d.spawnEvery) {
      spawnAcc = 0;
      spawnPipe();
    }

    for (let i = pipes.length - 1; i >= 0; i -= 1) {
      const p = pipes[i];
      p.x -= d.speed * dt;
      if (!p.scored && p.x + p.w < bird.x - bird.r) {
        p.scored = true;
        score += 1;
        document.getElementById("hud-score").textContent = String(score);
      }
      if (p.x + p.w < -40) pipes.splice(i, 1);
      else if (hitPipe(p)) {
        endRun();
        return;
      }
    }

    if (bird.y + bird.r * 0.7 >= H - GROUND || bird.y - bird.r * 0.7 < 4) {
      endRun();
    }
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#8fd4ff");
    g.addColorStop(0.55, "#c8e9ff");
    g.addColorStop(1, "#ffe8b8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    clouds.forEach((c) => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 34 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 22 * c.s, c.y + 4, 20 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 24 * c.s, c.y + 3, 22 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    hills.forEach((h, i) => {
      ctx.fillStyle = h.c;
      ctx.beginPath();
      ctx.ellipse((h.x + scroll * 0.15) % (W + 200) - 40, H - GROUND + 10, 110 + i * 20, h.h, 0, Math.PI, 0);
      ctx.fill();
    });
  }

  function drawGround() {
    ctx.fillStyle = "#5fbf4a";
    ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = "#7ed957";
    ctx.fillRect(0, H - GROUND, W, 18);
    ctx.fillStyle = "#c48a4a";
    ctx.fillRect(0, H - GROUND + 18, W, GROUND - 18);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let x = groundX; x < W + 48; x += 48) {
      ctx.fillRect(x, H - GROUND + 28, 24, 8);
    }
  }

  function drawPipe(p) {
    const topH = p.top;
    const botY = p.top + p.gap;
    const botH = Math.max(0, H - GROUND - botY);
    const rim = 20;

    // 충돌 영역과 동일한 불투명 관 몸통 (투명 스프라이트 여백 때문에
    // 틈이 더 넓어 보이던 버그 방지)
    const paintBody = (x, y, w, h) => {
      if (h <= 0) return;
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, "#3aaa34");
      g.addColorStop(0.35, "#62d454");
      g.addColorStop(0.7, "#4fbf45");
      g.addColorStop(1, "#2f8a2a");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x + 8, y + 4, 9, Math.max(0, h - 8));
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(x + w - 10, y + 4, 6, Math.max(0, h - 8));
    };

    paintBody(p.x, 0, p.w, topH);
    paintBody(p.x, botY, p.w, botH);

    // 관 입구 림 (틈 안쪽이 아니라 관 끝면에 붙임)
    const paintRim = (y) => {
      ctx.fillStyle = "#2f8a2a";
      ctx.fillRect(p.x - 5, y, p.w + 10, rim);
      ctx.fillStyle = "#6fd85f";
      ctx.fillRect(p.x - 5, y, p.w + 10, 5);
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(p.x - 3, y + 2, p.w + 6, 3);
    };
    paintRim(topH - rim);
    paintRim(botY);
  }

  function drawBird() {
    const wing = bird.flapT > 0 ? -0.45 : 0.15;
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot + wing * 0.15);
    const size = 44;
    if (sprites.bird) {
      ctx.drawImage(sprites.bird, -size * 0.52, -size * 0.48, size, size);
    } else {
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff9a3a";
      ctx.beginPath();
      ctx.moveTo(14, -2);
      ctx.lineTo(26, 2);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(6, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(7, -4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    drawSky();
    pipes.forEach(drawPipe);
    drawGround();

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 3);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (bird) drawBird();

    if (state === "play") {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 42px 'Bagel Fat One', Jua";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(60,80,40,0.25)";
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

  function onFlap(e) {
    if (e && e.cancelable) e.preventDefault();
    if (state === "title") return;
    if (state === "over") return;
    flap();
  }

  canvas.addEventListener("pointerdown", onFlap, { passive: false });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (state === "title") startGame();
      else onFlap();
    }
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
    const res = await window.TodayScores.submitScore("flappy", name, score);
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
          gameId: "flappy",
          gameTitle: "펄럭 병아리",
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
        gameTitle: "펄럭 병아리",
        name,
        score,
        rankDay: lastRank.rankDay,
        rankWeek: lastRank.rankWeek,
        url: "https://www.todaygame.co.kr/games/flappy/",
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

  makeDecor();
  resetRun();
  showOverlay("title");
  loadAssets().then(() => {
    draw();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
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
