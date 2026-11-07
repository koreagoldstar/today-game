/*
 * 인형뽑기 물리: 화면과 무관한 순수 계산 (브라우저 없이도 돈다)
 *  - 인형: 구 여러 개를 붙인 강체. 3차원으로 움직이고, 화면 쪽 축(z)으로만 기울어진다.
 *  - 집게: 케이블에 매달린 머리(진자) + 모터로 접히는 발 3개. 발은 관절이라 무거운 인형에 밀려 벌어진다.
 *  - 접촉은 순차 충격량(sequential impulse) 방식: 질량 · 마찰 · 반발 · 회전 · 관성이 모두 들어간다.
 *  성공과 실패를 정하는 난수는 없다. 처음 배치에만 씨앗 난수를 쓴다.
 */
import { DOLLS, dollById } from "./data.js?v=1";

export const G = 980; // cm/s²
export const STEP = 1 / 240;
const ITER = 10;
const D2R = Math.PI / 180;
export const BOX = { x0: -50, x1: 50, z0: 0, z1: 60, top: 92 };
export const CHUTE = { x0: -50, x1: -19, z0: 0, z1: 31, h: 14 };
export const HOME = { x: -34.5, z: 16.5 }; // 배출구 위: 발을 38도까지 벌려도 앞 유리 · 왼쪽 벽에 안 닿는 자리
export const RAIL_Y = 86;
const DENS = 0.0115;
const HEAD_M = 50;
const HUB_R = 4.6;
export const PRONG = { L1: 13, L2: 8, hR: 7, hY: -2, bend: 75 * D2R, open: 42 * D2R, wide: 75 * D2R, closed: 3 * D2R, min: 0, r: 1.6, I: 900 };
export const TAU = 105000; // 집게 힘 1.0 일 때 발 하나의 모터 힘 (토크)
// 봉제인형은 말랑하다: 집게 발이 이만큼까지는 스프링처럼 파고든다
const SOFT = 2.2;
const PLUSH_K = 7000;
const PLUSH_C = 60;
const L_TOP = 12;
// 잠자기: 가만히 있는 인형은 계산을 쉬게 해 저절로 미끄러지는 떨림을 막는다 (물리 엔진의 sleep)
const SLEEP_V = 2.5;
const SLEEP_W = 0.25;
const SLEEP_T = 0.4;
const WAKE_V = 5;
const L_MAX = 80;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const PHASE_KO = { idle: "대기", moving: "이동", descending: "하강", contact: "접촉", closing: "닫힘", gripping: "잡기", lifting: "상승", carrying: "운반", releasing: "놓기", returning: "복귀" };

export function mulberry32(a) {
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 고정된 상자들 (바닥 · 벽 · 배출구 아크릴 벽). 배출구 자리는 바닥이 뚫려 있다 */
const STATIC = [
  { x0: CHUTE.x1, x1: 60, y0: -20, y1: 0, z0: -5, z1: 65, mu: 0.75, floor: true },
  { x0: -60, x1: CHUTE.x1, y0: -20, y1: 0, z0: CHUTE.z1, z1: 65, mu: 0.75, floor: true },
  { x0: -70, x1: BOX.x0, y0: -60, y1: 140, z0: -20, z1: 80, mu: 0.3 },
  { x0: BOX.x1, x1: 70, y0: -60, y1: 140, z0: -20, z1: 80, mu: 0.3 },
  { x0: -70, x1: 70, y0: -60, y1: 140, z0: -20, z1: BOX.z0, mu: 0.25 },
  { x0: -70, x1: 70, y0: -60, y1: 140, z0: BOX.z1, z1: 80, mu: 0.3 },
  { x0: CHUTE.x1 - 1.2, x1: CHUTE.x1 + 1.2, y0: -20, y1: CHUTE.h, z0: -5, z1: CHUTE.z1 + 1.2, mu: 0.3, glass: true },
  { x0: -60, x1: CHUTE.x1 + 1.2, y0: -20, y1: CHUTE.h, z0: CHUTE.z1 - 1.2, z1: CHUTE.z1 + 1.2, mu: 0.3, glass: true },
];

/** 받침이 있으면 '을', 없으면 '를' */
const eul = (w) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? "을" : "를");
const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);

/** 인형 하나: 구 [x, y, 반지름, 마찰 배율, 앞뒤 z] 를 무게중심 기준으로 붙인 강체 */
function makeDoll(kind, x, y, z, a = 0) {
  const def = dollById(kind);
  const dens = DENS * (def.dens || 1);
  let m = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const [ox, oy, r, , oz = 0] of def.sph) {
    const mi = r * r * r * 4.19 * dens;
    m += mi;
    cx += ox * mi;
    cy += oy * mi;
    cz += oz * mi;
  }
  cx /= m;
  cy /= m;
  cz /= m;
  const sph = def.sph.map(([ox, oy, r, f = 1, oz = 0]) => ({ ox: ox - cx, oy: oy - cy, oz: oz - cz, r, f }));
  let I = 0;
  let bound = 0;
  for (const s of sph) {
    const mi = s.r * s.r * s.r * 4.19 * dens;
    I += mi * (0.4 * s.r * s.r + s.ox * s.ox + s.oy * s.oy);
    bound = Math.max(bound, Math.hypot(s.ox, s.oy, s.oz) + s.r);
  }
  return { kind, def, x, y, z, vx: 0, vy: 0, vz: 0, a, w: 0, m, I, sph, bound, comX: cx, comY: cy, comZ: cz, held: false, prongN: 0, prongMask: 0, lastMask: 0, support: 0, impact: 0, id: 0, rest: 0, sleep: false };
}

