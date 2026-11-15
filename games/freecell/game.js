(() => {
  "use strict";

  const A = window.TodayAdult;
  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };

  const SUITS = ["♣", "♦", "♥", "♠"]; // MS 프리셀 순서 (C D H S)
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SAVE_KEY = "today-freecell-save";
  const STAT_KEY = "today-freecell-stats";

  const rankOf = (c) => Math.floor(c / 4); // 0 = A
  const suitOf = (c) => c % 4;
  const isRed = (c) => suitOf(c) === 1 || suitOf(c) === 2;

  /** 윈도우 프리셀과 똑같은 섞기 (게임 번호 → 배치) */
  function deal(num) {
    let seed = num >>> 0;
    const rand = () => {
      seed = (seed * 214013 + 2531011) & 0x7fffffff;
      return seed >> 16;
    };
    const cards = [];
    for (let i = 51; i >= 0; i -= 1) cards.push(i);
    for (let i = 0; i < 52; i += 1) {
      const j = 51 - (rand() % (52 - i));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const cols = [[], [], [], [], [], [], [], []];
    cards.forEach((c, i) => cols[i % 8].push(c));
    return cols;
  }

  /* ---------- 상태 ---------- */
  let st = null; // { num, cols, cells, found, moves, elapsed, done }
  let undoStack = [];
  let sel = null; // { from: "col"|"cell", idx, pos }
  let timer = 0;
  let lastTick = 0;

  function fresh(num) {
    return { num, cols: deal(num), cells: [null, null, null, null], found: [-1, -1, -1, -1], moves: 0, elapsed: 0, done: false };
  }

  function clone(s) {
    return { ...s, cols: s.cols.map((c) => c.slice()), cells: s.cells.slice(), found: s.found.slice() };
  }

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    document.body.classList.toggle("is-play", name === "play");
    window.scrollTo(0, 0);
    if (name === "play") requestAnimationFrame(layout);
  }

  function fmt(sec) {
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  }

  function fmtKo(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m ? `${m}분 ${s}초` : `${s}초`;
  }

  /* ---------- 규칙 ---------- */
  function canStack(card, onto) {
    return onto == null || (rankOf(onto) === rankOf(card) + 1 && isRed(onto) !== isRed(card));
  }

  function canFound(card) {
    return st.found[suitOf(card)] === rankOf(card) - 1;
  }

  /** 한 번에 옮길 수 있는 장수 (빈칸+1) × 2^(빈 줄) */
  function maxMove(toEmptyCol) {
    const freeCells = st.cells.filter((c) => c == null).length;
    let emptyCols = st.cols.filter((c) => c.length === 0).length;
    if (toEmptyCol) emptyCols -= 1;
    return (freeCells + 1) * 2 ** Math.max(0, emptyCols);
  }

  /** 줄 끝에서부터 이어진 묶음의 시작 위치 */
  function runStart(col) {
    let i = col.length - 1;
    while (i > 0 && canStack(col[i], col[i - 1])) i -= 1;
    return i;
  }

  function pickedCards(s) {
    if (s.from === "cell") return [st.cells[s.idx]];
    return st.cols[s.idx].slice(s.pos);
  }

  function removePicked(s) {
    if (s.from === "cell") st.cells[s.idx] = null;
    else st.cols[s.idx].length = s.pos;
  }

  /** 가능한 목적지 목록 [{ to: "found"|"col"|"cell", idx }] */
  function targets(s) {
    const cards = pickedCards(s);
    const top = cards[0];
    const out = [];
    if (cards.length === 1 && canFound(top)) out.push({ to: "found", idx: suitOf(top) });
    st.cols.forEach((col, i) => {
      if (s.from === "col" && s.idx === i) return;
      const last = col.length ? col[col.length - 1] : null;
      if (!canStack(top, last)) return;
      if (cards.length > maxMove(col.length === 0)) return;
      out.push({ to: "col", idx: i, empty: col.length === 0 });
    });
    if (cards.length === 1 && s.from !== "cell") {
      const free = st.cells.indexOf(null);
      if (free >= 0) out.push({ to: "cell", idx: free });
    }
    return out;
  }

  function doMove(s, t) {
    undoStack.push(clone(st));
    if (undoStack.length > 300) undoStack.shift();
    const cards = pickedCards(s);
    removePicked(s);
    if (t.to === "found") st.found[t.idx] = rankOf(cards[0]);
    else if (t.to === "cell") st.cells[t.idx] = cards[0];
    else st.cols[t.idx].push(...cards);
    st.moves += 1;
    sel = null;
    A.sfx("tap");
    autoFoundation();
    render();
    save();
    checkWin();
  }

  /** 안전한 카드는 자동으로 위로 */
  function autoFoundation() {
    let moved = true;
    while (moved) {
      moved = false;
      const safe = (c) => {
        if (!canFound(c)) return false;
        const r = rankOf(c);
        if (r <= 1) return true;
        const opp = isRed(c) ? [0, 3] : [1, 2];
        return opp.every((s) => st.found[s] >= r - 1);
      };
      for (let i = 0; i < 4; i += 1) {
        const c = st.cells[i];
        if (c != null && safe(c)) {
          st.found[suitOf(c)] = rankOf(c);
          st.cells[i] = null;
          moved = true;
        }
      }
      for (const col of st.cols) {
        const c = col[col.length - 1];
        if (c != null && safe(c)) {
          st.found[suitOf(c)] = rankOf(c);
          col.pop();
          moved = true;
        }
      }
    }
  }

  function smartMove(s) {
    const ts = targets(s);
    if (!ts.length) {
      A.sfx("bad");
      A.toast("갈 곳이 없어요");
      return false;
    }
    // 우선순위: 위로 → 카드 있는 줄 → 빈 줄 → 빈칸
    const pick =
      ts.find((t) => t.to === "found") ||
      ts.find((t) => t.to === "col" && !t.empty) ||
      ts.find((t) => t.to === "col" && t.empty) ||
      ts.find((t) => t.to === "cell");
    doMove(s, pick);
    return true;
  }

  function sameSel(a, b) {
    return a && b && a.from === b.from && a.idx === b.idx && (a.from === "cell" || a.pos === b.pos);
  }

  function onCard(from, idx, pos) {
    if (!st || st.done) return;
    // 이미 고른 상태에서 목적지를 누른 경우
    if (sel && !sameSel(sel, { from, idx, pos })) {
      const t = targets(sel).find((x) => (from === "col" ? x.to === "col" && x.idx === idx : false));
      if (t) {
        doMove(sel, t);
        return;
      }
    }
    if (sameSel(sel, { from, idx, pos })) {
      smartMove(sel);
      return;
    }
    if (from === "col") {
      const col = st.cols[idx];
      if (!col.length) return;
      if (pos < runStart(col)) pos = runStart(col);
    }
    sel = { from, idx, pos };
    render();
  }

  function onSlot(kind, idx) {
    if (!st || !sel) return;
    const t = targets(sel).find((x) => x.to === kind && (kind === "found" || x.idx === idx));
    if (t) doMove(sel, t);
    else {
      sel = null;
      render();
    }
  }

  function undo() {
    const prev = undoStack.pop();
    if (!prev) return;
    st = prev;
    sel = null;
    render();
    save();
  }

  /* ---------- 그리기 ---------- */
  const table = $("table");
  const cardEls = new Map();
  let geo = { w: 60, h: 84, gap: 6, top: 0 };

  function cardFace(c) {
    const r = RANKS[rankOf(c)];
    const s = SUITS[suitOf(c)];
    // J · Q · K 는 무늬 대신 그림 패처럼 액자 안 큰 글자
    const big = rankOf(c) >= 10 ? `<span class="fc-big fc-face">${r}</span>` : `<span class="fc-big">${s}</span>`;
    return `<span class="fc-corner">${r}<b>${s}</b></span>${big}`;
  }

  function ensureSlots() {
    if (table.querySelector(".fc-slot")) return;
    for (let i = 0; i < 4; i += 1) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "fc-slot fc-cell";
      el.dataset.kind = "cell";
      el.dataset.idx = i;
      el.setAttribute("aria-label", `빈칸 ${i + 1}`);
      el.addEventListener("click", () => onSlot("cell", i));
      table.appendChild(el);
    }
    for (let i = 0; i < 4; i += 1) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "fc-slot fc-found";
      el.dataset.kind = "found";
      el.dataset.idx = i;
      el.innerHTML = `<span>${SUITS[i]}</span>`;
      el.setAttribute("aria-label", `${SUITS[i]} 모으는 곳`);
      el.addEventListener("click", () => onSlot("found", i));
      table.appendChild(el);
    }
    for (let i = 0; i < 8; i += 1) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "fc-slot fc-colbase";
      el.dataset.kind = "col";
      el.dataset.idx = i;
      el.setAttribute("aria-label", `${i + 1}번째 줄`);
      el.addEventListener("click", () => {
        if (sel) {
          const t = targets(sel).find((x) => x.to === "col" && x.idx === i);
          if (t) doMove(sel, t);
          else {
            sel = null;
            render();
          }
        }
      });
      table.appendChild(el);
    }
    for (let c = 0; c < 52; c += 1) {
      const el = document.createElement("div");
      el.className = `fc-card${isRed(c) ? " red" : ""}`;
      el.innerHTML = cardFace(c);
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${SUITS[suitOf(c)]} ${RANKS[rankOf(c)]}`);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const loc = locate(c);
        if (!loc) return;
        if (loc.from === "found") return;
        onCard(loc.from, loc.idx, loc.pos);
      });
      el.addEventListener("dblclick", (e) => {
        e.preventDefault();
      });
      table.appendChild(el);
      cardEls.set(c, el);
    }
  }

  function locate(c) {
    for (let i = 0; i < 4; i += 1) if (st.cells[i] === c) return { from: "cell", idx: i };
    for (let i = 0; i < 8; i += 1) {
      const p = st.cols[i].indexOf(c);
      if (p >= 0) return { from: "col", idx: i, pos: p };
    }
    return { from: "found" };
  }

  function layout() {
    const W = table.clientWidth || 360;
    const gap = Math.max(3, Math.min(10, W * 0.012));
    const w = Math.min(96, (W - gap * 9) / 8);
    const h = w * 1.4;
    const avail = Math.max(window.innerHeight - table.getBoundingClientRect().top - 90, h * 3);
    geo = { w, h, gap, top: h + gap * 3, avail };
    table.style.setProperty("--cw", `${w}px`);
    table.style.setProperty("--ch", `${h}px`);
    render();
  }

  function xOf(i) {
    return geo.gap + i * (geo.w + geo.gap);
  }

  function render() {
    if (!st) return;
    ensureSlots();
    const { w, h, top } = geo;
    // 슬롯 위치
    table.querySelectorAll(".fc-slot").forEach((el) => {
      const i = Number(el.dataset.idx);
      const kind = el.dataset.kind;
      const x = kind === "found" ? xOf(i + 4) : xOf(i);
      const y = kind === "col" ? top : 0;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.classList.remove("target");
    });

    const longest = Math.max(...st.cols.map((c) => c.length), 1);
    const fan = Math.max(Math.min(h * 0.4, (geo.avail - h) / Math.max(1, longest - 1)), w * 0.36);
    table.style.height = `${top + h + fan * (longest - 1) + 8}px`;

    cardEls.forEach((el) => el.classList.remove("target-card"));
    const selected = new Set(sel ? pickedCards(sel) : []);
    // 위로 올라간 카드는 각 무늬 칸에 쌓아서 보여 줌
    for (let s = 0; s < 4; s += 1) {
      for (let r = 0; r <= 12; r += 1) {
        const el = cardEls.get(r * 4 + s);
        if (r <= st.found[s]) {
          el.style.transform = `translate(${xOf(s + 4)}px, 0px)`;
          el.style.zIndex = 100 + r;
          el.classList.remove("sel", "hide");
          el.classList.toggle("buried", r < st.found[s]);
        }
      }
    }
    st.cells.forEach((c, i) => {
      if (c == null) return;
      const el = cardEls.get(c);
      el.style.transform = `translate(${xOf(i)}px, 0px)`;
      el.style.zIndex = 200;
      el.classList.toggle("sel", selected.has(c));
      el.classList.remove("buried");
    });
    st.cols.forEach((col, i) => {
      col.forEach((c, p) => {
        const el = cardEls.get(c);
        el.style.transform = `translate(${xOf(i)}px, ${top + p * fan}px)`;
        el.style.zIndex = 300 + p;
        el.classList.toggle("sel", selected.has(c));
        el.classList.remove("buried");
      });
    });

    if (sel) {
      targets(sel).forEach((t) => {
        const el = table.querySelector(`.fc-slot[data-kind="${t.to}"][data-idx="${t.idx}"]`);
        if (el) el.classList.add("target");
        if (t.to === "col" && !t.empty) {
          const col = st.cols[t.idx];
          const last = cardEls.get(col[col.length - 1]);
          if (last) last.classList.add("target-card");
        }
      });
    }
    $("fc-deal").textContent = `#${st.num}`;
    $("fc-moves").textContent = `${st.moves}수`;
    $("fc-time").textContent = fmt(st.elapsed);
    $("undo-btn").disabled = undoStack.length === 0;
  }

  /* ---------- 진행 ---------- */
  function save() {
    if (st && !st.done) A.save(SAVE_KEY, st);
  }

  function tick() {
    if (!st || st.done) return;
    const now = performance.now();
    if (!document.hidden) st.elapsed += (now - lastTick) / 1000;
    lastTick = now;
    $("fc-time").textContent = fmt(st.elapsed);
  }

  function begin(next) {
    st = next;
    undoStack = [];
    sel = null;
    autoFoundation();
    show("play");
    lastTick = performance.now();
    clearInterval(timer);
    timer = setInterval(tick, 500);
    const stats = A.store(STAT_KEY, { played: 0, won: 0, best: null });
    if (next.moves === 0 && next.elapsed === 0) {
      stats.played += 1;
      A.save(STAT_KEY, stats);
    }
    checkWin();
  }

  function checkWin() {
    if (!st.found.every((r) => r === 12)) return;
    st.done = true;
    clearInterval(timer);
    A.save(SAVE_KEY, null);
    A.sfx("win");
    const sec = Math.round(st.elapsed);
    const stats = A.store(STAT_KEY, { played: 0, won: 0, best: null });
    stats.won += 1;
    const isBest = !stats.best || sec < stats.best;
    if (isBest) stats.best = sec;
    A.save(STAT_KEY, stats);
    $("done-time").textContent = fmtKo(sec);
    $("done-line").textContent = `게임 #${st.num} · ${st.moves}수${isBest ? " · 🏅 최고 기록!" : ""}`;
    setTimeout(() => {
      show("over");
      if (window.TodayDuel) {
        TodayDuel.report(sec, {
          label: `${fmtKo(sec)} (${st.moves}수)`,
          lowerIsBetter: true,
          parent: $("duel-slot"),
          extra: { deal: st.num },
          subject: `프리셀 #${st.num}`,
        });
      }
    }, 700);
  }

  function dailyNum() {
    const d = A.seoulDay().replace(/-/g, "");
    let h = 0;
    for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) % 32000;
    return h + 1;
  }

  function paintTitle() {
    const stats = A.store(STAT_KEY, { played: 0, won: 0, best: null });
    $("stat-line").textContent = stats.played
      ? `${stats.played}판 중 ${stats.won}판 클리어${stats.best ? ` · 최고 ${fmtKo(stats.best)}` : ""}`
      : "";
    const saved = A.store(SAVE_KEY, null);
    $("resume-btn").classList.toggle("hidden", !saved);
    if (saved) $("resume-btn").textContent = `이어서 하기 (#${saved.num} · ${saved.moves}수)`;
  }

  $("daily-btn").addEventListener("click", () => begin(fresh(dailyNum())));
  $("random-btn").addEventListener("click", () => begin(fresh(1 + Math.floor(Math.random() * 32000))));
  $("deal-btn").addEventListener("click", () => {
    const n = Math.floor(Number($("deal-input").value));
    if (!(n >= 1 && n <= 32000)) {
      A.toast("1 ~ 32000 사이 번호를 적어 주세요");
      return;
    }
    begin(fresh(n));
  });
  $("resume-btn").addEventListener("click", () => {
    const saved = A.store(SAVE_KEY, null);
    if (saved) begin(saved);
  });
  $("next-btn").addEventListener("click", () => begin(fresh(1 + Math.floor(Math.random() * 32000))));
  $("home-btn").addEventListener("click", () => {
    show("title");
    paintTitle();
  });
  $("undo-btn").addEventListener("click", undo);
  $("restart-btn").addEventListener("click", () => {
    if (!st) return;
    const keep = st.elapsed;
    begin({ ...fresh(st.num), elapsed: keep });
  });
  $("quit-btn").addEventListener("click", () => {
    save();
    clearInterval(timer);
    show("title");
    paintTitle();
  });
  table.addEventListener("click", (e) => {
    if (e.target === table && sel) {
      sel = null;
      render();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (screens.play.classList.contains("hidden")) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      undo();
    }
    if (e.key === "Escape" && sel) {
      sel = null;
      render();
    }
  });
  window.addEventListener("resize", () => {
    if (!screens.play.classList.contains("hidden")) layout();
  });

  window.TodayFreecell = { deal }; // 테스트용

  const params = new URLSearchParams(location.search);
  const shared = Math.floor(Number(params.get("deal")));
  paintTitle();
  if (shared >= 1 && shared <= 32000) {
    const go = document.createElement("button");
    go.type = "button";
    go.className = "ad-btn";
    go.textContent = `⚔️ 친구와 같은 판으로 대결 (#${shared})`;
    go.addEventListener("click", () => begin(fresh(shared)));
    $("title").insertBefore(go, $("daily-btn").parentNode);
  }
})();
