import * as THREE from 'three';

/** Photographed counter equipment, in one opening's local coordinates (front is +Z).
 * Foods are small geometric set dressing, not an asserted menu or price list.
 */
export function addTwelfthEquipment(
  parent: THREE.Group,
  windowNumber: number,
  width: number,
): { tick: (time: number) => void } {
  const group = new THREE.Group();
  group.name = `twelfth-equipment-${windowNumber}`;
  parent.add(group);
  const safeWidth = Math.max(1.6, Math.min(width - 0.12, 3.6));
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 10, 7);
  function mat(color: string, metalness = 0, roughness = 0.62) {
    const key = `${color}/${metalness}/${roughness}`;
    if (!materials.has(key))
      materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return materials.get(key)!;
  }
  const steel = mat('#b8beb9', 0.55, 0.35);
  const darkSteel = mat('#626d69', 0.5, 0.38);
  const black = mat('#252d2c', 0.08, 0.58);
  const ceramic = mat('#f0e7d7', 0, 0.32);
  const rice = mat('#e7dbc1');
  const greens = mat('#608441');
  const meat = mat('#a45c30');
  const golden = mat('#cf963c');
  const steam: { mesh: THREE.Mesh; x: number; z: number; y: number; phase: number }[] = [];
  function item(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    name?: string,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name;
    group.add(mesh);
    return mesh;
  }
  function box(x: number, y: number, z: number, w: number, h: number, d: number, material = steel) {
    const mesh = item(unitBox, material, x, y, z);
    mesh.scale.set(w, h, d);
    return mesh;
  }
  function cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    material: THREE.Material = steel,
  ) {
    return item(new THREE.CylinderGeometry(r, r, h, 16), material, x, y, z);
  }
  function ellipsoid(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    material: THREE.Material,
  ) {
    const mesh = item(sphere, material, x, y, z);
    mesh.scale.set(rx, ry, rz);
    return mesh;
  }
  function rod(
    a: [number, number, number],
    b: [number, number, number],
    radius = 0.016,
    material = steel,
  ) {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b);
    const mesh = item(
      new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 8),
      material,
      0,
      0,
      0,
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    return mesh;
  }
  function rim(x: number, y: number, z: number, r: number, material = steel) {
    const ring = item(new THREE.TorusGeometry(r, 0.012, 5, 20), material, x, y, z);
    ring.rotation.x = Math.PI / 2;
  }
  function bowl(x: number, y: number, z: number, r = 0.16, food = true, color = ceramic) {
    item(new THREE.CylinderGeometry(r, r * 0.55, r * 0.62, 16), color, x, y + r * 0.31, z);
    cylinder(x, y + r * 0.63, z, r * 0.86, 0.009, food ? rice : darkSteel);
    rim(x, y + r * 0.63, z, r, color);
    if (food) {
      for (let i = 0; i < 5; i++) {
        const angle = i * 2.4;
        ellipsoid(
          x + Math.cos(angle) * r * 0.43,
          y + r * 0.71,
          z + Math.sin(angle) * r * 0.43,
          r * 0.18,
          r * 0.1,
          r * 0.27,
          i % 2 ? greens : meat,
        );
      }
    }
  }
  function bowlStack(x: number, z: number, count = 6) {
    for (let i = 0; i < count; i++) bowl(x, 1.22 + i * 0.042, z, 0.17, false);
  }
  function pot(x: number, z: number, r = 0.27, base = 1.22, lid = false) {
    const h = r * 1.35;
    cylinder(x, base + h / 2, z, r, h);
    rim(x, base + h, z, r);
    if (lid) {
      ellipsoid(x, base + h + 0.012, z, r, 0.045, r, steel);
      box(x, base + h + 0.065, z, 0.13, 0.035, 0.045, black);
    } else {
      cylinder(x, base + h - 0.015, z, r * 0.93, 0.012, mat('#b49b6c'));
      for (let i = 0; i < 5; i++)
        ellipsoid(
          x + Math.sin(i * 2) * r * 0.5,
          base + h,
          z + Math.cos(i * 2) * r * 0.5,
          0.03,
          0.012,
          0.045,
          greens,
        );
      rod([x + r * 0.4, base + h - 0.03, z], [x + r * 0.7, base + h + 0.28, z - 0.12], 0.013);
    }
    for (const side of [-1, 1])
      box(x + side * (r + 0.035), base + h * 0.7, z, 0.09, 0.055, 0.13, black);
    return base + h;
  }
  function vapor(x: number, z: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#fff4df',
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
      });
      const puff = ellipsoid(x, y, z, 0.08, 0.13, 0.075, material);
      puff.name = 'twelfth-cooking-steam';
      puff.userData.steam = true;
      puff.castShadow = puff.receiveShadow = false;
      steam.push({ mesh: puff, x, z, y, phase: i / 3 });
    }
  }
  function tray(x: number, z: number, w = 0.6, d = 0.42, fried = false) {
    box(x, 1.25, z, w, 0.065, d, darkSteel);
    box(x, 1.287, z, w - 0.045, 0.012, d - 0.045, steel);
    for (let i = 0; i < 8; i++) {
      const xx = x + ((i % 4) - 1.5) * w * 0.2;
      const zz = z + (Math.floor(i / 4) - 0.5) * d * 0.38;
      const nugget = ellipsoid(
        xx,
        1.335,
        zz,
        w * 0.09,
        0.045,
        d * 0.16,
        fried ? golden : i % 3 ? meat : greens,
      );
      nugget.rotation.y = i * 1.1;
    }
  }
  function casserole(x: number, z: number, y = 1.22, open = false) {
    const clay = mat('#383b32', 0, 0.65);
    cylinder(x, y + 0.1, z, 0.23, 0.2, clay);
    rim(x, y + 0.2, z, 0.23, black);
    for (const side of [-1, 1]) box(x + side * 0.25, y + 0.14, z, 0.12, 0.05, 0.08, clay);
    if (open) {
      cylinder(x, y + 0.19, z, 0.21, 0.01, meat);
      for (let i = 0; i < 7; i++)
        ellipsoid(
          x + Math.sin(i * 2) * 0.13,
          y + 0.22,
          z + Math.cos(i * 2) * 0.13,
          0.05,
          0.035,
          0.055,
          i % 3 ? meat : greens,
        );
      vapor(x, z, y + 0.28);
    } else {
      ellipsoid(x, y + 0.21, z, 0.23, 0.07, 0.23, clay);
      cylinder(x, y + 0.29, z, 0.045, 0.055, black);
    }
  }

  // Stainless preparation bench at the back, open below so legs remain visible.
  const rear = box(0, 1.02, -2.42, safeWidth - 0.2, 0.08, 0.74);
  rear.name = 'twelfth-kitchen-preparation-bench';
  for (const x of [-(safeWidth - 0.4) / 2, (safeWidth - 0.4) / 2]) {
    for (const z of [-2.7, -2.14]) box(x, 0.6, z, 0.035, 0.82, 0.035);
  }
  box(0, 0.47, -2.42, safeWidth - 0.27, 0.035, 0.66, darkSteel);
  // One hood per opening, behind the fascia, with a fluted grease filter.
  box(0, 2.67, -2.42, safeWidth - 0.16, 0.24, 0.85, darkSteel).name = 'twelfth-extraction-hood';
  for (let i = 0; i < 7; i++)
    box(((i - 3) * (safeWidth - 0.3)) / 7, 2.54, -2.34, 0.025, 0.035, 0.57);
  box(0, 2.95, -2.73, 0.48, 0.42, 0.3);
  if (windowNumber % 4 === 2) {
    const cabinetX = safeWidth * 0.3;
    box(cabinetX, 0.83, -2.41, 0.54, 1.28, 0.6).name = 'twelfth-warming-cabinet';
    box(cabinetX, 0.84, -2.095, 0.49, 1.14, 0.025, darkSteel);
    for (let i = 0; i < 4; i++) box(cabinetX, 0.42 + i * 0.25, -2.07, 0.45, 0.012, 0.018);
    box(cabinetX + 0.18, 0.9, -2.05, 0.027, 0.25, 0.035, black);
  } else {
    cylinder(-safeWidth * 0.27, 1.18, -2.4, 0.2, 0.24);
    ellipsoid(-safeWidth * 0.27, 1.31, -2.4, 0.21, 0.045, 0.21, steel);
    box(safeWidth * 0.24, 1.09, -2.4, 0.48, 0.035, 0.38, mat('#d7c6a6'));
  }

  // Small payment terminal and nested bowls are visible in every reference segment.
  const terminalX = safeWidth * 0.32;
  box(terminalX, 1.245, 0.65, 0.29, 0.07, 0.24, black);
  box(terminalX, 1.38, 0.59, 0.065, 0.21, 0.06, ceramic);
  const terminal = box(terminalX, 1.51, 0.58, 0.3, 0.22, 0.055, black);
  terminal.rotation.x = -0.17;
  const display = box(terminalX, 1.51, 0.612, 0.25, 0.17, 0.006, mat('#8bb9b4', 0, 0.48));
  display.rotation.x = -0.17;
  display.name = 'twelfth-payment-screen';
  bowlStack(safeWidth * 0.29, 0.05, (windowNumber % 3) + 4);
  cylinder(safeWidth * 0.4, 1.33, 0.2, 0.06, 0.22, darkSteel);
  for (let i = 0; i < 5; i++)
    rod(
      [safeWidth * 0.4 + (i - 2) * 0.013, 1.31, 0.2],
      [safeWidth * 0.4 + (i - 2) * 0.018, 1.59, 0.205],
      0.006,
      mat('#9f7951'),
    );

  if (windowNumber === 1) {
    tray(-safeWidth * 0.16, 0.55, safeWidth * 0.5, 0.55, true);
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#dfebe1',
      roughness: 0.22,
      metalness: 0,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
    const glazing = item(
      new THREE.BoxGeometry(safeWidth * 0.56, 0.51, 0.025),
      glass,
      -safeWidth * 0.16,
      1.53,
      0.89,
      'twelfth-fried-chicken-display',
    );
    glazing.castShadow = false;
    for (const x of [-safeWidth * 0.38, safeWidth * 0.06]) {
      box(x, 1.55, 0.88, 0.02, 0.6, 0.025);
      rod([x, 2.24, 0.4], [x, 1.9, 0.4], 0.012, black);
      const shade = item(
        new THREE.ConeGeometry(0.17, 0.17, 16, 1, true),
        mat('#b73c2e', 0.13, 0.4),
        x,
        1.87,
        0.4,
        'twelfth-red-warming-lamp',
      );
      shade.rotation.x = 0;
      const bulb = new THREE.MeshBasicMaterial({ color: '#ffd58d', toneMapped: false });
      cylinder(x, 1.795, 0.4, 0.12, 0.012, bulb);
    }
  } else if (windowNumber === 2) {
    tray(-safeWidth * 0.17, 0.48, 0.7, 0.48, true);
    bowl(-safeWidth * 0.17, 1.22, -0.04, 0.19);
    box(-safeWidth * 0.15, 1.13, -2.42, 0.48, 0.12, 0.43, ceramic);
  } else if ([3, 5, 8, 13].includes(windowNumber)) {
    const top = pot(-safeWidth * 0.16, 0.25, windowNumber === 13 ? 0.28 : 0.31);
    if (windowNumber === 13) pot(safeWidth * 0.11, -0.28, 0.23, 1.22, true);
    bowl(-safeWidth * 0.24, 1.22, 0.78, 0.15);
    vapor(-safeWidth * 0.16, 0.25, top + 0.08);
  } else if (windowNumber === 4) {
    pot(-safeWidth * 0.16, 0.13, 0.23, 1.22, true);
    bowl(-safeWidth * 0.15, 1.22, 0.65, 0.16, false);
  } else if (windowNumber === 6 || windowNumber === 7) {
    casserole(-safeWidth * 0.21, 0.41, 1.22, windowNumber === 7);
    if (windowNumber === 6) {
      for (let i = 0; i < 3; i++) {
        cylinder(-safeWidth * 0.2, 1.28 + i * 0.095, -0.2, 0.23, 0.085, mat('#b99b64'));
        rim(-safeWidth * 0.2, 1.325 + i * 0.095, -0.2, 0.23, mat('#9a8155'));
      }
    }
  } else if (windowNumber === 9) {
    for (let i = 0; i < 2; i++) {
      const x = -safeWidth * 0.2 + i * 0.45;
      box(x, 1.24, 0.45, 0.43, 0.05, 0.34, mat('#8b5731'));
      cylinder(x, 1.28, 0.45, 0.17, 0.04, black);
      for (let j = 0; j < 4; j++)
        ellipsoid(x + (j - 1.5) * 0.055, 1.32, 0.45, 0.025, 0.035, 0.09, j % 2 ? meat : golden);
    }
    vapor(-safeWidth * 0.2, 0.45, 1.38);
  } else if (windowNumber === 10) {
    box(-safeWidth * 0.15, 1.11, -0.27, 0.73, 0.22, 0.65, darkSteel);
    const wok = item(
      new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      black,
      -safeWidth * 0.15,
      1.45,
      -0.27,
      'twelfth-wok',
    );
    wok.material.side = THREE.DoubleSide;
    rod(
      [-safeWidth * 0.15 + 0.25, 1.42, -0.27],
      [-safeWidth * 0.15 + 0.5, 1.46, -0.27],
      0.024,
      black,
    );
    cylinder(-safeWidth * 0.15, 1.35, -0.27, 0.16, 0.015, greens);
    vapor(-safeWidth * 0.15, -0.27, 1.48);
    tray(-safeWidth * 0.18, 0.57, 0.6, 0.35);
  } else if (windowNumber === 11 || windowNumber === 12) {
    box(-safeWidth * 0.16, 1.34, 0.23, safeWidth * 0.54, 0.24, 0.68).name = 'twelfth-bain-marie';
    for (const x of [-safeWidth * 0.29, -safeWidth * 0.04]) {
      for (const z of [0.06, 0.39]) {
        box(x, 1.467, z, safeWidth * 0.21, 0.018, 0.26, darkSteel);
        box(x, 1.48, z, safeWidth * 0.18, 0.012, 0.22, windowNumber === 11 ? meat : golden);
      }
    }
    vapor(-safeWidth * 0.2, 0.23, 1.54);
  } else if (windowNumber === 14) {
    tray(-safeWidth * 0.2, 0.44, 0.65, 0.4);
    for (const x of [-safeWidth * 0.32, safeWidth * 0.05])
      rod([x, 1.22, -0.1], [x, 2.05, -0.1], 0.02);
    rod([-safeWidth * 0.32, 2.05, -0.1], [safeWidth * 0.05, 2.05, -0.1], 0.02);
    // A small suspended roast silhouette, as visible behind window 14 in the reference.
    const x = -safeWidth * 0.14;
    rod([x, 2.05, -0.1], [x, 1.92, -0.1], 0.009);
    ellipsoid(x, 1.75, -0.1, 0.11, 0.18, 0.09, mat('#995528', 0, 0.47));
    for (const side of [-1, 1]) ellipsoid(x + side * 0.06, 1.59, -0.1, 0.035, 0.09, 0.035, meat);
    bowl(-safeWidth * 0.2, 1.22, 0.82, 0.14);
  } else {
    casserole(-safeWidth * 0.2, 0.38, 1.22, true);
    casserole(safeWidth * 0.02, -0.2, 1.22, false);
    if (windowNumber === 15) {
      for (let i = 0; i < 8; i++) {
        const x = -safeWidth * 0.33 + i * 0.1;
        const color = mat(['#b64028', '#6d903b', '#ce9c35', '#673f26'][i % 4]);
        cylinder(x, 1.3, 0.83, 0.035, 0.15, ceramic);
        cylinder(x, 1.39, 0.83, 0.029, 0.045, color);
      }
    }
  }
  return {
    tick(time) {
      if (!Number.isFinite(time)) return;
      for (const puff of steam) {
        const rise = (time * 0.14 + puff.phase + windowNumber * 0.11) % 1;
        puff.mesh.position.set(
          puff.x + Math.sin(rise * 5 + windowNumber) * 0.045,
          puff.y + rise * 0.48,
          puff.z,
        );
        puff.mesh.scale.set(0.075 + rise * 0.04, 0.11 + rise * 0.04, 0.065 + rise * 0.035);
        (puff.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(rise * Math.PI) * 0.065;
      }
    },
  };
}
