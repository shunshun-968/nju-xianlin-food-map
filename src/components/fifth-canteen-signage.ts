import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type FifthCanteenSignageOptions = {
  name: string;
  width: number;
  front: number;
  color: string;
  shopId: string;
  index: number;
  windowNumbers: number[];
};

/** Fifth-canteen lattice lightboxes and raised brush lettering, drawn from reference. */
export function addFifthCanteenSignage(
  parent: THREE.Group,
  options: FifthCanteenSignageOptions,
): void {
  const { name, width, front, color, shopId, index, windowNumbers } = options;
  const group = new THREE.Group();
  group.name = `fifth-signage-${shopId}-${index}`;
  parent.add(group);

  const stone = name.includes('石城');
  const home = name.includes('家常');
  const flavors = name.includes('五味');
  const workshop = name.includes('作坊');
  const porridge = name.includes('南粥');
  const dumpling = name.includes('水饺');
  const clever = name.includes('巧厨');
  const letterColor = stone ? '#edb131' : home || flavors ? '#fff6e4' : '#e6443a';
  const frame = new THREE.MeshStandardMaterial({
    color: '#34352f',
    roughness: 0.45,
    metalness: 0.35,
  });
  const brightSteel = new THREE.MeshStandardMaterial({
    color: '#9da59e',
    roughness: 0.31,
    metalness: 0.48,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: '#565d55',
    roughness: 0.38,
    metalness: 0.35,
  });
  const basicBox = new THREE.BoxGeometry(1, 1, 1);

  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    owner = group,
  ) {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    owner.add(result);
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
    owner = group,
  ) {
    const result = mesh(basicBox, material, x, y, z, owner);
    result.scale.set(w, h, d);
    return result;
  }

  function texture(
    height: number,
    aspect: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  ) {
    const canvas = document.createElement('canvas');
    canvas.height = height;
    canvas.width = Math.min(4096, Math.max(768, Math.round(height * aspect)));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is required for fifth-canteen signage');
    draw(ctx, canvas.width, canvas.height);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 8;
    return result;
  }
  function polygon(
    ctx: CanvasRenderingContext2D,
    points: number[][],
    fill?: string,
    stroke?: string,
  ) {
    if (
      typeof ctx.beginPath !== 'function' ||
      typeof ctx.moveTo !== 'function' ||
      typeof ctx.lineTo !== 'function'
    )
      return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    if (fill && typeof ctx.fill === 'function') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && typeof ctx.stroke === 'function') {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  function ellipse(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
  ) {
    if (
      typeof ctx.beginPath !== 'function' ||
      typeof ctx.ellipse !== 'function' ||
      typeof ctx.fill !== 'function'
    )
      return;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function rect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
  ) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  function bowl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
    ellipse(ctx, x, y + r * 0.1, r, r * 0.61, '#a9aaa0');
    ellipse(ctx, x, y, r * 0.95, r * 0.56, '#f0ede0');
    ellipse(ctx, x, y - r * 0.03, r * 0.8, r * 0.42, seed % 2 ? '#d4d6bd' : '#9b8a5b');
    const colors = ['#859752', '#c99f5b', '#986143', '#dfd2ad'];
    for (let bite = 0; bite < 13; bite += 1) {
      const angle = bite * 2.4;
      const radius = r * (0.2 + (bite % 4) * 0.14);
      ellipse(
        ctx,
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius * 0.45,
        r * 0.14,
        r * 0.09,
        colors[(bite + seed) % colors.length],
      );
    }
  }
  function fan(ctx: CanvasRenderingContext2D, x: number, y: number, span: number, h: number) {
    const points: number[][] = [
      [x - span * 0.25, y + h * 0.5],
      [x - span * 0.55, y - h * 0.2],
    ];
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      points.push([x + (t - 0.5) * span * 1.1, y - h * (0.2 + Math.sin(t * Math.PI) * 0.2)]);
    }
    points.push([x + span * 0.25, y + h * 0.5], points[0]);
    ctx.lineWidth = 5;
    polygon(ctx, points, '#e5e7df', '#56554a');
    for (let i = 0; i <= 7; i += 1) {
      const t = i / 7;
      polygon(
        ctx,
        [
          [x + (t - 0.5) * span * 0.47, y + h * 0.47],
          [x + (t - 0.5) * span * 1.02, y - h * (0.17 + Math.sin(t * Math.PI) * 0.2)],
        ],
        undefined,
        '#66645a',
      );
    }
  }
  function foodMedallion(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    ellipse(ctx, x, y, radius, radius, '#323c37');
    ellipse(ctx, x, y, radius * 0.91, radius * 0.91, '#f5f4e5');
    ellipse(ctx, x, y + radius * 0.34, radius * 0.63, radius * 0.065, '#77a568');
    polygon(
      ctx,
      [
        [x - radius * 0.58, y + radius * 0.22],
        [x - radius * 0.43, y - radius * 0.21],
        [x, y - radius * 0.45],
        [x + radius * 0.43, y - radius * 0.21],
        [x + radius * 0.58, y + radius * 0.22],
      ],
      '#7da96a',
    );
    for (let i = 0; i < 3; i += 1) {
      polygon(
        ctx,
        [
          [x + (i - 1) * radius * 0.28, y - radius * 0.42],
          [x + (i - 1) * radius * 0.28 - radius * 0.06, y - radius * 0.57],
          [x + (i - 1) * radius * 0.28 + radius * 0.03, y - radius * 0.73],
        ],
        undefined,
        '#91b183',
      );
    }
  }

  const faceWidth = width - 0.16;
  const faceHeight = 0.76;
  function letterLayout(
    w: number,
    h: number,
  ): Array<{ text: string; x: number; y: number; size: number }> {
    const letters = [...name].filter((letter) => !/[·・\s]/.test(letter));
    const left = w * (stone ? 0.1 : home || workshop ? 0.245 : 0.17);
    const right = w * (stone ? 0.9 : home || workshop ? 0.755 : 0.83);
    const available = right - left;
    const size = Math.min(h * 0.74, (available / Math.max(letters.length, 1)) * 0.9);
    if (stone && letters.length === 4) {
      return letters.map((text, i) => ({
        text,
        x: w * [0.14, 0.32, 0.68, 0.86][i],
        y: h * 0.52,
        size: Math.min(h * 0.73, w * 0.14),
      }));
    }
    if (dumpling && letters.length === 4) {
      return letters.map((text, i) => ({
        text,
        x: w * [0.27, 0.4, 0.66, 0.79][i],
        y: h * 0.53,
        size,
      }));
    }
    return letters.map((text, i) => ({
      text,
      x: left + (available * (i + 0.5)) / letters.length,
      y: h * 0.53,
      size,
    }));
  }

  const backdrop = texture(512, faceWidth / faceHeight, (ctx, w, h) => {
    if (typeof ctx.createLinearGradient === 'function') {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#dce6e5');
      gradient.addColorStop(0.48, '#f5f2e6');
      gradient.addColorStop(1, '#e8e4cd');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    } else rect(ctx, 0, 0, w, h, '#eceee3');
    const cell = h * (dumpling ? 0.24 : 0.44);
    const lattice = stone ? '#51473a' : clever ? '#6a5a3e' : '#3d4037';
    ctx.strokeStyle = lattice;
    ctx.lineWidth = dumpling ? 9 : 11;
    for (let x = -cell; x < w + cell; x += cell) {
      for (let y = -cell * 0.25; y < h; y += cell) {
        if (home || flavors) {
          polygon(
            ctx,
            [
              [x + cell * 0.5, y],
              [x + cell, y + cell * 0.5],
              [x + cell * 0.5, y + cell],
              [x, y + cell * 0.5],
              [x + cell * 0.5, y],
            ],
            undefined,
            lattice,
          );
        } else {
          ctx.strokeRect(x, y, cell, cell);
          const inset = dumpling ? cell * 0.22 : cell * 0.18;
          ctx.strokeRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
          if (dumpling) {
            rect(ctx, x + cell * 0.46, y, cell * 0.08, cell, lattice);
            rect(ctx, x, y + cell * 0.46, cell, cell * 0.08, lattice);
          }
        }
      }
    }
    ctx.lineWidth = 9;
    ctx.strokeStyle = lattice;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    if (home || workshop) {
      rect(ctx, w * 0.205, h * 0.135, w * 0.59, h * 0.73, home ? '#a84738' : '#72513b');
      for (const x of [w * 0.104, w * 0.896]) foodMedallion(ctx, x, h * 0.5, h * 0.28);
    } else if (stone) {
      ellipse(ctx, w * 0.5 - h * 0.16, h * 0.24, h * 0.1, h * 0.1, '#956c4e');
      ellipse(ctx, w * 0.5 + h * 0.16, h * 0.24, h * 0.1, h * 0.1, '#956c4e');
      ellipse(ctx, w * 0.5, h * 0.51, h * 0.245, h * 0.33, '#956c4e');
      ellipse(ctx, w * 0.5, h * 0.52, h * 0.215, h * 0.29, '#eddcba');
      ellipse(ctx, w * 0.5 - h * 0.08, h * 0.46, h * 0.017, h * 0.022, '#81664d');
      ellipse(ctx, w * 0.5 + h * 0.08, h * 0.46, h * 0.017, h * 0.022, '#81664d');
      ellipse(ctx, w * 0.5, h * 0.57, h * 0.027, h * 0.022, '#b28b5a');
    } else if (porridge) {
      for (const [side, x] of [w * 0.1, w * 0.9].entries()) {
        rect(ctx, x - h * 0.26, h * 0.13, h * 0.52, h * 0.73, '#4d5146');
        rect(ctx, x - h * 0.23, h * 0.16, h * 0.46, h * 0.67, '#e4e7db');
        bowl(ctx, x, h * 0.51, h * 0.22, side);
      }
    } else if (flavors) {
      for (const x of [w * 0.105, w * 0.895]) {
        rect(ctx, x - w * 0.095, h * 0.08, w * 0.19, h * 0.84, '#edf0e5');
        fan(ctx, x, h * 0.47, Math.min(w * 0.14, h * 0.8), h * 0.62);
      }
      for (const letter of letterLayout(w, h))
        ellipse(ctx, letter.x, h * 0.5, letter.size * 0.6, h * 0.39, '#34372e');
    } else if (!dumpling) {
      for (const x of [w * 0.105, w * 0.895]) {
        rect(ctx, x - w * 0.09, h * 0.1, w * 0.18, h * 0.8, '#e9ece1');
        fan(ctx, x, h * 0.47, Math.min(w * 0.145, h * 0.76), h * 0.68);
      }
    }
    if (dumpling) ellipse(ctx, w * 0.53, h * 0.49, h * 0.035, h * 0.035, '#c94338');
    for (let spot = 0; spot < 7; spot += 1) {
      ellipse(ctx, (w * (spot + 0.5)) / 7, h * 0.84, w * 0.052, h * 0.28, 'rgba(245,191,102,0.07)');
    }
  });

  const backgroundMaterial = new THREE.MeshStandardMaterial({
    map: backdrop,
    emissiveMap: backdrop,
    emissive: '#fff0d3',
    emissiveIntensity: 0.42,
    color: '#fff8e8',
    roughness: 0.48,
    metalness: 0.02,
  });
  mesh(new RoundedBoxGeometry(width - 0.055, 0.9, 0.32, 2, 0.018), frame, 0, 3.22, front - 0.04);
  const lightboxFace = mesh(
    new THREE.PlaneGeometry(faceWidth, faceHeight),
    backgroundMaterial,
    0,
    3.22,
    front + 0.126,
  );
  lightboxFace.name = `fifth-lattice-${name}`;
  lightboxFace.castShadow = false;
  for (const y of [2.79, 3.65]) box(width - 0.075, 0.026, 0.024, brightSteel, 0, y, front + 0.137);
  for (const x of [-(width / 2 - 0.065), width / 2 - 0.065])
    box(0.025, 0.85, 0.025, frame, x, 3.22, front + 0.142);

  const letterTextures = [
    '#343029',
    stone ? '#aa7829' : home || flavors ? '#9f9b89' : '#8a352c',
    letterColor,
  ].map((fill, layer) =>
    texture(512, faceWidth / faceHeight, (ctx, w, h) => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = fill;
      for (const letter of letterLayout(w, h)) {
        ctx.font = `700 ${Math.round(letter.size)}px "KaiTi", "STKaiti", "Microsoft YaHei", serif`;
        if (layer === 2 && typeof ctx.strokeText === 'function') {
          ctx.strokeStyle = stone ? '#b98529' : home || flavors ? '#d8d0b6' : '#aa3a32';
          ctx.lineWidth = 2;
          ctx.strokeText(letter.text, letter.x, letter.y);
        }
        ctx.fillText(letter.text, letter.x, letter.y);
      }
    }),
  );
  letterTextures.forEach((map, layer) => {
    const material = new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.42,
      metalness: layer === 2 ? 0.06 : 0,
      emissive:
        layer === 2 ? (stone ? '#8d5517' : home || flavors ? '#b4a382' : '#963d24') : '#000000',
      emissiveMap: map,
      emissiveIntensity: layer === 2 ? 0.18 : 0,
    });
    const raisedLettering = mesh(
      new THREE.PlaneGeometry(faceWidth, faceHeight),
      material,
      [0.023, 0.01, 0][layer],
      3.22 + [-0.035, -0.015, 0][layer],
      front + [0.155, 0.188, 0.218][layer],
    );
    raisedLettering.name = layer === 2 ? `main-sign-${name}` : `letter-depth-${layer}`;
  });

  // Short black track spots are visible hardware, without adding realtime lights.
  box(width - 0.08, 0.023, 0.031, frame, 0, 3.727, front + 0.32);
  const lampBodyGeometry = new THREE.CylinderGeometry(0.039, 0.042, 0.14, 14);
  const lampLensGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.006, 14);
  const lampLensMaterial = new THREE.MeshBasicMaterial({ color: '#ffe1a3', toneMapped: false });
  const lampCount = Math.min(8, Math.max(2, Math.ceil(width / 0.85)));
  for (let lamp = 0; lamp < lampCount; lamp += 1) {
    const x = -width / 2 + ((lamp + 0.5) * width) / lampCount;
    box(0.027, 0.065, 0.029, frame, x, 3.691, front + 0.32);
    const fixture = new THREE.Group();
    fixture.name = 'fifth-sign-track-spot';
    fixture.position.set(x, 3.641, front + 0.341);
    fixture.rotation.x = -0.5;
    group.add(fixture);
    mesh(lampBodyGeometry, frame, 0, 0, 0, fixture);
    const lens = mesh(lampLensGeometry, lampLensMaterial, 0, -0.073, 0, fixture);
    lens.castShadow = false;
    lens.receiveShadow = false;
  }

  // Actual photographed window numbers are kept; tiny menu writing stays generic.
  const menuTexture = texture(256, (width - 0.16) / 0.225, (ctx, w, h) => {
    rect(ctx, 0, 0, w, h, '#dad4bd');
    const count = Math.max(windowNumbers.length, 1);
    windowNumbers.forEach((number, slot) => {
      const cellW = w / count,
        x = slot * cellW;
      const purpleWidth = Math.min(cellW * 0.15, h * 0.48);
      rect(
        ctx,
        x + 3,
        4,
        cellW - 6,
        h - 8,
        number % 4 === 0 ? '#e3c477' : number % 3 === 0 ? '#cf914a' : '#b9523d',
      );
      rect(ctx, x + 4, 4, purpleWidth, h - 8, '#694459');
      ctx.font = `700 ${Math.round(h * 0.32)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff6e2';
      ctx.fillText(String(number), x + purpleWidth / 2 + 4, h * 0.35, purpleWidth - 8);
      const photoR = Math.min(cellW * 0.15, h * 0.32);
      bowl(ctx, x + cellW - photoR * 1.25, h * 0.52, photoR, number);
      const tx = x + purpleWidth + cellW * 0.045;
      const textW = cellW - purpleWidth - photoR * 2.7;
      ctx.textAlign = 'left';
      ctx.font = `600 ${Math.round(h * 0.21)}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = '#fff0b3';
      ctx.fillText(['有序取餐', '按需取餐', '注意烫手'][number % 3], tx, h * 0.35, textW);
      ctx.font = `400 ${Math.round(h * 0.115)}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = '#f4dfb3';
      ctx.fillText('文明用餐 · 珍惜粮食', tx, h * 0.66, textW);
      ctx.strokeStyle = 'rgba(255,245,205,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + purpleWidth + 5, 10, cellW - purpleWidth - 13, h - 20);
    });
  });
  mesh(
    new RoundedBoxGeometry(width - 0.08, 0.28, 0.23, 2, 0.012),
    darkSteel,
    0,
    2.675,
    front - 0.015,
  );
  const menuMaterial = new THREE.MeshStandardMaterial({
    map: menuTexture,
    emissiveMap: menuTexture,
    emissive: '#ffe7bd',
    emissiveIntensity: 0.35,
    roughness: 0.43,
    color: '#fff5df',
  });
  const menu = mesh(
    new THREE.PlaneGeometry(width - 0.16, 0.225),
    menuMaterial,
    0,
    2.675,
    front + 0.107,
  );
  menu.name = 'fifth-numbered-menu-strip';
  menu.castShadow = false;
  for (const y of [2.545, 2.805]) box(width - 0.12, 0.018, 0.026, brightSteel, 0, y, front + 0.113);
  for (let slot = 1; slot < windowNumbers.length; slot += 1) {
    box(
      0.018,
      0.24,
      0.023,
      brightSteel,
      -width / 2 + (slot * width) / windowNumbers.length,
      2.675,
      front + 0.121,
    );
  }
  // Keep the source accent available for the very narrow end-cap of each shop.
  const sidePaint = new THREE.MeshStandardMaterial({ color, roughness: 0.57 });
  for (const side of [-1, 1])
    box(0.014, 0.78, 0.15, sidePaint, side * (width / 2 - 0.04), 3.22, front - 0.04);
}
