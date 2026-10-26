import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { catalog } from '../src/data/catalog';
import {
  exteriorBuildings,
  exteriorFrame,
  loadExteriorModel,
  pickExteriorFloor,
} from '../src/data/exterior-buildings';

function renderedResources(group: THREE.Group) {
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) resources.add(value);
    }
  });
  return resources;
}

function materialAppearance(material: THREE.MeshStandardMaterial) {
  return {
    color: material.color.toArray(),
    emissive: material.emissive.toArray(),
    emissiveIntensity: material.emissiveIntensity,
    emissiveMap: material.emissiveMap,
    roughness: material.roughness,
    metalness: material.metalness,
    opacity: material.opacity,
    transparent: material.transparent,
    map: material.map,
    envMapIntensity: material.envMapIntensity,
  };
}

test('exterior night lighting preserves entrances, daytime appearance and resource ownership', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
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
              if (key === 'measureText') return (text: string) => ({ width: text.length * 32 });
              if (key === 'createLinearGradient' || key === 'createRadialGradient')
                return () => ({ addColorStop() {} });
              return () => {};
            },
          },
        );
        return { width: 0, height: 0, getContext: () => context };
      },
    },
  });
  try {
    const counts: Record<string, number> = { 'v-456': 7, 'v-10': 4, 'v-891': 5, 'v-1112': 5 };
    for (const [venueId, spec] of Object.entries(exteriorBuildings)) {
      const model = (await loadExteriorModel(venueId, catalog))!;
      try {
        assert.equal(model.entrances.length, counts[venueId]);
        const lighting = model.group.getObjectByName('exterior-night-lighting');
        assert.ok(lighting, `${venueId}: exterior has night lighting`);
        assert.equal(lighting.visible, false, `${venueId}: starts in daytime`);
        const dayResources = renderedResources(model.group);
        const windows = [...dayResources].filter(
          (resource): resource is THREE.MeshStandardMaterial =>
            resource instanceof THREE.MeshStandardMaterial &&
            resource.userData.exteriorLighting === 'window',
        );
        assert.ok(windows.length > 0, `${venueId}: facade windows are explicitly identified`);
        const dayMaterials = new Map(
          [...dayResources]
            .filter(
              (resource): resource is THREE.MeshStandardMaterial =>
                resource instanceof THREE.MeshStandardMaterial,
            )
            .map((material) => [material, materialAppearance(material)]),
        );
        const dayFrame = exteriorFrame(model, venueId);
        const objects = new Set<THREE.Object3D>();
        model.group.traverse((object) => objects.add(object));

        model.setNight(true);
        const resources = renderedResources(model.group);
        assert.equal(lighting.visible, true, `${venueId}: night lighting is visible`);
        const litWindows = windows.filter(
          (material) => material.emissiveIntensity > 0 && material.emissive.r > 0,
        );
        assert.ok(litWindows.length > 0, `${venueId}: windows emit interior light at night`);
        assert.ok(
          litWindows.filter(
            (material) =>
              material.emissive.r > material.emissive.b &&
              material.emissive.g > material.emissive.b,
          ).length >
            litWindows.length / 2,
          `${venueId}: warm interior light dominates the window palette`,
        );
        const lights: THREE.Light[] = [];
        lighting.traverse((object) => {
          if (object instanceof THREE.Light) lights.push(object);
        });
        assert.ok(
          lights.some((light) => light.intensity > 0),
          `${venueId}: local lighting illuminates entrances and nearby surfaces`,
        );

        // 夜景补光和光晕不能截住入口点击，也不能穿透实体外墙。
        model.group.updateMatrixWorld(true);
        for (const entrance of model.entrances) {
          const floorId = spec.floors[entrance.id];
          assert.ok(
            catalog.floors.some((floor) => floor.id === floorId && floor.venueId === venueId),
          );
          const ray = new THREE.Raycaster(
            entrance.camera,
            entrance.position.clone().sub(entrance.camera).normalize(),
          );
          assert.equal(
            pickExteriorFloor(model, ray),
            floorId,
            `${venueId}/${entrance.id}: visible entrance navigates to its own dining space`,
          );
          // Place an opaque face in front of this ray: picking must stop there.
          const shield = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
          );
          shield.position.copy(ray.ray.at(1, new THREE.Vector3()));
          shield.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            ray.ray.direction.clone().negate(),
          );
          model.group.attach(shield);
          model.group.updateMatrixWorld(true);
          assert.equal(
            pickExteriorFloor(model, ray),
            null,
            'cannot click an entrance through a wall',
          );
          shield.removeFromParent();
          shield.geometry.dispose();
          shield.material.dispose();
        }
        const framing = exteriorFrame(model, venueId);
        assert.ok(Number.isFinite(framing.range) && framing.range > 10);
        assert.ok(Number.isFinite(framing.halfWidth) && framing.halfWidth > 20);
        assert.deepEqual(framing, dayFrame, `${venueId}: lighting does not change model framing`);

        for (let i = 0; i < 3; i++) {
          model.setNight(false);
          assert.equal(lighting.visible, false, `${venueId}: daytime hides night accents`);
          assert.ok(
            lights.every((light) => light.intensity === 0),
            `${venueId}: daytime switches off local lights`,
          );
          for (const [material, appearance] of dayMaterials)
            assert.deepEqual(
              materialAppearance(material),
              appearance,
              `${venueId}: daytime restores the original material`,
            );
          model.setNight(true);
        }
        const objectsAfterSwitches = new Set<THREE.Object3D>();
        model.group.traverse((object) => objectsAfterSwitches.add(object));
        assert.deepEqual(
          objectsAfterSwitches,
          objects,
          `${venueId}: repeated switching reuses scene objects`,
        );
        assert.deepEqual(
          renderedResources(model.group),
          resources,
          `${venueId}: repeated switching reuses geometry, materials and textures`,
        );
        // Every rendered resource must be released when leaving the exterior.
        const released = new Set();
        resources.forEach((resource) =>
          resource.addEventListener('dispose', () => released.add(resource)),
        );
        model.dispose();
        assert.equal(
          released.size,
          resources.size,
          `${venueId}: geometry, materials and masks released`,
        );
      } catch (error) {
        model.dispose();
        throw error;
      }
    }
    assert.equal(await loadExteriorModel('v-south', catalog), null);
    const missing = (await loadExteriorModel('v-456', { ...catalog, floors: [] }))!;
    assert.ok(
      missing.entryMeshes.every((mesh) => !mesh.userData.kind),
      'never navigate to an absent catalog floor',
    );
    missing.dispose();
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
