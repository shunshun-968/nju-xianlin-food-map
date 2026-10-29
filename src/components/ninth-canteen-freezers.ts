import * as THREE from 'three';
import { prepareImages } from '../lib/image-assets';
import { loadModelTexture } from '../lib/model-texture-loader';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createKingCrab } from './ninth-canteen-king-crab';

// The owner explicitly supplied this crab-themed artwork for the freezer.
// Preserve its original pixels/aspect; it is separate from the official university crest.
const crabArtwork = new URL('../assets/ninth-canteen/king-crab-emblem.png', import.meta.url).href;
export function prepareNinthFreezerAssets() { return prepareImages([crabArtwork]); }

/** Photo 10 refrigerated cabinet + owner's requested historical king-crab display.
 * Local +Z faces the aisle. Both units share one row INSIDE the same storefront.
 * This west-facing storefront maps local -X to geographic north: the crab chest goes there.
 */
export function addNinthSeafoodFreezers(parent: THREE.Group, width: number, stallId: string) {
  const root = new THREE.Group();
  root.name = 'ninth-seafood-freezers';
  parent.add(root);
  const steel = new THREE.MeshStandardMaterial({
    color: '#b9c5c1',
    metalness: 0.62,
    roughness: 0.28,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: '#d1be94',
    metalness: 0.52,
    roughness: 0.3,
  });
  const white = new THREE.MeshStandardMaterial({
    color: '#e6eae1',
    metalness: 0.08,
    roughness: 0.42,
  });
  const dark = new THREE.MeshStandardMaterial({ color: '#394a49', metalness: 0.3, roughness: 0.5 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#d4f0ed',
    transparent: true,
    opacity: 0.13,
    roughness: 0.09,
    metalness: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coldLight = new THREE.MeshBasicMaterial({ color: '#def8ff', toneMapped: false });
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function mesh(
    p: THREE.Object3D,
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    name = '',
  ) {
    const obj = new THREE.Mesh(g, m);
    obj.position.set(x, y, z);
    obj.name = name;
    obj.castShadow = obj.receiveShadow = true;
    p.add(obj);
    return obj;
  }
  function box(
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    name = '',
  ) {
    const obj = mesh(p, cube, m, x, y, z, name);
    obj.scale.set(w, h, d);
    return obj;
  }
  function print(text: string, w: number, h: number, color: string, bg: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(128, Math.round((1024 * h) / w));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.min(canvas.height * 0.68, 930 / text.length)}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(text, 512, canvas.height / 2, 960);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, toneMapped: false }),
    );
  }
  function label(
    p: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    color = '#faf6df',
    bg = '#93826c',
  ) {
    const obj = print(text, w, h, color, bg);
    obj.position.set(x, y, z);
    p.add(obj);
    return obj;
  }
  function vent(p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number) {
    box(p, dark, x, y, z, w, h, 0.018);
    for (let row = 0; row < 9; row++)
      box(p, steel, x, y - h / 2 + ((row + 0.5) * h) / 9, z + 0.014, w - 0.025, 0.016, 0.018);
  }
  function wheel(p: THREE.Object3D, x: number, z: number) {
    const obj = mesh(p, new THREE.CylinderGeometry(0.075, 0.075, 0.07, 12), dark, x, 0.17, z);
    obj.rotation.z = Math.PI / 2;
    box(p, steel, x, 0.23, z, 0.055, 0.12, 0.07);
  }

  const cabinet = new THREE.Group();
  cabinet.name = 'seafood-refrigerated-cabinet';
  root.add(cabinet);
  const w = width - 2;
  cabinet.position.x = 0.94;
  // Cabinet rests on casters, with metal doors and compressor grilles rather than a wooden counter.
  box(cabinet, dark, 0, 0.29, 0.36, w, 0.12, 1.3);
  mesh(
    cabinet,
    new RoundedBoxGeometry(w, 0.58, 1.25, 2, 0.035),
    steel,
    0,
    0.58,
    0.36,
    'freezer-insulated-base',
  );
  for (const x of [-w * 0.4, w * 0.4]) {
    for (const z of [-0.08, 0.83]) wheel(cabinet, x, z);
    box(cabinet, white, x, 0.51, 1.0, 0.25, 0.24, 0.035);
    box(cabinet, dark, x, 0.54, 1.023, 0.1, 0.04, 0.02);
  }
  vent(cabinet, 0, 0.51, 1.003, w * 0.62, 0.32);
  box(cabinet, steel, 0, 1.56, -0.24, w, 1.46, 0.09);
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) {
    box(cabinet, steel, x, 1.55, 0.38, 0.07, 1.5, 1.3);
    box(cabinet, trim, x, 1.56, 1.045, 0.045, 1.56, 0.055);
  }
  const foodColors = ['#a6b958', '#ddd1a9', '#bb8664', '#efdec2'];
  const foodMaterials = foodColors.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
  );
  const tray = new THREE.MeshStandardMaterial({ color: '#de843d', roughness: 0.4 });
  const foodGeometry = new THREE.SphereGeometry(1, 8, 6);
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 0.91 + shelf * 0.4;
    box(cabinet, white, 0, y, 0.4, w - 0.14, 0.045, 1.13);
    box(cabinet, steel, 0, y + 0.025, 0.96, w - 0.12, 0.065, 0.04);
    box(cabinet, coldLight, 0, y + 0.31, -0.12, w - 0.18, 0.023, 0.04).castShadow = false;
    const columns = Math.max(3, Math.round((w - 0.2) / 0.56));
    for (let cell = 0; cell < columns; cell++) {
      const x = -w / 2 + 0.36 + (cell * (w - 0.72)) / (columns - 1);
      box(cabinet, tray, x, y + 0.08, 0.55, 0.45, 0.11, 0.46);
      for (let n = 0; n < 5; n++) {
        const piece = mesh(
          cabinet,
          foodGeometry,
          foodMaterials[(cell + shelf) % foodMaterials.length],
          x - 0.15 + n * 0.075,
          y + 0.15,
          0.54,
        );
        piece.scale.set(0.06, 0.04, 0.14);
      }
    }
  }
  box(cabinet, trim, 0, 2.27, 0.4, w, 0.11, 1.3);
  for (const y of [0.83, 2.22]) {
    box(cabinet, trim, 0, y, 1.055, w, 0.16, 0.07);
    label(cabinet, '食品安全   出柜不退', 0, y, 1.094, w - 0.3, 0.125);
  }
  // Separate glazed doors and handles leave the chilled shelves visible at close zoom.
  for (const side of [-1, 1]) {
    const pane = mesh(
      cabinet,
      new THREE.PlaneGeometry(w / 2 - 0.045, 1.24),
      glass,
      (side * w) / 4,
      1.53,
      1.076,
      'freezer-glass-door',
    );
    pane.castShadow = false;
    box(cabinet, steel, side * 0.055, 1.53, 1.1, 0.024, 0.29, 0.035);
  }
  label(cabinet, '冷藏', w * 0.32, 0.54, 1.04, 0.23, 0.1, '#a8ebea', '#253f43');
  const highlight = box(cabinet, steel.clone(), 0, 0.87, 1.115, w - 0.18, 0.025, 0.06);
  highlight.userData = { kind: 'stall', id: stallId, baseColor: '#b9c5c1' };

  const chest = new THREE.Group();
  chest.name = 'king-crab-freezer';
  chest.position.set(-width / 2 + 0.93, 0, 0.48);
  chest.userData.historicalDisplay = true;
  root.add(chest);
  const cw = 1.78,
    cd = 1.2;
  const inner = new THREE.MeshStandardMaterial({
    color: '#cfdee0',
    roughness: 0.45,
    metalness: 0.18,
  });
  // Hollow insulated cabinet: never use an opaque solid box over the crab cavity.
  box(chest, white, 0, 0.51, 0, cw, 0.56, cd, 'crab-freezer-base');
  box(chest, inner, 0, 0.835, 0, cw - 0.15, 0.065, cd - 0.15, 'crab-freezer-liner');
  for (const x of [-cw / 2 + 0.04, cw / 2 - 0.04]) box(chest, white, x, 1.01, 0, 0.08, 0.39, cd);
  box(chest, white, 0, 1.01, -cd / 2 + 0.04, cw, 0.39, 0.08);
  const viewingGlass = glass.clone();
  viewingGlass.opacity = 0.09;
  mesh(
    chest,
    new THREE.PlaneGeometry(cw - 0.15, 0.36),
    viewingGlass,
    0,
    1.03,
    cd / 2 - 0.025,
    'crab-freezer-front-glass',
  ).castShadow = false;
  for (const x of [-cw / 2 + 0.04, cw / 2 - 0.04]) {
    box(chest, steel, x, 1.285, 0, 0.075, 0.055, cd);
    for (const z of [-0.43, 0.43]) wheel(chest, x, z);
  }
  for (const z of [-cd / 2 + 0.04, cd / 2 - 0.04]) box(chest, steel, 0, 1.285, z, cw, 0.055, 0.075);
  const lid = mesh(
    chest,
    new THREE.PlaneGeometry(cw - 0.14, cd - 0.14),
    viewingGlass,
    0,
    1.285,
    0,
    'crab-freezer-clear-lid',
  );
  lid.rotation.x = -Math.PI / 2;
  lid.castShadow = false;
  // Slider rail/handle sit at the rear edge, away from the crab's silhouette.
  box(chest, dark, 0.5, 1.325, -0.39, 0.25, 0.035, 0.045);
  box(chest, coldLight, 0, 1.23, -0.52, 1.5, 0.025, 0.025).castShadow = false;
  vent(chest, 0.6, 0.47, 0.607, 0.34, 0.23);
  label(chest, '帝王蟹', -0.55, 0.78, 0.615, 0.48, 0.11, '#624b61', '#edf0e6');
  const ice = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.065, 0),
    new THREE.MeshStandardMaterial({ color: '#e0f0ec', roughness: 0.25, metalness: 0.07 }),
    68,
  );
  ice.name = 'crab-freezer-ice';
  const transform = new THREE.Object3D();
  for (let i = 0; i < ice.count; i++) {
    transform.position.set(
      (((i * 37) % 97) / 96 - 0.5) * 1.48,
      0.89,
      (((i * 19) % 83) / 82 - 0.5) * 0.92,
    );
    transform.rotation.set(i * 0.31, i * 0.72, i * 0.19);
    transform.scale.set(1.2, 0.35, 0.8);
    transform.updateMatrix();
    ice.setMatrixAt(i, transform.matrix);
  }
  ice.instanceMatrix.needsUpdate = true;
  ice.receiveShadow = true;
  chest.add(ice);
  const crab = createKingCrab();
  crab.name = 'king-crab-specimen';
  crab.position.y = 0.92;
  chest.add(crab);
  const cabinetFill = new THREE.PointLight('#e7f9ff', 7, 4, 2);
  cabinetFill.position.set(0, 2.03, 0.78);
  cabinet.add(cabinetFill);
  const chestFill = new THREE.PointLight('#e9f8ff', 1.6, 2.4, 2);
  chestFill.position.set(0, 1.6, 0.15);
  chest.add(chestFill);
  // The source is square: the decal stays square on both visible outer faces.
  const artworkMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  if (typeof document.createElementNS === 'function') {
    const texture = loadModelTexture(crabArtwork);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    artworkMaterial.map = texture;
  }
  const badge = mesh(
    chest,
    new THREE.PlaneGeometry(0.52, 0.52),
    artworkMaterial,
    0,
    0.515,
    0.608,
    'king-crab-user-artwork',
  );
  badge.userData.sourceArtwork = crabArtwork;
  badge.castShadow = false;
  const sideBadge = mesh(
    chest,
    new THREE.PlaneGeometry(0.44, 0.44),
    artworkMaterial,
    -cw / 2 - 0.006,
    0.515,
    0,
    'king-crab-user-artwork-side',
  );
  sideBadge.rotation.y = -Math.PI / 2;
  sideBadge.castShadow = false;
  chest.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.userData = { ...obj.userData, kind: 'stall', id: stallId };
  });
}
