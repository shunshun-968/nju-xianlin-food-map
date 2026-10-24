import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  MINZU_CANTEEN_FLOOR_ID,
  minzuCanteenFaces,
  minzuCanteenStalls,
  minzuSignBoards,
  minzuSelfSelectAreas,
} from '../src/data/minzu-canteen';
import { getIndoorCanteen, getIndoorWindow, minzuCanteenSpec } from '../src/data/indoor-canteens';
import { MINZU_SIGN_TEXTURES, MINZU_SIGN_ASPECTS } from '../src/assets/minzu-canteen/signs';
import { createMinzuCanteenModel } from '../src/components/MinzuCanteenModel';
import { createStallPickTargets } from '../src/lib/stall-picking';
import { batchModel } from '../src/lib/model-batches';
import { navigationPath, readNavigation } from '../src/lib/use-app-navigation';
import { validateCatalog, type Catalog } from '../src/domain';

const close = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, message ?? `${actual} != ${expected}`);

function byNumber(number: number) {
  const stall = minzuCanteenStalls.find(
    (row) => getIndoorWindow(minzuCanteenSpec, row.id)?.windowNumber === number,
  );
  assert.ok(stall, `Missing actual window ${number}`);
  return stall;
}

function dispose(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
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

test('minzu records retain ten real numbers, cross-sign windows and confirmed breakfast without invented menus or ownership', () => {
  assert.equal(minzuCanteenStalls.length, 10);
  assert.equal(new Set(minzuCanteenStalls.map((stall) => stall.id)).size, 10);
  assert.deepEqual(
    minzuCanteenFaces.flatMap((face) => face.windowNumbers).sort((a, b) => a - b),
    Array.from({ length: 10 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    [3, 5].map((number) => getIndoorWindow(minzuCanteenSpec, byNumber(number).id)?.signName),
    ['回味无穷·兰州拉面／美食排档', '美食排档／民族风味'],
  );
  assert.equal(byNumber(3).category, '学子特价套餐');
  assert.equal(byNumber(4).category, '麻辣烫');
  assert.equal(byNumber(6).category, '拌面／盖饭／水饺');
  for (const number of [5, 7]) assert.equal(byNumber(number).category, '暂无售卖');
  for (const number of [8, 9, 10]) assert.equal(byNumber(number).category, '自选菜');
  assert.equal(
    new Set(
      [8, 9, 10].map((number) => getIndoorWindow(minzuCanteenSpec, byNumber(number).id)?.shopId),
    ).size,
    3,
    'Shared purchasing availability does not establish common business ownership',
  );
  assert.equal(byNumber(8).breakfast, true);
  for (const stall of minzuCanteenStalls) {
    if (stall.id !== byNumber(8).id) assert.equal(stall.breakfast, undefined);
    assert.deepEqual(stall.dishes, []);
    assert.equal(stall.photoKey, null);
  }
});

test('north-up geometry separates actual window positions from bisecting signs and the two 1.5-window food zones', () => {
  const west = Array.from({ length: 7 }, (_, index) => byNumber(index + 1));
  for (const [index, stall] of west.entries()) {
    close(stall.position.rotationY, -Math.PI / 2);
    close(stall.position.x - stall.position.depth / 2, -5);
    if (index > 0) assert.ok(west[index - 1].position.z < stall.position.z);
  }
  const south = [byNumber(8), byNumber(9), byNumber(10)];
  for (const [index, stall] of south.entries()) {
    close(stall.position.rotationY, 0);
    close(stall.position.z + stall.position.depth / 2, 8.5);
    if (index > 0) assert.ok(south[index - 1].position.x < stall.position.x);
  }
  const boards = minzuSignBoards
    .filter((board) => board.rotationY === -Math.PI / 2)
    .sort((a, b) => a.z - b.z);
  assert.equal(boards.length, 3);
  for (const [index, number] of [3, 5].entries()) {
    const boundary = byNumber(number).position.z;
    close(boards[index].z + boards[index].width / 2, boundary);
    close(boards[index + 1].z - boards[index + 1].width / 2, boundary);
  }
  assert.equal(minzuSelfSelectAreas.length, 2);
  for (const area of minzuSelfSelectAreas) {
    close(area.width, byNumber(9).position.width * 1.5);
    assert.deepEqual(area.windowNumbers, [8, 9, 10]);
  }
  const areas = [...minzuSelfSelectAreas].sort((a, b) => a.x - b.x);
  close(areas[0].x + areas[0].width / 2, byNumber(9).position.x);
  close(areas[1].x - areas[1].width / 2, byNumber(9).position.x);
});

test('the minzu route and exported catalog preserve the real layout and breakfast metadata', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  const floor = catalog.floors.find((row) => row.id === MINZU_CANTEEN_FLOOR_ID);
  assert.ok(floor);
  assert.equal(floor.name, '民族食堂');
  assert.equal(getIndoorCanteen(floor.id), minzuCanteenSpec);
  assert.deepEqual(
    catalog.stalls.filter((stall) => stall.floorId === floor.id),
    minzuCanteenStalls,
  );
  const navigation = readNavigation(
    new URL(`https://example.test/?floor=${floor.id}&stall=${byNumber(8).id}`),
  );
  assert.deepEqual(navigation.view, { level: 'floor', floorId: floor.id, venueId: floor.venueId });
  assert.equal(navigation.stallId, byNumber(8).id);
  assert.deepEqual(
    navigationPath(navigation).map((state) => state.view.level),
    ['campus', 'building', 'floor', 'floor'],
  );
  const snapshot = JSON.parse(
    readFileSync(new URL('../data/demo-catalog.json', import.meta.url), 'utf8'),
  ) as Catalog;
  assert.deepEqual(
    snapshot.stalls.filter((stall) => stall.floorId === floor.id),
    minzuCanteenStalls,
  );
});

test('minzu picking follows every physical opening in plan and reaches the tall sign area in 3D', () => {
  assert.equal(minzuCanteenSpec.facadeHeight, 4.5);
  const heights = Object.fromEntries(
    minzuCanteenStalls.map((stall) => [stall.id, minzuCanteenSpec.facadeHeight!]),
  );
  for (const stalls of [minzuCanteenStalls, [...minzuCanteenStalls].reverse()]) {
    const targets = createStallPickTargets(stalls, heights);
    try {
      for (const stall of minzuCanteenStalls) {
        const p = stall.position;
        const normal = new THREE.Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
        const overhead = new THREE.Vector3(p.x, 20, p.z).addScaledVector(
          normal,
          p.depth / 2 - 0.15,
        );
        targets.setMode('plan');
        assert.equal(
          targets.pick(new THREE.Raycaster(overhead, new THREE.Vector3(0, -1, 0))),
          stall.id,
        );
        targets.setMode('3d');
        for (const height of [0.1, 4.45]) {
          const front = new THREE.Vector3(p.x, height, p.z).addScaledVector(
            normal,
            p.depth / 2 + 2,
          );
          assert.equal(targets.pick(new THREE.Raycaster(front, normal.clone().negate())), stall.id);
        }
      }
    } finally {
      dispose(targets.group);
    }
  }
});

test('the actual minzu scene uses original sign textures, keeps empty windows empty and preserves the scene through batching and view changes', () => {
  // Only canvas raster drawing and image loading are replaced; all geometry and transforms are real.
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
  const loaded = new Map<string, THREE.Texture>();
  let model: ReturnType<typeof createMinzuCanteenModel> | undefined;
  try {
    model = createMinzuCanteenModel(minzuCanteenSpec, (url) => {
      const bytes = readFileSync(new URL(url));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      const texture = new THREE.Texture();
      loaded.set(url, texture);
      return texture;
    });
    const { group } = model;
    group.updateMatrixWorld(true);
    const plan = group.getObjectByName('plan-labels');
    const spatial = group.getObjectByName('spatial-frontages');
    assert.ok(plan && spatial);
    const windows: THREE.Object3D[] = [];
    const ceilings: THREE.Object3D[] = [];
    group.traverse((object) => {
      if (object.name.startsWith('window-')) windows.push(object);
      if (object.userData.planHide) ceilings.push(object);
    });
    assert.deepEqual(
      windows.map((window) => window.name).sort(),
      minzuCanteenStalls.map((stall) => `window-${stall.id}`).sort(),
    );
    assert.ok(
      plan.visible &&
        spatial.visible &&
        ceilings.length > 0 &&
        ceilings.every((roof) => !roof.visible),
    );
    for (const stall of minzuCanteenStalls) {
      const window = group.getObjectByName(`window-${stall.id}`)!;
      const number = getIndoorWindow(minzuCanteenSpec, stall.id)!.windowNumber;
      const contents: THREE.Object3D[] = [];
      window.traverse((object) => {
        if (object.name.startsWith('counter-details-') || object.name.startsWith('canteen-staff-'))
          contents.push(object);
      });
      if ([5, 7].includes(number)) assert.equal(contents.length, 0);
      else assert.ok(contents.length > 0);
    }
    const signKeys = Object.keys(MINZU_SIGN_TEXTURES) as (keyof typeof MINZU_SIGN_TEXTURES)[];
    assert.deepEqual([...loaded.keys()].sort(), Object.values(MINZU_SIGN_TEXTURES).sort());
    for (const key of signKeys) {
      const sign = group.getObjectByName(`minzu-original-sign-${key}`);
      assert.ok(sign instanceof THREE.Mesh);
      assert.ok(sign.geometry instanceof THREE.PlaneGeometry);
      const material = sign.material as THREE.MeshBasicMaterial;
      assert.equal(
        material.map,
        loaded.get(MINZU_SIGN_TEXTURES[key]),
        'The actual image is used rather than redrawing the lettering',
      );
      close(
        sign.geometry.parameters.width / sign.geometry.parameters.height,
        MINZU_SIGN_ASPECTS[key],
      );
      assert.equal(sign.userData.originalSignKey, key);
    }
    assert.ok(
      group
        .getObjectByName(`window-${byNumber(8).id}`)!
        .getObjectByName('minzu-original-sign-breakfast'),
    );
    assert.ok(
      group
        .getObjectByName(`window-${byNumber(3).id}`)!
        .getObjectByName('minzu-original-sign-studentSpecial'),
    );
    const metrics = () => {
      let triangles = 0;
      const picks = new Set<string>();
      const signs: string[] = [];
      const lights: number[] = [];
      group.traverseVisible((object) => {
        if (object instanceof THREE.Light) lights.push(object.intensity);
        if (!(object instanceof THREE.Mesh)) return;
        triangles +=
          ((object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3) *
          (object instanceof THREE.InstancedMesh ? object.count : 1);
        if (object.userData.kind === 'stall') picks.add(object.userData.id);
        if (object.userData.originalSignKey) signs.push(object.userData.originalSignKey);
      });
      return { triangles, picks: [...picks].sort(), signs: signs.sort(), lights };
    };
    const before = new Map<string, ReturnType<typeof metrics>>();
    for (const mode of ['plan', '3d'] as const) {
      model.setMode(mode);
      before.set(mode, metrics());
      assert.deepEqual(metrics().picks, minzuCanteenStalls.map((stall) => stall.id).sort());
    }
    batchModel(group);
    for (const mode of ['plan', '3d'] as const) {
      model.setMode(mode);
      assert.equal(plan.visible, mode === 'plan');
      assert.ok(ceilings.every((roof) => roof.visible === (mode === '3d')));
      assert.deepEqual(metrics(), before.get(mode));
      model.setInterfaceTheme(true);
      assert.deepEqual(
        metrics(),
        before.get(mode),
        'Interface theme does not change the photographed signs or indoor structure',
      );
      model.setInterfaceTheme(false);
    }
  } finally {
    if (model) dispose(model.group);
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
