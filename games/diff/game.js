/*
 * 다른 그림 찾기 — 오락실식: 단계마다 시간 막대, 틀리면 5초 감점, 힌트 · 시간 추가 아이템.
 * 그림은 js/scenes.js 가 코드로 그린다.
 */
import { buildStage, drawScene, SW, SH } from "./js/scenes.js?v=2";

const STAGE_COUNT = 50;
const SAVE_KEY = "today-diff-v2";
const PENALTY = 5;
const START_ITEMS = { hint: 3, time: 2 };
const MAX_ITEMS = { hint: 5, time: 3 };
const $ = (id) => document.getElementById(id);

const cvs = { L: $("left"), R: $("right") };
const base = { L: document.createElement("canvas"), R: document.createElement("canvas") };
const overlays = { title: $("title"), clear: $("clear"), over: $("over"), all: $("allclear") };

let state = "title";
let stageIndex = 0;
let st = null;
let found = new Set();
let timeLeft = 60;
let timeMax = 60;
let score = 0;
let misses = 0;
let items = { ...START_ITEMS };
let marks = []; // 틀린 곳 X
let sparks = [];
let hint = null;
let clearT = 0;
let bw = 400;
let dpr = 1;
let last = performance.now();
let save = loadSave();

function loadSave() {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    const reached = Number.isInteger(v.reached) ? Math.max(0, Math.min(STAGE_COUNT - 1, v.reached)) : 0;
    return { reached };
  } catch (_) {
    return { reached: 0 };
  }
}
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (_) {}
}

/* ---------- 소리: 맞음 · 틀림 · 클리어 ---------- */
let ac = null;
function tone(f, dur, type = "sine", gain = 0.2, delay = 0, to = 0) {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (_) {}
}
const sfx = {
  ok: () => (tone(880, 0.12, "triangle", 0.22), tone(1320, 0.22, "triangle", 0.2, 0.08)),
  bad: () => tone(180, 0.28, "square", 0.08, 0, 110),
  clear: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.18, i * 0.1)),
  tick: () => tone(1000, 0.05, "square", 0.04),
};

/* ---------- 화면 배치: 4:3 그림 두 장이 최대한 크게 ---------- */
function layout() {
  const boards = $("boards");
  const r = boards.getBoundingClientRect();
  const W = Math.max(100, r.width);
  const H = Math.max(100, r.height);
  const pad = 10; // 그림 틀 두께
  const side = Math.min((W - 10) / 2 - pad, (H - pad) * (4 / 3));
  const stack = Math.min(W - pad, ((H - 8) / 2 - pad) * (4 / 3));
  const col = stack > side;
  boards.classList.toggle("col", col);
  bw = Math.floor(Math.max(120, col ? stack : side));
  dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const k of ["L", "R"]) {
    const c = cvs[k];
    c.style.width = `${bw}px`;
    c.style.height = `${Math.round(bw * 0.75)}px`;
    c.width = Math.round(bw * dpr);
    c.height = Math.round(bw * 0.75 * dpr);
    base[k].width = c.width;
    base[k].height = c.height;
  }
  renderBase();
}

function renderBase() {
  if (!st) return;
  for (const k of ["L", "R"]) {
    const g = base[k].getContext("2d");
    g.setTransform(base[k].width / SW, 0, 0, base[k].height / SH, 0, 0);
    drawScene(g, st, k);
  }
  paint();
}

