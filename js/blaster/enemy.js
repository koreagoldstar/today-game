/*
 * 물총 대작전 엔진 · EnemyBase + 행동 패턴
 *
 * 적은 데이터(EnemyData)와 행동 조각(움직임 · 등장 · 공격 · 반응)을 조합해서 만든다.
 *   EnemyData = { id, name, type, stage, score, speed, health, size,
 *                 movementPattern, spawnPattern, attackPattern, weakPoint,
 *                 hitReaction, soakReaction, specialAbility, ... }
 * 새 테마는 데이터와 그림(art)만 바꾸면 된다. 필요하면 Movement/Attack 에 패턴을 더 등록할 수 있다.
 *
 * 좌표: x 좌우(-1~1), z 깊이(0 수평선 ~ 1 보트 앞), h 물 위 높이(px), sub 잠김 정도(0 물 위 ~ 1 완전히 잠김)
 */
import { project, rand, pick, clamp, lerp } from "./view.js?v=3";

let UID = 1;
export const ENEMY_SCALE = 1.25;

export class EnemyBase {
  constructor(data, opts = {}) {
    this.uid = UID++;
    this.id = data.id;
    this.d = data;
    this.x = 0;
    this.z = 0.3;
    this.h = 0;
    this.vx = 0;
    this.vz = 0;
    this.sub = 0;
    this.age = 0;
    this.hp = data.health || 1;
    this.maxHp = this.hp;
    this.state = "live"; // live → soaked → dead · 또는 live → dead(도망)
    this.dir = 1;
    this.vis = 1;
    this.rot = 0;
    this.squash = 0;
    this.hitT = 0;
    this.kbx = 0; // 맞았을 때 밀려나는 거리 (화면 px)
    this.kby = 0;
    this.shakeT = 0;
    this.wet = 0; // 맞을수록 젖어 보이는 정도 (0~1)
    this.react = null;
    this.reactT = 0;
    this.mem = {};
    this.atkT = rand(1.2, 2.4) / (opts.attackRate || 1);
    this.visibleAt = -1;
    this.done = false;
    this.escaped = false;
    this.shielded = false; // 지금은 맞아도 튕겨 냄 (등껍질 · 방패)
    this.hidden = false; // 지금은 맞출 수 없음 (숨음 · 투명)
    this.leader = null;
    this.slot = 0;
    this.carry = null; // 도둑 게가 훔친 아이템
    this.minion = Boolean(opts.minion);
    this.bonus = data.type === "bonus" || data.type === "golden";
    this.opts = opts;
    // 화면 좌표 캐시
    this.sx = 0;
    this.sy = 0;
    this.s = 1;
    this.k = 1;
    this.hx = 0;
    this.hy = 0;
    this.hr = 10;
  }

  get alive() {
    return this.state === "live";
  }

  /** 지금 물총에 맞을 수 있나 */
  get targetable() {
    return this.state === "live" && !this.hidden && this.sub < 0.62 && this.vis > 0.35;
  }

  /** 월드 → 화면 좌표, 맞는 원 계산 */
  layout() {
    const p = project(this.x, this.z, this.h);
    this.sx = p.sx;
    this.sy = p.sy;
    this.s = p.s;
    const size = this.d.size || 46;
    // 모바일에서 친구들이 또렷하게 보이도록 기본 1.25배 · 멀리 있을수록 조금 더 (먼 쪽 +28% ~ 가까운 쪽 +12%)
    // 보스에 붙은 조각(촉수 등)은 보스 그림에 맞춰져 있어서 그대로 둔다
    const far = this.opts.part ? 0 : 1 - clamp((p.s - 0.4) / 0.82, 0, 1);
    const boost = this.opts.part ? 1 : 1.12 + 0.16 * far;
    this.k = (size / 50) * p.s * (this.opts.scale || 1) * ENEMY_SCALE * boost;
    const cy = this.d.cy == null ? -34 : this.d.cy;
    this.hx = this.sx;
    this.hy = this.sy + (cy + this.sub * 60) * this.k;
    this.hr = (this.d.hitR || 44) * this.k;
  }

  weakPointScreen() {
    const w = this.d.weakPoint;
    if (!w || this.state !== "live") return null;
    if (w.when === "open" && !this.mem.open) return null;
    const dx = (w.dx || 0) * this.dir;
    return { x: this.sx + dx * this.k, y: this.sy + (w.dy + this.sub * 60) * this.k, r: (w.r || 14) * this.k * 1.2 };
  }

