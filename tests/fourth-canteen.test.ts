import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  FOURTH_CANTEEN_FLOOR_ID,
  FOURTH_LAYOUT,
  fourthCanteenFaces,
  fourthKitchenBounds,
  fourthCanteenStalls,
  type FourthCanteenFace,
} from '../src/data/fourth-canteen';
import { validateCatalog } from '../src/domain';
import { createFourthCanteenModel, FOURTH_HEIGHTS } from '../src/components/FourthCanteenModel';

const close = (actual: number, expected: number, message: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
const face = (slug: string) => {
  const result = fourthCanteenFaces.find(
    (row) => row.faceId === `${FOURTH_CANTEEN_FLOOR_ID}-${slug}`,
  );
  assert.ok(result, `Missing frontage ${slug}`);
  return result;
};
const windowsFor = (front: FourthCanteenFace) =>
  fourthCanteenStalls.filter((stall) => stall.id.startsWith(`${front.faceId}-w`));

test('confirmed exceptions produce 24 windows and two narrower 蒙自源 openings', () => {
  assert.equal(fourthCanteenFaces.length, 13);
  assert.equal(fourthCanteenStalls.length, 24);
  assert.equal(face('chuangyi').windowCount, 1);
  assert.equal(face('jitang-mixian').windowCount, 2);
  assert.ok(
    windowsFor(face('jitang-mixian')).every(
      (window) =>
        window.position.width < windowsFor(face('chuangyi'))[0].position.width &&
        window.position.width < windowsFor(face('dongbei'))[0].position.width,
    ),
  );
});

test('fourth canteen is a valid third-level catalog with one stable record per service opening', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  const floor = catalog.floors.find((row) => row.id === FOURTH_CANTEEN_FLOOR_ID);
  assert.ok(floor);
  assert.equal(floor.venueId, 'v-456');
  assert.equal(floor.name, '第四食堂');
  assert.equal(floor.layoutVersion, 2);
  assert.deepEqual(
    catalog.stalls.filter((stall) => stall.floorId === floor.id),
    fourthCanteenStalls,
  );
  assert.equal(
    new Set(fourthCanteenFaces.map((row) => row.faceId)).size,
    fourthCanteenFaces.length,
  );
  assert.equal(new Set(fourthCanteenStalls.map((row) => row.id)).size, fourthCanteenStalls.length);
  assert.equal(
    fourthCanteenStalls.length,
    fourthCanteenFaces.reduce((total, row) => total + row.windowCount, 0),
  );
  for (const front of fourthCanteenFaces) {
    assert.match(front.faceId, /^v-456-f1-[a-z]+(?:-[a-z]+)*$/);
    assert.equal(front.id, front.faceId);
    assert.ok(Number.isInteger(front.windowCount) && front.windowCount > 0);
    const windows = windowsFor(front);
    assert.equal(windows.length, front.windowCount, front.faceId);
    assert.deepEqual(
      windows.map((window) => window.id),
      Array.from({ length: front.windowCount }, (_, index) => `${front.faceId}-w${index + 1}`),
    );
    close(
      windows.reduce((total, window) => total + window.position.width, 0),
      front.width,
      `${front.name} opening span`,
    );
    const localCenters = windows.map((window) => {
      const dx = window.position.x - front.x,
        dz = window.position.z - front.z;
      close(
        dx * Math.sin(front.rotationY) + dz * Math.cos(front.rotationY),
        FOURTH_LAYOUT.frontOffset - FOURTH_LAYOUT.kitchenDepth / 2,
        `${window.id} kitchen center behind frontage`,
      );
      return dx * Math.cos(front.rotationY) - dz * Math.sin(front.rotationY);
    });
    close(
      localCenters[0] - windows[0].position.width / 2,
      -front.width / 2,
      `${front.name} first edge`,
    );
    close(
      localCenters.at(-1)! + windows.at(-1)!.position.width / 2,
      front.width / 2,
      `${front.name} last edge`,
    );
    for (let index = 1; index < windows.length; index++) {
      close(
        localCenters[index] - windows[index].position.width / 2,
        localCenters[index - 1] + windows[index - 1].position.width / 2,
        `${front.name} adjacent openings`,
      );
    }
  }
});

