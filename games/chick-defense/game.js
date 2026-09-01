(() => {
  "use strict";

  const GAME_ID = "chick-defense";
  const W = 390;
  const H = 700;
  const MAX_LEVEL = 8;
  const STAGE_COUNT = 100;
  const STAGES_PER_MAP = Math.ceil(STAGE_COUNT / 4);

  function adConfig() {
    const items =
      (window.TodayAdBoards && TodayAdBoards.getItems && TodayAdBoards.getItems()) ||
      (window.TODAY_AD_BOARDS && window.TODAY_AD_BOARDS.items) ||
      [{ text: "오늘의 게임", textColor: "#e23d4a" }];
    return {
      items,
      texts: items.map((a) => a.text || "오늘의 게임"),
      ink: (items[0] && items[0].textColor) || "#e23d4a",
    };
  }

  // Expanded Winding Map Paths & Placement Pads (All Pads y <= 550, fully clear of bottom shop bar)
  const MAPS = {
    forest: {
      id: "forest",
      name: "햇살 숲 (S-코스)",
      bg: "bg-forest",
      path: [
        { x: 195, y: 80 }, { x: 260, y: 105 }, { x: 310, y: 130 }, { x: 260, y: 155 },
        { x: 175, y: 175 }, { x: 90, y: 195 }, { x: 70, y: 230 }, { x: 120, y: 260 },
        { x: 210, y: 280 }, { x: 300, y: 295 }, { x: 325, y: 330 }, { x: 270, y: 360 },
        { x: 180, y: 380 }, { x: 95, y: 400 }, { x: 65, y: 435 }, { x: 120, y: 465 },
        { x: 220, y: 490 }, { x: 300, y: 515 }, { x: 260, y: 550 }, { x: 195, y: 575 },
        { x: 195, y: 618 },
      ],
      pads: [
        { x: 100, y: 110 }, { x: 330, y: 95 }, { x: 55, y: 155 }, { x: 325, y: 185 },
        { x: 190, y: 215 }, { x: 55, y: 275 }, { x: 320, y: 250 }, { x: 190, y: 320 },
        { x: 325, y: 385 }, { x: 55, y: 345 }, { x: 180, y: 420 }, { x: 55, y: 470 },
        { x: 320, y: 460 }, { x: 170, y: 525 }, { x: 310, y: 545 }, { x: 75, y: 535 },
        { x: 110, y: 555 }, { x: 280, y: 560 },
      ],
      billboards: [
        { x: 18, y: 200, w: 100, h: 68, textIndex: 0 },
      ],
    },
    dusk: {
      id: "dusk",
      name: "황혼 대곡향",
      bg: "bg-dusk",
      path: [
        { x: 195, y: 78 }, { x: 120, y: 98 }, { x: 65, y: 128 }, { x: 95, y: 165 },
        { x: 180, y: 185 }, { x: 290, y: 205 }, { x: 330, y: 240 }, { x: 280, y: 275 },
        { x: 180, y: 298 }, { x: 85, y: 320 }, { x: 60, y: 360 }, { x: 115, y: 395 },
        { x: 210, y: 418 }, { x: 310, y: 440 }, { x: 325, y: 480 }, { x: 260, y: 510 },
        { x: 170, y: 535 }, { x: 130, y: 565 }, { x: 195, y: 618 },
      ],
      pads: [
        { x: 300, y: 95 }, { x: 55, y: 100 }, { x: 310, y: 155 }, { x: 50, y: 205 },
        { x: 315, y: 220 }, { x: 60, y: 265 }, { x: 310, y: 315 }, { x: 50, y: 345 },
        { x: 315, y: 385 }, { x: 60, y: 430 }, { x: 310, y: 470 }, { x: 55, y: 495 },
        { x: 305, y: 530 }, { x: 70, y: 545 }, { x: 240, y: 555 }, { x: 110, y: 560 },
      ],
      billboards: [
        { x: 268, y: 220, w: 100, h: 68, textIndex: 0 },
      ],
    },
    night: {
      id: "night",
      name: "달빛 은하림",
      bg: "bg-night",
      path: [
        { x: 195, y: 75 }, { x: 270, y: 95 }, { x: 325, y: 125 }, { x: 280, y: 155 },
        { x: 190, y: 175 }, { x: 100, y: 195 }, { x: 60, y: 230 }, { x: 115, y: 260 },
        { x: 210, y: 280 }, { x: 305, y: 300 }, { x: 330, y: 340 }, { x: 270, y: 370 },
        { x: 175, y: 390 }, { x: 90, y: 410 }, { x: 60, y: 445 }, { x: 115, y: 475 },
        { x: 210, y: 498 }, { x: 305, y: 520 }, { x: 250, y: 550 }, { x: 195, y: 618 },
      ],
      pads: [
        { x: 55, y: 95 }, { x: 330, y: 90 }, { x: 55, y: 150 }, { x: 325, y: 180 },
        { x: 190, y: 220 }, { x: 55, y: 280 }, { x: 315, y: 250 }, { x: 180, y: 325 },
        { x: 315, y: 385 }, { x: 55, y: 350 }, { x: 180, y: 430 }, { x: 55, y: 480 },
        { x: 310, y: 465 }, { x: 170, y: 535 }, { x: 310, y: 545 }, { x: 75, y: 530 },
        { x: 110, y: 550 }, { x: 270, y: 555 },
      ],
      billboards: [
        { x: 14, y: 250, w: 96, h: 66, textIndex: 0 },
      ],
    },
    meadow: {
      id: "meadow",
      name: "안개 수호 초원",
      bg: "bg-meadow",
      path: [
        { x: 195, y: 72 }, { x: 130, y: 92 }, { x: 65, y: 120 }, { x: 95, y: 155 },
        { x: 180, y: 175 }, { x: 290, y: 195 }, { x: 330, y: 230 }, { x: 280, y: 265 },
        { x: 180, y: 288 }, { x: 85, y: 310 }, { x: 55, y: 348 }, { x: 110, y: 382 },
        { x: 210, y: 405 }, { x: 310, y: 428 }, { x: 330, y: 468 }, { x: 270, y: 500 },
        { x: 175, y: 525 }, { x: 135, y: 555 }, { x: 195, y: 618 },
      ],
      pads: [
        { x: 310, y: 90 }, { x: 55, y: 100 }, { x: 310, y: 145 }, { x: 45, y: 190 },
        { x: 310, y: 225 }, { x: 55, y: 255 }, { x: 310, y: 295 }, { x: 45, y: 335 },
        { x: 310, y: 375 }, { x: 55, y: 405 }, { x: 310, y: 445 }, { x: 45, y: 475 },
        { x: 310, y: 510 }, { x: 55, y: 535 }, { x: 280, y: 545 }, { x: 110, y: 550 },
      ],
      billboards: [
        { x: 275, y: 240, w: 100, h: 68, textIndex: 0 },
      ],
    },
  };

  const MAP_ORDER = ["forest", "dusk", "night", "meadow"];

  let PATH = [];
  let PADS = [];
  let BILLBOARDS = [];
  let activeMap = MAPS.forest;

  const TOWERS = {
    peep: {
      name: "삐약이", shortName: "삐약", unlock: 1, cost: 30, range: 92, rate: 0.55, dmg: 8,
      color: "#ffe27a", accent: "#f0a020", tint: null,
    },
    thrower: {
      name: "투척병아리", shortName: "투척", unlock: 1, cost: 55, range: 108, rate: 1.0, dmg: 13,
      splash: 44, color: "#ffb070", accent: "#e07030", tint: "#ff9a50",
    },
    frost: {
      name: "얼음병아리", shortName: "얼음", unlock: 5, cost: 70, range: 100, rate: 0.82, dmg: 5,
      slow: 0.48, slowT: 1.5, color: "#a8e8ff", accent: "#4ab0e0", tint: "#7ad0ff",
    },
    sniper: {
      name: "저격병아리", shortName: "저격", unlock: 12, cost: 95, range: 165, rate: 1.35, dmg: 32,
      color: "#c8f0a0", accent: "#6a9a30", tint: "#9ae06a",
    },
    mortar: {
      name: "박격병아리", shortName: "박격", unlock: 22, cost: 120, range: 125, rate: 1.7, dmg: 36,
      splash: 62, color: "#d8c0a0", accent: "#8a6840", tint: "#b89870",
    },
    thunder: {
      name: "번개병아리", shortName: "번개", unlock: 35, cost: 150, range: 118, rate: 1.1, dmg: 18,
      chain: 2, color: "#e8d0ff", accent: "#9060e0", tint: "#c090ff",
    },
  };

  const TOWER_ORDER = ["peep", "thrower", "frost", "sniper", "mortar", "thunder"];

  const ENEMY_KINDS = {
    fox: { name: "여우", hp: 28, speed: 52, reward: 9, score: 12, r: 18, img: "fox" },
    raccoon: { name: "너구리", hp: 55, speed: 38, reward: 15, score: 20, r: 19, img: "raccoon" },
    wolf: { name: "늑대", hp: 36, speed: 78, reward: 13, score: 18, r: 18, img: "wolf" },
    bear: { name: "거대 곰", hp: 250, speed: 28, reward: 45, score: 90, r: 28, img: "bear", boss: true },
  };

  const STAGE_NAMES = Array.from({ length: STAGE_COUNT }, (_, i) => `WAVE ${i + 1} 수호전`);

  const STAGES = Array.from({ length: STAGE_COUNT }, (_, i) => {
    const t = i / (STAGE_COUNT - 1);
    const waves = [];
    const n = 10 + Math.floor(i * 0.95);
    const gap = Math.max(0.16, 0.65 - i * 0.005);
    for (let k = 0; k < n; k++) {
      let kind = "fox";
      const roll = ((i * 17 + k * 31) % 100) / 100;
      if (i >= 1 && roll < 0.3 + t * 0.3) kind = "raccoon";
      if (i >= 2 && ((i * 13 + k * 19) % 100) / 100 < 0.25 + t * 0.35) kind = "wolf";
      waves.push({ kind, t: 0.4 + k * gap });
    }
    if ((i + 1) % 5 === 0) waves.push({ kind: "bear", t: waves[waves.length - 1].t + 0.8 });
    return {
      name: STAGE_NAMES[i] || `WAVE ${i + 1}`,
      gold: 90 + Math.floor(i * 4.8),
      nestHp: i < 15 ? 12 : i < 40 ? 15 : 18,
      hpScale: 1 + i * 0.11,
      speedScale: 1 + i * 0.028,
      spawn: waves,
    };
  });

  const imgs = {
    "bg-forest": null, "bg-dusk": null, "bg-night": null, "bg-meadow": null,
    fox: null, raccoon: null, wolf: null, bear: null, nest: null, billboard: null,
    "tower-peep": null, "tower-thrower": null, "tower-frost": null,
    "tower-sniper": null, "tower-mortar": null, "tower-thunder": null,
    "tower-peep-max": null, "tower-thrower-max": null, "tower-frost-max": null,
    "tower-sniper-max": null, "tower-mortar-max": null, "tower-thunder-max": null,
  };

  const JPG_KEYS = new Set(["bg-forest", "bg-dusk", "bg-night", "bg-meadow"]);

  function punchKey(img) {
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
      const magenta = r > 185 && b > 175 && g < 145 && r + b > g * 2.1;
      const hotPink = r > 200 && b > 150 && g < 90;
      if (magenta || hotPink) d[i + 3] = 0;
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function loadAssets() {
    const spriteKeys = Object.keys(imgs).filter((k) => !JPG_KEYS.has(k));
    return Promise.all(
      Object.keys(imgs).map(
        (key) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              imgs[key] = spriteKeys.includes(key) ? punchKey(im) || im : im;
              res();
            };
            im.onerror = () => res();
            im.src = JPG_KEYS.has(key) ? `assets/${key}.jpg` : `assets/${key}.png`;
          })
      )
    );
  }

  function towerSprite(type, level) {
    const elite = level >= 5;
    const key = elite ? `tower-${type}-max` : `tower-${type}`;
    return imgs[key] || imgs[`tower-${type}`] || imgs["tower-peep"];
  }

  function mapIndexForStage(si) {
    return Math.floor(si / STAGES_PER_MAP) % MAP_ORDER.length;
  }

  function applyMap(mapKey) {
    const map = MAPS[mapKey] || MAPS.forest;
    activeMap = map;
    PATH = map.path.slice();
    PADS = map.pads.slice();
    BILLBOARDS = map.billboards.slice();
    buildPathMeta();
  }

  function isTowerUnlocked(type) {
    return stageIndex + 1 >= (TOWERS[type]?.unlock || 999);
  }

  function rebuildShop() {
    if (!shop) return;
    shop.innerHTML = "";
    for (const id of TOWER_ORDER) {
      const def = TOWERS[id];
      const unlocked = isTowerUnlocked(id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tower-btn ${id}`;
      btn.setAttribute("data-tower", id);
      if (unlocked) {
        btn.innerHTML =
          `<img class="ico-img" src="assets/tower-${id}.png" alt="" />` +
          `<span class="name">${def.shortName}</span>` +
          `<span class="cost">${def.cost}</span>`;
        btn.addEventListener("click", () => {
          selected = id;
          selectedTower = null;
          updateHud();
        });
      } else {
        btn.classList.add("locked");
        btn.disabled = true;
        btn.innerHTML =
          `<span class="lock">🔒</span>` +
          `<span class="name">${def.shortName}</span>` +
          `<span class="unlock">${def.unlock}단계</span>`;
      }
      shop.appendChild(btn);
    }
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

  const hudStage = document.getElementById("hud-stage");
  const hudScore = document.getElementById("hud-score");
  const hudHp = document.getElementById("hud-hp");
  const hudGold = document.getElementById("hud-gold");
  const waveFill = document.getElementById("wave-fill");
  const waveLabel = document.getElementById("wave-label");
  const hint = document.getElementById("hint");
  const shop = document.getElementById("shop");
  const upPanel = document.getElementById("upgrade-panel");
  const upName = document.getElementById("up-name");
  const upLevel = document.getElementById("up-level");
  const upStats = document.getElementById("up-stats");
  const upCost = document.getElementById("up-cost");
  const upgradeBtn = document.getElementById("upgrade-btn");
  const sellBtn = document.getElementById("sell-btn");
  const sellRefund = document.getElementById("sell-refund");

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  let state = "title";
  let stageIndex = 0;
  let currentMapIndex = -1;
  let score = 0;
  let gold = 0;
  let nestHp = 10;
  let nestMax = 10;
  let selected = "peep";
  let selectedTower = null;
  let towers = [];
  let enemies = [];
  let shots = [];
  let particles = [];
  let floats = [];
  let spawnQueue = [];
  let spawnAcc = 0;
  let totalToSpawn = 0;
  let killed = 0;
  let leaked = 0;
  let pathLen = 0;
  let pathCum = [];
  let last = 0;
  let raf = 0;
  let hintTimer = 5;
  let shake = 0;
  let time = 0;
  let nestPulse = 0;

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function towerStats(type, level) {
    const base = TOWERS[type];
    const lv = Math.max(1, Math.min(MAX_LEVEL, level || 1));
    const mul = 1 + (lv - 1) * 0.32;
    const rateMul = Math.max(0.48, 1 - (lv - 1) * 0.07);
    return {
      ...base,
      level: lv,
      dmg: Math.round(base.dmg * mul),
      range: Math.round(base.range * (1 + (lv - 1) * 0.1)),
      rate: base.rate * rateMul,
      splash: base.splash ? Math.round(base.splash * (1 + (lv - 1) * 0.08)) : 0,
      slow: base.slow ? Math.max(0.28, base.slow - (lv - 1) * 0.04) : undefined,
      slowT: base.slowT ? base.slowT + (lv - 1) * 0.2 : undefined,
      chain: base.chain ? base.chain + Math.floor((lv - 1) / 2) : undefined,
    };
  }

  function upgradeCost(t) {
    if (t.level >= MAX_LEVEL) return 0;
    const base = TOWERS[t.type].cost;
    return Math.round(base * 0.65 * Math.pow(1.48, t.level - 1));
  }

  function buildPathMeta() {
    pathCum = [0];
    pathLen = 0;
    for (let i = 1; i < PATH.length; i++) {
      pathLen += Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y);
      pathCum.push(pathLen);
    }
  }

  function posOnPath(dist) {
    const d = Math.max(0, Math.min(pathLen, dist));
    for (let i = 1; i < PATH.length; i++) {
      if (d <= pathCum[i]) {
        const seg = pathCum[i] - pathCum[i - 1];
        const t = seg < 0.001 ? 0 : (d - pathCum[i - 1]) / seg;
        return {
          x: PATH[i - 1].x + (PATH[i].x - PATH[i - 1].x) * t,
          y: PATH[i - 1].y + (PATH[i].y - PATH[i - 1].y) * t,
          ang: Math.atan2(PATH[i].y - PATH[i - 1].y, PATH[i].x - PATH[i - 1].x),
        };
      }
    }
    const p = PATH[PATH.length - 1];
    return { x: p.x, y: p.y, ang: 0 };
  }

  function refreshUpgradePanel() {
    if (!selectedTower || state !== "play") {
      upPanel.classList.add("hidden");
      return;
    }
    const st = towerStats(selectedTower.type, selectedTower.level);
    upPanel.classList.remove("hidden");
    upName.textContent = st.name;
    upLevel.textContent = `Lv.${st.level}${st.level >= MAX_LEVEL ? " MAX" : ""}`;
    let stats = `공격 ${st.dmg} · 사거리 ${st.range}`;
    if (st.splash) stats += ` · 범위 ${st.splash}`;
    if (st.slow) stats += ` · 슬로우`;
    if (st.chain) stats += ` · 연쇄 ${st.chain}`;
    upStats.textContent = stats;

    const cost = upgradeCost(selectedTower);
    const invested = selectedTower.invested || TOWERS[selectedTower.type].cost;
    const refund = Math.floor(invested * 0.75);

    if (sellRefund) sellRefund.textContent = String(refund);

    if (st.level >= MAX_LEVEL) {
      upgradeBtn.disabled = true;
      upgradeBtn.classList.add("max");
      upCost.textContent = "MAX";
      upgradeBtn.firstChild.textContent = "최대 강화 ";
    } else {
      upgradeBtn.disabled = gold < cost;
      upgradeBtn.classList.remove("max");
      upgradeBtn.firstChild.textContent = "강화 ";
      upCost.textContent = String(cost);
    }
  }

  function tryUpgrade() {
    if (!selectedTower || state !== "play") return;
    const cost = upgradeCost(selectedTower);
    if (selectedTower.level >= MAX_LEVEL || gold < cost) return;

    gold -= cost;
    selectedTower.level += 1;
    selectedTower.invested = (selectedTower.invested || TOWERS[selectedTower.type].cost) + cost;

    const st = towerStats(selectedTower.type, selectedTower.level);
    burst(selectedTower.x, selectedTower.y, st.color, 16);
    addFloat(selectedTower.x, selectedTower.y - 20, `Lv.${selectedTower.level} 강화!`, "#ffe27a");
    updateHud();
  }

  function trySell() {
    if (!selectedTower || state !== "play") return;
    const t = selectedTower;
    const invested = t.invested || TOWERS[t.type].cost;
    const refund = Math.floor(invested * 0.75);

    gold += refund;
    burst(t.x, t.y, "#ff7a7a", 16);
    addFloat(t.x, t.y - 20, `+${refund} 🪙 판매!`, "#ffe27a");

    towers = towers.filter((it) => it !== t);
    selectedTower = null;
    upPanel.classList.add("hidden");
    updateHud();
  }

  function updateHud() {
    hudStage.textContent = `${stageIndex + 1}/${STAGE_COUNT}`;
    hudScore.textContent = String(score);
    hudHp.textContent = String(Math.max(0, nestHp));
    hudGold.textContent = String(gold);
    const done = killed + leaked;
    waveFill.style.width = `${totalToSpawn ? Math.min(100, (done / totalToSpawn) * 100) : 0}%`;
    waveLabel.textContent = `${activeMap.name} · WAVE ${stageIndex + 1} · ${STAGES[stageIndex].name}`;
    document.querySelectorAll(".tower-btn").forEach((btn) => {
      const id = btn.getAttribute("data-tower");
      if (!id || !TOWERS[id]) return;
      const unlocked = isTowerUnlocked(id);
      btn.classList.toggle("selected", unlocked && selected === id && !selectedTower);
      btn.classList.toggle("disabled", unlocked && gold < TOWERS[id].cost && state === "play");
      const costEl = btn.querySelector(".cost");
      if (costEl) costEl.textContent = String(TOWERS[id].cost);
    });
    refreshUpgradePanel();
  }

  function resetStage() {
    const st = STAGES[stageIndex];
    const newMapIndex = mapIndexForStage(stageIndex);
    const mapChanged = currentMapIndex >= 0 && newMapIndex !== currentMapIndex;

    if (mapChanged) {
      let refund = 0;
      for (const t of towers) refund += Math.floor((t.invested || TOWERS[t.type].cost) * 0.75);
      gold += refund;
      towers = [];
      selectedTower = null;
      applyMap(MAP_ORDER[newMapIndex]);
      hintTimer = 4;
      hint.classList.remove("fade", "hidden");
      hint.textContent = refund > 0
        ? `${activeMap.name} · 타워 75% 환급 +${refund}`
        : `${activeMap.name} · 새 맵!`;
    } else if (stageIndex === 0) {
      towers = [];
      gold = st.gold;
      applyMap(MAP_ORDER[newMapIndex]);
    } else {
      gold += Math.floor(st.gold * 0.45);
      applyMap(MAP_ORDER[newMapIndex]);
    }

    currentMapIndex = newMapIndex;
    rebuildShop();

    nestMax = st.nestHp;
    if (stageIndex === 0) nestHp = nestMax;
    else nestHp = Math.min(nestMax, nestHp + 2);
    enemies = [];
    shots = [];
    particles = [];
    floats = [];
    spawnQueue = st.spawn.map((s) => ({ ...s }));
    spawnAcc = 0;
    totalToSpawn = spawnQueue.length;
    killed = 0;
    leaked = 0;
    if (!mapChanged) {
      selectedTower = null;
      hintTimer = stageIndex === 0 ? 5.5 : 2;
      hint.classList.remove("fade", "hidden");
      hint.textContent = "빈 자리 클릭 배치 · 병아리 클릭 시 강화/판매!";
    }
    shop.classList.remove("hidden");
    updateHud();
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1, vy: -42 });
  }

  function burst(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(35, 130);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.28, 0.6), r: rand(2, 4.5), color,
      });
    }
  }

  function stageClear() {
    const bonus = nestHp * 12 + Math.floor(gold * 0.15) + towers.reduce((s, t) => s + t.level * 6, 0);
    score += bonus;
    state = "clear";
    selectedTower = null;
    document.getElementById("clear-detail").textContent =
      `${STAGES[stageIndex].name} · 클리어 보너스 +${bonus}`;
    overlays.clear.classList.remove("hidden");
    shop.classList.add("hidden");
    hint.classList.add("hidden");
    upPanel.classList.add("hidden");
    updateHud();
  }

  function gameOver() {
    state = "over";
    selectedTower = null;
    document.getElementById("over-detail").textContent = `웨이브 ${stageIndex + 1} · 점수 ${score}`;
    overlays.over.classList.remove("hidden");
    shop.classList.add("hidden");
    hint.classList.add("hidden");
    upPanel.classList.add("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "둥지 디펜스", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function allClear() {
    state = "all";
    document.getElementById("all-detail").textContent = `100웨이브 완파! 최종 점수 ${score}`;
    overlays.all.classList.remove("hidden");
    shop.classList.add("hidden");
    upPanel.classList.add("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "둥지 디펜스", formParent: overlays.all });
      TodayGameRank.open(score);
    }
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    overlays.title.classList.add("hidden");
    overlays.clear.classList.add("hidden");
    overlays.over.classList.add("hidden");
    overlays.all.classList.add("hidden");
    stageIndex = 0;
    currentMapIndex = -1;
    score = 0;
    towers = [];
    selectedTower = null;
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function nextStage() {
    overlays.clear.classList.add("hidden");
    stageIndex += 1;
    if (stageIndex >= STAGES.length) {
      allClear();
      return;
    }
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function spawnEnemy(kindId) {
    const st = STAGES[stageIndex];
    const def = ENEMY_KINDS[kindId] || ENEMY_KINDS.fox;
    const hp = Math.round(def.hp * st.hpScale);
    const speed = def.speed * st.speedScale;
    enemies.push({
      id: Math.random(),
      kind: kindId,
      def,
      hp,
      maxHp: hp,
      speed,
      reward: def.reward,
      score: def.score,
      dist: 0,
      r: def.r,
      slow: 1,
      slowT: 0,
      bob: rand(0, Math.PI * 2),
    });
  }

  function hurtEnemy(e, dmg, color) {
    e.hp -= dmg;
    burst(posOnPath(e.dist).x, posOnPath(e.dist).y, color || "#ff6b6b", 6);
    if (e.hp <= 0) {
      killEnemy(e);
    }
  }

  function killEnemy(e) {
    score += e.score;
    gold += e.reward;
    killed += 1;
    const p = posOnPath(e.dist);
    burst(p.x, p.y, "#ffe27a", 14);
    addFloat(p.x, p.y, `+${e.reward}`, "#ffe27a");
    enemies = enemies.filter((it) => it !== e);
    updateHud();
    if (killed + leaked >= totalToSpawn && enemies.length === 0 && nestHp > 0) {
      stageClear();
    }
  }

  function applyThunderHit(target, st, level) {
    hurtEnemy(target, st.dmg, "#c090ff");
    const p1 = posOnPath(target.dist);
    let prev = p1;
    let chainCount = st.chain || 2;
    const hitSet = new Set([target]);

    while (chainCount > 0) {
      let nearest = null;
      let minD = 90;
      for (const e of enemies) {
        if (hitSet.has(e)) continue;
        const ep = posOnPath(e.dist);
        const d = Math.hypot(ep.x - prev.x, ep.y - prev.y);
        if (d < minD) {
          minD = d;
          nearest = e;
        }
      }
      if (!nearest) break;
      hitSet.add(nearest);
      const np = posOnPath(nearest.dist);
      particles.push({
        kind: "lightning",
        x: prev.x, y: prev.y, tx: np.x, ty: np.y,
        life: 0.15, color: "#c090ff",
      });
      hurtEnemy(nearest, Math.round(st.dmg * 0.7), "#c090ff");
      prev = np;
      chainCount -= 1;
    }
  }

  function nearestEnemy(x, y, range) {
    let best = null;
    let maxDist = -1;
    for (const e of enemies) {
      const p = posOnPath(e.dist);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= range && e.dist > maxDist) {
        maxDist = e.dist;
        best = e;
      }
    }
    return best;
  }

  function nearestEnemyAny(x, y) {
    let best = null;
    let minD = 9999;
    for (const e of enemies) {
      const p = posOnPath(e.dist);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minD) {
        minD = d;
        best = e;
      }
    }
    return best;
  }

  function fireMuzzle(t, ang, color) {
    const sx = t.x + Math.cos(ang) * 12;
    const sy = t.y - 10 + Math.sin(ang) * 12;
    burst(sx, sy, color, 4);
  }

  function shotFlight(type, level) {
    if (type === "sniper") return { speed: 850, arc: 0 };
    if (type === "mortar" || type === "thrower") return { speed: 380, arc: 0.35 };
    if (type === "frost") return { speed: 480, arc: 0 };
    return { speed: 520, arc: 0 };
  }

  function tryBuildOrSelect(x, y) {
    // 1. Check existing tower tap
    for (const t of towers) {
      if (Math.hypot(t.x - x, t.y - y) <= 24) {
        selectedTower = t;
        updateHud();
        return;
      }
    }

    // 2. Check empty placement pad tap
    for (const pad of PADS) {
      if (Math.hypot(pad.x - x, pad.y - y) <= 28) {
        const occupied = towers.some((t) => Math.hypot(t.x - pad.x, t.y - pad.y) < 12);
        if (occupied) continue;

        if (!selected || !TOWERS[selected]) {
          addFloat(pad.x, pad.y - 15, "타워 선택!", "#ffe27a");
          return;
        }

        const def = TOWERS[selected];
        if (!isTowerUnlocked(selected)) {
          addFloat(pad.x, pad.y - 15, `잠김 (${def.unlock}단계)`, "#ff7a7a");
          return;
        }

        if (gold < def.cost) {
          addFloat(pad.x, pad.y - 15, "골드 부족!", "#ff7a7a");
          return;
        }

        gold -= def.cost;
        const tower = {
          type: selected,
          level: 1,
          x: pad.x,
          y: pad.y,
          cd: 0,
          facing: 1,
          lean: 0,
          recoil: 0,
          bob: rand(0, Math.PI * 2),
          invested: def.cost,
        };
        towers.push(tower);
        selectedTower = tower;
        burst(pad.x, pad.y, def.color, 14);
        addFloat(pad.x, pad.y - 20, def.name, def.color);
        hintTimer = 0;
        hint.classList.add("fade");
        updateHud();
        return;
      }
    }

    // Unselect tower if tapped elsewhere
    if (selectedTower) {
      selectedTower = null;
      updateHud();
    }
  }

  function resolveShotHit(s) {
    const st = towerStats(s.type, s.level);
    if (s.type === "thunder") {
      if (enemies.includes(s.target)) applyThunderHit(s.target, st, s.level);
      return;
    }
    if (!enemies.includes(s.target)) return;
    if (st.splash) {
      const center = posOnPath(s.target.dist);
      burst(center.x, center.y, st.color, 8 + s.level * 2);
      for (const e of enemies.slice()) {
        const p = posOnPath(e.dist);
        if (Math.hypot(p.x - center.x, p.y - center.y) <= st.splash) {
          hurtEnemy(e, st.dmg, st.color);
        }
      }
    } else {
      hurtEnemy(s.target, st.dmg, st.color);
      if (st.slow && enemies.includes(s.target)) {
        s.target.slow = st.slow;
        s.target.slowT = st.slowT;
      }
    }
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    if (nestPulse > 0) nestPulse -= dt;
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hint.classList.add("fade");
    }

    spawnAcc += dt;
    while (spawnQueue.length && spawnAcc >= spawnQueue[0].t) {
      spawnEnemy(spawnQueue.shift().kind);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.bob += dt * 6;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slow = 1;
      }
      e.dist += e.speed * e.slow * dt;
      if (e.dist >= pathLen - 2) {
        nestHp -= 1;
        nestPulse = 0.4;
        shake = 0.28;
        leaked += 1;
        enemies.splice(i, 1);
        updateHud();
        if (nestHp <= 0) {
          nestHp = 0;
          gameOver();
          return;
        }
      }
    }

    for (const t of towers) {
      t.bob += dt * 4;
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 4);
      const st = towerStats(t.type, t.level);
      const target = nearestEnemy(t.x, t.y, st.range);
      const look = target || nearestEnemyAny(t.x, t.y);
      if (look) {
        const lp = posOnPath(look.dist);
        const want = lp.x >= t.x ? 1 : -1;
        if (want !== t.facing) t.facing = want;
        t.lean += ((lp.y < t.y ? -0.12 : 0.08) - t.lean) * Math.min(1, dt * 6);
      } else {
        t.lean += (0 - t.lean) * Math.min(1, dt * 4);
      }

      t.cd -= dt;
      if (t.cd > 0 || !target) continue;
      t.cd = st.rate;
      const tp = posOnPath(target.dist);
      const sx = t.x;
      const sy = t.y - 10;
      const ang = Math.atan2(tp.y - sy, tp.x - sx);
      t.facing = tp.x >= t.x ? 1 : -1;
      t.recoil = 1;
      fireMuzzle(t, ang, st.color);

      const flight = shotFlight(t.type, t.level);
      shots.push({
        sx, sy, x: sx, y: sy,
        tx: tp.x, ty: tp.y,
        target, type: t.type, level: t.level,
        dist: 0, totalDist: Math.hypot(tp.x - sx, tp.y - sy) || 1,
        speed: flight.speed, arc: flight.arc,
        spin: rand(0, Math.PI * 2), ang,
      });
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.spin += dt * 10;
      s.dist += s.speed * dt;
      const prog = Math.min(1, s.dist / s.totalDist);
      const curTargetPos = enemies.includes(s.target) ? posOnPath(s.target.dist) : { x: s.tx, y: s.ty };
      s.x = s.sx + (curTargetPos.x - s.sx) * prog;
      const baseY = s.sy + (curTargetPos.y - s.sy) * prog;
      const arcH = Math.sin(prog * Math.PI) * s.arc * 90;
      s.y = baseY - arcH;

      if (prog >= 1) {
        resolveShotHit(s);
        shots.splice(i, 1);
      }
    }
  }

  function drawImg(g, img, x, y, w, h, flip) {
    if (!img) return false;
    g.save();
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.drawImage(img, -w / 2, -h / 2, w, h);
    g.restore();
    return true;
  }

  // High-Quality Visual Map & Path Drawing Engine
  function draw(g) {
    g.save();
    if (shake > 0) g.translate(rand(-3, 3), rand(-3, 3));

    const bgKey = activeMap.bg;
    const bgImg = imgs[bgKey];
    if (bgImg) {
      g.drawImage(bgImg, 0, 0, W, H);
    } else {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#7ec850");
      grad.addColorStop(0.5, "#5aa838");
      grad.addColorStop(1, "#366d22");
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }

    // 1. Cobblestone Path Underlayer
    if (PATH.length > 1) {
      g.strokeStyle = "rgba(40, 24, 12, 0.45)";
      g.lineWidth = 34;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(PATH[0].x, PATH[0].y);
      for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y);
      g.stroke();

      g.strokeStyle = "#d4b078";
      g.lineWidth = 26;
      g.beginPath();
      g.moveTo(PATH[0].x, PATH[0].y);
      for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y);
      g.stroke();

      // Path Center Dotted Line
      g.strokeStyle = "rgba(255, 245, 210, 0.4)";
      g.lineWidth = 3;
      g.setLineDash([8, 8]);
      g.beginPath();
      g.moveTo(PATH[0].x, PATH[0].y);
      for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y);
      g.stroke();
      g.setLineDash([]);
    }

    // 2. High Quality Placement Pads (All y <= 550)
    for (const pad of PADS) {
      const occupied = towers.some((t) => Math.hypot(t.x - pad.x, t.y - pad.y) < 12);
      const isSelectedPad = selectedTower && Math.hypot(selectedTower.x - pad.x, selectedTower.y - pad.y) < 12;

      g.save();
      g.translate(pad.x, pad.y);

      // Outer Pad Ring
      g.fillStyle = occupied ? "rgba(40, 60, 20, 0.35)" : "rgba(255, 248, 220, 0.75)";
      g.beginPath();
      g.arc(0, 0, 21, 0, Math.PI * 2);
      g.fill();

      g.strokeStyle = isSelectedPad ? "#ffe27a" : occupied ? "rgba(255,255,255,0.4)" : "#6ab030";
      g.lineWidth = isSelectedPad ? 3 : 2;
      g.beginPath();
      g.arc(0, 0, 21, 0, Math.PI * 2);
      g.stroke();

      if (!occupied) {
        g.fillStyle = "#ffffff";
        g.font = 'bold 16px "Jua", sans-serif';
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("+", 0, 1);
      }
      g.restore();
    }

    // 3. Selected Tower Range Circle
    if (selectedTower) {
      const st = towerStats(selectedTower.type, selectedTower.level);
      g.fillStyle = "rgba(255, 226, 122, 0.15)";
      g.strokeStyle = "#ffe27a";
      g.lineWidth = 2;
      g.setLineDash([6, 6]);
      g.beginPath();
      g.arc(selectedTower.x, selectedTower.y, st.range, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.setLineDash([]);
    }

    // 4. Nest Base Endpoint
    const end = posOnPath(pathLen);
    const nPulse = Math.sin(time * 6) * 3;
    g.save();
    g.translate(end.x, end.y);
    g.fillStyle = "rgba(255, 215, 0, 0.3)";
    g.beginPath();
    g.arc(0, 0, 32 + nPulse, 0, Math.PI * 2);
    g.fill();

    if (!drawImg(g, imgs.nest, 0, 0, 58, 58)) {
      g.fillStyle = "#ffe27a";
      g.beginPath();
      g.arc(0, 0, 24, 0, Math.PI * 2);
      g.fill();
      g.font = "24px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("🪹", 0, 0);
    }
    g.restore();

    // 5. Towers
    for (const t of towers) {
      const st = towerStats(t.type, t.level);
      const bob = Math.sin(t.bob) * 2;
      const recoilX = -Math.cos(t.facing > 0 ? 0 : Math.PI) * t.recoil * 4;

      g.save();
      g.translate(t.x + recoilX, t.y + bob);
      g.rotate(t.lean);

      const isSel = selectedTower === t;
      if (isSel) {
        g.strokeStyle = "#ffe27a";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, 0, 24, 0, Math.PI * 2);
        g.stroke();
      }

      const img = towerSprite(t.type, t.level);
      const tw = 46 + Math.min(10, t.level * 1.2);
      const th = 46 + Math.min(10, t.level * 1.2);

      if (!drawImg(g, img, 0, 0, tw, th, t.facing < 0)) {
        g.fillStyle = st.color;
        g.beginPath();
        g.arc(0, 0, 18, 0, Math.PI * 2);
        g.fill();
      }

      // Tower Level Badge
      g.fillStyle = "#ffe27a";
      g.beginPath();
      g.arc(16, -16, 10, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#2a1a05";
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = "#2a1a05";
      g.font = 'bold 11px "Jua", sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(t.level), 16, -15);
      g.restore();
    }

    // 6. Enemies
    for (const e of enemies) {
      const p = posOnPath(e.dist);
      const flip = p.ang > Math.PI / 2 || p.ang < -Math.PI / 2;
      const img = imgs[e.def.img];
      const bob = Math.sin(e.bob) * 2;

      if (e.slow < 1) {
        g.fillStyle = "rgba(140,210,255,0.35)";
        g.beginPath();
        g.arc(p.x, p.y + bob, e.def.r + 8, 0, Math.PI * 2);
        g.fill();
      }

      const iw = e.def.r * 2.5;
      const ih = e.def.r * 2.2;
      if (!drawImg(g, img, p.x, p.y + bob, iw, ih, !flip)) {
        g.fillStyle = "#e88840";
        g.beginPath();
        g.arc(p.x, p.y + bob, e.def.r, 0, Math.PI * 2);
        g.fill();
      }

      // HP Bar
      const bw = e.def.r * 2.2;
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(p.x - bw / 2, p.y - e.def.r - 12 + bob, bw, 5);
      g.fillStyle = e.def.boss ? "#ffd166" : "#ff6b6b";
      g.fillRect(p.x - bw / 2, p.y - e.def.r - 12 + bob, bw * Math.max(0, e.hp / e.maxHp), 5);
    }

    // 7. Shots & Particles
    for (const s of shots) drawShot(g, s);

    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life * 1.5);
      if (p.kind === "lightning") {
        g.strokeStyle = p.color || "#c090ff";
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.tx, p.ty);
        g.stroke();
      } else {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    // 8. Floating Badges
    for (const f of floats) {
      g.globalAlpha = Math.min(1, f.life * 1.4);
      g.fillStyle = f.color;
      g.font = 'bold 15px "Jua", sans-serif';
      g.textAlign = "center";
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
    g.restore();
  }

  function drawShot(g, s) {
    const lv = s.level || 1;
    g.save();
    g.translate(s.x, s.y);
    if (s.type === "thrower" || s.type === "mortar") {
      g.rotate(s.spin);
      g.fillStyle = "#ffe27a";
      g.beginPath();
      g.arc(0, 0, 6 + lv * 0.8, 0, Math.PI * 2);
      g.fill();
    } else if (s.type === "frost") {
      g.fillStyle = "#a8e8ff";
      g.beginPath();
      g.arc(0, 0, 7 + lv, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = "#ffe27a";
      g.beginPath();
      g.arc(0, 0, 5 + lv * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (state === "play") {
      update(dt);
      draw(ctx);
      raf = requestAnimationFrame(loop);
    } else if (state === "paused") {
      draw(ctx);
      raf = requestAnimationFrame(loop);
    } else {
      draw(ctx);
    }
  }

  function canvasPos(ev) {
    const rect = canvas.getBoundingClientRect();
    let clientX = ev.clientX;
    let clientY = ev.clientY;
    if (ev.touches && ev.touches.length > 0) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    }
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if (state !== "play") return;
    const p = canvasPos(ev);
    // Allow tapping placement pads up to y = 575 (well clear of shop bar at y = 610)
    if (p.y > H - 85) return;
    tryBuildOrSelect(p.x, p.y);
  });

  if (upgradeBtn) upgradeBtn.addEventListener("click", tryUpgrade);
  if (sellBtn) sellBtn.addEventListener("click", trySell);

  const upClose = document.getElementById("up-close");
  if (upClose) {
    upClose.addEventListener("click", () => {
      selectedTower = null;
      updateHud();
    });
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "둥지 디펜스", formParent: overlays.title });
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

  applyMap("forest");
  rebuildShop();
  shop.classList.add("hidden");
  hint.classList.add("hidden");
  upPanel.classList.add("hidden");

  loadAssets().then(() => {
    draw(ctx);
    last = performance.now();
    raf = requestAnimationFrame(function idle(now) {
      if (state !== "title") return;
      last = now;
      time += 0.016;
      draw(ctx);
      raf = requestAnimationFrame(idle);
    });
  });
})();
