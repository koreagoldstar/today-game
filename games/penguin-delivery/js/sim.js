/*
 * 펭귄 택배 대작전 — 물리와 규칙 (화면 없음, 고정 1/120초)
 *  펭귄 · 택배 · 장애물의 움직임과 판정을 모두 여기서 계산한다.
 *  화면은 events 와 상태 값만 읽으므로 봇이 이 코드 그대로 끝까지 플레이할 수 있다.
 */
import { DS, clamp, lerp, TAU, rng } from "./course.js";

export const GRAV = 22;
export const FIXED = 1 / 120;
const PR = 0.42; // 펭귄 반지름

/** 택배 종류: 무게 · 흔들림 · 바람 · 충격 */
export const BOX = {
  normal: { name: "일반 택배", size: 0.74, speed: 1, jump: 1, wobble: 1, rest: 0.42, dmg: 1, wind: 1, roll: 1, gravity: 1 },
  heavy: { name: "무거운 택배", size: 0.84, speed: 0.8, jump: 0.84, wobble: 0.72, rest: 0.14, dmg: 0.6, wind: 0.2, roll: 1.25, gravity: 1.15 },
  light: { name: "가벼운 택배", size: 0.66, speed: 1.04, jump: 1.04, wobble: 1.3, rest: 0.62, dmg: 0.6, wind: 3, roll: 0.75, gravity: 0.62 },
  fragile: { name: "깨지기 쉬운 택배", size: 0.68, speed: 0.96, jump: 0.96, wobble: 1.12, rest: 0.3, dmg: 3, wind: 1, roll: 1, gravity: 1 },
  express: { name: "특급 택배", size: 0.7, speed: 1, jump: 1, wobble: 1, rest: 0.42, dmg: 1, wind: 1, roll: 1, gravity: 1 },
  big: { name: "대형 택배", size: 1.28, speed: 0.87, jump: 0.9, wobble: 1.2, rest: 0.3, dmg: 0.8, wind: 1.6, roll: 0.85, gravity: 1 },
};

/** 바닥: 가속 · 멈춤 · 경사 영향 · 과속 끌림 */
export const SURF = {
  snow: { accel: 34, brake: 30, slope: 0.42, drag: 5, speed: 1 },
  ice: { accel: 8, brake: 1.5, slope: 1, drag: 0.3, speed: 1.08 },
  deep: { accel: 22, brake: 44, slope: 0.15, drag: 20, speed: 0.6 },
};

const RUN = 5.9;

export class Sim {
  constructor(course, opts = {}) {
    this.c = course;
    this.rand = rng(opts.seed || 7);
    this.t = 0;
    this.clock = 0;
    this.acc = 0;
    this.scale = 1;
    this.slowT = 0;
    this.state = "intro";
    this.stateT = 0;
    this.introLen = opts.intro === undefined ? 1.25 : opts.intro;
    this.events = [];
    this.input = { x: 0, z: 0, jump: false, dash: false, grab: false };
    this.prev = { jump: false, dash: false, grab: false };
    const P = course.P;
    const s = P[Math.min(4, P.length - 1)];
    this.p = {
      x: s.x,
      y: s.y,
      z: s.z,
      vx: 0,
      vy: 0,
      vz: 0,
      pvx: 0,
      pvz: 0,
      face: s.h,
      mode: "run", // run · slide · stun · snow · splash · blown · dance · sad
      modeT: 0,
      grounded: true,
      surf: "snow",
      slope: 0,
      coyote: 0,
      buffer: 0,
      jumpT: 9,
      cut: true,
      airDash: true,
      spin: 0,
      slideCd: 0,
      inv: 0,
      idx: s.i,
      safe: { x: s.x, y: s.y, z: s.z, i: s.i },
      safeT: 0,
      pad: null,
      w: { x: 0, z: 0, vx: 0, vz: 0 },
      stack: [],
      boost: 0,
      magnet: 0,
      shield: 0,
      bubble: 0,
      slip: 0,
      lastFall: 0,
      landed: 0,
      wiggle: 0,
      hitDir: 0,
      airT: 0,
    };
    this.boxes = (course.packs || ["normal"]).map((kind, id) => ({
      id,
      kind,
      d: BOX[kind],
      state: "held",
      x: s.x,
      y: s.y + 1,
      z: s.z,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      rz: 0,
      rvx: 0,
      rvz: 0,
      hp: 100,
      lock: 0,
      lost: 0,
      face: 0,
      hopT: 0,
      airb: false,
      rescue: 0,
      from: null,
      to: null,
      splash: 0,
      overheat: 0,
    }));
    this.p.stack = this.boxes.slice();
    this.fish = 0;
    this.stars = 0;
    this.stats = { drops: 0, catches: 0, nice: 0, plops: 0, dunks: 0, snow: 0, thief: 0, hits: 0 };
    this.tip = null;
    this.limit = course.limit;
    this.par = course.par;
    this.result = null;
    this.fog = 0;
    this.windNow = { x: 0, z: 0, k: 0 };
    this.goalMsgT = 0;
  }
  emit(t, data = {}) {
    this.events.push({ t, ...data });
  }
  /** 화면 시간 → 고정 걸음 */
  update(dt) {
    if (this.slowT > 0) {
      this.slowT -= dt;
      this.scale = this.slowT > 0 ? this.slowK : 1;
    }
    this.acc += Math.min(dt, 0.05) * this.scale;
    let n = 0;
    while (this.acc >= FIXED && n < 12) {
      this.tick(FIXED);
      this.acc -= FIXED;
      n += 1;
    }
    if (n >= 12) this.acc = 0;
  }
  slow(k, t) {
    this.slowK = k;
    this.slowT = t;
    this.scale = k;
  }
  tick(dt) {
    this.t += dt;
    this.stateT += dt;
    if (this.state === "intro") {
      this.movePads(dt);
      if (this.stateT >= this.introLen) this.setState("play");
      return;
    }
    if (this.state === "play") {
      this.clock += dt;
      if (this.clock >= this.limit) {
        this.lose("time");
      }
    }
    this.movePads(dt);
    this.updateZones(dt);
    this.updatePlayer(dt);
    this.updateObjs(dt);
    for (const b of this.boxes) this.updateBox(b, dt);
    this.updateItems(dt);
    this.updateProgress(dt);
    this.prev.jump = this.input.jump;
    this.prev.dash = this.input.dash;
    this.prev.grab = this.input.grab;
  }
  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  /* ---------- 발판 ---------- */
  movePads(dt) {
    const P = this.p;
    for (const p of this.c.pads) {
      const px = p.x;
      const py = p.y;
      const pz = p.z;
      if (p.moved || p.ax || p.az) {
        if (p.orbit) {
          const a = (this.t / p.period) * TAU + p.phase;
          p.x = p.x0 + Math.cos(a) * p.orbit;
          p.z = p.z0 + Math.sin(a) * p.orbit;
        } else {
          const k = Math.sin((this.t / p.period) * TAU + p.phase);
          p.x = p.x0 + p.ax * k;
          p.z = p.z0 + p.az * k;
          if (p.ay) p.y = p.y0 + p.ay * k;
        }
      }
      if (p.bob) {
        // 위에 올라서면 살짝 가라앉음
        const on = P.pad === p ? 1 : 0;
        p.sink += ((on ? 0.16 : 0) - p.sink) * Math.min(1, dt * 5);
        p.y = p.y0 + Math.sin(this.t * 1.5 + p.phase * 3 + p.x0) * 0.05 - p.sink;
      }
      if (p.kind === "crumble" || p.kind === "plank") {
        if (p.state === 1) {
          p.t += dt;
          if (p.t >= p.delay) {
            p.state = 2;
            p.t = 0;
            p.solid = false;
            this.emit("crumble", { x: p.x, y: p.y, z: p.z, kind: p.kind });
          }
        } else if (p.state === 2) {
          p.t += dt;
          p.vy -= GRAV * dt;
          p.y += p.vy * dt;
          if (p.back && p.t >= p.back) {
            p.state = 0;
            p.t = 0;
            p.vy = 0;
            p.y = p.y0;
            p.solid = true;
            this.emit("padback", { x: p.x, y: p.y, z: p.z });
          }
        }
      }
      if (p.kind === "vanish") {
        const u = ((this.t + p.phase * p.period) / p.period) % 1;
        const was = p.solid;
        p.solid = u < p.duty;
        p.fade = p.solid ? clamp((p.duty - u) * p.period * 1.4, 0, 1) : clamp((u - p.duty - (1 - p.duty) + 0.14) * 8, 0, 0.8);
        p.warn = p.solid && (p.duty - u) * p.period < 0.75;
        if (was && !p.solid && P.pad === p) P.pad = null;
      }
      p.vx = (p.x - px) / dt;
      p.vz = (p.z - pz) / dt;
      p.vy = p.state === 2 ? p.vy : (p.y - py) / dt;
    }
  }

