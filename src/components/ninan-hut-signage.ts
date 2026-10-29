import * as THREE from 'three';
import { loadModelImage, ninanModelImages } from '../lib/model-image-assets';
import { croppedPhotoPoint, ninanPostersCrop } from '../lib/photo-crop';
import { photoPlaceholder, setPhotoPixels, type ProgressiveModelAssets } from '../lib/progressive-model-assets';

const urls = ninanModelImages;
type Asset = keyof typeof urls;
const images = new Map<Asset, HTMLImageElement>();
// 同一实拍照片用于两块牌时共用像素源，让 Three 在同一渲染器中只上传一次。
// Texture 仍由每个模型独立拥有，释放其中一块牌不会提前释放另一块牌。
const textureSources = new WeakMap<TexImageSource, THREE.Source>();
const brandCanvases = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();
let preparing: Promise<void> | undefined;

/** 保存解码图片，每次模型使用自己的纹理，可随场景安全释放。 */
export function prepareNinanHutAssets() {
  if (!preparing)
    preparing = Promise.all(
      Object.entries(urls).map(async ([name, url]) => {
        const image = await loadModelImage(url);
        images.set(name as Asset, image);
      }),
    )
      .then(() => {})
      .catch((error) => {
        preparing = undefined;
        throw error;
      });
  return preparing;
}

function texture(image: TexImageSource) {
  const map = new THREE.Texture(image);
  let source = textureSources.get(image);
  if (!source) {
    source = map.source;
    textureSources.set(image, source);
  }
  map.source = source;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.needsUpdate = true;
  return map;
}

