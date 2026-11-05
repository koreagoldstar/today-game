/*
 * 씨름 물리: 화면과 무관한 순수 계산 (브라우저 없이도 돈다)
 *  x 는 좌우, z 는 앞뒤(회피 때만 크게 움직임). 원 밖으로 무게중심이 나가면 패배.
 *  1/120초 고정 걸음이라 프레임과 무관하다.
 */
export const STEP = 1 / 120;
export const RING_R = 420;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function newInput() {
  return { mx: 0, dash: false, guard: false, push: 0, dodge: 0, special: 0 };
}
/** 누른 입력은 잠깐 기억했다가 한 번만 쓴다 (끊김 · 중복 방지) */
export function press(inp, key) {
  inp[key] = 0.14;
}

const CONTROL = new Set(["idle", "walk", "run"]);
const NO_FACE = new Set(["dash", "special", "knockback", "fall", "recover", "stumble", "dodge", "out", "victory", "defeat"]);

function makeFighter(def, opt = {}) {
  const P = def.power;
  const D = def.defense;
  const Sp = def.speed;
  const B = def.balance;
  const size = opt.size || 1;
  const bonus = opt.bonus || 0;
  return {
    def,
    size,
    r: 60 * size,
    mass: (0.8 + (P + D) * 0.04) * size * size,
    accel: 1500 + Sp * 150,
    grip: 900 + P * 170 + bonus * 150,
    fr: 7 * (def.slip || 1),
    pushK: 230 + P * 26 + bonus * 30,
    dashK: 300 + P * 40 + bonus * 40,
    resist: 1.3 - D * 0.055,
    regen: 6 + B * 1.4,
    specRate: 1.8 + def.special * 0.32,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    face: 1,
    state: "idle",
    stateT: 0,
    bal: 100,
    spec: 0,
    charge: 0,
    chargeT: 0,
    dashPow: 0,
    dashDir: 1,
    dashHit: false,
    pushDone: false,
    guardT: 0,
    pushCd: 0,
    dashCd: 0,
    dodgeCd: 0,
    invuln: 0,
    stun: 0,
    sinceHit: 9,
    edge: 0,
    teeter: false,
    locked: false,
    spinA: 0,
    lastHitBy: "",
    combo: 0,
    comboT: 0,
    moveAmt: 0,
    // 기록
    hits: 0,
    dashHits: 0,
    parries: 0,
    dodged: 0,
    specials: 0,
    rimTime: 0,
    touchedEdge: false,
  };
}

export class Bout {
  constructor({ a, b, world = { fr: 1, bounce: 0.62 }, need = 2, time = 30, aOpt = {}, bOpt = {}, endless = false }) {
    this.world = world;
    this.need = need;
    this.limit = time;
    this.endless = endless;
    this.f = [makeFighter(a, aOpt), makeFighter(b, bOpt)];
    this.input = [newInput(), newInput()];
    this.wins = [0, 0];
    this.round = 0;
    this.events = [];
    this.phase = "intro";
    this.phaseT = 0;
    this.time = 0;
    this.total = 0;
    this.R = RING_R;
    this.freeze = 0;
    this.winner = -1;
    this.roundWinner = -1;
    this.history = [];
    this.startRound();
  }

  /** 타임어택 · 서바이벌: 상대만 바꿔 곧바로 이어 간다 */
  setOpponent(def, opt = {}) {
    this.f[1] = makeFighter(def, opt);
    this.input[1] = newInput();
  }

  emit(t, data = {}) {
    if (this.events.length < 200) this.events.push({ t, ...data });
  }

