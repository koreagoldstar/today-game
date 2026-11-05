/* 자동 운전 봇 — 스테이지가 실제로 깰 수 있는지 재는 도구 (첫 화면 데모에도 쓴다) */
const wrap = (a) => {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
};

export class Bot {
  constructor(sim, { skill = 1, seekObjects = true } = {}) {
    this.sim = sim;
    this.skill = skill;
    this.seek = seekObjects;
    this.jumpT = 0;
    this.target = null;
    this.retarget = 0;
    this.wobble = 0;
    this.skip = new Map();
  }

  drive(dt) {
    const s = this.sim;
    const lvl = s.level;
    const heading = Math.atan2(s.fwd[0], s.fwd[2]);
    let tx;
    let tz;
    let wantSpeed = 40;
    if (s.meta.main && s.meta.main.k === "stuntScore" && lvl.ramps.length) {
      // 점프대를 차례로: 뒤쪽 줄에 선 뒤 곧게 달려 뛰고, 공중에서 한 바퀴
      const r = lvl.ramps[(this.rampI || 0) % lvl.ramps.length];
      // 방금 뛴 점프대 말고, 가장 가까운 점프대로
      const nextRamp = () => {
        let best = 0;
        let bd = 1e9;
        lvl.ramps.forEach((q, n) => {
          if (q === r) return;
          const d = Math.hypot(q.x - Math.sin(q.th) * 30 - s.pos[0], q.z - Math.cos(q.th) * 30 - s.pos[2]);
          if (d < bd) {
            bd = d;
            best = n;
          }
        });
        return best;
      };
      const fx = Math.sin(r.th);
      const fz = Math.cos(r.th);
      const dx = s.pos[0] - r.x;
      const dz = s.pos[2] - r.z;
      const along = dx * fx + dz * fz;
      const lat = Math.abs(dx * fz - dz * fx);
      if (!this.rampRun && along < -14 && along > -44 && lat < 4) this.rampRun = true;
      if (this.rampRun) {
        // 점프대 입구에 먼저 맞춘 뒤 끝까지 곧게 달린다
        tx = along < -3 ? r.x : r.x + fx * (r.l + 10);
        tz = along < -3 ? r.z : r.z + fz * (r.l + 10);
        if (along > r.l + 3 || lat > 26) {
          this.rampRun = false;
          this.rampI = nextRamp();
        }
      } else {
        const rx = lvl.shape ? lvl.shape.rx - 8 : 60;
        const rz = lvl.shape ? lvl.shape.rz - 8 : 60;
        tx = Math.max(-rx, Math.min(rx, r.x - fx * 36));
        tz = Math.max(-rz, Math.min(rz, r.z - fz * 36));
        wantSpeed = 20;
        if (Math.hypot(tx - s.pos[0], tz - s.pos[2]) < 9) this.rampRun = true;
      }
    } else if (lvl.noFinish) {
      this.retarget -= dt;
      this.chaseT = (this.chaseT || 0) + dt;
      if (this.target && this.chaseT > 5 && this.target.i != null && !this.target.def.push) {
        // 오래 못 잡으면 잠시 포기 (빙글빙글 돌지 않게)
        if (this.target.tag !== "boss") this.skip.set(this.target.i, s.time + 15);
        else {
          // 단단한 구조물: 물러났다가 속도를 내서 다시 들이받는다
          const dx = s.pos[0] - this.target.x;
          const dz = s.pos[2] - this.target.z;
          const L = Math.hypot(dx, dz) || 1;
          const rx = lvl.shape ? lvl.shape.rx - 10 : 40;
          const rz = lvl.shape ? lvl.shape.rz - 10 : 40;
          this.runTo = [Math.max(-rx, Math.min(rx, this.target.x + (dx / L) * 34)), Math.max(-rz, Math.min(rz, this.target.z + (dz / L) * 34))];
          this.runT = 3.2;
        }
        this.chaseT = 0;
        this.target = null;
      }
      if (this.runT > 0) this.runT -= dt;
      if (!this.target || this.target.state === 2 || this.target.scored || this.retarget <= 0) {
        this.retarget = 4;
        const was = this.target;
        this.target = this.pickTarget();
        if (this.target !== was) this.chaseT = 0;
      }
      if (this.runT > 0 && this.runTo) {
        tx = this.runTo[0];
        tz = this.runTo[1];
      } else if (this.target && this.target.x != null && this.target.state !== undefined) {
        tx = this.target.x;
        tz = this.target.z;
        // 앞으로만 밀리는 덤프트럭: 앞질렀으면 옆으로 돌아 뒤로 간다
        if (this.target.def.push) {
          const a = lvl.samples[Math.min(lvl.samples.length - 1, 4)];
          const fx = Math.sin(a.th);
          const fz = Math.cos(a.th);
          const dx = s.pos[0] - tx;
          const dz = s.pos[2] - tz;
          const along = dx * fx + dz * fz;
          const lat = dx * fz - dz * fx;
          if (along > -8) {
            const side = lat >= 0 ? 1 : -1;
            tx += -fx * 24 + fz * 7.5 * side;
            tz += -fz * 24 - fx * 7.5 * side;
            wantSpeed = 16;
          }
        }
      } else if (this.ramp) {
        tx = this.ramp.x;
        tz = this.ramp.z;
      } else {
        tx = 0;
        tz = 0;
      }
    } else {
      const look = Math.max(10, s.speed * 0.8 + 6);
      const i = Math.min(lvl.samples.length - 1, s.pi + Math.round(look));
      const a = lvl.samples[i];
      tx = a.x;
      tz = a.z;
      // 끊어진 구간 앞의 점프대 · 다리는 가운데로
      const c = lvl.samples[Math.min(lvl.samples.length - 1, s.pi + 3)];
      const bend = Math.abs(wrap(a.th - c.th));
      wantSpeed = bend > 0.55 ? 20 : bend > 0.3 ? 26 : 40;
      // 부술 만한 것을 살짝 노린다
      if (this.seek) {
        let best = null;
        let bd = 24;
        s.near(s.pos[0] + s.fwd[0] * 16, s.pos[2] + s.fwd[2] * 16, 14, (o) => {
          if (o.state === 2 || o.scored || o.def.plank || o.def.hurt > 0.4) return;
          const dx = o.x - s.pos[0];
          const dz = o.z - s.pos[2];
          const d = Math.hypot(dx, dz);
          const ang = Math.abs(wrap(Math.atan2(dx, dz) - heading));
          if (ang < 0.5 && d < bd) {
            bd = d;
            best = o;
          }
        });
        const bridge = lvl.objects.length && s.objects.some((o) => o.def.plank && Math.abs(o.x - s.pos[0]) + Math.abs(o.z - s.pos[2]) < 40);
        if (best && !bridge) {
          tx = tx * 0.55 + best.x * 0.45;
          tz = tz * 0.55 + best.z * 0.45;
        }
      }
    }
    // 가는 길에 점프대가 가로막으면 옆으로 돌아간다 (뒤쪽은 벽이다)
    if (lvl.shape && lvl.ramps.length && !this.rampRun) {
      for (const r of lvl.ramps) {
        const cx = r.x + (Math.sin(r.th) * r.l) / 2;
        const cz = r.z + (Math.cos(r.th) * r.l) / 2;
        const rad = r.l / 2 + r.w / 2 + 3;
        const dx = tx - s.pos[0];
        const dz = tz - s.pos[2];
        const L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((cx - s.pos[0]) * dx + (cz - s.pos[2]) * dz) / L2));
        const px = s.pos[0] + dx * t - cx;
        const pz = s.pos[2] + dz * t - cz;
        const d = Math.hypot(px, pz);
        if (d < rad && t > 0.02) {
          const nx = d > 0.5 ? px / d : -dz / Math.sqrt(L2);
          const nz = d > 0.5 ? pz / d : dx / Math.sqrt(L2);
          tx = cx + nx * (rad + 5);
          tz = cz + nz * (rad + 5);
          break;
        }
      }
    }
    const err = wrap(Math.atan2(tx - s.pos[0], tz - s.pos[2]) - heading);
    // err 양수 = 왼쪽(+X 쪽)으로 돌아야 함 → steer 음수
    const steer = Math.max(-1, Math.min(1, -err * 2.6));
    const inp = s.input;
    const airborne = s.contacts === 0;
    inp.steer = airborne ? 0 : steer;
    if (airborne && s.air && s.meta.main && s.meta.main.k === "stuntScore") {
      // 공중 회전: 충분히 높을 때 ¾ 바퀴 이상 돌고 멈춘다
      if (Math.abs(s.air.yaw) < 5.5 && s.pos[1] - lvl.height(s.pos[0], s.pos[2]) > 1.6) inp.steer = 1;
    }
    if (airborne) {
      inp.throttle = 0;
      inp.brake = 0;
    } else if (s.speed > wantSpeed || (Math.abs(err) > 1.1 && s.speed > 12)) {
      inp.throttle = 0;
      inp.brake = 1;
    } else {
      inp.throttle = 1;
      inp.brake = 0;
    }
    inp.boost = !airborne && Math.abs(err) < 0.3 && s.boost > 0.15 && s.speed < wantSpeed;
    if (this.rampRun && !airborne) inp.boost = Math.abs(err) < 0.5 && s.boost > 0.05;
    inp.jump = false;
    // 끼었으면 사람처럼 잠깐 후진
    if (!airborne && inp.throttle > 0 && s.speed < 2.2 && !s.pushing) this.slowT = (this.slowT || 0) + dt;
    else this.slowT = Math.max(0, (this.slowT || 0) - dt * 2);
    if (this.slowT > 1) {
      this.slowT = 0;
      this.backT = 1.4;
    }
    if (this.backT > 0) {
      this.backT -= dt;
      inp.throttle = 0;
      inp.brake = 1;
      inp.boost = false;
      inp.steer = -steer;
    }
  }

  pickTarget() {
    const s = this.sim;
    const lvl = s.level;
    const main = s.meta.main || {};
    let best = null;
    let bd = 1e9;
    for (const o of s.objects) {
      if (o.state === 2 || o.scored || o.def.plank) continue;
      if ((this.skip.get(o.i) || 0) > s.time) continue;
      if (o.y - lvl.height(o.x, o.z) > 4.5) continue;
      let d = Math.hypot(o.x - s.pos[0], o.z - s.pos[2]);
      if (o.tag === "boss" || o.def.push) d *= 0.5;
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }
}
