import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import { tenthCanteenStalls, tenthStallId } from '../src/data/tenth-canteen';
import { getIndoorCanteen, getIndoorWindow, tenthCanteenSpec } from '../src/data/indoor-canteens';
import { windows } from '../src/models/tenth-canteen/layout.js';
import { createStallPickTargets } from '../src/lib/stall-picking';

test('tenth model belongs to floor 1; physical 16 and 17 share one selectable shop', () => {
  assert.equal(getIndoorCanteen('v-10-f1'), tenthCanteenSpec);
  assert.equal(getIndoorCanteen('v-10-f2'), undefined);
  assert.equal(catalog.stalls.filter((s) => s.floorId === 'v-10-f1').length, 14);
  assert.equal(new Set(tenthCanteenStalls.map((s) => s.id)).size, 14);
  for (const n of [2,3,4]) assert.equal(tenthStallId(n), tenthStallId(1));
  assert.deepEqual(getIndoorWindow(tenthCanteenSpec,tenthStallId(1))?.windowNumbers,[1,2,3,4]);
  assert.equal(tenthStallId(16), tenthStallId(17));
  assert.deepEqual(getIndoorWindow(tenthCanteenSpec, tenthStallId(16))?.windowNumbers, [16, 17]);
});

test('all physical openings pick their actual shop in both views, including the north-facing row', () => {
  const targets = createStallPickTargets(tenthCanteenStalls);
  for (const window of windows) {
    targets.setMode('plan');
    const normal = new THREE.Vector3(Math.sin(window.rotationY), 0, Math.cos(window.rotationY));
    const floorPoint = new THREE.Vector3(window.x, 0, window.z).addScaledVector(normal, -1);
    const planRay = new THREE.Raycaster(floorPoint.clone().setY(10), new THREE.Vector3(0, -1, 0));
    assert.equal(targets.pick(planRay), tenthStallId(window.number), `plan ${window.number}`);
    targets.setMode('3d');
    const origin = new THREE.Vector3(window.x, 2, window.z).addScaledVector(normal, 1);
    assert.equal(
      targets.pick(new THREE.Raycaster(origin, normal.negate())),
      tenthStallId(window.number),
      `3d ${window.number}`,
    );
  }
});
