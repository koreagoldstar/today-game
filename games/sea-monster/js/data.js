/*
 * 바다괴물 탐험대 · 데이터 (괴물 · 보스 · 등급 · 장비 · 스테이지 목록)
 * 스테이지 지형은 stages.js 에 있다.
 */

/* ---------------- 등급 ---------------- */
export const GRADES = {
  COMMON: { label: "COMMON", kr: "일반", color: "#7fd0ff", coins: 20, xp: 20 },
  RARE: { label: "RARE", kr: "희귀", color: "#7dff9a", coins: 40, xp: 40 },
  EPIC: { label: "EPIC", kr: "영웅", color: "#c58bff", coins: 70, xp: 70 },
  LEGENDARY: { label: "LEGENDARY", kr: "전설", color: "#ffd23f", coins: 120, xp: 120 },
  BOSS: { label: "BOSS", kr: "보스", color: "#ff6a5a", coins: 200, xp: 200 },
};

/*
 * 괴물 (도감 순서). 행동 값:
 *  hp       물방울 몇 번 맞으면 잡히는지
 *  r        맞는 범위 반지름(px)
 *  spots    숨는 곳 종류
 *  near     이 거리 안으로 오면 스스로 나타남 (0 = 맞혀야 나타남)
 *  flee     체력이 이 비율 아래로 떨어질 때마다 다른 곳으로 도망가 다시 숨는다
 *  atk      { range, wind(준비 초), cd(쉬는 초), dmg(산소 초) }
 *  tell     숨은 동안 들키는 몸짓 (설명용)
 */