  update(dt, env) {
    this.age += dt;
    if (this.hitT > 0) this.hitT -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    this.squash *= Math.pow(0.004, dt);
    const kd = Math.pow(0.0008, dt);
    this.kbx *= kd;
    this.kby *= kd;
    if (this.state === "soaked") {
      const fn = Reactions[this.react] || Reactions.spinAway;
      this.reactT += dt;
      if (fn(this, dt, env)) {
        this.state = "dead";
        this.done = true;
      }
      return;
    }
    if (this.state !== "live") return;
    const mv = Movement[this.d.movementPattern] || Movement.drift;
    mv(this, dt, env);
    if (this.leader && this.leader.state !== "live" && this.mem.followSince == null) this.mem.followSince = this.age;
    // 공격
    if (this.mem.throwT > 0) this.mem.throwT -= dt;
    const pend = this.mem.pend;
    if (pend) {
      pend.t -= dt;
      if (pend.t <= 0) {
        this.mem.pend = null;
        if (this.targetable) env.shoot(pend.kind, this, { dur: 2.4, dx: pend.dx, fromEnemy: true });
      }
    }
    const atk = Attack[this.d.attackPattern];
    if (atk && this.targetable && env.attacksOn) {
      this.atkT -= dt * env.attackRate;
      if (this.atkT <= 0) {
        this.atkT = (this.d.attackEvery || 3.2) * rand(0.8, 1.25);
        atk(this, env);
      }
    }
    if (this.visibleAt < 0 && this.sub < 0.5 && this.vis > 0.5 && Math.abs(this.x) < 1.1) this.visibleAt = this.age;
    if (this.done && this.state === "live") {
      this.state = "dead";
      this.escaped = true;
    }
  }

  /** 물을 맞았을 때. 결과: 'shield' | 'chip' | 'soak' */
  takeHit(dmg, env, info = {}) {
    if (!this.targetable) return "none";
    if (this.shielded && !info.weak && !info.big) {
      this.hitT = 0.12;
      return "shield";
    }
    this.hp -= dmg;
    this.hitT = 0.16;
    this.squash = 1;
    this.wet = Math.min(1, this.wet + 0.45);
    if (this.hp > 0) {
      const hr = HitReactions[this.d.hitReaction];
      if (hr) hr(this, env);
      return "chip";
    }
    this.soak(env);
    return "soak";
  }

  soak(env, kind) {
    this.state = "soaked";
    this.react = kind || this.d.soakReaction || "spinAway";
    this.reactT = 0;
    this.wet = 1;
    this.mem.sx0 = this.x;
    this.mem.h0 = this.h;
    this.mem.z0 = this.z;
    this.mem.rd = this.x > 0 ? 1 : -1;
    if (env && env.onSoak) env.onSoak(this);
  }

  /** 아트 함수에 넘길 자세 정보 */
  pose(now) {
    const blink = (Math.sin(this.uid * 7.3 + this.age * 1.7) > 0.985) || (this.age % 3.1 < 0.12);
    return {
      t: this.age,
      now,
      blink,
      dir: this.dir,
      hit: this.hitT > 0 ? this.hitT / 0.16 : 0,
      wet: this.wet,
      soaked: this.state === "soaked",
      dizzy: this.state === "soaked" && (this.react === "dizzy" || this.react === "flipSink"),
      hidden: this.hidden,
      shielded: this.shielded,
      open: Boolean(this.mem.open),
      mode: this.mem.mode || "",
      angry: Boolean(this.mem.angry),
      carry: this.carry,
      hp: this.hp,
      maxHp: this.maxHp,
      sub: this.sub,
    };
  }
}

/* ======================================================================
 * 등장 패턴 — 처음 자리 잡기
 * ==================================================================== */
