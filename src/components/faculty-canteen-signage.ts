import * as THREE from 'three';
import { prepareImages } from '../lib/image-assets';
import { loadModelTexture } from '../lib/model-texture-loader';
import { twelfthTextPlane } from './twelfth-canteen-signage';

const logisticsArtwork = new URL('../assets/branding/南大后勤.png', import.meta.url).href;
export function prepareFacultySignageAssets() { return prepareImages([logisticsArtwork]); }
const sans = '"Microsoft YaHei", "PingFang SC", sans-serif';
const brush = '"KaiTi", "STKaiti", "SimSun", serif';
const mainTitles = [
  '轻食能量站',
  '午餐供应／晚餐供应',
  '普通饭菜',
  '普通饭菜',
  '面坊',
  '营养汤／免费汤',
];

function canvasPlane(canvas: HTMLCanvasElement, width: number, height: number) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map, toneMapped: false }),
  );
}

function lettering(
  ctx: CanvasRenderingContext2D,
  words: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  color: string,
  family = sans,
) {
  ctx.font = `700 ${size}px ${family}`;
  const measured =
    typeof ctx.measureText === 'function' ? ctx.measureText(words).width : words.length * size;
  ctx.font = `700 ${Math.min(size, (size * maxWidth) / Math.max(1, measured))}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(words, x, y);
}

/** Printed food illustrations describe the photographed composition, not invented menu photographs. */
function dish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  seed: number,
  salad = false,
) {
  const ellipse = (cx: number, cy: number, rx: number, ry: number, ink: string, angle = 0) => {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  };
  ellipse(x + 3, y + 5, r, r * 0.63, '#5a655533');
  ellipse(x, y, r, r * 0.63, '#d4d9c6');
  ellipse(x, y - 2, r * 0.97, r * 0.6, '#fffdf2');
  ellipse(x, y - 2, r * 0.85, r * 0.49, salad ? '#c4d6a0' : '#b18b49');
  const colors = salad
    ? ['#5e984c', '#9bb867', '#385e36', '#c96458', '#f2ead0', '#795072']
    : ['#c28036', '#edce7c', '#709643', '#a54f2b', '#eee1b5', '#4e713e'];
  for (let i = 0; i < 50; i++) {
    const a = i * 2.39996 + seed,
      spread = Math.sqrt((i + 0.5) / 50);
    ellipse(
      x + Math.cos(a) * r * 0.75 * spread,
      y + Math.sin(a) * r * 0.42 * spread,
      r * (salad ? 0.13 : 0.105),
      r * 0.06,
      colors[(i + seed) % colors.length],
      a,
    );
  }
  if (!salad && seed % 3 === 0) {
    ctx.strokeStyle = '#f7e9b0';
    ctx.lineWidth = r * 0.025;
    for (let i = 0; i < 13; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.66, y - r * 0.25 + i * r * 0.038);
      ctx.bezierCurveTo(
        x - r * 0.2,
        y - r * 0.5,
        x + r * 0.15,
        y + r * 0.4,
        x + r * 0.64,
        y - r * 0.2 + i * r * 0.037,
      );
      ctx.stroke();
    }
  }
}

function flourish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  mirror: number,
) {
  ctx.strokeStyle = '#e4b72d';
  ctx.lineWidth = size * 0.13;
  ctx.beginPath();
  for (let i = 0; i <= 54; i++) {
    const t = i / 54,
      angle = t * Math.PI * 3.5,
      radius = size * (1 - t * 0.9);
    const px = x + mirror * Math.cos(angle) * radius,
      py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function printedMain(number: number, width: number) {
  const height = 0.95,
    canvas = document.createElement('canvas');
  const density = Math.min(410, 2048 / width);
  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);
  const ctx = canvas.getContext('2d')!,
    w = canvas.width,
    h = canvas.height;
  ctx.fillStyle = '#f9f8ed';
  ctx.fillRect(0, 0, w, h);
  if (number === 1) {
    ctx.fillStyle = '#eaf5df';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fcfff2';
    ctx.fillRect(4, 7, w - 8, h - 14);
    ctx.fillStyle = '#acd373';
    for (let x = 8; x < w; x += 27) {
      ctx.fillRect(x, 2, 14, 4);
      ctx.fillRect(x, h - 6, 14, 4);
    }
    lettering(ctx, '轻食能量站', w * 0.4, h * 0.39, h * 0.28, w * 0.68, '#42a78f');
    ctx.fillStyle = '#55b797';
    ctx.beginPath();
    ctx.roundRect(w * 0.16, h * 0.69, w * 0.44, h * 0.17, h * 0.08);
    ctx.fill();
    lettering(ctx, '零负担  轻能量', w * 0.38, h * 0.775, h * 0.105, w * 0.41, '#fffcef');
    dish(ctx, w * 0.82, h * 0.5, Math.min(h * 0.6, w * 0.17), 1, true);
  } else if (number === 2) {
    ctx.fillStyle = '#ee4c48';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) {
      const x = w * (0.025 + i * 0.495),
        cw = w * 0.455;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath();
      ctx.roundRect(x, h * 0.22, cw, h * 0.7, h * 0.065);
      ctx.fill();
      ctx.fillStyle = '#f5cd25';
      ctx.beginPath();
      ctx.roundRect(x + cw * 0.15, h * 0.075, cw * 0.7, h * 0.18, h * 0.04);
      ctx.fill();
      lettering(
        ctx,
        i === 0 ? '午 餐 供 应' : '晚 餐 供 应',
        x + cw * 0.5,
        h * 0.167,
        h * 0.115,
        cw * 0.65,
        '#ffffed',
      );
      if (i === 0) {
        lettering(ctx, '普通饭菜', x + cw * 0.5, h * 0.37, h * 0.103, cw * 0.85, '#694742');
        for (let j = 0; j < 4; j++)
          dish(ctx, x + cw * (0.14 + j * 0.24), h * 0.7, Math.min(cw * 0.115, h * 0.23), j + 1);
      } else {
        lettering(ctx, '麻辣香锅', x + cw * 0.25, h * 0.37, h * 0.1, cw * 0.45, '#694742');
        lettering(ctx, '特色小炒', x + cw * 0.75, h * 0.37, h * 0.1, cw * 0.45, '#694742');
        for (let j = 0; j < 4; j++)
          dish(ctx, x + cw * (0.14 + j * 0.24), h * 0.7, Math.min(cw * 0.115, h * 0.23), j + 5);
      }
    }
  } else if (number === 3 || number === 4) {
    ctx.fillStyle = '#785934';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#987145';
    ctx.lineWidth = 2;
    for (let y = 4; y < h; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + 2);
      ctx.stroke();
    }
    for (const center of [w * 0.145, w * 0.855]) {
      for (const side of [-1, 1])
        for (const row of [0.18, 0.81])
          flourish(ctx, center + side * w * 0.07, h * row, h * 0.19, side);
      dish(ctx, center, h * 0.5, Math.min(h * 0.43, w * 0.11), number);
    }
    ctx.fillStyle = '#dac270';
    ctx.fillRect(w * 0.285, 8, w * 0.43, h - 16);
    ctx.fillStyle = '#151b18';
    ctx.fillRect(w * 0.294, 15, w * 0.412, h - 30);
    lettering(ctx, '普通饭菜', w * 0.5, h * 0.51, h * 0.38, w * 0.374, '#f34862', brush);
    ctx.fillStyle = '#11191335';
    for (let x = w * 0.295; x < w * 0.705; x += 7)
      for (let y = 16; y < h - 15; y += 7) ctx.fillRect(x, y, 2, 2);
    ctx.strokeStyle = '#e2bd45';
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  } else if (number === 5) {
    ctx.fillStyle = '#ca6250';
    ctx.fillRect(0, h * 0.47, w, h * 0.53);
    ctx.fillStyle = '#fff9ec';
    ctx.fillRect(w * 0.035, h * 0.49, w * 0.93, h * 0.44);
    lettering(ctx, '面  坊', w * 0.51 + 2, h * 0.24 + 2, h * 0.31, w * 0.6, '#8b6c53', brush);
    lettering(ctx, '面  坊', w * 0.51, h * 0.24, h * 0.31, w * 0.6, '#d65a4c', brush);
    dish(ctx, w * 0.12, h * 0.25, h * 0.17, 3);
    lettering(ctx, '等你来', w * 0.925, h * 0.15, h * 0.082, w * 0.1, '#be5144', brush);
    lettering(ctx, '尝鲜', w * 0.925, h * 0.3, h * 0.12, w * 0.1, '#be5144', brush);
    ctx.strokeStyle = '#be5144';
    ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.866, h * 0.045, w * 0.115, h * 0.365);
    for (let i = 0; i < 5; i++)
      dish(ctx, w * (0.13 + i * 0.185), h * 0.72, Math.min(h * 0.255, w * 0.077), i * 3);
    ctx.strokeStyle = '#fff6e9';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  } else if (number === 6) {
    ctx.fillStyle = '#fdfcf6';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e2cc87';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.73);
    ctx.quadraticCurveTo(w * 0.5, h * 1.13, w, h * 0.76);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
    for (const [title, x] of [
      ['营 养 汤', w * 0.22],
      ['免 费 汤', w * 0.78],
    ] as const) {
      lettering(ctx, title, x + 2, h * 0.32 + 3, h * 0.28, w * 0.36, '#8f8271');
      lettering(ctx, title, x, h * 0.32, h * 0.28, w * 0.36, '#c4a24c');
    }
    ['新鲜食材 地道本味', '匠心熬制 营养美味', '优选好料 暖心相伴'].forEach((line, i) =>
      lettering(ctx, line, w * 0.5, h * (0.22 + i * 0.14), h * 0.067, w * 0.23, '#aeb0a0', brush),
    );
    for (let i = 0; i < 6; i++)
      dish(ctx, w * (i < 3 ? 0.09 + i * 0.125 : 0.66 + (i - 3) * 0.125), h * 0.78, h * 0.22, i + 8);
  }
  const mesh = canvasPlane(canvas, width, height);
  mesh.name = `faculty-main-sign-${number}`;
  mesh.userData = {
    windowNumber: number,
    signText: mainTitles[number - 1],
    decorativeIllustration: true,
  };
  return mesh;
}

/** Each parent is one numbered opening; +Z faces the serving aisle. */
export function addFacultySignage(parent: THREE.Group, number: number, width: number): void {
  const group = new THREE.Group();
  group.name = `faculty-signage-${number}`;
  group.userData.windowNumber = number;
  parent.add(group);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: '#69736d',
    metalness: 0.6,
    roughness: 0.35,
  });
  const frame = (name: string, x: number, y: number, w: number, h: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.045, h + 0.045, 0.075), frameMaterial);
    mesh.name = name;
    mesh.position.set(x, y, 1.035);
    group.add(mesh);
    return mesh;
  };
  function label(
    name: string,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    ink: string,
    background: string,
  ) {
    frame(`${name}-frame`, x, y, w, h);
    const mesh = twelfthTextPlane(text, w, h, ink, background);
    mesh.name = name;
    mesh.position.set(x, y, 1.09);
    mesh.userData.windowNumber = number;
    group.add(mesh);
    return mesh;
  }
  let originalMap: THREE.Texture | undefined;
  function logo(name: string, x: number, y: number, w: number) {
    // Preserve the provided artwork and 390:180 aspect ratio. Canvas-only tests need no network image loader.
    if (typeof document.createElementNS !== 'function') return;
    if (!originalMap) {
      originalMap = loadModelTexture(logisticsArtwork);
      originalMap.colorSpace = THREE.SRGBColorSpace;
      originalMap.anisotropy = 8;
    }
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, (w * 180) / 390),
      new THREE.MeshBasicMaterial({
        map: originalMap,
        transparent: true,
        toneMapped: false,
        depthWrite: false,
      }),
    );
    mesh.name = name;
    mesh.position.set(x, y, 1.097);
    mesh.userData.originalArtwork = logisticsArtwork;
    group.add(mesh);
  }
  if (number !== 7) {
    const w = width - 0.09;
    frame(`faculty-main-frame-${number}`, 0, 3.475, w, 0.95);
    const main = printedMain(number, w);
    main.position.set(0, 3.475, 1.09);
    group.add(main);
  }
  const badgeX = number === 7 ? -width * 0.2 : 0;
  label(`faculty-number-background-${number}`, '', badgeX, 2.765, 0.38, 0.44, '#fff9eb', '#422b43');
  const numeral = twelfthTextPlane(String(number), 0.32, 0.28, '#fff9eb');
  numeral.name = `faculty-window-number-${number}`;
  numeral.userData.windowNumber = number;
  numeral.position.set(badgeX, 2.69, 1.096);
  group.add(numeral);
  logo(`faculty-number-original-logo-${number}`, badgeX, 2.9, 0.28);
  if (number === 1) {
    label('faculty-light-meal-subtitle', '轻食能量站', 0, 2.4, 0.45, 0.25, '#65362e', '#dba69a');
  } else if (number === 2) {
    label(
      'faculty-added-malatang',
      '本窗口新增\n麻辣烫',
      0,
      2.39,
      0.64,
      0.29,
      '#5e3b38',
      '#dda3a1',
    );
  } else if (number === 3) {
    label(
      'faculty-duty-window',
      '值班窗口',
      width * 0.16,
      2.65,
      width * 0.16,
      0.46,
      '#fff8ed',
      '#6b2f57',
    );
    label(
      'faculty-duty-hours',
      '中餐营业至 13:30\n晚餐营业至 19:30',
      width * 0.355,
      2.65,
      width * 0.23,
      0.46,
      '#fff8ed',
      '#6b2f57',
    );
  } else if (number === 4) {
    label(
      'faculty-no-sugar-window',
      '低脂低盐低油\n无糖窗口',
      -width * 0.35,
      2.7,
      width * 0.21,
      0.34,
      '#fffcef',
      '#554364',
    );
    label(
      'faculty-evening-egg-rice',
      '滑蛋饭\n晚餐供应',
      width * 0.34,
      2.65,
      width * 0.23,
      0.46,
      '#92412f',
      '#f6f1df',
    );
  } else if (number === 5) {
    label(
      'faculty-nine-ingredients-noodles',
      '九鲜大碗面',
      -width * 0.35,
      2.72,
      width * 0.24,
      0.28,
      '#684637',
      '#fbf7e9',
    );
    label(
      'faculty-noodle-menu',
      '特色小煮面\n炒面／干拌面',
      -width * 0.14,
      2.72,
      width * 0.16,
      0.3,
      '#693e30',
      '#fbf7e9',
    );
    const riceMenu = label(
      'faculty-rice-menu',
      '',
      width * 0.27,
      2.73,
      width * 0.44,
      0.36,
      '#fff6e4',
      '#493044',
    );
    riceMenu.userData.signText = '教工下饭菜';
    const riceHeading = twelfthTextPlane('教 工 下 饭 菜', width * 0.32, 0.27, '#fff6e4');
    riceHeading.name = 'faculty-rice-menu-heading';
    riceHeading.position.set(width * 0.32, 2.73, 1.096);
    group.add(riceHeading);
    logo('faculty-rice-original-logo', width * 0.1, 2.73, 0.32);
    label('faculty-order-point', '点餐处', -width * 0.12, 2.32, 0.55, 0.31, '#49372b', '#d89d91');
    label('faculty-pickup-point', '取餐处', 0, 2.32, 0.55, 0.31, '#49372b', '#d89d91');
  } else if (number === 7) {
    label(
      'faculty-open-kitchen-sign',
      '明档小炒',
      -width * 0.36,
      2.68,
      width * 0.2,
      0.54,
      '#ba4d3c',
      '#faf8ed',
    );
    const jinlingMenu = label(
      'faculty-jinling-menu',
      '',
      width * 0.145,
      2.7,
      width * 0.51,
      0.47,
      '#fff9ed',
      '#684a6e',
    );
    jinlingMenu.userData.signText = '金陵小炒';
    const jinlingHeading = twelfthTextPlane('金 陵 小 炒', width * 0.34, 0.31, '#fff9ed');
    jinlingHeading.name = 'faculty-jinling-menu-heading';
    jinlingHeading.position.set(width * 0.2, 2.7, 1.096);
    group.add(jinlingHeading);
    logo('faculty-jinling-original-logo', -width * 0.05, 2.7, 0.42);
  }
}
