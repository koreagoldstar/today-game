// 말랑콩떡! 젤리 공장 · 스테이지 설계도 (gen.mjs 가 이대로 무작위 판을 만들어 자동 풀이기로 거름)
// 스테이지 설계도 (크기 · 색깔별 개수 · 장애물 · 특수 타일 · 목표 · 원하는 풀이 길이 · 풀이에 꼭 써야 하는 장치)
const C = (color, n) => ({ type: "color", color, n });
export const RECIPES = {
  // ---------- 1~10: 기본 이동 · 연결 · 간단한 목표 ----------
  t01: { w: 6, h: 6, colors: [3], walls: 2, goals: [C(0, 3)], minPar: 1, maxPar: 2 },
  t02: { w: 6, h: 6, colors: [3, 3], walls: 2, goals: [{ type: "clear" }], minPar: 2, maxPar: 3 },
  t03: { w: 6, h: 6, colors: [3, 3], walls: 3, goals: [{ type: "clear" }], minPar: 3, maxPar: 4 },
  t04: { w: 6, h: 6, colors: [3, 3, 3], walls: 2, goals: [{ type: "clear" }], minPar: 3, maxPar: 5 },
  t05: { w: 6, h: 6, colors: [4, 3, 3], walls: 2, goals: [{ type: "score", n: 400 }], minPar: 3, maxPar: 4 },
  t06: { w: 6, h: 6, colors: [4, 3], walls: 3, goals: [{ type: "special", kind: "bolt", n: 1 }, { type: "use", n: 1 }], minPar: 2, maxPar: 4, need: (f) => f.made.bolt },
  t07: { w: 6, h: 6, colors: [4, 3], walls: 3, goals: [{ type: "special", kind: "star", n: 1 }, { type: "use", n: 1 }], minPar: 2, maxPar: 4, need: (f) => f.made.star },
  t08: { w: 6, h: 6, colors: [3, 3], walls: 1, pads: 2, goals: [{ type: "clear" }], minPar: 2, maxPar: 4, need: (f) => f.pad >= 1 },
  t09: { w: 6, h: 6, colors: [3, 3], walls: 1, sticky: 2, goals: [{ type: "clear" }], minPar: 3, maxPar: 4, need: (f) => f.sticky >= 1 },
  t10: { w: 6, h: 6, colors: [3, 3, 3], walls: 2, pads: 1, sticky: 1, goals: [{ type: "clear" }], minPar: 4, maxPar: 5, need: (f) => f.pad + f.sticky >= 1 },
  // ---------- 11~20: 장애물 · 이동 제한 · 특수 타일 · 공간 ----------
  t11: { w: 7, h: 7, colors: [3, 3], walls: 2, crates: 3, goals: [{ type: "crates" }], minPar: 3, maxPar: 5 },
  t12: { w: 7, h: 7, colors: [3, 3, 3], walls: 2, crates2: 2, goals: [{ type: "crates" }], minPar: 4, maxPar: 6 },
  t13: { w: 7, h: 7, colors: [2, 2], frozen: [1, 1], walls: 2, goals: [{ type: "frozen" }], minPar: 3, maxPar: 5 },
  t14: { w: 7, h: 7, colors: [3, 3, 3], walls: 2, pipes: 1, goals: [{ type: "clear" }], minPar: 4, maxPar: 5, need: (f) => f.pipe >= 1 },
  t15: { w: 7, h: 7, colors: [3, 3], walls: 3, pads: 3, goals: [{ type: "clear" }], minPar: 4, maxPar: 6, need: (f) => f.pad >= 2 },
  t16: { w: 7, h: 7, colors: [4, 3, 3], walls: 6, goals: [C(0, 4), C(1, 3)], minPar: 4, maxPar: 6 },
  t17: { w: 7, h: 7, colors: [4, 3], walls: 2, crates: 3, goals: [{ type: "crates" }], minPar: 3, maxPar: 6, need: (f) => f.made.fluffy && f.fired },
  t18: { w: 7, h: 7, colors: [4, 3], line: [0, 4], walls: 2, crates: 2, goals: [{ type: "crates" }, { type: "use", n: 1 }], minPar: 3, maxPar: 6, need: (f) => f.made.bolt },
  t18b: { w: 7, h: 7, colors: [4, 3, 3], line: [0, 4], walls: 2, crates: 3, goals: [{ type: "crates" }, { type: "use", n: 1 }], minPar: 4, maxPar: 7, need: (f) => f.made.bolt },
  t19: { w: 7, h: 7, colors: [2, 2, 3], frozen: [1, 1], walls: 2, crates: 2, goals: [{ type: "frozen" }, { type: "crates" }], minPar: 4, maxPar: 7 },
  t20: { w: 7, h: 7, colors: [3, 3, 3], walls: 1, pads: 1, pipes: 1, crates: 2, goals: [{ type: "clear" }], minPar: 5, maxPar: 7, need: (f) => f.pad + f.pipe >= 1 },
  // ---------- 21~30: 여러 목표 · 제한된 이동 · 특수 젤리 활용 ----------
  t21: { w: 7, h: 7, colors: [5, 4], walls: 3, goals: [{ type: "special", kind: "rainbow", n: 1 }, C(1, 4)], minPar: 3, maxPar: 6, need: (f) => f.made.rainbow && f.fired },
  t22: { w: 7, h: 7, colors: [3, 3], walls: 2, crates: 5, specials: { "-": 1, "|": 1 }, goals: [{ type: "crates" }], minPar: 2, maxPar: 5, need: (f) => f.chain >= 1 },
  t23: { w: 7, h: 7, colors: [4, 4], lines: [[0, 4], [1, 4]], walls: 2, crates: 2, goals: [{ type: "crates" }, { type: "special", kind: "any", n: 2 }], minPar: 4, maxPar: 7 },
  t24: { w: 7, h: 7, colors: [2, 2, 3], frozen: [1, 1], walls: 2, pipes: 1, goals: [{ type: "frozen" }, { type: "clear" }], minPar: 5, maxPar: 7, need: (f) => f.pipe >= 1 },
  t25: { w: 7, h: 7, colors: [4, 4, 4], walls: 4, goals: [C(0, 4), C(1, 4)], minPar: 5, maxPar: 7 },
  t26: { w: 7, h: 7, colors: [4, 4, 3], line: [0, 4], walls: 3, goals: [{ type: "score", n: 500 }], minPar: 4, maxPar: 6 },
  t27: { w: 7, h: 7, colors: [2, 2, 2], frozen: [1, 1, 1], walls: 3, crates2: 1, goals: [{ type: "frozen" }, { type: "crates" }], minPar: 5, maxPar: 8 },
  t28: { w: 7, h: 7, colors: [4, 4], walls: 2, crates: 5, goals: [{ type: "crates" }, { type: "special", kind: "bolt", n: 1 }], minPar: 4, maxPar: 7, need: (f) => f.made.bolt },
  t29: { w: 7, h: 7, colors: [3, 4], frozen: [0, 1], walls: 2, pads: 1, sticky: 1, crates: 2, goals: [{ type: "clear" }, { type: "crates" }], minPar: 5, maxPar: 7, need: (f) => f.pad + f.sticky >= 1 },
  t30: { w: 7, h: 7, colors: [3, 4], frozen: [0, 1], walls: 2, pads: 1, pipes: 1, crates: 2, goals: [{ type: "crates" }, { type: "clear" }], minPar: 5, maxPar: 7, need: (f) => f.pad + f.pipe >= 1 },
};
