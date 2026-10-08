/*
 * 바다괴물 탐험대 · 소리
 * 바다 물총 대작전의 AudioSystem(WebAudio 합성 · 배경음악 · 사이트 공용 음소거)을 그대로 쓰고
 * 물속 소리(레이더 삐 · 소나 · 발견 · 괴물마다 다른 맞는 소리 · 포획 · 산소 경보 · 물속 웅웅)를 더한다.
 */
import { AudioSystem } from "../../../js/blaster/audio.js?v=3";

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class SeaAudio extends AudioSystem {
  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    const gap = { hitSoft: 45, hitPuff: 45, hitShell: 45, hitEel: 45, steam: 60, blocked: 70, tell: 120, coin: 40, radar: 40 }[name] || 25;
    if (now - (this.lastPlay["s" + name] || 0) < gap) return;
    this.lastPlay["s" + name] = now;
    const r = 1 + (Math.random() - 0.5) * 0.1;
    switch (name) {
      case "radar": {
        // 삐 — 가까울수록 높고 짧게
        const lv = opt.lv || 1;
        this.tone(1250 + lv * 130, 0.07, { type: "sine", vol: 0.05 + lv * 0.012, curve: 0.25 });
        if (lv >= 5) this.tone(1250 + lv * 130, 0.06, { type: "sine", vol: 0.06, at: 0.09 });
        break;
      }
      case "sonar":
        this.tone(1900, 0.9, { type: "sine", vol: 0.12, slide: 0.45, curve: 0.5 });
        this.tone(1900, 0.6, { type: "sine", vol: 0.04, at: 0.35, slide: 0.45, curve: 0.5 });
        this.noise(0.5, { vol: 0.05, type: "bandpass", freq: 900, q: 3 });
        break;
      case "tell":
        // 숨은 괴물 근처 '뽀글'
        for (let i = 0; i < 3; i++) this.tone((300 + Math.random() * 200) * r, 0.05, { type: "sine", vol: 0.04 * (opt.v || 1), at: i * 0.06, slide: 1.9 });
        break;
      case "discover":
        // 기포 '쏴' + 올라가는 아르페지오
        this.noise(0.35, { vol: 0.12, type: "bandpass", freq: 1200, to: 3200, q: 1.2 });
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(NOTE(72 + s), 0.16, { type: "triangle", vol: 0.1, at: 0.08 + i * 0.06 }));
        this.tone(NOTE(88), 0.5, { type: "sine", vol: 0.06, at: 0.4 });
        break;
      case "hitSoft": // 문어 · 말랑한 몸
        this.tone(260 * r, 0.12, { type: "sine", vol: 0.18, slide: 0.6 });
        this.noise(0.06, { vol: 0.06, type: "lowpass", freq: 900 });
        break;
      case "hitPuff": // 복어 · 통통
        this.tone(480 * r, 0.1, { type: "triangle", vol: 0.14, slide: 1.5 });
        break;
      case "hitShell": // 게 · 조개 · 단단한 껍데기
        this.tone(820 * r, 0.07, { type: "square", vol: 0.05, slide: 0.8 });
        this.noise(0.05, { vol: 0.07, type: "bandpass", freq: 2600, q: 3 });
        break;
      case "hitEel": // 곰치 · 미끌
        this.tone(560 * r, 0.12, { type: "sine", vol: 0.12, slide: 0.5 });
        this.tone(760 * r, 0.08, { type: "sine", vol: 0.06, at: 0.04, slide: 1.4 });
        break;
      case "blocked": // 닫힌 조개 '팅'
        this.tone(1800 * r, 0.12, { type: "triangle", vol: 0.08 });
        this.tone(2700 * r, 0.08, { type: "sine", vol: 0.04, at: 0.01 });
        break;
      case "windup": // 공격 준비 경고
        this.tone(330, 0.32, { type: "sawtooth", vol: 0.035, slide: 1.8, curve: 0.6 });
        break;
      case "ink":
        this.noise(0.45, { vol: 0.12, type: "lowpass", freq: 500, to: 150 });
        this.tone(140, 0.3, { type: "sine", vol: 0.12, slide: 0.6 });
        break;
      case "puff":
        this.tone(180 * r, 0.25, { type: "triangle", vol: 0.15, slide: 2.4 });
        this.noise(0.15, { vol: 0.06, type: "bandpass", freq: 1500, q: 1 });
        break;
      case "snap":
        this.noise(0.05, { vol: 0.15, type: "highpass", freq: 3000 });
        this.tone(900, 0.05, { type: "square", vol: 0.04 });
        break;
      case "burrow":
        this.noise(0.6, { vol: 0.14, type: "lowpass", freq: 700, to: 200 });
        break;
      case "spit":
        this.tone(700 * r, 0.12, { type: "sine", vol: 0.12, slide: 0.5 });
        this.noise(0.1, { vol: 0.06, type: "bandpass", freq: 1800 });
        break;
      case "chomp":
        this.noise(0.08, { vol: 0.16, type: "bandpass", freq: 900, q: 2 });
        this.tone(200, 0.1, { type: "square", vol: 0.05, slide: 0.6 });
        break;
      case "clamShut":
        this.tone(420 * r, 0.06, { type: "square", vol: 0.04, slide: 0.7 });
        break;
      case "capture":
        // 포획 물방울 '뽀옹' + 반짝
        this.tone(300, 0.35, { type: "sine", vol: 0.16, slide: 2.8, curve: 0.5 });
        [0, 7, 12].forEach((s, i) => this.tone(NOTE(84 + s), 0.14, { type: "triangle", vol: 0.08, at: 0.2 + i * 0.05 }));
        break;
      case "release":
        // 물방울이 터지고 카드가 나올 때
        this.noise(0.18, { vol: 0.12, type: "highpass", freq: 2500 });
        [0, 4, 7, 11, 14].forEach((s, i) => this.tone(NOTE(79 + s), 0.14, { type: "triangle", vol: 0.09, at: i * 0.045 }));
        break;
      case "coin":
        this.tone(NOTE(88) * r, 0.08, { type: "square", vol: 0.035 });
        this.tone(NOTE(95) * r, 0.12, { type: "sine", vol: 0.06, at: 0.05 });
        break;
      case "hurt":
        this.noise(0.25, { vol: 0.16, type: "lowpass", freq: 700, to: 200 });
        this.tone(220, 0.25, { type: "triangle", vol: 0.12, slide: 0.55 });
        break;
      case "o2low":
        this.tone(880, 0.1, { type: "square", vol: 0.04 });
        this.tone(880, 0.1, { type: "square", vol: 0.04, at: 0.16 });
        break;
      case "dive":
        this.noise(0.9, { vol: 0.28, type: "lowpass", freq: 2800, to: 250, q: 0.5 });
        for (let i = 0; i < 8; i++) this.tone((260 + Math.random() * 500) * r, 0.06, { type: "sine", vol: 0.05, at: 0.15 + i * 0.07, slide: 1.9 });
        break;
      case "zap": // 찌릿 번쩍
        this.noise(0.22, { vol: 0.14, type: "highpass", freq: 2400 });
        this.tone(140 * r, 0.22, { type: "sawtooth", vol: 0.06, slide: 0.5 });
        this.tone(1800 * r, 0.12, { type: "square", vol: 0.025, slide: 0.4 });
        break;
      case "charge": // 전기 모으기 지잉
        this.tone(220, 0.5, { type: "sawtooth", vol: 0.03, slide: 3, curve: 0.7 });
        break;
      case "swap": // 분신 휙
        this.tone(900 * r, 0.14, { type: "sine", vol: 0.07, slide: 1.8 });
        this.tone(1300 * r, 0.1, { type: "sine", vol: 0.04, at: 0.06, slide: 0.6 });
        break;
      case "geyser": // 용암 분수 쿠르릉
        this.noise(0.8, { vol: 0.2, type: "lowpass", freq: 900, to: 300 });
        this.tone(70, 0.6, { type: "sawtooth", vol: 0.06, slide: 0.7 });
        break;
      case "steam": // 치익 (뜨거운 등딱지에 물)
        this.noise(0.16, { vol: 0.09, type: "highpass", freq: 3200 });
        this.tone(1400 * r, 0.06, { type: "sine", vol: 0.03, slide: 0.6 });
        break;
      case "rumble":
        this.noise(0.5, { vol: 0.08, type: "lowpass", freq: 260 });
        break;
      case "crack": // 고드름 금 가는 소리
        this.tone(2400 * r, 0.05, { type: "square", vol: 0.03 });
        this.tone(1900 * r, 0.05, { type: "square", vol: 0.03, at: 0.07 });
        break;
      case "shatter": // 얼음 와장창
        this.noise(0.3, { vol: 0.12, type: "highpass", freq: 3000 });
        [0, 0.03, 0.07].forEach((at, i) => this.tone((2600 + i * 500) * r, 0.08, { type: "triangle", vol: 0.04, at }));
        break;
      case "freeze": // 얼어붙음
        this.tone(1600, 0.4, { type: "sine", vol: 0.06, slide: 0.5 });
        this.noise(0.3, { vol: 0.05, type: "bandpass", freq: 4000, q: 2 });
        break;
      case "gulp": // 꿀꺽 (큰 입)
        this.tone(160 * r, 0.25, { type: "sine", vol: 0.16, slide: 0.5 });
        this.noise(0.15, { vol: 0.08, type: "lowpass", freq: 600 });
        break;
      case "superCombo":
        [0, 4, 7, 12, 16, 19].forEach((s, i) => this.tone(NOTE(76 + s), 0.12, { type: "square", vol: 0.04, at: i * 0.04 }));
        break;
      default:
        super.play(name, opt);
    }
  }

  /** 물속 웅웅 + 가끔 뽀글 (깊을수록 낮게) */
  ambienceOn() {
    if (!this.ctx || this.amb) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    lp.Q.value = 0.7;
    const g = c.createGain();
    g.gain.value = 0.0001;
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfxBus);
    src.start();
    g.gain.setTargetAtTime(0.05, c.currentTime, 0.6);
    this.amb = { src, lp, g, t: 0 };
  }
  ambienceSet(depthK, dt) {
    const a = this.amb;
    if (!a || !this.ctx) return;
    a.lp.frequency.setTargetAtTime(380 - depthK * 220, this.ctx.currentTime, 0.5);
    a.t -= dt;
    if (a.t <= 0) {
      a.t = 0.8 + Math.random() * 2.2;
      if (this.sfxOn) for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(220 + Math.random() * 380, 0.05, { type: "sine", vol: 0.02, at: i * 0.07, slide: 1.8 });
    }
  }
  ambienceOff() {
    const a = this.amb;
    if (!a || !this.ctx) return;
    this.amb = null;
    a.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    a.src.stop(this.ctx.currentTime + 1.2);
  }
}