  /** 위아래 판정: 길과 발판 중 더 높은 곳 */
  ground(x, z, y, step = 0.6) {
    const c = this.c;
    const hit = c.ribbonAt(x, z, y, step);
    const pad = c.padAt(x, z, y, step);
    const g = this._g || (this._g = {});
    if (pad && (!hit || pad.y >= hit.y)) {
      g.y = pad.y;
      g.pad = pad;
      g.surf = pad.surf;
      g.slope = 0;
      g.dx = 0;
      g.dz = 0;
      g.s = null;
      g.lat = 0;
      return g;
    }
    if (!hit) return null;
    g.y = hit.y;
    g.pad = null;
    g.surf = c.surfOf(hit);
    g.slope = hit.s.slope;
    g.dx = hit.s.dx;
    g.dz = hit.s.dz;
    g.s = hit.s;
    g.lat = hit.lat;
    return g;
  }

  /* ---------- 펭귄 ---------- */
  load() {
    let sp = 1;
    let jp = 1;
    let wob = 1;
    for (const b of this.p.stack) {
      sp *= b.d.speed;
      jp *= b.d.jump;
      wob = Math.max(wob, b.d.wobble);
    }
    wob *= 1 + 0.28 * Math.max(0, this.p.stack.length - 1);
    return { sp, jp, wob };
  }
  updatePlayer(dt) {
    const p = this.p;
    const inp = this.input;
    const canCtl = this.state === "play" && !["stun", "snow", "splash", "blown", "dance", "sad"].includes(p.mode);
    if (p.mode === "splash") {
      p.modeT -= dt;
      if (p.modeT <= 0) this.respawn();
      return;
    }
    if (p.mode === "dance" || p.mode === "sad") {
      p.vx *= 1 - Math.min(1, dt * 8);
      p.vz *= 1 - Math.min(1, dt * 8);
    }
    p.pvx = p.vx;
    p.pvz = p.vz;
    if (p.inv > 0) p.inv -= dt;
    if (p.boost > 0) p.boost -= dt;
    if (p.magnet > 0) p.magnet -= dt;
    if (p.shield > 0) p.shield -= dt;
    if (p.bubble > 0) p.bubble -= dt;
    if (p.slideCd > 0) p.slideCd -= dt;
    p.jumpT += dt;
    const L = this.load();
    if (p.noCtl > 0) p.noCtl -= dt;
    let ix = canCtl && !(p.noCtl > 0) ? inp.x : 0;
    let iz = canCtl && !(p.noCtl > 0) ? inp.z : 0;
    const mag0 = Math.hypot(ix, iz);
    if (mag0 > 1) {
      ix /= mag0;
      iz /= mag0;
    }
    const mag = Math.min(1, mag0);
    // 입력 가장자리
    if (canCtl && inp.jump && !this.prev.jump) p.buffer = 0.14;
    if (p.buffer > 0) p.buffer -= dt;
    const dashPress = canCtl && inp.dash && !this.prev.dash;
    const grabPress = canCtl && inp.grab && !this.prev.grab;
    if (grabPress) this.tryGrab(2.3);

    // 상태 타이머
    if (p.mode === "stun" || p.mode === "blown") {
      p.modeT -= dt;
      if (p.modeT <= 0) p.mode = "run";
    }
    if (p.mode === "snow") {
      p.modeT -= dt * (1 + Math.min(2.5, p.wiggle));
      p.wiggle = Math.max(0, p.wiggle - dt * 2);
      if (Math.hypot(inp.x, inp.z) > 0.4 && this.state === "play") p.wiggle += dt * 3;
      if (inp.jump && !this.prev.jump) p.wiggle += 0.5;
      if (p.modeT <= 0) {
        p.mode = "run";
        p.inv = 1.2;
        this.emit("snowoff", { x: p.x, y: p.y, z: p.z });
      }
    }
    if (p.mode === "slide") {
      p.modeT -= dt;
      if (p.modeT <= 0) p.mode = "run";
    }

    const speed0 = Math.hypot(p.vx, p.vz);
    if (p.grounded) {
      const S = SURF[p.surf] || SURF.snow;
      const sliding = p.mode === "slide";
      const maxS = RUN * L.sp * S.speed * (p.boost > 0 ? 1.34 : 1) * (p.mode === "snow" ? 0.25 : 1);
      // 경사
      const sl = p.slope;
      if (sl && p.gdx !== undefined) {
        const f = (GRAV * sl) / Math.sqrt(1 + sl * sl);
        const k = sliding ? Math.max(S.slope, 0.85) : S.slope;
        p.vx -= p.gdx * f * k * dt;
        p.vz -= p.gdz * f * k * dt;
      }
      const speed = Math.hypot(p.vx, p.vz);
      if (sliding) {
        // 배로 미끄러지기: 방향은 조금만 바뀌고 잘 안 멈춤
        const steer = p.surf === "ice" ? 3.2 : 9;
        p.vx += ix * steer * dt;
        p.vz += iz * steer * dt;
        const br = p.surf === "ice" ? 0.5 : p.surf === "deep" ? 30 : 5.5;
        const sp = Math.hypot(p.vx, p.vz);
        if (sp > 0.01) {
          const ns = Math.max(0, sp - br * dt);
          p.vx *= ns / sp;
          p.vz *= ns / sp;
        }
      } else if (mag > 0.05) {
        const want = Math.max(maxS * mag, Math.min(speed, 26));
        const tx = (ix / mag) * want;
        const tz = (iz / mag) * want;
        let dvx = tx - p.vx;
        let dvz = tz - p.vz;
        const dv = Math.hypot(dvx, dvz);
        const rate = S.accel * (0.7 + 0.3 * L.sp) * (p.boost > 0 ? 1.3 : 1) * dt;
        if (dv > rate) {
          dvx *= rate / dv;
          dvz *= rate / dv;
        }
        p.vx += dvx;
        p.vz += dvz;
        // 달리는 힘보다 빠르면 끌려서 천천히 줄어듦
        const after = Math.hypot(p.vx, p.vz);
        if (after > maxS * mag) {
          const ns = Math.max(maxS * mag, after - S.drag * dt);
          p.vx *= ns / after;
          p.vz *= ns / after;
        }
      } else {
        const ns = Math.max(0, speed - S.brake * dt);
        if (speed > 0.001) {
          p.vx *= ns / speed;
          p.vz *= ns / speed;
        }
      }
      // 배 미끄럼 시작
      if (dashPress && p.slideCd <= 0 && p.mode === "run") {
        p.mode = "slide";
        p.modeT = 0.85;
        p.slideCd = 0.95;
        const sp = Math.max(0.01, Math.hypot(p.vx, p.vz));
        const dirx = mag > 0.1 ? ix / mag : sp > 0.5 ? p.vx / sp : Math.sin(p.face);
        const dirz = mag > 0.1 ? iz / mag : sp > 0.5 ? p.vz / sp : -Math.cos(p.face);
        const ns = Math.max(sp, Math.min(Math.max(sp, 6) + 4.4, 12.6));
        p.vx = lerp(p.vx, dirx * ns, 0.75);
        p.vz = lerp(p.vz, dirz * ns, 0.75);
        this.emit("slide", { x: p.x, y: p.y, z: p.z });
      }
      p.coyote = 0.2;
    } else {
      // 공중: 방향을 조금 바꿀 수 있음
      const air = 15;
      const maxA = Math.max(RUN * L.sp * (p.boost > 0 ? 1.3 : 1), speed0);
      if (mag > 0.05) {
        p.vx += ix * air * dt;
        p.vz += iz * air * dt;
        const sp = Math.hypot(p.vx, p.vz);
        if (sp > maxA) {
          p.vx *= maxA / sp;
          p.vz *= maxA / sp;
        }
      }
      if (p.coyote > 0) p.coyote -= dt;
      // 공중 대시 + 빙글
      if (dashPress && p.airDash && p.mode !== "stun") {
        p.airDash = false;
        const sp = Math.max(0.01, Math.hypot(p.vx, p.vz));
        const dirx = mag > 0.1 ? ix / mag : sp > 0.5 ? p.vx / sp : Math.sin(p.face);
        const dirz = mag > 0.1 ? iz / mag : sp > 0.5 ? p.vz / sp : -Math.cos(p.face);
        const ns = Math.max(sp, Math.min(Math.max(sp, 7) + 3, 12));
        p.vx = dirx * ns;
        p.vz = dirz * ns;
        p.vy = Math.max(p.vy, 3.6);
        p.spin = 1;
        this.emit("airdash", { x: p.x, y: p.y, z: p.z });
      }
      let gk = 1;
      if (Math.abs(p.vy) < 1.6) gk = 0.72;
      else if (p.vy < 0) gk = 1.12;
      p.vy -= GRAV * gk * dt;
      if (p.vy < -24) p.vy = -24;
      if (!inp.jump && p.vy > 0 && p.jumpT > 0.09 && !p.cut) {
        p.vy *= 0.62;
        p.cut = true;
      }
    }
    if (p.spin > 0) p.spin = Math.max(0, p.spin - dt * 1.9);

    // 바람 · 바람구멍
    this.applyAirForces(p, dt);

    // 점프
    if (p.buffer > 0 && p.coyote > 0 && canCtl && p.mode !== "snow") {
      const pad = p.pad;
      p.vy = 8.3 * L.jp;
      if (pad) {
        p.vx += pad.vx * 0.5;
        p.vz += pad.vz * 0.5;
      }
      p.grounded = false;
      p.pad = null;
      p.coyote = 0;
      p.buffer = 0;
      p.jumpT = 0;
      p.cut = false;
      p.airDash = true;
      p.airT = 0;
      if (p.mode === "slide") p.mode = "run";
      this.emit("jump", { x: p.x, y: p.y, z: p.z });
      this.wobbleKick(0, 0, 0.5);
    }

    // 경사에서도 너무 빨라지지 않게
    {
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 17) {
        p.vx *= 17 / sp;
        p.vz *= 17 / sp;
      }
    }
    // 이동
    const ox = p.x;
    const oz = p.z;
    const onPad = p.grounded && p.pad;
    let nx = p.x + p.vx * dt;
    let nz = p.z + p.vz * dt;
    if (onPad) {
      nx += p.pad.vx * dt;
      nz += p.pad.vz * dt;
    }
    let ny = p.grounded ? p.y : p.y + p.vy * dt;
    const stepUp = 0.42;
    let g = this.ground(nx, nz, Math.max(ny, p.y), stepUp);
    // 길 가장자리 둑
    const e = this.c.edge;
    if (e.ok && !g) {
      const s = e.s;
      const bank = e.lat < 0 ? s.bankL : s.bankR;
      if (bank && Math.abs(e.y - ny) < 3) {
        const sign = Math.sign(e.lat);
        const push = Math.abs(e.lat) - s.hw + 0.05;
        nx -= s.rx * sign * push;
        nz -= s.rz * sign * push;
        const vn = p.vx * s.rx * sign + p.vz * s.rz * sign;
        if (vn > 0) {
          const rest = p.surf === "ice" ? 0.45 : 0.15;
          p.vx -= s.rx * sign * vn * (1 + rest);
          p.vz -= s.rz * sign * vn * (1 + rest);
          if (vn > 4.6) this.bumped(vn * 0.55, -s.rx * sign, -s.rz * sign, "bank");
        }
        g = this.ground(nx, nz, Math.max(ny, p.y), stepUp);
      }
    }
    // 위로 높은 면이면 막힘
    if (!g && !p.grounded) {
      /* 공중 */
    }
    const wasG = p.grounded;
    if (g) {
      const top = g.y;
      if (wasG) {
        const drop = p.y - top;
        const stick = 0.14 + speed0 * dt * 1.4;
        if (drop <= stick) {
          this.onGround(p, g, top, nx, nz, dt);
        } else {
          this.takeoff(p, dt);
          p.x = nx;
          p.z = nz;
          p.y = ny;
          return this.afterMove(p, dt, ox, oz);
        }
      } else if (ny <= top && p.vy <= 0) {
        this.land(p, g, top, nx, nz);
      } else {
        p.x = nx;
        p.z = nz;
        p.y = ny;
      }
    } else {
      if (wasG) this.takeoff(p, dt);
      p.x = nx;
      p.z = nz;
      p.y = p.grounded ? p.y : ny;
    }
    this.afterMove(p, dt, ox, oz);
  }
  takeoff(p, dt) {
    // 경사에서 뜨면 경사 방향 속도가 위로 이어짐 (점프대)
    const along = p.gdx === undefined ? 0 : p.vx * p.gdx + p.vz * p.gdz;
    const up = p.lastSlope * along;
    p.vy = up > 0 ? up : Math.min(0, up * 0.5);
    p.grounded = false;
    p.pad = null;
    p.cut = true;
    p.airDash = true;
    p.airT = 0;
    void dt;
  }
  onGround(p, g, top, nx, nz, dt) {
    const pad = g.pad;
    if (pad && (pad.kind === "crumble" || pad.kind === "plank") && pad.state === 0) {
      pad.state = 1;
      pad.t = 0;
      this.emit("crack", { x: pad.x, y: pad.y, z: pad.z });
    }
    if (p.pad !== pad && pad) p.vx -= 0;
    p.pad = pad;
    p.x = nx;
    p.z = nz;
    p.y = top;
    p.vy = 0;
    p.surf = g.surf;
    p.slope = g.slope;
    p.lastSlope = g.slope;
    p.gdx = g.dx;
    p.gdz = g.dz;
    p.grounded = true;
    p.airT = 0;
    // 안전한 자리 기억
    if (!pad && g.s && Math.abs(g.lat) < g.s.hw - 0.5 && p.mode !== "stun") {
      p.safeT += dt;
      if (p.safeT > 0.35) {
        p.safeT = 0;
        const s = g.s;
        p.safe.x = s.x;
        p.safe.y = s.y;
        p.safe.z = s.z;
        p.safe.i = s.i;
        p.safe.onPad = false;
      }
    } else if (pad && !pad.moved && pad.kind !== "crumble" && pad.kind !== "plank" && pad.kind !== "vanish" && pad.kind !== "crate") {
      p.safe.x = pad.x;
      p.safe.y = pad.y0 === undefined ? pad.y : pad.y0;
      p.safe.z = pad.z;
      p.safe.i = p.idx;
      p.safe.onPad = true;
    }
  }
  land(p, g, top, nx, nz) {
    const impact = -p.vy;
    p.x = nx;
    p.z = nz;
    p.y = top;
    p.vy = 0;
    p.grounded = true;
    p.pad = g.pad;
    p.surf = g.surf;
    p.slope = g.slope;
    p.lastSlope = g.slope;
    p.gdx = g.dx;
    p.gdz = g.dz;
    p.landed = Math.min(1, impact / 15);
    if (g.pad && (g.pad.kind === "crumble" || g.pad.kind === "plank") && g.pad.state === 0) {
      g.pad.state = 1;
      g.pad.t = 0;
      this.emit("crack", { x: g.pad.x, y: g.pad.y, z: g.pad.z });
    }
    if (impact > 2) this.emit("land", { x: p.x, y: p.y, z: p.z, k: Math.min(1, impact / 15), surf: g.surf });
    this.wobbleKick((this.rand() - 0.5) * impact * 0.2, (this.rand() - 0.5) * impact * 0.2, 0);
    if (impact > 15.5 && p.mode !== "snow") {
      this.plop(0.55);
      if (p.stack.length) this.wobbleKick((this.rand() - 0.5) * 3, (this.rand() - 0.5) * 3, 0);
    }
    if (p.mode === "blown") p.mode = "run";
  }
  afterMove(p, dt, ox, oz) {
    // 몸 방향
    const sp = Math.hypot(p.vx, p.vz);
    const inp = this.input;
    const im = Math.hypot(inp.x, inp.z);
    let targetFace = p.face;
    if (p.mode === "slide" && sp > 0.6) targetFace = Math.atan2(p.vx, -p.vz);
    else if (im > 0.1 && p.mode === "run" && this.state === "play") targetFace = Math.atan2(inp.x, -inp.z);
    let da = targetFace - p.face;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    const rate = p.grounded ? (p.surf === "ice" ? 7 : 13) : 6;
    p.face += da * Math.min(1, dt * rate);
    // 미끄러짐 정도: 몸 방향과 실제 움직임의 차이
    if (sp > 1) {
      let ma = Math.atan2(p.vx, -p.vz) - p.face;
      while (ma > Math.PI) ma -= TAU;
      while (ma < -Math.PI) ma += TAU;
      p.slipA = ma;
      const want = p.grounded && p.surf === "ice" ? Math.min(1, Math.abs(Math.sin(ma)) * (sp / 6) + (im > 0.1 ? 0 : sp / 9)) : 0;
      p.slip += (want - p.slip) * Math.min(1, dt * 8);
    } else {
      p.slip += (0 - p.slip) * Math.min(1, dt * 8);
      p.slipA = 0;
    }
    if (!p.grounded) p.airT += dt;
    this.updateWobble(p, dt);
    // 충돌하는 발판 옆면 (나무 상자)
    for (const pad of this.c.pads) {
      if (!pad.side || !pad.solid) continue;
      if (p.y >= pad.y - 0.4 || p.y < pad.base - 1) continue;
      const dx = p.x - pad.x;
      const dz = p.z - pad.z;
      const R = pad.hw + PR;
      const d = Math.hypot(dx, dz);
      if (d < R && d > 0.0001) {
        const nx = dx / d;
        const nz = dz / d;
        p.x = pad.x + nx * R;
        p.z = pad.z + nz * R;
        const vn = (p.vx - pad.vx) * nx + (p.vz - pad.vz) * nz;
        if (vn < 0) {
          p.vx -= nx * vn * 1.25;
          p.vz -= nz * vn * 1.25;
          if (-vn > 3.5) this.bumped(-vn, nx, nz, "crate");
        }
      }
    }
    // 떨어짐
    const c = this.c;
    if (c.seaY !== null && c.seaY !== undefined) {
      if (p.y < c.seaY) this.fall(p, true);
    } else if (p.y < c.killY) {
      this.fall(p, false);
    } else if (!p.grounded && p.vy < 0) {
      // 얼음 구멍 · 눈꽃 마을 개울: 길보다 한참 낮아지면 바로 풍덩
      const near = c.P[clamp(p.idx, 0, c.P.length - 1)];
      if (p.y < near.y - 2.6) this.fall(p, this.c.world.key === "village" || this.overHole(p));
    }
    void ox;
    void oz;
  }
  overHole(p) {
    for (const q of this.c.holes) if (Math.hypot(p.x - q.x, p.z - q.z) < q.r + 1) return true;
    return false;
  }
  applyAirForces(p, dt) {
    const w = this.windNow;
    if (w.k > 0 && (p.mode !== "splash")) {
      const load = p.stack.reduce((a, b) => Math.max(a, b.d.wind), 0);
      const f = p.grounded ? (p.surf === "ice" ? 1 : 0.48) : 1.25;
      p.vx += w.x * w.k * f * dt;
      p.vz += w.z * w.k * f * dt;
      if (load > 0) {
        p.w.vx += w.x * w.k * 0.085 * load * dt;
        p.w.vz += w.z * w.k * 0.085 * load * dt;
      }
    }
    for (const o of this.c.objs) {
      if (o.type !== "vent" || !o.on) continue;
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      if (dx * dx + dz * dz < o.r * o.r && p.y < o.y + o.height) {
        if (p.grounded) {
          p.grounded = false;
          p.pad = null;
          p.cut = true;
          p.airDash = true;
        }
        const wantV = o.power;
        p.vy += (wantV - p.vy) * Math.min(1, dt * 7);
        if (p.stack.length) {
          const b = p.stack[p.stack.length - 1];
          p.w.vx += Math.sin(this.t * 9) * b.d.wind * 3.2 * dt;
          p.w.vz += Math.cos(this.t * 7) * b.d.wind * 3.2 * dt;
        }
        if (!o.blew) {
          o.blew = true;
          this.emit("vent", { x: p.x, y: p.y, z: p.z });
        }
      } else if (o.blew && !(dx * dx + dz * dz < o.r * o.r * 2)) {
        o.blew = false;
      }
    }
  }

  /* ---------- 택배 흔들림 ---------- */
  wobbleKick(ax, az, up) {
    const w = this.p.w;
    const L = this.load();
    w.vx += ax * L.wob;
    w.vz += az * L.wob;
    if (up) {
      w.vx += (this.rand() - 0.5) * up * L.wob;
      w.vz += (this.rand() - 0.5) * up * L.wob;
    }
  }
  updateWobble(p, dt) {
    const w = p.w;
    if (!p.stack.length) {
      w.x += (0 - w.x) * Math.min(1, dt * 8);
      w.z += (0 - w.z) * Math.min(1, dt * 8);
      w.vx = 0;
      w.vz = 0;
      return;
    }
    const L = this.load();
    let ax = (p.vx - p.pvx) / dt;
    let az = (p.vz - p.pvz) / dt;
    const am = Math.hypot(ax, az);
    const cap = 70;
    if (am > cap) {
      ax *= cap / am;
      az *= cap / am;
    }
    const kA = 0.1 * L.wob;
    const k = 32;
    const c = 6;
    const gk = 13;
    w.vx += (-ax * kA + gk * w.x - k * w.x - c * w.vx) * dt;
    w.vz += (-az * kA + gk * w.z - k * w.z - c * w.vz) * dt;
    w.x += w.vx * dt;
    w.z += w.vz * dt;
    const tilt = Math.hypot(w.x, w.z);
    p.tilt = tilt;
    if (tilt > 0.62 && p.bubble <= 0 && this.state === "play") {
      this.eject(p.stack[p.stack.length - 1], w.x / tilt, w.z / tilt, "tip");
      w.x *= 0.35;
      w.z *= 0.35;
      w.vx *= 0.3;
      w.vz *= 0.3;
    } else if (tilt > 0.62) {
      w.x *= 0.8;
      w.z *= 0.8;
      w.vx *= 0.5;
      w.vz *= 0.5;
    }
  }
  stackPos(i) {
    const p = this.p;
    let y = p.y + 1.22;
    for (let k = 0; k < i; k += 1) y += p.stack[k].d.size;
    y += p.stack[i].d.size / 2;
    const h = y - p.y;
    return { x: p.x + p.w.x * h * 0.9, y, z: p.z + p.w.z * h * 0.9 };
  }
  eject(b, dirx, dirz, why) {
    const p = this.p;
    if (!b) return;
    const i = p.stack.indexOf(b);
    if (i < 0) return;
    const pos = this.stackPos(i);
    p.stack.splice(i, 1);
    b.state = "free";
    b.x = pos.x;
    b.y = pos.y;
    b.z = pos.z;
    const out = why === "force" ? 3.2 : 2.6;
    b.vx = p.vx * 0.95 + dirx * out;
    b.vz = p.vz * 0.95 + dirz * out;
    b.vy = why === "force" ? 6.2 : 4.4;
    b.rvx = (this.rand() - 0.5) * 12 + dirz * 7;
    b.rvz = (this.rand() - 0.5) * 12 - dirx * 7;
    b.lock = 0.5;
    b.lost = 0;
    b.face = 1.6;
    b.airb = true;
    b.hopT = 0;
    this.stats.drops += 1;
    this.damage(b, 4);
    this.emit("drop", { box: b, x: b.x, y: b.y, z: b.z, why, first: this.stats.drops === 1 });
    this.slow(0.42, 0.34);
  }
  damage(b, n) {
    if (this.p.bubble > 0 && b.state === "held") return;
    const hurt = n * b.d.dmg;
    b.hp = Math.max(b.kind === "fragile" ? 0 : 10, b.hp - hurt);
    b.face = Math.max(b.face, 1);
    this.emit("hurt", { box: b, n: hurt });
    if (b.hp <= 0 && b.kind === "fragile" && this.state === "play") {
      b.state = "broken";
      this.emit("broken", { x: b.x, y: b.y, z: b.z, box: b });
      this.lose("broken");
    }
  }
  tryGrab(reach) {
    const p = this.p;
    if (this.state !== "play") return false;
    let got = false;
    for (const b of this.boxes) {
      if (b.state !== "free" || b.lock > 0) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d <= reach && Math.abs(b.y - (p.y + 0.5)) < 2.6) {
        this.grab(b);
        got = true;
      }
    }
    return got;
  }
  grab(b) {
    const p = this.p;
    const speed = Math.hypot(b.vx, b.vz);
    const nice = b.airb || speed > 3.2;
    b.state = "held";
    p.stack.push(b);
    b.vx = b.vy = b.vz = 0;
    this.stats.catches += 1;
    if (nice) this.stats.nice += 1;
    this.emit("catch", { box: b, x: b.x, y: b.y, z: b.z, nice });
    if (nice) {
      this.fish += 3;
      this.slow(0.35, 0.28);
    }
    p.w.vx *= 0.3;
    p.w.vz *= 0.3;
  }

  /* ---------- 사고 ---------- */
  plop(t = 0.7) {
    const p = this.p;
    if (p.mode === "stun" || p.mode === "snow") return;
    p.mode = "stun";
    p.modeT = t;
    this.stats.plops += 1;
    this.emit("plop", { x: p.x, y: p.y, z: p.z });
    this.wobbleKick((this.rand() - 0.5) * 2.2, (this.rand() - 0.5) * 2.2, 0);
  }
  bumped(power, nx, nz, why) {
    const p = this.p;
    this.wobbleKick(nx * power * 0.2, nz * power * 0.2, 0);
    this.emit("bump", { x: p.x, y: p.y, z: p.z, k: Math.min(1, power / 12), why });
    if (power > 9.5) this.plop(0.5);
  }
  /** 큰 충돌: 넘어지고 택배가 날아감 */
  hit(power, nx, nz, kind) {
    const p = this.p;
    if (p.inv > 0 || p.mode === "splash" || this.state !== "play") return false;
    if (p.shield > 0) {
      p.shield = 0;
      p.inv = 1.1;
      p.vx += nx * power * 0.5;
      p.vz += nz * power * 0.5;
      this.emit("shieldoff", { x: p.x, y: p.y, z: p.z });
      return false;
    }
    this.stats.hits += 1;
    p.inv = 1.15;
    p.vx += nx * power;
    p.vz += nz * power;
    if (p.grounded && power > 5) {
      p.vy = Math.min(5.5, power * 0.5);
      p.grounded = false;
      p.pad = null;
      p.cut = true;
    }
    this.emit("hit", { x: p.x, y: p.y, z: p.z, kind });
    if (p.stack.length) {
      if (p.bubble > 0) {
        p.bubble = 0;
        this.emit("bubbleoff", { x: p.x, y: p.y, z: p.z });
      } else {
        const b = p.stack[p.stack.length - 1];
        this.eject(b, nx, nz, "hit");
        this.damage(b, 8);
      }
    }
    this.plop(0.6);
    return true;
  }
  snowHit(nx, nz, kind) {
    const p = this.p;
    if (p.inv > 0 || p.mode === "splash" || this.state !== "play") return false;
    if (p.shield > 0) {
      p.shield = 0;
      p.inv = 1.3;
      this.emit("shieldoff", { x: p.x, y: p.y, z: p.z });
      return false;
    }
    p.mode = "snow";
    p.modeT = 1.5;
    p.wiggle = 0;
    p.inv = 2.6;
    p.vx += nx * 6;
    p.vz += nz * 6;
    this.stats.snow += 1;
    this.stats.hits += 1;
    this.emit("snowed", { x: p.x, y: p.y, z: p.z, kind });
    if (p.stack.length) {
      if (p.bubble > 0) {
        p.bubble = 0;
        this.emit("bubbleoff", { x: p.x, y: p.y, z: p.z });
      } else {
        const b = p.stack[p.stack.length - 1];
        this.eject(b, nx, nz, "hit");
        this.damage(b, 8);
      }
    }
    return true;
  }
  fall(p, water) {
    if (p.mode === "splash") return;
    p.mode = "splash";
    p.modeT = water ? 1.15 : 1;
    p.water = water;
    p.vx = p.vy = p.vz = 0;
    this.stats.dunks += 1;
    for (const b of p.stack) this.damage(b, 7);
    this.emit("fall", { x: p.x, y: water && this.c.seaY !== null && this.c.seaY !== undefined ? this.c.seaY : p.y, z: p.z, water });
  }
  respawn() {
    const p = this.p;
    const s = p.safe;
    const P = this.c.P;
    let x = s.x;
    let y = s.y;
    let z = s.z;
    let i = s.i;
    if (!s.onPad) {
      // 낭떠러지 바로 앞이면 몇 걸음 뒤로
      let guard = 0;
      while (guard < 16 && i > 0 && (!P[i].solid || !P[Math.min(P.length - 1, i + 8)].solid)) {
        i -= 1;
        guard += 1;
      }
      if (P[i].solid) {
        x = P[i].x;
        y = P[i].y;
        z = P[i].z;
      } else i = s.i;
    }
    p.x = x;
    p.z = z;
    p.y = y + 2.4;
    p.vx = p.vy = p.vz = 0;
    p.mode = "run";
    p.grounded = false;
    p.pad = null;
    p.cut = true;
    p.inv = 1.4;
    p.noCtl = 0.45;
    p.w.x = p.w.z = p.w.vx = p.w.vz = 0;
    p.idx = i;
    this.emit("respawn", { x: p.x, y, z: p.z });
  }

  /* ---------- 택배가 혼자 움직일 때 ---------- */
  updateBox(b, dt) {
    if (b.face > 0) b.face -= dt;
    if (b.state === "held" || b.state === "done" || b.state === "broken") return;
    const p = this.p;
    if (b.state === "stolen") {
      b.lost += dt;
      return;
    }
    if (b.state === "rescue") {
      b.rescue += dt;
      const u = clamp(b.rescue / 1.5, 0, 1);
      const a = b.from;
      const T = this.rescueTarget(b);
      b.x = lerp(a.x, T.x, u);
      b.z = lerp(a.z, T.z, u);
      b.y = lerp(a.y, T.y + 4, u) + Math.sin(u * Math.PI) * 3;
      b.rvx = 0;
      b.rvz = 0;
      if (u >= 1) {
        b.state = "free";
        b.vx = b.vz = 0;
        b.vy = -1;
        b.lock = 0.12;
        b.lost = 0;
        this.emit("rescued", { box: b, x: b.x, y: b.y, z: b.z });
      }
      return;
    }
    b.lock -= dt;
    b.lost += dt;
    const R = b.d.size * 0.5;
    // 바람
    const w = this.windNow;
    if (w.k > 0) {
      b.vx += w.x * w.k * b.d.wind * 0.8 * dt;
      b.vz += w.z * w.k * b.d.wind * 0.8 * dt;
    }
    let nx = b.x + b.vx * dt;
    let nz = b.z + b.vz * dt;
    let ny = b.y;
    const g = this.ground(nx, nz, b.y - R + 0.1, 0.5);
    const c = this.c;
    // 둑에 튕김
    const e = c.edge;
    if (!g && e.ok && Math.abs(e.y - b.y) < 3) {
      const s = e.s;
      const bank = e.lat < 0 ? s.bankL : s.bankR;
      if (bank) {
        const sign = Math.sign(e.lat);
        const push = Math.abs(e.lat) - s.hw + 0.06;
        nx -= s.rx * sign * push;
        nz -= s.rz * sign * push;
        const vn = b.vx * s.rx * sign + b.vz * s.rz * sign;
        if (vn > 0) {
          b.vx -= s.rx * sign * vn * (1 + b.d.rest);
          b.vz -= s.rz * sign * vn * (1 + b.d.rest);
          b.rvx += (this.rand() - 0.5) * 5;
          b.rvz += (this.rand() - 0.5) * 5;
          if (vn > 2) this.emit("boxbump", { box: b, x: b.x, y: b.y, z: b.z, k: Math.min(1, vn / 8) });
        }
      }
    }
    const G = this.ground(nx, nz, b.y - R + 0.1, 0.5);
    if (G) {
      const top = G.y + R;
      if (b.airb || b.vy > 0.01) {
        b.vy -= GRAV * b.d.gravity * dt;
        ny = b.y + b.vy * dt;
        if (ny <= top && b.vy <= 0) {
          ny = top;
          const impact = -b.vy;
          if (impact > 2.2) {
            b.vy = impact * b.d.rest;
            b.rvx += (this.rand() - 0.5) * 6;
            b.rvz += (this.rand() - 0.5) * 6;
            const fr = G.surf === "ice" ? 0.97 : 0.84;
            b.vx *= fr;
            b.vz *= fr;
            if (impact > 3) this.emit("boxbump", { box: b, x: b.x, y: ny, z: b.z, k: Math.min(1, impact / 11) });
            if (impact > 7.5) this.damage(b, (impact - 7) * 1.4);
          } else {
            b.vy = 0;
            b.airb = false;
          }
        }
      } else {
        ny = top;
        // 경사로 굴러 내려감
        const sl = G.slope;
        if (sl) {
          const f = (GRAV * sl) / Math.sqrt(1 + sl * sl);
          const S = SURF[G.surf] || SURF.snow;
          const k = (G.surf === "ice" ? 0.95 : 0.62) * b.d.roll;
          void S;
          b.vx -= G.dx * f * k * dt;
          b.vz -= G.dz * f * k * dt;
        }
        const speed = Math.hypot(b.vx, b.vz);
        const br = G.surf === "ice" ? 0.55 : G.surf === "deep" ? 22 : 3.8;
        if (speed > 0.001) {
          const ns = Math.max(0, speed - br * dt);
          b.vx *= ns / speed;
          b.vz *= ns / speed;
        }
        // 상자라서 통통 튀며 구름
        b.hopT += speed * dt;
        if (speed > 2.2 && b.hopT > 1.5) {
          b.hopT = 0;
          b.vy = 1.1 + speed * 0.2;
          b.airb = true;
          b.rvx += (b.vz / Math.max(1, speed)) * 3 + (this.rand() - 0.5) * 2;
          b.rvz += (-b.vx / Math.max(1, speed)) * 3 + (this.rand() - 0.5) * 2;
          this.emit("boxhop", { box: b, x: b.x, y: b.y, z: b.z });
        }
        if (G.pad) {
          nx += G.pad.vx * dt;
          nz += G.pad.vz * dt;
        }
      }
    } else {
      b.vy -= GRAV * b.d.gravity * dt;
      ny = b.y + b.vy * dt;
      b.airb = true;
    }
    // 바닥에 닿았을 때 회전을 평평하게
    b.x = nx;
    b.z = nz;
    b.y = ny;
    b.rx += b.rvx * dt;
    b.rz += b.rvz * dt;
    if (!b.airb) {
      const speed = Math.hypot(b.vx, b.vz);
      b.rvx *= 1 - Math.min(1, dt * 3);
      b.rvz *= 1 - Math.min(1, dt * 3);
      if (speed < 0.5) {
        const q = Math.PI / 2;
        b.rx += (Math.round(b.rx / q) * q - b.rx) * Math.min(1, dt * 9);
        b.rz += (Math.round(b.rz / q) * q - b.rz) * Math.min(1, dt * 9);
      }
    }
    // 장애물에 튕김
    for (const o of c.objs) {
      if (o.r && (o.type === "pillar" || o.type === "snowman" || o.type === "rotor") && !(o.type === "snowman" && o.down) && b.y < o.y + (o.h || 3)) {
        const dx = b.x - o.x;
        const dz = b.z - o.z;
        const RR = o.r + R;
        const d2 = dx * dx + dz * dz;
        if (d2 < RR * RR && d2 > 1e-5) {
          const d = Math.sqrt(d2);
          const nxx = dx / d;
          const nzz = dz / d;
          b.x = o.x + nxx * RR;
          b.z = o.z + nzz * RR;
          const vn = b.vx * nxx + b.vz * nzz;
          if (vn < 0) {
            b.vx -= nxx * vn * (1 + b.d.rest);
            b.vz -= nzz * vn * (1 + b.d.rest);
          }
        }
      }
    }
    // 물에 빠짐 / 낭떠러지
    let gone = false;
    if (c.seaY !== null && c.seaY !== undefined) {
      if (b.y < c.seaY + 0.15) {
        b.y = c.seaY + 0.15;
        b.vy = 0;
        b.vx *= 1 - Math.min(1, dt * 1.5);
        b.vz *= 1 - Math.min(1, dt * 1.5);
        if (b.splash <= 0) this.emit("boxsplash", { box: b, x: b.x, y: c.seaY, z: b.z });
        b.splash += dt;
        b.rz = Math.sin(this.t * 2.4) * 0.16;
        b.rx = Math.cos(this.t * 1.8) * 0.12;
        if (b.splash > 1.5) gone = true;
      }
    } else if (b.y < c.killY) {
      gone = true;
    }
    // 멀리 뒤에 남았거나 오래 못 찾으면 갈매기가 가져옴
    const far = b.lost > 9 || (b.lost > 2.5 && Math.abs(c.nearest(b.x, b.z).valueOf() - p.idx) * DS > 22);
    if (gone || far) this.startRescue(b, gone);
    // 닿으면 잡음
    if (b.state === "free" && b.lock <= 0 && p.mode !== "splash" && (this.state === "play")) {
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const dy = b.y - (p.y + 0.55);
      const touch = 0.95 + R * 0.5;
      if (dx * dx + dz * dz < touch * touch && Math.abs(dy) < 1.5 && p.mode !== "stun" && p.mode !== "snow") this.grab(b);
    }
  }
  startRescue(b, fell) {
    b.state = "rescue";
    b.rescue = 0;
    b.splash = 0;
    b.from = { x: b.x, y: b.y, z: b.z };
    b.airb = true;
    if (fell) this.damage(b, 10);
    if (b.state === "rescue") this.emit("rescue", { box: b, x: b.x, y: b.y, z: b.z });
  }
  rescueTarget(b) {
    void b;
    const s = this.p.safe;
    const P = this.c.P;
    const near = P[clamp(this.p.idx, 0, P.length - 1)];
    if (near.solid && this.p.grounded && !this.p.pad) return { x: this.p.x, y: this.p.y, z: this.p.z };
    return { x: s.x, y: s.y, z: s.z };
  }

  /* ---------- 장애물 ---------- */
  updateZones(dt) {
    const p = this.p;
    const s = this.c.P[clamp(p.idx, 0, this.c.P.length - 1)];
    let wx = 0;
    let wz = 0;
    let wk = 0;
    let fog = 0;
    for (const z of this.c.zones) {
      const inside = s.s >= z.s0 && s.s <= z.s1;
      if (z.type === "wind") {
        const u = ((this.t / z.period + z.phase) % 1 + 1) % 1;
        z.pre = u > z.duty && u > 1 - 0.8 / z.period ? 1 : 0;
        const on = u < z.duty;
        let env = 0;
        if (on) env = Math.min(1, Math.min(u, z.duty - u) * z.period * 3.5);
        z.gust = env;
        if (inside && env > 0) {
          wx += s.rx * z.dir * z.power * env;
          wz += s.rz * z.dir * z.power * env;
          wk = 1;
        }
      } else if (z.type === "blizzard") {
        if (inside) {
          const fade = clamp(Math.min(s.s - z.s0, z.s1 - s.s) / 8, 0, 1);
          fog = Math.max(fog, z.fog * fade);
          const a = this.t * 0.55;
          wx += Math.sin(a) * z.push * fade;
          wz += Math.cos(a * 1.3) * z.push * fade;
          wk = 1;
        }
      }
    }
    this.windNow.x = wx;
    this.windNow.z = wz;
    this.windNow.k = wk;
    this.fog += (fog - this.fog) * Math.min(1, dt * 1.2);
  }
  pushOut(o, R) {
    const p = this.p;
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const RR = R + PR;
    const d2 = dx * dx + dz * dz;
    if (d2 >= RR * RR || d2 < 1e-6) return 0;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const nz = dz / d;
    p.x = o.x + nx * RR;
    p.z = o.z + nz * RR;
    const vn = p.vx * nx + p.vz * nz;
    if (vn < 0) {
      const rest = p.surf === "ice" ? 0.5 : 0.2;
      p.vx -= nx * vn * (1 + rest);
      p.vz -= nz * vn * (1 + rest);
    }
    this._nx = nx;
    this._nz = nz;
    return Math.max(0, -vn);
  }
  updateObjs(dt) {
    const p = this.p;
    const P = this.c.P;
    const playing = this.state === "play";
    for (const o of this.c.objs) {
      switch (o.type) {
        case "snowman":
          if (o.down) break;
          if (p.y < o.y + o.h) {
            const v = this.pushOut(o, o.r);
            if (v > 0) {
              if (v > 2.2) {
                o.down = true;
                o.downT = this.t;
                this.emit("snowman", { x: o.x, y: o.y, z: o.z, o, k: Math.min(1, v / 9) });
                this.bumped(v * 0.75, this._nx, this._nz, "snowman");
              }
            }
          }
          break;
        case "pillar": {
          if (p.y < o.y + o.h) {
            const v = this.pushOut(o, o.r);
            if (v > 3.2) this.bumped(v, this._nx, this._nz, "pillar");
          }
          break;
        }
        case "rotor": {
          o.ang = o.phase + this.t * o.speed;
          if (p.y < o.y + o.h) this.pushOut(o, o.r);
          if (p.y < o.y + o.armH + 0.15 && p.y > o.y - 1) {
            for (let k = 0; k < o.arms; k += 1) {
              const a = o.ang + (k / o.arms) * TAU;
              const ax = Math.cos(a);
              const az = Math.sin(a);
              const dx = p.x - o.x;
              const dz = p.z - o.z;
              const along = clamp(dx * ax + dz * az, 0, o.len);
              const qx = o.x + ax * along;
              const qz = o.z + az * along;
              const ex = p.x - qx;
              const ez = p.z - qz;
              if (ex * ex + ez * ez < (PR + 0.26) * (PR + 0.26)) {
                // 도는 방향으로 밀려남
                const tx = -az * Math.sign(o.speed);
                const tz = ax * Math.sign(o.speed);
                this.hit(6.2, tx, tz, "rotor");
              }
            }
          }
          break;
        }
        case "spring": {
          if (o.kick > 0) o.kick -= dt;
          const dx = p.x - o.x;
          const dz = p.z - o.z;
          if (dx * dx + dz * dz < o.r * o.r && p.y < o.y + 0.5 && p.vy <= 0.5 && p.mode !== "splash") {
            p.vy = o.power;
            p.grounded = false;
            p.pad = null;
            p.cut = true;
            p.airDash = true;
            p.jumpT = 9;
            p.spin = 1;
            o.kick = 0.4;
            this.emit("spring", { x: o.x, y: o.y, z: o.z });
            this.wobbleKick(0, 0, 1.2);
          }
          break;
        }
        case "vent": {
          const u = ((this.t / o.period + o.phase) % 1 + 1) % 1;
          o.on = u < o.duty;
          o.warn = u > 1 - 0.7 / o.period;
          break;
        }
        case "icicle": {
          const d = Math.hypot(p.x - o.x, p.z - o.z);
          if (o.state === "hang") {
            if (d < o.trig && playing) {
              o.state = "warn";
              o.t = 0;
              this.emit("icewarn", { x: o.x, y: o.y, z: o.z });
            }
          } else if (o.state === "warn") {
            o.t += dt;
            if (o.t > 0.8) {
              o.state = "fall";
              o.t = 0;
              o.fv = 0;
            }
          } else if (o.state === "fall") {
            o.fv += GRAV * 1.3 * dt;
            o.fy -= o.fv * dt;
            if (o.fy <= o.y + 0.2) {
              o.fy = o.y;
              o.state = "gone";
              o.t = 0;
              this.emit("iceshatter", { x: o.x, y: o.y, z: o.z });
              if (d < o.r + 0.2 && p.y < o.y + 1.6) {
                const n = d > 0.01 ? d : 1;
                this.hit(5, (p.x - o.x) / n, (p.z - o.z) / n, "icicle");
              }
            }
          } else if (o.state === "gone") {
            o.t += dt;
            if (o.t > 6 && d > 7) {
              o.state = "hang";
              o.fy = o.top;
            }
          }
          break;
        }
        case "seal":
          this.updateSeal(o, dt);
          break;
        case "fox":
          this.updateFox(o, dt);
          break;
        case "geyser": {
          const u = ((this.t / o.period + o.phase) % 1 + 1) % 1;
          const was = o.state;
          o.state = u < o.duty ? 2 : u > 1 - 0.9 / o.period ? 1 : 0;
          o.u = u;
          if (was !== 2 && o.state === 2) this.emit("geyser", { x: o.x, y: o.y, z: o.z });
          if (o.state === 2) {
            const dx = p.x - o.x;
            const dz = p.z - o.z;
            if (dx * dx + dz * dz < o.r * o.r && p.y < o.y + 4 && p.mode !== "splash") {
              p.vy = Math.max(p.vy, o.power);
              if (p.grounded) {
                p.grounded = false;
                p.pad = null;
                p.cut = true;
                p.spin = 1;
                p.airDash = true;
                this.wobbleKick(0, 0, 1.1);
                this.emit("launched", { x: p.x, y: p.y, z: p.z });
              }
            }
          }
          break;
        }
        case "windmill": {
          o.ang = o.phase + this.t * o.speed;
          if (p.mode === "splash") break;
          const dx = p.x - o.x;
          const dz = p.z - o.z;
          const along = dx * o.dx + dz * o.dz;
          if (Math.abs(along) > 0.85) break;
          const lat = dx * o.rx + dz * o.rz;
          const py = p.y - o.y + 0.55;
          for (let k = 0; k < o.blades; k += 1) {
            const a = o.ang + (k / o.blades) * TAU;
            const bx = Math.cos(a);
            const by = Math.sin(a);
            const qx = lat;
            const qy = py - o.hub;
            const u = clamp(qx * bx + qy * by, 0, o.blade);
            const ex = qx - bx * u;
            const ey = qy - by * u;
            if (ex * ex + ey * ey < 0.62 * 0.62) {
              const sgn = along >= 0 ? 1 : -1;
              this.hit(7, o.dx * sgn, o.dz * sgn, "windmill");
            }
          }
          break;
        }
        case "bump": {
          const near = Math.abs(p.idx - o.i) <= 1 && p.grounded;
          if (near && !o.used) {
            const sp = Math.hypot(p.vx, p.vz);
            const along = p.vx * o.dx + p.vz * o.dz;
            if (along > 0.3) {
              o.used = true;
              this.emit("bumpride", { x: p.x, y: p.y, z: p.z });
              if (o.force || sp > o.limit) {
                p.vy = 2.8;
                p.grounded = false;
                p.pad = null;
                p.cut = true;
                if (p.stack.length && p.bubble <= 0) {
                  const b = p.stack[p.stack.length - 1];
                  const nv = Math.max(sp, 3);
                  this.eject(b, o.dx * (nv > 6 ? 0.9 : 1), o.dz * (nv > 6 ? 0.9 : 1), "force");
                }
              }
            }
          } else if (!near && o.used && Math.abs(p.idx - o.i) > 14) {
            o.used = false;
          }
          break;
        }
        case "balls":
          this.updateBalls(o, dt);
          break;
        case "chaser":
          this.updateChaser(o, dt);
          break;
        case "avalanche": {
          const u = ((this.t / o.period + o.phase) % 1 + 1) % 1;
          const warnU = 1 - o.warn / o.period;
          const runU = o.run / o.period;
          o.state = u < runU ? 2 : u > warnU ? 1 : 0;
          o.k = o.state === 2 ? u / runU : 0;
          if (o.state === 2 && !o.fired) {
            o.fired = true;
            this.emit("avalanche", { x: o.x, y: o.y, z: o.z });
          }
          if (o.state !== 2) o.fired = false;
          if (o.state === 2 && p.grounded !== undefined) {
            const dx = p.x - o.x;
            const dz = p.z - o.z;
            const along = dx * o.dx + dz * o.dz;
            if (Math.abs(along) < o.band / 2 && p.y < o.y + 2.4) {
              const lat = dx * o.rx + dz * o.rz;
              const frontLat = -o.hw - 2 + o.k * (o.hw * 2 + 4);
              if (lat < frontLat + 1.2 && lat > frontLat - 3.2) this.snowHit(o.rx * 0.6 + o.dx * 0.4, o.rz * 0.6 + o.dz * 0.4, "avalanche");
            }
          }
          break;
        }
        case "tunnel": {
          const ps = P[clamp(p.idx, 0, P.length - 1)].s;
          if (!o.active && !o.done && o.collapse && ps >= o.trig && playing) {
            o.active = true;
            o.front = o.s0;
            this.emit("tunnelgo", { x: o.x, y: o.y, z: o.z });
          }
          if (o.active) {
            o.front += o.speed * dt;
            if (o.front >= o.s1) {
              o.active = false;
              o.done = true;
              o.front = o.s1;
              this.emit("tunnelend", {});
            }
            if (ps >= o.s0 && ps <= o.s1 && ps < o.front + 0.4 && ps > o.front - 2.2) {
              const s = P[clamp(p.idx, 0, P.length - 1)];
              this.snowHit(s.dx, s.dz, "tunnel");
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }
  updateSeal(o, dt) {
    const p = this.p;
    o.t += dt;
    if (o.state === "patrol") {
      const a = (this.t / o.period) * TAU + o.phase;
      const k = Math.sin(a);
      o.x = o.x0 + o.ax * k * o.amp;
      o.z = o.z0 + o.az * k * o.amp;
      const v = Math.cos(a);
      o.dir = Math.atan2(o.ax * v, -(o.az * v));
      if (p.mode !== "splash" && p.y < o.y + 1) {
        const dx = p.x - o.x;
        const dz = p.z - o.z;
        const R = o.r + PR;
        if (dx * dx + dz * dz < R * R && p.inv <= 0 && this.state === "play") {
          const d = Math.max(0.01, Math.hypot(dx, dz));
          if (p.stack.length && p.bubble <= 0) {
            const b = p.stack.pop();
            b.state = "stolen";
            b.by = o;
            b.lost = 0;
            b.face = 2;
            o.carry = b;
            o.state = "carry";
            o.t = 0;
            this.stats.thief += 1;
            this.stats.drops += 1;
            p.inv = 1.2;
            p.vx += (dx / d) * 3;
            p.vz += (dz / d) * 3;
            this.emit("stolen", { box: b, by: "seal", x: o.x, y: o.y, z: o.z });
          } else {
            if (p.bubble > 0) {
              p.bubble = 0;
              this.emit("bubbleoff", { x: p.x, y: p.y, z: p.z });
            }
            p.inv = 1;
            p.vx += (dx / d) * 6;
            p.vz += (dz / d) * 6;
            this.emit("bump", { x: p.x, y: p.y, z: p.z, k: 0.6, why: "seal" });
          }
        }
      }
    } else if (o.state === "carry") {
      const away = Math.atan2(o.x - p.x, -(o.z - p.z));
      o.dir = away;
      // 바다표범 활동 범위 안에서 도망감
      const sp = 3.4;
      const nx = o.x + Math.sin(away) * sp * dt;
      const nz = o.z - Math.cos(away) * sp * dt;
      const fx = nx - o.x0;
      const fz = nz - o.z0;
      if (Math.hypot(fx, fz) < o.amp + 1.2) {
        const g = this.ground(nx, nz, o.y + 0.3, 0.6);
        if (g) {
          o.x = nx;
          o.z = nz;
          o.y = g.y;
        }
      }
      const b = o.carry;
      if (b) {
        b.x = o.x + Math.sin(o.dir) * 0.7;
        b.z = o.z - Math.cos(o.dir) * 0.7;
        b.y = o.y + 0.75 + b.d.size / 2;
      }
      const dashed = Math.hypot(p.x - o.x, p.z - o.z) < o.r + PR + 0.25;
      if (o.t > 2.6 || dashed) {
        if (b) this.spit(o, b, dashed);
        o.state = "dizzy";
        o.t = 0;
      }
    } else if (o.state === "dizzy") {
      if (o.t > 1.8) {
        o.state = "return";
        o.t = 0;
      }
    } else if (o.state === "return") {
      const a = (this.t / o.period) * TAU + o.phase;
      const tx = o.x0 + o.ax * Math.sin(a) * o.amp;
      const tz = o.z0 + o.az * Math.sin(a) * o.amp;
      o.x += (tx - o.x) * Math.min(1, dt * 2.4);
      o.z += (tz - o.z) * Math.min(1, dt * 2.4);
      if (Math.hypot(tx - o.x, tz - o.z) < 0.2) o.state = "patrol";
    }
  }
  spit(o, b, bumped) {
    b.state = "free";
    b.by = null;
    o.carry = null;
    b.lost = 0;
    b.lock = 0.15;
    b.airb = true;
    const safeDir = Math.atan2(this.p.x - o.x, -(this.p.z - o.z));
    b.vx = Math.sin(safeDir) * 2.4;
    b.vz = -Math.cos(safeDir) * 2.4;
    b.vy = 5;
    b.rvx = (this.rand() - 0.5) * 10;
    b.rvz = (this.rand() - 0.5) * 10;
    this.emit("spit", { box: b, x: o.x, y: o.y, z: o.z, bumped, by: o.type });
  }
  updateFox(o, dt) {
    const p = this.p;
    const P = this.c.P;
    o.t += dt;
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    if (o.state === "hide") {
      if (d < o.trig && p.stack.length && this.state === "play") {
        o.state = "peek";
        o.t = 0;
        this.emit("foxpeek", { x: o.x, y: o.y, z: o.z });
      }
    } else if (o.state === "peek") {
      if (o.t > 0.75) {
        o.state = "dash";
        o.t = 0;
      }
    } else if (o.state === "dash") {
      const a = Math.atan2(p.x - o.x, -(p.z - o.z));
      o.dir = a;
      const sp = 6.6;
      const nx = o.x + Math.sin(a) * sp * dt;
      const nz = o.z - Math.cos(a) * sp * dt;
      const g = this.ground(nx, nz, o.y + 0.4, 0.8);
      if (g) {
        o.x = nx;
        o.z = nz;
        o.y = g.y;
      }
      if (d < 1 && p.y < o.y + 1.15 && p.inv <= 0 && p.stack.length && p.bubble <= 0 && this.state === "play") {
        const b = p.stack.pop();
        b.state = "stolen";
        b.by = o;
        b.lost = 0;
        b.face = 2;
        o.carry = b;
        o.state = "flee";
        o.t = 0;
        o.idx = this.c.nearest(o.x, o.z, p.idx);
        this.stats.thief += 1;
        this.stats.drops += 1;
        p.inv = 0.9;
        this.emit("stolen", { box: b, by: "fox", x: o.x, y: o.y, z: o.z });
      } else if (o.t > 2.4 || !p.stack.length) {
        o.state = "leave";
        o.t = 0;
      }
    } else if (o.state === "flee") {
      // 길을 따라 앞으로 도망가므로 쫓아가면 됨
      const b = o.carry;
      const sp = 6.4 - Math.min(2, o.t * 0.3);
      const next = P[clamp(o.idx + 4, 0, P.length - 1)];
      const a = Math.atan2(next.x - o.x, -(next.z - o.z));
      o.dir = a;
      const nx = o.x + Math.sin(a) * sp * dt;
      const nz = o.z - Math.cos(a) * sp * dt;
      const g = this.ground(nx, nz, o.y + 0.5, 0.9);
      let stop = false;
      if (g) {
        o.x = nx;
        o.z = nz;
        o.y = g.y;
      } else stop = true;
      o.idx = this.c.nearest(o.x, o.z, o.idx);
      if (next.i - o.idx < 2 && o.idx >= P.length - 8) stop = true;
      if (b) {
        b.x = o.x + Math.sin(a) * 0.55;
        b.z = o.z - Math.cos(a) * 0.55;
        b.y = o.y + 0.65 + b.d.size / 2;
      }
      const caught = d < 1.05 && p.y < o.y + 1.5;
      if (o.t > 6.5 || caught || stop) {
        if (b) this.spit(o, b, caught);
        o.state = "dizzy";
        o.t = 0;
      }
    } else if (o.state === "dizzy") {
      if (o.t > 1.6) {
        o.state = "leave";
        o.t = 0;
      }
    } else if (o.state === "leave") {
      if (o.t > 1) o.state = "gone";
    }
  }
  updateBalls(o, dt) {
    const p = this.p;
    const P = this.c.P;
    const ps = P[clamp(p.idx, 0, P.length - 1)].s;
    if (ps >= o.trig && ps <= o.s1 + 4 && this.t >= o.next && this.state === "play") {
      o.next = this.t + o.period;
      o.count += 1;
      const lat = o.lat + (o.wander ? Math.sin(o.count * 1.7) * o.wander : 0);
      o.list.push({ s: o.s1, lat, r: o.r, rot: 0, on: true, x: 0, y: 0, z: 0 });
      this.emit("ballspawn", {});
    }
    for (const b of o.list) {
      if (!b.on) continue;
      b.s -= o.speed * dt;
      b.rot += (o.speed / b.r) * dt;
      if (b.s <= o.s0) {
        b.on = false;
        this.emit("ballbreak", { x: b.x, y: b.y, z: b.z });
        continue;
      }
      const i = clamp(Math.round(b.s / DS), 0, P.length - 1);
      const s = P[i];
      b.x = s.x + s.rx * b.lat;
      b.y = s.y + b.r;
      b.z = s.z + s.rz * b.lat;
      const dx = p.x - b.x;
      const dy = p.y + 0.55 - b.y;
      const dz = p.z - b.z;
      const R = b.r + 0.48;
      if (dx * dx + dy * dy + dz * dz < R * R) {
        const d = Math.max(0.01, Math.hypot(dx, dz));
        this.snowHit((dx / d) * 0.5 - s.dx * 0.8, (dz / d) * 0.5 - s.dz * 0.8, "ball");
      }
      // 떨어진 택배도 맞으면 튕김
      for (const x of this.boxes) {
        if (x.state !== "free") continue;
        const ax = x.x - b.x;
        const az = x.z - b.z;
        if (ax * ax + az * az < (b.r + 0.4) * (b.r + 0.4) && x.y < b.y + b.r) {
          x.vx += -s.dx * 5 + ax;
          x.vz += -s.dz * 5 + az;
          x.vy = 4.5;
          x.airb = true;
        }
      }
    }
    if (o.list.length > 8) o.list = o.list.filter((b) => b.on);
  }
  updateChaser(o, dt) {
    const p = this.p;
    const P = this.c.P;
    if (o.done) return;
    const ps = P[clamp(p.idx, 0, P.length - 1)].s;
    if (!o.active) {
      if (ps >= o.trig && this.state === "play") {
        o.active = true;
        o.sNow = o.s0;
        this.emit("chaser", {});
      } else return;
    }
    // 너무 멀어지면 조금 빨라져 긴장 유지, 가까우면 살짝 늦춤
    const gap = ps - o.sNow;
    const sp = o.speed * (gap > 14 ? 1.25 : gap < 5 ? 0.86 : 1);
    o.sNow += sp * dt;
    o.rot = (o.rot || 0) + (sp / o.r) * dt;
    if (o.sNow >= o.s1) {
      o.done = true;
      o.active = false;
      this.emit("ballbreak", { x: o.x, y: o.y, z: o.z, big: true });
      return;
    }
    const s = P[clamp(Math.round(o.sNow / DS), 0, P.length - 1)];
    o.x = s.x;
    o.z = s.z;
    o.y = s.y + o.r;
    const dx = p.x - o.x;
    const dy = p.y + 0.55 - o.y;
    const dz = p.z - o.z;
    const R = o.r + 0.42;
    if (dx * dx + dy * dy + dz * dz < R * R) this.snowHit(s.dx, s.dz, "chaser");
  }

  /* ---------- 아이템 · 진행 ---------- */
  updateItems(dt) {
    const p = this.p;
    if (p.mode === "splash") return;
    for (const it of this.c.items) {
      if (!it.on) continue;
      let dx = p.x - it.x;
      let dy = p.y + 0.6 - it.y;
      let dz = p.z - it.z;
      let d2 = dx * dx + dy * dy + dz * dz;
      if (p.magnet > 0 && it.type === "fish" && d2 < 42) {
        const d = Math.sqrt(d2);
        const k = Math.min(1, (dt * 13) / Math.max(0.5, d));
        it.x += dx * k;
        it.y += dy * k;
        it.z += dz * k;
        dx = p.x - it.x;
        dy = p.y + 0.6 - it.y;
        dz = p.z - it.z;
        d2 = dx * dx + dy * dy + dz * dz;
      }
      if (d2 < 1.25) {
        it.on = false;
        this.collect(it);
      }
    }
  }
  collect(it) {
    const p = this.p;
    switch (it.type) {
      case "fish":
        this.fish += 1;
        break;
      case "star":
        this.stars += 1;
        break;
      case "boost":
        p.boost = 4.5;
        p.vx *= 1.1;
        p.vz *= 1.1;
        break;
      case "magnet":
        p.magnet = 9;
        break;
      case "shield":
        p.shield = 14;
        break;
      case "bubble":
        p.bubble = 12;
        break;
      default:
        break;
    }
    this.emit("item", { kind: it.type, x: it.x, y: it.y, z: it.z });
  }
  updateProgress(dt) {
    const c = this.c;
    const p = this.p;
    p.idx = c.nearest(p.x, p.z, p.idx);
    const P = c.P;
    const s = P[clamp(p.idx, 0, P.length - 1)];
    p.progress = clamp(s.s / Math.max(1, c.goal.s), 0, 1);
    for (const t of c.tips) {
      if (!t.done && s.s >= t.s && this.state === "play") {
        t.done = true;
        this.emit("tip", { text: t.text, key: t.key });
      }
    }
    for (const k of c.checks) {
      if (!k.on && s.s >= k.s && p.grounded) {
        k.on = true;
        p.safe.x = k.x;
        p.safe.y = k.y;
        p.safe.z = k.z;
        p.safe.i = k.i;
        p.safe.onPad = false;
        this.emit("check", { x: k.x, y: k.y, z: k.z });
      }
    }
    // 도착
    if (this.state === "play" && c.goal) {
      const g = c.goal;
      const d = Math.hypot(p.x - g.x, p.z - g.z);
      if (this.goalMsgT > 0) this.goalMsgT -= dt;
      if (d < g.r && Math.abs(p.y - g.y) < 3 && p.mode !== "splash") {
        const left = this.boxes.filter((b) => b.state !== "held" && b.state !== "done" && b.state !== "broken").length;
        if (left === 0 && p.stack.length) this.deliver();
        else if (left > 0 && this.goalMsgT <= 0) {
          this.goalMsgT = 3;
          this.emit("needmore", { left });
        }
      }
    }
    if (this.state === "delivering") {
      if (this.stateT > 2.7) {
        this.setState("won");
        this.emit("won", {});
      }
    }
    if (this.state === "failing" && this.stateT > 2) {
      this.setState("lost");
      this.emit("lost", { why: this.loseWhy });
    }
  }
  condition() {
    let a = 0;
    let n = 0;
    for (const b of this.boxes) {
      a += b.hp;
      n += 1;
    }
    return n ? a / n : 100;
  }
  deliver() {
    const p = this.p;
    const stack = p.stack.slice();
    p.stack.length = 0;
    for (const b of stack) b.state = "done";
    p.mode = "dance";
    p.modeT = 99;
    this.setState("delivering");
    const cond = Math.round(this.condition());
    const time = this.clock;
    const stars3 = 1 + (cond >= 60 ? 1 : 0) + (time <= this.par ? 1 : 0);
    const timeBonus = Math.max(0, Math.round((this.limit - time) * 12));
    const score = 1000 + timeBonus + cond * 8 + this.fish * 15 + this.stars * 300;
    this.result = { won: true, stars: stars3, time, cond, fish: this.fish, starItems: this.stars, score, timeBonus, stats: { ...this.stats } };
    this.emit("deliver", { x: p.x, y: p.y, z: p.z, boxes: stack });
  }
  lose(why) {
    if (this.state !== "play") return;
    const p = this.p;
    this.loseWhy = why;
    p.mode = "sad";
    p.modeT = 99;
    this.result = { won: false, why, time: this.clock, cond: Math.round(this.condition()), fish: this.fish, starItems: this.stars, stats: { ...this.stats } };
    this.setState("failing");
    this.emit("fail", { why, x: p.x, y: p.y, z: p.z });
  }
}
