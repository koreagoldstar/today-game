/*
 * 말랑팡! 슬라임 연구소 · 점수 · 콤보 · 연쇄 (화면 효과와 따로 · 여기서만 계산)
 *  - 합체 한 번 = 이벤트 하나 (고유 id). 같은 id 가 두 번 와도 한 번만 점수에 들어간다.
 *  - 콤보: 슬라임 하나를 떨어뜨린 뒤 이어지는 합체들 (앞 합체 뒤 comboWindow 초 안) → 콤보 +1 (배율 최대 3배)
 *          새로 떨어뜨리면 0부터 (빨리 마구 떨어뜨려서는 안 쌓이고 · 한 번에 여러 개가 합쳐지게 쌓아야 커짐)
 *  - 연쇄: 합체로 막 생긴 슬라임이 곧바로 또 합체 → 연쇄 단계 +1 (보너스)
 *  - 기본 점수는 새로 생긴 단계가 높을수록 크게 (작은 슬라임만 계속 합쳐서는 점수가 크게 오르지 않음)
 */
import { RULES } from "./config.js?v=1";

/** 새로 생긴 단계별 기본 점수 (index = 단계 · 2 ~ 8) */
export const BASE = [0, 0, 5, 14, 30, 64, 140, 300, 650];
/** 전설의 젤리 드래곤 둘이 만나 하늘로 날아감 */
export const LEGEND = 2000;

export function comboMult(combo) {
  return Math.min(3, 1 + 0.2 * Math.max(0, combo - 1));
}
export function chainBonus(chain) {
  return chain >= 2 ? 20 * chain * (chain - 1) : 0;
}
/** level = 새로 생긴 단계 (9 = 드래곤 둘이 만나 사라짐) */
export function mergePoints(level, combo, chain) {
  const base = level >= 9 ? LEGEND : BASE[level] || 0;
  return Math.round(base * comboMult(combo)) + chainBonus(chain);
}

export class ScoreKeeper {
  constructor() {
    this.reset();
  }
  reset() {
    this.score = 0;
    this.merges = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.maxChain = 0;
    this.maxLevel = 0; // 본 것 중 가장 큰 단계 (떨어뜨린 것 포함 · 결과 화면)
    this.maxMade = 0; // 합체로 '만든' 가장 큰 단계 (미션 '만들기')
    this.lastT = -99;
    this.byLevel = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.seen = new Set();
    this.events = 0;
  }
  /** 새 슬라임을 떨어뜨림 → 콤보는 다시 0부터 */
  onDrop() {
    this.combo = 0;
  }
  /** 떨어뜨리거나 생긴 슬라임 단계 기록 (최고 단계) */
  saw(level) {
    if (level > this.maxLevel && level <= 8) this.maxLevel = level;
  }
  /**
   * 합체 반영
   * @param ev {id, level(새 단계 · 9=전설), chain, t(게임 시간)}
   * @returns {points, combo, chain} · 이미 반영한 id 면 null
   */
  apply(ev) {
    if (this.seen.has(ev.id)) return null;
    this.seen.add(ev.id);
    this.events++;
    this.combo = this.combo > 0 && ev.t - this.lastT <= RULES.comboWindow ? this.combo + 1 : 1;
    this.lastT = ev.t;
    const points = mergePoints(ev.level, this.combo, ev.chain);
    this.score += points;
    this.merges++;
    this.byLevel[Math.min(9, ev.level)]++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.maxChain = Math.max(this.maxChain, ev.chain);
    this.saw(Math.min(8, ev.level));
    if (ev.level <= 8 && ev.level > this.maxMade) this.maxMade = ev.level;
    return { points, combo: this.combo, chain: ev.chain };
  }
  /** 콤보가 끝났나 (화면 표시용) */
  comboAlive(t) {
    return this.combo > 0 && t - this.lastT <= RULES.comboWindow;
  }
}
