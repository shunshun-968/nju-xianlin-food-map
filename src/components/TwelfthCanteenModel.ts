import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { IndoorCanteenSpec } from '../data/indoor-canteens';
import { twelfthCanteenFaces } from '../data/twelfth-canteen';
import type { FourthCanteenModel } from './FourthCanteenModel';
import { addTwelfthSignage, twelfthTextPlane } from './twelfth-canteen-signage';
import { addTwelfthEquipment } from './twelfth-canteen-equipment';
import {
  createTwelfthFasciaMaterial,
  createTwelfthCounterMaterial,
} from './twelfth-canteen-materials';

/** East-facing row. Floor-local north is +X so the initial views read left to right. */
export function createTwelfthCanteenModel(spec: IndoorCanteenSpec): FourthCanteenModel {
  const group = new THREE.Group();
  group.name = 'twelfth-canteen-straight-row';
  const spatial = new THREE.Group();
  spatial.name = 'spatial-frontages';
  const plan = new THREE.Group();
  plan.name = 'plan-labels';
  group.add(spatial, plan);
  const roofs: THREE.Group[] = [];
  const animations: { tick: (time: number) => void }[] = [];
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const fasciaMaterial = createTwelfthFasciaMaterial();
  const counterMaterial = createTwelfthCounterMaterial();
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  function material(color: string, metalness = 0, glow = 0) {
    const key = `${color}/${metalness}/${glow}`;
    if (!cache.has(key))
      cache.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          metalness,
          roughness: metalness ? 0.42 : 0.78,
          emissive: glow ? color : '#000000',
          emissiveIntensity: glow,
        }),
      );
    return cache.get(key)!;
  }
  function box(
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    metalness = 0,
    glow = 0,
  ) {
    const m = new THREE.Mesh(cube, material(color, metalness, glow));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = m.receiveShadow = true;
    p.add(m);
    return m;
  }
  function rounded(
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.035), material(color));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    p.add(m);
    return m;
  }
  function ellipsoid(
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    const m = new THREE.Mesh(sphere, material(color));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = true;
    p.add(m);
    return m;
  }
  function label(
    text: string,
    x: number,
    z: number,
    w: number,
    h: number,
    ink = '#5e4537',
    bg = '#fff8e8',
  ) {
    const m = twelfthTextPlane(text, w, h, ink, bg);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 4.62, z);
    plan.add(m);
    return m;
  }
  // Neutral stone with subtle joints; no large baked-in reflections from source photographs.
  const stage = spec.stage;
  rounded(spatial, stage.x, -0.04, stage.z, stage.width, 0.28, stage.depth, '#c6bda8');
  box(spatial, stage.x, 0.11, stage.z, stage.width - 0.16, 0.06, stage.depth - 0.16, '#e5dfcf');
  for (let x = -stage.width / 2 + 1.2; x < stage.width / 2; x += 1.2)
    box(spatial, x, 0.143, stage.z, 0.012, 0.004, stage.depth - 0.2, '#c9c3b4');
  for (let z = stage.z - stage.depth / 2 + 1.2; z < stage.z + stage.depth / 2; z += 1.2)
    box(spatial, stage.x, 0.143, z, stage.width - 0.2, 0.004, 0.012, '#c9c3b4');
  box(spatial, 0, 0.146, 3.3, stage.width - 0.2, 0.005, 1.2, '#a8afa9');
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#dceceb',
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const face of twelfthCanteenFaces) {
    const room = new THREE.Group();
    room.name = `twelfth-section-${face.section}`;
    room.position.set(face.x, 0, face.z);
    spatial.add(room);
    const w = face.width;
    box(room, 0, 0.16, -1.6, w, 0.04, 5.2, '#c7c9bf');
    box(room, 0, 1.98, -4.2, w, 3.66, 0.14, '#dde3d9');
    for (let y = 0.7; y < 3.7; y += 0.5) box(room, 0, y, -4.12, w, 0.013, 0.006, '#bbc5bc');
    for (let x = -w / 2 + 0.5; x < w / 2; x += 0.65)
      box(room, x, 1.98, -4.12, 0.012, 3.64, 0.006, '#bbc5bc');
    // Pale bronze pilasters between sign sections, not separate boxes around each window.
    for (const side of [-1, 1])
      box(room, side * (w / 2 + 0.06), 2.03, -1.57, 0.12, 3.8, 5.26, '#aaa38e', 0.15);
    const roof = new THREE.Group();
    roof.name = `twelfth-roof-${face.section}`;
    roof.userData.planHide = true;
    room.add(roof);
    roofs.push(roof);
    box(roof, 0, 4.02, -1.62, w + 0.2, 0.16, 5.24, '#a48669');
    for (let x = -w / 2 + 0.1; x < w / 2; x += 0.27)
      box(roof, x, 3.92, -1.62, 0.09, 0.12, 5.2, '#86533b');
    for (const x of [-w * 0.28, w * 0.28]) {
      box(roof, x, 3.84, -0.15, 0.06, 0.035, 1.9, '#fff2cf', 0, 0.65);
      box(roof, x, 3.84, -2.9, 1.1, 0.04, 0.7, '#727d77', 0.35);
      for (let v = 0; v < 9; v++)
        box(roof, x - 0.48 + v * 0.12, 3.81, -2.9, 0.035, 0.02, 0.63, '#2c3633');
    }
    // Source photos show gold fluted counter fronts with black stone tops and feet.
    box(room, 0, 0.29, 0.48, w, 0.26, 1.12, '#272b27');
    box(room, 0, 0.71, 0.5, w, 0.72, 1.04, '#e0b55e', 0, 0.13);
    const illuminatedCounter = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.72), counterMaterial);
    illuminatedCounter.position.set(0, 0.71, 1.026);
    illuminatedCounter.name = `twelfth-gradient-counter-${face.section}`;
    room.add(illuminatedCounter);
    box(room, 0, 1.15, 0.5, w + 0.05, 0.13, 1.23, '#232c2a', 0.18);
    box(room, 0, 1.07, 1.03, w - 0.08, 0.025, 0.055, '#ffe4a0', 0, 0.55);
    box(room, 0, 1.79, 0.36, w, 0.055, 0.055, '#b3bcb6', 0.55);
    box(room, 0, 2.28, 0.36, w, 0.045, 0.05, '#9ca9a1', 0.55);
    for (let i = 0; i <= 4; i++)
      box(room, -w / 2 + (i * w) / 4, 2.03, 0.36, 0.045, 0.55, 0.055, '#a3b1a6', 0.55);
    for (let i = 0; i < 4; i++) {
      const center = -w / 2 + ((i + 0.5) * w) / 4;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w / 4 - 0.055, 0.45), glass);
      pane.position.set(center, 2.03, 0.36);
      room.add(pane);
      const window = new THREE.Group();
      window.name = `twelfth-window-${face.windowNumbers[i]}`;
      window.position.x = center;
      window.userData.stallId = `${face.faceId}-w${i + 1}`;
      room.add(window);
      animations.push(addTwelfthEquipment(window, face.windowNumbers[i], w / 4 - 0.12));
      const windowLight = new THREE.PointLight('#ffcc7b', 11, 4.6, 2);
      windowLight.name = `twelfth-warm-window-light-${face.windowNumbers[i]}`;
      windowLight.position.set(0, 2.12, -0.25);
      window.add(windowLight);
      box(window, 0, 2.28, -0.25, w / 4 - 0.15, 0.035, 0.08, '#ffe5ad', 0, 1.1);
      // Small red service notices and a ledge emphasize an occupied, working canteen.
      box(window, 0.58, 1.88, 0.4, 0.43, 0.17, 0.018, '#a84431');
      const notice = twelfthTextPlane('取餐处', 0.35, 0.09, '#fff0d6');
      notice.position.set(0.58, 1.89, 0.414);
      window.add(notice);
      const active = box(window, 0, 1.222, 1.09, w / 4 - 0.1, 0.023, 0.045, '#9b783c');
      active.material = active.material.clone();
      active.userData = { kind: 'stall', id: `${face.faceId}-w${i + 1}`, baseColor: '#9b783c' };
      const title =
        face.windowLabels[i] === '待补充' ? '售餐窗口' : face.windowLabels[i].split('／')[0];
      const tag = label(
        `${face.windowNumbers[i]} · ${title}`,
        face.x + center,
        -5.05,
        w / 4 - 0.1,
        0.6,
      );
      tag.userData = { ...tag.userData, kind: 'stall', id: `${face.faceId}-w${i + 1}` };
    }
    // The photographed red fluted lightbox is geometry, without baked fluorescent glare.
    box(room, 0, 3.4, 0.94, w, 0.96, 0.19, '#6b2a20', 0.12);
    const illuminatedFascia = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.96), fasciaMaterial);
    illuminatedFascia.position.set(0, 3.4, 1.061);
    illuminatedFascia.name = `twelfth-gradient-fascia-${face.section}`;
    room.add(illuminatedFascia);
    for (const y of [2.94, 3.86]) box(room, 0, y, 1.07, w - 0.06, 0.024, 0.025, '#ffad65', 0, 0.75);
    for (const x of [-w / 2 + 0.025, w / 2 - 0.025])
      box(room, x, 3.4, 1.07, 0.024, 0.93, 0.025, '#ffad65', 0, 0.75);
    addTwelfthSignage(room, face.section, w);
    label(face.name, face.x, -6.25, w - 0.3, 1, '#7a3a2a');
    // Sparse red hanging decorations, anchored to the removable ceiling only.
    for (const x of [-w * 0.28, w * 0.28]) {
      box(roof, x, 3.62, 1.45, 0.012, 0.46, 0.012, '#b5a174');
      ellipsoid(roof, x, 3.35, 1.45, 0.17, 0.19, 0.17, '#b33d2b');
      box(roof, x, 3.09, 1.45, 0.035, 0.18, 0.035, '#bf5c32');
    }
  }
  label('南  ←                     →  北', 0, 7.8, 7.5, 0.4, '#736350', '');
  const model: FourthCanteenModel = {
    group,
    setMode(mode) {
      plan.visible = mode === 'plan';
      for (const roof of roofs) roof.visible = mode === '3d';
    },
    setInterfaceTheme() {
      /* Indoor illumination follows the reference, independent of UI theme. */
    },
    tick(time) {
      for (const animation of animations) animation.tick(time);
    },
  };
  model.setMode('plan');
  return model;
}
