/*
 * 🌊 바다 물총 대작전 — 콘텐츠 데이터 (EnemyData · StageData · BossData …)
 * 엔진(js/blaster)은 이 파일의 숫자와 이름만 보고 게임을 만든다.
 * 새 친구 추가: enemies 에 한 줄 + art.js 에 그림 하나 → 스테이지 waves 에 넣으면 끝.
 */

/* ------------------------------------------------------------------
 * 적 (EnemyData)
 *  type: normal | special | golden | hidden | bonus | minion
 *  movementPattern / spawnPattern / attackPattern / hitReaction / soakReaction
 *  → js/blaster/enemy.js 의 Movement · Spawn · Attack · HitReactions · Reactions
 * ---------------------------------------------------------------- */
export const ENEMIES = {
  // ===== 일반 친구 20 =====
  "pirate-crab": {
    name: "해적 게", emoji: "🦀", type: "normal", stage: 1, score: 100, speed: 0.14, health: 1, size: 46, cy: -32, hitR: 44,
    movementPattern: "popup", spawnPattern: "popup", attackPattern: null, weakPoint: null,
    hitReaction: "squish", soakReaction: "flipSink", specialAbility: null, sidestep: true, stay: 4.2,
    difficulty: 1, trait: "안대를 한 꼬마 해적. 옆으로만 걸어요.", fun: "물에 맞으면 벌러덩 뒤집혀서 다리를 버둥버둥!",
  },
  puffer: {
    name: "통통 복어", emoji: "🐡", type: "normal", stage: 1, score: 120, speed: 0.12, health: 2, size: 44, cy: -30, hitR: 42,
    movementPattern: "drift", spawnPattern: "popup", attackPattern: null, weakPoint: null,
    hitReaction: "puff", soakReaction: "deflate", stay: 6,
    difficulty: 1, trait: "한 번 맞으면 빵빵하게 부풀어요.", fun: "두 번 맞으면 바람 빠진 풍선처럼 슝슝 날아가요.",
  },
  "flying-fish": {
    name: "날치", emoji: "🐟", type: "normal", stage: 2, score: 130, speed: 0.36, health: 1, size: 36, cy: -14, hitR: 40,
    movementPattern: "arc", spawnPattern: "side", attackPattern: null, jump: 150, hop: 1.3,
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 2, trait: "지느러미 날개로 퐁퐁 뛰어올라요.", fun: "공중에서 맞히면 FAST! 빙글빙글 하늘로 날아가요.",
  },
  "fish-school": {
    name: "물고기 떼", emoji: "🐠", type: "normal", stage: 2, score: 60, speed: 0.27, health: 1, size: 26, cy: -12, hitR: 40,
    movementPattern: "school", spawnPattern: "side", attackPattern: null,
    hitReaction: "squish", soakReaction: "bounceAway",
    difficulty: 2, trait: "다섯 마리가 줄을 지어 헤엄쳐요.", fun: "한 줄을 전부 적시면 보너스 +500!",
  },
  "baby-squid": {
    name: "꼬마 오징어", emoji: "🦑", type: "normal", stage: 4, score: 140, speed: 0.1, health: 2, size: 42, cy: -40, hitR: 42,
    movementPattern: "popup", spawnPattern: "popup", attackPattern: "ink", attackEvery: 3.6, stay: 5,
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 2, trait: "먹물 공을 '뿅' 하고 쏴요.", fun: "날아오는 먹물 공도 물총으로 터뜨릴 수 있어요!", tip: "먹물이 화면에 묻어도 금방 지워져요.",
  },
  "mischief-octopus": {
    name: "장난꾸러기 문어", emoji: "🐙", type: "normal", stage: 4, score: 180, speed: 0.1, health: 2, size: 52, cy: -42, hitR: 46,
    movementPattern: "popup", spawnPattern: "popup", attackPattern: "lob", attackEvery: 3.2, projectile: "balloon", stay: 5.5,
    hitReaction: "angry", soakReaction: "dizzy",
    difficulty: 3, trait: "물풍선을 던지며 깔깔 웃어요.", fun: "흠뻑 젖으면 눈이 빙글빙글~ 별이 반짝!",
  },
  "baby-shark": {
    name: "아기 상어", emoji: "🦈", type: "normal", stage: 3, score: 160, speed: 0.085, health: 2, size: 50, cy: -26, hitR: 44,
    movementPattern: "approach", spawnPattern: "horizon", attackPattern: null,
    weakPoint: { dx: 30, dy: -18, r: 16, when: "open" },
    hitReaction: "squish", soakReaction: "bounceAway",
    difficulty: 3, trait: "보트까지 헤엄쳐 와서 '쿵' 부딪혀요.", fun: "입을 크게 벌렸을 때 입 안을 맞히면 PERFECT!", tip: "가까이 오기 전에 적셔 주세요.",
  },
  "turtle-pirate": {
    name: "거북이 해적", emoji: "🐢", type: "normal", stage: 3, score: 170, speed: 0.11, health: 3, size: 52, cy: -30, hitR: 46,
    movementPattern: "shellHide", spawnPattern: "side", attackPattern: null,
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 3, trait: "가끔 등껍질 속으로 쏙! 그때는 물이 튕겨요.", fun: "흠뻑 젖으면 팽이처럼 뱅글뱅글 돌아요.", tip: "고개를 내밀었을 때 쏘세요.",
  },
  "lobster-chief": {
    name: "랍스터 대장", emoji: "🦞", type: "normal", stage: 7, score: 200, speed: 0.1, health: 3, size: 52, cy: -44, hitR: 46,
    movementPattern: "popup", spawnPattern: "popup", attackPattern: "lob", attackEvery: 3.6, projectile: "bubble", stay: 6,
    weakPoint: { dx: 0, dy: -22, r: 13, when: "always" },
    hitReaction: "angry", soakReaction: "flipSink",
    difficulty: 3, trait: "콧수염을 기른 집게 대장. 거품을 던져요.", fun: "배꼽(줄무늬 배)을 맞히면 PERFECT!",
  },
  jellyfish: {
    name: "둥실 해파리", emoji: "🎐", type: "normal", stage: 6, score: 110, speed: 0.1, health: 1, size: 40, cy: -40, hitR: 40,
    movementPattern: "rise", spawnPattern: "below", attackPattern: null, stay: 7, flying: true,
    hitReaction: "squish", soakReaction: "floatUp",
    difficulty: 2, trait: "물 위를 둥실둥실 떠다녀요.", fun: "맞으면 풍선처럼 하늘로 둥실~",
  },
  "hermit-crab": {
    name: "소라게", emoji: "🐚", type: "normal", stage: 3, score: 150, speed: 0.1, health: 1, size: 42, cy: -36, hitR: 40,
    movementPattern: "peek", spawnPattern: "popup", attackPattern: null, cycle: 2.6, stay: 9,
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 3, trait: "소라 껍데기에 숨었다가 빼꼼!", fun: "빼꼼 나온 순간을 노려요. 껍데기째 뱅글뱅글~",
  },
  "pirate-duck": {
    name: "해적 오리", emoji: "🦆", type: "normal", stage: 1, score: 100, speed: 0.16, health: 1, size: 42, cy: -30, hitR: 42,
    movementPattern: "cross", spawnPattern: "side", attackPattern: null, sound: "quack",
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 1, trait: "해적 모자를 쓴 고무 오리. 꽥!", fun: "맞으면 '꽥꽥!' 하며 빙글빙글 날아가요.",
  },
  "baby-croc": {
    name: "아기 악어", emoji: "🐊", type: "normal", stage: 10, score: 170, speed: 0.08, health: 2, size: 52, cy: -18, hitR: 44,
    movementPattern: "approach", spawnPattern: "horizon", attackPattern: null,
    weakPoint: { dx: 26, dy: -16, r: 15, when: "open" },
    hitReaction: "squish", soakReaction: "bounceAway",
    difficulty: 3, trait: "눈만 내놓고 살금살금 다가와요.", fun: "입을 '쩍' 벌리면 입 안을 노리세요!",
  },
  "little-whale": {
    name: "꼬마 고래", emoji: "🐳", type: "normal", stage: 7, score: 300, speed: 0.05, health: 4, size: 72, cy: -26, hitR: 52,
    movementPattern: "surface", spawnPattern: "popup", attackPattern: null, times: 2, ripple: 52,
    weakPoint: { dx: -6, dy: -58, r: 15, when: "open" },
    hitReaction: "squish", soakReaction: "dizzy",
    difficulty: 3, trait: "떠올라서 '푸슝' 물을 뿜어요.", fun: "물 뿜을 때 숨구멍을 맞히면 PERFECT!",
  },
  "shrimp-squad": {
    name: "새우 특공대", emoji: "🦐", type: "normal", stage: 6, score: 80, speed: 0.3, health: 1, size: 30, cy: -20, hitR: 40,
    movementPattern: "hop", spawnPattern: "side", attackPattern: null,
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 3, trait: "머리띠를 맨 새우 세 마리. 깡총깡총!", fun: "셋 다 적시면 특공대 보너스!",
  },
  dolphin: {
    name: "장난 돌고래", emoji: "🐬", type: "normal", stage: 7, score: 220, speed: 0.4, health: 1, size: 52, cy: -16, hitR: 44,
    movementPattern: "arc", spawnPattern: "side", attackPattern: null, jump: 190, hop: 1.55,
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 3, trait: "높이 뛰어오르는 바다의 장난꾸러기.", fun: "공중제비 돌며 '끼익~' 신나게 날아가요.",
  },
  "rage-crab": {
    name: "폭주 게", emoji: "🦀", type: "normal", stage: 6, score: 170, speed: 0.62, health: 1, size: 44, cy: -30, hitR: 44,
    movementPattern: "dash", spawnPattern: "popup", attackPattern: null,
    hitReaction: "squish", soakReaction: "flipSink",
    difficulty: 4, trait: "땀 흘리며 휙휙 달리는 게.", fun: "멈칫하는 순간을 노리면 쉬워요!",
  },
  "ghost-octopus": {
    name: "투명 문어", emoji: "🐙", type: "normal", stage: 9, score: 220, speed: 0.1, health: 2, size: 50, cy: -42, hitR: 46,
    movementPattern: "fade", spawnPattern: "popup", attackPattern: null, stay: 11,
    hitReaction: "squish", soakReaction: "dizzy",
    difficulty: 4, trait: "몸이 투명해졌다 보였다 해요.", fun: "반짝 보일 때만 맞힐 수 있어요!",
  },
  "golden-fish": {
    name: "황금 물고기", emoji: "✨", type: "golden", stage: 1, score: 500, speed: 0.42, health: 1, size: 32, cy: -14, hitR: 40,
    movementPattern: "zigzag", spawnPattern: "side", attackPattern: null,
    hitReaction: "squish", soakReaction: "spinAway", sound: "bonus",
    difficulty: 3, trait: "어쩌다 한 번 나타나는 반짝반짝 물고기.", fun: "맞히면 BONUS +500! 동전이 우수수~",
  },
  "pirate-parrot": {
    name: "해적 앵무새", emoji: "🦜", type: "normal", stage: 2, score: 150, speed: 0.26, health: 1, size: 42, cy: -10, hitR: 42,
    movementPattern: "fly", spawnPattern: "sky", attackPattern: "lob", attackEvery: 5, projectile: "seed", flying: true,
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 2, trait: "하늘을 날며 씨앗 폭탄을 떨어뜨려요.", fun: "맞으면 깃털이 쭈뼛! 빙글빙글~",
  },

  // ===== 특수 친구 6 =====
  "shield-turtle": {
    name: "방패 거북이", emoji: "🛡️", type: "special", stage: 8, score: 260, speed: 0.1, health: 2, size: 54, cy: -32, hitR: 46,
    movementPattern: "shield", spawnPattern: "side", attackPattern: null,
    weakPoint: { dx: 30, dy: -42, r: 15, when: "open" },
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 4, trait: "둥근 방패로 물을 막아요.", fun: "방패를 내리고 하품할 때 얼굴을 맞혀요!",
  },
  "decoy-puffer": {
    name: "미끼 복어", emoji: "🎣", type: "special", stage: 7, score: 150, speed: 0.12, health: 1, size: 46, cy: -32, hitR: 44,
    movementPattern: "drift", spawnPattern: "popup", attackPattern: null, specialAbility: "split", splitInto: "mini-puffer", stay: 6,
    hitReaction: "squish", soakReaction: "deflate",
    difficulty: 4, trait: "머리에 반짝 미끼를 단 복어.", fun: "맞으면 '펑!' 작은 복어 셋으로 나뉘어요.",
  },
  "teleport-octopus": {
    name: "순간이동 문어", emoji: "🎩", type: "special", stage: 9, score: 240, speed: 0.1, health: 2, size: 48, cy: -42, hitR: 46,
    movementPattern: "teleport", spawnPattern: "popup", attackPattern: "lob", attackEvery: 4.2, projectile: "balloon", every: 1.9, jumps: 5,
    hitReaction: "squish", soakReaction: "dizzy",
    difficulty: 4, trait: "마술 모자를 쓰고 '뿅' 순간이동!", fun: "사라지기 전에 재빨리 맞혀요.",
  },
  "thief-crab": {
    name: "도둑 게", emoji: "💰", type: "special", stage: 4, score: 250, speed: 0.3, health: 2, size: 46, cy: -32, hitR: 44,
    movementPattern: "thief", spawnPattern: "popup", attackPattern: null, carry: "random",
    hitReaction: "squish", soakReaction: "flipSink",
    difficulty: 3, trait: "보물 자루를 들고 후다닥 도망가요.", fun: "적시면 자루 속 아이템을 되찾아요!",
  },
  "golden-pirate-fish": {
    name: "황금 해적 물고기", emoji: "🏴", type: "golden", stage: 5, score: 800, speed: 0.38, health: 3, size: 42, cy: -16, hitR: 44,
    movementPattern: "zigzag", spawnPattern: "side", attackPattern: null,
    hitReaction: "squish", soakReaction: "spinAway", sound: "bonus",
    difficulty: 4, trait: "해적 모자를 쓴 황금빛 물고기.", fun: "세 번 맞히면 BONUS! 동전이 우수수~",
  },
  "storm-ray": {
    name: "폭풍 가오리", emoji: "⚡", type: "special", stage: 6, score: 280, speed: 0.1, health: 3, size: 58, cy: -18, hitR: 50,
    movementPattern: "glide", spawnPattern: "popup", attackPattern: "zap", attackEvery: 3.6, chargeAfter: 7,
    weakPoint: { dx: 0, dy: -10, r: 15, when: "open" },
    hitReaction: "squish", soakReaction: "spinAway", flying: true,
    difficulty: 5, trait: "작은 먹구름을 데리고 다니는 가오리.", fun: "돌진할 때 배를 맞히면 PERFECT!",
  },

  // ===== 숨은 친구 4 =====
  "sunny-starfish": {
    name: "선글라스 불가사리", emoji: "⭐", type: "hidden", stage: 1, score: 500, speed: 0.1, health: 1, size: 36, cy: -26, hitR: 40,
    movementPattern: "drift", spawnPattern: "popup", attackPattern: null, stay: 7,
    hitReaction: "squish", soakReaction: "spinAway", sound: "bonus",
    difficulty: 1, trait: "선글라스 끼고 일광욕하는 불가사리.", fun: "맑은 바다나 갈매기 섬에서 가끔 만나요.", hint: "햇볕이 쨍한 맑은 바다에서 일광욕을 하고 있대요.",
  },
  "rainbow-seahorse": {
    name: "무지개 해마", emoji: "🌈", type: "hidden", stage: 2, score: 500, speed: 0.16, health: 1, size: 40, cy: -40, hitR: 40,
    movementPattern: "zigzag", spawnPattern: "side", attackPattern: null,
    hitReaction: "squish", soakReaction: "floatUp", sound: "bonus",
    difficulty: 2, trait: "일곱 빛깔로 반짝이는 해마.", fun: "갈매기 섬과 깊은 바다에서 가끔 헤엄쳐요.", hint: "갈매기 섬 근처에 무지개빛이 반짝였대요.",
  },
  "baby-narwhal": {
    name: "아기 일각고래", emoji: "🦄", type: "hidden", stage: 8, score: 500, speed: 0.12, health: 2, size: 54, cy: -24, hitR: 46,
    movementPattern: "cross", spawnPattern: "side", attackPattern: null,
    hitReaction: "squish", soakReaction: "spinAway", sound: "bonus",
    difficulty: 3, trait: "뿔이 반짝이는 빙하 바다의 아기 고래.", fun: "빙하 바다에서 자주 놀러 와요.", hint: "차가운 바다에 뿔 달린 친구가 산대요.",
  },
  "golden-duck": {
    name: "황금 고무오리", emoji: "👑", type: "hidden", stage: 0, score: 1000, speed: 0.22, health: 1, size: 44, cy: -30, hitR: 46,
    movementPattern: "rail", spawnPattern: "side", attackPattern: null, sound: "quack",
    hitReaction: "squish", soakReaction: "spinAway",
    difficulty: 2, trait: "왕관을 쓴 반짝반짝 고무오리.", fun: "오리 사격장에서 10콤보를 넘기면 나타나요!", hint: "오리 사격장에서 콤보를 많이 이어 보세요.",
  },

  // ===== 보너스 · 소품 (도감에는 없음) =====
  "mini-puffer": {
    name: "꼬마 복어", type: "minion", book: false, score: 80, speed: 0.2, health: 1, size: 28, cy: -20, hitR: 38,
    movementPattern: "drift", spawnPattern: "none", stay: 4, hitReaction: "squish", soakReaction: "deflate",
  },
  coconut: {
    name: "코코넛", type: "bonus", book: false, score: 300, speed: 0.05, health: 1, size: 30, cy: -18, hitR: 38,
    movementPattern: "float", spawnPattern: "popup", stay: 6, soakReaction: "bounceAway", sound: "bonus",
  },
  "treasure-chest": {
    name: "보물 상자", type: "bonus", book: false, score: 500, speed: 0.05, health: 2, size: 42, cy: -24, hitR: 42,
    movementPattern: "float", spawnPattern: "popup", stay: 7, soakReaction: "bounceAway", sound: "bonus", drop: "random", dropChance: 0.5,
  },
  tentacle: {
    name: "촉수", type: "minion", book: false, score: 200, health: 3, size: 46, cy: -70, hitR: 40, noFlip: true, clipBelow: 6,
    movementPattern: "part", spawnPattern: "none", soakReaction: "dizzy", hitReaction: "squish",
  },
  "king-tentacle": {
    name: "대왕 촉수", type: "minion", book: false, score: 250, health: 4, size: 56, cy: -76, hitR: 42, noFlip: true, clipBelow: 6,
    movementPattern: "part", spawnPattern: "none", soakReaction: "dizzy", hitReaction: "squish",
  },
  "jelly-tentacle": {
    name: "전기 촉수", type: "minion", book: false, score: 200, health: 3, size: 44, cy: -70, hitR: 40, noFlip: true, clipBelow: 6,
    movementPattern: "part", spawnPattern: "none", soakReaction: "dizzy", hitReaction: "squish",
  },
  "sea-coil": {
    name: "괴수 몸통", type: "minion", book: false, score: 250, health: 4, size: 50, cy: -60, hitR: 42, noFlip: true, clipBelow: 6,
    movementPattern: "part", spawnPattern: "none", soakReaction: "dizzy", hitReaction: "squish",
  },
  cannon: {
    name: "대포", type: "minion", book: false, score: 300, health: 4, size: 30, cy: -20, hitR: 40, noFlip: true, flying: true,
    movementPattern: "part", spawnPattern: "none", soakReaction: "spinAway", hitReaction: "squish",
  },
  "balloon-target": {
    name: "물풍선", type: "minion", book: false, score: 100, speed: 70, health: 1, size: 38, cy: -40, hitR: 40, noFlip: true,
    movementPattern: "balloon", spawnPattern: "below", soakReaction: "floatUp", sound: "pop",
  },
  "balloon-gold": {
    name: "황금 풍선", type: "bonus", book: false, score: 500, speed: 95, health: 1, size: 38, cy: -40, hitR: 40, noFlip: true,
    movementPattern: "balloon", spawnPattern: "below", soakReaction: "floatUp", sound: "bonus",
  },
  "duck-target": {
    name: "사격장 오리", type: "minion", book: false, score: 100, speed: 0.32, health: 1, size: 40, cy: -30, hitR: 40,
    movementPattern: "rail", spawnPattern: "none", soakReaction: "flipSink", sound: "quack",
  },
  "duck-gold": {
    name: "반짝 오리", type: "bonus", book: false, score: 500, speed: 0.46, health: 1, size: 40, cy: -30, hitR: 40,
    movementPattern: "rail", spawnPattern: "none", soakReaction: "spinAway", sound: "bonus",
  },
  "splash-target": {
    name: "과녁 부표", type: "minion", book: false, score: 100, health: 1, size: 40, cy: -32, hitR: 40, noFlip: true,
    movementPattern: "blink", spawnPattern: "popup", soakReaction: "spinAway", sound: "pop",
  },
  "splash-target-gold": {
    name: "황금 과녁", type: "bonus", book: false, score: 500, health: 1, size: 36, cy: -32, hitR: 38, noFlip: true,
    movementPattern: "blink", spawnPattern: "popup", soakReaction: "spinAway", sound: "bonus", stay: 1,
  },
};
for (const [id, d] of Object.entries(ENEMIES)) d.id = id;

