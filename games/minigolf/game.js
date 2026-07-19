(() => {
  "use strict";

  const W = 390;
  const H = 620;
  const BALL_R = 7;
  const HOLE_R = 11;
  const PX_PER_YARD = 5.2;
  const MAX_DRAG = 130;

  const CLUBS = {
    driver: { id: "driver", label: "드라이버", maxPower: 24.5, friction: 1, minDist: 140 },
    iron: { id: "iron", label: "아이언", maxPower: 16.2, friction: 1, minDist: 55 },
    wedge: { id: "wedge", label: "웨지", maxPower: 10.4, friction: 1, minDist: 18 },
    putter: { id: "putter", label: "퍼터", maxPower: 5.4, friction: 0.985, minDist: 0 },
  };

  /** @type {Array<{name:string,par:number,len:number,fairW:number,greenR:number,dogleg:number,wind:number,island?:boolean,sky?:string,bunkers:Array,water:Array}>} */
  const HOLES = [
    { name: "오프닝 파3", par: 3, len: 920, fairW: 122, greenR: 80, dogleg: 0, wind: 0, bunkers: [{ x: 0.62, y: 0.3, r: 34 }], water: [], sky: "day" },
    { name: "넓은 페어웨이", par: 4, len: 1520, fairW: 136, greenR: 84, dogleg: 0.03, wind: 0.2, bunkers: [{ x: 0.28, y: 0.42, r: 40 }, { x: 0.72, y: 0.24, r: 34 }], water: [], sky: "day" },
    { name: "도그레그 우측", par: 4, len: 1680, fairW: 108, greenR: 80, dogleg: 0.18, wind: -0.35, bunkers: [{ x: 0.7, y: 0.48, r: 40 }], water: [{ x: 0.18, y: 0.55, w: 0.26, h: 0.12 }], sky: "day" },
    { name: "롱홀 도전", par: 5, len: 2180, fairW: 124, greenR: 88, dogleg: -0.08, wind: 0.45, bunkers: [{ x: 0.34, y: 0.58, r: 42 }, { x: 0.66, y: 0.34, r: 38 }, { x: 0.48, y: 0.18, r: 32 }], water: [], sky: "day" },
    { name: "워터 게이트", par: 3, len: 1040, fairW: 100, greenR: 74, dogleg: 0, wind: 0.55, bunkers: [{ x: 0.3, y: 0.26, r: 30 }], water: [{ x: 0.16, y: 0.4, w: 0.68, h: 0.15 }], sky: "day" },
    { name: "좁은 골짜기", par: 4, len: 1480, fairW: 88, greenR: 74, dogleg: -0.14, wind: -0.5, bunkers: [{ x: 0.24, y: 0.46, r: 34 }, { x: 0.78, y: 0.36, r: 36 }], water: [], sky: "day" },
    { name: "더블 벙커", par: 4, len: 1600, fairW: 112, greenR: 82, dogleg: 0.05, wind: 0.25, bunkers: [{ x: 0.32, y: 0.5, r: 46 }, { x: 0.68, y: 0.5, r: 46 }, { x: 0.5, y: 0.22, r: 36 }], water: [], sky: "sunset" },
    { name: "석양 파5", par: 5, len: 2280, fairW: 118, greenR: 90, dogleg: 0.12, wind: -0.6, bunkers: [{ x: 0.3, y: 0.62, r: 40 }, { x: 0.7, y: 0.48, r: 38 }, { x: 0.42, y: 0.24, r: 34 }], water: [{ x: 0.55, y: 0.36, w: 0.28, h: 0.1 }], sky: "sunset" },
    { name: "바람 언덕", par: 4, len: 1580, fairW: 108, greenR: 80, dogleg: 0.07, wind: 0.9, bunkers: [{ x: 0.5, y: 0.44, r: 50 }], water: [], sky: "sunset" },
    { name: "아일랜드 그린", par: 3, len: 1100, fairW: 94, greenR: 68, dogleg: 0, wind: -0.4, island: true, bunkers: [], water: [{ x: 0.1, y: 0.16, w: 0.8, h: 0.3 }], sky: "sunset" },
    { name: "숲속 도그레그", par: 4, len: 1720, fairW: 96, greenR: 78, dogleg: -0.2, wind: 0.3, bunkers: [{ x: 0.28, y: 0.4, r: 36 }], water: [{ x: 0.6, y: 0.52, w: 0.24, h: 0.1 }], sky: "forest" },
    { name: "시냇물 파4", par: 4, len: 1550, fairW: 114, greenR: 82, dogleg: 0.04, wind: -0.2, bunkers: [{ x: 0.7, y: 0.3, r: 34 }], water: [{ x: 0.2, y: 0.45, w: 0.18, h: 0.22 }, { x: 0.55, y: 0.58, w: 0.22, h: 0.12 }], sky: "forest" },
    { name: "챔피언십 파5", par: 5, len: 2420, fairW: 120, greenR: 92, dogleg: 0.1, wind: 0.7, bunkers: [{ x: 0.28, y: 0.65, r: 42 }, { x: 0.72, y: 0.52, r: 40 }, { x: 0.38, y: 0.32, r: 36 }, { x: 0.64, y: 0.18, r: 34 }], water: [{ x: 0.48, y: 0.4, w: 0.26, h: 0.1 }], sky: "forest" },
    { name: "야간 파3", par: 3, len: 980, fairW: 102, greenR: 72, dogleg: 0, wind: 0.15, bunkers: [{ x: 0.35, y: 0.32, r: 32 }, { x: 0.68, y: 0.28, r: 30 }], water: [], sky: "night" },
    { name: "야간 스네이크", par: 4, len: 1780, fairW: 100, greenR: 78, dogleg: 0.22, wind: -0.75, bunkers: [{ x: 0.55, y: 0.5, r: 44 }], water: [{ x: 0.15, y: 0.35, w: 0.22, h: 0.14 }], sky: "night" },
    { name: "사막 벙커밭", par: 4, len: 1650, fairW: 116, greenR: 80, dogleg: -0.06, wind: 1.05, bunkers: [{ x: 0.3, y: 0.55, r: 48 }, { x: 0.7, y: 0.45, r: 46 }, { x: 0.45, y: 0.28, r: 42 }, { x: 0.58, y: 0.18, r: 36 }], water: [], sky: "desert" },
    { name: "최종 도그레그", par: 5, len: 2360, fairW: 108, greenR: 86, dogleg: -0.16, wind: -0.85, bunkers: [{ x: 0.32, y: 0.6, r: 40 }, { x: 0.7, y: 0.42, r: 42 }, { x: 0.5, y: 0.22, r: 38 }], water: [{ x: 0.2, y: 0.48, w: 0.24, h: 0.12 }], sky: "desert" },
    { name: "그랜드 피니시", par: 5, len: 2500, fairW: 112, greenR: 88, dogleg: 0.14, wind: 0.95, island: false, bunkers: [{ x: 0.26, y: 0.68, r: 44 }, { x: 0.74, y: 0.55, r: 42 }, { x: 0.4, y: 0.36, r: 40 }, { x: 0.62, y: 0.2, r: 36 }], water: [{ x: 0.48, y: 0.42, w: 0.3, h: 0.12 }, { x: 0.15, y: 0.25, w: 0.2, h: 0.1 }], sky: "night" },
    { name: "새벽 파3", par: 3, len: 1000, fairW: 110, greenR: 76, dogleg: 0, wind: 0.3, bunkers: [{ x: 0.4, y: 0.34, r: 32 }, { x: 0.64, y: 0.28, r: 28 }], water: [], sky: "day" },
    { name: "완만한 파4", par: 4, len: 1620, fairW: 120, greenR: 82, dogleg: 0.08, wind: -0.25, bunkers: [{ x: 0.3, y: 0.5, r: 38 }, { x: 0.7, y: 0.32, r: 36 }], water: [], sky: "day" },
    { name: "좌측 강변", par: 4, len: 1700, fairW: 104, greenR: 78, dogleg: -0.15, wind: 0.4, bunkers: [{ x: 0.68, y: 0.46, r: 40 }], water: [{ x: 0.12, y: 0.4, w: 0.22, h: 0.28 }], sky: "day" },
    { name: "트윈 레이크", par: 5, len: 2300, fairW: 116, greenR: 86, dogleg: 0.1, wind: -0.55, bunkers: [{ x: 0.36, y: 0.58, r: 40 }, { x: 0.64, y: 0.3, r: 36 }], water: [{ x: 0.18, y: 0.52, w: 0.24, h: 0.12 }, { x: 0.58, y: 0.38, w: 0.26, h: 0.1 }], sky: "day" },
    { name: "좁은 파3", par: 3, len: 1080, fairW: 92, greenR: 70, dogleg: 0, wind: 0.65, bunkers: [{ x: 0.28, y: 0.3, r: 34 }, { x: 0.72, y: 0.3, r: 34 }], water: [{ x: 0.2, y: 0.48, w: 0.6, h: 0.1 }], sky: "sunset" },
    { name: "석양 스네이크", par: 4, len: 1750, fairW: 98, greenR: 76, dogleg: 0.2, wind: -0.7, bunkers: [{ x: 0.5, y: 0.48, r: 44 }, { x: 0.32, y: 0.28, r: 34 }], water: [], sky: "sunset" },
    { name: "크로스윈드", par: 4, len: 1680, fairW: 106, greenR: 80, dogleg: -0.1, wind: 1.1, bunkers: [{ x: 0.34, y: 0.52, r: 42 }, { x: 0.7, y: 0.38, r: 40 }, { x: 0.5, y: 0.2, r: 34 }], water: [], sky: "sunset" },
    { name: "석양 파5 롱", par: 5, len: 2450, fairW: 114, greenR: 88, dogleg: 0.14, wind: -0.8, bunkers: [{ x: 0.28, y: 0.66, r: 42 }, { x: 0.72, y: 0.5, r: 40 }, { x: 0.45, y: 0.28, r: 36 }], water: [{ x: 0.5, y: 0.4, w: 0.28, h: 0.1 }], sky: "sunset" },
    { name: "숲 입구", par: 3, len: 1120, fairW: 96, greenR: 72, dogleg: 0.05, wind: 0.35, bunkers: [{ x: 0.38, y: 0.36, r: 34 }], water: [{ x: 0.55, y: 0.42, w: 0.28, h: 0.14 }], sky: "forest" },
    { name: "숲길 도그레그", par: 4, len: 1800, fairW: 94, greenR: 76, dogleg: -0.22, wind: -0.45, bunkers: [{ x: 0.3, y: 0.44, r: 38 }, { x: 0.66, y: 0.26, r: 34 }], water: [{ x: 0.58, y: 0.55, w: 0.22, h: 0.1 }], sky: "forest" },
    { name: "계곡 파4", par: 4, len: 1640, fairW: 90, greenR: 74, dogleg: 0.12, wind: 0.85, bunkers: [{ x: 0.26, y: 0.5, r: 36 }, { x: 0.74, y: 0.4, r: 38 }, { x: 0.5, y: 0.22, r: 32 }], water: [], sky: "forest" },
    { name: "숲속 파5", par: 5, len: 2480, fairW: 110, greenR: 90, dogleg: -0.12, wind: 0.6, bunkers: [{ x: 0.3, y: 0.64, r: 42 }, { x: 0.7, y: 0.48, r: 40 }, { x: 0.4, y: 0.3, r: 36 }, { x: 0.62, y: 0.16, r: 32 }], water: [{ x: 0.45, y: 0.42, w: 0.26, h: 0.1 }], sky: "forest" },
    { name: "달빛 파3", par: 3, len: 1060, fairW: 100, greenR: 70, dogleg: 0, wind: -0.5, bunkers: [{ x: 0.32, y: 0.34, r: 34 }, { x: 0.7, y: 0.3, r: 32 }], water: [], sky: "night" },
    { name: "야간 협곡", par: 4, len: 1820, fairW: 92, greenR: 74, dogleg: 0.24, wind: 0.95, bunkers: [{ x: 0.52, y: 0.5, r: 46 }, { x: 0.28, y: 0.32, r: 34 }], water: [{ x: 0.14, y: 0.4, w: 0.2, h: 0.16 }], sky: "night" },
    { name: "별빛 페어웨이", par: 4, len: 1720, fairW: 102, greenR: 78, dogleg: -0.08, wind: -1.0, bunkers: [{ x: 0.35, y: 0.55, r: 42 }, { x: 0.68, y: 0.36, r: 40 }, { x: 0.48, y: 0.2, r: 34 }], water: [], sky: "night" },
    { name: "야간 챔피언", par: 5, len: 2520, fairW: 108, greenR: 86, dogleg: 0.16, wind: 0.9, bunkers: [{ x: 0.28, y: 0.68, r: 44 }, { x: 0.72, y: 0.52, r: 42 }, { x: 0.42, y: 0.34, r: 38 }, { x: 0.6, y: 0.18, r: 34 }], water: [{ x: 0.5, y: 0.44, w: 0.28, h: 0.1 }], sky: "night" },
    { name: "사막 파3", par: 3, len: 1140, fairW: 108, greenR: 72, dogleg: 0, wind: 1.15, bunkers: [{ x: 0.3, y: 0.36, r: 40 }, { x: 0.7, y: 0.36, r: 40 }, { x: 0.5, y: 0.22, r: 34 }], water: [], sky: "desert" },
    { name: "모래바람", par: 4, len: 1700, fairW: 112, greenR: 78, dogleg: -0.1, wind: 1.2, bunkers: [{ x: 0.28, y: 0.58, r: 48 }, { x: 0.72, y: 0.48, r: 46 }, { x: 0.42, y: 0.3, r: 42 }, { x: 0.6, y: 0.18, r: 38 }], water: [], sky: "desert" },
    { name: "오아시스", par: 4, len: 1780, fairW: 100, greenR: 76, dogleg: 0.18, wind: -1.05, bunkers: [{ x: 0.5, y: 0.46, r: 44 }], water: [{ x: 0.2, y: 0.55, w: 0.22, h: 0.12 }, { x: 0.58, y: 0.32, w: 0.24, h: 0.1 }], sky: "desert" },
    { name: "사막 파5", par: 5, len: 2550, fairW: 110, greenR: 84, dogleg: -0.14, wind: 1.1, bunkers: [{ x: 0.3, y: 0.66, r: 44 }, { x: 0.7, y: 0.5, r: 42 }, { x: 0.38, y: 0.32, r: 40 }, { x: 0.64, y: 0.18, r: 36 }], water: [{ x: 0.48, y: 0.4, w: 0.26, h: 0.1 }], sky: "desert" },
    { name: "아일랜드 리턴", par: 3, len: 1180, fairW: 90, greenR: 66, dogleg: 0, wind: 0.7, island: true, bunkers: [{ x: 0.5, y: 0.28, r: 28 }], water: [{ x: 0.08, y: 0.14, w: 0.84, h: 0.34 }], sky: "day" },
    { name: "더블 워터", par: 4, len: 1760, fairW: 104, greenR: 78, dogleg: 0.1, wind: -0.65, bunkers: [{ x: 0.36, y: 0.42, r: 36 }], water: [{ x: 0.15, y: 0.58, w: 0.7, h: 0.1 }, { x: 0.2, y: 0.32, w: 0.6, h: 0.08 }], sky: "day" },
    { name: "니들로 아이", par: 4, len: 1580, fairW: 84, greenR: 70, dogleg: -0.06, wind: 0.8, bunkers: [{ x: 0.24, y: 0.5, r: 36 }, { x: 0.76, y: 0.5, r: 36 }, { x: 0.5, y: 0.26, r: 40 }], water: [], sky: "sunset" },
    { name: "허리케인", par: 5, len: 2580, fairW: 106, greenR: 82, dogleg: 0.2, wind: -1.25, bunkers: [{ x: 0.3, y: 0.7, r: 44 }, { x: 0.7, y: 0.55, r: 42 }, { x: 0.4, y: 0.36, r: 40 }, { x: 0.62, y: 0.2, r: 36 }], water: [{ x: 0.48, y: 0.45, w: 0.3, h: 0.1 }], sky: "sunset" },
    { name: "미스트 파3", par: 3, len: 1200, fairW: 94, greenR: 68, dogleg: 0, wind: 1.0, bunkers: [{ x: 0.34, y: 0.32, r: 36 }, { x: 0.68, y: 0.32, r: 36 }], water: [{ x: 0.18, y: 0.5, w: 0.64, h: 0.12 }], sky: "forest" },
    { name: "트위스트 숲", par: 4, len: 1880, fairW: 88, greenR: 72, dogleg: -0.26, wind: 0.75, bunkers: [{ x: 0.32, y: 0.48, r: 40 }, { x: 0.7, y: 0.34, r: 38 }], water: [{ x: 0.55, y: 0.58, w: 0.24, h: 0.1 }], sky: "forest" },
    { name: "어둠의 도그레그", par: 4, len: 1850, fairW: 96, greenR: 74, dogleg: 0.25, wind: -1.15, bunkers: [{ x: 0.55, y: 0.52, r: 48 }, { x: 0.3, y: 0.3, r: 36 }, { x: 0.72, y: 0.22, r: 34 }], water: [{ x: 0.12, y: 0.38, w: 0.22, h: 0.14 }], sky: "night" },
    { name: "나이트메어 파5", par: 5, len: 2620, fairW: 104, greenR: 84, dogleg: -0.18, wind: 1.2, bunkers: [{ x: 0.26, y: 0.7, r: 46 }, { x: 0.74, y: 0.55, r: 44 }, { x: 0.4, y: 0.38, r: 40 }, { x: 0.62, y: 0.2, r: 38 }], water: [{ x: 0.48, y: 0.46, w: 0.3, h: 0.1 }, { x: 0.14, y: 0.28, w: 0.2, h: 0.1 }], sky: "night" },
    { name: "사하라 게이트", par: 4, len: 1800, fairW: 100, greenR: 74, dogleg: 0.12, wind: 1.3, bunkers: [{ x: 0.28, y: 0.6, r: 50 }, { x: 0.72, y: 0.48, r: 48 }, { x: 0.4, y: 0.3, r: 44 }, { x: 0.62, y: 0.18, r: 40 }], water: [], sky: "desert" },
    { name: "미라지 파5", par: 5, len: 2680, fairW: 102, greenR: 82, dogleg: -0.2, wind: -1.3, bunkers: [{ x: 0.3, y: 0.68, r: 46 }, { x: 0.7, y: 0.52, r: 44 }, { x: 0.38, y: 0.34, r: 42 }, { x: 0.64, y: 0.18, r: 38 }], water: [{ x: 0.46, y: 0.42, w: 0.28, h: 0.1 }], sky: "desert" },
    { name: "파이널 아일랜드", par: 3, len: 1240, fairW: 86, greenR: 64, dogleg: 0, wind: 1.15, island: true, bunkers: [{ x: 0.42, y: 0.26, r: 30 }, { x: 0.6, y: 0.26, r: 30 }], water: [{ x: 0.06, y: 0.12, w: 0.88, h: 0.36 }], sky: "night" },
    { name: "그랜드 챔피언", par: 5, len: 2750, fairW: 100, greenR: 86, dogleg: 0.22, wind: 1.35, bunkers: [{ x: 0.24, y: 0.72, r: 48 }, { x: 0.76, y: 0.58, r: 46 }, { x: 0.38, y: 0.4, r: 42 }, { x: 0.64, y: 0.26, r: 40 }, { x: 0.5, y: 0.14, r: 36 }], water: [{ x: 0.46, y: 0.48, w: 0.32, h: 0.1 }, { x: 0.12, y: 0.3, w: 0.22, h: 0.1 }], sky: "night" },
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    all: document.getElementById("allclear"),
  };
  const powerBar = document.getElementById("power-bar");
  const powerFill = document.getElementById("power-fill");
  const clubButtons = [...document.querySelectorAll(".club")];

  const imgs = { ball: null, flag: null, club: null, hole: null, mascot: null };

  let state = "title";
  let holeIndex = 0;
  let totalStrokes = 0;
  let strokes = 0;
  let starsGot = 0;
  let totalStars = 0;
  let course = null;
  let stars = [];
  let windAmp = 0;
  let windPhase = 0;
  let ball = { x: 0, y: 0, vx: 0, vy: 0 };
  let lastSafe = { x: 0, y: 0 };
  let camY = 0;
  let clubId = "driver";
  let dragging = false;
  let dragPt = null;
  let aimPower = 0;
  let sinkT = 0;
  let particles = [];
  let floats = [];
  let trails = [];
  let screenShake = 0;
  let shotGlow = 0;
  let last = 0;
  let raf = 0;
  let wasMoving = false;
  let clubLocked = false;

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
  }

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    // pure / near magenta
    if (r > 220 && g < 40 && b > 220) return true;
    if (r > 185 && b > 175 && g < 145 && r + b > g * 2.1) return true;
    if (r > 210 && b > 200 && g < 160 && Math.abs(r - b) < 90) return true;
    // soft pink studio wash from generated assets
    if (r > 220 && g > 160 && b > 190 && r > g + 20 && b > g + 10 && (r + g + b) / 3 > 195) return true;
    if (r > 230 && g > 190 && b > 210 && Math.abs(r - b) < 50) return true;
    if (r > 235 && g > 210 && b > 225) return true;
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
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) d[i + 3] = 0;
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function loadAssets() {
    return Promise.all(
      Object.keys(imgs).map(
        (key) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              imgs[key] = punchBg(img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/${key}.png`;
          })
      )
    );
  }

  function yardage() {
    return Math.max(0, Math.round(Math.hypot(ball.x - course.cup.x, ball.y - course.cup.y) / PX_PER_YARD));
  }

  function suggestClub() {
    const d = yardage();
    if (d >= 145) return "driver";
    if (d >= 60) return "iron";
    if (d >= 16) return "wedge";
    return "putter";
  }

  function setClub(id, manual = false) {
    if (!CLUBS[id]) return;
    clubId = id;
    clubButtons.forEach((btn) => btn.classList.toggle("on", btn.dataset.club === id));
    if (manual) {
      clubLocked = true;
      addFloat(ball.x, ball.y - 28, CLUBS[id].label, "#ffe066");
    }
  }

  function fairwayCenterX(y) {
    const t = 1 - y / course.len;
    return W / 2 + Math.sin(t * Math.PI * 1.15) * course.dogleg * W + Math.sin(t * 4.2) * 10;
  }

  function fairwayHalf(y) {
    const t = 1 - y / course.len;
    const greenNear = Math.max(0, 1 - Math.abs(y - course.cup.y) / (course.greenR * 2.4));
    return course.fairW * 0.5 * (0.82 + t * 0.28) + greenNear * 18;
  }

  function inEllipse(px, py, cx, cy, rx, ry) {
    const dx = (px - cx) / rx;
    const dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  function surfaceAt(x, y) {
    if (y < 40 || y > course.len - 20 || x < 18 || x > W - 18) return "oob";
    if (inEllipse(x, y, course.cup.x, course.cup.y, course.greenR * 1.05, course.greenR * 0.86)) return "green";
    for (const b of course.bunkers) {
      if (Math.hypot(x - b.x, y - b.y) < b.r) return "sand";
    }
    for (const w of course.water) {
      if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return "water";
    }
    const cx = fairwayCenterX(y);
    const half = fairwayHalf(y);
    if (Math.abs(x - cx) <= half) return "fairway";
    if (Math.abs(x - cx) <= half + 54) return "rough";
    return "oob";
  }

  function buildHole(index) {
    const src = HOLES[index];
    const bunkers = src.bunkers.map((b) => ({
      x: b.x * W,
      y: b.y * src.len,
      r: b.r,
    }));
    const water = src.water.map((w) => ({
      x: w.x * W,
      y: w.y * src.len,
      w: w.w * W,
      h: w.h * src.len,
    }));
    const cup = {
      x: fairwayCenterXAt(src, src.len * 0.14),
      y: src.len * 0.14,
    };
    if (src.island) {
      cup.x = W / 2;
      cup.y = src.len * 0.22;
    }
    const teeY = src.len - 90;
    const tee = {
      x: fairwayCenterXAt(src, teeY),
      y: teeY,
    };
    return {
      ...src,
      bunkers,
      water,
      cup,
      tee,
      trees: makeTrees(src, bunkers, water, tee, cup),
    };
  }

  function fairwayCenterXAt(src, y) {
    const t = 1 - y / src.len;
    return W / 2 + Math.sin(t * Math.PI * 1.15) * src.dogleg * W + Math.sin(t * 4.2) * 10;
  }

  function makeTrees(src, bunkers, water, tee, cup) {
    const trees = [];
    const rand = mulberry32(1200 + holeIndex * 97);
    for (let i = 0; i < 26; i += 1) {
      const y = 80 + rand() * (src.len - 160);
      const side = rand() < 0.5 ? -1 : 1;
      const cx = fairwayCenterXAt(src, y);
      const half = src.fairW * 0.5 + 70 + rand() * 40;
      const x = cx + side * half;
      if (Math.hypot(x - cup.x, y - cup.y) < src.greenR + 40) continue;
      if (Math.hypot(x - tee.x, y - tee.y) < 70) continue;
      trees.push({ x, y, s: 0.75 + rand() * 0.55 });
    }
    return trees;
  }

  function mulberry32(a) {
    return function rand() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeStars(src, tee, cup) {
    const list = [];
    const rand = mulberry32(4400 + holeIndex * 61);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i += 1) {
      const t = 0.22 + rand() * 0.55;
      const y = src.len * t;
      const cx = fairwayCenterXAt(src, y);
      const x = cx + (rand() - 0.5) * src.fairW * 0.55;
      if (Math.hypot(x - cup.x, y - cup.y) < src.greenR + 30) continue;
      if (Math.hypot(x - tee.x, y - tee.y) < 80) continue;
      list.push({ x, y, got: false, spin: rand() * Math.PI * 2 });
    }
    return list;
  }

  function windLabel(w) {
    const a = Math.abs(w);
    if (a < 0.15) return "고요";
    const dir = w > 0 ? "→" : "←";
    if (a < 0.4) return `${dir} 약풍`;
    if (a < 0.75) return `${dir} 중풍`;
    return `${dir} 강풍`;
  }

  function parseHole(index) {
    holeIndex = index;
    course = buildHole(index);
    stars = makeStars(HOLES[index], course.tee, course.cup);
    starsGot = 0;
    windAmp = HOLES[index].wind || 0;
    windPhase = Math.random() * Math.PI * 2;
    ball = { x: course.tee.x, y: course.tee.y, vx: 0, vy: 0 };
    lastSafe = { x: course.tee.x, y: course.tee.y };
    camY = ball.y - H * 0.68;
    strokes = 0;
    sinkT = 0;
    particles = [];
    floats = [];
    trails = [];
    screenShake = 0;
    shotGlow = 0;
    wasMoving = false;
    clubLocked = false;
    setClub(suggestClub());
    updateHud();
  }

  function updateHud() {
    const hole = HOLES[holeIndex];
    document.getElementById("hud-hole").textContent = String(holeIndex + 1);
    document.getElementById("hud-strokes").textContent = String(strokes);
    document.getElementById("hud-par").textContent = String(hole.par);
    document.getElementById("hud-total").textContent = String(totalStrokes + strokes);
    document.getElementById("hud-name").textContent = hole.name;
    document.getElementById("hud-dist").textContent = String(yardage());
    document.getElementById("hud-wind").textContent = windLabel(windAmp);
    document.getElementById("hud-stars").textContent = String(totalStars + starsGot);
  }

  function updateCamera(dt) {
    const target = ball.y - H * 0.62;
    camY += (target - camY) * Math.min(1, dt * 5.5);
    camY = Math.max(-40, Math.min(course.len - H + 40, camY));
  }

  function ballSpeed() {
    return Math.hypot(ball.vx, ball.vy);
  }

  function ballMoving() {
    return ballSpeed() > 0.07;
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1.15, vy: -0.85 });
  }

  function addSpark(x, y, n = 14) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.4 + Math.random() * 3.4;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.35,
        color: ["#fff", "#ffe066", "#9af2cf", "#ff9ec4"][Math.floor(Math.random() * 4)],
        size: 2 + Math.random() * 3.2,
      });
    }
  }

  function resetFromHazard(label) {
    strokes += 1;
    ball.x = lastSafe.x;
    ball.y = lastSafe.y;
    ball.vx = 0;
    ball.vy = 0;
    addFloat(ball.x, ball.y - 24, `${label} +1`, "#5bbcff");
    setClub(suggestClub());
    updateHud();
  }

  function trySink(dt) {
    const d = Math.hypot(ball.x - course.cup.x, ball.y - course.cup.y);
    const onGreen = surfaceAt(ball.x, ball.y) === "green";
    const maxEnter = clubId === "putter" || onGreen ? 3.1 : 1.5;
    if (d < HOLE_R + 2 && ballSpeed() < maxEnter) {
      sinkT += dt;
      const pull = Math.min(1, sinkT * 3.2);
      ball.x += (course.cup.x - ball.x) * pull * dt * 4.5;
      ball.y += (course.cup.y - ball.y) * pull * dt * 4.5;
      ball.vx *= 0.82;
      ball.vy *= 0.82;
      if (sinkT > 0.4 && d < 5) {
        holeCleared();
      }
      return true;
    }
    sinkT = 0;
    return false;
  }

  function holeCleared() {
    totalStrokes += strokes;
    totalStars += starsGot;
    ball.vx = 0;
    ball.vy = 0;
    state = "clear";
    const hole = HOLES[holeIndex];
    const diff = strokes - hole.par;
    let msg = "파!";
    if (strokes === 1) msg = "홀인원!";
    else if (diff <= -2) msg = "이글!";
    else if (diff === -1) msg = "버디!";
    else if (diff === 1) msg = "보기";
    else if (diff >= 2) msg = "더블보기+";
    document.getElementById("clear-title").textContent = `${hole.name} ${msg}`;
    document.getElementById("clear-detail").textContent =
      `${strokes}타 (파 ${hole.par}) · 별 ${starsGot}개 · 합계 ${totalStrokes}타`;
    if (holeIndex >= HOLES.length - 1) {
      document.getElementById("all-detail").textContent =
        `${HOLES.length}홀 완주! 총 ${totalStrokes}타 · 별 ${totalStars}개`;
      showOverlay("all");
    } else {
      showOverlay("clear");
    }
  }

  function shoot() {
    if (!dragPt) return;
    const dx = ball.x - dragPt.x;
    const dy = ball.y - dragPt.y;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    const club = CLUBS[clubId];
    const power = Math.min(club.maxPower, (len / MAX_DRAG) * club.maxPower);
    // slight loft: driver/iron go slightly more forward (up-course)
    let vx = (dx / len) * power;
    let vy = (dy / len) * power;
    if (clubId !== "putter") {
      const toward = Math.atan2(course.cup.y - ball.y, course.cup.x - ball.x);
      const aim = Math.atan2(vy, vx);
      const blend = clubId === "driver" ? 0.08 : clubId === "iron" ? 0.05 : 0.03;
      const ang = aim + (toward - aim) * blend;
      vx = Math.cos(ang) * power;
      vy = Math.sin(ang) * power;
    }
    ball.vx = vx;
    ball.vy = vy;
    strokes += 1;
    lastSafe = { x: ball.x, y: ball.y };
    screenShake = 0.12 + Math.min(0.18, power / 90);
    shotGlow = 0.45;
    addSpark(ball.x, ball.y, 16);
    addFloat(ball.x, ball.y - 26, club.label, "#fff");
    updateHud();
  }

  function updatePhysics(dt) {
    if (state !== "play") return;
    if (!ballMoving() && sinkT === 0) {
      if (wasMoving) {
        clubLocked = false;
        setClub(suggestClub());
        updateHud();
      }
      wasMoving = false;
      return;
    }
    wasMoving = true;
    if (trySink(dt)) return;

    windPhase += dt * 1.4;
    const windNow = windAmp * (0.75 + 0.25 * Math.sin(windPhase));
    if (clubId !== "putter" || ballSpeed() > 2.2) {
      ball.vx += windNow * 0.045 * dt * 60;
    }

    // substeps for fast driver shots
    const steps = Math.max(1, Math.ceil(ballSpeed() / 8));
    const stepDt = 1 / steps;
    for (let i = 0; i < steps; i += 1) {
      ball.x += ball.vx * stepDt;
      ball.y += ball.vy * stepDt;
      trails.push({ x: ball.x, y: ball.y, life: 0.32, r: 3.5 });

      for (const st of stars) {
        if (st.got) continue;
        if (Math.hypot(ball.x - st.x, ball.y - st.y) < 18) {
          st.got = true;
          starsGot += 1;
          addSpark(st.x, st.y, 12);
          addFloat(st.x, st.y - 18, "★ +1", "#ffe066");
          updateHud();
        }
      }

      const surf = surfaceAt(ball.x, ball.y);
      let friction = 0.985;
      if (surf === "fairway") friction = 0.982;
      if (surf === "green") friction = clubId === "putter" ? 0.968 : 0.975;
      if (surf === "rough") friction = 0.945;
      if (surf === "sand") friction = 0.9;
      if (surf === "water" || surf === "oob") friction = 0.88;
      friction *= CLUBS[clubId].friction;
      ball.vx *= Math.pow(friction, stepDt);
      ball.vy *= Math.pow(friction, stepDt);

      // soft bounce from out of bounds / trees band
      if (ball.x < 24 || ball.x > W - 24) {
        ball.vx *= -0.55;
        ball.x = Math.max(24, Math.min(W - 24, ball.x));
      }
      if (ball.y < 50) {
        ball.vy *= -0.4;
        ball.y = 50;
      }
      if (ball.y > course.len - 30) {
        ball.vy *= -0.4;
        ball.y = course.len - 30;
      }

      if ((surf === "water" || surf === "oob") && ballSpeed() < 1.6) {
        resetFromHazard(surf === "water" ? "워터해저드" : "OB");
        return;
      }
      if (surf !== "water" && surf !== "oob") {
        lastSafe = { x: ball.x, y: ball.y };
      }
    }

    if (ballSpeed() < 0.055) {
      ball.vx = 0;
      ball.vy = 0;
    }
  }

  function worldToScreen(x, y) {
    return { x, y: y - camY };
  }

  function drawSky() {
    const sky = (course && course.sky) || "day";
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (sky === "sunset") {
      g.addColorStop(0, "#ff9a6b");
      g.addColorStop(0.28, "#ffd1a8");
      g.addColorStop(0.36, "#5fbf63");
      g.addColorStop(1, "#2f8d4a");
    } else if (sky === "night") {
      g.addColorStop(0, "#1a2744");
      g.addColorStop(0.3, "#2c4068");
      g.addColorStop(0.36, "#3d8f52");
      g.addColorStop(1, "#24633a");
    } else if (sky === "desert") {
      g.addColorStop(0, "#7ec8ff");
      g.addColorStop(0.28, "#ffe2a8");
      g.addColorStop(0.36, "#c9d66b");
      g.addColorStop(1, "#9bb04a");
    } else if (sky === "forest") {
      g.addColorStop(0, "#8fd0ff");
      g.addColorStop(0.3, "#c8f0d8");
      g.addColorStop(0.36, "#4fb85a");
      g.addColorStop(1, "#247a3a");
    } else {
      g.addColorStop(0, "#D0F0FD");
      g.addColorStop(0.32, "#E8FAF0");
      g.addColorStop(0.36, "#7ED89A");
      g.addColorStop(1, "#4CB86A");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (sky === "night") {
      ctx.fillStyle = "rgba(255,255,220,0.75)";
      for (let i = 0; i < 18; i += 1) {
        const sx = (i * 73 + 20) % W;
        const sy = ((i * 41 + camY * 0.05) % 120) + 10;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2 + (i % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = sky === "sunset" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.35)";
      for (let i = 0; i < 4; i += 1) {
        const cy = ((i * 90 - camY * 0.08) % 180) + 30;
        ctx.beginPath();
        ctx.ellipse(50 + i * 95, cy, 34, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStars() {
    for (const st of stars) {
      if (st.got) continue;
      const s = worldToScreen(st.x, st.y);
      if (s.y < -20 || s.y > H + 20) continue;
      st.spin += 0.04;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(st.spin);
      ctx.fillStyle = "#ffe066";
      ctx.shadowColor = "rgba(255,220,80,0.55)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? 9 : 4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRoughBand() {
    const startY = Math.max(0, Math.floor(camY / 20) * 20 - 40);
    const endY = Math.min(course.len, camY + H + 40);
    for (let y = startY; y < endY; y += 20) {
      const s = worldToScreen(0, y);
      ctx.fillStyle = (Math.floor(y / 20) % 2 === 0) ? "#4eab55" : "#49a350";
      ctx.fillRect(0, s.y, W, 20);
      ctx.fillStyle = "rgba(30,90,40,0.08)";
      ctx.fillRect(0, s.y + 4, W, 3);
    }
  }

  function drawFairway() {
    const startY = Math.max(40, camY - 40);
    const endY = Math.min(course.len - 20, camY + H + 40);
    ctx.beginPath();
    for (let y = startY; y <= endY; y += 10) {
      const cx = fairwayCenterX(y);
      const half = fairwayHalf(y);
      const s = worldToScreen(cx - half, y);
      if (y === startY) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    for (let y = endY; y >= startY; y -= 10) {
      const cx = fairwayCenterX(y);
      const half = fairwayHalf(y);
      const s = worldToScreen(cx + half, y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#7edc70");
    g.addColorStop(0.5, "#8bec7c");
    g.addColorStop(1, "#74d468");
    ctx.fillStyle = g;
    ctx.fill();

    // mower stripes
    ctx.save();
    ctx.clip();
    for (let y = startY; y < endY; y += 28) {
      const s = worldToScreen(0, y);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(0, s.y, W, 12);
    }
    ctx.restore();
  }

  function drawGreen() {
    const s = worldToScreen(course.cup.x, course.cup.y);
    const g = ctx.createRadialGradient(s.x, s.y, 8, s.x, s.y, course.greenR);
    g.addColorStop(0, "#9af28a");
    g.addColorStop(0.7, "#6ed862");
    g.addColorStop(1, "#57c255");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, course.greenR * 1.05, course.greenR * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawHazards() {
    for (const w of course.water) {
      const s = worldToScreen(w.x, w.y);
      const g = ctx.createLinearGradient(s.x, s.y, s.x, s.y + w.h);
      g.addColorStop(0, "#63d8ff");
      g.addColorStop(1, "#1f82d4");
      ctx.fillStyle = g;
      roundRect(s.x, s.y, w.w, w.h, 18);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x + 8, s.y + w.h * 0.35);
      ctx.quadraticCurveTo(s.x + w.w * 0.5, s.y + w.h * 0.15, s.x + w.w - 8, s.y + w.h * 0.4);
      ctx.stroke();
    }
    for (const b of course.bunkers) {
      const s = worldToScreen(b.x, b.y);
      const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, b.r);
      g.addColorStop(0, "#f8e3a8");
      g.addColorStop(1, "#d4a45a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, b.r, b.r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTrees() {
    for (const t of course.trees) {
      const s = worldToScreen(t.x, t.y);
      if (s.y < -60 || s.y > H + 60) continue;
      ctx.fillStyle = "rgba(20,50,30,0.2)";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 10, 14 * t.s, 6 * t.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(s.x - 3 * t.s, s.y - 8 * t.s, 6 * t.s, 18 * t.s);
      ctx.fillStyle = "#2f9b4a";
      ctx.beginPath();
      ctx.arc(s.x, s.y - 18 * t.s, 16 * t.s, 0, Math.PI * 2);
      ctx.arc(s.x - 10 * t.s, s.y - 8 * t.s, 12 * t.s, 0, Math.PI * 2);
      ctx.arc(s.x + 10 * t.s, s.y - 8 * t.s, 12 * t.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTeeBox() {
    const s = worldToScreen(course.tee.x, course.tee.y);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRect(s.x - 28, s.y - 16, 56, 32, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "11px Jua";
    ctx.textAlign = "center";
    ctx.fillText("TEE", s.x, s.y + 4);
    ctx.textAlign = "left";
  }

  function drawCup() {
    const s = worldToScreen(course.cup.x, course.cup.y);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 10;
    if (imgs.hole) {
      ctx.drawImage(imgs.hole, s.x - 17, s.y - 17, 34, 34);
    } else {
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.arc(s.x, s.y, HOLE_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (imgs.flag) {
      ctx.drawImage(imgs.flag, s.x - 10, s.y - 74, 42, 74);
    } else {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y - 34);
      ctx.stroke();
      ctx.fillStyle = "#ff6b9d";
      ctx.fillRect(s.x, s.y - 34, 14, 10);
    }
  }

  function drawAim() {
    if (!dragging || !dragPt || ballMoving()) return;
    const b = worldToScreen(ball.x, ball.y);
    const dx = ball.x - dragPt.x;
    const dy = ball.y - dragPt.y;
    const len = Math.min(MAX_DRAG, Math.hypot(dx, dy));
    if (len < 4) return;
    const nx = dx / Math.hypot(dx, dy);
    const ny = dy / Math.hypot(dx, dy);
    aimPower = len / MAX_DRAG;
    const club = CLUBS[clubId];
    const pred = Math.min(club.maxPower, aimPower * club.maxPower) * 18;

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + nx * Math.min(pred, 220), b.y + ny * Math.min(pred, 220));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = aimPower > 0.85 ? "rgba(255,224,102,0.95)" : "rgba(255,107,157,0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + nx * len * 0.9, b.y + ny * len * 0.9);
    ctx.stroke();

    if (imgs.club) {
      ctx.save();
      ctx.translate(b.x - nx * 16, b.y - ny * 16);
      ctx.rotate(Math.atan2(ny, nx) + Math.PI / 2);
      ctx.drawImage(imgs.club, -12, -36, 24, 72);
      ctx.restore();
    }

    powerBar.classList.remove("hidden");
    powerFill.style.width = `${aimPower * 100}%`;
  }

  function drawBall() {
    const s = worldToScreen(ball.x, ball.y);
    const size = BALL_R * 2 + 10;
    ctx.save();
    ctx.fillStyle = "rgba(20,40,50,0.24)";
    ctx.beginPath();
    ctx.ellipse(s.x + 2, s.y + 6, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (shotGlow > 0) {
      ctx.globalAlpha = shotGlow;
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (imgs.ball) {
      ctx.drawImage(imgs.ball, s.x - size / 2, s.y - size / 2, size, size);
    } else {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const t of trails) {
      const s = worldToScreen(t.x, t.y);
      ctx.globalAlpha = Math.max(0, t.life * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    ctx.textAlign = "center";
    for (const f of floats) {
      const s = worldToScreen(f.x, f.y);
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.font = "bold 15px Jua";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, s.x, s.y);
      f.y += f.vy;
      f.life -= 0.016;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function drawMiniMap() {
    const mw = 46;
    const mh = 110;
    const mx = W - mw - 10;
    const my = 78;
    ctx.fillStyle = "rgba(18,35,52,0.72)";
    roundRect(mx, my, mw, mh, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();

    const scale = (mh - 16) / course.len;
    // fairway ribbon
    ctx.strokeStyle = "#7edc70";
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let y = 40; y < course.len; y += 40) {
      const cx = fairwayCenterX(y);
      const px = mx + 8 + (cx / W) * (mw - 16);
      const py = my + mh - 8 - y * scale;
      if (y === 40) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const cupX = mx + 8 + (course.cup.x / W) * (mw - 16);
    const cupY = my + mh - 8 - course.cup.y * scale;
    ctx.fillStyle = "#ff6b9d";
    ctx.beginPath();
    ctx.arc(cupX, cupY, 3, 0, Math.PI * 2);
    ctx.fill();

    const bx = mx + 8 + (ball.x / W) * (mw - 16);
    const by = my + mh - 8 - ball.y * scale;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMascot() {
    if (!imgs.mascot || state !== "play") return;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(imgs.mascot, 8, H - 150, 58, 82);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function draw() {
    ctx.save();
    if (screenShake > 0) {
      const mag = screenShake * 10;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    drawSky();
    if (course) {
      drawRoughBand();
      drawFairway();
      drawHazards();
      drawGreen();
      drawTrees();
      drawTeeBox();
      drawStars();
      drawCup();
      drawParticles();
      drawAim();
      drawBall();
      drawFloats();
      drawMiniMap();
    }
    drawMascot();
    ctx.restore();
    if (!dragging) powerBar.classList.add("hidden");
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (state === "play") {
      updatePhysics(dt);
      updateCamera(dt);
      particles = particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx;
        p.y += p.vy;
        return p.life > 0;
      });
      trails = trails.filter((t) => {
        t.life -= dt;
        t.r += dt * 10;
        return t.life > 0;
      });
      floats = floats.filter((f) => f.life > 0);
      screenShake = Math.max(0, screenShake - dt);
      shotGlow = Math.max(0, shotGlow - dt * 1.8);
      if (!ballMoving()) updateHud();
    } else if (course) {
      updateCamera(dt * 0.4);
    }
    draw();
    raf = requestAnimationFrame(tick);
  }

  function canvasPt(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H + camY,
    };
  }

  function canAim() {
    return state === "play" && !ballMoving() && sinkT === 0;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!canAim()) return;
    // ignore taps on club bar region roughly
    const rect = canvas.getBoundingClientRect();
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    // 클럽 버튼 영역만 피함 (휴대폰에서 조준이 막히지 않게)
    if (sy > H - 58) return;
    e.preventDefault();
    dragging = true;
    dragPt = { x: ball.x, y: ball.y };
    aimPower = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragPt = canvasPt(e);
    aimPower = Math.min(1, Math.hypot(ball.x - dragPt.x, ball.y - dragPt.y) / MAX_DRAG);
  });

  function endDrag() {
    if (!dragging) return;
    shoot();
    dragging = false;
    dragPt = null;
    aimPower = 0;
    powerBar.classList.add("hidden");
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  clubButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state !== "play" || ballMoving()) return;
      setClub(btn.dataset.club, true);
    });
  });

  function startGame(resetAll) {
    if (resetAll) {
      holeIndex = 0;
      totalStrokes = 0;
      totalStars = 0;
    }
    parseHole(holeIndex);
    state = "play";
    showOverlay(null);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  document.getElementById("start-btn").addEventListener("click", () => startGame(true));
  document.getElementById("again-btn").addEventListener("click", () => startGame(true));
  document.getElementById("next-btn").addEventListener("click", () => {
    holeIndex += 1;
    parseHole(holeIndex);
    state = "play";
    showOverlay(null);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });

  loadAssets().then(() => {
    parseHole(0);
    state = "title";
    showOverlay("title");
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });
})();
