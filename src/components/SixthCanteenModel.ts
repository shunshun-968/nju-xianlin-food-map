import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FourthCanteenModel } from './FourthCanteenModel';
import type { IndoorCanteenSpec } from '../data/indoor-canteens';
import { fourthKitchenBounds } from '../data/fourth-canteen';
import { addCounterDetails } from './fourth-canteen-details';
import { addCanteenStaff } from './fourth-canteen-people';
import { addSixthCanteenSignage } from './sixth-canteen-signage';
import { addSixthCanteenDetails, addJinlingKitchen } from './sixth-canteen-details';

/** White service portals and separate LCD screens distinguish the sixth canteen. */
export function createSixthCanteenModel(spec: IndoorCanteenSpec): FourthCanteenModel {
  const group = new THREE.Group();
  group.name = 'sixth-canteen-outward';
  const spatial = new THREE.Group();
  spatial.name = 'spatial-frontages';
  group.add(spatial);
  const plan = new THREE.Group();
  plan.name = 'plan-labels';
  group.add(plan);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string, roughness = 0.62, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!materials.has(key))
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return materials.get(key)!;
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
    round = false,
  ): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
    const m = new THREE.Mesh(
      round
        ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.025, w / 5, h / 5, d / 5))
        : new THREE.BoxGeometry(w, h, d),
      material(color, metalness ? 0.32 : 0.62, metalness),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function label(text: string, w: number, h: number, fg = '#514452', bg = '#fffdf6') {
    const c = document.createElement('canvas');
    c.height = 256;
    c.width = Math.min(4096, Math.max(512, Math.round((256 * w) / h)));
    const ctx = c.getContext('2d')!;
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, 256);
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.min(176, (c.width - 40) / Math.max(text.length, 1))}px "Microsoft YaHei",sans-serif`;
    ctx.fillText(text, c.width / 2, 133, c.width - 36);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, transparent: !bg, toneMapped: false }),
    );
  }
  function flat(text: string, x: number, z: number, w: number, h = 0.45, rotation = 0, y = 4.1) {
    const m = label(text, w, h);
    m.position.set(x, y, z);
    m.rotation.set(-Math.PI / 2, 0, rotation);
    plan.add(m);
    return m;
  }

  const { stage } = spec;
  const base = box(
    group,
    stage.x,
    -0.27,
    stage.z,
    stage.width,
    0.55,
    stage.depth,
    '#a6aaa5',
    0,
    true,
  );
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = floorCanvas.height = 256;
  const f = floorCanvas.getContext('2d')!;
  f.fillStyle = '#babdb6';
  f.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 48; i++) {
    f.fillStyle = i % 3 ? 'rgba(242,241,226,.08)' : 'rgba(84,91,83,.035)';
    f.fillRect((i * 79) % 256, (i * 37) % 256, 20 + (i % 28), 1);
  }
  f.fillStyle = '#919992';
  f.fillRect(0, 0, 256, 2);
  f.fillRect(0, 0, 2, 256);
  const tiles = new THREE.CanvasTexture(floorCanvas);
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(36, 18);
  tiles.colorSpace = THREE.SRGBColorSpace;
  tiles.anisotropy = 8;
  const floor = box(
    group,
    stage.x,
    0.015,
    stage.z,
    stage.width - 0.15,
    0.05,
    stage.depth - 0.15,
    '#ffffff',
  );
  floor.material = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.43, metalness: 0.06 });
  floor.castShadow = false;

  const rooms = new Set<string>();
  const ceilings: THREE.Group[] = [];
  function sideWall(
    room: THREE.Group,
    shopId: string,
    x: number,
    minZ: number,
    maxZ: number,
    rotation: number,
  ) {
    const windows = spec.faces
      .filter((row) => row.shopId === shopId && row.rotationY === rotation)
      .sort((a, b) => a.z - b.z);
    let start = minZ;
    const wallName =
      shopId === spec.cornerShopId ? 'jinling-closed-side-wall' : 'huaiyang-closed-side-wall';
    const solid = (from: number, to: number) => {
      if (to <= from) return;
      const wall = box(room, x, 1.91, (from + to) / 2, 0.16, 3.7, to - from, '#e3e3dd');
      wall.name = wallName;
      for (let zz = from + 0.7; zz < to - 0.2; zz += 1.2)
        box(room, x + Math.sign(rotation) * 0.084, 1.85, zz, 0.004, 3.4, 0.008, '#cecec6');
    };
    for (const window of windows) {
      solid(start, window.z - window.width / 2);
      box(room, x, 3.2, window.z, 0.16, 1.12, window.width, '#e3e3dd');
      start = window.z + window.width / 2;
    }
    solid(start, maxZ);
  }
  for (const face of spec.faces) {
    if (rooms.has(face.shopId)) continue;
    rooms.add(face.shopId);
    const b = face.kitchenBounds ?? fourthKitchenBounds(face);
    const room = new THREE.Group();
    room.name = `kitchen-${face.shopId}`;
    room.userData = { shopId: face.shopId, bounds: b };
    spatial.add(room);
    const w = b.maxX - b.minX,
      d = b.maxZ - b.minZ,
      x = (b.minX + b.maxX) / 2,
      z = (b.minZ + b.maxZ) / 2;
    box(room, x, 0.085, z, w, 0.12, d, '#d5d2c6');
    box(room, x, 1.91, b.minZ, w, 3.7, 0.15, '#d1c6b0');
    if (face.shopId === 'huaiyang-caipin')
      sideWall(room, face.shopId, b.maxX, b.minZ, b.maxZ, Math.PI / 2);
    else box(room, b.maxX, 1.91, z, 0.15, 3.7, d, '#e3e2d9');
    if (face.shopId === spec.cornerShopId) {
      sideWall(room, face.shopId, b.minX, b.minZ, b.maxZ, -Math.PI / 2);
      addJinlingKitchen(room, b);
      flat('金陵小厨', x, -0.65, w - 0.5, 0.7);
      flat('共用后厨', x, 0.15, w - 0.8, 0.35);
    } else box(room, b.minX, 1.91, z, 0.14, 3.7, d, '#e2e1d6');
    const roof = new THREE.Group();
    roof.name = `ceiling-${face.shopId}`;
    roof.userData.planHide = true;
    room.add(roof);
    ceilings.push(roof);
    box(roof, x, 3.85, z, w + 0.1, 0.25, d + 0.1, '#e1e1d9', 0, true);
    box(roof, x, 3.99, z, w - 0.1, 0.035, d - 0.1, '#dcded7');
    box(roof, x, 3.705, z, w - 0.1, 0.025, d - 0.1, '#eae8dd');
    for (let rz = b.minZ + 0.9; rz < b.maxZ - 0.5; rz += 2.6) {
      const strip = box(roof, x, 3.68, rz, Math.min(w - 0.5, 1.8), 0.025, 0.12, '#fff8e8');
      strip.material = new THREE.MeshBasicMaterial({ color: '#fff4d9' });
      strip.castShadow = false;
    }
  }

  const lights: THREE.PointLight[] = [];
  for (const [faceIndex, face] of spec.faces.entries()) {
    const local = new THREE.Group();
    local.name = face.faceId;
    local.position.set(face.x, 0, face.z);
    local.rotation.y = face.rotationY;
    spatial.add(local);
    const w = face.width,
      segment = w / face.windowCount,
      front = spec.layout.frontOffset;
    addSixthCanteenSignage(local, {
      name: face.name,
      width: w,
      front,
      screenTexts: face.screenTexts ?? ['自选菜'],
      pickup: face.rotationY !== 0,
    });
    // White structural piers frame an open serving bay, instead of a tall glass grid.
    for (const side of [-1, 1]) {
      box(local, side * (w / 2 - 0.06), 1.89, front - 0.015, 0.16, 3.65, 0.24, '#e6e5dd');
      box(local, side * (w / 2 - 0.16), 1.88, front + 0.025, 0.045, 1.65, 0.055, '#515b58', 0.35);
    }
    box(local, 0, 2.68, front + 0.025, w - 0.25, 0.085, 0.18, '#48524f', 0.45);
    for (let i = 0; i < face.windowCount; i++) {
      const x = -w / 2 + segment * (i + 0.5),
        id = `${face.faceId}-w${i + 1}`,
        opening = new THREE.Group();
      opening.name = `window-${id}`;
      local.add(opening);
      box(opening, x, 0.17, 0.57, segment - 0.035, 0.22, 0.87, '#424a47');
      box(opening, x, 0.65, 0.55, segment - 0.035, 0.83, 0.94, '#e2e3dc', 0.04, true);
      box(opening, x, 1.15, 0.52, segment - 0.02, 0.12, 1.25, '#bcc4c0', 0.5, true);
      box(opening, x, 1.058, 1.035, segment - 0.02, 0.065, 0.035, '#a6b0ab', 0.45);
      const selection = box(opening, x, 1.222, 1.12, segment - 0.14, 0.025, 0.075, '#8b8c83');
      selection.material = new THREE.MeshStandardMaterial({ color: '#8b8c83' });
      if (!face.displayOnly) selection.userData = { kind: 'stall', id, baseColor: '#8b8c83' };
      if (face.enclosed) {
        for (const sx of [-1, 1]) {
          box(opening, x + sx * (segment / 2 - 0.04), 1.94, 1, 0.045, 1.48, 0.08, '#92746b', 0.25);
          box(
            opening,
            x + sx * (segment / 2 - 0.04),
            1.94,
            1.045,
            0.025,
            1.48,
            0.025,
            '#c7ceca',
            0.6,
          );
        }
        const glass = box(
          opening,
          x,
          face.displayOnly ? 1.87 : 2.22,
          1,
          segment - 0.13,
          face.displayOnly ? 1.34 : 0.64,
          0.012,
          '#c5d7d2',
        );
        if (face.displayOnly) glass.name = 'sixth-fixed-glass';
        glass.material = new THREE.MeshPhysicalMaterial({
          color: '#d5e0d9',
          transparent: true,
          opacity: face.displayOnly ? 0.23 : 0.14,
          roughness: 0.09,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        glass.castShadow = false;
        box(opening, x, 1.885, 1.012, segment - 0.1, 0.035, 0.05, '#aab6af', 0.5);
      }
      const fixture = box(
        opening,
        x,
        2.59,
        0.64,
        segment * 0.78,
        0.065,
        0.16,
        '#ddd0aa',
        0.3,
        true,
      );
      fixture.name = 'sixth-window-light-housing';
      const lens = box(opening, x, 2.552, 0.64, segment * 0.74, 0.018, 0.12, '#ffcf73');
      lens.material = new THREE.MeshStandardMaterial({
        color: '#ffd88d',
        emissive: '#ffbb45',
        emissiveIntensity: 2.4,
        toneMapped: false,
      });
      lens.name = 'sixth-window-warm-fixture';
      lens.castShadow = false;
      const light = new THREE.PointLight('#ffc268', 20, 4.2, 2);
      light.name = 'sixth-window-warm-light';
      light.position.set(x, 2.16, 0.38);
      opening.add(light);
      lights.push(light);
      if (!face.displayOnly)
        opening.traverse((obj) => {
          if (obj instanceof THREE.Mesh) obj.userData = { ...obj.userData, kind: 'stall', id };
        });
    }
    if (face.displayOnly) {
      // A fixed pane into the same kitchen; no serving gap or extra food counter behind it.
    } else if (face.pickup) {
      // Pickup is one opening into the same long kitchen, without another row of stalls.
      addCanteenStaff(local, 0.12, -0.68, 3);
      const plate = box(local, -0.37, 1.245, 0.5, 0.35, 0.04, 0.3, '#f4edda', 0, true);
      plate.name = 'pickup-plates';
      const marker = label('取餐口', 0.72, 0.24, '#5b4c62', '#f9f5e8');
      marker.position.set(0, 0.78, 1.03);
      local.add(marker);
    } else if (face.rotationY !== 0) {
      // Keep this return counter shallow so it meets the main counter without a second kitchen.
      for (const [i, color] of ['#b86b32', '#d4a63d', '#698d43'].entries()) {
        const x = (i - 1) * 0.43;
        box(local, x, 1.24, 0.44, 0.37, 0.06, 0.48, '#a5b2a8', 0.4, true);
        for (let n = 0; n < 6; n++) {
          const food = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), material(color));
          food.scale.set(1, 0.65, 1.2);
          food.position.set(x + ((n % 2) - 0.5) * 0.12, 1.29, 0.3 + Math.floor(n / 2) * 0.13);
          local.add(food);
        }
      }
    } else {
      for (let bay = 0; bay < face.windowCount; bay += 2) {
        const bayW = Math.min(2, face.windowCount - bay) * segment;
        const details = new THREE.Group();
        details.position.x = -w / 2 + bay * segment + bayW / 2;
        local.add(details);
        addCounterDetails(details, bayW, faceIndex + bay);
        addCanteenStaff(
          details,
          bayW * 0.1,
          -0.65,
          faceIndex + bay,
          face.enclosed ? '#e5e3d7' : '#76508b',
        );
      }
    }
    addSixthCanteenDetails(local, w, {
      enclosed: face.enclosed,
      pickup: face.pickup || face.displayOnly,
      returnCounter: face.rotationY !== 0,
    });
    if (face.pickup) {
      const m = flat('取餐口', face.x - 1.65, face.z, 1.25, 0.38, Math.PI / 2, 1.28);
      m.userData = { kind: 'stall', id: `${face.faceId}-w1` };
    } else if (face.rotationY !== 0 && !face.displayOnly) {
      const m = flat('淮扬菜品', face.x + 1.65, face.z, 1.6, 0.38, -Math.PI / 2, 1.28);
      m.userData = { kind: 'stall', id: `${face.faceId}-w1` };
    } else if (face.shopId !== spec.cornerShopId) {
      const distinct = (face.screenTexts ?? [])
        .filter((t) => t !== '自选菜')
        .map((t) => t.split('\n')[0]);
      flat(face.name, face.x, face.z - 2.13, w - 0.15, 0.48);
      if (distinct.length) flat(distinct.join(' · '), face.x, face.z - 1.65, w - 0.2, 0.27);
    }
  }
  const south = label('南  ←', 2.3, 0.6, '#827c83', '');
  south.rotation.x = -Math.PI / 2;
  south.position.set(-20, 0.061, -8.5);
  group.add(south);
  const steam: THREE.Mesh[] = [];
  spatial.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.userData.steam) steam.push(obj);
  });
  return {
    group,
    setMode(mode) {
      plan.visible = mode === 'plan';
      for (const roof of ceilings) roof.visible = mode === '3d';
      for (const l of lights) l.intensity = mode === '3d' ? 20 : 14;
    },
    setInterfaceTheme(night) {
      base.material = material(night ? '#444753' : '#a6aaa5');
    },
    tick(time) {
      for (const p of steam) {
        const t = (time * 0.32 + p.userData.phase) % 1;
        p.position.y = p.userData.baseY + t * 0.35;
        (p.material as THREE.MeshBasicMaterial).opacity = 0.1 * Math.sin(t * Math.PI);
      }
    },
  };
}
