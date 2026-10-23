import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  SIXTH_CANTEEN_FLOOR_ID,
  sixthCanteenFaces,
  sixthCanteenStalls,
} from '../src/data/sixth-canteen';
import { sixthCanteenSpec } from '../src/data/indoor-canteens';
import { createSixthCanteenModel } from '../src/components/SixthCanteenModel';
import { validateCatalog } from '../src/domain';

const close = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
const expectedMainNames = [
  '金陵小厨',
  '中式面点',
  '美食档口',
  '百变窗口',
  '地方特色',
  '风味小吃',
  '天府菜肴',
  '淮扬菜品',
];
const expectedMainScreens = [
  ['自选菜', '自选菜', '自选菜'],
  ['自选菜', '自选菜'],
  ['麻辣香锅窗口\n素菜15元/斤\n荤菜32.5元/斤\n晚餐销售', '自选菜'],
  ['贵州蘸水菜', '自选减脂餐窗口'],
  ['自选菜', '自选菜'],
  ['广式烧腊', '自选菜'],
  ['自选菜', '自选菜'],
  ['自选菜', '自选菜', '自选菜', '自选菜'],
];

test('sixth canteen has 20 physical windows, 19 selectable windows, 11 frontages and 23 LCD screens', () => {
  assert.equal(sixthCanteenFaces.length, 11);
  assert.equal(new Set(sixthCanteenFaces.map((face) => face.faceId)).size, 11);
  assert.equal(new Set(sixthCanteenFaces.map((face) => face.shopId)).size, 8);
  assert.equal(
    sixthCanteenFaces.reduce((total, face) => total + face.windowCount, 0),
    20,
  );
  assert.equal(sixthCanteenStalls.length, 19);
  assert.equal(new Set(sixthCanteenStalls.map((stall) => stall.id)).size, 19);
  const main = sixthCanteenFaces.filter((face) => face.rotationY === 0).sort((a, b) => a.x - b.x);
  assert.deepEqual(
    main.map((face) => face.name),
    expectedMainNames,
  );
  assert.deepEqual(
    main.map((face) => face.windowCount),
    [3, 2, 2, 2, 2, 2, 2, 2],
  );
  assert.deepEqual(
    main.map((face) => face.screenTexts),
    expectedMainScreens,
  );
  assert.equal(
    main.reduce((total, face) => total + face.screenTexts.length, 0),
    19,
  );
  assert.equal(
    sixthCanteenFaces.reduce((total, face) => total + face.screenTexts.length, 0),
    23,
  );
  const huaiyang = main.at(-1)!;
  assert.equal(huaiyang.name, '淮扬菜品');
  assert.equal(huaiyang.windowCount, 2);
  assert.equal(huaiyang.screenTexts.length, 4);
  assert.equal(huaiyang.width, 5.25);
  assert.deepEqual(huaiyang.sourcePhotoNumbers, [1, 2]);
  assert.equal(sixthCanteenFaces.filter((face) => face.shopId === huaiyang.shopId).length, 2);
  close(main[0].x - main[0].width / 2, -17.5, 'Main row begins at the left corner');
  for (let index = 1; index < main.length; index++) {
    close(
      main[index - 1].x + main[index - 1].width / 2,
      main[index].x - main[index].width / 2,
      'Adjacent main frontages meet',
    );
  }
});

