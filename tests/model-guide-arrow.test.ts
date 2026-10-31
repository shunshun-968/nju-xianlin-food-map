import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createModelGuideArrow, modelGuideArrowProfiles } from '../src/lib/model-guide-arrow';

test('only the seven exterior entry scenes have an individual spatial-arrow profile', () => {
  const buildings = ['v-456', 'v-891', 'v-10', 'v-1112', 'v-hut', 'v-south', 'v-yifu'];
  assert.deepEqual(
    Object.keys(modelGuideArrowProfiles).sort(),
    buildings.map((id) => `building:${id}`).sort(),
  );
});

test('arrow sits above visible geometry, is horizontal, and ignores hidden variants and invisible pick meshes', () => {
  const content = new THREE.Group();
  const material = new THREE.MeshBasicMaterial();
  const box = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 30), material);
  box.position.y = 2;
  content.add(box);
  const hidden = new THREE.Group();
  hidden.visible = false;
  const hiddenBox = new THREE.Mesh(new THREE.BoxGeometry(1000, 1000, 1000), material);
  hidden.add(hiddenBox);
  content.add(hidden);
  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(100, 100, 100),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  );
  content.add(pick);
  content.position.set(10, 2, -7);
  const arrow = createModelGuideArrow(content, 'building:v-10', false);
  assert.equal(arrow.group.userData.roofY, 6);
  assert.equal(arrow.group.userData.baseY, 8.3);
  assert.ok(arrow.group.position.x > -15 && arrow.group.position.x < 35);
  assert.ok(arrow.group.position.z > -22 && arrow.group.position.z < 8);
  assert.equal(arrow.group.rotation.x, 0);
  assert.equal(arrow.group.rotation.z, 0);
  const bounds = new THREE.Box3().setFromObject(arrow.group);
  assert.ok(bounds.min.y >= 8.3 - 1e-6);
  assert.ok(bounds.max.y - bounds.min.y < 0.2);
  const start = arrow.group.rotation.y;
  arrow.tick(3);
  assert.notEqual(arrow.group.rotation.y, start);
  assert.equal(arrow.group.position.y, 8.3);
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(arrow.group.position.x, 100, arrow.group.position.z),
    new THREE.Vector3(0, -1, 0),
  );
  assert.deepEqual(raycaster.intersectObject(arrow.group, true), []);
  arrow.dispose();
  arrow.dispose();
  assert.equal(arrow.group.children.length, 0);
  for (const mesh of [box, hiddenBox, pick]) mesh.geometry.dispose();
  material.dispose();
  (pick.material as THREE.Material).dispose();
});
