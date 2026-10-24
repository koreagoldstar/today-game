/*
 * 말랑팡! 슬라임 연구소 · 설정
 *  세계 좌표: 연구 용기 안쪽 왼쪽 위가 (0,0) · 아래로 갈수록 y 증가 (단위 = 세계 단위, 화면에 맞춰 늘이고 줄임)
 */
export const JAR = {
  W: 400, // 용기 안쪽 너비
  H: 560, // 용기 안쪽 높이 (바닥 y)
  DANGER_Y: 74, // 위험선 (이보다 위로 삐져나오면 경고)
  SPAWN_Y: -48, // 다음 슬라임이 매달려 있는 높이 (용기 입구 위)
};

export const PHYS = {
  gravity: 1500,
  sub: 8, // 한 프레임을 이만큼 잘게 나눠 계산
  restitution: 0.14, // 슬라임끼리 튕김
  wallRestitution: 0.2,
  friction: 0.32,
  airDamp: 0.12, // 초당 속도 감쇠
  maxSpeed: 1700,
  mergeSlop: 1.2, // 이만큼 떨어져 있어도 닿은 것으로
  grow: 16, // 합체해서 생긴 슬라임이 제 크기로 커지는 빠르기
};

export const RULES = {
  dropCooldown: 0.45, // 다음 슬라임을 떨어뜨릴 수 있기까지
  comboWindow: 1.0, // 떨어뜨린 뒤 이 안에 다음 합체가 이어지면 콤보
  freshChain: 1.0, // 합체로 생긴 슬라임이 이 시간 안에 또 합체하면 '연쇄'
  dangerWarn: 0.6, // 위험선 넘은 채 이만큼 → 경고
  dangerOver: 3.0, // 위험선 넘은 채 이만큼 → 게임 오버
  dropGrace: 1.6, // 막 떨어뜨린 슬라임은 이 시간 동안 위험선 계산에서 빼 줌 (먼저 닿으면 짧아짐)
};

/**
 * 진화 단계 (1 ~ 8)
 *  r: 반지름 · c: [밝은 쪽, 가운데, 어두운 쪽] · line: 테두리 · cheek: 볼 · desc: 도감 설명
 */
export const LEVELS = [
  null,
  { lv: 1, key: "drop", name: "물방울 슬라임", r: 16, c: ["#e6f8ff", "#8fd6ff", "#3d9fe6"], line: "#1f6aa8", cheek: "#ff9ac0", desc: "연구소 수도꼭지에서 톡 떨어진 아기 슬라임. 머리끝이 뾰족해요." },
  { lv: 2, key: "lemon", name: "레몬 슬라임", r: 22, c: ["#fffbe0", "#ffe866", "#f2b81f"], line: "#a8740c", cheek: "#ffa26b", desc: "새콤달콤 레몬 향이 나는 노란 젤리. 레몬 조각 머리핀이 보물 1호예요." },
  { lv: 3, key: "peach", name: "복숭아 슬라임", r: 29, c: ["#fff0ea", "#ffb9a4", "#f27a8a"], line: "#b04a5c", cheek: "#ff6f8e", desc: "말랑말랑 분홍 젤리. 볼이 늘 발그레하고 복숭아 머리핀을 좋아해요." },
  { lv: 4, key: "bunny", name: "토끼 슬라임", r: 37, c: ["#ffffff", "#ece4ff", "#b9a4ee"], line: "#7a62c4", cheek: "#ff9cc6", desc: "긴 귀로 다른 슬라임 소리를 다 들어요. 깡충 뛰는 게 특기!" },
  { lv: 5, key: "star", name: "별빛 슬라임", r: 47, c: ["#b9b0ff", "#7d6cf2", "#3f2fa8"], line: "#271a78", cheek: "#ff9ad6", desc: "몸속에 작은 별자리가 반짝여요. 밤이 되면 더 밝아져요." },
  { lv: 6, key: "rainbow", name: "무지개 슬라임", r: 58, c: ["#ffffff", "#fff3fa", "#f6dcef"], line: "#b483b6", cheek: "#ff9ac0", desc: "비 온 뒤 연구소 창문에서 태어났어요. 기분 좋으면 색이 더 진해져요." },
  { lv: 7, key: "crown", name: "왕관 슬라임", r: 71, c: ["#ffd8ef", "#ff8fc8", "#d94a98"], line: "#93245f", cheek: "#ffcf5a", desc: "슬라임 왕국의 임금님. 황금 왕관은 절대 벗지 않아요." },
  { lv: 8, key: "dragon", name: "전설의 젤리 드래곤", r: 86, c: ["#dcfff1", "#7fe8c4", "#24a882"], line: "#0f6b52", cheek: "#ff9aa8", desc: "전설로만 전해지던 최강의 슬라임. 작은 날개로 연구소를 지켜 줘요." },
];
export const MAX_LV = 8;

/** 떨어뜨릴 슬라임 (1~4단계) 확률 · 크기와 함께 자동 플레이로 맞춤 (아무 데나 두면 2분쯤 · 잘 쌓으면 5~8분) */
export const SPAWN_W = [0, 0.4, 0.32, 0.2, 0.08];
