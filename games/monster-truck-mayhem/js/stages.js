/* 스테이지 설계. 투어 35 + 월드별 보스 챌린지 5 + 토탈 디스트럭션 5 + 스턴트 마스터 5 + 타임 어택 5 */
import { Builder, MAT } from "./level.js?v=2";

export const THEMES = {
  scrap: { id: "scrap", mat: MAT.DIRT, rough: 0.14, outer: 3.4 },
  city: { id: "city", mat: MAT.ASPHALT, rough: 0.05, outer: 1.2 },
  volcano: { id: "volcano", mat: MAT.ROCK, rough: 0.2, outer: 5.5 },
  frozen: { id: "frozen", mat: MAT.SNOW, rough: 0.14, outer: 4.2 },
  stadium: { id: "stadium", mat: MAT.DIRT, rough: 0.08, outer: 1.8 },
};

/* ---------- 놓기 도구 ---------- */
/** 길을 가로지르는 줄. n 개를 gap 간격으로 */
function row(b, type, s, { n = 5, gap = 3, d0 = 0, yaw = 0, tag } = {}) {
  const list = [];
  for (let i = 0; i < n; i += 1) list.push(b.put(type, s, d0 + (i - (n - 1) / 2) * gap, { yaw, tag }));
  return list;
}
/** 길을 따라 늘어선 줄 */
function line(b, type, s, n, every, d = 0, o = {}) {
  for (let i = 0; i < n; i += 1) b.put(type, s + (i * every) / b.K, d, o);
}
/** 쌓기: 받침이 사라지면 떨어진다 */
function tower(b, type, s, d, levels, o = {}) {
  let on = -1;
  let last = -1;
  for (let i = 0; i < levels; i += 1) {
    last = b.put(type, s, d, { ...o, on, yaw: (o.yaw || 0) + (i % 2 ? 0.12 : -0.08) });
    on = last;
  }
  return last;
}
/** 상자 벽: 아래 줄 + 윗줄 */
function crateWall(b, s, { n = 7, levels = 2, type = "crate", d0 = 0, gap = 1.75 } = {}) {
  for (let i = 0; i < n; i += 1) {
    tower(b, type, s, d0 + (i - (n - 1) / 2) * gap, 1 + (i + levels) % levels + (levels > 1 ? 0 : 0));
  }
}
function fenceLine(b, s, { n = 5, d0 = 0 } = {}) {
  row(b, "fence", s, { n, gap: 5.1, d0 });
}
/** 폐차 줄: 가로로 나란히 (밟고 지나가기 좋게) */
function carRow(b, s, { n = 4, gap = 2.5, d0 = 0, tag } = {}) {
  row(b, "wreck", s, { n, gap, d0, tag });
}
/** 폐차 줄: 세로로 나란히 */
function carLine(b, s, n, d = 0, every = 5) {
  line(b, "wreck", s, n, every, d);
}
function booms(b, s, d, n = 4, r = 2.2, tag) {
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    b.put("boom", s + (Math.sin(a) * r) / b.K, d + Math.cos(a) * r, { tag });
  }
}
function drums(b, s, d, n = 5) {
  for (let i = 0; i < n; i += 1) b.put("drum", s + (((i * 7) % 5) - 2) / b.K, d + ((i * 3) % 5) - 2);
}
/** 점프대 + 착지 자리의 차들 */
function jumpOverCars(b, s, { h = 3.6, l = 13, w = 10, cars = 4, gap = 2.5, dist = 16, d0 = 0 } = {}) {
  b.ramp(s, d0, { h, l, w });
  carRow(b, s + (l + dist) / b.K, { n: cars, gap, d0 });
}
function coneLane(b, s, n, every, d) {
  line(b, "cone", s, n, every, d);
  line(b, "cone", s, n, every, -d);
}
/** 컨테이너 쌓기 */
function containers(b, s, d, n = 2, levels = 2, yaw = 0) {
  for (let i = 0; i < n; i += 1) tower(b, "container", s, d + i * 3, levels, { yaw });
}

/* ---------- 경기장 도구 ---------- */
function scatter(b, type, n, rx, rz, seed, { clear = 16 } = {}) {
  let v = seed * 9301 + 49297;
  const rnd = () => {
    v = (v * 9301 + 49297) % 233280;
    return v / 233280;
  };
  for (let i = 0; i < n; i += 1) {
    let x = (rnd() * 2 - 1) * (rx - 8);
    let z = (rnd() * 2 - 1) * (rz - 8);
    if (Math.abs(x) < clear && z < -rz + 26) z += 30;
    b.putAt(type, x, z, { yaw: rnd() * 3.14 });
  }
}
function clusterAt(b, type, x, z, n, r, seed = 1) {
  for (let i = 0; i < n; i += 1) {
    const a = i * 2.4 + seed;
    const q = r * Math.sqrt((i + 0.5) / n);
    b.putAt(type, x + Math.cos(a) * q, z + Math.sin(a) * q, { yaw: a });
  }
}
function towerAt(b, type, x, z, levels, o = {}) {
  let on = -1;
  for (let i = 0; i < levels; i += 1) on = b.putAt(type, x, z, { ...o, on, yaw: (o.yaw || 0) + i * 0.1 });
  return on;
}
function crateBlockAt(b, x, z, nx, nz, levels, type = "crate", gap = 1.75) {
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < nz; j += 1) towerAt(b, type, x + (i - (nx - 1) / 2) * gap, z + (j - (nz - 1) / 2) * gap, levels);
  }
}

/* ---------- MAYHEM TOUR ---------- */
const m = {
  finish: { k: "finish" },
  time: (t) => ({ k: "time", t }),
  destroy: (n, type) => ({ k: "destroy", n, type }),
  score: (n) => ({ k: "score", n }),
  stunts: (n) => ({ k: "stunts", n }),
  over: (n) => ({ k: "over", n }),
  chain: (n) => ({ k: "chain", n }),
  combo: (n) => ({ k: "combo", n }),
  damage: (max) => ({ k: "damage", max }),
  air: (t) => ({ k: "air", t }),
  zone: { k: "zone" },
  collapse: { k: "collapse" },
  push: { k: "push" },
};

const TOUR = [];
const add = (world, name, desc, time, main, bonus, theme, opts, build) => {
  TOUR.push({ mode: "tour", world, name, desc, time, main, bonus, theme, opts, build });
};

