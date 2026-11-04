/* 입자(먼지 · 연기 · 불 · 불꽃) · 타이어 자국 · 충격파 · 속도선 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

const VS = `
attribute float aSize;
attribute vec4 aCol;
varying vec4 vCol;
uniform float uScale;
void main(){
  vCol = aCol;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(0.1, -mv.z);
  vCol.a *= smoothstep(1.2, 5.0, d);
  gl_PointSize = min(aSize * uScale / d, 240.0);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying vec4 vCol;
uniform float uSoft;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a = pow(1.0 - d, uSoft);
  gl_FragColor = vec4(vCol.rgb, vCol.a * a);
}`;

class Cloud {
  constructor(scene, max, additive, soft) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.items = new Array(max);
    for (let i = 0; i < max; i += 1) this.items[i] = { life: 0 };
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aCol", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 }, uSoft: { value: soft } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
    this.geo = g;
  }

  add(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0) {
    const it = this.items[this.head];
    this.head = (this.head + 1) % this.max;
    it.x = x;
    it.y = y;
    it.z = z;
    it.vx = vx;
    it.vy = vy;
    it.vz = vz;
    it.life = life;
    it.max = life;
    it.s0 = s0;
    it.s1 = s1;
    it.r = r;
    it.g = g;
    it.b = b;
    it.a = a;
    it.grav = grav;
    it.drag = drag;
  }

  update(dt) {
    let w = 0;
    const { pos, col, size, items, max } = this;
    for (let i = 0; i < max; i += 1) {
      const p = items[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      const k = p.life / p.max;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d - p.grav * dt;
      p.vz *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      pos[w * 3] = p.x;
      pos[w * 3 + 1] = p.y;
      pos[w * 3 + 2] = p.z;
      col[w * 4] = p.r;
      col[w * 4 + 1] = p.g;
      col[w * 4 + 2] = p.b;
      col[w * 4 + 3] = p.a * Math.min(1, k * 2.2);
      size[w] = p.s1 + (p.s0 - p.s1) * k;
      w += 1;
    }
    this.geo.setDrawRange(0, w);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aCol.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}

export class FX {
  constructor(scene, level, quality = 1) {
    this.scene = scene;
    this.level = level;
    const k = quality;
    this.soft = new Cloud(scene, Math.round(560 * k), false, 1.4);
    this.hot = new Cloud(scene, Math.round(520 * k), true, 1.1);
    this.k = k;
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i += 1) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false;
      m.renderOrder = 4;
      scene.add(m);
      this.rings.push({ m, t: 0, dur: 1, r: 1, op: 1 });
    }
    this.ringI = 0;
    const ballGeo = new THREE.SphereGeometry(1, 16, 10);
    this.balls = [];
    for (let i = 0; i < 6; i += 1) {
      const m = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: "#ffcf7a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false;
      m.renderOrder = 7;
      scene.add(m);
      this.balls.push({ m, t: 0, dur: 1, r: 1 });
    }
    this.ballI = 0;
    this.flash = new THREE.PointLight("#ffb060", 0, 60, 1.6);
    scene.add(this.flash);
    this.flashT = 0;
    this.initSkids();
  }

  setScale(px) {
    this.soft.mat.uniforms.uScale.value = px;
    this.hot.mat.uniforms.uScale.value = px;
  }

  initSkids() {
    const max = Math.round(1400 * this.k);
    this.skMax = max;
    this.skI = 0;
    this.skPos = new Float32Array(max * 6 * 3);
    this.skA = new Float32Array(max * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.skPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aA", new THREE.BufferAttribute(this.skA, 1).setUsage(THREE.DynamicDrawUsage));
    this.skMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      vertexShader: "attribute float aA;varying float v;void main(){v=aA;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying float v;void main(){gl_FragColor=vec4(0.07,0.055,0.045,v);}",
    });
    this.skMesh = new THREE.Mesh(g, this.skMat);
    this.skMesh.frustumCulled = false;
    this.skMesh.renderOrder = 2;
    this.scene.add(this.skMesh);
    this.skLast = [null, null, null, null];
  }

  /** 바퀴 자국 한 칸 */
  skid(i, x, y, z, width, alpha) {
    const last = this.skLast[i];
    if (!last) {
      this.skLast[i] = { x, y, z };
      return;
    }
    const dx = x - last.x;
    const dz = z - last.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.9) return;
    this.skLast[i] = { x, y, z };
    if (len > 4) return;
    const nx = (-dz / len) * width * 0.5;
    const nz = (dx / len) * width * 0.5;
    const o = this.skI * 18;
    const P = this.skPos;
    const quad = [last.x + nx, last.y, last.z + nz, last.x - nx, last.y, last.z - nz, x + nx, y, z + nz, x + nx, y, z + nz, last.x - nx, last.y, last.z - nz, x - nx, y, z - nz];
    for (let k = 0; k < 18; k += 1) P[o + k] = quad[k];
    for (let k = 0; k < 6; k += 1) this.skA[this.skI * 6 + k] = alpha;
    this.skI = (this.skI + 1) % this.skMax;
    this.skMesh.geometry.attributes.position.needsUpdate = true;
    this.skMesh.geometry.attributes.aA.needsUpdate = true;
  }

  skidBreak(i) {
    this.skLast[i] = null;
  }

  dust(x, y, z, n = 4, power = 3, color = [0.72, 0.6, 0.44], big = 1) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * 6.28;
      const sp = Math.random() * power;
      this.soft.add(x + (Math.random() - 0.5) * 0.8, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.8, Math.cos(a) * sp, 0.6 + Math.random() * power * 0.4, Math.sin(a) * sp, 0.55 + Math.random() * 0.6, (1.0 + Math.random()) * big, (3 + Math.random() * 2.4) * big, color[0], color[1], color[2], 0.5, 0, 1.6);
    }
  }

  smoke(x, y, z, n = 1, dark = 0.2, size = 2.2) {
    for (let i = 0; i < n; i += 1) {
      this.soft.add(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.8, 1.4 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.8, size * 0.35, size * 1.4, dark, dark, dark + 0.02, 0.42, -0.4, 0.7);
    }
  }

  sparks(x, y, z, n = 8, power = 9, color = [1, 0.78, 0.32]) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * 6.28;
      const u = Math.random() * 1.2;
      const sp = power * (0.35 + Math.random());
      this.hot.add(x, y, z, Math.cos(a) * sp, u * sp * 0.8 + 1.6, Math.sin(a) * sp, 0.25 + Math.random() * 0.4, 0.45, 0.1, color[0], color[1], color[2], 1, 20, 0.6);
    }
  }

  ring(x, y, z, r, dur = 0.5, color = "#fff2d0", op = 0.9) {
    const R = this.rings[this.ringI];
    this.ringI = (this.ringI + 1) % this.rings.length;
    R.t = 0;
    R.dur = dur;
    R.r = r;
    R.op = op;
    R.m.position.set(x, y + 0.2, z);
    R.m.material.color.set(color);
    R.m.visible = true;
  }

  fireBall(x, y, z, r) {
    const B = this.balls[this.ballI];
    this.ballI = (this.ballI + 1) % this.balls.length;
    B.t = 0;
    B.dur = 0.34;
    B.r = r;
    B.m.position.set(x, y, z);
    B.m.visible = true;
  }

  explosion(x, y, z, r = 11) {
    const k = this.k;
    this.fireBall(x, y + 1, z, r * 0.62);
    this.ring(x, this.level.height(x, z), z, r * 1.05, 0.5, "#ffc98a", 1);
    this.flash.position.set(x, y + 2, z);
    this.flash.intensity = 240;
    this.flashT = 0.2;
    for (let i = 0; i < 46 * k; i += 1) {
      const a = Math.random() * 6.28;
      const u = Math.random() * 0.9 + 0.1;
      const sp = 4 + Math.random() * 13;
      const hot = Math.random();
      this.hot.add(x, y + 0.8, z, Math.cos(a) * sp * (1 - u * 0.6), u * sp, Math.sin(a) * sp * (1 - u * 0.6), 0.3 + Math.random() * 0.45, 2.6 + Math.random() * 3.4, 0.6, 1, 0.45 + hot * 0.4, 0.1 + hot * 0.12, 1, 2, 2.2);
    }
    for (let i = 0; i < 26 * k; i += 1) {
      const a = Math.random() * 6.28;
      const sp = 1 + Math.random() * 6;
      const g = 0.1 + Math.random() * 0.14;
      this.soft.add(x, y + 1, z, Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp, 1 + Math.random() * 1.2, 2, 7 + Math.random() * 3, g, g, g, 0.6, -0.5, 1.2);
    }
    this.sparks(x, y + 1, z, 24 * k, 17);
  }

  /** 불꽃 기둥 */
  flame(x, y, z, h = 9) {
    this.hot.add(x + (Math.random() - 0.5) * 1.3, y + 0.2, z + (Math.random() - 0.5) * 1.3, (Math.random() - 0.5) * 1.6, h + Math.random() * 5, (Math.random() - 0.5) * 1.6, 0.42 + Math.random() * 0.35, 3, 0.8, 1, 0.45 + Math.random() * 0.35, 0.1, 1, 0, 0.3);
  }

  ember(x, y, z) {
    this.hot.add(x, y, z, (Math.random() - 0.5) * 1.2, 1 + Math.random() * 2.2, (Math.random() - 0.5) * 1.2, 1.2 + Math.random(), 0.5, 0.1, 1, 0.55, 0.2, 1, -0.2, 0);
  }

  update(dt) {
    this.soft.update(dt);
    this.hot.update(dt);
    for (const R of this.rings) {
      if (!R.m.visible) continue;
      R.t += dt;
      const k = R.t / R.dur;
      if (k >= 1) {
        R.m.visible = false;
        continue;
      }
      const s = R.r * (1 - Math.pow(1 - k, 3));
      R.m.scale.set(s, 1, s);
      R.m.material.opacity = (1 - k) * R.op;
    }
    for (const B of this.balls) {
      if (!B.m.visible) continue;
      B.t += dt;
      const k = B.t / B.dur;
      if (k >= 1) {
        B.m.visible = false;
        continue;
      }
      const s = B.r * (0.35 + 0.65 * Math.sqrt(k));
      B.m.scale.setScalar(s);
      B.m.material.opacity = (1 - k) * 0.85;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity = Math.max(0, this.flashT / 0.2) * 240;
    } else this.flash.intensity = 0;
  }

  dispose() {
    this.soft.dispose(this.scene);
    this.hot.dispose(this.scene);
    for (const R of this.rings) {
      this.scene.remove(R.m);
      R.m.material.dispose();
    }
    for (const B of this.balls) {
      this.scene.remove(B.m);
      B.m.material.dispose();
    }
    this.scene.remove(this.flash);
    this.scene.remove(this.skMesh);
    this.skMesh.geometry.dispose();
    this.skMat.dispose();
  }
}