  startRound(keepBal = false) {
    this.round += 1;
    this.phase = "intro";
    this.phaseT = 0;
    this.time = 0;
    this.R = RING_R;
    this.roundWinner = -1;
    this.f.forEach((f, i) => {
      const s = i === 0 ? -1 : 1;
      Object.assign(f, { x: s * 170, y: 0, z: 0, vx: 0, vy: 0, vz: 0, face: -s, state: "idle", stateT: 0, charge: 0, chargeT: 0, stun: 0, invuln: 0, sinceHit: 9, teeter: false, locked: false, spinA: 0, pushCd: 0, dashCd: 0, dodgeCd: 0, edge: 0, combo: 0, comboT: 0, lastHitBy: "", rimHold: 0, hopN: -1, rollTo: undefined });
      if (!keepBal) f.bal = 100;
      f.spec = Math.min(f.spec, 60);
      this.input[i] = newInput();
    });
    this.emit("round", { n: this.round });
  }

  setState(f, s) {
    f.state = s;
    f.stateT = 0;
    if (s !== "charge") f.charge = 0;
    f.pushDone = false;
    f.dashHit = false;
  }

  step(dt = STEP) {
    this.phaseT += dt;
    this.total += dt;
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    if (this.phase === "intro") {
      this.f.forEach((f) => (f.stateT += dt));
      if (this.phaseT >= 2.2) {
        this.phase = "fight";
        this.phaseT = 0;
        this.emit("fight");
      }
      return;
    }
    if (this.phase === "fight") {
      this.time += dt;
      this.updateRing();
    }
    if (this.phase === "roundEnd") {
      if (this.phaseT >= 1.5) {
        if (this.endless) return;
        if (this.wins[this.roundWinner] >= this.need) {
          this.phase = "over";
          this.phaseT = 0;
          this.winner = this.roundWinner;
          this.emit("over", { winner: this.winner });
        } else this.startRound();
      }
    }
    for (let i = 0; i < 2; i += 1) this.stepFighter(i, dt);
    if (this.phase === "fight") {
      this.collide(dt);
      this.checkOut();
    }
  }

  /** 시간이 다 되면 판이 좁아진다: 경기가 늘어지지 않고 끝에서 승부가 난다 */
  updateRing() {
    if (!this.limit) return;
    const left = this.limit - this.time;
    if (left <= 8) {
      if (!this.shrinkSaid) {
        this.shrinkSaid = true;
        this.emit("shrink");
      }
      this.R = Math.max(120, RING_R - ((8 - left) / 8) * 150 - Math.max(0, -left) * 30);
    } else {
      this.shrinkSaid = false;
    }
  }