export const Spawn = {
  left(e, o) {
    e.x = -1.35;
    e.z = o.z != null ? o.z : rand(0.18, 0.6);
    e.dir = 1;
  },
  right(e, o) {
    e.x = 1.35;
    e.z = o.z != null ? o.z : rand(0.18, 0.6);
    e.dir = -1;
  },
  side(e, o) {
    if (o.from === "left" || (o.from !== "right" && Math.random() < 0.5)) Spawn.left(e, o);
    else Spawn.right(e, o);
  },
  popup(e, o) {
    e.x = o.x != null ? o.x : rand(-0.8, 0.8);
    e.z = o.z != null ? o.z : rand(0.2, 0.62);
    e.sub = 1;
    e.dir = e.x > 0 ? -1 : 1;
  },
  horizon(e, o) {
    e.x = o.x != null ? o.x : rand(-0.7, 0.7);
    e.z = o.z != null ? o.z : 0.02;
    e.sub = 1;
    e.dir = e.x > 0 ? -1 : 1;
  },
  sky(e, o) {
    const left = o.from === "left" || (o.from !== "right" && Math.random() < 0.5);
    e.x = left ? -1.4 : 1.4;
    e.dir = left ? 1 : -1;
    e.z = o.z != null ? o.z : rand(0.25, 0.55);
    e.h = o.h != null ? o.h : rand(170, 250);
  },
  below(e, o) {
    e.x = o.x != null ? o.x : rand(-0.8, 0.8);
    e.z = o.z != null ? o.z : rand(0.3, 0.7);
    e.sub = 1;
  },
};

/* ======================================================================
 * 움직임 패턴 — (e, dt, env) 로 매 프레임 위치를 바꾼다. 다 끝나면 e.done = true
 * env: { t, speed, waveAt(x,z,t), props, boatX }
 * ==================================================================== */
const bob = (e, env, amp = 4, fr = 2.4) => Math.sin(e.age * fr + e.uid) * amp + (env.waveAt ? env.waveAt(e.x, e.z, env.t) : 0);
const outOfBounds = (e) => (e.dir > 0 && e.x > 1.4) || (e.dir < 0 && e.x < -1.4);

function rise(e, dt, rate = 2.2) {
  e.sub = Math.max(0, e.sub - dt * rate);
}
function dive(e, dt, rate = 1.8) {
  e.sub = Math.min(1, e.sub + dt * rate);
  return e.sub >= 1;
}

