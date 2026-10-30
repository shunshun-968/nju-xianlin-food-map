import * as THREE from 'three';
import { attachModelAssets } from '../lib/progressive-model-assets';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FourthCanteenModel } from './FourthCanteenModel';
import {
  createYifuSignage,
  createYifuWallArt,
  yifuLabel,
  yifuMenuTexture,
} from './yifu-kiosk-signage';
import { createYifuAtmosphere } from './yifu-kiosk-atmosphere';
import { batchModel } from '../lib/model-batches';
import {
  YIFU_FIXTURE_LIGHTS,
  YIFU_FIXTURE_COLORS,
  YIFU_INTERIOR_LIGHT,
  YIFU_BROAD_LIGHTS,
} from '../data/yifu-lighting';
export { prepareYifuKioskAssets } from './yifu-kiosk-signage';

/** 由六张现场照片复原 B102：北为 -Z。三维敞开南面，俯视补回墙门；尺寸为照片比例估算。 */
export function createYifuKioskModel(): FourthCanteenModel {
  const group = new THREE.Group();
  const assets = attachModelAssets(group);
  group.name = 'yifu-b102-open-south';
  const room = new THREE.Group(),
    furniture = new THREE.Group(),
    overhead = new THREE.Group();
  room.name = 'room-three-walls-no-south-wall';
  furniture.name = 'b102-single-service-point';
  overhead.name = 'suspended-fixtures';
  overhead.userData.planHide = true;
  group.add(room, furniture, overhead);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function mat(color: string, roughness = 0.7, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!materials.has(key))
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return materials.get(key)!;
  }
  const steel = mat('#a5aaa9', 0.31, 0.8),
    darkSteel = mat('#50575a', 0.38, 0.76);
  const black = mat('#252a28', 0.7),
    ivory = mat('#e8e5d9', 0.76);
  const red = mat('#ae2631', 0.34, 0.12),
    cream = mat('#e1dfb7', 0.45);
  const paleWood = mat('#b98f5d', 0.55),
    rubber = mat('#1c2120', 0.95);
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
    object.castShadow = true;
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
  function cylinder(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    material: THREE.Material,
    top = radius,
  ) {
    return mesh(parent, new THREE.CylinderGeometry(top, radius, height, 12), material, x, y, z);
  }
  function rod(
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    material: THREE.Material,
  ) {
    const object = cylinder(parent, 0, 0, 0, radius, a.distanceTo(b), material);
    object.position.copy(a).add(b).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return object;
  }
  function plane(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    material: THREE.Material,
    ry = 0,
  ) {
    const object = mesh(parent, new THREE.PlaneGeometry(w, h), material, x, y, z);
    object.rotation.y = ry;
    return object;
  }
  function label(
    parent: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    bg = '#f1e0d0',
    color = '#583b32',
    ry = 0,
  ) {
    const object = yifuLabel(text, w, h, bg, color);
    object.position.set(x, y, z);
    object.rotation.y = ry;
    parent.add(object);
    return object;
  }
  function canvasTexture(
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d')!);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }
  const brushedBump = canvasTexture(128, 512, (ctx) => {
    ctx.fillStyle = '#898989';
    ctx.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 550; i++) {
      ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
      const x = (i * 29.1) % 128,
        y = (i * 47.3) % 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 20 + (i % 91));
      ctx.lineWidth = 0.45;
      ctx.stroke();
    }
  });
  brushedBump.colorSpace = THREE.NoColorSpace;
  steel.bumpMap = brushedBump;
  steel.bumpScale = 0.0025;
  // 现场浅色木纹地砖，错缝与木纹直接进入材质，避免数百块板材增加绘制开销。
  const floorMap = canvasTexture(1024, 1024, (ctx) => {
    ctx.fillStyle = '#b4a78e';
    ctx.fillRect(0, 0, 1024, 1024);
    for (let row = 0; row < 23; row++) {
      const x = row * 45;
      for (let j = -1; j < 7; j++) {
        const y = j * 177 + (row % 3) * 59;
        const tone = (Math.sin(row * 12.7 + j * 4.3) + 1) * 5;
        ctx.fillStyle = `rgb(${211 + tone},${199 + tone},${177 + tone})`;
        ctx.fillRect(x + 0.7, y + 0.8, 44, 175.7);
        for (let line = 0; line < 15; line++) {
          ctx.beginPath();
          for (let q = 0; q <= 24; q++) {
            const yy = y + q * 7.3;
            const xx =
              x +
              2 +
              line * 2.8 +
              Math.sin(q * 0.26 + line * 0.8 + row) * 0.8 +
              Math.sin(q * 0.6 + row) * 0.35;
            if (q === 0) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
          }
          ctx.strokeStyle = line % 3 ? 'rgba(112,89,63,0.13)' : 'rgba(255,247,221,0.34)';
          ctx.lineWidth = 0.55;
          ctx.stroke();
        }
        if ((row + j) % 4 === 0) {
          ctx.strokeStyle = 'rgba(116,86,52,0.12)';
          for (let r = 1; r <= 4; r++) {
            ctx.beginPath();
            ctx.ellipse(x + 20, y + 80, r * 2, r * 9, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
  });
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorMap,
    roughness: 0.48,
    bumpMap: floorMap,
    bumpScale: 0.006,
    metalness: 0.01,
  });
  box(room, 0, -0.11, 0, 6.03, 0.22, 7.03, mat('#bcb7aa', 0.87), 0.025);
  const floor = plane(room, 0, 0.007, 0, 5.8, 6.8, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'pale-staggered-wood-grain-floor';
  // 图6及补充近照：冰柜背墙向室内凸出，红冰柜北侧折回售餐区西墙。
  // 转角深度按照片估算；三维和俯视共用同一轮廓。
  // 墙段沿冰柜排列方向略收窄；凸出墙面与柜台台面前沿共面。
  const counterX = -1.72;
  const counterFrontX = counterX + 0.96 / 2;
  const westStep = { depth: counterFrontX + 2.9, z: 1.12, x: counterFrontX };
  const fridgeX = westStep.x + 0.48;
  const southWallLength = 3.4 - westStep.z;
  const northWallLength = westStep.z + 3.4;
  // 单面内墙让外围机位自然剖开近侧墙，南侧仍敞开。
  const wallMaterial = mat('#ebeae2', 0.96);
  const walls = new THREE.Group();
  walls.name = 'yifu-three-dimensional-cutaway-walls';
  walls.userData.planHide = true;
  room.add(walls);
  plane(
    walls,
    -2.9,
    1.68,
    (-3.4 + westStep.z) / 2,
    northWallLength,
    3.36,
    wallMaterial,
    Math.PI / 2,
  ).name = 'west-interior-wall';
  plane(
    walls,
    westStep.x,
    1.68,
    (3.4 + westStep.z) / 2,
    southWallLength,
    3.36,
    wallMaterial,
    Math.PI / 2,
  ).name = 'west-fridge-backing-wall';
  plane(
    walls,
    -2.9 + westStep.depth / 2,
    1.68,
    westStep.z,
    westStep.depth,
    3.36,
    wallMaterial,
    Math.PI,
  ).name = 'west-right-angle-return';
  plane(walls, 2.9, 1.68, 0, 6.8, 3.36, wallMaterial, -Math.PI / 2).name = 'east-interior-wall';
  plane(walls, 0, 1.68, -3.4, 5.8, 3.36, wallMaterial).name = 'north-interior-wall';
  for (const [x, z, length] of [
    [-2.91, (-3.4 + westStep.z) / 2, northWallLength],
    [westStep.x - 0.01, (3.4 + westStep.z) / 2, southWallLength],
    [2.91, 0, 6.8],
  ]) {
    box(room, x, 0.06, z, 0.08, 0.12, length, mat('#8a8980', 0.68));
    box(overhead, x, 3.35, z, 0.15, 0.07, length, ivory);
  }
  box(
    room,
    -2.9 + westStep.depth / 2,
    0.06,
    westStep.z,
    westStep.depth,
    0.12,
    0.08,
    mat('#8a8980', 0.68),
  );
  box(overhead, -2.9 + westStep.depth / 2, 3.35, westStep.z, westStep.depth, 0.07, 0.15, ivory);
  box(room, 0, 0.06, -3.38, 5.8, 0.12, 0.08, mat('#8a8980', 0.68));
  box(overhead, 0, 3.35, -3.4, 5.95, 0.07, 0.15, ivory);
  // 北窗的深色横档透过浅灰白织物可见。
  const windowGlow = new THREE.MeshStandardMaterial({
    color: '#d8e1df',
    roughness: 0.32,
    emissive: '#cbd9df',
    emissiveIntensity: 0.22,
  });
  plane(room, 0.1, 1.91, -3.375, 5.33, 2.42, windowGlow);
  for (const x of [-2.57, -1.22, 0.12, 1.47, 2.77])
    box(room, x, 1.91, -3.32, 0.055, 2.46, 0.055, darkSteel);
  for (const y of [0.72, 1.75, 3.12]) box(room, 0.1, y, -3.32, 5.4, 0.065, 0.055, darkSteel);
  box(room, 0.1, 0.71, -3.22, 5.5, 0.055, 0.27, ivory);
  const curtainMaterial = new THREE.MeshStandardMaterial({
    color: '#dbdfd4',
    side: THREE.DoubleSide,
    roughness: 1,
    transparent: true,
    opacity: 0.88,
  });
  for (let panel = 0; panel < 5; panel++) {
    const w = 1.03,
      h = 2.44;
    const geometry = new THREE.PlaneGeometry(w, h, 48, 10);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i);
      positions.setZ(
        i,
        Math.sin((x / w + 0.5) * Math.PI * 14) * 0.048 + Math.sin(y * 2.8 + panel) * 0.01,
      );
      positions.setY(i, y + Math.cos(x * 17 + panel) * 0.012 * (1 - (y + h / 2) / h));
    }
    geometry.computeVertexNormals();
    const curtain = mesh(room, geometry, curtainMaterial, -2.02 + panel * 1.055, 1.88, -3.18);
    curtain.name = `north-curtain-${panel + 1}`;
    curtain.castShadow = false;
  }
  rod(
    overhead,
    new THREE.Vector3(-2.65, 3.15, -3.12),
    new THREE.Vector3(2.79, 3.15, -3.12),
    0.022,
    darkSteel,
  );
  // 与照片一致，柜台沿西侧摆放，售卖面朝东。
  box(furniture, -2.65, 0.625, -1.8, 0.43, 1.25, 1.68, black, 0.014);
  box(furniture, -2.65, 1.255, -1.8, 0.47, 0.035, 1.73, mat('#30352f', 0.5), 0.012);
  const counter = new THREE.Group();
  counter.name = 'stainless-hot-food-counter';
  counter.position.set(counterX, 0, -0.85);
  counter.rotation.y = Math.PI / 2;
  furniture.add(counter);
  box(counter, 0, 0.53, 0, 2.8, 0.77, 0.89, steel, 0.022);
  box(counter, 0, 0.94, 0, 2.87, 0.065, 0.96, steel, 0.018);
  for (const x of [-1.28, 0, 1.28]) {
    box(counter, x, 0.53, 0.455, 0.017, 0.73, 0.008, darkSteel);
    for (const z of [-0.31, 0.31]) {
      cylinder(counter, x, 0.09, z, 0.035, 0.18, steel);
      cylinder(counter, x, 0.015, z, 0.041, 0.03, rubber);
    }
  }
  box(counter, -0.43, 1.08, -0.015, 1.83, 0.25, 0.83, steel, 0.016);
  function pan(x: number, z: number, foodColor: string, seed: number) {
    const panMaterial = mat('#bec4c0', 0.24, 0.82);
    box(counter, x, 1.217, z, 0.5, 0.027, 0.33, panMaterial, 0.025);
    box(counter, x, 1.23, z, 0.44, 0.012, 0.265, mat('#555f56', 0.53), 0.025);
    for (let i = 0; i < 12; i++) {
      const px = x + ((i % 4) - 1.5) * 0.09,
        pz = z + (Math.floor(i / 4) - 1) * 0.075;
      const food = mesh(
        counter,
        new THREE.SphereGeometry(0.052, 7, 5),
        mat(foodColor, 0.8),
        px,
        1.26 + (i % 3) * 0.006,
        pz,
      );
      food.scale.set(1.1, 0.55 + (seed % 2) * 0.2, 0.8);
      food.rotation.y = i * 1.2;
    }
  }
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++)
      pan(
        -1.02 + i * 0.58,
        -0.2 + j * 0.39,
        ['#eadbb4', '#ac6d39', '#597837', '#e8c75c', '#88502d', '#d2a870'][i * 2 + j],
        i,
      );
  // 右手收银台及弧面保温展示罩。
  box(counter, 1.04, 0.985, 0.17, 0.44, 0.055, 0.32, ivory, 0.025);
  const till = new THREE.Group();
  till.position.set(0.85, 1.03, -0.12);
  till.rotation.x = -0.45;
  counter.add(till);
  box(till, 0, 0, 0, 0.27, 0.19, 0.04, black, 0.016);
  plane(
    till,
    0,
    0,
    0.022,
    0.225,
    0.14,
    new THREE.MeshStandardMaterial({
      color: '#bfd1d7',
      emissive: '#91bdcc',
      emissiveIntensity: 0.25,
      roughness: 0.2,
    }),
  );
  box(counter, 1.05, 1.04, -0.29, 0.6, 0.12, 0.38, steel, 0.016);
  const warmGlass = new THREE.MeshPhysicalMaterial({
    color: '#cbe0da',
    metalness: 0.06,
    roughness: 0.12,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const warmer = new THREE.Group();
  counter.add(warmer);
  warmer.position.set(1.04, 1.09, -0.28);
  const hood = new THREE.CylinderGeometry(0.2, 0.2, 0.58, 18, 1, true, 0, Math.PI);
  const cover = mesh(warmer, hood, warmGlass);
  cover.rotation.z = Math.PI / 2;
  cover.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const sausage = cylinder(warmer, -0.23 + i * 0.115, 0.04, 0, 0.029, 0.28, mat('#a34722', 0.37));
    sausage.rotation.x = Math.PI / 2;
  }
  label(counter, '热烤香肠', 1.03, 1.05, -0.07, 0.55, 0.11, '#a42726', '#f6d477');
  const menu = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.49),
    new THREE.MeshStandardMaterial({ map: yifuMenuTexture(), roughness: 0.9 }),
  );
  menu.position.set(-0.16, 0.62, 0.46);
  counter.add(menu);
  label(
    counter,
    '暖甜双品\n红豆汤圆 · 银耳羹\n3元 / 份',
    -0.95,
    0.58,
    0.46,
    0.61,
    0.69,
    '#edddbb',
    '#61442c',
  );
  // 三台玻璃门冰柜，灯带、门封、货架与少量在售饮品独立建模。
  const fridgeLights: THREE.MeshStandardMaterial[] = [];
  function fridge(
    x: number,
    z: number,
    w: number,
    h: number,
    redBody: boolean,
    doubleDoor = false,
  ) {
    const f = new THREE.Group();
    furniture.add(f);
    f.position.set(x, 0, z);
    f.rotation.y = Math.PI / 2;
    f.name = doubleDoor
      ? 'black-double-door-refrigerator'
      : h > 1.4
        ? 'red-nongfu-spring-refrigerator'
        : 'small-red-milk-refrigerator';
    const body = redBody ? red : black;
    box(f, 0, h / 2 + 0.04, 0, w, h, 0.68, body, 0.04);
    const y0 = 0.23,
      y1 = h - (h > 1.4 ? 0.34 : 0.12),
      glassH = y1 - y0;
    box(f, 0, (y0 + y1) / 2, 0.349, w - 0.1, glassH, 0.035, rubber, 0.02);
    box(
      f,
      0,
      (y0 + y1) / 2,
      0.373,
      w - 0.16,
      glassH - 0.045,
      0.015,
      mat(redBody ? '#dce3df' : '#6c7470', 0.44),
      0.018,
    );
    const strips = new THREE.MeshStandardMaterial({
      color: '#eaf8fa',
      emissive: '#dcf2ff',
      emissiveIntensity: 1.6,
    });
    fridgeLights.push(strips);
    for (const sx of [-1, 1])
      box(f, sx * (w / 2 - 0.11), (y0 + y1) / 2, 0.405, 0.013, glassH - 0.06, 0.013, strips);
    const shelfCount = h > 1.4 ? 4 : 2;
    for (let shelf = 0; shelf < shelfCount; shelf++) {
      const sy = y0 + 0.11 + (shelf * (glassH - 0.13)) / shelfCount;
      box(f, 0, sy, 0.43, w - 0.19, 0.018, 0.13, ivory);
      for (let wire = 0; wire < 14; wire++)
        box(
          f,
          -w / 2 + 0.11 + (wire * (w - 0.22)) / 13,
          sy + 0.012,
          0.45,
          0.007,
          0.006,
          0.12,
          steel,
        );
      const items = shelf === 0 ? 2 : shelf === 1 ? 4 : 5;
      for (let n = 0; n < items; n++) {
        const px = -w / 2 + 0.16 + n * Math.min(0.1, (w - 0.26) / items);
        box(
          f,
          px,
          sy + 0.085,
          0.445,
          0.064,
          0.14,
          0.064,
          mat(shelf % 2 ? '#e3d4a8' : '#d4e2dc', 0.6),
          0.003,
        );
        box(
          f,
          px,
          sy + 0.065,
          0.48,
          0.053,
          0.055,
          0.002,
          mat(shelf % 2 ? '#996f3e' : '#597a8c', 0.65),
        );
        box(f, px, sy + 0.16, 0.445, 0.067, 0.012, 0.067, ivory);
      }
    }
    const glass = new THREE.MeshPhysicalMaterial({
      color: redBody ? '#cce4e2' : '#95a6a0',
      transparent: true,
      opacity: redBody ? 0.13 : 0.24,
      roughness: 0.13,
      metalness: 0.12,
      depthWrite: false,
    });
    plane(f, 0, (y0 + y1) / 2, 0.49, w - 0.18, glassH - 0.06, glass);
    for (const sx of doubleDoor ? [-0.06, 0.06] : [-w / 2 + 0.075])
      box(f, sx, (y0 + y1) / 2, 0.515, 0.024, 0.3, 0.035, black, 0.01);
    if (doubleDoor) box(f, 0, (y0 + y1) / 2, 0.5, 0.035, glassH + 0.025, 0.035, black);
    for (let i = 0; i < 5; i++) box(f, 0, 0.075 + i * 0.025, 0.35, w - 0.12, 0.009, 0.015, rubber);
    if (redBody && h > 1.4)
      label(f, '农夫山泉\nNONGFU SPRING', 0, h - 0.1, 0.355, w - 0.08, 0.25, '#d80c2c', '#fff9eb');
    else if (redBody)
      label(f, '午后奶茶', 0, h - 0.025, 0.36, w - 0.09, 0.085, '#102a42', '#f9e6b4');
    else box(f, 0, h - 0.1, 0.355, w - 0.09, 0.23, 0.012, steel);
    for (const px of [-w / 2 + 0.07, w / 2 - 0.07])
      for (const pz of [-0.25, 0.25]) cylinder(f, px, 0.025, pz, 0.03, 0.05, rubber);
    return f;
  }
  fridge(fridgeX, 2.55, 1.39, 2.24, false, true);
  fridge(fridgeX, 1.39, 0.77, 2.08, true);
  // 小冰柜位于柜台前方，三台使用同一中心 X 与门面深度，正面平齐。
  fridge(fridgeX, 0.68, 0.53, 0.86, true);
  // 展示架真实为银色角钢+鲜绿塑料托盘，底层垂挂粉纸饭种牌。
  const rack = new THREE.Group();
  furniture.add(rack);
  rack.position.set(-0.58, 0, -2.57);
  rack.name = 'green-tray-meal-display';
  for (const x of [-0.84, 0.84])
    for (const z of [-0.34, 0.34]) {
      box(rack, x, 0.56, z, 0.032, 1.12, 0.032, steel);
      for (let y = 0.1; y < 1.1; y += 0.08)
        box(rack, x, y, z + 0.018, 0.012, 0.018, 0.002, darkSteel);
      cylinder(rack, x, 0.025, z, 0.025, 0.05, rubber);
    }
  for (const y of [0.18, 0.6, 1.08]) {
    box(rack, 0, y, 0, 1.72, 0.025, 0.71, ivory);
    for (let n = 0; n < 3; n++) {
      const x = -0.55 + n * 0.55;
      box(rack, x, y + 0.027, 0, 0.51, 0.025, 0.62, mat('#78a83d', 0.48), 0.018);
      for (const zz of [-0.29, 0.29])
        box(rack, x, y + 0.055, zz, 0.5, 0.06, 0.018, mat('#8bbb47', 0.5), 0.007);
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = -0.73 + i * 0.125;
    box(
      rack,
      x,
      0.715,
      0.05,
      0.085,
      0.19,
      0.09,
      mat(i % 3 === 0 ? '#e6c396' : '#dce2cc', 0.8),
      0.004,
    );
    label(rack, i % 2 ? '纯牛奶' : '酸奶', x, 0.72, 0.097, 0.067, 0.06, '#e3e4cd', '#48615b');
  }
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 2; j++) {
      const lunch = box(
        rack,
        -0.63 + (i % 4) * 0.39,
        0.23 + Math.floor(i / 4) * 0.07 + j * 0.015,
        -0.1,
        0.33,
        0.055,
        0.32,
        mat(j ? '#e5ded0' : '#2c2b25', 0.55),
        0.02,
      );
      lunch.rotation.y = Math.sin(i * 2) * 0.04;
    }
  for (let i = 0; i < 4; i++)
    label(
      rack,
      ['猪\n排\n饭', '烤\n鸭\n饭', '鸡\n排\n饭', '牛\n排\n饭'][i],
      -0.64 + i * 0.43,
      0.36,
      0.37,
      0.28,
      0.48,
      '#e5b6b4',
      '#674e4b',
    );
  // 北侧与东侧就餐桌椅：浅绿桌面、黑钢管架、弯背木椅。
  function table(x: number, z: number, w: number, d: number) {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    furniture.add(t);
    box(t, 0, 0.76, 0, w, 0.035, d, cream, 0.012);
    for (const px of [-w / 2 + 0.11, w / 2 - 0.11])
      for (const pz of [-d / 2 + 0.1, d / 2 - 0.1]) {
        box(t, px, 0.38, pz, 0.038, 0.74, 0.038, black, 0.005);
        box(t, px, 0.025, pz, 0.045, 0.05, 0.045, rubber, 0.005);
      }
    for (const pz of [-d / 2 + 0.1, d / 2 - 0.1])
      box(t, 0, 0.65, pz, w - 0.16, 0.055, 0.035, black);
    box(t, 0, 0.25, 0, w - 0.2, 0.033, 0.033, black);
    return t;
  }
  function chair(x: number, z: number, ry: number) {
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    furniture.add(c);
    box(c, 0, 0.45, 0, 0.42, 0.045, 0.42, paleWood, 0.06);
    for (const px of [-0.16, 0.16])
      for (const pz of [-0.16, 0.16]) {
        const leg = box(c, px, 0.23, pz, 0.04, 0.45, 0.04, paleWood, 0.006);
        leg.rotation.z = px > 0 ? -0.04 : 0.04;
      }
    for (const px of [-0.165, 0.165]) {
      rod(
        c,
        new THREE.Vector3(px, 0.4, -0.16),
        new THREE.Vector3(px, 0.87, -0.205),
        0.019,
        paleWood,
      );
      box(c, px, 0.21, 0, 0.027, 0.027, 0.33, paleWood);
    }
    const back = box(c, 0, 0.805, -0.198, 0.44, 0.15, 0.039, paleWood, 0.04);
    back.rotation.x = -0.1;
    box(c, 0, 0.24, -0.15, 0.33, 0.027, 0.027, paleWood);
    return c;
  }
  table(1.64, -2.8, 1.95, 0.57);
  for (let i = 0; i < 3; i++) chair(0.99 + i * 0.65, -2.27, Math.PI);
  table(1.68, -0.2, 0.9, 1.45);
  // 南侧门向内开启时为门扇留净空；照片中两张桌面也紧邻摆放。
  table(1.68, 1.35, 0.9, 1.45);
  for (let i = 0; i < 5; i++) chair(2.5, -1.08 + i * 0.74, -Math.PI / 2);
  const takeaway = box(furniture, 1.64, 0.81, 0.87, 0.39, 0.055, 0.28, ivory, 0.024);
  takeaway.rotation.y = 0.14;
  box(furniture, 1.65, 0.842, 0.86, 0.32, 0.009, 0.21, mat('#be7864', 0.8), 0.015);
  const chopsticks = box(furniture, 1.8, 0.852, 1.05, 0.29, 0.008, 0.025, paleWood);
  chopsticks.rotation.y = -0.12;
  // 北东角微波炉与小柜，与照片2、4对齐。
  box(furniture, 2.46, 0.4, -2.94, 0.69, 0.79, 0.55, mat('#c7bba3', 0.6), 0.015);
  box(furniture, 2.46, 0.55, -2.657, 0.65, 0.025, 0.014, mat('#8f887a', 0.8));
  box(furniture, 2.46, 0.89, -2.92, 0.59, 0.29, 0.41, black, 0.02);
  box(furniture, 2.39, 0.89, -2.708, 0.38, 0.19, 0.012, mat('#293c39', 0.2, 0.2), 0.018);
  for (const y of [0.84, 0.94]) {
    const dial = cylinder(furniture, 2.69, y, -2.69, 0.023, 0.018, steel);
    dial.rotation.x = Math.PI / 2;
  }
  // 照片可见的吊顶卡式空调、银灰走线管和日光灯。
  box(overhead, -0.24, 3.1, 0.22, 1.12, 0.31, 1.03, mat('#a4a7a0', 0.6), 0.025);
  box(overhead, -0.24, 2.92, 0.22, 1.22, 0.06, 1.13, ivory, 0.025);
  box(overhead, -0.24, 2.878, 0.22, 0.75, 0.018, 0.66, mat('#c6c4ad', 0.8));
  for (let i = 0; i < 25; i++)
    box(overhead, -0.24, 2.862, -0.09 + i * 0.026, 0.71, 0.006, 0.007, mat('#92947f', 0.8));
  for (const x of [-0.75, 0.27]) box(overhead, x, 2.876, 0.22, 0.09, 0.022, 0.85, darkSteel, 0.02);
  for (const z of [-0.26, 0.7]) box(overhead, -0.24, 2.876, z, 0.83, 0.022, 0.08, darkSteel, 0.02);
  for (const x of [-0.72, 0.24])
    for (const z of [-0.2, 0.65])
      rod(overhead, new THREE.Vector3(x, 3.22, z), new THREE.Vector3(x, 3.53, z), 0.012, steel);
  const tubeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.85, 3.05, -1.45),
    new THREE.Vector3(-2.1, 3.05, -1.64),
    new THREE.Vector3(-0.6, 3.05, -1.64),
    new THREE.Vector3(0.25, 3.05, -1.4),
    new THREE.Vector3(0.31, 3.05, -0.35),
  ]);
  mesh(overhead, new THREE.TubeGeometry(tubeCurve, 28, 0.065, 8, false), mat('#aaaead', 0.65));
  for (let i = 0; i < 54; i++) {
    const p = tubeCurve.getPointAt(i / 54),
      tangent = tubeCurve.getTangentAt(i / 54);
    const ring = mesh(
      overhead,
      new THREE.TorusGeometry(0.065, 0.008, 4, 9),
      mat('#929794', 0.67),
      p.x,
      p.y,
      p.z,
    );
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
  }
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: '#fffef1',
    emissive: '#fff8df',
    emissiveIntensity: 2.2,
  });
  lampMaterial.name = 'yifu-fluorescent-tube-surface';
  const fixtureLights: THREE.PointLight[] = [];
  for (const config of YIFU_FIXTURE_LIGHTS) {
    const [x, y, z] = config.position;
    box(overhead, x, 3.02, z, 1.14, 0.055, 0.105, ivory, 0.015);
    box(overhead, x, 2.98, z, 1.08, 0.025, 0.075, lampMaterial, 0.012);
    // 光源在灯管下方，真实照亮柜台与桌面；无额外阴影贴图，俯视时也保留照明。
    const fixtureLight = new THREE.PointLight(
      YIFU_FIXTURE_COLORS.day,
      config.dayIntensity,
      config.distance,
      config.decay,
    );
    fixtureLight.name = `yifu-fluorescent-light-${fixtureLights.length + 1}`;
    fixtureLight.position.set(x, y, z);
    fixtureLights.push(fixtureLight);
    group.add(fixtureLight);
    for (const dx of [-0.44, 0.44])
      rod(
        overhead,
        new THREE.Vector3(x + dx, 3.05, z),
        new THREE.Vector3(x + dx, 3.35, z),
        0.009,
        steel,
      );
  }
  createYifuSignage(furniture, assets);
  createYifuWallArt(furniture, assets);
  furniture.traverse((object) => {
    if (object instanceof THREE.Mesh)
      object.userData = { ...object.userData, kind: 'stall', id: 'v-yifu-f1-kiosk' };
  });
  room.traverse((object) => {
    if (object instanceof THREE.Mesh) object.userData.yifuPart = 'architecture';
  });
  // 先合批静态装修与设备，再挂接活动人物/灯笼，保留动态关节与俯视显隐边界。
  batchModel(group);
  // 俯视独立的实体围护：墙在地板外缘，门口不加横梁，保证俯视可辨认真实开口。
  // 此组在合批后创建，避免与三维敞开模型合并而失去显隐边界。
  const planEnclosure = new THREE.Group();
  planEnclosure.name = 'yifu-plan-four-walls-and-south-door';
  planEnclosure.visible = false;
  group.add(planEnclosure);
  const planWall = mat('#d5d4c9', 0.92);
  box(
    planEnclosure,
    -2.99,
    1.68,
    (-3.49 + westStep.z) / 2,
    0.18,
    3.36,
    northWallLength + 0.09,
    planWall,
  ).name = 'yifu-plan-west-wall';
  // 实体填充冰柜后方墙垛，俯视不把墙内区域误画成可通行地面。
  box(
    planEnclosure,
    (-3.08 + westStep.x) / 2,
    1.68,
    (3.49 + westStep.z) / 2,
    westStep.depth + 0.18,
    3.36,
    southWallLength + 0.09,
    planWall,
  ).name = 'yifu-plan-west-fridge-wall-step';
  box(planEnclosure, 2.99, 1.68, 0, 0.18, 3.36, 6.98, planWall).name = 'yifu-plan-east-wall';
  box(planEnclosure, 0, 1.68, -3.49, 5.8, 3.36, 0.18, planWall).name = 'yifu-plan-north-wall';
  box(planEnclosure, -1.025, 1.68, 3.49, 3.75, 3.36, 0.18, planWall).name =
    'yifu-plan-south-wall-west';
  box(planEnclosure, 2.575, 1.68, 3.49, 0.65, 3.36, 0.18, planWall).name =
    'yifu-plan-south-wall-east';
  const doorFrame = mat('#a6bbb4', 0.6, 0.07);
  for (const x of [0.85, 2.25])
    box(planEnclosure, x, 1.15, 3.43, 0.07, 2.3, 0.17, doorFrame, 0.007);
  const door = new THREE.Group();
  door.name = 'yifu-plan-south-door-inward';
  door.position.set(2.215, 0, 3.43);
  door.rotation.y = -THREE.MathUtils.degToRad(75);
  planEnclosure.add(door);
  box(door, -0.665, 1.12, 0, 1.33, 2.24, 0.055, mat('#b7c1af', 0.69), 0.009);
  for (const y of [0.32, 1.92]) cylinder(door, 0, y, 0, 0.023, 0.1, steel);
  box(door, -1.2, 0.98, 0.04, 0.035, 0.16, 0.024, steel, 0.01);
  box(door, -1.13, 0.99, 0.062, 0.15, 0.024, 0.024, darkSteel, 0.01);
  // 铰链转轴及薄门板保留真实厚度；开门弧位于地面，帮助辨认朝内开启。
  const swingPoints: THREE.Vector3[] = [];
  for (let step = 0; step <= 30; step++) {
    const angle = THREE.MathUtils.degToRad((75 * step) / 30);
    swingPoints.push(
      new THREE.Vector3(2.215 - 1.33 * Math.cos(angle), 0.018, 3.43 - 1.33 * Math.sin(angle)),
    );
  }
  const swingArc = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(swingPoints),
    new THREE.LineDashedMaterial({
      color: '#718981',
      dashSize: 0.055,
      gapSize: 0.035,
      transparent: true,
      opacity: 0.68,
    }),
  );
  swingArc.computeLineDistances();
  swingArc.name = 'yifu-plan-door-opening-arc';
  planEnclosure.add(swingArc);
  // 俯视用于读布局，完整外墙不向室内投下大面积遮蔽阴影。
  planEnclosure.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.userData.yifuPart = 'architecture';
    }
  });
  const activity = new THREE.Group();
  activity.name = 'unbatched-living-details';
  group.add(activity);
  const atmosphere = createYifuAtmosphere(activity);
  activity.traverse((object) => {
    if (object instanceof THREE.Mesh)
      object.userData = { ...object.userData, kind: 'stall', id: 'v-yifu-f1-kiosk' };
  });
  const hemi = new THREE.HemisphereLight('#fff7e7', '#858577', YIFU_BROAD_LIGHTS.hemisphere.day);
  const key = new THREE.DirectionalLight('#fff2db', YIFU_BROAD_LIGHTS.key.day);
  key.position.set(1.7, 7.5, 4.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -5, near: 0.5, far: 22 });
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.022;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight('#dfebef', YIFU_BROAD_LIGHTS.fill.day);
  fill.position.set(-1.2, 4.2, -4);
  const interiorLight = new THREE.PointLight(
    YIFU_INTERIOR_LIGHT.color,
    YIFU_INTERIOR_LIGHT.dayIntensity,
    YIFU_INTERIOR_LIGHT.distance,
    YIFU_INTERIOR_LIGHT.decay,
  );
  interiorLight.name = 'yifu-soft-interior-fill';
  interiorLight.position.fromArray(YIFU_INTERIOR_LIGHT.position);
  group.add(hemi, key, fill, interiorLight);
  // 真实建筑表面（含地板、墙、门与设备）均可打开这个单窗口；蒸汽 Sprite 保持不可拾取。
  group.traverse((object) => {
    if (object instanceof THREE.Mesh)
      object.userData = { ...object.userData, kind: 'stall', id: 'v-yifu-f1-kiosk' };
  });
  return {
    group,
    setMode(mode) {
      overhead.visible = mode === '3d';
      walls.visible = mode === '3d';
      planEnclosure.visible = mode === 'plan';
      atmosphere.setMode(mode);
    },
    setInterfaceTheme(night) {
      group.userData.night = night;
      hemi.intensity = night
        ? YIFU_BROAD_LIGHTS.hemisphere.night
        : YIFU_BROAD_LIGHTS.hemisphere.day;
      hemi.color.set(night ? '#b9c4d6' : '#fff7e7');
      hemi.groundColor.set(night ? '#514c48' : '#858577');
      key.intensity = night ? YIFU_BROAD_LIGHTS.key.night : YIFU_BROAD_LIGHTS.key.day;
      key.color.set(night ? '#d9dfed' : '#fff2db');
      fill.intensity = night ? YIFU_BROAD_LIGHTS.fill.night : YIFU_BROAD_LIGHTS.fill.day;
      interiorLight.intensity = night
        ? YIFU_INTERIOR_LIGHT.nightIntensity
        : YIFU_INTERIOR_LIGHT.dayIntensity;
      fixtureLights.forEach((light, index) => {
        light.color.set(night ? YIFU_FIXTURE_COLORS.night : YIFU_FIXTURE_COLORS.day);
        light.intensity = night
          ? YIFU_FIXTURE_LIGHTS[index].nightIntensity
          : YIFU_FIXTURE_LIGHTS[index].dayIntensity;
      });
      windowGlow.emissiveIntensity = night ? 0.025 : 0.22;
      windowGlow.color.set(night ? '#65717e' : '#d8e1df');
      lampMaterial.color.set(night ? '#ffc96d' : '#fffef1');
      lampMaterial.emissive.set(night ? '#ffae38' : '#fff8df');
      lampMaterial.emissiveIntensity = night ? 1.05 : 2.2;
      fridgeLights.forEach((material) => {
        material.emissiveIntensity = night ? 2.4 : 1.6;
      });
      atmosphere.setNight(night);
    },
    tick(time) {
      atmosphere.tick(time);
    },
  };
}