  stepFighter(i, dt) {
    const f = this.f[i];
    const o = this.f[1 - i];
    const inp = this.input[i];
    f.stateT += dt;
    f.pushCd -= dt;
    f.dashCd -= dt;
    f.dodgeCd -= dt;
    f.invuln -= dt;
    f.sinceHit += dt;
    f.comboT -= dt;
    if (f.comboT <= 0) f.combo = 0;
    inp.push -= dt;
    inp.dodge -= dt;
    inp.special -= dt;

    if (f.state === "out") {
      f.vy -= 1500 * dt;
      f.x += f.vx * dt;
      f.z += f.vz * dt;
      f.y += f.vy * dt;
      f.spinA += f.vx * 0.012 * dt * 2.4 + (f.vx >= 0 ? 6 : -6) * dt;
      return;
    }
    if (this.phase !== "fight") {
      f.vx *= Math.exp(-6 * dt);
      f.vz *= Math.exp(-6 * dt);
      f.x += f.vx * dt;
      f.z += f.vz * dt;
      f.y = Math.max(0, f.y + f.vy * dt);
      f.vy = f.y > 0 ? f.vy - 1500 * dt : 0;
      return;
    }

    if (!NO_FACE.has(f.state)) f.face = o.x >= f.x ? 1 : -1;
    // 균형: 맞은 뒤 잠시 지나면 천천히 회복
    if (f.sinceHit > 0.9 && f.state !== "fall") f.bal = Math.min(100, f.bal + f.regen * dt * (f.state === "guard" ? 1.5 : 1));
    if (f.state !== "special") f.spec = Math.min(100, f.spec + f.specRate * dt);

    const wob = f.bal < 30 ? 0.6 + (f.bal / 30) * 0.4 : 1;
    let ax = 0;
    let fr = f.fr * this.world.fr;
    const dx = o.x - f.x;
    const dz = o.z - f.z;
    const dist = Math.hypot(dx, dz);
    switch (f.state) {
      case "idle":
      case "walk":
      case "run": {
        if (inp.special > 0 && f.spec >= 100) {
          inp.special = 0;
          f.spec = 0;
          f.specials += 1;
          this.setState(f, "special");
          f.dashDir = o.x >= f.x ? 1 : -1;
          f.face = f.dashDir;
          this.emit("special", { i, skill: f.def.skill.id });
          break;
        }
        if (inp.dodge > 0 && f.dodgeCd <= 0) {
          inp.dodge = 0;
          f.dodgeCd = 0.85;
          this.setState(f, "dodge");
          f.invuln = 0.26;
          f.vz = (f.z > 8 ? -1 : f.z < -8 ? 1 : i === 0 ? 1 : -1) * 660;
          f.vx += inp.mx * 260;
          f.vy = 280;
          this.emit("dodge", { i });
          break;
        }
        if (inp.push > 0 && f.pushCd <= 0) {
          inp.push = 0;
          this.setState(f, "push");
          f.pushCd = 0.27;
          break;
        }
        if (inp.dash && f.dashCd <= 0) {
          this.setState(f, "charge");
          f.dashDir = f.face;
          break;
        }
        if (inp.guard) {
          this.setState(f, "guard");
          f.guardT = 0;
          this.emit("guard", { i });
          break;
        }
        const m = clamp(inp.mx, -1, 1);
        ax = m * (f.locked ? f.grip : f.accel) * wob;
        const sp = Math.abs(f.vx);
        const want = Math.abs(m) < 0.1 ? "idle" : sp > (f.accel / f.fr) * 0.62 ? "run" : "walk";
        if (want !== f.state && (want !== "idle" || sp < 60)) {
          f.state = want;
          f.stateT = 0;
        }
        break;
      }
      case "push": {
        const m = clamp(inp.mx, -1, 1);
        ax = m * f.accel * 0.35;
        if (!f.pushDone && f.stateT >= 0.07) {
          f.pushDone = true;
          f.vx += f.face * 150;
          this.emit("whoosh", { i });
          if (dist <= f.r + o.r + 38 && o.y < 60) this.hit(f, o, "push", 1, dist > 0 ? dx / dist : f.face, dist > 0 ? dz / dist : 0);
        }
        if (f.stateT >= 0.24) this.setState(f, "idle");
        break;
      }
      case "charge": {
        // 모을수록 세지만 그동안 거의 못 움직인다
        f.chargeT = f.stateT;
        f.charge = clamp(f.stateT / 0.7, 0, 1);
        const m = clamp(inp.mx, -1, 1);
        ax = m * f.accel * 0.12;
        if (Math.abs(m) > 0.3) f.dashDir = m > 0 ? 1 : -1;
        else f.dashDir = f.face;
        f.face = f.dashDir;
        if (!inp.dash) {
          const pow = 0.32 + 0.68 * f.charge;
          this.setState(f, "dash");
          f.dashPow = pow;
          f.dashCd = 0.75;
          f.vx = f.dashDir * (470 + 500 * pow) * (0.88 + f.def.speed * 0.024);
          f.vz += clamp(dz * 1.2, -100, 100);
          this.emit("dash", { i, pow });
        }
        break;
      }
      case "dash": {
        fr *= 0.35;
        const dur = 0.16 + 0.22 * f.dashPow;
        if (f.stateT >= dur) {
          if (!f.dashHit) {
            // 빗나갔다: 비틀거린다 (끝에서 빗나가면 자기가 떨어진다)
            f.bal = Math.max(8, f.bal - (6 + 12 * f.dashPow));
            if (o.state === "dodge" || o.invuln > -0.3) o.dodged += o.state === "dodge" ? 1 : 0;
            this.setState(f, "stumble");
            f.stun = 0.22 + 0.24 * f.dashPow;
            this.emit("whiff", { i });
          } else this.setState(f, "idle");
        }
        break;
      }
      case "stumble": {
        fr *= 0.45;
        if (f.stateT >= f.stun) this.setState(f, "idle");
        break;
      }
      case "guard": {
        f.guardT = f.stateT;
        fr *= 1.5;
        if (!inp.guard && f.stateT > 0.12) this.setState(f, "idle");
        break;
      }
      case "dodge": {
        fr *= 0.8;
        if (f.stateT >= 0.3) this.setState(f, "idle");
        break;
      }
      case "hit":
      case "knockback": {
        fr *= 0.48;
        if (f.stateT >= f.stun) this.setState(f, "idle");
        break;
      }
      case "fall": {
        fr *= 0.8;
        if (f.stateT >= 0.62) {
          this.setState(f, "recover");
          f.bal = Math.max(f.bal, 42);
        }
        break;
      }
      case "recover": {
        if (f.stateT >= 0.34) {
          this.setState(f, "idle");
          f.invuln = 0.15;
        }
        break;
      }
      case "special":
        ({ ax, fr } = this.stepSpecial(f, o, inp, dt, fr, dx, dz, dist));
        break;
      default:
    }

    // 힘을 쓰면 몸이 앞으로
    f.vx += (ax / Math.max(0.9, f.mass * 0.9)) * dt;
    f.vx *= Math.exp(-fr * dt);
    // 앞뒤는 스프링으로 가운데 줄로 돌아온다
    f.vz += -f.z * 16 * dt;
    f.vz *= Math.exp(-(fr + 3) * dt);
    f.moveAmt = clamp(Math.abs(f.vx) / 330, 0, 1.5);
    f.x += f.vx * dt;
    f.z += f.vz * dt;
    // 뜀
    if (f.y > 0 || f.vy > 0) {
      f.vy -= 1500 * dt;
      f.y += f.vy * dt;
      if (f.y <= 0) {
        f.y = 0;
        if (f.vy < -180) this.emit("land", { i, power: Math.min(1, -f.vy / 700) });
        f.vy = 0;
      }
    }
    this.rim(f, i, dt);
  }

