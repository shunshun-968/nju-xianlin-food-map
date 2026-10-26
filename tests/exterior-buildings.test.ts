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

test('all reviewed exterior entrances lead to the current catalog and respect facade occlusion', async () => {
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
        // Every rendered resource must be released when leaving the exterior.
        const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
        model.group.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          resources.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            resources.add(material);
            for (const value of Object.values(material))
              if (value instanceof THREE.Texture) resources.add(value);
          }
        });
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