export const Movement = {
  /** 물 위에 동동 떠서 천천히 옆으로 — 시간이 지나면 헤엄쳐 나간다 */
  drift(e, dt, env) {
    const sp = (e.d.speed || 0.12) * env.speed;
    if (e.sub > 0 && !e.mem.left) rise(e, dt);
    if (e.mem.vx == null) e.mem.vx = sp * (e.dir || 1) * rand(0.4, 0.8);
    const stay = (e.opts.stay || e.d.stay || 6) / Math.max(0.6, env.speed);
    if (e.age > stay) e.mem.left = true;
    if (e.mem.left) {
      e.x += e.dir * sp * 2.4 * dt;
      if (outOfBounds(e) || Math.abs(e.x) > 1.4) e.done = true;
    } else {
      e.x += e.mem.vx * dt;
      if (Math.abs(e.x) > 0.95) {
        e.mem.vx = -e.mem.vx;
        e.dir = Math.sign(e.mem.vx) || e.dir;
      }
    }
    e.h = bob(e, env);
  },

  /** 한쪽 끝에서 반대쪽 끝까지 헤엄 */
  cross(e, dt, env) {
    const sp = (e.d.speed || 0.25) * env.speed * (e.opts.speedMul || 1);
    e.x += e.dir * sp * dt;
    e.h = bob(e, env, 3, 3);
    if (e.sub > 0) rise(e, dt);
    if (outOfBounds(e)) e.done = true;
  },

  /** 물 위로 쏙 올라와서 잠깐 놀다 다시 잠수 */
  popup(e, dt, env) {
    const stay = (e.opts.stay || e.d.stay || 3.2) / Math.max(0.7, env.speed);
    if (e.age < stay) {
      rise(e, dt, 2.6);
      e.x += Math.sin(e.age * 1.6 + e.uid) * 0.05 * dt;
      e.h = bob(e, env, 3);
      if (e.d.sidestep) {
        e.x += Math.sin(e.age * 2.2) * 0.12 * dt * env.speed;
        e.dir = Math.cos(e.age * 2.2) > 0 ? 1 : -1;
      }
    } else if (dive(e, dt)) e.done = true;
  },

  /** 날치 · 돌고래: 포물선으로 퐁퐁 뛰며 건너간다 */
  arc(e, dt, env) {
    const sp = (e.d.speed || 0.35) * env.speed;
    const hop = e.d.hop || 1.25; // 한 번 뛰는 시간
    const peak = (e.d.jump || 150) * (e.opts.jumpMul || 1);
    e.x += e.dir * sp * dt;
    const ph = (e.age % hop) / hop;
    e.h = Math.sin(ph * Math.PI) * peak;
    e.sub = ph < 0.08 || ph > 0.92 ? 0.6 : 0;
    e.rot = (0.5 - ph) * -1.1 * e.dir;
    if (ph < e.mem.lastPh) e.mem.splash = true; // 착수
    e.mem.lastPh = ph;
    if (outOfBounds(e)) e.done = true;
  },

  /** 지그재그로 빠르게 (황금 물고기) */
  zigzag(e, dt, env) {
    const sp = (e.d.speed || 0.4) * env.speed;
    e.x += e.dir * sp * dt;
    if (e.mem.z0 == null) e.mem.z0 = e.z;
    e.z = clamp(e.mem.z0 + Math.sin(e.age * 3.4) * 0.12, 0.08, 0.8);
    e.h = bob(e, env, 2, 5);
    if (e.sub > 0) rise(e, dt, 3);
    if (outOfBounds(e)) e.done = true;
  },

  /** 보트 쪽으로 다가온다 (아기 상어 · 아기 악어) — 닿으면 보트가 젖는다 */
  approach(e, dt, env) {
    const sp = (e.d.speed || 0.09) * env.speed;
    if (e.sub > 0 && e.age < 1) rise(e, dt, 1.5);
    if (e.mem.x0 == null) e.mem.x0 = e.x;
    e.z += sp * dt;
    e.x = lerp(e.mem.x0, env.boatX * 0.5, clamp(e.z, 0, 1)) + Math.sin(e.age * 2.1 + e.uid) * 0.18 * (1 - e.z);
    e.dir = Math.cos(e.age * 2.1 + e.uid) > 0 ? 1 : -1;
    e.h = bob(e, env, 3, 4);
    e.mem.open = e.z > 0.55; // 가까이 오면 입을 벌린다 (약점)
    if (e.z >= 0.97) {
      env.hitBoat(e);
      e.state = "soaked";
      e.react = "bounceBack";
      e.reactT = 0;
      e.mem.z0 = e.z;
      e.mem.h0 = e.h;
      e.mem.noScore = true;
    }
  },

  /** 하늘을 물결 모양으로 난다 (앵무새) */
  fly(e, dt, env) {
    const sp = (e.d.speed || 0.3) * env.speed;
    e.x += e.dir * sp * dt;
    if (e.mem.h0 == null) e.mem.h0 = e.h;
    e.h = e.mem.h0 + Math.sin(e.age * 2.6) * 34;
    e.rot = Math.cos(e.age * 2.6) * 0.15;
    if (outOfBounds(e)) e.done = true;
  },

  /** 해파리: 아래에서 떠올라 위아래로 둥실 */
  rise(e, dt, env) {
    rise(e, dt, 0.9);
    const stay = (e.opts.stay || e.d.stay || 7) / Math.max(0.7, env.speed);
    e.x += Math.sin(e.age * 0.9 + e.uid) * 0.06 * dt;
    e.h = 10 + Math.max(0, Math.sin(e.age * 1.8)) * 26 + bob(e, env, 2);
    e.squash = Math.max(e.squash, Math.max(0, Math.sin(e.age * 3.6)) * 0.25);
    if (e.age > stay) {
      e.h += (e.age - stay) * 60;
      e.vis = Math.max(0, 1 - (e.age - stay) * 0.8);
      if (e.vis <= 0) e.done = true;
    }
  },

  /** 숨었다 빼꼼 (소라게 · 바위 뒤) */
  peek(e, dt, env) {
    const cycle = (e.d.cycle || 2.6) / Math.max(0.7, env.speed);
    const ph = (e.age % cycle) / cycle;
    const out = ph > 0.25 && ph < 0.78;
    e.sub = lerp(e.sub, out ? 0 : 0.9, Math.min(1, dt * 9));
    e.hidden = !out && e.sub > 0.5;
    e.mem.open = out;
    e.h = bob(e, env, 2);
    if (e.age > (e.opts.stay || e.d.stay || 9) && !out) e.done = true;
  },

  /** 거북이: 천천히 건너가다가 등껍질에 쏙 숨는다 (그때는 튕겨 나옴) */
  shellHide(e, dt, env) {
    const sp = (e.d.speed || 0.12) * env.speed;
    const cyc = 3.4;
    const ph = (e.age % cyc) / cyc;
    const hide = ph > 0.62 && ph < 0.9;
    e.shielded = hide;
    e.mem.mode = hide ? "shell" : "";
    if (!hide) e.x += e.dir * sp * dt;
    e.h = bob(e, env, 3, 2);
    if (e.sub > 0) rise(e, dt);
    if (outOfBounds(e)) e.done = true;
  },

  /** 방패 거북이: 방패를 앞에 들고 오다가 가끔 내린다 */
  shield(e, dt, env) {
    const sp = (e.d.speed || 0.1) * env.speed;
    const cyc = 3.0 / Math.max(0.8, env.speed);
    const ph = (e.age % cyc) / cyc;
    const lowered = ph > 0.55 && ph < 0.85;
    e.shielded = !lowered;
    e.mem.open = lowered;
    e.mem.mode = lowered ? "lowered" : "guard";
    e.x += e.dir * sp * dt * (lowered ? 0.2 : 1);
    e.h = bob(e, env, 3, 2);
    if (e.sub > 0) rise(e, dt);
    if (outOfBounds(e)) e.done = true;
  },

  /** 순간이동 문어: 잠깐 있다가 '뿅' 하고 다른 데로 */
  teleport(e, dt, env) {
    const every = (e.d.every || 1.8) / Math.max(0.8, env.speed);
    if (e.sub > 0 && !e.mem.port) rise(e, dt, 3);
    e.h = bob(e, env, 4, 3);
    e.mem.tp = (e.mem.tp || 0) + dt;
    if (e.mem.port) {
      e.vis = Math.max(0, e.vis - dt * 6);
      e.hidden = true;
      if (e.vis <= 0) {
        e.x = rand(-0.8, 0.8);
        e.z = rand(0.2, 0.6);
        e.mem.port = false;
        e.mem.jumps = (e.mem.jumps || 0) + 1;
        if (env.onTeleport) env.onTeleport(e);
      }
    } else {
      e.vis = Math.min(1, e.vis + dt * 5);
      e.hidden = e.vis < 0.5;
      if (e.mem.tp > every) {
        e.mem.tp = 0;
        if ((e.mem.jumps || 0) >= (e.d.jumps || 5)) {
          if (dive(e, dt * 30)) e.done = true;
        } else {
          e.mem.port = true;
          if (env.onTeleport) env.onTeleport(e);
        }
      }
    }
  },

  /** 폭주 게: 휙 달리고 멈칫, 방향을 확 바꾼다 */
  dash(e, dt, env) {
    if (e.sub > 0) rise(e, dt, 3);
    e.mem.t = (e.mem.t || 0) - dt;
    if (e.mem.t <= 0) {
      e.mem.dashing = !e.mem.dashing;
      e.mem.t = e.mem.dashing ? rand(0.5, 0.9) : rand(0.35, 0.7);
      if (e.mem.dashing && Math.random() < 0.35 && e.age < 6) e.dir = -e.dir;
      if (e.age > 6) e.dir = e.x > 0 ? 1 : -1;
    }
    const sp = (e.d.speed || 0.6) * env.speed;
    if (e.mem.dashing) e.x += e.dir * sp * dt;
    if (Math.abs(e.x) > 1 && e.age < 6) e.dir = -Math.sign(e.x);
    e.h = bob(e, env, 2, 8) + (e.mem.dashing ? Math.abs(Math.sin(e.age * 22)) * 5 : 0);
    if (outOfBounds(e)) e.done = true;
  },

  /** 물고기 떼: 대장을 따라 물결 모양 줄을 지어 헤엄 */
  school(e, dt, env) {
    const sp = (e.d.speed || 0.3) * env.speed;
    e.x += e.dir * sp * dt;
    if (e.mem.z0 == null) e.mem.z0 = e.z;
    e.z = clamp(e.mem.z0 + Math.sin(e.age * 2.2 + e.slot * 0.7) * 0.05, 0.05, 0.85);
    e.h = Math.sin(e.age * 6 + e.slot) * 3 + (env.waveAt ? env.waveAt(e.x, e.z, env.t) : 0);
    if (e.sub > 0) rise(e, dt, 3);
    if (outOfBounds(e)) e.done = true;
  },

  /** 고래: 떠올라 물을 뿜고 잠수, 다른 곳에서 다시 */
  surface(e, dt, env) {
    e.mem.cyc = (e.mem.cyc || 0) + dt;
    const up = 4.2 / Math.max(0.8, env.speed);
    if (e.mem.under) {
      if (dive(e, dt, 1.4) && e.mem.cyc > 1.3) {
        e.mem.under = false;
        e.mem.cyc = 0;
        e.mem.times = (e.mem.times || 0) + 1;
        e.x = rand(-0.7, 0.7);
        if (e.mem.times >= (e.d.times || 2)) e.done = true;
      }
    } else {
      rise(e, dt, 1.2);
      e.mem.open = e.mem.cyc > 1.2 && e.mem.cyc < 2.8; // 물 뿜는 동안 숨구멍이 열린다
      e.mem.mode = e.mem.open ? "spout" : "";
      if (e.mem.cyc > up) {
        e.mem.under = true;
        e.mem.cyc = 0;
        e.mem.open = false;
      }
    }
    e.x += e.dir * 0.03 * dt;
    e.h = bob(e, env, 3, 1.4);
  },

  /** 새우 특공대: 대열을 맞춰 깡총깡총 */
  hop(e, dt, env) {
    const sp = (e.d.speed || 0.3) * env.speed;
    e.x += e.dir * sp * dt;
    const ph = ((e.age + e.slot * 0.18) % 0.7) / 0.7;
    e.h = Math.sin(ph * Math.PI) * 46 + (env.waveAt ? env.waveAt(e.x, e.z, env.t) : 0);
    e.rot = (0.5 - ph) * 0.6 * e.dir;
    if (e.sub > 0) rise(e, dt, 4);
    if (outOfBounds(e)) e.done = true;
  },

  /** 투명 문어: 나타났다 사라졌다 (반짝이는 동안만 맞출 수 있다) */
  fade(e, dt, env) {
    if (e.sub > 0) rise(e, dt, 2);
    const cyc = 3 / Math.max(0.8, env.speed);
    const ph = (e.age % cyc) / cyc;
    const target = ph < 0.45 ? 1 : 0.08;
    e.vis = lerp(e.vis, target, Math.min(1, dt * 5));
    e.hidden = e.vis < 0.4;
    e.x += Math.sin(e.age * 0.8 + e.uid) * 0.08 * dt;
    e.h = bob(e, env, 5, 1.6);
    if (e.age > (e.opts.stay || e.d.stay || 10)) {
      e.vis = Math.max(0, e.vis - dt);
      if (e.vis <= 0.02) e.done = true;
    }
  },

  /** 가오리: 8자로 미끄러지다 가끔 보트 쪽으로 돌진 */
  glide(e, dt, env) {
    if (e.mem.cx == null) {
      e.mem.cx = rand(-0.4, 0.4);
      e.mem.cz = rand(0.3, 0.45);
    }
    if (e.sub > 0) rise(e, dt, 2);
    e.mem.a = (e.mem.a || 0) + dt * 1.1 * env.speed;
    const a = e.mem.a;
    if (e.mem.charge) {
      e.z += dt * 0.32 * env.speed;
      e.x = lerp(e.x, env.boatX * 0.3, dt * 1.2);
      e.mem.open = true;
      if (e.z > 0.95) {
        env.hitBoat(e);
        e.state = "soaked";
        e.react = "bounceBack";
        e.reactT = 0;
        e.mem.z0 = e.z;
        e.mem.h0 = e.h;
        e.mem.noScore = true;
      }
    } else {
      e.x = e.mem.cx + Math.sin(a) * 0.55;
      e.z = e.mem.cz + Math.sin(a * 2) * 0.1;
      e.dir = Math.cos(a) > 0 ? 1 : -1;
      e.mem.open = false;
      if (e.age > (e.d.chargeAfter || 6) / env.speed) e.mem.charge = true;
    }
    e.h = 26 + Math.sin(e.age * 3) * 10;
    e.rot = Math.cos(a) * 0.25;
  },

  /** 도둑 게: 보물 자루를 들고 옆으로 후다닥 */
  thief(e, dt, env) {
    if (e.sub > 0) rise(e, dt, 3);
    const sp = (e.d.speed || 0.32) * env.speed;
    e.mem.wait = (e.mem.wait || 0) + dt;
    if (e.mem.wait < 0.8) {
      e.h = bob(e, env, 2);
      return;
    }
    e.x += e.dir * sp * dt * (1 + Math.max(0, Math.sin(e.age * 10)) * 0.6);
    e.h = bob(e, env, 2, 9) + Math.abs(Math.sin(e.age * 12)) * 4;
    if (outOfBounds(e)) e.done = true;
  },

  /** 보너스 물건: 둥둥 떠 있다가 가라앉음 */
  float(e, dt, env) {
    if (e.sub > 0 && e.age < 1) rise(e, dt, 1.6);
    e.x += (e.mem.vx || 0) * dt;
    e.h = bob(e, env, 3, 1.8);
    e.rot = Math.sin(e.age * 1.8 + e.uid) * 0.12;
    if (e.age > (e.opts.stay || e.d.stay || 7)) {
      if (dive(e, dt, 0.9)) e.done = true;
    }
  },

  /** 위로 둥둥 올라가는 풍선 (보너스) */
  balloon(e, dt, env) {
    const sp = (e.d.speed || 60) * env.speed * (e.opts.speedMul || 1);
    if (e.sub > 0) {
      // 물속에서 쏙 떠오른 다음 하늘로
      rise(e, dt, 2.4);
      return;
    }
    e.h += sp * dt;
    e.x += Math.sin(e.age * 1.5 + e.uid) * 0.05 * dt;
    if (e.h > 640) e.done = true;
  },

  /** 오리 사격장: 레일을 따라 좌우 왕복 */
  rail(e, dt, env) {
    const sp = (e.d.speed || 0.3) * env.speed * (e.opts.speedMul || 1);
    e.x += e.dir * sp * dt;
    e.h = (e.opts.h || 0) + Math.abs(Math.sin(e.age * 5 + e.uid)) * 4;
    if (Math.abs(e.x) > 1.25) {
      if (e.opts.loop) {
        e.x = -1.25 * e.dir;
      } else e.done = true;
    }
    if (e.age > (e.opts.stay || 99)) e.done = true;
  },

  /** 짧게 튀어나왔다 들어가는 과녁 (연사 챌린지) */
  blink(e, dt, env) {
    const stay = (e.opts.stay || 1.4) / Math.max(0.7, env.speed);
    if (e.age < stay) rise(e, dt, 6);
    else if (dive(e, dt, 5)) e.done = true;
    e.h = bob(e, env, 2);
  },

  /** 촉수 (보스 부품) — 보스가 위치를 정해 준다 */
  part(e, dt) {
    if (e.sub > 0 && !e.mem.down) rise(e, dt, 2);
    if (e.mem.down && dive(e, dt, 1.5)) e.done = true;
  },
};

