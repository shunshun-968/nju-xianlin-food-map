import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type CanteenSignageOptions = {
  name: string;
  width: number;
  front: number;
  color: string;
  shopId: string;
  index: number;
};

/** Photo-inspired lightboxes; names and frontage dimensions come from the catalog. */
export function addCanteenSignage(parent: THREE.Group, options: CanteenSignageOptions): void {
  const { name, width, front, color, shopId, index } = options;
  const group = new THREE.Group();
  group.name = `signage-${shopId}-${index}`;
  parent.add(group);

  const yellow = shopId === 'maijindi';
  const fusion = name === '创意融合';
  const noodles = name.includes('蒙自源');
  const northeast = name === '东北风味';
  const dumplings = name.includes('京兜');
  const heritage = !yellow && !fusion && !noodles && !northeast && !dumplings;
  const background = yellow ? '#e8b82e' : fusion ? '#b84943' : noodles ? '#a5bb48' : '#f6f2e6';
  const ink =
    yellow || fusion || noodles
      ? '#fff8e4'
      : name === '福建风味'
        ? '#54286c'
        : northeast
          ? '#243f48'
          : name === '川渝风味'
            ? '#975528'
            : dumplings
              ? '#416f50'
              : '#8e3432';

  const metal = new THREE.MeshStandardMaterial({
    color: '#7f8986',
    roughness: 0.34,
    metalness: 0.48,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: '#b9bfba',
    roughness: 0.31,
    metalness: 0.48,
  });
  const gasket = new THREE.MeshStandardMaterial({ color: '#515b57', roughness: 0.76 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.12 });

  function shape(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
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
    return shape(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }

  function canvasTexture(
    height: number,
    aspect: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  ) {
    const canvas = document.createElement('canvas');
    canvas.height = height;
    canvas.width = Math.min(3072, Math.max(512, Math.round(height * aspect)));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is required for canteen signage');
    draw(ctx, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  // The model test's tiny canvas stub has only rect/text methods. Rich drawing is
  // optional there, while the browser retains gradients, paths and rounded dishes.
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
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function polygon(ctx: CanvasRenderingContext2D, points: number[][], fill: string) {
    if (
      typeof ctx.beginPath !== 'function' ||
      typeof ctx.moveTo !== 'function' ||
      typeof ctx.lineTo !== 'function' ||
      typeof ctx.fill !== 'function'
    )
      return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
    ctx.fill();
  }

  function gradient(ctx: CanvasRenderingContext2D, w: number, h: number, colors: string[]) {
    if (typeof ctx.createLinearGradient === 'function') {
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      colors.forEach((value, stop) => fill.addColorStop(stop / (colors.length - 1), value));
      ctx.fillStyle = fill;
    } else ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, w, h);
  }

  function landscape(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const x = w * 0.025,
      span = w * 0.195;
    polygon(
      ctx,
      [
        [x, h * 0.72],
        [x + span * 0.2, h * 0.38],
        [x + span * 0.4, h * 0.59],
        [x + span * 0.63, h * 0.25],
        [x + span, h * 0.73],
      ],
      '#c8d6cc',
    );
    polygon(
      ctx,
      [
        [x, h * 0.76],
        [x + span * 0.18, h * 0.56],
        [x + span * 0.46, h * 0.67],
        [x + span * 0.79, h * 0.39],
        [x + span, h * 0.76],
      ],
      '#adbeb6',
    );
    ellipse(ctx, x + span * 0.6, h * 0.8, span * 0.52, h * 0.05, '#d4ddd2');
    const buildingX = x + span * 0.24,
      buildingW = span * 0.55;
    ctx.fillStyle = '#bba680';
    ctx.fillRect(buildingX, h * 0.53, buildingW, h * 0.22);
    ctx.fillStyle = '#e1ccb0';
    ctx.fillRect(buildingX + buildingW * 0.07, h * 0.57, buildingW * 0.86, h * 0.18);
    for (let pillar = 0; pillar < 5; pillar += 1) {
      ctx.fillStyle = '#9e856a';
      ctx.fillRect(
        buildingX + buildingW * (0.05 + pillar * 0.22),
        h * 0.55,
        Math.max(2, buildingW * 0.025),
        h * 0.2,
      );
    }
    polygon(
      ctx,
      [
        [buildingX - buildingW * 0.15, h * 0.56],
        [buildingX + buildingW * 0.5, h * 0.4],
        [buildingX + buildingW * 1.15, h * 0.56],
      ],
      '#668c89',
    );
    polygon(
      ctx,
      [
        [buildingX, h * 0.41],
        [buildingX + buildingW * 0.5, h * 0.3],
        [buildingX + buildingW, h * 0.41],
      ],
      '#759c97',
    );
    ctx.fillStyle = '#a8c4b6';
    ctx.fillRect(buildingX + buildingW * 0.23, h * 0.41, buildingW * 0.54, h * 0.07);
    ctx.fillStyle = '#f6f2e6';
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x, h * 0.25, span, h * 0.56);
    ctx.globalAlpha = 1;
  }

  const signTexture = canvasTexture(512, (width - 0.25) / 0.66, (ctx, w, h) => {
    if (northeast) gradient(ctx, w, h, ['#b5ced8', '#d5e2dc', '#a8be85']);
    else if (dumplings) gradient(ctx, w, h, ['#eff2e4', '#d5e3c8', '#84ae78']);
    else
      gradient(ctx, w, h, [
        background,
        yellow ? '#edc146' : fusion ? '#bf554d' : noodles ? '#b6c960' : '#fffaf0',
        background,
      ]);

    // Low-contrast transmission bands and a little print grain break perfect flatness.
    for (let band = 0; band < 26; band += 1) {
      ctx.fillStyle = `rgba(255,246,216,${0.012 + (Math.sin(band * 0.63 + index) + 1) * 0.012})`;
      ctx.fillRect((band * w) / 26, h * 0.07, w / 26 + 1, h * 0.86);
    }
    for (let speck = 0; speck < 260; speck += 1) {
      const x = (((speck * 193 + index * 47) % 991) / 991) * w;
      const y = (((speck * 71 + index * 31) % 509) / 509) * h;
      ctx.fillStyle = speck % 3 ? 'rgba(105,95,74,0.025)' : 'rgba(255,255,240,0.08)';
      ctx.fillRect(x, y, 2, 1);
    }
    ctx.strokeStyle = heritage ? color : 'rgba(255,248,220,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(13, 14, w - 26, h - 28);
    ctx.strokeStyle = 'rgba(100,89,69,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 22, w - 40, h - 44);
    if (heritage) landscape(ctx, w, h);
    if (northeast) {
      ellipse(ctx, w * 0.12, h * 0.27, w * 0.09, h * 0.1, 'rgba(255,253,235,0.5)');
      ellipse(ctx, w * 0.81, h * 0.22, w * 0.12, h * 0.08, 'rgba(255,253,235,0.4)');
    }
    if (yellow) {
      ctx.font = `600 ${Math.round(h * 0.115)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff5dc';
      ctx.fillText('麦金地', w * 0.12, h * 0.52, w * 0.16);
      ctx.strokeStyle = 'rgba(255,247,219,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.035, h * 0.37, w * 0.17, h * 0.3);
    }
    const start = heritage || yellow ? w * 0.245 : w * 0.055;
    const available = w * 0.945 - start;
    const fontSize = Math.min(h * (heritage ? 0.68 : 0.61), (available / name.length) * 0.97);
    ctx.font = `${heritage ? 700 : fusion ? 750 : 600} ${Math.round(fontSize)}px ${heritage ? '"STSong", "SimSun", "Songti SC", serif' : '"Microsoft YaHei", "PingFang SC", sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textX = start + available / 2,
      textY = h * 0.52;
    ctx.fillStyle = heritage ? 'rgba(72,49,42,0.16)' : 'rgba(73,53,31,0.12)';
    ctx.fillText(name, textX + 2, textY + 3, available);
    ctx.fillStyle = ink;
    ctx.fillText(name, textX, textY, available);
    if (heritage) {
      const sealSize = h * 0.07;
      ctx.strokeStyle = '#b76d60';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.952 - sealSize, h * 0.18, sealSize, sealSize);
      ctx.strokeRect(w * 0.952 - sealSize + 5, h * 0.18 + 5, sealSize - 10, sealSize - 10);
    }
    ctx.fillStyle = 'rgba(111,94,67,0.055)';
    ctx.fillRect(0, h - 12, w, 12);
  });

  const signMaterial = new THREE.MeshStandardMaterial({
    map: signTexture,
    emissiveMap: signTexture,
    color: '#fff8e8',
    emissive: '#fff2d7',
    emissiveIntensity: 0.46,
    roughness: 0.42,
    metalness: 0.02,
  });
  shape(new RoundedBoxGeometry(width - 0.055, 0.9, 0.32, 2, 0.025), metal, 0, 3.22, front - 0.04);
  shape(new RoundedBoxGeometry(width - 0.12, 0.79, 0.08, 2, 0.018), accent, 0, 3.22, front + 0.135);
  const sign = shape(
    new THREE.PlaneGeometry(width - 0.25, 0.66),
    signMaterial,
    0,
    3.22,
    front + 0.182,
  );
  sign.name = `main-sign-${name}`;
  sign.castShadow = false;
  for (const y of [2.795, 3.645]) {
    box(width - 0.09, 0.014, 0.018, trim, 0, y, front + 0.121);
  }
  for (const x of [-(width - 0.11) / 2, (width - 0.11) / 2]) {
    box(0.008, 0.8, 0.012, gasket, x, 3.22, front + 0.126);
  }
  const screwGeometry = new THREE.CylinderGeometry(0.009, 0.009, 0.007, 10);
  const screwXs =
    width > 3
      ? [-(width / 2 - 0.07), 0, width / 2 - 0.07]
      : [-(width / 2 - 0.07), width / 2 - 0.07];
  for (const x of screwXs) {
    for (const y of [2.817, 3.622]) {
      const screw = shape(screwGeometry, trim, x, y, front + 0.133);
      screw.rotation.x = Math.PI / 2;
      box(0.01, 0.0017, 0.002, gasket, x, y, front + 0.138);
    }
  }

  function dishDrawing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    variant: number,
  ) {
    ellipse(
      ctx,
      cx + radius * 0.05,
      cy + radius * 0.16,
      radius,
      radius * 0.58,
      'rgba(78,64,43,0.18)',
    );
    ellipse(ctx, cx, cy, radius, radius * 0.61, '#e5e5d8');
    ellipse(ctx, cx, cy - radius * 0.04, radius * 0.83, radius * 0.46, '#b6ad87');
    const colors = ['#73834a', '#a56f42', '#d6ab51', '#d7ccb0'];
    for (let bite = 0; bite < 14; bite += 1) {
      const angle = bite * 2.4;
      const spread = (0.2 + (bite % 4) * 0.15) * radius;
      ellipse(
        ctx,
        cx + Math.cos(angle) * spread,
        cy + Math.sin(angle) * spread * 0.45,
        radius * 0.17,
        radius * 0.105,
        colors[(bite + variant) % colors.length],
      );
    }
  }

  const menuTexture = canvasTexture(256, (width - 0.17) / 0.225, (ctx, w, h) => {
    gradient(ctx, w, h, ['#eee9da', '#fcf8e9', '#e5e0d1']);
    const portions = index % 2 ? [0.29, 0.43, 0.28] : [0.4, 0.26, 0.34];
    const prompts = ['按需取餐', '文明用餐', '注意烫手'];
    let left = 0;
    portions.forEach((portion, card) => {
      const cardX = left * w + 6,
        cardW = portion * w - 12;
      const cardY = card === 1 ? 14 : 7,
        cardH = h - cardY - 9;
      ctx.fillStyle = 'rgba(71,65,48,0.13)';
      ctx.fillRect(cardX + 3, cardY + 4, cardW, cardH);
      ctx.fillStyle = card === 1 ? (fusion ? '#a75042' : '#d4dfd5') : '#faf5e7';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.fillStyle = card === 0 ? color : '#b9aa8d';
      ctx.fillRect(cardX, cardY, cardW, card === 1 ? 8 : 12);
      const pictureRadius = Math.min(cardW * 0.18, h * 0.37);
      dishDrawing(
        ctx,
        cardX + pictureRadius * 1.35,
        cardY + cardH * 0.54,
        pictureRadius,
        index + card,
      );
      ctx.font = `500 ${Math.round(h * 0.15)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = card === 1 && fusion ? '#fff5dd' : '#5e6657';
      const labelX = cardX + pictureRadius * 2.6;
      ctx.fillText(
        prompts[(index + card) % prompts.length],
        labelX,
        cardY + cardH * 0.44,
        cardW - pictureRadius * 2.7,
      );
      ctx.font = `400 ${Math.round(h * 0.09)}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = card === 1 && fusion ? '#f0d4ad' : '#929681';
      ctx.fillText('请有序排队', labelX, cardY + cardH * 0.69, cardW - pictureRadius * 2.7);
      ctx.fillStyle = '#a8af9f';
      ctx.fillRect(cardX + cardW * 0.5 - 7, cardY - 2, 14, 8);
      left += portion;
    });
  });
  shape(new RoundedBoxGeometry(width - 0.08, 0.28, 0.23, 2, 0.018), metal, 0, 2.675, front - 0.015);
  const menuMaterial = new THREE.MeshStandardMaterial({
    map: menuTexture,
    emissiveMap: menuTexture,
    color: '#fff7e5',
    emissive: '#fff0cf',
    emissiveIntensity: 0.38,
    roughness: 0.46,
  });
  const menu = shape(
    new THREE.PlaneGeometry(width - 0.17, 0.225),
    menuMaterial,
    0,
    2.675,
    front + 0.107,
  );
  menu.name = 'printed-serving-cards';
  menu.castShadow = false;
  for (const y of [2.545, 2.805]) box(width - 0.12, 0.018, 0.026, trim, 0, y, front + 0.113);
  let divider = -width / 2 + 0.085;
  for (const portion of index % 2 ? [0.29, 0.43] : [0.4, 0.26]) {
    divider += (width - 0.17) * portion;
    box(0.012, 0.225, 0.017, trim, divider, 2.675, front + 0.119);
    box(0.07, 0.024, 0.025, trim, divider + 0.055, 2.78, front + 0.124);
  }
}
