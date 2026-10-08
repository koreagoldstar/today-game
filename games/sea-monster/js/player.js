/*
 * 바다괴물 탐험대 · 탐험대장 지혁 (헤엄 · 조준 · 산소 · 다침)
 */
import { clamp, lerp, angLerp, rand, sign } from "./view.js?v=1";
import { drawDiver } from "../art/diver.js?v=1";

export const DIVER_SCALE = 0.72;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = 24;
    this.face = 1;
    this.pitch = -1;
    this.aim = 0;
    this.aimFree = true;
    this.kick = 0.3;
    this.alive = true;
    this.inv = 0;
    this.hurtT = 0;
    this.mood = "go";
    this.moodT = 0;
    this.breathT = 1;
    this.st = { t: 0 };
    this.speed = 250;
    this.accel = 1000;
    this.recoil = 0;
    this.control = true;
    this.lampOn = false;
  }

  setMood(m, t = 0.8) {
    this.mood = m;
    this.moodT = t;
  }

  /** move: 입력 벡터 · aimAt: 조준 세계 좌표 또는 null · firing */
  update(dt, move, aimAt, firing, world, fx) {
    this.st.t += dt;
    if (this.inv > 0) this.inv -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.moodT > 0) {
      this.moodT -= dt;
      if (this.moodT <= 0) this.mood = "go";
    }
    const mx = this.control ? move.x : 0;
    const my = this.control ? move.y : 0;
    // 물속: 천천히 가속 · 저항으로 멈춤
    this.vx += mx * this.accel * dt;
    this.vy += my * this.accel * dt;
    const drag = Math.exp(-(Math.abs(mx) + Math.abs(my) > 0 ? 2.4 : 3.2) * dt);
    this.vx *= drag;
    this.vy *= drag;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > this.speed) {
      this.vx *= this.speed / sp;
      this.vy *= this.speed / sp;
    }
    // 가만히 있으면 아주 살짝 둥실
    this.vy += Math.sin(this.st.t * 1.6) * 6 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const hit = world.push(this, this.r);
    if (hit) {
      const dot = this.vx * hit.nx + this.vy * hit.ny;
      if (dot < 0) {
        this.vx -= dot * hit.nx * 1.2;
        this.vy -= dot * hit.ny * 1.2;
      }
    }
    const spK = clamp(sp / this.speed, 0, 1);
    this.kick = lerp(this.kick, 0.25 + spK * 0.85, dt * 4);
    // 보는 방향: 조준 중이면 조준 쪽, 아니면 헤엄치는 쪽
    if (aimAt) {
      const want = Math.atan2(aimAt.y - (this.y - 6), aimAt.x - this.x);
      this.aim = angLerp(this.aim, want, Math.min(1, dt * 18));
      if (Math.abs(aimAt.x - this.x) > 12) this.face = aimAt.x >= this.x ? 1 : -1;
    } else {
      if (Math.abs(this.vx) > 25) this.face = sign(this.vx);
      const want = this.face > 0 ? 0.1 : Math.PI - 0.1;
      this.aim = angLerp(this.aim, want, Math.min(1, dt * 5));
    }
    // 몸 기울기: 헤엄치면 눕고(진행 방향), 멈추면 선다
    const swim = clamp((sp - 30) / 150, 0, 1);
    const dirPitch = clamp(Math.atan2(this.vy, Math.abs(this.vx) + 1) * 0.85, -0.85, 0.95);
    const target = lerp(-1.05, dirPitch, swim);
    this.pitch = lerp(this.pitch, target, Math.min(1, dt * 5));
    if (firing) this.recoil = 1;
    this.recoil = Math.max(0, this.recoil - dt * 8);
    // 숨쉬기 기포
    this.breathT -= dt;
    if (this.breathT <= 0 && fx && this.st.mouth) {
      this.breathT = rand(1.4, 2.2);
      const s = DIVER_SCALE;
      fx.bubbles(this.x + this.st.mouth.x * s, this.y + this.st.mouth.y * s, 4, 3, 0.8);
    }
    // 빨리 헤엄치면 오리발 뒤로 기포
    if (fx && sp > 160 && Math.random() < dt * 10) fx.spawn({ kind: "bubble", x: this.x - this.face * 40, y: this.y + 10, vx: -this.vx * 0.2, vy: -20, r: rand(1.5, 3), life: rand(0.5, 1), drag: 2 });
  }

  hurt(dmgDir, fx) {
    if (this.inv > 0) return false;
    this.inv = 1.1;
    this.hurtT = 0.5;
    this.vx += dmgDir.x * 320;
    this.vy += dmgDir.y * 320;
    this.setMood("hurt", 0.6);
    if (fx) fx.bubbles(this.x, this.y - 10, 10, 16, 1.1);
    return true;
  }

  /** 노즐 세계 좌표 (그린 뒤에 정해진다) */
  nozzle() {
    const n = this.st.nozzle;
    if (!n) return { x: this.x + this.face * 30, y: this.y - 6 };
    return { x: this.x + n.x * DIVER_SCALE, y: this.y + n.y * DIVER_SCALE };
  }

  draw(ctx, cam) {
    const st = this.st;
    st.face = this.face;
    st.pitch = this.pitch;
    st.aim = this.aim;
    st.kick = this.kick;
    st.recoil = this.recoil;
    st.mood = this.mood;
    st.blink = st.t % 3.4 < 0.12;
    st.hit = this.hurtT > 0 ? this.hurtT / 0.5 : 0;
    st.lamp = this.lampOn;
    st.lookX = Math.cos(this.aim) * this.face;
    st.lookY = Math.sin(this.aim);
    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y);
    // 다친 직후 깜빡깜빡
    if (this.inv > 0 && Math.floor(this.inv * 14) % 2 === 0) ctx.globalAlpha = 0.55;
    ctx.scale(DIVER_SCALE, DIVER_SCALE);
    drawDiver(ctx, st);
    ctx.restore();
  }
}
