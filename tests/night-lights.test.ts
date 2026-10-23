import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CampusBasemap, MapFeature } from '../src/lib/campus-basemap';
import {
  campusRoadLights,
  campusWindowLights,
  maximumRoadLights,
  roadLightSpacing,
} from '../src/lib/night-lights';

const map: CampusBasemap = JSON.parse(
  readFileSync(new URL('../public/osm/campus-render.json', import.meta.url), 'utf8'),
);
const road: MapFeature = {
  id: 'test-road',
  kind: 'road',
  name: '',
  path: '',
  area: 0,
  bounds: [0, 0, 200, 0],
  centre: [100, 0],
  inCampus: true,
  width: 8,
  lines: [
    [
      [0, 0],
      [200, 0],
    ],
  ],
};

test('road lamps use metre spacing across source vertices and stay beside the road', () => {
  const expected = campusRoadLights([road]);
  const segmented = campusRoadLights([
    {
      ...road,
      lines: [
        [
          [0, 0],
          [15, 0],
          [75, 0],
          [200, 0],
        ],
      ],
    },
  ]);
  assert.deepEqual(segmented, expected);
  const ordered = [...expected].sort((a, b) => a.point[0] - b.point[0]);
  assert.equal(ordered.length, 4);
  ordered.forEach((lamp, index) => {
    assert.equal(lamp.point[0], roadLightSpacing / 2 + roadLightSpacing * index);
    assert.equal(Math.abs(lamp.point[1]), road.width! / 2 + 1.4);
  });
});

test('footpaths and outside roads receive no lamp geometry', () => {
  assert.deepEqual(
    campusRoadLights([
      { ...road, footway: true },
      { ...road, id: 'outside', inCampus: false },
      { ...road, id: 'unknown', inCampus: undefined },
    ]),
    [],
  );
});

test('the actual campus lighting is stable, sparse, capped and deduplicated', () => {
  const lamps = campusRoadLights(map.features);
  assert.ok(lamps.length > 200 && lamps.length <= maximumRoadLights);
  assert.deepEqual(campusRoadLights([...map.features].reverse()), lamps);
  assert.deepEqual(campusRoadLights([...map.features, ...map.features]), lamps);
  for (let i = 0; i < lamps.length; i++) {
    assert.ok(lamps[i].point.every(Number.isFinite));
    for (let j = i + 1; j < lamps.length; j++) {
      assert.ok(
        Math.hypot(lamps[i].point[0] - lamps[j].point[0], lamps[i].point[1] - lamps[j].point[1]) >=
          23,
      );
    }
  }
});

test('window strips illuminate one real facade without tracing entire roofs or food buildings', () => {
  const windows = campusWindowLights(map.features, map.venues);
  assert.ok(windows.length > 30 && windows.length <= 100);
  assert.deepEqual(campusWindowLights([...map.features].reverse(), map.venues), windows);
  for (const window of windows) {
    const building = map.features.find((feature) => feature.id === window.id)!;
    assert.equal(building.inCampus, true);
    assert.ok(!map.venues.some((venue) => venue.osmId === window.id));
    const length = Math.hypot(window.to[0] - window.from[0], window.to[1] - window.from[1]);
    assert.ok(length >= 10 - 1e-8 && length <= 48 + 1e-8);
    // Endpoints remain on a source outer edge rather than a fabricated bounding rectangle.
    const points = [...building.path.split('Z')[0].matchAll(/[ML](-?[\d.]+)\s+(-?[\d.]+)/g)].map(
      (match) => [Number(match[1]), Number(match[2])],
    );
    assert.ok(
      points.some((from, i) => {
        const to = points[(i + 1) % points.length];
        const dx = to[0] - from[0],
          dy = to[1] - from[1];
        const edgeLength = Math.hypot(dx, dy);
        if (!edgeLength) return false;
        return [window.from, window.to].every(
          ([x, y]) => Math.abs((x - from[0]) * dy - (y - from[1]) * dx) / edgeLength < 1e-6,
        );
      }),
    );
  }
});