test('the long frontage follows the reference photo sequence from left to right', () => {
  const main = fourthCanteenFaces
    .filter((row) => Math.abs(Math.sin(row.rotationY)) < 1e-8)
    .sort((a, b) => a.x - b.x);
  assert.deepEqual(
    main.map((row) => row.name),
    [
      '优品麦选',
      '中原风味',
      '福建风味',
      '湘鄂赣风味',
      '川渝风味',
      '西北风味',
      '广式风味',
      '东北风味',
      '创意融合',
      '蒙自源鸡汤米线',
    ],
  );
  assert.deepEqual(
    main.map((row) => row.photoNumber),
    [6, 5, 4, 4, 3, 3, 2, 2, 1, 1],
  );
  for (const front of main) {
    close(front.z, main[0].z, `${front.name} common frontage`);
    assert.ok(front.z > 0, 'The long frontage is below the central floor in the default plan');
    close(Math.sin(front.rotationY), 0, `${front.name} normal x`);
    close(Math.cos(front.rotationY), 1, `${front.name} opens outward toward +Z`);
    const kitchen = fourthKitchenBounds(front);
    close(kitchen.maxZ, front.z + FOURTH_LAYOUT.frontOffset, `${front.name} exterior front plane`);
    close(kitchen.maxZ - kitchen.minZ, FOURTH_LAYOUT.kitchenDepth, `${front.name} kitchen depth`);
    assert.ok(kitchen.minZ < front.z, `${front.name} kitchen extends toward the L interior`);
  }
  for (let index = 1; index < main.length; index++) {
    close(
      main[index].x - main[index].width / 2,
      main[index - 1].x + main[index - 1].width / 2,
      'No invented gaps along the long frontage',
    );
  }
});

test('the short frontage extends up the left side with the confirmed 京兜 name', () => {
  const side = fourthCanteenFaces
    .filter((row) => Math.abs(Math.cos(row.rotationY)) < 1e-8)
    .sort((a, b) => b.z - a.z);
  assert.deepEqual(
    side.map((row) => row.name),
    ['酱香醇厚', '金陵风味', '京兜水饺馄饨'],
  );
  assert.deepEqual(
    side.map((row) => row.photoNumber),
    [6, 7, 7],
  );
  const leftmostMain = face('maijindi');
  for (const front of side) {
    close(front.x, side[0].x, `${front.name} common left frontage`);
    assert.ok(front.x < leftmostMain.x && front.z < leftmostMain.z);
    close(Math.sin(front.rotationY), -1, `${front.name} opens outward toward -X`);
    close(Math.cos(front.rotationY), 0, `${front.name} normal z`);
    const kitchen = fourthKitchenBounds(front);
    close(kitchen.minX, front.x - FOURTH_LAYOUT.frontOffset, `${front.name} exterior front plane`);
    close(kitchen.maxX - kitchen.minX, FOURTH_LAYOUT.kitchenDepth, `${front.name} kitchen depth`);
    assert.ok(kitchen.maxX > front.x, `${front.name} kitchen extends toward the L interior`);
  }
  for (let index = 1; index < side.length; index++) {
    close(
      side[index - 1].z - side[index - 1].width / 2,
      side[index].z + side[index].width / 2,
      'No invented gaps along the short frontage',
    );
  }
});

test('麦金地 has two east windows and one south window around one solid convex-corner kitchen', () => {
  const east = face('maijindi'),
    south = face('maijindi-side');
  assert.notEqual(east.faceId, south.faceId);
  assert.equal(east.windowCount, 2);
  assert.equal(south.windowCount, 1);
  assert.equal(windowsFor(east).length, 2);
  assert.equal(windowsFor(south).length, 1);
  assert.equal(east.shopId, 'maijindi');
  assert.equal(south.shopId, east.shopId);
  const eastBounds = fourthKitchenBounds(east),
    southBounds = fourthKitchenBounds(south);
  assert.deepEqual(eastBounds, { minX: -17.5, maxX: -14, minZ: 3.8, maxZ: 7.3 });
  assert.deepEqual(
    southBounds,
    eastBounds,
    'Both frontages enclose the same shop, not separate kitchens',
  );
  close(east.x - east.width / 2, FOURTH_LAYOUT.corner.x, 'East frontage corner x');
  close(east.z + FOURTH_LAYOUT.frontOffset, FOURTH_LAYOUT.corner.z, 'East frontage corner z');
  close(south.x - FOURTH_LAYOUT.frontOffset, FOURTH_LAYOUT.corner.x, 'South frontage corner x');
  close(south.z + south.width / 2, FOURTH_LAYOUT.corner.z, 'South frontage corner z');
  assert.ok(windowsFor(east).every((a) => windowsFor(south).every((b) => a.id !== b.id)));
});

