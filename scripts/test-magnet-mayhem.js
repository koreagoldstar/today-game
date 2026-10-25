/**
 * 자석 대소동 — 자동 점검 (규칙 엔진 풀이 검증 · 실제 브라우저 · 키보드 이벤트 · 터치 · 화면 크기 · 저장 · 오늘의 실험)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456              (다른 창에서)
 *   2) node scripts/test-magnet-mayhem.js     (MM_ONLY=M4,M5 처럼 골라서도 됨)
 *
 * - /api/* 는 가짜 응답 → 실제 랭킹 · 집계에 아무것도 쓰지 않는다.
 * - 저장 데이터는 테스트마다 새 브라우저 칸에서.
 * - 스테이지 풀이는 scripts/magnet-solutions.mjs 의 명령을 걸음마다 '진짜 키 이벤트'(keydown/keyup)로 바꿔
 *   게임의 입력 코드(Input)를 그대로 거치게 한다. 시간만 빠르게 (game.speed).
 * - 날짜가 바뀌는 상황은 브라우저의 Date 만 바꿔서 흉내 낸다.
 */
"use strict";

const path = require("path");
const { execFileSync } = require("child_process");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.error("playwright 가 필요해요: npm i -D playwright");
  process.exit(2);
}

const ROOT = path.join(__dirname, "..");
const BASE = process.env.MM_BASE || "http://localhost:3456";
const GAME = `${BASE}/games/magnet-mayhem/`;
const KEY = "today-magnet-mayhem-v1";
const ONLY = (process.env.MM_ONLY || "").split(",").filter(Boolean);
const want = (id) => !ONLY.length || ONLY.includes(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}

async function launch() {
  const args = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
  try {
    return await chromium.launch({ channel: "chrome", args });
  } catch (_) {
    return await chromium.launch({ args });
  }
}
const apiLog = [];
const KST = (s) => Date.parse(s + "+09:00");
async function openPage(browser, { width = 1280, height = 800, touch = false, save = null, errors = [], noStorage = false, now = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: "block" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("PAGE " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200));
  });
  p.on("response", (r) => {
    if (r.status() >= 400 && !/\/api\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await p.route("**/api/**", (r) => {
    const q = r.request();
    apiLog.push({ url: q.url(), method: q.method(), body: q.postData() || "" });
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, scores: [], items: [], today: 1, total: 1 }) });
  });
  await p.addInitScript(
    ([key, save, noStorage, now]) => {
      const RealDate = Date;
      let off = now == null ? 0 : now - RealDate.now();
      class FakeDate extends RealDate {
        constructor(...a) {
          if (a.length === 0) super(RealDate.now() + off);
          else super(...a);
        }
        static now() {
          return RealDate.now() + off;
        }
      }
      window.Date = FakeDate;
      window.__setNow = (ms) => {
        off = ms - RealDate.now();
      };
      if (noStorage) {
        Storage.prototype.setItem = () => {
          throw new Error("QuotaExceededError");
        };
        Storage.prototype.getItem = () => {
          throw new Error("SecurityError");
        };
        return;
      }
      if (sessionStorage.getItem("__mm_init")) return;
      sessionStorage.setItem("__mm_init", "1");
      if (save) localStorage.setItem(key, JSON.stringify(save));
      else localStorage.removeItem(key);
    },
    [KEY, save, noStorage, now]
  );
  p.ctx = ctx;
  return p;
}
const G = (p, fn, arg) => p.evaluate(fn, arg);
async function load(p) {
  const t0 = Date.now();
  await p.goto(GAME);
  await p.waitForFunction(() => window.MagnetMayhem && !document.getElementById("title").hidden, null, { timeout: 15000 });
  return Date.now() - t0;
}
const S = (p) =>
  G(p, () => {
    const g = window.MagnetMayhem;
    return { ...g.probe(), stack: g.ui.stack.slice(), title: !document.getElementById("title").hidden, hud: !document.getElementById("hud").hidden };
  });
async function until(p, pred, ms = 10000, label = "") {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await S(p);
    if (pred(s)) return s;
    await sleep(40);
  }
  throw new Error(`시간 초과: ${label} (${JSON.stringify(s && { mode: s.mode, stack: s.stack, t: s.t, won: s.won })})`);
}
const saved = (p) => G(p, (k) => JSON.parse(localStorage.getItem(k) || "null"), KEY);

/**
 * 풀이를 '진짜 키 이벤트'로 둔다: 걸음마다 풀이 명령이 원하는 키를 keydown/keyup 으로 window 에 보내고
 * 게임의 Input 이 그 이벤트로 만든 입력을 쓰게 한다. 이벤트 종류도 모은다.
 */
