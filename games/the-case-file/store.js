/* 오늘의 사건파일 — 날짜 · 기록 저장 (화면과 분리: 나중에 서버 DB 로 옮길 때 이 파일만 바꾸면 됨)
 *  - 날짜는 언제나 서울(Asia/Seoul) 기준 YYYY-MM-DD
 *  - 저장소 한 덩어리(tg-casefile) 에 버전 번호 · 깨진 값이 와도 기본값으로 되돌림
 */
(() => {
  "use strict";
  const KEY = "tg-casefile";
  const VERSION = 1;
  const EPOCH = "2026-11-21"; // 이날 = 사건 001 · 하루에 한 사건씩 차례로

  /* ---------- 날짜 ---------- */
  function seoulDay(d = new Date()) {
    try {
      const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
      const g = (t) => p.find((x) => x.type === t).value;
      return `${g("year")}-${g("month")}-${g("day")}`;
    } catch (_) {
      return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10); // 서울은 서머타임이 없어 +9 고정
    }
  }
  const dayNum = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  };
  const addDays = (key, n) => new Date((dayNum(key) + n) * 86400000).toISOString().slice(0, 10);
  /** 오늘 사건 번호 (0부터) — 사건이 늘면 count 만 바꾸면 주기가 늘어남 */
  function caseIndexFor(key, count) {
    const n = dayNum(key) - dayNum(EPOCH);
    return ((n % count) + count) % count;
  }
  /** 이 사건(0부터)이 처음 공개되는 날 */
  function releaseDay(index) {
    return addDays(EPOCH, index);
  }
  /** ISO 주 (서울 날짜 기준) — 랭킹 서버(api/scores)와 같은 계산 */
  function weekId(key) {
    const [y, m, d] = key.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    const dn = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - dn);
    const ys = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return `${utc.getUTCFullYear()}-W${String(Math.ceil(((utc - ys) / 86400000 + 1) / 7)).padStart(2, "0")}`;
  }

  /* ---------- 저장 ---------- */
  const blank = () => ({ v: VERSION, cases: {}, daily: {}, streak: { last: "", count: 0, best: 0 }, sound: true, tutorial: false, progress: null, name: "" });
  function sane(o) {
    const b = blank();
    if (!o || typeof o !== "object" || o.v !== VERSION) return b;
    const out = { ...b, ...o };
    for (const k of ["cases", "daily"]) if (!out[k] || typeof out[k] !== "object" || Array.isArray(out[k])) out[k] = {};
    if (!out.streak || typeof out.streak !== "object") out.streak = b.streak;
    out.streak = { last: String(out.streak.last || ""), count: Number(out.streak.count) || 0, best: Number(out.streak.best) || 0 };
    if (out.progress && typeof out.progress !== "object") out.progress = null;
    return out;
  }
  let mem = null;
  function load() {
    if (mem) return mem;
    try {
      mem = sane(JSON.parse(localStorage.getItem(KEY) || "null"));
    } catch (_) {
      mem = blank();
    }
    return mem;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(mem || blank()));
    } catch (_) {}
  }

  /* ---------- 기록 ---------- */
  const GRADES = ["C", "B", "A", "S", "SS", "SSS"];
  const better = (a, b) => GRADES.indexOf(a) > GRADES.indexOf(b);

  /**
   * 사건 하나를 끝냈을 때.
   * mode "daily" = 그날 처음 받은 오늘의 사건 → 일일 기록(처음 한 번만) · 연속 참여
   * mode "replay" = 보관함에서 다시 하기 → 최고 기록만 갱신 (최초 · 일일 기록은 그대로)
   */
  function recordResult({ caseId, mode, day, score, grade, solved, hints, seconds, evidence }) {
    const s = load();
    const c = s.cases[caseId] || { plays: 0, best: 0, bestGrade: "", firstDay: "", firstScore: null, firstGrade: "", solvedDay: "" };
    c.plays += 1;
    if (score > c.best) c.best = score;
    if (!c.bestGrade || better(grade, c.bestGrade)) c.bestGrade = grade;
    if (!c.firstDay) {
      c.firstDay = day;
      c.firstScore = score;
      c.firstGrade = grade;
    }
    if (solved && !c.solvedDay) c.solvedDay = day;
    s.cases[caseId] = c;
    let dailyNew = false;
    if (mode === "daily" && !s.daily[day]) {
      s.daily[day] = { caseId, score, grade, solved, hints, seconds, evidence };
      dailyNew = true;
      const st = s.streak;
      if (st.last !== day) {
        st.count = st.last === addDays(day, -1) ? st.count + 1 : 1;
        st.last = day;
        st.best = Math.max(st.best, st.count);
      }
    }
    s.progress = null;
    save();
    return { dailyNew, record: c };
  }
  /** 이번 주(서울 · ISO 주) 오늘의 사건 점수 합 */
  function weekTotal(day) {
    const s = load();
    const w = weekId(day);
    return Object.entries(s.daily).reduce((sum, [d, r]) => (weekId(d) === w ? sum + (Number(r.score) || 0) : sum), 0);
  }
  /** 연속 참여: 어제나 오늘 참여했으면 이어지는 중 */
  function streakNow(day) {
    const st = load().streak;
    return st.last === day || st.last === addDays(day, -1) ? st.count : 0;
  }
  function stats() {
    const s = load();
    const ids = Object.keys(s.cases);
    const solved = ids.filter((k) => s.cases[k].solvedDay).length;
    const days = Object.values(s.daily);
    const avg = days.length ? Math.round(days.reduce((a, r) => a + (Number(r.score) || 0), 0) / days.length) : 0;
    const best = ids.reduce((m, k) => Math.max(m, s.cases[k].best || 0), 0);
    const total = days.reduce((a, r) => a + (Number(r.score) || 0), 0);
    return { solved, played: ids.length, avg, best, total, days: days.length };
  }
  /** 탐정 칭호 (오늘의 사건 누적 점수 기준) */
  function rank(total) {
    const T = [[0, "견습 탐정"], [1500, "수습 탐정"], [4000, "정식 탐정"], [8000, "베테랑 탐정"], [14000, "수석 탐정"], [22000, "전설의 명탐정"]];
    let r = T[0][1];
    for (const [min, name] of T) if (total >= min) r = name;
    return r;
  }

  function setProgress(p) {
    load().progress = p;
    save();
  }
  function getProgress() {
    return load().progress;
  }
  function set(key, value) {
    load()[key] = value;
    save();
  }

  window.CFStore = { seoulDay, addDays, dayNum, caseIndexFor, releaseDay, weekId, load, save, recordResult, weekTotal, streakNow, stats, rank, setProgress, getProgress, set, GRADES, EPOCH, KEY };
})();
