import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createSignFactory } from "./entrance-signs.js";

const UP = new THREE.Vector3(0, 1, 0);
const SONG = '"STZhongsong", "SimSun", "Songti SC", serif';
const KAI = '"KaiTi", "STKaiti", "Kaiti SC", serif';
// User-confirmed access differences; metres remain schematic, not surveyed.
const ELEVENTH_FLOOR = 0.15;
const STOREY_HEIGHT = 4.4;
const NORTH_STREET = ELEVENTH_FLOOR + STOREY_HEIGHT * 0.5;
const EAST_STREET = ELEVENTH_FLOOR + STOREY_HEIGHT * 0.2;
const NORTH_MID_LANDING = (NORTH_STREET + 4.4) / 2;

function groundHeight(x, z) {
  const northRise =
    STOREY_HEIGHT * 0.5 * THREE.MathUtils.clamp((-29 - z) / 13, 0, 1);
  const eastRise =
    STOREY_HEIGHT * 0.2 * THREE.MathUtils.clamp((x - 58) / 9, 0, 1);
  return ELEVENTH_FLOOR + Math.max(northRise, eastRise);
}

/** Photograph-led exterior study. Schematic metres: +X east, -Z north. */
export function createBuilding() {
  const group = new THREE.Group();
  group.name = "eleven-twelve-exterior";
  const shell = new THREE.Group();
  shell.name = "rose-render-and-glass-shell";
  const roof = new THREE.Group();
  roof.name = "simplified-flat-roof";
  const context = new THREE.Group();
  context.name = "eleven-twelve-plaza";
  const labels = new THREE.Group();
  group.add(shell, roof, context, labels);
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  const materialCache = new Map(),
    highlights = new Map(),
    entryMeshes = [];
  function mat(color, roughness = 0.82, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    if (!materialCache.has(key)) {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      materialCache.set(key, m);
      materials.add(m);
    }
    return materialCache.get(key);
  }
  const rose = mat("#b78078"),
    roseEdge = mat("#c68b83");
  const stone = mat("#bfc0b2"),
    white = mat("#e0e4dd");
  const dark = mat("#263b3a"),
    frame = mat("#b8c6c3", 0.38, 0.45);
  const steel = mat("#aab7b4", 0.3, 0.6),
    doorFrame = mat("#394c48", 0.5, 0.2);
  const glass = ["#8fa9a6", "#729393", "#a1b6b0", "#617e80", "#b3c4b9"].map(
    (color, variant) => {
      const m = mat(color, 0.3, 0.22);
      // 窗和门上的玻璃透出室内光，窗框、门帘、雨棚保持原材质。
      m.userData.exteriorLighting = "window";
      m.userData.exteriorLightVariant = variant;
      return m;
    },
  );
  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    geometries.add(geometry);
    materials.add(material);
    return m;
  }
  function box(parent, x, y, z, w, h, d, material = stone) {
    return mesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  function subgroup(parent, name) {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    return g;
  }
  function bar(parent, a, b, r = 0.035, material = steel) {
    const p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b),
      v = q.clone().sub(p);
    const o = mesh(
      parent,
      new THREE.CylinderGeometry(r, r, v.length(), 8),
      material,
    );
    o.position.copy(p.add(q).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(UP, v.normalize());
    return o;
  }
  function pattern(base, line, tw, th) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d");
    c.fillStyle = base;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = line;
    for (let x = 0; x < 256; x += tw) c.fillRect(x, 0, 1, 256);
    for (let y = 0; y < 256; y += th) c.fillRect(0, y, 256, 1);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    textures.add(t);
    return t;
  }
  const tileMap = pattern("#b6b7af", "#9fa69c", 32, 8);
  const pavingMap = pattern("#c9ccbe", "#b8c0b0", 64, 64);
  function tiled(parent, x, y, z, w, h, d) {
    const t = tileMap.clone();
    t.repeat.set(Math.max(w, d) / 3, h / 3);
    textures.add(t);
    return box(
      parent,
      x,
      y,
      z,
      w,
      h,
      d,
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.96 }),
    );
  }
  function rail(parent, a, b, height = 1, glazing = true) {
    const p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b),
      n = Math.ceil(p.distanceTo(q) / 1.8);
    for (let i = 0; i <= n; i++) {
      const r = p.clone().lerp(q, i / n);
      bar(parent, r.toArray(), [r.x, r.y + height, r.z], 0.027);
    }
    bar(parent, [p.x, p.y + height, p.z], [q.x, q.y + height, q.z], 0.04);
    bar(parent, [p.x, p.y + 0.12, p.z], [q.x, q.y + 0.12, q.z], 0.027);
    if (glazing) {
      const v = q.clone().sub(p),
        len = Math.hypot(v.x, v.z);
      const shape = new THREE.Shape([
        new THREE.Vector2(0, p.y + 0.15),
        new THREE.Vector2(len, q.y + 0.15),
        new THREE.Vector2(len, q.y + height - 0.08),
        new THREE.Vector2(0, p.y + height - 0.08),
      ]);
      const panel = mesh(
        parent,
        new THREE.ShapeGeometry(shape),
        new THREE.MeshPhysicalMaterial({
          color: "#a0bbb0",
          transparent: true,
          opacity: 0.22,
          roughness: 0.2,
          metalness: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
        p.x,
        0,
        p.z,
      );
      panel.rotation.y = -Math.atan2(v.z, v.x);
      panel.castShadow = false;
    }
  }
  // Build only the sloped flight, not a solid block to ground: upper stair landings
  // in the north atrium remain visibly open beneath, as in drone 8–10.
  function flight(
    parent,
    a,
    b,
    width,
    { solid = false, rails = true, nosing = false, name = "stair-flight" } = {},
  ) {
    const g = subgroup(parent, name),
      p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b);
    const dx = q.x - p.x,
      dz = q.z - p.z,
      len = Math.hypot(dx, dz),
      rise = q.y - p.y;
    const n = Math.max(1, Math.round(rise / 0.17)),
      run = len / n,
      side = new THREE.Vector3(-dz / len, 0, dx / len);
    const yaw = Math.atan2(dx, dz);
    g.position.copy(p);
    g.rotation.y = yaw;
    for (let i = 0; i < n; i++) {
      const h = (rise * (i + 1)) / n,
        stepH = solid ? h : rise / n + 0.09;
      box(
        g,
        0,
        h - stepH / 2,
        (i + 0.5) * run,
        width,
        stepH,
        run + 0.005,
        stone,
      );
      if (nosing)
        box(
          g,
          0,
          h + 0.006,
          i * run + 0.035,
          width,
          0.012,
          0.06,
          mat("#999f94"),
        );
    }
    if (!solid) {
      const sl = box(
        g,
        0,
        rise / 2 - 0.16,
        len / 2,
        width,
        0.22,
        Math.hypot(len, rise),
        stone,
      );
      sl.rotation.x = -Math.atan2(rise, len);
    }
    if (rails)
      for (const s of [-1, 1])
        rail(
          parent,
          p
            .clone()
            .addScaledVector(side, (s * width) / 2)
            .toArray(),
          q
            .clone()
            .addScaledVector(side, (s * width) / 2)
            .toArray(),
        );
    return g;
  }
  function escalator(parent, a, b, width = 1.25) {
    const e = subgroup(parent, "public-escalator"),
      p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b),
      v = q.clone().sub(p);
    const side = new THREE.Vector3(-v.z, 0, v.x).normalize();
    flight(e, a, b, width, { rails: false, name: "escalator-treads" });
    for (const s of [-1, 1]) {
      const aa = p.clone().addScaledVector(side, s * width * 0.56),
        bb = q.clone().addScaledVector(side, s * width * 0.56);
      rail(e, aa.toArray(), bb.toArray(), 0.86);
      bar(
        e,
        [aa.x, aa.y + 0.93, aa.z],
        [bb.x, bb.y + 0.93, bb.z],
        0.085,
        doorFrame,
      );
    }
  }
  function rectWall(parent, x, y, z, w, h, rotation, material, holes = []) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    parent.add(g);
    const xs = [-w / 2, w / 2, ...holes.flatMap((r) => [r[0], r[1]])]
      .filter((v) => v >= -w / 2 && v <= w / 2)
      .sort((a, b) => a - b);
    const ys = [0, h, ...holes.flatMap((r) => [r[2], r[3]])]
      .filter((v) => v >= 0 && v <= h)
      .sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const a = xs[i],
          b = xs[i + 1],
          c = ys[j],
          d = ys[j + 1];
        if (b - a < 0.001 || d - c < 0.001) continue;
        const u = (a + b) / 2,
          v = (c + d) / 2;
        if (holes.some((r) => u > r[0] && u < r[1] && v > r[2] && v < r[3]))
          continue;
        box(g, u, v, 0, b - a, d - c, 0.32, material);
      }
    return g;
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
    columns = Math.round(w / 2.15),
  ) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    parent.add(g);
    const rows = Math.max(2, Math.round(h / 1.2)),
      dx = w / columns,
      dy = h / rows;
    const hit = (u, v) =>
      holes.some((r) => u > r[0] && u < r[1] && v > r[2] && v < r[3]);
    for (let i = 0; i < columns; i++)
      for (let j = 0; j < rows; j++) {
        const u = -w / 2 + (i + 0.5) * dx,
          v = (j + 0.5) * dy;
        if (hit(u, v)) continue;
        box(
          g,
          u,
          v,
          0,
          dx - 0.07,
          dy - 0.06,
          0.08,
          glass[(i * 3 + j) % glass.length],
        );
        if (j % 4 === 1 && i % 3 !== 0) {
          box(g, u, v, 0.065, dx * 0.8, dy * 0.72, 0.045, doorFrame);
          box(
            g,
            u,
            v,
            0.095,
            dx * 0.8 - 0.09,
            dy * 0.72 - 0.09,
            0.025,
            glass[(i + j + 1) % glass.length],
          );
        }
        // Restrained blind lines in selected panes, never photographic baked light.
        if ((i + j) % 5 === 0)
          for (let k = 1; k < 5; k++)
            box(
              g,
              u,
              v - dy * 0.42 + k * dy * 0.16,
              0.048,
              dx - 0.16,
              0.018,
              0.018,
              frame,
            );
      }
    for (let i = 0; i <= columns; i++)
      for (let j = 0; j < rows; j++) {
        const u = -w / 2 + i * dx,
          v = (j + 0.5) * dy;
        if (hit(u, v)) continue;
        box(g, u, v, 0.08, 0.065, dy, 0.085, frame);
      }
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i < columns; i++) {
        const u = -w / 2 + (i + 0.5) * dx,
          v = j * dy;
        if (hit(u, v)) continue;
        box(g, u, v, 0.08, dx, 0.065, 0.085, frame);
      }
    return g;
  }
  function window(parent, x, y, z, w, h, rotation = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    parent.add(g);
    box(g, 0, 0, 0, w + 0.15, h + 0.15, 0.14, frame);
    box(g, 0, 0, 0.09, w, h, 0.04, doorFrame);
    box(g, 0, 0, 0.12, w - 0.12, h - 0.12, 0.025, glass[1]);
    if (w > 1.5) box(g, w * 0.17, 0, 0.16, 0.045, h, 0.04, frame);
  }
  const signFactory = createSignFactory({
    tiledBacking() {},
    registerTexture: (t) => textures.add(t),
  });
  function sign(
    parent,
    text,
    subtitle,
    w,
    h,
    x,
    y,
    z,
    rotation = 0,
    color = "#edf0e9",
    font = SONG,
    vertical = false,
  ) {
    const s = signFactory(
      { text, subtitle, font, color, backing: "none", aspect: w / h, vertical },
      w,
    );
    s.position.set(x, y, z);
    s.rotation.y = rotation;
    // Use one lit letter face here. Closely stacked alpha-cut faces flicker in
    // the wide orthographic camera on devices with a low-precision depth buffer.
    const redundantFaces = [];
    s.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = false;
      if (o.material.alphaMap) {
        if (o.position.z <= 0.05) redundantFaces.push(o);
        else o.position.z = 0.13;
      }
    });
    for (const face of redundantFaces) {
      geometries.add(face.geometry);
      materials.add(face.material);
      face.removeFromParent();
    }
    parent.add(s);
    return s;
  }
  function longSign(parent, text, w, h, x, y, z, bg = "#dd8b37") {
    box(parent, x, y, z, w, h, 0.12, mat(bg, 0.56, 0.1));
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = Math.round((canvas.width * h) / w);
    const c = canvas.getContext("2d");
    c.fillStyle = "#000";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `700 ${canvas.height * 0.76}px "Microsoft YaHei", sans-serif`;
    c.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.9);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 8;
    textures.add(t);
    const m = new THREE.MeshStandardMaterial({
      color: "#f6efcf",
      emissive: "#f2c77b",
      emissiveIntensity: 0.16,
      alphaMap: t,
      alphaTest: 0.25,
      roughness: 0.55,
    });
    const lettering = mesh(
      parent,
      new THREE.PlaneGeometry(w, h),
      m,
      x,
      y,
      z + 0.15,
    );
    lettering.castShadow = false;
    lettering.receiveShadow = false;
  }

  // Gray plinth under the upper rose box. North/east platforms are separate
  // volumes with genuine doorway openings, not door textures over solid walls.
  box(shell, 0, 0.04, 0, 65, 0.14, 54, stone);
  box(shell, 0, 4.27, 0, 65, 0.26, 54, stone);
  // Leave the northern strip open above the continuous public stair.
  box(shell, 0, 8.35, 5.5, 68, 0.3, 47, rose);
  box(shell, 0, 13.05, 3.8, 66, 0.22, 49.5, stone);
  const northPodium = subgroup(shell, "north-platform-and-low-entrance");
  box(northPodium, 0, 4.26, -34.6, 68, 0.28, 15.2, stone);
  // Front retaining wall opening x[-16,-6], for the independent low entrance.
  rectWall(northPodium, 0, 0, -41.9, 68, 4.25, Math.PI, mat("#a3a79e"), [
    [6, 16, 0, 3.45],
  ]);
  for (const x of [-16.2, -5.8])
    tiled(northPodium, x, 1.7, -40.8, 0.25, 3.4, 2.3);
  box(northPodium, -11, 3.58, -40.7, 10.6, 0.44, 2.5, stone);
  box(northPodium, -11, ELEVENTH_FLOOR - 0.08, -40.7, 10.4, 0.16, 2.8, stone);
  rail(northPodium, [-34, 4.4, -42], [-0.2, 4.4, -42]);
  rail(northPodium, [27, 4.4, -42], [34, 4.4, -42]);
  // Two broad flights and an explicit intermediate landing.
  flight(
    northPodium,
    [13.4, NORTH_STREET, -56],
    [13.4, NORTH_MID_LANDING, -50.0],
    26,
    {
      solid: true,
      rails: false,
      name: "north-main-stair-lower",
    },
  );
  box(northPodium, 13.4, NORTH_MID_LANDING - 0.12, -49.0, 26, 0.24, 2.0, stone);
  flight(northPodium, [13.4, NORTH_MID_LANDING, -48], [13.4, 4.4, -42], 26, {
    solid: true,
    rails: false,
    name: "north-main-stair-upper",
  });
  for (const x of [0.4, 26.4]) {
    rail(northPodium, [x, NORTH_STREET, -56], [x, NORTH_MID_LANDING, -50]);
    rail(northPodium, [x, NORTH_MID_LANDING, -50], [x, NORTH_MID_LANDING, -48]);
    rail(northPodium, [x, NORTH_MID_LANDING, -48], [x, 4.4, -42]);
  }
  // The shared north street is half a storey above eleven's dining floor.
  // Build the flight from its low end, so the existing stair helper still rises.
  const northAccess = subgroup(shell, "eleventh-north-descending-access");
  flight(
    northAccess,
    [-11, ELEVENTH_FLOOR, -46],
    [-11, NORTH_STREET, -56],
    10.4,
    {
      solid: true,
      rails: false,
      nosing: true,
      name: "eleventh-north-down-stair",
    },
  );
  box(northAccess, -11, ELEVENTH_FLOOR - 0.1, -43.35, 10.4, 0.2, 5.3, stone);
  for (const x of [-16.2, -5.8]) {
    rail(
      northAccess,
      [x, NORTH_STREET, -56],
      [x, ELEVENTH_FLOOR, -46],
      0.9,
      false,
    );
    rail(
      northAccess,
      [x, ELEVENTH_FLOOR, -46],
      [x, ELEVENTH_FLOOR, -41.9],
      0.9,
      false,
    );
    rail(northAccess, [x, NORTH_STREET, -56], [x, NORTH_STREET, -42], 0.95);
    // Retaining cheeks follow the exterior grade and enclose the lowered route.
    const cheek = new THREE.Shape([
      new THREE.Vector2(-56, ELEVENTH_FLOOR - 0.12),
      new THREE.Vector2(-41.9, ELEVENTH_FLOOR - 0.12),
      new THREE.Vector2(-41.9, NORTH_STREET + 0.1),
      new THREE.Vector2(-56, NORTH_STREET + 0.1),
    ]);
    const cheekMesh = mesh(
      northAccess,
      new THREE.ExtrudeGeometry(cheek, { depth: 0.22, bevelEnabled: false }),
      stone,
    );
    cheekMesh.rotation.y = -Math.PI / 2;
    cheekMesh.position.x = x + 0.11;
  }

  const eastPodium = subgroup(shell, "east-platform-and-low-entrance");
  box(eastPodium, 37.4, 4.26, 0, 13.2, 0.28, 58, stone);
  rectWall(eastPodium, 43.9, 0, 0, 58, 4.25, Math.PI / 2, mat("#a3a79e"), [
    [-16.2, -5.8, 0, 3.45],
  ]);
  for (const z of [5.7, 16.3]) tiled(eastPodium, 42.7, 1.7, z, 2.5, 3.4, 0.24);
  box(eastPodium, 42.7, 3.58, 11, 2.5, 0.44, 10.8, stone);
  box(eastPodium, 42.7, ELEVENTH_FLOOR - 0.08, 11, 2.8, 0.16, 10.4, stone);
  for (const z of [-0.3, -22.4]) {
    const width = z < -10 ? 12 : 12.4;
    flight(eastPodium, [56, ELEVENTH_FLOOR, z], [50, 2.15, z], width, {
      solid: true,
      rails: false,
      name: z < -10 ? "northeast-public-stair-lower" : "east-main-stair-lower",
    });
    box(eastPodium, 49, 2.03, z, 2, 0.24, width, stone);
    flight(eastPodium, [48, 2.15, z], [44, 4.4, z], width, {
      solid: true,
      rails: false,
      name: z < -10 ? "northeast-public-stair-upper" : "east-main-stair-upper",
    });
    for (const side of [-1, 1]) {
      const zz = z + (side * width) / 2;
      rail(eastPodium, [56, ELEVENTH_FLOOR, zz], [50, 2.15, zz]);
      rail(eastPodium, [50, 2.15, zz], [48, 2.15, zz]);
      rail(eastPodium, [48, 2.15, zz], [44, 4.4, zz]);
    }
  }
  rail(eastPodium, [44, 4.4, 6.1], [44, 4.4, 18]);
  rail(eastPodium, [44, 4.4, -16.3], [44, 4.4, -6.5]);
  // Narrow stair at the southern edge of the low entrance runs along the wall.
  flight(eastPodium, [37.4, ELEVENTH_FLOOR, 28.5], [37.4, 4.4, 16.7], 3, {
    solid: true,
    name: "east-side-stair",
  });
  const eastAccess = subgroup(shell, "eleventh-east-ramp-access");
  // A broad, level forecourt separates the distant terrain ramp from the door.
  box(eastAccess, 50.35, ELEVENTH_FLOOR - 0.08, 11, 15.3, 0.16, 10.4, stone);
  // Paving joints mark the two grade breaks without adding barriers to the ramp.
  for (const x of [58, 67])
    box(
      eastAccess,
      x,
      groundHeight(x, 11) + 0.006,
      11,
      0.045,
      0.012,
      10.4,
      mat("#a3a99c"),
    );
  rail(eastPodium, [34.5, 4.4, 29], [44, 4.4, 29]);
  // A linking corner landing keeps north and east elevated circulation continuous.
  box(eastPodium, 38.5, 4.26, -35.5, 11, 0.28, 13, stone);
  rail(eastPodium, [34, 4.4, -42], [44, 4.4, -42]);
  rail(eastPodium, [44, 4.4, -42], [44, 4.4, -29]);

  // Lower northern facade: twelve's entrance is at platform height. The public
  // stairs seen through the glass above are architectural circulation only.
  curtain(shell, -8, 4.4, -25.0, 44, 3.68, Math.PI, [[-21, -12, 0, 3.25]], 22);
  const underStairGeo = new THREE.BufferGeometry();
  underStairGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [13.5, 4.4, -28.95, 13.5, 8.7, -28.95, 32.5, 4.4, -28.95],
      3,
    ),
  );
  underStairGeo.computeVertexNormals();
  mesh(shell, underStairGeo, glass[2]);
  for (let x = 15; x < 32; x += 2) {
    const top = 4.4 + ((32.5 - x) * 4.3) / 19;
    box(shell, x, (4.4 + top) / 2, -29, 0.06, top - 4.4, 0.06, frame);
  }
  bar(shell, [13.5, 8.7, -29], [32.5, 4.4, -29], 0.09, white);
  tiled(shell, -32, 4.1, -25.1, 4, 8.2, 0.34);
  // Lower east facade with two neighbouring curtained door groups.
  tiled(shell, 30.2, 4.1, 21, 0.35, 8.2, 16);
  curtain(shell, 30.2, 0.2, 27.8, 3, 7.9, Math.PI / 2, [], 2);
  curtain(
    shell,
    30.2,
    4.4,
    -2,
    28,
    3.68,
    Math.PI / 2,
    [
      [-6.4, 3.2, 0, 3.25],
      [-13.2, -8.2, 0, 3.25],
    ],
    14,
  );
  tiled(shell, 30.2, 6.2, -16.3, 0.35, 3.6, 4.6);
  // Northeast public through-passage and return stair; no invented dining ID.
  tiled(shell, 26.0, 6.3, -18.3, 16, 3.8, 0.3);

  // Southern gray facade contains a deep recessed passage and the eleventh sign.
  const southRecess = subgroup(shell, "south-recess-entrance");
  rectWall(southRecess, -17, 0, 28.8, 34, 8.2, 0, mat("#b8bab0"), [
    [5, 17, 0, 7.8],
  ]);
  for (let x = -31; x < -12; x += 3.4)
    for (const y of [1.7, 6.5]) window(southRecess, x, y, 29.02, 1.0, 1.8);
  for (const x of [-12.2, 0.2])
    tiled(southRecess, x, 3.9, 24.45, 0.36, 7.8, 9.1);
  box(southRecess, -6, 4.27, 24.5, 12.1, 0.26, 9, stone);
  box(southRecess, -6, ELEVENTH_FLOOR - 0.1, 24.5, 12, 0.2, 9, stone);
  box(southRecess, -6, 6.2, 20.0, 12, 3.6, 0.24, mat("#68736b"));
  box(southRecess, -6, 7.99, 24.5, 12, 0.18, 9, mat("#7c857a"));
  rail(southRecess, [-12, 4.4, 28.95], [0, 4.4, 28.95], 0.95);
  curtain(shell, 17, 0.2, 26.4, 34, 7.7, 0, [], 17);
  tiled(shell, -33.8, 4.1, 0, 0.34, 8.2, 58);
  for (let z = -24; z < 28; z += 5.3)
    for (const y of [1.7, 6.4])
      window(shell, -34.05, y, z, 1.2, 1.8, -Math.PI / 2);
  // Service doors retain their visible massing without claiming food access.
  for (const z of [-21, 5, 23])
    window(shell, -34.08, 1.45, z, 2.0, 2.8, -Math.PI / 2);

  // Continuous projecting rose lower band and top cornice, large east/south glass.
  for (const z of [-29, 29]) {
    box(shell, 0, 8.55, z, 68, 1.0, 0.42, rose);
    box(shell, 0, 17.92, z, 68, 1.8, 0.42, rose);
    box(shell, 0, 8.08, z, 68, 0.15, 0.48, roseEdge);
  }
  for (const x of [-34, 34]) {
    box(shell, x, 8.55, 0, 0.42, 1.0, 58, rose);
    box(shell, x, 17.92, 0, 0.42, 1.8, 58, rose);
    box(shell, x, 8.08, 0, 0.48, 0.15, 58, roseEdge);
  }
  curtain(shell, 34.04, 9.08, 10.0, 38, 7.94, Math.PI / 2, [], 19);
  curtain(shell, 17, 9.08, 29.04, 34, 7.94, 0, [], 17);
  // Southwest upper service wall has scattered windows and one two-level loggia.
  rectWall(shell, -17, 9.05, 29, 34, 7.98, 0, rose, [[5, 17, 0, 7.98]]);
  for (const [x, y, w, h] of [
    [-29, 11, 1.1, 1.1],
    [-24, 15, 2.6, 2.2],
    [-19, 11.5, 1.3, 1.2],
    [-16, 15, 2.1, 2.2],
    [-31, 15, 1.2, 1.3],
  ])
    window(shell, x, y, 29.25, w, h);
  for (const x of [-12.1, 0.1]) box(shell, x, 13.05, 25.1, 0.25, 8, 7.8, rose);
  box(shell, -6, 8.99, 25.1, 12, 0.18, 7.8, stone);
  curtain(shell, -6, 9.1, 21.2, 12, 3.8, 0, [], 6);
  curtain(shell, -6, 13.18, 27.8, 12, 3.85, 0, [], 6);
  box(shell, -6, 13.0, 25.1, 12, 0.28, 7.8, white);
  box(shell, -6, 12.6, 29.0, 12, 0.72, 0.12, white);
  rail(shell, [-12, 9.1, 29], [0, 9.1, 29], 0.8);
  rail(shell, [-12, 13.18, 29], [0, 13.18, 29]);
  rectWall(shell, -34, 9.08, 0, 58, 7.94, -Math.PI / 2, rose);
  for (let i = 0; i < 11; i++) {
    const z = -26 + i * 5.0;
    window(
      shell,
      -34.24,
      10.7 + (i % 2) * 0.55,
      z,
      i % 3 === 0 ? 1.1 : 2.1,
      i % 3 === 0 ? 1.2 : 1.9,
      -Math.PI / 2,
    );
    window(
      shell,
      -34.24,
      15.0,
      z + 1.0,
      i % 4 === 0 ? 1.1 : 2.3,
      i % 4 === 0 ? 1.2 : 2.0,
      -Math.PI / 2,
    );
  }
  // The silver service cladding on the southwest corner is retained as a calm panel.
  box(shell, -30.0, 13.05, 29.31, 7.7, 9.95, 0.2, mat("#b3c4c3", 0.42, 0.5));
  for (let y = 8.3; y < 18; y += 1.1)
    box(shell, -30, y, 29.43, 7.7, 0.035, 0.03, frame);
  for (let x = -33.8; x < -26.2; x += 1.9)
    box(shell, x, 13.05, 29.43, 0.035, 9.95, 0.03, frame);

  // Northeast rose end wall and two-storey recessed balcony.
  box(shell, 34, 13.05, -23.5, 0.42, 7.94, 11, rose);
  box(shell, 31.1, 13.05, -18.0, 5.8, 7.94, 0.3, rose);
  box(shell, 31.1, 13.05, -9.0, 5.8, 7.94, 0.3, rose);
  curtain(shell, 28.3, 9.08, -13.5, 9, 7.94, Math.PI / 2, [], 4);
  box(shell, 31.1, 13.0, -13.5, 5.8, 0.25, 9, white);
  box(shell, 34.05, 12.62, -13.5, 0.12, 0.7, 9, white);
  rail(shell, [34.1, 9.08, -18], [34.1, 9.08, -9], 0.85);
  rail(shell, [34.1, 13.18, -18], [34.1, 13.18, -9]);
  sign(
    shell,
    "众创空间",
    null,
    1.1,
    6.0,
    34.28,
    13.1,
    -23.5,
    Math.PI / 2,
    "#d2dbd4",
    KAI,
    true,
  );

  // North open atrium: three square panel columns, a deep glass back wall,
  // an intermediate landing, diagonal upper staircase and glass-sided escalator.
  const atrium = subgroup(shell, "north-open-public-atrium");
  box(atrium, 26, 13.05, -29, 16, 7.94, 0.42, rose);
  box(atrium, -32, 13.05, -29, 4, 7.94, 0.42, rose);
  curtain(atrium, -23, 9.08, -29.04, 14, 7.94, Math.PI, [], 7);
  curtain(atrium, 1.5, 8.68, -17.4, 33, 8.34, Math.PI, [], 16);
  curtain(atrium, 18.1, 8.68, -23, 11.2, 8.34, -Math.PI / 2, [], 5);
  // Solid soffit caps the recessed space; it is not an open roof.
  box(atrium, 1, 17.13, -23.1, 34, 0.22, 11.8, mat("#77837b"));
  for (let x = -15; x < 18; x += 1.5)
    box(atrium, x, 16.99, -23.1, 0.035, 0.04, 11.8, frame);
  for (const x of [12.7, 1.4, -10.5]) {
    box(atrium, x, 12.88, -28.4, 0.82, 8.18, 0.82, white);
    for (let y = 9; y < 17; y += 1.55)
      box(atrium, x, y, -28.4, 0.84, 0.035, 0.84, mat("#9ca99f"));
  }
  box(atrium, 6, 8.55, -23, 15, 0.28, 11.7, stone);
  rail(atrium, [13.5, 8.72, -28.95], [1.6, 8.72, -28.95]);
  flight(atrium, [32.5, 4.4, -26.0], [13.5, 8.7, -26.0], 3.8, {
    rails: false,
    name: "north-public-lower-stair",
  });
  escalator(atrium, [32.5, 4.4, -21.8], [13.5, 8.7, -21.8], 1.25);
  // Upper stair rises west, exactly the visible diagonal in drone 9/10.
  flight(atrium, [1.1, 8.7, -25.6], [-10.8, 13.2, -25.6], 6.4, {
    rails: false,
    name: "north-public-upper-stair",
  });
  rail(atrium, [1.2, 8.7, -28.8], [-10.8, 13.2, -28.8], 1.0);
  // Pale solid stair fascia beneath the rail.
  const fascia = new THREE.Shape([
    new THREE.Vector2(1.2, 8.7),
    new THREE.Vector2(-10.8, 13.2),
    new THREE.Vector2(-10.8, 12.45),
    new THREE.Vector2(1.2, 7.95),
  ]);
  const fasciaMesh = mesh(
    atrium,
    new THREE.ExtrudeGeometry(fascia, { depth: 0.15, bevelEnabled: false }),
    white,
    0,
    0,
    -28.92,
  );
  fasciaMesh.rotation.y = Math.PI;
  fasciaMesh.scale.x = -1;
  box(atrium, -13.5, 13.08, -23.2, 5.5, 0.24, 11.5, stone);
  rail(atrium, [-10.8, 13.2, -28.9], [-16.1, 13.2, -28.9]);
  for (let i = 0; i < 5; i++)
    box(atrium, -1.3 - i * 1.9, 9.8 + i * 0.72, -24.3, 1.0, 0.45, 0.8, white);
  // Unlit screen face and static cornice letters observed in the photographs.
  box(atrium, 26, 13.45, -29.42, 12.8, 6.3, 0.6, steel);
  box(atrium, 26, 13.45, -29.77, 12.25, 5.8, 0.11, mat("#465859", 0.6, 0.15));
  sign(
    shell,
    "学生餐厅",
    null,
    12,
    1.15,
    3,
    18.0,
    -29.27,
    Math.PI,
    "#cbd7cf",
    KAI,
  );

  const definitions = [
    {
      id: "eleventh-north",
      name: "第十一食堂",
      side: "北侧低位入口",
      level: "下行半层楼梯进入",
      access: {
        kind: "descending-stairs",
        floorDelta: -0.5,
        streetElevation: NORTH_STREET,
        thresholdElevation: ELEVENTH_FLOOR,
        levelApproachLength: 5.3,
      },
      position: [-11, 0.15, -40.7],
      normal: [0, 0, -1],
      rotation: Math.PI,
      width: 8.7,
      camera: [-20, 16, -72],
      target: [-11, 1.8, -46],
      range: 12.5,
      description:
        "从北侧广场下约半层楼梯，经底部平地进入第十一食堂；旁边上行的宽台阶通往第十二食堂。",
      photos: [
        { group: "ground", file: "1.jpg" },
        { group: "drone", file: "10.JPG" },
      ],
    },
    {
      id: "eleventh-east",
      name: "第十一食堂",
      side: "东侧低位入口",
      level: "远处下缓坡 · 平地到门",
      access: {
        kind: "descending-ramp",
        floorDelta: -0.2,
        streetElevation: EAST_STREET,
        thresholdElevation: ELEVENTH_FLOOR,
        levelApproachLength: 15.3,
      },
      position: [42.7, 0.15, 11],
      normal: [1, 0, 0],
      rotation: Math.PI / 2,
      width: 8.7,
      camera: [88, 17, 35],
      target: [53, 1.5, 11],
      range: 16,
      description:
        "从较远处的缓坡下降约0.2层，经过一片平坦前场，再进入第十一食堂。坡道不紧贴门口；旁边上行宽台阶通往第十二食堂。",
      photos: [
        { group: "ground", file: "5.jpg" },
        { group: "ground", file: "4.jpg" },
        { group: "drone", file: "5.JPG" },
      ],
    },
    {
      id: "eleventh-south",
      name: "第十一食堂",
      side: "南侧内凹入口",
      level: "平层进入 · 无需楼梯",
      access: {
        kind: "level",
        floorDelta: 0,
        streetElevation: ELEVENTH_FLOOR,
        thresholdElevation: ELEVENTH_FLOOR,
        levelApproachLength: 9,
      },
      position: [-6, 0.15, 20.3],
      normal: [0, 0, 1],
      rotation: 0,
      width: 8.4,
      camera: [1.5, 5.1, 54],
      target: [-6, 2.0, 25.5],
      range: 10.5,
      description:
        "从南侧平地直接沿内凹通道进入第十一食堂，无需上下楼梯。白字灰底门头保留在通道外侧。",
      photos: [
        { group: "drone", file: "2.JPG" },
        { group: "drone", file: "3.JPG" },
        { group: "drone", file: "1.JPG" },
      ],
    },
    {
      id: "twelfth-north",
      name: "第十二食堂",
      side: "北侧平台入口",
      level: "上行台阶至平台",
      position: [8, 4.4, -25.2],
      normal: [0, 0, -1],
      rotation: Math.PI,
      width: 8.9,
      curtain: true,
      camera: [9, 11.9, -65],
      target: [8, 6.5, -29],
      range: 15,
      description:
        "沿北侧双段宽台阶登上平台，入口保留棕色门帘、弧形雨棚与橙色“第十二食堂特色风味餐厅”灯箱；上方为通高公共楼梯厅。",
      photos: [
        { group: "ground", file: "2.jpg" },
        { group: "ground", file: "1.jpg" },
        { group: "drone", file: "9.JPG" },
      ],
    },
    {
      id: "twelfth-east",
      name: "第十二食堂",
      side: "东侧平台入口",
      level: "上行台阶至平台",
      position: [30.3, 4.4, -0.8],
      normal: [1, 0, 0],
      rotation: Math.PI / 2,
      width: 9.1,
      curtain: true,
      camera: [70, 7.3, -1],
      target: [31.5, 6.4, -0.8],
      range: 12.5,
      description:
        "东侧中央宽台阶正对第十二食堂平台入口；主门与旁边一组玻璃门属于同一入口区域，保留实拍的棕色门帘和门楣字样。",
      photos: [
        { group: "ground", file: "4.jpg" },
        { group: "ground", file: "5.jpg" },
        { group: "drone", file: "6.JPG" },
      ],
    },
  ];
  function portal(entry) {
    const e = subgroup(shell, `entry-${entry.id}`);
    e.position.fromArray(entry.position);
    e.rotation.y = entry.rotation;
    const w = entry.width,
      n = entry.curtain ? 6 : 6;
    box(e, 0, 1.46, -0.32, w, 2.92, 0.12, dark);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / n;
      box(
        e,
        x,
        1.43,
        -0.09,
        w / n - 0.055,
        2.84,
        0.08,
        entry.curtain
          ? mat(i % 2 ? "#a18660" : "#ad9068")
          : glass[(i + 1) % glass.length],
      );
      box(e, -w / 2 + (i * w) / n, 1.45, -0.01, 0.055, 2.9, 0.08, doorFrame);
      if (entry.curtain) {
        for (let k = 0; k < 3; k++)
          box(
            e,
            x + (((k - 1) * w) / n) * 0.23,
            1.43,
            0.002,
            0.018,
            2.8,
            0.018,
            mat("#8a775a"),
          );
        box(e, x, 1.72, 0.04, 0.43, 0.89, 0.06, doorFrame);
        box(e, x, 1.72, 0.08, 0.31, 0.74, 0.04, glass[4]);
      } else {
        box(e, x, 0.64, 0.005, w / n - 0.08, 1.1, 0.04, doorFrame);
        bar(e, [x + 0.12, 1.05, 0.045], [x + 0.12, 1.9, 0.045], 0.025);
      }
    }
    box(e, w / 2, 1.45, -0.01, 0.055, 2.9, 0.08, doorFrame);
    box(e, 0, 2.93, 0, w + 0.1, 0.11, 0.14, doorFrame);
    if (entry.id.startsWith("eleventh")) {
      // The nameboard is mounted on the outer portal, not the recessed glass.
      const forward = entry.id === "eleventh-south" ? 8.7 : 1.25;
      box(e, 0, 3.13, forward, w + 1.5, 0.77, 0.13, mat("#778b8d", 0.6, 0.2));
      sign(
        e,
        "第十一食堂",
        "Dining Hall No.11",
        5.8,
        1.2,
        0,
        3.18,
        forward + 0.09,
      );
    } else {
      box(e, 0, 3.29, -0.02, w, 0.58, 0.08, glass[4]);
      sign(
        e,
        "第十二食堂",
        "Dining Hall No.12",
        5.6,
        0.7,
        0,
        3.3,
        0.04,
        0,
        "#56675f",
      );
      if (entry.id === "twelfth-north") {
        box(e, 0, 4.22, 4.15, 6.3, 0.92, 0.12, roseEdge);
        sign(e, "第十二食堂", "Dining Hall No.12", 5.5, 0.9, 0, 4.22, 4.24);
        longSign(e, "第十二食堂特色风味餐厅", 11.5, 1.05, 0, 3.04, 5.2);
        // Six shallow translucent curved panels, from high wall edge to fascia.
        // A custom ruled surface keeps the awning above (never in front of) doors.
        const verts = [];
        for (let i = 0; i < 10; i++) {
          const a = i / 10,
            b = (i + 1) / 10;
          const za = 3.82 + a * 1.35,
            zb = 3.82 + b * 1.35;
          const ya = 3.69 + 0.17 * Math.sin(a * Math.PI) - a * 0.23;
          const yb = 3.69 + 0.17 * Math.sin(b * Math.PI) - b * 0.23;
          verts.push(
            -5.8,
            ya,
            za,
            5.8,
            ya,
            za,
            5.8,
            yb,
            zb,
            -5.8,
            ya,
            za,
            5.8,
            yb,
            zb,
            -5.8,
            yb,
            zb,
          );
        }
        const awGeo = new THREE.BufferGeometry();
        awGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(verts, 3),
        );
        awGeo.computeVertexNormals();
        const awMat = new THREE.MeshStandardMaterial({
          color: "#9c927a",
          roughness: 0.38,
          metalness: 0.15,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.66,
        });
        mesh(e, awGeo, awMat);
        for (let x = -5.6; x < 5.8; x += 1.4)
          bar(e, [x, 3.69, 3.82], [x, 3.46, 5.17], 0.025, doorFrame);
      }
    }
    const hm = new THREE.MeshStandardMaterial({
      color: "#a4ad94",
      emissive: "#000000",
      roughness: 0.65,
    });
    const strip = box(e, 0, 0.04, 0.25, w, 0.05, 0.17, hm);
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
  // Second east door bank, adjacent to and selectable as the same entrance.
  const eastExtra = subgroup(shell, "east-secondary-door-bank");
  eastExtra.position.set(30.3, 4.4, 8.7);
  eastExtra.rotation.y = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const u = (i - 1.5) * 1.1;
    box(
      eastExtra,
      u,
      1.45,
      0,
      1.06,
      2.9,
      0.08,
      i < 2 ? mat("#aa906c") : glass[4],
    );
    box(eastExtra, u - 0.55, 1.45, 0.06, 0.06, 2.9, 0.08, doorFrame);
    if (i < 2) {
      box(eastExtra, u, 1.75, 0.06, 0.38, 0.82, 0.05, doorFrame);
      box(eastExtra, u, 1.75, 0.09, 0.27, 0.68, 0.04, glass[4]);
    }
  }
  eastExtra.traverse((o) => {
    if (o.isMesh) {
      o.userData.entryId = "twelfth-east";
      entryMeshes.push(o);
    }
  });

  // Simplified flat roof: central recessed service court, parapet and a few HVAC
  // masses carry the silhouette. Individual fans, pipes and rooftop advertisements
  // are intentionally omitted, as requested for this series of exterior studies.
  box(roof, 0, 18.66, 0, 68, 0.28, 58, mat("#bdbcae"));
  for (const z of [-29, 29]) {
    box(roof, 0, 18.96, z, 68, 0.6, 0.22, rose);
    box(roof, 0, 19.29, z, 68.1, 0.08, 0.28, white);
  }
  for (const x of [-34, 34]) {
    box(roof, x, 18.96, 0, 0.22, 0.6, 58, rose);
    box(roof, x, 19.29, 0, 0.28, 0.08, 58.1, white);
  }
  box(roof, -15, 18.82, 0, 23, 0.15, 27, mat("#a9b0a3"));
  for (const [x, z, w, d] of [
    [-15, -13.5, 23, 0.2],
    [-15, 13.5, 23, 0.2],
    [-26.5, 0, 0.2, 27],
    [-3.5, 0, 0.2, 27],
  ])
    box(roof, x, 19.6, z, w, 1.55, d, white);
  for (const [x, z, w, d] of [
    [17, 13, 9, 3],
    [15, -17, 10, 3],
    [-27, 19, 5, 3],
    [-28, -19, 5, 3],
    [-18, 3, 4, 4],
  ]) {
    box(roof, x, 19.3, z, w, 1.2, d, mat("#c9d0c5", 0.7, 0.2));
    box(roof, x, 19.35, z + d / 2 + 0.02, w - 0.25, 0.8, 0.04, mat("#748884"));
    for (let k = -w / 2 + 0.4; k < w / 2; k += 0.4)
      box(roof, x + k, 19.35, z + d / 2 + 0.05, 0.025, 0.8, 0.025, frame);
  }
  // Graded precinct: north street is half a storey above the dining floor;
  // east street descends at a distance, then remains level all the way to the door.
  const pMap = pavingMap.clone();
  pMap.repeat.set(27, 29);
  textures.add(pMap);
  const paving = new THREE.MeshStandardMaterial({ map: pMap, roughness: 0.97 });
  box(context, 11, -0.25, -7, 128, 0.5, 118, stone);
  const xs = [-53, -34, -16.2, -5.8, 0.4, 26.4, 34, 42.7, 44, 58, 67, 75];
  const zs = [-66, -56, -50, -48, -46, -42, -41.9, -29, 5.8, 16.2, 29, 52];
  const terrain = new Map([
    [context, { positions: [], uvs: [] }],
    [eastAccess, { positions: [], uvs: [] }],
  ]);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i],
        x1 = xs[i + 1],
        z0 = zs[j],
        z1 = zs[j + 1];
      const cx = (x0 + x1) / 2,
        cz = (z0 + z1) / 2;
      // Real openings in the graded ground; the two stair systems occupy them.
      if (cx > -16.2 && cx < -5.8 && cz > -56 && cz < -41.9) continue;
      if (cx > 0.4 && cx < 26.4 && cz > -56 && cz < -42) continue;
      // Building floors and the level entrance apron already supply these faces.
      if (cx > -34 && cx < 44 && cz > -42 && cz < 29) continue;
      if (cx > 42.7 && cx < 58 && cz > 5.8 && cz < 16.2) continue;
      const part = terrain.get(
        cx > 58 && cz > 5.8 && cz < 16.2 ? eastAccess : context,
      );
      for (const [x, z] of [
        [x0, z0],
        [x0, z1],
        [x1, z1],
        [x0, z0],
        [x1, z1],
        [x1, z0],
      ]) {
        part.positions.push(x, groundHeight(x, z), z);
        part.uvs.push((x + 53) / 128, (z + 66) / 118);
      }
    }
  }
  for (const [parent, data] of terrain) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data.positions, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.computeVertexNormals();
    mesh(parent, geometry, paving).name =
      parent === eastAccess
        ? "east-distant-ramp-and-street"
        : "graded-precinct-with-north-stair-openings";
  }
  const rim = [];
  function terrainEdge(ax, az, bx, bz) {
    const ay = groundHeight(ax, az),
      by = groundHeight(bx, bz);
    rim.push(
      ax,
      0,
      az,
      bx,
      by,
      bz,
      bx,
      0,
      bz,
      ax,
      0,
      az,
      ax,
      ay,
      az,
      bx,
      by,
      bz,
    );
  }
  for (let i = 0; i < xs.length - 1; i++) {
    terrainEdge(xs[i], -66, xs[i + 1], -66);
    terrainEdge(xs[i + 1], 52, xs[i], 52);
  }
  for (let i = 0; i < zs.length - 1; i++) {
    terrainEdge(-53, zs[i + 1], -53, zs[i]);
    terrainEdge(75, zs[i], 75, zs[i + 1]);
  }
  const rimGeometry = new THREE.BufferGeometry();
  rimGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(rim, 3),
  );
  rimGeometry.computeVertexNormals();
  mesh(context, rimGeometry, stone);
  const greens = ["#94a676", "#a8b386", "#879b73"].map((c) => mat(c));
  for (const [x, z] of [
    [-25, -50],
    [-33, -48],
    [58, 19],
    [48, 24],
    [49, -13],
    [50, -34],
    [-39, 15],
    [-39, -7],
    [-20, 34],
    [15, 34],
    [27, 35],
  ]) {
    const elevation = groundHeight(x, z);
    box(context, x, elevation + 0.075, z, 3.0, 0.15, 2.6, mat("#9da981"));
    mesh(
      context,
      new THREE.CylinderGeometry(0.1, 0.15, 3.0, 7),
      mat("#887f64"),
      x,
      elevation + 1.5,
      z,
    );
    for (let i = 0; i < 3; i++)
      mesh(
        context,
        new THREE.IcosahedronGeometry(1.55, 1),
        greens[i],
        x + (i - 1) * 0.55,
        elevation + 3.4 + i * 0.18,
        z + (i % 2) * 0.45,
      );
  }

  // Preserve named structural groups (useful when reviewing photo corrections),
  // merging repeated opaque pieces only inside each leaf group.
  function batch(parent) {
    [...parent.children]
      .filter(
        (o) =>
          o.isGroup &&
          !o.name.startsWith("entry-") &&
          !o.name.startsWith("material-sign-"),
      )
      .forEach(batch);
    parent.updateWorldMatrix(true, true);
    const inv = parent.matrixWorld.clone().invert(),
      buckets = new Map();
    for (const o of parent.children) {
      if (
        !o.isMesh ||
        o.userData.entryId ||
        Array.isArray(o.material) ||
        o.material.map ||
        o.material.alphaMap ||
        o.material.transparent
      )
        continue;
      const a = buckets.get(o.material) || [];
      a.push(o);
      buckets.set(o.material, a);
    }
    for (const [m, items] of buckets) {
      if (items.length < 3) continue;
      const parts = items.map((o) => {
        const geo = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        geo.applyMatrix4(inv.clone().multiply(o.matrixWorld));
        return geo;
      });
      const geo = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      if (!geo) continue;
      mesh(parent, geo, m).name = "batched-eleven-twelve-architecture";
      items.forEach((o) => o.removeFromParent());
    }
  }
  batch(shell);
  batch(roof);
  batch(context);
  group.updateMatrixWorld(true);
  return {
    group,
    entrances: definitions.map((e) => ({
      ...e,
      position: new THREE.Vector3(...e.position).add(
        new THREE.Vector3(0, 1.45, 0),
      ),
      camera: new THREE.Vector3(...e.camera),
      target: new THREE.Vector3(...e.target),
    })),
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
