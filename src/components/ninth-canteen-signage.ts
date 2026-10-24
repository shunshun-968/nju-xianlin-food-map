import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type NinthCanteenSignageOptions = {
  shopId: string;
  name: string;
  width: number;
  front: number;
  /** The separate red Pizza Hut feature wall, photographed beside its entrance. */
  variant?: string;
};

type LetterRun = {
  text: string;
  x: number;
  y: number;
  size: number;
  span: number;
  color: string;
  font?: string;
  weight?: string;
  spaced?: boolean;
};

type SignStyle = {
  background: string;
  edge: string;
  light: string;
  runs: LetterRun[];
};

const SONG = '"SimSun", "Songti SC", "Noto Serif CJK SC", serif';
const BRUSH = '"KaiTi", "STKaiti", "Noto Serif CJK SC", serif';
const SANS = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const ROUND = '"Arial Rounded MT Bold", "Arial Black", "Microsoft YaHei", sans-serif';
const SCRIPT = '"Segoe Script", "Brush Script MT", cursive';

function signStyle(shopId: string, name: string, wall: boolean): SignStyle {
  const run = (text: string, color: string, options: Partial<LetterRun> = {}): LetterRun => ({
    text,
    color,
    x: 0.5,
    y: 0.5,
    size: 0.6,
    span: 0.88,
    ...options,
  });

  // These are transcriptions of the photographed fascia, not the sale-category names.
  switch (shopId) {
    case 'yue-qing-he':
      return {
        background: '#667b32',
        edge: '#4c5a2a',
        light: '#fff4d9',
        runs: [
          run('悦轻荷', '#fffdf4', {
            x: 0.265,
            y: 0.43,
            size: 0.62,
            span: 0.37,
            font: SONG,
            spaced: true,
          }),
          run('YUE QING HE', '#914b36', {
            x: 0.263,
            y: 0.86,
            size: 0.15,
            span: 0.31,
            font: 'Georgia, serif',
          }),
          run('自选轻餐', '#fffaf4', {
            x: 0.747,
            y: 0.5,
            size: 0.49,
            span: 0.38,
            font: SONG,
            spaced: true,
          }),
        ],
      };
    case 'chili-pork':
      return {
        background: '#797c6d',
        edge: '#535951',
        light: '#e6efc8',
        runs: [
          run('辣椒炒肉', '#20c567', { y: 0.38, size: 0.61, span: 0.76, spaced: true }),
          run('湘味下饭菜', '#3fcb84', { x: 0.64, y: 0.82, size: 0.25, span: 0.56, spaced: true }),
        ],
      };
    case 'jimingtangbao':
      return {
        background: '#dbb47d',
        edge: '#5b3d2f',
        light: '#ffe2a1',
        runs: [run('雞鳴湯包', '#fffdf0', { size: 0.55, span: 0.56, font: BRUSH })],
      };
    case 'roast-goose':
      return {
        background: '#34251e',
        edge: '#524232',
        light: '#ffe6ad',
        runs: [run('項錦記 燒鵝', '#fff0d0', { size: 0.64, span: 0.87, font: ROUND })],
      };
    case 'roujiamo':
      return {
        background: '#c75f60',
        edge: '#7f4140',
        light: '#fff0dc',
        runs: [
          run('左左香', '#fffdf2', { x: 0.27, y: 0.51, size: 0.7, span: 0.41 }),
          run('LAOTONGGUANROUJIAMO', '#fff7e9', {
            x: 0.734,
            y: 0.25,
            size: 0.15,
            span: 0.43,
            font: 'Arial, sans-serif',
          }),
          run('老潼关肉夹馍', '#fffdf2', {
            x: 0.734,
            y: 0.62,
            size: 0.37,
            span: 0.43,
            font: BRUSH,
          }),
        ],
      };
    case 'hot-dry-noodles':
      return {
        background: '#d0aa61',
        edge: '#51402c',
        light: '#ffe4a8',
        runs: [run('武汉热干面', '#201c16', { size: 0.57, span: 0.57, font: BRUSH })],
      };
    case 'home-stir-fry':
      return {
        background: '#e5e9de',
        edge: '#494b42',
        light: '#f6ffe9',
        runs: [run('百味小炒', '#171d1b', { size: 0.68, span: 0.76, font: BRUSH, spaced: true })],
      };
    case 'dongbei':
      return {
        background: '#dbd3b7',
        edge: '#787363',
        light: '#fff5d9',
        runs: [
          run('东北老味道', '#282b26', { x: 0.34, size: 0.57, span: 0.57, spaced: true }),
          run('烧烤·特色烤鱼', '#35382e', { x: 0.8, size: 0.32, span: 0.33 }),
        ],
      };
    case 'seafood-hotpot':
      return {
        background: '#352827',
        edge: '#252521',
        light: '#fff4e2',
        runs: [run('渔船海鲜 · 自选老火锅', '#fff9ed', { size: 0.52, span: 0.9, spaced: true })],
      };
    case 'pizza-hut':
      return {
        background: wall ? '#9d292d' : '#a73e3e',
        edge: '#743132',
        light: '#ffe4c1',
        runs: [
          wall
            ? run('Pizza Hut', '#fff8ef', { size: 0.6, span: 0.57, font: SCRIPT, weight: '700' })
            : run('必胜客', '#fffdf7', { size: 0.76, span: 0.72 }),
        ],
      };
    case 'burger-king':
      return {
        background: '#a97641',
        edge: '#693e2c',
        light: '#ffdfa0',
        runs: [
          run('BURGER KING', '#ffffed', {
            x: 0.4,
            size: 0.62,
            span: 0.65,
            font: ROUND,
            weight: '900',
          }),
          run('汉堡王', '#ffffed', { x: 0.855, size: 0.5, span: 0.23 }),
        ],
      };
    case 'tray-return':
      return {
        background: '#c6aa80',
        edge: '#a78960',
        light: '#ffe9b4',
        runs: [run('餐具回收区', '#fffdf5', { size: 0.56, span: 0.72 })],
      };
    default:
      return {
        background: '#6d6250',
        edge: '#514a3e',
        light: '#ffedcb',
        runs: [run(name, '#fff8e6')],
      };
  }
}

