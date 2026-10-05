/*
 * 물총 대작전 엔진 · BossSystem
 *
 * 보스 한 판의 흐름: 등장 → (이동 → 예고 → 공격 → 약점 노출) 반복 → 화남(페이즈) → SUPER SPLASH!
 * 공격은 데이터로 조합한다:
 *   volley(부채꼴 던지기) · rain(하늘에서) · wall(틈 있는 물벽) · minions(부하 소환)
 *   slam(물결 굴리기) · ink(먹물) · dive(잠수 이동) · charge(돌진 — 약점 열림)
 *   parts(촉수 · 대포 같은 부품 — 다 적시면 기절) · spout(물기둥 — 숨구멍 열림)
 */
import { project, rand, pick, lerp, clamp, ease } from "./view.js?v=2";

export class BossBase {
  constructor(data, env) {
    this.d = data;
    this.id = data.id;
    this.env = env;
    this.home = { x: 0, z: 0.3, ...(data.home || {}) };
    this.x = this.home.x;
    this.z = this.home.z;
    this.h = 0;
    this.sub = 1;
    this.maxHp = data.hp;
    this.hp = data.hp;
    this.phase = 0;
    this.mode = "intro";
    this.modeT = 0;
    this.atk = null;
    this.atkName = "";
    this.queue = [];
    this.parts = [];
    this.hitT = 0;
    this.rot = 0;
    this.dir = 1;
    this.squash = 0;
    this.age = 0;
    this.tx = this.x;
    this.lastAtk = "";
    this.pushback = 0;
    this.shielded = false;
    this.done = false;
    this.sx = 0;
    this.sy = 0;
    this.s = 1;
    this.k = 1;
    this.mem = {};
  }

  get phaseData() {
    return this.d.phases[this.phase] || this.d.phases[0];
  }

  get tempo() {
    return (this.phaseData.tempo || 1) * this.env.speed;
  }

  get alive() {
    return this.mode !== "defeat" && this.mode !== "gone";
  }

  /** 지금 약점이 열려 있나 */
  weakOpen(w) {
    const open = w.open || ["recover", "stun"];
    return open.includes(this.mode) || (this.mode === "attack" && open.includes(this.atkName));
  }

  layout() {
    const p = project(this.x, this.z, this.h);
    this.sx = p.sx;
    this.sy = p.sy;
    this.s = p.s;
    this.k = ((this.d.size || 150) / 50) * p.s;
  }

  /** 화면 위 맞는 원들 */
  hitCircles() {
    const out = [];
    if (!this.alive || this.mode === "intro" || this.sub > 0.6) return out;
    for (const w of this.d.weak || []) {
      if (!this.weakOpen(w)) continue;
      out.push({ weak: true, id: w.id, x: this.sx + w.dx * this.k * this.dir, y: this.sy + (w.dy + this.sub * 70) * this.k, r: w.r * this.k * 1.25 });
    }
    for (const b of this.d.body || [{ dx: 0, dy: -40, r: 46 }]) {
      out.push({ weak: false, x: this.sx + b.dx * this.k * this.dir, y: this.sy + (b.dy + this.sub * 70) * this.k, r: b.r * this.k });
    }
    return out;
  }

  /** 물을 맞음. 결과: 'weak' | 'body' | 'shield' | 'none' */
  takeHit(isWeak) {
    if (!this.alive || this.mode === "intro" || this.mode === "phase") return "none";
    if (this.shielded && !isWeak) return "shield";
    const dmg = isWeak ? this.d.weakDamage || 2 : this.mode === "recover" || this.mode === "stun" ? 0.5 : this.d.bodyDamage || 0.28;
    this.hp -= dmg;
    this.hitT = 0.14;
    this.squash = isWeak ? 1 : 0.4;
    if (this.mode === "charge" || this.atkName === "charge") {
      if (isWeak) this.pushback += 0.05;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.setMode("defeat");
      this.env.onBossDefeat(this);
      return isWeak ? "weak" : "body";
    }
    // 페이즈 넘어가기
    const next = this.d.phases[this.phase + 1];
    if (next && this.hp / this.maxHp <= next.at) {
      this.phase++;
      this.clearParts(true);
      this.setMode("phase");
      this.env.onBossPhase(this, next);
    }
    return isWeak ? "weak" : "body";
  }

