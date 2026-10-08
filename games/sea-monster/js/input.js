/*
 * 바다괴물 탐험대 · 입력
 *  모바일: 왼쪽 아래를 누르면 그 자리에 가상 조이스틱(이동) · 다른 곳을 누르면 그곳을 조준하며 발사
 *  PC    : WASD · 방향키 이동, 마우스로 조준 · 누르고 있으면 발사, Space/E 탐지(소나), P/Esc 일시정지
 *          마우스 없이: J · Enter 를 누르면 가장 가까운 괴물(없으면 앞쪽)으로 발사
 */
import { W, H, clamp } from "./view.js?v=1";

const STICK_R = 64;

export class Input {
  constructor(el, view) {
    this.el = el;
    this.view = view;
    this.move = { x: 0, y: 0 };
    this.aim = { x: W / 2, y: H / 2, on: false, firing: false, mouse: false, last: 0 };
    this.stick = { on: false, id: null, bx: 0, by: 0, kx: 0, ky: 0 };
    this.aimId = null;
    this.keys = new Set();
    this.keyFire = false;
    this.sonarHit = false;
    this.pauseHit = false;
    this.enabled = false;
    this.touchMode = false;
    this.onFirst = null;
    this._down = (e) => this.down(e);
    this._move = (e) => this.moveP(e);
    this._up = (e) => this.up(e);
    this._kd = (e) => this.keyDown(e);
    this._ku = (e) => this.keyUp(e);
    this._blur = () => this.release();
    el.addEventListener("pointerdown", this._down);
    window.addEventListener("pointermove", this._move, { passive: true });
    window.addEventListener("pointerup", this._up);
    window.addEventListener("pointercancel", this._up);
    window.addEventListener("keydown", this._kd);
    window.addEventListener("keyup", this._ku);
    window.addEventListener("blur", this._blur);
  }

  pos(e) {
    return this.view.toLogical(e.clientX, e.clientY);
  }

  down(e) {
    if (this.onFirst) {
      const f = this.onFirst;
      this.onFirst = null;
      f();
    }
    if (!this.enabled) return;
    const p = this.pos(e);
    const touch = e.pointerType !== "mouse";
    this.touchMode = touch;
    // 왼쪽 아래 = 조이스틱 (터치일 때만)
    if (touch && !this.stick.on && p.x < W * 0.46 && p.y > H * 0.42) {
      this.stick = { on: true, id: e.pointerId, bx: p.x, by: p.y, kx: p.x, ky: p.y };
      this.el.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }
    if (this.aimId !== null && touch) return;
    this.aimId = e.pointerId;
    this.aim.x = p.x;
    this.aim.y = p.y;
    this.aim.on = true;
    this.aim.firing = true;
    this.aim.mouse = !touch;
    this.aim.last = performance.now();
    e.preventDefault();
  }

  moveP(e) {
    if (!this.enabled) return;
    const p = this.pos(e);
    if (this.stick.on && e.pointerId === this.stick.id) {
      const dx = p.x - this.stick.bx;
      const dy = p.y - this.stick.by;
      const d = Math.hypot(dx, dy);
      // 멀리 끌면 받침이 따라온다
      if (d > STICK_R * 1.4) {
        this.stick.bx = p.x - (dx / d) * STICK_R * 1.4;
        this.stick.by = p.y - (dy / d) * STICK_R * 1.4;
      }
      this.stick.kx = p.x;
      this.stick.ky = p.y;
      return;
    }
    if (e.pointerType === "mouse") {
      this.aim.x = p.x;
      this.aim.y = p.y;
      this.aim.on = true;
      this.aim.mouse = true;
      this.aim.last = performance.now();
      this.touchMode = false;
      return;
    }
    if (e.pointerId === this.aimId) {
      this.aim.x = p.x;
      this.aim.y = p.y;
      this.aim.last = performance.now();
    }
  }

  up(e) {
    if (this.stick.on && e.pointerId === this.stick.id) {
      this.stick.on = false;
      this.stick.id = null;
      return;
    }
    if (e.pointerId === this.aimId) {
      this.aimId = null;
      this.aim.firing = false;
      if (!this.aim.mouse) this.aim.last = performance.now();
    }
  }

  keyDown(e) {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (this.onFirst && k !== "tab") {
      const f = this.onFirst;
      this.onFirst = null;
      f();
    }
    if (k === "p" || k === "escape") this.pauseHit = true;
    if (!this.enabled) return;
    if (k === " " || k === "e") this.sonarHit = true;
    if (k === "j" || k === "enter" || k === "shift") this.keyFire = true;
    this.keys.add(k);
  }
  keyUp(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === "j" || k === "enter" || k === "shift") this.keyFire = false;
  }

  /** 매 프레임: 이동 벡터 정리 */
  update() {
    let x = 0;
    let y = 0;
    const K = this.keys;
    if (K.has("a") || K.has("arrowleft")) x -= 1;
    if (K.has("d") || K.has("arrowright")) x += 1;
    if (K.has("w") || K.has("arrowup")) y -= 1;
    if (K.has("s") || K.has("arrowdown")) y += 1;
    if (x || y) {
      const d = Math.hypot(x, y);
      this.move.x = x / d;
      this.move.y = y / d;
      this.touchMode = this.touchMode && false;
    } else if (this.stick.on) {
      const dx = (this.stick.kx - this.stick.bx) / STICK_R;
      const dy = (this.stick.ky - this.stick.by) / STICK_R;
      const d = Math.hypot(dx, dy);
      const m = d < 0.12 ? 0 : clamp((d - 0.12) / 0.88, 0, 1);
      this.move.x = d > 0 ? (dx / d) * m : 0;
      this.move.y = d > 0 ? (dy / d) * m : 0;
    } else {
      this.move.x = 0;
      this.move.y = 0;
    }
  }

  /** 한 번만 읽고 지우는 버튼 */
  takeSonar() {
    const v = this.sonarHit;
    this.sonarHit = false;
    return v;
  }
  takePause() {
    const v = this.pauseHit;
    this.pauseHit = false;
    return v;
  }

  release() {
    this.keys.clear();
    this.keyFire = false;
    this.stick.on = false;
    this.stick.id = null;
    this.aimId = null;
    this.aim.firing = false;
    this.move.x = 0;
    this.move.y = 0;
  }

  get stickR() {
    return STICK_R;
  }

  destroy() {
    this.el.removeEventListener("pointerdown", this._down);
    window.removeEventListener("pointermove", this._move);
    window.removeEventListener("pointerup", this._up);
    window.removeEventListener("pointercancel", this._up);
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("keyup", this._ku);
    window.removeEventListener("blur", this._blur);
  }
}
