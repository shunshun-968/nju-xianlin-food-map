import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ninanBrand, ninanPhoto, prepareNinanHutAssets } from '../src/components/ninan-hut-signage';

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

test('repeated brand marks reuse processed pixels while retaining independent sizes and textures', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let processing = 0;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({
      drawImage() {},
      getImageData: () => { processing++; return { data: new Uint8ClampedArray([255, 255, 255, 255]) }; },
      putImageData() {},
    }) }),
  } });
  const marks: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>[] = [];
  try {
    for (const [width, color] of [[0.055, '#6c477e'], [0.65, '#6c477e'], [0.65, '#ffffff']] as const)
      marks.push(ninanBrand('crest', width, color) as typeof marks[number]);
    assert.equal(processing, 2, 'same artwork and color are processed only once');
    assert.equal(marks[0].material.map!.source, marks[1].material.map!.source);
    assert.notEqual(marks[0].material.map, marks[1].material.map);
    assert.notEqual(marks[1].material.map!.source, marks[2].material.map!.source);
    assert.equal(marks[0].geometry.parameters.width, 0.055);
    assert.equal(marks[1].geometry.parameters.width, 0.65);
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
    for (const mark of marks) { mark.geometry.dispose(); mark.material.map?.dispose(); mark.material.dispose(); }
  }
});
