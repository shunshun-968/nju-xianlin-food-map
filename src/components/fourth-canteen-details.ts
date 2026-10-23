import * as THREE from 'three';

/** Kitchen equipment and serving dishes in a single stall's local coordinates. */
export function addCounterDetails(parent: THREE.Group, width: number, variant: number): void {
  if (!Number.isFinite(width) || width <= 0) return;
  const seed = Number.isFinite(variant) ? Math.abs(Math.trunc(variant)) : 0;
  const details = new THREE.Group();
  details.name = `counter-details-${seed}`;
  parent.add(details);

  const steel = new THREE.MeshStandardMaterial({
    color: '#a8afac',
    roughness: 0.3,
    metalness: 0.25,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: '#737b78',
    roughness: 0.3,
    metalness: 0.25,
  });
  const ceramic = new THREE.MeshStandardMaterial({
    color: '#ede9db',
    roughness: 0.52,
    metalness: 0,
  });
  const appliance = new THREE.MeshStandardMaterial({
    color: '#d9d9cf',
    roughness: 0.43,
    metalness: 0.05,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: '#343b3b',
    roughness: 0.64,
    metalness: 0.06,
  });
  const screen = new THREE.MeshStandardMaterial({
    color: '#648881',
    roughness: 0.38,
    metalness: 0.02,
  });
  const displayDetail = new THREE.MeshStandardMaterial({
    color: '#c3d5c7',
    roughness: 0.5,
    metalness: 0,
  });
  const condimentRed = new THREE.MeshStandardMaterial({ color: '#a74332', roughness: 0.55 });
  const condimentYellow = new THREE.MeshStandardMaterial({ color: '#cba642', roughness: 0.55 });
  const condimentBrown = new THREE.MeshStandardMaterial({ color: '#70503a', roughness: 0.4 });
  const clothMaterial = new THREE.MeshStandardMaterial({ color: '#92a6a1', roughness: 1 });
  const foodMaterials = [
    new THREE.MeshStandardMaterial({ color: '#608348', roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: '#8b4a32', roughness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: '#e0b64d', roughness: 0.78 }),
    new THREE.MeshStandardMaterial({ color: '#e4d3a8', roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ color: '#b7763f', roughness: 0.72 }),
  ];
  const frontTop = 1.215;
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    destination: THREE.Group = details,
  ): THREE.Mesh {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    destination.add(result);
    return result;
  }

  function box(
    material: THREE.Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    destination: THREE.Group = details,
  ): THREE.Mesh {
    const result = mesh(boxGeometry, material, x, y, z, destination);
    result.scale.set(w, h, d);
    return result;
  }

  function cylinder(
    material: THREE.Material,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    destination: THREE.Group = details,
  ): THREE.Mesh {
    return mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 20),
      material,
      x,
      y,
      z,
      destination,
    );
  }

  const workingWidth = Math.max(width * 0.4, width - 0.3);
  const legInset = Math.min(0.13, workingWidth * 0.12);
  const legWidth = Math.min(0.045, workingWidth * 0.08);
  box(steel, workingWidth, 0.05, 0.7, 0, 1.025, -1.6);
  box(steel, workingWidth - legInset, 0.028, 0.58, 0, 0.24, -1.6);
  for (const x of [-(workingWidth / 2 - legInset), workingWidth / 2 - legInset]) {
    for (const z of [-1.87, -1.33]) {
      box(darkSteel, legWidth, 1, legWidth, x, 0.5, z);
    }
  }
  box(darkSteel, workingWidth, 0.075, 0.025, 0, 0.974, -1.245);
  // A shallow rear upstand belongs to the workbench, not the room wall.
  box(steel, workingWidth, 0.08, 0.022, 0, 1.08, -1.943);

  const equipment = new THREE.Group();
  equipment.name = ['steamer', 'stockpot', 'rice-cooker'][seed % 3];
  equipment.position.set(-width * 0.23, 1.05, -1.61);
  const equipmentScale = Math.min(1, width / 1.9);
  equipment.scale.setScalar(equipmentScale);
  details.add(equipment);

  function handle(x: number, y: number, z: number) {
    box(dark, 0.105, 0.035, 0.07, x, y, z, equipment);
  }

  if (seed % 3 === 0) {
    // Two stacked steaming baskets with narrow steel seams and a covered lid.
    cylinder(darkSteel, 0.215, 0.19, 0.035, 0, 0.018, 0, equipment);
    cylinder(steel, 0.225, 0.21, 0.16, 0, 0.115, 0, equipment);
    cylinder(steel, 0.225, 0.22, 0.16, 0, 0.28, 0, equipment);
    for (const y of [0.045, 0.195, 0.36]) {
      cylinder(darkSteel, 0.232, 0.232, 0.012, 0, y, 0, equipment);
    }
    cylinder(steel, 0.15, 0.232, 0.055, 0, 0.393, 0, equipment);
    cylinder(dark, 0.042, 0.042, 0.035, 0, 0.437, 0, equipment);
    for (const x of [-0.26, 0.26]) {
      handle(x, 0.13, 0);
      handle(x, 0.29, 0);
    }
  } else if (seed % 3 === 1) {
    box(dark, 0.54, 0.055, 0.48, 0, 0.028, 0, equipment);
    cylinder(darkSteel, 0.21, 0.21, 0.018, 0, 0.065, 0, equipment);
    cylinder(steel, 0.24, 0.205, 0.3, 0, 0.22, 0, equipment);
    cylinder(darkSteel, 0.245, 0.245, 0.015, 0, 0.372, 0, equipment);
    cylinder(steel, 0.16, 0.25, 0.045, 0, 0.4, 0, equipment);
    box(dark, 0.11, 0.045, 0.045, 0, 0.445, 0, equipment);
    for (const x of [-0.275, 0.275]) handle(x, 0.28, 0);
  } else {
    cylinder(dark, 0.21, 0.195, 0.03, 0, 0.015, 0, equipment);
    cylinder(appliance, 0.25, 0.21, 0.31, 0, 0.18, 0, equipment);
    cylinder(darkSteel, 0.25, 0.25, 0.025, 0, 0.345, 0, equipment);
    cylinder(appliance, 0.19, 0.25, 0.055, 0, 0.385, 0, equipment);
    box(dark, 0.14, 0.055, 0.06, 0, 0.429, 0, equipment);
    box(dark, 0.12, 0.085, 0.035, 0, 0.17, 0.235, equipment);
    box(screen, 0.065, 0.026, 0.007, 0, 0.183, 0.257, equipment);
    for (const x of [-0.27, 0.27]) handle(x, 0.24, 0);
  }

  const tablewareScale = Math.min(1, width / 1.6);
  const plateRadius = 0.17 * tablewareScale;
  const plateGeometry = new THREE.CylinderGeometry(plateRadius, plateRadius * 0.91, 0.022, 20);
  const stackX = width * 0.23;
  for (let index = 0; index < 8 + (seed % 5); index += 1) {
    mesh(plateGeometry, ceramic, stackX, 1.062 + index * 0.023, -1.73);
  }
  const bowlGeometry = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0.008),
      new THREE.Vector2(0.065, 0.008),
      new THREE.Vector2(0.105, 0.04),
      new THREE.Vector2(0.15, 0.13),
      new THREE.Vector2(0.14, 0.138),
      new THREE.Vector2(0.095, 0.048),
      new THREE.Vector2(0.06, 0.027),
      new THREE.Vector2(0, 0.027),
    ],
    20,
  );
  for (let index = 0; index < 2 + (seed % 2); index += 1) {
    const bowl = mesh(bowlGeometry, ceramic, stackX, 1.05 + index * 0.035, -1.41);
    bowl.scale.setScalar(tablewareScale);
  }

  // The serving dishes stop before the payment area on the right.
  const servingCount = 3 + (seed % 3);
  const servingSpan = width * 0.57;
  const servingCell = servingSpan / servingCount;
  const trayWidth = servingCell * 0.87;
  const trayDepth = 0.43;
  const foodGeometry = new THREE.SphereGeometry(1, 9, 6);
  const pieceTransform = new THREE.Object3D();
  const heatedDishes =
    width >= 2.5
      ? [Math.floor(servingCount * 0.25), Math.floor(servingCount * 0.75)]
      : [Math.floor(servingCount / 2)];
  // A small radial tint lies on the metal tray, without projecting a light cone.
  const glowSize = 32;
  const glowPixels = new Uint8Array(glowSize * glowSize * 4);
  for (let y = 0; y < glowSize; y += 1) {
    for (let x = 0; x < glowSize; x += 1) {
      const radius = Math.hypot(((x + 0.5) / glowSize) * 2 - 1, ((y + 0.5) / glowSize) * 2 - 1);
      const pixel = (y * glowSize + x) * 4;
      glowPixels[pixel] = glowPixels[pixel + 1] = glowPixels[pixel + 2] = 255;
      glowPixels[pixel + 3] = Math.round(Math.pow(Math.max(0, 1 - radius * radius), 2) * 255);
    }
  }
  const warmPoolTexture = new THREE.DataTexture(glowPixels, glowSize, glowSize);
  warmPoolTexture.minFilter = THREE.LinearFilter;
  warmPoolTexture.magFilter = THREE.LinearFilter;
  warmPoolTexture.needsUpdate = true;
  const warmPoolMaterial = new THREE.MeshBasicMaterial({
    color: '#ffc477',
    map: warmPoolTexture,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const warmPoolGeometry = new THREE.PlaneGeometry(1, 1);
  for (let index = 0; index < servingCount; index += 1) {
    const dish = new THREE.Group();
    dish.name = `serving-dish-${index + 1}`;
    dish.position.set(-width * 0.45 + servingCell * (index + 0.5), frontTop, 0.58);
    details.add(dish);
    const lip = Math.min(0.012, trayWidth * 0.06);
    box(steel, trayWidth, 0.018, trayDepth, 0, 0.009, 0, dish);
    box(darkSteel, trayWidth - lip * 2, 0.008, trayDepth - 0.034, 0, 0.023, 0, dish);
    for (const z of [-trayDepth / 2, trayDepth / 2]) {
      box(steel, trayWidth, 0.055, lip, 0, 0.041, z, dish);
      box(steel, trayWidth + lip, 0.008, lip * 1.8, 0, 0.072, z, dish);
    }
    for (const x of [-trayWidth / 2, trayWidth / 2]) {
      box(steel, lip, 0.055, trayDepth, x, 0.041, 0, dish);
      box(steel, lip * 1.8, 0.008, trayDepth, x, 0.072, 0, dish);
    }

    const foodType = (seed + index) % foodMaterials.length;
    const pieceCount = foodType === 3 ? 6 : 10;
    const foodMaterial = foodMaterials[foodType].clone();
    if (heatedDishes.includes(index)) {
      foodMaterial.emissive.set('#c58435');
      foodMaterial.emissiveIntensity = 0.17;
      const warmPool = mesh(warmPoolGeometry, warmPoolMaterial, 0, 0.028, 0, dish);
      warmPool.name = 'soft-tray-warmth';
      warmPool.rotation.x = -Math.PI / 2;
      warmPool.scale.set(trayWidth * 0.94, trayDepth * 0.94, 1);
      warmPool.castShadow = false;
      warmPool.receiveShadow = false;
    }
    const food = new THREE.InstancedMesh(foodGeometry, foodMaterial, pieceCount);
    food.name = 'simple-food-shapes';
    food.castShadow = true;
    food.receiveShadow = true;
    const usableWidth = trayWidth * 0.74;
    for (let piece = 0; piece < pieceCount; piece += 1) {
      const row = Math.floor(piece / 3);
      const column = piece % 3;
      const sx = Math.min(0.067, trayWidth * 0.115);
      const sy = foodType === 0 ? 0.025 : foodType === 3 ? 0.052 : 0.035;
      const sz = foodType === 0 ? 0.068 : 0.044;
      pieceTransform.position.set(
        (column - 1) * usableWidth * 0.32,
        0.027 + sy,
        -0.13 + row * 0.079 + ((piece + seed) % 2) * 0.009,
      );
      pieceTransform.rotation.set(0, ((piece * 7 + seed) % 9) * 0.15, 0);
      pieceTransform.scale.set(sx, sy, sz);
      pieceTransform.updateMatrix();
      food.setMatrixAt(piece, pieceTransform.matrix);
    }
    food.instanceMatrix.needsUpdate = true;
    dish.add(food);

    // A short serving spoon rests on the near rim; its bowl stays over the dish.
    const spoon = new THREE.Group();
    spoon.position.set(trayWidth * 0.24, 0.079, 0.08);
    spoon.rotation.y = (index % 2 === 0 ? 1 : -1) * 0.12;
    dish.add(spoon);
    const spoonHead = mesh(foodGeometry, steel, 0, 0.005, -0.035, spoon);
    spoonHead.scale.set(Math.min(0.033, trayWidth * 0.09), 0.009, 0.048);
    box(steel, Math.min(0.014, trayWidth * 0.04), 0.009, 0.155, 0, 0.005, 0.063, spoon);
  }

  const shadeMetal = new THREE.MeshStandardMaterial({
    color: '#bba990',
    roughness: 0.31,
    metalness: 0.4,
  });
  const warmReflector = new THREE.MeshStandardMaterial({
    color: '#ffe4b7',
    emissive: '#ffab4e',
    emissiveIntensity: 1.65,
    roughness: 0.35,
    metalness: 0.2,
    side: THREE.BackSide,
  });
  const warmBulb = new THREE.MeshBasicMaterial({ color: '#ffe7b2', toneMapped: false });
  const shadeGeometry = new THREE.CylinderGeometry(0.042, 0.125, 0.12, 24, 1, true);
  const shadeRimGeometry = new THREE.TorusGeometry(0.125, 0.006, 6, 24);
  const lampScale = Math.min(1, width / 1.3);
  for (const index of heatedDishes) {
    const heatLamp = new THREE.Group();
    heatLamp.name = 'counter-heat-lamp';
    heatLamp.position.set(-width * 0.45 + servingCell * (index + 0.5), frontTop, 0.255);
    heatLamp.scale.set(lampScale, 1, lampScale);
    details.add(heatLamp);
    // The foot and upright sit behind the trays, leaving their contents unobstructed.
    box(darkSteel, 0.11, 0.025, 0.1, 0, 0.0125, 0, heatLamp);
    cylinder(steel, 0.013, 0.013, 0.47, 0, 0.26, 0, heatLamp);
    box(steel, 0.026, 0.026, 0.315, 0, 0.495, 0.155, heatLamp);
    cylinder(darkSteel, 0.035, 0.035, 0.04, 0, 0.485, 0.31, heatLamp);
    mesh(shadeGeometry, shadeMetal, 0, 0.44, 0.31, heatLamp);
    const reflector = mesh(shadeGeometry, warmReflector, 0, 0.44, 0.31, heatLamp);
    reflector.scale.set(0.95, 0.97, 0.95);
    reflector.castShadow = false;
    const rim = mesh(shadeRimGeometry, shadeMetal, 0, 0.38, 0.31, heatLamp);
    rim.rotation.x = Math.PI / 2;
    const bulb = mesh(foodGeometry, warmBulb, 0, 0.391, 0.31, heatLamp);
    bulb.scale.set(0.041, 0.034, 0.041);
    bulb.castShadow = false;
    bulb.receiveShadow = false;
    const diffuser = mesh(new THREE.CircleGeometry(0.087, 24), warmBulb, 0, 0.386, 0.31, heatLamp);
    diffuser.rotation.x = Math.PI / 2;
    diffuser.castShadow = false;
    diffuser.receiveShadow = false;
    // A small soft aura around the exposed bulb makes the working lamp visible from the service side.
    const halo = mesh(
      new THREE.PlaneGeometry(0.25, 0.18),
      new THREE.MeshBasicMaterial({
        color: '#ffbf70',
        map: warmPoolTexture,
        transparent: true,
        opacity: 0.23,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      0,
      0.39,
      0.365,
      heatLamp,
    );
    halo.castShadow = false;
    halo.receiveShadow = false;
  }

  // Everyday preparation items remain on the back workbench.
  const condiments = new THREE.Group();
  condiments.name = 'condiment-bottles';
  condiments.position.set(0, 1.05, -1.66);
  condiments.scale.setScalar(Math.min(1, width / 2.8));
  details.add(condiments);
  const condimentMaterials =
    seed % 2 === 0
      ? [condimentRed, condimentYellow, condimentBrown]
      : [condimentBrown, condimentRed, condimentYellow];
  for (let index = 0; index < 3; index += 1) {
    const x = (index - 1) * 0.115;
    const bottleHeight = index === 0 ? 0.24 : 0.18;
    cylinder(
      condimentMaterials[index],
      0.041,
      0.046,
      bottleHeight,
      x,
      bottleHeight / 2,
      0,
      condiments,
    );
    cylinder(
      index === 2 ? dark : ceramic,
      0.023,
      0.034,
      0.035,
      x,
      bottleHeight + 0.0175,
      0,
      condiments,
    );
    cylinder(dark, 0.014, 0.019, 0.055, x, bottleHeight + 0.0625, 0, condiments);
  }

  const clothWidth = Math.min(0.25, width * 0.14);
  const cloth = box(clothMaterial, clothWidth, 0.018, 0.19, width * 0.32, frontTop + 0.009, 0.85);
  cloth.rotation.y = seed % 2 === 0 ? 0.1 : -0.1;
  box(clothMaterial, clothWidth * 0.82, 0.012, 0.16, width * 0.32, frontTop + 0.024, 0.845);

  // Light individual wisps rise above the covered hot pot, never a dense fog layer.
  const steamGeometry = new THREE.SphereGeometry(1, 10, 7);
  for (let index = 0; index < 3; index += 1) {
    const baseY = 1.05 + equipmentScale * (0.49 + index * 0.09);
    const steamMaterial = new THREE.MeshBasicMaterial({
      color: '#f5f2e9',
      transparent: true,
      opacity: 0.09 - index * 0.018,
      depthWrite: false,
    });
    const steam = mesh(
      steamGeometry,
      steamMaterial,
      equipment.position.x + equipmentScale * (index - 1) * 0.035,
      baseY,
      -1.61 + equipmentScale * (index % 2) * 0.025,
    );
    steam.name = 'subtle-pot-steam';
    steam.scale.set(0.04 + index * 0.012, 0.072 + index * 0.018, 0.035 + index * 0.01);
    steam.scale.multiplyScalar(equipmentScale);
    steam.castShadow = false;
    steam.receiveShadow = false;
    steam.userData = { steam: true, baseY, phase: seed * 0.71 + index * 1.8 };
  }

  const terminal = new THREE.Group();
  terminal.name = 'payment-terminal';
  terminal.position.set(width * 0.32, frontTop, 0.55);
  terminal.scale.setScalar(Math.min(1, width / 1.15));
  details.add(terminal);
  box(dark, 0.24, 0.025, 0.21, 0, 0.0125, 0, terminal);
  box(darkSteel, 0.065, 0.15, 0.055, 0, 0.09, -0.025, terminal);
  const display = new THREE.Group();
  display.position.set(0, 0.27, -0.015);
  display.rotation.x = -Math.PI / 14;
  terminal.add(display);
  box(dark, 0.235, 0.255, 0.045, 0, 0, 0, display);
  box(screen, 0.192, 0.19, 0.008, 0, 0.012, 0.026, display);
  // A few quiet UI shapes suggest a screen without inventing text or a brand.
  box(displayDetail, 0.108, 0.016, 0.003, -0.018, 0.064, 0.032, display);
  box(displayDetail, 0.071, 0.013, 0.003, -0.037, 0.026, 0.032, display);
  box(displayDetail, 0.056, 0.027, 0.003, 0.042, -0.047, 0.032, display);
}
