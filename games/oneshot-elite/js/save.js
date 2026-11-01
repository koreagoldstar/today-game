/*
 * 저장: 이 기기 브라우저에만 (별 · 최고 점수 · 통계 · 설정)
 */
import { WORLDS, MISSIONS, missionsOf } from "./missions.js";

const KEY = "oneshot-elite:v1";
const DEF = () => ({
  stars: {},
  best: {},
  stats: { shots: 0, hits: 0, heads: 0, kills: 0, missions: 0, fails: 0, time: 0, longest: 0 },
  settings: { sens: 1, invert: false, sound: 0.9, quality: "auto", easy: false, shake: true },
  tutorial: false,
});

export class Save {
  constructor() {
    this.d = DEF();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const o = JSON.parse(raw);
        this.d = { ...DEF(), ...o, stats: { ...DEF().stats, ...(o.stats || {}) }, settings: { ...DEF().settings, ...(o.settings || {}) } };
      }
    } catch (_) {
      this.d = DEF();
    }
  }
  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.d));
    } catch (_) {
      /* 저장소를 못 써도 게임은 계속 */
    }
  }
  starsOf(id) {
    return this.d.stars[id] || [false, false, false];
  }
  countOf(id) {
    return this.starsOf(id).filter(Boolean).length;
  }
  totalStars() {
    return MISSIONS.reduce((s, m) => s + this.countOf(m.id), 0);
  }
  worldStars(w) {
    return missionsOf(w).reduce((s, m) => s + this.countOf(m.id), 0);
  }
  worldUnlocked(w) {
    const W = WORLDS.find((x) => x.id === w);
    return this.totalStars() >= W.need;
  }
  cleared(id) {
    return this.countOf(id) > 0;
  }
  /** 앞 미션을 깨면 다음이 열림 · 보너스는 그 월드 9개를 다 깨면 */
  missionUnlocked(m) {
    if (!this.worldUnlocked(m.w)) return false;
    if (m.n === 1) return true;
    if (m.t === "bonus") return missionsOf(m.w).filter((x) => x.t !== "bonus").every((x) => this.cleared(x.id));
    return this.cleared(`${m.w}-${m.n - 1}`);
  }
  totalScore() {
    return Object.values(this.d.best).reduce((a, b) => a + b, 0);
  }
  /** 결과 저장 → 새로 열린 것 돌려줌 */
  record(res, bestRange = 0) {
    const s = this.d.stats;
    s.shots += res.shots;
    s.hits += res.hits;
    s.heads += res.heads;
    s.kills += res.hits;
    s.time += res.time;
    s.longest = Math.max(s.longest, bestRange);
    if (!res.ok) {
      s.fails++;
      this.write();
      return { newBest: false, unlockedWorlds: [], unlockedBonus: false };
    }
    s.missions++;
    const beforeWorlds = WORLDS.filter((w) => this.worldUnlocked(w.id)).map((w) => w.id);
    const bonus = MISSIONS.find((m) => m.w === res.mission.w && m.t === "bonus");
    const bonusBefore = this.missionUnlocked(bonus);
    const old = this.starsOf(res.id);
    this.d.stars[res.id] = old.map((v, i) => v || res.stars[i]);
    const newBest = res.score > (this.d.best[res.id] || 0);
    if (newBest) this.d.best[res.id] = res.score;
    this.write();
    const afterWorlds = WORLDS.filter((w) => this.worldUnlocked(w.id)).map((w) => w.id);
    return { newBest, unlockedWorlds: afterWorlds.filter((w) => !beforeWorlds.includes(w)), unlockedBonus: !bonusBefore && this.missionUnlocked(bonus) };
  }
  reset() {
    const set = this.d.settings;
    this.d = DEF();
    this.d.settings = set;
    this.write();
  }
}
