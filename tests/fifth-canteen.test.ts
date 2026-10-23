import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  FIFTH_CANTEEN_FLOOR_ID,
  FIFTH_LAYOUT,
  fifthCanteenFaces,
  fifthCanteenStalls,
  type FifthCanteenFace,
} from '../src/data/fifth-canteen';
import { fourthKitchenBounds } from '../src/data/fourth-canteen';
import { validateCatalog } from '../src/domain';
import { fifthCanteenSpec } from '../src/data/indoor-canteens';
import {
  createCanteenModel,
  createFourthCanteenModel,
  FOURTH_HEIGHTS,
} from '../src/components/FourthCanteenModel';

const close = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
const windowsFor = (face: FifthCanteenFace) =>
  fifthCanteenStalls.filter((stall) => stall.id.startsWith(`${face.faceId}-w`));

test('fifth canteen has eight sign frontages, seven shops, and every actual number from 1 to 21 once', () => {
  assert.equal(fifthCanteenFaces.length, 8);
  assert.equal(new Set(fifthCanteenFaces.map((face) => face.shopId)).size, 7);
  assert.equal(fifthCanteenStalls.length, 21);
  assert.equal(new Set(fifthCanteenFaces.map((face) => face.faceId)).size, 8);
  assert.equal(new Set(fifthCanteenStalls.map((stall) => stall.id)).size, 21);
  const numbers = fifthCanteenFaces.flatMap((face) => face.windowNumbers);
  assert.deepEqual(
    [...numbers].sort((a, b) => a - b),
    Array.from({ length: 21 }, (_, i) => i + 1),
  );
  for (const face of fifthCanteenFaces) {
    assert.equal(face.id, face.faceId);
    assert.equal(face.windowCount, face.windowNumbers.length);
    assert.equal(face.width, face.windowCount * 1.75);
    const stalls = windowsFor(face);
    assert.equal(stalls.length, face.windowCount);
    assert.deepEqual(
      stalls.map((stall) => stall.id),
      face.windowNumbers.map((_, index) => `${face.faceId}-w${index + 1}`),
    );
    assert.deepEqual(
      stalls.map((stall) => stall.name),
      face.windowNumbers.map((number) => `${face.name} · ${number}号窗口`),
    );
  }
});

test('the long frontage follows the photographed six-sign sequence and actual descending window numbers', () => {
  const main = fifthCanteenFaces.filter((face) => face.rotationY === 0).sort((a, b) => a.x - b.x);
  assert.deepEqual(
    main.map((face) => face.name),
    ['南粥北面', '味道作坊', '巧厨天地', '香積八方', '家常味道', '石城滋味'],
  );
  assert.deepEqual(
    main.map((face) => face.windowNumbers),
    [
      [16, 15],
      [14, 13],
      [12, 11],
      [10, 9, 8, 7],
      [6, 5, 4, 3],
      [2, 1],
    ],
  );
  assert.deepEqual(
    main.map((face) => face.photoNumber),
    [5, 5, 4, 3, 2, 1],
  );
  close(main[0].x - main[0].width / 2, -17.5, 'Long frontage starts at the convex corner');
  close(main.at(-1)!.x + main.at(-1)!.width / 2, 10.5, 'Sixteen windows occupy 28 units');
  for (const face of main) {
    close(face.z, 6.3, 'Shared main frontage Z');
    const bounds = fourthKitchenBounds(face);
    close(bounds.minZ, 3.8, 'Kitchen rear edge');
    close(bounds.maxZ, 7.3, 'Kitchen front edge');
    const stalls = windowsFor(face);
    assert.ok(
      stalls.every(
        (stall, index) => index === 0 || stalls[index - 1].position.x < stall.position.x,
      ),
    );
  }
  for (let index = 1; index < main.length; index++) {
    close(
      main[index - 1].x + main[index - 1].width / 2,
      main[index].x - main[index].width / 2,
      'Adjacent shops share an edge',
    );
  }
});

