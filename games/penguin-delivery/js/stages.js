/*
 * 펭귄 택배 대작전 — 5개 월드 45개 스테이지
 *  각 스테이지는 새로운 놀이 하나를 소개하거나 앞에서 배운 것을 새롭게 섞는다.
 */
import { Builder } from "./course.js";

export const WORLDS = [
  { key: "village", name: "눈꽃 마을", sub: "미끄러운 첫 배달", banks: true, sea: false, need: 0 },
  { key: "canyon", name: "얼음 협곡", sub: "낭떠러지와 바람", banks: false, sea: false, need: 12 },
  { key: "sea", name: "북극 바다", sub: "둥둥 떠다니는 빙하", banks: false, sea: true, need: 28 },
  { key: "peaks", name: "눈보라 산맥", sub: "속도와 눈사태", banks: false, sea: false, need: 46 },
  { key: "aurora", name: "오로라 왕국", sub: "사라지는 얼음길", banks: false, sea: false, need: 64 },
];

/** 먼저 만든 구역의 끝을 뒤쪽 조각까지 늘림 */
const extend = (o, p, m) => {
  const a = p.at(m);
  o.s1 = a.s;
  if (o.i1 !== undefined) o.i1 = a.i;
};
const lastObj = (b) => b.objs[b.objs.length - 1];
const lastZone = (b) => b.zones[b.zones.length - 1];

