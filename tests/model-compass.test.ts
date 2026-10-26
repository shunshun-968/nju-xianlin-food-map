import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  exteriorNorth,
  getModelNorth,
  indoorNorth,
  type ModelNorth,
} from '../src/data/model-orientation';
import {
  modelCompassBearing,
  modelCompassPose,
  compassLetterPosition,
} from '../src/lib/model-compass';

const angularDifference = (a: number, b: number) => ((a - b + 540) % 360) - 180;
function bearingClose(actual: number, expected: number, tolerance = 1e-7) {
  assert.ok(Number.isFinite(actual), `Non-finite bearing: ${actual}`);
  assert.ok(actual >= 0 && actual < 360, `Bearing outside [0, 360): ${actual}`);
  assert.ok(
    Math.abs(angularDifference(actual, expected)) < tolerance,
    `${actual}° != ${expected}°`,
  );
}
function placeCamera<T extends THREE.Camera>(
  camera: T,
  yaw: number,
  elevation: number,
  radius = 50,
  target = new THREE.Vector3(),
) {
  const azimuth = THREE.MathUtils.degToRad(yaw),
    pitch = THREE.MathUtils.degToRad(elevation);
  camera.position
    .copy(target)
    .add(
      new THREE.Vector3(
        Math.sin(azimuth) * Math.cos(pitch) * radius,
        Math.sin(pitch) * radius,
        Math.cos(azimuth) * Math.cos(pitch) * radius,
      ),
    );
  // At exactly top-down, a chosen camera-up retains the intended azimuth without lookAt's singularity.
  camera.up.set(
    ...(elevation === 90
      ? ([-Math.sin(azimuth), 0, -Math.cos(azimuth)] as const)
      : ([0, 1, 0] as const)),
  );
  camera.lookAt(target);
  return camera;
}

test('documented floor directions remain distinct from the exterior world axes and cart route aliases agree', () => {
  const confirmed: Record<string, ModelNorth> = {
    'v-456-f1': { x: 1, z: 0 },
    'v-456-f2': { x: 1, z: 0 },
    'v-456-f3': { x: 1, z: 0 },
    'v-891-f1': { x: 0, z: -1 },
    'v-891-f2': { x: 0, z: -1 },
    'v-891-f3': { x: 0, z: -1 },
    'v-10-f1': { x: -1, z: 0 },
    'v-10-f2': { x: -1, z: 0 },
    'v-1112-f1': { x: 1, z: 0 },
    'v-1112-f2': { x: 1, z: 0 },
    'v-south-f1': { x: 0, z: -1 },
  };
  for (const [floorId, north] of Object.entries(confirmed)) {
    const venueId = floorId.replace(/-f\d+$/, '');
    assert.deepEqual(indoorNorth[floorId], north);
    assert.deepEqual(getModelNorth({ level: 'floor', floorId, venueId }), north);
  }
  assert.deepEqual(
    getModelNorth({ level: 'building', venueId: 'v-south' }),
    confirmed['v-south-f1'],
  );
  assert.notDeepEqual(
    getModelNorth({ level: 'building', venueId: 'v-10' }),
    getModelNorth({ level: 'floor', venueId: 'v-10', floorId: 'v-10-f2' }),
  );
  for (const venueId of ['v-hut', 'v-yifu', 'unmapped-venue']) {
    assert.equal(getModelNorth({ level: 'building', venueId }), undefined);
    assert.equal(getModelNorth({ level: 'floor', venueId, floorId: `${venueId}-f1` }), undefined);
  }
});

test('all four exterior models use already-transformed world north, including the rotated 456 factory', () => {
  const camera = placeCamera(new THREE.OrthographicCamera(-50, 50, 30, -30), 90, 35);
  for (const venueId of ['v-456', 'v-10', 'v-891', 'v-1112']) {
    assert.deepEqual(exteriorNorth[venueId], { x: 0, z: -1 });
    const north = getModelNorth({ level: 'building', venueId });
    assert.ok(north);
    // From east looking west, geographic north is screen-right for every exterior.
    // Rotating 456's metadata by its geometry root's pi/2 again would incorrectly produce 0°.
    bearingClose(modelCompassBearing(camera, north), 90);
  }
});

test('cardinal and intermediate azimuths retain horizontal bearings from level through exact top-down views', () => {
  const examples = [
    { north: { x: 0, z: -1 }, offset: 0 },
    { north: { x: 1, z: 0 }, offset: 90 },
    { north: { x: -1, z: 0 }, offset: 270 },
    { north: { x: 0, z: 1 }, offset: 180 },
  ];
  for (const yaw of [0, 17, 45, 90, 135, 180, 247, 270, 315, 359.9])
    for (const elevation of [0, 0.0001, 2.2, 25, 60, 89.9999, 90])
      for (const { north, offset } of examples) {
        const camera = placeCamera(new THREE.OrthographicCamera(-10, 10, 10, -10), yaw, elevation);
        bearingClose(modelCompassBearing(camera, north), (yaw + offset) % 360);
      }
});

