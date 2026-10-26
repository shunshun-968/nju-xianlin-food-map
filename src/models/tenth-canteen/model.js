import * as THREE from 'three';
import { windows, mainFaces, columns, NORTH_FRONT_X } from './layout.js';
import { box, cylinder, tileSurface, mat, batchStatic } from './geometry.js';
import { addBanner, addWindowNumber, textPanel } from './signage.js';
import { addWindowInterior } from './interiors.js';
import { addFixtures } from './fixtures.js';

export function createTenthModel() {
  const group = new THREE.Group();
  group.name = 'tenth-canteen-standalone';
  const architecture = new THREE.Group();
  architecture.name = 'photographed-architecture';
  group.add(architecture);
  const labels = new THREE.Group();
  labels.name = 'plan-labels';
  group.add(labels);
  const ceiling = new THREE.Group();
  ceiling.name = 'removable-ceiling';
  ceiling.userData.planHide = true;
  group.add(ceiling);
  const planTargets = [],
    spatialTargets = [],
    interiors = [],
    selectionEdges = [],
    warmLights = [];
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#b4c8c0',
    roughness: 0.28,
    metalness: 0.05,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const targetMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  box(architecture, -1.5, -0.16, -2.4, 50, 0.32, 29.4, '#c7c3b6');
  tileSurface(architecture, {
    width: 50,
    height: 29.4,
    x: -1.5,
    y: 0.012,
    z: -2.4,
    horizontal: true,
    color: '#e6e1d4',
    tileX: 1.15,
    tileY: 1.15,
  });

  // The kitchen is an L-shaped union. Rear walls stop at the shared corner,
  // so the overlapping photograph views do not create duplicate kitchen walls.
  box(architecture, 2.45, 1.95, -4.36, 32.9, 3.9, 0.16, '#dddcd3');
  tileSurface(architecture, {
    width: 32.9,
    height: 3.8,
    x: 2.45,
    y: 1.96,
    z: -4.27,
    color: '#e8e8df',
  });
  const shortBack = new THREE.Group();
  shortBack.position.set(-13.94, 0, -9.25);
  shortBack.rotation.y = -Math.PI / 2;
  architecture.add(shortBack);
  box(shortBack, 0, 1.95, 0, 9.9, 3.9, 0.16, '#d9dbd2');
  tileSurface(shortBack, { width: 9.9, height: 3.8, y: 1.96, z: 0.09, color: '#e9e9df' });
  box(architecture, -16.15, 1.95, -14.28, 4.3, 3.9, 0.16, '#dddcd3');
  box(architecture, 18.95, 1.95, -2.15, 0.14, 3.9, 4.3, '#dddcd3');

  for (const c of columns) {
    const height = c.height ?? 3.86;
    const pillar = new THREE.Group();
    pillar.name = `pillar-${c.id}`;
    pillar.position.set(c.x, 0, c.z);
    architecture.add(pillar);
    box(pillar, 0, height / 2, 0, c.width, height, c.depth, '#e5e6dd');
    box(pillar, 0, 0.12, 0, c.width + 0.015, 0.24, c.depth + 0.015, '#9d9f94', 0.18);
    for (const x of [-c.width / 2, c.width / 2])
      box(pillar, x, height / 2, c.depth / 2 + 0.005, 0.035, height, 0.025, '#b0b9b2', 0.75, 0.28);
  }
  // Shared physical ceiling and cold-white fittings; roofs are removed in plan.
  function ceilingRun(x, z, w, d, rotation = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotation;
    ceiling.add(g);
    box(g, 0, 3.91, 0, w, 0.13, d, '#c7c9ba');
    for (let q = -d / 2 + 0.11; q < d / 2; q += 0.23)
      box(g, 0, 3.82, q, w, 0.025, 0.018, '#8b9489', 0.45);
    for (let q = -w / 2 + 1.45; q < w / 2; q += 3.0) {
      box(g, q, 3.77, d / 2 - 0.28, 1.9, 0.07, 0.19, '#c1c7be', 0.7);
      for (const dz of [-0.05, 0.05])
        box(g, q, 3.725, d / 2 - 0.28 + dz, 1.8, 0.025, 0.022, '#f4fff3', 0, 0.3, 1.2);
      box(g, q, 3.78, -0.7, 0.9, 0.07, 0.52, '#b7bdb3', 0.6);
      for (let l = -0.4; l <= 0.4; l += 0.1)
        box(g, q + l, 3.73, -0.7, 0.025, 0.02, 0.48, '#7b867b', 0.5);
    }
  }
  ceilingRun(0.3, -2.15, 37.2, 4.3);
  ceilingRun(-16.15, -9.25, 9.9, 4.3, -Math.PI / 2);

  function localFrame(window) {
    const g = new THREE.Group();
    g.name = window.id;
    g.position.set(window.x, 0, window.z);
    g.rotation.y = window.rotationY;
    architecture.add(g);
    return g;
  }
  for (const window of windows) {
    const p = localFrame(window),
      w = window.width;
    box(p, 0, 0.59, -0.25, w, 1.1, 0.58, '#d2d6cd');
    tileSurface(p, {
      width: w - 0.025,
      height: 1.02,
      y: 0.61,
      z: 0.047,
      color: '#eeeee6',
      tileX: 0.6,
      tileY: 0.3,
    });
    box(p, 0, 0.105, 0.055, w, 0.12, 0.045, '#8a9188', 0.25);
    box(p, 0, 1.155, -0.2, w, 0.12, 0.89, '#25312b', 0.26, 0.28);
    box(p, 0, 1.223, 0.245, w, 0.022, 0.027, '#76877f', 0.85, 0.25);
    const edge = box(p, 0, 1.234, 0.26, w - 0.13, 0.025, 0.036, '#8d8e76');
    edge.material = edge.material.clone();
    edge.userData.selection = true;
    edge.userData.groupId = window.groupId;
    selectionEdges.push(edge);
    // Open serving gap below the glazed screen; light reflections stay subtle.
    for (const x of [-w / 2, w / 2])
      box(p, x, 1.99, 0.02, 0.052, 1.82, 0.065, '#a6b3aa', 0.8, 0.22);
    for (const y of [1.68, 2.65]) box(p, 0, y, 0.018, w, 0.056, 0.075, '#94a49b', 0.82, 0.23);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.07, 0.92), glass);
    pane.position.set(0, 2.165, 0.017);
    p.add(pane);
    box(p, 0, 2.71, -0.02, w, 0.075, 0.19, '#65796d', 0.7);
    const number = addWindowNumber(p, window.number);
    number.position.set(w / 2 - 0.21, 2.44, 0.12);
    const equipment = addWindowInterior(p, {
      number: window.number,
      width: w,
      depth: 4.2,
      perpendicular: window.perpendicular,
    });
    interiors.push(equipment);
    const warm = new THREE.PointLight('#ffd5a2', 11, 4.9, 2);
    warm.position.set(0, 2.25, -0.7);
    p.add(warm);
    warm.name = `serving-light-${window.number}`;
    const preparation = new THREE.PointLight('#ffd08a', 0, 3.8, 2);
    preparation.position.set(0, 2.28, -2.35);
    preparation.name = `preparation-light-${window.number}`;
    p.add(preparation);
    warmLights.push({ warm, preparation });
    const fixture = new THREE.Group();
    fixture.name = `warm-fixture-${window.number}`;
    fixture.userData.planHide = true;
    p.add(fixture);
    box(fixture, 0, 2.64, -0.52, w - 0.3, 0.065, 0.18, '#9c977e', 0.6, 0.35);
    box(fixture, 0, 2.6, -0.52, w - 0.4, 0.023, 0.11, '#ffd08a', 0, 0.35, 1.8);
    // Visible cashier terminals and QR signs give the counter its working scale.
    const terminal = box(p, -w * 0.28, 1.29, -0.02, 0.27, 0.18, 0.17, '#273731', 0.25);
    terminal.rotation.x = -0.15;
    const screen = box(p, -w * 0.28, 1.35, 0.075, 0.2, 0.09, 0.01, '#98bcaa', 0.1, 0.35, 0.15);
    const qr = textPanel('扫码支付', 0.24, 0.16, { bg: '#faf9e8', ink: '#3e5145' });
    qr.position.set(w * 0.28, 1.34, -0.02);
    p.add(qr);
    const note = textPanel('请按需取餐', 0.29, 0.14, { bg: '#e7e2cb', ink: '#675b44' });
    note.position.set(w * 0.15, 2.13, 0.044);
    p.add(note);
    if (window.number === 1 || window.number >= 6) {
      const plan = textPanel(window.number === 1 ? '1—4 · 美食广场' : `${window.number} · ${window.number===16?'点餐':window.number===17?'取餐':window.title.split(' · ')[0]}`,
        window.number===1?3.6:w-.1,.42,{bg:'#fffbec',ink:'#4b5549'});
      plan.rotation.x=-Math.PI/2;
      const normal=new THREE.Vector3(Math.sin(window.rotationY),0,Math.cos(window.rotationY));
      plan.position.set(window.x-normal.x*4.65,4.08,(window.number===1?-9:window.z)-normal.z*4.65);
      plan.rotation.z=window.rotationY;
      labels.add(plan);
    }
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.8), targetMaterial);
    facade.position.set(0, 1.9, 0.32);
    facade.userData.window = window;
    p.add(facade);
    spatialTargets.push(facade);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.3), targetMaterial);
    hit.rotation.x = -Math.PI / 2;
    hit.position.set(0, 4.12, -2.1);
    hit.userData.window = window;
    p.add(hit);
    planTargets.push(hit);
  }
  for (const face of mainFaces) {
    const banner = addBanner(architecture, { photo: face.photo, width: face.width, height: 1.12 });
    banner.position.set(face.x, 3.29, 0.045);
  }
  const north = addBanner(architecture, { photo: 'north', width: 13.85, height: 1.12 });
  north.position.set(NORTH_FRONT_X - 0.045, 3.29, -7.275);
  north.rotation.y = -Math.PI / 2;

  function sign(number, text, w, h, bg = '#f3ead4', ink = '#3d3830', y = 2.5, x = 0) {
    const window = windows.find((v) => v.number === number),
      p = architecture.getObjectByName(window.id);
    const reserveNumber = w > 1.7;
    const m = textPanel(text, reserveNumber ? Math.min(w, window.width - 0.58) : w, h, {
      bg,
      ink,
      padding: 0.05,
    });
    m.position.set(reserveNumber ? -0.2 : x, y, 0.09);
    p.add(m);
    return m;
  }
  sign(6, '老 卤 面', 2.25, 0.24);
  sign(7, '美味砂锅系列', 2.25, 0.24);
  sign(
    6,
    '素鸡面 7元 / 份   榨菜肉丝面 8元 / 份\n大排面 10元 / 份   牛肉老卤面 15元 / 份',
    2.35,
    0.25,
    '#eee6cf',
    '#343b31',
    2.22,
  );
  sign(
    7,
    '猪肉汤砂锅 10元   三鲜砂锅 10元\n排骨砂锅 12元   红烧牛肉砂锅 18元',
    2.35,
    0.25,
    '#eee6cf',
    '#343b31',
    2.22,
  );
  sign(9, '地科\n用餐窗口', 0.46, 0.43, '#dd9ca4', '#592e37', 2.07, 0.5);
  sign(11, '学子特价套餐窗口', 2.5, 0.42, '#513044', '#f1e5d6', 2.38, -0.1);
  sign(11, '深夜食堂窗口', 1.2, 0.3, '#513044', '#f1e5d6', 1.98, -0.65);
  sign(13, '值班窗口\n中餐营业至13:30 · 晚餐营业至19:30', 2.55, 0.46, '#583444', '#eee5d5', 2.36);
  sign(
    16,
    '米线系列（中、晚餐供应）\n鸡柳米线 12元 / 份   毛肚米线 16元 / 份\n里脊片米线 15元 / 份   肥牛米线 18元 / 份',
    2.45,
    0.46,
    '#ead29f',
    '#743b27',
    2.36,
  );
  sign(
    17,
    '鸡排饭 12元 / 份   烤鸭饭 13元 / 份\n猪排饭 13元 / 份   牛排饭 15元 / 份',
    2.45,
    0.42,
    '#54313b',
    '#eee5d5',
    2.36,
  );
  sign(16, '点餐处', 0.38, 0.48, '#db9b94', '#593b36', 1.98, 0.95);
  sign(17, '取餐处', 0.38, 0.48, '#db9b94', '#593b36', 1.98, 0.95);
  const duty = textPanel('值班窗口\n中餐营业至13:30\n晚餐营业至19:30', 0.6, 0.55, {
    bg: '#454569',
    ink: '#f5f4e9',
  });
  duty.position.set(-18.32, 2.15, -0.05);
  duty.rotation.y = -Math.PI / 2;
  architecture.add(duty);
  const exit = textPanel('← 安全出口 EXIT', 0.78, 0.28, { bg: '#245c44', ink: '#e9f4d9' });
  exit.position.set(-18.32, 3.84, -8.7);
  exit.rotation.y = -Math.PI / 2;
  architecture.add(exit);
  const northArrow = textPanel('← 北 N', 1.9, 0.42, { bg: '#f2eddd', ink: '#777763' });
  northArrow.rotation.x = -Math.PI / 2;
  northArrow.position.set(-23, 0.035, -15.5);
  group.add(northArrow);
  const fixtures = addFixtures(architecture);
  batchStatic(group);
  const hidden = [];
  group.traverse((n) => {
    if (n.userData.planHide) hidden.push(n);
  });
  return {
    group,
    windows,
    planTargets,
    spatialTargets,
    setMode(mode) {
      const spatial = mode === '3d';
      labels.visible = !spatial;
      hidden.forEach((n) => (n.visible = spatial));
      for (const { warm, preparation } of warmLights) {
        warm.color.set(spatial ? '#ffc16c' : '#ffd5a2');
        warm.intensity = spatial ? 24 : 11;
        preparation.intensity = spatial ? 7 : 0;
      }
    },
    setSelection(id) {
      for (const edge of selectionEdges) {
        edge.material.color.set(edge.userData.groupId === id ? '#d7a75d' : '#8d8e76');
        edge.material.emissive.set(edge.userData.groupId === id ? '#99733a' : '#000000');
        edge.material.emissiveIntensity = 0.24;
      }
    },
    tick(time) {
      interiors.forEach((i) => i.tick?.(time));
      fixtures?.tick?.(time);
    },
  };
}
