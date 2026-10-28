import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createNinanHutSelection,
  type NinanSelectionCalibration,
} from '../src/lib/ninan-hut-selection';
import { ninanHutStall } from '../src/data/ninan-hut';

function fixture() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4f1ec');
  scene.environmentIntensity = 0.28;
  const model = new THREE.Group();
  const broad = new THREE.HemisphereLight('#ffffff', '#464039', 2.3);
  const interior = new THREE.PointLight('#ffcc78', 12, 8, 2);
  interior.position.set(0.5, 2.7, 0);
  const material = new THREE.MeshStandardMaterial({ emissive: '#ffcc78', emissiveIntensity: 2 });
  const window = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  const hiddenMeal = new THREE.Group();
  const hiddenLamp = new THREE.PointLight('#ffffff', 100, 8, 2);
  hiddenLamp.position.set(3.5, 2, 6);
  hiddenMeal.add(hiddenLamp);
  hiddenMeal.visible = false;
  model.add(interior, window, hiddenMeal);
  scene.add(model, broad);
  const selection = createNinanHutSelection(ninanHutStall, { model, scene, fillLights: [broad] });
  scene.add(selection.group);
  const spot = selection.group.getObjectByName('ninan-hut-focus-light') as THREE.SpotLight;
  return {
    scene,
    broad,
    interior,
    material,
    hiddenMeal,
    hiddenLamp,
    selection,
    spot,
    dispose() {
      selection.dispose();
      window.geometry.dispose();
      material.dispose();
    },
  };
}

test('one broad selection light reaches the house roof, windows and detached breakfast tent', () => {
  const f = fixture();
  try {
    const direction = f.spot.target.position.clone().sub(f.spot.position).normalize();
    for (const point of [
      [-1.35, 3.8, -5.1],
      [2.35, 3.8, 5.1],
      [2.2, 1.5, -4.7],
      [2.55, 2.8, 5],
      [6.25, 2.8, 7.8],
      [4.4, 1.5, 6.4],
    ]) {
      const ray = new THREE.Vector3(...point).sub(f.spot.position);
      assert.ok(ray.length() < f.spot.distance, 'Every service region is within the light reach');
      assert.ok(
        ray.normalize().dot(direction) > Math.cos(f.spot.angle),
        'The full hut and tent fit inside the cone',
      );
    }
    f.selection.select('v-yifu-f1-kiosk');
    f.selection.tick(1, false);
    assert.equal(f.spot.intensity, 0);
    f.selection.select(ninanHutStall.id);
    f.selection.tick(0.175, false);
    const half = f.spot.intensity;
    assert.ok(half > 0);
    f.selection.tick(0.175, false);
    assert.ok(f.spot.intensity > half);
    assert.ok(
      f.interior.intensity > 0 && f.interior.intensity < 12,
      'A selected hut retains warm interior light',
    );
    f.selection.group.updateMatrixWorld(true);
    assert.deepEqual(
      new THREE.Raycaster(f.spot.position, direction).intersectObject(f.selection.group, true),
      [],
    );
  } finally {
    f.dispose();
  }
});

test('wide lighting stays within every roof surface baseline instead of spreading a local lamp peak', () => {
  const f = fixture();
  const calibration = () =>
    f.selection.group.userData.lightingCalibration as NinanSelectionCalibration;
  try {
    const initial = calibration();
    assert.ok(initial.sampleCount > 500);
    assert.ok(initial.normalPeak > 0 && initial.spotIntensity > 0);
    assert.ok(initial.selectedPeak <= initial.normalPeak + 1e-9);
    assert.ok(initial.maxRoofGain <= 1 + 1e-9);
    f.selection.withLightingUpdate(() => {
      f.hiddenLamp.intensity = 500;
    });
    assert.equal(
      calibration().normalPeak,
      initial.normalPeak,
      'A hidden dinner lamp must not overexpose breakfast selection',
    );
    f.hiddenMeal.visible = true;
    f.selection.tick(0, true);
    assert.equal(
      calibration().normalPeak,
      initial.normalPeak,
      'A bright counter lamp below the roof must not brighten the whole roof',
    );
    assert.equal(calibration().spotIntensity, initial.spotIntensity);
    assert.ok(calibration().maxRoofGain <= 1 + 1e-9);
    f.hiddenMeal.visible = false;
    f.selection.tick(0, true);
    assert.equal(calibration().normalPeak, initial.normalPeak);
  } finally {
    f.dispose();
  }
});

