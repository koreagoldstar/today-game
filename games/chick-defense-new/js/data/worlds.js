/*
 * NEW 둥지디펜스 · 월드 데이터 (전장 · 경로 · 환경 기믹 · 색)
 *  전장은 가로 22 × 세로 14 칸 (1칸 = 1). 좌표 (x, z) 는 칸 단위, 칸 가운데는 .5.
 *  경로(paths)는 꺾이는 점 목록 — 적 이동 · 설치 검증 · 화면의 길 그림이 모두 이 하나를 쓴다.
 *  첫 점은 전장 밖(입구), 마지막 점이 황금 둥지.
 *  gimmick: 실제 규칙에 영향을 주는 환경 효과 (sim/env.js 가 처리 · 화면에 표시)
 */
export const FIELD = { w: 22, d: 14 };

export const WORLDS = [
  {
    id: 1,
    key: "meadow",
    name: "햇살 초원",
    eng: "SUNNY MEADOW",
    waves: [1, 30],
    desc: "바람이 살랑이는 초원. 거북 · 두더지 · 박쥐 도적이 몰려와요!",
    startCoins: 220,
    nest: { x: 19.5, z: 10.5 },
    paths: [
      [
        [-1.5, 2.5],
        [6.5, 2.5],
        [6.5, 7.5],
        [2.5, 7.5],
        [2.5, 11.5],
        [11.5, 11.5],
        [11.5, 4.5],
        [16.5, 4.5],
        [16.5, 10.5],
        [19.5, 10.5],
      ],
    ],
    // 개울(물 · 설치 불가) — 길과 만나는 곳은 다리
    water: [
      [9, 6], [9, 7], [9, 8], [9, 9], [9, 10], [9, 12], [9, 13], [8, 8], [8, 9], [10, 9],
      [14, 1], [15, 1], [14, 2],
    ],
    bridges: [[9, 11]],
    decor: [
      [0, 0, "tree"], [1, 5, "tree"], [4, 0, "rock"], [13, 0, "tree"], [21, 0, "tree"], [21, 5, "rock"],
      [0, 13, "tree"], [5, 13, "flower"], [13, 13, "tree"], [21, 13, "tree"], [18, 0, "rock"], [7, 13, "rock"],
      [20, 7, "tree"], [4, 9, "flower"], [14, 8, "rock"],
    ],
    raised: [[13, 7, 3, 3], [3, 4, 2, 2], [17, 12, 3, 2]], // 높은 언덕 (x, z, 가로, 세로) — 보기만 (설치 가능)
    gimmick: null,
    theme: {
      sky: 0x9fd8ff, fog: 0xbfe6ff, ground: 0x7cc95a, ground2: 0x5fb04a, path: 0xd9b77a, pathEdge: 0xb38d52,
      sun: 0xfff1d0, amb: 0xbfdcff, hemi: [0xcfe9ff, 0x6a8f3a], water: 0x5ec3ff, accent: 0xffd34d,
    },
    music: "meadow",
  },
  {
    id: 2,
    key: "forest",
    name: "버섯 숲",
    eng: "MUSHROOM FOREST",
    waves: [31, 60],
    desc: "포자가 떠다니는 숲. 독 · 증식 · 치료로 버티는 군단이에요.",
    startCoins: 260,
    nest: { x: 19.5, z: 2.5 },
    paths: [
      [
        [11.5, -1.5],
        [11.5, 3.5],
        [3.5, 3.5],
        [3.5, 10.5],
        [8.5, 10.5],
        [8.5, 6.5],
        [15.5, 6.5],
        [15.5, 11.5],
        [19.5, 11.5],
        [19.5, 2.5],
      ],
    ],
    water: [[0, 12], [1, 12], [0, 13], [1, 13], [12, 12], [12, 13]],
    bridges: [],
    decor: [
      [0, 0, "bigShroom"], [6, 0, "bigShroom"], [21, 7, "bigShroom"], [0, 7, "shroom"], [6, 13, "shroom"], [10, 13, "bigShroom"],
      [17, 13, "shroom"], [21, 13, "bigShroom"], [14, 0, "shroom"], [17, 0, "stump"], [12, 9, "stump"], [6, 8, "shroom"],
    ],
    raised: [[10, 8, 3, 2], [5, 5, 2, 3], [16, 8, 2, 2]],
    // 포자 꽃밭: 주기적으로 피어 (미리 반짝) 그 위 적을 회복시킴
    gimmick: {
      kind: "sporeBloom",
      every: 16,
      warn: 2.5,
      dur: 6,
      heal: 0.02, // 초당 최대 체력의 2%
      spots: [
        { x: 3.5, z: 7.2, r: 1.5 },
        { x: 15.5, z: 9.2, r: 1.5 },
      ],
    },
    theme: {
      sky: 0x7a6ab8, fog: 0x9a88c8, ground: 0x74b866, ground2: 0x5a9a54, path: 0xc89c70, pathEdge: 0x8a6444,
      sun: 0xfff0f6, amb: 0xc8b8f0, hemi: [0xd8c8ff, 0x3a5a34], water: 0x7ad1b0, accent: 0xd6a2ff, light: 1.2,
    },
    music: "forest",
  },
  {
    id: 3,
    key: "ice",
    name: "얼음 계곡",
    eng: "FROZEN VALLEY",
    waves: [61, 90],
    desc: "미끄러운 빙판 계곡. 빠른 늑대 무리와 얼음 보호막을 조심해요.",
    startCoins: 300,
    nest: { x: 10.5, z: 12.5 },
    paths: [
      [
        [-1.5, 1.5],
        [19.5, 1.5],
        [19.5, 5.5],
        [2.5, 5.5],
        [2.5, 9.5],
        [17.5, 9.5],
        [17.5, 12.5],
        [10.5, 12.5],
      ],
    ],
    water: [[21, 9], [21, 10], [21, 11], [0, 12], [0, 13], [1, 13]],
    bridges: [],
    decor: [
      [0, 3, "iceRock"], [21, 3, "pine"], [21, 0, "pine"], [0, 7, "pine"], [21, 7, "iceRock"], [6, 12, "pine"],
      [3, 12, "crystal"], [14, 13, "pine"], [20, 13, "crystal"], [11, 7, "crystal"], [5, 3, "iceRock"], [16, 3, "pine"],
    ],
    raised: [[7, 7, 3, 2], [13, 3, 3, 2], [3, 11, 2, 2]],
    // 빙판: 길 위 일부 구간에서 적이 빨라짐 (+25%)
    gimmick: {
      kind: "icePatch",
      speed: 1.25,
      spots: [
        { x: 9.5, z: 1.5, r: 1.6 },
        { x: 11.0, z: 5.5, r: 1.6 },
        { x: 9.5, z: 9.5, r: 1.6 },
      ],
    },
    theme: {
      sky: 0xbfe2ff, fog: 0xdff1ff, ground: 0xe8f4ff, ground2: 0xcfe4f7, path: 0x9fc4e6, pathEdge: 0x6f9cc8,
      sun: 0xf4fbff, amb: 0xbfd8ff, hemi: [0xeaf6ff, 0x7aa3c8], water: 0x8fd7ff, accent: 0x7fe3ff,
    },
    music: "ice",
  },
  {
    id: 4,
    key: "lava",
    name: "용암 협곡",
    eng: "LAVA CANYON",
    waves: [91, 120],
    desc: "두 갈래 길로 쳐들어오는 화염 군단. 용암 분출구를 조심해요!",
    startCoins: 380,
    nest: { x: 19.5, z: 11.5 },
    paths: [
      [
        [-1.5, 2.5],
        [5.5, 2.5],
        [5.5, 7.0],
        [15.5, 7.0],
        [15.5, 2.5],
        [19.5, 2.5],
        [19.5, 11.5],
      ],
      [
        [-1.5, 11.5],
        [7.5, 11.5],
        [7.5, 7.0],
        [15.5, 7.0],
        [15.5, 2.5],
        [19.5, 2.5],
        [19.5, 11.5],
      ],
    ],
    water: [],
    lava: [[0, 6], [0, 7], [1, 7], [12, 12], [13, 12], [12, 13], [13, 13], [21, 0], [21, 1]],
    bridges: [],
    decor: [
      [3, 5, "volRock"], [10, 0, "volRock"], [3, 13, "volRock"], [16, 12, "ashTree"], [21, 6, "volRock"], [11, 4, "ashTree"],
      [0, 0, "volRock"], [9, 13, "ashTree"], [17, 9, "volRock"],
    ],
    raised: [[9, 9, 3, 2], [8, 3, 2, 2]],
    // 용암 분출구: 미리 끓어오른 뒤 분출 → 근처 길에 불 지대(적의 감속 · 빙결이 풀림) · 근처 타워 과열(공격속도 -20%)
    gimmick: {
      kind: "lavaVent",
      every: 14,
      warn: 2.2,
      zoneDur: 4,
      heatDur: 2.5,
      heat: 0.8,
      vents: [
        { x: 11.5, z: 9.5, r: 1.8 },
        { x: 12.5, z: 4.5, r: 1.8 },
      ],
    },
    theme: {
      sky: 0x5a2a32, fog: 0x7a3a34, ground: 0xa08a80, ground2: 0x7c6660, path: 0xd8a882, pathEdge: 0x8a5a44,
      sun: 0xffd0a8, amb: 0xffa47a, hemi: [0xffb08a, 0x3a2222], water: 0xff6a1a, accent: 0xff8a3a, light: 1.3,
    },
    music: "lava",
  },
  {
    id: 5,
    key: "castle",
    name: "어둠의 성채",
    eng: "SHADOW CITADEL",
    waves: [121, 150],
    desc: "환영과 저주의 성채. 그림자 속 적은 가까운 타워만 볼 수 있어요.",
    startCoins: 450,
    nest: { x: 6.5, z: 11.5 },
    paths: [
      [
        [10.5, -1.5],
        [10.5, 2.5],
        [3.5, 2.5],
        [3.5, 7.5],
        [18.5, 7.5],
        [18.5, 11.5],
        [6.5, 11.5],
      ],
    ],
    water: [],
    bridges: [],
    decor: [
      [0, 0, "spire"], [21, 0, "spire"], [0, 13, "spire"], [21, 13, "spire"], [14, 0, "grave"], [7, 5, "grave"],
      [15, 4, "lamp"], [0, 9, "grave"], [12, 13, "lamp"], [21, 9, "grave"], [1, 4, "lamp"],
    ],
    raised: [[12, 3, 3, 3], [8, 9, 2, 1], [19, 3, 2, 2]],
    // 그림자 구역: 안에 있는 적은 2.2칸 안의 타워만 볼 수 있음
    gimmick: {
      kind: "shadow",
      sight: 2.2,
      spots: [
        { x: 11.5, z: 7.5, r: 2.2 },
        { x: 13.0, z: 11.5, r: 2.0 },
      ],
    },
    theme: {
      sky: 0x2e2650, fog: 0x3e3468, ground: 0x938cc0, ground2: 0x746ea4, path: 0xc4bcec, pathEdge: 0x7068a8,
      sun: 0xe6dcff, amb: 0xa294e6, hemi: [0xb0a2f0, 0x1e1a30], water: 0x7a4cff, accent: 0xb48cff, light: 1.45,
    },
    music: "castle",
  },
];

export const worldById = (id) => WORLDS.find((w) => w.id === id);
/** 전체 웨이브 번호(1~150) → 월드 */
export const worldOfWave = (n) => WORLDS.find((w) => n >= w.waves[0] && n <= w.waves[1]);
