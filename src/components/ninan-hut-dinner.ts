import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { batchModel } from '../lib/model-batches';

/** Local X is the width; +Z is the customer-facing side. All dimensions are photo estimates. */
function fixtureTools() {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string, roughness = 0.65, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!materials.has(key))
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return materials.get(key)!;
  }
  function group(parent: THREE.Object3D, name: string) {
    const child = new THREE.Group();
    child.name = name;
    parent.add(child);
    return child;
  }
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const child = new THREE.Mesh(geometry, mat);
    child.position.set(x, y, z);
    child.castShadow = !mat.transparent;
    child.receiveShadow = true;
    parent.add(child);
    return child;
  }
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    radius = 0,
  ) {
    return mesh(
      parent,
      radius ? new RoundedBoxGeometry(w, h, d, 1, radius) : new THREE.BoxGeometry(w, h, d),
      mat,
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
    mat: THREE.Material,
    top = radius,
  ) {
    return mesh(parent, new THREE.CylinderGeometry(top, radius, height, 10), mat, x, y, z);
  }
  function round(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    size: number,
    mat: THREE.Material,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const child = mesh(parent, new THREE.SphereGeometry(size, 8, 6), mat, x, y, z);
    child.scale.set(sx, sy, sz);
    return child;
  }
  function rod(
    parent: THREE.Object3D,
    from: readonly number[],
    to: readonly number[],
    radius: number,
    mat: THREE.Material,
  ) {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to);
    const child = cylinder(parent, 0, 0, 0, radius, a.distanceTo(b), mat);
    child.position.copy(a).add(b).multiplyScalar(0.5);
    child.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return child;
  }
  // Keep named fixture sections intact while merging their many small food/vent pieces.
  function batch(section: THREE.Group) {
    const details = new THREE.Group();
    for (const child of [...section.children]) details.add(child);
    section.add(details);
    batchModel(section);
  }
  return { material, group, mesh, box, cylinder, round, rod, batch };
}

