/*
 * 전투 효과 (모두 통에서 꺼내 쓰고 돌려놓음 · 개수 상한 있음)
 *  - glow: 빛 알갱이 (더해서 밝아짐 — 불꽃 · 번개 · 마법 · 반짝)
 *  - puff: 연기 · 먼지 · 눈 뭉치 (부드러운 반투명)
 *  - flash: 터지는 순간의 빛 덩이 · ring: 땅에 퍼지는 충격파 · scorch: 그을음 자국
 *  - bolt: 굵은 번개 줄기 (빛 띠 두 겹) · coin: 튀어 오르며 도는 금화
 *  크기는 세계 단위 → 화면 크기에 맞춰 점 크기를 계산 (휴대폰 · PC 같은 느낌)
 */
import { THREE, mat } from "./kit.js";
import { glowTex, puffTex, ringTex, sparkTex } from "./fxtex.js";

class PointSystem {
  constructor(root, n, tex, additive) {
    this.n = n;
    this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.rot = new Float32Array(n);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aRot", new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.uScale = { value: 400 };
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex }, uScale: this.uScale },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aRot;
        uniform float uScale; varying vec3 vC; varying float vA; varying float vR;
        void main(){ vC = aColor; vA = aAlpha; vR = aRot; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 1.0, 256.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; varying float vR;
        void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR); float s = sin(vR); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
          vec4 t = texture2D(map, p); gl_FragColor = vec4(vC * (0.72 + 0.55 * t.a), min(1.0, t.a * 1.25) * vA);
          #include <colorspace_fragment>
        }`,
    });
    this.pts = new THREE.Points(g, this.mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = additive ? 30 : 29;
    this.g = g;
    root.add(this.pts);
  }
  add(p) {
    if (this.list.length >= this.n) return null;
    this.list.push(p);
    return p;
  }
  update(dt) {
    let k = 0;
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) {
        L[i] = L[L.length - 1];
        L.pop();
        continue;
      }
      const f = p.t / p.life;
      p.vy -= p.g * dt;
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr;
      p.vy *= dr;
      p.vz *= dr;
      p.x += p.vx * dt;
      p.y = Math.max(p.floor, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.r += p.spin * dt;
      this.pos[k * 3] = p.x;
      this.pos[k * 3 + 1] = p.y;
      this.pos[k * 3 + 2] = p.z;
      this.col[k * 3] = p.c.r;
      this.col[k * 3 + 1] = p.c.g;
      this.col[k * 3 + 2] = p.c.b;
      this.size[k] = p.s0 + (p.s1 - p.s0) * f;
      // 처음엔 빠르게 나타나고 끝으로 갈수록 사라짐
      this.alpha[k] = p.a * Math.min(1, p.t * 14) * (1 - f) ** (p.fade || 1);
      this.rot[k] = p.r;
      k++;
    }
    this.g.setDrawRange(0, k);
    for (const a of ["position", "aColor", "aSize", "aAlpha", "aRot"]) {
      const at = this.g.attributes[a];
      at.needsUpdate = true;
      at.clearUpdateRanges && at.clearUpdateRanges();
    }
  }
}

const tmpC = new THREE.Color();
const rand = (a, b) => a + Math.random() * (b - a);

export class Effects {
  constructor(root, cap = 600) {
    this.root = root;
    this.glow = new PointSystem(root, cap, glowTex(), false);
    this.star = new PointSystem(root, Math.round(cap * 0.3), sparkTex(), false);
    this.puff = new PointSystem(root, Math.round(cap * 0.6), puffTex(), false);
    this.flashes = [];
    this.rings = [];
    this.scorches = [];
    this.bolts = [];
    this.coins = [];
    this.coinMat = mat(0xffcf3a, { rough: 0.25, metal: 0.6, emissive: 0xffa21a, ei: 0.35 });
  }
  /** 화면 크기 → 점 크기 배율 */
  setView(camera, heightPx) {
    const s = heightPx / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.glow.uScale.value = this.star.uScale.value = this.puff.uScale.value = s;
  }
  count() {
    return this.glow.list.length + this.star.list.length + this.puff.list.length;
  }
  _p(sys, x, y, z, o) {
    const c = o.c instanceof THREE.Color ? o.c : new THREE.Color(o.c ?? 0xffffff);
    return sys.add({ x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g ?? 0, drag: o.drag ?? 1.5, t: 0, life: o.life ?? 0.6, s0: o.s0 ?? 0.3, s1: o.s1 ?? o.s0 ?? 0.3, c, a: o.a ?? 1, r: o.r ?? Math.random() * 6, spin: o.spin ?? 0, floor: o.floor ?? 0.02, fade: o.fade ?? 1 });
  }
  /** 사방으로 튀는 빛 알갱이 */
  sparks(x, y, z, n, color, speed = 3, size = 0.18, life = 0.5, g = 4) {
    size *= 1.5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 1.6 - 0.6;
      const sp = speed * rand(0.4, 1.1);
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      this._p(this.glow, x, y, z, { vx: Math.cos(a) * r * sp, vy: u * sp + speed * 0.3, vz: Math.sin(a) * r * sp, g, drag: 2.5, life: life * rand(0.6, 1.2), s0: size * rand(0.8, 1.3), s1: size * 0.2, c: color });
    }
  }
  stars(x, y, z, n, color, speed = 2, size = 0.35) {
    size *= 1.3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this._p(this.star, x, y, z, { vx: Math.cos(a) * speed * rand(0.4, 1), vy: rand(1, 2.5), vz: Math.sin(a) * speed * rand(0.4, 1), g: 3, drag: 2, life: rand(0.45, 0.75), s0: size * rand(0.7, 1.2), s1: 0.02, c: color, spin: rand(-4, 4) });
    }
  }
  /** 연기 · 먼지 뭉치 */
  smoke(x, y, z, n, color = 0xffffff, size = 0.6, speed = 1.2, life = 0.9, a = 0.75, up = 0.6) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * rand(0.3, 1);
      this._p(this.puff, x + Math.cos(ang) * 0.1, y, z + Math.sin(ang) * 0.1, { vx: Math.cos(ang) * sp, vy: up * rand(0.5, 1.4), vz: Math.sin(ang) * sp, drag: 3, life: life * rand(0.7, 1.2), s0: size * rand(0.5, 0.8), s1: size * rand(1.2, 1.7), c: color, a, spin: rand(-1, 1) });
    }
  }
  /** 땅을 따라 둥글게 퍼지는 먼지 */
  dustRing(x, z, r, n, color = 0xf2e6cc, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      this._p(this.puff, x + Math.cos(a) * r * 0.3, 0.12, z + Math.sin(a) * r * 0.3, { vx: Math.cos(a) * r * 2.2, vy: 0.3, vz: Math.sin(a) * r * 2.2, drag: 4, life: rand(0.5, 0.8), s0: size * 0.6, s1: size * 1.4, c: color, a: 0.7 });
    }
  }
  /** 위로 떠오르는 알갱이 (치유 · 마법) */
  rise(x, y, z, n, color, size = 0.22, spread = 0.4) {
    for (let i = 0; i < n; i++) this._p(this.glow, x + rand(-spread, spread), y + rand(0, 0.3), z + rand(-spread, spread), { vy: rand(0.8, 1.6), drag: 0.5, life: rand(0.6, 1.0), s0: size, s1: size * 0.3, c: color });
  }
  /** 날아가는 것 뒤 꼬리 */
  trail(x, y, z, color, size = 0.16, life = 0.25, puff = false) {
    if (puff) this._p(this.puff, x, y, z, { vy: 0.2, drag: 2, life, s0: size, s1: size * 1.8, c: color, a: 0.55 });
    else this._p(this.glow, x, y, z, { life, s0: size, s1: size * 0.2, c: color, a: 0.9 });
  }

  /* ---------- 메시 효과 (통) ---------- */
  flash(x, y, z, color, size = 2, life = 0.18) {
    let f = this.flashes.find((q) => !q.on);
    if (!f) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.renderOrder = 31;
      this.root.add(s);
      f = { s };
      this.flashes.push(f);
    }
    f.on = true;
    f.t = 0;
    f.life = life;
    f.size = size;
    f.s.visible = true;
    f.s.position.set(x, y, z);
    f.s.material.color.set(color);
  }
  ring(x, z, r, color, life = 0.45, y = 0.08, width = 1) {
    let q = this.rings.find((o) => !o.on);
    if (!q) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, depthWrite: false }));
      m.renderOrder = 28;
      this.root.add(m);
      q = { m };
      this.rings.push(q);
    }
    q.on = true;
    q.t = 0;
    q.life = life;
    q.r = r;
    q.w = width;
    q.m.visible = true;
    q.m.position.set(x, y, z);
    q.m.material.color.set(color);
  }
  scorch(x, z, r, color = 0x2a1a12, life = 2.2) {
    let q = this.scorches.find((o) => !o.on);
    if (!q) {
      if (this.scorches.length > 14) q = this.scorches.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b));
      else {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false }));
        m.renderOrder = 3;
        this.root.add(m);
        q = { m };
        this.scorches.push(q);
      }
    }
    q.on = true;
    q.t = 0;
    q.life = life;
    q.m.visible = true;
    q.m.position.set(x, 0.035, z);
    q.m.scale.setScalar(r);
    q.m.rotation.y = Math.random() * 6;
    q.m.material.color.set(color);
  }
  /** 굵은 번개: pts 를 지그재그로 이은 빛 띠 (가운데 흰 줄 + 바깥 색 빛) */
  bolt(pts, color = 0x9ad8ff, width = 0.16, life = 0.2) {
    let q = this.bolts.find((o) => !o.on);
    if (!q) {
      const mk = (w, c, o) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(64 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(64 * 2 * 2), 2));
        const idx = [];
        for (let i = 0; i < 63; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
        g.setIndex(idx);
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.frustumCulled = false;
        m.renderOrder = 32;
        m.userData.w = w;
        this.root.add(m);
        return m;
      };
      q = { core: mk(1, 0xffffff, 1), glow: mk(3.2, color, 0.55) };
      this.bolts.push(q);
    }
    q.on = true;
    q.t = 0;
    q.life = life;
    q.glow.material.color.set(color);
    // 지그재그 점 만들기
    const line = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const n = Math.max(2, Math.min(10, Math.round(L * 2.5)));
      for (let j = 0; j < n; j++) {
        const f = j / n;
        const jit = j === 0 ? 0 : 0.22 * Math.min(1, L / 2);
        line.push({ x: a.x + (b.x - a.x) * f + rand(-jit, jit), y: a.y + (b.y - a.y) * f + rand(-jit, jit), z: a.z + (b.z - a.z) * f + rand(-jit, jit) });
      }
    }
    line.push(pts[pts.length - 1]);
    q.line = line.slice(0, 64);
    q.width = width;
    for (const m of [q.core, q.glow]) m.visible = true;
  }
  /** 금화: 적 자리에서 튀어 오르며 돌다 사라짐 */
  coin(x, z, n = 1) {
    for (let i = 0; i < n; i++) {
      let q = this.coins.find((o) => !o.on);
      if (!q) {
        if (this.coins.length >= 36) return;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 14).rotateX(Math.PI / 2), this.coinMat);
        m.castShadow = false;
        this.root.add(m);
        q = { m };
        this.coins.push(q);
      }
      const a = Math.random() * Math.PI * 2;
      q.on = true;
      q.t = 0;
      q.life = 0.85;
      q.x = x;
      q.z = z;
      q.y = 0.5;
      q.vx = Math.cos(a) * rand(0.4, 1.1);
      q.vz = Math.sin(a) * rand(0.4, 1.1);
      q.vy = rand(3.2, 4.4);
      q.m.visible = true;
      q.m.scale.setScalar(1);
    }
  }

  update(dt, camera) {
    this.glow.update(dt);
    this.star.update(dt);
    this.puff.update(dt);
    for (const f of this.flashes) {
      if (!f.on) continue;
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) {
        f.on = false;
        f.s.visible = false;
        continue;
      }
      f.s.scale.setScalar(f.size * (0.5 + 0.7 * Math.sqrt(k)));
      f.s.material.opacity = 1 - k;
    }
    for (const q of this.rings) {
      if (!q.on) continue;
      q.t += dt;
      const k = q.t / q.life;
      if (k >= 1) {
        q.on = false;
        q.m.visible = false;
        continue;
      }
      const e = 1 - (1 - k) ** 3;
      q.m.scale.setScalar(Math.max(0.05, q.r * (0.15 + 0.85 * e)));
      q.m.material.opacity = (1 - k) * 0.95;
    }
    for (const q of this.scorches) {
      if (!q.on) continue;
      q.t += dt;
      const k = q.t / q.life;
      if (k >= 1) {
        q.on = false;
        q.m.visible = false;
        continue;
      }
      q.m.material.opacity = 0.55 * Math.min(1, (1 - k) * 2.5);
    }
    const right = new THREE.Vector3();
    if (camera) right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    for (const q of this.bolts) {
      if (!q.on) continue;
      q.t += dt;
      if (q.t >= q.life) {
        q.on = false;
        q.core.visible = q.glow.visible = false;
        continue;
      }
      const fl = 1 - q.t / q.life;
      for (const m of [q.core, q.glow]) {
        const w = q.width * m.userData.w * (0.6 + 0.4 * fl);
        const arr = m.geometry.attributes.position.array;
        const n = q.line.length;
        for (let i = 0; i < 64; i++) {
          const p = q.line[Math.min(i, n - 1)];
          arr[i * 6] = p.x - right.x * w;
          arr[i * 6 + 1] = p.y - right.y * w + 0.0;
          arr[i * 6 + 2] = p.z - right.z * w;
          arr[i * 6 + 3] = p.x + right.x * w;
          arr[i * 6 + 4] = p.y + right.y * w;
          arr[i * 6 + 5] = p.z + right.z * w;
        }
        m.geometry.attributes.position.needsUpdate = true;
        m.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
        m.material.opacity = (m === q.core ? 1 : 0.55) * fl;
      }
    }
    for (const q of this.coins) {
      if (!q.on) continue;
      q.t += dt;
      if (q.t >= q.life) {
        q.on = false;
        q.m.visible = false;
        continue;
      }
      q.vy -= 11 * dt;
      q.x += q.vx * dt;
      q.z += q.vz * dt;
      q.y = Math.max(0.12, q.y + q.vy * dt);
      if (q.y <= 0.12 && q.vy < 0) q.vy *= -0.35;
      q.m.position.set(q.x, q.y, q.z);
      q.m.rotation.y += dt * 14;
      const k = q.t / q.life;
      q.m.scale.setScalar(k > 0.7 ? Math.max(0.01, (1 - k) / 0.3) : 1);
    }
  }
  clear() {
    for (const s of [this.glow, this.star, this.puff]) s.list.length = 0;
    for (const arr of [this.flashes, this.rings, this.scorches, this.coins])
      for (const q of arr) {
        q.on = false;
        (q.s || q.m).visible = false;
      }
    for (const q of this.bolts) {
      q.on = false;
      q.core.visible = q.glow.visible = false;
    }
  }
}
export { tmpC };
