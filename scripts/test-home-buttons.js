/**
 * 모든 게임 — 집 모양 홈 버튼 자동 점검 (아이들도 알아보는 홈 버튼)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-home-buttons.js   (HB_ONLY=tetris,sokoban 처럼 골라서도 됨)
 *
 * - 첫 화면: 집 버튼(공용 · 교육 게임의 집 아이콘)이 보이고 누를 수 있음 · 링크 안에 링크가 겹치지 않음
 *   · 홈으로 가는 글자 링크(← 홈 · ← 오늘의 게임)에는 모두 집 그림
 * - 스테이지 지도 · 목록 화면(data-today-home): 집 버튼이 보이고 · 눌리고 · 뒤로 버튼 · 제목을 가리지 않음
 * - 집 버튼을 누르면 실제로 홈(/)으로 감
 * - /api/* 는 가짜 응답
 */
"use strict";

const path = require("path");
const fs = require("fs");
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.error("playwright 가 필요해요: npm i -D playwright");
  process.exit(2);
}

const ROOT = path.join(__dirname, "..");
const BASE = process.env.HB_BASE || "http://localhost:3456";
const ONLY = (process.env.HB_ONLY || "").split(",").filter(Boolean);
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}

const games = fs
  .readdirSync(path.join(ROOT, "games"))
  .filter((g) => fs.existsSync(path.join(ROOT, "games", g, "index.html")))
  .filter((g) => !ONLY.length || ONLY.includes(g));
const panels = {};
for (const g of games) {
  const html = fs.readFileSync(path.join(ROOT, "games", g, "index.html"), "utf8");
  const ids = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*data-today-home/g)].map((m) => m[1]);
  if (ids.length) panels[g] = ids;
}