const WORLD_STAGES = [
  /* ==================== 1. 눈꽃 마을 ==================== */
  [
    {
      name: "첫 배달",
      goal: "얼음길을 지나 첫 택배를 배달해요",
      packs: ["normal"],
      extra: 4,
      build(b) {
        b.road(9, { w: 9 }, (p) => {
          p.tip(0.5, "움직여서 얼음길로 가 볼까요?", "move");
          p.fish(4, 0, 3, 1.4);
        });
        b.road(9, { w: 9, surf: "ice", dy: -0.9 }, (p) => {
          p.tip(0.5, "앗, 얼음이에요! 쭈욱 미끄러워요", "ice");
          p.fish(3, -2.4, 3, 1.8);
          p.fish(3, 2.4, 3, 1.8);
        });
        b.road(20, { w: 9, surf: "ice", dy: -3.6 }, (p) => {
          p.bump(1.5, { force: true });
          p.fish(7, 0, 5, 2.4);
        });
        b.road(8, { w: 9 }, (p) => p.check(1));
        b.road(14, { w: 8, turn: 26 }, (p) => {
          p.tip(3, "폴짝! 점프로 상자를 넘어요", "jump");
          for (const lat of [-3.2, -1.6, 0, 1.6, 3.2]) p.crate(9, lat);
          p.arc(7, 0, 5, 1, 1.4);
        });
        b.road(13, { w: 8, turn: -26 }, (p) => {
          p.star(6, 2.4);
          p.fish(2, -1.5, 4, 1.8);
        });
        b.goalHere();
      },
    },
    {
      name: "미끄러운 골목",
      goal: "얼음 위에서는 미리 방향을 틀어요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 8 });
        b.road(20, { w: 7, surf: "ice", turn: 36 }, (p) => {
          p.tip(1, "얼음에선 미리미리 방향을 틀어요", "ice");
          p.snowman(9, 1.6);
          p.snowman(14, -1.7);
          p.fish(4, 0, 7, 2);
        });
        b.road(8, { w: 7 }, (p) => {
          p.check(1);
          p.fish(2, -2, 3, 1.4);
        });
        b.road(22, { w: 7, surf: "ice", turn: -58 }, (p) => {
          p.snowman(6, -1.5);
          p.snowman(11, 1.7);
          p.snowman(16, -0.4);
          p.star(19, 2.2);
        });
        b.road(8, { w: 7 });
        b.road(16, { w: 7, surf: "ice", turn: 28, dy: -1.5 }, (p) => {
          p.fish(3, 1.5, 6, 2);
          p.item("shield", 8, -2);
        });
        b.goalHere();
      },
    },
    {
      name: "언덕 넘어 우체국",
      goal: "내리막에서 속도를 조심해요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 8 });
        b.road(15, { w: 8, dy: 3 }, (p) => {
          p.tip(4, "오르막은 천천히, 내리막은 슝!", "");
          p.fish(3, 0, 6, 2);
        });
        b.road(16, { w: 8, dy: -3, surf: "ice" }, (p) => {
          p.bump(11, { limit: 8.4 });
          p.tip(7, "둔턱을 빠르게 넘으면 택배가 튀어요", "");
          p.fish(4, -2, 3, 1.6);
        });
        b.road(8, { w: 8 }, (p) => p.check(1));
        b.road(18, { w: 8, dy: 4, turn: 30 }, (p) => {
          p.fish(4, 2, 5, 2);
          p.star(14, -2.6);
        });
        b.road(20, { w: 8, dy: -4.5, surf: "ice", turn: -24 }, (p) => {
          p.bump(9, { limit: 8.6 });
          p.bump(16, { limit: 8.6 });
          p.fish(3, 0, 6, 2);
        });
        b.road(6, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "눈덩이 조심",
      goal: "굴러오는 눈덩이를 피해 올라가요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 9 });
        b.road(32, { w: 9, dy: 5 }, (p) => {
          p.tip(1, "눈덩이가 굴러와요! 옆으로 피해요", "");
          p.snowballs(1, 31, { lat: -1.4, r: 1.15, speed: 5, period: 3.6 });
          p.fish(4, 2.8, 8, 3);
          p.fish(6, -3.2, 6, 3);
        });
        b.road(8, { w: 9 }, (p) => {
          p.check(2);
          p.item("shield", 5, 0);
        });
        b.road(28, { w: 8, dy: 4.5, turn: 34 }, (p) => {
          p.snowballs(1, 27, { lat: 1.1, wander: 1.8, r: 1.1, speed: 5.4, period: 3 });
          p.star(14, -2.8);
          p.fish(3, 0, 6, 3.6);
        });
        b.road(10, { w: 9, dy: -0.5, surf: "ice" }, (p) => p.fish(2, 0, 4, 1.6));
        b.goalHere();
      },
    },
    {
      name: "나무상자 창고",
      goal: "움직이는 상자를 피하고 배로 미끄러져요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 9 });
        b.road(22, { w: 9 }, (p) => {
          p.tip(0.5, "상자는 뛰어넘거나 옆으로 피해요", "jump");
          p.crate(6, -2.2);
          p.crate(6, 2.2);
          p.crate(12, 0, { amp: 3.3, period: 4 });
          p.crate(18, 0, { amp: 3.3, period: 3.2, phase: 2 });
          p.fish(4, 0, 5, 3.4);
        });
        b.road(16, { w: 8, turn: -32 }, (p) => {
          p.tip(1, "대시! 배로 슝 미끄러지면 빨라요", "dash");
          p.check(1);
          p.fish(4, 0, 8, 1.3);
        });
        b.road(24, { w: 9, surf: "ice", turn: 30 }, (p) => {
          for (const m of [6, 11, 16]) p.crate(m, m === 11 ? -2.4 : 2.4);
          p.crate(21, 0, { amp: 3, period: 3.6, phase: 1 });
          p.star(11, 2.8);
          p.item("boost", 3, -2.6);
        });
        b.road(6, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "얼음 연못",
      goal: "얼음 구멍을 피해 넓은 연못을 건너요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 10 });
        b.road(34, { w: 15, surf: "ice" }, (p) => {
          p.tip(0.5, "구멍에 빠지면 풍덩! 조심조심", "ice");
          p.hole(7, -2.6, 1.3);
          p.hole(9.5, 3.2, 1.3);
          p.hole(15, 0, 1.6);
          p.hole(20, -4, 1.4);
          p.hole(23, 3.4, 1.5);
          p.hole(29, -0.8, 1.4);
          p.fish(11, -4.4, 6, 1.2);
          p.fish(11, 4.8, 3, 1.3);
          p.star(15, 0, 0.2);
          p.check(17);
        });
        b.road(8, { w: 10 }, (p) => p.fish(1, 0, 4, 1.4));
        b.road(22, { w: 12, surf: "ice", turn: 40 }, (p) => {
          p.seal(11, 0, { amp: 3.6, period: 5 });
          p.tip(4, "바다표범이 택배를 물어가면 쫓아가요!", "");
          p.fish(4, 3, 7, 2.4);
        });
        b.goalHere();
      },
    },
    {
      name: "무거운 택배",
      goal: "무거운 택배로 얼음 언덕을 올라가요",
      packs: ["heavy"],
      extra: 6,
      build(b) {
        b.road(9, { w: 9 }, (p) => {
          p.tip(1, "으쌰! 무거워서 느려요. 그래도 잘 안 흔들려요", "");
          p.fish(3, 0, 4, 1.3);
        });
        b.road(14, { w: 9, surf: "ice", dy: -1.2 }, (p) => p.tip(1, "내리막으로 힘을 모아요", "ice"));
        b.road(18, { w: 9, surf: "ice", dy: 2.6, patch: [0, 18, 2, 4.5, "snow"] }, (p) => {
          p.tip(5, "눈이 쌓인 쪽은 미끄럽지 않아요", "");
          p.fish(4, 3.2, 6, 2.2);
        });
        b.road(8, { w: 9 }, (p) => p.check(1));
        b.road(20, { w: 8, dy: 3.2, surf: "ice", turn: 28, patch: [0, 20, -4, -1.8, "snow"] }, (p) => {
          p.snowballs(1, 19, { lat: 1.3, r: 1, speed: 4.4, period: 4 });
          p.star(10, -3);
          p.fish(3, -2.8, 6, 2.6);
        });
        b.road(8, { w: 9 });
        b.goalHere();
      },
    },
    {
      name: "통통 광장",
      goal: "튀어 오르는 발판으로 높은 곳에 올라가요",
      packs: ["normal"],
      build(b) {
        b.road(9, { w: 9 });
        b.road(9, { w: 9 }, (p) => {
          p.tip(0, "튕김 발판을 밟으면 높이 올라가요", "");
          p.spring(7, 0, 13.5);
          p.fish(2, 0, 3, 1.4);
        });
        b.gap(2.4, { dy: 3 });
        b.road(16, { w: 9 }, (p) => {
          p.check(2);
          p.snowman(7, -2);
          p.snowman(7, 2);
          p.snowman(11, 0);
          p.fish(4, 0, 4, 1.2);
          p.star(14, -3);
        });
        b.road(10, { w: 8, dy: -1 }, (p) => p.spring(8, 0, 13.5));
        b.gap(2.6, { dy: 2.6 });
        b.road(14, { w: 9, turn: 30, surf: "ice" }, (p) => {
          p.fish(3, 2, 5, 2);
          p.crate(9, -2);
          p.crate(9, 2);
          p.check(1);
        });
        b.road(8, { w: 9, dy: -3 });
        b.goalHere();
      },
    },
    {
      name: "택배 도둑 여우",
      goal: "여우가 훔쳐 가면 끝까지 쫓아가요!",
      packs: ["normal", "light"],
      extra: 8,
      build(b) {
        b.road(9, { w: 9 }, (p) => {
          p.tip(1, "오늘은 택배가 두 개! 더 많이 흔들려요", "");
          p.fish(4, 0, 3, 1.4);
        });
        b.road(26, { w: 9, turn: 22, surf: "ice" }, (p) => {
          p.fox(13, 3.2, { trig: 8 });
          p.tip(8, "여우다! 뺏기면 쫓아가서 부딪혀요", "");
          p.fish(5, -2, 8, 2.2);
        });
        b.road(8, { w: 8 }, (p) => p.check(1));
        b.road(24, { w: 8, turn: -40 }, (p) => {
          p.crate(5, -2);
          p.crate(5, 2);
          p.snowman(12, 0);
          p.fox(16, -3, { trig: 7.5 });
          p.star(20, 2.8);
          p.fish(2, 0, 4, 1.2);
        });
        b.road(18, { w: 9, surf: "ice", dy: -2.5, turn: 18 }, (p) => {
          p.bump(10, { limit: 8.5 });
          p.fish(3, 2, 6, 2);
          p.item("bubble", 6, -2.5);
        });
        b.road(6, { w: 8 });
        b.goalHere();
      },
    },
  ],
  /* ==================== 2. 얼음 협곡 ==================== */
  [
    {
      name: "좁은 얼음길",
      goal: "난간 없는 길! 천천히 방향을 잡아요",
      packs: ["normal"],
      build(b) {
        b.road(9, { w: 8 }, (p) => p.tip(1, "이제 난간이 없어요. 떨어져도 다시 시작할 수 있어요", ""));
        b.road(24, { w: 6, w2: 4.6, surf: "ice", turn: 28 }, (p) => {
          p.fish(4, 0, 9, 2.2);
        });
        b.road(8, { w: 7 }, (p) => {
          p.check(1);
          p.star(5, 2.4);
        });
        b.road(26, { w: 4.8, surf: "ice", turn: -50, dy: -1.5 }, (p) => {
          p.fish(3, 0, 10, 2.2);
          p.item("shield", 13, 0);
        });
        b.road(8, { w: 7 });
        b.road(20, { w: 4.4, surf: "ice", turn: 34, dy: 1 }, (p) => p.fish(2, 0, 8, 2.2));
        b.goalHere();
      },
    },
    {
      name: "무너지는 얼음 다리",
      goal: "다리는 금방 무너져요. 멈추지 말아요!",
      packs: ["normal"],
      build(b) {
        b.road(11, { w: 8 }, (p) => {
          p.tip(5, "밟으면 무너져요! 멈추지 말고 달려요", "");
          p.fish(4, 0, 3, 1.4);
        });
        b.bridge(13, { w: 3.6, delay: 0.6 });
        b.road(9, { w: 7 }, (p) => {
          p.check(2);
          p.fish(3, 0, 3, 1.4);
        });
        b.road(9, { w: 5, turn: 30, surf: "ice" });
        b.bridge(16, { w: 3.2, delay: 0.55 });
        b.road(8, { w: 7 }, (p) => {
          p.check(2);
          p.star(5, -2.4);
        });
        b.road(7, { w: 5, turn: -22 });
        b.bridge(10, { w: 3, delay: 0.5, dy: -1 });
        b.gap(2.2);
        b.bridge(10, { w: 3, delay: 0.5, dy: -1 });
        b.road(5, { w: 7 });
        b.goalHere();
      },
    },
    {
      name: "움직이는 얼음판",
      goal: "얼음판이 다가올 때를 기다려요",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 8 }, (p) => {
          p.tip(4, "기다렸다가 가까이 올 때 폴짝!", "jump");
          p.fish(4, 0, 3, 1.4);
        });
        b.hop(5.2, { kind: "mover", w: 4.6, depth: 4, amp: 2.6, period: 4.6, surf: "snow" });
        b.gap(5.2);
        b.road(7, { w: 7 }, (p) => {
          p.check(1.5);
          p.fish(3, 0, 2, 1.4);
        });
        b.hop(5, { kind: "mover", w: 4.4, depth: 4, amp: 3, period: 4.2, surf: "ice" });
        b.hop(6.6, { kind: "mover", w: 4.4, depth: 4, amp: 3, period: 4.2, phase: 2.2, surf: "ice", items: ["star"] });
        b.gap(5);
        b.road(7, { w: 7, turn: 30 }, (p) => {
          p.check(1.5);
          p.item("shield", 4, 2);
        });
        b.hop(5.6, { kind: "mover", w: 5, depth: 3.6, fwd: 2.2, amp: 0, period: 4.8, surf: "snow" });
        b.hop(7.2, { kind: "mover", w: 4.4, depth: 4, amp: 3.4, period: 5, surf: "ice" });
        b.gap(5);
        b.goalHere();
      },
    },
    {
      name: "얼음 기둥 숲",
      goal: "기둥 사이를 빠져나가요. 도는 기둥은 뛰어넘어요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 8 });
        b.road(24, { w: 7, surf: "ice", turn: 20 }, (p) => {
          p.tip(0, "얼음 기둥에 부딪히면 택배가 흔들려요", "");
          for (const [m, lat] of [[5, -1.8], [9, 1.8], [13, -1.5], [17, 1.6], [21, -1.6]]) p.pillar(m, lat, 0.72);
          p.fish(4, 0.6, 9, 2);
        });
        b.road(10, { w: 8 }, (p) => {
          p.check(1);
          p.tip(3, "도는 팔은 타이밍 맞춰 폴짝!", "jump");
        });
        b.road(13, { w: 8 }, (p) => {
          p.rotor(6.5, 0, { len: 3.9, speed: 1.5, arms: 2 });
          p.arc(4.5, -2.6, 4, 1.3, 1);
        });
        b.road(16, { w: 7, turn: -32, surf: "ice" }, (p) => {
          p.check(0.5);
          p.pillar(5, 1.5, 0.7);
          p.rotor(10, -0.6, { len: 2.8, speed: -1.8, arms: 2 });
          p.star(14, 2.4);
        });
        b.road(13, { w: 8 }, (p) => p.rotor(6.5, 0, { len: 3.9, speed: 1.7, arms: 3 }));
        b.goalHere();
      },
    },
    {
      name: "협곡의 강풍",
      goal: "바람이 멈출 때 움직이고, 불면 버텨요",
      packs: ["light"],
      extra: 6,
      build(b) {
        b.road(10, { w: 8 }, (p) => {
          p.tip(2, "가벼운 택배는 바람에 날아가요! 깃발을 잘 봐요", "");
          p.fish(4, 0, 3, 1.4);
        });
        b.road(24, { w: 7, bankL: true }, (p) => {
          p.wind(2, 23, { dir: -1, power: 8.5, period: 4.4, duty: 0.45 });
          p.fish(4, 1, 8, 2.4);
        });
        b.road(8, { w: 8 }, (p) => {
          p.check(1);
          p.item("bubble", 5, 0);
        });
        b.road(26, { w: 5.6, turn: 40 }, (p) => {
          p.wind(1, 25, { dir: 1, power: 8.5, period: 4, duty: 0.42, phase: 0.2 });
          p.fish(3, 0, 8, 3);
          p.star(14, -1.8);
        });
        b.road(8, { w: 8 }, (p) => p.check(1));
        b.road(18, { w: 5.2, surf: "ice", turn: -26 }, (p) => {
          p.wind(1, 17, { dir: -1, power: 7, period: 4.4, duty: 0.36 });
          p.fish(3, 0, 6, 2.6);
        });
        b.goalHere();
      },
    },
    {
      name: "굴러오는 협곡",
      goal: "좁은 길에서 넓은 곳을 찾아 눈덩이를 피해요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 8 });
        b.road(15, { w: 6.4, dy: 2 }, (p) => {
          p.tip(0, "눈덩이가 와요! 넓은 곳에서 피해요", "");
          p.snowballs(0.5, 14.5, { lat: -1.3, wander: 0.2, r: 0.95, speed: 5, period: 3.6 });
          p.fish(3, 2, 5, 2.2);
        });
        b.road(7, { w: 9 }, (p) => p.check(2));
        b.road(16, { w: 6.4, dy: 2.4, turn: 24 }, (p) => {
          p.snowballs(0.5, 15.5, { lat: 1.2, r: 1, speed: 5, period: 3.4, phase: 1.5 });
          p.fish(3, -2, 5, 2.4);
        });
        b.road(7, { w: 9 }, (p) => {
          p.check(2);
          p.star(5, 3.4);
        });
        b.road(18, { w: 6.8, dy: 2.8, turn: -30 }, (p) => {
          p.snowballs(0.5, 17.5, { lat: 0, wander: 1.5, r: 1.05, speed: 5.3, period: 3, phase: 0.6 });
          p.fish(3, 0, 6, 2.4);
        });
        b.road(6, { w: 9 });
        b.goalHere();
      },
    },
    {
      name: "바람 구멍 점프",
      goal: "바람 구멍을 타고 위로 올라가요",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 8 }, (p) => p.tip(3, "바람 구멍 위에 서면 둥실! 불 때를 기다려요", ""));
        b.road(5, { w: 6 }, (p) => p.vent(3.5, 0, { r: 1.7, power: 9.5, height: 5.2, period: 3.6, duty: 0.6 }));
        b.gap(2.4, { dy: 3 });
        b.road(9, { w: 7 }, (p) => {
          p.check(2);
          p.fish(3, 0, 3, 1.3);
        });
        b.road(5, { w: 5, turn: 24 }, (p) => p.vent(3.2, 0, { r: 1.6, power: 10, height: 5.6, period: 3.2, duty: 0.55, phase: 0.3 }));
        b.gap(3, { dy: 3.4 });
        b.road(10, { w: 7 }, (p) => {
          p.check(2);
          p.star(6, 2.4);
        });
        b.gap(3);
        b.road(6, { w: 6 }, (p) => p.fish(2, 0, 3, 1.2));
        b.road(5, { w: 5, turn: -30 }, (p) => p.vent(3.2, 0, { r: 1.6, power: 10.5, height: 6, period: 3, duty: 0.55 }));
        b.gap(3.2, { dy: 3.6 });
        b.road(6, { w: 7 });
        b.goalHere();
      },
    },
    {
      name: "고드름 길",
      goal: "그림자가 보이면 얼른 지나가요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 8 });
        b.road(26, { w: 6.4, turn: 26 }, (p) => {
          p.tip(1, "고드름! 동그란 그림자에서 벗어나요", "");
          for (const [m, lat] of [[5, 0], [10, -1.5], [14, 1.5], [18, 0], [22, -1.4]]) p.icicle(m, lat);
          p.fish(3, 1.8, 8, 2.8);
        });
        b.road(8, { w: 8 }, (p) => {
          p.check(1);
          p.item("shield", 5, 0);
        });
        b.road(14, { w: 8 }, (p) => {
          p.rotor(7, 0, { len: 3.9, speed: 1.6, arms: 2 });
          p.icicle(3, -2);
          p.icicle(11, 2);
        });
        b.road(20, { w: 5.6, surf: "ice", turn: -30 }, (p) => {
          for (const [m, lat] of [[5, 1], [10, -1], [15, 1]]) p.icicle(m, lat);
          p.star(17, -2);
          p.fish(3, 0, 7, 2.4);
        });
        b.goalHere();
      },
    },
    {
      name: "협곡 탈출",
      goal: "거대한 눈덩이가 쫓아와요. 뒤돌아보지 말아요!",
      packs: ["normal", "normal"],
      extra: 4,
      build(b) {
        const p0 = b.road(13, { w: 8 }, (p) => {
          p.tip(4, "쿠르릉… 거대한 눈덩이다! 달려요!", "");
          p.fish(5, 0, 4, 1.4);
        });
        p0.chaser(0, 12, { r: 2.1, speed: 5.9, after: 6 });
        const ch = lastObj(b);
        b.road(16, { w: 6.4, dy: -2, surf: "ice", turn: 22 }, (p) => {
          p.fish(3, 0, 6, 2);
          p.pillar(9, 1.5, 0.65);
        });
        b.bridge(11, { w: 3.6, delay: 0.7 });
        b.road(14, { w: 7, turn: -30 }, (p) => {
          p.check(1);
          p.fish(3, 0, 4, 2);
          p.crate(8, -2);
          p.crate(8, 2);
        });
        const p1 = b.road(20, { w: 6.4, dy: -3, surf: "ice", turn: 24 }, (p) => {
          p.star(10, -2.2);
          p.fish(3, 1.5, 6, 2.2);
          p.item("boost", 5, -1);
        });
        extend(ch, p1, 18);
        b.gap(2.4);
        b.road(8, { w: 8 });
        b.goalHere();
      },
    },
  ],
  /* ==================== 3. 북극 바다 ==================== */
  [
    {
      name: "둥둥 빙하",
      goal: "떠 있는 빙하를 건너요. 올라서면 살짝 가라앉아요",
      packs: ["normal"],
      build(b) {
        b.road(11, { w: 9, surf: "snow" }, (p) => {
          p.tip(5, "빙하로 폴짝! 물에 빠지면 풍덩이에요", "jump");
          p.fish(3, 0, 3, 1.4);
        });
        b.hop(5.4, { r: 3 });
        b.hop(7.2, { r: 3, lat: 1.5 });
        b.hop(7.2, { r: 3, lat: -1, items: ["fish"] });
        b.gap(5.4);
        b.road(8, { w: 9 }, (p) => {
          p.check(1);
          p.fish(3, 0, 3, 1.2);
        });
        b.hop(5.2, { r: 2.6, lat: 1 });
        b.hop(6.8, { r: 2.6, lat: -1.4, items: ["star"] });
        b.hop(6.8, { r: 2.6, lat: 1.2 });
        b.hop(6.8, { r: 2.6, lat: 0 });
        b.gap(5);
        b.road(4, { w: 9 });
        b.goalHere();
      },
    },
    {
      name: "바다표범 동네",
      goal: "바다표범을 피해 넓은 얼음판을 건너요",
      packs: ["normal"],
      build(b) {
        b.road(9, { w: 9 });
        b.road(22, { w: 12, surf: "ice" }, (p) => {
          p.tip(1, "바다표범에게 물리면 쫓아가요!", "");
          p.seal(8, 0, { amp: 4, period: 4.6 });
          p.seal(16, 0, { amp: 4, period: 4, phase: 2 });
          p.fish(4, 4.4, 6, 3);
        });
        b.gap(2.8);
        b.road(20, { w: 11, surf: "ice", turn: 26 }, (p) => {
          p.check(2);
          p.seal(8, 2, { amp: 3, period: 4 });
          p.seal(14, -2, { amp: 3, period: 3.6, phase: 1.6 });
          p.star(11, 4.6);
          p.fish(3, -3.8, 6, 2.4);
        });
        b.gap(2.8);
        b.road(20, { w: 10, surf: "ice", turn: -30 }, (p) => {
          p.check(2);
          p.seal(10, 0, { amp: 3.6, period: 3.4 });
          p.hole(5, -3, 1.2);
          p.hole(15, 2.8, 1.2);
          p.item("bubble", 3, 3);
          p.fish(3, 0, 7, 2.2);
        });
        b.goalHere();
      },
    },
    {
      name: "물기둥 타기",
      goal: "물기둥을 타고 높은 빙하로 올라가요",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 8 }, (p) => p.tip(2, "물방울이 보글보글 하면 곧 솟아요!", ""));
        b.road(5, { w: 7 }, (p) => p.geyser(3.2, 0, { r: 1.5, power: 13.5, period: 3.6 }));
        b.gap(2.4, { dy: 3 });
        b.road(9, { w: 8 }, (p) => {
          p.check(2);
          p.fish(3, 0, 3, 1.3);
        });
        b.hop(5, { r: 2.5, lat: 1, dy: -0.8 });
        b.hop(6.6, { r: 2.7, lat: 0, dy: -0.4 });
        const q = b.road(5, { w: 6, surf: "snow" }, (p) => p.geyser(3, 0, { r: 1.5, power: 14, period: 3.2, phase: 0.2 }));
        void q;
        b.gap(2.6, { dy: 3.4 });
        b.road(9, { w: 8, turn: 26 }, (p) => {
          p.check(2);
          p.star(5, 2.6);
        });
        b.gap(2.8);
        b.road(5, { w: 6 }, (p) => p.geyser(2.5, 0, { r: 1.5, power: 14.5, period: 3, phase: 0.5 }));
        b.gap(2.8, { dy: 3.6 });
        b.road(5, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "미끄럼 점프대",
      goal: "얼음 경사로에서 힘을 모아 바다를 넘어요",
      packs: ["normal"],
      build(b) {
        b.road(9, { w: 8 }, (p) => p.tip(2, "경사로에서 슝! 점프대를 타면 멀리 날아요", ""));
        b.road(13, { w: 7, surf: "ice", dy: -3.4 }, (p) => p.fish(3, 0, 5, 2));
        b.road(5, { w: 7, surf: "ice", dy: 1.3, profile: "ramp" });
        b.gap(7, { dy: -0.4 });
        b.road(10, { w: 9 }, (p) => {
          p.check(2);
          p.fish(3, 0, 3, 1.3);
        });
        b.road(15, { w: 6, surf: "ice", dy: -2.6, turn: 18 }, (p) => p.fish(2, 0, 6, 2));
        b.road(5, { w: 6, surf: "ice", dy: 1.5, profile: "ramp" }, (p) => p.star(4, 0, 2.6));
        b.gap(8, { dy: -0.8 });
        b.road(9, { w: 9, surf: "ice" }, (p) => p.check(3));
        b.road(13, { w: 6, surf: "ice", dy: -2.4, turn: -20 });
        b.road(5, { w: 6, surf: "ice", dy: 1.4, profile: "ramp" });
        b.gap(7.4, { dy: -0.6 });
        b.road(6, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "부서지는 얼음판",
      goal: "금이 간 얼음은 곧 깨져요. 쉬지 말고 뛰어요!",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 9 }, (p) => {
          p.tip(4, "금 간 얼음은 밟으면 깨져요!", "");
          p.fish(4, 0, 3, 1.3);
        });
        for (const [lat, it] of [[0, null], [1.2, "fish"], [-1, null], [1, "fish"]]) b.hop(lat === 0 ? 4.9 : 6.2, { kind: "crumble", r: 2.5, lat, delay: 1, items: it ? [it] : undefined });
        b.gap(4.8);
        b.road(8, { w: 9, turn: 18 }, (p) => {
          p.check(2);
          p.item("shield", 5, 0);
        });
        for (const [lat, it] of [[1, null], [-1.2, "star"], [0.8, null], [-0.8, "fish"], [0.6, null]]) b.hop(lat === 1 ? 4.7 : 6.1, { kind: "crumble", r: 2.35, lat, delay: 0.85, items: it ? [it] : undefined });
        b.gap(4.6);
        b.road(5, { w: 9 });
        b.goalHere();
      },
    },
    {
      name: "떠다니는 항로",
      goal: "떠다니는 빙하의 길을 읽어요",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 9 }, (p) => p.tip(5, "빙하가 가까워질 때 건너요", "jump"));
        b.hop(5.4, { kind: "mover", r: 3, amp: 2.4, period: 5.2 });
        b.hop(7.2, { kind: "mover", r: 3, amp: -2.4, period: 5.2 });
        b.gap(5.4);
        b.road(7, { w: 8 }, (p) => {
          p.check(1.5);
          p.fish(3, 0, 2, 1.2);
        });
        b.hop(5.4, { kind: "orbit", r: 2.8, radius: 2.2, period: 6 });
        b.hop(8.4, { kind: "orbit", r: 2.8, radius: 2.2, period: 6, phase: Math.PI, items: ["star"] });
        b.gap(5.6);
        b.road(7, { w: 8, turn: 24 }, (p) => p.check(1.5));
        b.hop(5.4, { kind: "mover", r: 2.7, fwd: 1.7, period: 4.6 });
        b.hop(7.6, { kind: "mover", r: 2.7, amp: 2.6, period: 4.6, items: ["fish"] });
        b.hop(7.2, { kind: "mover", r: 2.7, amp: -2.6, period: 4.6 });
        b.gap(5);
        b.road(4, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "바닷바람",
      goal: "가벼운 택배를 바닷바람에서 지켜요",
      packs: ["light", "normal"],
      extra: 6,
      build(b) {
        b.road(11, { w: 9 }, (p) => p.tip(3, "바닷바람이 세요! 깃발이 흔들리면 버텨요", ""));
        b.road(26, { w: 7.5, surf: "ice" }, (p) => {
          p.wind(1, 25, { dir: 1, power: 7.5, period: 4.4, duty: 0.4 });
          p.seal(12, 0, { amp: 2.4, period: 4 });
          p.fish(3, -1.5, 8, 3);
        });
        b.hop(5.6, { r: 3, lat: 0 });
        b.gap(5.4);
        b.road(22, { w: 8, turn: 30 }, (p) => {
          p.check(1.5);
          p.item("bubble", 4, 0);
          p.wind(5, 21, { dir: -1, power: 7, period: 4, duty: 0.42 });
          p.seal(13, 0, { amp: 3, period: 3.8 });
          p.star(17, 2.8);
        });
        b.hop(5.4, { kind: "mover", r: 2.8, amp: 2, period: 5 });
        b.gap(5.4);
        b.road(5, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "깨지기 쉬운 화물",
      goal: "유리 인형이에요! 충격을 줄여 조심조심",
      packs: ["fragile"],
      extra: 8,
      build(b) {
        b.road(11, { w: 9 }, (p) => {
          p.tip(1, "깨지기 쉬워요! 떨어뜨리면 많이 다쳐요", "");
          p.item("bubble", 6, 0);
          p.fish(2, 2, 3, 1.5);
        });
        b.road(18, { w: 8, surf: "ice", turn: 20, dy: -1 }, (p) => {
          p.bump(6, { limit: 8.2 });
          p.bump(12, { limit: 8.2 });
          p.fish(3, 0, 6, 2.4);
        });
        b.hop(5.4, { r: 3.2 });
        b.hop(7.4, { r: 3.2, lat: 1.2, items: ["fish"] });
        b.gap(5.6);
        b.road(10, { w: 9 }, (p) => {
          p.check(2);
          p.item("bubble", 6, 2);
        });
        b.road(20, { w: 9, surf: "ice", turn: -30 }, (p) => {
          p.seal(10, 0, { amp: 3.2, period: 5 });
          p.star(10, 3.8);
          p.fish(4, -3, 6, 2.4);
        });
        b.goalHere();
      },
    },
    {
      name: "등대 특급",
      goal: "시간 안에 등대까지! 특급 배달이에요",
      packs: ["express"],
      express: true,
      build(b) {
        b.road(10, { w: 9 }, (p) => {
          p.tip(1, "특급이에요! 제한 시간이 빠듯해요", "dash");
          p.item("boost", 6, 0);
        });
        b.road(13, { w: 7, surf: "ice", dy: -2.6 }, (p) => p.fish(2, 0, 6, 1.8));
        b.road(5, { w: 7, surf: "ice", dy: 1.2, profile: "ramp" });
        b.gap(6.6, { dy: -0.3 });
        b.road(8, { w: 8 }, (p) => p.check(2));
        for (const [lat, kind] of [[1, "crumble"], [-1.2, "crumble"], [0.8, "floe"]]) b.hop(lat === 1 ? 5 : 6.3, { kind, r: 2.5, lat, delay: 1 });
        b.gap(5);
        b.road(18, { w: 9, surf: "ice", turn: 28 }, (p) => {
          p.check(1.5);
          p.seal(10, 0, { amp: 3.4, period: 3.8 });
          p.star(14, 3.6);
        });
        b.road(4, { w: 7 }, (p) => p.geyser(2.2, 0, { r: 1.5, power: 14, period: 3, phase: 0.4 }));
        b.gap(2.6, { dy: 3 });
        b.road(6, { w: 8 });
        b.goalHere();
      },
    },
  ],
  /* ==================== 4. 눈보라 산맥 ==================== */
  [
    {
      name: "높은 산길",
      goal: "한쪽은 절벽! 좁은 길을 달려요",
      packs: ["normal"],
      build(b) {
        b.road(9, { w: 8, bankL: true });
        b.road(26, { w: 5, bankL: true, turn: -24, dy: 3 }, (p) => {
          p.tip(1, "왼쪽은 절벽, 오른쪽은 낭떠러지!", "");
          p.fish(3, 0, 8, 2.8);
          p.snowman(13, -1);
        });
        b.road(8, { w: 7, bankL: true }, (p) => p.check(1));
        b.road(26, { w: 4.2, bankL: true, turn: 36, dy: 3.2, surf: "ice" }, (p) => {
          p.fish(3, 0, 8, 2.8);
          p.star(13, 1.2);
        });
        b.road(8, { w: 7, bankR: true }, (p) => p.check(1));
        b.road(20, { w: 4, bankR: true, turn: -30, dy: 2 }, (p) => {
          p.fox(10, 1, { trig: 6.5 });
          p.fish(3, -0.5, 6, 2.6);
        });
        b.goalHere();
      },
    },
    {
      name: "급경사 슬라이딩",
      goal: "쭉 미끄러져요! 깊은 눈으로 속도를 줄여요",
      packs: ["normal"],
      build(b) {
        b.road(8, { w: 8 }, (p) => p.tip(1, "대시를 누르면 배로 슝! 생선을 쓸어 담아요", "dash"));
        b.road(30, { w: 8, surf: "ice", dy: -9, turn: 14, bankL: true, bankR: true }, (p) => {
          p.fish(4, 0, 8, 1.4);
          p.fish(18, -2.4, 5, 1.4);
          p.fish(18, 2.4, 5, 1.4);
          p.item("boost", 12, 0);
        });
        b.road(8, { w: 8, surf: "deep", bankL: true, bankR: true }, (p) => {
          p.tip(0, "깊은 눈은 속도를 줄여 줘요", "");
          p.check(5);
        });
        b.road(34, { w: 8, surf: "ice", dy: -10, turn: -22, bankL: true, bankR: true }, (p) => {
          for (const [m, lat] of [[6, -2], [12, 2], [18, -1.6], [24, 2]]) p.pillar(m, lat, 0.7, 3.6);
          p.star(21, 2.6);
          p.fish(3, 0.4, 9, 3);
        });
        b.road(9, { w: 8, surf: "deep", bankL: true, bankR: true }, (p) => p.check(6));
        b.road(13, { w: 6, surf: "ice", dy: -3.2 });
        b.road(5, { w: 6, surf: "ice", dy: 1.3, profile: "ramp" });
        b.gap(7, { dy: -1 });
        b.road(6, { w: 9 });
        b.goalHere();
      },
    },
    {
      name: "풍차 고개",
      goal: "풍차 날개 사이로 빠져나가요",
      packs: ["normal"],
      build(b) {
        b.road(9, { w: 8 }, (p) => p.tip(3, "풍차 날개가 지나간 다음에 달려요!", ""));
        b.road(9, { w: 7, dy: 1 }, (p) => {
          p.windmill(5, 0, { hub: 3.1, blade: 3.05, blades: 2, speed: 1.05 });
          p.fish(1, 0, 2, 1);
        });
        b.road(9, { w: 8 }, (p) => {
          p.check(1);
          p.fish(3, 0, 3, 1.2);
        });
        b.road(16, { w: 6.4, dy: 1.2, turn: 26 }, (p) => {
          p.windmill(4.5, 0, { hub: 3, blade: 2.95, blades: 3, speed: -1.0 });
          p.windmill(11.5, 0, { hub: 3, blade: 2.95, blades: 3, speed: 1.0, phase: 1 });
          p.star(8, 2.4);
        });
        b.road(9, { w: 8 }, (p) => p.check(1));
        b.road(22, { w: 5.2, dy: 1.6, turn: -28, surf: "ice" }, (p) => {
          for (const [m, sp, ph] of [[5, 1.1, 0], [11, -1.2, 1], [17, 1.15, 2]]) p.windmill(m, 0, { hub: 2.8, blade: 2.72, blades: 3, speed: sp, phase: ph });
          p.fish(2, 0, 6, 3.4);
        });
        b.road(5, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "눈사태 주의",
      goal: "우르릉 소리가 나면 멈추고, 지나가면 달려요",
      packs: ["normal"],
      build(b) {
        b.road(9, { w: 8, bankL: true }, (p) => p.tip(2, "눈사태가 지나갈 길이 빨갛게 보여요!", ""));
        b.road(8, { w: 7, bankL: true }, (p) => p.avalanche(4, { band: 4.6, period: 5, run: 1.3 }));
        b.road(9, { w: 8, bankL: true }, (p) => {
          p.check(1);
          p.fish(3, 0, 3, 1.3);
        });
        b.road(16, { w: 7, bankL: true, turn: 18, dy: 1 }, (p) => {
          p.avalanche(4, { band: 3.8, period: 4.8, run: 1.2 });
          p.avalanche(11.5, { band: 3.8, period: 4.8, run: 1.2, phase: 0.5 });
          p.star(7.8, 2.2);
        });
        b.road(9, { w: 8, bankL: true }, (p) => {
          p.check(1);
          p.item("shield", 5, 0);
        });
        b.road(24, { w: 6.4, bankL: true, turn: -22, dy: 1.6 }, (p) => {
          p.avalanche(4, { band: 3.6, period: 4.2, run: 1.15 });
          p.avalanche(12, { band: 3.6, period: 4.2, run: 1.15, phase: 0.33 });
          p.avalanche(20, { band: 3.6, period: 4.2, run: 1.15, phase: 0.66 });
          p.fish(1, 0, 6, 3.8);
        });
        b.road(5, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "눈보라 속으로",
      goal: "앞이 안 보여요! 가로등과 생선을 따라가요",
      packs: ["normal"],
      build(b) {
        b.road(11, { w: 8 }, (p) => {
          p.tip(4, "눈보라예요! 생선 줄을 따라가요", "");
          p.blizzard(8, 11, { fog: 0.5, push: 2 });
        });
        const z = lastZone(b);
        b.road(22, { w: 6, turn: 30 }, (p) => p.fish(1, 0, 10, 2.1));
        b.road(9, { w: 8 }, (p) => p.check(1));
        b.road(26, { w: 5, turn: -44, surf: "ice" }, (p) => {
          p.fish(1, 0, 12, 2.1);
          p.star(13, 1.6);
        });
        const q = b.road(8, { w: 8 }, (p) => p.check(1));
        extend(z, q, 7);
        b.road(24, { w: 4.8, turn: 32, dy: 1.5 }, (p) => {
          p.blizzard(1, 23, { fog: 0.82, push: 2.6 });
          p.fish(1, 0, 11, 2.1);
          p.snowman(12, 1.1);
        });
        b.goalHere();
      },
    },
    {
      name: "여우 고개",
      goal: "숨어 있는 여우들을 조심하며 고개를 넘어요",
      packs: ["normal", "normal"],
      extra: 8,
      build(b) {
        b.road(9, { w: 8, bankL: true });
        b.road(22, { w: 6.4, bankL: true, dy: 2, turn: -20 }, (p) => {
          p.fox(9, -2, { trig: 8 });
          p.fox(18, 2, { trig: 7 });
          p.fish(3, 0, 7, 2.8);
        });
        b.road(8, { w: 8, bankL: true }, (p) => {
          p.check(1);
          p.item("bubble", 5, 0);
        });
        b.road(20, { w: 5.6, surf: "ice", dy: -2.4, turn: 26, bankR: true }, (p) => {
          p.fox(11, 1.8, { trig: 7.5 });
          p.star(16, -1.6);
          p.fish(2, 0, 6, 2.6);
        });
        b.road(8, { w: 8, bankR: true }, (p) => p.check(1));
        b.road(20, { w: 7, bankR: true, turn: -24 }, (p) => {
          p.rotor(7, 0, { len: 3.4, speed: 1.5, arms: 2 });
          p.fox(14, -2.4, { trig: 7.5 });
        });
        b.goalHere();
      },
    },
    {
      name: "무너지는 눈 터널",
      goal: "터널이 뒤에서 무너져요. 전속력으로!",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 8 }, (p) => {
          p.tip(4, "터널에 들어서면 뒤에서 무너져요. 달려요!", "");
          p.fish(4, 0, 3, 1.3);
        });
        b.road(30, { w: 6.4, turn: 22 }, (p) => {
          p.tunnel(1, 29, { speed: 5.6 });
          p.fish(4, 0, 9, 2.8);
          p.crate(14, -1.8);
          p.crate(21, 1.8);
        });
        b.road(9, { w: 8 }, (p) => {
          p.check(2);
          p.item("boost", 6, 0);
        });
        b.road(32, { w: 6, turn: -26, dy: -2, surf: "ice" }, (p) => {
          p.tunnel(1, 31, { speed: 6.2 });
          p.pillar(11, -1.3, 0.6, 3);
          p.pillar(21, 1.3, 0.6, 3);
          p.star(16, 1.6);
          p.fish(4, 0, 9, 3);
        });
        b.road(9, { w: 8 }, (p) => p.check(2));
        b.road(26, { w: 5.6, turn: 28 }, (p) => {
          p.tunnel(1, 25, { speed: 6 });
          p.icicle(10, 0);
          p.icicle(18, 0);
        });
        b.goalHere();
      },
    },
    {
      name: "산악 특급",
      goal: "내리막으로 시간을 벌어요. 특급 배달!",
      packs: ["express"],
      express: true,
      build(b) {
        b.road(8, { w: 8 }, (p) => {
          p.tip(1, "특급! 내리막에서 대시로 시간을 벌어요", "dash");
          p.item("boost", 5, 0);
        });
        b.road(26, { w: 7, surf: "ice", dy: -7, turn: 16, bankR: true, bankL: true }, (p) => {
          for (const [m, lat] of [[8, -1.8], [15, 1.8], [21, -1.8]]) p.snowman(m, lat);
          p.fish(4, 0, 7, 3);
        });
        b.road(7, { w: 7, surf: "deep", bankR: true, bankL: true }, (p) => p.check(4));
        b.road(12, { w: 6, turn: -20 }, (p) => {
          p.windmill(6, 0, { hub: 3, blade: 2.9, blades: 2, speed: 1.1 });
          p.star(10, 2.2);
        });
        b.road(11, { w: 5, surf: "ice", dy: -2.6 });
        b.road(4.5, { w: 5, surf: "ice", dy: 1.1, profile: "ramp" });
        b.gap(6.2, { dy: -0.6 });
        b.road(16, { w: 7, turn: 24 }, (p) => {
          p.check(1.5);
          p.avalanche(9, { band: 3.8, period: 4.2, run: 1.2 });
        });
        b.goalHere();
      },
    },
    {
      name: "정상 우체국",
      goal: "커다란 택배를 정상까지 옮겨요",
      packs: ["big"],
      extra: 10,
      build(b) {
        b.road(11, { w: 9, bankL: true }, (p) => {
          p.tip(1, "대형 택배! 앞이 잘 안 보이고 잘 흔들려요", "");
          p.fish(4, 0, 3, 1.4);
        });
        b.road(24, { w: 6.4, bankL: true, dy: 3.4, turn: -28 }, (p) => {
          p.windmill(10, 0, { hub: 3.3, blade: 3.2, blades: 2, speed: 0.95 });
          p.icicle(17, 1);
          p.fish(3, 0, 7, 3);
        });
        b.road(9, { w: 8, bankL: true }, (p) => {
          p.check(1);
          p.item("bubble", 5, 0);
        });
        b.road(16, { w: 6.6, bankL: true, dy: 2, turn: 24 }, (p) => {
          p.avalanche(8, { band: 4, period: 5.2, run: 1.3 });
          p.star(13, 2);
        });
        b.bridge(10, { w: 3.8, delay: 0.85 });
        b.road(10, { w: 8, bankR: true }, (p) => {
          p.check(1);
          p.fish(3, 0, 3, 1.3);
        });
        b.road(26, { w: 5.4, turn: -24, dy: 2.4, bankR: true }, (p) => {
          p.blizzard(1, 25, { fog: 0.62, push: 2.2 });
          p.fox(14, -1.5, { trig: 6.5 });
          p.fish(2, 0, 9, 2.6);
        });
        b.goalHere();
      },
    },
  ],
  /* ==================== 5. 오로라 왕국 ==================== */
  [
    {
      name: "오로라 입구",
      goal: "반짝이는 마법 발판을 타고 왕국으로 들어가요",
      packs: ["normal"],
      build(b) {
        b.road(11, { w: 9, surf: "ice" }, (p) => {
          p.tip(2, "마법 발판이 천천히 움직여요", "jump");
          p.fish(3, 0, 4, 1.4);
        });
        b.hop(5.2, { kind: "magic", w: 5, depth: 4.4, amp: 2.2, period: 5.4, surf: "ice" });
        b.hop(7, { kind: "magic", w: 5, depth: 4.4, amp: -2.2, period: 5.4, surf: "ice", items: ["fish"] });
        b.gap(5);
        b.road(8, { w: 8, surf: "ice" }, (p) => p.check(1.5));
        b.hop(5.2, { kind: "magic", w: 5, depth: 4.4, ampY: 1.2, period: 4.8, surf: "ice" });
        b.hop(7, { kind: "magic", w: 5, depth: 4.4, fwd: 1.3, period: 4.8, surf: "ice", items: ["star"] });
        b.gap(5.4);
        b.road(4, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "사라지는 얼음길",
      goal: "반짝이기 시작하면 곧 사라져요!",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 8, surf: "ice" }, (p) => p.tip(4, "길이 깜빡이면 곧 사라져요! 박자를 봐요", ""));
        for (let i = 0; i < 5; i += 1) b.hop(i === 0 ? 3.6 : 4.8, { kind: "vanish", w: 6.4, depth: 4.2, surf: "ice", period: 4, duty: 0.66, phase: -i * 0.12 });
        b.gap(3.6);
        b.road(8, { w: 8, surf: "ice", turn: 26 }, (p) => {
          p.check(1.5);
          p.fish(3, 0, 3, 1.2);
        });
        for (let i = 0; i < 6; i += 1) b.hop(i === 0 ? 3.6 : 4.6, { kind: "vanish", w: 5.2, depth: 4, surf: "ice", period: 3.6, duty: 0.64, phase: -i * 0.14, lat: Math.sin(i * 1.4) * 1.4, items: i === 3 ? ["star"] : undefined });
        b.gap(3.6);
        b.road(4, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "마법 발판 왈츠",
      goal: "빙글빙글 도는 발판의 박자에 맞춰요",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 8 }, (p) => {
          p.tip(5, "빙글빙글! 가까이 올 때 건너요", "jump");
          p.fish(2, 0, 4, 1.3);
        });
        b.hop(6, { kind: "orbit", r: 2.5, radius: 2.8, period: 6, surf: "ice" });
        b.hop(9.2, { kind: "orbit", r: 2.5, radius: 2.8, period: 6, phase: Math.PI, surf: "ice", items: ["fish"] });
        b.gap(6.2);
        b.road(8, { w: 8, turn: -24 }, (p) => p.check(1.5));
        b.hop(6, { kind: "orbit", r: 2.4, radius: 2.8, period: 5.4, surf: "ice" });
        b.hop(9.2, { kind: "orbit", r: 2.4, radius: 2.8, period: 5.4, phase: Math.PI, surf: "ice", items: ["star"] });
        b.hop(9.2, { kind: "orbit", r: 2.4, radius: 2.8, period: 5.4, surf: "ice" });
        b.gap(6.2);
        b.road(5, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "별빛 징검다리",
      goal: "작은 발판을 정확히 밟아요. 공중 대시도 써 봐요",
      packs: ["normal"],
      build(b) {
        b.road(10, { w: 8, surf: "ice" }, (p) => p.tip(5, "공중에서 대시를 누르면 빙글! 더 멀리 날아요", "dash"));
        b.hop(4.4, { kind: "slab", w: 3.4, depth: 3.4, surf: "snow" });
        b.hop(5.6, { kind: "slab", w: 3, depth: 3, surf: "snow", lat: 1.4, dy: 0.5 });
        b.hop(5.6, { kind: "slab", w: 3, depth: 3, surf: "snow", lat: -1.2, dy: 0.5, items: ["fish"] });
        b.hop(5.8, { kind: "slab", w: 3, depth: 3, surf: "snow", lat: 0.6, dy: 0.4 });
        b.gap(4);
        b.road(7, { w: 7 }, (p) => {
          p.check(1.5);
          p.spring(5, 0, 13.5);
        });
        b.gap(3, { dy: 3 });
        b.road(6, { w: 7 }, (p) => {
          p.check(2);
          p.star(4, 2);
        });
        b.hop(4.4, { kind: "crumble", r: 1.9, surf: "ice", delay: 0.9 });
        b.hop(5.6, { kind: "crumble", r: 1.9, surf: "ice", lat: 1.2, delay: 0.9 });
        b.hop(5.6, { kind: "crumble", r: 1.9, surf: "ice", lat: -1, delay: 0.9, items: ["fish"] });
        b.gap(4.2);
        b.road(4, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "얼음 성 정원",
      goal: "성 정원의 경비를 피해 달려요",
      packs: ["normal"],
      build(b) {
        b.road(9, { w: 9, bank: true });
        b.road(16, { w: 9, bank: true, surf: "ice" }, (p) => {
          p.tip(1, "눈사람 경비병과 도는 기둥을 피해요", "");
          p.rotor(8, 0, { len: 4.2, speed: 1.4, arms: 2 });
          p.snowman(3, -3);
          p.snowman(3, 3);
          p.snowman(13, -3);
          p.snowman(13, 3);
        });
        b.road(16, { w: 9, bank: true, turn: 45 }, (p) => {
          p.check(1);
          p.crate(5, 0, { amp: 3.3, period: 3.4 });
          p.crate(10, 0, { amp: 3.3, period: 3.4, phase: 2 });
          p.fish(3, 0, 5, 2.6);
        });
        b.road(22, { w: 9, bank: true, surf: "ice" }, (p) => {
          p.check(1);
          p.rotor(7, -1.6, { len: 2.7, speed: 1.8, arms: 2 });
          p.rotor(15, 1.6, { len: 2.7, speed: -1.8, arms: 2 });
          p.seal(11, 0, { amp: 3.2, period: 3.8 });
          p.star(19, -3.4);
        });
        b.road(16, { w: 9, bank: true, turn: -45 }, (p) => {
          p.fox(9, 3, { trig: 7.5 });
          p.fish(3, 0, 5, 2.4);
        });
        b.goalHere();
      },
    },
    {
      name: "오로라 돌풍",
      goal: "바람 구멍과 사라지는 길을 함께 넘어요",
      packs: ["light"],
      extra: 8,
      build(b) {
        b.road(10, { w: 8 }, (p) => p.tip(2, "가벼운 택배를 꼭 붙잡아요!", ""));
        b.road(5, { w: 6 }, (p) => p.vent(3.2, 0, { r: 1.7, power: 9.8, height: 5.4, period: 3.4, duty: 0.6 }));
        b.gap(2.4, { dy: 3 });
        b.road(8, { w: 7 }, (p) => {
          p.check(1.5);
          p.item("bubble", 5, 0);
        });
        for (let i = 0; i < 4; i += 1) b.hop(i === 0 ? 3.6 : 4.8, { kind: "vanish", w: 5.4, depth: 4.2, surf: "ice", period: 4.2, duty: 0.66, phase: -i * 0.1 });
        b.gap(3.6);
        b.road(20, { w: 6, turn: 28 }, (p) => {
          p.check(1.5);
          p.wind(4, 19, { dir: -1, power: 7, period: 4, duty: 0.4 });
          p.fish(4, 0, 6, 2.6);
          p.star(13, 1.8);
        });
        b.road(5, { w: 6 }, (p) => p.vent(3.2, 0, { r: 1.7, power: 10.5, height: 6, period: 3, duty: 0.6, phase: 0.2 }));
        b.gap(2.8, { dy: 3.4 });
        b.road(5, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "크리스털 회랑",
      goal: "고드름 · 여우 · 무너지는 다리가 한꺼번에!",
      packs: ["normal", "normal"],
      extra: 10,
      build(b) {
        b.road(9, { w: 8 });
        b.road(22, { w: 6.4, surf: "ice", turn: 24 }, (p) => {
          p.tip(1, "반짝이는 회랑이에요. 위와 옆을 모두 봐요", "");
          for (const [m, lat] of [[5, 0], [10, 1.5], [15, -1.5]]) p.icicle(m, lat);
          p.fox(18, 2.2, { trig: 7 });
          p.fish(3, 0, 7, 2.6);
        });
        b.bridge(11, { w: 3.4, delay: 0.7 });
        b.road(9, { w: 8 }, (p) => {
          p.check(2);
          p.item("shield", 5, 0);
        });
        b.road(24, { w: 6, turn: -28 }, (p) => {
          p.tunnel(1, 15, { speed: 5.8 });
          p.icicle(18, 1);
          p.star(21, -1.8);
        });
        b.bridge(10, { w: 3.2, delay: 0.6 });
        b.road(8, { w: 8 }, (p) => p.check(2));
        b.road(16, { w: 6, surf: "ice", turn: 20 }, (p) => {
          p.fox(9, -2, { trig: 7 });
          p.rotor(13, 0, { len: 2.8, speed: 1.6, arms: 2 });
        });
        b.goalHere();
      },
    },
    {
      name: "왕실 특급",
      goal: "여왕님 편지를 시간 안에 전해요!",
      packs: ["express"],
      express: true,
      build(b) {
        b.road(9, { w: 8, surf: "ice" }, (p) => {
          p.tip(1, "왕실 특급! 사라지는 길을 멈추지 말고 건너요", "dash");
          p.item("boost", 5, 0);
          p.fish(2, -2, 4, 1.3);
        });
        for (let i = 0; i < 4; i += 1) b.hop(i === 0 ? 3.6 : 4.8, { kind: "vanish", w: 6, depth: 4.2, surf: "ice", period: 4, duty: 0.7, phase: -i * 0.14 });
        b.gap(3.6);
        b.road(15, { w: 7, surf: "ice", turn: 26, dy: -2 }, (p) => {
          p.check(1.5);
          p.windmill(9, 0, { hub: 3, blade: 2.9, blades: 2, speed: 1.2 });
        });
        b.hop(5.4, { kind: "magic", w: 4.6, depth: 4.2, amp: 2, period: 4.2, surf: "ice" });
        b.hop(6.8, { kind: "magic", w: 4.6, depth: 4.2, amp: -2, period: 4.2, surf: "ice", items: ["star"] });
        b.gap(5);
        b.road(14, { w: 7, turn: -30 }, (p) => {
          p.check(1.5);
          p.spring(11.5, 0, 13.5);
        });
        b.gap(2.6, { dy: 3 });
        b.road(5, { w: 8 });
        b.goalHere();
      },
    },
    {
      name: "마지막 대형 배달",
      goal: "왕국 전체가 기다리는 선물! 모든 기술을 써요",
      packs: ["big", "normal", "light"],
      extra: 26,
      build(b) {
        b.road(12, { w: 9 }, (p) => {
          p.tip(1, "마지막 배달이에요! 세 개를 모두 지켜요", "");
          p.item("shield", 7, 0);
        });
        b.road(22, { w: 7, surf: "ice", turn: 26, dy: -2 }, (p) => {
          p.snowman(7, -1.8);
          p.snowman(12, 1.8);
          p.fish(3, 0, 7, 2.6);
          p.seal(17, 0, { amp: 2.2, period: 4 });
        });
        b.hop(5.2, { kind: "magic", w: 5.4, depth: 4.6, amp: 2, period: 5.2, surf: "ice" });
        b.gap(5);
        b.road(9, { w: 8 }, (p) => {
          p.check(1.5);
          p.item("bubble", 6, 0);
        });
        for (let i = 0; i < 4; i += 1) b.hop(i === 0 ? 3.6 : 4.8, { kind: "vanish", w: 6.6, depth: 4.2, surf: "ice", period: 4.4, duty: 0.7, phase: -i * 0.12 });
        b.gap(3.6);
        b.road(16, { w: 7, turn: -28 }, (p) => {
          p.check(1.5);
          p.windmill(6, 0, { hub: 3.2, blade: 3.1, blades: 2, speed: 1 });
          p.icicle(12, 0);
        });
        b.road(5, { w: 6 }, (p) => p.vent(3.2, 0, { r: 1.8, power: 10, height: 5.6, period: 3.4, duty: 0.62 }));
        b.gap(2.4, { dy: 3 });
        b.road(9, { w: 8 }, (p) => {
          p.check(2);
          p.star(6, 2.8);
        });
        const p0 = b.road(12, { w: 7 }, (p) => p.tip(4, "쿠르릉… 또 왔어요! 달려요!", ""));
        p0.chaser(0, 11, { r: 2.1, speed: 5.1, after: 5 });
        const ch = lastObj(b);
        b.road(18, { w: 6.4, surf: "ice", dy: -2.6, turn: 28 }, (p) => {
          p.fish(3, 0, 7, 2);
          p.pillar(9, 1.5, 0.6, 3);
        });
        b.bridge(12, { w: 3.8, delay: 0.75 });
        const p1 = b.road(16, { w: 7, turn: -26 }, (p) => {
          p.check(1);
          p.fish(3, 0, 5, 2.4);
        });
        extend(ch, p1, 12);
        b.road(14, { w: 10, surf: "ice" }, (p) => {
          p.check(1);
          p.star(8, -3.6);
          p.fox(9, 3.6, { trig: 7 });
          p.fish(3, 0, 6, 1.8);
        });
        b.goalHere({ w: 14, len: 14 });
      },
    },
  ],
];

export const STAGE_COUNT = WORLD_STAGES.reduce((a, l) => a + l.length, 0);
export const worldStages = (w) => WORLD_STAGES[w];
export const stageId = (w, s) => WORLD_STAGES.slice(0, w).reduce((a, l) => a + l.length, 0) + s;
export function fromId(id) {
  let k = id;
  for (let w = 0; w < WORLD_STAGES.length; w += 1) {
    if (k < WORLD_STAGES[w].length) return { w, s: k };
    k -= WORLD_STAGES[w].length;
  }
  return { w: WORLD_STAGES.length - 1, s: WORLD_STAGES[WORLD_STAGES.length - 1].length - 1 };
}

/** 스테이지 자료 → 실제 코스 */
export function makeCourse(w, s) {
  const def = WORLD_STAGES[w][s];
  const b = new Builder(WORLDS[w]);
  def.build(b);
  if (!b.goal) throw new Error(`${w}-${s}: 도착 지점 없음`);
  const hops = b.route.length;
  const len = b.c.s;
  const waits = b.pads.filter((p) => p.moved).length * 2.2 + b.pads.filter((p) => p.kind === "vanish").length * 1.2 + b.objs.filter((o) => o.type === "windmill" || o.type === "avalanche").length * 2 + b.objs.filter((o) => o.type === "vent" || o.type === "geyser").length * 3;
  const speed = def.packs.includes("heavy") || def.packs.includes("big") ? 3.5 : 4.3;
  const par = Math.round((len / speed + hops * 0.5 + waits + (def.extra || 0)) * (def.express ? 0.92 : 1)) + 3;
  const limit = def.express ? Math.round(par * 1.3) : Math.round(par * 2.2 + 15);
  return b.finish({ name: def.name, goalText: def.goal, packs: def.packs, express: Boolean(def.express), par, limit, worldIndex: w, stageIndex: s, label: `${w + 1}-${s + 1}` });
}
