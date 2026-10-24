import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import { createStallPickTargets } from '../src/lib/stall-picking';
import type { Stall } from '../src/domain';

function dispose(targets: ReturnType<typeof createStallPickTargets>) {
  targets.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
}

test('every canteen window accepts its full facade, including signs, empty gaps and plinths', () => {
  for (const floor of catalog.floors) {
    const stalls = catalog.stalls.filter((stall) => stall.floorId === floor.id);
    const targets = createStallPickTargets(stalls);
    for (const stall of stalls) {
      const p = stall.position;
      const normal = new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
      for (const height of [0.08, 1.8, 2.65, 3.65]) {
        const origin = new THREE.Vector3(p.x, height, p.z).addScaledVector(normal, p.depth / 2 + 2);
        const ray = new THREE.Raycaster(origin, normal.clone().negate());
        assert.equal(targets.pick(ray), stall.id, `${stall.id} at height ${height}`);
      }
    }
    dispose(targets);
  }
});

test('plan picks every real service window and keeps numbered adjacent windows distinct', () => {
  for (const floorId of ['v-456-f1', 'v-456-f2', 'v-456-f3']) {
    const stalls = catalog.stalls.filter((stall) => stall.floorId === floorId);
    const targets = createStallPickTargets(stalls);
    targets.setMode('plan');
    for (const stall of stalls) {
      const p = stall.position;
      const origin = new THREE.Vector3(p.x, 20, p.z).addScaledVector(
        new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY)),
        p.depth / 2 - 0.2,
      );
      assert.equal(
        targets.pick(new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0))),
        stall.id,
      );
    }
    dispose(targets);
  }
});

test('full kitchen depth and width stay clickable in every orientation without reaching neighboring shops', () => {
  for (const rotationY of [0, -Math.PI / 2, Math.PI / 2, Math.PI]) {
    const stall: Stall = {
      id: 'sample',
      floorId: 'floor',
      name: 'sample',
      category: 'sample',
      photoKey: null,
      dishes: [],
      position: { x: 10, z: 20, width: 2, depth: 4, rotationY },
    };
    const targets = createStallPickTargets([stall]);
    targets.setMode('plan');
    const rayAt = (x: number, z: number) =>
      new THREE.Raycaster(
        new THREE.Vector3(
          10 + x * Math.cos(rotationY) + z * Math.sin(rotationY),
          20,
          20 - x * Math.sin(rotationY) + z * Math.cos(rotationY),
        ),
        new THREE.Vector3(0, -1, 0),
      );
    for (const x of [-0.98, 0, 0.98])
      for (const z of [-1.98, 0, 2.25]) assert.equal(targets.pick(rayAt(x, z)), 'sample');
    assert.equal(targets.pick(rayAt(1.02, 0)), undefined);
    assert.equal(targets.pick(rayAt(0, -2.05)), undefined);
    assert.equal(targets.pick(rayAt(0, 2.35)), undefined);
    // Overhead surfaces must not remain active after switching to 3D.
    targets.setMode('3d');
    assert.equal(targets.pick(rayAt(0, 0)), undefined);
    dispose(targets);
  }
});

test('shared corners select the nearest service edge independently of array order', () => {
  const template: Stall = {
    id: 'front',
    floorId: 'f',
    name: 's',
    category: 'c',
    photoKey: null,
    dishes: [],
    position: { x: 0, z: 0, width: 4, depth: 4, rotationY: 0 },
  };
  const side: Stall = {
    ...template,
    id: 'side',
    position: { ...template.position, rotationY: -Math.PI / 2 },
  };
  for (const stalls of [
    [template, side],
    [side, template],
  ]) {
    const targets = createStallPickTargets(stalls);
    targets.setMode('plan');
    assert.equal(
      targets.pick(new THREE.Raycaster(new THREE.Vector3(0, 20, 1.7), new THREE.Vector3(0, -1, 0))),
      'front',
    );
    assert.equal(
      targets.pick(
        new THREE.Raycaster(new THREE.Vector3(-1.7, 20, 0), new THREE.Vector3(0, -1, 0)),
      ),
      'side',
    );
    targets.group.visible = false;
    assert.equal(
      targets.pick(new THREE.Raycaster(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0))),
      undefined,
    );
    targets.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        assert.equal((object.material as THREE.Material).visible, false);
        assert.equal(object.castShadow, false);
      }
    });
    dispose(targets);
  }
});
