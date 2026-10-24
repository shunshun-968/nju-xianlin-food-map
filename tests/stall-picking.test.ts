import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import { createStallPickTargets } from '../src/lib/stall-picking';
import { validateCatalog, type Stall, type StallPosition } from '../src/domain';

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

test('opposing service faces open the same shop from either row in plan and 3D', () => {
  const stall: Stall = {
    id: 'two-sided-shop',
    floorId: 'floor',
    name: 'one shop',
    category: 'food',
    photoKey: null,
    dishes: [],
    position: { x: 0, z: -4, width: 4, depth: 3, rotationY: 0 },
    serviceAreas: [{ x: 0, z: 4, width: 4, depth: 3, rotationY: Math.PI }],
  };
  const targets = createStallPickTargets([stall]);
  try {
    for (const p of [stall.position, ...stall.serviceAreas!]) {
      const normal = new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
      targets.setMode('3d');
      for (const height of [0.08, 1.8, 3.65]) {
        const origin = new THREE.Vector3(p.x, height, p.z).addScaledVector(normal, p.depth / 2 + 1);
        assert.equal(targets.pick(new THREE.Raycaster(origin, normal.clone().negate())), stall.id);
      }
      targets.setMode('plan');
      for (const offset of [-p.depth / 2 + 0.05, 0, p.depth / 2 + 0.2]) {
        const origin = new THREE.Vector3(p.x, 20, p.z).addScaledVector(normal, offset);
        assert.equal(
          targets.pick(new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0))),
          stall.id,
        );
      }
    }
    assert.equal(
      targets.pick(new THREE.Raycaster(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0))),
      undefined,
      'The aisle between separate service areas stays clear',
    );
  } finally {
    dispose(targets);
  }
});

test('an L-shaped shop keeps one identity and ranks each overlapping footprint by its own service edge', () => {
  const primary: StallPosition = { x: 0, z: 0, width: 4, depth: 4, rotationY: 0 };
  const side: StallPosition = { ...primary, rotationY: -Math.PI / 2 };
  const corner: Stall = {
    id: 'corner-shop',
    floorId: 'floor',
    name: 'corner shop',
    category: 'food',
    photoKey: null,
    dishes: [],
    position: primary,
    serviceAreas: [side],
  };
  const neighbor: Stall = {
    ...corner,
    id: 'neighbor',
    position: { ...primary, rotationY: Math.PI / 2 },
    serviceAreas: undefined,
  };
  for (const areas of [
    [primary, side],
    [side, primary],
  ]) {
    const shop = { ...corner, position: areas[0], serviceAreas: [areas[1]] };
    for (const stalls of [
      [shop, neighbor],
      [neighbor, shop],
    ]) {
      const targets = createStallPickTargets(stalls);
      try {
        targets.setMode('plan');
        const downAt = (x: number, z: number) =>
          new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
        assert.equal(targets.pick(downAt(1, 1.7)), corner.id, 'Main service edge wins near +Z');
        assert.equal(targets.pick(downAt(-1.7, 1)), corner.id, 'Side service edge wins near -X');
        assert.equal(targets.pick(downAt(1.7, 0)), neighbor.id, 'Neighbor retains its +X edge');
        targets.setMode('3d');
        for (const p of areas) {
          const normal = new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
          const origin = new THREE.Vector3(p.x, 2, p.z).addScaledVector(normal, p.depth / 2 + 1);
          assert.equal(
            targets.pick(new THREE.Raycaster(origin, normal.clone().negate())),
            corner.id,
          );
        }
      } finally {
        dispose(targets);
      }
    }
  }
});

test('catalog validates every additional service area without changing legacy single-face records', () => {
  const data = structuredClone(catalog);
  const stall = data.stalls[0];
  const floor = data.floors.find((f) => f.id === stall.floorId)!;
  const valid: StallPosition = { x: 0, z: 0, width: 4, depth: 3, rotationY: Math.PI / 2 };
  assert.deepEqual(validateCatalog(data), []);
  stall.serviceAreas = [];
  assert.deepEqual(validateCatalog(data), []);
  stall.serviceAreas = [valid, { ...valid, x: 5, rotationY: Math.PI }];
  assert.deepEqual(validateCatalog(data), []);

  const unchecked = stall as unknown as { serviceAreas: unknown };
  for (const value of [null, {}, 'not an array', 4]) {
    unchecked.serviceAreas = value;
    assert.ok(validateCatalog(data).some((error) => error.includes('invalid service areas')));
  }
  unchecked.serviceAreas = new Array(1);
  assert.ok(
    validateCatalog(data).some((error) => error.includes('serviceAreas[0]: invalid position')),
  );
  for (const value of [
    null,
    undefined,
    {},
    [],
    'not a position',
    { ...valid, x: Infinity },
    { ...valid, z: NaN },
    { ...valid, rotationY: NaN },
    { ...valid, rotationY: '0' },
    { ...valid, width: 0 },
    { ...valid, depth: -1 },
  ]) {
    unchecked.serviceAreas = [valid, value];
    assert.ok(
      validateCatalog(data).some((error) => error.includes('serviceAreas[1]: invalid position')),
    );
  }
  stall.serviceAreas = [
    valid,
    { ...valid, x: floor.width / 2 - 1, width: 6, depth: 6, rotationY: Math.PI / 4 },
  ];
  assert.ok(
    validateCatalog(data).some((error) => error.includes('serviceAreas[1]: outside floor')),
    'Rotated service-area bounds must fit the same floor as the main face',
  );
});
