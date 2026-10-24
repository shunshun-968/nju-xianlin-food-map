import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { addNinthSeafoodFreezers } from '../src/components/ninth-canteen-freezers';
import { createCanteenModel } from '../src/components/FourthCanteenModel';
import { ninthCanteenSpec } from '../src/data/indoor-canteens';
import { ninthCanteenStalls } from '../src/data/ninth-canteen';
import { batchModel } from '../src/lib/model-batches';

function allMeshes(root: THREE.Object3D) {
  const result: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) result.push(object);
  });
  return result;
}

function inside(object: THREE.Object3D, ancestor: THREE.Object3D) {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent)
    if (parent === ancestor) return true;
  return false;
}

function visible(object: THREE.Object3D) {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent)
    if (!parent.visible) return false;
  return true;
}

test('seafood refrigeration preserves a visible crab display and shared shop interaction', async (t) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  // Only canvas drawing is stubbed. Bounds, instancing, materials and visibility use Three.js.
  // Omitting createElementNS prevents TextureLoader from doing browser image IO in Node.
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
  const remember = (root: THREE.Object3D) => {
    for (const mesh of allMeshes(root)) {
      geometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  };
  try {
    const fixture = new THREE.Group();
    addNinthSeafoodFreezers(fixture, 5.6, 'test-seafood-shop');
    fixture.updateMatrixWorld(true);
    remember(fixture);
    const cabinet = fixture.getObjectByName('seafood-refrigerated-cabinet')!;
    const chest = fixture.getObjectByName('king-crab-freezer')!;
    const specimen = fixture.getObjectByName('king-crab-specimen')!;
    const lid = fixture.getObjectByName('crab-freezer-clear-lid') as THREE.Mesh;
    const ice = fixture.getObjectByName('crab-freezer-ice') as THREE.InstancedMesh;
    const spines = fixture.getObjectByName('king-crab-shell-and-leg-spines') as THREE.InstancedMesh;
    assert.ok(cabinet && chest && specimen && lid && ice && spines);

    await t.test(
      'the main cabinet is metal with clear doors, and the crab sits inside its clear chest',
      () => {
        const body = cabinet.getObjectByName('freezer-insulated-base') as THREE.Mesh;
        assert.ok((body.material as THREE.MeshStandardMaterial).metalness > 0.4);
        const doors = allMeshes(cabinet).filter((object) => object.name === 'freezer-glass-door');
        assert.equal(doors.length, 2);
        for (const pane of [...doors, lid]) {
          const material = pane.material as THREE.MeshPhysicalMaterial;
          assert.ok(material.transparent && material.opacity < 0.25);
          assert.equal(
            material.depthWrite,
            false,
            'Glass must not hide details behind its surface',
          );
        }
        const crabBounds = new THREE.Box3().setFromObject(specimen, true);
        const lidBounds = new THREE.Box3().setFromObject(lid, true);
        const linerBounds = new THREE.Box3().setFromObject(
          chest.getObjectByName('crab-freezer-liner')!,
          true,
        );
        const iceBounds = new THREE.Box3().setFromObject(ice, true);
        assert.ok(crabBounds.min.y > linerBounds.max.y);
        assert.ok(crabBounds.max.y < lidBounds.min.y);
        for (const axis of ['x', 'z'] as const) {
          assert.ok(crabBounds.min[axis] > lidBounds.min[axis]);
          assert.ok(crabBounds.max[axis] < lidBounds.max[axis]);
        }
        assert.ok(iceBounds.getCenter(new THREE.Vector3()).y < crabBounds.min.y);
        const shellBounds = new THREE.Box3().setFromObject(
          specimen.getObjectByName('king-crab-carapace')!,
          true,
        );
        assert.ok(
          iceBounds.max.y < shellBounds.min.y,
          'Ice stays under the shell; feet can nestle into it',
        );
        const viewOrigin = chest.localToWorld(new THREE.Vector3(0.018, 2, 0.015));
        const ray = new THREE.Raycaster(viewOrigin, new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObject(chest, true);
        assert.ok(hits.some((hit) => hit.object === lid));
        const firstOpaque = hits.find((hit) => {
          const material = (hit.object as THREE.Mesh).material as THREE.Material;
          return !material.transparent || material.opacity >= 0.95;
        });
        assert.ok(
          firstOpaque && inside(firstOpaque.object, specimen),
          'No solid lid or cabinet box blocks a close top view of the crab',
        );
      },
    );

    await t.test(
      'the supplied square artwork is a packaged asset and retains its proportions',
      () => {
        const source = new URL('../src/assets/ninth-canteen/king-crab-emblem.png', import.meta.url);
        const png = readFileSync(source);
        assert.equal(png.toString('ascii', 1, 4), 'PNG');
        assert.ok(png.readUInt32BE(16) > 128);
        assert.equal(png.readUInt32BE(16), png.readUInt32BE(20));
        const badges = allMeshes(chest).filter((object) =>
          object.name.startsWith('king-crab-user-artwork'),
        );
        assert.equal(badges.length, 2);
        assert.equal(
          badges[0].userData.sourceArtwork,
          source.href,
          'The image resolves relative to the module, independently of the checkout directory',
        );
        for (const badge of badges) {
          const geometry = badge.geometry as THREE.PlaneGeometry;
          assert.equal(geometry.parameters.width, geometry.parameters.height);
        }
      },
    );

    await t.test(
      'batching keeps finite geometry, shell spikes and glass viewing access intact',
      () => {
        const bounds = new THREE.Box3().setFromObject(fixture, true);
        const spineBounds = new THREE.Box3().setFromObject(spines, true);
        const matrices = Array.from(spines.instanceMatrix.array);
        const world = spines.matrixWorld.toArray();
        const triangles = (root: THREE.Object3D) =>
          allMeshes(root).reduce(
            (sum, object) =>
              sum +
              ((object.geometry.index?.count ?? object.geometry.getAttribute('position').count) /
                3) *
                (object instanceof THREE.InstancedMesh ? object.count : 1),
            0,
          );
        const originalTriangles = triangles(fixture);
        for (const mesh of allMeshes(specimen)) {
          for (const attribute of Object.values(mesh.geometry.attributes))
            assert.ok(Array.from(attribute.array).every(Number.isFinite));
        }
        batchModel(fixture);
        fixture.updateMatrixWorld(true);
        remember(fixture);
        assert.deepEqual(Array.from(spines.instanceMatrix.array), matrices);
        assert.deepEqual(spines.matrixWorld.toArray(), world);
        assert.ok(inside(spines, fixture));
        assert.ok(spineBounds.equals(new THREE.Box3().setFromObject(spines, true)));
        assert.equal(triangles(fixture), originalTriangles);
        const resultBounds = new THREE.Box3().setFromObject(fixture, true);
        assert.ok(bounds.min.distanceTo(resultBounds.min) < 1e-5);
        assert.ok(bounds.max.distanceTo(resultBounds.max) < 1e-5);
        assert.ok(inside(lid, fixture) && (lid.material as THREE.Material).transparent);
      },
    );

    await t.test(
      'both views retain the freezer display without creating an extra selectable shop',
      () => {
        const model = createCanteenModel(ninthCanteenSpec);
        remember(model.group);
        const root = model.group;
        const freezer = root.getObjectByName('ninth-seafood-freezers')!;
        assert.ok(freezer);
        root.updateMatrixWorld(true);
        const mainBounds = new THREE.Box3().setFromObject(
          root.getObjectByName('seafood-refrigerated-cabinet')!,
          true,
        );
        const crabBounds = new THREE.Box3().setFromObject(
          root.getObjectByName('king-crab-freezer')!,
          true,
        );
        // North is -Z. The little chest shares the frontage, not the aisle in front.
        assert.ok(
          crabBounds.max.z < mainBounds.min.z,
          'Crab freezer is north of the large cabinet',
        );
        assert.ok(
          Math.abs(crabBounds.min.x - mainBounds.min.x) < 0.15,
          'Their front edges align in one row',
        );
        assert.ok(
          crabBounds.min.x > -18.2 && crabBounds.max.x < -16.7,
          'Chest stays inside the serving frontage',
        );
        const contents = allMeshes(freezer);
        const expected = ninthCanteenStalls.map((stall) => stall.id).sort();
        assert.equal(expected.length, 11);
        for (const mode of ['3d', 'plan', '3d'] as const) {
          model.setMode(mode);
          assert.ok(contents.every(visible));
          const picks = [
            ...new Set(
              allMeshes(root)
                .filter((mesh) => mesh.userData.kind === 'stall')
                .map((mesh) => mesh.userData.id),
            ),
          ].sort();
          assert.deepEqual(picks, expected);
        }
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