/* ======================================================================
 * 공격 패턴 — env.shoot(kind, from, opts) 로 보트를 향해 무언가 던진다
 * ==================================================================== */
export const Attack = {
  lob(e, env) {
    e.mem.throwT = 0.35;
    env.shoot(e.d.projectile || "balloon", e, { dur: e.d.projDur || 2.4, fromEnemy: true });
  },
  ink(e, env) {
    e.mem.throwT = 0.35;
    env.shoot("ink", e, { dur: 2.2, fromEnemy: true });
  },
  zap(e, env) {
    env.flash(0.35, "#fff8c0");
    env.shoot("spark", e, { dur: 2.1, fromEnemy: true });
  },
  double(e, env) {
    e.mem.throwT = 0.35;
    env.shoot(e.d.projectile || "balloon", e, { dur: 2.4, dx: -0.15, fromEnemy: true });
    e.mem.pend = { t: 0.3, kind: e.d.projectile || "balloon", dx: 0.15 };
  },
};

/* ======================================================================
 * 덜 젖었을 때 반응
 * ==================================================================== */
export const HitReactions = {
  squish() {},
  puff(e) {
    // 복어: 맞을 때마다 빵빵해진다
    e.mem.puff = Math.min(2, (e.mem.puff || 0) + 1);
    e.mem.mode = "puffed";
  },
  shell(e) {
    e.mem.mode = "shell";
  },
  angry(e) {
    e.mem.angry = true;
  },
  split(e, env) {
    // 미끼 복어: 처음 맞으면 작은 복어 셋으로 펑!
    if (e.mem.split) return;
    e.mem.split = true;
    if (env.split) env.split(e);
  },
  flinch(e) {
    e.x += (Math.random() - 0.5) * 0.05;
  },
};

