import * as THREE from 'three';
import { photoPlaceholder, setPhotoPixels, type ProgressiveModelAssets } from '../lib/progressive-model-assets';
import { loadModelImage, yifuModelImages } from '../lib/model-image-assets';
import { croppedPhotoPoint, yifuBoardCrop, type PhotoCrop } from '../lib/photo-crop';

const fonts = '"Microsoft YaHei", "PingFang SC", sans-serif';
let boardPhoto: THREE.Texture | undefined;
let wallPhoto: THREE.Texture | undefined;
let brandTexture: THREE.CanvasTexture | undefined;
let preparing: Promise<void> | undefined;

/** 原照片只作为模型表面素材；四角 UV 校正拍摄透视，不重写现场招牌。 */
export function prepareYifuKioskAssets(): Promise<void> {
  if (preparing) return preparing;
  preparing = Promise.all([
    loadModelImage(yifuModelImages.board), loadModelImage(yifuModelImages.wall),
    loadModelImage(yifuModelImages.logistics), loadModelImage(yifuModelImages.crest),
  ]).then(([boardImage, wallImage, logistics, crest]) => {
    const board = new THREE.Texture(boardImage);
    const wall = new THREE.Texture(wallImage);
    for (const texture of [board, wall]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    }
    boardPhoto = board;
    wallPhoto = wall;
    brandTexture = canvasTexture(brandCanvas(logistics, crest));
  }).catch((error) => { preparing = undefined; throw error; });
  return preparing;
}

const brands = new WeakMap<HTMLImageElement, WeakMap<HTMLImageElement, HTMLCanvasElement>>();
function brandCanvas(logistics: HTMLImageElement, crest: HTMLImageElement) {
  let variants = brands.get(logistics);
  if (!variants) { variants = new WeakMap(); brands.set(logistics, variants); }
  const cached = variants.get(crest);
  if (cached) return cached;
    // 按项目约定使用随仓库保存的两份品牌原图，保留原始书法及校徽比例。
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 222;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d9aa64';
    ctx.fillRect(0, 0, 1024, 222);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 14; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#dfb774' : '#d6a867';
      ctx.fillRect(x * 75, y * 75, 75, 75);
    }
    const drawWhiteArtwork = (source: HTMLImageElement, x: number, y: number, w: number) => {
      const artwork = document.createElement('canvas');
      artwork.width = source.width; artwork.height = source.height;
      const c = artwork.getContext('2d')!;
      c.drawImage(source, 0, 0);
      const pixels = c.getImageData(0, 0, artwork.width, artwork.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        // 白色图案的绿色通道远高于紫色底；只去掉原图紫色底，绝不描摹字形。
        pixels.data[i + 3] = Math.max(0, Math.min(255, (pixels.data[i + 1] - 80) * 2));
        pixels.data[i] = 255; pixels.data[i + 1] = 249; pixels.data[i + 2] = 232;
      }
      c.putImageData(pixels, 0, 0);
      ctx.drawImage(artwork, x, y, w, w * artwork.height / artwork.width);
    };
    drawWhiteArtwork(crest, 22, 40, 87);
    drawWhiteArtwork(logistics, 125, 56, 240);
    variants.set(crest, canvas);
    return canvas;
}

function canvasTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function yifuLabel(text: string, width: number, height: number, background = '#f4ecdb', color = '#403a31') {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(256, Math.round(width * 600));
  canvas.height = Math.max(96, Math.round(height * 600));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const lines = text.split('\n');
  const size = Math.min(canvas.height / (lines.length * 1.55), canvas.width / (Math.max(...lines.map(l => l.length)) + 1));
  ctx.font = `600 ${size}px ${fonts}`;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * size * 1.45));
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: canvasTexture(canvas), roughness: 0.85, side: THREE.DoubleSide }));
}

/** 照片 5 柜台上粉色价目纸；只转录照片能辨识的品类和标价。 */
export function yifuMenuTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 800;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e8b5bb'; ctx.fillRect(0, 0, 640, 800);
  ctx.fillStyle = '#674246'; ctx.textAlign = 'center';
  ctx.font = `600 43px ${fonts}`; ctx.fillText('供 应 品 种', 320, 74);
  ctx.font = `34px ${fonts}`;
  ['猪排饭   12 元 / 份', '烤鸭饭   13 元 / 份', '鸡排饭   13 元 / 份', '牛排饭   15 元 / 份', '手 工 水 饺', '6 元 / 两（6 只）'].forEach((line, i) => ctx.fillText(line, 320, 172 + i * 88));
  ctx.strokeStyle = '#b47f89'; ctx.lineWidth = 2; ctx.strokeRect(18, 18, 604, 764);
  return canvasTexture(canvas);
}

