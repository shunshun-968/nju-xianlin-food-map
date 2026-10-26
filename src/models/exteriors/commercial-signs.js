import * as THREE from "three";
import { signContours } from "./commercial-sign-data.js";
import { eastPlaqueContours } from "./east-brand-plaque-data.js";

/** Photo-derived letter contours + shallow illuminated sign housings. */
export function createCommercialSigns() {
  const group = new THREE.Group();
  group.name = "photo-referenced-commercial-signs";
  const enamel = (color, glow = 0) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.12,
      emissive: color,
      emissiveIntensity: glow,
    });
  const white = enamel("#fff7e6", 0.32);
  const red = enamel("#c32329", 0.12);
  const orange = enamel("#ef922f", 0.22);
  const charcoal = enamel("#242c29");
  const amber = enamel("#e7af40", 0.2);

  function extrude(parent, shapes, material, depth = 0.045, edge = material) {
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: depth >= 0.025,
      bevelSegments: 2,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      curveSegments: 28,
      material: 0,
      extrudeMaterial: 1,
    });
    const part = new THREE.Mesh(geometry, [material, edge]);
    part.receiveShadow = true;
    part.castShadow = true;
    parent.add(part);
    return part;
  }
  function word(
    parent,
    key,
    width,
    height,
    x,
    y,
    z,
    material = white,
    dataSource = signContours,
  ) {
    const data = dataSource[key];
    const path = new THREE.ShapePath();
    for (const loop of data.contours) {
      loop.forEach(([px, py], i) => {
        const xx = (px / data.width - 0.5) * width;
        const yy = (0.5 - py / data.height) * height;
        if (i === 0) path.moveTo(xx, yy);
        else path.lineTo(xx, yy);
      });
      path.currentPath.closePath();
    }
    const suppliedPlaque = dataSource === eastPlaqueContours;
    const part = extrude(
      parent,
      path.toShapes(false),
      material,
      suppliedPlaque ? 0.008 : 0.035,
      suppliedPlaque ? material : charcoal,
    );
    part.position.set(x, y, z);
    part.name = `reference-lettering-${key}`;
    return part;
  }
  function block(parent, x, y, z, w, h, d, material) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    part.position.set(x, y, z);
    part.receiveShadow = part.castShadow = true;
    parent.add(part);
    return part;
  }

  // Chinese letters are separate channel letters over the warm window band.
  const chinese = new THREE.Group();
  chinese.name = "pizza-hut-chinese-channel-letters";
  chinese.position.set(-19.8, 10.65, 15.0);
  group.add(chinese);
  for (let i = 0; i < 6; i++)
    block(chinese, -3.35 + i * 1.29, 0, -0.06, 1.15, 0.95, 0.05, amber);
  word(chinese, "pizzaChinese", 3.6, 1.03, 0, 0, 0.09);

  // The English logo sits to the right of the first front column.
  const pizza = new THREE.Group();
  pizza.name = "pizza-hut-red-roof-script";
  pizza.position.set(-9.0, 10.65, 16.66);
  group.add(pizza);
  const roof = new THREE.Shape();
  roof.moveTo(-2.65, -0.83);
  roof.bezierCurveTo(-2.35, -0.55, -2.0, -0.05, -1.7, 0.51);
  roof.lineTo(0.1, 1.02);
  roof.quadraticCurveTo(0.27, 1.06, 0.33, 0.87);
  roof.lineTo(0.56, 0.35);
  roof.bezierCurveTo(1.25, 0.26, 2.15, 0.14, 2.57, -0.14);
  roof.quadraticCurveTo(2.84, -0.38, 2.4, -0.43);
  roof.bezierCurveTo(0.8, -0.4, -1.4, -0.63, -2.65, -0.95);
  roof.closePath();
  extrude(pizza, roof, red, 0.12);
  block(pizza, 0.6, -0.71, 0.02, 6.6, 0.07, 0.08, red);
  word(pizza, "pizzaScript", 4.65, 1.13, -0.08, -0.07, 0.15);

  const burger = new THREE.Group();
  burger.name = "burger-king-bun-lightbox-and-arrow";
  burger.position.set(-1.2, 10.4, 16.67);
  group.add(burger);
  const badge = new THREE.Shape();
  badge.moveTo(-1.03, -0.67);
  badge.bezierCurveTo(-1.03, -1.08, 1.03, -1.08, 1.03, -0.67);
  badge.lineTo(1.03, 0.64);
  badge.bezierCurveTo(1.03, 1.19, -1.03, 1.19, -1.03, 0.64);
  badge.closePath();
  extrude(burger, badge, white, 0.12, charcoal);
  const topBun = new THREE.Shape();
  topBun.moveTo(-0.91, 0.45);
  topBun.lineTo(0.91, 0.45);
  topBun.bezierCurveTo(0.91, 1.03, -0.91, 1.03, -0.91, 0.45);
  topBun.closePath();
  extrude(burger, topBun, orange, 0.03).position.z = 0.13;
  const bottomBun = new THREE.Shape();
  bottomBun.moveTo(-0.91, -0.56);
  bottomBun.lineTo(0.91, -0.56);
  bottomBun.bezierCurveTo(0.91, -1.0, -0.91, -1.0, -0.91, -0.56);
  bottomBun.closePath();
  extrude(burger, bottomBun, orange, 0.03).position.z = 0.13;
  word(burger, "burgerLetters", 1.81, 0.92, 0, -0.025, 0.165, red);

  function arrow(scale) {
    const s = new THREE.Shape();
    const points = [
      [-1, -0.2],
      [0.28, -0.2],
      [0.28, -0.45],
      [1.02, 0],
      [0.28, 0.45],
      [0.28, 0.2],
      [-1, 0.2],
    ];
    points.forEach(([x, y], i) =>
      i ? s.lineTo(x * scale, y * scale) : s.moveTo(x * scale, y * scale),
    );
    s.closePath();
    return s;
  }
  const outline = extrude(burger, arrow(1.05), white, 0.1, charcoal);
  outline.position.set(0, -1.75, 0);
  const arrowFace = extrude(burger, arrow(0.9), enamel("#ffbd31", 0.27), 0.025);
  arrowFace.position.set(0, -1.75, 0.115);

  // East-facing return of the central glass volume, seen from the southeast in g1.
  const side = new THREE.Group();
  side.name = "burger-king-side-wordmark";
  side.position.set(3.3, 10.9, 10.7);
  side.rotation.y = Math.PI / 2;
  group.add(side);
  const sideGlass = new THREE.MeshStandardMaterial({
    color: "#49625f",
    roughness: 0.32,
    metalness: 0.18,
  });
  const sideFrame = enamel("#71847e");
  block(side, 0, 0, -0.08, 7.2, 3.1, 0.08, sideGlass);
  for (const x of [-3.6, -1.8, 0, 1.8, 3.6])
    block(side, x, 0, -0.015, 0.045, 3.1, 0.04, sideFrame);
  for (const y of [-1.55, 1.55])
    block(side, 0, y, -0.015, 7.2, 0.045, 0.04, sideFrame);
  word(side, "burgerSide", 5.5, 0.93, 0, 0, 0.045);

  // Two west-facing plaques on the eastern stair tower. Their identity and
  // vertical ordering were confirmed by the user against drone/1.JPG.
  function plaque(name, y, colour) {
    const panel = new THREE.Group();
    panel.name = name;
    // Mount in front of the projecting floor fascia, so it cannot slice the logo.
    panel.position.set(17.94, y, 32.2);
    panel.rotation.y = -Math.PI / 2;
    group.add(panel);
    block(panel, 0, 0, -0.22, 0.7, 0.7, 0.36, charcoal);
    block(panel, 0, 0, 0, 1.3, 1.45, 0.08, enamel(colour, 0.14));
    return panel;
  }
  const upper = plaque("east-burger-king-plaque", 10.5, "#d4422e");
  const badgeOutline = new THREE.Shape();
  badgeOutline.moveTo(-0.29, -0.43);
  badgeOutline.lineTo(0.29, -0.43);
  badgeOutline.quadraticCurveTo(0.39, -0.43, 0.39, -0.33);
  badgeOutline.lineTo(0.39, 0.33);
  badgeOutline.quadraticCurveTo(0.39, 0.43, 0.29, 0.43);
  badgeOutline.lineTo(-0.29, 0.43);
  badgeOutline.quadraticCurveTo(-0.39, 0.43, -0.39, 0.33);
  badgeOutline.lineTo(-0.39, -0.33);
  badgeOutline.quadraticCurveTo(-0.39, -0.43, -0.29, -0.43);
  const upperBadge = extrude(upper, badgeOutline, white, 0.025);
  upperBadge.position.set(0, 0.19, 0.06);
  word(
    upper,
    "burgerIconOrange",
    0.7,
    0.773,
    0,
    0.19,
    0.1,
    orange,
    eastPlaqueContours,
  );
  word(
    upper,
    "burgerIconRed",
    0.7,
    0.773,
    0,
    0.19,
    0.1,
    red,
    eastPlaqueContours,
  );
  word(
    upper,
    "burgerChinese",
    1.04,
    (1.04 * 100) / 269,
    0,
    -0.46,
    0.08,
    white,
    eastPlaqueContours,
  );

  const lower = plaque("east-pizza-hut-plaque", 8.8, "#c92e4c");
  const disc = new THREE.Shape();
  disc.absarc(0, 0, 0.56, 0, Math.PI * 2, false);
  extrude(lower, disc, white, 0.025).position.z = 0.06;
  word(
    lower,
    "pizzaRound",
    1.055,
    (1.055 * 474) / 509,
    0,
    0,
    0.1,
    enamel("#ee3743", 0.12),
    eastPlaqueContours,
  );
  return group;
}
