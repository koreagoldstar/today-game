/*
 * 자석 대소동 · 스테이지 데이터 (엔진과 따로)
 *  좌표: 화면 960 × 540 · 바닥 윗면 y=500 · 사각형은 [x, y, 너비, 높이] (왼쪽 위 기준)
 *  start(마그 가운데) · exit(출구 칸 · open: 켜져야 할 스위치/목표 id) · walls · objects · switches · goals · doors
 *  conveyors · springs · platforms · lifts · magnets(고정 전자석 · rail 은 천장 띠) · levers · gear(숨은 기어)
 *  energy { max, drain(초당), regen(초당) } · stars { time(초 · ★2), special(★3) } · tips(안내)
 *  각 스테이지의 풀이는 scripts/magnet-solutions.mjs 에 있고 자동 점검이 그대로 두어 본다.
 */
const FLOOR = [0, 500, 960, 40];

export const STAGES = [
  {
    id: 1,
    name: "자석과의 첫 만남",
    goal: "철 공을 노란 칸에 넣고 출구로",
    start: { x: 80, y: 479 },
    walls: [FLOOR, [560, 404, 90, 16]],
    objects: [{ id: "ball", mat: "iron", shape: "ball", x: 400, y: 485 }],
    goals: [{ id: "g1", x: 700, y: 444, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 870, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 605, y: 380 },
    stars: { time: 14, special: { type: "gear" } },
    tips: [
      { id: "move", when: "start", text: "←→ (A·D) 로 걸어요 · 휴대폰은 왼쪽 ◀ ▶" },
      { id: "mag", when: "moved", text: "K 로 자석을 켜요 (🧲 버튼) · 철 공이 끌려와요" },
      { id: "carry", when: "held:ball", text: "공을 데리고 노란 칸까지 걸어가요" },
      { id: "drop", when: "near:g1", text: "칸 위에서 K 로 자석을 끄면 공이 쏙!" },
      { id: "jump", when: "g1", text: "출구가 열렸어요! ↑(W · 스페이스)로 점프도 할 수 있어요" },
    ],
  },
  {
    id: 2,
    name: "극성을 바꿔라",
    goal: "N 블록을 굴속 스위치로 밀고, 선반 위 블록을 끌어와 칸에",
    start: { x: 70, y: 479 },
    pole: "S",
    walls: [
      FLOOR,
      // 굴: 천장이 낮아(40) 마그(42)는 못 들어감
      [250, 444, 330, 16],
      [570, 444, 12, 56],
      // 오른쪽 높은 선반
      [700, 330, 140, 16],
    ],
    objects: [
      { id: "nblock", mat: "magN", shape: "crate", x: 280, y: 486, size: 28 },
      { id: "nball", mat: "magN", shape: "ball", x: 790, y: 314, size: 30 },
    ],
    switches: [{ id: "s1", x: 490, y: 500, w: 78, accepts: "object" }],
    doors: [{ id: "d1", x: 640, y: 350, w: 24, h: 150, open: ["s1"] }],
    goals: [{ id: "g1", x: 690, y: 444, w: 64, h: 56, accepts: ["magN"] }],
    exit: { x: 880, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 410, y: 380 },
    stars: { time: 40, special: { type: "poles", n: 2 } },
    tips: [
      { id: "repel", when: "start", text: "N 블록이 굴속에 있어요. 같은 극끼리는 밀어내요!" },
      { id: "pole", when: "moved", text: "L 로 극을 바꿔요 (N ↔ S 버튼) · 지금 극은 왼쪽 위에" },
      { id: "door", when: "s1", text: "문이 열렸어요! 선반 위 N 공은 다른 극(S)으로 끌어와요" },
    ],
  },
  {
    id: 3,
    name: "금속과 나무",
    goal: "나무 상자로 구덩이를 메우고, 철 공만 칸에",
    start: { x: 70, y: 479 },
    walls: [
      [0, 500, 400, 40],
      [460, 500, 500, 40],
      [400, 554, 60, 20],
      [220, 380, 66, 14],
    ],
    objects: [
      { id: "wood", mat: "wood", shape: "crate", x: 320, y: 473, size: 54 },
      { id: "alloy", mat: "alloy", shape: "ball", x: 560, y: 485 },
      { id: "iron", mat: "iron", shape: "ball", x: 620, y: 485 },
      { id: "rubber", mat: "rubber", shape: "ball", x: 690, y: 485 },
    ],
    goals: [{ id: "g1", x: 760, y: 444, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 880, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 252, y: 356 },
    stars: { time: 35, special: { type: "gear" } },
    tips: [
      { id: "wood", when: "start", text: "나무 · 고무는 자석이 안 통해요. 몸으로 밀어요!" },
      { id: "pit", when: "moved", text: "나무 상자를 구덩이에 밀어 넣으면 다리가 돼요 · 상자 위로 점프도 돼요" },
      { id: "alloy", when: "near:alloy", text: "합금은 조금만 끌려와요 · 노란 칸은 철만 받아요" },
    ],
  },
  {
    id: 4,
    name: "철구 대소동",
    goal: "철 공으로 나무 상자를 밀어 떨어뜨려 '나무만' 스위치를 눌러요",
    start: { x: 60, y: 479 },
    walls: [
      FLOOR,
      [100, 300, 160, 16], // 높은 선반 A (철 공)
      [280, 370, 200, 16], // 가운데 선반 B (나무 상자) — 마그는 못 올라감
      [300, 440, 70, 60], // 받침 C (B 아래)
      [572, 470, 14, 30], // 턱 (떨어진 상자가 멈춤)
    ],
    objects: [
      { id: "ball", mat: "iron", shape: "ball", x: 232, y: 285 },
      { id: "crate", mat: "wood", shape: "crate", x: 466, y: 346, size: 48, m: 0.9 },
    ],
    switches: [{ id: "s1", x: 482, y: 500, w: 84, accepts: ["wood"] }],
    doors: [{ id: "d1", x: 700, y: 300, w: 26, h: 200, open: ["s1"] }],
    exit: { x: 860, y: 420, w: 62, h: 80, open: ["s1"] },
    gear: { x: 540, y: 332 },
    stars: { time: 30, special: { type: "gear" } },
    tips: [
      { id: "up", when: "start", text: "높은 선반의 철 공을 받침 위에서 끌어내려요" },
      { id: "roll", when: "ball.y>330", text: "공을 가운데 선반 위로 굴려 나무 상자에 쾅!" },
      { id: "sw", when: "s1", text: "상자가 스위치를 눌렀어요! 상자를 밟고 점프하면 기어가 있어요" },
    ],
  },
  {
    id: 5,
    name: "자석 발판",
    goal: "무거운 철 상자를 끌어와 발판 삼아 높은 출구로",
    start: { x: 320, y: 479 },
    walls: [
      FLOOR,
      [0, 360, 180, 140], // 왼쪽 높은 곳 (출구)
      [494, 300, 70, 200], // 오른쪽 벽 (상자 뒤로 못 감)
    ],
    objects: [{ id: "crate", mat: "iron", shape: "crate", x: 466, y: 476, size: 48, heavy: true }],
    exit: { x: 40, y: 280, w: 62, h: 80, open: [] },
    gear: { x: 468, y: 316 },
    stars: { time: 25, special: { type: "uses", n: 1 } },
    tips: [
      { id: "high", when: "start", text: "출구가 너무 높아요. 철 상자를 발판으로 써 볼까요?" },
      { id: "heavy", when: "moved", text: "무거운 상자는 들 수 없지만, 가까이서 자석을 켜고 걸으면 끌려와요" },
    ],
  },
  {
    id: 6,
    name: "컨베이어 혼란",
    goal: "철 공을 오른쪽 높은 칸에 넣고, 왼쪽 출구로 돌아와요",
    start: { x: 120, y: 479 },
    walls: [
      [0, 500, 200, 40],
      [200, 476, 12, 24], // 컨베이어 왼쪽 끝 턱 (공이 여기서 멈춤)
      [760, 410, 200, 130], // 오른쪽 높은 단
    ],
    conveyors: [{ id: "c1", x: 200, y: 500, w: 560, h: 22, speed: -150, rev: "l1" }],
    objects: [{ id: "ball", mat: "iron", shape: "ball", x: 620, y: 485 }],
    levers: [{ id: "l1", x: 800, y: 388 }],
    goals: [{ id: "g1", x: 870, y: 354, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 20, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 480, y: 382 },
    stars: { time: 32, special: { type: "gear" } },
    tips: [
      { id: "belt", when: "start", text: "컨베이어가 철 공을 왼쪽으로 실어 가요. 거꾸로 걷기는 힘들어요!" },
      { id: "lever", when: "moved", text: "오른쪽 레버(E · ✋)로 방향을 바꾸면 공이 이쪽으로 와요" },
      { id: "back", when: "g1", text: "출구는 왼쪽! 컨베이어 방향을 다시 바꾸면 빨라요" },
    ],
  },
  {
    id: 7,
    name: "스프링 실험",
    goal: "스프링을 타고 올라가, 통통 튀는 철 공을 자석으로 잡아 높은 칸에",
    start: { x: 60, y: 479 },
    walls: [
      [0, 500, 150, 40],
      [150, 514, 60, 30],
      [210, 500, 170, 40],
      [380, 514, 60, 30],
      [440, 500, 520, 40],
      [230, 300, 140, 16], // 가운데 단
      [450, 300, 350, 16], // 높은 단
    ],
    springs: [
      { id: "sp1", x: 150, y: 500, w: 60, power: 1000 },
      { id: "sp2", x: 380, y: 500, w: 60, power: 1000 },
    ],
    objects: [{ id: "ball", mat: "iron", shape: "ball", x: 410, y: 470 }],
    goals: [{ id: "g1", x: 630, y: 244, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 720, y: 220, w: 62, h: 80, open: ["g1"] },
    gear: { x: 300, y: 186 },
    stars: { time: 20, special: { type: "gear" } },
    tips: [
      { id: "spring", when: "start", text: "노란 스프링을 밟으면 높이 튀어 올라요! 철 공은 오른쪽 스프링에서 통통" },
      { id: "catch", when: "robot.y<300", text: "공이 높이 떴을 때 자석을 켜서 잡고, 오른쪽 단으로 점프!" },
    ],
  },
  {
    id: 8,
    name: "두 개의 자석",
    goal: "N 블록을 굴 끝 칸까지 · 가운데 N 자석을 끄고, 끝의 S 자석을 켜요",
    start: { x: 80, y: 479 },
    pole: "S",
    walls: [
      FLOOR,
      [300, 444, 400, 16], // 굴 지붕
      [700, 444, 12, 56], // 굴 끝
    ],
    objects: [{ id: "nblock", mat: "magN", shape: "crate", x: 330, y: 486, size: 28 }],
    magnets: [
      { id: "mB", x: 470, y: 404, w: 40, h: 40, pole: "N", range: 160, strength: 4600, on: "!l2" }, // 가운데: 같은 극이라 밀어냄
      { id: "mA", x: 712, y: 440, w: 40, h: 60, pole: "S", range: 190, strength: 4400, on: "l1" }, // 끝: 다른 극이라 끌어당김
    ],
    levers: [
      { id: "l2", x: 610, y: 422 },
      { id: "l1", x: 800, y: 478 },
    ],
    goals: [{ id: "g1", x: 630, y: 460, w: 66, h: 40, accepts: ["magN"] }],
    exit: { x: 880, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 490, y: 340 },
    stars: { time: 32, special: { type: "poles", n: 1 } },
    tips: [
      { id: "two", when: "start", text: "굴 위 가운데 N 자석이 N 블록을 밀어내요. 지붕 위 레버로 꺼요" },
      { id: "push", when: "l2", text: "이제 마그의 극을 N 으로 바꿔 블록을 굴 안쪽으로 밀어요" },
      { id: "pull", when: "nblock.x>520", text: "오른쪽 레버로 끝의 S 자석을 켜면 블록이 끌려가요" },
    ],
  },
  {
    id: 9,
    name: "움직이는 출구",
    goal: "철 상자로 스위치를 누르고, 움직이는 발판을 타고, 오르내리는 출구로",
    start: { x: 60, y: 479 },
    walls: [
      [0, 500, 520, 40],
      [700, 500, 260, 40],
    ],
    objects: [{ id: "crate", mat: "iron", shape: "crate", x: 180, y: 476, size: 48, heavy: true }],
    switches: [{ id: "s1", x: 330, y: 500, w: 80, accepts: "object" }],
    platforms: [
      { id: "p2", x: 520, y: 470, w: 90, h: 16, path: [[520, 470], [610, 470]], speed: 70, pause: 0.8 },
      { id: "p1", x: 790, y: 470, w: 110, h: 16, path: [[790, 470], [790, 230]], speed: 80, pause: 1.4 },
    ],
    exit: { x: 0, y: 0, w: 62, h: 80, open: ["s1"], ride: "p1" },
    gear: { x: 565, y: 380 },
    stars: { time: 30, special: { type: "uses", n: 1 } },
    tips: [
      { id: "lock", when: "start", text: "출구는 스위치가 눌려 있는 동안만 열려요. 철 상자를 끌어다 올려요" },
      { id: "ride", when: "s1", text: "움직이는 발판을 타고 구덩이를 건너요. 출구는 오르내리는 발판 위에!" },
    ],
  },
  {
    id: 10,
    name: "에너지 위기",
    goal: "에너지를 아껴 철 공 두 개를 칸에 · 몸으로 밀 수 있는 건 밀어요",
    start: { x: 110, y: 479 },
    energy: { max: 100, drain: 26, regen: 0 },
    walls: [
      FLOOR,
      [600, 440, 360, 60], // 오른쪽 단
      [180, 300, 120, 16], // 높은 선반
    ],
    objects: [
      { id: "ballA", mat: "iron", shape: "ball", x: 420, y: 485 },
      { id: "ballB", mat: "iron", shape: "ball", x: 215, y: 285 },
    ],
    goals: [
      { id: "g1", x: 780, y: 384, w: 64, h: 56, accepts: ["iron"] },
      { id: "g2", x: 2, y: 444, w: 68, h: 56, accepts: ["iron"] },
    ],
    exit: { x: 880, y: 360, w: 62, h: 80, open: ["g1", "g2"] },
    gear: { x: 690, y: 330 },
    stars: { time: 35, special: { type: "energy", n: 35 } },
    tips: [
      { id: "energy", when: "start", text: "⚡ 에너지는 다시 차지 않아요! 자석은 꼭 필요할 때만" },
      { id: "push", when: "moved", text: "철 공은 몸으로 밀어서 굴릴 수도 있어요" },
      { id: "low", when: "energy<35", text: "에너지가 얼마 안 남았어요!" },
    ],
  },
  {
    id: 11,
    name: "공장 연쇄 사고",
    goal: "레버로 컨베이어를 돌려 연쇄를 일으키고, 철 공을 칸에 · 무거운 상자로 문을 열어요",
    start: { x: 60, y: 479 },
    walls: [
      FLOOR,
      [80, 260, 40, 16], // 위 컨베이어 왼쪽 받침
      [440, 380, 140, 16], // 가운데 단 (스위치)
      [740, 250, 16, 16], // 오른쪽 높은 창고 왼쪽 끝 (나머지는 컨베이어)
      [740, 266, 16, 60], // 창고 아래 턱
    ],
    conveyors: [
      { id: "c1", x: 120, y: 260, w: 300, h: 18, speed: 120, on: "l1" },
      { id: "c2", x: 756, y: 250, w: 204, h: 18, speed: -110, on: "s1" },
    ],
    objects: [
      { id: "box", mat: "wood", shape: "crate", x: 160, y: 236, size: 46 },
      { id: "ball", mat: "iron", shape: "ball", x: 900, y: 235 },
      { id: "heavy", mat: "iron", shape: "crate", x: 640, y: 476, size: 48, heavy: true },
    ],
    switches: [
      { id: "s1", x: 470, y: 380, w: 90, accepts: "object" },
      { id: "s2", x: 440, y: 500, w: 80, accepts: "object" },
    ],
    doors: [{ id: "d1", x: 740, y: 326, w: 18, h: 174, open: ["s2"] }],
    levers: [{ id: "l1", x: 140, y: 478 }],
    goals: [{ id: "g1", x: 820, y: 444, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 890, y: 420, w: 62, h: 80, open: ["g1", "s2"] },
    gear: { x: 640, y: 300 },
    stars: { time: 40, special: { type: "uses", n: 2 } },
    tips: [
      { id: "plan", when: "start", text: "레버 → 컨베이어 → 상자가 스위치로 → 오른쪽 창고 컨베이어가 철 공을 내보내요" },
      { id: "door", when: "s1", text: "문은 무거운 철 상자를 가운데 바닥 스위치에 끌어다 놓으면 열려요" },
      { id: "ball", when: "s2", text: "굴러온 철 공을 자석으로 붙잡아 문 너머 칸에 넣어요" },
    ],
  },
  {
    id: 12,
    name: "거대 자석 장치",
    goal: "코어 세 개를 채우면 거대 자석이 깨어나 리프트를 들어 올려요",
    start: { x: 60, y: 479 },
    pole: "N",
    finale: true,
    walls: [
      [0, 500, 540, 40],
      [540, 514, 60, 26], // 스프링 밑
      [600, 500, 360, 40],
      [380, 444, 100, 16], // 굴 지붕 (코어 B 굴 · 마그는 못 들어감)
      [480, 444, 12, 56],
      [650, 380, 110, 16], // 코어 A 단
      [690, 180, 170, 16], // 맨 위 출구 단
    ],
    springs: [{ id: "sp", x: 540, y: 500, w: 60, power: 960 }],
    objects: [
      { id: "ball", mat: "iron", shape: "ball", x: 612, y: 485 },
      { id: "sblock", mat: "magS", shape: "crate", x: 250, y: 486, size: 28 },
      { id: "heavy", mat: "iron", shape: "crate", x: 720, y: 476, size: 48, heavy: true },
    ],
    switches: [{ id: "sC", x: 772, y: 500, w: 90, accepts: "object" }],
    goals: [
      { id: "gA", x: 674, y: 324, w: 64, h: 56, accepts: ["iron"] },
      { id: "gB", x: 412, y: 460, w: 66, h: 40, accepts: ["magS"] },
    ],
    magnets: [{ id: "giant", x: 866, y: 24, w: 90, h: 56, pole: "N", range: 110, strength: 2600, on: "gA&gB&sC" }],
    lifts: [{ id: "lift", x: 870, y: 470, w: 80, h: 16, y2: 180, speed: 120, on: "gA&gB&sC" }],
    exit: { x: 720, y: 100, w: 62, h: 80, open: ["gA", "gB", "sC"] },
    gear: { x: 440, y: 350 },
    stars: { time: 60, special: { type: "gear" } },
    tips: [
      { id: "cores", when: "start", text: "코어 세 개: 철 공 · S 블록 · 무거운 상자! 다 채우면 거대 자석이 깨어나요" },
      { id: "b", when: "moved", text: "S 블록은 같은 극(S)으로 밀어 굴 끝 칸에 넣어요" },
      { id: "a", when: "gB", text: "철 공을 붙잡고 스프링을 밟아 높은 단의 칸에 넣어요" },
      { id: "c", when: "gA&gB", text: "무거운 상자를 오른쪽 바닥 스위치에 끌어다 놓아요" },
      { id: "go", when: "gA&gB&sC", text: "거대 자석 가동! 오른쪽 리프트를 타고 맨 위 출구로" },
    ],
  },
];

/*
 * 오늘의 자석 실험 모음: 짧은 판 · 서울 날짜로 하나를 골라 그날은 모두 같은 판 (game.js dailyFor)
 *  기록은 깬 시간 (짧을수록 좋음)
 */
export const DAILY = [
  {
    id: "d1",
    daily: true,
    name: "공 넘기기",
    goal: "철 공을 낮은 벽 너머 칸에 넣어요",
    start: { x: 80, y: 479 },
    walls: [FLOOR, [430, 456, 24, 44]],
    objects: [{ id: "ball", mat: "iron", shape: "ball", x: 300, y: 485 }],
    goals: [{ id: "g1", x: 640, y: 444, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 860, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 560, y: 356 },
    stars: { time: 20, special: { type: "gear" } },
    tips: [{ id: "over", when: "start", text: "공을 자석으로 붙잡고 점프해서 벽을 넘겨요" }],
  },
  {
    id: "d2",
    daily: true,
    name: "밀어내기 굴",
    goal: "S 블록을 굴속 스위치로 밀어 문을 열어요",
    start: { x: 60, y: 479 },
    pole: "N",
    walls: [FLOOR, [380, 444, 100, 16], [480, 444, 12, 56]],
    objects: [{ id: "sblock", mat: "magS", shape: "crate", x: 250, y: 486, size: 28 }],
    switches: [{ id: "s1", x: 412, y: 500, w: 66, accepts: "object" }],
    doors: [{ id: "d1", x: 640, y: 300, w: 24, h: 200, open: ["s1"] }],
    exit: { x: 860, y: 420, w: 62, h: 80, open: ["s1"] },
    gear: { x: 440, y: 350 },
    stars: { time: 20, special: { type: "poles", n: 1 } },
    tips: [{ id: "pole", when: "start", text: "같은 극끼리 밀어내요 · L(N↔S)로 극을 맞춰요" }],
  },
  {
    id: "d3",
    daily: true,
    name: "나무는 몸으로",
    goal: "나무 상자를 밀어 스위치에 · 문 뒤 철 공은 칸에",
    start: { x: 80, y: 479 },
    walls: [FLOOR],
    objects: [
      { id: "box", mat: "wood", shape: "crate", x: 260, y: 477, size: 46 },
      { id: "ball", mat: "iron", shape: "ball", x: 800, y: 485 },
    ],
    switches: [{ id: "s1", x: 440, y: 500, w: 80, accepts: ["wood"] }],
    doors: [{ id: "d1", x: 620, y: 300, w: 24, h: 200, open: ["s1"] }],
    goals: [{ id: "g1", x: 680, y: 444, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 870, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 500, y: 325 },
    stars: { time: 25, special: { type: "gear" } },
    tips: [{ id: "wood", when: "start", text: "나무는 자석에 안 붙어요 · 몸으로 밀어요" }],
  },
  {
    id: "d4",
    daily: true,
    name: "거꾸로 컨베이어",
    goal: "레버로 컨베이어를 돌려 철 공을 칸까지 실어 보내요",
    start: { x: 80, y: 479 },
    walls: [
      [0, 500, 200, 40],
      [700, 500, 260, 40],
    ],
    conveyors: [{ id: "c1", x: 200, y: 500, w: 500, h: 22, speed: -140, rev: "l1" }],
    objects: [{ id: "ball", mat: "iron", shape: "ball", x: 600, y: 485 }],
    levers: [{ id: "l1", x: 130, y: 478 }],
    goals: [{ id: "g1", x: 760, y: 444, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 880, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 450, y: 370 },
    stars: { time: 18, special: { type: "uses", n: 0 } },
    tips: [{ id: "lever", when: "start", text: "레버(E · ✋)로 컨베이어 방향을 바꿔요 · 자석 없이도 돼요!" }],
  },
  {
    id: "d5",
    daily: true,
    name: "스프링 배달",
    goal: "철 공을 붙잡고 스프링을 밟아 높은 칸에 넣어요",
    start: { x: 420, y: 479 },
    walls: [
      [0, 500, 540, 40],
      [540, 514, 60, 26],
      [600, 500, 360, 40],
      [650, 380, 110, 16],
    ],
    springs: [{ id: "sp", x: 540, y: 500, w: 60, power: 960 }],
    objects: [{ id: "ball", mat: "iron", shape: "ball", x: 612, y: 485 }],
    goals: [{ id: "g1", x: 674, y: 324, w: 64, h: 56, accepts: ["iron"] }],
    exit: { x: 860, y: 420, w: 62, h: 80, open: ["g1"] },
    gear: { x: 672, y: 250 },
    stars: { time: 18, special: { type: "gear" } },
    tips: [{ id: "spring", when: "start", text: "공을 붙잡은 채 스프링을 밟으면 함께 날아올라요" }],
  },
  {
    id: "d6",
    daily: true,
    name: "에너지 두 공",
    goal: "에너지를 아껴 철 공 두 개를 칸에 넣어요",
    start: { x: 80, y: 479 },
    energy: { max: 100, drain: 30, regen: 0 },
    walls: [FLOOR],
    objects: [
      { id: "ballA", mat: "iron", shape: "ball", x: 260, y: 485 },
      { id: "ballB", mat: "iron", shape: "ball", x: 680, y: 485 },
    ],
    goals: [
      { id: "gA", x: 380, y: 444, w: 64, h: 56, accepts: ["iron"] },
      { id: "gB", x: 780, y: 444, w: 64, h: 56, accepts: ["iron"] },
    ],
    exit: { x: 880, y: 420, w: 62, h: 80, open: ["gA", "gB"] },
    gear: { x: 560, y: 370 },
    stars: { time: 22, special: { type: "energy", n: 40 } },
    tips: [{ id: "energy", when: "start", text: "자석을 켜 둔 동안 에너지가 줄어요 · 다 옮기면 바로 꺼요" }],
  },
  {
    id: "d7",
    daily: true,
    name: "무거운 문지기",
    goal: "무거운 철 상자를 스위치에 끌어다 문을 열어요",
    start: { x: 80, y: 479 },
    walls: [FLOOR],
    objects: [{ id: "heavy", mat: "iron", shape: "crate", x: 300, y: 476, size: 48, heavy: true }],
    switches: [{ id: "s1", x: 520, y: 500, w: 90, accepts: ["iron"] }],
    doors: [{ id: "d1", x: 700, y: 300, w: 24, h: 200, open: ["s1"] }],
    exit: { x: 860, y: 420, w: 62, h: 80, open: ["s1"] },
    gear: { x: 565, y: 330 },
    stars: { time: 22, special: { type: "gear" } },
    tips: [{ id: "heavy", when: "start", text: "무거운 상자는 자석으로 끌면 천천히 따라와요" }],
  },
];
