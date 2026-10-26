import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  FACULTY_CANTEEN_FLOOR_ID,
  FACULTY_LAYOUT,
  facultyCanteenFaces,
  facultyCanteenStalls,
  facultyServiceNotes,
} from '../src/data/faculty-canteen';
import { facultyCanteenSpec, getIndoorCanteen, getIndoorWindow } from '../src/data/indoor-canteens';
import { createCanteenModel } from '../src/components/FourthCanteenModel';
import { createStallPickTargets } from '../src/lib/stall-picking';
import { batchModel } from '../src/lib/model-batches';
import { readNavigation } from '../src/lib/use-app-navigation';
import { validateCatalog } from '../src/domain';

const close = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function byNumber(number: number) {
  const stall = facultyCanteenStalls.find(
    (row) => getIndoorWindow(facultyCanteenSpec, row.id)?.windowNumber === number,
  );
  assert.ok(stall, `Missing faculty window ${number}`);
  return stall;
}
function resources() {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  return {
    remember(root: THREE.Object3D) {
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          materials.add(material);
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.add(value);
        }
      });
    },
    dispose() {
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      textures.forEach((value) => value.dispose());
    },
  };
}

test('faculty route replaces the six demo stalls with seven independent photographed windows', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  const floor = catalog.floors.find((row) => row.id === FACULTY_CANTEEN_FLOOR_ID);
  assert.ok(floor);
  assert.equal(floor.name, '教工食堂');
  assert.equal(floor.venueId, 'v-10');
  assert.equal(floor.level, 2);
  assert.equal(getIndoorCanteen(floor.id), facultyCanteenSpec);
  assert.deepEqual(
    catalog.stalls.filter((row) => row.floorId === floor.id),
    facultyCanteenStalls,
  );
  assert.equal(facultyCanteenStalls.length, 7);
  assert.equal(new Set(facultyCanteenStalls.map((row) => row.id)).size, 7);
  assert.deepEqual(
    facultyCanteenStalls.map((row) => getIndoorWindow(facultyCanteenSpec, row.id)?.windowNumber),
    [1, 2, 3, 4, 5, 6, 7],
  );
  for (let number = 1; number <= 7; number++) {
    const stall = byNumber(number);
    assert.deepEqual(getIndoorWindow(facultyCanteenSpec, stall.id)?.windowNumbers, [number]);
    assert.deepEqual(stall.dishes, [], 'Do not retain demo dishes or invented prices');
    assert.equal(stall.photoKey, null);
    const route = readNavigation(
      new URL(`https://example.test/?floor=${floor.id}&stall=${stall.id}`),
    );
    assert.deepEqual(route.view, { level: 'floor', venueId: 'v-10', floorId: floor.id });
    assert.equal(route.stallId, stall.id);
  }
  assert.equal(byNumber(5).category, '面食／教工下饭菜');
  assert.equal(facultyServiceNotes[5].confirmedTogetherByUser, true);
  assert.ok(facultyServiceNotes[5].offerings.includes('教工下饭菜'));
  assert.equal(getIndoorWindow(facultyCanteenSpec, byNumber(5).id)?.signName, '面坊');
});

test('physical coordinates run 7 to 1 toward the south while sidebar numbering remains ascending', () => {
  const floor = catalog.floors.find((row) => row.id === FACULTY_CANTEEN_FLOOR_ID)!;
  assert.deepEqual(
    [...facultyCanteenFaces].sort((a, b) => a.x - b.x).flatMap((face) => face.windowNumbers),
    [7, 6, 5, 4, 3, 2, 1],
  );
  for (let number = 1; number <= 7; number++) {
    const p = byNumber(number).position;
    close(p.rotationY, 0);
    close(p.z + p.depth / 2, FACULTY_LAYOUT.frontOffset);
    assert.ok(p.x - p.width / 2 >= -floor.width / 2 && p.x + p.width / 2 <= floor.width / 2);
    assert.ok(p.z - p.depth / 2 >= -floor.depth / 2 && p.z + p.depth / 2 <= floor.depth / 2);
    if (number < 7) {
      const north = byNumber(number + 1).position;
      assert.ok(
        north.x + north.width / 2 <= p.x - p.width / 2,
        'Independent counters must not overlap',
      );
    }
  }
  const one = byNumber(1).position,
    two = byNumber(2).position;
  assert.ok(
    one.x - one.width / 2 - (two.x + two.width / 2) > 1,
    'Preserve the passage between 1 and 2',
  );
});

