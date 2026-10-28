import * as THREE from 'three';
import { batchModel } from '../lib/model-batches';

type Position = readonly [number, number, number];

/** 照片 4–6 的营业细节：灯笼、绿植、果盘与微弱热气。北为 -Z，南面敞开。 */
export function createYifuAtmosphere(parent: THREE.Group) {
  const group = new THREE.Group();
  group.name = 'yifu-kiosk-atmosphere';
  const hanging = new THREE.Group();
  hanging.name = 'yifu-red-lanterns';
  hanging.userData.planHide = true;
  const plants = new THREE.Group();
  plants.name = 'yifu-counter-plants';
  const steam = new THREE.Group();
  steam.name = 'yifu-gentle-food-steam';
  group.add(hanging, plants, steam);
  parent.add(group);

  const up = new THREE.Vector3(0, 1, 0);
  const ball = new THREE.SphereGeometry(1, 16, 12);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  function material(color: string, options: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...options });
  }
  const red = material('#a71e31', { roughness: 0.62, metalness: 0.08 });
  const redThread = material('#c52b32', { roughness: 0.88 });
  const gold = material('#d3a248', { roughness: 0.53, metalness: 0.35 });
  const cord = material('#4a4238');
  const leafMaterials = [material('#356035'), material('#5b7a3d'), material('#6c8c48')];
  const stems = material('#6d7545');
  const potMaterials = [material('#6d4a39'), material('#b4a596'), material('#7b8278')];
  const soil = material('#47392a');

  function mesh(
    into: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    position: Position,
    scale: Position = [1, 1, 1],
  ) {
    const item = new THREE.Mesh(geometry, surface);
    item.position.set(...position);
    item.scale.set(...scale);
    item.castShadow = true;
    item.receiveShadow = true;
    item.userData = { kind: 'stall', id: 'v-yifu-f1-kiosk' };
    into.add(item);
    return item;
  }
  function rod(into: THREE.Object3D, surface: THREE.Material, from: Position, to: Position, radius: number) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const center = start.add(end).multiplyScalar(0.5);
    const item = mesh(into, cylinder, surface, [center.x, center.y, center.z], [radius, direction.length(), radius]);
    item.quaternion.setFromUnitVectors(up, direction.normalize());
    return item;
  }

  // 经线起伏让红绸在灯光下呈现出照片中真实的分瓣，而非一个光滑红球。
  const lanternGeometry = new THREE.SphereGeometry(1, 48, 24);
  const lanternPositions = lanternGeometry.getAttribute('position');
  for (let i = 0; i < lanternPositions.count; i++) {
    const x = lanternPositions.getX(i), z = lanternPositions.getZ(i);
    const rib = 1 + Math.cos(Math.atan2(z, x) * 12) * 0.025;
    lanternPositions.setXYZ(i, x * rib, lanternPositions.getY(i), z * rib);
  }
  lanternGeometry.computeVertexNormals();
  const suspended: THREE.Group[] = [];
  function lantern(x: number, y: number, z: number, scale: number, hangingCord = true) {
    const ornament = new THREE.Group();
    ornament.userData.planHide = true;
    ornament.position.set(x, y, z);
    ornament.scale.setScalar(scale);
    hanging.add(ornament);
    mesh(ornament, lanternGeometry, red, [0, 0, 0], [0.27, 0.205, 0.27]);
    for (const sign of [-1, 1]) {
      mesh(ornament, cylinder, gold, [0, sign * 0.192, 0], [0.083, 0.024, 0.083]);
      const band = mesh(ornament, new THREE.TorusGeometry(0.115, 0.009, 5, 32), gold, [0, sign * 0.174, 0]);
      band.rotation.x = Math.PI / 2;
    }
    // 金色小卷纹沿灯笼下沿排布；用几何环替代模糊的文字贴图。
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      const curl = mesh(ornament, new THREE.TorusGeometry(0.021, 0.004, 4, 10, Math.PI * 1.6), gold,
        [Math.cos(angle) * 0.195, -0.137, Math.sin(angle) * 0.195]);
      curl.rotation.y = -angle + Math.PI / 2;
      curl.rotation.z = i % 2 ? 0.4 : -0.4;
    }
    rod(ornament, gold, [0, -0.2, 0], [0, -0.3, 0], 0.014);
    const tassels = new THREE.InstancedMesh(cylinder, gold, 22);
    const transform = new THREE.Object3D();
    for (let i = 0; i < 22; i++) {
      const angle = i * 2.4;
      const radius = 0.018 + (i % 3) * 0.005;
      transform.position.set(Math.cos(angle) * radius, -0.405 - (i % 4) * 0.003, Math.sin(angle) * radius);
      transform.rotation.set(Math.sin(angle) * 0.04, 0, Math.cos(angle) * 0.04);
      transform.scale.set(0.0023, 0.235, 0.0023);
      transform.updateMatrix();
      tassels.setMatrixAt(i, transform.matrix);
    }
    tassels.userData = { kind: 'stall', id: 'v-yifu-f1-kiosk' };
    ornament.add(tassels);
    if (hangingCord) rod(hanging, cord, [x, y + 0.2 * scale, z], [x, 3.2, z], 0.005);
    suspended.push(ornament);
  }
  lantern(-0.72, 2.66, -1.38, 1.05);
  lantern(0.68, 2.52, -1.95, 0.82);
  for (const x of [-1.82, 0.05]) {
    for (let i = 0; i < 4; i++) lantern(x, 2.86 - i * 0.17, -2.83, 0.32, i === 0);
    rod(hanging, redThread, [x - 0.014, 2.24, -2.83], [x - 0.014, 1.98, -2.83], 0.007);
    rod(hanging, redThread, [x + 0.014, 2.24, -2.83], [x + 0.014, 2, -2.83], 0.006);
  }
  // 西墙上的扁灯笼。
  const wallOrnament = mesh(hanging, lanternGeometry, redThread, [-2.765, 2.3, -2.47], [0.035, 0.16, 0.19]);
  wallOrnament.castShadow = false;
  rod(hanging, gold, [-2.765, 2.14, -2.47], [-2.765, 1.92, -2.47], 0.008);

  // 使用少量共用叶片几何及实例化；每盆分枝弯曲，避免统一的球形树冠。
  const leafGeometry = new THREE.PlaneGeometry(1, 1, 4, 8);
  const leafPosition = leafGeometry.getAttribute('position');
  for (let i = 0; i < leafPosition.count; i++) {
    const y = leafPosition.getY(i) + 0.5;
    const edge = Math.sin(Math.PI * y);
    leafPosition.setXYZ(i, leafPosition.getX(i) * edge, y, Math.sin(y * Math.PI) * 0.18 - y * y * 0.19);
  }
  leafGeometry.computeVertexNormals();
  leafMaterials.forEach((surface) => { surface.side = THREE.DoubleSide; });
  const transform = new THREE.Object3D();
  function plant(x: number, y: number, z: number, size: number, index: number, longLeaves = false) {
    const pot = new THREE.Group();
    pot.position.set(x, y, z);
    pot.scale.setScalar(size);
    plants.add(pot);
    mesh(pot, new THREE.CylinderGeometry(0.12, 0.085, 0.17, 16), potMaterials[index % 3], [0, 0.085, 0]);
    mesh(pot, cylinder, soil, [0, 0.174, 0], [0.107, 0.007, 0.107]);
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterials[index % 3], longLeaves ? 24 : 30);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    leaves.userData = { kind: 'stall', id: 'v-yifu-f1-kiosk' };
    pot.add(leaves);
    for (let i = 0; i < leaves.count; i++) {
      const angle = i * 2.399 + index;
      const height = longLeaves ? 0.2 : 0.23 + (i % 6) * 0.065;
      const radius = longLeaves ? 0.035 : (i % 6) * 0.014;
      const lx = Math.cos(angle) * radius, lz = Math.sin(angle) * radius;
      transform.position.set(lx, height, lz);
      transform.rotation.set(longLeaves ? -0.95 - (i % 4) * 0.18 : -0.7 - (i % 3) * 0.25, angle, 0);
      transform.scale.set(longLeaves ? 0.033 : 0.08 + (i % 3) * 0.012, longLeaves ? 0.44 : 0.15 + (i % 4) * 0.015, 1);
      transform.updateMatrix();
      leaves.setMatrixAt(i, transform.matrix);
      if (i % 5 === 0 && !longLeaves) rod(pot, stems, [0, 0.17, 0], [lx, height + 0.02, lz], 0.006);
    }
  }
  plant(-2.6, 1.25, -2.1, 1.12, 0);
  plant(-2.58, 1.25, -1.65, 1.32, 1);
  plant(-2.58, 1.25, -1.2, 0.78, 2);
  plant(-2.3, 2.25, 2.55, 0.95, 2, true);

  // 北面绿托盘架上那盘香蕉与黄瓜，保留随手摆放而不完全对称的陈列。
  const fruit = new THREE.Group();
  fruit.name = 'yifu-fresh-fruit-plate';
  fruit.position.set(-0.58, 1.135, -2.57);
  group.add(fruit);
  const porcelain = material('#f3f0df', { roughness: 0.3 });
  mesh(fruit, cylinder, porcelain, [0, 0.012, 0], [0.35, 0.02, 0.24]);
  const plateRim = mesh(fruit, new THREE.TorusGeometry(0.3, 0.018, 6, 32), porcelain, [0, 0.025, 0]);
  plateRim.rotation.x = Math.PI / 2;
  plateRim.scale.set(1.16, 0.78, 1);
  const bananaSkin = material('#d8be4e', { roughness: 0.7 });
  const fruitStem = material('#665132');
  const cucumber = material('#38633b', { roughness: 0.58 });
  for (let i = 0; i < 5; i++) {
    const bananaCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.23, 0.058 + i * 0.007, -0.05 + i * 0.045),
      new THREE.Vector3(-0.06, 0.092 + i * 0.008, -0.095 + i * 0.037),
      new THREE.Vector3(0.04, 0.055 + i * 0.007, -0.01 + i * 0.03),
    );
    mesh(fruit, new THREE.TubeGeometry(bananaCurve, 10, 0.019, 6, false), bananaSkin, [0, 0, 0]);
    const end = bananaCurve.getPoint(1);
    mesh(fruit, ball, fruitStem, [end.x, end.y, end.z], [0.013, 0.013, 0.012]);
  }
  for (let i = 0; i < 3; i++) {
    const vegetable = mesh(fruit, ball, cucumber, [0.14 + i * 0.036, 0.056 + i * 0.018, -0.01], [0.027, 0.026, 0.18]);
    vegetable.rotation.y = 0.24 + i * 0.22;
  }

  // 微弱蒸汽仅在餐盘上方 0.6 m 内消散，静态首帧也保留可见的淡雾。
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const dx = (x - 31.5) / 31.5, dy = (y - 31.5) / 31.5;
    const radius = dx * dx + dy * dy;
    const offset = (y * 64 + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
    pixels[offset + 3] = Math.round(Math.max(0, Math.exp(-radius * 4.5) - 0.012) * 145);
  }
  const steamTexture = new THREE.DataTexture(pixels, 64, 64, THREE.RGBAFormat);
  steamTexture.needsUpdate = true;
  const wisps: THREE.Sprite[] = [];
  for (let i = 0; i < 7; i++) {
    const surface = new THREE.SpriteMaterial({ map: steamTexture, transparent: true, opacity: 0.09, depthWrite: false, color: '#fff5e8' });
    const wisp = new THREE.Sprite(surface);
    wisp.name = 'food-steam-no-pick';
    wisp.raycast = () => {};
    steam.add(wisp);
    wisps.push(wisp);
  }

  let isPlan = false;
  let isNight = false;
  function tick(time: number) {
    if (isPlan) return;
    suspended.forEach((lantern, index) => {
      lantern.rotation.z = Math.sin(time * 0.48 + index * 1.2) * 0.008;
    });
    wisps.forEach((wisp, index) => {
      const phase = (time * 0.19 + index / wisps.length) % 1;
      wisp.position.set(-1.65 + Math.sin(phase * 4 + index) * 0.045,
        1.15 + phase * 0.55, -0.63 + (index % 3 - 1) * 0.12 + Math.cos(phase * 5 + index) * 0.03);
      wisp.scale.set(0.11 + phase * 0.18, 0.14 + phase * 0.24, 1);
      wisp.material.opacity = Math.sin(Math.PI * phase) * (isNight ? 0.13 : 0.105);
      wisp.material.rotation = Math.sin(time * 0.24 + index) * 0.25;
    });
  }
  tick(1.5);
  // 每只灯笼独立合批，减少卷纹的 draw calls 并保留轻微摆动。
  batchModel(group);
  return {
    setMode(mode: 'plan' | '3d') {
      isPlan = mode === 'plan';
      hanging.visible = steam.visible = !isPlan;
    },
    setNight(night: boolean) {
      isNight = night;
      red.emissive.set(night ? '#6d1020' : '#000000');
      red.emissiveIntensity = night ? 0.12 : 0;
      gold.emissive.set(night ? '#6a4317' : '#000000');
      gold.emissiveIntensity = night ? 0.08 : 0;
    },
    tick,
  };
}
