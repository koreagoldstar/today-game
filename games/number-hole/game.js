(() => {
  "use strict";

  const GAME_ID = "number-hole";
  const W = 390;
  const H = 700;
  const WORLD = 4800;
  const START_POWER = 2;
  const MAX_POWER = 24;
  const MAX_COMBO = 12;
  const TOTAL_STAGES = 30;

  const STAGE_NAMES = [
    "첫 한입", "골목 사냥", "네온 광장", "라이벌 등장", "밤의 추격",
    "숫자 폭풍", "거대 세력", "위험 지대", "황금 먹이", "미드나잇",
    "포식자", "생존전", "도시 전쟁", "최상위", "최종 결전",
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
    goal: 8 + i * 2,
    startPower: Math.min(2 + Math.floor(i / 5), 5),
    rivals: Math.min(4 + Math.floor(i / 2), 12),
    food: Math.min(40 + i * 2, 70),
    time: Math.max(55, 90 - i),
    aggress: 0.55 + i * 0.02,
    bigChance: Math.min(0.45, 0.22 + i * 0.012),
  }));

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };
  const hint = document.getElementById("hint");

  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let combo = 0;
  let comboTimer = 0;
  let maxCombo = 0;
  let eaten = 0;
  let timeLeft = 70;
  let player = null;
  let foods = [];
  let rivals = [];
  let props = [];
  let particles = [];
  let floats = [];
  let swirls = [];
  let trails = [];
  let shake = 0;
  let flash = 0;
  let hintTimer = 0;
  let spawnAcc = 0;
  let rivalAcc = 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let pointerId = null;
  let stick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
  let keys = { up: false, down: false, left: false, right: false };

  const FOOD_COLORS = ["#ff7aa2", "#ff9a4a", "#4ecdc4", "#7aa2ff", "#c084fc", "#f5c842", "#ff6b7a"];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function foodColor(p) {
    return FOOD_COLORS[(Math.max(1, p) - 1) % FOOD_COLORS.length];
  }
  function rivalColor(i) {
    const cols = ["#ff5d4e", "#3db4ef", "#4fd48c", "#f0a03a", "#d67ad0", "#ff8a5c"];
    return cols[i % cols.length];
  }

  function powerRadius(p) {
    return 15 + Math.log2(1 + clamp(p, 1, MAX_POWER)) * 5.6;
  }
  function powerSpeed(p) {
    return Math.max(145, 250 - Math.log2(1 + p) * 11);
  }
  function viewZoom() {
    if (!player) return 1;
    return clamp(1 - (player.power - START_POWER) * 0.014, 0.52, 1);
  }
  function massNeeded(p) {
    return 2 + Math.floor(p * 0.75);
  }

  function showOverlay(name) {
    Object.keys(overlays).forEach((k) => {
      overlays[k].classList.toggle("hidden", k !== name);
    });
  }
  function hideOverlays() {
    Object.keys(overlays).forEach((k) => overlays[k].classList.add("hidden"));
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-power").textContent = player ? String(player.power) : "2";
    document.getElementById("hud-goal").textContent = `${eaten}/${st.goal}`;
    document.getElementById("goal-fill").style.width = `${Math.min(100, (eaten / st.goal) * 100)}%`;
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.85, vy: -50 });
  }
  function burst(x, y, color, n = 10) {
    for (let i = 0; i < Math.min(n, 18); i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 180);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.25, 0.55), r: rand(1.5, 4.5), color, glow: true,
      });
    }
  }
  function spawnSwirl(x, y) {
    for (let i = 0; i < 4; i++) {
      swirls.push({ x, y, a: rand(0, Math.PI * 2), r: rand(18, 40), life: rand(0.35, 0.7), w: rand(2, 4.5) });
    }
  }

  function rollFoodPower(base, st) {
    const roll = Math.random();
    if (roll < 0.42) return Math.max(1, base - 1 - Math.floor(Math.random() * 2));
    if (roll < 0.62) return base;
    if (roll < 0.62 + st.bigChance) return Math.min(MAX_POWER, base + 1 + Math.floor(Math.random() * 3));
    return Math.max(1, base - 1);
  }

  function makeFood(forced) {
    const st = STAGES[stageIndex];
    const base = player ? player.power : st.startPower;
    const p = forced == null ? rollFoodPower(base, st) : forced;
    return {
      x: rand(120, WORLD - 120),
      y: rand(120, WORLD - 120),
      power: Math.max(1, p),
      bob: rand(0, Math.PI * 2),
      star: Math.random() < 0.04,
    };
  }

  function makeRival(forced, nearPlayer) {
    const st = STAGES[stageIndex];
    const base = player ? player.power : st.startPower;
    let p;
    if (forced != null) p = forced;
    else {
      const roll = Math.random();
      if (roll < 0.3) p = Math.max(1, base - 1);
      else if (roll < 0.5) p = base;
      else p = base + 1 + Math.floor(Math.random() * (1 + Math.floor(stageIndex / 4)));
    }
    p = clamp(p, 1, MAX_POWER);

    let x;
    let y;
    if (player && nearPlayer !== false) {
      // Spawn in a ring around the player so fights happen on-screen
      const ang = rand(0, Math.PI * 2);
      const dist = rand(220, 520);
      x = clamp(player.x + Math.cos(ang) * dist, 80, WORLD - 80);
      y = clamp(player.y + Math.sin(ang) * dist, 80, WORLD - 80);
    } else {
      do {
        x = rand(200, WORLD - 200);
        y = rand(200, WORLD - 200);
      } while (player && Math.hypot(x - player.x, y - player.y) < 180);
    }

    return {
      x, y, power: p, mass: 0, vx: 0, vy: 0,
      color: rivalColor(Math.floor(Math.random() * 6)),
      think: rand(0.1, 0.35), target: null, mode: "hunt",
      mouth: 0, facing: 0, alive: true, rage: 0, pack: Math.random() < 0.55,
    };
  }

  function buildCity() {
    props = [];
    const kinds = [
      { kind: "building", w: 52, h: 78, val: 3, hue: 265 },
      { kind: "building", w: 44, h: 64, val: 2, hue: 20 },
      { kind: "building", w: 36, h: 90, val: 4, hue: 210 },
      { kind: "car", w: 38, h: 22, val: 1, hue: 0 },
      { kind: "tree", w: 34, h: 42, val: 1, hue: 130 },
      { kind: "lamp", w: 16, h: 50, val: 2, hue: 45 },
      { kind: "bus", w: 58, h: 30, val: 3, hue: 200 },
    ];
    for (let i = 0; i < 55; i++) {
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      props.push({
        x: rand(160, WORLD - 160),
        y: rand(160, WORLD - 160),
        w: k.w, h: k.h, val: k.val + (Math.random() < 0.2 ? 1 : 0),
        kind: k.kind, hue: k.hue, eaten: false,
      });
    }
  }

  function resetStage() {
    const st = STAGES[stageIndex];
    eaten = 0;
    timeLeft = st.time;
    combo = 0;
    comboTimer = 0;
    foods = [];
    rivals = [];
    particles = [];
    floats = [];
    swirls = [];
    trails = [];
    shake = 0;
    flash = 0;
    player = {
      x: WORLD / 2, y: WORLD / 2,
      power: st.startPower, mass: 0,
      mouth: 0, facing: 0, invuln: 1.6, squash: 0,
    };
    buildCity();
    for (let i = 0; i < st.food; i++) foods.push(makeFood());
    // Guaranteed nearby threats (some bigger, some smaller)
    const nearby = Math.max(5, st.rivals);
    for (let i = 0; i < nearby; i++) {
      let bias;
      if (i < 2) bias = st.startPower + 1 + Math.floor(i / 1);
      else if (i < 4) bias = st.startPower;
      else bias = Math.max(1, st.startPower - 1);
      rivals.push(makeRival(bias, true));
    }
    hintTimer = 3;
    hint.classList.remove("fade");
    hint.textContent = "빨간·컬러 팩맨이 적! 작으면 흡수, 크면 도망!";
    updateHud();
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    hideOverlays();
    stageIndex = 0;
    score = 0;
    maxCombo = 0;
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stageClear() {
    state = "clear";
    score += 50 + stageIndex * 15 + Math.floor(timeLeft);
    document.getElementById("clear-detail").textContent =
      `${STAGES[stageIndex].name} · 점수 ${score.toLocaleString()} · 숫자 ${player.power}`;
    showOverlay("clear");
  }

  function nextStage() {
    if (stageIndex + 1 >= TOTAL_STAGES) {
      state = "all";
      document.getElementById("all-detail").textContent =
        `최종 점수 ${score.toLocaleString()} · 최고콤보 ${maxCombo}`;
      showOverlay("all");
      if (window.TodayGameRank) {
        TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "넘버 홀", formParent: overlays.all });
        TodayGameRank.open(score);
      }
      return;
    }
    hideOverlays();
    stageIndex += 1;
    resetStage();
    state = "play";
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function endGame(reason) {
    state = "over";
    const badge = document.getElementById("over-badge");
    const title = document.getElementById("over-title");
    if (reason === "eaten") {
      badge.textContent = "ABSORBED";
      badge.className = "badge";
      title.textContent = "삼켜졌어요!";
    } else {
      badge.textContent = "TIME UP";
      badge.className = "badge soft";
      title.textContent = "시간 종료!";
    }
    document.getElementById("over-detail").textContent =
      `STAGE ${stageIndex + 1} · 점수 ${score.toLocaleString()} · 숫자 ${player ? player.power : 0} · 콤보 ${maxCombo}`;
    showOverlay("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "넘버 홀", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function growPlayer(bite, x, y, label) {
    const gain = bite <= 1 ? 1 : bite === 2 ? 2 : Math.min(4, bite);
    player.mass += gain;
    let leveled = 0;
    while (player.power < MAX_POWER && player.mass >= massNeeded(player.power)) {
      player.mass -= massNeeded(player.power);
      player.power += 1;
      leveled += 1;
    }
    if (player.power >= MAX_POWER) player.mass = 0;

    const points = 4 + Math.min(combo, MAX_COMBO) + leveled * 10;
    score += points;
    combo = Math.min(MAX_COMBO, combo + 1);
    maxCombo = Math.max(maxCombo, combo);
    comboTimer = 1.4;
    eaten += 1;

    burst(x, y, "#f5c842", 7 + bite);
    spawnSwirl(player.x, player.y);
    player.squash = leveled ? 0.4 : 0.15;
    if (leveled) {
      addFloat(x, y - 12, `${player.power}!`, "#ffe27a");
      flash = 0.12;
      shake = 0.22;
    } else {
      addFloat(x, y - 8, label || `+${points}`, "#f0c44a");
    }
    if (combo >= 4 && combo % 2 === 0) addFloat(x, y - 28, `${combo} HIT`, "#ff7a68");

    updateHud();
    if (eaten >= STAGES[stageIndex].goal) stageClear();
  }

  function rivalGrow(r, amt) {
    r.mass += amt;
    const need = massNeeded(r.power);
    if (r.power < MAX_POWER && r.mass >= need) {
      r.mass = 0;
      r.power += 1;
      r.rage = 1.2;
    }
  }

  function canAbsorb(eater, prey, dist) {
    return prey < eater && dist < powerRadius(eater) * 0.8;
  }

  function separate(a, b, push) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = Math.hypot(dx, dy) || 0.001;
    a.x += (dx / d) * push;
    a.y += (dy / d) * push;
    b.x -= (dx / d) * push;
    b.y -= (dy / d) * push;
  }

  function tryEatFood(f, i, dt) {
    let dist = Math.hypot(f.x - player.x, f.y - player.y);
    if (f.power < player.power && dist < powerRadius(player.power) * 1.65) {
      const ang = Math.atan2(player.y - f.y, player.x - f.x);
      f.x += Math.cos(ang) * 140 * dt;
      f.y += Math.sin(ang) * 140 * dt;
      dist = Math.hypot(f.x - player.x, f.y - player.y);
    }
    if (canAbsorb(player.power, f.power, dist)) {
      growPlayer(f.power, f.x, f.y, f.star ? "★" : null);
      if (f.star) { player.mass += 2; score += 8; }
      foods.splice(i, 1);
    } else if (f.power >= player.power && dist < powerRadius(player.power) * 0.85) {
      const ang = Math.atan2(f.y - player.y, f.x - player.x);
      f.x += Math.cos(ang) * 8;
      f.y += Math.sin(ang) * 8;
    }
  }

  function tryEatProp(p) {
    if (p.eaten) return;
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    if (p.val < player.power && dist < powerRadius(player.power) * 0.78 + Math.max(p.w, p.h) * 0.15) {
      p.eaten = true;
      growPlayer(1, p.x, p.y, null);
      burst(p.x, p.y, `hsl(${p.hue},55%,55%)`, 8);
    }
  }

  function rivalAI(r, dt) {
    const st = STAGES[stageIndex];
    if (r.rage > 0) r.rage -= dt;
    r.think -= dt;

    if (r.think <= 0 || !r.target) {
      r.think = rand(0.12, 0.4);
      let best = null;
      let bestD = Infinity;
      r.target = null;

      for (const f of foods) {
        if (f.power >= r.power) continue;
        const d = Math.hypot(f.x - r.x, f.y - r.y);
        if (d < bestD) { bestD = d; best = f; }
      }

      if (player) {
        const pd = Math.hypot(player.x - r.x, player.y - r.y);
        // Prefer engaging the player whenever relatively nearby
        if (r.power > player.power && pd < 900) {
          r.mode = "hunt";
          r.target = { x: player.x, y: player.y };
        } else if (r.power === player.power && pd < 420) {
          r.mode = "bully";
          r.target = { x: player.x, y: player.y };
        } else if (player.power > r.power && pd < 280) {
          r.mode = "flee";
          r.target = { x: r.x + (r.x - player.x) * 1.5, y: r.y + (r.y - player.y) * 1.5 };
        } else if (pd < 650 && Math.random() < 0.55) {
          // Even weaker/equal rivals occasionally rush the action
          r.mode = "contest";
          r.target = { x: player.x + rand(-80, 80), y: player.y + rand(-80, 80) };
        } else {
          r.mode = "feed";
        }
      }

      if (r.pack && player && r.power >= player.power) {
        for (const o of rivals) {
          if (o === r || !o.alive) continue;
          if (o.mode === "hunt" && Math.hypot(o.x - r.x, o.y - r.y) < 360) {
            r.target = { x: (o.x + player.x) / 2, y: (o.y + player.y) / 2 };
            r.mode = "pack";
            break;
          }
        }
      }

      if (!r.target) {
        if (best && bestD < 500) r.target = { x: best.x, y: best.y };
        else if (player) r.target = { x: player.x + rand(-200, 200), y: player.y + rand(-200, 200) };
        else r.target = { x: rand(150, WORLD - 150), y: rand(150, WORLD - 150) };
      }
    }

    if (r.target) {
      const ang = Math.atan2(r.target.y - r.y, r.target.x - r.x);
      let sp = powerSpeed(r.power) * (0.78 + st.aggress * 0.25);
      if (r.mode === "hunt" || r.mode === "pack" || r.mode === "contest") sp *= 1.25 + (r.rage > 0 ? 0.2 : 0);
      if (r.mode === "flee") sp *= 1.15;
      r.vx = Math.cos(ang) * sp;
      r.vy = Math.sin(ang) * sp;
      r.facing = ang;
    }
    r.x = clamp(r.x + r.vx * dt, 50, WORLD - 50);
    r.y = clamp(r.y + r.vy * dt, 50, WORLD - 50);
    r.mouth = (r.mouth + dt * 11) % (Math.PI * 2);

    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (canAbsorb(r.power, f.power, Math.hypot(f.x - r.x, f.y - r.y))) {
        rivalGrow(r, f.power <= 1 ? 1 : 2);
        foods.splice(i, 1);
      }
    }
    for (const p of props) {
      if (!p.eaten && p.val < r.power && Math.hypot(p.x - r.x, p.y - r.y) < powerRadius(r.power) * 0.7) {
        p.eaten = true;
        rivalGrow(r, 1);
      }
    }
  }

  function resolvePlayerRival(r, i, dt) {
    let dist = Math.hypot(r.x - player.x, r.y - player.y);
    const sumR = powerRadius(player.power) + powerRadius(r.power);

    if (r.power < player.power && dist < powerRadius(player.power) * 1.4 && dist > sumR * 0.5) {
      const ang = Math.atan2(player.y - r.y, player.x - r.x);
      r.x += Math.cos(ang) * 75 * dt;
      r.y += Math.sin(ang) * 75 * dt;
      dist = Math.hypot(r.x - player.x, r.y - player.y);
    }

    if (player.power > r.power && canAbsorb(player.power, r.power, dist)) {
      growPlayer(Math.min(4, r.power), r.x, r.y, "라이벌");
      score += 14 + r.power * 2;
      burst(r.x, r.y, r.color, 16);
      rivals.splice(i, 1);
      return "ate";
    }

    if (player.invuln <= 0 && r.power > player.power && dist < powerRadius(r.power) * 0.7) {
      burst(player.x, player.y, "#ff6b5a", 20);
      endGame("eaten");
      return "dead";
    }

    if (r.power === player.power && dist < sumR * 0.88) {
      separate(player, r, 7);
      // equal clash sparks
      if (Math.random() < 0.08) burst((player.x + r.x) / 2, (player.y + r.y) / 2, "#fff", 4);
    } else if (dist < sumR * 0.5) {
      separate(player, r, 3);
    }
    return "ok";
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (player.squash > 0) player.squash -= dt;
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hint.classList.add("fade");
    }

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame("time");
      return;
    }

    let mx = 0;
    let my = 0;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (stick.active && (Math.abs(stick.dx) > 6 || Math.abs(stick.dy) > 6)) {
      mx = stick.dx;
      my = stick.dy;
    }
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      const sp = powerSpeed(player.power);
      const ox = player.x;
      const oy = player.y;
      player.x += (mx / len) * sp * dt;
      player.y += (my / len) * sp * dt;
      player.facing = Math.atan2(my, mx);
      player.mouth = (player.mouth + dt * 13) % (Math.PI * 2);
      trails.push({ x: ox, y: oy, life: 0.28, r: powerRadius(player.power) * 0.35 });
    } else {
      player.mouth *= 0.88;
    }
    player.x = clamp(player.x, 50, WORLD - 50);
    player.y = clamp(player.y, 50, WORLD - 50);

    for (const f of foods) f.bob += dt * 3.2;
    for (let i = foods.length - 1; i >= 0; i--) tryEatFood(foods[i], i, dt);
    for (const p of props) tryEatProp(p);

    for (let i = rivals.length - 1; i >= 0; i--) {
      const r = rivals[i];
      if (!r.alive) { rivals.splice(i, 1); continue; }
      rivalAI(r, dt);
      const res = resolvePlayerRival(r, i, dt);
      if (res === "dead") return;
      if (res === "ate") continue;
    }

    // Rival warfare
    for (let i = 0; i < rivals.length; i++) {
      for (let j = i + 1; j < rivals.length; j++) {
        const a = rivals[i];
        const b = rivals[j];
        if (!a.alive || !b.alive) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const sumR = powerRadius(a.power) + powerRadius(b.power);
        if (d >= sumR * 0.72) continue;
        if (a.power > b.power && d < powerRadius(a.power) * 0.72) {
          rivalGrow(a, 2);
          b.alive = false;
          burst(b.x, b.y, b.color, 8);
        } else if (b.power > a.power && d < powerRadius(b.power) * 0.72) {
          rivalGrow(b, 2);
          a.alive = false;
          burst(a.x, a.y, a.color, 8);
        } else {
          separate(a, b, 5);
        }
      }
    }
    rivals = rivals.filter((r) => r.alive);

    const st = STAGES[stageIndex];
    spawnAcc += dt;
    if (spawnAcc > 0.65 && foods.length < st.food) {
      spawnAcc = 0;
      foods.push(makeFood());
    }
    rivalAcc += dt;
    if (rivalAcc > Math.max(2.2, 4.2 - stageIndex * 0.08) && rivals.length < st.rivals + 3) {
      rivalAcc = 0;
      rivals.push(makeRival(player.power + Math.floor(rand(0, 2 + stageIndex * 0.1)), true));
    }

    for (let i = trails.length - 1; i >= 0; i--) {
      trails[i].life -= dt;
      if (trails[i].life <= 0) trails.splice(i, 1);
    }
    if (particles.length > 110) particles.splice(0, particles.length - 110);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
    for (let i = swirls.length - 1; i >= 0; i--) {
      const s = swirls[i];
      s.life -= dt;
      s.a += dt * 9;
      s.r += dt * 38;
      if (s.life <= 0) swirls.splice(i, 1);
    }
  }

  function worldToScreen(x, y) {
    const z = viewZoom();
    return {
      x: (x - player.x) * z + W / 2,
      y: (y - player.y) * z + H / 2,
    };
  }

  function roundRect(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function drawProp(g, p) {
    if (p.eaten) return;
    const s = worldToScreen(p.x, p.y);
    const z = viewZoom();
    if (s.x < -90 || s.y < -90 || s.x > W + 90 || s.y > H + 90) return;
    g.save();
    g.translate(s.x, s.y);
    const can = player && p.val < player.power;
    const w = p.w * z;
    const h = p.h * z;

    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(0, h * 0.42, w * 0.45, h * 0.12, 0, 0, Math.PI * 2);
    g.fill();

    if (p.kind === "car" || p.kind === "bus") {
      g.fillStyle = can ? "#e84545" : "#4a3038";
      roundRect(g, -w / 2, -h / 2, w, h * 0.7, 5 * z);
      g.fill();
      g.fillStyle = can ? "#7ad7ff" : "#3a4a55";
      roundRect(g, -w * 0.28, -h * 0.42, w * 0.56, h * 0.28, 3 * z);
      g.fill();
      g.fillStyle = "#1a1a1a";
      g.beginPath();
      g.arc(-w * 0.28, h * 0.22, 4 * z, 0, Math.PI * 2);
      g.arc(w * 0.28, h * 0.22, 4 * z, 0, Math.PI * 2);
      g.fill();
    } else if (p.kind === "tree") {
      g.fillStyle = can ? "#8b5a2b" : "#3d2e22";
      roundRect(g, -w * 0.12, h * 0.05, w * 0.24, h * 0.4, 2 * z);
      g.fill();
      g.fillStyle = can ? "#3ecf6a" : "#2a5a3a";
      roundRect(g, -w / 2, -h / 2, w, h * 0.55, 6 * z);
      g.fill();
    } else if (p.kind === "lamp") {
      g.fillStyle = can ? "#6a7380" : "#3a4048";
      roundRect(g, -2 * z, -h * 0.35, 4 * z, h * 0.7, 2 * z);
      g.fill();
      g.fillStyle = can ? "#ffe27a" : "#6a6040";
      g.shadowColor = can ? "rgba(255,220,100,0.75)" : "transparent";
      g.shadowBlur = can ? 14 : 0;
      g.beginPath();
      g.arc(0, -h * 0.38, 7 * z, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    } else {
      const c1 = can ? `hsl(${p.hue},52%,50%)` : `hsl(${p.hue},16%,28%)`;
      const c2 = can ? `hsl(${p.hue},45%,38%)` : `hsl(${p.hue},12%,20%)`;
      const grad = g.createLinearGradient(-w / 2, 0, w / 2, 0);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      g.fillStyle = grad;
      roundRect(g, -w / 2, -h / 2, w, h, 6 * z);
      g.fill();
      g.fillStyle = can ? "rgba(255,230,140,0.55)" : "rgba(80,90,100,0.3)";
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          roundRect(g, -w * 0.28 + col * w * 0.32, -h * 0.32 + row * h * 0.22, w * 0.18, h * 0.12, 2 * z);
          g.fill();
        }
      }
    }

    const br = Math.max(9, 11 * z);
    g.fillStyle = can ? "rgba(20,28,40,0.88)" : "rgba(10,14,20,0.72)";
    g.beginPath();
    g.arc(0, 0, br, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = can ? "#f0c44a" : "rgba(255,255,255,0.12)";
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = can ? "#ffe27a" : "#8a9aaa";
    g.font = `700 ${Math.max(10, 12 * z)}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(p.val), 0, 1);
    g.restore();
  }

  function drawFood(g, f) {
    const s = worldToScreen(f.x, f.y);
    const z = viewZoom();
    const rad = powerRadius(f.power) * 0.4 * z;
    const bob = Math.sin(f.bob) * 2.5;
    if (s.x < -40 || s.y < -40 || s.x > W + 40 || s.y > H + 40) return;
    const can = f.power < player.power;
    const danger = f.power > player.power;
    const col = f.star ? "#f5c842" : foodColor(f.power);

    g.save();
    g.translate(s.x, s.y + bob);
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.beginPath();
    g.ellipse(1, rad * 0.55, rad * 0.65, rad * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    if (can || f.star) {
      g.shadowColor = col;
      g.shadowBlur = 12;
    } else if (danger) {
      g.shadowColor = "#ff4a4a";
      g.shadowBlur = 8;
    }

    if (f.star) {
      g.fillStyle = "#f5c842";
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        g.lineTo(Math.cos(a) * rad * 1.15, Math.sin(a) * rad * 1.15);
        g.lineTo(Math.cos(a + Math.PI / 5) * rad * 0.45, Math.sin(a + Math.PI / 5) * rad * 0.45);
      }
      g.closePath();
      g.fill();
    } else {
      const grd = g.createRadialGradient(-rad * 0.3, -rad * 0.35, rad * 0.1, 0, 0, rad);
      grd.addColorStop(0, can ? "#fff6e8" : danger ? "#ffd0d0" : "#9aa8b4");
      grd.addColorStop(0.4, col);
      grd.addColorStop(1, "#1a222c");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, rad, 0, Math.PI * 2);
      g.fill();
    }
    g.shadowBlur = 0;

    g.fillStyle = "rgba(255,255,255,0.45)";
    g.beginPath();
    g.ellipse(-rad * 0.28, -rad * 0.32, rad * 0.28, rad * 0.16, -0.5, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#1a2030";
    g.font = `700 ${Math.max(10, rad * 1.05)}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(f.power), 0, 1);
    g.restore();
  }

  function drawPac(g, x, y, power, color, mouthPhase, facing, isPlayer) {
    const s = worldToScreen(x, y);
    const z = viewZoom();
    let rad = powerRadius(power) * z;
    if (isPlayer && player.squash > 0) rad *= 1 + player.squash * 0.22;
    if (s.x < -70 || s.y < -70 || s.x > W + 70 || s.y > H + 70) return;

    g.save();
    g.translate(s.x, s.y);

    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath();
    g.ellipse(2, rad * 0.55, rad * 0.78, rad * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    if (isPlayer) {
      for (let i = 0; i < 4; i++) {
        const rr = rad + 8 + i * 7 + Math.sin(time * 4.2 + i) * 2;
        g.strokeStyle = `rgba(90,210,255,${0.3 - i * 0.06})`;
        g.lineWidth = 2.2;
        g.beginPath();
        g.arc(0, 0, rr, time * 3 + i * 0.7, time * 3 + i * 0.7 + Math.PI * 1.15);
        g.stroke();
      }
    }

    const mouth = (0.15 + Math.abs(Math.sin(mouthPhase || 0)) * 0.34) * Math.PI;
    g.rotate(facing || 0);

    const grd = g.createRadialGradient(-rad * 0.28, -rad * 0.32, rad * 0.08, 0, 0, rad);
    if (isPlayer) {
      grd.addColorStop(0, "#fff4b8");
      grd.addColorStop(0.4, "#f5c842");
      grd.addColorStop(1, "#c87814");
      g.shadowColor = "rgba(245,200,66,0.65)";
      g.shadowBlur = 18;
    } else {
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(0.35, color);
      grd.addColorStop(1, "#1a1828");
      g.shadowColor = color;
      g.shadowBlur = 10;
    }

    g.fillStyle = grd;
    g.beginPath();
    if (mouth > 0.05) {
      g.arc(0, 0, rad, mouth * 0.5, Math.PI * 2 - mouth * 0.5);
      g.lineTo(0, 0);
    } else {
      g.arc(0, 0, rad, 0, Math.PI * 2);
    }
    g.closePath();
    g.fill();
    g.shadowBlur = 0;

    g.fillStyle = "rgba(255,255,255,0.38)";
    g.beginPath();
    g.ellipse(-rad * 0.28, -rad * 0.32, rad * 0.32, rad * 0.18, -0.5, 0, Math.PI * 2);
    g.fill();

    const eyeX = rad * 0.24;
    const eyeY = -rad * 0.3;
    g.fillStyle = "#151820";
    g.beginPath();
    g.arc(eyeX, eyeY, rad * 0.18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(eyeX - rad * 0.05, eyeY - rad * 0.05, rad * 0.06, 0, Math.PI * 2);
    g.fill();

    g.rotate(-(facing || 0));

    const fs = Math.max(13, Math.min(30, rad * 0.95));
    g.font = `700 ${fs}px "Bagel Fat One","Jua"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (isPlayer) {
      g.lineWidth = Math.max(2.5, fs * 0.14);
      g.strokeStyle = "rgba(255,255,255,0.95)";
      g.fillStyle = "#f5c842";
      g.strokeText(String(power), rad * 0.06, rad * 0.14);
      g.fillText(String(power), rad * 0.06, rad * 0.14);
    } else {
      g.fillStyle = "#121820";
      g.fillText(String(power), 0, 2);
    }
    g.restore();
  }

  function draw(g) {
    if (!player) return;
    g.save();
    if (shake > 0) g.translate(rand(-2.5, 2.5) * shake * 5, rand(-2.5, 2.5) * shake * 5);

    const bg = g.createRadialGradient(W * 0.5, H * 0.32, 20, W * 0.5, H * 0.55, H);
    bg.addColorStop(0, "#1a4060");
    bg.addColorStop(0.45, "#0d2438");
    bg.addColorStop(1, "#060e18");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const z = viewZoom();
    const step = 90;
    g.strokeStyle = "rgba(100,170,220,0.055)";
    g.lineWidth = 1;
    const x0 = Math.floor((player.x - W / z) / step) * step;
    const y0 = Math.floor((player.y - H / z) / step) * step;
    for (let x = x0; x < player.x + W / z + step; x += step) {
      const sx = worldToScreen(x, player.y).x;
      g.beginPath();
      g.moveTo(sx, 0);
      g.lineTo(sx, H);
      g.stroke();
    }
    for (let y = y0; y < player.y + H / z + step; y += step) {
      const sy = worldToScreen(player.x, y).y;
      g.beginPath();
      g.moveTo(0, sy);
      g.lineTo(W, sy);
      g.stroke();
    }

    for (const t of trails) {
      const s = worldToScreen(t.x, t.y);
      g.globalAlpha = Math.max(0, t.life * 1.2);
      g.fillStyle = "rgba(245,200,66,0.35)";
      g.beginPath();
      g.arc(s.x, s.y, t.r * z, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    props.slice().sort((a, b) => a.y - b.y).forEach((p) => drawProp(g, p));
    for (const f of foods) drawFood(g, f);

    for (const sw of swirls) {
      const p = worldToScreen(sw.x, sw.y);
      g.strokeStyle = `rgba(100,210,255,${Math.max(0, sw.life)})`;
      g.lineWidth = sw.w;
      g.beginPath();
      g.arc(p.x, p.y, sw.r * z, sw.a, sw.a + 1.9);
      g.stroke();
    }

    for (const r of rivals) drawPac(g, r.x, r.y, r.power, r.color, r.mouth, r.facing, false);
    const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    if (!blink) drawPac(g, player.x, player.y, player.power, "#f5c842", player.mouth, player.facing, true);

    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      g.globalAlpha = Math.max(0, p.life * 2.2);
      if (p.glow) { g.shadowColor = p.color; g.shadowBlur = 8; }
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(s.x, s.y, p.r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;

    for (const f of floats) {
      const s = worldToScreen(f.x, f.y);
      g.globalAlpha = Math.min(1, f.life * 1.5);
      g.fillStyle = f.color;
      g.font = '700 15px "Bagel Fat One","Jua"';
      g.textAlign = "center";
      g.fillText(f.text, s.x, s.y);
    }
    g.globalAlpha = 1;

    // minimap
    const mw = 78;
    const mh = 78;
    const mx = W - mw - 12;
    const my = H - mh - 52;
    g.fillStyle = "rgba(6,16,28,0.85)";
    g.strokeStyle = "rgba(100,180,230,0.35)";
    g.lineWidth = 1.5;
    roundRect(g, mx, my, mw, mh, 12);
    g.fill();
    g.stroke();
    const sx = mw / WORLD;
    const sy = mh / WORLD;
    // view rect
    g.strokeStyle = "rgba(245,200,66,0.35)";
    g.strokeRect(
      mx + (player.x - W / (2 * z)) * sx,
      my + (player.y - H / (2 * z)) * sy,
      (W / z) * sx,
      (H / z) * sy
    );
    for (const r of rivals) {
      g.fillStyle = r.color;
      g.beginPath();
      g.arc(mx + r.x * sx, my + r.y * sy, 2.3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#f5c842";
    g.beginPath();
    g.arc(mx + player.x * sx, my + player.y * sy, 3.5, 0, Math.PI * 2);
    g.fill();

    // time chip
    g.fillStyle = "rgba(6,18,32,0.75)";
    roundRect(g, 12, H - 44, 72, 28, 10);
    g.fill();
    g.fillStyle = timeLeft < 12 ? "#ff6b5c" : "#d5eaf5";
    g.font = '700 14px "Jua"';
    g.textAlign = "left";
    g.fillText(`${Math.ceil(timeLeft)}초`, 24, H - 25);

    if (stick.active) {
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.beginPath();
      g.arc(stick.ox, stick.oy, 36, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(120,200,255,0.4)";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "rgba(245,200,66,0.55)";
      g.beginPath();
      g.arc(stick.ox + clamp(stick.dx, -24, 24), stick.oy + clamp(stick.dy, -24, 24), 14, 0, Math.PI * 2);
      g.fill();
    }

    if (flash > 0) {
      g.fillStyle = `rgba(245,200,66,${flash * 0.3})`;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    try {
      if (state === "play") {
        update(dt);
        draw(ctx);
      } else if (state === "paused") {
        draw(ctx);
      } else {
        draw(ctx);
        return;
      }
    } catch (err) {
      console.error("[number-hole]", err);
    }
    if (state === "play" || state === "paused") raf = requestAnimationFrame(loop);
  }

  function canvasPos(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * W,
      y: ((ev.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if (state !== "play") return;
    pointerId = ev.pointerId;
    try { canvas.setPointerCapture(pointerId); } catch (_) { /* ignore */ }
    const p = canvasPos(ev);
    stick.active = true;
    stick.ox = p.x; stick.oy = p.y;
    stick.dx = 0; stick.dy = 0;
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (state !== "play" || ev.pointerId !== pointerId || !stick.active) return;
    const p = canvasPos(ev);
    stick.dx = p.x - stick.ox;
    stick.dy = p.y - stick.oy;
  });
  canvas.addEventListener("pointerup", (ev) => {
    if (ev.pointerId === pointerId) {
      pointerId = null;
      stick.active = false;
      stick.dx = 0; stick.dy = 0;
    }
  });
  canvas.addEventListener("pointercancel", () => {
    pointerId = null;
    stick.active = false;
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") { keys.left = true; ev.preventDefault(); }
    if (ev.code === "ArrowRight" || ev.code === "KeyD") { keys.right = true; ev.preventDefault(); }
    if (ev.code === "ArrowUp" || ev.code === "KeyW") { keys.up = true; ev.preventDefault(); }
    if (ev.code === "ArrowDown" || ev.code === "KeyS") { keys.down = true; ev.preventDefault(); }
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") keys.left = false;
    if (ev.code === "ArrowRight" || ev.code === "KeyD") keys.right = false;
    if (ev.code === "ArrowUp" || ev.code === "KeyW") keys.up = false;
    if (ev.code === "ArrowDown" || ev.code === "KeyS") keys.down = false;
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("again-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "넘버 홀", formParent: overlays.title });
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

  // Title preview
  stageIndex = 0;
  player = { x: WORLD / 2, y: WORLD / 2, power: 7, mass: 0, mouth: 0, facing: 0, invuln: 0, squash: 0 };
  buildCity();
  foods = [makeFood(1), makeFood(2), makeFood(3), makeFood(1), makeFood(4), makeFood(2)];
  foods[0].x = WORLD / 2 + 110; foods[0].y = WORLD / 2 - 10;
  foods[1].x = WORLD / 2 + 150; foods[1].y = WORLD / 2 + 50;
  foods[2].x = WORLD / 2 + 90; foods[2].y = WORLD / 2 + 80;
  rivals = [makeRival(4, true), makeRival(5, true), makeRival(8, true)];
  last = performance.now();
  raf = requestAnimationFrame(function idle(now) {
    if (state !== "title") return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    player.facing = Math.sin(time * 0.55) * 0.45;
    player.mouth = time * 9;
    player.x = WORLD / 2 + Math.cos(time * 0.4) * 50;
    player.y = WORLD / 2 + Math.sin(time * 0.35) * 35;
    for (const f of foods) {
      f.bob += dt * 3;
      const ang = Math.atan2(player.y - f.y, player.x - f.x);
      if (f.power < player.power) {
        f.x += Math.cos(ang) * 22 * dt;
        f.y += Math.sin(ang) * 22 * dt;
      }
    }
    draw(ctx);
    raf = requestAnimationFrame(idle);
  });
})();
