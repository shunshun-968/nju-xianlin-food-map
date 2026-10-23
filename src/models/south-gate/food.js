import * as THREE from 'three';

// Countertop food is deliberately simple: the silhouette and palette distinguish
// the photographed breakfast display from the evening skewers.
export function createFoodDisplay() {
  const day = new THREE.Group();
  const night = new THREE.Group();
  day.name = 'day-food';
  night.name = 'night-food';

  const material = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...extra });
  const metal = material('#c4c8c5', { metalness: 0.45, roughness: 0.42 });
  const metalInside = material('#8f9994', { metalness: 0.32, roughness: 0.5 });
  const cream = material('#f5edd9');
  const paper = material('#d5ad7e');
  const purple = material('#735182');
  const bamboo = material('#e3c489');
  const egg = material('#ac7549');
  const bun = material('#d7a163');
  const lettuce = material('#7c965d');
  const nori = material('#384f41');
  const corn = material('#e9bb55');
  const meat = material('#a65b42');
  const sausage = material('#d48c6b');
  const tofu = material('#e5ca8f');
  const red = material('#b76353');
  const mustard = material('#d8ac53');

  const add = (group, geometry, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (g, w, h, d, m, x, y, z) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  const ball = (g, r, m, x, y, z, scale = [1, 1, 1]) => {
    const mesh = add(g, new THREE.SphereGeometry(r, 10, 7), m, x, y, z);
    mesh.scale.set(...scale);
    return mesh;
  };
  const cylinder = (g, rt, rb, h, m, x, y, z, sides = 12) =>
    add(g, new THREE.CylinderGeometry(rt, rb, h, sides), m, x, y, z);
  const tray = (g, x, z, width = 0.79, depth = 0.65, name = 'display-tray') => {
    const t = new THREE.Group();
    t.name = name;
    t.position.set(x, 1.65, z);
    box(t, width, 0.035, depth, metalInside, 0, 0.018, 0);
    box(t, width + 0.025, 0.09, 0.028, metal, 0, 0.06, -depth / 2);
    box(t, width + 0.025, 0.09, 0.028, metal, 0, 0.06, depth / 2);
    box(t, 0.028, 0.09, depth, metal, -width / 2, 0.06, 0);
    box(t, 0.028, 0.09, depth, metal, width / 2, 0.06, 0);
    g.add(t);
    return t;
  };

  // A shallow metal bowl of tea eggs.
  const bowl = new THREE.Group();
  bowl.name = 'tea-eggs';
  bowl.position.set(-1.9, 1.65, 1.63);
  cylinder(bowl, 0.35, 0.28, 0.12, metal, 0, 0.065, 0);
  cylinder(bowl, 0.322, 0.322, 0.012, meat, 0, 0.131, 0);
  const rim = add(bowl, new THREE.TorusGeometry(0.337, 0.018, 6, 24), metal, 0, 0.135, 0);
  rim.rotation.x = Math.PI / 2;
  [
    [-0.16, -0.1],
    [0.02, -0.14],
    [0.17, -0.04],
    [-0.15, 0.09],
    [0.04, 0.06],
    [0.16, 0.15],
  ].forEach(([x, z], i) => {
    const e = ball(bowl, 0.083, egg, x, 0.185 + (i % 2) * 0.013, z, [0.83, 1.08, 0.88]);
    e.rotation.z = ((i % 3) - 1) * 0.25;
  });
  day.add(bowl);

  // Wrapped burgers and upright takeaway bags.
  const breakfast = tray(day, -0.8, 1.63, 0.82, 0.65, 'burgers-and-paper-bags');
  for (const [x, z] of [
    [-0.2, 0.13],
    [0.12, 0.14],
  ]) {
    box(breakfast, 0.27, 0.065, 0.25, cream, x, 0.08, z);
    cylinder(breakfast, 0.12, 0.12, 0.04, bun, x, 0.125, z);
    cylinder(breakfast, 0.126, 0.126, 0.018, lettuce, x, 0.154, z);
    const top = ball(breakfast, 0.125, bun, x, 0.176, z, [1, 0.5, 1]);
    top.rotation.y = 0.2;
    // The folded wrapper covers the lower half of the bun.
    box(breakfast, 0.25, 0.065, 0.025, cream, x, 0.13, z + 0.105);
  }
  for (const x of [-0.22, 0.1]) {
    box(breakfast, 0.225, 0.265, 0.15, paper, x, 0.177, -0.16);
    box(breakfast, 0.231, 0.035, 0.16, cream, x, 0.32, -0.16);
    box(breakfast, 0.07, 0.085, 0.006, purple, x, 0.2, -0.081);
  }

  // White triangular rice balls with a dark seaweed band.
  const rice = tray(day, 0.35, 1.63, 0.82, 0.65, 'rice-balls');
  const triangle = new THREE.Shape();
  triangle.moveTo(-0.115, 0);
  triangle.quadraticCurveTo(-0.15, 0.015, -0.115, 0.068);
  triangle.lineTo(-0.025, 0.235);
  triangle.quadraticCurveTo(0, 0.27, 0.025, 0.235);
  triangle.lineTo(0.115, 0.068);
  triangle.quadraticCurveTo(0.15, 0.015, 0.115, 0);
  triangle.closePath();
  const riceGeometry = new THREE.ExtrudeGeometry(triangle, {
    depth: 0.13,
    bevelEnabled: true,
    bevelSize: 0.014,
    bevelThickness: 0.012,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 3,
  });
  for (const [x, z] of [
    [-0.2, -0.19],
    [0.12, -0.19],
    [-0.2, 0.09],
    [0.12, 0.09],
  ]) {
    add(rice, riceGeometry, cream, x, 0.065, z);
    box(rice, 0.075, 0.135, 0.015, nori, x, 0.126, z + 0.149);
  }

  // Corn cobs laid lengthwise, with only a few broad kernel rows.
  const cornTray = tray(day, 1.42, 1.63, 0.81, 0.65, 'corn-cobs');
  for (const x of [-0.22, 0, 0.22]) {
    const cob = cylinder(cornTray, 0.072, 0.075, 0.37, corn, x, 0.135, 0, 10);
    cob.rotation.x = Math.PI / 2;
    for (let row = 0; row < 5; row++) {
      for (let side = 0; side < 3; side++) {
        const angle = ((side + 1) * Math.PI) / 4;
        ball(
          cornTray,
          0.029,
          corn,
          x + Math.cos(angle) * 0.066,
          0.136 + Math.sin(angle) * 0.066,
          -0.145 + row * 0.072,
          [1, 0.88, 1],
        );
      }
    }
  }

  // Paper cups with lids and a restrained plum-colored sleeve.
  const cups = new THREE.Group();
  cups.name = 'coffee-cups';
  for (const [x, z] of [
    [2.23, 1.44],
    [2.53, 1.49],
    [2.38, 1.79],
  ]) {
    cylinder(cups, 0.105, 0.077, 0.255, cream, x, 1.78, z);
    cylinder(cups, 0.096, 0.086, 0.08, purple, x, 1.79, z);
    cylinder(cups, 0.112, 0.112, 0.029, cream, x, 1.923, z);
    cylinder(cups, 0.09, 0.105, 0.021, cream, x, 1.946, z);
  }
  day.add(cups);

  // Evening display: five metal trays, bamboo handles facing the customer.
  const skewerMaterials = [tofu, meat, sausage, lettuce, corn];
  const skewerNames = [
    'tofu-skewers',
    'meat-skewers',
    'sausage-skewers',
    'vegetable-skewers',
    'corn-skewers',
  ];
  for (let t = 0; t < 5; t++) {
    const eveningTray = tray(night, -1.98 + t * 1.015, 1.63, 0.84, 0.67, skewerNames[t]);
    for (let s = 0; s < 4; s++) {
      const x = -0.285 + s * 0.185;
      const offset = (s % 2) * 0.025;
      const stick = cylinder(eveningTray, 0.008, 0.008, 0.57, bamboo, x, 0.135, 0.035, 5);
      stick.rotation.x = Math.PI / 2;
      for (let p = 0; p < 3; p++) {
        const z = -0.19 + p * 0.13 + offset;
        const m = skewerMaterials[t];
        if (t === 0) {
          const cube = box(eveningTray, 0.12, 0.09, 0.105, m, x, 0.14, z);
          cube.rotation.y = p % 2 ? 0.18 : -0.1;
        } else if (t === 1) {
          const chunk = ball(eveningTray, 0.068, m, x, 0.145, z, [1.03, 0.79, 0.82]);
          chunk.rotation.y = p * 0.4;
        } else if (t === 2) {
          const piece = cylinder(eveningTray, 0.052, 0.052, 0.09, m, x, 0.145, z, 9);
          piece.rotation.x = Math.PI / 2;
          ball(eveningTray, 0.052, m, x, 0.145, z + 0.045, [1, 1, 0.45]);
          ball(eveningTray, 0.052, m, x, 0.145, z - 0.045, [1, 1, 0.45]);
        } else if (t === 3) {
          ball(eveningTray, 0.07, m, x, 0.15, z, [1, 0.8, 0.74]);
          ball(eveningTray, 0.042, m, x + 0.034, 0.184, z - 0.018, [0.9, 0.8, 1]);
        } else {
          const cake = cylinder(eveningTray, 0.065, 0.065, 0.07, m, x, 0.14, z, 10);
          cake.rotation.x = Math.PI / 2;
          for (let k = 0; k < 5; k++) {
            const a = (k * Math.PI * 2) / 5;
            ball(
              eveningTray,
              0.021,
              corn,
              x + Math.cos(a) * 0.06,
              0.14 + Math.sin(a) * 0.06,
              z,
              [1, 1, 1.7],
            );
          }
        }
      }
    }
  }

  // Two sauce bottles on the rear preparation ledge, behind the trays.
  const condiments = new THREE.Group();
  condiments.name = 'evening-condiments';
  for (const [x, m] of [
    [1.73, red],
    [1.98, mustard],
  ]) {
    cylinder(condiments, 0.062, 0.067, 0.23, m, x, 1.77, 0.91, 10);
    cylinder(condiments, 0.031, 0.055, 0.07, m, x, 1.92, 0.91, 10);
    cylinder(condiments, 0.011, 0.027, 0.07, cream, x, 1.99, 0.91, 8);
  }
  night.add(condiments);
  return { day, night };
}
