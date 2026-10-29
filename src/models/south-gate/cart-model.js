import * as THREE from 'three';
import { loadModelTexture } from '../../lib/model-texture-loader';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Dimensions are visual estimates from the supplied photographs, not survey measurements.
// Coordinate convention: front = -X, service side = +Z, ground = Y=0.
const materials = new Map();
function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!materials.has(key))
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...extra }));
  return materials.get(key);
}
function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(p, x, y, z, w, h, d, c, extra) {
  return mesh(p, new THREE.BoxGeometry(w, h, d), mat(c, extra), x, y, z);
}
function round(p, x, y, z, w, h, d, c, r = 0.08, extra = {}) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: d,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 5,
  });
  geo.translate(0, 0, -d / 2);
  return mesh(p, geo, mat(c, extra), x, y, z);
}
function cylinder(p, x, y, z, r, h, c, extra = {}) {
  return mesh(p, new THREE.CylinderGeometry(r, r, h, 24), mat(c, extra), x, y, z);
}
function rod(p, a, b, r, c) {
  const from = new THREE.Vector3(...a),
    to = new THREE.Vector3(...b),
    v = to.clone().sub(from);
  const m = cylinder(p, 0, 0, 0, r, v.length(), c);
  m.position.copy(from.add(to).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  return m;
}
// Use the supplied artwork verbatim; Vite resolves these under any deployment base.
const logisticsArtwork = new URL('../../assets/branding/南大后勤.png', import.meta.url).href;
const badgeArtwork = new URL('../../assets/branding/南大校徽.png', import.meta.url).href;
function imagePanel(p, url, x, y, z, w, h, rotation = 0) {
  const texture = loadModelTexture(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = mesh(
    p,
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }),
    x,
    y,
    z,
  );
  panel.rotation.y = rotation;
  panel.castShadow = false;
  return panel;
}
function badge(p, x, y, z, rotation = 0, scale = 1) {
  const height = 0.58 * scale;
  return imagePanel(p, badgeArtwork, x, y, z, (height * 306) / 363, height, rotation);
}
export function createCart() {
  const cart = new THREE.Group();
  cart.name = 'south-gate-cart-open';
  const purple = '#824389',
    trim = '#60356e',
    edge = '#b884b6',
    steel = '#c9cec9',
    cream = '#e9e3d5',
    glass = '#b9d4ce';
  const glazing = {
    transparent: true,
    opacity: 0.24,
    metalness: 0.05,
    roughness: 0.21,
    depthWrite: false,
  };
  box(cart, 0, 0.57, 0, 6.4, 0.24, 2.23, '#3b3940');
  // Open wheel arches in both lower side panels.
  for (const z of [-1.27, 1.27]) {
    const archAngle = Math.asin((0.7 - 0.48) / 0.55),
      archHalfWidth = Math.cos(archAngle) * 0.55;
    const s = new THREE.Shape();
    s.moveTo(-3.28, 0.7);
    s.lineTo(-3.28, 1.67);
    s.lineTo(3.28, 1.67);
    s.lineTo(3.28, 0.7);
    s.lineTo(2.3 + archHalfWidth, 0.7);
    s.absarc(2.3, 0.48, 0.55, archAngle, Math.PI - archAngle, false);
    s.lineTo(-2.3 + archHalfWidth, 0.7);
    s.absarc(-2.3, 0.48, 0.55, archAngle, Math.PI - archAngle, false);
    s.lineTo(-3.28, 0.7);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.075,
      bevelEnabled: false,
      curveSegments: 16,
    });
    mesh(cart, g, mat(purple), 0, 0, z - 0.038);
    for (const x of [-2.3, 2.3]) {
      const arch = mesh(
        cart,
        new THREE.TorusGeometry(0.55, 0.035, 8, 36, Math.PI),
        mat(edge),
        x,
        0.48,
        z + (z > 0 ? 0.05 : -0.05),
      );
      arch.castShadow = false;
    }
    box(cart, 0, 0.75, z, 3.35, 0.075, 0.09, trim);
    for (const x of [-1.42, 0, 1.42])
      box(cart, x, 1.16, z + (z > 0 ? 0.042 : -0.042), 0.015, 0.8, 0.012, '#9c62a1');
  }
  // Four wheels, hub recesses and five lug bolts per wheel.
  for (const x of [-2.3, 2.3])
    for (const z of [-1.25, 1.25]) {
      const tire = cylinder(cart, x, 0.48, z, 0.46, 0.26, '#34353b');
      tire.rotation.x = Math.PI / 2;
      const side = z + Math.sign(z) * 0.145;
      const rim = cylinder(cart, x, 0.48, side, 0.3, 0.026, '#d6d6cc', { metalness: 0.4 });
      rim.rotation.x = Math.PI / 2;
      const inset = cylinder(cart, x, 0.48, side + Math.sign(z) * 0.02, 0.21, 0.03, '#939b9b', {
        metalness: 0.4,
      });
      inset.rotation.x = Math.PI / 2;
      const hub = cylinder(cart, x, 0.48, side + Math.sign(z) * 0.05, 0.1, 0.06, '#d9dbd2', {
        metalness: 0.5,
      });
      hub.rotation.x = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        const b = cylinder(
          cart,
          x + Math.sin(a) * 0.16,
          0.48 + Math.cos(a) * 0.16,
          side + Math.sign(z) * 0.045,
          0.024,
          0.026,
          '#eee9dd',
        );
        b.rotation.x = Math.PI / 2;
      }
    }
  // Front and rear fascias, continuous roof, upright frame.
  for (const x of [-3.3, 3.3]) {
    const panel = round(cart, x, 1.18, 0, 2.5, 0.98, 0.1, purple, 0.12);
    panel.rotation.y = Math.PI / 2;
    for (const z of [-1.24, 1.24]) box(cart, x, 2.21, z, 0.12, 2.18, 0.12, trim);
    const pane = box(cart, x, 2.35, 0, 0.024, 1.18, 2.35, glass, glazing);
    pane.castShadow = false;
    box(cart, x, 1.73, 0, 0.14, 0.09, 2.5, trim);
    box(cart, x, 2.99, 0, 0.14, 0.1, 2.5, trim);
  }
  // The two long sides use the same roof and window datums. The deployed awning
  // is a separate attachment, so it must not lower the service-side body frame.
  const roof = mesh(
    cart,
    new RoundedBoxGeometry(6.72, 0.52, 2.66, 4, 0.12),
    mat(purple),
    0,
    3.26,
    0,
  );
  roof.name = 'continuous-level-roof';
  for (const z of [-1.27, 1.27]) {
    const rail = box(cart, 0, 2.99, z, 6.48, 0.1, 0.11, trim);
    rail.name = z > 0 ? 'service-window-header' : 'back-window-header';
    box(cart, 0, 1.73, z, 6.48, 0.09, 0.09, trim);
  }
  // Back wall windows and a cream-lined interior, visible through the open service side.
  box(cart, 0, 1.5, -1.21, 6.42, 0.28, 0.05, cream);
  box(cart, 0, 2.33, -1.27, 6.47, 0.07, 0.08, trim);
  for (const x of [-2.16, 0, 2.16]) {
    box(cart, x, 2.35, -1.27, 0.07, 1.22, 0.07, trim);
    const p = box(cart, x, 2.35, -1.285, 2.05, 1.15, 0.015, glass, glazing);
    p.castShadow = false;
  }
  box(cart, 0, 0.77, 0, 6.4, 0.08, 2.4, '#b6aa98');
  box(cart, 0, 1.34, -0.84, 6.28, 0.54, 0.63, '#dddcd0');
  box(cart, 0, 1.63, -0.82, 6.32, 0.08, 0.73, steel, { metalness: 0.35 });
  for (const x of [-2, -0.6, 0.8, 2.2]) {
    box(cart, x, 1.35, -0.49, 1.26, 0.46, 0.02, '#c4c6be');
    box(cart, x, 1.49, -0.46, 0.22, 0.025, 0.035, '#717c7b');
  }
  // Selling counter is down and all three serving bays are open in BOTH modes.
  box(cart, 0, 1.61, 1.0, 6.3, 0.08, 0.62, steel, { metalness: 0.4 });
  const glassCounter = box(cart, 0, 1.62, 1.72, 6.3, 0.055, 0.85, '#b7c9c4', {
    transparent: true,
    opacity: 0.54,
    metalness: 0.16,
    roughness: 0.2,
  });
  glassCounter.castShadow = false;
  for (const z of [1.29, 2.15]) box(cart, 0, 1.62, z, 6.44, 0.075, 0.065, trim);
  for (const x of [-3.2, -1.05, 1.07, 3.2]) {
    box(cart, x, 2.34, 1.28, 0.075, 1.42, 0.09, trim);
    box(cart, x, 1.62, 1.72, 0.07, 0.08, 0.85, trim);
    rod(cart, [x, 1.6, 2.12], [x, 1.14, 1.3], 0.018, '#6f7479');
  }
  for (const x of [-2.13, 0, 2.13]) {
    const openWindow = new THREE.Group();
    cart.add(openWindow);
    openWindow.position.set(x, 3.01, 1.31);
    openWindow.rotation.x = -0.22;
    const pane = box(openWindow, 0, 0, 0.33, 2.02, 0.026, 0.67, glass, glazing);
    pane.castShadow = false;
    for (const a of [-1.01, 1.01]) box(openWindow, a, 0, 0.33, 0.035, 0.045, 0.69, trim);
    for (const z of [0, 0.67]) box(openWindow, 0, 0, z, 2.05, 0.045, 0.035, trim);
    rod(cart, [x - 0.94, 2.71, 1.29], [x - 0.94, 3.13, 1.91], 0.013, '#a6adac');
  }
  // Retractable wine-red awning, silver arms and a scalloped cream edge.
  const awning = new THREE.Group();
  cart.add(awning);
  awning.position.set(0, 3.38, 1.24);
  awning.rotation.x = 0.17;
  box(awning, 0, -0.012, 0.74, 6.75, 0.035, 1.5, '#9d4b69');
  for (const x of [-2.4, 0, 2.4]) box(awning, x, -0.034, 0.74, 0.012, 0.008, 1.5, '#b56d81');
  rod(cart, [-3.43, 3.13, 2.73], [3.43, 3.13, 2.73], 0.045, '#e4e0d6');
  for (const x of [-3.1, 3.1]) {
    rod(cart, [x, 3.31, 1.3], [x, 3.14, 2.7], 0.026, '#d2d3c9');
    rod(cart, [x, 2.85, 1.3], [x, 3.12, 2.68], 0.018, '#b8c0b9');
  }
  const valance = new THREE.Shape();
  valance.moveTo(-3.38, 0);
  valance.lineTo(3.38, 0);
  valance.lineTo(3.38, -0.2);
  for (let i = 22; i >= 0; i--) {
    const x = -3.38 + (i * 6.76) / 23;
    valance.quadraticCurveTo(x + 0.147, -0.34, x, -0.2);
  }
  valance.closePath();
  mesh(
    cart,
    new THREE.ShapeGeometry(valance),
    mat('#9d4b69', { side: THREE.DoubleSide }),
    0,
    3.13,
    2.75,
  );
  const points = [];
  for (let i = 0; i <= 230; i++) {
    const x = -3.38 + (i * 6.76) / 230;
    points.push(new THREE.Vector3(x, 2.93 - 0.067 * Math.sin(((i % 10) / 10) * Math.PI), 2.756));
  }
  const pipe = new THREE.CatmullRomCurve3(points);
  mesh(cart, new THREE.TubeGeometry(pipe, 230, 0.011, 5, false), mat('#eee4d5'));
  // Rooftop air conditioner with grille and vents.
  round(cart, 0.65, 3.68, -0.12, 1.16, 0.45, 0.85, '#dcd6bf', 0.06);
  box(cart, 0.65, 3.71, 0.325, 0.95, 0.31, 0.026, '#8b8e80');
  for (let i = 0; i < 9; i++)
    box(cart, 0.22 + i * 0.108, 3.71, 0.35, 0.035, 0.31, 0.027, '#ddd7c3');
  for (let i = 0; i < 6; i++) box(cart, 0.65, 3.93, -0.42 + i * 0.11, 0.8, 0.012, 0.028, '#a7ab9e');
  // Windshield wiper, headlights, small amber lamps and mirrors.
  rod(cart, [-3.377, 1.8, 0.5], [-3.39, 2.25, -0.27], 0.019, '#3a3740');
  rod(cart, [-3.395, 2.12, -0.62], [-3.395, 2.31, 0.02], 0.014, '#34313b');
  const lamps = [];
  for (const z of [-0.92, 0.92]) {
    const rim = cylinder(cart, -3.38, 1.31, z, 0.18, 0.04, '#c2c5bd', { metalness: 0.4 });
    rim.rotation.z = Math.PI / 2;
    const lamp = cylinder(cart, -3.41, 1.31, z, 0.145, 0.02, '#fcf1d4', {
      emissive: '#ffe1a0',
      emissiveIntensity: 0,
    });
    lamp.rotation.z = Math.PI / 2;
    lamps.push(lamp.material);
    const amber = cylinder(cart, -3.405, 1.0, z, 0.075, 0.026, '#d6963c');
    amber.rotation.z = Math.PI / 2;
    box(cart, 3.37, 1.1, z, 0.03, 0.12, 0.19, '#a5454d');
    rod(
      cart,
      [-2.95, 2.44, z > 0 ? 1.3 : -1.3],
      [-3.12, 2.43, z > 0 ? 1.62 : -1.62],
      0.022,
      '#555462',
    );
    round(cart, -3.13, 2.43, z > 0 ? 1.66 : -1.66, 0.12, 0.3, 0.17, '#48444f', 0.04);
  }
  imagePanel(cart, logisticsArtwork, -3.405, 3.26, 0, 1, (1 * 180) / 390, -Math.PI / 2);
  badge(cart, -3.405, 1.18, 0, -Math.PI / 2, 1.12);
  for (const z of [-1.322, 1.322]) {
    const r = z > 0 ? 0 : Math.PI;
    imagePanel(cart, logisticsArtwork, 0.25, 1.19, z, 1.65, (1.65 * 180) / 390, r);
    badge(cart, z > 0 ? -1.2 : 1.7, 1.2, z, r, 0.95);
  }
  // Compact equipment and small display stands remain behind the food.
  round(cart, 2.5, 1.95, -0.8, 0.61, 0.58, 0.45, '#56545b', 0.04);
  box(cart, 2.5, 2.08, -0.55, 0.42, 0.15, 0.02, '#a7b2ae');
  const steamer = cylinder(cart, -2.5, 1.91, -0.8, 0.31, 0.42, steel, { metalness: 0.4 });
  cylinder(cart, -2.5, 2.135, -0.8, 0.33, 0.035, '#d8d8cd', { metalness: 0.4 });
  cylinder(cart, -2.5, 2.18, -0.8, 0.06, 0.06, '#707770');
  const terminal = box(cart, 2.87, 1.85, 1.18, 0.27, 0.31, 0.07, '#484652');
  terminal.rotation.x = -0.3;
  box(cart, 2.87, 1.84, 1.15, 0.31, 0.04, 0.25, '#484652');
  const lightMaterials = [],
    lights = [];
  for (const x of [-2.1, 0, 2.1]) {
    box(cart, x, 2.96, 0.96, 1.65, 0.065, 0.09, '#a8b8b7');
    const tube = box(cart, x, 2.917, 0.96, 1.55, 0.025, 0.065, '#f5eed8', {
      emissive: '#ffe5b2',
      emissiveIntensity: 0.15,
    });
    lightMaterials.push(tube.material);
    const l = new THREE.PointLight('#ffe4b9', 0, 4.5, 2);
    l.position.set(x, 2.62, 1.05);
    cart.add(l);
    lights.push(l);
  }
  return {
    group: cart,
    setNight(night) {
      for (const l of lights) l.intensity = night ? 7 : 0;
      for (const m of lightMaterials) m.emissiveIntensity = night ? 3 : 0.1;
      for (const m of lamps) m.emissiveIntensity = night ? 0.8 : 0;
    },
  };
}

