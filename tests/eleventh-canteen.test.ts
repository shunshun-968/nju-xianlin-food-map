import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  ELEVENTH_CANTEEN_FLOOR_ID,
  eleventhCanteenFaces,
  eleventhCanteenStalls,
  eleventhDumplingKiosk,
} from '../src/data/eleventh-canteen';
import {
  eleventhCanteenSpec,
  getIndoorCanteen,
  getIndoorWindow,
} from '../src/data/indoor-canteens';
import { createCanteenModel } from '../src/components/FourthCanteenModel';
import { createStallPickTargets } from '../src/lib/stall-picking';
import { batchModel } from '../src/lib/model-batches';
import { readNavigation } from '../src/lib/use-app-navigation';
import { validateCatalog } from '../src/domain';

function collect(root: THREE.Object3D, predicate: (object: THREE.Object3D) => boolean) {
  const objects: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (predicate(object)) objects.push(object);
  });
  return objects;
}
function visible(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}
const close = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function byNumber(number: number) {
  const stall = eleventhCanteenStalls.find((row) =>
    getIndoorWindow(eleventhCanteenSpec, row.id)?.windowNumbers.includes(number),
  );
  assert.ok(stall, `Missing physical window ${number}`);
  return stall;
}

test('eleventh canteen maps all 18 physical numbers, only the confirmed 17–18 pair shares an identity, and the freezer remains separate', () => {
  assert.deepEqual(
    eleventhCanteenFaces.map((face) => face.name),
    ['天天主食', '秦淮食坊', '寻味江南', '食尚湘味', '靓汤佳肴'],
  );
  assert.deepEqual(
    eleventhCanteenFaces.map((face) => face.photoNumber),
    [5, 4, 3, 2, 1],
  );
  assert.deepEqual(
    eleventhCanteenFaces.flatMap((face) => face.windowNumbers),
    Array.from({ length: 18 }, (_, i) => i + 1),
  );
  assert.equal(eleventhCanteenStalls.length, 18);
  assert.equal(new Set(eleventhCanteenStalls.map((stall) => stall.id)).size, 18);
  assert.equal(byNumber(17), byNumber(18));
  assert.deepEqual(getIndoorWindow(eleventhCanteenSpec, byNumber(17).id)?.windowNumbers, [17, 18]);
  for (let i = 1; i < 17; i++) assert.notEqual(byNumber(i).id, byNumber(i + 1).id);
  for (const number of [9, 10]) assert.equal(byNumber(number).category, '减脂套餐');
  for (const number of [11, 12]) assert.equal(byNumber(number).category, '学子套餐');
  for (const number of [13, 14, 15, 16]) assert.equal(byNumber(number).category, '普通饭菜');
  assert.equal(byNumber(5).category, '金陵老卤面');
  assert.equal(byNumber(17).category, '现点小炒');
  assert.equal(
    eleventhCanteenStalls.filter((stall) => stall.id === eleventhDumplingKiosk.id).length,
    1,
  );
  assert.equal(getIndoorWindow(eleventhCanteenSpec, eleventhDumplingKiosk.id), undefined);
  for (const stall of eleventhCanteenStalls) {
    assert.deepEqual(stall.dishes, []);
    assert.equal(stall.photoKey, null);
  }
});

test('the first-floor route has rightward local north and service footprints facing the east aisle', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  const floor = catalog.floors.find((row) => row.id === ELEVENTH_CANTEEN_FLOOR_ID)!;
  assert.ok(floor);
  assert.equal(floor.level, 1);
  assert.equal(floor.name, '第十一食堂');
  assert.equal(getIndoorCanteen(floor.id), eleventhCanteenSpec);
  assert.deepEqual(
    catalog.stalls.filter((row) => row.floorId === floor.id),
    eleventhCanteenStalls,
  );
  for (let i = 1; i <= 18; i++) {
    const p = byNumber(i).position;
    close(p.rotationY, 0);
    close(p.z + p.depth / 2, 1);
    assert.ok(p.z < 0);
    if (i > 1 && i !== 18) assert.ok(byNumber(i - 1).position.x < p.x);
  }
  const route = readNavigation(
    new URL(`https://example.test/?floor=${floor.id}&stall=${byNumber(18).id}`),
  );
  assert.deepEqual(route.view, { level: 'floor', floorId: floor.id, venueId: 'v-1112' });
  assert.equal(route.stallId, byNumber(17).id);
});

