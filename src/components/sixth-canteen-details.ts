import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addCanteenStaff } from './fourth-canteen-people';

/** Sixth-canteen hardware only. Food, cookware and staff remain owned by the shared model. */
export function addSixthCanteenDetails(
  parent: THREE.Group,
  width: number,
  options: { enclosed?: boolean; pickup?: boolean; returnCounter?: boolean } = {},
): void {
  if (!Number.isFinite(width) || width <= 0) return;
  const details = new THREE.Group();
  details.name = 'sixth-canteen-hardware';
  parent.add(details);

  const steel = new THREE.MeshStandardMaterial({
    color: '#bbc1b9',
    metalness: 0.52,
    roughness: 0.34,
  });
  const brushedSteel = new THREE.MeshStandardMaterial({
    color: '#aeb4a9',
    metalness: 0.46,
    roughness: 0.43,
  });
  const filterMaterial = new THREE.MeshStandardMaterial({
    color: '#414b44',
    metalness: 0.25,
    roughness: 0.6,
  });
  const fixtureMaterial = new THREE.MeshStandardMaterial({
    color: '#e6e6dc',
    metalness: 0.1,
    roughness: 0.48,
  });
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd78a',
    emissive: '#ffc052',
    emissiveIntensity: 1.7,
    roughness: 0.36,
  });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    owner: THREE.Group = details,
  ) {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    owner.add(result);
    return result;
  }
  function box(
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    owner: THREE.Group = details,
  ) {
    const result = mesh(unitBox, material, x, y, z, owner);
    result.scale.set(w, h, d);
    return result;
  }
  function rod(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    material: THREE.Material,
    owner: THREE.Group = details,
  ) {
    const direction = to.clone().sub(from);
    const center = from.clone().add(to).multiplyScalar(0.5);
    const result = mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
      material,
      center.x,
      center.y,
      center.z,
      owner,
    );
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return result;
  }
  function suspendedLight(x: number, span: number) {
    const fixture = new THREE.Group();
    fixture.name = 'sixth-suspended-line-light';
    fixture.position.x = x;
    details.add(fixture);
    const length = Math.min(1.5, span * 0.63);
    mesh(
      new RoundedBoxGeometry(length, 0.055, 0.065, 2, 0.01),
      fixtureMaterial,
      0,
      2.4,
      -0.35,
      fixture,
    );
    const lens = box(lensMaterial, 0, 2.369, -0.35, length * 0.95, 0.012, 0.046, fixture);
    lens.castShadow = false;
    for (const side of [-1, 1]) {
      const wireX = side * length * 0.36;
      rod(
        new THREE.Vector3(wireX, 2.43, -0.35),
        new THREE.Vector3(wireX, 2.89, -0.35),
        0.0045,
        brushedSteel,
        fixture,
      );
    }
  }

  // The pickup passage stays clear: no glass barrier, canopy or extra equipment.
  if (options.pickup) {
    suspendedLight(0, width);
    return;
  }

  const bayCount = Math.max(1, Math.ceil(width / 3.5));
  const bayWidth = width / bayCount;
  if (!options.enclosed) {
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#c4d5cc',
      metalness: 0.02,
      roughness: 0.1,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const bottomY = 1.23,
      topY = 1.72,
      bottomZ = 0.99,
      topZ = 0.55;
    const slopeLength = Math.hypot(topY - bottomY, topZ - bottomZ);
    const slope = Math.atan2(topZ - bottomZ, topY - bottomY);
    const edgeInset = Math.min(0.07, bayWidth * 0.06);
    for (let index = 0; index < bayCount; index++) {
      const x = -width / 2 + bayWidth * (index + 0.5);
      const pane = mesh(
        new THREE.BoxGeometry(bayWidth - edgeInset * 2, slopeLength, 0.013),
        glass,
        x,
        (bottomY + topY) / 2,
        (bottomZ + topZ) / 2,
      );
      pane.name = `sixth-sloping-glass-${index + 1}`;
      pane.rotation.x = slope;
      pane.castShadow = false;
      box(steel, x, topY, topZ, bayWidth - edgeInset * 2, 0.026, 0.027);
    }
    for (let index = 0; index <= bayCount; index++) {
      const x =
        -width / 2 +
        index * bayWidth +
        (index === 0 ? edgeInset : index === bayCount ? -edgeInset : 0);
      rod(new THREE.Vector3(x, bottomY, bottomZ), new THREE.Vector3(x, topY, topZ), 0.013, steel);
      box(steel, x, 1.223, bottomZ, 0.065, 0.025, 0.095);
    }
  }

  if (options.returnCounter) {
    suspendedLight(0, width);
    return;
  }
  for (let index = 0; index < bayCount; index++) {
    const x = -width / 2 + bayWidth * (index + 0.5);
    const hood = new THREE.Group();
    hood.name = `sixth-extractor-hood-${index + 1}`;
    hood.position.set(x, 0, -1.55);
    details.add(hood);
    const hoodWidth = bayWidth * 0.9;
    const shell = new THREE.BoxGeometry(hoodWidth, 0.43, 1.2);
    const vertices = shell.getAttribute('position');
    // A shallower upper section gives the canopy a broad catching lip and angled steel fascia.
    for (let vertex = 0; vertex < vertices.count; vertex++) {
      if (vertices.getY(vertex) > 0) {
        vertices.setX(vertex, vertices.getX(vertex) * 0.97);
        vertices.setZ(vertex, vertices.getZ(vertex) * 0.7);
      }
    }
    vertices.needsUpdate = true;
    shell.computeVertexNormals();
    mesh(shell, brushedSteel, 0, 2.435, 0, hood); // Bottom 2.22, top 2.65.
    box(steel, 0, 2.23, 0.595, hoodWidth, 0.032, 0.027, hood);
    box(filterMaterial, 0, 2.215, -0.015, hoodWidth * 0.92, 0.018, 0.97, hood);
    for (let strip = 0; strip < 6; strip++) {
      box(steel, 0, 2.201, -0.41 + strip * 0.16, hoodWidth * 0.91, 0.018, 0.022, hood);
    }
    const vent = box(filterMaterial, 0, 2.305, 0.535, hoodWidth * 0.88, 0.055, 0.018, hood);
    vent.rotation.x = -0.39;
    suspendedLight(x, bayWidth);
  }
}

