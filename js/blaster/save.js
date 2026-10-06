/*
 * 물총 대작전 엔진 · SaveSystem
 * 기기 안(localStorage)에만 저장한다. 서버로 보내는 것은 없다.
 */
import { betterGrade } from "./score.js?v=3";

const DEFAULTS = {
  v: 1,
  unlocked: 1, // 열린 스테이지 번호 (1부터)
  stages: {}, // id → { best, grade, combo, acc, plays, clears }
  bonus: {}, // 보너스 id → { best, unlocked }
  seen: {}, // 도감 id → 처음 발견한 시각
  fresh: {}, // 도감 NEW 표시
  boats: { "blue-shark": true },
  boat: "blue-shark",
  bestCombo: 0,
  totalSoaked: 0,
  usedItems: {},
  tutorial: false,
  settings: { music: true, sfx: true, vibrate: true, assist: true, effects: "high" },
};

export class SaveSystem {
  constructor(gameId) {
    this.key = `todaygame.${gameId}.v1`;
    this.data = this.load();
  }

  load() {
    let d = null;
    try {
      d = JSON.parse(localStorage.getItem(this.key) || "null");
    } catch (_) {
      d = null;
    }
    const base = JSON.parse(JSON.stringify(DEFAULTS));
    if (!d || typeof d !== "object") return base;
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, boats: { ...base.boats, ...(d.boats || {}) } };
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (_) {
      /* 저장 공간이 없어도 이번 판은 계속 */
    }
  }

  get settings() {
    return this.data.settings;
  }

  setSetting(k, v) {
    this.data.settings[k] = v;
    this.save();
  }

  stage(id) {
    return this.data.stages[id] || null;
  }

  /** 도감에 새로 등록되면 true */
  discover(id) {
    if (this.data.seen[id]) return false;
    this.data.seen[id] = Date.now();
    this.data.fresh[id] = true;
    this.save();
    return true;
  }

  isSeen(id) {
    return Boolean(this.data.seen[id]);
  }

  clearFresh(id) {
    if (!this.data.fresh[id]) return;
    delete this.data.fresh[id];
    this.save();
  }

  get freshCount() {
    return Object.keys(this.data.fresh).length;
  }

  /** 스테이지 결과 기록. 바뀐 점(신기록 등)을 돌려준다 */
  recordStage(id, index, r, totalStages) {
    const prev = this.data.stages[id] || { best: 0, grade: null, combo: 0, acc: 0, plays: 0, clears: 0 };
    const next = { ...prev, plays: prev.plays + 1 };
    const out = { newBest: false, unlockedNext: false, firstClear: false };
    if (r.cleared) {
      next.clears = prev.clears + 1;
      out.firstClear = prev.clears === 0;
      if (r.score > prev.best) {
        next.best = r.score;
        out.newBest = true;
      }
      next.grade = prev.grade ? betterGrade(r.grade, prev.grade) : r.grade;
      next.combo = Math.max(prev.combo, r.maxCombo);
      next.acc = Math.max(prev.acc, r.accuracy);
      if (index + 2 > this.data.unlocked && index + 1 < totalStages) {
        this.data.unlocked = index + 2;
        out.unlockedNext = true;
      }
    }
    this.data.stages[id] = next;
    if (r.maxCombo > this.data.bestCombo) this.data.bestCombo = r.maxCombo;
    this.data.totalSoaked += r.soaked || 0;
    this.save();
    return out;
  }

  recordBonus(id, score) {
    const prev = this.data.bonus[id] || { best: 0 };
    const newBest = score > prev.best;
    this.data.bonus[id] = { ...prev, best: Math.max(prev.best, score), plays: (prev.plays || 0) + 1 };
    this.save();
    return { newBest };
  }

  unlockBoat(id) {
    if (this.data.boats[id]) return false;
    this.data.boats[id] = true;
    this.save();
    return true;
  }

  setBoat(id) {
    if (!this.data.boats[id]) return;
    this.data.boat = id;
    this.save();
  }

  markItem(id) {
    this.data.usedItems[id] = (this.data.usedItems[id] || 0) + 1;
    this.save();
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULTS));
    this.save();
  }
}
