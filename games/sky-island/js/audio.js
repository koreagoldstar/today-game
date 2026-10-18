/*
 * 하늘섬 대탈출 · 소리
 *  사이트 공용 AudioSystem(WebAudio 합성 · 배경음악 · 사이트 공용 음소거 · 첫 터치 뒤에만 소리)을 쓰고
 *  이 게임 소리를 더한다. 파일 다운로드 없음 (모두 코드로 합성 → 라이선스 걱정 없음).
 *  음악 · 효과음 크기를 따로 조절할 수 있다.
 */
import { AudioSystem } from "../../../js/blaster/audio.js?v=3";

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class SkyAudio extends AudioSystem {
  constructor(settings = {}) {
    super(settings);
    this.musicVol = settings.musicVol ?? 0.75;
    this.sfxVol = settings.sfxVol ?? 0.9;
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
  }
  setSfx(on) {
    super.setSfx(on);
    this.applyVol();
  }
  setMusic(on) {
    super.setMusic(on);
    this.applyVol();
  }
  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn || this.sfxVol <= 0) return;
    const now = performance.now();
    const gap = { step: 70, orb: 30, rumble: 260, tileFall: 90, crack: 60, gear: 400, chain: 300, phase: 120, warn: 200, fuse: 300 }[name] || 30;
    if (now - (this.lastPlay["_" + name] || 0) < gap) return;
    this.lastPlay["_" + name] = now;
    const r = 1 + (Math.random() - 0.5) * 0.1;
    switch (name) {
      case "step":
        this.noise(0.05, { vol: 0.05 * (opt.k || 1), type: "bandpass", freq: 900 * r, q: 1.4 });
        break;
      case "jump":
        this.tone(330 * r, 0.16, { type: "sine", vol: 0.13, slide: 2.1 });
        this.tone(660 * r, 0.08, { type: "triangle", vol: 0.04, at: 0.02, slide: 1.6 });
        break;
      case "land": {
        const k = opt.k || 0.5;
        this.noise(0.12, { vol: 0.08 + k * 0.12, type: "lowpass", freq: 700, to: 200 });
        this.tone(120, 0.1, { type: "sine", vol: 0.06 + k * 0.08, slide: 0.6 });
        break;
      }
      case "dash":
        this.noise(0.22, { vol: 0.2, type: "bandpass", freq: 1200, to: 4200, q: 0.9 });
        this.tone(520 * r, 0.14, { type: "triangle", vol: 0.05, slide: 1.8 });
        break;
      case "orb": {
        // 연속으로 먹을수록 음이 올라간다
        const n = Math.min(14, opt.n || 0);
        const f = NOTE(76 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33][n]);
        this.tone(f, 0.18, { type: "sine", vol: 0.12 });
        this.tone(f * 2, 0.1, { type: "sine", vol: 0.04, at: 0.01 });
        break;
      }
      case "bigOrb":
        [0, 4, 7, 12, 16].forEach((d, i) => this.tone(NOTE(72 + d), 0.3, { type: "triangle", vol: 0.1, at: i * 0.06 }));
        this.noise(0.5, { vol: 0.05, type: "highpass", freq: 6000, at: 0.1 });
        break;
      case "crack":
        this.noise(0.08, { vol: 0.14, type: "bandpass", freq: 2400 * r, q: 2.5 });
        this.tone(180 * r, 0.06, { type: "square", vol: 0.03, slide: 0.7 });
        break;
      case "crumble":
        this.noise(0.45, { vol: 0.22, type: "lowpass", freq: 900, to: 160 });
        for (let i = 0; i < 3; i++) this.noise(0.05, { vol: 0.08, type: "bandpass", freq: 1800 + i * 600, q: 3, at: 0.04 + i * 0.07 });
        break;
      case "tileFall":
        this.noise(0.3, { vol: 0.12, type: "lowpass", freq: 600 * r, to: 140 });
        break;
      case "cloud":
        this.tone(520 * r, 0.25, { type: "sine", vol: 0.07, slide: 0.7 });
        this.noise(0.3, { vol: 0.06, type: "lowpass", freq: 1400, to: 400 });
        break;
      case "knock":
        this.tone(160, 0.18, { type: "triangle", vol: 0.22, slide: 0.55 });
        this.noise(0.1, { vol: 0.14, type: "bandpass", freq: 800, q: 1.5 });
        this.tone(900, 0.25, { type: "sine", vol: 0.05, at: 0.08, slide: 0.6 });
        break;
      case "pad":
        this.tone(200 * r, 0.35, { type: "sine", vol: 0.2, slide: 3.2, curve: 0.5 });
        this.tone(400 * r, 0.25, { type: "triangle", vol: 0.06, at: 0.03, slide: 2.6 });
        break;
      case "ring":
        this.noise(0.6, { vol: 0.2, type: "bandpass", freq: 600, to: 3600, q: 0.8 });
        [0, 7, 12].forEach((d, i) => this.tone(NOTE(79 + d), 0.2, { type: "sine", vol: 0.07, at: i * 0.05 }));
        break;
      case "gustWarn":
        this.tone(880, 0.5, { type: "sine", vol: 0.05, slide: 1.3, curve: 0.6 });
        break;
      case "gust":
        this.noise(1.4, { vol: 0.16, type: "bandpass", freq: 500, to: 1600, q: 0.7, attack: 0.15 });
        break;
      case "vent":
        this.noise(0.7, { vol: 0.12, type: "bandpass", freq: 400, to: 1800, q: 0.8, attack: 0.08 });
        break;
      case "checkpoint":
        [0, 4, 7, 12].forEach((d, i) => this.tone(NOTE(74 + d), 0.4, { type: "triangle", vol: 0.1, at: i * 0.08 }));
        break;
      case "pass":
        [0, 7, 12].forEach((d, i) => this.tone(NOTE(79 + d), 0.16, { type: "square", vol: 0.035, at: i * 0.06 }));
        break;
      case "combo":
        this.tone(NOTE(84 + Math.min(12, opt.n || 0)), 0.12, { type: "triangle", vol: 0.07 });
        break;
      case "collapse":
        this.noise(2.2, { vol: 0.28, type: "lowpass", freq: 220, to: 60, attack: 0.3 });
        this.tone(55, 1.6, { type: "sine", vol: 0.18, slide: 0.7, curve: 0.6 });
        break;
      case "rumble":
        this.noise(0.6, { vol: 0.1, type: "lowpass", freq: 260 * r, to: 90 });
        break;
      case "bigFall":
        this.noise(1.2, { vol: 0.16, type: "lowpass", freq: 300, to: 60 });
        this.tone(70, 0.8, { type: "sine", vol: 0.1, slide: 0.5 });
        break;
      case "fall":
        this.tone(900, 0.8, { type: "sine", vol: 0.1, slide: 0.25, curve: 0.7 });
        break;
      case "heart":
        this.tone(NOTE(67), 0.2, { type: "triangle", vol: 0.1 });
        this.tone(NOTE(62), 0.3, { type: "triangle", vol: 0.1, at: 0.15 });
        break;
      case "respawn":
        this.tone(NOTE(72), 0.25, { type: "sine", vol: 0.08, slide: 1.5 });
        this.noise(0.4, { vol: 0.05, type: "highpass", freq: 5000 });
        break;
      case "clear":
        [0, 4, 7, 12, 16, 19, 24].forEach((d, i) => this.tone(NOTE(67 + d), 0.45, { type: "triangle", vol: 0.1, at: i * 0.09 }));
        [0, 4, 7].forEach((d) => this.tone(NOTE(55 + d), 1.2, { type: "sine", vol: 0.06, at: 0.6 }));
        break;
      case "over":
        [7, 4, 0, -5].forEach((d, i) => this.tone(NOTE(67 + d), 0.4, { type: "triangle", vol: 0.1, at: i * 0.2 }));
        break;
      case "start":
        [0, 7, 12].forEach((d, i) => this.tone(NOTE(72 + d), 0.2, { type: "triangle", vol: 0.09, at: i * 0.07 }));
        break;
      case "tap":
        this.tone(NOTE(84), 0.06, { type: "sine", vol: 0.07 });
        break;
      case "ship":
        this.tone(NOTE(60), 0.6, { type: "sawtooth", vol: 0.03, curve: 0.5 });
        this.tone(NOTE(67), 0.6, { type: "sawtooth", vol: 0.03, at: 0.35, curve: 0.5 });
        break;
      /* ---- 스테이지 2~6 장치 · 보스 ---- */
      case "hurt":
        this.tone(220, 0.22, { type: "square", vol: 0.12, slide: 0.5 });
        this.noise(0.18, { vol: 0.16, type: "bandpass", freq: 1200, q: 1.2 });
        this.tone(NOTE(64), 0.16, { type: "triangle", vol: 0.08, at: 0.12, slide: 0.8 });
        break;
      case "warn":
        this.tone(NOTE(88), 0.09, { type: "square", vol: 0.04 });
        this.tone(NOTE(88), 0.09, { type: "square", vol: 0.04, at: 0.14 });
        break;
      case "cannon":
        this.noise(0.5, { vol: 0.3, type: "lowpass", freq: 900, to: 90 });
        this.tone(90, 0.3, { type: "sine", vol: 0.22, slide: 0.4 });
        break;
      case "fuse":
        this.noise(0.5, { vol: 0.06, type: "highpass", freq: 4200 * r, attack: 0.05 });
        break;
      case "boom":
        this.noise(0.7, { vol: 0.26, type: "lowpass", freq: 1400, to: 80 });
        this.tone(70, 0.5, { type: "sine", vol: 0.2, slide: 0.5 });
        break;
      case "thunder":
        this.noise(2.4, { vol: 0.3, type: "lowpass", freq: 500 * r, to: 50, attack: 0.02 });
        this.noise(0.3, { vol: 0.2, type: "highpass", freq: 2200 });
        break;
      case "zap":
        this.noise(0.35, { vol: 0.28, type: "highpass", freq: 1800, to: 600 });
        this.tone(1600 * r, 0.25, { type: "sawtooth", vol: 0.06, slide: 0.2 });
        this.noise(1.2, { vol: 0.12, type: "lowpass", freq: 400, to: 60, at: 0.1 });
        break;
      case "charge":
        this.tone(300 * r, 0.9, { type: "sawtooth", vol: 0.035, slide: 3, curve: 0.6 });
        this.noise(0.9, { vol: 0.04, type: "bandpass", freq: 900, to: 3600, q: 2 });
        break;
      case "crystal":
        [0, 7, 12].forEach((d, i) => this.tone(NOTE(86 + d) * r, 0.5, { type: "sine", vol: 0.05, at: i * 0.04 }));
        break;
      case "phase":
        this.tone(NOTE(79) * r, 0.2, { type: "sine", vol: 0.06, slide: 0.6 });
        break;
      case "shatter":
        for (let i = 0; i < 5; i++) this.tone((1800 + Math.random() * 2400) * r, 0.12, { type: "sine", vol: 0.05, at: i * 0.03 });
        this.noise(0.3, { vol: 0.14, type: "highpass", freq: 3000 });
        break;
      case "spike":
        this.noise(0.12, { vol: 0.16, type: "bandpass", freq: 2600, q: 2 });
        this.tone(700 * r, 0.08, { type: "square", vol: 0.05, slide: 1.6 });
        break;
      case "gear":
        this.noise(0.1, { vol: 0.07, type: "bandpass", freq: 600 * r, q: 4 });
        break;
      case "bell":
        this.tone(NOTE(76), 0.9, { type: "sine", vol: 0.1 });
        this.tone(NOTE(76) * 2.76, 0.6, { type: "sine", vol: 0.03 });
        break;
      case "chain":
        for (let i = 0; i < 3; i++) this.noise(0.05, { vol: 0.06, type: "bandpass", freq: 3200 + i * 500, q: 5, at: i * 0.05 });
        break;
      case "rockFall":
        this.noise(0.5, { vol: 0.2, type: "lowpass", freq: 700 * r, to: 120 });
        break;
      case "bridge":
        this.noise(0.8, { vol: 0.08, type: "bandpass", freq: 500, q: 2 });
        this.tone(80, 0.6, { type: "sawtooth", vol: 0.04, slide: 1.3 });
        break;
      case "roar":
        this.tone(95, 1.6, { type: "sawtooth", vol: 0.18, slide: 0.6, curve: 0.5 });
        this.tone(142, 1.4, { type: "sawtooth", vol: 0.1, slide: 0.55, at: 0.05 });
        this.noise(1.6, { vol: 0.2, type: "bandpass", freq: 500, to: 180, q: 0.8, attack: 0.15 });
        break;
      case "stomp":
        this.noise(0.5, { vol: 0.3, type: "lowpass", freq: 300, to: 50 });
        this.tone(55, 0.4, { type: "sine", vol: 0.25, slide: 0.6 });
        break;
      case "fire":
        this.noise(1.4, { vol: 0.22, type: "bandpass", freq: 700, to: 300, q: 0.6, attack: 0.1 });
        break;
      case "bossHit":
        this.tone(NOTE(84), 0.12, { type: "square", vol: 0.08 });
        this.tone(NOTE(91), 0.2, { type: "square", vol: 0.07, at: 0.06 });
        this.noise(0.4, { vol: 0.24, type: "bandpass", freq: 1600, to: 400, q: 1 });
        this.tone(120, 0.4, { type: "triangle", vol: 0.18, slide: 0.5 });
        break;
      case "weak":
        [0, 5, 10].forEach((d, i) => this.tone(NOTE(81 + d), 0.14, { type: "triangle", vol: 0.07, at: i * 0.05 }));
        break;
      case "bossDown":
        this.noise(3, { vol: 0.3, type: "lowpass", freq: 600, to: 40, attack: 0.1 });
        [12, 7, 4, 0].forEach((d, i) => this.tone(NOTE(48 + d), 0.8, { type: "sawtooth", vol: 0.06, at: i * 0.3, slide: 0.8 }));
        break;
      default:
        super.play(name, opt);
    }
  }
}

