/*
 * 펄스 탭 노래 20곡 — 모두 저작권이 끝난 옛 동요 · 민요 · 클래식 멜로디 (가사 없음)
 *  음표: "E4" = 1박, "E4:.5" = 반 박, "R:1" = 쉼
 *  반주는 멜로디에 맞춰 화음을 자동으로 고름
 *  누를 음표는 난이도(코스)에 따라 추림: 코스 1 은 2박마다, 코스 4 는 거의 모든 음
 */
(() => {
  "use strict";

  const COURSES = [
    { name: "과일 정원", buddy: "hippo", step: 2, minGap: 1.05, approach: 2.3, perfect: 0.2, good: 0.42, hearts: 0 },
    { name: "바닷속", buddy: "whale", step: 1, minGap: 0.55, approach: 2.1, perfect: 0.17, good: 0.34, hearts: 5 },
    { name: "과자 나라", buddy: "bear", step: 0.5, minGap: 0.4, approach: 1.9, perfect: 0.14, good: 0.27, hearts: 5 },
    { name: "반짝 우주", buddy: "alien", step: 0.25, minGap: 0.3, approach: 1.75, perfect: 0.12, good: 0.22, hearts: 5 },
  ];

  const RAW = [
    // 코스 1
    { name: "반짝반짝 작은 별", bpm: 84, notes: "C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2" },
    { name: "따끈따끈 빵 노래", bpm: 88, repeat: 4, notes: "E4 D4 C4:2 E4 D4 C4:2 C4:.5 C4:.5 C4:.5 C4:.5 D4:.5 D4:.5 D4:.5 D4:.5 E4 D4 C4:2" },
    { name: "떴다 떴다 비행기", bpm: 92, repeat: 2, notes: "E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4" },
    { name: "달빛 아래서", bpm: 92, notes: "C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4 C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4 D4 D4 D4 D4 A3:2 A3:2 D4 C4 B3 A3 G3:4 C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4" },
    { name: "나비야 나비야", bpm: 96, notes: "G4 E4 E4:2 F4 D4 D4:2 C4 D4 E4 F4 G4 G4 G4:2 G4 E4 E4 E4 F4 D4 D4 D4 C4 E4 G4 G4 E4 E4 E4:2 D4 D4 D4 D4 D4 E4 F4:2 E4 E4 E4 E4 E4 F4 G4:2 G4 E4 E4:2 F4 D4 D4:2 C4 E4 G4 G4 C4:4" },
    // 코스 2
    { name: "런던 다리", bpm: 92, repeat: 2, notes: "G4:1.5 A4:.5 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2 G4:1.5 A4:.5 G4 F4 E4 F4 G4:2 D4:2 G4:2 E4 C4:3" },
    { name: "아침 종소리", bpm: 96, repeat: 2, notes: "C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 C4 G3 C4:2 C4 G3 C4:2" },
    { name: "기쁨의 노래", bpm: 100, repeat: 2, notes: "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2" },
    { name: "맥도널드 농장", bpm: 104, repeat: 2, notes: "C4 C4 C4 G3 A3 A3 G3:2 E4 E4 D4 D4 C4:3 G3 C4 C4 C4 G3 A3 A3 G3:2 E4 E4 D4 D4 C4:4" },
    { name: "생일 축하 노래", bpm: 104, beats: 3, pickup: 1, repeat: 2, notes: "G4:.75 G4:.25 A4 G4 C5 B4:2 G4:.75 G4:.25 A4 G4 D5 C5:2 G4:.75 G4:.25 G5 E5 C5 B4 A4 F5:.75 F5:.25 E5 C5 D5 C5:2" },
    // 코스 3
    { name: "징글벨", bpm: 108, notes: "E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4:1.5 F4:.5 F4 E4 E4 E4:.5 E4:.5 E4 D4 D4 E4 D4:2 G4:2 E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4:1.5 F4:.5 F4 E4 E4 E4:.5 E4:.5 G4 G4 F4 D4 C4:4" },
    { name: "노를 저어요", bpm: 104, beats: 3, compound: true, repeat: 2, notes: "C4:1.5 C4:1.5 C4 D4:.5 E4:1.5 E4 D4:.5 E4 F4:.5 G4:3 C5:.5 C5:.5 C5:.5 G4:.5 G4:.5 G4:.5 E4:.5 E4:.5 E4:.5 C4:.5 C4:.5 C4:.5 G4 F4:.5 E4 D4:.5 C4:3" },
    { name: "오! 수재너", bpm: 108, pickup: 1, repeat: 2, notes: "C4:.5 D4:.5 E4 G4 G4:1.5 A4:.5 G4 E4 C4:1.5 D4:.5 E4 E4 D4 C4 D4:3 C4:.5 D4:.5 E4 G4 G4:1.5 A4:.5 G4 E4 C4:1.5 D4:.5 E4 E4 D4 D4 C4:3" },
    { name: "양키 두들", bpm: 112, repeat: 2, notes: "C4 C4 D4 E4 C4 E4 D4 G3 C4 C4 D4 E4 C4:2 B3:2 C4 C4 D4 E4 F4 E4 D4 C4 B3 G3 A3 B3 C4:2 C4:2" },
    { name: "클레멘타인", bpm: 112, beats: 3, pickup: 1, repeat: 2, notes: "C4:.75 C4:.25 C4 G3 E4:.75 E4:.25 E4 C4 C4:.75 E4:.25 G4:1.5 G4:.5 F4 E4 D4:2 D4:.75 E4:.25 F4 F4 E4:.75 D4:.25 E4 C4 C4:.75 E4:.25 D4 G3 B3:.75 D4:.25 C4:2" },
    // 코스 4
    { name: "성자들의 행진", bpm: 120, pickup: 3, repeat: 2, notes: "C4 E4 F4 G4:4 R:1 C4 E4 F4 G4:4 R:1 C4 E4 F4 G4:2 E4:2 C4:2 E4:2 D4:4 R:1 E4 E4 D4 C4:3 C4 E4:2 G4 G4 F4:3 E4 F4 G4:2 E4:2 C4:2 D4:2 C4:4" },
    { name: "깜짝 족제비", bpm: 112, beats: 3, compound: true, repeat: 3, notes: "C4 C4:.5 D4 D4:.5 E4:.5 G4:.5 E4:.5 C4 G3:.5 C4 C4:.5 D4 D4:.5 E4:1.5 C4 G3:.5 C4 C4:.5 D4 D4:.5 E4:.5 G4:.5 E4:.5 C4:1.5 A4:1.5 D4 F4:.5 E4:1.5 C4:1.5" },
    { name: "캠프타운 달리기", bpm: 116, repeat: 4, notes: "G4:.5 G4:.5 E4:.5 G4:.5 A4:.5 G4:.5 E4 E4:.5 D4:1.5 E4:.5 D4:1.5 G4:.5 G4:.5 E4:.5 G4:.5 A4:.5 G4:.5 E4 D4 E4:.5 D4:.5 C4:2" },
    { name: "캉캉 춤", bpm: 116, repeat: 5, notes: "C4:2 D4:.5 F4:.5 E4:.5 D4:.5 G4 G4 G4:.5 A4:.5 E4:.5 F4:.5 D4 D4 D4:.5 F4:.5 E4:.5 D4:.5 C4:.5 C5:.5 B4:.5 A4:.5 G4:.5 F4:.5 E4:.5 D4:.5" },
    { name: "터키 행진곡", bpm: 108, beats: 2, repeat: 6, notes: "B4:.25 A4:.25 G#4:.25 A4:.25 C5 D5:.25 C5:.25 B4:.25 C5:.25 E5 F5:.25 E5:.25 D#5:.25 E5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 C6:2" },
  ];

  const SEMI = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  const pitchOf = (name) => {
    const m = /^([A-G]#?)(\d)$/.exec(name);
    return SEMI[m[1]] + (Number(m[2]) + 1) * 12;
  };
  const freqOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  /* 고를 수 있는 화음 (근음 · 구성음) */
  const CHORDS = [
    { root: 0, tones: [0, 4, 7], weight: 0.3 }, // C
    { root: 5, tones: [5, 9, 0], weight: 0.1 }, // F
    { root: 7, tones: [7, 11, 2], weight: 0.15 }, // G
    { root: 9, tones: [9, 0, 4], weight: 0 }, // Am
    { root: 2, tones: [2, 5, 9], weight: -0.1 }, // Dm
    { root: 4, tones: [4, 8, 11], weight: -0.2 }, // E
  ];

  function parse(raw) {
    const out = [];
    let pos = 0;
    const repeat = raw.repeat || 1;
    for (let r = 0; r < repeat; r += 1) {
      for (const tok of raw.notes.split(/\s+/)) {
        const [name, durStr] = tok.split(":");
        const dur = durStr ? Number(durStr) : 1;
        if (name !== "R") out.push({ pos, dur, midi: pitchOf(name) });
        pos += dur;
      }
    }
    return { notes: out, length: pos };
  }

  /** 마디마다 멜로디에 가장 잘 맞는 화음 */
  function harmonize(notes, length, beats, pickup) {
    const barOf = (p) => Math.floor((p + (pickup ? beats - pickup : 0)) / beats);
    const bars = barOf(length - 0.001) + 1;
    const out = [];
    for (let b = 0; b < bars; b += 1) {
      const inBar = notes.filter((n) => barOf(n.pos) === b);
      let best = CHORDS[0];
      let score = -Infinity;
      for (const c of CHORDS) {
        let s = c.weight;
        inBar.forEach((n, i) => {
          const hit = c.tones.includes(n.midi % 12);
          s += (hit ? n.dur : -0.35 * n.dur) * (i === 0 ? 1.5 : 1);
          // G# · D# 이 있으면 그에 맞는 화음으로
          if (n.midi % 12 === 8 && c.root === 4) s += 2;
        });
        if (s > score) {
          score = s;
          best = c;
        }
      }
      out.push(b === bars - 1 ? CHORDS[0] : best);
    }
    return { chords: out, barOf };
  }

  function build(raw, index) {
    const courseIdx = Math.floor(index / 5);
    const course = COURSES[courseIdx];
    const beats = raw.beats || 4;
    const beatSec = 60 / raw.bpm;
    const pickup = raw.pickup || 0;
    // 박 세기: 첫 먹이가 맨 위에서 내려올 시간은 꼭 있게
    let countIn = beats + (beats === 2 ? 2 : 0) + (pickup ? beats - pickup : 0);
    while (countIn * beatSec < course.approach + 0.4) countIn += beats;
    const lead = countIn * beatSec;
    const { notes, length } = parse(raw);
    const { chords, barOf } = harmonize(notes, length, beats, pickup);
    const timeOf = (p) => lead + p * beatSec;

    // 누를 음표 고르기 (앞 음 가까이는 건너뜀)
    const eps = 0.001;
    const offset = pickup ? beats - pickup : 0;
    const chart = [];
    let lastT = -9;
    for (const n of notes) {
      const grid = (n.pos + offset) / course.step;
      const onGrid = Math.abs(grid - Math.round(grid)) < eps;
      const t = timeOf(n.pos);
      if (!onGrid || t - lastT < course.minGap) continue;
      chart.push({ time: t, midi: n.midi });
      lastT = t;
    }

    // 소리 일정 (박 세기 · 멜로디 · 반주)
    const events = [];
    for (let i = 0; i < countIn; i += 1) events.push({ t: i * beatSec, type: "click", high: i % beats === 0 });
    for (const n of notes) events.push({ t: timeOf(n.pos), type: "melody", midi: n.midi, dur: n.dur * beatSec });
    const firstBar = pickup ? 1 : 0;
    for (let b = firstBar; b < chords.length; b += 1) {
      const c = chords[b];
      const barStart = timeOf(b * beats - offset);
      if (barStart + 0.01 > timeOf(length)) break;
      const bassMidi = 36 + c.root + (c.root > 7 ? -12 : 0);
      const fifth = bassMidi + 7;
      if (raw.compound) {
        events.push({ t: barStart, type: "bass", midi: bassMidi });
        events.push({ t: barStart + 1.5 * beatSec, type: "bass", midi: fifth });
        events.push({ t: barStart + 0.5 * beatSec, type: "chord", tones: c.tones });
        events.push({ t: barStart + 1 * beatSec, type: "chord", tones: c.tones });
        events.push({ t: barStart + 2 * beatSec, type: "chord", tones: c.tones });
        events.push({ t: barStart + 2.5 * beatSec, type: "chord", tones: c.tones });
      } else if (beats === 3) {
        events.push({ t: barStart, type: "bass", midi: bassMidi });
        events.push({ t: barStart + beatSec, type: "chord", tones: c.tones });
        events.push({ t: barStart + 2 * beatSec, type: "chord", tones: c.tones });
      } else {
        for (let k = 0; k < beats; k += 1) {
          if (k % 2 === 0) events.push({ t: barStart + k * beatSec, type: "bass", midi: k === 0 ? bassMidi : fifth });
          else events.push({ t: barStart + k * beatSec, type: "chord", tones: c.tones });
        }
      }
    }
    events.sort((a, b) => a.t - b.t);
    const lastNote = notes[notes.length - 1];
    const end = timeOf(lastNote.pos + lastNote.dur) + 0.9;
    return { id: index, name: raw.name, bpm: raw.bpm, beats, course: courseIdx, beatSec, lead, countIn, chart, events, end };
  }

  window.PulseSongs = { COURSES, SONGS: RAW.map(build), freqOf };
})();
