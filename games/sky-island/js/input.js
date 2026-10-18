/*
 * 하늘섬 대탈출 · 조작
 *  PC: WASD / 방향키 이동 · Space 점프 · Shift 대시 (Esc 일시정지는 game.js)
 *  모바일: 왼쪽 아무 곳이나 누르면 그 자리에 조이스틱 · 오른쪽 점프(크게) · 대시 버튼 (여러 손가락 동시)
 */
const KEYMAP = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

export class Input {
  constructor({ zone, base, knob, jump, dash }) {
    this.zone = zone;
    this.base = base;
    this.knob = knob;
    this.enabled = false;
    this.keys = new Set();
    this.joy = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
    this.flags = { jump: false, dash: false };
    this.held = { jump: false };
    this.touchMode = false;
    this.R = 52;
    this.used = false;

    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    window.addEventListener("blur", () => this.reset());
    zone.addEventListener("pointerdown", (e) => {
      if (!this.enabled || this.joy.id !== null) return;
      if (e.pointerType === "mouse") return;
      e.preventDefault();
      this.setTouch(true);
      zone.setPointerCapture && zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      this.joy.id = e.pointerId;
      this.joy.ox = e.clientX;
      this.joy.oy = e.clientY;
      this.joy.x = this.joy.y = 0;
      this.R = Math.max(44, Math.min(70, r.width * 0.16));
      base.style.left = `${e.clientX - r.left}px`;
      base.style.top = `${e.clientY - r.top}px`;
      base.classList.add("on");
      this.drawKnob();
      this.used = true;
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.joy.id) return;
      e.preventDefault();
      let dx = e.clientX - this.joy.ox;
      let dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > this.R) {
        dx = (dx / d) * this.R;
        dy = (dy / d) * this.R;
      }
      this.joy.x = dx / this.R;
      this.joy.y = -dy / this.R;
      this.drawKnob();
    });
    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.id = null;
      this.joy.x = this.joy.y = 0;
      base.classList.remove("on");
      this.drawKnob();
    };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);
    const bind = (el, name) => {
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.enabled) return;
        if (e.pointerType !== "mouse") this.setTouch(true);
        this.flags[name] = true;
        if (name === "jump") this.held.jump = true;
        el.classList.add("down");
        this.used = true;
      });
      const up = () => {
        if (name === "jump") this.held.jump = false;
        el.classList.remove("down");
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    };
    bind(jump, "jump");
    bind(dash, "dash");
    if (matchMedia("(pointer:coarse)").matches) this.setTouch(true);
  }
  setTouch(on) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    document.body.classList.toggle("touch", on);
  }
  drawKnob() {
    this.knob.style.transform = `translate(${this.joy.x * this.R}px, ${-this.joy.y * this.R}px)`;
  }
  onKey(e, down) {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const c = e.code;
    if (KEYMAP[c] || c === "Space" || c === "ShiftLeft" || c === "ShiftRight") {
      if (this.enabled) e.preventDefault();
    } else return;
    if (down) {
      if (this.enabled && !e.repeat) {
        if (c === "Space") this.flags.jump = true;
        if (c === "ShiftLeft" || c === "ShiftRight") this.flags.dash = true;
        this.used = true;
      }
      this.keys.add(c);
      if (c === "Space") this.held.jump = true;
    } else {
      this.keys.delete(c);
      if (c === "Space") this.held.jump = false;
    }
  }
  /** 이동 (x: 오른쪽 +, y: 앞 +), 길이 0~1 */
  move() {
    let x = 0;
    let y = 0;
    for (const c of this.keys) {
      const k = KEYMAP[c];
      if (k === "up") y += 1;
      if (k === "down") y -= 1;
      if (k === "left") x -= 1;
      if (k === "right") x += 1;
    }
    const kl = Math.hypot(x, y);
    if (kl > 0) {
      x /= kl;
      y /= kl;
    }
    const jl = Math.hypot(this.joy.x, this.joy.y);
    if (jl > 0.14) {
      const k = Math.min(1, (jl - 0.14) / 0.76);
      x += (this.joy.x / jl) * k;
      y += (this.joy.y / jl) * k;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }
  consume() {
    const f = { ...this.flags };
    this.flags.jump = this.flags.dash = false;
    return f;
  }
  get jumpHeld() {
    return this.held.jump;
  }
  reset() {
    this.keys.clear();
    this.flags.jump = this.flags.dash = false;
    this.held.jump = false;
    this.joy.id = null;
    this.joy.x = this.joy.y = 0;
    if (this.base) this.base.classList.remove("on");
    if (this.knob) this.drawKnob();
  }
  setEnabled(on) {
    this.enabled = on;
    if (!on) this.reset();
  }
}
