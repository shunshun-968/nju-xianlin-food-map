import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  NINTH_CANTEEN_FLOOR_ID,
  ninthArea,
  ninthCanteenFaces,
  ninthCanteenStalls,
} from '../src/data/ninth-canteen';
import { getIndoorCanteen, ninthCanteenSpec } from '../src/data/indoor-canteens';
import { validateCatalog } from '../src/domain';
import { createStallPickTargets } from '../src/lib/stall-picking';

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const stallFor = (shopId: string) => {
  const stall = ninthCanteenStalls.find(
    (row) => row.id === `${NINTH_CANTEEN_FLOOR_ID}-${shopId}-w1`,
  );
  assert.ok(stall, `${shopId} has a stable, selectable shop record`);
  return stall;
};
const rayDown = (x: number, z: number) =>
  new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
function dispose(targets: ReturnType<typeof createStallPickTargets>) {
  const materials = new Set<THREE.Material>();
  targets.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      materials.add(object.material as THREE.Material);
    }
  });
  materials.forEach((material) => material.dispose());
}

test('the confirmed third floor contains eleven continuous shops and no separate decorative or return stall', () => {
  assert.equal(NINTH_CANTEEN_FLOOR_ID, 'v-891-f3');
  const floor = catalog.floors.find((row) => row.id === NINTH_CANTEEN_FLOOR_ID)!;
  assert.equal(floor.venueId, 'v-891');
  assert.equal(floor.level, 3);
  assert.equal(floor.name, '第九食堂');
  assert.equal(getIndoorCanteen(floor.id), ninthCanteenSpec);
  assert.equal(ninthCanteenSpec.showWindowNumbers, false);
  const stalls = catalog.stalls.filter((row) => row.floorId === floor.id);
  assert.equal(stalls.length, 11);
  assert.equal(new Set(stalls.map((row) => row.id)).size, 11);
  assert.deepEqual(stalls, ninthCanteenStalls);
  assert.ok(stalls.every((row) => !/tray-return|pizza-hut-wall/.test(row.id)));
  const pizza = ninthCanteenFaces.filter((face) => face.shopId === 'pizza-hut');
  assert.deepEqual(
    new Set(pizza.map((face) => face.role)),
    new Set(['restaurant', 'feature-wall']),
  );
  assert.equal(new Set(pizza.map((face) => face.stallId).filter(Boolean)).size, 1);
  assert.equal(stalls.filter((row) => row.id === stallFor('pizza-hut').id).length, 1);
  assert.deepEqual(validateCatalog(catalog), []);
});

test('the two rows face the dining aisle and retain the photographed spatial order', () => {
  const north = ninthCanteenFaces.filter((face) => face.rotationY === 0).sort((a, b) => a.x - b.x);
  assert.deepEqual(
    north.map((face) => face.name),
    [
      '悦轻荷',
      '辣椒炒肉',
      '雞鳴湯包',
      '項錦記 燒鵝',
      '左左香 · 老潼关肉夹馍',
      '武汉热干面',
      '百味小炒',
    ],
  );
  const south = ninthCanteenFaces
    .filter((face) => face.rotationY === Math.PI)
    .sort((a, b) => a.x - b.x);
  assert.deepEqual(
    south.map((face) => face.name),
    ['必胜客', 'Pizza Hut', 'BURGER KING 汉堡王', '餐具回收区'],
  );
  assert.ok(north.every((face) => face.z < 0 && Math.cos(face.rotationY) > 0.99));
  assert.ok(south.every((face) => face.z > 0 && Math.cos(face.rotationY) < -0.99));
  const west = ninthCanteenFaces
    .filter((face) => face.rotationY === -Math.PI / 2)
    .sort((a, b) => a.z - b.z);
  assert.deepEqual(
    west.map((face) => face.shopId),
    ['seafood-hotpot', 'dongbei', 'yue-qing-he'],
  );
  assert.ok(west.every((face) => Math.sin(face.rotationY) < -0.99));
});

test('the continuous corner shares one shop identity while the recessed shop has a real rear service edge', () => {
  const cornerFaces = ninthCanteenFaces.filter((face) => face.shopId === 'yue-qing-he');
  const corner = stallFor('yue-qing-he');
  assert.equal(cornerFaces.length, 2);
  assert.deepEqual(new Set(cornerFaces.map((face) => face.stallId)), new Set([corner.id]));
  assert.deepEqual(cornerFaces[0].kitchenBounds, cornerFaces[1].kitchenBounds);
  assert.equal(corner.serviceAreas?.length, 1);
  const normals = [corner.position, ...corner.serviceAreas!].map(
    (area) => new THREE.Vector3(Math.sin(area.rotationY), 0, Math.cos(area.rotationY)),
  );
  close(normals[0].dot(normals[1]), 0);

  const recessedFace = ninthCanteenFaces.find((face) => face.shopId === 'roujiamo')!;
  const recessed = stallFor('roujiamo');
  assert.equal(recessedFace.counterInset, 4.4);
  assert.equal(recessedFace.role, 'recessed');
  assert.equal(recessed.serviceAreas?.length, 1);
  const rear = recessed.serviceAreas![0];
  close(recessed.position.z + recessed.position.depth / 2, -2);
  close(rear.z + rear.depth / 2, -6.4);
  close(rear.x, recessed.position.x);
  assert.ok(rear.depth > 0 && rear.depth < recessed.position.depth);
});

