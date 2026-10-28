import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createYifuKioskSelection, type YifuSelectionCalibration } from '../src/lib/yifu-kiosk-selection';
import { yifuKioskStall } from '../src/data/yifu-kiosk';
import { yifuNightLightingReference, type YifuNightLightingReference } from '../src/data/yifu-lighting';

function nearly(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);
}

function dimmedBackground(actual: THREE.Scene['background'], original: string) {
  assert.ok(actual instanceof THREE.Color);
  const expected = new THREE.Color(original).multiplyScalar(0.62);
  nearly(actual.r, expected.r);
  nearly(actual.g, expected.g);
  nearly(actual.b, expected.b);
}

function fixture(reference: YifuNightLightingReference = yifuNightLightingReference) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4f1ec');
  scene.environmentIntensity = 0.28;
  const model = new THREE.Group();
  const ambient = new THREE.HemisphereLight('#fff5dd', '#57554d', 2);
  const key = new THREE.DirectionalLight('#fff2cc', 2.3);
  const warmLamp = new THREE.PointLight('#ffc56d', 7);
  const lampMaterial = new THREE.MeshStandardMaterial({ emissive: '#ffc56d', emissiveIntensity: 2.4 });
  const cabinetLamp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.5, 0.02), lampMaterial);
  model.add(key, warmLamp, cabinetLamp);
  scene.add(model, ambient);
  const selection = createYifuKioskSelection(yifuKioskStall, { model, scene, fillLights: [ambient] }, reference);
  scene.add(selection.group);
  const spot = selection.group.getObjectByName('yifu-counter-focus-light') as THREE.SpotLight;
  return {
    scene, model, ambient, key, warmLamp, lampMaterial, selection, spot,
    dispose() { selection.dispose(); cabinetLamp.geometry.dispose(); lampMaterial.dispose(); },
  };
}

test('B102 selection targets the west serving counter and never accepts another window ID', () => {
  const f = fixture();
  try {
    assert.ok(f.spot instanceof THREE.SpotLight);
    assert.ok(f.spot.position.z > 0 && f.spot.position.y > 3.5);
    assert.ok(f.spot.target.position.x < -1 && f.spot.target.position.z < 0);
    assert.ok(f.spot.target.position.y >= 1 && f.spot.target.position.y < 1.4);
    assert.ok(f.spot.color.r > f.spot.color.b);
    f.selection.select('v-south-f1-cart');
    f.selection.tick(1, false);
    assert.equal(f.spot.intensity, 0);
    f.selection.select(yifuKioskStall.id);
    f.selection.tick(0.175, false);
    const middle = f.spot.intensity;
    assert.ok(middle > 0);
    nearly(f.warmLamp.intensity, 3.5);
    nearly(f.lampMaterial.emissiveIntensity, 1.2);
    f.selection.tick(0.175, false);
    assert.ok(f.spot.intensity > middle);
    nearly(f.ambient.intensity, 2 * 0.62);
    nearly(f.key.intensity, 2.3 * 0.62);
    assert.equal(f.warmLamp.intensity, 0);
    assert.equal(f.lampMaterial.emissiveIntensity, 0);
    nearly(f.scene.environmentIntensity, 0.28 * 0.62);
    dimmedBackground(f.scene.background, '#f4f1ec');
    assert.ok((f.scene.background as THREE.Color).r > 0.5, 'Daytime selection remains a clear, light room');
    const activeLights: THREE.Light[] = [];
    f.scene.traverse(node => {
      if (node instanceof THREE.Light && node.visible && node.intensity > 0) activeLights.push(node);
    });
    assert.ok(activeLights.includes(f.spot));
    assert.ok(activeLights.includes(f.ambient) && activeLights.includes(f.key));
    assert.ok(!activeLights.includes(f.warmLamp), 'Serving lamps switch off while broad fill remains');
    const steady = f.spot.intensity;
    f.selection.select(yifuKioskStall.id, true);
    f.selection.tick(0.01, false);
    assert.equal(f.spot.intensity, steady, 'Repeated selection does not flash an occupied service point');
  } finally { f.dispose(); }
});

test('day and night selection match the same normal-night surface peak after accounting for retained fill', () => {
  const f = fixture();
  try {
    f.selection.select(yifuKioskStall.id);
    f.selection.tick(0, true);
    const day = f.selection.group.userData.lightingCalibration as YifuSelectionCalibration;
    assert.ok(day.sampleCount > 500, 'Sample actual counter, display and dining surfaces rather than a single light position');
    assert.ok(day.spotUnitPeak > 0 && day.spotIntensity > 0);
    nearly(day.achievedPeak, day.referenceNightPeak);
    f.key.visible = false;
    f.selection.tick(0, true);
    const mounted = f.selection.group.userData.lightingCalibration as YifuSelectionCalibration;
    assert.ok(mounted.retainedBroadFill < day.retainedBroadFill);
    assert.ok(mounted.spotIntensity > day.spotIntensity);
    nearly(mounted.achievedPeak, day.referenceNightPeak);
    f.key.visible = true;
    f.selection.withLightingUpdate(() => {
      f.ambient.intensity = 0.9;
      f.key.intensity = 0.95;
    });
    const night = f.selection.group.userData.lightingCalibration as YifuSelectionCalibration;
    nearly(night.referenceNightPeak, day.referenceNightPeak);
    nearly(night.achievedPeak, day.referenceNightPeak);
    assert.ok(night.retainedBroadFill < day.retainedBroadFill);
    assert.ok(night.spotIntensity > day.spotIntensity, 'Less remaining room fill requires more spot contribution to reach the same surface peak');
    nearly(f.spot.intensity, night.spotIntensity);
  } finally { f.dispose(); }
});

