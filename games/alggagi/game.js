(() => {
  "use strict";

  /* ---------- 판 · 물리 ---------- */
  const W = 390;
  const H = 700;
  const TAU = Math.PI * 2;
  const BOARD = { x: 15, y: 124, size: 360, edge: 10, r: 10 };
  const GRID_M = 14; // 판 가장자리 ~ 첫 줄
  const STEP = 1 / 240; // 물리는 1/240초씩 고정
  const R = 15; // 알 반지름
  const R_KING = 19; // 왕깜장
  const VMAX = 1150; // 끝까지 당기면 나가는 빠르기 (px/초)
  const DECEL = 500; // 판 위에서 미끄러지며 줄어드는 빠르기 (px/초²)
  const DAMP = 0.7; // 빠를수록 조금 더 줄어듦 (/초)
  const E_STONE = 0.9; // 알끼리 튕김
  const E_PEG = 0.8; // 도토리 말뚝
  const PULL_MAX = 110; // 이만큼 당기면 최대 힘
  const FALL_TIME = 0.5;
  const TOTAL_STAGES = 50;
  const START_HEARTS = 3;
  const BEST_KEY = "today-alggagi-best";
  const TEST = /[?&]test=1\b/.test(location.search);

  const FORMS = [
    { id: "line", name: "한 줄 대결" },
    { id: "v", name: "브이 대형" },
    { id: "two", name: "두 줄 수비" },
    { id: "diamond", name: "다이아몬드" },
    { id: "scatter", name: "흩어진 알" },
    { id: "wall", name: "가운데 벽" },
    { id: "corners", name: "구석 숨기" },
    { id: "arc", name: "반달 대형" },
  ];
  const MY_FORMS = ["line", "two", "arc", "v"];

  function stageInfo(i) {
    const t = i / (TOTAL_STAGES - 1);
    const form = FORMS[i % FORMS.length];
    const kings = i >= 30 ? 2 : i >= 10 ? 1 : 0;
    const pegs = i >= 40 ? 3 : i >= 25 ? 2 : i >= 15 ? 1 : 0;
    return {
      form: form.id,
      name: form.name + (kings ? " · 왕깜장" : "") + (pegs ? " · 도토리" : ""),
      me: Math.min(5, 3 + Math.floor(i / 10)),
      ai: i < 2 ? 2 : Math.min(7, 3 + Math.floor((i + 2) / 7)), // 처음 두 단계는 깜장이 2개
      kings,
      pegs,
      // AI 실력: 가장 좋은 수를 고를 확률 · 겨냥 흔들림(라디안) · 힘 흔들림
      bestP: 0.22 + t * 0.72,
      aimErr: i < 3 ? 0.2 : 0.13 - t * 0.11,
      powErr: i < 3 ? 0.3 : 0.2 - t * 0.15,
      sloppy: i < 5, // 처음 몇 단계는 엉뚱한 수도 둠
      // 조준 안내: 맞은 알이 갈 길까지 보여 주는 건 20단계까지
      guideTarget: i < 20,
    };
  }

  /* ---------- 화면 ---------- */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let pxScale = 1;
  const staticLayer = document.createElement("canvas");

  const overlays = {
    title: document.getElementById("title"),
    round: document.getElementById("round"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };
  const el = {
    stage: document.getElementById("hud-stage"),
    score: document.getElementById("hud-score"),
    hearts: document.getElementById("hud-hearts"),
    name: document.getElementById("hud-name"),
    teamAi: document.getElementById("team-ai"),
    teamMe: document.getElementById("team-me"),
    aiLeft: document.getElementById("ai-left"),
    meLeft: document.getElementById("me-left"),
    aiSay: document.getElementById("ai-say"),
    meSay: document.getElementById("me-say"),
    tip: document.getElementById("tip"),
    dock: document.getElementById("dock"),
    titleBest: document.getElementById("title-best"),
    roundBadge: document.getElementById("round-badge"),
    roundTitle: document.getElementById("round-title"),
    roundDetail: document.getElementById("round-detail"),
    nextBtn: document.getElementById("next-btn"),
    overDetail: document.getElementById("over-detail"),
    allDetail: document.getElementById("all-detail"),
  };

  /* ---------- 상태 ---------- */
  let state = "title"; // title · play · paused · round · over · allclear
  let phase = "aim"; // aim · rolling · between · aiThink · aiAim · end
  let stageIndex = 0;
  let stage = stageInfo(0);
  let score = 0;
  let hearts = START_HEARTS;
  let best = readBest();
  let roundResult = null; // { win, draw, bonus }
  let turn = "me";
  let stones = [];
  let pegs = [];
  let shot = null; // 지금 굴러가는 한 수 { team, shooterId, outMe, outAi, t }
  let phaseT = 0;
  let aim = null;
  let aiPlanNow = null;
  let msgs = [];
  let particles = [];
  let shake = 0;
  let slowT = 0;
  let acc = 0;
  let t = 0;
  let last = performance.now();
  let nextId = 1;
  const sayTimers = { ai: 0, me: 0 };
  const bot = TEST ? { speed: 1, autoMe: null } : null;

  function readBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch (_) {
      return 0;
    }
  }
  function saveBest() {
    if (score <= best) return;
    best = score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (_) {}
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
  const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.58;

  /* ---------- 소리 (알끼리 '딱' · 떨어질 때 '퐁' · 공용 소리 끄기 버튼을 따름) ---------- */
  const SFX = (() => {
    let ac = null;
    const lastAt = {};
    function audio() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          ac = new AC();
        } catch (_) {
          return null;
        }
      }
      if (ac.state === "suspended") ac.resume().catch(() => {});
      return ac;
    }
    function tone(f, d, type, v, f2, at) {
      const a = audio();
      if (!a) return;
      const t0 = a.currentTime + (at || 0);
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g);
      g.connect(a.destination);
      o.start(t0);
      o.stop(t0 + d + 0.03);
    }
    function click(v, freq) {
      const a = audio();
      if (!a) return;
      const n = Math.floor(a.sampleRate * 0.03);
      const buf = a.createBuffer(1, n, a.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 5);
      const src = a.createBufferSource();
      src.buffer = buf;
      const f = a.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = 2;
      const g = a.createGain();
      g.gain.value = v;
      src.connect(f);
      f.connect(g);
      g.connect(a.destination);
      src.start();
    }
    function play(name, k) {
      const now = performance.now();
      const gap = name === "hit" ? 45 : 30;
      if (lastAt[name] && now - lastAt[name] < gap) return;
      lastAt[name] = now;
      switch (name) {
        case "hit": {
          const v = clamp((k || 300) / 900, 0.15, 1);
          click(0.9 * v, 2600);
          tone(1400 + v * 600, 0.05, "sine", 0.12 * v);
          break;
        }
        case "peg":
          click(0.5, 1200);
          tone(520, 0.06, "triangle", 0.08);
          break;
        case "pick":
          tone(660, 0.05, "sine", 0.06, 880);
          break;
        case "shoot":
          click(0.6, 1800);
          tone(300, 0.15, "sine", 0.07, 160);
          break;
        case "fall":
          tone(720, 0.32, "sine", 0.13, 180);
          break;
        case "extra":
          [784, 988, 1175].forEach((f, i) => tone(f, 0.14, "triangle", 0.1, 0, i * 0.07));
          break;
        case "multi":
          [659, 880, 1046, 1319].forEach((f, i) => tone(f, 0.16, "square", 0.05, 0, i * 0.06));
          break;
        case "win":
          [523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, 0.2, "triangle", 0.12, 0, i * 0.09));
          break;
        case "lose":
          [494, 440, 370, 330].forEach((f, i) => tone(f, 0.25, "sine", 0.1, 0, i * 0.13));
          break;
        default:
          break;
      }
    }
    return { play, unlock: audio };
  })();

  /* ---------- 배치 ---------- */
  // 위쪽(깜장이) 기준 판 비율 좌표 [x, y] — 하양이는 위아래를 뒤집어 씀
  function formation(kind, n) {
    const out = [];
    const mid = (n - 1) / 2;
    if (kind === "line") {
      for (let k = 0; k < n; k++) out.push([(k + 1) / (n + 1), 0.2]);
    } else if (kind === "two") {
      const a = Math.ceil(n / 2);
      const b = n - a;
      for (let k = 0; k < a; k++) out.push([(k + 1) / (a + 1), 0.15]);
      for (let k = 0; k < b; k++) out.push([(k + 1) / (b + 1), 0.3]);
    } else if (kind === "v") {
      for (let k = 0; k < n; k++) out.push([0.5 + (k - mid) * 0.13, 0.13 + Math.abs(k - mid) * 0.07]);
    } else if (kind === "arc") {
      for (let k = 0; k < n; k++) {
        const a = Math.PI * (0.18 + (0.64 * k) / Math.max(1, n - 1));
        out.push([0.5 + Math.cos(a) * 0.34, 0.1 + Math.sin(a) * 0.2]);
      }
    } else if (kind === "diamond") {
      const offs = [
        [0, 0],
        [-0.11, 0],
        [0.11, 0],
        [-0.055, -0.095],
        [0.055, -0.095],
        [-0.055, 0.095],
        [0.055, 0.095],
      ];
      for (let k = 0; k < n; k++) out.push([0.5 + offs[k][0], 0.24 + offs[k][1]]);
    } else if (kind === "wall") {
      for (let k = 0; k < n; k++) out.push([0.5 + (k - mid) * 0.115, 0.4]);
    } else if (kind === "corners") {
      const spots = [
        [0.14, 0.14],
        [0.86, 0.14],
        [0.27, 0.2],
        [0.73, 0.2],
        [0.14, 0.3],
        [0.86, 0.3],
        [0.5, 0.16],
      ];
      for (let k = 0; k < n; k++) out.push(spots[k]);
    } else {
      // 흩어진 알
      for (let tries = 0; out.length < n && tries < 400; tries++) {
        const p = [rand(0.12, 0.88), rand(0.1, 0.4)];
        if (out.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.13)) out.push(p);
      }
      while (out.length < n) out.push([(out.length + 1) / (n + 1), 0.22]);
    }
    return out.map(([x, y]) => [clamp(x + rand(-0.012, 0.012), 0.08, 0.92), clamp(y + rand(-0.012, 0.012), 0.06, 0.45)]);
  }

  function bx(f) {
    return BOARD.x + f * BOARD.size;
  }
  function by(f) {
    return BOARD.y + f * BOARD.size;
  }

  function makeStone(team, x, y, king) {
    return {
      id: nextId++,
      team,
      x,
      y,
      vx: 0,
      vy: 0,
      r: king ? R_KING : R,
      m: king ? 2.2 : 1,
      king: !!king,
      state: "board",
      fallT: 0,
      hitT: 0,
      lx: 0,
      ly: team === "me" ? -1 : 1,
      blink: Math.random() * 4,
    };
  }

  function setupRound() {
    stage = stageInfo(stageIndex);
    stones = [];
    pegs = [];
    const aiPos = formation(stage.form, stage.ai);
    // 왕깜장은 가운데 쪽 알부터
    const order = aiPos.map((p, k) => [Math.abs(p[0] - 0.5), k]).sort((a, b) => a[0] - b[0]).map((q) => q[1]);
    const kingSet = new Set(order.slice(0, stage.kings));
    aiPos.forEach(([fx, fy], k) => stones.push(makeStone("ai", bx(fx), by(fy), kingSet.has(k))));
    const myForm = MY_FORMS[Math.floor(Math.random() * MY_FORMS.length)];
    formation(myForm, stage.me).forEach(([fx, fy]) => stones.push(makeStone("me", bx(fx), by(1 - fy), false)));
    // 처음부터 붙어 있는 알은 살짝 떼어 놓음 (왕깜장은 더 커서)
    for (let it = 0; it < 30; it++) {
      let moved = false;
      for (let i = 0; i < stones.length; i++) {
        for (let j = i + 1; j < stones.length; j++) {
          const a2 = stones[i];
          const b2 = stones[j];
          const dx = b2.x - a2.x;
          const dy = b2.y - a2.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const need = a2.r + b2.r + 5;
          if (d >= need) continue;
          const push = (need - d) / 2;
          a2.x -= (dx / d) * push;
          a2.y -= (dy / d) * push;
          b2.x += (dx / d) * push;
          b2.y += (dy / d) * push;
          moved = true;
        }
      }
      for (const st of stones) {
        st.x = clamp(st.x, BOARD.x + st.r + 6, BOARD.x + BOARD.size - st.r - 6);
        st.y = clamp(st.y, BOARD.y + st.r + 6, BOARD.y + BOARD.size - st.r - 6);
      }
      if (!moved) break;
    }
    for (let k = 0; k < stage.pegs; k++) {
      for (let tries = 0; tries < 60; tries++) {
        const x = bx((k + 1) / (stage.pegs + 1) + rand(-0.06, 0.06));
        const y = by(0.5 + rand(-0.06, 0.06));
        if (stones.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + 9 + 14) && pegs.every((p) => Math.hypot(p.x - x, p.y - y) > 50)) {
          pegs.push({ x, y, r: 9, hitT: 0 });
          break;
        }
      }
    }
    turn = "me";
    phase = "aim";
    phaseT = 0;
    shot = null;
    aim = null;
    aiPlanNow = null;
    msgs = [];
    particles = [];
    roundResult = null;
    acc = 0;
    addMsg(`스테이지 ${stageIndex + 1}`, stage.name, 1.6);
    updateHud();
  }

  /* ---------- 물리 (게임과 AI 미리보기가 같이 씀) ---------- */
  function onBoard(s) {
    return s.x >= BOARD.x && s.x <= BOARD.x + BOARD.size && s.y >= BOARD.y && s.y <= BOARD.y + BOARD.size;
  }

  function stepWorld(list, pegList, dt, ev) {
    for (const s of list) {
      if (s.state === "gone") continue;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0) {
        const dec = (s.state === "falling" ? 2200 : DECEL + DAMP * sp) * dt;
        const ns = sp > dec ? sp - dec : 0;
        s.vx *= ns / sp;
        s.vy *= ns / sp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
    }
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.state !== "board") continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.state !== "board") continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const ia = 1 / a.m;
        const ib = 1 / b.m;
        const sum = ia + ib;
        const pen = min - d;
        a.x -= nx * pen * (ia / sum);
        a.y -= ny * pen * (ia / sum);
        b.x += nx * pen * (ib / sum);
        b.y += ny * pen * (ib / sum);
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const j2 = (-(1 + E_STONE) * rv) / sum;
          a.vx -= j2 * nx * ia;
          a.vy -= j2 * ny * ia;
          b.vx += j2 * nx * ib;
          b.vy += j2 * ny * ib;
          if (ev) ev.hits.push({ x: a.x + nx * a.r, y: a.y + ny * a.r, imp: -rv, a, b });
        }
      }
      for (const p of pegList) {
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        const min = a.r + p.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        a.x += nx * (min - d);
        a.y += ny * (min - d);
        const vn = a.vx * nx + a.vy * ny;
        if (vn < 0) {
          a.vx -= (1 + E_PEG) * vn * nx;
          a.vy -= (1 + E_PEG) * vn * ny;
          if (ev) ev.pegs.push({ p, imp: -vn });
        }
      }
    }
    for (const s of list) {
      if (s.state === "board" && !onBoard(s)) {
        s.state = "falling";
        s.fallT = 0;
        s.vx *= 0.35;
        s.vy *= 0.35;
        if (ev) ev.outs.push(s);
      }
    }
  }

  function stopped(list) {
    for (const s of list) if (s.state === "board" && (Math.abs(s.vx) > 2 || Math.abs(s.vy) > 2)) return false;
    return true;
  }

  /* 미끄러져 멈출 때까지 가는 거리 (dv/dt = -(DECEL + DAMP·v)) */
  function travel(v0) {
    if (v0 <= 0) return 0;
    const T = Math.log(1 + (DAMP * v0) / DECEL) / DAMP;
    return (v0 - DECEL * T) / DAMP;
  }
  /* 거리 s 만큼 간 뒤의 빠르기 (나누어 찾기) */
  function speedAfter(v0, s) {
    let lo = 0;
    let hi = v0;
    for (let k = 0; k < 24; k++) {
      const v = (lo + hi) / 2;
      const gone = (v0 - v) / DAMP - (DECEL / (DAMP * DAMP)) * Math.log((DECEL + DAMP * v0) / (DECEL + DAMP * v));
      if (gone > s) lo = v;
      else hi = v;
    }
    return lo;
  }

  /* ---------- AI: 여러 수를 실제로 굴려 보고 고름 ---------- */
  function snapshot() {
    return stones.filter((s) => s.state === "board").map((s) => ({ id: s.id, team: s.team, x: s.x, y: s.y, vx: 0, vy: 0, r: s.r, m: s.m, state: "board" }));
  }

  function edgeNear(s) {
    const d = Math.min(s.x - BOARD.x, BOARD.x + BOARD.size - s.x, s.y - BOARD.y, BOARD.y + BOARD.size - s.y);
    return clamp(1 - d / 60, 0, 1);
  }

  function evalShot(team, c) {
    const list = snapshot();
    const sh = list.find((s) => s.id === c.s.id);
    const v = c.p * VMAX;
    sh.vx = Math.cos(c.ang) * v;
    sh.vy = Math.sin(c.ang) * v;
    for (let k = 0; k < 600; k++) {
      stepWorld(list, pegs, 1 / 120, null);
      if (k % 8 === 7 && stopped(list)) break;
    }
    let sc = 0;
    for (const s of list) {
      const mine = s.team === team;
      if (s.state !== "board") sc += mine ? (s.id === c.s.id ? -140 : -120) : 100;
      else sc += mine ? -15 * edgeNear(s) : 30 * edgeNear(s);
    }
    return sc + Math.random() * 2;
  }

  function plan(team, skill) {
    const mine = stones.filter((s) => s.state === "board" && s.team === team);
    const theirs = stones.filter((s) => s.state === "board" && s.team !== team);
    if (!mine.length || !theirs.length) return null;
    const cands = [];
    for (const tg of theirs) {
      const shooters = mine.slice().sort((a, b) => Math.hypot(a.x - tg.x, a.y - tg.y) - Math.hypot(b.x - tg.x, b.y - tg.y)).slice(0, 2);
      for (const s of shooters) {
        const base = Math.atan2(tg.y - s.y, tg.x - s.x);
        for (const da of [-0.07, 0, 0.07]) for (const p of [0.55, 0.78, 1]) cands.push({ s, ang: base + da, p });
      }
    }
    for (const c of cands) c.score = evalShot(team, c);
    cands.sort((a, b) => b.score - a.score);
    let choice = cands[0];
    if (Math.random() > skill.bestP) {
      choice = skill.sloppy ? cands[Math.floor(Math.random() * cands.length)] : cands[Math.floor(Math.random() * Math.min(6, cands.length))];
    }
    const ang = choice.ang + gauss() * skill.aimErr;
    const p = clamp(choice.p * (1 + (Math.random() * 2 - 1) * skill.powErr), 0.3, 1);
    return { s: choice.s, vx: Math.cos(ang) * p * VMAX, vy: Math.sin(ang) * p * VMAX };
  }

  /* ---------- 한 수 ---------- */
  function shoot(team, s, vx, vy) {
    s.vx = vx;
    s.vy = vy;
    shot = { team, shooterId: s.id, outMe: 0, outAi: 0, t: 0 };
    phase = "rolling";
    phaseT = 0;
    aim = null;
    aiPlanNow = null;
    SFX.play("shoot");
    updateHud();
  }

  function alive(team) {
    return stones.filter((s) => s.team === team && s.state === "board").length;
  }

  function say(team, text) {
    const node = team === "ai" ? el.aiSay : el.meSay;
    node.textContent = text;
    node.classList.add("show");
    sayTimers[team] = 1.4;
  }

  function onOut(s) {
    if (!shot) return;
    if (s.team === "me") shot.outMe += 1;
    else shot.outAi += 1;
    SFX.play("fall");
    burst(s.x, s.y, 10, s.team === "me" ? ["#fff", "#e8e0d0"] : ["#3a3a42", "#8a8a96"], 160);
    addFloat(s.x, s.y - 20, "퐁!", s.team === "me" ? "#ff7a59" : "#2fa67a");
    say(s.team, s.team === "ai" ? pick(["앗!", "으앗!", "안 돼~", "히잉"]) : pick(["으앙!", "앗!", "안 돼~"]));
    // 마지막 깜장이가 떨어지면 잠깐 느리게
    if (s.team === "ai" && alive("ai") === 0) slowT = 0.9;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function resolveShot() {
    const team = shot.team;
    const shooter = stones.find((s) => s.id === shot.shooterId);
    const oppOut = team === "me" ? shot.outAi : shot.outMe;
    if (team === "me" && shot.outAi > 0) {
      const gain = [0, 100, 300, 600, 1000][Math.min(4, shot.outAi)] + Math.max(0, shot.outAi - 4) * 400;
      score += gain;
      saveBest();
      if (shot.outAi >= 2) {
        addMsg(shot.outAi === 2 ? "더블!" : shot.outAi === 3 ? "트리플!" : "와르르!", `+${fmt(gain)}`, 1.3);
        SFX.play("multi");
        shake = 6;
      }
    }
    shot = null;
    const me = alive("me");
    const ai = alive("ai");
    if (ai === 0 || me === 0) {
      endRound(ai === 0 && me > 0, ai === 0 && me === 0);
      return;
    }
    const extra = oppOut > 0 && shooter && shooter.state === "board";
    if (extra) {
      addMsg("한 번 더!", team === "me" ? "또 쏠 수 있어요" : "깜장이가 또 쏴요", 1.1);
      SFX.play("extra");
    } else {
      turn = team === "me" ? "ai" : "me";
      addMsg(turn === "me" ? "내 차례!" : "깜장이 차례", "", 0.9);
    }
    phase = "between";
    phaseT = 0;
    updateHud();
  }

  function endRound(win, draw) {
    phase = "end";
    phaseT = 0;
    const meLeft = alive("me");
    if (draw) {
      roundResult = { win: false, draw: true, bonus: 0 };
      addMsg("무승부!", "한 번 더 해요", 1.4);
    } else if (win) {
      const bonus = meLeft * 200 + (stageIndex + 1) * 20;
      score += bonus;
      saveBest();
      roundResult = { win: true, draw: false, bonus };
      addMsg("다 깠다!", `남은 하양이 ${meLeft}개`, 1.6);
      SFX.play("win");
      for (let k = 0; k < 50; k++) particles.push(confetti());
    } else {
      roundResult = { win: false, draw: false, bonus: 0 };
      addMsg("아쉬워요!", "하양이가 모두 떨어졌어요", 1.6);
      SFX.play("lose");
    }
    updateHud();
  }

  function showRoundResult() {
    const r = roundResult;
    if (r.win) {
      if (stageIndex >= TOTAL_STAGES - 1) {
        state = "allclear";
        el.allDetail.textContent = `50스테이지를 모두 깼어요! 최종 ${fmt(score)}점 · 최고 ${fmt(best)}점`;
        showOverlay("all");
        if (window.TodayGameRank) {
          TodayGameRank.mount({ gameId: "alggagi", gameTitle: "알까기", formParent: overlays.all });
          TodayGameRank.open(score);
        }
        return;
      }
      state = "round";
      el.roundBadge.textContent = "ROUND WIN";
      el.roundBadge.className = "badge";
      el.roundTitle.textContent = "라운드 승리!";
      el.roundDetail.textContent = `깜장이를 모두 떨어뜨렸어요 · 보너스 +${fmt(r.bonus)} · 지금 ${fmt(score)}점`;
      el.nextBtn.textContent = "다음 스테이지";
      el.nextBtn.dataset.next = "1";
      showOverlay("round");
      return;
    }
    if (!r.draw) hearts -= 1;
    if (hearts <= 0) {
      state = "over";
      el.overDetail.textContent = `스테이지 ${stageIndex + 1}까지 · ${fmt(score)}점 · 최고 ${fmt(best)}점`;
      showOverlay("over");
      if (window.TodayGameRank) {
        TodayGameRank.mount({ gameId: "alggagi", gameTitle: "알까기", formParent: overlays.over });
        TodayGameRank.open(score);
      }
      return;
    }
    state = "round";
    el.roundBadge.textContent = r.draw ? "DRAW" : "TRY AGAIN";
    el.roundBadge.className = "badge lose";
    el.roundTitle.textContent = r.draw ? "무승부!" : "아쉬워요!";
    el.roundDetail.textContent = r.draw ? "같이 다 떨어졌어요 · 하트는 그대로예요" : `하트 하나로 다시 도전해요 · 남은 하트 ${"♥".repeat(hearts)}`;
    el.nextBtn.textContent = "다시 도전";
    el.nextBtn.dataset.next = "0";
    showOverlay("round");
    updateHud();
  }

  function showOverlay(name) {
    for (const [k, node] of Object.entries(overlays)) if (node) node.classList.toggle("hidden", k !== name);
    if (name === "title" && el.titleBest) el.titleBest.textContent = best > 0 ? `최고 점수 ${fmt(best)}점` : "";
  }

  function startGame() {
    SFX.unlock();
    stageIndex = 0;
    score = 0;
    hearts = START_HEARTS;
    if (window.TodayGameRank) TodayGameRank.reset();
    setupRound();
    state = "play";
    showOverlay(null);
    updateHud();
  }

  function nextRound() {
    SFX.unlock();
    if (el.nextBtn.dataset.next === "1") stageIndex = Math.min(TOTAL_STAGES - 1, stageIndex + 1);
    setupRound();
    state = "play";
    showOverlay(null);
    updateHud();
  }

  /* ---------- 진행 ---------- */
  function step(dt) {
    t += dt;
    phaseT += dt;
    if (phase === "rolling") {
      shot.t += dt;
      const ev = { hits: [], pegs: [], outs: [] };
      stepWorld(stones, pegs, dt, ev);
      for (const h of ev.hits) {
        if (h.imp > 120) {
          h.a.hitT = 0.35;
          h.b.hitT = 0.35;
        }
        if (h.imp > 60) SFX.play("hit", h.imp);
        if (h.imp > 260) {
          burst(h.x, h.y, 5, ["#fff", "#ffe58a"], 120);
          shake = Math.max(shake, Math.min(5, h.imp / 220));
        }
      }
      for (const p of ev.pegs) {
        p.p.hitT = 0.3;
        if (p.imp > 60) SFX.play("peg");
      }
      for (const s of ev.outs) onOut(s);
      const falling = stones.some((s) => s.state === "falling");
      if ((stopped(stones) && !falling) || shot.t > 9) {
        for (const s of stones) {
          if (s.state === "board") {
            s.vx = 0;
            s.vy = 0;
          }
        }
        resolveShot();
      }
    } else if (phase === "between") {
      if (phaseT > 0.55) {
        phase = turn === "me" ? "aim" : "aiThink";
        phaseT = 0;
        updateHud();
      }
    } else if (phase === "aiThink") {
      if (phaseT > 0.75) {
        aiPlanNow = plan("ai", stage);
        if (!aiPlanNow) {
          turn = "me";
          phase = "aim";
        } else {
          phase = "aiAim";
          say("ai", pick(["간다~", "에잇!", "받아라!", "흐흐"]));
        }
        phaseT = 0;
        updateHud();
      }
    } else if (phase === "aiAim") {
      if (phaseT > 0.7) shoot("ai", aiPlanNow.s, aiPlanNow.vx, aiPlanNow.vy);
    } else if (phase === "aim") {
      if (bot && bot.autoMe && phaseT > 0.05) {
        const p = plan("me", bot.autoMe);
        if (p) shoot("me", p.s, p.vx, p.vy);
      }
    } else if (phase === "end") {
      if (phaseT > 1.5) showRoundResult();
    }
    for (const s of stones) {
      if (s.hitT > 0) s.hitT -= dt;
      if (s.state === "falling") {
        s.fallT += dt;
        if (s.fallT >= FALL_TIME) s.state = "gone";
      }
    }
    for (const p of pegs) if (p.hitT > 0) p.hitT -= dt;
  }

  /* ---------- 반짝이 · 글자 ---------- */
  function burst(x, y, n, colors, speed) {
    for (let k = 0; k < n; k++) {
      const a = rand(0, TAU);
      const sp = rand(0.3, 1) * speed;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.6), max: 0.6, color: colors[k % colors.length], size: rand(2, 4), g: 0, kind: "dot" });
    }
  }
  function confetti() {
    return { x: rand(20, 370), y: rand(60, 140), vx: rand(-40, 40), vy: rand(40, 160), life: rand(1.2, 2), max: 2, color: pick(["#ff7a59", "#f2b53a", "#2fa67a", "#6cc4ff", "#ff9cc8"]), size: rand(3, 6), g: 140, kind: "rect", rot: rand(0, TAU), vr: rand(-6, 6) };
  }
  function addFloat(x, y, text, color) {
    particles.push({ x, y, vx: 0, vy: -40, life: 0.9, max: 0.9, color, text, kind: "text", g: 0 });
  }
  function addMsg(title, sub, dur) {
    msgs = [{ title, sub, t: 0, dur }];
  }

  /* ---------- 그림 도구 ---------- */
  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, TAU);
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function outlined(g, text, x, y, size, fill, stroke, font) {
    g.font = `${size}px ${font || '"Jua"'}, system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = Math.max(3, size * 0.24);
    g.strokeStyle = stroke;
    g.strokeText(text, x, y);
    g.fillStyle = fill;
    g.fillText(text, x, y);
  }

  /* 체크 식탁보 + 원목 바둑판 (한 번만 그려 둠) */
  function buildStatic() {
    staticLayer.width = canvas.width;
    staticLayer.height = canvas.height;
    const g = staticLayer.getContext("2d");
    g.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    // 식탁보
    g.fillStyle = "#f3fbf7";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(110,200,160,0.22)";
    for (let x = 0; x < W; x += 40) g.fillRect(x, 0, 20, H);
    for (let y = 0; y < H; y += 40) g.fillRect(0, y, W, 20);
    g.fillStyle = "rgba(255,255,255,0.35)";
    for (let y = 0; y < H; y += 40) for (let x = 0; x < W; x += 40) g.fillRect(x + 4, y + 4, 2, 2);
    const vg = g.createRadialGradient(W / 2, H / 2, 160, W / 2, H / 2, 470);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(30,90,60,0.16)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    // 판 그림자 · 두께
    const { x, y, size, edge, r } = BOARD;
    g.save();
    g.shadowColor = "rgba(40,70,50,0.38)";
    g.shadowBlur = 22;
    g.shadowOffsetY = 12;
    roundRect(g, x, y, size, size + edge, r);
    g.fillStyle = "#9a6434";
    g.fill();
    g.restore();
    roundRect(g, x, y, size, size + edge, r);
    const side = g.createLinearGradient(0, y + size - 4, 0, y + size + edge);
    side.addColorStop(0, "#b47a40");
    side.addColorStop(1, "#7f4f25");
    g.fillStyle = side;
    g.fill();
    // 윗면 나무
    g.save();
    roundRect(g, x, y, size, size, r);
    g.clip();
    const wood = g.createLinearGradient(x, y, x + size, y + size);
    wood.addColorStop(0, "#f0cf96");
    wood.addColorStop(0.5, "#e4ba7a");
    wood.addColorStop(1, "#d7a564");
    g.fillStyle = wood;
    g.fillRect(x, y, size, size);
    const rnd = seeded(19);
    for (let k = 0; k < 64; k++) {
      const y0 = y - 10 + (k / 64) * (size + 20) + (rnd() - 0.5) * 4;
      const a1 = 1.5 + rnd() * 3.5;
      const f1 = 0.008 + rnd() * 0.012;
      const p1 = rnd() * TAU;
      const a2 = 0.6 + rnd() * 1.4;
      const f2 = 0.03 + rnd() * 0.04;
      const p2 = rnd() * TAU;
      g.strokeStyle = `rgba(${140 + rnd() * 30},${85 + rnd() * 25},${40 + rnd() * 15},${0.05 + rnd() * 0.12})`;
      g.lineWidth = 0.5 + rnd() * 1.6;
      g.beginPath();
      for (let px = x - 4; px <= x + size + 4; px += 6) {
        const py = y0 + Math.sin(px * f1 + p1) * a1 + Math.sin(px * f2 + p2) * a2;
        if (px === x - 4) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    const sheen = g.createLinearGradient(x, y, x + size * 0.7, y + size * 0.7);
    sheen.addColorStop(0, "rgba(255,255,255,0.22)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(x, y, size, size);
    g.restore();
    roundRect(g, x + 0.5, y + 0.5, size - 1, size - 1, r);
    g.strokeStyle = "rgba(255,240,210,0.6)";
    g.lineWidth = 1;
    g.stroke();
    // 19줄 · 화점
    const cell = (size - GRID_M * 2) / 18;
    const gx0 = x + GRID_M;
    const gy0 = y + GRID_M;
    g.strokeStyle = "rgba(60,38,16,0.55)";
    g.lineWidth = 0.9;
    g.beginPath();
    for (let i = 0; i < 19; i++) {
      g.moveTo(gx0, gy0 + i * cell);
      g.lineTo(gx0 + 18 * cell, gy0 + i * cell);
      g.moveTo(gx0 + i * cell, gy0);
      g.lineTo(gx0 + i * cell, gy0 + 18 * cell);
    }
    g.stroke();
    g.lineWidth = 1.6;
    g.strokeRect(gx0, gy0, 18 * cell, 18 * cell);
    g.fillStyle = "rgba(60,38,16,0.7)";
    for (const a of [3, 9, 15]) {
      for (const b of [3, 9, 15]) {
        circle(g, gx0 + a * cell, gy0 + b * cell, 2.4);
        g.fill();
      }
    }
    // 가운데 줄 (내 쪽 · 상대 쪽) 은은하게
    g.strokeStyle = "rgba(47,166,122,0.25)";
    g.setLineDash([6, 6]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + 10, y + size / 2);
    g.lineTo(x + size - 10, y + size / 2);
    g.stroke();
    g.setLineDash([]);
  }

  /* ---------- 알 그리기 (얼굴) ---------- */
  function drawStone(g, s) {
    let sc = 1;
    let alpha = 1;
    let dropY = 0;
    if (s.state === "falling") {
      const e = s.fallT / FALL_TIME;
      sc = 1 - 0.55 * e;
      alpha = 1 - e * 0.9;
      dropY = e * e * 14;
    }
    const x = s.x;
    const y = s.y + dropY;
    const r = s.r * sc;
    g.globalAlpha = alpha;
    // 그림자
    if (s.state === "board") {
      g.fillStyle = "rgba(60,35,12,0.3)";
      g.beginPath();
      g.ellipse(x + 2, y + 3.5, r * 1.02, r * 0.92, 0, 0, TAU);
      g.fill();
    }
    const black = s.team === "ai";
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.05);
    if (black) {
      gr.addColorStop(0, "#74747c");
      gr.addColorStop(0.25, "#35353b");
      gr.addColorStop(0.7, "#161619");
      gr.addColorStop(1, "#0a0a0c");
    } else {
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.45, "#f7f3eb");
      gr.addColorStop(0.85, "#ded6c7");
      gr.addColorStop(1, "#c9bfac");
    }
    g.fillStyle = gr;
    circle(g, x, y, r);
    g.fill();
    if (!black) {
      g.strokeStyle = "rgba(120,100,70,0.35)";
      g.lineWidth = 0.8;
      g.stroke();
    }
    // 반짝
    g.fillStyle = black ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.9)";
    g.beginPath();
    g.ellipse(x - r * 0.42, y - r * 0.5, r * 0.22, r * 0.13, -0.6, 0, TAU);
    g.fill();
    // 얼굴
    const k = r / R;
    const lx = s.lx * 1.6 * k;
    const ly = s.ly * 1.2 * k;
    const ex = 4.6 * k;
    const ey = y - 1.5 * k;
    const falling = s.state === "falling";
    const hit = s.hitT > 0;
    const happy = phase === "end" && roundResult && ((roundResult.win && !black) || (!roundResult.win && !roundResult.draw && black));
    const blink = ((t + s.blink) % 3.6) < 0.12;
    const eyeCol = black ? "#fff" : "#2b2420";
    g.lineCap = "round";
    if (falling) {
      for (const sd of [-1, 1]) {
        g.fillStyle = black ? "#fff" : "#fff";
        circle(g, x + sd * ex, ey, 3.2 * k);
        g.fill();
        g.fillStyle = "#1a1a1d";
        circle(g, x + sd * ex, ey, 1.5 * k);
        g.fill();
      }
      g.fillStyle = black ? "#fff" : "#7a3b2c";
      g.beginPath();
      g.ellipse(x, y + 5 * k, 2 * k, 2.6 * k, 0, 0, TAU);
      g.fill();
    } else if (hit) {
      g.strokeStyle = eyeCol;
      g.lineWidth = 1.6 * k;
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(x + sd * ex - sd * 2.2 * k, ey - 2 * k);
        g.lineTo(x + sd * ex + sd * 1.2 * k, ey);
        g.lineTo(x + sd * ex - sd * 2.2 * k, ey + 2 * k);
        g.stroke();
      }
    } else if (happy || blink) {
      g.strokeStyle = eyeCol;
      g.lineWidth = 1.6 * k;
      for (const sd of [-1, 1]) {
        g.beginPath();
        if (happy) g.arc(x + sd * ex, ey + 1 * k, 2.2 * k, Math.PI * 1.15, Math.PI * 1.85);
        else {
          g.moveTo(x + sd * ex - 2 * k, ey);
          g.lineTo(x + sd * ex + 2 * k, ey);
        }
        g.stroke();
      }
    } else if (black) {
      for (const sd of [-1, 1]) {
        g.fillStyle = "#fff";
        circle(g, x + sd * ex, ey, 3.3 * k);
        g.fill();
        g.fillStyle = "#16161a";
        circle(g, x + sd * ex + lx, ey + ly, 1.7 * k);
        g.fill();
      }
      // 장난꾸러기 눈썹
      g.strokeStyle = "rgba(255,255,255,0.75)";
      g.lineWidth = 1.2 * k;
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(x + sd * (ex + 2.6 * k), ey - 4.6 * k);
        g.lineTo(x + sd * (ex - 2 * k), ey - 3.8 * k);
        g.stroke();
      }
    } else {
      for (const sd of [-1, 1]) {
        g.fillStyle = "#2b2420";
        g.beginPath();
        g.ellipse(x + sd * ex + lx * 0.7, ey + ly * 0.7, 1.9 * k, 2.6 * k, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#fff";
        circle(g, x + sd * ex + lx * 0.7 + 0.6 * k, ey + ly * 0.7 - 0.9 * k, 0.7 * k);
        g.fill();
      }
    }
    if (!falling) {
      // 볼 · 입
      g.fillStyle = black ? "rgba(255,120,150,0.4)" : "rgba(255,120,150,0.5)";
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.ellipse(x + sd * 7.8 * k, y + 3 * k, 2.4 * k, 1.5 * k, 0, 0, TAU);
        g.fill();
      }
      g.strokeStyle = black ? "rgba(255,255,255,0.8)" : "#5a3a30";
      g.lineWidth = 1.3 * k;
      g.beginPath();
      if (hit) g.arc(x, y + 6 * k, 1.8 * k, Math.PI * 1.1, Math.PI * 1.9);
      else g.arc(x, y + 2.8 * k, 2.3 * k, 0.25, Math.PI - 0.25);
      g.stroke();
    }
    // 왕관
    if (s.king) {
      g.fillStyle = "#f2c230";
      g.strokeStyle = "#b98a10";
      g.lineWidth = 1;
      g.beginPath();
      const cy = y - r - 1;
      g.moveTo(x - 7 * k, cy + 3 * k);
      g.lineTo(x - 7 * k, cy - 3 * k);
      g.lineTo(x - 3.5 * k, cy);
      g.lineTo(x, cy - 5 * k);
      g.lineTo(x + 3.5 * k, cy);
      g.lineTo(x + 7 * k, cy - 3 * k);
      g.lineTo(x + 7 * k, cy + 3 * k);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function drawPeg(g, p) {
    const s = 1 + (p.hitT > 0 ? p.hitT * 0.5 : 0);
    g.fillStyle = "rgba(60,35,12,0.3)";
    g.beginPath();
    g.ellipse(p.x + 1.5, p.y + 3, p.r, p.r * 0.85, 0, 0, TAU);
    g.fill();
    g.save();
    g.translate(p.x, p.y);
    g.scale(s, s);
    // 도토리
    const body = g.createRadialGradient(-3, 0, 1, 0, 2, 10);
    body.addColorStop(0, "#e2a15a");
    body.addColorStop(1, "#a8652a");
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, 2, 7.5, 8, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#6f4520";
    g.beginPath();
    g.ellipse(0, -3, 9, 5.5, 0, Math.PI, TAU);
    g.lineTo(9, -3);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255,230,190,0.35)";
    g.lineWidth = 0.8;
    for (let k = -6; k <= 6; k += 3) {
      g.beginPath();
      g.moveTo(k, -3);
      g.lineTo(k + 2, -7);
      g.stroke();
    }
    g.strokeStyle = "#6f4520";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(1.5, -11);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.beginPath();
    g.ellipse(-3, 2, 1.6, 2.8, 0.3, 0, TAU);
    g.fill();
    g.restore();
  }

  /* ---------- 조준 안내 ---------- */
  function aimShot() {
    if (!aim) return null;
    const len = Math.hypot(aim.dx, aim.dy);
    if (len < 12) return null;
    const p = clamp(len / PULL_MAX, 0.1, 1);
    return { dirx: -aim.dx / len, diry: -aim.dy / len, p, v: p * VMAX };
  }

  function predict(s, dirx, diry, v0) {
    const D = travel(v0);
    let tHit = Infinity;
    let hitObj = null;
    for (const o of stones) {
      if (o === s || o.state !== "board") continue;
      const fx = s.x - o.x;
      const fy = s.y - o.y;
      const rr = s.r + o.r;
      const b = fx * dirx + fy * diry;
      const c = fx * fx + fy * fy - rr * rr;
      const disc = b * b - c;
      if (disc < 0) continue;
      const th = -b - Math.sqrt(disc);
      if (th >= 0 && th < tHit) {
        tHit = th;
        hitObj = o;
      }
    }
    for (const o of pegs) {
      const fx = s.x - o.x;
      const fy = s.y - o.y;
      const rr = s.r + o.r;
      const b = fx * dirx + fy * diry;
      const c = fx * fx + fy * fy - rr * rr;
      const disc = b * b - c;
      if (disc < 0) continue;
      const th = -b - Math.sqrt(disc);
      if (th >= 0 && th < tHit) {
        tHit = th;
        hitObj = { peg: true, ...o };
      }
    }
    // 판 밖으로 나가는 곳
    let tEdge = Infinity;
    if (dirx > 0) tEdge = Math.min(tEdge, (BOARD.x + BOARD.size - s.x) / dirx);
    if (dirx < 0) tEdge = Math.min(tEdge, (BOARD.x - s.x) / dirx);
    if (diry > 0) tEdge = Math.min(tEdge, (BOARD.y + BOARD.size - s.y) / diry);
    if (diry < 0) tEdge = Math.min(tEdge, (BOARD.y - s.y) / diry);
    const end = Math.min(D, tHit, tEdge);
    const res = { end, hit: null, falls: tEdge <= Math.min(D, tHit) };
    if (hitObj && tHit <= D && tHit < tEdge) {
      const gx = s.x + dirx * tHit;
      const gy = s.y + diry * tHit;
      let nx = hitObj.x - gx;
      let ny = hitObj.y - gy;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      res.hit = { gx, gy, o: hitObj, nx, ny };
      if (!hitObj.peg) {
        const vAt = speedAfter(v0, tHit);
        const vn = vAt * Math.max(0, dirx * nx + diry * ny);
        const vt = ((1 + E_STONE) * s.m) / (s.m + hitObj.m) * vn;
        const dt2 = travel(vt);
        // 맞은 알이 판 밖으로 나가나
        let te = Infinity;
        if (nx > 0) te = Math.min(te, (BOARD.x + BOARD.size - hitObj.x) / nx);
        if (nx < 0) te = Math.min(te, (BOARD.x - hitObj.x) / nx);
        if (ny > 0) te = Math.min(te, (BOARD.y + BOARD.size - hitObj.y) / ny);
        if (ny < 0) te = Math.min(te, (BOARD.y - hitObj.y) / ny);
        res.hit.dist = Math.min(dt2, te);
        res.hit.out = te < dt2;
      }
    }
    return res;
  }

  function dots(g, x0, y0, x1, y1, color, gap) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.floor(len / gap);
    g.fillStyle = color;
    for (let k = 1; k <= n; k++) {
      const f = k / Math.max(1, n);
      circle(g, x0 + (x1 - x0) * (k * gap) / len, y0 + (y1 - y0) * (k * gap) / len, 2.3 - f * 0.8);
      g.fill();
    }
  }

  function drawAim(g) {
    const sh = aimShot();
    if (!aim) return;
    const s = aim.s;
    // 고른 알 고리
    g.strokeStyle = "rgba(242,181,58,0.9)";
    g.lineWidth = 2.5;
    circle(g, s.x, s.y, s.r + 5 + Math.sin(t * 8) * 1);
    g.stroke();
    if (!sh) return;
    // 고무줄 (손가락 쪽)
    const pull = Math.min(Math.hypot(aim.dx, aim.dy), PULL_MAX);
    const hx = s.x - sh.dirx * pull;
    const hy = s.y - sh.diry * pull;
    g.strokeStyle = "rgba(120,80,40,0.45)";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(hx, hy);
    g.stroke();
    g.fillStyle = "rgba(120,80,40,0.5)";
    circle(g, hx, hy, 5);
    g.fill();
    // 힘 고리
    g.strokeStyle = sh.p > 0.85 ? "#ff7a59" : "#f2b53a";
    g.lineWidth = 4;
    g.beginPath();
    g.arc(s.x, s.y, s.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * sh.p);
    g.stroke();
    // 가는 길
    const pr = predict(s, sh.dirx, sh.diry, sh.v);
    const ex = s.x + sh.dirx * pr.end;
    const ey = s.y + sh.diry * pr.end;
    dots(g, s.x, s.y, ex, ey, pr.falls ? "rgba(255,90,70,0.85)" : "rgba(255,255,255,0.95)", 11);
    if (pr.falls) {
      outlined(g, "내 알이 떨어져요!", clamp(ex, 70, 320), clamp(ey - 18, BOARD.y + 12, BOARD.y + BOARD.size - 12), 13, "#fff", "#ff5a46");
    } else if (pr.hit) {
      // 부딪히는 자리 (유령 알)
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 2;
      g.setLineDash([4, 3]);
      circle(g, pr.hit.gx, pr.hit.gy, s.r);
      g.stroke();
      g.setLineDash([]);
      if (pr.hit.dist != null) {
        const o = pr.hit.o;
        const L = stage.guideTarget ? pr.hit.dist : Math.min(28, pr.hit.dist);
        const tx = o.x + pr.hit.nx * L;
        const ty = o.y + pr.hit.ny * L;
        const col = o.team === "ai" ? (pr.hit.out ? "rgba(47,200,140,0.95)" : "rgba(242,181,58,0.95)") : "rgba(255,90,70,0.9)";
        dots(g, o.x, o.y, tx, ty, col, 9);
        if (stage.guideTarget && pr.hit.out && o.team === "ai") outlined(g, "퐁!", clamp(tx, 30, 360), clamp(ty, BOARD.y + 10, BOARD.y + BOARD.size - 10), 16, "#fff", "#2fa67a");
      }
    } else {
      circle(g, ex, ey, 4);
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.fill();
    }
  }

  /* AI 가 쏘기 전: 당기는 모습 */
  function drawAiAim(g) {
    if (phase !== "aiAim" || !aiPlanNow) return;
    const s = aiPlanNow.s;
    const v = Math.hypot(aiPlanNow.vx, aiPlanNow.vy) || 1;
    const dx = aiPlanNow.vx / v;
    const dy = aiPlanNow.vy / v;
    const e = clamp(phaseT / 0.6, 0, 1);
    const pull = (v / VMAX) * 70 * e;
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 2.5;
    circle(g, s.x, s.y, s.r + 5);
    g.stroke();
    g.strokeStyle = "rgba(60,60,70,0.45)";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(s.x - dx * pull, s.y - dy * pull);
    g.stroke();
    dots(g, s.x, s.y, s.x + dx * 60 * e, s.y + dy * 60 * e, "rgba(40,40,50,0.55)", 10);
  }

  function updateLooks(dt) {
    const k = Math.min(1, dt * 10);
    const focus = aim ? aim.s : phase === "aiAim" && aiPlanNow ? aiPlanNow.s : null;
    const sh = aimShot();
    for (const s of stones) {
      if (s.state === "gone") continue;
      let tx = 0;
      let ty = 0;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 20) {
        tx = s.vx / sp;
        ty = s.vy / sp;
      } else if (aim && s === aim.s && sh) {
        tx = sh.dirx;
        ty = sh.diry;
      } else if (focus && s !== focus) {
        const d = Math.hypot(focus.x - s.x, focus.y - s.y) || 1;
        tx = (focus.x - s.x) / d;
        ty = (focus.y - s.y) / d;
      } else {
        let bd = Infinity;
        for (const o of stones) {
          if (o.team === s.team || o.state !== "board") continue;
          const d = Math.hypot(o.x - s.x, o.y - s.y);
          if (d < bd) {
            bd = d;
            tx = (o.x - s.x) / d;
            ty = (o.y - s.y) / d;
          }
        }
      }
      s.lx += (tx - s.lx) * k;
      s.ly += (ty - s.ly) * k;
    }
  }

  function render(dt) {
    const g = ctx;
    g.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    g.save();
    if (shake > 0.1) g.translate(rand(-shake, shake), rand(-shake, shake));
    g.drawImage(staticLayer, 0, 0, W, H);
    for (const p of pegs) drawPeg(g, p);
    const list = stones.filter((s) => s.state !== "gone").sort((a, b) => (a.state === "falling") - (b.state === "falling") || a.y - b.y);
    for (const s of list) drawStone(g, s);
    drawAiAim(g);
    drawAim(g);
    // 반짝이 · 글자
    for (const p of particles) {
      g.globalAlpha = clamp(p.life / (p.max * 0.5), 0, 1);
      if (p.kind === "text") outlined(g, p.text, p.x, p.y, 18, "#fff", p.color);
      else if (p.kind === "rect") {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g.restore();
      } else {
        g.fillStyle = p.color;
        circle(g, p.x, p.y, p.size);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    // 가운데 알림
    for (const m of msgs) {
      const k = m.t / m.dur;
      const inK = Math.min(1, m.t / 0.18);
      const outK = Math.min(1, (m.dur - m.t) / 0.25);
      g.save();
      g.globalAlpha = Math.max(0, outK);
      g.translate(W / 2, BOARD.y + BOARD.size / 2);
      const s = 0.6 + 0.4 * (1 - (1 - inK) ** 3) + (k < 0.25 ? 0.08 * Math.sin(inK * Math.PI) : 0);
      g.scale(s, s);
      outlined(g, m.title, 0, m.sub ? -12 : 0, 34, "#fff", "#2fa67a", '"Bagel Fat One", "Jua"');
      if (m.sub) outlined(g, m.sub, 0, 22, 16, "#2f6b52", "#fff");
      g.restore();
    }
    g.restore();
  }

  function animate(dt) {
    updateLooks(dt);
    for (const p of particles) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot != null) p.rot += p.vr * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const m of msgs) m.t += dt;
    msgs = msgs.filter((m) => m.t < m.dur);
    shake *= Math.exp(-dt * 12);
    for (const team of ["ai", "me"]) {
      if (sayTimers[team] > 0) {
        sayTimers[team] -= dt;
        if (sayTimers[team] <= 0) (team === "ai" ? el.aiSay : el.meSay).classList.remove("show");
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    if (state === "paused") {
      render(0);
      return;
    }
    if (state === "play") {
      let scale = bot ? bot.speed : 1;
      if (slowT > 0) {
        slowT -= dt;
        scale *= 0.35;
      }
      acc += dt * scale;
      if (acc > 0.25) acc = 0.25;
      while (acc >= STEP && state === "play") {
        step(STEP);
        acc -= STEP;
      }
    }
    animate(dt);
    render(dt);
  }

  function updateHud() {
    el.stage.textContent = String(stageIndex + 1);
    el.score.textContent = fmt(score);
    el.name.textContent = stage.name;
    el.hearts.innerHTML = Array.from({ length: START_HEARTS }, (_, k) => `<i class="${k < hearts ? "" : "off"}">♥</i>`).join("");
    el.hearts.setAttribute("aria-label", `남은 하트 ${hearts}개`);
    const paint = (node, team) => {
      const list = stones.filter((s) => s.team === team);
      node.innerHTML = list.map((s) => `<i class="${s.state === "board" ? "" : "out"}${s.king ? " king" : ""}"></i>`).join("");
    };
    paint(el.aiLeft, "ai");
    paint(el.meLeft, "me");
    const playing = state === "play" && phase !== "end";
    el.teamMe.classList.toggle("active", playing && turn === "me");
    el.teamAi.classList.toggle("active", playing && turn === "ai");
    let tip = "내 알을 뒤로 당겼다 놓으면 탁!";
    if (phase === "aiThink" || phase === "aiAim") tip = "깜장이가 어디로 쏠지 고민하고 있어요";
    else if (phase === "rolling") tip = shot && shot.team === "ai" ? "깜장이가 쐈어요!" : "데구르르…";
    else if (phase === "end") tip = roundResult && roundResult.win ? "깜장이를 모두 떨어뜨렸어요!" : "다시 해 봐요!";
    else if (turn === "me" && stage.guideTarget) tip = "점선이 초록이면 상대 알이 떨어져요!";
    el.tip.textContent = tip;
  }

  /* ---------- 조작: 내 알을 눌러 뒤로 당겼다 놓기 ---------- */
  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }

  function canAim() {
    return state === "play" && phase === "aim" && turn === "me" && !(bot && bot.autoMe);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!canAim()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = canvasPos(e);
    let pickS = null;
    let bd = 44;
    for (const s of stones) {
      if (s.team !== "me" || s.state !== "board") continue;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < bd) {
        bd = d;
        pickS = s;
      }
    }
    if (!pickS) return;
    e.preventDefault();
    SFX.unlock();
    SFX.play("pick");
    aim = { s: pickS, px: p.x, py: p.y, dx: 0, dy: 0 };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!aim) return;
    e.preventDefault();
    const p = canvasPos(e);
    aim.dx = p.x - aim.px;
    aim.dy = p.y - aim.py;
  });
  const release = (e) => {
    if (!aim) return;
    const sh = aimShot();
    const s = aim.s;
    aim = null;
    if (e.type === "pointerup" && sh && canAim()) shoot("me", s, sh.dirx * sh.v, sh.diry * sh.v);
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);
  el.nextBtn.addEventListener("click", nextRound);

  /* ---------- 시작 ---------- */
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * ((rect.width || W) / W)));
    if (Math.abs(scale - pxScale) < 0.01 && canvas.width === Math.round(W * scale)) return;
    pxScale = scale;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    buildStatic();
  }
  window.addEventListener("resize", fitCanvas);

  setupRound();
  msgs = [];
  fitCanvas();
  buildStatic();
  showOverlay("title");
  updateHud();
  requestAnimationFrame(frame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: "alggagi", gameTitle: "알까기", formParent: overlays.over || overlays.all || document.body });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        aim = null;
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        last = performance.now();
        return true;
      },
    });
    const pb = document.getElementById("today-pause-btn");
    if (pb && el.dock) el.dock.insertBefore(pb, el.dock.firstChild);
  }

  // 점검용 (주소에 ?test=1 일 때만)
  if (TEST) {
    window.__alg = {
      bot,
      get state() {
        return state;
      },
      get phase() {
        return phase;
      },
      get stage() {
        return stageIndex;
      },
      get score() {
        return score;
      },
      get hearts() {
        return hearts;
      },
      get turn() {
        return turn;
      },
      myMarble() {
        const s = stones.find((q) => q.team === "me" && q.state === "board");
        return s && { x: s.x, y: s.y, cx: BOARD.x + BOARD.size / 2, cy: BOARD.y + BOARD.size / 2 };
      },
      start(i = 0) {
        stageIndex = i;
        score = 0;
        hearts = START_HEARTS;
        setupRound();
        state = "play";
        showOverlay(null);
        updateHud();
      },
      count: (team) => alive(team),
      list: () => stones.map((s) => ({ x: s.x, y: s.y, team: s.team, state: s.state, king: s.king })),
      roundResult: () => roundResult,
      timePlan(team = "ai") {
        const t0 = performance.now();
        plan(team, stage);
        return performance.now() - t0;
      },
      stageInfo,
    };
  }
})();
