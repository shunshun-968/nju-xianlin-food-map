import * as THREE from 'three';
import { twelfthTextPlane } from './twelfth-canteen-signage';

type PhotoNumber = 1 | 2 | 3 | 4 | 5;
const titles: Record<PhotoNumber, string> = {
  1: '靓汤佳肴',
  2: '食尚湘味',
  3: '寻味江南',
  4: '秦淮食坊',
  5: '天天主食',
};

function mappedPlane(canvas: HTMLCanvasElement, width: number, height: number) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map, toneMapped: false }),
  );
}

/** Printed decoration, with the photographed palette and composition; never a menu photograph. */
function plate(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  const ellipse = (px: number, py: number, rx: number, ry: number, color: string) => {
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  ellipse(x + r * 0.04, y + r * 0.08, r, r * 0.65, '#70847835');
  ellipse(x, y + r * 0.055, r, r * 0.65, '#9ea799');
  ellipse(x, y, r, r * 0.65, '#f8f4e3');
  ellipse(x, y, r * 0.93, r * 0.59, '#cad5c3');
  ellipse(x, y, r * 0.9, r * 0.56, '#fffdf0');
  ellipse(x, y, r * 0.84, r * 0.49, seed % 3 === 0 ? '#d9d19c' : '#98623d');
  const colors = ['#66833a', '#c89446', '#e6d4a0', '#8b492b', '#47753e'];
  for (let i = 0; i < 38; i++) {
    const a = i * 2.3999 + seed,
      spread = Math.sqrt((i + 0.5) / 38);
    ellipse(
      x + Math.cos(a) * r * 0.74 * spread,
      y + Math.sin(a) * r * 0.44 * spread,
      r * 0.11,
      r * 0.055,
      colors[(i + seed) % colors.length],
    );
  }
  if (seed % 3 === 0) {
    // Fine noodle strands and leafy garnish give the printed dishes distinct surfaces.
    ctx.strokeStyle = '#efe3af';
    ctx.lineWidth = r * 0.035;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.25 + i * r * 0.043);
      ctx.bezierCurveTo(
        x - r * 0.3,
        y - r * 0.5 + i * r * 0.06,
        x + r * 0.2,
        y + r * 0.3 - i * r * 0.025,
        x + r * 0.68,
        y - r * 0.3 + i * r * 0.046,
      );
      ctx.stroke();
    }
  } else if (seed % 3 === 1) {
    for (let i = 0; i < 5; i++) {
      const px = x + (i - 2) * r * 0.26,
        py = y + r * 0.02 + Math.sin(i * 2) * r * 0.13;
      ellipse(px, py, r * 0.19, r * 0.14, '#e5d2a1');
      ellipse(px, py - r * 0.025, r * 0.17, r * 0.12, '#f9edc8');
      ctx.strokeStyle = '#b8a576';
      ctx.lineWidth = r * 0.012;
      for (let n = 0; n < 5; n++) {
        ctx.beginPath();
        ctx.moveTo(px, py - r * 0.04);
        ctx.lineTo(px + (n - 2) * r * 0.05, py + r * 0.09);
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < 12; i++)
    ellipse(
      x + Math.sin(i * 2.4) * r * 0.55,
      y + Math.cos(i * 3.8) * r * 0.3,
      r * 0.025,
      r * 0.016,
      '#f5e9b6',
    );
  ctx.strokeStyle = '#f9f5df99';
  ctx.lineWidth = r * 0.015;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.94, r * 0.59, -0.1, Math.PI * 1.08, Math.PI * 1.75);
  ctx.stroke();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let t = 0; t <= Math.PI * 4; t += 0.12) {
    const r = radius * (1 - t / (Math.PI * 4));
    const px = x + Math.cos(t) * r,
      py = y + Math.sin(t) * r;
    if (t === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function bamboo(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.lineWidth = h * 0.012;
  ctx.strokeStyle = '#4d77685a';
  for (const shift of [-0.08, 0.05]) {
    ctx.beginPath();
    ctx.moveTo(x + h * shift, y + h);
    ctx.lineTo(x, y);
    ctx.stroke();
    for (let i = 1; i < 6; i++) {
      const py = y + (h * i) / 6,
        px = x + (h * shift * i) / 6;
      ctx.beginPath();
      ctx.moveTo(px - h * 0.027, py);
      ctx.lineTo(px + h * 0.027, py);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(
          px + side * h * 0.2,
          py - h * 0.12,
          px + side * h * 0.3,
          py - h * 0.11,
        );
        ctx.quadraticCurveTo(px + side * h * 0.18, py - h * 0.02, px, py);
        ctx.fillStyle = '#3c735874';
        ctx.fill();
      }
    }
  }
}

function goldCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  flip: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  for (const [offset, color] of [
    [0, '#795425'],
    [-size * 0.025, '#efd27a'],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.065;
    ctx.beginPath();
    ctx.moveTo(offset, size * 0.6);
    ctx.lineTo(offset, size * 0.16);
    ctx.quadraticCurveTo(offset, -size * 0.05, size * 0.25, 0);
    ctx.lineTo(size * 0.6, 0);
    ctx.stroke();
    cloud(ctx, size * 0.27, size * 0.25, size * 0.2);
  }
  ctx.fillStyle = '#f2db8e';
  ctx.beginPath();
  ctx.arc(size * 0.12, size * 0.12, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function printBoard(photo: PhotoNumber, width: number) {
  const height = 0.85;
  const canvas = document.createElement('canvas');
  canvas.width = 3072;
  canvas.height = Math.max(128, Math.round((canvas.width * height) / width));
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width,
    H = canvas.height;
  const background = ctx.createLinearGradient(0, 0, 0, H);
  if (photo === 5) {
    background.addColorStop(0, '#eeeed0');
    background.addColorStop(1, '#dedfba');
  } else {
    background.addColorStop(0, '#dcece3');
    background.addColorStop(1, '#c6ddd2');
  }
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);
  // Fine paper grain and patterned silk, kept extremely quiet behind the lettering.
  for (let i = 0; i < 4800; i++) {
    const x = (i * 137.51) % W,
      y = (i * 73.33) % H;
    ctx.fillStyle = i % 2 ? '#50695708' : '#ffffff12';
    ctx.fillRect(x, y, 1.3, 1.3);
  }
  ctx.strokeStyle = photo === 5 ? '#a9a25c42' : '#5e9f9c30';
  ctx.lineWidth = 0.8;
  for (let y = H * 0.18; y < H; y += H * 0.24)
    for (let x = W * 0.2; x < W * 0.8; x += H * 0.23) cloud(ctx, x, y, H * 0.14);
  if (photo === 2 || photo === 4) {
    ctx.strokeStyle = '#855d4d';
    ctx.lineWidth = H * 0.012;
    ctx.beginPath();
    for (let x = 0; x < W; x += H * 0.18) {
      ctx.moveTo(x, H * 0.045);
      ctx.lineTo(x + H * 0.1, H * 0.045);
      ctx.lineTo(x + H * 0.1, H * 0.095);
      ctx.lineTo(x + H * 0.16, H * 0.095);
      ctx.lineTo(x + H * 0.16, H * 0.025);
    }
    ctx.stroke();
    ctx.strokeStyle = '#f1f2dc';
    ctx.lineWidth = H * 0.006;
    ctx.strokeRect(H * 0.018, H * 0.018, W - H * 0.036, H * 0.964);
    ctx.strokeStyle = '#6a929366';
    ctx.lineWidth = H * 0.012;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.96);
    ctx.lineTo(W, H * 0.96);
    ctx.stroke();
  }
  if (photo === 1 || photo === 3) {
    // Water, lotus leaves and a distant Jiangnan roof evoke the printed ink landscape.
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ['#7eaa9a11', '#67978313', '#4e7f6b13'][layer];
      ctx.beginPath();
      ctx.moveTo(W * 0.77, H * 0.88);
      for (let i = 0; i <= 14; i++)
        ctx.lineTo(
          W * (0.77 + i * 0.016),
          H * (0.65 + Math.sin(i * 1.3 + layer) * 0.08 + layer * 0.055),
        );
      ctx.lineTo(W, H);
      ctx.lineTo(W * 0.77, H);
      ctx.closePath();
      ctx.fill();
    }
    bamboo(ctx, W * 0.985, H * 0.06, H * 0.63);
    ctx.strokeStyle = '#739d9235';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W * 0.77, H * (0.87 + i * 0.015));
      ctx.bezierCurveTo(
        W * 0.84,
        H * (0.85 + i * 0.015),
        W * 0.91,
        H * (0.9 + i * 0.015),
        W * 0.98,
        H * (0.87 + i * 0.015),
      );
      ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = W * (0.91 + 0.035 * Math.sin(i * 2.2)),
        y = H * (0.67 + 0.2 * Math.sin(i * 0.73));
      ctx.beginPath();
      ctx.ellipse(x, y, H * 0.12, H * 0.045, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#386e5f55';
      ctx.fill();
    }
    if (photo === 3) {
      ctx.fillStyle = '#35594d';
      ctx.beginPath();
      ctx.moveTo(W * 0.9, H * 0.6);
      ctx.lineTo(W * 0.935, H * 0.41);
      ctx.lineTo(W * 0.975, H * 0.56);
      ctx.lineTo(W * 0.955, H * 0.59);
      ctx.lineTo(W * 0.92, H * 0.61);
      ctx.closePath();
      ctx.fill();
      for (const x of [0.918, 0.952]) ctx.fillRect(W * x, H * 0.58, H * 0.012, H * 0.26);
      ctx.fillRect(W * 0.91, H * 0.84, W * 0.06, H * 0.018);
      ctx.strokeStyle = '#769385';
      ctx.lineWidth = H * 0.008;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(W * (0.905 + i * 0.007), H * 0.57);
        ctx.lineTo(W * (0.925 + i * 0.003), H * 0.46);
        ctx.stroke();
      }
      ctx.fillStyle = '#c3d4bd';
      ctx.fillRect(W * 0.917, H * 0.62, W * 0.038, H * 0.18);
      ctx.strokeStyle = '#416253';
      ctx.lineWidth = H * 0.012;
      ctx.strokeRect(W * 0.917, H * 0.62, W * 0.038, H * 0.18);
      ctx.strokeStyle = '#37604f';
      ctx.lineWidth = H * 0.01;
      ctx.beginPath();
      ctx.moveTo(W * 0.78, H * 0.92);
      ctx.quadraticCurveTo(W * 0.83, H * 0.73, W * 0.88, H * 0.92);
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const xx = W * (0.79 + i * 0.013),
          yy = H * (0.92 - 0.1 * Math.sin(((i + 1) * Math.PI) / 8));
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, yy - H * 0.045);
        ctx.stroke();
      }
    }
  }
  // Decorative plates sit outside the four large characters, like the source banners.
  plate(ctx, W * 0.065, H * 0.43, H * 0.31, photo);
  plate(ctx, W * 0.15, H * 0.7, H * 0.22, photo + 2);
  if (photo !== 1) plate(ctx, W * 0.85, H * 0.37, H * 0.27, photo + 4);
  if (photo === 2 || photo === 4 || photo === 5)
    plate(ctx, W * 0.94, H * 0.68, H * 0.23, photo + 1);
  if (photo === 1) {
    ctx.fillStyle = '#b9994e';
    ctx.fillRect(W * 0.22, H * 0.78, W * 0.58, H * 0.16);
    const scroll = ctx.createLinearGradient(0, H * 0.77, 0, H * 0.96);
    scroll.addColorStop(0, '#795b2e');
    scroll.addColorStop(0.3, '#d7be79');
    scroll.addColorStop(0.7, '#e1d5a7');
    scroll.addColorStop(1, '#856333');
    ctx.fillStyle = scroll;
    ctx.fillRect(W * 0.215, H * 0.77, W * 0.59, H * 0.19);
    for (const x of [W * 0.21, W * 0.8]) {
      const roller = ctx.createLinearGradient(x, 0, x + W * 0.015, 0);
      roller.addColorStop(0, '#75542b');
      roller.addColorStop(0.5, '#e5ca7c');
      roller.addColorStop(1, '#9b7436');
      ctx.fillStyle = roller;
      ctx.fillRect(x, H * 0.755, W * 0.016, H * 0.22);
    }
    for (let i = 0; i < 7; i++) plate(ctx, W * (0.26 + i * 0.079), H * 0.85, H * 0.095, i);
  }
  const title = titles[photo];
  const left = photo === 1 ? 0.265 : 0.255,
    right = photo === 1 ? 0.76 : 0.745;
  for (const [index, char] of Array.from(title).entries()) {
    const x = W * (left + ((right - left) * index) / 3),
      y = H * (photo === 1 ? 0.4 : 0.49);
    const radius = H * 0.375;
    if (photo === 2 || photo === 4) {
      ctx.fillStyle = '#d5bc3d';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e5d56a';
      ctx.lineWidth = H * 0.012;
      ctx.stroke();
    }
    if (photo === 5) {
      const plaqueWidth = W * 0.145,
        plaqueHeight = H * 0.78;
      const gold = ctx.createLinearGradient(x - plaqueWidth / 2, 0, x + plaqueWidth / 2, 0);
      gold.addColorStop(0, '#795528');
      gold.addColorStop(0.15, '#c59b38');
      gold.addColorStop(0.5, '#e1c65b');
      gold.addColorStop(0.85, '#c59b38');
      gold.addColorStop(1, '#795528');
      ctx.fillStyle = gold;
      ctx.fillRect(x - plaqueWidth / 2, H * 0.1, plaqueWidth, plaqueHeight);
      ctx.strokeStyle = '#a67e31';
      ctx.lineWidth = H * 0.035;
      ctx.strokeRect(x - plaqueWidth / 2, H * 0.1, plaqueWidth, plaqueHeight);
      ctx.strokeStyle = '#f4d980';
      ctx.lineWidth = H * 0.013;
      ctx.strokeRect(
        x - plaqueWidth / 2 + H * 0.07,
        H * 0.16,
        plaqueWidth - H * 0.14,
        plaqueHeight - H * 0.12,
      );
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = i % 2 ? '#765d2416' : '#ffffb518';
        ctx.fillRect(
          x - plaqueWidth / 2 + (i * plaqueWidth) / 14,
          H * 0.13,
          plaqueWidth / 30,
          plaqueHeight - 0.05 * H,
        );
      }
      for (let yy = H * 0.2; yy < H * 0.82; yy += H * 0.06)
        for (let xx = x - plaqueWidth * 0.41; xx < x + plaqueWidth * 0.41; xx += H * 0.06) {
          ctx.fillStyle = '#8c72231a';
          ctx.fillRect(xx, yy, H * 0.017, H * 0.027);
        }
      for (const side of [-1, 1]) {
        goldCorner(ctx, x + (side * plaqueWidth) / 2, H * 0.13, H * 0.23, -side);
        ctx.save();
        ctx.translate(0, H * 0.96);
        ctx.scale(1, -1);
        goldCorner(ctx, x + (side * plaqueWidth) / 2, H * 0.13, H * 0.23, -side);
        ctx.restore();
      }
    }
    const font =
      photo === 1
        ? '"KaiTi", "STKaiti", serif'
        : photo === 5
          ? '"KaiTi", "STKaiti", serif'
          : '"Microsoft YaHei", sans-serif';
    ctx.font = `900 ${H * (photo === 1 ? 0.57 : 0.66)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = photo === 1 ? '#f1f3e7' : '#f7eed4';
    ctx.lineWidth = H * 0.045;
    ctx.strokeText(char, x, y);
    ctx.fillStyle = photo === 1 ? '#214f43' : photo === 3 && index < 2 ? '#4b2d2e' : '#a52f32';
    ctx.fillText(char, x, y);
  }
  const result = mappedPlane(canvas, width, height);
  result.name = `eleventh-main-sign-${photo}`;
  result.userData = { signText: title, sourcePhotoNumber: photo, decorativeIllustration: true };
  return result;
}

/** A continuous bright glyph core preserves small strokes; fine cells add LED texture. */
function ledBoard(photo: 1 | 2 | 3, width: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = Math.round((4096 * 0.46) / width);
  const W = canvas.width,
    H = canvas.height,
    ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#151b19';
  ctx.fillRect(0, 0, W, H);
  const words =
    photo === 1
      ? ['现 点 小 炒']
      : photo === 2
        ? ['普通饭菜', '普通饭菜', '普通饭菜']
        : ['减 脂 套 餐', '学子套餐'];
  const centers = photo === 1 ? [0.5] : photo === 2 ? [0.17, 0.5, 0.83] : [0.25, 0.75];
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const paint = mask.getContext('2d')!;
  paint.fillStyle = '#ffffff';
  paint.textAlign = 'center';
  paint.textBaseline = 'middle';
  paint.font = `700 ${H * 0.76}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  words.forEach((word, i) => paint.fillText(word, W * centers[i], H * 0.52));
  // Never perforate the small horizontal stroke in 子: it must not read as 了.
  ctx.font = paint.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f23f43';
  words.forEach((word, i) => ctx.fillText(word, W * centers[i], H * 0.52));
  const pixels = paint.getImageData(0, 0, W, H).data;
  const pitch = Math.max(2, Math.round(H / 80));
  for (let y = 1; y < H; y += pitch)
    for (let x = 1; x < W; x += pitch) {
      const lit = pixels[(Math.min(y, H - 1) * W + Math.min(x, W - 1)) * 4 + 3] > 70;
      ctx.fillStyle = lit ? '#ff8275' : '#371f2028';
      ctx.fillRect(x, y, pitch * 0.55, pitch * 0.55);
    }
  const result = mappedPlane(canvas, width, 0.46);
  result.name = `eleventh-led-sign-${photo}`;
  result.userData.signText = words.join('／');
  return result;
}

