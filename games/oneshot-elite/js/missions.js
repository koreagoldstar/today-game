/*
 * 월드 5개 × 미션 10개 (9개 + 보너스 1개)
 *  표적 자리는 맵이 만든 '자리'(창 · 발코니 · 옥상 · 길 · 차 뒤 · 갑판 …) 중에서 미션 씨앗으로 고르고,
 *  내 저격 위치에서 실제로 보이는지 광선으로 확인한 뒤 세운다 (game.js placeActors)
 *
 *  t: 미션 종류
 *   find     FIND THE TARGET   민간인 사이에서 브리핑 특징이 맞는 표적 찾기
 *   one      ONE BULLET        총알 한 발
 *   moving   MOVING TARGET     걷거나 달리는 표적
 *   identify IDENTIFY TARGET   비슷한 사람(미끼) 중 진짜 표적 고르기
 *   multi    MULTI TARGET      여러 표적 · 첫 발 뒤 경계 → 달아남
 *   time     TIME ATTACK       짧은 시간 · 잠깐씩 나타나는 표적
 *   perfect  PERFECT SHOT      방탄조끼 → 머리만 통함
 *   bonus    BONUS MISSION     숨은 과녁 찾아 맞히기
 */

export const TYPES = {
  find: { en: "FIND THE TARGET", ko: "표적 찾기", color: "#f0b43c" },
  one: { en: "ONE BULLET", ko: "단 한 발", color: "#ff5a4a" },
  moving: { en: "MOVING TARGET", ko: "움직이는 표적", color: "#4fc3f7" },
  identify: { en: "IDENTIFY TARGET", ko: "진짜를 찾아라", color: "#b388ff" },
  multi: { en: "MULTI TARGET", ko: "여러 표적", color: "#ff8a3d" },
  time: { en: "TIME ATTACK", ko: "시간 제한", color: "#5ce08a" },
  perfect: { en: "PERFECT SHOT", ko: "헤드샷만", color: "#ff4f8b" },
  bonus: { en: "BONUS MISSION", ko: "보너스 과녁", color: "#ffd84a" },
};

export const WORLDS = [
  { id: 1, key: "city", en: "CITY OPERATIONS", ko: "도시 작전", need: 0, accent: "#f0b43c", blurb: "광장을 사이에 둔 오래된 도시. 창문 · 발코니 · 옥상 어딘가에 표적이 숨어 있어요." },
  { id: 2, key: "harbor", en: "HARBOR STRIKE", ko: "항구 기습", need: 14, accent: "#4fc3f7", blurb: "컨테이너가 쌓인 부두와 화물선. 크레인 위 · 갑판 · 창고 창을 살펴요." },
  { id: 3, key: "desert", en: "DESERT STORM", ko: "사막 폭풍", need: 32, accent: "#ff9a3d", blurb: "모래 언덕 너머 흙벽 마을과 감시탑. 모래바람이 불면 멀리가 흐려져요." },
  { id: 4, key: "night", en: "NIGHT HUNTER", ko: "밤의 사냥꾼", need: 52, accent: "#7c8cff", blurb: "불 켜진 창문과 네온 간판. 야간 투시경(N)으로 어둠 속 표적을 찾아요." },
  { id: 5, key: "final", en: "FINAL ASSAULT", ko: "최후의 작전", need: 74, accent: "#ff4f5e", blurb: "비바람 치는 적 기지. 감시탑 · 격납고 · 연료탑 사이 마지막 표적들." },
];

