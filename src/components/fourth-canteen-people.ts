import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Quiet staff silhouettes, facing local +Z, with feet on the kitchen floor at y=.16. */
export function addCanteenStaff(
  parent: THREE.Group,
  x: number,
  z: number,
  variant: number,
  capColor = '#e5e3d7',
): void {
  if (![x, z].every(Number.isFinite)) return;
  const style = Number.isFinite(variant) ? Math.abs(Math.trunc(variant)) % 3 : 0;
  const staff = new THREE.Group();
  staff.name = `canteen-staff-${style}`;
  staff.position.set(x, 0, z);
  parent.add(staff);

  const cloth = new THREE.MeshStandardMaterial({
    color: ['#424d50', '#4c5351', '#48535e'][style],
    roughness: 0.94,
  });
  const trousers = new THREE.MeshStandardMaterial({ color: '#373d42', roughness: 0.94 });
  const apron = new THREE.MeshStandardMaterial({
    color: style === 1 ? '#354b58' : '#d2cbb6',
    roughness: 0.95,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: ['#cda98d', '#c6a086', '#d4b297'][style],
    roughness: 0.88,
  });
  const cap = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.94 });
  const shoes = new THREE.MeshStandardMaterial({ color: '#303638', roughness: 0.8 });
  const steel = new THREE.MeshStandardMaterial({
    color: '#a7b1aa',
    metalness: 0.32,
    roughness: 0.36,
  });
  const sphere = new THREE.SphereGeometry(1, 12, 10);

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: THREE.Vector3) {
    const result = new THREE.Mesh(geometry, material);
    result.position.copy(position);
    result.castShadow = true;
    result.receiveShadow = true;
    staff.add(result);
    return result;
  }
  function rounded(
    material: THREE.Material,
    px: number,
    py: number,
    pz: number,
    width: number,
    height: number,
    depth: number,
    radius = 0.015,
  ) {
    return mesh(
      new RoundedBoxGeometry(width, height, depth, 2, radius),
      material,
      new THREE.Vector3(px, py, pz),
    );
  }
  function ellipsoid(
    material: THREE.Material,
    px: number,
    py: number,
    pz: number,
    rx: number,
    ry: number,
    rz: number,
  ) {
    const result = mesh(sphere, material, new THREE.Vector3(px, py, pz));
    result.scale.set(rx, ry, rz);
    return result;
  }
  function limb(material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
    const direction = to.clone().sub(from);
    const result = mesh(
      new THREE.CapsuleGeometry(radius, direction.length(), 4, 8),
      material,
      from.clone().add(to).multiplyScalar(0.5),
    );
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return result;
  }

  // Shoes touch y=.16 exactly; a small stagger keeps the stance relaxed.
  for (const side of [-1, 1]) {
    const footZ = side === 1 ? 0.03 : -0.015;
    rounded(shoes, side * 0.09, 0.21, footZ, 0.12, 0.1, 0.22, 0.018);
    limb(
      trousers,
      new THREE.Vector3(side * 0.085, 0.92, -0.012),
      new THREE.Vector3(side * 0.09, 0.29, footZ - 0.015),
      0.062,
    );
  }
  rounded(trousers, 0, 0.95, -0.015, 0.29, 0.18, 0.19, 0.03);
  rounded(cloth, 0, 1.205, -0.015, 0.36, 0.48, 0.2, 0.065);
  rounded(apron, 0, 1.225, 0.091, 0.24, 0.35, 0.025, 0.014);
  rounded(apron, 0, 0.985, 0.096, 0.29, 0.26, 0.035, 0.014);
  for (const side of [-1, 1]) {
    rounded(apron, side * 0.102, 1.405, 0.073, 0.024, 0.115, 0.025, 0.009);
  }

  limb(skin, new THREE.Vector3(0, 1.445, 0), new THREE.Vector3(0, 1.49, 0.012), 0.035);
  const head = ellipsoid(skin, 0, 1.61, 0.012, 0.1, 0.135, 0.092);
  head.rotation.z = style === 1 ? 0.035 : -0.025;
  ellipsoid(cap, 0, 1.755, 0.009, 0.112, 0.055, 0.104);
  rounded(cap, 0, 1.718, 0.015, 0.206, 0.04, 0.179, 0.012);
  rounded(cap, 0, 1.713, 0.091, 0.203, 0.022, 0.09, 0.01);

  // Both elbows bend forward. The serving pose raises one hand slightly instead of a T-pose.
  const ladlePose = style === 1;
  for (const side of [-1, 1]) {
    const servingHand = ladlePose && side === 1;
    const shoulder = new THREE.Vector3(side * 0.17, 1.365, -0.015);
    const elbow = new THREE.Vector3(side * 0.205, servingHand ? 1.2 : 1.155, 0.047);
    const wrist = new THREE.Vector3(side * 0.125, servingHand ? 1.18 : 1.09, 0.167);
    limb(cloth, shoulder, elbow, 0.054);
    limb(cloth, elbow, wrist, 0.043);
    ellipsoid(skin, wrist.x, wrist.y - 0.005, wrist.z + 0.012, 0.037, 0.045, 0.039);
  }
  if (ladlePose) {
    limb(
      steel,
      new THREE.Vector3(0.126, 1.21, 0.182),
      new THREE.Vector3(0.033, 0.98, 0.205),
      0.009,
    );
    ellipsoid(steel, 0.029, 0.959, 0.205, 0.035, 0.02, 0.044);
  } else {
    rounded(steel, 0, 1.045, 0.139, 0.32, 0.024, 0.2, 0.012);
    rounded(steel, 0, 1.063, 0.045, 0.31, 0.025, 0.016, 0.007);
    rounded(steel, 0, 1.063, 0.231, 0.31, 0.025, 0.016, 0.007);
  }
}
