import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ninthCanteenFaces, ninthArea, type NinthCanteenFace } from '../data/ninth-canteen';
import type { IndoorCanteenSpec } from '../data/indoor-canteens';
import type { FourthCanteenModel } from './FourthCanteenModel';
import { addCounterDetails } from './fourth-canteen-details';
import { addCanteenStaff } from './fourth-canteen-people';
import { addNinthCanteenSignage } from './ninth-canteen-signage';
import { addNinthCanteenAtmosphere } from './ninth-canteen-atmosphere';
import { addNinthSeafoodFreezers } from './ninth-canteen-freezers';

/** One spatial model, with removable roofs for the plan. All dimensions come from the catalog faces. */
export function createNinthCanteenModel(spec: IndoorCanteenSpec): FourthCanteenModel {
  const group = new THREE.Group();
  group.name = 'ninth-canteen-two-rows';
  const spatial = new THREE.Group();
  const plan = new THREE.Group();
  plan.name = 'plan-labels';
  group.add(spatial, plan);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const lights: THREE.PointLight[] = [];
  const roofs: THREE.Group[] = [];
  function material(color: string, metalness = 0, roughness = 0.65) {
    const key = `${color}/${metalness}/${roughness}`;
    if (!materials.has(key))
      materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return materials.get(key)!;
  }
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
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
    metalness = 0,
  ) {
    const m = mesh(p, cube, material(color, metalness, metalness ? 0.3 : 0.64), x, y, z);
    m.scale.set(w, h, d);
    return m;
  }
  function round(
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    metalness = 0,
  ) {
    return mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, 0.035),
      material(color, metalness, metalness ? 0.28 : 0.55),
      x,
      y,
      z,
    );
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
    return mesh(p, new THREE.CylinderGeometry(r, r, h, 20), material(color, metalness), x, y, z);
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#c7e1db',
    roughness: 0.1,
    metalness: 0.05,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.MeshBasicMaterial({ color: '#ffdc9c', toneMapped: false });
  function strip(p: THREE.Object3D, x: number, y: number, z: number, w: number) {
    const m = box(p, x, y, z, w, 0.035, 0.055, '#ffdc9c');
    m.material = glow;
    m.castShadow = false;
  }
  function textPlane(
    text: string,
    w: number,
    h: number,
    color = '#4d4740',
    bg = '',
    font = '"Microsoft YaHei", sans-serif',
    vertical = false,
  ) {
    const c = document.createElement('canvas');
    c.width = Math.min(2048, Math.max(512, Math.round((256 * w) / h)));
    c.height = 256;
    if (vertical) {
      c.width = 256;
      c.height = Math.min(2048, Math.round((256 * h) / w));
    }
    const ctx = c.getContext('2d')!;
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    const characters = Array.from(text.replace(/\s/g, ''));
    const size = vertical
      ? Math.min(175, (c.height - 32) / Math.max(characters.length, 1))
      : Math.min(175, (c.width - 32) / Math.max(text.length, 1));
    ctx.font = `600 ${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    if (vertical) {
      const step = (c.height - 32) / Math.max(characters.length, 1);
      characters.forEach((character, i) =>
        ctx.fillText(character, c.width / 2, 16 + step * (i + 0.5), c.width - 24),
      );
    } else ctx.fillText(text, c.width / 2, 130, c.width - 24);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, transparent: !bg, toneMapped: false, depthWrite: !!bg }),
    );
  }
  function flat(
    text: string,
    x: number,
    z: number,
    w: number,
    h: number,
    color = '#564b3c',
    y = 4.28,
    bg = '#fffaf0',
    vertical = false,
  ) {
    const m = textPlane(text, w, h, color, bg, undefined, vertical);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    plan.add(m);
    return m;
  }
  function frontText(
    p: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    color = '#4d4740',
    bg = '',
  ) {
    const m = textPlane(text, w, h, color, bg);
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }

  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileCanvas.height = 256;
  const tile = tileCanvas.getContext('2d')!;
  tile.fillStyle = '#ece6d7';
  tile.fillRect(0, 0, 256, 256);
  tile.fillStyle = '#c5bdac';
  tile.fillRect(0, 0, 256, 2);
  tile.fillRect(0, 0, 2, 256);
  tile.fillStyle = '#f6f1e5';
  tile.fillRect(4, 4, 248, 2);
  const tileMap = new THREE.CanvasTexture(tileCanvas);
  tileMap.colorSpace = THREE.SRGBColorSpace;
  tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping;
  tileMap.repeat.set(40, 32);
  tileMap.anisotropy = 8;
  const { stage } = spec;
  const base = round(group, stage.x, -0.25, stage.z, stage.width, 0.5, stage.depth, '#c7bba5');
  const floor = box(
    group,
    stage.x,
    0.045,
    stage.z,
    stage.width - 0.2,
    0.09,
    stage.depth - 0.2,
    '#ffffff',
  );
  floor.material = new THREE.MeshStandardMaterial({
    map: tileMap,
    color: '#fff8e8',
    roughness: 0.38,
  });
  floor.castShadow = false;
  // Discrete perimeter lines make the model read as a cutaway of a real room.
  for (const z of [-20.8, 16.8]) box(spatial, 0, 0.1, z, 47.6, 0.02, 0.08, '#a69982');

  const builtRooms = new Set<string>();
  for (const face of ninthCanteenFaces) {
    if (builtRooms.has(face.shopId)) continue;
    builtRooms.add(face.shopId);
    const area = ninthArea(face);
    const bounds = face.kitchenBounds;
    const room = new THREE.Group();
    room.name = `ninth-room-${face.shopId}`;
    const width = bounds ? bounds.maxX - bounds.minX : face.width;
    const depth = bounds ? bounds.maxZ - bounds.minZ : face.depth;
    room.position.set(
      bounds ? (bounds.minX + bounds.maxX) / 2 : area.x,
      0,
      bounds ? (bounds.minZ + bounds.maxZ) / 2 : area.z,
    );
    room.rotation.y = face.rotationY;
    spatial.add(room);
    box(room, 0, 0.15, 0, width, 0.13, depth, face.role === 'restaurant' ? '#c5ae8e' : '#d4cec0');
    const roof = new THREE.Group();
    roof.name = `ninth-roof-${face.shopId}`;
    roof.userData.planHide = true;
    room.add(roof);
    roofs.push(roof);
    // The near row is an architectural cutaway: the original service facade
    // remains full height, with a low outer wall and a thick ceiling lintel.
    const nearRow = Math.cos(face.rotationY) < -0.5;
    const roofDepth = nearRow ? 0.48 : depth + 0.08;
    const roofZ = nearRow ? depth / 2 - 0.15 : 0;
    round(roof, 0, 3.88, roofZ, width + 0.1, 0.22, roofDepth, '#d5cec1');
    box(roof, 0, 3.755, roofZ, width - 0.1, 0.02, roofDepth - 0.12, '#343735');
    for (let x = -width / 2 + 0.3; x < width / 2; x += 0.42)
      box(roof, x, 3.73, roofZ, 0.035, 0.035, roofDepth - 0.15, '#807d72');
    // The shared corner has only its north/east rear walls: no partition through the two counters.
    if (face.shopId === 'yue-qing-he') {
      box(room, 0, 1.85, -depth / 2, width, 3.55, 0.13, '#e5e9e2');
      box(room, width / 2, 1.85, 0, 0.13, 3.55, depth, '#e5e9e2');
    } else {
      box(
        room,
        0,
        nearRow ? 0.44 : 1.85,
        -depth / 2,
        width,
        nearRow ? 0.62 : 3.55,
        0.13,
        face.role === 'restaurant' ? '#a88a69' : '#d9d8ca',
      );
      for (const side of [-1, 1])
        box(
          room,
          (side * width) / 2,
          nearRow ? 0.62 : 1.85,
          0,
          0.11,
          nearRow ? 0.98 : 3.55,
          depth,
          '#e2d5bd',
        );
      for (let z = -depth / 2 + 0.5; !nearRow && z < depth / 2; z += 0.6) {
        for (const side of [-1, 1])
          box(room, side * (width / 2 - 0.06), 1.5, z, 0.006, 2.8, 0.007, '#bcb6a9');
      }
    }
  }

  function vent(p: THREE.Object3D, x: number, z: number, width: number) {
    box(p, x, 0.39, z, width, 0.35, 0.025, '#505b57', 0.45);
    for (let i = 0; i < 7; i++)
      box(p, x, 0.25 + i * 0.044, z + 0.02, width - 0.03, 0.012, 0.018, '#bac1b9', 0.5);
  }
  function counter(p: THREE.Group, face: NinthCanteenFace, front: number) {
    const w = face.width;
    const salad = face.shopId === 'yue-qing-he';
    const color = salad ? '#e6e4d6' : face.shopId === 'roast-goose' ? '#34574a' : '#ba8c58';
    box(p, 0, 0.22, front - 0.45, w - 0.07, 0.28, 1, '#555c55');
    round(p, 0, 0.68, front - 0.45, w - 0.08, 0.82, 1, color);
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.42)
      box(p, x, 0.67, front + 0.058, 0.013, 0.7, 0.008, salad ? '#c1c5b8' : '#a3774a');
    round(p, 0, 1.15, front - 0.43, w - 0.02, 0.13, 1.23, '#c7cbc2', 0.5);
    strip(p, 0, 1.046, front + 0.09, w - 0.16);
    if (salad || face.shopId === 'seafood-hotpot' || face.shopId === 'dongbei') {
      for (const x of [-w * 0.3, w * 0.3]) vent(p, x, front + 0.068, 0.55);
    }
    if (face.stallId) {
      const selected = box(p, 0, 1.225, front + 0.17, w - 0.16, 0.028, 0.08, '#88755f');
      selected.material = material('#88755f').clone();
      selected.userData = { kind: 'stall', id: face.stallId, baseColor: '#88755f' };
    }
    if (face.shopId === 'roast-goose') {
      const display = mesh(
        p,
        new THREE.BoxGeometry(w - 0.25, 1.42, 0.02),
        glass,
        0,
        2.0,
        front + 0.02,
      );
      display.castShadow = false;
      for (let x = -w / 2 + 0.2; x < w / 2; x += 1.7)
        box(p, x, 2.0, front + 0.04, 0.045, 1.5, 0.055, '#285243', 0.25);
      box(p, 0, 2.68, front, w - 0.15, 0.05, 0.07, '#365946', 0.3);
    } else if (salad || face.shopId === 'dongbei') {
      const panel = mesh(
        p,
        new THREE.BoxGeometry(w - 0.18, 0.4, 0.025),
        glass,
        0,
        1.53,
        front - 0.15,
      );
      panel.rotation.x = -0.35;
      panel.castShadow = false;
      for (const side of [-1, 1]) {
        if (face.openEnds?.includes(side < 0 ? 'left' : 'right')) continue;
        box(p, side * (w / 2 - 0.15), 1.48, front - 0.12, 0.035, 0.52, 0.045, '#a7b7ac', 0.65);
      }
    }
  }
  function bamboo(p: THREE.Object3D, x: number, z: number, count: number, y = 1.22) {
    for (let i = 0; i < count; i++) {
      cylinder(p, x, y + i * 0.12, z, 0.27, 0.11, '#bf8d4d');
      for (const dy of [-0.046, 0.045])
        cylinder(p, x, y + i * 0.12 + dy, z, 0.277, 0.012, '#e1b574');
    }
    cylinder(p, x, y + (count - 1) * 0.12 + 0.07, z, 0.25, 0.025, '#e2c393');
  }
  function specialistDetails(p: THREE.Group, face: NinthCanteenFace, front: number) {
    const w = face.width;
    if (face.shopId === 'jimingtangbao') {
      for (const [i, x] of [-w * 0.28, -w * 0.1, w * 0.25].entries())
        bamboo(p, x, front - 0.4, 3 + i);
    }
    if (face.shopId === 'roast-goose') {
      box(p, -0.4, 2.5, front - 0.45, w - 1.5, 0.035, 0.035, '#a6afa1', 0.65);
      for (let i = 0; i < 4; i++) {
        const x = -w * 0.32 + i * 0.67;
        box(p, x, 2.36, front - 0.45, 0.014, 0.28, 0.014, '#a9b6a7', 0.7);
        const body = mesh(
          p,
          sphere,
          material(i % 2 ? '#a95321' : '#b4672d', 0, 0.35),
          x,
          2.02,
          front - 0.45,
        );
        body.scale.set(0.19, 0.29, 0.16);
        for (const side of [-1, 1]) {
          const leg = mesh(p, sphere, material('#9c4d20'), x + side * 0.08, 1.73, front - 0.45);
          leg.scale.set(0.058, 0.17, 0.065);
          leg.rotation.z = side * 0.15;
        }
      }
    }
  }

  for (const [index, face] of ninthCanteenFaces.entries()) {
    const local = new THREE.Group();
    local.name = face.faceId;
    local.position.set(face.x, 0, face.z);
    local.rotation.y = face.rotationY;
    local.userData = { shopId: face.shopId, stallId: face.stallId };
    spatial.add(local);
    const w = face.width;
    const front = 1;
    if (face.role !== 'feature-wall')
      addNinthCanteenSignage(local, {
        shopId: face.shopId,
        name: face.name,
        width: w,
        front,
      });
    for (const side of [-1, 1]) {
      if (face.openEnds?.includes(side < 0 ? 'left' : 'right')) continue;
      box(local, side * (w / 2 - 0.045), 1.82, front - 0.03, 0.1, 3.6, 0.22, '#c29e71');
      box(local, side * (w / 2 - 0.045), 0.17, front + 0.01, 0.11, 0.2, 0.24, '#454a40');
    }
    if (face.role === 'feature-wall') {
      // Pure wall: no invented serving counter and no selectable stall.
      box(local, 0, 1.87, front - 0.06, w, 3.6, 0.18, '#8d3533');
      const logo = textPlane(
        'Pizza Hut',
        w * 0.76,
        0.76,
        '#fff8e6',
        '',
        '"Segoe Script", "Brush Script MT", cursive',
      );
      logo.position.set(0, 1.7, front + 0.07);
      local.add(logo);
      const neon = new THREE.MeshBasicMaterial({ color: '#e6f6ff', toneMapped: false });
      for (const y of [0.3, 0.57, 2.5]) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-w / 2 + 0.15, y, front + 0.07),
          new THREE.Vector3(-w * 0.28, y + 0.3, front + 0.07),
          new THREE.Vector3(-w * 0.14, y + 0.75, front + 0.07),
          new THREE.Vector3(w * 0.18, y + 0.87, front + 0.07),
          new THREE.Vector3(w * 0.28, y + 0.43, front + 0.07),
          new THREE.Vector3(w / 2 - 0.15, y + 0.2, front + 0.07),
        ]);
        mesh(local, new THREE.TubeGeometry(curve, 36, 0.022, 6, false), neon, 0, 0, 0).castShadow =
          false;
      }
    } else if (face.role === 'return') {
      counter(local, face, front);
      for (const [i, x] of [-1.8, -1.2, 1.3, 1.9].entries()) bamboo(local, x, 0.47, 4 + i);
      for (let tray = 0; tray < 9; tray++)
        box(local, 0.2, 1.25 + tray * 0.027, 0.48, 0.62, 0.022, 0.43, '#3c5144');
      const trolley = new THREE.Group();
      local.add(trolley);
      trolley.position.set(-2.4, 0, 1.75);
      round(trolley, 0, 0.68, 0, 0.9, 1.05, 0.74, '#a4afa3', 0.6);
      for (const x of [-0.35, 0.35])
        for (const z of [-0.25, 0.25]) cylinder(trolley, x, 0.13, z, 0.07, 0.07, '#40493f');
      addCanteenStaff(local, 0.35, -0.3, 1, '#89b1bd');
      box(local, 2.85, 0.56, 1.6, 0.58, 0.93, 0.65, '#548a49');
      round(local, 2.85, 1.04, 1.6, 0.64, 0.09, 0.71, '#303e32');
    } else if (face.role === 'restaurant' && face.shopId === 'pizza-hut') {
      const selected = box(local, 0, 0.21, front + 0.12, w - 0.16, 0.025, 0.09, '#88755f');
      selected.material = material('#88755f').clone();
      selected.userData = { kind: 'stall', id: face.stallId, baseColor: '#88755f' };
      // Red glazed dining-room entrance, as in photograph 11, rather than a food-window substitute.
      const glazing = mesh(
        local,
        new THREE.PlaneGeometry(w - 0.1, 2.76),
        glass,
        0,
        1.48,
        front + 0.03,
      );
      glazing.castShadow = false;
      for (let x = -w / 2; x <= w / 2; x += 1.33)
        box(local, x, 1.46, front + 0.05, 0.055, 2.82, 0.07, '#a63f3b');
      for (const y of [0.32, 0.82, 2.72]) box(local, 0, y, front + 0.05, w, 0.045, 0.08, '#a63f3b');
      for (const x of [1.4, 1.75])
        box(local, x, 1.38, front + 0.12, 0.022, 0.6, 0.03, '#c8c4ae', 0.7);
      strip(local, 0, 2.76, front + 0.08, w - 0.2);
      for (const x of [-2.4, 0, 2.4]) {
        round(local, x, 0.88, -1.7, 1.5, 0.09, 0.9, '#e8d7b9');
        box(local, x, 0.46, -1.7, 0.1, 0.8, 0.1, '#51483b');
        for (const z of [-2.45, -0.95]) {
          round(local, x, 0.52, z, 1.48, 0.19, 0.55, '#6b7a56');
          box(local, x, 0.87, z + (z < -1.7 ? -0.23 : 0.23), 1.48, 0.62, 0.1, '#6b7a56');
        }
        cylinder(local, x, 0.95, -1.7, 0.25, 0.035, '#c29351');
        cylinder(local, x, 0.974, -1.7, 0.22, 0.025, '#d8ae53');
      }
    } else if (face.shopId === 'seafood-hotpot') {
      addNinthSeafoodFreezers(local, w, face.stallId!);
      addCanteenStaff(local, w * 0.35, -1, index, '#88adbb');
    } else if (face.serviceFrontages) {
      // Keep the full-width sign, but build only the photographed left L-counter.
      // Both service edges use the same data as catalog picking; nothing spans the aisle.
      for (const [partIndex, part] of face.serviceFrontages.entries()) {
        const service = new THREE.Group();
        service.name = partIndex === 0 ? 'roast-goose-front-counter' : 'roast-goose-return-counter';
        service.position.set(part.x, 0, part.z);
        service.rotation.y = part.rotationY;
        local.add(service);
        const counterFace = { ...face, width: part.width };
        counter(service, counterFace, front);
        addCounterDetails(service, part.width - 0.3, index + partIndex);
        if (partIndex === 0) {
          specialistDetails(service, counterFace, front);
          addCanteenStaff(service, -part.width * 0.12, -0.7, index, '#88adbb');
        }
        strip(service, 0, 2.58, 0.7, part.width - 0.3);
        const lamp = new THREE.PointLight('#ffbd63', 22, 5.4, 2);
        lamp.position.set(0, 2.23, 0.35);
        service.add(lamp);
        lights.push(lamp);
      }
      flat('通道', face.x + 1.8, face.z - 1.8, 1.15, 0.38, '#877960', 0.23, '');
    } else {
      const offset = face.counterInset ?? 0;
      const service = new THREE.Group();
      service.position.z = -offset;
      local.add(service);
      if (face.role === 'recessed') {
        service.name = 'roujiamo-recessed-counter';
        for (const x of [-1.6, 1.6]) {
          round(local, x, 0.85, -1.15, 1.05, 0.08, 1.35, '#e6d8c0');
          for (const z of [-1.7, -0.6]) {
            round(local, x + (x < 0 ? 0.65 : -0.65), 0.52, z, 0.45, 0.1, 0.45, '#ba955d');
          }
        }
        frontText(service, '取餐处', 0, 0.73, 1.08, 1.1, 0.3, '#9a3b2d', '#f4ebdc');
      }
      counter(service, face, front);
      if (face.shopId !== 'seafood-hotpot') {
        // Shared corner return gets food trays only, avoiding a duplicate wall/appliance in its middle.
        if (face.faceId.endsWith('-west')) {
          for (let i = 0; i < 6; i++) {
            const x = -w / 2 + 0.7 + i * 0.72;
            box(service, x, 1.25, 0.6, 0.63, 0.07, 0.52, '#acb8a9', 0.45);
            for (let j = 0; j < 5; j++) {
              const food = mesh(
                service,
                sphere,
                material(['#71924b', '#c79e43', '#b7744b'][i % 3]),
                x - 0.22 + j * 0.1,
                1.3,
                0.58,
              );
              food.scale.set(0.075, 0.05, 0.16);
            }
          }
        } else {
          addCounterDetails(service, w - 0.3, index);
          addCanteenStaff(service, w * 0.18, -0.7, index, '#88adbb');
        }
      } else addCanteenStaff(service, w * 0.35, -1.0, index, '#88adbb');
      specialistDetails(service, face, front);
      if (face.shopId === 'burger-king') {
        for (const x of [-2.3, -1.1, 0.3, 1.7]) {
          round(service, x, 1.25, 0.4, 0.75, 0.04, 0.48, '#665344');
          cylinder(service, x, 1.32, 0.4, 0.14, 0.1, '#d5a257');
          cylinder(service, x, 1.39, 0.4, 0.145, 0.06, '#c58c3d');
          cylinder(service, x + 0.24, 1.4, 0.33, 0.075, 0.3, '#e0d5bb');
        }
        frontText(local, '火烤现烤 味道更好', 0, 2.54, -0.28, w - 1, 0.33, '#4d3322', '#f7ebcb');
      }
      // Warm counter lamps light food, not just a yellow piece of geometry.
      strip(service, 0, 2.58, 0.7, w - 0.3);
      const lamp = new THREE.PointLight('#ffbd63', 22, 5.4, 2);
      lamp.position.set(0, 2.23, 0.35);
      service.add(lamp);
      lights.push(lamp);
      const menu = frontText(
        service,
        face.food,
        0,
        2.45,
        1.03,
        w - 0.3,
        0.3,
        '#fff0ca',
        face.shopId === 'chili-pork' ? '#355e37' : '#4c4035',
      );
      menu.name = 'ninth-verified-food-label';
    }
    // Keep labels in the clear rear strip of each kitchen, away from service furniture.
    if (face.faceId.endsWith('-west') || face.role === 'feature-wall') continue;
    const side = Math.abs(Math.sin(face.rotationY)) > 0.5;
    const area = ninthArea(face);
    const rearOffset = 1 - face.depth + 1.05;
    const labelX = side
      ? face.x + rearOffset * Math.sin(face.rotationY)
      : face.x + (face.serviceFrontages?.[0].x ?? 0);
    const labelZ = side
      ? face.z
      : face.kitchenBounds
        ? Math.cos(face.rotationY) > 0
          ? face.kitchenBounds.minZ + 1.05
          : face.kitchenBounds.maxZ - 1.05
        : area.z + (1.05 - face.depth / 2) * Math.cos(face.rotationY);
    const labelWidth = side ? 3.2 : (face.serviceFrontages?.[0].width ?? face.width) - 0.24;
    const title =
      face.shopId === 'roujiamo'
        ? '左左香'
        : face.shopId === 'burger-king'
          ? '汉堡王'
          : face.shopId === 'seafood-hotpot'
            ? '渔船海鲜'
            : face.name;
    const tag = side
      ? flat(title, labelX, labelZ, 0.58, 3.2, '#564b3c', 4.28, '#fffaf0', true)
      : flat(title, labelX, labelZ, labelWidth, 0.58);
    if (face.stallId) tag.userData = { kind: 'stall', id: face.stallId };
    if (side) flat(face.food, labelX - 0.5, labelZ, 0.32, 3.6, '#837559', 4.28, '#fffaf0', true);
    else flat(face.food, labelX, labelZ + 0.5, labelWidth, 0.32, '#837559');
    if (face.role === 'recessed')
      flat(
        '内凹点餐 · 柜台在此',
        face.x,
        face.z - face.counterInset! + 1.4,
        w - 0.35,
        0.4,
        '#a15339',
      );
  }
  // Entrance gap remains open between Burger King and the return station.
  const entrance = new THREE.Group();
  entrance.position.set(7.8, 0, 9.5);
  spatial.add(entrance);
  for (const x of [-2.4, -1.2, 0, 1.2, 2.4])
    box(entrance, x, 1.9, 0, 0.045, 3.65, 0.1, '#618d8f', 0.5);
  const doorGlass = mesh(entrance, new THREE.PlaneGeometry(4.8, 3.55), glass, 0, 1.9, 0);
  doorGlass.castShadow = false;
  for (const x of [-0.15, 0.15]) box(entrance, x, 1.55, -0.08, 0.025, 0.65, 0.03, '#baac7e', 0.8);
  flat('出入口', 7.8, 10.6, 3.4, 0.55, '#446d66');
  flat('↑ 北 N', -21.4, -17.4, 2.5, 0.75, '#756950', 0.13, '');
  flat('中央就餐区', -0.5, 3, 4.8, 0.62, '#a69b86', 0.115, '');
  const atmosphere = new THREE.Group();
  atmosphere.name = 'ninth-dining-room';
  spatial.add(atmosphere);
  addNinthCanteenAtmosphere(atmosphere);
  const steam: THREE.Mesh[] = [];
  spatial.traverse((node) => {
    if (node instanceof THREE.Mesh && node.userData.steam) steam.push(node);
  });
  return {
    group,
    setMode(mode) {
      plan.visible = mode === 'plan';
      for (const roof of roofs) roof.visible = mode === '3d';
      for (const light of lights) light.intensity = mode === '3d' ? 22 : 14;
    },
    setInterfaceTheme(night) {
      base.material = material(night ? '#444753' : '#c7bba5');
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
