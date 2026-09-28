(() => {
  "use strict";

  const GAME_ID = "bomb-dodge";
  const W = 390;
  const H = 700;
  const GROUND = H - 70; // 땅 높이 (폭탄이 여기서 터지고 사라짐)
  const PLAYER_Y = GROUND - 34;
  const PLAYER_R = 17; // 판정 반지름 (그림보다 살짝 작게 → 억울하지 않게)
  const SPEED = 430; // 키보드 이동 속도 px/s
  const FOLLOW = 620; // 손가락 따라가는 최대 속도 px/s

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const hudTime = $("hud-time");
  const countEl = $("count");

  let state = "title"; // title | count | play | dead | over
  let t = 0; // 생존 시간 (초)
  let last = 0;
  let raf = 0;
  let bombs = [];
  let booms = [];
  let sparks = [];
  let spawnT = 0;
  let patternT = 0;
  let shake = 0;
  let milestone = 10;
  let banner = null;
  const player = { x: W / 2, vx: 0, targetX: null, face: 1 };
  const keys = { left: false, right: false };

  /* ---------- 캔버스 선명하게 ---------- */
  function fit() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener("resize", fit);

  /* ---------- 그림 재료 ---------- */
  const chick = new Image();
  chick.src = "/assets/edu/edu_chick.svg";
  const stars = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * (GROUND - 160), r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 }));
  const city = (() => {
    const out = [];
    let x = -10;
    while (x < W + 10) {
      const w = 26 + Math.random() * 38;
      out.push({ x, w, h: 40 + Math.random() * 90, lit: Math.random() });
      x += w + 2;
    }
    return out;
  })();

  /* ---------- 소리 ---------- */
  let ac = null;
  function tone(freq, dur = 0.08, type = "sine", vol = 0.05, delay = 0, slide = 0) {
    try {
      if (window.TodayAudio && TodayAudio.isMuted && TodayAudio.isMuted()) return;
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const at = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), at + dur);
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(at);
      o.stop(at + dur + 0.02);
    } catch (_) {}
  }

  /* ---------- 화면 ---------- */
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    document.body.classList.toggle("is-play", name === "play");
    document.body.classList.toggle("is-title", name === "title");
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const fmt = (cs) => `${(cs / 100).toFixed(2)}초`;

  /* ---------- 난이도: 시간에 따라 단계별로 ---------- */
  function stage() {
    if (t < 5) return { every: 0.78, vy: [210, 250], r: [16, 16] };
    if (t < 10) return { every: 0.5, vy: [270, 330], r: [15, 17] };
    if (t < 20) return { every: 0.37, vy: [330, 420], r: [12, 25] };
    return { every: Math.max(0.24, 0.34 - (t - 20) * 0.003), vy: [380, 480 + Math.min(120, (t - 20) * 4)], r: [12, 26], patterns: true };
  }

  function addBomb(x, vy, r, delay = 0) {
    bombs.push({ x: Math.max(r + 4, Math.min(W - r - 4, x)), y: -r - 20 - delay * vy, vy, r, spin: rand(-2, 2), a: rand(0, 6) });
  }

  function spawn(dt) {
    const s = stage();
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = s.every * rand(0.8, 1.2);
      // 가끔은 플레이어를 노린다 (가만히 있으면 안 되게)
      const aim = Math.random() < (t < 10 ? 0.25 : 0.4);
      const x = aim ? player.x + rand(-40, 40) : rand(20, W - 20);
      addBomb(x, rand(s.vy[0], s.vy[1]), rand(s.r[0], s.r[1]));
    }
    if (!s.patterns) return;
    // 20초 이후: 패턴 폭탄 (벽·연속·지그재그). 빠져나갈 틈은 항상 남긴다
    patternT -= dt;
    if (patternT > 0) return;
    patternT = rand(1.3, 2.1);
    const vy = rand(s.vy[0], s.vy[1]) * 0.92;
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) {
      const gapW = Math.max(88, 120 - (t - 20) * 1.2);
      const gapX = rand(gapW / 2 + 10, W - gapW / 2 - 10);
      for (let x = 20; x < W; x += 38) if (Math.abs(x - gapX) > gapW / 2) addBomb(x, vy, 15);
    } else if (kind === 1) {
      const x = player.x;
      for (let i = 0; i < 3; i++) addBomb(x + rand(-10, 10), vy, 16, i * 0.16);
    } else {
      const left = Math.random() < 0.5;
      for (let i = 0; i < 6; i++) addBomb(left ? 30 + i * 60 : W - 30 - i * 60, vy, 14, i * 0.09);
    }
  }

  /* ---------- 진행 ---------- */
  function reset() {
    t = 0;
    bombs = [];
    booms = [];
    sparks = [];
    spawnT = 0.9;
    patternT = 1.5;
    shake = 0;
    milestone = 10;
    banner = null;
    player.x = W / 2;
    player.vx = 0;
    player.targetX = null;
    hudTime.textContent = "0.00";
  }

  function startCountdown() {
    reset();
    show("play");
    state = "count";
    const best = rc.summary().best;
    $("hud-best").textContent = best != null ? `내 최고 ${fmt(best)}` : "";
    const steps = ["3", "2", "1", "GO!"];
    steps.forEach((s, i) => {
      window.setTimeout(() => {
        if (state !== "count") return;
        countEl.textContent = s;
        countEl.classList.remove("pop");
        void countEl.offsetWidth;
        countEl.classList.add("pop");
        tone(i < 3 ? 520 : 880, i < 3 ? 0.08 : 0.16, "square", 0.04);
        if (i === steps.length - 1) {
          state = "play";
          window.setTimeout(() => {
            if (countEl.textContent === "GO!") countEl.textContent = "";
          }, 380);
        }
      }, i * 330);
    });
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function die(b) {
    state = "dead";
    shake = 0.35;
    tone(140, 0.45, "sawtooth", 0.07, 0, 0.3);
    tone(70, 0.5, "square", 0.05, 0.02, 0.5);
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(80, 320);
      sparks.push({ x: player.x, y: PLAYER_Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rand(0.4, 0.8), c: Math.random() < 0.5 ? "#ffd23f" : "#ff7a1a" });
    }
    booms.push({ x: b.x, y: b.y, r: 10, life: 0.5 });
    window.setTimeout(finish, 750);
  }

  function update(dt) {
    if (state === "play") {
      t += dt;
      spawn(dt);
      // 이동: 키보드 우선, 없으면 손가락 따라가기
      let vx = 0;
      if (keys.left) vx -= SPEED;
      if (keys.right) vx += SPEED;
      if (!vx && player.targetX != null) {
        const d = player.targetX - player.x;
        vx = Math.max(-FOLLOW, Math.min(FOLLOW, d * 14));
        if (Math.abs(d) < 1) vx = 0;
      }
      player.vx = vx;
      player.x = Math.max(22, Math.min(W - 22, player.x + vx * dt));
      if (vx) player.face = vx < 0 ? -1 : 1;
      if (t >= milestone) {
        banner = { text: `${milestone}초 돌파!`, life: 1.1 };
        tone(988, 0.1, "triangle", 0.05);
        tone(1318, 0.14, "triangle", 0.05, 0.08);
        milestone += 10;
      }
      hudTime.textContent = t.toFixed(2);
    }
    for (const b of bombs) {
      b.y += b.vy * dt;
      b.a += b.spin * dt;
      if (state === "play" && Math.hypot(b.x - player.x, b.y - PLAYER_Y) < b.r * 0.86 + PLAYER_R) {
        die(b);
        break;
      }
    }
    bombs = bombs.filter((b) => {
      if (b.y + b.r < GROUND) return true;
      booms.push({ x: b.x, y: GROUND, r: 6, life: 0.3 });
      return false;
    });
    booms.forEach((o) => {
      o.life -= dt;
      o.r += 120 * dt;
    });
    booms = booms.filter((o) => o.life > 0);
    sparks.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.life -= dt;
    });
    sparks = sparks.filter((p) => p.life > 0);
    if (shake > 0) shake -= dt;
    if (banner) {
      banner.life -= dt;
      if (banner.life <= 0) banner = null;
    }
  }

  /* ---------- 그리기 ---------- */
  function drawBg(now) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#120a2a");
    g.addColorStop(0.7, "#2c1656");
    g.addColorStop(1, "#4d1f4f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 700 + s.p);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of city) {
      ctx.fillStyle = "#1b0f33";
      ctx.fillRect(b.x, GROUND - b.h, b.w, b.h);
      if (b.lit > 0.5) {
        ctx.fillStyle = "rgba(255,210,63,.35)";
        for (let y = GROUND - b.h + 10; y < GROUND - 10; y += 16) for (let x = b.x + 6; x < b.x + b.w - 8; x += 12) if ((x * 7 + y) % 5 < 2) ctx.fillRect(x, y, 4, 6);
      }
    }
    ctx.fillStyle = "#2a1330";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#ff7a1a";
    ctx.fillRect(0, GROUND, W, 3);
  }

  function drawBomb(b, now) {
    // 떨어질 자리 경고 표시 (가까워질수록 진하게)
    const near = 1 - Math.min(1, (GROUND - b.y) / 420);
    if (near > 0) {
      ctx.fillStyle = `rgba(255,80,80,${0.12 + near * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(b.x, GROUND + 2, b.r * (0.8 + near * 0.6), 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    const g = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.35, b.r * 0.1, 0, 0, b.r);
    g.addColorStop(0, "#7a7a8e");
    g.addColorStop(0.55, "#26262f");
    g.addColorStop(1, "#0b0b10");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a48";
    ctx.fillRect(-b.r * 0.28, -b.r - 5, b.r * 0.56, 7);
    ctx.strokeStyle = "#c9a26b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -b.r - 5);
    ctx.quadraticCurveTo(b.r * 0.4, -b.r - 12, b.r * 0.2, -b.r - 16);
    ctx.stroke();
    const fl = 3 + Math.sin(now / 40 + b.x) * 1.5;
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(b.r * 0.2, -b.r - 16, fl, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(b.r * 0.2, -b.r - 16, fl * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(now) {
    const bob = state === "play" && player.vx ? Math.sin(now / 60) * 2 : 0;
    const x = player.x;
    const y = PLAYER_Y + bob;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(x, GROUND + 1, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // edu_chick.svg 는 200x200 중 몸통이 (100,130) 반지름 42 → 몸통 중심을 판정 원에 맞춘다
    const s = 104;
    const ox = -s / 2;
    const oy = -s * 0.65;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(player.face, 1);
    ctx.rotate((player.vx / SPEED) * 0.12);
    if (chick.complete && chick.naturalWidth) ctx.drawImage(chick, ox, oy, s, s);
    else {
      ctx.fillStyle = "#ffd84c";
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    // 안전모 (머리 위에 딱 붙게)
    const hy = oy + s * 0.5;
    ctx.fillStyle = "#ff7a1a";
    ctx.beginPath();
    ctx.arc(0, hy, s * 0.17, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-s * 0.21, hy - 1, s * 0.42, 5);
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.fillRect(-s * 0.03, hy - s * 0.16, s * 0.06, s * 0.12);
    if (window.TodayFace) TodayFace.drawOnSprite(ctx, ox, oy, s, s, [0.5, 0.62, 0.17]);
    ctx.restore();
  }

  function draw(now) {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-7, 7) * shake * 2, rand(-7, 7) * shake * 2);
    drawBg(now);
    for (const b of bombs) drawBomb(b, now);
    if (state !== "dead" && state !== "over") drawPlayer(now);
    for (const o of booms) {
      ctx.globalAlpha = Math.max(0, o.life * 2);
      ctx.fillStyle = "#ffb13d";
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of sparks) {
      ctx.globalAlpha = Math.max(0, p.life * 1.6);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    if (banner) {
      ctx.globalAlpha = Math.min(1, banner.life * 2);
      ctx.font = '30px "Bagel Fat One", "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd23f";
      ctx.fillText(banner.text, W / 2, 170 - (1.1 - banner.life) * 30);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function loop(now) {
    // 탭을 떠났다 오면 시간이 한 번에 튀지 않게 (최대 0.05초씩만)
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    draw(now);
    if (state === "over") return;
    raf = requestAnimationFrame(loop);
  }

  /* ---------- 결과 ---------- */
  function finish() {
    state = "over";
    const cs = Math.floor(t * 100);
    $("result-time").textContent = (cs / 100).toFixed(2);
    const qs = ["몇 초까지 버틸 수 있을까요?", "다음 판엔 몇 초?", "10초만 더 버티면 영웅!"];
    $("result-q").textContent = t < 8 ? "시작이 반! 몇 초까지 버틸 수 있을까요?" : qs[Math.floor(Math.random() * qs.length)];
    $("boom-badge").textContent = t >= 30 ? "LEGEND!" : t >= 20 ? "대단해요!" : "BOOM!";
    show("over");
    window.scrollTo(0, 0);
    const res = rc.finish(cs, { label: fmt(cs) });
    $("newbest").classList.toggle("hidden", !(res.newBest && res.prevBest != null));
  }

  const rc = window.TodayRecord.init({
    gameId: GAME_ID,
    gameTitle: "폭탄 피하기",
    lowerIsBetter: false,
    format: fmt,
    gap: (better, mine) => fmt(Math.max(1, better - mine)),
    panel: $("record-panel"),
    share: (cs) => `${(cs / 100).toFixed(2)}초 버텼습니다. 당신은 몇 초? (Today Game 폭탄 피하기)`,
    onRetry: () => {
      window.scrollTo(0, 0);
      startCountdown();
    },
  });

  async function paintTitle() {
    const el = $("title-stat");
    const mine = rc.summary();
    const board = await rc.refresh();
    const parts = [];
    if (board && board.length) parts.push(`오늘 1위 <b>${fmt(Number(board[0].score))}</b>`);
    if (mine.best != null) parts.push(`내 최고 <b>${fmt(mine.best)}</b>`);
    el.innerHTML = parts.length ? parts.join(" · ") : "오늘 첫 기록의 주인공이 되어 보세요";
  }

  /* ---------- 입력 ---------- */
  function toGameX(clientX) {
    const r = canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  }
  const playEl = screens.play;
  playEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    player.targetX = toGameX(e.clientX);
    try {
      playEl.setPointerCapture(e.pointerId);
    } catch (_) {}
  });
  playEl.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" && !(e.buttons & 1)) return;
    player.targetX = toGameX(e.clientX);
  });
  const release = () => {
    player.targetX = null;
  };
  playEl.addEventListener("pointerup", release);
  playEl.addEventListener("pointercancel", release);

  const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  window.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = KEYMAP[e.code];
    if (k) {
      e.preventDefault();
      keys[k] = true;
      player.targetX = null;
      return;
    }
    if ((e.code === "Space" || e.code === "Enter") && !e.repeat && document.body.classList.contains("is-title")) {
      e.preventDefault();
      startCountdown();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });
  window.addEventListener("blur", () => {
    keys.left = keys.right = false;
  });

  $("start-btn").addEventListener("click", startCountdown);

  show("title");
  draw(performance.now());
  paintTitle();
})();