/* 표적 생김새 (브리핑 특징 칩 · 미끼와 구별하는 점) */
export const LOOKS = {
  agent: { kind: "agent", tags: ["검은 정장", "빨간 넥타이", "빨간 선글라스"] },
  boss: { kind: "boss", tags: ["하얀 정장", "하얀 중절모", "검은 선글라스"] },
  guard: { kind: "guard", tags: ["국방색 옷", "모자", "소총"] },
  sniper: { kind: "sniper", tags: ["회색 위장복", "빨간 고글", "저격총"] },
  courier: { kind: "courier", tags: ["회색 정장", "파란 넥타이", "서류 가방"] },
  smuggler: { kind: "agent", over: { jacket: "#6b2f2f", pants: "#2a2a2a", tie: "#f2c230", glasses: "#141414", hat: "#2a2a2a", hatType: "fedora" }, tags: ["자주색 재킷", "노란 넥타이", "검은 모자"] },
  foreman: { kind: "worker", over: { hat: "#d6312b", vest: "#e6d02a" }, tags: ["주황 작업복", "빨간 안전모", "노란 조끼"] },
  scout: { kind: "guard", over: { jacket: "#b89a68", pants: "#8f7650", vest: "#6f5a3a", hat: "#d6312b", hatType: "beret" }, tags: ["모래색 옷", "빨간 베레모", "소총"] },
  general: { kind: "boss", over: { jacket: "#3c432a", pants: "#3c432a", shirt: "#e9e4d8", tie: "#141414", hat: "#3c432a", hatType: "peak", glasses: "#b3121c" }, tags: ["국방색 정복", "모자", "빨간 선글라스"] },
};
/* 미끼 (진짜와 한 군데만 다름) */
export const DECOYS = {
  agent: [{ tie: "#2f5fb0" }, { glasses: "#141414" }, { tie: "#2f5fb0", glasses: null }],
  boss: [{ hat: null }, { jacket: "#c9c2b3", pants: "#c9c2b3", hat: "#c9c2b3", tie: "#2f5fb0" }],
  courier: [{ bag: null }, { tie: "#c8222a" }],
  foreman: [{ hat: "#f2c230" }, { hat: "#f2f2f2" }],
  scout: [{ hat: "#2f3424" }, { hat: "#3a5a8a" }],
  smuggler: [{ tie: "#c8222a" }, { hat: null }],
  guard: [{ hat: null }],
  general: [{ glasses: "#141414" }, { hat: null }],
};

/*
 * 표적 스펙 (T): { look, at:[자리 종류], move, dist:[최소, 최대], pose, vest, appear:[나타나는 시각, 머무는 시간] }
 *  move: stand · peek · pace · walk · cover · popup
 */
const T = (look, at, move, dist, extra = {}) => ({ look, at, move, dist, ...extra });

/* 미션 (w: 월드 · n: 번호) */
const M = [];
const add = (w, n, o) => M.push({ id: `${w}-${n}`, w, n, ammo: 3, time: 120, civ: 10, alert: 6, star2: "nomiss", ...o });

