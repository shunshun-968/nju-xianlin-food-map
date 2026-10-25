import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { twelfthTextPlane } from './twelfth-canteen-signage';
import { eleventhCanteenFaces, eleventhDumplingKiosk } from '../data/eleventh-canteen';

const logisticsArtwork = new URL('../assets/branding/南大后勤.png', import.meta.url).href;

/** Loose equipment photographed in front of the Eleventh Canteen's continuous row.
 * Floor coordinates: +X north / screen right; +Z east / serving aisle.
 * These are physical props; common ownership or an extra selectable shop is not inferred.
 */
export function addEleventhFixtures(parent: THREE.Group): void {
  const root = new THREE.Group();
  root.name = 'eleventh-canteen-fixtures';
  parent.add(root);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 10, 7);
  const steel = new THREE.MeshStandardMaterial({
    color: '#b6bfb9',
    metalness: 0.6,
    roughness: 0.36,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: '#6e7c76',
    metalness: 0.48,
    roughness: 0.43,
  });
  const dark = new THREE.MeshStandardMaterial({ color: '#343f3b', roughness: 0.76 });
  const ceramic = new THREE.MeshStandardMaterial({ color: '#e9e7d9', roughness: 0.38 });
  const plateEdge = new THREE.MeshStandardMaterial({ color: '#c9cbbb', roughness: 0.45 });
  const purple = new THREE.MeshStandardMaterial({ color: '#57264e', roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({
    color: '#dce2d8',
    roughness: 0.48,
    metalness: 0.06,
  });
  const liner = new THREE.MeshStandardMaterial({
    color: '#b9d1cb',
    roughness: 0.56,
    metalness: 0.12,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#d2e7dc',
    transparent: true,
    opacity: 0.13,
    roughness: 0.23,
    metalness: 0.01,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  function mesh(
    p: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    name = '',
  ) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.name = name;
    m.castShadow = m.receiveShadow = true;
    p.add(m);
    return m;
  }
  function box(
    p: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    name = '',
  ) {
    const m = mesh(p, cube, material, x, y, z, name);
    m.scale.set(w, h, d);
    return m;
  }
  function rounded(
    p: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    r = 0.025,
    name = '',
  ) {
    return mesh(p, new RoundedBoxGeometry(w, h, d, 2, r), material, x, y, z, name);
  }
  function rod(p: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r = 0.018, material = steel) {
    const v = b.clone().sub(a);
    const m = mesh(
      p,
      new THREE.CylinderGeometry(r, r, v.length(), 10),
      material,
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      (a.z + b.z) / 2,
    );
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    return m;
  }
  function wheel(p: THREE.Object3D, x: number, z: number) {
    const m = mesh(p, new THREE.CylinderGeometry(0.065, 0.065, 0.065, 12), dark, x, 0.22, z);
    m.rotation.z = Math.PI / 2;
    box(p, steel, x, 0.29, z, 0.055, 0.1, 0.055);
  }
  function text(
    p: THREE.Object3D,
    title: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    ink: string,
    bg = '',
  ) {
    const m = twelfthTextPlane(title, w, h, ink, bg);
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }

  // Purple wheeled freezer, matching the separate chest in front of the Qinhuai counter.
  const freezer = new THREE.Group();
  freezer.name = 'eleventh-dumpling-freezer';
  freezer.position.set(eleventhDumplingKiosk.position.x, 0, eleventhDumplingKiosk.position.z);
  freezer.rotation.y = eleventhDumplingKiosk.position.rotationY;
  root.add(freezer);
  freezer.userData.fixture = 'dumpling-freezer';
  const fw = 2.7,
    fd = 1.15;
  for (const x of [-1.15, 1.15]) for (const z of [-0.44, 0.44]) wheel(freezer, x, z);
  rounded(freezer, dark, 0, 0.34, 0, fw, 0.13, fd, 0.025);
  box(freezer, purple, 0, 0.7, fd / 2 - 0.035, fw, 0.7, 0.07, 'freezer-front');
  box(freezer, purple, 0, 0.7, -fd / 2 + 0.035, fw, 0.7, 0.07, 'freezer-back');
  for (const x of [-fw / 2 + 0.035, fw / 2 - 0.035]) box(freezer, purple, x, 0.7, 0, 0.07, 0.7, fd);
  box(freezer, liner, 0, 0.53, 0, fw - 0.15, 0.05, fd - 0.15);
  for (const z of [-fd / 2 + 0.09, fd / 2 - 0.09])
    box(freezer, white, 0, 0.86, z, fw - 0.15, 0.62, 0.05);
  for (const x of [-fw / 2 + 0.09, fw / 2 - 0.09])
    box(freezer, white, x, 0.86, 0, 0.05, 0.62, fd - 0.15);
  // Thin sliding lids reveal filled baskets and individual pale dumplings in clear packs.
  for (const z of [-fd / 2, fd / 2])
    rounded(freezer, white, 0, 1.17, z, fw + 0.05, 0.12, 0.07, 0.018);
  for (const x of [-fw / 2, 0, fw / 2]) rounded(freezer, white, x, 1.17, 0, 0.07, 0.12, fd, 0.018);
  const packet = new THREE.MeshPhysicalMaterial({
    color: '#dbe4cc',
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
    roughness: 0.46,
    side: THREE.DoubleSide,
  });
  const filling = new THREE.MeshStandardMaterial({ color: '#e4d7b2', roughness: 0.88 });
  for (const basketX of [-0.89, 0, 0.89]) {
    box(freezer, steel, basketX, 0.72, 0, 0.035, 0.32, fd - 0.25);
    for (const z of [-0.27, 0.17]) {
      const pack = rounded(
        freezer,
        packet,
        basketX,
        0.95,
        z,
        0.71,
        0.13,
        0.34,
        0.035,
        'dumpling-packet',
      );
      pack.castShadow = false;
      for (let i = 0; i < 5; i++) {
        const x = basketX - 0.26 + i * 0.13;
        const dumpling = mesh(freezer, sphere, filling, x, 0.94, z);
        dumpling.scale.set(0.064, 0.054, 0.095);
        for (let crease = 0; crease < 3; crease++)
          box(freezer, ceramic, x - 0.028 + crease * 0.028, 0.99, z, 0.009, 0.008, 0.1);
      }
      box(freezer, ceramic, basketX, 0.985, z + 0.13, 0.32, 0.008, 0.045);
    }
  }
  for (const x of [-fw / 4, fw / 4]) {
    const lid = mesh(
      freezer,
      new THREE.PlaneGeometry(fw / 2 - 0.09, fd - 0.12),
      glass,
      x,
      1.2,
      0,
      'freezer-glass-lid',
    );
    lid.rotation.x = -Math.PI / 2;
    lid.castShadow = false;
    rounded(freezer, white, x, 1.235, 0.19, 0.2, 0.04, 0.045, 0.012, 'sliding-lid-handle');
  }
  for (let i = 0; i < 7; i++)
    box(freezer, dark, fw / 2 + 0.004, 0.5 + i * 0.035, 0, 0.01, 0.013, 0.38);
  text(freezer, '水饺超市', 0, 0.9, fd / 2 + 0.009, 1.2, 0.21, '#fff6df');
  // Texture uses the supplied original artwork and its exact 390:180 aspect ratio.
  if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
    const map = new THREE.TextureLoader().load(logisticsArtwork);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const logo = mesh(
      freezer,
      new THREE.PlaneGeometry(0.44, (0.44 * 180) / 390),
      new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false }),
      -1.02,
      0.98,
      fd / 2 + 0.012,
      'eleventh-original-logistics-logo',
    );
    logo.castShadow = false;
    logo.userData.originalArtwork = logisticsArtwork;
  }
  // Keep the caption-grid rhythm without inventing unclear flavor or price text.
  for (let i = 0; i < 6; i++) {
    const x = ((i % 3) - 1) * 0.7;
    const y = 0.67 - Math.floor(i / 3) * 0.15;
    box(freezer, ceramic, x, y, fd / 2 + 0.011, 0.64, 0.11, 0.007);
    box(freezer, purple, x, y + 0.018, fd / 2 + 0.016, 0.45, 0.014, 0.003);
    box(freezer, purple, x - 0.06, y - 0.02, fd / 2 + 0.016, 0.32, 0.01, 0.003);
  }
  const selection = box(
    freezer,
    purple.clone(),
    0,
    1.24,
    fd / 2 + 0.014,
    fw - 0.08,
    0.025,
    0.035,
    'eleventh-freezer-selection',
  );
  selection.userData = { kind: 'stall', id: 'v-1112-f1-dumpling-kiosk', baseColor: '#57264e' };
  text(freezer, '自选水饺', 0, 0.4, fd / 2 + 0.011, 1.1, 0.1, '#eee3d8');

  // Keep trolleys in front of the section seams, outside the serving footprints.
  const rackPositions = eleventhCanteenFaces.slice(0, -1).map((face, index) => {
    const next = eleventhCanteenFaces[index + 1];
    return (face.x + face.width / 2 + next.x - next.width / 2) / 2;
  });
  for (const [rackIndex, x] of rackPositions.entries()) {
    const rack = new THREE.Group();
    rack.name = `eleventh-tray-trolley-${rackIndex + 1}`;
    rack.position.set(x, 0, 2.1);
    root.add(rack);
    const rw = 0.66,
      rd = 0.58;
    for (const px of [-rw / 2, rw / 2])
      for (const z of [-rd / 2, rd / 2]) {
        rod(rack, new THREE.Vector3(px, 0.19, z), new THREE.Vector3(px, 1.76, z), 0.018);
        wheel(rack, px, z);
      }
    for (const y of [0.42, 0.95, 1.48]) {
      box(rack, steel, 0, y, 0, rw, 0.035, rd);
      for (const z of [-rd / 2, rd / 2]) box(rack, darkSteel, 0, y - 0.025, z, rw, 0.05, 0.025);
      for (const px of [-0.17, 0.17]) {
        const count = y === 1.48 ? 6 : 13;
        for (let j = 0; j < count; j++) {
          const cy = y + 0.04 + j * 0.024;
          rounded(rack, ceramic, px, cy, 0, 0.29, 0.018, 0.43, 0.018, 'stacked-serving-tray');
          box(rack, plateEdge, px, cy + 0.011, 0, 0.23, 0.005, 0.3);
        }
      }
    }
    rod(rack, new THREE.Vector3(-rw / 2, 1.76, -rd / 2), new THREE.Vector3(rw / 2, 1.76, -rd / 2));
    for (const z of [-rd / 2, rd / 2])
      rod(rack, new THREE.Vector3(-rw / 2, 1.55, z), new THREE.Vector3(rw / 2, 1.55, z));
  }

  const yellow = new THREE.MeshStandardMaterial({ color: '#e4b51f', roughness: 0.73 });
  const warning = new THREE.Group();
  warning.name = 'eleventh-wet-floor-sign';
  warning.position.set(17.2, 0, 3.5);
  root.add(warning);
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(0, 0.68, side * 0.14);
    // A-frame: the two tops meet, while the feet spread out toward the aisle.
    leaf.rotation.x = -side * 0.28;
    leaf.name = side > 0 ? 'wet-floor-front-panel' : 'wet-floor-back-panel';
    warning.add(leaf);
    rounded(leaf, yellow, 0, 0, 0, 0.56, 0.99, 0.035, 0.018);
    // A real handle cutout is represented by its shadow and a raised rim, not a floating label.
    rounded(leaf, dark, 0, 0.36, side * 0.019, 0.22, 0.07, 0.009, 0.013);
    const caption = text(leaf, '小心地滑', 0, -0.21, side * 0.022, 0.48, 0.13, '#493b1b');
    caption.name = side > 0 ? 'wet-floor-front-caption' : 'wet-floor-back-caption';
    const english = text(leaf, 'CAUTION', 0, 0.18, side * 0.022, 0.39, 0.07, '#493b1b');
    const wet = text(leaf, 'WET FLOOR', 0, 0.09, side * 0.022, 0.43, 0.07, '#493b1b');
    if (side < 0) {
      caption.rotation.y = Math.PI;
      english.rotation.y = Math.PI;
      wet.rotation.y = Math.PI;
    }
    for (const px of [-0.22, 0.22]) box(leaf, yellow, px, -0.51, 0, 0.1, 0.06, 0.06);
  }
  rod(warning, new THREE.Vector3(-0.25, 1.16, 0), new THREE.Vector3(0.25, 1.16, 0), 0.026, yellow);
}
