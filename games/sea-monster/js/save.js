/*
 * 바다괴물 탐험대 · 저장 (이 기기 localStorage 에만. 서버로 보내는 것은 없다)
 *  스테이지 진행 · 최고 점수 · 별 · 도감(발견 · 포획 횟수 · 처음 만난 날) · 코인 · 경험치 · 장비 · 오늘의 도전 · 최고 콤보
 */
import { dayKey } from "./view.js?v=1";

const KEY = "today-seamonster-v1";
const DEFAULTS = () => ({
  v: 1,
  unlocked: 1,
  stages: {},
  codex: {},
  coins: 0,
  xp: 0,
  equip: { gun: 0, radar: 0, suit: 0, tank: 0 },
  daily: null,
  bestCombo: 0,
  tutorial: false,
  fresh: {},
  settings: { music: true, sfx: true, vibrate: true },
});

export class Save {
  constructor() {
    this.data = DEFAULTS();
    this.load();
  }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const def = DEFAULTS();
        this.data = { ...def, ...d, equip: { ...def.equip, ...(d.equip || {}) }, settings: { ...def.settings, ...(d.settings || {}) } };
      }
    } catch (_) {
      this.data = DEFAULTS();
    }
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (_) {}
  }

  stage(id) {
    return this.data.stages[id] || { best: 0, stars: 0, plays: 0, clears: 0, bestTime: 0 };
  }

  /** 괴물을 처음 발견하면 도감에 '발견' 표시 (잡기 전에도 그림이 보인다) */
  seen(id) {
    const c = this.data.codex[id] || (this.data.codex[id] = { seen: 0, caught: 0, first: "" });
    const fresh = !c.seen;
    if (fresh) {
      c.seen = Date.now();
      c.first = dayKey();
      this.data.fresh[id] = true;
    }
    return fresh;
  }
  caught(id) {
    const c = this.data.codex[id] || (this.data.codex[id] = { seen: Date.now(), caught: 0, first: dayKey() });
    c.caught++;
    if (c.caught === 1) this.data.fresh[id] = true;
    return c.caught === 1;
  }
  codex(id) {
    return this.data.codex[id] || null;
  }

  /** 스테이지 결과 기록 → { newBest, newStars, unlockedNext } */
  record(stage, r, total) {
    const d = this.data;
    const s = { ...this.stage(stage.id) };
    s.plays++;
    const newBest = r.score > s.best;
    if (newBest) s.best = r.score;
    const newStars = r.stars > s.stars;
    if (newStars) s.stars = r.stars;
    let unlockedNext = false;
    if (r.clear) {
      s.clears++;
      if (!s.bestTime || r.time < s.bestTime) s.bestTime = r.time;
      if (d.unlocked < Math.min(total, stage.no + 1)) {
        d.unlocked = Math.min(total, stage.no + 1);
        unlockedNext = true;
      }
    }
    d.stages[stage.id] = s;
    d.coins += r.coins;
    d.xp += r.xp;
    if (r.maxCombo > d.bestCombo) d.bestCombo = r.maxCombo;
    this.save();
    return { newBest, newStars, unlockedNext };
  }

  totalStars() {
    return Object.values(this.data.stages).reduce((a, s) => a + (s.stars || 0), 0);
  }

  setSetting(k, v) {
    this.data.settings[k] = v;
    this.save();
  }
}
