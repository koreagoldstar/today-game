/**
 * 드래곤 석상 대작전 — 석상 챌린지(30단계 · 오늘의 도전) 자동 점검 (실제 브라우저로 게임 흐름을 확인)
 *  3D 모험(이동 · 점프 · 보스 등)은 scripts/test-dragon-adventure.js 에서 따로 점검한다.
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-dragon-statue.js
 *
 * - /api/* 는 가짜 응답으로 막는다 → 실제 랭킹 · 인기 집계에 아무것도 쓰지 않는다.
 * - GPU 가 있으면 GPU 로, 없으면 SwiftShader 로 돈다 (DS_GPU=0 으로 강제 가능).
 * - 결과: 항목마다 PASS / FAIL 과 근거 숫자. 하나라도 FAIL 이면 종료 코드 1.
 */
"use strict";

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.error("playwright 가 필요해요: npm i -D playwright (또는 npx playwright install chromium)");
  process.exit(2);
}

const BASE = process.env.DS_BASE || "http://localhost:3456";
const GAME = `${BASE}/games/dragon-statue/`;
const SAVE_KEY = "today-dragon-statue-v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}

async function launch(gpu) {
  const args = gpu ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  try {
    return await chromium.launch({ channel: "chrome", args });
  } catch (_) {
    return await chromium.launch({ args });
  }
}

/** 새 페이지 (저장 데이터 지정 · /api 막기 · 오류 모으기) */
async function openPage(browser, { width = 1180, height = 820, touch = false, save = { v: 1, tutorial: true }, errors = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: "block" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("PAGE " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200));
  });
  p.on("response", (r) => {
    if (r.status() >= 400 && !/\/api\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await p.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, scores: [] }) }));
  await p.addInitScript(
    ([key, save]) => {
      if (sessionStorage.getItem("__ds_init")) return;
      sessionStorage.setItem("__ds_init", "1");
      if (save === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(save));
    },
    [SAVE_KEY, save]
  );
  p.ctx = ctx;
  p.touch = touch;
  return p;
}

const G = (p, fn, arg) => p.evaluate(fn, arg);
const state = (p) =>
  G(p, () => {
    const g = window.DragonStatue;
    return {
      mode: g.mode,
      phase: g.phase,
      paused: g.paused,
      rule: !document.getElementById("rule").hidden,
      reward: !document.getElementById("reward").hidden,
      result: !document.getElementById("result").hidden,
      stage: g.run && g.run.stage,
      hearts: g.run && g.run.hearts,
      correct: g.run && g.run.correct,
      hits: g.run && g.run.hits,
      cleared: g.run && g.run.cleared,
      score: g.run && g.run.score,
      time: g.round && g.round.timeLeft,
      jobs: g.jobs.length,
    };
  });

async function waitFor(p, pred, ms = 20000, { autoRule = true } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await state(p);
    if (autoRule && s.rule && !pred(s)) {
      await p.click("#rule-ok");
      await sleep(120);
      continue;
    }
    if (autoRule && s.reward && !pred(s)) {
      await p.click("#reward-ok");
      await sleep(150);
      continue;
    }
    if (pred(s)) return s;
    await sleep(80);
  }
  throw new Error("timeout waiting: " + pred.toString().slice(0, 80));
}
const waitAim = (p, ms) => waitFor(p, (s) => s.mode === "play" && s.phase === "aim", ms);

/** 석상 화면 좌표 (odd: true=정답, false=보통) */
const statuePoint = (p, odd) =>
  G(
    p,
    (odd) => {
      const g = window.DragonStatue;
      const V3 = g.cam.position.constructor;
      const s = g.view.statues.find((s) => !s.gone && !s.wrong && !s.hinted && s.odd === odd && s.state === "idle");
      if (!s) return null;
      const v = new V3(s.x, s.y + s.scale * 0.5, s.z).project(g.cam);
      const r = g.canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, idx: g.view.statues.indexOf(s) };
    },
    odd
  );
async function tap(p, pt) {
  if (p.touch) await p.touchscreen.tap(pt.x, pt.y);
  else await p.mouse.click(pt.x, pt.y);
}

