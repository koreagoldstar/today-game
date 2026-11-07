/* 인형뽑기 마스터 — 인형 · 기계 · 업그레이드 데이터 */

/**
 * 인형 12종. sph 는 물리 모양: [x, y, 반지름, 마찰 배율(기본 1), 앞뒤 z(기본 0, -가 앞)] (cm, 위가 +y).
 * 그림(plush.js)이 이 모양에 맞춰 그려진다. 무게 = 부피 x dens(속을 채운 정도).
 * 물성: fric 집게 발과의 마찰(천 재질) · soft 발이 파고드는 깊이(cm, 말랑함) · rest 튕김.
 * 어려움은 등급이 아니라 모양에서 온다: 목이 잘록하면 잘 걸리고, 동글납작하거나 미끄러우면 빠진다.
 */
export const DOLLS = [
  { id: "bear", ko: "몽실곰", rarity: 0, fric: 1, soft: 2.4, rest: 0.16, sph: [[0, 0, 5.8], [0, 10.6, 7.2], [-5, 16.2, 2.4], [5, 16.2, 2.4]], desc: "크림색 아기 곰. 몸통을 감싸 잡으면 안정적으로 들려요." },
  { id: "bunny", ko: "딸기토끼", rarity: 0, fric: 1, soft: 2.4, rest: 0.18, sph: [[0, 0, 5.2], [0, 9.6, 6.6], [-2.4, 17.6, 2.5, 0.5], [2.4, 17.6, 2.5, 0.5]], desc: "딸기 핀을 꽂은 토끼. 귀만 잡으면 쏙 빠져요, 목을 노려요!" },
  { id: "pig", ko: "꿀꿀돼지", rarity: 0, fric: 0.9, soft: 2, rest: 0.24, sph: [[0, 0.2, 6.2], [0, 9.8, 6.8], [0, 8.8, 2.6, 1, -6]], desc: "동글동글 통통해서 잘 굴러가요. 튀어나온 코에 발이 걸리기도 해요." },
  { id: "duck", ko: "삐약오리", rarity: 0, dens: 0.85, fric: 1, soft: 2.2, rest: 0.2, sph: [[0, 0, 5.2], [0, 8.4, 5.4], [0, 7.6, 2.6, 1.1, -5.4]], desc: "작고 가벼운 노란 오리. 넓은 부리에 발이 걸려요." },
  { id: "panda", ko: "판다콩", rarity: 1, dens: 1.05, fric: 1, soft: 2.6, rest: 0.14, sph: [[0, 0, 6.4], [0, 11.2, 7.8], [-5.6, 17, 2.4], [5.6, 17, 2.4]], desc: "대나무 잎을 쥔 큰 판다. 묵직해서 가운데를 잡아야 해요." },
  { id: "cat", ko: "냥이푸딩", rarity: 1, fric: 1.1, soft: 2.6, rest: 0.12, sph: [[-3, 0, 5], [3, 0, 5], [0, 7.4, 5.6], [-4.2, 12.8, 2.2], [4.2, 12.8, 2.2]], desc: "푸딩처럼 말랑한 고양이. 아래가 넓어서 머리 쪽을 감싸야 해요." },
  { id: "fox", ko: "아기여우", rarity: 1, fric: 1.05, soft: 2.2, rest: 0.16, sph: [[0, 0, 5.4], [0, 9.6, 6.6], [-8, 1.6, 4.8], [-4.4, 15, 2.2], [4.4, 15, 2.2]], desc: "큰 꼬리 때문에 한쪽으로 기울어요. 꼬리 반대편을 노려요." },
  { id: "penguin", ko: "펭귄방울", rarity: 2, fric: 0.85, soft: 1.8, rest: 0.22, sph: [[0, 0, 6.6], [0, 10, 5.8], [-6.4, 4.2, 2.4], [6.4, 4.2, 2.4], [2.2, 5.8, 2, 1.2, -5.6]], desc: "목도리를 두른 매끈한 펭귄. 목도리 아래를 잡아야 해요." },
  { id: "tiger", ko: "호랑이콩", rarity: 2, dens: 1.05, fric: 1, soft: 2.4, rest: 0.16, sph: [[0, 0, 6.4], [0, 11.2, 8], [-6, 17.4, 2.4], [6, 17.4, 2.4]], desc: "얼굴이 큰 아기 호랑이. 큰 머리 아래 목을 노려요." },
  { id: "koala", ko: "코알라몽", rarity: 2, dens: 1.1, fric: 0.95, soft: 2.4, rest: 0.14, sph: [[0, 0, 5.8], [0, 10.4, 7], [-7, 15, 3.6], [7, 15, 3.6]], desc: "복슬복슬한 코알라. 커다란 귀에 발이 걸려요." },
  { id: "unicorn", ko: "유니콘슈", rarity: 3, dens: 1.12, fric: 0.9, soft: 2.2, rest: 0.18, sph: [[0, 0, 5.8], [0, 11.4, 7.2], [-4.6, 16.6, 2.2], [4.6, 16.6, 2.2], [0, 19.6, 1.4, 0.5]], desc: "무지개 갈기의 유니콘. 반들반들한 천이라 정확히 잡아야 해요." },
  { id: "dragon", ko: "아기용용이", rarity: 4, dens: 1.15, fric: 0.85, soft: 2, rest: 0.2, sph: [[0, 0, 6.4], [0, 11.2, 7], [8.4, -0.8, 4.4]], desc: "날개 달린 아기 드래곤. 크고 꼬리가 무거워 아주 정확해야 해요." },
];
export const dollById = (id) => DOLLS.find((d) => d.id === id) || DOLLS[0];