/* ── WORLD 1 · CITY OPERATIONS ── */
add(1, 1, {
  t: "find", title: "첫 번째 임무", env: { map: "city", seed: 3, vantage: "plaza", atmos: "day" },
  brief: "광장 건너편 건물 창가를 살펴요. 검은 정장에 빨간 넥타이를 맨 요원이 창가를 오가요.",
  targets: [T("agent", ["window"], "peek", [70, 135], { show: 6, hide: 2.5, xMax: 70 })],
  civ: 9, civAt: { window: 5, balcony: 2, street: 6 }, ammo: 5, time: 180, par: 75, tutorial: true,
});
add(1, 2, {
  t: "one", title: "단 한 발", env: { map: "city", seed: 5, vantage: "plaza", atmos: "morning" },
  brief: "총알은 딱 한 발. 옥상에서 전화하는 요원을 침착하게 노려요. 숨을 참으면(Shift · 숨참기) 조준이 멈춰요.",
  targets: [T("agent", ["roof"], "stand", [95, 175], { pose: "phone" })],
  civ: 8, civAt: { window: 4, roof: 2, street: 6 }, ammo: 1, time: 120, par: 50, star2: "head",
});
add(1, 3, {
  t: "moving", title: "광장의 산책", env: { map: "city", seed: 7, vantage: "plaza", atmos: "day" },
  brief: "회색 정장에 서류 가방을 든 운반책이 광장을 가로질러 걸어가요. 걷는 방향보다 살짝 앞을 노려요.",
  targets: [T("courier", ["street"], "walk", [45, 140], { speed: 1.35 })],
  civ: 10, civAt: { street: 9, window: 3, balcony: 1 }, ammo: 3, time: 120, par: 55,
});
add(1, 4, {
  t: "identify", title: "빨간 넥타이", env: { map: "city", seed: 11, vantage: "west", atmos: "day" },
  brief: "검은 정장 셋 중 진짜는 빨간 넥타이 + 빨간 선글라스. 넥타이 색이 다른 미끼를 쏘면 실패예요.",
  targets: [T("agent", ["balcony", "window"], "stand", [80, 170])], decoys: 3, decoyAt: ["balcony", "window", "roof"],
  civ: 6, civAt: { street: 7, window: 2 }, ammo: 3, time: 150, par: 70,
});
add(1, 5, {
  t: "multi", title: "세 명의 감시자", env: { map: "city", seed: 13, vantage: "high", atmos: "day" },
  brief: "옥상 세 곳에 경비가 서 있어요. 첫 발이 울리면 남은 경비는 6초 뒤 숨어요. 빠르게 이어 쏴요.",
  targets: [T("guard", ["roof"], "pace", [70, 190]), T("guard", ["roof"], "stand", [70, 190]), T("guard", ["roof"], "pace", [70, 190])],
  civ: 6, civAt: { street: 8, window: 2 }, ammo: 5, time: 150, par: 70, alert: 6,
});
add(1, 6, {
  t: "time", title: "60초 작전", env: { map: "city", seed: 17, vantage: "plaza", atmos: "golden" },
  brief: "요원 다섯이 창가에 잠깐씩 나타나요. 60초 안에 넷을 맞혀요. 나타날 때 창이 덜컹 열려요.",
  targets: [0, 9, 18, 27, 36].map((t) => T("agent", ["window"], "popup", [60, 160], { appear: [4 + t, 9] })), need: 4,
  civ: 6, civAt: { street: 8, balcony: 2 }, ammo: 8, time: 60, par: 45,
});
add(1, 7, {
  t: "perfect", title: "헤드샷만", env: { map: "city", seed: 19, vantage: "east", atmos: "day" },
  brief: "하얀 정장의 두목은 방탄조끼를 입었어요. 몸은 막혀요. 머리를 맞혀야만 성공!",
  targets: [T("boss", ["window", "balcony"], "peek", [90, 180], { vest: true, show: 4, hide: 3 })],
  civ: 8, civAt: { window: 4, street: 7 }, ammo: 3, time: 150, par: 70, star2: "nomiss",
});
add(1, 8, {
  t: "find", title: "군중 속 요원", env: { map: "city", seed: 23, vantage: "low", atmos: "golden" },
  brief: "광장을 걷는 사람들 사이에 요원이 섞여 있어요. 빨간 선글라스를 찾아요. 표시(E)로 의심 인물을 찍어 둘 수 있어요.",
  targets: [T("agent", ["street"], "walk", [40, 140], { speed: 1.2 })],
  civ: 18, civAt: { street: 16, window: 3, balcony: 1 }, civSuit: 4, ammo: 3, time: 150, par: 70,
});
add(1, 9, {
  t: "multi", title: "옥상 회의", env: { map: "city", seed: 29, vantage: "high", atmos: "morning" },
  brief: "두목이 옥상에서 경비 둘과 만나요. 두목은 꼭 맞혀야 해요. 셋 다 맞히면 별을 더 받아요.",
  targets: [T("boss", ["roof"], "stand", [90, 190], { group: 1, pose: "phone" }), T("guard", ["roof"], "pace", [90, 190], { group: 1, optional: true }), T("guard", ["roof"], "stand", [90, 190], { group: 1, optional: true })],
  need: 1, star2: "all", civ: 8, civAt: { street: 8, window: 3 }, ammo: 4, time: 150, par: 70, alert: 5,
});
add(1, 10, {
  t: "bonus", title: "도시 과녁 사냥", env: { map: "city", seed: 31, vantage: "plaza", atmos: "day" },
  brief: "도시 곳곳에 금빛 과녁 8개가 숨어 있어요. 90초 안에 모두 맞혀요! 가운데를 맞히면 점수가 더 커요.",
  boards: 8, boardAt: ["window", "roof", "balcony"], ammo: 14, time: 90, par: 60, civ: 0, civAt: { street: 8 },
});