  /** 짚으로 만든 가장자리: 발이 걸려 한 번은 버틸 기회가 생긴다 */
  rim(f, i, dt) {
    const rho = Math.hypot(f.x, f.z);
    const R = this.R;
    f.edge = clamp((rho - (R - 130)) / 130, 0, 1.2);
    if (f.edge >= 0.72 && this.phase === "fight") f.touchedEdge = true;
    f.teeter = false;
    if (rho < 1 || f.y > 10) {
      f.rimHold = 0;
      return;
    }
    const nx = f.x / rho;
    const nz = f.z / rho;
    const out = f.vx * nx + f.vz * nz;
    const inRim = rho > R - 52 && f.state !== "out";
    if (inRim) {
      f.rimTime += dt;
      const hold = (0.32 + 0.68 * (f.bal / 100)) * (f.state === "guard" ? 1.9 : 1);
      if (out > 0) {
        const k = 1 - Math.exp(-15 * hold * dt);
        f.vx -= nx * out * k;
        f.vz -= nz * out * k;
      }
      if (out < 190) {
        f.teeter = true;
        f.rimHold = (f.rimHold || 0) + dt;
        const pressing = this.input[i].mx * nx < -0.2;
        // 발이 걸려 허우적: 빠져나오는 데 시간이 걸리고, 그냥 두면 미끄러져 나간다
        if (pressing) {
          f.vx -= (nx * f.vx > 0 ? 0 : nx * f.vx * (1 - Math.exp(-5 * dt)));
        } else {
          const slip = (34 + 140 * (1 - f.bal / 100)) * dt;
          f.vx += nx * slip;
          f.vz += nz * slip;
        }
        f.bal = Math.max(4, f.bal - 3 * dt);
      }
    } else if ((f.rimHold || 0) > 0.28 && rho < R - 90) {
      // 끝에서 살아 돌아왔다: 역전의 기회를 준다
      f.rimHold = 0;
      f.saves = (f.saves || 0) + 1;
      f.spec = Math.min(100, f.spec + 16);
      f.bal = Math.min(100, f.bal + 14);
      this.emit("save", { i });
    }
  }