function menuBoard(text: string, subtitle: string, width: number, bg: string, ink: string) {
  const board = twelfthTextPlane(text + '\n' + subtitle, width, 0.5, ink, bg);
  board.name = 'eleventh-printed-menu';
  return board;
}

/** Parent local +Z faces the serving aisle; the root owns the steel frame and wall. */
export function addEleventhSignage(
  parent: THREE.Group,
  photoNumber: PhotoNumber,
  width: number,
): void {
  const group = new THREE.Group();
  group.name = `eleventh-signage-${photoNumber}`;
  parent.add(group);
  const main = printBoard(photoNumber, width - 0.06);
  main.position.set(0, 3.5, 1.08);
  group.add(main);
  const count = photoNumber === 1 ? 2 : 4;
  const first = photoNumber === 1 ? 17 : (5 - photoNumber) * 4 + 1;
  if (photoNumber <= 3) {
    const led = ledBoard(photoNumber as 1 | 2 | 3, width - 0.06);
    led.position.set(0, 2.53, 1.08);
    group.add(led);
  } else {
    const menus =
      photoNumber === 4
        ? [
            ['金陵老卤面', '', '#f2efdf', '#663a36'],
            ['鸭血粉丝汤 & 小笼包', '', '#c6362c', '#f1df6a'],
            ['金陵小吃', '小馄饨 · 手抓饼', '#f4e7cc', '#8b3f35'],
            ['铁板饭', '', '#f1efdf', '#383d35'],
          ]
        : [
            ['早餐品种', '早点 · 面点', '#f4eee4', '#9c3e35'],
            ['猪脚饭', '笼仔荷叶饭', '#b63831', '#fff0dd'],
            ['泡面工坊', '', '#dc963c', '#fff3d5'],
            ['锅仔系列', '', '#bc4036', '#fff0d4'],
          ];
    menus.forEach(([title, subtitle, bg, ink], index) => {
      const menu = menuBoard(title, subtitle, width / 4 - 0.18, bg, ink);
      menu.position.set(((index - 1.5) * width) / 4, 2.53, 1.08);
      menu.userData.windowNumber = first + index;
      group.add(menu);
    });
  }
  for (let index = 0; index < count; index++) {
    const badge = twelfthTextPlane(String(first + index), 0.35, 0.37, '#fff9ee', '#4c2c53');
    badge.position.set(-width / 2 + ((index + 1) * width) / count - 0.24, 2.15, 1.082);
    badge.name = `eleventh-window-number-${first + index}`;
    badge.userData.windowNumber = first + index;
    group.add(badge);
  }
  if (photoNumber === 5) {
    const soup = twelfthTextPlane('免费汤\n供应窗口', 0.8, 0.38, '#fff4e7', '#4c2c53');
    soup.position.set(-width * 0.15, 1.96, 1.083);
    group.add(soup);
  }
  if (photoNumber === 3) {
    const student = twelfthTextPlane('学子特价套餐窗口', width * 0.22, 0.22, '#f6eddf', '#543257');
    student.position.set(width * 0.365, 1.88, 1.084);
    group.add(student);
  }
}
