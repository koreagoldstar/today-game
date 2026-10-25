/*
 * 자석 대소동 · 입력 (키보드 · 화면 버튼) → 매 걸음 한 번씩 꺼내 쓰는 상태
 *  - 누르고 있는 것(left · right · jump)과 '한 번 누름'(점프 · 자석 · 극 · 조작)을 나눔
 *  - 멈춤 · 다시 하기 · 스테이지 바꿈 · 창 숨김 때 모두 지움 (눌린 채로 남지 않게)
 */
const KEYS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["ArrowUp", "KeyW", "Space"],
  mag: ["KeyK", "KeyJ"],
  pole: ["KeyL", "KeyQ"],
  use: ["KeyE", "Enter"],
};

export class Input {
  constructor() {
    this.held = { left: false, right: false, jump: false };
    this.touch = { left: false, right: false, jump: false };
    this.edge = { jump: 0, mag: 0, pole: 0, use: 0 };
    this.enabled = false;
    this.onPause = null;
    this.onRestart = null;
    this.used = { keyboard: false, touch: false };
    window.addEventListener("keydown", (e) => this.key(e, true));
    window.addEventListener("keyup", (e) => this.key(e, false));
    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => document.hidden && this.reset());
  }
  key(e, down) {
    const code = e.code;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (!this.enabled) return;
    if (down && (code === "Escape" || code === "KeyP")) {
      e.preventDefault();
      if (this.onPause) this.onPause();
      return;
    }
    if (down && code === "KeyR" && !e.repeat) {
      if (this.onRestart) this.onRestart();
      return;
    }
    for (const [act, codes] of Object.entries(KEYS)) {
      if (!codes.includes(code)) continue;
      e.preventDefault(); // 스페이스 · 화살표로 화면이 움직이지 않게
      this.used.keyboard = true;
      if (act in this.held) this.held[act] = down;
      if (down && !e.repeat && act in this.edge) this.edge[act]++;
    }
  }
  /** 화면 버튼 (pointer) 연결 */
  bindButton(el, act) {
    const press = (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      this.used.touch = true;
      el.classList.add("on");
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (act in this.touch) this.touch[act] = true;
      if (act in this.edge) this.edge[act]++;
    };
    const release = (e) => {
      if (e) e.preventDefault();
      el.classList.remove("on");
      if (act in this.touch) this.touch[act] = false;
    };
    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  /** 걸음마다 한 번: 이번 걸음 입력 */
  take() {
    const inp = {
      left: this.held.left || this.touch.left,
      right: this.held.right || this.touch.right,
      jump: this.held.jump || this.touch.jump,
      jumpPressed: this.edge.jump > 0,
      magPressed: this.edge.mag > 0,
      polPressed: this.edge.pole > 0,
      usePressed: this.edge.use > 0,
    };
    for (const k of Object.keys(this.edge)) if (this.edge[k] > 0) this.edge[k]--;
    return inp;
  }
  reset() {
    for (const k of Object.keys(this.held)) this.held[k] = false;
    for (const k of Object.keys(this.touch)) this.touch[k] = false;
    for (const k of Object.keys(this.edge)) this.edge[k] = 0;
    for (const el of document.querySelectorAll(".pad .on")) el.classList.remove("on");
  }
}
