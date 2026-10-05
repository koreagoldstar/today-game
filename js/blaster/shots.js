/*
 * 물총 대작전 엔진 · 적이 던지는 것(EnemyShot)과 아이템 방울(ItemBubble)
 * 둘 다 물총으로 맞혀 터뜨릴 수 있다.
 */
import { project, lerp, rand } from "./view.js?v=2";

export const BOAT_Z = 1.0;

export class EnemyShot {
  /**
   * kind: 콘텐츠 projectiles 데이터의 키 ('balloon', 'ink', ...)
   * from: {x, z, h} · opts: { dur, dx, x1, z1, h1, arc, straight, delay }
   */
  constructor(kind, data, from, opts = {}) {
    this.kind = kind;
    this.d = data || {};
    this.x0 = from.x;
    this.z0 = from.z;
    this.h0 = (from.h || 0) + (opts.h0 != null ? opts.h0 : 40);
    const toBoat = !opts.straight;
    this.x1 = opts.x1 != null ? opts.x1 : toBoat ? (opts.dx || 0) + rand(-0.04, 0.04) : from.x;
    this.z1 = opts.z1 != null ? opts.z1 : BOAT_Z + 0.02;
    this.h1 = opts.h1 != null ? opts.h1 : 70;
    this.arc = opts.arc != null ? opts.arc : this.d.arc != null ? this.d.arc : 140;
    this.dur = (opts.dur || 2.4) * (this.d.durMul || 1);
    this.delay = opts.delay || 0;
    this.t = 0;
    this.hp = this.d.hp || 1;
    this.alive = true;
    this.spin = rand(-4, 4);
    this.rot = 0;
    this.age = 0;
    // 보트에 닿는 궤도인지 (벽처럼 곧게 오는 것은 보트 줄에 있을 때만 위험)
    this.danger = Math.abs(this.x1) < (opts.lane || 0.32);
    this.x = this.x0;
    this.z = this.z0;
    this.h = this.h0;
    this.sx = 0;
    this.sy = 0;
    this.s = 1;
    this.hr = 10;
  }

  get targetable() {
    return this.alive && this.delay <= 0 && this.t > 0.03;
  }

  update(dt, speed = 1) {
    if (this.delay > 0) {
      this.delay -= dt;
      return null;
    }
    this.age += dt;
    this.t += (dt / this.dur) * speed;
    const t = Math.min(1, this.t);
    // 앞으로 올수록 빨라 보이게 (원근)
    const tz = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
    this.x = lerp(this.x0, this.x1, t);
    this.z = lerp(this.z0, this.z1, tz);
    this.h = lerp(this.h0, this.h1, t) + Math.sin(t * Math.PI) * this.arc;
    this.rot += this.spin * dt;
    if (this.t >= 1) {
      this.alive = false;
      return this.danger ? "boat" : "water";
    }
    return null;
  }

  layout() {
    const p = project(this.x, this.z, this.h);
    this.sx = p.sx;
    this.sy = p.sy;
    this.s = p.s;
    // 가까이 올수록 조금 더 맞히기 쉽게
    this.hr = (this.d.size || 18) * p.s * 1.35 + 6;
  }
}

export class ItemBubble {
  constructor(id, data, opts = {}) {
    this.id = id;
    this.d = data;
    this.x = opts.x != null ? opts.x : rand(-0.7, 0.7);
    this.z = opts.z != null ? opts.z : rand(0.25, 0.55);
    this.h = 0;
    this.baseH = opts.h != null ? opts.h : rand(70, 130);
    this.vx = (Math.random() < 0.5 ? -1 : 1) * rand(0.04, 0.09);
    this.age = 0;
    this.life = opts.life || 8;
    this.alive = true;
    this.carried = false;
    this.sx = 0;
    this.sy = 0;
    this.s = 1;
    this.hr = 30;
  }

  get targetable() {
    return this.alive && !this.carried;
  }

  update(dt) {
    this.age += dt;
    if (this.carried) return;
    this.x += this.vx * dt;
    if (Math.abs(this.x) > 0.95) this.vx = -this.vx;
    this.h = Math.min(this.baseH, this.age * 260) + Math.sin(this.age * 2.4) * 10;
    if (this.age > this.life) this.alive = false;
  }

  layout() {
    const p = project(this.x, this.z, this.h);
    this.sx = p.sx;
    this.sy = p.sy;
    this.s = p.s;
    this.hr = 34 * p.s + 10;
  }
}
