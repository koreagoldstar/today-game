/*
 * 화면 전환 · HUD · 입력 (마우스 · 키보드 · 터치)
 *  게임 규칙은 game.js, 저장은 save.js
 */
import { THREE } from "./kit.js";
import { setTexQuality } from "./textures.js";
import { Game, ZOOM_MIN, ZOOM_MAX } from "./game.js";
import { Save } from "./save.js";
import { Sfx } from "./sfx.js";
import { WORLDS, TYPES, LOOKS, missionById, missionsOf, starText, MISSIONS } from "./missions.js";
import { Actor, look as makeLook } from "./actors.js";

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const SCREENS = ["title", "worlds", "missions", "brief", "pause", "result", "help", "settings", "stats"];

function pickQuality(pref) {
  if (pref && pref !== "auto") return pref;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (coarse) return cores >= 6 && mem >= 4 ? "mid" : "low";
  return mem >= 6 && cores >= 6 ? "high" : "mid";
}

/** 브리핑 표적 사진 (작은 3D 장면) */
class Portrait {
  constructor(canvasEl) {
    this.c = canvasEl;
    this.r = null;
  }
  ensure() {
    if (this.r) return true;
    try {
      this.r = new THREE.WebGLRenderer({ canvas: this.c, antialias: true, alpha: true });
    } catch (_) {
      return false;
    }
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.setSize(360, 460, false);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x3a3530, 1.4));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.8);
    key.position.set(-1.2, 2.2, 2.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fdcff, 1.6);
    rim.position.set(1.8, 1.4, -1.6);
    this.scene.add(rim);
    this.cam = new THREE.PerspectiveCamera(24, 360 / 460, 0.1, 20);
    this.cam.position.set(0, 1.46, 2.4);
    this.cam.lookAt(0, 1.3, 0);
    return true;
  }
  show(lookKey, seed, over) {
    if (!this.ensure()) return;
    if (this.actor) this.scene.remove(this.actor.root);
    const def = LOOKS[lookKey];
    const L = makeLook(def.kind, seed, { ...(def.over || {}), ...(over || {}) });
    this.actor = new Actor(L, {});
    this.scene.add(this.actor.root);
    this.t = 0;
    this.on = true;
    this.last = performance.now();
    const step = (now) => {
      if (!this.on) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.actor.update(dt);
      this.actor.root.rotation.y = Math.sin(this.t * 0.7) * 0.6;
      this.r.render(this.scene, this.cam);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  stop() {
    this.on = false;
  }
}

export async function startApp({ progress }) {
  const save = new Save();
  const sfx = new Sfx();
  const quality = pickQuality(save.d.settings.quality);
  setTexQuality(quality);
  progress(0.3, "도시를 그리는 중…");
  await new Promise((r) => setTimeout(r, 30));
  const game = new Game({ canvas: $("game"), quality });
  window.OneShotElite = { game, save, MISSIONS };
  const S = save.d.settings;
  const applySettings = () => {
    game.settings.sens = S.sens;
    game.settings.invert = S.invert;
    game.settings.swayScale = S.easy ? 0.45 : 1;
    sfx.setVolume(S.sound);
  };
  applySettings();
  await game.backdrop();
  progress(0.9, "거의 다 됐어요…");
  game.engine.render();
  game.loop();
  addEventListener("resize", () => game.engine.resize());
  addEventListener("orientationchange", () => setTimeout(() => game.engine.resize(), 200));

  const canvas = $("game");
  const portrait = new Portrait($("b-portrait"));
  const touchMode = () => matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

  /* ---------- 화면 전환 ---------- */
  let backTo = "title";
  let overlayFrom = null;
  function show(id) {
    for (const s of SCREENS) $(s).hidden = s !== id;
    document.body.classList.toggle("is-title", id === "title");
  }
  function paintTitle() {
    const total = save.totalStars();
    $("t-total").textContent = total ? `★ ${total} / ${MISSIONS.length * 3}  ·  총점 ${save.totalScore().toLocaleString("ko-KR")}` : "";
  }
  function openOverlay(id) {
    overlayFrom = SCREENS.find((s) => !$(s).hidden) || null;
    show(id);
  }
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => {
      sfx.ui();
      if (overlayFrom) show(overlayFrom);
      else show("title");
      overlayFrom = null;
    })
  );
  document.querySelectorAll("[data-back]").forEach((b) =>
    b.addEventListener("click", () => {
      sfx.ui();
      const to = b.dataset.back;
      if (to === "worlds") paintWorlds();
      if (to === "title") paintTitle();
      show(to);
    })
  );

  /* ---------- 월드 ---------- */
  function paintWorlds() {
    const list = $("world-list");
    list.innerHTML = "";
    const total = save.totalStars();
    $("worlds-stars").textContent = `★ ${total} / ${MISSIONS.length * 3}`;
    for (const w of WORLDS) {
      const b = document.createElement("button");
      b.type = "button";
      const open = save.worldUnlocked(w.id);
      b.className = `w-card${open ? "" : " locked"}`;
      b.style.setProperty("--acc", w.accent);
      b.style.backgroundImage = `url(assets/world-${w.id}.webp)`;
      b.setAttribute("aria-disabled", open ? "false" : "true");
      b.innerHTML = `<span class="w-n">WORLD ${w.id}</span><span class="w-en">${w.en}</span><span class="w-ko">${w.ko}</span><span class="w-st">★ ${save.worldStars(w.id)} / 30</span>${open ? "" : `<span class="w-lock">🔒 별 ${w.need}개를 모으면 열려요 (지금 ${total}개)</span>`}`;
      b.addEventListener("click", () => {
        if (!open) {
          toast(`별 ${w.need}개를 모으면 열려요`);
          return;
        }
        sfx.ui();
        paintMissions(w.id);
        show("missions");
      });
      list.appendChild(b);
    }
  }

  /* ---------- 미션 ---------- */
  let curWorld = 1;
  function paintMissions(wid) {
    curWorld = wid;
    const w = WORLDS.find((x) => x.id === wid);
    $("missions-h").textContent = `${w.en} · ${w.ko}`;
    $("missions-stars").textContent = `★ ${save.worldStars(wid)} / 30`;
    $("m-blurb").textContent = w.blurb;
    const list = $("mission-list");
    list.innerHTML = "";
    for (const m of missionsOf(wid)) {
      const T = TYPES[m.t];
      const open = save.missionUnlocked(m);
      const c = save.countOf(m.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `m-tile${open ? "" : " locked"}`;
      b.style.setProperty("--tc", T.color);
      const stars = [0, 1, 2].map((i) => (i < c ? "<b>★</b>" : "★")).join("");
      const best = save.d.best[m.id];
      b.innerHTML = `<span class="m-n">${m.w}-${m.n}</span><span class="m-type">${T.en}</span><span class="m-name">${open ? m.title : "🔒 " + (m.t === "bonus" ? "미션 9개를 깨면 열려요" : "앞 미션을 깨면 열려요")}</span>${best ? `<span class="m-best">BEST ${best.toLocaleString("ko-KR")}</span>` : ""}<span class="m-st">${stars}</span>`;
      b.addEventListener("click", () => {
        if (!open) return;
        sfx.ui();
        openBrief(m.id);
      });
      list.appendChild(b);
    }
  }

  /* ---------- 브리핑 ---------- */
  let curMission = null;
  function openBrief(id) {
    const m = missionById(id);
    curMission = id;
    const T = TYPES[m.t];
    $("b-type").textContent = `${T.en} · ${T.ko}`;
    $("b-id").textContent = `${WORLDS[m.w - 1].en} ${m.id}`;
    $("b-h").textContent = m.title;
    $("b-text").textContent = m.brief;
    $("b-ammo").textContent = m.ammo;
    $("b-time").textContent = fmtTime(m.time);
    const cnt = m.boards || m.need || (m.targets || []).filter((t) => !t.optional).length;
    $("b-count").textContent = cnt;
    const tags = $("b-tags");
    tags.innerHTML = "";
    const first = (m.targets || [])[0];
    if (first) {
      for (const t of LOOKS[first.look].tags) {
        const li = document.createElement("li");
        li.textContent = t;
        tags.appendChild(li);
      }
      if (first.vest) {
        const li = document.createElement("li");
        li.textContent = "방탄조끼 · 머리만 통함";
        tags.appendChild(li);
      }
      $("b-photo-k").textContent = "TARGET";
      portrait.show(first.look, m.n * 3 + 5, first.vest ? { vest: "#2f3424" } : null);
    } else {
      portrait.stop();
      const g2 = $("b-photo-k");
      g2.textContent = "BONUS";
      const li = document.createElement("li");
      li.textContent = "금빛 과녁";
      tags.appendChild(li);
    }
    const stars = $("b-stars");
    stars.innerHTML = "";
    const have = save.starsOf(id);
    starText(m).forEach((t, i) => {
      const li = document.createElement("li");
      li.textContent = t;
      if (have[i]) li.className = "on";
      stars.appendChild(li);
    });
    show("brief");
  }
  $("b-back").addEventListener("click", () => {
    sfx.ui();
    portrait.stop();
    paintMissions(curWorld);
    show("missions");
  });
  $("b-go").addEventListener("click", () => {
    sfx.unlock();
    sfx.uiGo();
    launch(curMission);
  });

  /* ---------- 미션 시작 ---------- */
  async function launch(id) {
    const m = missionById(id);
    portrait.stop();
    curMission = id;
    curWorld = m.w;
    show(null);
    $("load-k").textContent = WORLDS[m.w - 1].en;
    $("loading").hidden = false;
    hudOff();
    $("feed").innerHTML = "";
    $("marks").innerHTML = "";
    await new Promise((r) => setTimeout(r, 40));
    await game.start(id);
    $("loading").hidden = true;
    hudOn(m);
    game.begin();
    sfx.ambience(m.env.atmos === "storm" ? "rain" : m.env.map === "harbor" ? "harbor" : "wind");
    canvas.style.filter = "";
    tutStart(m);
    if (m.env.night) toast(touchMode() ? "어두우면 투시 버튼을 눌러 봐요" : "어두우면 N 키로 야간 투시!");
  }
  function hudOn(m) {
    $("hud").hidden = false;
    $("ammo").hidden = false;
    $("dot").hidden = false;
    const T = TYPES[m.t];
    $("h-mis").textContent = `${m.id}  ${T.en}`;
    paintAmmo();
    if (touchMode()) {
      $("touch").hidden = false;
      $("keys").hidden = true;
      $("t-nv").hidden = !m.env.night;
    } else {
      $("touch").hidden = true;
      $("keys").hidden = false;
      setTimeout(() => ($("keys").hidden = true), 9000);
    }
  }
  function hudOff() {
    for (const id of ["hud", "ammo", "dot", "touch", "keys", "tut", "toast"]) $(id).hidden = true;
    $("scope").hidden = true;
    $("t-zoom").hidden = true;
    sfx.heart(false);
    releaseLock();
  }
  function paintAmmo() {
    const m = game.mission;
    if (!m) return;
    const box = $("ammo");
    const left = game.ammo;
    if (box.childElementCount !== m.ammo) {
      box.innerHTML = "";
      for (let i = 0; i < m.ammo; i++) box.appendChild(document.createElement("i"));
    }
    [...box.children].forEach((el, i) => el.classList.toggle("used", i >= left));
  }

  /* ---------- 튜토리얼 (1-1) ---------- */
  let tutStep = -1;
  const TUT = () =>
    touchMode()
      ? ["화면을 <em>끌어서</em> 건너편 건물을 둘러봐요.", "<em>스코프</em> 버튼으로 확대해요. 옆 막대로 배율을 바꿔요.", "빨간 넥타이를 찾으면 <em>숨참기</em>를 누른 채 <em>발사</em>!"]
      : ["<em>화면을 클릭</em>한 뒤 마우스로 건너편 건물을 둘러봐요.", "<em>우클릭</em>으로 스코프! <em>휠</em>로 배율을 바꿔요.", "빨간 넥타이를 찾으면 <em>Shift</em>로 숨을 참고 <em>좌클릭</em>!"];
  function tutStart(m) {
    tutStep = -1;
    $("tut").hidden = true;
    if (m.tutorial && !save.d.tutorial) tutGo(0);
  }
  function tutGo(n) {
    tutStep = n;
    const t = TUT();
    if (n >= t.length) {
      $("tut").hidden = true;
      tutStep = -1;
      save.d.tutorial = true;
      save.write();
      return;
    }
    $("tut").innerHTML = t[n];
    $("tut").hidden = false;
  }
  let tutMoved = 0;

  /* ---------- 알림 ---------- */
  let toastT = 0;
  function toast(t) {
    const el = $("toast");
    el.textContent = t;
    el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (el.hidden = true), 2200);
  }
  function feed(html, cls = "") {
    const box = $("feed");
    const d = document.createElement("div");
    d.className = `fd ${cls}`;
    d.innerHTML = html;
    box.appendChild(d);
    setTimeout(() => d.remove(), 2500);
    while (box.childElementCount > 3) box.firstChild.remove();
  }

  /* ---------- 게임 이벤트 ---------- */
  const flashEl = $("flash-s");
  function flash() {
    flashEl.style.transition = "none";
    flashEl.style.opacity = game.scoped ? "0.8" : "0.25";
    requestAnimationFrame(() => {
      flashEl.style.transition = "opacity 0.16s";
      flashEl.style.opacity = "0";
    });
  }
  game
    .on("fire", () => {
      sfx.shot();
      flash();
      paintAmmo();
      const sc = $("scope");
      sc.classList.remove("kick");
      void sc.offsetWidth;
      sc.classList.add("kick");
      if (navigator.vibrate && touchMode()) navigator.vibrate(30);
      if (tutStep === 2) tutGo(3);
    })
    .on("bolt", () => sfx.bolt())
    .on("dry", () => {
      sfx.dry();
      toast("총알이 없어요");
    })
    .on("scope", (on) => {
      $("scope").hidden = !on;
      $("dot").hidden = on;
      $("t-zoom").hidden = !on;
      $("t-scope").classList.toggle("on", on);
      sfx.scope(on);
      syncZoom();
      if (on && tutStep === 1) tutGo(2);
    })
    .on("feed", (f) => {
      const tags = f.tags && f.tags.length ? `<small>${f.tags.join(" · ")}</small>` : "";
      const pts = f.pts ? ` +${f.pts}` : "";
      feed(`<b>${f.en}${pts}</b><span>${f.ko}${f.d ? ` · ${f.d}m` : ""}</span>${tags}`, f.part === "head" ? "head" : f.bad ? "bad" : "");
    })
    .on("hit", ({ part }) => {
      if (part === "head") sfx.headshot();
      else sfx.hit();
      sfx.impactSoft();
      $("h-score").textContent = game.score.toLocaleString("ko-KR");
    })
    .on("armor", () => sfx.armor())
    .on("miss", () => {
      sfx.impactWall();
      feed("<b>MISS</b>", "bad");
    })
    .on("alarm", () => sfx.alarm())
    .on("slow", ({ final }) => {
      sfx.slow();
      $("vig-slow").classList.add("on");
      setTimeout(() => $("vig-slow").classList.remove("on"), final ? 1500 : 800);
    })
    .on("breath", (on) => {
      if (on) sfx.breathIn();
      else sfx.breathOut();
      sfx.heart(on);
    })
    .on("gasp", () => {
      sfx.heart(false);
      sfx.gasp();
    })
    .on("spot", () => sfx.spot())
    .on("toast", (t) => toast(t))
    .on("nv", (on) => {
      $("t-nv").classList.toggle("on", on);
      // 낮은 그래픽은 화면 효과가 없어 CSS 로 초록빛
      if (!game.engine.post) canvas.style.filter = on ? "grayscale(1) sepia(1) hue-rotate(68deg) saturate(3) brightness(1.7)" : "";
      toast(on ? "야간 투시 켬" : "야간 투시 끔");
      sfx.ui();
    })
    .on("hint", (a) => {
      hintActor = a;
      hintT = 3.2;
      toast("표적 쪽을 알려 줘요 (이 판은 시간 별을 못 받아요)");
      sfx.spot();
    })
    .on("end", (res) => onEnd(res));

  let hintActor = null;
  let hintT = 0;

  /* ---------- 결과 ---------- */
  function onEnd(res) {
    hudOff();
    sfx.stopAmbience();
    const rec = save.record(res, res.ok ? res.bestD || 0 : 0);
    const card = document.querySelector(".r-card");
    card.classList.toggle("fail", !res.ok);
    $("r-k").textContent = res.ok ? "MISSION COMPLETE" : "MISSION FAILED";
    $("r-h").textContent = res.ok ? "임무 성공" : "임무 실패";
    const why = $("r-why");
    why.hidden = res.ok;
    why.textContent = res.reason || "";
    const st = $("r-stars");
    st.innerHTML = "";
    res.stars.forEach((on, i) => {
      const s = document.createElement("span");
      s.textContent = "★";
      if (on) {
        s.className = "on";
        s.style.animationDelay = `${0.25 + i * 0.22}s`;
        setTimeout(() => sfx.star(i), 250 + i * 220);
      }
      st.appendChild(s);
    });
    $("r-score").textContent = res.score.toLocaleString("ko-KR");
    const best = save.d.best[res.id] || 0;
    $("r-best").textContent = res.ok ? (rec.newBest ? "새 최고 기록!" : `최고 ${best.toLocaleString("ko-KR")}`) : "";
    const rows = [
      ["정확도", `${res.accuracy}%`],
      ["걸린 시간", fmtTime(res.time)],
      ["사용한 총알", `${res.shots}발`],
      ["헤드샷", `${res.heads}`],
    ];
    if (res.ok) rows.push(["표적 점수", res.breakdown.kills.toLocaleString("ko-KR")], ["시간 보너스", `+${res.breakdown.time}`], ["남은 총알", `+${res.breakdown.ammo}`], ["별 보너스", `+${res.breakdown.stars}`]);
    $("r-grid").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    const nw = [];
    for (const w of rec.unlockedWorlds) nw.push(`새 월드 열림: ${WORLDS[w - 1].en}`);
    if (rec.unlockedBonus) nw.push("보너스 미션이 열렸어요!");
    $("r-new").hidden = !nw.length;
    $("r-new").textContent = nw.join(" · ");
    // 다음 미션
    const m = res.mission;
    const list = missionsOf(m.w);
    const next = list.find((x) => x.n === m.n + 1);
    const nextOpen = res.ok && next && save.missionUnlocked(next);
    const worldNext = res.ok && !next && WORLDS[m.w] && save.worldUnlocked(m.w + 1);
    const nb = $("r-next");
    nb.hidden = !(nextOpen || worldNext || !res.ok);
    nb.textContent = nextOpen ? "다음 미션" : worldNext ? "다음 월드" : "다시 도전";
    nb.onclick = () => {
      sfx.unlock();
      sfx.uiGo();
      if (nextOpen) openBrief(next.id);
      else if (worldNext) {
        paintMissions(m.w + 1);
        show("missions");
      } else launch(res.id);
    };
    // 순위 (총점 · 직접 이름을 적을 때만 보냄)
    const slot = $("r-rank");
    slot.innerHTML = "";
    if (res.ok && window.TodayGameRank) {
      try {
        TodayGameRank.mount({ gameId: "oneshot-elite", gameTitle: "ONE SHOT 원샷 엘리트", formParent: slot });
        const tot = save.totalScore();
        TodayGameRank.open(tot, { label: `총점 ${tot.toLocaleString("ko-KR")}점` });
      } catch (_) {
        /* 순위 없이도 진행 */
      }
    }
    show("result");
    if (res.ok) sfx.win();
    else sfx.lose();
    // 메뉴 배경으로 돌아가지 않고 그 자리 화면을 뒤에 둠
  }
  $("r-retry").addEventListener("click", () => {
    sfx.unlock();
    sfx.uiGo();
    launch(curMission);
  });
  $("r-menu").addEventListener("click", () => {
    sfx.ui();
    paintMissions(curWorld);
    show("missions");
  });

  /* ---------- 일시정지 ---------- */
  function pauseOn() {
    if (game.state !== "play") return;
    game.pause(true);
    sfx.heart(false);
    releaseLock();
    show("pause");
  }
  function pauseOff() {
    show(null);
    game.pause(false);
    sfx.unlock();
    if (!touchMode()) toast("화면을 클릭하면 다시 조준해요");
  }
  $("pause-btn").addEventListener("click", pauseOn);
  $("p-resume").addEventListener("click", pauseOff);
  $("p-retry").addEventListener("click", () => launch(curMission));
  $("p-help").addEventListener("click", () => openOverlay("help"));
  $("p-set").addEventListener("click", () => openSettings());
  $("p-quit").addEventListener("click", () => {
    hudOff();
    sfx.stopAmbience();
    game.state = "ready";
    paintMissions(curWorld);
    show("missions");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseOn();
  });

  /* ---------- 설정 · 기록 ---------- */
  function openSettings() {
    $("set-sens").value = S.sens;
    $("set-sound").value = S.sound;
    $("set-invert").checked = S.invert;
    $("set-easy").checked = S.easy;
    $("set-quality").value = S.quality;
    $("set-note").textContent = `지금 그래픽: ${{ high: "높음", mid: "보통", low: "낮음" }[game.engine.quality]}. 그래픽을 바꾸면 페이지를 다시 불러와요.`;
    openOverlay("settings");
  }
  const setChange = () => {
    S.sens = +$("set-sens").value;
    S.sound = +$("set-sound").value;
    S.invert = $("set-invert").checked;
    S.easy = $("set-easy").checked;
    applySettings();
    save.write();
  };
  for (const id of ["set-sens", "set-sound", "set-invert", "set-easy"]) $(id).addEventListener("input", setChange);
  $("set-quality").addEventListener("change", (e) => {
    S.quality = e.target.value;
    save.write();
    if (pickQuality(S.quality) !== game.engine.quality && !(game.state === "play" || game.state === "pause")) location.reload();
    else $("set-note").textContent = "다음에 페이지를 열 때 적용돼요.";
  });
  $("set-reset").addEventListener("click", () => {
    if (confirm("별 · 점수 · 통계를 모두 지울까요? 설정은 남아요.")) {
      save.reset();
      paintTitle();
      toast("기록을 지웠어요");
    }
  });
  $("btn-play").addEventListener("click", () => {
    sfx.unlock();
    sfx.uiGo();
    paintWorlds();
    show("worlds");
  });
  $("btn-help").addEventListener("click", () => {
    sfx.unlock();
    sfx.ui();
    openOverlay("help");
  });
  $("btn-set").addEventListener("click", () => {
    sfx.unlock();
    sfx.ui();
    openSettings();
  });
  $("btn-stats").addEventListener("click", () => {
    sfx.unlock();
    sfx.ui();
    const s = save.d.stats;
    const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
    const rows = [
      ["모은 별", `${save.totalStars()} / ${MISSIONS.length * 3}`],
      ["총점", save.totalScore().toLocaleString("ko-KR")],
      ["성공한 작전", `${s.missions}번`],
      ["실패한 작전", `${s.fails}번`],
      ["쏜 총알", `${s.shots}발`],
      ["명중", `${s.hits}발`],
      ["헤드샷", `${s.heads}번`],
      ["정확도", `${acc}%`],
      ["가장 먼 명중", `${Math.round(s.longest)} m`],
      ["플레이 시간", fmtTime(s.time)],
    ];
    $("st-grid").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    openOverlay("stats");
  });

  /* ---------- 스코프 눈금 ---------- */
  const mil = $("r-mil");
  let milHtml = "";
  for (let i = 1; i <= 8; i++) {
    const d = 46 + i * 44;
    milHtml += `<circle cx="${d}" cy="0" r="3.2"/><circle cx="-${d}" cy="0" r="3.2"/><circle cx="0" cy="-${d}" r="3.2"/><circle cx="0" cy="${d}" r="3.2"/>`;
    if (i % 2 === 0) milHtml += `<line x1="${d}" y1="-12" x2="${d}" y2="12"/><line x1="-${d}" y1="-12" x2="-${d}" y2="12"/><line x1="-12" y1="${d}" x2="12" y2="${d}"/>`;
  }
  mil.innerHTML = milHtml;

  /* ---------- 입력: 마우스 ---------- */
  const field = $("field");
  let locked = false;
  const isPointerLockOK = () => !touchMode() && canvas.requestPointerLock;
  function lockPointer() {
    if (!isPointerLockOK() || locked) return;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {
      /* 지원 안 함 */
    }
  }
  function releaseLock() {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }
  document.addEventListener("pointerlockchange", () => {
    const was = locked;
    locked = document.pointerLockElement === canvas;
    // Esc 로 마우스가 풀리면 일시정지
    if (was && !locked && game.state === "play" && !game.ended) pauseOn();
  });
  addEventListener("mousemove", (e) => {
    if (game.state !== "play") return;
    if (locked) {
      game.lookBy(e.movementX, e.movementY, "mouse");
      noteMove(Math.abs(e.movementX) + Math.abs(e.movementY));
    }
  });
  function noteMove(n) {
    if (tutStep === 0) {
      tutMoved += n;
      if (tutMoved > 260) tutGo(1);
    }
  }

  // 끌기 (터치 · 마우스가 안 잡힌 경우)
  const drags = new Map();
  canvas.addEventListener("pointerdown", (e) => {
    if (game.state !== "play") return;
    sfx.unlock();
    if (e.pointerType === "mouse") {
      if (e.button === 2) {
        e.preventDefault();
        game.toggleScope();
        return;
      }
      if (e.button !== 0) return;
      if (isPointerLockOK() && !locked) {
        lockPointer();
        return;
      }
      if (locked) {
        game.fire();
        return;
      }
    }
    drags.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* 없어도 됨 */
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const d = drags.get(e.pointerId);
    if (!d || game.state !== "play") return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    game.lookBy(dx, dy, "touch");
    noteMove(Math.abs(dx) + Math.abs(dy));
  });
  const endDrag = (e) => {
    const d = drags.get(e.pointerId);
    drags.delete(e.pointerId);
    // 마우스를 못 잡는 환경: 끌지 않고 누르면 발사
    if (d && e.pointerType === "mouse" && d.moved < 6 && !isPointerLockOK()) game.fire();
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  field.addEventListener("contextmenu", (e) => e.preventDefault());
  // 마우스가 잡힌 동안의 우클릭 · 휠
  addEventListener("wheel", (e) => {
    if (game.state !== "play" || !game.scoped) return;
    game.zoomBy(e.deltaY < 0 ? 1.14 : 1 / 1.14);
    sfx.zoom();
    syncZoom();
  }, { passive: true });

  /* ---------- 입력: 키보드 ---------- */
  addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.code === "KeyF") {
      toggleFull();
      return;
    }
    if (game.state === "pause" && (e.code === "KeyP" || e.code === "Escape")) {
      pauseOff();
      return;
    }
    if (game.state !== "play") return;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") game.input.breath = true;
    else if (e.code === "Space") {
      e.preventDefault();
      game.fire();
    } else if (e.code === "KeyE" || e.code === "KeyQ") game.spot();
    else if (e.code === "KeyH") game.hint();
    else if (e.code === "KeyN") game.toggleNV();
    else if (e.code === "KeyC" || e.code === "KeyZ") game.toggleScope();
    else if (e.code === "Equal" || e.code === "NumpadAdd") {
      game.zoomBy(1.14);
      syncZoom();
    } else if (e.code === "Minus" || e.code === "NumpadSubtract") {
      game.zoomBy(1 / 1.14);
      syncZoom();
    } else if (e.code === "KeyP" || e.code === "Escape") pauseOn();
    else if (e.code === "ArrowLeft") game.lookBy(-30, 0);
    else if (e.code === "ArrowRight") game.lookBy(30, 0);
    else if (e.code === "ArrowUp") game.lookBy(0, -30);
    else if (e.code === "ArrowDown") game.lookBy(0, 30);
  });
  addEventListener("keyup", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") game.input.breath = false;
  });
  function toggleFull() {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  /* ---------- 입력: 터치 버튼 ---------- */
  const press = (id, fn) => {
    $(id).addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sfx.unlock();
      fn();
    });
  };
  press("t-fire", () => game.fire());
  press("t-scope", () => game.toggleScope());
  press("t-spot", () => game.spot());
  press("t-hint", () => game.hint());
  press("t-nv", () => game.toggleNV());
  const bBtn = $("t-breath");
  bBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    game.input.breath = true;
    bBtn.classList.add("on");
    try {
      bBtn.setPointerCapture(e.pointerId);
    } catch (_) {
      /* 없어도 됨 */
    }
  });
  const bUp = () => {
    game.input.breath = false;
    bBtn.classList.remove("on");
  };
  bBtn.addEventListener("pointerup", bUp);
  bBtn.addEventListener("pointercancel", bUp);
  bBtn.addEventListener("lostpointercapture", bUp);
  // 배율
  const zr = $("t-zoom-r");
  const zToV = (z) => (Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 100;
  const vToZ = (v) => ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, v / 100);
  function syncZoom() {
    zr.value = zToV(game.zoom);
  }
  zr.addEventListener("input", () => {
    game.setZoom(vToZ(+zr.value));
    sfx.zoom();
  });
  press("t-zoom-in", () => {
    game.zoomBy(1.25);
    syncZoom();
    sfx.zoom();
  });
  press("t-zoom-out", () => {
    game.zoomBy(1 / 1.25);
    syncZoom();
    sfx.zoom();
  });

  /* ---------- 매 프레임 HUD ---------- */
  const elTime = $("h-time");
  const elObj = $("h-obj");
  const elAlert = $("h-alert");
  const elRange = $("s-range");
  const elZoom = $("s-zoom");
  const elBFill = $("b-fill");
  const elB = $("breath");
  const elBk = $("b-k");
  const elReload = $("reload");
  const elRF = $("reload-fill");
  const markBox = $("marks");
  const markEls = [];
  let last = performance.now();
  function hudTick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    requestAnimationFrame(hudTick);
    const H = game.hud;
    if (game.state !== "play" || !game.mission || H.ammo == null) return;
    const left = Math.ceil(H.time);
    elTime.textContent = fmtTime(left);
    elTime.classList.toggle("low", left <= 10);
    elObj.textContent = game.mission.boards ? `과녁 ${H.done} / ${H.need}` : `표적 ${H.done} / ${H.need}`;
    if (H.alert > 0) {
      elAlert.hidden = false;
      elAlert.querySelector("em").textContent = H.alert.toFixed(1);
    } else elAlert.hidden = true;
    if (H.scoped) {
      elRange.textContent = H.range ? `${H.range} m` : "— m";
      elZoom.textContent = `×${H.zoom.toFixed(1)}`;
      elBFill.style.width = `${Math.round(H.breath * 100)}%`;
      elB.classList.toggle("hold", H.holding);
      elB.classList.toggle("tired", H.breathCool > 0);
      elBk.textContent = H.breathCool > 0 ? "OUT OF BREATH" : H.holding ? "HOLDING…" : touchMode() ? "숨참기로 멈춤" : "SHIFT 숨참기";
      elReload.hidden = H.cool <= 0;
      if (H.cool > 0) elRF.style.transform = `scaleX(${1 - H.cool})`;
    }
    $("t-fire").classList.toggle("cool", H.cool > 0);
    // 표시 · 힌트
    const items = H.marks ? [...H.marks] : [];
    if (hintT > 0 && hintActor) {
      hintT -= dt;
      const p = hintActor.headPos(new THREE.Vector3());
      p.y += 0.2;
      p.project(game.engine.camera);
      const W = canvas.clientWidth;
      const Ht = canvas.clientHeight;
      items.push({ x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * Ht, on: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1, dx: p.z < 1 ? p.x : -p.x, dy: p.z < 1 ? p.y : -p.y, hint: true, d: null });
    }
    while (markEls.length < items.length) {
      const d = document.createElement("div");
      d.className = "mk";
      d.innerHTML = "<i></i><span></span>";
      markBox.appendChild(d);
      markEls.push(d);
    }
    const W = canvas.clientWidth;
    const Ht = canvas.clientHeight;
    markEls.forEach((el, i) => {
      const it = items[i];
      el.hidden = !it;
      el.style.display = it ? "" : "none";
      if (!it) return;
      el.classList.toggle("hint", !!it.hint);
      el.classList.toggle("off", !it.on);
      let x = it.x;
      let y = it.y;
      if (!it.on) {
        const a = Math.atan2(-it.dy, it.dx);
        const r = Math.min(W, Ht) * 0.4;
        x = W / 2 + Math.cos(a) * r;
        y = Ht / 2 + Math.sin(a) * r;
        el.style.setProperty("--rot", `${a + Math.PI / 2}rad`);
      }
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
      el.lastChild.textContent = it.d != null ? `${it.d}m` : "";
    });
  }
  requestAnimationFrame(hudTick);

  paintTitle();
  show("title");
  return { game, save };
}
