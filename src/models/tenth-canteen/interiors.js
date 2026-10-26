import * as THREE from 'three';

// Window-local coordinates: +Z faces the diner, the service edge is Z=0.
// All food positions use a seeded sequence so the model is repeatable.
const geometries = {
  box: new THREE.BoxGeometry(1, 1, 1),
  ball: new THREE.SphereGeometry(1, 10, 7),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 18),
  bowl: new THREE.CylinderGeometry(1, 0.55, 1, 20, 1, true),
  ring: new THREE.TorusGeometry(1, 0.045, 5, 24),
};
const materials = new Map();
const palette = {
  stainless: ['#b6bdb8', 0.68, 0.34],
  brushed: ['#8b9690', 0.62, 0.46],
  rim: ['#d9dfd8', 0.7, 0.26],
  darkSteel: ['#48534e', 0.48, 0.44],
  ceramic: ['#eee9d9', 0.04, 0.58],
  black: ['#202a24', 0.06, 0.53],
  bamboo: ['#a97a43', 0, 0.82],
  paleBamboo: ['#c69a61', 0, 0.77],
  paper: ['#eee7d7', 0, 0.91],
  redLight: ['#b83926', 0, 0.32],
  beige: ['#cfcfc1', 0.12, 0.72],
};

function material(name) {
  if (!materials.has(name)) {
    const [color, metalness, roughness] = palette[name] || [name, 0, 0.78];
    materials.set(
      name,
      new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        side: name === 'ceramic' ? THREE.DoubleSide : THREE.FrontSide,
      }),
    );
  }
  return materials.get(name);
}

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** Batch repeated dishes, legs, rims and food into material/geometry instances. */
function parts(parent) {
  const batches = new Map();
  const dummy = new THREE.Object3D();
  function add(kind, color, position, scale, rotation = [0, 0, 0]) {
    const key = `${kind}/${color}`;
    if (!batches.has(key)) batches.set(key, { kind, color, transforms: [] });
    batches.get(key).transforms.push({ position, scale, rotation });
  }
  return {
    add,
    box(color, x, y, z, w, h, d, rotation) {
      add('box', color, [x, y, z], [w, h, d], rotation);
    },
    ball(color, x, y, z, sx, sy, sz, rotation) {
      add('ball', color, [x, y, z], [sx, sy, sz], rotation);
    },
    cylinder(color, x, y, z, r, h, rotation) {
      add('cylinder', color, [x, y, z], [r, h, r], rotation);
    },
    ring(color, x, y, z, r, rotation = [Math.PI / 2, 0, 0]) {
      add('ring', color, [x, y, z], [r, r, r], rotation);
    },
    finish() {
      for (const entry of batches.values()) {
        const mesh = new THREE.InstancedMesh(
          geometries[entry.kind],
          material(entry.color),
          entry.transforms.length,
        );
        mesh.name = `interior-${entry.kind}-${entry.color}`;
        for (const [i, transform] of entry.transforms.entries()) {
          dummy.position.fromArray(transform.position);
          dummy.scale.fromArray(transform.scale);
          dummy.rotation.fromArray(transform.rotation);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        parent.add(mesh);
      }
    },
  };
}

function plate(p, x, y, z, radius = 0.17, stack = 1) {
  for (let i = 0; i < stack; i++) {
    p.cylinder('ceramic', x, y + i * 0.022, z, radius, 0.018);
    p.ring('ceramic', x, y + i * 0.022 + 0.012, z, radius * 0.95);
  }
}

function bowl(p, x, y, z, radius = 0.14, contents = null) {
  p.add('bowl', 'ceramic', [x, y + 0.06, z], [radius, 0.12, radius]);
  p.cylinder('ceramic', x, y + 0.008, z, radius * 0.52, 0.02);
  p.ring('ceramic', x, y + 0.12, z, radius);
  if (contents) p.cylinder(contents, x, y + 0.087, z, radius * 0.83, 0.015);
}

function ladle(p, x, y, z, rotation = 0) {
  p.ball('rim', x, y, z, 0.065, 0.018, 0.045);
  p.box(
    'rim',
    x + Math.sin(rotation) * 0.16,
    y + 0.032,
    z + Math.cos(rotation) * 0.16,
    0.017,
    0.014,
    0.32,
    [-0.16, rotation, 0],
  );
  p.box(
    'black',
    x + Math.sin(rotation) * 0.3,
    y + 0.052,
    z + Math.cos(rotation) * 0.3,
    0.035,
    0.027,
    0.13,
    [-0.16, rotation, 0],
  );
}

function pot(p, x, y, z, radius = 0.23, height = 0.35, soup = '#a16d3b', lidded = false) {
  p.cylinder('stainless', x, y + height / 2, z, radius, height);
  p.ring('rim', x, y + height, z, radius);
  p.cylinder(soup, x, y + height + 0.004, z, radius * 0.91, 0.008);
  for (const side of [-1, 1]) {
    p.ring('darkSteel', x + side * radius, y + height * 0.73, z, 0.065, [0, Math.PI / 2, 0]);
  }
  if (lidded) {
    p.ball(
      'rim',
      x + radius * 0.33,
      y + height + 0.055,
      z - radius * 0.15,
      radius * 0.95,
      0.045,
      radius * 0.95,
      [0.1, 0, -0.25],
    );
    p.box('black', x + radius * 0.33, y + height + 0.11, z - radius * 0.15, 0.12, 0.04, 0.045);
  }
}

function steamer(p, x, y, z, radius = 0.25, levels = 3, filled = true) {
  for (let level = 0; level < levels; level++) {
    const cy = y + level * 0.11;
    p.cylinder('bamboo', x, cy + 0.045, z, radius, 0.085);
    p.cylinder('paleBamboo', x, cy + 0.089, z, radius * 0.91, 0.009);
    p.ring('paleBamboo', x, cy + 0.09, z, radius);
    for (let strip = -2; strip <= 2; strip++)
      p.box(
        'bamboo',
        x + strip * radius * 0.29,
        cy + 0.096,
        z,
        0.018,
        0.008,
        radius * 1.55 * Math.sqrt(Math.max(0.1, 1 - (strip * 0.29) ** 2)),
      );
  }
  if (filled) {
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const bx = x + Math.cos(angle) * radius * 0.55;
      const bz = z + Math.sin(angle) * radius * 0.55;
      const by = y + levels * 0.11 + 0.028;
      p.ball('#eee6cc', bx, by, bz, 0.068, 0.046, 0.062);
      p.ball('#d8cdb0', bx, by + 0.039, bz, 0.016, 0.008, 0.016);
    }
  }
}