/**
 * Photo-led ninth-canteen fascia. Local service front is +Z; the fascia occupies
 * y=2.795–3.645. Rotate the parent shop group to place it on another wall.
 * Textures are owned by the returned scene graph and use the scene's usual disposal.
 */
export function addNinthCanteenSignage(
  parent: THREE.Group,
  { shopId, name, width, front, variant }: NinthCanteenSignageOptions,
): void {
  const wall = shopId === 'pizza-hut' && variant === 'wall';
  const style = signStyle(shopId, name, wall);
  const group = new THREE.Group();
  group.name = `ninth-signage-${shopId}${wall ? '-wall' : ''}`;
  group.userData.signText = style.runs.map((run) => run.text).join(' ');
  parent.add(group);

  const faceWidth = Math.max(0.5, width - 0.11);
  const faceHeight = 0.77;
  const faceZ = front + 0.118;
  const centerY = 3.22;
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const faceGeometry = new THREE.PlaneGeometry(faceWidth, faceHeight);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: style.edge,
    roughness: 0.46,
    metalness: 0.24,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: shopId === 'hot-dry-noodles' || shopId === 'jimingtangbao' ? '#bda16c' : '#a49b87',
    roughness: 0.33,
    metalness: 0.63,
  });
  const lampMaterial = new THREE.MeshBasicMaterial({ color: style.light, toneMapped: false });

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
  function texture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
    const canvas = document.createElement('canvas');
    canvas.height = 512;
    canvas.width = Math.min(4096, Math.max(1024, Math.round((512 * faceWidth) / faceHeight)));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is required for ninth-canteen signage');
    draw(ctx, canvas.width, canvas.height);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 8;
    return result;
  }
  function roundedPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function strokes(
    ctx: CanvasRenderingContext2D,
    points: number[][],
    color: string,
    thickness: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.stroke();
  }

  const backdrop = texture((ctx, w, h) => {
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, w, h);
    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, 'rgba(255,245,209,0.12)');
    shade.addColorStop(0.38, 'rgba(255,248,221,0.01)');
    shade.addColorStop(1, 'rgba(21,16,8,0.14)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);

    // Fine deterministic grain keeps panels tactile without photographic noise.
    const wood = shopId === 'burger-king' || shopId === 'tray-return' || shopId === 'jimingtangbao';
    for (let i = 0; i < (wood ? 120 : 42); i += 1) {
      const y = (((i * 67) % 509) / 512) * h;
      const phase = i * 1.73;
      const points: number[][] = [];
      for (let step = 0; step <= 24; step += 1)
        points.push([(w * step) / 24, y + Math.sin(step * 0.62 + phase) * (wood ? 4 : 0.5)]);
      strokes(
        ctx,
        points,
        i % 3 ? 'rgba(48,27,12,0.09)' : 'rgba(255,233,190,0.15)',
        wood ? 1.7 : 0.8,
      );
    }

    if (shopId === 'yue-qing-he') {
      roundedPath(ctx, w * 0.535, h * 0.15, w * 0.425, h * 0.7, h * 0.33);
      ctx.shadowColor = 'rgba(31,40,22,0.45)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#edb6ae';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = '#f7cec0';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (shopId === 'chili-pork') {
      const pitch = Math.max(10, h * 0.08);
      for (let x = 0; x < w; x += pitch) {
        ctx.fillStyle = 'rgba(32,40,34,0.39)';
        ctx.fillRect(x, 0, pitch * 0.22, h);
        ctx.fillStyle = 'rgba(211,211,185,0.25)';
        ctx.fillRect(x + pitch * 0.25, 0, pitch * 0.09, h);
      }
    } else if (shopId === 'jimingtangbao') {
      ctx.fillStyle = '#51312c';
      roundedPath(ctx, w * 0.183, h * 0.065, w * 0.634, h * 0.87, h * 0.15);
      ctx.fill();
      ctx.strokeStyle = '#b89361';
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.fillStyle = '#692b31';
      roundedPath(ctx, w * 0.2, h * 0.115, w * 0.6, h * 0.77, h * 0.1);
      ctx.fill();
      for (const x of [0.06, 0.12, 0.88, 0.94])
        strokes(
          ctx,
          [
            [w * x, 0],
            [w * x, h],
          ],
          'rgba(90,54,27,0.55)',
          3,
        );
    } else if (shopId === 'hot-dry-noodles') {
      // Gilt scrollwork is confined to the side plaques, as in the reference.
      for (const left of [0.008, 0.806]) {
        ctx.fillStyle = '#38281d';
        ctx.fillRect(w * left, h * 0.025, w * 0.186, h * 0.95);
        ctx.strokeStyle = '#ba9455';
        ctx.lineWidth = 3;
        ctx.strokeRect(w * (left + 0.007), h * 0.055, w * 0.172, h * 0.89);
        for (let row = 0; row < 4; row += 1) {
          for (let col = 0; col < 5; col += 1) {
            const x = w * (left + 0.021 + col * 0.035),
              y = h * (0.18 + row * 0.215);
            ctx.beginPath();
            ctx.moveTo(x - w * 0.01, y);
            ctx.bezierCurveTo(
              x - w * 0.018,
              y - h * 0.13,
              x + w * 0.024,
              y - h * 0.12,
              x + w * 0.016,
              y,
            );
            ctx.bezierCurveTo(
              x + w * 0.007,
              y + h * 0.1,
              x - w * 0.008,
              y + h * 0.04,
              x,
              y - h * 0.015,
            );
            ctx.stroke();
          }
        }
      }
      ctx.strokeStyle = '#654b26';
      ctx.lineWidth = 7;
      ctx.strokeRect(w * 0.202, h * 0.045, w * 0.596, h * 0.91);
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.212, h * 0.08, w * 0.576, h * 0.84);
    } else if (shopId === 'roujiamo') {
      strokes(
        ctx,
        [
          [w * 0.52, h * 0.37],
          [w * 0.947, h * 0.37],
        ],
        '#edc0af',
        3,
      );
    } else if (shopId === 'tray-return') {
      for (const y of [0.1, 0.9]) {
        ctx.fillStyle = '#ac8b60';
        ctx.fillRect(0, h * y, w, h * 0.035);
        ctx.fillStyle = '#dfc59a';
        ctx.fillRect(0, h * (y - 0.014), w, h * 0.014);
      }
    } else if (wall) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [offset, scale] of [
        [0.04, 1],
        [0.15, 0.85],
        [0.88, 1],
      ] as const) {
        const points = [
          [0, 0.7],
          [0.14, 0.46],
          [0.24, 0.03],
          [0.57, -0.18],
          [0.72, 0.3],
          [1, 0.48],
        ];
        strokes(
          ctx,
          points.map(([x, y]) => [x * w, (y * scale + offset) * h]),
          '#452626',
          15,
        );
        strokes(
          ctx,
          points.map(([x, y]) => [x * w, (y * scale + offset) * h]),
          '#e8f8f5',
          8,
        );
      }
      ctx.shadowColor = '#ed4e4b';
      ctx.shadowBlur = 32;
      ctx.fillStyle = '#af3035';
      roundedPath(ctx, w * 0.185, h * 0.2, w * 0.63, h * 0.61, 18);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  mesh(
    new RoundedBoxGeometry(Math.max(width - 0.03, 0.55), 0.85, 0.28, 2, 0.012),
    frameMaterial,
    0,
    centerY,
    front - 0.035,
  );
  const face = mesh(
    faceGeometry,
    new THREE.MeshStandardMaterial({
      map: backdrop,
      emissiveMap: backdrop,
      emissive: style.light,
      emissiveIntensity: shopId === 'home-stir-fry' ? 0.35 : 0.12,
      roughness: wall ? 0.82 : 0.58,
      metalness: 0.025,
    }),
    0,
    centerY,
    faceZ,
  );
  face.name = `ninth-fascia-${shopId}`;
  face.castShadow = false;
  for (const y of [2.806, 3.634]) box(width - 0.05, 0.018, 0.026, metal, 0, y, faceZ + 0.005);
  for (const x of [-1, 1])
    box(0.018, 0.81, 0.028, frameMaterial, x * (width / 2 - 0.035), centerY, faceZ + 0.007);

  // Raised letters share one texture across all depth slices, avoiding three
  // separate large canvases per sign. Preserve photographed traditional glyphs.
  function drawRun(ctx: CanvasRenderingContext2D, w: number, h: number, run: LetterRun) {
    const size = Math.round(h * run.size);
    ctx.font = `${run.weight ?? '700'} ${size}px ${run.font ?? SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = run.color;
    ctx.strokeStyle = run.color;
    ctx.lineWidth = run.font === ROUND ? size * 0.025 : 0;
    const available = w * run.span;
    if (run.spaced) {
      const letters = [...run.text];
      const step = Math.min(available / letters.length, size * 1.5);
      const actualSize = Math.min(1, (step * 0.9) / size);
      ctx.save();
      ctx.translate(w * run.x, h * run.y);
      ctx.scale(actualSize, 1);
      letters.forEach((letter, index) => {
        ctx.fillText(letter, ((index - (letters.length - 1) / 2) * step) / actualSize, 0);
      });
      ctx.restore();
    } else {
      ctx.fillText(run.text, w * run.x, h * run.y, available);
      if (run.font === ROUND) ctx.strokeText(run.text, w * run.x, h * run.y, available);
    }
  }
  const lettering = texture((ctx, w, h) => {
    for (const run of style.runs) drawRun(ctx, w, h, run);
  });
  const darkLetters =
    shopId === 'home-stir-fry' || shopId === 'hot-dry-noodles' || shopId === 'dongbei';
  for (let layer = 0; layer < 3; layer += 1) {
    const frontLayer = layer === 2;
    const letters = mesh(
      faceGeometry,
      new THREE.MeshStandardMaterial({
        map: lettering,
        transparent: true,
        alphaTest: 0.18,
        color: frontLayer ? '#ffffff' : layer === 0 ? '#282522' : '#8d897e',
        roughness: 0.34,
        metalness: frontLayer ? 0.06 : 0.22,
        emissiveMap: lettering,
        emissive: frontLayer && !darkLetters ? style.light : '#000000',
        emissiveIntensity: frontLayer && !darkLetters ? 0.5 : 0,
      }),
      [0.018, 0.009, 0][layer],
      centerY + [-0.019, -0.009, 0][layer],
      faceZ + [0.018, 0.039, 0.06][layer],
    );
    letters.name = frontLayer ? `ninth-main-sign-${shopId}` : `ninth-letter-depth-${layer}`;
    letters.castShadow = false;
  }

  // Small strips and visible lamp fittings supply warmth without extra realtime lights.
  if (shopId === 'burger-king' || shopId === 'tray-return' || shopId === 'pizza-hut') {
    for (const y of [2.822, 3.614]) {
      const strip = box(width - 0.12, 0.012, 0.018, lampMaterial, 0, y, faceZ + 0.019);
      strip.castShadow = false;
    }
  } else {
    const fixtureMaterial = new THREE.MeshStandardMaterial({
      color: '#443f34',
      metalness: 0.48,
      roughness: 0.39,
    });
    const lampGeometry = new THREE.CylinderGeometry(0.027, 0.033, 0.09, 10);
    const lensGeometry = new THREE.CircleGeometry(0.026, 10);
    const count = Math.max(2, Math.min(5, Math.round(width / 1.1)));
    for (let index = 0; index < count; index += 1) {
      const x = ((index + 0.5) * (width - 0.16)) / count - (width - 0.16) / 2;
      const lamp = mesh(lampGeometry, fixtureMaterial, x, 2.77, front + 0.07);
      lamp.rotation.x = -0.25;
      const lens = mesh(lensGeometry, lampMaterial, x, 2.725, front + 0.081);
      lens.rotation.x = -Math.PI / 2 - 0.25;
      lens.castShadow = false;
    }
  }
}