export const MONSTERS = [
  // ---- 01 산호초 입구 ----
  { id: "coralOcto", no: 1, name: "산호문어", grade: "COMMON", stage: 1, hp: 11, r: 34, spots: ["coral"], near: 70, flee: [0.5], speed: 120, atk: { range: 150, wind: 0.7, cd: 2.2, dmg: 5 }, how: "산호 사이에서 촉수 끝이 꼼지락거려요", desc: "산호처럼 위장해요. 맞으면 먹물을 뿜고 다른 산호로 숨어요." },
  { id: "puffer", no: 2, name: "복어괴물", grade: "COMMON", stage: 1, hp: 10, r: 32, spots: ["coral", "rock"], near: 170, flee: [], speed: 90, atk: { range: 130, wind: 0.6, cd: 2.0, dmg: 5 }, how: "바위 뒤로 가시가 삐죽 보여요", desc: "처음엔 작지만 맞으면 가시 공처럼 부풀어요. 부풀었을 땐 가까이 가지 마세요!" },
  { id: "rockCrab", no: 3, name: "바위게", grade: "COMMON", stage: 1, hp: 10, r: 32, spots: ["rockbed"], near: 140, flee: [0.4], speed: 150, atk: { range: 120, wind: 0.65, cd: 1.8, dmg: 5 }, how: "바닥 바위에서 눈자루가 쏙 올라와요", desc: "바닥 바위와 똑같이 생겼어요. 가까이 가면 벌떡 일어나 옆으로 달려요." },
  { id: "clam", no: 4, name: "조개괴물", grade: "COMMON", stage: 1, hp: 9, r: 32, spots: ["sand"], near: 130, flee: [], speed: 0, atk: { range: 330, wind: 0.55, cd: 2.3, dmg: 4 }, how: "모래 위 조개가 살짝 열리며 기포가 나와요", desc: "꼭 닫혀 있다가 입을 벌려 진주를 뱉어요. 열렸을 때만 물총이 통해요." },
  { id: "reefEel", no: 5, name: "산호곰치", grade: "RARE", stage: 1, hp: 12, r: 26, spots: ["hole"], near: 0, flee: [], speed: 0, atk: { range: 190, wind: 0.5, cd: 1.6, dmg: 6 }, how: "벽 구멍에서 머리가 쏙 나왔다 들어가요", desc: "구멍 앞을 지나가면 쏙 튀어나와 물어요. 나왔을 때 재빨리 맞히세요." },
  // ---- 02 해초 숲 ----
  { id: "kelpShark", no: 6, name: "해초상어", grade: "COMMON", stage: 2, hp: 12, r: 30, spots: ["kelp"], near: 190, flee: [0.6, 0.3], speed: 210, fleeSpeed: 460, atk: { range: 230, wind: 0.55, cd: 2.0, dmg: 5 }, how: "해초 덤불 옆으로 꼬리만 살랑살랑", desc: "해초 숲에 숨어 있다가 들키면 쏜살같이 다른 덤불로 도망가요. 끝까지 쫓아가세요!" },
  { id: "weedMonster", no: 7, name: "미역괴물", grade: "RARE", stage: 2, hp: 12, r: 30, spots: ["weed"], near: 150, sneak: true, flee: [0.5], speed: 150, atk: { range: 120, wind: 0.75, cd: 2.4, dmg: 6 }, how: "물결과 반대로 흔들리는 미역", desc: "미역처럼 보여요. 옆을 지나가면 몰래 뒤에서 따라와요. 가끔 뒤를 돌아보세요!" },
  { id: "urchin", no: 8, name: "성게돌이", grade: "COMMON", stage: 2, hp: 9, r: 30, spots: ["sand"], near: 150, flee: [], speed: 130, atk: { range: 260, wind: 0.5, cd: 2.2, dmg: 5 }, how: "바닥의 보라 가시 바위가 꿈틀", desc: "바닥을 데굴데굴 굴러와요. 빠르게 굴러올 때 가시를 조심!" },
  { id: "seahorse", no: 9, name: "해마기사", grade: "RARE", stage: 2, hp: 11, r: 26, spots: ["kelpTall"], near: 140, flee: [0.5], speed: 140, atk: { range: 240, wind: 0.7, cd: 2.2, dmg: 6 }, how: "다시마 줄기에 꼬리를 감은 노란 무언가", desc: "다시마에 꼬리를 감고 숨어 있다가 창처럼 쭉 돌진해요. 몸을 뒤로 젖힐 때가 PERFECT 기회!" },
  // ---- 03 침몰한 보물선 ----
  { id: "chestMimic", no: 10, name: "보물상자괴물", grade: "RARE", stage: 3, hp: 12, r: 36, spots: ["chest"], near: 120, flee: [], speed: 70, atk: { range: 300, wind: 0.6, cd: 2.0, dmg: 5 }, how: "진짜 상자들 사이, 뚜껑 틈으로 혀가 날름", desc: "보물상자처럼 위장해요. 가까이 가면 입을 쩍! 닫혀 있을 땐 물총이 안 통해요." },
  { id: "porthole", no: 11, name: "창문눈알", grade: "RARE", stage: 3, hp: 10, r: 30, spots: ["porthole"], near: 0, flee: [0.66, 0.33], speed: 0, atk: { range: 420, wind: 0.6, cd: 2.2, dmg: 4 }, how: "배의 둥근 창 안에서 커다란 눈이 깜빡", desc: "둥근 창에 눈만 보였다가 다른 창으로 옮겨 가요. 보일 때 재빨리!" },
  { id: "anchorCrab", no: 12, name: "닻게", grade: "COMMON", stage: 3, hp: 11, r: 32, spots: ["anchor"], near: 130, flee: [0.5], speed: 110, atk: { range: 110, wind: 0.7, cd: 2.0, dmg: 6 }, how: "바닥에 놓인 닻 밑에서 눈자루가 쏙", desc: "녹슨 닻을 등에 지고 다녀요. 닻 쪽(뒤)은 단단하니 얼굴 쪽을 노리세요!" },
  // ---- 04 해저 동굴 ----
  { id: "shadeRay", no: 13, name: "그늘가오리", grade: "RARE", stage: 4, hp: 12, r: 40, spots: ["dark"], near: 130, flee: [0.5], speed: 170, atk: { range: 140, wind: 0.6, cd: 2.2, dmg: 6 }, how: "어둠 속에서 커다란 그림자가 스르르", desc: "빛을 싫어해서 헤드램프로 비추면 어둠으로 미끄러져요. 벽 쪽으로 몰아서 맞히세요!" },
  { id: "caveFish", no: 14, name: "동굴눈물고기", grade: "COMMON", stage: 4, hp: 9, r: 26, spots: ["nook"], near: 110, light: 340, flee: [0.5], speed: 160, atk: { range: 170, wind: 0.5, cd: 2.0, dmg: 4 }, how: "어둠 속에 빛나는 두 눈", desc: "어두운 틈에서 눈만 빛나요. 헤드램프로 비추면 깜짝 놀라 나타나요." },
  { id: "stoneFace", no: 15, name: "돌얼굴", grade: "EPIC", stage: 4, hp: 16, r: 46, spots: ["wallface"], near: 170, flee: [0.66, 0.33], speed: 0, atk: { range: 440, wind: 0.6, cd: 2.2, dmg: 5 }, how: "동굴 벽 무늬가 얼굴 같아요", desc: "동굴 벽의 얼굴이 사실은 괴물! 입이 열릴 때만 물총이 통하고, 돌멩이를 뱉어요." },
  // ---- 05 해파리 계곡 ----
  { id: "jellyMonster", no: 16, name: "해파리괴물", grade: "COMMON", stage: 5, hp: 10, r: 34, spots: ["jellies"], near: 120, flee: [0.5], speed: 110, atk: { range: 150, wind: 0.8, cd: 2.4, dmg: 4 }, how: "해파리 무리 중 혼자 박자가 다르게 움찔", desc: "보통 해파리 사이에 섞여 있어요. 들키면 보랏빛으로 변하고, 촉수가 노래지면 찌릿! 그 순간이 PERFECT 기회." },
  { id: "zapEel", no: 17, name: "전기뱀장어", grade: "RARE", stage: 5, hp: 12, r: 40, spots: ["crevice"], near: 170, flee: [0.5], speed: 170, atk: { range: 260, wind: 0.9, cd: 2.6, dmg: 6 }, how: "바위 틈에서 찌릿찌릿 불꽃", desc: "지혁 둘레를 빙빙 돌다가 몸에 전기를 모아 번쩍! 번쩍이기 직전에 맞히면 PERFECT." },
  { id: "jellyTwins", no: 18, name: "쌍둥이해파리", grade: "EPIC", stage: 5, hp: 12, r: 32, spots: ["jellies"], near: 130, flee: [0.5], speed: 120, atk: { range: 380, wind: 0.8, cd: 2.8, dmg: 4 }, how: "해파리 하나가 잠깐 둘로 겹쳐 보여요", desc: "분신 둘을 만들고 자리를 휙휙 바꿔요. 진짜는 분홍빛이 따뜻해요. 분신은 맞히면 퐁!" },
  // ---- 06 화산 해저 ----
  { id: "lavaCrab", no: 19, name: "용암게", grade: "COMMON", stage: 6, hp: 10, r: 40, spots: ["lavarock"], near: 140, flee: [0.4], speed: 130, atk: { range: 130, wind: 0.65, cd: 2.0, dmg: 5 }, how: "용암 바위 사이로 김이 나고 눈자루가 쏙", desc: "등이 용암처럼 뜨거워서 물이 '치익' 증발해요. 계속 쏴서 식히면 파랗게 변해요. 그때가 기회!" },
  { id: "ventWorm", no: 20, name: "열수구벌레", grade: "RARE", stage: 6, hp: 10, r: 34, spots: ["chimney"], near: 0, flee: [0.6, 0.3], speed: 0, atk: { range: 420, wind: 0.6, cd: 2.2, dmg: 4 }, how: "굴뚝 기포가 멈추면 빨간 깃이 쑥", desc: "열수 굴뚝 속에 살아요. 기포가 멈추고 빨간 깃이 나왔을 때만 물총이 통해요. 맞으면 다른 굴뚝으로 쏙!" },
  { id: "magmaTurtle", no: 21, name: "마그마거북", grade: "EPIC", stage: 6, hp: 14, r: 62, spots: ["boulder"], near: 150, flee: [0.5], speed: 55, fleeSpeed: 260, atk: { range: 330, wind: 0.8, cd: 2.6, dmg: 4 }, how: "바위 같은 등껍질에서 김이 나요", desc: "등껍질은 '팅' 하고 튕겨내요. 앞에서 머리를 노리세요! 입이 빨개지면 불 기포를 뿜어요." },
  // ---- 07 얼음 바다 ----
  { id: "frostSquid", no: 22, name: "서리오징어", grade: "RARE", stage: 7, hp: 12, r: 30, spots: ["iceblock"], near: 150, flee: [0.6, 0.3], speed: 130, atk: { range: 360, wind: 0.7, cd: 2.4, dmg: 4 }, how: "얼음 덩어리 위로 하얀 먹물이 퐁", desc: "하얀 먹물 구름을 뿜고 그 속에서 휙 자리를 바꿔요. 구름이 걷히면 다시 찾아요!" },
  { id: "glassCrab", no: 23, name: "유리게", grade: "COMMON", stage: 7, hp: 10, r: 34, spots: ["iceslab"], near: 150, flee: [0.5], speed: 140, atk: { range: 170, wind: 0.6, cd: 2.0, dmg: 5 }, how: "얼음 판 속에 분홍 심장이 콩닥", desc: "몸이 투명해지면 물총이 그냥 지나가요. 분홍 심장을 따라가다 다시 보일 때 맞히세요." },
  { id: "snowSeal", no: 24, name: "눈물범괴물", grade: "EPIC", stage: 7, hp: 11, r: 30, spots: ["icehole"], near: 0, flee: [0.66, 0.33], speed: 0, atk: { range: 460, wind: 0.6, cd: 2.2, dmg: 4 }, how: "얼음 구멍에서 수염이 씰룩", desc: "얼음 구멍을 옮겨 다니며 숨바꼭질! 쏙 나와서 눈뭉치를 던져요. 퐁당 들어가면 근처 구멍을 지켜봐요." },
  // ---- 08 심해 협곡 ----
  { id: "angler", no: 25, name: "심해아귀", grade: "RARE", stage: 8, hp: 12, r: 40, spots: ["abyss"], near: 110, light: 300, flee: [0.5], speed: 110, atk: { range: 240, wind: 0.75, cd: 2.4, dmg: 5 }, how: "어둠 속에 작은 빛 하나가 살랑살랑", desc: "작은 빛으로 유인해요. 헤드램프로 빛 아래를 비추면 커다란 입이 보여요! 입을 쩍 벌릴 때가 PERFECT 기회." },
  { id: "gulper", no: 26, name: "펠리컨장어", grade: "EPIC", stage: 8, hp: 14, r: 44, spots: ["deepnook"], near: 150, light: 280, flee: [0.5], speed: 120, atk: { range: 360, wind: 0.8, cd: 3.0, dmg: 5 }, how: "협곡 틈에서 분홍 꼬리 빛이 깜빡", desc: "입을 쩍 벌려 빨아들이고 물총도 꿀꺽 삼켜요. 빨려가지 않게 헤엄치다가 입을 다물 때 맞히세요!" },
  { id: "isopod", no: 27, name: "대왕갯강구", grade: "COMMON", stage: 8, hp: 10, r: 36, spots: ["bones"], near: 140, flee: [0.5], speed: 70, atk: { range: 300, wind: 0.6, cd: 2.4, dmg: 5 }, how: "고래 뼈 사이에서 더듬이가 씰룩", desc: "몸을 말면 단단한 공이 되어 데굴데굴 굴러와요. 다 굴러가서 어질어질할 때가 기회!" },
  // ---- 09 잃어버린 도시 ----
  { id: "statueGuard", no: 28, name: "석상수호자", grade: "EPIC", stage: 9, hp: 14, r: 44, spots: ["statue"], near: 150, flee: [0.5], speed: 130, atk: { range: 220, wind: 0.75, cd: 2.4, dmg: 5 }, how: "석상들 중 하나의 눈이 가끔 빛나요", desc: "석상인 척하다가 깨어나요. 다시 돌로 굳으면 '팅'! 눈이 빛나며 움직일 때 맞히세요." },
  { id: "nautilus", no: 29, name: "고대앵무조개", grade: "RARE", stage: 9, hp: 11, r: 34, spots: ["pillar"], near: 150, flee: [0.6, 0.3], speed: 140, atk: { range: 380, wind: 0.65, cd: 2.4, dmg: 4 }, how: "기둥 뒤로 줄무늬 껍데기가 빼꼼", desc: "빙글 돌며 순간 이동해서 기둥 사이를 옮겨 다녀요. 사라지는 동안엔 물총이 안 통해요." },
  { id: "mirrorFish", no: 30, name: "거울물고기", grade: "LEGENDARY", stage: 9, hp: 14, r: 36, spots: ["arch"], near: 150, flee: [0.6, 0.3], speed: 130, atk: { range: 400, wind: 0.75, cd: 2.6, dmg: 4 }, how: "아치 창 안에서 무지개빛이 반짝", desc: "분신 셋을 만들어 빙글빙글! 진짜는 아래에 그림자가 있어요. 분신은 맞히면 퐁!" },
  // ---- 10 괴물의 둥지 · 11 심해 폭풍 · 12 어비스 ----
  { id: "eggling", no: 31, name: "알깍쟁이", grade: "COMMON", stage: 10, hp: 6, r: 28, spots: ["egg"], near: 150, flee: [], speed: 190, atk: { range: 160, wind: 0.5, cd: 1.8, dmg: 3 }, how: "둥지의 알 하나가 흔들흔들", desc: "둥지의 알에서 깨어나요. 하나가 깨면 근처 알도 줄줄이! 폴짝폴짝 빠르니 콤보로 잡아요." },
  { id: "whirlFish", no: 32, name: "소용돌이물고기", grade: "EPIC", stage: 11, hp: 11, r: 32, spots: ["eddy"], near: 140, flee: [0.5], speed: 170, atk: { range: 260, wind: 0.65, cd: 2.2, dmg: 5 }, how: "작은 소용돌이 속에 눈 하나가 빙글", desc: "빙글 돌며 사라졌다가 순식간에 등 뒤로 돌아와 깨물어요. 뒤를 돌아보고 덥석 직전에 맞히면 PERFECT!" },
  { id: "stormRay", no: 33, name: "폭풍가오리", grade: "LEGENDARY", stage: 11, hp: 16, r: 50, spots: ["sandbed"], near: 170, flee: [0.66, 0.33], speed: 150, atk: { range: 460, wind: 1.0, cd: 3.2, dmg: 5 }, how: "모래 둔덕이 갑자기 들썩", desc: "날갯짓으로 거센 물살을 일으켜 물총도 날려 버려요. 물살이 잦아들어 헉헉 지쳤을 때가 기회!" },
  { id: "abyssLantern", no: 34, name: "심연등불", grade: "LEGENDARY", stage: 12, hp: 13, r: 34, spots: ["lantern"], near: 130, light: 320, flee: [0.6, 0.3], speed: 120, atk: { range: 420, wind: 0.85, cd: 2.8, dmg: 4 }, how: "떠 있는 빛 속에서 눈 하나가 깜빡", desc: "길 잃은 탐험가를 깊은 곳으로 유인하는 신비한 등불 괴물. 번쩍이기 전에 맞히면 PERFECT! 맞으면 다른 빛으로 휙 숨어요." },
];