/* WORLD 1 · SCRAP YARD — 기본 물리 배우기 */
add(0, "첫 시동", "가속하고, 상자를 부수며 결승선까지!", 60, m.finish, [m.destroy(10), m.time(32)], "scrap", { w: 30 }, (b) => {
  b.go(50);
  crateWall(b, 40, { n: 9, levels: 1 });
  b.go(50, { turn: 18 });
  fenceLine(b, 80, { n: 6 });
  b.go(40);
  crateWall(b, 125, { n: 7, levels: 2 });
  b.go(40, { turn: -18 });
  row(b, "cone", 155, { n: 9, gap: 3 });
  b.go(50);
  fenceLine(b, 205, { n: 6 });
  b.go(40);
});
add(0, "폐차를 밟아라", "폐차 위로 달리면 납작해져요!", 60, m.finish, [m.destroy(8, "wreck"), m.combo(6)], "scrap", { w: 28 }, (b) => {
  b.go(55);
  carRow(b, 45, { n: 5, gap: 4.4 });
  b.go(45, { turn: -20 });
  carLine(b, 70, 4, -5);
  carLine(b, 70, 4, 5);
  b.go(50);
  row(b, "tires", 115, { n: 6, gap: 4 });
  carRow(b, 138, { n: 6, gap: 4 });
  b.go(40, { turn: 22 });
  b.go(40);
});
add(0, "첫 점프", "점프대를 밟고 날아 보세요. 공중에서 ◀▶ 로 돌 수 있어요.", 70, m.finish, [m.stunts(2), m.air(1.4)], "scrap", { w: 30 }, (b) => {
  b.go(50);
  b.ramp(32, 0, { h: 2.8, l: 13, w: 12 });
  crateWall(b, 68, { n: 7, levels: 1 });
  b.go(40);
  b.go(40, { turn: 15 });
  b.ramp(100, 0, { h: 3.6, l: 14, w: 12 });
  carRow(b, 131, { n: 5, gap: 3.2 });
  b.go(50);
  b.ramp(170, 0, { h: 4.2, l: 15, w: 12 });
  b.go(50, { turn: -15 });
  fenceLine(b, 214, { n: 6 });
  b.go(30);
});
add(0, "쾅! 폭발 드럼통", "빨간 드럼통은 터져요. 연쇄 폭발을 일으켜요!", 70, m.finish, [m.chain(4), m.destroy(18)], "scrap", { w: 28 }, (b) => {
  b.go(60);
  booms(b, 40, 0, 4, 2);
  crateWall(b, 50, { n: 9, levels: 2 });
  b.go(50, { turn: 25 });
  line(b, "boom", 75, 6, 5, -4);
  line(b, "fence", 75, 6, 5, 6);
  b.go(50);
  booms(b, 130, 0, 6, 3);
  drums(b, 130, 8, 5);
  drums(b, 130, -8, 5);
  b.go(40, { turn: -25 });
  crateWall(b, 175, { n: 9, levels: 2 });
  b.go(30);
});
add(0, "고철 언덕", "오르락내리락! 서스펜션이 몸으로 느껴져요.", 75, m.finish, [m.time(38), m.damage(25)], "scrap", { w: 26 }, (b) => {
  b.go(40);
  b.go(40, { dy: 8 });
  b.go(30, { dy: -5, turn: 20 });
  b.bumps(90, 40, { h: 0.55 });
  b.go(50);
  b.go(30, { dy: 6 });
  b.go(40, { dy: -9, turn: -30 });
  row(b, "drum", 170, { n: 6, gap: 3.5 });
  b.go(40);
  fenceLine(b, 225, { n: 5 });
  b.go(25);
});
add(0, "타이어 미로", "타이어 벽을 뚫고 곡선을 빠져나가요.", 75, m.finish, [m.destroy(14), m.time(40)], "scrap", { w: 24 }, (b) => {
  b.go(40);
  b.put("tirewall", 34, -5);
  b.put("tirewall", 34, 5);
  b.go(40, { turn: 45 });
  b.put("tirewall", 62, 0);
  line(b, "tires", 55, 4, 5, 8);
  b.go(40, { turn: -55 });
  row(b, "tirewall", 95, { n: 3, gap: 6.5 });
  b.go(40, { turn: 40 });
  line(b, "tires", 125, 5, 5, -7);
  b.put("tirewall", 150, 0);
  b.go(40, { turn: -30 });
  row(b, "barrier", 178, { n: 6, gap: 3.4 });
  b.go(30);
});
add(0, "폐차 뛰어넘기", "점프대로 차들을 뛰어넘어요. 위에 착지해도 좋아요!", 80, m.finish, [m.over(4), m.stunts(3)], "scrap", { w: 30 }, (b) => {
  b.go(55);
  jumpOverCars(b, 28, { h: 3.8, l: 14, cars: 5, gap: 2.6, dist: 12 });
  b.go(60);
  b.ramp(94, 0, { h: 4.4, l: 15, w: 12 });
  carLine(b, 112, 3, 0);
  b.go(30, { turn: 30 });
  b.go(50);
  b.ramp(155, 0, { h: 5, l: 16, w: 13 });
  carRow(b, 182, { n: 6, gap: 2.6 });
  carRow(b, 190, { n: 6, gap: 2.6 });
  b.go(50);
  booms(b, 215, 0, 4, 2.4);
  b.go(30);
});
add(0, "고철장 대소동", "지금까지 배운 것을 모두! 부수고 뛰어넘어요.", 90, m.finish, [m.score(6000), m.combo(10)], "scrap", { w: 30 }, (b) => {
  b.go(60);
  crateWall(b, 30, { n: 10, levels: 2 });
  booms(b, 50, -7, 4);
  carRow(b, 50, { n: 3, gap: 3, d0: 6 });
  b.go(50, { turn: 25 });
  b.ramp(80, 0, { h: 4, l: 14, w: 12 });
  carRow(b, 110, { n: 5, gap: 3 });
  b.go(60);
  containers(b, 145, -9, 1, 2);
  containers(b, 145, 8, 1, 2);
  fenceLine(b, 155, { n: 6 });
  b.go(50, { turn: -25 });
  row(b, "concrete", 190, { n: 4, gap: 5 });
  b.go(30);
  crateWall(b, 215, { n: 11, levels: 3 });
  b.go(30);
});

/* WORLD 2 · JUNK CITY — 좁은 길과 경로 선택 */
add(1, "장난감 도시 입성", "좁은 도로! 간판과 유리를 부수며 달려요.", 70, m.finish, [m.destroy(12), m.time(36)], "city", { w: 18 }, (b) => {
  b.go(60);
  b.put("sign", 35, 0);
  b.go(40, { turn: 40 });
  row(b, "glass", 75, { n: 3, gap: 4.4 });
  b.go(50);
  line(b, "barrier", 105, 5, 6, -5);
  line(b, "barrier", 105, 5, 6, 5);
  b.go(40, { turn: -40 });
  b.put("sign", 165, 0);
  row(b, "glass", 180, { n: 4, gap: 4.2 });
  b.go(50);
});
add(1, "유리 거리", "유리 패널이 쨍그랑! 콤보를 이어요.", 70, m.finish, [m.destroy(14, "glass"), m.combo(12)], "city", { w: 20 }, (b) => {
  b.go(50);
  for (let i = 0; i < 6; i += 1) row(b, "glass", 26 + i * 12, { n: 4, gap: 4.4 });
  b.go(50, { turn: -30 });
  b.go(50);
  for (let i = 0; i < 6; i += 1) b.put("glass", 110 + i * 8, i % 2 ? 4 : -4);
  b.go(40, { turn: 35 });
  row(b, "glass", 170, { n: 4, gap: 4.4 });
  b.go(40);
});
add(1, "무너지는 다리", "다리는 밟으면 무너져요. 멈추지 말고 달려요!", 80, m.finish, [m.time(38), m.damage(20)], "city", { w: 18 }, (b) => {
  b.go(50);
  b.gap(52, 26, { kind: "void", depth: 16 });
  b.bridge(52, 26, { w: 9 });
  b.go(40);
  b.go(50, { turn: 30 });
  row(b, "barrier", 108, { n: 4, gap: 4 });
  b.gap(140, 22, { kind: "void", depth: 16 });
  b.bridge(140, 22, { w: 8 });
  b.go(60);
  b.go(40, { turn: -30 });
  b.go(30);
  b.jumpGap(190, 0, { h: 3.2, l: 16, w: 16 }, 16, { kind: "void", depth: 16 });
  b.go(30);
});
add(1, "컨테이너 항구", "컨테이너를 밀어 넘어뜨려요. 부스터로 세게!", 85, m.finish, [m.destroy(4, "container"), m.score(6000)], "city", { w: 24 }, (b) => {
  b.go(60);
  containers(b, 40, -6, 1, 2, Math.PI / 2);
  containers(b, 40, 6, 1, 2, Math.PI / 2);
  b.pad(22, 0);
  b.go(50, { turn: 25 });
  crateWall(b, 85, { n: 8, levels: 2 });
  b.pad(98, 0);
  tower(b, "container", 118, 0, 3);
  b.go(50);
  b.go(40, { turn: -25 });
  b.pad(160, 5);
  tower(b, "container", 180, 5, 2);
  tower(b, "container", 180, -5, 2);
  booms(b, 180, 0, 3, 1.4);
  b.go(40);
});
add(1, "주차장 대소동", "줄지어 선 차들을 납작하게!", 75, m.finish, [m.destroy(14, "wreck"), m.stunts(2)], "city", { w: 26 }, (b) => {
  b.go(40);
  for (let i = 0; i < 4; i += 1) carRow(b, 20 + i * 7, { n: 5, gap: 4.6 });
  b.go(40);
  b.ramp(72, 0, { h: 3.8, l: 14, w: 10 });
  for (let i = 0; i < 3; i += 1) carRow(b, 100 + i * 6.5, { n: 5, gap: 4.6 });
  b.go(40, { turn: 45 });
  b.go(40);
  carLine(b, 135, 5, -7);
  carLine(b, 135, 5, 7);
  b.go(30);
});
add(1, "빌딩 사이 점프", "끊어진 길을 건너요. 충분히 속도를 내요!", 85, m.finish, [m.time(42), m.air(2.2)], "city", { w: 20 }, (b) => {
  b.go(55);
  b.jumpGap(38, 0, { h: 3.8, l: 16, w: 16 }, 18, { kind: "void", depth: 16 });
  b.go(50);
  b.put("sign", 88, 0);
  b.go(40, { turn: 35 });
  b.jumpGap(128, 0, { h: 4.2, l: 16, w: 16 }, 22, { kind: "void", depth: 16 });
  b.go(50);
  row(b, "glass", 180, { n: 3, gap: 5 });
  b.go(30);
});
add(1, "도심 대질주", "좁은 골목을 빠르게. 샛길은 부숴야 열려요.", 90, m.finish, [m.time(44), m.destroy(16)], "city", { w: 18 }, (b) => {
  b.go(50);
  b.go(40, { turn: 60 });
  b.go(40);
  b.put("sign", 72, 0);
  b.go(40, { turn: -70 });
  row(b, "barrier", 95, { n: 4, gap: 3.5 });
  b.go(30);
  line(b, "drum", 135, 5, 4, 5);
  b.go(40, { turn: 40 });
  b.put("sign", 180, 0);
  b.go(40);
});

