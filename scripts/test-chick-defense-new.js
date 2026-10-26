/**
 * NEW 둥지디펜스 — 브라우저 자동 점검 (실제 화면 · 마우스 · 키보드 · 터치 · 저장 · 여러 화면 크기)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456                 (다른 창에서)
 *   2) node scripts/test-chick-defense-new.js     (CD_ONLY=N4,N5 처럼 골라서도 됨)
 *
 * - /api/* 는 가짜 응답 → 실제 랭킹 · 집계에 아무것도 쓰지 않는다.
 * - 저장 데이터는 테스트마다 새 브라우저 칸에서 (필요하면 미리 넣음).
 * - 3D 라 헤드리스 크롬을 GPU(d3d11)로 띄운다.
 * - 전투 규칙(150 웨이브 · 능력 · 보스)은 Node 점검(cdn-tests / cdn-verify)이 따로 확인하고, 여기서는 화면과 입력 · 흐름을 본다.
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
const BASE = process.env.CD_BASE || "http://localhost:3456";
const GAME = `${BASE}/games/chick-defense-new/`;
const KEY = "today-chick-defense-new-v1";
const ONLY = (process.env.CD_ONLY || "").split(",").filter(Boolean);
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
const errors = [];
async function openPage(browser, { width = 1280, height = 760, touch = false, save = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: "block" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("PAGE " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 240));
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
    ([key, save]) => {
      if (sessionStorage.getItem("__cd_init")) return;
      sessionStorage.setItem("__cd_init", "1");
      if (save) localStorage.setItem(key, JSON.stringify(save));
      else localStorage.removeItem(key);
    },
    [KEY, save]
  );
  p.ctx = ctx;
  return p;
}
const G = (p, fn, arg) => p.evaluate(fn, arg);
async function load(p) {
  const t0 = Date.now();
  await p.goto(GAME);
  await p.waitForFunction(() => window.NestDefense && document.getElementById("loading").hidden && !document.getElementById("title").hidden, null, { timeout: 25000 });
  return Date.now() - t0;
}
const S = (p) => G(p, () => window.NestDefense.probe());
async function until(p, pred, ms = 15000, label = "") {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await S(p);
    if (pred(s)) return s;
    await sleep(60);
  }
  throw new Error(`시간 초과: ${label} ${JSON.stringify(s && { mode: s.mode, phase: s.phase, local: s.local, stack: s.stack })}`);
}
/** 칸 → 화면 좌표 (실제 클릭 자리) */
const cellXY = (p, cx, cz) =>
  G(
    p,
    ([cx, cz]) => {
      const g = window.NestDefense;
      const r = g.canvas.getBoundingClientRect();
      const s = g.stage.project(cx + 0.5, g.sim.map.height(cx, cz), cz + 0.5);
      return { x: r.left + s.x, y: r.top + s.y };
    },
    [cx, cz]
  );
/** 길 가까이 비어 있는 설치 칸 (s: 길 거리) */
const freeCell = (p, s0 = 6) =>
  G(
    p,
    (s0) => {
      const sim = window.NestDefense.sim;
      const pt = sim.map.paths[0].at(s0);
      let best = null;
      let bd = 99;
      for (let z = 0; z < 14; z++)
        for (let x = 0; x < 22; x++) {
          if (!sim.map.buildable(x, z) || sim.towerAt(x, z)) continue;
          const d = Math.hypot(x + 0.5 - pt.x, z + 0.5 - pt.z);
          if (d < bd) {
            bd = d;
            best = [x, z];
          }
        }
      return best;
    },
    s0
  );
const pathCell = (p) => G(p, () => {
  const sim = window.NestDefense.sim;
  for (let z = 0; z < 14; z++) for (let x = 0; x < 22; x++) if (sim.map.cell(x, z) === 1) return [x, z];
  return null;
});
async function startW1(p, difficulty) {
  await p.click("#go-campaign");
  await p.waitForSelector("#worlds:not([hidden])");
  if (difficulty) await p.click(`#diff button:has-text("${difficulty}")`);
  await p.click("#world-grid .wcard.w1");
  await until(p, (s) => s.mode === "play" && s.world === 1, 8000, "W1 시작");
  await sleep(300);
}
/** 화면 위 모든 창 닫기 (새 적 안내 · 튜토리얼 말풍선 등) */
const closeModals = (p) => G(p, () => window.NestDefense.ui.closeAll());