test('thick kitchen footprints stay inside the floor and match their catalog window bounds', () => {
  const floor = catalog.floors.find((row) => row.id === FOURTH_CANTEEN_FLOOR_ID)!;
  for (const front of fourthCanteenFaces) {
    assert.ok(front.shopId);
    const kitchen = fourthKitchenBounds(front);
    assert.ok(kitchen.minX >= -floor.width / 2 && kitchen.maxX <= floor.width / 2);
    assert.ok(kitchen.minZ >= -floor.depth / 2 && kitchen.maxZ <= floor.depth / 2);
    const windows = windowsFor(front).map(({ position: p }) => {
      assert.equal(p.depth, FOURTH_LAYOUT.kitchenDepth);
      const halfX =
        (p.width * Math.abs(Math.cos(p.rotationY)) + p.depth * Math.abs(Math.sin(p.rotationY))) / 2;
      const halfZ =
        (p.width * Math.abs(Math.sin(p.rotationY)) + p.depth * Math.abs(Math.cos(p.rotationY))) / 2;
      return { minX: p.x - halfX, maxX: p.x + halfX, minZ: p.z - halfZ, maxZ: p.z + halfZ };
    });
    close(
      Math.min(...windows.map((row) => row.minX)),
      kitchen.minX,
      `${front.name} catalog left bound`,
    );
    close(
      Math.max(...windows.map((row) => row.maxX)),
      kitchen.maxX,
      `${front.name} catalog right bound`,
    );
    close(
      Math.min(...windows.map((row) => row.minZ)),
      kitchen.minZ,
      `${front.name} catalog top bound`,
    );
    close(
      Math.max(...windows.map((row) => row.maxZ)),
      kitchen.maxZ,
      `${front.name} catalog bottom bound`,
    );
  }
  const shops = new Map<string, FourthCanteenFace[]>();
  for (const front of fourthCanteenFaces) {
    shops.set(front.shopId, [...(shops.get(front.shopId) || []), front]);
  }
  assert.equal(shops.size, 12);
  for (const [id, fronts] of shops) {
    assert.equal(fronts.length, id === 'maijindi' ? 2 : 1);
  }
});

test('reference photo indices remain local metadata; windows expose no photos or invented menus', () => {
  for (const front of fourthCanteenFaces) {
    assert.ok(
      Number.isInteger(front.photoNumber) && front.photoNumber >= 1 && front.photoNumber <= 7,
    );
    for (const window of windowsFor(front)) {
      assert.equal(window.photoKey, null);
      assert.deepEqual(window.dishes, []);
    }
  }
});

test('one shared height system keeps counters below openings and signs across every frontage', () => {
  const { floor, counter, openingTop, signBottom, signTop } = FOURTH_HEIGHTS;
  assert.ok([floor, counter, openingTop, signBottom, signTop].every(Number.isFinite));
  assert.ok(floor >= 0 && floor < counter && counter < openingTop);
  assert.ok(openingTop <= signBottom && signBottom < signTop);
  assert.ok(
    signTop - signBottom < openingTop - counter,
    'Sign fascia remains shallower than the service opening',
  );
});

