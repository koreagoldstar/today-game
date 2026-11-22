/* 교통지옥 — 도로 · 스테이지 · 미션 데이터 (새 도로 · 스테이지는 여기에만 추가)
 * 링크 이름: 바깥에서 들어오는 길 "A.N.in", 나가는 길 "A.N.out", 교차로 사이 "A.E-B.W" (A 에서 B 로)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.THL = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- 도로 만들기 도우미 ---------- */
  // 교차로 하나. arms: { N:[들어오는 차로, 나가는 차로], ... } · 빠진 방향은 T자
  function single(o = {}) {
    const arms = o.arms || { N: [2, 2], E: [2, 2], S: [2, 2], W: [2, 2] };
    const len = o.len || 66;
    return {
      inters: [{ id: "A", x: 0, y: 0, phases: o.phases || ["NS", "EW"], permLeft: o.permLeft, cross: o.cross }],
      roads: Object.keys(arms).map((s) => ({ a: "A", as: s, lanesIn: arms[s][0], lanesOut: arms[s][1], len: (o.lens && o.lens[s]) || len, use: o.use && o.use[s] })),
    };
  }
  // 동서로 이어진 교차로 여러 개
  function corridor(n, o = {}) {
    const sp = o.spacing || 78;
    const ids = "ABCD".slice(0, n).split("");
    const lanes = o.lanes || 2;
    const inters = ids.map((id, i) => ({ id, x: i * sp, y: 0, phases: (o.phases && o.phases[i]) || o.phase || ["NS", "EW"], permLeft: o.permLeft, cross: o.cross }));
    const roads = [];
    ids.forEach((id, i) => {
      roads.push({ a: id, as: "N", lanesIn: o.side || lanes, lanesOut: o.side || lanes, len: o.len || 60 });
      roads.push({ a: id, as: "S", lanesIn: o.side || lanes, lanesOut: o.side || lanes, len: o.len || 60 });
      if (i === 0) roads.push({ a: id, as: "W", lanesIn: lanes, lanesOut: lanes, len: o.endLen || 62 });
      if (i === n - 1) roads.push({ a: id, as: "E", lanesIn: lanes, lanesOut: lanes, len: o.endLen || 62 });
      if (i < n - 1) roads.push({ a: id, as: "E", b: ids[i + 1], bs: "W", lanesAB: lanes, lanesBA: lanes });
    });
    return { inters, roads };
  }
  // 2×2 격자
  function grid2(o = {}) {
    const sp = o.spacing || 76;
    const L = o.lanes || 2;
    const ph = o.phase || ["NS", "EW"];
    const inters = [
      { id: "A", x: 0, y: 0, phases: ph, permLeft: o.permLeft },
      { id: "B", x: sp, y: 0, phases: ph, permLeft: o.permLeft },
      { id: "C", x: 0, y: sp, phases: ph, permLeft: o.permLeft },
      { id: "D", x: sp, y: sp, phases: ph, permLeft: o.permLeft },
    ];
    const e = (a, as) => ({ a, as, lanesIn: L, lanesOut: L, len: o.len || 56 });
    const roads = [
      e("A", "N"), e("A", "W"), e("B", "N"), e("B", "E"), e("C", "W"), e("C", "S"), e("D", "E"), e("D", "S"),
      { a: "A", as: "E", b: "B", bs: "W", lanesAB: L, lanesBA: L },
      { a: "C", as: "E", b: "D", bs: "W", lanesAB: L, lanesBA: L },
      { a: "A", as: "S", b: "C", bs: "N", lanesAB: L, lanesBA: L },
      { a: "B", as: "S", b: "D", bs: "N", lanesAB: L, lanesBA: L },
    ];
    return { inters, roads };
  }
  const lv = (base, more) => Object.assign({}, base, more);

  /* ---------- 테마 (배경 + 게임 방식) ---------- */
  const THEMES = {
    downtown: { name: "도심 사거리", desc: "넓은 4방향 교차로. 기본기를 익히는 곳.", ground: "#3d4652", block: "#59636f", roof: ["#7d8794", "#6b7480", "#8f98a3", "#a3a9b0"], tree: "#4f7a5a" },
    rush: { name: "출퇴근 상습 정체 구역", desc: "한 방향으로 차가 몰리는 시간대가 온다. 몰리는 쪽에 신호를 길게.", ground: "#3a4150", block: "#505a6a", roof: ["#6a7486", "#5e6779", "#7b8597", "#8c95a5"], tree: "#4a6f55" },
    commerce: { name: "상업 지구", desc: "버스 정류장 · 택시 승하차 · 보행자가 많다. 차가 길에서 선다.", ground: "#43404a", block: "#5f5866", roof: ["#a0798a", "#8b7a9b", "#c09a78", "#7f97a8"], tree: "#5a8063" },
    work: { name: "공사 구간", desc: "차로가 줄고 길이 막힌다. 차들이 우회로로 몰린다.", ground: "#4a4536", block: "#5f5946", roof: ["#8a8068", "#9a8c64", "#7a735f", "#a59a7a"], tree: "#5b744b" },
    multi: { name: "복잡한 다중 교차로", desc: "교차로가 서로 이어져 있다. 한 곳이 막히면 옆 교차로까지 막힌다.", ground: "#353d49", block: "#4b5564", roof: ["#66788c", "#5a6a7d", "#77889a", "#8797a8"], tree: "#466a52" },
  };

  /* ---------- 스테이지 20 ---------- */
  const STAGES = [
    lv(single({ phases: ["NS", "EW"], arms: { N: [1, 1], E: [1, 1], S: [1, 1], W: [1, 1] }, cross: false }), {
      id: "s1", n: 1, theme: "downtown", name: "첫 신호",
      brief: "직진하는 차만 온다. 교차로를 눌러 남북 ↔ 동서 신호를 바꿔 기다리는 차를 보내세요.",
      tips: ["교차로를 누르면 다음 신호로 바뀌어요", "바꾸면 노란불 2.5초 뒤 초록불"],
      demand: { "*": 5 }, turns: { L: 0, S: 1, R: 0 }, mix: { car: 0.85, taxi: 0.15, bus: 0, truck: 0, moto: 0 },
      goal: { time: 150, pass: 30, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW"], arms: { N: [1, 1], E: [1, 1], S: [1, 1], W: [1, 1] }, cross: false }), {
      id: "s2", n: 2, theme: "downtown", name: "한쪽이 붐빈다",
      brief: "동서 도로에 차가 두 배로 많다. 붐비는 쪽에 초록불을 더 길게 주세요.",
      tips: ["줄이 긴 쪽부터", "빨간 줄 = 막히는 차로"],
      demand: { "A.E.in": 9, "A.W.in": 9, "A.N.in": 4, "A.S.in": 4 }, turns: { L: 0, S: 0.8, R: 0.2 }, mix: { car: 0.8, taxi: 0.1, moto: 0.1, bus: 0, truck: 0 },
      goal: { time: 160, pass: 42, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW"], arms: { N: [1, 1], E: [1, 1], S: [1, 1], W: [1, 1] }, cross: false }), {
      id: "s3", n: 3, theme: "downtown", name: "트럭과 버스",
      brief: "트럭 · 버스는 출발이 느리고 멈추는 데 오래 걸린다. 노란불에 진입한 큰 차가 다 빠져나가기 전에 신호를 또 바꾸면 위험해요.",
      tips: ["신호 버튼 위에 '⚠ 트럭 통과 중'이 뜨면 잠깐 기다렸다 바꾸세요", "주황 테두리 = 빨간불이 된 뒤에도 교차로를 빠져나가는 차", "신호를 5초 안에 또 바꾸면 감점"],
      demand: { "*": 6 }, turns: { L: 0, S: 0.85, R: 0.15 }, mix: { car: 0.55, taxi: 0.05, bus: 0.15, truck: 0.25, moto: 0 },
      goal: { time: 170, pass: 36, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW"], arms: { N: [1, 1], E: [1, 1], S: [1, 1], W: [1, 1] } }), {
      id: "s4", n: 4, theme: "downtown", name: "횡단보도",
      brief: "보행자는 같은 방향 직진 신호 때 건넌다. 오른쪽으로 도는 차는 사람이 다 건널 때까지 기다려요.",
      tips: ["보행자가 오래 기다리면 감점", "사람이 건너는 동안 우회전 차가 멈춰요"],
      demand: { "*": 5.5 }, peds: 6, turns: { L: 0, S: 0.7, R: 0.3 }, mix: { car: 0.75, taxi: 0.1, moto: 0.1, truck: 0.05, bus: 0 },
      goal: { time: 170, pass: 34, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW"], arms: { N: [1, 1], E: [1, 1], S: [1, 1], W: [1, 1] } }), {
      id: "s5", n: 5, theme: "commerce", name: "버스 정류장",
      brief: "동쪽 · 서쪽에서 오는 길에 버스 정류장이 있다. 버스가 서면 뒤차가 모두 멈춰요.",
      tips: ["버스가 정류장에서 5초 멈춰요", "그동안 다른 방향을 보내세요"],
      demand: { "*": 5.5 }, peds: 4, turns: { L: 0, S: 0.8, R: 0.2 }, mix: { car: 0.6, taxi: 0.1, bus: 0.2, truck: 0.05, moto: 0.05 },
      busStops: [{ link: "A.E.in", lane: -1, pos: 0.42 }, { link: "A.W.in", lane: -1, pos: 0.42 }],
      goal: { time: 180, pass: 32, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s6", n: 6, theme: "downtown", name: "좌회전 신호",
      brief: "좌회전 차로가 생겼다. 직진 신호로는 좌회전 차가 못 가요. 좌회전 신호도 챙기세요.",
      tips: ["남북 좌회전 · 동서 좌회전 신호가 따로 있어요", "아래 버튼으로 원하는 신호를 바로 고를 수 있어요"],
      demand: { "*": 6.5 }, turns: { L: 0.3, S: 0.55, R: 0.15 }, mix: { car: 0.7, taxi: 0.1, bus: 0.05, truck: 0.08, moto: 0.07 },
      goal: { time: 190, pass: 44, maxAcc: 2 },
    }),
    lv(single({ phases: ["N", "E", "S", "W"], arms: { N: [1, 1], E: [1, 1], S: [1, 1], W: [1, 1] } }), {
      id: "s7", n: 7, theme: "downtown", name: "한 차로에 다 섞였다",
      brief: "차로가 하나뿐이라 좌회전 차가 앞에 서면 뒤 직진 차도 못 간다. 방향별(직진+좌회전) 신호로 한 방향씩 보내세요.",
      tips: ["방향별 신호: 한쪽 방향 차만 모두 통과", "기다리는 차가 많은 방향부터"],
      demand: { "*": 4.2 }, turns: { L: 0.3, S: 0.5, R: 0.2 }, peds: 3, mix: { car: 0.72, taxi: 0.1, truck: 0.08, moto: 0.1, bus: 0 },
      goal: { time: 190, pass: 34, maxAcc: 2 },
    }),
    lv(single({ phases: ["EW", "EWL", "S"], arms: { E: [2, 2], S: [2, 2], W: [2, 2] }, use: { S: [["L"], ["R"]] } }), {
      id: "s8", n: 8, theme: "rush", name: "T자 교차로",
      brief: "북쪽 길이 없는 T자 교차로. 남쪽에서 나오는 차와 동서 직진 · 좌회전을 번갈아 보내세요.",
      tips: ["남쪽 신호: 남쪽 차만 좌회전 · 우회전", "동쪽에서 남쪽으로 좌회전은 동서 좌회전 신호"],
      demand: { "A.E.in": 8, "A.W.in": 8, "A.S.in": 6 }, turns: { L: 0.4, S: 0.6, R: 0.4 }, mix: { car: 0.65, taxi: 0.08, bus: 0.07, truck: 0.12, moto: 0.08 },
      goal: { time: 190, pass: 50, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW"], permLeft: true }), {
      id: "s9", n: 9, theme: "downtown", name: "비보호 좌회전",
      brief: "좌회전 신호가 없다. 좌회전 차는 직진 신호 때 맞은편 차가 끊길 때를 기다렸다 돌아요(비보호). 맞은편 차가 계속 오면 좌회전 줄이 길어져요.",
      tips: ["맞은편 직진이 끊기는 순간 좌회전이 빠져요", "신호를 바꾸는 노란불 때 좌회전 차가 많이 빠져요"],
      demand: { "*": 6.5 }, turns: { L: 0.25, S: 0.6, R: 0.15 }, mix: { car: 0.72, taxi: 0.1, truck: 0.08, moto: 0.1, bus: 0 },
      goal: { time: 190, pass: 46, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s10", n: 10, theme: "rush", name: "출근길 러시",
      brief: "40초쯤부터 서쪽에서 도심으로 들어오는 차가 세 배로 몰린다. 몰려오기 전에 다른 방향 줄을 비워 두세요.",
      tips: ["러시가 오기 전에 미리 정리", "몰리는 동안엔 서쪽 신호를 길게"],
      demand: { "*": 5.5 }, waves: [{ t0: 40, t1: 120, entry: "A.W.in", mult: 3 }, { t0: 40, t1: 120, entry: "A.N.in", mult: 1.5 }],
      turns: { L: 0.22, S: 0.62, R: 0.16 }, mix: { car: 0.7, taxi: 0.08, bus: 0.08, truck: 0.06, moto: 0.08 },
      events: [{ t: 32, kind: "warn", text: "곧 서쪽에서 출근 차량이 몰려와요!", at: "A.W.in" }],
      goal: { time: 200, pass: 60, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s11", n: 11, theme: "downtown", name: "첫 구급차",
      brief: "구급차가 온다. 사이렌이 들리면 구급차가 오는 방향에 초록불을, 앞을 막는 차들을 먼저 빼주세요. 18초 넘게 지체되면 큰 감점.",
      tips: ["화면 가장자리에 긴급 차량 접근 표시", "빨간불이면 구급차가 멈췄다가 천천히 지나가요"],
      demand: { "*": 6 }, turns: { L: 0.25, S: 0.6, R: 0.15 }, mix: { car: 0.72, taxi: 0.1, truck: 0.08, moto: 0.1 },
      events: [
        { t: 36, kind: "warn", text: "구급차가 북쪽에서 접근 중!", at: "A.N.in" },
        { t: 40, kind: "emergency", type: "ambulance", from: "A.N.in", to: "A.S.out", limit: 18 },
        { t: 110, kind: "warn", text: "구급차가 동쪽에서 접근 — 좌회전합니다!", at: "A.E.in" },
        { t: 114, kind: "emergency", type: "ambulance", from: "A.E.in", to: "A.S.out", limit: 18 },
      ],
      goal: { time: 200, pass: 48, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s12", n: 12, theme: "commerce", name: "택시 승하차",
      brief: "남북 도로 바깥 차로에 택시 승하차 구역이 있다. 택시가 서면 직진 차로가 잠깐 막혀요. 보행자도 많아요.",
      tips: ["택시 정차 4초", "보행자 대기가 길면 감점"],
      demand: { "*": 4.8 }, peds: 6, turns: { L: 0.22, S: 0.6, R: 0.18 }, mix: { car: 0.56, taxi: 0.24, bus: 0.06, moto: 0.1, truck: 0.04 },
      taxiZones: [{ link: "A.N.in", lane: -1, pos: 0.45, dwell: 3 }, { link: "A.S.in", lane: -1, pos: 0.45, dwell: 3 }],
      goal: { time: 200, pass: 46, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s13", n: 13, theme: "commerce", name: "상업지구 혼잡",
      brief: "버스 정류장 · 택시 · 보행자가 한꺼번에. 길에서 서는 차를 피해 비어 있는 방향을 계속 찾아 보내세요.",
      tips: ["정류장 · 승하차로 멈춘 방향은 잠시 미뤄도 돼요"],
      demand: { "*": 5 }, peds: 6, turns: { L: 0.22, S: 0.6, R: 0.18 }, mix: { car: 0.48, taxi: 0.22, bus: 0.16, moto: 0.1, truck: 0.04 },
      busStops: [{ link: "A.E.in", lane: -1, pos: 0.4 }, { link: "A.W.in", lane: -1, pos: 0.4 }],
      taxiZones: [{ link: "A.N.in", lane: -1, pos: 0.45, dwell: 3 }, { link: "A.S.in", lane: -1, pos: 0.45, dwell: 3 }],
      goal: { time: 210, pass: 50, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"], arms: { N: [2, 2], E: [1, 2], S: [2, 2], W: [2, 1] }, use: { E: [["L", "S", "R"]] } }), {
      id: "s14", n: 14, theme: "work", name: "공사로 줄어든 차로",
      brief: "동서 도로가 공사로 한 차로만 남았다. 속도도 느리다. 동서 차는 직진 · 좌회전이 한 줄에 섞여요.",
      tips: ["공사 구간은 시속 30km 이하", "동서는 좌회전 신호 때도 한 줄이 같이 움직여요"],
      demand: { "*": 5.5, "A.E.in": 4.5, "A.W.in": 4.5 }, turns: { L: 0.22, S: 0.62, R: 0.16 }, mix: { car: 0.66, taxi: 0.06, truck: 0.16, moto: 0.08, bus: 0.04 },
      work: [{ link: "A.E.in", vcap: 8.5 }, { link: "A.W.out", vcap: 8.5 }],
      goal: { time: 210, pass: 38, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s15", n: 15, theme: "work", name: "고장 차량",
      brief: "차가 길 한가운데서 고장 날 수 있다. 멈춘 차(⚠)를 눌러 견인차를 부르세요. 놔두면 30초 동안 차로가 막혀요.",
      tips: ["⚠ 고장 차를 누르면 견인", "사고 차도 눌러서 치울 수 있어요"],
      demand: { "*": 6 }, turns: { L: 0.22, S: 0.62, R: 0.16 }, mix: { car: 0.7, taxi: 0.08, truck: 0.12, moto: 0.06, bus: 0.04 },
      events: [{ t: 35, kind: "breakdown", link: "A.N.in" }, { t: 95, kind: "breakdown", link: "A.E.in" }, { t: 150, kind: "breakdown", link: "A.W.in" }],
      goal: { time: 200, pass: 48, maxAcc: 2 },
    }),
    lv(corridor(2, { phase: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s16", n: 16, theme: "multi", name: "이어진 두 교차로",
      brief: "교차로 두 개가 붙어 있다. 사이 도로가 꽉 차면 다른 교차로 차가 들어갈 자리가 없어 멈춰요. 두 교차로를 함께 보세요.",
      tips: ["교차로를 눌러 고른 뒤 아래 버튼으로 신호 선택", "가운데 도로가 차면 넘쳐요"],
      demand: { "*": 4.5, "A.W.in": 7, "B.E.in": 7 }, turns: { L: 0.2, S: 0.62, R: 0.18 }, mix: { car: 0.7, taxi: 0.08, truck: 0.1, moto: 0.08, bus: 0.04 },
      goal: { time: 220, pass: 64, maxAcc: 2 },
    }),
    lv(grid2({ phase: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s17", n: 17, theme: "work", name: "우회 도로",
      brief: "북쪽 동서 도로(A→B)가 공사로 막혔다. 동쪽으로 가는 차는 아래쪽 길로 돌아가요. 우회 차량이 몰리는 교차로를 챙기세요.",
      tips: ["막힌 길은 차들이 알아서 돌아가요", "우회로 교차로(C · D)에 좌회전 · 우회전이 많아져요"],
      closed: ["A.E-B.W"],
      demand: { "*": 3.6 }, turns: { L: 0.22, S: 0.6, R: 0.18 }, mix: { car: 0.7, taxi: 0.08, truck: 0.1, moto: 0.08, bus: 0.04 },
      goal: { time: 230, pass: 60, maxAcc: 2 },
    }),
    lv(corridor(2, { phase: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s18", n: 18, theme: "multi", name: "긴급 차량 연속",
      brief: "구급차 · 소방차 · 경찰차가 차례로 두 교차로를 지나간다. 두 교차로 모두 길을 터 주세요.",
      tips: ["긴급 차량이 지나갈 길의 신호를 미리 초록으로", "앞차가 빠져야 긴급 차량도 빠져요"],
      demand: { "*": 4.4 }, turns: { L: 0.2, S: 0.62, R: 0.18 }, mix: { car: 0.72, taxi: 0.08, truck: 0.1, moto: 0.06, bus: 0.04 },
      events: [
        { t: 30, kind: "warn", text: "소방차가 서쪽에서 동쪽 끝까지 달려요!", at: "A.W.in" },
        { t: 34, kind: "emergency", type: "fire", from: "A.W.in", to: "B.E.out", limit: 22 },
        { t: 90, kind: "warn", text: "구급차가 북쪽(B)에서 서쪽으로!", at: "B.N.in" },
        { t: 94, kind: "emergency", type: "ambulance", from: "B.N.in", to: "A.W.out", limit: 22 },
        { t: 150, kind: "warn", text: "경찰차가 남쪽(A)에서 북쪽(B)으로!", at: "A.S.in" },
        { t: 154, kind: "emergency", type: "police", from: "A.S.in", to: "B.N.out", limit: 22 },
      ],
      goal: { time: 230, pass: 60, maxAcc: 2 },
    }),
    lv(grid2({ phase: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s19", n: 19, theme: "multi", name: "격자 교차로",
      brief: "교차로 네 개. 가운데 도로가 짧아 금방 찬다. 한 줄로 이어 초록불을 주는 '녹색 물결'을 만들어 보세요.",
      tips: ["같은 방향 교차로를 이어서 초록으로", "꽉 찬 가운데 도로가 있으면 그쪽으로 보내지 마세요"],
      demand: { "*": 4.2 }, turns: { L: 0.2, S: 0.62, R: 0.18 }, peds: 2, mix: { car: 0.7, taxi: 0.08, truck: 0.1, moto: 0.08, bus: 0.04 },
      goal: { time: 240, pass: 80, maxAcc: 2 },
    }),
    lv(grid2({ phase: ["NS", "EW", "NSL", "EWL"] }), {
      id: "s20", n: 20, theme: "multi", name: "교통지옥",
      brief: "격자 교차로에 러시 · 고장 · 긴급 차량까지 모두. 도시를 멈추지 마세요.",
      tips: ["고장 차는 바로 견인", "긴급 차량이 먼저", "막히는 곳 하나가 도시 전체를 멈춰요"],
      demand: { "*": 4.4 }, peds: 3, turns: { L: 0.2, S: 0.62, R: 0.18 }, mix: { car: 0.64, taxi: 0.1, truck: 0.12, moto: 0.08, bus: 0.06 },
      waves: [{ t0: 60, t1: 140, entry: "A.W.in", mult: 2.2 }, { t0: 60, t1: 140, entry: "C.W.in", mult: 1.8 }],
      events: [
        { t: 50, kind: "warn", text: "서쪽에서 퇴근 차량이 몰려와요!", at: "A.W.in" },
        { t: 80, kind: "breakdown", link: "B.S-D.N" },
        { t: 116, kind: "warn", text: "구급차가 북쪽(A)에서 남쪽(C) 끝까지!", at: "A.N.in" },
        { t: 120, kind: "emergency", type: "ambulance", from: "A.N.in", to: "C.S.out", limit: 24 },
        { t: 170, kind: "breakdown", link: "C.E-D.W" },
        { t: 190, kind: "emergency", type: "fire", from: "D.E.in", to: "C.W.out", limit: 26 },
      ],
      goal: { time: 250, pass: 86, maxAcc: 2 },
    }),
  ];

  /* ---------- 긴급 상황 미션 ---------- */
  const MISSIONS = [
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "m1", n: 1, theme: "downtown", name: "골든타임",
      brief: "구급차 세 대가 연달아 온다. 각 구급차가 15초 넘게 지체되면 실패.",
      goalText: "구급차 3대 · 각 15초 이내 · 사고 0~2",
      demand: { "*": 6 }, turns: { L: 0.22, S: 0.62, R: 0.16 },
      events: [
        { t: 14, kind: "warn", text: "구급차 접근 — 서쪽에서 직진", at: "A.W.in" },
        { t: 18, kind: "emergency", type: "ambulance", from: "A.W.in", to: "A.E.out", limit: 15 },
        { t: 50, kind: "warn", text: "구급차 접근 — 남쪽에서 좌회전", at: "A.S.in" },
        { t: 54, kind: "emergency", type: "ambulance", from: "A.S.in", to: "A.W.out", limit: 15 },
        { t: 86, kind: "warn", text: "구급차 접근 — 동쪽에서 직진", at: "A.E.in" },
        { t: 90, kind: "emergency", type: "ambulance", from: "A.E.in", to: "A.W.out", limit: 15 },
      ],
      goal: { time: 120, pass: 1, emFail: true, maxAcc: 2, emLimit: 15 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "m2", n: 2, theme: "work", name: "사고 수습",
      brief: "북쪽 길에서 사고가 나 차로 하나가 막혀 있다. 사고 차를 눌러 견인하고, 90초 안에 차 26대를 보내세요.",
      goalText: "사고 차 견인 · 90초 안에 26대",
      demand: { "*": 6 }, turns: { L: 0.22, S: 0.62, R: 0.16 },
      events: [{ t: 0.1, kind: "wreck", link: "A.N.in", lane: 1, pos: 0.6 }],
      goal: { time: 90, pass: 26, maxAcc: 2, clearWreck: true },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "m3", n: 3, theme: "rush", name: "출퇴근 교통대란",
      brief: "사방에서 차가 두 배로 몰린다. 150초 동안 정체 지수를 80 아래로 버티세요.",
      goalText: "150초 · 정체 지수 80 미만 유지",
      demand: { "*": 9.5 }, turns: { L: 0.2, S: 0.64, R: 0.16 },
      goal: { time: 150, maxCong: 80, maxAcc: 2 },
    }),
    lv(grid2({ phase: ["NS", "EW", "NSL", "EWL"] }), {
      id: "m4", n: 4, theme: "work", name: "공사 구간 우회 통제",
      brief: "40초에 가운데 남북 도로(B→D)가 공사로 막힌다. 갑자기 바뀐 흐름을 정리해 180초 안에 55대를 보내세요.",
      goalText: "공사 시작 뒤 흐름 정리 · 180초 안에 55대",
      demand: { "*": 3.6 }, turns: { L: 0.22, S: 0.6, R: 0.18 },
      events: [{ t: 34, kind: "warn", text: "곧 B → D 도로가 공사로 막혀요!", at: "B.S-D.N" }, { t: 40, kind: "close", link: "B.S-D.N" }],
      work: [{ link: "D.N-B.S", vcap: 8 }],
      goal: { time: 180, pass: 55, maxAcc: 2 },
    }),
    lv(single({ phases: ["NS", "EW", "NSL", "EWL"] }), {
      id: "m5", n: 5, theme: "downtown", name: "사방에서 사이렌",
      brief: "소방차 · 구급차 · 경찰차가 거의 동시에 세 방향에서 온다. 모두 20초 안에 통과시키세요.",
      goalText: "긴급 차량 3대 동시 · 각 20초 이내",
      demand: { "*": 5.5 }, turns: { L: 0.22, S: 0.62, R: 0.16 },
      events: [
        { t: 20, kind: "warn", text: "긴급 차량 세 대가 동시에 접근!", at: "A.N.in" },
        { t: 24, kind: "emergency", type: "fire", from: "A.N.in", to: "A.S.out", limit: 20 },
        { t: 26, kind: "emergency", type: "ambulance", from: "A.E.in", to: "A.W.out", limit: 20 },
        { t: 28, kind: "emergency", type: "police", from: "A.S.in", to: "A.E.out", limit: 20 },
      ],
      goal: { time: 80, pass: 1, emFail: true, maxAcc: 2, emLimit: 20 },
    }),
    lv(corridor(2, { phase: ["NS", "EW", "NSL", "EWL"] }), {
      id: "m6", n: 6, theme: "commerce", name: "축제 날 저녁",
      brief: "보행자가 쏟아지고 버스가 줄줄이 선다. 두 교차로에서 사고 없이 160초 안에 50대.",
      goalText: "보행자 폭증 · 버스 정류장 · 160초 안에 50대 · 사고 0~1",
      demand: { "*": 4.2 }, peds: 10, turns: { L: 0.2, S: 0.62, R: 0.18 }, mix: { car: 0.5, taxi: 0.2, bus: 0.2, moto: 0.08, truck: 0.02 },
      busStops: [{ link: "A.E-B.W", lane: -1, pos: 0.45 }, { link: "B.W-A.E", lane: -1, pos: 0.45 }],
      goal: { time: 160, pass: 50, maxAcc: 1 },
    }),
  ];

  /* ---------- 무한 교통지옥 ---------- */
  const ENDLESS = lv(corridor(2, { phase: ["NS", "EW", "NSL", "EWL"] }), {
    id: "endless", theme: "multi", name: "무한 교통지옥",
    brief: "차가 점점 많아진다. 사고 3번이나 도시 마비가 오면 끝. 얼마나 버틸까?",
    demand: { "*": 2.8 }, ramp: 75, turns: { L: 0.2, S: 0.62, R: 0.18 }, peds: 2, mix: { car: 0.66, taxi: 0.1, truck: 0.1, moto: 0.08, bus: 0.06 },
    proc: { em: [55, 85], emFirst: 50, br: [70, 110], brFirst: 80, emLimit: 22 },
    goal: { endless: true, maxAcc: 2 },
  });

  /* ---------- 오늘의 교통지옥: 날짜로 같은 조건 ---------- */
  function daily(dateKey) {
    const rnd = (function (a) {
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })((function (s) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
      return h;
    })("th-daily-" + dateKey));
    const maps = [
      () => single({ phases: ["NS", "EW", "NSL", "EWL"] }),
      () => single({ phases: ["N", "E", "S", "W"], arms: { N: [1, 1], E: [1, 1], S: [1, 1], W: [1, 1] } }),
      () => corridor(2, { phase: ["NS", "EW", "NSL", "EWL"] }),
      () => grid2({ phase: ["NS", "EW", "NSL", "EWL"] }),
      () => single({ phases: ["NS", "EW"], permLeft: true }),
    ];
    const themes = ["downtown", "rush", "commerce", "work", "multi"];
    const mi = Math.floor(rnd() * maps.length);
    const base = maps[mi]();
    const multi = base.inters.length;
    const rate = multi === 1 ? 5.2 + rnd() * 1.6 : multi === 2 ? 4 + rnd() : 3.4 + rnd() * 0.8;
    const entries = [];
    for (const r of base.roads) if (!r.b) entries.push(`${r.a}.${r.as}.in`);
    const surge = entries[Math.floor(rnd() * entries.length)];
    const theme = mi === 3 || mi === 2 ? "multi" : themes[Math.floor(rnd() * 4)];
    const L = lv(base, {
      id: "daily-" + dateKey,
      seed: "th-daily-" + dateKey,
      theme,
      name: "오늘의 교통지옥",
      brief: `오늘의 조건 · ${THEMES[theme].name} · ${(multi === 1 ? "교차로 1곳" : `교차로 ${multi}곳`)} · ${surge.split(".")[0]} 교차로 ${({ N: "북", E: "동", S: "남", W: "서" })[surge.split(".")[1]]}쪽 러시. 모두 같은 조건으로 4분 동안 최고 점수에 도전!`,
      demand: { "*": +rate.toFixed(2) },
      waves: [{ t0: 70 + Math.floor(rnd() * 40), t1: 170, entry: surge, mult: 2 }],
      peds: Math.floor(rnd() * 5),
      turns: { L: mi === 1 ? 0.25 : 0.2, S: 0.62, R: 0.18 },
      proc: { em: [60, 90], emFirst: 45 + Math.floor(rnd() * 30), br: [90, 130], brFirst: 100, emLimit: 22 },
      goal: { time: 240, fullTime: true, maxAcc: 2 },
    });
    if (theme === "commerce" && multi === 1) {
      L.busStops = [{ link: "A.E.in", lane: -1, pos: 0.42 }];
      L.taxiZones = [{ link: "A.N.in", lane: -1, pos: 0.45 }];
    }
    return L;
  }

  /* ---------- 튜토리얼 ---------- */
  const TUTORIAL = lv(single({ phases: ["NS", "EW"], arms: { N: [1, 1], E: [1, 1], S: [1, 1], W: [1, 1] }, cross: false }), {
    id: "tutorial", seed: "tutorial", theme: "downtown", name: "튜토리얼",
    demand: { "A.N.in": 7, "A.S.in": 7, "A.E.in": 3, "A.W.in": 3 }, turns: { L: 0, S: 1, R: 0 }, mix: { car: 0.85, taxi: 0.15, bus: 0, truck: 0, moto: 0 },
    phaseStart: 1,
    goal: { time: 400, pass: 12, maxAcc: 5 },
  });

  return { THEMES, STAGES, MISSIONS, ENDLESS, TUTORIAL, daily, single, corridor, grid2 };
});