/** 배경 음악 분위기 */
export const MUSIC = {
  title: { bpm: 84, root: 62, scale: "major", prog: "calm", lead: "bell", drums: "none", pad: true, seed: 11, density: 0.4 },
  play: { bpm: 112, root: 64, scale: "major", prog: "bright", lead: "marimba", drums: "soft", pad: true, seed: 5, density: 0.55 },
  escape: { bpm: 138, root: 62, scale: "minor", prog: "minor", lead: "pluck", drums: "boss", pad: true, seed: 9, density: 0.62 },
  clear: { bpm: 96, root: 67, scale: "major", prog: "island", lead: "steel", drums: "island", pad: true, seed: 3, density: 0.5 },
  // 스테이지마다 다른 분위기
  canyon: { bpm: 120, root: 62, scale: "dorian", prog: "island", lead: "flute", drums: "island", pad: true, seed: 21, density: 0.55 },
  harbor: { bpm: 108, root: 65, scale: "major", prog: "calm", lead: "steel", drums: "island", pad: true, seed: 33, density: 0.55 },
  cave: { bpm: 92, root: 61, scale: "minorPenta", prog: "minor", lead: "bell", drums: "soft", pad: true, seed: 44, density: 0.42 },
  storm: { bpm: 126, root: 59, scale: "minor", prog: "minor", lead: "pluck", drums: "storm", pad: true, seed: 55, density: 0.6 },
  dragon: { bpm: 116, root: 57, scale: "minor", prog: "minor", lead: "flute", drums: "soft", pad: true, seed: 66, density: 0.5 },
  boss: { bpm: 150, root: 57, scale: "minor", prog: "boss", lead: "pluck", drums: "boss", pad: true, seed: 77, density: 0.7 },
  ending: { bpm: 88, root: 67, scale: "major", prog: "calm", lead: "bell", drums: "soft", pad: true, seed: 88, density: 0.45 },
};