/* ------------------------------------------------------------------
 * 보스 (BossData)
 * ---------------------------------------------------------------- */
export const BOSSES = {
  "armored-crab": {
    name: "거대 갑옷 게", title: "ARMORED KING CRAB", emoji: "🦀", stage: 3, size: 148, hp: 95, height: 150, ripple: 72, slow: 1.3, intro: "rise",
    home: { z: 0.3 }, moveRange: 0.45, hopH: 24,
    body: [{ dx: 0, dy: -62, r: 62 }],
    weak: [{ id: "belly", dx: 0, dy: -30, r: 20, open: ["recover", "stun"] }],
    mouth: { dy: -40 },
    phases: [
      { at: 1, attacks: ["bubbles", "minions"], tempo: 1 },
      { at: 0.6, attacks: ["bubbles", "slam", "minions"], tempo: 1.15, shout: "망치 집게가 번쩍!" },
      { at: 0.3, attacks: ["slam", "fan", "minions"], tempo: 1.3, shout: "갑옷 게가 화났다!" },
    ],
    attacks: {
      bubbles: { type: "volley", proj: "bubble", n: 3, spread: 0.5, windup: 0.9 },
      minions: { type: "minions", enemy: "pirate-crab", n: 2, windup: 0.6 },
      slam: { type: "slam", proj: "wave", n: 3, windup: 1.1 },
      fan: { type: "volley", proj: "balloon", n: 5, spread: 0.9, gap: 0.12, windup: 1 },
    },
    difficulty: 2, trait: "산호초를 지키는 갑옷 입은 왕 게. 오른쪽은 망치 집게!", fun: "집게로 바다를 쾅! 지쳐서 배 갑옷이 열릴 때가 기회!",
  },
  "storm-jelly": {
    name: "폭풍 해파리", title: "STORM JELLYFISH", emoji: "⚡", stage: 6, size: 112, hp: 130, height: 200, ripple: 70, slow: 1.25, intro: "drop", hover: 40,
    home: { z: 0.3 }, moveRange: 0.5, hopH: 12,
    body: [{ dx: 0, dy: -100, r: 64 }],
    weak: [{ id: "core", dx: 0, dy: -92, r: 18, open: ["recover", "stun"] }],
    mouth: { dy: -72 },
    phases: [
      { at: 1, attacks: ["zap", "tentacles", "minions"], tempo: 1 },
      { at: 0.55, attacks: ["tentacles", "rain", "zap", "minions"], tempo: 1.2, shout: "번쩍번쩍! 폭풍이 세졌다!" },
    ],
    attacks: {
      zap: { type: "volley", proj: "spark", n: 3, spread: 0.6, windup: 0.9 },
      tentacles: { type: "parts", enemy: "jelly-tentacle", n: 4, width: 1.3, every: 1.7, proj: "spark", windup: 1, timeout: 14 },
      rain: { type: "rain", proj: "spark", n: 6, gap: 0.26, windup: 1, dur: 2.2 },
      minions: { type: "minions", enemy: "jellyfish", n: 2, windup: 0.6 },
    },
    difficulty: 3, trait: "먹구름 왕관을 쓴 커다란 해파리. 몸속에 번개 핵이 있어요.", fun: "전기 촉수를 모두 적시면 기절! 반짝이는 번개 핵을 노려요.",
  },
  "shark-king": {
    name: "상어 해적왕", title: "PIRATE SHARK KING", emoji: "🦈", stage: 8, size: 104, hp: 160, height: 220, ripple: 80, slow: 1.15, intro: "surge",
    home: { z: 0.3 }, moveRange: 0.42, hopH: 10,
    body: [{ dx: 0, dy: -84, r: 70 }],
    weak: [{ id: "mouth", dx: 44, dy: -58, r: 18, open: ["recover", "stun", "charge"] }],
    mouth: { dx: 44, dy: -58 },
    phases: [
      { at: 1, attacks: ["cannons", "crew", "dive"], tempo: 1 },
      { at: 0.6, attacks: ["cannons", "wall", "snow", "crew"], tempo: 1.15, shout: "대포 준비! 쏴라!" },
      { at: 0.3, attacks: ["charge", "wall", "cannons"], tempo: 1.3, shout: "해적왕의 돌격!" },
    ],
    attacks: {
      cannons: { type: "volley", proj: "cannonball", n: 3, spread: 0.6, windup: 0.9 },
      crew: { type: "minions", enemy: "baby-shark", n: 2, windup: 0.6, spawn: "horizon" },
      dive: { type: "dive", windup: 0.5, then: "cannonball" },
      wall: { type: "wall", proj: "spray", n: 7, gaps: 1, windup: 1, say: "꼬리로 물벽!" },
      snow: { type: "rain", proj: "snowball", n: 6, gap: 0.26, windup: 0.9 },
      charge: { type: "charge", dur: 4.3, zMax: 0.78, stopAt: 0.26, windup: 1.1, say: "돌격! 금니를 노려!" },
    },
    difficulty: 4, trait: "금니가 반짝이는 상어 해적들의 왕.", fun: "입을 크게 벌리면 금니 쪽을 쏴요! 돌격도 멈출 수 있어요.",
  },
  "octopus-captain": {
    name: "거대 문어 선장", title: "GIANT OCTOPUS CAPTAIN", emoji: "🐙", stage: 11, size: 116, hp: 180, height: 200, ripple: 80, slow: 1.1, intro: "rise",
    home: { z: 0.28 }, moveRange: 0.45,
    body: [{ dx: 0, dy: -100, r: 60 }],
    weak: [{ id: "badge", dx: 0, dy: -168, r: 16, open: ["recover", "stun"] }],
    mouth: { dy: -64 },
    phases: [
      { at: 1, attacks: ["ink", "balloons", "tentacles"], tempo: 1 },
      { at: 0.55, attacks: ["tentacles", "balloons", "squids", "dive"], tempo: 1.2, shout: "선장님이 화났다!" },
    ],
    attacks: {
      ink: { type: "ink", n: 3, windup: 0.8 },
      balloons: { type: "volley", proj: "balloon", n: 4, spread: 0.7, windup: 0.9 },
      tentacles: { type: "parts", enemy: "king-tentacle", n: 4, width: 1.4, every: 1.5, proj: "balloon", windup: 1, timeout: 14 },
      squids: { type: "minions", enemy: ["baby-squid", "ghost-octopus"], n: 2, windup: 0.6 },
      dive: { type: "dive", windup: 0.5, then: "balloon" },
    },
    difficulty: 4, trait: "심해 입구를 지키는 콧수염 문어 선장.", fun: "빛나는 촉수를 모두 적시면 기절! 모자의 닻 배지를 노려요.",
  },
  leviathan: {
    name: "바다 괴수", title: "SEA LEVIATHAN", emoji: "🐉", stage: 12, size: 100, hp: 250, height: 250, ripple: 90, intro: "slow",
    home: { z: 0.3 }, moveRange: 0.36,
    body: [{ dx: 0, dy: -150, r: 62 }, { dx: 0, dy: -62, r: 40 }],
    weak: [{ id: "gem", dx: 0, dy: -178, r: 16, open: ["recover", "stun", "charge"] }],
    mouth: { dy: -108 },
    phases: [
      { at: 1, attacks: ["coils", "volley", "ink"], tempo: 1, shout: "PHASE 1 · 몸통 공격!" },
      { at: 0.66, attacks: ["wall", "wall2", "volley", "minions"], tempo: 1.15, shout: "PHASE 2 · 물벽 공격!" },
      { at: 0.33, attacks: ["charge", "wall", "coils"], tempo: 1.3, shout: "PHASE 3 · 마지막 돌진!" },
    ],
    attacks: {
      coils: { type: "parts", enemy: "sea-coil", n: 4, width: 1.6, every: 1.4, proj: "spray", windup: 1.1, timeout: 15 },
      ink: { type: "ink", n: 3, windup: 0.8 },
      volley: { type: "volley", proj: "balloon", n: 5, spread: 0.9, gap: 0.14, windup: 1 },
      wall: { type: "wall", proj: "spray", n: 7, gaps: 1, windup: 1, say: "물벽이다!" },
      wall2: { type: "wall", proj: "spray", n: 9, gaps: 2, windup: 1.1, dur: 3.2, say: "틈을 찾아!" },
      minions: { type: "minions", enemy: ["storm-ray", "mischief-octopus"], n: 2, windup: 0.6 },
      charge: { type: "charge", dur: 5, zMax: 0.8, stopAt: 0.3, windup: 1.2, say: "이마 보석을 노려!" },
    },
    difficulty: 5, trait: "가장 깊은 바다에서 올라온 거대한 바다 괴수.", fun: "돌진할 때 이마 보석을 맞혀서 멈추면 SUPER SPLASH!",
  },
};
for (const [id, d] of Object.entries(BOSSES)) d.id = id;

