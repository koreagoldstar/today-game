/*
 * 펄스 탭 곡 20개 — 진짜 전자음 곡(CC0 · assets/audio/hip/CREDITS.txt)의 실제 박자에 음표를 얹음
 *  bpm · beat0 은 mp3 를 디코딩해 킥 소리 위치로 잰 값 (표기 BPM 과 다른 곡이 많아 직접 쟀음)
 *  kick: 마디별 킥 세기(0~9) → 조용한 마디는 음표를 줄임
 *  음표는 한 마디 16칸 패턴. 코스가 오를수록 촘촘해짐
 */
(() => {
  "use strict";

  const COURSES = [
    { name: "네온 스테이지", approach: 2.0, perfect: 0.16, good: 0.34, hearts: 0 },
    { name: "레이저 클럽", approach: 1.8, perfect: 0.14, good: 0.28, hearts: 5 },
    { name: "선셋 드라이브", approach: 1.6, perfect: 0.12, good: 0.2, hearts: 5 },
    { name: "스타 아레나", approach: 1.45, perfect: 0.1, good: 0.16, hearts: 5 },
  ];

  const TRACKS = {
    hip01: { bpm: 89.994, beat0: 0.1797, kick: "8798798889886888879878979979979979978979879978979879879879500" },
    hip02: { bpm: 127.998, beat0: 0.011, kick: "4444887788878889888788889778888778878888888888888888444487887878887888888888877888878888888788888898889" },
    hip03: { bpm: 127.996, beat0: 0.1209, kick: "4142324298899899313265629998999955655665019999989" },
    hip04: { bpm: 127.992, beat0: 0.1648, kick: "999967676667676667675555555567666766" },
    hip05: { bpm: 125, beat0: 0.1238, kick: "433254335555668878777789787777897777778977777789456645755565556622433344324322457777778877778779777776887878778943" },
    cyber05: { bpm: 120.024, beat0: 0.0664, kick: "9999999999999999" },
  };

  /* 코스별 패턴 (마디 16칸) */
  const PATTERNS = [
    { main: [0, 8], vary: [[0, 8]], fill: [0, 8, 12], quiet: [0] },
    { main: [0, 4, 8, 12], vary: [[0, 4, 8], [0, 8, 12], [0, 4, 12]], fill: [0, 4, 8, 12], quiet: [0, 8] },
    { main: [0, 4, 8, 12], vary: [[0, 4, 6, 8, 12], [0, 4, 8, 10, 12], [0, 6, 8, 12]], fill: [0, 2, 4, 8, 10, 12], quiet: [0, 8] },
    { main: [0, 4, 6, 8, 12], vary: [[0, 3, 6, 8, 12], [0, 4, 8, 10, 12, 14], [0, 2, 4, 8, 11, 14]], fill: [0, 2, 4, 6, 8, 10, 12, 14], quiet: [0, 4, 8, 12] },
  ];

  /* 이름 · 곡 · 시작 마디 · 마디 수 */
  const RAW = [
    ["원버튼 스톰", "cyber05", 2, 13],
    ["펄스 캐논", "hip04", 2, 22],
    ["비트 펀치", "hip02", 6, 22],
    ["네온 원샷", "hip05", 14, 22],
    ["하이퍼 클릭", "hip03", 8, 24],
    ["제로 미스", "hip04", 12, 23],
    ["플래시 탭", "hip02", 28, 24],
    ["메가 펄스", "hip05", 24, 24],
    ["핑크 트리거", "hip02", 58, 22],
    ["볼트 탭", "hip05", 86, 24],
    ["슈퍼 클릭", "hip02", 80, 22],
    ["울트라 탭", "hip04", 4, 30],
    ["글리치 펀치", "hip01", 2, 20],
    ["핫 트리거", "hip05", 14, 28],
    ["탭 메가톤", "hip03", 8, 24],
    ["인피니티 탭", "hip02", 6, 24],
    ["레이저 원샷", "hip05", 86, 26],
    ["코어 펄스", "hip01", 24, 20],
    ["스타 드롭", "hip04", 6, 28],
    ["라스트 비트", "hip02", 58, 44],
  ];

  function rng(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function build(raw, index) {
    const [name, track, startBar, bars] = raw;
    const T = TRACKS[track];
    const courseIdx = Math.floor(index / 5);
    const course = COURSES[courseIdx];
    const P = PATTERNS[courseIdx];
    const beat = 60 / T.bpm;
    const barSec = beat * 4;
    const barTime = (b) => T.beat0 + b * barSec;
    // 음악은 첫 음표보다 앞에서 시작 (먹이가 내려올 시간 + 카운트다운)
    let leadBars = 1;
    while (leadBars * barSec < course.approach + 0.5 && startBar - leadBars > 0) leadBars += 1;
    const startAt = barTime(startBar - leadBars);
    const r = rng(1000 + index * 77);
    const pick = (list) => list[Math.floor(r() * list.length) % list.length];
    const vary = [pick(P.vary), pick(P.vary), pick(P.vary)];
    const chart = [];
    let peak = 0;
    for (let b = startBar; b < startBar + bars; b += 1) peak = Math.max(peak, Number(T.kick[b] || 0));
    for (let i = 0; i < bars; i += 1) {
      const b = startBar + i;
      const level = Number(T.kick[b] || 0);
      const ph = i % 8;
      let pat = ph === 7 ? P.fill : ph === 1 ? vary[0] : ph === 3 ? vary[1] : ph === 5 ? vary[2] : P.main;
      // 쉬운 코스 앞 곡은 채움 없이
      if (courseIdx === 0 && index < 2) pat = P.main;
      if (level < peak * 0.45) pat = P.quiet;
      if (i === bars - 1) pat = [0];
      for (const s of pat) chart.push({ time: barTime(b) + (s * beat) / 4 - startAt, bar: i, step: s });
    }
    const end = barTime(startBar + bars) - startAt;
    return {
      id: index,
      name,
      track,
      src: `/assets/audio/hip/${track}.mp3`,
      bpm: Math.round(track === "hip01" ? T.bpm * 2 : T.bpm),
      course: courseIdx,
      beatSec: beat,
      barSec,
      startAt,
      lead: barTime(startBar) - startAt,
      chart,
      end,
    };
  }

  window.PulseSongs = { COURSES, TRACKS, SONGS: RAW.map(build) };
})();
