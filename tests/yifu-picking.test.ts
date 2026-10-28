import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createYifuKioskPickTargets } from '../src/lib/yifu-kiosk-picking';
import { yifuKioskStall } from '../src/data/yifu-kiosk';

function dispose(targets: ReturnType<typeof createYifuKioskPickTargets>) {
  const materials = new Set<THREE.Material>();
  targets.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
    }
  });
  materials.forEach((material) => material.dispose());
}

function downAt(x: number, z: number, y = 20, far = Infinity) {
  return new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0), 0, far);
}

test('Yifu plan accepts every room grid point including empty aisles, corners and the wall thickness', () => {
  const targets = createYifuKioskPickTargets(yifuKioskStall);
  try {
    targets.setMode('plan');
    // Expected room perimeter comes from the real solid walls, not the narrower catalog counter footprint.
    for (let column = 0; column <= 20; column++) {
      for (let row = 0; row <= 24; row++) {
        const x = -3.08 + (6.16 * column) / 20;
        const z = -3.58 + (7.16 * row) / 24;
        assert.equal(targets.pick(downAt(x, z)), yifuKioskStall.id, `Plan dead spot at ${x}, ${z}`);
      }
    }
    for (const [x, z] of [
      [0, 0],
      [0.5, 1.8],
      [1.3, 3.45],
      [-2.99, 0],
      [2.99, 2],
      [0, -3.49],
      [-0.8, 3.49],
    ])
      assert.equal(targets.pick(downAt(x, z)), yifuKioskStall.id);
    for (const [x, z] of [
      [-3.081, 0],
      [3.081, 0],
      [0, -3.581],
      [0, 3.581],
      [-3.081, -3.581],
      [3.081, 3.581],
    ])
      assert.equal(
        targets.pick(downAt(x, z)),
        undefined,
        `Outside plan point falsely selected at ${x}, ${z}`,
      );
  } finally {
    dispose(targets);
  }
});

test('Yifu 3D accepts the visible floor from above and oblique cameras but leaves air and exterior background clear', () => {
  const targets = createYifuKioskPickTargets(yifuKioskStall);
  try {
    for (const x of [-3.015, -2.9, -0.5, 0, 0.9, 2.9, 3.015])
      for (const z of [-3.515, -2.2, 0, 1.8, 3.515])
        assert.equal(
          targets.pick(downAt(x, z)),
          yifuKioskStall.id,
          `3D floor dead spot at ${x}, ${z}`,
        );
    for (const position of [
      [0, 0.008, 0],
      [0.65, 0.008, 2.5],
      [2.7, 0.008, -3.1],
    ]) {
      const point = new THREE.Vector3(...position);
      const camera = new THREE.Vector3(7, 6, 11);
      assert.equal(
        targets.pick(new THREE.Raycaster(camera, point.sub(camera).normalize())),
        yifuKioskStall.id,
      );
    }
    for (const [x, z] of [
      [3.016, 0],
      [-3.016, 0],
      [0, 3.516],
      [0, -3.516],
      [5, 5],
    ])
      assert.equal(
        targets.pick(downAt(x, z)),
        undefined,
        '3D floor picking does not expand into background',
      );
    for (const y of [0.4, 1.6, 3, 4.2])
      assert.equal(
        targets.pick(new THREE.Raycaster(new THREE.Vector3(0, y, 8), new THREE.Vector3(0, 0, -1))),
        undefined,
        'There is no invisible upright box in front of the room',
      );
    assert.equal(
      targets.pick(new THREE.Raycaster(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 1, 0))),
      undefined,
    );
  } finally {
    dispose(targets);
  }
});

test('Yifu mode switching activates only the correct plane and respects ray distance limits', () => {
  const targets = createYifuKioskPickTargets(yifuKioskStall);
  try {
    const nearPlan = downAt(0, 0, 5, 1);
    const nearFloor = downAt(0, 0, 1, 2);
    for (let cycle = 0; cycle < 6; cycle++) {
      targets.setMode('plan');
      assert.equal(targets.pick(nearPlan), yifuKioskStall.id);
      assert.equal(
        targets.pick(nearFloor),
        undefined,
        'The floor must not remain active behind the overhead face',
      );
      targets.setMode('3d');
      assert.equal(
        targets.pick(nearPlan),
        undefined,
        'The high plan plane must not intercept 3D rays',
      );
      assert.equal(targets.pick(nearFloor), yifuKioskStall.id);
    }
    const nearClipped = downAt(0, 0, 1, 2);
    nearClipped.near = 1.1;
    assert.equal(targets.pick(nearClipped), undefined);
  } finally {
    dispose(targets);
  }
});

test('Yifu hidden groups and ancestors never intercept a click and invisible surfaces cast no shadows', () => {
  const targets = createYifuKioskPickTargets(yifuKioskStall);
  const parent = new THREE.Group();
  parent.add(targets.group);
  try {
    for (const mode of ['plan', '3d'] as const) {
      targets.setMode(mode);
      assert.equal(targets.pick(downAt(0, 0)), yifuKioskStall.id);
      targets.group.visible = false;
      assert.equal(targets.pick(downAt(0, 0)), undefined);
      targets.group.visible = true;
      parent.visible = false;
      assert.equal(targets.pick(downAt(0, 0)), undefined);
      parent.visible = true;
      assert.equal(targets.pick(downAt(0, 0)), yifuKioskStall.id);
    }
    targets.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        assert.equal((object.material as THREE.Material).visible, false);
        assert.equal(object.castShadow, false);
        assert.equal(object.receiveShadow, false);
        assert.equal(object.userData.id, yifuKioskStall.id);
      }
    });
  } finally {
    dispose(targets);
  }
});

test('Yifu room targets follow translated, rotated and scaled model parents', () => {
  const targets = createYifuKioskPickTargets({
    ...yifuKioskStall,
    position: { ...yifuKioskStall.position, x: 8, z: -5, rotationY: Math.PI / 3 },
  });
  const parent = new THREE.Group();
  parent.position.set(-3, 0.4, 2);
  parent.scale.set(1.25, 0.8, 1.1);
  parent.add(targets.group);
  parent.updateMatrixWorld(true);
  try {
    for (const mode of ['plan', '3d'] as const) {
      targets.setMode(mode);
      for (const [x, z] of [
        [0, 0],
        [-2.85, -3.3],
        [2.85, 3.3],
      ]) {
        const origin = targets.group.localToWorld(new THREE.Vector3(x, 20, z));
        const direction = new THREE.Vector3(0, -1, 0).transformDirection(targets.group.matrixWorld);
        assert.equal(targets.pick(new THREE.Raycaster(origin, direction)), yifuKioskStall.id);
      }
      const outside = targets.group.localToWorld(new THREE.Vector3(3.2, 20, 0));
      assert.equal(
        targets.pick(new THREE.Raycaster(outside, new THREE.Vector3(0, -1, 0))),
        undefined,
      );
    }
  } finally {
    dispose(targets);
  }
});