export class Claw {
  /**
   * opt.power · stable · speed: 업그레이드 값 (data.js 의 vals)
   * opt.dolls: [[kind, x, y, z, a]] 처음 배치를 직접 줄 때 (점검용)
   */
  constructor({ seed = 1, machine, power = 1, stable = 0.6, speed = 1, dolls, force = [] } = {}) {
    this.rand = mulberry32(seed);
    this.machine = machine;
    this.power = power;
    this.stable = stable;
    this.speed = speed;
    this.dolls = [];
    this.nextId = 1;
    this.events = [];
    this.t = 0;
    // 집게
    this.cx = HOME.x;
    this.cz = HOME.z;
    this.cvx = 0;
    this.cvz = 0;
    this.L = L_TOP;
    this.Lrate = 0;
    this.hx = HOME.x;
    this.hy = RAIL_Y - L_TOP;
    this.hz = HOME.z;
    this.hvx = 0;
    this.hvy = 0;
    this.hvz = 0;
    const phis = [-90, 30, 150].map((d) => d * D2R);
    this.prongs = phis.map((p) => ({ rx: Math.cos(p), rz: Math.sin(p), a: PRONG.closed, av: 0 }));
    this.wantOpen = false;
    // 상태: idle → moving → descending → contact → closing → (gripping) → lifting → carrying → releasing → returning → idle
    this.phase = "idle";
    this.phaseT = 0;
    this.turnT = 0;
    this.log = [];
    this.touches = [];
    this.prongF = [0, 0, 0];
    this.ropeT = 0;
    this.input = { x: 0, z: 0 };
    this.slack = 0;
    this.turnPrizes = [];
    if (dolls) for (const d of dolls) this.add(d[0], d[1], d[2], d[3], d[4] || 0);
    else if (machine) this.fill(machine.count, 3, force);
  }

  add(kind, x, y, z, a = 0) {
    const d = makeDoll(kind, x, y, z, a);
    d.id = this.nextId;
    this.nextId += 1;
    this.dolls.push(d);
    return d;
  }

  pickKind() {
    const pool = this.machine.pool;
    const sum = pool.reduce((s, p) => s + p[1], 0);
    let r = this.rand() * sum;
    for (const [k, w] of pool) {
      r -= w;
      if (r <= 0) return k;
    }
    return pool[0][0];
  }

  /** 위에서 떨어뜨려 쌓고, 가라앉을 때까지 미리 돌린다 (공중에 뜨거나 겹치지 않게) */
  fill(n, settle = 3, force = []) {
    for (let i = 0; i < n; i += 1) {
      const x = -12 + this.rand() * 56;
      const z = 9 + this.rand() * 44;
      // 꼭 넣을 인형(도전 목표)은 마지막에 떨어뜨려 위쪽에 놓인다
      const fi = i - (n - force.length);
      const kind = fi >= 0 ? force[fi] : this.pickKind();
      this.add(kind, x, 14 + (i % 5) * 16 + this.rand() * 4, z, (this.rand() - 0.5) * 0.6);
    }
    const steps = Math.round(settle / STEP);
    for (let i = 0; i < steps; i += 1) this.step(STEP, true);
    // 높이 떨어뜨리다 배출구로 튄 인형이 있으면 뒤쪽에서 다시 채운다 (공짜 획득 X)
    if (this.dolls.length < n && this.refill(n)) for (let i = 0; i < steps; i += 1) this.step(STEP, true);
    this.turnPrizes = [];
    this.events.length = 0;
  }

  /** 기계에 인형이 적으면 뒤쪽 위에서 새로 떨어뜨린다 */
  refill(min) {
    let added = 0;
    while (this.dolls.length < min) {
      this.add(this.pickKind(), -10 + this.rand() * 50, 70, 40 + this.rand() * 14, (this.rand() - 0.5) * 0.5);
      added += 1;
    }
    return added;
  }

  emit(t, d = {}) {
    if (this.events.length < 120) this.events.push({ t, ...d });
  }

  /* ---------- 집게 모양 ---------- */
  hinge(p) {
    return [this.hx + p.rx * PRONG.hR, this.hy + PRONG.hY, this.hz + p.rz * PRONG.hR];
  }
  /** 발 하나의 두 마디: [관절, 꺾이는 곳, 끝] */
  prongPts(p) {
    const h = this.hinge(p);
    const s1 = Math.sin(p.a);
    const c1 = Math.cos(p.a);
    const e = [h[0] + p.rx * s1 * PRONG.L1, h[1] - c1 * PRONG.L1, h[2] + p.rz * s1 * PRONG.L1];
    const a2 = p.a - PRONG.bend;
    const s2 = Math.sin(a2);
    const c2 = Math.cos(a2);
    const t = [e[0] + p.rx * s2 * PRONG.L2, e[1] - c2 * PRONG.L2, e[2] + p.rz * s2 * PRONG.L2];
    return [h, e, t];
  }

