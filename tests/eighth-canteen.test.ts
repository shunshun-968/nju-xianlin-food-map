import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  EIGHTH_CANTEEN_FLOOR_ID,
  eighthCanteenFaces,
  eighthCanteenStalls,
  eighthDumplingKiosk,
  getEighthWindow,
} from '../src/data/eighth-canteen';
import { eighthCanteenSpec, getIndoorCanteen } from '../src/data/indoor-canteens';
import { validateCatalog } from '../src/domain';
import { createStallPickTargets } from '../src/lib/stall-picking';
import { navigationPath, readNavigation } from '../src/lib/use-app-navigation';
import { createCanteenModel } from '../src/components/FourthCanteenModel';
import { batchModel } from '../src/lib/model-batches';

const byNumber = (number: number) => {
  const stall = eighthCanteenStalls.find((row) => getEighthWindow(row.id)?.windowNumber === number);
  assert.ok(stall, `Missing actual window ${number}`);
  return stall;
};

function dispose(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

test('eighth-canteen records preserve real numbers, confirmed operating groups and unknown or inactive windows', () => {
  assert.equal(eighthCanteenFaces.length, 7);
  assert.equal(eighthCanteenStalls.length, 15);
  assert.equal(new Set(eighthCanteenStalls.map((row) => row.id)).size, 15);
  assert.deepEqual(
    eighthCanteenFaces.flatMap((face) => face.windowNumbers).sort((a, b) => a - b),
    Array.from({ length: 14 }, (_, i) => i + 1),
  );
  for (const [numbers, offering] of [
    [[1, 2], '减脂餐'],
    [[4, 5, 6, 7], '自选菜'],
    [[8], '吊梨汤'],
    [[9], '鸡排饭·牛排饭'],
    [[10, 11], '面食'],
    [[13, 14], '椰子鸡'],
  ] as const) {
    const windows = numbers.map((number) => getEighthWindow(byNumber(number).id)!);
    assert.ok(windows.every((window) => window.offering === offering));
    assert.equal(new Set(windows.map((window) => window.shopId)).size, 1);
    const group = windows[0].shopId;
    assert.deepEqual(
      eighthCanteenStalls
        .flatMap((stall) => {
          const window = getEighthWindow(stall.id);
          return window?.shopId === group ? [window.windowNumber] : [];
        })
        .sort((a, b) => a - b),
      [...numbers],
      'A merged operating group cannot accidentally include a neighboring window',
    );
  }
  assert.equal(byNumber(3).name, '3号窗口');
  assert.equal(byNumber(3).category, '待补充');
  assert.equal(byNumber(12).category, '暂无售卖');
  assert.equal(getEighthWindow(byNumber(1).id)!.face.name, '卤水');
  assert.equal(getEighthWindow(byNumber(13).id)!.face.name, '美食');
  assert.notEqual(
    getEighthWindow(byNumber(11).id)!.shopId,
    getEighthWindow(byNumber(13).id)!.shopId,
  );
  assert.equal(getEighthWindow(eighthDumplingKiosk.id), undefined);
  for (const stall of eighthCanteenStalls) {
    assert.equal(stall.photoKey, null);
    assert.deepEqual(stall.dishes, [], `${stall.name} must not inherit a fabricated demo menu`);
  }
});

test('the north-up spatial mapping keeps 1–12 west-to-east, 13–14 south-to-north and the freezer separate', () => {
  const main = Array.from({ length: 12 }, (_, index) => byNumber(index + 1));
  for (const [index, stall] of main.entries()) {
    assert.equal(stall.position.rotationY, 0);
    assert.ok(Math.abs(stall.position.z + stall.position.depth / 2 - 4) < 1e-8);
    if (index > 0) assert.ok(main[index - 1].position.x < stall.position.x);
  }
  const side = [byNumber(13), byNumber(14)];
  assert.ok(side[0].position.z > side[1].position.z, '14 lies north of 13');
  for (const stall of side) {
    assert.equal(stall.position.rotationY, Math.PI / 2);
    assert.ok(Math.abs(stall.position.x + stall.position.depth / 2 - 12) < 1e-8);
  }
  const freezer = eighthCanteenStalls.find((stall) => stall.id === eighthDumplingKiosk.id)!;
  assert.equal(freezer.name, '水饺超市');
  assert.equal(freezer.position.rotationY, Math.PI / 2);
  assert.ok(
    freezer.position.z - freezer.position.width / 2 > 4,
    'Rotated freezer leaves a corridor gap',
  );
  assert.ok(freezer.position.x > byNumber(9).position.x, 'Freezer sits near the east corner');
});

test('the registered eighth-canteen route resolves its real catalog instead of the old six demo stalls', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  const floor = catalog.floors.find((row) => row.id === EIGHTH_CANTEEN_FLOOR_ID);
  assert.ok(floor);
  assert.equal(floor.name, '第八食堂');
  assert.equal(floor.venueId, 'v-891');
  assert.equal(getIndoorCanteen(floor.id), eighthCanteenSpec);
  assert.deepEqual(
    catalog.stalls.filter((stall) => stall.floorId === floor.id),
    eighthCanteenStalls,
  );
  for (const stall of [byNumber(3), byNumber(12), eighthCanteenStalls.at(-1)!]) {
    const state = readNavigation(
      new URL(`https://example.test/map/?floor=${floor.id}&stall=${stall.id}`),
    );
    assert.deepEqual(state.view, { level: 'floor', floorId: floor.id, venueId: floor.venueId });
    assert.equal(state.stallId, stall.id);
    assert.deepEqual(
      navigationPath(state).map((step) => step.view.level),
      ['campus', 'building', 'floor', 'floor'],
    );
  }
});

