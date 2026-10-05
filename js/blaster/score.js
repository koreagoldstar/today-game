/*
 * 물총 대작전 엔진 · ScoreSystem + ComboSystem
 */
export const POINTS = {
  hit: 100, // 흠뻑 적심
  fast: 150, // 나타나자마자 적심
  perfect: 300, // 한가운데 명중
  bonus: 500, // 보너스 대상
  weak: 1000, // 보스 약점
  chip: 10, // 아직 덜 젖음
};

// 콤보 → 배수 (x2 ~ x5)
const TIERS = [
  [30, 5],
  [20, 4],
  [10, 3],
  [5, 2],
];

export class ComboSystem {
  constructor(window = 3.2) {
    this.window = window;
    this.reset();
  }

  reset() {
    this.count = 0;
    this.timer = 0;
    this.max = 0;
    this.mult = 1;
  }

  add() {
    this.count++;
    this.timer = this.window;
    this.max = Math.max(this.max, this.count);
    const before = this.mult;
    this.mult = 1;
    for (const [n, m] of TIERS) {
      if (this.count >= n) {
        this.mult = m;
        break;
      }
    }
    return this.mult > before; // 배수가 올랐는지
  }

  break() {
    const had = this.count;
    this.count = 0;
    this.timer = 0;
    this.mult = 1;
    return had;
  }

  update(dt) {
    if (this.count <= 0) return false;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.break();
      return true;
    }
    return false;
  }

  get ratio() {
    return this.count > 0 ? Math.max(0, this.timer / this.window) : 0;
  }
}

export class ScoreSystem {
  constructor() {
    this.combo = new ComboSystem();
    this.reset();
  }

  reset() {
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.perfects = 0;
    this.fasts = 0;
    this.soaked = 0;
    this.escaped = 0;
    this.weakHits = 0;
    this.bonusHits = 0;
    this.heartsLost = 0;
    this.doubleT = 0; // 무지개 물총: 점수 2배
    this.combo.reset();
  }

  shot(n = 1) {
    this.shots += n;
  }

  hit() {
    this.hits++;
  }

  /** 점수를 더하고 실제로 얻은 점수를 돌려준다 */
  add(base, { combo = true } = {}) {
    let mult = combo ? this.combo.mult : 1;
    if (this.doubleT > 0) mult *= 2;
    const got = Math.round(base * mult);
    this.score += got;
    return { got, mult };
  }

  get accuracy() {
    return this.shots > 0 ? Math.min(1, this.hits / this.shots) : 0;
  }

  update(dt) {
    if (this.doubleT > 0) this.doubleT -= dt;
    return this.combo.update(dt);
  }

  /**
   * 등급: 적신 비율 50 + 명중률 30 + 남은 하트 20 → S(90) A(75) B(55) C
   * 점수 기준선을 스테이지마다 맞출 필요가 없어서 새 테마에도 그대로 쓸 수 있다.
   */
  grade({ total, heartsLeft, maxHearts, failed }) {
    if (failed) return { grade: "C", points: 0 };
    const soakRate = total > 0 ? Math.min(1, this.soaked / total) : 1;
    // 아이들은 많이 쏘는 게 자연스러워서 명중률 65% 면 만점
    const acc = Math.min(1, this.accuracy / 0.65);
    const hearts = maxHearts > 0 ? heartsLeft / maxHearts : 1;
    const points = Math.round(soakRate * 50 + acc * 30 + hearts * 20);
    const grade = points >= 90 ? "S" : points >= 75 ? "A" : points >= 55 ? "B" : "C";
    return { grade, points, soakRate, acc: this.accuracy };
  }
}

export const GRADE_ORDER = ["C", "B", "A", "S"];
export const betterGrade = (a, b) => (GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b);
