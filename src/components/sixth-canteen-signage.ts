import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type SixthCanteenSignageOptions = {
  name: string;
  width: number;
  front: number;
  screenTexts: string[];
  categoryLabel?: string;
  pickup?: boolean;
};

/** Sixth-canteen LCD fascia. All large screen copy is supplied by the caller. */
export function addSixthCanteenSignage(
  parent: THREE.Group,
  options: SixthCanteenSignageOptions,
): void {
  const { name, width, front, screenTexts, categoryLabel, pickup = false } = options;
  if (!Number.isFinite(width) || width <= 0 || screenTexts.length === 0) return;
  const group = new THREE.Group();
  group.name = `sixth-signage-${name}${pickup ? '-pickup' : ''}`;
  parent.add(group);

  const wall = new THREE.MeshStandardMaterial({ color: '#e1e3df', roughness: 0.65 });
  const beamTrim = new THREE.MeshStandardMaterial({
    color: '#b8bfbb',
    roughness: 0.37,
    metalness: 0.24,
  });
  const black = new THREE.MeshStandardMaterial({
    color: '#24292b',
    roughness: 0.35,
    metalness: 0.12,
  });
  const screenBezel = new THREE.MeshStandardMaterial({
    color: '#151b20',
    roughness: 0.3,
    metalness: 0.17,
  });
  const mountingSteel = new THREE.MeshStandardMaterial({
    color: '#606c6d',
    roughness: 0.43,
    metalness: 0.32,
  });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);

  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    group.add(result);
    return result;
  }
  function box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const result = mesh(unitBox, material, x, y, z);
    result.scale.set(w, h, d);
    return result;
  }
  function texture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is required for sixth-canteen signage');
    draw(ctx);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return map;
  }
  function polygon(ctx: CanvasRenderingContext2D, points: number[][], color: string) {
    if (
      typeof ctx.beginPath !== 'function' ||
      typeof ctx.moveTo !== 'function' ||
      typeof ctx.lineTo !== 'function' ||
      typeof ctx.fill !== 'function'
    )
      return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fillStyle = color;
    ctx.fill();
  }
  function gradient(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    top: string,
    bottom: string,
  ) {
    if (typeof ctx.createLinearGradient === 'function') {
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, top);
      fill.addColorStop(1, bottom);
      ctx.fillStyle = fill;
    } else ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h);
  }
  function weightedLength(text: string) {
    return [...text].reduce(
      (total, character) => total + (/^[\x00-\x7F]$/.test(character) ? 0.58 : 1),
      0,
    );
  }

  // Keep a real right-hand column area for the category, instead of compressing it
  // into the screen artwork. A pickup opening has no category column.
  const outerMargin = Math.min(0.085, width * 0.04);
  const categoryWidth = pickup ? 0 : Math.min(0.62, width * 0.24);
  const categoryGap = pickup ? 0 : 0.085;
  const screenRegionWidth = Math.max(0.2, width - outerMargin * 2 - categoryWidth - categoryGap);
  const regionLeft = -width / 2 + outerMargin;
  const count = screenTexts.length;
  const gap = Math.min(0.1, screenRegionWidth * 0.04);
  const pictureWidth = Math.min(
    (0.78 * 16) / 9,
    Math.max(0.1, (screenRegionWidth - gap * (count - 1)) / count - 0.034),
  );
  const pictureHeight = (pictureWidth * 9) / 16;
  const usedWidth = (pictureWidth + 0.034) * count + gap * (count - 1);
  const firstLeft = regionLeft + (screenRegionWidth - usedWidth) / 2;

  mesh(new RoundedBoxGeometry(width - 0.035, 1.04, 0.24, 2, 0.012), wall, 0, 3.23, front - 0.03);
  box(width - 0.05, 0.024, 0.028, beamTrim, 0, 2.722, front + 0.092);
  box(width - 0.05, 0.016, 0.025, beamTrim, 0, 3.738, front + 0.092);

  for (const [index, text] of screenTexts.entries()) {
    const x = firstLeft + (pictureWidth + 0.034) / 2 + index * (pictureWidth + 0.034 + gap);
    const y = 3.18;
    const map = texture(1280, 720, (ctx) => {
      const w = 1280,
        h = 720;
      gradient(ctx, w, h, '#e9f3f6', '#c5e0e7');
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, 0, w, h * 0.17);
      ctx.font = '500 36px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4f5864';
      ctx.fillText('学生第六食堂', 62, 74);
      ctx.fillStyle = '#9eafb7';
      ctx.fillRect(62, 118, w - 124, 1.5);

      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      const lineCount = Math.max(lines.length, 1);
      const contentTop = h * 0.25,
        contentBottom = h * 0.83;
      lines.forEach((line, lineIndex) => {
        const single = lineCount === 1;
        const preferred = single ? 174 : lineIndex === 0 ? 118 : 76;
        const fontSize = Math.min(preferred, (w - 146) / Math.max(weightedLength(line), 1));
        ctx.font = `${lineIndex === 0 ? 600 : 500} ${Math.round(fontSize)}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#b32f35';
        const lineY = single
          ? h * 0.5
          : contentTop + ((contentBottom - contentTop) * (lineIndex + 0.5)) / lineCount;
        ctx.fillText(line, w / 2, lineY, w - 138);
      });

      const wave: number[][] = [
        [0, h],
        [0, h * 0.955],
      ];
      for (let step = 0; step <= 24; step += 1) {
        const t = step / 24;
        wave.push([t * w, h * (0.955 - 0.065 * t * t + Math.sin(t * Math.PI) * 0.012)]);
      }
      wave.push([w, h]);
      polygon(ctx, wave, '#655080');
      const upperWave = wave.slice(1, -1).map(([px, py]) => [px, py - 4]);
      polygon(ctx, [...upperWave, ...wave.slice(1, -1).reverse()], '#9c87b6');
      // A restrained glass highlight never hides the caller's large text.
      polygon(
        ctx,
        [
          [w * 0.71, 0],
          [w * 0.79, 0],
          [w * 0.97, h],
          [w * 0.9, h],
        ],
        'rgba(255,255,255,0.055)',
      );
      ctx.strokeStyle = 'rgba(127,150,164,0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    });
    box(pictureWidth * 0.46, pictureHeight * 0.65, 0.045, mountingSteel, x, y, front + 0.102);
    mesh(
      new RoundedBoxGeometry(pictureWidth + 0.034, pictureHeight + 0.034, 0.065, 2, 0.009),
      black,
      x,
      y,
      front + 0.14,
    );
    const bezel = mesh(
      new THREE.PlaneGeometry(pictureWidth + 0.014, pictureHeight + 0.014),
      screenBezel,
      x,
      y,
      front + 0.174,
    );
    bezel.castShadow = false;
    const lcd = mesh(
      new THREE.PlaneGeometry(pictureWidth, pictureHeight),
      new THREE.MeshBasicMaterial({ map, toneMapped: false }),
      x,
      y,
      front + 0.176,
    );
    lcd.name = `sixth-lcd-${index + 1}`;
    lcd.userData.screenText = text;
    lcd.castShadow = false;
    lcd.receiveShadow = false;
    box(
      pictureWidth * 0.11,
      0.004,
      0.003,
      mountingSteel,
      x,
      y - pictureHeight / 2 - 0.009,
      front + 0.177,
    );
  }

  if (!pickup) {
    const label = categoryLabel ?? name;
    const characters = [...label.replace(/\s/g, '')];
    const labelLines = label.includes('\n')
      ? label.split(/\r?\n/).filter(Boolean)
      : [
          characters.slice(0, Math.ceil(characters.length / 2)).join(''),
          characters.slice(Math.ceil(characters.length / 2)).join(''),
        ].filter(Boolean);
    const categoryX = width / 2 - outerMargin - categoryWidth / 2;
    const categoryMap = texture(512, 720, (ctx) => {
      gradient(ctx, 512, 720, '#626b6c', '#3e494b');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      labelLines.forEach((line, lineIndex) => {
        const fontSize = Math.min(184, 438 / Math.max(weightedLength(line), 1));
        ctx.font = `650 ${Math.round(fontSize)}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        const textY = 360 + (lineIndex - (labelLines.length - 1) / 2) * 235;
        ctx.fillStyle = 'rgba(16,25,27,0.48)';
        ctx.fillText(line, 260, textY + 5, 446);
        ctx.fillStyle = '#f8faf4';
        ctx.fillText(line, 256, textY, 446);
      });
      ctx.strokeStyle = 'rgba(198,207,205,0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, 506, 714);
    });
    mesh(
      new RoundedBoxGeometry(categoryWidth, 0.94, 0.1, 2, 0.012),
      mountingSteel,
      categoryX,
      3.18,
      front + 0.14,
    );
    const category = mesh(
      new THREE.PlaneGeometry(categoryWidth - 0.025, 0.91),
      new THREE.MeshBasicMaterial({ map: categoryMap, toneMapped: false }),
      categoryX,
      3.18,
      front + 0.192,
    );
    category.name = `sixth-category-${label}`;
    category.castShadow = false;
    category.receiveShadow = false;
  }
}
