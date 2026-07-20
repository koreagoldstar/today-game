(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BEST_KEY = "today-jump-run-best";
  const NAME_KEY = "today-jump-run-name";
  const PLAYER_X = 110;
  const GRAVITY = 1950;
  const JUMP_V = -680;
  const JUMP_CUT = 0.42;
  const COYOTE = 0.12;
  const JUMP_BUF = 0.14;
  const GROUND_Y = H - 90;

  const STAGE_NAMES = [
    "햇살 초원",
    "구름 산책",
    "콩콩 연습",
    "코인 마을",
    "가시 주의",
    "하늘 다리",
    "점프 축제",
    "바람 언덕",
    "무지개 길",
    "고공 비행",
    "챔피언 코스",
    "콩콩 왕국",
    "스프링 파크",
    "흔들 구름",
    "별똥별 길",
    "무너지는 탑",
    "돌풍 계곡",
    "새떼 주의",
    "최종 질주",
    "콩콩 전설",
    "구름 미끄럼",
    "캔디 절벽",
    "회오리 점프",
    "골드 레인",
    "야간 비행",
    "폭풍 다리",
    "슈퍼 스프링",
    "별빛 질주",
    "끝없는 하늘",
    "콩콩 마스터",
    "달빛 질주",
    "솜사탕 다리",
    "번개 점프",
    "오로라 코스",
    "빙글 구름",
    "황금 가시밭",
    "바람의 왕",
    "별가루 레이스",
    "천공 미로",
    "콩콩 시련",
    "폭풍의 정상",
    "무지개 절벽",
    "슈퍼노바 점프",
    "유성 고속도로",
    "구름 요새",
    "최종 돌풍",
    "전설의 스프링",
    "무한 하늘",
    "왕관 질주",
    "콩콩 신화",
  ];

  const PLAT_COLORS = [
    { top: "#ff7eb3", side: "#c44f9a", leaf: "#6fd46a" },
    { top: "#ffe27a", side: "#e0a83a", leaf: "#7bc96f" },
    { top: "#7dffc2", side: "#2fbf8a", leaf: "#5aaa4a" },
    { top: "#7ad8ff", side: "#3a9fd0", leaf: "#6fd46a" },
    { top: "#ffb07a", side: "#e07840", leaf: "#7bc96f" },
    { top: "#d4b0ff", side: "#8a6ad0", leaf: "#6fd46a" },
  ];

  function getDifficulty() {
    // soft ramp: ~1100 dist ≈ 1 level, caps around old stage 49 feel
    const level = Math.min(49, Math.floor(distance / 1100));
    const t = level / 49;
    return {
      level: level + 1,
      name: STAGE_NAMES[Math.min(STAGE_NAMES.length - 1, level)] || `레벨 ${level + 1}`,
      meter: (distance % 1100) / 1100,
      speed: 158 + level * 12,
      gapMin: 52 + level * 3.5,
      gapMax: 92 + level * 7,
      heightVar: 38 + level * 6,
      spikeRate: Math.min(0.4, 0.05 + level * 0.018),
      coinRate: Math.max(0.42, 0.88 - level * 0.02),
      platWMin: Math.max(68, 128 - level * 2.5),
      platWMax: Math.max(108, 188 - level * 3),
      moveRate: Math.min(0.34, 0.06 + t * 0.28),
      springRate: Math.min(0.24, 0.05 + t * 0.2),
      crumbleRate: Math.min(0.26, 0.03 + t * 0.24),
      birdRate: Math.min(0.28, 0.04 + t * 0.24),
      windRate: Math.min(0.22, 0.03 + t * 0.2),
      starRate: Math.min(0.2, 0.07 + t * 0.12),
    };
  }

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

  const sprites = { hero: null, platform: null, coin: null, spike: null, cloud: null };
  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;

  let state = "title";
  let score = 0;
  let distance = 0;
  let scroll = 0;
  let last = 0;
  let raf = 0;
  let flash = 0;
  let shake = 0;
  let hintTimer = 0;
  let holdJump = false;
  let jumpQueued = false;
  let jumpBuf = 0;
  let coyote = 0;
  let wasOnGround = false;
  let submitted = false;

  const nameInput = document.getElementById("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";

  let platforms = [];
  let coins = [];
  let spikes = [];
  let birds = [];
  let winds = [];
  let particles = [];
  let floats = [];
  let cloudsFar = [];
  let cloudsNear = [];
  let hills = [];
  let sunRays = 0;
  let genX = 0;
  let runAnim = 0;
  let landSquash = 0;
  let deadTimer = 0;
  let eventMsg = "";
  let eventMsgT = 0;
  let sectionCooldown = 0;

  const player = {
    x: PLAYER_X,
    y: GROUND_Y - 36,
    vy: 0,
    w: 42,
    h: 42,
    onGround: false,
    facing: 1,
  };

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    // chroma magenta leftovers
    if (r > 185 && b > 175 && g < 145 && r + b > g * 2.1) return true;
    if (r > 210 && b > 200 && g < 160 && Math.abs(r - b) < 90) return true;
    // studio sky / light wash
    if (b > 170 && g > 150 && r > 80 && b >= g - 10 && g >= r - 30) return true;
    if (b > 200 && g > 180 && r > 140 && Math.abs(b - g) < 45) return true;
    if (r > 210 && g > 220 && b > 230) return true;
    if (g > 200 && b > 210 && r > 160 && b >= r && g >= r - 10 && (r + g + b) / 3 > 195) return true;
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
    let minX = c.width;
    let minY = c.height;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        d[i + 3] = 0;
        continue;
      }
      const px = (i / 4) % c.width;
      const py = ((i / 4) / c.width) | 0;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    x.putImageData(data, 0, 0);
    if (maxX <= minX || maxY <= minY) return c;
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(c.width - 1, maxX + pad);
    maxY = Math.min(c.height - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d").drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  function spriteSize(spr) {
    return { w: spr.width || spr.naturalWidth || 1, h: spr.height || spr.naturalHeight || 1 };
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
    const [hero, platform, coin, spike, cloud] = await Promise.all([
      loadImg("assets/hero.png"),
      loadImg("assets/platform.png"),
      loadImg("assets/coin.png"),
      loadImg("assets/spike.png"),
      loadImg("assets/cloud.png"),
    ]);
    if (hero) sprites.hero = punchBg(hero);
    if (platform) sprites.platform = punchBg(platform);
    if (coin) sprites.coin = punchBg(coin);
    if (spike) sprites.spike = punchBg(spike);
    if (cloud) sprites.cloud = punchBg(cloud);
  }

  function show(el, on) {
    el.classList.toggle("hidden", !on);
  }

  function hideAll() {
    Object.values(overlays).forEach((o) => show(o, false));
  }

  function updateHud() {
    const st = getDifficulty();
    document.getElementById("hud-stage").textContent = String(st.level);
    document.getElementById("hud-score").textContent = String(Math.floor(score));
    document.getElementById("hud-dist").textContent = String(Math.floor(distance));
    document.getElementById("hud-best").textContent = String(Math.floor(best));
    document.getElementById("goal-fill").style.width =
      `${Math.min(100, st.meter * 100)}%`;
  }

  function saveBest() {
    const s = Math.floor(score);
    if (s > best) {
      best = s;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function makeClouds() {
    cloudsFar = [];
    cloudsNear = [];
    for (let i = 0; i < 8; i += 1) {
      cloudsFar.push({
        x: Math.random() * W * 1.5,
        y: 40 + Math.random() * 180,
        s: 0.5 + Math.random() * 0.6,
        w: 50 + Math.random() * 70,
      });
    }
    for (let i = 0; i < 5; i += 1) {
      cloudsNear.push({
        x: Math.random() * W * 1.5,
        y: 80 + Math.random() * 220,
        s: 0.85 + Math.random() * 0.5,
        w: 70 + Math.random() * 90,
      });
    }
    hills = [];
    for (let i = 0; i < 4; i += 1) {
      hills.push({
        x: i * 160 - 40,
        y: GROUND_Y + 20,
        w: 180 + Math.random() * 80,
        h: 50 + Math.random() * 40,
        c: i % 2 ? "#9ed48a" : "#8bc97a",
      });
    }
  }

  function showEvent(text) {
    eventMsg = text;
    eventMsgT = 1.8;
  }

  function addPlatform(x, y, w, colorIdx, opts = {}) {
    const st = getDifficulty();
    let kind = opts.kind || "normal";
    if (!opts.kind && x > 260) {
      const roll = Math.random();
      if (roll < st.springRate) kind = "spring";
      else if (roll < st.springRate + st.moveRate) kind = "move";
      else if (roll < st.springRate + st.moveRate + st.crumbleRate) kind = "crumble";
    }

    const p = {
      x,
      y,
      baseY: y,
      w,
      h: 28,
      color: PLAT_COLORS[colorIdx % PLAT_COLORS.length],
      flower: Math.random() < 0.35,
      sprout: Math.random() < 0.25,
      kind,
      phase: Math.random() * Math.PI * 2,
      moveAmp: kind === "move" ? rand(18, 36) : 0,
      moveSpd: kind === "move" ? rand(1.6, 2.8) : 0,
      crumble: 0,
      falling: false,
      fallVy: 0,
    };
    platforms.push(p);

    if (Math.random() < st.coinRate && w > 70 && kind !== "crumble") {
      const n = 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i += 1) {
        coins.push({
          x: x + 24 + i * 28 + rand(0, 8),
          y: y - 28 - (i % 2) * 10,
          r: 10,
          taken: false,
          bob: Math.random() * Math.PI * 2,
          star: false,
          value: 10,
        });
      }
    }

    if (Math.random() < st.starRate && w > 90 && x > 300) {
      coins.push({
        x: x + w * 0.5,
        y: y - 48,
        r: 14,
        taken: false,
        bob: Math.random() * Math.PI * 2,
        star: true,
        value: 50,
      });
    }

    if (Math.random() < st.spikeRate && w > 100 && x > 200 && kind === "normal") {
      const sx = x + rand(20, w - 40);
      spikes.push({ x: sx, y: y, w: 28, h: 22 });
    }
  }

  function addCoinArc(x0, y0, count) {
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      coins.push({
        x: x0 + t * 90,
        y: y0 - Math.sin(t * Math.PI) * 55,
        r: 10,
        taken: false,
        bob: t * 2,
        star: false,
        value: 10,
      });
    }
  }

  function addBird(x, y) {
    birds.push({
      x,
      y,
      w: 34,
      h: 22,
      vx: -rand(40, 90),
      flap: Math.random() * Math.PI * 2,
    });
  }

  function addWind(x, w, up) {
    winds.push({
      x,
      w,
      up,
      life: 1,
    });
  }

  function generateAhead() {
    const st = getDifficulty();
    while (genX < scroll + W + 320) {
      if (platforms.length === 0) {
        addPlatform(40, GROUND_Y - 10, 220, 0, { kind: "normal" });
        genX = 260;
        continue;
      }

      const lastP = platforms[platforms.length - 1];
      let gap = rand(st.gapMin, st.gapMax);
      let w = rand(st.platWMin, st.platWMax);
      const baseY = GROUND_Y - 10;
      const yOff = rand(-st.heightVar, st.heightVar * 0.55);
      let y = Math.max(H * 0.38, Math.min(GROUND_Y - 8, baseY + yOff));
      const colorIdx = platforms.length % PLAT_COLORS.length;
      let x = lastP.x + lastP.w + gap;

      // 특별 구간 이벤트
      if (sectionCooldown <= 0 && x > 400 && Math.random() < 0.28) {
        const ev = Math.random();
        if (ev < 0.22) {
          // 좁은 다리
          showEvent("하늘 다리!");
          for (let i = 0; i < 4; i += 1) {
            addPlatform(x + i * 78, y + (i % 2) * 18 - 10, 58, colorIdx + i, { kind: "normal" });
          }
          genX = x + 4 * 78 + 58;
          sectionCooldown = 380;
          continue;
        }
        if (ev < 0.4) {
          // 코인 무지개
          showEvent("코인 아치!");
          addPlatform(x, y, w, colorIdx);
          addCoinArc(x + w * 0.2, y - 10, 6);
          genX = x + w;
          sectionCooldown = 300;
          continue;
        }
        if (ev < 0.55 && st.birdRate > 0.05) {
          showEvent("새떼 주의!");
          addPlatform(x, y, w * 1.1, colorIdx);
          addBird(x + 120, y - 70);
          addBird(x + 180, y - 110);
          if (Math.random() < 0.5) addBird(x + 240, y - 55);
          genX = x + w * 1.1;
          sectionCooldown = 340;
          continue;
        }
        if (ev < 0.7 && st.windRate > 0.04) {
          const up = Math.random() < 0.65;
          showEvent(up ? "상승 기류!" : "하강 기류!");
          addPlatform(x, y, w, colorIdx);
          addWind(x - 20, w + 140, up);
          genX = x + w;
          sectionCooldown = 320;
          continue;
        }
        if (ev < 0.85) {
          showEvent("스프링 존!");
          for (let i = 0; i < 3; i += 1) {
            addPlatform(x + i * (w + 40), y - i * 22, Math.max(70, w - 10), colorIdx + i, { kind: "spring" });
          }
          genX = x + 3 * (w + 40);
          sectionCooldown = 360;
          continue;
        }
        showEvent("흔들 발판!");
        addPlatform(x, y, w, colorIdx, { kind: "move" });
        addPlatform(x + w + gap * 0.7, y - 30, w * 0.9, colorIdx + 1, { kind: "move" });
        genX = x + w + gap * 0.7 + w * 0.9;
        sectionCooldown = 340;
        continue;
      }

      addPlatform(x, y, w, colorIdx);
      genX = x + w;
    }
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(speed * 0.3, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: rand(0.35, 0.7),
        max: 0.7,
        r: rand(2, 5),
        color,
        g: 400,
      });
    }
  }

  function dust(x, y) {
    for (let i = 0; i < 6; i += 1) {
      particles.push({
        x: x + rand(-10, 10),
        y: y,
        vx: rand(-40, -10),
        vy: rand(-60, -10),
        life: rand(0.2, 0.45),
        max: 0.45,
        r: rand(2, 4),
        color: "rgba(232,213,184,0.85)",
        g: 200,
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.8, vy: -50 });
  }

  function resetStage() {
    score = 0;
    distance = 0;
    scroll = 0;
    genX = 0;
    platforms = [];
    coins = [];
    spikes = [];
    birds = [];
    winds = [];
    particles = [];
    floats = [];
    flash = 0;
    shake = 0;
    coyote = 0;
    jumpBuf = 0;
    jumpQueued = false;
    holdJump = false;
    deadTimer = 0;
    landSquash = 0;
    runAnim = 0;
    eventMsg = "";
    eventMsgT = 0;
    sectionCooldown = 0;
    player.x = PLAYER_X;
    player.y = GROUND_Y - 50;
    player.vy = 0;
    player.onGround = false;
    makeClouds();
    generateAhead();
    // place player on first platform
    const p0 = platforms[0];
    if (p0) {
      player.y = p0.y - player.h;
      player.onGround = true;
      coyote = COYOTE;
    }
    updateHud();
  }

  function startGame() {
    hideAll();
    state = "play";
    submitted = false;
    document.getElementById("rank-msg").textContent = "";
    document.getElementById("submit-btn").disabled = false;
    const shareEl = document.getElementById("share-rank-btn");
    if (shareEl) shareEl.hidden = true;
    resetStage();
    hintTimer = 2.5;
    document.getElementById("hint").classList.add("show");
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function doJump() {
    if (coyote > 0 || player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      coyote = 0;
      jumpBuf = 0;
      jumpQueued = false;
      landSquash = 0;
      if (wasOnGround) dust(player.x + player.w / 2, player.y + player.h);
      return true;
    }
    return false;
  }

  function kill(reason) {
    if (state !== "play") return;
    state = "dying";
    deadTimer = 0.85;
    shake = 10;
    flash = 0.35;
    burst(player.x + player.w / 2, player.y + player.h / 2, "#ff9a4a", 18, 220);
    burst(player.x + player.w / 2, player.y + player.h / 2, "#fff3c4", 10, 160);
    player.vy = -280;
    saveBest();
    updateHud();
  }

  function finishDying() {
    state = "over";
    show(overlays.over, true);
    const st = getDifficulty();
    document.getElementById("over-detail").innerHTML =
      `${st.name} · 점수 <b>${Math.floor(score)}</b><br />거리 ${Math.floor(distance)} · 최고 ${best}`;
    submitted = false;
    document.getElementById("rank-msg").textContent = "";
    document.getElementById("submit-btn").disabled = false;
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function update(dt) {
    sunRays += dt;
    runAnim += dt;

    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) document.getElementById("hint").classList.remove("show");
    }

    if (flash > 0) flash -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 28);
    if (landSquash > 0) landSquash = Math.max(0, landSquash - dt * 4);

    // particles
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i -= 1) {
      const f = floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }

    // parallax clouds always move a bit
    const st = getDifficulty();
    const spd = state === "play" ? st.speed : 40;
    cloudsFar.forEach((c) => {
      c.x -= spd * 0.12 * dt;
      if (c.x < -c.w - 40) c.x = W + rand(20, 120);
    });
    cloudsNear.forEach((c) => {
      c.x -= spd * 0.28 * dt;
      if (c.x < -c.w - 40) c.x = W + rand(20, 100);
    });
    hills.forEach((h) => {
      h.x -= spd * 0.18 * dt;
      if (h.x < -h.w) h.x += 640;
    });

    if (state === "dying") {
      deadTimer -= dt;
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      if (deadTimer <= 0) finishDying();
      return;
    }

    if (state !== "play") return;

    if (eventMsgT > 0) eventMsgT -= dt;
    if (sectionCooldown > 0) sectionCooldown -= st.speed * dt;

    if (jumpBuf > 0) jumpBuf -= dt;
    if (jumpQueued || jumpBuf > 0) {
      if (doJump()) jumpQueued = false;
    }

    const speed = st.speed;
    scroll += speed * dt;
    const distGain = speed * dt * 0.55;
    distance += distGain;
    score += distGain * 0.35;

    // scroll world
    const dx = speed * dt;
    platforms.forEach((p) => { p.x -= dx; });
    coins.forEach((c) => { c.x -= dx; });
    spikes.forEach((s) => { s.x -= dx; });
    birds.forEach((b) => { b.x -= dx; });
    winds.forEach((w) => { w.x -= dx; });
    genX -= dx;

    // moving / crumbling platforms
    platforms.forEach((p) => {
      if (p.kind === "move" && !p.falling) {
        p.phase += dt * p.moveSpd;
        p.y = p.baseY + Math.sin(p.phase) * p.moveAmp;
      }
      if (p.falling) {
        p.fallVy += GRAVITY * 0.55 * dt;
        p.y += p.fallVy * dt;
      } else if (p.kind === "crumble" && p.crumble > 0) {
        p.crumble -= dt;
        if (p.crumble <= 0) {
          p.falling = true;
          p.fallVy = 40;
          burst(p.x + p.w / 2, p.y, "#e8d5b8", 10, 140);
        }
      }
    });

    // birds flap + extra speed
    birds.forEach((b) => {
      b.flap += dt * 10;
      b.x += b.vx * dt;
      b.y += Math.sin(b.flap) * 18 * dt;
    });

    // cull
    platforms = platforms.filter((p) => p.x + p.w > -80 && p.y < H + 80);
    coins = coins.filter((c) => !c.taken && c.x > -40);
    spikes = spikes.filter((s) => s.x > -40);
    birds = birds.filter((b) => b.x > -60);
    winds = winds.filter((w) => w.x + w.w > -40);
    generateAhead();

    wasOnGround = player.onGround;

    // wind zones (updraft / downdraft)
    let windForce = 0;
    for (const w of winds) {
      if (player.x + player.w * 0.5 > w.x && player.x + player.w * 0.5 < w.x + w.w) {
        windForce = w.up ? -520 : 380;
      }
    }

    player.vy += (GRAVITY + windForce) * dt;
    if (!holdJump && player.vy < 0) {
      player.vy += GRAVITY * JUMP_CUT * dt;
    }

    let nextY = player.y + player.vy * dt;
    player.onGround = false;

    // platform collision (feet)
    const feetL = player.x + 8;
    const feetR = player.x + player.w - 8;

    if (player.vy >= 0) {
      for (const p of platforms) {
        if (p.falling) continue;
        const prevBottom = player.y + player.h;
        const nextBottom = nextY + player.h;
        if (
          feetR > p.x + 4 &&
          feetL < p.x + p.w - 4 &&
          prevBottom <= p.y + 6 &&
          nextBottom >= p.y &&
          nextBottom <= p.y + 22
        ) {
          nextY = p.y - player.h;
          player.onGround = true;
          if (p.kind === "spring") {
            player.vy = JUMP_V * 1.38;
            player.onGround = false;
            landSquash = 1;
            burst(player.x + player.w / 2, p.y, "#7dffc2", 14, 200);
            floatText(player.x + player.w / 2, p.y - 18, "콩!", "#2fbf8a");
            shake = Math.max(shake, 4);
          } else {
            player.vy = 0;
            if (!wasOnGround) {
              landSquash = 1;
              dust(player.x + player.w / 2, p.y);
            }
            if (p.kind === "crumble" && p.crumble <= 0) {
              p.crumble = 0.55;
            }
          }
          break;
        }
      }
    }

    player.y = nextY;

    if (player.onGround) coyote = COYOTE;
    else coyote = Math.max(0, coyote - dt);

    // coins
    for (const c of coins) {
      if (c.taken) continue;
      c.bob += dt * 4;
      const hitR = c.star ? c.r * 1.2 : c.r;
      if (aabb(player.x + 6, player.y + 6, player.w - 12, player.h - 12, c.x - hitR, c.y - hitR, hitR * 2, hitR * 2)) {
        c.taken = true;
        const val = c.value || 10;
        score += val;
        burst(c.x, c.y, c.star ? "#fff6a0" : "#ffd76a", c.star ? 18 : 12, c.star ? 240 : 180);
        burst(c.x, c.y, "#fff8d0", 6, 120);
        floatText(c.x, c.y - 10, c.star ? "+50★" : `+${val}`, c.star ? "#ff8a3a" : "#e8a020");
        if (c.star) flash = Math.max(flash, 0.2);
      }
    }
    coins = coins.filter((c) => !c.taken);

    // spikes
    for (const s of spikes) {
      if (aabb(player.x + 10, player.y + 14, player.w - 20, player.h - 14, s.x, s.y - s.h, s.w, s.h)) {
        kill("spike");
        return;
      }
    }

    // birds
    for (const b of birds) {
      if (aabb(player.x + 8, player.y + 8, player.w - 16, player.h - 12, b.x, b.y, b.w, b.h)) {
        kill("bird");
        return;
      }
    }

    // fall death
    if (player.y > H + 40) {
      kill("fall");
      return;
    }

    updateHud();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawCloud(c, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const x = c.x;
    const y = c.y;
    const w = c.w * c.s;
    if (sprites.cloud) {
      const sz = spriteSize(sprites.cloud);
      const h = w * (sz.h / sz.w);
      ctx.drawImage(sprites.cloud, x - w * 0.5, y - h * 0.55, w, h);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.35, w * 0.18, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.22, y - 4, w * 0.28, w * 0.16, 0, 0, Math.PI * 2);
      ctx.ellipse(x - w * 0.2, y + 2, w * 0.26, w * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLeaf(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-4, -2, 5, 3, -0.6, 0, Math.PI * 2);
    ctx.ellipse(4, -3, 5, 3, 0.5, 0, Math.PI * 2);
    ctx.ellipse(0, -8, 3.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#6ec8f8");
    g.addColorStop(0.28, "#8ed8ff");
    g.addColorStop(0.55, "#a8e4ff");
    g.addColorStop(0.78, "#c8efb0");
    g.addColorStop(1, "#e8f7b8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // soft atmospheric haze
    const haze = ctx.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.4, 280);
    haze.addColorStop(0, "rgba(255,255,255,0.22)");
    haze.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    // sun
    const sx = 308;
    const sy = 78;
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.sin(sunRays * 0.7) * 0.04;
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 + sunRays * 0.12;
      const rg = ctx.createLinearGradient(
        sx + Math.cos(a) * 20,
        sy + Math.sin(a) * 20,
        sx + Math.cos(a) * 130,
        sy + Math.sin(a) * 95
      );
      rg.addColorStop(0, "rgba(255,236,160,0.9)");
      rg.addColorStop(1, "rgba(255,236,160,0)");
      ctx.strokeStyle = rg;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * 24, sy + Math.sin(a) * 24);
      ctx.lineTo(sx + Math.cos(a) * 130, sy + Math.sin(a) * 95);
      ctx.stroke();
    }
    ctx.restore();
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 52);
    sg.addColorStop(0, "#fffdf0");
    sg.addColorStop(0.35, "#ffe27a");
    sg.addColorStop(0.7, "rgba(255,200,90,0.35)");
    sg.addColorStop(1, "rgba(255,200,90,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, 52, 0, Math.PI * 2);
    ctx.fill();

    cloudsFar.forEach((c) => drawCloud(c, 0.5));

    hills.forEach((h, i) => {
      const hg = ctx.createLinearGradient(0, h.y - h.h, 0, h.y + 10);
      hg.addColorStop(0, i % 2 ? "#b8e89a" : "#9ed87e");
      hg.addColorStop(1, i % 2 ? "#7cbc5e" : "#6aaa52");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(h.x + h.w / 2, h.y, h.w / 2, h.h, 0, Math.PI, 0);
      ctx.fill();
      // soft ridge highlight
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(h.x + h.w * 0.42, h.y - h.h * 0.55, h.w * 0.18, h.h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    cloudsNear.forEach((c) => drawCloud(c, 0.88));

    // distant floating sparkles
    ctx.save();
    for (let i = 0; i < 14; i += 1) {
      const px = ((i * 97 + sunRays * 18) % (W + 40)) - 20;
      const py = 90 + ((i * 53) % 260);
      ctx.globalAlpha = 0.25 + Math.sin(sunRays * 2 + i) * 0.15;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(px, py, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ground meadow
    const groundG = ctx.createLinearGradient(0, GROUND_Y + 36, 0, H);
    groundG.addColorStop(0, "#9ee27a");
    groundG.addColorStop(0.2, "#7bc96f");
    groundG.addColorStop(1, "#5aaa4a");
    ctx.fillStyle = groundG;
    ctx.fillRect(0, GROUND_Y + 40, W, H - GROUND_Y);
    ctx.fillStyle = "#8fd98a";
    ctx.fillRect(0, GROUND_Y + 40, W, 8);
    // grass blades
    ctx.strokeStyle = "rgba(70,140,60,0.45)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (let i = 0; i < 28; i += 1) {
      const gx = (i * 17 + (scroll * 0.2) % 17) % W;
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y + 48);
      ctx.quadraticCurveTo(gx - 2, GROUND_Y + 40, gx + 1, GROUND_Y + 34);
      ctx.stroke();
    }
  }

  function drawCandyPlatform(p) {
    const { x, y, w, color } = p;
    const h = 34;
    // soft contact shadow
    ctx.fillStyle = "rgba(40,70,80,0.18)";
    roundRect(x + 6, y + h - 2, w - 4, 14, 8);
    ctx.fill();

    // body
    const body = ctx.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, color.side);
    body.addColorStop(1, shade(color.side, -28));
    ctx.fillStyle = body;
    roundRect(x, y + 10, w, h - 6, 12);
    ctx.fill();

    // top candy slab
    const top = ctx.createLinearGradient(0, y - 2, 0, y + 16);
    top.addColorStop(0, lighten(color.top, 18));
    top.addColorStop(0.55, color.top);
    top.addColorStop(1, shade(color.top, -12));
    ctx.fillStyle = top;
    roundRect(x - 3, y - 2, w + 6, 18, 10);
    ctx.fill();

    // gloss
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    roundRect(x + 10, y + 1, w * 0.42, 5, 3);
    ctx.fill();

    // edge beads
    ctx.fillStyle = shade(color.top, -20);
    const beads = Math.max(3, Math.floor(w / 28));
    for (let i = 0; i < beads; i += 1) {
      const bx = x + 12 + i * ((w - 24) / Math.max(1, beads - 1));
      ctx.beginPath();
      ctx.arc(bx, y + 14, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    drawLeaf(x + 10, y - 2, 1, color.leaf);
    drawLeaf(x + w - 10, y - 4, 0.9, color.leaf);
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + amt);
    const g = Math.min(255, ((n >> 8) & 255) + amt);
    const b = Math.min(255, (n & 255) + amt);
    return `rgb(${r},${g},${b})`;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawPlatform(p) {
    const { x, y, w, color } = p;
    const shakeX = p.kind === "crumble" && p.crumble > 0 ? (Math.random() - 0.5) * 3 : 0;

    ctx.save();
    ctx.translate(shakeX, 0);
    if (p.falling) ctx.globalAlpha = 0.55;

    if (sprites.platform) {
      const drawH = 56;
      const drawW = w + 18;
      ctx.fillStyle = "rgba(40,70,80,0.16)";
      roundRect(x + 6, y + 28, w - 2, 14, 8);
      ctx.fill();
      ctx.drawImage(sprites.platform, x - 8, y - 14, drawW, drawH);
      ctx.globalAlpha = (p.falling ? 0.55 : 1) * 0.2;
      ctx.fillStyle = color.top;
      roundRect(x - 2, y - 6, w + 6, 16, 9);
      ctx.fill();
      ctx.globalAlpha = p.falling ? 0.55 : 1;
      drawLeaf(x + 8, y - 6, 0.85, color.leaf);
      drawLeaf(x + w - 8, y - 8, 0.8, color.leaf);
    } else {
      drawCandyPlatform(p);
    }

    // kind markers
    if (p.kind === "spring") {
      ctx.fillStyle = "#7dffc2";
      roundRect(x + 10, y - 4, w - 20, 8, 4);
      ctx.fill();
      ctx.fillStyle = "#2fbf8a";
      for (let i = 0; i < 3; i += 1) {
        ctx.fillRect(x + 18 + i * ((w - 40) / 2), y - 10, 8, 8);
      }
    } else if (p.kind === "move") {
      ctx.strokeStyle = "rgba(122,216,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y - 16);
      ctx.lineTo(x + w * 0.5, y - 4);
      ctx.moveTo(x + w * 0.5 - 5, y - 10);
      ctx.lineTo(x + w * 0.5, y - 16);
      ctx.lineTo(x + w * 0.5 + 5, y - 10);
      ctx.stroke();
    } else if (p.kind === "crumble") {
      ctx.fillStyle = "rgba(90,70,50,0.35)";
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(x + 12 + i * (w / 5), y + 8, 6, 3);
      }
    }

    if (p.flower && p.kind === "normal") {
      ctx.fillStyle = "#fff";
      const fx = x + w * 0.55;
      const fy = y - 6;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 4, 3, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpike(s) {
    if (sprites.spike) {
      const sz = spriteSize(sprites.spike);
      const ih = s.h * 2.1;
      const iw = ih * (sz.w / sz.h);
      ctx.drawImage(sprites.spike, s.x + s.w / 2 - iw / 2, s.y - ih + 6, iw, ih);
      return;
    }
    ctx.fillStyle = "#5a7a4a";
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.w / 2, s.y - s.h);
    ctx.lineTo(s.x + s.w, s.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawCoin(c) {
    const bob = Math.sin(c.bob) * 4;
    const y = c.y + bob;
    ctx.save();
    ctx.translate(c.x, y);
    const pulse = 0.92 + Math.sin(c.bob * 2) * 0.08;
    const scale = (c.star ? 1.25 : 1) * pulse;
    ctx.scale(scale, scale);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, c.r * 2.4);
    glow.addColorStop(0, c.star ? "rgba(255,160,60,0.55)" : "rgba(255,220,100,0.45)");
    glow.addColorStop(1, "rgba(255,220,100,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, c.r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (sprites.coin) {
      const sz = spriteSize(sprites.coin);
      const s = c.r * 2.8;
      const iw = s;
      const ih = s * (sz.h / sz.w);
      ctx.drawImage(sprites.coin, -iw / 2, -ih / 2, iw, ih);
    } else {
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, c.r);
      g.addColorStop(0, "#fff6c0");
      g.addColorStop(0.5, "#ffd76a");
      g.addColorStop(1, "#e8a020");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (c.star) {
      ctx.fillStyle = "#ff8a3a";
      ctx.font = 'bold 11px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("★", 0, 4);
    }
    ctx.restore();
  }

  function drawBird(b) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    const wing = Math.sin(b.flap) * 0.45;
    ctx.fillStyle = "#5a6e82";
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a90a8";
    ctx.beginPath();
    ctx.ellipse(-6, -2 + wing * 6, 10, 4, -0.4 + wing, 0, Math.PI * 2);
    ctx.ellipse(6, -2 - wing * 6, 10, 4, 0.4 - wing, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9a4a";
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(18, 2);
    ctx.lineTo(12, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(4, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(4.5, -2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWind(w) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = w.up ? "#7ad8ff" : "#ffb07a";
    roundRect(w.x, 120, w.w, H - 220, 16);
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = w.up ? "#7ad8ff" : "#ffb07a";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const px = w.x + 16 + i * (w.w / 5);
      const drift = (sunRays * 40 + i * 20) % 80;
      ctx.beginPath();
      if (w.up) {
        ctx.moveTo(px, H - 160 - drift);
        ctx.lineTo(px, H - 200 - drift);
      } else {
        ctx.moveTo(px, 160 + drift);
        ctx.lineTo(px, 200 + drift);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawChickFallback(x, y, w, h, jumping) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    const bounce = jumping ? -2 : Math.sin(runAnim * 14) * 2;
    ctx.translate(0, bounce);

    const body = ctx.createRadialGradient(-6, -8, 4, 0, 0, w * 0.55);
    body.addColorStop(0, "#ffc878");
    body.addColorStop(0.55, "#ff9a4a");
    body.addColorStop(1, "#f07830");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 2, w * 0.48, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffe0b0";
    ctx.beginPath();
    ctx.ellipse(2, 8, w * 0.22, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff9a4a";
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.ellipse(i * 7, -h * 0.42, 5, 8, i * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#f08840";
    ctx.beginPath();
    ctx.ellipse(-w * 0.32, 2, 8, 11, jumping ? -0.6 : -0.2 + Math.sin(runAnim * 14) * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(8, -4, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(10, -6, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,130,140,0.55)";
    ctx.beginPath();
    ctx.ellipse(4, 4, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff8a30";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(24, 2);
    ctx.lineTo(16, 5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#e07028";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (!jumping) {
      const leg = Math.sin(runAnim * 14);
      ctx.beginPath();
      ctx.moveTo(-4, h * 0.35);
      ctx.lineTo(-4 + leg * 4, h * 0.48);
      ctx.moveTo(6, h * 0.35);
      ctx.lineTo(6 - leg * 4, h * 0.48);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-2, h * 0.3);
      ctx.lineTo(-8, h * 0.42);
      ctx.moveTo(6, h * 0.3);
      ctx.lineTo(10, h * 0.4);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPlayer() {
    const jumping = !player.onGround;
    const sq = 1 - landSquash * 0.18;
    const tall = 1 + landSquash * 0.08;
    const boxW = player.w * (2 - sq);
    const boxH = player.h * sq * tall;
    const x = player.x - (boxW - player.w) / 2;
    const y = player.y + player.h - boxH;

    if (sprites.hero) {
      ctx.save();
      const bob = jumping ? 0 : Math.sin(runAnim * 14) * 1.5;
      // feet anchor — keep natural chick proportions (not a square)
      const sz = spriteSize(sprites.hero);
      const drawH = boxH * 1.55;
      const drawW = drawH * (sz.w / sz.h);
      ctx.translate(x + boxW / 2, y + boxH + bob);
      if (jumping) ctx.rotate(-0.08);
      ctx.fillStyle = "rgba(40,70,80,0.2)";
      ctx.beginPath();
      ctx.ellipse(0, 2, drawW * 0.28, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(sprites.hero, -drawW / 2, -drawH + 4, drawW, drawH);
      ctx.restore();
    } else {
      drawChickFallback(x, y, boxW, boxH, jumping);
    }
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life / 0.8);
      ctx.fillStyle = f.color;
      ctx.font = '16px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawBackground();
    winds.forEach(drawWind);
    platforms.forEach(drawPlatform);
    spikes.forEach(drawSpike);
    coins.forEach(drawCoin);
    birds.forEach(drawBird);
    if (state !== "title") drawPlayer();
    drawParticles();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    // stage name whisper at start
    if (state === "play" && distance < 80) {
      ctx.globalAlpha = Math.max(0, 1 - distance / 80);
      ctx.fillStyle = "#fff";
      ctx.font = '22px "Bagel Fat One", "Jua", cursive';
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(60,90,120,0.35)";
      ctx.lineWidth = 4;
      const name = getDifficulty().name;
      ctx.strokeText(name, W / 2, H * 0.28);
      ctx.fillText(name, W / 2, H * 0.28);
      ctx.globalAlpha = 1;
    }

    // event banner
    if (state === "play" && eventMsgT > 0) {
      ctx.globalAlpha = Math.min(1, eventMsgT * 1.4);
      ctx.fillStyle = "rgba(40,70,100,0.55)";
      roundRect(W * 0.18, H * 0.2, W * 0.64, 36, 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = '18px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(eventMsg, W / 2, H * 0.2 + 24);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onJumpDown() {
    if (state === "title") {
      startGame();
      return;
    }
    if (state === "over") return;
    holdJump = true;
    jumpQueued = true;
    jumpBuf = JUMP_BUF;
    if (state === "play") doJump();
  }

  function onJumpUp() {
    holdJump = false;
  }

  document.getElementById("start-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });
  document.getElementById("retry-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });

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
    const res = await window.TodayScores.submitScore("jump-run", name, Math.floor(score));
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
          gameId: "jump-run",
          gameTitle: "콩콩 점프",
          name,
          score: Math.floor(score),
          rankDay: lastRank.rankDay,
          label: `${Math.floor(score).toLocaleString("ko-KR")}점`,
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
        gameTitle: "콩콩 점프",
        name,
        score: Math.floor(score),
        rankDay: lastRank.rankDay,
        rankWeek: lastRank.rankWeek,
        url: "https://www.todaygame.co.kr/games/jump-run/",
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

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      onJumpDown();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      onJumpUp();
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onJumpDown();
  });
  canvas.addEventListener("pointerup", onJumpUp);
  canvas.addEventListener("pointercancel", onJumpUp);

  // also allow tap on stage (outside overlay buttons)
  document.querySelector(".stage").addEventListener("pointerdown", (e) => {
    if (e.target.closest(".overlay") || e.target.closest("a") || e.target.closest("button")) return;
    onJumpDown();
  });
  window.addEventListener("pointerup", onJumpUp);

  document.getElementById("hud-best").textContent = String(best);

  loadAssets().then(() => {
    makeClouds();
    draw();
    last = performance.now();
    raf = requestAnimationFrame(loop);
  });
})();
