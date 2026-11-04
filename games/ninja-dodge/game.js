/* 닌자 표창 피하기 — 밸런스 판
 *
 * 규칙: 위쪽 표창 = 숙이기, 가운데 · 아래 표창 = 점프, 위에서 떨어지는 표창 = 옆으로 이동, 황금 = 베기.
 * 표창은 "묶음(패턴)" 으로 나오고, 도착 시각 사이에 답을 바꿀 시간을 항상 준다 (switchGap).
 * 그래서 아무리 빨라져도 피할 수 없는 조합은 나오지 않는다. 고정 걸음 1/120초.
 */
(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GROUND = H - 118;
  const STEP = 1 / 120;
  const BEST_KEY = "today-ninja-dodge-best";
  const NAME_KEY = "today-ninja-dodge-name";

  const STAGE_NAMES = [
    "밤의 입문",
    "대나무 그림자",
    "달빛 표창",
    "재빠른 몸놀림",
    "황금 표창",
    "좌우 협공",
    "공중의 위험",
    "연속 회피",
    "닌자 시험",
    "표창 소나기",
    "그림자 술법",
    "고수의 길",
    "폭풍 회피",
    "달의 수행",
    "절정의 감각",
    "금빛 난무",
    "전설의 밤",
    "죽림의 후예",
    "표창 마스터",
    "닌자 고수",
  ];

  const LEVEL_SEC = 16;
  const RAMP_SEC = 210;
  const MAX_LIVES = 3;
  const HEAL_EVERY = 40; // 안 맞고 이만큼 버티면 하트 +1
  const LANE_Y = { high: GROUND - 78, mid: GROUND - 40, low: GROUND - 18 };
  const ease = (t) => t * t * (3 - 2 * t);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let playTime = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;

  function getDifficulty() {
    const e = ease(clamp(playTime / RAMP_SEC, 0, 1));
    const level = 1 + Math.floor(playTime / LEVEL_SEC);
    return {
      level,
      name: STAGE_NAMES[Math.min(STAGE_NAMES.length - 1, level - 1)],
      meter: (playTime % LEVEL_SEC) / LEVEL_SEC,
      // 끝까지 간 뒤에도 아주 천천히 빨라진다 (상한 있음)
      speed: Math.min(420, 165 + 195 * e + Math.max(0, playTime - RAMP_SEC) * 0.2),
      warn: 1.05 - 0.45 * e,
      rest: 1.2 - 0.82 * e,
      goldRate: 0.07 + 0.13 * e,
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
  const padEl = document.getElementById("pad");
  const nameInput = document.getElementById("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";
  document.getElementById("hud-best").textContent = String(best);

  const sprites = { idle: null, crouch: null, jump: null, shuriken: null, gold: null };

  let state = "title";
  let score = 0;
  let lives = MAX_LIVES;
  let combo = 0;
  let invuln = 0;
  let slashT = 0;
  let slashCd = 0;
  let flash = 0;
  let shake = 0;
  let last = 0;
  let accum = 0;
  let submitted = false;
  let keys = Object.create(null);
  let holdCrouch = false;
  let jumpPressed = false;
  let jumpBuffer = 0;
  let pointerX = null;
  let plan = [];
  let warnings = [];
  let shots = [];
  let particles = [];
  let floats = [];
  let leaves = [];
  let moonGlow = 0;
  let lastArrival = 0;
  let lastLane = null;
  let lastDir = null;
  let scriptIndex = 0;
  let healT = 0;
  let timeScore = 0;
  let hudDirty = true;
  let lastHudLevel = 0;
  let topHinted = false;
  let tip = "";
  let tipT = 0;
  const stats = { dodged: 0, hits: 0, goldCut: 0, slashes: 0, whiffs: 0 };

  const player = {
    x: W / 2,
    y: GROUND,
    vx: 0,
    pose: "idle",
    jumpV: 0,
    onGround: true,
    face: 1,
  };

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [idle, crouch, jump, shu, gold] = await Promise.all([
      loadImg("assets/ninja-idle.webp"),
      loadImg("assets/ninja-crouch.webp"),
      loadImg("assets/ninja-jump.webp"),
      loadImg("assets/shuriken.webp"),
      loadImg("assets/shuriken-gold.webp"),
    ]);
    sprites.idle = idle;
    sprites.crouch = crouch;
    sprites.jump = jump;
    sprites.shuriken = shu;
    sprites.gold = gold;
  }

  function showOverlay(name) {
    Object.keys(overlays).forEach((k) => {
      overlays[k].classList.toggle("hidden", k !== name);
    });
    padEl.classList.toggle("show", name == null && state === "play");
  }

  function hideOverlays() {
    Object.keys(overlays).forEach((k) => overlays[k].classList.add("hidden"));
    padEl.classList.add("show");
  }

  function multiplier() {
    if (combo >= 50) return 4;
    if (combo >= 25) return 3;
    if (combo >= 10) return 2;
    return 1;
  }

  function updateHud() {
    const st = getDifficulty();
    document.getElementById("hud-stage").textContent = String(st.level);
    document.getElementById("hud-score").textContent = String(Math.floor(score));
    document.getElementById("hud-best").textContent = String(best);
    document.getElementById("goal-fill").style.width = `${Math.min(100, st.meter * 100)}%`;
    if (!hudDirty) return;
    hudDirty = false;
    const livesEl = document.getElementById("hud-lives");
    livesEl.innerHTML = "";
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const d = document.createElement("div");
      d.className = "life" + (i < lives ? "" : " empty");
      livesEl.appendChild(d);
    }
  }

  function makeLeaves() {
    leaves = Array.from({ length: 18 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.4 + Math.random() * 0.8,
      v: 18 + Math.random() * 28,
      r: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 2,
    }));
  }

  function resetStage() {
    lives = MAX_LIVES;
    combo = 0;
    invuln = 0.8;
    slashT = 0;
    slashCd = 0;
    flash = 0;
    shake = 0;
    plan = [];
    warnings = [];
    shots = [];
    particles = [];
    floats = [];
    lastArrival = 0.6;
    lastLane = null;
    lastDir = null;
    scriptIndex = 0;
    healT = 0;
    timeScore = 0;
    topHinted = false;
    tip = "";
    tipT = 0;
    stats.dodged = 0;
    stats.hits = 0;
    stats.goldCut = 0;
    stats.slashes = 0;
    stats.whiffs = 0;
    player.x = W / 2;
    player.y = GROUND;
    player.vx = 0;
    player.jumpV = 0;
    player.onGround = true;
    player.pose = "idle";
    hudDirty = true;
    updateHud();
  }

  function startGame(fromTitle) {
    if (fromTitle) {
      playTime = 0;
      score = 0;
    }
    submitted = false;
    document.getElementById("rank-msg").textContent = "";
    document.getElementById("submit-btn").disabled = false;
    const shareEl = document.getElementById("share-rank-btn");
    if (shareEl) shareEl.hidden = true;
    state = "play";
    hideOverlays();
    resetStage();
    showTip("위 표창은 숙이기 · 아래 표창은 점프!", 3);
    last = performance.now();
    accum = 0;
  }

  function showTip(text, sec = 2) {
    tip = text;
    tipT = sec;
  }

  function spawnFloat(x, y, text, color) {
    floats.push({ x, y, text, color: color || "#ffe9a8", t: 0, life: 0.9 });
    if (floats.length > 14) floats.shift();
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, life: 0.35 + Math.random() * 0.4, color, r: 2 + Math.random() * 3 });
    }
    if (particles.length > 180) particles.splice(0, particles.length - 180);
  }

  /* ---------- 표창 묶음 ---------- */
  // 앞 표창에 답한 뒤 다음 표창에 답할 수 있는 최소 간격 (도착 시각 기준, 초)
  function switchGap(a, b) {
    if (!a) return 0;
    if (a === "top" || b === "top") return 0.72; // 옆으로 움직이면 다른 표창 도착 시각이 바뀐다 — 여유를 더 준다
    const A = a === "high" ? "duck" : "jump";
    const B = b === "high" ? "duck" : "jump";
    if (A === "duck" && B === "duck") return 0.2;
    if (A === "duck" && B === "jump") return 0.36;
    if (A === "jump" && B === "duck") return 0.72; // 착지해야 숙일 수 있다
    return 0.76; // 착지 → 다시 점프
  }

  function pickSide() {
    return Math.random() < 0.5 ? "left" : "right";
  }

  function pickLane() {
    const r = Math.random();
    return r < 0.42 ? "high" : r < 0.72 ? "low" : "mid";
  }

  function nextPattern() {
    const t = playTime;
    // 처음엔 하나씩 가르쳐 준다
    if (t < 14) {
      const script = ["high", "low", "high", "low", "mid", "high", "low"];
      const lane = script[scriptIndex % script.length];
      scriptIndex += 1;
      return [{ lane, dir: pickSide() }];
    }
    const options = [["single", 5]];
    if (t > 26) options.push(["twin", 2]);
    if (t > 38) options.push(["duckJump", 2]);
    if (t > 34) options.push(["top", 1.5]);
    if (t > 52) options.push(["jumpDuck", 2]);
    if (t > 64) options.push(["doubleJump", 1.5]);
    if (t > 96) options.push(["rain", 1.3]);
    if (t > 128) options.push(["stairs", 2]);
    if (t > 160) options.push(["cross", 1.6]);
    let sum = options.reduce((a, o) => a + o[1], 0);
    let r = Math.random() * sum;
    let kind = "single";
    for (const [k, w] of options) {
      r -= w;
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    const side = pickSide();
    const other = side === "left" ? "right" : "left";
    switch (kind) {
      case "twin": {
        const lane = pickLane();
        return [
          { lane, dir: side },
          { lane, dir: other, together: true },
        ];
      }
      case "duckJump":
        return [
          { lane: "high", dir: side },
          { lane: Math.random() < 0.5 ? "low" : "mid", dir: side },
        ];
      case "jumpDuck":
        return [
          { lane: "low", dir: side },
          { lane: "high", dir: side },
        ];
      case "doubleJump":
        return [
          { lane: "low", dir: side },
          { lane: Math.random() < 0.5 ? "low" : "mid", dir: side },
        ];
      case "top": {
        return [{ lane: "top", x: clamp(player.x + rand(-22, 22), 44, W - 44) }];
      }
      case "rain": {
        const baseX = clamp(player.x + rand(-20, 20), 44, W - 44);
        const stepX = (baseX > W / 2 ? -1 : 1) * 78;
        return [
          { lane: "top", x: baseX },
          { lane: "top", x: baseX + stepX, together: true, late: 0.28 },
        ];
      }
      case "stairs":
        return [
          { lane: "high", dir: side },
          { lane: "low", dir: side },
          { lane: "high", dir: side },
        ];
      case "cross":
        return [
          { lane: "mid", dir: side },
          { lane: "low", dir: other, together: true },
          { lane: "high", dir: side },
        ];
      default:
        return [{ lane: pickLane(), dir: side }];
    }
  }

  function travelTime(e, speed) {
    if (e.lane === "top") return (GROUND - 60 + 24) / Math.max(250, speed);
    const dist = e.dir === "left" ? player.x + 24 : W + 24 - player.x;
    return dist / speed;
  }

  function schedulePattern() {
    const st = getDifficulty();
    const list = nextPattern();
    const rest = st.rest + rand(0, 0.22);
    let firstOfPack = true;
    // 앞 표창과 답이 다르면 같은 쪽에서 오게 한다.
    // 옆으로 움직여도 두 표창 사이 간격이 그대로라 답을 바꿀 시간이 줄지 않는다.
    if (lastDir && lastLane && lastLane !== "top" && list[0].lane !== "top" && !list[0].together) {
      if (list[0].dir !== lastDir) {
        const flip = list[0].dir;
        for (const e of list) if (e.lane !== "top") e.dir = e.dir === flip ? lastDir : flip;
      }
    }
    for (const e of list) {
      const gold = e.lane !== "top" && playTime > 10 && Math.random() < st.goldRate;
      const speed = st.speed * (gold ? 1.08 : 1);
      const travel = travelTime(e, speed);
      let arrive;
      if (e.together) {
        arrive = lastArrival + (e.late || 0);
      } else {
        arrive = lastArrival + switchGap(lastLane, e.lane) + (firstOfPack ? rest : 0.06);
      }
      arrive = Math.max(arrive, playTime + st.warn + travel);
      const launchAt = arrive - travel;
      plan.push({ lane: e.lane, dir: e.lane === "top" ? "top" : e.dir, x: e.x, gold, speed, warnAt: launchAt - st.warn, launchAt, warn: st.warn });
      if (arrive > lastArrival) {
        lastArrival = arrive;
        lastLane = e.lane;
        lastDir = e.lane === "top" ? lastDir : e.dir;
      }
      firstOfPack = false;
    }
    if (!topHinted && list[0].lane === "top") {
      topHinted = true;
      showTip("위에서 떨어져요! 화면을 끌어 옆으로", 2.6);
    }
  }

  function launch(w) {
    if (w.dir === "top") {
      shots.push({ x: w.x, y: -24, vx: 0, vy: Math.max(250, w.speed), r: 14, gold: false, lane: "top", rot: 0, spin: 12, alive: true, passed: false });
      return;
    }
    const left = w.dir === "left";
    shots.push({
      x: left ? -24 : W + 24,
      y: LANE_Y[w.lane],
      vx: left ? w.speed : -w.speed,
      vy: 0,
      r: w.gold ? 16 : 14,
      gold: w.gold,
      lane: w.lane,
      rot: 0,
      spin: (left ? 1 : -1) * (10 + Math.random() * 8),
      alive: true,
      passed: false,
    });
  }

  /* ---------- 몸 상자 ---------- */
  // 서 있으면 머리부터 발끝까지 맞는다. 숙이면 위 표창이 지나가고, 뛰면 아래 표창이 지나간다.
  function hitbox() {
    if (player.pose === "crouch") return { x: player.x, y: player.y - 31, w: 30, h: 58 };
    if (player.pose === "jump") return { x: player.x, y: player.y - 47, w: 26, h: 82 };
    return { x: player.x, y: player.y - 43, w: 26, h: 82 };
  }

  function circleRect(cx, cy, cr, hb) {
    const nearestX = Math.max(hb.x - hb.w / 2, Math.min(cx, hb.x + hb.w / 2));
    const nearestY = Math.max(hb.y - hb.h / 2, Math.min(cy, hb.y + hb.h / 2));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy < cr * cr;
  }

  function addScore(base) {
    const gain = base * multiplier();
    score += gain;
    return gain;
  }

  function trySlash() {
    if (state !== "play" || slashCd > 0) return;
    slashT = 0.2;
    stats.slashes += 1;
    let hit = 0;
    shots.forEach((s) => {
      if (!s.alive || s.lane === "top") return;
      const dist = Math.hypot(s.x - player.x, s.y - (player.y - 40));
      // 황금은 넉넉하게, 보통 표창은 아주 가까이 왔을 때만
      const range = s.gold ? 84 : 46;
      if (dist < range) {
        s.alive = false;
        hit += 1;
        if (s.gold) {
          combo += 3;
          stats.goldCut += 1;
          const gain = addScore(50);
          burst(s.x, s.y, "#ffd76a", 16);
          spawnFloat(s.x, s.y - 10, `베기! +${gain}`, "#ffd76a");
        } else {
          const gain = addScore(4);
          burst(s.x, s.y, "#c9e8ff", 8);
          spawnFloat(s.x, s.y - 10, `+${gain}`, "#fff");
        }
      }
    });
    if (hit) {
      slashCd = 0.14;
    } else {
      // 헛손질은 오래 쉰다 — 마구 누르면 진다
      slashCd = 0.6;
      stats.whiffs += 1;
      burst(player.x + player.face * 28, player.y - 40, "rgba(255,230,160,0.8)", 5);
    }
  }

  function hurt() {
    if (invuln > 0) return;
    lives -= 1;
    stats.hits += 1;
    invuln = 1.45;
    flash = 0.35;
    shake = 10;
    combo = 0;
    healT = 0;
    hudDirty = true;
    lastArrival += 0.5; // 맞은 뒤엔 숨 돌릴 틈
    burst(player.x, player.y - 40, "#ff7eb6", 18);
    spawnFloat(player.x, player.y - 80, "아야!", "#ff9ec8");
    updateHud();
    if (lives <= 0) {
      state = "over";
      padEl.classList.remove("show");
      const final = Math.floor(score);
      if (final > best) {
        best = final;
        localStorage.setItem(BEST_KEY, String(best));
        document.getElementById("hud-best").textContent = String(best);
      }
      submitted = false;
      document.getElementById("rank-msg").textContent = "";
      document.getElementById("submit-btn").disabled = false;
      const st = getDifficulty();
      document.getElementById("over-detail").textContent = `${st.name} · ${Math.floor(playTime)}초 버팀 · 점수 ${final}점 · 최고 ${best}`;
      showOverlay("over");
      if (window.TodayVisit) {
        TodayVisit.compareAndShow("ninja-dodge", final, true, document.getElementById("over"));
      }
    }
  }

  function updatePlayer(dt) {
    let move = 0;
    if (keys.ArrowLeft || keys.a || keys.A) move -= 1;
    if (keys.ArrowRight || keys.d || keys.D) move += 1;
    if (pointerX != null) {
      const dx = pointerX - player.x;
      if (Math.abs(dx) > 6) move = Math.sign(dx);
      player.x += dx * Math.min(1, dt * 12);
    } else {
      player.vx = move * 330;
      player.x += player.vx * dt;
    }
    if (move) player.face = move;

    const wantCrouch = holdCrouch || keys.ArrowDown || keys.s || keys.S;
    const wantJump = jumpPressed || keys.ArrowUp || keys.w || keys.W || keys[" "];

    // 짧게 누른 점프는 착지 직전이어도 잠깐 기억한다
    if (jumpPressed) jumpBuffer = 0.12;
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    if ((wantJump || jumpBuffer > 0) && player.onGround) {
      player.onGround = false;
      player.jumpV = -540;
      player.pose = "jump";
      jumpBuffer = 0;
    }
    jumpPressed = false;

    if (!player.onGround) {
      player.jumpV += 1600 * dt;
      player.y += player.jumpV * dt;
      if (player.y >= GROUND) {
        player.y = GROUND;
        player.jumpV = 0;
        player.onGround = true;
      } else {
        player.pose = "jump";
      }
    }
    if (player.onGround) player.pose = wantCrouch ? "crouch" : "idle";

    player.x = Math.max(36, Math.min(W - 36, player.x));
  }

  function update(dt) {
    if (state !== "play") {
      // 끝난 뒤에도 파편은 마저 떨어진다
      particles.forEach((p) => {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 280 * dt;
      });
      particles = particles.filter((p) => p.t < p.life);
      return;
    }
    playTime += dt;
    const st = getDifficulty();

    moonGlow += dt;
    invuln = Math.max(0, invuln - dt);
    slashT = Math.max(0, slashT - dt);
    slashCd = Math.max(0, slashCd - dt);
    flash = Math.max(0, flash - dt);
    tipT = Math.max(0, tipT - dt);
    if (shake > 0) shake *= Math.pow(0.86, dt * 60);

    timeScore += dt * multiplier();
    if (timeScore >= 1) {
      const whole = Math.floor(timeScore);
      score += whole;
      timeScore -= whole;
    }

    healT += dt;
    if (healT >= HEAL_EVERY) {
      healT = 0;
      if (lives < MAX_LIVES) {
        lives += 1;
        hudDirty = true;
        spawnFloat(player.x, player.y - 96, "하트 +1", "#ff9ec8");
        burst(player.x, player.y - 60, "#ff9ec8", 14);
      }
    }

    updatePlayer(dt);

    leaves.forEach((L) => {
      L.y += L.v * dt;
      L.x += Math.sin(L.y * 0.02) * 12 * dt;
      L.r += L.spin * dt;
      if (L.y > H + 20) {
        L.y = -20;
        L.x = Math.random() * W;
      }
    });

    // 다음 묶음은 앞 묶음이 거의 다 지나갈 때 정한다 (플레이어 자리 기준)
    if (plan.length === 0 && lastArrival - playTime < st.warn + 0.9) schedulePattern();
    for (let i = plan.length - 1; i >= 0; i -= 1) {
      if (playTime >= plan[i].warnAt) {
        const w = plan.splice(i, 1)[0];
        warnings.push(w);
      }
    }
    warnings = warnings.filter((w) => {
      if (playTime >= w.launchAt) {
        launch(w);
        return false;
      }
      return true;
    });

    const hb = hitbox();
    shots.forEach((s) => {
      if (!s.alive) return;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;

      if (invuln <= 0 && circleRect(s.x, s.y, s.r * 0.5, hb)) {
        s.alive = false;
        hurt();
        return;
      }

      // 몸을 지나갔으면 회피 성공
      const gone = s.lane === "top" ? s.y > GROUND - 10 : s.vx > 0 ? s.x > player.x + 24 : s.x < player.x - 24;
      if (!s.passed && gone) {
        s.passed = true;
        combo += 1;
        stats.dodged += 1;
        const gain = addScore(10);
        spawnFloat(player.x, player.y - 104, `회피 +${gain}`, "#b8f0ff");
      }
      if (s.x < -60 || s.x > W + 60 || s.y > H + 60) s.alive = false;
    });
    shots = shots.filter((s) => s.alive);

    particles.forEach((p) => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
    });
    particles = particles.filter((p) => p.t < p.life);
    floats.forEach((f) => {
      f.t += dt;
      f.y -= 40 * dt;
    });
    floats = floats.filter((f) => f.t < f.life);

    if (st.level !== lastHudLevel) {
      lastHudLevel = st.level;
      if (st.level > 1) spawnFloat(W / 2, 160, `${st.level}단계 · ${st.name}`, "#ffe9a8");
    }
    updateHud();
  }

  function drawBamboo(x, baseY, h, shade) {
    ctx.fillStyle = shade;
    ctx.fillRect(x - 5, baseY - h, 10, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x - 3, baseY - h, 3, h);
    for (let y = baseY - 18; y > baseY - h; y -= 28) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x - 5, y, 10, 3);
    }
    // leaves
    ctx.fillStyle = "rgba(90, 200, 140, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x + 14, baseY - h + 10, 16, 6, 0.5, 0, Math.PI * 2);
    ctx.ellipse(x - 12, baseY - h + 18, 14, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBackground() {
    // moonlit temple courtyard matching thumb
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0c0a28");
    g.addColorStop(0.4, "#1a1450");
    g.addColorStop(0.7, "#2a1858");
    g.addColorStop(1, "#1a1028");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // huge full moon (thumb center)
    const mx = W / 2;
    const my = 118;
    const mg = ctx.createRadialGradient(mx, my, 20, mx, my, 110);
    mg.addColorStop(0, "rgba(255, 250, 230, 1)");
    mg.addColorStop(0.35, "rgba(255, 240, 200, 0.75)");
    mg.addColorStop(0.7, "rgba(255, 210, 160, 0.2)");
    mg.addColorStop(1, "rgba(255, 180, 140, 0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 100 + Math.sin(moonGlow * 1.2) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8e8";
    ctx.beginPath();
    ctx.arc(mx, my, 42, 0, Math.PI * 2);
    ctx.fill();

    // temple silhouette + lanterns
    ctx.fillStyle = "rgba(10, 8, 28, 0.85)";
    ctx.beginPath();
    ctx.moveTo(90, GROUND - 40);
    ctx.lineTo(120, GROUND - 130);
    ctx.lineTo(270, GROUND - 130);
    ctx.lineTo(300, GROUND - 40);
    ctx.closePath();
    ctx.fill();
    // curved roof
    ctx.fillStyle = "rgba(20, 14, 40, 0.95)";
    ctx.beginPath();
    ctx.moveTo(80, GROUND - 120);
    ctx.quadraticCurveTo(195, GROUND - 170, 310, GROUND - 120);
    ctx.lineTo(290, GROUND - 110);
    ctx.quadraticCurveTo(195, GROUND - 148, 100, GROUND - 110);
    ctx.closePath();
    ctx.fill();

    // paper lanterns
    [[150, GROUND - 95], [240, GROUND - 95]].forEach(([lx, ly]) => {
      const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 28);
      lg.addColorStop(0, "rgba(255, 180, 60, 0.9)");
      lg.addColorStop(1, "rgba(255, 120, 40, 0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffb040";
      ctx.beginPath();
      ctx.ellipse(lx, ly, 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // bamboo frames
    for (let i = 0; i < 5; i += 1) {
      drawBamboo(12 + i * 18, GROUND + 20, 220 + (i % 3) * 35, i % 2 ? "#1e4a38" : "#163828");
      drawBamboo(W - 20 - i * 18, GROUND + 20, 200 + (i % 3) * 40, i % 2 ? "#163828" : "#1e4a38");
    }

    // wooden deck floor
    const gg = ctx.createLinearGradient(0, GROUND - 10, 0, H);
    gg.addColorStop(0, "#3a2848");
    gg.addColorStop(0.3, "#2a1830");
    gg.addColorStop(1, "#120c1a");
    ctx.fillStyle = gg;
    ctx.fillRect(0, GROUND + 4, W, H - GROUND);

    ctx.strokeStyle = "rgba(80, 50, 70, 0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const y = GROUND + 18 + i * 22;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // dojo mat highlight
    ctx.fillStyle = "rgba(120, 60, 100, 0.35)";
    ctx.beginPath();
    ctx.ellipse(W / 2, GROUND + 18, 130, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // cherry blossom petals (pink)
    leaves.forEach((L) => {
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.r);
      ctx.fillStyle = "rgba(255, 160, 200, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6 * L.s, 3.5 * L.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawFallbackNinja() {
    const hb = hitbox();
    ctx.fillStyle = "#2a2448";
    ctx.beginPath();
    ctx.arc(hb.x, hb.y, Math.min(hb.w, hb.h) * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb0c8";
    ctx.beginPath();
    ctx.arc(player.x, player.y - (player.pose === "crouch" ? 36 : 70), 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // 내 얼굴 위치: 스프라이트 상자 안의 [머리 중심 x, y, 반지름(가로 기준)] 비율
  const FACE_HEAD = { idle: [0.26, 0.34, 0.16], crouch: [0.28, 0.5, 0.17], jump: [0.26, 0.39, 0.18] };

  function drawPlayer() {
    // shadow
    const air = clamp((GROUND - player.y) / 90, 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.28 - air * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(player.x, GROUND + 6, 28 - air * 10, 7 - air * 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
    if (blink) return;

    let img = sprites.idle;
    let h = 96;
    let y = player.y + 6;
    if (player.pose === "crouch") {
      img = sprites.crouch || sprites.idle;
      h = 70;
      y = player.y + 6;
    } else if (player.pose === "jump") {
      img = sprites.jump || sprites.idle;
      h = 98;
      y = player.y + 4;
    }
    const w = img ? (h * img.naturalWidth) / img.naturalHeight : 90;

    if (slashT > 0) {
      ctx.save();
      const k = slashT / 0.2;
      ctx.strokeStyle = `rgba(255, 220, 120, ${0.9 * k})`;
      ctx.lineWidth = 3 + k * 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(player.x, player.y - 40, 62 - k * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (img) {
      ctx.save();
      ctx.translate(player.x, y);
      if (player.face < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.restore();
      if (window.TodayFace) {
        TodayFace.drawOnSprite(ctx, player.x - w / 2, y - h, w, h, FACE_HEAD[player.pose] || FACE_HEAD.idle, {
          flipX: player.face < 0,
        });
      }
    } else {
      drawFallbackNinja();
    }
  }

  function drawFallbackShuriken(x, y, r, gold, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = gold ? "#ffd76a" : "#d8e6ff";
    ctx.strokeStyle = gold ? "#c98a20" : "#6a7a9a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + 0.4) * r * 0.28, Math.sin(a + 0.4) * r * 0.28);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = gold ? "#fff3b0" : "#fff";
    ctx.fill();
    ctx.restore();
  }

  function drawShuriken(s) {
    const img = s.gold ? sprites.gold : sprites.shuriken;
    const size = s.r * 2.6;
    ctx.save();
    ctx.globalAlpha = 0.35;
    const trail = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, size * 0.7);
    trail.addColorStop(0, s.gold ? "rgba(255,215,100,0.8)" : "rgba(180,100,255,0.7)");
    trail.addColorStop(1, "rgba(255,200,80,0)");
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.arc(s.x, s.y, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (img) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      drawFallbackShuriken(s.x, s.y, s.r, s.gold, s.rot);
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const LANE_LOOK = {
    high: { color: "#6fd8ff", text: "숙여!" },
    mid: { color: "#ff9d5c", text: "점프!" },
    low: { color: "#ff7d7d", text: "점프!" },
    top: { color: "#d7b3ff", text: "옆으로!" },
  };

  function drawWarnings() {
    warnings.forEach((w) => {
      const look = LANE_LOOK[w.lane];
      const k = clamp(1 - (w.launchAt - playTime) / w.warn, 0, 1);
      const pulse = 0.72 + Math.sin(playTime * 16) * 0.28;
      const color = w.gold ? "#ffd76a" : look.color;
      const text = w.gold ? "베기!" : look.text;
      ctx.save();
      if (w.dir === "top") {
        ctx.globalAlpha = 0.18 + k * 0.2;
        ctx.fillStyle = color;
        ctx.fillRect(w.x - 15, 0, 30, GROUND - 16);
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.moveTo(w.x, 30);
        ctx.lineTo(w.x - 12, 12);
        ctx.lineTo(w.x + 12, 12);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#fff";
        ctx.font = '13px "Jua", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText(text, w.x, 46);
      } else {
        const left = w.dir === "left";
        const y = LANE_Y[w.lane];
        const x = left ? 4 : W - 4;
        const sgn = left ? 1 : -1;
        // 시간이 차오르는 막대: 다 차면 날아온다
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = color;
        ctx.fillRect(left ? 0 : W - 96, y - 3, 96, 6);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(left ? 0 : W - 96 * k, y - 3, 96 * k, 6);
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.moveTo(x + sgn * 22, y);
        ctx.lineTo(x, y - 12);
        ctx.lineTo(x, y + 12);
        ctx.closePath();
        ctx.fill();
        // 글자
        ctx.globalAlpha = 1;
        ctx.font = '15px "Jua", sans-serif';
        const tw = ctx.measureText(text).width + 14;
        const tx = left ? 30 : W - 30 - tw;
        const ty = y - 28;
        ctx.fillStyle = "rgba(14,10,34,0.82)";
        roundedRect(tx, ty, tw, 21, 10);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, tx + tw / 2, ty + 16);
      }
      ctx.restore();
    });
  }

  function draw() {
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(sx, sy);
    drawBackground();
    drawWarnings();
    shots.forEach(drawShuriken);
    drawPlayer();

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      ctx.fillStyle = f.color;
      ctx.font = '16px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (combo > 1 && state === "play") {
      const m = multiplier();
      ctx.fillStyle = m > 1 ? "#ffd76a" : "#fff3c8";
      ctx.font = '18px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(m > 1 ? `${combo}콤보 · 점수 ×${m}` : `${combo}콤보`, W / 2, 108);
    }

    if (tipT > 0 && state === "play") {
      ctx.globalAlpha = Math.min(1, tipT * 2);
      ctx.font = '16px "Jua", sans-serif';
      const tw = ctx.measureText(tip).width + 24;
      ctx.fillStyle = "rgba(14,10,34,0.84)";
      roundedRect(W / 2 - tw / 2, 214, tw, 30, 15);
      ctx.fill();
      ctx.fillStyle = "#fff3c8";
      ctx.textAlign = "center";
      ctx.fillText(tip, W / 2, 235);
      ctx.globalAlpha = 1;
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,120,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    accum += dt;
    let guard = 0;
    while (accum >= STEP && guard < 12) {
      update(STEP);
      accum -= STEP;
      guard += 1;
    }
    if (accum > 0.1) accum = 0;
    draw();
    requestAnimationFrame(loop);
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches && e.touches[0] ? e.touches[0] : e;
    return {
      x: ((src.clientX - rect.left) / rect.width) * W,
      y: ((src.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    const p = pointerPos(e);
    if (p.y < H - 96) pointerX = p.x;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (state !== "play" || pointerX == null) return;
    pointerX = pointerPos(e).x;
  });
  canvas.addEventListener("pointerup", () => {
    pointerX = null;
  });
  canvas.addEventListener("pointercancel", () => {
    pointerX = null;
  });

  function bindHold(btn, on, off) {
    const down = (e) => {
      e.preventDefault();
      btn.classList.add("held");
      on();
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove("held");
      off();
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }

  bindHold(
    document.getElementById("btn-crouch"),
    () => {
      holdCrouch = true;
    },
    () => {
      holdCrouch = false;
    }
  );
  document.getElementById("btn-jump").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    document.getElementById("btn-jump").classList.add("held");
    jumpPressed = true;
  });
  const jumpUp = (e) => {
    e.preventDefault();
    document.getElementById("btn-jump").classList.remove("held");
  };
  document.getElementById("btn-jump").addEventListener("pointerup", jumpUp);
  document.getElementById("btn-jump").addEventListener("pointerleave", jumpUp);
  document.getElementById("btn-jump").addEventListener("pointercancel", jumpUp);
  document.getElementById("btn-slash").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    trySlash();
  });

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (state !== "play") return;
    if (!e.repeat && (e.key === "z" || e.key === "Z" || e.key === "Enter")) {
      e.preventDefault();
      trySlash();
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  document.getElementById("start-btn").addEventListener("click", () => startGame(true));
  document.getElementById("retry-btn").addEventListener("click", () => startGame(true));

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
    const finalScore = Math.floor(score);
    const res = await window.TodayScores.submitScore("ninja-dodge", name, finalScore);
    if (res.ok) {
      submitted = true;
      lastRank = { rankDay: res.rankDay || res.rank, rankWeek: res.rankWeek };
      document.getElementById("rank-msg").textContent = window.TodayScores.formatRankMessage
        ? window.TodayScores.formatRankMessage(res)
        : res.rank
          ? `오늘 ${res.rank}위에 등록됐어요!`
          : "등록 완료!";
      if (shareBtn) shareBtn.hidden = false;
      if (window.TodayGameRank && TodayGameRank.afterSubmit) {
        await TodayGameRank.afterSubmit({
          gameId: "ninja-dodge",
          gameTitle: "닌자 표창 피하기",
          name,
          score: finalScore,
          rankDay: lastRank.rankDay,
          label: `${finalScore.toLocaleString("ko-KR")}점`,
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
        gameTitle: "닌자 표창 피하기",
        name,
        score: Math.floor(score),
        rankDay: lastRank.rankDay,
        rankWeek: lastRank.rankWeek,
        url: "https://www.todaygame.co.kr/games/ninja-dodge/",
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

  makeLeaves();
  hudDirty = true;
  updateHud();
  loadAssets().then(() => {
    showOverlay("title");
    last = performance.now();
    requestAnimationFrame(loop);
    if (window.NinjaDodge) window.NinjaDodge.ready = true;
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
        last = performance.now();
        accum = 0;
        return true;
      },
    });
  }

  // 자동 점검용 (게임 규칙 그대로 빠르게 돌린다)
  window.NinjaDodge = {
    ready: false,
    STEP,
    GROUND,
    W,
    LANE_Y,
    update,
    switchGap,
    start: () => startGame(true),
    trySlash,
    keys,
    shield: (sec) => {
      invuln = sec;
    },
    hold: (on) => {
      holdCrouch = on;
    },
    jump: () => {
      jumpPressed = true;
    },
    moveTo: (x) => {
      pointerX = x;
    },
    get state() {
      return state;
    },
    get time() {
      return playTime;
    },
    get score() {
      return Math.floor(score);
    },
    get lives() {
      return lives;
    },
    get combo() {
      return combo;
    },
    get shots() {
      return shots;
    },
    get warnings() {
      return warnings;
    },
    get plan() {
      return plan;
    },
    get player() {
      return player;
    },
    get stats() {
      return stats;
    },
    difficulty: getDifficulty,
  };
})();
