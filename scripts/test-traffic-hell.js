/* 교통지옥 시뮬레이션 점검 (node scripts/test-traffic-hell.js)
 * 차량 이동 · 안전거리 · 신호 · 충돌 방지 · 좌회전 · 차종 특성 · 긴급 차량 · 정체 · 사고 · 승패 · 무한 · 오늘의 판 · 성능
 */
"use strict";
const path = require("path");
const TH = require(path.join(__dirname, "../games/traffic-hell/sim.js"));
const LV = require(path.join(__dirname, "../games/traffic-hell/levels.js"));

let pass = 0;
let fail = 0;
function ok(name, cond, info = "") {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}${info ? " · " + info : ""}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${info ? " · " + info : ""}`);
  }
}
const ALL = [...LV.STAGES, ...LV.MISSIONS, LV.ENDLESS, LV.daily("2026-11-21"), LV.TUTORIAL];

function obb(a, b) {
  const ax = [Math.cos(a.ang), Math.sin(a.ang)];
  const ay = [-ax[1], ax[0]];
  const bx = [Math.cos(b.ang), Math.sin(b.ang)];
  const by = [-bx[1], bx[0]];
  const d = [b.x - a.x, b.y - a.y];
  for (const n of [ax, ay, bx, by]) {
    const ra = (a.T.len / 2) * Math.abs(ax[0] * n[0] + ax[1] * n[1]) + (a.T.wid / 2) * Math.abs(ay[0] * n[0] + ay[1] * n[1]);
    const rb = (b.T.len / 2) * Math.abs(bx[0] * n[0] + bx[1] * n[1]) + (b.T.wid / 2) * Math.abs(by[0] * n[0] + by[1] * n[1]);
    if (Math.abs(d[0] * n[0] + d[1] * n[1]) > ra + rb - 0.15) return false;
  }
  return true;
}
// 봇으로 끝까지 (견인도 자동)
function run(L, o = {}) {
  const sim = TH.create(L, { seed: o.seed });
  const watch = { overlap: 0, jump: 0, minGap: 99, redEntries: 0, entries: 0, turnSpeedMax: {}, offPath: 0 };
  const prev = new Map();
  const limit = o.limit || (L.goal.time || 400) + 5;
  while (sim.status === "play" && sim.t < limit) {
    if (o.policy) o.policy(sim);
    else if (sim.steps % 15 === 0) TH.bot(sim);
    if (!o.noTow) for (const v of sim.vehicles) if ((v.broken || v.crashed) && !v.towing && (v.brokenT > 3 || v.crashT > 3 || v.crashT < -1e8)) sim.tow(v.id);
    const before = new Map(sim.vehicles.map((v) => [v.id, v.segs[v.si]]));
    sim.step();
    if (o.check && sim.steps % 3 === 0) {
      const vs = sim.vehicles;
      for (const v of vs) {
        const p = prev.get(v.id);
        if (p) {
          const dd = Math.hypot(v.x - p[0], v.y - p[1]);
          if (dd > v.T.v0 * TH.DT * 3 + 0.3) watch.jump++;
        }
        prev.set(v.id, [v.x, v.y]);
        // 같은 구간 앞차와의 간격
        const sg = v.segs[v.si];
        const i = sg.occ.indexOf(v);
        if (i > 0) {
          const g = sg.occ[i - 1].s - sg.occ[i - 1].T.len - v.s;
          if (g < watch.minGap) watch.minGap = g;
        }
        // 회전 중 속도
        if (sg.kind === "path" && sg.turn !== "S") watch.turnSpeedMax[v.type] = Math.max(watch.turnSpeedMax[v.type] || 0, v.v);
      }
      for (let i = 0; i < vs.length; i++)
        for (let j = i + 1; j < vs.length; j++) {
          const a = vs[i];
          const b = vs[j];
          if (a.crashed || b.crashed) continue;
          if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 > 220) continue;
          if (obb(a, b)) watch.overlap++;
        }
    }
    for (const v of sim.vehicles) {
      const b = before.get(v.id);
      const now = v.segs[v.si];
      if (b && b !== now && now.kind === "path") {
        watch.entries++;
        if (!v.em && v.clearing && sim.signalOf(now.inter, now.mvKey) === "R" && !v.rush) watch.redEntries++;
      }
    }
  }
  return { sim, watch, st: sim.stats() };
}

/* 1. 도로망 · 경로 */
for (const L of ALL) {
  const sim = TH.create(L);
  const n = sim.net;
  let bad = 0;
  for (const E of sim.entries) {
    const list = sim.routes.get(E);
    if (!list || !list.length) bad++;
    else if (Math.abs(list.reduce((a, o) => a + o.w, 0) - 1) > 1e-6) bad++;
  }
  ok(`망 ${L.id}: 입구마다 경로가 있고 확률 합 1`, bad === 0, `입구 ${sim.entries.length} · 출구 ${sim.exits.length} · 링크 ${n.links.length}`);
}

/* 2. 신호 단계 안에서 보호 이동끼리 충돌 구간이 없다 (좌회전 · 직진 동시 허용 검증) */
{
  let checked = 0;
  let bad = [];
  for (const L of ALL) {
    const sim = TH.create(L);
    for (const I of sim.net.inters) {
      // 가능한 모든 경로 만들기
      for (const k in I.inLink) {
        const Lin = I.inLink[k];
        const use = TH.laneUse(Lin);
        for (let i = 0; i < Lin.n; i++)
          for (const t of use[i]) {
            const oh = (+k + 2 + (t === "S" ? 0 : t === "R" ? 1 : 3)) % 4;
            const Lout = I.outLink[oh];
            if (!Lout) continue;
            for (let j = 0; j < Lout.n; j++) TH.getPath(sim.net, I, +k, i, t, j);
          }
      }
      for (const ph of I.phases) {
        for (const P of I.paths) {
          if (ph.mv[P.mvKey] !== "G") continue;
          for (const c of P.conf) {
            if (c.sib) continue;
            if (ph.mv[c.q.mvKey] === "G") {
              // 합류(같은 나가는 차로)는 서로 다른 차로에서 오는 경우만 문제
              bad.push(`${L.id}/${I.id}/${ph.id}: ${P.mvKey}${P.inLane}>${P.outLane} × ${c.q.mvKey}${c.q.inLane}>${c.q.outLane}`);
            }
          }
          checked++;
        }
      }
    }
  }
  ok("신호 단계 안 보호 이동끼리 경로가 겹치지 않음", bad.length === 0, `${checked}개 경로 · ${bad.slice(0, 4).join(" | ")}`);
}

/* 3. 신호 전환 */
{
  const sim = TH.create(LV.STAGES[0]);
  const I = sim.net.inters[0];
  for (let i = 0; i < 30 * 8; i++) sim.step();
  ok("시작 신호 = 남북 직진 초록", I.cur === 0 && I.state === "G" && sim.signalOf(I, "NS") === "G" && sim.signalOf(I, "ES") === "R");
  sim.setPhase(0, 1);
  ok("바꾸면 노란불 · 남북 Y · 동서 R", I.state === "Y" && sim.signalOf(I, "NS") === "Y" && sim.signalOf(I, "ES") === "R");
  for (let i = 0; i < Math.round(TH.YELLOW * 30) + 2; i++) sim.step();
  ok("노란불 2.5초 뒤 동서 초록", I.state === "G" && I.cur === 1 && sim.signalOf(I, "ES") === "G" && sim.signalOf(I, "NS") === "R");
  const before = sim.score.sw;
  sim.setPhase(0, 0);
  ok("5초 안에 또 바꾸면 신호 급변경 감점", sim.score.sw === before - 25 && sim.st.quick === 1);
  sim.setPhase(0, 1);
  ok("노란불 중 원래 신호로 되돌리면 바로 초록", I.state === "G" && I.cur === 1);
  const s2 = TH.create(LV.STAGES[5]);
  const J = s2.net.inters[0];
  s2.setPhase(0, 2);
  for (let i = 0; i < 80; i++) s2.step();
  ok("좌회전 단계: NL · SL 초록, NS 빨강", s2.signalOf(J, "NL") === "G" && s2.signalOf(J, "SL") === "G" && s2.signalOf(J, "NS") === "R");
  const s3 = TH.create(LV.STAGES[8]);
  ok("비보호 좌회전: 직진 단계에서 좌회전은 P", s3.signalOf(s3.net.inters[0], "NL") === "P");
}

/* 4~9. 모든 단계를 봇으로 플레이: 이동 · 간격 · 충돌 · 승패 */
const results = {};
for (const L of ALL) {
  if (L.id === "endless") continue;
  const r = run(L, { check: true });
  results[L.id] = r;
}
{
  const jumps = Object.values(results).reduce((a, r) => a + r.watch.jump, 0);
  const ov = Object.values(results).reduce((a, r) => a + r.watch.overlap, 0);
  const minGap = Math.min(...Object.values(results).map((r) => r.watch.minGap));
  ok("차량이 경로를 따라 이동 (순간 이동 없음)", jumps === 0, `튐 ${jumps}`);
  ok("사고 아닌 차끼리 겹치지 않음 (OBB)", ov === 0, `겹침 ${ov}`);
  ok("같은 차로 앞차와 간격 유지", minGap > 0.25, `최소 ${minGap.toFixed(2)}m`);
  const tsm = {};
  for (const r of Object.values(results)) for (const k in r.watch.turnSpeedMax) tsm[k] = Math.max(tsm[k] || 0, r.watch.turnSpeedMax[k]);
  ok("회전 속도 제한 (버스 · 트럭이 가장 느림)", tsm.bus <= TH.TYPES.bus.turnV + 0.6 && tsm.truck <= TH.TYPES.truck.turnV + 0.6 && tsm.car <= TH.TYPES.car.turnV + 0.6, JSON.stringify(Object.fromEntries(Object.entries(tsm).map(([k, v]) => [k, +v.toFixed(1)]))));
  const red = Object.values(results).reduce((a, r) => a + r.watch.redEntries, 0);
  const ent = Object.values(results).reduce((a, r) => a + r.watch.entries, 0);
  ok("빨간불 진입은 딜레마 구간(못 멈춤)뿐 · 아주 드묾", red / ent < 0.01, `${red}/${ent}`);
  const acc = Object.values(results).reduce((a, r) => a + r.st.acc, 0);
  ok("신호를 차분히 운영하면 사고가 거의 없다", acc <= 6, `26개 판 사고 ${acc}`);
  let won = 0;
  const lost = [];
  for (const [id, r] of Object.entries(results)) {
    if (id === "tutorial") continue;
    if (r.sim.status === "win") won++;
    else lost.push(`${id}:${r.sim.reason}`);
  }
  ok("기준 봇이 스테이지 · 미션 · 오늘의 판을 깬다 (해결 불가 판 없음)", lost.length === 0, `${won}판 성공 ${lost.join(",")}`);
}
{
  // 급한 운전자 없이 = 신호를 지키는 차끼리는 사고 0
  let acc = 0;
  for (const L of [...LV.STAGES, ...LV.MISSIONS]) acc += run(Object.assign({}, L, { rush: 0 })).st.acc;
  ok("교차로 진입 관리: 급한 운전자가 없으면 사고 0", acc === 0, `사고 ${acc}`);
}

/* 10. 좌회전 · 직진 처리 */
{
  const r = results.s6;
  const lefts = r.sim.st.passed;
  const s = TH.create(LV.STAGES[5]);
  // 직진만 계속 → 좌회전 차는 못 감
  let leftIn = 0;
  for (let i = 0; i < 30 * 90; i++) {
    const b = new Map(s.vehicles.map((v) => [v.id, v.si]));
    s.step();
    for (const v of s.vehicles) if (b.get(v.id) !== v.si && v.segs[v.si].kind === "path" && v.segs[v.si].turn === "L") leftIn++;
  }
  ok("직진 신호만 주면 좌회전 차로는 정지선에서 기다림", leftIn === 0, `좌회전 진입 ${leftIn} · 봇 판 통과 ${lefts}`);
  // 비보호: 맞은편이 끊기면 좌회전이 빠진다
  const p = TH.create(LV.STAGES[8]);
  let permIn = 0;
  for (let i = 0; i < 30 * 90; i++) {
    const b = new Map(p.vehicles.map((v) => [v.id, v.si]));
    p.step();
    for (const v of p.vehicles) if (b.get(v.id) !== v.si && v.segs[v.si].kind === "path" && v.segs[v.si].turn === "L") permIn++;
  }
  ok("비보호 좌회전은 틈을 보고 진입", permIn > 3 && p.st.acc === 0, `좌회전 ${permIn}대 · 사고 ${p.st.acc}`);
}

/* 11. 차종 특성 */
{
  const T = TH.TYPES;
  ok("차종 8가지", ["car", "taxi", "bus", "truck", "moto", "ambulance", "fire", "police"].every((k) => T[k]));
  ok("버스: 길고 가속 느리고 회전 느림", T.bus.len > 10 && T.bus.a < T.car.a / 2 && T.bus.turnV < T.car.turnV);
  ok("트럭: 크고 정지 거리 김", T.truck.len > 8 && T.truck.b < T.car.b && T.truck.bMax < T.car.bMax);
  ok("오토바이: 작고 가속 빠르고 간격 좁음", T.moto.len < 2.5 && T.moto.a > T.car.a && T.moto.s0 < T.car.s0);
  // 실제 가속: 같은 출발에서 10 m/s 도달 시간
  const reach = (type) => {
    const L = LV.single({ arms: { W: [1, 1], E: [1, 1] }, phases: ["EW"] });
    const lvl = Object.assign({}, L, { id: "accel", demand: {}, goal: { time: 60, maxAcc: 9 }, events: [] });
    const s = TH.create(lvl);
    const E = s.net.linkById["A.W.in"];
    const route = TH.findRoute(s.net, E, s.net.linkById["A.E.out"]);
    E.queue.push({ type, route });
    s.step();
    const v = s.vehicles[0];
    v.v = 0;
    let t = 0;
    while (v.v < 10 && t < 30) {
      s.step();
      t += TH.DT;
    }
    return t;
  };
  const tc = reach("car");
  const tb = reach("bus");
  const tt = reach("truck");
  const tm = reach("moto");
  ok("가속 실측: 오토바이 < 승용차 < 버스 · 트럭", tm < tc && tc < tb && tc < tt, `0→36km/h 오토바이 ${tm.toFixed(1)}s · 승용 ${tc.toFixed(1)}s · 버스 ${tb.toFixed(1)}s · 트럭 ${tt.toFixed(1)}s`);
  // 노란불 딜레마: 같은 거리에서 트럭은 못 서고 지나간다
  ok("정지 거리: 13m/s 에서 트럭이 승용차보다 김", (13 * 13) / (2 * T.truck.b) > (13 * 13) / (2 * T.car.b) * 1.5);
}

/* 12. 긴급 차량 */
{
  const r = results.s11;
  ok("긴급 차량 2대 통과 · 지체 18초 이내 (봇)", r.sim.st.emPassed === 2 && r.sim.st.emMax <= 18, `최대 지체 ${r.sim.st.emMax.toFixed(1)}s`);
  // 계속 빨간불이면: 멈췄다가 살피고 천천히 지나감 + 지체
  const L = Object.assign({}, LV.STAGES[10], { demand: {} });
  const s = TH.create(L);
  s.setPhase(0, 1); // 동서 직진만 (구급차는 북쪽)
  let cautious = false;
  while (s.status === "play" && s.t < 120) {
    s.step();
    if (s.vehicles.some((v) => v.em && v.cautious)) cautious = true;
  }
  ok("빨간불의 긴급 차량은 멈췄다 안전할 때 천천히 통과 (지체 발생)", cautious && s.st.emPassed >= 1 && s.st.emMax > 3 && s.st.acc === 0, `지체 ${s.st.emMax.toFixed(1)}s`);
  const m1 = results.m1;
  ok("미션 골든타임: 봇 성공 (각 15초 이내)", m1.sim.status === "win" && m1.sim.st.emMax <= 15, `최대 ${m1.sim.st.emMax.toFixed(1)}s`);
}

/* 13. 정체 계산 */
{
  const idle = TH.create(LV.STAGES[9]);
  while (idle.status === "play") idle.step();
  const r = results.s10;
  ok("신호를 안 바꾸면 정체 지수가 오르고 도시 마비", idle.status === "fail" && (idle.reason === "grid" || idle.reason === "time") && idle.st.maxCong > 70, `방치 최고 ${idle.st.maxCong.toFixed(0)} · 봇 최고 ${r.st.maxCong.toFixed(0)}`);
  ok("봇 운영 정체 < 방치 정체", r.st.maxCong < idle.st.maxCong);
  ok("대기 · 평균 대기 · 통과 지표 계산", r.st.passed > 0 && r.st.avgWait > 0 && typeof r.st.waiting === "number");
}

/* 14. 사고 · 감점 */
{
  let crashes = 0;
  let accScore = 0;
  const causes = {};
  for (const id of ["s3", "s6", "s10", "s16", "s19", "s20"]) {
    for (const per of [3.5, 4.5, 6]) {
      const L = LV.STAGES.find((s) => s.id === id);
      const s = TH.create(L, { seed: "reckless" + per });
      const k = Math.round(per * 30);
      while (s.status === "play") {
        if (s.steps % k === 0) s.net.inters.forEach((I, i) => s.cyclePhase(i));
        s.step();
      }
      crashes += s.st.acc;
      accScore += s.score.acc;
      for (const e of s.events) if (e.k === "crash") causes[e.cause] = (causes[e.cause] || 0) + 1;
    }
  }
  ok("신호를 마구 바꾸면 실제로 사고가 난다", crashes >= 3, `사고 ${crashes} · 원인 ${JSON.stringify(causes)}`);
  ok("사고는 큰 감점 (한 건에 200~350점)", accScore <= -200 * crashes, `${accScore}점`);
  // 사고 차는 길을 막고, 견인하면 치워진다
  const m2 = TH.create(LV.MISSIONS[1]);
  for (let i = 0; i < 5; i++) m2.step();
  const wreck = m2.vehicles.filter((v) => v.crashed);
  ok("사고 수습 미션: 시작부터 사고 차 2대", wreck.length === 2);
  m2.tow(wreck[0].id);
  for (let i = 0; i < 90; i++) m2.step();
  ok("견인하면 2.5초 뒤 치워짐", !m2.vehicles.includes(wreck[0]) && m2.vehicles.includes(wreck[1]));
}

/* 15. 승패 조건 */
{
  const r = results.s1;
  ok("목표 대수를 채우면 성공", r.sim.status === "win" && r.sim.reason === "pass" && r.st.passed >= 30);
  const s = TH.create(LV.STAGES[0]);
  while (s.status === "play") s.step();
  ok("방치하면 시간 초과 또는 마비로 실패", s.status === "fail" && ["time", "grid"].includes(s.reason), s.reason);
  const a = TH.create(LV.STAGES[0]);
  a.st.acc = 3;
  a.step();
  ok("사고 한도를 넘으면 실패", a.status === "fail" && a.reason === "acc");
  ok("성공 보너스: 무사고 +300 · 남은 시간", r.sim.score.bonus >= 300);
  const m3 = results.m3;
  ok("교통대란 미션: 정체 80 미만으로 150초 버티면 성공", m3.sim.status === "win" && m3.sim.reason === "time");
}

/* 16. 무한 모드 */
{
  const r = run(LV.ENDLESS, { limit: 900 });
  const s = r.sim;
  ok("무한: 차량이 계속 늘다가 결국 끝난다", s.status === "fail" && s.t > 120, `생존 ${s.t.toFixed(0)}s · 통과 ${s.st.passed} · 이유 ${s.reason}`);
  ok("무한: 생존 보너스 = 2 × 초", s.score.bonus === Math.round(s.t * 2));
  ok("무한: 긴급 차량 · 고장 자동 발생", s.st.emPassed + s.vehicles.filter((v) => v.em).length >= 1 && s.st.tows >= 1, `긴급 ${s.st.emPassed} · 견인 ${s.st.tows}`);
  const r2 = run(LV.ENDLESS, { limit: 900 });
  ok("무한: 같은 조작이면 같은 결과 (재현)", r2.sim.total() === s.total() && r2.st.passed === s.st.passed);
}

/* 17. 오늘의 교통지옥: 날짜가 같으면 같은 조건 */
{
  const a = JSON.stringify(LV.daily("2026-11-21"));
  const b = JSON.stringify(LV.daily("2026-11-21"));
  const c = JSON.stringify(LV.daily("2026-11-22"));
  ok("같은 날짜 = 같은 도로 · 수요 · 이벤트", a === b);
  ok("다른 날짜 = 다른 조건", a !== c);
  const r1 = run(LV.daily("2026-11-21"));
  const r2 = run(LV.daily("2026-11-21"));
  ok("같은 날짜 · 같은 조작 = 같은 점수 (공정 경쟁)", r1.sim.total() === r2.sim.total() && r1.st.passed === r2.st.passed, `${r1.sim.total()}점`);
  const days = new Set();
  for (let i = 0; i < 30; i++) days.add(LV.daily(`2026-12-${String(i + 1).padStart(2, "0")}`).inters.length + ":" + LV.daily(`2026-12-${String(i + 1).padStart(2, "0")}`).theme);
  ok("한 달 동안 여러 도로 · 테마가 돈다", days.size >= 4, [...days].join(" "));
  ok("오늘의 판은 4분 고정 · 끝까지 진행", r1.sim.status !== "play" && (r1.sim.reason === "time" || r1.sim.status === "fail"));
}

/* 18. 성능: 기기 속도와 상관없는 고정 걸음 · 차량이 많아도 빠름 */
{
  const L = Object.assign({}, LV.STAGES[19], { demand: { "*": 9 } });
  const s = TH.create(L);
  let maxV = 0;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 30 * 120; i++) {
    if (i % 15 === 0) TH.bot(s);
    s.step();
    maxV = Math.max(maxV, s.vehicles.length);
    if (s.status !== "play") break;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const per = ms / s.steps;
  ok("차량이 많아도 한 걸음 계산 2ms 미만", per < 2, `최대 ${maxV}대 · 걸음당 ${per.toFixed(3)}ms`);
  ok("고정 걸음 1/30초", TH.DT === 1 / 30);
}

/* 19. 데이터 구조 */
ok("스테이지 20 · 미션 6 · 테마 5", LV.STAGES.length === 20 && LV.MISSIONS.length === 6 && Object.keys(LV.THEMES).length === 5);
{
  const sig = new Set(LV.STAGES.map((s) => JSON.stringify([s.inters.length, s.inters[0].phases, s.inters[0].permLeft, !!s.peds, !!(s.busStops || s.taxiZones), !!(s.work || s.closed), !!(s.events || []).length, !!s.waves])));
  ok("스테이지마다 도로 구조 · 문제가 다르다 (수만 늘리지 않음)", sig.size >= 15, `서로 다른 구성 ${sig.size}/20`);
  const themes = new Set(LV.STAGES.map((s) => s.theme));
  ok("스테이지가 5개 테마를 모두 쓴다", themes.size === 5);
}

console.log(`\n${pass}/${pass + fail} ${fail ? "FAIL" : "PASS"}`);
process.exit(fail ? 1 : 0);
