import * as THREE from 'three';

type Point = readonly [number, number, number];

/**
 * 冰柜内陈列的堪察加拟石蟹：三对步足、一对不等大的螯、棘状甲壳。
 * 前方为 +Z，接触面为 y = 0，包围尺寸为 1.25 × 0.28 × 0.75 m。
 * 几何与材质由当前模型独占并复用，可交给场景现有的 batchModel / disposer。
 */
export function createKingCrab(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ninth-display-king-crab';
  const parts = new THREE.Group();
  parts.name = 'king-crab-anatomy';
  root.add(parts);

  const shell = new THREE.MeshStandardMaterial({
    color: '#7c3f43',
    roughness: 0.49,
    metalness: 0.03,
  });
  const legShell = new THREE.MeshStandardMaterial({
    color: '#a45547',
    roughness: 0.55,
  });
  const shellRidge = new THREE.MeshStandardMaterial({
    color: '#8d4d4b',
    roughness: 0.62,
  });
  const cream = new THREE.MeshStandardMaterial({ color: '#dbc4a3', roughness: 0.61 });
  const horn = new THREE.MeshStandardMaterial({ color: '#563a36', roughness: 0.4 });
  const eye = new THREE.MeshStandardMaterial({ color: '#1d1919', roughness: 0.18 });

  const ellipsoid = new THREE.SphereGeometry(1, 14, 10);
  const smallSphere = new THREE.SphereGeometry(1, 10, 6);
  const segment = new THREE.CylinderGeometry(0.72, 1, 1, 10, 1);
  const cone = new THREE.ConeGeometry(1, 1, 6);
  const up = new THREE.Vector3(0, 1, 0);
  const spineTransforms: THREE.Matrix4[] = [];

  function mesh(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.MeshStandardMaterial,
    at: Point,
    scale: Point,
  ) {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.position.set(...at);
    object.scale.set(...scale);
    object.castShadow = true;
    object.receiveShadow = true;
    parts.add(object);
    return object;
  }

  function rod(
    name: string,
    from: Point,
    to: Point,
    radius: number,
    material: THREE.MeshStandardMaterial,
    geometry = segment,
  ) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const delta = end.clone().sub(start);
    const center = start.add(end).multiplyScalar(0.5);
    const object = mesh(name, geometry, material, center.toArray(), [
      radius,
      delta.length(),
      radius,
    ]);
    object.quaternion.setFromUnitVectors(up, delta.normalize());
    return object;
  }

  function spine(base: Point, direction: THREE.Vector3, height: number, radius: number) {
    const axis = direction.clone().normalize();
    spineTransforms.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...base).addScaledVector(axis, height / 2),
        new THREE.Quaternion().setFromUnitVectors(up, axis),
        new THREE.Vector3(radius, height, radius),
      ),
    );
  }

  // A broad rear and narrower face distinguish the shield from a spherical body.
  // The top is a continuous domed surface; slight deterministic mottling is vertex color.
  const rings = 10;
  const sectors = 40;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color('#87454a');
  for (let ring = 0; ring <= rings; ring++) {
    const radius = ring / rings;
    for (let sector = 0; sector <= sectors; sector++) {
      const angle = (sector / sectors) * Math.PI * 2;
      const forward = Math.cos(angle);
      const x = Math.sin(angle) * radius * 0.165 * (1 - 0.22 * Math.max(0, forward));
      const z = forward * radius * 0.153 - 0.02;
      const y = 0.123 + 0.102 * Math.pow(Math.max(0, 1 - radius * radius), 0.58);
      positions.push(x, y, z);
      const variation = 0.93 + 0.1 * Math.sin(sector * 2.17 + ring * 3.9);
      const color = baseColor.clone().multiplyScalar(variation);
      colors.push(color.r, color.g, color.b);
      if (ring < rings && sector < sectors) {
        const a = ring * (sectors + 1) + sector;
        const b = a + sectors + 1;
        indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }
  const carapace = new THREE.BufferGeometry();
  carapace.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  carapace.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  carapace.setIndex(indices);
  carapace.computeVertexNormals();
  const carapaceMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0.025,
  });
  mesh('king-crab-carapace', carapace, carapaceMaterial, [0, 0, 0], [1, 1, 1]);
  mesh('king-crab-pale-underside', ellipsoid, cream, [0, 0.113, -0.017], [0.151, 0.037, 0.145]);
  mesh('king-crab-shell-edge', ellipsoid, shell, [0, 0.13, -0.025], [0.164, 0.027, 0.148]);

  // Sparse prominent dorsal spines plus small marginal spines, all one draw call.
  for (let ring = 0; ring < 4; ring++) {
    const count = ring === 0 ? 5 : 9 + ring * 4;
    const radius = 0.17 + ring * 0.235;
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 + ring * 0.39;
      const forward = Math.cos(angle);
      const x = Math.sin(angle) * radius * 0.165 * (1 - 0.22 * Math.max(0, forward));
      const z = forward * radius * 0.153 - 0.02;
      const y = 0.123 + 0.102 * Math.pow(1 - radius * radius, 0.58);
      spine(
        [x, y, z],
        new THREE.Vector3(Math.sin(angle) * radius * 0.7, 1, forward * radius * 0.7),
        (ring === 1 ? 0.034 : 0.021) + (index % 3) * 0.003,
        ring === 1 ? 0.009 : 0.0055,
      );
    }
  }
  for (let index = 0; index < 25; index++) {
    const angle = (index / 25) * Math.PI * 2;
    const forward = Math.cos(angle);
    spine(
      [Math.sin(angle) * 0.16 * (1 - 0.22 * Math.max(0, forward)), 0.134, forward * 0.149 - 0.02],
      new THREE.Vector3(Math.sin(angle), 0.38, forward),
      0.017 + (index % 3) * 0.003,
      0.006,
    );
  }

  // Deliberately three pairs: the small, reduced grooming limbs remain under the shell.
  const legPaths: readonly (readonly Point[])[] = [
    [
      [0.105, 0.132, -0.088],
      [0.236, 0.156, -0.16],
      [0.412, 0.184, -0.275],
      [0.548, 0.06, -0.302],
      [0.622, 0.004, -0.364],
    ],
    [
      [0.139, 0.139, -0.014],
      [0.284, 0.166, -0.032],
      [0.482, 0.183, -0.09],
      [0.583, 0.056, -0.051],
      [0.624, 0.004, 0.013],
    ],
    [
      [0.111, 0.139, 0.064],
      [0.26, 0.163, 0.116],
      [0.461, 0.181, 0.183],
      [0.571, 0.053, 0.232],
      [0.61, 0.004, 0.298],
    ],
  ];
  for (const side of [-1, 1]) {
    for (const [legIndex, path] of legPaths.entries()) {
      const points = path.map(([x, y, z]): Point => [x * side, y, z]);
      for (let joint = 0; joint < points.length - 1; joint++) {
        const start = points[joint];
        const end = points[joint + 1];
        const radius = [0.023, 0.021, 0.016, 0.009][joint];
        const name = `king-crab-leg-${side}-${legIndex}-${joint}`;
        rod(name, start, end, radius, joint === 3 ? horn : legShell, joint === 3 ? cone : segment);
        if (joint < 3) {
          mesh(`${name}-joint`, smallSphere, cream, start, [
            radius * 1.05,
            radius * 0.83,
            radius * 1.05,
          ]);
          const from = new THREE.Vector3(...start);
          const delta = new THREE.Vector3(...end).sub(from);
          for (let thorn = 1; thorn <= 4; thorn++) {
            const point = from.clone().addScaledVector(delta, thorn / 5);
            point.y += radius * 0.76;
            spine(
              point.toArray(),
              new THREE.Vector3(side * 0.2, 1, joint === 0 ? -0.1 : 0.1),
              0.012 - joint * 0.002,
              0.004,
            );
          }
          // A narrow darker upper ridge makes long leg segments readable at close zoom.
          const ridgeFrom = from.clone().addScaledVector(delta, 0.14);
          const ridgeTo = from.clone().addScaledVector(delta, 0.86);
          ridgeFrom.y += radius * 0.72;
          ridgeTo.y += radius * 0.62;
          rod(`${name}-ridge`, ridgeFrom.toArray(), ridgeTo.toArray(), radius * 0.25, shellRidge);
        }
      }
    }
  }

  // The animal's right claw (+X) is broader; both pincers curve inward at their tips.
  for (const side of [-1, 1]) {
    const strength = side === 1 ? 1.2 : 0.9;
    const shoulder: Point = [side * 0.088, 0.132, 0.095];
    const elbow: Point = [side * 0.176, 0.109, 0.19];
    const wrist: Point = [side * 0.18, 0.1, 0.258];
    rod(`king-crab-claw-${side}-upper`, shoulder, elbow, 0.023, legShell);
    rod(`king-crab-claw-${side}-forearm`, elbow, wrist, 0.026 * strength, shell);
    mesh(`king-crab-claw-${side}-joint`, smallSphere, cream, elbow, [0.025, 0.02, 0.025]);
    const palm = mesh(
      `king-crab-claw-${side}-palm`,
      ellipsoid,
      legShell,
      [side * 0.171, 0.097, 0.284],
      [0.037 * strength, 0.027 * strength, 0.05],
    );
    palm.rotation.y = side * 0.2;
    for (const jaw of [-1, 1]) {
      const base: Point = [side * 0.169 + jaw * 0.024 * strength, 0.096, 0.307];
      const bend: Point = [side * 0.162 + jaw * 0.029 * strength, 0.096, 0.343];
      const tip: Point = [side * 0.156 + jaw * 0.006, 0.096, 0.369];
      rod(`king-crab-claw-${side}-jaw-${jaw}`, base, bend, 0.013 * strength, cream);
      rod(`king-crab-claw-${side}-tip-${jaw}`, bend, tip, 0.01 * strength, horn, cone);
      for (let tooth = 0; tooth < 3; tooth++) {
        const z = 0.318 + tooth * 0.009;
        spine(
          [side * 0.165 + jaw * 0.021 * strength, 0.097, z],
          new THREE.Vector3(-jaw, 0.1, 0),
          0.006,
          0.003,
        );
      }
    }
    for (let thorn = 0; thorn < 6; thorn++) {
      spine(
        [
          side * (0.152 + (thorn % 2) * 0.023),
          0.123 * strength,
          0.255 + Math.floor(thorn / 2) * 0.021,
        ],
        new THREE.Vector3(side * 0.2, 1, 0.2),
        0.012,
        0.004,
      );
    }
  }

  // Frontal rostrum and eyestalks sit in front of the shell, above the mouthparts.
  rod('king-crab-rostrum', [0, 0.151, 0.113], [0, 0.168, 0.176], 0.018, shell, cone);
  for (const side of [-1, 1]) {
    const stalkEnd: Point = [side * 0.048, 0.17, 0.167];
    rod(`king-crab-eye-stalk-${side}`, [side * 0.026, 0.145, 0.122], stalkEnd, 0.007, cream);
    mesh(`king-crab-eye-${side}`, smallSphere, eye, stalkEnd, [0.009, 0.008, 0.009]);
    rod(
      `king-crab-antenna-${side}`,
      [side * 0.048, 0.129, 0.125],
      [side * 0.083, 0.129, 0.2],
      0.0027,
      horn,
    );
    mesh(
      `king-crab-mouthpart-${side}`,
      ellipsoid,
      cream,
      [side * 0.018, 0.106, 0.137],
      [0.014, 0.014, 0.025],
    );
  }

  const spines = new THREE.InstancedMesh(cone, shellRidge, spineTransforms.length);
  spines.name = 'king-crab-shell-and-leg-spines';
  spines.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  spineTransforms.forEach((transform, index) => spines.setMatrixAt(index, transform));
  spines.instanceMatrix.needsUpdate = true;
  spines.castShadow = true;
  spines.receiveShadow = true;
  spines.computeBoundingBox();
  spines.computeBoundingSphere();
  parts.add(spines);

  // Stable dimensions let the display cabinet place the whole animal without clipping.
  parts.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(parts, true);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  parts.scale.set(1.25 / size.x, 0.28 / size.y, 0.75 / size.z);
  parts.position.set(
    -center.x * parts.scale.x,
    -bounds.min.y * parts.scale.y,
    -center.z * parts.scale.z,
  );
  root.updateMatrixWorld(true);
  return root;
}
