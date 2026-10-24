import * as THREE from 'three';

/** Procedural lettering and ornament only; the reference photographs are never website textures. */
export function eighthTextPlane(
  text: string,
  width: number,
  height: number,
  ink = '#fffaf0',
  background = '',
) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(2048, Math.max(256, Math.round((384 * width) / height)));
  canvas.height = 384;
  const context = canvas.getContext('2d')!;
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const lines = text.split('\n');
  const longest = Math.max(...lines.map((line) => [...line].length), 1);
  const fontSize = Math.min((canvas.height * 0.72) / lines.length, (canvas.width * 0.88) / longest);
  context.fillStyle = ink;
  context.font = `600 ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  lines.forEach((line, index) =>
    context.fillText(line, canvas.width / 2, (canvas.height * (index + 0.5)) / lines.length),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: !background,
      depthWrite: !!background,
      toneMapped: false,
    }),
  );
}

export function addEighthCanteenSignage(
  parent: THREE.Group,
  names: string[],
  width: number,
  front: number,
) {
  const signage = new THREE.Group();
  signage.name = `eighth-signage-${names.join('-')}`;
  parent.add(signage);
  const steel = new THREE.MeshStandardMaterial({
    color: '#bac2b9',
    roughness: 0.28,
    metalness: 0.56,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: '#dfb729',
    roughness: 0.55,
    metalness: 0.1,
  });
  const charcoal = new THREE.MeshStandardMaterial({ color: '#282c28', roughness: 0.72 });
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    signage.add(mesh);
    return mesh;
  }
  box(width, 0.99, 0.24, 0, 3.22, front - 0.07);
  box(width - 0.07, 0.91, 0.025, 0, 3.22, front + 0.065, gold);

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#cda51f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ddd1a2';
  ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.strokeStyle = '#d9ad16';
  ctx.lineWidth = 13;
  // Repeating scrolls recall the photographed cutout pattern without copying a raster sign.
  if (typeof ctx.beginPath === 'function' && typeof ctx.arc === 'function') {
    for (let x = -24; x < canvas.width + 40; x += 114) {
      for (const y of [48, 204]) {
        ctx.beginPath();
        ctx.arc(x, y, 41, 0.18, Math.PI * 1.77);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 56, 128, 35, Math.PI * 0.65, Math.PI * 2.25);
        ctx.stroke();
      }
    }
  }
  ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
  const ornament = new THREE.CanvasTexture(canvas);
  ornament.colorSpace = THREE.SRGBColorSpace;
  ornament.anisotropy = 8;
  const pattern = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.12, 0.86),
    new THREE.MeshStandardMaterial({
      map: ornament,
      emissiveMap: ornament,
      emissive: '#ffedac',
      emissiveIntensity: 0.16,
      roughness: 0.57,
    }),
  );
  pattern.position.set(0, 3.22, front + 0.085);
  signage.add(pattern);

  const twoSigns = names.length === 2;
  const plaqueWidth = twoSigns ? width * 0.255 : width * 0.5;
  names.forEach((name, index) => {
    const x = twoSigns ? (index ? 1 : -1) * width * 0.337 : 0;
    box(plaqueWidth + 0.08, 0.65, 0.04, x, 3.22, front + 0.115, gold);
    const plaque = eighthTextPlane('', plaqueWidth, 0.57, '#fff', '#e4b90d');
    plaque.position.set(x, 3.22, front + 0.14);
    signage.add(plaque);
    for (const [layer, ink] of ['#4b3d2b', '#d3d4c8', '#fffef0'].entries()) {
      const letters = eighthTextPlane(name.split('').join(' '), plaqueWidth * 0.85, 0.49, ink);
      letters.position.set(
        x + [0.024, 0.012, 0][layer],
        3.22 + [-0.033, -0.012, 0][layer],
        front + 0.15 + layer * 0.025,
      );
      letters.name = layer === 2 ? `main-sign-${name}` : `sign-letter-depth-${layer}`;
      signage.add(letters);
    }
  });
  if (twoSigns) {
    const ledWidth = width * 0.327;
    box(ledWidth + 0.075, 0.82, 0.06, 0, 3.22, front + 0.11);
    box(ledWidth, 0.75, 0.015, 0, 3.22, front + 0.15, charcoal);
    // Only neutral illuminated strokes: the source scrolling menu cannot establish current dishes/prices.
    const ledMaterial = new THREE.MeshBasicMaterial({ color: '#b54436', toneMapped: false });
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 15; column++) {
        if ((row * 7 + column * 3) % 5 === 0) continue;
        const dash = box(
          0.035 + (column % 3) * 0.014,
          0.014,
          0.008,
          -ledWidth * 0.43 + column * ledWidth * 0.057,
          3.45 - row * 0.15,
          front + 0.165,
        );
        dash.material = ledMaterial;
        dash.castShadow = false;
      }
  }
  for (const y of [2.735, 3.71]) box(width + 0.035, 0.055, 0.3, 0, y, front - 0.055);
}