  hit(att, vic, kind, pow, nx, nz) {
    if (vic.state === "out" || vic.invuln > 0) return false;
    const iAtt = this.f.indexOf(att);
    let K;
    let bal;
    if (kind === "push") {
      att.combo = att.comboT > 0 ? att.combo + 1 : 1;
      att.comboT = 0.85;
      K = att.pushK * (att.combo >= 3 ? 0.85 : 1);
      bal = 7 + att.def.power * 0.7;
    } else {
      K = att.dashK + 620 * pow;
      bal = 8 + att.def.power * 1.2 + 24 * pow;
    }
    bal *= 1.22 - vic.def.defense * 0.05;
    K *= vic.resist * (1.08 / Math.sqrt(vic.mass));
    const armored = vic.state === "special" && vic.def.skill.id === "iron";
    if (armored) {
      // 판다 철벽: 공격한 쪽이 튕겨 난다
      att.vx = -nx * (420 + 260 * pow);
      att.bal = Math.max(5, att.bal - 14 - 12 * pow);
      this.setState(att, "knockback");
      att.stun = 0.34;
      vic.spec = Math.min(100, vic.spec + 6);
      this.emit("clang", { x: (att.x + vic.x) / 2, z: (att.z + vic.z) / 2, power: 0.8, i: iAtt });
      this.freeze = 0.05;
      return true;
    }
    if (vic.state === "guard") {
      const perfect = vic.guardT < 0.17 && kind !== "push";
      const facing = vic.face * nx < 0.3;
      if (facing) {
        if (perfect || (kind === "push" && vic.guardT < 0.12)) {
          att.vx = -nx * (kind === "push" ? 240 : 520);
          att.bal = Math.max(5, att.bal - (kind === "push" ? 8 : 20));
          this.setState(att, "knockback");
          att.stun = kind === "push" ? 0.22 : 0.42;
          vic.spec = Math.min(100, vic.spec + 12);
          vic.parries += 1;
          this.emit("parry", { x: (att.x + vic.x) / 2, z: (att.z + vic.z) / 2, i: this.f.indexOf(vic) });
          this.freeze = 0.07;
          return true;
        }
        K *= 0.36;
        bal *= 0.4;
        vic.vx += nx * K;
        vic.vz += nz * K * 0.3;
        vic.bal = Math.max(0, vic.bal - bal);
        att.vx -= nx * (kind === "push" ? 60 : 200);
        vic.sinceHit = 0;
        this.emit("block", { x: (att.x + vic.x) / 2, z: (att.z + vic.z) / 2, power: Math.min(1, K / 500), i: this.f.indexOf(vic) });
        if (vic.bal <= 0) this.breakBalance(vic, nx);
        return true;
      }
    }
    // 흔들릴수록 더 밀린다
    K *= 1 + (1 - vic.bal / 100) * 0.85;
    // 균형이 남아 있으면 안쪽에서 한 방에 밖까지 날아가지 않는다 (끝에 가까울수록 제한이 풀린다)
    const rho = Math.hypot(vic.x, vic.z);
    if (vic.bal >= 35 && vic.x * nx + vic.z * nz > 0) {
      const room = (this.R - rho - 30) * 3 * (vic.fr / 7) + Math.max(0, rho - this.R * 0.45) ** 2 * 0.06;
      K = Math.min(K, Math.max(200, room * this.world.fr));
    }
    vic.bal -= bal;
    vic.sinceHit = 0;
    vic.lastHitBy = kind;
    vic.vx += nx * K;
    vic.vz += nz * K * 0.4;
    att.hits += 1;
    if (kind !== "push") att.dashHits += 1;
    att.spec = Math.min(100, att.spec + (kind === "push" ? 7 : 12));
    vic.spec = Math.min(100, vic.spec + 5);
    this.emit("hit", { kind, x: (att.x + vic.x) / 2, y: 80, z: (att.z + vic.z) / 2, power: Math.min(1, K / 900), nx, att: iAtt, vic: this.f.indexOf(vic) });
    this.freeze = Math.min(0.09, 0.02 + K * 0.00008);
    att.vx -= nx * Math.min(140, K * 0.14);
    if (vic.bal <= 0) this.breakBalance(vic, nx);
    else if (vic.state !== "special" || vic.def.skill.id !== "belly") {
      if (vic.state === "charge" || CONTROL.has(vic.state) || vic.state === "push" || vic.state === "dash" || vic.state === "stumble" || vic.state === "hit" || vic.state === "knockback" || vic.state === "guard" || vic.state === "dodge" || vic.state === "special") {
        this.setState(vic, K > 240 ? "knockback" : "hit");
        vic.stun = 0.16 + Math.min(0.42, K / 1700);
      }
    }
    return true;
  }