/* ------------------------------------------------------------------
 * 적이 던지는 것 · 아이템
 * ---------------------------------------------------------------- */
export const PROJECTILES = {
  balloon: { size: 18, color: "#ff7eb6" },
  bubble: { size: 20, color: "#bfefff", arc: 120 },
  ink: { size: 18, color: "#6b3fa0", effect: "ink" },
  wave: { size: 28, color: "#9fe3ff", arc: 6 },
  spark: { size: 16, color: "#fff27a" },
  pebble: { size: 16, color: "#ffb36b", arc: 220 },
  beachball: { size: 22, color: "#ff5d5d", arc: 160 },
  spray: { size: 18, color: "#7fd6ff", arc: 20 },
  seed: { size: 15, color: "#b8763b", arc: 40 },
  cannonball: { size: 18, color: "#56627a", arc: 150 },
  snowball: { size: 16, color: "#e6f6ff", arc: 220 },
};

export const ITEMS = {
  bomb: { name: "WATER BOMB", title: "WATER BOMB!", desc: "주변을 한 번에 흠뻑!", emoji: "💣", effect: "bomb", color: "#7fe0ff", stroke: "#0b4f7c", trait: "맞히면 커다란 물폭탄이 '쾅!' 주변 친구들이 한 번에 흠뻑 젖어요." },
  thunder: { name: "THUNDER WATER", title: "THUNDER WATER!", desc: "찌릿찌릿 옆 친구까지!", emoji: "⚡", effect: "thunder", time: 7, color: "#fff27a", stroke: "#7a5a00", trait: "7초 동안 물줄기가 찌릿! 근처 친구 둘에게 옮겨 가요." },
  ice: { name: "ICE SPLASH", title: "ICE SPLASH!", desc: "모두 느릿느릿~", emoji: "❄️", effect: "ice", time: 5, color: "#c8f4ff", stroke: "#1d6fa5", trait: "5초 동안 바다가 꽁꽁! 모두 느릿느릿 움직여요." },
  rainbow: { name: "RAINBOW SPLASH", title: "RAINBOW SPLASH!", desc: "세 갈래 물총 · 점수 2배", emoji: "🌈", effect: "rainbow", time: 7, color: "#ffb3f0", stroke: "#7a1d6b", trait: "7초 동안 무지개 물줄기 세 갈래! 점수도 두 배." },
  heart: { name: "하트 튜브", title: "하트 +1", desc: "", emoji: "❤️", effect: "heart", color: "#ff8fb1", stroke: "#7a0f35", trait: "하트 하나를 다시 채워 줘요. 하트가 모자랄 때만 나와요." },
};

