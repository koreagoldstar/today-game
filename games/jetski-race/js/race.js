/*
 * 제트스키 썬더 레이스 · 레이스 (물리 · 경쟁자 AI · 이벤트)
 *
 *  흐름: intro → count(3·2·1) → race → finish(결승 통과 후 잠깐) → done
 *  레이서는 모두 같은 물리로 달린다. 경쟁자는 레이싱 라인을 따라가며 장애물을 피하고
 *  부스터를 노리고, 성격(지름길 · 욕심 · 실수)이 서로 다르다.
 */
import { clamp, lerp, rand, sign } from "./view.js?v=2";
import { SEG } from "./track.js?v=2";
import { Ring } from "./fx.js?v=2";
import { RACERS, RIVAL_ORDER, BONUS } from "./data.js?v=2";

const G = 24; // 오락실 중력 (빨리 떨어져 경쾌하게)
const CF = 1.0; // 원심력
const COUNT_STEP = 0.9;

/** 경쟁자 성격 */
const PERSONA = {
  sharky: { lane: 0.35, greed: 0.5, risk: 0.75, mistake: 0.08, boostStyle: "early", react: 0.18 },
  ruby: { lane: -0.4, greed: 0.85, risk: 0.3, mistake: 0.05, boostStyle: "late", react: 0.22 },
  crab: { lane: 0.05, greed: 0.25, risk: 0.5, mistake: 0.14, boostStyle: "random", react: 0.3, heavy: true },
  blitz: { lane: -0.1, greed: 0.6, risk: 0.9, mistake: 0.1, boostStyle: "straight", react: 0.15 },
};

export class Racer {
  constructor(def, isPlayer) {
    this.def = def;
    this.id = def.id;
    this.isPlayer = isPlayer;
    this.z = 0;
    this.x = 0;
    this.v = 0;
    this.vx = 0;
    this.Y = 0;
    this.VY = 0;
    this.air = false;
    this.airT = 0;
    this.steer = 0;
    this.boostT = 0;
    this.gauge = 0;
    this.crashT = 0;
    this.invT = 0;
    this.spin = 0;
    this.spinTotal = 0;
    this.perfectJump = false;
    this.finished = false;
    this.finishTime = 0;
    this.prevZ = 0;
    this.prevSV = 0;
    this.wake = new Ring(44);
    this.wakeT = 0;
    this.spray = 0;
    this.taken = new Set();
    this.lastPad = -1;
    this.chainT = 0;
    this.yawS = 0;
    this.wob = 0;
    this.pose = { t: 0, yaw: 0, roll: 0, lean: 0, crouch: 0, boost: 0, spin: 0, speed: 0, air: false };
    this.ai = null;
    this.startDelay = 0;
    this.offT = 0;
  }
}

export class Race {
  /**
   * opts: { course, track, fx, audio, save, events(name, data) }
   */
  constructor({ course, track, fx, audio, events, demo = false }) {
    this.course = course;
    this.track = track;
    this.fx = fx;
    this.audio = audio;
    this.events = events || (() => {});
    this.demo = demo;
    this.vmax = course.vmax || 33;
    this.vboost = this.vmax * 1.33;
    this.clock = 0;
    this.t = 0; // 출발 후 시간 (내가 결승하면 멈춘다 — 화면 기록)
    this.tRun = 0; // 내가 결승한 뒤에도 계속 흐르는 시간 (경쟁자 결승 기록용)
    this.state = demo ? "race" : "intro";
    this.stateT = 0;
    this.countN = 3;
    this.racers = [];
    this.bonus = 0;
    this.stats = { perfectStart: false, overtakes: 0, perfectLandings: 0, boostChains: 0, crashes: 0, maxCombo: 0, jumps: 0 };
    this.combo = 0;
    this.comboT = 0;
    this.earlyTap = false;
    this.goAt = 0;
    this.finishT = 0;
    this._near = [];
    // 출발 대열: 경쟁자는 앞쪽에, 나는 맨 뒤 가운데
    const player = new Racer(RACERS.jihyeok, !demo);
    player.z = 2;
    player.x = 0;
    this.player = player;
    this.racers.push(player);
    const grid = [
      [9, -4.2],
      [9, 4.2],
      [15.5, -1.8],
      [15.5, 2.6],
    ];
    RIVAL_ORDER.forEach((id, i) => {
      const r = new Racer(RACERS[id], false);
      r.z = grid[i][0];
      r.x = grid[i][1];
      const skill = (course.rivals || [0.9, 0.92, 0.94, 0.96])[i];
      r.ai = { ...PERSONA[id], skill, tx: r.x, split: {}, dodge: 0, nextBoost: rand(4, 9), thinkT: 0, wobble: rand(0, 6) };
      r.startDelay = rand(0.05, 0.35);
      this.racers.push(r);
    });
    if (demo) {
      // 메뉴 배경용: 모두 자동 주행
      player.ai = { ...PERSONA.sharky, lane: 0, skill: 0.92, tx: 0, split: {}, dodge: 0, nextBoost: 5, thinkT: 0, wobble: 1 };
      for (const r of this.racers) r.v = this.vmax * 0.75;
    }
    for (const r of this.racers) r.Y = track.heightAt(r.z);
  }

