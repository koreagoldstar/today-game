/**
 * 펄스 탭 — 자동 점검
 *
 * 사용: npm run start 후 node scripts/test-beat-tap.js   (BT_SHOTS=폴더 면 화면 사진)
 *
 * - 곡 20개: 길이 · 음표 간격 · 판정 창 · 박자 칸 위 · 음악 파일 길이 안
 * - 정확한 봇: 20곡 모두 별 3개
 * - 서툰 아이 봇(타이밍이 많이 어긋나고 가끔 놓침): 1코스에서 별을 받음
 * - 안 누르면: 1코스는 끝까지 가고(실패 없음), 2코스부터는 실패 화면
 * - 진짜 음악 시계로 실제 시간 동안 돌아감 · 저장 · 일시정지
 */
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BT_BASE || "http://localhost:3456";
const SHOTS = process.env.BT_SHOTS || "";
const results = [];
const check = (name, ok, detail) => {
  results.push(!!ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
  const bad = [];
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) bad.push(`${r.status()} ${r.url()}`);
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/games/beat-tap/`);
  await page.waitForFunction(() => window.PulseTap);
  await page.evaluate(() => document.fonts.ready);
  await sleep(300);
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "title.png") });
  }

  // 곡 자료
  const songs = await page.evaluate(() =>
    window.PulseTap.SONGS.map((s) => {
      const c = window.PulseTap.COURSES[s.course];
      let minGap = 99;
      for (let i = 1; i < s.chart.length; i++) minGap = Math.min(minGap, s.chart[i].time - s.chart[i - 1].time);
      // 모든 음표가 박자 칸 위에 있나
      const grid = s.beatSec / 4;
      const onGrid = s.chart.every((n) => {
        const k = (n.time - s.lead) / grid;
        return Math.abs(k - Math.round(k)) < 1e-6;
      });
      return { name: s.name, course: s.course, n: s.chart.length, len: s.end, minGap, good: c.good, approach: c.approach, first: s.chart[0].time, onGrid, src: s.src, startAt: s.startAt };
    })
  );
  check("곡 20개 · 무대 4개", songs.length === 20 && new Set(songs.map((s) => s.course)).size === 4);
  check("모든 곡 길이 20~90초", songs.every((s) => s.len >= 20 && s.len <= 90), songs.map((s) => Math.round(s.len)).join(","));
  check("모든 곡 음표 10개 이상", songs.every((s) => s.n >= 10), songs.map((s) => s.n).join(","));
  check("첫 무대는 음표 간격 0.4초 이상", songs.filter((s) => s.course === 0).every((s) => s.minGap >= 0.4), songs.filter((s) => s.course === 0).map((s) => s.minGap.toFixed(2)).join(","));
  check("판정 창이 다음 음과 겹치지 않음", songs.every((s) => s.minGap >= s.good), songs.filter((s) => s.minGap < s.good).map((s) => s.name));
  check("첫 노트가 맨 위에서 내려올 시간이 있음", songs.every((s) => s.first >= s.approach), songs.map((s) => s.first.toFixed(1)).join(","));
  check("모든 음표가 곡의 박자 칸 위에 있음", songs.every((s) => s.onGrid));
  // 곡 파일 길이 안에 들어가나
  const durs = await page.evaluate(async () => {
    const out = {};
    for (const s of window.PulseTap.SONGS) {
      if (out[s.src]) continue;
      out[s.src] = await new Promise((res) => {
        const a = new Audio();
        a.preload = "metadata";
        a.onloadedmetadata = () => res(a.duration);
        a.onerror = () => res(0);
        a.src = s.src;
      });
    }
    return out;
  });
  const overflow = songs.filter((s) => s.startAt < 0 || s.startAt + s.len > durs[s.src] - 0.2);
  check("모든 곡이 음악 파일 길이 안에서 끝남", overflow.length === 0 && Object.values(durs).every((d) => d > 0), overflow.map((s) => s.name));

  // 봇 플레이 (시계를 직접 돌림)
  const play = (idx, mode, seed = 7) =>
    page.evaluate(
      ({ idx, mode, seed }) => {
        const P = window.PulseTap;
        P.manual();
        P.start(idx);
        let s = seed;
        const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        const dt = 1 / 60;
        const plan = P.notes.map((n) => {
          if (mode === "none") return null;
          if (mode === "perfect") return n.time;
          if (rnd() < 0.15) return null; // 가끔 놓침
          return n.time + (rnd() - 0.5) * 0.44; // ±0.22초
        });
        let k = 0;
        let guard = 0;
        while (P.state === "play" && guard++ < 60 * 150) {
          P.tick(dt);
          while (k < plan.length && (plan[k] == null || P.time >= plan[k])) {
            if (plan[k] != null && P.state === "play") P.tap();
            k++;
          }
        }
        return { state: P.state, ratio: P.ratio(), hits: P.hits, total: P.notes.length, stars: P.stars()[idx] };
      },
      { idx, mode, seed }
    );

  const perfect = [];
  for (let i = 0; i < 20; i++) perfect.push(await play(i, "perfect"));
  check("정확한 봇: 20곡 모두 끝까지 · 전부 먹음", perfect.every((r) => r.state !== "play" && r.state !== "over" && r.hits === r.total), perfect.filter((r) => r.hits !== r.total || r.state === "over"));
  const star3 = await page.evaluate(() => window.PulseTap.stars());
  check("정확한 봇: 20곡 모두 별 3개", star3.every((v) => v === 3), star3.join(""));

  await page.evaluate(() => {
    localStorage.clear();
  });
  const kid = [];
  for (let i = 0; i < 5; i++) kid.push(await play(i, "kid", 11 + i));
  check("서툰 아이 봇: 1코스 5곡 끝까지 · 별을 받음", kid.every((r) => r.state !== "over" && r.ratio >= 0.4), kid.map((r) => `${r.hits}/${r.total}`).join(" "));
  const kid2 = await play(5, "kid", 31);
  check("서툰 아이 봇: 2코스 첫 곡도 끝까지", kid2.state !== "over", `${kid2.hits}/${kid2.total}`);

  const none1 = await play(0, "none");
  check("안 눌러도 1코스는 끝까지 (실패 없음)", none1.state === "clear" && none1.hits === 0, none1);
  const none2 = await play(5, "none");
  check("안 누르면 2코스는 실패 화면", none2.state === "over", none2);

  await page.reload();
  await page.waitForFunction(() => window.PulseTap);
  const kept = await page.evaluate(() => window.PulseTap.stars().some((v) => v > 0));
  check("별이 저장됨", kept);

  // 진짜 시간 · 진짜 버튼
  await page.tap("#start-btn");
  await sleep(1500);
  const live = await page.evaluate(() => ({ mode: window.PulseTap.clockMode, t: window.PulseTap.time, state: window.PulseTap.state }));
  check("시작 버튼 · 음악 시계로 시간이 흐름", live.state === "play" && live.t > 0.3 && live.mode === "audio", live);
  // 실제 음표 시각에 화면 누르기
  const realHits = await page.evaluate(async () => {
    const P = window.PulseTap;
    const c = document.getElementById("game");
    const press = () => c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 200, clientY: 400 }));
    let done = 0;
    for (const n of P.notes.slice(0, 3)) {
      while (P.time < n.time) await new Promise((r) => setTimeout(r, 5));
      press();
      done++;
    }
    return { pressed: done, hits: P.hits, playing: !P.musicEl.paused, audioT: P.musicEl.currentTime };
  });
  check("화면을 눌러 실제 음악 시간에 맞힘", realHits.hits === 3 && realHits.playing, realHits);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "play-live.png") });

  // 일시정지하면 시간이 멈춤
  const paused = await page.evaluate(async () => {
    const btn = document.getElementById("today-pause-btn");
    if (!btn) return { skip: true };
    btn.click();
    await new Promise((r) => setTimeout(r, 120));
    const t0 = window.PulseTap.time;
    await new Promise((r) => setTimeout(r, 500));
    const t1 = window.PulseTap.time;
    const st = window.PulseTap.state;
    return { st, moved: t1 - t0 };
  });
  check("일시정지하면 음악과 시간이 멈춤", paused.st === "paused" && Math.abs(paused.moved) < 0.02, paused);

  // 코스별 화면
  if (SHOTS) {
    for (const [i, at] of [[0, 0.5], [7, 0.5], [12, 0.5], [17, 0.5]]) {
      await page.evaluate(
        ({ i, at }) => {
          const P = window.PulseTap;
          P.manual();
          P.start(i);
          const N = P.notes;
          const target = N[Math.floor(N.length * at)].time - 0.05;
          let k = 0;
          while (P.time < target && P.state === "play") {
            P.tick(1 / 60);
            while (k < N.length && P.time >= N[k].time) {
              P.tap();
              k++;
            }
          }
          P.draw();
        },
        { i, at }
      );
      await page.screenshot({ path: path.join(SHOTS, `song-${i + 1}.png`) });
    }
    await page.evaluate(() => {
      const P = window.PulseTap;
      P.manual();
      P.start(1);
      let k = 0;
      const N = P.notes;
      while (P.state === "play") {
        P.tick(1 / 60);
        while (k < N.length && P.time >= N[k].time) {
          P.tap();
          k++;
        }
      }
      for (let i = 0; i < 40; i++) P.tick(1 / 60);
      P.draw();
    });
    await sleep(900);
    await page.screenshot({ path: path.join(SHOTS, "clear.png") });
    await page.click("#menu-btn");
    await sleep(200);
    await page.screenshot({ path: path.join(SHOTS, "songs.png") });
  }

  check("콘솔 오류 없음", errs.length === 0, errs.slice(0, 5));
  check("없는 파일 없음", bad.length === 0, bad.slice(0, 5));
  await browser.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n${results.length - fail} / ${results.length} 통과`);
  process.exit(fail ? 1 : 0);
})();