/** 등급: 이름 · 색 · 보상 · 중복 보너스 */
export const RARITY = [
  { ko: "일반", en: "COMMON", c: "#8fd3a8", reward: 4, dup: 2 },
  { ko: "희귀", en: "RARE", c: "#5fb8ff", reward: 8, dup: 4 },
  { ko: "에픽", en: "EPIC", c: "#b46cff", reward: 15, dup: 8 },
  { ko: "전설", en: "LEGEND", c: "#ffc531", reward: 35, dup: 18 },
  { ko: "스페셜", en: "SPECIAL", c: "#ff6fb5", reward: 50, dup: 25 },
];

/**
 * 기계. pool 은 [인형, 무게] (나올 확률이 아니라 기계 안에 놓이는 수의 비율).
 * 지금은 첫 기계만 열려 있고, 나머지는 같은 구조로 늘린다.
 */
export const MACHINES = [
  {
    id: "toy",
    ko: "꼬마 장난감 가게",
    open: true,
    cost: 2,
    theme: { body: ["#ff8fb8", "#f25c96"], trim: "#ffd84a", back: ["#fff1d6", "#ffd9e6"], floor: ["#ffe3b0", "#f7c98a"], glow: "#fff4a8" },
    pool: [["bear", 5], ["bunny", 5], ["pig", 4], ["duck", 5], ["panda", 2.2], ["cat", 2.2], ["fox", 2.2], ["penguin", 1.1], ["tiger", 1.1], ["koala", 1.1], ["unicorn", 0.45], ["dragon", 0.25]],
    count: 14,
  },
  { id: "sea", ko: "바닷속 보물 기계", open: false, soon: "바다 친구 인형이 준비 중이에요" },
  { id: "snow", ko: "눈꽃 마을 기계", open: false, soon: "눈사람 · 펭귄 인형이 준비 중이에요" },
  { id: "fantasy", ko: "판타지 왕국 기계", open: false, soon: "유니콘 · 드래곤 왕국이 준비 중이에요" },
];

/** 업그레이드: 단계마다 값과 가격. 0단계가 기본 */
export const UPGRADES = [
  { id: "power", ko: "집게 힘", desc: "무거운 인형도 버텨요", vals: [1, 1.12, 1.24, 1.36, 1.48, 1.6], cost: [0, 40, 80, 140, 220, 320] },
  { id: "stable", ko: "집게 안정성", desc: "옮길 때 덜 흔들려요", vals: [0.6, 1.1, 1.6, 2.2, 2.8, 3.4], cost: [0, 30, 60, 110, 170, 250] },
  { id: "speed", ko: "집게 속도", desc: "빠르게 움직이고 감아올려요", vals: [1, 1.1, 1.2, 1.3, 1.4, 1.5], cost: [0, 25, 50, 90, 140, 200] },
  { id: "aim", ko: "집게 정밀도", desc: "노리는 인형이 더 또렷하게 · 조준 시간 +2초", vals: [0, 1, 2, 3, 4, 5], cost: [0, 20, 45, 80, 130, 190] },
];

/** 집게 외형 (성능과 무관) */
export const SKINS = [
  { id: "silver", ko: "기본 은색", price: 0, c: ["#e9edf5", "#9aa4b8", "#5e6880"] },
  { id: "pink", ko: "핑크 집게", price: 60, c: ["#ffd3e4", "#ff8fb8", "#c24a7c"] },
  { id: "gold", ko: "골드 집게", price: 150, c: ["#fff1b0", "#ffc531", "#b47b0c"] },
  { id: "star", ko: "별빛 집게", price: 240, c: ["#d9d4ff", "#8f7dff", "#4b3aa8"], sparkle: true },
  { id: "rainbow", ko: "무지개 집게", price: 400, c: ["#fff", "#ff8fb8", "#7d6bff"], rainbow: true },
];

/** 오늘의 도전 (날짜로 하나 고름) */
export const DAILY = [
  { id: "bunny3", ko: "3번 안에 딸기토끼 뽑기", k: "doll", who: "bunny", tries: 3, coin: 30 },
  { id: "epic", ko: "에픽 인형 1개 뽑기", k: "rarity", min: 2, tries: 8, coin: 40 },
  { id: "streak2", ko: "연속 2번 성공하기", k: "streak", n: 2, tries: 8, coin: 35 },
  { id: "three", ko: "서로 다른 인형 3종 뽑기", k: "kinds", n: 3, tries: 8, coin: 40 },
  { id: "panda2", ko: "4번 안에 판다콩 뽑기", k: "doll", who: "panda", tries: 4, coin: 35 },
  { id: "duck3", ko: "삐약오리 2마리 뽑기", k: "count", who: "duck", n: 2, tries: 6, coin: 30 },
  { id: "rare2", ko: "희귀 이상 2개 뽑기", k: "rarity2", min: 1, n: 2, tries: 8, coin: 40 },
];