type Point = readonly [number, number];
function photoPlane(map: THREE.Texture, width: number, height: number, corners: readonly [Point, Point, Point, Point], crop?: PhotoCrop) {
  // 使用细分 UV 保持正文直立，同时消除原拍摄中的梯形边缘。
  const geometry = new THREE.PlaneGeometry(width, height, 24, 32);
  const uv = geometry.getAttribute('uv');
  const [a, b, c, d] = corners;
  // 单位方形到照片四边形的单应变换（不是简单的仿射裁切）。
  const dx1 = b[0] - c[0], dx2 = d[0] - c[0], dx3 = a[0] - b[0] + c[0] - d[0];
  const dy1 = b[1] - c[1], dy2 = d[1] - c[1], dy3 = a[1] - b[1] + c[1] - d[1];
  const det = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(det) < 1e-8 ? 0 : (dx3 * dy2 - dx2 * dy3) / det;
  const h = Math.abs(det) < 1e-8 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  const x1 = b[0] - a[0] + g * b[0], x2 = d[0] - a[0] + h * d[0];
  const y1 = b[1] - a[1] + g * b[1], y2 = d[1] - a[1] + h * d[1];
  for (let i = 0; i < uv.count; i++) {
    const x = uv.getX(i), y = 1 - uv.getY(i), denominator = g * x + h * y + 1;
    const sourceX = (x1 * x + x2 * y + a[0]) / denominator;
    const sourceY = (y1 * x + y2 * y + a[1]) / denominator;
    const [sampleX, sampleY] = crop ? croppedPhotoPoint(sourceX, sourceY, crop) : [sourceX, sourceY];
    uv.setXY(i, sampleX, 1 - sampleY);
  }
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, roughness: 0.71, metalness: 0.02 }));
}

export function createYifuSignage(parent: THREE.Group, assets?: ProgressiveModelAssets) {
  const root = new THREE.Group(); root.name = 'yifu-photo-3-standing-board';
  root.position.set(2.38, 0.08, 3.63); root.rotation.y = -0.1;
  const panel = new THREE.Group(); panel.position.set(0, 0.7, 0); panel.rotation.x = -0.13; root.add(panel);
  const edge = new THREE.MeshStandardMaterial({ color: '#74716b', metalness: 0.65, roughness: 0.36 });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(0.91, 1.36, 0.035), edge); panel.add(backing); backing.castShadow = true;
  const boardMap = assets ? photoPlaceholder('#d8a568') : boardPhoto?.clone();
  if (assets && boardMap) assets.add([yifuModelImages.board], ([image]) => setPhotoPixels(boardMap, image));
  const face = boardMap ? photoPlane(boardMap, 0.89, 1.335, [[0.002, 0.059], [0.998, 0.058], [0.859, 0.939], [0.133, 0.944]], yifuBoardCrop) : yifuLabel('逸夫楼B102休闲食坊\n早餐 · 饮品 · 盒饭', 0.89, 1.335, '#d8a568', '#9f2927');
  face.position.z = 0.019; panel.add(face);
  const brandMap = assets ? photoPlaceholder('#d9aa64') : brandTexture?.clone();
  if (assets && brandMap) assets.add([yifuModelImages.logistics, yifuModelImages.crest], ([logistics, crest]) => setPhotoPixels(brandMap, brandCanvas(logistics, crest)));
  if (brandMap) {
    const originalBrand = new THREE.Mesh(new THREE.PlaneGeometry(0.89, 0.193), new THREE.MeshStandardMaterial({ map: brandMap, roughness: 0.8 }));
    originalBrand.name = 'yifu-original-nju-brand-artwork'; originalBrand.position.set(0, 0.571, 0.021); panel.add(originalBrand);
  }
  const rearLeg = new THREE.Mesh(new THREE.BoxGeometry(0.032, 1.09, 0.035), edge);
  rearLeg.position.set(0, 0.51, -0.27); rearLeg.rotation.x = 0.39; root.add(rearLeg);
  for (const x of [-0.38, 0.38]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.035, 0.16), new THREE.MeshStandardMaterial({ color: '#343434', roughness: 0.9 }));
    foot.position.set(x, 0, 0.065); root.add(foot);
  }
  root.traverse(node => { if (node instanceof THREE.Mesh) node.userData = { ...node.userData, kind: 'stall', id: 'v-yifu-f1-kiosk' }; });
  parent.add(root); return root;
}

export function createYifuWallArt(parent: THREE.Group, assets?: ProgressiveModelAssets) {
  const root = new THREE.Group(); root.name = 'yifu-west-wall-photo-art';
  root.position.set(-2.79, 2.08, -1.6); root.rotation.y = Math.PI / 2;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.96, 0.036), new THREE.MeshStandardMaterial({ color: '#322c27', roughness: 0.4 }));
  frame.castShadow = true; root.add(frame);
  const wallMap = assets ? photoPlaceholder('#d5ccba') : wallPhoto?.clone();
  if (assets && wallMap) assets.add([yifuModelImages.wall], ([image]) => setPhotoPixels(wallMap, image));
  if (wallMap) {
    // 原图 3072×4096 中裁出 (667,739)—(1142,1334)，同步换算 UV，保持原来的透视和取景。
    const art = photoPlane(wallMap, 0.727, 0.918, [[0.012143158, 0.003993277], [0.995183158, 0.121021849], [0.975781053, 0.995294118], [0.005675789, 0.967757983]]);
    art.position.z = 0.02; root.add(art);
  }
  const notice = yifuLabel('禁止吸烟\n请保持环境整洁', 0.32, 0.19, '#eee9d7', '#64554e');
  notice.position.set(1.02, -0.42, 0.023); root.add(notice);
  parent.add(root); return root;
}
