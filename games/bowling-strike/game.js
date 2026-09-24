(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const PIN_LAYOUT = [
    [0, 0.40],
    [-0.17, 0.49], [0.17, 0.49],
    [-0.34, 0.58], [0, 0.58], [0.34, 0.58],
    [-0.51, 0.67], [-0.17, 0.67], [0.17, 0.67], [0.51, 0.67],
  ];
  const BALL_R = 0.052;
  const SWEET = 0.5;
  const SWEET_R = 0.16;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const raw = {
    bowler: new Image(),
    throw: new Image(),
    pin: new Image(),
    pinDown: new Image(),
    ball: new Image(),
    alley: new Image(),
  };
  raw.bowler.src = "assets/bowler.png?v=6";
  raw.throw.src = "assets/bowler-bowl.png?v=6";
  raw.pin.src = "assets/pin.png?v=8";
  raw.pinDown.src = "assets/pin-down.png?v=3";
  raw.ball.src = "assets/ball.png?v=2";
  raw.alley.src = "assets/alley.png?v=7";
  const spr = { bowler: null, throw: null, pin: null, pinDown: null, ball: null };

  const ui = {
    title: document.getElementById("title"),
    over: document.getElementById("game-over"),
    coach: document.getElementById("coach"),
    frame: document.getElementById("hud-frame"),
    score: document.getElementById("hud-score"),
    roll: document.getElementById("hud-roll"),
    strip: document.getElementById("frame-strip"),
    aimPanel: document.getElementById("aim-panel"),
    hookSlider: document.getElementById("hook-slider"),
    hookReadout: document.getElementById("hook-readout"),
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
  let ball = { x: 0, z: 0.04, vx: 0, vz: 0, hook: 0, rolling: false, rot: 0 };
  let meter = { mode: "power", v: 0, dir: 1 };
  let hook = 0;
  let lockedPower = 0.5;
  let settle = 0;
  let pop = null;
  let shake = 0;
  let last = 0;
  let paused = false;
  let audioCtx = null;
  let bowlerKick = 0;
  let dragging = false;
  let lockCool = 0;
  let particles = [];
  let flashes = [];
  let rumble = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    if (g < 48 && r > 175 && b > 125 && r > g + 90 && b > g + 70) return true;
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
        ? a < 28 || (g < 48 && r > 175 && b > 125 && r > g + 90 && b > g + 70)
        : isPunchBg(r, g, b, a);
      if (punch) d[i + 3] = 0;
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function tryPunch(key, img) {
    if (spr[key] || !img.complete || !img.naturalWidth) return;
    spr[key] = punchBg(img, key === "pin" || key === "pinDown" || key === "ball");
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

  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: rand(-160, 160),
        vy: rand(-220, 30),
        life: rand(0.22, 0.55),
        max: 0.55,
        r: rand(1.2, 3.6),
        color: color || (Math.random() > 0.45 ? "#fff6ea" : "#ffb45c"),
      });
    }
  }

  function impactFx(pin, speed) {
    const q = project(pin.x, pin.z);
    const heavy = speed > 0.7;
    burst(q.x, q.y - 12, heavy ? 16 : 9);
    flashes.push({ x: q.x, y: q.y - 8, t: 0, r: 10 + speed * 8 });
    shake = Math.max(shake, heavy ? 7 : 3.5);
    tone(80 + speed * 55, 0.07, "sawtooth", 0.045);
    tone(220 + speed * 90, 0.05, "triangle", 0.03, 0.02);
  }

  function resetPins(keepDown) {
    const down = new Set((keepDown || []).map((p, i) => (p.down ? i : -1)).filter((i) => i >= 0));
    pins = PIN_LAYOUT.map(([x, z], i) => ({
      x, z, vx: 0, vz: 0, ang: 0, spin: 0,
      down: down.has(i),
      fall: down.has(i) ? 1 : 0,
      fallVel: 0,
      r: 0.05,
    }));
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

  function hookFromSlider() {
    const rawVal = Number(ui.hookSlider.value) || 0;
    if (Math.abs(rawVal) < 12) {
      hook = 0;
      ui.hookSlider.value = "0";
      ui.hookReadout.textContent = "직진";
      return;
    }
    hook = clamp(rawVal / 100, -0.8, 0.8);
    ui.hookReadout.textContent = hook < 0 ? `왼쪽 훅 ${Math.round(Math.abs(hook) * 100)}` : `오른쪽 훅 ${Math.round(hook * 100)}`;
  }

  function showAimUI() {
    ui.aimPanel.classList.remove("hidden");
    ui.meter.classList.add("hidden");
  }

  function showPowerUI() {
    ui.aimPanel.classList.add("hidden");
    ui.meter.classList.remove("hidden");
  }

  function hideThrowUI() {
    ui.aimPanel.classList.add("hidden");
    ui.meter.classList.add("hidden");
  }

  function startAim() {
    phase = "aim";
    rollIdx = frames[frameIdx] ? frames[frameIdx].length : 0;
    ball = { x: 0, z: 0.045, vx: 0, vz: 0, hook: 0, rolling: false, rot: 0, trail: [] };
    hook = 0;
    ui.hookSlider.value = "0";
    ui.hookReadout.textContent = "직진";
    showAimUI();
    ui.coach.textContent = "공을 좌우로 밀고, 훅을 정한 뒤 던지세요";
    updateHUD();
  }

  function startPower() {
    phase = "power";
    meter = { mode: "power", v: 0.08, dir: 1 };
    showPowerUI();
    ui.meterLabel.textContent = "노란 칸에 맞추면 딱 맞는 세기";
    ui.coach.textContent = "가운데 노란 구간에 맞춰 탭하세요";
  }

  function launch() {
    phase = "roll";
    hideThrowUI();
    bowlerKick = 1;
    const perfect = Math.abs(lockedPower - SWEET) <= SWEET_R;
    const power = perfect ? 0.82 : 0.4 + lockedPower * 0.7;
    ball = {
      x: ball.x,
      z: 0.045,
      vx: ball.x * 0.18 + hook * 0.22,
      vz: 0.74 + power * 0.58,
      hook: hook * 0.42,
      rolling: true,
      rot: 0,
      age: 0,
      trail: [],
    };
    settle = 0;
    rumble = 0;
    tone(160, 0.1, "triangle", 0.06);
    tone(90, 0.16, "sine", 0.03, 0.02);
    if (perfect) {
      say("PERFECT!", "#ffd84c");
      tone(880, 0.08, "sine", 0.04, 0.04);
    }
  }

  function collideBallPin(pin) {
    const dx = pin.x - ball.x;
    const dz = pin.z - ball.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const min = (pin.down ? pin.r * 0.62 : pin.r) + BALL_R;
    if (dist >= min) return;
    const nx = dx / dist;
    const nz = dz / dist;
    pin.x = ball.x + nx * min;
    pin.z = ball.z + nz * min;
    const speed = Math.hypot(ball.vx, ball.vz);
    const kick = pin.down ? 0.55 : 1.7;
    pin.vx += nx * speed * kick + rand(-0.02, 0.02);
    pin.vz += nz * speed * 0.85 + rand(-0.016, 0.016);
    pin.spin += (nx > 0 ? 1 : -1) * (4 + speed * 6);
    pin.fallVel = Math.max(pin.fallVel, 2.6 + speed * 2.1);
    if (!pin.down) {
      pin.down = speed > 0.22;
      impactFx(pin, speed);
    }
    ball.vx -= nx * (pin.down ? 0.02 : 0.055);
    ball.vz *= pin.down ? 0.97 : 0.91;
  }

  function collidePins() {
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i];
        const b = pins[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const min = a.r * (a.down ? 0.7 : 1) + b.r * (b.down ? 0.7 : 1);
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
        a.vx += nx * diff * 0.82;
        a.vz += nz * diff * 0.82;
        b.vx -= nx * diff * 0.82;
        b.vz -= nz * diff * 0.82;
        const rel = Math.abs(diff);
        if (rel > 0.18) {
          if (!a.down) { a.down = true; a.fallVel = Math.max(a.fallVel, 2.4); }
          if (!b.down) { b.down = true; b.fallVel = Math.max(b.fallVel, 2.4); }
          if (rel > 0.28) {
            const q = project((a.x + b.x) * 0.5, (a.z + b.z) * 0.5);
            burst(q.x, q.y - 8, 6);
            tone(140, 0.04, "square", 0.025);
          }
        }
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
    hideThrowUI();
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
    ball = { x: 0, z: 0.045, vx: 0, vz: 0, rolling: false, rot: 0, trail: [] };
    pop = null;
    particles = [];
    flashes = [];
    showOnly(null);
    startAim();
  }

  function lockPower() {
    if (phase !== "power" || lockCool > 0) return;
    lockCool = 0.2;
    if (Math.abs(meter.v - SWEET) <= SWEET_R) {
      lockedPower = SWEET;
    } else {
      lockedPower = meter.v;
    }
    tone(680, 0.05, "square", 0.04);
    launch();
  }

  function screenToLaneX(sx, sy) {
    const z = clamp((H * 0.84 - sy) / (H * 0.84 - H * 0.2), 0, 0.18);
    const s = 1 - z * 0.68;
    return clamp((sx - W * 0.5) / (W * 0.42 * s), -0.72, 0.72);
  }

  function pos(e) {
    const box = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - box.left) * (W / box.width),
      y: (e.clientY - box.top) * (H / box.height),
    };
  }

  function update(dt) {
    if (paused) return;
    shake = Math.max(0, shake - dt * 18);
    bowlerKick = Math.max(0, bowlerKick - dt * 1.8);
    lockCool = Math.max(0, lockCool - dt);
    if (pop) {
      pop.t += dt;
      if (pop.t > 0.85) pop = null;
    }

    if (phase === "power") {
      meter.v += meter.dir * 0.72 * dt;
      if (meter.v >= 1) { meter.v = 1; meter.dir = -1; }
      if (meter.v <= 0) { meter.v = 0; meter.dir = 1; }
      ui.cursor.style.left = `${meter.v * 100}%`;
      ui.cursor.classList.toggle("sweet", Math.abs(meter.v - SWEET) <= SWEET_R);
    }

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
    });
    particles = particles.filter((p) => p.life > 0);
    flashes.forEach((f) => { f.t += dt; });
    flashes = flashes.filter((f) => f.t < 0.18);

    if (phase === "roll" && ball.rolling) {
      ball.vx += ball.hook * dt * 0.85;
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt;
      const spd = Math.hypot(ball.vx, ball.vz);
      ball.rot += dt * (10 + spd * 14);
      ball.age += dt;
      ball.vz *= 1 - dt * 0.035;
      ball.trail ||= [];
      ball.trail.push({ x: ball.x, z: ball.z, life: 1 });
      if (ball.trail.length > 22) ball.trail.shift();
      ball.trail.forEach((t) => { t.life -= dt * 2.6; });
      ball.trail = ball.trail.filter((t) => t.life > 0);
      rumble -= dt;
      if (rumble <= 0 && ball.z < 0.74) {
        rumble = 0.065;
        tone(64 + ball.z * 50, 0.035, "triangle", 0.018);
      }
      if (Math.abs(ball.x) > 0.94 && ball.z < 0.76) {
        ball.x = Math.sign(ball.x) * 1.05;
        ball.vz *= 0.35;
        ball.vx *= 0.2;
        const q = project(ball.x, ball.z);
        burst(q.x, q.y, 8, "#d7c3a0");
        tone(110, 0.08, "sawtooth", 0.03);
      }
      pins.forEach(collideBallPin);
      pins.forEach((p) => {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        const damp = p.down ? 2.4 : 1.55;
        p.vx *= 1 - dt * damp;
        p.vz *= 1 - dt * damp;
        p.ang += p.spin * dt;
        p.spin *= 1 - dt * 1.2;
        p.fallVel = Math.max(0, p.fallVel - dt * 0.4);
        p.fall = clamp(p.fall + p.fallVel * dt, 0, 1);
        if (!p.down && (Math.hypot(p.vx, p.vz) > 0.12 || p.fall > 0.38)) {
          p.down = true;
          p.vx *= 1.12;
          p.fallVel = Math.max(p.fallVel, 2.8);
        }
        p.x = clamp(p.x, -1.15, 1.15);
        p.z = clamp(p.z, 0.08, 0.96);
      });
      collidePins();
      const moving = spd > 0.05 || pins.some((p) => Math.hypot(p.vx, p.vz) > 0.035 || (p.down && p.fall < 0.95));
      if (ball.z > 0.93 || !moving || ball.age > 2.6) {
        settle += dt;
        if (settle > 0.42) {
          ball.rolling = false;
          pins.forEach((p) => {
            if (Math.hypot(p.vx, p.vz) > 0.07 || p.fall > 0.45) {
              p.down = true;
              p.fall = 1;
            }
          });
          afterRoll();
        }
      }
    }
  }

  function coverImage(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;
    const s = Math.max(W / iw, H / ih);
    ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
    return true;
  }

  function drawLane() {
    if (!(raw.alley.complete && raw.alley.naturalWidth && coverImage(raw.alley))) {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#2a1824");
      bg.addColorStop(1, "#12080e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    const nearL = project(-1, 0);
    const nearR = project(1, 0);
    const farL = project(-1, 1);
    const farR = project(1, 1);
    ctx.beginPath();
    ctx.moveTo(nearL.x - 22, nearL.y + 24);
    ctx.lineTo(farL.x - 10, farL.y);
    ctx.lineTo(farR.x + 10, farL.y);
    ctx.lineTo(nearR.x + 22, nearR.y + 24);
    ctx.closePath();
    ctx.fillStyle = "rgba(42, 22, 28, 0.72)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(nearL.x, nearL.y);
    ctx.lineTo(farL.x, farL.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.closePath();
    const wood = ctx.createLinearGradient(0, farL.y, 0, nearL.y);
    wood.addColorStop(0, "#c48a48");
    wood.addColorStop(1, "#e8c48a");
    ctx.fillStyle = wood;
    ctx.fill();

    ctx.strokeStyle = "rgba(120,80,40,.22)";
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

    ctx.strokeStyle = "rgba(220,50,50,.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nearL.x, nearL.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.stroke();

    const mid = project(0, 0.02);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(mid.x - 1, mid.y - 18, 2, 18);

    ctx.fillStyle = "#221a22";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(W * 0.22, 40, W * 0.56, 84, 12);
    else ctx.rect(W * 0.22, 40, W * 0.56, 84);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 90, 120, 0.12)";
    ctx.fillRect(W * 0.34, 50, W * 0.32, 7);
  }

  function predictPath() {
    let x = ball.x;
    let z = 0.045;
    let vx = ball.x * 0.18 + hook * 0.22;
    let vz = 1.12;
    const acc = hook * 0.42;
    const pts = [];
    for (let i = 0; i < 26; i++) {
      vx += acc * 0.034;
      x += vx * 0.034;
      z += vz * 0.034;
      pts.push(project(x, z));
      if (z > 0.88 || Math.abs(x) > 1.05) break;
    }
    return pts;
  }

  function drawAimGuide() {
    if (phase !== "aim") return;
    const pts = predictPath();
    if (!pts.length) return;
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = "rgba(255, 216, 76, 0.88)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    const lastPt = pts[pts.length - 1];
    ctx.fillStyle = "#ffd84c";
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function pinSize(q) {
    return { h: 68 + 152 * q.s, w: 32 + 58 * q.s };
  }

  function drawPin(p) {
    const q = project(p.x, p.z);
    const { h, w } = pinSize(q);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.fillStyle = `rgba(0,0,0,${p.down ? 0.16 : 0.3})`;
    ctx.beginPath();
    ctx.ellipse(p.down ? 10 : 0, 5, (p.down ? h : w) * 0.34, 4 + 3 * q.s, 0, 0, Math.PI * 2);
    ctx.fill();
    const side = p.vx === 0 ? (p.ang >= 0 ? 1 : -1) : (p.vx >= 0 ? 1 : -1);
    if (p.down || p.fall > 0.18) {
      ctx.rotate(side * (0.4 + p.fall * 1.2) + p.ang * 0.12);
      const img = p.fall > 0.55 && spr.pinDown ? spr.pinDown : spr.pin;
      if (img) ctx.drawImage(img, -h * 0.46, -w * 0.38, h * 0.92, w * 0.72);
    } else {
      ctx.rotate(p.ang * 0.06);
      if (spr.pin) ctx.drawImage(spr.pin, -w / 2, -h, w, h);
      else {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.35, w * 0.35, h * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBallTrail() {
    if (!ball.trail || ball.trail.length < 2) return;
    ball.trail.forEach((t) => {
      const q = project(t.x, t.z);
      const r = (13 + 10 * q.s) * (0.35 + t.life * 0.55);
      ctx.fillStyle = `rgba(20, 16, 28, ${0.16 * t.life})`;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y + 3, r * 1.15, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBall() {
    const q = project(ball.x, ball.z);
    const r = 18 + 16 * q.s;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.22 + 0.12 * q.s})`;
    ctx.beginPath();
    ctx.ellipse(q.x + 2, q.y + r * 0.55, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(q.x, q.y - r * 0.15);
    ctx.rotate(ball.rot);
    if (spr.ball) ctx.drawImage(spr.ball, -r, -r, r * 2, r * 2);
    else {
      const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, r);
      g.addColorStop(0, "#4a4a52");
      g.addColorStop(1, "#141418");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (ball.rolling) {
      ctx.strokeStyle = `rgba(255,236,190,${0.18 + q.s * 0.12})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y + 2, r * 0.7, r * 0.18, 0, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }

  function drawBowler() {
    const img = bowlerKick > 0 ? (spr.throw || spr.bowler) : spr.bowler;
    if (!img) return;
    const kick = bowlerKick * 12;
    ctx.drawImage(img, 28, 500 - kick, 108, 128);
  }

  function drawFx() {
    flashes.forEach((f) => {
      const a = 1 - f.t / 0.18;
      ctx.fillStyle = `rgba(255,236,180,${0.28 * a})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r + f.t * 40, 0, Math.PI * 2);
      ctx.fill();
    });
    particles.forEach((p) => {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (!pop) return;
    ctx.globalAlpha = 1 - pop.t / 0.85;
    ctx.fillStyle = pop.color;
    ctx.font = '700 34px "Bagel Fat One", Jua, sans-serif';
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,.4)";
    ctx.shadowBlur = 8;
    ctx.fillText(pop.text, W / 2, 250 - pop.t * 24);
    ctx.globalAlpha = 1;
  }

  function drawWorld() {
    const items = pins.map((p) => ({ kind: "pin", p, z: p.z }));
    items.push({ kind: "ball", z: ball.z });
    items.sort((a, b) => a.z - b.z);
    drawBallTrail();
    items.forEach((it) => {
      if (it.kind === "pin") drawPin(it.p);
      else drawBall();
    });
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawLane();
    drawAimGuide();
    drawWorld();
    drawBowler();
    drawFx();
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    tryPunch("bowler", raw.bowler);
    tryPunch("throw", raw.throw);
    tryPunch("pin", raw.pin);
    tryPunch("pinDown", raw.pinDown);
    tryPunch("ball", raw.ball);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function onDown(e) {
    if (phase === "power") {
      e.preventDefault();
      lockPower();
      return;
    }
    if (phase !== "aim") return;
    const p = pos(e);
    if (p.y < 430) return;
    dragging = true;
    ball.x = screenToLaneX(p.x, p.y);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging || phase !== "aim") return;
    const p = pos(e);
    ball.x = screenToLaneX(p.x, p.y);
    e.preventDefault();
  }

  function onUp() {
    dragging = false;
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("aim-ok").addEventListener("click", () => {
    if (phase !== "aim") return;
    hookFromSlider();
    tone(500, 0.05, "square", 0.04);
    startPower();
  });
  document.getElementById("lock-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    lockPower();
  });
  ui.hookSlider.addEventListener("input", hookFromSlider);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

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
  hideThrowUI();
  if (/[?&]play=1\b/.test(location.search)) startGame();
  requestAnimationFrame(loop);
})();
