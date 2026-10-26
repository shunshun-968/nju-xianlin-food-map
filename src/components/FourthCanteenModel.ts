import { createTenthCanteenModel } from './TenthCanteenModel';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fourthKitchenBounds } from '../data/fourth-canteen';
import { fourthCanteenSpec, type IndoorCanteenSpec } from '../data/indoor-canteens';
import { addCounterDetails } from './fourth-canteen-details';
import { addCanteenStaff } from './fourth-canteen-people';
import { addCanteenSignage } from './fourth-canteen-signage';
import { addFifthCanteenSignage } from './fifth-canteen-signage';
import { createSixthCanteenModel } from './SixthCanteenModel';
import { createNinthCanteenModel } from './NinthCanteenModel';
import { createEighthCanteenModel } from './EighthCanteenModel';
import { createMinzuCanteenModel } from './MinzuCanteenModel';
import { createTwelfthCanteenModel } from './TwelfthCanteenModel';
import { createEleventhCanteenModel } from './EleventhCanteenModel';

export type FourthViewMode = 'plan' | '3d';
export type FourthCanteenModel = {
  group: THREE.Group;
  setMode: (mode: FourthViewMode) => void;
  setInterfaceTheme: (night: boolean) => void;
  tick: (time: number) => void;
};
export const FOURTH_HEIGHTS = {
  floor: 0.06,
  counter: 1.15,
  openingTop: 2.73,
  signBottom: 2.8,
  signTop: 3.65,
};

export function createFourthCanteenModel(): FourthCanteenModel {
  return createCanteenModel(fourthCanteenSpec);
}