  breakBalance(vic, nx) {
    vic.bal = 0;
    vic.vx += nx * 240;
    this.setState(vic, "fall");
    this.emit("break", { x: vic.x, z: vic.z, i: this.f.indexOf(vic) });
  }

  /** 캐릭터별 특수 기술 */
  stepSpecial(f, o, inp, dt, fr0, dx, dz, dist) {
    const t = f.stateT;
    const id = f.def.skill.id;
    let ax = 0;
    let fr = fr0;
    const dir = f.dashDir;
    const near = (extra) => dist <= f.r + o.r + extra && o.y < 70;
    const nx = dist > 0 ? dx / dist : dir;
    const nz = dist > 0 ? dz / dist : 0;
    const end = (st = "idle", stun = 0) => {
      this.setState(f, st);
      f.stun = stun;
    };
    switch (id) {
      case "belly": // 곰: 잠깐 뒤로 젖혔다가 뱃살로 달려간다. 달리는 동안 안 밀린다
        if (t < 0.24) fr *= 2;
        else if (t < 0.62) {
          f.vx = dir * 720;
          fr = 0;
          if (!f.dashHit && near(10)) {
            f.dashHit = true;
            this.hit(f, o, "special", 1.05, nx, nz);
            f.vx = -dir * 210;
            f.stateT = 0.62;
          }
        } else if (t > 0.86) end();
        else fr *= 0.6;
        break;
      case "hop": // 토끼: 세 번 뛰어 내려찍는다
        {
          const n = Math.floor(t / 0.36);
          if (n > (f.hopN ?? -1) && n < 3) {
            f.hopN = n;
            f.vy = 520;
            f.vx = (o.x >= f.x ? 1 : -1) * (Math.min(1, Math.abs(dx) / 150) * 420 + 40);
            f.face = o.x >= f.x ? 1 : -1;
            f.dashHit = false;
          }
          fr = 0.8;
          if (f.y <= 0 && t % 0.36 > 0.18 && !f.dashHit && n < 3) {
            f.dashHit = true;
            this.emit("land", { i: this.f.indexOf(f), power: 0.7 });
            if (near(48)) this.hit(f, o, "special", 0.2 + n * 0.14, nx, nz);
          }
          if (t >= 1.14) {
            f.hopN = -1;
            end();
          }
        }
        break;
      case "iron": // 판다: 무쇠 버티기
        fr = 26;
        f.bal = Math.min(100, f.bal + 34 * dt);
        if (t >= 2.1) end();
        break;
      case "nose": // 돼지: 모은 뒤 가장 빠른 돌진. 빗나가면 크게 비틀거린다
        if (t < 0.42) {
          fr *= 2;
          f.dashDir = o.x >= f.x ? 1 : -1;
          f.face = f.dashDir;
        } else if (t < 0.78) {
          f.vx = dir * 1040;
          fr = 0;
          if (!f.dashHit && near(6)) {
            f.dashHit = true;
            this.hit(f, o, "special", 1.25, nx, nz);
            f.vx = -dir * 140;
            f.stateT = 0.79;
          }
        } else {
          fr *= 0.4;
          if (!f.dashHit) {
            this.setState(f, "stumble");
            f.stun = 0.72;
            f.bal = Math.max(10, f.bal - 26);
            this.emit("whiff", { i: this.f.indexOf(f) });
          } else if (t > 1) end();
        }
        break;
      case "spin": // 오리: 돌면서 닿을 때마다 민다. 끝나면 어지럽다
        f.spinA += dt * 24;
        ax = clamp(inp.mx, -1, 1) * f.accel * 1.05;
        fr = f.fr * this.world.fr * 0.9;
        f.spinCd = (f.spinCd || 0) - dt;
        if (f.spinCd <= 0 && near(16)) {
          f.spinCd = 0.2;
          this.hit(f, o, "special", 0.1, nx, nz);
        }
        if (t >= 1.35) {
          f.spinA = 0;
          end("stumble", 0.42);
        }
        break;
      case "roll": // 고양이: 상대 뒤로 굴러 들어가 바깥쪽으로 밀어낸다
        if (t < 0.44) {
          f.invuln = 0.05;
          // 판 안쪽까지만: 스스로 떨어지지 않게
          const behind = clamp(o.x + (o.x >= f.x ? 1 : -1) * (f.r + o.r + 14), -this.R + 46, this.R - 46);
          if (f.rollTo === undefined) f.rollTo = behind;
          const nextX = f.x + (f.rollTo - f.x) * Math.min(1, dt * 11);
          f.vx = (nextX - f.x) / dt;
          f.spinA += dt * 18 * (f.rollTo >= f.x ? 1 : -1);
          fr = 0;
          ax = 0;
          f.z = Math.sin((t / 0.44) * Math.PI) * 70;
        } else if (t < 0.58) {
          if (!f.dashHit) {
            f.dashHit = true;
            f.spinA = 0;
            f.face = o.x >= f.x ? 1 : -1;
            if (near(36)) this.hit(f, o, "special", 0.92, f.face, 0);
            f.vx = f.face * 160;
          }
        } else {
          f.rollTo = undefined;
          end();
        }
        break;
      case "roar": // 호랑이: 포효로 움츠리게 하고 달려든다
        if (t < 0.34) {
          fr *= 2;
          if (t >= 0.2 && !f.pushDone) {
            f.pushDone = true;
            this.emit("roar", { i: this.f.indexOf(f) });
            if (dist < 300 && o.invuln <= 0 && o.state !== "out") {
              o.bal = Math.max(2, o.bal - 15);
              o.vx += nx * 120;
              if (o.state !== "fall" && o.state !== "special") {
                this.setState(o, "hit");
                o.stun = 0.34;
              }
            }
          }
        } else if (t < 0.66) {
          f.vx = dir * 860;
          fr = 0;
          if (!f.dashHit && near(8)) {
            f.dashHit = true;
            this.hit(f, o, "special", 0.85, nx, nz);
            f.vx = -dir * 150;
            f.stateT = 0.67;
          }
        } else if (t > 0.86) end();
        break;
      case "slide": // 펭귄: 배로 미끄러진다. 틀 수는 있어도 잘 안 선다
        if (t < 0.05) f.vx = dir * 860;
        ax = clamp(inp.mx, -1, 1) * 700;
        fr = 0.9;
        if (!f.dashHit && near(6)) {
          f.dashHit = true;
          this.hit(f, o, "special", 0.5, nx, nz);
          f.vx *= 0.75;
        }
        if (t >= 1.15) end("stumble", 0.4);
        break;
      default:
        end();
    }
    return { ax, fr };
  }