test('every eighth-canteen service edge and the separate freezer are pickable in plan and 3D regardless of record order', () => {
  for (const stalls of [eighthCanteenStalls, [...eighthCanteenStalls].reverse()]) {
    const targets = createStallPickTargets(stalls, { [eighthDumplingKiosk.id]: 1.3 });
    try {
      for (const stall of eighthCanteenStalls) {
        const p = stall.position;
        const normal = new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
        targets.setMode('plan');
        const overhead = new THREE.Vector3(p.x, 20, p.z).addScaledVector(
          normal,
          p.depth / 2 - 0.15,
        );
        assert.equal(
          targets.pick(new THREE.Raycaster(overhead, new THREE.Vector3(0, -1, 0))),
          stall.id,
          `${stall.name}: plan chooses this service edge, including shared-corner kitchens`,
        );
        targets.setMode('3d');
        const front = new THREE.Vector3(
          p.x,
          stall.id === eighthDumplingKiosk.id ? 0.8 : 1.6,
          p.z,
        ).addScaledVector(normal, p.depth / 2 + 1.5);
        assert.equal(
          targets.pick(new THREE.Raycaster(front, normal.clone().negate())),
          stall.id,
          `${stall.name}: frontage stays selectable even without food`,
        );
      }
      assert.equal(
        targets.pick(new THREE.Raycaster(new THREE.Vector3(9, 2, 10), new THREE.Vector3(0, 0, -1))),
        byNumber(11).id,
        'Air above the low freezer does not steal clicks from the numbered window behind it',
      );
    } finally {
      dispose(targets.group);
    }
  }
});

