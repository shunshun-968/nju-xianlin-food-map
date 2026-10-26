import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { IndoorCanteenSpec } from '../data/indoor-canteens';
import {
  eighthCanteenFaces,
  eighthDumplingKiosk,
  eighthKitchenBounds,
} from '../data/eighth-canteen';
import type { FourthCanteenModel } from './FourthCanteenModel';
import { addCounterDetails } from './fourth-canteen-details';
import { addCanteenStaff } from './fourth-canteen-people';
import { addEighthCanteenSignage, eighthTextPlane } from './eighth-canteen-signage';

/** Same reveal-roof interaction as the fifth canteen, with the eighth canteen's photographed finishes. */
export function createEighthCanteenModel(spec: IndoorCanteenSpec): FourthCanteenModel {
  const group = new THREE.Group();
  group.name = 'eighth-canteen-outward';
  const spatial = new THREE.Group(),
    plan = new THREE.Group();
  spatial.name = 'spatial-frontages';
  plan.name = 'plan-labels';
  group.add(spatial, plan);
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string, roughness = 0.7, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!cache.has(key))
      cache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return cache.get(key)!;
  }
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    metalness = 0,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material(color, metalness ? 0.3 : 0.7, metalness),
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
    w: number,
    h: number,
    d: number,
    color: string,
    radius = 0.025,
    metalness = 0,
  ) {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, radius),
      material(color, metalness ? 0.3 : 0.65, metalness),
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
    w: number,
    h: number,
    ink = '#64516b',
    background = '#fffaf0',
    y = 4.18,
  ) {
    const label = eighthTextPlane(text, w, h, ink, background);
    label.position.set(x, y, z);
    label.rotation.x = -Math.PI / 2;
    plan.add(label);
    return label;
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
  const tiles = document.createElement('canvas');
  tiles.width = tiles.height = 256;
  const ctx = tiles.getContext('2d')!;
  ctx.fillStyle = '#e7e4d7';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#d3d0c2';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, 254, 254);
  const texture = new THREE.CanvasTexture(tiles);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(stage.width, stage.depth);
  texture.anisotropy = 8;
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
  floor.material = new THREE.MeshStandardMaterial({
    color: '#fffdf4',
    map: texture,
    roughness: 0.48,
  });
  floor.castShadow = false;

  const rooms = new Map<string, { minX: number; maxX: number; minZ: number; maxZ: number }>();
  for (const face of eighthCanteenFaces) {
    const corner = face.shopId === spec.cornerShopId;
    const bounds = eighthKitchenBounds(face);
    if (rooms.has(face.shopId)) continue;
    rooms.set(face.shopId, bounds);
    const kitchen = new THREE.Group();
    kitchen.name = `kitchen-${face.shopId}`;
    kitchen.userData = { shopId: face.shopId, bounds };
    spatial.add(kitchen);
    const w = bounds.maxX - bounds.minX,
      d = bounds.maxZ - bounds.minZ;
    const x = (bounds.maxX + bounds.minX) / 2,
      z = (bounds.maxZ + bounds.minZ) / 2;
    box(kitchen, x, 0.1, z, w, 0.12, d, '#d9d8cc');
    box(kitchen, x, 1.9, bounds.minZ, w, 3.7, 0.12, '#c6c7bd');
    for (let y = 0.5; y < 3.6; y += 0.45)
      box(kitchen, x, y, bounds.minZ + 0.064, w, 0.008, 0.007, '#deded3');
    // The two corner service edges open into one room; there is no wall through either opening.
    if (bounds.minX === -15) box(kitchen, bounds.minX, 1.9, z, 0.13, 3.7, d, '#e1e0d5');
    if (corner) box(kitchen, bounds.minX, 1.9, 0, 0.13, 3.7, 1, '#e1e0d5');
    const ceiling = new THREE.Group();
    ceiling.name = `ceiling-${face.shopId}`;
    ceiling.userData.planHide = true;
    kitchen.add(ceiling);
    rounded(ceiling, x, 3.86, z, w + 0.06, 0.2, d + 0.08, '#d8d9ce');
    box(ceiling, x, 3.735, z, w - 0.05, 0.025, d - 0.06, '#8b9289');
    for (let cx = bounds.minX + 0.3; cx < bounds.maxX; cx += 0.6)
      box(ceiling, cx, 3.71, z, 0.018, 0.025, d - 0.07, '#b8bcb0', 0.2);
  }

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#c9d7ce',
    transparent: true,
    opacity: 0.18,
    roughness: 0.08,
    metalness: 0.02,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const face of eighthCanteenFaces) {
    const local = new THREE.Group();
    local.name = face.faceId;
    local.position.set(face.x, 0, face.z);
    local.rotation.y = face.rotationY;
    spatial.add(local);
    const side = face.rotationY !== 0;
    const segment = face.width / face.windowCount;
    face.windowNumbers.forEach((number, index) => {
      const id = `${face.faceId}-w${index + 1}`;
      const center = -face.width / 2 + segment * (index + 0.5);
      const window = new THREE.Group();
      window.name = `window-${id}`;
      window.userData = { windowNumber: number, kind: 'stall', id };
      local.add(window);
      // End the short-side counter before the long-side counter; the glass and number frame remain full width.
      const trim = side && index === 0 ? 1.15 : 0;
      const counterWidth = segment - trim;
      const counterX = center + trim / 2;
      box(window, counterX, 0.15, 0.53, counterWidth - 0.04, 0.18, 0.96, '#778078');
      rounded(window, counterX, 0.65, 0.53, counterWidth - 0.04, 0.9, 0.96, '#e5e4d9');
      for (const y of [0.36, 0.66, 0.96])
        box(window, counterX, y, 1.014, counterWidth - 0.06, 0.012, 0.007, '#cbcfc4');
      for (let x = counterX - counterWidth / 2 + 0.55; x < counterX + counterWidth / 2; x += 0.55)
        box(window, x, 0.64, 1.016, 0.01, 0.87, 0.007, '#cbcfc4');
      rounded(
        window,
        counterX,
        1.15,
        0.48,
        counterWidth - 0.01,
        0.14,
        1.25,
        '#b9c2ba',
        0.024,
        0.55,
      );
      box(window, counterX, 1.075, 1.06, counterWidth - 0.02, 0.09, 0.08, '#929f97', 0.5);
      const selection = box(
        window,
        counterX,
        1.235,
        1.09,
        counterWidth - 0.13,
        0.025,
        0.09,
        '#85748b',
      );
      selection.material = selection.material.clone();
      selection.userData = { kind: 'stall', id, baseColor: '#85748b' };
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(segment - 0.09, 0.76, 0.018),
        glassMaterial,
      );
      pane.position.set(center, 2.25, 1.0);
      pane.castShadow = false;
      window.add(pane);
      box(window, center, 1.87, 1.01, segment - 0.04, 0.055, 0.06, '#88978d', 0.55);
      const numberPlate = eighthTextPlane(String(number), 0.36, 0.4, '#fffdf5', '#5b3868');
      numberPlate.position.set(center - segment / 2 + 0.25, 2.44, 1.04);
      numberPlate.name = `actual-number-${number}`;
      window.add(numberPlate);
      if (number !== 3 && number !== 12) {
        const details = new THREE.Group();
        details.position.x = counterX;
        window.add(details);
        addCounterDetails(details, counterWidth - 0.08, number);
        if ([1, 4, 6, 9, 11, 14].includes(number))
          addCanteenStaff(details, 0.12, -0.65, number, '#705374');
      }
      window.traverse((object) => {
        if (object instanceof THREE.Mesh)
          object.userData = { ...object.userData, kind: 'stall', id };
      });

      const wx = face.x + center * Math.cos(face.rotationY);
      const wz = face.z - center * Math.sin(face.rotationY);
      const labelX = wx + (side ? 2.45 : 0);
      const labelZ = wz + (side ? 0 : 2.17);
      const numberLabel = flat(
        String(number).padStart(2, '0'),
        wx + (side ? 1.42 : 0),
        wz + (side ? 0 : 1.46),
        0.38,
        0.4,
        '#fff8ec',
        '#695173',
      );
      numberLabel.userData = { kind: 'stall', id };
      const label =
        face.windowLabels[index] === '鸡排饭·牛排饭' ? '鸡排饭\n牛排饭' : face.windowLabels[index];
      const offering = flat(
        label,
        labelX,
        labelZ,
        side ? 2.05 : segment - 0.08,
        label.includes('\n') ? 0.73 : 0.49,
        number === 12 ? '#8b847b' : '#614b66',
      );
      offering.name = `offering-${number}`;
      offering.userData = { kind: 'stall', id };
    });
    for (let i = 0; i <= face.windowCount; i++)
      box(local, -face.width / 2 + i * segment, 1.92, 1.01, 0.065, 1.52, 0.075, '#8c9b91', 0.55);
    box(local, 0, 2.65, 1.01, face.width, 0.07, 0.08, '#a8b3a7', 0.55);
    const tube = box(local, 0, 2.7, 0.45, face.width - 0.17, 0.025, 0.065, '#fff8df');
    tube.material = new THREE.MeshStandardMaterial({
      color: '#ffe2a3',
      emissive: '#ffc86e',
      emissiveIntensity: 1.8,
    });
    tube.castShadow = false;
    const rearTube = box(local, 0, 2.55, -1.35, face.width - 0.2, 0.025, 0.065, '#ffe2a3');
    rearTube.material = tube.material;
    rearTube.castShadow = false;
    // Light each physical window and its preparation area, rather than one dim point per sign.
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
    if (side) {
      addEighthCanteenSignage(local, [face.name], face.width, 1);
      flat(face.name, 9.55, -0.03, 2.35, 0.5, '#71591e', '#fff3ce');
    } else {
      flat(face.name, face.x, face.name === '面坊' ? 2.05 : 0.95, 3.0, 0.55, '#71591e', '#fff3ce');
    }
  }
  const main = eighthCanteenFaces.filter((face) => face.rotationY === 0).sort((a, b) => a.x - b.x);
  for (let i = 0; i < main.length; i += 2) {
    const left = main[i],
      right = main[i + 1];
    const header = new THREE.Group();
    header.position.set((left.x + right.x) / 2, 0, left.z);
    spatial.add(header);
    addEighthCanteenSignage(header, [left.name, right.name], left.width + right.width, 1);
  }
  // The pale columns break the three photographed long-side sign sections.
  for (const x of [-15, -6, 3, 12]) {
    box(spatial, x, 1.91, 4.04, 0.14, 3.76, 0.18, '#e0e2d7');
    for (let y = 0.4; y < 3.7; y += 0.47) box(spatial, x, y, 4.137, 0.14, 0.009, 0.006, '#bfc6ba');
  }

  const kiosk = new THREE.Group();
  kiosk.name = 'eighth-dumpling-kiosk';
  kiosk.userData = { kind: 'stall', id: eighthDumplingKiosk.id };
  const kp = eighthDumplingKiosk.position;
  kiosk.position.set(kp.x, 0, kp.z);
  kiosk.rotation.y = kp.rotationY;
  spatial.add(kiosk);
  for (const x of [-kp.width * 0.4, kp.width * 0.4])
    for (const z of [-kp.depth * 0.36, kp.depth * 0.36])
      rounded(kiosk, x, 0.12, z, 0.17, 0.22, 0.12, '#343c36', 0.03);
  rounded(kiosk, 0, 0.56, 0, kp.width, 0.85, kp.depth, '#51913c', 0.055);
  for (let x = -kp.width / 2 + 0.16; x < kp.width / 2 - 0.13; x += 0.1)
    box(kiosk, x, 0.35, kp.depth / 2 + 0.008, 0.025, 0.21, 0.01, '#285b2e');
  rounded(kiosk, 0, 1.04, 0, kp.width + 0.035, 0.17, kp.depth + 0.04, '#aebbb2', 0.035, 0.45);
  box(kiosk, 0, 1.135, 0, kp.width - 0.18, 0.035, kp.depth - 0.15, '#ccd7cb');
  const lidMaterial = new THREE.MeshPhysicalMaterial({
    color: '#8eaaa3',
    roughness: 0.12,
    metalness: 0.12,
    transparent: true,
    opacity: 0.6,
  });
  for (const x of [-kp.width / 4, kp.width / 4]) {
    const lid = rounded(
      kiosk,
      x,
      1.18,
      0,
      kp.width / 2 - 0.12,
      0.07,
      kp.depth - 0.17,
      '#a9bcb3',
      0.025,
    );
    lid.material = lidMaterial;
    box(kiosk, x, 1.23, 0.32, 0.34, 0.045, 0.07, '#d6ded3', 0.5);
  }
  for (const z of [-kp.depth / 2 - 0.018, kp.depth / 2 + 0.018]) {
    const sign = eighthTextPlane('水饺超市', kp.width - 0.08, 0.55, '#fffbea', '#573461');
    sign.position.set(0, 0.81, z);
    if (z < 0) sign.rotation.y = Math.PI;
    kiosk.add(sign);
  }
  const kioskSelection = box(kiosk, 0, 1.28, 0.64, kp.width - 0.18, 0.03, 0.075, '#85748b');
  kioskSelection.material = kioskSelection.material.clone();
  kioskSelection.userData = { kind: 'stall', id: eighthDumplingKiosk.id, baseColor: '#85748b' };
  kiosk.traverse((object) => {
    if (object instanceof THREE.Mesh)
      object.userData = { ...object.userData, kind: 'stall', id: eighthDumplingKiosk.id };
  });
  const kioskLabel = flat('水饺超市', kp.x, kp.z, kp.width - 0.1, 0.56, '#fff8ee', '#64406c', 1.34);
  kioskLabel.rotation.z = kp.rotationY;
  kioskLabel.userData = { kind: 'stall', id: eighthDumplingKiosk.id };

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
  model.setMode('plan');
  return model;
}
