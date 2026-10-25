/* 모니터실 · 운영자 전용 대시보드 (데이터는 /api/monitor 에서 · 비밀번호로 받은 열쇠로만) */
(() => {
  "use strict";

  const API = "/api/monitor";
  const TOKEN_KEY = "today-monitor-token";
  const FETCH_DAYS = 90;
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  let token = readToken();
  let data = null;
  let days = 30;
  let topMode = "today";
  let sort = { key: "today", dir: -1 };
  let search = "";
  let busy = false;

  /* ---------------- 저장 (이 기기에만 · 실패해도 동작) ---------------- */
  function readToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }
  function saveToken(t) {
    token = t || "";
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (_) {
      /* 이번 방문 동안만 기억 */
    }
  }

  /* ---------------- 숫자 · 날짜 ---------------- */
  const num = (n) => (n == null ? "–" : Math.round(n).toLocaleString("ko-KR"));
  function compact(n) {
    if (n >= 10000) return `${+(n / 10000).toFixed(1)}만`;
    if (n >= 1000) return `${+(n / 1000).toFixed(1)}천`;
    return String(n);
  }
  function dayParts(day) {
    const [y, m, d] = day.split("-").map(Number);
    return { y, m, d, w: WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
  }
  const shortDay = (day) => {
    const p = dayParts(day);
    return `${p.m}/${p.d}`;
  };
  const longDay = (day) => {
    const p = dayParts(day);
    return `${p.m}월 ${p.d}일 (${p.w})`;
  };
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

  /* ---------------- 서버 ---------------- */
  async function call(method, body) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(method === "GET" ? `${API}?days=${FETCH_DAYS}` : API, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    let json = {};
    try {
      json = await res.json();
    } catch (_) {
      json = {};
    }
    return { status: res.status, json };
  }

  /* ---------------- 잠금 화면 ---------------- */
  function showLogin(msg = "") {
    $("app").hidden = true;
    $("login").hidden = false;
    $("login-msg").textContent = msg;
    $("pin").value = "";
    setTimeout(() => $("pin").focus(), 30);
  }
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = $("pin").value.trim();
    if (!pin) return;
    $("login-btn").disabled = true;
    $("login-msg").textContent = "확인하는 중…";
    try {
      const { status, json } = await call("POST", { action: "login", pin });
      if (status === 200 && json.token) {
        saveToken(json.token);
        $("login-msg").textContent = "";
        showApp();
        await load();
      } else if (status === 401) {
        $("login-msg").textContent = json.left > 0 ? `비밀번호가 달라요. ${json.left}번 더 틀리면 15분 동안 잠겨요.` : "비밀번호가 달라요. 15분 동안 잠겼어요.";
      } else if (status === 429) {
        $("login-msg").textContent = `너무 많이 틀려서 잠겼어요. ${json.retryMinutes || 15}분 뒤에 다시 해 주세요.`;
      } else if (json.error === "key-not-configured") {
        $("login-msg").textContent = "아직 서버에 모니터실 비밀번호가 설정되지 않았어요.";
      } else if (json.error === "store-not-configured") {
        $("login-msg").textContent = "데이터 저장소가 연결되어 있지 않아요.";
      } else {
        $("login-msg").textContent = "지금은 들어갈 수 없어요. 잠시 뒤에 다시 해 주세요.";
      }
    } catch (_) {
      $("login-msg").textContent = "연결이 안 돼요. 인터넷을 확인해 주세요.";
    }
    $("login-btn").disabled = false;
  });

  /* ---------------- 대시보드 ---------------- */
  function showApp() {
    $("login").hidden = true;
    $("app").hidden = false;
  }
  async function load() {
    if (busy) return;
    busy = true;
    for (const id of ["tiles", "chart-visit", "chart-play", "chart-top", "games-table"]) $(id).classList.add("loading");
    $("updated").textContent = data ? "새로 불러오는 중…" : "불러오는 중…";
    try {
      const { status, json } = await call("GET");
      if (status === 401) {
        saveToken("");
        showLogin("다시 들어와 주세요.");
        return;
      }
      if (status !== 200 || !json.ok) {
        $("updated").textContent = "데이터를 불러오지 못했어요. 새로고침을 눌러 주세요.";
        return;
      }
      data = json;
      render();
      const t = new Date(json.generatedAt);
      $("updated").textContent = `마지막 업데이트 ${t.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · 오늘 ${longDay(json.today)}`;
    } catch (_) {
      $("updated").textContent = "연결이 안 돼요. 잠시 뒤 새로고침을 눌러 주세요.";
    } finally {
      busy = false;
      for (const id of ["tiles", "chart-visit", "chart-play", "chart-top", "games-table"]) $(id).classList.remove("loading");
    }
  }

  function view() {
    const all = data.days;
    const range = all.slice(-days);
    const today = all[all.length - 1];
    const yesterday = all[all.length - 2] || null;
    const firstTracked = all.find((r) => r.tracked);
    return { all, range, today, yesterday, since: firstTracked ? firstTracked.day : data.today };
  }

  function render() {
    if (!data) return;
    const v = view();
    $("range-note").textContent = `방문자는 ${shortDayFull(data.visitsSince)}부터 · 게임별 날짜 기록은 ${shortDayFull(v.since)}부터`;
    renderTiles(v);
    columns($("chart-visit"), v.range.map((r) => ({ day: r.day, v: r.visitors })), { color: "var(--visit)", name: "방문자" });
    columns($("chart-play"), v.range.map((r) => ({ day: r.day, v: r.tracked ? sum(r.plays) : null })), { color: "var(--play)", name: "게임 참여", gapText: "기록 시작 전" });
    $("play-sub").textContent = `게임 페이지를 연 수 (같은 창에서는 한 번) · ${shortDayFull(v.since)}부터 기록`;
    renderTop(v);
    renderGames(v);
    renderDayTables(v);
  }
  const shortDayFull = (day) => {
    const p = dayParts(day);
    return `${p.y}년 ${p.m}월 ${p.d}일`;
  };

  function tile(label, value, { hero = false, key = "", delta = null, note = "" } = {}) {
    const el = document.createElement("div");
    el.className = "tile" + (hero ? " hero" : "");
    const l = document.createElement("span");
    l.className = "label";
    if (key) {
      const k = document.createElement("i");
      k.className = "key";
      k.style.background = key;
      l.appendChild(k);
    }
    l.appendChild(document.createTextNode(label));
    const val = document.createElement("span");
    val.className = "value";
    val.textContent = value;
    el.append(l, val);
    if (delta != null || note) {
      const d = document.createElement("span");
      d.className = "delta";
      if (delta != null) {
        d.classList.add(delta > 0 ? "up" : delta < 0 ? "down" : "same");
        d.textContent = `${delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}어제보다 ${delta > 0 ? "+" : ""}${num(delta)}${note ? " · " + note : ""}`;
      } else d.textContent = note;
      el.appendChild(d);
    }
    return el;
  }
  function renderTiles(v) {
    const box = $("tiles");
    box.textContent = "";
    const tv = v.today.visitors;
    const yv = v.yesterday ? v.yesterday.visitors : null;
    box.appendChild(tile("오늘 방문자", num(tv), { hero: true, key: "var(--visit)", delta: tv != null && yv != null ? tv - yv : null, note: yv != null ? `어제 ${num(yv)}명` : "" }));
    const rv = v.range.map((r) => r.visitors).filter((x) => x != null);
    const rs = rv.reduce((a, b) => a + b, 0);
    box.appendChild(tile(`${days}일 방문자 합`, num(rs), { key: "var(--visit)", note: rv.length ? `하루 평균 ${num(rs / rv.length)}명` : "" }));
    box.appendChild(tile("누적 방문", num(data.visitTotal), { note: "사이트 처음부터" }));
    const tp = sum(v.today.plays);
    const yp = v.yesterday && v.yesterday.tracked ? sum(v.yesterday.plays) : null;
    box.appendChild(tile("오늘 게임 참여", num(tp), { key: "var(--play)", delta: yp != null ? tp - yp : null, note: yp == null ? `누적 ${num(sum(data.playsTotal))}` : "" }));
    box.appendChild(tile("오늘 랭킹 등록", num(sum(v.today.ranks)), { key: "var(--rank)", note: `${days}일 ${num(v.range.reduce((a, r) => a + sum(r.ranks), 0))}번` }));
  }

  /* ---------------- 세로 막대 (일별) ---------------- */
  function niceStep(max, count = 4) {
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }
  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }
  function columns(box, rows, { color, name, gapText = "" }) {
    box.textContent = "";
    const W = Math.max(280, box.clientWidth || 600);
    const H = 230;
    const pad = { l: 40, r: 8, t: 22, b: 26 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;
    const vals = rows.map((r) => r.v).filter((v) => v != null);
    const max = Math.max(1, ...vals);
    const step = niceStep(max);
    const top = Math.max(step, Math.ceil(max / step) * step);
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${name} ${rows.length}일 막대 그래프` }, box);
    const y = (v) => pad.t + ph - (v / top) * ph;
    for (let t = 0; t <= top + 1e-9; t += step) {
      svgEl("line", { x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), class: t === 0 ? "base-line" : "grid-line" }, svg);
      const tx = svgEl("text", { x: pad.l - 6, y: y(t) + 4, "text-anchor": "end", class: "axis-text" }, svg);
      tx.textContent = compact(t);
    }
    const band = pw / rows.length;
    const bw = Math.max(2, Math.min(24, band - 2));
    const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(pw / 46))));
    // 기록 시작 전 구간
    const firstVal = rows.findIndex((r) => r.v != null);
    if (gapText && firstVal > 0 && firstVal * band > 90) {
      const g = svgEl("text", { x: pad.l + (firstVal * band) / 2, y: pad.t + ph / 2, "text-anchor": "middle", class: "gap-text" }, svg);
      g.textContent = gapText;
    }
    rows.forEach((r, i) => {
      const cx = pad.l + band * i + band / 2;
      if ((rows.length - 1 - i) % every === 0) {
        const tx = svgEl("text", { x: cx, y: H - 8, "text-anchor": "middle", class: "axis-text" }, svg);
        tx.textContent = shortDay(r.day);
      }
      if (r.v == null) return;
      const hit = svgEl("rect", { x: pad.l + band * i, y: pad.t, width: band, height: ph, class: "bar-hit" }, svg);
      const h = (r.v / top) * ph;
      if (h > 0) {
        const x0 = cx - bw / 2;
        const y0 = pad.t + ph - h;
        const rad = Math.min(4, h, bw / 2);
        const d = `M${x0},${pad.t + ph} V${y0 + rad} Q${x0},${y0} ${x0 + rad},${y0} H${x0 + bw - rad} Q${x0 + bw},${y0} ${x0 + bw},${y0 + rad} V${pad.t + ph} Z`;
        svgEl("path", { d, fill: color, class: "bar" }, svg);
      }
      hit.addEventListener("pointerenter", (e) => showTip(e, r.v, name, color, longDay(r.day)));
      hit.addEventListener("pointermove", (e) => moveTip(e));
      hit.addEventListener("pointerleave", hideTip);
    });
    // 오늘 값은 그래프 오른쪽 위에 직접 (나머지는 축 · 툴팁 · 표)
    const last = rows[rows.length - 1];
    if (last && last.v != null) {
      const lab = svgEl("text", { x: W - pad.r, y: 12, "text-anchor": "end", class: "end-label" }, svg);
      lab.textContent = `오늘 ${num(last.v)} →`;
    }
  }

  /* ---------------- 툴팁 ---------------- */
  function showTip(e, value, name, color, label) {
    const tip = $("tip");
    tip.textContent = "";
    const v = document.createElement("span");
    v.className = "tv";
    v.textContent = num(value);
    const l = document.createElement("span");
    l.className = "tl";
    const key = document.createElement("i");
    key.style.background = color;
    l.append(key, document.createTextNode(`${name} · ${label}`));
    tip.append(v, l);
    tip.hidden = false;
    moveTip(e);
  }
  function moveTip(e) {
    const tip = $("tip");
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = e.clientX + 14;
    let y = e.clientY - h - 12;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y < 8) y = e.clientY + 16;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${y}px`;
  }
  function hideTip() {
    $("tip").hidden = true;
  }

  /* ---------------- 많이 한 게임 (가로 막대) ---------------- */
  function playsBy(mode, v) {
    if (mode === "today") return v.today.plays;
    if (mode === "yesterday") return v.yesterday ? v.yesterday.plays : {};
    if (mode === "all") return data.playsTotal;
    const o = {};
    for (const r of v.range) for (const [g, n] of Object.entries(r.plays)) o[g] = (o[g] || 0) + n;
    return o;
  }
  const title = (id) => (data.titles && data.titles[id]) || id;
  function renderTop(v) {
    const box = $("chart-top");
    box.textContent = "";
    const src = playsBy(topMode, v);
    const list = Object.entries(src)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const label = { today: "오늘", yesterday: "어제", range: `최근 ${days}일 (기록된 날만)`, all: "사이트 처음부터 누적" }[topMode];
    $("top-sub").textContent = `${label} · 게임 페이지를 연 수 · 상위 10개`;
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = topMode === "yesterday" && !(v.yesterday && v.yesterday.tracked) ? "어제는 아직 기록하기 전이에요." : "아직 기록이 없어요.";
      box.appendChild(p);
      return;
    }
    const max = list[0][1];
    for (const [g, n] of list) {
      const row = document.createElement("div");
      row.className = "hrow";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = title(g);
      name.title = title(g);
      const W = 400;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} 22`, preserveAspectRatio: "none", role: "img", "aria-label": `${title(g)} ${num(n)}` });
      const labelW = 64;
      const bw = Math.max(2, ((W - labelW) * n) / max);
      const rad = Math.min(4, bw);
      svgEl("path", { d: `M0,3 H${bw - rad} Q${bw},3 ${bw},${3 + rad} V${19 - rad} Q${bw},19 ${bw - rad},19 H0 Z`, fill: "var(--visit)" }, svg);
      row.append(name, wrapBar(svg, n, bw / W));
      box.appendChild(row);
    }
  }
  /** 막대 끝 숫자는 SVG 가 늘어나도 글자가 안 찌그러지게 HTML 로 */
  function wrapBar(svg, n, frac) {
    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.style.height = "22px";
    svg.style.height = "22px";
    svg.style.width = "100%";
    const t = document.createElement("span");
    t.textContent = num(n);
    t.style.cssText = `position:absolute;top:2px;left:calc(${(frac * 100).toFixed(2)}% + 6px);font-size:13px;color:var(--ink2);font-variant-numeric:tabular-nums;white-space:nowrap`;
    wrap.append(svg, t);
    return wrap;
  }

  /* ---------------- 게임별 표 ---------------- */
  function gameRows(v) {
    const ids = new Set([...Object.keys(data.titles || {}), ...Object.keys(data.playsTotal || {})]);
    for (const r of data.days) for (const g of Object.keys(r.plays)) ids.add(g);
    const last14 = data.days.slice(-14);
    return [...ids].map((id) => {
      const range = v.range.reduce((a, r) => a + (r.plays[id] || 0), 0);
      const ranks = v.range.reduce((a, r) => a + (r.ranks[id] || 0), 0);
      return {
        id,
        name: title(id),
        today: v.today.plays[id] || 0,
        yesterday: v.yesterday ? v.yesterday.plays[id] || 0 : 0,
        range,
        all: (data.playsTotal || {})[id] || 0,
        ranks,
        spark: last14.map((r) => (r.tracked ? r.plays[id] || 0 : null)),
      };
    });
  }
  function renderGames(v) {
    const box = $("games-table");
    box.textContent = "";
    const q = search.trim().toLowerCase();
    let rows = gameRows(v).filter((r) => !q || r.name.toLowerCase().includes(q) || r.id.includes(q));
    rows.sort((a, b) => {
      const k = sort.key;
      if (k === "name") return a.name.localeCompare(b.name, "ko") * sort.dir;
      return (a[k] - b[k]) * sort.dir || b.all - a.all || a.name.localeCompare(b.name, "ko");
    });
    const table = document.createElement("table");
    const cap = document.createElement("caption");
    cap.textContent = "게임별 참여 수";
    cap.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
    table.appendChild(cap);
    const head = document.createElement("tr");
    const cols = [
      ["name", "게임"],
      ["today", "오늘"],
      ["yesterday", "어제"],
      ["range", `${days}일`],
      ["all", "누적"],
      ["spark", "최근 14일"],
      ["ranks", `랭킹 ${days}일`],
    ];
    for (const [k, label] of cols) {
      const th = document.createElement("th");
      th.scope = "col";
      if (k === "spark") th.textContent = label;
      else {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        if (sort.key === k) {
          b.setAttribute("aria-sort", sort.dir > 0 ? "ascending" : "descending");
          th.setAttribute("aria-sort", sort.dir > 0 ? "ascending" : "descending");
        }
        b.addEventListener("click", () => {
          sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === "name" ? 1 : -1 };
          renderGames(view());
        });
        th.appendChild(b);
      }
      head.appendChild(th);
    }
    const thead = document.createElement("thead");
    thead.appendChild(head);
    const tbody = document.createElement("tbody");
    for (const r of rows) {
      const tr = document.createElement("tr");
      if (!r.all && !r.range) tr.className = "zero";
      const td = document.createElement("td");
      td.className = "game";
      const a = document.createElement("a");
      a.href = `/games/${encodeURIComponent(r.id)}/`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = r.name;
      a.title = r.id;
      td.appendChild(a);
      tr.appendChild(td);
      for (const k of ["today", "yesterday", "range", "all"]) {
        const c = document.createElement("td");
        c.textContent = num(r[k]);
        tr.appendChild(c);
      }
      const sp = document.createElement("td");
      sp.className = "spark";
      sp.appendChild(spark(r.spark));
      tr.appendChild(sp);
      const rk = document.createElement("td");
      rk.textContent = num(r.ranks);
      tr.appendChild(rk);
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    box.appendChild(table);
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "찾는 게임이 없어요.";
      box.appendChild(p);
    }
  }
  function spark(values) {
    const W = 100;
    const H = 24;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" });
    const pts = values.map((v, i) => (v == null ? null : [2 + (i * (W - 6)) / Math.max(1, values.length - 1), v]));
    const real = pts.filter(Boolean);
    if (!real.length) return svg;
    const max = Math.max(1, ...real.map((p) => p[1]));
    const yy = (v) => H - 4 - ((H - 8) * v) / max;
    svgEl("line", { x1: 0, x2: W, y1: H - 4, y2: H - 4, class: "grid-line" }, svg);
    if (real.length > 1) svgEl("polyline", { points: real.map(([x, v]) => `${x},${yy(v)}`).join(" "), fill: "none", stroke: "var(--play)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    const [lx, lv] = real[real.length - 1];
    svgEl("circle", { cx: lx, cy: yy(lv), r: 4, fill: "var(--surface)" }, svg);
    svgEl("circle", { cx: lx, cy: yy(lv), r: 3, fill: "var(--play)" }, svg);
    return svg;
  }

  /* ---------------- 날짜별 표 (그래프의 표 보기) ---------------- */
  function renderDayTables(v) {
    for (const id of ["table-visit", "table-play"]) {
      const box = $(id);
      box.textContent = "";
      const table = document.createElement("table");
      const head = document.createElement("tr");
      for (const h of ["날짜", "방문자", "게임 참여", "랭킹 등록"]) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = h;
        head.appendChild(th);
      }
      const thead = document.createElement("thead");
      thead.appendChild(head);
      const tbody = document.createElement("tbody");
      for (const r of [...v.range].reverse()) {
        const tr = document.createElement("tr");
        for (const val of [longDay(r.day), num(r.visitors), r.tracked ? num(sum(r.plays)) : "기록 전", r.tracked ? num(sum(r.ranks)) : "기록 전"]) {
          const td = document.createElement("td");
          td.textContent = val;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.append(thead, tbody);
      box.appendChild(table);
    }
  }

  /* ---------------- 조작 ---------------- */
  function bindSeg(id, attr, onPick) {
    const seg = $(id);
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      for (const x of seg.querySelectorAll("button")) x.setAttribute("aria-checked", String(x === b));
      onPick(b.dataset[attr]);
    });
  }
  bindSeg("range", "days", (d) => {
    days = Number(d) || 30;
    render();
  });
  bindSeg("top-range", "top", (m) => {
    topMode = m;
    if (data) renderTop(view());
  });
  for (const b of document.querySelectorAll("[data-table]")) {
    b.addEventListener("click", () => {
      const t = $(`table-${b.dataset.table}`);
      const c = $(`chart-${b.dataset.table}`);
      const show = t.hidden;
      t.hidden = !show;
      c.hidden = show;
      b.textContent = show ? "그래프로 보기" : "표로 보기";
    });
  }
  $("game-search").addEventListener("input", (e) => {
    search = e.target.value;
    if (data) renderGames(view());
  });
  $("refresh-btn").addEventListener("click", () => load());
  $("logout-btn").addEventListener("click", async () => {
    try {
      await call("POST", { action: "logout" });
    } catch (_) {}
    saveToken("");
    data = null;
    showLogin("나갔어요.");
  });
  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(render, 150);
  });
  // 5분마다 저절로 (화면을 보고 있을 때만)
  setInterval(() => {
    if (data && !document.hidden && !$("app").hidden) load();
  }, 5 * 60 * 1000);

  /* ---------------- 시작 ---------------- */
  if (token) {
    showApp();
    load();
  } else showLogin();
  window.__monitor = { get data() { return data; }, render, load };
})();
