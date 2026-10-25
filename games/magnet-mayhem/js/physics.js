/*
 * 자석 대소동 · 물리 엔진 (화면과 상관없는 순수 계산 — 게임 · 자동 풀이 점검이 같은 코드를 씀)
 *
 *  - 몸체: 상자(회전 없는 직사각형) · 공(원). 고정 · 움직이는 고정(발판 · 리프트) · 움직이는 몸체
 *  - 고정된 짧은 걸음(1/120초)으로만 계산 → 같은 입력이면 언제나 같은 결과 (풀이 재생으로 검증 가능)
 *  - 한 걸음: 힘 → 속도 → 접촉 찾기 → 속도 맞추기(충돌 · 마찰 · 튕김, 여러 번) → 위치 → 겹침 풀기
 *  - 컨베이어: 표면 속도(접촉 마찰이 그 속도로 끌어감) · 발판 · 리프트: 속도를 가진 고정 몸체
 *  - 안전장치: 속도 상한 · 힘 상한 · NaN 이면 처음 자리로
 */
export const DT = 1 / 120;
export const GRAVITY = 1900;
export const MAX_SPEED = 1300;
const SLOP = 0.4; // 이 정도 겹침은 그대로 둠 (떨림 방지)
const CORRECT = 0.8; // 겹침을 한 번에 풀 비율
const REST_V = 70; // 이보다 느리게 부딪히면 튕기지 않음 (쌓인 물체가 떨리지 않게)
const ITER = 8;

let NEXT_ID = 1;

export class Body {
  constructor(o) {
    this.id = o.id || `b${NEXT_ID++}`;
    this.type = o.type || "dynamic"; // dynamic | static | kinematic
    this.shape = o.shape || "box"; // box | circle
    this.x = o.x;
    this.y = o.y;
    this.hw = o.w != null ? o.w / 2 : o.r || 10;
    this.hh = o.h != null ? o.h / 2 : o.r || 10;
    this.r = o.r || Math.min(this.hw, this.hh);
    this.vx = o.vx || 0;
    this.vy = o.vy || 0;
    this.m = this.type === "dynamic" ? o.m || 1 : 0;
    this.im = this.m ? 1 / this.m : 0;
    this.e = o.e != null ? o.e : 0.1; // 튕김
    this.mu = o.mu != null ? o.mu : 0.5; // 마찰
    this.surf = o.surf || 0; // 위쪽 면이 오른쪽(+)/왼쪽(-)으로 움직이는 속도 (컨베이어)
    this.mat = o.mat || "wall";
    this.fx = 0;
    this.fy = 0;
    this.gscale = o.gscale != null ? o.gscale : 1;
    this.solid = o.solid !== false; // false 면 부딪히지 않음 (센서 · 꺼진 문)
    this.px = this.x; // 지난 걸음 위치 (모서리 걸림 방지용)
    this.py = this.y;
    this.home = { x: this.x, y: this.y };
    this.ground = null; // 지금 밟고 있는 몸체
    this.groundVx = 0; // 밟고 있는 것의 가로 속도 (+ 컨베이어)
    this.touch = 0; // 이번 걸음 접촉 수
    this.hit = 0; // 이번 걸음 가장 세게 부딪힌 속도 (소리 · 효과)
    this.angle = 0; // 공 굴러감 (그림만)
    this.data = o.data || {};
  }
  get left() {
    return this.x - this.hw;
  }
  get right() {
    return this.x + this.hw;
  }
  get top() {
    return this.y - this.hh;
  }
  get bottom() {
    return this.y + this.hh;
  }
}