/* ── WORLD 2 · HARBOR STRIKE ── */
add(2, 1, {
  t: "find", title: "부두의 밀수꾼", env: { map: "harbor", seed: 41, vantage: "crane", atmos: "harbor" },
  brief: "부두 일꾼들 사이에 노란 넥타이 · 검은 모자의 밀수꾼이 있어요. 컨테이너 사이를 잘 봐요.",
  targets: [T("smuggler", ["ground", "container"], "pace", [70, 170])],
  civ: 10, civKind: "worker", civAt: { ground: 7, container: 3, deck: 2 }, ammo: 3, time: 150, par: 70,
});
add(2, 2, {
  t: "moving", title: "부두 산책로", env: { map: "harbor", seed: 43, vantage: "warehouse", atmos: "morning" },
  brief: "운반책이 부두 끝까지 걸어가요. 배에 오르기 전에 멈춰 세워요.",
  targets: [T("courier", ["street"], "walk", [60, 170], { speed: 1.5, once: true })],
  civ: 9, civKind: "worker", civAt: { street: 4, ground: 6, deck: 2 }, ammo: 3, time: 90, par: 50,
});
add(2, 3, {
  t: "one", title: "갑판 위 한 발", env: { map: "harbor", seed: 47, vantage: "crane", atmos: "harbor" },
  brief: "화물선 갑판에 선 요원. 총알은 한 발뿐이에요.",
  targets: [T("agent", ["deck"], "stand", [110, 200], { pose: "phone" })],
  civ: 8, civKind: "worker", civAt: { deck: 3, ground: 6 }, ammo: 1, time: 120, par: 50, star2: "head",
});
add(2, 4, {
  t: "identify", title: "빨간 안전모", env: { map: "harbor", seed: 53, vantage: "warehouse", atmos: "harbor" },
  brief: "작업반장은 빨간 안전모를 써요. 노란 · 하얀 안전모는 진짜 일꾼이에요.",
  targets: [T("foreman", ["container", "ground"], "stand", [70, 170])], decoys: 4, decoyAt: ["container", "ground", "deck"],
  civ: 6, civKind: "worker", civAt: { ground: 6 }, ammo: 3, time: 150, par: 70,
});
add(2, 5, {
  t: "multi", title: "컨테이너 감시", env: { map: "harbor", seed: 59, vantage: "crane", atmos: "harbor" },
  brief: "컨테이너 위 경비 셋. 첫 발 뒤 5초면 숨어요.",
  targets: [T("guard", ["container"], "pace", [70, 190]), T("guard", ["container"], "stand", [70, 190]), T("guard", ["container"], "pace", [70, 190])],
  civ: 6, civKind: "worker", civAt: { ground: 6 }, ammo: 5, time: 150, par: 70, alert: 5,
});
add(2, 6, {
  t: "time", title: "창고 습격", env: { map: "harbor", seed: 61, vantage: "warehouse", atmos: "golden" },
  brief: "창고 창문 · 컨테이너 문에서 요원이 잠깐씩 나와요. 50초 안에 넷!",
  targets: [0, 7, 14, 21, 28].map((t) => T("agent", ["window", "door"], "popup", [60, 170], { appear: [3 + t, 8] })), need: 4,
  civ: 4, civKind: "worker", civAt: { ground: 6 }, ammo: 8, time: 50, par: 40,
});
add(2, 7, {
  t: "perfect", title: "크레인 저격수", env: { map: "harbor", seed: 67, vantage: "warehouse", atmos: "harbor" },
  brief: "크레인 위 적 저격수. 방탄조끼 때문에 머리만 통해요.",
  targets: [T("sniper", ["crane", "roof"], "stand", [100, 200], { vest: true, pose: "aim" })],
  civ: 6, civKind: "worker", civAt: { ground: 6, deck: 2 }, ammo: 3, time: 120, par: 55,
});
add(2, 8, {
  t: "moving", title: "도망치는 밀수꾼", env: { map: "harbor", seed: 71, vantage: "crane", atmos: "morning" },
  brief: "밀수꾼이 갑판을 따라 뛰어요. 멈췄다 뛰었다 하니 멈출 때를 노려요.",
  targets: [T("smuggler", ["deckpath", "street"], "walk", [80, 190], { speed: 2.3, pause: 2.2 })],
  civ: 8, civKind: "worker", civAt: { ground: 6, deck: 2 }, ammo: 3, time: 100, par: 50,
});
add(2, 9, {
  t: "multi", title: "밤배 출항 전", env: { map: "harbor", seed: 73, vantage: "warehouse", atmos: "golden" },
  brief: "밀수꾼 두목과 부하 셋. 두목부터 노려요. 첫 발 뒤 5초면 흩어져요.",
  targets: [T("smuggler", ["deck"], "stand", [90, 200], { pose: "phone" }), T("guard", ["container"], "pace", [70, 190]), T("guard", ["ground"], "pace", [70, 190]), T("guard", ["deck", "container"], "stand", [70, 200])],
  civ: 4, civKind: "worker", civAt: { ground: 5 }, ammo: 6, time: 150, par: 75, alert: 5,
});
add(2, 10, {
  t: "bonus", title: "항구 과녁 사냥", env: { map: "harbor", seed: 79, vantage: "crane", atmos: "harbor" },
  brief: "컨테이너 · 배 · 창고에 숨은 과녁 8개. 80초!",
  boards: 8, boardAt: ["container", "deck", "window", "roof"], ammo: 14, time: 80, par: 55, civ: 0, civKind: "worker", civAt: { ground: 6 },
});

