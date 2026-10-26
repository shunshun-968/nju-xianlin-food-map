import * as THREE from 'three';

const titles = {
  north: '美食广场',
  1: '美食广场',
  2: '美食广场',
  3: '美食广场',
  4: '美食广场',
  5: '中式美点',
  6: '舌尖美肴',
  7: '巴蜀风味',
  8: '精品维扬',
  9: '风味排档',
};
const images = new Map();
const textures = new Map();
let assetsPromise;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load local signage image: ${url}`));
    image.src = url;
  });
}

export async function loadSignageAssets() {
  if (!assetsPromise) {
    const entries = [
      ['north', new URL('../../assets/tenth-canteen/north.webp', import.meta.url).href],
      ['4', new URL('../../assets/tenth-canteen/4.webp', import.meta.url).href],
      ['5', new URL('../../assets/tenth-canteen/5.webp', import.meta.url).href],
      ['6', new URL('../../assets/tenth-canteen/6.webp', import.meta.url).href],
      ['7', new URL('../../assets/tenth-canteen/7.webp', import.meta.url).href],
      ['8', new URL('../../assets/tenth-canteen/8.webp', import.meta.url).href],
      ['9', new URL('../../assets/tenth-canteen/9.webp', import.meta.url).href],
      ['logistics', new URL('../../assets/branding/南大后勤.png', import.meta.url).href],
      ['badge', new URL('../../assets/branding/南大校徽.png', import.meta.url).href],
    ];
    assetsPromise = Promise.all(
      entries.map(async ([key, url]) => {
        try {
          images.set(key, await loadImage(url));
          return { key, loaded: true };
        } catch {
          return { key, loaded: false };
        }
      }),
    ).then((results) => ({
      ready: true,
      complete: results.every((result) => result.loaded),
      loaded: results.filter((result) => result.loaded).map((result) => result.key),
      missing: results.filter((result) => !result.loaded).map((result) => result.key),
    }));
  }
  const result = await assetsPromise;
  if (!result.complete) assetsPromise = undefined;
  return result;
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function bannerTexture(photo) {
  const key = String(photo);
  if (textures.has(key)) return textures.get(key);
  const image = images.get(key);
  if (!image) throw new Error(`Missing original signage: ${key}`);
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  texture.userData = { photo: key, originalArtwork: true, fallback: false };
  textures.set(key, texture);
  return texture;
}

export function addBanner(parent, { photo, width, height = 1.12 }) {
  const group = new THREE.Group();
  group.name = `tenth-original-banner-${photo}`;
  group.userData = { photo, signText: titles[photo], originalPhoto: true };
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.08),
    new THREE.MeshStandardMaterial({ color: '#b6b6a5', roughness: 0.88, metalness: 0.12 }),
  );
  panel.castShadow = panel.receiveShadow = true;
  group.add(panel);
  const artwork = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.035, height - 0.035),
    new THREE.MeshStandardMaterial({
      map: bannerTexture(photo),
      roughness: 0.96,
      metalness: 0,
      emissiveIntensity: 0,
    }),
  );
  artwork.name = `tenth-banner-art-${photo}`;
  artwork.position.z = 0.06;
  group.add(artwork);
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: '#b6bdb9',
    metalness: 0.65,
    roughness: 0.46,
  });
  for (const y of [-height / 2, height / 2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.028, 0.085), edgeMaterial);
    rail.position.set(0, y, 0.018);
    group.add(rail);
  }
  for (const x of [-width / 2, width / 2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.023, height, 0.085), edgeMaterial);
    rail.position.set(x, 0, 0.018);
    group.add(rail);
  }
  parent?.add(group);
  if (!images.size)
    void loadSignageAssets().then(() => {
      const previous = artwork.material.map;
      artwork.material.map = bannerTexture(photo);
      artwork.material.needsUpdate = true;
      if (previous?.userData.fallback) previous.dispose();
    });
  return group;
}

/** Small original-content labels, never a replacement for photographed banners. */
export function textPanel(text, width, height, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(2048, Math.max(128, Math.round(width * 320)));
  canvas.height = Math.max(64, Math.round((canvas.width * height) / width));
  const context = canvas.getContext('2d');
  const background = options.background ?? options.bg ?? '#fffdf1';
  if (background !== 'transparent') {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const lines = String(text).split('\n');
  const padding = options.padding ?? 0.08;
  let size = (canvas.height * (1 - padding * 2)) / (lines.length * 1.22);
  const face = options.fontFamily ?? '"Microsoft YaHei", "PingFang SC", sans-serif';
  context.font = `${options.fontWeight ?? 600} ${size}px ${face}`;
  const measured = Math.max(...lines.map((line) => context.measureText(line).width));
  if (measured > canvas.width * (1 - padding * 2))
    size *= (canvas.width * (1 - padding * 2)) / measured;
  context.font = `${options.fontWeight ?? 600} ${size}px ${face}`;
  context.fillStyle = options.color ?? options.ink ?? '#342d31';
  context.textAlign = options.align ?? 'center';
  context.textBaseline = 'middle';
  const x =
    context.textAlign === 'left'
      ? canvas.width * padding
      : context.textAlign === 'right'
        ? canvas.width * (1 - padding)
        : canvas.width / 2;
  lines.forEach((line, i) =>
    context.fillText(line, x, canvas.height / 2 + (i - (lines.length - 1) / 2) * size * 1.22),
  );
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(canvas),
      transparent: background === 'transparent',
      toneMapped: false,
      side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    }),
  );
  mesh.userData.text = String(text);
  return mesh;
}

export function addWindowNumber(parent, number) {
  const group = new THREE.Group();
  group.name = `tenth-window-number-${number}`;
  const plate = textPanel(String(number), 0.31, 0.34, {
    background: '#302033',
    color: '#f4efed',
    padding: 0.15,
    fontWeight: 700,
  });
  group.add(plate);
  const original = images.get('logistics');
  if (original) {
    let texture = textures.get('logistics-original');
    if (!texture) {
      texture = new THREE.Texture(original);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      textures.set('logistics-original', texture);
    }
    const width = 0.27,
      height = (width * original.naturalHeight) / original.naturalWidth;
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    );
    logo.position.set(0, 0.17 + height / 2 + 0.006, 0.001);
    group.add(logo);
  }
  parent?.add(group);
  return group;
}
