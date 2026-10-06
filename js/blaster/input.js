/*
 * 물총 대작전 엔진 · AimSystem
 * 마우스 · 터치 · 키보드로 조준점을 움직이고 '쏘는 중' 상태를 알려 준다.
 *  - 마우스: 움직이면 조준, 누르고 있으면 연사
 *  - 터치: 누른 자리로 조준 + 발사, 끌면 따라감
 *  - 키보드: 방향키/WASD 로 조준점 이동, Space/Enter/J 로 발사
 */
import { W, H, clamp } from "./view.js?v=3";

export class AimSystem {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.view = view;
    this.x = W / 2;
    this.y = H * 0.5;
    this.firing = false;
    this.mode = "mouse";
    this.enabled = false;
    this.keys = new Set();
    this.keyFire = false;
    this.pointerId = null;
    this.onPress = null; // 처음 누른 순간 (튜토리얼·소리 잠금 해제)
    this.lastMove = 0;
    this.minY = 230;

    const opt = { passive: false };
    this._down = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      if (this.pointerId !== null && e.pointerId !== this.pointerId && e.pointerType === "touch") return;
      this.pointerId = e.pointerId;
      this.mode = e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "mouse";
      this.setFrom(e);
      this.firing = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (this.onPress) this.onPress();
    };
    this._move = (e) => {
      if (!this.enabled) return;
      if (e.pointerType === "mouse") {
        this.mode = "mouse";
        this.setFrom(e);
      } else if (e.pointerId === this.pointerId) {
        e.preventDefault();
        this.setFrom(e);
      }
    };
    this._up = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.firing = false;
    };
    this._key = (e) => {
      const k = e.code;
      const down = e.type === "keydown";
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"].includes(k)) {
        if (!this.enabled) return;
        e.preventDefault();
        if (down) this.keys.add(k);
        else this.keys.delete(k);
        this.mode = "key";
      } else if (k === "Space" || k === "Enter" || k === "KeyJ") {
        if (!this.enabled) {
          this.keyFire = false;
          return;
        }
        e.preventDefault();
        if (down && !this.keyFire && this.onPress) this.onPress();
        this.keyFire = down;
        if (down) this.mode = this.mode === "touch" ? "touch" : this.mode;
      }
    };
    this._blur = () => {
      this.firing = false;
      this.keyFire = false;
      this.keys.clear();
      this.pointerId = null;
    };
    canvas.addEventListener("pointerdown", this._down, opt);
    window.addEventListener("pointermove", this._move, opt);
    window.addEventListener("pointerup", this._up);
    window.addEventListener("pointercancel", this._up);
    window.addEventListener("keydown", this._key);
    window.addEventListener("keyup", this._key);
    window.addEventListener("blur", this._blur);
  }

  setFrom(e) {
    const p = this.view.toLogical(e.clientX, e.clientY);
    this.x = clamp(p.x, 6, W - 6);
    this.y = clamp(p.y, this.minY, H - 140);
    this.lastMove = performance.now();
  }

  get shooting() {
    return this.enabled && (this.firing || this.keyFire);
  }

  update(dt) {
    if (!this.enabled || !this.keys.size) return;
    const sp = 620 * dt;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) this.x -= sp;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) this.x += sp;
    if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) this.y -= sp * 0.85;
    if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) this.y += sp * 0.85;
    this.x = clamp(this.x, 6, W - 6);
    this.y = clamp(this.y, this.minY, H - 140);
  }

  release() {
    this._blur();
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this._down);
    window.removeEventListener("pointermove", this._move);
    window.removeEventListener("pointerup", this._up);
    window.removeEventListener("pointercancel", this._up);
    window.removeEventListener("keydown", this._key);
    window.removeEventListener("keyup", this._key);
    window.removeEventListener("blur", this._blur);
  }
}
