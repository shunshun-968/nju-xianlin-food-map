import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ENTRANCE_SIGNS, createSignFactory } from "./entrance-signs.js";

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const toWorld = (point) =>
  new THREE.Vector3(...point).applyAxisAngle(Y_AXIS, Math.PI / 2);

/** Photographic reconstruction, in schematic metres. World +X east / -Z north. */
export function createBuilding() {
  const group = new THREE.Group();
  group.name = "canteen-456-exterior";
  group.rotation.y = Math.PI / 2;
  const shell = new THREE.Group();
  shell.name = "facades-and-entrances";
  const roof = new THREE.Group();
  roof.name = "roof-overview";
  const context = new THREE.Group();
  context.name = "plaza-planting";
  const labels = new THREE.Group();
  labels.name = "optional-entry-markers";
  group.add(shell, roof, context, labels);
  const matCache = new Map();
  const textures = new Set();
  const highlights = new Map();
  const entryMeshes = [];

  function material(color, roughness = 0.75, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!matCache.has(key))
      matCache.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness, metalness }),
      );
    return matCache.get(key);
  }
  const stone = material("#8a8b86");
  const concrete = material("#d9d9cf");
  const white = material("#eceee5");
  const steel = material("#b8c5bd", 0.28, 0.65);
  const darkFrame = material("#667570", 0.38, 0.48);
  const dark = material("#263631");
  function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
    const obj = new THREE.Mesh(geometry, mat);
    obj.position.set(x, y, z);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  function box(parent, x, y, z, w, h, d, mat = stone) {
    return mesh(
      parent,
      new THREE.BoxGeometry(w, h, d),
      typeof mat === "string" ? material(mat) : mat,
      x,
      y,
      z,
    );
  }
  function cylinder(parent, x, y, z, r, h, mat = white, segments = 20) {
    return mesh(
      parent,
      new THREE.CylinderGeometry(r, r, h, segments),
      mat,
      x,
      y,
      z,
    );
  }
  function bar(parent, a, b, r = 0.045, mat = steel) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      delta = end.clone().sub(start);
    const obj = mesh(
      parent,
      new THREE.CylinderGeometry(r, r, delta.length(), 8),
      mat,
    );
    obj.position.copy(start.add(end).multiplyScalar(0.5));
    obj.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
    return obj;
  }
  function tileTexture(base, seam, tileW, tileH) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d");
    c.fillStyle = base;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = seam;
    for (let yy = 0, row = 0; yy < 256; yy += tileH, row++) {
      c.fillRect(0, yy, 256, 1.2);
      for (let xx = ((row % 2) * tileW) / 2; xx < 256; xx += tileW)
        c.fillRect(xx, yy, 1, tileH);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    textures.add(texture);
    return texture;
  }
  const grayBrick = tileTexture("#898e89", "#777e77", 33, 10);
  const whiteTile = tileTexture("#dddccf", "#b7b7a8", 30, 30);
  const brickMaterials = new Map();
  function patternedWall(parent, x, y, z, w, h, d, light = false, tint) {
    const key = `${w}/${h}/${d}/${light}/${tint ?? ""}`;
    if (!brickMaterials.has(key)) {
      const map = (light ? whiteTile : grayBrick).clone();
      map.needsUpdate = true;
      map.repeat.set(Math.max(w, d) / 3.5, h / 3.5);
      textures.add(map);
      brickMaterials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: tint ?? (light ? "#f7f5ea" : "#c7ccc7"),
          map,
          roughness: 0.94,
        }),
      );
    }
    return box(parent, x, y, z, w, h, d, brickMaterials.get(key));
  }
  const glassColors = [
    "#738e91",
    "#7d9999",
    "#8ea7a7",
    "#687f82",
    "#95aaa6",
    "#758f90",
  ];
  const glasses = glassColors.map(
    (color) =>
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.22,
        roughness: 0.25,
        clearcoat: 0.55,
        clearcoatRoughness: 0.15,
      }),
  );
  const curtain = material("#c6d1c9", 0.9);
  function curtainWall(
    parent,
    x,
    y,
    z,
    w,
    h,
    rot = 0,
    {
      columns = Math.round(w / 2),
      rows = Math.round(h / 1.7),
      holes = [],
    } = {},
  ) {
    const facade = new THREE.Group();
    facade.position.set(x, y, z);
    facade.rotation.y = rot;
    parent.add(facade);
    const cw = w / columns,
      rh = h / rows;
    function isHole(cx, cy) {
      return holes.some(
        (b) => cx > b[0] && cx < b[1] && cy > b[2] && cy < b[3],
      );
    }
    for (let col = 0; col < columns; col++)
      for (let row = 0; row < rows; row++) {
        const px = -w / 2 + cw * (col + 0.5),
          py = rh * (row + 0.5);
        if (isHole(px, py)) continue;
        const isDark = row % 3 === 2 && (col + row) % 4 !== 0;
        box(
          facade,
          px,
          py,
          0,
          cw - 0.09,
          rh - 0.075,
          0.06,
          isDark ? dark : glasses[(col * 7 + row * 3) % glasses.length],
        );
        if (row === rows - 2 && col % 3 !== 0) {
          box(facade, px, py, -0.055, cw - 0.15, rh - 0.13, 0.035, curtain);
          for (let s = 1; s < 6; s++)
            box(
              facade,
              px - cw / 2 + (s * cw) / 6,
              py,
              0.036,
              0.026,
              rh - 0.16,
              0.014,
              "#a7bbb1",
            );
        }
        if (!isDark && row % 3 === 0 && col % 3 === 0)
          box(
            facade,
            px,
            py - rh * 0.15,
            0.045,
            cw * 0.85,
            0.035,
            0.04,
            "#cebe9a",
          );
      }
    const segments = (min, max, cuts) => {
      const result = [];
      let cursor = min;
      for (const [a, b] of cuts.sort((a, b) => a[0] - b[0])) {
        const start = Math.max(min, a),
          end = Math.min(max, b);
        if (start > cursor) result.push([cursor, start]);
        cursor = Math.max(cursor, end);
      }
      if (cursor < max) result.push([cursor, max]);
      return result;
    };
    // Glass doors cut both panes and mullions; no continuous bar crosses a walk-through opening.
    for (let i = 0; i <= columns; i++) {
      const xx = -w / 2 + i * cw;
      const cuts = holes
        .filter((b) => xx > b[0] && xx < b[1])
        .map((b) => [b[2], b[3]]);
      for (const [a, b] of segments(0, h, cuts))
        box(facade, xx, (a + b) / 2, 0.075, 0.075, b - a, 0.105, steel);
    }
    for (let i = 0; i <= rows; i++) {
      const yy = i * rh;
      const cuts = holes
        .filter((b) => yy > b[2] && yy < b[3])
        .map((b) => [b[0], b[1]]);
      for (const [a, b] of segments(-w / 2, w / 2, cuts))
        box(facade, (a + b) / 2, yy, 0.075, b - a, 0.07, 0.105, steel);
    }
    return facade;
  }
  function smallWindow(parent, x, y, z, w, h, rot = 0) {
    const win = new THREE.Group();
    win.position.set(x, y, z);
    win.rotation.y = rot;
    parent.add(win);
    box(win, 0, 0, 0, w + 0.13, h + 0.13, 0.08, darkFrame);
    box(win, 0, 0, 0.045, w, h, 0.025, glasses[2]);
    box(win, w * 0.2, 0, 0.075, 0.05, h, 0.04, steel);
    box(win, 0, -h * 0.18, 0.075, w, 0.05, 0.04, steel);
  }
  function textPlane(
    text,
    w,
    h,
    {
      color = "#f2f1df",
      background = "",
      size = 128,
      font = "Microsoft YaHei",
    } = {},
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.max(128, Math.round((1024 * h) / w));
    const c = canvas.getContext("2d");
    if (background) {
      c.fillStyle = background;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    c.fillStyle = color;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `600 ${Math.min(size, canvas.height * 0.75, (canvas.width * 0.9) / [...text].length)}px "${font}", sans-serif`;
    c.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.94);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    textures.add(map);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map,
        transparent: !background,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
  }
  const signPlane = createSignFactory({
    tiledBacking: (parent, w, h, depth, light) =>
      patternedWall(
        parent,
        0,
        0,
        -depth / 2,
        w,
        h,
        depth,
        light,
        light ? "#a4afaa" : undefined,
      ),
    registerTexture: (texture) => textures.add(texture),
  });
  function railing(parent, a, b, { height = 1.05, glass = false } = {}) {
    const p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b),
      len = p.distanceTo(q),
      n = Math.max(1, Math.ceil(len / 1.7));
    for (let i = 0; i <= n; i++) {
      const s = p.clone().lerp(q, i / n);
      bar(parent, s.toArray(), [s.x, s.y + height, s.z], 0.042);
    }
    bar(parent, [p.x, p.y + height, p.z], [q.x, q.y + height, q.z], 0.045);
    bar(parent, [p.x, p.y + 0.45, p.z], [q.x, q.y + 0.45, q.z], 0.025);
    if (glass) {
      const panel = box(
        parent,
        (p.x + q.x) / 2,
        (p.y + q.y) / 2 + height * 0.5,
        (p.z + q.z) / 2,
        len,
        0.83,
        0.035,
        new THREE.MeshPhysicalMaterial({
          color: "#bdd5cd",
          transparent: true,
          opacity: 0.29,
          roughness: 0.18,
          metalness: 0.08,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      panel.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
    }
  }
  function stairs(
    parent,
    x,
    nearZ,
    farZ,
    width,
    bottomY,
    topY,
    { rails = 3, stepHeight = 0.19 } = {},
  ) {
    const n = Math.max(1, Math.round((topY - bottomY) / stepHeight));
    const dz = (nearZ - farZ) / n;
    for (let i = 0; i < n; i++) {
      const y = bottomY + ((topY - bottomY) * (i + 1)) / n;
      box(
        parent,
        x,
        (bottomY + y) / 2,
        nearZ - dz * (i + 0.5),
        width,
        y - bottomY,
        Math.abs(dz) + 0.012,
        "#9eaaa0",
      );
      box(
        parent,
        x,
        y + 0.006,
        nearZ - dz * i - Math.sign(dz) * 0.025,
        width,
        0.025,
        0.065,
        "#d8dbcf",
      );
    }
    for (let i = 0; i < rails; i++) {
      const rx =
        x - width / 2 + 0.25 + ((width - 0.5) * i) / Math.max(rails - 1, 1);
      railing(
        parent,
        [rx, bottomY + 0.1, nearZ - Math.sign(dz) * 0.1],
        [rx, topY + 0.1, farZ + Math.sign(dz) * 0.1],
      );
    }
  }
  function flatSlab(
    parent,
    vertices,
    y,
    thickness,
    holes = [],
    mat = concrete,
  ) {
    const shape = new THREE.Shape();
    vertices.forEach(([x, z], i) =>
      i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
    );
    shape.closePath();
    for (const points of holes) {
      const h = new THREE.Path();
      points.forEach(([x, z], i) => (i ? h.lineTo(x, -z) : h.moveTo(x, -z)));
      h.closePath();
      shape.holes.push(h);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    return mesh(parent, geo, mat, 0, y - thickness, 0);
  }
  const footprint = [
    [-30, -27],
    [-6, -27],
    [-6, -10],
    [6, -10],
    [6, -27],
    [30, -27],
    [30, 27],
    [20, 27],
    [20, 17],
    [3, 17],
    [3, 27],
    [-30, 27],
    [-30, 20],
    [-25, 20],
    [-25, 13],
    [-30, 13],
  ];
  const courtHoles = [
    [
      [-23, -19],
      [-7, -19],
      [-7, -5],
      [-23, -5],
    ],
    [
      [7, -19],
      [23, -19],
      [23, -5],
      [7, -5],
    ],
  ];
  // Slabs establish the different entrance levels, never closing the rear service notch.
  flatSlab(shell, footprint, -2.0, 0.42, [], material("#d7d8cf"));
  for (const level of [3.8, 9.6, 14.1])
    flatSlab(
      shell,
      footprint,
      level,
      0.2,
      level > 11 ? courtHoles : [],
      material("#b9bfb3"),
    );
  // Rear and flanking perimeter walls retain courtyards and service circulation.
  for (const side of [-1, 1]) {
    patternedWall(shell, side * 18, 8.9, -27, 24, 18.5, 0.34);
    patternedWall(shell, side * 6, 8.9, -18.5, 0.34, 18.5, 17);
    patternedWall(shell, side * 29.9, 8.9, -24, 0.4, 18.5, 6);
    for (const y of [3, 8.3, 13.5])
      smallWindow(shell, side * 30.14, y, -24, 2.2, 1.8, (side * Math.PI) / 2);
    for (const y of [3, 8.3, 13.5])
      for (const x of [side * 11, side * 18, side * 25])
        smallWindow(shell, x, y, -27.2, 1.8, 1.7, Math.PI);
  }
  curtainWall(shell, 0, 0.2, -10.1, 12, 17.8, Math.PI, {
    columns: 6,
    rows: 10,
  });
  // Front: long glazed south portion, recessed open stair hall, solid northern end.
  patternedWall(shell, -26.5, 10.8, 26.9, 7, 14.9, 0.42);
  for (const y of [8.2, 13.7]) {
    smallWindow(shell, -27.5, y, 27.14, 2.1, 2.2);
    smallWindow(shell, -24.3, y + 1, 27.14, 0.95, 0.95);
  }
  curtainWall(shell, -10, 3.9, 26.9, 26, 14.1, 0, {
    columns: 14,
    rows: 9,
    holes: [[7.2, 13, 0, 3.1]],
  });
  patternedWall(shell, -23.8, 1.6, 26.75, 12.4, 4.2, 0.42, true);
  patternedWall(shell, -3.6, 1.6, 26.75, 13.6, 4.2, 0.42, true);
  patternedWall(shell, -14, 2.5, 26.75, 7.2, 2.4, 0.42, true);
  for (let x = -28; x < 0; x += 4.2)
    if (Math.abs(x + 14) > 5.5) smallWindow(shell, x, 1.3, 27.02, 3.0, 1.4);
  patternedWall(shell, 21.2, 10.95, 26.9, 2.4, 14.5, 0.42);
  patternedWall(shell, 28.8, 10.95, 26.9, 2.4, 14.5, 0.42);
  patternedWall(shell, 25, 12.65, 26.9, 5.2, 11.1, 0.42);
  for (const y of [9.3, 14.7]) {
    smallWindow(shell, 24.2, y, 27.14, 2.2, 2.0);
    smallWindow(shell, 28, y + 0.8, 27.14, 0.85, 0.85);
  }
  // A cut in the base wall leaves the northern fifth-canteen entrance accessible.
  patternedWall(shell, 21.35, 1.65, 26.9, 2.7, 4.3, 0.42, true);
  patternedWall(shell, 28.65, 1.65, 26.9, 2.7, 4.3, 0.42, true);
  curtainWall(shell, 11.5, 9.6, 16.95, 17, 8.4, 0, {
    columns: 9,
    rows: 5,
    holes: [[-3.5, 3.5, 0, 3]],
  });
  curtainWall(shell, 19.9, 3.85, 21.9, 10.2, 14.15, -Math.PI / 2, {
    columns: 6,
    rows: 8,
  });
  patternedWall(shell, 3.08, 11.1, 21.9, 0.2, 14.4, 10.2);
  // North elevation; its eastern wall has a low fourth-canteen side door.
  curtainWall(shell, 30.05, 3.9, -5, 32, 14.1, Math.PI / 2, {
    columns: 18,
    rows: 9,
  });
  patternedWall(shell, 29.9, 1.6, -5, 0.38, 4.2, 32, true);
  for (let z = -19; z < 11; z += 6)
    smallWindow(shell, 30.14, 1.5, z, 4.4, 2.4, Math.PI / 2);
  patternedWall(shell, 29.9, 10.9, 19, 0.4, 14.2, 16);
  patternedWall(shell, 29.9, 1.6, 13.25, 0.4, 4.2, 4.5, true);
  patternedWall(shell, 29.9, 1.6, 23.75, 0.4, 4.2, 6.5, true);
  for (const y of [7.4, 13])
    for (const z of [14, 23])
      smallWindow(shell, 30.14, y, z, 2.2, 2, Math.PI / 2);
  // South: front grey end, tall glazed side and a real recessed entrance notch.
  curtainWall(shell, -30.05, 3.9, -4, 34, 14.1, -Math.PI / 2, {
    columns: 19,
    rows: 9,
  });
  patternedWall(shell, -29.9, 1.6, -5, 0.4, 4.2, 32, true);
  patternedWall(shell, -29.9, 1.6, 12, 0.4, 4.2, 2, true);
  for (let z = -19; z < 11; z += 6)
    smallWindow(shell, -30.15, 1.5, z, 4.4, 2.4, -Math.PI / 2);
  patternedWall(shell, -29.9, 10.9, 23.5, 0.4, 14.2, 7);
  patternedWall(shell, -29.9, 1.6, 25.4, 0.4, 4.2, 3.2, true);
  for (const y of [7.4, 13]) {
    smallWindow(shell, -30.14, y, 23.2, 2.1, 2, -Math.PI / 2);
    smallWindow(shell, -30.14, y + 1, 26, 0.8, 0.8, -Math.PI / 2);
  }
  curtainWall(shell, -25.1, 3.8, 16.5, 7, 14.2, -Math.PI / 2, {
    columns: 4,
    rows: 9,
    holes: [[-3, 3, 0, 3.1]],
  });
  curtainWall(shell, -27.55, 3.8, 13.05, 5, 14.2, 0, { columns: 3, rows: 8 });
  patternedWall(shell, -27.5, 11.1, 19.95, 5, 14.4, 0.24);
  const sixthVertical = signPlane(ENTRANCE_SIGNS.verticalSixth, 1.2);
  sixthVertical.rotation.y = -Math.PI / 2;
  sixthVertical.position.set(-30.18, 12.0, 11.5);
  shell.add(sixthVertical);

  // The high white-column portico is deliberately offset toward the north.
  for (const x of [4.0, 13, 15.6, 18.2])
    cylinder(shell, x, 11.0, 26.7, 0.31, 14.4, white, 24);
  box(shell, 11.5, 18.1, 26.8, 17.5, 0.66, 0.6, white);
  for (const x of [3.2, 7.4, 11.6, 15.8, 20])
    box(roof, x, 18.15, 21.8, 0.18, 0.3, 10.5, white);
  for (const z of [17.2, 20.3, 23.4, 26.6])
    box(roof, 11.5, 18.15, z, 17.3, 0.3, 0.18, white);
  // Fifth platform and two successive flights, matching the photos' three levels.
  box(shell, 14.5, 3.65, 28.2, 33, 0.3, 2.8, concrete);
  box(shell, -13, 3.65, 28.1, 32, 0.3, 2.5, concrete);
  stairs(shell, 14.5, 40.8, 29.5, 33, 0, 3.8, { rails: 5 });
  box(shell, 11.4, 3.68, 27.4, 17, 0.24, 2.0, concrete);
  stairs(shell, 12.4, 26.7, 23.05, 13.8, 3.8, 6.7, { rails: 4 });
  box(shell, 12.4, 6.55, 22.35, 13.8, 0.3, 1.4, concrete);
  stairs(shell, 12.4, 21.65, 18.0, 13.8, 6.7, 9.6, { rails: 4 });
  for (let i = 0; i < 4; i++) {
    const rx = 12.4 - 6.9 + 0.25 + (13.3 * i) / 3;
    railing(shell, [rx, 6.8, 23.05], [rx, 6.8, 21.65]);
  }
  box(shell, 11.4, 9.45, 17.3, 16.8, 0.3, 1.7, concrete);
  // Escalator on the left edge of the internal stair hall.
  const escalator = new THREE.Group();
  escalator.name = "east-escalator";
  shell.add(escalator);
  stairs(escalator, 4.8, 26.5, 18.2, 1.45, 3.8, 9.6, {
    rails: 0,
    stepHeight: 0.2,
  });
  for (const x of [3.96, 5.64]) {
    bar(
      escalator,
      [x, 4.35, 27.2],
      [x, 10.2, 17.8],
      0.14,
      material("#75877d", 0.32, 0.55),
    );
    bar(
      escalator,
      [x, 4.55, 27.2],
      [x, 10.4, 17.8],
      0.075,
      material("#232a27", 0.7),
    );
  }
  for (const z of [26.7, 18.0])
    box(escalator, 4.8, z > 20 ? 3.84 : 9.64, z, 1.6, 0.07, 1.0, steel);
  // Front guardrail leaves stairs and all four entrances open.
  railing(shell, [-29, 3.8, 29.6], [-24, 3.8, 29.6], { glass: true });
  railing(shell, [-5.5, 3.8, 29.6], [-3, 3.8, 29.6], { glass: true });
  railing(shell, [28, 3.8, 29.5], [31, 3.8, 29.5], { glass: true });

  const definitions = [
    {
      id: "fourth-east",
      name: "第四食堂",
      side: "东侧主入口",
      level: "半地下入口",
      description:
        "白瓷砖雨棚下的半地下入口，上方是“学生餐厅”四块字牌；从广场沿下行楼梯进入第四食堂。",
      local: [-14, -2, 28.1],
      rotation: 0,
      width: 7.2,
      sign: "fourthEast",
      photos: [
        { group: "drone", file: "1.JPG" },
        { group: "ground", file: "3.jpg" },
      ],
      cameraLocal: [-13, 6.2, 52],
      targetLocal: [-14, -0.4, 28.5],
    },
    {
      id: "fifth-east-south",
      name: "第五食堂",
      side: "东侧南入口",
      level: "平台入口",
      description:
        "位于大玻璃幕墙北端、中央上行阶梯的南侧，门槛与第五食堂外平台相接。",
      local: [0, 3.8, 27],
      rotation: 0,
      width: 5.0,
      sign: "fifthEast",
      photos: [
        { group: "drone", file: "1.JPG" },
        { group: "ground", file: "2.jpg" },
      ],
      cameraLocal: [-6, 9, 49],
      targetLocal: [0, 6, 26],
    },
    {
      id: "fifth-east-north",
      name: "第五食堂",
      side: "东侧北入口",
      level: "平台入口",
      description:
        "位于中央柱廊阶梯北侧的灰砖端部，与南侧入口分别进入第五食堂。",
      local: [25, 3.8, 27],
      rotation: 0,
      width: 5.0,
      sign: "fifthEast",
      photos: [
        { group: "drone", file: "3.JPG" },
        { group: "ground", file: "1.jpg" },
      ],
      cameraLocal: [33, 10, 49],
      targetLocal: [25, 6, 27],
    },
    {
      id: "sixth-east",
      name: "第六食堂",
      side: "东侧柱廊入口",
      level: "上层入口",
      description:
        "位于四根高白柱围合的内凹门廊内，沿第二段楼梯向上进入；左侧另有扶梯。",
      local: [11.3, 9.6, 17.0],
      rotation: 0,
      width: 6.2,
      sign: "sixthEast",
      photos: [
        { group: "drone", file: "3.JPG" },
        { group: "ground", file: "1.jpg" },
      ],
      cameraLocal: [8.5, 15.2, 43],
      targetLocal: [11.3, 11.7, 17],
    },
    {
      id: "fourth-south",
      name: "第四食堂",
      side: "南侧入口",
      level: "半地下入口",
      description:
        "南侧白瓷砖门厅的下行入口，沿楼梯下降半层进入第四食堂；旁边独立的上行楼梯通往第五食堂。",
      local: [-31.4, -2, 21.0],
      rotation: -Math.PI / 2,
      width: 4.9,
      sign: "fourthSouth",
      photos: [
        { group: "drone", file: "11.JPG" },
        { group: "drone", file: "10.JPG" },
      ],
      cameraLocal: [-52, 6.3, 24],
      targetLocal: [-31, -0.4, 21],
    },
    {
      id: "fifth-south",
      name: "第五食堂",
      side: "南侧上层入口",
      level: "平台入口",
      description:
        "藏在南侧退进凹口中的第五食堂入口，外侧直跑楼梯与下方广场相连。",
      local: [-25.3, 3.8, 15.5],
      rotation: -Math.PI / 2,
      width: 4.7,
      sign: "fifthSouth",
      photos: [
        { group: "drone", file: "11.JPG" },
        { group: "drone", file: "10.JPG" },
      ],
      cameraLocal: [-48, 11, 12],
      targetLocal: [-25.2, 6, 15.5],
    },
    {
      id: "fourth-north",
      name: "第四食堂",
      side: "北侧入口",
      level: "半地下入口",
      description:
        "北侧灰砖端墙下的半地下入口，沿楼梯向下进入；两侧保留连续洗手槽与平台玻璃栏板。",
      local: [30.15, -2, 18],
      rotation: Math.PI / 2,
      width: 4.8,
      sign: "fourthNorth",
      photos: [
        { group: "ground", file: "4.jpg" },
        { group: "ground", file: "5.jpg" },
      ],
      cameraLocal: [51, 5.9, 20],
      targetLocal: [30, -0.4, 18],
    },
  ];
  function portal(entry) {
    const e = new THREE.Group();
    e.name = `entry-${entry.id}`;
    e.position.set(...entry.local);
    e.rotation.y = entry.rotation;
    shell.add(e);
    const w = entry.width,
      low = entry.name === "第四食堂",
      h = low ? 2.85 : 3.15;
    const pick = { entryId: entry.id };
    const back = box(e, 0, 1.45, -1.15, w, 2.9, 0.12, dark);
    back.userData = pick;
    box(e, 0, 0.04, -0.3, w, 0.12, 2.1, material("#c7ccc0"));
    for (const x of [-w / 2, w / 2]) {
      const jamb = box(e, x, h / 2, 0.05, 0.27, h, 0.48, stone);
      jamb.userData = pick;
    }
    const lintel = box(e, 0, h - 0.12, 0.05, w + 0.28, 0.34, 0.48, stone);
    lintel.userData = pick;
    const doorWidth = w * 0.88;
    for (const x of [-doorWidth / 4, doorWidth / 4]) {
      const glass = box(
        e,
        x,
        1.43,
        -0.92,
        doorWidth / 2 - 0.07,
        2.75,
        0.055,
        entry.id === "fourth-east"
          ? material("#32423a", 0.4, 0.12)
          : glasses[0],
      );
      glass.userData = pick;
      box(e, x - doorWidth / 4, 1.43, -0.86, 0.055, 2.8, 0.06, steel);
      bar(e, [x + 0.13, 1.1, -0.8], [x + 0.13, 1.8, -0.8], 0.032);
    }
    const asset = ENTRANCE_SIGNS[entry.sign];
    const signWidth = low
      ? 3.5
      : entry.name === "第六食堂"
        ? w + 0.3
        : Math.min(4.0, w + 0.3);
    const banner = signPlane(asset, signWidth);
    const bh = signWidth / asset.aspect;
    banner.position.set(0, low ? 3.05 : h + bh / 2 - 0.12, 0.3);
    banner.userData = pick;
    e.add(banner);
    const lightMat = new THREE.MeshStandardMaterial({
      color: "#9aaa91",
      emissive: "#000000",
      roughness: 0.5,
    });
    const marker = box(e, 0, 0.09, 0.53, w, 0.045, 0.12, lightMat);
    marker.userData = { ...pick, highlight: true };
    highlights.set(entry.id, marker);
    e.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (!obj.userData.entryId) obj.userData.entryId = entry.id;
        entryMeshes.push(obj);
      }
    });
    return e;
  }
  for (const entry of definitions) portal(entry);
  // The eastern fourth-canteen entrance is a sheltered, open and genuinely projecting vestibule.
  patternedWall(shell, -22.75, 1.6, 30.4, 0.45, 4.1, 7.6, true);
  patternedWall(shell, -6.1, 1.6, 30.4, 0.4, 4.1, 7.6, true);
  patternedWall(shell, -14.4, 3.65, 30.5, 17.2, 0.35, 7.5, true);
  cylinder(shell, -19.3, 1.6, 33.5, 0.28, 4.0, white);
  for (let i = 0; i < 4; i++) {
    const x = -20.1 + i * 3.4,
      asset = ENTRANCE_SIGNS.studentPanels[i],
      panel = signPlane(asset, 1.8);
    panel.position.set(x, 4.9, 33.8);
    shell.add(panel);
    bar(shell, [x, 3.85, 33.25], [x, 4.8, 33.75], 0.05, steel);
  }
  const fourthWells = [
    {
      id: "fourth-east",
      origin: [-14, 0, 28.1],
      rotation: 0,
      width: 8.6,
      near: 8.3,
      back: -1.6,
    },
    {
      id: "fourth-south",
      origin: [-31.4, 0, 21],
      rotation: -Math.PI / 2,
      width: 5.8,
      near: 8.1,
      back: -1.6,
    },
    {
      id: "fourth-north",
      origin: [30.15, 0, 18],
      rotation: Math.PI / 2,
      width: 5.8,
      near: 8.3,
      back: -1.6,
    },
  ];
  const wellHoles = [];
  for (const data of fourthWells) {
    const well = new THREE.Group();
    well.name = `sunken-stairwell-${data.id}`;
    well.position.set(...data.origin);
    well.rotation.y = data.rotation;
    shell.add(well);
    const depth = data.near - data.back;
    box(
      well,
      0,
      -2.14,
      (1.25 + data.back) / 2,
      data.width - 0.28,
      0.28,
      1.25 - data.back,
      "#a9b1a5",
    );
    for (const x of [-data.width / 2, data.width / 2]) {
      patternedWall(
        well,
        x,
        -1.28,
        (data.near + data.back) / 2,
        0.25,
        2.04,
        depth,
        true,
      );
      railing(well, [x, -0.4, 1.0], [x, -0.4, data.near]);
    }
    patternedWall(well, 0, -1.28, data.back, data.width, 2.04, 0.2, true);
    stairs(well, 0, 1.2, data.near, data.width - 0.65, -2, -0.41, {
      rails: 2,
      stepHeight: 0.18,
    });
    const c = Math.cos(data.rotation),
      s = Math.sin(data.rotation);
    wellHoles.push(
      [
        [-data.width / 2 - 0.13, data.back - 0.11],
        [data.width / 2 + 0.13, data.back - 0.11],
        [data.width / 2 + 0.13, data.near + 0.1],
        [-data.width / 2 - 0.13, data.near + 0.1],
      ].map(([x, z]) => [
        data.origin[0] + x * c + z * s,
        data.origin[2] - x * s + z * c,
      ]),
    );
  }
  // Southern side entrance vestibule and its adjacent uphill flight.
  patternedWall(shell, -28.1, 3.65, 21, 7.0, 0.32, 5.4, true);
  patternedWall(shell, -28.1, 1.55, 23.6, 7, 0.4 + 3.5, 0.25, true);
  const sideStairs = new THREE.Group();
  sideStairs.position.set(-25.1, 0, 15.4);
  sideStairs.rotation.y = -Math.PI / 2;
  shell.add(sideStairs);
  stairs(sideStairs, 0, 9.7, 0.3, 4.8, 0, 3.8, { rails: 2 });
  // North entry walk, short descending cut and the photographed wash troughs.
  railing(shell, [31.2, 3.8, 21.1], [31.2, 3.8, 27], { glass: true });
  for (const z of [10, 24]) {
    box(shell, 30.95, 0.65, z, 1.35, 0.15, 6.0, steel);
    box(shell, 30.28, 0.85, z, 0.08, 0.55, 6.0, steel);
    for (let dz = -2.5; dz <= 2.5; dz += 1) {
      bar(shell, [30.6, 0.75, z + dz], [30.6, 1.1, z + dz], 0.026);
      bar(shell, [30.6, 1.1, z + dz], [30.92, 1.1, z + dz], 0.026);
    }
    for (const dz of [-2.5, 2.5])
      box(shell, 31, 0.3, z + dz, 0.07, 0.7, 0.07, steel);
  }

  // Low-detail roof outline: retained landmarks, deliberately sparse equipment.
  flatSlab(roof, footprint, 18.4, 0.38, courtHoles, material("#bbbdb2"));
  function roofEdge(a, b, y = 18.7) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      edge = box(
        roof,
        (a[0] + b[0]) / 2,
        y,
        (a[1] + b[1]) / 2,
        Math.hypot(dx, dz),
        0.6,
        0.18,
        white,
      );
    edge.rotation.y = -Math.atan2(dz, dx);
  }
  for (let i = 0; i < footprint.length; i++)
    roofEdge(footprint[i], footprint[(i + 1) % footprint.length]);
  for (const hole of courtHoles) {
    for (let i = 0; i < hole.length; i++)
      roofEdge(hole[i], hole[(i + 1) % hole.length]);
    const x = (hole[0][0] + hole[2][0]) / 2,
      z = (hole[0][1] + hole[2][1]) / 2;
    box(roof, x, 12.4, z, 16, 0.25, 14, "#adafa5");
    for (const zz of [z - 4.5, z + 4.5])
      box(roof, x, 17.6, zz, 16, 0.35, 0.4, "#9a9e93");
    for (let k = 0; k < 4; k++) {
      const ux = x - 5.4 + (k % 2) * 9.5,
        uz = z - 3.3 + Math.floor(k / 2) * 6.3;
      box(roof, ux, 13.2, uz, 2, 1.5, 1.45, "#e0e5dc");
      for (let l = 0; l < 4; l++)
        box(roof, ux, 12.8 + l * 0.22, uz + 0.75, 1.65, 0.055, 0.03, "#8e9a91");
    }
  }
  patternedWall(roof, 0, 20.3, 2.2, 18, 3.8, 10.5);
  box(roof, 0, 22.25, 2.2, 18.2, 0.16, 10.7, white);
  box(roof, -5.5, 19.6, 7.48, 1.3, 2.3, 0.08, "#d2d9cf");
  const skylightMaterial = new THREE.MeshPhysicalMaterial({
    color: "#afd1d0",
    roughness: 0.2,
    metalness: 0.12,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 4; i++) {
    const x = -12 + i * 3.2,
      z = 12.0;
    const barrel = mesh(
      roof,
      new THREE.CylinderGeometry(
        1.5,
        1.5,
        9,
        20,
        1,
        true,
        Math.PI / 2,
        Math.PI,
      ),
      skylightMaterial,
      x,
      18.75,
      z,
    );
    barrel.rotation.x = Math.PI / 2;
    box(roof, x, 18.55, z, 3.05, 0.18, 9.15, white);
    for (const zz of [z - 4.5, z, z + 4.5]) {
      const points = Array.from(
        { length: 21 },
        (_, j) =>
          new THREE.Vector3(
            x + 1.5 * Math.cos((j * Math.PI) / 20),
            18.75 + 1.5 * Math.sin((j * Math.PI) / 20),
            zz,
          ),
      );
      mesh(
        roof,
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          20,
          0.035,
          5,
          false,
        ),
        steel,
      );
    }
  }
  // Only a few large roof grids and vents establish the aerial silhouette.
  for (let x = -26; x < 0; x += 4.5)
    box(roof, x, 18.65, 22.4, 0.17, 0.35, 6.4, "#a8aaa0");
  for (const z of [19.3, 22.5, 25.6])
    box(roof, -13.1, 18.65, z, 30, 0.35, 0.17, "#a8aaa0");
  for (const x of [-25, 25]) {
    box(roof, x, 19.1, -23, 3.7, 1.3, 2.7, "#d0d9cf");
    const duct = box(roof, x, 19.6, -24.8, 1.8, 0.8, 5.7, steel);
    box(shell, x, 9, -27.7, 1.8, 17, 0.9, steel);
  }

  // Plaza and light planting remain optional; no tree masks a door in the review model.
  const plazaBoundary = [
    [-43, -36],
    [43, -36],
    [43, 50],
    [-43, 50],
  ];
  flatSlab(context, plazaBoundary, -0.44, 2.15, wellHoles, material("#c5c9bf"));
  const plazaMap = tileTexture("#aeb6ac", "#dce0d5", 52, 100);
  plazaMap.repeat.set(22 / 86, 22 / 86);
  const plaza = flatSlab(
    context,
    [
      [-42.85, -35.85],
      [42.85, -35.85],
      [42.85, 49.85],
      [-42.85, 49.85],
    ],
    -0.395,
    0.045,
    wellHoles,
    new THREE.MeshStandardMaterial({ map: plazaMap, roughness: 0.96 }),
  );
  plaza.castShadow = false;
  for (const z of [46.2, 47.0, 47.8])
    box(context, 0, -0.35 - (z - 46.2) * 0.14, z, 84, 0.16, 0.8, "#d9ddd2");
  function tree(x, z, r = 2.7) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    context.add(tree);
    cylinder(tree, 0, 1.6, 0, 0.22, 3.2, material("#8c8574"), 10);
    const colors = ["#9cab83", "#aab98c", "#899f75"];
    for (let i = 0; i < 5; i++) {
      const crown = mesh(
        tree,
        new THREE.IcosahedronGeometry(r * (i ? 0.72 : 1), 2),
        material(colors[i % 3]),
        i ? Math.cos(i * 2.2) * r * 0.5 : 0,
        4 + (i % 2) * 0.55,
        i ? Math.sin(i * 2.2) * r * 0.5 : 0,
      );
      crown.scale.y = 0.75;
    }
    cylinder(context, x, -0.2, z, r * 1.3, 0.35, material("#d5dacd"), 36);
    cylinder(context, x, -0.02, z, r * 1.18, 0.08, material("#8f9b76"), 36);
  }
  for (const [x, z, r] of [
    [-35, 39, 2.5],
    [-29, 42, 2.1],
    [33, 43, 2.5],
    [-38, -10, 2.6],
    [38, -13, 2.7],
    [-39, -27, 2.6],
    [39, -27, 2.9],
  ])
    tree(x, z, r);
  for (const x of [-34, 35]) {
    cylinder(context, x, 2.3, 34, 0.065, 4.6, steel, 10);
    const lamp = mesh(
      context,
      new THREE.ConeGeometry(0.5, 0.5, 16),
      material("#b4c1b5", 0.4, 0.4),
      x,
      4.6,
      34,
    );
    lamp.rotation.z = Math.PI;
  }

  const entrances = definitions.map((e) => ({
    id: e.id,
    name: e.name,
    side: e.side,
    level: e.level,
    description: e.description,
    photos: e.photos,
    position: toWorld([e.local[0], e.local[1] + 1.6, e.local[2] + 0.5]),
    camera: toWorld(e.cameraLocal),
    target: toWorld(e.targetLocal),
  }));
  // Preserve independent pick regions and layer toggles while reducing opaque draw calls.
  function batch(parent) {
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert(),
      buckets = new Map();
    parent.traverse((obj) => {
      if (
        !(obj instanceof THREE.Mesh) ||
        obj.userData.entryId ||
        Array.isArray(obj.material) ||
        obj.material.transparent ||
        obj.material.map ||
        obj.material.alphaMap
      )
        return;
      const key = obj.material.uuid;
      const arr = buckets.get(key) || [];
      arr.push(obj);
      buckets.set(key, arr);
    });
    for (const meshes of buckets.values()) {
      if (meshes.length < 3) continue;
      const pieces = meshes.map((obj) => {
        const geo = obj.geometry.index
          ? obj.geometry.toNonIndexed()
          : obj.geometry.clone();
        geo.applyMatrix4(inverse.clone().multiply(obj.matrixWorld));
        return geo;
      });
      const merged = mergeGeometries(pieces, false);
      pieces.forEach((g) => g.dispose());
      if (!merged) continue;
      const obj = mesh(parent, merged, meshes[0].material);
      obj.name = "batched-architecture";
      for (const node of meshes) node.removeFromParent();
    }
  }
  batch(shell);
  batch(roof);
  batch(context);
  group.updateMatrixWorld(true);
  return {
    group,
    entrances,
    layers: { roof, context, labels },
    entryMeshes,
    setSelected(id) {
      for (const [key, object] of highlights) {
        object.material.color.set(key === id ? "#e6ac51" : "#9aaa91");
        object.material.emissive.set(key === id ? "#d49637" : "#000000");
        object.material.emissiveIntensity = key === id ? 0.55 : 0;
      }
    },
    dispose() {
      const geometries = new Set(),
        materials = new Set();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          geometries.add(obj.geometry);
          for (const m of Array.isArray(obj.material)
            ? obj.material
            : [obj.material])
            materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
