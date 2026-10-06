/*
 * 제트스키 썬더 레이스 · 저장 (이 기기 localStorage 에만)
 *  코스별 최고 기록(ms) · 메달(0~3) · 최고 순위 · 해금 · 설정
 */
const KEY = "today-jetski-v1";

const DEFAULT = () => ({
  v: 1,
  unlocked: 1, // 1번 코스부터
  courses: {},
  settings: { music: true, sfx: true, vibrate: true },
  seenHow: false,
  grandMaster: false,
  races: 0,
});

export const MEDAL_NAMES = ["", "BRONZE", "SILVER", "GOLD"];

export class Save {
  constructor() {
    this.data = DEFAULT();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === 1) this.data = { ...DEFAULT(), ...d, settings: { ...DEFAULT().settings, ...(d.settings || {}) } };
      }
    } catch (_) {
      /* 비공개 창 등: 저장 없이 진행 */
    }
  }

  get settings() {
    return this.data.settings;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (_) {}
  }

  course(id) {
    return this.data.courses[id] || null;
  }

  /** 기록(초) → 메달 0~3 */
  static medalFor(course, sec) {
    const m = course.medals;
    if (!m || !Number.isFinite(sec)) return 0;
    if (sec <= m.gold) return 3;
    if (sec <= m.silver) return 2;
    if (sec <= m.bronze) return 1;
    return 0;
  }

  /**
   * 완주 기록. 돌려줌: { newBest, prevBest, medal, prevMedal, unlockedNext, grandMaster }
   */
  record(course, index, total, { time, place }) {
    const id = course.id;
    const prev = this.course(id) || { best: null, medal: 0, bestPlace: 0, plays: 0 };
    const sec = time / 1000;
    const medal = Save.medalFor(course, sec);
    const newBest = prev.best == null || time < prev.best;
    const next = {
      best: newBest ? Math.round(time) : prev.best,
      medal: Math.max(prev.medal || 0, medal),
      bestPlace: prev.bestPlace ? Math.min(prev.bestPlace, place) : place,
      plays: (prev.plays || 0) + 1,
    };
    this.data.courses[id] = next;
    this.data.races = (this.data.races || 0) + 1;
    let unlockedNext = false;
    if (index + 2 > this.data.unlocked && index + 1 < total) {
      this.data.unlocked = index + 2;
      unlockedNext = true;
    }
    this.save();
    return { newBest, prevBest: prev.best, medal, prevMedal: prev.medal || 0, unlockedNext };
  }

  golds(courses) {
    return courses.filter((c) => (this.course(c.id) || {}).medal === 3).length;
  }

  medalCount(courses) {
    let n = 0;
    for (const c of courses) n += (this.course(c.id) || {}).medal || 0;
    return n;
  }

  /** 12개 코스 전부 골드 → 그랜드 마스터 */
  checkGrandMaster(courses) {
    const all = courses.every((c) => (this.course(c.id) || {}).medal === 3);
    if (all && !this.data.grandMaster) {
      this.data.grandMaster = true;
      this.save();
      return true;
    }
    return false;
  }
}