/* WORLD 3 · VOLCANO RUSH — 속도와 점프 */
add(2, "뜨거운 길", "용암에 빠지면 뒤로 돌아가요. 점프로 넘어요!", 80, m.finish, [m.time(40), m.damage(25)], "volcano", { w: 26 }, (b) => {
  b.go(50);
  b.jumpGap(32, 0, { h: 3.2, l: 14, w: 22 }, 14, { kind: "lava", depth: 5 });
  b.go(50, { turn: 20 });
  b.put("rock", 80, -6);
  b.put("rock", 90, 6);
  b.go(40);
  b.jumpGap(132, 0, { h: 3.6, l: 14, w: 22 }, 16, { kind: "lava", depth: 5 });
  b.go(50, { turn: -20 });
  row(b, "rock", 180, { n: 3, gap: 8 });
  b.go(30);
});
add(2, "불꽃 분출구", "불기둥이 솟아요. 박자를 보고 지나가요.", 80, m.finish, [m.damage(15), m.destroy(8)], "volcano", { w: 22 }, (b) => {
  b.go(60);
  b.geyser(25, -6, { period: 2.6, on: 1, off: 0 });
  b.geyser(35, 6, { period: 2.6, on: 1, off: 1.3 });
  b.geyser(45, 0, { period: 2.6, on: 1, off: 0.6 });
  b.go(40, { turn: -30 });
  line(b, "boom", 75, 3, 8, 0);
  b.go(50);
  for (let i = 0; i < 5; i += 1) b.geyser(112 + i * 7, i % 2 ? 5 : -5, { period: 3, on: 1.1, off: i * 0.6 });
  crateWall(b, 150, { n: 9, levels: 1 });
  b.go(40, { turn: 25 });
  b.go(30);
});
add(2, "거대 점프대", "이제까지 중 가장 큰 점프! 공중에서 돌아 봐요.", 80, m.finish, [m.stunts(3), m.air(2.6)], "volcano", { w: 28 }, (b) => {
  b.go(60);
  b.ramp(40, 0, { h: 5.5, l: 18, w: 16 });
  b.go(60);
  carRow(b, 92, { n: 5, gap: 3 });
  b.go(30, { turn: 25 });
  b.jumpGap(142, 0, { h: 6.5, l: 20, w: 16 }, 22, { kind: "lava", depth: 5 });
  b.go(60);
  booms(b, 200, 0, 5, 3);
  b.go(30);
});
add(2, "화산석 지대", "크고 단단한 돌! 파괴력을 키우면 쉬워요.", 85, m.finish, [m.destroy(8, "rock"), m.combo(8)], "volcano", { w: 28 }, (b) => {
  b.go(50);
  row(b, "rock", 30, { n: 3, gap: 9 });
  b.go(50, { dy: 6 });
  row(b, "rock", 62, { n: 2, gap: 14 });
  b.pad(52, 0);
  b.go(50, { dy: -6, turn: 30 });
  b.bumps(105, 25, { h: 0.55 });
  b.go(50);
  row(b, "rock", 150, { n: 4, gap: 6.5 });
  booms(b, 165, 0, 4, 2);
  b.go(30, { turn: -25 });
  b.go(30);
});
add(2, "무너지는 용암 다리", "판자 다리 아래는 용암! 쉬지 말고 달려요.", 85, m.finish, [m.time(44), m.damage(20)], "volcano", { w: 18 }, (b) => {
  b.go(50);
  b.gap(52, 30, { kind: "lava", depth: 6 });
  b.bridge(52, 30, { w: 10 });
  b.go(50);
  b.go(30, { turn: 40 });
  b.geyser(118, 0, { period: 2.8, on: 1 });
  b.gap(135, 28, { kind: "lava", depth: 6 });
  b.bridge(135, 28, { w: 9 });
  b.go(50);
  b.go(30, { turn: -40 });
  b.jumpGap(190, 0, { h: 3.8, l: 14, w: 16 }, 16, { kind: "lava", depth: 6 });
  b.go(40);
});
add(2, "폭발의 계곡", "드럼통 사이로 달리며 연쇄 폭발을 일으켜요!", 85, m.finish, [m.chain(8), m.score(8000)], "volcano", { w: 26 }, (b) => {
  b.go(60);
  for (let i = 0; i < 8; i += 1) b.put("boom", 22 + i * 5, i % 2 ? 7 : -7);
  crateWall(b, 62, { n: 8, levels: 2 });
  b.go(50, { turn: 30 });
  for (let i = 0; i < 7; i += 1) b.put("boom", 75 + i * 5, 0);
  row(b, "drum", 95, { n: 6, gap: 3.6 });
  b.go(50);
  b.ramp(130, 0, { h: 4, l: 14, w: 12 });
  booms(b, 162, 0, 8, 4);
  carRow(b, 162, { n: 3, gap: 3 });
  b.go(50, { turn: -30 });
  b.go(30);
});
add(2, "화산 정상 질주", "오르막 끝의 대점프로 분화구를 넘어요!", 95, m.finish, [m.time(50), m.stunts(3)], "volcano", { w: 24 }, (b) => {
  b.go(40);
  b.go(70, { dy: 18, turn: 25 });
  b.pad(60, 0);
  row(b, "rock", 80, { n: 2, gap: 12 });
  b.go(40, { turn: -25 });
  b.jumpGap(136, 0, { h: 5.5, l: 18, w: 18 }, 24, { kind: "lava", depth: 7 });
  b.go(50, { dy: -6 });
  b.geyser(190, -6);
  b.geyser(190, 6, { off: 1.6 });
  b.go(60, { dy: -12, turn: 30 });
  b.go(30);
});

