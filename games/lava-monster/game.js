(() => {
  "use strict";

  const GAME_ID = "lava-monster";
  const W = 390;
  const H = 700;
  const STAGE_COUNT = 50;
  const BOSS_EVERY = 5;
  const FRAMES = 4;
  const GROUND = 562;
  const PATH_SURFACE = GROUND - 18;
  const PATH_DEPTH = GROUND - PATH_SURFACE + 14;
  const GRAVITY = 2200;
  const ASSET_V = 5;

  const HEROES = {
    chick: { id: "chick", name: "병아리", tag: "스피드형", hp: 95, speed: 238, jump: -710, w: 68, h: 68, fireCd: 0.13, sprite: "hero_chick" },
    bear: { id: "bear", name: "곰", tag: "탱커형", hp: 135, speed: 188, jump: -650, w: 78, h: 78, fireCd: 0.17, sprite: "hero_bear" },
    rabbit: { id: "rabbit", name: "토끼", tag: "점프형", hp: 100, speed: 222, jump: -745, w: 70, h: 70, fireCd: 0.14, sprite: "hero_rabbit" },
    squirrel: { id: "squirrel", name: "다람쥐", tag: "물총형", hp: 108, speed: 212, jump: -680, w: 66, h: 66, fireCd: 0.11, sprite: "hero_squirrel" },
  };

  function runJumpDistance(speed, jumpV) {
    return speed * ((2 * Math.abs(jumpV)) / GRAVITY);
  }

  const MIN_GAP = 50;
  const MAX_GAP = Math.floor(runJumpDistance(HEROES.bear.speed, HEROES.bear.jump) * 0.9);

  const ENEMY_TYPES = {
    soldier: { sprite: "enemy_soldier", w: 72, h: 72, hpMod: 0, speedMod: 1, score: 120 },
    imp: { sprite: "enemy_imp", w: 58, h: 58, hpMod: -1, speedMod: 1.45, score: 90 },
    brute: { sprite: "enemy_brute", w: 86, h: 86, hpMod: 2, speedMod: 0.72, score: 160 },
    blob: { sprite: "enemy_blob", w: 64, h: 64, hpMod: 0, speedMod: 1.1, score: 100 },
  };

  const BOSS_NAMES = [
    "용암 슬라임", "용암 골렘", "용암 사제", "용암 군주", "용암 거인",
    "용암 드래곤", "용암 수호자", "용암 폭군", "용암 마왕", "🔥 용암 왕",
  ];

  const ZONE_NAMES = [
    "용암 입구", "불꽃 길", "용암 협곡", "뜨거운 다리", "용암 분화구",
    "용암 신전", "마그마 숲", "불타는 협만", "용암 동굴", "용암 왕국",
    "재의 평원", "용암 성채", "불꽃 협곡", "용암 사막", "용암 심연",
    "용암 광산", "불벼락 지대", "용암 유적", "마그마 호수", "용암 요새",
    "용암 수로", "불꽃 전선", "용암 고개", "용암 지대", "용암 전선",
    "용암 심장", "불꽃 전초", "용암 결계", "마그마 문", "용암 왕좌",
    "재구름", "용암 회랑", "흑연 지대", "용암 심층", "최종 방어선",
    "용암 핵", "불꽃 결전", "용암 심연", "마그마 왕좌", "용암 종말",
    "최후의 다리", "용암 심장부", "불꽃 최전선", "용암 결전지", "왕의 길",
    "용암 최종구역", "마그마 왕국", "불꽃 최후", "용암 끝", "최종 결전",
  ];

  const STAGES = Array.from({ length: STAGE_COUNT }, (_, i) => makeStage(i));

  function makeStage(i) {
    const n = i + 1;
    const isBoss = n % BOSS_EVERY === 0;
    return {
      name: ZONE_NAMES[i] || `용암 지대 ${n}`,
      length: 0,
      bgIndex: i % 5,
      theme: i % 6,
      tint: i % 8,
      enemyHp: 2 + Math.floor(i * 0.2),
      bossHp: isBoss ? 140 + i * 32 : 0,
      isBoss,
      bossName: BOSS_NAMES[Math.floor(i / BOSS_EVERY) % BOSS_NAMES.length],
      hiddenItem: n % 2 === 0 || n % 3 === 0,
    };
  }

  const imgs = { bg: [] };
  const sheets = {};

  function loadImage(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  async function loadAssets() {
    const v = ASSET_V;
    const names = [
      ...Object.values(HEROES).map((h) => h.sprite),
      ...Object.values(ENEMY_TYPES).map((e) => e.sprite),
      "boss", "item_bomb", "item_heal", "item_shield",
    ];
    await Promise.all(
      names.map(async (n) => {
        sheets[n] = await loadImage(`assets/${n}.png?v=${v}`);
      })
    );
    for (let i = 0; i < 5; i++) imgs.bg[i] = await loadImage(`assets/bg${i + 1}.jpg?v=${v}`);
    Object.keys(HEROES).forEach((k) => {
      const prev = document.querySelector(`.hero-card[data-hero="${k}"] .hero-preview`);
      if (prev) prev.src = `assets/${HEROES[k].sprite}_preview.png?v=${v}`;
    });
  }

  function frameW(sheet) {
    return sheet ? sheet.width / FRAMES : 512;
  }

  function drawShadow(ctx, cx, cy, rw) {
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5, rw, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSheet(ctx, sheet, frame, cx, cy, w, h, flip) {
    drawShadow(ctx, cx, cy + h * 0.42, w * 0.38);
    if (!sheet) {
      ctx.fillStyle = "#cc4422";
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      return;
    }
    const fw = frameW(sheet);
    const fi = Math.floor(frame) % FRAMES;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
    if (flip) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, fi * fw, 0, fw, sheet.height, 0, 0, w, h);
    } else {
      ctx.drawImage(sheet, fi * fw, 0, fw, sheet.height, x, y, w, h);
    }
    ctx.restore();
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const hud = {
    stage: document.getElementById("hud-stage"),
    stageMax: document.getElementById("hud-stage-max"),
    score: document.getElementById("hud-score"),
    hp: document.getElementById("hud-hp"),
    shield: document.getElementById("hud-shield"),
    bomb: document.getElementById("hud-bomb"),
    heroName: document.getElementById("hud-hero"),
    zone: document.getElementById("hud-zone"),
  };
  const distFill = document.getElementById("dist-fill");
  const bossBar = document.getElementById("boss-bar");
  const bossNameEl = document.getElementById("boss-name");
  const bossHpText = document.getElementById("boss-hp-text");
  const bossFill = document.getElementById("boss-fill");
  const hint = document.getElementById("hint");
  const comboEl = document.getElementById("combo-tag");

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    allclear: document.getElementById("allclear"),
  };

  let state = "title";
  let selectedHero = "chick";
  let stageIdx = 0;
  let score = 0;
  let combo = 0;
  let comboTimer = 0;
  let animT = 0;
  let camX = 0;
  let minCamX = 0;
  let worldLen = 0;
  let goalX = 0;
  let goalPlatform = null;
  let platforms = [];
  let decorations = [];
  let hiddenSpots = [];
  let player = null;
  let enemies = [];
  let items = [];
  let bullets = [];
  let particles = [];
  let floatTexts = [];
  let boss = null;
  let bossGate = false;
  let screenShake = 0;
  let hitStop = 0;
  let lastSafeX = 90;
  let pitRespawnCd = 0;
  let pitFallT = 0;
  let triggers = [];
  let pitRegions = [];
  let ambientSteam = [];
  let bombBlasts = [];
  let bombFlash = 0;

  const keys = { left: false, right: false, jump: false, fire: false };

  function hideAllOverlays() {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
  }

  function showOverlay(name) {
    hideAllOverlays();
    overlays[name].classList.remove("hidden");
  }

  function meta() {
    return STAGES[stageIdx];
  }

  function heroMeta() {
    return HEROES[selectedHero];
  }

  function seeded(n, seed) {
    return ((n * 9301 + seed * 49297) % 233280) / 233280;
  }

  function groundY(h) {
    return PATH_SURFACE - h / 2;
  }

  function platformSurface(p) {
    return p.y;
  }

  function platformStyle(theme, seg) {
    const styles = [
      { top: "#7a5848", mid: "#4a3428", bot: "#1a100c", edge: "rgba(255,180,90,0.55)" },
      { top: "#6a5040", mid: "#3a2820", bot: "#141008", edge: "rgba(200,140,80,0.5)" },
      { top: "#5a4868", mid: "#342838", bot: "#120818", edge: "rgba(180,120,255,0.45)" },
      { top: "#486858", mid: "#283830", bot: "#081008", edge: "rgba(120,220,180,0.45)" },
      { top: "#685048", mid: "#382820", bot: "#100808", edge: "rgba(255,140,60,0.5)" },
      { top: "#585860", mid: "#303038", bot: "#101018", edge: "rgba(160,180,220,0.45)" },
    ];
    return styles[(theme + seg) % styles.length];
  }

  function pickEnemyType(seg) {
    const r = seeded(seg, stageIdx + 41);
    if (stageIdx < 3) return "blob";
    if (r < 0.28) return "imp";
    if (r < 0.52) return "soldier";
    if (r < 0.72) return "brute";
    return "blob";
  }

  function addDecoration(type, x, y, scale) {
    decorations.push({ type, x, y, scale: scale || 1, phase: seeded(x, stageIdx) * Math.PI * 2 });
  }

  function makeEnemy(x, typeKey, hpExtra, guard, platStart, platW) {
    const m = meta();
    const t = ENEMY_TYPES[typeKey] || ENEMY_TYPES.soldier;
    const hp = Math.max(1, m.enemyHp + t.hpMod + (hpExtra || 0));
    const ps = platStart ?? x - 80;
    const pw = platW ?? 160;
    const cx = Math.max(ps + 36, Math.min(ps + pw - 36, x));
    return {
      type: typeKey,
      x: cx,
      y: groundY(t.h),
      w: t.w,
      h: t.h,
      hp,
      maxHp: hp,
      speed: (34 + stageIdx * 3) * t.speedMod,
      dir: -1,
      frame: Math.random() * 4,
      patrolL: ps + 22,
      patrolR: ps + pw - 22,
      platStart: ps,
      platW: pw,
      guard: !!guard,
      hitFlash: 0,
    };
  }

  function spawnOnPlat(platStart, platW, ratio, typeKey, hpExtra) {
    const x = platStart + platW * ratio;
    enemies.push(makeEnemy(x, typeKey, hpExtra || 0, false, platStart, platW));
  }

  function addPlatform(x, w, kind, y) {
    const m = meta();
    platforms.push({
      x, y: y ?? PATH_SURFACE, w, h: PATH_DEPTH,
      style: platformStyle(m.theme, platforms.length),
      kind: kind || "stone",
    });
    return x + w;
  }

  function gapSize(seed) {
    return Math.round(MIN_GAP + seeded(seed, stageIdx + 9) * (MAX_GAP - MIN_GAP));
  }

  function spawnWaveAt(platStart, platW, types) {
    triggers.push({
      x: platStart + platW * 0.25,
      platStart,
      platW,
      fired: false,
      types,
    });
  }

  function dressPlatform(x, w, theme) {
    if (w < 140) return;
    addDecoration("torch", x + 24, PATH_SURFACE - 6, 0.9);
    if (w > 260) addDecoration("torch", x + w - 24, PATH_SURFACE - 6, 0.9);
    if (w > 360 && seeded(x, stageIdx + 3) > 0.4) {
      addDecoration("pillar", x + w * 0.5, PATH_SURFACE - 8, 0.85 + seeded(x, 7) * 0.2);
    }
    if (seeded(x, stageIdx + 11) > 0.55) {
      addDecoration(
        ["crystal", "banner", "skull"][Math.floor(seeded(x, theme) * 3)],
        x + w * (0.25 + seeded(x, 13) * 0.5),
        PATH_SURFACE - 14 - seeded(x, 17) * 40,
        0.75 + seeded(x, 19) * 0.35
      );
    }
  }

  function buildChunk(type, x, seed) {
    const m = meta();
    switch (type) {
      case "start":
        x = addPlatform(x, 280, "stone");
        dressPlatform(x - 280, 280, seed);
        return x;
      case "stretch": {
        const w = 460 + Math.floor(seeded(seed, 2) * 180);
        const ps = x;
        x = addPlatform(x, w, seeded(seed, 4) > 0.55 ? "bridge" : "stone");
        dressPlatform(ps, w, seed);
        spawnOnPlat(ps, w, 0.35, pickEnemyType(seed), 0);
        if (seeded(seed, 8) > 0.35) spawnOnPlat(ps, w, 0.62, pickEnemyType(seed + 1), 1);
        return x;
      }
      case "jump": {
        x += gapSize(seed);
        const w = 260 + Math.floor(seeded(seed, 3) * 100);
        const ps = x;
        x = addPlatform(x, w, seed % 2 ? "bridge" : "stone");
        dressPlatform(ps, w, seed);
        spawnOnPlat(ps, w, 0.4, pickEnemyType(seed), 0);
        return x;
      }
      case "fight": {
        const w = 380 + Math.floor(seeded(seed, 2) * 140);
        const ps = x;
        x = addPlatform(x, w, "stone");
        dressPlatform(ps, w, seed);
        const n = 2 + Math.floor(seeded(seed, 5) * 2) + Math.floor(stageIdx / 12);
        for (let i = 0; i < n; i++) {
          spawnOnPlat(ps, w, 0.28 + i * 0.18, pickEnemyType(seed + i), i ? 1 : 0);
        }
        if (seeded(seed, 11) > 0.62) {
          items.push({
            type: "heal", x: x - w * 0.58, y: groundY(36), w: 36, h: 36, got: false, hidden: false,
          });
        }
        return x;
      }
      case "bridge": {
        x += gapSize(seed);
        const ps = x;
        x = addPlatform(x, 118, "bridge");
        addDecoration("torch", ps + 59, PATH_SURFACE - 6, 0.8);
        spawnOnPlat(ps, 118, 0.5, seeded(seed, 8) > 0.5 ? "imp" : "blob", 0);
        return x;
      }
      case "doublejump": {
        x += gapSize(seed);
        const ps1 = x;
        x = addPlatform(x, 180, "stone");
        dressPlatform(ps1, 180, seed);
        spawnOnPlat(ps1, 180, 0.45, pickEnemyType(seed), 0);
        x += gapSize(seed + 1);
        const ps2 = x;
        x = addPlatform(x, 200, "bridge");
        spawnOnPlat(ps2, 200, 0.5, pickEnemyType(seed + 2), 0);
        return x;
      }
      case "highloot": {
        const ps = x;
        x = addPlatform(x, 260, "stone");
        dressPlatform(ps, 260, seed);
        spawnOnPlat(ps, 260, 0.38, "soldier", 0);
        x += gapSize(seed + 2);
        const hx = x + 58;
        platforms.push({
          x: hx - 58, y: PATH_SURFACE - 62, w: 116, h: 22,
          style: platformStyle(m.theme, 7), kind: "hidden",
        });
        addDecoration("crystal", hx, PATH_SURFACE - 68, 1.1);
        items.push({
          type: seeded(seed, 9) > 0.5 ? "bomb" : "shield",
          x: hx, y: groundY(36) - 62, w: 38, h: 38, got: false, hidden: false,
        });
        return addPlatform(x, 220, "stone");
      }
      case "wave": {
        const w = 400;
        const ps = x;
        x = addPlatform(x, w, "stone");
        dressPlatform(ps, w, seed);
        spawnWaveAt(ps, w, ["imp", "blob", "soldier"].slice(0, 2 + (stageIdx % 2)));
        return x;
      }
      case "bossPrep":
        x = addPlatform(x, 520, "goal");
        addDecoration("pillar", x - 260, PATH_SURFACE - 8, 1.15);
        addDecoration("pillar", x - 120, PATH_SURFACE - 8, 1.15);
        addDecoration("torch", x - 40, PATH_SURFACE - 6, 1);
        return x;
      case "goal":
        return addPlatform(x, 320, "goal");
      default:
        return addPlatform(x, 280, "stone");
    }
  }

  function computePitRegions() {
    pitRegions = [];
    const walk = platforms.filter((p) => p.kind !== "hidden").sort((a, b) => a.x - b.x);
    for (let i = 0; i < walk.length - 1; i++) {
      const start = walk[i].x + walk[i].w;
      const end = walk[i + 1].x;
      if (end - start > 24) pitRegions.push({ x: start, w: end - start });
    }
  }

  function rebuildAmbientSteam() {
    ambientSteam = pitRegions.flatMap((pit, i) =>
      Array.from({ length: 4 }, (_, k) => ({
        x: pit.x + pit.w * (0.15 + k * 0.22),
        y: PATH_SURFACE + 18 + seeded(k, i + stageIdx) * 20,
        phase: seeded(k, i + 99) * Math.PI * 2,
        r: 3 + seeded(k, i + 7) * 5,
      }))
    );
  }

  function buildLevel() {
    const m = meta();
    platforms = [];
    decorations = [];
    hiddenSpots = [];
    enemies = [];
    items = [];
    triggers = [];
    boss = null;
    bossGate = false;
    bossBar.classList.add("hidden");

    const targetLen = (m.isBoss ? 7200 : 6200) + stageIdx * 120;
    const filler = m.isBoss
      ? ["stretch", "fight", "jump", "fight", "bridge", "stretch", "fight", "wave"]
      : ["stretch", "jump", "fight", "bridge", "fight", "highloot", "doublejump", "stretch", "fight", "wave"];
    const minChunks = 7 + (stageIdx % 4);
    let x = buildChunk("start", 0, stageIdx);
    let pi = 0;
    while (pi < minChunks || (x < targetLen - 380 && pi < 22)) {
      x = buildChunk(filler[(stageIdx + pi) % filler.length], x, stageIdx * 19 + pi * 37);
      pi++;
    }

    if (m.hiddenItem && !m.isBoss) {
      const hx = Math.max(700, x * 0.44);
      platforms.push({
        x: hx - 62, y: PATH_SURFACE - 66, w: 124, h: 22,
        style: platformStyle(m.theme, 7), kind: "hidden",
      });
      addDecoration("crystal", hx, PATH_SURFACE - 72, 1.05);
      items.push({
        type: seeded(stageIdx, 63) > 0.5 ? "bomb" : "shield",
        x: hx, y: groundY(36) - 66, w: 40, h: 40, got: false, hidden: true,
      });
    }

    x = m.isBoss
      ? buildChunk("bossPrep", x, stageIdx + 200)
      : buildChunk("goal", x, stageIdx + 200);

    if (m.isBoss) {
      const ps = x - 520;
      enemies.push(makeEnemy(ps + 300, "brute", 2, true, ps, 520));
    } else {
      spawnOnPlat(0, 280, 0.55, "blob", 0);
      spawnOnPlat(0, 280, 0.78, "imp", 0);
    }

    for (let i = 0; i < 10 + (stageIdx % 5); i++) {
      addDecoration(
        ["pillar", "crystal", "torch", "banner", "skull"][Math.floor(seeded(i, stageIdx + 90) * 5)],
        220 + i * (x / (11 + (stageIdx % 5))),
        PATH_SURFACE - 12 - seeded(i, 12) * 48,
        0.82 + seeded(i, 44) * 0.4
      );
    }

    worldLen = x + 40;
    goalPlatform = platforms.find((p) => p.kind === "goal") || null;
    if (goalPlatform) {
      goalX = goalPlatform.x + goalPlatform.w - 85;
      worldLen = goalPlatform.x + goalPlatform.w + 30;
    } else {
      goalX = x - 60;
    }
    m.length = worldLen;
    computePitRegions();
    rebuildAmbientSteam();
  }

  function updateStageHint() {
    const m = meta();
    if (hud.zone) hud.zone.textContent = m.name;
    hint.textContent = m.isBoss ? `${m.bossName} · 보스 돌파` : `${m.name} · → 오른쪽으로 전진!`;
  }

  function resetPlayer(full) {
    const h = heroMeta();
    const maxHp = h.hp;
    if (full || !player) {
      player = {
        x: 90, y: groundY(h.h), w: h.w, h: h.h,
        vx: 0, vy: 0,
        hp: maxHp, maxHp,
        shield: 0, bombs: 2,
        facing: 1, onGround: true, frame: 0,
        fireCd: 0, iframe: 0, anim: "idle",
        jumpV: h.jump, speed: h.speed, fireRate: h.fireCd,
      };
    } else {
      player.hp = Math.min(maxHp, player.hp);
      player.maxHp = maxHp;
      player.w = h.w;
      player.h = h.h;
      player.jumpV = h.jump;
      player.speed = h.speed;
      player.fireRate = h.fireCd;
      player.x = 90;
      player.vx = 0;
      player.vy = 0;
      player.facing = 1;
      player.y = groundY(h.h);
      player.onGround = true;
    }
    camX = 0;
    minCamX = 0;
    lastSafeX = 90;
    pitRespawnCd = 0;
    pitFallT = 0;
  }

  function resetStage() {
    bullets = [];
    particles = [];
    floatTexts = [];
    bombBlasts = [];
    bombFlash = 0;
    combo = 0;
    bossGate = false;
    buildLevel();
    resetPlayer(false);
    updateStageHint();
    updateHud();
  }

  function updateHud() {
    if (!player) return;
    hud.stage.textContent = String(stageIdx + 1);
    if (hud.stageMax) hud.stageMax.textContent = String(STAGE_COUNT);
    hud.score.textContent = String(score);
    hud.hp.textContent = String(Math.max(0, Math.ceil(player.hp)));
    hud.shield.textContent = String(player.shield);
    if (hud.bomb) hud.bomb.textContent = String(player.bombs);
    if (hud.heroName) hud.heroName.textContent = heroMeta().name;
    if (hud.zone) hud.zone.textContent = meta().name;
    distFill.style.width = `${Math.min(100, (player.x / Math.max(goalX, 1)) * 100)}%`;
    if (boss) {
      bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
      bossHpText.textContent = `${Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100))}%`;
    }
    if (comboEl) {
      comboEl.hidden = combo < 3;
      comboEl.textContent = combo >= 3 ? `COMBO x${combo}` : "";
    }
  }

  function overlap(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h / 2 < b.y + b.h / 2 &&
      a.y + a.h / 2 > b.y - b.h / 2
    );
  }

  function feetSpan(ent) {
    return { l: ent.x - ent.w * 0.22, r: ent.x + ent.w * 0.22 };
  }

  function platformUnder(ent, footY) {
    const feet = feetSpan(ent);
    let best = null;
    for (const p of platforms) {
      const surface = platformSurface(p);
      if (footY > surface + 6) continue;
      if (feet.r <= p.x + 8 || feet.l >= p.x + p.w - 8) continue;
      if (!best || surface < platformSurface(best)) best = p;
    }
    return best;
  }

  function onPlatform(ent) {
    const foot = ent.y + ent.h / 2;
    if (ent.vy !== undefined && ent.vy < -30) return null;
    const support = platformUnder(ent, foot);
    if (!support) return null;
    const surface = platformSurface(support);
    if (foot >= surface - 8 && foot <= surface + 8) return support;
    return null;
  }

  function overPit() {
    if (!player) return false;
    const foot = player.y + player.h / 2;
    if (foot < PATH_SURFACE - 6) return false;
    return !platformUnder(player, foot);
  }

  function findRespawnPlatform(x) {
    let best = null;
    let bestDist = Infinity;
    for (const p of platforms) {
      if (p.kind === "hidden") continue;
      const cx = Math.max(p.x + 36, Math.min(x, p.x + p.w - 36));
      const dist = Math.abs(cx - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    return best || platforms[0];
  }

  function respawnFromPit() {
    if (!player || pitRespawnCd > 0 || state !== "play") return;
    pitRespawnCd = 1.2;
    combo = 0;

    const plat = findRespawnPlatform(lastSafeX);
    const h = player.h;
    player.x = Math.max(plat.x + 40, Math.min(lastSafeX, plat.x + plat.w - 40));
    player.y = platformSurface(plat) - h / 2;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.facing = 1;
    lastSafeX = player.x;

    player.hp -= 28;
    player.iframe = 1.4;
    screenShake = 0.4;
    addParticle(player.x, player.y, "#ff5500", 22);
    floatText(player.x, player.y - 28, "구멍!", "#ff9977");
    hint.textContent = "구멍에 빠졌어요! HP -28 · 다시 건너뛰세요";

    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
    }
    updateHud();
  }

  function addParticle(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.5) * 220,
        life: 0.35 + Math.random() * 0.4,
        color, r: 2 + Math.random() * 4,
      });
    }
  }

  function floatText(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 0.9, vy: -55 });
  }

  function hurtPlayer(dmg) {
    if (!player || player.iframe > 0) return;
    combo = 0;
    if (player.shield > 0) {
      player.shield--;
      player.iframe = 0.85;
      addParticle(player.x, player.y, "#9ef", 12);
      updateHud();
      return;
    }
    player.hp -= dmg;
    player.iframe = 1.0;
    screenShake = 0.25;
    addParticle(player.x, player.y, "#ff5500", 14);
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
    }
    updateHud();
  }

  function onEnemyKill(e) {
    const t = ENEMY_TYPES[e.type] || ENEMY_TYPES.soldier;
    combo++;
    comboTimer = 2.5;
    const bonus = Math.min(combo, 10) * 8;
    score += t.score + stageIdx * 12 + bonus;
    hitStop = 0.04;
    addParticle(e.x, e.y, "#ff6600", 14);
    floatText(e.x, e.y - 20, `+${t.score + bonus}`, "#ffd166");
  }

  function gameOver() {
    state = "over";
    document.getElementById("over-detail").textContent =
      `STAGE ${stageIdx + 1} · ${meta().name} · ${heroMeta().name} · 점수 ${score}`;
    showOverlay("over");
    if (window.submitGameScore) window.submitGameScore(GAME_ID, score);
  }

  function stageClear() {
    state = "clear";
    score += 500 + stageIdx * 70;
    const m = meta();
    document.getElementById("clear-title").textContent = m.isBoss ? "보스 격파!" : `${m.name} 클리어!`;
    document.getElementById("clear-detail").textContent =
      `STAGE ${stageIdx + 1}/${STAGE_COUNT} · ${heroMeta().name} · 점수 ${score}`;
    showOverlay("clear");
    if (window.submitGameScore) window.submitGameScore(GAME_ID, score);
  }

  function allClear() {
    state = "allclear";
    document.getElementById("all-detail").textContent =
      `최종 점수 ${score} · ${heroMeta().name} · 50스테이지 완주!`;
    showOverlay("allclear");
    if (window.submitGameScore) window.submitGameScore(GAME_ID, score);
  }

  function bossArena() {
    if (goalPlatform) return { x: goalPlatform.x, w: goalPlatform.w };
    return { x: worldLen - 540, w: 520 };
  }

  function spawnBoss() {
    const m = meta();
    const arena = bossArena();
    const h = 124;
    boss = {
      x: arena.x + arena.w * 0.68, y: groundY(h), w: 124, h,
      hp: m.bossHp, maxHp: m.bossHp,
      facing: -1, frame: 0, fireCd: 1.1,
      minX: arena.x + 70, maxX: arena.x + arena.w - 50,
    };
    minCamX = Math.max(0, arena.x - 40);
    bossNameEl.textContent = m.bossName;
    bossBar.classList.remove("hidden");
    hint.textContent = "← 후퇴하며 물총·물폭탄(B)! 보스를 피해서 공격!";
    screenShake = 0.45;
  }

  function tryStageClear() {
    const m = meta();
    if (!goalPlatform || !player) return;

    const reachLine = goalPlatform.x + goalPlatform.w * 0.38;
    if (player.x < reachLine) return;

    if (m.isBoss) return;

    const blocking = enemies.filter((e) => e.hp > 0 && e.x >= goalPlatform.x - 280);
    if (blocking.length > 0) return;

    if (stageIdx >= STAGE_COUNT - 1) allClear();
    else stageClear();
  }

  function killBoss() {
    score += 900 + stageIdx * 100;
    combo += 5;
    addParticle(boss.x, boss.y, "#ffaa00", 35);
    floatText(boss.x, boss.y - 30, "BOSS!", "#ff8844");
    boss = null;
    bossBar.classList.add("hidden");
    if (stageIdx >= STAGE_COUNT - 1) setTimeout(allClear, 800);
    else setTimeout(stageClear, 800);
  }

  function fireWater() {
    if (!player || player.fireCd > 0) return;
    player.fireCd = player.fireRate;
    bullets.push({
      x: player.x + player.facing * 32,
      y: player.y - 6,
      w: 28, h: 12,
      vx: player.facing * 520,
      dmg: 1 + Math.floor(stageIdx / 5),
      trail: 0,
    });
    addParticle(player.x + player.facing * 26, player.y - 4, "#7ee8ff", 5);
  }

  function useWaterBomb() {
    if (!player || player.bombs <= 0 || state !== "play") return;
    player.bombs--;
    screenShake = 0.75;
    hitStop = 0.1;
    bombFlash = 0.28;
    bombBlasts.push({ x: player.x, y: player.y - 8, life: 0.65, maxR: 360, ring: 0 });

    let hits = 0;
    enemies.forEach((e) => {
      if (Math.hypot(e.x - player.x, e.y - player.y) < 360) {
        e.hp = 0;
        onEnemyKill(e);
        hits++;
      }
    });
    enemies = enemies.filter((e) => e.hp > 0);

    if (boss && Math.hypot(boss.x - player.x, boss.y - player.y) < 400) {
      boss.hp -= boss.maxHp * 0.22;
      addParticle(boss.x, boss.y, "#9ef", 35);
      hits++;
      if (boss.hp <= 0) killBoss();
    }

    for (let i = 0; i < 70; i++) {
      const ang = (i / 70) * Math.PI * 2;
      particles.push({
        x: player.x, y: player.y - 8,
        vx: Math.cos(ang) * (180 + Math.random() * 220),
        vy: Math.sin(ang) * (180 + Math.random() * 220),
        life: 0.45 + Math.random() * 0.35,
        color: i % 3 ? "#7ee8ff" : "#ffffff",
        r: 3 + Math.random() * 5,
      });
    }

    floatText(player.x, player.y - 52, hits > 0 ? `💣 ${hits}체 격파!` : "💣 펑!", hits > 0 ? "#ffd166" : "#7ee8ff");
    const btn = document.getElementById("bomb-btn");
    if (btn) {
      btn.classList.add("bomb-used");
      setTimeout(() => btn.classList.remove("bomb-used"), 350);
    }
    updateHud();
  }

  function startGame() {
    stageIdx = 0;
    score = 0;
    hideAllOverlays();
    state = "play";
    resetPlayer(true);
    buildLevel();
    updateStageHint();
    updateHud();
  }

  function nextStage() {
    stageIdx++;
    hideAllOverlays();
    state = "play";
    resetStage();
    player.hp = Math.min(player.maxHp, player.hp + 12);
    if ((stageIdx + 1) % 5 === 0) player.bombs = Math.min(5, player.bombs + 1);
    updateStageHint();
    updateHud();
  }

  function update(dt) {
    if (state !== "play" || !player) return;
    if (hitStop > 0) {
      hitStop -= dt;
      draw();
      return;
    }
    animT += dt;
    if (comboTimer > 0) comboTimer -= dt;
    else if (combo > 0) combo = Math.max(0, combo - 1);

    const speed = player.speed;
    const bossFight = !!boss;
    if (keys.right) {
      player.vx = speed;
      player.facing = 1;
      player.anim = "walk";
    } else if (keys.left) {
      player.vx = -speed * (bossFight ? 1 : 0.55);
      player.facing = -1;
      player.anim = "walk";
    } else {
      player.vx *= 0.72;
      if (bossFight && boss) player.facing = player.x < boss.x ? 1 : -1;
      else player.facing = 1;
      player.anim = Math.abs(player.vx) > 18 ? "walk" : "idle";
    }

    if (keys.jump && player.onGround) {
      player.vy = player.jumpV;
      player.onGround = false;
    }
    if (keys.fire) fireWater();

    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    const wantCam = Math.max(0, Math.min(worldLen - W, player.x - W * 0.36));
    if (bossFight) {
      const arena = bossArena();
      const camMin = Math.max(0, arena.x - 40);
      const camMax = Math.max(camMin, Math.min(worldLen - W, arena.x + arena.w - W + 40));
      camX = Math.max(camMin, Math.min(camMax, wantCam));
    } else {
      camX = Math.max(minCamX, wantCam);
      minCamX = camX;
    }

    if (bossFight) {
      const arena = bossArena();
      player.x = Math.max(arena.x + 24, Math.min(arena.x + arena.w - 30, player.x));
    } else {
      const backLimit = Math.max(30, camX - 50);
      player.x = Math.max(backLimit, Math.min(worldLen - 30, player.x));
    }

    const plat = onPlatform(player);
    if (plat) {
      player.y = platformSurface(plat) - player.h / 2;
      player.vy = 0;
      player.onGround = true;
      if (plat.kind !== "hidden") lastSafeX = player.x;
    } else {
      player.onGround = false;
    }

    if (pitRespawnCd > 0) pitRespawnCd -= dt;

    if (overPit()) {
      player.onGround = false;
      pitFallT += dt;
      player.vy = Math.min(player.vy + GRAVITY * dt * 0.55, 520);
      const foot = player.y + player.h / 2;
      if (pitFallT > 0.28 || foot > PATH_SURFACE + 16 || player.y > H - 50) {
        respawnFromPit();
        pitFallT = 0;
      }
    } else {
      pitFallT = 0;
    }

    if (player.anim === "walk" && player.onGround) player.frame += dt * 10;
    else if (!player.onGround) player.frame += dt * 6;
    if (player.fireCd > 0) player.fireCd -= dt;
    if (player.iframe > 0) player.iframe -= dt;

    triggers.forEach((tr) => {
      if (tr.fired || player.x < tr.x) return;
      tr.fired = true;
      tr.types.forEach((type, i) => {
        let sx = tr.platStart + tr.platW * (0.38 + i * 0.22);
        if (sx < player.x + 90) {
          sx = Math.min(tr.platStart + tr.platW - 36, player.x + 120 + i * 75);
        }
        enemies.push(makeEnemy(sx, type, 1, false, tr.platStart, tr.platW));
        addParticle(sx, PATH_SURFACE - 28, "#ff5500", 10);
      });
      screenShake = 0.28;
    });

    if (meta().isBoss && !boss && !bossGate && goalPlatform && player.x >= goalPlatform.x + 50) {
      const near = enemies.filter((e) => e.hp > 0 && e.x >= goalPlatform.x - 320);
      if (near.length === 0) {
        bossGate = true;
        spawnBoss();
      }
    }

    bullets = bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += (b.vy || 0) * dt;
      if (!b.enemy && b.trail !== undefined) {
        b.trail += dt;
        if (b.trail > 0.04) {
          b.trail = 0;
          particles.push({
            x: b.x, y: b.y, vx: 0, vy: 0,
            life: 0.18, color: "rgba(120,230,255,0.7)", r: 3,
          });
        }
      }
      if (b.enemy && overlap(b, player)) {
        hurtPlayer(8 + Math.floor(stageIdx / 5));
        return false;
      }
      if (b.x < camX - 60 || b.x > camX + W + 60 || b.y < -40 || b.y > H + 40) return false;
      for (const e of enemies) {
        if (e.hp > 0 && overlap(b, e)) {
          e.hp -= b.dmg;
          e.hitFlash = 0.14;
          addParticle(b.x, b.y, "#4cc9f0", 5);
          if (e.hp <= 0) onEnemyKill(e);
          return false;
        }
      }
      if (boss && overlap(b, boss)) {
        boss.hp -= b.dmg;
        addParticle(b.x, b.y, "#9ef", 6);
        if (boss.hp <= 0) killBoss();
        return false;
      }
      return true;
    });
    enemies = enemies.filter((e) => e.hp > 0);

    enemies.forEach((e) => {
      e.frame += dt * 8;
      e.y = groundY(e.h);
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (!e.guard) {
        e.x += e.speed * e.dir * dt;
        if (e.x < e.patrolL) { e.x = e.patrolL; e.dir = 1; }
        if (e.x > e.patrolR) { e.x = e.patrolR; e.dir = -1; }
      }
      const dx = player.x - e.x;
      if (Math.abs(dx) < 190 && Math.abs(player.y - e.y) < 95) {
        e.dir = dx >= 0 ? 1 : -1;
        if (!e.guard && dx > 0) e.x += (38 + stageIdx * 4) * dt;
      }
      if (overlap(e, player)) hurtPlayer(9 + Math.floor(stageIdx / 4));
    });

    if (boss) {
      boss.frame += dt * 3.2;
      const dx = player.x - boss.x;
      boss.facing = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) > 55) boss.x += boss.facing * (36 + stageIdx * 2.5) * dt;
      boss.x = Math.max(boss.minX, Math.min(boss.maxX, boss.x));
      boss.fireCd -= dt;
      if (boss.fireCd <= 0) {
        boss.fireCd = Math.max(0.65, 1.45 - stageIdx * 0.018);
        const dist = Math.hypot(dx, player.y - boss.y) || 1;
        const spd = 175 + stageIdx * 7;
        bullets.push({
          x: boss.x + boss.facing * 42, y: boss.y - 10,
          w: 18, h: 18,
          vx: (dx / dist) * spd, vy: ((player.y - boss.y) / dist) * spd,
          enemy: true,
        });
      }
      if (overlap(boss, player)) hurtPlayer(14 + Math.floor(stageIdx / 3));
    }

    items.forEach((it) => {
      if (it.got) return;
      if (it.hidden && Math.abs(player.x - it.x) > 90) return;
      if (overlap(it, player)) {
        it.got = true;
        if (it.type === "heal") {
          player.hp = Math.min(player.maxHp, player.hp + 22);
          floatText(it.x, it.y, "+HP", "#ff8899");
        } else if (it.type === "shield") {
          player.shield = Math.min(3, player.shield + 1);
          floatText(it.x, it.y, "방패!", "#9ef");
        } else if (it.type === "bomb") {
          player.bombs = Math.min(5, player.bombs + 1);
          floatText(it.x, it.y, "물폭탄!", "#7ee8ff");
        }
        score += 50;
        addParticle(it.x, it.y, "#ffd166", 10);
        updateHud();
      }
    });

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    particles = particles.filter((p) => p.life > 0);

    floatTexts.forEach((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
    });
    floatTexts = floatTexts.filter((f) => f.life > 0);

    bombBlasts.forEach((b) => {
      b.life -= dt;
      b.ring = b.maxR * (1 - b.life / 0.65);
    });
    bombBlasts = bombBlasts.filter((b) => b.life > 0);
    if (bombFlash > 0) bombFlash -= dt;

    tryStageClear();
    if (screenShake > 0) screenShake -= dt;
    updateHud();
  }

  const TINTS = [
    "rgba(255,80,20,0.12)", "rgba(120,40,200,0.1)", "rgba(40,160,255,0.08)",
    "rgba(255,180,40,0.1)", "rgba(80,200,120,0.08)", "rgba(200,60,120,0.09)",
    "rgba(255,120,60,0.11)", "rgba(60,100,220,0.1)",
  ];

  function drawBg() {
    const m = meta();
    const bg = imgs.bg[m.bgIndex];
    const far = camX * 0.12;
    const mid = camX * (0.22 + (m.theme % 3) * 0.03);
    const parallax = camX * (0.34 + (m.theme % 3) * 0.04);

    ctx.fillStyle = "#120804";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 180 - far) % (W + 220)) - 80;
      const bh = 90 + (i % 3) * 28;
      ctx.fillStyle = `rgba(${40 + m.theme * 8},${18 + m.tint * 2},${12},0.85)`;
      ctx.beginPath();
      ctx.moveTo(bx, GROUND - 40);
      ctx.lineTo(bx + 70, GROUND - 40 - bh);
      ctx.lineTo(bx + 150, GROUND - 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (bg) {
      const bh = H;
      const bw = (bg.width / bg.height) * bh;
      const off = parallax % bw;
      ctx.globalAlpha = 0.92;
      for (let x = -off - bw; x < W + bw; x += bw) ctx.drawImage(bg, x, 0, bw, bh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = TINTS[m.tint] || TINTS[0];
      ctx.fillRect(0, 0, W, H);
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, "rgba(0,0,0,0.08)");
      shade.addColorStop(0.5, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(40,0,0,0.38)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = 0.18;
      const emberOff = mid % 120;
      for (let i = 0; i < 12; i++) {
        const ex = ((i * 95 - emberOff) % (W + 80)) - 20;
        const ey = 80 + (i % 4) * 45 + Math.sin(animT * 2 + i) * 8;
        ctx.fillStyle = "#ff8844";
        ctx.beginPath();
        ctx.arc(ex, ey, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = "#2a1008";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawPlatform(p) {
    const st = p.style;
    const top = p.y;
    const grad = ctx.createLinearGradient(p.x, top, p.x, top + p.h + 24);
    grad.addColorStop(0, st.top);
    grad.addColorStop(0.38, st.mid);
    grad.addColorStop(1, st.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(p.x, top, p.w, p.h);
    ctx.fillStyle = st.edge;
    ctx.fillRect(p.x, top - 3, p.w, 5);
    ctx.fillStyle = "rgba(255,240,210,0.12)";
    ctx.fillRect(p.x + 10, top - 2, p.w - 20, 2);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(p.x, top, 10, p.h);
    ctx.fillRect(p.x + p.w - 10, top, 10, p.h);
    if (p.kind === "bridge") {
      ctx.strokeStyle = "rgba(60,35,20,0.6)";
      ctx.lineWidth = 3;
      for (let bx = p.x + 16; bx < p.x + p.w - 8; bx += 36) {
        ctx.beginPath();
        ctx.moveTo(bx, top);
        ctx.lineTo(bx, top + p.h);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(p.x, top + p.h - 4, p.w, 4);
    }
    if (p.kind === "goal") {
      const flagX = p.x + p.w - 85;
      ctx.fillStyle = "#ffd166";
      ctx.shadowColor = "rgba(255,200,80,0.6)";
      ctx.shadowBlur = 12;
      ctx.fillRect(flagX - 4, top - 96, 8, 96);
      ctx.shadowBlur = 0;
      ctx.font = "28px serif";
      ctx.textAlign = "center";
      ctx.fillText("🏁", flagX, top - 104);
    }
    if (p.kind === "hidden") {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(animT * 3.5) * 0.12;
      ctx.strokeStyle = "rgba(140,220,255,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 4, top - 2, p.w - 8, p.h + 4);
      ctx.restore();
    }
  }

  function drawDecoration(d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    const s = d.scale;
    if (d.type === "pillar") {
      ctx.fillStyle = "#4a3830";
      ctx.fillRect(-12 * s, -82 * s, 24 * s, 82 * s);
      ctx.fillStyle = "#6a5040";
      ctx.fillRect(-16 * s, -90 * s, 32 * s, 12 * s);
    } else if (d.type === "crystal") {
      ctx.fillStyle = `rgba(120,220,255,${0.55 + Math.sin(animT * 3 + d.phase) * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(0, -42 * s);
      ctx.lineTo(18 * s, 0);
      ctx.lineTo(0, 52 * s);
      ctx.lineTo(-18 * s, 0);
      ctx.closePath();
      ctx.fill();
    } else if (d.type === "banner") {
      ctx.fillStyle = "#8a3020";
      ctx.fillRect(-3, -72 * s, 6, 72 * s);
      ctx.fillStyle = `rgba(255,${100 + stageIdx * 2},40,0.78)`;
      ctx.fillRect(-3, -70 * s, 30 * s, 38 * s);
    } else if (d.type === "skull") {
      ctx.font = `${Math.floor(28 * s)}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("💀", 0, 0);
    } else if (d.type === "torch") {
      ctx.fillStyle = "#5a4030";
      ctx.fillRect(-4, -42 * s, 8, 42 * s);
      ctx.fillStyle = `rgba(255,${160 + Math.sin(animT * 8 + d.phase) * 40},40,0.92)`;
      ctx.beginPath();
      ctx.ellipse(0, -46 * s, 10 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWorld() {
    ctx.save();
    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * 9 * screenShake, (Math.random() - 0.5) * 9 * screenShake);
    }
    ctx.translate(-camX, 0);

    decorations.forEach(drawDecoration);

    const lavaGrad = ctx.createLinearGradient(0, PATH_SURFACE + 6, 0, H);
    lavaGrad.addColorStop(0, "rgba(255,120,30,0.92)");
    lavaGrad.addColorStop(1, "rgba(120,20,0,0.96)");
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, PATH_SURFACE + 6, worldLen, H - PATH_SURFACE);

    pitRegions.forEach((pit) => {
      const cx = pit.x + pit.w / 2;
      const glow = ctx.createRadialGradient(cx, PATH_SURFACE + 22, 6, cx, PATH_SURFACE + 30, Math.max(40, pit.w * 0.55));
      glow.addColorStop(0, "rgba(255,150,50,0.55)");
      glow.addColorStop(0.55, "rgba(255,80,20,0.22)");
      glow.addColorStop(1, "rgba(255,40,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(pit.x, PATH_SURFACE + 4, pit.w, 90);
      ctx.globalAlpha = 0.45 + Math.sin(animT * 4 + pit.x * 0.01) * 0.12;
      ctx.fillStyle = "#ffcc44";
      for (let i = 0; i < 3; i++) {
        const lx = pit.x + pit.w * (0.2 + i * 0.28) + Math.sin(animT * 3 + i + pit.x) * 6;
        ctx.beginPath();
        ctx.ellipse(lx, PATH_SURFACE + 30, Math.min(28, pit.w * 0.22), 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ambientSteam.forEach((s) => {
      const bob = Math.sin(animT * 4 + s.phase) * 8;
      ctx.globalAlpha = 0.22 + Math.sin(animT * 2 + s.phase) * 0.1;
      ctx.fillStyle = "rgba(255,180,120,0.85)";
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    platforms.forEach(drawPlatform);

    items.forEach((it) => {
      if (it.got) return;
      if (it.hidden && Math.abs(it.x - player.x) > 120) return;
      drawShadow(ctx, it.x, it.y + 14, 14);
      if (it.type === "shield") {
        const img = sheets.item_shield;
        if (img) ctx.drawImage(img, it.x - 20, it.y - 20, 40, 40);
        else { ctx.font = "30px serif"; ctx.textAlign = "center"; ctx.fillText("🛡️", it.x, it.y + 10); }
      } else if (it.type === "heal") {
        const img = sheets.item_heal;
        if (img) ctx.drawImage(img, it.x - 20, it.y - 20, 40, 40);
        else { ctx.font = "30px serif"; ctx.textAlign = "center"; ctx.fillText("❤️", it.x, it.y + 10); }
      } else if (it.type === "bomb") {
        const img = sheets.item_bomb;
        if (img) ctx.drawImage(img, it.x - 22, it.y - 22, 44, 44);
      }
      if (it.hidden) {
        ctx.strokeStyle = "rgba(255,220,120,0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(it.x - 24, it.y - 24, 48, 48);
      }
    });

    enemies.forEach((e) => {
      const sp = sheets[ENEMY_TYPES[e.type]?.sprite || "enemy_soldier"];
      if (e.x < camX - 100 || e.x > camX + W + 100) return;
      if (e.hitFlash > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35 + e.hitFlash * 2;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.w * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      drawSheet(ctx, sp, e.frame, e.x, e.y, e.w, e.h, e.dir < 0);
    });

    if (boss) drawSheet(ctx, sheets.boss, boss.frame, boss.x, boss.y, boss.w, boss.h, boss.facing < 0);

    bullets.forEach((b) => {
      if (b.enemy) {
        ctx.shadowColor = "#ffaa00";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#ff5500";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowColor = "#7ee8ff";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#eefcff";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    if (player) {
      const blink = player.iframe <= 0 || Math.floor(animT * 14) % 2 === 0;
      if (blink) {
        drawSheet(ctx, sheets[heroMeta().sprite], player.frame, player.x, player.y, player.w, player.h, player.facing < 0);
      }
      if (player.shield > 0) {
        ctx.strokeStyle = `rgba(120,220,255,${0.42 + Math.sin(animT * 6) * 0.15})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.w * 0.64, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    bombBlasts.forEach((b) => {
      const a = Math.min(1, b.life * 2.2);
      ctx.save();
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = "#e8fcff";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.ring, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.22;
      ctx.fillStyle = "#4cc9f0";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.ring * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    floatTexts.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.font = "bold 16px Jua,sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });

    particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw() {
    drawBg();
    drawWorld();
    if (bombFlash > 0) {
      ctx.fillStyle = `rgba(160,230,255,${bombFlash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    if (hitStop <= 0) draw();
    else draw();
    requestAnimationFrame(loop);
  }

  function bindHold(btn, key) {
    if (!btn) return;
    const down = (e) => { e.preventDefault(); keys[key] = true; };
    const up = () => { keys[key] = false; };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }

  document.querySelectorAll(".hero-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".hero-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      selectedHero = card.dataset.hero;
    });
  });

  bindHold(document.getElementById("left-btn"), "left");
  bindHold(document.getElementById("right-btn"), "right");
  bindHold(document.getElementById("jump-btn"), "jump");
  bindHold(document.getElementById("fire-btn"), "fire");

  document.getElementById("bomb-btn").addEventListener("click", useWaterBomb);
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d") keys.right = true;
    if (e.key === "ArrowUp" || e.key === "w") keys.jump = true;
    if (e.key === " " || e.code === "Space") { e.preventDefault(); keys.fire = true; }
    if (e.key === "b" || e.key === "B") useWaterBomb();
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d") keys.right = false;
    if (e.key === "ArrowUp" || e.key === "w") keys.jump = false;
    if (e.key === " " || e.code === "Space") keys.fire = false;
  });

  loadAssets().then(() => {
    showOverlay("title");
    requestAnimationFrame(loop);
  });
})();
