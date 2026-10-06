/*
 * 제트스키 썬더 레이스 · 데이터 (레이서 · 테마 · 코스)
 * 코스는 build(b) 로 물길과 물건을 놓는다 (track.js 의 Builder 참고).
 *  거리 단위는 m. x 는 코스 가운데에서 오른쪽이 +.
 */

/* ---------------- 레이서 ---------------- */
export const RACERS = {
  jihyeok: {
    id: "jihyeok",
    name: "지혁",
    en: "JIHYEOK",
    no: "07",
    hull: "sport",
    body: "#ff7a1a",
    trim: "#13b5a8",
    accent: "#ffffff",
    rider: { kind: "kid", helmet: "#ff8a2a", stripe: "#ffffff", visor: "#1d3a5c", suit: "#2d4f9e", vest: "#13b5a8", skin: "#ffd5b3", hair: "#4a2b1d" },
    intro: "Today Game 대표 레이서. 바다 물총 대작전의 그 지혁!",
  },
  sharky: {
    id: "sharky",
    name: "샤키",
    en: "SHARKY",
    no: "22",
    hull: "blade",
    body: "#2f86ea",
    trim: "#ffffff",
    accent: "#0b2f6e",
    rider: { kind: "shark", skin: "#7fa9d6", belly: "#eef6ff", helmet: "#ffffff", stripe: "#2f86ea", visor: "#0b2f6e", vest: "#ffd23f" },
    intro: "코너에서 물러서지 않는 아기 상어 레이서.",
  },
  ruby: {
    id: "ruby",
    name: "루비",
    en: "RUBY",
    no: "05",
    hull: "bubble",
    body: "#ff5fa8",
    trim: "#8a5bff",
    accent: "#ffe066",
    rider: { kind: "girl", helmet: "#ff8cc6", stripe: "#8a5bff", visor: "#3a1d5c", suit: "#8a5bff", vest: "#ffe066", skin: "#ffd9c0", hair: "#7a3b1f" },
    intro: "부스터를 아껴 두었다가 마지막에 터뜨리는 작전가.",
  },
  crab: {
    id: "crab",
    name: "캡틴 크랩",
    en: "CAPT. CRAB",
    no: "13",
    hull: "barge",
    body: "#e8452f",
    trim: "#ffcf4d",
    accent: "#2b2d4a",
    rider: { kind: "crab", shell: "#ff5a3c", hat: "#2b2d4a", vest: "#2b2d4a" },
    intro: "해적 바다에서 온 힘센 선장. 몸으로 밀어붙인다!",
  },
  blitz: {
    id: "blitz",
    name: "블리츠",
    en: "BLITZ",
    no: "99",
    hull: "stand",
    body: "#22283d",
    trim: "#b8ff3a",
    accent: "#6ff7ff",
    rider: { kind: "mohawk", helmet: "#2e3550", stripe: "#b8ff3a", visor: "#6ff7ff", suit: "#22283d", vest: "#b8ff3a", skin: "#f2c39b" },
    intro: "서서 타는 스탠드업 제트스키의 번개 같은 고수.",
  },
};
export const RIVAL_ORDER = ["sharky", "ruby", "crab", "blitz"];