/* WORLD 4 · FROZEN WASTELAND — 미끄러운 물리 */
add(3, "미끄러운 첫걸음", "얼음에서는 미리 돌아요. 프로스트 바이트라면 더 쉬워요!", 80, m.finish, [m.time(42), m.damage(20)], "frozen", { w: 28 }, (b) => {
  b.go(40);
  b.go(50, { turn: 30 });
  b.ice(40, 50);
  b.go(40);
  row(b, "snowman", 100, { n: 5, gap: 5 });
  b.go(50, { turn: -40 });
  b.ice(130, 50);
  b.go(40);
  row(b, "snowpile", 195, { n: 4, gap: 6 });
  b.go(30);
});
add(3, "얼음 블록 공장", "얼음 블록을 와장창 깨요!", 80, m.finish, [m.destroy(10, "iceblock"), m.combo(8)], "frozen", { w: 26 }, (b) => {
  b.go(50);
  row(b, "iceblock", 30, { n: 4, gap: 5.6 });
  b.go(50, { turn: 25 });
  tower(b, "iceblock", 65, -6, 2);
  tower(b, "iceblock", 65, 6, 2);
  row(b, "snowman", 85, { n: 5, gap: 4.4 });
  b.go(50);
  b.ice(100, 40);
  row(b, "iceblock", 125, { n: 5, gap: 4.8 });
  b.go(40, { turn: -25 });
  row(b, "snowpile", 170, { n: 4, gap: 6 });
  b.go(30);
});
add(3, "눈사태!", "뒤에서 눈덩이가 굴러와요. 앞으로 달려요!", 85, m.finish, [m.time(40), m.damage(25)], "frozen", { w: 26 }, (b) => {
  b.go(30);
  b.go(60, { dy: -10 });
  for (let i = 0; i < 4; i += 1) {
    b.put("snowball", 72 + i * 6, -8 + i * 5, { tag: "ava1" });
  }
  b.trigger(20, "wake", { tag: "ava1", vz: 0, vx: 0, text: "눈사태다!" });
  b.go(60, { turn: 25, dy: -8 });
  for (let i = 0; i < 4; i += 1) b.put("snowball", 140 + i * 5, 8 - i * 5, { tag: "ava2" });
  b.trigger(110, "wake", { tag: "ava2" });
  row(b, "snowpile", 125, { n: 4, gap: 6 });
  b.go(50);
  b.go(30, { turn: -25 });
  b.go(30);
});
add(3, "빙판 점프", "빙판에서 뛰는 점프. 착지 후 미끄러짐을 조심해요.", 85, m.finish, [m.stunts(3), m.over(3)], "frozen", { w: 28 }, (b) => {
  b.go(50);
  b.ice(0, 50);
  b.ramp(28, 0, { h: 4, l: 15, w: 14 });
  carRow(b, 60, { n: 4, gap: 3 });
  b.go(50);
  b.ice(70, 45);
  b.go(30, { turn: 30 });
  b.ramp(118, 0, { h: 4.8, l: 16, w: 14 });
  carRow(b, 150, { n: 5, gap: 3 });
  b.go(50);
  b.ice(155, 30);
  row(b, "iceblock", 185, { n: 4, gap: 5 });
  b.go(30);
});
add(3, "얼어붙은 도로", "눈 덮인 차들을 밟고 빙판 위를 달려요.", 85, m.finish, [m.destroy(10, "wreck"), m.time(46)], "frozen", { w: 26 }, (b) => {
  b.go(40);
  carLine(b, 18, 4, -5);
  carLine(b, 18, 4, 5);
  b.go(50, { turn: -30 });
  b.ice(40, 50);
  carRow(b, 72, { n: 5, gap: 4 });
  b.go(40);
  row(b, "snowman", 100, { n: 5, gap: 4 });
  b.go(50, { turn: 40 });
  b.ice(130, 40);
  carRow(b, 160, { n: 5, gap: 4 });
  b.go(30);
});
add(3, "얼음 성채", "거대한 얼음 구조물을 무너뜨리며 지나가요.", 90, m.finish, [m.destroy(14), m.score(7000)], "frozen", { w: 28 }, (b) => {
  b.go(50);
  tower(b, "iceblock", 35, -8, 3);
  tower(b, "iceblock", 35, 8, 3);
  row(b, "iceblock", 40, { n: 2, gap: 5 });
  b.go(40, { turn: 25 });
  b.pad(70, 0);
  tower(b, "iceblock", 88, -3, 3);
  tower(b, "iceblock", 88, 3, 3);
  b.go(50);
  booms(b, 118, 0, 4, 2.4);
  tower(b, "iceblock", 130, -8, 2);
  tower(b, "iceblock", 130, 8, 2);
  b.go(40, { turn: -25 });
  row(b, "iceblock", 170, { n: 5, gap: 5 });
  b.go(40);
});
add(3, "눈보라 대회전", "연속 곡선과 눈사태. 끝까지 집중해요!", 95, m.finish, [m.time(52), m.damage(30)], "frozen", { w: 24 }, (b) => {
  b.go(40);
  b.go(40, { turn: 60 });
  b.ice(40, 40);
  b.go(30);
  b.go(40, { turn: -70 });
  b.ice(110, 40);
  b.put("snowball", 150, 0, { tag: "ava3" });
  b.put("snowball", 157, -7, { tag: "ava3" });
  b.put("snowball", 157, 7, { tag: "ava3" });
  b.trigger(115, "wake", { tag: "ava3", text: "눈덩이 조심!" });
  b.go(40, { dy: -8 });
  b.go(40, { turn: 60 });
  b.ice(190, 40);
  row(b, "iceblock", 225, { n: 4, gap: 5 });
  b.go(40);
});

/* WORLD 5 · MEGA STADIUM — 모든 기술 */
add(4, "스타디움 데뷔", "관중이 지켜봐요. 멋진 첫 판!", 85, m.finish, [m.score(9000), m.combo(12)], "stadium", { w: 32 }, (b) => {
  b.go(50);
  carRow(b, 30, { n: 7, gap: 3.6 });
  b.go(40);
  b.ramp(62, 0, { h: 4.6, l: 15, w: 14 });
  crateWall(b, 96, { n: 13, levels: 2 });
  b.go(40, { turn: 25 });
  booms(b, 125, 0, 6, 3.2);
  b.go(40);
  b.ramp(145, 0, { h: 5, l: 16, w: 14 });
  carRow(b, 178, { n: 6, gap: 3.2 });
  carRow(b, 186, { n: 6, gap: 3.2 });
  b.go(40, { turn: -25 });
  b.go(30);
});
add(4, "연쇄 폭발 장치", "폭발이 폭발을 불러요. 한 번에 터뜨려요!", 85, m.finish, [m.chain(12), m.destroy(30)], "stadium", { w: 30 }, (b) => {
  b.go(60);
  for (let i = 0; i < 6; i += 1) b.put("boom", 25 + i * 6, -9 + i * 3.6);
  crateWall(b, 58, { n: 11, levels: 2 });
  b.go(50);
  for (let i = 0; i < 6; i += 1) b.put("boom", 78 + i * 6, 9 - i * 3.6);
  containers(b, 100, -9, 1, 2);
  containers(b, 100, 9, 1, 2);
  b.go(40, { turn: 30 });
  booms(b, 130, 0, 8, 5);
  booms(b, 130, 0, 4, 2);
  crateWall(b, 142, { n: 11, levels: 2 });
  b.go(40);
  b.go(30);
});
add(4, "삼단 점프", "세 번 연속 대점프. 공중 기술을 뽐내요.", 90, m.finish, [{ k: "stuntScore", n: 2500 }, m.air(2.6)], "stadium", { w: 30 }, (b) => {
  b.go(50);
  b.ramp(34, 0, { h: 5, l: 16, w: 16 });
  b.go(55);
  carRow(b, 68, { n: 7, gap: 3 });
  b.ramp(88, 0, { h: 5.8, l: 18, w: 16 });
  b.go(60);
  carRow(b, 124, { n: 7, gap: 3 });
  carRow(b, 131, { n: 7, gap: 3 });
  b.ramp(146, 0, { h: 6.6, l: 20, w: 16 });
  b.go(60);
  crateWall(b, 195, { n: 13, levels: 3 });
  b.go(30);
});
add(4, "철골 숲", "거대한 금속 구조물 사이를 뚫어요!", 90, m.finish, [m.destroy(6, "girder"), m.combo(10)], "stadium", { w: 28 }, (b) => {
  b.go(50);
  row(b, "girder", 34, { n: 2, gap: 12 });
  b.go(40, { turn: 25 });
  b.pad(58, 0);
  b.put("girder", 80, 0);
  b.put("container", 86, -9);
  b.put("container", 86, 9);
  b.go(50);
  booms(b, 108, 0, 4, 2);
  row(b, "girder", 112, { n: 3, gap: 8.6 });
  b.go(40, { turn: -25 });
  row(b, "concrete", 150, { n: 5, gap: 5 });
  b.go(40);
});
add(4, "피해 없이 완주", "조심조심, 그러나 빠르게. 피해를 최소로!", 90, m.finish, [m.damage(10), m.time(48)], "stadium", { w: 22 }, (b) => {
  b.go(40);
  line(b, "concrete", 22, 3, 7, -6);
  b.go(40, { turn: 35 });
  line(b, "concrete", 50, 3, 8, 6);
  b.go(40);
  b.jumpGap(100, 0, { h: 3.6, l: 14, w: 14 }, 14, { kind: "void", depth: 14 });
  b.go(40, { turn: -35 });
  line(b, "container", 140, 2, 12, -6);
  b.go(40);
  line(b, "concrete", 180, 3, 8, 6);
  b.go(30, { turn: 20 });
  b.go(20);
});
add(4, "마지막 종합 챌린지", "부수고, 날고, 터뜨리고! 결승전입니다.", 110, m.finish, [m.score(16000), m.combo(16)], "stadium", { w: 32 }, (b) => {
  b.go(50);
  crateWall(b, 25, { n: 15, levels: 2 });
  carRow(b, 42, { n: 8, gap: 3.4 });
  b.go(50, { turn: 25 });
  b.ramp(72, 0, { h: 5.5, l: 18, w: 16 });
  booms(b, 108, 0, 8, 5);
  b.go(50);
  containers(b, 135, -10, 1, 3);
  containers(b, 135, 7, 1, 3);
  b.go(40, { turn: -25 });
  row(b, "girder", 168, { n: 3, gap: 9 });
  b.pad(155, 0);
  b.go(50);
  b.jumpGap(205, 0, { h: 6.5, l: 20, w: 16 }, 20, { kind: "void", depth: 16 });
  b.go(50);
  crateWall(b, 262, { n: 15, levels: 3 });
  carRow(b, 272, { n: 8, gap: 3.4 });
  b.go(30);
});