function foodTray(p, x, y, z, w, d, foodType, seed) {
  const rng = random(seed);
  const h = 0.075;
  // Recessed bottom and four separate walls leave a real visible cavity.
  p.box('brushed', x, y - h, z, w - 0.045, 0.015, d - 0.045);
  for (const side of [-1, 1]) {
    p.box('stainless', x + (side * (w - 0.018)) / 2, y - h / 2, z, 0.018, h, d);
    p.box('rim', x + (side * (w + 0.009)) / 2, y + 0.003, z, 0.028, 0.014, d + 0.035);
    p.box('stainless', x, y - h / 2, z + (side * (d - 0.018)) / 2, w, h, 0.018);
    p.box('rim', x, y + 0.003, z + (side * (d + 0.009)) / 2, w + 0.035, 0.014, 0.028);
  }
  const types = [
    { sauce: '#896541', colors: ['#b4753d', '#92602e', '#c79750'], shape: 'box' },
    { sauce: '#8b9447', colors: ['#6c8c3d', '#91a751', '#486d32'], shape: 'leaf' },
    { sauce: '#b59a50', colors: ['#e3c568', '#dbb64b', '#edd77e'], shape: 'ball' },
    { sauce: '#813f26', colors: ['#a35632', '#b46c3e', '#7b4b31'], shape: 'box' },
    { sauce: '#aa9170', colors: ['#e3d4ae', '#c7b488', '#eee0bd'], shape: 'ball' },
    { sauce: '#b17c3d', colors: ['#c49c51', '#dec483', '#a8773d'], shape: 'box' },
  ];
  const type = types[foodType % types.length];
  p.box(type.sauce, x, y - 0.051, z, w - 0.06, 0.018, d - 0.06);
  const cols = Math.max(4, Math.floor(w / 0.11));
  const rows = Math.max(3, Math.floor(d / 0.1));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = x - w * 0.39 + (col / Math.max(1, cols - 1)) * w * 0.78 + (rng() - 0.5) * 0.045;
      const pz = z - d * 0.33 + (row / Math.max(1, rows - 1)) * d * 0.66 + (rng() - 0.5) * 0.036;
      const py = y - 0.018 + rng() * 0.045;
      const color = type.colors[Math.floor(rng() * type.colors.length)];
      if (type.shape === 'box')
        p.box(color, px, py, pz, 0.07 + rng() * 0.035, 0.052 + rng() * 0.025, 0.07 + rng() * 0.02, [
          (rng() - 0.5) * 0.4,
          rng() * Math.PI,
          (rng() - 0.5) * 0.3,
        ]);
      else if (type.shape === 'leaf') {
        p.ball(color, px, py, pz, 0.06, 0.018, 0.04, [0, rng() * Math.PI, (rng() - 0.5) * 0.7]);
        p.box('#a2b46e', px, py + 0.012, pz, 0.012, 0.012, 0.065, [0, rng() * Math.PI, 0]);
      } else p.ball(color, px, py, pz, 0.042 + rng() * 0.017, 0.035, 0.038 + rng() * 0.015);
      if ((col + row) % 5 === 0)
        p.box(foodType === 1 ? '#a64c2c' : '#5d8342', px, py + 0.04, pz, 0.025, 0.013, 0.018, [
          0,
          rng() * Math.PI,
          0,
        ]);
    }
  }
  if (seed % 2 === 0) ladle(p, x + w * 0.23, y + 0.035, z + d * 0.06, -0.42);
}

