/*
 * 말랑팡! 슬라임 연구소 · 기록 저장 (이 기기 브라우저에만 · 다른 기기와 동기화 없음)
 *  저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 게임은 그대로 된다 → 이번 방문 동안만 기억.
 */
const KEY = "today-slime-lab-v1";

const DEFAULT = () => ({
  v: 1,
  best: 0,
  bestCombo: 0,
  bestChain: 0,
  games: 0,
  totalMerges: 0,
  dex: {}, // 단계: { first: "2026-10-22", count: 만든 횟수 }
  missions: {}, // 미션 id: 별 (0~3)
  settings: { sound: true, reduced: null }, // reduced: null = 기기 설정 따름
});

function today() {
  return new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
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
          this.data = { ...def, ...d, dex: { ...(d.dex || {}) }, missions: { ...(d.missions || {}) }, settings: { ...def.settings, ...(d.settings || {}) } };
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
      this.ok = false; // 저장 실패해도 게임은 계속
    }
  }
  /** 도감: 이 단계를 만들었음 → 처음이면 true */
  discover(level) {
    const d = this.data.dex;
    const first = !d[level];
    if (first) d[level] = { first: today(), count: 0 };
    d[level].count++;
    return first;
  }
  found(level) {
    return !!this.data.dex[level];
  }
  foundCount() {
    return Object.keys(this.data.dex).length;
  }
  /** 클래식 한 판 끝: 새 최고 점수면 true */
  recordClassic(k) {
    const d = this.data;
    const newBest = k.score > d.best;
    d.best = Math.max(d.best, k.score);
    d.bestCombo = Math.max(d.bestCombo, k.maxCombo);
    d.bestChain = Math.max(d.bestChain, k.maxChain);
    d.games++;
    d.totalMerges += k.merges;
    this.write();
    return newBest;
  }
  /** 미션 성공: 별이 늘었으면 true */
  recordMission(id, stars) {
    const m = this.data.missions;
    const more = stars > (m[id] || 0);
    m[id] = Math.max(m[id] || 0, stars);
    this.write();
    return more;
  }
  missionStars() {
    return Object.values(this.data.missions).reduce((a, b) => a + (b || 0), 0);
  }
  setSetting(k, v) {
    this.data.settings[k] = v;
    this.write();
  }
}