export function createGround() {
  const group = new THREE.Group();
  group.name = 'display-ground';
  const plinth = round(group, 0, -0.21, 0.25, 10.5, 0.38, 7.7, '#dfded3', 0.28);
  const paving = box(group, 0, -0.005, 0.7, 10.1, 0.04, 5.9, '#e6e4d9');
  for (let x = -4.7; x < 5; x += 0.65) box(group, x, 0.018, 0.7, 0.012, 0.005, 5.7, '#d6d8ce');
  for (let z = -1.9; z < 3.6; z += 0.65) box(group, 0, 0.02, z, 10.05, 0.005, 0.012, '#d6d8ce');
  const grass = box(group, 0, 0.035, -2.79, 10.05, 0.12, 1.15, '#c7d4bd');
  box(group, 0, 0.1, -2.17, 10.15, 0.18, 0.14, '#c8cdc0');
  for (const x of [-4.6, -3.8, -2.7, -1.5, -0.4, 0.7, 1.8, 2.9, 4.0, 4.6]) {
    const bush = mesh(
      group,
      new THREE.IcosahedronGeometry(0.42, 1),
      mat(x % 2 ? '#b0c3a2' : '#bacbaa'),
      x,
      0.33,
      -2.75,
    );
    bush.scale.set(1.18, 0.72, 0.82);
  }
  // Painted parking corners suggest the actual roadside location without adding other buildings.
  for (const x of [-3.95, 3.95]) {
    box(group, x, 0.025, 0.6, 0.045, 0.008, 3.4, '#faf7e9');
    box(group, x - Math.sign(x) * 0.32, 0.025, 2.28, 0.65, 0.008, 0.045, '#faf7e9');
  }
  return {
    group,
    setNight(n) {
      plinth.material.color.set(n ? '#393d4b' : '#dfded3');
      paving.material.color.set(n ? '#4e525d' : '#e6e4d9');
      grass.material.color.set(n ? '#46584e' : '#c7d4bd');
    },
  };
}
