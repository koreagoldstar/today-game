(() => {
  "use strict";

  const CW = 640;
  const CH = 480;
  const MAX_LIVES = 5;
  const STAGE_COUNT = 50;
  const START_ITEMS = { hint: 5, reveal: 3, heart: 2, shield: 2 };
  const MAX_ITEMS = { hint: 8, reveal: 5, heart: 4, shield: 4 };

  const THEMES = [
    { id: "park", name: "공원 산책" },
    { id: "beach", name: "해변 하루" },
    { id: "room", name: "아늑한 방" },
    { id: "cafe", name: "달콤 카페" },
    { id: "snow", name: "눈 오는 날" },
    { id: "night", name: "별빛 밤" },
  ];

  const PROP_KINDS = [
    "balloon",
    "flower",
    "bird",
    "butterfly",
    "heart",
    "star",
    "cat",
    "mushroom",
    "kite",
    "cup",
    "tree",
    "ball",
    "cloud",
    "sun",
  ];

  const TINTS = [
    null,
    "#ff8eb5",
    "#8ec8ff",
    "#ffe58a",
    "#8fd98c",
    "#c9b0ff",
  ];

  // 비슷한 소품끼리만 바꿔서 한눈에 안 띄게
  const SIMILAR = {
    balloon: ["kite", "ball", "heart"],
    flower: ["mushroom", "heart", "star"],
    bird: ["butterfly", "kite"],
    butterfly: ["bird", "flower"],
    heart: ["star", "flower", "balloon"],
    star: ["heart", "sun"],
    cat: ["mushroom", "ball"],
    mushroom: ["flower", "tree"],
    kite: ["balloon", "bird"],
    cup: ["ball", "heart"],
    tree: ["mushroom", "flower"],
    ball: ["cup", "balloon"],
    cloud: ["balloon", "sun"],
    sun: ["star", "cloud"],
  };

  function mulberry32(a) {
    return function rand() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rand, arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  function buildStage(index) {
    const rand = mulberry32(8800 + index * 173);
    const theme = THEMES[index % THEMES.length];
    const need = Math.min(7, 3 + Math.floor(index / 6));
    const hitR = Math.max(0.048, 0.1 - index * 0.0011);
    const hard = Math.min(1, index / 20);

    // 소품을 많이 깔아 차이를 묻음
    const baseProps = [];
    const count = 16 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i += 1) {
      const kind = pick(rand, PROP_KINDS);
      const skyish = kind === "cloud" || kind === "sun" || kind === "bird" || kind === "kite" || kind === "butterfly";
      let x = 0.1 + rand() * 0.8;
      let y = skyish ? 0.1 + rand() * 0.34 : 0.34 + rand() * 0.54;
      // 너무 겹치면 살짝 밀기
      for (let t = 0; t < 6; t += 1) {
        const clash = baseProps.some((p) => Math.hypot(p.x - x, p.y - y) < 0.09);
        if (!clash) break;
        x = 0.1 + rand() * 0.8;
        y = skyish ? 0.1 + rand() * 0.34 : 0.34 + rand() * 0.54;
      }
      baseProps.push({
        id: `p${i}`,
        kind,
        x,
        y,
        s: 0.55 + rand() * 0.4,
        tint: rand() < 0.55 ? 0 : Math.floor(rand() * TINTS.length),
        flip: rand() < 0.5,
      });
    }

    // 초반엔 미세한 차이 위주, 뒤로 갈수록 missing 조금 섞음
    const modePool = [
      "nudge",
      "nudge",
      "flip",
      "scale",
      "recolor",
      "recolor",
      ...(hard > 0.25 ? ["swap", "missing"] : []),
      ...(hard > 0.55 ? ["missing", "swap"] : []),
    ];

    const diffs = [];
    const used = new Set();
    let guard = 0;
    while (diffs.length < need && guard < 160) {
      guard += 1;
      const src = pick(rand, baseProps);
      if (used.has(src.id)) continue;
      const tooClose = diffs.some((d) => Math.hypot(d.x - src.x, d.y - src.y) < 0.13);
      if (tooClose) continue;

      let mode = pick(rand, modePool);
      // 큰 소품은 빼지 않음 — 빈자리가 너무 티남
      if (mode === "missing" && src.s > 0.78) mode = "nudge";
      if (mode === "swap" && src.s > 0.85) mode = "flip";

      used.add(src.id);
      const similar = SIMILAR[src.kind] || PROP_KINDS.filter((k) => k !== src.kind);
      const nudge = 0.028 + hard * 0.02;
      diffs.push({
        id: `d${diffs.length}`,
        propId: src.id,
        x: src.x,
        y: src.y,
        mode,
        altKind: pick(rand, similar),
        altTint: src.tint === 0 ? 1 + Math.floor(rand() * 4) : 0,
        dx: (rand() < 0.5 ? -1 : 1) * (nudge + rand() * nudge),
        dy: (rand() < 0.5 ? -1 : 1) * (nudge * 0.85 + rand() * nudge),
        scaleMul: rand() < 0.5 ? 0.82 : 1.18,
      });
    }

    return {
      index,
      name: `${theme.name} ${Math.floor(index / THEMES.length) + 1}`,
      theme,
      baseProps,
      diffs,
      hitR,
      need: diffs.length,
    };
  }

  const STAGES = Array.from({ length: STAGE_COUNT }, (_, i) => buildStage(i));

  const leftCanvas = document.getElementById("left");
  const rightCanvas = document.getElementById("right");
  const leftCtx = leftCanvas.getContext("2d");
  const rightCtx = rightCanvas.getContext("2d");

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const bgImgs = {};
  const propImgs = {};
  let assetsReady = false;

  let state = "title";
  let stageIndex = 0;
  let found = new Set();
  let lives = MAX_LIVES;
  let sceneTime = 0;
  let totalTime = 0;
  let score = 0;
  let runStartedAt = 0;
  let stageStartedAt = 0;
  let missRings = [];
  let sparkles = [];
  let hintFx = [];
  let items = { ...START_ITEMS };
  let shieldActive = false;
  let last = 0;
  let raf = 0;
  let toastUntil = 0;
  let toastMsg = "";

  function showOverlay(key) {
    Object.entries(overlays).forEach(([k, el]) => el.classList.toggle("hidden", k !== key));
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function hearts(n) {
    return "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, MAX_LIVES - n));
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-total").textContent = String(STAGE_COUNT);
    document.getElementById("hud-found").textContent = String(found.size);
    document.getElementById("hud-need").textContent = String(st.need);
    document.getElementById("hud-lives").textContent = hearts(lives) + (shieldActive ? " 🛡️" : "");
    document.getElementById("hud-time").textContent = formatTime(sceneTime);

    const status = document.getElementById("hint");
    if (performance.now() < toastUntil && toastMsg) {
      status.textContent = toastMsg;
    } else if (state === "play") {
      const left = st.need - found.size;
      status.textContent = shieldActive
        ? `${st.name} · 남은 차이 ${left}개 · 실드 ON`
        : `${st.name} · 다른 곳 ${left}개 남음`;
    } else {
      status.textContent = "다른 곳을 찾아 눌러요!";
    }

    updateItemBar();
  }

  function updateItemBar() {
    const playing = state === "play";
    const remaining = STAGES[stageIndex].diffs.filter((d) => !found.has(d.id)).length;

    const hintBtn = document.getElementById("item-hint");
    const revealBtn = document.getElementById("item-reveal");
    const heartBtn = document.getElementById("item-heart");
    const shieldBtn = document.getElementById("item-shield");

    document.getElementById("count-hint").textContent = String(items.hint);
    document.getElementById("count-reveal").textContent = String(items.reveal);
    document.getElementById("count-heart").textContent = String(items.heart);
    document.getElementById("count-shield").textContent = String(items.shield);

    hintBtn.disabled = !playing || items.hint <= 0 || remaining <= 0;
    revealBtn.disabled = !playing || items.reveal <= 0 || remaining <= 0;
    heartBtn.disabled = !playing || items.heart <= 0 || lives >= MAX_LIVES;
    shieldBtn.disabled = !playing || items.shield <= 0 || shieldActive;
    shieldBtn.classList.toggle("on", shieldActive);
  }

  function showToast(msg, ms = 1600) {
    toastMsg = msg;
    toastUntil = performance.now() + ms;
    updateHud();
  }

  function remainingDiffs() {
    return STAGES[stageIndex].diffs.filter((d) => !found.has(d.id));
  }

  function grantClearBonus() {
    // 스테이지 클리어마다 소량 보급 (상한 있음)
    const roll = (stageIndex + 1) % 3;
    if (roll === 0 && items.hint < MAX_ITEMS.hint) {
      items.hint += 1;
      return "힌트 +1";
    }
    if (roll === 1 && items.reveal < MAX_ITEMS.reveal) {
      items.reveal += 1;
      return "찾아주기 +1";
    }
    if (lives < MAX_LIVES && items.heart < MAX_ITEMS.heart && stageIndex % 4 === 3) {
      items.heart += 1;
      return "하트 +1";
    }
    if (items.shield < MAX_ITEMS.shield && stageIndex % 5 === 4) {
      items.shield += 1;
      return "실드 +1";
    }
    if (items.hint < MAX_ITEMS.hint) {
      items.hint += 1;
      return "힌트 +1";
    }
    return null;
  }

  function markFound(diff, side) {
    if (!diff || found.has(diff.id)) return false;
    found.add(diff.id);
    addSparkles(side || "left", diff.x, diff.y);
    addSparkles(side === "left" ? "right" : "left", diff.x, diff.y);
    // 힌트 이펙트 제거
    hintFx = hintFx.filter((h) => h.id !== diff.id);
    return true;
  }

  function checkStageClear() {
    const st = STAGES[stageIndex];
    if (found.size < st.need) return;
    const elapsed = (performance.now() - stageStartedAt) / 1000;
    score += 100 + Math.max(0, Math.floor(20 - elapsed)) * 8;
    state = "clear";
    totalTime += sceneTime;
    const bonus = grantClearBonus();
    const bonusText = bonus ? ` · ${bonus}` : "";
    document.getElementById("clear-detail").textContent =
      `${st.name} · ${formatTime(sceneTime)} · 남은 목숨 ${lives}${bonusText} · 점수 ${score}`;
    if (stageIndex >= STAGE_COUNT - 1) {
      document.getElementById("all-detail").textContent =
        `${STAGE_COUNT}단계 완주! 총 ${formatTime(totalTime)} · 점수 ${score}`;
      showOverlay("all");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "diff", gameTitle: "다른 그림 찾기", formParent: document.getElementById("allclear") });
      TodayGameRank.open(score);
    }
    } else {
      showOverlay("clear");
    }
    updateHud();
  }

  function useHint() {
    if (state !== "play" || items.hint <= 0) return;
    const left = remainingDiffs();
    if (!left.length) return;
    items.hint -= 1;
    const target = left[Math.floor(Math.random() * left.length)];
    hintFx.push({
      id: target.id,
      x: target.x,
      y: target.y,
      life: 2.8,
      pulse: 0,
    });
    showToast("힌트! 반짝이는 곳을 보세요");
    redraw();
  }

  function useReveal() {
    if (state !== "play" || items.reveal <= 0) return;
    const left = remainingDiffs();
    if (!left.length) return;
    items.reveal -= 1;
    const target = left[Math.floor(Math.random() * left.length)];
    markFound(target, "left");
    showToast("찾아주기! 차이 1개를 찾았어요");
    updateHud();
    redraw();
    checkStageClear();
  }

  function useHeart() {
    if (state !== "play" || items.heart <= 0 || lives >= MAX_LIVES) return;
    items.heart -= 1;
    lives = Math.min(MAX_LIVES, lives + 1);
    showToast("하트 회복! 목숨 +1");
  }

  function useShield() {
    if (state !== "play" || items.shield <= 0 || shieldActive) return;
    items.shield -= 1;
    shieldActive = true;
    showToast("실드 ON · 다음 실수 1회 방어");
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    await Promise.all(
      THEMES.map(async (t) => {
        bgImgs[t.id] = await loadImage(`assets/bg-${t.id}.jpg`);
      })
    );
    await Promise.all(
      PROP_KINDS.map(async (k) => {
        propImgs[k] = await loadImage(`assets/prop-${k}.png`);
      })
    );
    assetsReady = true;
  }

  function rightPropFor(stage, prop) {
    const diff = stage.diffs.find((d) => d.propId === prop.id);
    if (!diff) return prop;
    if (diff.mode === "missing") return null;
    if (diff.mode === "recolor") return { ...prop, tint: diff.altTint };
    if (diff.mode === "swap") return { ...prop, kind: diff.altKind };
    if (diff.mode === "flip") return { ...prop, flip: !prop.flip };
    if (diff.mode === "scale") return { ...prop, s: prop.s * diff.scaleMul };
    if (diff.mode === "nudge" || diff.mode === "move") {
      return {
        ...prop,
        x: Math.min(0.9, Math.max(0.08, prop.x + diff.dx)),
        y: Math.min(0.9, Math.max(0.08, prop.y + diff.dy)),
      };
    }
    return prop;
  }

  function drawTintedImage(ctx, img, x, y, w, h, tint) {
    if (!img) return;
    if (!tint) {
      ctx.drawImage(img, x, y, w, h);
      return;
    }
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.ceil(w));
    off.height = Math.max(1, Math.ceil(h));
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0, off.width, off.height);
    octx.globalCompositeOperation = "source-atop";
    octx.fillStyle = tint;
    octx.globalAlpha = 0.22;
    octx.fillRect(0, 0, off.width, off.height);
    ctx.drawImage(off, x, y);
  }

  function drawProp(ctx, prop, w, h) {
    const img = propImgs[prop.kind];
    const size = 48 * prop.s;
    const ratio = img ? img.width / img.height : 1;
    const pw = size * ratio;
    const ph = size;
    const x = prop.x * w;
    const y = prop.y * h;

    ctx.save();
    ctx.translate(x, y);
    if (prop.flip) ctx.scale(-1, 1);

    ctx.fillStyle = "rgba(40, 50, 70, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, ph * 0.42, pw * 0.32, ph * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    drawTintedImage(ctx, img, -pw / 2, -ph / 2, pw, ph, TINTS[prop.tint]);
    ctx.restore();
  }

  function drawBackdrop(ctx, theme, w, h) {
    const bg = bgImgs[theme.id];
    if (bg) {
      ctx.drawImage(bg, 0, 0, w, h);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#bfe8ff");
      g.addColorStop(1, "#ffe8f4");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // soft vignette for polish
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, 40, w * 0.5, h * 0.45, w * 0.72);
    vig.addColorStop(0, "rgba(255,255,255,0)");
    vig.addColorStop(1, "rgba(30,45,70,0.12)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  function drawScene(ctx, stage, side) {
    const w = CW;
    const h = CH;
    ctx.clearRect(0, 0, w, h);
    drawBackdrop(ctx, stage.theme, w, h);

    const sorted = [...stage.baseProps].sort((a, b) => a.y - b.y);
    for (const prop of sorted) {
      const drawn = side === "left" ? prop : rightPropFor(stage, prop);
      if (drawn) drawProp(ctx, drawn, w, h);
    }

    for (const id of found) {
      const d = stage.diffs.find((x) => x.id === id);
      if (!d) continue;
      const r = Math.max(22, stage.hitR * w * 0.9);
      ctx.save();
      ctx.strokeStyle = "#ff4d7a";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "rgba(255,77,122,0.55)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,77,122,0.12)";
      ctx.fill();
      ctx.restore();
    }

    for (const m of missRings.filter((r) => r.side === side)) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, m.life * 2);
      ctx.strokeStyle = "#ff8eb5";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const s of sparkles.filter((p) => p.side === side)) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life * 1.8);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const h of hintFx) {
      const pulse = 0.55 + Math.sin(h.pulse * 6) * 0.45;
      const r = Math.max(28, stage.hitR * w * 1.35) * (0.85 + pulse * 0.25);
      ctx.save();
      ctx.globalAlpha = Math.min(1, h.life * 0.55) * pulse;
      ctx.strokeStyle = "#ffe365";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "rgba(255, 227, 101, 0.9)";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(h.x * w, h.y * h, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 227, 101, 0.16)";
      ctx.fill();
      // 작은 화살 점
      ctx.globalAlpha = Math.min(1, h.life) * pulse;
      ctx.fillStyle = "#fff7c2";
      ctx.beginPath();
      ctx.arc(h.x * w, h.y * h - r - 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function resizeCanvases() {
    leftCanvas.width = CW;
    leftCanvas.height = CH;
    rightCanvas.width = CW;
    rightCanvas.height = CH;
  }

  function redraw() {
    const st = STAGES[stageIndex];
    drawScene(leftCtx, st, "left");
    drawScene(rightCtx, st, "right");
  }

  function canvasPoint(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      nx: (clientX - rect.left) / Math.max(1, rect.width),
      ny: (clientY - rect.top) / Math.max(1, rect.height),
    };
  }

  function addSparkles(side, nx, ny) {
    for (let i = 0; i < 10; i += 1) {
      sparkles.push({
        side,
        x: nx + (Math.random() - 0.5) * 0.08,
        y: ny + (Math.random() - 0.5) * 0.08,
        size: 2 + Math.random() * 3,
        life: 0.45 + Math.random() * 0.25,
        color: ["#fff", "#ffd86b", "#ff9ec4", "#9ed8ff"][Math.floor(Math.random() * 4)],
      });
    }
  }

  function handleTap(canvas, side, clientX, clientY) {
    if (state !== "play") return;
    const st = STAGES[stageIndex];
    const p = canvasPoint(canvas, clientX, clientY);
    let hit = null;
    let best = Infinity;

    for (const d of st.diffs) {
      if (found.has(d.id)) continue;
      const candidates = [{ x: d.x, y: d.y }];
      if (d.mode === "nudge" || d.mode === "move") {
        candidates.push({
          x: Math.min(0.9, Math.max(0.08, d.x + d.dx)),
          y: Math.min(0.9, Math.max(0.08, d.y + d.dy)),
        });
      }
      for (const c of candidates) {
        const dist = Math.hypot(p.nx - c.x, p.ny - c.y);
        if (dist < st.hitR && dist < best) {
          best = dist;
          hit = d;
        }
      }
    }

    if (hit) {
      markFound(hit, side);
      updateHud();
      redraw();
      checkStageClear();
      return;
    }

    if (shieldActive) {
      shieldActive = false;
      missRings.push({ side, x: p.nx, y: p.ny, r: 12, life: 0.45 });
      showToast("실드가 실수를 막아줬어요!");
      redraw();
      return;
    }

    lives -= 1;
    missRings.push({ side, x: p.nx, y: p.ny, r: 12, life: 0.4 });
    updateHud();
    if (lives <= 0) {
      state = "over";
      document.getElementById("over-detail").textContent =
        `STAGE ${stageIndex + 1} · 찾은 차이 ${found.size}/${st.need}`;
      showOverlay("over");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "diff", gameTitle: "다른 그림 찾기", formParent: document.getElementById("over") });
      TodayGameRank.open(score);
    }
      updateItemBar();
    }
  }

  function startStage(idx, resetAll) {
    stageIndex = idx;
    if (resetAll) {
      totalTime = 0;
      score = 0;
      lives = MAX_LIVES;
      items = { ...START_ITEMS };
      runStartedAt = performance.now();
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    found = new Set();
    missRings = [];
    sparkles = [];
    hintFx = [];
    shieldActive = false;
    toastUntil = 0;
    toastMsg = "";
    sceneTime = 0;
    state = "play";
    stageStartedAt = performance.now();
    showOverlay(null);
    updateHud();
    redraw();
  }

  function tick(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    let dirty = false;
    if (state === "play") {
      sceneTime += dt;
      if (performance.now() < toastUntil) dirty = true;
      updateHud();
    }
    for (let i = missRings.length - 1; i >= 0; i -= 1) {
      const m = missRings[i];
      m.life -= dt;
      m.r += 70 * dt;
      dirty = true;
      if (m.life <= 0) missRings.splice(i, 1);
    }
    for (let i = sparkles.length - 1; i >= 0; i -= 1) {
      const s = sparkles[i];
      s.life -= dt;
      s.y -= dt * 0.08;
      dirty = true;
      if (s.life <= 0) sparkles.splice(i, 1);
    }
    for (let i = hintFx.length - 1; i >= 0; i -= 1) {
      const h = hintFx[i];
      h.life -= dt;
      h.pulse += dt;
      dirty = true;
      if (h.life <= 0) hintFx.splice(i, 1);
    }
    // 상시 흔들림 없이, 이펙트 있을 때만 다시 그림 (차이 스포일러 방지)
    if (assetsReady && (dirty || missRings.length || sparkles.length || hintFx.length)) redraw();
    raf = requestAnimationFrame(tick);
  }

  function bindCanvas(canvas, side) {
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        handleTap(canvas, side, e.clientX, e.clientY);
      },
      { passive: false }
    );
  }

  bindCanvas(leftCanvas, "left");
  bindCanvas(rightCanvas, "right");

  document.getElementById("item-hint").addEventListener("click", useHint);
  document.getElementById("item-reveal").addEventListener("click", useReveal);
  document.getElementById("item-heart").addEventListener("click", useHeart);
  document.getElementById("item-shield").addEventListener("click", useShield);

  document.getElementById("start-btn").addEventListener("click", () => startStage(0, true));
  document.getElementById("retry-btn").addEventListener("click", () => startStage(stageIndex, true));
  document.getElementById("again-btn").addEventListener("click", () => startStage(0, true));
  document.getElementById("next-btn").addEventListener("click", () => startStage(stageIndex + 1, false));

  window.addEventListener("resize", () => {
    resizeCanvases();
    if (assetsReady) redraw();
  });

  resizeCanvases();
  updateHud();
  showOverlay("title");
  loadAssets().then(() => {
    stageIndex = 0;
    redraw();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "diff",
      gameTitle: "다른 그림 찾기",
      formParent: document.getElementById("over") || document.body,
    });
  }
})();
