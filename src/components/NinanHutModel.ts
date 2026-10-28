import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FourthCanteenModel } from './FourthCanteenModel';
import type { NinanMealMode } from '../data/ninan-hut';
import { ninanDinnerLayout } from '../data/ninan-hut';
import { createNinanIngredientCabinet, createNinanBarbecueTop } from './ninan-hut-dinner';
import { batchModel } from '../lib/model-batches';
import { ninanBrand, ninanFacadeLetters, ninanLabel, ninanPhoto } from './ninan-hut-signage';
export { prepareNinanHutAssets } from './ninan-hut-signage';

export const NINAN_HINT_POSITION = [4, 2.4, 0.3] as const;
export type NinanHutModel = FourthCanteenModel & { setMealMode: (mode: NinanMealMode) => void };

/** 现场照片 1–9 与手绘北向：X 向北、-Z 向西，尺寸为照片比例估算。保留封闭屋顶，仅从外部观察。 */
export function createNinanHutModel(): NinanHutModel {
  const group = new THREE.Group();
  group.name = 'ninan-hut-exterior';
  const structure = new THREE.Group(),
    ground = new THREE.Group(),
    furniture = new THREE.Group();
  const breakfast = new THREE.Group(),
    lunch = new THREE.Group(),
    dinner = new THREE.Group();
  structure.name = 'ninan-structure';
  ground.name = 'ninan-ground';
  furniture.name = 'ninan-outdoor-furniture';
  breakfast.name = 'ninan-breakfast';
  lunch.name = 'ninan-lunch';
  dinner.name = 'ninan-dinner';
  group.add(ground, structure, furniture, breakfast, lunch, dinner);
  const palette = new Map<string, THREE.MeshStandardMaterial>();
  function mat(color: string, roughness = 0.75, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!palette.has(key))
      palette.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return palette.get(key)!;
  }
  const wood = mat('#9d633b'),
    woodLight = mat('#b58251'),
    white = mat('#e8e6dc'),
    canvas = mat('#ece7d9');
  const steel = mat('#9da6a4', 0.34, 0.78),
    dark = mat('#303733', 0.5, 0.4),
    trim = mat('#babfb9', 0.32, 0.65);
  const glass = new THREE.MeshStandardMaterial({
    color: '#adc5c1',
    transparent: true,
    opacity: 0.24,
    roughness: 0.23,
    metalness: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const warmWindows: THREE.MeshStandardMaterial[] = [];
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = !material.transparent;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    radius = 0,
  ) {
    return mesh(
      parent,
      radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d),
      material,
      x,
      y,
      z,
    );
  }
  function cyl(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    material: THREE.Material,
    top = r,
  ) {
    return mesh(parent, new THREE.CylinderGeometry(top, r, h, 12), material, x, y, z);
  }
  function rod(
    parent: THREE.Object3D,
    a: number[],
    b: number[],
    r: number,
    material: THREE.Material,
  ) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const object = cyl(parent, 0, 0, 0, r, start.distanceTo(end), material);
    object.position.copy(start).add(end).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return object;
  }
  function part(parent: THREE.Object3D, name: string, x = 0, y = 0, z = 0, rotation = 0) {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(x, y, z);
    node.rotation.y = rotation;
    parent.add(node);
    return node;
  }
  function label(
    parent: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    color?: string,
    bg?: string,
  ) {
    const node = ninanLabel(text, w, h, color, bg);
    node.position.set(x, y, z);
    parent.add(node);
    return node;
  }
  function corrugated(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
  ) {
    box(parent, x, y, z, w, h, 0.06, white);
    for (let dx = -w / 2 + 0.025; dx < w / 2; dx += 0.065)
      box(parent, x + dx, y, z + 0.038, 0.018, h, 0.018, mat('#d8d9d0'));
  }
  function deck(parent: THREE.Object3D, x: number, z: number, w: number, d: number, y = 0.28) {
    box(parent, x, y / 2, z, w, y, d, mat('#826044'));
    for (let dz = -d / 2 + 0.07; dz < d / 2; dz += 0.14) {
      const tone = Math.floor((dz + d) * 7) % 3;
      box(
        parent,
        x,
        y + 0.025,
        z + dz,
        w,
        0.05,
        0.132,
        mat(['#a47d50', '#b28a5c', '#ac8154'][tone]),
      );
    }
  }

  const paving = part(ground, 'ninan-stone-paving');
  box(paving, 1.9, -0.15, 1.1, 17.2, 0.22, 19, mat('#b2b3a7'));
  for (let z = -8; z < 10; z += 0.85)
    for (let x = -6; x < 10; x += 1.1) {
      box(
        paving,
        x + (Math.round(z * 10) % 2 ? 0.4 : 0),
        -0.025,
        z,
        1.06,
        0.025,
        0.81,
        mat(Math.round((z + x) * 10) % 3 ? '#c0beb0' : '#b6b8ac'),
      );
    }
  const terrace = part(structure, 'ninan-raised-wood-terrace');
  deck(terrace, 0.55, 0, 5.2, 10.8);
  // 照片 6：吧椅和打卡墙之间有通道，打卡座椅完整落在宽露台上。
  deck(terrace, 4.95, -0.5, 3.6, 10);
  deck(terrace, 0.55, -5.7, 5.2, 0.6, 0.14);
  deck(terrace, 6.925, -0.5, 0.35, 10, 0.14);
  deck(terrace, -2.22, 0, 0.4, 10.8, 0.14);
  // 东北早餐棚在石阶上，与木露台保持独立，不误并为小屋室内。
  const tentPlatform = part(structure, 'ninan-breakfast-stone-platform', 4.4, 0, 6.4);
  box(tentPlatform, 0, 0.15, 0, 4, 0.3, 3.2, mat('#96988c'));
  for (let i = 0; i < 3; i++)
    box(
      tentPlatform,
      0,
      0.04 + i * 0.045,
      2.03 - i * 0.25,
      4.2,
      0.08 + i * 0.09,
      0.3,
      mat('#9e9f91'),
    );

  const shell = part(structure, 'ninan-timber-corrugated-house');
  box(shell, 0.5, 0.34, 0, 3, 0.12, 9.6, mat('#806645'));
  const inside = mat('#a4aa9a');
  box(shell, 0.5, 1.4, 4.71, 2.9, 2.1, 0.08, inside);
  const south = part(shell, 'south-closed-wall', 0.5, 0, 4.8);
  corrugated(south, 0, 1.95, 0, 3, 3.2);
  for (const x of [-1.5, 0, 1.5]) box(south, x, 1.98, 0.06, 0.14, 3.35, 0.15, wood);
  box(south, 0, 2.8, 0.08, 3.1, 0.14, 0.15, wood);

  function window(parent: THREE.Object3D, x: number, width: number, open = false, full = false) {
    const bottom = full ? 0.4 : 1.25,
      top = 2.65;
    box(parent, x, (top + bottom) / 2, -0.006, width - 0.06, top - bottom, 0.025, glass);
    for (const sx of [-1, 1])
      box(parent, x + (sx * width) / 2, (top + bottom) / 2, 0.04, 0.055, top - bottom, 0.075, trim);
    for (const yy of [bottom, full ? 1.34 : 2.08, top])
      box(parent, x, yy, 0.04, width, 0.055, 0.075, trim);
    if (!full) box(parent, x, 1.25, 0.15, width + 0.12, 0.075, 0.43, white);
    if (open) {
      // 上悬窗朝外打开；可透过开口看到少量当餐设备，但不开放室内导航。
      const sash = part(parent, 'outward-open-serving-window', x, 2.65, 0.1);
      sash.rotation.x = -0.92;
      box(sash, 0, -0.38, 0, width - 0.04, 0.74, 0.028, glass);
      for (const yy of [0, -0.76]) box(sash, 0, yy, 0, width, 0.045, 0.06, trim);
      for (const sx of [-1, 1]) box(sash, (sx * width) / 2, -0.38, 0, 0.045, 0.76, 0.06, trim);
      rod(parent, [x - width / 2, 2.17, 0.1], [x - width / 2, 2.19, 0.69], 0.014, steel);
      rod(parent, [x + width / 2, 2.17, 0.1], [x + width / 2, 2.19, 0.69], 0.014, steel);
    }
  }
  function awning(parent: THREE.Object3D, x: number, width: number, y = 3.23, reach = 1.05) {
    box(parent, x, y + 0.12, 0.04, width, 0.12, 0.13, trim);
    const cloth = box(parent, x, y - 0.08, reach / 2, width, 0.034, reach, canvas);
    cloth.rotation.x = 0.23;
    box(parent, x, y - 0.3, reach, width, 0.22, 0.025, canvas);
    for (const sx of [-1, 1])
      rod(
        parent,
        [x + sx * width * 0.46, y - 0.3, 0],
        [x + sx * width * 0.46, y - 0.19, reach],
        0.018,
        trim,
      );
  }
  function facade(parent: THREE.Object3D, width: number, bays: number, isEast = false) {
    const bay = width / bays;
    for (let i = 0; i < bays; i++) {
      const x = -width / 2 + bay * (i + 0.5);
      corrugated(parent, x, 3.14, 0, bay, 0.91);
      if (isEast && i === 2) {
        // 照片 5/6 的中部双开玻璃门，只做外观，无进入交互。
        for (const side of [-1, 1]) {
          const door = part(parent, 'central-glass-door', x + side * 0.84, 0.38, 0.04, side * 0.45);
          box(door, -side * 0.42, 1.08, 0, 0.84, 2.16, 0.028, glass);
          for (const yy of [0.02, 2.15]) box(door, -side * 0.42, yy, 0, 0.85, 0.045, 0.06, trim);
          box(door, -side * 0.84, 1.08, 0, 0.045, 2.15, 0.06, trim);
          rod(door, [-side * 0.72, 0.75, 0.08], [-side * 0.72, 1.3, 0.08], 0.018, steel);
        }
      } else {
        if (!(isEast && i < 2)) corrugated(parent, x, 0.8, 0, bay, 0.89);
        window(parent, x, bay - 0.12, isEast && i > 2, isEast && i < 2);
      }
    }
    for (let i = 0; i <= bays; i++)
      box(parent, -width / 2 + bay * i, 1.99, 0.08, 0.14, 3.34, 0.17, wood);
    for (const y of [2.72, 3.59]) box(parent, 0, y, 0.08, width + 0.16, 0.14, 0.16, wood);
  }
  const east = part(shell, 'east-customer-facade', 2, 0, 0, Math.PI / 2);
  facade(east, 9.6, 5, true);
  for (const x of [-3.84, -1.92, 0]) {
    awning(east, x, 1.85, 3.27, 0.55);
    awning(east, x, 1.85, 2.92, 0.58);
  }
  awning(east, 2.88, 3.7, 3.48, 1.05);
  label(east, '油炸烧烤', -2.88, 2.49, 0.07, 1.18, 0.25, '#45d8ef');
  label(east, '西式快餐', 1.92, 2.91, 0.08, 1.15, 0.25, '#ed4bd3');
  label(east, '咖啡饮品', 3.84, 2.91, 0.08, 1.1, 0.25, '#f6de36');
  for (const x of [-3.84, -1.92, 0]) {
    box(east, x, 1.42, 0.086, 1.75, 0.09, 0.008, white);
    const brand = ninanBrand('logistics', 0.32);
    brand.position.set(x + 0.08, 1.42, 0.093);
    east.add(brand);
    const crest = ninanBrand('crest', 0.055);
    crest.position.set(x - 0.16, 1.42, 0.094);
    east.add(crest);
  }
  const north = part(shell, 'north-tea-facade', 0.5, 0, -4.8, Math.PI);
  facade(north, 3, 2);
  awning(north, 0, 3.05, 3.45, 0.95);
  label(north, '泰州早茶', 0, 2.96, 0.09, 1.32, 0.28, '#4ddd87');
  const west = part(shell, 'west-service-facade', -1, 0, 0, -Math.PI / 2);
  facade(west, 9.6, 5);
  // 南侧金属储物柜及双排烟管对应照片 1/7，东墙两台空调对应照片 2。
  for (const x of [2.2, 3, 3.8]) {
    box(west, x, 1.15, 0.35, 0.72, 1.62, 0.58, mat('#858d7e', 0.45, 0.45));
    for (const y of [0.76, 1.57]) {
      box(west, x, y, 0.65, 0.66, 0.75, 0.025, mat('#969d8b', 0.4, 0.5));
      box(west, x + 0.22, y, 0.68, 0.035, 0.14, 0.04, steel);
    }
  }
  for (const x of [-3.1, -0.9]) {
    rod(west, [x, 2.91, 0.07], [x, 2.91, 0.78], 0.16, steel);
    cyl(west, x, 3.39, 0.78, 0.16, 0.95, steel);
    cyl(west, x, 3.94, 0.78, 0.22, 0.04, steel);
    for (const s of [-1, 1])
      rod(west, [x + s * 0.12, 3.85, 0.78], [x + s * 0.12, 3.96, 0.78], 0.012, steel);
  }
  for (const x of [-0.25, 1]) {
    const ac = part(south, 'south-air-conditioner', x, 0.75, 0.45);
    box(ac, 0, 0, 0, 1.02, 0.67, 0.42, mat('#cecfc2'));
    const fan = cyl(ac, -0.2, 0, 0.23, 0.24, 0.018, mat('#636e65'));
    fan.rotation.x = Math.PI / 2;
    for (let i = -5; i <= 5; i++) box(ac, -0.2 + i * 0.04, 0, 0.245, 0.012, 0.44, 0.012, trim);
  }
  const roof = part(shell, 'closed-single-pitch-roof', 0.5, 3.68, 0);
  roof.rotation.z = 0.045;
  box(roof, 0, 0, 0, 3.7, 0.13, 10.2, white);
  for (let z = -5.05; z < 5.1; z += 0.19) box(roof, 0, 0.076, z, 3.7, 0.025, 0.026, mat('#d3d6ce'));

  // 两块旅游海报、上方「呢喃小屋」灯字及彩色 I ♥ NJU 座椅构成北侧显著地标。
  // 新版示意图上西右北：展示架横跨露台，正面 +Z（东），背面 -Z（西）。
  // 整组外移；最近的立柱离遮阳棚前缘约 0.6m，不缩小招牌来回避穿模。
  // 用户补充：牌架还应位于咖啡窗口以西，接近露台西端（局部 -Z）。
  const photoWall = part(furniture, 'ninan-photo-wall', 5.05, 0.32, -5.05, 0);
  for (const x of [-1.32, 0, 1.32]) box(photoWall, x, 1.45, 0, 0.15, 2.9, 0.16, woodLight);
  box(photoWall, 0, 2.48, 0, 2.8, 0.12, 0.14, wood);
  for (const x of [-0.66, 0.66]) box(photoWall, x, 1.35, 0, 1.2, 2.08, 0.07, white);
  const art1 = ninanPhoto('east', 1.18, 2.04, [
    [0.748, 0.444],
    [0.816, 0.425],
    [0.817, 0.635],
    [0.75, 0.645],
  ]);
  const art2 = ninanPhoto('east', 1.18, 2.04, [
    [0.846, 0.423],
    [0.936, 0.401],
    [0.94, 0.659],
    [0.847, 0.628],
  ]);
  art1.position.set(-0.66, 1.35, 0.042);
  art2.position.set(0.66, 1.35, 0.042);
  art1.name = 'ninan-photo-wall-poster-front-1';
  art2.name = 'ninan-photo-wall-poster-front-2';
  art1.material.side = THREE.FrontSide;
  art2.material.side = THREE.FrontSide;
  photoWall.add(art1, art2);
  const letters = ninanFacadeLetters('呢 喃 小 屋', 2.65, 0.46);
  letters.position.set(0, 2.82, 0);
  photoWall.add(letters);
  const seat = part(photoWall, 'colorful-nju-seats', 0, 0, 0.38);
  for (const [x, color] of [
    [-1.12, '#e5e5df'],
    [-0.58, '#d8444f'],
    [0.02, '#8150a6'],
    [0.64, '#8150a6'],
    [1.16, '#8150a6'],
  ] as const) {
    box(seat, x, 0.24, 0, 0.48, 0.46, 0.52, mat(color), 0.08);
    box(seat, x, 0.55, -0.18, 0.46, 0.5, 0.17, mat(color), 0.08);
  }
  label(seat, 'I  ♥  N J U', 0, 0.33, 0.268, 2.6, 0.34, '#fff9ef');

  function stool(parent: THREE.Object3D, x: number, z: number, yaw: number) {
    const node = part(parent, 'yellow-counter-stool', x, 0.33, z, yaw),
      gold = mat('#c4a03f');
    box(node, 0, 0.75, 0, 0.4, 0.07, 0.37, gold, 0.035);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        rod(node, [sx * 0.22, 0, sz * 0.23], [sx * 0.13, 0.75, sz * 0.12], 0.025, gold);
    for (const sx of [-1, 1])
      rod(node, [sx * 0.13, 0.72, -0.12], [sx * 0.18, 1.2, -0.19], 0.027, gold);
    box(node, 0, 1.2, -0.19, 0.43, 0.08, 0.08, gold, 0.03);
    rod(node, [-0.18, 0.32, 0.19], [0.18, 0.32, 0.19], 0.018, gold);
  }
  stool(furniture, 2.95, -1.92, Math.PI / 2);
  // 面向咖啡窗口时向左错开，让下方饮品价目牌完整露出。
  stool(furniture, 2.95, -3.0, Math.PI / 2);
  stool(furniture, -0.25, -5.45, Math.PI);
  stool(furniture, 1.2, -5.45, Math.PI);
  function cafeSet(x: number, z: number) {
    const node = part(furniture, 'outdoor-cafe-table', x, 0, z);
    for (let n = 0; n < 9; n++) box(node, (n - 4) * 0.11, 0.78, 0, 0.1, 0.055, 1.15, dark);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) box(node, sx * 0.38, 0.38, sz * 0.43, 0.045, 0.76, 0.045, dark);
    for (const side of [-1, 1]) {
      const chair = part(node, 'slatted-cafe-chair', side * 0.95, 0, 0, (side * Math.PI) / 2);
      for (let i = 0; i < 5; i++) {
        box(chair, 0, 0.44, (i - 2) * 0.085, 0.42, 0.032, 0.07, dark);
        box(chair, 0, 0.63 + i * 0.07, -0.23, 0.43, 0.045, 0.025, dark);
      }
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          rod(chair, [a * 0.19, 0, b * 0.19], [a * 0.19, 0.45, b * 0.19], 0.016, dark);
      for (const a of [-1, 1])
        rod(chair, [a * 0.2, 0.42, -0.22], [a * 0.2, 0.98, -0.22], 0.016, dark);
    }
  }
  // 黑色桌椅在木平台外的石铺地上，避开扩展后的台阶。
  cafeSet(8.5, -0.5);
  cafeSet(8.5, 3.25);
  function umbrella(x: number, z: number, open: boolean) {
    const node = part(furniture, 'outdoor-parasol', x, 0.32, z);
    cyl(node, 0, 0.04, 0, 0.35, 0.08, dark);
    cyl(node, 0, 1.32, 0, 0.027, 2.6, steel);
    if (open) {
      const geo = new THREE.ConeGeometry(1.25, 0.39, 8);
      mesh(node, geo, mat('#79514a'), 0, 2.38, 0);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        rod(node, [0, 2.57, 0], [Math.cos(a) * 1.25, 2.2, Math.sin(a) * 1.25], 0.012, wood);
      }
    } else {
      mesh(node, new THREE.ConeGeometry(0.24, 1.65, 8), mat('#afa18b'), 0, 1.68, 0);
    }
  }
  umbrella(0.5, -5.65, true);
  umbrella(3.6, 4.1, false);
  function planter(x: number, z: number, w: number) {
    const node = part(furniture, 'slatted-planter', x, 0, z);
    box(node, 0, 0.32, 0, w, 0.6, 0.55, wood);
    for (let i = 0; i < 5; i++) box(node, 0, 0.1 + i * 0.12, 0.29, w, 0.085, 0.045, mat('#80553f'));
    for (let i = 0; i < Math.round(w / 0.33); i++) {
      const xx = -w / 2 + 0.2 + i * 0.33;
      cyl(node, xx, 0.66, 0, 0.14, 0.19, mat('#aa6851'), 0.18);
      rod(node, [xx, 0.7, 0], [xx, 0.99, 0.02], 0.018, mat('#54623c'));
      for (let j = 0; j < 4; j++) {
        const leaf = mesh(
          node,
          new THREE.IcosahedronGeometry(0.18, 0),
          mat(['#718348', '#4f7042', '#819756'][j % 3]),
          xx + Math.cos(j * 1.8) * 0.12,
          0.92 + j * 0.055,
          Math.sin(j * 1.8) * 0.11,
        );
        leaf.scale.set(1, 0.65, 1);
      }
    }
  }
  planter(5.1, -5.9, 2.4);
  planter(-2.7, 4.9, 2.7);

  const tent = part(structure, 'ninan-breakfast-tent', 4.4, 0.3, 6.4);
  for (const x of [-1.75, 1.75])
    for (const z of [-1.3, 1.3]) {
      cyl(tent, x, 1.23, z, 0.028, 2.46, white);
      cyl(tent, x, 0.025, z, 0.1, 0.05, white);
      rod(tent, [x, 2.42, z], [x * 0.4, 3.12, 0], 0.023, trim);
    }
  const roofGeometry = new THREE.BufferGeometry();
  const verts = [
    -1.85, 2.5, -1.4, 1.85, 2.5, -1.4, 1.85, 2.5, 1.4, -1.85, 2.5, 1.4, -0.6, 3.16, 0, 0.6, 3.16, 0,
  ];
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  roofGeometry.setIndex([0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0]);
  roofGeometry.computeVertexNormals();
  const tentCloth = mat('#f3eee3');
  tentCloth.side = THREE.DoubleSide;
  mesh(tent, roofGeometry, tentCloth);
  for (const z of [-1.4, 1.4]) box(tent, 0, 2.38, z, 3.7, 0.25, 0.025, tentCloth);
  for (const x of [-1.85, 1.85]) box(tent, x, 2.38, 0, 0.025, 0.25, 2.8, tentCloth);
  const tentCrest = ninanBrand('crest', 0.65);
  tentCrest.position.set(0, 2.94, 0.64);
  tentCrest.rotation.x = -1.1;
  tent.add(tentCrest);
  label(tent, '南 大 记 忆', 0.95, 2.39, 1.417, 1.25, 0.19, '#443a38');
  // 固定不锈钢柜与保温展示柜来自照片 3/9；当餐食物分组独立切换。
  const tentCounter = part(tent, 'breakfast-stainless-counter');
  box(tentCounter, -0.42, 0.65, 0.35, 2.35, 1.05, 0.75, steel);
  box(tentCounter, -0.42, 1.2, 0.35, 2.43, 0.06, 0.83, steel);
  for (const x of [-1.4, 0.56])
    for (const z of [0.04, 0.64]) {
      const wheel = cyl(tentCounter, x, 0.09, z, 0.07, 0.055, dark);
      wheel.rotation.z = Math.PI / 2;
    }
  box(tentCounter, 1.2, 0.93, 0.4, 1, 0.06, 0.84, steel);
  box(tentCounter, 1.2, 0.22, 0.4, 1, 0.04, 0.84, steel);
  for (const x of [0.75, 1.65])
    for (const z of [0.03, 0.77]) cyl(tentCounter, x, 0.45, z, 0.025, 0.9, steel);
  box(tentCounter, 1.2, 0.39, 0.4, 0.65, 0.29, 0.55, mat('#326b86'));
  const display = part(tentCounter, 'breakfast-glass-warmer', 1.2, 0.96, 0.4);
  box(display, 0, 0.08, 0, 0.9, 0.16, 0.67, steel);
  box(display, 0, 0.39, 0, 0.87, 0.5, 0.62, glass);
  for (const x of [-0.45, 0.45])
    for (const z of [-0.33, 0.33]) box(display, x, 0.4, z, 0.032, 0.65, 0.032, trim);
  for (const yy of [0.16, 0.37, 0.68]) box(display, 0, yy, 0, 0.9, 0.025, 0.67, steel);
  box(display, 0, 0.72, 0, 0.96, 0.08, 0.72, steel);

  const breakfastBoard = part(structure, 'breakfast-board-southwest-of-tent', 2.05, 0, 8.05, -0.12);
  box(breakfastBoard, 0, 1.1, 0, 0.92, 2.1, 0.065, trim);
  box(breakfastBoard, 0, 0.06, -0.06, 1.02, 0.08, 0.54, dark);
  const breakfastFace = ninanPhoto('breakfast', 0.9, 2.07, [
    [0.399, 0.142],
    [0.847, 0.129],
    [0.794, 0.88],
    [0.426, 0.858],
  ]);
  breakfastFace.position.set(0, 1.1, 0.036);
  breakfastBoard.add(breakfastFace);
  const barbecueBoard = part(structure, 'existing-barbecue-sign', 0.95, 0, 7.95, -0.12);
  box(barbecueBoard, 0, 0.99, 0, 0.91, 1.9, 0.06, dark);
  const bbqFace = ninanPhoto('breakfast', 0.88, 1.66, [
    [0.092, 0.24],
    [0.401, 0.255],
    [0.419, 0.724],
    [0.108, 0.722],
  ]);
  bbqFace.position.set(0, 1.1, 0.034);
  barbecueBoard.add(bbqFace);
  // 饮品牌按用户明确说明置于北立面的咖啡饮品窗口下方。
  const drinksBoard = part(east, 'drinks-board-below-coffee-window', 3.84, 0.79, 0.22);
  box(drinksBoard, 0, 0, 0, 0.61, 0.84, 0.038, wood);
  const drinksFace = ninanPhoto('drinks', 0.58, 0.81, [
    [0.131, 0.035],
    [0.899, 0.025],
    [0.872, 0.817],
    [0.144, 0.808],
  ]);
  drinksFace.position.z = 0.022;
  drinksBoard.add(drinksFace);

  const breakfastFood = part(breakfast, 'breakfast-food-under-tent', 4.4, 0.3, 6.4);
  for (let i = 0; i < 4; i++) {
    cyl(breakfastFood, -1.2 + i * 0.43, 1.25, 0.32, 0.17, 0.045, white);
    const bun = mesh(
      breakfastFood,
      new THREE.SphereGeometry(0.14, 12, 8),
      mat('#dca057'),
      -1.2 + i * 0.43,
      1.34,
      0.32,
    );
    bun.scale.y = 0.55;
    cyl(breakfastFood, -1.2 + i * 0.43, 1.3, 0.32, 0.14, 0.04, mat('#8d5135'));
  }
  for (let i = 0; i < 3; i++) {
    cyl(breakfastFood, -0.5 + i * 0.31, 1.36, -0.1, 0.09, 0.28, white, 0.075);
    cyl(breakfastFood, -0.5 + i * 0.31, 1.51, -0.1, 0.095, 0.02, mat('#e1d7bf'));
  }
  for (let i = 0; i < 3; i++) {
    const tray = part(breakfastFood, 'breakfast-warmer-tray', 1.2, 0.97 + i * 0.22, 0.4);
    for (let j = 0; j < 4; j++) {
      const bun = mesh(
        tray,
        new THREE.SphereGeometry(0.07, 10, 7),
        mat('#e8cb83'),
        -0.28 + j * 0.18,
        0.2,
        0,
      );
      bun.scale.y = 0.62;
    }
  }
  const tea = part(breakfast, 'breakfast-tea-urn', 4.4, 0.3, 6.4);
  cyl(tea, -0.7, 1.53, -0.42, 0.19, 0.59, steel);
  cyl(tea, -0.7, 1.85, -0.42, 0.2, 0.045, dark);
  box(tea, -0.7, 1.45, -0.19, 0.035, 0.09, 0.06, dark);
  // 饮料机、咖啡机与原料罐在午餐和晚餐均保留于屋内原位。
  const drinksEquipment = part(
    lunch,
    'lunch-drinks-machines-inside-east-window',
    1.53,
    0.38,
    -3.5,
    Math.PI / 2,
  );
  box(drinksEquipment, 0, 0.69, -0.35, 2.85, 0.1, 0.64, steel);
  const machine = part(drinksEquipment, 'coffee-machine', 0.65, 0.77, -0.33);
  box(machine, 0, 0.27, 0, 0.65, 0.54, 0.42, dark, 0.035);
  box(machine, 0, 0.11, 0.24, 0.65, 0.05, 0.12, steel);
  box(machine, 0, 0.38, 0.22, 0.43, 0.16, 0.025, mat('#b6c7b8'));
  for (const x of [-0.13, 0.13]) {
    cyl(machine, x, 0.2, 0.25, 0.035, 0.17, steel);
    cyl(machine, x, 0.12, 0.25, 0.06, 0.1, white);
  }
  cyl(machine, 0.23, 0.66, 0, 0.12, 0.25, glass, 0.14);
  cyl(machine, 0.23, 0.57, 0, 0.115, 0.1, mat('#624632'));
  const dispenser = part(drinksEquipment, 'cold-drink-dispenser', -0.75, 0.78, -0.32);
  box(dispenser, 0, 0.08, 0, 0.72, 0.16, 0.4, dark);
  for (const x of [-0.2, 0.2]) {
    box(dispenser, x, 0.34, 0, 0.32, 0.39, 0.32, glass, 0.035);
    box(dispenser, x, 0.28, 0, 0.27, 0.25, 0.27, mat(x < 0 ? '#e1ae55' : '#b89966'), 0.025);
    box(dispenser, x, 0.55, 0, 0.35, 0.04, 0.35, dark);
    box(dispenser, x, 0.15, 0.2, 0.04, 0.08, 0.07, dark);
  }
  for (let i = 0; i < 7; i++) {
    cyl(
      drinksEquipment,
      -1.2 + i * 0.21,
      0.94,
      -0.67,
      0.065,
      0.34,
      mat(['#e5dbad', '#c3a25a', '#ad7153'][i % 3]),
    );
    cyl(drinksEquipment, -1.2 + i * 0.21, 1.13, -0.67, 0.068, 0.035, dark);
  }
  for (let i = 0; i < 4; i++)
    cyl(drinksEquipment, 0.15 + i * 0.16, 0.86, 0.09, 0.055, 0.2, white, 0.06);

  const cabinet = createNinanIngredientCabinet();
  const cabinetPose = ninanDinnerLayout.cabinet;
  cabinet.group.position.set(cabinetPose.x, cabinetPose.y, cabinetPose.z);
  cabinet.group.rotation.y = cabinetPose.rotationY;
  const grill = createNinanBarbecueTop();
  const grillPose = ninanDinnerLayout.grill;
  grill.position.set(grillPose.x, grillPose.y, grillPose.z);
  dinner.add(cabinet.group, grill);

  // 夜拍12/13中可见的檐下与平台灯带，以及白棚内两盏工作灯。
  const nightAccents = part(group, 'ninan-night-accent-lights');
  nightAccents.visible = false;
  const led = new THREE.MeshBasicMaterial({ color: '#ffdc8a', toneMapped: false });
  const workLight = new THREE.MeshBasicMaterial({ color: '#e6f6ff', toneMapped: false });
  box(nightAccents, 2.59, 2.62, 1.92, 0.025, 0.035, 5.6, led);
  box(nightAccents, 2.18, 2.78, -2.88, 0.025, 0.035, 3.7, led);
  box(nightAccents, 6.76, 0.24, -0.5, 0.035, 0.035, 10, led);
  box(nightAccents, 4.95, 0.24, 4.51, 3.6, 0.035, 0.035, led);
  box(nightAccents, 4.95, 0.24, -5.51, 3.6, 0.035, 0.035, led);
  for (const x of [3.25, 5.55]) {
    mesh(nightAccents, new THREE.SphereGeometry(0.08, 12, 8), workLight, x, 2.72, 6.15);
    const light = new THREE.PointLight('#e7f4ff', 9, 4, 2);
    light.position.set(x, 2.6, 6.15);
    nightAccents.add(light);
  }

  const fixtures = part(structure, 'ninan-exterior-light-fixtures');
  for (const z of [-3.7, 0, 3.6]) {
    box(fixtures, 2.18, 3.62, z, 0.2, 0.22, 0.28, dark);
    const lamp = mat('#fff2d5');
    lamp.emissive.set('#ffdf9b');
    lamp.emissiveIntensity = 0.15;
    warmWindows.push(lamp);
    box(fixtures, 2.29, 3.59, z, 0.015, 0.15, 0.2, lamp);
  }
  const hemi = new THREE.HemisphereLight('#fff7df', '#b7b8a2', 2.3);
  const key = new THREE.DirectionalLight('#fff1d0', 3.0);
  key.position.set(5, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -13,
    right: 13,
    top: 13,
    bottom: -13,
    near: 1,
    far: 40,
  });
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight('#d8e5ef', 1.2);
  fill.position.set(-6, 5, -8);
  const glow = new THREE.PointLight('#ffddad', 0, 13, 2);
  glow.position.set(2.6, 2.8, -1.6);
  group.add(hemi, key, fill, glow);
  // 保留建筑、露台和每组家具的几何归属，合批后仍可核验它们之间的真实间距。
  // 餐段分别合批，避免切午餐时早餐设备仍留在公共批次里。
  photoWall.remove(seat);
  batchModel(seat);
  // 固定钢柜和右侧保温柜也保留独立边界，用于检查晚餐烤槽是否占用了它们的空间。
  tentCounter.remove(display);
  tent.remove(tentCounter);
  batchModel(display);
  batchModel(tentCounter);
  for (const owner of [ground, ...structure.children, ...furniture.children, breakfast, lunch])
    batchModel(owner as THREE.Group);
  photoWall.add(seat);
  tentCounter.add(display);
  tent.add(tentCounter);
  let meal: NinanMealMode = 'breakfast';
  function setMealMode(mode: NinanMealMode) {
    meal = mode;
    breakfast.visible = mode === 'breakfast';
    lunch.visible = mode === 'lunch' || mode === 'dinner';
    dinner.visible = mode === 'dinner';
    group.userData.mealMode = mode;
  }
  setMealMode(meal);
  return {
    group,
    // 此处只有外部视图，俯视/三维都保留真实屋顶和棚顶。
    setMode() {},
    setMealMode,
    setInterfaceTheme(night) {
      cabinet.setNight(night);
      nightAccents.visible = night;
      hemi.color.set(night ? '#aab8dd' : '#fff7df');
      hemi.groundColor.set(night ? '#414854' : '#b7b8a2');
      hemi.intensity = night ? 1.1 : 2.3;
      key.color.set(night ? '#b8c8e9' : '#fff1d0');
      key.intensity = night ? 1.05 : 3;
      fill.intensity = night ? 0.55 : 1.2;
      glow.intensity = night ? 24 : 0;
      for (const lamp of warmWindows) lamp.emissiveIntensity = night ? 2.5 : 0.15;
      group.userData.night = night;
    },
    tick() {},
  };
}