export function createCanteenModel(spec: IndoorCanteenSpec): FourthCanteenModel {
  if (spec.style === 'tenth') return createTenthCanteenModel();
  if (spec.style === 'eleventh') return createEleventhCanteenModel(spec);
  if (spec.style === 'twelfth') return createTwelfthCanteenModel(spec);
  if (spec.style === 'ninth') return createNinthCanteenModel(spec);
  if (spec.style === 'minzu') return createMinzuCanteenModel(spec);
  if (spec.style === 'eighth') return createEighthCanteenModel(spec);
  if (spec.style === 'sixth') return createSixthCanteenModel(spec);
  const faces = spec.faces,
    layout = spec.layout,
    isFifth = spec.style === 'fifth';
  const group = new THREE.Group();
  group.name = `${spec.style}-canteen-outward`;
  const plan = new THREE.Group(),
    spatial = new THREE.Group();
  plan.name = 'plan-labels';
  spatial.name = 'spatial-frontages';
  group.add(spatial, plan);
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string, roughness = 0.7, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!cache.has(key))
      cache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return cache.get(key)!;
  }
  function mesh(
    p: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
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
    roughness = 0.7,
    metalness = 0,
  ) {
    return mesh(p, new THREE.BoxGeometry(w, h, d), material(color, roughness, metalness), x, y, z);
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
    r = 0.04,
    metalness = 0,
  ) {
    return mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, r),
      material(color, 0.42, metalness),
      x,
      y,
      z,
    );
  }
  function print(
    text: string,
    w: number,
    h: number,
    color = '#463442',
    bg = '#fffdf6',
    spaced = false,
  ) {
    const c = document.createElement('canvas');
    c.height = 512;
    c.width = Math.min(4096, Math.max(512, Math.round((512 * w) / h)));
    const ctx = c.getContext('2d')!;
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    const size = Math.min(350, (c.width - 72) / Math.max(text.length, 1));
    ctx.fillStyle = color;
    ctx.font = `600 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (spaced && text.length < 6) {
      const step = Math.min(size * 1.6, (c.width * 0.86) / text.length);
      [...text].forEach((char, i) =>
        ctx.fillText(char, c.width / 2 + (i - (text.length - 1) / 2) * step, 268),
      );
    } else ctx.fillText(text, c.width / 2, 268, c.width - 56);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: !bg,
        depthWrite: !!bg,
        toneMapped: false,
      }),
    );
  }
  function flat(
    p: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    color: string,
    bg = '',
    rotation = 0,
  ) {
    const m = print(text, w, h, color, bg);
    m.rotation.set(-Math.PI / 2, 0, rotation);
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }
  // Procedural tile texture remains sharp at close zoom; no photo/food textures are fabricated.
  const tc = document.createElement('canvas');
  tc.width = tc.height = 256;
  const tx = tc.getContext('2d')!;
  tx.fillStyle = '#e8e5da';
  tx.fillRect(0, 0, 256, 256);
  tx.fillStyle = '#dedbcf';
  tx.fillRect(0, 0, 256, 2);
  tx.fillRect(0, 0, 2, 256);
  tx.strokeStyle = '#f5f2e8';
  tx.lineWidth = 1;
  tx.strokeRect(3, 3, 250, 250);
  const tiles = new THREE.CanvasTexture(tc);
  tiles.colorSpace = THREE.SRGBColorSpace;
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(42, 20);
  tiles.anisotropy = 8;
  const wood = new THREE.MeshStandardMaterial({
    color: '#fff4df',
    roughness: 0.53,
    metalness: 0.03,
    emissive: '#ffd08b',
    emissiveIntensity: 0.18,
  });
  if (isFifth) {
    const wc = document.createElement('canvas');
    wc.width = 512;
    wc.height = 256;
    const wx = wc.getContext('2d')!;
    wx.fillStyle = '#b68546';
    wx.fillRect(0, 0, 512, 256);
    // Warm spill beneath the metal ledge, with restrained horizontal oak grain.
    for (let y = 0; y < 256; y++) {
      const glow = Math.exp(-y / 65);
      wx.fillStyle = `rgb(${Math.round(181 + 64 * glow)},${Math.round(128 + 63 * glow)},${Math.round(68 + 39 * glow)})`;
      wx.fillRect(0, y, 512, 1);
    }
    for (let line = 0; line < 72; line++) {
      const y = (line * 47) % 256;
      wx.fillStyle = line % 3 ? 'rgba(89,56,25,.085)' : 'rgba(250,215,152,.13)';
      wx.fillRect((line * 89) % 310, y, 140 + (line % 5) * 50, 1);
    }
    const woodTexture = new THREE.CanvasTexture(wc);
    woodTexture.colorSpace = THREE.SRGBColorSpace;
    woodTexture.anisotropy = 8;
    wood.map = woodTexture;
    wood.emissiveMap = woodTexture;
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
    '#cbc9be',
    0.12,
  );
  const floor = box(
    group,
    stage.x,
    0.015,
    stage.z,
    stage.width - 0.2,
    0.06,
    stage.depth - 0.2,
    '#ffffff',
  );
  floor.material = new THREE.MeshStandardMaterial({
    color: '#f5f1e6',
    map: tiles,
    roughness: isFifth ? 0.43 : 0.57,
  });
  floor.castShadow = false;

  const shops = new Map<string, THREE.Group>();
  for (const face of faces) {
    if (shops.has(face.shopId)) continue;
    const bounds = fourthKitchenBounds(face),
      kitchen = new THREE.Group();
    kitchen.name = `kitchen-${face.shopId}`;
    kitchen.userData = { shopId: face.shopId, bounds };
    spatial.add(kitchen);
    shops.set(face.shopId, kitchen);
    const width = bounds.maxX - bounds.minX,
      depth = bounds.maxZ - bounds.minZ,
      x = (bounds.minX + bounds.maxX) / 2,
      z = (bounds.minZ + bounds.maxZ) / 2;
    box(kitchen, x, 0.09, z, width, 0.13, depth, '#dedbd0');
    // Solid, deep shop ceiling, with actual thickness and a restrained roof edge.
    const ceiling = new THREE.Group();
    ceiling.name = `ceiling-${face.shopId}`;
    ceiling.userData.planHide = true;
    kitchen.add(ceiling);
    rounded(ceiling, x, 3.8, z, width + 0.12, 0.26, depth + 0.12, '#deded7', 0.035);
    box(ceiling, x, 3.96, z, width - 0.1, 0.055, depth - 0.1, '#dadbd3');
    box(ceiling, x, 3.655, z, width - 0.15, 0.025, depth - 0.15, '#555d56');
    for (let gx = bounds.minX + 0.25; gx < bounds.maxX; gx += 0.38)
      box(ceiling, gx, 3.635, z, 0.025, 0.035, depth - 0.15, '#a5aaa0', 0.4, 0.2);
    if (!isFifth)
      for (let gz = bounds.minZ + 0.25; gz < bounds.maxZ; gz += 0.38)
        box(ceiling, x, 3.632, gz, width - 0.15, 0.035, 0.025, '#a5aaa0', 0.4, 0.2);
    if (face.shopId === spec.cornerShopId) {
      // One shared label at the back of the corner kitchen keeps both service edges clear.
      const badgeX = bounds.maxX - 1.48;
      const badgeZ = bounds.minZ + 0.55;
      const badge = new THREE.Mesh(
        new RoundedBoxGeometry(2.7, 0.02, 0.88, 2, 0.009),
        new THREE.MeshBasicMaterial({ color: '#fff6dc', toneMapped: false }),
      );
      badge.position.set(badgeX, 4.13, badgeZ);
      plan.add(badge);
      flat(plan, spec.cornerTitle, badgeX, 4.15, badgeZ - 0.17, 2.3, 0.38, '#765625');
      flat(plan, spec.cornerSubtitle, badgeX, 4.15, badgeZ + 0.2, 2.5, 0.26, '#766343');
    }
  }

  const partitionKeys = new Set<string>();
  for (const [index, face] of faces.entries()) {
    const local = new THREE.Group();
    local.name = face.faceId;
    local.position.set(face.x, 0, face.z);
    local.rotation.y = face.rotationY;
    spatial.add(local);
    const w = face.width,
      h = FOURTH_HEIGHTS,
      front = layout.frontOffset,
      back = front - layout.kitchenDepth;
    // A fully recessed shop instead of a thin wall. Two 麦金地 fronts open onto one kitchen.
    box(local, 0, 1.9, back, w, 3.7, 0.15, isFifth ? '#b7a384' : '#c6c3b6');
    for (let yy = 0.35; yy < 3.7; yy += 0.45)
      box(local, 0, yy, back + 0.079, w, 0.008, 0.006, '#cfcfc6');
    for (let xx = -w / 2 + 0.5; xx < w / 2; xx += 0.6)
      box(local, xx, 1.88, back + 0.081, 0.008, 3.65, 0.007, '#d3d4ca');
    if (face.shopId !== spec.cornerShopId)
      for (const side of [-1, 1]) {
        const x = (side * w) / 2,
          worldX = face.x + x * Math.cos(face.rotationY) - 0.75 * Math.sin(face.rotationY),
          worldZ = face.z - x * Math.sin(face.rotationY) - 0.75 * Math.cos(face.rotationY);
        const key = `${worldX.toFixed(2)}/${worldZ.toFixed(2)}/${Math.abs(Math.cos(face.rotationY)).toFixed(1)}`;
        if (!partitionKeys.has(key)) {
          partitionKeys.add(key);
          box(local, x, 1.87, -0.75, 0.12, 3.65, 3.5, '#e0dfd5');
        }
      }
    const signage = {
      name: face.name,
      width: w,
      front,
      color: face.color,
      shopId: face.shopId,
      index,
    };
    if (isFifth) addFifthCanteenSignage(local, { ...signage, windowNumbers: face.windowNumbers! });
    else addCanteenSignage(local, signage);
    const steel = material('#bcc4bf', 0.28, 0.52),
      dark = material('#697570', 0.3, 0.45);
    const segment = w / face.windowCount;
    for (let i = 0; i < face.windowCount; i++) {
      const id = `${face.faceId}-w${i + 1}`,
        x = -w / 2 + segment * (i + 0.5),
        window = new THREE.Group();
      window.name = `window-${id}`;
      local.add(window);
      // Cabinet plinth, ivory tile front, thick bullnose stainless counter.
      box(window, x, 0.15, 0.58, segment - 0.06, 0.2, 0.82, '#757e77');
      const cabinet = rounded(
        window,
        x,
        0.65,
        0.54,
        segment - 0.045,
        0.86,
        0.91,
        isFifth ? '#b8874c' : '#e5e2d5',
        0.022,
      );
      if (isFifth) cabinet.material = wood;
      if (!isFifth)
        for (let yy = 0.42; yy < 1.0; yy += 0.27)
          box(window, x, yy, 1.003, segment - 0.08, 0.009, 0.004, '#cccac0');
      if (isFifth) {
        box(window, x, 0.65, 1.003, 0.009, 0.81, 0.005, '#8f693e');
        const led = box(window, x, 1.043, 1.032, segment - 0.05, 0.018, 0.015, '#ffd179');
        led.material = new THREE.MeshBasicMaterial({ color: '#ffcf79', toneMapped: false });
        led.castShadow = false;
      }
      box(window, x, 1.06, 1.01, segment - 0.025, 0.11, 0.06, '#a8b0a9', 0.28, 0.48);
      mesh(
        window,
        new RoundedBoxGeometry(segment - 0.018, 0.12, 1.25, 2, 0.025),
        steel,
        x,
        h.counter,
        0.52,
      );
      const selection = new THREE.Mesh(
        new THREE.BoxGeometry(segment - 0.12, 0.028, 0.09),
        new THREE.MeshStandardMaterial({ color: '#77717b', roughness: 0.45 }),
      );
      selection.position.set(x, 1.22, 1.11);
      selection.userData = { kind: 'stall', id, baseColor: '#77717b' };
      window.add(selection);
      // Open lower service gap, genuine translucent upper glass, separate stainless rails.
      const glazing = new THREE.MeshPhysicalMaterial({
        color: '#c4d7d3',
        roughness: 0.08,
        metalness: 0.03,
        transparent: true,
        opacity: 0.19,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const glass = mesh(
        window,
        new THREE.BoxGeometry(segment - 0.11, 0.58, 0.018),
        glazing,
        x,
        2.2,
        0.99,
      );
      glass.castShadow = false;
      mesh(window, new THREE.BoxGeometry(segment - 0.03, 0.055, 0.06), dark, x, 1.89, 1.0);
      if (!isFifth && spec.showWindowNumbers !== false) {
        const number = print(`${i + 1}`, 0.13, 0.16, '#756d78', '#f6f3eb');
        number.position.set(x, 0.8, 1.014);
        window.add(number);
      }
      window.traverse((object) => {
        if (object instanceof THREE.Mesh)
          object.userData = { ...object.userData, kind: 'stall', id };
      });
    }
    for (let i = 0; i <= face.windowCount; i++) {
      const x = -w / 2 + i * segment;
      box(local, x, 1.89, 1, 0.065, 1.48, 0.075, '#808e87', 0.22, 0.6);
    }
    box(local, 0, 2.54, 1, w, 0.065, 0.08, '#87958d', 0.22, 0.6);
    // Integrated fluorescent strip and subtle under-sign light, always on indoors.
    box(local, 0, 3.68, 1.04, w - 0.16, 0.08, 0.16, '#9da69d', 0.3, 0.3);
    const tube = box(local, 0, 3.624, 1.04, w - 0.3, 0.025, 0.09, '#fffbe5');
    tube.material = new THREE.MeshStandardMaterial({
      color: '#fffce9',
      emissive: '#fff0cf',
      emissiveIntensity: 1.6,
    });
    tube.castShadow = false;
    const warmLight = new THREE.PointLight('#ffb969', 13, 4.2, 2);
    warmLight.position.set(-w * 0.14, 2.03, 0.46);
    warmLight.userData.counterLight = true;
    local.add(warmLight);
    const heatStrip = box(local, 0, 1.88, 0.78, w - 0.2, 0.035, 0.055, '#f9d897');
    heatStrip.material = new THREE.MeshStandardMaterial({
      color: '#ffe8ba',
      emissive: '#ffb451',
      emissiveIntensity: 2.3,
    });
    if (isFifth) {
      for (let first = 0; first < face.windowCount; first += 2) {
        const bayWidth = Math.min(2, face.windowCount - first) * segment;
        const bay = new THREE.Group();
        bay.position.x = -w / 2 + first * segment + bayWidth / 2;
        local.add(bay);
        addCounterDetails(bay, bayWidth, index + first);
        if (first === 0 || index % 2 === 0)
          addCanteenStaff(bay, bayWidth * 0.12, -0.65, index + first);
      }
    } else {
      addCounterDetails(local, w, index);
      if (index % 2 === 0 && index < 11) addCanteenStaff(local, w * 0.12, -0.65, index);
    }

    // Top view: a real 3.5-deep footprint with openings on the OUTER side.
    for (let i = 0; spec.showWindowNumbers !== false && i < face.windowCount; i++) {
      const id = `${face.faceId}-w${i + 1}`,
        x = -w / 2 + segment * (i + 0.5);
      const numberOffset = front + (isFifth ? 0.7 : 0.3);
      const wx = face.x + x * Math.cos(face.rotationY) + numberOffset * Math.sin(face.rotationY),
        wz = face.z - x * Math.sin(face.rotationY) + numberOffset * Math.cos(face.rotationY);
      const n = flat(
        plan,
        `${face.windowNumbers?.[i] ?? i + 1}`,
        wx,
        1.42,
        wz,
        0.32,
        0.4,
        '#66516f',
        '#fff7e4',
      );
      n.userData = { kind: 'stall', id };
    }
    // 麦金地 already has one horizontal shop badge; crossed frontage labels obscure its L counter.
    if (face.shopId === spec.cornerShopId) continue;
    const side = Math.abs(Math.cos(face.rotationY)) < 0.1;
    const labelDepth = back + 0.32;
    const signX = face.x + labelDepth * Math.sin(face.rotationY),
      signZ = face.z + labelDepth * Math.cos(face.rotationY);
    flat(
      plan,
      face.name,
      signX,
      4.15,
      signZ,
      w - 0.08,
      0.62,
      '#503b55',
      '#fffdf7',
      side ? Math.PI / 2 : 0,
    );
  }
  // The shop corner is one occupied room, with a continuous gold fascia meeting at C.
  const { x: cx, z: cz } = layout.corner;
  box(spatial, cx, 1.9, cz, 0.095, 1.55, 0.095, '#7d8b82', 0.3, 0.45);
  rounded(
    spatial,
    cx,
    3.22,
    cz,
    isFifth ? 0.08 : 0.3,
    0.9,
    isFifth ? 0.08 : 0.3,
    isFifth ? '#302b28' : '#e5bd48',
    0.025,
  );
  flat(
    group,
    '南  ←',
    stage.x - stage.width / 2 + 3,
    0.061,
    stage.z - stage.depth / 2 + 1.3,
    3,
    0.8,
    '#83778b',
  );
  const steam: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.steam) steam.push(object);
  });
  return {
    group,
    setMode(mode) {
      plan.visible = mode === 'plan';
      spatial.visible = true;
      spatial.traverse((object) => {
        if (object.userData.planHide) object.visible = mode === '3d';
        if (object instanceof THREE.PointLight && object.userData.counterLight)
          object.intensity = mode === '3d' ? 13 : 6.5;
      });
    },
    setInterfaceTheme(night) {
      base.material = material(night ? '#444753' : '#cbc9be');
    },
    tick(time) {
      for (const puff of steam) {
        const t = (time * 0.32 + puff.userData.phase) % 1;
        puff.position.y = puff.userData.baseY + t * 0.35;
        (puff.material as THREE.MeshBasicMaterial).opacity = 0.1 * Math.sin(t * Math.PI);
      }
    },
  };
}