test('closing fades the light and restores the latest theme without accumulating dimming', () => {
  const f = fixture();
  try {
    f.selection.select(ninanHutStall.id);
    f.selection.tick(1, false);
    const full = f.spot.intensity;
    f.selection.select(ninanHutStall.id);
    f.selection.tick(0.01, false);
    assert.equal(f.spot.intensity, full);
    f.scene.background = new THREE.Color('#252735');
    f.scene.environmentIntensity = 0.16;
    f.selection.withLightingUpdate(() => {
      f.broad.intensity = 1.1;
      f.interior.intensity = 20;
      f.material.emissiveIntensity = 3;
    });
    const updated = f.spot.intensity;
    f.selection.withLightingUpdate(() => {});
    assert.equal(f.spot.intensity, updated);
    f.selection.select(null);
    assert.equal(f.spot.intensity, updated, 'Deselect starts from the existing amount');
    f.selection.tick(0.175, false);
    assert.ok(f.spot.intensity > 0 && f.spot.intensity < updated);
    f.selection.tick(0.175, false);
    assert.equal(f.spot.intensity, 0);
    assert.equal(f.broad.intensity, 1.1);
    assert.equal(f.interior.intensity, 20);
    assert.equal(f.material.emissiveIntensity, 3);
    assert.equal(f.scene.environmentIntensity, 0.16);
    assert.ok((f.scene.background as THREE.Color).equals(new THREE.Color('#252735')));
    f.selection.select(ninanHutStall.id);
    f.selection.tick(0, true);
    f.selection.dispose();
    assert.equal(f.interior.intensity, 20);
    assert.equal(f.material.emissiveIntensity, 3);
    assert.equal(f.scene.environmentIntensity, 0.16);
    assert.equal(f.selection.group.parent, null);
    assert.equal(f.selection.group.children.length, 0);
  } finally {
    f.dispose();
  }
});

test('repeated clicks replay a gentle bounded pulse and reduced motion skips the pulse', () => {
  const f = fixture();
  try {
    f.selection.select(ninanHutStall.id);
    f.selection.tick(1, false);
    const full = f.spot.intensity;
    f.selection.select(ninanHutStall.id, true);
    assert.equal(f.spot.intensity, full, 'Replay must not cut the light immediately');
    f.selection.tick(0.225, false);
    assert.ok(f.spot.intensity < full && f.spot.intensity > full * 0.7);
    f.selection.tick(0.225, false);
    assert.equal(f.spot.intensity, full);
    f.selection.select(ninanHutStall.id, true);
    f.selection.tick(0, true);
    assert.equal(f.spot.intensity, full, 'Reduced motion keeps a steady selected state');
  } finally {
    f.dispose();
  }
});

test('roof light calibration follows the directional light incidence rather than raw intensity', () => {
  const overhead = fixture(),
    sideways = fixture();
  const upper = new THREE.DirectionalLight('#ffffff', 2);
  upper.position.set(0, 10, 0);
  const side = new THREE.DirectionalLight('#ffffff', 2);
  side.position.set(10, 0, 0);
  try {
    // These lamps join the model through the same update path as a theme change.
    overhead.selection.withLightingUpdate(() => {
      overhead.interior.parent!.add(upper);
    });
    sideways.selection.withLightingUpdate(() => {
      sideways.interior.parent!.add(side);
    });
    const roof = overhead.selection.group.userData.lightingCalibration as NinanSelectionCalibration;
    const grazing = sideways.selection.group.userData
      .lightingCalibration as NinanSelectionCalibration;
    assert.ok(
      roof.normalPeak > grazing.normalPeak,
      'Identical power gives more roof illumination from above',
    );
    assert.ok(roof.spotIntensity > grazing.spotIntensity);
    assert.ok(roof.maxRoofGain <= 1 + 1e-9 && grazing.maxRoofGain <= 1 + 1e-9);
  } finally {
    overhead.dispose();
    sideways.dispose();
  }
});

test('night selection adds a clearly visible broad beam while preserving the day effect and restoring lamps', () => {
  const f = fixture();
  const model = f.interior.parent!;
  const beam = f.selection.group.getObjectByName('ninan-hut-soft-focus-beam') as THREE.Mesh<
    THREE.CylinderGeometry,
    THREE.ShaderMaterial
  >;
  try {
    f.selection.select(ninanHutStall.id);
    f.selection.tick(1, false);
    const dayPower = f.spot.intensity;
    const dayOpacity = beam.material.uniforms.opacity.value;
    const dayScale = beam.scale.clone();
    f.selection.withLightingUpdate(() => {
      model.userData.night = true;
    });
    assert.ok(
      f.spot.intensity > dayPower * 2,
      'Night adds substantial illumination rather than only dimming the surroundings',
    );
    assert.ok(
      beam.material.uniforms.opacity.value > dayOpacity * 8,
      'The large night beam must be clearly visible',
    );
    assert.ok(beam.scale.x > dayScale.x && beam.scale.z > dayScale.z);
    assert.ok(f.interior.intensity >= 12 * 0.5, 'Keep the warm interior visible');
    const calibration = f.selection.group.userData.lightingCalibration as NinanSelectionCalibration;
    assert.ok(calibration.maxRoofGain > 1 && calibration.maxRoofGain <= 1.6 + 1e-9);
    f.selection.withLightingUpdate(() => {
      model.userData.night = false;
    });
    assert.equal(f.spot.intensity, dayPower);
    assert.equal(beam.material.uniforms.opacity.value, dayOpacity);
    assert.ok(beam.scale.equals(dayScale));
    f.selection.withLightingUpdate(() => {
      model.userData.night = true;
    });
    f.selection.select(null);
    f.selection.tick(1, false);
    assert.equal(f.spot.intensity, 0);
    assert.equal(beam.visible, false);
    assert.equal(f.interior.intensity, 12);
    assert.equal(f.material.emissiveIntensity, 2);
  } finally {
    f.dispose();
  }
});
