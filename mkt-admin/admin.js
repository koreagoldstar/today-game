/* 홍보 관리 화면 — api/mkt-admin.js 만 부른다. 글자는 모두 textContent 로 넣는다 (문구 · 닉네임에 HTML 이 섞여도 실행되지 않게). */
(() => {
  "use strict";
  const API = "/api/mkt-admin";
  const TOKEN_KEY = "todaygame-mkt-admin";
  const $ = (id) => document.getElementById(id);
  const CH_KO = { instagram: "인스타그램", threads: "Threads", facebook: "Facebook", youtube: "YouTube" };
  const DAY_KO = { sun: "일", mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토" };
  const TYPE_KO = { game: "게임 릴스", reel: "게임 릴스", "new-game": "신작", quiz: "상식퀴즈", ranking: "주간 랭킹", fortune: "운세", challenge: "챌린지", recycle: "피드 재활용" };
  const KIND_KO = { reel: "릴스", image: "이미지", carousel: "캐러셀", story: "스토리" };

  let token = "";
  try {
    token = localStorage.getItem(TOKEN_KEY) || "";
  } catch (_) {}

  /** 작은 요소 만들기: h("div", { class: "x", onclick }, [자식 | 글자]) */
  function h(tag, attrs = {}, kids = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of [].concat(kids)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return el;
  }
  const kst = (iso) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }) : "-");

  function toast(text, bad = false) {
    const t = $("toast");
    t.textContent = text;
    t.className = `toast${bad ? " bad" : ""}`;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), bad ? 6000 : 3000);
  }

  async function call(method, params = {}) {
    const init = { method, headers: { Authorization: `Bearer ${token}` }, cache: "no-store" };
    let url = API;
    if (method === "GET") url += `?${new URLSearchParams(params)}`;
    else {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(params);
    }
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (res.status === 401 && params.action !== "login") {
      showLogin();
      throw new Error("다시 로그인해 주세요.");
    }
    if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  /* ---------- 로그인 ---------- */
  function showLogin() {
    token = "";
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
    $("app").hidden = true;
    $("login").hidden = false;
    $("key").focus();
  }
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-btn").disabled = true;
    $("login-msg").textContent = "";
    try {
      const r = await call("POST", { action: "login", key: $("key").value });
      token = r.token;
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch (_) {}
      $("key").value = "";
      start();
    } catch (err) {
      $("login-msg").textContent = err.message;
    } finally {
      $("login-btn").disabled = false;
    }
  });
  $("logout-btn").addEventListener("click", async () => {
    await call("POST", { action: "logout" }).catch(() => {});
    showLogin();
  });
  $("refresh-btn").addEventListener("click", () => route());

  /* ---------- 콘텐츠 카드 (승인 · 반려 · 문구 · 다시 만들기 · 채널 · 시각 · 취소) ---------- */
  function statusChip(d) {
    const cls = { PUBLISHED: "ok", READY_FOR_APPROVAL: "warn", SCHEDULED: "ok", FAILED: "bad", EXPIRED: "bad", REJECTED: "bad" }[d.status] || "";
    return h("span", { class: `chip ${cls}`, text: d.statusKo });
  }

  function media(d) {
    const box = h("div", { class: "media" });
    const video = d.files.find((f) => f.role === "video");
    const cover = d.files.find((f) => f.role === "cover");
    if (video) box.append(h("video", { src: video.url, controls: true, preload: "metadata", playsinline: true, poster: cover ? cover.url : null }));
    for (const f of d.files.filter((x) => x.role === "slide" || x.role === "image")) box.append(h("img", { src: f.url, alt: `${f.role} ${f.w || ""}x${f.h || ""}`, loading: "lazy" }));
    if (d.mediaRemovedAt) return h("p", { class: "note", text: "저장 공간 때문에 파일은 30일 뒤 지웠습니다 (게시물은 플랫폼에 그대로)." });
    return d.files.length ? box : h("p", { class: "note", text: "미리 볼 파일이 없습니다 (공개 주소가 없는 콘텐츠)." });
  }

  async function act(d, action, extra = {}, done = "반영했습니다.") {
    try {
      const r = await call("POST", { action, id: d.id, version: d.version, ...extra });
      toast(`${done} (${r.item.statusKo})`);
    } catch (err) {
      toast(err.message, true);
    }
    route();
  }

  function card(d) {
    const editable = ["READY_FOR_APPROVAL", "APPROVED", "SCHEDULED"].includes(d.status) && !Object.values(d.posts || {}).some((p) => p && p.status !== "PENDING");
    const head = h("div", { class: "card-head" }, [
      h("div", {}, [h("h2", { text: d.title || d.id }), h("div", { class: "meta", text: `${d.id} · 버전 ${d.version} · ${d.slot === "story" ? "스토리" : "피드"} ${KIND_KO[d.kind] || d.kind || ""}${d.meta && d.meta.durationSec ? ` ${d.meta.durationSec}초` : ""} · ${TYPE_KO[d.sourceType] || d.sourceType || ""}` })]),
      statusChip(d),
    ]);
    const info = h("div", {}, [
      h("p", { class: "meta", text: `채널: ${(d.channels || []).map((c) => CH_KO[c] || c).join(", ")}` }),
      h("p", { class: "meta", text: `게시 예정: ${kst(d.scheduledAt)}${d.validDay ? ` · ${d.validDay} 하루만` : ""}` }),
      d.qc ? h("p", { class: "meta", text: `검수: ${d.qc.passed ? `통과 (${d.qc.total}항목)` : `불합격 — ${d.qc.failed.join(" / ")}`}` }) : null,
      d.failure ? h("p", { class: "meta", text: `실패: [${d.failure.stage}] ${d.failure.reason}` }) : null,
      d.rejection ? h("p", { class: "meta", text: `반려 사유: ${d.rejection.reason}` }) : null,
      d.skipped ? h("p", { class: "meta", text: `건너뜀: ${d.skipped}` }) : null,
      d.redo ? h("p", { class: "meta", text: "다시 만들기 대기 — 다음 자동 실행(최대 30분)에서 만듭니다." }) : null,
      d.posts && Object.keys(d.posts).length
        ? h("ul", { class: "plain meta" }, Object.entries(d.posts).map(([ch, p]) => h("li", {}, [`${CH_KO[ch] || ch}: ${p.status}${p.mock ? " (모의)" : ""}${p.error ? ` — ${p.error.kind}: ${p.error.message}` : ""}${p.commentError ? ` · 첫 댓글 실패: ${p.commentError}` : ""} `, p.permalink ? h("a", { href: p.permalink, target: "_blank", rel: "noopener noreferrer", text: "게시물 보기" }) : null])))
        : null,
    ]);

    // 문구: 인스타는 고칠 수 있게, 다른 채널은 보기만 (채널을 바꾸면 그 채널 문구로 게시)
    const ig = d.copy && d.copy.instagram;
    const copyBox = h("div", {});
    if (ig && editable) {
      const ta = h("textarea", { "aria-label": "인스타 문구" });
      ta.value = ig.caption;
      const tags = h("input", { "aria-label": "해시태그", value: (ig.hashtags || []).join(" ") });
      copyBox.append(
        h("p", { class: "meta", text: `인스타 문구 (${ig.source || "-"}${ig.edited ? " · 수정됨" : ""}) — 고치면 승인이 다시 필요해요` }),
        ta,
        tags,
        h("div", { class: "actions" }, [h("button", { class: "btn small", type: "button", text: "문구 저장", onclick: () => act(d, "editCopy", { channel: "instagram", caption: ta.value, hashtags: tags.value.split(/\s+/).filter(Boolean) }, "문구를 고쳤습니다") })])
      );
    } else if (ig) copyBox.append(h("p", { class: "meta", text: "인스타 문구" }), h("div", { class: "copy", text: `${ig.caption}\n\n${(ig.hashtags || []).join(" ")}` }));
    const others = Object.entries(d.copy || {}).filter(([ch]) => ch !== "instagram");
    if (others.length) copyBox.append(h("details", {}, [h("summary", { text: "다른 채널 문구" }), ...others.map(([ch, c]) => h("div", { class: "copy", text: `[${CH_KO[ch] || ch}]${c.title ? ` ${c.title}` : ""}\n${c.caption}\n${(c.hashtags || []).join(" ")}` }))]));
    if (d.meta && d.meta.comment) copyBox.append(h("p", { class: "meta", text: "게시 뒤 첫 댓글" }), h("div", { class: "copy", text: d.meta.comment }));

    const actions = h("div", { class: "actions" });
    if (d.status === "READY_FOR_APPROVAL") {
      const when = h("input", { type: "datetime-local", "aria-label": "게시 시각(서울)" });
      actions.append(
        h("button", { class: "btn primary", type: "button", text: "승인", onclick: () => act(d, "approve", when.value ? { scheduledAt: new Date(`${when.value}:00+09:00`).toISOString() } : {}, "승인했습니다") }),
        h("label", {}, ["시각(비우면 다음 빈 자리)", when]),
        h("button", {
          class: "btn danger",
          type: "button",
          text: "반려",
          onclick: () => {
            const reason = prompt("반려 사유를 적어 주세요.");
            if (reason) act(d, "reject", { reason }, "반려했습니다");
          },
        })
      );
    }
    if (editable) {
      const time = h("input", { type: "datetime-local", "aria-label": "새 게시 시각(서울)" });
      actions.append(
        h("button", { class: "btn", type: "button", text: "문구 다시 만들기", onclick: () => act(d, "redo", { stage: "copy" }, "문구 다시 만들기를 요청했습니다") }),
        h("button", { class: "btn", type: "button", text: "다시 제작", onclick: () => confirm("영상 · 이미지부터 다시 만들까요?") && act(d, "redo", { stage: "render" }, "다시 제작을 요청했습니다") })
      );
      if (d.status !== "READY_FOR_APPROVAL") actions.append(h("label", {}, ["시각 변경", time]), h("button", { class: "btn small", type: "button", text: "시각 저장", onclick: () => time.value && act(d, "setTime", { scheduledAt: new Date(`${time.value}:00+09:00`).toISOString() }, "시각을 바꿨습니다 (다시 승인 필요)") }));
      const boxes = Object.keys(d.copy || {}).map((ch) => {
        const cb = h("input", { type: "checkbox", value: ch });
        cb.checked = (d.channels || []).includes(ch);
        return h("label", {}, [cb, CH_KO[ch] || ch]);
      });
      actions.append(
        h("span", { class: "meta", text: "채널:" }),
        ...boxes,
        h("button", { class: "btn small", type: "button", text: "채널 저장", onclick: () => act(d, "setChannels", { channels: boxes.map((l) => l.firstChild).filter((x) => x.checked).map((x) => x.value) }, "채널을 바꿨습니다 (다시 승인 필요)") }),
        h("button", { class: "btn danger", type: "button", text: "게시 취소", onclick: () => confirm("이 콘텐츠를 게시하지 않을까요?") && act(d, "cancel", {}, "취소했습니다") })
      );
    }
    return h("article", { class: "card" }, [head, media(d), h("div", { class: "grid2" }, [info, copyBox]), actions.childNodes.length ? actions : null, h("details", {}, [h("summary", { text: "기록" }), h("ul", { class: "plain meta" }, (d.history || []).map((x) => h("li", { text: `${kst(x.at)} ${x.from || "-"} → ${x.to} · ${x.by}${x.note ? ` · ${x.note}` : ""}` })))])]);
  }

  /* ---------- 화면들 ---------- */
  const views = {
    async overview(view) {
      const r = await call("GET", { op: "overview" });
      const s = r.count;
      view.append(
        h("div", { class: "stats" }, [["승인 대기", s.pending], ["게시 예정", s.scheduled], ["게시 완료", s.published], ["만드는 중", s.making], ["실패 · 취소", s.failed]].map(([k, v]) => h("div", { class: "stat" }, [h("b", { text: String(v) }), h("span", { text: k })]))),
        h("h2", { text: `오늘 (${r.today})` }),
        ...(r.todayItems.length ? r.todayItems.map(card) : [h("p", { class: "empty", text: "오늘 만든 콘텐츠가 아직 없습니다. 매일 08:07(서울) 자동 제작 — GitHub 예약 실행은 몇 분~수십 분 늦을 수 있어요." })]),
        h("h2", { text: "다음 게시" }),
        r.next.length ? h("ul", { class: "plain" }, r.next.map((d) => h("li", { text: `${kst(d.scheduledAt)} · ${d.title} (${(d.channels || []).map((c) => CH_KO[c] || c).join(", ")})` }))) : h("p", { class: "note", text: "예약된 게시가 없습니다." }),
        h("h2", { text: "최근 자동 실행" }),
        table(["종류", "상태", "시작", "결과"], r.jobs.map((j) => [j.type, j.status, kst(j.startedAt), j.error || (typeof j.result === "string" ? j.result : JSON.stringify(j.result || ""))]))
      );
    },
    pending: (v) => list(v, "pending", "승인 대기 중인 콘텐츠가 없습니다."),
    scheduled: (v) => list(v, "scheduled", "예약된 게시가 없습니다."),
    published: (v) => list(v, "published", "아직 게시된 콘텐츠가 없습니다."),
    failed: (v) => list(v, "failed", "실패 · 반려 · 취소된 콘텐츠가 없습니다."),
    async games(view) {
      const r = await call("GET", { op: "games" });
      if (!r.games.length) return view.append(h("p", { class: "empty", text: "게임 목록이 아직 없습니다. 자동 게시 실행(30분마다)이 한 번 돌면 채워집니다." }));
      view.append(
        h("p", { class: "note", text: `기준: ${kst(r.snapshotAt)} 자동 실행 · 녹화 프로필은 저장소의 marketing/profiles/ 파일 (여기서는 보기만)` }),
        table(
          ["게임", "녹화 프로필", "PC 녹화 재고", "마지막 게시", "홍보"],
          r.games.map((g) => {
            const cb = h("input", { type: "checkbox", "aria-label": `${g.title} 홍보하기` });
            cb.checked = !g.excluded;
            cb.addEventListener("change", async () => {
              try {
                await call("POST", { action: "exclude", gameId: g.id, excluded: !cb.checked });
                toast(`${g.title}: ${cb.checked ? "홍보함" : "홍보 제외"}`);
              } catch (err) {
                cb.checked = !cb.checked;
                toast(err.message, true);
              }
            });
            return [`${g.title} (${g.id})`, g.profile ? `있음 · ${g.profile.runner === "pc" ? "PC 녹화" : "자동 녹화"} · 원본 ${g.profile.rawSec}초` : "없음 (신작이면 썸네일 이미지)", g.stock == null ? "-" : `${g.stock}개`, g.lastPublished ? kst(g.lastPublished) : "-", h("label", {}, [cb, "홍보함"])];
          })
        )
      );
    },
    async schedule(view) {
      const { settings: s, choices } = await call("GET", { op: "settings" });
      const days = choices.days.map((d) => {
        const inp = h("input", { value: s.schedule[d].join(", "), "aria-label": `${DAY_KO[d]}요일 피드` });
        return [d, inp];
      });
      const story = h("input", { value: s.story.join(", "), "aria-label": "스토리 순서" });
      const feedT = h("input", { type: "time", value: s.postTimes.feed });
      const storyT = h("input", { type: "time", value: s.postTimes.story });
      const chBoxes = choices.channels.map((c) => {
        const cb = h("input", { type: "checkbox", value: c });
        cb.checked = s.channels.includes(c);
        return h("label", {}, [cb, CH_KO[c]]);
      });
      const pending = h("input", { type: "number", min: 1, max: 14, value: s.maxPending });
      const repeat = h("input", { type: "number", min: 0, max: 90, value: s.repeatDays });
      const track = h("input", { type: "checkbox" });
      track.checked = !!s.trackClicks;
      const split = (v) => v.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
      view.append(
        h("section", { class: "card" }, [
          h("h2", { text: "요일별 피드 편성" }),
          h("p", { class: "note", text: `앞에서부터 시도하고 자료가 모자라면 다음 것. 쓸 수 있는 이름: ${choices.feed.map((t) => `${t}(${TYPE_KO[t]})`).join(" · ")}` }),
          ...days.map(([d, inp]) => h("div", { class: "sched" }, [h("b", { text: `${DAY_KO[d]}요일` }), inp])),
          h("div", { class: "sched" }, [h("b", { text: "스토리" }), story]),
          h("p", { class: "note", text: `스토리는 날마다 하나씩 돌아가며: ${choices.story.map((t) => `${t}(${TYPE_KO[t]})`).join(" · ")}` }),
          h("div", { class: "actions" }, [h("label", {}, ["피드 시각", feedT]), h("label", {}, ["스토리 시각", storyT])]),
          h("div", { class: "actions" }, [h("span", { class: "meta", text: "기본 채널:" }), ...chBoxes]),
          h("div", { class: "actions" }, [h("label", {}, ["승인 대기 상한", pending]), h("label", {}, ["같은 게임 다시 홍보 간격(일)", repeat])]),
          h("div", { class: "actions" }, [h("label", {}, [track, "사이트 클릭 세기 (링크가 /api/mkt-go 를 거침 — 운영에 배포한 뒤에만 켜세요)"])]),
          h("div", { class: "actions" }, [
            h("button", {
              class: "btn primary",
              type: "button",
              text: "저장",
              onclick: async () => {
                const patch = { schedule: Object.fromEntries(days.map(([d, inp]) => [d, split(inp.value)])), story: split(story.value), postTimes: { feed: feedT.value, story: storyT.value }, channels: chBoxes.map((l) => l.firstChild).filter((x) => x.checked).map((x) => x.value), maxPending: Number(pending.value), repeatDays: Number(repeat.value), trackClicks: track.checked };
                try {
                  await call("POST", { action: "settings", patch });
                  toast("편성표를 저장했습니다.");
                } catch (err) {
                  toast(err.message, true);
                }
              },
            }),
          ]),
        ])
      );
    },
    async channels(view) {
      const r = await call("GET", { op: "channels" });
      if (!r.channels) return view.append(h("p", { class: "empty", text: "채널 상태가 아직 없습니다. 자동 게시 실행(30분마다)이 한 번 돌면 채워집니다." }));
      view.append(
        h("p", { class: "note", text: `기준: ${kst(r.snapshotAt)} 자동 실행 (실제로 게시하는 GitHub Actions 환경). 연결 방법: 저장소 marketing/docs/CHANNEL_SETUP.md` }),
        table(["채널", "모드", "상태", "기본 채널"], Object.entries(r.channels).map(([ch, c]) => [CH_KO[ch] || ch, c.mode === "live" ? "실제 게시" : "모의(Mock) — 아무것도 올라가지 않음", c.health.ok ? `정상${c.health.username ? ` @${c.health.username}` : ""}${c.health.daysLeft != null ? ` · 토큰 ${c.health.daysLeft}일 남음` : ""}` : `문제: ${c.health.reason || c.health.error || "-"}`, r.defaults.includes(ch) ? "예" : "-"]))
      );
    },
    async insights(view) {
      const r = await call("GET", { op: "insights" });
      if (r.weekly) view.append(h("section", { class: "card" }, [h("h2", { text: `주간 요약 (${r.weekly.week})` }), h("div", { class: "copy", text: r.weekly.text })]));
      if (!r.items.length) return view.append(h("p", { class: "empty", text: "게시된 콘텐츠가 아직 없습니다." }));
      view.append(
        h("p", { class: "note", text: "플랫폼이 주는 지표만 보여 줍니다 (모의 게시에는 지표가 없음). 클릭은 사이트로 넘어온 수 (/api/mkt-go)." }),
        table(
          ["콘텐츠", "채널", "지표", "사이트 클릭"],
          r.items.map((d) => [`${d.title} · ${kst(d.scheduledAt)}`, Object.entries(d.posts || {}).map(([ch, p]) => `${CH_KO[ch] || ch} ${p.status}${p.mock ? "(모의)" : ""}`).join(", "), d.insights ? Object.entries(d.insights).map(([ch, x]) => `${CH_KO[ch] || ch}: ${(x.metrics || []).map((m) => `${m.metric} ${m.value}`).join(" · ") || "없음"}`).join("\n") : "아직 수집 전", d.clicks == null ? "-" : String(d.clicks)])
        )
      );
    },
    async logs(view) {
      const r = await call("GET", { op: "logs" });
      if (!r.logs.length) return view.append(h("p", { class: "empty", text: "기록이 없습니다." }));
      view.append(table(["시각", "단계", "내용"], r.logs.map((l) => [kst(l.at), l.level, l.msg])));
    },
  };

  async function list(view, group, emptyText) {
    const r = await call("GET", { op: "contents", group });
    view.append(...(r.items.length ? r.items.map(card) : [h("p", { class: "empty", text: emptyText })]));
  }

  function table(head, rows) {
    return h("div", { class: "scroll" }, [h("table", { class: "table" }, [h("thead", {}, [h("tr", {}, head.map((t) => h("th", { text: t })))]), h("tbody", {}, rows.map((r) => h("tr", {}, r.map((c) => h("td", { style: "white-space:pre-wrap" }, [c])))))])]);
  }

  async function route() {
    const name = (location.hash || "#overview").slice(1);
    const fn = views[name] || views.overview;
    for (const a of document.querySelectorAll("#tabs a")) a.classList.toggle("on", a.getAttribute("href") === `#${name}`);
    const view = $("view");
    view.textContent = "불러오는 중…";
    try {
      const box = document.createDocumentFragment();
      const tmp = h("div", {});
      await fn(tmp);
      box.append(...tmp.childNodes);
      view.textContent = "";
      view.append(box);
      $("sub").textContent = `마지막 새로고침 ${new Date().toLocaleTimeString("ko-KR")}`;
      call("GET", { op: "contents", group: "pending" }).then((r) => ($("n-pending").textContent = r.items.length || "")).catch(() => {});
    } catch (err) {
      view.textContent = "";
      view.append(h("p", { class: "empty", text: `불러오지 못했습니다: ${err.message}` }));
    }
  }

  function start() {
    $("login").hidden = true;
    $("app").hidden = false;
    route();
  }
  window.addEventListener("hashchange", route);
  if (token) start();
  else showLogin();
})();