test('all physical windows ray-pick their intended shop in either view, while the low freezer does not intercept taller windows', () => {
  const heights = Object.fromEntries(
    eleventhCanteenStalls.map((row) => [
      row.id,
      row.id === eleventhDumplingKiosk.id ? 1.3 : eleventhCanteenSpec.facadeHeight!,
    ]),
  );
  for (const records of [eleventhCanteenStalls, [...eleventhCanteenStalls].reverse()]) {
    const targets = createStallPickTargets(records, heights);
    const freezerPosition = eleventhDumplingKiosk.position;
    for (const face of eleventhCanteenFaces)
      for (const [index, number] of face.windowNumbers.entries()) {
        const x = face.x - face.width / 2 + ((index + 0.5) * face.width) / face.windowCount;
        targets.setMode('plan');
        assert.equal(
          targets.pick(
            new THREE.Raycaster(new THREE.Vector3(x, 20, -1), new THREE.Vector3(0, -1, 0)),
          ),
          byNumber(number).id,
        );
        targets.setMode('3d');
        for (const y of [0.3, 1.6, 3.8])
          assert.equal(
            targets.pick(
              new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1)),
            ),
            byNumber(number).id,
          );
      }
    targets.setMode('plan');
    assert.equal(
      targets.pick(
        new THREE.Raycaster(
          new THREE.Vector3(freezerPosition.x, 20, freezerPosition.z),
          new THREE.Vector3(0, -1, 0),
        ),
      ),
      eleventhDumplingKiosk.id,
    );
    assert.equal(
      targets.pick(new THREE.Raycaster(new THREE.Vector3(0, 20, 3), new THREE.Vector3(0, -1, 0))),
      undefined,
    );
    targets.setMode('3d');
    const freezerNormal = new THREE.Vector3(
      Math.sin(freezerPosition.rotationY),
      0,
      Math.cos(freezerPosition.rotationY),
    );
    assert.equal(
      targets.pick(
        new THREE.Raycaster(
          new THREE.Vector3(freezerPosition.x, 0.8, freezerPosition.z).addScaledVector(
            freezerNormal,
            3,
          ),
          freezerNormal.clone().negate(),
        ),
      ),
      eleventhDumplingKiosk.id,
    );
    assert.equal(
      targets.pick(
        new THREE.Raycaster(
          new THREE.Vector3(freezerPosition.x, 2.1, freezerPosition.z + 3),
          new THREE.Vector3(0, 0, -1),
        ),
      ),
      byNumber(5).id,
    );
    for (const object of collect(targets.group, (node) => node instanceof THREE.Mesh)) {
      const mesh = object as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
});