  /** 두 몸이 부딪힌다: 질량 · 속도 · 탄성으로 튕긴다 */
  collide() {
    const [a, b] = this.f;
    a.locked = false;
    b.locked = false;
    if (a.state === "out" || b.state === "out") return;
    if (a.invuln > 0 || b.invuln > 0) return;
    if (a.y > 70 || b.y > 70) return;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 0.01;
    const min = a.r + b.r;
    if (d >= min) return;
    const nx = dx / d;
    const nz = dz / d;
    // 겹침 풀기: 가벼운 쪽이 더 움직인다
    const ma = this.massOf(a);
    const mb = this.massOf(b);
    const push = min - d;
    a.x -= nx * push * (mb / (ma + mb));
    a.z -= nz * push * (mb / (ma + mb));
    b.x += nx * push * (ma / (ma + mb));
    b.z += nz * push * (ma / (ma + mb));
    const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (vn <= 0) {
      a.locked = true;
      b.locked = true;
      return;
    }
    const e = vn < 110 ? 0 : this.world.bounce;
    const j = ((1 + e) * vn) / (1 / ma + 1 / mb);
    a.vx -= (j / ma) * nx;
    a.vz -= (j / ma) * nz;
    b.vx += (j / mb) * nx;
    b.vz += (j / mb) * nz;
    if (vn < 110) {
      a.locked = true;
      b.locked = true;
    } else {
      // 그냥 부딪혀도 말랑하게 튕긴다
      const pw = Math.min(1, vn / 800);
      if (a.state !== "dash" && b.state !== "dash" && a.state !== "special" && b.state !== "special") {
        this.emit("bump", { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, power: pw, nx });
        a.bal = Math.max(1, a.bal - pw * 3);
        b.bal = Math.max(1, b.bal - pw * 3);
      }
    }
    // 돌진이 닿으면 기술로 처리
    const hitBy = (att, vic, sign) => {
      if (att.state === "dash" && !att.dashHit) {
        att.dashHit = true;
        this.hit(att, vic, "dash", att.dashPow, sign * nx, sign * nz);
        att.vx *= 0.25;
      }
    };
    if (a.state === "dash" && b.state === "dash") {
      // 정면 충돌: 센 쪽이 이기고 둘 다 튕긴다
      const sa = a.dashPow * a.def.power;
      const sb = b.dashPow * b.def.power;
      a.dashHit = true;
      b.dashHit = true;
      this.hit(sa >= sb ? a : b, sa >= sb ? b : a, "dash", Math.abs(sa - sb) * 0.1 + 0.2, sa >= sb ? nx : -nx, sa >= sb ? nz : -nz);
      this.freeze = 0.09;
    } else {
      hitBy(a, b, 1);
      hitBy(b, a, -1);
    }
  }