test('night reference changes and spotlight distance affect calibration through surface illumination', () => {
  const base = fixture();
  const doubled = fixture({
    ...yifuNightLightingReference,
    pointLights: yifuNightLightingReference.pointLights.map(light => ({ ...light, intensity: light.intensity * 2 })),
    broadIntensity: yifuNightLightingReference.broadIntensity * 2,
    environmentIntensity: yifuNightLightingReference.environmentIntensity * 2,
  });
  const farther = fixture({
    ...yifuNightLightingReference,
    pointLights: yifuNightLightingReference.pointLights.map(light => ({
      ...light, position: [light.position[0], light.position[1] + 1, light.position[2]],
    })),
  });
  const shorterReach = fixture({
    ...yifuNightLightingReference,
    pointLights: yifuNightLightingReference.pointLights.map(light => ({ ...light, distance: light.distance * 0.65 })),
  });
  const calibration = (f: ReturnType<typeof fixture>) => f.selection.group.userData.lightingCalibration as YifuSelectionCalibration;
  try {
    const initial = calibration(base);
    nearly(calibration(doubled).referenceNightPeak, initial.referenceNightPeak * 2);
    assert.ok(calibration(doubled).spotIntensity > initial.spotIntensity);
    assert.ok(calibration(farther).referenceNightPeak < initial.referenceNightPeak);
    assert.ok(calibration(farther).spotIntensity < initial.spotIntensity);
    assert.ok(calibration(shorterReach).referenceNightPeak < initial.referenceNightPeak);
    for (const f of [base, doubled, farther, shorterReach])
      nearly(calibration(f).achievedPeak, calibration(f).referenceNightPeak);

    base.selection.withLightingUpdate(() => { base.spot.position.y += 2; });
    const moved = calibration(base);
    nearly(moved.referenceNightPeak, initial.referenceNightPeak);
    assert.ok(moved.spotUnitPeak < initial.spotUnitPeak);
    assert.ok(moved.spotIntensity > initial.spotIntensity, 'A farther spotlight must use more raw intensity for equal surface brightness');
    nearly(moved.achievedPeak, initial.referenceNightPeak);
  } finally {
    base.dispose(); doubled.dispose(); farther.dispose(); shorterReach.dispose();
  }
});

test('B102 closes with a fade and restores the original lamps, emissions and day background', () => {
  const f = fixture();
  try {
    f.selection.select(yifuKioskStall.id);
    f.selection.tick(1, false);
    const full = f.spot.intensity;
    f.selection.select(null);
    assert.equal(f.spot.intensity, full, 'Closing starts a fade instead of cutting the light immediately');
    f.selection.tick(0.175, false);
    assert.ok(f.spot.intensity > 0 && f.spot.intensity < full);
    f.selection.tick(0.175, false);
    assert.equal(f.spot.intensity, 0);
    assert.equal(f.ambient.intensity, 2);
    assert.equal(f.key.intensity, 2.3);
    assert.equal(f.scene.environmentIntensity, 0.28);
    assert.equal(f.warmLamp.intensity, 7);
    assert.equal(f.lampMaterial.emissiveIntensity, 2.4);
    assert.ok((f.scene.background as THREE.Color).equals(new THREE.Color('#f4f1ec')));
    f.selection.select(yifuKioskStall.id);
    f.selection.tick(0, true);
    assert.ok(f.spot.intensity > 0);
    const reduced = f.spot.intensity;
    f.selection.tick(0, false);
    assert.equal(f.spot.intensity, reduced, 'Leaving reduced motion does not rewind an already completed transition');
    f.selection.select(null);
    f.selection.tick(0, true);
    assert.equal(f.spot.intensity, 0);
  } finally { f.dispose(); }
});