test('the short frontage extends up from the corner with 17–21 in spatial order and no gaps', () => {
  const side = fifthCanteenFaces
    .filter((face) => face.rotationY === -Math.PI / 2)
    .sort((a, b) => b.z - a.z);
  assert.deepEqual(
    side.map((face) => face.name),
    ['手工·水饺', '五味杂陈'],
  );
  assert.deepEqual(
    side.map((face) => face.windowNumbers),
    [
      [18, 17],
      [21, 20, 19],
    ],
  );
  assert.deepEqual(
    side.map((face) => face.photoNumber),
    [7, 8],
  );
  close(side[0].z, 5.55, 'Shared-corner side center');
  close(side[1].z, 1.175, 'Three-window side center');
  close(
    side[0].z - side[0].width / 2,
    side[1].z + side[1].width / 2,
    'Short-side shops meet at Z=3.8',
  );
  const spatialWindows = side.flatMap(windowsFor).sort((a, b) => b.position.z - a.position.z);
  assert.deepEqual(
    spatialWindows.map((stall) => Number(stall.name.match(/(\d+)号窗口$/)![1])),
    [17, 18, 19, 20, 21],
  );
  for (const face of side) {
    close(face.x, -16.5, 'Side-face origin');
    const bounds = fourthKitchenBounds(face);
    close(bounds.minX, -17.5, 'Outward-facing service plane');
    close(bounds.maxX, -14, 'Kitchen extends inward toward +X');
  }
});

test('南粥北面 and 手工·水饺 provide two plus two windows around one shared corner kitchen', () => {
  const cornerFaces = fifthCanteenFaces.filter((face) => face.shopId === 'nanzhou-shuijiao');
  assert.equal(cornerFaces.length, 2);
  assert.deepEqual(
    cornerFaces.map((face) => face.windowCount),
    [2, 2],
  );
  const expected = { minX: -17.5, maxX: -14, minZ: 3.8, maxZ: 7.3 };
  for (const face of cornerFaces) {
    const actual = fourthKitchenBounds(face);
    for (const key of ['minX', 'maxX', 'minZ', 'maxZ'] as const)
      close(actual[key], expected[key], `${face.name} shared ${key}`);
  }
  assert.equal(new Set(cornerFaces.flatMap(windowsFor).map((stall) => stall.id)).size, 4);
  assert.deepEqual(FIFTH_LAYOUT.corner, { x: expected.minX, z: expected.maxZ });
  const shops = new Map<string, number>();
  for (const face of fifthCanteenFaces) shops.set(face.shopId, (shops.get(face.shopId) ?? 0) + 1);
  for (const [shop, count] of shops) assert.equal(count, shop === 'nanzhou-shuijiao' ? 2 : 1);
});

test('fifth canteen replaces its catalog demo floor and every thick window footprint stays inside it', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  const floor = catalog.floors.find((row) => row.id === FIFTH_CANTEEN_FLOOR_ID);
  assert.ok(floor);
  assert.equal(floor.venueId, 'v-456');
  assert.equal(floor.level, 2);
  assert.equal(floor.name, '第五食堂');
  assert.equal(floor.width, 44);
  assert.equal(floor.depth, 22);
  assert.equal(floor.layoutVersion, 2);
  assert.deepEqual(
    catalog.stalls.filter((stall) => stall.floorId === floor.id),
    fifthCanteenStalls,
  );
  for (const face of fifthCanteenFaces) {
    const kitchen = fourthKitchenBounds(face);
    assert.ok(kitchen.minX >= -floor.width / 2 && kitchen.maxX <= floor.width / 2);
    assert.ok(kitchen.minZ >= -floor.depth / 2 && kitchen.maxZ <= floor.depth / 2);
    const bounds = windowsFor(face).map(({ position: p }) => {
      assert.equal(p.width, 1.75);
      assert.equal(p.depth, 3.5);
      const halfX =
        (p.width * Math.abs(Math.cos(p.rotationY)) + p.depth * Math.abs(Math.sin(p.rotationY))) / 2;
      const halfZ =
        (p.width * Math.abs(Math.sin(p.rotationY)) + p.depth * Math.abs(Math.cos(p.rotationY))) / 2;
      assert.ok(p.x - halfX >= -floor.width / 2 && p.x + halfX <= floor.width / 2);
      assert.ok(p.z - halfZ >= -floor.depth / 2 && p.z + halfZ <= floor.depth / 2);
      return { minX: p.x - halfX, maxX: p.x + halfX, minZ: p.z - halfZ, maxZ: p.z + halfZ };
    });
    close(Math.min(...bounds.map((b) => b.minX)), kitchen.minX, `${face.name} left bound`);
    close(Math.max(...bounds.map((b) => b.maxX)), kitchen.maxX, `${face.name} right bound`);
    close(Math.min(...bounds.map((b) => b.minZ)), kitchen.minZ, `${face.name} upper bound`);
    close(Math.max(...bounds.map((b) => b.maxZ)), kitchen.maxZ, `${face.name} lower bound`);
  }
});

