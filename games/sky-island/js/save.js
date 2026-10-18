/*
 * 하늘섬 대탈출 · 기록 저장 (이 기기에만: localStorage)
 *  스테이지마다: 최고 점수 · 가장 빠른 시간 · 별(최대 3) · 구슬 · 클리어 횟수
 *  진행: 열린 스테이지 · 엔딩 본 횟수 · 설정
 */
const KEY = "today-sky-island-v1";
export const STAGE_COUNT = 6;

const DEFAULT = () => ({
  v: 2,
  plays: 0,
  seenHowto: false,
  stages: { unlocked: 1, best: {} },
  ending: { count: 0, bestTotal: 0, bestTime: 0 },
  settings: { musicVol: 0.75, sfxVol: 0.9, quality: "auto" },
});

export class Save {
  constructor() {
    this.data = DEFAULT();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const def = DEFAULT();
        this.data = {
          ...def,
          ...d,
          stages: { ...def.stages, ...(d.stages || {}), best: { ...((d.stages && d.stages.best) || {}) } },
          ending: { ...def.ending, ...(d.ending || {}) },
          settings: { ...def.settings, ...(d.settings || {}) },
        };
        // 예전(스테이지 1개뿐이던) 기록 옮기기
        if (d.best && !this.data.stages.best[1]) {
          this.data.stages.best[1] = { score: d.best, time: d.bestTime || 0, orbs: d.bestOrbs || 0, stars: 1, clears: d.clears || 1 };
          if (d.clears) this.data.stages.unlocked = Math.max(this.data.stages.unlocked, 2);
        }
        this.data.v = 2;
      }
    } catch (_) {
      /* 저장소를 못 쓰는 환경 (사생활 보호 모드 등) — 기본값으로 */
    }
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (_) {
      /* 무시 */
    }
  }
  best(id) {
    return this.data.stages.best[id] || null;
  }
  get unlocked() {
    return Math.min(STAGE_COUNT, this.data.stages.unlocked);
  }
  /** 스테이지 클리어 기록 → 새 기록 여부 */
  recordClear(id, { score, time, orbs, stars }) {
    const st = this.data.stages;
    const prev = st.best[id] || { score: 0, time: 0, orbs: 0, stars: 0, clears: 0 };
    const out = { newBest: score > prev.score, newTime: !prev.time || time < prev.time, newStars: stars > prev.stars, unlocked: false };
    st.best[id] = {
      score: Math.max(prev.score, score),
      time: prev.time ? Math.min(prev.time, time) : time,
      orbs: Math.max(prev.orbs, orbs),
      stars: Math.max(prev.stars, stars),
      clears: prev.clears + 1,
    };
    if (id < STAGE_COUNT && st.unlocked < id + 1) {
      st.unlocked = id + 1;
      out.unlocked = true;
    }
    this.save();
    return out;
  }
  /** 모든 스테이지 최고 점수 합 (엔딩 · 랭킹용) */
  totalBest() {
    let s = 0;
    for (let i = 1; i <= STAGE_COUNT; i++) s += (this.data.stages.best[i] || {}).score || 0;
    return s;
  }
  totalStars() {
    let s = 0;
    for (let i = 1; i <= STAGE_COUNT; i++) s += (this.data.stages.best[i] || {}).stars || 0;
    return s;
  }
  recordEnding(time) {
    const e = this.data.ending;
    e.count++;
    e.bestTotal = Math.max(e.bestTotal, this.totalBest());
    e.bestTime = e.bestTime ? Math.min(e.bestTime, time) : time;
    this.save();
  }
  recordPlay() {
    this.data.plays++;
    this.save();
  }
}