/* ── WORLD 3 · DESERT STORM ── */
add(3, 1, {
  t: "find", title: "모래 마을", env: { map: "desert", seed: 83, vantage: "ridge", atmos: "desert" },
  brief: "마을 사람들 사이에 빨간 베레모의 정찰병이 있어요.",
  targets: [T("scout", ["ground", "roof"], "pace", [80, 180])],
  civ: 10, civAt: { ground: 6, roof: 3, window: 3 }, ammo: 3, time: 150, par: 70,
});
add(3, 2, {
  t: "one", title: "감시탑의 한 발", env: { map: "desert", seed: 89, vantage: "ridge", atmos: "desert" },
  brief: "감시탑 위 경비. 총알 한 발.",
  targets: [T("guard", ["tower"], "stand", [110, 210])],
  civ: 6, civAt: { ground: 6, roof: 2 }, ammo: 1, time: 120, par: 50, star2: "head",
});
add(3, 3, {
  t: "moving", title: "모래 위 전령", env: { map: "desert", seed: 97, vantage: "ridge", atmos: "morning" },
  brief: "전령이 마을 길을 따라 달려요.",
  targets: [T("courier", ["street"], "walk", [70, 180], { speed: 2.4 })],
  civ: 8, civAt: { street: 4, ground: 5 }, ammo: 3, time: 100, par: 50,
});
add(3, 4, {
  t: "identify", title: "베레모 색", env: { map: "desert", seed: 101, vantage: "ridge", atmos: "desert" },
  brief: "정찰병 넷 중 빨간 베레모만 진짜. 검은 · 파란 베레모는 미끼예요.",
  targets: [T("scout", ["roof", "ground"], "stand", [80, 190])], decoys: 3, decoyAt: ["roof", "ground", "tower"],
  civ: 6, civAt: { ground: 6 }, ammo: 3, time: 150, par: 70,
});
add(3, 5, {
  t: "multi", title: "천막 습격", env: { map: "desert", seed: 103, vantage: "dune", atmos: "desert" },
  brief: "천막 옆 경비 셋. 첫 발 뒤 5초!",
  targets: [T("guard", ["ground"], "pace", [70, 190]), T("guard", ["ground", "roof"], "stand", [70, 190]), T("guard", ["tower", "roof"], "stand", [70, 200])],
  civ: 5, civAt: { ground: 5 }, ammo: 5, time: 150, par: 70, alert: 5,
});
add(3, 6, {
  t: "time", title: "모래바람 속 40초", env: { map: "desert", seed: 107, vantage: "ridge", atmos: "dust" },
  brief: "모래바람이 불어 멀리가 흐려요. 창과 벽 뒤에서 잠깐 나오는 요원 넷 중 셋!",
  targets: [0, 8, 16, 24].map((t) => T("scout", ["window", "wall"], "popup", [55, 140], { appear: [3 + t, 8] })), need: 3,
  civ: 3, civAt: { ground: 4 }, ammo: 7, time: 45, par: 35,
});
add(3, 7, {
  t: "perfect", title: "모래 언덕 저격수", env: { map: "desert", seed: 109, vantage: "dune", atmos: "desert" },
  brief: "바위 뒤에 엎드린 적 저격수가 가끔 고개를 들어요. 머리만!",
  targets: [T("sniper", ["cover"], "cover", [100, 210], { vest: true })],
  civ: 4, civAt: { ground: 5 }, ammo: 3, time: 120, par: 60,
});
add(3, 8, {
  t: "find", title: "시장 골목", env: { map: "desert", seed: 113, vantage: "ridge", atmos: "golden" },
  brief: "해 질 녘 시장. 서류 가방을 든 운반책을 찾아요.",
  targets: [T("courier", ["street", "ground"], "walk", [60, 170], { speed: 1.1 })],
  civ: 16, civAt: { street: 8, ground: 6, roof: 3 }, civSuit: 3, ammo: 3, time: 150, par: 75,
});
add(3, 9, {
  t: "multi", title: "장군의 행차", env: { map: "desert", seed: 127, vantage: "ridge", atmos: "desert" },
  brief: "장군이 경비와 함께 지나가요. 장군은 꼭! 경비까지 맞히면 별 하나 더.",
  targets: [T("general", ["street"], "walk", [80, 190], { speed: 1.2, group: 2 }), T("guard", ["street"], "walk", [80, 190], { speed: 1.2, group: 2, optional: true }), T("guard", ["tower"], "stand", [80, 210], { optional: true })],
  need: 1, star2: "all", civ: 6, civAt: { ground: 6 }, ammo: 4, time: 120, par: 60, alert: 5,
});
add(3, 10, {
  t: "bonus", title: "사막 과녁 사냥", env: { map: "desert", seed: 131, vantage: "ridge", atmos: "desert" },
  brief: "흙벽 · 천막 · 감시탑에 숨은 과녁 8개. 80초!",
  boards: 8, boardAt: ["roof", "wall", "tower", "ground"], ammo: 14, time: 80, par: 55, civ: 0, civAt: { ground: 4 },
});