  setMode(m, t = 0) {
    this.mode = m;
    this.modeT = t;
    this.modeSeq = (this.modeSeq || 0) + 1; // 약점이 열릴 때마다 '첫 명중 1000점'을 다시 준다
  }

  clearParts(silent) {
    for (const p of this.parts) {
      if (p.state === "live") {
        p.mem.down = true;
        p.hidden = true;
        if (!silent) p.soak(this.env);
      }
    }
    this.parts.length = 0;
    this.shielded = false;
  }

  pickAttack() {
    const list = this.phaseData.attacks;
    let name = pick(list);
    if (list.length > 1 && name === this.lastAtk) name = pick(list.filter((n) => n !== this.lastAtk));
    // 부품이 이미 살아 있으면 부품 소환은 건너뛴다
    if (this.parts.length && this.d.attacks[name].type === "parts") name = list.find((n) => this.d.attacks[n].type !== "parts") || name;
    this.lastAtk = name;
    return name;
  }

  update(dt) {
    const env = this.env;
    this.age += dt;
    this.modeT += dt;
    if (this.hitT > 0) this.hitT -= dt;
    this.squash *= Math.pow(0.003, dt);
    const bob = Math.sin(this.age * 1.6) * 6 + (env.waveAt ? env.waveAt(this.x, this.z, env.t) : 0) + (this.d.hover || 0);

    // 부품(촉수 · 대포) 위치 맞추기
    if (this.parts.length) {
      for (const p of this.parts) {
        const o = p.opts.offset;
        p.x = this.x + o.x;
        p.z = this.z + o.z;
        if (o.hu) p.h = this.h + o.hu * ((this.d.size || 150) / 50);
      }
      this.parts = this.parts.filter((p) => p.state === "live");
      this.shielded = this.parts.length > 0 && this.d.attacks[this.atkName] && this.d.attacks[this.atkName].type === "parts";
      if (!this.parts.length && this.mode === "parts") {
        // 부품을 다 적시면 기절 → 약점 크게 열림
        this.setMode("stun");
        this.shielded = false;
        env.onBossStun(this);
      }
    }

    switch (this.mode) {
      case "intro": {
        // 보스마다 다른 등장: rise(솟아오름) · drop(하늘에서 쿵) · surge(수평선에서 돌진) · slow(천천히 거대하게)
        const kind = this.d.intro || "rise";
        const dur = kind === "slow" ? 3.6 : kind === "drop" ? 1.5 : 2.2;
        const k = clamp(this.modeT / dur, 0, 1);
        if (kind === "drop") {
          this.sub = 0;
          this.h = bob + (1 - ease.in(k)) * 620;
          if (k >= 1 && !this.mem.landed) {
            this.mem.landed = true;
            env.shake(20);
            env.flash(0.4, "#fff8d0");
            const w = project(this.x, this.z, 0);
            env.fx.impact(w.sx, w.sy, 2.6, { onWater: true, power: 1.6 });
            env.fx.splash(w.sx, w.sy, 2.4, { count: 40, power: 1.4 });
            env.audio.play("bomb");
          }
        } else if (kind === "surge") {
          this.sub = 1 - ease.out(k);
          this.z = lerp(0.02, this.home.z, ease.out(k));
          this.h = bob;
          if (Math.random() < 0.5) {
            const w = project(this.x + rand(-0.3, 0.3), this.z, 0);
            env.fx.splash(w.sx, w.sy, w.s * 1.4, { count: 3, ring: false });
          }
        } else if (kind === "slow") {
          this.sub = 1 - ease.inOut(k);
          this.h = bob;
          if (Math.random() < 0.15) env.shake(5);
        } else {
          this.sub = 1 - ease.out(k);
          this.h = bob;
        }
        if (this.modeT > dur + 0.5) this.setMode("move");
        break;
      }
      case "move": {
        if (this.mem.moveFrom == null) {
          this.mem.moveFrom = this.x;
          const range = this.d.moveRange || 0.5;
          let tx = rand(-range, range);
          if (Math.abs(tx - this.x) < 0.25) tx = clamp(this.x + (this.x > 0 ? -0.4 : 0.4), -range, range);
          this.tx = tx;
          this.dir = tx > this.x ? 1 : -1;
        }
        const dur = 1.1 / this.tempo;
        const k = ease.inOut(clamp(this.modeT / dur, 0, 1));
        this.x = lerp(this.mem.moveFrom, this.tx, k);
        this.z = lerp(this.z, this.home.z, dt * 2);
        this.h = bob + Math.sin(k * Math.PI) * (this.d.hopH || 18);
        this.sub = Math.max(0, this.sub - dt * 2);
        if (this.modeT > dur) {
          this.mem.moveFrom = null;
          this.atkName = this.pickAttack();
          this.atk = this.d.attacks[this.atkName];
          this.setMode("windup");
          env.onBossWindup(this, this.atk);
        }
        break;
      }
      case "windup": {
        this.h = bob;
        const w = (this.atk.windup || 0.8) / Math.min(1.5, this.tempo);
        if (this.modeT > w) {
          this.setMode("attack");
          this.mem.fired = 0;
          this.mem.fireT = 0;
          this.startAttack();
        }
        break;
      }
      case "attack":
        this.h = bob;
        this.runAttack(dt);
        break;
      case "parts":
        // 부품이 살아 있는 동안 — 부품이 공격한다
        this.h = bob;
        this.mem.slapT = (this.mem.slapT || 0) - dt * this.tempo;
        if (this.mem.slapT <= 0 && this.parts.length) {
          this.mem.slapT = this.atk.every || 1.6;
          const p = pick(this.parts);
          p.mem.slap = 0.5;
          env.shoot(this.atk.proj || "balloon", p, { dur: (2.3 * (this.d.slow || 1)) / Math.min(1.4, this.tempo), dx: rand(-0.12, 0.12) });
        }
        if (this.modeT > (this.atk.timeout || 14)) {
          // 너무 오래 끌면 부품이 스스로 들어간다
          this.clearParts(true);
          this.setMode("recover");
        }
        break;
      case "recover":
        this.h = bob - 6;
        this.sub = Math.max(0, this.sub - dt * 2);
        if (this.modeT > (this.d.recover || 2.2) / Math.min(1.3, this.tempo)) this.setMode("move");
        break;
      case "stun":
        this.h = bob - 10;
        this.sub = Math.max(0, this.sub - dt * 2);
        if (this.modeT > (this.d.stun || 3.6)) this.setMode("move");
        break;
      case "phase":
        this.h = bob;
        this.z = lerp(this.z, this.home.z, dt * 3);
        this.sub = Math.max(0, this.sub - dt * 2);
        if (this.modeT > 1.6) this.setMode("move");
        break;
      case "defeat": {
        const t = this.modeT;
        this.rot += dt * (6 + t * 10);
        this.h = bob + (t > 0.9 ? (t - 0.9) * (t - 0.9) * 900 : Math.sin(t * 20) * 6);
        this.z = Math.max(0.05, this.z - (t > 0.9 ? dt * 0.2 : 0));
        if (t > 2.6) {
          this.setMode("gone");
          this.done = true;
        }
        break;
      }
      default:
        break;
    }
  }

