import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  TWELFTH_CANTEEN_FLOOR_ID,
  twelfthCanteenFaces,
  twelfthCanteenStalls,
} from '../src/data/twelfth-canteen';
import { getIndoorCanteen, getIndoorWindow, twelfthCanteenSpec } from '../src/data/indoor-canteens';
import { createCanteenModel } from '../src/components/FourthCanteenModel';
import { createStallPickTargets } from '../src/lib/stall-picking';
import { batchModel } from '../src/lib/model-batches';
import { readNavigation, navigationPath } from '../src/lib/use-app-navigation';
import { validateCatalog } from '../src/domain';

function collect(root: THREE.Object3D, predicate: (object: THREE.Object3D) => boolean) {
  const matches: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (predicate(object)) matches.push(object);
  });
  return matches;
}
function visible(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}
const close = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function byNumber(number: number) {
  const stall = twelfthCanteenStalls.find(
    (row) => getIndoorWindow(twelfthCanteenSpec, row.id)?.windowNumber === number,
  );
  assert.ok(stall, `Missing physical window ${number}`);
  return stall;
}

test('twelfth canteen preserves the photographed 1–16 numbers, revised photo order and legible offerings', () => {
  assert.deepEqual(
    twelfthCanteenFaces.map((face) => face.name),
    ['环球食光', '粉面食界', '稻香食坊', '一方食韵'],
  );
  assert.deepEqual(
    twelfthCanteenFaces.map((face) => face.photoNumber),
    [4, 3, 2, 1],
  );
  assert.deepEqual(
    twelfthCanteenFaces.flatMap((face) => face.windowNumbers),
    Array.from({ length: 16 }, (_, i) => i + 1),
  );
  assert.equal(twelfthCanteenStalls.length, 16);
  assert.equal(new Set(twelfthCanteenStalls.map((stall) => stall.id)).size, 16);
  for (let number = 1; number <= 16; number++) {
    const stall = byNumber(number);
    assert.deepEqual(stall.dishes, []);
    assert.equal(stall.photoKey, null);
  }
  assert.equal(byNumber(1).category, '临榆炸鸡腿');
  assert.equal(byNumber(4).category, '牛肉蘸水菜／麻辣烫');
  assert.equal(byNumber(5).category, '五谷鱼粉／淮南牛肉汤');
  assert.equal(byNumber(7).category, '炒饭／石锅／汤面');
  assert.equal(byNumber(8).category, '法式焗面／瓦罐汤');
  assert.equal(byNumber(14).category, '广味轩·广式烧腊');
});

test('floor-local north runs right, every opening faces the east aisle, and the registered route resolves 2F', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  const floor = catalog.floors.find((row) => row.id === TWELFTH_CANTEEN_FLOOR_ID);
  assert.ok(floor);
  assert.equal(floor.venueId, 'v-1112');
  assert.equal(floor.level, 2);
  assert.equal(floor.name, '第十二食堂');
  assert.equal(getIndoorCanteen(floor.id), twelfthCanteenSpec);
  assert.deepEqual(
    catalog.stalls.filter((stall) => stall.floorId === floor.id),
    twelfthCanteenStalls,
  );
  for (let number = 1; number <= 16; number++) {
    const p = byNumber(number).position;
    close(p.rotationY, 0);
    close(p.z + p.depth / 2, 1);
    assert.ok(p.z < 0, 'Kitchen footprints stay behind the east-facing counter');
    if (number > 1) assert.ok(byNumber(number - 1).position.x < p.x);
  }
  const route = readNavigation(
    new URL(`https://example.test/?floor=${floor.id}&stall=${byNumber(14).id}`),
  );
  assert.deepEqual(route.view, { level: 'floor', floorId: floor.id, venueId: floor.venueId });
  assert.equal(route.stallId, byNumber(14).id);
  assert.deepEqual(
    navigationPath(route).map((entry) => entry.view.level),
    ['campus', 'building', 'floor', 'floor'],
  );
});

