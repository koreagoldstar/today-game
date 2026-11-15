/**
 * 어른이용 게임 공용 도우미
 *   TodayAdult.toast("복사했어요")
 *   TodayAdult.share({ title, text, url })      → 공유 시트, 안 되면 클립보드
 *   TodayAdult.kakao({ title, description, url, gameId, buttonTitle })
 *   TodayAdult.poll.get(["wc-yasik"]) / TodayAdult.poll.vote("wc-yasik", "chicken")
 */
(() => {
  "use strict";

  if (window.TodayAdult) return;

  const SITE = "https://www.todaygame.co.kr";

  let toastTimer = 0;
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "ad-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function isInApp() {
    return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(navigator.userAgent || "");
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
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

  async function share({ title, text, url }) {
    const full = url ? `${text}\n${url}` : text;
    if (!isInApp() && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return "share";
      } catch (err) {
        if (err && err.name === "AbortError") return "cancel";
      }
    }
    const ok = await copy(full);
    toast(ok ? "링크를 복사했어요. 카톡에 붙여넣어 보내 보세요!" : "복사가 안 돼요. 주소창 링크를 직접 보내 주세요");
    return ok ? "copy" : "fail";
  }

  async function kakao(opts) {
    if (window.TodayScores && TodayScores.shareToKakao) {
      const res = await TodayScores.shareToKakao(opts);
      if (res && res.ok) return "kakao";
    }
    return share({ title: opts.title, text: `${opts.title}\n${opts.description || ""}`.trim(), url: opts.url });
  }

  function absUrl(path) {
    return path.startsWith("http") ? path : SITE + path;
  }

  const poll = {
    async get(ids) {
      try {
        const res = await fetch(`/api/poll?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
        const data = await res.json();
        return data && data.ok ? data.polls : null;
      } catch (_) {
        return null;
      }
    },
    async vote(id, pick) {
      try {
        const res = await fetch("/api/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, pick }),
        });
        const data = await res.json();
        return data && data.ok ? data.counts : null;
      } catch (_) {
        return null;
      }
    },
  };

  function store(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* 저장 불가 환경 */
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function seoulDay() {
    return new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  }

  /** 짧은 효과음 (음소거면 조용히) */
  let ctx = null;
  function sfx(kind) {
    try {
      if (window.TodayAudio && TodayAudio.isMuted && TodayAudio.isMuted()) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) {
        ctx = new AC();
        if (window.TodayAudio && TodayAudio.wrapContext) TodayAudio.wrapContext(ctx);
      }
      if (ctx.state === "suspended") ctx.resume();
      const notes = { pick: [660, 880], win: [523, 659, 784, 1047], bad: [300, 220], tap: [520] }[kind] || [600];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const t = ctx.currentTime + i * 0.07;
        o.type = "triangle";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.18);
      });
    } catch (_) {
      /* 소리 없이 진행 */
    }
  }

  window.TodayAdult = { sfx, toast, share, kakao, copy, absUrl, poll, store, save, esc, shuffle, seoulDay, SITE };
})();