  get playerPlace() {
    return this.places().indexOf(this.player) + 1;
  }

  places() {
    const arr = this.racers.slice();
    arr.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.z - a.z;
    });
    return arr;
  }

  /* ================================================================
   * 갱신
   * ============================================================== */
  update(dt, input) {
    this.clock += dt;
    this.stateT += dt;
    const p = this.player;
    // ---- 상태 ----
    if (this.state === "intro") {
      if (this.stateT > 1.1) this.setState("count");
    } else if (this.state === "count") {
      const n = 3 - Math.floor(this.stateT / COUNT_STEP);
      if (n !== this.countN && n >= 1) {
        this.countN = n;
        this.events("count", { n });
      }
      if (this.stateT >= COUNT_STEP * 3) {
        this.setState("race");
        this.goAt = this.clock;
        this.events("go", {});
      }
      // 너무 일찍 누르면 퍼펙트 스타트 실패
      if (input && input.tapped && this.stateT > COUNT_STEP * 3 - 0.75 && this.stateT < COUNT_STEP * 3 - 0.16) this.earlyTap = true;
      if (input && input.tapped && this.stateT >= COUNT_STEP * 3 - 0.16 && !this.earlyTap) this.tryPerfectStart(p);
    } else if (this.state === "race" || this.state === "finish") {
      if (this.state === "race" || this.demo) this.t += dt;
      if (input && input.tapped && this.clock - this.goAt < 0.3 && !this.earlyTap && !this.stats.perfectStart) this.tryPerfectStart(p);
      if (this.state === "finish" && this.stateT > 2.6) this.setState("done");
    }
    if (this.state === "race" || this.demo) this.tRun = this.t;
    else if (this.state === "finish" || this.state === "done") this.tRun += dt;
    this.track.time = this.clock;
    const racing = this.state === "race" || this.state === "finish" || this.state === "done";
    if (!this.demo) this.watchHazards();
    // ---- 레이서 ----
    for (const r of this.racers) {
      r.prevZ = r.z;
      if (r.isPlayer && this.state === "race") this.controlPlayer(r, dt, input);
      else if (r.ai) this.think(r, dt);
      else this.autopilot(r, dt);
      this.physics(r, dt, racing && this.clock - this.goAt > r.startDelay);
    }
    if (racing) this.checkOvertakes();
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    if (s === "count") {
      this.countN = 3;
      this.events("count", { n: 3 });
    }
    if (s === "done") this.events("done", {});
  }

  tryPerfectStart(p) {
    if (this.stats.perfectStart || this.demo) return;
    this.stats.perfectStart = true;
    p.boostT = Math.max(p.boostT, 1.1);
    p.gauge = Math.min(3, p.gauge + 0.5);
    this.addBonus(BONUS.perfectStart);
    this.events("perfectStart", { r: p });
  }

  addBonus(n) {
    this.bonus += n;
  }

  /** 내 제트스키: 입력 → 조향 · 부스트 */
  controlPlayer(r, dt, input) {
    const want = input ? input.steer : 0;
    r.steer = lerp(r.steer, want, Math.min(1, dt * 12));
    if (input && input.boost) this.useBoost(r);
  }

  /** 결승 후 내 제트스키는 자동으로 천천히 */
  autopilot(r, dt) {
    r.steer = lerp(r.steer, clamp(-r.x * 0.15, -0.5, 0.5), Math.min(1, dt * 4));
  }

  useBoost(r) {
    if (r.gauge < 1 || r.air) return false;
    r.gauge -= 1;
    const was = r.boostT > 0.2;
    r.boostT = Math.min(3.2, Math.max(r.boostT, 0) + 1.6);
    if (r.isPlayer) {
      if (was && r.chainT <= 0) this.boostChain(r);
      this.events("boost", { r, src: "gauge" });
    }
    return true;
  }

  boostChain(r) {
    r.chainT = 2.5;
    this.stats.boostChains++;
    this.addBonus(BONUS.boostChain);
    this.events("boostChain", { r });
  }

  /* ---------------- 물리 ---------------- */
  physics(r, dt, go) {
    const tr = this.track;
    const seg = tr.segAt(r.z);
    const hw = tr.hwAt(r.z);
    const sp01 = clamp(r.v / this.vmax, 0, 1.4);
    if (r.boostT > 0) r.boostT -= dt;
    if (r.chainT > 0) r.chainT -= dt;
    if (r.invT > 0) r.invT -= dt;
    if (r.crashT > 0) r.crashT -= dt;
    // ---- 앞으로 ----
    let target = go ? this.vmax : 0;
    if (r.ai) target *= this.rubber(r);
    const off = Math.abs(r.x) > hw + 1 && !tr.splitAt(r.z);
    if (off) {
      target *= 0.66;
      r.offT += dt;
    } else r.offT = 0;
    const cur = tr.currentAt(r.z, r.x);
    target *= cur;
    // 파도 타기: 파도 앞면을 타고 내려가면 빨라지고, 오를 때는 조금 느려진다
    if (!r.air && tr.waves.length && go) {
      const sl = (tr.heightAt(r.z + 1) - tr.heightAt(r.z - 1)) / 2;
      target += clamp(-sl * 30, -3.5, 6);
    }
    if (r.boostT > 0 && go) target = Math.max(target, this.vboost);
    if (r.crashT > 0) target = Math.min(target, this.vmax * 0.42);
    if (r.finished && r.isPlayer) target = this.vmax * 0.55;
    if (!r.air) {
      // 빠른 물살에 올라타면 곧바로 실려 간다
      const rate = r.boostT > 0 ? 2.6 : cur > 1.01 ? 1.9 : 0.62;
      if (r.v < target) r.v += (target - r.v) * rate * dt + (go ? 4 * dt : 0) * (r.v < 8 ? 1 : 0);
      else r.v -= (r.v - target) * (off ? 2.4 : 1.1) * dt;
    }
    r.v = Math.max(0, r.v);
    // ---- 옆으로 ----
    const latMax = 6.5 + 4.5 * clamp(sp01, 0, 1);
    let steer = r.crashT > 0.45 ? 0 : r.steer;
    if (r.air) steer *= 0.35;
    const vxT = steer * latMax;
    const grip = tr.slips.length ? tr.gripAt(r.z) : 1;
    r.vx += (vxT - r.vx) * Math.min(1, dt * (r.air ? 2 : 7 * grip));
    // 옆바람: 공중에서는 더 많이 밀린다
    if (tr.winds.length) r.x += tr.windAt(r.z) * dt * (r.air ? 1.5 : 1);
    // 원심력 (물 위에서만 강하게)
    const curve = seg.curve;
    r.x -= curve * r.v * r.v * CF * dt * (r.air ? 0.4 : 1);
    r.x += r.vx * dt;
    // 벽 (해적선 · 절벽 사이 좁은 해협)
    if (seg.wall && Math.abs(r.x) > hw + seg.wall) {
      r.x = sign(r.x) * (hw + seg.wall);
      if (r.vx * sign(r.x) > 0) r.vx = -sign(r.x) * 4;
      if (r.invT <= 0) this.bump(r, { x: sign(r.x) * (hw + seg.wall + 2), z: r.z, type: "wall" }, -sign(r.x));
    }
    // 코스 밖 한계
    const lim = hw + 9;
    if (Math.abs(r.x) > lim) {
      r.x = sign(r.x) * lim;
      r.vx *= -0.3;
      r.v *= 0.985;
    }
    // ---- 앞으로 이동 ----
    r.z += r.v * dt;
    // ---- 위아래 (파도 · 점프대) ----
    const wy = tr.heightAt(r.z);
    // 물 표면이 오르내리는 속도 (점프대 위에 있어도 물 높이로만 계산)
    const sv = (wy - (r.wyPrev == null ? wy : r.wyPrev)) / Math.max(dt, 1e-3);
    r.wyPrev = wy;
    if (r.air) {
      r.airT += dt;
      r.VY -= G * dt;
      r.Y += r.VY * dt;
      // 공중 회전 (퍼펙트 점프: 한 바퀴 배럴 롤)
      if (r.spinTotal) {
        const k = clamp(r.airT / r.airPlan, 0, 1);
        r.spin = r.spinTotal * (k < 1 ? 1 - Math.pow(1 - k, 2.2) : 1);
      }
      if (r.Y <= wy) this.land(r, wy, sv);
    } else {
      r.Y = wy;
      // 파도 마루를 빠르게 넘으면 날아오른다
      if (r.v > 18 && r.onRamp !== -2 && !this.onRampNow(r) && r.prevSV - sv > G * dt * 1.3 && r.prevSV > 2.4) {
        this.launch(r, r.prevSV, false, false);
      } else r.VY = sv;
      r.prevSV = sv;
    }
    // ---- 물건 ----
    if (go || this.demo) this.touch(r, dt);
    // ---- 결승 ----
    if (!r.finished && r.z >= tr.length && (this.state === "race" || this.state === "finish" || this.state === "done" || this.demo)) {
      r.finished = true;
      r.finClock = this.clock;
      r.finPlace = this.racers.filter((q) => q.finished).length;
      r.finishTime = this.tRun - ((r.z - tr.length) / Math.max(1, r.v));
      if (r.isPlayer) this.playerFinished();
    }
    // ---- 항적 · 물보라 · 자세 ----
    r.wakeT -= dt;
    if (r.wakeT <= 0 && r.v > 3) {
      r.wakeT = 0.05;
      r.wake.push(r.z, r.x, this.clock, r.air);
    }
    this.emitSpray(r, dt);
    this.pose(r, dt, latMax);
  }

  /** 지금 점프대 경사면 위인가 (파도 마루 점프와 겹치지 않게) */
  onRampNow(r) {
    return r.onRamp != null && r.onRamp >= 0;
  }

  rubber(r) {
    if (this.demo) return 1;
    const p = this.player;
    const d = r.z - p.z;
    const late = clamp(p.z / this.track.length, 0, 1);
    const k = 1 - late * 0.6; // 막판엔 고무줄을 약하게 (공정하게)
    let m = r.ai.skill;
    if (d > 0) m *= 1 - clamp(d / 260, 0, 1) * 0.07 * k;
    else m *= 1 + clamp(-d / 220, 0, 1) * 0.06 * k;
    return m;
  }

  launch(r, vy, ramp, perfect) {
    r.air = true;
    r.airT = 0;
    r.VY = vy;
    r.perfectJump = perfect;
    r.airPlan = Math.max(0.3, (2 * vy) / G);
    r.spinTotal = perfect ? Math.PI * 2 * (r.x < 0 ? -1 : 1) : 0;
    r.spin = 0;
    if (ramp && r.isPlayer) {
      this.stats.jumps++;
      this.events("jump", { r, perfect });
    }
  }

  land(r, wy, sv) {
    const impact = Math.max(0, -(r.VY - sv));
    r.air = false;
    r.Y = wy;
    r.VY = sv;
    r.prevSV = sv;
    r.spin = 0;
    const perfect = r.perfectJump;
    r.perfectJump = false;
    r.spinTotal = 0;
    const power = clamp(impact / 9, 0.6, 2.4);
    this.fx.splash(r.x, wy, r.z - 0.6, power, r.v * 0.55);
    r.landT = 0.35;
    if (perfect) {
      r.boostT = Math.max(r.boostT, 0.9);
      r.gauge = Math.min(3, r.gauge + 0.5);
      if (r.isPlayer) {
        this.stats.perfectLandings++;
        this.addBonus(BONUS.perfectLanding);
      }
    } else if (impact > 7) r.v *= 0.96;
    if (r.isPlayer) this.events("land", { r, perfect, power });
  }

  /** 부딪힘 · 부스터 · 점프대 · 갈림길 섬 */
  touch(r, dt) {
    const tr = this.track;
    const list = tr.objsBetween(r.prevZ, r.z, this._near);
    const height = r.Y - tr.heightAt(r.z);
    for (const o of list) {
      let ox = o.x;
      if (o.move) ox += Math.sin(this.clock * o.move.speed + o.z) * o.move.amp;
      const dx = r.x - ox;
      if (o.pad) {
        if (Math.abs(dx) < o.r + 0.3 && r.z > o.z - o.d && r.z < o.z + o.d + 1 && !r.air && r.lastPad !== o.id) {
          r.lastPad = o.id;
          const was = r.boostT > 0.15;
          r.boostT = Math.max(r.boostT, 1.2);
          if (r.isPlayer) {
            if (was && r.chainT <= 0) this.boostChain(r);
            this.events("boost", { r, src: "pad" });
          }
        }
        continue;
      }
      if (o.lightGate) {
        if (r.taken.has(o.id)) continue;
        if (Math.abs(dx) < o.r && Math.abs(r.z - o.z) < 1.6) {
          r.taken.add(o.id);
          r.gauge = Math.min(3, r.gauge + 0.5);
          if (r.isPlayer) this.events("lightGate", { r, gauge: r.gauge });
        }
        continue;
      }
      if (o.hazard) {
        if (r.invT > 0 || Math.abs(dx) > o.r + 0.5 || Math.abs(r.z - o.z) > o.d + 1.2) continue;
        const hs = tr.hazardState(o);
        if (hs.st !== "strike") continue;
        if (o.hazard === "geyser" && r.air && height > 3) continue;
        if (o.hazard === "tentacle" && r.air && height > 2.2) continue;
        this.crash(r, o, dx);
        if (r.isPlayer) this.events("hazardHit", { r, o });
        continue;
      }
      if (o.orb) {
        if (r.taken.has(o.id)) continue;
        // 공중 구슬은 점프해서 그 높이로 지나가야 먹는다
        if (o.h && Math.abs(height - o.h) > 1.7) continue;
        if (Math.abs(dx) < o.r + 0.5 && Math.abs(r.z - o.z) < 1.6) {
          r.taken.add(o.id);
          if (r.gauge < 3) r.gauge = Math.min(3, r.gauge + 0.5);
          if (r.isPlayer) {
            o.gone = true;
            this.fx.sparkles(ox, tr.heightAt(o.z), o.z, 10);
            this.events("orb", { r, gauge: r.gauge });
          }
        }
        continue;
      }
      if (o.ramp) {
        if (r.air) continue;
        const z0 = o.z - o.d;
        const z1 = o.z + o.d;
        if (Math.abs(dx) < o.r && r.z > z0 && r.z <= z1) {
          // 경사면을 오른다
          const u = (r.z - z0) / (z1 - z0);
          r.Y = tr.heightAt(r.z) + o.top * u;
          r.onRamp = o.id;
        } else if (r.onRamp === o.id && r.z > z1) {
          r.onRamp = -1;
          const perfect = Math.abs(dx) < (o.big ? 1.1 : 0.9);
          const vy = r.v * (o.big ? 0.4 : 0.31) + (r.boostT > 0 ? 2.2 : 0);
          r.Y = tr.heightAt(r.z) + o.top;
          this.launch(r, vy, true, perfect);
        }
        continue;
      }
      if (!o.solid) continue;
      // 점프로 넘어가면 통과!
      if (r.air && height > o.top * 0.9) continue;
      if (Math.abs(dx) < o.r + 0.55 && Math.abs(r.z - o.z) < o.d + 1.2) {
        if (r.invT > 0) continue;
        if (o.kind === "bump") this.bump(r, o, dx);
        else this.crash(r, o, dx);
      }
    }
    // 갈림길 가운데 섬
    const dv = tr.dividerAt(r.z);
    if (dv && dv.w > 0.5) {
      const d = r.x - dv.cx;
      if (Math.abs(d) < dv.w + 0.5 && (!r.air || height < 1.5)) {
        r.x = dv.cx + sign(d || 1) * (dv.w + 0.55);
        if (r.invT <= 0) this.crash(r, { x: dv.cx, z: r.z, type: "island" }, d);
      }
    }
  }

  bump(r, o, dx) {
    r.invT = 0.5;
    r.bumpT = 0.4;
    r.hitDir = sign(dx || 1);
    r.v *= 0.82;
    r.vx = sign(dx || 1) * 7;
    r.x += sign(dx || 1) * 0.4;
    this.fx.splash(o.x, this.track.heightAt(o.z), o.z, 0.7);
    if (r.isPlayer) this.events("bump", { r, o });
  }

  crash(r, o, dx) {
    r.invT = 1.3;
    r.crashT = 0.75;
    r.hitDir = sign(dx || 1);
    r.v *= 0.5;
    r.vx = sign(dx || 1) * 6;
    r.boostT = 0;
    this.fx.splash(r.x, this.track.heightAt(r.z), r.z, 1.2, r.v * 0.3);
    if (r.isPlayer) {
      this.stats.crashes++;
      this.combo = 0;
      this.comboT = 0;
      this.events("crash", { r, o });
    }
  }

  /** 화면에 보이는 번개 · 증기가 터지는 순간을 알려 준다 (소리 · 번쩍) */
  watchHazards() {
    const p = this.player;
    const list = this.track.objsBetween(p.z - 8, p.z + 160, this._hz || (this._hz = []));
    for (const o of list) {
      if (!o.hazard) continue;
      const st = this.track.hazardState(o).st;
      if (st !== o._st) {
        if (st === "strike") this.events("strike", { o, dist: o.z - p.z });
        else if (st === "warn") this.events("warn", { o, dist: o.z - p.z });
        o._st = st;
      }
    }
  }

  /* ---------------- 경쟁자 AI ---------------- */
  think(r, dt) {
    const ai = r.ai;
    const tr = this.track;
    ai.thinkT -= dt;
    if (ai.thinkT <= 0) {
      ai.thinkT = ai.react * rand(0.7, 1.3);
      ai.tx = this.plan(r);
    }
    // 조향: 목표 x 로 + 원심력 미리 상쇄
    const latMax = 6.5 + 4.5 * clamp(r.v / this.vmax, 0, 1);
    const seg = tr.segAt(r.z);
    const ff = seg.curve * r.v * r.v * CF;
    ai.wobble += dt;
    const wob = Math.sin(ai.wobble * 1.3) * 0.08;
    const want = clamp(((ai.tx - r.x) * 1.5 + ff) / latMax + wob, -1, 1);
    r.steer = lerp(r.steer, want, Math.min(1, dt * 6));
    // 부스트 쓰기
    if (r.gauge >= 1 && !r.air && this.state !== "intro" && this.state !== "count") {
      ai.nextBoost -= dt;
      const straight = Math.abs(this.curveAhead(r.z, 60)) < 0.0025;
      const late = r.z / tr.length;
      let use = false;
      if (ai.boostStyle === "late") use = late > 0.72 && straight;
      else if (ai.boostStyle === "straight") use = straight && ai.nextBoost <= 0;
      else if (ai.boostStyle === "early") use = ai.nextBoost <= 0;
      else use = ai.nextBoost <= 0 && Math.random() < dt * 2;
      if (use) {
        this.useBoost(r);
        ai.nextBoost = rand(3, 8);
      }
    }
  }

  curveAhead(z, len) {
    let c = 0;
    let n = 0;
    for (let d = 8; d <= len; d += SEG) {
      c += this.track.curveAt(z + d);
      n++;
    }
    return n ? c / n : 0;
  }

  /** 목표 x 정하기: 레이싱 라인 → 갈림길 → 줍기 → 피하기 */
  plan(r) {
    const ai = r.ai;
    const tr = this.track;
    const hw = tr.hwAt(r.z + 20);
    const k = this.curveAhead(r.z, 70);
    let tx = clamp(k * 1100, -hw * 0.55, hw * 0.55) + ai.lane * hw * 0.55;
    // 갈림길
    let inSplit = null;
    for (const s of tr.splits) {
      if (r.z > s.z0 - 70 && r.z < s.z1) {
        inSplit = s;
        if (ai.split[s.z0] == null) ai.split[s.z0] = Math.random() < ai.risk ? s.side : s.side === "right" ? "left" : "right";
        const sd = ai.split[s.z0] === "right" ? 1 : -1;
        const hwS = tr.hwAt(s.z0 + (s.z1 - s.z0) / 2);
        tx = s.cx + sd * (s.dw + (hwS - s.dw) * 0.5) + ai.lane * 2;
      }
    }
    // 앞의 물건
    const LA = 30 + r.v * 0.9;
    const list = tr.objsBetween(r.z + 3, r.z + LA, this._near);
    for (const o of list) {
      if (o.z < r.z + 2) continue;
      if ((o.pad || (o.orb && !o.h) || o.ramp || o.lightGate) && !((o.orb || o.lightGate) && r.taken.has(o.id))) {
        const near = Math.abs(o.x - tx) < (o.ramp ? 6 : 4.5);
        if (near && (o.ramp || Math.random() < ai.greed)) tx = o.x + (o.ramp ? rand(-0.5, 0.5) : 0);
      }
    }
    for (const o of list) {
      const danger = o.solid || (o.hazard && tr.hazardState(o).st !== "idle");
      if (!danger || o.z < r.z + 2) continue;
      const gap = o.r + 1.9;
      if (Math.abs(o.x - tx) < gap) {
        if (Math.random() < ai.mistake * 0.5) continue; // 가끔 못 피한다
        const left = o.x - gap;
        const right = o.x + gap;
        tx = Math.abs(left - r.x) < Math.abs(right - r.x) ? left : right;
      }
    }
    const lim = inSplit ? tr.hwAt(r.z + 20) - 1 : hw - 1;
    return clamp(tx, -lim, lim);
  }

  /* ---------------- 추월 ---------------- */
  checkOvertakes() {
    const p = this.player;
    if (p.finished) return;
    for (const r of this.racers) {
      if (r === p) continue;
      r.ovCD = (r.ovCD || 0) - 1 / 60;
      if (p.prevZ <= r.prevZ && p.z > r.z && (r.ovCD || 0) <= 0) {
        r.ovCD = 2.5;
        this.combo = this.comboT > 0 ? this.combo + 1 : 1;
        this.comboT = 4;
        this.stats.overtakes++;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
        this.addBonus(BONUS.overtake * this.combo);
        p.gauge = Math.min(3, p.gauge + 0.2);
        this.events("overtake", { r, combo: this.combo, points: BONUS.overtake * this.combo });
      }
    }
  }

  playerFinished() {
    const p = this.player;
    if (this.stats.crashes === 0) this.addBonus(BONUS.noCrash);
    this.setState("finish");
    p.ai = null;
    this.events("finish", { time: p.finishTime, place: this.playerPlace });
  }

  /** 결과 계산: 아직 못 들어온 경쟁자는 남은 거리로 예상 기록 */
  results() {
    const L = this.track.length;
    for (const r of this.racers) {
      if (!r.finished) r.finishTime = this.tRun + (L - r.z) / Math.max(10, r.v || this.vmax * 0.8);
    }
    const arr = this.racers.slice().sort((a, b) => a.finishTime - b.finishTime);
    return arr.map((r, i) => ({ id: r.id, def: r.def, time: r.finishTime, place: i + 1, isPlayer: r.isPlayer }));
  }

  /* ---------------- 물보라 · 자세 ---------------- */
  emitSpray(r, dt) {
    const fx = this.fx;
    const sp = clamp(r.v / this.vmax, 0, 1.4);
    const dz = r.z - (this.camZ || r.z - 6);
    // 멀리 있는 경쟁자는 적게 (화면에 작게 보이니까)
    const lod = r.isPlayer ? 1 : dz > 150 ? 0 : dz > 60 ? 0.35 : 0.7;
    if (lod <= 0 || r.v < 3) return;
    const q = fx.quality * lod;
    if (r.air) {
      if (Math.random() < dt * 20 * q) fx.spawn({ kind: 0, x: r.x + rand(-0.4, 0.4), y: r.Y + 0.1, z: r.z - rand(0, 1), vx: 0, vy: -1, vz: r.v * 0.9, r: rand(0.05, 0.09), life: 0.6, g: 14, a: 0.9, c: "#dff6ff" });
      return;
    }
    const boost = r.boostT > 0 ? 1 : 0;
    // 뒤로 솟는 물기둥 (rooster tail)
    r.spray += dt * (28 + sp * 70 + boost * 90) * q;
    while (r.spray >= 1) {
      r.spray -= 1;
      const big = Math.random() < 0.3 + boost * 0.2;
      fx.spawn({
        kind: big ? 1 : 0,
        x: r.x + rand(-0.22, 0.22),
        y: r.Y + 0.25,
        z: r.z - 1.2,
        vx: rand(-0.9, 0.9) + r.vx * 0.25,
        vy: rand(2.2, 4.6) * (0.55 + sp * 0.5) + boost * rand(1.5, 3),
        vz: r.v * rand(0.35, 0.62),
        r: big ? rand(0.13, 0.24) * (1 + boost * 0.5) : rand(0.035, 0.08),
        grow: big ? 1.6 : 0,
        life: rand(0.45, 0.8),
        g: 13,
        a: big ? 0.5 : 0.95,
        c: big ? "rgba(255,255,255,0.9)" : Math.random() < 0.3 ? "#c6f1ff" : "#ffffff",
      });
    }
    // 꺾을 때 바깥으로 튀는 물보라 (카빙)
    const carve = Math.abs(r.vx);
    if (carve > 2.2 && Math.random() < dt * carve * 7 * q) {
      const sd = -sign(r.vx);
      for (let i = 0; i < 2; i++)
        fx.spawn({ kind: i ? 1 : 0, x: r.x + sd * 0.65, y: r.Y + 0.15, z: r.z - rand(0.2, 1), vx: sd * rand(2.5, 5.5), vy: rand(1.4, 3.4), vz: r.v * 0.75, r: i ? rand(0.2, 0.32) : rand(0.05, 0.1), grow: i ? 1.2 : 0, life: rand(0.35, 0.6), g: 12, a: i ? 0.5 : 0.95, c: "#ffffff" });
    }
    // 뱃머리 하얀 물살
    if (Math.random() < dt * 22 * sp * q) {
      const sd = Math.random() < 0.5 ? -1 : 1;
      fx.spawn({ kind: 1, x: r.x + sd * 0.7, y: r.Y + 0.05, z: r.z + 0.6, vx: sd * rand(0.8, 1.6), vy: rand(0.4, 1.2), vz: r.v * 0.92, r: rand(0.12, 0.22), grow: 1.5, life: 0.4, g: 6, a: 0.6, c: "rgba(255,255,255,0.9)" });
    }
  }

  pose(r, dt, latMax) {
    const ps = r.pose;
    const st = clamp(r.vx / latMax, -1, 1);
    r.yawS = lerp(r.yawS, st, Math.min(1, dt * 8));
    let wob = 0;
    if (r.crashT > 0) wob = Math.sin(this.clock * 26) * 0.25 * (r.crashT / 0.85);
    if (r.landT > 0) r.landT -= dt;
    ps.t = this.clock + (r.isPlayer ? 0 : r.def.no * 0.37);
    ps.yaw = r.yawS * 0.85 + wob * 2;
    ps.roll = r.yawS * 0.2 + wob + (r.air ? 0 : Math.sin(this.clock * 3.1 + r.z * 0.1) * 0.02);
    ps.lean = r.yawS * 0.12;
    ps.crouch = r.air ? 0.6 : r.landT > 0 ? r.landT / 0.35 : r.boostT > 0 ? 0.35 : 0;
    ps.boost = r.boostT > 0 ? 1 : 0;
    ps.spin = r.spin || 0;
    ps.speed = clamp(r.v / this.vmax, 0, 1.3);
    ps.air = r.air;
    // 레이서 몸동작 (그림에만 쓰는 값 — art/rider.js)
    ps.steer = r.yawS;
    const bOn = r.boostT > 0;
    if (bOn && !r.boostWas) r.kickT = 1;
    r.boostWas = bOn;
    r.kickT = Math.max(0, (r.kickT || 0) - dt * 3.2);
    ps.kick = r.kickT;
    ps.boostK = lerp(ps.boostK || 0, bOn ? 1 : 0, Math.min(1, dt * (bOn ? 9 : 3.5)));
    ps.airS = lerp(ps.airS || 0, r.air ? 1 : 0, Math.min(1, dt * 12));
    ps.airK = r.air ? clamp(r.airT / (r.airPlan || 0.6), 0, 1) : 1;
    ps.land = r.landT > 0 ? r.landT / 0.35 : 0;
    ps.hit = r.crashT > 0 ? r.crashT / 0.75 : 0;
    if (r.bumpT > 0) r.bumpT -= dt;
    ps.bump = r.bumpT > 0 ? r.bumpT / 0.4 : 0;
    ps.hitDir = r.hitDir || 1;
    ps.fin = r.finished ? this.clock - r.finClock : -1;
    ps.place = r.finPlace || 0;
  }
}
