import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createSignFactory } from "./entrance-signs.js";

const UP = new THREE.Vector3(0, 1, 0);
const SONG = '"STZhongsong", "SimSun", "Songti SC", serif';
const KAI = '"KaiTi", "STKaiti", "Kaiti SC", serif';

/** Tenth / faculty dining complex. Schematic metres, +X east, -Z north. */
export function createBuilding() {
  const group = new THREE.Group();
  group.name = "tenth-faculty-exterior";
  const shell = new THREE.Group();
  shell.name = "red-brick-facades-and-portico";
  const roof = new THREE.Group();
  roof.name = "simplified-roof-and-glass-canopy";
  const context = new THREE.Group();
  context.name = "plaza-and-planting";
  const labels = new THREE.Group();
  group.add(shell, roof, context, labels);
  const textures = new Set();
  const materials = new Set();
  const geometries = new Set();
  const entryMeshes = [];
  const highlights = new Map();
  const matCache = new Map();

  function mat(color, roughness = 0.8, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!matCache.has(key)) {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      materials.add(m);
      matCache.set(key, m);
    }
    return matCache.get(key);
  }
  const stone = mat("#c8c9bd");
  const white = mat("#e3e8df");
  const steel = mat("#b1bebb", 0.3, 0.6);
  const frame = mat("#7b908e", 0.43, 0.36);
  const darkFrame = mat("#384541", 0.5, 0.25);
  const dark = mat("#24332e");
  const brickEdge = mat("#aa665a");
  const glass = ["#829f9e", "#718e91", "#8ba7a5", "#617e81", "#8fa9a7"].map(
    (color) => {
      const m = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.25,
        metalness: 0.2,
        clearcoat: 0.4,
      });
      materials.add(m);
      return m;
    },
  );
  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    geometries.add(geometry);
    materials.add(material);
    parent.add(o);
    return o;
  }
  function box(parent, x, y, z, w, h, d, material = stone) {
    return mesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  function cylinder(parent, x, y, z, radius, height, material = white) {
    return mesh(
      parent,
      new THREE.CylinderGeometry(radius, radius, height, 20),
      material,
      x,
      y,
      z,
    );
  }
  function bar(parent, a, b, radius = 0.045, material = steel) {
    const p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b),
      delta = q.clone().sub(p);
    const o = mesh(
      parent,
      new THREE.CylinderGeometry(radius, radius, delta.length(), 8),
      material,
    );
    o.position.copy(p.add(q).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(UP, delta.normalize());
    return o;
  }
  function pattern(base, seam, tw, th) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d");
    c.fillStyle = base;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = seam;
    for (let y = 0, row = 0; y < 256; y += th, row++) {
      c.fillRect(0, y, 256, 1);
      for (let x = row % 2 ? tw / 2 : 0; x < 256; x += tw)
        c.fillRect(x, y, 0.6, th);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    textures.add(t);
    return t;
  }
  const brickMap = pattern("#a95d54", "#b9776c", 64, 8);
  const pavementMap = pattern("#d3d6c9", "#b9c2b4", 64, 64);
  function brick(parent, x, y, z, w, h, d) {
    const t = brickMap.clone();
    t.repeat.set(Math.max(w, d) / 3, h / 3);
    textures.add(t);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.94 });
    return box(parent, x, y, z, w, h, d, m);
  }
  function railing(parent, a, b, height = 1, glazing = false) {
    const p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b);
    const length = p.distanceTo(q),
      n = Math.ceil(length / 1.6);
    for (let i = 0; i <= n; i++) {
      const r = p.clone().lerp(q, i / n);
      bar(parent, r.toArray(), [r.x, r.y + height, r.z], 0.033);
    }
    bar(parent, [p.x, p.y + height, p.z], [q.x, q.y + height, q.z]);
    if (!glazing)
      bar(parent, [p.x, p.y + 0.42, p.z], [q.x, q.y + 0.42, q.z], 0.025);
    else {
      const m = new THREE.MeshPhysicalMaterial({
        color: "#a4c5bc",
        transparent: true,
        opacity: 0.25,
        roughness: 0.12,
        depthWrite: false,
      });
      const panel = box(
        parent,
        (p.x + q.x) / 2,
        (p.y + q.y) / 2 + 0.46,
        (p.z + q.z) / 2,
        length,
        0.82,
        0.028,
        m,
      );
      panel.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
      panel.castShadow = false;
    }
  }
  // A local +Z-facing flight climbs from nearZ to farZ; rotation handles other facades.
  function stairs(
    parent,
    x,
    nearZ,
    farZ,
    width,
    bottom,
    top,
    rotation = 0,
    rails = true,
  ) {
    const flight = new THREE.Group();
    flight.position.x = x;
    flight.rotation.y = rotation;
    parent.add(flight);
    const count = Math.max(1, Math.round((top - bottom) / 0.18));
    const run = (farZ - nearZ) / count;
    for (let i = 0; i < count; i++) {
      const rise = ((i + 1) * (top - bottom)) / count;
      box(
        flight,
        0,
        bottom + rise / 2,
        nearZ + run * (i + 0.5),
        width,
        rise,
        Math.abs(run) + 0.006,
        stone,
      );
    }
    if (rails)
      for (const side of [-1, 1])
        railing(
          flight,
          [side * (width / 2 - 0.1), bottom, nearZ],
          [side * (width / 2 - 0.1), top, farZ],
        );
    return flight;
  }
  function cutSegments(min, max, cuts) {
    let cursor = min;
    const out = [];
    for (const [a, b] of cuts.sort((a, b) => a[0] - b[0])) {
      if (a > cursor) out.push([cursor, Math.min(a, max)]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < max) out.push([cursor, max]);
    return out.filter(([a, b]) => b > a);
  }
  function curtain(
    parent,
    x,
    y,
    z,
    w,
    h,
    rotation = 0,
    holes = [],
    columns = Math.round(w / 2),
  ) {
    const facade = new THREE.Group();
    facade.position.set(x, y, z);
    facade.rotation.y = rotation;
    parent.add(facade);
    const rows = Math.round(h / 1.45),
      dx = w / columns,
      dy = h / rows;
    const overlaps = (a, b, c, d) =>
      holes.some((r) => b > r[0] && a < r[1] && d > r[2] && c < r[3]);
    for (let i = 0; i < columns; i++)
      for (let j = 0; j < rows; j++) {
        const xx = -w / 2 + i * dx,
          yy = j * dy;
        if (overlaps(xx, xx + dx, yy, yy + dy)) continue;
        const m =
          j % 3 === 2
            ? mat("#546d75", 0.5, 0.25)
            : glass[(i * 3 + j) % glass.length];
        box(
          facade,
          xx + dx / 2,
          yy + dy / 2,
          0,
          dx - 0.075,
          dy - 0.065,
          0.07,
          m,
        );
        if (j % 3 === 1 && i % 4 !== 0) {
          box(
            facade,
            xx + dx / 2,
            yy + dy / 2,
            0.065,
            dx * 0.78,
            dy * 0.69,
            0.045,
            darkFrame,
          );
          box(
            facade,
            xx + dx / 2,
            yy + dy / 2,
            0.095,
            dx * 0.78 - 0.1,
            dy * 0.69 - 0.1,
            0.025,
            glass[2],
          );
        }
      }
    for (let i = 0; i <= columns; i++) {
      const xx = -w / 2 + i * dx;
      for (const [a, b] of cutSegments(
        0,
        h,
        holes.filter((r) => xx > r[0] && xx < r[1]).map((r) => [r[2], r[3]]),
      ))
        box(facade, xx, (a + b) / 2, 0.08, 0.075, b - a, 0.09, frame);
    }
    for (let j = 0; j <= rows; j++) {
      const yy = j * dy;
      for (const [a, b] of cutSegments(
        -w / 2,
        w / 2,
        holes.filter((r) => yy > r[2] && yy < r[3]).map((r) => [r[0], r[1]]),
      ))
        box(facade, (a + b) / 2, yy, 0.08, b - a, 0.065, 0.09, frame);
    }
  }
  function window(parent, x, y, z, w, h, rotation = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    parent.add(g);
    box(g, 0, 0, 0, w + 0.22, h + 0.22, 0.2, white);
    box(g, 0, 0, 0.12, w, h, 0.08, dark);
    box(g, 0, -0.1, 0.17, w - 0.12, h - 0.2, 0.025, glass[1]);
    box(g, w * 0.15, -0.1, 0.2, 0.06, h - 0.2, 0.03, steel);
  }
  function slab(parent, points, y, thickness, holes = [], material = stone) {
    const shape = new THREE.Shape(
      points.map(([x, z]) => new THREE.Vector2(x, -z)),
    );
    for (const ring of holes)
      shape.holes.push(
        new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))),
      );
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      steps: 1,
    });
    geo.rotateX(-Math.PI / 2);
    return mesh(parent, geo, material, 0, y - thickness, 0);
  }
  const outline = [
    [-36, -7],
    [-10, -7],
    [-10, -25],
    [36, -25],
    [36, 25],
    [-36, 25],
  ];
  const court = [
    [-12, -2],
    [14, -2],
    [14, 5],
    [-12, 5],
  ];
  for (const y of [0.7, 5.2, 10.1]) slab(shell, outline, y, 0.22, [court]);
  slab(roof, outline, 15.6, 0.24, [court], mat("#c3c2b4"));
  // South: broad three-storey curtain wall, brick stair tower, eastern vertical slit wall.
  brick(shell, -31, 7.8, 25, 10, 15.6, 0.38);
  curtain(shell, -7, 0.7, 25.06, 38, 13.55, 0, [[10.8, 16.2, 0, 3.2]], 19);
  brick(shell, 23, 6.7, 25.05, 22, 12.0, 0.45);
  for (let x = 14; x < 34; x += 3.2) {
    box(shell, x, 5.8, 25.32, 0.82, 10.0, 0.075, glass[3]);
    for (const y of [4.5, 8.8])
      box(shell, x, y, 25.38, 0.85, 0.7, 0.035, mat("#667c7b"));
  }
  curtain(shell, 23, 12.75, 25.07, 22, 1.5, 0, [], 11);
  curtain(shell, 35, 0.7, 25.06, 2, 13.55, 0, [], 1);
  brick(shell, 0, 14.95, 25, 72, 1.3, 0.4);
  for (let i = 0; i < 3; i++)
    window(shell, -32 + (i % 2) * 2, 2.7 + i * 4.5, 25.25, 2.6, 1.0);
  // Eastern service end: calm red masonry and staggered recessed strips.
  brick(shell, 36, 7.8, 0, 0.4, 15.6, 50);
  for (let i = 0; i < 8; i++)
    window(
      shell,
      36.25,
      3.1 + (i % 3) * 4.0,
      -21 + i * 6,
      2.8,
      0.92,
      Math.PI / 2,
    );
  // Northern public face leaves the north-west corner open for the colonnade.
  curtain(shell, 7, 0.7, -25.05, 34, 13.55, Math.PI, [], 17);
  brick(shell, 30, 7.8, -25, 12, 15.6, 0.4);
  for (const yy of [3, 7.5, 12])
    window(shell, 30, yy, -25.26, 7.5, 1.1, Math.PI);
  brick(shell, 13, 14.95, -25, 46, 1.3, 0.4);
  // West service facade and the recessed tenth-canteen door beneath a side stair.
  brick(shell, -36, 7.8, 14, 0.4, 15.6, 22);
  for (let i = 0; i < 7; i++)
    window(
      shell,
      -36.25,
      3 + (i % 3) * 4.2,
      5 + i * 2.8,
      2.5,
      1.0,
      -Math.PI / 2,
    );
  brick(shell, -36, 11.9, -1.9, 0.4, 7.4, 10.2);
  brick(shell, -36, 2.2, 2.7, 0.4, 4.4, 1.0);
  brick(shell, -36, 2.2, -6.3, 0.4, 4.4, 1.4);
  window(shell, -36.25, 13.5, -4.0, 2.6, 1.0, -Math.PI / 2);
  window(shell, -36.25, 12.4, 0.0, 2.6, 1.0, -Math.PI / 2);
  // Set the west doorway back 1.7 m, with real side cheeks and ceiling.
  box(shell, -35.1, 4.35, -2.0, 2.2, 0.24, 7.9, stone);
  box(shell, -35.1, 2.1, 2.0, 2.2, 4.2, 0.18, mat("#a7afa2"));
  box(shell, -35.1, 2.1, -6.0, 2.2, 4.2, 0.18, mat("#a7afa2"));
  // West upper stair-side silhouette: rising red parapet with transparent rail.
  curtain(shell, -35.82, 4.45, -2.0, 8.15, 3.75, -Math.PI / 2, [], 4);
  const slopeShape = new THREE.Shape([
    new THREE.Vector2(-6.8, 5.0),
    new THREE.Vector2(2.3, 8.4),
    new THREE.Vector2(2.3, 7.0),
    new THREE.Vector2(-6.8, 3.9),
  ]);
  const slopeGeo = new THREE.ExtrudeGeometry(slopeShape, {
    depth: 0.32,
    bevelEnabled: false,
  });
  const slopeWall = mesh(shell, slopeGeo, brickEdge, -36.05, 0, 0);
  slopeWall.rotation.y = -Math.PI / 2;
  railing(shell, [-36.2, 5.1, -6.8], [-36.2, 8.5, 2.3], 0.9, true);

  // The interior corner is not filled with a solid block: faculty and student
  // doors occupy the same back wall, at distinct levels, east of the wide stair.
  curtain(
    shell,
    -16,
    0.15,
    -7.03,
    12,
    14.2,
    Math.PI,
    [
      [-4, 2, 0, 3.2],
      [-4, 2, 5.05, 8.35],
    ],
    6,
  );
  curtain(shell, -9.96, 0.15, -16.0, 18, 14.2, -Math.PI / 2, [], 9);
  box(shell, -15.5, 4.98, -9.6, 13.0, 0.44, 5.2, stone);
  brick(shell, -15.5, 4.72, -12.15, 13.0, 0.95, 0.2);
  railing(shell, [-22, 5.2, -12.15], [-9, 5.2, -12.15], 0.9, true);
  // Large northern stair: two flights separated by a broad landing, and an
  // independent escalator on the west (right when viewed from the north).
  stairs(shell, -27.5, -31.0, -23.0, 13.5, 0.0, 2.5, 0, false);
  box(shell, -27.5, 2.36, -22.2, 13.5, 0.28, 1.6, stone);
  stairs(shell, -27.5, -21.4, -12.2, 13.5, 2.5, 5.2, 0, false);
  box(shell, -27.3, 5.06, -10.0, 14.3, 0.28, 4.4, stone);
  for (const x of [-20.75, -34.25]) {
    railing(shell, [x, 0.05, -31], [x, 2.5, -23]);
    railing(shell, [x, 2.5, -23], [x, 2.5, -21.4]);
    railing(shell, [x, 2.5, -21.4], [x, 5.2, -12.2]);
  }
  // Solid red edge on the east side separates student access from upper stairs.
  for (let i = 0; i < 28; i++)
    brick(
      shell,
      -20.6,
      ((i + 1) * 5.2) / 28 / 2,
      -30.65 + i * 0.66,
      0.22,
      ((i + 1) * 5.2) / 28 + 0.8,
      0.68,
    );
  const escalator = new THREE.Group();
  escalator.name = "north-escalator";
  shell.add(escalator);
  stairs(escalator, -35.1, -30.5, -11.7, 1.35, 0.1, 5.2, 0, false);
  for (const x of [-35.9, -34.3]) {
    bar(
      escalator,
      [x, 0.9, -31],
      [x, 6, -11.1],
      0.13,
      mat("#6d817b", 0.3, 0.55),
    );
    bar(escalator, [x, 1.1, -31], [x, 6.2, -11.1], 0.065, dark);
  }
  // Non-dining continuation: retained as an architectural opening, not an entry.
  box(shell, -29.5, 9.6, -2.3, 10.0, 6.7, 0.3, dark);
  box(shell, -35, 9.9, -5.0, 0.5, 11.0, 6.2, brickEdge);
  box(shell, -29.5, 13.6, -5.0, 11, 0.5, 6.2, stone);
  stairs(shell, -29.5, -7.8, -2.6, 9.5, 5.2, 8.2, 0, false);

  // Tall white colonnade and red fascia wrap the north-west corner.
  for (const [x, z] of [
    [-35.7, -25],
    [-26.7, -25],
    [-23.7, -25],
    [-11.2, -25],
    [-35.7, -15.6],
    [-23.7, -15.6],
  ]) {
    cylinder(shell, x, 7.2, z, 0.43, 14.4);
    for (const y of [4.8, 9.6])
      cylinder(shell, x, y, z, 0.438, 0.028, mat("#a6b4ae"));
  }
  brick(shell, -23, 15.0, -25.1, 26.4, 2.1, 0.45);
  brick(shell, -36.1, 15.0, -16.0, 0.45, 2.1, 18.4);
  box(shell, -23, 16.1, -25.12, 26.6, 0.13, 0.53, white);
  box(shell, -36.12, 16.1, -16, 0.53, 0.13, 18.6, white);
  for (const z of [-25, -16, -7])
    box(shell, -23, 13.95, z, 26, 0.45, 0.35, frame);
  for (const x of [-36, -28, -19, -10])
    box(shell, x, 13.95, -16, 0.3, 0.45, 18, frame);

  const signFactory = createSignFactory({
    tiledBacking() {},
    registerTexture: (t) => textures.add(t),
  });
  function sign(
    parent,
    text,
    subtitle,
    width,
    height,
    x,
    y,
    z,
    rotation = 0,
    color = "#e8ede7",
    font = SONG,
  ) {
    const s = signFactory(
      { text, subtitle, font, color, backing: "none", aspect: width / height },
      width,
    );
    s.position.set(x, y, z);
    s.rotation.y = rotation;
    parent.add(s);
    return s;
  }
  sign(
    shell,
    "学生餐厅（一楼）",
    null,
    18.0,
    1.45,
    -23,
    15.05,
    -25.38,
    Math.PI,
    "#e2e6dd",
    KAI,
  );
  sign(
    shell,
    "教工餐厅（二楼）",
    null,
    15,
    1.45,
    -36.38,
    15.05,
    -16,
    -Math.PI / 2,
    "#e2e6dd",
    KAI,
  );
  box(shell, -29.4, 12.85, -7.35, 10.8, 1.1, 0.15, frame);
  sign(
    shell,
    "学生就业指导中心",
    null,
    8.8,
    0.8,
    -29.4,
    12.85,
    -7.46,
    Math.PI,
    "#d8ddd5",
    KAI,
  );

  const definitions = [
    {
      id: "tenth-south",
      name: "第十食堂",
      side: "南侧门斗入口",
      level: "短阶入口",
      position: [6.5, 0.85, 25.15],
      normal: [0, 0, 1],
      rotation: 0,
      width: 5.2,
      camera: [14, 7.4, 51],
      target: [6.5, 2.6, 26],
      range: 10,
      description:
        "南侧玻璃幕墙上的第十食堂入口，保留深灰玻璃门斗、浅玻璃雨棚与前方宽石阶。",
      photos: [
        { group: "ground", file: "1.jpg" },
        { group: "drone", file: "3.JPG" },
      ],
    },
    {
      id: "tenth-west",
      name: "第十食堂",
      side: "西侧内凹入口",
      level: "少级台阶",
      position: [-34.4, 0.38, -2],
      normal: [-1, 0, 0],
      rotation: -Math.PI / 2,
      width: 6.6,
      camera: [-57, 5.8, -4],
      target: [-34.5, 2, -2],
      range: 10,
      description:
        "西立面红砖楼梯下方的内凹门厅，经过少级台阶进入；两侧保留洗手槽，上方为带玻璃栏板的斜向楼梯侧墙。",
      photos: [
        { group: "ground", file: "2.jpg" },
        { group: "drone", file: "16.JPG" },
      ],
    },
    {
      id: "tenth-north",
      name: "第十食堂",
      side: "北侧低位入口",
      level: "近地面入口",
      position: [-15, 0.15, -7.12],
      normal: [0, 0, -1],
      rotation: Math.PI,
      width: 6.1,
      camera: [-16.5, 3.8, -35],
      target: [-15, 2.2, -7],
      range: 10,
      description:
        "教工餐厅平台下方的第十食堂入口，近地面通行并设短坡板；西侧的大台阶和扶梯通向上层平台。",
      photos: [
        { group: "ground", file: "5.jpg" },
        { group: "drone", file: "18.JPG" },
      ],
    },
    {
      id: "faculty-north",
      name: "教工餐厅",
      side: "西北柱廊上层入口",
      level: "二楼平台入口",
      position: [-15, 5.2, -7.13],
      normal: [0, 0, -1],
      rotation: Math.PI,
      width: 6.1,
      camera: [-22, 11.8, -43],
      target: [-15, 7, -7],
      range: 13,
      description:
        "位于西北柱廊内的上层平台，金黄横条门头写有“教工餐厅”。沿北侧宽台阶或西缘扶梯上行；下方另有第十食堂入口。",
      photos: [
        { group: "ground", file: "4.jpg" },
        { group: "ground", file: "3.jpg" },
      ],
    },
  ];
  function portal(entry) {
    const e = new THREE.Group();
    e.name = `entry-${entry.id}`;
    e.position.fromArray(entry.position);
    e.rotation.y = entry.rotation;
    shell.add(e);
    const w = entry.width;
    box(e, 0, 1.4, -0.6, w, 2.8, 0.12, dark);
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / 4;
      box(e, x, 1.38, -0.13, w / 4 - 0.06, 2.72, 0.07, glass[i % 4]);
      box(e, -w / 2 + (i * w) / 4, 1.4, -0.06, 0.065, 2.8, 0.08, darkFrame);
      bar(e, [x + 0.12, 1.0, 0], [x + 0.12, 1.8, 0], 0.025, steel);
    }
    box(e, w / 2, 1.4, -0.06, 0.065, 2.8, 0.08, darkFrame);
    box(e, 0, 2.82, -0.03, w + 0.14, 0.12, 0.18, darkFrame);
    if (entry.id === "faculty-north") {
      box(e, 0, 3.6, 0.02, w + 0.7, 1.3, 0.14, mat("#be9b59", 0.6, 0.12));
      for (let i = 0; i < 14; i++)
        box(e, 0, 3.0 + i * 0.09, 0.105, w + 0.7, 0.022, 0.025, mat("#826a3b"));
      sign(e, "教工餐厅", "Faculty & Staff Cafeteria", 4.6, 1.2, 0, 3.61, 0.14);
      box(e, 0, 2.88, 0.6, w + 0.6, 0.055, 1.5, glass[2]);
      for (const x of [-w / 2, w / 2])
        bar(e, [x, 2.9, 0], [x, 2.9, 1.35], 0.025);
    } else {
      box(e, 0, 3.28, -0.03, w, 1.02, 0.075, glass[3]);
      sign(
        e,
        "第十食堂",
        "Dining Hall No.10",
        Math.min(w * 0.8, 4.2),
        0.98,
        0,
        3.29,
        0.03,
      );
    }
    const highlightMat = new THREE.MeshStandardMaterial({
      color: "#a4ad94",
      emissive: "#000000",
      roughness: 0.65,
    });
    const strip = box(e, 0, 0.035, 0.3, w, 0.045, 0.15, highlightMat);
    strip.userData.highlight = true;
    highlights.set(entry.id, strip);
    e.traverse((o) => {
      if (o.isMesh) {
        o.userData.entryId = entry.id;
        entryMeshes.push(o);
      }
    });
    return e;
  }
  definitions.forEach(portal);
  // Southern projecting door vestibule, kept transparent enough to inspect the door.
  const vestibule = new THREE.Group();
  vestibule.position.set(6.5, 0.85, 25.3);
  shell.add(vestibule);
  for (const x of [-2.7, 2.7]) {
    box(vestibule, x, 0.65, 1.3, 0.09, 1.3, 2.5, darkFrame);
    box(vestibule, x, 2, 1.3, 0.06, 1.45, 2.5, glass[1]);
  }
  box(vestibule, 0, 0.65, 2.55, 5.5, 1.3, 0.09, darkFrame);
  // The entry vestibule is open on its west return; the original main door remains clickable.
  for (const x of [-2.7, -0.9, 0.9, 2.7])
    box(vestibule, x, 1.4, 2.56, 0.075, 2.8, 0.1, darkFrame);
  for (const x of [-1.8, 0, 1.8])
    box(vestibule, x, 2.0, 2.55, 1.72, 1.35, 0.05, glass[2]);
  box(vestibule, 0, 2.8, 1.3, 5.7, 0.11, 2.8, mat("#bfc7c0", 0.65, 0.2));
  box(vestibule, 0, 3.78, 0.5, 5.2, 0.06, 1.3, glass[2]);
  vestibule.traverse((o) => {
    if (o.isMesh) {
      o.userData.entryId = "tenth-south";
      entryMeshes.push(o);
    }
  });
  box(shell, 8.7, 0.73, 27.1, 10.5, 0.24, 4.2, stone);
  stairs(shell, 8.7, 31.5, 29.2, 10.5, 0, 0.85, 0, false);
  railing(shell, [3.5, 0.85, 25.4], [3.5, 0.85, 29.1]);
  const westSteps = new THREE.Group();
  westSteps.position.set(-36.2, 0, -2);
  westSteps.rotation.y = -Math.PI / 2;
  shell.add(westSteps);
  stairs(westSteps, 0, 1.4, 0, 7.2, 0, 0.38, 0, false);
  const northThresholdRamp = box(
    shell,
    -15,
    0.075,
    -7.62,
    1.5,
    0.035,
    0.92,
    mat("#afa086"),
  );
  northThresholdRamp.rotation.x = -Math.atan2(0.15, 0.9);
  // Hand-washing troughs frame both sheltered tenth-canteen entrances.
  function trough(parent, x, z, length, rotation = 0) {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.rotation.y = rotation;
    parent.add(t);
    box(t, 0, 0.78, 0, length, 0.18, 0.5, steel);
    box(t, 0, 0.89, 0, length - 0.12, 0.05, 0.35, darkFrame);
    for (const xx of [-length / 2 + 0.2, length / 2 - 0.2])
      for (const zz of [-0.18, 0.18])
        bar(t, [xx, 0.12, zz], [xx, 0.76, zz], 0.025);
    for (let xx = -length / 2 + 0.5; xx < length / 2; xx += 0.8) {
      bar(t, [xx, 0.86, -0.18], [xx, 1.13, -0.18], 0.022);
      bar(t, [xx, 1.13, -0.18], [xx, 1.13, 0.03], 0.022);
    }
  }
  trough(shell, -11, -9.6, 3.6, Math.PI / 2);
  trough(shell, -19.1, -9.6, 3.6, Math.PI / 2);
  trough(shell, -35.1, -5.35, 2.1, Math.PI / 2);
  trough(shell, -35.1, 1.3, 2.1, Math.PI / 2);

  // Roof simplified deliberately: one real courtyard, six folded canopy strips,
  // a service stair head, and a restrained set of equipment blocks.
  for (const [x, z, w, d] of [
    [0, 25, 72, 0.22],
    [36, 0, 0.22, 50],
    [-36, 9, 0.22, 32],
    [13, -25, 46, 0.22],
  ]) {
    brick(roof, x, 16, z, w, 0.8, d);
    box(roof, x, 16.45, z, w + 0.05, 0.11, d + 0.08, white);
  }
  for (const [x, z, w, d] of [
    [1, -2, 26, 0.18],
    [1, 5, 26, 0.18],
    [-12, 1.5, 0.18, 7],
    [14, 1.5, 0.18, 7],
  ]) {
    brick(roof, x, 15.8, z, w, 0.9, d);
    box(roof, x, 16.3, z, w + 0.08, 0.1, d + 0.08, white);
  }
  box(shell, 1, 10.05, 1.5, 25.7, 0.18, 6.7, mat("#b8bdaa"));
  curtain(shell, 1, 10.1, -1.87, 25.5, 4.6, 0, [], 13);
  curtain(shell, 1, 10.1, 4.87, 25.5, 4.6, Math.PI, [], 13);
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: "#c3d8d2",
    transparent: true,
    opacity: 0.54,
    roughness: 0.3,
    metalness: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const strips = 6,
    stripWidth = 26 / strips;
  for (let i = 0; i < strips; i++) {
    const left = -36 + i * stripWidth,
      mid = left + stripWidth / 2,
      right = left + stripWidth;
    for (const [a, b, ya, yb] of [
      [left, mid, 15.75, 16.55],
      [mid, right, 16.55, 15.75],
    ]) {
      const vertices = new Float32Array([
        a,
        ya,
        -25,
        b,
        yb,
        -25,
        b,
        yb,
        -7,
        a,
        ya,
        -25,
        b,
        yb,
        -7,
        a,
        ya,
        -7,
      ]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geo.computeVertexNormals();
      const pane = mesh(roof, geo, canopyMat);
      pane.castShadow = false;
      bar(roof, [a, ya, -25], [a, ya, -7], 0.055, frame);
      for (const z of [-25, -22, -19, -16, -13, -10, -7])
        bar(roof, [a, ya, z], [b, yb, z], 0.035, frame);
    }
  }
  brick(roof, 25, 17.0, 4.0, 7, 2.7, 4.5);
  box(roof, 25, 18.42, 4, 7.2, 0.12, 4.7, white);
  for (const [x, z] of [
    [-5, 8],
    [1, 8],
    [7, 8],
    [13, 8],
    [18, 8],
    [-16, 14],
    [-8, 14],
    [3, 14],
    [20, -15],
    [28, -15],
    [26, 14],
    [30, 4],
  ]) {
    box(roof, x, 16.4, z, 1.2, 1.5, 1.0, mat("#dae0d7", 0.7, 0.15));
    box(roof, x, 16.45, z + 0.51, 0.88, 1.15, 0.035, mat("#697d7b"));
  }
  for (const x of [20, 27])
    box(roof, x, 16.05, 8, 3.4, 0.8, 2.1, mat("#b9c3ba", 0.65, 0.3));

  const pavement = pavementMap.clone();
  pavement.repeat.set(26, 21);
  textures.add(pavement);
  const groundMat = new THREE.MeshStandardMaterial({
    map: pavement,
    roughness: 0.96,
  });
  box(context, 0, -0.25, 0, 98, 0.5, 83, groundMat);
  // Simple low vegetation communicates the facade without hiding the entrances.
  const leaf = ["#9baa77", "#b9bf83", "#8f9e75"].map((c) => mat(c));
  for (const [x, z] of [
    [-29, 31],
    [-18, 31],
    [-5, 32],
    [21, 32],
    [30, 32],
    [41, 15],
    [41, 2],
    [41, -14],
    [20, -31],
    [5, -31],
    [-44, 14],
    [-43, 4],
  ]) {
    box(context, x, 0.1, z, 3.4, 0.2, 2.6, mat("#a9b584"));
    cylinder(context, x, 2.0, z, 0.14, 4.0, mat("#857d63"));
    for (let i = 0; i < 3; i++)
      mesh(
        context,
        new THREE.IcosahedronGeometry(1.7, 1),
        leaf[i],
        x + (i - 1) * 0.6,
        4.5 + i * 0.16,
        z + (i % 2) * 0.5,
      );
  }
  // Group opaque repeated parts by material, keeping every doorway independent.
  function batch(parent) {
    parent.updateWorldMatrix(true, true);
    const inv = parent.matrixWorld.clone().invert(),
      buckets = new Map();
    parent.traverse((o) => {
      if (
        !o.isMesh ||
        o.userData.entryId ||
        Array.isArray(o.material) ||
        o.material.map ||
        o.material.alphaMap ||
        o.material.transparent
      )
        return;
      const list = buckets.get(o.material) || [];
      list.push(o);
      buckets.set(o.material, list);
    });
    for (const [m, items] of buckets) {
      if (items.length < 3) continue;
      const pieces = items.map((o) => {
        const geo = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        geo.applyMatrix4(inv.clone().multiply(o.matrixWorld));
        return geo;
      });
      const combined = mergeGeometries(pieces, false);
      pieces.forEach((g) => g.dispose());
      if (!combined) continue;
      mesh(parent, combined, m).name = "batched-tenth-architecture";
      items.forEach((o) => o.removeFromParent());
    }
  }
  batch(shell);
  batch(roof);
  batch(context);
  group.updateMatrixWorld(true);
  const entrances = definitions.map((e) => ({
    ...e,
    position: new THREE.Vector3(...e.position).add(
      new THREE.Vector3(0, 1.45, 0),
    ),
    camera: new THREE.Vector3(...e.camera),
    target: new THREE.Vector3(...e.target),
  }));
  return {
    group,
    entrances,
    layers: { roof, context, labels },
    entryMeshes,
    setSelected(id) {
      for (const [key, o] of highlights) {
        o.material.color.set(key === id ? "#e2ac57" : "#a4ad94");
        o.material.emissive.set(key === id ? "#d59b40" : "#000000");
        o.material.emissiveIntensity = key === id ? 0.45 : 0;
      }
    },
    dispose() {
      group.traverse((o) => {
        if (o.isMesh) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            materials.add(m),
          );
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
