/**
 * 친구에게 도전장 — 모든 게임 공용 (game-chrome.js 가 자동으로 불러옴)
 *
 * 보내는 쪽
 *   - 게임이 끝나면 결과 화면에 "⚔️ 친구에게 도전장" 카드가 붙는다
 *     (TodayGameRank.open 을 감싸서 점수를 자동으로 받음 · 기록 챌린지도 이걸 거침)
 *   - 점수 모듈을 안 쓰는 게임은 직접 호출:
 *       TodayDuel.report(score, { label, lowerIsBetter, parent, extra, subject })
 *   - 시작 화면에도 "같이 하자" 초대 버튼(점수 없는 도전장)
 *
 * 받는 쪽  /games/<id>/?vs=이름&vss=점수&vsl=표시문구&vsd=1(낮을수록 좋음)
 *   - 상단에 "OO님의 도전장" 배너
 *   - 게임이 끝나면 이겼는지 바로 알려 주고 답장 도전장 버튼
 */
(() => {
  "use strict";

  if (window.TodayDuel) return;

  const SITE = "https://www.todaygame.co.kr";
  const NAME_KEY = "today-game-name";
  /** 외부 연결 고전 게임 · 자체 공유가 있는 게임은 제외 */
  const SKIP = new Set([
    "bubble-bobble",
    "donkey-kong",
    "galaga",
    "lemmings",
    "lode-runner",
    "pacman-classic",
    "prince",
    "goindol",
    "ideal-worldcup",
    "balance-game",
    "hidden",
  ]);

  const m = String(location.pathname || "").match(/\/games\/([^/]+)\//);
  const gameId = m ? m[1] : "";
  if (!gameId || SKIP.has(gameId)) {
    window.TodayDuel = { report() {}, enabled: false };
    return;
  }

  const params = new URLSearchParams(location.search);
  const incoming = params.has("vs")
    ? {
        name: clean(params.get("vs")).slice(0, 8) || "친구",
        score: params.has("vss") && Number.isFinite(Number(params.get("vss"))) ? Number(params.get("vss")) : null,
        label: clean(params.get("vsl")).slice(0, 24),
        lower: params.get("vsd") === "1",
      }
    : null;

  let last = null; // { score, label, lowerIsBetter, extra, subject }

  function clean(s) {
    return String(s || "").replace(/[<>"'`\\]/g, "").trim();
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function gameTitle() {
    const t = String(document.title || "").split(/\s[|—–-]\s/)[0].trim();
    return t || "오늘의 게임";
  }

  function myName() {
    try {
      return clean(localStorage.getItem(NAME_KEY) || "").slice(0, 8);
    } catch (_) {
      return "";
    }
  }

  function setName(n) {
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch (_) {
      /* 저장 불가 */
    }
  }

  /* ---------- 스타일 ---------- */
  function ensureStyles() {
    if (document.getElementById("today-duel-style")) return;
    const st = document.createElement("style");
    st.id = "today-duel-style";
    st.textContent = `
      .tduel-card{margin:14px auto 4px;max-width:420px;padding:14px;border-radius:16px;background:linear-gradient(150deg,#fff6e0,#ffe9ef);border:1.5px solid #ffb547;color:#3a2a44;font-family:"Jua","Noto Sans KR",system-ui,sans-serif;text-align:center;box-shadow:0 6px 18px rgba(80,40,20,.14)}
      .tduel-card h4{margin:0 0 4px;font-size:19px;font-weight:400}
      .tduel-card p{margin:0 0 10px;font-family:"Noto Sans KR",system-ui,sans-serif;font-size:13.5px;line-height:1.5;color:#6b5a72}
      .tduel-card .tduel-res{font-family:"Jua",sans-serif;font-size:18px;color:#3a2a44}
      .tduel-card .tduel-res.win{color:#1f9d63}.tduel-card .tduel-res.lose{color:#d6453a}
      .tduel-row{display:flex;gap:8px}
      .tduel-row button{flex:1;appearance:none;border:0;border-radius:12px;padding:11px 8px;font:inherit;font-size:15.5px;cursor:pointer}
      .tduel-kakao{background:#fee500;color:#191600;box-shadow:0 3px 0 #d8c200}
      .tduel-link{background:#fff;color:#3a2a44;border:1px solid #e6d6c4 !important;box-shadow:0 3px 0 #e6d6c4}
      .tduel-name{display:block;width:100%;margin:0 0 8px;padding:10px 12px;border:1px solid #e6d6c4;border-radius:10px;font:inherit;font-family:"Noto Sans KR",sans-serif;font-size:15px;text-align:center;box-sizing:border-box}
      .tduel-msg{min-height:1.2em;margin:8px 0 0 !important}
      .tduel-invite{display:inline-flex;align-items:center;gap:6px;margin:12px auto 0;padding:9px 16px;border:1.5px solid #ffb547;border-radius:999px;background:#fff8e8;color:#5a3a1a;font-family:"Jua","Noto Sans KR",sans-serif;font-size:15px;cursor:pointer;box-shadow:0 3px 0 #f0d39c}
      .tduel-invite-wrap{text-align:center}
      .tduel-banner{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:9000;width:min(92vw,420px);padding:12px 40px 12px 14px;border-radius:16px;background:#2b2433;color:#fff;font-family:"Noto Sans KR",system-ui,sans-serif;font-size:14px;line-height:1.5;box-shadow:0 10px 30px rgba(0,0,0,.3);text-align:left;box-sizing:border-box;animation:tduel-in .35s ease}
      .tduel-banner b{color:#ffd45c}
      .tduel-banner button{position:absolute;right:8px;top:8px;width:28px;height:28px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:15px;cursor:pointer}
      @keyframes tduel-in{from{opacity:0;transform:translate(-50%,-12px)}}
    `;
    document.head.appendChild(st);
  }

  /* ---------- 공유 ---------- */
  function ensureScores() {
    if (window.TodayScores) return Promise.resolve(true);
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "/js/scores.js?v=7";
      s.onload = () => resolve(Boolean(window.TodayScores));
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function buildUrl(withScore) {
    const q = new URLSearchParams();
    if (last && last.extra) Object.entries(last.extra).forEach(([k, v]) => q.set(k, String(v)));
    q.set("vs", myName() || "친구");
    if (withScore && last) {
      q.set("vss", String(last.score));
      if (last.label) q.set("vsl", last.label);
      if (last.lowerIsBetter) q.set("vsd", "1");
    }
    q.set("utm_source", "duel");
    return `${SITE}/games/${gameId}/?${q.toString()}`;
  }

  function shareTexts(withScore) {
    const title = (last && last.subject) || gameTitle();
    const who = myName() || "친구";
    if (withScore && last) {
      return {
        title: `⚔️ ${who}님의 도전장: ${title}`,
        desc: `내 기록 ${last.label || last.score}! 이길 수 있으면 이겨 봐`,
      };
    }
    return { title: `🎮 ${who}님이 같이 하재요: ${title}`, desc: "오늘의 게임에서 한 판 붙자!" };
  }

  function isInApp() {
    return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(navigator.userAgent || "");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch (_) {
        return false;
      }
    }
  }

  async function sendLink(withScore, msgEl) {
    const url = buildUrl(withScore);
    const t = shareTexts(withScore);
    if (!isInApp() && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t.title, text: `${t.title}\n${t.desc}`, url });
        if (msgEl) msgEl.textContent = "도전장을 보냈어요!";
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    const ok = await copyText(`${t.title}\n${t.desc}\n${url}`);
    if (msgEl) msgEl.textContent = ok ? "도전장 링크를 복사했어요. 카톡·문자에 붙여넣기!" : "복사가 안 돼요. 주소를 직접 보내 주세요";
  }

  async function sendKakao(withScore, msgEl) {
    const ok = await ensureScores();
    const t = shareTexts(withScore);
    if (ok && TodayScores.shareToKakao) {
      const res = await TodayScores.shareToKakao({
        gameId,
        gameTitle: gameTitle(),
        title: t.title,
        description: t.desc,
        buttonTitle: withScore ? "도전 받기" : "같이 하기",
        url: buildUrl(withScore),
      });
      if (res && res.ok) {
        if (msgEl) msgEl.textContent = "카카오톡을 열었어요";
        return;
      }
    }
    await sendLink(withScore, msgEl);
  }

  function nameInputIfNeeded(card) {
    if (myName()) return null;
    const input = document.createElement("input");
    input.className = "tduel-name";
    input.maxLength = 8;
    input.placeholder = "내 이름 (친구에게 보여요)";
    input.autocomplete = "nickname";
    card.insertBefore(input, card.querySelector(".tduel-row"));
    return input;
  }

  function wire(card, withScore) {
    const input = nameInputIfNeeded(card);
    const msg = card.querySelector(".tduel-msg");
    const prep = () => {
      if (input) {
        const n = clean(input.value).slice(0, 8);
        if (n.length >= 1) setName(n);
      }
    };
    card.querySelector(".tduel-kakao").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      prep();
      sendKakao(withScore, msg);
    });
    card.querySelector(".tduel-link").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      prep();
      sendLink(withScore, msg);
    });
    // 결과 화면을 누르면 다시 시작하는 게임이 있어서 카드 안의 클릭은 밖으로 안 보냄
    ["click", "pointerdown", "touchstart", "mousedown"].forEach((ev) =>
      card.addEventListener(ev, (e) => e.stopPropagation(), { passive: true })
    );
  }

  /* ---------- 결과 카드 ---------- */
  function verdict() {
    if (!incoming || incoming.score == null || !last) return null;
    const lower = incoming.lower || last.lowerIsBetter;
    if (last.score === incoming.score) return { cls: "", text: `무승부! ${incoming.name}님과 똑같아요 🤝` };
    const win = lower ? last.score < incoming.score : last.score > incoming.score;
    return win
      ? { cls: "win", text: `🏆 승리! ${incoming.name}님(${incoming.label || incoming.score})을 이겼어요` }
      : { cls: "lose", text: `😤 패배… ${incoming.name}님 기록은 ${incoming.label || incoming.score}` };
  }

  function findParent(explicit) {
    if (explicit) return explicit;
    const form = document.getElementById("today-rank-form");
    if (form && form.parentElement && form.offsetParent !== null) return form.parentElement;
    const cands = ["record-panel", "over", "win", "all", "result", "gameover", "clear", "allclear"];
    for (const id of cands) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) return el;
    }
    for (const id of cands) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  function renderCard(parent) {
    ensureStyles();
    const old = document.getElementById("tduel-card");
    if (old) old.remove();
    if (!parent || !last) return;
    const v = verdict();
    const card = document.createElement("div");
    card.id = "tduel-card";
    card.className = "tduel-card";
    card.innerHTML = `
      ${v ? `<div class="tduel-res ${v.cls}">${esc(v.text)}</div><p>내 기록 ${esc(last.label || last.score)}</p>` : ""}
      <h4>⚔️ ${v ? "답장 도전장 보내기" : "친구에게 도전장"}</h4>
      <p>내 기록 <b>${esc(last.label || String(last.score))}</b>, 이걸 걸고 친구에게 보내요.<br />친구가 들어오면 이 기록이랑 바로 비교돼요.</p>
      <div class="tduel-row">
        <button type="button" class="tduel-kakao">카카오톡</button>
        <button type="button" class="tduel-link">링크 보내기</button>
      </div>
      <p class="tduel-msg"></p>`;
    const form = document.getElementById("today-rank-form");
    if (form && form.parentElement === parent && form.nextSibling) parent.insertBefore(card, form.nextSibling);
    else parent.appendChild(card);
    wire(card, true);
  }

  function report(score, opts = {}) {
    const n = Number(score);
    if (!Number.isFinite(n)) return;
    last = {
      score: Math.round(n * 1000) / 1000,
      label: clean(opts.label || "").slice(0, 24),
      lowerIsBetter: Boolean(opts.lowerIsBetter),
      extra: opts.extra || null,
      subject: opts.subject || "",
    };
    // 결과 화면이 그려진 뒤에 붙임
    setTimeout(() => renderCard(findParent(opts.parent)), 60);
  }

  /* ---------- 기존 점수 모듈 감싸기 ---------- */
  function higherIsBetter(opts) {
    if (opts && opts.higherIsBetter != null) return opts.higherIsBetter !== false;
    if (window.TodayVisit && TodayVisit.higherIsBetter) {
      try {
        return TodayVisit.higherIsBetter(gameId) !== false;
      } catch (_) {
        return true;
      }
    }
    return true;
  }

  function hookRank() {
    const R = window.TodayGameRank;
    if (!R || R.__duel) return Boolean(R);
    R.__duel = true;
    const open = R.open;
    R.open = function (score, opts) {
      const res = open.apply(this, arguments);
      const shown = opts && opts.compareScore != null ? opts.compareScore : score;
      report(shown, {
        label: (opts && opts.label) || `${Math.floor(Number(score) || 0).toLocaleString("ko-KR")}점`,
        lowerIsBetter: !higherIsBetter(opts),
      });
      return res;
    };
    const after = R.afterSubmit;
    if (after) {
      R.afterSubmit = async function (o) {
        const res = await after.apply(this, arguments);
        if (o && o.score != null && (!last || last.score !== Number(o.score))) {
          report(o.score, { label: o.label, lowerIsBetter: !higherIsBetter() });
        }
        return res;
      };
    }
    return true;
  }

  /* ---------- 초대 버튼 · 받은 도전장 배너 ---------- */
  function mountInvite() {
    ensureStyles();
    if (document.getElementById("tduel-invite")) return;
    const wrap = document.createElement("div");
    wrap.className = "tduel-invite-wrap";
    wrap.id = "tduel-invite";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tduel-invite";
    btn.textContent = "⚔️ 친구 불러서 같이 하기";
    wrap.appendChild(btn);
    const title = document.getElementById("title");
    const stage = document.querySelector(".stage") || document.querySelector(".app") || document.body;
    const host = title || stage;
    const about = host.querySelector(":scope > .seo-about");
    if (about) host.insertBefore(wrap, about);
    else host.appendChild(wrap);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (wrap.querySelector(".tduel-card")) return;
      const card = document.createElement("div");
      card.className = "tduel-card";
      card.innerHTML = `
        <h4>🎮 같이 하자고 보내기</h4>
        <p>친구가 링크로 들어오면 내 이름이 담긴 도전장이 보여요.<br />한 판 하고 나면 기록을 걸고 다시 보낼 수 있어요.</p>
        <div class="tduel-row">
          <button type="button" class="tduel-kakao">카카오톡</button>
          <button type="button" class="tduel-link">링크 보내기</button>
        </div>
        <p class="tduel-msg"></p>`;
      wrap.appendChild(card);
      wire(card, false);
    });
    ["pointerdown", "touchstart", "mousedown"].forEach((ev) =>
      btn.addEventListener(ev, (e) => e.stopPropagation(), { passive: true })
    );
  }

  function showIncoming() {
    if (!incoming) return;
    ensureStyles();
    const el = document.createElement("div");
    el.className = "tduel-banner";
    el.setAttribute("role", "status");
    el.innerHTML =
      incoming.score != null
        ? `⚔️ <b>${esc(incoming.name)}</b>님의 도전장!<br />기록 <b>${esc(incoming.label || incoming.score)}</b> — ${
            incoming.lower ? "더 빨리(적게)" : "더 높게"
          } 하면 승리예요`
        : `🎮 <b>${esc(incoming.name)}</b>님이 같이 하자고 불렀어요!<br />한 판 하고 기록을 걸어 답장해 보세요`;
    const x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label", "닫기");
    x.textContent = "✕";
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      el.remove();
    });
    el.appendChild(x);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 9000);
  }

  window.TodayDuel = { report, enabled: true, incoming };

  function boot() {
    hookRank();
    mountInvite();
    showIncoming();
    // 늦게 불러오는 게임 대비
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      if (hookRank() || tries > 20) clearInterval(iv);
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