/** 타이틀 → 석상 챌린지 → 30단계(또는 오늘의 도전) → 캐릭터 → 출발 */
async function startGame(p, char = "chick", { daily = false } = {}) {
  await p.goto(GAME);
  await waitFor(p, (s) => s.mode === "title", 15000, { autoRule: false });
  await p.click("#challenge-btn");
  await sleep(300);
  if (daily) {
    await p.click("#ch-daily");
    await sleep(300);
    await p.click("#daily-go");
  } else await p.click("#ch-30");
  await waitFor(p, (s) => s.mode === "select", 8000, { autoRule: false });
  await p.click(`[data-char="${char}"]`);
  await sleep(150);
  await p.click("#go-btn");
}

(async () => {
  const gpu = process.env.DS_GPU !== "0";
  const browser = await launch(gpu);
  const errors = [];

  /* ---------- 1. 네 캐릭터 모두 선택 · 시작 ---------- */
  {
    const got = [];
    for (const c of ["chick", "bear", "bunny", "otter"]) {
      const p = await openPage(browser, { errors });
      await startGame(p, c);
      const s = await waitAim(p);
      const hero = await G(p, () => window.DragonStatue.hero.def.id);
      got.push({ c, hero, stage: s.stage, hearts: s.hearts });
      await p.ctx.close();
    }
    check(1, "네 캐릭터 모두 선택 및 게임 시작", got.every((g) => g.hero === g.c && g.stage === 1 && g.hearts === 3), got.map((g) => `${g.c}→${g.hero}`).join(", "));
  }

  /* ---------- 2 · 3 · 9 · 11(마우스): 정답 · 오답 · 빠른 연속 입력 ---------- */
  const p = await openPage(browser, { errors });
  await startGame(p, "bear");
  let s0 = await waitAim(p);
  // 3 + 9: 보통 석상을 아주 빠르게 6번 → 하트는 정확히 1개만
  const wrong = await statuePoint(p, false);
  for (let i = 0; i < 6; i++) await p.mouse.click(wrong.x, wrong.y, { delay: 0 });
  await sleep(1300);
  let s1 = await state(p);
  check(3, "오답 선택 시 목숨이 정확히 하나 감소", s1.hearts === s0.hearts - 1, `하트 ${s0.hearts} → ${s1.hearts}`);
  const wrongHits = s1.hits - s0.hits;
  // 2 + 9: 정답을 빠르게 6번 → 단계는 1만 오른다
  s0 = await waitAim(p);
  const right = await statuePoint(p, true);
  for (let i = 0; i < 6; i++) await p.mouse.click(right.x, right.y, { delay: 0 });
  // 깡충 · 휘두르기 동안에도 더 눌러 본다
  await sleep(250);
  for (let i = 0; i < 4; i++) await p.mouse.click(right.x, right.y, { delay: 0 });
  s1 = await waitAim(p);
  const mid = s1;
  check(2, "정답 석상 선택 시 스테이지 증가", s1.stage === s0.stage + 1 && s1.cleared === s0.cleared + 1, `단계 ${s0.stage} → ${s1.stage}`);
  check(9, "빠른 연속 입력에도 중복 판정 없음", wrongHits === 1 && mid.correct - s0.correct === 1 && s1.stage === s0.stage + 1, `오답 6번 클릭→판정 ${wrongHits}회, 정답 6번 클릭→정답 ${mid.correct - s0.correct}회`);

  /* ---------- 5. 시간 초과 ---------- */
  {
    const before = await waitAim(p);
    await G(p, () => (window.DragonStatue.round.timeLeft = 0.4));
    const after = await waitFor(p, (s) => s.phase === "busy" || s.phase === "over", 5000);
    await sleep(200);
    const banner = await G(p, () => document.getElementById("banner-h").textContent + " / " + document.getElementById("banner-k").textContent);
    const arrow = await G(p, () => window.DragonStatue.fx.arrow.visible);
    const again = await waitAim(p, 15000);
    check(5, "제한 시간 초과 시 정상 실패 처리", after.hearts === before.hearts - 1 && arrow && again.stage === before.stage, `하트 ${before.hearts}→${after.hearts}, 정답 화살표 ${arrow}, 같은 단계 ${before.stage}→${again.stage} 새 배치, 배너 "${banner}"`);
  }

  /* ---------- 10. 일시정지 · 재시작 ---------- */
  {
    await waitAim(p);
    await p.click("#pause-btn");
    await sleep(150);
    const a = await state(p);
    const right2 = await statuePoint(p, true);
    await sleep(1200);
    // 일시정지 중 누르기는 무시 (덮개가 막고, 게임도 받지 않는다)
    await G(p, (pt) => window.DragonStatue.tapAt(((pt.x / innerWidth) * 2 - 1), -((pt.y / innerHeight) * 2 - 1)), right2);
    const b = await state(p);
    await p.click("#pause-resume");
    await sleep(700);
    const c = await state(p);
    // 화면 숨김(탭 전환)도 자동 일시정지
    await G(p, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hiddenPaused = (await state(p)).paused;
    await G(p, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // 처음부터
    await p.click("#pause-retry");
    await sleep(300);
    const r0 = await waitAim(p);
    check(
      10,
      "일시정지와 재시작 정상 작동",
      a.paused && a.time === b.time && b.correct === a.correct && c.time < b.time && hiddenPaused && r0.stage === 1 && r0.hearts === 3 && r0.score === 0,
      `멈춤 중 시간 ${a.time.toFixed(2)}=${b.time.toFixed(2)}, 멈춤 중 입력 무시, 다시 흐름 ${c.time.toFixed(2)}, 탭 숨김→자동 멈춤 ${hiddenPaused}, 처음부터→단계 ${r0.stage}·하트 ${r0.hearts}·점수 ${r0.score}`
    );
  }

  /* ---------- 4 · 12. 목숨 0 → 게임 오버 → 사이트 복귀 ---------- */
  {
    let s = await waitAim(p);
    for (let i = 0; i < 6 && s.hearts > 0; i++) {
      const pt = await statuePoint(p, false);
      // 남은 보통 석상이 없으면(모두 ✕) 시간 초과로 하트를 잃게 한다
      if (pt) await p.mouse.click(pt.x, pt.y);
      else await G(p, () => (window.DragonStatue.round.timeLeft = 0.3));
      await sleep(pt ? 1200 : 2800);
      await sleep(1200);
      s = await state(p);
      if (s.phase === "over") break;
      s = await waitAim(p);
    }
    const res = await waitFor(p, (s) => s.result, 15000, { autoRule: false });
    const resultText = await G(p, () => document.getElementById("res-k").textContent + " · " + document.getElementById("res-stats").textContent.replace(/\s+/g, " ").slice(0, 120));
    check(4, "목숨 0개일 때 게임 오버", res.hearts === 0 && res.result, resultText);
    await p.click("#res-site");
    await p.waitForURL(BASE + "/", { timeout: 10000 });
    check(12, "게임 종료 후 기존 사이트로 정상 복귀", p.url() === BASE + "/", p.url());
  }
  await p.ctx.close();

  /* ---------- 11. 모바일 터치 ---------- */
  {
    const m = await openPage(browser, { width: 390, height: 844, touch: true, errors });
    await startGame(m, "otter");
    const a = await waitAim(m);
    await tap(m, await statuePoint(m, true));
    const b = await waitAim(m);
    check(11, "PC 마우스와 모바일 터치 모두 정상", b.stage === a.stage + 1, `마우스(위 2·3·9번에서 확인) · 터치 정답 → 단계 ${a.stage}→${b.stage}`);
    await m.ctx.close();
  }

  /* ---------- 6 · 7 · 8. 배치 무작위 · 난이도 · 크기 차이 검증 (게임의 실제 배치 코드로 대량 생성) ---------- */
  {
    const q = await openPage(browser, { errors });
    await q.goto(GAME);
    await waitFor(q, (s) => s.mode === "title", 15000, { autoRule: false });
    const data = await G(q, async () => {
      const L = await import("/games/dragon-statue/js/layout.js?v=1");
      const { typeInfo } = await import("/games/dragon-statue/js/stageview.js?v=1");
      const THREE = await import("/js/vendor/three-0.160.1.module.min.js");
      const aspects = [0.46, 0.75, 1.44, 1.78];
      let rounds = 0;
      let fails = 0;
      let minRatio = 9;
      let maxSpread = 0;
      let maxCover = 0;
      const pos = {};
      const table = [];
      for (let n = 1; n <= 40; n++) {
        const spec0 = L.stageSpec(n, L.seeded(n));
        table.push({ n, kind: spec0.kind, theme: spec0.theme, count: spec0.count, diff: +spec0.diff.toFixed(3), time: spec0.time, mix: spec0.mix });
        for (const aspect of aspects) {
          for (let seed = 1; seed <= 12; seed++) {
            const rnd = L.seeded(n * 1000 + seed * 7 + Math.round(aspect * 100));
            const spec = L.stageSpec(n, rnd);
            const r = L.buildRound(spec, { aspect, cam: new THREE.PerspectiveCamera(), rnd, avoid: [], typeInfo, boss: spec.kind === "boss" });
            rounds++;
            if (!r.check.ok) fails++;
            minRatio = Math.min(minRatio, ...r.check.ratios);
            maxSpread = Math.max(maxSpread, r.check.spread);
            maxCover = Math.max(maxCover, ...r.check.cover);
            const k = `${spec.count}@${aspect}`;
            pos[k] = pos[k] || {};
            for (const st of r.statues) if (st.odd) pos[k][`${st.row}-${st.col}`] = (pos[k][`${st.row}-${st.col}`] || 0) + 1;
          }
        }
      }
      // 연속 반복: 같은 단계를 60번 이어서 (avoid 사용)
      let repeats = 0;
      let avoid = [];
      const rnd = L.seeded(4242);
      let last = null;
      for (let i = 0; i < 60; i++) {
        const spec = L.stageSpec(9, rnd);
        const r = L.buildRound(spec, { aspect: 1.44, cam: new THREE.PerspectiveCamera(), rnd, avoid, typeInfo });
        const o = r.statues.find((s) => s.odd);
        const key = `${o.row}-${o.col}`;
        if (key === last) repeats++;
        last = key;
        avoid = [{ row: o.row, col: o.col }];
      }
      // 칸 수 대비 정답이 나온 칸 비율
      let covered = 0;
      let total = 0;
      for (const [k, v] of Object.entries(pos)) {
        const count = Number(k.split("@")[0]);
        total += count;
        covered += Math.min(count, Object.keys(v).length);
      }
      return { rounds, fails, minRatio, maxSpread, maxCover, repeats, coverage: covered / total, table };
    });
    check(6, "정답 위치가 매 라운드 다양하게 바뀜", data.coverage > 0.9 && data.repeats === 0, `정답이 나온 칸 비율 ${(data.coverage * 100).toFixed(0)}% · 같은 단계 60연속에서 같은 자리 연속 ${data.repeats}회`);
    const t = data.table.filter((r) => r.kind === "normal");
    const tiers = ["forest", "jungle", "crystal", "volcano", "ice", "master"].map((th) => {
      const rows = t.filter((r) => r.theme === th);
      return { th, count: Math.max(...rows.map((r) => r.count)), diff: Math.min(...rows.map((r) => r.diff)), time: Math.min(...rows.map((r) => r.time)), mix: Math.max(...rows.map((r) => r.mix)) };
    });
    let mono = true;
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].count < tiers[i - 1].count || tiers[i].diff > tiers[i - 1].diff || tiers[i].time > tiers[i - 1].time || tiers[i].mix < tiers[i - 1].mix) mono = false;
    }
    check(7, "스테이지가 오를수록 실제 난이도 상승", mono, tiers.map((r) => `${r.th}: ${r.count}개·차이${Math.round(r.diff * 100)}%·${r.time}초·${r.mix}종`).join(" | "));
    check(8, "정답 석상의 크기 차이를 명확히 식별 가능", data.fails === 0 && data.minRatio >= 1.12 && data.maxSpread <= 0.02 && data.maxCover <= 0.35, `${data.rounds}판 생성 · 검증 실패 ${data.fails} · 화면상 최소 크기비 ${data.minRatio.toFixed(3)} · 보통 석상끼리 최대 차 ${(data.maxSpread * 100).toFixed(2)}% · 정답 최대 가림 ${(data.maxCover * 100).toFixed(0)}%`);
    await q.ctx.close();
  }

  /* ---------- 오늘의 도전: 같은 날 같은 문제 ---------- */
  {
    const sig = [];
    for (let k = 0; k < 2; k++) {
      const d = await openPage(browser, { errors });
      await startGame(d, "chick", { daily: true });
      await waitAim(d);
      sig.push(await G(d, () => window.DragonStatue.view.statues.map((s) => `${s.typeId}:${s.odd ? "O" : "x"}:${s.x.toFixed(2)},${s.z.toFixed(2)}`).join("|")));
      await d.ctx.close();
    }
    check("D", "오늘의 도전: 같은 날짜는 같은 배치", sig[0] === sig[1], sig[0].slice(0, 80) + "…");
  }

  /* ---------- 처음 튜토리얼 (실제 석상) ---------- */
  {
    const tq = await openPage(browser, { save: null, errors });
    await startGame(tq, "bunny");
    await waitFor(tq, (s) => s.phase === "tutorial", 15000, { autoRule: false });
    const ptr = await G(tq, () => !document.getElementById("pointer").hidden && !document.getElementById("tutor").hidden);
    await tap(tq, await statuePoint(tq, true));
    const after = await waitFor(tq, (s) => s.rule, 15000, { autoRule: false });
    const saved = await G(tq, (k) => JSON.parse(localStorage.getItem(k)).tutorial, SAVE_KEY);
    check("T", "첫 플레이 튜토리얼 (손가락 안내 → 실제 석상 치기 → 1단계 규칙)", ptr && after.rule && saved === true, `안내 표시 ${ptr} · 끝나면 저장 ${saved}`);
    await tq.ctx.close();
  }

  /* ---------- 키보드 (선택 사항) ---------- */
  {
    const kq = await openPage(browser, { errors });
    await startGame(kq, "chick");
    const a = await waitAim(kq);
    // 정답 석상까지 화살표로 이동 후 Enter
    const target = (await statuePoint(kq, true)).idx;
    await kq.keyboard.press("ArrowRight");
    for (let i = 0; i < 12; i++) {
      const cur = await G(kq, () => window.DragonStatue.cursor);
      if (cur === target) break;
      const pos = await G(kq, ([c, t]) => {
        const g = window.DragonStatue;
        const a = g.view.statues[c];
        const b = g.view.statues[t];
        return { dx: b.x - a.x, dz: b.z - a.z };
      }, [cur, target]);
      await kq.keyboard.press(Math.abs(pos.dx) > 0.5 ? (pos.dx > 0 ? "ArrowRight" : "ArrowLeft") : pos.dz < 0 ? "ArrowUp" : "ArrowDown");
    }
    await kq.keyboard.press("Enter");
    const b = await waitAim(kq);
    check("K", "키보드: 방향키로 고르고 Enter 로 치기", b.stage === a.stage + 1, `단계 ${a.stage}→${b.stage}`);
    await kq.ctx.close();
  }

  /* ---------- 16. 여러 화면 크기 UI ---------- */
  {
    const sizes = [
      [360, 640, true],
      [390, 844, true],
      [844, 390, true],
      [768, 1024, true],
      [1366, 768, false],
      [1920, 1080, false],
    ];
    const out = [];
    let allOk = true;
    for (const [w, h, touch] of sizes) {
      const v = await openPage(browser, { width: w, height: h, touch, errors });
      await startGame(v, "chick");
      await waitAim(v);
      const r = await G(v, () => {
        const ids = ["hud-stage", "hearts", "hud-score", "pause-btn", "hint-btn", "timer", "hud-goal"];
        const rect = (id) => document.getElementById(id).getBoundingClientRect();
        const inView = ids.every((id) => {
          const b = rect(id);
          return b.width > 0 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        });
        const over = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const pairs = [
          ["hud-stage", "hearts"],
          ["hearts", "hud-score"],
          ["hud-score", "hint-btn"],
          ["timer", "hud-stage"],
        ];
        const overlaps = pairs.filter(([a, b]) => over(rect(a), rect(b))).map((x) => x.join("/"));
        const btn = rect("pause-btn");
        // 석상이 HUD 에 가리지 않는지: 석상 화면 위치가 HUD(위) · 안내(아래) 바깥
        const g = window.DragonStatue;
        const V3 = g.cam.position.constructor;
        const hudBottom = rect("timer").bottom;
        const gr = rect("hud-goal");
        const goalTop = gr.height > 0 ? gr.top : innerHeight;
        const hidden = g.view.statues.filter((s) => {
          const v = new V3(s.x, s.y + s.scale * 0.5, s.z).project(g.cam);
          const y = ((1 - v.y) / 2) * innerHeight;
          const x = ((v.x + 1) / 2) * innerWidth;
          return y < hudBottom || y > goalTop || x < 0 || x > innerWidth;
        }).length;
        return { inView, overlaps, btn: Math.round(btn.width), hidden, scroll: document.scrollingElement.scrollHeight <= innerHeight + 2 || getComputedStyle(document.body).overflow === "hidden" };
      });
      await v.screenshot({ path: `test-results/dragon-statue-${w}x${h}.png` }).catch(() => {});
      const ok = r.inView && !r.overlaps.length && r.btn >= 36 && r.hidden === 0;
      allOk = allOk && ok;
      out.push(`${w}x${h}:${ok ? "OK" : "X"}(버튼 ${r.btn}px${r.overlaps.length ? " 겹침 " + r.overlaps : ""}${r.hidden ? " 가린 석상 " + r.hidden : ""})`);
      await v.ctx.close();
    }
    check(16, "주요 모바일 · 데스크톱 화면에서 UI 정상", allOk, out.join(" "));
  }

  /* ---------- WebGL 이 없을 때 안내 화면 ---------- */
  {
    let b2;
    try {
      b2 = await chromium.launch({ channel: "chrome", args: ["--disable-webgl", "--disable-3d-apis"] });
    } catch (_) {
      b2 = await chromium.launch({ args: ["--disable-webgl", "--disable-3d-apis"] });
    }
    const f = await openPage(b2, { errors: [] });
    await f.goto(GAME);
    await sleep(2000);
    const shown = await G(f, () => !document.getElementById("fallback").hidden && document.getElementById("loading").hidden);
    check("W", "WebGL 미지원 기기 안내 화면", shown, shown ? "안내 화면 표시 · 다른 게임 보러 가기 링크" : "안내 화면 없음");
    await b2.close();
  }

  /* ---------- 13 · 14. 다른 게임 · 홈 · 오류 ---------- */
  {
    const h = await openPage(browser, { errors });
    await h.goto(BASE + "/");
    await sleep(1500);
    const home = await G(h, () => ({ card: !!document.querySelector('a[href="/games/dragon-statue/"] img'), broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== "lazy").length }));
    const games = [];
    for (const g of ["sea-monster", "jetski-race", "ocean-blaster", "diff"]) {
      const before = errors.length;
      await h.goto(`${BASE}/games/${g}/`);
      await sleep(1800);
      games.push(`${g}:${errors.length === before ? "OK" : "오류"}`);
    }
    check(13, "기존 게임 목록과 다른 게임 정상 작동", home.card && home.broken === 0 && games.every((x) => x.endsWith("OK")), `홈 카드 ${home.card} · ${games.join(", ")}`);
    await h.ctx.close();
  }
  check(14, "콘솔 오류 · 리소스 로딩 오류 · 깨진 이미지 없음", errors.length === 0, errors.length ? errors.slice(0, 5) : "없음 (/api 는 가짜 응답)");

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e.message);
  process.exit(1);
});
