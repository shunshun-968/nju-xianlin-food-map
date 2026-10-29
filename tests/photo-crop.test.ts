import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createYifuSignage, prepareYifuKioskAssets } from '../src/components/yifu-kiosk-signage';
import { ninanPhoto, prepareNinanHutAssets } from '../src/components/ninan-hut-signage';
import { ninanPostersCrop, yifuBoardCrop } from '../src/lib/photo-crop';

test('cropped signage preserves original source coordinates on the rendered geometry', async () => {
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  class ImageStub {
    width = 3072;
    height = 3656;
    onload?: () => void;
    set src(_url: string) { queueMicrotask(() => this.onload?.()); }
    decode() { return Promise.resolve(); }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: ImageStub });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({
      fillRect() {}, drawImage() {}, putImageData() {},
      getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }),
    }) }),
  } });
  const meshes: THREE.Mesh[] = [];
  try {
    await Promise.all([prepareYifuKioskAssets(), prepareNinanHutAssets()]);
    const corners = [[0.748, 0.444], [0.816, 0.425], [0.817, 0.635], [0.75, 0.645]] as const;
    const original = ninanPhoto('breakfast', 1.18, 2.04, corners);
    const cropped = ninanPhoto('east', 1.18, 2.04, corners);
    meshes.push(original, cropped);
    const a = original.geometry.getAttribute('uv'), b = cropped.geometry.getAttribute('uv');
    const [left, top, width, height] = ninanPostersCrop.rectangle;
    for (let i = 0; i < a.count; i++) {
      assert.ok(Math.abs(a.getX(i) * 1600 - (b.getX(i) * width + left)) < 0.001);
      assert.ok(Math.abs((1 - a.getY(i)) * 1200 - ((1 - b.getY(i)) * height + top)) < 0.001);
      assert.ok(b.getX(i) > 0 && b.getX(i) < 1 && b.getY(i) > 0 && b.getY(i) < 1);
    }
    const group = createYifuSignage(new THREE.Group());
    group.traverse(node => { if (node instanceof THREE.Mesh) meshes.push(node); });
    const face = (group.children[0] as THREE.Group).children[1] as THREE.Mesh;
    const uv = face.geometry.getAttribute('uv');
    const expected = [[0.002, 0.059], [0.998, 0.058], [0.133, 0.944], [0.859, 0.939]];
    const [x, y, w, h] = yifuBoardCrop.rectangle;
    for (const [j, i] of [0, 24, 800, 824].entries()) {
      assert.ok(Math.abs(uv.getX(i) * w + x - expected[j][0] * 3072) < 0.001);
      assert.ok(Math.abs((1 - uv.getY(i)) * h + y - expected[j][1] * 4096) < 0.001);
    }
  } finally {
    for (const [name, descriptor] of [['Image', originalImage], ['document', originalDocument]] as const)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        (material as THREE.MeshStandardMaterial).map?.dispose();
        material.dispose();
      }
    }
  }
});

test('the progressive Yifu derivative retains the original ICC color profile', () => {
  function profiles(file: URL) {
    const data = readFileSync(file), profiles: Buffer[] = [];
    let offset = 2;
    while (offset + 4 <= data.length) {
      const marker = data.readUInt16BE(offset);
      if (marker === 0xffda || marker === 0xffd9) break;
      const length = data.readUInt16BE(offset + 2);
      if (marker === 0xffe2 && data.subarray(offset + 4, offset + 16).toString() === 'ICC_PROFILE\0')
        profiles.push(data.subarray(offset + 4, offset + 2 + length));
      offset += 2 + length;
    }
    return profiles;
  }
  const original = profiles(new URL('../src/assets/yifu-kiosk/b102-board.jpg', import.meta.url));
  assert.ok(original.length > 0);
  assert.deepEqual(profiles(new URL('../src/assets/yifu-kiosk/b102-board-surface.jpg', import.meta.url)), original);
});
