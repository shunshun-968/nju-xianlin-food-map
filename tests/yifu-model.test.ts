import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createYifuKioskModel } from '../src/components/YifuKioskModel';
import { yifuKioskStall } from '../src/data/yifu-kiosk';

function visible(object: THREE.Object3D) {
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent)
    if (!ancestor.visible) return false;
  return true;
}

test('the real Yifu model keeps its open south edge, single window and living details after batching', async (t) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  // Only raster drawing is stubbed. All geometry, batching, transforms,
  // materials, visibility and ray intersections use the real Three.js objects.
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
  try {
    const model = createYifuKioskModel();
    const root = model.group;
    const meshes: THREE.Mesh[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        if (object instanceof THREE.Mesh) meshes.push(object);
        geometries.add(object.geometry);
      }
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Sprite ||
        object instanceof THREE.Line
      ) {
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    root.updateMatrixWorld(true);

    await t.test('the south opening has no wall or door at eye level across its width', () => {
      assert.ok(
        meshes.some((mesh) => mesh.userData.yifuPart === 'architecture'),
        'Architectural surfaces remain identifiable after batching',
      );
      for (const x of [-2.7, -1.3, 0, 1.4, 2.7]) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(x, 1.8, 3.6),
          new THREE.Vector3(0, 0, -1),
          0,
          0.4,
        );
        // The southwest refrigerator legitimately reaches z=3.245. Test the
        // architectural enclosure, while leaving the photographed equipment in place.
        const blockers = ray
          .intersectObject(root, true)
          .filter((hit) => visible(hit.object) && hit.object.userData.yifuPart === 'architecture');
        assert.equal(blockers.length, 0, `A wall or door blocks the open south edge at x=${x}`);
      }
    });

    await t.test(
      'every real surface including walls and floor shares one ID and the retained photo-3 board can be picked',
      () => {
        const picks = new Set(meshes.map((mesh) => mesh.userData.id));
        assert.deepEqual([...picks], [yifuKioskStall.id]);
        assert.ok(
          meshes.every((mesh) => mesh.userData.kind === 'stall'),
          'No building surface is left without a window identity',
        );
        root.traverse((object) => {
          if (object instanceof THREE.Sprite) {
            assert.equal(object.userData.kind, undefined, 'Food steam must not intercept clicks');
            assert.equal(new THREE.Raycaster().intersectObject(object, false).length, 0);
          }
        });
        const board = root.getObjectByName('yifu-photo-3-standing-board');
        assert.ok(board, 'The entrance board remains after the south wall is removed');
        const target = board.localToWorld(new THREE.Vector3(0, 0.7, 0));
        const origin = board.localToWorld(new THREE.Vector3(0, 0.7, 1));
        const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, 1.5);
        const hit = ray.intersectObject(board, true).find((entry) => visible(entry.object));
        assert.ok(hit, 'The board front has a physical picking surface');
        assert.equal(hit.object.userData.kind, 'stall');
        assert.equal(hit.object.userData.id, yifuKioskStall.id);
      },
    );

    await t.test(
      'plan hides overhead fixtures, lanterns and steam, then 3D restores them without hiding the board',
      () => {
        const overhead = root.getObjectByName('suspended-fixtures');
        const lanterns = root.getObjectByName('yifu-red-lanterns');
        const steam = root.getObjectByName('yifu-gentle-food-steam');
        const board = root.getObjectByName('yifu-photo-3-standing-board');
        assert.ok(overhead && lanterns && steam && board);
        model.setMode('plan');
        assert.ok([overhead, lanterns, steam].every((object) => !visible(object)));
        assert.ok(visible(board));
        model.setMode('3d');
        assert.ok([overhead, lanterns, steam, board].every(visible));
      },
    );

    await t.test(
      'plan restores four solid walls and an inward-opening south door without closing the entry',
      () => {
        const enclosure = root.getObjectByName('yifu-plan-four-walls-and-south-door');
        const cutaway = root.getObjectByName('yifu-three-dimensional-cutaway-walls');
        const door = root.getObjectByName('yifu-plan-south-door-inward');
        const board = root.getObjectByName('yifu-photo-3-standing-board');
        assert.ok(enclosure && cutaway && door && board);
        assert.equal(visible(enclosure), false, 'The default 3D model keeps its south side open');
        model.setMode('plan');
        root.updateMatrixWorld(true);
        assert.ok(visible(enclosure));
        assert.equal(visible(cutaway), false, 'The view modes do not layer duplicate enclosures');
        assert.ok(visible(board));
        const sides = [
          [-3.3, -0.2, 1, 0],
          [3.3, -0.2, -1, 0],
          [0, -3.8, 0, 1],
          [0, 3.8, 0, -1],
        ];
        for (const [x, z, dx, dz] of sides) {
          const ray = new THREE.Raycaster(
            new THREE.Vector3(x, 1.4, z),
            new THREE.Vector3(dx, 0, dz),
            0,
            0.6,
          );
          assert.ok(
            ray.intersectObject(enclosure, true).some((hit) => visible(hit.object)),
            `Missing solid plan wall at ${x}, ${z}`,
          );
        }
        const doorway = new THREE.Raycaster(
          new THREE.Vector3(1.2, 1.4, 3.8),
          new THREE.Vector3(0, 0, -1),
          0,
          0.6,
        );
        assert.equal(
          doorway.intersectObject(enclosure, true).filter((hit) => visible(hit.object)).length,
          0,
          'South wall segments preserve the entrance gap',
        );
        assert.ok(door.position.x > 2.15 && door.position.x < 2.3);
        assert.ok(Math.abs(THREE.MathUtils.radToDeg(door.rotation.y) + 75) < 0.001);
        const doorTop = door.localToWorld(new THREE.Vector3(-0.665, 3, 0));
        const doorRay = new THREE.Raycaster(doorTop, new THREE.Vector3(0, -1, 0), 0, 1.2);
        assert.ok(
          doorRay.intersectObject(door, true).length > 0,
          'The open door has physical leaf thickness visible from above',
        );
        model.setMode('3d');
        assert.equal(visible(enclosure), false);
        assert.ok(visible(cutaway));
        assert.ok(visible(board));
      },
    );

    await t.test(
      'night lamps cast real warm light and switching back restores white tubes and daylight output',
      () => {
        const fixtures = [1, 2, 3].map((index) =>
          root.getObjectByName(`yifu-fluorescent-light-${index}`),
        );
        assert.ok(fixtures.every((light) => light instanceof THREE.PointLight));
        const lights = fixtures as THREE.PointLight[];
        const tube = [...materials].find(
          (material) => material.name === 'yifu-fluorescent-tube-surface',
        );
        assert.ok(
          tube instanceof THREE.MeshStandardMaterial,
          'The batched lamps retain their shared, mutable material',
        );
        const daylight = lights.map((light) => ({
          color: light.color.clone(),
          intensity: light.intensity,
        }));
        const dayTube = {
          color: tube.color.clone(),
          emissive: tube.emissive.clone(),
          intensity: tube.emissiveIntensity,
        };
        model.setInterfaceTheme(true);
        const warm = new THREE.Color('#ffbe65');
        for (const light of lights) {
          assert.ok(light.color.equals(warm));
          assert.ok(light.intensity > 4 && light.intensity < 7);
          assert.ok(
            light.position.y < 2.98 && light.position.y > 2.7,
            'Light originates below the tube',
          );
          assert.ok(
            light.distance > light.position.y - 0.8,
            'Light reaches the counter/table surfaces',
          );
          assert.equal(light.castShadow, false, 'Local lamps do not add shadow-map passes');
        }
        assert.ok(tube.color.equals(new THREE.Color('#ffc96d')));
        assert.ok(tube.emissive.equals(new THREE.Color('#ffae38')));
        assert.ok(
          tube.emissiveIntensity <= 1.2,
          'Warm tube color stays below white-clipping brightness',
        );
        model.setMode('plan');
        assert.ok(
          lights.every(visible),
          'Hiding ceiling fixtures does not extinguish the plan view',
        );
        model.setMode('3d');
        model.setInterfaceTheme(false);
        lights.forEach((light, index) => {
          assert.ok(light.color.equals(daylight[index].color));
          assert.equal(light.intensity, daylight[index].intensity);
        });
        assert.ok(tube.color.equals(dayTube.color));
        assert.ok(tube.emissive.equals(dayTube.emissive));
        assert.equal(tube.emissiveIntensity, dayTube.intensity);
      },
    );

    await t.test(
      'the model contains no people, lanterns still animate and all geometry stays finite',
      () => {
        assert.equal(root.getObjectByName('yifu-serving-and-collecting'), undefined);
        assert.equal(root.getObjectByName('yifu-staff-serving'), undefined);
        assert.equal(root.getObjectByName('yifu-customer-collecting'), undefined);
        const lanterns = root.getObjectByName('yifu-red-lanterns');
        assert.ok(lanterns);
        const hanging = lanterns.children.filter(
          (node) => node instanceof THREE.Group && node.userData.planHide,
        );
        assert.ok(hanging.length > 0);
        model.tick(0);
        const lanternsBefore = hanging.map((node) => node.quaternion.clone());
        model.tick(1.7);
        assert.ok(
          hanging.some((node, index) => node.quaternion.angleTo(lanternsBefore[index]) > 0.001),
        );
        root.updateMatrixWorld(true);
        root.traverse((node) =>
          assert.ok(
            node.matrixWorld.elements.every(Number.isFinite),
            `Invalid transform: ${node.name}`,
          ),
        );
        for (const mesh of meshes) {
          for (const attribute of Object.values(mesh.geometry.attributes))
            assert.ok(
              Array.from(attribute.array).every(Number.isFinite),
              `Invalid vertices: ${mesh.name}`,
            );
          if (mesh instanceof THREE.InstancedMesh)
            assert.ok(
              Array.from(mesh.instanceMatrix.array).every(Number.isFinite),
              `Invalid instances: ${mesh.name}`,
            );
        }
        assert.ok(
          meshes.length > 0 && meshes.length <= 300,
          `Expected a batched model, received ${meshes.length} meshes`,
        );
        t.diagnostic(
          `${meshes.length} meshes; no people, finite geometry and animated lanterns verified`,
        );
      },
    );
  } finally {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
