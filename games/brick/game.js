/* 별똥별 벽돌깨기 — 다시 만든 판
 *
 * - 5개 하늘 50단계: 그림 모양 판 + 10단계마다 보스. 단계 선택 · 별 3개 · 총점 = 단계별 최고의 합.
 * - 공은 고정 걸음(1/240초)으로 움직여 벽돌을 뚫고 지나가지 않는다.
 * - 아이템 7가지, 폭탄 벽돌, 쇠 벽돌, 안 깨지는 바위, 움직이는 판.
 * - 그림은 화면 픽셀로. 벽돌은 미리 구워 두어 그림자를 매 프레임 계산하지 않는다.
 */
(() => {
  "use strict";

  const W = 390;
  let H = 700;
  const STEP = 1 / 240;
  const COLS = 11;
  const PAD = 10;
  const GAP = 3;
  const BW = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const BH = 22;
  const ROW_H = BH + GAP;
  const TOP = 86;
  const GRID_Y = TOP + 22;
  const SAVE_KEY = "brick-v2";
  const BALL_R = 9;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 판 ---------- */
  const NAMES = [
    "첫 번째 밤하늘", "반짝이는 은하", "유성우의 밤", "오로라 정원", "별빛 호수", "달빛 성", "혜성 골목", "네뷸라 광장", "별똥별 축제", "은하수 다리",
    "흑성 습격", "별가루 폭풍", "코스믹 미로", "달토끼 밤", "유성 레이스", "오로라 결전", "별빛 대서사", "우주 정원", "최종 혜성", "별의 왕관",
    "초신성 파도", "암흑성운", "유성 요새", "달그림자 성", "별무리 습격", "혜성 고속도로", "네온 성운", "은하 미로", "오로라 폭풍", "별똥별 결전",
    "코스믹 레이스", "달빛 결투", "흑성 왕좌", "별가루 신전", "유성 왕관", "네뷸라 심연", "은하수 정상", "달토끼 전설", "초신성 축제", "별빛 신화",
    "암흑 혜성", "오로라 왕국", "우주 요새", "최종 성운", "별무리 왕관", "달빛 대서사", "혜성 신화", "은하 결전", "코스믹 왕좌", "별의 전설",
  ];
  const WORLDS = [
    { name: "보라 밤하늘", tint: null, glow: "#b58cff" },
    { name: "오로라 정원", tint: "rgba(20,120,110,0.34)", glow: "#7dffd0" },
    { name: "노을 유성", tint: "rgba(190,70,70,0.36)", glow: "#ffb07a" },
    { name: "얼음 달빛", tint: "rgba(40,130,210,0.34)", glow: "#9fe2ff" },
    { name: "우주 심연", tint: "rgba(14,6,40,0.55)", glow: "#ff8ab5" },
  ];
  const BOSSES = [
    { name: "유성 대장", color: "#ff9a5c", dark: "#a8481f", hp: 14 },
    { name: "오로라 왕", color: "#5fe0b8", dark: "#1f8068", hp: 20 },
    { name: "불꽃 혜성", color: "#ff6f6f", dark: "#a02a3a", hp: 26 },
    { name: "얼음 달", color: "#8fd0ff", dark: "#2e6fa8", hp: 32 },
    { name: "어둠 별", color: "#c78cff", dark: "#5a2a9a", hp: 40 },
  ];
  const COLORS = ["#ff8ab5", "#ff9a6b", "#ffe27a", "#9df27a", "#7ec8ff", "#c9a0ff"];

  const MOTIFS = {
    PYRAMID: [".....#.....", "....###....", "...#####...", "..#######..", ".#########.", "###########"],
    HEART: ["..##...##..", ".####.####.", "###########", "###########", ".#########.", "..#######..", "...#####...", "....###....", ".....#....."],
    STRIPES: ["###########", "...........", "###########", "...........", "###########", "...........", "###########"],
    STAR: [".....#.....", "....###....", "...#####...", "###########", ".#########.", "..#######..", "..#######..", ".####.####.", ".##.....##."],
    SMILE: ["..#######..", ".#########.", "##..###..##", "##..###..##", "###########", "#.#######.#", "##.#####.##", ".##.....##.", "..#######.."],
    COLUMNS: ["##.##.##.##", "##.##.##.##", "##.##.##.##", "##.##.##.##", "##.##.##.##", "##.##.##.##"],
    MOON: ["...######..", "..####.....", ".####......", ".####......", ".####......", ".####......", "..####.....", "...######.."],
    ROCKET: [".....#.....", "....###....", "....###....", "...#####...", "...#.#.#...", "...#####...", "..#######..", ".##.###.##.", ".#...#...#."],
    CHECKER: ["#.#.#.#.#.#", ".#.#.#.#.#.", "#.#.#.#.#.#", ".#.#.#.#.#.", "#.#.#.#.#.#", ".#.#.#.#.#."],
    DIAMOND: [".....#.....", "....###....", "...#####...", "..#######..", ".#########.", "..#######..", "...#####...", "....###....", ".....#....."],
    CAT: ["#.........#", "##.......##", "###########", "###########", "##..###..##", "###########", "####.#.####", "###########", ".#########."],
    FRAME: ["###########", "#.........#", "#.#######.#", "#.#.....#.#", "#.#.###.#.#", "#.#.....#.#", "#.#######.#", "#.........#", "###########"],
    UFO: ["....###....", "...#####...", ".#########.", "###########", ".#.#.#.#.#.", "...........", "...#...#..."],
    WAVES: ["##...##...#", "###.####.##", ".#####.####", "..###...###", "##...##...#", "###.####.##", ".#####.####", "..###...###"],
    CROWN: ["#....#....#", "##..###..##", "###.###.###", "###########", "###########", ".#########."],
    ARROWS: ["#....#....#", ".#...#...#.", "..#..#..#..", "...#.#.#...", "....###....", ".....#....."],
    RABBIT: ["..##...##..", "..##...##..", "..##...##..", "..#######..", ".#########.", ".##.###.##.", ".#########.", "..#######.."],
    SATURN: ["....###....", "...#####...", "#.#######.#", "###########", "#.#######.#", "...#####...", "....###...."],
    COMET: [".........##", ".......####", ".....######", "...######..", "..#####....", ".#####.....", "#####......", "####.......", ".##........"],
    SPIRAL: ["###########", "..........#", "#########.#", "#.......#.#", "#.#####.#.#", "#.#...#.#.#", "#.#.###.#.#", "#.#.....#.#", "#.#######.#"],
  };
  const ORDER = [
    ["PYRAMID", "HEART", "STRIPES", "STAR", "SMILE", "COLUMNS", "MOON", "ROCKET", "CHECKER"],
    ["DIAMOND", "CAT", "FRAME", "UFO", "WAVES", "CROWN", "ARROWS", "RABBIT", "SATURN"],
    ["COMET", "STAR", "SPIRAL", "HEART", "ROCKET", "CHECKER", "SMILE", "COLUMNS", "CROWN"],
    ["FRAME", "RABBIT", "WAVES", "SATURN", "DIAMOND", "UFO", "ARROWS", "CAT", "STRIPES"],
    ["SPIRAL", "COMET", "CROWN", "SMILE", "ROCKET", "FRAME", "STAR", "WAVES", "HEART"],
  ];

  const stageInfo = (i) => ({ w: Math.floor(i / 10), k: i % 10, boss: i % 10 === 9 });

  // 판 설계도: 글자 격자 (.빈칸 j젤리 H단단 I쇠 R바위 B폭탄 S별)
  function layout(i) {
    const { w, k, boss } = stageInfo(i);
    const rng = seeded(i * 131 + 7);
    const rows = [];
    if (boss) {
      const base = w < 2 ? ["...........", "...........", "...........", "...........", "...........", "...........", "#.#.#.#.#.#"] : ["...........", "...........", "...........", "...........", "...........", "...........", "H#H#H#H#H#H", ".#.#.#.#.#."];
      for (const r of base) rows.push(r.split("").map((c) => (c === "#" ? "j" : c)));
      return rows;
    }
    const motif = MOTIFS[ORDER[w][k]];
    const pIron = w >= 2 ? (w - 1) * 0.05 + k * 0.004 : 0;
    const pHard = i < 3 ? 0 : 0.06 + w * 0.08 + k * 0.012;
    // 왼쪽 반을 정하고 오른쪽은 거울로 (모양이 예쁘게 유지)
    const cols = (COLS + 1) >> 1;
    const decided = {};
    motif.forEach((line, r) => {
      rows[r] = line.split("").map((c) => (c === "#" ? "j" : "."));
      for (let c = 0; c < cols; c += 1) {
        const mirror = COLS - 1 - c;
        if (rows[r][c] !== "j" && line[mirror] !== "#") continue;
        const v = rng();
        const t = v < pIron ? "I" : v < pIron + pHard ? "H" : "j";
        decided[`${r},${c}`] = t;
        if (line[c] === "#") rows[r][c] = t;
        if (line[mirror] === "#") rows[r][mirror] = t;
      }
    });
    // 폭탄 · 별 벽돌
    const fills = [];
    rows.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v === "j" && c < cols - 0) fills.push([r, c]);
      })
    );
    const place = (char, n) => {
      for (let m = 0; m < n && fills.length; m += 1) {
        const idx = Math.floor(rng() * fills.length);
        const [r, c] = fills.splice(idx, 1)[0];
        rows[r][c] = char;
        if (rows[r][COLS - 1 - c] === "j") rows[r][COLS - 1 - c] = char;
      }
    };
    if (i >= 2) place("B", 1 + Math.floor((w + k / 5) / 2));
    place("S", 2 + (k % 3 === 0 ? 1 : 0));
    // 바위: 판 아래 줄에 문처럼
    if (w >= 1 && k % 2 === 1) {
      const y = motif.length + 1;
      const gate = w >= 3 ? "RR..R.R..RR" : "R...R.R...R";
      rows[y] = gate.split("");
    }
    if (w >= 3 && k % 3 === 2) {
      rows.unshift("...R...R...".split(""));
    }
    return rows;
  }

  // 바위에 갇혀 공이 못 가는 벽돌이 있는지 (점검용 · 안전장치)
  function reachable(rows) {
    const h = rows.length + 1;
    const open = (r, c) => {
      if (r < 0 || c < 0 || c >= COLS || r >= h) return false;
      const v = rows[r] ? rows[r][c] : ".";
      return v !== "R";
    };
    const seen = new Set();
    const stack = [];
    for (let c = 0; c < COLS; c += 1) {
      stack.push([h - 1, c]);
      seen.add(`${h - 1},${c}`);
    }
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nr = r + dr;
        const nc = c + dc;
        const key = `${nr},${nc}`;
        if (open(nr, nc) && !seen.has(key)) {
          seen.add(key);
          stack.push([nr, nc]);
        }
      }
    }
    for (let r = 0; r < rows.length; r += 1) {
      if (!rows[r]) continue;
      for (let c = 0; c < COLS; c += 1) {
        const v = rows[r][c];
        if (v && v !== "." && v !== "R" && !seen.has(`${r},${c}`)) return false;
      }
    }
    return true;
  }

  /* ---------- 저장 ---------- */
  const defaultSave = () => ({ unlocked: 0, best: Array.from({ length: 50 }, () => ({ s: 0, st: 0 })) });
  function loadSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!raw || !Array.isArray(raw.best) || raw.best.length !== 50) return defaultSave();
      return { unlocked: clamp(Number(raw.unlocked) || 0, 0, 49), best: raw.best.map((b) => ({ s: Number(b && b.s) || 0, st: clamp(Number(b && b.st) || 0, 0, 3) })) };
    } catch (_) {
      return defaultSave();
    }
  }
  let save = loadSave();
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_) {}
  }
  const totalScore = () => save.best.reduce((a, b) => a + b.s, 0);
  const totalStars = () => save.best.reduce((a, b) => a + b.st, 0);

  /* ---------- 화면 ---------- */
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const stageEl = $("stage");
  let scale = 1;
  const overlays = { title: $("title"), stages: $("stages"), clear: $("clear"), over: $("over"), all: $("allclear") };
  const images = { bg: null, paddle: null, ball: null };

  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(((n >> 16) & 255) + amt, 0, 255);
    const g = clamp(((n >> 8) & 255) + amt, 0, 255);
    const b = clamp((n & 255) + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  /* ---------- 벽돌 그림 굽기 ---------- */
  const spriteCache = {};
  function brickSprite(key, draw) {
    const k = `${key}:${scale.toFixed(2)}`;
    if (spriteCache[k]) return spriteCache[k];
    const m = 8;
    const c = mk((BW + m * 2) * scale, (BH + m * 2) * scale);
    const x = c.getContext("2d");
    x.scale(scale, scale);
    x.translate(m, m);
    draw(x);
    spriteCache[k] = { c, m };
    return spriteCache[k];
  }
  function jellyBase(x, color) {
    x.save();
    x.shadowColor = color;
    x.shadowBlur = 5;
    const g = x.createLinearGradient(0, 0, 0, BH);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.24, color);
    g.addColorStop(1, shade(color, -40));
    x.fillStyle = g;
    roundRect(x, 0, 0, BW, BH, 7);
    x.fill();
    x.restore();
    x.strokeStyle = "rgba(255,255,255,0.6)";
    x.lineWidth = 1.4;
    roundRect(x, 0.7, 0.7, BW - 1.4, BH - 1.4, 6.5);
    x.stroke();
    x.fillStyle = "rgba(255,255,255,0.42)";
    roundRect(x, 4, 2.5, BW - 8, 4, 2);
    x.fill();
  }
  function face(x, mood) {
    const ey = BH * 0.54;
    const lx = BW * 0.33;
    const rx = BW * 0.67;
    x.fillStyle = "#211733";
    if (mood === "hurt") {
      x.strokeStyle = "#211733";
      x.lineWidth = 1.5;
      x.lineCap = "round";
      for (const q of [lx, rx]) {
        x.beginPath();
        x.moveTo(q - 2.4, ey - 2);
        x.lineTo(q + 2.4, ey + 2);
        x.moveTo(q + 2.4, ey - 2);
        x.lineTo(q - 2.4, ey + 2);
        x.stroke();
      }
    } else {
      x.beginPath();
      x.arc(lx, ey, 2.2, 0, Math.PI * 2);
      x.arc(rx, ey, 2.2, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#fff";
      x.beginPath();
      x.arc(lx - 0.7, ey - 0.8, 0.8, 0, Math.PI * 2);
      x.arc(rx - 0.7, ey - 0.8, 0.8, 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = "#211733";
    x.lineWidth = 1.2;
    x.lineCap = "round";
    x.beginPath();
    if (mood === "angry") {
      x.moveTo(BW * 0.44, BH * 0.8);
      x.lineTo(BW * 0.56, BH * 0.8);
      x.moveTo(lx - 3, ey - 4.6);
      x.lineTo(lx + 3, ey - 2.6);
      x.moveTo(rx + 3, ey - 4.6);
      x.lineTo(rx - 3, ey - 2.6);
    } else if (mood === "hurt") {
      x.arc(BW / 2, BH * 0.86, 2.8, Math.PI * 1.1, Math.PI * 1.9);
    } else {
      x.arc(BW / 2, BH * 0.6, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    x.stroke();
  }
  function spriteFor(b) {
    if (b.type === "R") {
      return brickSprite("rock", (x) => {
        const g = x.createLinearGradient(0, 0, 0, BH);
        g.addColorStop(0, "#8d86a6");
        g.addColorStop(1, "#4a4560");
        x.fillStyle = g;
        roundRect(x, 0, 0, BW, BH, 5);
        x.fill();
        x.fillStyle = "rgba(255,255,255,0.14)";
        x.beginPath();
        x.ellipse(BW * 0.3, BH * 0.32, 5, 2.6, 0, 0, Math.PI * 2);
        x.ellipse(BW * 0.7, BH * 0.62, 4, 2, 0, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = "rgba(0,0,0,0.24)";
        x.beginPath();
        x.arc(BW * 0.52, BH * 0.34, 2.2, 0, Math.PI * 2);
        x.arc(BW * 0.24, BH * 0.72, 1.8, 0, Math.PI * 2);
        x.arc(BW * 0.84, BH * 0.3, 1.5, 0, Math.PI * 2);
        x.fill();
      });
    }
    if (b.type === "B") {
      return brickSprite("bomb", (x) => {
        jellyBase(x, "#e8604c");
        x.fillStyle = "#2c1f3c";
        x.beginPath();
        x.arc(BW / 2, BH * 0.58, 7.2, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = "rgba(255,255,255,0.5)";
        x.beginPath();
        x.arc(BW / 2 - 2.4, BH * 0.58 - 2.6, 1.6, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "#ffe27a";
        x.lineWidth = 1.6;
        x.lineCap = "round";
        x.beginPath();
        x.moveTo(BW / 2 + 3, BH * 0.3);
        x.quadraticCurveTo(BW / 2 + 6, BH * 0.1, BW / 2 + 9, BH * 0.22);
        x.stroke();
      });
    }
    if (b.type === "S") {
      return brickSprite("star", (x) => {
        jellyBase(x, "#ffd23f");
        x.fillStyle = "#fff6c4";
        x.strokeStyle = "#c98a10";
        x.lineWidth = 1.1;
        x.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const r = i % 2 ? 3.4 : 8;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          x.lineTo(BW / 2 + Math.cos(a) * r, BH * 0.54 + Math.sin(a) * r);
        }
        x.closePath();
        x.fill();
        x.stroke();
      });
    }
    if (b.type === "I") {
      const cracked = b.hp < b.maxHp;
      return brickSprite(cracked ? `iron${b.hp}` : "iron", (x) => {
        const g = x.createLinearGradient(0, 0, 0, BH);
        g.addColorStop(0, "#eef3fb");
        g.addColorStop(0.3, "#aab6cc");
        g.addColorStop(1, "#5d6880");
        x.fillStyle = g;
        roundRect(x, 0, 0, BW, BH, 5);
        x.fill();
        x.strokeStyle = "rgba(255,255,255,0.7)";
        x.lineWidth = 1;
        roundRect(x, 0.6, 0.6, BW - 1.2, BH - 1.2, 4.6);
        x.stroke();
        x.fillStyle = "#3f4a60";
        for (const [q, w] of [
          [3.4, 3.4],
          [BW - 3.4, 3.4],
          [3.4, BH - 3.4],
          [BW - 3.4, BH - 3.4],
        ]) {
          x.beginPath();
          x.arc(q, w, 1.2, 0, Math.PI * 2);
          x.fill();
        }
        face(x, cracked ? "hurt" : "angry");
        if (cracked) drawCrack(x);
      });
    }
    const cracked = b.hp < b.maxHp;
    return brickSprite(`${b.type}${b.color}${cracked ? "c" : ""}`, (x) => {
      jellyBase(x, b.color);
      if (b.type === "H" && !cracked) {
        x.strokeStyle = "rgba(60,30,100,0.65)";
        x.lineWidth = 2.2;
        roundRect(x, 1.6, 1.6, BW - 3.2, BH - 3.2, 5.6);
        x.stroke();
      }
      face(x, cracked ? "hurt" : b.type === "H" ? "angry" : "happy");
      if (cracked) drawCrack(x);
    });
  }
  function drawCrack(x) {
    x.strokeStyle = "rgba(255,255,255,0.85)";
    x.lineWidth = 1.3;
    x.lineCap = "round";
    x.beginPath();
    x.moveTo(BW * 0.14, BH * 0.16);
    x.lineTo(BW * 0.24, BH * 0.46);
    x.lineTo(BW * 0.16, BH * 0.8);
    x.moveTo(BW * 0.86, BH * 0.2);
    x.lineTo(BW * 0.78, BH * 0.5);
    x.stroke();
  }

  /* ---------- 배경 ---------- */
  const backCache = {};
  function bakeBack(w) {
    const key = `${w}:${H}:${scale.toFixed(2)}`;
    if (backCache[key]) return backCache[key];
    const bs = Math.min(scale, 2);
    const c = mk(W * bs, H * bs);
    const x = c.getContext("2d");
    x.scale(bs, bs);
    if (x.imageSmoothingQuality) x.imageSmoothingQuality = "high";
    if (images.bg) {
      // 긴 화면에 맞게 덮기
      const ih = images.bg.naturalHeight;
      const iw = images.bg.naturalWidth;
      const k = Math.max(W / iw, H / ih);
      const dw = iw * k;
      const dh = ih * k;
      x.drawImage(images.bg, (W - dw) / 2, H - dh, dw, dh);
    } else {
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#120e3a");
      g.addColorStop(1, "#5a3a9a");
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
    }
    const t = WORLDS[w].tint;
    if (t) {
      x.fillStyle = t;
      x.fillRect(0, 0, W, H);
    }
    // 위쪽은 어둡게 (벽돌이 잘 보이게)
    const g2 = x.createLinearGradient(0, 0, 0, H * 0.72);
    g2.addColorStop(0, "rgba(8,6,30,0.52)");
    g2.addColorStop(1, "rgba(8,6,30,0)");
    x.fillStyle = g2;
    x.fillRect(0, 0, W, H);
    backCache[key] = c;
    return c;
  }

  function resize() {
    const r = stageEl.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    scale = canvas.width / W;
    H = Math.max(520, Math.round((W * r.height) / Math.max(1, r.width)));
  }

  /* ---------- 소리 ---------- */
  const Sfx = {
    ctx: null,
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
          this.ctx = new AC();
        } catch (_) {
          return;
        }
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = 0.8;
        const comp = c.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(c.destination);
        this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    },
    tone(f, dur, type, peak, slide = 1, delay = 0) {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
      g.gain.setValueAtTime(0.0008, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise(dur, peak, freq) {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = c.currentTime;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.02);
    },
    hit(combo) {
      const notes = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
      const f = 523 * Math.pow(2, notes[Math.min(combo, notes.length - 1)] / 12);
      this.tone(f, 0.1, "triangle", 0.15);
      this.tone(f * 2, 0.06, "sine", 0.05);
    },
    block() {
      this.tone(200, 0.05, "square", 0.05, 0.7);
    },
    wall() {
      this.tone(320, 0.03, "sine", 0.05);
    },
    paddle() {
      this.tone(240, 0.09, "sine", 0.2, 1.5);
    },
    bomb() {
      this.noise(0.34, 0.42, 900);
      this.tone(110, 0.3, "sine", 0.28, 0.5);
    },
    item() {
      [660, 880, 1175].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.13, 1, i * 0.06));
    },
    lose() {
      this.tone(400, 0.4, "triangle", 0.18, 0.35);
    },
    clear() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.14, 1, i * 0.1));
    },
    laser() {
      this.tone(1200, 0.07, "square", 0.04, 0.5);
    },
    boss() {
      this.tone(160, 0.14, "sawtooth", 0.12, 0.7);
      this.noise(0.1, 0.14, 1200);
    },
  };

  /* ---------- 상태 ---------- */
  const S = {
    screen: "title",
    stage: 0,
    score: 0,
    lives: 3,
    lostLives: 0,
    balls: [],
    bricks: [],
    items: [],
    lasers: [],
    meteors: [],
    particles: [],
    floats: [],
    rings: [],
    stars: [],
    shooter: null,
    boss: null,
    paddle: { x: W / 2, w: 104, h: 26, squash: 0, vx: 0, stun: 0, baseW: 104 },
    pointerX: W / 2,
    keys: { left: false, right: false },
    launched: false,
    stickX: 0,
    wideT: 0,
    fireT: 0,
    slowT: 0,
    laserT: 0,
    laserCd: 0,
    net: false,
    combo: 0,
    maxCombo: 0,
    time: 0,
    stageTime: 0,
    lastHit: 0,
    shake: 0,
    flash: 0,
    slide: 0,
    slideOffset: 0,
    intro: 0,
    clearT: 0,
    autoLaunch: 0,
    powerDirty: true,
    paused: false,
    speedBoost: 1,
    bricksLeft: 0,
    deadEnd: 0,
    giftT: 0,
    giftN: 0,
  };

  const baseSpeed = () => Math.min(440, 255 + S.stage * 3.8);
  const paddleBase = () => [108, 100, 94, 88, 82][stageInfo(S.stage).w];

  function makeStars() {
    S.stars = Array.from({ length: 44 }, () => ({ x: rand(0, W), y: rand(0, H * 0.8), s: rand(0.5, 1.5), tw: rand(0, 6.28), v: rand(0.6, 2) }));
  }

  /* ---------- 단계 시작 ---------- */
  function buildStage() {
    const i = S.stage;
    const info = stageInfo(i);
    const rows = layout(i);
    const safeRows = reachable(rows) ? rows : rows.map((r) => (r ? r.map((v) => (v === "R" ? "." : v)) : r));
    const list = [];
    safeRows.forEach((line, r) => {
      if (!line) return;
      line.forEach((v, c) => {
        if (v === ".") return;
        const hpBy = { j: 1, H: 2, I: 3, R: 999, B: 1, S: 1 };
        const color = COLORS[(r + Math.abs(c - 5)) % COLORS.length];
        list.push({
          type: v,
          x: PAD + c * (BW + GAP),
          y: GRID_Y + r * ROW_H + (info.boss ? 40 : 0),
          r,
          c,
          w: BW,
          h: BH,
          hp: hpBy[v],
          maxHp: hpBy[v],
          color,
          alive: true,
          wob: 0,
          phase: rand(0, 6.28),
          intro: (r + Math.abs(c - 5) * 0.5) * 0.035,
          fuse: 0,
        });
      });
    });
    S.bricks = list;
    S.bricksLeft = list.filter((b) => b.type !== "R").length;
    S.slide = !info.boss && info.w >= 2 && info.k % 3 === 2 ? 1 : 0;
    S.boss = null;
    if (info.boss) {
      const d = BOSSES[info.w];
      S.boss = { def: d, x: W / 2, y: GRID_Y + 62, w: 118, h: 82, hp: d.hp, maxHp: d.hp, vx: 56 + info.w * 16, t: 0, atk: 2.6, flash: 0, summon: 0, mood: 0 };
    }
  }

  function resetBallOnPaddle() {
    S.balls = [{ x: S.paddle.x, y: H - 92 - BALL_R - 2, vx: 0, vy: 0, r: BALL_R, trail: [], spin: 0, stuck: true }];
    S.launched = false;
    S.stickX = rand(-0.28, 0.28);
    S.autoLaunch = 5;
  }

  function clearPowers() {
    S.wideT = 0;
    S.fireT = 0;
    S.slowT = 0;
    S.laserT = 0;
    S.powerDirty = true;
  }

  function beginStage(i) {
    Sfx.unlock();
    S.stage = clamp(i, 0, 49);
    S.score = 0;
    S.lives = 3;
    S.lostLives = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.stageTime = 0;
    S.lastHit = 0;
    S.items = [];
    S.lasers = [];
    S.meteors = [];
    S.particles = [];
    S.floats = [];
    S.rings = [];
    S.net = false;
    S.clearT = 0;
    S.speedBoost = 1;
    S.deadEnd = 0;
    S.giftT = 0;
    S.giftN = 0;
    clearPowers();
    S.paddle.baseW = paddleBase();
    S.paddle.w = S.paddle.baseW;
    S.paddle.x = W / 2;
    S.paddle.stun = 0;
    S.pointerX = W / 2;
    buildStage();
    resetBallOnPaddle();
    S.intro = 0.9;
    const info = stageInfo(S.stage);
    $("stage-no").textContent = `${info.w + 1}-${info.k + 1}`;
    $("stage-name").textContent = NAMES[S.stage];
    updateHud();
    setScreen("play");
    if (S.boss) ready(`보스 등장!<small>${S.boss.def.name}</small>`);
    else ready(`${info.w + 1}-${info.k + 1}<small>${NAMES[S.stage]}</small>`);
    if (window.TodayGameRank && TodayGameRank.reset) TodayGameRank.reset();
  }

  function ready(html) {
    const el = $("ready");
    el.className = "ready";
    void el.offsetWidth;
    el.innerHTML = html;
    el.className = "ready show";
  }

  function setScreen(name) {
    S.screen = name;
    document.body.classList.toggle("in-play", name === "play" || name === "clearing");
    Object.entries(overlays).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    canvas.style.cursor = name === "play" ? "none" : "default";
  }

  function updateHud() {
    $("score").textContent = S.score.toLocaleString("ko-KR");
    $("lives").textContent = "♥".repeat(Math.max(0, S.lives));
  }

  function updatePowerBar() {
    S.powerDirty = false;
    const list = [];
    if (S.wideT > 0) list.push(["넓게", "#7ec8ff", S.wideT]);
    if (S.fireT > 0) list.push(["불꽃", "#ff8a5c", S.fireT]);
    if (S.slowT > 0) list.push(["느리게", "#9df27a", S.slowT]);
    if (S.laserT > 0) list.push(["레이저", "#ff8ab5", S.laserT]);
    if (S.net) list.push(["별 그물", "#ffe27a", 0]);
    $("power").innerHTML = list.map(([n, c, t]) => `<span style="--c:${c}">${n}${t ? ` ${Math.ceil(t)}` : ""}</span>`).join("");
  }

  /* ---------- 효과 ---------- */
  function burst(x, y, color, n = 10, sp = 150, star = false) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(sp * 0.3, sp);
      const life = rand(0.3, 0.65);
      S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: rand(1.6, 4), star: star || Math.random() < 0.3, rot: rand(0, 6), vr: rand(-6, 6) });
    }
    if (S.particles.length > 240) S.particles.splice(0, S.particles.length - 240);
  }
  function floatText(x, y, text, color = "#fff", big = false) {
    S.floats.push({ x, y, text, color, life: 0.8, big });
    if (S.floats.length > 16) S.floats.shift();
  }

  /* ---------- 공 ---------- */
  function launch() {
    if (S.launched || S.screen !== "play" || S.intro > 0.25) return;
    S.launched = true;
    const b = S.balls[0];
    if (!b) return;
    b.stuck = false;
    const a = -Math.PI / 2 + S.stickX;
    const sp = currentSpeed();
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
    Sfx.paddle();
  }
  function currentSpeed() {
    return baseSpeed() * S.speedBoost * (S.slowT > 0 ? 0.72 : 1);
  }
  function normalizeBall(b) {
    const sp = currentSpeed();
    const cur = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / cur) * sp;
    b.vy = (b.vy / cur) * sp;
    // 거의 수평으로 도는 일을 막는다
    const minVy = sp * 0.24;
    if (Math.abs(b.vy) < minVy) {
      b.vy = (b.vy >= 0 ? 1 : -1) * minVy;
      b.vx = Math.sign(b.vx || 1) * Math.sqrt(Math.max(0, sp * sp - minVy * minVy));
    }
  }

  const brickX = (b) => b.x + (S.slide ? S.slideOffset : 0);

  function damageBrick(b, dmg, fromBomb = false) {
    if (!b.alive || b.type === "R") return false;
    b.hp -= dmg;
    b.wob = 1;
    const x = brickX(b) + b.w / 2;
    const y = b.y + b.h / 2;
    S.lastHit = S.stageTime;
    if (b.hp > 0) {
      burst(x, y, "#ffffff", 4, 90);
      Sfx.block();
      return false;
    }
    b.alive = false;
    S.bricksLeft -= 1;
    S.combo += 1;
    S.maxCombo = Math.max(S.maxCombo, S.combo);
    const mult = 1 + Math.min(4, Math.floor(S.combo / 5)) * 0.5;
    const gain = Math.round(10 * b.maxHp * mult);
    S.score += gain;
    burst(x, y, b.type === "B" ? "#ffb26a" : b.type === "S" ? "#fff3a8" : b.color, b.type === "S" ? 16 : 11, 170);
    if (mult > 1 || b.maxHp > 1) floatText(x, y - 4, `+${gain}`, mult > 1 ? "#ffe27a" : "#fff");
    if (S.combo === 5 || S.combo === 10 || S.combo === 15 || S.combo === 20 || S.combo === 30) floatText(W / 2, H * 0.56, `${S.combo}콤보! ×${mult}`, "#ffe27a", true);
    if (!fromBomb) Sfx.hit(S.combo);
    if (b.type === "B") explode(b);
    if (b.type === "S") dropItem(x, y, true);
    else if (Math.random() < 0.1) dropItem(x, y, false);
    updateHud();
    return true;
  }

  function explode(b) {
    const x = brickX(b) + b.w / 2;
    const y = b.y + b.h / 2;
    S.rings.push({ x, y, r: 6, life: 0.32, max: 0.32 });
    S.shake = Math.max(S.shake, 7);
    S.flash = Math.max(S.flash, 0.1);
    burst(x, y, "#ffd27a", 22, 260, true);
    Sfx.bomb();
    for (const o of S.bricks) {
      if (!o.alive || o === b) continue;
      if (Math.abs(o.r - b.r) <= 1 && Math.abs(o.c - b.c) <= 1) {
        if (o.type === "B") {
          if (!o.fuse) o.fuse = 0.09;
        } else damageBrick(o, 2, true);
      }
    }
  }

  const ITEM_KINDS = [
    { id: "wide", name: "넓게", color: "#7ec8ff", w: 3 },
    { id: "multi", name: "공 세 개", color: "#c9a0ff", w: 3 },
    { id: "fire", name: "불꽃", color: "#ff8a5c", w: 2 },
    { id: "slow", name: "느리게", color: "#9df27a", w: 2 },
    { id: "laser", name: "레이저", color: "#ff8ab5", w: 2 },
    { id: "net", name: "별 그물", color: "#ffe27a", w: 1.6 },
    { id: "heart", name: "하트", color: "#ff5f8f", w: 0.6 },
  ];
  function dropItem(x, y) {
    if (S.items.length >= 4) return;
    const sum = ITEM_KINDS.reduce((a, k) => a + k.w, 0);
    let r = Math.random() * sum;
    let kind = ITEM_KINDS[0];
    for (const k of ITEM_KINDS) {
      r -= k.w;
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    S.items.push({ kind, x, y, vy: 112, t: rand(0, 6) });
  }
  function takeItem(it) {
    const id = it.kind.id;
    Sfx.item();
    burst(it.x, it.y, it.kind.color, 14, 170, true);
    floatText(it.x, S.paddle && H - 124, it.kind.name, it.kind.color, true);
    if (id === "wide") S.wideT = 12;
    else if (id === "fire") S.fireT = 7;
    else if (id === "slow") S.slowT = 8;
    else if (id === "laser") S.laserT = 8;
    else if (id === "net") S.net = true;
    else if (id === "heart") {
      S.lives = Math.min(5, S.lives + 1);
      updateHud();
    } else if (id === "multi") {
      const add = [];
      for (const b of S.balls) {
        if (b.stuck) continue;
        if (S.balls.length + add.length >= 8) break;
        for (const da of [-0.42, 0.42]) {
          if (S.balls.length + add.length >= 8) break;
          const a = Math.atan2(b.vy, b.vx) + da;
          const sp = Math.hypot(b.vx, b.vy);
          add.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r, trail: [], spin: 0, stuck: false });
        }
      }
      add.forEach(normalizeBall);
      S.balls.push(...add);
    }
    S.powerDirty = true;
  }

  function collideBox(b, left, top, w, h) {
    const cx = clamp(b.x, left, left + w);
    const cy = clamp(b.y, top, top + h);
    const dx = b.x - cx;
    const dy = b.y - cy;
    return dx * dx + dy * dy < b.r * b.r ? { cx, cy, dx, dy } : null;
  }

  function bounceOff(b, hit) {
    const { dx, dy } = hit;
    if (dx === 0 && dy === 0) {
      b.vy = -b.vy;
      return;
    }
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) {
      // 모서리는 조금 둥글게, 면은 깔끔하게
      if (Math.abs(nx) > 0.8) b.vx = -b.vx;
      else if (Math.abs(ny) > 0.8) b.vy = -b.vy;
      else {
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
      }
    }
    b.x = hit.cx + nx * (b.r + 0.1);
    b.y = hit.cy + ny * (b.r + 0.1);
    normalizeBall(b);
  }

  function stepBall(b, dt) {
    if (b.stuck) {
      b.x = S.paddle.x + S.stickX * 34;
      b.y = H - 92 - b.r - 2;
      return;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += (b.vx / 90) * dt * 4;

    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
      Sfx.wall();
    } else if (b.x + b.r > W) {
      b.x = W - b.r;
      b.vx = -Math.abs(b.vx);
      Sfx.wall();
    }
    if (b.y - b.r < TOP) {
      b.y = TOP + b.r;
      b.vy = Math.abs(b.vy);
      Sfx.wall();
    }

    // 별 그물
    if (S.net && b.vy > 0 && b.y + b.r > H - 40) {
      b.y = H - 40 - b.r;
      b.vy = -Math.abs(b.vy);
      S.net = false;
      S.powerDirty = true;
      burst(b.x, H - 40, "#ffe27a", 18, 200, true);
      Sfx.paddle();
    }

    // 패들
    const p = S.paddle;
    const py = H - 92;
    if (b.vy > 0 && b.y + b.r >= py && b.y - b.r <= py + p.h * 0.7 && b.x >= p.x - p.w / 2 - b.r * 0.7 && b.x <= p.x + p.w / 2 + b.r * 0.7) {
      const hit = clamp((b.x - p.x) / (p.w / 2), -1, 1);
      const a = -Math.PI / 2 + hit * 1.06 + clamp(p.vx / 2600, -0.16, 0.16) + rand(-0.07, 0.07);
      S.speedBoost = Math.min(1.24, S.speedBoost + 0.006);
      const sp = currentSpeed();
      b.vx = Math.cos(a) * sp;
      b.vy = -Math.abs(Math.sin(a) * sp);
      b.y = py - b.r;
      p.squash = 1;
      S.combo = 0;
      Sfx.paddle();
      burst(b.x, py, "#ffe27a", 4, 80);
      return;
    }

    // 벽돌
    let found = null;
    let bestD = 1e9;
    for (const br of S.bricks) {
      if (!br.alive) continue;
      const left = brickX(br);
      if (b.x + b.r < left || b.x - b.r > left + br.w || b.y + b.r < br.y || b.y - b.r > br.y + br.h) continue;
      const hit = collideBox(b, left, br.y, br.w, br.h);
      if (!hit) continue;
      const d = hit.dx * hit.dx + hit.dy * hit.dy;
      if (d < bestD) {
        bestD = d;
        found = { br, hit };
      }
    }
    if (found) {
      const fire = S.fireT > 0 && found.br.type !== "R" && found.br.type !== "I";
      if (found.br.type === "R") {
        Sfx.block();
        found.br.wob = 0.6;
      }
      damageBrick(found.br, S.fireT > 0 ? 3 : 1);
      if (!fire) bounceOff(b, found.hit);
    }

    // 보스
    const boss = S.boss;
    if (boss && boss.hp > 0) {
      const hit = collideBox(b, boss.x - boss.w / 2, boss.y - boss.h / 2, boss.w, boss.h);
      if (hit && !b.justBoss) {
        b.justBoss = 0.08;
        hitBoss(S.fireT > 0 ? 2 : 1, b.x, b.y);
        bounceOff(b, hit);
      }
    }
    if (b.justBoss) {
      b.justBoss -= dt;
      if (b.justBoss <= 0) b.justBoss = 0;
    }

    // 운석
    for (const m of S.meteors) {
      if (m.hp > 0 && Math.hypot(m.x - b.x, m.y - b.y) < m.r + b.r) {
        m.hp = 0;
        S.score += 15;
        burst(m.x, m.y, "#ffb26a", 10, 170);
        Sfx.block();
        updateHud();
      }
    }
  }

  function hitBoss(dmg, x, y) {
    const boss = S.boss;
    boss.hp -= dmg;
    boss.flash = 0.14;
    boss.mood = 0.5;
    S.lastHit = S.stageTime;
    S.score += 20;
    S.combo += 1;
    burst(x, y, boss.def.color, 12, 200, true);
    floatText(x, y - 8, "+20", "#fff");
    S.shake = Math.max(S.shake, 3);
    Sfx.boss();
    updateHud();
    const stageW = stageInfo(S.stage).w;
    if (boss.summon < 2 && boss.hp < boss.maxHp * (boss.summon === 0 ? 0.66 : 0.33)) {
      boss.summon += 1;
      // 젤리 벽돌을 다시 부른다
      const row = 5 + (boss.summon % 2);
      for (let c = 0; c < COLS; c += 2 + (boss.summon % 2)) {
        S.bricks.push({ type: stageW >= 2 ? "H" : "j", x: PAD + c * (BW + GAP), y: GRID_Y + 40 + row * ROW_H, r: 90 + boss.summon, c, w: BW, h: BH, hp: stageW >= 2 ? 2 : 1, maxHp: stageW >= 2 ? 2 : 1, color: COLORS[(c + boss.summon) % 6], alive: true, wob: 1, phase: rand(0, 6), intro: 0, fuse: 0 });
        S.bricksLeft += 1;
      }
      dropItem(boss.x, boss.y + 30);
    }
    if (boss.hp <= 0) {
      S.score += 300 + stageW * 100;
      S.flash = 0.5;
      S.shake = 12;
      burst(boss.x, boss.y, boss.def.color, 40, 320, true);
      burst(boss.x, boss.y, "#ffffff", 26, 240, true);
      S.rings.push({ x: boss.x, y: boss.y, r: 10, life: 0.5, max: 0.5 });
      Sfx.bomb();
      floatText(boss.x, boss.y, `+${300 + stageW * 100}`, "#ffe27a", true);
      updateHud();
    }
  }

  function loseBall() {
    S.lives -= 1;
    S.lostLives += 1;
    S.combo = 0;
    S.speedBoost = 1;
    S.items = [];
    S.lasers = [];
    clearPowers();
    S.shake = 7;
    updateHud();
    Sfx.lose();
    if (S.lives <= 0) {
      failStage();
      return;
    }
    resetBallOnPaddle();
    ready("한 번 더!");
  }

  function failStage() {
    S.balls = [];
    const info = stageInfo(S.stage);
    $("over-detail").innerHTML = `${info.w + 1}-${info.k + 1} ${NAMES[S.stage]}<br />이번 점수 ${S.score.toLocaleString("ko-KR")} · 총점 ${totalScore().toLocaleString("ko-KR")}`;
    setScreen("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "brick", gameTitle: "별똥별 벽돌깨기", formParent: $("over-rank") });
      TodayGameRank.open(Math.max(1, totalScore() + S.score), { label: `${info.w + 1}-${info.k + 1}까지` });
    }
  }

  function stageClear() {
    S.screen = "clearing";
    S.clearT = 1.1;
    S.flash = 0.35;
    Sfx.clear();
    // 남은 공으로 보너스
    for (const b of S.balls) burst(b.x, b.y, "#ffe27a", 14, 200, true);
    S.balls = [];
    S.items = [];
    S.meteors = [];
    S.lasers = [];
    for (let i = 0; i < 5; i += 1) {
      burst(rand(40, W - 40), rand(120, H * 0.6), COLORS[i], 22, 240, true);
    }
  }

  function showClear() {
    const i = S.stage;
    const info = stageInfo(i);
    const timeBonus = Math.max(0, Math.round((60 - S.stageTime) * 6));
    const lifeBonus = S.lives * 100;
    S.score += timeBonus + lifeBonus;
    const stars = S.lostLives === 0 ? 3 : S.lostLives === 1 ? 2 : 1;
    const prev = save.best[i];
    const newBest = S.score > prev.s;
    save.best[i] = { s: Math.max(prev.s, S.score), st: Math.max(prev.st, stars) };
    save.unlocked = Math.max(save.unlocked, Math.min(49, i + 1));
    persist();
    $("clear-kick").textContent = `${info.w + 1}-${info.k + 1}`;
    $("clear-title").textContent = info.boss ? "보스를 물리쳤어요!" : "스테이지 클리어!";
    $("clear-detail").innerHTML = `점수 ${S.score.toLocaleString("ko-KR")}${newBest ? " · 새 기록!" : ""}<br />최고 콤보 ${S.maxCombo} · 시간 보너스 ${timeBonus} · 하트 보너스 ${lifeBonus}`;
    $("next-btn").textContent = i >= 49 ? "최종 결과" : "다음 단계";
    [...$("clear-stars").children].forEach((el, n) => el.classList.toggle("on", n < stars));
    setScreen("clear");
    updateHud();
  }

  function nextStage() {
    if (S.stage >= 49) {
      $("all-detail").innerHTML = `총점 ${totalScore().toLocaleString("ko-KR")} · 별 ${totalStars()} / 150`;
      setScreen("all");
      if (window.TodayGameRank) {
        TodayGameRank.mount({ gameId: "brick", gameTitle: "별똥별 벽돌깨기", formParent: $("all-rank") });
        TodayGameRank.open(Math.max(1, totalScore()), { label: `별 ${totalStars()}개` });
      }
      return;
    }
    beginStage(S.stage + 1);
  }

  /* ---------- 걸음 ---------- */
  function step(dt) {
    S.time += dt;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 26);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt);
    updateFx(dt);
    if (S.screen === "clearing") {
      S.clearT -= dt;
      if (S.clearT <= 0) showClear();
      return;
    }
    if (S.screen !== "play" || S.paused) return;

    S.stageTime += dt;
    if (S.intro > 0) S.intro = Math.max(0, S.intro - dt);

    // 패들
    const p = S.paddle;
    const kd = (S.keys.right ? 1 : 0) - (S.keys.left ? 1 : 0);
    if (kd) S.pointerX = clamp(S.pointerX + kd * 560 * dt, 0, W);
    const wide = S.wideT > 0 ? 1.45 : 1;
    p.w = lerp(p.w, p.baseW * wide, 1 - Math.pow(0.0005, dt));
    const stunK = p.stun > 0 ? 0.22 : 1;
    const wantX = clamp(S.pointerX, p.w / 2 + 4, W - p.w / 2 - 4);
    const prevX = p.x;
    p.x = lerp(p.x, wantX, 1 - Math.pow(0.0000005, dt * stunK));
    p.vx = lerp(p.vx, (p.x - prevX) / dt, 0.15);
    p.squash = Math.max(0, p.squash - dt * 5);
    p.stun = Math.max(0, p.stun - dt);

    // 아이템 시간
    for (const k of ["wideT", "fireT", "slowT", "laserT"]) {
      if (S[k] > 0) {
        const before = Math.ceil(S[k]);
        S[k] = Math.max(0, S[k] - dt);
        if (Math.ceil(S[k]) !== before) S.powerDirty = true;
      }
    }
    if (S.powerDirty) updatePowerBar();

    // 움직이는 판
    if (S.slide) {
      let minC = 99;
      let maxC = -1;
      for (const b of S.bricks) {
        if (!b.alive) continue;
        minC = Math.min(minC, b.c);
        maxC = Math.max(maxC, b.c);
      }
      const room = Math.max(0, Math.min(minC * (BW + GAP), (COLS - 1 - maxC) * (BW + GAP)));
      S.slideOffset = Math.sin(S.stageTime * 0.7) * Math.min(room, 42);
    } else S.slideOffset = 0;

    for (const b of S.bricks) {
      if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 5);
      if (b.intro > 0) b.intro = Math.max(0, b.intro - dt);
      if (b.fuse > 0) {
        b.fuse -= dt;
        if (b.fuse <= 0 && b.alive) damageBrick(b, 9, true);
      }
    }

    // 자동 발사 (가만히 있어도 진행되게)
    if (!S.launched && S.intro <= 0) {
      S.autoLaunch -= dt;
      if (S.autoLaunch <= 0) launch();
    }

    // 공
    for (const b of S.balls) {
      stepBall(b, dt);
      if (!b.stuck && S.time - (b.trailT || 0) > 0.016) {
        b.trailT = S.time;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 14) b.trail.shift();
      }
    }
    S.balls = S.balls.filter((b) => b.y - b.r <= H + 10);
    if (S.balls.length === 0 && S.screen === "play") {
      loseBall();
      if (S.screen !== "play") return;
    }

    // 오래 안 맞으면: 살짝 도와준다 (끝이 안 나는 판 방지)
    const idle = S.stageTime - S.lastHit;
    if (idle > 24 && S.launched && S.bricks.some((b) => b.alive && b.type === "R")) {
      // 바위 때문에 끝이 안 나는 판: 바위를 무너뜨린다
      for (const b of S.bricks) {
        if (b.alive && b.type === "R") {
          b.alive = false;
          burst(brickX(b) + b.w / 2, b.y + b.h / 2, "#a8a0c0", 8, 150);
        }
      }
      S.lastHit = S.stageTime - 10;
      S.shake = Math.max(S.shake, 6);
      Sfx.bomb();
      floatText(W / 2, H * 0.56, "바위가 무너졌어요!", "#ffe27a", true);
    }
    const helpFrom = S.bricksLeft <= 6 ? 5 : 12; // 몇 개 안 남으면 더 빨리 돕는다
    if (idle > helpFrom && S.launched) {
      const targets = S.bricks.filter((b) => b.alive && b.type !== "R");
      const ref = S.balls[0];
      let t = S.boss && S.boss.hp > 0 ? S.boss : null;
      if (!t && ref) {
        let bd = 1e9;
        for (const q of targets) {
          const d = Math.hypot(brickX(q) + q.w / 2 - ref.x, q.y + q.h / 2 - ref.y);
          if (d < bd) {
            bd = d;
            t = q;
          }
        }
      }
      if (t) {
        const tx = t.def ? t.x : brickX(t) + t.w / 2;
        const ty = t.def ? t.y : t.y + t.h / 2;
        for (const b of S.balls) {
          if (b.stuck) continue;
          const dx = tx - b.x;
          const dy = ty - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = Math.hypot(b.vx, b.vy);
          const k = clamp((idle - helpFrom) * 0.5, 0, 1.6) * dt;
          b.vx += (dx / d) * sp * k;
          b.vy += (dy / d) * sp * k;
          normalizeBall(b);
        }
      }
    }

    // 오래 걸리는 판엔 하늘에서 선물: 불꽃 · 공 세 개를 번갈아 (지루해지기 전에 끝나게)
    if (S.stageTime > 60 && S.launched) {
      S.giftT -= dt;
      if (S.giftT <= 0) {
        S.giftT = 10;
        S.giftN += 1;
        const kind = ITEM_KINDS.find((k) => k.id === (S.giftN % 2 ? "fire" : "multi"));
        S.items.push({ kind, x: clamp(p.x, 40, W - 40), y: TOP + 20, vy: 210, t: 0, gift: true });
        floatText(W / 2, H * 0.5, "별똥별 선물!", "#ffe27a", true);
      }
    }

    // 떨어지는 아이템
    for (const it of S.items) {
      it.y += it.vy * dt;
      it.t += dt * 3;
      if (it.y + 9 > H - 92 && it.y - 9 < H - 92 + p.h && Math.abs(it.x - p.x) < p.w / 2 + 16) {
        it.taken = true;
        takeItem(it);
      }
    }
    S.items = S.items.filter((it) => !it.taken && it.y < H + 30);

    // 레이저
    if (S.laserT > 0) {
      S.laserCd -= dt;
      if (S.laserCd <= 0) {
        S.laserCd = 0.32;
        for (const dx of [-p.w / 2 + 8, p.w / 2 - 8]) S.lasers.push({ x: p.x + dx, y: H - 96 });
        Sfx.laser();
      }
    }
    for (const l of S.lasers) {
      l.y -= 640 * dt;
      if (l.y < TOP) l.dead = true;
      for (const br of S.bricks) {
        if (!br.alive) continue;
        const left = brickX(br);
        if (l.x > left && l.x < left + br.w && l.y > br.y && l.y < br.y + br.h) {
          l.dead = true;
          if (br.type !== "R") damageBrick(br, 1);
          break;
        }
      }
      if (!l.dead && S.boss && S.boss.hp > 0 && Math.abs(l.x - S.boss.x) < S.boss.w / 2 && Math.abs(l.y - S.boss.y) < S.boss.h / 2) {
        l.dead = true;
        hitBoss(0.5, l.x, l.y);
      }
    }
    S.lasers = S.lasers.filter((l) => !l.dead);

    // 보스
    const boss = S.boss;
    if (boss && boss.hp > 0) {
      boss.t += dt;
      boss.flash = Math.max(0, boss.flash - dt);
      boss.mood = Math.max(0, boss.mood - dt);
      boss.x += boss.vx * dt;
      if (boss.x < boss.w / 2 + 8) {
        boss.x = boss.w / 2 + 8;
        boss.vx = Math.abs(boss.vx);
      } else if (boss.x > W - boss.w / 2 - 8) {
        boss.x = W - boss.w / 2 - 8;
        boss.vx = -Math.abs(boss.vx);
      }
      boss.y = GRID_Y + 62 + Math.sin(boss.t * 1.4) * 12;
      boss.atk -= dt;
      if (boss.atk <= 0 && S.intro <= 0) {
        boss.atk = Math.max(1.5, 2.8 - stageInfo(S.stage).w * 0.25);
        S.meteors.push({ x: boss.x, y: boss.y + boss.h / 2, vy: 170 + stageInfo(S.stage).w * 16, vx: clamp((p.x - boss.x) * 0.22, -70, 70), r: 11, rot: 0, hp: 1 });
      }
    }
    for (const m of S.meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rot += dt * 4;
      if (m.hp > 0 && m.y + m.r > H - 92 && m.y - m.r < H - 92 + p.h && Math.abs(m.x - p.x) < p.w / 2 + m.r) {
        m.hp = 0;
        p.stun = 0.7;
        S.shake = Math.max(S.shake, 6);
        burst(m.x, m.y, "#ffb26a", 16, 200);
        floatText(p.x, H - 124, "앗, 멈칫!", "#ffb26a", true);
        Sfx.boss();
      }
    }
    S.meteors = S.meteors.filter((m) => m.hp > 0 && m.y < H + 30);

    // 다 깼나
    const bossAlive = boss && boss.hp > 0;
    if (!bossAlive && (boss ? true : S.bricksLeft <= 0)) stageClear();
  }

  function updateFx(dt) {
    for (const q of S.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 240 * dt;
      q.rot += q.vr * dt;
      q.life -= dt;
    }
    S.particles = S.particles.filter((q) => q.life > 0);
    for (const f of S.floats) {
      f.y -= (f.big ? 26 : 38) * dt;
      f.life -= dt;
    }
    S.floats = S.floats.filter((f) => f.life > 0);
    for (const r of S.rings) {
      r.r += 240 * dt;
      r.life -= dt;
    }
    S.rings = S.rings.filter((r) => r.life > 0);
    if (S.shooter) {
      S.shooter.x += S.shooter.vx * dt;
      S.shooter.y += S.shooter.vy * dt;
      S.shooter.life -= dt;
      if (S.shooter.life <= 0) S.shooter = null;
    } else if (Math.random() < dt * 0.22) {
      const fromLeft = Math.random() < 0.5;
      S.shooter = { x: fromLeft ? rand(-20, W * 0.4) : rand(W * 0.6, W + 20), y: rand(40, H * 0.4), vx: fromLeft ? 300 : -300, vy: 170, life: 0.9, max: 0.9 };
    }
  }

  /* ---------- 그리기 ---------- */
  function drawBrick(b, t) {
    if (!b.alive || b.intro > 0.3) return;
    const sp = spriteFor(b);
    const x = brickX(b) + b.w / 2;
    let y = b.y + b.h / 2 + Math.sin(t * 2.4 + b.phase) * (b.type === "R" ? 0 : 0.6);
    const k = b.intro > 0 ? 1 - b.intro / 0.3 : 1;
    y -= b.intro * 60;
    const w = b.wob;
    const sx = (1 + w * 0.18) * (b.intro > 0 ? 0.5 + k * 0.5 : 1);
    const sy = (1 - w * 0.14) * (b.intro > 0 ? 0.5 + k * 0.5 : 1);
    const dw = (BW + sp.m * 2) * sx;
    const dh = (BH + sp.m * 2) * sy;
    if (b.intro > 0) ctx.globalAlpha = k;
    ctx.drawImage(sp.c, x - dw / 2, y - dh / 2, dw, dh);
    ctx.globalAlpha = 1;
    if (b.type === "B") {
      // 불꽃 심지
      const fl = Math.sin(t * 22 + b.phase) * 1.2;
      ctx.fillStyle = "#fff3a8";
      ctx.beginPath();
      ctx.arc(x + 9, y - 8, 2 + fl * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPaddle() {
    const p = S.paddle;
    const py = H - 92;
    const im = images.paddle;
    const sq = p.squash;
    const h = p.h * (1 - sq * 0.22);
    const y = py + sq * 4;
    const stunX = p.stun > 0 ? Math.sin(S.time * 60) * 2 : 0;
    const x = p.x - p.w / 2 + stunX;
    if (S.wideT > 0 || S.laserT > 0) {
      ctx.save();
      ctx.shadowColor = S.laserT > 0 ? "#ff8ab5" : "#7ec8ff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(255,255,255,0.01)";
      roundRect(ctx, x, y, p.w, h, h / 2);
      ctx.fill();
      ctx.restore();
    }
    if (im) {
      const iw = im.naturalWidth;
      const ih = im.naturalHeight;
      const cap = Math.min(p.w / 2 - 1, (h / ih) * iw * 0.2);
      const capS = (cap / h) * ih;
      ctx.drawImage(im, 0, 0, capS, ih, x, y, cap, h);
      ctx.drawImage(im, capS, 0, iw * 0.25 - 0, ih, x + cap - 0.3, y, p.w / 2 - cap + 0.6, h);
      ctx.drawImage(im, iw * 0.75 - capS * 0, 0, iw * 0.25 - capS, ih, x + p.w / 2 - 0.3, y, p.w / 2 - cap + 0.6, h);
      ctx.drawImage(im, iw - capS, 0, capS, ih, x + p.w - cap, y, cap, h);
      // 가운데 별 (늘어나지 않게 따로)
      const midS = iw * 0.2;
      const midD = (midS / ih) * h;
      ctx.drawImage(im, iw / 2 - midS / 2, 0, midS, ih, p.x - midD / 2 + stunX, y, midD, h);
    } else {
      ctx.fillStyle = "#ffd23f";
      roundRect(ctx, x, y, p.w, h, h / 2);
      ctx.fill();
    }
    if (S.laserT > 0) {
      ctx.fillStyle = "#ff5f8f";
      for (const dx of [8, p.w - 8]) {
        roundRect(ctx, x + dx - 3, y - 5, 6, 8, 2);
        ctx.fill();
      }
    }
  }

  function drawBall(b) {
    const fire = S.fireT > 0;
    // 꼬리 (별똥별)
    if (b.trail.length > 1) {
      const n = b.trail.length;
      for (let i = 0; i < n; i += 1) {
        const q = b.trail[i];
        const k = i / n;
        ctx.globalAlpha = k * 0.42;
        ctx.fillStyle = fire ? (i % 2 ? "#ff8a3a" : "#ffd23f") : i % 2 ? "#ffe27a" : "#fff";
        ctx.beginPath();
        ctx.arc(q.x, q.y, b.r * (0.25 + k * 0.72), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 3);
    glow.addColorStop(0, fire ? "rgba(255,190,110,0.85)" : "rgba(255,255,200,0.8)");
    glow.addColorStop(0.4, fire ? "rgba(255,110,50,0.45)" : "rgba(255,220,90,0.4)");
    glow.addColorStop(1, "rgba(255,180,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 3, 0, Math.PI * 2);
    ctx.fill();
    if (images.ball) {
      const s = b.r * 2.7;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.drawImage(images.ball, -s / 2, -s / 2, s, s);
      ctx.restore();
    } else {
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawItem(it) {
    const c = it.kind.color;
    const w = 56;
    const h = 22;
    const y = it.y + Math.sin(it.t) * 1.5;
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 10;
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.3, c);
    g.addColorStop(1, shade(c, -46));
    ctx.fillStyle = g;
    roundRect(ctx, it.x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#2a1f4a";
    ctx.font = '12px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(it.kind.name, it.x, y + 4.5);
  }

  function drawBoss(boss, t) {
    if (boss.hp <= 0) return;
    const d = boss.def;
    const wob = boss.flash > 0 ? Math.sin(t * 60) * 2 : 0;
    ctx.save();
    ctx.translate(boss.x + wob, boss.y);
    // 꼬리 불꽃
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI * 0.5 + (i - 2.5) * 0.28 + Math.sin(t * 6 + i) * 0.08;
      ctx.fillStyle = i % 2 ? d.color : "#fff3a8";
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * -8, -Math.abs(Math.sin(a)) * 44 - 6, 9, 22, a - Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(-16, -18, 6, 0, 0, 62);
    g.addColorStop(0, boss.flash > 0 ? "#ffffff" : shade(d.color, 50));
    g.addColorStop(0.5, boss.flash > 0 ? "#fff" : d.color);
    g.addColorStop(1, d.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, boss.w / 2, boss.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 분화구
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (const [x, y, r] of [
      [-36, -14, 7],
      [34, -20, 5],
      [38, 14, 6],
      [-30, 22, 5],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 얼굴
    const hurt = boss.mood > 0;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-17, -6, 11, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(17, -6, 11, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const look = clamp((S.paddle.x - boss.x) / 180, -1, 1) * 3.4;
    ctx.fillStyle = "#211733";
    if (hurt) {
      ctx.strokeStyle = "#211733";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (const q of [-17, 17]) {
        ctx.beginPath();
        ctx.moveTo(q - 5, -11);
        ctx.lineTo(q + 5, -1);
        ctx.moveTo(q + 5, -11);
        ctx.lineTo(q - 5, -1);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(-17 + look, -4, 5.4, 0, Math.PI * 2);
      ctx.arc(17 + look, -4, 5.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#211733";
      ctx.lineWidth = 3.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-28, -21);
      ctx.lineTo(-9, -14);
      ctx.moveTo(28, -21);
      ctx.lineTo(9, -14);
      ctx.stroke();
    }
    ctx.fillStyle = "#3a1830";
    ctx.beginPath();
    if (hurt) ctx.ellipse(0, 18, 9, 7, 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(-13, 14);
      ctx.quadraticCurveTo(0, 28, 13, 14);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
    // 체력
    const bw = 120;
    const ratio = clamp(boss.hp / boss.maxHp, 0, 1);
    const by = TOP + 3;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, W / 2 - bw / 2 - 2, by - 2, bw + 4, 10, 5);
    ctx.fill();
    ctx.fillStyle = d.color;
    roundRect(ctx, W / 2 - bw / 2, by, bw * ratio, 6, 3);
    ctx.fill();
  }

  function drawAimGuide() {
    if (S.launched || S.screen !== "play" || !S.balls[0]) return;
    const b = S.balls[0];
    const a = -Math.PI / 2 + S.stickX;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    for (let i = 1; i <= 7; i += 1) {
      const d = i * 22;
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 2.6 - i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (S.intro <= 0) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = '16px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("화면을 누르면 발사!", W / 2, H - 138);
    }
  }

  function draw() {
    const t = S.time;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
    ctx.save();
    if (S.shake > 0) ctx.translate(rand(-S.shake, S.shake), rand(-S.shake, S.shake));
    const w = stageInfo(S.stage).w;
    const back = bakeBack(w);
    ctx.drawImage(back, -8, -8, W + 16, H + 16);

    // 반짝이는 별
    ctx.fillStyle = "#fff";
    for (const s of S.stars) {
      ctx.globalAlpha = 0.3 + Math.sin(t * s.v * 2 + s.tw) * 0.28;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (S.shooter) {
      const q = S.shooter;
      const a = clamp(q.life / q.max, 0, 1);
      const g = ctx.createLinearGradient(q.x, q.y, q.x - q.vx * 0.16, q.y - q.vy * 0.16);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - q.vx * 0.16, q.y - q.vy * 0.16);
      ctx.stroke();
    }

    if (S.screen !== "title" && S.screen !== "stages") {
      for (const b of S.bricks) drawBrick(b, t);
      if (S.boss) drawBoss(S.boss, t);
      // 운석
      for (const m of S.meteors) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.fillStyle = "rgba(255,150,70,0.4)";
        ctx.beginPath();
        ctx.moveTo(-m.r, 0);
        ctx.lineTo(0, -m.r * 3);
        ctx.lineTo(m.r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.rotate(m.rot);
        ctx.fillStyle = "#7f6a5c";
        ctx.beginPath();
        ctx.moveTo(-m.r, -2);
        ctx.lineTo(-4, -m.r);
        ctx.lineTo(m.r, -3);
        ctx.lineTo(m.r - 2, m.r - 2);
        ctx.lineTo(-5, m.r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // 별 그물
      if (S.net) {
        const y = H - 40;
        ctx.strokeStyle = "#ffe27a";
        ctx.lineWidth = 3;
        ctx.setLineDash([3, 8]);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const it of S.items) drawItem(it);
      for (const l of S.lasers) {
        ctx.fillStyle = "#ff8ab5";
        roundRect(ctx, l.x - 2, l.y - 9, 4, 18, 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        roundRect(ctx, l.x - 1, l.y - 7, 2, 14, 1);
        ctx.fill();
      }
      drawPaddle();
      for (const b of S.balls) drawBall(b);
      drawAimGuide();
      for (const r of S.rings) {
        ctx.globalAlpha = clamp(r.life / r.max, 0, 1);
        ctx.strokeStyle = "#fff3a8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const q of S.particles) {
        ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
        ctx.fillStyle = q.color;
        if (q.star) {
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          const s = q.size * 1.5;
          ctx.beginPath();
          for (let i = 0; i < 8; i += 1) {
            const r = i % 2 ? s * 0.34 : s;
            const a = (i * Math.PI) / 4;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      for (const f of S.floats) {
        ctx.globalAlpha = clamp(f.life / 0.4, 0, 1);
        ctx.font = `${f.big ? 22 : 14}px "Jua", sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(30,16,70,0.8)";
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (S.flash > 0) {
      ctx.fillStyle = `rgba(255,255,240,${Math.min(0.55, S.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  let lastT = 0;
  let accum = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000 || 0));
    lastT = now;
    if (!S.paused) {
      accum += dt;
      let guard = 0;
      while (accum >= STEP && guard < 40) {
        step(STEP);
        accum -= STEP;
        guard += 1;
      }
      if (accum > 0.1) accum = 0;
    }
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- 단계 고르기 ---------- */
  function openStages(world) {
    const w = world == null ? Math.floor(save.unlocked / 10) : world;
    setScreen("stages");
    renderStages(w);
  }
  function renderStages(w) {
    $("stages-sum").textContent = `별 ${totalStars()} / 150`;
    const tabs = $("tabs");
    tabs.innerHTML = "";
    WORLDS.forEach((wd, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = wd.name;
      if (i === w) b.classList.add("on");
      b.addEventListener("click", () => renderStages(i));
      tabs.appendChild(b);
    });
    const grid = $("stage-grid");
    grid.innerHTML = "";
    for (let k = 0; k < 10; k += 1) {
      const i = w * 10 + k;
      const b = document.createElement("button");
      b.type = "button";
      const locked = i > save.unlocked;
      b.className = `cell${k === 9 ? " boss" : ""}${locked ? " lock" : ""}`;
      const st = save.best[i].st;
      b.innerHTML = `<b>${k === 9 ? "보스" : k + 1}</b><small>${locked ? "잠김" : "★".repeat(st) + "☆".repeat(3 - st)}</small>`;
      b.setAttribute("aria-label", `${w + 1}-${k + 1} ${NAMES[i]}${locked ? " 잠김" : ""}`);
      if (!locked) b.addEventListener("click", () => beginStage(i));
      grid.appendChild(b);
    }
  }

  /* ---------- 조작 ---------- */
  function pointerX(e) {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  }
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    Sfx.unlock();
    S.pointerX = pointerX(e);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    S.pressing = true;
  });
  canvas.addEventListener("pointermove", (e) => {
    S.pointerX = pointerX(e);
  });
  const endPress = () => {
    if (S.pressing && S.screen === "play" && !S.paused) launch();
    S.pressing = false;
  };
  canvas.addEventListener("pointerup", endPress);
  canvas.addEventListener("pointercancel", () => {
    S.pressing = false;
  });

  window.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (["Space", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    Sfx.unlock();
    if (e.code === "Space" && !e.repeat) launch();
    if (e.code === "ArrowLeft" || e.code === "KeyA") S.keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") S.keys.right = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") S.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") S.keys.right = false;
  });

  $("start-btn").addEventListener("click", () => beginStage(save.unlocked));
  $("stages-btn").addEventListener("click", () => openStages());
  $("stages-back").addEventListener("click", () => setScreen("title"));
  $("next-btn").addEventListener("click", nextStage);
  $("clear-retry").addEventListener("click", () => beginStage(S.stage));
  $("clear-map").addEventListener("click", () => openStages(stageInfo(S.stage).w));
  $("retry-btn").addEventListener("click", () => beginStage(S.stage));
  $("over-map").addEventListener("click", () => openStages(stageInfo(S.stage).w));
  $("again-btn").addEventListener("click", () => openStages(4));

  function refreshTitle() {
    if (save.unlocked > 0 || totalScore() > 0) {
      const info = stageInfo(save.unlocked);
      $("start-btn").textContent = `이어서 ${info.w + 1}-${info.k + 1}`;
      $("title-sub").innerHTML = `별 ${totalStars()} / 150 · 총점 ${totalScore().toLocaleString("ko-KR")}<br />5개 하늘 50단계 · 10단계마다 보스`;
    }
  }

  if (window.TodayGameRank) TodayGameRank.mount({ gameId: "brick", gameTitle: "별똥별 벽돌깨기", formParent: $("over-rank") });
  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => S.screen === "play",
      isPaused: () => S.paused,
      pause() {
        if (S.screen !== "play") return false;
        S.paused = true;
        S.pressing = false;
        return true;
      },
      resume() {
        S.paused = false;
        lastT = performance.now();
        accum = 0;
        return true;
      },
    });
  }

  window.addEventListener("resize", () => {
    resize();
  });
  resize();
  makeStars();
  S.paddle.w = 104;
  refreshTitle();
  setScreen("title");
  Promise.all(
    ["bg", "paddle", "ball"].map(
      (n) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            images[n] = im;
            res();
          };
          im.onerror = () => res();
          im.src = `assets/${n}.webp`;
        })
    )
  ).then(() => {
    Object.keys(backCache).forEach((k) => delete backCache[k]);
    window.BrickGame.ready = true;
  });
  requestAnimationFrame(frame);

  window.BrickGame = {
    ready: false,
    S,
    STEP,
    COLS,
    MOTIFS,
    layout,
    reachable,
    step,
    begin: beginStage,
    launch,
    next: nextStage,
    openStages,
    resetSave() {
      save = defaultSave();
      persist();
    },
    get save() {
      return save;
    },
    get H() {
      return H;
    },
    get paddleY() {
      return H - 92;
    },
    stageInfo,
    baseSpeed,
    dropItemForTest(id, x, y) {
      const kind = ITEM_KINDS.find((k) => k.id === id);
      S.items.push({ kind, x, y, vy: 112, t: 0 });
    },
  };
})();
