/*
 * 드래곤 석상 대작전 · 모험 조작
 *  PC: WASD / 방향키 이동 · Space 점프 · Shift 대시 · J 또는 마우스 클릭 공격 (Esc 일시정지는 game.js)
 *  모바일: 왼쪽 아무 곳이나 누르면 그 자리에 조이스틱 · 오른쪽 점프(크게) · 공격 · 대시 버튼
 *  터치와 마우스가 겹쳐 두 번 실행되지 않게: 캔버스 클릭 공격은 마우스(pointerType=mouse)만 받는다.
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
  constructor({ canvas, zone, base, knob, jump, attack, dash }) {
    this.canvas = canvas;
    this.zone = zone;
    this.base = base;
    this.knob = knob;
    this.enabled = false;
    this.keys = new Set();
    this.joy = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
    this.flags = { jump: false, dash: false, attack: false };
    this.held = { jump: false };
    this.touchMode = false;
    this.lastKind = "key";
    this.R = 52;

    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    window.addEventListener("blur", () => this.reset());
    // 마우스 클릭 = 공격 (터치는 버튼으로만)
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.enabled || e.pointerType !== "mouse" || e.button !== 0) return;
      this.flags.attack = true;
      this.lastKind = "key";
    });
    // 조이스틱 (왼쪽 영역 · 처음 닿은 곳이 중심)
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
    // 버튼 (누르는 순간 바로)
    const bind = (el, name) => {
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.enabled) return;
        if (e.pointerType !== "mouse") this.setTouch(true);
        this.flags[name] = true;
        if (name === "jump") this.held.jump = true;
        el.classList.add("down");
        this.lastKind = "touch";
      });
      const up = (e) => {
        if (name === "jump") this.held.jump = false;
        el.classList.remove("down");
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    };
    bind(jump, "jump");
    bind(attack, "attack");
    bind(dash, "dash");
    // 처음부터 터치 기기면 터치 조작을 보인다
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
    if (KEYMAP[c] || c === "Space" || c === "ShiftLeft" || c === "ShiftRight" || c === "KeyJ" || c === "KeyK" || c === "KeyL") {
      if (this.enabled) e.preventDefault();
    } else return;
    if (down) {
      if (this.enabled && !e.repeat) {
        if (c === "Space" || c === "KeyK") this.flags.jump = true;
        if (c === "ShiftLeft" || c === "ShiftRight" || c === "KeyL") this.flags.dash = true;
        if (c === "KeyJ") this.flags.attack = true;
        this.lastKind = "key";
      }
      this.keys.add(c);
      if (c === "Space" || c === "KeyK") this.held.jump = true;
    } else {
      this.keys.delete(c);
      if (c === "Space" || c === "KeyK") this.held.jump = false;
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
    // 조이스틱 (가운데 조금은 무시 · 끝으로 갈수록 빠르게)
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
    this.flags.jump = this.flags.dash = this.flags.attack = false;
    return f;
  }
  get jumpHeld() {
    return this.held.jump;
  }
  reset() {
    this.keys.clear();
    this.flags.jump = this.flags.dash = this.flags.attack = false;
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