test('full kitchen footprints and facades select their actual windows independently of list order, leaving the passage clear', () => {
  const heights = Object.fromEntries(
    facultyCanteenStalls.map((row) => [row.id, facultyCanteenSpec.facadeHeight!]),
  );
  const one = byNumber(1).position,
    two = byNumber(2).position;
  const passageX = (two.x + two.width / 2 + one.x - one.width / 2) / 2;
  const orders = [facultyCanteenStalls, [4, 1, 7, 3, 6, 2, 5].map(byNumber)];
  for (const stalls of orders) {
    const targets = createStallPickTargets(stalls, heights);
    const allocated = resources();
    allocated.remember(targets.group);
    try {
      for (const stall of facultyCanteenStalls) {
        const p = stall.position;
        for (const offset of [-0.47, 0, 0.47]) {
          const x = p.x + p.width * offset;
          targets.setMode('plan');
          for (const depth of [-0.44, 0, 0.44])
            assert.equal(
              targets.pick(
                new THREE.Raycaster(
                  new THREE.Vector3(x, 20, p.z + p.depth * depth),
                  new THREE.Vector3(0, -1, 0),
                ),
              ),
              stall.id,
            );
          targets.setMode('3d');
          for (const y of [0.05, 1.6, facultyCanteenSpec.facadeHeight! - 0.05])
            assert.equal(
              targets.pick(
                new THREE.Raycaster(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1)),
              ),
              stall.id,
            );
        }
      }
      targets.setMode('plan');
      for (const z of [-3.8, -1.6, 0.8])
        assert.equal(
          targets.pick(
            new THREE.Raycaster(new THREE.Vector3(passageX, 20, z), new THREE.Vector3(0, -1, 0)),
          ),
          undefined,
          'The passage is not an eighth window',
        );
      assert.equal(
        targets.pick(
          new THREE.Raycaster(new THREE.Vector3(two.x, 20, 3), new THREE.Vector3(0, -1, 0)),
        ),
        undefined,
        'The dining aisle is not a window',
      );
      targets.setMode('3d');
      for (const y of [0.05, 1.6, facultyCanteenSpec.facadeHeight! - 0.05])
        assert.equal(
          targets.pick(
            new THREE.Raycaster(new THREE.Vector3(passageX, y, 3), new THREE.Vector3(0, 0, -1)),
          ),
          undefined,
        );
    } finally {
      allocated.dispose();
    }
  }
});

