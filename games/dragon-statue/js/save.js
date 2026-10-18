/*
 * 드래곤 석상 대작전 · 저장 (이 기기 localStorage 에만 — 서버로 보내는 것은 없다)
 *  모험: 열린 지역 · 지역별 최고 기록(별 · 수정 · 시간 · 점수) · 드래곤 알 · 배지 · 모은 수정 · 연습 안내
 *  석상 챌린지: 최고 기록 · 별 · 요정 친구 · 오늘의 도전(날짜별 따로) · 통계
 *  꾸미기: 캐릭터 · 방망이 · 모자 · 장식 / 설정 (음악 · 효과음 크기 따로)
 */
import { isUnlocked } from "./cosmetics.js?v=1";

const KEY = "today-dragon-statue-v1";
const DEFAULTS = () => ({
  v: 1,
  best: 0,
  bestStage: 0,
  bestCombo: 0,
  stars: 0,
  fairies: {},
  char: "chick",
  bat: "wood",
  hat: "none",
  deco: "none",
  adv: { unlocked: 1, regions: {}, eggs: {}, badges: {}, totalCrystals: 0, tutorial: false, puzzleSeen: false, bestRun: 0, runs: 0, bestCombo: 0, clearedAll: false },
  tutorial: false,
  cleared30: false,
  daily: {},
  stats: { runs: 0, hits: 0, correct: 0 },
  settings: { music: true, sfx: true, vibrate: true, calm: false, quality: "auto", musicVol: 0.8, sfxVol: 0.9 },
});

export class Save {
  constructor() {
    this.data = DEFAULTS();
    this.load();
  }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const def = DEFAULTS();
      const adv = { ...def.adv, ...(d.adv || {}) };
      adv.regions = { ...((d.adv && d.adv.regions) || {}) };
      adv.eggs = { ...((d.adv && d.adv.eggs) || {}) };
      adv.badges = { ...((d.adv && d.adv.badges) || {}) };
      this.data = { ...def, ...d, adv, stats: { ...def.stats, ...(d.stats || {}) }, settings: { ...def.settings, ...(d.settings || {}) }, fairies: { ...(d.fairies || {}) }, daily: { ...(d.daily || {}) } };
    } catch (_) {
      this.data = DEFAULTS();
    }
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (_) {}
  }
  get s() {
    return this.data.settings;
  }
  batUnlocked(id) {
    return isUnlocked(this, "bat", id);
  }
  /** (석상 챌린지) 별을 더하고 새로 열린 방망이 목록을 돌려준다 */
  addStars(n) {
    const ids = ["wood", "starlight", "rainbow", "crystal", "gold"];
    const before = ids.filter((id) => this.batUnlocked(id));
    this.data.stars += n;
    return ids.filter((id) => this.batUnlocked(id) && !before.includes(id));
  }
  hasFairy(id) {
    return !!this.data.fairies[id];
  }
  /** 요정 친구 얻기 → 처음이면 true */
  addFairy(id, day) {
    if (this.data.fairies[id]) return false;
    this.data.fairies[id] = day;
    return true;
  }
  daily(day) {
    return this.data.daily[day] || { best: 0, plays: 0, stage: 0, done: false };
  }
  setDaily(day, rec) {
    // 지난 날짜 기록은 최근 14일만 남긴다
    this.data.daily[day] = rec;
    const keys = Object.keys(this.data.daily).sort();
    while (keys.length > 14) delete this.data.daily[keys.shift()];
  }
}