test('the actual eighth-canteen model retains real windows, an independent freezer and reveal-roof behavior after batching', () => {
  // Only canvas raster drawing is stubbed; the real factory, transforms and meshes are exercised.
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        return {
          width: 0,
          height: 0,
          getContext() {
            return { fillRect() {}, fillText() {}, strokeRect() {} };
          },
        };
      },
    },
  });
  let model: ReturnType<typeof createCanteenModel> | undefined;
  try {
    model = createCanteenModel(eighthCanteenSpec);
    const { group } = model;
    group.updateMatrixWorld(true);
    const plan = group.getObjectByName('plan-labels');
    const spatial = group.getObjectByName('spatial-frontages');
    assert.ok(plan && spatial);
    const windows: THREE.Object3D[] = [];
    const roofs: THREE.Object3D[] = [];
    group.traverse((object) => {
      if (object.name.startsWith('window-')) windows.push(object);
      if (object.userData.planHide) roofs.push(object);
    });
    const numberedStalls = eighthCanteenStalls.filter((stall) => getEighthWindow(stall.id));
    assert.deepEqual(
      windows.map((window) => window.name).sort(),
      numberedStalls.map((stall) => `window-${stall.id}`).sort(),
    );
    assert.ok(roofs.length > 0);
    assert.ok(plan.visible && spatial.visible && roofs.every((roof) => !roof.visible));
    const freezer = group.getObjectByName('eighth-dumpling-kiosk');
    assert.ok(freezer);
    assert.equal(freezer.userData.id, eighthDumplingKiosk.id);
    assert.ok(freezer.position.z > 4, 'The actual freezer stands outside the long service row');
    const selectionMaterials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.baseColor) {
        assert.ok(!Array.isArray(object.material));
        selectionMaterials.add(object.material);
      }
    });
    assert.equal(
      selectionMaterials.size,
      15,
      'Each selection highlight has an independent material',
    );
    for (const stall of numberedStalls) {
      const window = group.getObjectByName(`window-${stall.id}`)!;
      const details: THREE.Object3D[] = [];
      const staff: THREE.Object3D[] = [];
      const meshes: THREE.Mesh[] = [];
      window.traverse((object) => {
        if (object.name.startsWith('counter-details-')) details.push(object);
        if (object.name.startsWith('canteen-staff-')) staff.push(object);
        if (object instanceof THREE.Mesh) meshes.push(object);
      });
      assert.ok(
        meshes.length > 0,
        `${stall.name} is physical geometry, including the empty window`,
      );
      assert.ok(meshes.every((mesh) => mesh.userData.id === stall.id));
      const actual = getEighthWindow(stall.id)!;
      if (actual.windowNumber === 3 || actual.windowNumber === 12) {
        assert.equal(details.length, 0, `${stall.name} must not gain fabricated food`);
        assert.equal(
          staff.length,
          0,
          `${stall.name} must not be portrayed as known to be operating`,
        );
      } else assert.ok(details.length > 0, `${stall.name} has serving-counter details`);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(window.matrixWorld);
      const expectedNormal = new THREE.Vector3(
        Math.sin(stall.position.rotationY),
        0,
        Math.cos(stall.position.rotationY),
      );
      assert.ok(normal.distanceTo(expectedNormal) < 1e-8);
      const selection = meshes.find((mesh) => mesh.userData.baseColor);
      assert.ok(selection);
      const surface = selection.getWorldPosition(new THREE.Vector3());
      const catalogCenter = new THREE.Vector3(stall.position.x, surface.y, stall.position.z);
      assert.ok(
        surface.clone().sub(catalogCenter).dot(expectedNormal) >= stall.position.depth / 2,
        `${stall.name}: the physical selection edge agrees with the catalog's service side`,
      );
    }

    const visibleMetrics = () => {
      let triangles = 0;
      const ids = new Set<string>();
      const lights: number[] = [];
      group.traverseVisible((object) => {
        if (object instanceof THREE.Light) lights.push(object.intensity);
        if (!(object instanceof THREE.Mesh)) return;
        const count =
          object.geometry.index?.count ?? object.geometry.getAttribute('position').count;
        triangles += (count / 3) * (object instanceof THREE.InstancedMesh ? object.count : 1);
        if (object.userData.kind === 'stall') ids.add(object.userData.id);
      });
      return { triangles, ids: [...ids].sort(), lights };
    };
    const before = new Map<string, ReturnType<typeof visibleMetrics>>();
    for (const mode of ['plan', '3d'] as const) {
      model.setMode(mode);
      before.set(mode, visibleMetrics());
      assert.deepEqual(before.get(mode)!.ids, eighthCanteenStalls.map((stall) => stall.id).sort());
    }
    const bounds = new THREE.Box3().setFromObject(group);
    batchModel(group);
    const batchedBounds = new THREE.Box3().setFromObject(group);
    assert.ok(bounds.min.distanceTo(batchedBounds.min) < 1e-4);
    assert.ok(bounds.max.distanceTo(batchedBounds.max) < 1e-4);
    for (const mode of ['plan', '3d'] as const) {
      model.setMode(mode);
      assert.equal(plan.visible, mode === 'plan');
      assert.ok(spatial.visible);
      assert.ok(roofs.every((roof) => roof.visible === (mode === '3d')));
      assert.deepEqual(visibleMetrics(), before.get(mode), `${mode}: batching preserves the scene`);
      model.setInterfaceTheme(true);
      assert.deepEqual(
        visibleMetrics(),
        before.get(mode),
        `${mode}: interface night mode preserves indoor light and geometry`,
      );
      model.setInterfaceTheme(false);
    }
  } finally {
    if (model) dispose(model.group);
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
