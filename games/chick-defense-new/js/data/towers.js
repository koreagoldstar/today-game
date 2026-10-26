/*
 * NEW 둥지디펜스 · 타워 데이터 (6종 · 강화 3단계 → 진화 2갈래 × 2단계 = 5단계)
 *  levels[0] 은 설치할 때, levels[1..] 은 강화 (cost = 그 단계로 올리는 값)
 *  evos.X.levels[0] 은 진화할 때 (cost = evos.X.cost), [1] 은 진화 뒤 한 번 더 강화
 *  화면에 보이는 수치는 sim/towers.js 의 statsOf() 가 계산한 값을 그대로 쓴다 (전투와 같음).
 *  air: 하늘(비행) 적을 맞힐 수 있는지 · ground: 땅 위 적
 *  dmgType: phys(갑옷에 막힘) · blast(갑옷 절반) · ice · shock(갑옷 무시) · fire · none
 */
export const TOWERS = {
  archer: {
    name: "병아리 궁수",
    short: "궁수",
    icon: "🏹",
    cost: 60,
    air: true,
    ground: true,
    dmgType: "phys",
    attack: "arrow",
    desc: "빠르게 한 마리씩 쏴요. 하늘도 쏠 수 있어요.",
    levels: [
      { dmg: 8, rate: 1.4, range: 3.2 },
      { dmg: 12, rate: 1.55, range: 3.4, cost: 45 },
      { dmg: 17, rate: 1.7, range: 3.6, cost: 75 },
    ],
    evos: {
      rapid: {
        name: "속사 궁수",
        desc: "공격속도가 두 배 넘게 빨라져요.",
        cost: 150,
        attack: "arrow",
        levels: [
          { dmg: 15, rate: 3.8, range: 3.7 },
          { dmg: 21, rate: 4.4, range: 3.9, cost: 190 },
        ],
      },
      pierce: {
        name: "관통 궁수",
        desc: "커다란 화살이 일직선으로 여러 마리를 꿰뚫어요.",
        cost: 160,
        attack: "pierceArrow",
        levels: [
          { dmg: 34, rate: 1.3, range: 4.3, pierce: 4 },
          { dmg: 46, rate: 1.4, range: 4.6, pierce: 6, cost: 200 },
        ],
      },
    },
  },
  bomb: {
    name: "폭탄 병아리",
    short: "폭탄",
    icon: "💣",
    cost: 85,
    air: false,
    ground: true,
    dmgType: "blast",
    attack: "bomb",
    desc: "폭탄을 던져 둘레 적을 한꺼번에! 하늘은 못 맞혀요.",
    levels: [
      { dmg: 18, rate: 0.75, range: 2.9, splash: 1.25 },
      { dmg: 26, rate: 0.8, range: 3.0, splash: 1.35, cost: 60 },
      { dmg: 36, rate: 0.85, range: 3.1, splash: 1.45, cost: 95 },
    ],
    evos: {
      fire: {
        name: "화염 폭탄",
        desc: "맞은 적이 불타서 계속 피해를 입어요.",
        cost: 170,
        attack: "bomb",
        levels: [
          { dmg: 34, rate: 0.85, range: 3.2, splash: 1.4, burn: 12, burnT: 3 },
          { dmg: 46, rate: 0.9, range: 3.3, splash: 1.5, burn: 18, burnT: 3, cost: 210 },
        ],
      },
      shock: {
        name: "충격 폭탄",
        desc: "아주 넓게 터지고 적을 잠깐 멈춰요.",
        cost: 180,
        attack: "bomb",
        levels: [
          { dmg: 40, rate: 0.7, range: 3.2, splash: 2.2, stun: 0.35 },
          { dmg: 55, rate: 0.72, range: 3.3, splash: 2.4, stun: 0.45, cost: 220 },
        ],
      },
    },
  },
  ice: {
    name: "얼음 토끼",
    short: "얼음",
    icon: "❄️",
    cost: 75,
    air: true,
    ground: true,
    dmgType: "ice",
    attack: "iceShard",
    desc: "얼음 조각으로 적을 느리게 해요.",
    levels: [
      { dmg: 4, rate: 1.0, range: 2.8, slow: 0.35, slowT: 2 },
      { dmg: 6, rate: 1.05, range: 3.0, slow: 0.4, slowT: 2, cost: 55 },
      { dmg: 8, rate: 1.1, range: 3.2, slow: 0.45, slowT: 2.2, cost: 85 },
    ],
    evos: {
      freezer: {
        name: "빙결 전문가",
        desc: "가끔 적을 꽁꽁 얼려 멈춰요 (보스는 느려지기만).",
        cost: 165,
        attack: "iceShard",
        levels: [
          { dmg: 12, rate: 1.1, range: 3.3, slow: 0.5, slowT: 2.2, freeze: 0.22, freezeT: 1.0 },
          { dmg: 16, rate: 1.15, range: 3.5, slow: 0.52, slowT: 2.4, freeze: 0.3, freezeT: 1.2, cost: 200 },
        ],
      },
      frostField: {
        name: "서리 장판",
        desc: "길 위에 서리 장판을 깔아 지나가는 적을 모두 느리게 해요.",
        cost: 170,
        attack: "frostLob",
        air: false,
        levels: [
          { dmg: 6, rate: 0.55, range: 3.3, slow: 0.55, zoneR: 1.25, zoneT: 3.5, zoneMax: 2 },
          { dmg: 10, rate: 0.6, range: 3.5, slow: 0.6, zoneR: 1.45, zoneT: 3.8, zoneMax: 3, cost: 210 },
        ],
      },
    },
  },
  lightning: {
    name: "번개 다람쥐",
    short: "번개",
    icon: "⚡",
    cost: 110,
    air: true,
    ground: true,
    dmgType: "shock",
    attack: "chain",
    desc: "적 사이로 튕기는 번개! 갑옷을 무시해요.",
    levels: [
      { dmg: 14, rate: 0.9, range: 3.0, chain: 3, jump: 2.0, decay: 0.8 },
      { dmg: 19, rate: 0.95, range: 3.1, chain: 4, jump: 2.0, decay: 0.8, cost: 75 },
      { dmg: 25, rate: 1.0, range: 3.2, chain: 5, jump: 2.1, decay: 0.8, cost: 110 },
    ],
    evos: {
      storm: {
        name: "폭풍 다람쥐",
        desc: "번개가 훨씬 많이 튕겨요.",
        cost: 200,
        attack: "chain",
        levels: [
          { dmg: 28, rate: 1.0, range: 3.3, chain: 8, jump: 2.3, decay: 0.85 },
          { dmg: 36, rate: 1.05, range: 3.4, chain: 10, jump: 2.4, decay: 0.86, cost: 240 },
        ],
      },
      thunder: {
        name: "벼락 다람쥐",
        desc: "하늘에서 큰 벼락을 내리꽂아 둘레를 멈춰요.",
        cost: 210,
        attack: "bolt",
        levels: [
          { dmg: 120, rate: 0.5, range: 3.6, splash: 1.1, stun: 0.5 },
          { dmg: 170, rate: 0.52, range: 3.8, splash: 1.3, stun: 0.6, cost: 250 },
        ],
      },
    },
  },
  cannon: {
    name: "대포 곰",
    short: "대포",
    icon: "🐻",
    cost: 130,
    air: false,
    ground: true,
    dmgType: "phys",
    attack: "shell",
    desc: "느리지만 묵직한 포탄. 갑옷을 뚫어요. 하늘은 못 맞혀요.",
    levels: [
      { dmg: 42, rate: 0.45, range: 3.6, splash: 0.7, ap: 0.45 },
      { dmg: 60, rate: 0.47, range: 3.75, splash: 0.7, ap: 0.5, cost: 90 },
      { dmg: 85, rate: 0.5, range: 3.9, splash: 0.75, ap: 0.55, cost: 130 },
    ],
    evos: {
      siege: {
        name: "공성 곰",
        desc: "거대한 포탄 한 방! 맞은 적의 갑옷을 깎아요.",
        cost: 240,
        attack: "shell",
        levels: [
          { dmg: 230, rate: 0.38, range: 4.4, splash: 0.6, ap: 0.7, shred: 0.15 },
          { dmg: 320, rate: 0.4, range: 4.6, splash: 0.65, ap: 0.75, shred: 0.18, cost: 280 },
        ],
      },
      scatter: {
        name: "산탄 곰",
        desc: "포탄 세 발을 서로 다른 적에게 한꺼번에 쏴요.",
        cost: 230,
        attack: "scatter",
        levels: [
          { dmg: 70, rate: 0.55, range: 3.9, splash: 0.8, ap: 0.5, shots: 3 },
          { dmg: 95, rate: 0.58, range: 4.1, splash: 0.85, ap: 0.55, shots: 3, cost: 270 },
        ],
      },
    },
  },
  healer: {
    name: "치유 수호자",
    short: "수호자",
    icon: "💚",
    cost: 100,
    air: false,
    ground: false,
    dmgType: "none",
    attack: "aura",
    support: true,
    desc: "둘레 타워의 공격속도를 올려 줘요 (여러 수호자가 겹치면 가장 센 것 하나만).",
    levels: [
      { range: 2.2, buff: 0.15 },
      { range: 2.4, buff: 0.2, cost: 70 },
      { range: 2.6, buff: 0.25, cost: 100 },
    ],
    evos: {
      cheer: {
        name: "응원 대장",
        desc: "더 크게 응원하고 사거리도 올리며, 3초마다 둘레 타워의 저주 · 덩굴 · 서리를 풀어요.",
        cost: 190,
        attack: "aura",
        levels: [
          { range: 2.8, buff: 0.32, rangeBuff: 0.1, cleanse: 3 },
          { range: 3.0, buff: 0.4, rangeBuff: 0.12, cleanse: 2.5, cost: 220 },
        ],
      },
      guardian: {
        name: "둥지 지킴이",
        desc: "둥지 방어막을 조금씩 채워요. 응원은 조금 약해요.",
        cost: 180,
        attack: "aura",
        levels: [
          { range: 2.4, buff: 0.15, shieldEvery: 12, shieldMax: 8 },
          { range: 2.6, buff: 0.2, shieldEvery: 9, shieldMax: 10, cost: 220 },
        ],
      },
    },
  },
};

export const TOWER_ORDER = ["archer", "bomb", "ice", "lightning", "cannon", "healer"];
export const SELL_RATE = 0.7;
export const TARGET_MODES = [
  { id: "first", name: "맨 앞" },
  { id: "strong", name: "가장 센 적" },
  { id: "close", name: "가까운 적" },
  { id: "last", name: "맨 뒤" },
];
