/* 몬스터 트럭 대소동 — 화면 없는 물리 · 규칙. 고정 걸음 1/120초.
 *
 * 앞 = +Z, 위 = +Y, 오른쪽 = -X (본체 좌표). 쿼터니언 [x, y, z, w].
 * 트럭: 바퀴 4개 스프링-댐퍼 + 접지력 + 공중 자세 제어. 힘은 질량 1 당 가속도로 계산한다.
 * 물체: 상자 모양 강체. 쌓인 물체는 받침이 사라지면 떨어진다 (on / children).
 */
import { OBJECTS, COMBO_WORDS, truckStats } from "./data.js?v=2";
import { MU, MAT } from "./level.js?v=2";

export const STEP = 1 / 120;
const G = 20;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function qRot(q, v, out) {
  const [x, y, z, w] = q;
  const [a, b, c] = v;
  const tx = 2 * (y * c - z * b);
  const ty = 2 * (z * a - x * c);
  const tz = 2 * (x * b - y * a);
  out[0] = a + w * tx + y * tz - z * ty;
  out[1] = b + w * ty + z * tx - x * tz;
  out[2] = c + w * tz + x * ty - y * tx;
  return out;
}
function qInvRot(q, v, out) {
  return qRot([-q[0], -q[1], -q[2], q[3]], v, out);
}
function qStep(q, w, dt) {
  const hx = w[0] * dt * 0.5;
  const hy = w[1] * dt * 0.5;
  const hz = w[2] * dt * 0.5;
  const [x, y, z, s] = q;
  q[0] = x + hx * s + hy * z - hz * y;
  q[1] = y - hx * z + hy * s + hz * x;
  q[2] = z + hx * y - hy * x + hz * s;
  q[3] = s - hx * x - hy * y - hz * z;
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  q[0] /= n;
  q[1] /= n;
  q[2] /= n;
  q[3] /= n;
}
const qYaw = (th) => [0, Math.sin(th / 2), 0, Math.cos(th / 2)];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export class Sim {
  constructor(level, truckDef, upgrades, meta = {}) {
    this.level = level;
    this.meta = meta;
    this.def = truckStats(truckDef, upgrades);
    this.time = 0;
    this.limit = meta.time || 0;
    this.state = "ready"; // ready | play | done
    this.result = null;
    this.events = [];
    this.input = { throttle: 0, brake: 0, steer: 0, boost: false, jump: false };
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.comboWord = 0;
    this.stats = { destroyed: 0, by: {}, bestCombo: 0, stunts: 0, stuntScore: 0, over: 0, chain: 0, bestChain: 0, air: 0, zone: false, pushed: false, collapsed: false, recover: 0, bestAir: 0, topSpeed: 0 };
    this.boost = 0.7;
    this.damage = 0;
    this.pi = 0;
    this.chainT = 0;
    this.chainN = 0;
    this.endT = 0;
    this.initTruck();
    this.initObjects();
  }

  initTruck() {
    const d = this.def;
    const st = this.level.start;
    const R = d.wheelR;
    this.L = 1.05;
    const attachY = -0.35;
    this.wheels = [
      { lx: -d.tw / 2, lz: d.wb / 2, front: true },
      { lx: d.tw / 2, lz: d.wb / 2, front: true },
      { lx: -d.tw / 2, lz: -d.wb / 2, front: false },
      { lx: d.tw / 2, lz: -d.wb / 2, front: false },
    ].map((w) => ({ ...w, a: [w.lx, attachY, w.lz], len: this.L * 0.6, prev: 0, contact: false, spin: 0, rate: 0, mat: 0, slip: 0 }));
    const big = d.wb / 3.7;
    this.pos = [st.x, st.y + R + 0.95, st.z];
    this.vel = [0, 0, 0];
    this.q = qYaw(st.th);
    this.w = [0, 0, 0];
    this.I = [3.4 * big, 3.6 * big, 2.2 * big];
    this.R = R;
    this.steerVis = 0;
    this.contacts = 0;
    this.speed = 0;
    this.vf = 0;
    this.slip = 0;
    this.airT = 0;
    this.groundT = 0;
    this.jumpCd = 0;
    this.padCd = 0;
    this.stuckT = 0;
    this.flipT = 0;
    this.recoverCd = 0;
    this.failN = 0;
    this.failPi = -999;
    this.invT = 0;
    this.air = null;
    this.airArmed = false;
    this.safe = { x: st.x, z: st.z, th: st.th };
    this.safeT = 0;
    this.boosting = false;
    this.hitCd = 0;
    this.up = [0, 1, 0];
    this.fwd = [Math.sin(st.th), 0, Math.cos(st.th)];
    this.points = [
      [-1.25, -0.7, 2.6],
      [1.25, -0.7, 2.6],
      [-1.25, -0.7, -2.6],
      [1.25, -0.7, -2.6],
      [-1.0, 1.5, 1.3],
      [1.0, 1.5, 1.3],
      [-1.0, 1.5, -1.3],
      [1.0, 1.5, -1.3],
    ].map((p) => [p[0] * big, p[1] * big, p[2] * big]);
    this.spheres = [
      [0, 0.2, 1.9 * big, 1.35 * big],
      [0, 0.45, 0, 1.45 * big],
      [0, 0.2, -1.9 * big, 1.35 * big],
    ];
  }

  initObjects() {
    this.objects = this.level.objects.map((r, i) => {
      const def = OBJECTS[r.type];
      const big = r.big || 1;
      return {
        i,
        type: r.type,
        def,
        tag: r.tag,
        x: r.x,
        y: r.y,
        z: r.z,
        q: qYaw(r.yaw),
        vx: 0,
        vy: 0,
        vz: 0,
        wx: 0,
        wy: 0,
        wz: 0,
        h: def.h.map((v) => v * big),
        big,
        m: def.m * big * big,
        hp: def.hp || 1,
        state: 0, // 0 가만히, 1 움직임, 2 사라짐
        squash: 1,
        fuse: 0,
        hitCd: 0,
        rest: 0,
        life: 0,
        scored: false,
        dmg: 0,
        parent: r.on,
        children: [],
        color: r.color,
        fixed: r.fixedY != null,
        fallT: 0,
        span: r.span,
        moved: true,
      };
    });
    for (const o of this.objects) if (o.parent >= 0) this.objects[o.parent].children.push(o.i);
    this.grid = new Map();
    for (const o of this.objects) this.gridAdd(o);
    this.bossTotal = this.objects.filter((o) => o.tag === "boss").length;
    this.totalBreakable = this.objects.filter((o) => o.def.brk < 1e5).length;
    this.lastMoved = new Set();
  }

  key(x, z) {
    return (Math.floor(x / 6) + 4096) * 8192 + (Math.floor(z / 6) + 4096);
  }

  gridAdd(o) {
    const k = this.key(o.x, o.z);
    o.cell = k;
    let list = this.grid.get(k);
    if (!list) {
      list = [];
      this.grid.set(k, list);
    }
    list.push(o);
  }

  gridMove(o) {
    const k = this.key(o.x, o.z);
    if (k === o.cell) return;
    const list = this.grid.get(o.cell);
    if (list) {
      const n = list.indexOf(o);
      if (n >= 0) list.splice(n, 1);
    }
    this.gridAdd(o);
  }

  near(x, z, r, fn) {
    const c0 = Math.floor((x - r) / 6);
    const c1 = Math.floor((x + r) / 6);
    const d0 = Math.floor((z - r) / 6);
    const d1 = Math.floor((z + r) / 6);
    for (let c = c0; c <= c1; c += 1) {
      for (let d = d0; d <= d1; d += 1) {
        const list = this.grid.get((c + 4096) * 8192 + (d + 4096));
        if (!list) continue;
        for (let i = 0; i < list.length; i += 1) fn(list[i]);
      }
    }
  }

  emit(t, data = {}) {
    if (this.events.length > 400) this.events.shift();
    this.events.push({ t, ...data });
  }

  begin() {
    if (this.state === "ready") this.state = "play";
  }

  /* ---------- 걸음 ---------- */
  step(dt = STEP) {
    if (this.state === "done") {
      this.stepObjects(dt);
      return;
    }
    const playing = this.state === "play";
    if (playing) this.time += dt;
    this.stepTruck(dt, playing);
    this.stepWalls();
    if (this.state !== "ready") this.stepContacts(dt);
    this.stepObjects(dt);
    if (playing) this.stepRules(dt);
  }

  stepTruck(dt, playing) {
    const d = this.def;
    const q = this.q;
    const up = qRot(q, [0, 1, 0], this.up);
    const fwd = qRot(q, [0, 0, 1], this.fwd);
    const right = [fwd[1] * up[2] - fwd[2] * up[1], fwd[2] * up[0] - fwd[0] * up[2], fwd[0] * up[1] - fwd[1] * up[0]];
    const input = playing ? this.input : { throttle: 0, brake: 0, steer: 0, boost: false, jump: false };
    const lvl = this.level;
    let ax = 0;
    let ay = -G;
    let az = 0;
    let tx = 0;
    let ty = 0;
    let tz = 0;
    let sumF = 0;
    let contacts = 0;
    const nAvg = [0, 0, 0];
    let muSum = 0;
    const damp = 1.28 * (d.damp || 1);
    const k = 11;
    const a = [0, 0, 0];
    let lava = false;
    let cliff = null;
    const groundHere = lvl.height(this.pos[0], this.pos[2]);
    for (const wh of this.wheels) {
      qRot(q, wh.a, a);
      const wx = this.pos[0] + a[0];
      const wy = this.pos[1] + a[1];
      const wz = this.pos[2] + a[2];
      wh.contact = false;
      wh.wx = wx;
      wh.wz = wz;
      if (up[1] < 0.15) {
        wh.len = Math.min(this.L, wh.len + dt * 3);
        wh.prev = 0;
        wh.wy = wy - this.R;
        continue;
      }
      let gy = lvl.height(wx, wz);
      let ride = null;
      this.near(wx, wz, 3, (o) => {
        if (o.state === 2 || !o.def.ride) return;
        const top = this.rideTop(o, wx, wz);
        if (top == null) return;
        if (top > gy && top < wy + 0.3) {
          gy = top;
          ride = o;
        }
      });
      const dist = (wy - gy) / Math.max(up[1], 0.35);
      const free = dist - this.R;
      // 점프대 뒤 · 끊어진 길 건너편 같은 절벽: 스프링으로 받으면 하늘로 튕기므로 벽처럼 막는다
      // (뒤쪽 바퀴가 점프대 끝을 막 떠날 때는 절벽이 아니다. 나아가는 쪽 바퀴만 본다)
      const ahead = a[0] * this.vel[0] + a[2] * this.vel[2] > 1;
      if (ahead && free < this.L * 0.8 && !ride && (gy - groundHere) / Math.abs(wh.lz) > 1.25) {
        wh.prev = 0;
        wh.len = this.L;
        wh.wy = wy - this.L - this.R;
        if (!cliff || gy > cliff[2]) cliff = [wx, wz, gy];
        continue;
      }
      if (free < this.L) {
        const comp = clamp(this.L - free, 0, this.L * 1.2);
        const rate = clamp((comp - wh.prev) / dt, -24, 24);
        wh.prev = comp;
        wh.len = this.L - Math.min(comp, this.L);
        const fs = Math.max(0, k * comp + damp * rate);
        const n = lvl.normal(wx, wz);
        const fy = Math.min(fs, 150);
        ax += n[0] * fy;
        ay += n[1] * fy;
        az += n[2] * fy;
        const fx0 = n[0] * fy;
        const fy0 = n[1] * fy;
        const fz0 = n[2] * fy;
        tx += a[1] * fz0 - a[2] * fy0;
        ty += a[2] * fx0 - a[0] * fz0;
        tz += a[0] * fy0 - a[1] * fx0;
        sumF += fy;
        nAvg[0] += n[0];
        nAvg[1] += n[1];
        nAvg[2] += n[2];
        contacts += 1;
        wh.contact = true;
        wh.mat = lvl.mat(wx, wz);
        muSum += MU[wh.mat];
        if (wh.mat === MAT.LAVA || wh.mat === MAT.VOID) lava = wh.mat;
        wh.wy = gy + this.R;
        if (ride && fy > 2.5) this.onRide(ride, fy);
      } else {
        wh.prev = 0;
        wh.len = Math.min(this.L, free);
        wh.wy = wy - this.L - this.R;
      }
    }
    this.contacts = contacts;
    if (cliff) this.hitCliff(cliff);

    const vel = this.vel;
    const speedNow = Math.hypot(vel[0], vel[1], vel[2]);
    if (contacts > 0 && contacts < 4 && speedNow > 6) {
      const keep = 0.2;
      tx *= keep;
      ty *= keep;
      tz *= keep;
    }
    let vfNow = 0;
    this.slip = 0;

    // 부스터
    const wantBoost = input.boost && this.boost > 0.01;
    this.boosting = wantBoost && input.throttle > 0;
    if (this.boosting) {
      this.boost = Math.max(0, this.boost - (dt * 0.3) / d.boost);
    }

    if (contacts > 0) {
      const inv = 1 / contacts;
      const n = [nAvg[0] * inv, nAvg[1] * inv, nAvg[2] * inv];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      n[0] /= nl;
      n[1] /= nl;
      n[2] /= nl;
      const fd = dot(fwd, n);
      const fp = [fwd[0] - n[0] * fd, fwd[1] - n[1] * fd, fwd[2] - n[2] * fd];
      const fl = Math.hypot(fp[0], fp[1], fp[2]) || 1;
      fp[0] /= fl;
      fp[1] /= fl;
      fp[2] /= fl;
      const sp = cross(fp, n);
      const vf = dot(vel, fp);
      const vs = dot(vel, sp);
      vfNow = vf;
      const matMu = muSum * inv;
      const icy = matMu < 1;
      const mu = matMu * d.grip * (icy ? d.iceGrip : 1) * (this.meta.assist ? (icy ? 1.4 : 1.12) : 1);
      const topNow = d.top * (this.boosting ? 1.34 : 1) * (this.damage >= 100 ? 0.9 : 1);
      let along = 0;
      if (input.throttle > 0) {
        const acc = d.accel * (this.boosting ? 1.85 : 1);
        const ratio = clamp(vf / topNow, -1, 1.2);
        along += input.throttle * acc * Math.max(0, 1 - ratio * ratio * ratio);
        if (vf < -0.5) along += input.throttle * 14;
      }
      if (input.brake > 0) {
        if (vf > 1) along -= input.brake * 30;
        else along -= input.brake * d.accel * 0.55 * (vf < -11 ? 0 : 1);
      }
      if (input.throttle === 0 && input.brake === 0) {
        along -= vf * (Math.abs(vf) < 1.6 ? 4 : 0.22);
      }
      const gripForce = mu * sumF;
      let lat = -vs * 9;
      const mag = Math.hypot(along, lat);
      if (mag > gripForce && mag > 0) {
        const s = gripForce / mag;
        this.slip = Math.max(0, Math.abs(lat) - Math.abs(lat * s));
        lat *= s;
        along *= s;
      }
      if (Math.abs(vs) > 3.5) this.slip = Math.max(this.slip, Math.abs(vs));
      // 얼음에선 밀려 나가는 느낌을 조금 더
      ax += fp[0] * along + sp[0] * lat;
      ay += fp[1] * along + sp[1] * lat;
      az += fp[2] * along + sp[2] * lat;

      // 조향은 몸통을 돌리는 것으로 (앞이 가벼워져도 안정적)
      const speedK = clamp(Math.abs(vf) / 7, this.meta.assist && input.throttle > 0 ? 0.4 : 0, 1);
      // 도우미: 벽에 튕겨 살짝 밀려날 때 조향이 뒤집히지 않게
      const dir = vf >= (this.meta.assist && input.throttle > 0 ? -3 : -0.5) ? 1 : -1;
      const steerRate = -input.steer * 1.95 * d.turn * speedK * dir * (1 - 0.32 * clamp(Math.abs(vf) / d.top, 0, 1));
      const wUp = dot(this.w, up);
      const gain = 9 * clamp(mu, 0.35, 1.1) * (contacts / 4);
      // 벽에 닿아 있으면 벽을 따라 돌아 빠져나온다
      const tq = (steerRate + (this.wallYaw || 0) - wUp) * gain;
      tx += up[0] * tq;
      ty += up[1] * tq;
      tz += up[2] * tq;
      // 몸통 쏠림 · 끄덕임
      const leanRoll = Math.max(-0.3, Math.min(0.3, -lat * 0.045));
      tx += fwd[0] * leanRoll;
      ty += fwd[1] * leanRoll;
      tz += fwd[2] * leanRoll;
      const pitch = along * 0.05;
      tx += right[0] * pitch;
      ty += right[1] * pitch;
      tz += right[2] * pitch;
      // 땅에 맞춰 서려는 힘 (넘어지지 않게)
      const fix = cross(up, n);
      const stiff = 7 * (contacts / 4);
      tx += fix[0] * stiff - this.w[0] * 1.4 * (contacts / 4);
      tz += fix[2] * stiff - this.w[2] * 1.4 * (contacts / 4);
      if (up[1] < 0.8) {
        // 많이 기울면 (점프대 옆면 등) 세계 위쪽 기준으로 강하게 세운다
        const guard = cross(up, [0, 1, 0]);
        const g2 = 26 * (0.8 - up[1]) + 6;
        tx += guard[0] * g2;
        tz += guard[2] * g2;
      }

      // 점프
      if (input.jump && this.jumpCd <= 0 && contacts >= 2) {
        const jv = 8.6 * d.jump;
        vel[0] += n[0] * jv;
        vel[1] += n[1] * jv;
        vel[2] += n[2] * jv;
        this.jumpCd = 0.55;
        this.emit("jump", { x: this.pos[0], y: this.pos[1], z: this.pos[2] });
      }
    } else {
      // 공중: 좌우 = 회전, 앞뒤 = 앞돌기 · 뒤돌기 (눌렀다 뗀 뒤부터 먹는다)
      if (!input.throttle && !input.brake) this.airArmed = true;
      const air = d.air;
      // 체공이 1초 남짓이어도 한 바퀴를 돌 수 있을 만큼 (너무 빨라지지는 않게)
      const yawAcc = Math.abs(this.w[1]) > 7 && this.w[1] * -input.steer > 0 ? 0 : -input.steer * 22 * air;
      tx += up[0] * yawAcc;
      ty += up[1] * yawAcc;
      tz += up[2] * yawAcc;
      let pitchCmd = 0;
      if (this.airArmed) pitchCmd = input.throttle - input.brake;
      if (pitchCmd) {
        const p = pitchCmd * 16 * air;
        tx += right[0] * -p;
        ty += right[1] * -p;
        tz += right[2] * -p;
      } else {
        // 손을 떼면 천천히 바로 선다
        const fix = cross(up, [0, 1, 0]);
        const nearGround = this.pos[1] - lvl.height(this.pos[0], this.pos[2]) < 6 && vel[1] < 0;
        const lv = (nearGround ? 16 : 9) * Math.max(0.7, d.air);
        const wd = nearGround ? 3.4 : 2.2;
        tx += fix[0] * lv - this.w[0] * wd;
        tz += fix[2] * lv - this.w[2] * wd;
      }
      ty -= this.w[1] * (input.steer ? 0 : 1.1);
    }

    // 몸통이 땅에 닿음 (뒤집혔을 때 등)
    const pt = [0, 0, 0];
    let bodyHit = 0;
    for (const p of this.points) {
      qRot(q, p, pt);
      const wx = this.pos[0] + pt[0];
      const wy = this.pos[1] + pt[1];
      const wz = this.pos[2] + pt[2];
      const h = lvl.height(wx, wz);
      const pen = h - wy;
      if (pen > 0) {
        // 똑바로 선 채 점프대 모서리 같은 절벽에 부딪히면 벽처럼: 코가 걸려 뒤집히지 않게
        const hd = Math.hypot(pt[0], pt[2]) || 1;
        if (up[1] > 0.6 && (h - groundHere) / hd > 0.7 && pt[0] * vel[0] + pt[2] * vel[2] > 0) {
          this.hitCliff([wx, wz, h]);
          continue;
        }
        const vx = vel[0] + this.w[1] * pt[2] - this.w[2] * pt[1];
        const vy = vel[1] + this.w[2] * pt[0] - this.w[0] * pt[2];
        const vz = vel[2] + this.w[0] * pt[1] - this.w[1] * pt[0];
        const fn = clamp(pen * 150 - vy * 11, 0, 220);
        const fxx = -vx * 2.2;
        const fzz = -vz * 2.2;
        ay += fn;
        ax += fxx;
        az += fzz;
        tx += pt[1] * fzz - pt[2] * fn;
        ty += pt[2] * fxx - pt[0] * fzz;
        tz += pt[0] * fn - pt[1] * fxx;
        bodyHit = Math.max(bodyHit, -vy);
        if (Math.abs(vx) + Math.abs(vz) > 8 && Math.random() < dt * 22) this.emit("sparks", { x: wx, y: wy, z: wz, n: 2 });
      }
    }
    if (bodyHit > 9) {
      this.hurt(bodyHit * 0.5);
      this.emit("bang", { power: Math.min(1, bodyHit / 22), x: this.pos[0], y: this.pos[1], z: this.pos[2] });
    }

    // 적분
    vel[0] += ax * dt;
    vel[1] += ay * dt;
    vel[2] += az * dt;
    const drag = 1 - 0.0016;
    vel[0] *= drag;
    vel[2] *= drag;
    const lim = 70;
    const sp2 = Math.hypot(vel[0], vel[1], vel[2]);
    if (sp2 > lim) {
      vel[0] *= lim / sp2;
      vel[1] *= lim / sp2;
      vel[2] *= lim / sp2;
    }
    this.pos[0] += vel[0] * dt;
    this.pos[1] += vel[1] * dt;
    this.pos[2] += vel[2] * dt;

    const tb = qInvRot(q, [tx, ty, tz], [0, 0, 0]);
    const ab = qRot(q, [tb[0] / this.I[0], tb[1] / this.I[1], tb[2] / this.I[2]], [0, 0, 0]);
    this.w[0] += ab[0] * dt;
    this.w[1] += ab[1] * dt;
    this.w[2] += ab[2] * dt;
    const wMag = Math.hypot(this.w[0], this.w[1], this.w[2]);
    if (wMag > 13) {
      this.w[0] *= 13 / wMag;
      this.w[1] *= 13 / wMag;
      this.w[2] *= 13 / wMag;
    }
    if (contacts > 0) {
      const wd = 1 - 0.8 * dt;
      this.w[0] *= wd;
      this.w[2] *= wd;
    }
    qStep(q, this.w, dt);

    // 바퀴 돌기
    this.vf = contacts ? vfNow : this.vf;
    this.speed = Math.hypot(vel[0], vel[2]);
    const spinTarget = contacts ? vfNow : this.vf + (input.throttle ? 12 : 0) - (input.brake ? 12 : 0);
    for (const wh of this.wheels) {
      const r = spinTarget / this.R;
      wh.rate += (r - wh.rate) * Math.min(1, dt * (wh.contact ? 30 : 3));
      wh.spin += wh.rate * dt;
    }
    this.steerVis += (input.steer * 0.5 - this.steerVis) * Math.min(1, dt * 10);

    this.jumpCd = Math.max(0, this.jumpCd - dt);
    this.padCd = Math.max(0, this.padCd - dt);
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.recoverCd = Math.max(0, this.recoverCd - dt);
    this.invT = Math.max(0, this.invT - dt);
    if (speedNow > this.stats.topSpeed) this.stats.topSpeed = speedNow;

    if (playing) {
      this.stepAir(dt, contacts, up);
      if (lava && this.recoverCd <= 0) {
        this.hurt(lava === MAT.LAVA ? 12 : 8);
        if (lava === MAT.LAVA) this.emit("lava", { x: this.pos[0], y: this.pos[1], z: this.pos[2] });
        this.recover(lava === MAT.LAVA ? "용암에 빠졌어요!" : "떨어졌어요!", true);
      }
      const gh = lvl.height(this.pos[0], this.pos[2]);
      if (this.pos[1] < gh - 2.5 || (lvl.mat(this.pos[0], this.pos[2]) !== MAT.LAVA && this.pos[1] < -60)) this.recover("떨어졌어요!", true);
    }
  }

  /** 스턴트 추적 */
  stepAir(dt, contacts, up) {
    if (contacts === 0) {
      this.airT += dt;
      this.groundT = 0;
      if (!this.air && this.airT > 0.12) {
        this.air = { t: 0, yaw: 0, pitch: 0, roll: 0, x: this.pos[0], z: this.pos[2], over: new Set(), breaks: 0, top: this.pos[1] };
        this.airArmed = false;
      }
      if (this.air) {
        const A = this.air;
        A.t += dt;
        A.top = Math.max(A.top, this.pos[1]);
        const wb = qInvRot(this.q, this.w, [0, 0, 0]);
        A.yaw += wb[1] * dt;
        A.pitch += wb[0] * dt;
        A.roll += wb[2] * dt;
        // 차량을 뛰어넘었나
        this.near(this.pos[0], this.pos[2], 5, (o) => {
          if (o.type !== "wreck" || o.state === 2 || A.over.has(o.i)) return;
          if (Math.hypot(o.x - this.pos[0], o.z - this.pos[2]) < 4.2 && this.pos[1] - o.y > 3) A.over.add(o.i);
        });
      }
    } else {
      this.groundT += dt;
      if (this.air && this.groundT > 0.03) this.land(up);
      if (this.groundT > 0.03) this.airT = 0;
    }
  }

  land(up) {
    const A = this.air;
    this.air = null;
    const impact = Math.max(0, -this.vel[1]);
    const upright = up[1];
    this.stats.air += A.t;
    this.stats.bestAir = Math.max(this.stats.bestAir, A.t);
    const land = { impact, x: this.pos[0], y: this.pos[1], z: this.pos[2], air: A.t };
    this.emit("land", land);
    if (A.t < 0.55) return;
    // 착지 충격: 주변이 들썩이고 부서진다
    if (impact > 7) {
      const R = 3 + impact * 0.34 * (this.def.mass / 5);
      this.shockwave(this.pos[0], this.pos[2], R, impact);
    }
    if (upright < 0.55) {
      this.emit("stunt", { label: "착지 실패!", score: 0, bad: true });
      this.hurt(6);
      return;
    }
    const labels = [];
    let pts = 0;
    const spin = Math.abs(A.yaw) / TAU;
    const flip = Math.abs(A.pitch) / TAU;
    const roll = Math.abs(A.roll) / TAU;
    if (A.t > 0.9) {
      pts += Math.round(A.t * 120);
      if (A.t > 1.9) labels.push("BIG AIR");
    }
    if (spin >= 0.72) {
      const n = Math.round(spin);
      labels.push(`${Math.max(1, n) * 360} SPIN`);
      pts += 500 * Math.max(1, n);
    } else if (spin >= 0.4) {
      labels.push("180 SPIN");
      pts += 200;
    }
    if (flip >= 0.72) {
      const n = Math.max(1, Math.round(flip));
      labels.push(`${A.pitch > 0 ? "FRONT" : "BACK"} FLIP${n > 1 ? ` x${n}` : ""}`);
      pts += 900 * n;
    }
    if (roll >= 0.72) {
      labels.push("BARREL ROLL");
      pts += 800 * Math.max(1, Math.round(roll));
    }
    const dist = Math.hypot(this.pos[0] - A.x, this.pos[2] - A.z);
    if (dist > 34) {
      labels.push("LONG JUMP");
      pts += Math.round(dist * 8);
    }
    if (A.over.size > 0) {
      labels.push(`CAR JUMP x${A.over.size}`);
      pts += 350 * A.over.size;
      this.stats.over += A.over.size;
    }
    if (labels.length && upright > 0.93) {
      labels.push("PERFECT");
      pts = Math.round(pts * 1.35);
    }
    // 목표 구역
    for (const z of this.level.zones) {
      if (Math.hypot(this.pos[0] - z.x, this.pos[2] - z.z) < z.r) {
        this.stats.zone = true;
        labels.push("정확한 착지");
        pts += 1200;
        this.emit("zone", { x: z.x, z: z.z });
      }
    }
    if (!labels.length) {
      if (pts > 0) this.addScore(pts);
      return;
    }
    const mult = this.mult();
    const gain = Math.round(pts * mult);
    this.addScore(gain);
    this.stats.stunts += 1;
    this.stats.stuntScore += gain;
    this.boost = Math.min(1, this.boost + 0.22);
    this.bumpCombo(1);
    this.emit("stunt", { label: labels.join(" + "), score: gain });
  }

  shockwave(x, z, R, impact) {
    this.near(x, z, R, (o) => {
      if (o.state === 2 || o.fixed) return;
      const dx = o.x - x;
      const dz = o.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist > R) return;
      const f = 1 - dist / R;
      const e = impact * this.def.power * f * 1.1;
      const n = [dx / (dist || 1), 0.7, dz / (dist || 1)];
      if (o.def.ride && !o.def.plank && dist < 3.4) {
        this.crushCar(o, 2);
        return;
      }
      if (!this.hitObject(o, e, n, "land")) this.pushObject(o, n, impact * f * 0.9 * Math.min(2, 0.6 / Math.sqrt(o.m)));
    });
    this.emit("shock", { x, z, r: R, power: Math.min(1, impact / 22) });
  }

  rideTop(o, x, z) {
    const dx = x - o.x;
    const dz = z - o.z;
    // 날아가는 차는 밟을 수 없다 (떨어져서 거의 멈춘 차는 밟는다)
    if (o.state === 1 && !o.def.plank && (o.launched || Math.abs(o.vx) + Math.abs(o.vy) + Math.abs(o.vz) > 2)) return null;
    const q = o.q;
    const s = 2 * q[1] * q[3];
    const c = 1 - 2 * q[1] * q[1];
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const hx = o.span ? o.span / 2 : o.h[0];
    if (Math.abs(lx) > hx + 0.35 || Math.abs(lz) > o.h[2] + 0.35) return null;
    if (o.def.plank) return o.y + o.h[1];
    return o.y - o.h[1] + o.def.ride * o.squash;
  }

  onRide(o, force) {
    if (o.def.plank) {
      if (o.fallT === 0) o.fallT = 0.32;
      return;
    }
    if (o.hitCd > 0) return;
    const level = force > 9 ? 2 : 1;
    this.crushCar(o, level);
  }

  /** 차를 밟아 찌그러뜨린다 */
  crushCar(o, level) {
    if (o.state === 2) return;
    o.hitCd = 0.22;
    const next = level >= 2 ? 0.34 : o.squash > 0.9 ? o.def.flat : 0.34;
    if (next >= o.squash) return;
    o.squash = next;
    o.moved = true;
    this.emit("crush", { x: o.x, y: o.y, z: o.z, type: o.type, flat: o.squash, color: o.color });
    if (!o.scored) {
      o.scored = true;
      this.award(o, "crush");
    }
    this.vel[1] += 1.2;
    this.boost = Math.min(1, this.boost + 0.03);
  }

  /** 절벽에 부딪혔다: 밀어내고 그 방향 속도를 없앤다 */
  hitCliff(c) {
    const n = this.level.normal(c[0], c[1]);
    const L = Math.hypot(n[0], n[2]);
    if (L < 0.2) return;
    const nx = n[0] / L;
    const nz = n[2] / L;
    this.pos[0] += nx * 0.3;
    this.pos[2] += nz * 0.3;
    const vn = this.vel[0] * nx + this.vel[2] * nz;
    if (vn >= 0) return;
    this.vel[0] -= nx * vn * 1.3;
    this.vel[2] -= nz * vn * 1.3;
    const hard = -vn;
    if (hard > 3 && this.hitCd <= 0) {
      this.hitCd = 0.2;
      if (hard > 12) this.hurt(hard * 0.4);
      this.emit("wall", { x: c[0], y: c[2] + 0.5, z: c[1], power: Math.min(1, hard / 22) });
    }
  }

  stepWalls() {
    const lvl = this.level;
    const big = this.def.wb / 3.7;
    const pts = [
      [1.2 * big, 2.5 * big],
      [-1.2 * big, 2.5 * big],
      [1.2 * big, -2.5 * big],
      [-1.2 * big, -2.5 * big],
    ];
    const f = this.fwd;
    const fl = Math.hypot(f[0], f[2]) || 1;
    const fx = f[0] / fl;
    const fz = f[2] / fl;
    let worst = 0;
    let nx = 0;
    let nz = 0;
    let px = 0;
    let pz = 0;
    for (const p of pts) {
      const x = this.pos[0] + fx * p[1] - fz * p[0];
      const z = this.pos[2] + fz * p[1] + fx * p[0];
      const o = lvl.off(x, z);
      if (o > worst) {
        worst = o;
        const w = lvl.wallNormal(x, z);
        nx = w[0];
        nz = w[1];
        px = x;
        pz = z;
      }
    }
    this.wallYaw = (this.wallYaw || 0) * 0.96;
    if (worst <= 0) return;
    const push = Math.min(worst, 0.5);
    this.pos[0] += nx * push;
    this.pos[2] += nz * push;
    const vn = this.vel[0] * nx + this.vel[2] * nz;
    if (vn < 0) {
      this.vel[0] -= nx * vn * 1.25;
      this.vel[2] -= nz * vn * 1.25;
      const hard = -vn;
      const easy = this.meta.assist;
      // 도우미: 벽에 스쳐도 덜 느려지고, 벽을 따라 더 잘 돈다
      const lose = Math.min(easy ? 0.08 : 0.2, hard * (easy ? 0.004 : 0.008));
      this.vel[0] *= 1 - lose;
      this.vel[2] *= 1 - lose;
      if (hard > 3 && this.hitCd <= 0) {
        this.hitCd = 0.18;
        if (hard > (easy ? 18 : 12)) this.hurt(hard * 0.4);
        this.emit("wall", { x: px, y: this.pos[1], z: pz, power: Math.min(1, hard / 22) });
      }
      // 벽을 따라가도록 몸을 살짝 돌린다
      const side = fz * nx - fx * nz;
      // 느려졌을 때만: 빠를 때 세게 돌리면 반대쪽 벽으로 튕겨 나간다
      const slowK = Math.max(0, 1 - Math.hypot(this.vel[0], this.vel[2]) / 9);
      this.wallYaw = (Math.abs(side) < 0.2 ? (side >= 0 ? 0.2 : -0.2) : side) * 2.2 * slowK;
      this.w[1] += side * Math.min(this.meta.assist ? 0.9 : 0.7, hard * (this.meta.assist ? 0.07 : 0.05));
    }
  }

  /* ---------- 트럭 ↔ 물체 ---------- */
  stepContacts() {
    const c = this.pos;
    const list = this.spheres;
    const R = this.R;
    const pt = [0, 0, 0];
    const sph = [];
    for (const s of list) {
      qRot(this.q, s, pt);
      sph.push([c[0] + pt[0], c[1] + pt[1], c[2] + pt[2], s[3], 0]);
    }
    for (const wh of this.wheels) {
      const offs = [wh.lx, wh.a[1] - wh.len, wh.lz];
      qRot(this.q, offs, pt);
      sph.push([c[0] + pt[0], c[1] + pt[1], c[2] + pt[2], R * 0.9, 1]);
    }
    this.near(c[0], c[2], 7, (o) => {
      if (o.state === 2) return;
      if (Math.abs(o.x - c[0]) > 6 + o.h[0] + o.h[2] || Math.abs(o.z - c[2]) > 6 + o.h[0] + o.h[2]) return;
      let best = null;
      for (const s of sph) {
        const hit = this.sphereBox(s, o);
        if (hit && (!best || hit.pen > best.pen)) best = { ...hit, sx: s[0], sy: s[1], sz: s[2], low: s[4] };
      }
      if (best) this.resolveHit(o, best);
    });
  }

  sphereBox(s, o) {
    const dp = [s[0] - o.x, s[1] - o.y, s[2] - o.z];
    const l = qInvRot(o.q, dp, [0, 0, 0]);
    const hy = o.h[1] * (o.def.ride ? o.squash : 1);
    const hx = o.span ? o.span / 2 : o.h[0];
    const cx = clamp(l[0], -hx, hx);
    const cy = clamp(l[1], -hy, hy);
    const cz = clamp(l[2], -o.h[2], o.h[2]);
    const dx = l[0] - cx;
    const dy = l[1] - cy;
    const dz = l[2] - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= s[3] * s[3]) return null;
    const dist = Math.sqrt(d2) || 0.001;
    const nl = d2 > 1e-5 ? [dx / dist, dy / dist, dz / dist] : [0, 1, 0];
    const n = qRot(o.q, nl, [0, 0, 0]);
    return { n, pen: s[3] - dist };
  }

  resolveHit(o, hit) {
    const def = o.def;
    const n = hit.n;
    if (o.hitCd > 0 && def.ride) return;
    // 트럭 쪽 접점 속도 - 물체 속도. n 은 물체 → 트럭 방향
    const rx = hit.sx - this.pos[0];
    const ry = hit.sy - this.pos[1];
    const rz = hit.sz - this.pos[2];
    const vx = this.vel[0] + this.w[1] * rz - this.w[2] * ry - o.vx;
    const vy = this.vel[1] + this.w[2] * rx - this.w[0] * rz - o.vy;
    const vz = this.vel[2] + this.w[0] * ry - this.w[1] * rx - o.vz;
    const rel = -(vx * n[0] + vy * n[1] + vz * n[2]);
    const energy = Math.max(0, rel) * this.def.power;

    if (def.plank) return;
    if (def.ride) {
      // 느리면 밟고 넘어가고, 빠르면 날려 보낸다
      if (o.state === 1 && (o.launched || Math.abs(o.vx) + Math.abs(o.vy) + Math.abs(o.vz) > 2)) return;
      if (energy < def.brk) {
        if (this.speed > 2.5) this.crushCar(o, 1);
        return;
      }
    }
    const m1 = this.def.mass;
    const m2 = o.m;
    if (rel > 0.4) {
      const dir = [-n[0], Math.max(-n[1], 0) + 0.12, -n[2]];
      // 벽에 몰린 물체는 더 쉽게 부서진다 (구석에 낀 마지막 하나 때문에 막히지 않게)
      const pinned = this.level.off(o.x, o.z) > -3.2 ? 2.2 : 1;
      const broke = this.hitObject(o, energy * pinned, dir, "truck");
      const absorb = broke ? 0.45 : 1 + (def.ball ? 0.1 : 0.22);
      const j = (absorb * rel) / (1 / m1 + 1 / m2);
      const dvT = j / m1;
      this.vel[0] += n[0] * dvT;
      this.vel[1] += Math.max(0, n[1]) * dvT * 0.5;
      this.vel[2] += n[2] * dvT;
      if (o.state !== 2) {
        const dvO = (j / m2) * (broke ? 0.6 : 1);
        this.pushObject(o, dir, dvO);
      }
      if (def.hurt && rel > 5) this.hurt(rel * def.hurt * 0.7);
      if (rel > 4) {
        const power = Math.min(1, (rel * Math.min(2.2, Math.sqrt(m2))) / 16);
        if (power > 0.12) this.emit("impact", { power, x: hit.sx, y: hit.sy, z: hit.sz, mat: def.mat });
      }
      // 살짝 끄덕
      const tq = Math.min(1.2, Math.max(0, rel) * Math.min(1, m2 / m1) * 0.09);
      this.w[0] += this.fwd[2] * tq * 0.5;
      this.w[2] -= this.fwd[0] * tq * 0.5;
    }
    if (def.push && this.input.throttle > 0) {
      // 몸으로 계속 민다 (부스터면 더 세게)
      this.pushing = 0.2;
      this.wake(o);
      const push = this.def.accel * (this.boosting ? 1.9 : 1) * Math.sqrt(m1 / m2) * this.def.power * STEP * 1.1;
      o.vx += this.fwd[0] * push;
      o.vz += this.fwd[2] * push;
      o.moved = true;
    }
    if (o.state !== 2) {
      // 겹침 풀기: 가벼운 쪽이 더 밀린다
      const share = m2 / (m1 + m2);
      this.pos[0] += n[0] * hit.pen * share;
      this.pos[1] += Math.max(0, n[1]) * hit.pen * share;
      this.pos[2] += n[2] * hit.pen * share;
      if (!o.fixed && (o.state === 1 || m2 < m1 * 0.5)) {
        o.x -= n[0] * hit.pen * (1 - share);
        o.z -= n[2] * hit.pen * (1 - share);
        o.moved = true;
        if (o.state === 0 && rel > 0.2) this.wake(o);
      }
    }
  }

  /** 충격을 주고 부서졌으면 true */
  hitObject(o, energy, dir, src) {
    if (o.state === 2 || o.fixed) return false;
    const def = o.def;
    if (o.type === "boom") {
      if (energy >= def.brk * 0.5 && !o.fuse) {
        o.fuse = src === "blast" ? 0.12 + Math.random() * 0.1 : 0.36;
        this.emit("fuse", { x: o.x, y: o.y, z: o.z, i: o.i });
        this.wake(o);
      }
      return false;
    }
    if (energy >= def.brk) {
      this.destroy(o, energy, dir, src);
      return true;
    }
    if (def.dent && energy >= def.dent) {
      if (o.hitCd > 0) return false;
      o.hitCd = 0.2;
      o.hp -= 1;
      o.dmg += 1;
      o.moved = true;
      this.emit("dent", { x: o.x, y: o.y, z: o.z, type: o.type, mat: def.mat, i: o.i });
      if (o.hp <= 0) {
        this.destroy(o, energy, dir, src);
        return true;
      }
    }
    return false;
  }

  pushObject(o, dir, dv) {
    if (o.state === 2 || o.fixed || o.def.ride === 0.3) return;
    if (o.state === 0) this.wake(o);
    o.vx += dir[0] * dv;
    o.vy += Math.max(0, dir[1]) * dv;
    o.vz += dir[2] * dv;
    const spin = Math.min(9, dv * 0.7);
    o.wx += (Math.random() - 0.5) * spin;
    o.wy += (Math.random() - 0.5) * spin;
    o.wz += (Math.random() - 0.5) * spin;
    o.moved = true;
  }

  wake(o) {
    if (o.state !== 0) return;
    o.state = 1;
    o.rest = 0;
    for (const c of o.children) {
      const ch = this.objects[c];
      if (ch.state === 0) this.wake(ch);
    }
  }

  destroy(o, energy, dir, src) {
    if (o.state === 2) return;
    const def = o.def;
    if (o.type === "wreck") {
      // 차는 사라지지 않고 뒤집히며 날아간다
      if (o.launched) return;
      o.launched = true;
      this.wake(o);
      const dv = Math.min(24, energy * 0.9 + 4);
      o.vx += dir[0] * dv;
      o.vy += 5 + dv * 0.42;
      o.vz += dir[2] * dv;
      o.wx += (Math.random() - 0.5) * 11;
      o.wy += (Math.random() - 0.5) * 7;
      o.wz += (Math.random() - 0.5) * 11;
      o.life = 5.5;
      o.squash = Math.min(o.squash, 0.86);
      this.emit("break", { type: o.type, mat: def.mat, x: o.x, y: o.y, z: o.z, vx: o.vx, vy: o.vy, vz: o.vz, energy, color: o.color, partial: true });
      if (!o.scored) {
        o.scored = true;
        this.award(o, src);
      }
      return;
    }
    o.state = 2;
    o.moved = true;
    const list = this.grid.get(o.cell);
    if (list) {
      const n = list.indexOf(o);
      if (n >= 0) list.splice(n, 1);
    }
    for (const c of o.children) {
      const ch = this.objects[c];
      if (ch.state === 0) {
        this.wake(ch);
        ch.fallFrom = true;
      }
    }
    this.emit("break", { type: o.type, mat: def.mat, x: o.x, y: o.y, z: o.z, vx: o.vx + (dir ? dir[0] * energy * 0.5 : 0), vy: o.vy + 2 + energy * 0.2, vz: o.vz + (dir ? dir[2] * energy * 0.5 : 0), energy, big: o.big, color: o.color, sy: o.h[1] });
    if (!o.scored) {
      o.scored = true;
      this.award(o, src);
    }
  }

  checkBoss() {
    const left = this.objects.filter((x) => x.tag === "boss" && !x.scored).length;
    if (left === 0 && this.bossTotal > 0 && !this.stats.collapsed) {
      this.stats.collapsed = true;
      this.emit("slowmo", { dur: 1.1 });
      this.emit("collapse", {});
    }
  }

  explode(o) {
    o.state = 2;
    const list = this.grid.get(o.cell);
    if (list) {
      const n = list.indexOf(o);
      if (n >= 0) list.splice(n, 1);
    }
    for (const c of o.children) {
      const ch = this.objects[c];
      if (ch.state === 0) this.wake(ch);
    }
    const R = 11;
    this.emit("boom", { x: o.x, y: o.y, z: o.z, r: R, i: o.i });
    if (!o.scored) {
      o.scored = true;
      this.award(o, "blast");
    }
    if (this.chainT > 0) this.chainN += 1;
    else this.chainN = 1;
    this.chainT = 1.1;
    this.stats.chain = Math.max(this.stats.chain, this.chainN);
    if (this.chainN >= 2) this.emit("chain", { n: this.chainN });
    this.near(o.x, o.z, R, (x) => {
      if (x === o || x.state === 2 || x.fixed) return;
      const dx = x.x - o.x;
      const dy = x.y - o.y;
      const dz = x.z - o.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > R) return;
      const f = 1 - dist / R;
      const e = 8 + 26 * f;
      const n = [dx / (dist || 1), 0.6, dz / (dist || 1)];
      if (!this.hitObject(x, e, n, "blast")) {
        this.pushObject(x, n, (6 + 15 * f) * Math.min(1.6, 0.9 / Math.sqrt(x.m)));
      }
    });
    const tdx = this.pos[0] - o.x;
    const tdy = this.pos[1] - o.y;
    const tdz = this.pos[2] - o.z;
    const td = Math.hypot(tdx, tdy, tdz);
    if (td < R) {
      const f = 1 - td / R;
      // 폭발에 떠밀리되, 연쇄 폭발이 겹쳐도 하늘로 날아가 뒤집히지는 않게
      this.vel[0] += (tdx / (td || 1)) * f * 5;
      if (this.vel[1] < 7.5) this.vel[1] = Math.min(7.5, this.vel[1] + f * 8);
      this.vel[2] += (tdz / (td || 1)) * f * 5;
      this.w[0] = Math.max(-1.1, Math.min(1.1, this.w[0] + (Math.random() - 0.5) * f * 1.4));
      this.w[2] = Math.max(-1.1, Math.min(1.1, this.w[2] + (Math.random() - 0.5) * f * 1.4));
      this.hurt(f * (this.chainN > 2 ? 2.5 : 6));
    }
  }

  stepObjects(dt) {
    const lvl = this.level;
    for (const o of this.objects) {
      if (o.hitCd > 0) o.hitCd -= dt;
      if (o.state === 2) continue;
      if (o.fuse > 0) {
        o.fuse -= dt;
        if (o.fuse <= 0) {
          this.explode(o);
          continue;
        }
      }
      if (o.fallT > 0) {
        o.fallT -= dt;
        if (o.fallT <= 0) {
          o.state = 1;
          o.fixed = false;
          o.vy = -1;
          o.wx = (Math.random() - 0.5) * 2;
          o.life = 2.2;
          o.moved = true;
          this.emit("creak", { x: o.x, y: o.y, z: o.z });
          if (!o.scored) {
            o.scored = true;
            this.addScore(40);
          }
        }
      }
      if (o.state !== 1) continue;
      o.moved = true;
      if (o.life > 0) {
        o.life -= dt;
        if (o.life <= 0) {
          o.state = 2;
          const list = this.grid.get(o.cell);
          if (list) {
            const n = list.indexOf(o);
            if (n >= 0) list.splice(n, 1);
          }
          continue;
        }
      }
      if (o.def.push) {
        const list = lvl.samples;
        const a = list[Math.min(list.length - 1, 4)];
        const fx = Math.sin(a.th);
        const fz = Math.cos(a.th);
        // 레일 위에서 앞으로만 밀린다 (반대로 밀어 경기장 끝에 처박히면 깰 수 없게 된다)
        const along = Math.max(0, o.vx * fx + o.vz * fz);
        o.vx = fx * along;
        o.vz = fz * along;
        o.wx = 0;
        o.wy = 0;
        o.wz = 0;
      }
      o.vy -= G * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.z += o.vz * dt;
      qStep(o.q, [o.wx, o.wy, o.wz], dt);
      // 땅
      const e = this.boxExtentY(o);
      const gy = lvl.height(o.x, o.z);
      const bottom = o.y - e;
      if (bottom < gy) {
        const vIn = -o.vy;
        o.y = gy + e;
        if (o.def.ride && !o.def.plank && o.parent >= 0 && !o.scored && !o.launched) {
          o.scored = true;
          o.squash = o.def.flat;
          this.award(o, "chain");
          this.emit("crush", { x: o.x, y: o.y, z: o.z, type: o.type, flat: o.squash, color: o.color });
        }
        if (vIn > 7 && !o.def.plank) {
          const dmg = vIn * 1.25 * Math.sqrt(Math.max(0.3, o.m));
          this.emit("thud", { x: o.x, y: gy, z: o.z, power: Math.min(1, (vIn * Math.sqrt(o.m)) / 22), mat: o.def.mat });
          if (this.hitObject(o, dmg, [0, 0.3, 0], "fall")) continue;
        }
        o.vy = vIn > 2 ? vIn * (o.def.ball ? 0.32 : 0.24) : 0;
        const fr = o.def.ball ? 0.15 : o.def.push ? 2 : 5.5;
        const sp = Math.hypot(o.vx, o.vz);
        if (sp > 0) {
          const nv = Math.max(0, sp - fr * dt);
          o.vx *= nv / sp;
          o.vz *= nv / sp;
        }
        if (o.def.ball) {
          // 경사를 따라 굴러간다
          const n = lvl.normal(o.x, o.z);
          o.vx += n[0] * G * dt;
          o.vz += n[2] * G * dt;
        } else {
          const sd = Math.pow(0.05, dt);
          o.wx *= sd;
          o.wy *= sd;
          o.wz *= sd;
          this.settle(o, dt);
        }
      }
      // 코스 밖으로 나가지 않게
      const off = lvl.off(o.x, o.z);
      if (off > 2) {
        const w = lvl.wallNormal(o.x, o.z);
        const vn = o.vx * w[0] + o.vz * w[1];
        if (vn < 0) {
          o.vx -= w[0] * vn * 1.5;
          o.vz -= w[1] * vn * 1.5;
        }
        o.x += w[0] * (off - 2) * 0.5;
        o.z += w[1] * (off - 2) * 0.5;
      }
      this.gridMove(o);
      const sp = Math.abs(o.vx) + Math.abs(o.vy) + Math.abs(o.vz);
      // 다른 물체와 부딪힘 (연쇄)
      if (sp > 3 && !o.def.plank) this.objectHits(o);
      if (sp + Math.abs(o.wx) + Math.abs(o.wz) < 0.5 && bottom < gy + 0.1 && !o.def.ball) {
        o.rest += dt;
        if (o.rest > 0.5 && !o.life) {
          o.state = 0;
          o.vx = 0;
          o.vy = 0;
          o.vz = 0;
          o.wx = 0;
          o.wy = 0;
          o.wz = 0;
        }
      } else o.rest = 0;
      if (o.y < gy - 30) o.state = 2;
    }
  }

  boxExtentY(o) {
    const [x, y, z, w] = o.q;
    const hy = o.h[1] * (o.def.ride ? o.squash : 1);
    const r10 = 2 * (x * y + z * w);
    const r11 = 1 - 2 * (x * x + z * z);
    const r12 = 2 * (y * z - x * w);
    return Math.abs(r10) * o.h[0] + Math.abs(r11) * hy + Math.abs(r12) * o.h[2];
  }

  /** 넘어진 상자가 모서리로 서 있지 않게, 가장 가까운 면으로 눕힌다 */
  settle(o, dt) {
    const q = o.q;
    const up = qInvRot(q, [0, 1, 0], [0, 0, 0]);
    const ax = [Math.abs(up[0]), Math.abs(up[1]), Math.abs(up[2])];
    const i = ax[0] > ax[1] ? (ax[0] > ax[2] ? 0 : 2) : ax[1] > ax[2] ? 1 : 2;
    const target = [0, 0, 0];
    target[i] = up[i] > 0 ? 1 : -1;
    const c = cross(up, target);
    const k = 3.2 * dt;
    qStep(q, qRot(q, [c[0] * k / dt, c[1] * k / dt, c[2] * k / dt], [0, 0, 0]), dt);
  }

  objectHits(o) {
    const r = Math.min(o.h[0], o.h[1], o.h[2]) + 0.35;
    const s = [o.x, o.y, o.z, r];
    this.near(o.x, o.z, 5, (b) => {
      if (b === o || b.state === 2 || b.fixed) return;
      if (Math.abs(b.y - o.y) > b.h[1] + o.h[1] + 1.5) return;
      const hit = this.sphereBox(s, b);
      if (!hit) return;
      const rel = -((o.vx - b.vx) * hit.n[0] + (o.vy - b.vy) * hit.n[1] + (o.vz - b.vz) * hit.n[2]);
      if (rel < 1) return;
      const dir = [-hit.n[0], 0.25, -hit.n[2]];
      const m1 = o.m;
      const m2 = b.m;
      const e = rel * Math.min(2.4, Math.sqrt(m1)) * 0.95;
      if (b.def.ride && !b.def.plank) {
        if (e > 5) this.destroy(b, e * 1.1, dir, "chain");
        return;
      }
      const broke = this.hitObject(b, e, dir, "chain");
      const j = (1.1 * rel) / (1 / m1 + 1 / m2);
      o.vx += (hit.n[0] * j) / m1;
      o.vz += (hit.n[2] * j) / m1;
      if (!broke && b.state !== 2 && rel > 1.5) this.pushObject(b, dir, j / m2);
      if (m1 >= 1.2 && e > 3) {
        const selfE = rel * Math.sqrt(m2) * 0.5;
        this.hitObject(o, selfE, [hit.n[0], 0.3, hit.n[2]], "chain");
      }
    });
  }

  /* ---------- 점수 ---------- */
  mult() {
    return 1 + Math.min(4, Math.floor(this.combo / 5) * 0.5);
  }

  bumpCombo(n = 1) {
    this.combo += n;
    this.comboT = 3.4;
    if (this.combo > this.stats.bestCombo) this.stats.bestCombo = this.combo;
    for (let i = COMBO_WORDS.length - 1; i >= 0; i -= 1) {
      const [need, word] = COMBO_WORDS[i];
      if (this.combo >= need) {
        if (this.comboWord < need) {
          this.comboWord = need;
          this.emit("word", { word, combo: this.combo, tier: i });
          if (i >= 3) this.emit("slowmo", { dur: 0.5 });
        }
        break;
      }
    }
  }

  addScore(v) {
    this.score += v;
  }

  award(o, src) {
    const def = o.def;
    this.stats.destroyed += 1;
    this.stats.by[o.type] = (this.stats.by[o.type] || 0) + 1;
    this.bumpCombo(1);
    let pts = def.score;
    if (src === "blast") pts = Math.round(pts * 1.5);
    if (src === "land" || src === "crush") pts = Math.round(pts * 1.2);
    if (this.air) this.air.breaks += 1;
    const gain = Math.round(pts * this.mult());
    this.addScore(gain);
    this.boost = Math.min(1, this.boost + 0.035);
    this.emit("score", { x: o.x, y: o.y + o.h[1] + 1, z: o.z, gain, big: gain >= 500 });
    if (o.tag === "boss") this.checkBoss();
  }

  hurt(v) {
    if (this.invT > 0) return;
    this.damage = Math.min(100, this.damage + v / this.def.armor);
  }

  /** 안전한 자리로 되돌리기. fell: 구덩이에 빠졌을 때 */
  recover(msg, fell = false) {
    if (this.recoverCd > 0) return;
    this.recoverCd = 1.2;
    this.invT = 2.6;
    this.stats.recover += 1;
    let x = this.safe.x;
    let z = this.safe.z;
    let th = this.safe.th;
    let speed = 6;
    const lvl = this.level;
    if (!lvl.noFinish) {
      const list = lvl.samples;
      let i = Math.max(0, this.pi - 8);
      if (fell) {
        const same = Math.abs(this.pi - this.failPi) < 60;
        this.failN = same ? this.failN + 1 : 1;
        this.failPi = this.pi;
        const broken = this.objects.some((o) => o.def.plank && (o.state === 1 || o.state === 2) && Math.hypot(o.x - this.pos[0], o.z - this.pos[2]) < 60);
        if (this.failN >= 2 || broken) {
          // 건너편으로 옮겨 준다 (같은 곳에 계속 빠지지 않게)
          i = this.pi;
          while (i < list.length - 1 && (lvl.height(list[i].x, list[i].z) < list[i].y - 0.6 || lvl.mat(list[i].x, list[i].z) === MAT.LAVA)) i += 1;
          i = Math.min(list.length - 1, i + 8);
          msg = "건너편으로 옮겨 줬어요";
          speed = 10;
          this.failN = 0;
        } else {
          // 도움닫기: 점프대 한참 앞에서 빠르게 다시 출발
          i = Math.max(0, this.pi - 70);
          speed = this.def.top * 0.72;
        }
      }
      const a = list[i];
      x = a.x;
      z = a.z;
      th = a.th;
      this.pi = i;
    }
    const y = lvl.height(x, z);
    this.pos = [x, y + this.R + 1.25, z];
    this.vel = [Math.sin(th) * speed, 0, Math.cos(th) * speed];
    this.w = [0, 0, 0];
    this.q = qYaw(th);
    this.air = null;
    this.airT = 0;
    for (const wh of this.wheels) {
      wh.prev = 0;
      wh.len = this.L * 0.7;
    }
    this.emit("recover", { msg: msg || "제자리로!" });
  }

  stepRules(dt) {
    const lvl = this.level;
    // 진행 위치
    if (!lvl.noFinish) {
      const list = lvl.samples;
      let best = this.pi;
      let bd = 1e12;
      const a = Math.max(0, this.pi - 6);
      const b = Math.min(list.length - 1, this.pi + 28);
      for (let i = a; i <= b; i += 1) {
        const dx = list[i].x - this.pos[0];
        const dz = list[i].z - this.pos[2];
        const d = dx * dx + dz * dz;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      this.pi = best;
      for (const t of lvl.triggers) {
        if (!t.done && list[this.pi].s >= t.s) {
          t.done = true;
          this.fireTrigger(t);
        }
      }
    } else {
      for (const t of lvl.triggers) {
        if (!t.done && this.time >= t.s) {
          t.done = true;
          this.fireTrigger(t);
        }
      }
    }

    // 안전한 자리 기억
    this.safeT -= dt;
    if (this.safeT <= 0 && this.contacts >= 3 && this.up[1] > 0.8 && lvl.off(this.pos[0], this.pos[2]) < -2) {
      this.safeT = 0.5;
      this.safe = { x: this.pos[0], z: this.pos[2], th: Math.atan2(this.fwd[0], this.fwd[2]) };
    }

    // 콤보 시간
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        this.combo = 0;
        this.comboWord = 0;
      }
    }
    if (this.chainT > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0) this.chainN = 0;
    }

    // 뒤집힘 · 끼임 → 복구
    if (this.up[1] < 0.3 && this.speed < 5) this.flipT += dt;
    else this.flipT = 0;
    if (this.flipT > 1.4) {
      this.flipT = 0;
      this.recover("다시 세웠어요");
    }
    this.pushing = Math.max(0, (this.pushing || 0) - dt);
    if (this.speed < 1.2 && (this.input.throttle || this.input.brake) && !this.pushing) this.stuckT += dt;
    else this.stuckT = 0;
    if (this.stuckT > 3.2) {
      this.stuckT = 0;
      this.recover("끼어서 꺼내 줬어요");
    }

    // 부스터 발판
    if (this.padCd <= 0) {
      for (const p of lvl.pads) {
        if (Math.hypot(p.x - this.pos[0], p.z - this.pos[2]) < p.r + 1) {
          this.padCd = 0.8;
          this.vel[0] += this.fwd[0] * 9;
          this.vel[2] += this.fwd[2] * 9;
          this.boost = Math.min(1, this.boost + 0.4);
          this.emit("pad", { x: p.x, z: p.z });
          break;
        }
      }
    }

    // 불꽃 분출
    for (const g of lvl.geysers) {
      if (!geyserOn(g, this.time)) continue;
      if (Math.hypot(g.x - this.pos[0], g.z - this.pos[2]) < g.r + 1.2 && this.invT <= 0 && this.pos[1] < lvl.height(g.x, g.z) + 7) {
        this.invT = 0.8;
        this.vel[1] += 7;
        this.hurt(10);
        this.emit("burn", { x: this.pos[0], y: this.pos[1], z: this.pos[2] });
      }
    }

    // 미는 목표
    for (const o of this.objects) {
      if (!o.def.push || this.stats.pushed || o.state === 2) continue;
      const z = lvl.zones[0];
      if (z && Math.hypot(o.x - z.x, o.z - z.z) < z.r) {
        this.stats.pushed = true;
        this.emit("slowmo", { dur: 1 });
        this.emit("collapse", {});
        this.award(o, "truck");
      }
    }

    this.checkEnd();
  }

  fireTrigger(t) {
    if (t.kind === "wake") {
      for (const o of this.objects) {
        if (o.tag === t.tag && o.state === 0) {
          this.wake(o);
          o.vx += t.vx || 0;
          o.vz += t.vz || 0;
          o.vy += t.vy || 0;
        }
      }
      if (t.text) this.emit("recover", { msg: t.text, info: true });
      this.emit("shake", { power: 0.5 });
    }
  }

  /* ---------- 끝나는 조건 ---------- */
  missionState(m) {
    const st = this.stats;
    switch (m.k) {
      case "finish":
        return { done: this.finished === true, cur: 0, max: 0 };
      case "time":
        return { done: this.finished === true && this.time <= m.t, cur: this.time, max: m.t, failed: this.time > m.t };
      case "destroy": {
        const cur = m.type ? st.by[m.type] || 0 : st.destroyed;
        return { done: cur >= m.n, cur, max: m.n };
      }
      case "score":
        return { done: this.score >= m.n, cur: this.score, max: m.n };
      case "stunts":
        return { done: st.stunts >= m.n, cur: st.stunts, max: m.n };
      case "stuntScore":
        return { done: st.stuntScore >= m.n, cur: st.stuntScore, max: m.n };
      case "over":
        return { done: st.over >= m.n, cur: st.over, max: m.n };
      case "chain":
        return { done: st.chain >= m.n, cur: st.chain, max: m.n };
      case "combo":
        return { done: st.bestCombo >= m.n, cur: st.bestCombo, max: m.n };
      case "damage":
        return { done: this.damage <= m.max && (this.finished === true || this.mainDone === true), cur: this.damage, max: m.max, failed: this.damage > m.max };
      case "air":
        return { done: st.bestAir >= m.t, cur: st.bestAir, max: m.t };
      case "zone":
        return { done: st.zone, cur: st.zone ? 1 : 0, max: 1 };
      case "collapse":
        return { done: st.collapsed, cur: this.bossTotal - this.objects.filter((x) => x.tag === "boss" && !x.scored).length, max: this.bossTotal };
      case "push":
        return { done: st.pushed, cur: st.pushed ? 1 : 0, max: 1 };
      default:
        return { done: false, cur: 0, max: 0 };
    }
  }

  checkEnd() {
    const lvl = this.level;
    const meta = this.meta;
    if (lvl.finish && !this.finished) {
      const f = lvl.finish;
      const fx = Math.sin(f.th);
      const fz = Math.cos(f.th);
      const dx = this.pos[0] - f.x;
      const dz = this.pos[2] - f.z;
      const along = dx * fx + dz * fz;
      if (along > -2 && this.pi >= lvl.samples.length - 8) {
        this.finished = true;
        this.emit("finish", {});
      }
    }
    const main = meta.main || { k: "finish" };
    const ms = this.missionState(main);
    if (meta.endless) {
      // 토탈 디스트럭션: 목표 점수를 넘겨도 시간이 끝날 때까지 계속 부순다. 다 부수면 바로 끝
      if (ms.done) this.mainDone = true;
      const allGone = this.stats.destroyed >= this.totalBreakable;
      if ((this.limit && this.time >= this.limit) || allGone) this.end(this.mainDone === true, this.mainDone ? undefined : "시간이 다 됐어요");
      return;
    }
    if (meta.extra && ms.done) {
      // 스턴트 마스터: 목표를 넘기면 클리어. 남은 보너스 시간 동안 별을 더 노린다
      if (!this.mainDone) {
        this.mainDone = true;
        this.extraT = meta.extra;
        this.emit("recover", { msg: `목표 달성! 보너스 타임 ${meta.extra}초`, info: true });
      }
      this.extraT -= STEP;
      const bonusDone = (meta.bonus || []).every((q) => this.missionState(q).done);
      if (this.extraT <= 0 || bonusDone || (this.limit && this.time >= this.limit)) this.end(true);
      return;
    }
    if (ms.done && !this.mainDone) this.mainDone = true;
    if (this.mainDone) {
      this.endT += STEP;
      if (main.k === "finish" || this.endT > 0.7) this.end(true);
      return;
    }
    if (this.limit && this.time >= this.limit) {
      // 시간 끝. 부수기 모드는 점수가 목표에 못 미치면 실패
      this.end(false, "시간이 다 됐어요");
    }
    if (lvl.finish && this.finished && main.k !== "finish" && !this.mainDone) {
      this.end(false, "목표를 다 못 채웠어요");
    }
  }

  end(ok, why) {
    if (this.state === "done") return;
    this.state = "done";
    const missions = [this.meta.main || { k: "finish" }, ...(this.meta.bonus || [])];
    const results = missions.map((m) => ({ m, ...this.missionState(m) }));
    if (!ok) results[0].done = false;
    let stars = 0;
    if (ok) stars = 1 + results.slice(1).filter((r) => r.done).length;
    this.result = { ok, why, stars: Math.min(3, stars), results, score: Math.round(this.score), time: this.time, damage: this.damage, stats: this.stats };
    this.emit("end", { ok });
  }
}

export function geyserOn(g, time) {
  return (time + g.off) % g.period < g.on;
}
