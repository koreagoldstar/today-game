(() => {
  "use strict";

  const STORAGE_BEST = "tg_neon_runner_best";
  const audio = window.HipCore ? HipCore.createAudio("neon-runner") : null;
  const FALLBACK_SONG = { id: 0, name: "네온 하이웨이", bpm: 118, rate: 1, track: 0, offset: 0, diff: 1 };
  const SONGS = window.HipCore ? HipCore.buildSongList(20, 77, "neon-runner") : [FALLBACK_SONG];
  let songIndex = 0;
  function currentSong() {
    return SONGS[songIndex] || SONGS[0] || FALLBACK_SONG;
  }

  const stage = document.querySelector(".stage");
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const actions = document.getElementById("actions");
  const overlays = {
    title: document.getElementById("title"),
    count: document.getElementById("count"),
    over: document.getElementById("over"),
  };

  let W = 390;
  let H = 700;
  let dpr = 1;
  let state = "title";
  let startTime = 0;
  let pauseAccum = 0;
  let pauseAt = 0;
  let lastTs = 0;
  let rafId = 0;

  let speed = 280;
  let distance = 0;
  let hearts = 3;
  let iframe = 0;
  let beatPulse = 0;
  let nextBeatAt = 0;
  let nextObstacleAt = 2800;
  let lastType = "";
  const player = { y: 0, vy: 0, jumping: false, sliding: false, slideT: 0 };
  let obstacles = [];
  let particles = [];
  let buildings = [];
  let best = Number.parseInt(localStorage.getItem(STORAGE_BEST) || "0", 10) || 0;

  const sprites = { run: null, jump: null, slide: null, crate: null, bar: null };

  function gameNow() {
    if (state === "paused") return pauseAt - startTime - pauseAccum;
    return performance.now() - startTime - pauseAccum;
  }

  function show(id) {
    Object.keys(overlays).forEach((key) => overlays[key].classList.toggle("hidden", key !== id));
  }

  function hideAll() {
    Object.keys(overlays).forEach((key) => overlays[key].classList.add("hidden"));
  }

  function knockOut(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    const r0 = d[0];
    const g0 = d[1];
    const b0 = d[2];
    const greenScreen = g0 > 150 && g0 > r0 + 35 && g0 > b0 + 35;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (greenScreen) {
        if (g > 130 && g > r + 28 && g > b + 28) {
          const excess = g - Math.max(r, b);
          d[i + 3] = Math.max(0, d[i + 3] - excess * 3);
          if (g > 190 && r < 90 && b < 90) d[i + 3] = 0;
        }
      } else {
        const dr = r - r0;
        const dg = g - g0;
        const db = b - b0;
        if (dr * dr + dg * dg + db * db < 52 * 52 * 3) d[i + 3] = 0;
      }
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(knockOut(im));
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function groundY() {
    return H * 0.7;
  }

  function seedBuildings() {
    buildings = [];
    for (let i = 0; i < 10; i += 1) {
      buildings.push({
        x: i * 90,
        w: 48 + (i % 3) * 18,
        h: 80 + (i * 37) % 140,
        hue: i % 2 ? "#ff2d95" : "#00f5ff",
      });
    }
  }

  function resetRun() {
    speed = 250 + currentSong().diff * 16;
    distance = 0;
    hearts = 3;
    iframe = 0;
    beatPulse = 0;
    nextBeatAt = 0;
    nextObstacleAt = 2800;
    lastType = "";
    player.y = 0;
    player.vy = 0;
    player.jumping = false;
    player.sliding = false;
    player.slideT = 0;
    obstacles = [];
    particles = [];
    seedBuildings();
    renderHearts();
    document.getElementById("dist-text").textContent = "0m";
    document.getElementById("best-text").textContent = `${best}m`;
    const chip = document.getElementById("song-chip");
    if (chip) chip.textContent = currentSong().name;
    if (window.TodayGameRank) TodayGameRank.reset();
  }

  function renderHearts() {
    const el = document.getElementById("hearts");
    el.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const h = document.createElement("i");
      h.className = `heart${i < hearts ? "" : " empty"}`;
      el.appendChild(h);
    }
  }

  function doJump() {
    if (state !== "play") return;
    if (player.jumping || player.sliding) return;
    player.jumping = true;
    player.vy = -620;
    if (audio) audio.sfxHit("good");
  }

  function doSlide() {
    if (state !== "play") return;
    if (player.jumping) return;
    player.sliding = true;
    player.slideT = 0;
  }

  function spawnObstacle() {
    let type = Math.random() < 0.5 ? "low" : "high";
    if (type === lastType && Math.random() < 0.55) type = type === "low" ? "high" : "low";
    lastType = type;
    obstacles.push({ type, x: W + 50, hit: false });
  }

  function takeHit() {
    if (iframe > 0) return;
    hearts -= 1;
    iframe = 1400;
    renderHearts();
    if (audio) audio.sfxHit("miss");
    if (hearts <= 0) gameOver();
  }

  function gameOver() {
    if (state === "over") return;
    state = "over";
    cancelAnimationFrame(rafId);
    if (audio) audio.stop();
    actions.classList.add("hidden");
    const dist = Math.floor(distance);
    if (dist > best) {
      best = dist;
      localStorage.setItem(STORAGE_BEST, String(best));
    }
    document.getElementById("over-dist").textContent = `${dist}m`;
    document.getElementById("over-best").textContent = `BEST ${best}m`;
    document.getElementById("best-text").textContent = `${best}m`;
    show("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({
        gameId: "neon-runner",
        gameTitle: "네온 러너",
        formParent: overlays.over,
      });
      TodayGameRank.open(dist, { label: `${dist}m` });
    }
  }

  function update(dt, now) {
    const beat = 60000 / currentSong().bpm;
    while (now >= nextBeatAt) {
      beatPulse = 1;
      nextBeatAt += beat;
    }
    beatPulse = Math.max(0, beatPulse - dt / 280);
    speed = Math.min(520, speed + dt * 0.011);
    distance += (speed * dt) / 1000 / 9.2;

    if (player.jumping) {
      player.vy += 1680 * (dt / 1000);
      player.y += player.vy * (dt / 1000);
      if (player.y >= 0) {
        player.y = 0;
        player.jumping = false;
        player.vy = 0;
      }
    }
    if (player.sliding) {
      player.slideT += dt;
      if (player.slideT > 520) player.sliding = false;
    }
    if (iframe > 0) iframe -= dt;

    nextObstacleAt -= dt;
    if (nextObstacleAt <= 0) {
      spawnObstacle();
      const gap = beat * (2 + Math.floor(Math.random() * 2));
      nextObstacleAt = Math.max(720, gap - (speed - 280) * 0.4);
    }

    const playerX = W * 0.24;
    const gy = groundY();
    obstacles.forEach((o) => {
      o.x -= (speed * dt) / 1000;
      const near = Math.abs(o.x - playerX) < 22;
      if (!near || o.hit || iframe > 0) return;
      const jumpingClear = player.jumping && player.y < -28;
      const slidingClear = player.sliding;
      const hit = (o.type === "low" && !jumpingClear) || (o.type === "high" && !slidingClear);
      if (hit) {
        o.hit = true;
        takeHit();
      }
    });
    obstacles = obstacles.filter((o) => o.x > -80);

    buildings.forEach((b) => {
      b.x -= (speed * dt) / 1000 * 0.35;
      if (b.x < -90) {
        b.x += 10 * 90;
        b.h = 80 + Math.random() * 140;
      }
    });

    particles.forEach((p) => {
      p.x -= (speed * dt) / 1000 * 0.7;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);
    if (Math.random() < 0.45) {
      particles.push({
        x: W + 8,
        y: 20 + Math.random() * gy * 0.7,
        life: 1100,
        c: Math.random() < 0.5 ? "#00f5ff" : "#ff2d95",
      });
    }

    document.getElementById("dist-text").textContent = `${Math.floor(distance)}m`;
  }

  function drawSprite(img, x, y, w, h) {
    if (!img) return false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }

  function draw() {
    const gy = groundY();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#160a32");
    g.addColorStop(0.55, "#0c071c");
    g.addColorStop(1, "#070412");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const scale = 1 + beatPulse * 0.012;
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2);

    ctx.fillStyle = "rgba(255, 45, 149, 0.16)";
    ctx.beginPath();
    ctx.arc(W * 0.72, gy - 120, 90, 0, Math.PI * 2);
    ctx.fill();

    buildings.forEach((b) => {
      ctx.fillStyle = "rgba(18, 10, 40, 0.9)";
      ctx.fillRect(b.x, gy - b.h, b.w, b.h);
      ctx.strokeStyle = b.hue;
      ctx.globalAlpha = 0.45;
      ctx.strokeRect(b.x, gy - b.h, b.w, b.h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = b.hue;
      for (let yy = gy - b.h + 12; yy < gy - 16; yy += 18) {
        ctx.globalAlpha = 0.35;
        ctx.fillRect(b.x + 8, yy, 8, 8);
        ctx.fillRect(b.x + b.w - 16, yy, 8, 8);
        ctx.globalAlpha = 1;
      }
    });

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 1100);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, 22, 2);
      ctx.globalAlpha = 1;
    });

    ctx.strokeStyle = "rgba(0, 245, 255, 0.35)";
    ctx.lineWidth = 1;
    const gridOffset = (gameNow() / 18) % 42;
    for (let x = -40; x < W + 40; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x - gridOffset, gy);
      ctx.lineTo(x - gridOffset + (x - W / 2) * 0.35, H);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.strokeStyle = "rgba(0, 245, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();

    obstacles.forEach((o) => {
      if (o.type === "low") {
        const ok = drawSprite(sprites.crate, o.x - 28, gy - 56, 56, 56);
        if (!ok) {
          ctx.fillStyle = "#ff2d95";
          ctx.shadowColor = "#ff2d95";
          ctx.shadowBlur = 16;
          ctx.fillRect(o.x - 16, gy - 40, 32, 40);
          ctx.shadowBlur = 0;
        }
      } else {
        const ok = drawSprite(sprites.bar, o.x - 40, gy - 96, 80, 42);
        if (!ok) {
          ctx.fillStyle = "#ffe156";
          ctx.shadowColor = "#ffe156";
          ctx.shadowBlur = 16;
          ctx.fillRect(o.x - 22, gy - 92, 44, 28);
          ctx.shadowBlur = 0;
        }
      }
    });

    const playerX = W * 0.24;
    const blink = iframe > 0 && Math.floor(iframe / 80) % 2 === 0;
    if (!blink) {
      let img = sprites.run;
      let pw = 78;
      let ph = 78;
      let py = gy - ph + 8 + player.y;
      if (player.sliding) {
        img = sprites.slide || sprites.run;
        pw = 86;
        ph = 52;
        py = gy - ph + 6;
      } else if (player.jumping) {
        img = sprites.jump || sprites.run;
        py = gy - ph + 8 + player.y;
      }
      const drawn = drawSprite(img, playerX - pw / 2, py, pw, ph);
      if (!drawn) {
        ctx.font = player.sliding ? "32px sans-serif" : "40px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🐤", playerX, gy + player.y - 6);
      }
    }

    ctx.restore();
  }

  function frame(ts) {
    if (state !== "play") return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(40, ts - lastTs);
    lastTs = ts;
    update(dt, gameNow());
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function beginPlay() {
    hideAll();
    actions.classList.remove("hidden");
    state = "play";
    startTime = performance.now();
    pauseAccum = 0;
    lastTs = 0;
    nextBeatAt = 0;
    if (audio) audio.playTrack(currentSong().track, currentSong().rate, currentSong().offset);
    rafId = requestAnimationFrame(frame);
  }

  function runCountdown() {
    resetRun();
    state = "count";
    show("count");
    const seq = ["3", "2", "1", "달려!"];
    let i = 0;
    const num = document.getElementById("count-num");
    const tick = () => {
      if (state !== "count") return;
      if (i >= seq.length) {
        beginPlay();
        return;
      }
      num.textContent = seq[i];
      i += 1;
      setTimeout(tick, i === seq.length ? 420 : 680);
    };
    tick();
  }

  function bindAct(el, fn) {
    const go = (e) => {
      e.preventDefault();
      fn();
    };
    el.addEventListener("touchstart", go, { passive: false });
    el.addEventListener("mousedown", go);
  }

  bindAct(document.getElementById("jump-btn"), doJump);
  bindAct(document.getElementById("slide-btn"), doSlide);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      doJump();
    }
    if (e.code === "ArrowDown") {
      e.preventDefault();
      doSlide();
    }
  });

  function syncSongList() {
    const list = document.getElementById("song-list");
    const label = document.getElementById("pick-label");
    if (!list || !label) return;
    list.innerHTML = "";
    SONGS.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "song-item" + (i === songIndex ? " on" : "");
      btn.innerHTML = `<span>${i + 1}. ${item.name}</span><span class="meta">${item.bpm} BPM · ★${item.diff}</span>`;
      btn.addEventListener("click", () => {
        songIndex = i;
        syncSongList();
        const chip = document.getElementById("song-chip");
        if (chip) chip.textContent = currentSong().name;
      });
      list.appendChild(btn);
    });
    label.textContent = `${songIndex + 1}. ${currentSong().name}`;
    const on = list.querySelector(".song-item.on");
    if (on) on.scrollIntoView({ block: "nearest" });
  }

  function playSelected() {
    if (audio) audio.ensure();
    runCountdown();
  }

  function backToMenu() {
    if (audio) audio.stop();
    actions.classList.add("hidden");
    state = "title";
    show("title");
    syncSongList();
    draw();
  }

  document.getElementById("start-btn").addEventListener("click", playSelected);
  document.getElementById("retry-btn").addEventListener("click", playSelected);
  document.getElementById("next-btn").addEventListener("click", () => {
    songIndex = (songIndex + 1) % SONGS.length;
    syncSongList();
    playSelected();
  });
  document.getElementById("menu-btn").addEventListener("click", backToMenu);
  document.getElementById("share-btn").addEventListener("click", async () => {
    const btn = document.getElementById("share-btn");
    if (!window.TodayScores || !TodayScores.shareToKakao) return;
    const dist = Math.floor(distance);
    const canvas = TodayScores.makeResultCard
      ? TodayScores.makeResultCard({
          eyebrow: "오늘의게임 · 네온 러너",
          title: currentSong().name,
          hero: `${dist}m`,
          lines: [`BEST ${best}m`, "네온 도시를 달려 보세요"],
          bg0: "#12082a",
          bg1: "#041018",
          accent: "#00f5ff",
        })
      : null;
    const result = await TodayScores.shareToKakao({
      gameId: "neon-runner",
      gameTitle: "네온 러너",
      title: `네온 러너 ${dist}m`,
      description: `「${currentSong().name}」 · BEST ${best}m`,
      score: dist,
      scoreLabel: `${dist}m`,
      canvas,
      buttonTitle: "나도 달리기",
    });
    const prev = btn.textContent;
    btn.textContent = result.ok ? "공유 창 열림" : "공유 실패";
    setTimeout(() => {
      btn.textContent = prev;
    }, 1600);
  });

  window.addEventListener("resize", () => {
    resize();
    if (state !== "play") draw();
  });

  document.getElementById("best-text").textContent = `${best}m`;
  syncSongList();
  resize();
  seedBuildings();
  Promise.all([
    loadImg("assets/chick.png"),
    loadImg("assets/chick-jump.png"),
    loadImg("assets/chick-slide.png"),
    loadImg("assets/crate.png"),
    loadImg("assets/bar.png"),
  ]).then(([run, jump, slide, crate, bar]) => {
    sprites.run = run;
    sprites.jump = jump;
    sprites.slide = slide;
    sprites.crate = crate;
    sprites.bar = bar;
    draw();
  });
  draw();

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "neon-runner",
      gameTitle: "네온 러너",
      formParent: overlays.over,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        pauseAt = performance.now();
        state = "paused";
        if (audio && audio.pause) audio.pause();
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        pauseAccum += performance.now() - pauseAt;
        lastTs = 0;
        state = "play";
        if (audio && audio.resume) audio.resume();
        rafId = requestAnimationFrame(frame);
        return true;
      },
    });
  }
})();
