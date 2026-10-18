/*
 * 용암 서핑 · 기록 저장 (이 기기에만: localStorage)
 *  최고 점수 · 가장 빠른 탈출 · 가장 먼 거리 · 최다 구슬 · 최고 스턴트 · 탈출 횟수 · 설정
 */
const KEY = "today-lava-surfers-v1";

const DEFAULT = () => ({
  v: 1,
  plays: 0,
  best: 0,
  bestTime: 0,
  bestDist: 0,
  bestOrbs: 0,
  bestStunt: 0,
  clears: 0,
  settings: { musicVol: 0.7, sfxVol: 0.9, quality: "auto" },
});

export class Save {
  constructor() {
    this.data = DEFAULT();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const def = DEFAULT();
        this.data = { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) } };
      }
    } catch (_) {
      /* 저장소를 못 쓰는 환경 — 기본값 */
    }
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (_) {
      /* 무시 */
    }
  }
  /** 한 판 끝: 새 기록들 → {newBest, newTime, newDist} */
  record({ score, time, dist, orbs, stunt, clear }) {
    const d = this.data;
    const out = { newBest: score > d.best, newTime: clear && (!d.bestTime || time < d.bestTime), newDist: dist > d.bestDist };
    d.best = Math.max(d.best, score);
    d.bestDist = Math.max(d.bestDist, dist);
    d.bestOrbs = Math.max(d.bestOrbs, orbs);
    d.bestStunt = Math.max(d.bestStunt, stunt);
    if (clear) {
      d.clears++;
      d.bestTime = d.bestTime ? Math.min(d.bestTime, time) : time;
    }
    this.save();
    return out;
  }
  recordPlay() {
    this.data.plays++;
    this.save();
  }
}