/* ── WORLD 4 · NIGHT HUNTER ── */
add(4, 1, {
  t: "find", title: "불 꺼진 창", env: { map: "city", seed: 137, vantage: "plaza", night: true, atmos: "night" },
  brief: "밤의 도시. 야간 투시경(N 키 · 투시 버튼)을 켜면 어두운 곳이 밝게 보여요. 빨간 넥타이 요원을 찾아요.",
  targets: [T("agent", ["window", "balcony"], "peek", [70, 160], { show: 5, hide: 3 })],
  civ: 10, civAt: { window: 5, street: 7, balcony: 2 }, ammo: 3, time: 150, par: 70,
});
add(4, 2, {
  t: "moving", title: "네온 거리", env: { map: "city", seed: 139, vantage: "low", night: true, atmos: "night" },
  brief: "네온 거리를 걷는 운반책. 가로등 아래를 지날 때가 기회예요.",
  targets: [T("courier", ["street"], "walk", [50, 150], { speed: 1.4 })],
  civ: 12, civAt: { street: 12, window: 2 }, ammo: 3, time: 120, par: 55,
});
add(4, 3, {
  t: "one", title: "자정의 한 발", env: { map: "city", seed: 149, vantage: "high", night: true, atmos: "night" },
  brief: "옥상 위 두목. 한 발뿐!",
  targets: [T("boss", ["roof"], "stand", [100, 200], { pose: "phone" })],
  civ: 8, civAt: { street: 8, window: 3 }, ammo: 1, time: 120, par: 50, star2: "head",
});
add(4, 4, {
  t: "identify", title: "모자 쓴 두목", env: { map: "city", seed: 151, vantage: "west", night: true, atmos: "night" },
  brief: "하얀 정장 셋. 진짜 두목만 하얀 중절모를 써요.",
  targets: [T("boss", ["balcony", "window"], "stand", [80, 180])], decoys: 2, decoyAt: ["balcony", "window", "roof"],
  civ: 6, civAt: { street: 8, window: 2 }, ammo: 3, time: 150, par: 70,
});
add(4, 5, {
  t: "multi", title: "밤의 옥상", env: { map: "city", seed: 157, vantage: "high", night: true, atmos: "night" },
  brief: "옥상을 도는 경비 넷. 첫 발 뒤 5초!",
  targets: [T("guard", ["roof"], "pace", [70, 200]), T("guard", ["roof"], "pace", [70, 200]), T("guard", ["roof"], "stand", [70, 200]), T("guard", ["roof"], "stand", [70, 200])],
  civ: 6, civAt: { street: 8 }, ammo: 6, time: 150, par: 75, alert: 5,
});
add(4, 6, {
  t: "find", title: "밤의 부두", env: { map: "harbor", seed: 163, vantage: "warehouse", night: true, atmos: "night" },
  brief: "불 켜진 부두. 밀수꾼이 일꾼들 사이에 숨었어요.",
  targets: [T("smuggler", ["ground", "container", "deck"], "pace", [70, 180])],
  civ: 10, civKind: "worker", civAt: { ground: 7, deck: 3, container: 2 }, ammo: 3, time: 150, par: 70,
});
add(4, 7, {
  t: "time", title: "정전 45초", env: { map: "harbor", seed: 167, vantage: "crane", night: true, atmos: "night" },
  brief: "창고와 컨테이너 문에서 잠깐 나오는 요원 다섯 중 넷!",
  targets: [0, 7, 14, 21, 28].map((t) => T("agent", ["window", "door"], "popup", [60, 170], { appear: [3 + t, 8] })), need: 4,
  civ: 3, civKind: "worker", civAt: { ground: 5 }, ammo: 8, time: 45, par: 38,
});
add(4, 8, {
  t: "perfect", title: "그림자 저격수", env: { map: "harbor", seed: 173, vantage: "warehouse", night: true, atmos: "night" },
  brief: "컨테이너 뒤 적 저격수. 머리만 통해요.",
  targets: [T("sniper", ["cover", "container"], "cover", [90, 200], { vest: true })],
  civ: 5, civKind: "worker", civAt: { ground: 5 }, ammo: 3, time: 120, par: 60,
});
add(4, 9, {
  t: "multi", title: "달빛 거래", env: { map: "harbor", seed: 179, vantage: "crane", night: true, atmos: "night" },
  brief: "밀수꾼 두목과 운반책의 거래. 둘 다 맞혀요. 첫 발 뒤 4초!",
  targets: [T("smuggler", ["ground", "deck"], "stand", [80, 190], { group: 3, pose: "phone" }), T("courier", ["ground", "deck"], "stand", [80, 190], { group: 3 })],
  civ: 4, civKind: "worker", civAt: { ground: 5 }, ammo: 3, time: 120, par: 55, alert: 4,
});
add(4, 10, {
  t: "bonus", title: "야광 과녁 사냥", env: { map: "city", seed: 181, vantage: "plaza", night: true, atmos: "night" },
  brief: "어둠 속 과녁 8개. 투시경을 써 봐요!",
  boards: 8, boardAt: ["window", "roof", "balcony"], ammo: 14, time: 90, par: 60, civ: 0, civAt: { street: 6 },
});