/* ------------------------------------------------------------------
 * 보트 (모두 모양만 달라요 — 실력 차이 없음)
 * ---------------------------------------------------------------- */
export const BOATS = [
  { id: "blue-shark", name: "BLUE SHARK", hint: "처음부터", unlock: null },
  { id: "speed-boat", name: "SPEED BOAT", hint: "STAGE 03 클리어", unlock: { stage: 3 } },
  { id: "pirate-boat", name: "PIRATE BOAT", hint: "STAGE 05 클리어", unlock: { stage: 5 } },
  { id: "ice-boat", name: "ICE BOAT", hint: "STAGE 08 클리어", unlock: { stage: 8 } },
  { id: "submarine", name: "SUBMARINE", hint: "STAGE 11 클리어", unlock: { stage: 11 } },
  { id: "rainbow-boat", name: "RAINBOW BOAT", hint: "STAGE 12 클리어", unlock: { stage: 12 } },
];

/* ------------------------------------------------------------------
 * 음악 분위기 (엔진이 즉석에서 연주)
 * ---------------------------------------------------------------- */
const M = (bpm, root, scale, prog, lead, drums, seed, extra = {}) => ({ bpm, root, scale, prog, lead, drums, seed, ...extra });
const BOSS = (root, seed) => M(146, root, "minor", "boss", "pluck", "boss", seed, { density: 0.7 });

