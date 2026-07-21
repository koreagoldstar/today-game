(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const MAX_LEAN = 1;
  const BEST_KEY = "serving-king-best";
  const NAME_KEY = "serving-king-name";
  const GAME_ID = "stork-stride";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const sprites = {
    waiter: null,
    plates: null,
    plate: null,
    guest: null,
  };

  const overlays = {
    title: document.getElementById("title"),
    over: document.getElementById("over"),
  };
  const controls = document.getElementById("controls");
  const meter = document.getElementById("balance-meter");
  const needle = document.getElementById("meter-needle");
  const moodLabel = document.getElementById("mood-label");
  const toastEl = document.getElementById("toast");
  const hudDist = document.getElementById("hud-dist");
  const hudBest = document.getElementById("hud-best");
  const hudCombo = document.getElementById("hud-combo");

  let state = "title";
  let distance = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0");
  let combo = 0;
  let maxCombo = 0;
  let lean = 0;
  let leanVel = 0;
  let visualLean = 0;
  let held = { left: false, right: false };
  let stepPhase = 0;
  let fallDir = 0;
  let fallT = 0;
  let shards = [];
  let guests = [];
  let lamps = [];
  let warnT = 0;
  let bumpT = 0;
  let bumpDir = 0;
  let nextEvent = 7;
  let floorOff = 0;
  let lastMile = 0;
  let toastT = 0;
  let last = 0;
  let raf = 0;
  let titleT = 0;
  let plateCount = 5;
  let submitted = false;
  let lastRank = { rankDay: null, rankWeek: null };
  let lastScore = 0;

  const nameInput = document.getElementById("player-name");
  const shareBtn = document.getElementById("share-rank-btn");
  if (nameInput) nameInput.value = localStorage.getItem(NAME_KEY) || "";

  hudBest.textContent = String(Math.floor(best));

  function isPunchBg(r, g, b, a) {
    if (a < 20) return true;
    if (r > 185 && b > 175 && g < 150 && r + b > g * 2.1) return true;
    if (r > 200 && b > 190 && g < 165 && Math.abs(r - b) < 90) return true;
    return false;
  }

  /** 마젠타 크로마 키 + 크롭 */
  function punchBg(img) {
    const c = document.createElement("canvas");
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, w, h);
    const d = data.data;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        d[i + 3] = 0;
        continue;
      }
      const px = (i / 4) % w;
      const py = ((i / 4) / w) | 0;
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
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d").drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
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
    const [waiter, plates, plate, guest] = await Promise.all([
      loadImg("assets/serving-waiter.png"),
      loadImg("assets/serving-plates.png"),
      loadImg("assets/serving-plate.png"),
      loadImg("assets/serving-guest.png"),
    ]);
    if (waiter) sprites.waiter = punchBg(waiter);
    if (plates) sprites.plates = punchBg(plates);
    if (plate) sprites.plate = punchBg(plate);
    if (guest) sprites.guest = punchBg(guest);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    toastT = 1.2;
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
    controls.classList.toggle("hidden", name != null);
    meter.classList.toggle("hidden", name != null);
  }

  /** 무한 난이도: 초반부터 조금 빡세고, 거리 따라 계속 상승 (상한만 부드럽게) */
  function difficulty() {
    const soft = distance / 42;
    const late = Math.max(0, distance - 40) / 55;
    return Math.min(2.6, soft + late * 0.85);
  }

  function resetLamps() {
    lamps = [];
    for (let i = 0; i < 4; i += 1) {
      lamps.push({ x: 40 + i * 100, phase: i * 0.7 });
    }
  }

  function resetRun() {
    distance = 0;
    combo = 0;
    maxCombo = 0;
    lean = 0;
    leanVel = 0;
    visualLean = 0;
    stepPhase = 0;
    fallDir = 0;
    fallT = 0;
    shards = [];
    guests = [];
    warnT = 0;
    bumpT = 0;
    bumpDir = 0;
    nextEvent = 5 + Math.random() * 2.5;
    floorOff = 0;
    lastMile = 0;
    plateCount = 5;
    submitted = false;
    lastRank = { rankDay: null, rankWeek: null };
    lastScore = 0;
    resetLamps();
    updateHud();
    const rankMsg = document.getElementById("rank-msg");
    if (rankMsg) rankMsg.textContent = "";
    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn) submitBtn.disabled = false;
    if (shareBtn) shareBtn.hidden = true;
  }

  function mood() {
    if (warnT > 0) return bumpDir > 0 ? "손님 앞쪽!" : "손님 뒤쪽!";
    const a = Math.abs(lean);
    if (a < 0.18) return "안정적인 서빙";
    if (a < 0.4) return "살짝 기울음";
    return lean > 0 ? "앞으로 기운다" : "뒤로 기운다";
  }

  function updateHud() {
    hudDist.textContent = String(Math.floor(distance));
    hudBest.textContent = String(Math.floor(best));
    hudCombo.textContent = String(Math.floor(combo));
    needle.style.left = `${clamp(((visualLean / MAX_LEAN) * 0.5 + 0.5) * 100, 4, 96)}%`;
    moodLabel.textContent = mood();
  }

  function startGame() {
    state = "play";
    showOverlay(null);
    resetRun();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function fail() {
    if (state !== "play") return;
    state = "falling";
    fallDir = lean >= 0 ? 1 : -1;
    fallT = 0;
    // plate shards
    for (let i = 0; i < 18; i += 1) {
      const a = Math.random() * Math.PI * 2;
      shards.push({
        x: W * 0.5 + (Math.random() - 0.5) * 30,
        y: H * 0.34,
        vx: Math.cos(a) * (40 + Math.random() * 140),
        vy: Math.sin(a) * (40 + Math.random() * 80) - 80,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8,
        life: 0.8 + Math.random() * 0.4,
        max: 1.2,
        w: 10 + Math.random() * 14,
        color: Math.random() > 0.5 ? "#f3e6d8" : "#c45c4a",
      });
    }
  }

  function endGame() {
    state = "over";
    lastScore = Math.floor(distance);
    if (distance > best) {
      best = distance;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    showOverlay("over");
    document.getElementById("over-title").textContent =
      distance >= best - 0.05 ? "오늘의 서빙왕" : "접시가 떨어졌어요";
    document.getElementById("over-detail").innerHTML =
      `<b>${distance.toFixed(1)}m</b> 이동 · 최고 콤보 <b>${Math.floor(maxCombo)}</b><br/>기록 <b>${best.toFixed(1)}m</b>`;
  }

  function update(dt) {
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) toastEl.classList.remove("on");
    }

    // 화면 표시용 기울기만 부드럽게 (떨림 방지)
    visualLean = lerp(visualLean, lean, 1 - Math.pow(0.0008, dt));

    if (state === "title") {
      titleT += dt;
      lean = Math.sin(titleT * 0.7) * 0.16;
      stepPhase += dt * 1.6;
      return;
    }

    if (state === "falling") {
      fallT += dt;
      lean += fallDir * dt * 2.2;
      updateShards(dt);
      if (fallT > 0.85) endGame();
      return;
    }

    if (state !== "play") return;

    const diff = difficulty();
    const speed = 1.35 + Math.min(diff, 2.2) * 1.85;
    distance += speed * dt;
    floorOff += speed * 42 * dt;
    stepPhase += dt * (2.5 + Math.min(diff, 2) * 1.8);
    plateCount = 5 + Math.min(6, Math.floor(distance / 16));

    // 이벤트: 경고 → 짧은 충격 (거리 갈수록 더 자주)
    nextEvent -= dt;
    if (nextEvent <= 0 && warnT <= 0 && bumpT <= 0) {
      bumpDir = Math.random() > 0.5 ? 1 : -1;
      warnT = Math.max(0.7, 1.15 - diff * 0.12);
      toast(bumpDir > 0 ? "앞쪽 손님!" : "뒤쪽 손님!");
      guests.push({
        x: bumpDir > 0 ? W * 0.72 : W * 0.28,
        y: H + 20,
        dir: bumpDir,
      });
    }
    if (warnT > 0) {
      warnT -= dt;
      if (warnT <= 0) bumpT = 0.4 + Math.min(0.25, diff * 0.08);
    }
    if (bumpT > 0) {
      bumpT -= dt;
      leanVel += bumpDir * (1.65 + diff * 0.95) * dt;
      if (bumpT <= 0) {
        const gap = Math.max(2.8, 6.2 - diff * 1.1);
        nextEvent = gap + Math.random() * Math.max(1.2, 3.2 - diff * 0.5);
      }
    }

    guests.forEach((g) => {
      g.y -= speed * 50 * dt;
    });
    guests = guests.filter((g) => g.y > H * 0.45);

    const steer = (held.right ? 1 : 0) + (held.left ? -1 : 0);
    const tip = lean * (0.55 + Math.min(diff, 2.2) * 1.55);
    const noise = (Math.random() - 0.5) * (0.18 + Math.min(diff, 2.2) * 0.72);
    leanVel += (tip + noise) * dt;
    leanVel += steer * 7.2 * dt;
    leanVel = clamp(leanVel, -2.35, 2.35);
    leanVel *= Math.pow(0.07, dt);
    lean += leanVel * dt;

    if (Math.abs(lean) < 0.2) {
      combo += dt;
      if (combo > maxCombo) maxCombo = combo;
    } else {
      combo = Math.max(0, combo - dt * 1.6);
    }

    const mile = Math.floor(distance / 15) * 15;
    if (mile >= 15 && mile > lastMile) {
      lastMile = mile;
      toast(`${mile}m 서빙`);
    }

    if (Math.abs(lean) >= MAX_LEAN) {
      fail();
      return;
    }

    updateShards(dt);
    updateHud();
  }

  function updateShards(dt) {
    shards = shards.filter((s) => {
      s.life -= dt;
      if (s.life <= 0) return false;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 420 * dt;
      s.rot += s.spin * dt;
      return true;
    });
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawRoom() {
    // luxury restaurant: warm gold walls, chandeliers, red carpet (thumb)
    const wall = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    wall.addColorStop(0, "#4a3428");
    wall.addColorStop(0.45, "#3a2820");
    wall.addColorStop(1, "#2a1c16");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);

    // arched window / alcove silhouettes
    ctx.fillStyle = "rgba(60, 40, 30, 0.55)";
    [[70, 90], [320, 90]].forEach(([ax, ay]) => {
      ctx.beginPath();
      ctx.moveTo(ax - 36, ay + 80);
      ctx.lineTo(ax - 36, ay + 20);
      ctx.quadraticCurveTo(ax, ay - 30, ax + 36, ay + 20);
      ctx.lineTo(ax + 36, ay + 80);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 200, 120, 0.12)";
      ctx.beginPath();
      ctx.moveTo(ax - 28, ay + 70);
      ctx.lineTo(ax - 28, ay + 22);
      ctx.quadraticCurveTo(ax, ay - 10, ax + 28, ay + 22);
      ctx.lineTo(ax + 28, ay + 70);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(60, 40, 30, 0.55)";
    });

    // chandelier glow + bokeh
    const glow = ctx.createRadialGradient(W * 0.5, 36, 8, W * 0.5, 50, 220);
    glow.addColorStop(0, "rgba(255,220,140,0.45)");
    glow.addColorStop(0.4, "rgba(255,180,90,0.18)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 260);

    // tiered chandelier body
    ctx.fillStyle = "#e8c878";
    ctx.beginPath();
    ctx.ellipse(W / 2, 42, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4a850";
    ctx.beginPath();
    ctx.ellipse(W / 2, 54, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,240,180,0.7)";
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(W / 2 + i * 14, 58, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // bokeh orbs
    [[80, 70, 10], [310, 80, 8], [160, 50, 6], [240, 55, 7]].forEach(([bx, by, br]) => {
      const b = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      b.addColorStop(0, "rgba(255,230,160,0.55)");
      b.addColorStop(1, "rgba(255,200,100,0)");
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    });

    // side booths / red chairs hint
    ctx.fillStyle = "rgba(140, 40, 40, 0.5)";
    roundRect(6, H * 0.34, 54, 88, 14);
    ctx.fill();
    roundRect(W - 60, H * 0.34, 54, 88, 14);
    ctx.fill();
    ctx.fillStyle = "rgba(255,200,120,0.15)";
    roundRect(14, H * 0.36, 38, 16, 6);
    ctx.fill();
    roundRect(W - 52, H * 0.36, 38, 16, 6);
    ctx.fill();

    // hanging table lamps
    lamps.forEach((L) => {
      const x = ((L.x - floorOff * 0.15) % (W + 80)) + 20;
      const sway = Math.sin(performance.now() * 0.001 + L.phase) * 3;
      ctx.strokeStyle = "rgba(255,230,200,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + sway, 48);
      ctx.stroke();
      const shade = ctx.createLinearGradient(x + sway, 48, x + sway, 66);
      shade.addColorStop(0, "#f5e6c8");
      shade.addColorStop(1, "#c89040");
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(x + sway - 14, 48);
      ctx.lineTo(x + sway + 14, 48);
      ctx.lineTo(x + sway + 9, 64);
      ctx.lineTo(x + sway - 9, 64);
      ctx.closePath();
      ctx.fill();
      const lg = ctx.createRadialGradient(x + sway, 72, 2, x + sway, 72, 48);
      lg.addColorStop(0, "rgba(255,200,120,0.4)");
      lg.addColorStop(1, "transparent");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(x + sway, 72, 48, 0, Math.PI * 2);
      ctx.fill();
    });

    // floor + red carpet with gold circles
    const floorY = H * 0.58;
    const fg = ctx.createLinearGradient(0, floorY, 0, H);
    fg.addColorStop(0, "#3a2820");
    fg.addColorStop(1, "#1a120e");
    ctx.fillStyle = fg;
    ctx.fillRect(0, floorY, W, H - floorY);

    const carpet = ctx.createLinearGradient(W * 0.22, floorY, W * 0.78, floorY);
    carpet.addColorStop(0, "#6a2020");
    carpet.addColorStop(0.5, "#a83838");
    carpet.addColorStop(1, "#6a2020");
    ctx.fillStyle = carpet;
    ctx.fillRect(W * 0.22, floorY, W * 0.56, H - floorY);
    ctx.fillStyle = "rgba(255,210,120,0.55)";
    ctx.fillRect(W * 0.22, floorY, 4, H - floorY);
    ctx.fillRect(W * 0.78 - 4, floorY, 4, H - floorY);

    // gold circular patterns on carpet
    ctx.strokeStyle = "rgba(255, 200, 100, 0.28)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i += 1) {
      const cy = floorY + 40 + i * 50 - (floorOff * 0.2) % 50;
      ctx.beginPath();
      ctx.arc(W / 2, cy, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, cy, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGuest(g) {
    const y = g.y;
    if (y < H * 0.5 || y > H) return;
    ctx.save();
    ctx.translate(g.x, y);
    ctx.globalAlpha = clamp((y - H * 0.5) / 40, 0.35, 1);
    if (sprites.guest) {
      const img = sprites.guest;
      const s = 92;
      ctx.drawImage(img, -s / 2, -s + 10, s, s);
    } else {
      ctx.fillStyle = "#f0e0d0";
      ctx.beginPath();
      ctx.arc(0, -40, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e07040";
      ctx.beginPath();
      ctx.ellipse(-10, -42, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd76a";
      ctx.beginPath();
      ctx.moveTo(-8, -62);
      ctx.lineTo(0, -72);
      ctx.lineTo(8, -62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c04040";
      roundRect(-18, -28, 36, 30, 8);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWaiter() {
    const cx = W * 0.5;
    const cy = H * 0.5;
    const ang = visualLean * 0.72 + (state === "falling" ? fallDir * fallT * 1.1 : 0);
    const step = Math.sin(stepPhase);
    const bob = Math.abs(step) * 3;

    ctx.save();
    ctx.translate(cx, cy + 70);

    // soft shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(visualLean * 10, 82, 52, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // body lean + walk bob
    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(ang * 0.35);

    if (sprites.waiter) {
      const img = sprites.waiter;
      const ww = 138;
      const wh = 168;
      ctx.drawImage(img, -ww / 2, -wh + 88, ww, wh);
    } else {
      // fallback stick figure — black tuxedo
      ctx.fillStyle = "#1a1818";
      roundRect(-22, -36, 44, 58, 12);
      ctx.fill();
      ctx.fillStyle = "#f0e0d0";
      ctx.beginPath();
      ctx.arc(0, -52, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.fillRect(-10, -42, 20, 6);
    }

    // tray + plates (extra tilt for readability)
    ctx.save();
    ctx.translate(4, -92);
    ctx.rotate(ang * 1.25);

    if (state !== "falling" || fallT < 0.12) {
      if (sprites.plates) {
        const pw = 110 + plateCount * 2;
        const ph = 110 + plateCount * 4;
        const wobble = Math.sin(stepPhase * 1.4) * 2;
        ctx.drawImage(sprites.plates, -pw / 2 + wobble, -ph + 18, pw, ph);
      } else {
        for (let i = 0; i < plateCount; i += 1) {
          const py = -10 - i * 11;
          const wobble = Math.sin(i * 0.9 + visualLean * 3) * i * 0.6;
          drawPlate(wobble * visualLean * 8, py, 34 - i * 0.4, i);
        }
      }
    }

    ctx.restore();
    ctx.restore();
    ctx.restore();
  }

  function drawPlate(x, y, r, idx) {
    if (sprites.plate) {
      const s = r * 2.1;
      ctx.drawImage(sprites.plate, x - s / 2, y - s * 0.55, s, s);
      return;
    }
    const colors = ["#f3e6d8", "#efe0d0", "#f7eee4"];
    ctx.fillStyle = colors[idx % 3];
    ctx.beginPath();
    ctx.ellipse(x, y, r, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(26,20,16,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawShards() {
    shards.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = clamp(s.life / s.max, 0, 1);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      if (sprites.plate) {
        const sz = s.w * 2.2;
        ctx.drawImage(sprites.plate, -sz / 2, -sz / 2, sz, sz);
      } else {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(-s.w * 0.5, 0);
        ctx.lineTo(s.w * 0.3, -4);
        ctx.lineTo(s.w * 0.5, 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function drawFrame() {
    drawRoom();
    guests.forEach(drawGuest);
    drawWaiter();
    drawShards();

    if (warnT > 0 || bumpT > 0) {
      ctx.fillStyle = bumpT > 0 ? "rgba(196,92,74,0.8)" : "rgba(240,160,90,0.55)";
      ctx.font = '600 14px "IBM Plex Sans KR", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(bumpDir > 0 ? "› › ›" : "‹ ‹ ‹", W / 2, H * 0.2);
    }
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    drawFrame();
    if (state === "play" || state === "falling" || state === "title") {
      raf = requestAnimationFrame(loop);
    }
  }

  function setHeld(dir, on) {
    if (dir < 0) held.left = on;
    if (dir > 0) held.right = on;
    document.querySelectorAll(".pad").forEach((btn) => {
      const d = Number(btn.dataset.dir);
      btn.classList.toggle("held", d < 0 ? held.left : held.right);
    });
  }

  function bind() {
    document.getElementById("start-btn").addEventListener("click", startGame);
    document.getElementById("retry-btn").addEventListener("click", startGame);

    const rankForm = document.getElementById("rank-form");
    if (rankForm) {
      rankForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitted) return;
        const name = String(nameInput.value || "").trim();
        if (name.length < 2 || name.length > 8) {
          document.getElementById("rank-msg").textContent = "이름은 2~8자로 적어 주세요";
          return;
        }
        localStorage.setItem(NAME_KEY, name);
        const btn = document.getElementById("submit-btn");
        btn.disabled = true;
        document.getElementById("rank-msg").textContent = "등록 중…";
        if (!window.TodayScores) {
          document.getElementById("rank-msg").textContent = "랭킹 모듈을 불러오지 못했어요";
          btn.disabled = false;
          return;
        }
        const res = await window.TodayScores.submitScore(GAME_ID, name, lastScore);
        if (res.ok) {
          submitted = true;
          lastRank = { rankDay: res.rankDay || res.rank, rankWeek: res.rankWeek };
          document.getElementById("rank-msg").textContent =
            window.TodayScores.formatRankMessage
              ? window.TodayScores.formatRankMessage(res)
              : res.rank
                ? `오늘 ${res.rank}위에 등록됐어요!`
                : "등록 완료!";
          if (shareBtn) shareBtn.hidden = false;
          if (window.TodayGameRank && TodayGameRank.afterSubmit) {
            await TodayGameRank.afterSubmit({
              gameId: GAME_ID,
              gameTitle: "서빙왕",
              name,
              score: lastScore,
              rankDay: lastRank.rankDay,
              label: `${lastScore.toLocaleString("ko-KR")}m`,
            });
          }
        } else {
          document.getElementById("rank-msg").textContent = "등록 실패 · 다시 시도해 주세요";
          btn.disabled = false;
        }
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        if (!window.TodayScores || !window.TodayScores.shareRank) return;
        const name = String(nameInput.value || "").trim() || "나";
        const result = await window.TodayScores.shareRank({
          gameTitle: "서빙왕",
          name,
          score: lastScore,
          rankDay: lastRank.rankDay,
          rankWeek: lastRank.rankWeek,
          url: "https://www.todaygame.co.kr/games/stork-stride/",
        });
        const msg = document.getElementById("rank-msg");
        msg.textContent = window.TodayScores.formatShareResult
          ? window.TodayScores.formatShareResult(result)
          : result.mode === "copy"
            ? "복사됨! 카톡·SNS에 붙여넣기 하세요"
            : result.error === "cancel"
              ? "공유를 취소했어요"
              : !result.ok
                ? "공유에 실패했어요"
                : "";
        if (result.mode === "share") msg.textContent = "";
      });
    }

    document.querySelectorAll(".pad").forEach((btn) => {
      const dir = Number(btn.dataset.dir);
      const down = (e) => {
        e.preventDefault();
        setHeld(dir, true);
      };
      const up = (e) => {
        e.preventDefault();
        setHeld(dir, false);
      };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointerleave", up);
      btn.addEventListener("pointercancel", up);
    });

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") setHeld(-1, true);
      if (e.code === "ArrowRight" || e.code === "KeyD") setHeld(1, true);
      if (e.code === "Space" && (state === "title" || state === "over")) {
        e.preventDefault();
        startGame();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") setHeld(-1, false);
      if (e.code === "ArrowRight" || e.code === "KeyD") setHeld(1, false);
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (state !== "play") return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      setHeld(x < 0.5 ? -1 : 1, true);
    });
    const clearTouch = () => {
      setHeld(-1, false);
      setHeld(1, false);
    };
    canvas.addEventListener("pointerup", clearTouch);
    canvas.addEventListener("pointercancel", clearTouch);
  }

  bind();
  resetLamps();
  loadAssets().then(() => {
    showOverlay("title");
    last = performance.now();
    raf = requestAnimationFrame(loop);
  });

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