export function ninanLabel(
  text: string,
  width: number,
  height: number,
  color = '#fff6e8',
  background?: string,
) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(512, Math.round(width * 400));
  canvas.height = Math.max(128, Math.round(height * 400));
  const ctx = canvas.getContext('2d')!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const lines = text.split('\n');
  const size = Math.min(
    canvas.height / (lines.length * 1.25),
    canvas.width / (Math.max(...lines.map((l) => l.length)) + 0.5),
  );
  ctx.font = `600 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  lines.forEach((line, index) =>
    ctx.fillText(
      line,
      canvas.width / 2,
      canvas.height / 2 + (index - (lines.length - 1) / 2) * size * 1.2,
    ),
  );
  const map = texture(canvas);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map,
      transparent: !background,
      roughness: 0.8,
      side: THREE.DoubleSide,
      emissive: background ? '#000000' : color,
      emissiveMap: background ? null : map,
      emissiveIntensity: background ? 0 : 0.8,
      depthWrite: !!background,
    }),
  );
}

/** 发光字是单面灯箱字：东面粉紫正字，西面白色反字，不能在背面另做一套正字。 */
export function ninanFacadeLetters(text: string, width: number, height: number) {
  const group = new THREE.Group();
  group.name = 'ninan-photo-wall-letters';
  const front = ninanLabel(text, width, height, '#df67e8');
  front.name = 'ninan-photo-wall-letters-front';
  front.position.z = 0.035;
  front.material.side = THREE.FrontSide;
  front.material.alphaTest = 0.1;
  front.material.depthWrite = true;
  const rear = ninanLabel(text, width, height, '#f4f4ef');
  rear.name = 'ninan-photo-wall-letters-rear';
  rear.position.z = -0.035;
  rear.rotation.y = Math.PI;
  rear.material.side = THREE.FrontSide;
  rear.material.alphaTest = 0.1;
  rear.material.depthWrite = true;
  rear.material.emissive.set('#000000');
  rear.material.emissiveMap = null;
  rear.material.emissiveIntensity = 0;
  // 旋转后的西面自身坐标仍会把文字正读；反转 UV 才是同一组立体字的真实背面。
  const uv = rear.geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index++) uv.setX(index, 1 - uv.getX(index));
  group.add(front, rear);
  return group;
}

/** 直接采用品牌原图像素，只去紫底并着色，保留字形与宽高比。 */
export function ninanBrand(name: 'crest' | 'logistics', width: number, color = '#6c477e', assets?: ProgressiveModelAssets) {
  if (assets) {
    const map = photoPlaceholder(null);
    // 原始 PNG 的宽高比；占位与最终品牌图使用同一个平面和材质。
    const ratio = name === 'crest' ? 363 / 306 : 180 / 390;
    const result = new THREE.Mesh(new THREE.PlaneGeometry(width, width * ratio),
      new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.8, side: THREE.DoubleSide }));
    result.name = `ninan-original-${name}-artwork`;
    assets.add([urls[name]], ([image]) => setPhotoPixels(map, brandCanvas(image, color)));
    return result;
  }
  const source = images.get(name);
  if (!source) return new THREE.Group();
  const canvas = brandCanvas(source, color);
  const result = new THREE.Mesh(
    new THREE.PlaneGeometry(width, (width * source.height) / source.width),
    new THREE.MeshStandardMaterial({
      map: texture(canvas), transparent: true, depthWrite: false, roughness: 0.8, side: THREE.DoubleSide,
    }),
  );
  result.name = `ninan-original-${name}-artwork`;
  return result;
}

function brandCanvas(source: HTMLImageElement, color: string) {
  let variants = brandCanvases.get(source);
  if (!variants) {
    variants = new Map();
    brandCanvases.set(source, variants);
  }
  let canvas = variants.get(color);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = new THREE.Color(color);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i + 3] = Math.min(
        pixels.data[i + 3],
        Math.max(0, Math.min(255, (pixels.data[i + 1] - 80) * 2)),
      );
      pixels.data[i] = Math.round(rgb.r * 255);
      pixels.data[i + 1] = Math.round(rgb.g * 255);
      pixels.data[i + 2] = Math.round(rgb.b * 255);
    }
    ctx.putImageData(pixels, 0, 0);
    variants.set(color, canvas);
  }
  return canvas;
}

type Point = readonly [number, number];
/** 按原照片四角做单应 UV 校正；不是把整张现场照片贴在建筑上。 */
export function ninanPhoto(
  asset: Asset,
  width: number,
  height: number,
  corners: readonly [Point, Point, Point, Point],
  assets?: ProgressiveModelAssets,
) {
  const source = images.get(asset);
  if (!source && !assets)
    return ninanLabel(
      asset === 'breakfast' ? '早餐套餐' : '呢喃小屋',
      width,
      height,
      '#fff8ed',
      '#805092',
    );
  const geometry = new THREE.PlaneGeometry(width, height, 24, 32);
  const uv = geometry.getAttribute('uv');
  const [a, b, c, d] = corners;
  const dx1 = b[0] - c[0],
    dx2 = d[0] - c[0],
    dx3 = a[0] - b[0] + c[0] - d[0];
  const dy1 = b[1] - c[1],
    dy2 = d[1] - c[1],
    dy3 = a[1] - b[1] + c[1] - d[1];
  const det = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(det) < 1e-8 ? 0 : (dx3 * dy2 - dx2 * dy3) / det;
  const h = Math.abs(det) < 1e-8 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  const ax = b[0] - a[0] + g * b[0],
    bx = d[0] - a[0] + h * d[0];
  const ay = b[1] - a[1] + g * b[1],
    by = d[1] - a[1] + h * d[1];
  for (let i = 0; i < uv.count; i++) {
    const x = uv.getX(i),
      y = 1 - uv.getY(i),
      den = g * x + h * y + 1;
    const sourceX = (ax * x + bx * y + a[0]) / den;
    const sourceY = (ay * x + by * y + a[1]) / den;
    const [sampleX, sampleY] = asset === 'east'
      ? croppedPhotoPoint(sourceX, sourceY, ninanPostersCrop)
      : [sourceX, sourceY];
    uv.setXY(i, sampleX, 1 - sampleY);
  }
  const map = assets ? photoPlaceholder('#805092') : texture(source!);
  assets?.add([urls[asset]], ([image]) => setPhotoPixels(map, image));
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map,
      roughness: 0.82,
      side: THREE.DoubleSide,
    }),
  );
}