test('viewport proportions, zoom, panning, camera distance and projection type do not distort the disc', () => {
  const north = { x: -1, z: 0 };
  for (const aspect of [0.35, 1, 1.6, 3.2])
    for (const zoom of [0.4, 1, 5, 14])
      for (const target of [new THREE.Vector3(), new THREE.Vector3(120, 9, -230)])
        for (const radius of [2, 50, 1000]) {
          const cameras = [
            new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.1, 2000),
            new THREE.PerspectiveCamera(55, aspect, 0.1, 2000),
          ];
          for (const camera of cameras) {
            camera.zoom = zoom;
            camera.updateProjectionMatrix();
            placeCamera(camera, 37, 31, radius, target);
            bearingClose(modelCompassBearing(camera, north), 307);
          }
        }
});

test('bearings cross the north seam continuously modulo a full turn in either direction', () => {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10);
  const north = { x: 0, z: -1 };
  const headings = [359.8, 359.9, 0, 0.1, 0.2];
  const values = headings.map((yaw) => modelCompassBearing(placeCamera(camera, yaw, 0), north));
  for (let i = 1; i < values.length; i++)
    assert.ok(Math.abs(angularDifference(values[i], values[i - 1]) - 0.1) < 1e-7);
  values.reverse();
  for (let i = 1; i < values.length; i++)
    assert.ok(Math.abs(angularDifference(values[i], values[i - 1]) + 0.1) < 1e-7);
});

test('a camera parent transform is included instead of using stale local camera axes', () => {
  const parent = new THREE.Group();
  const camera = placeCamera(new THREE.OrthographicCamera(-10, 10, 10, -10), 0, 45);
  parent.add(camera);
  parent.rotation.y = Math.PI / 2;
  bearingClose(modelCompassBearing(camera, { x: 0, z: -1 }), 90);
  parent.rotation.y = -Math.PI / 2;
  parent.position.set(12, 4, -8);
  bearingClose(modelCompassBearing(camera, { x: 0, z: -1 }), 270);
});

test('roof-plane disc and upright label anchors match actual camera projection at ordinary elevations', () => {
  const camera = new THREE.OrthographicCamera(-50, 50, 50, -50);
  const origin = new THREE.Vector3();
  for (const north of [
    { x: 0, z: -1 },
    { x: 1, z: 0 },
    { x: -1, z: 0 },
  ])
    for (const yaw of [0, 35, 90, 180, 275])
      for (const elevation of [18, 30, 60, 89.99]) {
        placeCamera(camera, yaw, elevation);
        const pose = modelCompassPose(camera, north);
        assert.equal(pose.edgeMix, 0);
        assert.ok(Math.abs(pose.scale - Math.sin(THREE.MathUtils.degToRad(elevation))) < 1e-7);
        const projectedOrigin = origin.clone().project(camera);
        const east = { x: -north.z, z: north.x };
        const directions = [north, east, { x: -north.x, z: -north.z }, { x: -east.x, z: -east.z }];
        directions.forEach((direction, i) => {
          const projected = new THREE.Vector3(direction.x * 37, 0, direction.z * 37).project(
            camera,
          );
          const label = compassLetterPosition(pose.bearing, pose.scale, i * 90);
          assert.ok(Math.abs(label.x - (50 + (projected.x - projectedOrigin.x) * 50)) < 1e-6);
          assert.ok(Math.abs(label.y - (50 - (projected.y - projectedOrigin.y) * 50)) < 1e-6);
        });
      }
});

test('near eye level smoothly becomes a readable face-on compass instead of an invisible line', () => {
  const camera = new THREE.OrthographicCamera(-50, 50, 50, -50);
  let previousScale = 1;
  for (let elevation = 0; elevation <= 90; elevation += 0.05) {
    placeCamera(camera, 43, elevation);
    const pose = modelCompassPose(camera, { x: 0, z: -1 });
    bearingClose(pose.bearing, 43);
    assert.ok(pose.scale >= 0.29 && pose.scale <= 1);
    assert.ok(
      Math.abs(pose.scale - previousScale) < 0.012,
      'no discontinuity at the fallback thresholds',
    );
    if (elevation <= 8) {
      assert.equal(pose.edgeMix, 1);
      assert.equal(pose.scale, 1);
    }
    if (elevation >= 18) assert.equal(pose.edgeMix, 0);
    previousScale = pose.scale;
  }
  const flat = modelCompassPose(placeCamera(camera, 180, 0), { x: 1, z: 0 });
  assert.equal(flat.groundScale, 0);
  assert.equal(flat.scale, 1);
});