test('side windows connect to the existing kitchens, with Jinling fixed glass separate from pickup', () => {
  const jinling = sixthCanteenFaces.filter((face) => face.shopId === 'jinling-kitchen');
  assert.equal(jinling.length, 3);
  assert.deepEqual(
    jinling.map((face) => face.windowCount),
    [3, 1, 1],
  );
  const expected = { minX: -17.5, maxX: -12.25, minZ: -7.5, maxZ: 7.3 };
  for (const face of jinling) {
    assert.deepEqual(face.kitchenBounds, expected);
    assert.equal(face.enclosed, true);
  }
  const side = sixthCanteenFaces.filter((face) => face.rotationY !== 0);
  assert.equal(side.length, 3);
  const pickup = side.find((face) => face.pickup)!;
  assert.equal(pickup.name, '金陵小厨取餐口');
  assert.equal(pickup.shopId, 'jinling-kitchen');
  assert.equal(pickup.pickup, true);
  assert.equal(pickup.windowCount, 1);
  assert.deepEqual(pickup.screenTexts, ['自选菜']);
  close(pickup.x, -16.5, 'Pickup X');
  close(pickup.z, -4.5, 'Pickup Z');
  close(pickup.width, 1.75, 'Pickup width');
  close(pickup.rotationY, -Math.PI / 2, 'Pickup opens toward -X');
  const fixed = side.find((face) => face.displayOnly)!;
  assert.equal(fixed.shopId, 'jinling-kitchen');
  assert.equal(fixed.enclosed, true);
  assert.equal(fixed.windowCount, 1);
  assert.deepEqual(fixed.screenTexts, ['自选菜']);
  close(fixed.x, -16.5, 'Fixed side window X');
  close(fixed.z, 5.5, 'Fixed side window Z');
  close(fixed.width, 1.75, 'Fixed side window width');
  close(fixed.rotationY, -Math.PI / 2, 'Fixed glass faces -X');
  const huaiyang = sixthCanteenFaces.filter((face) => face.shopId === 'huaiyang-caipin');
  assert.equal(huaiyang.length, 2);
  const huaiyangBounds = { minX: 8.75, maxX: 14, minZ: 3.8, maxZ: 7.3 };
  for (const face of huaiyang) assert.deepEqual(face.kitchenBounds, huaiyangBounds);
  const huaiyangSide = huaiyang.find((face) => face.rotationY !== 0)!;
  assert.equal(huaiyangSide.windowCount, 1);
  assert.deepEqual(huaiyangSide.screenTexts, ['自选菜', '自选菜']);
  close(huaiyangSide.x, 13, 'Huaiyang side X');
  close(huaiyangSide.z, 5.5, 'Huaiyang side Z');
  close(huaiyangSide.width, 1.75, 'Huaiyang side width');
  close(huaiyangSide.rotationY, Math.PI / 2, 'Huaiyang opens toward +X');
});

