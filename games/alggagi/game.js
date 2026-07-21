(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BOARD = { cx: W / 2, cy: 368, r: 158 };
  const MARBLE_R = 14;
  const FRICTION = 0.988;
  const REST = 0.82;
  const STOP = 0.08;
  const MAX_POWER = 16;
  const TOTAL_STAGES = 50;

  const NAME_POOL = [
    "따뜻한 연습", "바람 좋은 날", "모래 운동장", "실력자 대결", "알까기 고수",
    "햇살 코트", "먼지 한 줌", "딱밤 한 방", "맞추면 기분 좋아", "굴러가는 오후",
    "운동장 챔프", "한판 더", "긴장되는 구슬", "살살 vs 세게", "각도의 미학",
    "틈새 공략", "몰아치기", "흩어진 전장", "뭉친 적진", "원거리 승부",
    "순간의 선택", "침착한 손", "바람 읽기", "모래 위 궤적", "마지막 한 알",
    "정밀 타격", "연쇄 반응", "빈틈 노리기", "수비 전환", "공격 본능",
    "고수 입문", "달인 코스", "전설의 한 방", "흔들림 금지", "집중 모드",
    "도전 정신", "승부사 기질", "쿨한 한 수", "운도 실력", "완벽한 각도",
    "마스터 레인", "챔피언 코트", "알까기 왕국", "구슬의 춤", "끝판왕 연습",
    "전설 입문", "무적의 손맛", "최종 시험", "알까기 레전드", "영원한 운동장",
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => {
    const t = i / Math.max(1, TOTAL_STAGES - 1);
    return {
      name: NAME_POOL[i] || `알까기 ${i + 1}`,
      aiPower: 0.48 + t * 0.62,
      aiAccuracy: 0.26 + t * 0.66,
      enemyCount: 3 + Math.min(2, Math.floor(i / 12)),
      playerCount: 3 + Math.min(2, Math.floor(i / 14)),
    };
  });

  const LAYOUT_MODES = ["spread", "clusters", "sides", "mix", "ring", "scatterPack"];

  const PLAYER_COLORS = ["#4da6ff", "#3d8ef0", "#6bb8ff"];
  const ENEMY_COLORS = ["#ff6b6b", "#ff5252", "#ff8585", "#e84545", "#ff7070"];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sprites = {
    blue: null,
    red: null,
    board: null,
    sand: null,
    mascots: [null, null, null, null],
  };

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    // chroma magenta #FF00FF
    if (r > 185 && b > 175 && g < 145 && r + b > g * 2.1) return true;
    if (r > 210 && b > 200 && g < 160 && Math.abs(r - b) < 90) return true;
    if (r > 230 && b > 220 && g < 180 && Math.abs(r - b) < 50) return true;
    // soft studio washes
    if (r > 210 && g > 185 && b > 165 && Math.abs(r - g) < 55 && g >= b - 15) return true;
    if (r > 230 && g > 210 && b > 195 && r - b < 50) return true;
    return false;
  }

  function punchBg(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    let minX = c.width;
    let minY = c.height;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        d[i + 3] = 0;
        continue;
      }
      const px = (i / 4) % c.width;
      const py = ((i / 4) / c.width) | 0;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    x.putImageData(data, 0, 0);
    if (maxX <= minX || maxY <= minY) return c;
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(c.width - 1, maxX + pad);
    maxY = Math.min(c.height - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d").drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  /** Crop 2x2 mascot sheet into four sprites */
  function splitMascots(sheet) {
    const w = sheet.width || sheet.naturalWidth;
    const h = sheet.height || sheet.naturalHeight;
    const hw = (w / 2) | 0;
    const hh = (h / 2) | 0;
    const cells = [
      [0, 0],
      [hw, 0],
      [0, hh],
      [hw, hh],
    ];
    return cells.map(([sx, sy]) => {
      const c = document.createElement("canvas");
      c.width = hw;
      c.height = hh;
      c.getContext("2d").drawImage(sheet, sx, sy, hw, hh, 0, 0, hw, hh);
      return punchBg(c);
    });
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [blue, red, board, sand, mascots] = await Promise.all([
      loadImg("assets/marble-blue.png"),
      loadImg("assets/marble-red.png"),
      loadImg("assets/board.png"),
      loadImg("assets/sand-bg.png"),
      loadImg("assets/mascots.png"),
    ]);
    if (blue) sprites.blue = punchBg(blue);
    if (red) sprites.red = punchBg(red);
    if (board) sprites.board = punchBg(board);
    if (sand) sprites.sand = sand;
    if (mascots) sprites.mascots = splitMascots(mascots);
  }

  const overlays = {
    title: document.getElementById("title"),
    round: document.getElementById("round"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  let state = "title";
  let stageIndex = 0;
  let roundWins = 0;
  let score = 0;
  let runStartedAt = 0;
  let stageStartedAt = 0;
  let marbles = [];
  let turn = "player";
  let simulating = false;
  let aim = null;
  let message = "";
  let msgT = 0;
  let aiTimer = 0;
  let last = 0;
  let raf = 0;

  function show(el, on) {
    el.classList.toggle("hidden", !on);
  }

  function hideAll() {
    Object.values(overlays).forEach((o) => show(o, false));
  }

  function alive(team) {
    return marbles.filter((m) => m.alive && m.team === team);
  }

  function updateHud() {
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-wins").textContent = String(roundWins);
    document.getElementById("hud-mine").textContent = String(alive("player").length);
    document.getElementById("hud-enemy").textContent = String(alive("enemy").length);
    document.getElementById("hud-turn").textContent =
      state !== "play" ? "준비" : simulating ? "구슬 이동 중" : turn === "player" ? "내 차례" : "상대 차례";
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function boardPoint(ang, distFrac) {
    const maxR = BOARD.r - MARBLE_R - 10;
    const d = maxR * distFrac;
    return {
      x: BOARD.cx + Math.cos(ang) * d,
      y: BOARD.cy + Math.sin(ang) * d,
    };
  }

  function canPlaceAt(x, y, placed, minSep) {
    if (Math.hypot(x - BOARD.cx, y - BOARD.cy) > BOARD.r - MARBLE_R - 8) return false;
    for (const p of placed) {
      if (Math.hypot(p.x - x, p.y - y) < minSep) return false;
    }
    return true;
  }

  function pushMarble(x, y, team, colorIdx, placed) {
    placed.push({ x, y });
    marbles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      r: MARBLE_R,
      team,
      color: team === "player"
        ? PLAYER_COLORS[colorIdx % PLAYER_COLORS.length]
        : ENEMY_COLORS[colorIdx % ENEMY_COLORS.length],
      alive: true,
      rot: Math.random() * Math.PI,
    });
  }

  /** 겹치지 않게 랜덤 위치 시도 */
  function placeRandom(team, count, placed, opts = {}) {
    const {
      angMin = 0,
      angMax = Math.PI * 2,
      distMin = 0.18,
      distMax = 0.92,
      minSep = MARBLE_R * 2.2,
      around = null,
      aroundR = 0.18,
    } = opts;
    let placedN = 0;
    for (let attempt = 0; attempt < count * 80 && placedN < count; attempt += 1) {
      let x;
      let y;
      if (around) {
        const a = Math.random() * Math.PI * 2;
        const d = rand(0.04, aroundR) * (BOARD.r - MARBLE_R - 10);
        x = around.x + Math.cos(a) * d;
        y = around.y + Math.sin(a) * d;
      } else {
        const ang = rand(angMin, angMax);
        const distFrac = rand(distMin, distMax);
        const p = boardPoint(ang, distFrac);
        x = p.x;
        y = p.y;
      }
      if (!canPlaceAt(x, y, placed, minSep)) continue;
      pushMarble(x, y, team, placedN, placed);
      placedN += 1;
    }
    // fallback: spiral outward if still short
    let ang = rand(0, Math.PI * 2);
    let distFrac = 0.35;
    while (placedN < count) {
      const p = boardPoint(ang, Math.min(0.9, distFrac));
      if (canPlaceAt(p.x, p.y, placed, minSep * 0.92)) {
        pushMarble(p.x, p.y, team, placedN, placed);
        placedN += 1;
      }
      ang += 0.9;
      distFrac += 0.05;
      if (distFrac > 0.95) distFrac = 0.25;
    }
  }

  function placeMarbles() {
    marbles = [];
    const st = STAGES[stageIndex];
    const pc = st.playerCount;
    const ec = st.enemyCount;
    const placed = [];
    const mode = pick(LAYOUT_MODES);

    if (mode === "spread") {
      // 전체 보드에 넓게 흩어짐
      placeRandom("player", pc, placed, { distMin: 0.28, distMax: 0.95, minSep: MARBLE_R * 2.6 });
      placeRandom("enemy", ec, placed, { distMin: 0.28, distMax: 0.95, minSep: MARBLE_R * 2.6 });
    } else if (mode === "clusters") {
      // 2~3개 뭉치로 모이되, 뭉치끼리 떨어짐
      const clusters = 2 + ((Math.random() * 2) | 0);
      const centers = [];
      for (let c = 0; c < clusters; c += 1) {
        let center = null;
        for (let t = 0; t < 40; t += 1) {
          const cand = boardPoint(rand(0, Math.PI * 2), rand(0.35, 0.75));
          if (centers.every((o) => Math.hypot(o.x - cand.x, o.y - cand.y) > MARBLE_R * 5.5)) {
            center = cand;
            break;
          }
        }
        centers.push(center || boardPoint((c / clusters) * Math.PI * 2, 0.55));
      }
      const assign = [];
      for (let i = 0; i < pc; i += 1) assign.push({ team: "player", i });
      for (let i = 0; i < ec; i += 1) assign.push({ team: "enemy", i });
      assign.forEach((item, idx) => {
        const center = centers[idx % centers.length];
        placeRandom(item.team, 1, placed, {
          around: center,
          aroundR: 0.16 + Math.random() * 0.08,
          minSep: MARBLE_R * 2.15,
        });
      });
    } else if (mode === "sides") {
      // 위·아래 진영이지만 각자 넓게 퍼짐 (예전처럼 한곳에 몰리지 않음)
      placeRandom("player", pc, placed, {
        angMin: Math.PI * 0.15,
        angMax: Math.PI * 0.85,
        distMin: 0.35,
        distMax: 0.92,
        minSep: MARBLE_R * 2.4,
      });
      placeRandom("enemy", ec, placed, {
        angMin: -Math.PI * 0.85,
        angMax: -Math.PI * 0.15,
        distMin: 0.35,
        distMax: 0.92,
        minSep: MARBLE_R * 2.4,
      });
    } else if (mode === "mix") {
      // 일부는 뭉치고 일부는 흩어짐
      const pCluster = Math.max(1, Math.floor(pc / 2));
      const eCluster = Math.max(1, Math.floor(ec / 2));
      const pCenter = boardPoint(rand(0.3, 0.9) * Math.PI, rand(0.45, 0.7));
      const eCenter = boardPoint(rand(-0.9, -0.3) * Math.PI, rand(0.45, 0.7));
      placeRandom("player", pCluster, placed, { around: pCenter, aroundR: 0.14, minSep: MARBLE_R * 2.15 });
      placeRandom("enemy", eCluster, placed, { around: eCenter, aroundR: 0.14, minSep: MARBLE_R * 2.15 });
      placeRandom("player", pc - pCluster, placed, { distMin: 0.4, distMax: 0.95, minSep: MARBLE_R * 2.5 });
      placeRandom("enemy", ec - eCluster, placed, { distMin: 0.4, distMax: 0.95, minSep: MARBLE_R * 2.5 });
    } else if (mode === "ring") {
      // 원형으로 돌리되 간격·반지름에 랜덤
      const total = pc + ec;
      const baseAng = Math.random() * Math.PI * 2;
      const teams = [];
      for (let i = 0; i < pc; i += 1) teams.push("player");
      for (let i = 0; i < ec; i += 1) teams.push("enemy");
      // shuffle
      for (let i = teams.length - 1; i > 0; i -= 1) {
        const j = (Math.random() * (i + 1)) | 0;
        [teams[i], teams[j]] = [teams[j], teams[i]];
      }
      let pi = 0;
      let ei = 0;
      teams.forEach((team, i) => {
        const ang = baseAng + (i / total) * Math.PI * 2 + rand(-0.12, 0.12);
        const distFrac = rand(0.48, 0.88);
        const p = boardPoint(ang, distFrac);
        if (canPlaceAt(p.x, p.y, placed, MARBLE_R * 2.15)) {
          const colorIdx = team === "player" ? pi++ : ei++;
          pushMarble(p.x, p.y, team, colorIdx, placed);
        } else {
          placeRandom(team, 1, placed, { distMin: 0.4, distMax: 0.9 });
          if (team === "player") pi += 1;
          else ei += 1;
        }
      });
    } else {
      // scatterPack: 한쪽은 넓게, 한쪽은 뭉침
      const playerPacked = Math.random() < 0.5;
      if (playerPacked) {
        const center = boardPoint(rand(0.2, 0.8) * Math.PI, rand(0.4, 0.65));
        placeRandom("player", pc, placed, { around: center, aroundR: 0.2, minSep: MARBLE_R * 2.15 });
        placeRandom("enemy", ec, placed, { distMin: 0.3, distMax: 0.95, minSep: MARBLE_R * 2.55 });
      } else {
        const center = boardPoint(rand(-0.8, -0.2) * Math.PI, rand(0.4, 0.65));
        placeRandom("enemy", ec, placed, { around: center, aroundR: 0.2, minSep: MARBLE_R * 2.15 });
        placeRandom("player", pc, placed, { distMin: 0.3, distMax: 0.95, minSep: MARBLE_R * 2.55 });
      }
    }

    turn = "player";
    simulating = false;
    aim = null;
    message = mode === "clusters" || mode === "mix" || mode === "scatterPack"
      ? "배치가 랜덤이에요!"
      : "당겨서 조준!";
    msgT = 1.2;
    updateHud();
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function resolveCollision(a, b) {
    const d = dist(a, b);
    const minD = a.r + b.r;
    if (d >= minD || d < 0.001) return;
    const nx = (b.x - a.x) / d;
    const ny = (b.y - a.y) / d;
    const overlap = minD - d;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dn = dvx * nx + dvy * ny;
    if (dn > 0) {
      const imp = dn * REST;
      a.vx -= imp * nx;
      a.vy -= imp * ny;
      b.vx += imp * nx;
      b.vy += imp * ny;
    }
  }

  function checkOffBoard() {
    marbles.forEach((m) => {
      if (!m.alive) return;
      if (Math.hypot(m.x - BOARD.cx, m.y - BOARD.cy) > BOARD.r - m.r * 0.35) {
        m.alive = false;
        m.vx = 0;
        m.vy = 0;
      }
    });
  }

  function allStopped() {
    return marbles.every((m) => !m.alive || Math.hypot(m.vx, m.vy) < STOP);
  }

  function endTurnCheck() {
    const p = alive("player").length;
    const e = alive("enemy").length;
    updateHud();
    if (p === 0) {
      state = "over";
      hideAll();
      show(overlays.over, true);
      document.getElementById("over-detail").textContent = `${STAGES[stageIndex].name} · 내 구슬이 모두 떨어졌어요 · 점수 ${score}`;
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "alggagi", gameTitle: "알까기", formParent: overlays.over });
      TodayGameRank.open(score);
    }
      return;
    }
    if (e === 0) {
      roundWins += 1;
      const elapsed = (performance.now() - stageStartedAt) / 1000;
      score += 100 + Math.max(0, Math.floor(20 - elapsed)) * 8;
      if (stageIndex >= TOTAL_STAGES - 1) {
        state = "allclear";
        hideAll();
        show(overlays.all, true);
        document.getElementById("all-detail").textContent = `${TOTAL_STAGES}단계 모두 정복! 총 ${roundWins}승 · 점수 ${score}`;
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "alggagi", gameTitle: "알까기", formParent: overlays.all });
      TodayGameRank.open(score);
    }
        return;
      }
      state = "roundwin";
      hideAll();
      show(overlays.round, true);
      document.getElementById("round-badge").textContent = "ROUND WIN";
      document.getElementById("round-title").textContent = "라운드 승리!";
      document.getElementById("round-detail").textContent = `${STAGES[stageIndex].name} 클리어 · 다음 AI가 더 강해져요 · 점수 ${score}`;
      return;
    }
    turn = turn === "player" ? "enemy" : "player";
    message = turn === "player" ? "내 차례!" : "상대 차례…";
    msgT = 1.2;
    updateHud();
    if (turn === "enemy") aiTimer = 0.7;
  }

  function shootMarble(m, dx, dy, powerMul) {
    const len = Math.hypot(dx, dy) || 1;
    const power = Math.min(MAX_POWER, (len / 100) * MAX_POWER) * powerMul;
    m.vx = (dx / len) * power;
    m.vy = (dy / len) * power;
    simulating = true;
    aim = null;
  }

  function aiTurn() {
    const st = STAGES[stageIndex];
    const mine = alive("enemy");
    const theirs = alive("player");
    if (!mine.length || !theirs.length) return;
    const shooter = mine[Math.floor(Math.random() * mine.length)];
    let target = theirs[0];
    let best = Infinity;
    theirs.forEach((t) => {
      const d = dist(shooter, t);
      if (d < best) {
        best = d;
        target = t;
      }
    });
    const spread = (1 - st.aiAccuracy) * 0.55;
    const ang =
      Math.atan2(target.y - shooter.y, target.x - shooter.x) + (Math.random() - 0.5) * spread;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    shootMarble(shooter, dx * 80, dy * 80, st.aiPower);
    message = "쾅!";
    msgT = 0.5;
  }

  function simulate(dt) {
    if (!simulating) return;
    const sub = 3;
    const step = dt / sub;
    for (let s = 0; s < sub; s += 1) {
      marbles.forEach((m) => {
        if (!m.alive) return;
        m.x += m.vx * step * 60;
        m.y += m.vy * step * 60;
        m.vx *= FRICTION;
        m.vy *= FRICTION;
        m.rot = (m.rot || 0) + Math.hypot(m.vx, m.vy) * step * 4;
      });
      for (let i = 0; i < marbles.length; i += 1) {
        for (let j = i + 1; j < marbles.length; j += 1) {
          if (marbles[i].alive && marbles[j].alive) resolveCollision(marbles[i], marbles[j]);
        }
      }
      checkOffBoard();
    }
    if (allStopped()) {
      simulating = false;
      endTurnCheck();
    }
  }

  function drawFallbackBoard() {
    ctx.fillStyle = "#e8c896";
    ctx.beginPath();
    ctx.arc(BOARD.cx, BOARD.cy, BOARD.r + 14, 0, Math.PI * 2);
    ctx.fill();

    const ring = ctx.createRadialGradient(
      BOARD.cx - 30,
      BOARD.cy - 40,
      20,
      BOARD.cx,
      BOARD.cy,
      BOARD.r
    );
    ring.addColorStop(0, "#f3d7a8");
    ring.addColorStop(0.55, "#e8c08a");
    ring.addColorStop(1, "#d4a66a");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(BOARD.cx, BOARD.cy, BOARD.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(139, 90, 43, 0.28)";
    ctx.lineWidth = 2;
    [0.28, 0.52, 0.76, 0.96].forEach((f) => {
      ctx.beginPath();
      ctx.arc(BOARD.cx, BOARD.cy, BOARD.r * f, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawMascots() {
    const size = 72;
    const pad = 10;
    const positions = [
      { x: pad, y: 78 },
      { x: W - pad - size, y: 78 },
      { x: pad, y: H - pad - size - 36 },
      { x: W - pad - size, y: H - pad - size - 36 },
    ];
    positions.forEach((p, i) => {
      const spr = sprites.mascots[i];
      if (!spr) return;
      const sw = spr.width || spr.naturalWidth || 1;
      const sh = spr.height || spr.naturalHeight || 1;
      const scale = Math.min(size / sw, size / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      ctx.drawImage(spr, p.x + (size - dw) / 2, p.y + (size - dh) / 2, dw, dh);
    });
  }

  function drawBackground() {
    if (sprites.sand) {
      ctx.drawImage(sprites.sand, 0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#f0d9b0");
      g.addColorStop(0.5, "#e8c896");
      g.addColorStop(1, "#dcb87a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // soft vignette so HUD / overlays read cleanly
    const vig = ctx.createRadialGradient(BOARD.cx, BOARD.cy, BOARD.r * 0.4, BOARD.cx, BOARD.cy, H * 0.72);
    vig.addColorStop(0, "rgba(255,236,200,0)");
    vig.addColorStop(1, "rgba(180,130,70,0.18)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (sprites.board) {
      const br = BOARD.r + 22;
      const size = br * 2;
      ctx.drawImage(sprites.board, BOARD.cx - br, BOARD.cy - br, size, size);
    } else {
      drawFallbackBoard();
    }

    drawMascots();
  }

  function drawMarbleFallback(m) {
    const grad = ctx.createRadialGradient(
      m.x - m.r * 0.35,
      m.y - m.r * 0.4,
      m.r * 0.08,
      m.x,
      m.y,
      m.r
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.22, m.color);
    grad.addColorStop(0.75, shade(m.color, -18));
    grad.addColorStop(1, shade(m.color, -55));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot || 0);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, m.r * 0.45, 0.2, Math.PI * 1.1);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.ellipse(m.x - m.r * 0.3, m.y - m.r * 0.35, m.r * 0.26, m.r * 0.15, -0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMarble(m) {
    if (!m.alive) return;
    // soft contact shadow (sprites may include baked shadow — clip body only)
    ctx.fillStyle = "rgba(90, 55, 25, 0.28)";
    ctx.beginPath();
    ctx.ellipse(m.x + 1.5, m.y + m.r * 0.78, m.r * 0.82, m.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    const spr = m.team === "player" ? sprites.blue : sprites.red;
    if (spr) {
      const size = m.r * 2.15;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot || 0);
      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, Math.PI * 2);
      ctx.clip();
      // crop baked floor shadow by focusing on upper body of sprite
      const sw = spr.width || spr.naturalWidth || 1;
      const sh = spr.height || spr.naturalHeight || 1;
      const crop = Math.min(sw, sh) * 0.82;
      const sx = (sw - crop) / 2;
      const sy = (sh - crop) / 2 - sh * 0.04;
      ctx.drawImage(spr, sx, sy, crop, crop, -size / 2, -size / 2, size, size);
      ctx.restore();

      // glass rim glint
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r - 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      drawMarbleFallback(m);
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawAim() {
    if (!aim) return;
    // pull-back slingshot: finger is behind, shot goes opposite
    const pullX = aim.dx;
    const pullY = aim.dy;
    const len = Math.hypot(pullX, pullY);
    const power = Math.min(1, len / 100);
    const shotX = -pullX;
    const shotY = -pullY;

    // rubber band to finger (pull)
    ctx.strokeStyle = "rgba(90, 60, 40, 0.45)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(aim.x, aim.y);
    ctx.lineTo(aim.x + pullX, aim.y + pullY);
    ctx.stroke();
    ctx.fillStyle = "rgba(90, 60, 40, 0.5)";
    ctx.beginPath();
    ctx.arc(aim.x + pullX, aim.y + pullY, 6, 0, Math.PI * 2);
    ctx.fill();

    // shot direction arrow (opposite of pull)
    if (len > 8) {
      const ax = aim.x + (shotX / len) * (28 + power * 50);
      const ay = aim.y + (shotY / len) * (28 + power * 50);
      ctx.strokeStyle = `rgba(62, 140, 220,${0.55 + power * 0.4})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(aim.x, aim.y);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      // arrow head
      const ang = Math.atan2(shotY, shotX);
      ctx.fillStyle = `rgba(62, 140, 220,${0.7 + power * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - Math.cos(ang - 0.4) * 12, ay - Math.sin(ang - 0.4) * 12);
      ctx.lineTo(ax - Math.cos(ang + 0.4) * 12, ay - Math.sin(ang + 0.4) * 12);
      ctx.closePath();
      ctx.fill();
    }

    // power meter
    ctx.fillStyle = `rgba(255,180,60,${0.25 + power * 0.55})`;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y - aim.marble.r - 16, 5 + power * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a3820";
    ctx.font = "12px Jua";
    ctx.textAlign = "center";
    ctx.fillText(power < 0.2 ? "살짝" : power < 0.55 ? "보통" : "세게!", aim.x, aim.y - aim.marble.r - 30);
  }

  function drawMessage() {
    if (msgT <= 0 || !message) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, msgT);
    ctx.font = '22px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(74,48,28,0.85)";
    ctx.fillText(message, W / 2, 620);
    ctx.restore();
  }

  function render() {
    drawBackground();
    marbles.forEach(drawMarble);
    drawAim();
    drawMessage();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (state === "play") {
      if (msgT > 0) msgT -= dt;
      if (turn === "enemy" && !simulating && aiTimer > 0) {
        aiTimer -= dt;
        if (aiTimer <= 0) aiTurn();
      }
      simulate(dt);
    }
    render();
    raf = requestAnimationFrame(loop);
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = W / rect.width;
    const sy = H / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }

  function pickMarble(x, y, team) {
    for (let i = marbles.length - 1; i >= 0; i -= 1) {
      const m = marbles[i];
      if (!m.alive || m.team !== team) continue;
      if (Math.hypot(x - m.x, y - m.y) <= m.r + 6) return m;
    }
    return null;
  }

  function onDown(e) {
    if (state !== "play" || simulating || turn !== "player") return;
    e.preventDefault();
    const p = canvasPos(e);
    const m = pickMarble(p.x, p.y, "player");
    if (!m) return;
    aim = { marble: m, x: m.x, y: m.y, dx: 0, dy: 0, team: "player" };
  }

  function onMove(e) {
    if (!aim) return;
    e.preventDefault();
    const p = canvasPos(e);
    aim.dx = p.x - aim.x;
    aim.dy = p.y - aim.y;
  }

  function onUp(e) {
    if (!aim) return;
    e.preventDefault();
    const len = Math.hypot(aim.dx, aim.dy);
    if (len > 12) shootMarble(aim.marble, -aim.dx, -aim.dy, 1);
    aim = null;
  }

  function startGame() {
    stageIndex = 0;
    roundWins = 0;
    score = 0;
    runStartedAt = performance.now();
    stageStartedAt = performance.now();
    if (window.TodayGameRank) TodayGameRank.reset();
    state = "play";
    hideAll();
    placeMarbles();
    if (!message) {
      message = "당겨서 조준!";
      msgT = 1.5;
    }
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", () => {
    stageIndex += 1;
    stageStartedAt = performance.now();
    state = "play";
    hideAll();
    placeMarbles();
    message = `${STAGES[stageIndex].name} 시작!`;
    msgT = 1.4;
  });

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  updateHud();
  loadAssets().then(() => {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "alggagi",
      gameTitle: "알까기",
      formParent: overlays.over || overlays.all || document.body,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        if (typeof last !== "undefined") last = performance.now();
        return true;
      },
    });
  }

})();
