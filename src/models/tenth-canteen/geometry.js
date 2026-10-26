import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const cache = new Map();
const cube = new THREE.BoxGeometry(1, 1, 1);
export function mat(color, metalness = 0, roughness = 0.7, emission = 0) {
  const key = [color, metalness, roughness, emission].join('/');
  if (!cache.has(key))
    cache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        emissive: emission ? color : '#000000',
        emissiveIntensity: emission,
      }),
    );
  return cache.get(key);
}
export function box(parent, x, y, z, w, h, d, color, metalness = 0, roughness = 0.7, emission = 0) {
  const m = new THREE.Mesh(cube, mat(color, metalness, roughness, emission));
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cylinder(parent, x, y, z, r, h, color, metalness = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat(color, metalness));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function tileSurface(
  parent,
  {
    width,
    height,
    x = 0,
    y = 0,
    z = 0,
    horizontal = false,
    color = '#e8e5db',
    tileX = 0.6,
    tileY = 0.3,
  },
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d');
  c.fillStyle = color;
  c.fillRect(0, 0, 1024, 512);
  c.strokeStyle = '#c9c7bd';
  c.lineWidth = 2;
  for (let i = 0; i <= width / tileX; i++) {
    const px = ((i * tileX) / width) * 1024;
    c.beginPath();
    c.moveTo(px, 0);
    c.lineTo(px, 512);
    c.stroke();
  }
  for (let i = 0; i <= height / tileY; i++) {
    const py = ((i * tileY) / height) * 512;
    c.beginPath();
    c.moveTo(0, py);
    c.lineTo(1024, py);
    c.stroke();
  }
  let seed = 37;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(85,81,64,${rand() * 0.045})`;
    c.fillRect(rand() * 1024, rand() * 512, rand() * 3 + 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: horizontal ? 0.78 : 0.42,
      metalness: 0.02,
    }),
  );
  m.position.set(x, y, z);
  if (horizontal) m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const owners = [root];
  root.traverse((n) => {
    if (n !== root && (n.userData.planHide || n.name === 'plan-labels')) owners.push(n);
  });
  for (const owner of owners) {
    const inverse = owner.matrixWorld.clone().invert(),
      buckets = new Map();
    owner.traverse((m) => {
      if (
        !(m instanceof THREE.Mesh) ||
        m instanceof THREE.InstancedMesh ||
        Array.isArray(m.material) ||
        m.userData.steam ||
        m.userData.animated ||
        m.userData.selection ||
        m.material.transparent ||
        m.material.visible === false ||
        m.material.map
      )
        return;
      let p = m.parent;
      while (p && p !== owner) {
        if (owners.includes(p)) return;
        p = p.parent;
      }
      const a = m.material,
        key = [
          a.type,
          a.color?.getHex(),
          a.roughness,
          a.metalness,
          a.emissive?.getHex(),
          a.emissiveIntensity,
          a.side,
          m.castShadow,
          m.receiveShadow,
          Object.keys(m.geometry.attributes).sort().join(','),
        ].join('/');
      const bucket = buckets.get(key) || [];
      bucket.push(m);
      buckets.set(key, bucket);
    });
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue;
      const parts = bucket.map((m) => {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
        return g;
      });
      const geometry = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      if (!geometry) continue;
      const first = bucket[0],
        m = new THREE.Mesh(geometry, first.material);
      m.castShadow = first.castShadow;
      m.receiveShadow = first.receiveShadow;
      m.name = 'static-details';
      bucket.forEach((o) => o.removeFromParent());
      owner.add(m);
    }
  }
}
