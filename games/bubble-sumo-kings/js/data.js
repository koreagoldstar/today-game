/* 통통 동물 씨름왕 — 수치 데이터 (캐릭터 · 경기장 · 챔피언십 · 미션) */

/** 능력치는 1~10, 합이 모두 29 라 압도적인 캐릭터가 없다 */
export const FIGHTERS = [
  { id: "bear", ko: "통통 곰돌이", en: "BROWN BEAR", role: "균형형", desc: "순하지만 뱃심은 최고! 무엇이든 무난하게 잘해요.", power: 6, defense: 6, speed: 5, balance: 6, special: 6, price: 0, skill: { id: "belly", ko: "배치기 돌진", desc: "버티면서 달려가 뱃살로 쾅!" } },
  { id: "bunny", ko: "분홍 토끼", en: "PINK BUNNY", role: "민첩형", desc: "가볍고 빨라요. 피하고 파고드는 게 특기예요.", power: 4, defense: 3, speed: 9, balance: 6, special: 7, price: 400, unlock: "1-3", skill: { id: "hop", ko: "연속 점프 밀치기", desc: "세 번 뛰어 내려찍어요. 공중에선 안 맞아요." } },
  { id: "panda", ko: "아기 판다", en: "BABY PANDA", role: "버티기형", desc: "느리지만 꿈쩍도 안 해요. 끝에서 잘 버텨요.", power: 6, defense: 8, speed: 5, balance: 6, special: 4, price: 600, unlock: "1-5", skill: { id: "iron", ko: "철벽 버티기", desc: "잠깐 무쇠처럼 단단해져 상대를 튕겨 내요." } },
  { id: "pig", ko: "아기 돼지", en: "PINK PIG", role: "돌진형", desc: "한 방이 무서워요. 빗나가면 자기가 위험해요.", power: 9, defense: 6, speed: 4, balance: 4, special: 6, price: 800, unlock: "2-5", skill: { id: "nose", ko: "초강력 코 박치기", desc: "힘을 모아 한 번에! 빗나가면 크게 비틀거려요." } },
  { id: "duck", ko: "노란 오리", en: "DUCKY", role: "기술형", desc: "기술 게이지가 빨리 차요. 뱅글뱅글 돌며 밀어요.", power: 4, defense: 4, speed: 7, balance: 6, special: 8, price: 900, unlock: "3-2", skill: { id: "spin", ko: "빙글빙글 회전", desc: "돌면서 여러 번 밀어요. 끝나면 조금 어지러워요." } },
  { id: "cat", ko: "아기 고양이", en: "KITTY", role: "만능형", desc: "빈틈을 잘 찾아요. 뒤로 돌아 역전을 노려요.", power: 6, defense: 5, speed: 6, balance: 6, special: 6, price: 1000, unlock: "3-5", skill: { id: "roll", ko: "옆구르기 반격", desc: "상대 뒤로 굴러 들어가 바깥쪽으로 밀어내요." } },
  { id: "tiger", ko: "아기 호랑이", en: "TIGER CUB", role: "공격형", desc: "강하고 사나워요. 대신 잘 흔들려요.", power: 7, defense: 4, speed: 6, balance: 5, special: 7, price: 1300, unlock: "4-5", skill: { id: "roar", ko: "포효 돌진", desc: "어흥! 상대를 움츠리게 한 뒤 달려들어요." } },
  { id: "penguin", ko: "아기 펭귄", en: "PENGUIN", role: "회피 · 반격형", desc: "미끄러지며 움직여요. 조심하면 누구보다 까다로워요.", power: 4, defense: 5, speed: 6, balance: 7, special: 7, price: 1500, unlock: "5-3", slip: 0.9, skill: { id: "slide", ko: "미끄럼 돌진", desc: "배로 쭉 미끄러져요. 방향은 틀 수 있어도 멈추긴 어려워요." } },
];
export const fighterById = (id) => FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];