/* ---------------- 테마 (하늘 · 물 · 풍경 색) ---------------- */
export const THEMES = {
  tropical: {
    sky: ["#1b78db", "#4aa9f2", "#9edcff", "#e2f7ff"],
    sun: { x: 0.74, y: 0.3, r: 34, color: "#fff7cf", glow: "255,236,170", rays: true },
    haze: "#c9eefa",
    water: { far: "#86dcee", mid: "#24b7dc", near: "#0d8bcb", deep: "#0a6fae" },
    lane: [150, 255, 240, 0.12],
    foam: "255,255,255",
    rope: ["#ff7a1a", "#ffd23f"],
    fog: [201, 238, 250],
    fogK: 0.0024,
    glitter: 1,
    clouds: "day",
    horizon: "islands",
    shore: "#f4dc9b",
  },
  coral: {
    seed: 21,
    sky: ["#1e86e0", "#58bff5", "#b4ecff", "#eafcff"],
    sun: { x: 0.62, y: 0.22, r: 32, color: "#fffbe0", glow: "255,244,190", rays: true },
    haze: "#d4f6f8",
    water: { far: "#a6f0ee", mid: "#3ad3d6", near: "#13aecb", deep: "#0b86b8" },
    lane: [200, 255, 250, 0.12],
    foam: "255,255,255",
    rope: ["#ff5fa8", "#ffe14a"],
    fog: [212, 246, 246],
    fogK: 0.0022,
    glitter: 1,
    clouds: "day",
    horizon: "atolls",
    farLand: ["#8fd6c8", "#6cc0a8"],
    shore: "#f6e1a6",
    reef: ["#ff7a9c", "#ffb347", "#b37aff", "#3a8f8a", "#ff5a6e"],
  },
  island: {
    seed: 33,
    sky: ["#2a7ee0", "#5cb0f0", "#a9dcf6", "#e6f6ff"],
    sun: { x: 0.28, y: 0.26, r: 32, color: "#fff7d0", glow: "255,236,170", rays: true },
    haze: "#cfeef6",
    water: { far: "#8ad6e6", mid: "#22aed2", near: "#0b7fbe", deep: "#0a64a0" },
    lane: [160, 250, 240, 0.12],
    foam: "255,255,255",
    rope: ["#ffffff", "#ff4d4d"],
    fog: [204, 236, 246],
    fogK: 0.0024,
    glitter: 0.8,
    clouds: "day",
    horizon: "cliffs",
    farLand: ["#6aa890", "#4f9270"],
    shore: "#efd79a",
  },
  pirate: {
    seed: 44,
    sky: ["#3a64b8", "#7e9fd8", "#ffc98a", "#ffe6c0"],
    sun: { x: 0.22, y: 0.5, r: 40, color: "#fff1c0", glow: "255,196,120", rays: true },
    haze: "#ffe2bc",
    water: { far: "#9cc8c8", mid: "#2c8fae", near: "#0f5f90", deep: "#0a4a78" },
    lane: [255, 230, 190, 0.1],
    foam: "255,246,230",
    rope: ["#ffcf4d", "#b8282f"],
    fog: [246, 222, 192],
    fogK: 0.0026,
    glitter: 1.1,
    clouds: "day",
    cloud: ["#fff4e2", "#f6d6b8", "#d9a98a"],
    horizon: "town",
    farLand: ["#8a7a74", "#6a5a58"],
    shore: "#ead090",
  },
  bigwave: {
    seed: 55,
    sky: ["#1670d8", "#3fa0ee", "#9fd8ff", "#e6f7ff"],
    sun: { x: 0.7, y: 0.2, r: 34, color: "#fffbe0", glow: "255,240,190", rays: true },
    haze: "#cfeefa",
    water: { far: "#78cde6", mid: "#1c9ed0", near: "#0a6fb4", deep: "#085b98" },
    lane: [170, 245, 255, 0.11],
    foam: "255,255,255",
    rope: ["#ffffff", "#2f86ea"],
    fog: [206, 236, 250],
    fogK: 0.0024,
    glitter: 1,
    clouds: "day",
    horizon: "open",
    farLand: ["#7aa4b4", "#5f8a9c"],
    shore: "#efd79a",
  },
  storm: {
    seed: 66,
    sky: ["#2a3346", "#4a566e", "#7c879a", "#a9b2c0"],
    sun: null,
    haze: "#9aa5b4",
    water: { far: "#7c8b96", mid: "#355e72", near: "#1f4a5e", deep: "#163a4c" },
    lane: [200, 230, 240, 0.08],
    foam: "235,242,250",
    rope: ["#ffd23f", "#1d2233"],
    fog: [150, 162, 176],
    fogK: 0.0034,
    glitter: 0,
    clouds: "storm",
    cloud: ["#8e98aa", "#6c7688", "#4c5466"],
    horizon: "cliffs",
    farLand: ["#4c5664", "#3c4652"],
    shore: "#b8a888",
    lightning: true,
    weather: { kind: "rain", n: 110 },
    tint: ["#4a5a70", 0.32],
    noGulls: true,
    foamy: true,
  },
  volcano: {
    seed: 77,
    sky: ["#3a2244", "#8a3a4a", "#e8784a", "#ffc890"],
    sun: { x: 0.24, y: 0.62, r: 44, color: "#ffe2a0", glow: "255,150,90", rays: false },
    haze: "#f2a882",
    water: { far: "#c89090", mid: "#5a5476", near: "#2c3456", deep: "#1e2744" },
    lane: [255, 190, 160, 0.09],
    foam: "255,236,226",
    rope: ["#ff7a1a", "#2a2628"],
    fog: [214, 150, 130],
    fogK: 0.003,
    glitter: 0.9,
    clouds: "day",
    cloud: ["#f2b8a0", "#c8807a", "#7a4a58"],
    horizon: "volcano",
    farLand: ["#5a3a48", "#4a2f3a"],
    shore: "#3a3236",
    bigVolcano: true,
    weather: { kind: "ash", n: 46 },
    tint: ["#a85a58", 0.18],
    noGulls: true,
  },
  moon: {
    seed: 88,
    sky: ["#0a1030", "#16245a", "#2a3f7a", "#4a5f9a"],
    sun: { x: 0.72, y: 0.3, r: 30, color: "#f4f6ff", glow: "170,190,255", rays: false },
    moon: true,
    stars: true,
    haze: "#3a4e86",
    water: { far: "#34507e", mid: "#1a3664", near: "#0e2448", deep: "#0a1a36" },
    lane: [120, 220, 255, 0.1],
    foam: "190,220,255",
    rope: ["#7ff3ff", "#ffd98a"],
    glowRope: ["#7ff3ff", "#ffd98a"],
    fog: [44, 62, 110],
    fogK: 0.0042,
    glitter: 0.8,
    clouds: "night",
    cloud: ["#4a5a8a", "#36467a", "#28386a"],
    horizon: "nightIsles",
    farLand: ["#1c2850", "#16204a"],
    shore: "#8a8aa0",
    night: true,
    weather: { kind: "spark", n: 36 },
    tint: ["#1a2a5a", 0.45],
    noGulls: true,
  },
  ice: {
    seed: 99,
    sky: ["#5d8fd0", "#9ec4ec", "#d6ebfa", "#f4faff"],
    sun: { x: 0.3, y: 0.5, r: 30, color: "#fffef0", glow: "255,250,230", rays: false },
    haze: "#e6f4fc",
    water: { far: "#c4e6f2", mid: "#5ab2d8", near: "#2a7cb0", deep: "#1f6496" },
    lane: [230, 250, 255, 0.12],
    foam: "255,255,255",
    rope: ["#2f86ea", "#ffffff"],
    fog: [228, 242, 250],
    fogK: 0.0028,
    glitter: 1.2,
    clouds: "day",
    cloud: ["#ffffff", "#e6eef8", "#c6d4e6"],
    horizon: "ice",
    farLand: ["#cfe4f2", "#b8d6ea"],
    shore: "#f2fbff",
    weather: { kind: "snow", n: 70 },
    noGulls: true,
  },
  deep: {
    seed: 111,
    sky: ["#081830", "#123a5c", "#1f5f7c", "#3a8a9a"],
    sun: { x: 0.55, y: 0.4, r: 28, color: "#d8fff4", glow: "120,255,220", rays: false },
    stars: true,
    haze: "#2a6a7a",
    water: { far: "#2a5a70", mid: "#123c5a", near: "#0a2442", deep: "#061830" },
    lane: [120, 255, 230, 0.08],
    foam: "170,240,230",
    rope: ["#3fd6c6", "#a86bff"],
    glowRope: ["#3fd6c6", "#a86bff"],
    fog: [36, 80, 96],
    fogK: 0.0036,
    glitter: 0.4,
    clouds: "night",
    cloud: ["#2a5a6a", "#1f4a5a", "#16384a"],
    horizon: "open",
    farLand: ["#16384a", "#102a3a"],
    shore: "#3a4a5a",
    deepGlow: true,
    night: true,
    tint: ["#123a5a", 0.35],
    weather: { kind: "spark", n: 40 },
    noGulls: true,
  },
  thunder: {
    seed: 121,
    sky: ["#160f2e", "#2e2650", "#4a3f6e", "#6a5f86"],
    sun: null,
    haze: "#4a4466",
    water: { far: "#4a4f6a", mid: "#24325a", near: "#141f3e", deep: "#0e1630" },
    lane: [200, 200, 255, 0.08],
    foam: "220,225,255",
    rope: ["#ffe14a", "#7c3aff"],
    glowRope: ["#ffe14a", "#7c3aff"],
    fog: [70, 68, 100],
    fogK: 0.0032,
    glitter: 0,
    clouds: "storm",
    cloud: ["#5a5478", "#423c60", "#2e2a48"],
    horizon: "cliffs",
    farLand: ["#2a2840", "#201e34"],
    shore: "#5a5468",
    lightning: true,
    weather: { kind: "rain", n: 130 },
    tint: ["#3a3460", 0.35],
    noGulls: true,
    foamy: true,
  },
  grand: {
    seed: 131,
    sky: ["#1f5fc8", "#5ea0ee", "#ffcf9a", "#fff0d0"],
    sun: { x: 0.5, y: 0.62, r: 46, color: "#fff3c4", glow: "255,200,120", rays: true },
    haze: "#ffe6c0",
    water: { far: "#a8cfe0", mid: "#2f96c8", near: "#0d63a8", deep: "#0a4c88" },
    lane: [255, 240, 200, 0.12],
    foam: "255,250,235",
    rope: ["#ffd23f", "#ff4f6d"],
    fog: [250, 230, 200],
    fogK: 0.0024,
    glitter: 1.4,
    clouds: "day",
    cloud: ["#fff6e6", "#ffdcc0", "#e8b49a"],
    horizon: "town",
    farLand: ["#8a8a9a", "#6a6a80"],
    shore: "#f2dc9a",
    blimp: true,
  },
};

/* ---------------- 코스 ---------------- */
const STARS = (n) => n;

