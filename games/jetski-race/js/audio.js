/*
 * 제트스키 썬더 레이스 · 소리
 * 바다 물총 대작전의 AudioSystem(WebAudio 합성 · 배경음악 · 사이트 공용 음소거)을 그대로 쓰고
 * 레이싱 소리(엔진 · 물살 · 카운트다운 · 부스트 · 착지 · 추월 · 결승)만 더한다.
 */
import { AudioSystem } from "../../../js/blaster/audio.js?v=3";

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class RaceAudio extends AudioSystem {
  /** 엔진 + 물살 소리 켜기 */
  engineOn() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0.0001;
    out.connect(this.sfxBus);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    lp.Q.value = 2.2;
    lp.connect(out);
    const o1 = c.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 55;
    const o2 = c.createOscillator();
    o2.type = "square";
    o2.frequency.value = 110.6;
    const g2 = c.createGain();
    g2.gain.value = 0.35;
    // 통통거리는 엔진 떨림
    const lfo = c.createOscillator();
    lfo.frequency.value = 18;
    const lg = c.createGain();
    lg.gain.value = 6;
    lfo.connect(lg);
    lg.connect(o1.frequency);
    o1.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    // 물살 쏴아
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 0.6;
    const wg = c.createGain();
    wg.gain.value = 0.0001;
    src.connect(bp);
    bp.connect(wg);
    wg.connect(this.sfxBus);
    o1.start();
    o2.start();
    lfo.start();
    src.start();
    this.engine = { out, lp, o1, o2, lfo, src, bp, wg };
  }

  /** 매 프레임: 속도 0~1.3 · 부스트 · 공중 */
  engineSet(speed, boost, air, idle = false) {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    const s = Math.max(0, Math.min(1.35, speed));
    const f = (idle ? 48 : 52) + s * 92 + (boost ? 34 : 0) + (air ? 26 : 0);
    e.o1.frequency.setTargetAtTime(f, t, 0.06);
    e.o2.frequency.setTargetAtTime(f * 2.01, t, 0.06);
    e.lfo.frequency.setTargetAtTime(14 + s * 20, t, 0.1);
    e.lp.frequency.setTargetAtTime(420 + s * 1500 + (boost ? 900 : 0), t, 0.08);
    e.out.gain.setTargetAtTime(this.sfxOn ? 0.05 + s * 0.035 + (boost ? 0.02 : 0) : 0.0001, t, 0.08);
    e.wg.gain.setTargetAtTime(this.sfxOn && !air ? 0.012 + s * 0.05 + (boost ? 0.03 : 0) : 0.0001, t, 0.1);
    e.bp.frequency.setTargetAtTime(1100 + s * 900, t, 0.1);
  }

  engineOff() {
    const e = this.engine;
    if (!e || !this.ctx) return;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.out.gain.setTargetAtTime(0.0001, t, 0.06);
    e.wg.gain.setTargetAtTime(0.0001, t, 0.06);
    for (const n of [e.o1, e.o2, e.lfo, e.src]) {
      try {
        n.stop(t + 0.3);
      } catch (_) {}
    }
  }

  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    const gap = { land: 120, bump: 150, crash: 200, orb: 60, overtake: 120 }[name] || 30;
    if (now - (this.lastPlay[name] || 0) < gap) return;
    switch (name) {
      case "count":
        this.lastPlay[name] = now;
        this.tone(NOTE(72), 0.22, { type: "square", vol: 0.12 });
        this.tone(NOTE(84), 0.22, { type: "sine", vol: 0.08 });
        return;
      case "go":
        this.lastPlay[name] = now;
        this.tone(NOTE(79), 0.5, { type: "square", vol: 0.13 });
        this.tone(NOTE(91), 0.5, { type: "sine", vol: 0.1 });
        this.tone(NOTE(86), 0.5, { type: "triangle", vol: 0.08 });
        this.noise(0.6, { vol: 0.18, type: "bandpass", freq: 900, to: 3200, q: 0.8 });
        return;
      case "boost":
        this.lastPlay[name] = now;
        this.noise(0.7, { vol: 0.22, type: "bandpass", freq: 500, to: 4200, q: 1.2 });
        this.tone(160, 0.6, { type: "sawtooth", vol: 0.06, slide: 3 });
        this.tone(NOTE(88), 0.18, { type: "sine", vol: 0.06, at: 0.05 });
        return;
      case "orb":
        this.lastPlay[name] = now;
        [84, 88, 91].forEach((n, i) => this.tone(NOTE(n + (opt.n || 0)), 0.14, { type: "sine", vol: 0.1, at: i * 0.05 }));
        return;
      case "jump":
        this.lastPlay[name] = now;
        this.noise(0.4, { vol: 0.12, type: "bandpass", freq: 700, to: 2600 });
        this.tone(300, 0.3, { type: "triangle", vol: 0.06, slide: 2.2 });
        return;
      case "land":
        this.lastPlay[name] = now;
        this.noise(0.55, { vol: 0.26 * (opt.power || 1), type: "lowpass", freq: 1800, to: 300 });
        this.tone(90, 0.25, { type: "sine", vol: 0.14, slide: 0.5 });
        return;
      case "perfectLand":
        this.lastPlay[name] = now;
        [76, 81, 86, 93].forEach((n, i) => this.tone(NOTE(n), 0.2, { type: "triangle", vol: 0.09, at: i * 0.06 }));
        return;
      case "crash":
        this.lastPlay[name] = now;
        this.noise(0.5, { vol: 0.3, type: "lowpass", freq: 1200, to: 200 });
        this.tone(110, 0.3, { type: "square", vol: 0.08, slide: 0.4 });
        return;
      case "bump":
        this.lastPlay[name] = now;
        this.tone(220, 0.18, { type: "sine", vol: 0.12, slide: 0.6 });
        this.noise(0.2, { vol: 0.1, type: "bandpass", freq: 900 });
        return;
      case "overtake":
        this.lastPlay[name] = now;
        [79, 84, 88].forEach((n, i) => this.tone(NOTE(n + (opt.combo || 0) * 2), 0.12, { type: "square", vol: 0.06, at: i * 0.045 }));
        this.noise(0.25, { vol: 0.08, type: "highpass", freq: 3000 });
        return;
      case "chain":
        this.lastPlay[name] = now;
        [72, 79, 84, 91].forEach((n, i) => this.tone(NOTE(n), 0.16, { type: "sawtooth", vol: 0.04, at: i * 0.04 }));
        return;
      case "finish":
        this.lastPlay[name] = now;
        [72, 76, 79, 84, 88, 91].forEach((n, i) => this.tone(NOTE(n), 0.32, { type: "square", vol: 0.07, at: i * 0.08 }));
        this.noise(1, { vol: 0.12, type: "highpass", freq: 2500, at: 0.1 });
        return;
      case "medal":
        this.lastPlay[name] = now;
        [84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), 0.4, { type: "sine", vol: 0.09, at: i * 0.1 }));
        return;
      case "record":
        this.lastPlay[name] = now;
        [79, 83, 86, 91, 95].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: "triangle", vol: 0.1, at: i * 0.07 }));
        return;
      case "thunder":
        this.lastPlay[name] = now;
        this.noise(1.8, { vol: 0.32, type: "lowpass", freq: 260, to: 70, attack: 0.04 });
        this.noise(0.4, { vol: 0.18, type: "bandpass", freq: 900, to: 300 });
        return;
      case "zap":
        this.lastPlay[name] = now;
        this.noise(0.35, { vol: 0.28, type: "highpass", freq: 2400 });
        this.tone(1400, 0.18, { type: "square", vol: 0.05, slide: 0.3 });
        this.noise(0.9, { vol: 0.16, type: "lowpass", freq: 400, to: 90, at: 0.05 });
        return;
      case "warnBeep":
        this.lastPlay[name] = now;
        this.tone(NOTE(81), 0.08, { type: "square", vol: 0.05 });
        this.tone(NOTE(81), 0.08, { type: "square", vol: 0.05, at: 0.14 });
        return;
      case "steam":
        this.lastPlay[name] = now;
        this.noise(1, { vol: 0.2, type: "highpass", freq: 1800, attack: 0.05 });
        return;
      case "tick":
        this.lastPlay[name] = now;
        this.tone(1200, 0.03, { type: "square", vol: 0.03 });
        return;
      case "splashBig":
        this.lastPlay[name] = now;
        this.noise(0.9, { vol: 0.3, type: "lowpass", freq: 2400, to: 300 });
        return;
      default:
        super.play(name, opt);
    }
  }

  destroy() {
    this.engineOff();
    super.destroy();
  }
}