async function installKeyBot(p, which, speed) {
  await G(
    p,
    async ([which, speed]) => {
      const { makeDriver } = await import("/scripts/magnet-bot.mjs");
      const { SOLUTIONS, DAILY_SOLUTIONS } = await import("/scripts/magnet-solutions.mjs");
      const g = window.MagnetMayhem;
      const sol = typeof which === "number" ? SOLUTIONS[which] : DAILY_SOLUTIONS[which];
      const drv = makeDriver(sol);
      const inp = g.input;
      if (!inp.__take) inp.__take = inp.take.bind(inp);
      const CODE = { left: "ArrowRight", right: "ArrowRight", jump: "Space", mag: "KeyK", pole: "KeyL", use: "KeyE" };
      CODE.left = "ArrowLeft";
      const send = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
      const evs = new Set();
      window.__bot = { drv, evs, keys: 0 };
      if (!g.__he) {
        g.__he = g.handleEvents.bind(g);
        g.handleEvents = () => {
          if (window.__bot && g.G) for (const e of g.G.events || []) window.__bot.evs.add(e.type);
          return g.__he();
        };
      }
      inp.take = () => {
        if (!g.G) return inp.__take();
        const w = drv.next(g.G);
        for (const act of ["left", "right"]) {
          if (w[act] && !inp.held[act]) send("keydown", CODE[act]), window.__bot.keys++;
          if (!w[act] && inp.held[act]) send("keyup", CODE[act]);
        }
        if (w.jumpPressed) {
          if (inp.held.jump) send("keyup", CODE.jump);
          send("keydown", CODE.jump);
          window.__bot.keys++;
        } else if (!w.jump && inp.held.jump) send("keyup", CODE.jump);
        for (const [flag, act] of [["magPressed", "mag"], ["polPressed", "pole"], ["usePressed", "use"]]) {
          if (w[flag]) {
            send("keydown", CODE[act]);
            send("keyup", CODE[act]);
            window.__bot.keys++;
          }
        }
        return inp.__take();
      };
      g.speed = speed;
    },
    [which, speed]
  );
}
async function removeKeyBot(p) {
  await G(p, () => {
    const g = window.MagnetMayhem;
    if (g.input.__take) g.input.take = g.input.__take;
    g.speed = 1;
  });
}
/** 스테이지 목록 → 카드 → 안내 → 시작 (실제 클릭) */
async function openStageByUI(p, id) {
  const st = await S(p);
  if (!st.stack.includes("stages")) {
    if (!st.title) await G(p, () => window.MagnetMayhem.ui.toMenu());
    await p.click("#stages-btn");
  }
  await p.click(`#stage-grid .stage-card[data-id="${id}"]`);
  await p.waitForSelector("#intro:not([hidden])");
  const intro = await G(p, () => ({ k: document.getElementById("intro-k").textContent, h: document.getElementById("intro-h").textContent, goal: document.getElementById("intro-goal").textContent, stars: [...document.querySelectorAll("#intro-stars li")].map((l) => l.textContent), energy: document.getElementById("intro-energy").hidden ? "" : document.getElementById("intro-energy").textContent }));
  return intro;
}