/** fr: 바닥 마찰 배수, bounce: 탄성 (별빛은 통통, 눈꽃은 미끄럽게) */
export const WORLDS = [
  { id: "village", ko: "동물 마을 축제장", en: "ANIMAL VILLAGE", sub: "신나는 첫 무대", fr: 1, bounce: 0.62 },
  { id: "bamboo", ko: "대나무 숲 씨름판", en: "BAMBOO GROVE", sub: "폭신한 다다미는 조금 더 튕겨요", fr: 1, bounce: 0.74 },
  { id: "ice", ko: "눈꽃 얼음 경기장", en: "SNOWFLAKE ICE", sub: "미끄러워요! 일찍 멈춰야 해요", fr: 0.62, bounce: 0.6 },
  { id: "desert", ko: "사막 축제 경기장", en: "DESERT FIESTA", sub: "모래에 발이 푹푹, 잘 안 밀려요", fr: 1.3, bounce: 0.5 },
  { id: "star", ko: "별빛 판타지 경기장", en: "STARLIGHT", sub: "닿기만 해도 통통 날아가요", fr: 0.9, bounce: 0.9 },
];

/** 상대 전술: rush 돌진, wall 방어, swift 민첩, fury 공격, smart 전략 */
export const AI_STYLES = {
  rush: { ko: "돌진형", approach: 1, keep: 0, dash: 0.8, push: 0.55, guard: 0.15, dodge: 0.1, patience: 0 },
  wall: { ko: "방어형", approach: 0.45, keep: 0, dash: 0.2, push: 0.5, guard: 0.75, dodge: 0.1, patience: 0.8 },
  swift: { ko: "민첩형", approach: 0.6, keep: 90, dash: 0.25, push: 0.5, guard: 0.1, dodge: 0.8, patience: 0.3 },
  fury: { ko: "공격형", approach: 1, keep: 0, dash: 0.35, push: 1, guard: 0.15, dodge: 0.15, patience: 0 },
  smart: { ko: "전략형", approach: 0.75, keep: 40, dash: 0.5, push: 0.7, guard: 0.5, dodge: 0.55, patience: 0.5 },
};

/* 챔피언십: 월드마다 5경기, 마지막은 월드 챔피언. L 은 AI 난이도 (0 초급 · 1 중급 · 2 고급) */
const S = (opp, style, L, name, extra = {}) => ({ opp, style, L, name, ...extra });
const CAMP = [
  [S("bunny", "swift", 0, "옆집 토끼", { need: 1 }), S("bear", "fury", 0, "동네 곰 형"), S("duck", "rush", 0, "꽥꽥 오리"), S("cat", "swift", 0, "장난꾸러기 냥이"), S("panda", "wall", 0, "마을 대장 판다", { champ: true })],
  [S("pig", "rush", 0, "먹보 돼지"), S("cat", "swift", 1, "대숲 고양이"), S("panda", "wall", 1, "수행하는 판다"), S("bunny", "fury", 1, "번개 토끼"), S("tiger", "rush", 1, "대숲의 호랑이", { champ: true })],
  [S("penguin", "swift", 1, "미끄럼 펭귄"), S("duck", "fury", 1, "빙글 오리"), S("bear", "wall", 1, "겨울잠 곰"), S("cat", "smart", 1, "눈꽃 고양이"), S("penguin", "smart", 1, "얼음 왕 펭귄", { champ: true })],
  [S("tiger", "fury", 1, "모래 호랑이"), S("pig", "rush", 1, "돌격 돼지"), S("bunny", "swift", 2, "사막 토끼"), S("panda", "wall", 2, "오아시스 판다"), S("pig", "smart", 2, "축제 대장 돼지", { champ: true })],
  [S("duck", "swift", 2, "별똥 오리"), S("bear", "fury", 2, "달빛 곰"), S("tiger", "rush", 2, "별빛 호랑이"), S("cat", "smart", 2, "은하 고양이"), S("panda", "smart", 2, "요코즈나 대왕 판다", { champ: true, boss: true, size: 1.28, bonus: 1.6 })],
];
export const CAMPAIGN = CAMP.flatMap((list, w) =>
  list.map((s, i) => ({ ...s, id: `${w + 1}-${i + 1}`, world: w, n: i + 1, need: s.need || 2, bonus: s.bonus ?? (w >= 3 ? 0.4 : 0) }))
);

