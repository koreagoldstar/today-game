/*
 * 자석 대소동 · 효과음 (소리 파일 없이 바로 만들어 냄)
 *  - 첫 클릭/터치 뒤에만 소리 · 사이트 전체 음소거(TodayAudio)는 공용 스크립트가 자동으로 따름
 *  - 자석 켜 둔 동안 낮게 '웅~' (끄면 멈춤) · 같은 소리가 몰리면 줄임
 */
const SEMI = (n) => Math.pow(2, n / 12);

export class MagAudio {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.hum = null;
    this.last = {};
  }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (_) {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }
  setOn(on) {
    this.on = on;
    if (!on) this.humOff();
  }
  ok() {
    return this.on && this.ctx && this.ctx.state === "running";
  }
  tone(f0, f1, dur, { type = "sine", vol = 0.25, at = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.12, at = 0, freq = 1800, q = 1.2 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    if (!this.nbuf) {
      this.nbuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource();
    s.buffer = this.nbuf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, 0, Math.min(0.48, dur + 0.02));
  }
  /** 자석 켜 둔 동안 낮은 울림 */
  humOn(pole) {
    if (!this.ok() || this.hum) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    o.type = "sawtooth";
    o2.type = "sine";
    o.frequency.value = pole === "N" ? 92 : 78;
    o2.frequency.value = (pole === "N" ? 92 : 78) * 2.01;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.15);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start();
    o2.start();
    this.hum = { o, o2, g };
  }
  humOff() {
    const h = this.hum;
    if (!h) return;
    this.hum = null;
    try {
      const t = this.ctx.currentTime;
      h.g.gain.cancelScheduledValues(t);
      h.g.gain.setValueAtTime(Math.max(0.0001, h.g.gain.value), t);
      h.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      h.o.stop(t + 0.15);
      h.o2.stop(t + 0.15);
    } catch (_) {}
  }
  play(name, o = {}) {
    if (!this.ok()) return;
    const now = this.ctx.currentTime;
    // 같은 소리가 너무 잦으면 건너뜀
    const gap = { clank: 0.06, land: 0.08, roll: 0.1 }[name] || 0;
    if (gap && this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case "mag-on":
        this.tone(220, 660, 0.18, { type: "triangle", vol: 0.16 });
        this.tone(440, 880, 0.12, { type: "sine", vol: 0.08, at: 0.06 });
        break;
      case "mag-off":
        this.tone(520, 180, 0.16, { type: "triangle", vol: 0.12 });
        break;
      case "pole":
        // 빙글 도는 소리
        [0, 4, 7, 12].forEach((s, i) => this.tone(523 * SEMI(o.pole === "N" ? s : -s), 523 * SEMI(o.pole === "N" ? s : -s), 0.07, { type: "square", vol: 0.04, at: i * 0.035 }));
        break;
      case "clank": {
        const v = Math.min(1, (o.v || 300) / 900);
        this.tone(900 + Math.random() * 300, 600, 0.12, { type: "triangle", vol: 0.06 + 0.12 * v });
        this.noise(0.06, { vol: 0.04 + 0.08 * v, freq: 3800, q: 3 });
        break;
      }
      case "switch-on":
        this.tone(660, 990, 0.08, { type: "square", vol: 0.06 });
        this.tone(990, 1320, 0.1, { type: "triangle", vol: 0.08, at: 0.06 });
        break;
      case "switch-off":
        this.tone(660, 440, 0.08, { type: "square", vol: 0.04 });
        break;
      case "door-open":
        this.noise(0.35, { vol: 0.08, freq: 600, q: 0.8 });
        this.tone(200, 320, 0.3, { type: "sawtooth", vol: 0.03 });
        break;
      case "exit-open":
        [0, 4, 7, 12].forEach((s, i) => this.tone(659 * SEMI(s), 659 * SEMI(s), 0.16, { type: "triangle", vol: 0.12, at: i * 0.07 }));
        break;
      case "wake":
        // 거대 자석이 깨어남: 낮게 웅 → 높게 반짝
        this.tone(70, 140, 0.9, { type: "sawtooth", vol: 0.06 });
        this.noise(0.6, { vol: 0.06, freq: 300, q: 0.6 });
        [0, 7, 12, 19].forEach((s, i) => this.tone(392 * SEMI(s), 392 * SEMI(s), 0.22, { type: "triangle", vol: 0.11, at: 0.35 + i * 0.09 }));
        break;
      case "lock":
        this.tone(1200, 1500, 0.05, { type: "square", vol: 0.06 });
        this.tone(800, 600, 0.08, { type: "triangle", vol: 0.1, at: 0.04 });
        break;
      case "jump":
        this.tone(330, 620, 0.12, { type: "sine", vol: 0.1 });
        break;
      case "land":
        this.tone(160, 90, 0.08, { type: "sine", vol: 0.08 });
        break;
      case "spring":
        this.tone(220, 880, 0.22, { type: "triangle", vol: 0.14 });
        break;
      case "lever":
        this.noise(0.05, { vol: 0.1, freq: 1500, q: 2 });
        this.tone(500, 700, 0.06, { type: "square", vol: 0.05 });
        break;
      case "gear":
        [0, 7, 12, 19].forEach((s, i) => this.tone(880 * SEMI(s), 880 * SEMI(s), 0.12, { type: "triangle", vol: 0.1, at: i * 0.05 }));
        break;
      case "respawn":
        this.tone(900, 1400, 0.08, { type: "sine", vol: 0.1 });
        break;
      case "fall":
        this.tone(700, 160, 0.4, { type: "triangle", vol: 0.12 });
        break;
      case "squash":
        this.tone(300, 120, 0.14, { type: "sawtooth", vol: 0.06 });
        this.noise(0.1, { vol: 0.06, freq: 400 });
        break;
      case "no-energy":
        this.tone(300, 200, 0.18, { type: "square", vol: 0.05 });
        break;
      case "empty":
        [0, -5].forEach((s, i) => this.tone(330 * SEMI(s), 330 * SEMI(s - 1), 0.18, { type: "triangle", vol: 0.1, at: i * 0.15 }));
        break;
      case "win":
        [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone(587 * SEMI(s), 587 * SEMI(s), 0.16, { type: "triangle", vol: 0.13, at: i * 0.09 }));
        break;
      case "fail":
        [4, 0, -3].forEach((s, i) => this.tone(440 * SEMI(s), 440 * SEMI(s - 1), 0.22, { type: "triangle", vol: 0.11, at: i * 0.17 }));
        break;
      case "tap":
        this.tone(880, 1100, 0.04, { type: "triangle", vol: 0.06 });
        break;
    }
    void now;
  }
}
