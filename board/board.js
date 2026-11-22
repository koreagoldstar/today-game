/* 게임 요청함 — 글 쓰기 · 나도 원해요 · 신고 · (모니터실 로그인한 기기면) 운영자 관리 */
(() => {
  "use strict";
  const API = "/api/board";
  const COLORS = ["빨간", "주황", "노란", "초록", "파란", "보라", "분홍", "하늘색", "하얀", "까만"];
  const ANIMALS = ["공룡", "펭귄", "토끼", "고양이", "강아지", "병아리", "판다", "여우", "곰", "다람쥐", "고래", "부엉이"];
  const KIND_LABEL = { new: "🎮 새 게임", fix: "🔧 고쳐 주세요", talk: "💬 칭찬 · 수다" };
  const STATUS_LABEL = { review: "검토 중", making: "만드는 중", done: "완성!" };
  const $ = (id) => document.getElementById(id);

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (_) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    },
  };
  const rand = (n) => Math.floor(Math.random() * n);
  const newName = () => `${COLORS[rand(COLORS.length)]} ${ANIMALS[rand(ANIMALS.length)]} #${String(rand(10000)).padStart(4, "0")}`;
  let device = store.get("today-board-device", "");
  if (!/^[a-f0-9]{32}$/.test(device)) {
    const a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = rand(256)));
    device = [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
    store.set("today-board-device", device);
  }
  let myName = store.get("today-board-name", "");
  if (!myName) store.set("today-board-name", (myName = newName()));
  const voted = new Set(store.get("today-board-voted", []));
  let adminToken = "";
  try {
    adminToken = localStorage.getItem("today-monitor-token") || "";
  } catch (_) {}

  const params = new URLSearchParams(location.search);
  const fromGame = /^[a-z0-9-]{2,40}$/.test(params.get("game") || "") ? params.get("game") : "";

  let tab = "top";
  let posts = [];
  let isAdmin = false;
  let kind = "new";

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return "방금";
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}일 전`;
    const d = new Date(ts);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  async function call(body) {
    const headers = { "Content-Type": "application/json" };
    if (adminToken && body.action === "admin") headers.Authorization = `Bearer ${adminToken}`;
    const res = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "잠시 뒤에 다시 해 주세요");
    return json;
  }

  /* ---------- 목록 ---------- */
  async function load() {
    const sort = tab === "new" || tab === "kind-talk" ? "new" : "top";
    const headers = adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
    try {
      const res = await fetch(`${API}?sort=${sort}${adminToken ? "&all=1" : ""}`, { headers, cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      posts = json.posts || [];
      isAdmin = !!json.admin;
      $("admin-note").hidden = !isAdmin;
    } catch (_) {
      posts = null;
    }
    render();
  }

  function visible() {
    if (!posts) return [];
    if (tab.startsWith("kind-")) return posts.filter((p) => p.kind === tab.slice(5));
    if (tab === "done") return posts.filter((p) => p.status === "done");
    return posts;
  }

  function render() {
    const list = $("list");
    list.textContent = "";
    if (!posts) {
      list.append(el("p", "bd-empty", "목록을 못 불러왔어요. 잠시 뒤에 다시 열어 주세요."));
      return;
    }
    const rows = visible();
    if (!rows.length) {
      list.append(el("p", "bd-empty", tab === "done" ? "아직 완성된 요청이 없어요. 곧 만들어 올게요!" : "아직 글이 없어요. 첫 요청을 남겨 주세요!"));
      return;
    }
    for (const p of rows) list.append(card(p));
  }

  function card(p) {
    const c = el("article", "bd-card" + (p.hidden ? " is-hidden" : ""));
    const heart = el("button", "bd-heart" + (voted.has(p.id) ? " on" : ""));
    heart.type = "button";
    heart.setAttribute("aria-label", `나도 원해요 ${p.votes}명`);
    heart.append(el("i", null, "❤️"), el("b", null, String(p.votes)), el("small", null, "나도!"));
    heart.addEventListener("click", () => vote(p, heart));
    if (p.kind === "talk") heart.querySelector("small").textContent = "좋아요";

    const m = el("div", "bd-main");
    const tags = el("div", "bd-tags");
    if (p.kind !== "talk") tags.append(el("span", `bd-badge st-${p.status}`, STATUS_LABEL[p.status] || "검토 중"));
    tags.append(el("span", "bd-badge kind", KIND_LABEL[p.kind] || ""));
    if (p.hidden) tags.append(el("span", "bd-badge", "숨김"));
    m.append(tags, el("h2", "bd-title", p.title));
    if (p.body) m.append(el("p", "bd-body", p.body));
    if (p.reply) {
      const r = el("div", "bd-reply");
      r.append(el("b", null, "⭐ 오늘의 게임 답글"), document.createTextNode(p.reply));
      m.append(r);
    }
    if (p.status === "done" && p.link) {
      const a = el("a", "bd-play", "🎉 완성! 바로 하기");
      a.href = p.link;
      m.append(a);
    }
    const meta = el("p", "bd-meta");
    meta.append(el("span", null, p.name), el("span", null, "·"), el("span", null, ago(p.ts)));
    if (p.game) {
      const g = el("a", "bd-link", "게임 보기");
      g.href = `/games/${p.game}/`;
      meta.append(el("span", null, "·"), g);
    }
    const rep = el("button", "bd-link", "신고");
    rep.type = "button";
    rep.style.marginLeft = "auto";
    rep.addEventListener("click", () => report(p));
    meta.append(rep);
    m.append(meta);
    if (isAdmin) m.append(adminBox(p));
    c.append(heart, m);
    return c;
  }

  async function vote(p, btn) {
    if (voted.has(p.id)) return toast("이미 하트를 눌렀어요");
    voted.add(p.id);
    store.set("today-board-voted", [...voted].slice(-500));
    p.votes += 1;
    btn.classList.add("on", "pop");
    btn.querySelector("b").textContent = String(p.votes);
    try {
      const r = await call({ action: "vote", id: p.id, device });
      if (r.already) toast("이미 하트를 눌렀어요");
    } catch (e) {
      toast(e.message);
    }
  }

  async function report(p) {
    if (!confirmReport(p)) return;
    try {
      await call({ action: "report", id: p.id, device });
      toast("신고했어요. 운영자가 살펴볼게요");
    } catch (e) {
      toast(e.message);
    }
  }
  function confirmReport() {
    return window.confirm("이 글을 신고할까요? 나쁜 말이나 개인정보가 있는 글을 알려 주세요.");
  }

  /* ---------- 운영자 ---------- */
  function adminBox(p) {
    const box = el("div", "bd-admin");
    const sel = document.createElement("select");
    for (const [v, t] of Object.entries(STATUS_LABEL)) {
      const o = el("option", null, t);
      o.value = v;
      o.selected = p.status === v;
      sel.append(o);
    }
    const link = document.createElement("input");
    link.placeholder = "완성 게임 주소 /games/폴더이름/";
    link.value = p.link || "";
    const reply = document.createElement("textarea");
    reply.rows = 2;
    reply.placeholder = "운영자 답글";
    reply.value = p.reply || "";
    const row = el("div", "row");
    const btn = (t, fn) => {
      const b = el("button", null, t);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    const act = async (body, msg) => {
      try {
        await call({ action: "admin", id: p.id, ...body });
        toast(msg);
        load();
      } catch (e) {
        toast(e.message);
      }
    };
    row.append(
      btn("상태 저장", () => act({ op: "status", value: sel.value, link: link.value.trim() }, "상태를 바꿨어요")),
      btn("답글 저장", () => act({ op: "reply", value: reply.value }, "답글을 저장했어요")),
      p.hidden ? btn("보이기", () => act({ op: "show" }, "다시 보이게 했어요")) : btn("숨기기", () => act({ op: "hide" }, "숨겼어요")),
      btn("지우기", () => window.confirm("이 글을 완전히 지울까요? 되돌릴 수 없어요.") && act({ op: "delete" }, "지웠어요"))
    );
    box.append(sel, link, reply, row);
    return box;
  }

  /* ---------- 글쓰기 ---------- */
  const form = $("write-form");
  function openForm(show) {
    form.hidden = !show;
    $("write-open").hidden = show;
    if (show) {
      $("w-name").textContent = myName;
      $("w-title").focus();
    }
  }
  function setKind(k) {
    kind = k;
    for (const b of form.querySelectorAll(".bd-kind")) {
      const on = b.dataset.kind === k;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    }
  }
  $("write-open").addEventListener("click", () => openForm(true));
  $("write-cancel").addEventListener("click", () => openForm(false));
  for (const b of form.querySelectorAll(".bd-kind")) b.addEventListener("click", () => setKind(b.dataset.kind));
  $("w-rename").addEventListener("click", () => {
    myName = newName();
    store.set("today-board-name", myName);
    $("w-name").textContent = myName;
  });
  $("w-body").addEventListener("input", () => ($("w-count").textContent = String($("w-body").value.length)));
  for (const id of ["w-title", "w-body"]) $(id).addEventListener("input", () => ($("w-error").textContent = ""));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("w-title").value.trim();
    const body = $("w-body").value.trim();
    if (title.length < 2) {
      $("w-error").textContent = "제목을 두 글자 이상 써 주세요";
      $("w-title").focus();
      return;
    }
    const sub = $("write-submit");
    sub.disabled = true;
    try {
      const r = await call({ action: "post", kind, title, body, name: myName, device, game: fromGame });
      voted.add(r.post.id);
      store.set("today-board-voted", [...voted].slice(-500));
      $("w-title").value = "";
      $("w-body").value = "";
      $("w-count").textContent = "0";
      openForm(false);
      toast("올렸어요! 하트가 모이면 먼저 만들어요");
      tab = "new";
      paintTabs();
      load();
    } catch (err) {
      $("w-error").textContent = err.message;
    } finally {
      sub.disabled = false;
    }
  });

  /* ---------- 탭 ---------- */
  function paintTabs() {
    for (const b of document.querySelectorAll(".bd-tab")) b.classList.toggle("on", b.dataset.tab === tab);
  }
  for (const b of document.querySelectorAll(".bd-tab")) {
    b.addEventListener("click", () => {
      const needReload = (b.dataset.tab === "new" || b.dataset.tab === "kind-talk") !== (tab === "new" || tab === "kind-talk");
      tab = b.dataset.tab;
      paintTabs();
      needReload ? load() : render();
    });
  }

  if (fromGame) {
    setKind("fix");
    $("w-game").hidden = false;
    $("w-game").textContent = "🎮 보고 있던 게임에 대한 글로 올라가요";
    openForm(true);
  }
  load();
})();
