import * as THREE from 'three';
import { prepareImages } from '../lib/image-assets';
import { loadModelTexture } from '../lib/model-texture-loader';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { IndoorCanteenSpec } from '../data/indoor-canteens';
import { minzuCanteenFaces, minzuSignBoards, minzuSelfSelectAreas } from '../data/minzu-canteen';
import { MINZU_SIGN_TEXTURES, MINZU_SIGN_ASPECTS } from '../assets/minzu-canteen/signs';
import type { FourthCanteenModel } from './FourthCanteenModel';
import { addCounterDetails } from './fourth-canteen-details';
import { addCanteenStaff } from './fourth-canteen-people';
import { eighthTextPlane } from './eighth-canteen-signage';

type TextureLoader = (url: string) => THREE.Texture;

export function prepareMinzuCanteenAssets() {
  return prepareImages(Object.values(MINZU_SIGN_TEXTURES));
}

/** Actual photographed sign pixels, independent of the numbered window boundaries. */
export function createMinzuCanteenModel(
  spec: IndoorCanteenSpec,
  loadTexture: TextureLoader = loadModelTexture,
): FourthCanteenModel {
  const group = new THREE.Group();
  group.name = 'minzu-canteen-outward';
  const spatial = new THREE.Group(),
    plan = new THREE.Group();
  spatial.name = 'spatial-frontages';
  plan.name = 'plan-labels';
  group.add(spatial, plan);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string, metalness = 0) {
    const key = `${color}/${metalness}`;
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: metalness ? 0.3 : 0.68,
          metalness,
        }),
      );
    return materials.get(key)!;
  }
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: string,
    metalness = 0,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material(color, metalness),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function rounded(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: string,
    radius = 0.03,
    metalness = 0,
  ) {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(width, height, depth, 2, radius),
      material(color, metalness),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function flat(
    text: string,
    x: number,
    z: number,
    width: number,
    height: number,
    ink = '#574763',
    background = '#fff9ee',
    y = 4.64,
  ) {
    const label = eighthTextPlane(text, width, height, ink, background);
    label.position.set(x, y, z);
    label.rotation.x = -Math.PI / 2;
    plan.add(label);
    return label;
  }
  const textures = new Map<keyof typeof MINZU_SIGN_TEXTURES, THREE.Texture>();
  function photograph(key: keyof typeof MINZU_SIGN_TEXTURES, width: number) {
    if (!textures.has(key)) {
      const texture = loadTexture(MINZU_SIGN_TEXTURES[key]);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      textures.set(key, texture);
    }
    const height = width / MINZU_SIGN_ASPECTS[key];
    const result = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: textures.get(key), toneMapped: false }),
    );
    result.name = `minzu-original-sign-${key}`;
    result.userData.originalSignKey = key;
    return result;
  }

  const stage = spec.stage;
  const base = rounded(
    group,
    stage.x,
    -0.28,
    stage.z,
    stage.width,
    0.55,
    stage.depth,
    '#cbc8bc',
    0.12,
  );
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileCanvas.height = 256;
  const context = tileCanvas.getContext('2d')!;
  context.fillStyle = '#e5dfd0';
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = '#c3bba9';
  context.lineWidth = 3;
  context.strokeRect(2, 2, 252, 252);
  context.strokeStyle = '#d1c8b5';
  context.lineWidth = 2;
  context.strokeRect(15, 15, 226, 226);
  context.fillStyle = '#b9aa8e';
  for (const x of [18, 220]) for (const y of [18, 220]) context.fillRect(x, y, 18, 18);
  const tiles = new THREE.CanvasTexture(tileCanvas);
  tiles.colorSpace = THREE.SRGBColorSpace;
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(stage.width / 1.3, stage.depth / 1.3);
  tiles.anisotropy = 8;
  const floor = box(
    group,
    stage.x,
    0.015,
    stage.z,
    stage.width - 0.2,
    0.06,
    stage.depth - 0.2,
    '#fff',
  );
  floor.material = new THREE.MeshStandardMaterial({ color: '#faf7ec', map: tiles, roughness: 0.5 });
  floor.castShadow = false;

  // The kitchen is an L, with its overlap allocated to the western arm only.
  const rooms = [
    { id: 'north', minX: -5, maxX: -1.5, minZ: -16, maxZ: -9 },
    { id: 'middle', minX: -5, maxX: -1.5, minZ: -9, maxZ: 1.5 },
    { id: 'corner', minX: -5, maxX: -1.5, minZ: 1.5, maxZ: 8.5 },
    { id: 'south', minX: -1.5, maxX: 5.5, minZ: 5, maxZ: 8.5 },
  ];
  for (const room of rooms) {
    const kitchen = new THREE.Group();
    kitchen.name = `kitchen-minzu-${room.id}`;
    kitchen.userData.bounds = room;
    spatial.add(kitchen);
    const w = room.maxX - room.minX,
      d = room.maxZ - room.minZ;
    const x = (room.minX + room.maxX) / 2,
      z = (room.minZ + room.maxZ) / 2;
    box(kitchen, x, 0.1, z, w, 0.13, d, '#d8d6ca');
    const ceiling = new THREE.Group();
    ceiling.name = `ceiling-minzu-${room.id}`;
    ceiling.userData.planHide = true;
    kitchen.add(ceiling);
    rounded(ceiling, x, 4.54, z, w + 0.03, 0.2, d + 0.03, '#d7d9cf');
    box(ceiling, x, 4.42, z, w, 0.025, d, '#a0a49a');
    for (let zz = room.minZ + 0.4; zz < room.maxZ; zz += 0.6)
      box(ceiling, x, 4.4, zz, w - 0.05, 0.018, 0.023, '#c9cec1', 0.2);
  }
  // Rear walls terminate at the open turning kitchen instead of cutting through it.
  box(spatial, -1.5, 2.2, -5.5, 0.12, 4.3, 21, '#d2d1bf');
  box(spatial, 2, 2.2, 5, 7, 4.3, 0.12, '#d2d1bf');
  box(spatial, -3.25, 2.2, -16, 3.5, 4.3, 0.12, '#dbd9cb');
  box(spatial, 5.5, 2.2, 6.75, 0.12, 4.3, 3.5, '#dbd9cb');
  for (let y = 0.45; y < 4.3; y += 0.45) {
    box(spatial, -1.566, y, -5.5, 0.007, 0.009, 21, '#e2e0d4');
    box(spatial, 2, y, 5.066, 7, 0.009, 0.007, '#e2e0d4');
  }

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#c5d5cd',
    transparent: true,
    opacity: 0.17,
    roughness: 0.08,
    metalness: 0.02,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const face of minzuCanteenFaces) {
    const local = new THREE.Group();
    local.name = face.faceId;
    local.position.set(face.x, 0, face.z);
    local.rotation.y = face.rotationY;
    spatial.add(local);
    const west = Math.abs(face.rotationY) > 0.1;
    const segment = face.width / face.windowCount;
    face.windowNumbers.forEach((number, index) => {
      const id = `${face.faceId}-w${index + 1}`;
      const center = -face.width / 2 + segment * (index + 0.5);
      const window = new THREE.Group();
      window.name = `window-${id}`;
      window.userData = { kind: 'stall', id, windowNumber: number };
      local.add(window);
      const trim = number === 7 ? 1.15 : 0;
      const counterWidth = segment - trim,
        counterX = center - trim / 2;
      box(window, counterX, 0.15, 0.53, counterWidth - 0.04, 0.18, 0.96, '#7f867c');
      rounded(window, counterX, 0.65, 0.53, counterWidth - 0.04, 0.9, 0.96, '#e5e3d7');
      for (const y of [0.36, 0.66, 0.96])
        box(window, counterX, y, 1.014, counterWidth - 0.06, 0.01, 0.007, '#c9ccbf');
      for (let x = counterX - counterWidth / 2 + 0.55; x < counterX + counterWidth / 2; x += 0.55)
        box(window, x, 0.64, 1.016, 0.009, 0.87, 0.007, '#c9ccbf');
      rounded(
        window,
        counterX,
        1.15,
        0.48,
        counterWidth - 0.01,
        0.14,
        1.25,
        '#b8c1b7',
        0.025,
        0.55,
      );
      box(window, counterX, 1.075, 1.06, counterWidth - 0.02, 0.09, 0.08, '#909e94', 0.5);
      const selection = box(
        window,
        counterX,
        1.235,
        1.09,
        counterWidth - 0.13,
        0.025,
        0.09,
        '#82718b',
      );
      selection.material = selection.material.clone();
      selection.userData = { kind: 'stall', id, baseColor: '#82718b' };
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(segment - 0.08, 0.76, 0.018),
        glassMaterial,
      );
      glass.position.set(center, 2.25, 1.0);
      glass.castShadow = false;
      window.add(glass);
      box(window, center, 1.87, 1.01, segment - 0.04, 0.055, 0.06, '#87968b', 0.55);
      const numberPlate = eighthTextPlane(
        String(number),
        0.39,
        0.43,
        '#fffdf5',
        number <= 2 ? '#238ed0' : '#613a68',
      );
      numberPlate.position.set(center - segment / 2 + 0.27, 2.43, 1.045);
      numberPlate.name = `actual-number-${number}`;
      window.add(numberPlate);
      if (number <= 2) {
        const menu = eighthTextPlane(
          number === 1 ? '拉面 · 刀削面\n炒面 · 炒米粉' : '脆皮鸡排饭',
          segment - 0.54,
          0.58,
          '#fffdf7',
          '#188aca',
        );
        menu.position.set(center + 0.18, 2.43, 1.055);
        menu.name = `minzu-blue-menu-${number}`;
        window.add(menu);
      }
      const originalTag = number === 3 ? 'studentSpecial' : number === 8 ? 'breakfast' : undefined;
      if (originalTag) {
        const tag = photograph(originalTag, number === 3 ? 2.9 : 2.25);
        tag.position.set(center + 0.14, 2.39, 1.055);
        window.add(tag);
      }
      if (!face.emptyWindows.includes(number)) {
        const equipment = new THREE.Group();
        equipment.position.x = counterX;
        window.add(equipment);
        addCounterDetails(equipment, counterWidth - 0.08, number + 20);
        if ([1, 3, 6, 8, 10].includes(number))
          addCanteenStaff(equipment, 0.1, -0.65, number, '#73546e');
      }
      window.traverse((object) => {
        if (object instanceof THREE.Mesh)
          object.userData = { ...object.userData, kind: 'stall', id };
      });
      const wx = face.x + center * Math.cos(face.rotationY);
      const wz = face.z - center * Math.sin(face.rotationY);
      const numberLabel = flat(
        String(number).padStart(2, '0'),
        wx + (west ? -1.45 : 0),
        wz + (west ? 0 : 1.45),
        0.42,
        0.43,
        '#fff9ed',
        '#655173',
      );
      numberLabel.userData = { kind: 'stall', id };
      if (west) {
        const text = face.windowLabels[index].replaceAll('／', '\n').replaceAll(' / ', '\n');
        const lineCount = text.split('\n').length;
        const portrait = lineCount > 1;
        const label = flat(
          text,
          wx - 3.3,
          wz,
          portrait ? 2.05 : 3.15,
          portrait ? Math.min(segment - 0.3, lineCount * 0.78) : 0.66,
          face.emptyWindows.includes(number) ? '#827a73' : '#594b64',
        );
        label.name = `offering-${number}`;
        label.userData = { kind: 'stall', id };
      }
    });
    for (let i = 0; i <= face.windowCount; i++)
      box(local, -face.width / 2 + i * segment, 1.92, 1.01, 0.065, 1.52, 0.075, '#87978c', 0.55);
    box(local, 0, 2.69, 1.01, face.width, 0.07, 0.08, '#a7b2a6', 0.55);
    const tube = box(local, 0, 2.73, 0.45, face.width - 0.17, 0.025, 0.065, '#fff8df');
    tube.material = new THREE.MeshStandardMaterial({
      color: '#ffe2a3',
      emissive: '#ffc86e',
      emissiveIntensity: 1.8,
    });
    tube.castShadow = false;
    const rearTube = box(local, 0, 2.55, -1.35, face.width - 0.2, 0.025, 0.065, '#ffe2a3');
    rearTube.material = tube.material;
    rearTube.castShadow = false;
    // Pair warm serving and preparation lights at each physical window for even coverage.
    for (let index = 0; index < face.windowCount; index++) {
      const center = -face.width / 2 + (index + 0.5) * segment;
      const servingLight = new THREE.PointLight('#ffce80', 13, 5.2, 2);
      servingLight.position.set(center - segment * 0.18, 2.35, 0.05);
      servingLight.userData = { counterLight: true, warmIntensity: 13 };
      local.add(servingLight);
      const preparationLight = new THREE.PointLight('#ffd494', 6, 4.2, 2);
      preparationLight.position.set(center + segment * 0.18, 2.4, -1.35);
      preparationLight.userData = { counterLight: true, warmIntensity: 6 };
      local.add(preparationLight);
    }
  }
  // The sketch's two southern labels each span 1.5 physical windows, not a new window.
  for (const area of minzuSelfSelectAreas) {
    const label = flat(area.label, area.x, area.z, area.width - 0.35, 0.68);
    label.name = area.id;
  }

  // All physical signboards share one fascia band, regardless of source-photo crop ratios.
  const signBottom = 2.79;
  const signHeight = 1.6;
  for (const board of minzuSignBoards) {
    const frontage = new THREE.Group();
    frontage.name = `signboard-${board.id}`;
    frontage.position.set(board.x, 0, board.z);
    frontage.rotation.y = board.rotationY;
    spatial.add(frontage);
    const imageWidth = board.width - 0.12;
    const photo = photograph(board.signKey, imageWidth);
    const nativeHeight = imageWidth / MINZU_SIGN_ASPECTS[board.signKey];
    photo.scale.y = signHeight / nativeHeight;
    const signY = signBottom + signHeight / 2;
    rounded(frontage, 0, signY, 0.97, board.width, signHeight + 0.12, 0.2, '#b5c1b4', 0.015, 0.55);
    photo.position.set(0, signY, 1.077);
    frontage.add(photo);
    for (const yy of [signBottom - 0.045, signBottom + signHeight + 0.045])
      box(frontage, 0, yy, 1.1, board.width, 0.035, 0.035, '#d7dfd2', 0.58);
    const west = Math.abs(board.rotationY) > 0.1;
    const label = flat(
      board.name,
      west ? -2.65 : board.x,
      west ? board.z : 5.8,
      west ? 4.0 : 6.3,
      0.64,
      '#524366',
      '#f2edf8',
    );
    if (west) label.rotation.z = -Math.PI / 2;
  }
  // A few photographic red lanterns; overhead decoration is hidden in the default plan.
  const overhead = new THREE.Group();
  overhead.name = 'minzu-lanterns';
  overhead.userData.planHide = true;
  spatial.add(overhead);
  for (const z of [-15.6, -6.8, 0.7]) {
    const lantern = new THREE.Group();
    lantern.position.set(-5.3, 4.35, z);
    overhead.add(lantern);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), material('#c62835'));
    globe.scale.y = 0.8;
    lantern.add(globe);
    for (const yy of [-0.265, 0.265]) {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 0.06, 12),
        material('#d7ae52', 0.15),
      );
      cap.position.y = yy;
      lantern.add(cap);
    }
    for (let i = 0; i < 8; i++) {
      const points = Array.from({ length: 17 }, (_, n) => {
        const angle = (n / 16) * Math.PI;
        return new THREE.Vector3(
          Math.sin(angle) * 0.323 * Math.cos((i * Math.PI) / 4),
          Math.cos(angle) * 0.258,
          Math.sin(angle) * 0.323 * Math.sin((i * Math.PI) / 4),
        );
      });
      const rib = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.006, 3, false),
        material('#d9b65c', 0.12),
      );
      lantern.add(rib);
    }
    for (let i = 0; i < 9; i++)
      box(lantern, (i - 4) * 0.022, -0.42, 0, 0.012, 0.28, 0.018, '#b52036');
    box(lantern, 0, 0.39, 0, 0.018, 0.2, 0.018, '#c6ae79', 0.15);
  }
  const steam: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.steam) steam.push(object);
  });
  const model: FourthCanteenModel = {
    group,
    setMode(mode) {
      plan.visible = mode === 'plan';
      spatial.visible = true;
      spatial.traverse((object) => {
        if (object.userData.planHide) object.visible = mode === '3d';
        if (object instanceof THREE.PointLight && object.userData.counterLight)
          object.intensity = object.userData.warmIntensity ?? 12;
      });
    },
    setInterfaceTheme(night) {
      base.material = material(night ? '#444753' : '#cbc8bc');
    },
    tick(time) {
      for (const puff of steam) {
        const t = (time * 0.32 + puff.userData.phase) % 1;
        puff.position.y = puff.userData.baseY + t * 0.35;
        (puff.material as THREE.MeshBasicMaterial).opacity = 0.1 * Math.sin(t * Math.PI);
      }
    },
  };
  model.setMode('plan');
  return model;
}
