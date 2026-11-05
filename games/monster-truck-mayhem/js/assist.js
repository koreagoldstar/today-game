/* 운전 도우미: 휴대폰처럼 정밀하게 조작하기 어려울 때 방향을 살짝 거들어 준다.
 * 플레이어가 꺾는 쪽이 항상 먼저다. 손을 뗐을 때 길을 따라가고, 벽에 박히기 전에 돌려 주고,
 * 점프대가 코앞이면 가운데로 맞춰 준다. */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
};
/** 오른쪽 조향이 +1 이고, 목표가 왼쪽(+X 쪽)이면 각도 차이가 양수다 */
const steerTo = (err) => -err;

export class DriveAssist {
  constructor(sim) {
    this.sim = sim;
    this.help = 0;
    this.slowT = 0;
    this.backT = 0;
    this.backSteer = 0;
  }

  /** 벽이나 물체에 코를 박고 멈추면 스스로 잠깐 후진한다. 후진 중이면 조향값(0 아님)을 돌려준다 */
  unstick(dt) {
    const s = this.sim;
    if (this.backT > 0) {
      this.backT -= dt;
      return this.backSteer;
    }
    if (s.state === "play" && s.contacts >= 2 && s.speed < 1.8 && !s.pushing) this.slowT += dt;
    else this.slowT = Math.max(0, this.slowT - dt * 2);
    if (this.slowT < 0.5) return 0;
    this.slowT = 0;
    this.backT = 1;
    const lvl = s.level;
    const heading = Math.atan2(s.fwd[0], s.fwd[2]);
    let want;
    if (!lvl.noFinish && lvl.samples.length > 1) {
      const a = lvl.samples[Math.min(lvl.samples.length - 1, s.pi + 16)];
      want = Math.atan2(a.x - s.pos[0], a.z - s.pos[2]);
    } else {
      want = Math.atan2(-s.pos[0], -s.pos[2]);
    }
    // 뒤로 갈 때는 조향이 반대로 먹는다: 코가 가야 할 쪽으로 돌게
    this.backSteer = wrap(want - heading) >= 0 ? 1 : -1;
    return this.backSteer;
  }

  /** 앞의 굽이가 급하면 속도를 줄인다. 0 = 그대로, 0~1 = 브레이크 세기, -1 = 가속만 뗀다 */
  corner() {
    const s = this.sim;
    const lvl = s.level;
    if (lvl.noFinish || !s.contacts || s.boosting || s.vf < 8) return 0;
    const a = lvl.samples[Math.min(lvl.samples.length - 1, s.pi + 3)];
    const b = lvl.samples[Math.min(lvl.samples.length - 1, s.pi + Math.round(s.speed * 0.9 + 8))];
    const bend = Math.abs(wrap(b.th - a.th));
    const limit = bend > 0.8 ? 16 : bend > 0.55 ? 19 : bend > 0.35 ? 22 : 99;
    if (s.vf > limit + 2) return 0.45;
    if (s.vf > limit) return -1;
    return 0;
  }