/* ------------------------------------------------------------------
 * 스테이지 (StageData)
 *  waves: [시간(초), 적 id, 마릿수, { spawn, x, z, gap, group, stay, … }]
 *  rare : 가끔 나오는 친구 — 나올지 말지 판 시작 때 정한다
 * ---------------------------------------------------------------- */
const W = (t, id, n = 1, o = {}) => [t, id, n, o];

export const STAGES = [
  {
    id: "s1", name: "맑은 바다", en: "CLEAR WATERS", emoji: "🏝️", tint: "#4fc3f7", scene: "clear", difficulty: 1, attacks: false,
    music: M(100, 60, "major", "bright", "marimba", "soft", 3),
    goal: "해적 게를 물총으로 흠뻑!",
    waves: [
      W(0.6, "pirate-crab", 1, { x: 0.05, z: 0.5, stay: 9 }),
      W(6, "pirate-crab", 2, { gap: 1.2, stay: 5 }),
      W(10.5, "pirate-duck", 2, { gap: 1.6 }),
      W(15, "puffer", 2, { gap: 1.5 }),
      W(20, "pirate-crab", 3, { gap: 0.9 }),
      W(25, "pirate-duck", 3, { gap: 1.1 }),
      W(30, "puffer", 2, { gap: 1 }),
      W(34, "pirate-crab", 4, { gap: 0.7 }),
      W(39, "pirate-duck", 2, { gap: 0.8 }),
      W(39.5, "puffer", 1),
      W(44, "pirate-crab", 3, { gap: 0.6 }),
    ],
    rare: [{ id: "sunny-starfish", at: 22, chance: 0.6 }, { id: "golden-fish", at: 31, chance: 0.4 }],
    items: { first: 17, every: 20, pool: ["bomb", "rainbow"] },
  },
  {
    id: "s2", name: "갈매기 섬", en: "SEAGULL ISLE", emoji: "🌴", tint: "#26c6a0", scene: "gull", difficulty: 2,
    music: M(108, 62, "penta", "island", "steel", "island", 11),
    goal: "날치와 물고기 떼, 하늘의 앵무새까지!",
    waves: [
      W(0.8, "pirate-duck", 2, { gap: 1 }),
      W(4, "flying-fish", 2, { gap: 1.4 }),
      W(8, "fish-school", 5, { group: "school", from: "left", z: 0.42 }),
      W(12, "pirate-parrot", 1, { from: "right" }),
      W(14, "coconut", 2, { gap: 0.8 }),
      W(16, "puffer", 2, { gap: 1 }),
      W(20, "flying-fish", 3, { gap: 0.9 }),
      W(24, "fish-school", 5, { group: "school", from: "right", z: 0.3 }),
      W(27, "pirate-parrot", 2, { gap: 1.4 }),
      W(31, "pirate-crab", 3, { gap: 0.7 }),
      W(35, "flying-fish", 2, { gap: 0.6, from: "left" }),
      W(37, "fish-school", 5, { group: "school", z: 0.55 }),
      W(41, "pirate-parrot", 2, { gap: 0.8 }),
      W(42, "coconut", 2, { gap: 0.5 }),
      W(45, "flying-fish", 4, { gap: 0.6 }),
    ],
    rare: [{ id: "rainbow-seahorse", at: 26, chance: 0.55 }, { id: "sunny-starfish", at: 12, chance: 0.35 }, { id: "golden-fish", at: 34, chance: 0.5 }],
    items: { first: 14, every: 17, pool: ["bomb", "rainbow", "thunder"] },
  },
  {
    id: "s3", name: "산호초 바다", en: "CORAL REEF", emoji: "🪸", tint: "#ff8fa8", scene: "coral", difficulty: 3, boss: "armored-crab",
    music: M(112, 64, "major", "island", "steel", "island", 21), bossMusic: BOSS(57, 22),
    goal: "산호초의 주인, 거대 갑옷 게를 만나러!",
    waves: [
      W(0.8, "fish-school", 5, { group: "school", from: "left", z: 0.4 }),
      W(4, "hermit-crab", 2, { gap: 1.4 }),
      W(8, "puffer", 2, { gap: 1 }),
      W(11, "baby-shark", 1, { x: -0.4 }),
      W(14, "treasure-chest", 1),
      W(15, "turtle-pirate", 1, { from: "right", z: 0.4 }),
      W(19, "fish-school", 5, { group: "school", from: "right", z: 0.55 }),
      W(22, "baby-shark", 2, { gap: 2, x: 0.4 }),
      W(25, "hermit-crab", 2, { gap: 1 }),
      W(28, "pirate-crab", 3, { gap: 0.7 }),
      W(32, "turtle-pirate", 2, { gap: 1.6 }),
      W(35, "puffer", 2, { gap: 0.7 }),
    ],
    rare: [{ id: "golden-fish", at: 18, chance: 0.5 }],
    items: { first: 12, every: 16, pool: ["bomb", "rainbow", "thunder"] },
  },
  {
    id: "s4", name: "오징어 만", en: "THE SQUID BAY", emoji: "🦑", tint: "#9a8fd6", scene: "squidbay", difficulty: 4,
    music: M(104, 62, "dorian", "calm", "bell", "soft", 31, { pad: true }),
    goal: "바위 뒤에 숨은 오징어들을 찾아요!",
    waves: [
      W(0.8, "baby-squid", 1, { x: -0.2, z: 0.45 }),
      W(3, "hermit-crab", 1, { x: -0.55, z: 0.36 }),
      W(5, "hermit-crab", 1, { x: 0.5, z: 0.46 }),
      W(8, "baby-squid", 2, { gap: 1.2 }),
      W(12, "mischief-octopus", 1, { x: 0.1 }),
      W(15, "thief-crab", 1, { x: 0, z: 0.4 }),
      W(18, "baby-squid", 3, { gap: 0.8 }),
      W(22, "hermit-crab", 2, { gap: 1, x: 0.02, z: 0.24 }),
      W(25, "mischief-octopus", 2, { gap: 1.6 }),
      W(29, "thief-crab", 1),
      W(31, "baby-squid", 3, { gap: 0.6 }),
      W(35, "hermit-crab", 1, { x: -0.55, z: 0.36 }),
      W(35.5, "hermit-crab", 1, { x: 0.5, z: 0.46 }),
      W(38, "mischief-octopus", 2, { gap: 0.9 }),
      W(42, "baby-squid", 4, { gap: 0.5 }),
    ],
    rare: [{ id: "golden-fish", at: 24, chance: 0.5 }],
    items: { first: 12, every: 16, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
  {
    id: "s5", name: "해적 바다", en: "PIRATE WATERS", emoji: "🏴‍☠️", tint: "#ff9f43", scene: "pirate", difficulty: 5,
    music: M(118, 57, "dorian", "minor", "pluck", "island", 41),
    goal: "해적선이 보이는 바다! 보물을 지켜라",
    waves: [
      W(0.8, "pirate-crab", 2, { gap: 0.8 }),
      W(3, "pirate-parrot", 2, { gap: 1.2 }),
      W(7, "turtle-pirate", 2, { gap: 1.4 }),
      W(10, "thief-crab", 1),
      W(12, "golden-pirate-fish", 1, { from: "left" }),
      W(14, "baby-shark", 2, { gap: 1.4 }),
      W(18, "treasure-chest", 1),
      W(19, "pirate-crab", 4, { gap: 0.6 }),
      W(23, "pirate-parrot", 3, { gap: 0.8 }),
      W(27, "turtle-pirate", 2, { gap: 0.9 }),
      W(30, "thief-crab", 1),
      W(32, "baby-shark", 2, { gap: 0.9 }),
      W(35, "pirate-duck", 3, { gap: 0.5 }),
      W(38, "pirate-crab", 3, { gap: 0.5 }),
      W(41, "pirate-parrot", 2, { gap: 0.6 }),
    ],
    rare: [{ id: "golden-pirate-fish", at: 26, chance: 0.6 }],
    items: { first: 11, every: 15, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
  {
    id: "s6", name: "폭풍 바다", en: "STORMY SEA", emoji: "⛈️", tint: "#5c6b86", scene: "stormy", difficulty: 6, boss: "storm-jelly",
    music: M(124, 55, "minor", "minor", "pluck", "storm", 51), bossMusic: BOSS(55, 52),
    goal: "번쩍번쩍! 폭풍 속 해파리 여왕",
    waves: [
      W(0.8, "rage-crab", 2, { gap: 0.8 }),
      W(4, "shrimp-squad", 3, { group: "formation", from: "left", z: 0.45 }),
      W(8, "storm-ray", 1),
      W(11, "jellyfish", 2, { gap: 0.8 }),
      W(14, "flying-fish", 3, { gap: 0.6 }),
      W(18, "shrimp-squad", 3, { group: "formation", from: "right", z: 0.3 }),
      W(21, "rage-crab", 3, { gap: 0.7 }),
      W(25, "storm-ray", 1),
      W(26, "jellyfish", 3, { gap: 0.6 }),
      W(30, "shrimp-squad", 3, { group: "formation", z: 0.55 }),
      W(33, "rage-crab", 2, { gap: 0.5 }),
    ],
    rare: [{ id: "golden-fish", at: 20, chance: 0.5 }],
    items: { first: 10, every: 14, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
  {
    id: "s7", name: "깊은 바다", en: "DEEP BLUE", emoji: "🐋", tint: "#1450a6", scene: "deep", difficulty: 7,
    music: M(116, 65, "major", "bright", "steel", "island", 61),
    goal: "출렁출렁 큰 너울, 고래와 돌고래",
    waves: [
      W(0.8, "dolphin", 1, { from: "left" }),
      W(3, "jellyfish", 2, { gap: 1 }),
      W(7, "little-whale", 1, { x: -0.3, z: 0.3 }),
      W(10, "lobster-chief", 1, { x: 0.5 }),
      W(13, "decoy-puffer", 1, { x: -0.3 }),
      W(16, "dolphin", 2, { gap: 1.2 }),
      W(19, "fish-school", 5, { group: "school", z: 0.5 }),
      W(23, "little-whale", 1, { x: 0.4, z: 0.25 }),
      W(24, "lobster-chief", 1, { x: -0.5 }),
      W(28, "jellyfish", 3, { gap: 0.6 }),
      W(31, "decoy-puffer", 2, { gap: 1 }),
      W(34, "dolphin", 2, { gap: 0.8 }),
      W(37, "lobster-chief", 2, { gap: 1.4 }),
      W(41, "little-whale", 1, { x: 0, z: 0.3 }),
    ],
    rare: [{ id: "rainbow-seahorse", at: 22, chance: 0.4 }, { id: "golden-fish", at: 30, chance: 0.5 }],
    items: { first: 10, every: 14, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
  {
    id: "s8", name: "빙하 바다", en: "GLACIER SEA", emoji: "🧊", tint: "#6ac0dc", scene: "glacier", difficulty: 8, boss: "shark-king",
    music: M(100, 67, "major", "calm", "bell", "soft", 71, { pad: true }), bossMusic: BOSS(55, 72),
    goal: "꽁꽁 빙하 바다, 상어 해적왕이 온다!",
    waves: [
      W(0.8, "shield-turtle", 1, { from: "left", z: 0.42 }),
      W(4, "fish-school", 5, { group: "school", z: 0.3 }),
      W(8, "baby-shark", 2, { gap: 1.6 }),
      W(12, "little-whale", 1, { x: 0.3, z: 0.25 }),
      W(14, "shield-turtle", 1, { from: "right", z: 0.5 }),
      W(18, "puffer", 3, { gap: 0.6 }),
      W(21, "baby-shark", 2, { gap: 1 }),
      W(24, "fish-school", 5, { group: "school", z: 0.55 }),
      W(27, "shield-turtle", 2, { gap: 2.4 }),
      W(31, "baby-shark", 3, { gap: 0.9 }),
    ],
    rare: [{ id: "baby-narwhal", at: 16, chance: 0.75 }, { id: "golden-fish", at: 26, chance: 0.5 }],
    items: { first: 9, every: 13, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
  {
    id: "s9", name: "야간 바다", en: "MOONLIT SEA", emoji: "🌙", tint: "#24407e", scene: "night", difficulty: 9,
    music: M(88, 62, "minorPenta", "calm", "bell", "none", 81, { pad: true, density: 0.45 }),
    goal: "반짝반짝 밤바다의 숨바꼭질",
    waves: [
      W(0.8, "jellyfish", 3, { gap: 0.7 }),
      W(5, "ghost-octopus", 1, { x: -0.3 }),
      W(8, "flying-fish", 3, { gap: 0.7 }),
      W(12, "ghost-octopus", 2, { gap: 1.2 }),
      W(15, "golden-fish", 1),
      W(17, "dolphin", 2, { gap: 1.2 }),
      W(20, "jellyfish", 4, { gap: 0.5 }),
      W(24, "teleport-octopus", 1),
      W(27, "ghost-octopus", 2, { gap: 0.8 }),
      W(30, "flying-fish", 4, { gap: 0.5 }),
      W(34, "teleport-octopus", 1),
      W(36, "dolphin", 2, { gap: 0.8 }),
      W(39, "jellyfish", 3, { gap: 0.5 }),
      W(41, "ghost-octopus", 2, { gap: 0.6 }),
    ],
    rare: [{ id: "golden-fish", at: 32, chance: 0.6 }],
    items: { first: 9, every: 12, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
  {
    id: "s10", name: "폭풍우", en: "THE TEMPEST", emoji: "🌪️", tint: "#3f5568", scene: "tempest", difficulty: 10,
    music: M(132, 52, "minor", "minor", "pluck", "storm", 91),
    goal: "거센 폭풍우! 끝까지 버텨요",
    waves: [
      W(0.8, "storm-ray", 1),
      W(3, "rage-crab", 3, { gap: 0.6 }),
      W(7, "baby-croc", 1, { x: -0.3 }),
      W(9, "shrimp-squad", 3, { group: "formation", from: "left", z: 0.42 }),
      W(13, "decoy-puffer", 1, { x: 0.4 }),
      W(15, "storm-ray", 1),
      W(18, "baby-croc", 2, { gap: 1.4 }),
      W(21, "lobster-chief", 1, { x: -0.5 }),
      W(23, "shrimp-squad", 3, { group: "formation", from: "right", z: 0.3 }),
      W(26, "rage-crab", 3, { gap: 0.5 }),
      W(29, "storm-ray", 1),
      W(31, "decoy-puffer", 2, { gap: 0.9 }),
      W(35, "baby-croc", 2, { gap: 0.9 }),
      W(38, "shrimp-squad", 3, { group: "formation", z: 0.55 }),
      W(41, "rage-crab", 4, { gap: 0.4 }),
    ],
    rare: [{ id: "golden-fish", at: 24, chance: 0.5 }],
    items: { first: 8, every: 12, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
  {
    id: "s11", name: "심해 입구", en: "ABYSS GATE", emoji: "🌀", tint: "#1f7f86", scene: "abyss", difficulty: 11, boss: "octopus-captain",
    music: M(106, 57, "dorian", "minor", "bell", "soft", 101, { pad: true }), bossMusic: BOSS(57, 102),
    goal: "빛나는 심해 입구, 문어 선장의 바다",
    waves: [
      W(0.8, "ghost-octopus", 1, { x: 0.2 }),
      W(3, "baby-squid", 2, { gap: 0.8 }),
      W(6, "teleport-octopus", 1),
      W(9, "lobster-chief", 1, { x: -0.5 }),
      W(11, "mischief-octopus", 2, { gap: 1 }),
      W(14, "golden-pirate-fish", 1, { from: "left" }),
      W(16, "ghost-octopus", 2, { gap: 0.8 }),
      W(19, "baby-squid", 3, { gap: 0.6 }),
      W(22, "teleport-octopus", 1),
      W(24, "lobster-chief", 1, { x: 0.5 }),
      W(26, "mischief-octopus", 2, { gap: 0.6 }),
    ],
    rare: [{ id: "golden-pirate-fish", at: 18, chance: 0.6 }],
    items: { first: 8, every: 12, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
  {
    id: "s12", name: "최종 보스 해역", en: "LEVIATHAN WATERS", emoji: "👑", tint: "#a24a9a", scene: "final", difficulty: 12, boss: "leviathan",
    music: M(128, 55, "minor", "minor", "pluck", "storm", 111), bossMusic: M(156, 55, "minor", "boss", "pluck", "boss", 112, { density: 0.75 }),
    goal: "마지막 항해! 바다 괴수를 막아라",
    waves: [
      W(0.8, "mischief-octopus", 2, { gap: 0.8 }),
      W(4, "storm-ray", 1),
      W(6, "ghost-octopus", 1),
      W(8, "shrimp-squad", 3, { group: "formation", z: 0.4 }),
      W(11, "teleport-octopus", 1),
      W(13, "baby-shark", 2, { gap: 1 }),
      W(16, "decoy-puffer", 1),
      W(17, "rage-crab", 3, { gap: 0.5 }),
      W(20, "shield-turtle", 1),
      W(22, "baby-croc", 2, { gap: 0.8 }),
      W(25, "baby-squid", 3, { gap: 0.6 }),
      W(28, "lobster-chief", 1),
    ],
    rare: [{ id: "golden-fish", at: 18, chance: 0.6 }],
    items: { first: 8, every: 11, pool: ["bomb", "rainbow", "thunder", "ice"] },
  },
];

/* ------------------------------------------------------------------
 * 보너스 스테이지 — 하트 없음, 제한 시간 동안 점수만!
 * ---------------------------------------------------------------- */
export const BONUS = [
  {
    id: "water-balloon", name: "물풍선 터뜨리기", en: "BALLOON POP", icon: "drop", emoji: "🎈", desc: "올라오는 풍선을 펑펑!", scene: "fair", time: 30, unlockAfter: 2,
    music: M(132, 67, "major", "bright", "marimba", "island", 201), grades: { S: 9000, A: 6000, B: 3000 },
    rules: [
      { enemy: [["balloon-target", 16], ["balloon-gold", 1]], every: 0.42, n: 1, xs: [-0.85, 0.85], zs: [0.25, 0.7], speedUp: true },
      { enemy: "balloon-target", every: 3.5, n: 3, start: 4, xs: [-0.6, 0.6], zs: [0.3, 0.5] },
    ],
  },
  {
    id: "duck-splash", name: "오리 사격장", en: "DUCK SPLASH", icon: "target", emoji: "🦆", desc: "줄지어 가는 오리를 꽥!", scene: "fair", time: 30, unlockAfter: 5,
    music: M(126, 65, "major", "island", "steel", "island", 211), grades: { S: 9000, A: 6000, B: 3000 },
    rules: [
      { enemy: [["duck-target", 14], ["duck-gold", 1]], every: 0.55, rows: [{ z: 0.24, dir: 1 }, { z: 0.42, dir: -1 }, { z: 0.6, dir: 1 }], speedUp: true },
      { enemy: "golden-duck", cond: "combo", combo: 10, once: true, every: 0.1, rows: [{ z: 0.34, dir: -1 }] },
    ],
  },
  {
    id: "rapid-splash", name: "연사 챌린지", en: "RAPID SPLASH", icon: "sparkle", emoji: "🎯", desc: "튀어나오는 과녁을 빠르게!", scene: "fair", time: 25, unlockAfter: 9,
    music: M(140, 62, "penta", "bright", "pluck", "boss", 221), grades: { S: 10000, A: 7000, B: 4000 },
    rules: [
      { enemy: [["splash-target", 12], ["splash-target-gold", 1]], every: 0.36, n: 1, xs: [-0.85, 0.85], zs: [0.18, 0.75], speedUp: true },
    ],
  },
];
for (const b of BONUS) b.difficulty = 6;

export const MENU_MUSIC = M(98, 60, "penta", "island", "marimba", "island", 5);

/* ------------------------------------------------------------------
 * 바다 도감 (친구 30 + 보스 5 = 35) · 아이템
 * ---------------------------------------------------------------- */
const GROUP_LABEL = { normal: "바다 친구", special: "특수 친구", golden: "황금 친구", hidden: "숨은 친구", boss: "보스" };
const stageName = (n) => (n > 0 && STAGES[n - 1] ? `STAGE ${n} · ${STAGES[n - 1].name}` : "보너스 스테이지");

export const BOOK = [
  ...Object.values(ENEMIES)
    .filter((d) => d.book !== false && ["normal", "special", "golden", "hidden"].includes(d.type))
    .map((d) => ({
      id: d.id, name: d.name, emoji: d.emoji, group: d.type, groupLabel: GROUP_LABEL[d.type],
      stageLabel: d.type === "golden" && d.id === "golden-fish" ? "어느 바다든 가끔!" : stageName(d.stage),
      difficulty: d.difficulty, trait: d.trait, fun: d.fun, tip: d.tip, hint: d.hint,
    })),
  ...Object.values(BOSSES).map((d) => ({
    id: d.id, name: d.name, emoji: d.emoji, group: "boss", groupLabel: GROUP_LABEL.boss, stageLabel: stageName(d.stage),
    difficulty: d.difficulty, trait: d.trait, fun: d.fun, hint: `STAGE ${d.stage} 의 주인. 물리치면 기록돼요!`,
  })),
  ...Object.entries(ITEMS).map(([id, d]) => ({
    id: `item-${id}`, name: d.name, emoji: d.emoji, group: "item", groupLabel: "아이템", stageLabel: "물방울을 맞혀서 얻어요",
    difficulty: 1, trait: d.trait, fun: d.desc, hint: "바다에 떠다니는 아이템 방울을 맞혀 보세요!",
  })),
];

export const TEXTS = {
  title: "바다 물총 대작전",
  friends: "바다 친구들",
  escape: "🚤 긴급 탈출!",
  avatar: "🧒",
};
