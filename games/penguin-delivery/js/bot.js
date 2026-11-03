/*
 * 점검용 봇: 화면 없이 물리 코드 그대로 스테이지를 끝까지 플레이한다.
 *  사람보다 잘하지만 코스를 미리 보지는 않고, 지금 보이는 위치로만 판단한다.
 */
import { clamp, DS } from "./course.js";

export class Bot {
  constructor(sim) {
    this.sim = sim;
    this.stuck = 0;
    this.lastS = 0;
    this.waitT = 0;
  }
  /** 앞쪽의 다음 빈 공간과 내려설 곳 */
  nextLanding(i) {
    const c = this.sim.c;
    const P = c.P;
    const p = this.sim.p;
    // 발판 위면 다음 발판 또는 길 찾기
    const pad = p.pad && p.pad.route ? p.pad : null;
    let from = i;
    if (pad) from = Math.round(pad.s / DS);
    let gapStart = -1;
    for (let k = from; k < Math.min(P.length, from + 60); k += 1) {
      if (!P[k].solid && !P[k].plank) {
        gapStart = k;
        break;
      }
    }
    // 길 위에서 이미 빈 공간 앞에 다음 발판이 있는지
    let next = null;
    for (const q of c.route) {
      if (q === pad) continue;
      if (q.s <= (pad ? pad.s : P[i].s)) continue;
      if (!next || q.s < next.s) next = q;
    }
    if (gapStart < 0 && !pad) return null;
    if (next) {
      // 그 발판 앞에 길이 있으면 길이 먼저
      let hasRoad = false;
      for (let k = Math.max(from, gapStart < 0 ? from : gapStart); k < Math.round(next.s / DS); k += 1) {
        if (P[k].solid) {
          hasRoad = true;
          break;
        }
      }
      if (!hasRoad && (gapStart >= 0 || pad)) return { pad: next, gapStart };
    }
    if (gapStart < 0) gapStart = from;
    for (let k = gapStart; k < P.length; k += 1) {
      if (P[k].solid || P[k].plank) return { road: P[k], gapStart, gapLen: (k - gapStart) * DS };
    }
    return null;
  }
  steerTo(x, z, k = 1) {
    const p = this.sim.p;
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.02) return { x: 0, z: 0 };
    return { x: (dx / d) * k, z: (dz / d) * k };
  }
  /** 공중: 내려앉을 때까지 남은 시간으로 필요한 속도를 계산 */
  airTo(tx, ty, tz, deeper, slack = 0, canDash = true) {
    const sim = this.sim;
    const p = sim.p;
    const inp = sim.input;
    const g = 22;
    const h = p.y - ty;
    const disc = p.vy * p.vy + 2 * g * h;
    const t = disc > 0 ? (p.vy + Math.sqrt(disc)) / g : 0.05;
    let dx = tx - p.x;
    let dz = tz - p.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.02) {
      inp.x = -p.vx * 0.2;
      inp.z = -p.vz * 0.2;
      return;
    }
    dx /= d;
    dz /= d;
    d += deeper;
    const along = p.vx * dx + p.vz * dz;
    const reach = along * t;
    // 넘어갈 것 같으면 살짝 당기고, 아니면 목표 쪽으로
    if (reach > d + slack + 0.2) {
      inp.x = -dx;
      inp.z = -dz;
    } else {
      inp.x = dx;
      inp.z = dz;
    }
    if (canDash && p.airDash && p.vy < 1.5 && d - slack > reach + 7.5 * t * t * 0.7 + 0.3) inp.dash = true;
  }
  /** 위험 피하기: 앞쪽 장애물에서 옆으로 비킴 */
  avoid(move, i) {
    const sim = this.sim;
    const p = sim.p;
    const P = sim.c.P;
    const s = P[i];
    let push = 0;
    const consider = (ox, oz, r, weight = 1) => {
      const dx = ox - p.x;
      const dz = oz - p.z;
      const along = dx * s.dx + dz * s.dz;
      const lat = dx * s.rx + dz * s.rz;
      if (along < -1 || along > 6.5) return;
      const clear = r + 0.95;
      if (Math.abs(lat) > clear) return;
      const dir = lat >= 0 ? -1 : 1;
      push += dir * (clear - Math.abs(lat)) * weight;
    };
    for (const o of sim.c.objs) {
      if (o.type === "snowman" && !o.down) consider(o.x, o.z, o.r);
      else if (o.type === "pillar") consider(o.x, o.z, o.r);
      else if (o.type === "rotor") consider(o.x, o.z, o.r);
      else if (o.type === "seal" || o.type === "fox") {
        if (o.state !== "gone") consider(o.x, o.z, o.r + 0.8, 1.3);
      } else if (o.type === "icicle" && (o.state === "warn" || o.state === "fall")) consider(o.x, o.z, o.r + 0.5, 1.5);
      else if (o.type === "balls") {
        for (const b of o.list) if (b.on) consider(b.x, b.z, b.r + 0.6, 1.6);
      }
    }
    for (const q of sim.c.holes) consider(q.x, q.z, q.r + 0.35, 1.4);
    for (const q of sim.c.pads) if (q.kind === "crate") consider(q.x, q.z, q.hw + 0.3, 1);
    if (push === 0) return move;
    const lat = (p.x - s.x) * s.rx + (p.z - s.z) * s.rz;
    if (lat + push * 0.8 > s.hw - 0.8) push = -Math.abs(push);
    if (lat + push * 0.8 < -s.hw + 0.8) push = Math.abs(push);
    const nx = move.x + s.rx * push * 1.4;
    const nz = move.z + s.rz * push * 1.4;
    const m = Math.hypot(nx, nz);
    return m > 1 ? { x: nx / m, z: nz / m } : { x: nx, z: nz };
  }
  /** 시간 장애물 앞에서 기다려야 하나 */
  mustWait(i) {
    const sim = this.sim;
    const p = sim.p;
    const P = sim.c.P;
    const ps = P[i].s;
    for (const o of sim.c.objs) {
      if (o.type === "windmill") {
        const gap = o.s - ps;
        if (gap > 0.5 && gap < 3) {
          const speed = Math.max(3, Math.hypot(p.vx, p.vz));
          const eta = gap / speed;
          const dx = p.x - o.x;
          const dz = p.z - o.z;
          const lat = dx * o.rx + dz * o.rz;
          for (let t = 0; t <= eta + 0.45; t += 0.05) {
            const ang = o.phase + (sim.t + t) * o.speed;
            for (let k = 0; k < o.blades; k += 1) {
              const a = ang + (k / o.blades) * Math.PI * 2;
              const bx = Math.cos(a);
              const by = Math.sin(a);
              const u = clamp(lat * bx + (0.55 - o.hub) * by, 0, o.blade);
              const ex = lat - bx * u;
              const ey = 0.55 - o.hub - by * u;
              if (ex * ex + ey * ey < 0.85 * 0.85 && t > eta - 0.45) return true;
            }
          }
        }
      } else if (o.type === "avalanche") {
        const gap = o.s - o.band / 2 - ps;
        if (gap > 0 && gap < 2.4) {
          const speed = Math.max(4, Math.hypot(p.vx, p.vz));
          const eta = (gap + o.band) / speed;
          const u = (((sim.t / o.period + o.phase) % 1) + 1) % 1;
          const untilRun = (1 - u) * o.period;
          if (o.state === 2 || untilRun < eta + 0.25) return true;
        }
      }
    }
    return false;
  }
  update() {
    const sim = this.sim;
    const p = sim.p;
    const inp = sim.input;
    const P = sim.c.P;
    inp.jump = false;
    inp.dash = false;
    inp.grab = false;
    if (sim.state !== "play") {
      inp.x = 0;
      inp.z = 0;
      return;
    }
    const i = clamp(p.idx, 0, P.length - 1);
    const s = P[i];
    // 떨어진 택배가 있으면 먼저 쫓아감
    const lost = sim.boxes.find((b) => b.state === "free" && b.lock <= 0.2);
    if (lost && p.grounded !== undefined) {
      const m = this.steerTo(lost.x, lost.z);
      const d = Math.hypot(lost.x - p.x, lost.z - p.z);
      inp.x = m.x;
      inp.z = m.z;
      if (d > 3 && p.grounded && Math.hypot(p.vx, p.vz) > 4) inp.dash = true;
      if (d < 2) inp.grab = true;
      // 길 끝이면 멈춤
      if (p.grounded && !p.pad) {
        const ahead = P[clamp(i + 3, 0, P.length - 1)];
        if (!ahead.solid && (lost.y < p.y - 2 || d > 6)) {
          inp.x = 0;
          inp.z = 0;
        }
      }
      return;
    }
    if (sim.boxes.some((b) => b.state === "stolen")) {
      const b = sim.boxes.find((x) => x.state === "stolen");
      const m = this.steerTo(b.x, b.z);
      inp.x = m.x;
      inp.z = m.z;
      if (p.grounded && Math.hypot(p.vx, p.vz) > 4) inp.dash = true;
      return;
    }
    if (sim.boxes.some((b) => b.state === "rescue" || (b.state === "free" && b.lock > 0.2))) {
      inp.x = 0;
      inp.z = 0;
      return;
    }
    const land = this.nextLanding(i);
    const speed = Math.hypot(p.vx, p.vz);
    // 기본: 길 따라 앞으로
    const look = P[clamp(i + Math.round(clamp(3 + speed * 0.5, 3, 8) / DS), 0, P.length - 1)];
    let move = this.steerTo(look.x, look.z);
    if (sim.c.goal) {
      const dg = Math.hypot(sim.c.goal.x - p.x, sim.c.goal.z - p.z);
      if (dg < 10) move = this.steerTo(sim.c.goal.x, sim.c.goal.z);
    }
    move = this.avoid(move, i);

    // 높은 곳이면 튕김 발판 · 바람 구멍 · 물기둥 이용
    if (land && land.road && land.road.y - p.y > 1.15) {
      const lift = sim.c.objs.find((o) => (o.type === "spring" || o.type === "vent" || o.type === "geyser") && o.s > s.s - 7 && o.s < land.road.s + 1);
      if (lift) {
        const d = Math.hypot(lift.x - p.x, lift.z - p.z);
        if (p.grounded) {
          if (d > 0.45) {
            const m = this.steerTo(lift.x, lift.z, d < 1.5 ? 0.45 : 1);
            inp.x = m.x;
            inp.z = m.z;
          } else {
            inp.x = 0;
            inp.z = 0;
          }
        } else if (p.y > land.road.y + 0.05) {
          this.airTo(land.road.x + land.road.dx * 2, land.road.y, land.road.z + land.road.dz * 2, 0);
        } else if (p.vy > 0) {
          inp.x = 0;
          inp.z = 0;
        } else {
          const m = this.steerTo(lift.x, lift.z, 0.5);
          inp.x = m.x;
          inp.z = m.z;
        }
        return;
      }
    }
    if (land) {
      const tgt = land.pad || land.road;
      if (tgt) {
        const tx = land.pad ? tgt.x : tgt.x;
        const tz = land.pad ? tgt.z : tgt.z;
        const ty = land.pad ? tgt.y : tgt.y;
        // 내려설 곳까지 거리
        const d = Math.hypot(tx - p.x, tz - p.z);
        const R = land.pad ? (tgt.shape === "disc" ? tgt.r : Math.min(tgt.hw, tgt.hd)) : 0;
        const onSomething = p.grounded;
        const edgeDist = land.gapStart >= 0 && !p.pad ? (land.gapStart - i) * DS : (() => {
          const q = p.pad;
          if (!q) return 99;
          const qr = q.shape === "disc" ? q.r : Math.min(q.hw, q.hd);
          return qr - Math.hypot(p.x - q.x, p.z - q.z);
        })();
        const air = 0.82;
        const rise = ty - p.y;
        // 가장자리까지 달린 뒤 뛰었을 때 발판이 어디 있을지
        const eta = Math.max(0, edgeDist) / Math.max(speed, 4) + 0.72;
        const fx = tx + (tgt.vx || 0) * eta;
        const fz = tz + (tgt.vz || 0) * eta;
        const usable = Math.hypot(fx - p.x, fz - p.z) - R * 0.6 - Math.max(0, edgeDist);
        let good = usable < 5 && rise < 1.3;
        if (land.pad && tgt.kind === "vanish") {
          const at = (t) => (((sim.t + t + tgt.phase * tgt.period) / tgt.period) % 1 + 1) % 1;
          // 사라지는 길: 길 위에서 켜지는 박자를 기다렸다가 출발, 발판 위에서는 멈추지 않음
          good = p.pad && p.pad.kind === "vanish" ? true : at(eta) < 0.2;
        }
        // 한번 출발하기로 했으면 끝까지
        if (good) this.commit = tgt;
        else if (this.commit === tgt && edgeDist < 2.6) good = true;
        if (edgeDist < 3.2 && onSomething) {
          const aim = this.steerTo(tx + (tgt.vx || 0) * 0.6, tz + (tgt.vz || 0) * 0.6);
          if (!good) {
            // 앞이 없으면 멈춰서 기다림 (얼음이면 살짝 뒤로)
            this.waitT += 1 / 60;
            if (edgeDist < 1.6) {
              const back = p.pad ? this.steerTo(p.pad.x, p.pad.z, 0.7) : { x: -s.dx * 0.9, z: -s.dz * 0.9 };
              inp.x = back.x;
              inp.z = back.z;
            } else {
              inp.x = 0;
              inp.z = 0;
            }
            return;
          }
          inp.x = aim.x;
          inp.z = aim.z;
          // 충분히 빠르거나 가장자리에 왔을 때 뜀
          const need = (usable - 1) / air;
          if (tgt.kind === "vanish") {
            // 틈이 좁으니 가장자리에서만 살짝 뜀
            if (edgeDist < 0.45 && p.coyote > 0) inp.jump = true;
          } else if ((edgeDist < 0.9 || (speed > need + 1.5 && edgeDist < 2)) && p.coyote > 0) inp.jump = true;
          inp.jumpHold = true;
          return;
        }
        if (!p.grounded && edgeDist >= 0) {
          // 공중: 목표 쪽으로, 부족하면 공중 대시
          inp.jump = false;
          inp.jump = p.vy > 0;
          if (tgt.kind === "vanish") {
            this.airTo(tx, ty, tz, 0, R * 0.7, false);
            return;
          }
          this.airTo(tx + (tgt.vx || 0) * 0.25, ty, tz + (tgt.vz || 0) * 0.25, land.road ? 1.5 : 0, R * 0.7, true);
          return;
        }
      }
    }
    if (!p.grounded) {
      inp.jump = p.vy > 0;
      // 공중에선 다음 길 표본 쪽으로
      let k = i;
      while (k < P.length - 1 && !P[k].solid) k += 1;
      const q = P[Math.min(P.length - 1, k + 3)];
      this.airTo(q.x, q.y, q.z, 0, 0, false);
      return;
    }
    // 시간 장애물
    if (this.mustWait(i)) {
      inp.x = -s.dx * (speed > 3 ? 0.6 : 0);
      inp.z = -s.dz * (speed > 3 ? 0.6 : 0);
      return;
    }
    // 낮은 장애물은 뛰어넘음 (상자 · 도는 팔 · 둔턱)
    for (const q of sim.c.pads) {
      if (q.kind !== "crate") continue;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const along = dx * s.dx + dz * s.dz;
      const lat = dx * s.rx + dz * s.rz;
      if (along > 0.4 && along < 2.1 + speed * 0.12 && Math.abs(lat) < q.hw + 0.55) inp.jump = true;
    }
    for (const o of sim.c.objs) {
      if (o.type !== "rotor") continue;
      const dx = o.x - p.x;
      const dz = o.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > o.len + 2.2 || d < 1) continue;
      for (let k = 0; k < o.arms; k += 1) {
        const a = o.ang + (k / o.arms) * Math.PI * 2 + o.speed * 0.22;
        const ax = Math.cos(a);
        const az = Math.sin(a);
        const u = clamp(-dx * ax - dz * az, 0, o.len);
        const ex = p.x - (o.x + ax * u);
        const ez = p.z - (o.z + az * u);
        if (ex * ex + ez * ez < 1.3) inp.jump = true;
      }
    }
    // 내리막 둔턱 앞에서는 속도를 줄임
    for (const o of sim.c.objs) {
      if (o.type !== "bump" || o.force || o.used) continue;
      const gap = o.s - s.s;
      if (gap > 0 && gap < 7 && speed > o.limit - 1.6) {
        move = { x: -move.x * 0.8, z: -move.z * 0.8 };
      }
    }
    // 터널 · 눈덩이에 쫓기면 대시
    const chased = sim.c.objs.some((o) => (o.type === "chaser" && o.active) || (o.type === "tunnel" && o.active && s.s < o.front + 9));
    if (chased && p.grounded && speed > 4 && p.slideCd <= 0) inp.dash = true;
    if (sim.c.express && p.grounded && speed > 4 && p.slideCd <= 0 && (!land || (land.gapStart - i > 20 && !(land.pad && land.pad.kind === "vanish")))) inp.dash = true;
    inp.x = move.x;
    inp.z = move.z;
    // 끼었을 때
    if (speed < 0.5 && Math.abs(s.s - this.lastS) < 0.1) {
      this.stuck += 1 / 60;
      if (this.stuck > 2) {
        inp.jump = true;
        const side = Math.sin(sim.t * 2) > 0 ? 1 : -1;
        inp.x += s.rx * side;
        inp.z += s.rz * side;
      }
    } else {
      this.stuck = 0;
    }
    this.lastS = s.s;
  }
}

/** 한 스테이지를 끝까지 돌림 */
export function runBot(sim, maxSeconds = 400) {
  const bot = new Bot(sim);
  let t = 0;
  while (t < maxSeconds) {
    bot.update();
    for (let k = 0; k < 2; k += 1) sim.tick(1 / 120);
    sim.events.length = 0;
    t += 1 / 60;
    if (sim.state === "won" || sim.state === "lost" || sim.state === "delivering" || sim.state === "failing") break;
  }
  return { state: sim.state, time: sim.clock, stats: sim.stats, result: sim.result, s: sim.c.P[Math.min(sim.c.P.length - 1, sim.p.idx)].s, length: sim.c.length, why: sim.loseWhy };
}
