(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const TOTAL = 10;
  const HOME = { x: 198, y: 546 };
  const MOUND = { x: 195, y: 356 };
  const SWEET = 0.74;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const raw = {
    batter: new Image(),
    contact: new Image(),
    swing: new Image(),
    pitcher: new Image(),
    throw: new Image(),
    stadium: new Image(),
  };
  raw.batter.src = "assets/batter.png?v=5";
  raw.contact.src = "assets/batter-contact.png?v=5";
  raw.swing.src = "assets/batter-swing.png?v=5";
  raw.pitcher.src = "assets/pitcher.png?v=4";
  raw.throw.src = "assets/pitcher-throw.png?v=4";
  raw.stadium.src = "assets/stadium.png?v=4";
  const spr = { batter: null, contact: null, swing: null, pitcher: null, throw: null };

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
    homerun: { badge: "HOME RUN", title: "홈런!!", color: "#ffd84c", bases: 4, pts: 400 },
    triple: { badge: "TRIPLE", title: "3루타!", color: "#ff9e4a", bases: 3, pts: 250 },
    double: { badge: "DOUBLE", title: "2루타!", color: "#7af1ff", bases: 2, pts: 150 },
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
  let ball = { x: MOUND.x, y: MOUND.y, r: 5, vis: false, rot: 0 };
  let trail = [];
  let hit = null;
  let particles = [];
  let rings = [];
  let floats = [];
  let shake = 0;
  let flash = 0;
  let crowd = 0;
  let zoom = 1;
  let hitFx = null;
  let last = 0;
  let paused = false;
  let audioCtx = null;
  let windup = 0;
  let time = 0;

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
    tone(210, 0.07, "sawtooth", 0.11);
    tone(78, 0.18, "triangle", 0.09, 0.015);
    tone(640, 0.05, "square", 0.04, 0.01);
  }

  function whoosh() {
    tone(420, 0.08, "sine", 0.03);
    tone(180, 0.1, "triangle", 0.025, 0.02);
  }

  function cheer() {
    [392, 523, 659, 784, 988].forEach((f, i) => tone(f, 0.24, "triangle", 0.045, i * 0.06));
  }

  function updateHUD() {
    ui.pitch.textContent = String(Math.min(pitchIdx + 1, TOTAL));
    ui.bases.textContent = String(totalBases);
    ui.score.textContent = String(score);
  }

  function burst(x, y, color, n = 16, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + rand(-0.28, 0.28);
      const sp = rand(opt.min || 50, opt.max || 220);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opt.lift || 50),
        life: rand(0.4, opt.life || 0.95),
        max: opt.life || 0.95,
        color,
        r: rand(opt.r0 || 1.6, opt.r1 || 4.2),
        kind: opt.kind || "spark",
        rot: rand(0, Math.PI * 2),
        vr: rand(-8, 8),
      });
    }
  }

  function ring(x, y, color, max = 70) {
    rings.push({ x, y, r: 8, max, life: 1, color });
  }

  function pop(text, x, y, color) {
    floats.push({ text, x, y, vy: -46, life: 1.15, color });
  }

  function dust(x, y, n = 8) {
    burst(x, y, "rgba(210,170,110,.9)", n, { min: 20, max: 90, lift: 10, kind: "dust", r0: 2, r1: 6, life: 0.55 });
  }

  function startPitch() {
    phase = "pitch";
    pitchT = 0;
    pitchDur = rand(0.84, 1.04);
    windup = 0;
    swinging = false;
    swingT = 0;
    resolved = false;
    outcome = null;
    hit = null;
    trail = [];
    hitFx = null;
    ball = { x: MOUND.x, y: MOUND.y - 18, r: 4, vis: false, rot: 0 };
    ui.coach.textContent = "공이 홈에 오면 탭!";
    updateHUD();
    showOnly(null);
    tone(330, 0.08, "square", 0.03);
  }

  function judge(t) {
    const d = Math.abs(t - SWEET);
    if (d <= 0.055) return "homerun";
    if (d <= 0.1) return "triple";
    if (d <= 0.145) return "double";
    if (d <= 0.2) return "single";
    if (t < SWEET) return "foul";
    return "strike";
  }

  function doSwing() {
    if (phase !== "pitch" || swinging || resolved) return;
    swinging = true;
    swingT = 0;
    whoosh();
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
    const hx = HOME.x + 10;
    const hy = HOME.y - 36;

    if (kind === "homerun") {
      cheer();
      shake = 14;
      flash = 0.5;
      crowd = 1;
      burst(hx, hy, "#ffd84c", 34, { max: 280, lift: 90, kind: "star" });
      burst(hx, hy, "#ff5c6c", 22, { max: 240, kind: "spark" });
      burst(hx, hy, "#7af1ff", 16, { max: 200, kind: "spark" });
      ring(hx, hy, "rgba(255,216,76,.85)", 120);
      ring(hx, hy, "rgba(255,255,255,.5)", 70);
      pop("HOME RUN +400", hx, hy - 40, "#ffd84c");
      hitFx = { fireworks: 0, next: 0.12 };
    } else if (meta.bases > 0) {
      crack();
      tone(520, 0.1, "square", 0.06);
      shake = 6 + meta.bases;
      flash = 0.22;
      crowd = 0.45;
      burst(hx, hy, meta.color, 16, { kind: "spark" });
      ring(hx, hy, meta.color, 56);
      pop(`+${meta.pts}`, hx + 8, hy - 24, meta.color);
    } else {
      tone(160, 0.12, "sawtooth", 0.045);
      dust(hx, hy + 20, 6);
      pop(meta.title, hx, hy - 10, meta.color);
    }

    if (kind !== "strike") {
      crack();
      dust(HOME.x + 18, HOME.y - 8, 10);
    }

    const side = Math.random() < 0.5 ? -1 : 1;
    const dist = { homerun: 1, triple: 0.8, double: 0.6, single: 0.4, foul: 0.3, strike: 0 }[kind];
    hit = {
      t: 0,
      dur: kind === "homerun" ? 1.55 : 1.12,
      side,
      dist,
      kind,
      x0: hx,
      y0: hy,
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
    rings = [];
    floats = [];
    trail = [];
    updateHUD();
    startPitch();
  }

  function update(dt) {
    if (paused) return;
    time += dt;
    crowd = Math.max(0, crowd - dt * 0.48);
    flash = Math.max(0, flash - dt * 1.8);
    shake = Math.max(0, shake - dt * 16);
    windup = Math.min(1, windup + dt * 2.2);

    const wantZoom = phase === "pitch" ? 1 + easeIn(clamp((pitchT - 0.38) / 0.5, 0, 1)) * 0.14 : 1;
    zoom = lerp(zoom, wantZoom, 1 - Math.pow(0.001, dt));

    if (phase === "pitch") {
      const prev = pitchT;
      pitchT += dt / pitchDur;
      const t = clamp(pitchT, 0, 1);
      if (prev < 0.2 && t >= 0.2) {
        ball.vis = true;
        dust(MOUND.x, MOUND.y + 16, 7);
        tone(190, 0.06, "triangle", 0.03);
      }
      const ease = easeIn(t) * 0.28 + t * 0.72;
      ball.x = lerp(MOUND.x + 10, HOME.x + 8, ease) + Math.sin(t * 10) * 2.2;
      ball.y = lerp(MOUND.y - 22, HOME.y - 30, ease) - Math.sin(t * Math.PI) * 18;
      ball.r = lerp(3.6, 12.8, ease);
      ball.rot += dt * (10 + t * 16);
      if (ball.vis) {
        trail.push({ x: ball.x, y: ball.y, r: ball.r, life: 1 });
        if (trail.length > 10) trail.shift();
      }
      if (swinging) {
        swingT += dt;
        if (swingT >= 0.075 && !resolved) resolve(judge(t));
      } else if (t >= 1) {
        resolve("strike");
      }
    } else if (swinging) {
      swingT += dt;
    }

    trail.forEach((p) => { p.life -= dt * 3.2; });
    trail = trail.filter((p) => p.life > 0);

    if (phase === "flight" && hit) {
      hit.t += dt / hit.dur;
      if (hitFx && hit.kind === "homerun") {
        hitFx.next -= dt;
        if (hitFx.next <= 0 && hitFx.fireworks < 6) {
          const colors = ["#ffd84c", "#ff5c6c", "#7af1ff", "#ffffff"];
          burst(rand(36, 354), rand(64, 190), colors[hitFx.fireworks % 4], 16, { kind: "star", max: 170, lift: 90 });
          hitFx.fireworks += 1;
          hitFx.next = 0.16;
        }
      }
      if (hit.kind === "homerun" && hit.t > 0.55 && Math.random() < 0.4) {
        const pos = hitPos(hit.t);
        burst(pos.x, pos.y, ["#ffd84c", "#fff1a8", "#ff7a88"][Math.floor(Math.random() * 3)], 2, { min: 10, max: 50, kind: "spark", life: 0.4 });
      }
      if (hit.t >= 1) finishPitch();
    }

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === "dust" ? 180 : 260) * dt;
      p.vx *= 0.99;
      p.rot += p.vr * dt;
    });
    particles = particles.filter((p) => p.life > 0);

    rings.forEach((r) => {
      r.life -= dt * 1.5;
      r.r += dt * r.max * 1.4;
    });
    rings = rings.filter((r) => r.life > 0);

    floats.forEach((f) => {
      f.life -= dt * 0.7;
      f.y += f.vy * dt;
      f.vy += 18 * dt;
    });
    floats = floats.filter((f) => f.life > 0);
  }

  function coverImage(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function drawFieldFallback() {
    const sky = ctx.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, "#04122c");
    sky.addColorStop(1, "#1b4f86");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const grass = ctx.createLinearGradient(0, 240, 0, H);
    grass.addColorStop(0, "#2f8a4a");
    grass.addColorStop(1, "#14532d");
    ctx.fillStyle = grass;
    ctx.fillRect(0, 240, W, H - 240);
  }

  function drawLights() {
    const pulse = 0.08 + Math.sin(time * 3.2) * 0.03 + crowd * 0.12;
    [
      [18, 78, 1],
      [372, 78, -1],
      [70, 52, 1],
      [320, 52, -1],
    ].forEach(([x, y, flip]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      const beam = ctx.createLinearGradient(0, 0, 90, 240);
      beam.addColorStop(0, `rgba(230,248,255,${0.16 + pulse})`);
      beam.addColorStop(1, "rgba(230,248,255,0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(130, 250);
      ctx.lineTo(20, 250);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    const colors = ["#f7df72", "#ef6b87", "#6ccff6", "#73d28b", "#ff914d", "#e8f2ff"];
    if (crowd > 0.02) {
      for (let i = 0; i < 48; i++) {
        const x = 10 + (i * 37) % 370;
        const y = 118 + ((i * 19) % 70);
        ctx.globalAlpha = crowd * (0.35 + (i % 3) * 0.15);
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(x, y + Math.sin(time * 18 + i) * crowd * 6, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawInfield() {
    ctx.fillStyle = "rgba(196,138,68,.4)";
    ctx.beginPath();
    ctx.ellipse(MOUND.x, MOUND.y + 20, 32, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillRect(MOUND.x - 9, MOUND.y + 15, 18, 3);

    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(HOME.x - 50, HOME.y - 2, 20, 22);
    ctx.fillRect(HOME.x + 30, HOME.y - 2, 20, 22);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.28)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#f6f3ea";
    ctx.beginPath();
    ctx.moveTo(HOME.x, HOME.y + 14);
    ctx.lineTo(HOME.x - 13, HOME.y + 2);
    ctx.lineTo(HOME.x, HOME.y - 12);
    ctx.lineTo(HOME.x + 13, HOME.y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (phase === "pitch") {
      const near = clamp(1 - Math.abs(clamp(pitchT, 0, 1) - SWEET) / 0.22, 0, 1);
      const inWindow = Math.abs(pitchT - SWEET) < 0.08;
      ctx.save();
      ctx.strokeStyle = inWindow ? `rgba(255,216,76,${0.25 + near * 0.7})` : `rgba(122,241,255,${0.12 + near * 0.35})`;
      ctx.lineWidth = inWindow ? 3.2 : 1.6;
      ctx.shadowColor = inWindow ? "#ffd84c" : "#7af1ff";
      ctx.shadowBlur = 12 + near * 16;
      ctx.beginPath();
      ctx.ellipse(HOME.x + 6, HOME.y - 28, 22 + near * 8, 10 + near * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (inWindow && !swinging) {
        ctx.fillStyle = "rgba(255,216,76,.16)";
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawField() {
    if (raw.stadium.complete && raw.stadium.naturalWidth) coverImage(raw.stadium);
    else drawFieldFallback();

    const grade = ctx.createLinearGradient(0, 0, 0, H);
    grade.addColorStop(0, "rgba(4,12,28,.18)");
    grade.addColorStop(0.42, "rgba(4,12,28,0)");
    grade.addColorStop(1, "rgba(2,10,20,.22)");
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);

    drawLights();
    drawInfield();
  }

  function drawSprite(img, x, y, w, h, opt = {}) {
    if (!img) return;
    ctx.save();
    ctx.translate(x + w / 2, y + h);
    ctx.scale(opt.flip ? -1 : 1, 1);
    ctx.rotate(opt.rot || 0);
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function batterPose() {
    if (!swinging) return "batter";
    if (swingT < 0.055) return "batter";
    if (swingT < 0.16) return "contact";
    return "swing";
  }

  function drawActors() {
    const throwing = phase === "pitch" && pitchT >= 0.18 || phase === "flight";
    const pImg = throwing ? (spr.throw || spr.pitcher) : spr.pitcher;
    const lift = !throwing ? Math.sin(clamp(windup, 0, 1) * Math.PI) * 10 : 0;
    const plant = throwing && phase === "pitch" ? Math.sin(clamp((pitchT - 0.18) * 8, 0, Math.PI)) * 5 : 0;
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(MOUND.x, MOUND.y + 24, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(pImg, MOUND.x - 36, MOUND.y - 88 - lift + plant, 72, 90);

    const pose = batterPose();
    const bImg = spr[pose] || spr.batter;
    const idle = !swinging ? Math.sin(time * 3.1) * 3 : 0;
    const waggle = !swinging ? Math.sin(time * 4.4) * 0.04 : 0;
    const kick = swinging ? Math.sin(clamp(swingT * 9, 0, Math.PI)) * 7 : 0;
    const bx = HOME.x - 132;
    const by = HOME.y - 148 + idle + kick;
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(bx + 70, HOME.y + 10, 34, 8, -0.08, 0, Math.PI * 2);
    ctx.fill();
    if (swinging && swingT < 0.2) {
      const ghost = swingT < 0.1 ? spr.batter : spr.contact;
      drawSprite(ghost, bx + 10, by + 6, 142, 170, { alpha: 0.3, rot: 0.12 });
    }
    drawSprite(bImg, bx, by, 142, 170, { rot: waggle + (swinging ? 0.06 : 0) });
  }

  function drawBaseball(x, y, r, rot) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(x + 2, y + r * 1.6, r * 1.15, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.7, "#f3f1ea");
    g.addColorStop(1, "#d4cfc4");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255,255,255,.35)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#d94a5c";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.arc(-r * 0.15, 0, r * 0.78, -0.85, 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.15, 0, r * 0.78, Math.PI - 0.85, Math.PI + 0.85);
    ctx.stroke();
    ctx.restore();
  }

  function hitPos(t) {
    const arc = Math.sin(t * Math.PI);
    const travel = 390 * hit.dist;
    const foul = hit.kind === "foul" ? hit.side * 110 * t : 0;
    return {
      x: hit.x0 + hit.side * travel * 0.2 * t + foul,
      y: hit.y0 - arc * (170 + hit.dist * 250) - t * travel * 0.42,
      r: lerp(11, 3.4, t),
    };
  }

  function drawBall() {
    trail.forEach((p) => {
      ctx.globalAlpha = p.life * 0.35;
      ctx.fillStyle = "#fff6d2";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (phase === "pitch" && ball.vis) {
      drawBaseball(ball.x, ball.y, ball.r, ball.rot);
    }

    if (phase === "flight" && hit && hit.kind !== "strike") {
      const t = clamp(hit.t, 0, 1);
      const p = hitPos(t);
      if (hit.kind === "homerun") {
        const tg = ctx.createLinearGradient(hit.x0, hit.y0, p.x, p.y);
        tg.addColorStop(0, "rgba(255,216,76,0)");
        tg.addColorStop(1, "rgba(255,216,76,.55)");
        ctx.strokeStyle = tg;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(hit.x0, hit.y0);
        ctx.quadraticCurveTo(lerp(hit.x0, p.x, 0.45), p.y + 40, p.x, p.y);
        ctx.stroke();
      }
      drawBaseball(p.x, p.y, p.r, t * 14);
    }
  }

  function drawFx() {
    rings.forEach((r) => {
      ctx.globalAlpha = r.life * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * r.life;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    });
    particles.forEach((p) => {
      ctx.globalAlpha = p.life / p.max;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.kind === "star") {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          const x = Math.cos(a) * p.r;
          const y = Math.sin(a) * p.r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === "dust") {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    floats.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.font = "900 20px Jua, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.shadowColor = "rgba(0,0,0,.45)";
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,246,210,${flash * 0.38})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake * 0.7, shake * 0.7));
    ctx.translate(W / 2, H * 0.74);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H * 0.74);
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
    tryPunch("contact", raw.contact);
    tryPunch("swing", raw.swing);
    tryPunch("pitcher", raw.pitcher);
    tryPunch("throw", raw.throw);
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
