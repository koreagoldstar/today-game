(() => {
  "use strict";

  const GAME_ID = "chick-defense";
  const W = 390;
  const H = 700;
  const MAX_LEVEL = 8;
  const STAGE_COUNT = 50;
  const STAGES_PER_MAP = Math.ceil(STAGE_COUNT / 4);

  function adConfig() {
    const items =
      (window.TodayAdBoards && TodayAdBoards.getItems && TodayAdBoards.getItems()) ||
      (window.TODAY_AD_BOARDS && window.TODAY_AD_BOARDS.items) ||
      [{ text: "사랑해", textColor: "#e23d4a" }];
    return {
      items,
      texts: items.map((a) => a.text || "사랑해"),
      ink: (items[0] && items[0].textColor) || "#e23d4a",
    };
  }

  const MAPS = {
    forest: {
      id: "forest",
      name: "햇살 숲",
      bg: "bg-forest",
      path: [
        { x: 195, y: 85 }, { x: 210, y: 120 }, { x: 175, y: 150 }, { x: 130, y: 165 },
        { x: 125, y: 200 }, { x: 180, y: 225 }, { x: 250, y: 245 }, { x: 280, y: 275 },
        { x: 230, y: 300 }, { x: 150, y: 325 }, { x: 120, y: 355 }, { x: 165, y: 385 },
        { x: 240, y: 410 }, { x: 270, y: 445 }, { x: 210, y: 475 }, { x: 155, y: 505 },
        { x: 175, y: 540 }, { x: 220, y: 575 }, { x: 195, y: 618 },
      ],
      pads: [
        { x: 95, y: 145 }, { x: 285, y: 130 }, { x: 70, y: 185 }, { x: 300, y: 210 },
        { x: 95, y: 255 }, { x: 320, y: 265 }, { x: 75, y: 315 }, { x: 305, y: 330 },
        { x: 85, y: 370 }, { x: 310, y: 395 }, { x: 95, y: 440 }, { x: 305, y: 455 },
        { x: 80, y: 500 }, { x: 295, y: 515 }, { x: 110, y: 565 }, { x: 280, y: 590 },
        { x: 95, y: 620 },
      ],
      billboards: [
        { x: 18, y: 118, w: 100, h: 68, textIndex: 0 },
        { x: 278, y: 300, w: 100, h: 68, textIndex: 1 },
        { x: 16, y: 430, w: 96, h: 66, textIndex: 2 },
      ],
    },
    dusk: {
      id: "dusk",
      name: "황혼 골짜기",
      bg: "bg-dusk",
      path: [
        { x: 195, y: 80 }, { x: 120, y: 105 }, { x: 80, y: 140 }, { x: 110, y: 175 },
        { x: 200, y: 195 }, { x: 300, y: 210 }, { x: 320, y: 250 }, { x: 260, y: 280 },
        { x: 180, y: 305 }, { x: 100, y: 330 }, { x: 85, y: 370 }, { x: 140, y: 400 },
        { x: 220, y: 425 }, { x: 310, y: 450 }, { x: 290, y: 490 }, { x: 200, y: 520 },
        { x: 130, y: 550 }, { x: 160, y: 585 }, { x: 195, y: 618 },
      ],
      pads: [
        { x: 300, y: 95 }, { x: 55, y: 120 }, { x: 310, y: 165 }, { x: 50, y: 210 },
        { x: 305, y: 240 }, { x: 55, y: 290 }, { x: 310, y: 325 }, { x: 45, y: 355 },
        { x: 300, y: 395 }, { x: 60, y: 425 }, { x: 305, y: 465 }, { x: 55, y: 500 },
        { x: 310, y: 535 }, { x: 70, y: 565 }, { x: 280, y: 595 }, { x: 100, y: 625 },
      ],
      billboards: [
        { x: 268, y: 95, w: 100, h: 68, textIndex: 0 },
        { x: 22, y: 265, w: 96, h: 66, textIndex: 1 },
        { x: 275, y: 480, w: 100, h: 68, textIndex: 2 },
      ],
    },
    night: {
      id: "night",
      name: "달빛 숲",
      bg: "bg-night",
      path: [
        { x: 195, y: 78 }, { x: 260, y: 100 }, { x: 310, y: 130 }, { x: 270, y: 160 },
        { x: 200, y: 175 }, { x: 130, y: 190 }, { x: 90, y: 220 }, { x: 140, y: 250 },
        { x: 210, y: 265 }, { x: 290, y: 285 }, { x: 330, y: 315 }, { x: 280, y: 345 },
        { x: 200, y: 360 }, { x: 120, y: 385 }, { x: 80, y: 415 }, { x: 130, y: 445 },
        { x: 210, y: 470 }, { x: 290, y: 495 }, { x: 250, y: 530 }, { x: 180, y: 560 },
        { x: 195, y: 618 },
      ],
      pads: [
        { x: 55, y: 105 }, { x: 330, y: 115 }, { x: 55, y: 175 }, { x: 325, y: 195 },
        { x: 310, y: 245 }, { x: 55, y: 265 }, { x: 310, y: 310 }, { x: 55, y: 340 },
        { x: 310, y: 375 }, { x: 55, y: 400 }, { x: 310, y: 435 }, { x: 55, y: 465 },
        { x: 310, y: 500 }, { x: 55, y: 530 }, { x: 300, y: 565 }, { x: 100, y: 590 },
        { x: 280, y: 620 },
      ],
      billboards: [
        { x: 14, y: 130, w: 96, h: 66, textIndex: 0 },
        { x: 280, y: 340, w: 100, h: 68, textIndex: 1 },
        { x: 20, y: 510, w: 96, h: 66, textIndex: 2 },
      ],
    },
    meadow: {
      id: "meadow",
      name: "안개 초원",
      bg: "bg-meadow",
      path: [
        { x: 195, y: 75 }, { x: 150, y: 95 }, { x: 100, y: 115 }, { x: 70, y: 145 },
        { x: 110, y: 170 }, { x: 170, y: 185 }, { x: 240, y: 200 }, { x: 300, y: 220 },
        { x: 340, y: 250 }, { x: 300, y: 280 }, { x: 240, y: 300 }, { x: 170, y: 320 },
        { x: 110, y: 345 }, { x: 70, y: 375 }, { x: 100, y: 405 }, { x: 160, y: 425 },
        { x: 230, y: 445 }, { x: 300, y: 470 }, { x: 320, y: 505 }, { x: 260, y: 535 },
        { x: 200, y: 560 }, { x: 195, y: 618 },
      ],
      pads: [
        { x: 310, y: 90 }, { x: 55, y: 110 }, { x: 310, y: 155 }, { x: 45, y: 195 },
        { x: 310, y: 235 }, { x: 55, y: 265 }, { x: 310, y: 305 }, { x: 45, y: 345 },
        { x: 310, y: 385 }, { x: 55, y: 415 }, { x: 310, y: 455 }, { x: 45, y: 485 },
        { x: 310, y: 520 }, { x: 55, y: 550 }, { x: 300, y: 580 }, { x: 90, y: 605 },
        { x: 280, y: 630 }, { x: 120, y: 640 },
      ],
      billboards: [
        { x: 275, y: 105, w: 100, h: 68, textIndex: 0 },
        { x: 18, y: 310, w: 96, h: 66, textIndex: 1 },
        { x: 268, y: 520, w: 100, h: 68, textIndex: 2 },
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
    fox: { name: "여우", hp: 30, speed: 50, reward: 9, score: 12, r: 18, img: "fox" },
    raccoon: { name: "너구리", hp: 58, speed: 36, reward: 15, score: 20, r: 19, img: "raccoon" },
    wolf: { name: "늑대", hp: 38, speed: 76, reward: 13, score: 18, r: 18, img: "wolf" },
    bear: { name: "곰", hp: 240, speed: 26, reward: 42, score: 90, r: 28, img: "bear", boss: true },
  };

  const STAGE_NAMES = [
    "첫 여우", "너구리 등장", "빠른 발", "이중 습격", "보초 강화",
    "밤의 습격", "곰의 그림자", "연속 웨이브", "숲의 분노", "수호의 시험",
    "여우 떼", "너구리 성채", "늑대 질주", "황혼 방어", "중간 보스",
    "폭풍 전야", "둥지 위기", "최후의 수비", "전설의 수호", "왕의 웨이브",
    "새벽 습격", "안개 숲", "돌격대", "빙결 전선", "거대 곰",
    "끝없는 여우", "수호 결전", "숲의 왕", "최종 방어선", "달빛 습격",
    "저격 훈련", "박격 준비", "늑대 무리", "번개 시험", "곰의 분노",
    "초원 입구", "안개 속", "연쇄 번개", "포격 지원", "중반 보스",
    "짙은 안개", "최후 골짜기", "전면 돌격", "완전 무장", "거대의 그림자",
    "전설의 둥지", "끝없는 파도", "수호 결사", "최종 시험", "전설 클리어",
  ];

  const STAGES = Array.from({ length: STAGE_COUNT }, (_, i) => {
    const t = i / (STAGE_COUNT - 1);
    const waves = [];
    const n = 8 + Math.floor(i * 0.85);
    const gap = Math.max(0.18, 0.65 - i * 0.008);
    for (let k = 0; k < n; k++) {
      let kind = "fox";
      const roll = ((i * 17 + k * 31) % 100) / 100;
      if (i >= 1 && roll < 0.28 + t * 0.28) kind = "raccoon";
      if (i >= 2 && ((i * 13 + k * 19) % 100) / 100 < 0.22 + t * 0.32) kind = "wolf";
      waves.push({ kind, t: 0.45 + k * gap });
    }
    if ((i + 1) % 5 === 0) waves.push({ kind: "bear", t: waves[waves.length - 1].t + 1.0 });
    return {
      name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
      gold: 85 + Math.floor(i * 4.5),
      nestHp: i < 8 ? 12 : i < 20 ? 14 : i < 35 ? 16 : 18,
      hpScale: 1 + i * 0.12,
      speedScale: 1 + i * 0.032,
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
    return Math.floor(si / STAGES_PER_MAP);
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
      for (const t of towers) refund += Math.floor((t.invested || 0) * 0.6);
      gold += refund;
      towers = [];
      selectedTower = null;
      applyMap(MAP_ORDER[newMapIndex]);
      hintTimer = 4;
      hint.classList.remove("fade", "hidden");
      hint.textContent = refund > 0
        ? `${activeMap.name} · 타워 60% 환급 +${refund}`
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
      hint.textContent = "빈 자리 배치 · 병아리 탭하면 강화!";
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
    const bonus = nestHp * 10 + Math.floor(gold * 0.15) + towers.reduce((s, t) => s + t.level * 5, 0);
    score += bonus;
    state = "clear";
    selectedTower = null;
    document.getElementById("clear-detail").textContent =
      `${STAGES[stageIndex].name} · 보너스 +${bonus} · 강화합 Lv.${towers.reduce((s, t) => s + t.level, 0)}`;
    overlays.clear.classList.remove("hidden");
    shop.classList.add("hidden");
    hint.classList.add("hidden");
    upPanel.classList.add("hidden");
    updateHud();
  }

  function gameOver() {
    state = "over";
    selectedTower = null;
    document.getElementById("over-detail").textContent = `스테이지 ${stageIndex + 1} · 점수 ${score}`;
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
    document.getElementById("all-detail").textContent = `최종 점수 ${score}`;
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
    const kind = ENEMY_KINDS[kindId] || ENEMY_KINDS.fox;
    enemies.push({
      kind: kindId,
      def: kind,
      dist: 0,
      hp: kind.hp * st.hpScale,
      maxHp: kind.hp * st.hpScale,
      speed: kind.speed * st.speedScale,
      slow: 1,
      slowT: 0,
      bob: rand(0, Math.PI * 2),
    });
  }

  function nearestEnemy(x, y, range) {
    let best = null;
    let bestD = range;
    for (const e of enemies) {
      const p = posOnPath(e.dist);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function facingTowardPath(x, y) {
    let best = PATH[0];
    let bestD = Infinity;
    for (const p of PATH) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best.x >= x ? 1 : -1;
  }

  function nearestEnemyAny(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const e of enemies) {
      const p = posOnPath(e.dist);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function fireMuzzle(t, ang, color) {
    const ox = t.x + Math.cos(ang) * 18;
    const oy = t.y - 10 + Math.sin(ang) * 10;
    for (let i = 0; i < 4 + t.level; i++) {
      const a = ang + rand(-0.5, 0.5);
      const sp = rand(40, 110);
      particles.push({
        x: ox, y: oy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.15, 0.35), r: rand(1.5, 3.2), color,
      });
    }
  }

  function shotFlight(type, level) {
    if (type === "mortar") return 0.55 + level * 0.03;
    if (type === "thrower") return 0.32 + level * 0.02;
    if (type === "frost") return 0.24 + level * 0.015;
    if (type === "sniper") return 0.08 + level * 0.005;
    if (type === "thunder") return 0.06 + level * 0.004;
    return 0.16 + level * 0.01;
  }

  function shotArc(type, level) {
    if (type === "mortar") return 48 + level * 8;
    if (type === "thrower") return 28 + level * 6;
    if (type === "frost") return 10;
    return 4;
  }

  function hurtEnemy(e, dmg, color) {
    e.hp -= dmg;
    const p = posOnPath(e.dist);
    burst(p.x, p.y, color || "#ffe27a", 5);
    if (e.hp <= 0) {
      gold += e.def.reward;
      score += e.def.score;
      killed += 1;
      addFloat(p.x, p.y - 12, `+${e.def.reward}`, "#ffe27a");
      burst(p.x, p.y, "#fff0c0", 14);
      enemies = enemies.filter((x) => x !== e);
      updateHud();
    }
  }

  function applyThunderHit(primary, st, level) {
    if (!enemies.includes(primary)) return;
    const chainRange = 70 + level * 4;
    const chainDmg = Math.round(st.dmg * 0.75);
    hurtEnemy(primary, st.dmg, st.color);
    let chainsLeft = st.chain || 2;
    let from = primary;
    const hit = new Set([primary]);
    while (chainsLeft > 0) {
      let nearest = null;
      let nearestD = chainRange;
      const fp = posOnPath(from.dist);
      for (const e of enemies) {
        if (hit.has(e)) continue;
        const ep = posOnPath(e.dist);
        const d = Math.hypot(ep.x - fp.x, ep.y - fp.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = e;
        }
      }
      if (!nearest) break;
      const tp = posOnPath(nearest.dist);
      particles.push({
        x: fp.x, y: fp.y, tx: tp.x, ty: tp.y,
        life: 0.12, max: 0.12, kind: "lightning", color: st.color,
      });
      hurtEnemy(nearest, chainDmg, st.color);
      hit.add(nearest);
      from = nearest;
      chainsLeft -= 1;
    }
  }

  function tryUpgrade() {
    if (!selectedTower || state !== "play") return;
    if (selectedTower.level >= MAX_LEVEL) return;
    const cost = upgradeCost(selectedTower);
    if (gold < cost) {
      addFloat(selectedTower.x, selectedTower.y - 24, "코인 부족!", "#ff8a8a");
      return;
    }
    gold -= cost;
    selectedTower.invested = (selectedTower.invested || 0) + cost;
    selectedTower.level += 1;
    burst(selectedTower.x, selectedTower.y, "#ffe27a", 16);
    addFloat(selectedTower.x, selectedTower.y - 28, `Lv.${selectedTower.level}!`, "#9ae06a");
    updateHud();
  }

  function tryBuildOrSelect(mx, my) {
    if (state !== "play") return;

    for (const t of towers) {
      if (Math.hypot(t.x - mx, t.y - my) < 28) {
        selectedTower = t;
        updateHud();
        return;
      }
    }

    selectedTower = null;
    if (!isTowerUnlocked(selected)) {
      addFloat(mx, my, "아직 잠김!", "#ff8a8a");
      updateHud();
      return;
    }
    const def = TOWERS[selected];
    if (!def || gold < def.cost) {
      addFloat(mx, my, gold < (def ? def.cost : 0) ? "코인 부족!" : "선택 필요", "#ff8a8a");
      updateHud();
      return;
    }

    let pad = null;
    let best = 34;
    for (const p of PADS) {
      if (towers.some((t) => t.pad === p)) continue;
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < best) {
        best = d;
        pad = p;
      }
    }
    if (!pad) {
      addFloat(mx, my, "배치 불가", "#ffb0b0");
      updateHud();
      return;
    }

    gold -= def.cost;
    const tower = {
      pad, type: selected, x: pad.x, y: pad.y,
      level: 1, invested: def.cost, cd: 0.15,
      bob: rand(0, Math.PI * 2),
      bobSp: rand(3.2, 5.2),
      facing: facingTowardPath(pad.x, pad.y),
      recoil: 0,
      lean: 0,
    };
    towers.push(tower);
    selectedTower = tower;
    burst(pad.x, pad.y, def.color, 12);
    addFloat(pad.x, pad.y - 20, def.name, def.color);
    hintTimer = 0;
    hint.classList.add("fade");
    updateHud();
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
      t.bob += dt * (t.bobSp || 4);
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
        ang, spin: 0,
        target, type: t.type, level: t.level,
        life: flight, max: flight,
        arc: shotArc(t.type, t.level),
      });
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;
      const u = 1 - Math.max(0, s.life) / s.max;
      const nx = s.sx + (s.tx - s.sx) * u;
      const ny = s.sy + (s.ty - s.sy) * u - Math.sin(u * Math.PI) * s.arc;
      s.ang = Math.atan2(ny - s.y, nx - s.x) || s.ang;
      s.x = nx;
      s.y = ny;
      const spinRate = s.type === "thrower" ? 10 : s.type === "frost" ? 8 : s.type === "thunder" ? 14 : 2;
      s.spin += dt * spinRate;

      if (Math.random() < 0.35 + s.level * 0.1) {
        const elite = s.level >= 5;
        let col;
        if (s.type === "frost") col = elite ? "#9ae8ff" : "#c8f0ff";
        else if (s.type === "thrower") col = elite ? "#ff9040" : "#ffd090";
        else if (s.type === "sniper") col = elite ? "#9ae06a" : "#c8f0a0";
        else if (s.type === "mortar") col = elite ? "#a08050" : "#d8c0a0";
        else if (s.type === "thunder") col = elite ? "#c090ff" : "#e8d0ff";
        else col = elite ? "#ffe27a" : "#fff6c8";
        particles.push({
          x: s.x, y: s.y,
          vx: rand(-20, 20), vy: rand(-30, 10),
          life: rand(0.12, 0.28), r: rand(1.2, 2.8 + s.level * 0.2), color: col,
        });
      }

      if (s.life > 0) continue;
      shots.splice(i, 1);
      resolveShotHit(s);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.kind === "lightning") continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }

    if (spawnQueue.length === 0 && enemies.length === 0 && state === "play") {
      stageClear();
    }
  }

  function drawImg(g, img, x, y, w, h, flip) {
    if (!img) return false;
    g.save();
    if (flip) {
      g.translate(x, y);
      g.scale(-1, 1);
      g.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      g.drawImage(img, x - w / 2, y - h / 2, w, h);
    }
    g.restore();
    return true;
  }

  function drawBillboard(g, b) {
    const cfg = adConfig();
    const ad = cfg.items[b.textIndex % cfg.items.length] || { text: "사랑해♡", textColor: cfg.ink };
    // Prefer shared canvas drawer when available (supports image ads)
    if (window.TodayAdBoards && TodayAdBoards.draw && !imgs.billboard) {
      TodayAdBoards.draw(g, ad, b.x, b.y, b.w, b.h, { pole: true, side: b.x < W / 2 ? "left" : "right" });
      return;
    }
    if (imgs.billboard) {
      g.drawImage(imgs.billboard, b.x, b.y, b.w, b.h);
    } else {
      g.fillStyle = "#6b4226";
      g.fillRect(b.x + 12, b.y + b.h - 6, 8, 26);
      g.fillRect(b.x + b.w - 20, b.y + b.h - 6, 8, 26);
      g.fillStyle = ad.bg || "#fff6e0";
      g.fillRect(b.x + 6, b.y + 8, b.w - 12, b.h - 28);
    }
    const img =
      ad.image && window.TodayAdBoards && TodayAdBoards.getImage
        ? TodayAdBoards.getImage(ad)
        : null;
    if (img) {
      const pad = 10;
      g.drawImage(img, b.x + pad, b.y + pad, b.w - pad * 2, b.h - pad * 2 - 10);
      return;
    }
    g.fillStyle = "rgba(255,248,230,0.92)";
    const tx = b.x + b.w * 0.12;
    const ty = b.y + b.h * 0.28;
    const tw = b.w * 0.76;
    const th = b.h * 0.38;
    g.fillRect(tx, ty, tw, th);
    g.fillStyle = ad.textColor || cfg.ink;
    g.font = `700 ${Math.min(22, th * 0.7)}px "Jua", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(ad.text || "사랑해", b.x + b.w / 2, ty + th / 2 + 1);
  }

  function drawShot(g, s) {
    const lv = s.level || 1;
    const elite = lv >= 5;
    g.save();
    g.translate(s.x, s.y);
    if (s.type === "thrower") {
      g.rotate(s.spin);
      const rw = 6.5 + lv * 0.9;
      const rh = 5 + lv * 0.6;
      const egg = g.createRadialGradient(-2, -2, 1, 0, 0, rw);
      egg.addColorStop(0, elite ? "#fff2a0" : "#fff8e0");
      egg.addColorStop(1, elite ? "#f0a020" : "#e8c878");
      g.fillStyle = egg;
      g.beginPath();
      g.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
      g.fill();
    } else if (s.type === "frost") {
      g.rotate(s.ang + s.spin * 0.3);
      const sz = 5 + lv * 1.1;
      g.fillStyle = elite ? "rgba(120,210,255,0.45)" : "rgba(180,230,255,0.3)";
      g.beginPath();
      g.arc(0, 0, sz + 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = elite ? "#8ad8ff" : "#e8f8ff";
      g.strokeStyle = "#4ab0e0";
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(sz + 2, 0);
      g.lineTo(0, sz * 0.7);
      g.lineTo(-sz * 0.6, 0);
      g.lineTo(0, -sz * 0.7);
      g.closePath();
      g.fill();
      g.stroke();
    } else if (s.type === "sniper") {
      g.rotate(s.ang);
      const len = 14 + lv * 2;
      g.strokeStyle = elite ? "rgba(154,224,106,0.6)" : "rgba(200,240,160,0.4)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-len * 0.4, 0);
      g.lineTo(len * 0.5, 0);
      g.stroke();
      g.fillStyle = elite ? "#9ae06a" : "#6a9a30";
      g.fillRect(-len * 0.35, -1.2, len * 0.85, 2.4);
      g.fillStyle = "#fff8e6";
      g.beginPath();
      g.moveTo(len * 0.6, 0);
      g.lineTo(len * 0.2, -2);
      g.lineTo(len * 0.2, 2);
      g.closePath();
      g.fill();
    } else if (s.type === "mortar") {
      g.rotate(s.spin * 0.5);
      const r = 5 + lv * 0.8;
      g.fillStyle = elite ? "#6a5030" : "#8a6840";
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = elite ? "#ffe27a" : "#d8c0a0";
      g.beginPath();
      g.arc(-1, -1, r * 0.45, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#3a2810";
      g.lineWidth = 1;
      g.stroke();
    } else if (s.type === "thunder") {
      g.rotate(s.ang + s.spin);
      g.strokeStyle = elite ? "#c090ff" : "#9060e0";
      g.lineWidth = 2 + lv * 0.2;
      g.beginPath();
      g.moveTo(-8, 0);
      g.lineTo(-2, -5);
      g.lineTo(2, 0);
      g.lineTo(-1, 6);
      g.lineTo(8, -2);
      g.stroke();
      g.fillStyle = elite ? "#e8d0ff" : "#ffffff";
      g.beginPath();
      g.arc(0, 0, 2.5 + lv * 0.2, 0, Math.PI * 2);
      g.fill();
    } else {
      g.rotate(s.ang);
      const len = 9 + lv * 1.6;
      const thick = 1.6 + lv * 0.25;
      if (elite) {
        g.strokeStyle = "rgba(255,220,80,0.55)";
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(-len * 0.3, 0);
        g.lineTo(len * 0.2, 0);
        g.stroke();
      }
      g.fillStyle = elite ? "#ffe27a" : "#d4a85a";
      g.fillRect(-len * 0.45, -thick / 2, len * 0.7, thick);
      g.fillStyle = elite ? "#ff9040" : lv >= 3 ? "#c0c8d0" : "#8a6230";
      g.beginPath();
      g.moveTo(len * 0.55, 0);
      g.lineTo(len * 0.15, -thick * 1.4);
      g.lineTo(len * 0.15, thick * 1.4);
      g.closePath();
      g.fill();
      g.fillStyle = elite ? "#9ae06a" : "#e23d4a";
      g.beginPath();
      g.moveTo(-len * 0.45, 0);
      g.lineTo(-len * 0.7, -thick * 1.6);
      g.lineTo(-len * 0.35, 0);
      g.lineTo(-len * 0.7, thick * 1.6);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function drawTowerAccessory(g, t, cx, cy, face, lean) {
    g.save();
    g.translate(cx, cy);
    g.rotate(lean);
    if (face < 0) g.scale(-1, 1);
    if (t.type === "peep") {
      g.fillStyle = "#f0c14a";
      g.beginPath();
      g.ellipse(0, -20, 11, 6, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffe27a";
      g.fillRect(-2, -28, 4, 8);
    } else if (t.type === "thrower") {
      g.fillStyle = "#e23d4a";
      g.beginPath();
      g.moveTo(-12, -14);
      g.lineTo(12, -14);
      g.lineTo(8, -6);
      g.lineTo(-8, -6);
      g.closePath();
      g.fill();
    } else if (t.type === "frost") {
      g.fillStyle = "#d8f4ff";
      g.strokeStyle = "#7ad0ff";
      g.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(i * 8, -14);
        g.lineTo(i * 8, -26);
        g.lineTo(i * 8 + 4, -20);
        g.closePath();
        g.fill();
        g.stroke();
      }
    } else if (t.type === "sniper") {
      g.fillStyle = "#6a9a30";
      g.fillRect(-14, -12, 28, 4);
      g.fillStyle = "#9ae06a";
      g.beginPath();
      g.arc(14, -10, 3, 0, Math.PI * 2);
      g.fill();
    } else if (t.type === "mortar") {
      g.fillStyle = "#8a6840";
      g.beginPath();
      g.arc(0, -10, 10, Math.PI, 0);
      g.fill();
    } else if (t.type === "thunder") {
      g.strokeStyle = "#9060e0";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-6, -18);
      g.lineTo(0, -10);
      g.lineTo(-3, -10);
      g.lineTo(4, -2);
      g.stroke();
    }
    g.restore();
  }

  function draw(g) {
    g.save();
    if (shake > 0) g.translate(rand(-3, 3) * shake * 5, rand(-2, 2) * shake * 5);

    const bgImg = imgs[activeMap.bg];
    if (bgImg) {
      g.drawImage(bgImg, 0, 0, W, H);
    } else {
      const sky = g.createLinearGradient(0, 0, 0, 120);
      sky.addColorStop(0, "#9ad8ff");
      sky.addColorStop(1, "#b8e878");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, 120);
      g.fillStyle = "#5aa838";
      g.fillRect(0, 110, W, H - 110);
    }

    g.lineCap = "round";
    g.lineJoin = "round";
    if (bgImg) {
      g.globalAlpha = 0.28;
      g.strokeStyle = "rgba(255, 236, 190, 0.95)";
      g.lineWidth = 18;
      g.beginPath();
      g.moveTo(PATH[0].x, PATH[0].y);
      for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y);
      g.stroke();
      g.globalAlpha = 1;
    } else {
      g.strokeStyle = "rgba(80,50,25,0.35)";
      g.lineWidth = 46;
      g.beginPath();
      g.moveTo(PATH[0].x, PATH[0].y + 2);
      for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y + 2);
      g.stroke();
      g.strokeStyle = "#c9a06a";
      g.lineWidth = 36;
      g.beginPath();
      g.moveTo(PATH[0].x, PATH[0].y);
      for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y);
      g.stroke();
    }

    for (const b of BILLBOARDS) drawBillboard(g, b);

    for (const p of PADS) {
      const occ = towers.some((t) => t.pad === p);
      g.beginPath();
      g.arc(p.x, p.y, 17, 0, Math.PI * 2);
      if (occ) {
        g.fillStyle = "rgba(40,70,20,0.2)";
        g.fill();
      } else {
        g.fillStyle = "rgba(255,248,220,0.4)";
        g.fill();
        g.strokeStyle = "rgba(255,226,122,0.85)";
        g.lineWidth = 2;
        g.setLineDash([5, 4]);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#ffe27a";
        g.font = '15px "Jua"';
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("+", p.x, p.y + 1);
      }
    }

    {
      const nest = PATH[PATH.length - 1];
      const pulse = nestPulse > 0 ? Math.sin(nestPulse * 20) * 3 : 0;
      if (!bgImg) {
        drawImg(g, imgs.nest, nest.x, nest.y + pulse - 6, 92, 84, false);
      }
      const bw = 64;
      const by = nest.y + (bgImg ? 28 : 42) + pulse;
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(nest.x - bw / 2 - 1, by - 1, bw + 2, 10);
      g.fillStyle = nestHp / nestMax > 0.35 ? "#6fd66a" : "#ff6b6b";
      g.fillRect(nest.x - bw / 2, by, bw * Math.max(0, nestHp / nestMax), 8);
      g.strokeStyle = "rgba(255,248,230,0.4)";
      g.lineWidth = 1;
      g.strokeRect(nest.x - bw / 2, by, bw, 8);
    }

    for (const t of towers) {
      const st = towerStats(t.type, t.level);
      const elite = t.level >= 5;
      if (selectedTower === t) {
        g.strokeStyle = "rgba(255,226,122,0.35)";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(t.x, t.y, st.range, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = "rgba(255,226,122,0.9)";
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(t.x, t.y, 24, 0, Math.PI * 2);
        g.stroke();
      }

      g.fillStyle = "rgba(40,25,10,0.3)";
      g.beginPath();
      g.ellipse(t.x, t.y + 14, 18, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = st.accent || "#8a6230";
      g.beginPath();
      g.arc(t.x, t.y + 8, 13, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = st.color;
      g.beginPath();
      g.arc(t.x, t.y + 6, 10, 0, Math.PI * 2);
      g.fill();

      const face = t.facing == null ? 1 : t.facing;
      const bobY = Math.sin(t.bob) * 2.4;
      const recoilX = -(t.recoil || 0) * 6 * face;
      const lean = t.lean || 0;
      const scale = 0.68 + t.level * 0.06;
      const auraR = 18 + t.level * 2 + Math.sin(t.bob) * 1.5;
      const cx = t.x + recoilX;
      const cy = t.y - 8 + bobY;

      if (t.level >= 2 || st.tint) {
        g.strokeStyle = (st.tint || st.color) + (elite ? "aa" : "66");
        g.lineWidth = 2 + t.level * 0.35;
        g.beginPath();
        g.arc(cx, cy + 4, auraR, 0, Math.PI * 2);
        g.stroke();
      }
      if (t.type === "frost" && t.level >= 2) {
        g.fillStyle = "rgba(160,220,255,0.18)";
        g.beginPath();
        g.arc(cx, cy + 4, auraR + 4, 0, Math.PI * 2);
        g.fill();
      }
      if (t.type === "thrower" && t.level >= 2) {
        g.fillStyle = "rgba(255,140,60,0.14)";
        g.beginPath();
        g.arc(cx, cy + 4, auraR + 3, 0, Math.PI * 2);
        g.fill();
      }
      if (t.type === "thunder" && t.level >= 2) {
        g.fillStyle = "rgba(180,120,255,0.14)";
        g.beginPath();
        g.arc(cx, cy + 4, auraR + 3, 0, Math.PI * 2);
        g.fill();
      }

      const spr = towerSprite(t.type, t.level);
      if (spr) {
        g.save();
        g.translate(cx, cy);
        g.rotate(lean);
        drawImg(g, spr, 0, 0, 56 * scale, 54 * scale, face < 0);
        g.restore();
      }

      if (t.level === 3) drawTowerAccessory(g, t, cx, cy, face, lean);

      g.fillStyle = t.level >= MAX_LEVEL ? "#9ae06a" : st.color;
      g.beginPath();
      g.arc(t.x + 18, t.y - 20, 10, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(42,26,5,0.35)";
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = "#2a1a05";
      g.font = '700 11px "Jua"';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(t.level), t.x + 18, t.y - 19);

      if (t.level >= 3) {
        const stars = Math.min(6, t.level - 2);
        g.fillStyle = st.color;
        g.font = '10px "Jua"';
        g.fillText("★".repeat(stars), t.x, t.y + 22);
      }
    }

    for (const e of enemies) {
      const p = posOnPath(e.dist);
      const flip = p.ang > Math.PI / 2 || p.ang < -Math.PI / 2;
      const img = imgs[e.def.img];
      const bob = Math.sin(e.bob) * 2;
      if (e.slow < 1) {
        g.fillStyle = "rgba(140,210,255,0.28)";
        g.beginPath();
        g.arc(p.x, p.y + bob, e.def.r + 8, 0, Math.PI * 2);
        g.fill();
      }
      const iw = e.def.r * 2.4;
      const ih = e.def.r * 2.1;
      if (!drawImg(g, img, p.x, p.y + bob, iw, ih, !flip)) {
        g.fillStyle = "#e88840";
        g.beginPath();
        g.ellipse(p.x, p.y + bob, e.def.r, e.def.r * 0.8, 0, 0, Math.PI * 2);
        g.fill();
      }
      const bw = e.def.r * 2.2;
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(p.x - bw / 2, p.y - e.def.r - 12 + bob, bw, 5);
      g.fillStyle = "#ff6b6b";
      g.fillRect(p.x - bw / 2, p.y - e.def.r - 12 + bob, bw * Math.max(0, e.hp / e.maxHp), 5);
    }

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
        g.globalAlpha = Math.max(0, p.life * 1.5) * 0.5;
        g.lineWidth = 6;
        g.strokeStyle = "rgba(200,160,255,0.4)";
        g.stroke();
      } else {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    for (const f of floats) {
      g.globalAlpha = Math.min(1, f.life * 1.4);
      g.fillStyle = f.color;
      g.font = '700 15px "Jua", sans-serif';
      g.textAlign = "center";
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
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
    return {
      x: ((ev.clientX - rect.left) / rect.width) * W,
      y: ((ev.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if (state !== "play") return;
    const p = canvasPos(ev);
    if (p.y > H - 105) return;
    tryBuildOrSelect(p.x, p.y);
  });

  upgradeBtn.addEventListener("click", tryUpgrade);
  document.getElementById("up-close").addEventListener("click", () => {
    selectedTower = null;
    updateHud();
  });

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
