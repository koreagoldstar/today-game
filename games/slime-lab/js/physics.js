/*
 * 말랑팡! 슬라임 연구소 · 물리 (동그란 슬라임 · 용기 벽/바닥)
 *  작은 걸음(서브스텝) 위치 기반 방식: 매 걸음 위치를 먼저 옮기고 겹친 만큼 밀어낸 뒤, 옮긴 거리로 속도를 다시 구한다.
 *   → 많이 쌓여도 떨리거나 서로 파고들지 않는다.
 *  튕김 · 마찰은 속도 단계에서 따로 · 속도 제한 · NaN 막기 · 용기 밖으로 못 나감 (벽은 위로 끝없이)
 *  합체는 여기서 하지 않는다 (sameTouch 로 '같은 단계끼리 닿은 쌍'만 알려 줌 → game.js 가 한 번에 처리)
 */
import { JAR, PHYS } from "./config.js?v=1";

export class World {
  constructor() {
    this.bodies = [];
    this.W = JAR.W;
    this.H = JAR.H;
    // 매 걸음 만드는 접촉 정보는 미리 만들어 둔 칸을 다시 씀 (게임 루프에서 객체를 새로 만들지 않게)
    this.cs = [];
    this.nc = 0;
    this.impacts = []; // 이번 프레임 세게 부딪힌 것 (소리 · 말랑 효과용)
    this.fixes = 0; // NaN 등을 바로잡은 횟수 (점검용)
  }
  clear() {
    this.bodies.length = 0;
    this.impacts.length = 0;
  }
  add(b) {
    this.bodies.push(b);
    return b;
  }
  /** 죽은 슬라임 치우기 (합체 · 사라짐 뒤) */
  sweep() {
    let j = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.alive) this.bodies[j++] = b;
    }
    this.bodies.length = j;
  }
  contact() {
    let c = this.cs[this.nc];
    if (!c) c = this.cs[this.nc] = { a: null, b: null, nx: 0, ny: 0, pen: 0, vn0: 0 };
    this.nc++;
    return c;
  }
  step(dt) {
    const n = PHYS.sub;
    const h = dt / n;
    this.impacts.length = 0;
    for (const b of this.bodies) b.touch = 0;
    for (let s = 0; s < n; s++) this.substep(h);
    this.guard();
  }
  substep(h) {
    const B = this.bodies;
    const g = PHYS.gravity;
    const damp = Math.max(0, 1 - PHYS.airDamp * h);
    const vmax = PHYS.maxSpeed;
    const W = this.W;
    const H = this.H;
    // 1) 움직임 예측
    for (const b of B) {
      if (!b.alive) continue;
      b.px = b.x;
      b.py = b.y;
      b.vx *= damp;
      b.vy = b.vy * damp + g * h;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > vmax) {
        b.vx *= vmax / sp;
        b.vy *= vmax / sp;
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
    // 2) 겹침 풀기 (슬라임끼리 · 벽 · 바닥)
    this.nc = 0;
    const len = B.length;
    for (let i = 0; i < len; i++) {
      const a = B[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < len; j++) {
        const b = B[j];
        if (!b.alive) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const rr = a.r + b.r;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        let d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) {
          // 완전히 같은 자리: 살짝 옆으로
          dx = (a.id < b.id ? 1 : -1) * 0.01;
          dy = 0;
          d = 0.01;
        }
        const nx = dx / d;
        const ny = dy / d;
        const pen = rr - d;
        const wsum = a.w + b.w;
        const k = pen / wsum;
        a.x -= nx * k * a.w;
        a.y -= ny * k * a.w;
        b.x += nx * k * b.w;
        b.y += ny * k * b.w;
        const c = this.contact();
        c.a = a;
        c.b = b;
        c.nx = nx;
        c.ny = ny;
        c.pen = pen;
        c.vn0 = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        a.touch++;
        b.touch++;
      }
    }
    for (const b of B) {
      if (!b.alive) continue;
      // 벽 (위로 끝없이) · 바닥
      if (b.x < b.r) this.wall(b, b.r - b.x, 1, 0), (b.x = b.r);
      else if (b.x > W - b.r) this.wall(b, b.x - (W - b.r), -1, 0), (b.x = W - b.r);
      if (b.y > H - b.r) this.wall(b, b.y - (H - b.r), 0, -1), (b.y = H - b.r);
    }
    // 3) 옮긴 거리로 속도
    for (const b of B) {
      if (!b.alive) continue;
      b.vx = (b.x - b.px) / h;
      b.vy = (b.y - b.py) / h;
    }
    // 4) 튕김 · 마찰 (속도 단계)
    const gh2 = 2 * g * h;
    for (let i = 0; i < this.nc; i++) {
      const c = this.cs[i];
      const a = c.a;
      const b = c.b;
      const wsum = b ? a.w + b.w : a.w;
      const rvx = (b ? b.vx : 0) - a.vx;
      const rvy = (b ? b.vy : 0) - a.vy;
      const vn = rvx * c.nx + rvy * c.ny;
      // 튕김: 다가오던 속도의 일부만 되돌림 (아주 느리면 튕기지 않음 → 쌓인 것이 떨지 않게)
      const e = Math.abs(c.vn0) < gh2 ? 0 : b ? PHYS.restitution : PHYS.wallRestitution;
      const dvn = -vn + Math.max(-e * c.vn0, 0);
      // 마찰: 미끄러지는 속도를 누른 힘만큼 줄임
      const tx = rvx - c.nx * vn;
      const ty = rvy - c.ny * vn;
      const vt = Math.hypot(tx, ty);
      let fx = 0;
      let fy = 0;
      if (vt > 1e-6) {
        const lim = Math.min((PHYS.friction * c.pen) / h, vt);
        fx = (-tx / vt) * lim;
        fy = (-ty / vt) * lim;
      }
      const dx = c.nx * dvn + fx;
      const dy = c.ny * dvn + fy;
      if (b) {
        a.vx -= (dx * a.w) / wsum;
        a.vy -= (dy * a.w) / wsum;
        b.vx += (dx * b.w) / wsum;
        b.vy += (dy * b.w) / wsum;
      } else {
        // 벽: 벽 쪽은 안 움직이니 슬라임만 (벽 법선은 슬라임 쪽을 향함 → 부호 반대로)
        a.vx -= dx;
        a.vy -= dy;
      }
      // 세게 부딪힘 → 말랑 효과 · 소리
      if (c.vn0 < -140) this.impacts.push(a, b, c.nx, c.ny, -c.vn0);
    }
  }
  /** 벽 접촉도 같은 방식으로 기록 (b = null · 법선은 벽에서 슬라임 반대쪽 = 슬라임이 벽을 향하는 방향) */
  wall(a, pen, nx, ny) {
    const c = this.contact();
    c.a = a;
    c.b = null;
    // 슬라임 → 벽 방향이 '다가오는' 쪽이 되도록 (상대 속도 = 0 - v)
    c.nx = -nx;
    c.ny = -ny;
    c.pen = pen;
    c.vn0 = -a.vx * c.nx - a.vy * c.ny;
    a.touch++;
  }
  /** 이상한 값(NaN · 무한 · 용기 밖) 바로잡기 */
  guard() {
    for (const b of this.bodies) {
      if (!b.alive) continue;
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy)) {
        b.x = this.W / 2;
        b.y = JAR.SPAWN_Y;
        b.vx = b.vy = 0;
        this.fixes++;
      }
      if (b.x < b.r) b.x = b.r;
      if (b.x > this.W - b.r) b.x = this.W - b.r;
      if (b.y > this.H - b.r) b.y = this.H - b.r;
      // 겹침을 풀며 붙은 속도까지 포함해 최고 속도 넘지 않게
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > PHYS.maxSpeed) {
        b.vx *= PHYS.maxSpeed / sp;
        b.vy *= PHYS.maxSpeed / sp;
      }
    }
  }
  /** 같은 단계끼리 닿은 쌍 (가까운 것부터) → out 배열에 [a,b,...] 로 */
  sameTouch(out, canMerge) {
    out.length = 0;
    const B = this.bodies;
    const slop = PHYS.mergeSlop;
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      if (!a.alive || !canMerge(a)) continue;
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j];
        if (!b.alive || b.level !== a.level || !canMerge(b)) continue;
        const rr = a.r + b.r + slop;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy <= rr * rr) out.push(a, b);
      }
    }
    return out;
  }
  /** x 에 떨어뜨리면 처음 닿을 높이 (안내선용 · 대략) */
  landY(x, r) {
    let best = this.H - r;
    for (const b of this.bodies) {
      if (!b.alive) continue;
      const dx = Math.abs(b.x - x);
      const rr = b.r + r;
      if (dx >= rr) continue;
      const y = b.y - Math.sqrt(rr * rr - dx * dx);
      if (y < best) best = y;
    }
    return best;
  }
  /** 전체 움직임 (점검용: 다 멈췄나) */
  energy() {
    let e = 0;
    for (const b of this.bodies) if (b.alive) e += b.vx * b.vx + b.vy * b.vy;
    return e;
  }
}