  /* ---------- 조작 ---------- */
  setInput(x, z) {
    this.input.x = x;
    this.input.z = z;
  }
  /** 동전을 넣고 움직일 수 있게 */
  begin() {
    if (this.phase !== "idle") return false;
    this.phase = "moving";
    this.turnT = 0;
    this.log = [];
    this.phaseT = 0;
    this.turnPrizes = [];
    return true;
  }
  drop() {
    if (this.phase !== "moving") return false;
    this.phase = "descending";
    this.phaseT = 0;
    this.wantOpen = true;
    this.slack = 0;
    this.emit("drop");
    this.note("내리기");
    return true;
  }

  /** 디버그용 이번 판 기록 (왜 잡혔고 왜 놓쳤는지) */
  note(msg) {
    this.log.push(`${this.turnT.toFixed(1)}초 ${msg}`);
    if (this.log.length > 40) this.log.shift();
  }
  nameOf(id) {
    const d = this.dolls.find((q) => q.id === id);
    return d ? d.def.ko : "인형";
  }

  /** (x, z) 둘레 rad 안에서 가장 높은 곳: 바닥이면 0 */
  surfaceBelow(x, z, rad = 0) {
    let y = 0;
    let id = null;
    for (const d of this.dolls) {
      for (const s of d.sw || []) {
        const dxz = Math.max(0, Math.hypot(s[0] - x, s[2] - z) - rad);
        if (dxz >= s[3]) continue;
        const top = s[1] + Math.sqrt(s[3] * s[3] - dxz * dxz);
        if (top > y) {
          y = top;
          id = d.id;
        }
      }
    }
    return { y, id };
  }

  /* ---------- 한 걸음 ---------- */
  step(dt = STEP, quiet = false) {
    this.t += dt;
    this.phaseT += dt;
    this.turnT += dt;
    this.updatePhase(dt);
    this.moveCarriage(dt);
    // 바깥 힘
    for (const d of this.dolls) {
      if (d.sleep) continue;
      d.vy -= G * dt;
      const k = Math.exp(-0.35 * dt);
      d.vx *= k;
      d.vy *= k;
      d.vz *= k;
      d.w *= Math.exp(-2.4 * dt);
    }
    this.hvy -= G * dt;
    // 흔들림 줄이기 (안정성): 수레에 대한 가로 속도를 줄인다
    const kd = 1 - Math.exp(-this.stable * dt);
    this.hvx -= (this.hvx - this.cvx) * kd;
    this.hvz -= (this.hvz - this.cvz) * kd;
    // 발 모터: 힘(토크)에 한계가 있다
    // 배출구 위에서는 유리에 닿지 않게 조금만 벌린다
    let target = this.wantOpen ? (this.phase === "releasing" ? 38 * D2R : PRONG.open) : PRONG.closed;
    // 놓았는데 인형이 발에 걸려 있으면 발을 끝까지 벌린다 (스프링 힘이라 인형 무게에 눌리면 덜 벌어진다)
    if (this.phase === "releasing" && this.stuck && this.phaseT > 1.5) target = PRONG.wide;
    // 닫는 힘은 집게 힘(업그레이드), 여는 힘은 늘 같은 스프링 힘 (실제 기계: 솔레노이드로 닫고 스프링으로 벌어짐)
    const lim = ((TAU * this.power) / PRONG.I) * dt;
    const limOpen = ((TAU * 1.6) / PRONG.I) * dt;
    for (const p of this.prongs) {
      const want = clamp((target - p.a) * 16, -2.4, 2.4);
      const l = target > p.a ? limOpen : lim;
      p.av += clamp(want - p.av, -l, l);
    }
    const cs = this.contacts();
    if (this.wake(cs)) for (const c of cs) c.kN = this.invMass(c, c.n);
    for (const c of cs) {
      if (!c.soft) continue;
      const v = this.relVel(c);
      const vn = v[0] * c.n[0] + v[1] * c.n[1] + v[2] * c.n[2];
      const f = PLUSH_K * Math.min(c.depth, c.softD) - PLUSH_C * vn;
      c.pen = Math.max(0, f) * dt;
      if (c.pen > 0) this.apply(c, [c.n[0] * c.pen, c.n[1] * c.pen, c.n[2] * c.pen]);
    }
    // 반복해서 충격량을 맞춘다
    for (let it = 0; it < ITER; it += 1) {
      this.solveRope(dt, it === 0);
      for (const c of cs) this.solve(c, dt);
    }
    this.prongF[0] = this.prongF[1] = this.prongF[2] = 0;
    for (const c of cs) if (c.A && c.cl && c.cl.pi >= 0) this.prongF[c.cl.pi] += (c.jn + (c.pen || 0)) / dt;
    this.ropeT = this.ropeJ / dt;
    // 위치 옮기기
    for (const d of this.dolls) {
      if (d.sleep) continue;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.a += d.w * dt;
    }
    this.hx += this.hvx * dt;
    this.hy += this.hvy * dt;
    this.hz += this.hvz * dt;
    for (const p of this.prongs) {
      p.a += p.av * dt;
      if (p.a < PRONG.min) {
        p.a = PRONG.min;
        if (p.av < 0) p.av = 0;
      } else if (p.a > PRONG.wide + 0.02) {
        p.a = PRONG.wide + 0.02;
        if (p.av > 0) p.av = 0;
      }
    }
    // 케이블이 늘어나지 않게 위치도 맞춘다
    const dx = this.hx - this.cx;
    const dy = this.hy - RAIL_Y;
    const dz = this.hz - this.cz;
    const dist = Math.hypot(dx, dy, dz);
    this.slackNow = this.L - dist;
    if (dist > this.L + 0.5) {
      const k = (this.L + 0.5) / dist;
      this.hx = this.cx + dx * k;
      this.hy = RAIL_Y + dy * k;
      this.hz = this.cz + dz * k;
    }
    this.afterStep(cs, quiet);
  }

