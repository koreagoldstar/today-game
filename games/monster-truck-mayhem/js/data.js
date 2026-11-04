/* 몬스터 트럭 대소동 — 수치 데이터 (트럭 · 업그레이드 · 부서지는 물체) */

/**
 * 트럭 성능. accel m/s², top m/s, mass 톤, power 파괴력(충돌 에너지 배수),
 * grip 접지력, iceGrip 얼음 · 눈 배수, turn 회전, boost 부스터 지속, jump 점프, air 공중 자세, armor 피해 감소, wheelR 바퀴 반지름.
 */
export const TRUCKS = [
  { id: "thunder", name: "THUNDER BEAST", ko: "썬더 비스트", grade: "밸런스", desc: "전기처럼 푸른 대표 트럭. 무엇이든 무난하게 잘해요.", price: 0, accel: 13.5, top: 25, mass: 5, power: 1, grip: 1, iceGrip: 1, turn: 1, boost: 1, jump: 1, air: 1, armor: 1, wheelR: 1.08, wb: 3.7, tw: 3.1, engine: 1 },
  { id: "iron", name: "IRON BULL", ko: "아이언 불", grade: "파괴형", desc: "무겁고 튼튼해요. 콘크리트도 한 번에 뚫어요.", price: 1500, accel: 11.5, top: 23.5, mass: 7.5, power: 1.55, grip: 1, iceGrip: 1, turn: 0.86, boost: 0.9, jump: 0.85, air: 0.75, armor: 1.5, wheelR: 1.14, wb: 3.9, tw: 3.3, engine: 0.72 },
  { id: "rocket", name: "ROCKET HOG", ko: "로켓 호그", grade: "점프형", desc: "가볍고 빨라요. 높이 뛰고 공중에서 잘 돌아요.", price: 1800, accel: 14.5, top: 27.5, mass: 3.9, power: 0.8, grip: 0.94, iceGrip: 1, turn: 1.08, boost: 1.2, jump: 1.32, air: 1.35, armor: 0.8, wheelR: 1.0, wb: 3.5, tw: 2.9, engine: 1.35 },
  { id: "frost", name: "FROST BITE", ko: "프로스트 바이트", grade: "얼음 특화", desc: "스파이크 타이어. 얼음과 눈에서 미끄러지지 않아요.", price: 2200, accel: 13, top: 24.5, mass: 5.2, power: 1.05, grip: 1, iceGrip: 2.5, turn: 1, boost: 1, jump: 1, air: 1, armor: 1.1, wheelR: 1.08, wb: 3.7, tw: 3.2, engine: 0.9 },
  { id: "flame", name: "FLAME JAW", ko: "플레임 조", grade: "부스터형", desc: "엄청난 가속. 부스터가 오래가고 더 빨라요.", price: 2800, accel: 17, top: 26.5, mass: 4.6, power: 1, grip: 0.98, iceGrip: 1, turn: 1, boost: 1.55, jump: 1, air: 1, armor: 0.95, wheelR: 1.06, wb: 3.6, tw: 3.0, engine: 1.2 },
  { id: "toxic", name: "TOXIC WHEEL", ko: "톡식 휠", grade: "민첩형", desc: "버기처럼 날렵해요. 급커브도 쉽게 돌아요.", price: 2800, accel: 15, top: 25.5, mass: 3.8, power: 0.85, grip: 1.3, iceGrip: 1.2, turn: 1.35, boost: 1, jump: 1.12, air: 1.2, armor: 0.85, wheelR: 1.02, wb: 3.3, tw: 3.0, engine: 1.45 },
  { id: "mega", name: "MEGA REX", ko: "메가 렉스", grade: "초대형", desc: "공룡처럼 거대해요. 부딪히는 모든 것이 날아가요.", price: 4800, accel: 11.5, top: 23.5, mass: 10, power: 2, grip: 1, iceGrip: 1, turn: 0.78, boost: 0.95, jump: 0.92, air: 0.65, armor: 1.8, wheelR: 1.32, wb: 4.4, tw: 3.7, engine: 0.6 },
  { id: "golden", name: "GOLDEN CRUSHER", ko: "골든 크러셔", grade: "최종 보상", desc: "메가 스타디움을 정복한 챔피언의 트럭. 모든 능력이 최고예요.", price: 0, unlock: "final", accel: 16, top: 28, mass: 6.5, power: 1.8, grip: 1.2, iceGrip: 1.6, turn: 1.1, boost: 1.4, jump: 1.15, air: 1.2, armor: 1.6, wheelR: 1.16, wb: 3.8, tw: 3.3, engine: 0.85 },
];
export const truckById = (id) => TRUCKS.find((t) => t.id === id) || TRUCKS[0];

