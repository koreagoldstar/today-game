/*
 * 제트스키 썬더 레이스 · 조작
 *  휴대폰: 화면을 누른 손가락이 가운데에서 왼쪽/오른쪽으로 멀수록 그쪽으로 세게 꺾는다.
 *          (왼쪽을 누르고 있으면 왼쪽, 손을 떼면 똑바로) — 5초 만에 이해되는 조작
 *  부스트: 오른쪽 아래 BOOST 버튼 (다른 손가락으로 동시에 눌러도 된다)
 *  컴퓨터: ← → (A D) 조향 · Space / ↑ 부스트 · P / Esc 일시정지
 */
import { W, clamp } from "./view.js?v=1";

export class Input {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.view = view;
    this.enabled = false;
    this.pointers = new Map(); // id → x(논리)
    this.lastId = null;
    this.keys = { left: false, right: false };
    this.keySteer = 0;
    this.steer = 0;
    this.boost = false; // 이번 프레임에 눌림
    this.tapped = false; // 이번 프레임에 화면을 톡 (퍼펙트 스타트)
    this.touching = false;
    this.touchX = W / 2;
    this.onPause = null;
    this.onAny = null;
    this.mode = "touch";

    const down = (e) => {
      if (this.onAny) this.onAny();
      if (!this.enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      const p = view.toLogical(e.clientX, e.clientY);
      this.pointers.set(e.pointerId, p.x);
      this.lastId = e.pointerId;
      this.tapped = true;
      this.mode = e.pointerType === "mouse" ? "mouse" : "touch";
    };
    const move = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = view.toLogical(e.clientX, e.clientY);
      this.pointers.set(e.pointerId, p.x);
    };
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.lastId === e.pointerId) {
        const ids = [...this.pointers.keys()];
        this.lastId = ids.length ? ids[ids.length - 1] : null;
      }
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("keydown", (e) => {
      if (this.onAny) this.onAny();
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") this.keys.left = true;
      else if (k === "ArrowRight" || k === "d" || k === "D") this.keys.right = true;
      else if (k === " " || k === "ArrowUp" || k === "w" || k === "W") {
        if (!e.repeat) {
          this.boost = true;
          this.tapped = true;
        }
      } else if (k === "p" || k === "P" || k === "Escape") {
        if (this.onPause) this.onPause();
      } else return;
      this.mode = "key";
      if (this.enabled) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") this.keys.left = false;
      else if (k === "ArrowRight" || k === "d" || k === "D") this.keys.right = false;
    });
    window.addEventListener("blur", () => this.release());
  }

  /** 매 프레임 한 번: 조향 값 계산 */
  update(dt) {
    let s = 0;
    if (this.lastId != null && this.pointers.has(this.lastId)) {
      const x = this.pointers.get(this.lastId);
      this.touching = true;
      this.touchX = x;
      const d = (x - W / 2) / (W * 0.3);
      const dead = 0.07;
      s = Math.abs(d) < dead ? 0 : clamp((Math.abs(d) - dead) / (1 - dead), 0, 1) * Math.sign(d);
    } else this.touching = false;
    // 키보드는 부드럽게 차오른다
    const kt = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    this.keySteer += (kt - this.keySteer) * Math.min(1, dt * (kt ? 7 : 12));
    if (Math.abs(this.keySteer) > Math.abs(s)) s = this.keySteer;
    this.steer = s;
  }

  /** 프레임 끝: 한 번만 쓰는 입력 지우기 */
  endFrame() {
    this.boost = false;
    this.tapped = false;
  }

  pressBoost() {
    this.boost = true;
  }

  release() {
    this.pointers.clear();
    this.lastId = null;
    this.keys.left = this.keys.right = false;
    this.keySteer = 0;
    this.steer = 0;
  }
}