test('every primary and additional service area is selectable in plan and 3D', () => {
  const targets = createStallPickTargets(ninthCanteenStalls);
  try {
    for (const stall of ninthCanteenStalls) {
      for (const p of [stall.position, ...(stall.serviceAreas ?? [])]) {
        const normal = new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
        const nearCounter = new THREE.Vector3(p.x, 20, p.z).addScaledVector(
          normal,
          p.depth / 2 - 0.15,
        );
        targets.setMode('plan');
        assert.equal(
          targets.pick(new THREE.Raycaster(nearCounter, new THREE.Vector3(0, -1, 0))),
          stall.id,
        );
        targets.setMode('3d');
        for (const height of [0.1, 1.8, 3.6]) {
          const inFront = new THREE.Vector3(p.x, height, p.z).addScaledVector(
            normal,
            p.depth / 2 + 0.9,
          );
          assert.equal(
            targets.pick(new THREE.Raycaster(inFront, normal.clone().negate())),
            stall.id,
          );
        }
      }
    }
  } finally {
    dispose(targets);
  }
});

test('the roast-goose counter turns along the left while the right passage is not a stall', () => {
  const goose = stallFor('roast-goose');
  const targets = createStallPickTargets(ninthCanteenStalls);
  try {
    targets.setMode('plan');
    for (const [x, z] of [
      [-1.5, -2.15],
      [0.5, -4.5],
      [0.5, -7.5],
    ])
      assert.equal(targets.pick(rayDown(x, z)), goose.id, `One continuous shop at ${x}, ${z}`);
    for (const z of [-2.15, -4.5, -7.5])
      assert.equal(
        targets.pick(rayDown(1.6, z)),
        undefined,
        `The right passage stays open at ${z}`,
      );
    targets.setMode('3d');
    assert.equal(
      targets.pick(
        new THREE.Raycaster(new THREE.Vector3(-1.5, 1.8, -1), new THREE.Vector3(0, 0, -1)),
      ),
      goose.id,
    );
    assert.equal(
      targets.pick(
        new THREE.Raycaster(new THREE.Vector3(1.6, 1.8, -5), new THREE.Vector3(-1, 0, 0)),
      ),
      goose.id,
    );
    assert.equal(
      targets.pick(
        new THREE.Raycaster(new THREE.Vector3(1.6, 1.8, -1), new THREE.Vector3(0, 0, -1)),
      ),
      undefined,
      'Looking into the right-hand passage does not select an invisible full-width counter',
    );
  } finally {
    dispose(targets);
  }
});

test('the main row forms a clean L with straight rear boundaries', () => {
  for (const face of ninthCanteenFaces.filter(
    (face) => face.rotationY === 0 && face.shopId !== 'yue-qing-he',
  )) {
    const area = ninthArea(face);
    close(area.z - area.depth / 2, -10.6);
    close(area.z + area.depth / 2, -2);
  }
  for (const face of ninthCanteenFaces.filter(
    (face) => face.rotationY === -Math.PI / 2 && face.shopId !== 'yue-qing-he',
  )) {
    const area = ninthArea(face);
    close(area.x + area.depth / 2, -12);
    close(area.x - area.depth / 2, -18);
  }
});

test('reordering frontage-driven shop lists does not move selections or split a shared shop', () => {
  // These independent world-space probes exercise the displayed layout, rather than
  // recalculating expected positions with the data-generation formula.
  const probes: [number, number, string | null][] = [
    [-16, -2.2, 'yue-qing-he'],
    [-17.8, -6, 'yue-qing-he'],
    [-9.75, -2.15, 'chili-pork'],
    [-5.25, -2.15, 'jimingtangbao'],
    [-0.25, -2.15, 'roast-goose'],
    [5.25, -6.45, 'roujiamo'],
    [10.25, -2.15, 'hot-dry-noodles'],
    [15, -2.15, 'home-stir-fry'],
    [-17.8, -11, 'dongbei'],
    [-17.8, -16.5, 'seafood-hotpot'],
    [-14, 8.7, 'pizza-hut'],
    [0, 8.7, 'burger-king'],
    [14.5, 8.7, null],
    [5, 3, null],
  ];
  const byId = new Map(ninthCanteenStalls.map((stall) => [stall.id, stall]));
  for (const faces of [ninthCanteenFaces, [...ninthCanteenFaces].reverse()]) {
    const ids = [...new Set(faces.map((face) => face.stallId).filter((id): id is string => !!id))];
    assert.equal(ids.length, 11);
    const targets = createStallPickTargets(ids.map((id) => byId.get(id)!));
    try {
      targets.setMode('plan');
      for (const [x, z, shop] of probes)
        assert.equal(
          targets.pick(rayDown(x, z)),
          shop ? stallFor(shop).id : undefined,
          `${shop ?? 'non-shop'} at ${x}, ${z}`,
        );
    } finally {
      dispose(targets);
    }
  }
});

test('reference links retain valid photo numbers and the photographed traditional lettering', () => {
  for (const face of ninthCanteenFaces) {
    assert.ok(face.sourcePhotoNumbers.length > 0);
    assert.ok(
      face.sourcePhotoNumbers.every(
        (number) => Number.isInteger(number) && number >= 1 && number <= 15,
      ),
    );
    assert.ok(face.sourcePhotoNumbers.includes(face.photoNumber));
  }
  assert.equal(stallFor('jimingtangbao').name, '雞鳴湯包');
  assert.equal(stallFor('roast-goose').name, '項錦記 燒鵝');
  for (const stall of ninthCanteenStalls) {
    assert.equal(stall.photoKey, null);
    assert.deepEqual(stall.dishes, [], 'Reference signs must not invent a verified menu or prices');
  }
});
