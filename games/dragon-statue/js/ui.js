/*
 * 드래곤 석상 대작전 · 화면 (DOM)
 *  타이틀 · 캐릭터 선택 · 친구 도감 · 오늘의 도전 · 설정 · 규칙 카드 · 보상 · 일시정지 · 결과 · HUD · 알림
 *  게임 규칙은 모르고, game 이 부르는 대로 보여 주고 버튼을 game 에 알린다.
 */
import { paintIcons, ICONS } from "./icons.js?v=1";
import { CHARACTERS, CHAR_BY_ID, BATS, HATS, DECOS } from "./characters.js?v=1";
import { FAIRIES } from "./fairies.js?v=1";
import { KIND_INFO } from "./layout.js?v=1";
import { isUnlocked, condText, EGGS } from "./cosmetics.js?v=1";
import { REGIONS } from "./levels.js?v=1";
import { BOSSES } from "./boss.js?v=1";
import { THEMES } from "./world.js?v=1";

const $ = (id) => document.getElementById(id);
const SCREENS = ["title", "select", "regions", "challenge", "collection", "daily", "settings", "stage-intro", "rule", "reward", "pause", "result", "adv-result", "fallback"];
const fmtTime = (t) => {
  if (!t) return "-";
  const m = Math.floor(t / 60);
  const ss = Math.round(t % 60);
  return m ? `${m}분 ${ss}초` : `${ss}초`;
};
/** 지역 그림 (간단한 SVG 실루엣) */
function regionArt(id) {
  const ink = "rgba(30,40,30,.55)";
  const art = {
    jungle: `<path d="M8 60c6-20 10-30 14-36M22 24c-8-2-14 2-16 6M22 24c6-6 14-6 18-2M22 24c-2-8 2-14 6-16" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M40 60l10-22 10 22z" fill="${ink}"/>`,
    falls: `<path d="M10 60V20h18v40" fill="${ink}"/><path d="M30 20h10v40H30z" fill="rgba(255,255,255,.75)"/><path d="M40 60V26h16v34" fill="${ink}"/>`,
    crystal: `<path d="M14 60l6-30 6 30zM28 60l8-40 8 40zM46 60l5-24 5 24z" fill="rgba(200,180,255,.85)" stroke="${ink}" stroke-width="2"/>`,
    volcano: `<path d="M4 60l20-36h16l20 36z" fill="${ink}"/><path d="M24 24c2-8 10-10 16 0z" fill="#ff8a2a"/>`,
    ice: `<path d="M10 60V30l8-10 8 10v30zM34 60V22l10-12 10 12v38z" fill="rgba(255,255,255,.85)" stroke="${ink}" stroke-width="2"/>`,
    castle: `<path d="M8 60V34h8v-6h6v6h20v-6h6v6h8v26z" fill="${ink}"/><path d="M30 16l6 10h-12z" fill="#ffd23f"/>`,
  }[id];
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${art || ""}</svg>`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** 규칙 그림: 받침 위 드래곤 실루엣 (크기만 다르게) */
function statueSvg(h, odd, gold) {
  const w = h * 0.62;
  const fill = gold ? "#f2c14e" : "#c9c2b0";
  const ink = "#4a3a2a";
  return `<svg class="rs${odd ? " odd" : ""}" viewBox="0 0 62 100" style="height:${h}px;width:${w}px" aria-hidden="true">
    <path d="M8 92h46l-4-10H12z" fill="#9a9080" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M17 82c-4-10-2-22 6-30-6-6-6-16 0-22l-3-12 9 8c3-1 6-1 9 0l9-8-3 12c6 6 6 16 0 22 8 8 10 20 6 30z" fill="${fill}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="25" cy="38" r="2.6" fill="${ink}"/><circle cx="37" cy="38" r="2.6" fill="${ink}"/>
    <path d="M14 56c-8-6-10-16-6-22 2 8 6 12 12 14M48 56c8-6 10-16 6-22-2 8-6 12-12 14" fill="${fill}" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.body = document.body;
    this.toastT = 0;
    this.bannerT = 0;
    paintIcons(document);
    this.bind();
  }

  bind() {
    const g = this.g;
    const on = (id, fn) => {
      const el = $(id);
      if (el)
        el.addEventListener("click", (e) => {
          e.preventDefault();
          g.audio.unlock();
          g.audio.play("tap");
          fn(e);
        });
    };
    on("start-btn", () => g.openSelect("adv"));
    on("regions-btn", () => g.openRegions());
    on("char-btn", () => g.openSelect("adv"));
    on("challenge-btn", () => g.openChallenge());
    on("adv-pause", () => g.pause());
    on("collection-btn", () => g.openCollection());
    on("settings-btn", () => g.openSettings());
    on("go-btn", () => g.startFromSelect());
    on("rule-ok", () => g.ruleDone());
    on("reward-ok", () => g.rewardDone());
    on("pause-btn", () => g.pause());
    on("pause-resume", () => g.resume());
    on("pause-retry", () => g.restartRun());
    on("pause-quit", () => g.quitToTitle());
    on("hint-btn", () => g.useHint());
    on("res-retry", () => g.restartRun());
    on("res-continue", () => g.continueAfterWin());
    on("res-char-btn", () => g.openSelect(g.run ? g.run.mode : "normal"));
    on("res-title", () => g.quitToTitle());
    on("tutor-skip", () => g.skipTutorial());
    document.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        g.audio.play("tap");
        g.back();
      })
    );
  }

  /* ---------------- 화면 전환 ---------------- */
  show(id) {
    for (const s of SCREENS) {
      const el = $(s);
      if (el) el.hidden = s !== id;
    }
    this.current = id;
    this.body.classList.toggle("is-title", id === "title");
    this.body.classList.toggle("is-select", id === "select");
    if (id) {
      const el = $(id);
      const f = el && el.querySelector(".btn-main, .btn-res.primary, button");
      if (f && matchMedia("(pointer:fine)").matches) setTimeout(() => f.focus({ preventScroll: true }), 60);
    }
  }
  overlay(id, on) {
    const el = $(id);
    if (el) el.hidden = !on;
  }
  hud(on) {
    $("hud").hidden = !on;
    this.body.classList.toggle("is-play", on);
    if (!on) {
      $("combo").hidden = true;
      $("seals").hidden = true;
    }
  }
  loading(on) {
    $("loading").hidden = !on;
  }

  /* ---------------- 타이틀 ---------------- */
  paintTitle(save, dailyNew) {
    const d = save.data;
    const a = d.adv;
    const cleared = Object.values(a.regions).filter((r) => r.clears > 0).length;
    $("best-label").textContent = cleared ? `${cleared}개 지역 완주` : "첫 모험!";
    $("gem-label").textContent = a.totalCrystals;
    $("start-sub").textContent = a.unlocked > 1 ? `지역 ${Math.min(6, a.unlocked)}까지 열렸어요` : "캐릭터를 고르고 출발";
    $("daily-badge").hidden = !dailyNew;
    $("col-badge").hidden = !this.g.freshCollection;
  }

  /* ---------------- 캐릭터 선택 + 꾸미기 ---------------- */
  paintSelect(save, mode) {
    const d = save.data;
    $("select-mode").textContent = mode === "daily" ? "오늘의 도전" : mode === "normal" ? "석상 챌린지" : "모험";
    const row = $("char-row");
    row.innerHTML = CHARACTERS.map(
      (c) => `<button type="button" class="char-card${c.id === d.char ? " on" : ""}" role="radio" aria-checked="${c.id === d.char}" data-char="${c.id}" style="--c:${c.color}">
        <img src="${this.g.portraits.chars[c.id] || ""}" alt="" /><b>${c.name}</b></button>`
    ).join("");
    row.querySelectorAll("[data-char]").forEach((b) =>
      b.addEventListener("click", () => {
        this.g.audio.unlock();
        this.g.pickChar(b.dataset.char);
      })
    );
    this.ward = this.ward || "bat";
    document.querySelectorAll(".ward-tabs [data-ward]").forEach((t) => {
      t.classList.toggle("on", t.dataset.ward === this.ward);
      t.setAttribute("aria-selected", t.dataset.ward === this.ward);
      t.onclick = () => {
        this.ward = t.dataset.ward;
        this.g.audio.play("tap");
        this.paintSelect(save, mode);
      };
    });
    this.paintWard(save);
    this.paintSelInfo(d.char);
  }
  /** 꾸미기 줄 (방망이 · 모자 · 장식) — 잠긴 건 조건을 알려 준다 */
  paintWard(save) {
    const d = save.data;
    const type = this.ward || "bat";
    const list = type === "bat" ? BATS : type === "hat" ? HATS : DECOS;
    const sel = type === "bat" ? d.bat : type === "hat" ? d.hat : d.deco;
    const pics = type === "bat" ? this.g.portraits.bats : type === "hat" ? this.g.portraits.hats : this.g.portraits.decos;
    const box = $("bat-row");
    box.style.setProperty("--n", list.length);
    box.innerHTML = list
      .map((it) => {
        const open = isUnlocked(save, type, it.id);
        const pic = pics && pics[it.id] ? `<img src="${pics[it.id]}" alt="" />` : `<i class="none-ic">없음</i>`;
        return `<button type="button" class="bat-chip${it.id === sel ? " on" : ""}${open ? "" : " locked"}" role="radio" aria-checked="${it.id === sel}" data-item="${it.id}" ${open ? "" : 'aria-disabled="true"'} title="${esc(it.name)}">
        ${pic}${open ? "" : `<i class="lk" data-icon="lock"></i>`}<span class="sr">${esc(it.name)}${open ? "" : ` (${esc(condText(type, it.id))})`}</span></button>`;
      })
      .join("");
    box.querySelectorAll("[data-item]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.item;
        const it = list.find((x) => x.id === id);
        if (b.classList.contains("locked")) {
          this.toast(`${it.name}: ${condText(type, id)} 하면 열려요`);
          this.g.audio.play("tap");
          return;
        }
        if (type === "bat") this.g.pickBat(id);
        else if (type === "hat") this.g.pickHat(id);
        else this.g.pickDeco(id);
        this.toast(it.name, "", 0.9);
      })
    );
    paintIcons(box);
  }
  paintOutfitSel(type, id) {
    if ((this.ward || "bat") !== type) return;
    document.querySelectorAll("#bat-row [data-item]").forEach((b) => {
      const on = b.dataset.item === id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on);
    });
  }
  paintSelInfo(id) {
    const c = CHAR_BY_ID[id];
    $("sel-name").textContent = c.name;
    $("sel-tag").textContent = c.tag;
    document.querySelectorAll("#char-row [data-char]").forEach((b) => {
      const on = b.dataset.char === id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on);
    });
  }
  paintBatSel(id) {
    this.paintOutfitSel("bat", id);
  }

  /* ---------------- 지역 선택 (지도) ---------------- */
  paintRegions(save) {
    const a = save.data.adv;
    let total = 0;
    $("region-grid").innerHTML = REGIONS.map((R, i) => {
      const rec = a.regions[R.id];
      const open = R.no <= a.unlocked;
      const stars = rec ? rec.stars : 0;
      total += stars;
      const T = THEMES[R.theme];
      const sky = T.sky.map(([o, c]) => `${c} ${Math.round(o * 100)}%`).join(",");
      const boss = BOSSES[R.boss];
      const egg = a.eggs[boss.egg];
      return `<button type="button" class="region${open ? "" : " locked"}${rec ? " done" : ""}" data-region="${i}" style="--sky:linear-gradient(180deg,${sky})" ${open ? "" : 'aria-disabled="true"'}>
        <span class="rg-art" aria-hidden="true">${regionArt(R.id)}</span>
        <span class="rg-no">${R.no}</span>
        <span class="rg-txt"><b>${R.name}</b><small>${R.en} · ${R.tier}</small></span>
        <span class="rg-stars">${[0, 1, 2].map((k) => `<i data-icon="${k < stars ? "star" : "starEmpty"}"></i>`).join("")}</span>
        <span class="rg-rec">${rec ? `수정 ${rec.crystals} · ${fmtTime(rec.bestTime)}` : open ? "아직 안 가 봤어요" : `지역 ${R.no - 1} 완료하면 열려요`}</span>
        <span class="rg-boss">${egg ? `<img src="${this.g.portraits.eggs[boss.egg] || ""}" alt="" />` : ""}보스 · ${boss.name}</span>
        ${open ? "" : `<i class="rg-lock" data-icon="lock"></i>`}
      </button>`;
    }).join("");
    $("regions-stars").textContent = `★ ${total} / ${REGIONS.length * 3}`;
    $("region-grid").querySelectorAll("[data-region]").forEach((b) =>
      b.addEventListener("click", () => {
        this.g.audio.unlock();
        this.g.audio.play("tap");
        this.g.startRegion(Number(b.dataset.region));
      })
    );
    paintIcons($("region-grid"));
  }

  /* ---------------- 석상 챌린지 ---------------- */
  paintChallenge(save, dailyNew) {
    const d = save.data;
    $("ch-stars").textContent = `★ ${d.stars}`;
    $("challenge-card").innerHTML = `
      <p class="dc-t">모험 입구의 석상 퍼즐만 따로 즐기는 모드예요. 크기가 다른 석상을 찾아 방망이로 쾅!</p>
      <button type="button" class="ch-mode" id="ch-30"><span class="ic" data-icon="dragon"></span><span><b>석상 30단계</b><small>숲 · 정글 · 수정 동굴 · 화산 · 얼음 성 · 신전 · 보너스 판 · 수호자 보스</small><em>최고 ${d.bestStage ? d.bestStage + "단계" : "-"} · ${d.best.toLocaleString("ko-KR")}점</em></span></button>
      <button type="button" class="ch-mode" id="ch-daily"><span class="ic" data-icon="calendar"></span><span><b>오늘의 도전 ${dailyNew ? '<i class="badge in">NEW</i>' : ""}</b><small>날짜마다 바뀌는 10판 · 오늘은 누구나 같은 문제</small><em>기록은 따로 저장 · 이름을 적으면 오늘의 랭킹</em></span></button>`;
    paintIcons($("challenge-card"));
    $("ch-30").addEventListener("click", () => {
      this.g.audio.unlock();
      this.g.audio.play("tap");
      this.g.openSelect("normal");
    });
    $("ch-daily").addEventListener("click", () => {
      this.g.audio.unlock();
      this.g.audio.play("tap");
      this.g.openDaily();
    });
  }

  /* ---------------- 수집 도감 ---------------- */
  paintCollection(save) {
    const d = save.data;
    const a = d.adv;
    const nEgg = EGGS.filter((e) => a.eggs[e.id]).length;
    $("col-count").textContent = `알 ${nEgg} / ${EGGS.length}`;
    $("egg-grid").innerHTML = EGGS.map((e) => {
      const has = !!a.eggs[e.id];
      return `<div class="fairy${has ? " has" : ""} f-${["forest", "sea", "star", "fire", "ice", "gold"][EGGS.indexOf(e)]}" style="--c:${e.color}">
        <img src="${this.g.portraits.eggs[e.id] || ""}" alt="" />
        <b>${has ? e.name : "???"}</b>
        <small>${has ? `${a.eggs[e.id]} 얻음` : `지역 ${e.region} 보스를 이기면`}</small></div>`;
    }).join("");
    $("badge-grid").innerHTML = REGIONS.map((R) => {
      const c = a.badges[R.id + "-clear"];
      const s = a.badges[R.id + "-star"];
      return `<div class="badge-item${c ? " has" : ""}"><span class="bd${c ? " on" : ""}" title="${esc(R.name)} 완주">${R.no}</span><span class="bd gold${s ? " on" : ""}" title="${esc(R.name)} 별 3개">★</span><small>${esc(R.name)}</small></div>`;
    }).join("");
    const items = [
      ...HATS.filter((h) => h.id !== "none").map((h) => ["hat", h, this.g.portraits.hats[h.id]]),
      ...DECOS.filter((h) => h.id !== "none").map((h) => ["deco", h, this.g.portraits.decos[h.id]]),
      ...BATS.map((h) => ["bat", h, this.g.portraits.bats[h.id]]),
    ];
    $("ward-list").innerHTML = items
      .map(([t, it, pic]) => {
        const open = isUnlocked(save, t, it.id);
        return `<div class="bat-item${open ? " has" : ""}"><img src="${pic || ""}" alt="" /><b>${esc(it.name)}</b><small>${open ? "열림" : esc(condText(t, it.id))}</small></div>`;
      })
      .join("");
    $("fairy-grid").innerHTML = FAIRIES.map((f) => {
      const has = !!d.fairies[f.id];
      return `<div class="fairy${has ? " has" : ""} f-${f.id}" style="--c:${f.color}">
        <img src="${this.g.portraits.fairies[f.id] || ""}" alt="" />
        <b>${has ? f.name : "???"}</b>
        <small>${has ? `${d.fairies[f.id]} 만남` : esc(f.how)}</small></div>`;
    }).join("");
    const astars = Object.values(a.regions).reduce((s, r) => s + (r.stars || 0), 0);
    const cleared = Object.values(a.regions).filter((r) => r.clears > 0).length;
    $("stats").innerHTML = [
      ["완주한 지역", `${cleared} / ${REGIONS.length}`],
      ["모험 별", `★ ${astars}`],
      ["모은 수정", a.totalCrystals],
      ["모험 최고 점수", (a.bestRun || 0).toLocaleString("ko-KR")],
      ["최고 콤보", a.bestCombo || 0],
      ["석상 챌린지", d.bestStage ? `${d.bestStage}단계` : "-"],
    ]
      .map(([k, v]) => `<p><small>${k}</small><b>${v}</b></p>`)
      .join("");
  }

  /* ---------------- 설정 ---------------- */
  paintSettings(save) {
    const s = save.data.settings;
    const q = s.quality;
    const slider = (k, t, d) => `<label class="set-row"><span><b>${t}</b><small>${d}</small></span>
      <input type="range" class="vol" data-vol="${k}" min="0" max="100" step="5" value="${Math.round((s[k] ?? 0.8) * 100)}" aria-label="${t}" /></label>`;
    const toggle = (k, t, d) => `<label class="set-row"><span><b>${t}</b><small>${d}</small></span>
      <input type="checkbox" class="sw" data-set="${k}" ${s[k] ? "checked" : ""} /></label>`;
    $("set-list").innerHTML =
      slider("musicVol", "배경 음악 크기", "0 이면 음악이 꺼져요") +
      slider("sfxVol", "효과음 크기", "점프 · 수정 · 방망이 소리") +
      toggle("vibrate", "진동", "휴대폰에서 맞거나 칠 때 살짝 떨려요") +
      toggle("calm", "흔들림 · 번쩍임 줄이기", "화면 흔들림과 큰 빛 효과를 줄여요") +
      `<div class="set-row"><span><b>그래픽</b><small>느리면 '가볍게'를 골라요</small></span>
        <div class="seg" role="radiogroup">${[
          ["auto", "자동"],
          ["high", "좋게"],
          ["low", "가볍게"],
        ]
          .map(([v, l]) => `<button type="button" role="radio" aria-checked="${q === v}" class="${q === v ? "on" : ""}" data-q="${v}">${l}</button>`)
          .join("")}</div></div>
       <div class="set-row"><span><b>조작 연습 다시 하기</b><small>정글에서 이동 · 점프 · 대시 · 방망이를 다시 배워요</small></span><button type="button" class="btn-res small" id="set-tutor">다시 보기</button></div>
       <p class="set-note">PC: 이동 WASD · 방향키 / 점프 Space / 대시 Shift / 방망이 J · 마우스 클릭 / 일시정지 Esc<br/>기록 · 도감 · 설정은 이 기기에만 저장돼요. 결제나 뽑기는 없어요.</p>`;
    $("set-list").querySelectorAll("[data-set]").forEach((el) =>
      el.addEventListener("change", () => {
        this.g.audio.unlock();
        this.g.setSetting(el.dataset.set, el.checked);
      })
    );
    $("set-list").querySelectorAll("[data-vol]").forEach((el) =>
      el.addEventListener("input", () => {
        this.g.audio.unlock();
        this.g.setSetting(el.dataset.vol, Number(el.value) / 100);
        if (el.dataset.vol === "sfxVol") this.g.audio.play("gem", { n: 3 });
      })
    );
    $("set-list").querySelectorAll("[data-q]").forEach((el) =>
      el.addEventListener("click", () => {
        this.g.setSetting("quality", el.dataset.q);
        this.paintSettings(save);
      })
    );
    $("set-tutor").addEventListener("click", () => {
      save.data.tutorial = false;
      save.data.adv.tutorial = false;
      save.data.adv.puzzleSeen = false;
      save.save();
      this.toast("다음 모험에서 연습부터 해요!");
    });
  }

  /* ================================================================
   * 모험 화면
   * ============================================================== */
  advState(s) {
    this.body.dataset.adv = s;
  }
  advHud(on) {
    $("adv-hud").hidden = !on;
    this.body.classList.toggle("is-adv", on);
    if (!on) {
      $("combo").hidden = true;
      $("boss-bar").hidden = true;
      this.prompt(null);
    }
  }
  advSet(o) {
    if (o.region != null) $("adv-region").textContent = o.region;
    if (o.hearts != null) {
      const el = $("adv-hearts");
      let h = "";
      for (let i = 0; i < 3; i++) h += `<i class="${i < o.hearts ? "full" : "empty"}${i === o.broke ? " broke" : ""}" data-icon="${i < o.hearts ? "heart" : "heartEmpty"}"></i>`;
      el.innerHTML = h;
      el.setAttribute("aria-label", `하트 ${o.hearts}개`);
      paintIcons(el);
    }
    if (o.gems != null) {
      const el = $("adv-gems");
      el.textContent = o.gems;
      el.parentElement.classList.remove("pop");
      void el.offsetWidth;
      el.parentElement.classList.add("pop");
    }
    if (o.gemTotal != null) $("adv-gem-total").textContent = `/ ${o.gemTotal}`;
    if (o.prog != null) {
      const k = Math.max(0, Math.min(1, o.prog));
      $("adv-prog").style.transform = `scaleX(${k})`;
      $("adv-prog-wrap").setAttribute("aria-label", `진행 ${Math.round(k * 100)}%`);
    }
  }
  /** 연습 안내 말풍선 */
  prompt(text, step) {
    const el = $("adv-prompt");
    if (!text) {
      el.hidden = true;
      this.body.dataset.tut = "";
      return;
    }
    $("prompt-t").textContent = text;
    $("prompt-ic").dataset.step = step || "";
    el.hidden = false;
    this.body.dataset.tut = step || "";
  }
  bossBar(o) {
    const el = $("boss-bar");
    if (!o) {
      el.hidden = true;
      $("adv-prog-wrap").hidden = false;
      return;
    }
    el.hidden = false;
    $("adv-prog-wrap").hidden = true;
    $("boss-name").textContent = o.name;
    $("boss-hp").innerHTML = Array.from({ length: o.max }, (_, i) => `<b class="${i < o.hp ? "on" : ""}"></b>`).join("");
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }
  stageIntro(o) {
    const el = $("stage-intro");
    if (!o) {
      el.hidden = true;
      return;
    }
    $("si-k").textContent = `지역 ${o.no} · ${o.tier}`;
    $("si-h").textContent = o.name;
    $("si-en").textContent = o.en;
    $("si-t").textContent = o.intro;
    $("si-goals").innerHTML = o.goals.map((g) => `<li><i data-icon="star"></i>${esc(g)}</li>`).join("");
    $("si-boss").textContent = o.boss ? `마지막에 ${o.boss}가 기다려요!` : "";
    el.hidden = false;
    paintIcons(el);
    el.onclick = () => this.g.adv.beginPlay();
  }
  /** 모험 결과 (지역 완료 · 게임 오버 · 승리) */
  advResult(o) {
    const g = this.g;
    const R = o.region;
    const rs = o.rs;
    const kind = o.kind;
    $("ar-char").src = g.portraits.chars[g.hero.def.id] || "";
    $("ar-k").textContent = kind === "clear" ? `지역 ${R.no} 완료` : kind === "victory" ? "VICTORY" : "GAME OVER";
    $("ar-h").textContent = kind === "clear" ? `${R.name} 완주!` : kind === "victory" ? "드래곤 마스터!" : "괜찮아요, 다시 해 봐요!";
    const stars = o.res ? o.res.stars : 0;
    $("ar-stars").innerHTML = [0, 1, 2].map((i) => `<i data-icon="${i < stars ? "star" : "starEmpty"}" style="--d:${i * 0.18}s"></i>`).join("");
    $("ar-stars").hidden = kind === "over";
    const crit = [];
    if (o.res) {
      crit.push([true, "결승까지 완주"]);
      crit.push([o.res.gemOk, `수정 ${o.gemGoal}개 이상 (${rs.crystals}개)`]);
      crit.push([o.res.missOk, `실수 ${R.misses}번 이하 (${o.res.misses}번)`]);
    }
    $("ar-crit").innerHTML = crit.map(([ok, t]) => `<li class="${ok ? "ok" : ""}"><i data-icon="${ok ? "check" : "starEmpty"}"></i>${esc(t)}</li>`).join("");
    $("ar-crit").hidden = !crit.length;
    const best = o.best || {};
    const rows = [
      [kind === "over" ? "도달 지역" : "완료 지역", `${R.no} · ${R.name}`],
      ["수집한 수정", `${rs.crystals}${o.gemTotal ? ` / ${o.gemTotal}` : ""}${rs.bigs ? ` · 큰 수정 ${rs.bigs}` : ""}`],
      ["완료 시간", kind === "over" ? "-" : fmtTime(rs.time) + (best.newTime ? " · 최고!" : "")],
      ["최고 콤보", rs.bestCombo],
      ["이번 점수", o.run.score.toLocaleString("ko-KR") + (best.newBest && kind !== "over" ? " · 최고!" : "")],
      ["내 최고 기록", best.bestScore ? `${best.bestScore.toLocaleString("ko-KR")}점 · ★${best.stars} · ${fmtTime(best.bestTime)}` : "아직 없음"],
      ["얻은 별 (이번 모험)", `★ ${o.run.stars}`],
    ];
    $("ar-stats").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    const rw = o.rewards || [];
    $("ar-unlocks").innerHTML = rw.length
      ? `<p class="ru-h">새로 얻었어요!</p>` + rw.map((u) => `<span class="ru${u.kind === "badge" ? " badge-r" + (u.gold ? " gold" : "") : ""}">${u.img ? `<img src="${u.img}" alt="" />` : `<i class="bd on${u.gold ? " gold" : ""}">${u.gold ? "★" : R.no}</i>`}${esc(u.name)}</span>`).join("")
      : "";
    // 버튼
    const main = $("ar-main");
    const b1 = $("ar-b1");
    const b2 = $("ar-b2");
    const set = (el, icon, label, fn) => {
      el.innerHTML = `<span data-icon="${icon}"></span>${label}`;
      el.onclick = (e) => {
        e.preventDefault();
        g.audio.play("tap");
        fn();
      };
    };
    if (kind === "clear") {
      if (o.hasNext) set(main, "next", "다음 지역", () => g.advNext());
      else set(main, "map", "지도로", () => g.advMap());
      set(b1, "retry", "다시 하기", () => g.advRetry());
      set(b2, "map", "지도", () => g.advMap());
    } else if (kind === "over") {
      set(main, "retry", "다시 도전", () => g.advRetry());
      set(b1, "paw", "캐릭터 선택", () => g.advChar());
      set(b2, "map", "지도", () => g.advMap());
    } else {
      set(main, "map", "지도로", () => g.advMap());
      set(b1, "paw", "캐릭터", () => g.advChar());
      set(b2, "retry", "다시 하기", () => g.advRetry());
    }
    paintIcons($("adv-result"));
    this.show("adv-result");
    // 랭킹: 모험이 끝났을 때만 (게임 오버 · 승리)
    const slot = $("ar-rank");
    slot.innerHTML = "";
    if ((kind === "over" || kind === "victory") && window.TodayGameRank) {
      try {
        TodayGameRank.mount({ gameId: "dragon-statue", gameTitle: "드래곤 석상 대작전 · 모험", formParent: slot });
        TodayGameRank.open(o.run.score, { label: `${o.run.score.toLocaleString("ko-KR")}점` });
      } catch (e) {
        console.warn("랭킹 연결 실패", e);
      }
    }
  }

  /* ---------------- 오늘의 도전 ---------------- */
  paintDaily(plan, rec) {
    $("daily-date").textContent = plan.day.replace(/-/g, ".");
    $("daily-card").innerHTML = `
      <p class="dc-k">매일 바뀌는 10단계 코스</p>
      <h3>오늘의 드래곤 석상 10판</h3>
      <p class="dc-t">오늘은 누구나 같은 문제가 나와요. 하트 3개로 10판을 모두 깨 보세요! 기록은 일반 모험과 따로 저장돼요.</p>
      <div class="dc-route">${plan.stages.map((n, i) => `<i class="${i < (rec.stage || 0) ? "done" : ""}">${i + 1}</i>`).join("")}</div>
      <div class="dc-rec">
        <p><small>오늘 최고 점수</small><b>${(rec.best || 0).toLocaleString("ko-KR")}</b></p>
        <p><small>최고 단계</small><b>${rec.stage || 0} / 10</b></p>
        <p><small>성공률</small><b>${rec.hits ? Math.round((rec.correct / rec.hits) * 100) + "%" : "-"}</b></p>
        <p><small>최고 연속 정답</small><b>${rec.combo || 0}</b></p>
        <p><small>도전 횟수</small><b>${rec.plays || 0}</b></p>
        <p><small>완주</small><b>${rec.done ? "성공!" : "아직"}</b></p>
      </div>
      <p class="dc-note">오늘의 도전 기록은 일반 모험 기록과 따로 저장돼요. 랭킹에 이름을 올리면 '오늘의 도전' 랭킹에만 들어가요.</p>
      <button type="button" class="btn-main" id="daily-go"><span class="ic" data-icon="play"></span><span class="txt"><b>도전하기</b><small>캐릭터를 골라요</small></span></button>`;
    paintIcons($("daily-card"));
    $("daily-go").addEventListener("click", () => {
      this.g.audio.unlock();
      this.g.audio.play("tap");
      this.g.openSelect("daily");
    });
  }

  /* ---------------- 규칙 카드 ---------------- */
  showRule(spec, label) {
    const info = KIND_INFO[spec.kind];
    $("rule-k").textContent = label;
    $("rule-h").textContent = info.title;
    $("rule-t").textContent = info.rule;
    const gold = spec.kind === "gold";
    let pic = "";
    if (spec.kind === "multi") pic = [70, 54, 70, 54, 70].map((h, i) => statueSvg(h, i % 2 === 1, false)).join("");
    else if (spec.kind === "giant") pic = [96, 96, 74].map((h, i) => statueSvg(h, i === 2, false)).join("");
    else if (spec.kind === "boss") pic = `${statueSvg(54, false)}${statueSvg(110, false, true).replace('class="rs"', 'class="rs boss"')}${statueSvg(42, true)}`;
    else pic = [62, 62, 84, 62].map((h, i) => statueSvg(h, i === 2, gold)).join("");
    $("rule-pic").innerHTML = pic;
    const notes = [];
    if (spec.safe) notes.push("보너스 판은 틀려도 하트가 줄지 않아요 (시간만 2초 줄어요)");
    else notes.push("틀리면 하트가 1개 줄어요 · 시간 안에 찾아요");
    if (spec.kind === "normal" && spec.mix > 1) notes.push("모양이 다른 석상도 섞여 있어요. 모양 말고 '크기'를 봐요!");
    if (spec.kind === "boss") notes.push("봉인 3개를 모두 깨면 보스 통과! 하트 1개를 돌려받아요");
    notes.push("뒤에 있는 석상도 앞 석상과 같은 크기로 보이게 맞춰 두었어요");
    $("rule-notes").innerHTML = notes.map((n) => `<li>${n}</li>`).join("");
    this.show("rule");
  }

  /* ---------------- HUD ---------------- */
  setStage(label, area) {
    $("hud-stage").textContent = label;
    $("hud-area").textContent = area;
  }
  setGoal(t) {
    $("hud-goal").textContent = t;
  }
  setHearts(n, max = 3, broke = -1) {
    const el = $("hearts");
    let h = "";
    for (let i = 0; i < max; i++) h += `<i class="${i < n ? "full" : "empty"}${i === broke ? " broke" : ""}" data-icon="${i < n ? "heart" : "heartEmpty"}"></i>`;
    el.innerHTML = h;
    el.setAttribute("aria-label", `하트 ${n}개`);
    paintIcons(el);
  }
  setScore(n) {
    const el = $("hud-score");
    el.textContent = n.toLocaleString("ko-KR");
    el.parentElement.classList.remove("pop");
    void el.offsetWidth;
    el.parentElement.classList.add("pop");
  }
  setTimer(t, max, live = true) {
    const k = Math.max(0, Math.min(1, t / max));
    $("timer-fill").style.transform = `scaleX(${k})`;
    $("timer-t").textContent = Math.ceil(Math.max(0, t));
    $("timer").classList.toggle("low", live && t <= 5);
  }
  setHints(n, usable) {
    $("hint-n").textContent = n;
    $("hint-btn").disabled = !usable || n <= 0;
  }
  combo(n, msg) {
    const el = $("combo");
    if (n < 2) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    $("combo-n").textContent = n;
    $("combo-msg").textContent = msg || "";
    el.classList.remove("pop", "big");
    void el.offsetWidth;
    el.classList.add("pop");
    if (n >= 5) el.classList.add("big");
  }
  seals(total, broken) {
    const el = $("seals");
    if (!total) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < broken ? "gone" : ""}"></i>`).join("");
    el.setAttribute("aria-label", `보스 봉인 ${total - broken}개 남음`);
  }

  /* ---------------- 알림 ---------------- */
  toast(text, kind = "", dur = 1.6) {
    const el = $("toast");
    el.textContent = text;
    el.className = `toast ${kind}`;
    el.hidden = false;
    this.toastT = dur;
  }
  banner(k, h, s = "", dur = 1.6, kind = "") {
    $("banner-k").textContent = k;
    $("banner-h").textContent = h;
    $("banner-s").textContent = s;
    const el = $("banner");
    el.className = `banner ${kind}`;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add("show");
    this.bannerT = dur;
  }
  hideBanner() {
    $("banner").hidden = true;
    this.bannerT = 0;
  }
  count(text) {
    const el = $("count");
    if (text == null) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = `<b>${text}</b>`;
  }
  floater(text, x, y, cls = "") {
    const el = document.createElement("p");
    el.className = `floater ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $("floaters").appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  pointer(x, y) {
    const el = $("pointer");
    if (x == null) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
  tutor(text) {
    if (text == null) {
      $("tutor").hidden = true;
      return;
    }
    $("tutor").hidden = false;
    $("tutor-t").textContent = text;
  }
  fade(on) {
    $("fade").classList.toggle("on", on);
  }
  flash(kind) {
    const f = $("field");
    f.classList.remove("flash-good", "flash-bad");
    void f.offsetWidth;
    f.classList.add(kind === "good" ? "flash-good" : "flash-bad");
  }
  showReward({ kicker, title, text, img }) {
    $("reward-k").textContent = kicker;
    $("reward-h").textContent = title;
    $("reward-t").textContent = text;
    $("reward-pic").innerHTML = img ? `<img src="${img}" alt="" />` : "";
    this.show("reward");
  }

  /* ---------------- 결과 ---------------- */
  showResult(r) {
    $("res-k").textContent = r.kicker;
    $("res-h").textContent = r.title;
    $("res-char").src = this.g.portraits.chars[r.char] || "";
    $("res-stars").innerHTML = [0, 1, 2].map((i) => `<i data-icon="${i < r.grade ? "star" : "starEmpty"}" style="--d:${i * 0.18}s"></i>`).join("");
    $("res-stats").innerHTML = [
      [r.daily ? "도전 판" : "도달 단계", r.stageLabel],
      ["점수", r.score.toLocaleString("ko-KR") + (r.newBest ? " · 최고!" : "")],
      ["최고 콤보", r.bestCombo],
      ["정확도", r.hits ? `${r.acc}%` : "-"],
      ["얻은 별", `★ ${r.stars}`],
      [r.daily ? "오늘 최고 기록" : "내 최고 기록", r.best],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
    $("res-unlocks").innerHTML = r.unlocks.length ? `<p class="ru-h">새로 얻었어요!</p>` + r.unlocks.map((u) => `<span class="ru"><img src="${u.img || ""}" alt="" />${esc(u.name)}</span>`).join("") : "";
    $("res-continue").hidden = !r.canContinue;
    $("res-retry").hidden = !!r.canContinue;
    paintIcons($("result"));
    this.show("result");
  }
}
export { ICONS };
