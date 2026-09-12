(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const TOTAL = 10;
  const HOME = { x: 196, y: 548 };
  const MOUND = { x: 196, y: 268 };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const raw = { batter: new Image(), swing: new Image(), pitcher: new Image() };
  raw.batter.src = "assets/batter.png";
  raw.swing.src = "assets/batter-swing.png";
  raw.pitcher.src = "assets/pitcher.png";
  const spr = { batter: null, swing: null, pitcher: null };

  const ui = {
    title: document.getElementById("title"),
    result: document.getElementById("round-result"),
    over: document.getElementById("game-over"),
    coach: document.getElementById("coach"),
    pitch: document.getElementById("hud-pitch"),
    bases: document.getElementById("hud-bases"),
    score: document.getElementById("hud-score"),
    resultBadge: document.getElementById("result-badge"),
    resultTitle: document.getElementById("result-title"),
    resultDetail: document.getElementById("result-detail"),
    overTitle: document.getElementById("over-title"),
    overDetail: document.getElementById("over-detail"),
    finalStats: document.getElementById("final-stats"),
  };

  const LABEL = {
    homerun: { badge: "HOME RUN", title: "홈런!!", color: "#ff5c6c", bases: 4, pts: 400 },
    triple: { badge: "TRIPLE", title: "3루타!", color: "#ff9e4a", bases: 3, pts: 250 },
    double: { badge: "DOUBLE", title: "2루타!", color: "#ffd84c", bases: 2, pts: 150 },
    single: { badge: "SINGLE", title: "안타!", color: "#5fbe72", bases: 1, pts: 80 },
    foul: { badge: "FOUL", title: "파울", color: "#9aa7b4", bases: 0, pts: 0 },
    strike: { badge: "STRIKE", title: "스트라이크", color: "#6b7c8c", bases: 0, pts: 0 },
  };

  let phase = "title";
  let pitchIdx = 0;
  let totalBases = 0;
  let score = 0;
  let results = [];
  let pitchT = 0;
  let pitchDur = 0.92;
  let swingT = 0;
  let swinging = false;
  let resolved = false;
  let outcome = null;
  let ball = { x: MOUND.x, y: MOUND.y, r: 5, vis: false };
  let hit = null;
  let particles = [];
  let floats = [];
  let shake = 0;
  let flash = 0;
  let crowd = 0;
  let last = 0;
  let paused = false;
  let audioCtx = null;
  let windup = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    if (r > 220 && g < 40 && b > 220) return true;
    if (r > 185 && b > 175 && g < 145 && r + b > g * 2.1) return true;
    if (r > 210 && b > 200 && g < 160 && Math.abs(r - b) < 90) return true;
    if (r > 220 && g > 160 && b > 190 && r > g + 20 && b > g + 10 && (r + g + b) / 3 > 195) return true;
    if (r > 230 && g > 190 && b > 210 && Math.abs(r - b) < 50) return true;
    if (r > 235 && g > 210 && b > 225) return true;
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
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) d[i + 3] = 0;
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function tryPunch(key, img) {
    if (spr[key] || !img.complete || !img.naturalWidth) return;
    spr[key] = punchBg(img);
    if (key === "batter") {
      const hero = document.querySelector(".title-hero");
      if (hero) hero.src = spr[key].toDataURL();
    }
  }

  function showOnly(name) {
    [ui.title, ui.result, ui.over].forEach((el) => el.classList.add("hidden"));
    if (name && ui[name]) ui[name].classList.remove("hidden");
  }

  function tone(freq, duration, type = "sine", volume = 0.05, delay = 0) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const start = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration);
    } catch {
      /* optional */
    }
  }

  function crack() {
    tone(190, 0.08, "sawtooth", 0.12);
    tone(70, 0.16, "triangle", 0.08, 0.02);
  }

  function cheer() {
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.22, "triangle", 0.04, i * 0.07));
  }

  function updateHUD() {
    ui.pitch.textContent = String(Math.min(pitchIdx + 1, TOTAL));
    ui.bases.textContent = String(totalBases);
    ui.score.textContent = String(score);
  }

  function burst(x, y, color, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + rand(-0.2, 0.2);
      const sp = rand(40, 180);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: rand(0.45, 0.9), max: 0.9, color, r: rand(2, 4),
      });
    }
  }

  function startPitch() {
    phase = "pitch";
    pitchT = 0;
    pitchDur = rand(0.82, 1.02);
    windup = 0;
    swinging = false;
    swingT = 0;
    resolved = false;
    outcome = null;
    hit = null;
    ball = { x: MOUND.x, y: MOUND.y, r: 5, vis: true };
    ui.coach.textContent = "공이 홈에 오면 탭!";
    updateHUD();
    showOnly(null);
    tone(330, 0.08, "square", 0.03);
  }

  function judge(t) {
    const sweet = 0.74;
    const d = Math.abs(t - sweet);
    if (d <= 0.055) return "homerun";
    if (d <= 0.1) return "triple";
    if (d <= 0.145) return "double";
    if (d <= 0.2) return "single";
    if (t < sweet) return "foul";
    return "strike";
  }

  function doSwing() {
    if (phase !== "pitch" || swinging || resolved) return;
    swinging = true;
    swingT = 0;
    crack();
  }

  function resolve(kind) {
    if (resolved) return;
    resolved = true;
    outcome = kind;
    const meta = LABEL[kind];
    totalBases += meta.bases;
    score += meta.pts;
    results.push(kind);
    phase = "flight";
    ui.coach.textContent = meta.title;
    if (kind === "homerun") {
      cheer();
      shake = 10;
      flash = 0.35;
      crowd = 1;
      burst(HOME.x, HOME.y - 80, "#ffd84c", 28);
      burst(HOME.x, HOME.y - 120, "#ff5c6c", 18);
    } else if (meta.bases > 0) {
      tone(520, 0.1, "square", 0.06);
      burst(HOME.x + 20, HOME.y - 40, meta.color, 12);
    } else {
      tone(160, 0.12, "sawtooth", 0.045);
    }

    const side = Math.random() < 0.5 ? -1 : 1;
    const dist = { homerun: 1, triple: 0.78, double: 0.58, single: 0.38, foul: 0.28, strike: 0 }[kind];
    hit = {
      t: 0,
      dur: kind === "homerun" ? 1.35 : 1.05,
      side,
      dist,
      kind,
      x0: HOME.x + 8,
      y0: HOME.y - 28,
    };
    updateHUD();
  }

  function finishPitch() {
    const meta = LABEL[outcome];
    ui.resultBadge.textContent = meta.badge;
    ui.resultBadge.style.color = meta.color;
    ui.resultTitle.textContent = meta.title;
    ui.resultTitle.style.color = meta.color;
    ui.resultDetail.textContent =
      meta.bases > 0 ? `+${meta.bases}루 · ${meta.pts}점` : "다음 공을 기다려요";
    showOnly("result");
    phase = "result";
  }

  function nextOrEnd() {
    pitchIdx += 1;
    if (pitchIdx >= TOTAL) {
      endGame();
      return;
    }
    startPitch();
  }

  function endGame() {
    phase = "over";
    const hrs = results.filter((r) => r === "homerun").length;
    ui.overTitle.textContent = hrs >= 4 ? "전설의 홈런왕!" : hrs >= 2 ? "담장을 넘겼어요!" : totalBases >= 12 ? "좋은 타격감!" : "다시 스윙해봐요!";
    ui.overDetail.innerHTML = `누적 루타 <b>${totalBases}</b> · 점수 <b>${score.toLocaleString("ko-KR")}</b>`;
    const counts = {};
    results.forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
    const names = { homerun: "홈런", triple: "3루타", double: "2루타", single: "안타", foul: "파울", strike: "삼진" };
    ui.finalStats.innerHTML = ["homerun", "triple", "double", "single", "foul", "strike"]
      .filter((k) => counts[k])
      .map((k) => `<span>${names[k]} <b>${counts[k]}</b></span>`)
      .join("");
    showOnly("over");
    if (window.TodayGameRank) {
      window.TodayGameRank.open(score, { label: `${totalBases}루 · ${score.toLocaleString("ko-KR")}점` });
    }
  }

  function startGame() {
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* */ }
    pitchIdx = 0;
    totalBases = 0;
    score = 0;
    results = [];
    particles = [];
    floats = [];
    updateHUD();
    startPitch();
  }

  function update(dt) {
    if (paused) return;
    crowd = Math.max(0, crowd - dt * 0.55);
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt * 18);
    windup = Math.min(1, windup + dt * 2.4);

    if (phase === "pitch") {
      pitchT += dt / pitchDur;
      const t = clamp(pitchT, 0, 1);
      const ease = easeIn(t) * 0.35 + t * 0.65;
      ball.x = lerp(MOUND.x + Math.sin(t * 6) * 3, HOME.x + 6, ease);
      ball.y = lerp(MOUND.y, HOME.y - 22, ease);
      ball.r = lerp(4.2, 11.5, ease);
      if (swinging) {
        swingT += dt;
        if (swingT >= 0.08 && !resolved) resolve(judge(t));
      } else if (t >= 1) {
        resolve("strike");
      }
    }

    if (swinging) swingT += phase === "pitch" ? 0 : dt;

    if (phase === "flight" && hit) {
      hit.t += dt / hit.dur;
      if (hit.t >= 1) finishPitch();
    }

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
    });
    particles = particles.filter((p) => p.life > 0);
  }

  function drawField() {
    const sky = ctx.createLinearGradient(0, 0, 0, 310);
    sky.addColorStop(0, "#163a6b");
    sky.addColorStop(0.55, "#2d6cad");
    sky.addColorStop(1, "#7ec8ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,224,102,.9)";
    ctx.beginPath();
    ctx.arc(318, 78, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.18)";
    for (let i = 0; i < 9; i++) {
      const x = 18 + i * 42;
      ctx.fillRect(x, 118, 28, 46);
      ctx.fillRect(x + 4, 108, 20, 12);
    }

    const grass = ctx.createLinearGradient(0, 250, 0, H);
    grass.addColorStop(0, "#4caf63");
    grass.addColorStop(1, "#2d7a42");
    ctx.fillStyle = grass;
    ctx.fillRect(0, 250, W, H - 250);

    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#fff" : "#000";
      ctx.fillRect(0, 250 + i * 56, W, 56);
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(HOME.x, HOME.y);
    ctx.lineTo(HOME.x - 150, HOME.y - 188);
    ctx.quadraticCurveTo(HOME.x, HOME.y - 310, HOME.x + 150, HOME.y - 188);
    ctx.closePath();
    ctx.fillStyle = "#d4a05a";
    ctx.fill();

    ctx.fillStyle = "#c48a44";
    ctx.beginPath();
    ctx.ellipse(MOUND.x, MOUND.y + 18, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillRect(HOME.x - 52, HOME.y - 8, 22, 28);
    ctx.fillRect(HOME.x + 30, HOME.y - 8, 22, 28);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(HOME.x, HOME.y + 10);
    ctx.lineTo(HOME.x - 10, HOME.y);
    ctx.lineTo(HOME.x, HOME.y - 10);
    ctx.lineTo(HOME.x + 10, HOME.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawSprite(img, x, y, w, h, flip) {
    if (!img) return;
    ctx.save();
    if (flip) {
      ctx.translate(x + w / 2, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, 0, w, h);
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();
  }

  function drawActors() {
    const pBob = phase === "pitch" && pitchT < 0.18 ? Math.sin(windup * Math.PI) * 6 : 0;
    drawSprite(spr.pitcher, MOUND.x - 44, MOUND.y - 96 - pBob, 88, 108);

    const showSwing = swinging && swingT > 0.05;
    const batterImg = showSwing ? spr.swing : spr.batter;
    const kick = showSwing ? Math.sin(clamp(swingT * 8, 0, Math.PI)) * 4 : Math.sin(performance.now() / 420) * 2;
    drawSprite(batterImg, HOME.x + 8, HOME.y - 92 + kick, 86, 100);
  }

  function drawBall() {
    if (phase === "pitch" && ball.vis) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e24b5a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ball.x - 1, ball.y, ball.r * 0.7, -0.6, 0.8);
      ctx.stroke();
      ctx.restore();
    }

    if (phase === "flight" && hit && hit.kind !== "strike") {
      const t = clamp(hit.t, 0, 1);
      const arc = Math.sin(t * Math.PI);
      const travel = 340 * hit.dist;
      const x = hit.x0 + hit.side * travel * 0.18 * t + (hit.kind === "foul" ? hit.side * 90 * t : 0);
      const y = hit.y0 - arc * (150 + hit.dist * 210) - t * travel * 0.45;
      const r = lerp(10, 4, t);
      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (hit.kind === "homerun" && t > 0.55) {
        burst(x, y, ["#ffd84c", "#ff5c6c", "#7af1ff"][Math.floor(Math.random() * 3)], 2);
      }
    }
  }

  function drawFx() {
    particles.forEach((p) => {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,248,210,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawField();
    drawActors();
    drawBall();
    drawFx();
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    tryPunch("batter", raw.batter);
    tryPunch("swing", raw.swing);
    tryPunch("pitcher", raw.pitcher);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function onTap(e) {
    if (e && e.preventDefault) e.preventDefault();
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* */ }
    if (phase === "pitch") doSwing();
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextOrEnd);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  canvas.addEventListener("pointerdown", onTap);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      onTap();
    }
  });

  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => phase === "pitch" || phase === "flight",
      isPaused: () => paused,
      pause() { paused = true; return true; },
      resume() { paused = false; last = performance.now(); return true; },
    });
  }
  if (window.TodayGameRank) {
    window.TodayGameRank.mount({
      gameId: "homerun-derby",
      gameTitle: "홈런왕",
      formParent: ui.over,
    });
  }
  requestAnimationFrame(loop);
})();