  go(phase) {
    this.phase = phase;
    this.phaseT = 0;
  }

  /** 발끝과 그 아래 가장 높은 곳 사이 거리 (하강 끝 감속용 센서) */
  tipGap() {
    if (!this.pp) return 99;
    let tip = Infinity;
    for (const p of this.pp) tip = Math.min(tip, p[2][1]);
    return tip - this.surfaceBelow(this.hx, this.hz, 5).y;
  }

  updatePhase(dt) {
    const sp = this.speed;
    let want = 0; // 케이블 모터가 가려는 속도 (+ 풀기, - 감기)
    switch (this.phase) {
      case "descending": {
        // 모터가 천천히 돌기 시작하고, 아래가 가까우면 늦춘다. 받쳐져 케이블이 느슨해지면 멈춘다
        const gap = this.tipGap();
        want = 30 * sp * Math.min(1, 0.3 + this.phaseT * 2.8) * (gap < 8 ? 0.4 + (0.6 * Math.max(0, gap)) / 8 : 1);
        if (this.slackNow > 1.2) this.slack += dt;
        else this.slack = Math.max(0, this.slack - dt * 0.5);
        if (this.L >= L_MAX || this.slack > 0.1) {
          const power = Math.min(1, this.Lrate / 30);
          this.L = Math.min(this.L, Math.hypot(this.hx - this.cx, this.hy - RAIL_Y, this.hz - this.cz) + 0.3);
          this.Lrate = 0;
          want = 0;
          this.go("contact");
          const under = this.surfaceBelow(this.hx, this.hz, 4);
          this.emit("contact", { power, id: under.id });
          this.note(`접촉 — 아래: ${under.id ? this.nameOf(under.id) : this.L >= L_MAX ? "바닥" : "빈 곳"}`);
        }
        break;
      }
      case "contact":
        // 닿은 뒤 잠깐 멈췄다가 닫기 시작
        if (this.phaseT > 0.15) {
          this.go("closing");
          this.wantOpen = false;
          this.stall = 0;
          this.emit("clack");
        }
        break;
      case "closing": {
        // 발이 다 닫히거나, 인형에 막혀 더 못 닫히면 끝
        const busy = this.prongs.some((p) => Math.abs(p.av) > 0.15);
        this.stall = busy ? 0 : this.stall + dt;
        if ((this.stall > 0.12 && this.phaseT > 0.25) || this.phaseT > 1.2) {
          const touched = this.dolls.filter((d) => d.prongMask);
          for (const d of touched) this.note(`닫힘: ${d.def.ko} ← 발 ${bits(d.prongMask)}개 (${[0, 1, 2].filter((i) => d.prongMask & (1 << i)).map((i) => i + 1).join(",")}번)`);
          if (!touched.length) this.note("닫힘: 발이 인형에 안 닿음 (빈 곳)");
          const grip = touched.find((d) => bits(d.prongMask) >= 2);
          if (grip) {
            this.go("gripping");
            this.emit("squeeze", { id: grip.id, kind: grip.kind, n: bits(grip.prongMask) });
            this.note(`잡기: ${grip.def.ko}${eul(grip.def.ko)} 발 ${bits(grip.prongMask)}개로 누름`);
          } else {
            this.go("lifting");
            this.emit("lift");
          }
        }
        break;
      }
      case "gripping":
        // 발이 인형을 누르는 힘이 자리 잡을 때까지 (말랑한 인형이 눌린다)
        if (this.phaseT > 0.35) {
          this.go("lifting");
          this.emit("lift");
        }
        break;
      case "lifting":
        want = -24 * sp;
        if (this.L <= L_TOP) {
          this.L = L_TOP;
          if (this.phaseT > 0.3) this.go("carrying");
        }
        break;
      case "carrying": {
        const swing = Math.hypot(this.hvx, this.hvz);
        const there = Math.hypot(this.cx - HOME.x, this.cz - HOME.z) < 0.4 && Math.hypot(this.cvx, this.cvz) < 2;
        if (there) this.wait = (this.wait || 0) + dt;
        else this.wait = 0;
        if (there && (swing < 5 || this.wait > 1.4)) {
          this.wait = 0;
          this.go("releasing");
          this.wantOpen = true;
          this.emit("release");
          const held = this.dolls.filter((d) => d.held);
          this.note(held.length ? `배출구 위: ${held.map((d) => d.def.ko).join(", ")} 놓기` : "배출구 위: 빈 집게");
        }
        break;
      }
      case "releasing": {
        // 발에 걸쳐 안 떨어지는 인형(누운 채 발 하나에 얹힘 등)은 수레를 흔들어 털어 낸다
        const stuck = this.dolls.some((d) => d.prongMask && d.supportN === 0 && d.y > 30);
        this.stuck = stuck; // 오래 걸려 있으면 발을 끝까지 벌린다 (앞 유리에 살짝 밀려도)
        if (stuck && this.phaseT > 0.8) {
          // 앞 유리와 발 사이에 끼인 경우가 있어 수레를 조금 뒤로 빼면서 흔든다 (배출구 안쪽 범위)
          this.cvx = Math.sin(this.phaseT * 30) * 14;
          this.cvz = clamp((HOME.z + 6 - this.cz) * 4, -12, 12) + Math.cos(this.phaseT * 23) * 4;
        }
        if (this.phaseT > (stuck ? 4.5 : 1.4)) {
          if (stuck) this.note("놓기: 인형이 발에 걸려 안 떨어짐");
          this.wantOpen = false;
          this.go("returning");
        }
        break;
      }
      case "returning":
        if (this.phaseT > 0.9) {
          this.note(this.turnPrizes.length ? `결과: ${this.turnPrizes.map((k) => dollById(k).ko).join(", ")} 획득` : "결과: 실패");
          this.go("idle");
          this.emit("turnEnd", { prizes: this.turnPrizes.slice() });
        }
        break;
      default:
    }
    // 케이블 모터: 속도가 순간이동하지 않고 가속 한계 안에서 바뀐다
    if (this.phase !== "contact") this.Lrate += clamp(want - this.Lrate, -120 * dt, 120 * dt);
    this.L = clamp(this.L + this.Lrate * dt, L_TOP, L_MAX);
  }

