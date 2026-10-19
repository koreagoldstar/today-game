/*
 * 용암 서핑 · 기록 저장 (이 기기에만: localStorage)
 *  스테이지별 최고 점수 · 가장 빠른 탈출 · 별(3개) · 열린 스테이지 · 무한 도전 최고 기록 · 최종 클리어 · 설정
 *  예전(코스 1 하나뿐이던) 기록은 스테이지 1 기록으로 옮긴다.
 */
const KEY = "today-lava-surfers-v1";
export const STAGE_COUNT = 18;
export const ENDLESS_UNLOCK = 3; // 이 스테이지를 깨면 무한 도전이 열림

const DEFAULT = () => ({
  v: 2,
  plays: 0,
  clears: 0,
  stages: { best: {}, unlocked: 1 },
  endless: { best: 0, dist: 0, runs: 0 },
  ending: 0,
  settings: { musicVol: 0.7, sfxVol: 0.9, quality: "auto" },
});

export class Save {
  constructor() {
    this.data = DEFAULT();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = this.migrate(JSON.parse(raw));
    } catch (_) {
      /* 저장소를 못 쓰는 환경 — 기본값 */
    }
  }
  migrate(d) {
    const def = DEFAULT();
    if (!d || typeof d !== "object") return def;
    if (d.v !== 2) {
      // v1: 코스 1 하나 → 스테이지 1 기록
      const out = def;
      out.plays = d.plays || 0;
      out.settings = { ...def.settings, ...(d.settings || {}) };
      if (d.clears) {
        out.stages.best[1] = { score: d.best || 0, time: d.bestTime || 0, stars: 1 };
        out.stages.unlocked = 2;
        out.clears = d.clears;
      }
      return out;
    }
    return { ...def, ...d, stages: { ...def.stages, ...(d.stages || {}) }, endless: { ...def.endless, ...(d.endless || {}) }, settings: { ...def.settings, ...(d.settings || {}) } };
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (_) {
      /* 무시 */
    }
  }
  get unlocked() {
    return this.data.stages.unlocked;
  }
  stageBest(id) {
    return this.data.stages.best[id] || null;
  }
  /** 스테이지 탈출: 새 기록 여부 + 다음 스테이지 열림 */
  recordStage(id, { score, time, stars }) {
    const S = this.data.stages;
    const b = S.best[id] || { score: 0, time: 0, stars: 0 };
    const out = { newBest: score > b.score, newTime: !b.time || time < b.time, newStars: stars > b.stars, unlockedNext: false, unlockedEndless: false };
    S.best[id] = { score: Math.max(b.score, score), time: b.time ? Math.min(b.time, time) : time, stars: Math.max(b.stars, stars) };
    if (id + 1 > S.unlocked && id < STAGE_COUNT) {
      S.unlocked = id + 1;
      out.unlockedNext = true;
      if (id === ENDLESS_UNLOCK) out.unlockedEndless = true;
    }
    this.data.clears++;
    this.save();
    return out;
  }
  endlessOpen() {
    return this.data.stages.unlocked > ENDLESS_UNLOCK || !!this.data.stages.best[ENDLESS_UNLOCK];
  }
  recordEndless({ score, dist }) {
    const E = this.data.endless;
    const out = { newBest: score > E.best, newDist: dist > E.dist };
    E.best = Math.max(E.best, score);
    E.dist = Math.max(E.dist, dist);
    E.runs++;
    this.save();
    return out;
  }
  recordEnding() {
    this.data.ending++;
    this.save();
  }
  totalStars() {
    return Object.values(this.data.stages.best).reduce((a, b) => a + (b.stars || 0), 0);
  }
  totalBest() {
    return Object.values(this.data.stages.best).reduce((a, b) => a + (b.score || 0), 0);
  }
  clearedCount() {
    return Object.keys(this.data.stages.best).length;
  }
  recordPlay() {
    this.data.plays++;
    this.save();
  }
}
