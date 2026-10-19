/*
 * 용암 서핑 · 소리
 *  사이트 공용 AudioSystem (WebAudio 합성 · 배경음악 · 사이트 공용 음소거 · 첫 터치 뒤에만 소리) 위에
 *  이 게임 소리를 더한다. 파일 없음 (모두 코드로 합성).
 *   - 계속 나는 소리: 보드 주행음(빠를수록 높고 큼) · 용암 끓는 소리(가까울수록 큼)
 *   - 효과음: 점프 · 착지 · 부딪힘 · 부스터 · 구슬 · 분출 · 불기둥 · 경고 · 풍덩 · 탈출
 *  음악 · 효과음 크기를 따로 조절.
 */
import { AudioSystem } from "../../../js/blaster/audio.js?v=3";

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class LavaAudio extends AudioSystem {
  constructor(settings = {}) {
    super(settings);
    this.musicVol = settings.musicVol ?? 0.7;
    this.sfxVol = settings.sfxVol ?? 0.9;
    this.loops = null;
  }
  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVol();
  }
  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 0.75 * 1.15 * this.sfxVol : 0, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 * 1.2 * this.musicVol : 0, t, 0.05);
  }
  unlock() {
    super.unlock();
    this.applyVol();
    this.startLoops();
  }
  setSfx(on) {
    super.setSfx(on);
    this.applyVol();
  }
  setMusic(on) {
    super.setMusic(on);
    this.applyVol();
  }
  /** 계속 나는 소리 두 개 (보드 · 용암) */
  startLoops() {
    if (!this.ctx || this.loops) return;
    const c = this.ctx;
    const mk = (type, freq, q) => {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      src.playbackRate.value = 0.5 + Math.random() * 0.1;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      g.connect(this.sfxBus);
      src.start();
      return { src, f, g };
    };
    this.loops = { board: mk("bandpass", 600, 0.9), lava: mk("lowpass", 160, 0.7) };
    // 용암: 느린 출렁임
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.7;
    lg.gain.value = 60;
    lfo.connect(lg);
    lg.connect(this.loops.lava.f.frequency);
    lfo.start();
    this.loops.lfo = lfo;
  }
  /** 매 프레임: 주행음(속도 · 땅에 닿음) · 용암 소리(거리) */
  setLoops(speed01, onGround, lavaNear, on = true) {
    if (!this.loops || !this.ctx) return;
    const t = this.ctx.currentTime;
    const L = this.loops;
    const bv = on && onGround ? 0.05 + speed01 * 0.12 : 0;
    L.board.g.gain.setTargetAtTime(bv, t, 0.08);
    L.board.f.frequency.setTargetAtTime(380 + speed01 * 900, t, 0.1);
    L.lava.g.gain.setTargetAtTime(on ? 0.05 + lavaNear * 0.4 : 0, t, 0.2);
  }
  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn || this.sfxVol <= 0) return;
    const now = performance.now();
    const gap = { orb: 25, warn: 380, rumble: 600, fireWarn: 250, scrape: 200, crack: 150, whistle: 220, boom: 120, laserOn: 300, gateOpen: 250, gateClose: 250, fallOn: 400, charge: 200, thunder: 300, roar: 900, stomp: 150, flap: 300 }[name] || 30;
    if (now - (this.lastPlay["_" + name] || 0) < gap) return;
    this.lastPlay["_" + name] = now;
    const r = 1 + (Math.random() - 0.5) * 0.1;
    switch (name) {
      case "jump":
        this.tone(300 * r, 0.16, { type: "sine", vol: 0.13, slide: 2.2 });
        this.noise(0.15, { vol: 0.08, type: "highpass", freq: 2400 });
        break;
      case "launch":
        this.noise(0.4, { vol: 0.16, type: "bandpass", freq: 800, to: 3200, q: 0.8 });
        this.tone(220 * r, 0.3, { type: "triangle", vol: 0.08, slide: 2 });
        break;
      case "land": {
        const k = opt.k || 0.5;
        this.noise(0.18, { vol: 0.12 + k * 0.15, type: "lowpass", freq: 900, to: 200 });
        this.tone(110, 0.12, { type: "sine", vol: 0.08 + k * 0.1, slide: 0.6 });
        break;
      }
      case "trick":
        [0, 4, 7, 12].forEach((d, i) => this.tone(NOTE(76 + d), 0.14, { type: "triangle", vol: 0.08, at: i * 0.05 }));
        break;
      case "spin":
        this.noise(0.4, { vol: 0.1, type: "bandpass", freq: 600, to: 2400, q: 1.4 });
        break;
      case "fail":
        this.tone(300, 0.3, { type: "square", vol: 0.06, slide: 0.5 });
        break;
      case "hit":
        this.noise(0.3, { vol: 0.3, type: "lowpass", freq: 1400, to: 200 });
        this.tone(140, 0.2, { type: "triangle", vol: 0.2, slide: 0.55 });
        this.tone(NOTE(64), 0.16, { type: "square", vol: 0.05, at: 0.1, slide: 0.7 });
        break;
      case "scrape":
        this.noise(0.15, { vol: 0.12, type: "bandpass", freq: 2600 * r, q: 2 });
        break;
      case "boost":
        this.noise(0.9, { vol: 0.22, type: "bandpass", freq: 400, to: 2800, q: 0.7, attack: 0.04 });
        this.tone(180, 0.6, { type: "sawtooth", vol: 0.05, slide: 2.4 });
        break;
      case "pad":
        this.tone(NOTE(72) * r, 0.25, { type: "triangle", vol: 0.1, slide: 1.5 });
        this.noise(0.6, { vol: 0.16, type: "bandpass", freq: 600, to: 3000, q: 0.8 });
        break;
      case "orb": {
        const n = Math.min(14, opt.n || 0);
        const f = NOTE(79 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33][n]);
        this.tone(f, 0.16, { type: "sine", vol: 0.11 });
        this.tone(f * 2, 0.08, { type: "sine", vol: 0.035, at: 0.01 });
        break;
      }
      case "bigOrb":
        [0, 4, 7, 12, 16].forEach((d, i) => this.tone(NOTE(72 + d), 0.28, { type: "triangle", vol: 0.1, at: i * 0.05 }));
        break;
      case "rumble":
        this.noise(1.4, { vol: 0.22, type: "lowpass", freq: 260 * r, to: 70, attack: 0.15 });
        break;
      case "rollStart":
        this.noise(0.8, { vol: 0.26, type: "lowpass", freq: 600, to: 120 });
        this.tone(60, 0.6, { type: "sine", vol: 0.2, slide: 0.7 });
        break;
      case "fireWarn":
        this.noise(0.5, { vol: 0.08, type: "bandpass", freq: 900 * r, q: 3, attack: 0.1 });
        break;
      case "fireOn":
        this.noise(0.9, { vol: 0.24, type: "bandpass", freq: 500, to: 1400, q: 0.6, attack: 0.02 });
        break;
      case "crack":
        this.noise(0.12, { vol: 0.16, type: "bandpass", freq: 2400 * r, q: 2.5 });
        this.tone(160, 0.08, { type: "square", vol: 0.04, slide: 0.6 });
        break;
      case "collapse":
        this.noise(1.2, { vol: 0.28, type: "lowpass", freq: 500, to: 70 });
        break;
      case "erupt":
        this.noise(2.0, { vol: 0.2, type: "lowpass", freq: 300, to: 50, attack: 0.05 });
        this.tone(45, 1.2, { type: "sine", vol: 0.16, slide: 0.6 });
        break;
      case "warn":
        this.tone(NOTE(86), 0.1, { type: "square", vol: 0.05 });
        this.tone(NOTE(86), 0.1, { type: "square", vol: 0.05, at: 0.16 });
        break;
      case "splash":
        this.noise(0.9, { vol: 0.3, type: "lowpass", freq: 900, to: 120 });
        this.tone(200, 0.5, { type: "sine", vol: 0.12, slide: 0.3 });
        break;
      case "caught":
        this.noise(1.6, { vol: 0.32, type: "lowpass", freq: 700, to: 60, attack: 0.05 });
        [7, 4, 0, -5].forEach((d, i) => this.tone(NOTE(67 + d), 0.35, { type: "triangle", vol: 0.1, at: 0.3 + i * 0.18 }));
        break;
      case "checkpoint":
        [0, 4, 7, 12].forEach((d, i) => this.tone(NOTE(74 + d), 0.35, { type: "triangle", vol: 0.1, at: i * 0.07 }));
        break;
      case "ready":
        this.tone(NOTE(72), 0.15, { type: "square", vol: 0.06 });
        break;
      case "go":
        [0, 7, 12].forEach((d, i) => this.tone(NOTE(79 + d), 0.2, { type: "square", vol: 0.06, at: i * 0.05 }));
        break;
      case "clear":
        [0, 4, 7, 12, 16, 19, 24].forEach((d, i) => this.tone(NOTE(67 + d), 0.4, { type: "triangle", vol: 0.1, at: i * 0.08 }));
        [0, 4, 7].forEach((d) => this.tone(NOTE(55 + d), 1.2, { type: "sine", vol: 0.06, at: 0.55 }));
        break;
      case "over":
        [7, 4, 0, -5].forEach((d, i) => this.tone(NOTE(67 + d), 0.4, { type: "triangle", vol: 0.1, at: i * 0.2 }));
        break;
      case "tap":
        this.tone(NOTE(84), 0.06, { type: "sine", vol: 0.07 });
        break;
      case "whistle": // 날아오는 것 (떨어지는 바위 · 용암 덩어리 · 불덩이)
        this.tone(1400 * r, 0.7, { type: "sine", vol: 0.05, slide: 0.45 });
        break;
      case "boom":
        this.noise(0.6, { vol: 0.3, type: "lowpass", freq: 700, to: 80 });
        this.tone(70, 0.4, { type: "sine", vol: 0.2, slide: 0.5 });
        break;
      case "charge": // 번개 모임
        this.noise(0.6, { vol: 0.07, type: "highpass", freq: 3000, attack: 0.3 });
        this.tone(NOTE(84), 0.5, { type: "square", vol: 0.025, slide: 1.4 });
        break;
      case "thunder":
        this.noise(0.12, { vol: 0.35, type: "highpass", freq: 2000 });
        this.noise(1.8, { vol: 0.3, type: "lowpass", freq: 500, to: 60, at: 0.05 });
        break;
      case "zap":
        this.tone(880 * r, 0.25, { type: "sawtooth", vol: 0.08, slide: 0.4 });
        this.noise(0.25, { vol: 0.15, type: "bandpass", freq: 3200, q: 3 });
        break;
      case "laserOn":
        this.tone(NOTE(81), 0.18, { type: "square", vol: 0.04, slide: 1.2 });
        break;
      case "gateOpen":
        this.noise(0.4, { vol: 0.14, type: "bandpass", freq: 500, to: 1400, q: 1.2 });
        this.tone(NOTE(76), 0.12, { type: "triangle", vol: 0.06, at: 0.3 });
        break;
      case "gateClose":
        this.noise(0.35, { vol: 0.16, type: "bandpass", freq: 1200, to: 300, q: 1.2 });
        this.tone(90, 0.2, { type: "square", vol: 0.06, at: 0.3, slide: 0.7 });
        break;
      case "switch":
        [0, 7, 12].forEach((d, i) => this.tone(NOTE(79 + d), 0.12, { type: "square", vol: 0.05, at: i * 0.06 }));
        break;
      case "sinkStart":
        this.noise(0.9, { vol: 0.16, type: "lowpass", freq: 500, to: 120 });
        this.tone(NOTE(55), 0.6, { type: "sine", vol: 0.07, slide: 0.6 });
        break;
      case "fallOn":
        this.noise(1.0, { vol: 0.14, type: "bandpass", freq: 300, to: 900, q: 0.8, attack: 0.1 });
        break;
      case "roar": // 보스 울부짖음
        this.noise(1.6, { vol: 0.3, type: "bandpass", freq: 260, to: 120, q: 1.2, attack: 0.08 });
        this.tone(78, 1.4, { type: "sawtooth", vol: 0.12, slide: 0.7 });
        this.tone(104, 1.2, { type: "square", vol: 0.05, slide: 0.6, at: 0.1 });
        break;
      case "stomp":
        this.noise(0.4, { vol: 0.3, type: "lowpass", freq: 300, to: 50 });
        this.tone(48, 0.35, { type: "sine", vol: 0.25, slide: 0.6 });
        break;
      case "throw":
        this.noise(0.35, { vol: 0.14, type: "bandpass", freq: 400, to: 1600, q: 1 });
        break;
      case "flap":
        this.noise(0.3, { vol: 0.12, type: "lowpass", freq: 600, to: 200 });
        break;
      case "flame":
        this.noise(1.0, { vol: 0.2, type: "bandpass", freq: 700, to: 2000, q: 0.6, attack: 0.05 });
        break;
      case "crystal":
        [0, 7, 12, 19].forEach((d, i) => this.tone(NOTE(84 + d), 0.3, { type: "sine", vol: 0.08, at: i * 0.04 }));
        break;
      case "iceShot":
        this.tone(NOTE(96), 0.4, { type: "sine", vol: 0.08, slide: 0.5 });
        this.noise(0.4, { vol: 0.08, type: "highpass", freq: 4000 });
        break;
      case "bossHit":
        this.noise(0.5, { vol: 0.32, type: "lowpass", freq: 1600, to: 120 });
        [0, 4, 7].forEach((d, i) => this.tone(NOTE(72 + d), 0.2, { type: "square", vol: 0.06, at: 0.05 + i * 0.05 }));
        break;
      case "bossDown":
        this.noise(2.4, { vol: 0.35, type: "lowpass", freq: 900, to: 40 });
        this.tone(40, 1.8, { type: "sine", vol: 0.25, slide: 0.5 });
        [0, 4, 7, 12, 16, 19, 24].forEach((d, i) => this.tone(NOTE(67 + d), 0.4, { type: "triangle", vol: 0.08, at: 0.9 + i * 0.08 }));
        break;
      case "expose": // 약점 드러남
        [0, 3, 7, 10].forEach((d, i) => this.tone(NOTE(76 + d), 0.18, { type: "triangle", vol: 0.08, at: i * 0.06 }));
        break;
      default:
        super.play(name, opt);
    }
  }
  destroy() {
    if (this.loops) {
      try {
        this.loops.board.src.stop();
        this.loops.lava.src.stop();
        this.loops.lfo.stop();
      } catch (_) {}
      this.loops = null;
    }
    super.destroy();
  }
}

