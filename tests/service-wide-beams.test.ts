import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSouthGateCartSelection } from '../src/lib/south-gate-cart-selection';
import { createYifuKioskSelection } from '../src/lib/yifu-kiosk-selection';
import { southGateCartStall } from '../src/data/south-gate-cart';
import { yifuKioskStall } from '../src/data/yifu-kiosk';

for (const kind of ['cart', 'yifu'] as const) {
  test(`${kind} night beam covers its service area and restores day lighting and mode`, () => {
    const scene = new THREE.Scene();
    scene.environmentIntensity = 0.28;
    const model = new THREE.Group();
    const lamp = new THREE.HemisphereLight('#ffffff', '#888888', 1.2);
    model.add(lamp);
    scene.add(model);
    const stall = kind === 'cart' ? southGateCartStall : yifuKioskStall;
    const lighting = { model, scene, fillLights: [] };
    const selection =
      kind === 'cart'
        ? createSouthGateCartSelection(stall, lighting)
        : createYifuKioskSelection(stall, lighting);
    scene.add(selection.group);
    const beam = selection.group.getObjectByName(
      kind === 'cart' ? 'south-gate-cart-soft-focus-beam' : 'yifu-soft-service-beam',
    ) as THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
    const spot = selection.group.getObjectByName(
      kind === 'cart' ? 'south-gate-cart-focus-light' : 'yifu-counter-focus-light',
    ) as THREE.SpotLight;
    try {
      selection.select(stall.id);
      selection.tick(1, true);
      const dayOpacity = beam.material.uniforms.opacity.value;
      const dayPose = spot.position.clone();
      selection.withLightingUpdate(() => {
        model.userData.night = true;
      });
      assert.ok(beam.material.uniforms.opacity.value >= dayOpacity * 4);
      assert.ok(spot.intensity > 0);
      const axis = spot.target.position.clone().sub(spot.position).normalize();
      const w = stall.position.width / 2,
        d = stall.position.depth / 2;
      for (const x of [-w, w])
        for (const z of [-d, d]) {
          const ray = new THREE.Vector3(x, kind === 'cart' ? 3.55 : 1.2, z + stall.position.z).sub(
            spot.position,
          );
          assert.ok(ray.length() < spot.distance);
          assert.ok(
            ray.normalize().dot(axis) > Math.cos(spot.angle),
            'Both ends of the service point receive the wide light',
          );
        }
      selection.setMode('plan');
      assert.ok(!beam.visible || !beam.parent!.visible, 'No upright beam obstructs the plan');
      selection.setMode('3d');
      assert.ok(beam.visible && beam.parent!.visible);
      selection.withLightingUpdate(() => {
        model.userData.night = false;
      });
      assert.equal(beam.material.uniforms.opacity.value, dayOpacity);
      assert.ok(spot.position.equals(dayPose));
      assert.ok(Math.abs(beam.scale.y - 1) < 1e-9, 'Beam returns to its original length');
      selection.select(null);
      selection.tick(1, true);
      assert.equal(spot.intensity, 0);
      assert.equal(lamp.intensity, 1.2);
    } finally {
      selection.dispose();
    }
  });
}