test('the built model has one kitchen per shop, outward counters, and stable geometry across UI themes', () => {
  // Only raster text calls are stubbed; all scene objects, geometry, transforms and materials are real Three.js.
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        const context = {
          fillRect() {},
          fillText() {},
          strokeRect() {},
        };
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
  let model: ReturnType<typeof createFourthCanteenModel> | undefined;
  try {
    model = createFourthCanteenModel(() => new THREE.Texture());
    const group = model.group;
    const spatial = group.getObjectByName('spatial-frontages');
    const plan = group.getObjectByName('plan-labels');
    assert.ok(spatial && plan);
    const frontages = spatial.children.filter((child) =>
      child.name.startsWith(`${FOURTH_CANTEEN_FLOOR_ID}-`),
    );
    assert.equal(frontages.length, 13);
    assert.equal(new Set(frontages.map((frontage) => frontage.name)).size, 13);
    const kitchens = spatial.children.filter((child) => child.userData.shopId);
    assert.equal(kitchens.length, 12);
    assert.equal(new Set(kitchens.map((kitchen) => kitchen.userData.shopId)).size, 12);
    const maijindiKitchens = kitchens.filter((kitchen) => kitchen.userData.shopId === 'maijindi');
    assert.equal(maijindiKitchens.length, 1);
    assert.deepEqual(maijindiKitchens[0].userData.bounds, fourthKitchenBounds(face('maijindi')));
    for (const kitchen of kitchens) {
      const front = fourthCanteenFaces.find((row) => row.shopId === kitchen.userData.shopId)!;
      assert.deepEqual(kitchen.userData.bounds, fourthKitchenBounds(front));
      assert.ok(
        kitchen.children.some((child) => child instanceof THREE.Mesh),
        'Kitchen is actual geometry',
      );
      const actual = new THREE.Box3().setFromObject(kitchen);
      const expected = fourthKitchenBounds(front);
      assert.ok(actual.min.x <= expected.minX && actual.max.x >= expected.maxX);
      assert.ok(actual.min.z <= expected.minZ && actual.max.z >= expected.maxZ);
      assert.ok(actual.min.x >= expected.minX - 0.08 && actual.max.x <= expected.maxX + 0.08);
      assert.ok(actual.min.z >= expected.minZ - 0.08 && actual.max.z <= expected.maxZ + 0.08);
    }

    group.updateMatrixWorld(true);
    const windows: THREE.Object3D[] = [];
    for (const front of fourthCanteenFaces) {
      const builtFront = spatial.children.find((child) => child.name === front.faceId);
      assert.ok(builtFront, front.faceId);
      const actualNormal = new THREE.Vector3(0, 0, 1).transformDirection(builtFront.matrixWorld);
      close(actualNormal.x, Math.sin(front.rotationY), `${front.name} model normal x`);
      close(actualNormal.z, Math.cos(front.rotationY), `${front.name} model normal z`);
      const openings = builtFront.children.filter((child) => child.name.startsWith('window-'));
      assert.equal(openings.length, front.windowCount);
      for (const [index, opening] of openings.entries()) {
        const id = `${front.faceId}-w${index + 1}`;
        assert.equal(opening.name, `window-${id}`);
        windows.push(opening);
        const highlight = opening.children.find((child) => child.userData.baseColor);
        assert.ok(highlight);
        assert.equal(highlight.userData.id, id);
        const surface = highlight.getWorldPosition(new THREE.Vector3());
        const distanceToFrontCenter =
          (surface.x - front.x) * actualNormal.x + (surface.z - front.z) * actualNormal.z;
        assert.ok(
          distanceToFrontCenter >= FOURTH_LAYOUT.frontOffset,
          `${id} actual counter edge faces the exterior`,
        );
        const counter = opening.children.find(
          (child) =>
            child instanceof THREE.Mesh &&
            Math.abs(child.position.y - FOURTH_HEIGHTS.counter) < 1e-8,
        );
        assert.ok(counter, `${id} contains a counter at the shared height`);
        const counterBounds = new THREE.Box3().setFromObject(counter);
        const kitchen = fourthKitchenBounds(front);
        if (actualNormal.z > 0.9)
          assert.ok(counterBounds.max.z > kitchen.maxZ, `${id} reaches the lower exterior`);
        if (actualNormal.x < -0.9)
          assert.ok(counterBounds.min.x < kitchen.minX, `${id} reaches the left exterior`);
      }
    }
    assert.equal(windows.length, fourthCanteenStalls.length);
    const pickIds = new Set<string>();
    spatial.traverse((object) => {
      if (object.userData.kind === 'stall') pickIds.add(object.userData.id);
    });
    assert.deepEqual([...pickIds].sort(), fourthCanteenStalls.map((window) => window.id).sort());

    const snapshot = () => {
      const result: unknown[] = [];
      group.traverse((object) =>
        result.push({
          uuid: object.uuid,
          parent: object.parent?.uuid,
          geometry: object instanceof THREE.Mesh ? object.geometry.uuid : undefined,
          position: object.position.toArray(),
          rotation: object.rotation.toArray(),
          scale: object.scale.toArray(),
          visible: object.visible,
        }),
      );
      return result;
    };
    model.setMode('3d');
    assert.ok(spatial.visible && !plan.visible);
    const before = snapshot();
    model.setInterfaceTheme(true);
    assert.deepEqual(snapshot(), before, 'Night UI keeps every object, mesh and transform');
    model.setInterfaceTheme(false);
    assert.deepEqual(snapshot(), before, 'Day UI keeps every object, mesh and transform');
    model.setMode('plan');
    assert.ok(plan.visible && spatial.visible);
    const ceilings: THREE.Object3D[] = [];
    spatial.traverse((object) => {
      if (object.userData.planHide) ceilings.push(object);
    });
    assert.equal(ceilings.length, 12);
    assert.ok(
      ceilings.every((ceiling) => !ceiling.visible),
      'Top view reveals each occupied kitchen',
    );
  } finally {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    model?.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      if ('map' in material) (material.map as THREE.Texture | null)?.dispose();
      material.dispose();
    }
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
