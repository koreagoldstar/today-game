/* 교통지옥 — Canvas 2D 렌더러 (시뮬레이션 상태를 읽기만 한다)
 * 정적인 도시 · 도로는 한 번만 그려 두고, 매 프레임엔 신호 · 차 · 사람 · 효과만 그린다.
 */
(function () {
  "use strict";
  const TH = window.TH;
  const W = TH.LANE_W;
  const U = TH.U;

  function makeRenderer(canvas, sim, theme) {
    const ctx = canvas.getContext("2d");
    const R = { canvas, ctx, sim, theme, k: 4, ox: 0, oy: 0, dpr: 1, fx: [], shake: 0, sel: 0, low: false, flash: [], warnEntry: [] };
    const net = sim.net;

    /* 보이는 범위 = 모든 도로 끝점 */
    let bx0 = 1e9;
    let by0 = 1e9;
    let bx1 = -1e9;
    let by1 = -1e9;
    for (const L of net.links)
      for (const sg of L.lanes) {
        for (let i = 0; i < sg.pts.length; i += 2) {
          bx0 = Math.min(bx0, sg.pts[i]);
          bx1 = Math.max(bx1, sg.pts[i]);
          by0 = Math.min(by0, sg.pts[i + 1]);
          by1 = Math.max(by1, sg.pts[i + 1]);
        }
      }
    // 카메라: 교차로 둘레만 크게 보여 준다 (도로 끝은 화면 밖으로 · 차는 화면 밖에서 나타남)
    const M = 34;
    let ix0 = 1e9, iy0 = 1e9, ix1 = -1e9, iy1 = -1e9;
    for (const I of net.inters) {
      ix0 = Math.min(ix0, I.x - I.stopD - M);
      iy0 = Math.min(iy0, I.y - I.stopD - M);
      ix1 = Math.max(ix1, I.x + I.stopD + M);
      iy1 = Math.max(iy1, I.y + I.stopD + M);
    }
    bx0 = Math.max(bx0 + 6, ix0);
    by0 = Math.max(by0 + 6, iy0);
    bx1 = Math.min(bx1 - 6, ix1);
    by1 = Math.min(by1 - 6, iy1);
    R.bounds = [bx0, by0, bx1, by1];

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, R.low ? 1 : 2);
      R.dpr = dpr;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      const w = bx1 - bx0;
      const h = by1 - by0;
      // 교차로 둘레가 다 보이게 맞춘다. 남는 쪽은 도로를 화면 끝까지 그려 채운다
      R.k = Math.min(canvas.width / w, canvas.height / h);
      R.ox = (canvas.width - w * R.k) / 2 - bx0 * R.k;
      R.oy = (canvas.height - h * R.k) / 2 - by0 * R.k;
      R.cssK = R.k / dpr;
      buildStatic();
    }
    R.resize = resize;
    R.toWorld = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      const px = (cx - r.left) * R.dpr;
      const py = (cy - r.top) * R.dpr;
      return [(px - R.ox) / R.k, (py - R.oy) / R.k];
    };
    R.toScreen = (x, y) => [(x * R.k + R.ox) / R.dpr, (y * R.k + R.oy) / R.dpr];

    /* ---------- 정적 레이어 ---------- */
    let stat = null;
    function roadRects() {
      // 각 링크 쌍(양방향)의 도로 사각형
      const rects = [];
      for (const I of net.inters) {
        for (const k in I.arms) {
          const s = +k;
          const a = I.arms[s];
          const u = U[s];
          const r = U[(s + 1) % 4];
          let far;
          if (a.edge) far = 2000; // 바깥 도로는 화면 끝까지
          else {
            const B = a.to;
            far = Math.hypot(B.x - I.x, B.y - I.y) / 2;
          }
          // 오른쪽(나가는 차로) · 왼쪽(들어오는 차로) 폭
          const wr = a.outN * W;
          const wl = a.inN * W;
          rects.push({ I, s, u, r, near: 0, far, wl, wr });
        }
      }
      return rects;
    }
    function quad(c, I, R0, n0, n1, l, rr) {
      // 팔 방향 n0..n1, 가로 -l..rr
      const ux = R0.u[0];
      const uy = R0.u[1];
      const rx = R0.r[0];
      const ry = R0.r[1];
      c.beginPath();
      c.moveTo(I.x + ux * n0 - rx * l, I.y + uy * n0 - ry * l);
      c.lineTo(I.x + ux * n1 - rx * l, I.y + uy * n1 - ry * l);
      c.lineTo(I.x + ux * n1 + rx * rr, I.y + uy * n1 + ry * rr);
      c.lineTo(I.x + ux * n0 + rx * rr, I.y + uy * n0 + ry * rr);
      c.closePath();
    }
    function buildStatic() {
      stat = stat || document.createElement("canvas");
      stat.width = canvas.width;
      stat.height = canvas.height;
      const c = stat.getContext("2d");
      const th = theme;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = th.block;
      c.fillRect(0, 0, stat.width, stat.height);
      c.setTransform(R.k, 0, 0, R.k, R.ox, R.oy);
      const rects = roadRects();
      const pad = 14;
      const X0 = -R.ox / R.k - pad;
      const Y0 = -R.oy / R.k - pad;
      const X1 = (canvas.width - R.ox) / R.k + pad;
      const Y1 = (canvas.height - R.oy) / R.k + pad;
      // 보도
      c.fillStyle = "#8d949c";
      for (const q of rects) {
        quad(c, q.I, q, 0, q.far + (q.far > 200 ? 0 : 0.01), q.wl + 2.6, q.wr + 2.6);
        c.fill();
      }
      for (const I of net.inters) {
        c.fillRect(I.x - I.H - 2.6, I.y - I.H - 2.6, (I.H + 2.6) * 2, (I.H + 2.6) * 2);
      }
      // 건물 (도로 · 보도에 겹치지 않게)
      let rng = null;
      const hits = (x, y, w, h) => {
        for (const q of rects) {
          // 사각형을 팔 좌표로 바꿔 검사
          const pts = [
            [x, y],
            [x + w, y],
            [x, y + h],
            [x + w, y + h],
          ];
          let minA = 1e9;
          let maxA = -1e9;
          let minB = 1e9;
          let maxB = -1e9;
          for (const p of pts) {
            const a = (p[0] - q.I.x) * q.u[0] + (p[1] - q.I.y) * q.u[1];
            const b = (p[0] - q.I.x) * q.r[0] + (p[1] - q.I.y) * q.r[1];
            minA = Math.min(minA, a);
            maxA = Math.max(maxA, a);
            minB = Math.min(minB, b);
            maxB = Math.max(maxB, b);
          }
          if (maxA > -q.I.H - 4 && minA < q.far + 0.5 && maxB > -q.wl - 4 && minB < q.wr + 4) return true;
        }
        return false;
      };
      const roofs = th.roof;
      for (let y = Math.floor(Y0 / 13) * 13; y < Y1; y += 13) {
        for (let x = Math.floor(X0 / 13) * 13; x < X1; x += 13) {
          rng = TH.mulberry32(TH.hashStr(sim.level.theme + ":" + x + "," + y)); // 칸마다 고정 (화면 크기가 바뀌어도 같은 건물)
          const w = 8 + rng() * 4.5;
          const h = 8 + rng() * 4.5;
          const jx = x + rng() * 2;
          const jy = y + rng() * 2;
          if (hits(jx, jy, w, h)) {
            if (rng() < 0.35 && !hits(jx + 3, jy + 3, 2, 2)) {
              c.fillStyle = th.tree;
              c.beginPath();
              c.arc(jx + 4, jy + 4, 1.6, 0, 7);
              c.fill();
            }
            continue;
          }
          if (rng() < 0.12) {
            // 작은 공원
            c.fillStyle = "#4b6b4f";
            c.fillRect(jx, jy, w, h);
            c.fillStyle = th.tree;
            for (let i = 0; i < 4; i++) {
              c.beginPath();
              c.arc(jx + 2 + rng() * (w - 4), jy + 2 + rng() * (h - 4), 1.3 + rng() * 0.9, 0, 7);
              c.fill();
            }
            continue;
          }
          c.fillStyle = "rgba(0,0,0,.28)";
          c.fillRect(jx + 1.1, jy + 1.3, w, h);
          const col = roofs[Math.floor(rng() * roofs.length)];
          c.fillStyle = col;
          c.fillRect(jx, jy, w, h);
          c.strokeStyle = "rgba(255,255,255,.12)";
          c.lineWidth = 0.35;
          c.strokeRect(jx + 0.6, jy + 0.6, w - 1.2, h - 1.2);
          c.fillStyle = "rgba(0,0,0,.18)";
          c.fillRect(jx + w * 0.55, jy + h * 0.2, w * 0.25, h * 0.22);
          if (rng() < 0.5) c.fillRect(jx + w * 0.18, jy + h * 0.6, w * 0.2, h * 0.18);
        }
      }
      // 아스팔트
      c.fillStyle = "#2b2f35";
      for (const q of rects) {
        quad(c, q.I, q, 0, q.far + 0.02, q.wl, q.wr);
        c.fill();
      }
      for (const I of net.inters) {
        c.fillRect(I.x - I.H, I.y - I.H, I.H * 2, I.H * 2);
      }
      // 차선
      for (const q of rects) {
        const I = q.I;
        const st = I.stopD;
        // 가운데 노란 겹선
        c.strokeStyle = "#e5b93f";
        c.lineWidth = 0.14;
        for (const off of [-0.16, 0.16]) {
          c.beginPath();
          c.moveTo(I.x + q.u[0] * I.H + q.r[0] * off, I.y + q.u[1] * I.H + q.r[1] * off);
          c.lineTo(I.x + q.u[0] * q.far + q.r[0] * off, I.y + q.u[1] * q.far + q.r[1] * off);
          c.stroke();
        }
        // 차로 경계 (점선)
        c.strokeStyle = "rgba(240,240,240,.75)";
        c.setLineDash([2.2, 2.6]);
        c.lineWidth = 0.13;
        const lines = [];
        for (let i = 1; i < q.wr / W; i++) lines.push(i * W);
        for (let i = 1; i < q.wl / W; i++) lines.push(-i * W);
        for (const off of lines) {
          c.beginPath();
          c.moveTo(I.x + q.u[0] * (st + 0.2) + q.r[0] * off, I.y + q.u[1] * (st + 0.2) + q.r[1] * off);
          c.lineTo(I.x + q.u[0] * q.far + q.r[0] * off, I.y + q.u[1] * q.far + q.r[1] * off);
          c.stroke();
        }
        c.setLineDash([]);
        // 가장자리 실선
        c.strokeStyle = "rgba(240,240,240,.55)";
        c.lineWidth = 0.12;
        for (const off of [q.wr - 0.25, -q.wl + 0.25]) {
          c.beginPath();
          c.moveTo(I.x + q.u[0] * (I.H + 3.6) + q.r[0] * off, I.y + q.u[1] * (I.H + 3.6) + q.r[1] * off);
          c.lineTo(I.x + q.u[0] * q.far + q.r[0] * off, I.y + q.u[1] * q.far + q.r[1] * off);
          c.stroke();
        }
        // 정지선 (들어오는 차로 쪽 = 왼쪽)
        c.strokeStyle = "#f2f2f2";
        c.lineWidth = 0.45;
        c.beginPath();
        c.moveTo(I.x + q.u[0] * (st - 0.1), I.y + q.u[1] * (st - 0.1));
        c.lineTo(I.x + q.u[0] * (st - 0.1) - q.r[0] * q.wl, I.y + q.u[1] * (st - 0.1) - q.r[1] * q.wl);
        c.stroke();
        // 횡단보도
        if (I.peds[q.s]) {
          c.fillStyle = "rgba(236,236,236,.85)";
          for (let b = -q.wl + 0.3; b < q.wr - 0.3; b += 1.1) {
            const a0 = I.H + 0.6;
            const a1 = I.H + 3.4;
            c.beginPath();
            c.moveTo(I.x + q.u[0] * a0 + q.r[0] * b, I.y + q.u[1] * a0 + q.r[1] * b);
            c.lineTo(I.x + q.u[0] * a1 + q.r[0] * b, I.y + q.u[1] * a1 + q.r[1] * b);
            c.lineTo(I.x + q.u[0] * a1 + q.r[0] * (b + 0.55), I.y + q.u[1] * a1 + q.r[1] * (b + 0.55));
            c.lineTo(I.x + q.u[0] * a0 + q.r[0] * (b + 0.55), I.y + q.u[1] * a0 + q.r[1] * (b + 0.55));
            c.fill();
          }
        }
        // 바닥 화살표
        const L = I.inLink[q.s];
        if (L) {
          const use = TH.laneUse(L);
          for (let i = 0; i < L.n; i++) {
            const off = -(i + 0.5) * W;
            const a = st + 6;
            drawArrows(c, I.x + q.u[0] * a + q.r[0] * off, I.y + q.u[1] * a + q.r[1] * off, Math.atan2(-q.u[1], -q.u[0]), use[i]);
          }
        }
      }
      // 버스 정류장 · 택시
      for (const b of sim.level.busStops || []) mark(c, b, "#f0c419", "BUS");
      for (const b of sim.level.taxiZones || []) mark(c, b, "#f39c34", "TAXI");
      // 공사 · 통제
      for (const L of net.links) {
        if (L.work || L.closed) {
          const sg = L.lanes[L.n - 1];
          const n = Math.floor(sg.len / 6);
          for (let i = 1; i < n; i++) {
            const p = TH.pointAt(sg, i * 6, [0, 0]);
            const r = U[(L.h + 1) % 4];
            cone(c, p[0] + r[0] * (W / 2 + 0.2), p[1] + r[1] * (W / 2 + 0.2));
          }
        }
        if (L.closed) {
          for (const sg of L.lanes) {
            const p = TH.pointAt(sg, 2.5, [0, 0]);
            barrier(c, p[0], p[1], L.h);
          }
        }
      }
      // 교차로 이름 (여러 개일 때)
      if (net.inters.length > 1) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.font = `800 ${Math.round(11 * R.dpr)}px Outfit, sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        for (const I of net.inters) {
          const x = (I.x - I.H - 4) * R.k + R.ox;
          const y = (I.y - I.H - 4) * R.k + R.oy;
          c.fillStyle = "rgba(10,14,22,.7)";
          c.beginPath();
          c.arc(x, y, 9 * R.dpr, 0, 7);
          c.fill();
          c.fillStyle = "#ffd24a";
          c.fillText(I.id, x, y + 0.5);
        }
      }
    }
    function mark(c, b, color, text) {
      const L = net.linkById[b.link];
      if (!L) return;
      const lane = b.lane < 0 ? L.n + b.lane : b.lane;
      const sg = L.lanes[lane];
      const p = TH.pointAt(sg, sg.len * b.pos, [0, 0]);
      const ang = Math.atan2(U[L.h][1], U[L.h][0]);
      c.save();
      c.translate(p[0], p[1]);
      c.rotate(ang);
      c.strokeStyle = color;
      c.lineWidth = 0.22;
      c.setLineDash([0.8, 0.6]);
      c.strokeRect(-12.5, -W / 2 + 0.2, 13, W - 0.4);
      c.setLineDash([]);
      c.fillStyle = color;
      c.font = "800 1.3px Outfit, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, -6, 0);
      // 정류장 지붕 (보도 위)
      c.fillStyle = "#3a4d63";
      c.fillRect(-9, W / 2 + 0.9, 5, 1.4);
      c.restore();
    }
    function cone(c, x, y) {
      c.fillStyle = "#ff7a1a";
      c.beginPath();
      c.arc(x, y, 0.42, 0, 7);
      c.fill();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(x, y, 0.18, 0, 7);
      c.fill();
    }
    function barrier(c, x, y, h) {
      const r = U[(h + 1) % 4];
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(r[1], r[0]));
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? "#f4f4f4" : "#e8532c";
        c.fillRect(-W / 2 + (i * W) / 4, -0.35, W / 4, 0.7);
      }
      c.restore();
    }
    function drawArrows(c, x, y, ang, moves) {
      c.save();
      c.translate(x, y);
      c.rotate(ang);
      c.strokeStyle = "rgba(240,240,240,.7)";
      c.fillStyle = "rgba(240,240,240,.7)";
      c.lineWidth = 0.28;
      const hasS = moves.includes("S");
      const hasL = moves.includes("L");
      const hasR = moves.includes("R");
      c.beginPath();
      c.moveTo(-1.6, 0);
      c.lineTo(hasS ? 1.1 : 0, 0);
      c.stroke();
      if (hasS) tri(c, 1.6, 0, 0);
      if (hasL) {
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(0.6, 0, 0.6, -0.9);
        c.stroke();
        tri(c, 0.6, -1.3, -Math.PI / 2);
      }
      if (hasR) {
        c.beginPath();
        c.moveTo(-0.2, 0);
        c.quadraticCurveTo(0.4, 0, 0.4, 0.9);
        c.stroke();
        tri(c, 0.4, 1.3, Math.PI / 2);
      }
      c.restore();
    }
    function tri(c, x, y, a) {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.beginPath();
      c.moveTo(0.5, 0);
      c.lineTo(-0.3, -0.45);
      c.lineTo(-0.3, 0.45);
      c.fill();
      c.restore();
    }

    /* ---------- 차 그리기 (탑다운) ---------- */
    function rr(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    }
    function drawCar(c, v, time) {
      const L = v.T.len;
      const Wd = v.T.wid;
      const hl = L / 2;
      const hw = Wd / 2;
      // 그림자
      c.fillStyle = "rgba(0,0,0,.35)";
      rr(c, -hl + 0.25, -hw + 0.3, L, Wd, 0.5);
      c.fill();
      const t = v.type;
      let body = v.color;
      if (t === "taxi") body = "#f2a33a";
      if (t === "ambulance") body = "#f4f6f8";
      if (t === "fire") body = "#d63a2f";
      if (t === "police") body = "#f1f3f6";
      if (t === "bus") body = v.id % 3 === 0 ? "#2f8f5b" : v.id % 3 === 1 ? "#2a6db3" : "#d0503c";
      if (t === "moto") {
        c.fillStyle = "#1c1f24";
        rr(c, -hl, -0.25, L, 0.5, 0.2);
        c.fill();
        c.fillStyle = v.color;
        rr(c, -0.6, -0.36, 1.3, 0.72, 0.3);
        c.fill();
        c.fillStyle = "#e9e3d4";
        c.beginPath();
        c.arc(-0.15, 0, 0.36, 0, 7);
        c.fill();
        c.fillStyle = "#222";
        c.beginPath();
        c.arc(-0.15, 0, 0.22, 0, 7);
        c.fill();
        c.fillStyle = "#ffe9a0";
        c.fillRect(hl - 0.15, -0.12, 0.15, 0.24);
        return;
      }
      if (t === "truck") {
        // 적재함 + 운전석
        c.fillStyle = "#d9dde2";
        rr(c, -hl, -hw, L * 0.72, Wd, 0.25);
        c.fill();
        c.strokeStyle = "rgba(0,0,0,.18)";
        c.lineWidth = 0.08;
        for (let i = 1; i < 5; i++) {
          c.beginPath();
          c.moveTo(-hl + (L * 0.72 * i) / 5, -hw + 0.15);
          c.lineTo(-hl + (L * 0.72 * i) / 5, hw - 0.15);
          c.stroke();
        }
        c.fillStyle = v.color === "#2b2f36" ? "#3866a8" : v.color;
        rr(c, -hl + L * 0.75, -hw + 0.05, L * 0.25, Wd - 0.1, 0.45);
        c.fill();
        c.fillStyle = "#1d2a38";
        rr(c, hl - 0.85, -hw + 0.3, 0.55, Wd - 0.6, 0.15);
        c.fill();
        lights(c, v, hl, hw, L);
        return;
      }
      c.fillStyle = body;
      rr(c, -hl, -hw, L, Wd, t === "bus" || t === "fire" ? 0.45 : 0.75);
      c.fill();
      if (t === "bus") {
        c.fillStyle = "#1d2a38";
        rr(c, hl - 1.1, -hw + 0.25, 0.8, Wd - 0.5, 0.2);
        c.fill();
        c.fillStyle = "rgba(205,225,240,.55)";
        for (let x = -hl + 0.8; x < hl - 1.6; x += 1.5) {
          c.fillRect(x, -hw + 0.12, 1.1, 0.3);
          c.fillRect(x, hw - 0.42, 1.1, 0.3);
        }
        c.fillStyle = "rgba(255,255,255,.22)";
        c.fillRect(-hl + 1.5, -0.55, 3, 1.1);
        lights(c, v, hl, hw, L);
        return;
      }
      if (t === "fire") {
        c.fillStyle = "#b8bcc2";
        c.fillRect(-hl + 0.6, -0.55, L * 0.62, 1.1);
        c.strokeStyle = "#7d828a";
        c.lineWidth = 0.08;
        for (let x = -hl + 0.8; x < -hl + 0.6 + L * 0.62; x += 0.6) {
          c.beginPath();
          c.moveTo(x, -0.55);
          c.lineTo(x, 0.55);
          c.stroke();
        }
        c.fillStyle = "#1d2a38";
        rr(c, hl - 1.2, -hw + 0.25, 0.75, Wd - 0.5, 0.2);
        c.fill();
        lightbar(c, hl - 1.8, Wd, time, "#ff2b2b", "#ff2b2b");
        lights(c, v, hl, hw, L);
        return;
      }
      // 승용차 계열: 앞유리 · 지붕 · 뒷유리
      c.fillStyle = "#1d2733";
      rr(c, hl * 0.18, -hw + 0.22, hl * 0.42, Wd - 0.44, 0.25);
      c.fill();
      c.fillStyle = "#26303c";
      rr(c, -hl * 0.78, -hw + 0.28, hl * 0.32, Wd - 0.56, 0.2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,.14)";
      rr(c, -hl * 0.44, -hw + 0.3, hl * 0.6, Wd - 0.6, 0.25);
      c.fill();
      if (t === "taxi") {
        c.fillStyle = "#fff6d6";
        c.fillRect(-0.45, -0.32, 0.7, 0.64);
        c.fillStyle = "#c97b12";
        c.fillRect(-0.3, -0.12, 0.4, 0.24);
      }
      if (t === "ambulance") {
        c.fillStyle = "#e23b3b";
        c.fillRect(-hl, -hw + 0.02, L, 0.24);
        c.fillRect(-hl, hw - 0.26, L, 0.24);
        c.fillRect(-1.3, -0.15, 0.9, 0.3);
        c.fillRect(-1.0, -0.45, 0.3, 0.9);
        lightbar(c, hl * 0.05, Wd, time, "#ff2b2b", "#2b6bff");
      }
      if (t === "police") {
        c.fillStyle = "#1e3a7a";
        c.fillRect(-hl + 0.3, -hw, L * 0.55, 0.32);
        c.fillRect(-hl + 0.3, hw - 0.32, L * 0.55, 0.32);
        lightbar(c, -0.25, Wd, time, "#2b6bff", "#ff2b2b");
      }
      lights(c, v, hl, hw, L);
    }
    function lights(c, v, hl, hw) {
      c.fillStyle = "#fff1b8";
      c.fillRect(hl - 0.18, -hw + 0.18, 0.18, 0.34);
      c.fillRect(hl - 0.18, hw - 0.52, 0.18, 0.34);
      c.fillStyle = v.brake || v.v < 0.3 ? "#ff3b3b" : "#7a1f1f";
      c.fillRect(-hl, -hw + 0.18, 0.18, 0.34);
      c.fillRect(-hl, hw - 0.52, 0.18, 0.34);
      if (v.broken && Math.floor(performance.now() / 350) % 2) {
        c.fillStyle = "#ffb31a";
        c.fillRect(hl - 0.3, -hw - 0.05, 0.35, 0.35);
        c.fillRect(hl - 0.3, hw - 0.3, 0.35, 0.35);
        c.fillRect(-hl - 0.05, -hw - 0.05, 0.35, 0.35);
        c.fillRect(-hl - 0.05, hw - 0.3, 0.35, 0.35);
      }
    }
    function lightbar(c, x, wd, time, a, b) {
      const on = Math.floor(time * 6) % 2;
      c.fillStyle = on ? a : "#5a1010";
      c.fillRect(x - 0.25, -wd / 2 + 0.3, 0.5, wd / 2 - 0.3);
      c.fillStyle = on ? "#10205a" : b;
      c.fillRect(x - 0.25, 0, 0.5, wd / 2 - 0.3);
      if (on) {
        c.fillStyle = a === "#ff2b2b" ? "rgba(255,60,60,.22)" : "rgba(60,110,255,.22)";
        c.beginPath();
        c.arc(x, 0, 2.6, 0, 7);
        c.fill();
      }
    }

    /* ---------- 신호등 ---------- */
    const SIGCOL = { G: "#2fe07a", P: "#9be86a", Y: "#ffc928", R: "#ff3d3d" };
    function laneSignal(I, side, use) {
      const S = TH.SIDES[side];
      const key = use.includes("S") ? S + "S" : use.includes("L") ? S + "L" : S + use[0];
      return sim.signalOf(I, key);
    }
    function drawSignals(c, time) {
      for (const I of net.inters) {
        for (const k in I.inLink) {
          const s = +k;
          const L = I.inLink[s];
          const use = TH.laneUse(L);
          const u = U[s];
          const r = U[(s + 1) % 4];
          const st = I.stopD;
          for (let i = 0; i < L.n; i++) {
            const sig = laneSignal(I, s, use[i]);
            const off = -(i + 0.5) * W;
            const cx = I.x + u[0] * (st + 0.25) + r[0] * off;
            const cy = I.y + u[1] * (st + 0.25) + r[1] * off;
            c.save();
            c.translate(cx, cy);
            c.rotate(Math.atan2(r[1], r[0]));
            c.fillStyle = SIGCOL[sig];
            c.globalAlpha = sig === "P" ? 0.55 + 0.35 * Math.sin(time * 6) : 0.9;
            c.fillRect(-W / 2 + 0.25, -0.3, W - 0.5, 0.6);
            c.globalAlpha = 1;
            c.restore();
            // 섞인 차로의 좌회전 화살표 표시
            if (use[i].includes("L") && use[i].length > 1) {
              const ls = sim.signalOf(I, TH.SIDES[s] + "L");
              c.fillStyle = SIGCOL[ls];
              c.beginPath();
              c.arc(cx + u[0] * 1.1, cy + u[1] * 1.1, 0.42, 0, 7);
              c.fill();
            }
          }
          // 신호등 기둥 (오른쪽 보도 끝)
          const px = I.x + u[0] * (st + 1) - r[0] * (L.n * W + 1.8);
          const py = I.y + u[1] * (st + 1) - r[1] * (L.n * W + 1.8);
          const sS = sim.signalOf(I, TH.SIDES[s] + "S");
          const sL = sim.signalOf(I, TH.SIDES[s] + "L");
          c.save();
          c.translate(px, py);
          c.rotate(Math.atan2(-u[1], -u[0]) + Math.PI / 2);
          const sz = Math.max(1, 5 / R.k / (R.dpr > 1 ? 0.6 : 1)) * 0.5;
          c.scale(sz, sz);
          c.fillStyle = "#111418";
          rr(c, -2.3, -0.8, 4.6, 1.6, 0.5);
          c.fill();
          const cols = ["R", "Y", "G"];
          for (let j = 0; j < 3; j++) {
            const on = sS === cols[j] || (cols[j] === "G" && sS === "P");
            c.fillStyle = on ? SIGCOL[cols[j]] : "#2b2f36";
            c.beginPath();
            c.arc(-1.55 + j * 1.05, 0, 0.42, 0, 7);
            c.fill();
            if (on) {
              c.fillStyle = SIGCOL[cols[j]] + "55";
              c.beginPath();
              c.arc(-1.55 + j * 1.05, 0, 0.9, 0, 7);
              c.fill();
            }
          }
          // 좌회전 화살표 등
          c.fillStyle = sL === "G" ? SIGCOL.G : "#2b2f36";
          c.beginPath();
          c.moveTo(1.65, -0.42);
          c.lineTo(1.25, 0);
          c.lineTo(1.65, 0.42);
          c.closePath();
          c.fill();
          c.restore();
        }
      }
    }

    /* ---------- 정체 표시 ---------- */
    function drawCongestion(c) {
      for (const L of net.links) {
        if (!L.to) continue;
        for (const sg of L.lanes) {
          if (sg.occ.length < 2) continue;
          let q = 0;
          let last = sg.len;
          const occ = sg.occ;
          for (const o of occ) {
            if (o.v > 2.5) break;
            if (last - o.s > 9) break;
            last = o.s - o.T.len;
            q = sg.len - last;
          }
          if (q < 12) continue;
          const ratio = Math.min(1, q / sg.len);
          const p0 = TH.pointAt(sg, sg.len, [0, 0]);
          const p1 = TH.pointAt(sg, Math.max(0, sg.len - q - 3), [0, 0]);
          const g = c.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
          g.addColorStop(0, `rgba(255,${Math.round(150 - ratio * 120)},40,${0.18 + ratio * 0.32})`);
          g.addColorStop(1, "rgba(255,60,40,0)");
          c.strokeStyle = g;
          c.lineWidth = W * 0.95;
          c.beginPath();
          c.moveTo(p0[0], p0[1]);
          c.lineTo(p1[0], p1[1]);
          c.stroke();
        }
      }
    }

    /* ---------- 보행자 ---------- */
    function drawPeds(c) {
      for (const I of net.inters) {
        for (const k in I.peds) {
          const s = +k;
          const P = I.peds[s];
          const u = U[s];
          const r = U[(s + 1) % 4];
          const a = I.H + 2;
          const base = (b, off) => [I.x + u[0] * (a + off) + r[0] * b, I.y + u[1] * (a + off) + r[1] * b];
          for (let side = 0; side < 2; side++) {
            const n = Math.min(P.wait[side].length, 10);
            const b = (side === 0 ? -1 : 1) * (P.half + 1.4);
            for (let i = 0; i < n; i++) {
              const p = base(b + (side === 0 ? -1 : 1) * (i % 3) * 0.6, ((i / 3) | 0) * 0.7 - 0.8);
              person(c, p[0], p[1], P.wait[side][i] > 45);
            }
          }
          for (const p of P.crossing) {
            const q = base(p.u, p.off * 0.5);
            person(c, q[0], q[1], false, true);
          }
          // 보행 신호
          const w = base(P.half + 2.2, 2.2);
          c.fillStyle = P.walk && P.walkAge < 7 ? "#2fe07a" : P.walk ? "#c9e86a" : "#ff3d3d";
          c.beginPath();
          c.arc(w[0], w[1], 0.4, 0, 7);
          c.fill();
        }
      }
    }
    function person(c, x, y, angry, moving) {
      c.fillStyle = angry ? "#ff7b5a" : moving ? "#ffe2b8" : "#e8d7c0";
      c.beginPath();
      c.arc(x, y, 0.36, 0, 7);
      c.fill();
      c.fillStyle = angry ? "#8a1f10" : "#3a3f6a";
      c.beginPath();
      c.arc(x, y, 0.2, 0, 7);
      c.fill();
    }

    /* ---------- 효과 ---------- */
    R.addFx = (fx) => {
      if (R.low && R.fx.length > 30) return;
      R.fx.push(fx);
    };
    R.crashFx = (x, y) => {
      R.shake = 0.5;
      for (let i = 0; i < (R.low ? 8 : 18); i++) {
        const a = Math.random() * 6.28;
        const sp = 4 + Math.random() * 10;
        R.addFx({ k: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.5 + Math.random() * 0.4 });
      }
      for (let i = 0; i < 6; i++) R.addFx({ k: "smoke", x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2, t: -i * 0.25, life: 3.5 });
    };
    R.text = (x, y, text, color) => R.addFx({ k: "text", x, y, text, color, t: 0, life: 1.5 });

    function drawFx(c, dt) {
      for (let i = R.fx.length - 1; i >= 0; i--) {
        const f = R.fx[i];
        f.t += dt;
        if (f.t > f.life) {
          R.fx.splice(i, 1);
          continue;
        }
        if (f.t < 0) continue;
        if (f.k === "spark") {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vx *= 0.9;
          f.vy *= 0.9;
          c.fillStyle = `rgba(255,${180 + Math.random() * 60},60,${1 - f.t / f.life})`;
          c.fillRect(f.x - 0.2, f.y - 0.2, 0.4, 0.4);
        } else if (f.k === "smoke") {
          const p = f.t / f.life;
          c.fillStyle = `rgba(70,70,74,${0.45 * (1 - p)})`;
          c.beginPath();
          c.arc(f.x + p * 2, f.y - p * 3, 1 + p * 3, 0, 7);
          c.fill();
        }
      }
    }
    function drawTextFx(c) {
      c.textAlign = "center";
      c.textBaseline = "middle";
      for (const f of R.fx) {
        if (f.k !== "text" || f.t < 0) continue;
        const p = f.t / f.life;
        const [sx, sy] = [f.x * R.k + R.ox, f.y * R.k + R.oy - p * 30 * R.dpr];
        c.globalAlpha = 1 - p * p;
        c.font = `900 ${Math.round(13 * R.dpr)}px Outfit, 'Noto Sans KR', sans-serif`;
        c.lineWidth = 3 * R.dpr;
        c.strokeStyle = "rgba(0,0,0,.65)";
        c.strokeText(f.text, sx, sy);
        c.fillStyle = f.color || "#fff";
        c.fillText(f.text, sx, sy);
        c.globalAlpha = 1;
      }
    }

    /* ---------- 한 프레임 ---------- */
    let lastT = performance.now();
    R.draw = function (alpha) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const time = sim.t;
      const c = ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (stat) c.drawImage(stat, 0, 0);
      let sx = 0;
      let sy = 0;
      if (R.shake > 0) {
        R.shake -= dt;
        sx = (Math.random() - 0.5) * R.shake * 14 * R.dpr;
        sy = (Math.random() - 0.5) * R.shake * 14 * R.dpr;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(stat, sx, sy);
      }
      c.setTransform(R.k, 0, 0, R.k, R.ox + sx, R.oy + sy);
      drawCongestion(c);
      drawSignals(c, time);
      drawPeds(c);
      // 선택한 교차로
      const SI = net.inters[R.sel];
      if (SI) {
        c.strokeStyle = "rgba(255,210,74,.9)";
        c.lineWidth = Math.max(0.3, 2.2 / R.k * R.dpr);
        c.setLineDash([1.2, 0.9]);
        c.lineDashOffset = -time * 3;
        c.strokeRect(SI.x - SI.H - 0.6, SI.y - SI.H - 0.6, (SI.H + 0.6) * 2, (SI.H + 0.6) * 2);
        c.setLineDash([]);
      }
      // 차
      for (const v of sim.vehicles) {
        let x = v.ox + (v.x - v.ox) * alpha;
        let y = v.oy + (v.y - v.oy) * alpha;
        let da = v.ang - v.oang;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        let a = v.oang + da * alpha;
        if (v.crashed) a += ((v.id % 5) - 2) * 0.12;
        c.save();
        // 도로 끝(입구)에서 막 나타난 차는 서서히 보이게
        if (v.si === 0 && !v.segs[0].link.from) c.globalAlpha = Math.max(0, Math.min(1, (v.s - v.T.len * 0.3) / 8));
        const vs = v.segs[v.si];
        if (vs.kind === "lane" && !vs.link.to) c.globalAlpha = Math.max(0, Math.min(1, (vs.len - v.s + v.T.len * 0.5) / 8)); // 출구에서 서서히 사라짐
        c.translate(x, y);
        c.rotate(a);
        if (v.clearing && !v.crashed) {
          c.strokeStyle = "rgba(255,150,30,.95)";
          c.lineWidth = 0.35;
          rr(c, -v.T.len / 2 - 0.35, -v.T.wid / 2 - 0.35, v.T.len + 0.7, v.T.wid + 0.7, 0.8);
          c.stroke();
        }
        if (v.em) {
          c.strokeStyle = `rgba(255,70,70,${0.4 + 0.4 * Math.sin(time * 10)})`;
          c.lineWidth = 0.4;
          rr(c, -v.T.len / 2 - 0.5, -v.T.wid / 2 - 0.5, v.T.len + 1, v.T.wid + 1, 0.9);
          c.stroke();
        }
        drawCar(c, v, time);
        if (v.crashed) {
          c.fillStyle = "rgba(20,20,20,.35)";
          rr(c, -v.T.len / 2, -v.T.wid / 2, v.T.len, v.T.wid, 0.6);
          c.fill();
        }
        c.restore();
      }
      drawFx(c, dt);
      // 화면 좌표 그리기 (아이콘 · 글자)
      c.setTransform(1, 0, 0, 1, sx, sy);
      const d = R.dpr;
      c.textAlign = "center";
      c.textBaseline = "middle";
      for (const v of sim.vehicles) {
        const X = v.x * R.k + R.ox;
        const Y = v.y * R.k + R.oy;
        if (v.crashed || v.broken) {
          const pulse = 1 + 0.08 * Math.sin(time * 8);
          c.fillStyle = v.towing ? "rgba(60,140,255,.95)" : v.crashed ? "rgba(255,60,50,.95)" : "rgba(255,180,30,.95)";
          c.beginPath();
          c.arc(X, Y - 16 * d, 11 * d * pulse, 0, 7);
          c.fill();
          c.fillStyle = "#fff";
          c.font = `900 ${Math.round(12 * d)}px 'Noto Sans KR', sans-serif`;
          c.fillText(v.towing ? "🛻" : v.crashed ? "💥" : "⚠", X, Y - 16 * d + 0.5);
          if (v.towing) {
            c.strokeStyle = "#fff";
            c.lineWidth = 2.5 * d;
            c.beginPath();
            c.arc(X, Y - 16 * d, 13 * d, -Math.PI / 2, -Math.PI / 2 + (v.towT / 2.5) * Math.PI * 2);
            c.stroke();
          }
        } else if (v.clearing && SI && v.segs[v.si].kind === "path") {
          const I = v.segs[v.si].inter;
          if (I.state === "G" && I.greenT < 3.5) {
            c.fillStyle = "rgba(255,150,30,.95)";
            c.font = `900 ${Math.round(14 * d)}px Outfit, sans-serif`;
            c.fillText("!", X, Y - 12 * d);
          }
        }
      }
      // 긴급 차량 접근 화살표
      for (const w of R.warnEntry) {
        if (w.until < time) continue;
        const L = net.linkById[w.entry];
        if (!L) continue;
        const sg = L.lanes[0];
        const p = TH.pointAt(sg, 10, [0, 0]);
        let X = p[0] * R.k + R.ox;
        let Y = p[1] * R.k + R.oy;
        X = Math.max(26 * d, Math.min(canvas.width - 26 * d, X));
        Y = Math.max(26 * d, Math.min(canvas.height - 26 * d, Y));
        const on = Math.floor(time * 4) % 2;
        c.fillStyle = on ? "rgba(255,50,50,.95)" : "rgba(60,100,255,.95)";
        c.beginPath();
        c.arc(X, Y, 18 * d, 0, 7);
        c.fill();
        c.font = `900 ${Math.round(17 * d)}px 'Noto Sans KR', sans-serif`;
        c.fillStyle = "#fff";
        c.fillText(w.icon || "🚨", X, Y + 1);
      }
      drawTextFx(c);
    };
    resize();
    return R;
  }

  window.THRender = { makeRenderer };
})();