export const UPGRADES = [
  { id: "engine", name: "엔진", desc: "가속 · 최고 속도" },
  { id: "tire", name: "타이어", desc: "접지력 · 회전" },
  { id: "susp", name: "서스펜션", desc: "착지 안정성" },
  { id: "body", name: "차체", desc: "충돌 내구성 · 파괴력" },
  { id: "boost", name: "부스터", desc: "부스터 지속시간" },
];
export const UPGRADE_MAX = 5;
export const upgradeCost = (truck, level) => Math.round((180 + truck.price * 0.06) * Math.pow(level + 1, 1.45));

/** 업그레이드를 적용한 실제 성능 */
export function truckStats(def, up = {}) {
  const lv = (k) => Math.max(0, Math.min(UPGRADE_MAX, up[k] || 0));
  return {
    ...def,
    accel: def.accel * (1 + lv("engine") * 0.06),
    top: def.top * (1 + lv("engine") * 0.025),
    grip: def.grip * (1 + lv("tire") * 0.06),
    turn: def.turn * (1 + lv("tire") * 0.03),
    damp: 1 + lv("susp") * 0.13,
    landing: 1 + lv("susp") * 0.1,
    armor: def.armor * (1 + lv("body") * 0.14),
    power: def.power * (1 + lv("body") * 0.05),
    boost: def.boost * (1 + lv("boost") * 0.13),
  };
}

/**
 * 부서지는 물체.
 * h: 반쪽 크기, m: 무게(톤), brk: 완전히 부서지는 충격, dent: 일부 부서지는 충격, hp: 일부 부서짐 횟수 한도,
 * score, mat: 재질(파편 · 소리), hurt: 트럭이 받는 피해 배수.
 */