export const BOSSES = [
  { id: "sharkKing", name: "난파선 상어왕", stage: 3, desc: "난파선을 지키는 상어왕. 돌진하기 전 꼬리를 흔들어요." },
  { id: "giantJelly", name: "거대 해파리", stage: 5, desc: "계곡을 덮는 거대한 해파리. 갓이 노랗게 빛나면 전기 고리가 퍼져요. 그 순간 맞히면 어질어질!" },
  { id: "volcanoBeast", name: "화산 심해괴수", stage: 6, desc: "용암 바위 갑옷의 괴수. 입이 빨개지면 용암 폭탄! 화나면 바닥에서 마그마 기둥이 솟아요." },
  { id: "kraken", name: "심해의 크라켄", stage: 8, desc: "협곡 아래 숨은 거대한 촉수의 주인. 밑에서 솟는 촉수를 피하고, 눈이 빨개질 때 맞혀요." },
  { id: "seaSerpent", name: "고대 바다뱀", stage: 9, desc: "잃어버린 도시를 휘감은 고대 바다뱀. 물줄기 숨을 피하고, 몸으로 칭칭 감으면 얼른 빠져나가요!" },
  { id: "octoKing", name: "산호초 문어왕", stage: 10, desc: "괴물 둥지를 다스리는 산호 왕관의 문어왕. 분신 산호 속에 숨으면 왕관이 반짝이는 산호를 찾아요!" },
  { id: "abyssal", name: "THE ABYSSAL", stage: 12, desc: "깊은 바다의 고대 바다괴수. 거대한 눈부터 천천히 모습을 드러내요. 눈을 감으면 물총이 안 통해요!" },
];

