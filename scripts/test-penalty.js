/*
 * 승부차기 히어로 점검
 *  node scripts/test-penalty.js  (로컬 서버 3456 필요)
 *  - 공이 조준한 곳으로 가는지 · 골대 · 골 판정 · 키퍼 충돌이 실제로 동작하는지
 *  - 봇으로 슛 성공률 · 선방률을 재서 단계별 난이도가 맞는지
 *  - 승부차기 규칙(조기 종료 · 서든데스) · 저장 · 실제 드래그 · 휴대폰 화면
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3456";
let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${extra ? ` — ${extra}` : ""}`);
}

const HELP = `
window.pk = {
  /** 경기 없이 한 번만 차 봄. who: shoot(내가 참) | keep(내가 막음) */
  one(lv, who, setup) {
    const G = window.PenaltyHero;
    G.lv = lv;
    G.score = 0;
    G.match = { team: { name: "시험", kit: { shirt: 0xff0000, trim: 0xffffff, shorts: 0, socks: 0, shoes: 0, number: "#fff" } }, gkKit: { shirt: 0x00ff00, trim: 0xffffff, shorts: 0, socks: 0, shoes: 0, number: "#fff", gloves: 0xffffff, long: true }, us: [], them: [], first: who === "shoot" ? "us" : "them", kicks: 0, sudden: false, pattern: [] };
    document.body.classList.add("in-match");
    G.beginTurn();
    setup(G);
    const dt = 1 / 60;
    let guard = 0;
    while (guard < 60 * 12 && !(G.turn && G.turn.done)) {
      guard += 1;
      G.update(dt);
      if (who === "keep" && G.keepHook) G.keepHook(G);
    }
    const t = G.turn;
    const out = { result: t.result, touched: t.touched, posted: t.posted, frames: guard, bx: G.ball.x, by: G.ball.y };
    G.keepHook = null;
    G.state = "title";
    return out;
  },
};
`;

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 800 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  const bad = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) bad.push(`${r.status()} ${r.url()}`);
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/games/penalty-kick/?q=low`);
  await page.waitForFunction(() => window.PenaltyHero, null, { timeout: 60000 });
  await page.evaluate(HELP);

  console.log("\n[공 물리]");
  const aim = await page.evaluate(() => {
    const G = window.PenaltyHero;
    const out = [];
    for (const [x, y, sp, c] of [[0, 1, 25, 0], [3, 0.4, 28, 0], [-3.2, 2.2, 31, 0], [2, 1.6, 24, 0.8], [-2, 0.6, 26, -0.8]]) {
      const s = G.solveShot(x, y, sp, c);
      const r = G.simToLine(s.vx, s.vy, s.vz, s.ax);
      out.push(Math.hypot(r.x - x, r.y - y));
    }
    return out;
  });
  check("공이 조준한 곳으로 정확히 간다", aim.every((d) => d < 0.06), aim.map((d) => d.toFixed(3)).join(" "));
  const noKeeper = (G) => {
    G.aiKeeperPlan = function () {};
    G.keeper.root.position.x = 30;
    G.colliders.length = 0;
  };
  const physics = await page.evaluate(() => {
    const G = window.PenaltyHero;
    const orig = G.aiKeeperPlan;
    const collSave = G.colliders.slice();
    const run = (x, y, sp) =>
      window.pk.one(0, "shoot", (g) => {
        g.aiKeeperPlan = function () {};
        g.colliders.length = 0;
        g.fireAt = g.fireAt;
        g.pending = { x, y, speed: sp, curve: 0 };
        g.state = "strike";
        g.startRun();
        g.kick.release = true;
      });
    const r = {
      center: run(0, 1.2, 26),
      post: run(3.66, 1.2, 26),
      bar: run(0, 2.44, 26),
      wide: run(5, 1, 26),
      over: run(0, 3.6, 26),
    };
    G.aiKeeperPlan = orig;
    G.colliders.length = 0;
    collSave.forEach((c) => G.colliders.push(c));
    return r;
  });
  check("가운데로 차면 골", physics.center.result === "goal", JSON.stringify(physics.center));
  check("골대를 맞히면 튕긴다", physics.post.posted === true, JSON.stringify(physics.post));
  check("크로스바를 맞히면 튕긴다", physics.bar.posted === true, JSON.stringify(physics.bar));
  check("옆으로 벗어나면 빗나감", physics.wide.result === "wide", physics.wide.result);
  check("위로 뜨면 빗나감", physics.over.result === "over", physics.over.result);
  void noKeeper;

  console.log("\n[상대 키퍼 난이도: 내 슛 성공률]");
  const shootRate = async (lv, n) =>
    page.evaluate(
      ([lvv, nn]) => {
        const stats = { goal: 0, saved: 0, miss: 0, n: nn };
        for (let i = 0; i < nn; i += 1) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const x = side * (1.4 + Math.random() * 1.75);
          const y = 0.4 + Math.random() * 1.7;
          const r = window.pk.one(lvv, "shoot", (g) => g.fireAt(x, y, 24 + Math.random() * 6, 0));
          if (r.result === "goal") stats.goal += 1;
          else if (r.touched || r.result === "catch") stats.saved += 1;
          else stats.miss += 1;
        }
        return stats;
      },
      [lv, n]
    );
  const s0 = await shootRate(0, 40);
  const s4 = await shootRate(4, 40);
  const s8 = await shootRate(8, 40);
  console.log(`     단계1 ${JSON.stringify(s0)}\n     단계5 ${JSON.stringify(s4)}\n     단계9 ${JSON.stringify(s8)}`);
  check("쉬운 단계: 대부분 들어간다", s0.goal / 40 >= 0.6 && s0.goal / 40 <= 0.95, `${Math.round((s0.goal / 40) * 100)}%`);
  check("어려운 단계: 잘 찬 슛도 막힌다", s8.goal / 40 >= 0.3 && s8.goal / 40 <= 0.8, `${Math.round((s8.goal / 40) * 100)}%`);
  check("뒤로 갈수록 키퍼가 더 잘 막는다", s8.saved >= s0.saved, `${s0.saved} → ${s8.saved}`);
  const smart = await page.evaluate(() => {
    let goal = 0;
    for (let i = 0; i < 30; i += 1) {
      const r = window.pk.one(4, "shoot", (g) => g.fireAt((Math.random() < 0.5 ? -1 : 1) * 3.05, 2.05, 30, 0));
      if (r.result === "goal") goal += 1;
    }
    let weak = 0;
    for (let i = 0; i < 30; i += 1) {
      const r = window.pk.one(4, "shoot", (g) => g.fireAt((Math.random() - 0.5) * 1.2, 1, 23, 0));
      if (r.result === "goal") weak += 1;
    }
    return { goal, weak };
  });
  check("구석으로 강하게 차는 쪽이 가운데 약한 슛보다 잘 들어간다", smart.goal > smart.weak, `구석 ${smart.goal}/30 · 가운데 ${smart.weak}/30`);

  console.log("\n[내가 골키퍼: 선방률]");
  const keepRate = async (lv, n, mode) =>
    page.evaluate(
      ([lvv, nn, md]) => {
        const stats = { goal: 0, saved: 0, miss: 0, n: nn };
        for (let i = 0; i < nn; i += 1) {
          const r = window.pk.one(lvv, "keep", (g) => {
            g.keepHook = (h) => {
              if (h.turn.dove || !h.turn.kicked) return;
              // 사람의 반응 시간
              const since = h.time - h.shot.startedAt;
              if (md === "react" && since > 0.22) h.keeperGo(h.turn.plan.tx, h.turn.plan.ty);
              if (md === "random" && since > 0.05) h.keeperGo((Math.floor(Math.random() * 3) - 1) * 2.6, Math.random() < 0.5 ? 1.8 : 0.55);
            };
          });
          if (r.result === "goal") stats.goal += 1;
          else if (r.touched || r.result === "catch") stats.saved += 1;
          else stats.miss += 1;
        }
        return stats;
      },
      [lv, n, mode]
    );
  const k0 = await keepRate(0, 30, "react");
  const k8 = await keepRate(8, 30, "react");
  const kr = await keepRate(4, 30, "random");
  const kn = await page.evaluate(() => {
    let goal = 0;
    for (let i = 0; i < 20; i += 1) if (window.pk.one(4, "keep", () => {}).result === "goal") goal += 1;
    return goal;
  });
  console.log(`     단계1 ${JSON.stringify(k0)}\n     단계9 ${JSON.stringify(k8)}\n     찍기 ${JSON.stringify(kr)}\n     가만히 ${kn}/20 골`);
  check("0.22초 안에 반응하면 쉬운 단계는 대부분 막는다", k0.saved / 30 >= 0.5, `${k0.saved}/30`);
  check("어려운 단계는 반응만으론 다 못 막는다", k8.saved < k0.saved + 4 && k8.goal >= 3, `막음 ${k8.saved} · 먹힘 ${k8.goal}`);
  check("찍어서 몸을 날리면 가끔 막는다", kr.saved >= 2 && kr.goal >= 5, `막음 ${kr.saved} · 먹힘 ${kr.goal}`);
  check("가만히 있으면 대부분 먹힌다", kn >= 11, `${kn}/20`);

  console.log("\n[승부차기 규칙]");
  const rules = await page.evaluate(() => {
    const G = window.PenaltyHero;
    const out = {};
    const endMatch = G.endMatch;
    const beginTurn = G.beginTurn;
    let ended = null;
    let began = 0;
    G.endMatch = (won) => {
      ended = won;
    };
    G.beginTurn = () => {
      began += 1;
    };
    const set = (us, them, sudden = false) => {
      ended = null;
      began = 0;
      G.match = { team: { name: "x" }, us, them, kicks: us.length + them.length, sudden, pattern: [], first: "us" };
      G.afterResult();
      return ended === null ? "go" : ended ? "win" : "lose";
    };
    const T = true;
    const F = false;
    out.early = set([T, T, T], [F, F, F]); // 상대가 2번 남았는데 3점 차
    out.notEarly = set([T, T], [F, F]);
    out.tie5 = set([T, F, T, F, T], [F, T, F, T, T]);
    out.win5 = set([T, F, T, F, T], [F, T, F, F, T]);
    out.suddenGo = set([T, F, T, F, T, T], [F, T, F, T, T], true);
    out.suddenWin = set([T, F, T, F, T, T], [F, T, F, T, T, F], true);
    out.suddenLose = set([T, F, T, F, T, F], [F, T, F, T, T, T], true);
    G.endMatch = endMatch;
    G.beginTurn = beginTurn;
    return out;
  });
  check("3:0 이면 일찍 끝난다", rules.early === "win", rules.early);
  check("2:0 은 아직 안 끝난다", rules.notEarly === "go", rules.notEarly);
  check("5번씩 차고 동점이면 계속", rules.tie5 === "go", rules.tie5);
  check("5번씩 차고 앞서면 승리", rules.win5 === "win", rules.win5);
  check("서든데스: 한쪽만 찼으면 계속", rules.suddenGo === "go", rules.suddenGo);
  check("서든데스: 넣고 막으면 승리", rules.suddenWin === "win", rules.suddenWin);
  check("서든데스: 지면 탈락", rules.suddenLose === "lose", rules.suddenLose);

  console.log("\n[실제 조작]");
  await page.evaluate(() => localStorage.removeItem("penalty-hero-v2"));
  await page.reload();
  await page.waitForFunction(() => window.PenaltyHero);
  await page.waitForTimeout(300);
  await page.click("#start-btn");
  await page.waitForFunction(() => window.PenaltyHero.state === "aim" || window.PenaltyHero.state === "keepWait", null, { timeout: 8000 });
  check("첫 경기는 내가 먼저 찬다", (await page.evaluate(() => window.PenaltyHero.state)) === "aim");
  const box = await page.locator("#game").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.8;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(40);
  check("누르면 달려 나간다", (await page.evaluate(() => window.PenaltyHero.kick.state)) === "run");
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(cx + i * 9, cy - i * 20);
    await page.waitForTimeout(25);
  }
  const aimNow = await page.evaluate(() => ({ state: window.PenaltyHero.state, ring: window.PenaltyHero.ring.visible, tx: window.PenaltyHero.drag.tx, ty: window.PenaltyHero.drag.ty }));
  check("밀면 조준 표시가 움직인다", aimNow.ring && aimNow.tx > 0.5 && aimNow.ty > 0.8, JSON.stringify(aimNow));
  await page.mouse.up();
  await page.waitForFunction(() => window.PenaltyHero.turn.kicked, null, { timeout: 3000 });
  await page.waitForFunction(() => window.PenaltyHero.turn.done, null, { timeout: 6000 });
  const r1 = await page.evaluate(() => ({ result: window.PenaltyHero.turn.result, us: window.PenaltyHero.match.us.length }));
  check("손을 떼면 차고 결과가 나온다", r1.us === 1, JSON.stringify(r1));
  await page.waitForFunction(() => window.PenaltyHero.state === "keepWait", null, { timeout: 8000 });
  check("다음은 내가 골키퍼", await page.isVisible("#keep-pad"));
  await page.waitForFunction(() => window.PenaltyHero.state === "keepRun" || window.PenaltyHero.state === "keepFlight", null, { timeout: 4000 });
  await page.click('#keep-pad button[data-x="2.6"][data-y="0.55"]');
  check("칸을 누르면 몸을 날린다", (await page.evaluate(() => window.PenaltyHero.turn.dove && window.PenaltyHero.gkAnim.state)) === "dive");
  await page.waitForFunction(() => window.PenaltyHero.match.them.length === 1, null, { timeout: 8000 });
  // 짧게 눌렀다 떼면 취소
  await page.waitForFunction(() => window.PenaltyHero.state === "aim", null, { timeout: 9000 });
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(30);
  await page.mouse.up();
  await page.waitForTimeout(60);
  check("짧게 누르면 차지 않고 다시 준비", (await page.evaluate(() => window.PenaltyHero.state)) === "aim");
  // 일시정지
  await page.click(".today-pause-btn");
  await page.waitForTimeout(100);
  const t0 = await page.evaluate(() => window.PenaltyHero.time);
  await page.waitForTimeout(200);
  check("일시정지하면 멈춘다", (await page.evaluate(() => window.PenaltyHero.time)) === t0);
  await page.click("#today-pause-resume");
  await page.waitForTimeout(200);
  check("다시 이어진다", (await page.evaluate(() => window.PenaltyHero.time)) > t0);

  // 승리 · 저장 · 패배 · 순위
  const win = await page.evaluate(() => {
    const G = window.PenaltyHero;
    G.match.us = [true, true, true];
    G.match.them = [false, false, false];
    G.endMatch(true);
    return { saved: JSON.parse(localStorage.getItem("penalty-hero-v2")), title: document.getElementById("win-title").textContent, visible: !document.getElementById("win").classList.contains("hidden") };
  });
  check("이기면 다음 경기가 저장된다", win.visible && win.saved.lv === 1, JSON.stringify(win.saved));
  await page.click("#win-btn");
  await page.waitForFunction(() => window.PenaltyHero.lv === 1 && window.PenaltyHero.state === "intro", null, { timeout: 3000 });
  check("다음 경기로 넘어간다", true);
  const lose = await page.evaluate(() => {
    const G = window.PenaltyHero;
    G.match.us = [false, false, false];
    G.match.them = [true, true, true];
    G.endMatch(false);
    return { visible: !document.getElementById("lose").classList.contains("hidden"), rank: document.getElementById("lose-rank").children.length > 0 || Boolean(document.querySelector(".today-rank-form")) };
  });
  check("지면 탈락 화면과 순위 등록이 나온다", lose.visible && lose.rank, JSON.stringify(lose));
  await page.reload();
  await page.waitForFunction(() => window.PenaltyHero);
  check("이어하기가 나온다", (await page.textContent("#start-btn")).includes("이어서"), await page.textContent("#start-btn"));
  const cup = await page.evaluate(() => {
    const G = window.PenaltyHero;
    G.startMatch(2);
    G.match.us = [true, true, true];
    G.match.them = [false, false, false];
    G.endMatch(true);
    return { trophy: !document.getElementById("win-trophy").classList.contains("hidden"), title: document.getElementById("win-title").textContent };
  });
  check("결승에서 이기면 우승 트로피", cup.trophy && cup.title.includes("우승"), cup.title);
  check("내 얼굴 기능이 켜져 있다", await page.evaluate(() => document.body.dataset.face === "1" && Boolean(document.querySelector("#title .today-face-chip"))));
  check("페이지 오류 없음", errs.length === 0, errs.slice(0, 3).join(" | "));
  check("없는 파일 요청 없음", bad.length === 0, bad.slice(0, 3).join(" | "));
  await ctx.close();

  console.log("\n[휴대폰 화면]");
  for (const [name, w, h] of [["세로", 390, 844], ["작은 세로", 360, 640], ["가로", 800, 360]]) {
    const c2 = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    const p2 = await c2.newPage();
    const e2 = [];
    p2.on("pageerror", (e) => e2.push(e.message));
    await p2.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await p2.goto(`${BASE}/games/penalty-kick/?q=low`);
    await p2.waitForFunction(() => window.PenaltyHero, null, { timeout: 60000 });
    await p2.waitForTimeout(300);
    await p2.locator("#start-btn").scrollIntoViewIfNeeded();
    await p2.locator("#start-btn").tap();
    await p2.waitForFunction(() => window.PenaltyHero.state === "aim", null, { timeout: 8000 });
    await p2.waitForTimeout(500);
    const r = await p2.evaluate(() => {
      const G = window.PenaltyHero;
      const inside = (el) => {
        const b = el.getBoundingClientRect();
        return b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
      };
      const overlap = (a, b) => {
        if (!a || !b) return false;
        const p = a.getBoundingClientRect();
        const q = b.getBoundingClientRect();
        return p.left < q.right && p.right > q.left && p.top < q.bottom && p.bottom > q.top;
      };
      const proj = (x, y, z) => {
        const v = new (G.ballMesh.position.constructor)(x, y, z).project(G.E.camera);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
      };
      const L = proj(-3.66, 0, 0);
      const R = proj(3.66, 0, 0);
      const ball = proj(0, 0.1, 11);
      const hud = document.getElementById("hud");
      const mute = document.querySelector(".today-mute-btn");
      const pause = document.querySelector(".today-pause-btn");
      const chip = document.querySelector(".score-chip");
      return { goalFits: L.x >= 0 && R.x <= innerWidth, goalW: Math.round(R.x - L.x), ballIn: ball.y > 0 && ball.y < innerHeight, hud: inside(hud), hudMute: overlap(hud, mute), hudPause: overlap(hud, pause), chipMute: overlap(chip, mute), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    check(`${name}: 골대 전체와 공이 화면 안`, r.goalFits && r.ballIn, JSON.stringify({ goalW: r.goalW, ballIn: r.ballIn }));
    check(`${name}: 전광판이 단추와 안 겹친다`, r.hud && !r.hudMute && !r.hudPause && !r.chipMute && !r.overflow, JSON.stringify(r));
    // 터치로 슛
    await p2.evaluate(() => {
      const c = document.getElementById("game");
      const mk = (type, x, y) => new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch" });
      const X = innerWidth / 2;
      const Y = innerHeight * 0.8;
      c.dispatchEvent(mk("pointerdown", X, Y));
      window.dispatchEvent(mk("pointermove", X + 20, Y - innerHeight * 0.18));
      window.dispatchEvent(mk("pointerup", X + 20, Y - innerHeight * 0.18));
    });
    await p2.waitForFunction(() => window.PenaltyHero.turn.kicked, null, { timeout: 3000 });
    check(`${name}: 터치로 슛이 나간다`, true);
    await p2.evaluate(() => {
      const G = window.PenaltyHero;
      G.match.first = "them";
      G.match.kicks = 0;
      G.beginTurn();
    });
    await p2.waitForTimeout(100);
    const pad = await p2.evaluate(() => {
      const b = document.querySelector("#keep-pad").getBoundingClientRect();
      const btn = document.querySelector("#keep-pad button").getBoundingClientRect();
      const hint = document.getElementById("hint").getBoundingClientRect();
      return { inside: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight + 1, btnH: btn.height, hintAbove: hint.bottom <= b.top + 1 };
    });
    check(`${name}: 골키퍼 칸이 화면 안 · 누르기 충분히 크다`, pad.inside && pad.btnH >= 38 && pad.hintAbove, JSON.stringify(pad));
    check(`${name}: 오류 없음`, e2.length === 0, e2.slice(0, 2).join(" | "));
    await c2.close();
  }

  await browser.close();
  console.log(`\n결과: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