test('catalog exposes position-based selection without invented numbers, source photos or menu data', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  const floor = catalog.floors.find((row) => row.id === SIXTH_CANTEEN_FLOOR_ID);
  assert.ok(floor);
  assert.equal(floor.name, '第六食堂');
  assert.equal(floor.level, 3);
  assert.equal(floor.width, 44);
  assert.equal(floor.depth, 22);
  assert.equal(floor.layoutVersion, 2);
  assert.deepEqual(
    catalog.stalls.filter((stall) => stall.floorId === floor.id),
    sixthCanteenStalls,
  );
  assert.equal(sixthCanteenSpec.showWindowNumbers, false);
  assert.ok(sixthCanteenFaces.every((face) => !('windowNumbers' in face)));
  for (const face of sixthCanteenFaces) {
    const stalls = sixthCanteenStalls.filter((stall) => stall.id.startsWith(`${face.faceId}-w`));
    if (face.displayOnly) {
      assert.equal(stalls.length, 0, 'Fixed glazing is not exposed as a selectable service window');
      continue;
    }
    assert.equal(stalls.length, face.windowCount);
    assert.deepEqual(
      stalls.map((stall) => stall.id),
      Array.from({ length: face.windowCount }, (_, index) => `${face.faceId}-w${index + 1}`),
    );
    const labels =
      face.windowCount === 1
        ? ['侧面']
        : face.windowCount === 3
          ? ['左侧', '中间', '右侧']
          : ['左侧', '右侧'];
    assert.deepEqual(
      stalls.map((stall) => stall.name),
      face.pickup ? ['金陵小厨取餐口'] : labels.map((label) => `${face.name} · ${label}窗口`),
    );
    for (const stall of stalls) {
      assert.doesNotMatch(stall.name, /\d|号窗|示意序号/);
      assert.equal(stall.photoKey, null);
      assert.deepEqual(stall.dishes, []);
    }
  }
  assert.doesNotMatch(JSON.stringify(sixthCanteenFaces), /不能打饭/);
  assert.doesNotMatch(JSON.stringify(sixthCanteenFaces), /\.(?:jpe?g|png|webp)(?:["?\s]|$)/i);
});

test('the real sixth-canteen scene has the confirmed rooms, screens and view/theme behavior', async (t) => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const drawnTexts: string[] = [];
  const canvases = new Set<unknown>();
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        const context = {
          fillRect() {},
          fillText(text: string) {
            drawnTexts.push(String(text));
          },
          strokeRect() {},
        };
        const canvas = {
          width: 0,
          height: 0,
          getContext(kind: string) {
            assert.equal(kind, '2d');
            return context;
          },
        };
        canvases.add(canvas);
        return canvas;
      },
    },
  });
  let model: ReturnType<typeof createSixthCanteenModel> | undefined;
  try {
    model = createSixthCanteenModel(sixthCanteenSpec);
    const { group } = model;
    const spatial = group.getObjectByName('spatial-frontages');
    const plan = group.getObjectByName('plan-labels');
    assert.ok(spatial && plan);
    group.updateMatrixWorld(true);
    const collect = (root: THREE.Object3D, predicate: (object: THREE.Object3D) => boolean) => {
      const result: THREE.Object3D[] = [];
      root.traverse((object) => {
        if (predicate(object)) result.push(object);
      });
      return result;
    };
    const windows = collect(spatial, (object) => object.name.startsWith('window-'));
    const kitchens = collect(spatial, (object) => object.name.startsWith('kitchen-'));
    const ceilings = collect(spatial, (object) => object.name.startsWith('ceiling-'));

    await t.test(
      'actual geometry contains 20 windows and cuts both side walls around the new openings',
      () => {
        assert.equal(windows.length, 20);
        assert.deepEqual(
          windows.map((window) => window.name).sort(),
          sixthCanteenFaces
            .flatMap((face) =>
              Array.from(
                { length: face.windowCount },
                (_, index) => `window-${face.faceId}-w${index + 1}`,
              ),
            )
            .sort(),
        );
        assert.equal(kitchens.length, 8);
        assert.equal(new Set(kitchens.map((kitchen) => kitchen.userData.shopId)).size, 8);
        const frontages = spatial.children.filter((object) =>
          sixthCanteenFaces.some((face) => face.faceId === object.name),
        );
        assert.equal(frontages.length, 11);
        const side = frontages.filter((front) => Math.abs(Math.sin(front.rotation.y)) > 0.99);
        assert.equal(side.length, 3);
        const pickup = sixthCanteenFaces.find((face) => face.pickup)!;
        for (const front of side)
          assert.equal(
            front.children.filter((object) => object.name.startsWith('window-')).length,
            1,
          );
        const jinling = kitchens.filter((kitchen) => kitchen.userData.shopId === 'jinling-kitchen');
        assert.equal(jinling.length, 1);
        assert.deepEqual(jinling[0].userData.bounds, pickup.kitchenBounds);
        const fixed = sixthCanteenFaces.find((face) => face.displayOnly)!;
        const walls = collect(jinling[0], (object) => object.name === 'jinling-closed-side-wall')
          .map((wall) => new THREE.Box3().setFromObject(wall))
          .sort((a, b) => a.min.z - b.min.z);
        assert.equal(walls.length, 3);
        close(walls[0].min.z, -7.5, 'First closed section begins at the kitchen rear');
        close(walls[0].max.z, pickup.z - pickup.width / 2, 'First section ends at the pickup');
        close(
          walls[1].min.z,
          pickup.z + pickup.width / 2,
          'Second section starts after the pickup',
        );
        close(
          walls[1].max.z,
          fixed.z - fixed.width / 2,
          'Middle section ends before the corner window',
        );
        close(
          walls[2].min.z,
          fixed.z + fixed.width / 2,
          'Last section starts after the corner window',
        );
        close(walls[2].max.z, 7.3, 'Last section continues to the main front');
        for (const wall of walls)
          close((wall.min.x + wall.max.x) / 2, -17.5, 'Closed side-wall plane');
        const fixedFront = spatial.getObjectByName(fixed.faceId)!;
        assert.equal(
          collect(fixedFront, (object) => object.userData.kind === 'stall').length,
          0,
          'Fixed glass has no stall selection targets',
        );
        const glass = collect(fixedFront, (object) => object.name === 'sixth-fixed-glass');
        assert.equal(glass.length, 1);
        const glassBounds = new THREE.Box3().setFromObject(glass[0]);
        close(glassBounds.min.y, 1.2, 'Fixed pane starts at the counter');
        close(glassBounds.max.y, 2.54, 'Fixed pane closes the entire upper opening');
        const huaiyang = kitchens.find((kitchen) => kitchen.userData.shopId === 'huaiyang-caipin')!;
        const huaiyangSide = sixthCanteenFaces.find(
          (face) => face.shopId === 'huaiyang-caipin' && face.rotationY !== 0,
        )!;
        assert.deepEqual(huaiyang.userData.bounds, huaiyangSide.kitchenBounds);
        const rightWalls = collect(
          huaiyang,
          (object) => object.name === 'huaiyang-closed-side-wall',
        )
          .map((wall) => new THREE.Box3().setFromObject(wall))
          .sort((a, b) => a.min.z - b.min.z);
        assert.equal(rightWalls.length, 2);
        close(rightWalls[0].min.z, 3.8, 'Right side wall begins at the shared kitchen rear');
        close(
          rightWalls[0].max.z,
          huaiyangSide.z - huaiyangSide.width / 2,
          'Right rear wall clears the opening',
        );
        close(
          rightWalls[1].min.z,
          huaiyangSide.z + huaiyangSide.width / 2,
          'Right front wall clears the opening',
        );
        close(rightWalls[1].max.z, 7.3, 'Right front wall reaches the main frontage');
        for (const wall of rightWalls)
          close((wall.min.x + wall.max.x) / 2, 14, 'Right side-wall plane');
      },
    );

    await t.test(
      '23 real LCD planes retain confirmed text without unavailable-service labels, invented numbers or photos',
      () => {
        const allScreens = collect(spatial, (object) => object.name.startsWith('sixth-lcd-'));
        assert.equal(allScreens.length, 23);
        for (const face of sixthCanteenFaces) {
          const frontage = spatial.getObjectByName(face.faceId);
          assert.ok(frontage);
          const screens = collect(frontage, (object) => object.name.startsWith('sixth-lcd-'));
          assert.deepEqual(
            screens.map((screen) => screen.userData.screenText),
            face.screenTexts,
          );
          assert.ok(screens.every((screen) => screen instanceof THREE.Mesh));
        }
        for (const text of expectedMainScreens.flat().flatMap((screen) => screen.split('\n')))
          assert.ok(drawnTexts.includes(text), `Confirmed screen text is rendered: ${text}`);
        assert.ok(
          !drawnTexts.some((text) => /^\d+$/.test(text)),
          'No actual window-number plaques are invented',
        );
        assert.ok(
          !drawnTexts.some((text) => text.includes('不能打饭')),
          'No unwanted service restriction label',
        );
        group.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            if ('map' in material && material.map instanceof THREE.Texture)
              assert.ok(
                canvases.has(material.map.image) ||
                  (material.map instanceof THREE.DataTexture &&
                    ArrayBuffer.isView(material.map.image.data)),
                'Textures are drawn locally, never copied reference photos',
              );
          }
        });
      },
    );

    await t.test(
      'plan hides exactly eight ceilings, 3D restores them, and UI day/night leaves geometry and lights intact',
      () => {
        assert.equal(ceilings.length, 8);
        assert.deepEqual(
          collect(spatial, (object) => Boolean(object.userData.planHide))
            .map((object) => object.uuid)
            .sort(),
          ceilings.map((object) => object.uuid).sort(),
        );
        const lights = collect(spatial, (object) => object instanceof THREE.Light);
        const warmLights = collect(spatial, (object) => object.name === 'sixth-window-warm-light');
        assert.equal(warmLights.length, 20);
        assert.equal(lights.length, 20, 'One warm light for every physical window');
        for (const window of windows) {
          const windowLights = collect(
            window,
            (object) => object.name === 'sixth-window-warm-light',
          );
          assert.equal(windowLights.length, 1);
          assert.ok(windowLights[0] instanceof THREE.PointLight);
          assert.equal(windowLights[0].color.getHexString(), 'ffc268');
          const fixtures = collect(window, (object) => object.name === 'sixth-window-warm-fixture');
          assert.equal(fixtures.length, 1);
          assert.ok(fixtures[0] instanceof THREE.Mesh);
          const materials = Array.isArray(fixtures[0].material)
            ? fixtures[0].material
            : [fixtures[0].material];
          assert.ok(
            materials.some(
              (material) =>
                material instanceof THREE.MeshStandardMaterial &&
                material.emissiveIntensity > 0 &&
                material.emissive.getHex() !== 0,
            ),
          );
        }
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
        for (const mode of ['plan', '3d'] as const) {
          model!.setMode(mode);
          assert.equal(plan.visible, mode === 'plan');
          assert.equal(spatial.visible, true);
          assert.ok(ceilings.every((ceiling) => ceiling.visible === (mode === '3d')));
          assert.ok(windows.every((window) => window.visible));
          assert.ok(
            warmLights.every(
              (light) =>
                light instanceof THREE.PointLight && light.intensity === (mode === '3d' ? 20 : 14),
            ),
          );
          const before = structure();
          model!.setInterfaceTheme(true);
          assert.deepEqual(
            structure(),
            before,
            `${mode}: night interface preserves the indoor scene`,
          );
          model!.setInterfaceTheme(false);
          assert.deepEqual(
            structure(),
            before,
            `${mode}: day interface preserves the indoor scene`,
          );
        }
      },
    );
  } finally {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    model?.group.traverse((object) => {
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