/* ---------- 코스 늘리기: 판 끝에 구간을 이어 붙여 길고 다채롭게 ---------- */
const KITS = [
  { soft: ["crate", "fence", "barrier"], low: "tires", wall: "tirewall", hard: "concrete", gap: "void" },
  { soft: ["glass", "barrier", "sign"], low: "barrier", wall: "concrete", hard: "container", gap: "void" },
  { soft: ["crate", "drum", "fence"], low: "drum", wall: "rock", hard: "rock", gap: "lava" },
  { soft: ["snowman", "snowpile", "iceblock"], low: "snowpile", wall: "iceblock", hard: "iceblock", gap: "void" },
  { soft: ["crate", "barrier", "fence"], low: "tires", wall: "tirewall", hard: "concrete", gap: "void" },
];
const here = (b) => b.s / b.K;
const SEC = {
  /** 크게 휘는 S자: 안쪽 선을 따라 부술 것이 놓인다 */
  sweep(b, kit, f, a = 55) {
    const s = here(b);
    b.go(32, { turn: a * f });
    b.go(46, { turn: -2 * a * f });
    b.go(32, { turn: a * f });
    line(b, kit.soft[0], s + 14, 4, 9, 4 * f);
    b.put("cone", s + 40, 0);
    line(b, kit.low, s + 52, 3, 8, -5 * f);
    line(b, kit.soft[1], s + 86, 3, 9, 4 * f);
  },
  /** 빠른 좌우 연속: 폭이 좁아진다 */
  chicane(b, kit, f) {
    const s = here(b);
    const w0 = b.w;
    b.go(18, { turn: 42 * f, w: Math.max(16, w0 - 8) });
    b.go(22, { turn: -84 * f });
    b.go(22, { turn: 84 * f });
    b.go(18, { turn: -42 * f, w: w0 });
    b.put(kit.low, s + 18, -5 * f);
    b.put(kit.low, s + 40, 5 * f);
    b.put(kit.low, s + 62, -5 * f);
    line(b, "cone", s + 28, 3, 6, 0);
  },
  /** 큰 언덕: 꼭대기에서 뜨고, 넘어가면 물체가 기다린다 */
  hill(b, kit, f, h = 9) {
    const s = here(b);
    b.go(30, { dy: h });
    b.go(12);
    b.hump(s + 36, 0, { h: 1.3, l: 14, w: b.w + 6 });
    b.go(30, { dy: -h, turn: 24 * f });
    row(b, kit.soft[0], s + 62, { n: 5, gap: 3.6 });
    b.go(10, { turn: -24 * f });
  },
  /** 작은 언덕 여러 개: 통통 튄다 */
  roller(b, kit, f) {
    const s = here(b);
    for (let i = 0; i < 4; i += 1) {
      b.go(13, { dy: 3.4, turn: 6 * f });
      b.go(13, { dy: -3.4, turn: -6 * f });
    }
    b.put(kit.low, s + 26, 5 * f);
    b.put(kit.low, s + 52, -5 * f);
    b.put(kit.low, s + 78, 5 * f);
  },
  /** 부수는 골목: 부스터 판 + 줄지은 물체 */
  alley(b, kit, f) {
    const s = here(b);
    b.pad(s + 5, 0);
    b.go(62);
    row(b, kit.soft[0], s + 18, { n: 6, gap: 3.4 });
    row(b, kit.soft[1], s + 32, { n: 4, gap: 5 });
    booms(b, s + 44, 5 * f, 3, 1.6);
    row(b, kit.soft[0], s + 54, { n: 6, gap: 3.4, d0: -2 * f });
  },
  /** 차 벌판: 밟고 지나간다 */
  cars(b, kit, f) {
    const s = here(b);
    b.go(30, { turn: 18 * f });
    b.go(30, { turn: -18 * f });
    for (let i = 0; i < 3; i += 1) carRow(b, s + 12 + i * 15, { n: 5, gap: 4.4, d0: (i - 1) * 2 * f });
  },
  /** 점프대 + 뛰어넘을 차 + 착지 뒤 벽 */
  jump(b, kit, f, h = 4.2) {
    const s = here(b);
    b.go(66);
    b.ramp(s + 6, 0, { h, l: 14, w: 14 });
    carRow(b, s + 26, { n: 5, gap: 3 });
    row(b, kit.soft[0], s + 54, { n: 7, gap: 3 });
  },
  /** 끊어진 길 점프 */
  gapJump(b, kit, f, h = 3.8) {
    const s = here(b);
    b.go(62);
    b.jumpGap(s + 6, 0, { h, l: 15, w: 18 }, 16, { kind: kit.gap, depth: kit.gap === "lava" ? 6 : 14 });
    b.put("cone", s + 44, -4);
    b.put("cone", s + 44, 4);
  },
  /** 두 갈래: 가운데 벽, 왼쪽은 폭탄 · 오른쪽은 차 */
  split(b, kit, f) {
    const s = here(b);
    const w0 = b.w;
    b.go(12, { w: w0 + 12 });
    b.go(50);
    b.go(12, { w: w0 });
    line(b, kit.wall, s + 14, 5, 15, 0);
    booms(b, s + 26, -9 * f, 3, 1.6);
    b.pad(s + 16, 9 * f);
    carRow(b, s + 36, { n: 2, gap: 4, d0: 9 * f });
    carRow(b, s + 50, { n: 2, gap: 4, d0: 9 * f });
    booms(b, s + 50, -9 * f, 3, 1.6);
  },
  /** 좁은 문: 단단한 벽 사이로 빠져나간다 */
  gate(b, kit, f) {
    const s = here(b);
    const w0 = b.w;
    b.go(14, { w: Math.max(15, w0 - 10) });
    b.go(38, { turn: 22 * f });
    b.go(14, { w: w0, turn: -22 * f });
    row(b, kit.soft[1], s + 22, { n: 3, gap: 4 });
    row(b, kit.soft[1], s + 44, { n: 3, gap: 4 });
  },
  /** 폭발 드럼 길 */
  booms(b, kit, f) {
    const s = here(b);
    b.go(32, { turn: 26 * f });
    b.go(32, { turn: -26 * f });
    for (let i = 0; i < 7; i += 1) b.put("boom", s + 8 + i * 7, i % 2 ? 6 : -6);
    row(b, kit.soft[0], s + 58, { n: 6, gap: 3.4 });
  },
  /** 화산: 불기둥 사이 */
  geysers(b, kit, f) {
    const s = here(b);
    b.go(30, { turn: 20 * f });
    b.go(30, { turn: -20 * f });
    for (let i = 0; i < 6; i += 1) b.geyser(s + 8 + i * 8, i % 2 ? 6 : -6, { period: 3, on: 1, off: i * 0.5 });
  },
  /** 설원: 빙판 S자 */
  ice(b, kit, f, a = 45) {
    const s = here(b);
    SEC.sweep(b, kit, f, a);
    b.ice(s + 26, 100);
  },
  /** 설원: 눈덩이가 굴러온다 */
  snowballs(b, kit, f) {
    const s = here(b);
    const tag = `ava-${Math.round(s)}`;
    b.go(50, { dy: -7, turn: 16 * f });
    b.go(20, { turn: -16 * f });
    for (let i = 0; i < 4; i += 1) b.put("snowball", s + 44 + i * 5, -8 + i * 5, { tag });
    b.trigger(s + 8, "wake", { tag, text: "눈덩이 조심!" });
  },
  /** 무너지는 다리 */
  bridge(b, kit, f) {
    const s = here(b);
    b.go(58);
    b.gap(s + 10, 26, { kind: kit.gap, depth: kit.gap === "lava" ? 6 : 16 });
    b.bridge(s + 10, 26, { w: 10 });
  },
  /** 곧은 길에서 속도 내기 */
  dash(b, kit, f) {
    const s = here(b);
    b.pad(s + 8, 4 * f);
    b.pad(s + 34, -4 * f);
    b.go(60);
    line(b, "cone", s + 16, 4, 12, -8 * f);
  },
};
/** 판별 추가 구간 (투어 35판 순서). "이름:값" 은 각도 · 높이 */
const EXT = [
  ["sweep:38", "alley", "sweep:34"],
  ["cars", "sweep:44"],
  ["roller", "jump:3.8", "sweep:44"],
  ["sweep:46", "booms"],
  ["hill:8", "sweep:44", "roller", "hill:10"],
  ["chicane", "gate", "sweep:52"],
  ["jump:4.4", "sweep:48", "jump:5"],
  ["split", "chicane", "alley", "jump:4.6"],
  ["sweep:48", "gate"],
  ["alley", "sweep:52"],
  ["sweep:46", "bridge", "chicane"],
  ["split", "sweep:50"],
  ["cars", "chicane", "cars"],
  ["sweep:48", "gapJump:4", "gate"],
  ["chicane", "sweep:62", "chicane", "gate"],
  ["sweep:42", "gapJump:3.6"],
  ["geysers", "sweep:48", "geysers"],
  ["hill:10", "jump:5", "sweep:48"],
  ["alley", "chicane", "hill:9", "sweep:46"],
  ["sweep:46", "bridge", "gapJump:4"],
  ["booms", "split", "sweep:54"],
  ["hill:12", "geysers", "gapJump:4.4", "sweep:58"],
  ["ice:40", "alley"],
  ["alley", "ice:46"],
  ["snowballs", "sweep:46"],
  ["ice:42", "jump:4.4"],
  ["cars", "ice:50"],
  ["split", "sweep:50", "hill:9", "alley"],
  ["ice:56", "chicane", "snowballs", "ice:50"],
  ["sweep:52", "alley", "jump:5"],
  ["booms", "chicane", "split"],
  ["sweep:48", "roller", "jump:5.4", "sweep:50", "jump:6"],
  ["split", "chicane", "alley"],
  ["gate", "chicane", "sweep:58", "gate"],
  ["chicane", "split", "gapJump:4.6", "sweep:58", "jump:5.4"],
];
function extendCourse(b, world, list, seed) {
  const kit = KITS[world];
  list.forEach((item, i) => {
    const [name, v] = item.split(":");
    const f = (seed + i) % 2 ? 1 : -1;
    if (v) SEC[name](b, kit, f, Number(v));
    else SEC[name](b, kit, f);
  });
  b.go(24);
}
/** 코스 길이 (미터) */
function courseLength(def) {
  const b = new Builder(THEMES[def.theme], def.opts || {});
  def.build(b);
  return b.s;
}
/** 길어진 만큼 시간과 목표를 맞춘다 */
function fitToLength(def) {
  const len = courseLength(def);
  def.len = len;
  def.time = Math.max(def.time, Math.ceil(len / 9.5) + 20);
  const fit = (q) => {
    if (q.k === "time") return { ...q, t: Math.ceil(len / 15) };
    if (q.k === "score") return { ...q, n: Math.round((q.n * 1.5) / 100) * 100 };
    if (q.k === "destroy" && !q.type) return { ...q, n: Math.round(q.n * 1.4) };
    return q;
  };
  def.bonus = def.bonus.map(fit);
}
TOUR.forEach((d, i) => {
  const inner = d.build;
  d.build = (b) => {
    // 원래 구간의 커브도 조금 더 또렷하게
    b.turnK = 1.45;
    inner(b);
    b.turnK = 1;
    extendCourse(b, d.world, EXT[i], i);
  };
  fitToLength(d);
});

