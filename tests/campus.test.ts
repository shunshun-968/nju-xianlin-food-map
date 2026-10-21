import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data/catalog';
import { venueAnchors } from '../src/data/campus';
import layout from '../src/data/campus-layout.json';

test('straightened building polygons do not cross their own walls', () => {
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (const feature of layout.features.filter((f) => f.kind >= 5 && f.kind <= 8)) {
    for (const ring of feature.path.split('Z')) {
      const points = [...ring.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [
        Number(m[1]),
        Number(m[2]),
      ]);
      for (let i = 0; i < points.length; i++)
        for (let j = i + 2; j < points.length; j++) {
          if (i === 0 && j === points.length - 1) continue;
          const a = points[i],
            b = points[(i + 1) % points.length],
            c = points[j],
            d = points[(j + 1) % points.length];
          assert(
            !(cross(a, b, c) * cross(a, b, d) < -1e-6 && cross(c, d, a) * cross(c, d, b) < -1e-6),
            `${feature.id}: walls intersect`,
          );
        }
    }
  }
});

test('reference-image names override the old printed names', () => {
  for (const venue of catalog.venues) {
    const anchor = venueAnchors[venue.id];
    assert.equal(venue.name, anchor.source.replace(/\.(jpg|png)$/, ''));
    assert(venue.campusPosition[0] >= 0 && venue.campusPosition[0] <= layout.width);
    assert(venue.campusPosition[1] >= 0 && venue.campusPosition[1] <= layout.height);
    if (anchor.replaces) {
      const feature = layout.features.find((f) => f.id === anchor.replaces);
      assert(feature, `Missing source footprint: ${anchor.replaces}`);
      const [x, y, w, h] = feature.bounds,
        [px, py] = venue.campusPosition;
      assert(
        px >= x && px <= x + w && py >= y && py <= y + h,
        `${venue.name} moved outside its source building`,
      );
    }
  }
  assert.equal(catalog.coordinateSystem, layout.coordinateSystem);
});

test('food places preserve the supplied plan-relative arrangement', () => {
  const a = venueAnchors;
  assert(a['v-1112'].point[1] < a['v-891'].point[1]);
  assert(a['v-891'].point[1] < a['v-456'].point[1]);
  assert(a['v-hut'].point[0] > a['v-456'].point[0]);
  assert(Math.abs(a['v-hut'].point[1] - a['v-456'].point[1]) < 10);
  assert(a['v-10'].point[0] > a['v-891'].point[0]);
  assert(a['v-yifu'].point[1] < a['v-south'].point[1]);
});
