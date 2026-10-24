import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCanteenModel } from '../src/components/FourthCanteenModel';
import { ninthCanteenSpec } from '../src/data/indoor-canteens';
import { ninthCanteenFaces, ninthCanteenStalls } from '../src/data/ninth-canteen';
import { batchModel } from '../src/lib/model-batches';

function collect(root: THREE.Object3D, predicate: (object: THREE.Object3D) => boolean) {
  const result: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (predicate(object)) result.push(object);
  });
  return result;
}
function visible(object: THREE.Object3D) {
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent)
    if (!ancestor.visible) return false;
  return true;
}
function triangleCount(mesh: THREE.Mesh) {
  return (
    ((mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3) *
    (mesh instanceof THREE.InstancedMesh ? mesh.count : 1)
  );
}
function metrics(root: THREE.Object3D) {
  let meshes = 0,
    triangles = 0,
    lights = 0;
  const picks = new Set<string>();
  root.traverse((object) => {
    if (object instanceof THREE.Light) lights++;
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    triangles += triangleCount(object);
    if (object.userData.kind === 'stall') picks.add(object.userData.id);
  });
  return { meshes, triangles, lights, picks: [...picks].sort() };
}

test('the ninth model preserves real room geometry, indoor life and picking through view changes and batching', async (t) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  // Only raster drawing is stubbed. Geometry, transforms, materials, lights,
  // instancing, rays and visibility all use the real Three.js implementation.
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
  const rememberResources = (root: THREE.Object3D) =>
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
    const model = createCanteenModel(ninthCanteenSpec);
    const root = model.group;
    root.updateMatrixWorld(true);
    rememberResources(root);
    const plan = root.getObjectByName('plan-labels')!;
    const roofs = collect(root, (object) => !!object.userData.planHide);
    const staff = collect(root, (object) => object.name.startsWith('canteen-staff-'));
    const details = collect(root, (object) => object.name.startsWith('counter-details-'));
    const selections = collect(root, (object) => !!object.userData.baseColor);
    const steam = collect(root, (object) => !!object.userData.steam) as THREE.Mesh[];
    const dining = root.getObjectByName('ninth-dining-room')!;

    await t.test(
      'shared frontages occupy one room per shop, with an open Pizza Hut entrance',
      () => {
        const rooms = collect(root, (object) => object.name.startsWith('ninth-room-'));
        const shopIds = new Set(ninthCanteenFaces.map((face) => face.shopId));
        assert.equal(rooms.length, shopIds.size);
        for (const shop of shopIds)
          assert.equal(rooms.filter((room) => room.name === `ninth-room-${shop}`).length, 1);
        for (const shop of ['yue-qing-he', 'pizza-hut']) {
          const room = root.getObjectByName(`ninth-room-${shop}`)!;
          const expected = ninthCanteenFaces.find((face) => face.shopId === shop)!.kitchenBounds!;
          const bounds = new THREE.Box3().setFromObject(room);
          assert.ok(Math.abs(bounds.min.x - expected.minX) < 0.12);
          assert.ok(Math.abs(bounds.max.x - expected.maxX) < 0.12);
          assert.ok(Math.abs(bounds.min.z - expected.minZ) < 0.12);
          assert.ok(Math.abs(bounds.max.z - expected.maxZ) < 0.12);
        }
        const pizzaRoom = root.getObjectByName('ninth-room-pizza-hut')!;
        const intoRestaurant = new THREE.Raycaster(
          new THREE.Vector3(-14, 0.4, 7.8),
          new THREE.Vector3(0, 0, 1),
        );
        const firstWall = intoRestaurant.intersectObject(pizzaRoom, true)[0];
        assert.ok(firstWall, 'The dining room keeps a low rear wall in the architectural cutaway');
        assert.ok(
          firstWall.point.z > 13.3,
          'The north-facing glazed entrance is not blocked by a solid front wall',
        );
        intoRestaurant.ray.origin.y = 1.8;
        assert.ok(
          intoRestaurant.intersectObject(pizzaRoom, true).every((hit) => hit.point.z > 13.3),
          'The cutaway stays open at eye level',
        );
      },
    );

    await t.test(
      'the actual recessed counter agrees with its catalog service edge and decoration is not selectable',
      () => {
        const recessed = root.getObjectByName('roujiamo-recessed-counter')!;
        assert.ok(recessed);
        assert.equal(recessed.position.z, -4.4);
        const counterPosition = recessed.getWorldPosition(new THREE.Vector3());
        assert.ok(Math.abs(counterPosition.z - -7.4) < 1e-8);
        const selected = collect(recessed, (object) => !!object.userData.baseColor);
        assert.equal(selected.length, 1);
        const stall = ninthCanteenStalls.find((row) => row.id.endsWith('-roujiamo-w1'))!;
        assert.equal(selected[0].userData.id, stall.id);
        const rearArea = stall.serviceAreas![0];
        const serviceZ = rearArea.z + rearArea.depth / 2;
        const actualEdge = selected[0].getWorldPosition(new THREE.Vector3());
        assert.ok(Math.abs(actualEdge.x - rearArea.x) < 1e-8);
        assert.ok(
          Math.abs(actualEdge.z - serviceZ) < 0.25,
          'The physical counter sits on the rear pick surface',
        );
        for (const face of ninthCanteenFaces.filter((face) => face.displayOnly)) {
          const frontage = root.getObjectByName(face.faceId)!;
          assert.ok(frontage);
          assert.deepEqual(
            collect(frontage, (object) => object.userData.kind === 'stall'),
            [],
          );
          if (face.role === 'feature-wall')
            assert.deepEqual(
              collect(frontage, (object) => object.name.startsWith('counter-details-')),
              [],
            );
        }
        assert.deepEqual(metrics(root).picks, ninthCanteenStalls.map((stall) => stall.id).sort());
      },
    );

    await t.test('the photographed left L-counter leaves the right passage physically open', () => {
      const frontage = root.getObjectByName('v-891-f3-roast-goose')!;
      const counterGroups = ['roast-goose-front-counter', 'roast-goose-return-counter'].map(
        (name) => root.getObjectByName(name)!,
      );
      assert.ok(counterGroups.every(Boolean));
      const ids = counterGroups.flatMap((counter) =>
        collect(counter, (object) => object.userData.kind === 'stall').map(
          (object) => object.userData.id,
        ),
      );
      assert.deepEqual(ids, ['v-891-f3-roast-goose-w1', 'v-891-f3-roast-goose-w1']);
      for (const height of [0.6, 1.15, 1.8, 2.4]) {
        const intoAisle = new THREE.Raycaster(
          new THREE.Vector3(1.6, height, -1),
          new THREE.Vector3(0, 0, -1),
          0,
          7,
        );
        assert.equal(
          intoAisle.intersectObject(frontage, true).length,
          0,
          `Open aisle at height ${height}`,
        );
      }
      const fromPassage = new THREE.Raycaster(
        new THREE.Vector3(1.6, 0.65, -5),
        new THREE.Vector3(-1, 0, 0),
      );
      assert.ok(fromPassage.intersectObject(counterGroups[1], true).length > 0);
    });

    await t.test('the shared Yue Qing He corner has no column above the continuous counter', () => {
      const cornerFaces = ninthCanteenFaces.filter((face) => face.shopId === 'yue-qing-he');
      const eyeLevelCorner = new THREE.Box3(
        new THREE.Vector3(-18.12, 1.8, -2.15),
        new THREE.Vector3(-17.88, 2.6, -1.88),
      );
      for (const face of cornerFaces) {
        const frontage = root.getObjectByName(face.faceId)!;
        const blockers = collect(
          frontage,
          (object) =>
            object instanceof THREE.Mesh &&
            new THREE.Box3().setFromObject(object).intersectsBox(eyeLevelCorner),
        );
        assert.equal(blockers.length, 0, `${face.faceId}: no pillar at the shared corner`);
      }
    });

    await t.test(
      'the actual main-row roofs and walls retain a plain L outline without rear projections',
      () => {
        model.setMode('3d');
        const rooms = collect(root, (object) => object.name.startsWith('ninth-room-')).filter(
          (room) =>
            !['pizza-hut', 'burger-king', 'tray-return'].some(
              (id) => room.name === `ninth-room-${id}`,
            ),
        );
        for (const face of ninthCanteenFaces.filter(
          (face) => face.rotationY === 0 && face.shopId !== 'yue-qing-he',
        )) {
          const bounds = new THREE.Box3().setFromObject(
            root.getObjectByName(`ninth-room-${face.shopId}`)!,
          );
          assert.ok(Math.abs(bounds.min.z + 10.6) < 0.12, `${face.shopId}: straight rear wall`);
        }
        for (const face of ninthCanteenFaces.filter(
          (face) => face.rotationY === -Math.PI / 2 && face.shopId !== 'yue-qing-he',
        )) {
          const bounds = new THREE.Box3().setFromObject(
            root.getObjectByName(`ninth-room-${face.shopId}`)!,
          );
          assert.ok(Math.abs(bounds.max.x + 12) < 0.12, `${face.shopId}: straight return wall`);
        }
        const roofAt = (x: number, z: number) =>
          new THREE.Raycaster(
            new THREE.Vector3(x, 5, z),
            new THREE.Vector3(0, -1, 0),
            0,
            2,
          ).intersectObjects(rooms, true).length > 0;
        for (const [x, z] of [
          [-15, -16],
          [-15, -10],
          [-15, -3],
          [-7, -8],
          [0, -8],
          [5, -8],
          [15, -8],
        ])
          assert.ok(roofAt(x, z), `Continuous L interior at ${x}, ${z}`);
        for (const [x, z] of [
          [-10, -12],
          [0, -12],
          [15, -12],
          [-10, -16],
          [19, -5],
          [-20, -8],
        ])
          assert.ok(!roofAt(x, z), `No rear projection at ${x}, ${z}`);
      },
    );

    await t.test(
      'plan removes only the roofs, retaining people, counter equipment and dining furniture',
      () => {
        assert.ok(
          roofs.length > 0 && staff.length > 0 && details.length > 0 && selections.length > 0,
        );
        assert.ok(dining && steam.length > 0);
        const retained = [...staff, ...details, ...selections, dining];
        const visibleMeshes = (object: THREE.Object3D) =>
          collect(object, (child) => child instanceof THREE.Mesh && visible(child)).map(
            (child) => child.uuid,
          );
        model.setMode('3d');
        const original = retained.map(visibleMeshes);
        assert.ok(original.every((meshes) => meshes.length > 0));
        model.setMode('plan');
        assert.ok(plan.visible && roofs.every((roof) => !visible(roof)));
        assert.ok(retained.every(visible));
        assert.deepEqual(retained.map(visibleMeshes), original);
        model.setMode('3d');
        assert.ok(!plan.visible && roofs.every(visible));
        assert.deepEqual(retained.map(visibleMeshes), original);
      },
    );

    const checkTheme = () => {
      const structuralSnapshot = () =>
        collect(root, () => true).map((object) => ({
          uuid: object.uuid,
          parent: object.parent?.uuid,
          geometry: object instanceof THREE.Mesh ? object.geometry.uuid : undefined,
          position: object.position.toArray(),
          quaternion: object.quaternion.toArray(),
          scale: object.scale.toArray(),
          visible: object.visible,
          intensity: object instanceof THREE.Light ? object.intensity : undefined,
          lightColor: object instanceof THREE.Light ? object.color.toArray() : undefined,
        }));
      const lights = collect(root, (object) => object instanceof THREE.Light) as THREE.Light[];
      assert.ok(lights.length > 0 && lights.every((light) => light.intensity > 0));
      for (const mode of ['plan', '3d'] as const) {
        model.setMode(mode);
        const before = structuralSnapshot();
        model.setInterfaceTheme(true);
        assert.deepEqual(
          structuralSnapshot(),
          before,
          `${mode}: night UI keeps indoor geometry and light`,
        );
        model.setInterfaceTheme(false);
        assert.deepEqual(
          structuralSnapshot(),
          before,
          `${mode}: day UI keeps indoor geometry and light`,
        );
      }
    };
    await t.test(
      'interface day and night preserve indoor lighting and structure in both modes',
      checkTheme,
    );

    await t.test(
      'batching preserves triangle count, world bounds, instances, lights and stable picking IDs',
      () => {
        model.setMode('3d');
        root.updateMatrixWorld(true);
        const before = metrics(root);
        const bounds = new THREE.Box3().setFromObject(root);
        const instances = new Map<
          THREE.InstancedMesh,
          { count: number; transforms: number[]; world: number[] }
        >();
        root.traverse((object) => {
          if (object instanceof THREE.InstancedMesh)
            instances.set(object, {
              count: object.count,
              transforms: Array.from(object.instanceMatrix.array),
              world: object.matrixWorld.toArray(),
            });
        });
        assert.ok(instances.size > 0, 'Food and dining furniture use genuine instanced geometry');
        batchModel(root);
        rememberResources(root);
        root.updateMatrixWorld(true);
        const after = metrics(root);
        const resultBounds = new THREE.Box3().setFromObject(root);
        assert.equal(after.triangles, before.triangles);
        assert.equal(after.lights, before.lights);
        assert.deepEqual(after.picks, before.picks);
        assert.ok(after.meshes < before.meshes);
        assert.ok(bounds.min.distanceTo(resultBounds.min) < 1e-4);
        assert.ok(bounds.max.distanceTo(resultBounds.max) < 1e-4);
        const remaining = collect(
          root,
          (object) => object instanceof THREE.InstancedMesh,
        ) as THREE.InstancedMesh[];
        assert.equal(remaining.length, instances.size);
        for (const object of remaining) {
          const original = instances.get(object)!;
          assert.ok(original);
          assert.equal(object.count, original.count);
          assert.deepEqual(Array.from(object.instanceMatrix.array), original.transforms);
          assert.deepEqual(object.matrixWorld.toArray(), original.world);
        }
        const coreTriangles = () =>
          collect(root, (object) => {
            if (!(object instanceof THREE.Mesh) || !visible(object)) return false;
            for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent)
              if (parent === plan || parent.userData.planHide) return false;
            return true;
          }).reduce((total, object) => total + triangleCount(object as THREE.Mesh), 0);
        const core = coreTriangles();
        model.setMode('plan');
        assert.ok(roofs.every((roof) => !visible(roof)));
        assert.ok(selections.every(visible));
        assert.ok(remaining.every(visible));
        assert.equal(coreTriangles(), core);
        model.setMode('3d');
        assert.ok(roofs.every(visible));
        assert.equal(coreTriangles(), core);
        checkTheme();
        t.diagnostic(
          `Meshes ${before.meshes} → ${after.meshes}; ${after.triangles} triangles and ${remaining.length} instanced meshes preserved`,
        );
      },
    );

    await t.test('animated steam remains independent of static batches', () => {
      assert.ok(steam.every((puff) => !!puff.parent));
      model.tick(0);
      const initial = steam.map((puff) => puff.position.y);
      model.tick(0.5);
      assert.ok(steam.some((puff, index) => puff.position.y !== initial[index]));
      assert.ok(steam.every((puff) => Number.isFinite(puff.position.y) && visible(puff)));
    });
  } finally {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
