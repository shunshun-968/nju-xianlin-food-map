import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type Position = readonly [number, number, number];
type Batch = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  transforms: THREE.Matrix4[];
};

/**
 * 第九食堂照片中的浅木餐桌、餐具、就餐者和银色包柱。
 * 使用固定空间坐标和静态实例；不创建吊顶，保持所有店铺招牌可见。
 * 桌面离地 0.8 m，地板基准与现有食堂模型一致为 y = 0.16。
 */
export function addNinthCanteenAtmosphere(parent: THREE.Group): void {
  const atmosphere = new THREE.Group();
  atmosphere.name = 'ninth-canteen-atmosphere';
  parent.add(atmosphere);

  const floorY = 0.16;
  const batches = new Map<string, Batch>();
  const identity = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const softBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.075);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const potGeometry = new THREE.CylinderGeometry(0.27, 0.2, 0.42, 12);
  const hairGeometry = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const bowlGeometry = new THREE.LatheGeometry(
    [
      [0, 0],
      [0.052, 0],
      [0.095, 0.035],
      [0.122, 0.09],
      [0.112, 0.09],
      [0.087, 0.041],
      [0.042, 0.019],
      [0, 0.019],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    16,
  );

  function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.76, ...extra });
  }
  const wood = material('#c89c64');
  const woodEdge = material('#a77b4c');
  const tableStone = material('#e6e4d9', { roughness: 0.38 });
  const stoneVein = material('#c9c8bf', { roughness: 0.45 });
  const trayGreen = material('#8d9f36', { roughness: 0.5 });
  const ceramic = material('#eee7d5', { roughness: 0.37 });
  const rice = material('#e1d7b9');
  const food = material('#a76734', { roughness: 0.64 });
  const greens = material('#577d38');
  const waterBottle = material('#a6bdba', { metalness: 0.12, roughness: 0.32 });
  const dark = material('#353c3b');
  const steel = material('#b4b9b6', { metalness: 0.67, roughness: 0.35 });
  const columnPanel = material('#bc8764');
  const lightStrip = material('#fff0cf', {
    emissive: '#f9d69a',
    emissiveIntensity: 0.65,
    roughness: 0.45,
  });
  const skin = material('#c9a78b', { roughness: 0.91 });
  const hair = material('#333330', { roughness: 0.96 });
  const trousers = material('#3b4246', { roughness: 0.94 });
  const clothes = ['#647c85', '#ae795c', '#d1c5ab', '#686c5d'].map((color) => material(color));
  const planter = material('#555d4c');
  const soil = material('#4c3c2a');
  const stem = material('#796143');
  const leaves = [material('#47653d'), material('#67804a')];

  function place(
    geometry: THREE.BufferGeometry,
    surface: THREE.MeshStandardMaterial,
    position: Position,
    scale: Position = [1, 1, 1],
    rotation: Position = [0, 0, 0],
    frame = identity,
  ) {
    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    );
    transform.premultiply(frame);
    const key = `${geometry.uuid}:${surface.uuid}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry, material: surface, transforms: [] };
      batches.set(key, batch);
    }
    batch.transforms.push(transform);
  }

  function frameAt(x: number, z: number, angle = 0) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(x, floorY, z),
      new THREE.Quaternion().setFromAxisAngle(up, angle),
      new THREE.Vector3(1, 1, 1),
    );
  }

  function box(
    surface: THREE.MeshStandardMaterial,
    position: Position,
    size: Position,
    frame = identity,
    rotation: Position = [0, 0, 0],
    rounded = false,
  ) {
    place(rounded ? softBox : unitBox, surface, position, size, rotation, frame);
  }

  function rod(
    surface: THREE.MeshStandardMaterial,
    from: Position,
    to: Position,
    radius: number,
    frame = identity,
  ) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const rotation = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize()),
    );
    const center = start.add(end).multiplyScalar(0.5);
    place(
      cylinder,
      surface,
      [center.x, center.y, center.z],
      [radius, direction.length(), radius],
      [rotation.x, rotation.y, rotation.z],
      frame,
    );
  }

  function chair(x: number, z: number, angle: number) {
    const frame = frameAt(x, z, angle);
    box(wood, [0, 0.455, 0], [0.43, 0.055, 0.42], frame, [0, 0, 0], true);
    box(wood, [0, 0.79, -0.185], [0.43, 0.25, 0.055], frame, [-0.08, 0, 0], true);
    for (const side of [-1, 1]) {
      rod(woodEdge, [side * 0.17, 0.04, 0.18], [side * 0.16, 0.43, 0.14], 0.023, frame);
      rod(woodEdge, [side * 0.18, 0.04, -0.17], [side * 0.16, 0.83, -0.19], 0.023, frame);
      rod(woodEdge, [side * 0.17, 0.2, -0.17], [side * 0.17, 0.2, 0.16], 0.016, frame);
    }
  }

  function meal(tableFrame: THREE.Matrix4, x: number, z: number, variant: number) {
    const frame = tableFrame.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0.8, z));
    box(trayGreen, [0, 0.014, 0], [0.55, 0.026, 0.35], frame, [0, 0, 0], true);
    for (const side of [-1, 1]) {
      box(trayGreen, [side * 0.263, 0.03, 0], [0.023, 0.027, 0.34], frame);
      box(trayGreen, [0, 0.03, side * 0.163], [0.53, 0.027, 0.023], frame);
    }
    place(bowlGeometry, ceramic, [-0.105, 0.029, 0], [1, 1, 1], [0, 0, 0], frame);
    place(sphere, rice, [-0.105, 0.091, 0], [0.095, 0.025, 0.095], [0, 0, 0], frame);
    place(sphere, ceramic, [0.135, 0.036, 0], [0.103, 0.013, 0.12], [0, 0, 0], frame);
    for (let i = 0; i < 4; i++) {
      place(
        sphere,
        i % 2 === 0 ? food : greens,
        [0.11 + (i % 2) * 0.044, 0.058, -0.055 + Math.floor(i / 2) * 0.06],
        [0.035, 0.017 + (i % 2) * 0.007, 0.038],
        [0, i * 0.6, 0],
        frame,
      );
    }
    for (const offset of [-0.009, 0.009]) {
      rod(woodEdge, [0.283 + offset, 0.04, -0.13], [0.3 + offset, 0.04, 0.13], 0.0045, frame);
    }
    if (variant % 3 === 0) {
      place(cylinder, waterBottle, [0.34, 0.105, 0.07], [0.037, 0.21, 0.037], [0, 0, 0], frame);
      place(cylinder, dark, [0.34, 0.216, 0.07], [0.026, 0.018, 0.026], [0, 0, 0], frame);
    } else {
      place(cylinder, ceramic, [0.34, 0.045, 0.07], [0.042, 0.09, 0.042], [0, 0, 0], frame);
      place(cylinder, food, [0.34, 0.091, 0.07], [0.034, 0.002, 0.034], [0, 0, 0], frame);
    }
  }

  function diner(x: number, z: number, angle: number, variant: number) {
    const frame = frameAt(x, z, angle);
    const shirt = clothes[variant % clothes.length];
    // A seated silhouette with bent knees and hands resting toward the meal.
    // No eyes or mouth: restrained detail remains natural at map viewing distance.
    box(trousers, [0, 0.56, 0], [0.29, 0.16, 0.24], frame, [0, 0, 0], true);
    box(shirt, [0, 0.86, 0.025], [0.35, 0.45, 0.22], frame, [0.1, 0, 0], true);
    for (const side of [-1, 1]) {
      rod(trousers, [side * 0.09, 0.55, 0.02], [side * 0.1, 0.5, 0.28], 0.065, frame);
      rod(trousers, [side * 0.1, 0.5, 0.28], [side * 0.1, 0.13, 0.31], 0.05, frame);
      box(dark, [side * 0.1, 0.075, 0.35], [0.12, 0.095, 0.23], frame, [0, 0, 0], true);
      const elbow: Position = [side * 0.19, 0.82, 0.17];
      const hand: Position = [side * 0.13, 0.835, 0.41];
      rod(shirt, [side * 0.16, 1.02, 0.05], elbow, 0.048, frame);
      rod(shirt, elbow, hand, 0.039, frame);
      place(sphere, skin, hand, [0.036, 0.025, 0.048], [0, 0, 0], frame);
    }
    rod(skin, [0, 1.07, 0.05], [0, 1.15, 0.065], 0.036, frame);
    place(sphere, skin, [0, 1.245, 0.075], [0.103, 0.132, 0.096], [0.12, 0, 0], frame);
    place(hairGeometry, hair, [0, 1.255, 0.067], [0.11, 0.136, 0.103], [0.15, 0, 0], frame);
    if (variant === 2) {
      place(sphere, hair, [0, 1.17, -0.025], [0.104, 0.11, 0.045], [0, 0, 0], frame);
    }
  }

  const tableXs = [-14, -8, -2, 4, 10, 16];
  for (const [row, z] of [1, 5].entries()) {
    for (const [index, x] of tableXs.entries()) {
      const frame = frameAt(x, z);
      box(tableStone, [0, 0.77, 0], [2.1, 0.06, 1], frame, [0, 0, 0], true);
      box(woodEdge, [0, 0.715, 0], [1.87, 0.06, 0.78], frame);
      for (const sideX of [-1, 1]) {
        for (const sideZ of [-1, 1]) {
          box(wood, [sideX * 0.84, 0.35, sideZ * 0.32], [0.065, 0.7, 0.065], frame);
        }
      }
      // A pair of quiet stone veins prevents the tabletops from reading as plastic.
      box(stoneVein, [-0.45, 0.8005, 0.04], [0.62, 0.001, 0.006], frame, [0, 0.36, 0]);
      box(stoneVein, [0.55, 0.8005, -0.2], [0.38, 0.001, 0.004], frame, [0, -0.5, 0]);
      for (const side of [-1, 1]) {
        chair(x - 0.55, z + side * 0.87, side === -1 ? 0 : Math.PI);
        chair(x + 0.55, z + side * 0.87, side === -1 ? 0 : Math.PI);
      }
      meal(frame, -0.55, -0.21, index + row);
      if ((index + row) % 3 !== 1) meal(frame, 0.55, 0.21, index + row + 1);
    }
  }

  diner(-14.55, 0.13, 0, 0);
  diner(-1.45, 1.87, Math.PI, 1);
  diner(3.45, 4.13, 0, 2);
  diner(16.55, 5.87, Math.PI, 3);
  diner(10.55, 0.13, 0, 1);

  for (const x of [-9, 9]) {
    const frame = frameAt(x, 3);
    box(dark, [0, 0.075, 0], [0.76, 0.15, 0.76], frame);
    box(steel, [0, 1.48, 0], [0.7, 2.82, 0.7], frame);
    box(columnPanel, [0, 1.34, -0.357], [0.69, 1.18, 0.018], frame);
    box(columnPanel, [0, 1.34, 0.357], [0.69, 1.18, 0.018], frame);
    for (const side of [-1, 1]) {
      box(lightStrip, [side * 0.32, 1.34, -0.37], [0.018, 1.2, 0.012], frame);
      box(lightStrip, [side * 0.32, 1.34, 0.37], [0.018, 1.2, 0.012], frame);
    }
  }

  for (const [x, z] of [
    [-17.2, 3],
    [19.1, 3],
    [18.8, 6.45],
  ]) {
    const frame = frameAt(x, z);
    place(potGeometry, planter, [0, 0.21, 0], [1, 1, 1], [0, 0, 0], frame);
    place(cylinder, soil, [0, 0.413, 0], [0.245, 0.008, 0.245], [0, 0, 0], frame);
    rod(stem, [0, 0.4, 0], [0.015, 1.35, 0.025], 0.023, frame);
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.4;
      const height = 0.72 + (i % 4) * 0.17;
      const spread = 0.2 + (i % 3) * 0.045;
      const end: Position = [Math.cos(angle) * spread, height + 0.11, Math.sin(angle) * spread];
      rod(stem, [0, height - 0.15, 0], end, 0.009, frame);
      place(
        sphere,
        leaves[i % leaves.length],
        end,
        [0.18, 0.023, 0.075],
        [0.12, -angle, 0.22],
        frame,
      );
    }
  }

  // Repeated furniture and props use one draw call per geometry/material pair.
  // Resources are local to this model, so the existing scene disposer owns them safely.
  for (const [index, batch] of [...batches.values()].entries()) {
    const instances = new THREE.InstancedMesh(
      batch.geometry,
      batch.material,
      batch.transforms.length,
    );
    instances.name = `ninth-dining-detail-${index}`;
    instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.transforms.forEach((transform, i) => instances.setMatrixAt(i, transform));
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = true;
    instances.receiveShadow = true;
    instances.computeBoundingSphere();
    atmosphere.add(instances);
  }
}
