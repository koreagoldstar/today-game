/**
 * 숫자전쟁 — 실제 브라우저로 모든 모드 플레이 (휴대폰 터치 · PC 마우스/키보드 · 저장 · 날짜)
 *   (npm start 로 3456 서버를 띄운 뒤) node scripts/test-number-war-play.js
 * /api 는 가짜 응답 (실제 랭킹에 기록하지 않음)
 */
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3456";
const URL = `${BASE}/games/number-war/`;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

async function page(browser, vp, extra = "") {
  const mobile = vp.width < 600;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  p.errors = [];
  p.posts = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && p.errors.push(m.text()));
  await p.route("**/api/**", (r) => {
    if (r.request().method() === "POST") p.posts.push(r.request().postDataJSON());
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, scores: [], rankDay: 1 }) });
  });
  await p.goto(`${URL}?test=1${extra}`);
  await p.waitForTimeout(600);
  return p;
}
const tapCell = async (p, i, touch) => (touch ? p.tap(`[data-i="${i}"]`) : p.click(`[data-i="${i}"]`));
/** 엔진이 고른 수를 화면 버튼으로 둔다 */
async function playMoves(p, n, touch, level = "normal") {
  for (let k = 0; k < n; k += 1) {
    const st = await p.evaluate((lv) => {
      const g = window.__nwTest.g;
      if (!g || g.over) return null;
      if (g.players && g.current === 1) return { wait: true };
      return NW.aiChoose(g, lv);
    }, level);
    if (!st) break;
    if (st.wait) {
      await p.waitForTimeout(80);
      continue;
    }
    await tapCell(p, st.from, touch);
    await tapCell(p, st.to, touch);
    await p.waitForTimeout(40);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });

  // 1) 휴대폰: 튜토리얼 → 클래식 끝까지 (터치)
  const m = await page(browser, { width: 390, height: 844 });
  check("U1 메뉴: 모드 5개 · 오늘의 미션 3개", (await m.$$eval("[data-mode]", (e) => e.length)) === 5 && (await m.$$eval("#missions li", (e) => e.length)) === 3);
  check("U2 휴대폰 메뉴 가로 넘침 없음", !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await m.tap('[data-mode="classic"]');
  await m.waitForTimeout(300);
  check("U3 처음엔 튜토리얼이 실제 판에서 시작", (await m.textContent("#hud-mode")).includes("튜토리얼") && (await m.$$eval(".is-guide", (e) => e.length)) === 1);
  await m.tap('[data-i="24"]');
  check("U4 튜토리얼: 안내 밖 타일은 막힘", (await m.evaluate(() => window.__nwTest.g.cells[24].v)) === 1 && (await m.textContent("#toast")).includes("빛나는"));
  for (const [a, b] of [[11, 12], [6, 7], [16, 17], [18, 17]]) {
    await m.tap(`[data-i="${a}"]`);
    await m.tap(`[data-i="${b}"]`);
    await m.waitForTimeout(420);
  }
  const tg = await m.evaluate(() => window.__nwTest.g);
  check("U5 튜토리얼 4단계 · 4연속 콤보", tg.combo === 4 && tg.stats.ten === 1 && tg.stats.twin === 1 && tg.stats.step === 1 && tg.stats.mult === 1, JSON.stringify(tg.stats));
  await m.waitForSelector("#tut-go");
  await m.tap("#tut-go");
  await m.waitForTimeout(300);
  check("U6 튜토리얼 뒤 클래식 시작 · 다음부턴 튜토리얼 없음", (await m.evaluate(() => window.__nwTest.mode)) === "classic" && (await m.evaluate(() => JSON.parse(localStorage.getItem("tg-numberwar")).tutorial)) === true);
  // 선택 표시 확인
  const ca = await m.evaluate(() => NW.allActions(window.__nwTest.g).find((a) => a.type === "combine"));
  await m.tap(`[data-i="${ca.from}"]`);
  check("U7 타일을 고르면 조합 칸(금색 · 규칙 · 점수)이 보인다", (await m.$$eval(".nw-cell.is-target .nw-tag", (e) => e.length)) >= 1 && (await m.$$eval(".nw-cell.is-sel", (e) => e.length)) === 1);
  await m.tap(`[data-i="${ca.from}"]`);
  // 쓸 수 없는 타일 누르기
  const dead = await m.evaluate(() => {
    const g = window.__nwTest.g;
    return g.cells.findIndex((c, i) => c && !NW.actionsFrom(g, i).length);
  });
  if (dead >= 0) {
    await m.tap(`[data-i="${dead}"]`);
    check("U8 쓸 수 없는 타일은 선택되지 않음", (await m.$$eval(".nw-cell.is-sel", (e) => e.length)) === 0);
  } else check("U8 쓸 수 없는 타일은 선택되지 않음 (해당 타일 없음 · 건너뜀)", true);
  await playMoves(m, 12, true);
  const mid = await m.evaluate(() => ({ turn: window.__nwTest.g.turn, cells: JSON.stringify(window.__nwTest.g.cells), score: window.__nwTest.g.score }));
  await m.reload();
  await m.waitForTimeout(500);
  check("U9 새로고침 뒤 '이어하기' 표시", (await m.textContent('[data-mode="classic"]')).includes("이어하기"));
  await m.tap('[data-mode="classic"]');
  await m.waitForTimeout(300);
  const back = await m.evaluate(() => ({ turn: window.__nwTest.g.turn, cells: JSON.stringify(window.__nwTest.g.cells), score: window.__nwTest.g.score }));
  check("U10 이어하면 같은 판 · 턴 · 점수", back.turn === mid.turn && back.cells === mid.cells && back.score === mid.score, `${mid.turn}/${back.turn}`);
  await playMoves(m, 60, true);
  await m.waitForSelector("#r-again", { timeout: 8000 });
  const fin = await m.evaluate(() => window.__nwTest.g);
  check("U11 클래식 30턴 끝 · 결과 화면 · 최종 = 조합 + 보너스", fin.over && (await m.textContent("#final-num")).replace(/,/g, "") === String(fin.final) && fin.final === fin.score + fin.bonus.total, `${fin.turn} ${fin.reason}`);
  await m.fill("#rank-name", "숫자왕");
  await m.tap('#rank-form button[type="submit"]');
  await m.waitForTimeout(300);
  check("U12 클래식 랭킹 등록 (가짜 API: game=number-war)", m.posts.some((x) => x && x.game === "number-war" && x.score === fin.final));
  const db1 = await m.evaluate(() => JSON.parse(localStorage.getItem("tg-numberwar")));
  check("U13 최고 기록 · 플레이 수 · 최근 기록 · 최고 콤보 저장", db1.best.classic === fin.final && db1.plays === 1 && db1.recent[0].score === fin.final && db1.maxCombo >= 1 && db1.progress === null);
  check("U14 콘솔 오류 없음 (휴대폰)", m.errors.length === 0, m.errors.join(" | "));

  // 2) 오늘의 숫자전쟁: 두 사람(다른 브라우저)이 같은 판 · 날짜가 바뀌면 다른 판
  const a = await page(browser, { width: 1280, height: 860 }, "&today=2026-11-21");
  await a.evaluate(() => localStorage.setItem("tg-numberwar", JSON.stringify({ v: 1, tutorial: true })));
  await a.reload();
  await a.waitForTimeout(400);
  await a.click('[data-mode="daily"]');
  const b = await page(browser, { width: 1280, height: 860 }, "&today=2026-11-21");
  await b.evaluate(() => localStorage.setItem("tg-numberwar", JSON.stringify({ v: 1, tutorial: true })));
  await b.reload();
  await b.waitForTimeout(400);
  await b.click('[data-mode="daily"]');
  const ca1 = await a.evaluate(() => JSON.stringify(window.__nwTest.g.cells));
  const cb1 = await b.evaluate(() => JSON.stringify(window.__nwTest.g.cells));
  check("D1 같은 날 다른 사람 = 같은 시작 판", ca1 === cb1);
  const c2 = await page(browser, { width: 1280, height: 860 }, "&today=2026-11-22");
  await c2.evaluate(() => localStorage.setItem("tg-numberwar", JSON.stringify({ v: 1, tutorial: true })));
  await c2.reload();
  await c2.waitForTimeout(400);
  await c2.click('[data-mode="daily"]');
  check("D2 날짜가 바뀌면 다른 판 · 다른 미션", ca1 !== (await c2.evaluate(() => JSON.stringify(window.__nwTest.g.cells))) && JSON.stringify(await a.evaluate(() => NW.dailyMissions("2026-11-21").map((x) => x.id))) !== JSON.stringify(await a.evaluate(() => NW.dailyMissions("2026-11-22").map((x) => x.id))));
  // PC: 키보드로 한 수 (화살표 · Enter)
  const ka = await a.evaluate(() => NW.allActions(window.__nwTest.g).find((x) => x.type === "combine"));
  await a.click(`[data-i="${ka.from}"]`);
  await a.click(`[data-i="${ka.from}"]`); // 다시 눌러 해제
  await a.focus(`[data-i="${ka.from}"]`);
  await a.keyboard.press("Enter");
  const toKey = { [-1]: "ArrowLeft", 1: "ArrowRight", [-5]: "ArrowUp", 5: "ArrowDown" }[ka.to - ka.from];
  await a.keyboard.press(toKey);
  await a.keyboard.press("Enter");
  await a.waitForTimeout(200);
  check("P1 PC 키보드(화살표 · Enter)로 조합", (await a.evaluate(() => window.__nwTest.g.turn)) === 1);
  await playMoves(a, 60, false);
  await a.waitForSelector("#r-again", { timeout: 8000 });
  const dg = await a.evaluate(() => window.__nwTest.g);
  const dd = await a.evaluate(() => JSON.parse(localStorage.getItem("tg-numberwar")).daily["2026-11-21"]);
  check("D3 오늘의 숫자전쟁 끝: 일일 최고 · 미션 판정 저장", dd && dd.score === dg.final && Array.isArray(dd.missions));
  await a.fill("#rank-name", "오늘왕");
  await a.click('#rank-form button[type="submit"]');
  await a.waitForTimeout(300);
  check("D4 오늘의 순위 등록 (game=number-war-daily)", a.posts.some((x) => x && x.game === "number-war-daily"));
  await a.click("#r-menu");
  check("D5 메뉴에 연속 참여 1일 · 오늘 점수", (await a.textContent("#stats")).includes("1일") && (await a.textContent('[data-mode="daily"]')).includes("오늘"));

  // 3) 시간 제한: 시간이 다 되면 끝
  await a.click('[data-mode="time"]');
  await playMoves(a, 4, false);
  check("T1 시간 제한: 남은 시간 표시 · 턴 제한 없음", (await a.textContent("#scorebar")).includes("초") && !(await a.isHidden("#timebar")));
  await a.evaluate(() => window.__nwTest.setEnd(300));
  await a.waitForSelector("#r-again", { timeout: 5000 });
  check("T2 시간 종료 → 결과 '시간 종료'", (await a.textContent(".nw-result-reason")).includes("시간"));
  await a.click("#r-menu");

  // 4) 고난도 전략
  await a.click('[data-mode="strategy"]');
  const sg = await a.evaluate(() => window.__nwTest.g);
  check("S1 전략: 18턴 · 잠금 · 특수 타일", sg.maxTurns === 18 && sg.cells.some((c) => c && c.lock) && sg.cells.some((c) => c && c.s));
  await playMoves(a, 40, false, "hard");
  await a.waitForSelector("#r-again", { timeout: 8000 });
  const sg2 = await a.evaluate(() => window.__nwTest.g);
  check("S2 전략: 끝 · 난이도 보너스 ×1.25 반영", sg2.over && (sg2.bonus.diff > 0 || sg2.score === 0));
  await a.click("#r-menu");

  // 5) AI 대결 (HARD)
  await a.click('[data-level="hard"]');
  await a.click('[data-mode="vs"]');
  await playMoves(a, 80, false, "normal");
  await a.waitForSelector("#r-again", { timeout: 15000 });
  const vg = await a.evaluate(() => window.__nwTest.g);
  const aiMoves = vg.log.filter((l) => l.p === 1).length;
  const meMoves = vg.log.filter((l) => l.p === 0).length;
  check("V1 AI 대결: 번갈아 두고(나 · AI 같은 수) 점수로 승부", vg.over && Math.abs(aiMoves - meMoves) <= 1 && aiMoves >= 5, `${meMoves}/${aiMoves}`);
  check("V2 대결 결과 저장 (HARD 전적)", await a.evaluate(() => {
    const r = JSON.parse(localStorage.getItem("tg-numberwar")).vs.hard;
    return r && r.w + r.l + r.d === 1;
  }));
  check("P2 콘솔 오류 없음 (PC)", a.errors.length === 0 && b.errors.length === 0 && c2.errors.length === 0, [...a.errors, ...b.errors].join(" | "));

  // 6) 깨진 저장값 · 360px
  const s = await page(browser, { width: 360, height: 740 });
  await s.evaluate(() => localStorage.setItem("tg-numberwar", "{oops"));
  await s.reload();
  await s.waitForTimeout(400);
  check("X1 저장값이 깨져도 메뉴가 뜸", (await s.$$eval("[data-mode]", (e) => e.length)) === 5 && s.errors.length === 0, s.errors.join(" | "));
  await s.evaluate(() => {
    localStorage.setItem("tg-numberwar", JSON.stringify({ v: 1, tutorial: true }));
  });
  await s.reload();
  await s.waitForTimeout(300);
  await s.tap('[data-mode="classic"]');
  await s.waitForTimeout(200);
  const cellW = await s.$eval('[data-i="0"]', (e) => e.getBoundingClientRect().width);
  check("X2 360px: 가로 넘침 없음 · 타일 48px 이상", !(await s.evaluate(() => document.documentElement.scrollWidth > innerWidth)) && cellW >= 48, `${cellW}`);

  await browser.close();
  let pass = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : "  — " + r.detail}`);
    if (r.ok) pass += 1;
  }
  console.log(`\n${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})();
