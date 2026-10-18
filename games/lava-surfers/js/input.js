/*
 * 용암 서핑 · 입력
 *  PC: A·D / ←→ 좌우 · Space 점프 · Shift 부스터 (Esc 는 game 이 처리)
 *  모바일: 왼쪽 아래 ◀ ▶ 두 버튼 (누른 채 손가락을 옆 버튼으로 밀어도 됨) · 오른쪽 점프 · 부스터 버튼
 *  여러 손가락 동시에 (좌우를 누른 채 점프)
 */
export class Input {
  constructor({ left, right, jump, boost, pad }) {
    this.keys = new Set();
    this.enabled = false;
    this.flags = {};
    this.touchSteer = 0;
    this.touchMode = false;
    this.touches = new Map(); // pointerId → 'L' | 'R' | 'J' | 'B'
    this.el = { left, right, jump, boost, pad };
    this._kd = (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      if (!this.enabled) return;
      if (k === "Space" || k === "KeyW" || k === "ArrowUp") {
        this.flags.jump = true;
        e.preventDefault();
      }
      if (k === "ShiftLeft" || k === "ShiftRight" || k === "KeyK") this.flags.boost = true;
    };
    this._ku = (e) => this.keys.delete(e.code);
    window.addEventListener("keydown", this._kd);
    window.addEventListener("keyup", this._ku);
    window.addEventListener("blur", () => this.keys.clear());
    // 터치 버튼: pointer 이벤트 (손가락마다 따로)
    const which = (x, y) => {
      for (const [id, el] of [
        ["L", left],
        ["R", right],
        ["J", jump],
        ["B", boost],
      ]) {
        const r = el.getBoundingClientRect();
        const m = 10;
        if (x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m) return id;
      }
      // 왼쪽 패드 칸 안이면 가까운 쪽 버튼
      if (pad) {
        const r = pad.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return x < r.left + r.width / 2 ? "L" : "R";
      }
      return null;
    };
    const down = (e) => {
      if (e.pointerType === "mouse") return;
      this.touchMode = true;
      document.body.classList.add("touch");
      const w = which(e.clientX, e.clientY);
      if (!w) return;
      e.preventDefault();
      this.touches.set(e.pointerId, w);
      if (this.enabled && w === "J") this.flags.jump = true;
      if (this.enabled && w === "B") this.flags.boost = true;
      this.paint();
    };
    const move = (e) => {
      if (!this.touches.has(e.pointerId)) return;
      const cur = this.touches.get(e.pointerId);
      if (cur !== "L" && cur !== "R") return;
      const w = which(e.clientX, e.clientY);
      if (w === "L" || w === "R") this.touches.set(e.pointerId, w);
      this.paint();
    };
    const up = (e) => {
      this.touches.delete(e.pointerId);
      this.paint();
    };
    for (const el of [left, right, jump, boost, pad].filter(Boolean)) {
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", (e) => {
        // 손가락이 버튼 밖으로 나가도 좌우는 계속 (패드 위라면)
        if (e.pointerType !== "mouse" && !["L", "R"].includes(this.touches.get(e.pointerId))) up(e);
      });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    // 휴대폰 · 태블릿은 처음부터 터치 버튼 · 어디든 손가락으로 누르면 터치 버튼으로 바꿈
    const touchOn = () => {
      this.touchMode = true;
      document.body.classList.add("touch");
    };
    if (matchMedia("(pointer:coarse)").matches) touchOn();
    window.addEventListener("pointerdown", (e) => e.pointerType === "touch" && touchOn(), true);
  }
  paint() {
    const v = [...this.touches.values()];
    this.el.left.classList.toggle("on", v.includes("L"));
    this.el.right.classList.toggle("on", v.includes("R"));
    this.el.jump.classList.toggle("on", v.includes("J"));
    this.el.boost.classList.toggle("on", v.includes("B"));
  }
  setEnabled(on) {
    this.enabled = on;
    if (!on) this.flags = {};
  }
  /** -1(왼쪽) ~ 1(오른쪽) */
  steer() {
    if (!this.enabled) return 0;
    let s = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) s -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) s += 1;
    const v = [...this.touches.values()];
    if (v.includes("L")) s -= 1;
    if (v.includes("R")) s += 1;
    return Math.max(-1, Math.min(1, s));
  }
  get jumpHeld() {
    return this.keys.has("Space") || [...this.touches.values()].includes("J");
  }
  consume() {
    const f = this.flags;
    this.flags = {};
    return f;
  }
  dispose() {
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("keyup", this._ku);
  }
}