/* ---------- 월드별 보스 챌린지 ---------- */
const BOSS = [
  { mode: "boss", world: 0, name: "폐차 산 무너뜨리기", desc: "쌓아 올린 폐차 산의 아래를 쳐서 무너뜨려요!", time: 75, main: m.collapse, bonus: [{ k: "score", n: 9000 }, { k: "combo", n: 14 }], theme: "scrap", opts: {}, build(b) {
    b.arena(46, 62);
    // 피라미드: 아래가 빠지면 위가 떨어진다
    const base = [];
    for (let i = 0; i < 7; i += 1) base.push(b.putAt("wreck", (i - 3) * 2.6, 12, { tag: "boss" }));
    for (let i = 0; i < 6; i += 1) b.putAt("wreck", (i - 2.5) * 2.6, 12, { tag: "boss", on: base[i] });
    for (let i = 0; i < 7; i += 1) base.push(b.putAt("wreck", (i - 3) * 2.6, 20, { tag: "boss" }));
    for (let i = 0; i < 6; i += 1) b.putAt("wreck", (i - 2.5) * 2.6, 20, { tag: "boss", on: base[7 + i] });
    b.rampAt(-24, -30, 0.5, { h: 4, l: 14, w: 12 });
    b.rampAt(24, -30, -0.5, { h: 4, l: 14, w: 12 });
    clusterAt(b, "boom", 0, 2, 5, 3);
  } },
  { mode: "boss", world: 1, name: "철탑 붕괴", desc: "철탑의 네 다리를 부수면 전부 무너져요.", time: 80, main: m.collapse, bonus: [{ k: "score", n: 8000 }, { k: "damage", max: 50 }], theme: "city", opts: {}, build(b) {
    b.arena(44, 60);
    const legs = [
      [-7, 14],
      [7, 14],
      [-7, 30],
      [7, 30],
    ].map(([x, z]) => b.putAt("pillar", x, z, { tag: "boss" }));
    b.putAt("beam", 0, 14, { tag: "boss", on: legs[0] });
    b.putAt("beam", 0, 30, { tag: "boss", on: legs[2] });
    b.putAt("container", -7, 22, { tag: "boss", on: legs[1], lift: 1.2 });
    b.putAt("container", 7, 22, { tag: "boss", on: legs[3], lift: 1.2 });
    crateBlockAt(b, -22, 0, 3, 2, 2);
    crateBlockAt(b, 22, 0, 3, 2, 2);
    clusterAt(b, "boom", 0, -4, 4, 2);
    b.pads.push({ x: -14, z: -22, th: 0.3, r: 3.6 }, { x: 14, z: -22, th: -0.3, r: 3.6 });
  } },
  { mode: "boss", world: 2, name: "폭발 사슬", desc: "폭발로 금속 구조물 3개를 모두 날려요. 제한 시간 안에!", time: 70, main: m.collapse, bonus: [{ k: "chain", n: 10 }, { k: "combo", n: 14 }], theme: "volcano", opts: {}, build(b) {
    b.arena(48, 60);
    const spots = [
      [-20, 6],
      [20, 18],
      [0, 36],
    ];
    for (const [x, z] of spots) {
      b.putAt("girder", x, z, { tag: "boss" });
      clusterAt(b, "boom", x, z - 5, 6, 3.4, x);
      clusterAt(b, "boom", x + 5, z + 2, 4, 2, z);
    }
    // 드럼통 길로 이어 준다
    for (let i = 0; i < 6; i += 1) b.putAt("boom", -20 + i * 6.5, 8 + i * 1.6);
    for (let i = 0; i < 5; i += 1) b.putAt("boom", 18 - i * 3.6, 22 + i * 3);
    b.geysers.push({ x: -30, z: -10, period: 3, on: 1, off: 0, r: 2.6 }, { x: 30, z: -10, period: 3, on: 1, off: 1.5, r: 2.6 });
    b.pads.push({ x: 0, z: -26, th: 0, r: 3.6 });
  } },
  { mode: "boss", world: 3, name: "초대형 빙판 점프", desc: "거대한 점프대에서 날아 표시된 곳에 정확히 착지해요.", time: 60, main: m.zone, bonus: [{ k: "stunts", n: 1 }, { k: "air", t: 3.2 }], theme: "frozen", opts: { w: 32 }, build(b) {
    b.go(70);
    b.ice(30, 40);
    b.pad(35, 0);
    b.pad(50, 0);
    const lip = b.jumpGap(62, 0, { h: 8, l: 22, w: 18 }, 26, { kind: "void", depth: 18 });
    b.go(70);
    b.zone((lip + 46) / b.K, 0, 12);
    row(b, "iceblock", 128, { n: 5, gap: 5.5 });
    b.go(10);
  } },
  { mode: "boss", world: 4, name: "메가 덤프트럭 밀어내기", desc: "거대한 덤프트럭을 표시된 곳까지 밀어내요. 부스터로 세게 부딪혀요!", time: 90, main: m.push, bonus: [{ k: "score", n: 6000 }, { k: "combo", n: 6 }], theme: "stadium", opts: { w: 22 }, build(b) {
    b.openEnd();
    b.go(120);
    b.put("dumper", 34, 0, { tag: "dumper" });
    b.zone(88, 0, 12);
    crateWall(b, 18, { n: 7, levels: 1, gap: 2.4 });
    row(b, "boom", 50, { n: 4, gap: 4 });
    b.pad(14, -6);
    b.pad(14, 6);
    b.go(10);
  } },
];
for (const q of BOSS) q.bonus = q.bonus.filter(Boolean);

