"use strict";
/* 조종 코드가 쓰는 실제 입력 도구: 게임 좌표 탭·드래그, 키, HUD 읽기, 상태 읽기 (tools/game-reels/lib/game-io.js 에서 가져옴) */

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class GameIO {
  constructor(page, rec, game) {
    this.page = page;
    this.rec = rec;
    this.game = game;
    this.mouse = page.mouse;
    this.keyboard = page.keyboard;
    this.deadline = 0;
    this._boxes = new Map();
  }

  timeLeft() {
    return this.deadline - Date.now();
  }
  running() {
    return Date.now() < this.deadline;
  }
  mark(type, label, weight) {
    this.rec.mark(type, label, weight);
  }

  /* ---------- 화면 좌표 ---------- */

  async box(selector = "canvas") {
    const b = await this.page.locator(selector).first().boundingBox();
    if (!b) throw new Error(`화면에서 ${selector} 를 찾지 못했어요`);
    return b;
  }

  /** 게임 논리 좌표(W×H) → 화면 좌표. 캔버스가 CSS 로 늘어나도 맞게 변환 */
  async at(x, y, { selector = "canvas", W, H } = {}) {
    const key = `${selector}|${W}|${H}`;
    let b = this._boxes.get(key);
    if (!b || Date.now() - b.at > 1500) {
      const box = await this.box(selector);
      b = { box, at: Date.now() };
      this._boxes.set(key, b);
    }
    const { box } = b;
    const sx = W ? box.width / W : 1;
    const sy = H ? box.height / H : 1;
    return { x: box.x + x * sx, y: box.y + y * sy };
  }

  /* ---------- 입력 ---------- */

  async tapXY(x, y, holdMs = 50) {
    await this.mouse.move(x, y);
    await this.mouse.down();
    await sleep(holdMs);
    await this.mouse.up();
  }

  async tap(x, y, opts = {}) {
    const p = await this.at(x, y, opts);
    await this.tapXY(p.x, p.y, opts.holdMs || 50);
  }

  async touch(x, y, opts = {}) {
    const p = await this.at(x, y, opts);
    await this.page.touchscreen.tap(p.x, p.y);
  }

  async drag(from, to, opts = {}) {
    const a = await this.at(from.x, from.y, opts);
    const b = await this.at(to.x, to.y, opts);
    const steps = opts.steps || 14;
    await this.mouse.move(a.x, a.y);
    await this.mouse.down();
    await sleep(opts.pressMs || 60);
    for (let i = 1; i <= steps; i++) {
      await this.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
      await sleep((opts.durationMs || 320) / steps);
    }
    await sleep(opts.holdMs || 80);
    await this.mouse.up();
  }

  async key(k, holdMs = 40) {
    await this.keyboard.down(k);
    await sleep(holdMs);
    await this.keyboard.up(k);
  }

  async click(selector, timeout = 2500) {
    await this.page.locator(selector).first().click({ timeout });
  }

  /* ---------- 화면 읽기 ---------- */

  async visible(selector) {
    return this.page
      .locator(selector)
      .first()
      .isVisible()
      .catch(() => false);
  }

  /** 숨김 클래스로 여닫는 오버레이가 열려 있는지 */
  async overlayOpen(id) {
    return this.page
      .evaluate((i) => {
        const el = document.getElementById(i);
        if (!el) return false;
        if (el.classList.contains("hidden") || el.hidden) return false;
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
      }, id)
      .catch(() => false);
  }

  async text(selector) {
    return this.page
      .locator(selector)
      .first()
      .textContent({ timeout: 500 })
      .catch(() => "");
  }

  async num(selector) {
    const t = await this.text(selector);
    const m = String(t || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  /** 계측된 게임의 상태 (읽기 전용) */
  async peek() {
    return this.page.evaluate(() => (window.__reel && window.__reel.peek ? window.__reel.peek() : null)).catch(() => null);
  }

  /**
   * HUD 숫자가 바뀔 때마다 하이라이트 이벤트를 남긴다.
   * @returns {() => void} 멈추기
   */
  watchNumber(selector, { type = "score", label = "점수", weight = (d) => Math.min(4, 1 + d / 10), minDelta = 1 } = {}) {
    let stop = false;
    let last = NaN;
    (async () => {
      while (!stop) {
        const v = await this.num(selector);
        if (Number.isFinite(v)) {
          if (Number.isFinite(last) && v - last >= minDelta) this.mark(type, `${label}+${v - last}`, weight(v - last));
          last = v;
        }
        await sleep(150);
      }
    })();
    this._lastWatched = () => last;
    return () => {
      stop = true;
    };
  }
}

module.exports = { GameIO, sleep, rand, pick };
