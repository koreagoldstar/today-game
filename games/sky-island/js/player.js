/*
 * 하늘섬 대탈출 · 주인공 몸 (물리 · 충돌 · 동작 고르기)
 *  - 1/120 초 작은 걸음으로 나눠 계산 → 화면 빠르기(30 · 60 · 144Hz)와 상관없이 같은 움직임
 *  - 가속 · 감속 · 공중 조작 · 점프(코요테 시간 · 미리 누르기 · 짧게 떼면 낮은 점프) · 턱 · 경사로
 *  - 대시(쿨다운 · 공중 1번) · 옆바람 · 위로 부는 바람 · 점프대 발사(공중에서도 속도 유지) · 넉백
 *  - 착지 직후에도 바로 움직일 수 있다 (착지 동작이 입력을 막지 않음)
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

export const PHYS = {
  speed: 7.0,
  accel: 40,
  decel: 34,
  airAccel: 22,
  gravity: 30,
  jumpV: 11.2,
  jumpCut: 0.72, // 일찍 떼면 이만큼만 (낮은 점프도 작은 발판까지 닿게 · 그래도 꾹 누른 것보다 0.5m 넘게 낮음)
  minJump: 0.08, // 뛰고 나서 이 시간까지는 떼도 안 줄어듦 (아주 짧게 톡 눌러도)
  coyote: 0.2, // 발판 끝에서 미끄러져 나간 뒤에도 이 시간 안이면 점프됨
  buffer: 0.15,
  dashSpeed: 14.5,
  dashTime: 0.22,
  dashCD: 0.8,
  radius: 0.32,
  height: 1.1,
  step: 0.42,
  stepDown: 0.5,
  maxFall: 26,
  turn: 14,
  liftMax: 10.5,
  invuln: 1.5,
  slipAccel: 10,
  slipDecel: 2.6,
};
const SUB = 1 / 120;

export class Player {
  constructor(hero, course) {
    this.hero = hero;
    this.course = course;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.onGround = false;
    this.groundSolid = null;
    this.lastSolid = null;
    this.coyoteT = 0;
    this.bufferT = 0;
    this.dashT = 0;
    this.dashCD = 0;
    this.dashDir = new THREE.Vector2(0, -1);
    this.airDash = false;
    this.stunT = 0;
    this.hurtT = 0;
    this.airT = 0;
    this.cut = false;
    this.launched = false;
    this.yaw = Math.PI;
    this.frozen = false;
    this.wind = new THREE.Vector3();
  }
  spawn(p, yaw) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.hero.face = this.hero.faceTo = yaw;
    this.onGround = false;
    this.groundSolid = null;
    this.lastSolid = null;
    this.dashT = this.stunT = this.airT = this.hurtT = 0;
    this.dashCD = 0;
    this.airDash = false;
    this.launched = false;
    this.bufferT = 0;
    this.hero.pos.copy(p);
    this.hero.play("idle");
  }
  /** 맞은 뒤 잠깐 · 대시 중에는 다치지 않는다 */
  get invulnerable() {
    return this.hurtT > 0 || this.dashT > 0;
  }
  /** 위험한 것에 맞음 (번개 · 포탄 · 고드름 · 보스 공격): 하트는 game 이 줄인다. 맞았으면 true */
  hurt(from, power = 6) {
    if (this.invulnerable) return false;
    this.hurtT = PHYS.invuln;
    let dx = this.pos.x - from.x;
    let dz = this.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / d) * power, 6.5, (dz / d) * power);
    this.stunT = 0.4;
    this.onGround = false;
    this.groundSolid = null;
    this.launched = false;
    this.hero.play("hit", { restart: true });
    return true;
  }
  get dashReady() {
    return this.dashCD <= 0 && (this.onGround || !this.airDash);
  }
  /** 점프대 · 바람 고리: 정해진 속도로 날려 보냄 (공중에서 감속하지 않음) */
  launch(vx, vy, vz) {
    this.vel.set(vx, vy, vz);
    this.onGround = false;
    this.groundSolid = null;
    this.coyoteT = 0;
    this.bufferT = 0;
    this.cut = true;
    this.launched = true;
    this.airDash = false;
    this.airT = 0;
    this.dashT = 0;
    if (Math.hypot(vx, vz) > 0.5) this.yaw = Math.atan2(vx, vz);
  }
  /** 장애물에 부딪힘: 뒤로 튕기고 잠깐 조작 불가 */
  knock(from, power = 7) {
    if (this.stunT > 0) return false;
    let dx = this.pos.x - from.x;
    let dz = this.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    this.vel.set(dx * power, 6, dz * power);
    this.stunT = 0.42;
    this.dashT = 0;
    this.onGround = false;
    this.groundSolid = null;
    this.launched = false;
    this.hero.play("hit", { restart: true });
    return true;
  }

  /**
   * @param wish {x,z,mag} 세계 기준 가고 싶은 방향 (길이 0~1)
   * @param f {jump, dash} 이번에 누른 것
   * @returns 일어난 일 { jump, land, dash, fall, landSolid, pad }
   */
  update(dt, wish, f, jumpHeld) {
    const ev = {};
    const C = this.course;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.frozen) {
      wish = { x: 0, z: 0, mag: 0 };
      f = {};
    }
    // 움직이는 발판에 실려 간다 (한 프레임에 한 번)
    if (this.onGround && this.groundSolid) {
      const s = this.groundSolid;
      if (s.dx || s.dy || s.dz) {
        this.pos.x += s.dx;
        this.pos.z += s.dz;
        this.pos.y += s.dy;
      }
      // 빙글빙글 도는 발판: 가운데를 중심으로 같이 돈다
      if (s.rot) {
        const ox = this.pos.x - s.cx;
        const oz = this.pos.z - s.cz;
        const c = Math.cos(s.rot);
        const sn = Math.sin(s.rot);
        this.pos.x = s.cx + ox * c + oz * sn;
        this.pos.z = s.cz - ox * sn + oz * c;
        this.yaw += s.rot;
      }
      if (!s.active) {
        this.onGround = false;
        this.groundSolid = null;
        this.coyoteT = PHYS.coyote;
      }
    }
    if (f.jump) {
      this.bufferT = PHYS.buffer;
      // 공중에서 미리 누른 점프(착지 직전 · 끝에서 미끄러진 직후)는 일찍 떼도 줄이지 않음
      this.pressAir = !this.onGround;
    }
    // 대시 (땅에서, 또는 공중에서 한 번 · 쿨다운)
    if (f.dash && this.dashCD <= 0 && this.stunT <= 0 && (this.onGround || !this.airDash)) {
      this.dashT = PHYS.dashTime;
      this.dashCD = PHYS.dashCD;
      if (wish.mag > 0.15) this.dashDir.set(wish.x, wish.z).normalize();
      else this.dashDir.set(Math.sin(this.yaw), Math.cos(this.yaw));
      this.yaw = Math.atan2(this.dashDir.x, this.dashDir.y);
      if (!this.onGround) this.airDash = true;
      if (this.vel.y < 0) this.vel.y = 0;
      this.launched = false;
      ev.dash = true;
    }
    C.windAt(this.pos, this.wind);
    const n = Math.min(10, Math.max(1, Math.ceil(dt / SUB)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.step(h, wish, jumpHeld, ev);
    // 방향 돌기
    if (this.stunT <= 0 && this.dashT <= 0 && wish.mag > 0.12) {
      const target = Math.atan2(wish.x, wish.z);
      let d = target - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * PHYS.turn);
    }
    if (this.pos.y < C.killY) ev.fall = true;
    this.animate(dt, ev);
    return ev;
  }

  step(h, wish, jumpHeld, ev) {
    const C = this.course;
    const P = PHYS;
    this.coyoteT = Math.max(0, this.coyoteT - h);
    this.bufferT = Math.max(0, this.bufferT - h);
    this.dashCD = Math.max(0, this.dashCD - h);
    // 가로 속도
    if (this.stunT > 0) {
      this.stunT -= h;
      if (this.onGround) {
        const k = Math.max(0, 1 - h * 6);
        this.vel.x *= k;
        this.vel.z *= k;
      }
    } else if (this.dashT > 0) {
      this.dashT -= h;
      this.vel.x = this.dashDir.x * P.dashSpeed;
      this.vel.z = this.dashDir.y * P.dashSpeed;
      if (this.dashT <= 0) {
        this.vel.x *= 0.5;
        this.vel.z *= 0.5;
      }
    } else if (this.launched && !this.onGround) {
      // 날아가는 중: 속도는 유지하고 입력으로 살짝 방향만 바꾼다
      this.vel.x += wish.x * 9 * h;
      this.vel.z += wish.z * 9 * h;
    } else {
      const tx = wish.x * P.speed;
      const tz = wish.z * P.speed;
      const slip = this.onGround && this.groundSolid && this.groundSolid.slip;
      const acc = !this.onGround ? P.airAccel : slip ? (wish.mag > 0.1 ? P.slipAccel : P.slipDecel) : wish.mag > 0.1 ? P.accel : P.decel;
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
      if (this.groundSolid) this.lastSolid = this.groundSolid;
      this.onGround = false;
      this.groundSolid = null;
      this.coyoteT = 0;
      this.bufferT = 0;
      this.cut = !!this.pressAir;
      this.pressAir = false;
      this.airT = 0;
      ev.jump = true;
    }
    // 짧게 누르면 낮은 점프 (뛰고 나서 minJump 초까지는 줄이지 않음)
    if (!this.onGround && this.vel.y > 0 && !jumpHeld && !this.cut && this.stunT <= 0 && this.airT >= P.minJump) {
      this.vel.y *= P.jumpCut;
      this.cut = true;
    }
    // 위로 부는 바람 (상승기류): 위로 밀어 올린다
    if (this.wind.y > 0 && !this.onGround) {
      this.vel.y = Math.min(P.liftMax, this.vel.y + this.wind.y * h);
      this.cut = true;
    }
    // 중력 (대시 중엔 잠깐 떠 있음)
    if (!this.onGround && this.dashT <= 0) this.vel.y = Math.max(-P.maxFall, this.vel.y - P.gravity * h);
    // 가로 이동 + 벽
    let px = 0;
    let pz = 0;
    if (this.onGround && this.groundSolid && this.groundSolid.push) {
      px = this.groundSolid.push.x;
      pz = this.groundSolid.push.z;
    }
    this.pos.x += (this.vel.x + this.wind.x + px) * h;
    this.pos.z += (this.vel.z + this.wind.z + pz) * h;
    C.walls(this.pos, P.radius, this.pos.y, P.height, this.onGround ? P.step : 0.1);
    // 세로
    if (this.onGround) {
      const g = C.ground(this.pos.x, this.pos.z, P.radius, this.pos.y + P.step);
      if (g && g.h >= this.pos.y - P.stepDown) {
        this.pos.y = g.h;
        this.groundSolid = g.s;
        this.vel.y = 0;
      } else {
        if (this.groundSolid) this.lastSolid = this.groundSolid;
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
        const g = C.ground(this.pos.x, this.pos.z, P.radius, this.pos.y + 0.06);
        if (g && ny <= g.h) {
          this.pos.y = g.h;
          this.groundSolid = g.s;
          this.onGround = true;
          this.airDash = false;
          this.launched = false;
          const strength = Math.min(1, -this.vel.y / 18);
          this.vel.y = 0;
          if (this.airT > 0.12) {
            ev.land = Math.max(ev.land || 0, strength);
            ev.landSolid = g.s;
          }
          this.airT = 0;
          return;
        }
      } else {
        const c = C.ceiling(this.pos.x, this.pos.z, P.radius, this.pos.y + P.height, ny + P.height);
        if (c != null) {
          this.pos.y = c - P.height - 0.01;
          this.vel.y = 0;
          return;
        }
      }
      this.pos.y = ny;
    }
  }

  animate(dt, ev) {
    const c = this.hero;
    const s = c.state;
    const hs = Math.hypot(this.vel.x, this.vel.z) / PHYS.speed;
    c.speed01 = Math.min(1, hs);
    if (this.frozen) {
      // 연출 중: 동작은 연출이 정한다
    } else if (s === "hit" && (c.st < 0.35 || this.stunT > 0)) {
      // 부딪힌 동작 끝까지
    } else if (this.dashT > 0) {
      if (s !== "dash") c.play("dash");
    } else if (!this.onGround) {
      if (this.vel.y > 0.5) {
        if (s !== "jump") c.play("jump");
      } else if (this.airT > 0.12 && s !== "fall") c.play("fall");
    } else if (ev.land) {
      c.play("land", { k: ev.land, next: hs > 0.1 ? "run" : "idle" });
    } else if (s === "land" && c.st < 0.12) {
      // 착지 마무리 (입력은 막지 않는다)
    } else if (hs > 0.08) {
      if (s === "idle" || s === "land") c.play("startRun");
      else if (s === "startRun") {
        // 출발 동작이 끝나면 걷기/달리기로
      } else if (s === "walk") {
        if (hs > 0.6) c.play("run");
      } else if (s === "run") {
        if (hs < 0.42) c.play("walk");
      } else c.play(hs < 0.5 ? "walk" : "run");
    } else if (s !== "idle" && s !== "celebrate" && s !== "checkpoint" && s !== "wave") c.play("idle");
    c.faceTo = this.yaw;
    c.pos.copy(this.pos);
    c.group.visible = this.hurtT <= 0 || Math.floor(this.hurtT * 14) % 2 === 0;
    c.wind = Math.min(1.5, Math.hypot(this.wind.x, this.wind.z) * 0.3 + (this.wind.y > 0 ? 1 : 0));
    c.update(dt);
  }
}
