/*
 * 자석 대소동 · 기록 저장 (이 기기 브라우저에만 · 다른 기기와 동기화 없음)
 *  저장소를 못 쓰는 환경에서도 게임은 그대로 → 이번 방문 동안만 기억.
 */
const KEY = "today-magnet-mayhem-v1";
const DEFAULT = () => ({
  v: 1,
  stages: {}, // id: { stars, best(초), gear }
  daily: {}, // "2026-10-25": { best(초), stars, tries }
  skin: "classic",
  tutorial: {}, // 본 안내 id
  settings: { sound: true, reduced: null },
});

export function seoulDate(d = new Date()) {
  return d.toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
}

export class Save {
  constructor() {
    this.ok = true;
    this.data = DEFAULT();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === "object") {
          const def = DEFAULT();
          this.data = { ...def, ...d, stages: { ...(d.stages || {}) }, daily: { ...(d.daily || {}) }, tutorial: { ...(d.tutorial || {}) }, settings: { ...def.settings, ...(d.settings || {}) } };
        }
      }
    } catch (_) {
      this.ok = false;
    }
  }
  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      this.ok = true;
    } catch (_) {
      this.ok = false;
    }
  }
  stage(id) {
    return this.data.stages[id] || null;
  }
  stars(id) {
    return (this.data.stages[id] && this.data.stages[id].stars) || 0;
  }
  totalStars() {
    return Object.values(this.data.stages).reduce((a, s) => a + ((s && s.stars) || 0), 0);
  }
  gears() {
    return Object.values(this.data.stages).filter((s) => s && s.gear).length;
  }
  /** 깬 기록 → { newBest, moreStars, first } */
  recordStage(id, { stars, time, gear }) {
    const old = this.data.stages[id] || { stars: 0, best: 0, gear: false };
    const res = { first: !old.stars, moreStars: stars > old.stars, newBest: !old.best || time < old.best, gearNew: gear && !old.gear };
    this.data.stages[id] = { stars: Math.max(old.stars, stars), best: old.best ? Math.min(old.best, time) : time, gear: old.gear || gear };
    this.write();
    return res;
  }
  dailyOf(date) {
    return this.data.daily[date] || null;
  }
  recordDaily(date, { ok, time = 0, stars = 0 }) {
    const old = this.data.daily[date] || { best: 0, stars: 0, tries: 0 };
    const d = { ...old, tries: old.tries + 1 };
    let newBest = false;
    if (ok) {
      newBest = !old.best || time < old.best;
      d.best = old.best ? Math.min(old.best, time) : time;
      d.stars = Math.max(old.stars, stars);
    }
    this.data.daily[date] = d;
    const keys = Object.keys(this.data.daily).sort();
    while (keys.length > 60) delete this.data.daily[keys.shift()];
    this.write();
    return { ...d, newBest };
  }
  seen(id) {
    return !!this.data.tutorial[id];
  }
  markSeen(id) {
    if (this.data.tutorial[id]) return;
    this.data.tutorial[id] = 1;
    this.write();
  }
  set(k, v) {
    this.data[k] = v;
    this.write();
  }
  setSetting(k, v) {
    this.data.settings[k] = v;
    this.write();
  }
}
