/*
 * NEW 둥지디펜스 · 적 데이터
 *  world: 0 은 공통 적, 1~5 는 그 월드 특화 적. minion: 다른 적이 만든 작은 몬스터 (특화 적 수에 안 셈)
 *  hp · speed(칸/초) · armor(물리 피해 감소 0~0.8) · reward(코인) · leak(둥지에 닿으면 깎는 체력)
 *  resist: { phys, blast, fire, ice, shock } (피해 종류별) 1 = 면역, 음수 = 약점
 *  ab: 특수 능력 (sim/enemies.js 가 실제로 처리) — 이름 → 설정값
 *  desc: 화면에 보이는 설명 · tip: 대응법
 *  체력은 월드 · 웨이브 배율이 곱해진다 (data/waves.js).
 */
export const ENEMIES = {
  /* ---------- 공통 ---------- */
  slime: { name: "말랑 슬라임", world: 0, hp: 30, speed: 1.15, reward: 5, size: 0.42, desc: "가장 흔한 몬스터예요.", tip: "궁수 하나로도 충분해요." },
  fox: { name: "꾀돌이 여우", world: 0, hp: 22, speed: 1.85, reward: 5, size: 0.4, desc: "아주 빨리 달려요.", tip: "얼음 토끼로 느리게 만들어요." },
  beetle: { name: "돌돌 딱정벌레", world: 0, hp: 75, speed: 0.85, armor: 0.3, reward: 8, size: 0.45, desc: "껍질이 단단해 화살이 덜 들어요.", tip: "대포 곰 · 번개가 잘 들어요." },

  /* ---------- 월드 1 · 햇살 초원 ---------- */
  turtle: {
    name: "바위 등딱지 거북", world: 1, hp: 95, speed: 0.8, armor: 0.2, reward: 10, size: 0.5,
    ab: { defend: { every: 5.5, dur: 2.5, armor: 0.6, speed: 0.35, first: 2 } },
    desc: "가끔 등껍질에 쏙 숨어 피해를 크게 줄이고 느려져요.", tip: "숨었을 때는 번개(방어 무시)나 폭탄으로!",
  },
  mole: {
    name: "땅굴 두더지", world: 1, hp: 55, speed: 1.05, reward: 8, size: 0.42,
    ab: { burrow: { every: 5, dur: 2.0, speed: 1.9, max: 2, warn: 0.6, first: 3 } },
    desc: "땅속으로 숨어 빠르게 앞으로 간 뒤 다시 나와요. 땅속에선 공격할 수 없어요.", tip: "흙더미가 솟는 곳 근처에 타워를 두세요.",
  },
  bat: {
    name: "박쥐 도적", world: 1, hp: 28, speed: 1.95, reward: 7, size: 0.38, flying: true,
    ab: { thief: { steal: 6 } },
    desc: "하늘을 나는 도둑! 둥지에 닿으면 코인도 훔쳐 가요.", tip: "폭탄 · 대포는 하늘을 못 쏴요. 궁수 · 번개로!",
  },
  shroomSplit: {
    name: "버섯 분열체", world: 1, hp: 70, speed: 1.0, reward: 7, size: 0.46,
    ab: { split: { into: "sprout", n: 2, maxGen: 1 } },
    desc: "쓰러지면 꼬마 버섯 두 마리로 갈라져요.", tip: "폭탄으로 한꺼번에 정리해요.",
  },
  sprout: { name: "꼬마 버섯", world: 1, minion: true, hp: 22, speed: 1.45, reward: 2, size: 0.3, desc: "분열체에서 나온 작은 버섯." },
  boar: {
    name: "갑옷 멧돼지", world: 1, hp: 120, speed: 0.9, armor: 0.15, reward: 11, size: 0.52,
    ab: { charge: { every: 5, warn: 0.8, dur: 1.1, mult: 2.8, first: 2.5 } },
    desc: "발을 구르며 준비한 뒤 짧게 돌진해요.", tip: "얼음 토끼로 돌진 속도를 줄여요.",
  },
  featherHealer: {
    name: "깃털 치료사", world: 1, hp: 55, speed: 0.95, reward: 10, size: 0.42,
    ab: { heal: { every: 3, r: 3, pct: 0.12, bossPct: 0.03, maxTotal: 1, look: "feather" } },
    desc: "가장 많이 다친 친구를 깃털로 크게 치료해요.", tip: "치료사부터 먼저 쓰러뜨려요 (타깃: 가장 강한 적 / 맨 앞).",
  },

  /* ---------- 월드 2 · 버섯 숲 ---------- */
  poisonSpore: {
    name: "독버섯 스포어", world: 2, hp: 70, speed: 1.0, reward: 9, size: 0.45,
    ab: { poisonTrail: { every: 1.3, r: 0.9, dur: 3.5, max: 3, towerRate: 0.8, heal: 0.015 } },
    desc: "지나간 자리에 독 구름을 남겨요. 구름 옆 타워는 콜록콜록 느려지고, 구름 속 적은 조금씩 회복해요.", tip: "길 초반에서 빨리 처치해요.",
  },
  sporeBomb: {
    name: "포자 폭탄충", world: 2, hp: 60, speed: 1.15, reward: 9, size: 0.42,
    ab: { deathBlast: { warn: 0.6, r: 1.7, stun: 1.2 } },
    desc: "쓰러지면 부풀어 오른 뒤 펑! 근처 타워를 잠깐 멈춰요.", tip: "사거리가 긴 타워로 멀리서 터뜨려요.",
  },
  vineCrawler: {
    name: "덩굴 기어충", world: 2, hp: 85, speed: 0.95, reward: 10, size: 0.44,
    ab: { vine: { r: 1.5, rate: 0.6, dur: 3, cd: 4 } },
    desc: "옆을 지나가며 타워를 덩굴로 감아 공격속도를 늦춰요.", tip: "길에서 조금 떨어진 곳의 타워는 안전해요.",
  },
  cloner: {
    name: "버섯 복제술사", world: 2, hp: 90, speed: 0.85, reward: 12, size: 0.46,
    ab: { summon: { every: 4, n: 2, type: "miniShroom", max: 3, first: 2 } },
    desc: "꼬마 버섯을 불러내요 (최대 3번).", tip: "빨리 처치하면 덜 불러요.",
  },
  miniShroom: { name: "꼬마 독버섯", world: 2, minion: true, hp: 18, speed: 1.3, reward: 1, size: 0.28, desc: "복제술사가 부른 꼬마." },
  beeHealer: {
    name: "꿀벌 치료사", world: 2, hp: 45, speed: 1.3, reward: 10, size: 0.36, flying: true,
    ab: { heal: { every: 1.6, r: 3.5, pct: 0.07, bossPct: 0.02, maxTotal: 0.8, look: "honey" } },
    desc: "날아다니며 꿀방울로 자주 조금씩 치료해요.", tip: "하늘을 쏘는 궁수 · 번개로!",
  },
  shroomKnight: {
    name: "거대 버섯 갑각병", world: 2, hp: 260, speed: 0.62, armor: 0.55, reward: 18, leak: 2, size: 0.62, resist: { blast: 0.4, fire: -0.35, shock: -0.2 },
    desc: "두꺼운 버섯 갑옷이라 화살 · 폭발을 잘 버텨요. 대신 불과 번개에 약해요.", tip: "화염 폭탄 · 번개 · 대포 곰(갑옷 관통)으로!",
  },

  /* ---------- 월드 3 · 얼음 계곡 ---------- */
  iceWolf: {
    name: "얼음 늑대", world: 3, hp: 60, speed: 1.7, reward: 6, size: 0.44, resist: { ice: 0.3 },
    ab: { dash: { every: 4, warn: 0.5, dur: 0.8, mult: 2.1, first: 1.5 } },
    desc: "무리 지어 달려오고, 몸을 낮춘 뒤 확 튀어 나가요.", tip: "번개 연쇄 · 폭탄이 무리에 좋아요.",
  },
  frostBat: {
    name: "서리 박쥐", world: 3, hp: 50, speed: 1.5, reward: 9, size: 0.38, flying: true, resist: { ice: 0.5 },
    ab: { perch: { fly: 3, land: 1.5 }, frostBite: { r: 1.6, rate: 0.7, dur: 2, cd: 3 } },
    desc: "날다가 잠깐 내려앉기를 반복해요. 스치는 타워를 얼려 느리게 해요.", tip: "내려앉았을 때는 폭탄 · 대포도 맞힐 수 있어요.",
  },
  frostGolem: {
    name: "빙결 골렘", world: 3, hp: 180, speed: 0.7, armor: 0.2, reward: 16, size: 0.6, resist: { ice: 0.6 },
    ab: { iceShield: { every: 7, pct: 0.3, first: 1 } },
    desc: "얼음 보호막(파란 막대)을 두르고, 깨지면 잠깐 휘청여요.", tip: "보호막이 깨진 틈을 노려요.",
  },
  blizzardSpirit: {
    name: "눈보라 정령", world: 3, hp: 80, speed: 0.95, reward: 12, size: 0.42,
    ab: { armorAura: { every: 5, r: 3, armor: 0.25, dur: 3 } },
    desc: "주변 적에게 눈보라 갑옷을 입혀 피해를 줄여요.", tip: "정령을 먼저 처치하면 무리가 약해져요.",
  },
  crystalBug: {
    name: "얼음 수정충", world: 3, hp: 70, speed: 1.0, reward: 11, size: 0.4,
    ab: { shieldGive: { every: 6, r: 2.5, pct: 0.15, n: 3, first: 2 } },
    desc: "근처 적 셋에게 얼음 보호막을 나눠 줘요.", tip: "번개는 보호막 위로도 잘 퍼져요.",
  },
  snowShade: {
    name: "설원 그림자", world: 3, hp: 75, speed: 1.35, reward: 11, size: 0.42,
    ab: { dodge: { chance: 0.35, charges: 3, cd: 3, blink: 0.7, inv: 0.25 } },
    desc: "공격을 휙 피해 앞으로 순간이동해요 (최대 3번).", tip: "번개 · 폭발은 피할 수 없어요.",
  },

  /* ---------- 월드 4 · 용암 협곡 ---------- */
  lavaLizard: {
    name: "용암 도마뱀", world: 4, hp: 95, speed: 1.15, reward: 10, size: 0.44, resist: { fire: 0.6 },
    ab: { fireTrail: { every: 1.1, r: 0.9, dur: 2.5, max: 3, towerRate: 0.85 } },
    desc: "불 자국을 남겨요. 불 위의 적은 얼음 효과가 풀리고, 옆 타워는 과열돼요.", tip: "불 자국이 사라진 뒤 얼려요.",
  },
  emberBat: {
    name: "불씨 박쥐", world: 4, hp: 60, speed: 1.9, reward: 9, size: 0.38, flying: true, resist: { fire: 0.5 },
    ab: { emberDrop: { r: 1, dur: 3 } },
    desc: "불꽃 꼬리를 남기며 빠르게 날아요. 쓰러지면 길에 불씨가 떨어져요.", tip: "궁수 · 번개로 하늘을 지켜요.",
  },
  magmaGolem: {
    name: "마그마 골렘", world: 4, hp: 260, speed: 0.65, armor: 0.3, reward: 20, leak: 2, size: 0.64, resist: { fire: 0.8 },
    ab: { absorb: { every: 8, dur: 2.5, cut: 0.7, warn: 1, r: 2, stun: 1, first: 3 } },
    desc: "몸을 굳혀 피해를 막은 뒤, 붉게 빛나다 펑 터져 근처 타워를 멈춰요.", tip: "굳기 전에 몰아쳐요. 터지는 범위(빨간 원)를 보세요.",
  },
  fireBomber: {
    name: "화염 폭탄병", world: 4, hp: 90, speed: 1.1, reward: 12, size: 0.42,
    ab: { selfDestruct: { near: 4.5, arm: 2, leak: 4 } },
    desc: "둥지 가까이 오면 심지에 불을 붙여요. 터지면 둥지가 크게 다쳐요!", tip: "심지가 타는 동안 처치하면 터지지 않아요.",
  },
  fireBoar: {
    name: "철갑 화염 멧돼지", world: 4, hp: 150, speed: 0.9, armor: 0.2, reward: 16, size: 0.54,
    ab: { shieldCharge: { shieldPct: 0.45, every: 4.5, warn: 0.6, dur: 1.3, mult: 2.6, weakSpeed: 0.75 } },
    desc: "불꽃 보호막을 두르고 돌진해요. 보호막이 깨지면 돌진을 못 해요.", tip: "보호막을 먼저 깨요.",
  },
  ashShaman: {
    name: "재의 주술사", world: 4, hp: 100, speed: 0.9, reward: 14, size: 0.42,
    ab: { rageAura: { every: 4, r: 3, speed: 1.25, leakAdd: 1, dur: 4 } },
    desc: "주변 적을 화나게 해 빨라지고 둥지를 더 세게 쳐요.", tip: "주술사부터!",
  },

  /* ---------- 월드 5 · 어둠의 성채 ---------- */
  shadowKnight: {
    name: "그림자 기사", world: 5, hp: 220, speed: 0.8, armor: 0.25, reward: 18, size: 0.56,
    ab: { frontGuard: { cut: 0.6, cos: 0.45 } },
    desc: "앞에서 오는 공격은 방패로 60% 막아요. 옆 · 뒤는 그대로 맞아요.", tip: "기사가 지나간 뒤쪽(길 앞쪽이 아닌 곳)에도 타워를 두세요.",
  },
  illusionCrow: {
    name: "환영 까마귀", world: 5, hp: 80, speed: 1.4, reward: 13, size: 0.4, flying: true,
    ab: { clones: { every: 5, n: 2, maxAlive: 2, casts: 3, first: 1.5 } },
    desc: "가짜 분신을 만들어 공격을 흩어요. 분신은 반투명하고 그림자가 없어요.", tip: "번개 연쇄가 분신을 한꺼번에 지워요.",
  },
  crowClone: { name: "까마귀 분신", world: 5, minion: true, hp: 1, speed: 1.4, reward: 0, leak: 0, size: 0.4, flying: true, illusion: true, desc: "한 번 맞으면 사라지는 가짜." },
  soulReaper: {
    name: "영혼 수확자", world: 5, hp: 140, speed: 1.0, reward: 15, size: 0.48,
    ab: { soulFeed: { r: 3, speed: 0.15, armor: 0.1, max: 3, dur: 6 } },
    desc: "근처 적이 쓰러질 때마다 영혼을 모아 빨라지고 단단해져요 (최대 3).", tip: "수확자를 먼저 쓰러뜨려요.",
  },
  darkSummoner: {
    name: "암흑 소환사", world: 5, hp: 150, speed: 0.8, reward: 18, size: 0.46,
    ab: { summonPast: { every: 6, max: 4, pool: ["mole", "boar", "sporeBomb", "iceWolf", "lavaLizard"], first: 3 } },
    desc: "지난 월드의 몬스터를 불러내요 (최대 4번).", tip: "멀리서부터 집중 공격!",
  },
  curseCaster: {
    name: "저주술사", world: 5, hp: 110, speed: 0.9, reward: 14, size: 0.42,
    ab: { curse: { every: 5, r: 3, dmg: 0.65, dur: 4, first: 2 } },
    desc: "보라색 원 안의 타워 공격력을 잠시 낮춰요.", tip: "치유 수호자(응원 대장)가 저주를 풀어 줘요.",
  },
  voidEater: {
    name: "공허 포식자", world: 5, hp: 200, speed: 0.85, reward: 18, leak: 2, size: 0.56,
    ab: { frenzy: { at: 0.4, warn: 1, speed: 1.9, leakMul: 2 } },
    desc: "체력이 줄면 부들부들 떨다 폭주해 빨라지고 둥지를 두 배로 쳐요. 대신 갑옷이 벗겨져요.", tip: "폭주 직전 감속을 걸어 둬요.",
  },
};