export const COURSES = [
  {
    id: "c01",
    no: 1,
    name: "트로피컬 베이",
    en: "TROPICAL BAY",
    stars: STARS(1),
    theme: "tropical",
    length: 1080,
    seed: 11,
    medals: { bronze: 35.0, silver: 30.8, gold: 28.6 },
    vmax: 33,
    rivals: [0.95, 0.97, 0.99, 1.01],
    music: { bpm: 132, root: 62, scale: "major", prog: "bright", lead: "steel", drums: "island", seed: 41, density: 0.62 },
    tip: "부스터 판을 밟고, 점프대는 가운데로! 오른쪽 해협은 빠르지만 바위가 있어요.",
    gimmicks: ["기본 부스터", "작은 점프대", "첫 지름길"],
    build(b) {
      b.straight(90); // 0 출발 직선
      b.curve(110, 1 / 240); // 90 완만한 오른쪽
      b.straight(60); // 200
      b.curve(120, -1 / 200); // 260 왼쪽
      b.straight(90); // 380
      b.straight(170); // 470 갈림길
      b.curve(120, 1 / 190); // 640 오른쪽
      b.straight(100); // 760
      b.curve(60, -1 / 170); // 860 S자
      b.curve(60, 1 / 170); // 920
      b.straight(100); // 980 → 결승 1080

      b.gate("start", 14);
      b.gate("check", 470);
      b.gate("finish", 1080);
      b.swell(0, 1080, 0.22, 46);

      // 부스터 판 · 부스터 구슬
      b.obj("pad", 150, 1.5);
      b.row("orb", 222, [-3, -3, -3], 11);
      b.obj("pad", 398, 0);
      b.row("orb", 700, [5, 5], 14);
      b.obj("orb", 880, 0);
      b.obj("pad", 992, 2);

      // 점프대
      b.obj("ramp", 428, 0);
      b.obj("bigRamp", 1032, 0);

      // 장애물
      b.row("barrel", 278, [-1.5, 1.2], 4);
      b.obj("rock", 332, 7.5);
      b.obj("rock", 350, 5.5, { v: 1 });
      b.obj("log", 702, -4.5);
      b.obj("log", 905, 4);
      b.row("barrel", 846, [3.5, 5.2], 3);

      // 회전 표시 대형 부표 (안쪽)
      b.obj("pylon", 142, 10.4);
      b.obj("pylon", 318, -10.4);
      b.obj("pylon", 700, 10.4);
      b.obj("pylon", 890, -10.2);
      b.obj("pylon", 952, 10.2);

      // 지름길: 오른쪽 해협 (빠른 물살 + 바위)
      b.split(492, 628, { dw: 6, side: "right", mul: 1.12, hw: 21 });
      b.scen("signShort", 474, 0);
      b.obj("rock", 522, 15.5);
      b.obj("pad", 556, 13.5);
      b.obj("rock", 590, 11.2, { v: 1 });
      b.obj("rock", 604, 16.5);

      // 풍경
      b.scatter(-40, 1500, ["isleBig", "isleBig", "isleTall"], { every: 120, near: [40, 120] });
      b.scatter(20, 1500, ["sandbar", "sandbar", "rockIsle", "sailboat"], { every: 70, near: [12, 34] });
      b.scen("lighthouse", 610, -48);
      b.scen("hutPier", 240, 34);
      b.scen("hutPier", 830, -30, { flip: true });
      b.scen("dolphins", 380, -22);
      b.scen("dolphins", 760, 26);
      b.scen("yacht", 980, -40);
    },
  },
  {
    id: "c02",
    no: 2,
    name: "코랄 러시",
    en: "CORAL RUSH",
    stars: 2,
    theme: "coral",
    length: 1160,
    seed: 23,
    width: 10,
    medals: { bronze: 37.0, silver: 33.3, gold: 31.1 },
    vmax: 33.5,
    rivals: [0.97, 0.99, 1.01, 1.03],
    preview: 200,
    music: { bpm: 128, root: 64, scale: "major", prog: "island", lead: "marimba", drums: "island", seed: 52, density: 0.6 },
    tip: "좁은 산호 통로에서는 가운데로! 왼쪽 산호 틈 지름길은 빠르지만 산호 바위가 막고 있어요.",
    gimmicks: ["좁은 통로", "산호 장애물", "산호 틈 지름길"],
    build(b) {
      b.straight(80); // 0
      b.curve(100, -1 / 200); // 80
      b.straight(50); // 180 좁은 통로 시작
      b.curve(70, 1 / 150); // 230
      b.straight(60); // 300
      b.curve(90, 1 / 180); // 360
      b.straight(160); // 450 갈림길
      b.curve(80, -1 / 160); // 610 S
      b.curve(80, 1 / 160); // 690
      b.straight(90); // 770 점프
      b.curve(100, -1 / 190); // 860
      b.straight(60); // 960 좁은 통로 2
      b.curve(60, 1 / 200); // 1020
      b.straight(80); // 1080 → 결승 1160

      b.gate("start", 14);
      b.gate("check", 452);
      b.gate("finish", 1160);
      b.swell(0, 1160, 0.18, 40);

      // 좁은 산호 통로 1 (190~300): 가장자리 산호 머리 + 가운데 하나
      b.width(195, 300, 6.2, 25);
      for (let z = 196; z <= 296; z += 14) {
        b.obj("reefHead", z, -8.6 - (z % 3) * 0.4, { v: (z % 7) / 7 });
        b.obj("reefHead", z + 7, 8.6 + (z % 2) * 0.4, { v: (z % 5) / 5 });
      }
      b.obj("coral", 252, 1.6, { color: "#ffb347" });
      b.obj("pad", 214, -1.5);
      b.obj("pad", 286, 1.5);

      // 부스터 구슬 · 판
      b.row("orb", 120, [3, 3], 12);
      b.row("orb", 330, [-2.5, -2.5, -2.5], 10);
      b.obj("pad", 390, 2.5);
      b.obj("pad", 730, -3);
      b.row("orb", 900, [2, 2], 12);
      b.obj("pad", 1100, 0);

      // 장애물: 산호 · 산호 바위
      b.obj("coral", 150, -3.5, { color: "#ff7a9c" });
      b.obj("reefHead", 410, 4, { v: 0.2 });
      b.obj("coral", 650, 3.2, { color: "#b37aff" });
      b.obj("reefHead", 700, -3.8, { v: 0.6 });
      b.obj("coral", 880, -3, { color: "#ff5a6e" });

      // 지름길: 왼쪽 산호 틈 (좁고 산호 바위)
      b.split(468, 600, { dw: 7, side: "left", mul: 1.18, hw: 20, decor: "rock" });
      b.scen("signShort", 452, 0, { flip: true });
      b.obj("reefHead", 500, -12.5, { v: 0.3 });
      b.obj("coral", 530, -16.5, { color: "#ffb347" });
      b.obj("pad", 545, -13.5);
      b.obj("reefHead", 572, -14.5, { v: 0.8 });
      b.row("orb", 618, [0, 0], 12);

      // 점프대
      b.obj("ramp", 812, 0);
      b.obj("bigRamp", 1124, 0);

      // 좁은 통로 2 (965~1030)
      b.width(965, 1030, 6.5, 20);
      for (let z = 968; z <= 1028; z += 15) {
        b.obj("reefHead", z, -8.9 - (z % 2) * 0.4, { v: 0.4 });
        b.obj("reefHead", z + 8, 8.9 + (z % 3) * 0.3, { v: 0.9 });
      }

      // 회전 부표
      b.obj("pylon", 130, -9.4, { color: "#ff5fa8" });
      b.obj("pylon", 405, 9.4, { color: "#ff5fa8" });
      b.obj("pylon", 650, -9.4, { color: "#ff5fa8" });
      b.obj("pylon", 900, -9.4, { color: "#ff5fa8" });

      // 풍경
      b.scatter(-40, 1600, ["atoll", "atoll", "isleBig"], { every: 130, near: [45, 130] });
      b.scatter(20, 1600, ["reefRock", "reefRock", "sandbar", "divePlatform"], { every: 55, near: [10, 30] });
      b.scen("glassBoat", 330, 26);
      b.scen("glassBoat", 840, -28, { flip: true });
      b.scen("dolphins", 160, 22);
      b.scen("dolphins", 620, -24);
      b.scen("dolphins", 1000, 20);
      b.scen("lighthouse", 760, 54);
    },
  },
  {
    id: "c03",
    no: 3,
    name: "아일랜드 루프",
    en: "ISLAND LOOP",
    stars: 2,
    theme: "island",
    length: 1220,
    seed: 37,
    medals: { bronze: 38.0, silver: 34.4, gold: 32.1 },
    vmax: 34,
    rivals: [0.97, 0.99, 1.01, 1.03],
    preview: 120,
    music: { bpm: 134, root: 60, scale: "major", prog: "bright", lead: "steel", drums: "island", seed: 63, density: 0.64 },
    tip: "섬을 크게 도는 코너가 많아요. 갈림길 두 번 — 폭포 해협은 빠르지만 좁고, 통나무 길은 부스터가 많아요!",
    gimmicks: ["두 갈래 길", "긴 코너", "부표 슬라럼"],
    build(b) {
      b.straight(70); // 0
      b.curve(170, 1 / 170); // 70 섬을 도는 긴 오른쪽
      b.straight(40); // 240
      b.curve(110, -1 / 150); // 280
      b.straight(150); // 390 갈림길 A
      b.curve(120, 1 / 160); // 540
      b.straight(70); // 660 슬라럼
      b.curve(100, -1 / 170); // 730
      b.straight(140); // 830 갈림길 B
      b.curve(130, 1 / 180); // 970 다시 섬을 돈다
      b.straight(120); // 1100 → 결승 1220

      b.gate("start", 14);
      b.gate("check", 392);
      b.gate("check", 832);
      b.gate("finish", 1220);
      b.swell(0, 1220, 0.25, 50);

      // 첫 코너 안쪽 큰 섬 (코스에 바짝)
      for (let z = 90; z < 230; z += 34) b.scen(z % 68 < 34 ? "waterfallCliff" : "isleTall", z, 30 + (z % 3) * 4, { v: (z % 5) / 5 });
      b.obj("pylon", 160, 10.2);
      b.obj("pylon", 300, -10.2);
      b.row("orb", 330, [-3, -3], 12);
      b.obj("pad", 120, 3);

      // 갈림길 A: 왼쪽 폭포 해협(지름길) · 오른쪽 넓은 길 + 점프대
      b.split(405, 528, { dw: 8, side: "left", mul: 1.18, hw: 21 });
      b.scen("signShort", 390, 0, { flip: true });
      b.scen("waterfallCliff", 470, -36, { v: 0.8 });
      b.walls(420, 515, 1.5);
      b.obj("rock", 440, -14, { v: 1 });
      b.obj("ramp", 262, 0);
      b.obj("pad", 244, 0);

      // 슬라럼 (좌우 번갈아)
      b.slalom(668, 5, 14, 3.4, "pylon", { color: "#ff4d4d" });
      b.obj("pad", 724, 0);

      // 갈림길 B: 오른쪽 통나무 길(지름길) · 왼쪽 부스터 길
      b.split(845, 960, { dw: 7, side: "right", mul: 1.18, hw: 20 });
      b.scen("signShort", 830, 0);
      b.obj("log", 870, 13.5, { move: { amp: 1.6, speed: 1.1 } });
      b.obj("log", 914, 12.5, { move: { amp: 1.6, speed: 1.3 } });
      b.obj("pad", 880, -13);
      b.obj("orb", 896, -13);
      b.obj("pad", 890, 13.5);
      b.obj("pad", 936, 13.5);

      // 마지막 섬 코너 + 큰 점프
      for (let z = 990; z < 1090; z += 40) b.scen("isleTall", z, 32, { v: (z % 7) / 7 });
      b.obj("rock", 1020, 6.5);
      b.obj("barrel", 1050, -2);
      b.obj("bigRamp", 1160, 0);
      b.obj("pad", 1132, 0);
      b.row("orb", 600, [3, 3, 3], 10);

      // 풍경
      b.scatter(-40, 1700, ["isleBig", "isleTall", "waterfallCliff"], { every: 110, near: [40, 120] });
      b.scatter(20, 1700, ["sandbar", "rockIsle", "sailboat", "hutPier"], { every: 60, near: [12, 34] });
      b.scen("dolphins", 600, -20);
      b.scen("lighthouse", 1180, -46);
    },
  },
  {
    id: "c04",
    no: 4,
    name: "파이럿 채널",
    en: "PIRATE CHANNEL",
    stars: 3,
    theme: "pirate",
    length: 1220,
    seed: 47,
    medals: { bronze: 38.8, silver: 35.1, gold: 32.9 },
    vmax: 34,
    rivals: [0.98, 1.0, 1.02, 1.04],
    preview: 210,
    music: { bpm: 138, root: 57, scale: "minor", prog: "minor", lead: "pluck", drums: "storm", seed: 74, density: 0.66 },
    tip: "해적선 사이 좁은 물길에서는 벽에 닿지 않게! 떠내려오는 통나무와 움직이는 부표를 조심하세요.",
    gimmicks: ["해적선 사이 통과", "움직이는 통나무", "보물섬 갈림길"],
    build(b) {
      b.straight(80); // 0 항구 출발
      b.curve(90, -1 / 200); // 80
      b.straight(140); // 170 해적선 사이 1
      b.curve(100, 1 / 170); // 310
      b.straight(100); // 410 통나무
      b.curve(80, -1 / 160); // 510
      b.straight(150); // 590 보물섬 갈림길
      b.curve(110, 1 / 180); // 740
      b.straight(120); // 850 해적선 사이 2
      b.curve(80, -1 / 170); // 970
      b.straight(170); // 1050 → 결승 1220

      b.gate("start", 14);
      b.gate("check", 592);
      b.gate("finish", 1220);
      b.swell(0, 1220, 0.3, 44);

      // 항구 (출발)
      b.scen("pier", 30, -20);
      b.scen("pier", 60, 20, { flip: true, v: 0.7 });
      b.scen("fortTower", 110, -34);

      // 해적선 사이 1 (180~300): 좁은 물길 + 벽
      b.width(180, 300, 7, 25);
      b.walls(185, 295, 2.2);
      b.scen("pirateShip", 205, -26, { v: 0.2 });
      b.scen("pirateShip", 262, 27, { v: 0.8, flip: true });
      b.obj("crate", 215, 2.5);
      b.obj("barrel", 248, -2.5);
      b.obj("crate", 280, 1.5);
      b.row("orb", 230, [0, 0], 12);

      b.obj("pad", 140, 2);
      b.obj("pylon", 330, 10.2, { color: "#ffcf4d", color2: "#b8282f" });

      // 떠내려오는 통나무 (410~510)
      b.obj("log", 430, 0, { move: { amp: 5, speed: 1.1 } });
      b.obj("log", 462, 2, { move: { amp: 5.5, speed: 1.35 } });
      b.obj("log", 494, -1, { move: { amp: 5, speed: 1.6 } });
      b.obj("pad", 450, -6.5);

      // 보물섬 갈림길: 오른쪽 난파선 지름길 · 왼쪽 움직이는 부표 길
      b.split(605, 730, { dw: 8, side: "right", mul: 1.18, hw: 21 });
      b.scen("treasureIsle", 668, 0);
      b.scen("signShort", 592, 0);
      b.obj("wreckMast", 632, 12);
      b.obj("wreckMast", 708, 11.5);
      b.obj("pad", 655, 14);
      b.obj("pylon", 640, -13, { move: { amp: 3, speed: 1.6 }, color: "#ffcf4d", color2: "#b8282f" });
      b.obj("pylon", 690, -14, { move: { amp: 3, speed: 2 }, color: "#ffcf4d", color2: "#b8282f" });
      b.row("orb", 650, [-14, -14], 16);

      // 해적선 사이 2 (860~960) + 부두 점프대
      b.width(862, 962, 7.5, 25);
      b.walls(866, 958, 2.2);
      b.scen("pirateShip", 885, 27, { v: 0.6, flip: true });
      b.scen("pirateShip", 940, -26, { v: 0.1 });
      b.obj("ramp", 905, 0);
      b.obj("barrel", 935, 2);

      // 마지막 직선: 움직이는 부표 슬라럼 + 큰 점프
      b.obj("pylon", 1070, -3, { move: { amp: 3, speed: 1.8 }, color: "#ffcf4d", color2: "#b8282f" });
      b.obj("pylon", 1105, 3, { move: { amp: 3, speed: 2.1 }, color: "#ffcf4d", color2: "#b8282f" });
      b.obj("pad", 1130, 0);
      b.obj("bigRamp", 1170, 0);
      b.row("orb", 1020, [-3, -3], 12);

      // 풍경
      b.scatter(-40, 1700, ["pirateShip", "fortTower", "isleTall"], { every: 120, near: [40, 110] });
      b.scatter(20, 1700, ["pier", "rockIsle", "sandbar"], { every: 70, near: [14, 32] });
    },
  },
  {
    id: "c05",
    no: 5,
    name: "빅 웨이브",
    en: "BIG WAVE",
    stars: 3,
    theme: "bigwave",
    length: 1260,
    seed: 53,
    width: 13,
    medals: { bronze: 40.2, silver: 36.6, gold: 34.4 },
    vmax: 34.5,
    rivals: [0.98, 1.0, 1.02, 1.04],
    preview: 250,
    music: { bpm: 140, root: 62, scale: "major", prog: "bright", lead: "steel", drums: "storm", seed: 81, density: 0.66 },
    tip: "큰 파도를 타고 내려갈 때 빨라져요! 연속 점프대 위 공중 부스터 구슬은 점프해서 잡아요.",
    gimmicks: ["움직이는 큰 파도", "연속 점프", "공중 부스터"],
    build(b) {
      b.straight(80); // 0
      b.curve(120, 1 / 220); // 80
      b.straight(140); // 200 파도 1 + 연속 점프
      b.curve(100, -1 / 200); // 340
      b.straight(160); // 440 갈림길
      b.curve(120, 1 / 190); // 600
      b.straight(170); // 720 파도 2 + 큰 점프
      b.curve(90, -1 / 180); // 890
      b.straight(130); // 980 파도 3
      b.straight(140); // 1110 → 결승 1250
      b.straight(10); // 1250 → 1260

      b.gate("start", 14);
      b.gate("check", 442);
      b.gate("finish", 1260);
      b.swell(0, 1260, 0.35, 46);
      // 움직이는 큰 파도 (카메라 쪽으로 밀려온다)
      b.wave(130, 420, 1.7, 58, 7);
      b.wave(700, 900, 2.2, 66, 8, 1.2);
      b.wave(980, 1160, 1.9, 54, 9, 2.4);

      // 연속 점프 (세 개) + 공중 부스터 구슬
      b.obj("ramp", 222, 0);
      b.obj("orb", 243, 0, { h: 4.6 });
      b.obj("ramp", 292, 0);
      b.obj("orb", 313, 0, { h: 4.6 });
      b.obj("ramp", 362, 0);
      b.obj("pad", 204, 0);

      // 갈림길: 왼쪽 큰 바위 사이 지름길 (바위 · 물살) · 오른쪽 넓은 길
      b.split(455, 590, { dw: 8, side: "left", mul: 1.22, hw: 23, decor: "rock" });
      b.scen("signShort", 442, 0, { flip: true });
      b.obj("rockBig", 500, -15.5, { v: 0.3 });
      b.obj("rock", 545, -12, { v: 1 });
      b.obj("pad", 520, -13);
      b.obj("orb", 525, 15);

      // 큰 점프 + 공중 구슬 두 개
      b.obj("pad", 760, 0);
      b.obj("bigRamp", 800, 0);
      b.obj("orb", 826, 0, { h: 7 });
      b.obj("orb", 846, 0, { h: 6 });

      // 파도 3: 부표 사이를 파도 타기
      b.obj("pylon", 1010, -4, { color: "#ffffff", color2: "#2f86ea" });
      b.obj("pylon", 1050, 4, { color: "#ffffff", color2: "#2f86ea" });
      b.obj("pylon", 1090, -4, { color: "#ffffff", color2: "#2f86ea" });
      b.row("orb", 1120, [0, 0], 12);
      b.obj("pad", 1180, 0);

      b.obj("pylon", 160, 12.2, { color: "#ffffff", color2: "#2f86ea" });
      b.obj("pylon", 640, 12.2, { color: "#ffffff", color2: "#2f86ea" });
      b.obj("rock", 380, 6);
      b.obj("rock", 940, -6, { v: 1 });

      // 풍경: 바위 기둥 · 구조대 망루 · 먼 섬
      b.scatter(-40, 1750, ["seaStack", "seaStack", "isleTall"], { every: 90, near: [26, 90] });
      b.scatter(20, 1750, ["lifeguard", "rockIsle", "sailboat"], { every: 85, near: [14, 34] });
      b.scen("dolphins", 600, 26);
    },
  },
  {
    id: "c06",
    no: 6,
    name: "스톰 코스트",
    en: "STORM COAST",
    stars: 3,
    theme: "storm",
    length: 1240,
    seed: 61,
    medals: { bronze: 41.6, silver: 38.0, gold: 35.8 },
    vmax: 34.5,
    rivals: [0.98, 1.0, 1.02, 1.04],
    preview: 330,
    music: { bpm: 144, root: 57, scale: "minor", prog: "boss", lead: "pluck", drums: "storm", seed: 92, density: 0.7 },
    tip: "빨간 경고 원 안에는 곧 번개가 떨어져요 — 원이 줄어들기 전에 비켜요! 옆바람이 몸을 밀어요.",
    gimmicks: ["강풍", "번개 위험 구간", "움직이는 부표"],
    build(b) {
      b.straight(90); // 0
      b.curve(110, -1 / 190); // 90
      b.straight(150); // 200 옆바람
      b.curve(100, 1 / 170); // 350
      b.straight(130); // 450 번개 구간
      b.curve(90, -1 / 160); // 580
      b.straight(160); // 670 갈림길
      b.curve(110, 1 / 180); // 830
      b.straight(160); // 940 파도 + 큰 점프
      b.curve(70, -1 / 170); // 1100
      b.straight(70); // 1170 → 결승 1240

      b.gate("start", 14);
      b.gate("check", 452);
      b.gate("check", 672);
      b.gate("finish", 1240);
      b.swell(0, 1240, 0.55, 40);
      b.wave(940, 1100, 1.3, 50, 8);

      // 옆바람 (오른쪽으로 민다) — 부표 줄 밖으로 밀리지 않게
      b.wind(210, 350, 3.6);
      b.obj("barrel", 260, 3);
      b.obj("crate", 300, -4.5);
      b.row("orb", 240, [-3, -3], 12);

      // 번개 위험 구간: 경고 원 (번갈아 터진다)
      b.obj("zap", 470, -3.5, { offset: 0 });
      b.obj("zap", 505, 3.5, { offset: 1.8 });
      b.obj("zap", 540, 0, { offset: 0.9 });
      b.obj("pad", 560, 0);

      // 갈림길: 오른쪽 절벽 아래 지름길 (돌풍 + 번개) · 왼쪽 움직이는 부표 길
      b.split(685, 820, { dw: 8, side: "right", mul: 1.17, hw: 21, decor: "rock" });
      b.scen("signShort", 672, 0);
      b.wind(690, 815, -2.8);
      b.obj("zap", 740, 14.5, { offset: 0.5 });
      b.obj("zap", 785, 13, { offset: 2.2 });
      b.obj("pad", 712, 14);
      b.obj("pylon", 725, -13.5, { move: { amp: 3.4, speed: 1.7 }, color: "#ffd23f", color2: "#1d2233" });
      b.obj("pylon", 775, -14.5, { move: { amp: 3.4, speed: 2 }, color: "#ffd23f", color2: "#1d2233" });
      b.obj("orb", 750, -14);

      // 파도 + 큰 점프
      b.obj("pad", 980, 0);
      b.obj("bigRamp", 1010, 0);
      b.obj("orb", 1036, 0, { h: 6.6 });
      b.obj("log", 1060, 3, { move: { amp: 3.5, speed: 1.3 } });
      b.row("orb", 1140, [2, 2], 12);

      b.obj("pylon", 130, -10.2, { color: "#ffd23f", color2: "#1d2233" });
      b.obj("pylon", 400, 10.2, { color: "#ffd23f", color2: "#1d2233" });
      b.obj("rock", 620, -4.5);

      // 풍경
      b.scatter(-40, 1750, ["stormCliff", "stormCliff", "seaStack"], { every: 100, near: [30, 90] });
      b.scatter(20, 1750, ["rockIsle", "seaStack"], { every: 70, near: [14, 34] });
      b.scen("stormLighthouse", 560, -40);
      b.scen("stormLighthouse", 1120, 46);
    },
  },
  {
    id: "c07",
    no: 7,
    name: "볼케이노 아일랜드",
    en: "VOLCANO ISLAND",
    stars: 4,
    theme: "volcano",
    length: 1260,
    seed: 71,
    width: 10.5,
    medals: { bronze: 39.6, silver: 36.0, gold: 32.7 },
    vmax: 35,
    rivals: [0.99, 1.01, 1.03, 1.05],
    preview: 300,
    music: { bpm: 146, root: 55, scale: "minor", prog: "boss", lead: "pluck", drums: "boss", seed: 103, density: 0.7 },
    tip: "보글보글 거품이 보이면 곧 뜨거운 증기가 솟아요! 급커브가 많으니 일찍 꺾으세요. 용암 바위 지름길은 위험!",
    gimmicks: ["증기 분출", "급격한 코너", "위험한 지름길"],
    build(b) {
      b.straight(80); // 0
      b.curve(80, 1 / 140); // 80 급커브
      b.curve(80, -1 / 135); // 160
      b.straight(110); // 240 증기 구간
      b.curve(90, 1 / 135); // 350
      b.straight(170); // 440 지름길
      b.curve(70, -1 / 130); // 610
      b.curve(70, 1 / 132); // 680
      b.straight(130); // 750 증기 + 점프
      b.curve(100, -1 / 140); // 880
      b.straight(100); // 980
      b.curve(70, 1 / 150); // 1080
      b.straight(110); // 1150 → 결승 1260

      b.gate("start", 14);
      b.gate("check", 442);
      b.gate("finish", 1260);
      b.swell(0, 1260, 0.3, 42);

      // 첫 급커브 S
      b.obj("lavaRock", 120, 5.5, { v: 0.2 });
      b.obj("lavaRock", 200, -5, { v: 0.6 });
      b.obj("pad", 150, -2);

      // 증기 분출 구간
      b.obj("geyser", 260, -3, { offset: 0 });
      b.obj("geyser", 290, 3, { offset: 1.4 });
      b.obj("geyser", 320, 0, { offset: 0.7 });
      b.row("orb", 270, [6, 6], 14);

      // 위험한 지름길: 오른쪽 용암 바위밭 (증기 + 바위, 물살 빠름) · 왼쪽 안전한 길
      b.split(455, 600, { dw: 7.5, side: "right", mul: 1.23, hw: 20, decor: "rock" });
      b.scen("signShort", 442, 0);
      b.obj("lavaRock", 485, 12.5, { v: 0.4 });
      b.obj("geyser", 515, 15, { offset: 0.4 });
      b.obj("lavaRock", 545, 15.5, { v: 0.9 });
      b.obj("geyser", 575, 12, { offset: 1.6 });
      b.obj("pad", 530, 12);
      b.obj("orb", 520, -13.5);
      b.obj("pad", 570, -13.5);

      // 급커브 S + 용암 바위
      b.obj("lavaRock", 640, -3.5, { v: 0.1 });
      b.obj("lavaRock", 710, 3.5, { v: 0.7 });

      // 증기 + 점프대 (증기를 점프로 넘을 수 있다)
      b.obj("geyser", 768, -4.2, { offset: 0.2 });
      b.obj("pad", 790, 0);
      b.obj("bigRamp", 830, 0);
      b.obj("orb", 856, 0, { h: 6.6 });
      b.obj("geyser", 876, 4.2, { offset: 1.2 });

      b.obj("lavaRock", 1000, 4, { v: 0.5 });
      b.obj("geyser", 1040, -3, { offset: 0.8 });
      b.row("orb", 1160, [0, 0], 12);
      b.obj("pad", 1200, 0);

      // 풍경
      b.scatter(-40, 1760, ["volcanoIsle", "volcanoIsle", "seaStack"], { every: 110, near: [32, 110] });
      b.scatter(20, 1760, ["rockIsle", "seaStack"], { every: 70, near: [14, 34] });
    },
  },
  {
    id: "c08",
    no: 8,
    name: "문라이트 베이",
    en: "MOONLIGHT BAY",
    stars: 4,
    theme: "moon",
    length: 1250,
    seed: 83,
    medals: { bronze: 38.6, silver: 35.0, gold: 32.8 },
    vmax: 35,
    rivals: [0.99, 1.01, 1.03, 1.05],
    preview: 200,
    music: { bpm: 126, root: 64, scale: "dorian", prog: "calm", lead: "bell", drums: "soft", seed: 113, density: 0.6, pad: true },
    tip: "빛나는 조명 게이트를 지나면 부스터가 차요. 어두운 바위는 빨간 경고등을 보고 피하세요!",
    gimmicks: ["제한된 시야", "조명 게이트", "어두운 장애물"],
    build(b) {
      b.straight(80); // 0
      b.curve(110, 1 / 200); // 80
      b.straight(130); // 190 조명 게이트
      b.curve(100, -1 / 170); // 320
      b.straight(140); // 420 어두운 바위
      b.curve(90, 1 / 160); // 560
      b.straight(160); // 650 갈림길
      b.curve(110, -1 / 180); // 810
      b.straight(150); // 920 조명 게이트 + 점프
      b.curve(80, 1 / 170); // 1070
      b.straight(100); // 1150 → 결승 1250

      b.gate("start", 14);
      b.gate("check", 652);
      b.gate("finish", 1250);
      b.swell(0, 1250, 0.25, 50);

      // 조명 게이트 (지날 때마다 게이지 +½)
      b.obj("lightGate", 220, 0);
      b.obj("lightGate", 270, -3);
      b.obj("lightGate", 320, 2);
      b.obj("pad", 360, 0);

      // 어두운 바위 (빨간 경고등)
      b.obj("beaconRock", 450, 3.5);
      b.obj("beaconRock", 490, -4);
      b.obj("beaconRock", 530, 1.5);
      b.obj("orb", 470, -3);

      // 갈림길: 왼쪽 등불 해협(지름길 · 어두운 바위) · 오른쪽 넓은 길(게이트)
      b.split(665, 800, { dw: 8, side: "left", mul: 1.21, hw: 21, decor: "rock" });
      b.scen("signShort", 652, 0, { flip: true });
      b.obj("beaconRock", 700, -12.5);
      b.obj("beaconRock", 750, -15.5);
      b.obj("pad", 725, -14);
      b.obj("lightGate", 730, 14.5);
      b.scen("lanterns", 715, -24, { v: 0.2 });

      // 게이트 + 큰 점프
      b.obj("lightGate", 950, 0);
      b.obj("pad", 985, 0);
      b.obj("bigRamp", 1020, 0);
      b.obj("orb", 1046, 0, { h: 6.6 });
      b.obj("beaconRock", 1100, -3.5);
      b.obj("lightGate", 1190, 0);

      b.obj("pylon", 140, 10.2, { color: "#7ff3ff", color2: "#1d2a6a" });
      b.obj("pylon", 380, -10.2, { color: "#7ff3ff", color2: "#1d2a6a" });

      // 풍경: 밤섬 · 등불
      b.scatter(-40, 1750, ["nightIsle", "nightIsle", "isleTall"], { every: 110, near: [32, 110] });
      b.scatter(20, 1750, ["lanterns", "rockIsle", "lanterns"], { every: 50, near: [10, 26] });
      b.scen("lighthouse", 600, 50);
    },
  },
  {
    id: "c09",
    no: 9,
    name: "아이스 오션",
    en: "ICE OCEAN",
    stars: 4,
    theme: "ice",
    length: 1270,
    seed: 91,
    medals: { bronze: 40.0, silver: 35.0, gold: 32.8 },
    vmax: 35.5,
    rivals: [0.99, 1.01, 1.03, 1.05],
    preview: 210,
    music: { bpm: 132, root: 67, scale: "major", prog: "calm", lead: "bell", drums: "soft", seed: 124, density: 0.6, pad: true },
    tip: "반짝이는 얼음물 위에서는 제트스키가 미끄러져요 — 조금 일찍 꺾어요! 빙하 틈 지름길은 좁아요.",
    gimmicks: ["빙산", "미끄러운 얼음물", "좁은 빙하 통로"],
    build(b) {
      b.straight(80); // 0
      b.curve(110, 1 / 180); // 80
      b.straight(140); // 190 빙산 피하기
      b.curve(100, -1 / 150); // 330
      b.straight(120); // 430 얼음물
      b.curve(90, 1 / 150); // 550
      b.straight(170); // 640 갈림길
      b.curve(110, -1 / 170); // 810
      b.straight(140); // 920 빙하 통로 + 점프
      b.curve(80, 1 / 160); // 1060
      b.straight(130); // 1140 → 결승 1270

      b.gate("start", 14);
      b.gate("check", 642);
      b.gate("finish", 1270);
      b.swell(0, 1270, 0.22, 48);

      // 빙산 피하기 (번갈아)
      b.obj("iceberg", 215, -5, { v: 0.2 });
      b.obj("iceberg", 265, 5.5, { v: 0.6 });
      b.obj("iceChunk", 240, 0.5, { v: 0.3 });
      b.obj("iceChunk", 300, -2, { v: 0.8 });
      b.obj("pad", 190, 0);
      b.row("orb", 285, [-5, -5], 12);

      // 미끄러운 얼음물 (430~570)
      b.slip(430, 575, 0.35);
      b.row("orb", 450, [2, 2, 2], 14);
      b.obj("iceChunk", 505, -3.5, { v: 0.5 });
      b.obj("iceChunk", 540, 4, { v: 0.1 });
      b.obj("pad", 600, 0);

      // 갈림길: 왼쪽 빙하 틈(지름길: 좁고 벽 · 얼음 조각) · 오른쪽 빙산 바다
      b.split(655, 800, { dw: 8, side: "left", mul: 1.22, hw: 21, decor: "ice" });
      b.scen("signShort", 642, 0, { flip: true });
      b.walls(670, 790, 1.2);
      b.obj("iceChunk", 690, -12.5, { v: 0.4 });
      b.obj("iceChunk", 735, -15.5, { v: 0.7 });
      b.obj("pad", 712, -14);
      b.obj("iceChunk", 768, -12.5, { v: 0.2 });
      b.obj("iceberg", 720, 16, { v: 0.9 });

      // 빙하 통로 (좁고 벽) + 점프
      b.width(925, 1050, 7, 25);
      b.walls(930, 1045, 1.5);
      b.obj("pad", 950, 0);
      b.obj("ramp", 985, 0);
      b.obj("orb", 1006, 0, { h: 4.6 });
      b.obj("iceChunk", 1030, 3, { v: 0.6 });
      b.slip(1080, 1140, 0.45);
      b.obj("bigRamp", 1210, 0);
      b.obj("pad", 1185, 0);

      // 풍경: 빙하 절벽 · 빙산 · 펭귄
      b.scatter(-40, 1760, ["glacier", "glacier", "isleTall"], { every: 100, near: [30, 100] });
      b.scatter(20, 1760, ["penguinFloe", "penguinFloe", "rockIsle"], { every: 50, near: [12, 30] });
      for (let z = 930; z < 1050; z += 40) {
        b.scen("glacier", z, -24, { v: (z % 7) / 7 });
        b.scen("glacier", z + 20, 25, { v: (z % 5) / 5 });
      }
    },
  },
  {
    id: "c10",
    no: 10,
    name: "딥씨 채널",
    en: "DEEP SEA CHANNEL",
    stars: 5,
    theme: "deep",
    length: 1300,
    seed: 101,
    medals: { bronze: 39.4, silver: 35.9, gold: 33.7 },
    vmax: 36,
    rivals: [1.0, 1.02, 1.04, 1.06],
    preview: 215,
    music: { bpm: 120, root: 55, scale: "minor", prog: "minor", lead: "bell", drums: "soft", seed: 135, density: 0.62, pad: true },
    tip: "물이 소용돌이치면 거대 촉수가 솟아요 — 잠깐 비켜 가면 돼요. 산호 터널 안은 어두우니 빛나는 부표를 따라가요!",
    gimmicks: ["거대 촉수", "심해 터널", "좁은 산호 통로"],
    build(b) {
      b.straight(80); // 0
      b.curve(100, -1 / 170); // 80
      b.straight(150); // 180 터널 1
      b.curve(100, 1 / 150); // 330
      b.straight(140); // 430 촉수 구간
      b.curve(90, -1 / 150); // 570
      b.straight(170); // 660 갈림길
      b.curve(110, 1 / 170); // 830
      b.straight(150); // 940 점프
      b.curve(80, -1 / 160); // 1090
      b.straight(130); // 1170 → 결승 1300

      b.gate("start", 14);
      b.gate("check", 662);
      b.gate("finish", 1300);
      b.swell(0, 1300, 0.3, 46);

      // 터널 1 (좁고 어둑)
      b.width(195, 320, 8, 25);
      b.tunnel(200, 315, 14);
      b.walls(200, 315, 1.6);
      b.obj("tentacle", 250, -4.5, { offset: 0 });
      b.obj("tentacle", 290, 4.5, { offset: 2.1 });
      b.obj("pad", 225, 0);
      b.row("orb", 265, [0, 0], 12);

      // 촉수 구간 (번갈아 솟는다)
      b.obj("tentacle", 455, -3, { offset: 0.3 });
      b.obj("tentacle", 485, 3.5, { offset: 1.5 });
      b.obj("tentacle", 515, 0, { offset: 2.7 });
      b.obj("tentacle", 545, -4, { offset: 0.9 });
      b.obj("pad", 560, 0);
      b.row("orb", 470, [5.5, 5.5], 30);

      // 갈림길: 왼쪽 산호 터널 지름길(어둡고 촉수 · 물살 빠름) · 오른쪽 산호 기둥 사이
      b.split(675, 820, { dw: 8, side: "left", mul: 1.2, hw: 21, decor: "coral" });
      b.scen("signShort", 662, 0, { flip: true });
      for (let z = 690; z <= 810; z += 14) b.scen("coralArch", z, -14.5, { small: true });
      b.obj("tentacle", 720, -14, { offset: 0.6 });
      b.obj("tentacle", 775, -13, { offset: 2.2 });
      b.obj("pad", 745, -14.5);
      b.obj("reefHead", 710, 13, { v: 0.4 });
      b.obj("reefHead", 760, 16, { v: 0.7 });
      b.obj("orb", 735, 14.5);

      // 점프 + 공중 구슬
      b.obj("pad", 970, 0);
      b.obj("bigRamp", 1005, 0);
      b.obj("orb", 1031, 0, { h: 6.6 });
      b.obj("tentacle", 1060, 3.5, { offset: 1.2 });
      b.obj("reefHead", 1120, -4, { v: 0.2 });
      b.row("orb", 1180, [0, 0], 12);
      b.obj("pad", 1230, 0);

      b.obj("pylon", 130, 10.2, { color: "#3fd6c6", color2: "#2a1048" });
      b.obj("pylon", 380, -10.2, { color: "#3fd6c6", color2: "#2a1048" });

      // 풍경: 거대 산호 기둥
      b.scatter(-40, 1800, ["coralSpire", "coralSpire", "seaStack"], { every: 60, near: [16, 80] });
      b.scatter(20, 1800, ["coralSpire", "reefRock"], { every: 45, near: [10, 26] });
    },
  },
  {
    id: "c11",
    no: 11,
    name: "썬더 오션",
    en: "THUNDER OCEAN",
    stars: 5,
    theme: "thunder",
    length: 1380,
    seed: 113,
    medals: { bronze: 41.6, silver: 38.0, gold: 35.8 },
    vmax: 37,
    rivals: [1.0, 1.02, 1.04, 1.06],
    preview: 230,
    music: { bpm: 156, root: 52, scale: "minor", prog: "boss", lead: "pluck", drums: "boss", seed: 146, density: 0.74 },
    tip: "가장 빠른 코스! 부스터 판 4연속으로 최고 속도를 내 보세요. 번개 경고 원과 큰 파도를 조심!",
    gimmicks: ["연속 부스터", "연속 점프", "빠른 코너", "이동 장애물"],
    build(b) {
      b.straight(80); // 0
      b.curve(90, 1 / 170); // 80
      b.straight(220); // 170 최고 속도 구간
      b.curve(100, -1 / 150); // 390 빠른 코너
      b.straight(160); // 490 큰 파도 + 연속 점프
      b.curve(90, 1 / 140); // 650
      b.straight(170); // 740 갈림길
      b.curve(100, -1 / 150); // 910
      b.straight(150); // 1010 움직이는 부표
      b.curve(80, 1 / 160); // 1160
      b.straight(140); // 1240 → 결승 1380

      b.gate("start", 14);
      b.gate("check", 742);
      b.gate("finish", 1380);
      b.swell(0, 1380, 0.6, 40);

      // 최고 속도 구간: 부스터 판 4연속 + 양옆 번개
      b.row("pad", 195, [0, 0, 0, 0], 38);
      b.obj("zap", 250, -6.5, { offset: 0.4 });
      b.obj("zap", 330, 6.5, { offset: 2 });
      b.obj("pylon", 160, 10.2, { color: "#ffe14a", color2: "#7c3aff" });

      // 큰 파도 + 연속 점프
      b.wave(480, 660, 2, 56, 9);
      b.obj("ramp", 515, 0);
      b.obj("orb", 536, 0, { h: 4.6 });
      b.obj("ramp", 585, 0);
      b.obj("orb", 606, 0, { h: 4.6 });
      b.obj("rock", 640, 4.5, { v: 1 });

      // 갈림길: 오른쪽 번개 골목(지름길: 번개 · 부스터 · 물살) · 왼쪽 통나무 길
      b.split(755, 900, { dw: 8, side: "right", mul: 1.2, hw: 21, decor: "rock" });
      b.scen("signShort", 742, 0);
      b.obj("zap", 790, 14, { offset: 0.2 });
      b.obj("pad", 815, 14.5);
      b.obj("zap", 845, 15, { offset: 1.9 });
      b.obj("pad", 870, 14.5);
      b.obj("log", 790, -14, { move: { amp: 3, speed: 1.5 } });
      b.obj("log", 850, -13, { move: { amp: 3, speed: 1.8 } });
      b.obj("orb", 820, -14);

      // 움직이는 부표 슬라럼 + 부스터
      b.obj("pylon", 1030, -3, { move: { amp: 3.5, speed: 2 }, color: "#ffe14a", color2: "#7c3aff" });
      b.obj("pylon", 1065, 3, { move: { amp: 3.5, speed: 2.3 }, color: "#ffe14a", color2: "#7c3aff" });
      b.obj("pylon", 1100, -2, { move: { amp: 3.5, speed: 2.6 }, color: "#ffe14a", color2: "#7c3aff" });
      b.obj("pad", 1130, 0);
      b.wave(1200, 1330, 1.6, 50, 10, 1);
      b.obj("pad", 1270, 0);
      b.obj("bigRamp", 1305, 0);
      b.obj("orb", 1331, 0, { h: 6.8 });
      b.row("orb", 1180, [0, 0], 12);

      // 풍경
      b.scatter(-40, 1880, ["stormCliff", "seaStack", "stormCliff"], { every: 100, near: [30, 100] });
      b.scatter(20, 1880, ["seaStack", "rockIsle"], { every: 70, near: [14, 32] });
      b.scen("stormLighthouse", 700, -42);
    },
  },
  {
    id: "c12",
    no: 12,
    name: "그랜드 오션 GP",
    en: "GRAND OCEAN GP",
    stars: 6,
    theme: "grand",
    grand: true,
    length: 1560,
    seed: 127,
    medals: { bronze: 45.6, silver: 40.6, gold: 38.4 },
    vmax: 37,
    rivals: [1.01, 1.03, 1.05, 1.07],
    preview: 60,
    music: { bpm: 150, root: 60, scale: "major", prog: "bright", lead: "steel", drums: "boss", seed: 157, density: 0.72 },
    tip: "최종 챔피언십! 산호 · 해적선 · 큰 파도 · 증기 · 얼음 · 번개가 모두 나와요. 결승 직선은 부스터 연속!",
    gimmicks: ["모든 기믹", "두 갈래 길", "결승 불꽃놀이"],
    build(b) {
      b.straight(100); // 0 경기장 출발
      b.curve(110, 1 / 180); // 100 열대 구간
      b.straight(120); // 210 산호 통로
      b.curve(100, -1 / 160); // 330
      b.straight(150); // 430 해적선 사이
      b.curve(90, 1 / 150); // 580
      b.straight(170); // 670 큰 파도 + 연속 점프
      b.curve(100, -1 / 150); // 840
      b.straight(160); // 940 갈림길: 화산 · 얼음
      b.curve(90, 1 / 150); // 1100
      b.straight(140); // 1190 폭풍 · 조명 게이트
      b.curve(80, -1 / 160); // 1330
      b.straight(150); // 1410 → 결승 1560

      b.gate("start", 14);
      b.gate("check", 432);
      b.gate("check", 942);
      b.gate("finish", 1560);
      b.swell(0, 1560, 0.3, 46);

      // 경기장 관중석
      for (const z of [-20, 40, 110]) {
        b.scen("grandstand", z, -30, { v: 0.2 });
        b.scen("grandstand", z + 30, 31, { v: 0.7 });
      }
      b.obj("pad", 150, 2);
      b.row("orb", 180, [-2.5, -2.5], 12);

      // 산호 통로
      b.width(215, 320, 7, 25);
      for (let z = 220; z <= 315; z += 16) {
        b.obj("reefHead", z, -8.9, { v: (z % 7) / 7 });
        b.obj("reefHead", z + 8, 8.9, { v: (z % 5) / 5 });
      }
      b.obj("coral", 268, 1.5, { color: "#ffb347" });
      b.obj("pad", 240, -1.5);

      // 해적선 사이
      b.width(440, 570, 7.5, 25);
      b.walls(445, 565, 2.2);
      b.scen("pirateShip", 470, -26, { v: 0.2 });
      b.scen("pirateShip", 535, 27, { v: 0.8, flip: true });
      b.obj("crate", 480, 2.5);
      b.obj("barrel", 520, -2.5);
      b.obj("pad", 555, 0);

      // 큰 파도 + 연속 점프 + 공중 구슬
      b.wave(670, 840, 1.9, 58, 8);
      b.obj("ramp", 700, 0);
      b.obj("orb", 721, 0, { h: 4.6 });
      b.obj("ramp", 770, 0);
      b.obj("orb", 791, 0, { h: 4.6 });

      // 갈림길: 오른쪽 화산 증기 지름길 · 왼쪽 얼음 바다(미끄럽고 빙산)
      b.split(955, 1095, { dw: 8, side: "right", mul: 1.2, hw: 21, decor: "rock" });
      b.scen("signShort", 942, 0);
      b.obj("geyser", 990, 14, { offset: 0.3 });
      b.obj("lavaRock", 1020, 16.5, { v: 0.5 });
      b.obj("geyser", 1050, 13, { offset: 1.7 });
      b.obj("pad", 1070, 14.5);
      b.slip(960, 1090, 0.45);
      b.obj("iceberg", 1000, -17, { v: 0.4 });
      b.obj("iceChunk", 1040, -12.5, { v: 0.6 });
      b.obj("orb", 1015, -13);

      // 폭풍 구간: 번개 + 조명 게이트
      b.obj("zap", 1215, -3.5, { offset: 0.2 });
      b.obj("lightGate", 1240, 3);
      b.obj("zap", 1265, 3.5, { offset: 1.8 });
      b.obj("lightGate", 1290, -3);
      b.obj("tentacle", 1320, 0, { offset: 0.6 });

      // 결승 직선: 부스터 연속 + 큰 점프 + 관중석
      b.row("pad", 1425, [0, 0, 0], 36);
      b.obj("bigRamp", 1510, 0);
      b.obj("orb", 1536, 0, { h: 6.8 });
      for (const z of [1440, 1500, 1560, 1620]) {
        b.scen("grandstand", z, -30, { v: 0.4 });
        b.scen("grandstand", z + 30, 31, { v: 0.9 });
      }

      // 구간마다 다른 풍경
      b.scatter(-40, 420, ["isleBig", "sandbar"], { every: 70, near: [30, 90] });
      b.scatter(420, 680, ["pirateShip", "fortTower"], { every: 80, near: [36, 90] });
      b.scatter(680, 940, ["seaStack", "lifeguard"], { every: 60, near: [20, 70] });
      b.scatter(940, 1180, ["volcanoIsle", "glacier"], { every: 90, near: [36, 100] });
      b.scatter(1180, 1420, ["stormCliff", "stormLighthouse"], { every: 90, near: [36, 100] });
      b.scatter(1420, 2000, ["isleBig", "yacht"], { every: 90, near: [50, 110] });
    },
  },
];

/** 레이스 보너스 점수 (기록 경쟁이 중심 — 보너스는 재미 표시용) */
export const BONUS = {
  perfectStart: 100,
  overtake: 100,
  perfectLanding: 200,
  boostChain: 300,
  noCrash: 500,
};