  /** 플레이어의 조향(raw)을 받아 실제 조향을 돌려준다 */
  steer(raw) {
    const s = this.sim;
    if (!s.contacts || s.state !== "play") return raw;
    const lvl = s.level;
    const heading = Math.atan2(s.fwd[0], s.fwd[2]);
    const sp = s.speed;
    const k = clamp(sp / (s.def.top || 25), 0, 1.2);
    // 후진 중에는 손대지 않는다
    if (s.vf < -1) return raw;
    // 빠를수록 덜 꺾인다 (엄지가 조금 늦어도 좌우로 휘청이지 않게)
    const player = raw * (1 - 0.45 * Math.min(1, k));
    let help = 0;
    let hard = 0;
    if (!lvl.noFinish && lvl.samples.length > 1) {
      // 길 따라가기: 앞쪽 지점을 바라본다
      const ahead = Math.round(9 + sp * 0.75);
      const a = lvl.samples[Math.min(lvl.samples.length - 1, s.pi + ahead)];
      const err = wrap(Math.atan2(a.x - s.pos[0], a.z - s.pos[2]) - heading);
      help = clamp(steerTo(err) * 1.7, -0.7, 0.7);
    }
    // 점프대가 코앞이면 가운데로 (옆면에 걸리면 재미가 없다)
    for (const r of lvl.ramps) {
      const fx = Math.sin(r.th);
      const fz = Math.cos(r.th);
      const dx = s.pos[0] - r.x;
      const dz = s.pos[2] - r.z;
      const along = dx * fx + dz * fz;
      if (along > 2 || along < -30) continue;
      const lat = dx * fz - dz * fx;
      if (Math.abs(lat) > r.w * 1.1) continue;
      if (Math.abs(wrap(r.th - heading)) > 0.9) continue;
      const aim = r.w * 0.2 + 2;
      const tx = r.x + fx * aim;
      const tz = r.z + fz * aim;
      const err = wrap(Math.atan2(tx - s.pos[0], tz - s.pos[2]) - heading);
      help = clamp(steerTo(err) * 2, -0.8, 0.8);
      break;
    }
    // 벽 앞: 벽 쪽으로 달리고 있으면 돌려 준다. 이것만은 플레이어가 꺾어도 조금 먹는다
    const fx = s.fwd[0];
    const fz = s.fwd[2];
    const fl = Math.hypot(fx, fz) || 1;
    const lookD = 5 + sp * 0.42;
    const fxN = fx / fl;
    const fzN = fz / fl;
    const off = lvl.off(s.pos[0] + fxN * lookD, s.pos[2] + fzN * lookD);
    if (off > -2.2) {
      const n = lvl.wallNormal(s.pos[0] + fxN * lookD, s.pos[2] + fzN * lookD);
      const into = -(fxN * n[0] + fzN * n[1]);
      if (into > 0.05) {
        // 벽에 수직으로 튕기면 길을 가로질러 반대쪽 벽에 박힌다. 길 방향(경기장은 벽을 따라)으로 돈다
        let dx;
        let dz;
        if (!lvl.noFinish && lvl.samples.length > 1) {
          const a = lvl.samples[Math.min(lvl.samples.length - 1, s.pi + Math.round(10 + sp * 0.6))];
          dx = a.x - s.pos[0];
          dz = a.z - s.pos[2];
        } else {
          const side = fxN * n[1] - fzN * n[0] >= 0 ? 1 : -1;
          dx = n[1] * side + n[0] * 0.35;
          dz = -n[0] * side + n[1] * 0.35;
        }
        const err = wrap(Math.atan2(dx, dz) - heading);
        hard = clamp(steerTo(err) * 2, -1, 1) * clamp((off + 2.2) / 3, 0.3, 1) * clamp(into * 2.2, 0.35, 1);
      }
    }
    // 부술 것이 정면 근처면 살짝 끌린다 (손을 뗐을 때만)
    if (Math.abs(raw) < 0.12) {
      let best = null;
      let bd = 26;
      s.near(s.pos[0] + fxN * 14, s.pos[2] + fzN * 14, 13, (o) => {
        if (o.state === 2 || o.scored || o.def.plank || (o.def.hurt || 0) > 0.3 || o.def.brk > 1e5) return;
        const dx = o.x - s.pos[0];
        const dz = o.z - s.pos[2];
        const d = Math.hypot(dx, dz);
        if (d >= bd || d < 3) return;
        const e = wrap(Math.atan2(dx, dz) - heading);
        if (Math.abs(e) > 0.32) return;
        bd = d;
        best = e;
      });
      if (best != null) help += clamp(steerTo(best) * 1.1, -0.22, 0.22);
    }
    // 합치기: 많이 꺾을수록 플레이어 몫이 커진다
    const mine = clamp(Math.abs(raw) * 1.6, 0, 1) * 0.6;
    let out = player + help * (1 - mine);
    if (hard) {
      // 벽 쪽으로 꺾고 있으면 그 힘을 줄이고 돌려 준다
      const against = Math.sign(player) === -Math.sign(hard) ? Math.abs(player) : 0;
      out = out * (1 - 0.65 * Math.abs(hard)) + hard * (0.55 + 0.45 * against);
    }
    this.help = out - raw;
    return clamp(out, -1, 1);
  }
}
