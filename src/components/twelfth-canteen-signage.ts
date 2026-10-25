import * as THREE from 'three';

type Section = 1 | 2 | 3 | 4;

/** Only legible photographed headings are reproduced; no inferred prices or menu items. */
const sections = {
  1: { title: '环球食光', menus: ['临榆炸鸡腿', '猪排饭', '卫孔记', '牛肉蘸水菜／麻辣烫'] },
  2: {
    title: '粉面食界',
    menus: ['五谷鱼粉', '土耳其烤肉拌饭', '炒饭／石锅／汤面', '法式焗面／瓦罐汤'],
  },
  3: { title: '稻香食坊', menus: ['火爆铁板烧', '江西小炒', '匠心卤', '一人一锅 自由搭配'] },
  4: { title: '一方食韵', menus: ['牛肉面', '广味轩·广式烧腊', '黑鸭煲', '瓦香鸡'] },
} as const;

function plane(canvas: HTMLCanvasElement, width: number, height: number, transparent: boolean) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent,
      depthWrite: !transparent,
      toneMapped: false,
    }),
  );
}

/** Canvas text stays distinct from the modeled fascia and its satin surface. */
export function twelfthTextPlane(
  text: string,
  width: number,
  height: number,
  ink = '#fff3cf',
  background = '',
) {
  const canvas = document.createElement('canvas');
  // A bounded long edge must reduce both dimensions together, or Chinese glyphs stretch.
  const density = Math.min(384 / Math.min(width, height), 2048 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * density));
  canvas.height = Math.max(1, Math.round(height * density));
  const ctx = canvas.getContext('2d')!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const lines = text.split('\n');
  const fontFamily = '"Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.font = `700 100px ${fontFamily}`;
  const measuredWidth = Math.max(
    ...lines.map((line) =>
      typeof ctx.measureText === 'function'
        ? ctx.measureText(line).width
        : Array.from(line).length * 100,
    ),
    1,
  );
  const size = Math.min(
    (canvas.height * 0.76) / lines.length,
    (canvas.width * 0.94 * 100) / measuredWidth,
  );
  ctx.font = `700 ${size}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  lines.forEach((line, i) =>
    ctx.fillText(line, canvas.width / 2, ((i + 0.5) * canvas.height) / lines.length),
  );
  const mesh = plane(canvas, width, height, !background);
  mesh.userData.signText = text;
  return mesh;
}

const palettes = [
  ['#4e1e16', '#fff4d8', '#c54128'],
  ['#f3f9ed', '#b73d2f', '#e34b40'],
  ['#68b934', '#f9ffec', '#38992a'],
  ['#346c89', '#eefbff', '#164f6b'],
  ['#27afd1', '#fffce6', '#dd3557'],
  ['#f5c2c8', '#a7332d', '#db402d'],
  ['#fcf3de', '#984328', '#e76b31'],
  ['#d4eeec', '#3c6d67', '#347b77'],
  ['#1aafd1', '#fffdf0', '#e7412f'],
  ['#d56a39', '#fff6d9', '#d13e2c'],
  ['#f4dfda', '#b03b37', '#e05b46'],
  ['#f5e85f', '#305970', '#3153a7'],
  ['#f8f0e6', '#a74637', '#d55b47'],
  ['#f5cbda', '#aa343a', '#ce3130'],
  ['#d3ecec', '#b33a3d', '#d95a41'],
  ['#dbeff0', '#ad3d3a', '#d3513a'],
] as const;

/** An illustrated bowl is decoration, not an invented photograph or a priced dish. */
function bowl(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, seed: number) {
  if (typeof ctx.beginPath !== 'function' || typeof ctx.ellipse !== 'function') return;
  function ellipse(cx: number, cy: number, rx: number, ry: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ellipse(x + 3, y + radius * 0.33, radius, radius * 0.65, '#45535a35');
  ellipse(x, y, radius, radius * 0.7, '#f9f8ec');
  ellipse(x, y, radius * 0.85, radius * 0.55, '#b97d3a');
  const ingredients = ['#efe1ac', '#d8c993', '#9c592e', '#d38c42', '#47733b', '#bf6635'];
  for (let i = 0; i < 45; i++) {
    const angle = i * 2.39996 + seed;
    const spread = Math.sqrt((i + 0.5) / 45);
    ellipse(
      x + Math.cos(angle) * radius * 0.73 * spread,
      y + Math.sin(angle) * radius * 0.45 * spread,
      radius * (0.07 + (i % 4) * 0.015),
      radius * 0.04,
      ingredients[(i + seed) % ingredients.length],
    );
  }
}

function menuScreen(title: string, number: number, width: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const [background, ink, accent] = palettes[number - 1];
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 1024, 8);
  ctx.fillRect(0, 244, 1024, 12);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.min(63, 900 / Array.from(title).length)}px "Microsoft YaHei", sans-serif`;
  ctx.fillText(title, 512, 46);
  // Match the photographed strips of dish illustrations without fake fine-print prices.
  const count = number === 1 || number === 3 || number === 9 ? 3 : 5;
  for (let i = 0; i < count; i++) {
    const x = 100 + (824 * (i + 0.5)) / count;
    bowl(ctx, x, 160, count === 3 ? 71 : 53, number + i);
  }
  if (number === 5 || number === 6) {
    ctx.font = '600 25px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#a9382b';
    ctx.fillText(number === 5 ? '淮南牛肉汤' : '蛋包饭系列', 512, 224);
  }
  const result = plane(canvas, width, 0.54, false);
  result.name = `twelfth-menu-screen-${number}`;
  result.userData = { windowNumber: number, signText: title, decorativeIllustration: true };
  return result;
}