/** 꾸미기: 모습만 바꾼다 */
export const COSMETICS = [
  { id: "headband", ko: "머리띠", kind: "head", price: 150 },
  { id: "cheer", ko: "응원 모자", kind: "head", price: 250 },
  { id: "sunglasses", ko: "선글라스", kind: "face", price: 300 },
  { id: "crown", ko: "왕관", kind: "head", price: 800 },
  { id: "happi", ko: "축제 의상", kind: "body", price: 350 },
  { id: "cape", ko: "망토", kind: "body", price: 500 },
  { id: "gold", ko: "황금빛 색상", kind: "tint", price: 900 },
  { id: "dance", ko: "춤추는 승리 포즈", kind: "pose", price: 200 },
  { id: "flex", ko: "힘자랑 승리 포즈", kind: "pose", price: 200 },
];

export const DAILY_POOL = [
  { id: "wins3", ko: "3연승 달성하기", k: "streak", n: 3, coin: 120 },
  { id: "dashwin", ko: "돌진으로 상대를 밀어내 승리", k: "dashWin", n: 1, coin: 100 },
  { id: "fast", ko: "30초 안에 경기 이기기", k: "fastWin", n: 1, coin: 100 },
  { id: "noedge", ko: "가장자리에 닿지 않고 승리", k: "noEdge", n: 1, coin: 140 },
  { id: "specialwin", ko: "특수 기술로 승리", k: "specialWin", n: 1, coin: 100 },
  { id: "bearwin", ko: "곰돌이로 승리", k: "charWin", who: "bear", n: 1, coin: 80 },
  { id: "bunnywin", ko: "토끼로 승리", k: "charWin", who: "bunny", n: 1, coin: 80 },
  { id: "pandawin", ko: "판다로 승리", k: "charWin", who: "panda", n: 1, coin: 80 },
  { id: "parry", ko: "버티기로 공격을 3번 튕겨 내기", k: "parry", n: 3, coin: 100 },
  { id: "dodge", ko: "돌진을 피해 상대를 빗나가게 하기", k: "dodgeDash", n: 1, coin: 100 },
];

export const ACHIEVEMENTS = [
  { id: "first", ko: "첫 승리", desc: "처음으로 이겼어요", k: "wins", n: 1, coin: 50 },
  { id: "wins100", ko: "백전노장", desc: "100번 이기기", k: "wins", n: 100, coin: 500 },
  { id: "streak10", ko: "10연승", desc: "연속으로 10번 이기기", k: "bestStreak", n: 10, coin: 300 },
  { id: "allchars", ko: "모두 모였다", desc: "모든 캐릭터 해금", k: "chars", n: 8, coin: 500 },
  { id: "allworlds", ko: "씨름왕", desc: "챔피언십 끝까지 깨기", k: "campaign", n: 25, coin: 1000 },
  { id: "survive10", ko: "철인", desc: "서바이벌 10연승", k: "bestSurvival", n: 10, coin: 300 },
  { id: "comeback", ko: "대역전", desc: "가장자리에서 버틴 뒤 이기기", k: "comebacks", n: 1, coin: 100 },
  { id: "specialko", ko: "필살기!", desc: "특수 기술로 승리", k: "specialWins", n: 1, coin: 100 },
  { id: "parry20", ko: "철벽", desc: "버티기로 공격 20번 튕겨 내기", k: "parries", n: 20, coin: 200 },
  { id: "ta10", ko: "밀어내기 달인", desc: "타임어택 한 판에 10번 밀어내기", k: "bestTaKo", n: 10, coin: 300 },
];
