import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FOURTH_SIGN_ARTWORK } from '../src/assets/fourth-canteen/signs';
import { FOURTH_LAYOUT, fourthCanteenFaces } from '../src/data/fourth-canteen';
import { addCanteenSignage } from '../src/components/fourth-canteen-signage';

test('all 13 fourth-canteen frontages have distinct photographed sign/menu crops within the asset budget', () => {
  assert.equal(fourthCanteenFaces.length, 13);
  assert.deepEqual(
    Object.keys(FOURTH_SIGN_ARTWORK).sort(),
    fourthCanteenFaces.map((face) => face.name).sort(),
  );
  const urls = Object.values(FOURTH_SIGN_ARTWORK).flatMap(({ sign, menu }) => [sign, menu]);
  assert.equal(urls.length, 26);
  assert.equal(new Set(urls).size, 26);
  let bytes = 0;
  for (const url of urls) {
    const file = readFileSync(new URL(url));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF', url);
    assert.equal(file.toString('ascii', 8, 12), 'WEBP', url);
    bytes += file.length;
  }
  assert.ok(bytes < 1_500_000, `The 26 sign crops total ${bytes} bytes`);
  const cornerFaces = fourthCanteenFaces.filter((face) => face.shopId === 'maijindi');
  assert.deepEqual(cornerFaces.map((face) => face.name).sort(), ['优品麦选', '酱香醇厚'].sort());
  assert.notEqual(FOURTH_SIGN_ARTWORK.优品麦选.sign, FOURTH_SIGN_ARTWORK.酱香醇厚.sign);
  assert.notEqual(FOURTH_SIGN_ARTWORK.优品麦选.menu, FOURTH_SIGN_ARTWORK.酱香醇厚.menu);
});

test('all fourth-canteen sign planes use original photographs and restrained unlit colors without a DOM', () => {
  const root = new THREE.Group();
  const loaded = new Map<string, THREE.Texture>();
  const front = FOURTH_LAYOUT.frontOffset;
  const loadTexture = (url: string) => {
    assert.equal(loaded.has(url), false, `Unexpected repeat load of ${url}`);
    const texture = new THREE.Texture();
    loaded.set(url, texture);
    return texture;
  };
  try {
    for (const [index, face] of fourthCanteenFaces.entries()) {
      const parent = new THREE.Group();
      root.add(parent);
      // Geometry and material creation run in Node without canvas, Image or document stubs.
      addCanteenSignage(parent, { ...face, front, index }, loadTexture);
      const artwork = FOURTH_SIGN_ARTWORK[face.name as keyof typeof FOURTH_SIGN_ARTWORK];
      const main = parent.getObjectByName(`main-sign-${face.name}`);
      const menu = parent.getObjectByName('printed-serving-cards');
      assert.ok(main instanceof THREE.Mesh, face.name);
      assert.ok(menu instanceof THREE.Mesh, face.name);
      for (const [plane, url, tint] of [
        [main, artwork.sign, 'dededb'],
        [menu, artwork.menu, 'd7d7d3'],
      ] as const) {
        assert.ok(plane.geometry instanceof THREE.PlaneGeometry);
        assert.ok(plane.material instanceof THREE.MeshBasicMaterial);
        assert.equal(
          plane.material.map,
          loaded.get(url),
          'Use the loaded pixels, not redrawn lettering',
        );
        assert.equal(plane.material.toneMapped, false);
        assert.equal(plane.material.color.getHexString(), tint);
        assert.equal('emissive' in plane.material, false);
        assert.equal('emissiveMap' in plane.material, false);
        assert.equal(plane.castShadow, false);
        assert.ok(plane.position.z > front && plane.position.z < front + 0.23);
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion);
        assert.ok(normal.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-10);
      }
      assert.ok(Math.abs(main.position.z - (front + 0.182)) < 0.02);
      assert.ok(
        main.position.y > menu.position.y,
        'Keep the main fascia above the narrow printed strip',
      );
    }
    assert.deepEqual(
      [...loaded.keys()].sort(),
      Object.values(FOURTH_SIGN_ARTWORK)
        .flatMap(({ sign, menu }) => [sign, menu])
        .sort(),
    );
  } finally {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    loaded.forEach((texture) => texture.dispose());
    root.clear();
  }
});