test('fifth-canteen records expose no source-photo URL and invent no menu or prices', () => {
  for (const stall of fifthCanteenStalls) {
    assert.equal(stall.photoKey, null);
    assert.deepEqual(stall.dishes, []);
  }
});

test('the actual fifth-canteen scene preserves its shared kitchens and service geometry across view and UI modes', async (t) => {
  // Raster drawing alone is stubbed; geometry, world transforms, lights and visibility are real Three.js.
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        const context = { fillRect() {}, fillText() {}, strokeRect() {} };
        return {
          width: 0,
          height: 0,
          getContext(kind: string) {
            assert.equal(kind, '2d');
            return context;
          },
        };
      },
    },
  });
  const models: ReturnType<typeof createCanteenModel>[] = [];
  try {
    const model = createCanteenModel(fifthCanteenSpec);
    models.push(model);
    const { group } = model;
    const spatial = group.getObjectByName('spatial-frontages');
    const plan = group.getObjectByName('plan-labels');
    assert.ok(spatial && plan);
    group.updateMatrixWorld(true);
    const collect = (predicate: (object: THREE.Object3D) => boolean) => {
      const result: THREE.Object3D[] = [];
      spatial.traverse((object) => {
        if (predicate(object)) result.push(object);
      });
      return result;
    };
    const windows = collect((object) => object.name.startsWith('window-'));
    const kitchens = collect((object) => object.name.startsWith('kitchen-'));
    const ceilings = collect((object) => object.name.startsWith('ceiling-'));

    await t.test(
      '21 real openings occupy seven kitchens, with only one room at the two-plus-two corner',
      () => {
        assert.equal(windows.length, 21);
        assert.deepEqual(
          windows.map((window) => window.name).sort(),
          fifthCanteenStalls.map((stall) => `window-${stall.id}`).sort(),
        );
        assert.equal(kitchens.length, 7);
        assert.equal(new Set(kitchens.map((kitchen) => kitchen.userData.shopId)).size, 7);
        const corner = kitchens.filter((kitchen) => kitchen.userData.shopId === 'nanzhou-shuijiao');
        assert.equal(corner.length, 1);
        assert.deepEqual(corner[0].userData.bounds, {
          minX: -17.5,
          maxX: -14,
          minZ: 3.8,
          maxZ: 7.3,
        });
        for (const kitchen of kitchens) {
          const expected = kitchen.userData.bounds as ReturnType<typeof fourthKitchenBounds>;
          const actual = new THREE.Box3().setFromObject(kitchen);
          assert.ok(kitchen.children.some((child) => child instanceof THREE.Mesh));
          assert.ok(actual.min.x <= expected.minX && actual.max.x >= expected.maxX);
          assert.ok(actual.min.z <= expected.minZ && actual.max.z >= expected.maxZ);
          assert.ok(actual.min.x >= expected.minX - 0.08 && actual.max.x <= expected.maxX + 0.08);
          assert.ok(actual.min.z >= expected.minZ - 0.08 && actual.max.z <= expected.maxZ + 0.08);
        }
        const cornerFaces = fifthCanteenFaces.filter((face) => face.shopId === 'nanzhou-shuijiao');
        assert.deepEqual(
          cornerFaces.map(
            (face) =>
              spatial
                .getObjectByName(face.faceId)!
                .children.filter((child) => child.name.startsWith('window-')).length,
          ),
          [2, 2],
        );
      },
    );

    await t.test('all actual openings and counter edges face outward toward +Z or -X', () => {
      const pickIds = new Set<string>();
      spatial.traverse((object) => {
        if (object.userData.kind === 'stall') pickIds.add(object.userData.id);
      });
      assert.deepEqual([...pickIds].sort(), fifthCanteenStalls.map((stall) => stall.id).sort());
      for (const face of fifthCanteenFaces) {
        const frontage = spatial.getObjectByName(face.faceId);
        assert.ok(frontage);
        const openings = frontage.children.filter((child) => child.name.startsWith('window-'));
        assert.equal(openings.length, face.windowCount);
        const kitchen = fourthKitchenBounds(face);
        for (const [index, opening] of openings.entries()) {
          const normal = new THREE.Vector3(0, 0, 1).transformDirection(opening.matrixWorld);
          close(normal.x, Math.sin(face.rotationY), `${opening.name} outward X`);
          close(normal.z, Math.cos(face.rotationY), `${opening.name} outward Z`);
          close(normal.y, 0, `${opening.name} horizontal normal`);
          assert.ok(normal.z > 0.99 || normal.x < -0.99);
          const selection = opening.children.find((child) => child.userData.baseColor);
          assert.ok(selection);
          assert.equal(selection.userData.id, `${face.faceId}-w${index + 1}`);
          const surface = selection.getWorldPosition(new THREE.Vector3());
          assert.ok(
            (surface.x - face.x) * normal.x + (surface.z - face.z) * normal.z >=
              FIFTH_LAYOUT.frontOffset,
            `${opening.name} selection surface lies on the exterior`,
          );
          const counter = opening.children.find(
            (child) =>
              child instanceof THREE.Mesh &&
              Math.abs(child.position.y - FOURTH_HEIGHTS.counter) < 1e-8,
          );
          assert.ok(counter, `${opening.name} has a physical counter`);
          const bounds = new THREE.Box3().setFromObject(counter);
          if (normal.z > 0.99) assert.ok(bounds.max.z > kitchen.maxZ);
          else assert.ok(bounds.min.x < kitchen.minX);
        }
      }
    });

    await t.test(
      'plan view hides only the seven ceilings while keeping staff and service counters, and 3D restores them',
      () => {
        assert.equal(ceilings.length, 7);
        const planHidden = collect((object) => Boolean(object.userData.planHide));
        assert.deepEqual(
          planHidden.map((object) => object.uuid).sort(),
          ceilings.map((object) => object.uuid).sort(),
        );
        const people = collect((object) => object.name.startsWith('canteen-staff-'));
        const details = collect((object) => object.name.startsWith('counter-details-'));
        assert.ok(
          people.length > 0 && details.length > 0,
          'The actual scene contains people and counter equipment',
        );
        const retained = [...people, ...details, ...windows];
        const effectivelyVisible = (object: THREE.Object3D) => {
          for (let current: THREE.Object3D | null = object; current; current = current.parent)
            if (!current.visible) return false;
          return true;
        };
        const visibleMeshes = (object: THREE.Object3D) => {
          const ids: string[] = [];
          object.traverseVisible((child) => {
            if (child instanceof THREE.Mesh) ids.push(child.uuid);
          });
          return ids;
        };
        model.setMode('3d');
        const before = retained.map(visibleMeshes);
        assert.ok(before.every((meshes) => meshes.length > 0));
        model.setMode('plan');
        assert.ok(plan.visible && spatial.visible);
        assert.ok(ceilings.every((ceiling) => !effectivelyVisible(ceiling)));
        assert.ok(retained.every(effectivelyVisible));
        assert.deepEqual(retained.map(visibleMeshes), before);
        model.setMode('3d');
        assert.ok(!plan.visible && spatial.visible);
        assert.ok(ceilings.every(effectivelyVisible));
        assert.ok(retained.every(effectivelyVisible));
        assert.deepEqual(retained.map(visibleMeshes), before);
      },
    );

    await t.test(
      'day/night interface changes preserve geometry, transforms, visibility and indoor light intensity in both views',
      () => {
        // A structural comparison only: no colors, texture pixels, styling or fixed visual snapshot.
        const structure = () => {
          const result: unknown[] = [];
          group.traverse((object) =>
            result.push({
              uuid: object.uuid,
              parent: object.parent?.uuid,
              geometry: object instanceof THREE.Mesh ? object.geometry.uuid : undefined,
              position: object.position.toArray(),
              quaternion: object.quaternion.toArray(),
              scale: object.scale.toArray(),
              visible: object.visible,
              intensity: object instanceof THREE.Light ? object.intensity : undefined,
            }),
          );
          return result;
        };
        const lights = collect((object) => object instanceof THREE.Light);
        assert.ok(
          lights.length > 0,
          'Indoor lighting is present, making the intensity check meaningful',
        );
        for (const mode of ['3d', 'plan'] as const) {
          model.setMode(mode);
          const before = structure();
          model.setInterfaceTheme(true);
          assert.deepEqual(structure(), before, `${mode}: night UI preserves the indoor scene`);
          model.setInterfaceTheme(false);
          assert.deepEqual(structure(), before, `${mode}: day UI preserves the indoor scene`);
        }
      },
    );

    await t.test(
      'the shared factory still builds the fourth canteen with its original 24 service openings',
      () => {
        const fourth = createFourthCanteenModel();
        models.push(fourth);
        const openings: THREE.Object3D[] = [];
        fourth.group.traverse((object) => {
          if (object.name.startsWith('window-')) openings.push(object);
        });
        assert.equal(openings.length, 24);
        assert.equal(new Set(openings.map((opening) => opening.name)).size, 24);
      },
    );
  } finally {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const model of models)
      model.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
      });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map);
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
