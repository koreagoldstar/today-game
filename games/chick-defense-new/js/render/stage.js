/*
 * 렌더러 · 카메라 · 조명
 *  카메라: 대각선 위 고정 시점. 화면이 세로로 길면 전장을 90° 돌려 긴 쪽을 세로로 → 휴대폰에서도 크게.
 *  화면 위 · 아래 버튼 영역(insets)을 빼고 전장 전체가 들어오게 거리를 맞춘다.
 *  그래픽 설정: high / medium / low — 해상도 · 그림자 · 효과 수
 */
import { THREE, FX } from "./kit.js";
import { LOOK } from "./look.js";

export const QUALITY = {
  high: { ratio: 2, shadow: 2048, aa: true, particles: 700 },
  medium: { ratio: 1.5, shadow: 1024, aa: true, particles: 420 },
  low: { ratio: 1, shadow: 0, aa: false, particles: 220 },
};
const PITCH = 0.93; // 카메라 내려다보는 각 (약 53°) — 먼 언덕 · 랜드마크가 보여 깊이감

export class Stage {
  constructor(canvas, quality = "medium") {
    this.canvas = canvas;
    this.qKey = QUALITY[quality] ? quality : "medium";
    this.q = QUALITY[this.qKey];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.aa, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 색감: 영화식 톤 매핑으로 밝은 곳이 하얗게 날아가지 않고 색이 진하게
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    // 하늘: 위는 진하고 지평선은 안개색인 둥근 하늘
    const skyGeo = new THREE.SphereGeometry(150, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(0x6ab8ff) }, mid: { value: new THREE.Color(0xbfe6ff) }, bot: { value: new THREE.Color(0xe8f6ff) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bot, smoothstep(0.0, -0.3, h)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}",
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.position.set(11, 0, 7);
    this.sky.renderOrder = -10;
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 240);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    this.scene.add(this.hemi);
    this.scene.add(this.sky);
    this.amb = new THREE.AmbientLight(0xffffff, 0.12);
    this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.position.set(2, 20, -4);
    this.sun.target.position.set(11, 0, 7);
    this.scene.add(this.sun, this.sun.target);
    const sc = this.sun.shadow.camera;
    sc.left = -17;
    sc.right = 17;
    sc.top = 15;
    sc.bottom = -15;
    sc.near = 1;
    sc.far = 70;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.applyQuality();
    this.view = { w: 1, h: 1, ins: { top: 0, bottom: 0, left: 0, right: 0 } };
    this.target = new THREE.Vector3(11, 0, 7);
    this.yaw = 0;
    this.dist = 30;
    this.shake = 0;
    this.focus = null; // 보스 등장 때 잠깐 다가감 { x, z, t, dur }
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmp = new THREE.Vector3();
  }
  setQuality(k) {
    if (!QUALITY[k]) return;
    this.qKey = k;
    this.q = QUALITY[k];
    this.applyQuality();
    this.resize(this.view.w, this.view.h, this.view.ins);
  }
  applyQuality() {
    const r = this.renderer;
    FX.outline = this.qKey !== "low";
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.ratio));
    r.shadowMap.enabled = this.q.shadow > 0;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = this.q.shadow > 0;
    if (this.q.shadow > 0) {
      this.sun.shadow.mapSize.set(this.q.shadow, this.q.shadow);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }
  /** 월드 분위기: 하늘 · 안개 · 햇빛 방향 · 반구광 · 주변 반사광(환경맵) · 노출 — look.js 규칙대로 */
  setTheme(th, key) {
    const L = LOOK[key] || null;
    if (!L) return this.setOldTheme(th);
    if (this.lookKey === key) return;
    this.lookKey = key;
    this.scene.background = new THREE.Color(L.sky.mid);
    this.scene.fog = new THREE.Fog(L.fog.color, L.fog.near, L.fog.far);
    this.skyMat.uniforms.top.value.set(L.sky.top);
    this.skyMat.uniforms.mid.value.set(L.sky.mid);
    this.skyMat.uniforms.bot.value.set(L.fog.color);
    this.hemi.color.set(L.hemi.sky);
    this.hemi.groundColor.set(L.hemi.ground);
    this.hemi.intensity = L.hemi.k;
    this.amb.color.set(L.hemi.sky);
    this.amb.intensity = 0.12;
    this.sun.color.set(L.sun.color);
    this.sun.intensity = L.sun.k;
    const d = new THREE.Vector3(...L.sun.dir).normalize();
    this.sun.position.set(11 + d.x * 30, d.y * 30, 7 + d.z * 30);
    this.sun.target.position.set(11, 0, 7);
    this.sun.target.updateMatrixWorld();
    this.renderer.toneMappingExposure = L.exposure;
    // 주변 반사광: 하늘 · 땅 색의 둥근 그림을 흐리게 구워 재질에 비춤 (그늘도 하늘색 · 땅색이 비침)
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(L.sky.top).lerp(new THREE.Color(0xffffff), 0.35) }, mid: { value: new THREE.Color(L.sky.mid) }, bot: { value: new THREE.Color(L.hemi.ground) }, sun: { value: new THREE.Color(L.sun.color) }, sd: { value: d } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sun; uniform vec3 sd; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, bot, smoothstep(0.0, -0.25, h)); c += sun * pow(max(dot(vP, sd), 0.0), 24.0) * 2.0; gl_FragColor = vec4(c, 1.0); }",
    }));
    envScene.add(envSky);
    const rt = this.pmrem.fromScene(envScene, 0.04);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    envSky.geometry.dispose();
    envSky.material.dispose();
    FX.envK = L.env;
  }
  setOldTheme(th) {
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.fog, 62, 150);
    this.skyMat.uniforms.top.value.copy(new THREE.Color(th.sky).multiplyScalar(0.78));
    this.skyMat.uniforms.mid.value.set(th.fog);
    this.skyMat.uniforms.bot.value.set(th.fog);
    this.hemi.color.set(th.hemi[0]);
    this.hemi.groundColor.set(th.hemi[1]);
    this.sun.color.set(th.sun);
  }
  /** 화면 크기 · 위아래 버튼 영역 → 카메라 맞춤 */
  resize(w, h, ins) {
    this.view = { w, h, ins: ins || this.view.ins };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fit();
  }
  fit(field = { w: 22, d: 14 }) {
    const { w, h, ins } = this.view;
    const aw = Math.max(50, w - ins.left - ins.right);
    const ah = Math.max(50, h - ins.top - ins.bottom);
    this.yaw = aw / ah < 0.95 ? Math.PI / 2 : 0;
    this.field = field;
    this.camera.clearViewOffset();
    // 거리를 줄였다 늘였다 하며 네 모서리가 안전 영역에 들어오는 가장 가까운 거리 찾기
    const corners = [
      [-0.6, -0.6],
      [field.w + 0.6, -0.6],
      [-0.6, field.d + 0.6],
      [field.w + 0.6, field.d + 0.6],
    ];
    const cx = field.w / 2;
    const cz = field.d / 2;
    let lo = 8;
    let hi = 90;
    let best = hi;
    let off = { x: 0, y: 0 };
    for (let it = 0; it < 26; it++) {
      const d = (lo + hi) / 2;
      this.place(cx, cz, d);
      let minX = 1e9;
      let maxX = -1e9;
      let minY = 1e9;
      let maxY = -1e9;
      for (const [x, z] of corners) {
        this.tmp.set(x, 0, z).project(this.camera);
        const sx = (this.tmp.x * 0.5 + 0.5) * w;
        const sy = (-this.tmp.y * 0.5 + 0.5) * h;
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
      }
      if (maxX - minX <= aw && maxY - minY <= ah) {
        best = d;
        hi = d;
        off = { x: ins.left + aw / 2 - (minX + maxX) / 2, y: ins.top + ah / 2 - (minY + maxY) / 2 };
      } else lo = d;
    }
    this.dist = best;
    // 화면 중심을 안전 영역 중심으로 (카메라 시점 이동: 보이는 영상을 평행 이동)
    this.camera.setViewOffset(w, h, -off.x, -off.y, w, h);
    this.place(cx, cz, best);
  }
  place(cx, cz, d) {
    const pitch = PITCH;
    const c = this.camera;
    const yaw = this.yaw;
    c.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * d * -1, Math.sin(pitch) * d, cz + Math.cos(yaw) * Math.cos(pitch) * d);
    c.up.set(0, 1, 0);
    c.lookAt(cx, 0, cz);
    c.updateMatrixWorld();
    c.updateProjectionMatrix();
  }
  /** 매 프레임: 흔들림 · 보스 등장 다가가기 */
  update(dt, shakeOn) {
    const f = this.field || { w: 22, d: 14 };
    let cx = f.w / 2;
    let cz = f.d / 2;
    let d = this.dist;
    if (this.focus) {
      const F = this.focus;
      F.t += dt;
      const k = F.t < 0.5 ? F.t / 0.5 : F.t > F.dur - 0.5 ? Math.max(0, (F.dur - F.t) / 0.5) : 1;
      const e = k * k * (3 - 2 * k);
      cx += (F.x - cx) * e * 0.7;
      cz += (F.z - cz) * e * 0.7;
      d *= 1 - 0.45 * e;
      if (F.t >= F.dur) this.focus = null;
    }
    this.place(cx, cz, d);
    if (this.shake > 0 && shakeOn) {
      const s = this.shake * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.updateMatrixWorld();
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  /** 화면 좌표 → 땅 위 (x, z) */
  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return null;
    return { x: hit.x, z: hit.z };
  }
  /** 세계 → 화면 (px, 캔버스 기준) */
  project(x, y, z) {
    this.tmp.set(x, y, z).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * this.view.w, y: (-this.tmp.y * 0.5 + 0.5) * this.view.h, behind: this.tmp.z > 1 };
  }
}