export const MUSIC = {
  w1: { bpm: 140, root: 57, scale: "dorian", prog: "minor", lead: "pluck", drums: "storm", pad: true, seed: 33, density: 0.62 },
  w2: { bpm: 146, root: 55, scale: "minor", prog: "minor", lead: "pluck", drums: "storm", pad: true, seed: 61, density: 0.64 },
  w3: { bpm: 138, root: 52, scale: "dorian", prog: "calm", lead: "bell", drums: "storm", pad: true, seed: 77, density: 0.58 },
  w4: { bpm: 150, root: 50, scale: "minor", prog: "boss", lead: "pluck", drums: "storm", pad: true, seed: 91, density: 0.66 },
  w5: { bpm: 152, root: 53, scale: "minor", prog: "minor", lead: "steel", drums: "boss", pad: true, seed: 103, density: 0.66 },
  boss: { bpm: 160, root: 52, scale: "minor", prog: "boss", lead: "pluck", drums: "boss", pad: true, seed: 117, density: 0.72 },
  endless: { bpm: 144, root: 57, scale: "dorian", prog: "bright", lead: "pluck", drums: "storm", pad: true, seed: 131, density: 0.6 },
  ending: { bpm: 96, root: 60, scale: "major", prog: "bright", lead: "bell", drums: "island", pad: true, seed: 149, density: 0.5 },
  title: { bpm: 84, root: 57, scale: "minor", prog: "calm", lead: "bell", drums: "none", pad: true, seed: 21, density: 0.4 },
  play: { bpm: 140, root: 57, scale: "dorian", prog: "minor", lead: "pluck", drums: "storm", pad: true, seed: 33, density: 0.62 },
  surge: { bpm: 156, root: 57, scale: "minor", prog: "boss", lead: "pluck", drums: "boss", pad: true, seed: 44, density: 0.7 },
  clear: { bpm: 100, root: 64, scale: "major", prog: "island", lead: "steel", drums: "island", pad: true, seed: 55, density: 0.5 },
};