  moveCarriage(dt) {
    let tx = 0;
    let tz = 0;
    const top = 26 * this.speed;
    if (this.phase === "moving") {
      tx = this.input.x * top;
      tz = this.input.z * top;
    } else if (this.phase === "carrying") {
      const dx = HOME.x - this.cx;
      const dz = HOME.z - this.cz;
      const d = Math.hypot(dx, dz);
      const v = Math.min(top * 0.9, d * 3);
      if (d > 0.01) {
        tx = (dx / d) * v;
        tz = (dz / d) * v;
      }
    }
    const acc = 150 * dt;
    this.cvx += clamp(tx - this.cvx, -acc, acc);
    this.cvz += clamp(tz - this.cvz, -acc, acc);
    this.cx += this.cvx * dt;
    this.cz += this.cvz * dt;
    if (this.cx < -44 || this.cx > 44) {
      this.cx = clamp(this.cx, -44, 44);
      this.cvx = 0;
    }
    if (this.cz < 5 || this.cz > 55) {
      this.cz = clamp(this.cz, 5, 55);
      this.cvz = 0;
    }
  }

  /* ---------- 접촉 찾기 ---------- */
  contacts() {
    const cs = [];
    const ds = this.dolls;
    this.touches.length = 0;
    for (const d of ds) {
      d.prongN = 0;
      d.lastMask = d.prongMask;
      d.prongMask = 0;
      d.supportN = 0;
      const c = Math.cos(d.a);
      const n = Math.sin(d.a);
      d.sw = d.sph.map((s) => [d.x + s.ox * c - s.oy * n, d.y + s.ox * n + s.oy * c, d.z + s.oz, s.r, s.f]);
    }
    // 인형 - 고정물
    for (const d of ds) {
      for (const b of STATIC) {
        if (d.x + d.bound < b.x0 || d.x - d.bound > b.x1 || d.y + d.bound < b.y0 || d.y - d.bound > b.y1 || d.z + d.bound < b.z0 || d.z - d.bound > b.z1) continue;
        for (const s of d.sw) this.sphereBox(cs, d, s, b);
      }
    }
    // 인형 - 인형
    for (let i = 0; i < ds.length; i += 1) {
      const A = ds[i];
      for (let j = i + 1; j < ds.length; j += 1) {
        const B = ds[j];
        const lim = A.bound + B.bound;
        if (Math.abs(A.x - B.x) > lim || Math.abs(A.y - B.y) > lim || Math.abs(A.z - B.z) > lim) continue;
        for (const sa of A.sw) {
          for (const sb of B.sw) {
            const dx = sa[0] - sb[0];
            const dy = sa[1] - sb[1];
            const dz = sa[2] - sb[2];
            const rr = sa[3] + sb[3];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= rr * rr) continue;
            const dist = Math.sqrt(d2) || 1e-6;
            const n = [dx / dist, dy / dist, dz / dist];
            const p = [sa[0] - n[0] * sa[3], sa[1] - n[1] * sa[3], sa[2] - n[2] * sa[3]];
            cs.push(this.mk(A, B, null, p, n, rr - dist, 0.55));
            if (n[1] > 0.4) A.supportN += 1;
            if (n[1] < -0.4) B.supportN += 1;
          }
        }
      }
    }
    // 집게 (발 · 머리) - 인형 · 고정물
    this.pp = this.prongs.map((p) => this.prongPts(p));
    for (const d of ds) {
      if (Math.abs(d.x - this.hx) > d.bound + 40 || Math.abs(d.z - this.hz) > d.bound + 40 || d.y - d.bound > this.hy + 6) continue;
      for (const s of d.sw) {
        // 머리 (둥근 통)
        {
          const dx = s[0] - this.hx;
          const dy = s[1] - this.hy;
          const dz = s[2] - this.hz;
          const rr = s[3] + HUB_R;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < rr * rr) {
            const dist = Math.sqrt(d2) || 1e-6;
            const n = [dx / dist, dy / dist, dz / dist];
            const p = [s[0] - n[0] * s[3], s[1] - n[1] * s[3], s[2] - n[2] * s[3]];
            cs.push(this.mk(d, null, { pi: -1 }, p, n, rr - dist, 0.4));
          }
        }
        this.prongs.forEach((pr, pi) => {
          const pts = this.pp[pi];
          for (let k = 0; k < 2; k += 1) {
            const a = pts[k];
            const b = pts[k + 1];
            const q = closestOnSeg(s, a, b);
            const dx = s[0] - q[0];
            const dy = s[1] - q[1];
            const dz = s[2] - q[2];
            const rr = s[3] + PRONG.r;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= rr * rr) continue;
            const dist = Math.sqrt(d2) || 1e-6;
            const n = [dx / dist, dy / dist, dz / dist];
            const p = [q[0] + n[0] * PRONG.r, q[1] + n[1] * PRONG.r, q[2] + n[2] * PRONG.r];
            // 발과 인형: 인형마다 · 부위마다 미끄러운 정도와 말랑한 정도가 다르다
            const c = this.mk(d, null, { pi }, p, n, rr - dist, 0.72 * (d.def.fric || 1) * s[4]);
            c.soft = true;
            c.softD = d.def.soft || SOFT;
            cs.push(c);
            d.prongN += 1;
            d.prongMask |= 1 << pi;
            this.touches.push({ pi, id: d.id, p, n, depth: rr - dist });
          }
        });
      }
    }
    // 집게 - 고정물 (바닥 · 벽 · 유리): 발 위의 몇 점과 머리
    const probes = [[this.hx, this.hy, this.hz, HUB_R, -1]];
    this.pp.forEach((pts, pi) => {
      for (const k of [0.5, 1]) probes.push([lerp(pts[0][0], pts[1][0], k), lerp(pts[0][1], pts[1][1], k), lerp(pts[0][2], pts[1][2], k), PRONG.r, pi]);
      for (const k of [0.5, 1]) probes.push([lerp(pts[1][0], pts[2][0], k), lerp(pts[1][1], pts[2][1], k), lerp(pts[1][2], pts[2][2], k), PRONG.r, pi]);
    });
    for (const s of probes) {
      for (const b of STATIC) {
        const q = [clamp(s[0], b.x0, b.x1), clamp(s[1], b.y0, b.y1), clamp(s[2], b.z0, b.z1)];
        const dx = s[0] - q[0];
        const dy = s[1] - q[1];
        const dz = s[2] - q[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= s[3] * s[3] || d2 < 1e-9) continue;
        const dist = Math.sqrt(d2);
        const n = [dx / dist, dy / dist, dz / dist]; // 고정물에서 집게 쪽: 집게를 밀어낸다
        cs.push(this.mk(null, null, { pi: s[4], static: true }, q, n, s[3] - dist, 0.12)); // 쇠 발끝은 바닥을 쓸며 접힌다
      }
    }
    return cs;
  }

  sphereBox(cs, d, s, b) {
    const q = [clamp(s[0], b.x0, b.x1), clamp(s[1], b.y0, b.y1), clamp(s[2], b.z0, b.z1)];
    let dx = s[0] - q[0];
    let dy = s[1] - q[1];
    let dz = s[2] - q[2];
    let d2 = dx * dx + dy * dy + dz * dz;
    let n;
    let depth;
    if (d2 > 1e-9) {
      if (d2 >= s[3] * s[3]) return;
      const dist = Math.sqrt(d2);
      n = [dx / dist, dy / dist, dz / dist];
      depth = s[3] - dist;
    } else {
      // 중심이 상자 안: 가장 얕은 쪽으로 밀어낸다
      const pen = [[s[0] - b.x0, [-1, 0, 0]], [b.x1 - s[0], [1, 0, 0]], [s[1] - b.y0, [0, -1, 0]], [b.y1 - s[1], [0, 1, 0]], [s[2] - b.z0, [0, 0, -1]], [b.z1 - s[2], [0, 0, 1]]];
      pen.sort((u, v) => u[0] - v[0]);
      n = pen[0][1];
      depth = pen[0][0] + s[3];
    }
    const p = [s[0] - n[0] * s[3], s[1] - n[1] * s[3], s[2] - n[2] * s[3]];
    cs.push(this.mk(d, null, null, p, n, depth, b.mu));
    if (n[1] > 0.4) d.supportN += 1;
  }

  /** A: 인형(또는 null=고정), B: 인형 또는 null, cl: 집게 부위 (B 자리) */
  mk(A, B, cl, p, n, depth, mu) {
    // 튕김: 인형마다 다르고, 둘이 부딪히면 평균
    const ea = A ? (A.def.rest ?? 0.18) : 0.18;
    const c = { A, B, cl, p, n, depth, mu, e: B ? (ea + (B.def.rest ?? 0.18)) / 2 : ea, jn: 0, jt: [0, 0, 0], kN: 0 };
    c.kN = this.invMass(c, n);
    return c;
  }

  /** 접촉점에서 두 물체가 n 방향으로 얼마나 쉽게 움직이는지 (질량의 역수 합) */
  invMass(c, n) {
    let k = 0;
    const p = c.p;
    if (c.A) k += dollInv(c.A, p, n);
    if (c.B) k += dollInv(c.B, p, n);
    if (c.cl) k += this.clawInv(c.cl, p, n);
    return k;
  }

  clawInv(cl, p, n) {
    let k = 1 / HEAD_M;
    if (cl.pi >= 0) {
      const pr = this.prongs[cl.pi];
      const h = this.hinge(pr);
      const ax = [-pr.rz, 0, pr.rx];
      const r = [p[0] - h[0], p[1] - h[1], p[2] - h[2]];
      const t = dot(cross(r, n), ax);
      k += (t * t) / PRONG.I;
    }
    return k;
  }

  clawVel(cl, p) {
    const v = [this.hvx, this.hvy, this.hvz];
    if (cl.pi >= 0) {
      const pr = this.prongs[cl.pi];
      const h = this.hinge(pr);
      const ax = [-pr.rz, 0, pr.rx];
      const w = cross(ax, [p[0] - h[0], p[1] - h[1], p[2] - h[2]]);
      v[0] += w[0] * pr.av;
      v[1] += w[1] * pr.av;
      v[2] += w[2] * pr.av;
    }
    return v;
  }

  /** 상대 속도: (A 또는 집게-고정) - (B 또는 집게) */
  relVel(c) {
    const p = c.p;
    let va = c.A ? dollVel(c.A, p) : c.cl && c.cl.static ? this.clawVel(c.cl, p) : [0, 0, 0];
    let vb = c.B ? dollVel(c.B, p) : c.cl && !c.cl.static ? this.clawVel(c.cl, p) : [0, 0, 0];
    return [va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]];
  }

  /** 충격량 J 를 A 에 +, B 쪽에 - 로 준다 */
  apply(c, J) {
    const p = c.p;
    if (c.A) dollImp(c.A, p, J, 1);
    if (c.B) dollImp(c.B, p, J, -1);
    if (c.cl) this.clawImp(c.cl, p, J, c.cl.static ? 1 : -1);
  }

  clawImp(cl, p, J, sgn) {
    this.hvx += (J[0] * sgn) / HEAD_M;
    this.hvy += (J[1] * sgn) / HEAD_M;
    this.hvz += (J[2] * sgn) / HEAD_M;
    if (cl.pi >= 0) {
      const pr = this.prongs[cl.pi];
      const h = this.hinge(pr);
      const ax = [-pr.rz, 0, pr.rx];
      const t = dot(cross([p[0] - h[0], p[1] - h[1], p[2] - h[2]], J), ax);
      pr.av += (t * sgn) / PRONG.I;
    }
  }

  solve(c, dt) {
    if (c.kN <= 0) return;
    const n = c.n;
    let v = this.relVel(c);
    const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    if (c.vn0 === undefined) c.vn0 = vn;
    // 말랑한 접촉은 SOFT 보다 깊이 파고들 때만 단단하게 막는다
    if (!c.soft || c.depth > c.softD) {
      const deep = c.soft ? c.depth - c.softD : c.depth - 0.04;
      // 파고든 만큼 밀어내는 속도 (너무 세게 튀지 않게 상한)
      let target = Math.min(40, (0.25 / dt) * Math.max(0, deep));
      if (!c.soft && c.vn0 < -60) target = Math.max(target, -c.vn0 * c.e);
      let jn = (target - vn) / c.kN;
      const old = c.jn;
      c.jn = Math.max(0, old + jn);
      jn = c.jn - old;
      if (jn !== 0) this.apply(c, [n[0] * jn, n[1] * jn, n[2] * jn]);
    }
    // 마찰
    v = this.relVel(c);
    const vn2 = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    const vt = [v[0] - n[0] * vn2, v[1] - n[1] * vn2, v[2] - n[2] * vn2];
    const sp = Math.hypot(vt[0], vt[1], vt[2]);
    if (sp < 1e-6) return;
    const t = [vt[0] / sp, vt[1] / sp, vt[2] / sp];
    const kT = this.invMass(c, t);
    if (kT <= 0) return;
    const jt = -sp / kT;
    const acc = [c.jt[0] + t[0] * jt, c.jt[1] + t[1] * jt, c.jt[2] + t[2] * jt];
    const max = c.mu * (c.jn + (c.pen || 0));
    const mag = Math.hypot(acc[0], acc[1], acc[2]);
    if (mag > max) {
      const k = max / mag;
      acc[0] *= k;
      acc[1] *= k;
      acc[2] *= k;
    }
    const dJ = [acc[0] - c.jt[0], acc[1] - c.jt[1], acc[2] - c.jt[2]];
    c.jt = acc;
    this.apply(c, dJ);
  }

  /** 케이블: 당기기만 한다 (밀지 못함). 감는 속도만큼 머리를 끌어올린다 */
  solveRope(dt, first) {
    const dx = this.hx - this.cx;
    const dy = this.hy - RAIL_Y;
    const dz = this.hz - this.cz;
    const dist = Math.hypot(dx, dy, dz) || 1e-6;
    if (first) this.ropeJ = 0;
    const dir = [dx / dist, dy / dist, dz / dist];
    const vr = (this.hvx - this.cvx) * dir[0] + this.hvy * dir[1] + (this.hvz - this.cvz) * dir[2];
    // 다음 순간 케이블 길이를 넘지 않게 (느슨하면 그만큼은 내려가도 됨)
    const gap = this.L - dist;
    const target = gap >= 0 ? gap / dt : Math.max(-30, (gap * 0.3) / dt);
    if (vr <= target) return;
    const old = this.ropeJ;
    this.ropeJ = Math.max(0, old + (vr - target) * HEAD_M);
    const j = (this.ropeJ - old) / HEAD_M;
    this.hvx -= dir[0] * j;
    this.hvy -= dir[1] * j;
    this.hvz -= dir[2] * j;
  }

  /** 잠든 인형 깨우기: 집게가 닿거나, 움직이는 인형이 밀거나, 받침이 없어졌을 때 */
  wake(cs) {
    let woke = false;
    const up = (d) => {
      if (d && d.sleep) {
        d.sleep = false;
        d.rest = 0;
        woke = true;
      }
    };
    for (const c of cs) {
      if (!c.A) continue;
      if (c.cl) up(c.A);
      else if (c.B && c.A.sleep !== c.B.sleep) {
        const mover = c.A.sleep ? c.B : c.A;
        if (c.depth > 0.3 || mover.prongN > 0 || Math.hypot(mover.vx, mover.vy, mover.vz) > WAKE_V || Math.abs(mover.w) > 0.5) up(c.A.sleep ? c.A : c.B);
      }
    }
    for (const d of this.dolls) if (d.sleep && d.supportN === 0) up(d);
    return woke;
  }

  afterStep(cs, quiet) {
    // 부딪힘 세기 (그림에서 찌그러짐)
    for (const c of cs) {
      if (c.vn0 !== undefined && c.vn0 < -90 && c.A) {
        c.A.impact = Math.max(c.A.impact, Math.min(1, -c.vn0 / 400));
        if (!quiet && -c.vn0 > 140) this.emit("land", { id: c.A.id, power: Math.min(1, -c.vn0 / 500) });
      }
    }
    for (const d of this.dolls) {
      if (!d.sleep) {
        const slow = d.vx * d.vx + d.vy * d.vy + d.vz * d.vz < SLEEP_V * SLEEP_V && Math.abs(d.w) < SLEEP_W && d.prongN === 0 && d.supportN > 0;
        d.rest = slow ? d.rest + STEP : 0;
        if (d.rest > SLEEP_T) {
          d.sleep = true;
          d.vx = d.vy = d.vz = d.w = 0;
        }
      }
      d.impact *= 0.9;
      const was = d.held;
      // 집게 발 두 개 이상에 닿고 아무것에도 받쳐지지 않으면 "잡힌" 상태
      // 잡힘: 서로 다른 발 두 개 이상이 누르고, 아무것에도 받쳐지지 않을 때 (접촉 개수가 아니라 발 개수)
      d.held = bits(d.prongMask) >= 2 && d.supportN === 0 && d.y - d.bound > 0.5;
      const grabby = this.phase === "lifting" || this.phase === "gripping" || this.phase === "closing";
      if (d.held && !was && grabby) {
        if (!quiet) this.emit("grab", { id: d.id, kind: d.kind });
        this.note(`${d.def.ko} 들림 (무게 ${Math.round(d.m * 10)}g · 발 힘 ${(this.prongF.reduce((a, b) => a + b, 0) * 1e-4).toFixed(1)}N)`);
      }
      if (was && !d.held && d.vy < -40 && this.phase !== "releasing" && this.phase !== "returning") {
        if (!quiet) this.emit("slip", { id: d.id, kind: d.kind });
        this.note(`${d.def.ko} 미끄러짐 (${PHASE_KO[this.phase] || this.phase} 중 · 발 ${bits(d.prongMask)}개만 닿음)`);
      }
      // 발이 새로 닿은 순간 (닫힐 때 '꾹' 소리)
      const fresh = d.prongMask & ~d.lastMask;
      if (fresh && !quiet && (this.phase === "closing" || this.phase === "contact" || this.phase === "descending")) this.emit("touch", { id: d.id, n: bits(fresh) });
    }
    // 배출구로 떨어진 인형
    for (let i = this.dolls.length - 1; i >= 0; i -= 1) {
      const d = this.dolls[i];
      if (d.y < -14 && d.x < CHUTE.x1 && d.z < CHUTE.z1) {
        this.dolls.splice(i, 1);
        this.turnPrizes.push(d.kind);
        this.note(`${d.def.ko} 배출구로 쏙`);
        if (!quiet) this.emit("prize", { id: d.id, kind: d.kind });
      } else if (d.y < -60) this.dolls.splice(i, 1); // 안전장치 (나오면 안 됨)
    }
  }

  /** 점검 · 화면용 요약 */
  state() {
    return { phase: this.phase, cx: this.cx, cz: this.cz, hx: this.hx, hy: this.hy, hz: this.hz, L: this.L, prongs: this.prongs.map((p) => p.a), force: this.prongF.slice(), n: this.dolls.length };
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function closestOnSeg(s, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const t = clamp(((s[0] - a[0]) * ab[0] + (s[1] - a[1]) * ab[1] + (s[2] - a[2]) * ab[2]) / (dot(ab, ab) || 1), 0, 1);
  return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
}
function dollVel(d, p) {
  if (d.sleep) return [0, 0, 0];
  const rx = p[0] - d.x;
  const ry = p[1] - d.y;
  return [d.vx - d.w * ry, d.vy + d.w * rx, d.vz];
}
function dollInv(d, p, n) {
  if (d.sleep) return 0; // 잠든 인형은 움직이지 않는 받침처럼
  const c = (p[0] - d.x) * n[1] - (p[1] - d.y) * n[0];
  return 1 / d.m + (c * c) / d.I;
}
function dollImp(d, p, J, s) {
  if (d.sleep) return;
  d.vx += (J[0] * s) / d.m;
  d.vy += (J[1] * s) / d.m;
  d.vz += (J[2] * s) / d.m;
  d.w += (((p[0] - d.x) * J[1] - (p[1] - d.y) * J[0]) * s) / d.I;
}
export { DOLLS };