  startAttack() {
    const a = this.atk;
    const env = this.env;
    switch (a.type) {
      case "dive":
        this.mem.diveFrom = this.x;
        this.tx = clamp(-this.x + rand(-0.2, 0.2), -0.55, 0.55);
        break;
      case "charge":
        this.pushback = 0;
        this.mem.z0 = this.z;
        env.say(a.say || "돌진!", this);
        break;
      case "parts": {
        const n = a.n || 4;
        for (let i = 0; i < n; i++) {
          const f = n === 1 ? 0 : i / (n - 1) - 0.5;
          // shell: 보스 등 위에 붙는 부품 (대포) · 기본: 보스 둘레 물에서 솟는 부품 (촉수)
          const offset = a.layout === "shell" ? { x: f * 1.5, z: 0.02, hu: 112 - Math.abs(f) * 64 } : { x: f * (a.width || 1.2), z: 0.04 + Math.abs(f) * 0.05 };
          const p = env.spawnEnemy(a.enemy, { part: true, offset, minion: true, x: this.x + offset.x, z: this.z + offset.z, hp: a.hp });
          if (p) {
            p.parent = this;
            this.parts.push(p);
          }
        }
        this.shielded = true;
        this.setMode("parts");
        this.mem.slapT = 1.4;
        break;
      }
      default:
        break;
    }
  }

