import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createSignFactory } from "./entrance-signs.js";
import { createCommercialSigns } from "./commercial-signs.js";

const UP = new THREE.Vector3(0, 1, 0);
const SONG = '"STZhongsong", "SimSun", "Songti SC", serif';
const KAI = '"KaiTi", "STKaiti", "Kaiti SC", serif';

/** Ethnic / eighth / ninth dining complex. Schematic metres, +X east, -Z north. */
export function createBuilding() {
  const group = new THREE.Group();
  group.name = "minzu89-exterior";
  const shell = new THREE.Group();
  shell.name = "gray-tile-red-brick-and-portico";
  const roof = new THREE.Group();
  roof.name = "simplified-roof-and-skylights";
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
  const tileMap = pattern("#bbc1ba", "#a2aaa3", 32, 32);
  function tile(parent, x, y, z, w, h, d) {
    const map = tileMap.clone();
    map.repeat.set(Math.max(w, d) / 3.8, h / 3.8);
    textures.add(map);
    return box(
      parent,
      x,
      y,
      z,
      w,
      h,
      d,
      new THREE.MeshStandardMaterial({
        map,
        color: "#e4e7df",
        roughness: 0.91,
      }),
    );
  }
  const main = [
    [-25, -36],
    [25, -36],
    [25, 36],
    [18, 36],
    [18, 16],
    [-18, 16],
    [-18, 36],
    [-25, 36],
  ];
  const rectangle = [
    [-25, -36],
    [25, -36],
    [25, 36],
    [-25, 36],
  ];
  const skylightOpening = [
    [1, 8],
    [17, 8],
    [17, 24],
    [1, 24],
  ];
  for (const height of [0.12, 8.6]) slab(shell, main, height, 0.22);
  // Cut the west stair well out of the middle slab: the stair rises inside
  // the building outline, with no invented raised road or external flight.
  for (const part of [
    [
      [-25, -36],
      [25, -36],
      [25, 13.8],
      [-25, 13.8],
    ],
    [
      [18, 13.8],
      [25, 13.8],
      [25, 36],
      [18, 36],
    ],
    [
      [-25, 20.2],
      [-18, 20.2],
      [-18, 36],
      [-25, 36],
    ],
    [
      [-17.9, 13.8],
      [18, 13.8],
      [18, 16.6],
      [-17.9, 16.6],
    ],
  ])
    slab(shell, part, 3.6, 0.22);
  slab(roof, rectangle, 15.7, 0.3, [skylightOpening], mat("#c6c7bd"));
  // Gray-tile eastern / northern shell. The south is a deep open porch,
  // not a solid box with stairs stuck onto its outside.
  tile(shell, 25, 7.8, 0, 0.4, 15.6, 72);
  tile(shell, 0, 7.8, -36, 50, 15.6, 0.4);
  for (let i = 0; i < 10; i++) {
    const z = -31 + i * 6.6;
    window(shell, 25.26, 3.0 + (i % 3) * 4.25, z, 1.1, 3.5, Math.PI / 2);
  }
  for (const x of [-21, -10, 2, 13, 22]) {
    window(shell, x, 5, -36.26, 4.6, 1.4, Math.PI);
    window(shell, x, 10, -36.26, 4.6, 1.4, Math.PI);
  }
  // The east stair tower has narrow vertical glazing and a west-facing eighth door.
  tile(shell, 21.7, 7.8, 35.9, 6.6, 15.6, 0.4);
  for (const x of [20.0, 23.1]) {
    box(shell, x, 9.3, 36.15, 0.7, 12.1, 0.07, glass[3]);
    for (const y of [4.0, 8.0, 12.0])
      box(shell, x, y, 36.22, 0.72, 0.1, 0.04, frame);
  }
  tile(shell, 18.5, 1.75, 18, 0.35, 3.5, 36);
  tile(shell, 18.5, 11.8, 18, 0.35, 8.4, 36);
  tile(shell, 18.5, 5.5, 10, 0.35, 4.0, 24);
  tile(shell, 18.5, 5.5, 32.2, 0.35, 4.0, 7.6);
  // South-west red brick wing and the west curtain-wall elevation.
  brick(shell, -21.6, 7.8, 36, 6.8, 15.6, 0.38);
  brick(shell, -25, 7.8, 28.1, 0.38, 15.6, 15.8);
  for (const z of [23, 29, 34])
    window(shell, -25.26, 6.2, z, 1.0, 3.4, -Math.PI / 2);
  for (const y of [3, 8, 12.7]) window(shell, -21.5, y, 36.26, 3.0, 1.2);
  curtain(shell, -25.05, 0.7, -6, 40, 13.7, -Math.PI / 2, [], 20);
  tile(shell, -25, 7.8, -31, 0.4, 15.6, 10);
  for (const z of [-33, -29])
    window(shell, -25.26, 7.5, z, 0.7, 11, -Math.PI / 2);
  tile(shell, -25, 15.1, 0, 0.45, 1.25, 72);
  // The west sign marks a deep recessed stair entrance. User confirmed the
  // actual door at its inner end reaches the same level as the south door.
  box(shell, -17.7, 3.46, 17, 1.1, 0.28, 6.0, stone);
  // Above the stair entrance the real facade continues as glazing, not a
  // giant projecting masonry block that would conceal its nameplate.
  curtain(shell, -25.05, 6.85, 17, 6.2, 7.6, -Math.PI / 2, [], 3);
  box(shell, -21.35, 3.35, 13.85, 7.3, 6.7, 0.18, mat("#a9b2a9"));
  brick(shell, -21.35, 3.35, 20.15, 7.3, 6.7, 0.18);
  // A dark soffit makes the recess read as depth, while leaving its outer nameplate clear.
  box(shell, -21.35, 6.7, 17, 7.3, 0.16, 6.2, mat("#56635b"));
  const westDivider = new THREE.Group();
  westDivider.name = "west-minzu-divider-and-wall";
  shell.add(westDivider);
  // Facing west: the north/left part is the stair. The red divider and opaque
  // south/right white wall are explicitly confirmed by the user (drone 8).
  brick(westDivider, -21.35, 3.35, 17.55, 7.3, 6.7, 0.32);
  box(westDivider, -21.35, 2.82, 18.95, 7.3, 5.64, 2.45, mat("#e3e6df"));
  // Central south facade, including the low space below the connecting balcony.
  curtain(shell, -5.6, 0.12, 16.4, 25.2, 3.15, 0, [], 13);
  curtain(shell, -3.4, 3.6, 16.42, 17.2, 11.0, 0, [[2.2, 7.2, 0, 3.7]], 9);
  curtain(shell, -19.0, 7.9, 14.8, 12.0, 6.7, 0, [], 6);
  brick(shell, -23.8, 3.8, 21.3, 2.4, 7.6, 0.35);
  brick(shell, -12.9, 3.8, 16.2, 1.4, 7.6, 0.35);
  box(shell, -18.5, 7.95, 19.3, 9.2, 0.24, 4.8, stone);
  // Middle platform and west corridor. Its lower bay is a shallow recess with
  // a closed back/side wall; it must never give a cutaway view into the interior.
  box(shell, 0, 3.42, 24.1, 36, 0.36, 15.2, stone);
  box(shell, -18.0, 3.43, 26.8, 8.0, 0.34, 16.4, stone);
  const skirt = new THREE.Group();
  skirt.name = "south-podium-skirt";
  shell.add(skirt);
  // Ground 3: west of the first square column is a full-height solid wall.
  tile(skirt, -16.7, 1.8, 34.1, 6.6, 3.6, 0.32);
  tile(skirt, -20, 1.8, 32.2, 0.4, 3.6, 4.1);
  // East of that column is the low dark recess, under a solid parapet header.
  const headerLength = Math.hypot(11.4, 2.3);
  const header = tile(skirt, -7.7, 3.05, 32.95, headerLength, 1.1, 0.3);
  header.rotation.y = Math.atan2(2.3, 11.4);
  tile(skirt, -7.7, 1.65, 28.8, 11.4, 3.3, 0.35);
  tile(skirt, -13.4, 1.65, 31.45, 0.32, 3.3, 5.3);
  tile(skirt, -2, 1.65, 30.3, 0.32, 3.3, 3.0);
  // Glazing exists only at the closed back of the right-hand recess.
  curtain(skirt, -7.7, 0.15, 29.04, 9.6, 2.3, 0, [], 6);
  slab(
    shell,
    [
      [-14, 31.6],
      [-2, 31.6],
      [-2, 31.8],
      [-13.4, 34.1],
      [-14, 34.1],
    ],
    3.6,
    0.36,
  );
  railing(shell, [-20, 3.6, 34.1], [-13.4, 3.6, 34.1], 0.82);
  railing(shell, [-13.4, 3.6, 34.1], [-2, 3.6, 31.8], 0.82);
  // Broad first rise to the eighth/ethnic shared platform; three shallow bottom
  // steps and the longer main flight are kept distinct as in drone 1 and 2.
  stairs(shell, 8.2, 42.0, 39.5, 20.4, 0, 0.6, 0, false);
  box(shell, 8.2, 0.47, 38.7, 20.4, 0.26, 1.6, stone);
  stairs(shell, 8.2, 37.9, 29.7, 20.4, 0.6, 3.6, 0, false);
  railing(shell, [18.2, 0.6, 38], [18.2, 3.6, 29.7], 0.9);
  // Upper ninth-canteen stair and its left-hand escalator.
  stairs(shell, 11.65, 24.7, 5.0, 11.8, 3.6, 8.6, 0, false);
  box(shell, 11.5, 8.46, 4.0, 12.3, 0.28, 2.0, stone);
  railing(shell, [17.4, 3.6, 24.7], [17.4, 8.6, 5.0], 0.9);
  const escalator = new THREE.Group();
  escalator.name = "south-ninth-escalator";
  shell.add(escalator);
  stairs(escalator, 4.8, 24.6, 5.0, 1.35, 3.6, 8.6, 0, false);
  for (const x of [4.02, 5.58]) {
    bar(
      escalator,
      [x, 4.35, 25.2],
      [x, 9.35, 4.5],
      0.14,
      mat("#83928b", 0.3, 0.6),
    );
    bar(escalator, [x, 4.55, 25.2], [x, 9.55, 4.5], 0.065, dark);
  }
  curtain(shell, 11.3, 8.6, 2.8, 13.6, 6.0, 0, [[-4.4, 4.4, 0, 3.4]], 7);
  tile(shell, 18.5, 9.3, 2.8, 0.4, 13.8, 6.5);
  // Three square panel-clad columns and a continuous opaque entrance soffit.
  for (const x of [-13.4, -0.4, 12.6]) {
    box(shell, x, 7.8, 35.0, 1.02, 15.6, 1.02, white);
    for (const y of [3.6, 7.2, 10.8, 14.4])
      box(shell, x, y, 35.0, 1.035, 0.035, 1.035, frame);
  }
  tile(shell, 0, 15.15, 36, 50, 1.75, 0.55);
  box(roof, 0, 15.36, 26, 36, 0.12, 20, mat("#626f69"));
  for (const x of [-17, -13, -9, -5, -1, 3, 7, 11, 15, 18])
    box(roof, x, 15.24, 26, 0.045, 0.05, 20, frame);
  const makeSign = createSignFactory({
    tiledBacking() {},
    registerTexture: (t) => textures.add(t),
  });
  function lettering(
    parent,
    text,
    width,
    height,
    x,
    y,
    z,
    rot = 0,
    color = "#e8eae3",
    subtitle = null,
    font = SONG,
    vertical = false,
  ) {
    const s = makeSign(
      {
        text,
        subtitle,
        font,
        color,
        backing: "none",
        vertical,
        aspect: width / height,
      },
      width,
    );
    s.position.set(x, y, z);
    s.rotation.y = rot;
    parent.add(s);
    return s;
  }
  lettering(
    shell,
    "学生餐厅",
    20,
    1.45,
    0,
    15.2,
    36.32,
    0,
    "#65756b",
    null,
    KAI,
  );
  lettering(
    shell,
    "学生餐厅",
    17,
    1.1,
    -25.3,
    15.1,
    4,
    -Math.PI / 2,
    "#65756b",
    null,
    KAI,
  );
  // Commercial wayfinding is retained as signage, not separate entrances.
  // The user identified the eastern plaques as Burger King above Pizza Hut.
  shell.add(createCommercialSigns());
  const definitions = [
    {
      id: "minzu-south",
      name: "民族食堂",
      side: "南侧连廊入口",
      level: "共用平台入口",
      position: [-18.5, 3.6, 21.0],
      normal: [0, 0, 1],
      rotation: 0,
      width: 6.5,
      camera: [-2, 8, 42],
      target: [-18.5, 5.4, 21.1],
      range: 10,
      description:
        "南侧柱廊西端的民族食堂入口，位于上层商业招牌下方，可沿第八食堂共用平台向西到达。与西侧民族入口通向同一层。",
      photos: [
        { group: "drone", file: "1.JPG" },
        { group: "ground", file: "1.jpg" },
      ],
    },
    {
      id: "minzu-west",
      name: "民族食堂",
      side: "西侧台阶入口",
      level: "民族食堂同层入口",
      position: [-17.9, 3.6, 15.65],
      normal: [-1, 0, 0],
      rotation: -Math.PI / 2,
      width: 3.2,
      camera: [-43, 6.0, 15.65],
      target: [-20.0, 4.3, 17],
      range: 10,
      description:
        "位于西侧玻璃幕墙与红砖体块交界，楼梯从建筑轮廓内向深处上行，金色门牌位于凹口外沿。到达门内后与南侧民族入口同层，无需再上下楼。",
      photos: [
        { group: "drone", file: "7.JPG" },
        { group: "drone", file: "8.JPG" },
      ],
    },
    {
      id: "eighth-south",
      name: "第八食堂",
      side: "南侧正面入口",
      level: "共用平台入口",
      position: [1.3, 3.6, 16.6],
      normal: [0, 0, 1],
      rotation: 0,
      width: 4.8,
      camera: [3.3, 7.9, 44],
      target: [1.3, 5.1, 16.7],
      range: 11,
      description:
        "南侧宽台阶抵达的正面第八食堂入口，金色横条门牌与玻璃幕墙相接；其东侧另有同平台的侧门。",
      photos: [
        { group: "drone", file: "1.JPG" },
        { group: "ground", file: "2.jpg" },
      ],
    },
    {
      id: "eighth-east",
      name: "第八食堂",
      side: "东侧内壁入口",
      level: "第八食堂同层侧门",
      position: [18.23, 3.6, 26.0],
      normal: [-1, 0, 0],
      rotation: -Math.PI / 2,
      width: 5.0,
      camera: [1.0, 8.8, 37],
      target: [18.1, 5.1, 26],
      range: 9,
      description:
        "位于南侧柱廊东边灰色内壁、朝西开启的第八食堂侧门，与正面入口处于同一平台。",
      photos: [
        { group: "drone", file: "1.JPG" },
        { group: "ground", file: "2.jpg" },
      ],
    },
    {
      id: "ninth-south",
      name: "第九食堂",
      side: "南侧上层入口",
      level: "楼梯及扶梯上层入口",
      position: [11.3, 8.6, 3.0],
      normal: [0, 0, 1],
      rotation: 0,
      width: 8.2,
      camera: [9.8, 11.5, 48],
      target: [11.3, 10.2, 3.0],
      range: 10,
      description:
        "沿南平台东部的大楼梯或其左侧扶梯继续向上，进入第九食堂；上层横牌及竖向引导牌分别保留。",
      photos: [
        { group: "ground", file: "3.jpg" },
        { group: "drone", file: "1.JPG" },
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
    box(e, 0, 1.45, -0.68, w, 2.9, 0.12, dark);
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / 4;
      box(e, x, 1.4, -0.15, w / 4 - 0.055, 2.8, 0.06, glass[(i + 1) % 5]);
      box(e, -w / 2 + (i * w) / 4, 1.4, -0.08, 0.055, 2.85, 0.07, darkFrame);
      bar(e, [x + 0.1, 1.05, 0], [x + 0.1, 1.8, 0], 0.025, steel);
    }
    box(e, w / 2, 1.4, -0.08, 0.055, 2.85, 0.07, darkFrame);
    box(e, 0, 2.85, -0.03, w, 0.1, 0.2, darkFrame);
    if (entry.id !== "minzu-west") {
      box(e, 0, 3.42, 0.015, w + 0.45, 1.03, 0.14, mat("#b69a65", 0.64, 0.16));
      for (let i = 0; i < 10; i++)
        box(
          e,
          0,
          2.98 + i * 0.1,
          0.103,
          w + 0.45,
          0.022,
          0.025,
          mat("#806e4c"),
        );
      const subtitle =
        entry.name === "民族食堂"
          ? null
          : `Dining Hall No.${entry.name === "第八食堂" ? 8 : 9}`;
      lettering(
        e,
        entry.name,
        Math.min(w - 0.25, 4.8),
        0.98,
        0,
        3.44,
        0.14,
        0,
        "#f0ede5",
        subtitle,
      );
    }
    const m = new THREE.MeshStandardMaterial({
      color: "#a4ad94",
      emissive: "#000000",
      roughness: 0.65,
    });
    const strip = box(e, 0, 0.035, 0.35, w, 0.045, 0.14, m);
    strip.userData.highlight = true;
    highlights.set(entry.id, strip);
    e.traverse((o) => {
      if (o.isMesh) {
        o.userData.entryId = entry.id;
        entryMeshes.push(o);
      }
    });
  }
  definitions.forEach(portal);
  const westName = new THREE.Group();
  westName.name = "west-minzu-outer-nameplate";
  westName.position.set(-25.22, 0, 17);
  westName.rotation.y = -Math.PI / 2;
  shell.add(westName);
  box(westName, 0, 6.12, 0.015, 6.35, 1.02, 0.14, mat("#b69a65", 0.64, 0.16));
  for (let i = 0; i < 10; i++)
    box(westName, 0, 5.68 + i * 0.1, 0.103, 6.35, 0.022, 0.025, mat("#806e4c"));
  lettering(westName, "民族食堂", 4.85, 0.94, 0, 6.14, 0.14);
  westName.traverse((o) => {
    if (o.isMesh) {
      o.userData.entryId = "minzu-west";
      entryMeshes.push(o);
    }
  });
  // Slim golden ninth-canteen wayfinding at the head of the escalator.
  box(shell, 6.4, 10.2, 4.2, 0.95, 3.2, 0.14, mat("#b2985b"));
  lettering(
    shell,
    "第九食堂",
    0.78,
    2.9,
    6.4,
    10.2,
    4.31,
    0,
    "#f1ead4",
    null,
    SONG,
    true,
  );
  // Hand-washing troughs along the ethnic corridor, outside the walk-through path.
  for (const [x, z] of [
    [-22.2, 19.7],
    [-14.4, 19.7],
  ]) {
    box(shell, x, 4.45, z, 1.0, 0.16, 2.9, steel);
    box(shell, x, 4.51, z, 0.73, 0.08, 2.6, darkFrame);
    for (const dz of [-1, 0, 1])
      bar(shell, [x - 0.28, 4.5, z + dz], [x - 0.28, 4.86, z + dz], 0.022);
    for (const dz of [-1.2, 1.2])
      box(shell, x, 4.0, z + dz, 0.08, 0.9, 0.08, steel);
  }
  // Recessed west stair: all steps stay east of the x=-25 facade line.
  const westFlight = new THREE.Group();
  westFlight.name = "west-minzu-recess-stair";
  westFlight.position.set(-25, 0, 15.65);
  westFlight.rotation.y = -Math.PI / 2;
  shell.add(westFlight);
  stairs(westFlight, 0, -0.02, -6.7, 3.2, 0, 3.6, 0, true);
  // Unnamed north-side service doors and stair only: no inferred canteen identity.
  for (const x of [-14, 10]) {
    window(shell, x, 1.6, -36.26, 5.8, 2.6, Math.PI);
    const flight = new THREE.Group();
    flight.position.set(x, 0, -36.1);
    flight.rotation.y = Math.PI;
    shell.add(flight);
    stairs(flight, 0, 3.6, 0.2, 6.5, 0, 0.65, 0, false);
  }
  // Simplified flat roof, raised northern U-notched service volume and three
  // low glass skylights. Air-conditioning pipes are deliberately not traced.
  for (const [x, z, w, d] of [
    [0, -36, 50, 0.3],
    [25, 0, 0.3, 72],
    [-25, 0, 0.3, 72],
    [0, 36, 50, 0.3],
  ]) {
    tile(roof, x, 16, z, w, 0.65, d);
    box(roof, x, 16.38, z, w + 0.04, 0.1, d + 0.06, white);
  }
  const raised = [
    [-18, -29],
    [-5, -29],
    [-5, -23],
    [5, -23],
    [5, -29],
    [18, -29],
    [18, -5],
    [-18, -5],
  ];
  slab(roof, raised, 19.1, 0.22, [], mat("#c5c7bd"));
  for (const [x, z, w, d] of [
    [-18, -17, 0.25, 24],
    [18, -17, 0.25, 24],
    [0, -5, 36, 0.25],
    [-11.5, -29, 13, 0.25],
    [11.5, -29, 13, 0.25],
    [0, -23, 10, 0.25],
    [-5, -26, 0.25, 6],
    [5, -26, 0.25, 6],
  ])
    tile(roof, x, 17.45, z, w, 3.3, d);
  box(roof, 0, 19.55, -15.5, 20, 0.6, 3.8, mat("#afb3a9"));
  for (let i = 0; i < 3; i++) {
    const z0 = 8 + i * 5.3,
      z1 = z0 + 5.3,
      zm = (z0 + z1) / 2;
    for (const [za, ya, zb, yb] of [
      [z0, 15.8, zm, 16.7],
      [zm, 16.7, z1, 15.8],
    ]) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [1, ya, za, 17, ya, za, 17, yb, zb, 1, ya, za, 17, yb, zb, 1, yb, zb],
          3,
        ),
      );
      geo.computeVertexNormals();
      const m = new THREE.MeshPhysicalMaterial({
        color: "#aecbc9",
        roughness: 0.35,
        metalness: 0.16,
        side: THREE.DoubleSide,
      });
      mesh(roof, geo, m);
      for (const x of [1, 5, 9, 13, 17])
        bar(roof, [x, ya + 0.02, za], [x, yb + 0.02, zb], 0.035, frame);
      bar(roof, [1, ya + 0.03, za], [17, ya + 0.03, za], 0.04, frame);
    }
  }
  for (const [x, z] of [
    [-21, -26],
    [-21, -14],
    [-21, 0],
    [-21, 8],
    [21, -28],
    [21, -17],
    [21, -5],
    [21, 10],
    [-9, 3],
    [0, -1],
  ]) {
    box(roof, x, 16.55, z, 1.5, 1.4, 1.0, mat("#d6ddd4"));
    box(roof, x, 16.55, z + 0.51, 1.2, 1.1, 0.03, frame);
  }
  const groundTexture = pavementMap.clone();
  groundTexture.repeat.set(28, 28);
  textures.add(groundTexture);
  box(
    context,
    0,
    -0.18,
    5,
    83,
    0.36,
    96,
    new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.95 }),
  );
  const leaf = ["#96a477", "#adb77f", "#a4b583"].map((c) => mat(c));
  for (const [x, z] of [
    [-40, -29],
    [-40, -14],
    [-40, 2],
    [-40, 29],
    [-28, 43],
    [28, 42],
    [32, 26],
    [32, 10],
    [32, -8],
    [31, -26],
  ]) {
    const elevation = 0;
    cylinder(context, x, elevation + 1.8, z, 0.14, 3.6, mat("#857e65"));
    for (let i = 0; i < 3; i++)
      mesh(
        context,
        new THREE.IcosahedronGeometry(1.65, 1),
        leaf[i],
        x + (i - 1) * 0.55,
        elevation + 3.8 + i * 0.25,
        z + (i % 2) * 0.4,
      );
  }
  function batch(parent) {
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert(),
      buckets = new Map();
    parent.traverse((o) => {
      let inWestStair = false;
      for (let p = o.parent; p; p = p.parent)
        if (
          p.name === "west-minzu-recess-stair" ||
          p.name === "west-minzu-divider-and-wall" ||
          p.name === "south-podium-skirt" ||
          p.name === "photo-referenced-commercial-signs"
        )
          inWestStair = true;
      if (
        !o.isMesh ||
        inWestStair ||
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
        const g = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
        return g;
      });
      const combined = mergeGeometries(pieces, false);
      pieces.forEach((g) => g.dispose());
      if (!combined) continue;
      mesh(parent, combined, m).name = "batched-minzu89-architecture";
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
