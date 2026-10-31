import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeModelGuide } from '../src/lib/model-guide-layout';

test('guide uses the open top area above a low default model', () => {
  const point = placeModelGuide({ left: 380, top: 150, right: 1390, bottom: 820 }, 320, 210, [
    { left: 450, top: 420, right: 1300, bottom: 800 },
  ]);
  assert.equal(point.y, 255);
  assert.equal(point.x, 885);
});

test('guide moves sideways when a tall model fills the upper center', () => {
  const point = placeModelGuide({ left: 380, top: 150, right: 1390, bottom: 820 }, 320, 210, [
    { left: 750, top: 150, right: 1100, bottom: 800 },
  ]);
  assert.ok(point.x + 160 < 750 || point.x - 160 > 1100);
  assert.equal(point.y, 255);
});

test('guide stays in the available area when no candidate fully clears a large model', () => {
  const point = placeModelGuide({ left: 380, top: 150, right: 1390, bottom: 820 }, 320, 210, [
    { left: 0, top: 0, right: 1500, bottom: 900 },
  ]);
  assert.ok(point.x >= 540 && point.x <= 1230);
  assert.ok(point.y >= 255 && point.y <= 715);
});
