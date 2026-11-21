/* 오늘의 사건파일 — 효과음 (Web Audio 로 그 자리에서 만듦: 파일 0개)
 * 누르기 전에는 소리를 내지 않는다 (첫 클릭 뒤 AudioContext 생성) · 공용 음소거(TodayAudio)와 게임 설정을 함께 따른다
 */
(() => {
  "use strict";
  let ctx = null;
  let on = true;
  function ac() {
    if (!on) return null;
    if (window.TodayAudio && typeof TodayAudio.isMuted === "function" && TodayAudio.isMuted()) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (_) {
      return null;
    }
  }
  function tone(freq, start, dur, type = "sine", vol = 0.12, slide = 0) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(start, dur, freq = 1800, vol = 0.12, q = 0.8) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }
  const SFX = {
    open: () => { noise(0, 0.35, 900, 0.16); tone(196, 0.05, 0.5, "triangle", 0.06); },
    page: () => noise(0, 0.18, 2600, 0.1, 1.2),
    tap: () => tone(520, 0, 0.08, "triangle", 0.06),
    found: () => { tone(659, 0, 0.18, "sine", 0.1); tone(988, 0.09, 0.32, "sine", 0.09); },
    key: () => { tone(523, 0, 0.16, "triangle", 0.1); tone(784, 0.08, 0.2, "triangle", 0.1); tone(1047, 0.16, 0.38, "sine", 0.08); },
    link: () => { tone(440, 0, 0.12, "sine", 0.08); tone(660, 0.07, 0.12, "sine", 0.08); tone(880, 0.14, 0.4, "sine", 0.08); },
    miss: () => tone(220, 0, 0.22, "triangle", 0.07, -60),
    talk: () => tone(880 + Math.random() * 120, 0, 0.04, "square", 0.025),
    contra: () => { tone(110, 0, 0.6, "sawtooth", 0.07); tone(116.5, 0, 0.6, "sawtooth", 0.06); tone(880, 0.02, 0.25, "square", 0.04, -300); noise(0, 0.25, 400, 0.12); },
    stamp: () => { noise(0, 0.12, 200, 0.4, 0.5); tone(80, 0, 0.25, "sine", 0.25, -30); },
    solved: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.5, "triangle", 0.08)),
    fail: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.5, "triangle", 0.07)),
    grade: () => { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.06, 0.6, "sine", 0.05)); noise(0, 0.6, 6000, 0.05, 0.4); },
  };
  window.CFSfx = {
    play(name) {
      try {
        (SFX[name] || SFX.tap)();
      } catch (_) {}
    },
    setOn(v) {
      on = !!v;
    },
    isOn: () => on,
  };
})();