/* ── WORLD 5 · FINAL ASSAULT ── */
add(5, 1, {
  t: "find", title: "기지 잠입", env: { map: "base", seed: 191, vantage: "hill", atmos: "storm" },
  brief: "비바람 치는 적 기지. 경비들 사이 빨간 선글라스 요원을 찾아요.",
  targets: [T("agent", ["ground", "roof"], "pace", [80, 190])],
  civ: 10, civKind: "guard", civAt: { ground: 7, tower: 2, roof: 2 }, ammo: 3, time: 150, par: 75,
});
add(5, 2, {
  t: "moving", title: "순찰 차량 옆", env: { map: "base", seed: 193, vantage: "hill", atmos: "storm" },
  brief: "활주로를 걷는 장교. 비 때문에 흔들림이 커요. 숨을 참고 앞을 노려요.",
  targets: [T("general", ["street"], "walk", [80, 200], { speed: 1.5 })],
  civ: 8, civKind: "guard", civAt: { street: 4, ground: 5 }, ammo: 3, time: 100, par: 50,
});
add(5, 3, {
  t: "one", title: "감시탑 한 발", env: { map: "base", seed: 197, vantage: "tank", atmos: "storm" },
  brief: "감시탑 저격수. 한 발로 끝내요.",
  targets: [T("sniper", ["tower"], "stand", [110, 220], { pose: "aim" })],
  civ: 6, civKind: "guard", civAt: { ground: 6 }, ammo: 1, time: 120, par: 50, star2: "head",
});
add(5, 4, {
  t: "identify", title: "진짜 장군", env: { map: "base", seed: 199, vantage: "hill", atmos: "golden" },
  brief: "장군 셋. 진짜는 빨간 선글라스에 모자를 썼어요.",
  targets: [T("general", ["ground", "roof"], "stand", [80, 200])], decoys: 2, decoyAt: ["ground", "roof", "tower"],
  civ: 6, civKind: "guard", civAt: { ground: 6 }, ammo: 3, time: 150, par: 70,
});
add(5, 5, {
  t: "multi", title: "격납고 경비", env: { map: "base", seed: 211, vantage: "tank", atmos: "storm" },
  brief: "격납고 앞 경비 넷. 첫 발 뒤 4초!",
  targets: [T("guard", ["ground"], "pace", [70, 200]), T("guard", ["ground"], "stand", [70, 200]), T("guard", ["roof", "tower"], "stand", [70, 210]), T("guard", ["ground"], "pace", [70, 200])],
  civ: 4, civKind: "guard", civAt: { ground: 4 }, ammo: 6, time: 150, par: 75, alert: 4,
});
add(5, 6, {
  t: "time", title: "경보 35초", env: { map: "base", seed: 223, vantage: "hill", atmos: "storm" },
  brief: "경보가 울렸어요! 35초 안에 나타나는 요원 넷 중 셋.",
  targets: [0, 7, 14, 21].map((t) => T("agent", ["window", "door", "wall"], "popup", [60, 170], { appear: [2 + t, 7] })), need: 3,
  civ: 3, civKind: "guard", civAt: { ground: 4 }, ammo: 7, time: 35, par: 30,
});
add(5, 7, {
  t: "perfect", title: "연료탑 저격수", env: { map: "base", seed: 227, vantage: "tank", atmos: "golden" },
  brief: "연료탑 꼭대기 저격수. 머리만!",
  targets: [T("sniper", ["tower", "roof"], "stand", [120, 230], { vest: true, pose: "aim" })],
  civ: 5, civKind: "guard", civAt: { ground: 5 }, ammo: 3, time: 120, par: 60,
});
add(5, 8, {
  t: "moving", title: "헬기장으로", env: { map: "base", seed: 229, vantage: "hill", atmos: "storm" },
  brief: "두목이 헬기장으로 뛰어가요. 헬기에 타기 전에!",
  targets: [T("boss", ["street"], "walk", [80, 200], { speed: 2.4, once: true })],
  civ: 6, civKind: "guard", civAt: { ground: 6 }, ammo: 3, time: 90, par: 45,
});
add(5, 9, {
  t: "multi", title: "ONE SHOT ELITE", env: { map: "base", seed: 233, vantage: "tank", atmos: "night", night: true },
  brief: "마지막 작전. 두목 · 장군 · 저격수 셋을 모두 맞혀요. 첫 발 뒤 5초. 투시경을 활용해요.",
  targets: [T("boss", ["ground", "roof"], "stand", [90, 210], { pose: "phone" }), T("general", ["ground"], "pace", [90, 210]), T("sniper", ["tower"], "stand", [100, 220], { pose: "aim" })],
  civ: 6, civKind: "guard", civAt: { ground: 6 }, ammo: 5, time: 150, par: 80, alert: 5, star2: "head",
});
add(5, 10, {
  t: "bonus", title: "기지 과녁 사냥", env: { map: "base", seed: 239, vantage: "hill", atmos: "golden" },
  brief: "격납고 · 탑 · 벽에 숨은 과녁 9개. 90초!",
  boards: 9, boardAt: ["roof", "tower", "wall", "ground", "window"], ammo: 15, time: 90, par: 65, civ: 0, civKind: "guard", civAt: { ground: 4 },
});

export const MISSIONS = M;
export const missionById = (id) => M.find((m) => m.id === id);
export const missionsOf = (w) => M.filter((m) => m.w === w);

/** 별 조건 설명 */
export function starText(m) {
  const s2 = { nomiss: "빗나간 총알 없이", head: "모든 표적 헤드샷", all: "표적 전부 맞히기" }[m.star2] || "빗나간 총알 없이";
  return ["임무 성공", m.t === "bonus" ? "빗나간 총알 없이" : s2, `${m.par}초 안에 · 힌트 없이`];
}
