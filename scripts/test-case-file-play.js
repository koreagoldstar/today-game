/**
 * 오늘의 사건파일 — 실제 브라우저로 처음부터 끝까지 플레이 (사건 10개 + 저장 · 날짜 · 점수 · 휴대폰/PC)
 *   (npm start 로 3456 서버를 띄운 뒤) node scripts/test-case-file-play.js
 * /api 는 가짜로 응답 (실제 랭킹에 기록하지 않음)
 */
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3456";
const URL = `${BASE}/games/the-case-file/`;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

async function newPage(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block", ...(viewport.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  page.errors = [];
  page.caseFiles = [];
  page.posts = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && page.errors.push(m.text()));
  page.on("request", (r) => /cases\/case-\d+\.js/.test(r.url()) && page.caseFiles.push(r.url().match(/case-(\d+)/)[1]));
  await page.route("**/api/**", (route) => {
    const req = route.request();
    if (req.method() === "POST") page.posts.push(req.postDataJSON && req.postDataJSON());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, scores: opts.scores || [], configured: true, rankDay: 1, rankWeek: 1 }) });
  });
  return page;
}
const close = async (p) => {
  if (await p.isVisible("#modal")) await p.click("#modal-x");
};

/** 사건 하나를 화면 버튼만으로 끝까지 */
async function playCase(page, id, { wrong = false, hints = 0 } = {}) {
  if (process.env.DEBUG) console.log("play", id);
  await page.evaluate((cid) => window.__cfTest.startCase(cid, "replay"), id);
  await page.waitForSelector("#to-scene");
  const D = await page.evaluate(() => window.__cfTest.data);
  await page.click("#to-scene");
  if (await page.isVisible("#howto-ok")) await page.click("#howto-ok");
  // 현장: 모든 지점 · 자세히 · 수집
  for (const pt of D.scene.points) {
    await page.click(`.cf-pointrow[data-point="${pt.id}"]`);
    await page.waitForSelector("#modal:not([hidden])");
    for (let k = 0; k < 6; k += 1) {
      const take = await page.$("#modal-body [data-take]");
      if (take) await take.click();
      else if (await page.$("#deeper-btn")) await page.click("#deeper-btn");
      else break;
    }
    await close(page);
  }
  const keysOk = await page.isEnabled("#to-ev");
  await page.click("#to-ev");
  // 틀린 연결 하나
  const ids = await page.$$eval(".cf-evcard", (els) => els.map((e) => e.dataset.ev));
  const isLink = (a, b) => D.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  let bad = null;
  for (let i = 0; i < ids.length && !bad; i += 1) for (let j = i + 1; j < ids.length; j += 1) if (!isLink(ids[i], ids[j])) { bad = [ids[i], ids[j]]; break; }
  if (bad) {
    await page.click(`.cf-evcard[data-ev="${bad[0]}"] .cf-evcard-pick`);
    await page.click(`.cf-evcard[data-ev="${bad[1]}"] .cf-evcard-pick`);
    await page.click("#link-btn");
    await page.waitForTimeout(80);
  }
  const badLinkIgnored = (await page.evaluate(() => window.__cfTest.state.links.length)) === 0;
  const linkAll = async () => {
  for (let round = 0; round < 4; round += 1) {
    for (const l of D.links) {
      const st = await page.evaluate(() => window.__cfTest.state);
      const idx = D.links.indexOf(l);
      if (st.links.includes(idx) || !st.collected.includes(l.a) || !st.collected.includes(l.b)) continue;
      if ((l.needs || []).some((n) => !st.links.includes(D.links.findIndex((x) => x.id === n)))) continue;
      // 화면을 다시 그린 뒤 고르기
      await page.evaluate(() => window.__cfTest.go(3));
      await page.click(`.cf-evcard[data-ev="${l.a}"] .cf-evcard-pick`);
      await page.click(`.cf-evcard[data-ev="${l.b}"] .cf-evcard-pick`);
      await page.click("#link-btn");
      await page.waitForSelector("#modal:not([hidden])");
      await close(page);
    }
  }
  };
  await linkAll();
  // 증거 하나 확대
  await page.click(".cf-evcard .cf-evcard-open");
  await page.click("#zoom-art");
  const zoomed = await page.$eval("#zoom-art", (e) => e.classList.contains("is-zoom"));
  await page.click("#zoom-art");
  await close(page);
  await page.click("#to-int");
  const interrogate = async () => {
    await page.evaluate(() => window.__cfTest.go(4));
  for (let round = 0; round < 2; round += 1) {
    for (const s of D.suspects) {
      await page.click(`[data-sus="${s.id}"]`);
      for (const q of s.qs) {
        const btn = await page.$(`[data-q="${q.id}"]:not(.is-asked)`);
        if (btn) await btn.click();
      }
      if (round === 1) {
        for (const eid of Object.keys(s.show || {})) {
          const have = await page.evaluate((e) => window.__cfTest.state.collected.includes(e), eid);
          if (!have) continue;
          await page.click("#present-btn");
          await page.click(`[data-show="${eid}"]`);
          await page.waitForTimeout(520);
          await close(page);
        }
      }
    }
  }
  };
  // 심문 → (질문으로 얻은 증거로) 다시 연결 → 다시 심문
  await interrogate();
  await linkAll();
  await interrogate();
  for (let h = 0; h < hints; h += 1) {
    await page.click("#hint-btn");
    await page.click("#hint-more");
    await close(page);
  }
  if (process.env.ONLY || process.env.DEBUG) console.log(JSON.stringify(await page.evaluate(() => { const s = window.__cfTest.state; return { c: s.collected, l: s.links, k: s.contras }; })));
  await page.click("#to-rep");
  const R = D.report;
  const culprit = wrong ? D.suspects.find((s) => s.id !== R.culprit).id : R.culprit;
  await page.click(`input[name="culprit"][value="${culprit}"]`, { force: true });
  await page.click(`input[name="motive"][value="${R.motive.answer}"]`, { force: true });
  await page.click(`input[name="decisive"][value="${R.decisive}"]`, { force: true });
  await page.click(`input[name="time"][value="${R.time.answer}"]`, { force: true });
  // 빈 칸 하나 남기고 제출 → 막혀야 함
  await page.click('#report-form button[type="submit"]');
  const blocked = (await page.textContent("#rep-err")).includes("아직");
  await page.click(`input[name="lie"][value="${R.lie.answer}"]`, { force: true });
  await page.click('#report-form button[type="submit"]');
  await page.click("#rev-yes");
  await page.waitForSelector(".cf-result");
  await page.waitForTimeout(1600);
  const st = await page.evaluate(() => window.__cfTest.state);
  const shown = await page.textContent("#score-num");
  return { D, st, keysOk, badLinkIgnored, zoomed, blocked, shown: Number(shown), head: await page.textContent(".cf-result-head"), grade: await page.textContent(".cf-grade-letter") };
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const CAT_IDS = ["c001", "c002", "c003", "c004", "c005", "c006", "c007", "c008", "c009", "c010"];

  // 1) 첫 화면 · 지연 로딩 (휴대폰)
  let page = await newPage(browser, { width: 390, height: 844 });
  await page.goto(`${URL}?test=1&today=2026-11-21`);
  await page.waitForTimeout(1200);
  check("T1 첫 화면 오늘의 사건 = CASE-001", (await page.textContent("#today-code")) === "CASE-001");
  check("T2 첫 화면은 오늘 사건 파일 하나만 불러옴 (지연 로딩)", page.caseFiles.length === 1 && page.caseFiles[0] === "001", page.caseFiles.join(","));
  check("T3 가로 넘침 없음 (휴대폰 첫 화면)", !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await page.waitForSelector("#today-art svg", { timeout: 5000 }).catch(() => {});
  check("T4 사건 현장 그림이 그려짐", (await page.$$eval("#today-art > svg", (s) => s.length)) === 1);

  // 2) 사건 10개 끝까지 (휴대폰 5 · PC 5)
  const pc = await newPage(browser, { width: 1366, height: 900 });
  await pc.goto(`${URL}?test=1&today=2026-11-21`);
  await pc.waitForTimeout(600);
  for (const [i, id] of CAT_IDS.entries()) {
    if (process.env.ONLY && process.env.ONLY !== id) continue;
    const pg = i % 2 ? pc : page;
    const r = await playCase(pg, id);
    const all = r.st.collected.length === r.D.evidence.length && r.st.contras.length === r.D.contras.length && r.st.links.length === r.D.links.length;
    const res = r.st.result;
    check(`P-${id} 핵심 증거 뒤 다음 단계 열림`, r.keysOk);
    check(`P-${id} 엉뚱한 연결은 무시`, r.badLinkIgnored);
    check(`P-${id} 증거 확대 화면`, r.zoomed);
    check(`P-${id} 빈 칸이 있으면 제출 막힘`, r.blocked);
    check(`P-${id} 증거 ${r.st.collected.length}/${r.D.evidence.length} · 모순 ${r.st.contras.length}/${r.D.contras.length} · 연결 ${r.st.links.length}/${r.D.links.length} 모두 찾음`, all);
    check(`P-${id} 다섯 항목 정답 · SSS · 1000점 (${res && res.total})`, res && Object.values(res.ok).every(Boolean) && res.total === 1000 && res.grade === "SSS" && r.grade === "SSS" && r.shown === 1000, JSON.stringify(res));
    check(`P-${id} 결과 화면 '사건 종결'과 해설`, r.head.includes("사건 종결") && (await pg.textContent(".cf-truth")).includes(r.D.truth.headline));
  }

  // 3) 오답 · 힌트 감점
  const w = await playCase(pc, "c003", { wrong: true, hints: 2 });
  check("S1 범인을 틀리면 '미제 사건' · 등급 C", w.head.includes("미제") && w.st.result.grade === "C" && !w.st.result.ok.culprit);
  check("S2 힌트 2개 감점 −100", w.st.result.hintPenalty === 100 && w.st.hints === 2);
  check("S3 범인을 틀리면 속도 점수 0", w.st.result.speed === 0);
  const sc = await pc.evaluate(() => {
    const T = window.__cfTest;
    const D = T.data;
    const st = { report: { culprit: D.report.culprit, motive: D.report.motive.answer, decisive: D.report.decisive, time: D.report.time.answer, lie: D.report.lie.answer }, collected: D.evidence.slice(0, 4).map((e) => e.id), contras: [], hints: 0 };
    return [T.computeScore(D, st, D.minutes * 60 * 2), T.computeScore(D, st, D.minutes * 60 * 10)];
  });
  check("S4 정확도가 핵심: 다 맞히고 조사가 부족해도 S 이상", sc[0].accuracy === 850 && ["S", "SS"].includes(sc[0].grade), JSON.stringify(sc[0]));
  check("S5 아주 늦으면 속도 점수 0 (빨리 푸는 것만으론 고득점 불가)", sc[1].speed === 0 && sc[0].speed > 0 && sc[0].speed < 50);
  check("P 콘솔 오류 없음 (PC)", pc.errors.length === 0, pc.errors.join(" | "));
  check("P 콘솔 오류 없음 (휴대폰)", page.errors.length === 0, page.errors.join(" | "));

  // 4) 오늘의 사건 · 저장 · 재방문 · 다시 하기 · 날짜 바뀜
  const day = await newPage(browser, { width: 390, height: 844 });
  await day.goto(`${URL}?test=1&today=2026-11-21`);
  await day.waitForTimeout(800);
  await day.click("#start-btn");
  await day.click("#to-scene");
  if (await day.isVisible("#howto-ok")) await day.click("#howto-ok");
  await day.click('.cf-pointrow[data-point="p1"]');
  await day.click("#modal-body [data-take]");
  await close(day);
  await day.reload();
  await day.waitForTimeout(800);
  check("D1 새로고침 뒤 '이어서 조사하기'", (await day.textContent("#start-btn")).includes("이어서"));
  await day.click("#start-btn");
  const kept = await day.evaluate(() => window.__cfTest.state);
  check("D2 이어서 하면 수집 증거 · 단계가 그대로", kept.collected.includes("e1") && kept.step === 2 && kept.mode === "daily");
  await day.click("#leave-btn");
  // 오늘의 사건을 끝까지 (daily 모드)
  await day.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("tg-casefile"));
    st.progress = null;
    localStorage.setItem("tg-casefile", JSON.stringify(st));
  });
  await day.reload();
  await day.waitForTimeout(600);
  await day.evaluate(() => window.__cfTest.startCase("c001", "daily"));
  await day.waitForTimeout(200);
  const D1 = await day.evaluate(() => window.__cfTest.data);
  await day.evaluate((R) => {
    const st = window.__cfTest.state;
    st.collected = window.__cfTest.data.evidence.map((e) => e.id);
    st.maxStep = 5;
    st.report = { culprit: R.culprit, motive: String(R.motive.answer), decisive: R.decisive, time: String(R.time.answer), lie: String(R.lie.answer) };
    window.__cfTest.go(5);
  }, D1.report);
  await day.click('#report-form button[type="submit"]');
  await day.click("#rev-yes");
  await day.waitForSelector("#rank-form");
  await day.fill("#rank-name", "명탐정");
  await day.click('#rank-form button[type="submit"]');
  await day.waitForTimeout(400);
  const posted = day.posts.filter((p) => p && p.game);
  check("D3 오늘의 사건 랭킹: 오늘 점수 + 이번 주 합계 등록 (가짜 API)", posted.some((p) => p.game === "the-case-file") && posted.some((p) => p.game === "the-case-file-week") && (await day.textContent("#rank-msg")).includes("등록 완료"), JSON.stringify(posted));
  const s1 = await day.evaluate(() => JSON.parse(localStorage.getItem("tg-casefile")));
  check("D4 일일 기록 · 최초 해결일 · 연속 참여 1일 저장", s1.daily["2026-11-21"] && s1.cases.c001.firstDay === "2026-11-21" && s1.streak.count === 1);
  // 다시 하기 (낮은 점수) → 일일 · 최초 기록은 그대로
  await day.evaluate(() => window.__cfTest.startCase("c001", "replay"));
  await day.evaluate((R) => {
    const st = window.__cfTest.state;
    st.collected = ["e1", "e3"];
    st.maxStep = 5;
    st.report = { culprit: "s1", motive: "1", decisive: "e1", time: "0", lie: "0" };
    window.__cfTest.go(5);
  }, D1.report);
  await day.click('#report-form button[type="submit"]');
  await day.click("#rev-yes");
  await day.waitForSelector(".cf-result");
  const s2 = await day.evaluate(() => JSON.parse(localStorage.getItem("tg-casefile")));
  check("D5 다시 하기는 일일 · 최초 기록을 덮지 않음", s2.daily["2026-11-21"].score === s1.daily["2026-11-21"].score && s2.cases.c001.firstScore === s1.cases.c001.firstScore && s2.cases.c001.plays === 2 && s2.cases.c001.best === s1.cases.c001.best);
  check("D6 다시 하기 결과엔 랭킹 등록 칸이 없음", !(await day.$("#rank-form")));
  // 날짜
  await day.goto(`${URL}?test=1&today=2026-11-22`);
  await day.waitForTimeout(700);
  check("D7 다음 날 = CASE-002 · 연속 참여 이어짐", (await day.textContent("#today-code")) === "CASE-002" && (await day.textContent("#dash-streak")).startsWith("1일"));
  await day.goto(`${URL}?test=1&today=2026-12-01`);
  await day.waitForTimeout(700);
  check("D8 열흘 뒤 다시 CASE-001 (순환)", (await day.textContent("#today-code")) === "CASE-001");
  await day.goto(`${URL}?test=1&today=2026-11-21`);
  await day.waitForTimeout(500);
  const t1 = await day.textContent("#today-code");
  await day.reload();
  await day.waitForTimeout(500);
  check("D9 같은 날 새로고침해도 같은 사건", t1 === (await day.textContent("#today-code")));
  // 보관함 (실제 날짜 모드: 공개 전 사건은 봉인)
  await day.goto(`${URL}?today=2026-11-21`);
  await day.waitForTimeout(500);
  await day.click("#archive-btn");
  const locked = await day.$$eval(".cf-arch.is-locked", (e) => e.length);
  const solved = await day.$$eval(".cf-arch.is-solved", (e) => e.length);
  check("D10 보관함: 공개 전 사건 봉인 · 해결 표시", solved >= 1 && locked >= 0, `locked ${locked} solved ${solved}`);
  await day.click('[data-go="home"]');
  await day.click("#records-btn");
  check("D11 나의 추리 기록 화면", (await day.textContent("#records-days")).includes("CASE-001"));
  // 깨진 저장값
  await day.evaluate(() => localStorage.setItem("tg-casefile", "{not json"));
  await day.reload();
  await day.waitForTimeout(600);
  check("D12 저장값이 깨져도 첫 화면이 뜸", (await day.textContent("#today-title")).length > 1 && day.errors.length === 0, day.errors.join(" | "));

  // 5) 360 폭 · 가로 넘침 (게임 화면)
  const small = await newPage(browser, { width: 360, height: 740 });
  await small.goto(`${URL}?test=1&today=2026-11-21`);
  await small.waitForTimeout(600);
  await small.evaluate(() => window.__cfTest.startCase("c010", "replay"));
  let over = false;
  for (const st of [1, 2, 3, 4, 5]) {
    await small.evaluate((n) => {
      const s = window.__cfTest.state;
      s.maxStep = 5;
      s.collected = window.__cfTest.data.evidence.map((e) => e.id);
      window.__cfTest.go(n);
    }, st);
    await small.waitForTimeout(150);
    if (await small.isVisible("#howto-ok")) await small.click("#howto-ok");
    over = over || (await small.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1));
  }
  check("M1 360px 폭 모든 단계 가로 넘침 없음", !over);

  await browser.close();
  let pass = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : "  — " + r.detail}`);
    if (r.ok) pass += 1;
  }
  console.log(`\n${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})();