test('the shared model factory preserves faculty visibility, window identities and geometry through batching', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        const context = new Proxy<Record<string, unknown>>(
          {},
          {
            get(target, key) {
              if (Reflect.has(target, key)) return Reflect.get(target, key);
              if (key === 'createLinearGradient' || key === 'createRadialGradient')
                return () => ({ addColorStop() {} });
              if (key === 'measureText') return (text: string) => ({ width: text.length * 32 });
              if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
              return () => {};
            },
          },
        );
        return { width: 0, height: 0, getContext: () => context };
      },
    },
  });
  const allocated = resources();
  try {
    const model = createCanteenModel(facultyCanteenSpec),
      root = model.group;
    allocated.remember(root);
    root.updateMatrixWorld(true);
    for (const number of [2, 3, 4]) {
      const room = root.getObjectByName(`faculty-window-${number}`)!;
      const pans: THREE.Object3D[] = [],
        markers: THREE.Object3D[] = [];
      const lamps: THREE.PointLight[] = [];
      room.traverse((node) => {
        if (node.name === 'faculty-food-pan') pans.push(node);
        if (node.name === 'faculty-dish-marker') markers.push(node);
        if (node instanceof THREE.PointLight) lamps.push(node);
      });
      assert.equal(pans.length, number === 2 ? 8 : 10, 'Keep every photographed serving tray');
      const counter = new THREE.Box3().setFromObject(
        root.getObjectByName(`faculty-counter-top-${number}`)!,
      );
      const panBounds = pans.map((pan) => new THREE.Box3().setFromObject(pan));
      for (const [index, bounds] of panBounds.entries()) {
        const size = bounds.getSize(new THREE.Vector3());
        assert.ok(
          size.z > size.x * 1.3,
          'The long side of each rotated pan points toward/away from the customer',
        );
        assert.ok(bounds.min.x >= counter.min.x && bounds.max.x <= counter.max.x);
        assert.ok(
          bounds.min.z >= counter.min.z && bounds.max.z <= counter.max.z,
          'Both rows are supported by the counter',
        );
        for (const other of panBounds.slice(index + 1))
          assert.ok(
            bounds.max.x < other.min.x ||
              other.max.x < bounds.min.x ||
              bounds.max.z < other.min.z ||
              other.max.z < bounds.min.z,
            'Rotating a tray must not overlap the adjacent row or column',
          );
      }
      assert.equal(markers.length, pans.length);
      for (const marker of markers) {
        const size = new THREE.Box3().setFromObject(marker).getSize(new THREE.Vector3());
        assert.ok(
          size.x > size.z * 5,
          'Red dish markers still face the customer after the trays turn',
        );
      }
      const irradiance = (
        point: THREE.Vector3,
        position: THREE.Vector3,
        intensity: number,
        cutoff: number,
      ) => {
        const distance = point.distanceTo(position);
        return (
          (intensity *
            Math.max(0, (position.y - point.y) / distance) *
            Math.max(0, 1 - (distance / cutoff) ** 4) ** 2) /
          (distance * distance)
        );
      };
      const oldPosition = room.localToWorld(new THREE.Vector3(0, 2.65, -0.65));
      let previousIllumination = 0,
        warmIllumination = 0;
      for (const bounds of panBounds) {
        const surface = bounds.getCenter(new THREE.Vector3());
        surface.y = bounds.max.y;
        previousIllumination += irradiance(surface, oldPosition, 12, 6);
        for (const light of lamps) {
          assert.ok(
            light.color.r > light.color.g && light.color.g > light.color.b,
            'Serving light must be warm yellow',
          );
          warmIllumination += irradiance(
            surface,
            light.getWorldPosition(new THREE.Vector3()),
            light.intensity,
            light.distance,
          );
        }
      }
      assert.ok(
        warmIllumination > previousIllumination * 1.5,
        'The lights visibly illuminate the food instead of only glowing themselves',
      );
      const lampState = lamps.map((lamp) => [lamp.intensity, lamp.color.getHex()]);
      model.setInterfaceTheme(true);
      model.setInterfaceTheme(false);
      assert.deepEqual(
        lamps.map((lamp) => [lamp.intensity, lamp.color.getHex()]),
        lampState,
        'Interface themes retain the warm serving lamps',
      );
    }
    const plan = root.getObjectByName('plan-labels');
    assert.ok(plan?.visible, 'A newly created faculty model starts in plan view');
    const overhead: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.planHide) overhead.push(node);
    });
    assert.ok(overhead.length > 0);
    const expectedIds = facultyCanteenStalls.map((row) => row.id).sort();
    const snapshot = () => {
      let triangles = 0;
      const ids = new Set<string>();
      const lights: number[] = [];
      root.traverseVisible((node) => {
        if (node instanceof THREE.Light) {
          assert.ok(Number.isFinite(node.intensity) && node.intensity > 0);
          lights.push(node.intensity);
        }
        if (!(node instanceof THREE.Mesh)) return;
        const positions = node.geometry.getAttribute('position');
        assert.ok(Array.from(positions.array).every(Number.isFinite));
        triangles +=
          ((node.geometry.index?.count ?? positions.count) / 3) *
          (node instanceof THREE.InstancedMesh ? node.count : 1);
        if (node.userData.kind === 'stall') ids.add(node.userData.id);
      });
      assert.deepEqual([...ids].sort(), expectedIds);
      assert.ok(lights.length >= 7, 'Every numbered service area keeps its warm lighting');
      return { triangles, ids: [...ids].sort(), lights: lights.sort((a, b) => a - b) };
    };
    const before = new Map<string, ReturnType<typeof snapshot>>();
    for (const mode of ['plan', '3d'] as const) {
      model.setMode(mode);
      assert.equal(plan.visible, mode === 'plan');
      assert.ok(overhead.every((node) => node.visible === (mode === '3d')));
      before.set(mode, snapshot());
    }
    const bounds = new THREE.Box3().setFromObject(root);
    let meshCountBefore = 0;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) meshCountBefore++;
    });
    batchModel(root);
    allocated.remember(root);
    let meshCountAfter = 0;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) meshCountAfter++;
    });
    assert.ok(meshCountAfter < meshCountBefore, 'Static batching reduces draw objects');
    const afterBounds = new THREE.Box3().setFromObject(root);
    for (const axis of ['x', 'y', 'z'] as const) {
      close(afterBounds.min[axis], bounds.min[axis], 1e-4);
      close(afterBounds.max[axis], bounds.max[axis], 1e-4);
    }
    for (const mode of ['plan', '3d'] as const) {
      model.setMode(mode);
      assert.equal(plan.visible, mode === 'plan');
      assert.ok(overhead.every((node) => node.visible === (mode === '3d')));
      assert.deepEqual(snapshot(), before.get(mode));
    }
  } finally {
    allocated.dispose();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