/** Furniture inside the long 金陵 kitchen; the outer walls and pickup opening belong to the model. */
export function addJinlingKitchen(
  parent: THREE.Group,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): void {
  if (!Object.values(bounds).every(Number.isFinite)) return;
  const roomWidth = bounds.maxX - bounds.minX;
  if (roomWidth < 2 || bounds.maxZ - bounds.minZ < 5) return;
  const kitchen = new THREE.Group();
  kitchen.name = 'jinling-interior-furniture';
  parent.add(kitchen);
  const steel = new THREE.MeshStandardMaterial({
    color: '#b1b9b1',
    metalness: 0.42,
    roughness: 0.37,
  });
  const frame = new THREE.MeshStandardMaterial({
    color: '#77847b',
    metalness: 0.36,
    roughness: 0.46,
  });
  const ceramic = new THREE.MeshStandardMaterial({ color: '#e4e0d1', roughness: 0.62 });
  const dark = new THREE.MeshStandardMaterial({ color: '#414a44', roughness: 0.66 });
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function box(
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const object = new THREE.Mesh(cube, material);
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    object.castShadow = true;
    object.receiveShadow = true;
    kitchen.add(object);
    return object;
  }
  function cylinder(
    material: THREE.Material,
    radius: number,
    height: number,
    x: number,
    y: number,
    z: number,
  ) {
    const object = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.96, height, 16),
      material,
    );
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    kitchen.add(object);
    return object;
  }
  function bench(x: number, z: number, w: number, d: number) {
    const top = box(steel, x, 1.025, z, w, 0.055, d);
    top.name = 'jinling-workbench';
    box(steel, x, 0.34, z, w - 0.13, 0.028, d - 0.13);
    for (const sideX of [-1, 1]) {
      for (const sideZ of [-1, 1]) {
        box(
          frame,
          x + sideX * (w / 2 - 0.065),
          0.595,
          z + sideZ * (d / 2 - 0.065),
          0.04,
          0.87,
          0.04,
        );
      }
    }
    box(frame, x, 0.93, z + d / 2 - 0.045, w - 0.08, 0.075, 0.025);
  }
  function plateStack(x: number, baseY: number, z: number, count: number) {
    for (let plate = 0; plate < count; plate++)
      cylinder(ceramic, 0.17, 0.022, x, baseY + 0.011 + plate * 0.024, z);
  }
  function pot(x: number, z: number, radius = 0.2) {
    cylinder(frame, radius * 0.91, 0.03, x, 1.069, z);
    cylinder(steel, radius, 0.27, x, 1.217, z);
    cylinder(steel, radius * 1.04, 0.027, x, 1.365, z);
    box(dark, x, 1.393, z, 0.1, 0.032, 0.04);
    for (const side of [-1, 1])
      box(dark, x + side * (radius + 0.035), 1.235, z, 0.08, 0.028, 0.055);
  }

  // Keep the broad route from the left pickup at z=-4.5 clear of furniture.
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const rearZ = bounds.minZ + 0.65;
  bench(centerX, rearZ, roomWidth - 0.9, 0.7);
  box(steel, centerX, 1.105, rearZ - 0.335, roomWidth - 0.9, 0.12, 0.025);
  pot(centerX - 0.75, rearZ, 0.2);
  pot(centerX + 0.05, rearZ + 0.01, 0.17);
  plateStack(centerX + 1.05, 1.053, rearZ, 6);

  const rightX = bounds.maxX - 0.55;
  bench(rightX, -1.45, 0.7, 2.1);
  bench(rightX, Math.min(1, bounds.maxZ - 1.1), 0.7, 1.6);
  plateStack(rightX, 1.053, -2.12, 5);
  plateStack(rightX, 1.053, 1.28, 4);

  // An open rear-left rack stops before the pickup corridor and does not become a wall.
  const rackX = bounds.minX + 0.63;
  const rackZ = bounds.minZ + 1.6;
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      box(frame, rackX + sideX * 0.29, 1.15, rackZ + sideZ * 0.48, 0.033, 1.98, 0.033);
    }
  }
  for (const y of [0.39, 1.08, 1.78]) box(steel, rackX, y, rackZ, 0.63, 0.035, 1.04);
  plateStack(rackX, 1.098, rackZ - 0.22, 5);
  plateStack(rackX, 1.798, rackZ + 0.21, 4);
  cylinder(steel, 0.18, 0.24, rackX, 0.527, rackZ + 0.18);

  const staff = new THREE.Group();
  staff.name = 'jinling-kitchen-staff';
  staff.position.set(bounds.maxX - 1.2, 0, -1.45);
  staff.rotation.y = Math.PI / 2;
  kitchen.add(staff);
  addCanteenStaff(staff, 0, 0, 1);
}