test('every physical opening remains independently ray-pickable from plan and the full facade regardless of catalog order', () => {
  const heights = Object.fromEntries(
    twelfthCanteenStalls.map((stall) => [stall.id, twelfthCanteenSpec.facadeHeight!]),
  );
  for (const stalls of [twelfthCanteenStalls, [...twelfthCanteenStalls].reverse()]) {
    const targets = createStallPickTargets(stalls, heights);
    for (const stall of twelfthCanteenStalls) {
      const p = stall.position;
      for (const offset of [-p.width * 0.42, 0, p.width * 0.42]) {
        targets.setMode('plan');
        assert.equal(
          targets.pick(
            new THREE.Raycaster(
              new THREE.Vector3(p.x + offset, 20, 0.7),
              new THREE.Vector3(0, -1, 0),
            ),
          ),
          stall.id,
        );
        targets.setMode('3d');
        for (const y of [0.2, 1.55, 3.7])
          assert.equal(
            targets.pick(
              new THREE.Raycaster(
                new THREE.Vector3(p.x + offset, y, 3),
                new THREE.Vector3(0, 0, -1),
              ),
            ),
            stall.id,
          );
      }
    }
    targets.setMode('plan');
    assert.equal(
      targets.pick(new THREE.Raycaster(new THREE.Vector3(0, 20, 4), new THREE.Vector3(0, -1, 0))),
      undefined,
      'Dining aisle is not a window',
    );
    for (const object of collect(targets.group, (object) => object instanceof THREE.Mesh)) {
      const mesh = object as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
});

test('the public model factory builds physical counters, rear kitchens and clear rear labels without people, then preserves them through mode changes and batching', async (t) => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
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
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const remember = (root: THREE.Object3D) =>
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
  try {
    const model = createCanteenModel(twelfthCanteenSpec);
    const root = model.group;
    root.updateMatrixWorld(true);
    remember(root);
    assert.equal(root.name, 'twelfth-canteen-straight-row');
    const plan = root.getObjectByName('plan-labels')!;
    const roofs = collect(root, (object) => !!object.userData.planHide);
    const windows = collect(root, (object) => /^twelfth-window-\d+$/.test(object.name));
    const staff = collect(root, (object) => object.name.startsWith('canteen-staff-'));
    const diners = root.getObjectByName('twelfth-diners');
    const steam = collect(root, (object) => !!object.userData.steam);
    const glass = collect(
      root,
      (object) =>
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshPhysicalMaterial &&
        object.material.transparent,
    );
    assert.ok(plan);
    assert.equal(roofs.length, 4);
    assert.equal(windows.length, 16);
    assert.equal(staff.length, 0, 'Serving staff are removed at the user’s request');
    assert.ok(
      !diners || collect(diners, (object) => object instanceof THREE.Mesh).length === 0,
      'No diners remain in the simplified working scene',
    );
    assert.ok(
      glass.length >= 16,
      'Every opening has glazing; display cases may add their own glass',
    );
    assert.ok(steam.length > 0);
    assert.ok(plan.visible && roofs.every((roof) => !visible(roof)));

    await t.test(
      'actual service geometry agrees with the catalog and kitchen backs are behind the service area',
      () => {
        for (let number = 1; number <= 16; number++) {
          const stall = byNumber(number);
          const window = root.getObjectByName(`twelfth-window-${number}`)!;
          const origin = window.getWorldPosition(new THREE.Vector3());
          close(origin.x, stall.position.x);
          const active = collect(window, (object) => !!object.userData.baseColor)[0];
          assert.ok(active);
          assert.equal(active.userData.id, stall.id);
          close(active.getWorldPosition(new THREE.Vector3()).x, stall.position.x);
          close(active.getWorldPosition(new THREE.Vector3()).z, 1, 0.15);
          const room = window.parent!;
          const glazingHit = new THREE.Raycaster(
            new THREE.Vector3(origin.x, 2.03, 2),
            new THREE.Vector3(0, 0, -1),
          ).intersectObjects(glass)[0];
          assert.ok(glazingHit, `Window ${number} retains its actual protective glass`);
          close(glazingHit.point.z, 0.36);
          const counterHit = new THREE.Raycaster(
            new THREE.Vector3(origin.x, 0.7, 2),
            new THREE.Vector3(0, 0, -1),
          ).intersectObject(room, true)[0];
          assert.ok(counterHit);
          assert.ok(
            counterHit.point.z > 0.9 && counterHit.point.z < 1.15,
            'A physical counter front exists at the selectable service edge',
          );
          const rearHit = new THREE.Raycaster(
            new THREE.Vector3(origin.x, 3.4, -1),
            new THREE.Vector3(0, 0, -1),
          ).intersectObject(room, true)[0];
          assert.ok(rearHit);
          assert.ok(rearHit.point.z < -4, 'Clear upper kitchen ray reaches its rear wall');
          const prep = window.getObjectByName('twelfth-kitchen-preparation-bench');
          assert.ok(prep);
          assert.ok(prep.getWorldPosition(new THREE.Vector3()).z < -2);
          assert.ok(window.getObjectByName('twelfth-payment-screen'));
        }
        const rearLabels = plan.children.filter((object) => object.position.z < 0);
        assert.equal(
          rearLabels.length,
          20,
          '16 window labels and four signs sit behind the kitchens',
        );
        for (const label of rearLabels) {
          const bounds = new THREE.Box3().setFromObject(label);
          assert.ok(
            bounds.max.z < -4.3,
            'Labels do not cover the preparation benches, staff or counter',
          );
        }
      },
    );

    const verifySignsAreUnoccluded = () => {
      root.updateMatrixWorld(true);
      for (const face of twelfthCanteenFaces) {
        const room = root.getObjectByName(`twelfth-section-${face.section}`)!;
        const letters = Array.from(face.name);
        for (const [index, character] of letters.entries()) {
          const letter = root.getObjectByName(`twelfth-main-letter-${face.section}-${index}`);
          assert.ok(letter instanceof THREE.Mesh);
          assert.equal(letter.userData.signText, character);
          const point = letter.getWorldPosition(new THREE.Vector3());
          const ray = new THREE.Raycaster(
            point.clone().add(new THREE.Vector3(0, 0, 2)),
            new THREE.Vector3(0, 0, -1),
          );
          const first = ray.intersectObject(root, true)[0];
          assert.ok(
            first?.object === letter,
            `${face.name} must be in front of its fascia and roof edge`,
          );
          // Trace past text planes to verify that the red physical lightbox remains behind them.
          const opaque = collect(
            root,
            (object) =>
              object instanceof THREE.Mesh &&
              !Array.isArray(object.material) &&
              !object.material.transparent &&
              !object.material.map,
          );
          const body = ray.intersectObjects(opaque)[0];
          assert.ok(body, 'Main lettering has a modeled fascia backing');
          assert.ok(body.point.z < point.z && body.point.z > 0.9);
          assert.ok(room, 'Each sign is still associated with its physical kitchen');
        }
      }
    };
    await t.test(
      'all four main signs have visible letter planes in front of their modeled lightboxes',
      verifySignsAreUnoccluded,
    );

    await t.test(
      'text textures retain their plane proportions and the glowing front panels stay within their physical fascia and counter bands',
      () => {
        const lettering = collect(
          root,
          (object) =>
            object instanceof THREE.Mesh &&
            (object.parent === plan || object.name.startsWith('twelfth-main-letter-')),
        ) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
        assert.ok(lettering.length >= 36);
        for (const mesh of lettering) {
          const image = mesh.material.map?.image as { width: number; height: number } | undefined;
          assert.ok(image && image.width > 0 && image.height > 0);
          const planeAspect = mesh.geometry.parameters.width / mesh.geometry.parameters.height;
          const textureAspect = image.width / image.height;
          assert.ok(
            Math.abs(textureAspect / planeAspect - 1) < 0.012,
            'Text canvas resizing must preserve Chinese glyph proportions',
          );
        }
        const labels = collect(plan, (object) => object.userData.kind === 'stall');
        assert.deepEqual(
          labels.map((label) => label.userData.id).sort(),
          twelfthCanteenStalls.map((stall) => stall.id).sort(),
        );
        for (const face of twelfthCanteenFaces) {
          const fascia = root.getObjectByName(`twelfth-gradient-fascia-${face.section}`);
          const counter = root.getObjectByName(`twelfth-gradient-counter-${face.section}`);
          assert.ok(fascia instanceof THREE.Mesh && counter instanceof THREE.Mesh);
          for (const panel of [fascia, counter]) {
            const material = panel.material as THREE.MeshStandardMaterial;
            assert.ok(material.map instanceof THREE.CanvasTexture);
            assert.equal(
              material.emissiveMap,
              material.map,
              'The panel gradient lights itself, rather than relying on a flat unlit color',
            );
            assert.ok(material.emissiveIntensity > 0);
            assert.ok(
              material.roughness >= 0.4,
              'Large hard specular glare is inappropriate for the softly illuminated ribbing',
            );
          }
          const fasciaBounds = new THREE.Box3().setFromObject(fascia);
          const counterBounds = new THREE.Box3().setFromObject(counter);
          const menu = root.getObjectByName(`twelfth-menu-screen-${face.windowNumbers[0]}`)!;
          const menuBounds = new THREE.Box3().setFromObject(menu);
          assert.ok(
            fasciaBounds.min.y > menuBounds.max.y && fasciaBounds.max.y < 4,
            'The upper lightbox stays above the menus and below the ceiling',
          );
          assert.ok(
            counterBounds.min.y > 0.2 && counterBounds.max.y < 1.1,
            'The lower illuminated panel stays between the plinth and black countertop',
          );
          assert.ok(counterBounds.max.y < menuBounds.min.y);
        }
      },
    );

    const metrics = () => {
      let triangles = 0;
      const picks = new Set<string>(),
        lights: number[] = [];
      root.traverseVisible((object) => {
        if (object instanceof THREE.Light) lights.push(object.intensity);
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        assert.ok(Array.from(positions.array).every(Number.isFinite));
        triangles +=
          ((object.geometry.index?.count ?? positions.count) / 3) *
          (object instanceof THREE.InstancedMesh ? object.count : 1);
        if (object.userData.kind === 'stall') picks.add(object.userData.id);
      });
      return { triangles, picks: [...picks].sort(), lights };
    };
    await t.test(
      'four ceiling assemblies alone disappear in plan while protective glass and kitchen equipment remain visible',
      () => {
        for (const mode of ['3d', 'plan'] as const) {
          model.setMode(mode);
          assert.equal(plan.visible, mode === 'plan');
          assert.ok(roofs.every((roof) => roof.visible === (mode === '3d')));
          for (const roof of roofs)
            assert.ok(roof.children.every((child) => visible(child) === (mode === '3d')));
          assert.ok(glass.every(visible));
          const equipment = collect(root, (object) => object.name.startsWith('twelfth-equipment-'));
          assert.equal(equipment.length, 16);
          assert.ok(equipment.every(visible));
          const windowLights = collect(root, (object) =>
            object.name.startsWith('twelfth-warm-window-light-'),
          );
          assert.equal(windowLights.length, 16);
          for (const light of windowLights) {
            assert.ok(light instanceof THREE.PointLight && light.intensity > 0);
            assert.ok(
              visible(light),
              'Each serving counter stays warmly lit with its ceiling removed',
            );
            for (let ancestor = light.parent; ancestor; ancestor = ancestor.parent)
              assert.ok(
                !ancestor.userData.planHide,
                'Counter lighting is independent of removable ceilings',
              );
          }
          assert.deepEqual(metrics().picks, twelfthCanteenStalls.map((stall) => stall.id).sort());
        }
      },
    );
    await t.test(
      'batching preserves visible triangles, selection IDs, lighting and animated steam in both modes',
      () => {
        const before = new Map<string, ReturnType<typeof metrics>>();
        for (const mode of ['plan', '3d'] as const) {
          model.setMode(mode);
          before.set(mode, metrics());
        }
        const initialMeshes = collect(root, (object) => object instanceof THREE.Mesh).length;
        batchModel(root);
        remember(root);
        verifySignsAreUnoccluded();
        assert.ok(collect(root, (object) => object instanceof THREE.Mesh).length < initialMeshes);
        for (const mode of ['plan', '3d'] as const) {
          model.setMode(mode);
          assert.deepEqual(metrics(), before.get(mode));
          model.setInterfaceTheme(true);
          assert.deepEqual(metrics(), before.get(mode));
          model.setInterfaceTheme(false);
          assert.ok(roofs.every((roof) => visible(roof) === (mode === '3d')));
        }
        model.tick(0);
        const positions = steam.map((puff) => puff.position.clone());
        model.tick(0.7);
        assert.ok(steam.some((puff, i) => !puff.position.equals(positions[i])));
        assert.ok(steam.every((puff) => puff.parent !== null));
      },
    );
  } finally {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
