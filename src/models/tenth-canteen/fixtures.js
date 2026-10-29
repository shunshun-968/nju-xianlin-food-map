import * as THREE from 'three';
import { loadModelTexture } from '../../lib/model-texture-loader';

/** Freestanding details observed in reference photos 1–3 and 8–9.
 * Coordinates follow the standalone model: -X is north, +Z is the dining aisle.
 */
export function addFixtures(parent) {
  const root = new THREE.Group();
  root.name = 'tenth-canteen-freestanding-fixtures';
  parent.add(root);
  const materials = new Map();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 20);
  const mat = (color, metalness = 0, roughness = 0.65) => {
    const key = `${color}/${metalness}/${roughness}`;
    if (!materials.has(key))
      materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return materials.get(key);
  };
  const mesh = (p, geometry, material, x, y, z) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    p.add(m);
    return m;
  };
  const box = (p, x, y, z, w, h, d, color, metalness = 0, roughness = 0.65) => {
    const m = mesh(p, cube, mat(color, metalness, roughness), x, y, z);
    m.scale.set(w, h, d);
    return m;
  };
  const cyl = (p, x, y, z, radius, height, color, metalness = 0) => {
    const m = mesh(p, cylinder, mat(color, metalness), x, y, z);
    m.scale.set(radius, height, radius);
    return m;
  };
  const ellipsoid = (p, x, y, z, sx, sy, sz, color, metalness = 0) => {
    const m = mesh(p, sphere, mat(color, metalness), x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const rod = (p, from, to, radius, color, metalness = 0) => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      delta = b.clone().sub(a);
    const m = cyl(p, 0, 0, 0, radius, delta.length(), color, metalness);
    m.position.copy(a.add(b).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return m;
  };
  const ring = (p, x, y, z, radius, tube, color, metalness = 0) =>
    mesh(p, new THREE.TorusGeometry(radius, tube, 8, 36), mat(color, metalness), x, y, z);

  function printedPanel(p, x, y, z, w, h, paint, width = 1024, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const m = mesh(
      p,
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
      x,
      y,
      z,
    );
    m.castShadow = false;
    return m;
  }

  function label(p, text, x, y, z, w, h, ink = '#5b375f', paper = '#f2eee2') {
    return printedPanel(
      p,
      x,
      y,
      z,
      w,
      h,
      (c, cw, ch) => {
        c.fillStyle = paper;
        c.fillRect(0, 0, cw, ch);
        c.fillStyle = ink;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `600 ${Math.min(ch * 0.68, (cw - 36) / text.length)}px "Microsoft YaHei",sans-serif`;
        c.fillText(text, cw / 2, ch / 2);
      },
      1024,
      Math.max(96, Math.round((1024 * h) / w)),
    );
  }

  function originalBrand(p, x, y, z, height) {
    // This artwork is the user's exact original; never redraw the brand text.
    const panel = mesh(
      p,
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }),
      x,
      y,
      z,
    );
    panel.scale.set(height * 3.4, height, 1);
    panel.castShadow = false;
    const brandMap = loadModelTexture(
      new URL('../../assets/branding/南大后勤.png', import.meta.url).href,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        panel.material.map = texture;
        panel.material.needsUpdate = true;
        panel.scale.x = (height * texture.image.width) / texture.image.height;
      },
    );
    // 立即交给模型持有，关闭场景时可释放尚在下载的纹理。
    panel.material.map = brandMap;
    brandMap.colorSpace = THREE.SRGBColorSpace;
    return panel;
  }

  function addFreezer() {
    const freezer = new THREE.Group();
    freezer.name = 'tenth-dumpling-supermarket';
    freezer.userData = { kind: 'fixture', label: '水饺超市', referencePhotos: [2, 3] };
    freezer.position.set(-20.1, 0, -1.7);
    freezer.rotation.y = -Math.PI / 2;
    root.add(freezer);
    // Insulated cavity and metal panels are real geometry, so the glass lid
    // reveals divided baskets from overhead instead of a flat food photograph.
    box(freezer, 0, 0.14, 0, 2.28, 0.1, 1.08, '#c7c8bc', 0.35);
    box(freezer, 0, 0.46, 0, 2.26, 0.57, 1.04, '#e7e8dd', 0.05);
    box(freezer, 0, 0.55, 0.523, 2.28, 0.78, 0.055, '#722452', 0.08);
    box(freezer, 0, 0.55, -0.523, 2.28, 0.78, 0.055, '#722452', 0.08);
    for (const x of [-1.13, 1.13]) box(freezer, x, 0.55, 0, 0.055, 0.78, 1.08, '#752453', 0.08);
    box(freezer, 0, 0.72, 0, 2.12, 0.045, 0.92, '#cbd3ca', 0.3);
    for (const z of [-0.51, 0.51]) box(freezer, 0, 0.99, z, 2.34, 0.075, 0.075, '#d6dad6', 0.55);
    for (const x of [-1.13, 1.13]) box(freezer, x, 0.99, 0, 0.075, 0.075, 1.08, '#d6dad6', 0.55);
    const dumplingPositions = [];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const x = (i - 1) * 0.68,
          z = (j - 0.5) * 0.44;
        box(freezer, x, 0.76, z, 0.62, 0.035, 0.38, '#a9b4ac', 0.6);
        for (const side of [-1, 1]) {
          box(freezer, x + side * 0.31, 0.81, z, 0.018, 0.13, 0.39, '#c7d1c9', 0.65);
          box(freezer, x, 0.81, z + side * 0.19, 0.62, 0.13, 0.018, '#c7d1c9', 0.65);
        }
        for (let dx = 0; dx < 3; dx++)
          for (let dz = 0; dz < 3; dz++)
            dumplingPositions.push([
              x + (dx - 1) * 0.17,
              0.82 + ((i + dx + dz) % 2) * 0.018,
              z + (dz - 1) * 0.105,
              (i + j + dx) * 0.42,
            ]);
      }
    const bodies = new THREE.InstancedMesh(sphere, mat('#ece9d6'), dumplingPositions.length);
    const pleats = new THREE.InstancedMesh(sphere, mat('#f4f0e3'), dumplingPositions.length * 5);
    const transform = new THREE.Object3D();
    dumplingPositions.forEach(([x, y, z, angle], i) => {
      transform.position.set(x, y, z);
      transform.rotation.set(0, angle, 0);
      transform.scale.set(0.083, 0.052, 0.04);
      transform.updateMatrix();
      bodies.setMatrixAt(i, transform.matrix);
      for (let k = 0; k < 5; k++) {
        const localX = (k - 2) * 0.026;
        transform.position.set(
          x + Math.cos(angle) * localX,
          y + 0.043 - Math.abs(k - 2) * 0.004,
          z - Math.sin(angle) * localX,
        );
        transform.rotation.set(0, angle, (k - 2) * 0.13);
        transform.scale.set(0.011, 0.019, 0.027);
        transform.updateMatrix();
        pleats.setMatrixAt(i * 5 + k, transform.matrix);
      }
    });
    bodies.castShadow = bodies.receiveShadow = true;
    freezer.add(bodies, pleats);
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#d9e8de',
      transparent: true,
      opacity: 0.19,
      roughness: 0.28,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const x of [-0.55, 0.55]) {
      const pane = mesh(freezer, cube, glass, x, 1.023, 0);
      pane.scale.set(1.08, 0.018, 0.94);
      pane.castShadow = false;
      box(freezer, x, 1.035, 0.46, 1.09, 0.028, 0.024, '#e4e6df', 0.4);
      box(freezer, x, 1.035, -0.46, 1.09, 0.028, 0.024, '#e4e6df', 0.4);
      box(freezer, x + 0.45, 1.05, 0.06, 0.035, 0.025, 0.26, '#858f89', 0.55);
    }
    box(freezer, 0, 1.035, 0, 0.025, 0.025, 0.96, '#cbd3cd', 0.55);
    printedPanel(
      freezer,
      -0.14,
      0.53,
      0.554,
      1.91,
      0.72,
      (c, w, h) => {
        c.fillStyle = '#772550';
        c.fillRect(0, 0, w, h);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#f5eee4';
        c.font = '700 84px "Microsoft YaHei",sans-serif';
        c.fillText('水饺超市', w * 0.56, h * 0.17);
        const names = [
          '猪肉白菜水饺',
          '猪肉芹菜水饺',
          '猪肉韭菜水饺',
          '三鲜水饺',
          '猪肉香菇水饺',
          '猪肉玉米蔬菜水饺',
        ];
        names.forEach((name, i) => {
          const x = 44 + Math.floor(i / 3) * 487,
            y = 166 + (i % 3) * 83;
          c.fillStyle = '#f1e9de';
          c.fillRect(x, y, 449, 69);
          c.fillStyle = '#5a2345';
          c.font = `600 ${name.length > 7 ? 41 : 48}px "Microsoft YaHei",sans-serif`;
          c.fillText(name, x + 224, y + 35);
        });
        c.fillStyle = '#fff5e7';
        c.font = '600 37px "Microsoft YaHei",sans-serif';
        c.fillText('称重销售 1.58元/50克   元宵1元3个', w / 2, 452);
        c.font = '26px "Microsoft YaHei",sans-serif';
        c.fillText('多种口味馅料、蘸料  任意选择、按需取用', w / 2, 495);
      },
      1024,
      540,
    );
    originalBrand(freezer, -0.86, 0.84, 0.557, 0.075);
    box(freezer, 1.035, 0.52, 0.558, 0.22, 0.72, 0.04, '#e6e8e2');
    box(freezer, 1.035, 0.74, 0.582, 0.14, 0.055, 0.008, '#344344');
    label(freezer, '-18', 1.035, 0.74, 0.588, 0.12, 0.034, '#b9e6c1', '#263734');
    for (let i = 0; i < 14; i++)
      box(freezer, 1.035, 0.24 + i * 0.02, 0.583, 0.16, 0.009, 0.006, '#718078', 0.45);
    for (const x of [-0.94, 0.94])
      for (const z of [-0.39, 0.39]) {
        cyl(freezer, x, 0.12, z, 0.024, 0.16, '#a9aca4', 0.65);
        const wheel = cyl(freezer, x, 0.065, z, 0.059, 0.035, '#353b36');
        wheel.rotation.z = Math.PI / 2;
      }
    return freezer;
  }

  function addCondimentTable(z, variant) {
    const table = new THREE.Group();
    table.name = `tenth-condiment-table-${variant}`;
    table.position.set(-20, 0, z);
    table.rotation.y = -Math.PI / 2;
    root.add(table);
    box(table, 0, 0.805, 0, 1.5, 0.055, 0.7, '#bfa077');
    box(table, 0, 0.84, 0, 1.53, 0.028, 0.73, '#e8e3d4');
    // Two subtle rubbed corners and pale surface streaks, not fake large grime.
    box(table, -0.73, 0.831, 0.29, 0.045, 0.028, 0.1, '#a98a5f');
    box(table, 0.73, 0.831, -0.28, 0.035, 0.025, 0.08, '#b39367');
    for (const x of [-0.61, 0.61])
      for (const depth of [-0.26, 0.26])
        rod(table, [x * 1.06, 0.03, depth * 1.1], [x, 0.8, depth], 0.031, '#b99766');
    rod(table, [-0.61, 0.22, 0], [0.61, 0.22, 0], 0.023, '#b8986b');
    for (let i = 0; i < 3; i++) {
      const x = -0.3 + i * 0.23;
      cyl(table, x, 0.92, -0.08, 0.079, 0.14, '#adb5ac', 0.68);
      cyl(table, x, 0.997, -0.08, 0.083, 0.016, '#d2d6cb', 0.55);
      ellipsoid(table, x, 1.015, -0.08, 0.016, 0.01, 0.016, '#68746c', 0.35);
      rod(table, [x + 0.035, 0.985, -0.08], [x + 0.085, 1.05, -0.02], 0.006, '#d5d9cc', 0.7);
    }
    box(table, 0.02, 0.863, -0.08, 0.73, 0.014, 0.27, '#b8c3b6', 0.5);
    cyl(table, -0.56, 0.94, 0.08, 0.07, 0.18, '#d4d0bd');
    cyl(table, -0.56, 1.033, 0.08, 0.058, 0.005, '#4b4840');
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.4,
        r = 0.04 * Math.sqrt((i + 1) / 14);
      rod(
        table,
        [-0.56 + Math.sin(angle) * r, 0.97, 0.08 + Math.cos(angle) * r],
        [
          -0.56 + Math.sin(angle) * r * 1.2,
          1.19 + (i % 3) * 0.012,
          0.08 + Math.cos(angle) * r * 1.2,
        ],
        0.006,
        '#a68a5e',
      );
    }
    const notice = new THREE.Group();
    notice.position.set(0.54, 0.88, -0.1);
    notice.rotation.x = -0.12;
    table.add(notice);
    box(notice, 0, 0.1, 0, 0.21, 0.25, 0.015, '#b8bcb1', 0.5);
    printedPanel(
      notice,
      0,
      0.1,
      0.011,
      0.185,
      0.225,
      (c, w, h) => {
        c.fillStyle = '#efece2';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#795377';
        c.fillRect(40, 35, w - 80, 80);
        c.fillStyle = '#8a8c83';
        for (let row = 0; row < 8; row++)
          c.fillRect(55, 150 + row * 45, w - 110 - (row % 3) * 45, 12);
      },
      480,
      600,
    );
    box(notice, 0, -0.01, 0.01, 0.22, 0.018, 0.14, '#c2c8bd', 0.55);
  }

  function addFireCabinet() {
    const cabinet = new THREE.Group();
    cabinet.name = 'tenth-fire-cabinet-photo-9';
    cabinet.position.set(12.2, 0, 0.02);
    root.add(cabinet);
    box(cabinet, 0, 1.5, -0.08, 0.67, 2.75, 0.12, '#d5d9cf', 0.3);
    box(cabinet, 0, 1.5, -0.007, 0.58, 2.63, 0.012, '#943739');
    for (const x of [-0.319, 0.319]) box(cabinet, x, 1.5, 0.12, 0.036, 2.75, 0.25, '#e4e5db', 0.35);
    for (const y of [0.142, 0.91, 2.858])
      box(cabinet, 0, y, 0.12, 0.65, 0.035, 0.25, '#e4e5db', 0.35);
    const reel = cyl(cabinet, 0, 2.07, 0.057, 0.245, 0.075, '#b94744');
    reel.rotation.x = Math.PI / 2;
    ring(cabinet, 0, 2.07, 0.105, 0.215, 0.015, '#7a252b');
    const points = [];
    for (let i = 0; i <= 150; i++) {
      const angle = (i / 150) * Math.PI * 7.8,
        radius = 0.055 + (i / 150) * 0.145;
      points.push(
        new THREE.Vector3(Math.sin(angle) * radius, 2.07 + Math.cos(angle) * radius, 0.12),
      );
    }
    mesh(
      cabinet,
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 150, 0.014, 6, false),
      mat('#414b3f'),
      0,
      0,
      0,
    );
    const hub = cyl(cabinet, 0, 2.07, 0.145, 0.045, 0.055, '#8d9990', 0.65);
    hub.rotation.x = Math.PI / 2;
    rod(cabinet, [-0.18, 1.91, 0.1], [-0.22, 1.56, 0.12], 0.018, '#46513f');
    const hose = cyl(cabinet, -0.06, 1.16, 0.08, 0.18, 0.1, '#dedccd');
    hose.rotation.x = Math.PI / 2;
    for (const radius of [0.05, 0.08, 0.11, 0.14, 0.17])
      ring(cabinet, -0.06, 1.16, 0.14, radius, 0.005, '#b9bba8');
    rod(cabinet, [0.17, 1.02, 0.1], [0.17, 1.34, 0.1], 0.023, '#a9b1a6', 0.6);
    for (const x of [-0.14, 0.14]) {
      cyl(cabinet, x, 0.44, 0.1, 0.085, 0.48, '#bb3931', 0.12);
      ellipsoid(cabinet, x, 0.69, 0.1, 0.077, 0.045, 0.077, '#bb3931');
      cyl(cabinet, x, 0.75, 0.1, 0.025, 0.08, '#3e4540', 0.4);
      box(cabinet, x, 0.79, 0.1, 0.1, 0.025, 0.025, '#303b35');
      rod(cabinet, [x + 0.045, 0.76, 0.1], [x + 0.08, 0.44, 0.16], 0.011, '#333b32');
      label(cabinet, '灭火器', x, 0.48, 0.187, 0.1, 0.15, '#902b2d', '#e9e4d2');
    }
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#c9d8ce',
      transparent: true,
      opacity: 0.1,
      roughness: 0.25,
      depthWrite: false,
    });
    const upper = mesh(cabinet, new THREE.PlaneGeometry(0.57, 1.87), glass, 0, 1.89, 0.244);
    upper.castShadow = false;
    const lower = mesh(cabinet, new THREE.PlaneGeometry(0.57, 0.69), glass, 0, 0.52, 0.244);
    lower.castShadow = false;
    label(cabinet, '消火栓', 0, 1.57, 0.251, 0.47, 0.17, '#aa3f37', '#dce4cf');
    label(cabinet, 'FIRE HYDRANT', 0, 1.455, 0.251, 0.43, 0.047, '#435546', '#dce4cf');
    label(cabinet, '灭火器箱', 0, 0.3, 0.251, 0.44, 0.1, '#a44437', '#e6dec6');
    for (const y of [1.38, 0.62])
      rod(cabinet, [0.244, y - 0.05, 0.255], [0.244, y + 0.05, 0.255], 0.013, '#9ca79d', 0.7);
    printedPanel(cabinet, 0, 2.58, 0.252, 0.49, 0.31, (c, w, h) => {
      c.fillStyle = '#426795';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d6e4de';
      c.lineWidth = 10;
      c.strokeRect(12, 12, w - 24, h - 24);
      c.fillStyle = '#eff3e9';
      c.font = 'bold 58px "Microsoft YaHei",sans-serif';
      c.textAlign = 'center';
      c.fillText('消火栓使用方法', w / 2, 85);
      for (let i = 0; i < 5; i++) c.fillRect(65, 130 + i * 60, w - 130, 14);
    });
  }

  function chair(p, x, z, angle) {
    const chair = new THREE.Group();
    chair.position.set(x, 0, z);
    chair.rotation.y = angle;
    p.add(chair);
    box(chair, 0, 0.445, 0, 0.56, 0.05, 0.5, '#aa8050');
    for (const dx of [-0.21, 0.21])
      for (const dz of [-0.18, 0.18]) {
        rod(chair, [dx * 1.1, 0.035, dz * 1.1], [dx, 0.44, dz], 0.019, '#969b8c', 0.5);
        cyl(chair, dx * 1.1, 0.026, dz * 1.1, 0.022, 0.036, '#4c5145');
      }
    const back = mesh(
      chair,
      new THREE.CylinderGeometry(0.31, 0.31, 0.32, 20, 1, true, Math.PI / 2, Math.PI),
      mat('#ae895b'),
      0,
      0.72,
      0,
    );
    back.material = back.material.clone();
    back.material.side = THREE.DoubleSide;
    for (const dx of [-0.25, 0.25])
      rod(chair, [dx, 0.43, -0.18], [dx, 0.83, -0.18], 0.019, '#a78658');
  }

  function roundTable(x, z, index, chairs = 3) {
    const table = new THREE.Group();
    table.name = `tenth-round-dining-table-${index}`;
    table.position.set(x, 0, z);
    root.add(table);
    cyl(table, 0, 0.79, 0, 0.78, 0.055, '#dddcd1');
    cyl(table, 0, 0.765, 0, 0.782, 0.022, '#bfc3b7', 0.3);
    cyl(table, 0, 0.41, 0, 0.065, 0.7, '#9da799', 0.65);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      rod(
        table,
        [0, 0.08, 0],
        [Math.sin(angle) * 0.52, 0.035, Math.cos(angle) * 0.52],
        0.035,
        '#959f90',
        0.55,
      );
    for (let i = 0; i < chairs; i++) {
      const angle = (i / chairs) * Math.PI * 2 + (index % 2) * 0.22;
      chair(table, Math.sin(angle) * 1.07, Math.cos(angle) * 1.07, angle + Math.PI);
    }
    if (index === 1 || index === 4) {
      box(table, 0.08, 0.835, 0.03, 0.5, 0.028, 0.36, '#bcc7ba', 0.5);
      const bowl = mesh(
        table,
        new THREE.CylinderGeometry(0.12, 0.073, 0.08, 18),
        mat('#e8e3d2'),
        -0.02,
        0.89,
        0.03,
      );
      cyl(table, -0.02, 0.932, 0.03, 0.102, 0.006, '#b48c56');
      for (let i = 0; i < 2; i++)
        rod(
          table,
          [0.21 + i * 0.026, 0.863, -0.12],
          [0.19 + i * 0.026, 0.863, 0.18],
          0.005,
          '#8c744b',
        );
      bowl.name = 'used-soup-bowl';
    }
  }

  addFreezer();
  addCondimentTable(-6.4, 1);
  addCondimentTable(-10.4, 2);
  addFireCabinet();
  [
    [-10, 4.6],
    [0, 4.6],
    [10, 4.6],
    [19, 4.6],
    [0, 8.2],
    [-23, -9],
  ].forEach(([x, z], index) => roundTable(x, z, index, index === 5 ? 2 : 3));
  return { group: root, tick() {}, planObjects: [] };
}
