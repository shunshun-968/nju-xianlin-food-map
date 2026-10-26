import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { IndoorCanteenSpec } from '../data/indoor-canteens';
import { facultyCanteenFaces } from '../data/faculty-canteen';
import type { FourthCanteenModel } from './FourthCanteenModel';
import { twelfthTextPlane } from './twelfth-canteen-signage';
import { addFacultySignage } from './faculty-canteen-signage';

/** The photographed seven-window row: north is -X, and the dining aisle is +Z. */
export function createFacultyCanteenModel(spec: IndoorCanteenSpec): FourthCanteenModel {
  const group = new THREE.Group();
  group.name = 'faculty-canteen-straight-row';
  const spatial = new THREE.Group();
  spatial.name = 'spatial-frontages';
  const plan = new THREE.Group();
  plan.name = 'plan-labels';
  group.add(spatial, plan);
  const overhead: THREE.Group[] = [];
  const steam: { mesh: THREE.Mesh; y: number; phase: number }[] = [];
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const steel = '#afb8b4';
  const paleSteel = '#cbd0c7';
  const darkSteel = '#63716b';
  function mat(color: string, metalness = 0, glow = 0) {
    const key = `${color}/${metalness}/${glow}`;
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          metalness,
          roughness: metalness ? 0.34 : 0.7,
          emissive: glow ? color : '#000000',
          emissiveIntensity: glow,
        }),
      );
    return materials.get(key)!;
  }
  function box(
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    metalness = 0,
    glow = 0,
  ) {
    const mesh = new THREE.Mesh(cube, mat(color, metalness, glow));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  }
  function cylinder(
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    color: string,
    metalness = 0,
    bottom = r,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, bottom, h, 20),
      mat(color, metalness),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  }
  function oval(
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: string,
  ) {
    const mesh = new THREE.Mesh(sphere, mat(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    p.add(mesh);
    return mesh;
  }
  function label(text: string, x: number, z: number, width: number, height: number) {
    const mesh = twelfthTextPlane(text, width, height, '#55465e', '#fffbee');
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 4.65, z);
    plan.add(mesh);
    return mesh;
  }
  function trayStack(p: THREE.Object3D, x: number, z: number, count = 12) {
    for (let i = 0; i < count; i++) {
      box(p, x, 1.225 + i * 0.028, z, 0.53, 0.019, 0.4, '#e6dfc9');
      box(p, x, 1.235 + i * 0.028, z, 0.42, 0.005, 0.29, '#cec8b6');
    }
  }
  function bowl(p: THREE.Object3D, x: number, y: number, z: number, filling?: string) {
    cylinder(p, x, y + 0.07, z, 0.18, 0.14, '#e7e2ce', 0, 0.085);
    if (filling) {
      cylinder(p, x, y + 0.137, z, 0.16, 0.014, filling);
      oval(p, x + 0.04, y + 0.153, z - 0.025, 0.06, 0.015, 0.045, '#648747');
    }
  }
  function foodPan(
    p: THREE.Object3D,
    x: number,
    z: number,
    seed: number,
    y = 1.23,
    lengthwise = false,
  ) {
    const pan = new THREE.Group();
    pan.name = 'faculty-food-pan';
    pan.position.set(x, y, z);
    pan.rotation.y = lengthwise ? Math.PI / 2 : 0;
    p.add(pan);
    box(pan, 0, 0, 0, 0.64, 0.07, 0.47, steel, 0.6);
    box(pan, 0, 0.038, 0, 0.56, 0.015, 0.39, '#6b756a', 0.3);
    for (const side of [-1, 1]) {
      box(pan, side * 0.31, 0.035, 0, 0.025, 0.04, 0.47, paleSteel, 0.65);
      box(pan, 0, 0.035, side * 0.225, 0.64, 0.04, 0.025, paleSteel, 0.65);
    }
    const color = ['#7d973e', '#a36235', '#d5ae57', '#d4c9a1', '#a7432f'][seed % 5];
    for (let i = 0; i < 15; i++)
      oval(
        pan,
        ((i % 5) - 2) * 0.1,
        0.071 + (i % 3) * 0.005,
        (Math.floor(i / 5) - 1) * 0.1,
        0.044,
        0.028,
        0.04,
        color,
      );
    // Only the food and its tray turn. Dish markers continue facing the customer (+Z).
    const marker = new THREE.Group();
    marker.name = 'faculty-dish-marker';
    marker.position.set(x, y, z - (lengthwise ? 0.34 : 0.24));
    p.add(marker);
    box(marker, 0, 0.18, 0, 0.018, 0.22, 0.014, steel, 0.4);
    box(marker, 0, 0.29, 0, 0.27, 0.14, 0.014, '#b44736');
    for (let i = 0; i < 3; i++)
      box(marker, -0.075 + i * 0.06, 0.29, 0.01, 0.034, 0.012, 0.003, '#f4e3bd');
  }
  function pot(p: THREE.Object3D, x: number, z: number, radius = 0.33, y = 1.12, lid = false) {
    const station = new THREE.Group();
    station.name = lid ? 'faculty-covered-stockpot' : 'faculty-soup-pot';
    p.add(station);
    cylinder(station, x, y + 0.24, z, radius, 0.47, steel, 0.6);
    cylinder(station, x, y + 0.48, z, radius * 1.03, 0.035, paleSteel, 0.6);
    if (lid) {
      oval(station, x, y + 0.5, z, radius, 0.055, radius, paleSteel);
      box(station, x, y + 0.57, z, 0.16, 0.04, 0.06, darkSteel, 0.5);
    } else cylinder(station, x, y + 0.495, z, radius * 0.9, 0.012, '#b99a58');
    for (const side of [-1, 1])
      box(station, x + side * (radius + 0.05), y + 0.37, z, 0.14, 0.05, 0.095, darkSteel, 0.5);
    if (!lid) {
      const mist = new THREE.Mesh(
        sphere,
        new THREE.MeshBasicMaterial({
          color: '#faf2d8',
          transparent: true,
          opacity: 0.075,
          depthWrite: false,
        }),
      );
      mist.position.set(x, y + 0.72, z);
      mist.scale.set(0.075, 0.18, 0.075);
      mist.name = 'faculty-pot-steam';
      mist.userData.steam = true;
      station.add(mist);
      steam.push({ mesh: mist, y: mist.position.y, phase: x * 0.6 + z });
    }
  }
  function cooker(p: THREE.Object3D, x: number, z: number) {
    cylinder(p, x, 1.35, z, 0.29, 0.45, '#e3e0cc', 0.06, 0.25);
    cylinder(p, x, 1.59, z, 0.3, 0.055, '#5c6152', 0.1);
    box(p, x, 1.64, z, 0.2, 0.045, 0.075, '#454d43');
    box(p, x, 1.34, z + 0.28, 0.1, 0.16, 0.025, '#aabbb0');
    box(p, x, 1.35, z + 0.297, 0.05, 0.035, 0.005, '#667c67');
  }
  function payment(p: THREE.Object3D, x: number, z: number) {
    const terminal = new THREE.Group();
    terminal.name = 'faculty-payment-terminal';
    p.add(terminal);
    box(terminal, x, 1.27, z, 0.33, 0.13, 0.27, '#c7d0c8', 0.12);
    box(terminal, x, 1.42, z - 0.02, 0.055, 0.25, 0.06, darkSteel, 0.5);
    const screen = box(terminal, x, 1.59, z, 0.38, 0.26, 0.04, '#34453f');
    screen.rotation.x = -0.12;
    box(terminal, x, 1.59, z + 0.026, 0.32, 0.2, 0.007, '#93bec2', 0, 0.08);
    box(terminal, x + 0.28, 1.27, z + 0.02, 0.19, 0.1, 0.21, '#3d4841');
    // The upright black speaker/card unit sits behind the screen in the photographs.
    box(terminal, x + 0.25, 1.62, z - 0.25, 0.025, 0.68, 0.025, darkSteel, 0.6);
    box(terminal, x + 0.25, 1.94, z - 0.25, 0.16, 0.2, 0.045, '#283a31');
  }
  function rearBench(p: THREE.Object3D, width: number) {
    box(p, 0, 0.66, -3.4, width - 0.35, 0.88, 0.66, '#c5cac1', 0.35);
    box(p, 0, 1.12, -3.4, width - 0.24, 0.06, 0.79, steel, 0.62);
    for (let x = -width / 2 + 0.8; x < width / 2 - 0.3; x += 0.75) {
      box(p, x, 0.68, -3.059, 0.012, 0.83, 0.008, '#8c9990', 0.25);
      box(p, x + 0.1, 0.82, -3.03, 0.025, 0.16, 0.025, darkSteel, 0.5);
    }
  }
  function wok(p: THREE.Object3D, x: number, z: number) {
    cylinder(p, x, 1.18, z, 0.29, 0.08, '#313b36', 0.3);
    const pan = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      mat('#35413b', 0.45),
    );
    pan.position.set(x, 1.4, z);
    p.add(pan);
    box(p, x + 0.39, 1.4, z, 0.32, 0.032, 0.06, '#404a3c');
    cylinder(p, x, 1.31, z, 0.22, 0.025, '#859354');
  }
  function equipment(p: THREE.Group, number: number, width: number) {
    rearBench(p, width);
    payment(p, -width * 0.31, 0.6);
    if (number === 2 || number === 3 || number === 4) {
      const cols = number === 2 ? 4 : 5;
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < cols; i++)
          foodPan(
            p,
            (i - (cols - 1) / 2) * 0.54 + 0.25,
            0.49 - row * 0.72,
            i + row + number,
            1.23,
            true,
          );
      trayStack(p, -width * 0.4, 0.12, number === 3 ? 18 : 11);
      for (let i = 0; i < 5; i++) bowl(p, width * 0.4, 1.21 + i * 0.045, 0.66);
      pot(p, -width * 0.27, -3.4, 0.32, 1.15, true);
      cooker(p, width * 0.28, -3.4);
      box(p, 0, 2.86, -3.15, width * 0.7, 0.4, 1.18, steel, 0.55);
    } else if (number === 6) {
      const soup = new THREE.Group();
      soup.name = 'faculty-soup-service';
      p.add(soup);
      for (const x of [-0.8, 0, 0.8]) pot(soup, x, 0.12, 0.34, 1.21, x === 0);
      cooker(soup, -0.9, -3.4);
      cooker(soup, 0.1, -3.4);
      for (let i = 0; i < 8; i++) bowl(soup, width * 0.37, 1.21 + i * 0.035, 0.58);
      box(soup, 0.9, 1.22, -3.35, 0.38, 0.13, 0.31, '#cad0be');
    } else if (number === 5) {
      const noodles = new THREE.Group();
      noodles.name = 'faculty-noodle-station';
      p.add(noodles);
      box(noodles, -0.48, 1.17, -0.05, 1.85, 0.17, 0.81, steel, 0.65);
      for (const x of [-0.94, -0.4]) {
        cylinder(noodles, x, 1.265, -0.08, 0.22, 0.022, '#334139');
        cylinder(noodles, x, 1.28, -0.08, 0.18, 0.038, paleSteel, 0.6);
        box(noodles, x, 1.48, -0.27, 0.025, 0.4, 0.025, steel, 0.6);
        box(noodles, x, 1.68, -0.32, 0.055, 0.12, 0.04, '#78603b');
      }
      for (let i = 0; i < 3; i++) foodPan(noodles, 0.62 + i * 0.65, 0.12, i + 2);
      for (let i = 0; i < 4; i++) bowl(noodles, -0.9 + i * 0.39, 1.22, 0.66, '#c2a15c');
      cooker(noodles, -1, -3.4);
      box(noodles, 1.25, 1.36, -3.4, 1.05, 0.43, 0.63, '#b84e3b');
      box(noodles, 1.25, 1.59, -3.4, 1.09, 0.035, 0.67, '#cc6450');
    } else if (number === 7) {
      const kitchen = new THREE.Group();
      kitchen.name = 'faculty-open-wok-kitchen';
      p.add(kitchen);
      // The deeper visible open kitchen has a side stove and a central preparation island.
      box(kitchen, width * 0.32, 0.63, -1.8, 0.87, 0.91, 3, steel, 0.48);
      box(kitchen, width * 0.32, 1.12, -1.8, 0.94, 0.08, 3.1, paleSteel, 0.6);
      for (const z of [-1, -2, -3]) wok(kitchen, width * 0.32, z);
      box(kitchen, width * 0.32, 2.85, -1.8, 1.2, 0.43, 3.25, steel, 0.6);
      for (let z = -3.15; z < -0.4; z += 0.16)
        box(kitchen, width * 0.32, 2.625, z, 0.9, 0.015, 0.025, darkSteel, 0.5);
      box(kitchen, 0, 1.06, -2.1, 0.95, 0.075, 2.55, steel, 0.58);
      for (const x of [-0.38, 0.38])
        for (const z of [-3.2, -1]) box(kitchen, x, 0.6, z, 0.04, 0.89, 0.04, darkSteel, 0.6);
      for (let i = 0; i < 4; i++) {
        const x = -0.8 + i * 0.62;
        cylinder(kitchen, x, 1.29, 0.1, 0.26, 0.14, '#34403a', 0.35, 0.19);
        for (let j = 0; j < 7; j++)
          oval(
            kitchen,
            x + Math.sin(j * 2.3) * 0.16,
            1.38,
            0.1 + Math.cos(j * 2.3) * 0.12,
            0.07,
            0.035,
            0.05,
            j % 2 ? '#668d3e' : '#bc7043',
          );
      }
      trayStack(kitchen, -width * 0.4, 0, 20);
      box(kitchen, -1.9, 1.3, -2.8, 0.72, 0.31, 0.52, '#b34b37');
      for (let i = 0; i < 6; i++)
        cylinder(kitchen, -0.24 + i * 0.13, 1.17, -2.95, 0.05, 0.17, i % 2 ? '#935532' : '#c5a553');
    } else {
      const salads = new THREE.Group();
      salads.name = 'faculty-light-meal-station';
      p.add(salads);
      for (let i = 0; i < 3; i++) foodPan(salads, -0.62 + i * 0.64, 0.11, [0, 3, 2][i]);
      for (let i = 0; i < 3; i++) bowl(salads, -0.45 + i * 0.45, 1.22, 0.66, '#84a84c');
      box(salads, width * 0.32, 0.97, -2.7, 0.75, 1.63, 0.74, '#c3ccc2', 0.35);
      box(salads, width * 0.32, 1.1, -2.32, 0.59, 1.14, 0.022, '#69857a');
      box(salads, width * 0.32 - 0.22, 1.1, -2.29, 0.025, 0.3, 0.035, paleSteel, 0.6);
      trayStack(salads, -width * 0.36, -3.4, 7);
    }
  }

  const { stage } = spec;
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(stage.width, 0.26, stage.depth, 2, 0.06),
    mat('#bdbba8'),
  );
  base.position.set(stage.x, -0.04, stage.z);
  spatial.add(base);
  box(spatial, stage.x, 0.1, stage.z, stage.width - 0.16, 0.06, stage.depth - 0.16, '#dfdcc8');
  for (let x = stage.x - stage.width / 2 + 1.15; x < stage.x + stage.width / 2; x += 1.15)
    box(spatial, x, 0.134, stage.z, 0.011, 0.004, stage.depth - 0.2, '#bdbcae');
  for (let z = stage.z - stage.depth / 2 + 1.15; z < stage.z + stage.depth / 2; z += 1.15)
    box(spatial, stage.x, 0.134, z, stage.width - 0.2, 0.004, 0.011, '#bdbcae');
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#d9e5db',
    transparent: true,
    opacity: 0.115,
    roughness: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const faces = [...facultyCanteenFaces].sort((a, b) => a.x - b.x);
  for (const [index, face] of faces.entries()) {
    const number = face.windowNumbers[0],
      w = face.width;
    const room = new THREE.Group();
    room.name = `faculty-window-${number}`;
    room.position.set(face.x, 0, face.z);
    spatial.add(room);
    box(room, 0, 0.16, -1.6, w, 0.05, 5.2, '#cfcebd');
    box(room, 0, 2.08, -4.2, w, 3.85, 0.15, '#e3dfcd');
    for (let y = 0.55; y < 3.95; y += 0.43) box(room, 0, y, -4.119, w, 0.009, 0.006, '#c4c2b3');
    for (let x = -w / 2 + 0.72; x < w / 2; x += 0.72)
      box(room, x, 2.08, -4.119, 0.009, 3.85, 0.006, '#c8c6b7');
    // Shallow tiled piers preserve the open, connected kitchen visible behind the service windows.
    for (const side of [-1, 1]) {
      box(room, (side * w) / 2, 2.08, 0.73, 0.07, 3.85, 0.55, '#c4c9bd', 0.32);
      box(room, (side * w) / 2, 2.08, 1.02, 0.065, 3.85, 0.035, paleSteel, 0.65);
      if ((index === 0 && side === -1) || (number === 1 && side === 1))
        box(room, side * (w / 2 + 0.075), 2.08, -1.6, 0.15, 3.85, 5.2, '#e0ddcb');
    }
    const next = faces[index + 1];
    const gap = next ? next.x - next.width / 2 - (face.x + w / 2) : 0;
    if (next && number !== 2) {
      box(room, w / 2 + gap / 2, 2.08, 0.62, gap, 3.85, 0.78, '#d8d8c9');
      box(room, w / 2 + gap / 2, 2.08, -4.2, gap, 3.85, 0.15, '#e3dfcd');
    }
    if (number === 2 && next) {
      const passage = new THREE.Group();
      passage.name = 'faculty-passage-between-1-and-2';
      passage.position.x = w / 2 + gap / 2;
      room.add(passage);
      box(passage, 0, 0.16, -1.6, gap, 0.05, 5.2, '#c3c7b9');
      for (const side of [-1, 1])
        box(passage, side * (gap / 2 - 0.035), 1.99, -1.6, 0.07, 3.7, 5.2, '#d3d6c9');
      box(passage, 0, 1.99, -4.22, gap, 3.7, 0.08, '#8f9c8b');
      box(passage, 0, 1.02, -4.16, gap - 0.18, 0.05, 0.04, '#506659');
    }
    // Warm ash-colored vertical flutes are a defining feature of this row.
    const lengthwiseService = number >= 2 && number <= 4;
    // Add support behind the front edge for the two deeper rows of lengthwise pans.
    box(
      room,
      0,
      0.64,
      lengthwiseService ? 0.22 : 0.5,
      w,
      0.94,
      lengthwiseService ? 1.6 : 1.04,
      '#c6b778',
    );
    for (let x = -w / 2 + 0.035; x < w / 2; x += 0.085)
      box(room, x, 0.65, 1.028, 0.012, 0.9, 0.015, '#a59965');
    box(room, 0, 0.19, 1.035, w, 0.09, 0.035, '#655b43');
    box(
      room,
      0,
      1.16,
      lengthwiseService ? 0.22 : 0.46,
      w,
      0.1,
      lengthwiseService ? 1.72 : 1.24,
      steel,
      0.6,
    ).name = `faculty-counter-top-${number}`;
    box(room, 0, 1.135, 1.088, w, 0.12, 0.035, '#8b9891', 0.5);
    const mullions = number === 7 ? 3 : 2;
    for (let i = 0; i <= mullions; i++)
      box(room, -w / 2 + (i * w) / mullions, 2.3, 0.89, 0.045, 2.1, 0.055, steel, 0.65);
    for (const y of [1.8, 3.0]) box(room, 0, y, 0.89, w, 0.045, 0.055, steel, 0.65);
    for (let i = 0; i < mullions; i++) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w / mullions - 0.055, 1.15), glass);
      pane.position.set(-w / 2 + ((i + 0.5) * w) / mullions, 2.4, 0.89);
      pane.name = `faculty-glass-${number}-${i}`;
      room.add(pane);
    }
    equipment(room, number, w - 0.15);
    // Match 12F's low, warm serving lamps. Two zones keep these wider counters evenly lit.
    // They remain regular PointLights so the shared selection system can dim/restore them.
    for (const [lampIndex, x] of [-w * 0.22, w * 0.22].entries()) {
      box(room, x, 2.22, 0.03, w * 0.41, 0.055, 0.13, '#9b9172', 0.4);
      box(room, x, 2.187, 0.03, w * 0.39, 0.014, 0.09, '#ffd082', 0, 1.15);
      const light = new THREE.PointLight('#ffcc7b', number === 1 ? 7 : 11, 4.6, 2);
      light.position.set(x, 2.12, 0.03);
      light.name = `faculty-serving-light-${number}-${lampIndex}`;
      room.add(light);
    }
    const roof = new THREE.Group();
    roof.name = `faculty-roof-${number}`;
    roof.userData.planHide = true;
    overhead.push(roof);
    room.add(roof);
    box(roof, 0, 4.05, -1.6, w, 0.14, 5.2, '#c4c5b7');
    for (let z = -4.1; z < 1; z += 0.22) box(roof, 0, 3.95, z, w, 0.06, 0.195, '#d8d9cc', 0.15);
    for (const x of [-w * 0.25, w * 0.25]) {
      box(roof, x, 3.885, -1.8, 1.5, 0.035, 0.055, '#fff6de', 0, 0.8);
      box(roof, x, 3.9, -3.3, 0.7, 0.04, 0.55, '#abb7aa', 0.35);
      for (let i = 0; i < 6; i++)
        box(roof, x - 0.28 + i * 0.11, 3.874, -3.3, 0.025, 0.012, 0.47, darkSteel, 0.4);
    }
    if (next) box(roof, w / 2 + gap / 2, 4.05, -1.6, gap + 0.003, 0.14, 5.2, '#c4c5b7');
    const frontage = new THREE.Group();
    frontage.name = `faculty-signage-${number}`;
    frontage.userData.planHide = true;
    overhead.push(frontage);
    room.add(frontage);
    if (number === 7) {
      box(frontage, 0, 3.84, 1.005, w, 0.26, 0.14, '#dedfd6');
      for (let i = 0; i < 3; i++) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(w / 3 - 0.055, 0.66), glass);
        pane.position.set(-w / 2 + ((i + 0.5) * w) / 3, 3.36, 0.89);
        frontage.add(pane);
      }
    }
    addFacultySignage(frontage, number, w);
    const strip = box(room, 0, 1.222, 1.09, w - 0.1, 0.022, 0.035, '#93866b');
    strip.material = strip.material.clone();
    strip.userData = { kind: 'stall', id: `${face.faceId}-w1`, baseColor: '#93866b' };
    const shortLabels: Record<number, string> = {
      1: '轻食能量站',
      2: '普通饭菜\n香锅／小炒／麻辣烫',
      3: '普通饭菜\n值班窗口',
      4: '普通饭菜\n滑蛋饭（晚餐）',
      5: '面食／教工下饭菜',
      6: '营养汤／免费汤',
      7: '明档小炒',
    };
    const tag = label(
      `${number}号 · ${shortLabels[number]}`,
      face.x,
      -5.25,
      w - 0.1,
      number >= 2 && number <= 4 ? 1.25 : 0.75,
    );
    tag.userData = { ...tag.userData, kind: 'stall', id: `${face.faceId}-w1` };
  }
  const model: FourthCanteenModel = {
    group,
    setMode(mode) {
      plan.visible = mode === 'plan';
      for (const node of overhead) node.visible = mode === '3d';
    },
    setInterfaceTheme() {},
    tick(time) {
      for (const entry of steam)
        entry.mesh.position.y = entry.y + Math.sin(time * 0.8 + entry.phase) * 0.065;
    },
  };
  model.setMode('plan');
  return model;
}
