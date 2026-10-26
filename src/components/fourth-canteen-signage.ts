import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FOURTH_SIGN_ARTWORK } from '../assets/fourth-canteen/signs';
import { createFourthSignageTexture } from '../lib/fourth-signage-textures';

type CanteenSignageOptions = {
  name: string;
  width: number;
  front: number;
  color: string;
  shopId: string;
  index: number;
};

/** Photograph-backed lightboxes with physical frames and controlled display brightness. */
export function addCanteenSignage(
  parent: THREE.Group,
  options: CanteenSignageOptions,
  loadTexture: (url: string) => THREE.Texture = createFourthSignageTexture,
): void {
  const { name, width, front, color, shopId, index } = options;
  const artwork = FOURTH_SIGN_ARTWORK[name as keyof typeof FOURTH_SIGN_ARTWORK];
  if (!artwork) throw new Error(`Missing fourth-canteen sign artwork: ${name}`);
  const group = new THREE.Group();
  group.name = `signage-${shopId}-${index}`;
  group.userData = { originalArtwork: true, signName: name };
  parent.add(group);
  const metal = new THREE.MeshStandardMaterial({
    color: '#656b68',
    roughness: 0.56,
    metalness: 0.36,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: '#afb6b0',
    roughness: 0.42,
    metalness: 0.4,
  });
  const gasket = new THREE.MeshStandardMaterial({ color: '#303633', roughness: 0.86 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.04 });

  function shape(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
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

  // The photo already includes the illuminated print. Basic material avoids lighting it
  // twice; a neutral tint caps even clipped-white source pixels at a calm off-white.
  // Keep local metal/trim physically lit, so the fascia still has depth and reflections.
  const signMaterial = new THREE.MeshBasicMaterial({
    map: loadTexture(artwork.sign),
    color: '#dededb',
    toneMapped: false,
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
  sign.castShadow = sign.receiveShadow = false;
  sign.userData = { originalArtwork: true, sourceUrl: artwork.sign };
  for (const y of [2.795, 3.645]) box(width - 0.09, 0.014, 0.018, trim, 0, y, front + 0.121);
  for (const x of [-(width - 0.11) / 2, (width - 0.11) / 2])
    box(0.008, 0.8, 0.012, gasket, x, 3.22, front + 0.126);
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

  shape(new RoundedBoxGeometry(width - 0.08, 0.28, 0.23, 2, 0.018), metal, 0, 2.675, front - 0.015);
  const menu = shape(
    new THREE.PlaneGeometry(width - 0.17, 0.225),
    new THREE.MeshBasicMaterial({
      map: loadTexture(artwork.menu),
      color: '#d7d7d3',
      toneMapped: false,
    }),
    0,
    2.675,
    front + 0.107,
  );
  menu.name = 'printed-serving-cards';
  menu.castShadow = menu.receiveShadow = false;
  menu.userData = { originalArtwork: true, sourceUrl: artwork.menu, referenceOnly: true };
  for (const y of [2.545, 2.805]) box(width - 0.12, 0.018, 0.026, trim, 0, y, front + 0.113);
}