function steam(parent, vents, seed) {
  const rng = random(seed);
  const count = vents.length * 7;
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const offsets = Array.from({ length: count }, () => ({
    phase: rng(),
    x: (rng() - 0.5) * 0.16,
    z: (rng() - 0.5) * 0.12,
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute(
    'steamAlpha',
    new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute(
    'steamSize',
    new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage),
  );
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `attribute float steamAlpha; attribute float steamSize;
      varying float vAlpha;
      void main(){vAlpha=steamAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      gl_PointSize=clamp(360.0*projectionMatrix[1][1]*steamSize,1.0,40.0);}`,
    fragmentShader: `varying float vAlpha;
      void main(){float r=length(gl_PointCoord-0.5)*2.0;
      float fade=pow(max(0.0,1.0-r*r),2.5);
      gl_FragColor=vec4(1.0,0.97,0.9,fade*vAlpha);}`,
  });
  const cloud = new THREE.Points(geometry, mat);
  cloud.name = 'gentle-food-steam';
  cloud.userData.animated = true;
  cloud.frustumCulled = false;
  cloud.renderOrder = 3;
  cloud.raycast = () => {};
  parent.add(cloud);
  function tick(time) {
    for (let i = 0; i < count; i++) {
      const vent = vents[Math.floor(i / 7)];
      const offset = offsets[i];
      const t = (time * 0.17 + offset.phase) % 1;
      positions[i * 3] = vent[0] + offset.x + Math.sin(time * 0.6 + i) * t * 0.07;
      positions[i * 3 + 1] = vent[1] + t * 0.65;
      positions[i * 3 + 2] = vent[2] + offset.z - t * 0.09;
      alphas[i] = Math.sin(Math.PI * t) * 0.12;
      sizes[i] = 0.15 + t * 0.21;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.steamAlpha.needsUpdate = true;
    geometry.attributes.steamSize.needsUpdate = true;
  }
  tick(0);
  return tick;
}

function hood(parent, width, rear) {
  const group = new THREE.Group();
  group.name = 'rear-extraction-hood';
  group.userData.planHide = true;
  const p = parts(group);
  p.box('brushed', 0, 2.66, rear + 0.4, width * 0.76, 0.36, 0.74);
  p.box('darkSteel', 0, 2.47, rear + 0.4, width * 0.7, 0.018, 0.66);
  p.box('rim', 0, 2.5, rear + 0.77, width * 0.79, 0.045, 0.04);
  p.box('stainless', 0, 3.05, rear + 0.18, Math.min(0.62, width * 0.4), 0.5, 0.45);
  for (let x = -width * 0.29; x < width * 0.3; x += 0.13)
    p.box('stainless', x, 2.46, rear + 0.4, 0.035, 0.028, 0.54, [0, 0, 0.23]);
  p.finish();
  parent.add(group);
}

export function addWindowInterior(parent, { number, width, depth = 4.2, perpendicular = false }) {
  const group = new THREE.Group();
  group.name = `window-interior-${number}`;
  group.userData = {
    windowNumber: number,
    foodTableOrientation: perpendicular ? 'perpendicular' : 'counter',
  };
  parent.add(group);
  const p = parts(group);
  const vents = [];
  const half = width / 2;
  const rear = -depth;
  const tableWidth = Math.min(0.94, width * 0.62);

  // Rear stainless preparation bench, recessed doors and restrained handles.
  p.box('beige', 0, 0.52, rear + 0.4, width - 0.15, 0.83, 0.6);
  p.box('stainless', 0, 0.96, rear + 0.4, width - 0.1, 0.075, 0.7);
  for (const side of [-1, 1]) {
    p.box('brushed', side * width * 0.24, 0.54, rear + 0.71, width * 0.46 - 0.03, 0.69, 0.016);
    p.box('darkSteel', side * 0.13, 0.71, rear + 0.733, 0.12, 0.025, 0.025);
  }
  p.box('#7b9b8d', -width * 0.29, 1.01, rear + 0.4, 0.4, 0.026, 0.27);
  p.box('rim', -width * 0.3, 1.035, rear + 0.4, 0.19, 0.012, 0.045, [0, 0.31, 0]);
  p.box('black', -width * 0.2, 1.04, rear + 0.43, 0.1, 0.025, 0.04, [0, 0.31, 0]);
  plate(p, width * 0.24, 1.015, rear + 0.42, 0.17, 5 + (number % 5));
  bowl(p, width * 0.08, 1.02, rear + 0.46, 0.13);
  pot(p, width * 0.33, 0.99, rear + 0.1, 0.15, 0.18, '#534b32', true);
  hood(group, width, rear);

  if (perpendicular) {
    // Photograph groups 5–8: every food table runs into the kitchen, never
    // sideways along the serving window. X=0 aligns it with its physical opening.
    p.box('brushed', 0, 0.94, -2.05, tableWidth, 0.2, 2.6);
    p.box('rim', 0, 1.055, -2.05, tableWidth + 0.035, 0.035, 2.64);
    p.box('darkSteel', 0, 1.076, -2.05, tableWidth - 0.1, 0.012, 2.49);
    p.box('stainless', 0, 0.33, -2.05, tableWidth - 0.14, 0.04, 2.42);
    for (const x of [-tableWidth * 0.4, tableWidth * 0.4])
      for (const z of [-0.86, -3.23]) {
        p.cylinder('brushed', x, 0.48, z, 0.027, 0.88);
        p.cylinder('black', x, 0.045, z, 0.034, 0.06);
      }
    for (let i = 0; i < 5; i++) {
      const z = -0.99 - i * 0.52;
      foodTray(p, 0, 1.1, z, tableWidth - 0.13, 0.435, (number + i) % 6, number * 101 + i);
      if (i === 0 || i === 3) vents.push([0, 1.17, z]);
    }
    p.box('black', tableWidth / 2 + 0.009, 0.93, -1.02, 0.025, 0.09, 0.24);
    p.ball('redLight', tableWidth / 2 + 0.027, 0.94, -0.98, 0.012, 0.012, 0.012);
    plate(p, 0, 0.37, -1.0, 0.19, 6);
    plate(p, 0, 0.37, -1.55, 0.19, 5);
    group.userData.foodTableBounds = {
      minX: -tableWidth / 2,
      maxX: tableWidth / 2,
      minZ: -3.35,
      maxZ: -0.75,
      top: 1.05,
    };
    // The pastry windows retain bamboo steamers on the rear workbench.
    if (number === 8 || number === 9) {
      steamer(p, -width * 0.27, 1.02, rear + 0.4, 0.24, 3);
      vents.push([-width * 0.27, 1.39, rear + 0.4]);
    }
  } else if (number <= 4) {
    const w = width - 0.32;
    p.box('brushed', 0, 0.86, -0.82, w, 0.4, 0.92);
    p.box('rim', 0, 1.075, -0.82, w + 0.035, 0.035, 0.95);
    const count = Math.max(2, Math.floor(w / 0.58));
    const cell = w / count;
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + cell * (i + 0.5);
      foodTray(p, x, 1.1, -0.82, cell - 0.06, 0.71, number + i, number * 87 + i);
      if (i % 2 === 0) vents.push([x, 1.18, -0.82]);
    }
    p.box('stainless', -w * 0.36, 0.4, -0.82, 0.3, 0.04, 0.6);
    pot(p, width * 0.25, 1.02, rear + 0.4, 0.22, 0.38, '#84623b', true);
  } else if (number === 5 || number === 6 || number === 16) {
    const left = -width * 0.24;
    p.box('stainless', left, 0.6, -1.25, 0.84, 1.01, 0.92);
    p.box('darkSteel', left, 1.12, -1.25, 0.86, 0.035, 0.94);
    for (const z of [-1.02, -1.46]) {
      p.cylinder('black', left, 1.14, z, 0.16, 0.02);
      p.ring('rim', left, 1.16, z, 0.16);
      p.box('bamboo', left + 0.18, 1.34, z, 0.024, 0.34, 0.024, [0, 0, -0.2]);
      vents.push([left, 1.18, z]);
    }
    p.box('black', left, 0.88, -0.776, 0.4, 0.08, 0.016);
    p.ball('redLight', left + 0.12, 0.88, -0.762, 0.012, 0.012, 0.009);
    p.box('stainless', width * 0.23, 1.05, -1.29, width * 0.42, 0.07, 1.05);
    pot(p, width * 0.23, 1.09, -1.4, 0.26, 0.4, '#9a7047', true);
    ladle(p, width * 0.21, 1.52, -1.38, 0.85);
    bowl(p, width * 0.27, 1.09, -0.95, 0.16, '#c7af74');
    if (number === 5) steamer(p, -width * 0.26, 1.02, rear + 0.43, 0.23, 4);
    if (number === 16) {
      for (let i = 0; i < 4; i++)
        bowl(
          p,
          -0.25 + i * 0.17,
          1.02,
          rear + 0.45,
          0.075,
          ['#4b723b', '#a0482b', '#9b7049', '#e2d8bc'][i],
        );
    }
  } else if (number === 7) {
    p.box('brushed', 0, 0.71, -1.3, width - 0.24, 0.72, 1.08);
    p.box('black', 0, 1.1, -1.3, width - 0.16, 0.045, 1.12);
    for (const x of [-width * 0.27, width * 0.04, width * 0.31]) {
      p.ring('darkSteel', x, 1.14, -1.35, 0.2);
      p.cylinder('#3c3024', x, 1.22, -1.35, 0.18, 0.16);
      p.cylinder('#a17846', x, 1.31, -1.35, 0.15, 0.012);
      p.ring('#63503a', x, 1.31, -1.35, 0.18);
      for (const side of [-1, 1]) p.box('#463827', x + side * 0.2, 1.27, -1.35, 0.1, 0.045, 0.08);
      vents.push([x, 1.34, -1.35]);
      bowl(p, x, 1.13, -0.96, 0.11);
    }
    for (const x of [-width * 0.26, 0, width * 0.26])
      p.cylinder('black', x, 0.92, -0.747, 0.045, 0.035, [Math.PI / 2, 0, 0]);
  } else {
    // The confirmed 17 pickup opening: rice warmer and a stack of takeaway trays.
    p.box('brushed', 0, 0.68, -1.05, width - 0.22, 0.8, 0.94);
    p.box('rim', 0, 1.1, -1.05, width - 0.17, 0.045, 0.98);
    p.cylinder('beige', -width * 0.22, 1.28, -1.11, 0.3, 0.33);
    p.cylinder('darkSteel', -width * 0.22, 1.45, -1.11, 0.265, 0.025);
    p.ball('ceramic', -width * 0.22, 1.46, -1.11, 0.24, 0.045, 0.24);
    p.box('black', -width * 0.22, 1.26, -0.805, 0.2, 0.1, 0.018);
    for (let i = 0; i < 6; i++)
      p.box('paper', width * 0.23, 1.16 + i * 0.018, -1.0, 0.43, 0.014, 0.31);
    vents.push([-width * 0.22, 1.51, -1.11]);
  }

  // Small belongings and utensils make the kitchen inhabited without figures.
  const side = number % 2 ? -1 : 1;
  const utensilX = side * Math.min(half - 0.22, 0.93);
  p.cylinder('stainless', utensilX, 1.13, rear + 0.44, 0.075, 0.22);
  for (let i = 0; i < 5; i++)
    p.box(
      'bamboo',
      utensilX + (i - 2) * 0.018,
      1.31,
      rear + 0.43 + (i % 2) * 0.025,
      0.01,
      0.32,
      0.01,
      [0.05, 0, (i - 2) * 0.04],
    );
  p.box('#b8c6b3', -side * width * 0.34, 0.23, -2.77, 0.32, 0.4, 0.34);
  p.box('darkSteel', -side * width * 0.34, 0.44, -2.77, 0.34, 0.04, 0.36);
  p.finish();
  const updateSteam = steam(group, vents, number * 12347);
  return { tick: updateSteam };
}