/* ---------- 경기장 꾸미기: 둔덕과 구조물로 평지를 깬다 ---------- */
function arenaDress(b, rx, rz, kit, seed = 1) {
  const spots = [
    [-0.62, -0.42, 0.5],
    [0.6, -0.5, -0.4],
    [-0.66, 0.5, 2.2],
    [0.62, 0.56, -2.1],
    [0.08, 0.72, 0.1],
  ];
  spots.forEach(([kx, kz, th], i) => {
    const h = 1.5 + ((i * 7 + seed) % 4) * 0.35;
    b.humpAt(kx * rx, kz * rz, th, { h, l: 16 + (i % 3) * 4, w: 18 + (i % 2) * 8 });
  });
  // 양옆 안쪽 벽: 돌아 들어가거나 뚫는다
  for (let i = 0; i < 4; i += 1) {
    b.putAt(kit.wall, -rx * 0.42, -rz * 0.14 + i * 7, { yaw: Math.PI / 2 });
    b.putAt(kit.wall, rx * 0.42, -rz * 0.14 + i * 7, { yaw: Math.PI / 2 });
  }
}

/* ---------- TOTAL DESTRUCTION: 넓은 경기장에서 전부 부수기 ---------- */
const DESTRUCTION = [
  { world: 0, name: "고철장 전면전", desc: "90초 동안 눈에 보이는 건 다 부숴요!", time: 90, target: 7000, theme: "scrap", build(b) {
    b.arena(58, 58);
    arenaDress(b, 58, 58, KITS[0], 1);
    scatter(b, "wreck", 22, 58, 58, 3);
    scatter(b, "boom", 14, 58, 58, 7);
    scatter(b, "tires", 14, 58, 58, 11);
    crateBlockAt(b, -28, 12, 4, 3, 2);
    crateBlockAt(b, 30, -8, 4, 3, 2);
    crateBlockAt(b, 0, 34, 5, 3, 2);
    towerAt(b, "container", -34, 36, 2);
    towerAt(b, "container", 36, 34, 2);
    b.rampAt(0, -4, 0, { h: 4, l: 14, w: 12 });
    b.rampAt(-30, -24, 0.8, { h: 3.4, l: 12, w: 10 });
    b.rampAt(30, 16, -2.4, { h: 3.4, l: 12, w: 10 });
  } },
  { world: 1, name: "도시 대청소", desc: "유리 · 간판 · 차 · 컨테이너까지 전부!", time: 90, target: 9000, theme: "city", build(b) {
    b.arena(56, 56);
    arenaDress(b, 56, 56, KITS[1], 2);
    scatter(b, "glass", 26, 56, 56, 2);
    scatter(b, "sign", 10, 56, 56, 5);
    scatter(b, "wreck", 22, 56, 56, 8);
    scatter(b, "barrier", 18, 56, 56, 12);
    scatter(b, "boom", 12, 56, 56, 14);
    towerAt(b, "container", -30, 26, 3);
    towerAt(b, "container", 30, 26, 3);
    towerAt(b, "container", 0, 40, 2);
    b.rampAt(-10, -18, 0.3, { h: 3.8, l: 13, w: 10 });
    b.rampAt(24, 0, -1, { h: 3.8, l: 13, w: 10 });
  } },
  { world: 2, name: "화산 대폭발", desc: "폭발 드럼통을 이어 터뜨려 점수를 폭발시켜요!", time: 75, target: 10000, theme: "volcano", build(b) {
    b.arena(54, 54);
    arenaDress(b, 54, 54, KITS[2], 3);
    scatter(b, "boom", 40, 54, 54, 4);
    scatter(b, "rock", 14, 54, 54, 9);
    scatter(b, "wreck", 14, 54, 54, 16);
    scatter(b, "drum", 18, 54, 54, 22);
    towerAt(b, "girder", 0, 24, 1);
    b.rampAt(-24, -14, 0.7, { h: 4.4, l: 14, w: 11 });
    b.rampAt(24, -14, -0.7, { h: 4.4, l: 14, w: 11 });
    b.geysers.push({ x: 0, z: 0, period: 3.4, on: 1.2, off: 0, r: 2.8 });
  } },
  { world: 3, name: "빙판 대소동", desc: "미끄러운 얼음판에서 눈사람과 얼음을 박살내요.", time: 90, target: 8000, theme: "frozen", build(b) {
    b.arena(56, 56);
    arenaDress(b, 56, 56, KITS[3], 4);
    b.stamps.push({ kind: "matAll", mat: MAT.ICE });
    scatter(b, "iceblock", 18, 56, 56, 6);
    scatter(b, "snowman", 26, 56, 56, 10);
    scatter(b, "snowpile", 14, 56, 56, 13);
    scatter(b, "wreck", 14, 56, 56, 18);
    scatter(b, "boom", 10, 56, 56, 20);
    b.rampAt(0, 0, 0, { h: 4.2, l: 14, w: 12 });
  } },
  { world: 4, name: "메가 스타디움 난투", desc: "모든 것을 부수는 궁극의 120초!", time: 120, target: 18000, theme: "stadium", build(b) {
    b.arena(64, 64);
    arenaDress(b, 64, 64, KITS[4], 5);
    scatter(b, "wreck", 30, 64, 64, 2);
    scatter(b, "boom", 24, 64, 64, 6);
    scatter(b, "tirewall", 8, 64, 64, 10);
    scatter(b, "concrete", 10, 64, 64, 12);
    crateBlockAt(b, -36, 30, 4, 3, 3);
    crateBlockAt(b, 36, 30, 4, 3, 3);
    towerAt(b, "container", -40, -10, 3);
    towerAt(b, "container", 40, -10, 3);
    towerAt(b, "girder", 0, 40, 1);
    towerAt(b, "girder", -14, 44, 1);
    towerAt(b, "girder", 14, 44, 1);
    b.rampAt(0, -8, 0, { h: 5, l: 16, w: 14 });
    b.rampAt(-28, 4, 1, { h: 4, l: 13, w: 11 });
    b.rampAt(28, 4, -1, { h: 4, l: 13, w: 11 });
  } },
].map((d) => ({ mode: "destruction", world: d.world, name: d.name, desc: d.desc, time: d.time, main: { k: "score", n: d.target }, bonus: [{ k: "score", n: Math.round(d.target * 1.6) }, { k: "combo", n: 15 }], theme: d.theme, opts: {}, build: d.build, endless: true }));

/* ---------- STUNT MASTER: 점프대 공원 ---------- */
function stuntPark(b, rx, rz, list) {
  b.arena(rx, rz);
  for (const r of list) b.rampAt(r[0], r[1], r[2], { h: r[3], l: r[4], w: r[5] || 12 });
}
const STUNT = [
  { world: 0, name: "기본기 점프장", desc: "점프대를 찾아 뛰고 공중에서 ◀▶ 로 돌아요.", time: 90, target: 2500, theme: "scrap", build(b) {
    stuntPark(b, 54, 70, [
      [0, -40, 0, 4, 14],
      [0, 22, Math.PI, 4, 14],
      [-26, -8, 0.8, 3.4, 12],
      [26, -8, -0.8, 3.4, 12],
    ]);
    for (let i = 0; i < 5; i += 1) b.putAt("wreck", (i - 2) * 2.8, -8);
    for (let i = 0; i < 5; i += 1) b.putAt("wreck", (i - 2) * 2.8, 4);
  } },
  { world: 1, name: "도심 스턴트 쇼", desc: "차들을 뛰어넘을수록 점수가 커져요.", time: 90, target: 3200, theme: "city", build(b) {
    stuntPark(b, 50, 74, [
      [0, -30, 0, 4.4, 15],
      [-16, 46, Math.PI, 4.4, 15],
      [16, 46, Math.PI, 4.4, 15],
    ]);
    for (let j = 0; j < 3; j += 1) for (let i = 0; i < 6; i += 1) b.putAt("wreck", (i - 2.5) * 2.7, 2 + j * 6);
    for (let i = 0; i < 6; i += 1) b.putAt("glass", -38 + i * 15, 64);
  } },
  { world: 2, name: "용암 위의 곡예", desc: "큰 점프대에서 뒤돌기까지 도전!", time: 90, target: 3000, theme: "volcano", build(b) {
    stuntPark(b, 52, 72, [
      [0, -32, 0, 6, 18, 16],
      [0, 36, Math.PI, 6, 18, 16],
      [-30, 0, 0.9, 4.6, 14],
      [30, 0, -0.9, 4.6, 14],
    ]);
    clusterAt(b, "boom", -32, 34, 8, 6);
    for (let i = 0; i < 6; i += 1) b.putAt("wreck", (i - 2.5) * 2.8, 4);
    b.geysers.push({ x: -34, z: 34, period: 3, on: 1, off: 0, r: 2.6 }, { x: 34, z: 34, period: 3, on: 1, off: 1.5, r: 2.6 }, { x: -34, z: -40, period: 3, on: 1, off: 0.8, r: 2.6 }, { x: 34, z: -40, period: 3, on: 1, off: 2.2, r: 2.6 });
  } },
  { world: 3, name: "설원 위의 착지", desc: "눈밭에 깊이 빠져도 착지만 잘하면 대박!", time: 90, target: 3600, theme: "frozen", build(b) {
    stuntPark(b, 54, 74, [
      [0, -32, 0, 5, 16, 14],
      [-24, 34, Math.PI - 0.5, 5, 16, 14],
      [24, 34, Math.PI + 0.5, 5, 16, 14],
    ]);
    b.stamps.push({ kind: "matAll", mat: MAT.SNOW });
    for (let i = 0; i < 6; i += 1) b.putAt("wreck", (i - 2.5) * 2.8, 4);
    clusterAt(b, "snowman", 0, 18, 8, 8);
  } },
  { world: 4, name: "그랜드 스턴트 쇼", desc: "최고의 스턴트로 관중을 열광시켜요!", time: 100, target: 5500, theme: "stadium", build(b) {
    stuntPark(b, 62, 80, [
      [0, -56, 0, 7, 20, 18],
      [0, 44, Math.PI, 7, 20, 18],
      [-36, -6, 0.9, 5, 15],
      [36, -6, -0.9, 5, 15],
      [-36, 22, 2.2, 5, 15],
      [36, 22, -2.2, 5, 15],
    ]);
    for (let j = 0; j < 3; j += 1) for (let i = 0; i < 8; i += 1) b.putAt("wreck", (i - 3.5) * 2.7, -18 + j * 6);
    clusterAt(b, "boom", 0, 20, 8, 7);
  } },
].map((d) => ({ mode: "stunt", world: d.world, name: d.name, desc: d.desc, time: d.time, main: { k: "stuntScore", n: d.target }, bonus: [{ k: "stuntScore", n: Math.round(d.target * 1.7) }, { k: "air", t: 3 }], extra: 20, theme: d.theme, opts: {}, build: d.build }));

