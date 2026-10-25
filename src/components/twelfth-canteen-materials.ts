import * as THREE from 'three';

const WIDTH = 2048;
const HEIGHT = 256;

function textureFrom(canvas: HTMLCanvasElement, color = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  // Default CanvasTexture flipY puts canvas y=0 at the mesh's upper edge.
  return texture;
}

function canvasSurface() {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function fillVertical(
  ctx: CanvasRenderingContext2D,
  stops: readonly (readonly [number, string])[],
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  for (const [position, color] of stops) gradient.addColorStop(position, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** A repeatable fine groove map, not high-gloss photographed lamp reflections. */
function flutes(ctx: CanvasRenderingContext2D, translucent: boolean) {
  const spacing = translucent ? 13 : 15;
  for (let x = 0, index = 0; x < WIDTH; x += spacing, index++) {
    const variation = (Math.sin(index * 2.17) + 1) / 2;
    const shadowAlpha = (translucent ? 0.065 : 0.19) + variation * 0.035;
    ctx.fillStyle = `rgba(22, 13, 10, ${shadowAlpha.toFixed(3)})`;
    ctx.fillRect(x, 0, 2 + (index % 3), HEIGHT);
    ctx.fillStyle = `rgba(255, 221, 166, ${(0.035 + variation * 0.035).toFixed(3)})`;
    ctx.fillRect(x + 4, 0, 1, HEIGHT);
    // Each broad rib has a gentle rounded shoulder, rather than alternating flat stripes.
    const rib = ctx.createLinearGradient(x + 4, 0, x + spacing - 1, 0);
    rib.addColorStop(0, 'rgba(255, 206, 143, 0.025)');
    rib.addColorStop(0.35, translucent ? 'rgba(255, 244, 207, 0.06)' : 'rgba(223, 108, 67, 0.08)');
    rib.addColorStop(1, 'rgba(25, 12, 7, 0.045)');
    ctx.fillStyle = rib;
    ctx.fillRect(x + 4, 0, spacing - 5, HEIGHT);
  }
  // Faint brushed grain avoids a perfectly smooth plastic slab at close viewing distances.
  for (let i = 0; i < 550; i++) {
    const x = (i * 127 + (i % 7) * 13) % WIDTH;
    const y = (i * 47 + (i % 11) * 9) % HEIGHT;
    ctx.fillStyle = i % 2 ? 'rgba(255, 229, 190, 0.025)' : 'rgba(43, 24, 14, 0.025)';
    ctx.fillRect(x, y, 1, 10 + (i % 29));
  }
}

function grooveBump(translucent: boolean) {
  const { canvas, ctx } = canvasSurface();
  ctx.fillStyle = '#999999';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const spacing = translucent ? 13 : 15;
  for (let x = 0; x < WIDTH; x += spacing) {
    ctx.fillStyle = '#777777';
    ctx.fillRect(x, 0, 2, HEIGHT);
    ctx.fillStyle = '#b1b1b1';
    ctx.fillRect(x + 4, 0, 2, HEIGHT);
    ctx.fillStyle = '#a3a3a3';
    ctx.fillRect(x + 6, 0, spacing - 8, HEIGHT);
  }
  return textureFrom(canvas, false);
}

/** Copper-red fluted fascia with LEDs fading inward from the upper and lower edges. */
export function createTwelfthFasciaMaterial(): THREE.MeshStandardMaterial {
  const { canvas, ctx } = canvasSurface();
  fillVertical(ctx, [
    [0, '#ffdc92'],
    [0.015, '#ffad54'],
    [0.055, '#d65b2d'],
    [0.14, '#a13c25'],
    [0.32, '#64271e'],
    [0.5, '#4e211b'],
    [0.68, '#64271e'],
    [0.86, '#a13c25'],
    [0.945, '#d65b2d'],
    [0.985, '#ffad54'],
    [1, '#ffdc92'],
  ]);
  flutes(ctx, false);
  const map = textureFrom(canvas);
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map,
    emissiveMap: map,
    emissive: '#ffffff',
    emissiveIntensity: 0.42,
    bumpMap: grooveBump(false),
    bumpScale: 0.008,
    metalness: 0.12,
    roughness: 0.52,
  });
  material.name = 'twelfth-red-fascia-edge-lit-flutes';
  return material;
}

/** Warm translucent counter glazing: top-lit cream fades into amber along the ribbed panel. */
export function createTwelfthCounterMaterial(): THREE.MeshStandardMaterial {
  const { canvas, ctx } = canvasSurface();
  fillVertical(ctx, [
    [0, '#fff2bc'],
    [0.04, '#ffe8a6'],
    [0.16, '#f8d880'],
    [0.36, '#e9c064'],
    [0.64, '#d7a749'],
    [0.86, '#bd8838'],
    [1, '#9b692e'],
  ]);
  flutes(ctx, true);
  const map = textureFrom(canvas);
  const material = new THREE.MeshStandardMaterial({
    color: '#fff7eb',
    map,
    emissiveMap: map,
    emissive: '#fff5e3',
    emissiveIntensity: 0.48,
    bumpMap: grooveBump(true),
    bumpScale: 0.004,
    metalness: 0.03,
    roughness: 0.49,
  });
  material.name = 'twelfth-amber-counter-top-lit-flutes';
  return material;
}