  massOf(f) {
    if (f.state === "special" && f.def.skill.id === "iron") return f.mass * 8;
    if (f.state === "special" && f.def.skill.id === "belly") return f.mass * 2.5;
    if (f.state === "guard") return f.mass * 1.6;
    return f.mass;
  }

  checkOut() {
    for (let i = 0; i < 2; i += 1) {
      const f = this.f[i];
      if (f.state === "out" || f.y > 20) continue;
      if (Math.hypot(f.x, f.z) > this.R + f.r * 0.32) {
        this.ringOut(i);
        return;
      }
    }
    // 끝까지 안 나면 더 안쪽에 있는 쪽이 이긴다 (안전장치)
    if (this.limit && this.time > this.limit + 12) {
      const ia = Math.hypot(this.f[0].x, this.f[0].z);
      const ib = Math.hypot(this.f[1].x, this.f[1].z);
      this.ringOut(ia > ib ? 0 : 1);
    }
  }

  ringOut(i) {
    const f = this.f[i];
    const o = this.f[1 - i];
    this.setState(f, "out");
    f.vy = 430;
    const rho = Math.hypot(f.x, f.z) || 1;
    f.vx = (f.x / rho) * Math.max(240, Math.abs(f.vx));
    f.vz = (f.z / rho) * 60;
    this.roundWinner = 1 - i;
    this.wins[1 - i] += 1;
    this.phase = "roundEnd";
    this.phaseT = 0;
    this.lastKo = { loser: i, by: f.lastHitBy, sinceHit: f.sinceHit, time: this.time, winnerEdge: o.touchedEdge, winnerBal: o.bal, winnerRim: o.rimTime };
    if (!this.endless) this.setState(o, "victory");
    this.emit("ringout", { i, x: f.x, z: f.z, by: f.lastHitBy, sinceHit: f.sinceHit });
  }
}