/* ---------- TIME ATTACK: 부수면 느려진다. 지름길은 부숴야 열린다 ---------- */
/* 타임 어택 코스 뒤쪽: 빠른 곡선과 언덕 */
const TIME_EXT = [
  ["dash", "sweep:50", "chicane"],
  ["chicane", "dash", "sweep:58", "gate"],
  ["dash", "hill:10", "sweep:52"],
  ["ice:44", "dash", "sweep:54"],
  ["chicane", "dash", "hill:10", "sweep:60"],
];
const TIME = [
  { world: 0, name: "고철장 일주", par: 38, theme: "scrap", opts: { w: 22 }, build(b) {
    b.go(70);
    b.pad(30, 0);
    b.go(60, { turn: 90 });
    b.go(60);
    b.go(60, { turn: -90 });
    b.go(50);
    b.pad(250, 0);
    const sc = b.shortcut(70, 190, { w: 12 });
    const k = b.at(70);
    b.putAt("concrete", k.x + Math.sin(sc.th) * 16, k.z + Math.cos(sc.th) * 16, { yaw: sc.th });
    b.putAt("concrete", k.x + Math.sin(sc.th) * 16 + Math.cos(sc.th) * 3.2, k.z + Math.cos(sc.th) * 16 - Math.sin(sc.th) * 3.2, { yaw: sc.th });
    b.putAt("concrete", k.x + Math.sin(sc.th) * 16 - Math.cos(sc.th) * 3.2, k.z + Math.cos(sc.th) * 16 + Math.sin(sc.th) * 3.2, { yaw: sc.th });
    b.go(30);
  } },
  { world: 1, name: "도심 스프린트", par: 40, theme: "city", opts: { w: 18 }, build(b) {
    b.go(60);
    b.go(40, { turn: 70 });
    b.pad(120, 0);
    b.go(50);
    b.go(40, { turn: -70 });
    b.go(50);
    line(b, "barrier", 60, 4, 8, 0);
    b.put("glass", 165, 0);
    b.go(40, { turn: 40 });
    b.go(40);
  } },
  { world: 2, name: "용암 고속도로", par: 42, theme: "volcano", opts: { w: 24 }, build(b) {
    b.go(70);
    b.pad(40, 0);
    b.jumpGap(55, 0, { h: 3.6, l: 15, w: 20 }, 16, { kind: "lava", depth: 6 });
    b.go(60);
    b.go(50, { turn: -60 });
    b.pad(150, 0);
    b.go(60);
    b.jumpGap(225, 0, { h: 4.2, l: 15, w: 20 }, 20, { kind: "lava", depth: 6 });
    b.go(70);
  } },
  { world: 3, name: "빙판 스피드웨이", par: 44, theme: "frozen", opts: { w: 26 }, build(b) {
    b.go(70);
    b.ice(30, 40);
    b.go(60, { turn: 70 });
    b.ice(70, 60);
    b.pad(135, 0);
    b.go(60);
    b.go(60, { turn: -80 });
    b.ice(190, 60);
    b.go(50);
    b.pad(260, 0);
    b.go(30);
  } },
  { world: 4, name: "그랑프리 서킷", par: 50, theme: "stadium", opts: { w: 26 }, build(b) {
    b.go(80);
    b.pad(40, 0);
    b.go(60, { turn: 80 });
    b.go(50);
    b.ramp(165, 0, { h: 3.8, l: 14, w: 20 });
    b.go(50, { turn: -40 });
    b.pad(220, 0);
    b.go(60);
    b.go(50, { turn: -40 });
    b.go(50);
    b.go(30);
  } },
].map((d, i) => {
  // 코스를 늘리고, 기준 시간은 길이로 정한다 (약 16m/s)
  const inner = d.build;
  const def = { ...d, build(b) { inner(b); extendCourse(b, d.world, TIME_EXT[i], i); } };
  def.par = Math.round(courseLength(def) / 16);
  return { mode: "time", world: d.world, name: d.name, desc: "장애물을 피해 최단 시간! 콘크리트를 뚫으면 지름길이 열리기도 해요.", time: Math.round(def.par * 2), par: def.par, main: { k: "finish" }, bonus: [{ k: "time", t: def.par + 8 }, { k: "time", t: def.par }], theme: d.theme, opts: d.opts, build: def.build };
});

/* ---------- 목록 ---------- */
export const LEVELS = [...TOUR, ...BOSS, ...DESTRUCTION, ...STUNT, ...TIME].map((d, i) => {
  const worldTour = TOUR.filter((q) => q.world === d.world);
  const n = d.mode === "tour" ? worldTour.indexOf(d) + 1 : 0;
  return { ...d, index: i, id: `${d.mode}-${d.world + 1}-${d.mode === "tour" ? n : d.mode === "boss" ? "B" : "M"}`, n };
});
export const levelsOf = (mode, world) => LEVELS.filter((l) => l.mode === mode && (world == null || l.world === world));

/** 스테이지를 지어 돌려준다 (그때그때 굽는다) */
export function buildLevel(def) {
  const theme = THEMES[def.theme];
  // 두 번 짓는다: 첫 번째로 길 모양을 알아내고, 두 번째에 그 길 위에 물체를 놓는다
  const first = new Builder(theme, def.opts || {});
  def.build(first);
  const b = new Builder(theme, def.opts || {});
  if (!first.shape) b.finalSamples = first.samples;
  def.build(b);
  return b.bake();
}

export function missionText(mi) {
  switch (mi.k) {
    case "finish":
      return "결승선까지 달리기";
    case "time":
      return `${mi.t}초 안에 완주`;
    case "destroy":
      return mi.type ? `${OBJ_NAME[mi.type] || "물체"} ${mi.n}개 부수기` : `장애물 ${mi.n}개 부수기`;
    case "score":
      return `점수 ${mi.n.toLocaleString("ko-KR")}점`;
    case "stunts":
      return `스턴트 ${mi.n}번 성공`;
    case "stuntScore":
      return `스턴트 ${mi.n.toLocaleString("ko-KR")}점`;
    case "over":
      return `차 ${mi.n}대 뛰어넘기`;
    case "chain":
      return `연쇄 폭발 ${mi.n}번`;
    case "combo":
      return `콤보 ${mi.n} 달성`;
    case "damage":
      return `피해 ${mi.max}% 이하로 끝내기`;
    case "air":
      return `한 번에 ${mi.t}초 체공`;
    case "zone":
      return "표시된 곳에 착지";
    case "collapse":
      return "구조물 완전히 무너뜨리기";
    case "push":
      return "덤프트럭을 표시된 곳까지";
    default:
      return "";
  }
}
const OBJ_NAME = { wreck: "폐차", glass: "유리", container: "컨테이너", rock: "화산석", iceblock: "얼음 블록", girder: "금속 구조물", crate: "상자" };
