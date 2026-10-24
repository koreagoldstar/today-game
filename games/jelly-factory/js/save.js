/*
 * 말랑콩떡! 젤리 공장 · 기록 저장 (이 기기 브라우저에만 · 다른 기기와 동기화 없음)
 *  저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 게임은 그대로 된다 → 이번 방문 동안만 기억.
 */
const KEY = "today-jelly-factory-v1";

const DEFAULT = () => ({
  v: 1,
  stages: {}, // 스테이지 번호: { stars, moves(가장 적게 쓴 이동), score(최고 점수) }
  score: { best: 0, maxGroup: 0, maxCombo: 0, games: 0 }, // 점수 도전
  daily: {}, // "2026-10-24": { stars, moves, score, tries }
  dex: {}, // 도감 열쇠: 처음 만난 날
  settings: { sound: true, reduced: null }, // reduced: null = 기기 설정 따름
});

/** 서울 날짜 "YYYY-MM-DD" */
export function seoulDate(d = new Date()) {
  return d.toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
}

export class Save {
  constructor(storage) {
    this.ok = true;
    this.data = DEFAULT();
    this.store = storage;
    try {
      if (this.store === undefined) this.store = window.localStorage;
      const raw = this.store.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === "object") {
          const def = DEFAULT();
          this.data = {
            ...def,
            stages: { ...(d.stages || {}) },
            score: { ...def.score, ...(d.score || {}) },
            daily: { ...(d.daily || {}) },
            dex: { ...(d.dex || {}) },
            settings: { ...def.settings, ...(d.settings || {}) },
          };
        }
      }
    } catch (_) {
      this.ok = false;
    }
  }
  write() {
    try {
      this.store.setItem(KEY, JSON.stringify(this.data));
      this.ok = true;
    } catch (_) {
      this.ok = false; // 저장 실패해도 게임은 계속
    }
  }
  /* ---------- 스테이지 ---------- */
  stage(id) {
    return this.data.stages[id] || null;
  }
  stars(id) {
    return (this.data.stages[id] && this.data.stages[id].stars) || 0;
  }
  totalStars() {
    return Object.values(this.data.stages).reduce((a, s) => a + ((s && s.stars) || 0), 0);
  }
  cleared(id) {
    return this.stars(id) > 0;
  }
  /** 깬 스테이지 기록 → { newBest(점수), moreStars } */
  recordStage(id, { stars, moves, score }) {
    const old = this.data.stages[id] || { stars: 0, moves: 0, score: 0 };
    const res = { moreStars: stars > old.stars, newBest: score > old.score, first: !old.stars };
    this.data.stages[id] = {
      stars: Math.max(old.stars, stars),
      moves: old.moves ? Math.min(old.moves, moves) : moves,
      score: Math.max(old.score, score),
    };
    this.write();
    return res;
  }
  /* ---------- 점수 도전 ---------- */
  recordScore({ score, maxGroup, maxCombo }) {
    const s = this.data.score;
    const newBest = score > s.best;
    s.best = Math.max(s.best, score);
    s.maxGroup = Math.max(s.maxGroup, maxGroup);
    s.maxCombo = Math.max(s.maxCombo, maxCombo);
    s.games++;
    this.write();
    return newBest;
  }
  /* ---------- 오늘의 퍼즐 ---------- */
  dailyOf(date) {
    return this.data.daily[date] || null;
  }
  /** 퍼즐 날짜(시작한 날) 기준으로 기록 */
  recordDaily(date, { ok, stars = 0, moves = 0, score = 0 }) {
    const old = this.data.daily[date] || { stars: 0, moves: 0, score: 0, tries: 0 };
    const d = { ...old, tries: old.tries + 1 };
    if (ok) {
      d.stars = Math.max(old.stars, stars);
      d.moves = old.moves ? Math.min(old.moves, moves) : moves;
      d.score = Math.max(old.score, score);
    }
    this.data.daily[date] = d;
    // 오래된 기록은 60일치만
    const keys = Object.keys(this.data.daily).sort();
    while (keys.length > 60) delete this.data.daily[keys.shift()];
    this.write();
    return d;
  }
  /** 오늘까지 연속으로 깬 날 */
  dailyStreak(today) {
    let n = 0;
    const d = new Date(today + "T12:00:00+09:00");
    for (;;) {
      const k = seoulDate(d);
      const r = this.data.daily[k];
      if (!r || !r.stars) {
        if (n === 0 && k === today) {
          d.setDate(d.getDate() - 1); // 오늘 아직 안 했으면 어제부터
          const y = this.data.daily[seoulDate(d)];
          if (!y || !y.stars) return 0;
          continue;
        }
        return n;
      }
      n++;
      d.setDate(d.getDate() - 1);
    }
  }
  /* ---------- 도감 ---------- */
  discover(key) {
    if (this.data.dex[key]) return false;
    this.data.dex[key] = seoulDate();
    this.write();
    return true;
  }
  found(key) {
    return this.data.dex[key] || null;
  }
  setSetting(k, v) {
    this.data.settings[k] = v;
    this.write();
  }
}
