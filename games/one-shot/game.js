(() => {
  "use strict";

  const GAME_ID = "one-shot";
  const W = 390;
  const H = 700;
  const BEST_KEY = "todaygame-one-shot-best";
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 5.5;
  const HIP_ZOOM = 1; // wide vista — targets stay tiny until scoped
  const PART = {
    head: { label: "헤드샷", mult: 2.5, color: "#ffd76a" },
    body: { label: "몸통", mult: 1.0, color: "#71e0ff" },
    leg: { label: "다리", mult: 0.5, color: "#a8b4c4" },
  };

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

  const stageEl = document.querySelector(".stage");
  const hudStage = document.getElementById("hud-stage");
  const hudScore = document.getElementById("hud-score");
  const hudBest = document.getElementById("hud-best");
  const hudAmmo = document.getElementById("hud-ammo");
  const hint = document.getElementById("hint");
  const title = document.getElementById("title");
  const clear = document.getElementById("clear");
  const over = document.getElementById("over");
  const allclear = document.getElementById("allclear");
  const clearDetail = document.getElementById("clear-detail");
  const clearStars = document.getElementById("clear-stars");
  const overDetail = document.getElementById("over-detail");
  const allDetail = document.getElementById("all-detail");
  const zoomFill = document.getElementById("zoom-fill");
  const zoomLabel = document.getElementById("zoom-label");
  const scopeBtn = document.getElementById("scope-btn");
  const steadyBtn = document.getElementById("steady-btn");
  const fireBtn = document.getElementById("fire-btn");

  const raw = {
    enemy: loadImg("assets/enemy.png"),
    scope: loadImg("assets/scope.png"),
    bg0: loadImg("assets/bg-nest.png"),
    bg1: loadImg("assets/bg-nest-night.png"),
    bg2: loadImg("assets/bg-alley.png"),
    bg3: loadImg("assets/bg-rooftop.png"),
    bg4: loadImg("assets/bg-market.png"),
  };
  const img = { enemy: null, scope: null, bgs: [] };
  let assetsReady = false;

  function loadImg(src) {
    const i = new Image();
    i.src = src;
    return i;
  }

  function isKeyBg(r, g, b, a) {
    if (a < 10) return true;
    // pure / near-black plate
    if (r < 10 && g < 10 && b < 10) return true;
    // magenta / hot-pink chroma
    if (r > 170 && b > 150 && g < 120 && r + b > g * 2.1) return true;
    // magenta fringe
    if (r > 140 && b > 120 && g < 100 && r > g + 40 && b > g + 30) return true;
    return false;
  }

  function punchKey(source) {
    const c = document.createElement("canvas");
    c.width = source.naturalWidth || source.width;
    c.height = source.naturalHeight || source.height;
    const x = c.getContext("2d");
    x.drawImage(source, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    const w = c.width;
    const h = c.height;
    const seen = new Uint8Array(w * h);
    const stack = [];
    const push = (px, py) => {
      if (px < 0 || py < 0 || px >= w || py >= h) return;
      const i = py * w + px;
      if (seen[i]) return;
      seen[i] = 1;
      stack.push(i);
    };
    for (let px = 0; px < w; px++) {
      push(px, 0);
      push(px, h - 1);
    }
    for (let py = 0; py < h; py++) {
      push(0, py);
      push(w - 1, py);
    }
    while (stack.length) {
      const i = stack.pop();
      const o = i * 4;
      if (!isKeyBg(d[o], d[o + 1], d[o + 2], d[o + 3])) continue;
      d[o + 3] = 0;
      const px = i % w;
      const py = (i / w) | 0;
      push(px + 1, py);
      push(px - 1, py);
      push(px, py + 1);
      push(px, py - 1);
    }
    // soften leftover key fringe on opaque edge
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      if (isKeyBg(d[i], d[i + 1], d[i + 2], 255)) {
        d[i + 3] = 0;
        continue;
      }
      // kill leftover magenta tint in semi-transparent edge
      if (d[i] > 100 && d[i + 2] > 90 && d[i + 1] < 90) {
        d[i + 3] = Math.min(d[i + 3], 40);
      }
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function waitAssets() {
    return Promise.all(
      Object.values(raw).map(
        (im) =>
          new Promise((res) => {
            if (im.complete && im.naturalWidth) res();
            else {
              im.onload = () => res();
              im.onerror = () => res();
            }
          })
      )
    ).then(() => {
      // enemy.png already edge-punched to alpha (dark clothes — don't re-key black)
      if (raw.enemy.naturalWidth) img.enemy = raw.enemy;
      if (raw.scope.naturalWidth) img.scope = punchKey(raw.scope);
      img.bgs = [raw.bg0, raw.bg1, raw.bg2, raw.bg3, raw.bg4].map((b) =>
        b && b.naturalWidth ? b : null
      );
      assetsReady = true;
    });
  }

  /**
   * Feet on real surfaces only (balcony decks, door recesses, beside car/crates, roof decks).
   * cover > 0 clips legs so peek-behind-rail reads natural.
   * Multi-target = left↔right or high↔low — never the same corner.
   */
  const SPOTS = {
    // courtyard — best calibrated BG
    0: {
      balL: { x: 0.15, foot: 0.5, cover: 0.22, face: 1 }, // mashrabiya deck (legs behind rail)
      door: { x: 0.19, foot: 0.58, cover: 0, face: 1 }, // recessed door L
      car: { x: 0.25, foot: 0.65, cover: 0, face: 1 }, // beside sedan
      crate: { x: 0.68, foot: 0.74, cover: 0, face: -1 }, // left of crate stack
      arch: { x: 0.47, foot: 0.525, cover: 0, face: -1 }, // back arch passage
      shop: { x: 0.86, foot: 0.625, cover: 0, face: -1 }, // right doorway
      roof: { x: 0.62, foot: 0.3, cover: 0.12, face: -1 }, // laundry rooftop
      patrol: { foot: 0.64, x0: 0.34, x1: 0.5 },
    },
    1: {
      balL: { x: 0.15, foot: 0.5, cover: 0.22, face: 1 },
      door: { x: 0.19, foot: 0.58, cover: 0, face: 1 },
      car: { x: 0.25, foot: 0.65, cover: 0, face: 1 },
      crate: { x: 0.68, foot: 0.74, cover: 0, face: -1 },
      arch: { x: 0.47, foot: 0.525, cover: 0, face: -1 },
      shop: { x: 0.86, foot: 0.625, cover: 0, face: -1 },
      roof: { x: 0.62, foot: 0.3, cover: 0.12, face: -1 },
      patrol: { foot: 0.64, x0: 0.34, x1: 0.5 },
    },
    // alley — ground only (near doors / beside crates / far path)
    2: {
      doorR: { x: 0.86, foot: 0.78, cover: 0, face: -1 },
      crateL: { x: 0.38, foot: 0.68, cover: 0, face: 1 },
      crateR: { x: 0.62, foot: 0.66, cover: 0, face: -1 },
      far: { x: 0.5, foot: 0.5, cover: 0, face: 1 },
      patrol: { foot: 0.66, x0: 0.44, x1: 0.56 },
    },
    // rooftop — flat decks + balcony recess
    3: {
      dish: { x: 0.54, foot: 0.605, cover: 0, face: 1 }, // roof by satellite dishes
      bal: { x: 0.37, foot: 0.52, cover: 0.18, face: 1 }, // orange arch balcony
      tank: { x: 0.8, foot: 0.6, cover: 0, face: -1 }, // roof beside water tank
      far: { x: 0.52, foot: 0.38, cover: 0, face: -1 },
      patrol: { foot: 0.6, x0: 0.48, x1: 0.58 },
    },
    // market — beside van / stall crates / fountain rim / door recess
    4: {
      van: { x: 0.21, foot: 0.55, cover: 0, face: 1 },
      stall: { x: 0.8, foot: 0.56, cover: 0, face: -1 },
      fountain: { x: 0.38, foot: 0.64, cover: 0, face: 1 }, // beside fountain, not in it
      door: { x: 0.93, foot: 0.52, cover: 0, face: -1 },
      crate: { x: 0.28, foot: 0.58, cover: 0, face: 1 }, // crates by van
      patrol: { foot: 0.58, x0: 0.35, x1: 0.48 },
    },
  };

  function T(spot, move, opts = {}) {
    return { spot, move, s: opts.s ?? 0.44, ...opts };
  }

  // Teach solid hides on nest → opposite corners → other maps (verified spots only)
  const STAGES = [
    { bg: 0, ammo: 4, wind: 0, night: 0, targets: [T("balL", "hide", { s: 0.44 })] },
    { bg: 0, ammo: 4, wind: 0.03, night: 0, targets: [T("door", "hide", { s: 0.42 })] },
    { bg: 0, ammo: 3, wind: 0.04, night: 0, targets: [T("crate", "hide", { s: 0.46 })] },
    { bg: 0, ammo: 3, wind: 0.05, night: 0, targets: [T("car", "hide", { s: 0.44 })] },
    { bg: 0, ammo: 3, wind: 0.06, night: 0, targets: [T("balL", "hide", { s: 0.42 }), T("crate", "hide", { s: 0.44 })] },
    { bg: 0, ammo: 3, wind: 0.07, night: 0, targets: [T("door", "hide", { s: 0.4 }), T("shop", "hide", { s: 0.4 })] },
    { bg: 0, ammo: 3, wind: 0.07, night: 0, targets: [T("arch", "hide", { s: 0.36 }), T("car", "hide", { s: 0.42 })] },
    { bg: 2, ammo: 4, wind: 0.06, night: 0, targets: [T("doorR", "hide", { s: 0.44 })] },
    { bg: 2, ammo: 3, wind: 0.08, night: 0, targets: [T("crateL", "hide", { s: 0.42 }), T("doorR", "hide", { s: 0.42 })] },
    { bg: 4, ammo: 4, wind: 0.07, night: 0, targets: [T("van", "hide", { s: 0.44 })] },
    { bg: 4, ammo: 3, wind: 0.08, night: 0, targets: [T("van", "hide", { s: 0.42 }), T("stall", "hide", { s: 0.42 })] },
    { bg: 3, ammo: 3, wind: 0.1, night: 0, targets: [T("dish", "hide", { s: 0.4 })] },
    { bg: 3, ammo: 3, wind: 0.11, night: 0, targets: [T("bal", "hide", { s: 0.38 }), T("tank", "hide", { s: 0.36 })] },
    { bg: 0, ammo: 3, wind: 0.1, night: 0.1, targets: [T("patrol", "walk", { s: 0.44 }), T("crate", "hide", { s: 0.42 })] },
    { bg: 1, ammo: 3, wind: 0.11, night: 0.5, targets: [T("balL", "hide", { s: 0.42 }), T("crate", "hide", { s: 0.44 })] },
    { bg: 2, ammo: 3, wind: 0.1, night: 0.15, targets: [T("crateL", "hide", { s: 0.4 }), T("crateR", "hide", { s: 0.4 }), T("far", "hide", { s: 0.34 })] },
    { bg: 4, ammo: 3, wind: 0.1, night: 0.1, targets: [T("patrol", "walk", { s: 0.42 }), T("door", "hide", { s: 0.36 })] },
    { bg: 0, ammo: 4, wind: 0.08, night: 0, targets: [T("car", "hide", { s: 0.42 }), T("shop", "hide", { s: 0.4 }), T("roof", "hide", { s: 0.32 })] },
    { bg: 1, ammo: 3, wind: 0.12, night: 0.55, targets: [T("door", "hide", { s: 0.4 }), T("crate", "hide", { s: 0.44 })] },
    { bg: 3, ammo: 3, wind: 0.12, night: 0.1, targets: [T("dish", "hide", { s: 0.38 }), T("tank", "hide", { s: 0.36 })] },
    { bg: 2, ammo: 2, wind: 0.12, night: 0.25, targets: [T("crateL", "hide", { s: 0.42 }), T("doorR", "hide", { s: 0.42 })] },
    { bg: 4, ammo: 3, wind: 0.12, night: 0.15, targets: [T("stall", "hide", { s: 0.42 }), T("fountain", "hide", { s: 0.4 }), T("van", "hide", { s: 0.4 })] },
    { bg: 0, ammo: 2, wind: 0.16, night: 0.1, targets: [T("roof", "hide", { s: 0.32 }), T("balL", "hide", { s: 0.4 })] },
    { bg: 3, ammo: 3, wind: 0.14, night: 0.2, targets: [T("tank", "hide", { s: 0.36 }), T("dish", "hide", { s: 0.38 })] },
    { bg: 2, ammo: 3, wind: 0.12, night: 0.4, targets: [T("far", "hide", { s: 0.34 }), T("doorR", "hide", { s: 0.42 })] },
    { bg: 4, ammo: 3, wind: 0.14, night: 0.5, targets: [T("van", "hide", { s: 0.42 }), T("door", "hide", { s: 0.36 }), T("patrol", "walk", { s: 0.4 })] },
    { bg: 1, ammo: 3, wind: 0.14, night: 0.65, targets: [T("balL", "hide", { s: 0.4 }), T("patrol", "walk", { s: 0.42 }), T("crate", "hide", { s: 0.42 })] },
    { bg: 0, ammo: 3, wind: 0.1, night: 0.15, targets: [T("arch", "hide", { s: 0.36 }), T("door", "hide", { s: 0.4 })] },
    { bg: 3, ammo: 2, wind: 0.16, night: 0.3, targets: [T("far", "hide", { s: 0.3 }), T("bal", "hide", { s: 0.36 })] },
    { bg: 2, ammo: 3, wind: 0.12, night: 0.2, targets: [T("crateL", "hide", { s: 0.4 }), T("crateR", "hide", { s: 0.4 }), T("doorR", "hide", { s: 0.4 })] },
    { bg: 4, ammo: 3, wind: 0.14, night: 0.35, targets: [T("stall", "hide", { s: 0.42 }), T("van", "hide", { s: 0.4 }), T("fountain", "hide", { s: 0.4 })] },
    { bg: 0, ammo: 3, wind: 0.12, night: 0.2, targets: [T("shop", "hide", { s: 0.4 }), T("balL", "hide", { s: 0.4 })] },
    { bg: 1, ammo: 3, wind: 0.16, night: 0.75, targets: [T("car", "hide", { s: 0.42 }), T("crate", "hide", { s: 0.44 })] },
    { bg: 3, ammo: 2, wind: 0.2, night: 0.35, targets: [T("tank", "hide", { s: 0.34 })] },
    { bg: 2, ammo: 2, wind: 0.14, night: 0.5, targets: [T("crateR", "hide", { s: 0.42 }), T("far", "hide", { s: 0.34 })] },
    { bg: 0, ammo: 1, wind: 0.12, night: 0.2, targets: [T("roof", "hide", { s: 0.32 })] },
  ];

  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let ammo = 0;
  let ammoMax = 0;
  let targets = [];
  let wind = 0;
  let night = 0;
  let bgIndex = 0;
  let aimX = W * 0.5;
  let aimY = H * 0.48;
  let zoom = 1.25;
  let scoped = false;
  let steady = false;
  let steadyT = 1;
  let shake = 0;
  let flash = 0;
  let time = 0;
  let pops = [];
  let marks = [];
  let sparks = [];
  let dragging = false;
  let lastPtr = null;
  let pinchDist0 = 0;
  let pinchZoom0 = 1;
  let stageName = "";
  let headshots = 0;
  let showZones = 0;

  hudBest.textContent = String(best);

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function setZoom(z) {
    zoom = clamp(z, ZOOM_MIN, ZOOM_MAX);
    const t = (zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
    zoomFill.style.height = `${Math.round(16 + t * 84)}%`;
    zoomLabel.textContent = `${zoom.toFixed(1)}×`;
  }

  function setScoped(on) {
    scoped = on;
    scopeBtn.classList.toggle("on", on);
    if (on && zoom < 2.8) setZoom(3.4);
  }

  function viewZoom() {
    // Hip-fire stays wide; only scope magnifies — finding targets requires ADS
    return scoped ? zoom : HIP_ZOOM;
  }

  function resolveSpawn(bg, def, idx) {
    const spots = SPOTS[bg] || SPOTS[0];
    const spot = spots[def.spot] || spots.patrol || spots.balL;
    // Nearer (higher foot) reads bigger; clamp so mid/far stages stay readable
    const baseS = def.s ?? 0.44;
    const sScale = Math.max(0.34, Math.min(0.52, baseS * (0.85 + spot.foot * 0.3)));
    const h = 118 * sScale;
    const isPatrol = def.move === "walk" || spot.x0 != null;
    let xNorm;
    if (isPatrol && spot.x0 != null) {
      if (def.start != null) xNorm = clamp(def.start, spot.x0 + 0.02, spot.x1 - 0.02);
      else xNorm = clamp((spot.x0 + spot.x1) / 2 + (idx - 0.4) * 0.06, spot.x0 + 0.03, spot.x1 - 0.03);
    } else {
      xNorm = spot.x;
    }
    const footY = spot.foot * H;
    const cy = footY - h * 0.5;
    const face = spot.face != null ? spot.face : xNorm < 0.5 ? 1 : -1;
    const cover = def.cover != null ? def.cover : spot.cover || 0;
    const x0 = (spot.x0 != null ? spot.x0 : xNorm) * W;
    const x1 = (spot.x1 != null ? spot.x1 : xNorm) * W;
    const speed = def.speed != null ? def.speed : def.move === "walk" ? 18 : 0;
    return {
      bx: xNorm * W,
      footY,
      x: xNorm * W,
      y: cy,
      s: sScale,
      face,
      baseFace: face,
      move: def.move || "hide",
      x0,
      x1,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed,
      accel: 0,
      pause: rand(0.8, 2.2),
      stepPhase: 0,
      leanT: rand(4, 10),
      lean: 0,
      hide: cover,
      cover,
      spot: def.spot || "open",
    };
  }

  function loadStage(i) {
    stageIndex = i;
    const s = STAGES[i];
    stageName = "미션 " + (i + 1);
    wind = s.wind;
    night = s.night || 0;
    bgIndex = s.bg ?? 0;
    ammoMax = s.ammo;
    ammo = s.ammo;
    showZones = 0;
    targets = s.targets.map((t, idx) => ({
      id: idx,
      ...resolveSpawn(bgIndex, t, idx),
      alive: true,
      hitPart: null,
      fall: 0,
      flash: 0,
    }));
    aimX = W * 0.5;
    aimY = H * 0.5;
    setZoom(HIP_ZOOM);
    setScoped(false);
    steady = false;
    steadyT = 1;
    pops = [];
    marks = [];
    sparks = [];
    flash = 0;
    shake = 0;
    hudStage.textContent = String(i + 1);
    const totalEl = document.getElementById("hud-total");
    if (totalEl) totalEl.textContent = String(STAGES.length);
    hudScore.textContent = String(score);
    renderAmmo();
    hint.textContent = "스코프로 숨은 표적을 찾으세요";
  }

  function renderAmmo() {
    hudAmmo.innerHTML = "";
    for (let i = 0; i < ammoMax; i++) {
      const el = document.createElement("i");
      if (i >= ammo) el.className = "empty";
      hudAmmo.appendChild(el);
    }
  }

  function hideOverlays() {
    title.classList.add("hidden");
    clear.classList.add("hidden");
    over.classList.add("hidden");
    allclear.classList.add("hidden");
  }

  function startGame() {
    score = 0;
    headshots = 0;
    hideOverlays();
    stageEl.classList.add("playing");
    state = "play";
    loadStage(0);
    window.TodayGameBgm?.play?.(GAME_ID);
  }

  function aimWorld() {
    const sw = swayAmp();
    return {
      x: aimX + Math.sin(time * 3.05) * sw + Math.sin(time * 1.65) * sw * 0.45,
      y: aimY + Math.cos(time * 2.55) * sw * 0.88 + Math.sin(time * 4.1) * sw * 0.28,
    };
  }

  function swayAmp() {
    const base = scoped ? 6.2 : 3.4;
    const windPush = wind * 20;
    const breath = steady ? 0.18 : 1;
    const tired = 1 + (1 - steadyT) * 1.5;
    return ((base + windPush) * breath * tired) / Math.sqrt(viewZoom());
  }

  function targetH(t) {
    return 118 * t.s;
  }
  function targetW(t) {
    return 52 * t.s;
  }

  /** Visible top fraction after cover hide */
  function visibleTop(t) {
    return 1 - (t.hide || 0);
  }

  /** Match cardboard patches; respect cover clip from feet */
  function hitTest(t, wx, wy) {
    if (!t.alive) return null;
    const h = targetH(t);
    const w = targetW(t);
    const top = t.y - h * 0.5;
    const left = t.x - w * 0.5;
    const vis = Math.max(0.7, visibleTop(t));
    const clipY = top + h * vis;
    if (wy > clipY) return null; // behind cover

    const ry = (wy - top) / h;
    const rx = (wx - left) / w;

    const hx = t.x;
    const hy = top + h * 0.14;
    const hr = w * 0.28;
    if (Math.hypot(wx - hx, wy - hy) <= hr && hy + hr <= clipY + 2) return "head";

    if (wx < left || wx > left + w || wy < top || wy > clipY) return null;

    if (ry >= 0.28 && ry <= 0.6 && rx >= 0.18 && rx <= 0.82) return "body";
    if (ry > 0.6 && ry < vis && rx >= 0.12 && rx <= 0.88) return "leg";
    if (ry >= 0.22 && ry <= 0.62) return "body";
    if (ry > 0.62 && ry < vis) return "leg";
    return null;
  }

  function fire() {
    if (state !== "play" || ammo <= 0) return;
    ammo -= 1;
    renderAmmo();
    flash = 1;
    shake = scoped ? 8 : 4.5;
    showZones = 0;

    const a = aimWorld();
    const driftX = (Math.sin(time * 0.85) * wind * 16) / viewZoom();
    const wx = a.x + driftX;
    const wy = a.y;
    marks.push({ x: wx, y: wy, life: 1.4 });

    let hit = null;
    let part = null;
    const ordered = [...targets].filter((t) => t.alive).sort((a, b) => b.s - a.s);
    for (const t of ordered) {
      const p = hitTest(t, wx, wy);
      if (p) {
        hit = t;
        part = p;
        break;
      }
    }

    if (hit) {
      hit.alive = false;
      hit.hitPart = part;
      hit.flash = 1;
      hit.fall = 0;
      const info = PART[part];
      const distBonus = Math.round(45 * (2.15 - hit.s));
      const zoomBonus = Math.round((viewZoom() - 1) * 22);
      const pts = Math.round(100 * info.mult) + distBonus + zoomBonus + (steady ? 25 : 0);
      score += pts;
      if (part === "head") headshots += 1;
      hudScore.textContent = String(score);
      pops.push({
        x: hit.x,
        y: hit.y - targetH(hit) * 0.35,
        text: `${info.label} +${pts}`,
        color: info.color,
        life: 1.15,
      });
      for (let i = 0; i < 10; i++) {
        sparks.push({
          x: wx,
          y: wy,
          vx: rand(-80, 80),
          vy: rand(-120, -20),
          life: rand(0.35, 0.7),
          color: info.color,
        });
      }
      window.TodayGameBgm?.beep?.("ok");
    } else {
      pops.push({ x: wx, y: wy - 18, text: "빗나감", color: "#ff8a9a", life: 0.85 });
      sparks.push({ x: wx, y: wy, vx: 0, vy: 0, life: 0.25, color: "#fff" });
      window.TodayGameBgm?.beep?.("miss");
    }

    if (targets.every((t) => !t.alive)) setTimeout(stageClear, 450);
    else if (ammo <= 0) setTimeout(stageFail, 450);
  }

  function stageClear() {
    if (state !== "play") return;
    state = "clear";
    const s = STAGES[stageIndex];
    const leftover = ammo;
    score += leftover * 45;
    hudScore.textContent = String(score);
    const stars = leftover >= Math.max(1, s.ammo - 1) ? 3 : leftover >= 1 ? 2 : 1;
    clearStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    clearDetail.textContent = `미션 ${stageIndex + 1} 클리어 · 잔탄 ${leftover} · +${leftover * 45}`;
    clear.classList.remove("hidden");
    stageEl.classList.remove("playing");
  }

  function stageFail() {
    if (state !== "play") return;
    state = "over";
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      hudBest.textContent = String(best);
    }
    overDetail.textContent = `점수 ${score} · 헤드샷 ${headshots}`;
    over.classList.remove("hidden");
    stageEl.classList.remove("playing");
    window.TodayGameRank?.show?.(GAME_ID, score);
  }

  function nextStage() {
    if (stageIndex >= STAGES.length - 1) {
      state = "allclear";
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
        hudBest.textContent = String(best);
      }
      allDetail.textContent = `최종 ${score}점 · 헤드샷 ${headshots}`;
      clear.classList.add("hidden");
      allclear.classList.remove("hidden");
      window.TodayGameRank?.show?.(GAME_ID, score);
      return;
    }
    hideOverlays();
    stageEl.classList.add("playing");
    state = "play";
    loadStage(stageIndex + 1);
  }

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    return {
      x: (src.clientX - r.left) * (W / r.width),
      y: (src.clientY - r.top) * (H / r.height),
    };
  }

  function touchDist(e) {
    if (!e.touches || e.touches.length < 2) return 0;
    const a = e.touches[0];
    const b = e.touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function onDown(e) {
    if (state !== "play") return;
    if (e.target?.closest?.(".ctrl, .zbtn, .zoom-rail")) return;
    if (e.touches && e.touches.length === 2) {
      dragging = false;
      pinchDist0 = touchDist(e);
      pinchZoom0 = zoom;
      return;
    }
    dragging = true;
    lastPtr = canvasPos(e);
  }

  function onMove(e) {
    if (state !== "play") return;
    if (e.touches && e.touches.length === 2) {
      const d = touchDist(e);
      if (pinchDist0 > 0) setZoom(pinchZoom0 * (d / pinchDist0));
      return;
    }
    if (!dragging || !lastPtr) return;
    const p = canvasPos(e);
    const dx = p.x - lastPtr.x;
    const dy = p.y - lastPtr.y;
    lastPtr = p;
    const sens = (scoped ? 0.48 : 0.78) / viewZoom();
    aimX = clamp(aimX - dx * sens * 1.25, 16, W - 16);
    aimY = clamp(aimY - dy * sens * 1.25, 40, H - 100);
  }

  function onUp() {
    dragging = false;
    lastPtr = null;
    pinchDist0 = 0;
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      onDown(e);
    },
    { passive: false }
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (dragging || (e.touches && e.touches.length === 2)) e.preventDefault();
      onMove(e);
    },
    { passive: false }
  );
  window.addEventListener("touchend", onUp);

  document.getElementById("start-btn").onclick = startGame;
  document.getElementById("next-btn").onclick = nextStage;
  document.getElementById("retry-btn").onclick = startGame;
  document.getElementById("again-btn").onclick = startGame;
  document.getElementById("zoom-in").onclick = () => {
    if (!scoped) setScoped(true);
    setZoom(zoom + 0.4);
  };
  document.getElementById("zoom-out").onclick = () => {
    if (!scoped) setScoped(true);
    setZoom(zoom - 0.4);
  };
  scopeBtn.onclick = () => setScoped(!scoped);
  fireBtn.onclick = () => fire();

  steadyBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    steady = true;
    steadyBtn.classList.add("held");
  });
  const endSteady = () => {
    steady = false;
    steadyBtn.classList.remove("held");
  };
  steadyBtn.addEventListener("pointerup", endSteady);
  steadyBtn.addEventListener("pointerleave", endSteady);
  steadyBtn.addEventListener("pointercancel", endSteady);

  window.addEventListener("keydown", (e) => {
    if (state !== "play") return;
    if (e.code === "Space") {
      e.preventDefault();
      fire();
    }
    if (e.code === "KeyC") setScoped(!scoped);
    if (e.code === "KeyZ" || e.code === "Equal") setZoom(zoom + 0.4);
    if (e.code === "KeyX" || e.code === "Minus") setZoom(zoom - 0.4);
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      steady = true;
      steadyBtn.classList.add("held");
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") endSteady();
  });

  function update(dt) {
    time += dt;
    if (flash > 0) flash = Math.max(0, flash - dt * 4.2);
    if (shake > 0) shake = Math.max(0, shake - dt * 20);

    if (steady) {
      steadyT = Math.max(0, steadyT - dt * 0.32);
      if (steadyT <= 0) endSteady();
    } else {
      steadyT = Math.min(1, steadyT + dt * 0.3);
    }

    if (showZones > 0) showZones = Math.max(0, showZones - dt);

    for (const t of targets) {
      if (t.alive) {
        const h = targetH(t);
        if (t.move === "walk") {
          // Slow patrol: constant speed, long stop, face only after pause. No bob.
          t.hide = 0;
          if (t.pause > 0) {
            t.pause -= dt;
            t.accel = 0;
            t.y = t.footY - h * 0.5;
            if (t.pause <= 0) t.face = t.dir;
          } else {
            t.accel = Math.min(1, t.accel + dt / 0.55);
            const v = t.speed * t.accel;
            t.x += t.dir * v * dt;
            t.y = t.footY - h * 0.5;
            if (t.x >= t.x1) {
              t.x = t.x1;
              t.dir = -1;
              t.pause = 1.6 + Math.random() * 2.2;
              t.accel = 0;
            } else if (t.x <= t.x0) {
              t.x = t.x0;
              t.dir = 1;
              t.pause = 1.6 + Math.random() * 2.2;
              t.accel = 0;
            }
          }
        } else {
          // Hidden lookout: planted in cover. Almost still.
          t.leanT -= dt;
          if (t.leanT <= 0) {
            t.lean = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.8);
            t.leanT = 7 + Math.random() * 8;
          } else if (t.leanT < 5.5) {
            t.lean *= Math.max(0, 1 - dt * 1.2);
          }
          t.x = t.bx + t.lean;
          t.y = t.footY - h * 0.5;
          t.hide = t.cover || 0;
          t.face = t.baseFace;
        }
      }
      if (!t.alive) {
        t.fall = Math.min(1, t.fall + dt * 2.4);
        t.flash = Math.max(0, t.flash - dt * 2.8);
      }
    }

    for (const p of pops) p.life -= dt;
    pops = pops.filter((p) => p.life > 0);
    for (const m of marks) m.life -= dt;
    marks = marks.filter((m) => m.life > 0);
    for (const s of sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 220 * dt;
    }
    sparks = sparks.filter((s) => s.life > 0);
  }

  function drawNest(g) {
    const bg = img.bgs[bgIndex] || img.bgs[0];
    if (bg) {
      g.drawImage(bg, 0, 0, W, H);
      if (night > 0.2) {
        g.fillStyle = `rgba(180,110,40,${night * 0.16})`;
        g.fillRect(0, 0, W, H);
      }
    } else {
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#87b8e0");
      grd.addColorStop(0.45, "#d8c49a");
      grd.addColorStop(1, "#c4a574");
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    if (!scoped) {
      const haze = g.createLinearGradient(0, H * 0.1, 0, H * 0.65);
      haze.addColorStop(0, "rgba(255,236,200,0.06)");
      haze.addColorStop(1, "rgba(180,150,100,0.04)");
      g.fillStyle = haze;
      g.fillRect(0, 0, W, H * 0.7);
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  }

  function drawTarget(g, t) {
    const h = targetH(t);
    const w = targetW(t);
    const fall = t.fall || 0;
    const vis = Math.max(0.7, visibleTop(t));
    g.save();
    g.translate(t.x, t.y + fall * 40);
    g.rotate(fall * (t.face > 0 ? 1.05 : -1.05));
    g.scale(t.face, 1);

    // Only cast a ground shadow when mostly exposed (not behind a rail/sill)
    if (fall < 0.15 && vis > 0.72) {
      g.fillStyle = "rgba(0,0,0,0.32)";
      g.beginPath();
      g.ellipse(0, h * 0.49, w * 0.38, 5, 0, 0, Math.PI * 2);
      g.fill();
    }

    const dim = scoped ? 1 : 0.85 + Math.min(0.12, t.s * 0.25);
    g.globalAlpha = (1 - fall * 0.9) * dim;
    if (!scoped) {
      g.filter = "contrast(0.96) brightness(0.9) saturate(0.75)";
    } else {
      g.filter = night > 0.55
        ? "contrast(1.06) brightness(1.03) saturate(0.95)"
        : "contrast(1.04) brightness(1.05) saturate(1)";
    }

    if (vis < 0.999) {
      g.beginPath();
      g.rect(-w * 0.55, -h * 0.5, w * 1.1, h * vis);
      g.clip();
    }

    if (img.enemy) {
      g.drawImage(img.enemy, -w * 0.5, -h * 0.5, w, h);
    } else {
      g.fillStyle = "#2a3228";
      g.beginPath();
      g.ellipse(0, -h * 0.32, w * 0.22, h * 0.12, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-w * 0.2, -h * 0.22, w * 0.4, h * 0.45);
    }
    g.filter = "none";

    if (t.flash > 0) {
      g.globalAlpha = t.flash * 0.45;
      g.fillStyle = PART[t.hitPart || "body"].color;
      g.beginPath();
      g.ellipse(0, -h * 0.1, w * 0.42, h * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawMarks(g) {
    for (const m of marks) {
      g.globalAlpha = Math.max(0, m.life);
      g.fillStyle = "#111";
      g.beginPath();
      g.arc(m.x, m.y, 3.2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,210,160,0.55)";
      g.lineWidth = 1;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function drawSparks(g) {
    for (const s of sparks) {
      g.globalAlpha = Math.max(0, s.life * 1.4);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function drawPops(g) {
    for (const p of pops) {
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.color;
      g.font = "bold 17px Jua, sans-serif";
      g.textAlign = "center";
      g.fillText(p.text, p.x, p.y - (1 - p.life) * 34);
    }
    g.globalAlpha = 1;
  }

  function drawCrosshair(g, ax, ay) {
    if (scoped) {
      // center red dot only — mils drawn by scope asset
      g.fillStyle = "rgba(255,60,80,0.95)";
      g.beginPath();
      g.arc(ax, ay, 2.4, 0, Math.PI * 2);
      g.fill();
      return;
    }
    const r = 13;
    g.strokeStyle = "rgba(255,255,255,0.92)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(ax - r - 5, ay);
    g.lineTo(ax - 5, ay);
    g.moveTo(ax + 5, ay);
    g.lineTo(ax + r + 5, ay);
    g.moveTo(ax, ay - r - 5);
    g.lineTo(ax, ay - 5);
    g.moveTo(ax, ay + 5);
    g.lineTo(ax, ay + r + 5);
    g.stroke();
    g.strokeStyle = "rgba(255,80,100,0.85)";
    g.beginPath();
    g.arc(ax, ay, 7, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,70,90,0.95)";
    g.beginPath();
    g.arc(ax, ay, 2, 0, Math.PI * 2);
    g.fill();
  }

  function drawScopeOverlay(g) {
    if (!scoped) return;
    const cx = W * 0.5;
    const cy = H * 0.46;
    const rad = Math.min(W, H) * 0.4;

    g.save();
    g.fillStyle = "rgba(0,0,0,0.88)";
    g.beginPath();
    g.rect(0, 0, W, H);
    g.arc(cx, cy, rad, 0, Math.PI * 2, true);
    g.fill("evenodd");

    // glass tint
    g.beginPath();
    g.arc(cx, cy, rad - 2, 0, Math.PI * 2);
    g.fillStyle = "rgba(30, 70, 55, 0.1)";
    g.fill();

    if (img.scope) {
      const s = rad * 2.25;
      g.drawImage(img.scope, cx - s / 2, cy - s / 2, s, s);
    } else {
      g.strokeStyle = "#1a222c";
      g.lineWidth = 16;
      g.beginPath();
      g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "rgba(20,40,30,0.7)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(cx - rad + 12, cy);
      g.lineTo(cx + rad - 12, cy);
      g.moveTo(cx, cy - rad + 12);
      g.lineTo(cx, cy + rad - 12);
      g.stroke();
    }

    // breath bar under scope
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(cx - 42, cy + rad + 14, 84, 6);
    g.fillStyle = steady ? "#7dffb0" : "#71e0ff";
    g.fillRect(cx - 42, cy + rad + 14, 84 * steadyT, 6);
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.font = "11px Jua, sans-serif";
    g.textAlign = "center";
    g.fillText(steady ? "조준 안정" : "숨 참기", cx, cy + rad + 32);

    g.restore();
  }

  function drawRifle(g) {
    if (scoped) return;
    g.save();
    g.translate(W * 0.5 + Math.sin(time) * 2, H * 0.93);
    g.fillStyle = "rgba(10,14,20,0.9)";
    g.beginPath();
    g.moveTo(-80, 18);
    g.lineTo(-36, -14);
    g.lineTo(55, -8);
    g.lineTo(88, 10);
    g.lineTo(40, 30);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(90,110,130,0.55)";
    g.fillRect(-10, -36, 18, 28);
    g.fillStyle = "rgba(40,50,60,0.8)";
    g.fillRect(20, -4, 36, 10);
    g.restore();
  }

  function drawHudBits(g) {
    if (wind >= 0.05) {
      g.fillStyle = "rgba(255,255,255,0.6)";
      g.font = "12px Jua, sans-serif";
      g.textAlign = "left";
      const dir = Math.sin(time * 0.85) >= 0 ? "→" : "←";
      g.fillText(`바람 ${dir}`, 14, H * 0.775);
    }
    if (!assetsReady) {
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.font = "14px Jua, sans-serif";
      g.textAlign = "center";
      g.fillText("로딩…", W / 2, H / 2);
    }
  }

  function render() {
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    if (shake > 0) {
      g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    const a = aimWorld();
    const z = viewZoom();
    const cx = W * 0.5;
    const cy = H * 0.46;

    g.save();
    g.translate(cx, cy);
    g.scale(z, z);
    g.translate(-a.x, -a.y);

    drawNest(g);
    const ordered = [...targets].sort((a, b) => a.y - b.y);
    for (const t of ordered) drawTarget(g, t);
    drawMarks(g);
    drawSparks(g);
    drawPops(g);
    g.restore();

    // soft sun vignette — keep courtyard readable
    if (!scoped && state === "play") {
      const vg = g.createRadialGradient(cx, cy, 50, cx, cy, Math.max(W, H) * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(0.65, "rgba(40,30,15,0.04)");
      vg.addColorStop(1, "rgba(30,22,10,0.22)");
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
    }

    drawRifle(g);
    drawScopeOverlay(g);
    drawCrosshair(g, cx, cy);
    drawHudBits(g);

    if (flash > 0) {
      g.fillStyle = `rgba(255,236,200,${flash * 0.32})`;
      g.fillRect(0, 0, W, H);
    }

    g.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === "play") update(dt);
    else update(dt * 0.25);
    render();
    requestAnimationFrame(loop);
  }

  setZoom(HIP_ZOOM);
  waitAssets().then(() => requestAnimationFrame(loop));
  requestAnimationFrame(loop);

  window.TodayGamePause?.attach?.({
    isPlaying: () => state === "play",
    pause: () => {},
    resume: () => {},
  });

  window.__oneShotDebug = {
    aim(x, y) {
      aimX = x;
      aimY = y;
    },
    scope(v) {
      setScoped(!!v);
    },
    zoom(z) {
      setZoom(z);
    },
  };
})();
