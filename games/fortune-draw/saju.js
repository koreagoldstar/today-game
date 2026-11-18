/**
 * 만세력 (양력 → 사주 네 기둥) · 십신 · 지지 관계
 *  - 일주: 1949-10-01 = 갑자일 기준으로 60갑자를 셈
 *  - 연주: 입춘(태양 황경 315°) 전이면 전 해
 *  - 월주: 12절(입춘 · 경칩 · 청명 … 소한) 시각으로 나눔, 월간은 오호둔(五虎遁)
 *  - 시주: 시진(자시 23:30~01:30 …, 한국 경도 보정 반영), 시간은 오서둔(五鼠遁)
 *  - 절기 시각은 태양 황경 근사식(오차 약 15분)으로 계산
 */
(() => {
  "use strict";

  const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
  const STEMS_H = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
  const BRANCHES_H = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const ANIMALS = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
  const EL = ["목", "화", "토", "금", "수"]; // 상생 순서
  const EL_H = ["木", "火", "土", "金", "水"];
  const STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  const BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  const HOURS = ["23:30~01:30", "01:30~03:30", "03:30~05:30", "05:30~07:30", "07:30~09:30", "09:30~11:30", "11:30~13:30", "13:30~15:30", "15:30~17:30", "17:30~19:30", "19:30~21:30", "21:30~23:30"];

  const DAY = 86400000;
  const KST = 9 * 3600000;
  const mod = (a, n) => ((a % n) + n) % n;

  /* ---------- 일주 ---------- */
  const dayNo = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY);
  const REF_DAY = dayNo(1949, 10, 1); // 갑자일
  const dayIndex = (y, m, d) => mod(dayNo(y, m, d) - REF_DAY, 60);

  /* ---------- 태양 황경 (도) ---------- */
  function sunLongitude(ms) {
    const jd = ms / DAY + 2440587.5;
    const T = (jd - 2451545.0) / 36525;
    const rad = Math.PI / 180;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const omega = (125.04 - 1934.136 * T) * rad;
    return mod(L0 + C - 0.00569 - 0.00478 * Math.sin(omega), 360);
  }

  /** y 년에 태양 황경이 deg 가 되는 순간 (UTC ms). 270° 이상(소한 · 입춘 · 경칩)은 그해 1~3월 */
  const termCache = new Map();
  function termTime(y, deg) {
    const key = `${y}:${deg}`;
    if (termCache.has(key)) return termCache.get(key);
    const YEAR = 365.2422 * DAY;
    let t = Date.UTC(y, 2, 20) + (deg / 360) * YEAR - (deg >= 270 ? YEAR : 0);
    for (let i = 0; i < 8; i += 1) {
      const diff = mod(deg - sunLongitude(t) + 180, 360) - 180;
      t += (diff / 360) * YEAR;
      if (Math.abs(diff) < 1e-6) break;
    }
    termCache.set(key, t);
    return t;
  }

  // 월 시작 절기: 인월(입춘 315°)부터 축월(소한 285°)까지
  const MONTH_TERMS = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285];
  const TERM_NAMES = ["입춘", "경칩", "청명", "입하", "망종", "소서", "입추", "백로", "한로", "입동", "대설", "소한"];

  /**
   * 사주 네 기둥
   * @param {{y:number,m:number,d:number,h:number|null}} b 양력 생년월일, h = 시진 번호(0=자시 … 11=해시) 또는 null(모름)
   */
  function pillars(b) {
    const midHour = b.h == null ? 12 : b.h * 2 + 0.5; // 시진 가운데 시각 (자시는 그날 00:30 으로 봄)
    const t = Date.UTC(b.y, b.m - 1, b.d) - KST + midHour * 3600000;
    const sy = t < termTime(b.y, 315) ? b.y - 1 : b.y;
    const yIdx = mod(sy - 4, 60);
    let k = 0;
    for (let i = 0; i < 12; i += 1) {
      if (t >= termTime(i === 11 ? sy + 1 : sy, MONTH_TERMS[i])) k = i;
    }
    const yStem = yIdx % 10;
    const mStem = mod((yStem % 5) * 2 + 2 + k, 10);
    const mBranch = (2 + k) % 12;
    const dIdx = dayIndex(b.y, b.m, b.d);
    const dStem = dIdx % 10;
    const out = {
      year: { s: yStem, b: yIdx % 12 },
      month: { s: mStem, b: mBranch },
      day: { s: dStem, b: dIdx % 12 },
      hour: null,
      monthTerm: TERM_NAMES[k],
    };
    if (b.h != null) out.hour = { s: mod((dStem % 5) * 2 + b.h, 10), b: b.h };
    return out;
  }

  /** 오늘(서울 날짜)의 일진 */
  function todayPillar(dateKey) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const i = dayIndex(y, m, d);
    return { s: i % 10, b: i % 12 };
  }

  /* ---------- 십신 ---------- */
  const GODS = [
    ["비견", "겁재"],
    ["식신", "상관"],
    ["편재", "정재"],
    ["편관", "정관"],
    ["편인", "정인"],
  ];
  /** 일간(me)에서 본 상대 천간(other)의 십신 */
  function tenGod(me, other) {
    const rel = mod(STEM_EL[other] - STEM_EL[me], 5);
    return GODS[rel][me % 2 === other % 2 ? 0 : 1];
  }

  /* ---------- 지지 관계 ---------- */
  const HAP = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  const SAMHAP = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]];
  function branchRelation(a, b) {
    if (a === b) return "same";
    if (mod(a - b, 12) === 6) return "chung";
    if (HAP.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return "hap";
    if (SAMHAP.some((g) => g.includes(a) && g.includes(b))) return "samhap";
    return "none";
  }

  const name = (p) => `${STEMS[p.s]}${BRANCHES[p.b]}`;
  const hanja = (p) => `${STEMS_H[p.s]}${BRANCHES_H[p.b]}`;

  /* ---------- 자체 점검 (기준값이 어긋나면 콘솔에 알림) ---------- */
  console.assert(dayIndex(1949, 10, 1) === 0 && name(todayPillar("2000-01-01")) === "무오", "만세력 일주 기준 오류");
  console.assert(mod(1984 - 4, 60) === 0, "만세력 연주 기준 오류");
  const ipchun2025 = termTime(2025, 315) + KST; // 2025-02-03 23:10 KST
  console.assert(Math.abs(ipchun2025 - Date.UTC(2025, 1, 3, 23, 10)) < 2 * 3600000, "만세력 입춘 시각 오류");
  const p2000 = pillars({ y: 2000, m: 1, d: 1, h: null }); // 기묘년 병자월 무오일
  console.assert(name(p2000.year) === "기묘" && name(p2000.month) === "병자" && name(p2000.day) === "무오", "만세력 네 기둥 오류");
  console.assert(tenGod(0, 6) === "편관" && tenGod(0, 1) === "겁재" && tenGod(4, 3) === "정인" && tenGod(4, 9) === "정재", "십신 계산 오류");

  window.Saju = { STEMS, STEMS_H, BRANCHES, BRANCHES_H, ANIMALS, EL, EL_H, STEM_EL, BRANCH_EL, HOURS, pillars, todayPillar, tenGod, branchRelation, termTime, name, hanja };
})();