/* ---------- 매 프레임 표시 ---------- */
function paint() {
  if (!st) return;
  const t = performance.now() / 1000;
  for (const k of ["L", "R"]) {
    const c = cvs[k];
    const g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(base[k], 0, 0);
    g.setTransform(c.width / SW, 0, 0, c.height / SH, 0, 0);
    for (const d of st.diffs) {
      if (!found.has(d.id)) continue;
      const R = Math.max(30, Math.min(d.hit, 70));
      g.lineWidth = 9;
      g.strokeStyle = "#fff";
      g.beginPath();
      g.arc(d.x, d.y, R, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 5;
      g.strokeStyle = "#ff2e5b";
      g.stroke();
    }
    if (hint && !found.has(hint.d.id)) {
      const k2 = 0.6 + Math.sin(t * 9) * 0.4;
      g.globalAlpha = Math.min(1, hint.life) * k2;
      g.lineWidth = 6;
      g.strokeStyle = "#ffe066";
      g.setLineDash([12, 10]);
      g.beginPath();
      g.arc(hint.d.x, hint.d.y, Math.max(46, hint.d.hit) * (1.15 - k2 * 0.15), 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }
    for (const m of marks) {
      g.globalAlpha = Math.max(0, Math.min(1, m.life * 2));
      g.lineCap = "round";
      for (const [lw, col] of [[14, "#fff"], [8, "#ff2e5b"]]) {
        g.lineWidth = lw;
        g.strokeStyle = col;
        g.beginPath();
        g.moveTo(m.x - 20, m.y - 20);
        g.lineTo(m.x + 20, m.y + 20);
        g.moveTo(m.x + 20, m.y - 20);
        g.lineTo(m.x - 20, m.y + 20);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    for (const s of sparks) {
      g.globalAlpha = Math.max(0, s.life * 2);
      g.fillStyle = s.c;
      g.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const q = i % 2 ? s.r * 0.45 : s.r;
        g.lineTo(s.x + Math.cos(a) * q, s.y + Math.sin(a) * q);
      }
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    if (state === "clear" || state === "all") {
      const k3 = Math.min(1, clearT * 4);
      g.save();
      g.translate(SW / 2, SH / 2);
      g.rotate(-0.12);
      g.scale(0.6 + k3 * 0.4, 0.6 + k3 * 0.4);
      g.globalAlpha = k3;
      g.font = "400 120px 'Bagel Fat One', Jua, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 22;
      g.strokeStyle = "#3d2a7a";
      g.strokeText("CLEAR!", 0, 0);
      g.fillStyle = "#ffd23f";
      g.fillText("CLEAR!", 0, 0);
      g.restore();
    }
  }
}

/* ---------- HUD ---------- */
function hud() {
  $("hud-stage").textContent = String(stageIndex + 1);
  $("hud-score").textContent = score.toLocaleString("ko-KR");
  const dots = $("dots");
  if (dots.children.length !== st.need) dots.innerHTML = Array.from({ length: st.need }, () => "<i></i>").join("");
  [...dots.children].forEach((d, i) => d.classList.toggle("on", i < found.size));
  $("count-hint").textContent = String(items.hint);
  $("count-time").textContent = String(items.time);
  const left = st.diffs.length - found.size;
  $("item-hint").disabled = state !== "play" || items.hint <= 0 || left <= 0 || !!hint;
  $("item-time").disabled = state !== "play" || items.time <= 0;
  $("hint").textContent = `${st.name} · 다른 곳 ${left}개 남음`;
}
function timeHud() {
  const k = Math.max(0, timeLeft / timeMax);
  $("time-fill").style.transform = `scaleX(${k})`;
  $("time-txt").textContent = String(Math.ceil(Math.max(0, timeLeft)));
  const bar = $("time-fill").parentElement;
  bar.classList.toggle("warn", timeLeft <= timeMax * 0.35 && timeLeft > 10);
  bar.classList.toggle("hot", timeLeft <= 10);
}
function minusFx(txt) {
  const el = document.createElement("span");
  el.className = "minus";
  el.textContent = txt;
  $("time-fill").parentElement.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

/* ---------- 진행 ---------- */
function showOverlay(key) {
  Object.entries(overlays).forEach(([k, el]) => el.classList.toggle("hidden", k !== key));
}

function startStage(idx, resetAll) {
  stageIndex = idx;
  if (resetAll) {
    score = 0;
    items = { ...START_ITEMS };
    if (window.TodayGameRank) TodayGameRank.reset();
  }
  st = buildStage(idx);
  found = new Set();
  marks = [];
  sparks = [];
  hint = null;
  misses = 0;
  timeMax = Math.round(50 + st.need * 8 - Math.min(10, idx * 0.25));
  timeLeft = timeMax;
  state = "play";
  showOverlay(null);
  renderBase();
  hud();
  timeHud();
}

function tapAt(side, clientX, clientY) {
  if (state !== "play") return;
  const r = cvs[side].getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * SW;
  const y = ((clientY - r.top) / r.height) * SH;
  let hit = null;
  let best = Infinity;
  for (const d of st.diffs) {
    if (found.has(d.id)) continue;
    const dist = Math.hypot(d.x - x, d.y - y);
    if (dist < d.hit && dist < best) {
      best = dist;
      hit = d;
    }
  }
  if (hit) {
    found.add(hit.id);
    if (hint && hint.d === hit) hint = null;
    for (let i = 0; i < 12; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 90;
      sparks.push({ x: hit.x, y: hit.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7 + Math.random() * 8, life: 0.6, c: ["#ffd23f", "#fff", "#ff8fab"][i % 3] });
    }
    sfx.ok();
    hud();
    if (found.size >= st.diffs.length) stageClear();
    return;
  }
  // 이미 찾은 곳을 다시 누른 건 실수가 아니다
  if (st.diffs.some((d) => found.has(d.id) && Math.hypot(d.x - x, d.y - y) < d.hit)) return;
  misses += 1;
  timeLeft -= PENALTY;
  marks.push({ x, y, life: 0.9 });
  minusFx(`-${PENALTY}초`);
  sfx.bad();
  const b = cvs[side].parentElement;
  b.classList.remove("shake");
  void b.offsetWidth;
  b.classList.add("shake");
  timeHud();
}

function stageClear() {
  state = "clear";
  clearT = 0;
  const secs = Math.ceil(Math.max(0, timeLeft));
  const base = st.diffs.length * 100;
  const tb = secs * 10;
  const perfect = misses === 0 ? 300 : 0;
  const gain = base + tb + perfect;
  score += gain;
  const got = [];
  if (items.hint < MAX_ITEMS.hint) {
    items.hint += 1;
    got.push("힌트 +1");
  }
  if ((stageIndex + 1) % 3 === 0 && items.time < MAX_ITEMS.time) {
    items.time += 1;
    got.push("시간 +1");
  }
  save.reached = Math.max(save.reached, Math.min(STAGE_COUNT - 1, stageIndex + 1));
  persist();
  sfx.clear();
  hud();
  $("clear-title").textContent = misses === 0 ? "PERFECT!" : "스테이지 클리어!";
  $("clear-tally").innerHTML = [
    [`찾은 차이 ${st.diffs.length}개`, base],
    [`남은 시간 ${secs}초`, tb],
    ...(perfect ? [["실수 없음", perfect]] : []),
  ]
    .map(([k, v]) => `<li><span>${k}</span><b>+${v.toLocaleString("ko-KR")}</b></li>`)
    .join("") + `<li class="sum"><span>총점</span><b>${score.toLocaleString("ko-KR")}</b></li>`;
  $("clear-detail").textContent = got.length ? `보너스: ${got.join(" · ")}` : "";
  const last = stageIndex >= STAGE_COUNT - 1;
  setTimeout(() => {
    if (state !== "clear") return;
    if (last) {
      state = "all";
      $("all-detail").textContent = `총점 ${score.toLocaleString("ko-KR")}점!`;
      showOverlay("all");
      openRank($("allclear"));
    } else showOverlay("clear");
  }, 1100);
}

function timeUp() {
  state = "over";
  $("over-detail").textContent = `STAGE ${stageIndex + 1} · 찾은 차이 ${found.size}/${st.diffs.length} · 점수 ${score.toLocaleString("ko-KR")}`;
  showOverlay("over");
  openRank($("over"));
  hud();
}

function openRank(parent) {
  if (!window.TodayGameRank || score <= 0) return;
  TodayGameRank.mount({ gameId: "diff", gameTitle: "다른 그림 찾기", formParent: parent });
  TodayGameRank.open(score);
}

function useHint() {
  if (state !== "play" || items.hint <= 0 || hint) return;
  const left = st.diffs.filter((d) => !found.has(d.id));
  if (!left.length) return;
  items.hint -= 1;
  hint = { d: left[Math.floor(Math.random() * left.length)], life: 3 };
  tone(660, 0.18, "triangle", 0.15);
  hud();
}
function useTime() {
  if (state !== "play" || items.time <= 0) return;
  items.time -= 1;
  timeLeft = Math.min(timeMax + 15, timeLeft + 15);
  timeMax = Math.max(timeMax, timeLeft);
  tone(990, 0.15, "triangle", 0.15);
  hud();
  timeHud();
}

/* ---------- 틀 ---------- */
let lastTick = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let anim = marks.length || sparks.length || hint || state === "clear" || state === "all";
  if (state === "play") {
    timeLeft -= dt;
    timeHud();
    if (timeLeft <= 5 && Math.ceil(timeLeft) !== lastTick) {
      lastTick = Math.ceil(timeLeft);
      sfx.tick();
    }
    if (timeLeft <= 0) timeUp();
  }
  if (state === "clear" || state === "all") clearT += dt;
  marks.forEach((m) => (m.life -= dt));
  marks = marks.filter((m) => m.life > 0);
  sparks.forEach((s) => {
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  });
  sparks = sparks.filter((s) => s.life > 0);
  if (hint) {
    hint.life -= dt;
    if (hint.life <= 0) {
      hint = null;
      hud();
    }
  }
  if (anim) paint();
  requestAnimationFrame(loop);
}

for (const k of ["L", "R"]) {
  cvs[k].addEventListener("pointerdown", (e) => {
    e.preventDefault();
    tapAt(k, e.clientX, e.clientY);
    paint();
  });
}
$("item-hint").addEventListener("click", useHint);
$("item-time").addEventListener("click", useTime);
$("start-btn").addEventListener("click", () => startStage(0, true));
$("cont-btn").addEventListener("click", () => startStage(save.reached, true));
$("retry-btn").addEventListener("click", () => startStage(stageIndex, true));
$("again-btn").addEventListener("click", () => startStage(0, true));
$("next-btn").addEventListener("click", () => startStage(stageIndex + 1, false));
window.addEventListener("resize", layout);

if (save.reached > 0) {
  const b = $("cont-btn");
  b.classList.remove("hidden");
  b.textContent = `이어하기 (${save.reached + 1}단계)`;
}
// 첫 화면 그림: 1단계 장면
{
  const c = $("title-art");
  const g = c.getContext("2d");
  g.scale(c.width / SW, c.height / SH);
  try {
    document.fonts.load("20px Jua", "가나다ABC12").finally(() => drawScene(g, buildStage(0), "L"));
  } catch (_) {
    drawScene(g, buildStage(0), "L");
  }
}
st = buildStage(0);
showOverlay("title");
layout();
hud();
timeHud();
requestAnimationFrame(loop);
try {
  document.fonts.load("28px Jua", "가나다ABC12").then(renderBase);
} catch (_) {}

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
      last = performance.now();
      return true;
    },
  });
}

// 점검용
window.SpotDiff = {
  get state() {
    return state;
  },
  get stage() {
    return st;
  },
  get found() {
    return found.size;
  },
  get timeLeft() {
    return timeLeft;
  },
  get score() {
    return score;
  },
  start: (i) => startStage(i, true),
  setTime: (v) => (timeLeft = v),
};