(async () => {
  const browser = await launch();
  const errors = [];

  /* ---------- M1: 규칙 엔진 · 풀이 검증 (Node) ---------- */
  if (want("M1")) {
    let out = "";
    let ok = true;
    try {
      out = execFileSync(process.execPath, [path.join(ROOT, "scripts", "magnet-verify.mjs")], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      ok = false;
      out = (e.stdout || "") + (e.stderr || "");
    }
    const lines = out.split("\n").filter((l) => /^(OK|XX)/.test(l));
    check("M1", "규칙 엔진 자동 풀이: 스테이지 12개 + 오늘의 실험 7판 모두 깸 · 별 3개 · 떨어짐 0 · 물리 이상(NaN) 0", ok && /모두 통과 \(19개\)/.test(out) && lines.length === 19, (out.match(/모두 통과.*|문제 \d+개/) || [out.slice(-200)])[0]);
  }

  /* ---------- M2: 첫 화면 ---------- */
  let p = await openPage(browser, { errors });
  const ms = await load(p);
  if (want("M2")) {
    const t = await G(p, () => ({
      buttons: [...document.querySelectorAll("#title button")].map((b) => b.textContent.trim()),
      hud: !document.getElementById("hud").hidden,
      pad: !document.getElementById("pad").hidden,
      h1: document.getElementById("title-h").textContent,
      best: document.getElementById("title-best").textContent,
      home: !!document.querySelector(".today-brand, .today-home-btn"),
    }));
    check("M2", "불러오기 → 첫 화면 (플레이 · 스테이지 선택 · 오늘의 자석 실험 · 마그 꾸미기 · 도움말 · 설정 · 기록 줄 · 홈 버튼) · 게임 칸은 숨김", t.buttons.join("|") === "플레이|스테이지 선택|오늘의 자석 실험|마그 꾸미기|도움말|설정" && !t.hud && !t.pad && /자석/.test(t.h1) && /별 0 \/ 36/.test(t.best) && t.home, `${(ms / 1000).toFixed(1)}초 · ${t.buttons.join(", ")} · "${t.best}"`);
  }

  /* ---------- M3: 스테이지 목록 · 안내 ---------- */
  if (want("M3")) {
    await p.click("#stages-btn");
    const list = await G(p, () => ({ n: document.querySelectorAll("#stage-grid .stage-card").length, open: [...document.querySelectorAll("#stage-grid .stage-card:not(.locked)")].map((b) => b.dataset.id), names: [...document.querySelectorAll("#stage-grid .stage-card .nm")].map((b) => b.textContent) }));
    const intro = await openStageByUI(p, 1);
    const s0 = await S(p);
    await p.click("#intro-go");
    const s1 = await until(p, (s) => s.mode === "play" && s.hud && !s.stack.length, 4000, "시작");
    await sleep(400);
    const s2 = await S(p);
    const tip = await G(p, () => (document.getElementById("tip").hidden ? "" : document.getElementById("tip-t").textContent));
    const names = "자석과의 첫 만남|극성을 바꿔라|금속과 나무|철구 대소동|자석 발판|컨베이어 혼란|스프링 실험|두 개의 자석|움직이는 출구|에너지 위기|공장 연쇄 사고|거대 자석 장치";
    check("M3", "스테이지 목록 12칸 (기획한 이름 그대로 · 처음엔 1번만 열림) → 1번 → 안내 (이름 · 목표 · 별 기준 3개) → 시작 → 위 칸 · 첫 안내 말풍선 · 시간이 흐름", list.n === 12 && list.names.join("|") === names && list.open.join() === "1" && intro.h === "자석과의 첫 만남" && intro.goal.length > 5 && intro.stars.length === 3 && /14초/.test(intro.stars[1]) && s0.mode !== "play" && s1.id === 1 && s2.t > s1.t && /걸어요/.test(tip), `${list.n}칸 · 열린 칸 ${list.open} · "${intro.h}" · ${intro.stars.join(" / ")} · 안내 "${tip}"`);
  }

  /* ---------- M4: 실제 키보드 (Playwright 키) — 걷기 · 점프 · 자석 · 극 · 멈춤 · 다시 ---------- */
  if (want("M4")) {
    await G(p, () => window.MagnetMayhem.ui.toMenu());
    await openStageByUI(p, 1);
    await p.click("#intro-go");
    await until(p, (s) => s.mode === "play" && !s.stack.length, 4000, "1번 시작");
    const a = await S(p);
    await p.keyboard.down("ArrowRight");
    await sleep(450);
    await p.keyboard.up("ArrowRight");
    const b = await S(p);
    await p.keyboard.press("Space");
    await sleep(120);
    const jumpY = await G(p, () => window.MagnetMayhem.G.robot.y);
    await sleep(600);
    await p.keyboard.press("k");
    await sleep(150);
    const m1 = await S(p);
    const hudOn = await G(p, () => document.getElementById("hud-mag").classList.contains("on") && /켜짐/.test(document.getElementById("hud-mag-t").textContent));
    await p.keyboard.press("l");
    await sleep(120);
    const m2 = await S(p);
    const hudPole = await G(p, () => document.getElementById("hud-pole").textContent);
    await p.keyboard.press("k");
    await sleep(120);
    const m3 = await S(p);
    // 멈춤 (P) → 시간 멈춤 → Esc 로 계속
    await p.keyboard.press("p");
    await sleep(150);
    const ps = await S(p);
    await sleep(400);
    const ps2 = await S(p);
    await p.keyboard.press("Escape");
    await sleep(300);
    const pr = await S(p);
    // 2초 넘게 놀았으면 R → 확인 창 → 다시 하기 → 처음 자리 · 몸체 수 그대로
    await sleep(1500);
    const bodies0 = (await S(p)).bodies;
    await p.keyboard.press("r");
    await sleep(150);
    const c1 = await S(p);
    await p.click("#c-yes");
    await sleep(200);
    const c2 = await S(p);
    for (let i = 0; i < 5; i++) {
      await G(p, () => window.MagnetMayhem.restart());
      await sleep(60);
    }
    const c3 = await S(p);
    check("M4", "실제 키보드: → 걷기 · 스페이스 점프 · K 자석 켜기/끄기(위 칸 표시) · L 극 바꾸기 · P 멈춤(시간 멈춤) · Esc 계속 · R → 확인 창 → 다시 하기 (처음 자리 · 몸체 수 같음 · 여러 번 다시 해도 늘지 않음)", b.robot.x > a.robot.x + 40 && jumpY < b.robot.y - 20 && m1.mag.on && hudOn && m2.mag.pole !== m1.mag.pole && hudPole === m2.mag.pole && !m3.mag.on && ps.stack.join() === "pause" && ps.paused && Math.abs(ps2.t - ps.t) < 0.001 && !pr.paused && pr.stack.length === 0 && c1.stack.join() === "confirm" && c2.t < 0.5 && Math.abs(c2.robot.x - 80) < 2 && c2.bodies === bodies0 && c3.bodies === bodies0, `x ${a.robot.x.toFixed(0)}→${b.robot.x.toFixed(0)} · 점프 y ${b.robot.y.toFixed(0)}→${jumpY.toFixed(0)} · 자석 ${m1.mag.on}/${m3.mag.on} · 극 ${m1.mag.pole}→${m2.mag.pole} (위 칸 ${hudPole}) · 멈춤 ${ps.stack} 시간 ${ps.t.toFixed(2)}→${ps2.t.toFixed(2)} · R ${c1.stack} → 다시 x ${c2.robot.x.toFixed(0)} · 몸체 ${bodies0}/${c2.bodies}/${c3.bodies}`);
  }

  /* ---------- M5: 12 스테이지 모두 — 목록 → 안내 → 키 이벤트로 풀이 → 성공 · 별 3개 · 저장 ---------- */
  const evByStage = {};
  if (want("M5")) {
    await G(p, () => window.MagnetMayhem.ui.toMenu());
    const out = [];
    let okN = 0;
    let three = 0;
    for (let id = 1; id <= 12; id++) {
      try {
        await openStageByUI(p, id);
        await p.click("#intro-go");
        await until(p, (s) => s.mode === "play" && s.id === id && !s.stack.length, 4000, `${id}번 시작`);
        await installKeyBot(p, id, 4);
        const end = await until(p, (s) => s.won || s.failed, 60000, `${id}번 풀이`);
        await p.waitForSelector("#result:not([hidden])", { timeout: 8000 });
        const r = await G(p, () => ({ h: document.getElementById("r-h").textContent, stars: document.getElementById("r-stars").textContent, next: document.getElementById("r-next").textContent, final: document.getElementById("result").classList.contains("finale"), stats: document.getElementById("r-stats").textContent, evs: [...window.__bot.evs], log: window.__bot.drv.log, keys: window.__bot.keys }));
        await removeKeyBot(p);
        evByStage[id] = { evs: r.evs, final: r.final, h: r.h, stats: r.stats };
        if (end.won) okN++;
        if (r.stars === "★★★") three++;
        else out.push(`${id}번 ${r.stars} ${r.log.join(",")}`);
        if (r.keys < 3) out.push(`${id}번 키 이벤트 ${r.keys}`);
        await G(p, () => window.MagnetMayhem.ui.toMenu("stages"));
      } catch (e) {
        out.push(`${id}번 ${e.message}`);
        await removeKeyBot(p).catch(() => {});
        await G(p, () => window.MagnetMayhem.ui.toMenu("stages")).catch(() => {});
      }
    }
    const sv = await saved(p);
    const all3 = sv ? Object.values(sv.stages || {}).filter((x) => x.stars === 3).length : 0;
    check("M5", "스테이지 12개 모두: 목록 → 안내 → 풀이를 진짜 키 이벤트(keydown/keyup)로 → 출구 → 성공 화면 · 별 3개 · 기록 저장", okN === 12 && three === 12 && all3 === 12 && !out.length, `성공 ${okN}/12 · 별 3개 ${three} · 저장 ${all3}${out.length ? " · 문제 " + out.join(" | ") : ""}`);
    const need = { 2: ["switch-on", "door-open"], 4: ["switch-on", "door-open"], 6: ["lever"], 7: ["spring"], 8: ["lever"], 9: ["switch-on"], 11: ["lever", "switch-on", "door-open", "lock"], 12: ["magnet-wake", "spring", "lock", "switch-on", "pole"] };
    const miss = [];
    for (const [id, list] of Object.entries(need)) for (const e of list) if (!evByStage[id] || !evByStage[id].evs.includes(e)) miss.push(`${id}:${e}`);
    const allMag = Object.values(evByStage).every((x) => x.evs.includes("mag-on") || x.evs.includes("lever"));
    check("M5b", "장치 연쇄가 실제 플레이에서 일어남: 스위치→문 (2 · 4 · 11) · 레버 (6 · 8 · 11) · 스프링 (7 · 12) · 움직이는 출구 스위치 (9) · 거대 자석 깨어남 (12) · 칸 고정 딸깍", !miss.length && allMag, miss.length ? `빠짐 ${miss.join(", ")}` : Object.entries(evByStage).map(([k, v]) => `${k}:${v.evs.filter((e) => /switch-on|door-open|lever|spring|magnet-wake|lock/.test(e)).join("+")}`).join(" "));
    const fin = evByStage[12] || {};
    check("M5c", "12번 특별 승리: '거대 자석 장치 가동!' · 금빛 결과 카드 · 전체 별 · 전체 기어 성적 · 다음 버튼은 오늘의 실험으로", fin.final && /거대 자석 장치 가동/.test(fin.h) && /모은 별 \(전체\)/.test(fin.stats) && /숨은 기어 \(전체\)/.test(fin.stats), `"${fin.h}" · ${fin.final ? "금빛 카드" : "보통 카드"} · ${(fin.stats || "").slice(-60)}`);
    // 새로고침 뒤: 모두 ★★★ · 별 36 / 36
    await p.reload();
    await p.waitForFunction(() => window.MagnetMayhem && !document.getElementById("title").hidden);
    const after = await G(p, () => ({ best: document.getElementById("title-best").textContent, play: document.getElementById("play-btn").textContent }));
    await p.click("#stages-btn");
    const cards = await G(p, () => [...document.querySelectorAll("#stage-grid .stage-card .st")].map((x) => x.textContent));
    check("M5d", "새로고침 뒤: 12칸 모두 ★★★ · 첫 화면 '별 36 / 36' · 플레이 버튼 '다시 플레이'", cards.every((c) => c === "★★★") && /별 36 \/ 36/.test(after.best) && after.play === "다시 플레이", `${cards.join(" ")} · "${after.best}" · "${after.play}"`);
    await G(p, () => window.MagnetMayhem.ui.toMenu());
  }

  /* ---------- M6: 재질 · 극 (실제 게임 판에서 자석 켜고 움직임 재기) ---------- */
  if (want("M6")) {
    const m = await G(p, async () => {
      const g = window.MagnetMayhem;
      const sim = await import("/games/magnet-mayhem/js/sim.js?v=1");
      const L = await import("/games/magnet-mayhem/js/levels.js?v=1");
      // 재질: 같은 거리에 철 · 합금 · 나무 · 고무를 두고 0.4초 끌어당김
      const pull = (mat, shape) => {
        const G = sim.createGame({ id: 98, name: "t", start: { x: 200, y: 479 }, walls: [[0, 500, 960, 40]], objects: [{ id: "o", mat, shape, x: 330, y: shape === "ball" ? 485 : 476 }], stars: { time: 9 } });
        sim.stepGame(G, { magPressed: true });
        for (let i = 0; i < 48; i++) sim.stepGame(G, {});
        return 330 - G.objs[0].x;
      };
      const r = { iron: pull("iron", "ball"), alloy: pull("alloy", "crate"), wood: pull("wood", "crate"), rubber: pull("rubber", "ball") };
      // 극: 마그 S 일 때 N 블록은 끌려오고, N 으로 바꾸면 밀려남 (2번 판)
      const d2 = L.STAGES[1];
      const a = sim.createGame(d2);
      a.robot.x = 200;
      sim.stepGame(a, { magPressed: true });
      for (let i = 0; i < 36; i++) sim.stepGame(a, {});
      const b = sim.createGame(d2);
      b.robot.x = 200;
      sim.stepGame(b, { polPressed: true });
      sim.stepGame(b, { magPressed: true });
      for (let i = 0; i < 36; i++) sim.stepGame(b, {});
      return { r, attract: a.objs.find((o) => o.id === "nblock").x - 280, repel: b.objs.find((o) => o.id === "nblock").x - 280, poleA: a.mag.pole, poleB: b.mag.pole };
    });
    check("M6", "재질: 철 > 합금 > 0 · 나무 · 고무는 안 끌려옴 / 극: 마그 S → N 블록 끌려옴(왼쪽) · 마그 N → 밀려남(오른쪽)", m.r.iron > m.r.alloy && m.r.alloy > 2 && Math.abs(m.r.wood) < 0.5 && Math.abs(m.r.rubber) < 0.5 && m.attract < -2 && m.repel > 2 && m.poleA === "S" && m.poleB === "N", `철 ${m.r.iron.toFixed(1)} · 합금 ${m.r.alloy.toFixed(1)} · 나무 ${m.r.wood.toFixed(1)} · 고무 ${m.r.rubber.toFixed(1)} px · ${m.poleA}: ${m.attract.toFixed(1)} · ${m.poleB}: ${m.repel.toFixed(1)}`);
  }

  /* ---------- M7: 에너지 (10번) — 켜면 줄고 다시 안 참 · 다 쓰면 자석 꺼짐 · 못 깨면 실패 화면 ---------- */
  if (want("M7")) {
    await G(p, () => window.MagnetMayhem.ui.toMenu());
    const before = JSON.stringify(((await saved(p)) || { stages: {} }).stages["10"] || null);
    const locked = await G(p, () => !window.MagnetMayhem.ui.unlocked(10));
    let intro;
    if (locked) {
      // M5 를 건너뛰어 10번이 잠겨 있으면 안내 창을 바로 엶
      await G(p, async () => {
        const L = await import("/games/magnet-mayhem/js/levels.js?v=1");
        window.MagnetMayhem.ui.openIntro(L.STAGES[9]);
      });
      intro = { energy: await G(p, () => document.getElementById("intro-energy").textContent) };
    } else intro = await openStageByUI(p, 10);
    await p.click("#intro-go");
    await until(p, (s) => s.mode === "play" && s.id === 10 && !s.stack.length, 4000, "10번");
    const e0 = await S(p);
    const bar0 = await G(p, () => ({ shown: !document.getElementById("hud-energy").hidden, n: document.getElementById("hud-energy-n").textContent }));
    await G(p, () => (window.MagnetMayhem.speed = 4));
    await p.keyboard.press("k");
    await sleep(500);
    const e1 = await S(p);
    await p.keyboard.press("k");
    await sleep(500);
    const e2 = await S(p);
    await p.keyboard.press("k");
    const e3 = await until(p, (s) => !s.mag.on && s.energy <= 0.01, 10000, "에너지 바닥");
    const toast = await G(p, () => document.getElementById("toast").textContent);
    await p.keyboard.press("k");
    await sleep(100);
    const e4 = await S(p);
    const end = await until(p, (s) => s.failed, 10000, "실패");
    await p.waitForSelector("#result:not([hidden])");
    const r = await G(p, () => ({ h: document.getElementById("r-h").textContent, stars: !document.getElementById("r-stars").hidden, next: !document.getElementById("r-next").hidden }));
    const sv = await saved(p);
    await G(p, () => (window.MagnetMayhem.speed = 1));
    check("M7", "에너지(10번): 안내에 '다시 차지 않아요' · 위 칸 에너지 막대 · 켜 두면 줄고 꺼도 안 참 · 0 이 되면 자석이 저절로 꺼지고 다시 안 켜짐 · 3초 뒤 '에너지가 바닥났어요' 실패 화면 (별 · 다음 없음 · 기록은 그대로)", /다시 차지 않아요/.test(intro.energy) && bar0.shown && bar0.n === "100%" && e1.energy < e0.energy && Math.abs(e2.energy - e1.energy) < 9 && e2.energy <= e1.energy && e3.energy <= 0.01 && /에너지/.test(toast) && !e4.mag.on && end.failed === "energy" && /에너지가 바닥/.test(r.h) && !r.stars && !r.next && JSON.stringify((sv.stages || {})["10"] || null) === before, `에너지 ${e0.energy}→${e1.energy.toFixed(1)}→${e2.energy.toFixed(1)}→${e3.energy.toFixed(1)} · 알림 "${toast}" · 다시 켬 ${e4.mag.on} · "${r.h}" · 기록 그대로 ${before}`);
    await G(p, () => window.MagnetMayhem.ui.toMenu());
  }

  /* ---------- M8: 마그 꾸미기 · 소리 · 움직임 줄이기 · 도움말 ---------- */
  if (want("M8")) {
    await G(p, () => window.MagnetMayhem.ui.toMenu());
    await p.click("#skins-btn");
    const sk = await G(p, () => ({ n: document.querySelectorAll("#skin-grid .skin").length, open: document.querySelectorAll("#skin-grid .skin:not(.locked)").length, sum: document.getElementById("skins-sum").textContent }));
    await p.click("#skin-grid .skin:nth-child(2)");
    const picked = (await saved(p)).skin;
    await p.keyboard.press("Escape");
    await p.click("#help-btn");
    const help = await G(p, () => ({ mats: document.querySelectorAll("#help-mats li canvas").length, text: document.getElementById("help").textContent }));
    await p.keyboard.press("Escape");
    await p.click("#settings-btn");
    await p.uncheck("#set-sound");
    await p.check("#set-reduced");
    const st = await saved(p);
    await p.keyboard.press("Escape");
    await p.reload();
    await p.waitForFunction(() => window.MagnetMayhem && !document.getElementById("title").hidden);
    const after = await G(p, () => ({ on: window.MagnetMayhem.audio.on, reduced: window.MagnetMayhem.reduced, cls: document.body.classList.contains("reduced"), skin: window.MagnetMayhem.skin().id }));
    await openStageByUI(p, 1);
    await p.click("#intro-go");
    await until(p, (s) => s.mode === "play" && !s.stack.length, 4000);
    const btn = await G(p, () => document.getElementById("sound-btn").textContent);
    await p.click("#sound-btn");
    const on2 = await G(p, () => window.MagnetMayhem.audio.on);
    const st2 = await saved(p);
    await G(p, () => window.MagnetMayhem.ui.toMenu());
    check("M8", "마그 꾸미기 5가지 (기어 수만큼 열림 · 고르면 저장) · 도움말(재질 그림 6 · 극 규칙) · 효과음 끄기 · 움직임 줄이기 → 새로고침 뒤에도 그대로 · 게임 중 🔇 버튼으로 다시 켜기", sk.n === 5 && sk.open >= 2 && picked === "coral" && help.mats === 6 && /같은 극이면 밀려나고/.test(help.text) && st.settings.sound === false && st.settings.reduced === true && !after.on && after.reduced && after.cls && after.skin === "coral" && btn === "🔇" && on2 && st2.settings.sound === true, `꾸미기 ${sk.open}/${sk.n} 열림 "${sk.sum}" · 고름 ${picked} · 재질 그림 ${help.mats} · 저장 ${JSON.stringify(st.settings)} · 새로고침 뒤 소리 ${after.on} 줄이기 ${after.reduced} · 버튼 ${btn} → ${on2}`);
    await G(p, () => {
      const g = window.MagnetMayhem;
      g.save.setSetting("reduced", false);
      g.applyReduced();
    });
  }
  await p.ctx.close();

  /* ---------- M9: 오늘의 자석 실험 — 같은 날 같은 판 · 다음 날 다른 판 · 기록 · 공유 카드 · 순위는 직접 올릴 때만 ---------- */
  if (want("M9")) {
    const day = async (iso) => {
      const q = await openPage(browser, { errors, now: KST(iso) });
      await load(q);
      await q.click("#daily-btn");
      const info = await G(q, () => ({ date: document.getElementById("daily-date").textContent, name: document.getElementById("daily-name").textContent }));
      return { q, info };
    };
    const a = await day("2026-10-25T09:00:00");
    const b = await day("2026-10-25T23:50:00");
    const c = await day("2026-10-26T08:00:00");
    // 7일 동안 판 이름 (모음이 돌아가며 나옴)
    const week = [];
    for (let d = 25; d <= 31; d++) week.push(await G(a.q, async (iso) => (await import("/games/magnet-mayhem/js/game.js?v=1")).dailyFor(iso).id, `2026-10-${d}`));
    // a 에서 실제로 풀기
    const q = a.q;
    const did = await G(q, async () => (await import("/games/magnet-mayhem/js/game.js?v=1")).dailyFor("2026-10-25").id);
    await q.click("#daily-go");
    await until(q, (s) => s.mode === "play" && s.kind === "daily" && !s.stack.length, 4000, "실험 시작");
    const hudK = await G(q, () => document.getElementById("hud-k").textContent);
    await installKeyBot(q, did, 3);
    await until(q, (s) => s.won || s.failed, 40000, "실험 풀이");
    await q.waitForSelector("#result:not([hidden])");
    const posted0 = apiLog.filter((r) => r.method === "POST" && /\/api\/scores/.test(r.url)).length;
    const r = await G(q, () => ({ h: document.getElementById("r-h").textContent, k: document.getElementById("r-k").textContent, card: !document.getElementById("r-share-box").hidden, rank: !!document.querySelector("#r-rank form, #r-rank input, #r-rank button"), next: document.getElementById("r-next").textContent, cardPx: (() => { const c = document.getElementById("r-card"); const d = c.getContext("2d").getImageData(30, 120, 200, 40).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200) n++; return n; })() }));
    await removeKeyBot(q);
    const sv = await saved(q);
    await sleep(500);
    const posted = apiLog.filter((r) => r.method === "POST" && /\/api\/scores/.test(r.url)).length - posted0;
    // 다시 하기 → 같은 판
    await q.click("#r-retry");
    const re = await until(q, (s) => s.mode === "play" && !s.won, 4000);
    const reName = await G(q, () => window.MagnetMayhem.def.id);
    await G(q, () => window.MagnetMayhem.ui.toMenu());
    const title = await G(q, () => document.getElementById("title-best").textContent);
    const rec = sv.daily && sv.daily["2026-10-25"];
    check("M9", "오늘의 자석 실험: 같은 날은 같은 판 · 다음 날은 다른 판 · 7일 동안 여러 판이 돌아가며 · 위 칸에 날짜 · 깨면 시간 기록 저장 · 공유 카드(그림) · 순위 칸은 있지만 저절로 올리지 않음 · 다시 하기도 같은 판 · 첫 화면에 '완료'", a.info.name === b.info.name && a.info.name !== c.info.name && /10월 25일/.test(a.info.date) && /10월 26일/.test(c.info.date) && new Set(week).size >= 5 && /10월 25일/.test(hudK) && /성공/.test(r.h) && r.card && r.cardPx > 50 && r.rank && posted === 0 && rec && rec.best > 0 && rec.stars >= 1 && reName === did && /완료/.test(title), `25일 "${a.info.name}" = 25일 밤 "${b.info.name}" ≠ 26일 "${c.info.name}" · 7일 ${week.join(",")} · "${r.h}" · 카드 ${r.card} (${r.cardPx}) · 순위 칸 ${r.rank} · 저절로 보낸 점수 ${posted} · 기록 ${JSON.stringify(rec)} · 다시 ${reName} · "${title}"`);
    for (const x of [a, b, c]) await x.q.ctx.close();
  }

  /* ---------- M10: 터치 (휴대폰) — 화면 버튼 · 스크롤 안 됨 · 여러 화면 크기 ---------- */
  if (want("M10")) {
    const q = await openPage(browser, { errors, width: 390, height: 844, touch: true });
    await load(q);
    const cdp = await q.ctx.newCDPSession(q);
    const touchHold = async (sel, ms) => {
      const box = await q.locator(sel).boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await sleep(ms);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await q.tap("#stages-btn");
    await q.tap('#stage-grid .stage-card[data-id="1"]');
    await q.tap("#intro-go");
    await until(q, (s) => s.mode === "play" && !s.stack.length, 4000);
    await sleep(300);
    const lay = await G(q, () => {
      const r = (el) => el.getBoundingClientRect();
      const btns = [...document.querySelectorAll(".pad button")].filter((b) => !b.hidden && getComputedStyle(b).display !== "none").map((b) => ({ a: b.dataset.act, w: r(b).width, h: r(b).height, l: r(b).left, ri: r(b).right, t: r(b).top, b: r(b).bottom }));
      const hud = r(document.getElementById("hud"));
      const g = window.MagnetMayhem;
      const R = g.G.robot;
      const sp = g.worldToScreen(R.x, R.y);
      return { btns, hudB: hud.bottom, padShown: getComputedStyle(document.getElementById("pad")).display !== "none", W: innerWidth, H: innerHeight, sx: sp.x, sy: sp.y, follow: g.view.follow, scale: g.view.scale, docW: document.documentElement.scrollWidth };
    });
    const a = await S(q);
    await touchHold('.pad [data-act="right"]', 500);
    const b = await S(q);
    await touchHold('.pad [data-act="mag"]', 80);
    await sleep(100);
    const c = await S(q);
    await touchHold('.pad [data-act="pole"]', 80);
    await sleep(100);
    const d = await S(q);
    await touchHold('.pad [data-act="jump"]', 200);
    const jy = await G(q, () => window.MagnetMayhem.G.robot.y);
    // 화면을 손가락으로 끌어도 페이지가 움직이지 않음
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 400, id: 2 }] });
    for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y: 400 - i * 40, id: 2 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(150);
    const scroll = await G(q, () => ({ x: scrollX, y: scrollY }));
    const big = lay.btns.every((x) => x.w >= 44 && x.h >= 44);
    const inside = lay.btns.every((x) => x.l >= 0 && x.ri <= lay.W + 0.5 && x.b <= lay.H + 0.5 && x.t >= lay.hudB);
    check("M10", "휴대폰 터치(390×844): 화면 버튼(◀ ▶ 조작 · 극 · 자석 · 점프) 44px 이상 · 화면 안 · 위 칸과 안 겹침 · ▶ 누르고 있으면 걸음 · 🧲 자석 · 극 바꾸기 · 점프 · 마그가 화면 안 (따라가는 카메라) · 끌어도 화면이 밀리지 않음 · 가로 넘침 없음", lay.padShown && big && inside && b.robot.x > a.robot.x + 40 && c.mag.on && d.mag.pole !== c.mag.pole && jy < d.robot.y - 15 && lay.sx > 0 && lay.sx < lay.W && lay.sy > lay.hudB && scroll.x === 0 && scroll.y === 0 && lay.docW <= lay.W, `버튼 ${lay.btns.map((x) => `${x.a}:${Math.round(x.w)}×${Math.round(x.h)}`).join(" ")} · x ${a.robot.x.toFixed(0)}→${b.robot.x.toFixed(0)} · 자석 ${c.mag.on} · 극 ${c.mag.pole}→${d.mag.pole} · 점프 ${d.robot.y.toFixed(0)}→${jy.toFixed(0)} · 마그 화면 ${lay.sx.toFixed(0)},${lay.sy.toFixed(0)} · 따라가기 ${lay.follow} · 스크롤 ${scroll.x},${scroll.y}`);
    // 여러 화면 크기
    const sizes = [
      [390, 844, true, "휴대폰 세로"],
      [844, 390, true, "휴대폰 가로"],
      [768, 1024, true, "태블릿"],
      [1366, 768, false, "PC"],
      [360, 640, true, "작은 휴대폰"],
    ];
    const out = [];
    let all = true;
    for (const [w, h, t, nm] of sizes) {
      const v = await openPage(browser, { errors, width: w, height: h, touch: t });
      await load(v);
      const ti = await G(v, () => {
        const m = document.querySelector("#title .menu").getBoundingClientRect();
        return { ok: m.bottom <= innerHeight + 1 && m.top >= 0 && document.documentElement.scrollWidth <= innerWidth };
      });
      await G(v, () => window.MagnetMayhem.startStage(12));
      await sleep(400);
      const L = await G(v, () => {
        const g = window.MagnetMayhem;
        const r = (el) => el.getBoundingClientRect();
        const hud = r(document.getElementById("hud"));
        const pad = document.getElementById("pad");
        const padOn = getComputedStyle(pad).display !== "none";
        const padTop = padOn ? Math.min(...[...pad.querySelectorAll("button")].filter((b) => !b.hidden).map((b) => r(b).top)) : innerHeight;
        const R = g.G.robot;
        const sp = g.worldToScreen(R.x, R.bottom);
        const top = g.worldToScreen(0, 0);
        const bot = g.worldToScreen(0, 540);
        const btn = padOn ? [...pad.querySelectorAll("button")].filter((b) => !b.hidden).every((b) => r(b).width >= 44 && r(b).height >= 44) : true;
        return { hudOk: hud.right <= innerWidth + 1 && hud.bottom < innerHeight * 0.4, robotVisible: sp.x > 0 && sp.x < innerWidth && sp.y > hud.bottom && sp.y <= padTop + 4, boardTop: top.y, boardBot: bot.y, hudB: hud.bottom, padTop, follow: g.view.follow, btn, over: document.documentElement.scrollWidth > innerWidth };
      });
      const ok = ti.ok && L.hudOk && L.robotVisible && L.btn && !L.over && L.boardTop >= L.hudB - 2;
      if (!ok) all = false;
      out.push(`${nm} ${w}×${h}:${ok ? "OK" : "문제 " + JSON.stringify(L)}${L.follow ? "(따라가기)" : ""}`);
      await v.ctx.close();
    }
    check("M10b", "여러 화면 크기 (휴대폰 세로 · 가로 · 태블릿 · PC · 작은 휴대폰): 첫 화면 메뉴가 화면 안 · 판 위쪽이 위 칸에 안 가림 · 마그가 보임 · 버튼 44px 이상 · 가로 넘침 없음", all, out.join(" "));
    await q.ctx.close();
  }

  /* ---------- M11: 저장소를 못 쓰는 브라우저 ---------- */
  if (want("M11")) {
    const q = await openPage(browser, { errors, noStorage: true });
    await load(q);
    await q.click("#stages-btn");
    await q.click('#stage-grid .stage-card[data-id="1"]');
    await q.click("#intro-go");
    await until(q, (s) => s.mode === "play" && !s.stack.length, 4000);
    await installKeyBot(q, 1, 4);
    const end = await until(q, (s) => s.won || s.failed, 30000);
    await q.waitForSelector("#result:not([hidden])");
    await removeKeyBot(q);
    await G(q, () => window.MagnetMayhem.ui.toMenu("stages"));
    const open = await G(q, () => [...document.querySelectorAll("#stage-grid .stage-card:not(.locked)")].map((b) => b.dataset.id).join());
    await G(q, () => window.MagnetMayhem.ui.toMenu("settings"));
    const note = await G(q, () => document.getElementById("save-note").textContent);
    check("M11", "저장소를 못 쓰는 브라우저: 게임은 그대로 (깨기 · 결과) · 이번 방문 동안은 기억 (2번 열림) · 설정에 저장 못 한다고 안내", end.won && open === "1,2" && /저장할 수 없어요/.test(note), `깸 ${end.won} · 열린 칸 ${open} · "${note}"`);
    await q.ctx.close();
  }

  /* ---------- M12: 탭 숨기면 자동 멈춤 · 멈춤 메뉴 ---------- */
  if (want("M12")) {
    const q = await openPage(browser, { errors });
    await load(q);
    await G(q, () => window.MagnetMayhem.startStage(1));
    await sleep(300);
    await q.keyboard.down("ArrowRight");
    await sleep(100);
    await G(q, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hid = await S(q);
    const held = await G(q, () => window.MagnetMayhem.input.held.right);
    await q.keyboard.up("ArrowRight");
    await G(q, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    });
    await q.click("#p-help");
    const hp = await S(q);
    await q.keyboard.press("Escape");
    const back = await S(q);
    await q.click("#p-resume");
    const res = await S(q);
    check("M12", "탭을 숨기면 자동 멈춤 (눌린 키도 풀림) · 멈춤 → 도움말 → Esc 로 멈춤 창으로 돌아옴 → 계속하기", hid.stack.join() === "pause" && hid.paused && !held && hp.stack.join() === "pause,help" && back.stack.join() === "pause" && !res.paused && !res.stack.length, `숨김 ${hid.stack} · 키 ${held} · 도움말 ${hp.stack} → ${back.stack} → 계속 ${res.stack.length === 0}`);
    await q.ctx.close();
  }

  /* ---------- M13: 홈 · SEO · 다른 게임 ---------- */
  if (want("M13")) {
    const h = await openPage(browser, { errors });
    await h.goto(BASE + "/");
    await sleep(1500);
    await G(h, () => {
      const a = document.querySelector('a[href="/games/magnet-mayhem/"]');
      if (a) a.scrollIntoView({ block: "center" });
    });
    await h.waitForFunction(() => {
      const i = document.querySelector('a[href="/games/magnet-mayhem/"] img');
      return !i || (i.complete && i.naturalWidth > 0);
    }, null, { timeout: 5000 }).catch(() => {});
    const home = await G(h, () => {
      const a = document.querySelector('a[href="/games/magnet-mayhem/"]');
      const img = a && a.querySelector("img");
      const shelf = a ? a.closest("section") : null;
      return { card: !!a, shelf: shelf ? shelf.id : "", count: shelf ? shelf.querySelector(".cat-count").textContent : "", n: shelf ? shelf.querySelectorAll(".game-grid > a").length : 0, text: a ? a.textContent.replace(/\s+/g, " ").trim() : "", ok: img ? img.complete && img.naturalWidth === 512 : false };
    });
    if (home.card) {
      await h.click('a[href="/games/magnet-mayhem/"]');
      await h.waitForFunction(() => window.MagnetMayhem && !document.getElementById("title").hidden, null, { timeout: 10000 }).catch(() => {});
    }
    const entered = await G(h, () => !!window.MagnetMayhem);
    await h.reload();
    await h.waitForFunction(() => window.MagnetMayhem && !document.getElementById("title").hidden, null, { timeout: 10000 }).catch(() => {});
    const seo = await G(h, () => ({ about: !!document.querySelector(".seo-about h2"), canon: document.querySelector('link[rel="canonical"]').href, og: (document.querySelector('meta[property="og:image"]') || {}).content || "" }));
    const sm = await (await h.request.get(BASE + "/sitemap.xml")).text();
    const thumb = await h.request.get(BASE + "/assets/thumbs/magnet-mayhem.png");
    const games = [];
    for (const g of ["jelly-factory", "slime-lab", "suika", "tetris"]) {
      const before = errors.length;
      await h.goto(`${BASE}/games/${g}/`);
      await sleep(1800);
      games.push(`${g}:${errors.length === before ? "OK" : "오류"}`);
    }
    check("M13", "홈 퍼즐 칸 맨 앞에 카드 (개수 표시 = 실제 카드 수) · 썸네일 512 → 눌러서 들어감 · 새로고침 · 게임 소개(SEO) · canonical · og 이미지 · 사이트맵 · 다른 게임 정상", home.card && home.shelf === "cat-puzzle" && home.count === `${home.n}개` && home.ok && entered && seo.about && /magnet-mayhem/.test(seo.canon) && /thumbs\/magnet-mayhem\.png/.test(seo.og) && /games\/magnet-mayhem\//.test(sm) && thumb.ok() && games.every((x) => x.endsWith("OK")), `카드 ${home.card} (${home.shelf} · ${home.count}/${home.n}) "${home.text.slice(0, 30)}" · 썸네일 ${home.ok} · 들어감 ${entered} · 소개 ${seo.about} · 사이트맵 ${/magnet-mayhem/.test(sm)} · ${games.join(", ")}`);
    await h.ctx.close();
  }

  const leaked = apiLog.filter((r) => /today-magnet-mayhem/.test(r.body));
  const autoPost = apiLog.filter((r) => r.method === "POST" && /\/api\/scores/.test(r.url));
  check("M14", "/api 로 저장 데이터를 보내지 않음 · 저절로 보낸 점수 없음 (방문 · 플레이 수 집계만)", leaked.length === 0 && autoPost.length === 0, `/api 요청 ${apiLog.length}건 (${[...new Set(apiLog.map((r) => r.method + " " + new URL(r.url).pathname))].join(", ") || "없음"})`);
  check("M15", "콘솔 오류 · 페이지 오류 · 리소스 로딩 오류 없음", errors.length === 0, errors.length ? errors.slice(0, 6) : "없음 (/api 는 가짜 응답)");

  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