async function open(browser, g, { width = 390, height = 844, errors }) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 800, isMobile: width < 800, serviceWorkers: "block" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${g}: ${e.message.slice(0, 120)}`));
  await p.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"scores":[],"items":[]}' }));
  await p.goto(`${BASE}/games/${g}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForFunction(() => window.TodayChrome && document.querySelector(".today-brand, .today-home-icon"), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(900); // 공용 스크립트가 버튼을 다시 놓는 주기(0.8초) 한 번
  p.ctx = ctx;
  return p;
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11"] });
  } catch (_) {
    browser = await chromium.launch();
  }
  const errors = [];

  /* ---------- H1: 모든 게임 첫 화면 ---------- */
  const bad = [];
  let okN = 0;
  for (const g of games) {
    const p = await open(browser, g, { errors });
    const r = await p.evaluate(() => {
      const vis = (el) => {
        if (!el) return false;
        const q = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return q.width > 0 && q.height > 0 && s.visibility !== "hidden" && s.display !== "none" && q.bottom > 0 && q.top < innerHeight && q.right > 0 && q.left < innerWidth;
      };
      const houses = [...document.querySelectorAll(".today-brand, .today-home-icon")].filter(vis);
      const pressable = houses.filter((h) => {
        const q = h.getBoundingClientRect();
        const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return t && (t === h || h.contains(t));
      });
      const big = houses.filter((h) => {
        const q = h.getBoundingClientRect();
        return q.width >= 40 && q.height >= 40;
      });
      const nested = document.querySelectorAll("a a").length;
      const plain = [...document.querySelectorAll('a[href="/"], a[href="../../"], a[href="/index.html"]')].filter((a) => vis(a) && !a.querySelector("svg")).map((a) => a.textContent.trim().slice(0, 12));
      return { houses: houses.length, pressable: pressable.length, big: big.length, nested, plain };
    });
    const ok = r.houses >= 1 && r.pressable >= 1 && r.big >= 1 && r.nested === 0 && r.plain.length === 0;
    if (ok) okN++;
    else bad.push(`${g}(집 ${r.houses} · 눌림 ${r.pressable} · 40px+ ${r.big} · 겹친 링크 ${r.nested}${r.plain.length ? " · 그림 없는 홈 링크 " + r.plain.join("/") : ""})`);
    await p.ctx.close();
  }
  check("H1", `모든 게임 첫 화면에 집 모양 홈 버튼 (보임 · 누를 수 있음 · 40px 이상) · 홈 글자 링크에도 집 그림 · 링크 겹침 없음`, bad.length === 0, `${okN}/${games.length}${bad.length ? " · 문제 " + bad.join(" | ") : ""}`);

  /* ---------- H2: 스테이지 지도 · 목록 화면 (휴대폰 · PC) ---------- */
  const out = [];
  let pass = 0;
  let total = 0;
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    for (const [g, ids] of Object.entries(panels)) {
      const p = await open(browser, g, { width: w, height: h, errors });
      for (const id of ids) {
        total++;
        const r = await p.evaluate((id) => {
          for (const s of document.querySelectorAll("section.screen")) if (s.id !== id) s.hidden = true;
          const el = document.getElementById(id);
          el.hidden = false;
          el.classList.remove("hidden");
          const a = el.querySelector(".today-home-btn");
          if (!a) return { why: "버튼 없음" };
          const q = a.getBoundingClientRect();
          const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
          const head = el.querySelector(".panel-head, header");
          // 머리줄의 뒤로 버튼 · 제목 글자를 가리지 않는지 (글자 영역 기준)
          const hits = [];
          for (const n of head ? head.querySelectorAll("button, h1, h2, p") : []) {
            const range = document.createRange();
            range.selectNodeContents(n);
            const b = n.tagName === "BUTTON" ? n.getBoundingClientRect() : range.getBoundingClientRect();
            if (b.width && b.left < q.right - 3 && b.right > q.left + 3 && b.top < q.bottom - 3 && b.bottom > q.top + 3) hits.push(n.tagName);
          }
          return { pressed: !!t && (t === a || a.contains(t)), big: q.width >= 40 && q.height >= 40, inView: q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight, hits };
        }, id);
        const ok = !r.why && r.pressed && r.big && r.inView && r.hits.length === 0;
        if (ok) pass++;
        else out.push(`${w} ${g}#${id}: ${r.why || `눌림 ${r.pressed} · 크기 ${r.big} · 화면 안 ${r.inView} · 가림 ${r.hits.join(",")}`}`);
      }
      await p.ctx.close();
    }
  }
  check("H2", "스테이지 지도 · 목록 화면마다 집 버튼 (휴대폰 · PC) — 보임 · 누를 수 있음 · 뒤로 버튼과 제목을 안 가림", out.length === 0, `${pass}/${total}${out.length ? " · " + out.join(" | ") : ""}`);

  /* ---------- H3: 실제로 눌러 보면 홈으로 ---------- */
  const nav = [];
  for (const [g, how] of [
    ["tetris", ".today-brand"],
    ["edu-jamo-zoo", "#title .today-home-icon"],
    ["jelly-factory", "#stages .today-home-btn"],
  ]) {
    if (!games.includes(g)) continue;
    const p = await open(browser, g, { errors });
    if (g === "jelly-factory") {
      await p.click("#stage-btn").catch(() => {});
      await p.waitForTimeout(300);
    }
    // 실제 손가락 · 마우스처럼 버튼 가운데를 누름
    const c = await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      const q = el.getBoundingClientRect();
      return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
    }, how);
    await Promise.all([p.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {}), p.mouse.click(c.x, c.y)]);
    nav.push(`${g}:${new URL(p.url()).pathname === "/" ? "홈" : p.url()}`);
    await p.ctx.close();
  }
  check("H3", "집 버튼을 누르면 홈(/)으로 이동 (첫 화면 · 교육 게임 · 스테이지 목록)", nav.every((x) => x.endsWith(":홈")), nav.join(", "));
  check("H4", "페이지 오류 없음", errors.length === 0, errors.length ? errors.slice(0, 5) : "없음");

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e.message);
  process.exit(1);
});
