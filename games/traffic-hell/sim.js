/* 교통지옥 : TRAFFIC HELL — 교통 시뮬레이션 엔진 (화면과 분리 · node 에서도 require 가능)
 * 단위: 미터 · 초. x 는 동쪽, y 는 남쪽. 오른쪽 통행.
 * 고정 걸음(1/30초)으로만 움직이므로 기기 성능과 상관없이 같은 입력이면 같은 결과가 나온다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TH = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DT = 1 / 30;
  const LANE_W = 3.2;
  const YELLOW = 2.5; // 노란불 길이
  const MIN_GREEN = 5; // 이보다 빨리 바꾸면 '신호 급변경'
  const REACT = 0.6; // 운전자 반응 시간
  const LOOK = 90; // 앞차 찾는 거리
  const WALK_START = 7; // 보행 신호가 켜진 뒤 이 시간까지만 새로 건너기 시작

  /* ---------- 차종 ---------- */
  const TYPES = {
    car: { name: "승용차", len: 4.5, wid: 1.8, v0: 13.9, a: 2.6, b: 3.0, bMax: 7.5, s0: 2.0, T: 1.2, turnV: 6.5, pts: 10 },
    taxi: { name: "택시", len: 4.6, wid: 1.8, v0: 14.5, a: 2.8, b: 3.2, bMax: 7.5, s0: 1.8, T: 1.0, turnV: 7, pts: 10 },
    bus: { name: "버스", len: 11.5, wid: 2.5, v0: 11.5, a: 1.1, b: 2.2, bMax: 5.5, s0: 2.5, T: 1.6, turnV: 4.2, pts: 22 },
    truck: { name: "트럭", len: 9.0, wid: 2.4, v0: 11.5, a: 0.95, b: 1.8, bMax: 4.8, s0: 2.5, T: 1.7, turnV: 4.5, pts: 14 },
    moto: { name: "오토바이", len: 2.1, wid: 0.8, v0: 15, a: 4.0, b: 3.5, bMax: 8, s0: 1.1, T: 0.8, turnV: 8, pts: 8 },
    ambulance: { name: "구급차", len: 5.6, wid: 2.0, v0: 16.5, a: 3.0, b: 3.5, bMax: 7.5, s0: 2, T: 0.9, turnV: 7, pts: 40, em: true },
    fire: { name: "소방차", len: 9.5, wid: 2.5, v0: 14, a: 1.6, b: 2.6, bMax: 6, s0: 2.5, T: 1.2, turnV: 5, pts: 40, em: true },
    police: { name: "경찰차", len: 4.9, wid: 1.9, v0: 17, a: 3.4, b: 3.6, bMax: 8, s0: 1.8, T: 0.9, turnV: 7.5, pts: 40, em: true },
  };

  /* ---------- 방향 ---------- */
  const SIDES = ["N", "E", "S", "W"];
  const U = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const sideIdx = (c) => SIDES.indexOf(c);
  const rightOf = (h) => (h + 1) % 4;
  const leftOf = (h) => (h + 3) % 4;
  function outHeading(inSide, turn) {
    const h = (inSide + 2) % 4;
    return turn === "S" ? h : turn === "R" ? rightOf(h) : leftOf(h);
  }

  /* ---------- 신호 단계 ---------- */
  const PHASES = {
    NS: { name: "남북 직진", prot: ["NS", "NR", "SS", "SR"], perm: ["NL", "SL"] },
    EW: { name: "동서 직진", prot: ["ES", "ER", "WS", "WR"], perm: ["EL", "WL"] },
    NSL: { name: "남북 좌회전", prot: ["NL", "SL"] },
    EWL: { name: "동서 좌회전", prot: ["EL", "WL"] },
    N: { name: "북쪽 직진·좌회전", prot: ["NL", "NS", "NR"] },
    E: { name: "동쪽 직진·좌회전", prot: ["EL", "ES", "ER"] },
    S: { name: "남쪽 직진·좌회전", prot: ["SL", "SS", "SR"] },
    W: { name: "서쪽 직진·좌회전", prot: ["WL", "WS", "WR"] },
  };

  /* ---------- 난수 (씨앗 고정) ---------- */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 선 · 곡선 ---------- */
  function polyline(pts) {
    const n = pts.length / 2;
    const cum = new Float64Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
    return { pts: Float64Array.from(pts), cum, len: cum[n - 1] };
  }
  function pointAt(seg, s, out) {
    const c = seg.cum;
    const n = c.length;
    if (s <= 0) {
      const dx = seg.pts[2] - seg.pts[0];
      const dy = seg.pts[3] - seg.pts[1];
      const l = Math.hypot(dx, dy) || 1;
      out[0] = seg.pts[0] + (dx / l) * s;
      out[1] = seg.pts[1] + (dy / l) * s;
      return out;
    }
    if (s >= seg.len) {
      const i = n - 1;
      const dx = seg.pts[2 * i] - seg.pts[2 * i - 2];
      const dy = seg.pts[2 * i + 1] - seg.pts[2 * i - 1];
      const l = Math.hypot(dx, dy) || 1;
      out[0] = seg.pts[2 * i] + (dx / l) * (s - seg.len);
      out[1] = seg.pts[2 * i + 1] + (dy / l) * (s - seg.len);
      return out;
    }
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m] <= s) lo = m;
      else hi = m;
    }
    const f = (s - c[lo]) / (c[hi] - c[lo] || 1);
    out[0] = seg.pts[2 * lo] + (seg.pts[2 * hi] - seg.pts[2 * lo]) * f;
    out[1] = seg.pts[2 * lo + 1] + (seg.pts[2 * hi + 1] - seg.pts[2 * lo + 1]) * f;
    return out;
  }
  function bezier(p0, c1, c2, p3, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      pts.push(a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]);
    }
    return pts;
  }

  /* ========== 도로망 ========== */
  function buildNet(level) {
    const net = { inters: [], interById: {}, links: [], linkById: {}, segs: [] };
    for (const d of level.inters) {
      const I = {
        id: d.id,
        x: d.x,
        y: d.y,
        arms: {},
        H: 0,
        phaseIds: d.phases || ["NS", "EW"],
        permLeft: !!d.permLeft,
        paths: [],
        pathByKey: {},
        cross: d.cross !== false,
        peds: {},
      };
      net.inters.push(I);
      net.interById[d.id] = I;
    }
    // 팔(arm): 교차로 한쪽 방향 도로. in = 교차로로 들어오는 차로 수, out = 나가는 차로 수
    for (const r of level.roads) {
      const A = net.interById[r.a];
      const sa = sideIdx(r.as);
      if (r.b) {
        const B = net.interById[r.b];
        const sb = sideIdx(r.bs);
        A.arms[sa] = { inN: r.lanesBA || 2, outN: r.lanesAB || 2, to: B, toSide: sb, use: r.useA };
        B.arms[sb] = { inN: r.lanesAB || 2, outN: r.lanesBA || 2, to: A, toSide: sa, use: r.useB };
      } else {
        A.arms[sa] = { inN: r.lanesIn || 2, outN: r.lanesOut || 2, edge: true, len: r.len || 60, use: r.use, noIn: !!r.noIn, noOut: !!r.noOut };
      }
    }
    for (const I of net.inters) {
      let m = 1;
      for (const k in I.arms) m = Math.max(m, I.arms[k].inN, I.arms[k].outN);
      I.maxL = m;
      I.H = LANE_W * m + 0.8;
      I.stopD = I.H + 4.3;
    }
    const mkLink = (id, from, fromSide, to, toSide, heading, n, p0, p1, use) => {
      const L = { id, from, fromSide, to, toSide, h: heading, n, lanes: [], vcap: 0, closed: false, use, queue: [] };
      const r = U[rightOf(heading)];
      for (let i = 0; i < n; i++) {
        const off = (i + 0.5) * LANE_W;
        const seg = polyline([p0[0] + r[0] * off, p0[1] + r[1] * off, p1[0] + r[0] * off, p1[1] + r[1] * off]);
        Object.assign(seg, { id: net.segs.length, kind: "lane", link: L, lane: i, occ: [], over: [] });
        net.segs.push(seg);
        L.lanes.push(seg);
      }
      net.links.push(L);
      net.linkById[id] = L;
      return L;
    };
    for (const I of net.inters) {
      I.inLink = {};
      I.outLink = {};
    }
    for (const I of net.inters) {
      for (const k in I.arms) {
        const s = +k;
        const a = I.arms[s];
        const u = U[s];
        const near = [I.x + u[0] * I.stopD, I.y + u[1] * I.stopD];
        if (a.edge) {
          const far = [I.x + u[0] * a.len, I.y + u[1] * a.len];
          if (!a.noIn) I.inLink[s] = mkLink(`${I.id}.${SIDES[s]}.in`, null, -1, I, s, (s + 2) % 4, a.inN, far, near, a.use);
          if (!a.noOut) I.outLink[s] = mkLink(`${I.id}.${SIDES[s]}.out`, I, s, null, -1, s, a.outN, near, far);
        } else if (!I.outLink[s]) {
          const B = a.to;
          const sb = a.toSide;
          const bu = U[sb];
          const bnear = [B.x + bu[0] * B.stopD, B.y + bu[1] * B.stopD];
          const L1 = mkLink(`${I.id}.${SIDES[s]}-${B.id}.${SIDES[sb]}`, I, s, B, sb, s, a.outN, near, bnear, B.arms[sb].use);
          const L2 = mkLink(`${B.id}.${SIDES[sb]}-${I.id}.${SIDES[s]}`, B, sb, I, s, sb, a.inN, bnear, near, a.use);
          I.outLink[s] = L1;
          B.inLink[sb] = L1;
          B.outLink[sb] = L2;
          I.inLink[s] = L2;
        }
      }
    }
    for (const I of net.inters) {
      I.phases = I.phaseIds.map((pid) => {
        const P = PHASES[pid];
        const mv = {};
        for (const k of P.prot) mv[k] = "G";
        if (I.permLeft && P.perm) for (const k of P.perm) mv[k] = "P";
        // 이 단계에서 보행 신호가 켜지는 횡단보도: 보호 직진 · 좌회전이 지나지 않는 곳
        const walk = [];
        for (let s = 0; s < 4; s++) {
          let ok = !!I.arms[s];
          for (const key in mv) {
            if (mv[key] !== "G") continue;
            const si = sideIdx(key[0]);
            const t = key[1];
            if (si === s || (outHeading(si, t) === s && t !== "R")) ok = false;
          }
          walk.push(ok);
        }
        return { id: pid, name: P.name, mv, walk };
      });
      I.cur = Math.min(level.phaseStart || 0, I.phases.length - 1);
      I.next = I.cur;
      I.state = "G";
      I.t = 0;
      I.greenT = 0;
      I.switches = 0;
      for (let s = 0; s < 4; s++) {
        if (!I.arms[s] || !I.cross) continue;
        const half = LANE_W * Math.max(I.arms[s].inN, I.arms[s].outN);
        I.peds[s] = { half, wait: [[], []], crossing: [], walkAge: 0, walk: false };
      }
    }
    return net;
  }

  function laneUse(link) {
    if (link.use) return link.use;
    if (link.n === 1) return [["L", "S", "R"]];
    if (link.n === 2) return [["L"], ["S", "R"]];
    return [["L"], ["S"], ["S", "R"]];
  }

  /* 교차로 안 이동 경로 (들어오는 차로 → 나가는 차로) */
  function getPath(net, I, inSide, inLane, turn, outLane) {
    const key = `${inSide}|${inLane}|${turn}|${outLane}`;
    if (I.pathByKey[key]) return I.pathByKey[key];
    const Lin = I.inLink[inSide];
    const oh = outHeading(inSide, turn);
    const Lout = I.outLink[oh];
    const a = Lin.lanes[inLane];
    const b = Lout.lanes[outLane];
    const p0 = [a.pts[a.pts.length - 2], a.pts[a.pts.length - 1]];
    const p3 = [b.pts[0], b.pts[1]];
    const h0 = U[Lin.h];
    const h1 = U[oh];
    let c1, c2;
    if (turn === "S") {
      const d = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) / 3;
      c1 = [p0[0] + h0[0] * d, p0[1] + h0[1] * d];
      c2 = [p3[0] - h1[0] * d, p3[1] - h1[1] * d];
    } else {
      // 두 직선이 만나는 모서리 점을 기준으로 부드러운 호
      const X = h0[0] !== 0 ? [p3[0], p0[1]] : [p0[0], p3[1]];
      const k1 = Math.hypot(X[0] - p0[0], X[1] - p0[1]) * 0.56;
      const k2 = Math.hypot(p3[0] - X[0], p3[1] - X[1]) * 0.56;
      c1 = [p0[0] + h0[0] * k1, p0[1] + h0[1] * k1];
      c2 = [p3[0] - h1[0] * k2, p3[1] - h1[1] * k2];
    }
    const seg = polyline(bezier(p0, c1, c2, p3, 22));
    Object.assign(seg, { id: net.segs.length, kind: "path", inter: I, key, inSide, inLane, turn, outSide: oh, outLane, mvKey: SIDES[inSide] + turn, occ: [], over: [], conf: [], xw: [] });
    net.segs.push(seg);
    // 다른 경로와 겹치는 구간(충돌 지점)
    const samp = (sg) => {
      const r = [];
      const tmp = [0, 0];
      for (let s = 0; s <= sg.len; s += 0.4) {
        pointAt(sg, s, tmp);
        r.push(tmp[0], tmp[1], s);
      }
      return r;
    };
    seg.samp = samp(seg);
    const THR = 2.3;
    for (const q of I.paths) {
      let p0s = 1e9;
      let p1s = -1e9;
      let q0s = 1e9;
      let q1s = -1e9;
      const A = seg.samp;
      const B = q.samp;
      for (let i = 0; i < A.length; i += 3) {
        for (let j = 0; j < B.length; j += 3) {
          const dx = A[i] - B[j];
          const dy = A[i + 1] - B[j + 1];
          if (dx * dx + dy * dy < THR * THR) {
            if (A[i + 2] < p0s) p0s = A[i + 2];
            if (A[i + 2] > p1s) p1s = A[i + 2];
            if (B[j + 2] < q0s) q0s = B[j + 2];
            if (B[j + 2] > q1s) q1s = B[j + 2];
          }
        }
      }
      if (p1s < 0) continue;
      const sib = q.inSide === inSide && q.inLane === inLane;
      const merge = q.outSide === oh && q.outLane === outLane;
      seg.conf.push({ q, p0: p0s - 0.3, p1: p1s + 0.3, q0: q0s - 0.3, q1: q1s + 0.3, sib, merge });
      q.conf.push({ q: seg, p0: q0s - 0.3, p1: q1s + 0.3, q0: p0s - 0.3, q1: p1s + 0.3, sib, merge });
    }
    // 횡단보도를 지나는 구간
    for (const k in I.peds) {
      const s = +k;
      const u = U[s];
      const r = U[rightOf(s)];
      const P = I.peds[s];
      let s0 = 1e9;
      let s1 = -1e9;
      let bsum = 0;
      let bn = 0;
      const A = seg.samp;
      for (let i = 0; i < A.length; i += 3) {
        const ax = (A[i] - I.x) * u[0] + (A[i + 1] - I.y) * u[1];
        const bx = (A[i] - I.x) * r[0] + (A[i + 1] - I.y) * r[1];
        if (ax >= I.H + 0.2 && ax <= I.H + 3.8 && Math.abs(bx) <= P.half + 0.5) {
          s0 = Math.min(s0, A[i + 2]);
          s1 = Math.max(s1, A[i + 2]);
          bsum += bx;
          bn++;
        }
      }
      if (bn) seg.xw.push({ side: s, s0: s0 - 0.5, s1: s1 + 0.5, b: bsum / bn });
    }
    I.paths.push(seg);
    I.pathByKey[key] = seg;
    return seg;
  }

  /* 경로 찾기 (링크 그래프 · 좌회전은 비용을 더 매김) */
  function findRoute(net, fromLink, toLink) {
    const cost = new Map();
    const prev = new Map();
    cost.set(fromLink, 0);
    const open = [fromLink];
    while (open.length) {
      open.sort((a, b) => cost.get(a) - cost.get(b));
      const L = open.shift();
      if (L === toLink) break;
      const I = L.to;
      if (!I) continue;
      for (const t of ["S", "R", "L"]) {
        const oh = outHeading(L.toSide, t);
        const N = I.outLink[oh];
        if (!N || N.closed) continue;
        if (!laneUse(L).some((u) => u.includes(t))) continue;
        const c = cost.get(L) + N.lanes[0].len + (t === "L" ? 30 : t === "R" ? 10 : 0) + 25;
        if (!cost.has(N) || c < cost.get(N)) {
          cost.set(N, c);
          prev.set(N, [L, t]);
          if (!open.includes(N)) open.push(N);
        }
      }
    }
    if (!cost.has(toLink)) return null;
    const links = [toLink];
    const turns = [];
    let cur = toLink;
    while (cur !== fromLink) {
      const [p, t] = prev.get(cur);
      links.unshift(p);
      turns.unshift(t);
      cur = p;
    }
    return { links, turns, cost: cost.get(toLink) };
  }

  /* ========== 시뮬레이션 ========== */
  function create(level0, opts = {}) {
    const level = JSON.parse(JSON.stringify(level0)); // 이벤트 진행 표시가 원본 데이터에 남지 않게
    const seed = opts.seed != null ? opts.seed : level.seed || level.id || "th";
    const rng = mulberry32(hashStr(String(seed)));
    const net = buildNet(level);
    const sim = {
      level,
      net,
      rng,
      t: 0,
      steps: 0,
      vehicles: [],
      nextId: 1,
      events: [],
      status: "play",
      reason: "",
      score: { pass: 0, wait: 0, acc: 0, em: 0, ped: 0, sw: 0, bonus: 0 },
      st: { passed: 0, byType: {}, totalWait: 0, acc: 0, pedAcc: 0, emPassed: 0, emDelay: 0, emMax: 0, pedServed: 0, cong: 0, maxCong: 0, quick: 0, hardBrakes: 0, switches: 0, waiting: 0, maxWaitNow: 0, tows: 0 },
      gridT: 0,
      pending: [],
      emLate: 0,
    };
    const goal = level.goal || {};
    sim.goal = goal;

    /* 입구 · 출구 */
    sim.entries = net.links.filter((L) => !L.from);
    sim.exits = net.links.filter((L) => !L.to);
    for (const c of level.closed || []) if (net.linkById[c]) net.linkById[c].closed = true;
    for (const w of level.work || []) {
      const L = net.linkById[w.link];
      if (L) {
        L.vcap = w.vcap || 8;
        L.work = true;
      }
    }

    /* 목적지 고르기: 경로의 회전마다 가중치 */
    const TW = Object.assign({ L: 0.22, S: 0.6, R: 0.18 }, level.turns || {});
    function routeTable() {
      sim.routes = new Map();
      for (const E of sim.entries) {
        const opts2 = [];
        for (const X of sim.exits) {
          if (X.closed) continue;
          if (X.from === E.to && X.fromSide === E.toSide) continue; // 유턴 없음
          const r = findRoute(net, E, X);
          if (!r) continue;
          let w = 1;
          for (const t of r.turns) w *= TW[t];
          const od = level.od && level.od[E.id];
          if (od && od[X.id] != null) w *= od[X.id];
          if (w > 0) opts2.push({ r, w });
        }
        const sum = opts2.reduce((a, o) => a + o.w, 0);
        sim.routes.set(E, opts2.map((o) => ({ r: o.r, w: o.w / sum })));
      }
    }
    routeTable();
    sim.routeTable = routeTable;

    /* 수요 */
    const base = level.demand || {};
    const mix = Object.assign({ car: 0.62, taxi: 0.1, bus: 0.08, truck: 0.1, moto: 0.1 }, level.mix || {});
    const mixKeys = Object.keys(mix);
    const mixSum = mixKeys.reduce((a, k) => a + mix[k], 0);
    function rateOf(E, t) {
      let r = base[E.id] != null ? base[E.id] : base["*"] || 0;
      if (level.ramp) r *= 1 + t / level.ramp;
      for (const w of level.waves || []) {
        if (t >= w.t0 && t < w.t1 && (w.entry === "*" || w.entry === E.id)) r *= w.mult;
      }
      return r; // 분당 대수
    }
    for (const E of sim.entries) E.nextT = 1 + rng() * 3;
    function pickType() {
      let x = rng() * mixSum;
      for (const k of mixKeys) {
        x -= mix[k];
        if (x <= 0) return k;
      }
      return "car";
    }
    function pickRoute(E) {
      const list = sim.routes.get(E);
      if (!list || !list.length) return null;
      let x = rng();
      for (const o of list) {
        x -= o.w;
        if (x <= 0) return o.r;
      }
      return list[list.length - 1].r;
    }

    const COLORS = ["#e9edf2", "#2b2f36", "#9aa3ad", "#c23b3b", "#2f5fa8", "#3d6e57", "#d7c9a7", "#5b4a7a", "#efe9dc", "#7f8a96", "#1f3a5f", "#a8553a"];
    function makeVehicle(type, E, route) {
      const T = TYPES[type];
      const v = {
        id: sim.nextId++,
        type,
        T,
        em: !!T.em,
        E,
        route,
        ri: 0,
        segs: [],
        si: 0,
        s: 0,
        v: 0,
        a: 0,
        gate: "go",
        gateWhy: "",
        clearing: false,
        cautious: false,
        crashed: false,
        crashT: 0,
        broken: false,
        brokenT: 0,
        towing: false,
        towT: 0,
        dwell: 0,
        stops: [],
        stopT: 0,
        waitT: 0,
        delay: 0,
        redT: 0,
        born: sim.t,
        color: COLORS[Math.floor(rng() * COLORS.length)],
        hbT: -9,
        x: 0,
        y: 0,
        ang: 0,
        ox: 0,
        oy: 0,
        oang: 0,
        brake: false,
        willTaxi: type === "taxi" && rng() < (level.taxiProb != null ? level.taxiProb : 0.4),
        rush: !T.em && type !== "bus" && rng() < (level.rush != null ? level.rush : 0.2),
      };
      return v;
    }
    function chooseLane(L, turn, nextOk) {
      const use = laneUse(L);
      let best = -1;
      let bestLoad = 1e9;
      for (let i = 0; i < L.n; i++) {
        if (turn && !use[i].includes(turn)) continue;
        if (nextOk && !nextOk(i)) continue;
        const seg = L.lanes[i];
        let load = 0;
        for (const o of seg.occ) load += o.T.len + 2;
        load += i * 0.01;
        if (load < bestLoad) {
          bestLoad = load;
          best = i;
        }
      }
      if (best < 0) best = turn === "L" ? 0 : L.n - 1;
      return best;
    }
    function exitLaneFor(L, inTurn, inLane, inN) {
      if (L.n === 1) return 0;
      if (inTurn === "L") return 0;
      if (inTurn === "R") return L.n - 1;
      return Math.min(L.n - 1, Math.max(0, inLane + (L.n - inN)));
    }
    /* 다음 구간(교차로 경로 + 나가는 차로) 미리 만들기 */
    function ensureSeg(v, k) {
      while (v.segs.length <= k) {
        const last = v.segs[v.segs.length - 1];
        const L = last.link;
        const ri = v.routeIdxOfSeg[v.segs.length - 1];
        if (!L.to || ri >= v.route.links.length - 1) return null;
        const turn = v.route.turns[ri];
        const N = v.route.links[ri + 1];
        const nextTurn = v.route.turns[ri + 1];
        let j;
        if (!N.to) j = exitLaneFor(N, turn, last.lane, L.n);
        else {
          j = chooseLane(N, nextTurn, null);
        }
        const P = getPath(net, L.to, L.toSide, last.lane, turn, j);
        v.segs.push(P);
        v.routeIdxOfSeg.push(ri);
        v.segs.push(N.lanes[j]);
        v.routeIdxOfSeg.push(ri + 1);
        addStops(v, N.lanes[j], v.segs.length - 1);
      }
      return v.segs[k];
    }
    sim.ensureSeg = ensureSeg;
    function addStops(v, seg, idx) {
      for (const b of level.busStops || []) {
        if (v.type === "bus" && seg.link.id === b.link && seg.lane === (b.lane < 0 ? seg.link.n + b.lane : b.lane)) v.stops.push({ si: idx, s: seg.len * b.pos, dwell: b.dwell || 5, done: false, kind: "bus" });
      }
      for (const b of level.taxiZones || []) {
        if (v.willTaxi && seg.link.id === b.link && seg.lane === (b.lane < 0 ? seg.link.n + b.lane : b.lane)) v.stops.push({ si: idx, s: seg.len * b.pos, dwell: b.dwell || 4, done: false, kind: "taxi" });
      }
    }

    function trySpawn(E) {
      if (!E.queue.length) return;
      const q = E.queue[0];
      const turn = q.route.turns[0];
      const lane = E.to ? chooseLane(E, turn, null) : 0;
      const seg = E.lanes[lane];
      const T = TYPES[q.type];
      let last = null;
      for (const o of seg.occ) if (!last || o.s < last.s) last = o;
      const room = last ? last.s - last.T.len : 1e9;
      if (room < T.len + T.s0 + 2) return;
      E.queue.shift();
      const v = makeVehicle(q.type, E, q.route);
      v.segs = [seg];
      v.routeIdxOfSeg = [0];
      addStops(v, seg, 0);
      v.s = 0;
      const v0 = Math.min(T.v0, E.vcap || 99) * 0.85;
      v.v = last ? Math.max(0, Math.min(v0, last.v + 1.5, Math.sqrt(Math.max(0, room - T.len - T.s0) * 2 * T.b))) : v0;
      if (q.em) v.emLimit = q.emLimit;
      seg.occ.push(v);
      sim.vehicles.push(v);
      pose(v);
      v.ox = v.x;
      v.oy = v.y;
      v.oang = v.ang;
      if (v.em) sim.events.push({ k: "emIn", id: v.id, type: v.type, x: v.x, y: v.y });
    }
    function queueVehicle(E, type, route, extra) {
      const item = Object.assign({ type, route }, extra || {});
      if (extra && extra.em) E.queue.unshift(item);
      else E.queue.push(item);
    }

    /* ---------- 신호 ---------- */
    function signalOf(I, key) {
      const a = I.phases[I.cur].mv[key];
      if (I.state === "G") return a || "R";
      const b = I.phases[I.next].mv[key];
      if (a && b) return a === "G" && b === "G" ? "G" : "P";
      if (a) return "Y";
      return "R";
    }
    sim.signalOf = signalOf;
    sim.setPhase = function (ii, k) {
      const I = net.inters[ii];
      if (!I || sim.status !== "play") return false;
      if (k < 0 || k >= I.phases.length) return false;
      if (I.state === "Y") {
        I.next = k;
        if (k === I.cur) {
          I.state = "G";
          I.t = 0;
        }
        return true;
      }
      if (k === I.cur) return false;
      if (I.greenT < MIN_GREEN) {
        sim.score.sw -= 25;
        sim.st.quick++;
        sim.events.push({ k: "quick", inter: ii });
      }
      I.state = "Y";
      I.next = k;
      I.t = 0;
      I.switches++;
      sim.st.switches++;
      sim.events.push({ k: "signal", inter: ii });
      return true;
    };
    sim.cyclePhase = function (ii) {
      const I = net.inters[ii];
      const base2 = I.state === "Y" ? I.next : I.cur;
      return sim.setPhase(ii, (base2 + 1) % I.phases.length);
    };
    /* 지금 신호를 바꾸면 위험한가: 교차로 안이나 진입 직전에 큰 차(버스 · 트럭 · 소방차)가 있음 */
    sim.bigInBox = function (ii) {
      const I = net.inters[ii];
      for (const P of I.paths) {
        for (const o of P.occ) if (o.T.len >= 9 && !o.crashed) return o;
        for (const ov of P.over) if (ov.v.T.len >= 9 && !ov.v.crashed) return ov.v;
      }
      for (const k in I.inLink)
        for (const sg of I.inLink[k].lanes)
          for (const o of sg.occ) if (o.T.len >= 9 && o.commit && o.gate === "go" && signalOf(I, (o.segs[o.si + 1] || {}).mvKey) === "G") return o;
      return null;
    };
    sim.tow = function (id) {
      const v = sim.vehicles.find((o) => o.id === id);
      if (!v || !(v.crashed || v.broken) || v.towing) return false;
      v.towing = true;
      v.towT = 0;
      sim.st.tows++;
      sim.score.acc -= 10;
      sim.events.push({ k: "tow", id, x: v.x, y: v.y });
      return true;
    };

    /* ---------- 위치 · 자세 ---------- */
    const tA = [0, 0];
    const tB = [0, 0];
    function posAt(v, back, out) {
      // 앞머리에서 back 만큼 뒤 지점 (앞 구간으로 넘어가면 이전 구간에서)
      let k = v.si;
      let s = v.s - back;
      while (s < 0 && k > 0) {
        k--;
        s += v.segs[k].len;
      }
      return pointAt(v.segs[k], s, out);
    }
    function pose(v) {
      posAt(v, 0, tA);
      posAt(v, v.T.len, tB);
      v.x = (tA[0] + tB[0]) / 2;
      v.y = (tA[1] + tB[1]) / 2;
      v.ang = Math.atan2(tA[1] - tB[1], tA[0] - tB[0]);
      v.fx = tA[0];
      v.fy = tA[1];
    }
    sim.pose = pose;

    /* ---------- 점유 목록 ---------- */
    function rebuildOcc() {
      for (const sg of net.segs) {
        sg.occ.length = 0;
        sg.over.length = 0;
      }
      for (const v of sim.vehicles) {
        const sg = v.segs[v.si];
        sg.occ.push(v);
        // 뒷부분이 이전 구간에 걸쳐 있는 차
        let back = v.T.len - v.s;
        let k = v.si - 1;
        while (back > 0 && k >= 0) {
          const p = v.segs[k];
          p.over.push({ v, a: Math.max(0, p.len - back), b: p.len });
          back -= p.len;
          k--;
        }
      }
      for (const sg of net.segs) if (sg.occ.length > 1) sg.occ.sort((a, b) => b.s - a.s);
    }

    /* 경로 P 위에서 차 o 가 차지하는 [뒤, 앞] 구간 목록 */
    function intervals(P, fn) {
      for (const o of P.occ) fn(o, o.s - o.T.len, o.s);
      for (const ov of P.over) fn(ov.v, ov.a, ov.b);
    }

    /* ---------- 교차로 진입 판단 ---------- */
    function entryCheck(v, P, d, permissive) {
      // 정지선에 서 있던 운전자 · 비보호 · 긴급 차량은 교차로 안을 살핀다.
      // 달리던 중 초록불을 받은 운전자는 신호를 믿고 간다 (멈춰 선 차 · 사고 차만 본다)
      // 급한 운전자(v.rush)는 초록불이 막 켜지면 살피지 않고 바로 출발한다
      const fresh = P.inter.state === "G" && P.inter.greenT < 3;
      const attentive = (v.v < 3 && !(v.rush && fresh)) || permissive || v.em;
      const vEff = Math.max(v.v, 3.5);
      const why = { ok: true, cause: "", who: null };
      for (const c of P.conf) {
        if (c.sib) continue;
        const myT0 = (d + c.p0) / vEff - 0.8;
        const myT1 = (d + c.p1 + v.T.len) / Math.max(2.5, vEff * 0.75) + 0.8;
        const Q = c.q;
        let bad = null;
        intervals(Q, (o, rear, front) => {
          if (bad || o === v) return;
          if (rear > c.q1) return; // 이미 지나감
          if (o.broken && front + (o.v * o.v) / (2 * o.T.b) >= c.q0 - 1) {
            bad = o; // 고장 나 멈추는 중인 차는 멈출 자리까지 본다
            return;
          }
          const stuck = o.crashed || o.broken || o.v < 0.3;
          if (stuck) {
            if (front >= c.q0 - 1) bad = o;
            return;
          }
          if (!attentive) return;
          const te = Math.max(0, c.q0 - front) / Math.max(o.v, 1);
          const tl = (c.q1 - rear) / Math.max(o.v, 1.5);
          if (te < myT1 && tl > myT0) bad = o;
        });
        if (!bad && attentive) {
          // 아직 정지선 앞이지만 들어오기로 한 차 (비보호 좌회전이면 초록불인 상대 차 모두)
          const inSeg = net.interById[Q.inter.id].inLink[Q.inSide].lanes[Q.inLane];
          for (const o of inSeg.occ) {
            if (o === v || o.segs[o.si + 1] !== Q) continue;
            const sigQ = signalOf(Q.inter, Q.mvKey);
            const coming = o.gate === "go" && (o.commit || (permissive && (sigQ === "G" || sigQ === "Y")) || o.clearing);
            if (!coming) continue;
            const dq = inSeg.len - o.s;
            const ov = Math.max(o.v, 2);
            const te = (dq + c.q0) / ov;
            const tl = (dq + c.q1 + o.T.len) / Math.max(ov * 0.8, 2);
            if (te < myT1 + (permissive ? 1.2 : 0) && tl > myT0) {
              bad = o;
              break;
            }
          }
        }
        if (bad) {
          why.ok = false;
          why.cause = bad.crashed ? "crash" : bad.broken ? "broken" : bad.clearing ? "clearing" : permissive ? "perm" : "box";
          why.who = bad;
          return why;
        }
      }
      // 횡단보도
      for (const x of P.xw) {
        const ped = P.inter.peds[x.side];
        if (ped && ped.crossing.length) {
          why.ok = false;
          why.cause = "ped";
          return why;
        }
      }
      // 꼬리물기 방지: 나가는 차로에 내 자리가 있어야 들어간다
      const out = v.segs[v.si + 2];
      if (out) {
        let free = 1e9;
        for (const o of out.occ) {
          if (o.v < 6 || o.crashed || o.broken) free = Math.min(free, o.s - o.T.len);
        }
        if (free < 1e9) {
          for (const p of P.inter.paths) {
            if (p.outSide !== P.outSide || p.outLane !== P.outLane) continue;
            for (const o of p.occ) if (o !== v) free -= o.T.len + 2;
          }
          if (free < v.T.len + v.T.s0 + 1) {
            why.ok = false;
            why.cause = "exit";
            return why;
          }
        }
      }
      return why;
    }

    /* ---------- IDM (앞차 따라가기) ---------- */
    function idm(T, v, v0, gap, dv) {
      const ss = T.s0 + Math.max(0, v * T.T + (v * dv) / (2 * Math.sqrt(T.a * T.b)));
      const g = Math.max(gap, 0.05);
      return T.a * (1 - Math.pow(v / Math.max(v0, 0.1), 4) - (ss / g) * (ss / g));
    }

    function leaderOf(v) {
      let best = null;
      const seg = v.segs[v.si];
      const idx = seg.occ.indexOf(v);
      if (idx > 0) {
        const o = seg.occ[idx - 1];
        best = { gap: o.s - o.T.len - v.s, lv: o.v, o };
      }
      const sibCheck = (P, dist) => {
        // 같은 차로에서 갈라지는 경로 위의 차 (아직 갈라지기 전이면 앞차)
        for (const c of P.conf) {
          if (!c.sib) continue;
          for (const o of c.q.occ) {
            if (o === v) continue;
            const rear = o.s - o.T.len;
            if (rear > c.p1) continue;
            const gap = dist + rear - (P === seg ? v.s : 0);
            if (P === seg && o.s <= v.s) continue;
            if (gap > -o.T.len && (!best || gap < best.gap)) best = { gap, lv: o.v, o };
          }
        }
      };
      if (seg.kind === "path") sibCheck(seg, 0);
      if (best && best.o && v.segs[v.si] === seg && idx > 0) return best;
      let dist = seg.len - v.s;
      let k = v.si + 1;
      while (dist < LOOK) {
        const ns = ensureSeg(v, k);
        if (!ns) break;
        if (ns.occ.length) {
          const o = ns.occ[ns.occ.length - 1];
          const g = dist + o.s - o.T.len;
          if (!best || g < best.gap) best = { gap: g, lv: o.v, o };
        }
        if (ns.kind === "path") sibCheck(ns, dist);
        if (best) return best;
        dist += ns.len;
        k++;
      }
      return best;
    }

    /* ---------- 한 걸음 ---------- */
    sim.step = function () {
      if (sim.status !== "play") return;
      const t = (sim.t += DT);
      sim.steps++;

      // 신호
      for (const I of net.inters) {
        I.t += DT;
        if (I.state === "G") I.greenT += DT;
        if (I.state === "Y" && I.t >= YELLOW) {
          I.state = "G";
          I.cur = I.next;
          I.t = 0;
          I.greenT = 0;
          sim.events.push({ k: "green", inter: net.inters.indexOf(I) });
        }
      }

      // 일정 이벤트
      for (const ev of level.events || []) {
        if (ev.done || t < ev.t) continue;
        ev.done = true;
        runEvent(ev);
      }
      procedural(t);

      // 차 생성
      for (const E of sim.entries) {
        if (E.closed) continue;
        const r = rateOf(E, t);
        if (r > 0 && t >= E.nextT) {
          const route = pickRoute(E);
          if (route) queueVehicle(E, pickType(), route);
          E.nextT = t + (-Math.log(1 - rng() * 0.999) * 60) / r;
        }
        trySpawn(E);
      }

      rebuildOcc();

      // 보행자
      stepPeds(t);

      // 가속도 계산
      for (const v of sim.vehicles) {
        v.ox = v.x;
        v.oy = v.y;
        v.oang = v.ang;
        if (v.crashed || v.towing) {
          v.a = 0;
          v.v = 0;
          continue;
        }
        if (v.broken) {
          v.a = -v.T.b;
          continue;
        }
        const T = v.T;
        const seg = v.segs[v.si];
        let v0 = T.v0;
        if (seg.kind === "lane" && seg.link.vcap) v0 = Math.min(v0, seg.link.vcap);
        if (seg.kind === "path" && seg.turn !== "S") v0 = Math.min(v0, T.turnV);
        if (v.cautious && seg.kind === "path") v0 = Math.min(v0, 7);
        let a = idm(T, v.v, v0, 1e9, 0);
        const ld = leaderOf(v);
        if (ld) a = Math.min(a, idm(T, v.v, v0, ld.gap, v.v - ld.lv));
        // 다음 구간이 회전이면 미리 감속
        if (seg.kind === "lane") {
          const nx = ensureSeg(v, v.si + 1);
          const d = seg.len - v.s;
          if (nx && nx.kind === "path" && nx.turn !== "S") {
            const vc = Math.min(T.turnV, v.cautious ? 7 : 99);
            if (v.v > vc) a = Math.min(a, (vc * vc - v.v * v.v) / (2 * Math.max(d, 0.5)));
          }
          // 정지선 판단
          if (nx && nx.kind === "path") {
            decide(v, nx, d, t);
            if (v.gate === "stop") a = Math.min(a, idm(T, v.v, v0, d - 0.6, v.v));
          }
          // 공사 구간 진입 감속
          if (nx && nx.kind === "path") {
            const after = v.segs[v.si + 2];
            if (after && after.link.vcap && v.v > after.link.vcap + 1 && d < 25) a = Math.min(a, ((after.link.vcap + 1) ** 2 - v.v * v.v) / (2 * Math.max(d + nx.len, 1)));
          }
        }
        // 버스 정류장 · 택시 승하차
        for (const st of v.stops) {
          if (st.done) continue;
          let dist = -1;
          if (st.si === v.si) dist = st.s - v.s;
          else if (st.si === v.si + 1) dist = seg.len - v.s + st.s;
          else if (st.si === v.si + 2 && v.segs[v.si + 1]) dist = seg.len - v.s + v.segs[v.si + 1].len + st.s;
          if (dist < -1 || dist > 60) continue;
          if (dist < T.s0 + 1 && v.v < 0.4) {
            v.dwell += DT;
            a = Math.min(a, -T.b);
            if (v.dwell >= st.dwell) {
              st.done = true;
              v.dwell = 0;
            }
          } else a = Math.min(a, idm(T, v.v, v0, Math.max(0.05, dist), v.v));
          break;
        }
        v.a = Math.max(-T.bMax * 1.25, Math.min(T.a, a));
      }

      // 이동
      for (const v of sim.vehicles) {
        if (v.crashed || v.towing) continue;
        let nv = v.v + v.a * DT;
        if (nv < 0) nv = 0;
        let ds = ((v.v + nv) / 2) * DT;
        v.v = nv;
        v.brake = v.a < -1.2;
        if (v.a < -v.T.b * 1.7 && v.v > 3 && t - v.hbT > 3) {
          v.hbT = t;
          sim.st.hardBrakes++;
          sim.events.push({ k: "brake", id: v.id, x: v.x, y: v.y, cause: v.gateWhy });
        }
        v.s += ds;
        // 구간 넘기기
        while (v.s > v.segs[v.si].len) {
          const cur = v.segs[v.si];
          const nx = ensureSeg(v, v.si + 1);
          if (!nx) break;
          v.s -= cur.len;
          v.si++;
          if (nx.kind === "path") {
            const sig = signalOf(nx.inter, nx.mvKey);
            v.clearing = sig === "Y" || sig === "R";
            if (sig === "R" && !v.em) sim.events.push({ k: "redrun", id: v.id, x: v.x, y: v.y });
          } else {
            v.clearing = false;
            v.cautious = false;
          }
          v.gate = "go";
          v.commit = false;
          v.ri = v.routeIdxOfSeg[v.si];
        }
        pose(v);
        // 교차로 안에 있는데 내 신호가 빨간불로 바뀌었으면 '빠져나가는 중'
        const cs = v.segs[v.si];
        if (cs.kind === "path" && !v.clearing && signalOf(cs.inter, cs.mvKey) === "R") v.clearing = true;
        // 대기 시간
        if (v.v < 1 && v.dwell === 0 && !v.broken) {
          v.stopT += DT;
          v.waitT += DT;
          if (v.stopT > 20) sim.score.wait -= 0.5 * DT;
        } else if (v.v > 3) v.stopT = 0;
        if (v.em && v.v < 4 && v.dwell === 0) {
          v.delay += DT;
          if (v.emLimit && v.delay > v.emLimit && !v.late) {
            v.late = true;
            sim.emLate++;
            sim.score.em -= 120;
            sim.events.push({ k: "emLate", id: v.id, x: v.x, y: v.y, type: v.type });
          }
        }
      }

      rebuildOcc();
      detectCrashes(t);

      // 사고 · 고장 처리 · 출구 도착
      const keep = [];
      for (const v of sim.vehicles) {
        if (v.towing) {
          v.towT += DT;
          if (v.towT > 2.5) {
            sim.events.push({ k: "cleared", id: v.id, x: v.x, y: v.y });
            continue;
          }
        } else if (v.crashed) {
          v.crashT += DT;
          if (v.crashT > 14) {
            sim.events.push({ k: "cleared", id: v.id, x: v.x, y: v.y });
            continue;
          }
        } else if (v.broken) {
          v.brokenT += DT;
          if (v.brokenT > 30) {
            v.broken = false;
          }
        }
        const sg = v.segs[v.si];
        if (sg.kind === "lane" && !sg.link.to && v.s >= sg.len) {
          sim.st.passed++;
          sim.st.byType[v.type] = (sim.st.byType[v.type] || 0) + 1;
          sim.st.totalWait += v.waitT;
          sim.score.pass += v.T.pts;
          if (v.em) {
            sim.st.emPassed++;
            sim.st.emDelay += v.delay;
            sim.st.emMax = Math.max(sim.st.emMax, v.delay);
            const b = Math.round(Math.max(-60, 120 - v.delay * 9));
            sim.score.em += b;
            sim.events.push({ k: "emPass", id: v.id, delay: v.delay, bonus: b, type: v.type, x: v.x, y: v.y });
          } else sim.events.push({ k: "pass", type: v.type });
          continue;
        }
        keep.push(v);
      }
      sim.vehicles = keep;
      rebuildOcc();
      metrics(t);
      evaluate(t);
    };

    /* 정지선 앞에서 갈지 멈출지 */
    function decide(v, P, d, t) {
      if (d > 70) {
        v.gate = "go";
        return;
      }
      const T = v.T;
      const sig = signalOf(P.inter, P.mvKey);
      const canHard = v.v * REACT + (v.v * v.v) / (2 * T.bMax) <= d + 0.4;
      const comfy = (v.v * v.v) / (2 * T.b) <= d + 0.3;
      const was = v.gate;
      let go;
      let why = "";
      if (sig === "R") {
        go = was === "go" && !canHard;
        why = "red";
        if (v.em) {
          // 긴급 차량: 빨간불이면 정지선에서 잠깐 멈춘 뒤 안전하면 천천히 통과
          if (v.v < 0.5 && d < T.s0 + 1.5) v.redT += DT;
          else if (d > 4) v.redT = 0;
          if (v.redT > 1.2) {
            const c = entryCheck(v, P, d, true);
            if (c.ok) {
              go = true;
              v.cautious = true;
            } else why = c.cause;
          }
        }
      } else if (sig === "Y") {
        // 편하게 설 수 있으면 서고, 아니면 그대로 지나간다 (딜레마 구간)
        const need = ((v.v * v.v) / (2 * T.b)) * (v.rush ? 1.8 : 1);
        go = was === "go" ? need > d + 0.3 : !canHard;
        why = "yellow";
      } else {
        const c = entryCheck(v, P, d, sig === "P");
        if (c.ok) go = true;
        else {
          go = !canHard; // 멈출 수 없으면 어쩔 수 없이 들어감
          why = c.cause;
          if (!go && (c.cause === "clearing" || c.cause === "crash") && t - (v.yieldT || -9) > 4) {
            v.yieldT = t;
            sim.events.push({ k: "yield", id: v.id, who: c.who ? c.who.id : 0, cause: c.cause, x: v.x, y: v.y });
          }
        }
      }
      v.gate = go ? "go" : "stop";
      v.gateWhy = why;
      if (go && d < v.v * REACT + (v.v * v.v) / (2 * T.b) + 2) v.commit = true;
      if (!go) v.commit = false;
    }

    /* 충돌 판정: 서로 다른 경로의 충돌 구간을 두 차가 동시에 차지하면 사고 */
    function detectCrashes(t) {
      for (const I of net.inters) {
        for (const P of I.paths) {
          if (!P.occ.length && !P.over.length) continue;
          for (const c of P.conf) {
            if (c.sib || c.q.id < P.id) continue;
            const Q = c.q;
            if (!Q.occ.length && !Q.over.length) continue;
            intervals(P, (a, ar, af) => {
              if (af < c.p0 || ar > c.p1) return;
              intervals(Q, (b, br, bf) => {
                if (a === b || bf < c.q0 || br > c.q1) return;
                if (a.crashed && b.crashed) return;
                // 진행 방향을 고려: 합류 구간은 뒤따르던 차가 박은 경우에만
                if (c.merge) {
                  const da = P.len - af;
                  const db = Q.len - bf;
                  if (Math.abs(da - db) > Math.max(a.T.len, b.T.len)) return;
                }
                crash(a, b, I, c, P, Q);
              });
            });
          }
        }
        // 보행자
        for (const k in I.peds) {
          const ped = I.peds[k];
          if (!ped.crossing.length) continue;
          for (const P of I.paths) {
            for (const x of P.xw) {
              if (x.side !== +k) continue;
              intervals(P, (o, r, f) => {
                if (f < x.s0 || r > x.s1 || o.crashed) return;
                for (let i = ped.crossing.length - 1; i >= 0; i--) {
                  const p = ped.crossing[i];
                  if (Math.abs(p.u - x.b) < o.T.wid / 2 + 0.5 && o.v > 0.5) {
                    ped.crossing.splice(i, 1);
                    sim.st.pedAcc++;
                    sim.st.acc++;
                    sim.score.acc -= 500;
                    o.crashed = true;
                    o.crashT = 6;
                    sim.events.push({ k: "pedHit", x: o.x, y: o.y, id: o.id });
                  }
                }
              });
            }
          }
        }
      }
    }
    function crash(a, b, I, c, P, Q) {
      // 원인: 신호가 이미 빨간불인 이동 = 교차로를 빠져나가던 차 (꼬리가 남은 큰 차 포함)
      const redA = signalOf(I, P.mvKey) !== "G" && signalOf(I, P.mvKey) !== "P";
      const redB = signalOf(I, Q.mvKey) !== "G" && signalOf(I, Q.mvKey) !== "P";
      if (redA) a.clearing = true;
      if (redB) b.clearing = true;
      const was = a.crashed || b.crashed;
      a.crashed = true;
      b.crashed = true;
      a.v = b.v = 0;
      if (was) {
        // 이미 사고 난 차를 들이받음
        sim.st.acc++;
        sim.score.acc -= 200;
      } else {
        sim.st.acc++;
        sim.score.acc -= 350;
      }
      const cause = a.clearing || b.clearing ? "clearing" : a.cautious || b.cautious ? "em" : c.merge ? "merge" : "conflict";
      sim.events.push({ k: "crash", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ids: [a.id, b.id], cause, inter: net.inters.indexOf(I), types: [a.type, b.type], clearType: a.clearing ? a.type : b.clearing ? b.type : "" });
    }

    /* ---------- 보행자 ---------- */
    const pedRate = level.peds || 0; // 횡단보도 하나당 분당 명
    function stepPeds(t) {
      for (const I of net.inters) {
        const ph = I.phases[I.cur];
        for (const k in I.peds) {
          const P = I.peds[k];
          const s = +k;
          const walk = I.state === "G" && ph.walk[s];
          P.walk = walk;
          P.walkAge = walk ? P.walkAge + DT : 0;
          if (pedRate && rng() < (pedRate / 60) * DT) P.wait[rng() < 0.5 ? 0 : 1].push(0);
          for (const w of P.wait) for (let i = 0; i < w.length; i++) w[i] += DT;
          // 건너기 시작: 보행 신호 앞부분 + 횡단보도 위에 차가 없을 때
          if (walk && P.walkAge > 0.8 && P.walkAge < WALK_START && !vehicleOnXw(I, s)) {
            for (let side = 0; side < 2; side++) {
              while (P.wait[side].length) {
                const w = P.wait[side].shift();
                if (w > 45) sim.score.ped -= Math.min(20, (w - 45) * 0.3);
                const dir = side === 0 ? 1 : -1;
                P.crossing.push({ u: -dir * (P.half + 1.4) + (rng() - 0.5) * 0.6, dir, sp: 1.1 + rng() * 0.5, off: (rng() - 0.5) * 2.2 });
              }
            }
          }
          for (let i = P.crossing.length - 1; i >= 0; i--) {
            const p = P.crossing[i];
            p.u += p.dir * p.sp * DT;
            if (Math.abs(p.u) > P.half + 1.6 && Math.sign(p.u) === p.dir) {
              P.crossing.splice(i, 1);
              sim.st.pedServed++;
              sim.score.ped += 2;
            }
          }
        }
      }
    }
    function vehicleOnXw(I, s) {
      for (const P of I.paths) {
        for (const x of P.xw) {
          if (x.side !== s) continue;
          let hit = false;
          // 교차로 안에서 이 횡단보도를 아직 다 지나지 않은 차
          intervals(P, (o, r) => {
            if (r < x.s1) hit = true;
          });
          if (hit) return true;
          // 들어오기로 한 차
          const L = I.inLink[P.inSide];
          if (L)
            for (const o of L.lanes[P.inLane].occ) {
              if (o.segs[o.si + 1] === P && o.gate === "go" && o.commit) return true;
            }
        }
      }
      return false;
    }

    /* ---------- 이벤트 ---------- */
    function runEvent(ev) {
      if (ev.kind === "emergency") {
        const E = net.linkById[ev.from];
        const X = net.linkById[ev.to];
        if (!E || !X) return;
        const r = findRoute(net, E, X);
        if (!r) return;
        queueVehicle(E, ev.type || "ambulance", r, { em: true, emLimit: ev.limit || goal.emLimit || 18 });
        sim.pending.push(ev);
      } else if (ev.kind === "warn") {
        sim.events.push({ k: "warn", text: ev.text, at: ev.at });
      } else if (ev.kind === "breakdown") {
        const L = net.linkById[ev.link];
        if (!L) return;
        const seg = L.lanes[ev.lane != null ? (ev.lane < 0 ? L.n + ev.lane : ev.lane) : L.n - 1];
        let pick = null;
        // 차로 한가운데에서 멈출 차만 (교차로 안까지 굴러가지 않게)
        for (const o of seg.occ) if (!o.em && !o.crashed && o.s > seg.len * 0.2 && o.s + (o.v * o.v) / (2 * o.T.b) < seg.len - 10 && (!pick || o.s > pick.s)) pick = o;
        if (pick) {
          pick.broken = true;
          pick.brokenT = 0;
          sim.events.push({ k: "broken", id: pick.id, x: pick.x, y: pick.y, type: pick.type });
        } else ev.done = false, (ev.t += 2);
      } else if (ev.kind === "close") {
        const L = net.linkById[ev.link];
        if (L) {
          L.closed = true;
          routeTable();
          rerouteAll();
          sim.events.push({ k: "closed", link: ev.link });
        }
      } else if (ev.kind === "wreck") {
        // 시작부터 사고 난 차 두 대
        const L = net.linkById[ev.link];
        if (!L) return;
        const seg = L.lanes[ev.lane != null ? ev.lane : L.n - 1];
        for (let i = 0; i < 2; i++) {
          const route = findRoute(net, L, sim.exits.find((X) => findRoute(net, L, X)));
          if (!route) return;
          const v = makeVehicle(i ? "car" : "taxi", L, route);
          v.segs = [seg];
          v.routeIdxOfSeg = [0];
          v.s = seg.len * (ev.pos || 0.55) - i * 5.2;
          v.crashed = true;
          v.crashT = -1e9; // 견인 전까지 안 치워짐
          seg.occ.push(v);
          sim.vehicles.push(v);
          pose(v);
        }
        sim.events.push({ k: "wreck", link: ev.link });
      }
    }
    function rerouteAll() {
      for (const v of sim.vehicles) {
        const need = v.route.links.slice(v.ri + 1).some((L) => L.closed);
        if (!need || v.crashed) continue;
        const curL = v.segs[v.si].kind === "lane" ? v.segs[v.si].link : null;
        if (!curL || !curL.to) continue;
        let best = null;
        for (const X of sim.exits) {
          if (X.closed) continue;
          const r = findRoute(net, curL, X);
          if (r && (!best || r.cost < best.cost)) best = r;
        }
        const keepTo = v.route.links[v.route.links.length - 1];
        const r2 = keepTo.closed ? null : findRoute(net, curL, keepTo);
        const r = r2 || best;
        if (!r) continue;
        v.route = { links: v.route.links.slice(0, v.ri).concat(r.links), turns: v.route.turns.slice(0, v.ri).concat(r.turns) };
        v.segs.length = v.si + 1;
        v.routeIdxOfSeg.length = v.si + 1;
      }
    }
    // 무한 · 오늘의 모드: 씨앗 난수로 긴급 차량 · 고장을 계속 만든다
    function procedural(t) {
      const pr = level.proc;
      if (!pr) return;
      if (sim.procEm == null) {
        sim.procEm = pr.emFirst || 40;
        sim.procBr = pr.brFirst || 70;
      }
      if (pr.em && t >= sim.procEm) {
        const E = sim.entries[Math.floor(rng() * sim.entries.length)];
        const list = sim.routes.get(E);
        if (list && list.length) {
          const r = list[Math.floor(rng() * list.length)].r;
          const ty = ["ambulance", "fire", "police"][Math.floor(rng() * 3)];
          sim.events.push({ k: "emWarn", entry: E.id, type: ty });
          queueVehicle(E, ty, r, { em: true, emLimit: pr.emLimit || 20 });
        }
        sim.procEm = t + pr.em[0] + rng() * (pr.em[1] - pr.em[0]);
      }
      if (pr.br && t >= sim.procBr) {
        const cands = net.links.filter((L) => L.to && !L.closed);
        const L = cands[Math.floor(rng() * cands.length)];
        runEvent({ kind: "breakdown", link: L.id });
        sim.procBr = t + pr.br[0] + rng() * (pr.br[1] - pr.br[0]);
      }
    }

    /* ---------- 지표 ---------- */
    function metrics(t) {
      const ratios = [];
      let waiting = 0;
      let wsum = 0;
      let wmax = 0;
      for (const L of net.links) {
        if (!L.to) continue;
        for (const sg of L.lanes) {
          let q = 0;
          for (const o of sg.occ) if (o.v < 2) q += o.T.len + 2.2;
          ratios.push(Math.min(1, q / sg.len));
        }
      }
      for (const v of sim.vehicles) {
        if (v.v < 1 && v.dwell === 0 && !v.crashed && !v.broken) {
          waiting++;
          wsum += v.stopT;
          if (v.stopT > wmax) wmax = v.stopT;
        }
      }
      let vq = 0;
      for (const E of sim.entries) {
        vq += E.queue.length;
        waiting += E.queue.length;
      }
      ratios.sort((a, b) => b - a);
      const r1 = ratios[0] || 0;
      const r3 = ratios.length ? (ratios[0] + (ratios[1] || 0) + (ratios[2] || 0)) / 3 : 0;
      const wNow = waiting ? wsum / Math.max(1, waiting - vq) : 0;
      const raw = 100 * Math.min(1, 0.3 * r1 + 0.25 * r3 + 0.3 * Math.min(1, vq / 14) + 0.15 * Math.min(1, wNow / 45));
      sim.st.cong += (raw - sim.st.cong) * Math.min(1, DT / 2);
      if (t > 5) sim.st.maxCong = Math.max(sim.st.maxCong, sim.st.cong);
      sim.st.waiting = waiting;
      sim.st.maxWaitNow = wmax;
      sim.st.vq = vq;
      sim.st.lanes = ratios;
    }

    /* ---------- 승패 ---------- */
    function evaluate(t) {
      const g = goal;
      const maxAcc = g.maxAcc != null ? g.maxAcc : 2;
      if (sim.st.acc > maxAcc) return finish("fail", "acc");
      const vqMax = Math.max(...sim.entries.map((E) => E.queue.length), 0);
      if (sim.st.cong >= 88) sim.gridT += DT;
      else sim.gridT = Math.max(0, sim.gridT - DT * 0.5);
      if (sim.gridT > 12 || vqMax >= 18) return finish("fail", "grid");
      if (g.maxCong && t > 8 && sim.st.cong > g.maxCong) {
        sim.overT = (sim.overT || 0) + DT;
        if (sim.overT > 6) return finish("fail", "cong");
      } else sim.overT = 0;
      if (g.emFail && sim.emLate) return finish("fail", "em");
      if (g.endless) return;
      const pendingEm = (level.events || []).some((e) => e.kind === "emergency" && !e.done) || sim.vehicles.some((v) => v.em) || sim.entries.some((E) => E.queue.some((q) => q.em));
      if (g.pass && sim.st.passed >= g.pass && !pendingEm && !g.fullTime) return finish("win", "pass");
      if (g.clearWreck && !sim.vehicles.some((v) => v.crashed && v.crashT < -1e8) && sim.st.passed >= (g.pass || 0) && !pendingEm) return finish("win", "clear");
      if (t >= g.time) {
        if (g.pass && sim.st.passed < g.pass) return finish("fail", "time");
        if (g.clearWreck && sim.vehicles.some((v) => v.crashed && v.crashT < -1e8)) return finish("fail", "time");
        return finish("win", "time");
      }
    }
    function finish(status, reason) {
      sim.status = status;
      sim.reason = reason;
      const s = sim.score;
      if (status === "win") {
        if (sim.st.acc === 0) s.bonus += 300;
        if (goal.time && !goal.fullTime && !goal.endless) s.bonus += Math.round(Math.max(0, goal.time - sim.t) * 4);
        const avgW = sim.st.passed ? sim.st.totalWait / sim.st.passed : 99;
        s.bonus += Math.round(Math.max(0, 25 - avgW) * 12);
      }
      if (goal.endless) s.bonus += Math.round(sim.t * 2);
      sim.events.push({ k: "end", status, reason });
    }
    sim.total = () => {
      const s = sim.score;
      return Math.max(0, Math.round(s.pass + s.wait + s.acc + s.em + s.ped + s.sw + s.bonus));
    };
    sim.stats = () => {
      const st = sim.st;
      return {
        t: sim.t,
        passed: st.passed,
        waiting: st.waiting,
        avgWait: st.passed ? st.totalWait / st.passed : 0,
        cong: st.cong,
        maxCong: st.maxCong,
        acc: st.acc,
        emPassed: st.emPassed,
        emDelay: st.emDelay,
        emMax: st.emMax,
        pedServed: st.pedServed,
        score: sim.total(),
      };
    };
    sim.forceEnd = () => {
      if (sim.status === "play") finish(goal.endless ? "fail" : "fail", "quit");
    };
    return sim;
  }

  /* ---------- 테스트 · 자동 조작용: 기다리는 차가 많은 쪽에 신호를 주는 봇 ---------- */
  function botPick(sim, ii, opts = {}) {
    const I = sim.net.inters[ii];
    const score = I.phases.map(() => 0);
    I.phases.forEach((ph, k) => {
      for (const key in ph.mv) {
        const side = sideIdx(key[0]);
        const L = I.inLink[side];
        if (!L) continue;
        for (const sg of L.lanes) {
          for (const o of sg.occ) {
            const nx = o.segs[o.si + 1];
            if (!nx || nx.kind !== "path" || nx.mvKey !== key) continue;
            const d = sg.len - o.s;
            if (d > 70) continue;
            score[k] += (o.em ? 12 : 1) * (1 + o.stopT / 12) * (ph.mv[key] === "P" ? 0.5 : 1);
          }
        }
        if (L.from === null) score[k] += L.queue.length * 1.5;
      }
    });
    return score;
  }
  function bot(sim, opts = {}) {
    const minG = opts.minGreen || 9;
    sim.net.inters.forEach((I, ii) => {
      if (I.state !== "G" || I.greenT < minG) return;
      const emNear = Object.values(I.inLink).some((L) => L.lanes.some((sg) => sg.occ.some((o) => o.em)));
      if (!opts.careless && !emNear && sim.bigInBox(ii) && I.greenT < 60) return; // 큰 차가 지나는 중엔 기다린다
      const sc = botPick(sim, ii);
      let best = I.cur;
      for (let k = 0; k < sc.length; k++) if (sc[k] > sc[best] * 1.35 + 1) best = k;
      if (I.greenT > (opts.maxGreen || 40) && best === I.cur) {
        let alt = -1;
        for (let k = 0; k < sc.length; k++) if (k !== I.cur && sc[k] > 0 && (alt < 0 || sc[k] > sc[alt])) alt = k;
        if (alt >= 0) best = alt;
      }
      if (best !== I.cur) sim.setPhase(ii, best);
    });
  }

  return { DT, LANE_W, YELLOW, MIN_GREEN, TYPES, PHASES, SIDES, U, create, hashStr, mulberry32, pointAt, bot, botPick, laneUse, getPath, findRoute };
});