/* ======================================================================
 * 흠뻑 젖었을 때 반응 — 아이들이 웃을 수 있는 퇴장. 끝나면 true
 * ==================================================================== */
export const Reactions = {
  /** 뱅글뱅글 돌며 하늘 멀리 '뿅' */
  spinAway(e, dt) {
    const t = e.reactT;
    e.rot += dt * 16 * e.mem.rd;
    e.h = e.mem.h0 + Math.sin(Math.min(1, t / 0.9) * Math.PI * 0.5) * 220 + t * 60;
    e.z = Math.max(0, e.mem.z0 - t * 0.35);
    e.x += e.mem.rd * dt * 0.2;
    e.vis = t > 0.6 ? Math.max(0, 1 - (t - 0.6) / 0.5) : 1;
    return t > 1.1;
  },
  /** 뒤집혀서 다리 버둥 — 거품 뽀글뽀글 가라앉음 */
  flipSink(e, dt) {
    const t = e.reactT;
    e.rot = Math.min(Math.PI, t * 9) * e.mem.rd;
    e.h = t < 0.25 ? e.mem.h0 + Math.sin((t / 0.25) * Math.PI) * 40 : e.mem.h0;
    if (t > 0.5) e.sub = Math.min(1, (t - 0.5) * 1.3);
    return t > 1.35;
  },
  /** 별이 빙글빙글 — 손 흔들며 가라앉음 */
  dizzy(e, dt) {
    const t = e.reactT;
    e.rot = Math.sin(t * 10) * 0.2;
    if (t > 0.8) e.sub = Math.min(1, (t - 0.8) * 1.4);
    return t > 1.6;
  },
  /** 복어: 바람 빠지며 이리저리 슝슝 날아감 */
  deflate(e, dt) {
    const t = e.reactT;
    e.mem.dx = e.mem.dx || e.mem.rd;
    e.x += Math.cos(t * 9) * dt * 1.4 * e.mem.dx;
    e.h = e.mem.h0 + t * 260 + Math.sin(t * 13) * 30;
    e.z = Math.max(0, e.mem.z0 - t * 0.15);
    e.rot += dt * 10;
    e.squash = -0.3;
    e.vis = t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.4) : 1;
    return t > 1.3;
  },
  /** 해파리 · 풍선: 하늘로 둥실 */
  floatUp(e, dt) {
    const t = e.reactT;
    e.h = e.mem.h0 + t * t * 260 + t * 60;
    e.rot = Math.sin(t * 6) * 0.25;
    e.vis = t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.5) : 1;
    return t > 1.3;
  },
  /** 물수제비처럼 통통 튀며 멀리 */
  bounceAway(e, dt) {
    const t = e.reactT;
    const hop = (t % 0.42) / 0.42;
    e.h = e.mem.h0 + Math.sin(hop * Math.PI) * 80 * Math.max(0.3, 1 - t * 0.6);
    e.z = Math.max(0, e.mem.z0 - t * 0.38);
    e.rot += dt * 8 * e.mem.rd;
    e.mem.splash = hop < e.mem.ph;
    e.mem.ph = hop;
    e.vis = t > 1 ? Math.max(0, 1 - (t - 1) / 0.4) : 1;
    return t > 1.4;
  },
  /** 강아지처럼 몸을 탈탈 털고 신나게 헤엄쳐 감 */
  shakeOff(e, dt) {
    const t = e.reactT;
    if (t < 0.6) {
      e.rot = Math.sin(t * 50) * 0.25;
    } else {
      e.rot = 0;
      e.x += e.mem.rd * dt * 1.4;
      e.h = Math.abs(Math.sin(t * 9)) * 30;
      e.z = Math.max(0, e.mem.z0 - (t - 0.6) * 0.2);
    }
    e.vis = t > 1.1 ? Math.max(0, 1 - (t - 1.1) / 0.4) : 1;
    return t > 1.5;
  },
  /** 보트에 부딪히고 튕겨 나감 (점수 없음) */
  bounceBack(e, dt) {
    const t = e.reactT;
    e.z = e.mem.z0 - t * 0.6;
    e.h = e.mem.h0 + Math.sin(Math.min(1, t / 0.8) * Math.PI) * 120;
    e.rot += dt * 9;
    e.vis = t > 0.6 ? Math.max(0, 1 - (t - 0.6) / 0.4) : 1;
    return t > 1;
  },
  /** 얼음 조각처럼 반짝 굳었다가 '팡' */
  freezePop(e) {
    const t = e.reactT;
    e.rot = 0;
    return t > 0.5;
  },
};

/** 같은 무리(물고기 떼 · 새우 특공대)를 한 번에 만든다 */
export function groupOffsets(kind, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    // 친구들이 커진 만큼 간격도 넓혀서 서로 겹치지 않게
    if (kind === "school") out.push({ dx: -i * 0.145, dz: Math.sin(i * 1.7) * 0.055 });
    else if (kind === "formation") out.push({ dx: -Math.floor((i + 1) / 2) * 0.155, dz: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.065 });
    else out.push({ dx: -i * 0.21, dz: 0 });
  }
  return out;
}

export { rand, pick };