/** Photo 10: black-framed, two-door ingredient fridge with a glazed side and five lit rows. */
export function createNinanIngredientCabinet() {
  const { material, group, mesh, box, cylinder, round, rod, batch } = fixtureTools();
  const cabinet = new THREE.Group();
  cabinet.name = 'ninan-ingredient-cabinet';
  const shell = group(cabinet, 'ninan-ingredient-cabinet-shell');
  const shelves = group(cabinet, 'ninan-ingredient-cabinet-shelves');
  const food = group(cabinet, 'ninan-ingredient-cabinet-food');
  const glazing = group(cabinet, 'ninan-ingredient-cabinet-glass');
  const lamps = group(cabinet, 'ninan-ingredient-cabinet-lamps');
  const charcoal = material('#242927', 0.4, 0.55);
  const silver = material('#adb5ad', 0.3, 0.72);
  const lining = material('#b9b59c', 0.47, 0.4);
  const warmLining = new THREE.MeshStandardMaterial({
    color: '#d8c7a0',
    roughness: 0.6,
    metalness: 0.18,
    emissive: '#efc877',
    emissiveIntensity: 0.14,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: '#d1e0d2',
    roughness: 0.16,
    metalness: 0.05,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const strip = new THREE.MeshStandardMaterial({
    color: '#fff0be',
    emissive: '#ffdc88',
    emissiveIntensity: 1.0,
    roughness: 0.55,
  });

  // Small castors and the silver vented refrigeration base remain below the display rows.
  for (const x of [-0.92, 0.92])
    for (const z of [-0.23, 0.23]) {
      const wheel = cylinder(shell, x, 0.065, z, 0.06, 0.055, charcoal);
      wheel.rotation.z = Math.PI / 2;
      box(shell, x, 0.115, z, 0.075, 0.06, 0.075, silver);
    }
  box(shell, 0, 0.265, 0, 2.2, 0.29, 0.68, silver);
  box(shell, 0, 0.105, 0, 2.2, 0.06, 0.68, charcoal);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 13; col++)
      box(shell, -0.99 + col * 0.032, 0.2 + row * 0.034, 0.343, 0.017, 0.012, 0.004, charcoal);
  box(shell, -0.76, 0.28, 0.348, 0.13, 0.07, 0.012, charcoal);
  box(shell, -0.76, 0.28, 0.356, 0.08, 0.025, 0.004, material('#789a66'));
  box(shell, 0, 1.32, -0.325, 2.14, 1.78, 0.035, warmLining);
  for (let i = 0; i < 49; i++)
    box(shell, -1.03 + i * 0.043, 1.32, -0.3, 0.013, 1.76, 0.018, lining);
  box(shell, 0, 2.215, 0, 2.2, 0.07, 0.68, charcoal);
  for (const x of [-1.075, 1.075])
    for (const z of [-0.315, 0.315]) box(shell, x, 1.31, z, 0.05, 1.83, 0.05, charcoal);
  box(shell, 0, 0.43, 0.315, 2.2, 0.05, 0.05, charcoal);
  // Two sliding front doors, with a separate right/left glass side panel.
  box(shell, -0.18, 1.32, 0.325, 0.048, 1.76, 0.045, charcoal);
  box(shell, 0.04, 1.32, 0.345, 0.045, 1.76, 0.045, charcoal);
  for (const x of [-0.13, 0.09]) rod(shell, [x, 1.05, 0.38], [x, 1.45, 0.38], 0.015, silver);
  box(glazing, -0.61, 1.32, 0.33, 0.88, 1.73, 0.008, glass);
  box(glazing, 0.54, 1.32, 0.35, 0.98, 1.73, 0.008, glass);
  for (const x of [-1.075, 1.075]) box(glazing, x, 1.32, 0, 0.008, 1.75, 0.57, glass);

  const cream = material('#eee6c8'),
    trayMetal = material('#c8c6b1', 0.35, 0.55);
  const bamboo = material('#bd9b62');
  const foods = [
    material('#be6b4f'),
    material('#d4a76b'),
    material('#e4d4a4'),
    material('#b25749'),
    material('#557e3f'),
    material('#91a350'),
  ];
  const rowHeights = [0.46, 0.8, 1.14, 1.48, 1.82];
  rowHeights.forEach((y, level) => {
    box(shelves, 0, y, 0, 2.09, 0.028, 0.59, trayMetal);
    box(shelves, 0, y + 0.028, 0.29, 2.08, 0.035, 0.018, silver);
    box(lamps, 0, y + 0.29, -0.02, 2.04, 0.018, 0.038, strip);
    for (let column = 0; column < 6; column++) {
      const x = -0.87 + column * 0.348;
      const greenBasket = level === 0 || (level === 4 && column < 2);
      const tray = greenBasket ? cream : trayMetal;
      const height = greenBasket ? 0.09 : 0.045;
      box(food, x, y + 0.035, 0.005, 0.31, 0.025, 0.43, tray, 0.012);
      for (const side of [-1, 1]) {
        box(food, x + side * 0.147, y + height / 2 + 0.04, 0.005, 0.018, height, 0.43, tray);
        box(food, x, y + height / 2 + 0.04, 0.005 + side * 0.205, 0.31, height, 0.018, tray);
      }
      if (greenBasket) {
        // Green leaves, mushrooms and pale vegetables are visible in the bottom baskets.
        for (let item = 0; item < 8; item++) {
          const xx = x - 0.09 + (item % 3) * 0.085,
            zz = -0.12 + Math.floor(item / 3) * 0.105;
          if (column % 3 === 0) {
            rod(food, [xx, y + 0.08, zz], [xx + 0.035, y + 0.16, zz + 0.04], 0.011, cream);
            round(food, xx + 0.035, y + 0.175, zz + 0.04, 0.035, foods[2], 1, 0.5, 1);
          } else {
            const leaf = mesh(
              food,
              new THREE.IcosahedronGeometry(0.04, 0),
              foods[4 + (column % 2)],
              xx,
              y + 0.1 + (item % 2) * 0.035,
              zz,
            );
            leaf.scale.set(0.9, 0.45, 1.6);
          }
        }
      } else {
        for (let item = 0; item < 4; item++) {
          const xx = x - 0.1 + item * 0.065;
          rod(food, [xx, y + 0.075, -0.16], [xx, y + 0.075, 0.23], 0.005, bamboo);
          for (let bite = 0; bite < 3; bite++) {
            const zz = -0.1 + bite * 0.078;
            const piece = box(
              food,
              xx,
              y + 0.09,
              zz,
              0.052,
              0.04,
              0.066,
              foods[(column + level) % 4],
              0.012,
            );
            piece.rotation.y = (item % 2 ? 1 : -1) * 0.14;
          }
        }
      }
    }
  });
  const light = new THREE.PointLight('#ffdda0', 1.4, 2.5, 2);
  light.position.set(0, 1.25, 0.51);
  lamps.add(light);
  for (const section of [shell, shelves, food, glazing, lamps]) batch(section);
  return {
    group: cabinet,
    setNight(night: boolean) {
      strip.emissiveIntensity = night ? 1.7 : 1;
      warmLining.emissiveIntensity = night ? 0.34 : 0.14;
      light.intensity = night ? 3.2 : 1.4;
    },
  };
}

/** Photo 11/13: use the original broad silver cart; only its cooking top is added here. */
export function createNinanBarbecueTop() {
  const { material, group, box, cylinder, round, rod, batch } = fixtureTools();
  const grill = new THREE.Group();
  grill.name = 'ninan-barbecue-top';
  const shell = group(grill, 'ninan-barbecue-basin');
  const grate = group(grill, 'ninan-barbecue-grate');
  const food = group(grill, 'ninan-barbecue-skewers');
  const utensils = group(grill, 'ninan-barbecue-utensils');
  const steel = material('#a6adaa', 0.28, 0.8),
    dark = material('#34342d', 0.72, 0.45);
  const bamboo = material('#c8a269'),
    cooked = material('#b87a40');
  // Coordinates match the existing cart top: centre(-.42,1.2,.35), width2.43, depth.83.
  // Staff work from -Z; the +Z stainless customer shield is retained.
  box(shell, -0.42, 1.25, 0.14, 1.96, 0.06, 0.45, dark);
  for (const x of [-1.42, 0.58]) box(shell, x, 1.32, 0.16, 0.035, 0.19, 0.53, steel);
  box(shell, -0.42, 1.31, -0.1, 2.02, 0.18, 0.035, steel);
  box(shell, -0.46, 1.43, 0.73, 2.22, 0.4, 0.035, steel);
  box(shell, -0.46, 1.635, 0.73, 2.26, 0.028, 0.065, steel);
  // Leave a gap to the retained warmer, whose left frame begins at local X=.72.
  for (const x of [-1.56, 0.65]) box(shell, x, 1.42, 0.49, 0.035, 0.38, 0.47, steel);
  for (let i = 0; i < 35; i++)
    rod(grate, [-1.35 + i * 0.055, 1.315, -0.05], [-1.35 + i * 0.055, 1.315, 0.34], 0.007, dark);
  for (const z of [0.03, 0.27]) rod(grate, [-1.36, 1.303, z], [0.53, 1.303, z], 0.013, steel);
  for (let i = 0; i < 10; i++) {
    const x = -1.25 + i * 0.17;
    rod(food, [x, 1.34, -0.23], [x, 1.34, 0.3], 0.006, bamboo);
    for (let bite = 0; bite < 3; bite++) {
      const piece = box(food, x, 1.365, -0.01 + bite * 0.092, 0.095, 0.055, 0.073, cooked, 0.018);
      piece.rotation.y = (i % 2 ? 1 : -1) * 0.16;
    }
  }
  // Small metal seasoning pots and the stacked square plates seen beside the work opening.
  for (const x of [-1.1, -0.72]) {
    cylinder(utensils, x, 1.34, 0.52, 0.13, 0.21, steel);
    cylinder(utensils, x, 1.448, 0.52, 0.12, 0.005, material('#6d5034'));
    rod(utensils, [x, 1.44, 0.52], [x + 0.07, 1.66, 0.49], 0.009, steel);
  }
  for (let i = 0; i < 5; i++)
    box(utensils, 0.23, 1.255 + i * 0.023, 0.52, 0.42, 0.018, 0.29, material('#e5e2d2'), 0.015);
  round(utensils, -0.25, 1.275, 0.54, 0.085, steel, 1, 0.28, 1);
  rod(utensils, [-0.25, 1.29, 0.53], [-0.34, 1.45, 0.47], 0.009, steel);
  for (const section of [shell, grate, food, utensils]) batch(section);
  return grill;
}
