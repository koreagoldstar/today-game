/*
 * 말랑팡! 슬라임 연구소 · 미션 모드
 *  미션마다 목표(만들기 · 점수 · 연쇄 · 합체 수 · 콤보)와 투하 횟수 제한.
 *  떨어지는 슬라임 순서는 미션마다 고정 (시드) → 다시 해도 같은 조건.
 *  별: 성공 1개 · 적게 떨어뜨리고 성공하면 2 · 3개.
 *  난이도: 쉬움은 처음부터 · 보통은 쉬움 3개 · 어려움은 보통 3개를 깨면 열림.
 */
import { LEVELS } from "./config.js?v=1";

export const TIERS = [
  { key: "easy", name: "쉬움", need: 0 },
  { key: "normal", name: "보통", need: 3 },
  { key: "hard", name: "어려움", need: 3 },
];

const M = (id, tier, type, value, drops, extra = {}) => ({ id, tier, type, value, drops, stars: [drops, Math.round(drops * 0.75), Math.round(drops * 0.55)], seed: id * 7919 + 13, ...extra });

export const MISSIONS = [
  M(1, 0, "level", 2, 10),
  M(2, 0, "score", 250, 30),
  M(3, 0, "chain", 2, 30),
  M(4, 0, "level", 4, 24),
  M(5, 1, "merges", 15, 36),
  M(6, 1, "score", 1100, 48),
  M(7, 1, "level", 5, 30),
  M(8, 1, "chain", 3, 50),
  M(9, 2, "level", 6, 55),
  M(10, 2, "score", 3200, 85),
  M(11, 2, "chain", 4, 80),
  M(12, 2, "level", 7, 120),
];

/** 미션 제목 */
export function title(m) {
  switch (m.type) {
    case "level":
      return `${LEVELS[m.value].name} 만들기`;
    case "score":
      return `${m.value.toLocaleString("ko-KR")}점 모으기`;
    case "chain":
      return `${m.value}연쇄 합체 하기`;
    case "merges":
      return `합체 ${m.value}번 하기`;
    case "combo":
      return `콤보 ${m.value}번 이어가기`;
  }
  return "";
}
/** 짧은 설명 (투하 제한 포함) */
export function detail(m) {
  const how = {
    level: "같은 슬라임을 합쳐 진화시켜요",
    score: "합체할수록 점수가 올라요",
    chain: "합쳐진 슬라임이 곧바로 또 합쳐지게 쌓아요",
    merges: "작은 슬라임도 부지런히 합쳐요",
    combo: "합체가 끊기지 않게 빠르게 이어 가요",
  }[m.type];
  return `${how} · 슬라임 ${m.drops}개 안에`;
}
/** 지금 진행 (keeper = ScoreKeeper) */
export function progress(m, k) {
  let v = 0;
  switch (m.type) {
    case "level":
      v = k.maxMade; // 합체로 만든 것만 (떨어뜨린 것은 안 셈)
      break;
    case "score":
      v = k.score;
      break;
    case "chain":
      v = k.maxChain;
      break;
    case "merges":
      v = k.merges;
      break;
    case "combo":
      v = k.maxCombo;
      break;
  }
  return { v, done: v >= m.value };
}
/** 진행 글자 (HUD) */
export function progressText(m, k) {
  const { v } = progress(m, k);
  if (m.type === "level") return v >= m.value ? "완성!" : `만든 최고: ${v ? LEVELS[v].name : "아직 없음"}`;
  if (m.type === "score") return `${Math.min(v, m.value).toLocaleString("ko-KR")} / ${m.value.toLocaleString("ko-KR")}점`;
  return `${Math.min(v, m.value)} / ${m.value}`;
}
export function starsFor(m, used) {
  return used <= m.stars[2] ? 3 : used <= m.stars[1] ? 2 : 1;
}
/** 이 난이도가 열렸나 (앞 난이도에서 깬 미션 수) */
export function tierOpen(ti, missionStars) {
  if (ti === 0) return true;
  const prev = MISSIONS.filter((m) => m.tier === ti - 1 && (missionStars[m.id] || 0) > 0).length;
  return prev >= TIERS[ti].need;
}
/** 같은 시드 → 같은 순서 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
