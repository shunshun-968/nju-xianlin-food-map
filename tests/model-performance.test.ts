import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCanteenModel } from '../src/components/FourthCanteenModel';
import { fourthCanteenSpec, fifthCanteenSpec, sixthCanteenSpec } from '../src/data/indoor-canteens';
import { batchModel } from '../src/lib/model-batches';
import { nightLightArtwork } from '../src/lib/night-light-artwork';
import { campusRoadLights, campusWindowLights } from '../src/lib/night-lights';
import { readFileSync } from 'node:fs';
import type { CampusBasemap } from '../src/lib/campus-basemap';

function metrics(root: THREE.Object3D) {
  let meshes = 0,
    triangles = 0,
    lights = 0;
  const picks = new Set<string>();
  root.traverse((node) => {
    if (node instanceof THREE.Light) lights++;
    if (!(node instanceof THREE.Mesh)) return;
    meshes++;
    triangles +=
      ((node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3) *
      (node instanceof THREE.InstancedMesh ? node.count : 1);
    if (node.userData.kind) picks.add(node.userData.id);
  });
  return { meshes, triangles, lights, picks: [...picks].sort() };
}

test('all three canteens retain triangles, bounds, lights, picking and view boundaries after batching', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement() {
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
  try {
    for (const spec of [fourthCanteenSpec, fifthCanteenSpec, sixthCanteenSpec]) {
      const model = createCanteenModel(spec);
      const before = metrics(model.group);
      const bounds = new THREE.Box3().setFromObject(model.group);
      const roofs: THREE.Object3D[] = [];
      const instances = new Map<THREE.InstancedMesh, number[]>();
      model.group.traverse((node) => {
        if (node.userData.planHide) roofs.push(node);
        if (node instanceof THREE.InstancedMesh)
          instances.set(node, Array.from(node.instanceMatrix.array));
      });
      batchModel(model.group);
      const after = metrics(model.group);
      const result = new THREE.Box3().setFromObject(model.group);
      assert.equal(after.triangles, before.triangles);
      assert.equal(after.lights, before.lights);
      assert.deepEqual(after.picks, before.picks);
      const remainingInstances: THREE.InstancedMesh[] = [];
      model.group.traverse((node) => {
        if (node instanceof THREE.InstancedMesh) remainingInstances.push(node);
      });
      assert.equal(remainingInstances.length, instances.size);
      for (const node of remainingInstances)
        assert.deepEqual(Array.from(node.instanceMatrix.array), instances.get(node));
      assert.ok(bounds.min.distanceTo(result.min) < 1e-4);
      assert.ok(bounds.max.distanceTo(result.max) < 1e-4);
      assert.ok(after.meshes < before.meshes * 0.5);
      model.setMode('plan');
      assert.ok(roofs.every((roof) => !roof.visible));
      model.setMode('3d');
      assert.ok(roofs.every((roof) => roof.visible));
      model.setInterfaceTheme(true);
      model.tick(1);
      console.log(
        `${spec.name}: meshes ${before.meshes} → ${after.meshes}; triangles ${after.triangles} unchanged`,
      );
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('night artwork preserves every source lamp and window as scalable vector geometry', () => {
  const map: CampusBasemap = JSON.parse(
    readFileSync(new URL('../public/osm/campus-render.json', import.meta.url), 'utf8'),
  );
  const artwork = nightLightArtwork(map.features, map.venues, map.campusPath);
  const svg = decodeURIComponent(artwork.href.split(',', 2)[1]);
  assert.equal(
    (svg.match(/<use href="#lamp"/g) ?? []).length,
    campusRoadLights(map.features).length + map.venues.length * 2,
  );
  assert.equal(
    (svg.match(/<path d="M/g) ?? []).length,
    campusWindowLights(map.features, map.venues).length + (map.campusPath.startsWith('M') ? 1 : 0),
  );
  assert.match(svg, /<radialGradient/);
  assert.doesNotMatch(svg, /image\/png|image\/jpeg|<canvas/);
});
