/*
 * 드래곤 석상 대작전 · 한 판에 놓이는 것들
 *  석상(솟아오름 · 가라앉음 · 흔들림 · 깨짐) · 뒤 줄 계단 · 보스 수호자(봉인 3개) · 빛줄기
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { makeStatue, statueGeometry, PED_R } from "./statues.js?v=1";
import { stoneTex, stoneBump, dotTex } from "./tex.js?v=1";
import { FLOOR } from "./layout.js?v=1";

const easeOutBack = (t) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeIn = (t) => t * t;

export function typeInfo(id) {
  const g = statueGeometry(id);
  return { halfW: g.width / 2, radius: g.radius };
}

export class StageView {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.statues = [];
    this.terraceMeshes = [];
    this.guardian = null;
    this.beams = [];
    this.theme = null;
    this.terraceMat = null;
  }

  setTheme(T) {
    if (this.theme === T) return;
    this.theme = T;
    if (this.terraceMat) this.terraceMat.dispose();
    const map = stoneTex(11).clone();
    map.needsUpdate = true;
    map.repeat.set(3, 0.6);
    this.terraceMap && this.terraceMap.dispose();
    this.terraceMap = map;
    this.terraceMat = new THREE.MeshStandardMaterial({ color: T.base, map, bumpMap: stoneBump(11), bumpScale: 1.2, roughness: 0.94 });
    this.topMat && this.topMat.dispose();
    this.topMat = new THREE.MeshStandardMaterial({ color: T.ground, map: stoneTex(12), roughness: 0.92 });
  }

  /** 계단 (뒤 줄 받침대) */
  buildTerraces(terraces) {
    this.clearTerraces();
    for (const t of terraces) {
      const w = t.x1 - t.x0;
      const d = t.z0 - t.z1;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, t.h, d), [this.terraceMat, this.terraceMat, this.topMat, this.terraceMat, this.terraceMat, this.terraceMat]);
      box.position.set((t.x0 + t.x1) / 2, FLOOR + t.h / 2 - 0.001, (t.z0 + t.z1) / 2);
      box.receiveShadow = true;
      box.castShadow = true;
      this.group.add(box);
      // 앞 모서리 장식 줄
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.08, 0.12), this.terraceMat);
      lip.position.set(box.position.x, FLOOR + t.h + 0.02, t.z0 - 0.04);
      lip.castShadow = true;
      this.group.add(lip);
      this.terraceMeshes.push(box, lip);
    }
  }
  clearTerraces() {
    for (const m of this.terraceMeshes) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.terraceMeshes = [];
  }

  /** 석상 놓기 (처음엔 땅속 → rise() 로 솟아오른다) */
  placeStatues(list) {
    this.clearStatues();
    const T = this.theme;
    this.statues = list.map((s, i) => {
      const mesh = makeStatue(s.typeId, T);
      mesh.position.set(s.x, s.y - s.scale * 1.08, s.z);
      mesh.rotation.y = s.yaw;
      mesh.scale.setScalar(s.scale);
      mesh.visible = false;
      this.group.add(mesh);
      return { ...s, i, mesh, state: "hidden", t: 0, wob: 0, gone: false, wrong: false, hinted: false };
    });
    return this.statues;
  }
  clearStatues() {
    for (const s of this.statues) {
      this.group.remove(s.mesh);
      if (s.stub) {
        this.group.remove(s.stub);
        s.stub.geometry.dispose();
      }
    }
    this.statues = [];
  }
  /** 차례로 솟아오르기 */
  rise(stagger = 0.07) {
    this.statues.forEach((s, k) => {
      s.state = "rise";
      s.t = -k * stagger;
      s.dusted = false;
    });
  }
  sink() {
    for (const s of this.statues) {
      if (s.gone) continue;
      s.state = "sink";
      s.t = 0;
    }
  }
  /** 화면 비율이 바뀌었을 때 크기만 다시 맞춘다 */
  rescale(list) {
    list.forEach((d, i) => {
      const s = this.statues[i];
      if (!s) return;
      s.scale = d.scale;
      s.mesh.scale.setScalar(d.scale);
    });
  }
  wobble(s) {
    s.wob = 1;
  }
  breakStatue(s) {
    s.gone = true;
    s.mesh.visible = false;
    // 깨진 받침 조각만 남긴다
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(PED_R * 0.92, PED_R, 0.16, 8), this.terraceMat);
    stub.scale.setScalar(s.scale);
    stub.position.set(s.x, s.y + 0.08 * s.scale, s.z);
    stub.castShadow = stub.receiveShadow = true;
    this.group.add(stub);
    s.stub = stub;
  }

  /* ---------------- 보스 수호자 ---------------- */
  buildGuardian(b) {
    this.clearGuardian();
    if (!b) return;
    const T = this.theme;
    const g = new THREE.Group();
    const st = makeStatue("ancient", T);
    st.scale.setScalar(b.scale);
    g.add(st);
    // 받침대 (높은 제단)
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(b.scale * 0.42, b.scale * 0.5, b.y - FLOOR + 0.05, 10), this.terraceMat);
    podium.position.y = -(b.y - FLOOR) / 2;
    podium.receiveShadow = podium.castShadow = true;
    g.add(podium);
    g.position.set(b.x, b.y, b.z);
    // 봉인 구슬 3개 (가슴 앞에 떠 있다)
    const seals = [];
    const sm = new THREE.MeshStandardMaterial({ color: T.crystal, emissive: T.crystal, emissiveIntensity: 0.8, roughness: 0.15, transparent: true, opacity: 0.92 });
    for (let k = 0; k < 3; k++) {
      const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), sm);
      o.position.set((k - 1) * 1.05, b.scale * 0.55 + (k === 1 ? 0.35 : 0), b.scale * 0.42);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: T.crystal, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(0.95);
      halo.material.opacity = 0.55;
      o.add(halo);
      g.add(o);
      seals.push({ m: o, gone: false, base: o.position.clone() });
    }
    // 눈빛
    const eyes = new THREE.PointLight(T.glow, 0, 6, 1.5);
    eyes.position.set(0, b.scale * 0.85, b.scale * 0.35);
    g.add(eyes);
    this.group.add(g);
    this.guardian = { g, statue: st, seals, eyes, b, shake: 0, sm, t: 0, gone: false };
    return this.guardian;
  }
  clearGuardian() {
    if (!this.guardian) return;
    const G = this.guardian;
    this.group.remove(G.g);
    // 석상 모양은 같이 쓰는 것이라 두고, 받침대 · 봉인 구슬 · 빛만 정리
    G.g.traverse((o) => {
      if (o.isMesh && o.parent === G.g && o !== G.statue) o.geometry.dispose();
      if (o.isSprite) o.material.dispose();
    });
    for (const s of G.seals) s.m.geometry.dispose();
    G.sm.dispose();
    this.guardian = null;
  }
  sealPos(k) {
    const G = this.guardian;
    const p = G.seals[k].m.getWorldPosition(new THREE.Vector3());
    return p;
  }
  /** 빛줄기: a → b (0.45초) */
  beam(a, b, color) {
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(0.07, 0.16, len, 8, 1, true);
    geo.translate(0, len / 2, 0);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a);
    m.lookAt(b);
    this.group.add(m);
    this.beams.push({ m, life: 0.5 });
  }

  update(dt, t) {
    for (const s of this.statues) {
      if (s.state === "rise") {
        s.t += dt;
        if (s.t < 0) continue;
        s.mesh.visible = true;
        if (!s.dusted) {
          s.dusted = true;
          this.fx.rise(s, s.scale);
        }
        const k = Math.min(1, s.t / 0.5);
        s.mesh.position.y = s.y - s.scale * 1.08 * (1 - easeOutBack(k));
        if (k >= 1) {
          s.state = "idle";
          s.mesh.position.y = s.y;
        }
      } else if (s.state === "sink") {
        s.t += dt;
        const k = Math.min(1, s.t / 0.4);
        s.mesh.position.y = s.y - s.scale * 1.1 * easeIn(k);
        if (k >= 1) {
          s.state = "hidden";
          s.mesh.visible = false;
        }
      }
      if (s.wob > 0) {
        s.wob = Math.max(0, s.wob - dt * 2.2);
        s.mesh.rotation.z = Math.sin(t * 38) * 0.07 * s.wob;
        s.mesh.rotation.x = Math.sin(t * 31) * 0.035 * s.wob;
      } else if (s.mesh.rotation.z) {
        s.mesh.rotation.z = 0;
        s.mesh.rotation.x = 0;
      }
    }
    const G = this.guardian;
    if (G && !G.gone) {
      G.t += dt;
      G.seals.forEach((s, k) => {
        if (s.gone) return;
        s.m.position.y = s.base.y + Math.sin(G.t * 2 + k * 2) * 0.12;
        s.m.rotation.y += dt * 1.5;
      });
      if (G.shake > 0) {
        G.shake = Math.max(0, G.shake - dt * 1.6);
        G.g.position.x = G.b.x + Math.sin(G.t * 50) * 0.08 * G.shake;
        G.eyes.intensity = 12 * G.shake;
      }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      b.m.material.opacity = Math.max(0, b.life / 0.5) * 0.9;
      b.m.scale.x = b.m.scale.y = 1 + (0.5 - b.life) * 2;
      if (b.life <= 0) {
        this.group.remove(b.m);
        b.m.geometry.dispose();
        b.m.material.dispose();
        this.beams.splice(i, 1);
      }
    }
  }

  clear() {
    this.clearStatues();
    this.clearTerraces();
    this.clearGuardian();
    for (const b of this.beams) this.group.remove(b.m);
    this.beams = [];
  }
}