/** 두 몸체 접촉 → { nx, ny (a→b), pen } 또는 null */
function collide(a, b) {
  if (a.shape === "box" && b.shape === "box") return boxBox(a, b);
  if (a.shape === "circle" && b.shape === "circle") return circleCircle(a, b);
  // circleBox 는 원 → 상자 방향 노멀을 돌려줌 (a→b 로 맞춤)
  if (a.shape === "circle") return circleBox(a, b);
  const c = circleBox(b, a);
  if (c) {
    c.nx = -c.nx;
    c.ny = -c.ny;
  }
  return c;
}
function boxBox(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ox = a.hw + b.hw - Math.abs(dx);
  const oy = a.hh + b.hh - Math.abs(dy);
  if (ox <= 0 || oy <= 0) return null;
  // 지난 걸음에 어느 쪽으로 떨어져 있었나 (바닥 이음매에 걸리지 않게)
  const pox = a.hw + b.hw - Math.abs(b.px - a.px);
  const poy = a.hh + b.hh - Math.abs(b.py - a.py);
  let alongY;
  if (poy <= 0.5 && pox > 0.5) alongY = true;
  else if (pox <= 0.5 && poy > 0.5) alongY = false;
  else alongY = oy < ox;
  // 상자 무게중심이 모서리 밖이면 모서리에 얹히지 않고 떨어짐 (회전이 없어 생기는 '모서리 걸림' 막기 · 마그는 제외)
  if (alongY && oy < 6) {
    const d = a.type === "dynamic" ? a : b;
    const s = d === a ? b : a;
    if (s.type !== "dynamic" && !d.data.robot && (d.x < s.left || d.x > s.right)) alongY = false;
  }
  if (alongY) return { nx: 0, ny: dy >= 0 ? 1 : -1, pen: oy };
  return { nx: dx >= 0 ? 1 : -1, ny: 0, pen: ox };
}
function circleCircle(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const rs = a.r + b.r;
  if (d2 >= rs * rs) return null;
  const d = Math.sqrt(d2) || 0.0001;
  return { nx: dx / d, ny: dy / d, pen: rs - d };
}
/** 원(c) 과 상자(b) → 노멀은 원에서 상자 쪽 */
function circleBox(c, b) {
  const cx = Math.max(b.left, Math.min(c.x, b.right));
  const cy = Math.max(b.top, Math.min(c.y, b.bottom));
  let dx = c.x - cx;
  let dy = c.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 > 0) {
    if (d2 >= c.r * c.r) return null;
    const d = Math.sqrt(d2);
    return { nx: -dx / d, ny: -dy / d, pen: c.r - d };
  }
  // 원 중심이 상자 안: 가장 가까운 면으로
  const l = c.x - b.left;
  const r = b.right - c.x;
  const t = c.y - b.top;
  const bt = b.bottom - c.y;
  const m = Math.min(l, r, t, bt);
  if (m === t) return { nx: 0, ny: 1, pen: t + c.r };
  if (m === bt) return { nx: 0, ny: -1, pen: bt + c.r };
  if (m === l) return { nx: 1, ny: 0, pen: l + c.r };
  return { nx: -1, ny: 0, pen: r + c.r };
}

