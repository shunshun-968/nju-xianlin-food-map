import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { IndoorCanteenSpec } from '../data/indoor-canteens';
import type { FourthCanteenModel } from './FourthCanteenModel';
import { eleventhCanteenFaces } from '../data/eleventh-canteen';
import { twelfthTextPlane } from './twelfth-canteen-signage';
import { addEleventhSignage } from './eleventh-canteen-signage';
import { addEleventhFixtures } from './eleventh-canteen-fixtures';
import { addCounterDetails } from './fourth-canteen-details';

/** White tile counters and printed signs of the eleventh canteen; +X is local north. */
export function createEleventhCanteenModel(spec: IndoorCanteenSpec): FourthCanteenModel {
  const group = new THREE.Group();
  group.name = 'eleventh-canteen-straight-row';
  const spatial = new THREE.Group();
  spatial.name = 'spatial-frontages';
  const plan = new THREE.Group();
  plan.name = 'plan-labels';
  group.add(spatial, plan);
  const roofs: THREE.Group[] = [];
  const steam: { mesh: THREE.Mesh; y: number; phase: number }[] = [];
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  function mat(color: string, metalness = 0, glow = 0) {
    const key = `${color}/${metalness}/${glow}`;
    if (!cache.has(key))
      cache.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          metalness,
          roughness: metalness ? 0.4 : 0.68,
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
    const m = new THREE.Mesh(cube, mat(color, metalness, glow));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = m.receiveShadow = true;
    p.add(m);
    return m;
  }
  function cylinder(
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    color: string,
    metalness = 0,
  ) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, h, 18), mat(color, metalness));
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
    sx: number,
    sy: number,
    sz: number,
    color: string,
  ) {
    const m = new THREE.Mesh(sphere, mat(color));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    p.add(m);
    return m;
  }
  function label(text: string, x: number, z: number, w: number, h: number, ink = '#435b49') {
    const m = twelfthTextPlane(text, w, h, ink, '#fffbee');
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 4.65, z);
    plan.add(m);
    return m;
  }
  function bowl(p: THREE.Object3D, x: number, y: number, z: number, food = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.085, 0.12, 16), mat('#e5e6d7'));
    m.position.set(x, y + 0.06, z);
    p.add(m);
    if (food) {
      cylinder(p, x, y + 0.125, z, 0.145, 0.014, '#b77b34');
      ellipsoid(p, x + 0.04, y + 0.15, z, 0.06, 0.02, 0.055, '#5d873f');
    }
  }
  function stockpot(p: THREE.Object3D, x: number, z: number, r = 0.26) {
    cylinder(p, x, 1.42, z, r, 0.4, '#b6bdb6', 0.62);
    cylinder(p, x, 1.63, z, r * 1.04, 0.025, '#d1d5ca', 0.6);
    cylinder(p, x, 1.65, z, r * 0.9, 0.012, '#927649');
    for (const s of [-1, 1]) box(p, x + s * (r + 0.03), 1.5, z, 0.1, 0.04, 0.11, '#414c45');
    for (let i = 0; i < 2; i++) {
      const mist = new THREE.Mesh(
        sphere,
        new THREE.MeshBasicMaterial({
          color: '#f5eed8',
          transparent: true,
          opacity: 0.075,
          depthWrite: false,
        }),
      );
      mist.position.set(x + (i - 0.5) * 0.11, 1.85 + i * 0.12, z);
      mist.scale.set(0.06, 0.13, 0.06);
      mist.userData.steam = true;
      mist.name = 'eleventh-pot-steam';
      p.add(mist);
      steam.push({ mesh: mist, y: mist.position.y, phase: i * 0.55 + x });
    }
  }
  function foodWell(p: THREE.Object3D, x: number, z: number, filled: boolean, variant: number) {
    box(p, x, 1.19, z, 0.62, 0.08, 0.52, '#b6bdb6', 0.55);
    box(p, x, 1.235, z, 0.53, 0.012, 0.43, filled ? '#a18453' : '#5c6a65', 0.25);
    for (const side of [-1, 1]) {
      box(p, x + side * 0.3, 1.24, z, 0.025, 0.03, 0.51, '#d0d5cc', 0.5);
      box(p, x, 1.24, z + side * 0.25, 0.62, 0.03, 0.025, '#d0d5cc', 0.5);
    }
    if (filled)
      for (let j = 0; j < 12; j++)
        ellipsoid(
          p,
          x + ((j % 4) - 1.5) * 0.11,
          1.26 + (j % 2) * 0.01,
          z + (Math.floor(j / 4) - 1) * 0.12,
          0.045,
          0.035,
          0.045,
          ['#9b633a', '#6f9145', '#e2c77e'][variant % 3],
        );
  }
  function equipment(p: THREE.Group, number: number, width: number) {
    if (number >= 9 && number <= 16) {
      addCounterDetails(p, width, number);
      box(p, -width * 0.32, 1.92, 0.4, 0.06, 0.38, 0.045, '#7a8781', 0.6);
      ellipsoid(p, -width * 0.32, 2.11, 0.4, 0.07, 0.07, 0.025, '#d5dad1');
      box(p, -width * 0.32, 1.82, 0.43, 0.15, 0.14, 0.025, '#48918a');
      return;
    }
    // Behind-counter steel preparation bench, cupboards and appliances.
    box(p, 0, 1.05, -2.5, width - 0.12, 0.07, 0.7, '#adb7af', 0.56);
    box(p, 0, 0.6, -2.5, width - 0.18, 0.82, 0.62, '#bfc5bc', 0.35);
    for (const x of [-width * 0.23, width * 0.23])
      box(p, x, 0.65, -2.17, 0.15, 0.025, 0.03, '#57665e', 0.5);
    for (let i = 0; i < 7; i++)
      cylinder(p, width * 0.29, 1.105 + i * 0.025, -2.5, 0.18, 0.022, '#e8e5d6');
    bowl(p, width * 0.28, 1.1, -2.13);
    // Actual microphone/call units, payment terminal and their dangling leads.
    box(p, width * 0.3, 1.27, 0.67, 0.22, 0.15, 0.21, '#c9d5cd', 0.15);
    const screen = box(p, width * 0.3, 1.42, 0.72, 0.19, 0.15, 0.022, '#344c4d');
    screen.rotation.x = -0.15;
    box(p, -width * 0.32, 1.92, 0.4, 0.06, 0.38, 0.045, '#7a8781', 0.6);
    ellipsoid(p, -width * 0.32, 2.11, 0.4, 0.07, 0.07, 0.025, '#d5dad1');
    box(p, -width * 0.32, 1.82, 0.43, 0.15, 0.14, 0.025, '#48918a');
    const cable = new THREE.CatmullRomCurve3([
      new THREE.Vector3(width * 0.3, 1.2, 0.85),
      new THREE.Vector3(width * 0.3 + 0.05, 0.65, 1.14),
      new THREE.Vector3(width * 0.3 - 0.07, 0.55, 1.12),
      new THREE.Vector3(width * 0.3 - 0.1, 1.15, 0.85),
    ]);
    const cord = new THREE.Mesh(new THREE.TubeGeometry(cable, 14, 0.008, 5, false), mat('#4b514a'));
    p.add(cord);
    box(p, -width * 0.3, 1.93, 0.5, 0.3, 0.16, 0.018, '#4d284e');
    // Each numbered opening gets an appropriate appliance, not a duplicate meal template.
    if (number <= 4) {
      stockpot(p, -0.55, 0.1, number === 1 ? 0.32 : 0.25);
      for (let i = 0; i < 3; i++) bowl(p, -0.2 + i * 0.23, 1.22, 0.62, true);
      if (number === 1) {
        for (let j = 0; j < 3; j++) {
          cylinder(p, 0.1, 1.27 + j * 0.1, -0.25, 0.26, 0.09, '#c9ae72');
        }
        ellipsoid(p, 0.09, 1.6, -0.25, 0.08, 0.055, 0.08, '#ebe0bf');
      }
      if (number === 2)
        for (let i = 0; i < 3; i++)
          box(p, -0.3 + i * 0.28, 1.24, 0.32, 0.23, 0.06, 0.32, '#69804c');
      if (number === 4)
        for (const x of [-0.3, 0.15]) {
          cylinder(p, x, 1.28, 0.4, 0.19, 0.13, '#5f4030');
          cylinder(p, x, 1.36, 0.4, 0.2, 0.035, '#493a2d');
        }
    } else if (number === 6 || number === 7) {
      stockpot(p, -0.62, 0.05, 0.25);
      for (let i = 0; i < 4; i++)
        cylinder(p, 0.1, 1.26 + i * 0.1, 0.28, 0.24, 0.095, '#c8cfbf', 0.5);
      for (let i = 0; i < 3; i++) bowl(p, -0.25 + i * 0.29, 1.22, 0.74);
    } else if (number === 8 || number >= 17) {
      const station = new THREE.Group();
      station.name = number === 8 ? 'eleventh-iron-plate' : 'eleventh-wok-station';
      p.add(station);
      box(station, -0.3, 1.07, -0.25, 1.35, 0.23, 0.74, '#9aa49d', 0.55);
      box(station, -0.3, 1.2, -0.25, 1.25, 0.035, 0.66, '#343d38', 0.3);
      const wok = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 18, 9, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        mat('#343f39', 0.5),
      );
      wok.position.set(-0.4, 1.35, -0.25);
      station.add(wok);
      box(station, -0.1, 1.34, -0.25, 0.34, 0.025, 0.04, '#464b3d');
      for (let j = 0; j < 4; j++) bowl(p, -0.75 + j * 0.32, 1.22, 0.64, true);
      box(p, 0, 2.8, -2.5, width - 0.18, 0.36, 0.9, '#a3afa6', 0.5);
      if (number >= 17) stockpot(p, 0.45, -2.5, 0.22);
    } else {
      for (let i = 0; i < 3; i++) foodWell(p, -0.75 + i * 0.65, 0.22, number < 13, i + number);
      if (number === 12)
        for (let i = 0; i < 10; i++)
          cylinder(p, 0.55, 1.24 + i * 0.023, 0.66, 0.16, 0.02, '#e6e2cf');
      else for (let i = 0; i < 2; i++) bowl(p, 0.3 + i * 0.3, 1.22, 0.73, number < 13);
    }
  }
  const stage = spec.stage;
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(stage.width, 0.26, stage.depth, 2, 0.06),
    mat('#bab9a7'),
  );
  base.position.set(stage.x, -0.04, stage.z);
  spatial.add(base);
  box(spatial, stage.x, 0.1, stage.z, stage.width - 0.16, 0.06, stage.depth - 0.16, '#e1e0d0');
  for (let x = -stage.width / 2 + 1.15; x < stage.width / 2; x += 1.15)
    box(spatial, x, 0.134, stage.z, 0.011, 0.004, stage.depth - 0.2, '#bec1b5');
  for (let z = stage.z - stage.depth / 2 + 1.15; z < stage.z + stage.depth / 2; z += 1.15)
    box(spatial, stage.x, 0.134, z, stage.width - 0.2, 0.004, 0.011, '#bec1b5');
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#d8e5db',
    transparent: true,
    opacity: 0.12,
    roughness: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const face of eleventhCanteenFaces) {
    const room = new THREE.Group();
    room.name = `eleventh-section-${face.photoNumber}`;
    room.position.x = face.x;
    spatial.add(room);
    const w = face.width,
      n = face.windowCount,
      cell = w / n;
    box(room, 0, 0.16, -1.6, w, 0.05, 5.2, '#c9cbbb');
    box(room, 0, 2, -4.2, w, 3.7, 0.15, '#e4debf');
    for (let y = 0.6; y < 3.8; y += 0.4) box(room, 0, y, -4.12, w, 0.009, 0.005, '#cecbb5');
    for (let x = -w / 2 + 0.6; x < w / 2; x += 0.65)
      box(room, x, 2, -4.12, 0.009, 3.7, 0.005, '#d0cdb6');
    // Retain the photographed white columns; adjoining sections meet their edges without air gaps.
    for (const side of [-1, 1]) {
      const outside =
        (face.photoNumber === 5 && side === -1) || (face.photoNumber === 1 && side === 1);
      if (outside) box(room, side * (w / 2 + 0.065), 2.08, -1.6, 0.13, 3.95, 5.23, '#e7e4d1');
      box(room, (side * w) / 2, 2.08, 1.02, 0.045, 3.95, 0.04, '#c3ccc3', 0.6);
    }
    const roof = new THREE.Group();
    roof.name = `eleventh-roof-${face.photoNumber}`;
    roof.userData.planHide = true;
    room.add(roof);
    roofs.push(roof);
    box(roof, 0, 4.06, -1.6, w, 0.15, 5.2, '#cbcbbd').name = `roof-slab-${face.photoNumber}`;
    const nextFace = eleventhCanteenFaces
      .filter((next) => next.x > face.x)
      .sort((a, b) => a.x - b.x)[0];
    if (nextFace) {
      const leftEdge = face.x + w / 2,
        rightEdge = nextFace.x - nextFace.width / 2;
      const gap = rightEdge - leftEdge,
        mid = (rightEdge + leftEdge) / 2;
      box(spatial, mid, 2.08, -1.6, gap + 0.002, 3.95, 5.23, '#eeeadd').name =
        `eleventh-white-column-${face.photoNumber}`;
      for (const edge of [leftEdge, rightEdge])
        box(spatial, edge, 2.08, 1.04, 0.045, 3.95, 0.04, '#c3ccc3', 0.6);
      box(roof, mid - face.x, 4.06, -1.6, gap + 0.002, 0.15, 5.2, '#cbcbbd').name =
        `eleventh-column-roof-${face.photoNumber}`;
    }
    for (let z = -4.15; z < 1; z += 0.23) box(roof, 0, 3.95, z, w, 0.07, 0.19, '#d9d9ca', 0.15);
    for (const x of [-w * 0.27, w * 0.27]) {
      box(roof, x, 3.88, -0.6, 1.8, 0.03, 0.06, '#fff8df', 0, 0.8);
      box(roof, x, 3.9, -2.6, 1.1, 0.04, 0.7, '#85928b', 0.45);
      for (let i = 0; i < 7; i++)
        box(roof, x - 0.45 + i * 0.15, 3.87, -2.6, 0.025, 0.02, 0.65, '#5f6b63');
    }
    // Solid white glazed tile skirts: unlike 12F, these panels do not emit light.
    box(room, 0, 0.65, 0.5, w, 0.94, 1.08, '#e6e6d7');
    for (let x = -w / 2 + 0.75; x < w / 2; x += 0.75)
      box(room, x, 0.65, 1.045, 0.009, 0.92, 0.004, '#bdc1b4');
    for (const y of [0.4, 0.7, 1]) box(room, 0, y, 1.045, w, 0.008, 0.004, '#cbd0c3');
    box(room, 0, 1.16, 0.5, w, 0.12, 1.24, '#26342e', 0.22).name =
      `eleventh-counter-top-${face.photoNumber}`;
    box(room, 0, 1.82, 0.42, w, 0.055, 0.055, '#adb9ad', 0.65);
    box(room, 0, 2.27, 0.42, w, 0.05, 0.055, '#c4ccc1', 0.6);
    for (let i = 0; i <= n; i++)
      box(room, -w / 2 + i * cell, 1.73, 0.42, 0.05, 1.08, 0.055, '#aebcb1', 0.6);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * cell,
        number = face.windowNumbers[i];
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(cell - 0.06, 0.42), glass);
      pane.position.set(x, 2.02, 0.42);
      pane.name = `eleventh-glass-${number}`;
      room.add(pane);
      const opening = new THREE.Group();
      opening.name = `eleventh-window-${number}`;
      opening.position.x = x;
      room.add(opening);
      equipment(opening, number, cell - 0.12);
      const light = new THREE.PointLight('#ffd399', 10, 4.8, 2);
      light.name = `eleventh-warm-light-${number}`;
      light.position.set(0, 2.18, -0.35);
      opening.add(light);
      box(opening, 0, 2.29, -0.35, cell - 0.2, 0.03, 0.06, '#ffe3a6', 0, 0.9);
      const selection = box(opening, 0, 1.224, 1.1, cell - 0.12, 0.023, 0.045, '#8c9366');
      selection.material = selection.material.clone();
      selection.userData = {
        kind: 'stall',
        id: `${face.faceId}-w${face.photoNumber === 1 ? 1 : i + 1}`,
        baseColor: '#8c9366',
      };
      const text =
        face.windowLabels[i] === '待补充' ? '售餐窗口' : face.windowLabels[i].split('／')[0];
      const tag = label(`${number} · ${text}`, face.x + x, -5.15, cell - 0.1, 0.6);
      tag.userData = {
        ...tag.userData,
        kind: 'stall',
        id: `${face.faceId}-w${face.photoNumber === 1 ? 1 : i + 1}`,
      };
    }
    box(room, 0, 3.5, 1.005, w, 0.97, 0.12, '#d3ddcc');
    for (const y of [3.01, 3.99]) box(room, 0, y, 1.065, w, 0.045, 0.045, '#c4d0c6', 0.65);
    addEleventhSignage(room, face.photoNumber, w);
    label(face.name, face.x, -6.35, w - 0.1, 1);
  }
  addEleventhFixtures(spatial);
  spatial.traverse((object) => {
    if (object instanceof THREE.Mesh && object.name === 'subtle-pot-steam')
      steam.push({ mesh: object, y: object.userData.baseY, phase: object.userData.phase });
  });
  const model: FourthCanteenModel = {
    group,
    setMode(mode) {
      plan.visible = mode === 'plan';
      for (const roof of roofs) roof.visible = mode === '3d';
    },
    setInterfaceTheme() {},
    tick(time) {
      for (const entry of steam) {
        entry.mesh.position.y = entry.y + Math.sin(time * 0.8 + entry.phase) * 0.08;
      }
    },
  };
  model.setMode('plan');
  return model;
}