export const OBJECTS = {
  crate: { name: "나무 상자", h: [0.8, 0.8, 0.8], m: 0.15, brk: 3, score: 100, mat: "wood", hurt: 0 },
  fence: { name: "나무 울타리", h: [2.5, 0.95, 0.12], m: 0.18, brk: 3.5, score: 150, mat: "wood", hurt: 0 },
  concrete: { name: "콘크리트 블록", h: [1.5, 0.85, 0.8], m: 3.2, brk: 17, dent: 8, hp: 2, score: 280, mat: "stone", hurt: 0.6 },
  tires: { name: "폐타이어 더미", h: [0.95, 0.75, 0.95], m: 0.55, brk: 6, score: 130, mat: "rubber", hurt: 0 },
  wreck: { name: "폐차량", h: [1.0, 0.72, 2.15], m: 1.5, brk: 14, score: 300, mat: "car", hurt: 0.15, ride: 1.42, flat: 0.62 },
  drum: { name: "철제 드럼통", h: [0.46, 0.66, 0.46], m: 0.22, brk: 9, dent: 2.5, hp: 2, score: 120, mat: "metal", hurt: 0 },
  boom: { name: "폭발 드럼통", h: [0.5, 0.72, 0.5], m: 0.22, brk: 2, score: 220, mat: "boom", hurt: 0 },
  barrier: { name: "플라스틱 배리어", h: [1.5, 0.55, 0.32], m: 0.09, brk: 3, score: 100, mat: "plastic", hurt: 0 },
  timber: { name: "목재 구조물", h: [2.3, 2.2, 2.3], m: 0.9, brk: 6.5, score: 320, mat: "wood", hurt: 0.1 },
  container: { name: "컨테이너", h: [1.3, 1.35, 3.3], m: 8, brk: 27, dent: 12, hp: 3, score: 550, mat: "metal", hurt: 0.8 },
  glass: { name: "유리 패널", h: [2.0, 1.5, 0.07], m: 0.08, brk: 1.5, score: 180, mat: "glass", hurt: 0 },
  tirewall: { name: "타이어 장벽", h: [3.0, 0.95, 0.7], m: 1.8, brk: 12, dent: 5.5, hp: 2, score: 220, mat: "rubber", hurt: 0.1 },
  girder: { name: "대형 금속 구조물", h: [3.0, 3.1, 3.0], m: 6, brk: 21, dent: 9, hp: 4, score: 650, mat: "metal", hurt: 0.7 },
  cone: { name: "고깔", h: [0.32, 0.45, 0.32], m: 0.02, brk: 0.6, score: 40, mat: "plastic", hurt: 0 },
  sign: { name: "간판", h: [3.0, 2.4, 0.22], m: 0.5, brk: 5, score: 260, mat: "metal", hurt: 0.05 },
  // 월드 전용
  rock: { name: "화산석", h: [1.5, 1.2, 1.5], m: 3, brk: 15, dent: 7, hp: 2, score: 260, mat: "stone", hurt: 0.5 },
  iceblock: { name: "얼음 블록", h: [1.5, 1.4, 1.5], m: 1.5, brk: 8, dent: 3.5, hp: 2, score: 240, mat: "ice", hurt: 0.2 },
  snowman: { name: "눈사람", h: [0.8, 1.25, 0.8], m: 0.12, brk: 1.5, score: 120, mat: "snow", hurt: 0 },
  snowpile: { name: "눈더미", h: [2.0, 1.0, 1.6], m: 0.5, brk: 2.5, score: 90, mat: "snow", hurt: 0 },
  snowball: { name: "눈덩이", h: [1.9, 1.9, 1.9], m: 3.5, brk: 9, score: 300, mat: "snow", hurt: 0.5, ball: true },
  plank: { name: "나무 다리", h: [2.8, 0.15, 1.2], m: 0.3, brk: 1e6, score: 40, mat: "wood", hurt: 0, ride: 0.3, plank: true },
  // 보스급 챌린지
  pillar: { name: "철탑 다리", h: [0.9, 3.6, 0.9], m: 5, brk: 15, dent: 6, hp: 3, score: 700, mat: "metal", hurt: 0.5 },
  beam: { name: "철골", h: [4.0, 0.6, 0.6], m: 2.5, brk: 10, score: 300, mat: "metal", hurt: 0.3 },
  dumper: { name: "거대 덤프트럭", h: [3.2, 3.2, 6.0], m: 22, brk: 1e9, score: 3000, mat: "metal", hurt: 0.5, push: true },
};
export const OBJECT_TYPES = Object.keys(OBJECTS);

export const COMBO_WORDS = [
  [3, "NICE!"],
  [6, "SMASH!"],
  [10, "CRUSH!"],
  [16, "MEGA COMBO!"],
  [25, "TOTAL DESTRUCTION!"],
];

export const WORLDS = [
  { id: "scrap", name: "SCRAP YARD", ko: "고철 파괴 경기장", sub: "폐차와 고철 더미가 가득한 첫 경기장" },
  { id: "city", name: "JUNK CITY", ko: "폐허 장난감 도시", sub: "좁은 도심 · 부서지는 간판과 유리" },
  { id: "volcano", name: "VOLCANO RUSH", ko: "화산 스턴트 경기장", sub: "용암을 넘는 거대한 점프" },
  { id: "frozen", name: "FROZEN WASTELAND", ko: "얼음 파괴 경기장", sub: "미끄러운 얼음과 눈사태" },
  { id: "stadium", name: "MEGA STADIUM", ko: "최종 메가 경기장", sub: "모든 기술을 쏟아붓는 결승" },
];

export const MODES = {
  tour: { name: "MAYHEM TOUR", ko: "메이헴 투어", sub: "5개 월드 · 미션을 깨며 전진" },
  destruction: { name: "TOTAL DESTRUCTION", ko: "토탈 디스트럭션", sub: "제한 시간 안에 전부 부수기" },
  stunt: { name: "STUNT MASTER", ko: "스턴트 마스터", sub: "점프대 · 공중 회전 · 착지" },
  time: { name: "TIME ATTACK", ko: "타임 어택", sub: "지름길과 부스터로 최단 시간" },
};