test('the real eleventh model retains photo-specific printed signs, physical counters, warm interiors and its independent fixtures through batching', async (t) => {
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
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  const remember = (root: THREE.Object3D) =>
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
  try {
    const model = createCanteenModel(eleventhCanteenSpec),
      root = model.group;
    root.updateMatrixWorld(true);
    remember(root);
    assert.equal(root.name, 'eleventh-canteen-straight-row');
    const plan = root.getObjectByName('plan-labels')!;
    const roofs = collect(root, (node) => !!node.userData.planHide);
    const windows = collect(root, (node) => /^eleventh-window-\d+$/.test(node.name));
    const glass = collect(root, (node) => /^eleventh-glass-\d+$/.test(node.name));
    const lamps = collect(root, (node) => node.name.startsWith('eleventh-warm-light-'));
    const steam = collect(root, (node) => !!node.userData.steam);
    assert.equal(roofs.length, 5);
    assert.equal(windows.length, 18);
    assert.equal(glass.length, 18);
    assert.equal(lamps.length, 18);
    assert.equal(collect(root, (node) => /staff|diner|guest/i.test(node.name)).length, 0);
    assert.ok(plan.visible && roofs.every((roof) => !visible(roof)));

    await t.test(
      'each numbered opening has actual service geometry, glazing and a rear kitchen, including filled self-select trays',
      () => {
        for (let number = 1; number <= 18; number++) {
          const window = root.getObjectByName(`eleventh-window-${number}`)!;
          const center = window.getWorldPosition(new THREE.Vector3());
          const p = byNumber(number).position;
          assert.ok(center.x > p.x - p.width / 2 && center.x < p.x + p.width / 2);
          const selection = collect(window, (node) => !!node.userData.baseColor)[0];
          assert.ok(selection);
          assert.equal(selection.userData.id, byNumber(number).id);
          close(selection.getWorldPosition(new THREE.Vector3()).z, 1, 0.15);
          const glassHit = new THREE.Raycaster(
            new THREE.Vector3(center.x, 2.02, 2),
            new THREE.Vector3(0, 0, -1),
          ).intersectObjects(glass)[0];
          assert.ok(glassHit);
          close(glassHit.point.z, 0.42);
          const front = new THREE.Raycaster(
            new THREE.Vector3(center.x, 0.65, 2),
            new THREE.Vector3(0, 0, -1),
          ).intersectObject(window.parent!, true)[0];
          assert.ok(front && front.point.z > 0.9 && front.point.z < 1.15);
          const back = new THREE.Raycaster(
            new THREE.Vector3(center.x, 3.35, -1),
            new THREE.Vector3(0, 0, -1),
          ).intersectObject(window.parent!, true)[0];
          assert.ok(back && back.point.z < -4);
          if (number >= 13 && number <= 16) {
            const dishes = collect(window, (node) => node.name.startsWith('serving-dish-'));
            assert.ok(dishes.length >= 3, 'Self-select food windows use real filled trays');
            assert.ok(
              dishes.every(
                (dish) => collect(dish, (node) => node instanceof THREE.Mesh).length > 10,
              ),
            );
          }
        }
        const tags = collect(plan, (node) => node.userData.kind === 'stall');
        assert.equal(tags.length, 18);
        assert.equal(new Set(tags.map((tag) => tag.userData.id)).size, 17);
        for (const label of plan.children.filter((label) => label.position.z < 0))
          assert.ok(new THREE.Box3().setFromObject(label).max.z < -4.3);
      },
    );

    await t.test(
      'adjacent counter tops, roofs and rear walls form one continuous row without spacing gaps',
      () => {
        const ordered = eleventhCanteenFaces.toSorted((a, b) => a.x - b.x);
        for (let i = 0; i < ordered.length - 1; i++) {
          const left = ordered[i],
            right = ordered[i + 1];
          for (const prefix of ['eleventh-counter-top-', 'roof-slab-']) {
            const a = root.getObjectByName(`${prefix}${left.photoNumber}`);
            const b = root.getObjectByName(`${prefix}${right.photoNumber}`);
            assert.ok(a && b, `Missing modeled ${prefix} section`);
            const aBounds = new THREE.Box3().setFromObject(a),
              bBounds = new THREE.Box3().setFromObject(b);
            close(aBounds.max.x, bBounds.min.x, 1e-4);
            close(aBounds.min.z, bBounds.min.z, 1e-4);
            close(aBounds.max.z, bBounds.max.z, 1e-4);
          }
          const joint = (left.x + left.width / 2 + right.x - right.width / 2) / 2;
          const rearHits = [-0.01, 0, 0.01].map(
            (dx) =>
              new THREE.Raycaster(
                new THREE.Vector3(joint + dx, 3.2, -1),
                new THREE.Vector3(0, 0, -1),
              ).intersectObject(root, true)[0],
          );
          assert.ok(
            rearHits.every((hit) => hit && hit.point.z < -4),
            `No hole or internal thick column interrupts the rear wall at a section seam: ${JSON.stringify({joint,left:left.name,right:right.name,hits:rearHits.map(hit=>hit?{point:hit.point.toArray(),name:hit.object.name,parent:hit.object.parent?.name,local:hit.object.position.toArray()}:null)})}`,
          );
          close(rearHits[0].point.z, rearHits[2].point.z, 1e-4);
        }
      },
    );

    const verifySigns = () => {
      root.updateMatrixWorld(true);
      for (const face of eleventhCanteenFaces) {
        const sign = root.getObjectByName(`eleventh-main-sign-${face.photoNumber}`);
        assert.ok(sign instanceof THREE.Mesh);
        assert.equal(sign.userData.signText, face.name);
        assert.ok(
          sign.material instanceof THREE.MeshBasicMaterial &&
            sign.material.map instanceof THREE.CanvasTexture,
        );
        const point = sign.getWorldPosition(new THREE.Vector3());
        const ray = new THREE.Raycaster(
          point.clone().add(new THREE.Vector3(0, 0, 3)),
          new THREE.Vector3(0, 0, -1),
        );
        assert.equal(
          ray.intersectObject(root, true)[0]?.object,
          sign,
          'Printed main board must remain ahead of roof and backing',
        );
        const canvas = sign.material.map.image as { width: number; height: number };
        const geometry = sign.geometry as THREE.PlaneGeometry;
        close(
          canvas.width / canvas.height / (geometry.parameters.width / geometry.parameters.height),
          1,
          0.012,
        );
      }
      assert.equal(collect(root, (node) => node.name.startsWith('eleventh-led-sign-')).length, 3);
      for (const label of plan.children) {
        if (!(label instanceof THREE.Mesh)) continue;
        const geometry = label.geometry as THREE.PlaneGeometry;
        const canvas = (label.material as THREE.MeshBasicMaterial).map?.image as {
          width: number;
          height: number;
        };
        assert.ok(canvas);
        close(
          canvas.width / canvas.height / (geometry.parameters.width / geometry.parameters.height),
          1,
          0.012,
        );
      }
    };
    await t.test(
      'all five printed banners are visible and use proportionate textures rather than glowing red fascia materials',
      verifySigns,
    );

    await t.test(
      'the purple freezer and tray trolleys occupy the photographed aisle positions without becoming kitchen objects',
      () => {
        const freezer = root.getObjectByName('eleventh-dumpling-freezer')!;
        assert.ok(freezer);
        const p = freezer.getWorldPosition(new THREE.Vector3());
        close(p.x, eleventhDumplingKiosk.position.x);
        close(p.z, eleventhDumplingKiosk.position.z);
        const bounds = new THREE.Box3().setFromObject(freezer);
        assert.ok(
          bounds.max.y <= 1.3 && bounds.min.z > 1.5,
          'Freezer is short and in front of the continuous counter',
        );
        assert.equal(collect(freezer, (node) => node.name === 'freezer-glass-lid').length, 2);
        assert.ok(collect(freezer, (node) => node.name === 'dumpling-packet').length >= 6);
        const selected = root.getObjectByName('eleventh-freezer-selection')!;
        assert.equal(selected.userData.id, eleventhDumplingKiosk.id);
        const trolleys = collect(root, (node) => node.name.startsWith('eleventh-tray-trolley-'));
        assert.equal(trolleys.length, 4);
        assert.ok(
          trolleys.every(
            (trolley) =>
              collect(trolley, (node) => node.name === 'stacked-serving-tray').length > 20,
          ),
        );
        assert.ok(
          bounds.max.z - bounds.min.z > bounds.max.x - bounds.min.x,
          'The freezer long axis runs into the aisle after its quarter turn',
        );
        const warning = root.getObjectByName('eleventh-wet-floor-sign')!;
        assert.ok(warning);
        const front = root.getObjectByName('wet-floor-front-panel')!;
        const back = root.getObjectByName('wet-floor-back-panel')!;
        assert.ok(front && back);
        const topFront = front.localToWorld(new THREE.Vector3(0, 0.495, 0));
        const topBack = back.localToWorld(new THREE.Vector3(0, 0.495, 0));
        const footFront = front.localToWorld(new THREE.Vector3(0, -0.51, 0));
        const footBack = back.localToWorld(new THREE.Vector3(0, -0.51, 0));
        assert.ok(
          Math.abs(footFront.z - footBack.z) > Math.abs(topFront.z - topBack.z) + 0.4,
          'A-frame feet must spread wider than the top hinge',
        );
        for (const [name, sign] of [
          ['wet-floor-front-caption', 1],
          ['wet-floor-back-caption', -1],
        ] as const) {
          const caption = root.getObjectByName(name)!;
          assert.ok(caption);
          const normal = new THREE.Vector3(0, 0, 1).transformDirection(caption.matrixWorld);
          assert.ok(
            normal.y > 0 && normal.z * sign > 0,
            'Both captions face outward and upward, not into the folded sign',
          );
        }
      },
    );

    const metrics = () => {
      let triangles = 0;
      const picks = new Set<string>(),
        lights: number[] = [];
      root.traverseVisible((node) => {
        if (node instanceof THREE.Light) lights.push(node.intensity);
        if (!(node instanceof THREE.Mesh)) return;
        const positions = node.geometry.getAttribute('position');
        assert.ok(Array.from(positions.array).every(Number.isFinite));
        triangles +=
          ((node.geometry.index?.count ?? positions.count) / 3) *
          (node instanceof THREE.InstancedMesh ? node.count : 1);
        if (node.userData.kind === 'stall') picks.add(node.userData.id);
      });
      return { triangles, picks: [...picks].sort(), lights };
    };
    await t.test(
      'only five roof groups disappear in plan, while all 18 warm lights, glazing and equipment stay visible',
      () => {
        for (const mode of ['plan', '3d'] as const) {
          model.setMode(mode);
          assert.equal(plan.visible, mode === 'plan');
          assert.ok(roofs.every((roof) => visible(roof) === (mode === '3d')));
          assert.ok(glass.every(visible));
          assert.ok(windows.every(visible));
          for (const light of lamps) {
            assert.ok(
              light instanceof THREE.PointLight &&
                light.intensity > 0 &&
                light.color.r > light.color.g &&
                light.color.g > light.color.b,
            );
            assert.ok(visible(light));
            for (let ancestor = light.parent; ancestor; ancestor = ancestor.parent)
              assert.ok(!ancestor.userData.planHide);
          }
          assert.deepEqual(metrics().picks, eleventhCanteenStalls.map((stall) => stall.id).sort());
        }
      },
    );
    await t.test(
      'batching preserves finite geometry, bounds, visible surfaces, shop identities and warm lighting in both views',
      () => {
        const before = new Map<string, ReturnType<typeof metrics>>();
        for (const mode of ['plan', '3d'] as const) {
          model.setMode(mode);
          before.set(mode, metrics());
        }
        const bounds = new THREE.Box3().setFromObject(root);
        const meshes = collect(root, (node) => node instanceof THREE.Mesh).length;
        batchModel(root);
        root.updateMatrixWorld(true);
        remember(root);
        const afterBounds = new THREE.Box3().setFromObject(root);
        for (const axis of ['x', 'y', 'z'] as const) {
          close(afterBounds.min[axis], bounds.min[axis], 1e-4);
          close(afterBounds.max[axis], bounds.max[axis], 1e-4);
        }
        assert.ok(collect(root, (node) => node instanceof THREE.Mesh).length < meshes);
        verifySigns();
        for (const mode of ['plan', '3d'] as const) {
          model.setMode(mode);
          assert.deepEqual(metrics(), before.get(mode));
          model.setInterfaceTheme(true);
          assert.deepEqual(metrics(), before.get(mode));
          model.setInterfaceTheme(false);
        }
        assert.ok(steam.length > 0);
        model.tick(0);
        const ys = steam.map((puff) => puff.position.y);
        model.tick(0.9);
        assert.ok(
          steam.every((puff, i) => puff.position.y !== ys[i]),
          'Both standalone and reused counter steam remain animated',
        );
        assert.ok(steam.every((puff) => puff.parent));
      },
    );
  } finally {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
