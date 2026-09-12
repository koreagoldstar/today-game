(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const PIN_LAYOUT = [
    [0, 0.58],
    [-0.11, 0.64], [0.11, 0.64],
    [-0.22, 0.70], [0, 0.70], [0.22, 0.70],
    [-0.33, 0.76], [-0.11, 0.76], [0.11, 0.76], [0.33, 0.76],
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const raw = { bowler: new Image(), pin: new Image() };
  raw.bowler.src = "assets/bowler.png";
  raw.pin.src = "assets/pin.png";
  const spr = { bowler: null, pin: null };

  const ui = {
    title: document.getElementById("title"),
    over: document.getElementById("game-over"),
    coach: document.getElementById("coach"),
    frame: document.getElementById("hud-frame"),
    score: document.getElementById("hud-score"),
    roll: document.getElementById("hud-roll"),
    strip: document.getElementById("frame-strip"),
    meter: document.getElementById("meter"),
    meterLabel: document.getElementById("meter-label"),
    cursor: document.getElementById("meter-cursor"),
    overTitle: document.getElementById("over-title"),
    overDetail: document.getElementById("over-detail"),
    finalX: document.getElementById("final-x"),
    finalSpare: document.getElementById("final-spare"),
    finalScore: document.getElementById("final-score"),
  };

  let phase = "title";
  let frameIdx = 0;
  let rollIdx = 0;
  let frames = Array.from({ length: 10 }, () => []);
  let pins = [];
  let ball = { x: 0, z: 0.04, vx: 0, vz: 0, spin: 0, rolling: false, rot: 0 };
  let meter = { mode: "aim", v: 0, dir: 1 };
  let lockedAim = 0.5;
  let lockedPower = 0.5;
  let settle = 0;
  let pop = null;
  let shake = 0;
  let last = 0;
  let paused = false;
  let audioCtx = null;
  let bowlerKick = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
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

  function punchBg(img, strict) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      const punch = strict
        ? a < 28 || (r > 200 && g < 90 && b > 180 && r + b > g * 2.5)
        : isPunchBg(r, g, b, a);
      if (punch) d[i + 3] = 0;
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function tryPunch(key, img) {
    if (spr[key] || !img.complete || !img.naturalWidth) return;
    spr[key] = punchBg(img, key === "pin");
    if (key === "bowler") {
      const hero = document.querySelector(".title-hero");
      if (hero) hero.src = spr[key].toDataURL();
    }
  }

  function showOnly(name) {
    ui.title.classList.toggle("hidden", name !== "title");
    ui.over.classList.toggle("hidden", name !== "over");
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

  function project(x, z) {
    const s = 1 - z * 0.68;
    return {
      x: W * 0.5 + x * W * 0.42 * s,
      y: lerp(H * 0.84, H * 0.2, z),
      s,
    };
  }

  function resetPins(keepDown) {
    const down = new Set((keepDown || []).map((p, i) => (p.down ? i : -1)).filter((i) => i >= 0));
    pins = PIN_LAYOUT.map(([x, z], i) => ({
      x, z, vx: 0, vz: 0, ang: 0, spin: 0,
      down: down.has(i),
      r: 0.034,
    }));
  }

  function standingCount() {
    return pins.filter((p) => !p.down).length;
  }

  function scoreAt(upto) {
    let total = 0;
    for (let i = 0; i < upto; i++) {
      const f = frames[i];
      if (!f.length) continue;
      if (i < 9) {
        if (f[0] === 10) {
          const n = nextRolls(i, 2);
          if (n == null) continue;
          total += 10 + n;
        } else if ((f[0] || 0) + (f[1] || 0) === 10 && f.length >= 2) {
          const n = nextRolls(i, 1);
          if (n == null) continue;
          total += 10 + n;
        } else if (f.length >= 2) {
          total += f[0] + f[1];
        }
      } else {
        total += f.reduce((a, b) => a + b, 0);
      }
    }
    return total;
  }

  function nextRolls(frame, n) {
    const got = [];
    for (let i = frame + 1; i < 10 && got.length < n; i++) {
      got.push(...frames[i]);
    }
    if (got.length < n) return null;
    return got.slice(0, n).reduce((a, b) => a + b, 0);
  }

  function frameMark(f) {
    if (!f.length) return "";
    if (f[0] === 10) return "X";
    if (f.length >= 2 && f[0] + f[1] === 10) return `${f[0]}/`;
    if (f.length >= 2) return String(f[0] + f[1]);
    return String(f[0]);
  }

  function renderStrip() {
    ui.strip.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const el = document.createElement("div");
      el.className = "fbox" + (i === frameIdx && phase !== "over" ? " cur" : "");
      el.textContent = frameMark(frames[i]) || String(i + 1);
      ui.strip.appendChild(el);
    }
  }

  function liveScore() {
    return scoreAt(10);
  }

  function updateHUD() {
    ui.frame.textContent = String(Math.min(frameIdx + 1, 10));
    ui.roll.textContent = String(rollIdx + 1);
    ui.score.textContent = String(liveScore());
    renderStrip();
  }

  function say(text, color) {
    pop = { text, color, t: 0 };
  }

  function startAim() {
    phase = "aim";
    rollIdx = frames[frameIdx] ? frames[frameIdx].length : 0;
    ball = { x: 0, z: 0.04, vx: 0, vz: 0, rolling: false, rot: 0 };
    meter = { mode: "aim", v: 0, dir: 1 };
    ui.meter.classList.remove("hidden");
    ui.meterLabel.textContent = "방향을 정하세요";
    ui.coach.textContent = "가운데에 가까울수록 핀 정중앙";
    updateHUD();
  }

  function startPower() {
    phase = "power";
    meter = { mode: "power", v: 0, dir: 1 };
    ui.meterLabel.textContent = "파워를 정하세요";
    ui.coach.textContent = "너무 세면 도랑으로 샐 수 있어요";
  }

  function launch() {
    phase = "roll";
    ui.meter.classList.add("hidden");
    bowlerKick = 1;
    const aim = (lockedAim - 0.5) * 1.15;
    const power = 0.42 + lockedPower * 0.72;
    ball = {
      x: 0,
      z: 0.045,
      vx: aim * 0.5,
      vz: 0.78 + power * 0.62,
      hook: (0.5 - lockedAim) * 0.7,
      rolling: true,
      rot: 0,
      age: 0,
    };
    settle = 0;
    tone(180, 0.08, "triangle", 0.06);
  }

  function collideBallPin(pin) {
    if (pin.down) return;
    const dx = pin.x - ball.x;
    const dz = pin.z - ball.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const min = pin.r + 0.038;
    if (dist >= min) return;
    const nx = dx / dist;
    const nz = dz / dist;
    pin.x = ball.x + nx * min;
    pin.z = ball.z + nz * min;
    const speed = Math.hypot(ball.vx, ball.vz);
    pin.vx += nx * speed * 1.15 + rand(-0.04, 0.04);
    pin.vz += nz * speed * 0.55 + rand(-0.03, 0.03);
    pin.spin += rand(-8, 8);
    ball.vx -= nx * 0.08;
    ball.vz *= 0.92;
    tone(90 + speed * 40, 0.05, "sawtooth", 0.035);
  }

  function collidePins() {
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i];
        const b = pins[j];
        if (a.down && b.down) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const min = a.r + b.r;
        if (dist >= min) continue;
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = min - dist;
        a.x -= nx * overlap * 0.5;
        a.z -= nz * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.z += nz * overlap * 0.5;
        const av = a.vx * nx + a.vz * nz;
        const bv = b.vx * nx + b.vz * nz;
        const diff = bv - av;
        a.vx += nx * diff * 0.55;
        a.vz += nz * diff * 0.55;
        b.vx -= nx * diff * 0.55;
        b.vz -= nz * diff * 0.55;
      }
    }
  }

  function afterRoll() {
    const downNow = pins.filter((p) => p.down).length;
    const already = frames[frameIdx].reduce((a, b) => a + b, 0);
    let knocked = downNow - already;
    if (frameIdx === 9 && frames[frameIdx][0] === 10) knocked = pins.filter((p) => p.down).length;
    if (frameIdx === 9 && frames[frameIdx].length === 1 && frames[frameIdx][0] + knocked > 10 && frames[frameIdx][0] !== 10) {
      knocked = 10 - frames[frameIdx][0];
    }
    knocked = clamp(knocked, 0, 10);
    frames[frameIdx].push(knocked);
    const f = frames[frameIdx];
    const isTenth = frameIdx === 9;

    if (!isTenth && f[0] === 10) {
      say("STRIKE!!", "#ff5c5c");
      tone(520, 0.1, "triangle", 0.06);
      tone(780, 0.14, "sine", 0.05, 0.08);
      shake = 8;
      finishFrame();
      return;
    }
    if (!isTenth && f.length === 2 && f[0] + f[1] === 10) {
      say("SPARE!", "#5fbe72");
      tone(440, 0.1, "triangle", 0.05);
      finishFrame();
      return;
    }
    if (!isTenth && f.length === 2) {
      say(`${knocked}핀`, "#ffc145");
      finishFrame();
      return;
    }
    if (isTenth) {
      if (f.length === 1 && f[0] === 10) {
        say("STRIKE!!", "#ff5c5c");
        resetPins();
        startAim();
        return;
      }
      if (f.length === 2 && f[0] === 10) {
        if (f[1] === 10) say("STRIKE!!", "#ff5c5c");
        resetPins();
        startAim();
        return;
      }
      if (f.length === 2 && f[0] + f[1] === 10) {
        say("SPARE!", "#5fbe72");
        resetPins();
        startAim();
        return;
      }
      if (f.length === 2 && f[0] !== 10 && f[0] + f[1] < 10) {
        finishFrame();
        return;
      }
      if (f.length === 3) {
        if (f[2] === 10) say("STRIKE!!", "#ff5c5c");
        finishFrame();
        return;
      }
      say(`${knocked}핀`, "#ffc145");
      startAim();
      return;
    }
    say(`${knocked}핀`, "#ffc145");
    startAim();
  }

  function finishFrame() {
    frameIdx += 1;
    rollIdx = 0;
    if (frameIdx >= 10) {
      endGame();
      return;
    }
    resetPins();
    startAim();
  }

  function endGame() {
    phase = "over";
    ui.meter.classList.add("hidden");
    const score = liveScore();
    const xs = frames.filter((f) => f[0] === 10).length;
    const spares = frames.filter((f, i) => i < 9 && f.length >= 2 && f[0] !== 10 && f[0] + f[1] === 10).length;
    ui.overTitle.textContent = score >= 180 ? "퍼펙트에 가까워요!" : score >= 120 ? "멋진 게임!" : "한 게임 더!";
    ui.overDetail.innerHTML = `최종 점수 <b>${score}</b>`;
    ui.finalX.textContent = String(xs);
    ui.finalSpare.textContent = String(spares);
    ui.finalScore.textContent = String(score);
    updateHUD();
    showOnly("over");
    if (window.TodayGameRank) {
      window.TodayGameRank.open(score, { label: `${score}점 · X${xs}` });
    }
  }

  function startGame() {
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* */ }
    frameIdx = 0;
    rollIdx = 0;
    frames = Array.from({ length: 10 }, () => []);
    resetPins();
    ball = { x: 0, z: 0.04, vx: 0, vz: 0, rolling: false, rot: 0 };
    pop = null;
    showOnly(null);
    startAim();
  }

  function lockMeter() {
    if (phase === "aim") {
      lockedAim = meter.v;
      tone(500, 0.05, "square", 0.04);
      startPower();
    } else if (phase === "power") {
      lockedPower = meter.v;
      tone(680, 0.05, "square", 0.04);
      launch();
    }
  }

  function update(dt) {
    if (paused) return;
    shake = Math.max(0, shake - dt * 18);
    bowlerKick = Math.max(0, bowlerKick - dt * 1.8);
    if (pop) {
      pop.t += dt;
      if (pop.t > 0.85) pop = null;
    }

    if (phase === "aim" || phase === "power") {
      const spd = phase === "aim" ? 1.15 : 1.45;
      meter.v += meter.dir * spd * dt;
      if (meter.v >= 1) { meter.v = 1; meter.dir = -1; }
      if (meter.v <= 0) { meter.v = 0; meter.dir = 1; }
      ui.cursor.style.left = `${meter.v * 100}%`;
    }

    if (phase === "roll" && ball.rolling) {
      ball.vx += ball.hook * dt * 0.55;
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt;
      ball.rot += dt * 16;
      ball.age += dt;
      ball.vz *= 1 - dt * 0.05;
      if (Math.abs(ball.x) > 0.94 && ball.z < 0.76) {
        ball.x = Math.sign(ball.x) * 1.05;
        ball.vz *= 0.4;
      }
      pins.forEach(collideBallPin);
      pins.forEach((p) => {
        if (p.down) return;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.vx *= 1 - dt * 2.4;
        p.vz *= 1 - dt * 2.4;
        p.ang += p.spin * dt;
        if (Math.hypot(p.vx, p.vz) > 0.16 || Math.abs(p.ang) > 0.55) {
          p.down = true;
          p.vx *= 1.1;
        }
      });
      collidePins();
      const moving = Math.hypot(ball.vx, ball.vz) > 0.05 || pins.some((p) => !p.down && Math.hypot(p.vx, p.vz) > 0.04);
      if (ball.z > 0.92 || !moving || ball.age > 2.1) {
        settle += dt;
        if (settle > 0.28) {
          ball.rolling = false;
          pins.forEach((p) => {
            if (Math.hypot(p.vx, p.vz) > 0.1) p.down = true;
          });
          afterRoll();
        }
      }
    }
  }

  function drawLane() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#2a1824");
    bg.addColorStop(1, "#12080e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const nearL = project(-1, 0);
    const nearR = project(1, 0);
    const farL = project(-1, 1);
    const farR = project(1, 1);
    ctx.beginPath();
    ctx.moveTo(nearL.x - 18, nearL.y + 20);
    ctx.lineTo(farL.x - 8, farL.y);
    ctx.lineTo(farR.x + 8, farR.y);
    ctx.lineTo(nearR.x + 18, nearR.y + 20);
    ctx.closePath();
    ctx.fillStyle = "#6a3e22";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(nearL.x, nearL.y);
    ctx.lineTo(farL.x, farL.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.closePath();
    const wood = ctx.createLinearGradient(0, farL.y, 0, nearL.y);
    wood.addColorStop(0, "#d9a85e");
    wood.addColorStop(1, "#e8c48a");
    ctx.fillStyle = wood;
    ctx.fill();

    ctx.strokeStyle = "rgba(120,80,40,.2)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const a = project(-1 + t * 2, 0);
      const b = project(-1 + t * 2, 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(220,50,50,.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nearL.x, nearL.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.stroke();
  }

  function drawPins() {
    const order = pins.map((p, i) => ({ p, i, y: project(p.x, p.z).y })).sort((a, b) => a.y - b.y);
    order.forEach(({ p }) => {
      const q = project(p.x, p.z);
      const h = 34 + 86 * q.s;
      const w = 16 + 30 * q.s;
      ctx.save();
      ctx.translate(q.x, q.y);
      if (p.down) ctx.rotate(1.15 + p.ang * 0.15);
      if (spr.pin) ctx.drawImage(spr.pin, -w / 2, -h, w, h);
      else {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.35, w * 0.35, h * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawBall() {
    const q = project(ball.x, ball.z);
    const r = 16 * q.s * (ball.rolling || phase === "aim" || phase === "power" ? 1 : 1);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(ball.rot);
    const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, r);
    g.addColorStop(0, "#5a3a2a");
    g.addColorStop(1, "#1a100c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8b48a";
    [[-3, -2], [4, 1], [0, 5]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x * q.s, y * q.s, 1.6 * q.s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawBowler() {
    if (!spr.bowler) return;
    const kick = bowlerKick * 10;
    ctx.drawImage(spr.bowler, 138, 538 - kick, 118, 132);
  }

  function drawFx() {
    if (!pop) return;
    ctx.globalAlpha = 1 - pop.t / 0.85;
    ctx.fillStyle = pop.color;
    ctx.font = '700 34px "Bagel Fat One", Jua, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(pop.text, W / 2, 250 - pop.t * 24);
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawLane();
    drawPins();
    drawBall();
    drawBowler();
    drawFx();
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    tryPunch("bowler", raw.bowler);
    tryPunch("pin", raw.pin);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("lock-btn").addEventListener("click", lockMeter);
  canvas.addEventListener("pointerdown", (e) => {
    if (phase === "aim" || phase === "power") {
      e.preventDefault();
      lockMeter();
    }
  });

  if (window.TodayPause) {
    window.TodayPause.mount({
      canPause: () => phase !== "title" && phase !== "over",
      isPaused: () => paused,
      pause() { paused = true; return true; },
      resume() { paused = false; last = performance.now(); return true; },
    });
  }
  if (window.TodayGameRank) {
    window.TodayGameRank.mount({
      gameId: "bowling-strike",
      gameTitle: "볼링 스트라이크",
      formParent: ui.over,
    });
  }
  showOnly("title");
  requestAnimationFrame(loop);
})();