  runAttack(dt) {
    const a = this.atk;
    const env = this.env;
    const tempo = Math.min(1.5, this.tempo);
    const sl = this.d.slow || 1; // 앞쪽 보스는 던지는 것이 조금 느리다 (아이들도 막을 수 있게)
    const fire = (n, gap, fn) => {
      this.mem.fireT -= dt;
      if (this.mem.fired < n && this.mem.fireT <= 0) {
        fn(this.mem.fired);
        this.mem.fired++;
        this.mem.fireT = gap / tempo;
      }
      return this.mem.fired >= n && this.mem.fireT <= 0;
    };
    let finished = false;
    switch (a.type) {
      case "volley": {
        const n = a.n || 3;
        finished = fire(n, a.gap || 0.18, (i) => {
          const f = n === 1 ? 0 : i / (n - 1) - 0.5;
          const dx = f * (a.spread || 0.6);
          env.shoot(a.proj || "balloon", this.mouth(), { dur: (a.dur || 2.4) * sl / Math.min(1.3, tempo), dx, lane: 0.22 });
        });
        break;
      }
      case "rain": {
        const n = a.n || 5;
        finished = fire(n, a.gap || 0.28, (i) => {
          const danger = i % 2 === 0;
          const x1 = danger ? rand(-0.12, 0.12) : pick([-1, 1]) * rand(0.4, 0.9);
          env.shoot(a.proj || "pebble", { x: this.x + rand(-0.2, 0.2), z: this.z, h: this.h + 220 }, { dur: (a.dur || 2.2) * sl / Math.min(1.3, tempo), x1, arc: 240, lane: 0.25 });
        });
        break;
      }
      case "wall": {
        // 한 줄로 쏟아지는 물벽 — 틈(gap)이 있다. 보트 줄에 있는 것만 터뜨리면 된다
        if (this.mem.fired === 0) {
          const n = a.n || 7;
          const gaps = new Set();
          const g = Math.floor(rand(0, n));
          gaps.add(g);
          if (a.gaps > 1) gaps.add((g + Math.floor(n / 2)) % n);
          for (let i = 0; i < n; i++) {
            if (gaps.has(i)) continue;
            const x = lerp(-0.95, 0.95, i / (n - 1));
            env.shoot(a.proj || "spray", { x, z: this.z + 0.04, h: 10 }, { straight: true, x1: x, dur: (a.dur || 3) * sl / Math.min(1.3, tempo), arc: 30, h1: 40, lane: 0.2, delay: Math.abs(x) * 0.25 });
          }
          this.mem.fired = 1;
          this.mem.fireT = 0.6;
          env.say(a.say || "물벽!", this);
        }
        this.mem.fireT -= dt;
        finished = this.mem.fireT <= 0;
        break;
      }
      case "minions": {
        const n = a.n || 2;
        finished = fire(n, a.gap || 0.35, (i) => {
          const side = i % 2 ? 1 : -1;
          env.spawnEnemy(pick([].concat(a.enemy)), { minion: true, x: clamp(this.x + side * rand(0.25, 0.5), -0.9, 0.9), z: clamp(this.z + rand(0.05, 0.2), 0.1, 0.7), spawn: a.spawn || "popup" });
        });
        break;
      }
      case "slam": {
        if (this.mem.fired === 0) {
          env.shake(14);
          env.fx.splash(this.sx, this.sy, this.s * 2, { count: 26, power: 1.3 });
          env.audio.play("splash", { big: true });
          const n = a.n || 3;
          for (let i = 0; i < n; i++) {
            const x = n === 1 ? 0 : lerp(-0.6, 0.6, i / (n - 1));
            env.shoot(a.proj || "wave", { x: this.x * 0.5 + x * 0.6, z: this.z + 0.05, h: 0 }, { straight: false, x1: x * 0.9, dur: (a.dur || 2.6) * sl / Math.min(1.3, tempo), arc: 10, h0: 10, h1: 20, lane: 0.25 });
          }
          this.mem.fired = 1;
          this.mem.fireT = 0.5;
          this.squash = -0.6;
        }
        this.mem.fireT -= dt;
        finished = this.mem.fireT <= 0;
        break;
      }
      case "ink": {
        const n = a.n || 2;
        finished = fire(n, 0.3, (i) => env.shoot("ink", this.mouth(), { dur: 2.2 * sl / Math.min(1.3, tempo), dx: (i - (n - 1) / 2) * 0.3 }));
        break;
      }
      case "dive": {
        const t = this.modeT;
        if (t < 0.7) this.sub = Math.min(1, t / 0.6);
        else if (t < 1.5) {
          this.sub = 1;
          this.x = lerp(this.mem.diveFrom, this.tx, (t - 0.7) / 0.8);
        } else {
          if (!this.mem.surfaced) {
            this.mem.surfaced = true;
            env.fx.splash(project(this.x, this.z, 0).sx, project(this.x, this.z, 0).sy, 2.4, { count: 30 });
            env.audio.play("splash", { big: true });
            if (a.then) env.shoot(a.then, this.mouth(), { dur: 2.2, dx: 0 });
          }
          this.sub = Math.max(0, 1 - (t - 1.5) / 0.5);
        }
        finished = t > 2.1;
        if (finished) this.mem.surfaced = false;
        break;
      }
      case "charge": {
        const dur = a.dur || 4;
        const zMax = a.zMax || 0.82;
        const t = this.modeT;
        const target = lerp(this.mem.z0, zMax, clamp(t / dur, 0, 1));
        this.z = Math.max(this.mem.z0, target - this.pushback);
        this.x = lerp(this.x, 0, dt * 1.2);
        if (this.pushback > (a.stopAt || 0.3) || (this.z <= this.mem.z0 + 0.01 && t > 1.2)) {
          // 약점을 잔뜩 맞아 돌진이 멈췄다 → 기절
          env.say("멈췄다!", this);
          this.setMode("stun");
          this.z = Math.max(this.mem.z0, this.z);
          return;
        }
        if (t >= dur && this.z >= zMax - 0.02) {
          env.hitBoat(this);
          env.shake(18);
          this.setMode("recover");
          return;
        }
        if (t > dur + 1) finished = true;
        break;
      }
      case "spout": {
        // 물기둥 → 하늘에서 따끈한 물방울이 쏟아짐 · 숨구멍이 열린다
        if (this.mem.fired === 0) env.say(a.say || "푸슝!", this);
        const n = a.n || 6;
        finished = fire(n, a.gap || 0.3, (i) => {
          const danger = i % 2 === 1;
          const x1 = danger ? rand(-0.1, 0.1) : rand(-0.95, 0.95);
          env.shoot(a.proj || "pebble", { x: this.x, z: this.z, h: this.h + 200 }, { dur: 2.2 * sl / Math.min(1.3, tempo), x1, arc: 260, lane: 0.25 });
        });
        this.mem.spout = true;
        if (finished) this.mem.spout = false;
        break;
      }
      default:
        finished = true;
    }
    if (finished && this.mode === "attack") this.setMode(a.after || "recover");
  }

  /** 던지는 위치 (입 · 집게) */
  mouth() {
    const m = this.d.mouth || { dy: -40 };
    const u = (this.d.size || 150) / 50; // 그림 단위 → 월드 px
    return { x: this.x + (m.dx || 0) * this.dir * 0.0035 * u, z: this.z + 0.02, h: this.h - (m.dy == null ? -40 : m.dy) * u - 40 };
  }

  pose(now) {
    return {
      t: this.age,
      now,
      mode: this.mode,
      atk: this.atkName,
      phase: this.phase,
      hit: this.hitT > 0 ? this.hitT / 0.14 : 0,
      hp: this.hp / this.maxHp,
      dir: this.dir,
      open: (this.d.weak || []).some((w) => this.weakOpen(w)),
      angry: this.phase > 0,
      shielded: this.shielded,
      sub: this.sub,
      windup: this.mode === "windup" ? clamp(this.modeT / (this.atk && this.atk.windup ? this.atk.windup : 0.8), 0, 1) : 0,
      spout: Boolean(this.mem.spout),
      blink: this.age % 2.7 < 0.12,
    };
  }
}
