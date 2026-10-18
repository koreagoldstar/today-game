/*
 * 드래곤 석상 대작전 · 주인공 몸 (물리 · 충돌 · 동작 고르기)
 *  - 1/120 초 작은 걸음으로 나눠 계산 → 화면 빠르기와 상관없이 같은 움직임
 *  - 가속 · 감속 · 공중 조작 · 점프(코요테 시간 · 미리 누르기 · 짧게 떼면 낮은 점프) · 턱 오르내리기 · 경사로 · 천장
 *  - 대시(무적 순간 · 공중 1번) · 맞으면 넉백 + 잠깐 무적 · 움직이는 발판에 실려 감 · 얼음은 미끄럽게 · 바람에 밀림
 *  네 캐릭터 모두 같은 숫자를 쓴다 (모양만 다르다).
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

export const PHYS = {
  speed: 6.6,
  accel: 36,
  decel: 32,
  airAccel: 20,
  iceAccel: 9,
  iceDecel: 2.6,
  gravity: 30,
  jumpV: 11,
  jumpCut: 0.5,
  coyote: 0.12,
  buffer: 0.14,
  dashSpeed: 14,
  dashTime: 0.22,
  dashCD: 0.55,
  radius: 0.32,
  height: 0.95,
  step: 0.42,
  stepDown: 0.55,
  maxFall: 26,
  invuln: 1.5,
  turn: 14,
};
const SUB = 1 / 120;

export class Player {
  constructor(char, level) {
    this.char = char;
    this.level = level;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.onGround = false;
    this.groundSolid = null;
    this.coyoteT = 0;
    this.bufferT = 0;
    this.dashT = 0;
    this.dashCD = 0;
    this.dashDir = new THREE.Vector2(0, -1);
    this.airDash = false;
    this.hurtT = 0;
    this.stunT = 0;
    this.airT = 0;
    this.cut = false;
    this.yaw = Math.PI;
    this.frozen = false;
    this.hits = [];
    this.lastLand = 0;
  }
  spawn(p, yaw) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.char.face = this.char.faceTo = yaw;
    this.onGround = false;
    this.groundSolid = null;
    this.dashT = this.stunT = this.airT = 0;
    this.airDash = false;
    this.char.pos.copy(p);
    this.char.play("idle");
  }
  get invulnerable() {
    return this.hurtT > 0 || this.dashT > 0;
  }
  get fwd() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  /**
   * @param wish {x,z,mag} 세계 기준 가고 싶은 방향 (길이 0~1)
   * @param f {jump, dash, attack} 이번에 누른 것
   * @returns 일어난 일 { jump, land, dash, attack, fall }
   */
  update(dt, wish, f, jumpHeld) {
    const ev = {};
    const L = this.level;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.frozen) {
      wish = { x: 0, z: 0, mag: 0 };
      f = {};
    }
    // 움직이는 발판 · 출렁다리에 실려 간다 (한 프레임에 한 번)
    if (this.onGround && this.groundSolid) {
      const s = this.groundSolid;
      if (s.dx || s.dy || s.dz) {
        this.pos.x += s.dx;
        this.pos.z += s.dz;
        if (s.dy) this.pos.y += s.dy;
      }
      if (!s.active) {
        this.onGround = false;
        this.coyoteT = PHYS.coyote;
      }
    }
    if (f.jump) this.bufferT = PHYS.buffer;
    // 대시 (땅에서, 또는 공중에서 한 번)
    if (f.dash && this.dashCD <= 0 && this.stunT <= 0 && (this.onGround || !this.airDash)) {
      this.dashT = PHYS.dashTime;
      this.dashCD = PHYS.dashCD;
      if (wish.mag > 0.15) this.dashDir.set(wish.x, wish.z).normalize();
      else this.dashDir.set(Math.sin(this.yaw), Math.cos(this.yaw));
      this.yaw = Math.atan2(this.dashDir.x, this.dashDir.y);
      if (!this.onGround) this.airDash = true;
      if (this.vel.y < 0) this.vel.y = 0;
      ev.dash = true;
    }
    if (f.attack && this.stunT <= 0 && this.char.attack()) ev.attack = true;
    // 작은 걸음으로 나눠 계산
    const n = Math.min(10, Math.max(1, Math.ceil(dt / SUB)));
    const h = dt / n;
    const wind = L.windAt(this.pos);
    for (let i = 0; i < n; i++) this.step(h, wish, jumpHeld, wind, ev);
    // 방향 돌기
    if (this.stunT <= 0 && this.dashT <= 0 && wish.mag > 0.12) {
      const target = Math.atan2(wish.x, wish.z);
      let d = target - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * PHYS.turn);
    }
    // 떨어짐
    if (this.pos.y < L.killY) ev.fall = true;
    this.animate(dt, ev);
    return ev;
  }

  step(h, wish, jumpHeld, wind, ev) {
    const L = this.level;
    const P = PHYS;
    this.coyoteT = Math.max(0, this.coyoteT - h);
    this.bufferT = Math.max(0, this.bufferT - h);
    this.dashCD = Math.max(0, this.dashCD - h);
    const slip = this.onGround && this.groundSolid && this.groundSolid.slip;
    // 가로 속도
    if (this.stunT > 0) {
      this.stunT -= h;
      const k = Math.max(0, 1 - h * 4);
      this.vel.x *= k;
      this.vel.z *= k;
    } else if (this.dashT > 0) {
      this.dashT -= h;
      this.vel.x = this.dashDir.x * P.dashSpeed;
      this.vel.z = this.dashDir.y * P.dashSpeed;
      if (this.dashT <= 0) {
        this.vel.x *= 0.5;
        this.vel.z *= 0.5;
      }
    } else {
      const tx = wish.x * P.speed;
      const tz = wish.z * P.speed;
      let acc;
      if (!this.onGround) acc = P.airAccel;
      else if (slip) acc = wish.mag > 0.1 ? P.iceAccel : P.iceDecel;
      else acc = wish.mag > 0.1 ? P.accel : P.decel;
      const dx = tx - this.vel.x;
      const dz = tz - this.vel.z;
      const dl = Math.hypot(dx, dz);
      const m = acc * h;
      if (dl <= m) {
        this.vel.x = tx;
        this.vel.z = tz;
      } else {
        this.vel.x += (dx / dl) * m;
        this.vel.z += (dz / dl) * m;
      }
    }
    // 점프 (코요테 시간 · 미리 누르기)
    if (this.bufferT > 0 && (this.onGround || this.coyoteT > 0) && this.stunT <= 0) {
      this.vel.y = P.jumpV;
      this.onGround = false;
      this.groundSolid = null;
      this.coyoteT = 0;
      this.bufferT = 0;
      this.cut = false;
      this.airT = 0;
      ev.jump = true;
    }
    // 짧게 누르면 낮은 점프
    if (!this.onGround && this.vel.y > 0 && !jumpHeld && !this.cut && this.stunT <= 0) {
      this.vel.y *= P.jumpCut;
      this.cut = true;
    }
    // 중력 (대시 중엔 잠깐 떠 있음)
    if (!this.onGround && this.dashT <= 0) this.vel.y = Math.max(-P.maxFall, this.vel.y - P.gravity * h);
    // 가로 이동 + 벽
    this.pos.x += (this.vel.x + wind.x) * h;
    this.pos.z += (this.vel.z + wind.z) * h;
    this.hits.length = 0;
    L.walls(this.pos, P.radius, this.pos.y, P.height, this.onGround ? P.step : 0.1, this.hits);
    // 세로
    if (this.onGround) {
      const g = L.ground(this.pos.x, this.pos.z, P.radius, this.pos.y + P.step);
      if (g && g.h >= this.pos.y - P.stepDown) {
        this.pos.y = g.h;
        this.groundSolid = g.s;
        this.vel.y = 0;
      } else {
        this.onGround = false;
        this.groundSolid = null;
        this.coyoteT = P.coyote;
        this.airT = 0;
        this.vel.y = Math.min(this.vel.y, 0);
      }
    } else {
      this.airT += h;
      const ny = this.pos.y + this.vel.y * h;
      if (this.vel.y <= 0) {
        const g = L.ground(this.pos.x, this.pos.z, P.radius, this.pos.y + 0.06);
        if (g && ny <= g.h) {
          this.pos.y = g.h;
          this.groundSolid = g.s;
          this.onGround = true;
          this.airDash = false;
          const strength = Math.min(1, -this.vel.y / 18);
          this.vel.y = 0;
          if (this.airT > 0.22) ev.land = Math.max(ev.land || 0, strength);
          this.airT = 0;
          return;
        }
      } else {
        const c = L.ceiling(this.pos.x, this.pos.z, P.radius, this.pos.y + P.height, ny + P.height);
        if (c != null) {
          this.pos.y = c - P.height - 0.01;
          this.vel.y = 0;
          return;
        }
      }
      this.pos.y = ny;
    }
  }

  /** 맞음: 무적이면 무시. 맞았으면 true */
  hurt(from) {
    if (this.invulnerable) return false;
    this.hurtT = PHYS.invuln;
    this.stunT = 0.32;
    let dx = this.pos.x - from.x;
    let dz = this.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    this.vel.x = dx * 6;
    this.vel.z = dz * 6;
    this.vel.y = 6.5;
    this.onGround = false;
    this.groundSolid = null;
    this.char.play("hit");
    return true;
  }
  /** 적 · 보스 몸에 닿으면 살짝 밀려남 (아프지 않음) */
  push(from, strength = 4) {
    let dx = this.pos.x - from.x;
    let dz = this.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.x += (dx / d) * strength;
    this.vel.z += (dz / d) * strength;
  }

  animate(dt, ev) {
    const c = this.char;
    const s = c.state;
    const hs = Math.hypot(this.vel.x, this.vel.z) / PHYS.speed;
    c.speed01 = Math.min(1, hs);
    const locked = s === "hit" && c.st < 0.3;
    if (this.frozen) {
      // 연출 중: 동작은 연출이 정한다
    } else if (locked) {
      // 맞은 동작 끝까지
    } else if (this.dashT > 0) {
      if (s !== "dodge") c.play("dodge");
    } else if (!this.onGround) {
      if (this.vel.y > 0.5) {
        if (s !== "jumpStart" && s !== "jumpLoop") c.play("jumpStart");
      } else if (this.airT > 0.1 && s !== "fall") c.play("fall");
    } else if (ev.land) {
      c.play("land", { next: hs > 0.1 ? "run" : "idle" });
    } else if (s === "land" && c.st < 0.12) {
      // 착지 마무리
    } else if (hs > 0.08) {
      // 멈춰 있다가 → 출발(StartRun) → 느리면 걷기 · 빠르면 달리기 (경계에서 깜빡이지 않게 사이를 둔다)
      if (s === "idle" || s === "checkpoint") c.play("startRun");
      else if (s === "startRun") {
        // 출발 동작이 끝나면 캐릭터가 달리기로 넘긴다
      } else if (s === "walk") {
        if (hs > 0.6) c.play("run");
      } else if (s === "run") {
        if (hs < 0.42) c.play("walk");
      } else c.play(hs < 0.5 ? "walk" : "run");
    } else if (s !== "idle" && s !== "celebrate" && s !== "checkpoint") c.play("idle");
    c.faceTo = this.yaw;
    c.pos.copy(this.pos);
    // 맞은 뒤 무적: 깜빡깜빡
    c.group.visible = this.hurtT <= 0 || Math.floor(this.hurtT * 14) % 2 === 0;
    c.update(dt);
  }
}