export class World {
  constructor({ w = 960, h = 540 } = {}) {
    this.w = w;
    this.h = h;
    this.bodies = [];
    this.contacts = [];
    this.fixes = 0;
  }
  add(b) {
    this.bodies.push(b);
    return b;
  }
  remove(b) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  }
  /** 한 걸음 (dt 고정) */
  step(dt = DT) {
    const B = this.bodies;
    for (const b of B) {
      b.px = b.x;
      b.py = b.y;
      b.ground = null;
      b.groundVx = 0;
      b.touch = 0;
      b.hit = 0;
      if (b.type !== "dynamic") continue;
      b.vx += (b.fx * b.im) * dt;
      b.vy += (GRAVITY * b.gscale + b.fy * b.im) * dt;
      b.fx = 0;
      b.fy = 0;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) {
        b.vx *= MAX_SPEED / sp;
        b.vy *= MAX_SPEED / sp;
      }
    }
    // 접촉 찾기 (물체 수가 적어 모두 맞대 봄 · 고정끼리는 안 봄)
    const C = (this.contacts = []);
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      if (!a.solid) continue;
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j];
        if (!b.solid || (a.type !== "dynamic" && b.type !== "dynamic")) continue;
        if (this.skip && this.skip(a, b)) continue;
        // 빠른 거르기 (넉넉한 사각형)
        if (Math.abs(a.x - b.x) > a.hw + b.hw + 2 || Math.abs(a.y - b.y) > a.hh + b.hh + 2) continue;
        const c = collide(a, b);
        if (!c) continue;
        c.a = a;
        c.b = b;
        c.jn = 0;
        c.jt = 0;
        // 공은 구르므로 둘 중 작은 마찰 (굴러가는 느낌) · 나머지는 평균
        c.mu = a.shape === "circle" || b.shape === "circle" ? Math.min(a.mu, b.mu) : Math.sqrt(a.mu * b.mu);
        // 컨베이어 고무 띠는 공도 꽉 잡아 실어 나름 (마그는 걷기 코드가 따로 맞춤)
        if ((a.mat === "belt" && b.shape === "circle") || (b.mat === "belt" && a.shape === "circle")) c.mu = Math.max(c.mu, 0.5);
        // 옆면끼리는 미끄럽게 (밀어서 벽에 끼워도 물체가 공중에 걸리지 않게)
        if (Math.abs(c.nx) > 0.5) c.mu *= 0.12;
        c.e = Math.max(a.e, b.e);
        // 표면 속도: 밑에 깔린 쪽이 컨베이어면 그 윗면이 가로로 움직임 (ny<0: a 가 아래 · ny>0: b 가 아래)
        c.sax = c.ny < -0.5 ? a.surf : 0;
        c.sbx = c.ny > 0.5 ? b.surf : 0;
        const vn = (b.vx - a.vx) * c.nx + (b.vy - a.vy) * c.ny;
        c.bounce = vn < -REST_V ? -c.e * vn : 0;
        a.touch++;
        b.touch++;
        if (-vn > a.hit) a.hit = -vn;
        if (-vn > b.hit) b.hit = -vn;
        C.push(c);
      }
    }
    // 속도 맞추기
    for (let it = 0; it < ITER; it++) {
      for (const c of C) {
        const { a, b } = c;
        const sum = a.im + b.im;
        if (!sum) continue;
        let rvx = b.vx - a.vx;
        let rvy = b.vy - a.vy;
        const vn = rvx * c.nx + rvy * c.ny;
        let jn = (-(vn - c.bounce)) / sum;
        const old = c.jn;
        c.jn = Math.max(0, old + jn);
        jn = c.jn - old;
        a.vx -= jn * c.nx * a.im;
        a.vy -= jn * c.ny * a.im;
        b.vx += jn * c.nx * b.im;
        b.vy += jn * c.ny * b.im;
        // 마찰 (접선 방향) — 컨베이어는 표면 속도까지
        const tx = -c.ny;
        const ty = c.nx;
        rvx = b.vx + c.sbx - (a.vx + c.sax);
        rvy = b.vy - a.vy;
        const vt = rvx * tx + rvy * ty;
        let jt = -vt / sum;
        const maxF = c.mu * c.jn;
        const oldT = c.jt;
        c.jt = Math.max(-maxF, Math.min(maxF, oldT + jt));
        jt = c.jt - oldT;
        a.vx -= jt * tx * a.im;
        a.vy -= jt * ty * a.im;
        b.vx += jt * tx * b.im;
        b.vy += jt * ty * b.im;
      }
    }
    // 위치
    for (const b of B) {
      if (b.type === "static") continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.shape === "circle" && b.type === "dynamic") b.angle += (b.vx * dt) / b.r;
    }
    // 겹침 풀기 (위치만)
    for (let it = 0; it < 3; it++) {
      for (const c of C) {
        const { a, b } = c;
        const sum = a.im + b.im;
        if (!sum) continue;
        const cc = collide(a, b);
        if (!cc) continue;
        const k = (Math.max(0, cc.pen - SLOP) * CORRECT) / sum;
        a.x -= cc.nx * k * a.im;
        a.y -= cc.ny * k * a.im;
        b.x += cc.nx * k * b.im;
        b.y += cc.ny * k * b.im;
      }
    }
    // 밟고 있는 것 (노멀이 위쪽인 접촉)
    for (const c of C) {
      if (c.jn <= 0) continue;
      if (c.ny > 0.6) {
        // a 가 위, b 가 아래? → ny 는 a→b. ny>0 이면 b 가 아래 (y 가 아래로 큼)
        c.a.ground = c.b;
        c.a.groundVx = c.b.vx + (c.b.surf || 0);
      } else if (c.ny < -0.6) {
        c.b.ground = c.a;
        c.b.groundVx = c.a.vx + (c.a.surf || 0);
      }
    }
    // NaN 막기
    for (const b of B) {
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy)) {
        b.x = b.home.x;
        b.y = b.home.y;
        b.vx = b.vy = 0;
        this.fixes++;
      }
    }
  }
}

/** 사각형 겹침 */
export function overlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
export function rectHas(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