/** Parent axes: +Z faces the dining aisle; keep the four photographed windows explicit. */
export function addTwelfthSignage(parent: THREE.Group, section: Section, width: number): void {
  const signage = new THREE.Group();
  signage.name = `twelfth-signage-section-${section}`;
  parent.add(signage);
  const { title, menus } = sections[section];
  const titleCenter = section === 1 ? width * 0.14 : 0;
  const titleWidth = width * (section === 1 ? 0.6 : 0.61);
  Array.from(title).forEach((character, index) => {
    const x = titleCenter + ((index - 1.5) * titleWidth) / 4;
    // Shallow letter layers suggest the real channel letters without a hard baked reflection.
    const shadow = twelfthTextPlane(character, 0.67, 0.65, '#672717');
    shadow.position.set(x + 0.022, 3.374, 1.064);
    signage.add(shadow);
    const letter = twelfthTextPlane(character, 0.67, 0.65, '#fff1cb');
    letter.position.set(x, 3.4, 1.085);
    letter.name = `twelfth-main-letter-${section}-${index}`;
    signage.add(letter);
  });
  if (section === 1) {
    const brand = twelfthTextPlane('临榆炸鸡腿', width * 0.26, 0.4, '#fff7ef');
    brand.position.set(-width * 0.35, 3.4, 1.086);
    brand.name = 'twelfth-linyu-fried-chicken-brand';
    signage.add(brand);
  }
  const frame = new THREE.MeshStandardMaterial({
    color: '#292723',
    roughness: 0.49,
    metalness: 0.18,
  });
  menus.forEach((text, index) => {
    const number = (section - 1) * 4 + index + 1;
    const x = ((index - 1.5) * width) / 4;
    const border = new THREE.Mesh(new THREE.BoxGeometry(width / 4 - 0.08, 0.59, 0.1), frame);
    border.position.set(x, 2.585, 1.025);
    border.name = `twelfth-menu-frame-${number}`;
    signage.add(border);
    const screen = menuScreen(text, number, width / 4 - 0.13);
    screen.position.set(x, 2.585, 1.08);
    signage.add(screen);
    const badge = twelfthTextPlane(String(number), 0.2, 0.2, '#fff4d5', '#a6422c');
    badge.position.set(x - width / 8 + 0.22, 2.17, 1.089);
    badge.name = `twelfth-window-number-${number}`;
    badge.userData.windowNumber = number;
    signage.add(badge);
  });
}
