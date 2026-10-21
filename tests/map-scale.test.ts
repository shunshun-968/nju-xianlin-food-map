import test from 'node:test';
import assert from 'node:assert/strict';
import calibration from '../src/data/map-calibration.json';
import { mapScaleBar } from '../src/lib/map-scale';

test('scale bar represents its labeled ground distance at every zoom', () => {
  for (const pixelsPerUnit of [0.18, 0.35, 0.7, 1.4, 2.8, 4]) {
    const bar = mapScaleBar(pixelsPerUnit);
    assert(
      Math.abs((bar.pixels / pixelsPerUnit) * calibration.horizontalMetersPerUnit - bar.distance) <
        1e-8,
    );
    assert(bar.pixels <= 120 && bar.pixels >= 47);
    assert(!bar.label.includes('约'));
  }
});

test('OSM calibration control points retain a small fit residual', () => {
  assert.equal(calibration.controls.length, 5);
  assert(calibration.rmsResidualMeters < 5);
  assert(calibration.maxResidualMeters < 8);
  for (const point of calibration.controls)
    assert.match(point.source, /^https:\/\/www.openstreetmap.org\/way\/\d+$/);
});
