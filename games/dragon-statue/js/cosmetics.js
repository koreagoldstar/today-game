/*
 * 드래곤 석상 대작전 · 꾸미기 해금 조건 · 드래곤 알 도감
 *  모두 외형만 바뀐다 (속도 · 점프 · 판정 · 시간과 상관없음). 결제 · 뽑기 없음 — 진행으로만 연다.
 *  조건 종류: region(지역 n 완료) · astars(모험 별 합계) · stars(석상 챌린지 별) · crystals(모은 수정 합계) · eggs(알 개수)
 *  여러 조건 중 하나만 만족하면 열린다.
 */
import { BATS, HATS, DECOS } from "./characters.js?v=1";

export const UNLOCK = {
  bat: {
    wood: [],
    starlight: [{ region: 1 }, { stars: 15 }],
    rainbow: [{ astars: 6 }, { stars: 40 }],
    crystal: [{ region: 3 }, { stars: 80 }],
    gold: [{ region: 6 }, { stars: 140 }],
  },
  hat: {
    none: [],
    explorer: [],
    flower: [{ region: 1 }],
    leaf: [{ crystals: 120 }],
    wizard: [{ region: 3 }],
    crown: [{ region: 6 }],
    horns: [{ eggs: 6 }],
  },
  deco: {
    none: [],
    scarf: [],
    medal: [{ astars: 9 }],
    cape: [{ region: 4 }],
    wings: [{ eggs: 3 }],
  },
};

/** 드래곤 알 (지역 보스를 이기면 하나씩) */
export const EGGS = [
  { id: "forest", name: "숲 드래곤 알", color: "#7fd65a", spot: "#3f8a2a", region: 1 },
  { id: "sea", name: "물보라 드래곤 알", color: "#5ac0f0", spot: "#2a7ab8", region: 2 },
  { id: "star", name: "수정 드래곤 알", color: "#b48aff", spot: "#ffe27a", region: 3 },
  { id: "fire", name: "용암 드래곤 알", color: "#ff8a4a", spot: "#c83a1a", region: 4 },
  { id: "ice", name: "얼음 드래곤 알", color: "#cfefff", spot: "#5ab8e8", region: 5 },
  { id: "gold", name: "황금 드래곤 알", color: "#ffcf4a", spot: "#c8901a", region: 6 },
];

function progress(save) {
  const d = save.data;
  const a = d.adv;
  const cleared = Object.values(a.regions).filter((r) => r.clears > 0).length;
  // 지역 번호로 완료 여부를 보기 위해, 열린 지역 수 - 1 = 깬 지역 중 가장 먼 곳
  const astars = Object.values(a.regions).reduce((s, r) => s + (r.stars || 0), 0);
  return { region: Math.max(cleared, a.unlocked - 1), astars, stars: d.stars, crystals: a.totalCrystals, eggs: Object.keys(a.eggs).length };
}
export function isUnlocked(save, type, id) {
  const conds = (UNLOCK[type] || {})[id];
  if (!conds || !conds.length) return true;
  const p = progress(save);
  return conds.some((c) => Object.entries(c).every(([k, v]) => (p[k] || 0) >= v));
}
export function allUnlocked(save) {
  const out = {};
  for (const [t, list] of [
    ["bat", BATS],
    ["hat", HATS],
    ["deco", DECOS],
  ])
    out[t] = list.filter((it) => isUnlocked(save, t, it.id)).map((it) => it.id);
  return out;
}
/** 조건 설명 (어린이도 알기 쉽게) */
export function condText(type, id) {
  const conds = (UNLOCK[type] || {})[id];
  if (!conds || !conds.length) return "처음부터";
  const one = (c) =>
    Object.entries(c)
      .map(([k, v]) => (k === "region" ? `지역 ${v} 완료` : k === "astars" ? `모험 별 ${v}개` : k === "stars" ? `석상 챌린지 별 ${v}개` : k === "crystals" ? `수정 ${v}개 모으기` : `드래곤 알 ${v}개`))
      .join(" · ");
  return conds.map(one).join(" 또는 ");
}