test('B102 uses unobstructive plan glows, a 3D beam and no selectable lighting surfaces', () => {
  const f = fixture();
  try {
    const plan = f.selection.group.getObjectByName('yifu-selection-plan')!;
    const spatial = f.selection.group.getObjectByName('yifu-selection-spatial')!;
    f.selection.select(yifuKioskStall.id);
    f.selection.tick(0, true);
    f.selection.setMode('plan');
    assert.equal(plan.visible, true);
    assert.equal(spatial.visible, false);
    assert.ok(plan.children.every(child => child.position.x < 0 && child.position.z < 0));
    f.selection.setMode('3d');
    assert.equal(plan.visible, false);
    assert.equal(spatial.visible, true);
    f.selection.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(-1.72, 8, -0.85), new THREE.Vector3(0, -1, 0));
    assert.deepEqual(ray.intersectObject(f.selection.group, true), []);
    f.selection.group.traverse(node => assert.equal(node.userData.kind, undefined));
  } finally { f.dispose(); }
});

test('theme updates and disposal restore the latest light baseline without accumulated dimming', () => {
  const f = fixture();
  try {
    f.selection.select(yifuKioskStall.id);
    f.selection.tick(0, true);
    const night = () => {
      f.ambient.intensity = 0.9;
      f.key.intensity = 0.95;
      f.warmLamp.intensity = 12;
      f.lampMaterial.emissiveIntensity = 3.2;
      f.scene.environmentIntensity = 0.2;
    };
    // MapScene changes the background BEFORE invoking withLightingUpdate.
    f.scene.background = new THREE.Color('#252735');
    f.selection.withLightingUpdate(night);
    const firstIntensity = f.spot.intensity;
    nearly(f.ambient.intensity, 0.9 * 0.62);
    assert.equal(f.warmLamp.intensity, 0);
    assert.equal(f.lampMaterial.emissiveIntensity, 0);
    nearly(f.scene.environmentIntensity, 0.2 * 0.62);
    dimmedBackground(f.scene.background, '#252735');
    f.selection.withLightingUpdate(() => {});
    nearly(f.ambient.intensity, 0.9 * 0.62);
    assert.equal(f.spot.intensity, firstIntensity);
    f.selection.withLightingUpdate(night);
    assert.equal(f.spot.intensity, firstIntensity);

    const disposed = new Set<unknown>();
    f.selection.group.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.addEventListener('dispose', () => disposed.add(node.geometry));
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        material.addEventListener('dispose', () => disposed.add(material));
        const map = (material as THREE.MeshBasicMaterial).map;
        map?.addEventListener('dispose', () => disposed.add(map));
      }
    });
    f.selection.dispose();
    assert.equal(f.selection.group.parent, null);
    assert.equal(f.selection.group.children.length, 0);
    assert.equal(f.spot.intensity, 0);
    assert.equal(f.ambient.intensity, 0.9);
    assert.equal(f.key.intensity, 0.95);
    assert.equal(f.scene.environmentIntensity, 0.2);
    assert.equal(f.warmLamp.intensity, 12);
    assert.equal(f.lampMaterial.emissiveIntensity, 3.2);
    assert.ok(f.scene.background.equals(new THREE.Color('#252735')));
    assert.equal(disposed.size, 6, 'Three geometries, two materials and one glow texture are released');
    f.selection.dispose();
  } finally { f.dispose(); }
});

test('changing the selected background in place preserves the new theme when details close', () => {
  const f = fixture();
  try {
    f.selection.select(yifuKioskStall.id);
    f.selection.tick(0, true);
    (f.scene.background as THREE.Color).set('#252735');
    // The new environment may also be set by a caller before the callback.
    f.scene.environmentIntensity = 0.16;
    f.selection.withLightingUpdate(() => {
      f.ambient.intensity = 0.9;
      f.key.intensity = 0.95;
      f.warmLamp.intensity = 12;
      f.lampMaterial.emissiveIntensity = 3.2;
    });
    dimmedBackground(f.scene.background, '#252735');
    assert.equal(f.warmLamp.intensity, 0);
    f.selection.select(null);
    f.selection.tick(0, true);
    assert.ok((f.scene.background as THREE.Color).equals(new THREE.Color('#252735')));
    assert.equal(f.scene.environmentIntensity, 0.16);
    assert.equal(f.warmLamp.intensity, 12);
    assert.equal(f.lampMaterial.emissiveIntensity, 3.2);

    f.selection.select(yifuKioskStall.id);
    f.selection.tick(0, true);
    f.scene.background = new THREE.Color('#f4f1ec');
    f.selection.withLightingUpdate(() => {
      f.ambient.intensity = 2;
      f.key.intensity = 2.3;
      f.warmLamp.intensity = 7;
      f.lampMaterial.emissiveIntensity = 2.4;
      f.scene.environmentIntensity = 0.28;
    });
    dimmedBackground(f.scene.background, '#f4f1ec');
    nearly(f.key.intensity, 2.3 * 0.62);
    f.selection.select(null);
    f.selection.tick(0, true);
    assert.ok(f.scene.background.equals(new THREE.Color('#f4f1ec')));
    assert.equal(f.warmLamp.intensity, 7);
    assert.equal(f.scene.environmentIntensity, 0.28);
  } finally { f.dispose(); }
});
