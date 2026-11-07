/* 소리: 파일 없이 합성 (저작권 걱정 없음). 전체 음소거는 공용 today-audio 가 처리한다 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Sfx {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.sfxVol = 0.8;
    this.musicVol = 0.5;
    this.music = null;
    this.last = new Map();
    this.hum = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      this.bus = c.createGain();
      this.mbus = c.createGain();
      const comp = c.createDynamicsCompressor();
      this.bus.connect(comp);
      this.mbus.connect(comp);
      comp.connect(c.destination);
      const n = c.sampleRate;
      this.noise = c.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
      this.apply();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  apply() {
    if (!this.ctx) return;
    this.bus.gain.value = this.sfxOn ? this.sfxVol : 0;
    this.mbus.gain.value = this.musicOn ? this.musicVol * 0.3 : 0;
  }

  set(o) {
    Object.assign(this, o);
    this.sfxVol = clamp(this.sfxVol, 0, 1);
    this.musicVol = clamp(this.musicVol, 0, 1);
    this.apply();
  }

  suspend(off) {
    if (!this.ctx) return;
    if (off) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  gate(k, ms) {
    if (!this.ctx) return false;
    const now = performance.now();
    if (now - (this.last.get(k) || 0) < ms) return false;
    this.last.set(k, now);
    return true;
  }

  tone({ dur = 0.15, f = 440, to = 0, type = "sine", gain = 0.3, delay = 0, dest }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst({ dur = 0.12, f = 1200, q = 1, gain = 0.2, delay = 0, to = 0 }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const fl = c.createBiquadFilter();
    fl.type = "bandpass";
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  /** 집게 이동 소리: 움직이는 동안 낮게 웅 */
  motor(on, k = 1) {
    const c = this.ctx;
    if (!c) return;
    if (on && !this.hum) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 72;
      const fl = c.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.value = 420;
      const g = c.createGain();
      g.gain.value = 0.0001;
      o.connect(fl).connect(g).connect(this.bus);
      o.start();
      this.hum = { o, g };
    }
    if (this.hum) {
      const t = c.currentTime;
      this.hum.g.gain.setTargetAtTime(on ? 0.05 * k : 0.0001, t, 0.05);
      this.hum.o.frequency.setTargetAtTime(on ? 70 + k * 30 : 60, t, 0.1);
    }
  }

  /** 케이블 감는 모터: 감거나 풀 때만 위잉 (k = 속도 0~1) */
  winch(k) {
    const c = this.ctx;
    if (!c) return;
    if (k > 0.02 && !this.wn) {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = 140;
      const fl = c.createBiquadFilter();
      fl.type = "bandpass";
      fl.frequency.value = 900;
      fl.Q.value = 3;
      const g = c.createGain();
      g.gain.value = 0.0001;
      o.connect(fl).connect(g).connect(this.bus);
      o.start();
      this.wn = { o, g };
    }
    if (this.wn) {
      const t = c.currentTime;
      this.wn.g.gain.setTargetAtTime(k > 0.02 ? 0.03 * k : 0.0001, t, 0.06);
      this.wn.o.frequency.setTargetAtTime(110 + k * 90, t, 0.08);
    }
  }
  /** 집게가 무언가에 닿음 (세기에 따라) */
  contact(p = 0.5) {
    if (!this.gate("contact", 150)) return;
    this.tone({ dur: 0.12, f: 180 + p * 60, to: 90, type: "sine", gain: 0.08 + p * 0.14 });
    this.noiseBurst({ dur: 0.05, f: 900, q: 1, gain: 0.03 + p * 0.05 });
  }
  /** 발이 인형을 누를 때: 폭신한 '푹' */
  squish(n = 1) {
    if (!this.gate("squish", 90)) return;
    this.noiseBurst({ dur: 0.14, f: 420, to: 260, q: 1.2, gain: 0.07 + n * 0.03 });
    this.tone({ dur: 0.1, f: 210, to: 150, type: "sine", gain: 0.06 });
  }
  /** 꽉 잡힘: 인형이 눌리는 '뽀옥' */
  squeeze() {
    this.tone({ dur: 0.2, f: 340, to: 520, type: "sine", gain: 0.1 });
    this.noiseBurst({ dur: 0.12, f: 600, to: 350, q: 1, gain: 0.05 });
  }
  /** 매달린 인형이 흔들릴 때 케이블 삐걱 */
  creak() {
    if (!this.gate("creak", 700)) return;
    this.noiseBurst({ dur: 0.22, f: 1800, to: 1300, q: 9, gain: 0.025 });
  }
  /** 배출구 바닥에 떨어진 소리 */
  chute() {
    this.tone({ dur: 0.18, f: 150, to: 70, type: "sine", gain: 0.28 });
    this.noiseBurst({ dur: 0.08, f: 300, q: 0.8, gain: 0.08 });
  }
  coin() {
    this.tone({ dur: 0.07, f: 1320, type: "square", gain: 0.07 });
    this.tone({ dur: 0.22, f: 1760, type: "square", gain: 0.07, delay: 0.07 });
  }
  click() {
    if (!this.gate("click", 60)) return;
    this.tone({ dur: 0.06, f: 760, to: 540, type: "triangle", gain: 0.18 });
  }
  drop() {
    this.tone({ dur: 0.9, f: 520, to: 210, type: "triangle", gain: 0.09 });
    this.noiseBurst({ dur: 0.9, f: 900, to: 400, q: 2, gain: 0.05 });
  }
  clack() {
    this.noiseBurst({ dur: 0.06, f: 3200, q: 3, gain: 0.25 });
    this.tone({ dur: 0.08, f: 300, to: 180, type: "square", gain: 0.08, delay: 0.02 });
  }
  lift() {
    this.tone({ dur: 1.4, f: 220, to: 420, type: "triangle", gain: 0.06 });
  }
  grab() {
    if (!this.gate("grab", 200)) return;
    this.tone({ dur: 0.18, f: 520, to: 880, type: "sine", gain: 0.2 });
    this.noiseBurst({ dur: 0.1, f: 700, q: 0.8, gain: 0.12 });
  }
  slip() {
    if (!this.gate("slip", 300)) return;
    this.tone({ dur: 0.45, f: 660, to: 180, type: "sine", gain: 0.22 });
  }
  land(p = 0.5) {
    if (!this.gate("land", 70)) return;
    this.tone({ dur: 0.16, f: 220 + p * 120, to: 90, type: "sine", gain: 0.12 + p * 0.2 });
    this.noiseBurst({ dur: 0.06, f: 500, q: 0.7, gain: 0.05 + p * 0.08 });
  }
  /** 등급별 획득 소리 */
  prize(r) {
    const base = [[523, 659, 784], [587, 740, 880, 1175], [523, 659, 784, 1047, 1319], [392, 523, 659, 784, 1047, 1319, 1568], [440, 554, 659, 880, 1109, 1319, 1760]][r];
    base.forEach((f, i) => this.tone({ dur: 0.2, f, type: "triangle", gain: 0.2, delay: i * 0.08 }));
    if (r >= 2) this.noiseBurst({ dur: 0.6, f: 5000, q: 2, gain: 0.06, delay: 0.2 });
    if (r >= 3) {
      this.tone({ dur: 1.1, f: 1568, type: "sine", gain: 0.12, delay: base.length * 0.08 });
      this.tone({ dur: 1.1, f: 1976, type: "sine", gain: 0.08, delay: base.length * 0.08 + 0.05 });
    }
  }
  fail() {
    [392, 330, 262].forEach((f, i) => this.tone({ dur: 0.2, f, type: "triangle", gain: 0.14, delay: i * 0.13 }));
  }

  /** 배경 음악: 통통 튀는 짧은 반복 */
  startMusic() {
    if (!this.ctx || this.music) return;
    const lead = [523, 0, 659, 784, 0, 659, 587, 0, 523, 0, 440, 523, 0, 587, 659, 0, 698, 0, 659, 587, 0, 523, 587, 0, 659, 0, 523, 440, 0, 392, 440, 0];
    const bass = [131, 196, 165, 196, 110, 165, 147, 196];
    const step = 60 / 128 / 2;
    let t = this.ctx.currentTime + 0.1;
    let i = 0;
    const tick = () => {
      const c = this.ctx;
      if (!this.music || c.state === "suspended") return;
      while (t < c.currentTime + 0.4) {
        const d = Math.max(0, t - c.currentTime);
        const f = lead[i % lead.length];
        if (f) this.tone({ dur: step * 0.85, f, type: "triangle", gain: 0.22, dest: this.mbus, delay: d });
        if (i % 4 === 0) this.tone({ dur: step * 3, f: bass[Math.floor(i / 4) % bass.length], type: "sine", gain: 0.3, dest: this.mbus, delay: d });
        if (i % 2 === 1) this.tone({ dur: 0.03, f: 3000, type: "square", gain: 0.03, dest: this.mbus, delay: d });
        t += step;
        i += 1;
      }
    };
    this.music = setInterval(tick, 120);
    tick();
  }
}
