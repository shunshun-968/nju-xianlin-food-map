import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ninanPhoto, prepareNinanHutAssets } from '../src/components/ninan-hut-signage';

test('photo panels share the original pixels without sharing disposable texture objects', async () => {
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  class TestImage {
    width = 1950;
    height = 2600;
    onload: (() => void) | null = null;
    private source = '';
    get src() {
      return this.source;
    }
    set src(value: string) {
      this.source = value;
      queueMicrotask(() => this.onload?.());
    }
    async decode() {}
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: TestImage });
  const corners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ] as const;
  const panels: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>[] = [];
  try {
    await prepareNinanHutAssets();
    const first = ninanPhoto('breakfast', 1, 2, corners);
    const second = ninanPhoto('breakfast', 1, 2, corners);
    const other = ninanPhoto('drinks', 1, 2, corners);
    panels.push(first, second, other);
    const firstTexture = first.material.map!;
    const secondTexture = second.material.map!;
    assert.notEqual(firstTexture, secondTexture);
    assert.equal(firstTexture.source, secondTexture.source);
    assert.equal(firstTexture.image, secondTexture.image);
    assert.equal(firstTexture.image.width, 1950);
    assert.equal(firstTexture.image.height, 2600);
    assert.notEqual(firstTexture.source, other.material.map!.source);
    assert.deepEqual(
      first.geometry.getAttribute('uv').array,
      second.geometry.getAttribute('uv').array,
    );
    let siblingDisposed = false;
    secondTexture.addEventListener('dispose', () => {
      siblingDisposed = true;
    });
    firstTexture.dispose();
    assert.equal(siblingDisposed, false);
    assert.equal(secondTexture.image.width, 1950);
  } finally {
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage);
    else Reflect.deleteProperty(globalThis, 'Image');
    for (const panel of panels) {
      panel.geometry.dispose();
      panel.material.map?.dispose();
      panel.material.dispose();
    }
  }
});