/*
 * 보스 (월드마다 2종) — 패턴은 sim/bosses.js
 */
export const BOSSES = {
  crownSlime: { name: "왕관 슬라임", world: 1, hp: 2200, speed: 0.5, armor: 0, reward: 120, leak: 8, size: 1.25, desc: "쿵! 뛰어올라 착지 충격파로 타워를 멈추고 슬라임을 불러요." },
  ironBoarChief: { name: "철갑 멧돼지 대장", world: 1, hp: 2000, speed: 0.55, armor: 0.3, reward: 180, leak: 10, size: 1.3, desc: "돌진 · 충격파 · 갑옷 강화! 지친 틈에 몰아쳐요." },
  sporeQueen: { name: "포자 여왕", world: 2, hp: 2300, speed: 0.5, reward: 200, leak: 10, size: 1.3, desc: "포자 구역을 퍼뜨리고 버섯 군단을 불러요." },
  mushroomColossus: { name: "고대 버섯 거신", world: 2, hp: 3000, speed: 0.42, armor: 0.4, reward: 260, leak: 12, size: 1.55, resist: { blast: 0.3, fire: -0.2 }, desc: "땅을 내려쳐 넓게 타워를 멈추고, 보호막 뒤 약점을 드러내요." },
  glacierGuardian: { name: "빙하 수호자", world: 3, hp: 2000, speed: 0.45, armor: 0.3, reward: 260, leak: 12, size: 1.45, resist: { ice: 0.8 }, desc: "얼음 보호막과 지면 빙결! 보호막이 깨지면 약점이 보여요." },
  blizzardQueen: { name: "눈보라의 여왕", world: 3, hp: 3400, speed: 0.55, reward: 320, leak: 14, size: 1.35, hover: true, resist: { ice: 0.8 }, desc: "넓은 눈보라와 얼음 창. 체력이 줄면 패턴이 바뀌어요." },
  magmaColossus: { name: "마그마 거신", world: 4, hp: 2400, speed: 0.42, armor: 0.35, reward: 330, leak: 14, size: 1.6, resist: { fire: 0.7 }, desc: "용암 충격파 · 화염 · 방어 자세 뒤 약점." },
  ignis: { name: "화산왕 이그니스", world: 4, hp: 2600, speed: 0.55, reward: 380, leak: 15, size: 1.45, resist: { fire: 0.8 }, desc: "불 지대 · 돌진 폭발 · 하늘에서 떨어지는 화산탄." },
  darkLord: { name: "어둠의 군주", world: 5, hp: 2400, speed: 0.45, armor: 0.35, reward: 400, leak: 15, size: 1.5, desc: "그림자 군단과 저주 구역. 방어와 공격 자세를 바꿔요." },
  ravenKing: { name: "그림자 까마귀 마왕", world: 5, hp: 4200, speed: 0.5, reward: 600, leak: 20, size: 1.6, final: true, desc: "날다 내려앉고, 분신을 부르고, 둥지를 노려요. 마지막 보스!" },
};

export const ELITE = { hp: 3, speed: 1.1, reward: 3, leak: 2, size: 1.25, armor: 0.1 };

export const defOf = (type) => ENEMIES[type] || BOSSES[type];
export const isBoss = (type) => !!BOSSES[type];
/** 월드 특화 적 (꼬마 · 분신 제외) */
export const specialsOf = (world) => Object.entries(ENEMIES).filter(([, d]) => d.world === world && !d.minion).map(([k]) => k);
export const bossesOf = (world) => Object.entries(BOSSES).filter(([, d]) => d.world === world).map(([k]) => k);