export const MONSTER_BY_ID = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));
export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

/* ---------------- 장비 (간단한 업그레이드 4종 · 5단계) ---------------- */
export const EQUIP = [
  { id: "gun", name: "물총", icon: "gun", desc: "발사 속도", levels: [0.11, 0.098, 0.088, 0.079, 0.07], unit: (v) => `${Math.round(1 / v)}발/초`, cost: [0, 120, 260, 450, 700] },
  { id: "radar", name: "탐지기", icon: "radar", desc: "탐지 범위", levels: [520, 600, 680, 760, 860], unit: (v) => `${v}m`, cost: [0, 100, 220, 400, 650] },
  { id: "suit", name: "잠수복", icon: "suit", desc: "피해 감소", levels: [1, 0.88, 0.76, 0.65, 0.55], unit: (v) => `${Math.round((1 - v) * 100)}%`, cost: [0, 110, 240, 420, 680] },
  { id: "tank", name: "산소탱크", icon: "tank", desc: "탐험 시간", levels: [0, 8, 16, 24, 34], unit: (v) => `+${v}초`, cost: [0, 100, 230, 410, 660] },
];

/* ---------------- 탐험가 레벨 (경험치) ---------------- */
export function levelFor(xp) {
  let lv = 1;
  let need = 100;
  let x = xp;
  while (x >= need) {
    x -= need;
    lv++;
    need = Math.round(need * 1.25);
  }
  return { lv, cur: x, need };
}

/* ---------------- 점수 ---------------- */
export const SCORE = { hit: 10, find: 150, perfect: 200, capture: 300, timeBonus: 15, noHurt: 500 };