(async () => {
  const browser = await launch();

  /* ---------- N1: Node 점검 (규칙 · 데이터 · 자동 플레이) ---------- */
  if (want("N1")) {
    const run = (f, args = []) => {
      try {
        return { ok: true, out: execFileSync(process.execPath, ["--no-warnings", path.join(ROOT, "scripts", f), ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 900000 }) };
      } catch (e) {
        return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
      }
    };
    const t = run("cdn-tests.mjs");
    const v = run("cdn-verify.mjs");
    const tl = (t.out.match(/(\d+)\/(\d+) PASS/) || [])[0];
    check("N1", "Node: 규칙 단위 점검 (능력 30 · 보스 10 · 환경 · 저장 · 결정성) + 150 웨이브 데이터 검증 + 5개 월드 자동 플레이", t.ok && v.ok && /모두 통과/.test(v.out), `${tl} · 데이터 ${(v.out.match(/웨이브 \d+ \/ 150/) || ["?"])[0]} · ${v.ok ? "자동 플레이 통과" : v.out.slice(-300)}`);
  }

  /* ---------- N2: 불러오기 · 첫 화면 ---------- */
  let p = await openPage(browser);
  const ms = await load(p);
  if (want("N2")) {
    const t = await G(p, () => ({
      buttons: [...document.querySelectorAll("#title .menu button")].map((b) => b.textContent.trim()),
      hud: !document.getElementById("hud").hidden,
      bar: !document.getElementById("tbar").hidden,
      rec: document.getElementById("title-rec").textContent,
      home: !!document.querySelector(".today-home-btn, .today-brand"),
      demo: window.NestDefense.sim && window.NestDefense.sim.towers.length,
      seo: !!document.querySelector("#title .seo-about"),
    }));
    check("N2", "불러오기 → 첫 화면 (캠페인 · 무한 생존(잠김) · 도움말 · 설정 · 기록) · 뒤에 구경용 전투 · 게임 칸 숨김 · 홈 버튼 · 게임 소개", t.buttons[0].startsWith("캠페인") && /무한 생존 🔒/.test(t.buttons[1]) && t.buttons.length === 4 && !t.hud && !t.bar && /0 \/ 5/.test(t.rec) && t.home && t.demo > 3 && t.seo, `${(ms / 1000).toFixed(1)}초 · ${t.buttons.join(" | ")} · "${t.rec}"`);
  }

  /* ---------- N3: 월드 고르기 → 시작 · 튜토리얼 ---------- */
  if (want("N3")) {
    await p.click("#go-campaign");
    await p.waitForSelector("#worlds:not([hidden])");
    const w = await G(p, () => ({ n: document.querySelectorAll("#world-grid .wcard").length, open: [...document.querySelectorAll("#world-grid .wcard:not(.locked)")].length, diff: [...document.querySelectorAll("#diff button")].map((b) => b.textContent), on: document.querySelector("#diff button.on").textContent }));
    await p.click("#world-grid .wcard.w1");
    const s = await until(p, (s) => s.mode === "play", 8000, "시작");
    await sleep(300);
    const h = await G(p, () => ({ wave: document.getElementById("hud-wave").textContent, coins: document.getElementById("hud-coins").textContent, nest: document.getElementById("hud-nest").textContent, tip: document.getElementById("tip").hidden ? "" : document.getElementById("tip-t").textContent, btn: document.getElementById("next-btn").textContent, peek: document.getElementById("peek").textContent, towers: document.querySelectorAll("#tower-list .tw").length }));
    check("N3", "월드 고르기: 5칸 (처음엔 1월드만) · 난이도 쉬움/보통/어려움 → 햇살 초원 시작 · 위 칸 (웨이브 1/30 · 코인 220 · 둥지 20) · 타워 6 · 다음 웨이브 미리 보기 · 튜토리얼 안내", w.n === 5 && w.open === 1 && w.diff.join() === "쉬움,보통,어려움" && w.on === "보통" && s.local === 1 && h.wave === "웨이브 1 / 30" && h.coins === "220" && h.nest === "20" && h.towers === 6 && /슬라임/.test(h.peek) && /궁수/.test(h.tip) && /웨이브 1 시작/.test(h.btn), `${w.open}/${w.n} 열림 · ${h.wave} · 코인 ${h.coins} · 미리 보기 "${h.peek}" · 안내 "${h.tip}"`);
  }

  /* ---------- N4: 실제 마우스로 설치 (미리 보기 · 안 되는 칸 · 코인) ---------- */
  if (want("N4")) {
    await p.click('#tower-list .tw[data-type="archer"]');
    const c = await freeCell(p, 6);
    const xy = await cellXY(p, c[0], c[1]);
    await p.mouse.move(xy.x, xy.y);
    await sleep(100);
    const ghost = await G(p, () => ({ on: window.NestDefense.view.ghostOn, ring: window.NestDefense.view.rangeRing.visible, grid: window.NestDefense.view.gridMesh.visible, tip: document.getElementById("tip-t").textContent }));
    const bad = await pathCell(p);
    const bxy = await cellXY(p, bad[0], bad[1]);
    const c0 = (await S(p)).coins;
    await p.mouse.click(bxy.x, bxy.y);
    await sleep(120);
    const afterBad = await S(p);
    const toast = await G(p, () => document.getElementById("toast").textContent);
    await p.mouse.click(xy.x, xy.y);
    await sleep(150);
    const afterOk = await S(p);
    const placed = await G(p, ([x, z]) => !!window.NestDefense.sim.towerAt(x, z), c);
    check("N4", "마우스: 궁수 고르기 → 칸 위에 올리면 유령 타워 · 사거리 · 설치 칸 격자 → 길 위 클릭은 '세울 수 없어요' (코인 그대로) → 빈 칸 클릭 = 설치 (코인 -60)", ghost.on && ghost.ring && ghost.grid && afterBad.coins === c0 && /세울 수 없어요/.test(toast) && placed && afterOk.coins === c0 - 60 && afterOk.towers === 1 && !afterOk.placing, `유령 ${ghost.on} · 길 클릭 코인 ${c0}→${afterBad.coins} "${toast}" · 설치 ${placed} 코인 ${afterOk.coins}`);
  }

  /* ---------- N5: 웨이브 → 공격 · 처치 · 보상 → 카드 ---------- */
  if (want("N5")) {
    const c2 = await freeCell(p, 14);
    await p.click('#tower-list .tw[data-type="archer"]');
    const xy2 = await cellXY(p, c2[0], c2[1]);
    await p.mouse.click(xy2.x, xy2.y);
    await sleep(100);
    const before = await G(p, () => ({ coins: window.NestDefense.sim.coins, kills: window.NestDefense.sim.stats.kills }));
    await p.click("#next-btn");
    await until(p, (s) => s.phase === "wave", 3000, "웨이브 시작");
    await G(p, () => (window.NestDefense.speed = 3));
    let sawNum = false;
    let sawProj = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      const v = await G(p, () => ({ ph: window.NestDefense.sim.phase, nums: document.querySelectorAll("#nums .dmg").length, proj: window.NestDefense.view.projM.size }));
      if (v.nums) sawNum = true;
      if (v.proj) sawProj = true;
      if (v.ph !== "wave") break;
      await sleep(100);
    }
    await p.waitForSelector("#cards:not([hidden])", { timeout: 5000 });
    const cards = await G(p, () => ({ n: document.querySelectorAll("#card-row .tcard").length, k: document.getElementById("cards-k").textContent, names: [...document.querySelectorAll("#card-row .tcard b")].map((b) => b.textContent), kills: window.NestDefense.sim.stats.kills, coins: window.NestDefense.sim.coins }));
    await p.click("#card-row .tcard:nth-child(1)");
    const after = await until(p, (s) => s.phase === "build" && !s.stack.length, 4000, "카드 고른 뒤");
    const sim = await G(p, () => ({ cards: Object.values(window.NestDefense.sim.cards).reduce((a, b) => a + b, 0), shield: window.NestDefense.sim.nest.shield, hp: window.NestDefense.sim.nest.hp }));
    check("N5", "▶ 시작 → 화살이 날아가고(투사체) 피해 숫자 · 몬스터 처치 · 코인 보상 → 웨이브 끝 '클리어 · 보너스' → 전술 카드 3장 (실제 클릭) → 고르면 정비 · 웨이브 2", sawProj && sawNum && cards.n === 3 && /웨이브 1 클리어/.test(cards.k) && cards.kills > before.kills && cards.coins > before.coins && after.local === 2 && (sim.cards === 1 || sim.shield > 0 || sim.hp >= 20), `투사체 ${sawProj} · 숫자 ${sawNum} · 처치 ${cards.kills} · 코인 ${before.coins}→${cards.coins} · 카드 ${cards.names.join("/")} → 웨이브 ${after.local}`);
  }

  /* ---------- N6: 타워 정보 · 강화 · 진화 · 표적 · 판매 (화면 수치 = 전투 수치) ---------- */
  if (want("N6")) {
    await closeModals(p);
    // 앞에서 고른 카드(할인 · 판매가)가 비용을 바꾸지 않게
    await G(p, () => {
      const s = window.NestDefense.sim;
      s.coins = 2000;
      s.mods.discount = 0;
      s.mods.refund = 0.7;
    });
    const t = await G(p, () => window.NestDefense.sim.towers[0]);
    const xy = await cellXY(p, t.cx, t.cz);
    await p.mouse.click(xy.x, xy.y);
    await p.waitForSelector("#tpanel:not([hidden])");
    const read = () =>
      G(p, () => {
        const g = window.NestDefense;
        const t = g.sim.tower(g.sel);
        const st = (window.__st = null);
        void st;
        return {
          name: document.getElementById("tp-name").textContent,
          tier: document.getElementById("tp-tier").textContent,
          stats: document.getElementById("tp-stats").textContent,
          acts: [...document.querySelectorAll("#tp-actions .act")].map((b) => b.textContent),
          coins: g.sim.coins,
          level: t && t.level,
          evo: t && t.evo,
          target: t && t.target,
        };
      });
    const a = await read();
    const real = await G(p, async () => {
      const m = await import("/games/chick-defense-new/js/sim/towers.js");
      const g = window.NestDefense;
      const s = m.statsOf(g.sim, g.sim.tower(g.sel));
      return { dmg: Math.round(s.dmg * 10) / 10, rate: Math.round(s.rate * 10) / 10, range: Math.round(s.range * 10) / 10 };
    });
    await p.click("#tp-actions .act:nth-child(1)");
    await sleep(100);
    const b = await read();
    await p.click("#tp-actions .act:nth-child(1)");
    await sleep(100);
    const c = await read();
    await p.click('#tp-actions .act.evo:has-text("관통")');
    await sleep(100);
    const d = await read();
    await p.click('#tp-target button:has-text("가장 센 적")');
    const e = await read();
    const sellV = await G(p, () => window.NestDefense.sim.sellValue(window.NestDefense.sim.tower(window.NestDefense.sel)));
    await p.click("#tp-actions .act.sell");
    await sleep(100);
    const f = await S(p);
    const statsOk = a.stats.includes(String(real.dmg)) && a.stats.includes(String(real.rate)) && a.stats.includes(String(real.range));
    check("N6", "타워를 누르면 정보 창 (공격력 · 공격속도 · 사거리 = 실제 전투 값 · 다음 단계 →) → 강화 2번 (★→★★★ · 비용 정확) → 진화 2갈래 중 '관통 궁수' → 표적 '가장 센 적' → 팔기 = 쓴 코인 70%", statsOk && /→/.test(a.stats) && a.coins - b.coins === 45 && b.coins - c.coins === 75 && c.acts.filter((x) => /진화/.test(x)).length === 2 && d.evo === "pierce" && /관통 궁수/.test(d.name) && d.coins === c.coins - 160 && e.target === "strong" && f.coins === d.coins + sellV && sellV === Math.floor((60 + 45 + 75 + 160) * 0.7), `실제 ${JSON.stringify(real)} · 강화 -${a.coins - b.coins} -${b.coins - c.coins} · 진화 ${c.acts.filter((x) => /진화/.test(x)).length}갈래 → ${d.name} · 판매 +${sellV}`);
  }

  /* ---------- N7: 멈춤 · 배속 · 키보드 ---------- */
  if (want("N7")) {
    await closeModals(p);
    const c = await freeCell(p, 6);
    await G(p, ([x, z]) => window.NestDefense.sim.place("archer", x, z), c);
    await p.keyboard.press("Space");
    await until(p, (s) => s.phase === "wave", 3000, "스페이스 시작");
    await G(p, () => (window.NestDefense.speed = 1));
    await sleep(600);
    await p.keyboard.press("p");
    await sleep(150);
    const p1 = await S(p);
    await sleep(700);
    const p2 = await S(p);
    const shown = await G(p, () => !document.getElementById("pause").hidden);
    await p.click("#p-resume");
    await sleep(100);
    const r0 = await S(p);
    await sleep(1000);
    const r1 = await S(p);
    await p.click("#speed-btn");
    await p.click("#speed-btn");
    const sp = await S(p);
    const q0 = await S(p);
    await sleep(1000);
    const q1 = await S(p);
    await p.keyboard.press("f");
    const sp2 = await S(p);
    await p.keyboard.press("1");
    const k1 = await S(p);
    await p.keyboard.press("Escape");
    const k2 = await S(p);
    const r1d = r1.t - r0.t;
    const q1d = q1.t - q0.t;
    check("N7", "멈춤 (P) → 전투 시간 그대로 · 계속 → 다시 흐름 · 배속 버튼 ×1→×2→×3 (실제로 약 3배 빠름) · F 배속 · 숫자 1 = 궁수 고르기 · Esc 취소", shown && p1.paused && Math.abs(p2.t - p1.t) < 1e-6 && r1d > 0.8 && sp.speed === 3 && q1d > r1d * 2.2 && sp2.speed === 1 && k1.placing === "archer" && !k2.placing, `멈춤 ${p1.t.toFixed(2)}→${p2.t.toFixed(2)} · 1초에 ×1 ${r1d.toFixed(2)}초 · ×3 ${q1d.toFixed(2)}초 · F → ×${sp2.speed} · 키 1 → ${k1.placing}`);
  }

  /* ---------- N8: 처음부터 다시 (상태 초기화 · 3D 물체 정리) ---------- */
  if (want("N8")) {
    await G(p, () => window.NestDefense.ui.openPause());
    await p.click("#p-restart");
    await p.click("#c-yes");
    const s = await until(p, (s) => s.mode === "play" && s.phase === "build" && !s.stack.length, 4000, "다시 시작");
    await sleep(300);
    const v = await S(p);
    check("N8", "멈춤 → '이 월드 처음부터' → 확인 → 웨이브 1 · 코인 220 · 타워 0 · 적 0 · 3D 장면에 남은 적/투사체/구역 없음", s.local === 1 && v.coins === 220 && v.towers === 0 && v.enemies === 0 && v.view.enemies === 0 && v.view.proj === 0 && v.view.zones === 0 && v.view.towers === 0, `웨이브 ${s.local} · 코인 ${v.coins} · 타워 ${v.towers} · 장면 ${JSON.stringify(v.view)}`);
  }

  /* ---------- N9: 저장 → 새로고침 → 이어서 하기 ---------- */
  if (want("N9")) {
    await closeModals(p);
    const c = await freeCell(p, 6);
    const c2 = await freeCell(p, 20);
    await G(p, ([a, b]) => {
      const s = window.NestDefense.sim;
      s.place("archer", a[0], a[1]);
      s.place("ice", b[0], b[1]);
    }, [c, c2]);
    await G(p, () => window.NestDefense.startWave());
    await G(p, () => (window.NestDefense.speed = 3));
    await until(p, (s) => s.phase !== "wave", 60000, "웨이브 1 끝");
    await p.waitForSelector("#cards:not([hidden])");
    await p.click("#card-row .tcard:nth-child(2)");
    await until(p, (s) => s.phase === "build", 3000);
    const before = await S(p);
    await p.reload();
    await p.waitForFunction(() => window.NestDefense && document.getElementById("loading").hidden);
    await p.click("#go-campaign");
    await p.waitForSelector("#run-box:not([hidden])");
    const box = await G(p, () => document.getElementById("run-t").textContent);
    await p.click("#run-go");
    const after = await until(p, (s) => s.mode === "play", 6000, "이어서");
    check("N9", "정비 시간마다 저장 → 새로고침 → 월드 화면 '저장된 판 (웨이브 2)' → 이어서 하기 = 같은 웨이브 · 코인 · 타워 · 둥지", /웨이브 2/.test(box) && after.local === before.local && after.coins === before.coins && after.towers === before.towers && after.nest.hp === before.nest.hp, `"${box}" · 전 ${JSON.stringify({ l: before.local, c: before.coins, t: before.towers })} → 후 ${JSON.stringify({ l: after.local, c: after.coins, t: after.towers })}`);
  }

  /* ---------- N10: 보스 등장 · 막대 · 페이즈 ---------- */
  if (want("N10")) {
    await closeModals(p);
    await G(p, () => {
      const g = window.NestDefense;
      g.sim.local = 10;
      g.saveRun();
    });
    await G(p, () => window.NestDefense.startWave());
    await G(p, () => (window.NestDefense.speed = 1));
    await until(p, (s) => s.enemies > 0, 8000, "보스 출현");
    const boss = await G(p, async () => {
      await new Promise((r) => setTimeout(r, 400));
      const g = window.NestDefense;
      const e = g.sim.enemies.find((q) => q.boss);
      return { name: e && e.def.name, banner: !document.getElementById("banner").hidden ? document.getElementById("banner-h").textContent : "", bar: !document.getElementById("bossbar").hidden, barName: document.getElementById("boss-name").textContent, focus: !!g.stage.focus };
    });
    await G(p, () => {
      const e = window.NestDefense.sim.enemies.find((q) => q.boss);
      e.hp = e.maxHp * 0.4;
    });
    await sleep(500);
    const ph = await G(p, () => ({ phase: document.getElementById("boss-phase").textContent, toast: document.getElementById("toast").textContent }));
    check("N10", "10번 웨이브: 보스 '왕관 슬라임 등장!' 알림 · 카메라가 보스로 다가감(건너뛰기 가능) · 위쪽 보스 체력 막대 · 체력 반 아래면 '페이즈 2' + 알림", boss.name === "왕관 슬라임" && /왕관 슬라임 등장/.test(boss.banner) && boss.bar && /왕관 슬라임/.test(boss.barName) && boss.focus && /페이즈 2/.test(ph.phase) && /패턴이 바뀌어요|화났어요/.test(ph.toast), `${boss.banner} · 막대 ${boss.bar} "${boss.barName}" · ${ph.phase} · "${ph.toast}"`);
  }

  /* ---------- N11: 패배 → 이 웨이브 다시 / 월드 클리어 → 다음 월드 ---------- */
  if (want("N11")) {
    await G(p, () => {
      const s = window.NestDefense.sim;
      s.nest.hp = 1;
      s.nest.shield = 0;
      for (const e of s.enemies) e.s = e.path.length - 0.05;
    });
    await p.waitForSelector("#result:not([hidden])", { timeout: 10000 });
    const lose = await G(p, () => ({ h: document.getElementById("r-h").textContent, next: document.getElementById("r-next").hidden ? "" : document.getElementById("r-next").textContent }));
    await p.click("#r-next");
    const back = await until(p, (s) => s.mode === "play" && s.phase === "build", 6000, "이 웨이브 다시");
    // 월드 클리어 흉내: 30번 웨이브를 시작해 몬스터를 모두 처치
    await closeModals(p);
    await G(p, () => {
      const s = window.NestDefense.sim;
      s.local = 30;
      s.coins = 9999;
    });
    await G(p, () => window.NestDefense.startWave());
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const ph = await G(p, async () => {
        const m = await import("/games/chick-defense-new/js/sim/enemies.js");
        const s = window.NestDefense.sim;
        s.spawnQ = s.spawnQ.map((q) => ({ ...q, at: 0 }));
        for (const e of s.enemies) m.kill(s, e);
        return s.phase;
      });
      if (ph !== "wave") break;
      await sleep(100);
    }
    await p.waitForSelector("#result:not([hidden])", { timeout: 8000 });
    const win = await G(p, () => ({ h: document.getElementById("r-h").textContent, stars: document.getElementById("r-stars").textContent, next: document.getElementById("r-next").textContent, note: document.getElementById("r-note").textContent, save: JSON.parse(localStorage.getItem("today-chick-defense-new-v1")) }));
    await p.click("#r-next");
    const w2 = await until(p, (s) => s.mode === "play" && s.world === 2, 8000, "다음 월드");
    check("N11", "둥지 0 → '둥지가 무너졌어요' → '이 웨이브 다시' = 그 웨이브 정비부터 · 30번을 깨면 '월드 클리어!' 별 · '다음 월드' (2월드 열림 저장) → 버섯 숲 시작", /무너졌어요/.test(lose.h) && lose.next === "이 웨이브 다시" && back.local === 10 && /월드 클리어/.test(win.h) && /★/.test(win.stars) && win.next === "다음 월드" && win.save.campaign.unlocked === 2 && win.save.campaign.worlds["1"].cleared && w2.world === 2, `패배 "${lose.h}" → ${back.local}번 · "${win.h}" ${win.stars} "${win.note}" · 열린 월드 ${win.save.campaign.unlocked}`);
  }
  await p.ctx.close();

  /* ---------- N12: 모든 몬스터 · 보스 · 타워 모델이 그려지고 움직임 ---------- */
  if (want("N12")) {
    const q = await openPage(browser);
    await load(q);
    const out = await G(q, async () => {
      const g = window.NestDefense;
      const E = await import("/games/chick-defense-new/js/data/enemies.js");
      const M = await import("/games/chick-defense-new/js/render/enemyModels.js");
      const T = await import("/games/chick-defense-new/js/data/towers.js");
      const en = await import("/games/chick-defense-new/js/sim/enemies.js");
      const types = [...Object.keys(E.ENEMIES), ...Object.keys(E.BOSSES)];
      const noModel = types.filter((t) => !M.MODELS[t]);
      const drawn = new Set();
      const bad = [];
      for (let w = 1; w <= 5; w++) {
        g.startRun({ world: w, mode: "campaign", seed: 3 });
        g.ui.closeAll();
        const s = g.sim;
        s.startWave();
        s.spawnQ = [];
        const list = types.filter((t) => (E.ENEMIES[t] || E.BOSSES[t]).world === w || ((E.ENEMIES[t] || {}).world === 0 && w === 1));
        list.forEach((t, i) => {
          const e = en.spawnEnemy(s, t, { s: 2 + i * 1.2, awakened: true });
          if (e) {
            s.byIdMap.set(e.id, e);
            e.speedBase = 0;
            e.illusion = false; // 그림 점검 동안은 맞아도 안 사라지게
            e.hp = e.maxHp = 1e9;
          }
        });
        // 타워: 이 월드에 모든 종류 · 진화
        let k = 0;
        for (const ty of T.TOWER_ORDER)
          for (const evo of [null, ...Object.keys(T.TOWERS[ty].evos)]) {
            for (let z = 0; z < 14; z++)
              for (let x = 0; x < 22; x++) {
                if (k > 40) break;
                if (!s.map.buildable(x, z) || s.towerAt(x, z)) continue;
                s.coins = 1e6;
                const t = s.place(ty, x, z);
                if (t) {
                  s.upgrade(t.id);
                  s.upgrade(t.id);
                  if (evo) s.evolve(t.id, evo);
                  k++;
                  x = 99;
                  z = 99;
                }
              }
          }
        for (const t of s.towers) t.cd = 1e9;
        for (let f = 0; f < 30; f++) {
          s.step(1 / 60);
          g.view.update(s, 1 / 60, null);
          g.stage.render();
          for (const e of s.enemies) if (g.view.ens.has(e.id)) drawn.add(e.type);
        }
        if (g.view.tws.size !== s.towers.length) bad.push(`월드 ${w} 타워 ${g.view.tws.size}/${s.towers.length}`);
      }
      return { total: types.length, noModel, drawn: drawn.size, missing: types.filter((t) => !drawn.has(t)), bad };
    });
    check("N12", "모델: 몬스터 · 꼬마 · 분신 · 보스 모두 고유 모델이 있고 5개 월드 장면에서 실제로 그려지고 움직임 · 타워 6종 × (기본 + 진화 2) 모두 그려짐", out.noModel.length === 0 && out.missing.length === 0 && !out.bad.length, `${out.drawn}/${out.total} 종류 그려짐${out.missing.length ? " · 빠짐 " + out.missing : ""}${out.bad.length ? " · " + out.bad : ""}`);
    await q.ctx.close();
  }

  /* ---------- N13: 휴대폰 터치 (설치 확인 버튼 · 타워 누르기 · 화면 안 밀림) ---------- */
  if (want("N13")) {
    const q = await openPage(browser, { width: 390, height: 844, touch: true });
    await load(q);
    await q.tap("#go-campaign");
    await q.tap("#world-grid .wcard.w1");
    await until(q, (s) => s.mode === "play", 8000);
    await sleep(400);
    await closeModals(q);
    await q.tap('#tower-list .tw[data-type="archer"]');
    const c = await freeCell(q, 6);
    const xy = await cellXY(q, c[0], c[1]);
    await q.touchscreen.tap(xy.x, xy.y);
    await sleep(200);
    const pend = await G(q, () => ({ ok: !document.getElementById("place-ok").hidden, towers: window.NestDefense.sim.towers.length }));
    await q.tap("#place-yes");
    await sleep(150);
    const placed = await S(q);
    const xy2 = await cellXY(q, c[0], c[1]);
    await q.touchscreen.tap(xy2.x, xy2.y);
    await sleep(200);
    const panel = await G(q, () => !document.getElementById("tpanel").hidden);
    const lay = await G(q, () => {
      const r = (el) => el.getBoundingClientRect();
      const btns = [...document.querySelectorAll("#tower-list .tw, #next-btn, #speed-btn, #pause-btn")].map((b) => ({ w: r(b).width, h: r(b).height, l: r(b).left, ri: r(b).right, b: r(b).bottom }));
      return { btns, W: innerWidth, H: innerHeight, sx: scrollX, sy: scrollY, over: document.documentElement.scrollWidth > innerWidth, yaw: window.NestDefense.stage.yaw };
    });
    const big = lay.btns.every((b) => b.w >= 34 && b.h >= 34);
    const inside = lay.btns.every((b) => b.l >= 0 && b.ri <= lay.W + 0.5 && b.b <= lay.H + 0.5);
    check("N13", "휴대폰(390×844) 터치: 칸을 톡 → '여기에 세우기' 확인 → 설치 · 타워 톡 → 정보 창 · 버튼 크기 · 화면 안 · 세로 화면은 전장을 돌려 크게 · 화면이 밀리지 않음", pend.ok && pend.towers === 0 && placed.towers === 1 && panel && big && inside && !lay.over && lay.sx === 0 && lay.sy === 0 && Math.abs(lay.yaw - Math.PI / 2) < 1e-6, `확인 버튼 ${pend.ok} → 타워 ${placed.towers} · 정보 창 ${panel} · 버튼 ${lay.btns.length}개 · 전장 회전 ${lay.yaw.toFixed(2)}`);
    await q.ctx.close();
  }

  /* ---------- N14: 화면 크기 (휴대폰 세로 · 가로 · 태블릿 · PC) — 전장 전체가 위 · 아래 칸 사이에 ---------- */
  if (want("N14")) {
    const out = [];
    let all = true;
    for (const [w, h, t, nm] of [
      [390, 844, true, "휴대폰 세로"],
      [844, 390, true, "휴대폰 가로"],
      [768, 1024, true, "태블릿"],
      [1366, 768, false, "PC"],
      [360, 640, true, "작은 휴대폰"],
    ]) {
      const q = await openPage(browser, { width: w, height: h, touch: t });
      await load(q);
      await G(q, () => {
        const g = window.NestDefense;
        g.startRun({ world: 3, mode: "campaign", seed: 1 });
        g.ui.closeAll();
      });
      await sleep(400);
      const L = await G(q, () => {
        const g = window.NestDefense;
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const hud = r("hud");
        const bar = r("tbar");
        const pts = [[0, 0], [22, 0], [0, 14], [22, 14]].map(([x, z]) => g.stage.project(x, 0, z));
        const inside = pts.every((p) => p.x >= -2 && p.x <= innerWidth + 2 && p.y >= hud.bottom - 30 && p.y <= bar.top + 30);
        return { inside, hudOk: hud.right <= innerWidth + 1 && hud.bottom < innerHeight * 0.3, barOk: bar.bottom <= innerHeight + 1, over: document.documentElement.scrollWidth > innerWidth };
      });
      const ok = L.inside && L.hudOk && L.barOk && !L.over;
      if (!ok) all = false;
      out.push(`${nm} ${w}×${h}:${ok ? "OK" : "문제 " + JSON.stringify(L)}`);
      await q.ctx.close();
    }
    check("N14", "여러 화면 크기: 전장 네 모서리가 위 칸 · 타워 칸 사이에 들어옴 · 위 칸 · 타워 칸이 화면 안 · 가로 넘침 없음", all, out.join(" "));
  }

  /* ---------- N15: 설정 (소리 · 그래픽 · 흔들림 · 피해 숫자) 저장 ---------- */
  if (want("N15")) {
    const q = await openPage(browser);
    await load(q);
    await q.click("#go-settings");
    await G(q, () => {
      for (const [id, v] of [["set-music", "0"], ["set-sfx", "40"]]) {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await q.click('#set-quality button:has-text("낮음")');
    await q.uncheck("#set-shake");
    await q.uncheck("#set-nums");
    const a = await G(q, () => ({ q: window.NestDefense.stage.qKey, music: window.NestDefense.audio.musicOn, ratio: window.NestDefense.stage.renderer.getPixelRatio() }));
    await q.reload();
    await q.waitForFunction(() => window.NestDefense && document.getElementById("loading").hidden);
    const b = await G(q, () => ({ st: window.NestDefense.save.data.settings, q: window.NestDefense.stage.qKey, nums: window.NestDefense.view.settings.dmgNums, music: window.NestDefense.audio.musicOn }));
    check("N15", "설정: 배경음악 0 · 효과음 40 · 그래픽 '낮음'(해상도 · 그림자 · 윤곽선 줄임) · 흔들림 끔 · 피해 숫자 끔 → 새로고침 뒤에도 그대로", a.q === "low" && a.ratio <= 1 && !a.music && b.st.musicVol === 0 && b.st.sfxVol === 0.4 && b.st.quality === "low" && b.q === "low" && b.st.shake === false && b.st.dmgNums === false && !b.nums, `그래픽 ${a.q} (배율 ${a.ratio}) · 저장 ${JSON.stringify(b.st)}`);
    await q.ctx.close();
  }

  /* ---------- N16: 도움말 · 도감 · 새로운 적 안내 ---------- */
  if (want("N16")) {
    const q = await openPage(browser, { save: { v: 1, seen: ["turtle", "mole", "crownSlime"] } });
    await load(q);
    await q.click("#go-help");
    await q.click('#help-tabs button[data-tab="foes"]');
    await sleep(800);
    const foes = await G(q, () => ({ sections: document.querySelectorAll("#tab-foes .wtitle").length, cards: document.querySelectorAll("#tab-foes .foe").length, known: document.querySelectorAll("#tab-foes .foe:not(.unknown)").length, imgs: [...document.querySelectorAll("#tab-foes .foe img")].filter((i) => i.src.startsWith("data:image")).length }));
    await q.click('#help-tabs button[data-tab="towers"]');
    await sleep(500);
    const tw = await G(q, () => document.querySelectorAll("#tab-towers .foe").length);
    await q.keyboard.press("Escape");
    // 새로운 적: 4번 웨이브(거북) 정비 시간
    await G(q, () => {
      const g = window.NestDefense;
      g.startRun({ world: 1, mode: "campaign", seed: 2, snapshot: { v: 1, world: 1, mode: "campaign", local: 7, phase: "build", offer: null, coins: 300, nest: { hp: 20, maxHp: 20, shield: 0, maxShield: 10 }, score: 0, stats: {}, cards: {}, rng: 5, nextId: 50, towers: [] } });
    });
    await sleep(500);
    const nf = await G(q, () => ({ shown: !document.getElementById("newfoe").hidden, names: [...document.querySelectorAll("#nf-list .foe b")].map((b) => b.textContent), img: [...document.querySelectorAll("#nf-list img")].some((i) => i.src.startsWith("data:")) }));
    check("N16", "도움말: 하는 법 · 타워 6 · 몬스터 도감 (공통 + 월드 5 · 만난 것만 3D 그림 · 나머지 ???) · 정비 때 처음 나오는 특화 적은 '새로운 적' 안내 (그림 · 설명 · 대응법)", foes.sections === 6 && foes.cards === 43 && foes.known === 6 && foes.imgs >= 5 && tw === 6 && nf.shown && nf.names.join() === "버섯 분열체" && nf.img, `도감 ${foes.sections}칸 ${foes.cards}종 (아는 ${foes.known} · 그림 ${foes.imgs}) · 타워 ${tw} · 새 적 ${nf.names} (그림 ${nf.img})`);
    await q.ctx.close();
  }

  /* ---------- N17: 무한 생존 (캠페인 클리어 뒤 열림 · 결과 · 순위는 직접 올릴 때만) ---------- */
  if (want("N17")) {
    const q = await openPage(browser);
    await load(q);
    await q.click("#go-endless");
    const locked = await G(q, () => ({ toast: document.getElementById("toast").textContent, open: !document.getElementById("endless").hidden }));
    await G(q, () => {
      const s = window.NestDefense.save;
      s.data.campaign.done = true;
      s.write();
    });
    await q.reload();
    await q.waitForFunction(() => window.NestDefense && document.getElementById("loading").hidden);
    await q.click("#go-endless");
    await q.waitForSelector("#endless:not([hidden])");
    await q.click("#endless-grid .wcard.w4");
    const s0 = await until(q, (s) => s.mode === "play", 6000);
    const hud = await G(q, () => document.getElementById("hud-world").textContent);
    await G(q, () => {
      const s = window.NestDefense.sim;
      s.local = 13;
      window.NestDefense.startWave();
      s.nest.hp = 1;
      for (const e of s.enemies) e.s = e.path.length - 0.05;
    });
    await until(q, (s) => s.enemies > 0 || s.phase !== "wave", 8000);
    await G(q, () => {
      const s = window.NestDefense.sim;
      for (const e of s.enemies) e.s = e.path.length - 0.05;
    });
    await q.waitForSelector("#result:not([hidden])", { timeout: 15000 });
    await sleep(500);
    const posts = apiLog.filter((r) => r.method === "POST" && /\/api\/scores/.test(r.url)).length;
    const r = await G(q, () => ({ h: document.getElementById("r-h").textContent, rank: !!document.querySelector("#r-rank input, #r-rank button"), best: window.NestDefense.save.data.endless }));
    check("N17", "무한 생존: 캠페인 전엔 잠김 안내 → 다 깨면 열림 · 지도(용암 협곡) 고르기 · 위 칸 '무한 생존' · 끝나면 '웨이브 N 버팀' · 최고 기록 저장 · 순위 칸은 있지만 저절로 올리지 않음", /150 웨이브/.test(locked.toast) && !locked.open && s0.world === 4 && /무한 생존/.test(hud) && /버팀/.test(r.h) && r.rank && r.best.bestWave === 12 && posts === 0, `잠김 "${locked.toast}" · ${hud} · "${r.h}" · 최고 ${JSON.stringify(r.best)} · 저절로 보낸 점수 ${posts}`);
    await q.ctx.close();
  }

  /* ---------- N18: 오래 하기 (무한 생존 자동 플레이) — 3D 물체 · 메모리가 쌓이지 않음 ---------- */
  if (want("N18")) {
    const q = await openPage(browser);
    await load(q);
    await G(q, () => {
      const g = window.NestDefense;
      g.startRun({ world: 2, mode: "endless", seed: 8 });
      g.ui.closeAll();
      const s = g.sim;
      s.coins = 1e6;
      let n = 0;
      for (let z = 0; z < 14; z++)
        for (let x = 0; x < 22; x++) {
          if (n > 26 || !s.map.buildable(x, z)) continue;
          if (s.map.paths[0].nearest(x + 0.5, z + 0.5).d > 2.2) continue;
          const t = s.place(["archer", "bomb", "lightning", "ice", "cannon", "archer"][n % 6], x, z);
          if (t) {
            s.upgrade(t.id);
            s.upgrade(t.id);
            n++;
          }
        }
      g.speed = 3;
      window.__auto = setInterval(() => {
        const s2 = g.sim;
        if (s2.phase === "cards") g.pickCard(0);
        if (s2.phase === "build") {
          g.ui.closeAll();
          g.startWave();
        }
      }, 200);
    });
    const samples = [];
    for (let i = 0; i < 9; i++) {
      await sleep(10000);
      samples.push(
        await G(q, () => {
          const g = window.NestDefense;
          return { wave: g.sim.local, phase: g.sim.phase, ...g.view.stats(), heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, fps: Math.round(g.fps.ema), dom: document.querySelectorAll("#nums .dmg").length };
        })
      );
    }
    await G(q, () => clearInterval(window.__auto));
    const first = samples[1];
    const last = samples[samples.length - 1];
    const maxChildren = Math.max(...samples.map((s) => s.sceneChildren));
    const ok = last.wave > first.wave && maxChildren < 400 && last.nums <= 30 && (last.heap == null || last.heap < first.heap * 2.2 + 40);
    check("N18", "오래 하기: 무한 생존 90초 자동 플레이 (×3 배속) — 장면 물체 수 · 피해 숫자 · 메모리가 계속 늘지 않음 · 프레임", ok, samples.map((s) => `w${s.wave}:${s.sceneChildren}물체/${s.heap}MB/${s.fps}fps`).join(" "));
    await q.ctx.close();
  }

  /* ---------- N19: 탭 숨기면 자동 멈춤 · 돌아와도 순간이동 없음 ---------- */
  if (want("N19")) {
    const q = await openPage(browser);
    await load(q);
    await G(q, () => {
      const g = window.NestDefense;
      g.startRun({ world: 1, mode: "campaign", seed: 2 });
      g.ui.closeAll();
      g.sim.place("archer", 4, 4);
      g.startWave();
    });
    await sleep(800);
    await G(q, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const a = await S(q);
    await sleep(800);
    const b = await S(q);
    await G(q, () => Object.defineProperty(document, "hidden", { configurable: true, get: () => false }));
    check("N19", "탭을 숨기면 자동 멈춤 (전투 시간이 흐르지 않음)", a.paused && a.stack.includes("pause") && Math.abs(b.t - a.t) < 1e-6, `${a.stack} · ${a.t.toFixed(2)}→${b.t.toFixed(2)}`);
    await q.ctx.close();
  }

  /* ---------- N20: 홈 · 기존 둥지디펜스 · 다른 게임 ---------- */
  if (want("N20")) {
    const h = await openPage(browser);
    await h.goto(BASE + "/");
    await sleep(1500);
    await G(h, () => {
      const a = document.querySelector('a[href="/games/chick-defense-new/"]');
      if (a) a.scrollIntoView({ block: "center" });
    });
    await h.waitForFunction(() => {
      const i = document.querySelector('a[href="/games/chick-defense-new/"] img');
      return !i || (i.complete && i.naturalWidth > 0);
    }, null, { timeout: 6000 }).catch(() => {});
    const home = await G(h, () => {
      const a = document.querySelector('a[href="/games/chick-defense-new/"]');
      const shelf = a ? a.closest("section") : null;
      const img = a && a.querySelector("img");
      return { card: !!a, shelf: shelf ? shelf.id : "", count: shelf ? shelf.querySelector(".cat-count").textContent : "", n: shelf ? shelf.querySelectorAll(".game-grid > a").length : 0, thumb: img ? img.naturalWidth : 0, old: !!document.querySelector('a[href="/games/chick-defense/"]') };
    });
    if (home.card) {
      await h.click('a[href="/games/chick-defense-new/"]');
      await h.waitForFunction(() => window.NestDefense && document.getElementById("loading").hidden, null, { timeout: 20000 }).catch(() => {});
    }
    const entered = await G(h, () => !!window.NestDefense);
    const seo = await G(h, () => ({ about: !!document.querySelector(".seo-about h2"), canon: document.querySelector('link[rel="canonical"]').href, og: document.querySelector('meta[property="og:image"]').content }));
    const sm = await (await h.request.get(BASE + "/sitemap.xml")).text();
    const games = [];
    for (const g of ["chick-defense", "magnet-mayhem", "lava-surfers", "tetris"]) {
      const before = errors.length;
      await h.goto(`${BASE}/games/${g}/`);
      await sleep(2200);
      games.push(`${g}:${errors.length === before ? "OK" : "오류"}`);
    }
    check("N20", "홈 아케이드 칸 맨 앞 카드 (개수 = 실제 카드 수) · 썸네일 512 → 눌러서 들어감 · 게임 소개(SEO) · canonical · og · 사이트맵 · 기존 둥지 디펜스 카드 · 페이지 그대로 · 다른 게임 정상", home.card && home.shelf === "cat-arcade" && home.count === `${home.n}개` && home.thumb === 512 && home.old && entered && seo.about && /chick-defense-new/.test(seo.canon) && /chick-defense-new\.png/.test(seo.og) && /games\/chick-defense-new\//.test(sm) && games.every((x) => x.endsWith("OK")), `카드 ${home.card} (${home.shelf} ${home.count}/${home.n}) · 썸네일 ${home.thumb} · 기존 ${home.old} · 들어감 ${entered} · ${games.join(", ")}`);
    await h.ctx.close();
  }

  const leaked = apiLog.filter((r) => /today-chick-defense-new/.test(r.body));
  const autoPost = apiLog.filter((r) => r.method === "POST" && /\/api\/scores/.test(r.url));
  check("N21", "/api 로 저장 데이터를 보내지 않음 · 저절로 보낸 점수 없음 (방문 · 플레이 수 집계만)", leaked.length === 0 && autoPost.length === 0, `/api 요청 ${apiLog.length}건 (${[...new Set(apiLog.map((r) => r.method + " " + new URL(r.url).pathname))].join(", ")})`);
  check("N22", "콘솔 오류 · 페이지 오류 · 리소스 로딩 오류 없음", errors.length === 0, errors.length ? errors.slice(0, 6) : "없음 (/api 는 가짜 응답)");

  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
