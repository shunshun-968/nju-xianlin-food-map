import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data/catalog';
import { venueAnchors } from '../src/data/campus';
import layout from '../src/data/campus-layout.json';
import drawing from '../src/data/campus-drawing.json';
import { campusLabels, campusFrame } from '../src/data/campus';
import { overlaps, placeMapLabels, type LabelRequest } from '../src/lib/map-labels';

test('straightened building polygons do not cross their own walls', () => {
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (const feature of drawing.buildings) {
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

test('map labels never overlap, and road names stay attached to their road anchors', () => {
  for (const [width, height] of [
    [390, 600],
    [800, 700],
    [1280, 800],
  ]) {
    for (const zoom of [1, 1.7, 3, 5, 8])
      for (const [panX, panY] of [
        [0, 0],
        [-100, -250],
        [150, -700],
      ]) {
        const scale =
          Math.min((width - 32) / campusFrame.width, (height - 55) / campusFrame.height) * zoom;
        const x = width / 2 - (campusFrame.x + campusFrame.width / 2) * scale + panX;
        const y = height / 2 - (campusFrame.y + campusFrame.height / 2) * scale + panY;
        const requests: LabelRequest[] = Object.entries(venueAnchors).map(([id, a]) => ({
          id,
          lines: id === 'v-hut' ? ['呢喃小屋'] : [a.source.replace(/\.(jpg|png)$/, '')],
          x: x + a.point[0] * scale,
          y: y + a.point[1] * scale,
          priority: 0,
          badge: true,
          fontSize: 10.5,
          lineHeight: 14,
          preferred: a.labelOffset,
        }));
        requests.push(
          ...[...campusLabels.filter((l) => l.kind !== 'road'), ...drawing.roadLabels]
            .filter((l) => l.tier === 0 || (l.tier === 1 && zoom >= 1.65) || zoom >= 3)
            .map((l) => ({
              id: l.name,
              lines: [l.name],
              x: x + l.x * scale,
              y: y + l.y * scale,
              priority: l.kind === 'road' ? 1 : 2 + l.tier,
              kind: l.kind,
              fontSize: 11,
              rotation: l.rotation,
            })),
        );
        const placed = placeMapLabels(requests, { width, height });
        for (const [i, label] of placed.entries()) {
          for (const other of placed.slice(i + 1))
            assert(!overlaps(label.box, other.box), `${label.id} overlaps ${other.id}`);
          if (label.kind === 'road') {
            assert.equal(label.x, label.anchorX);
            assert.equal(label.y, label.anchorY);
          }
        }
      }
  }
});

test('reference-image names and the expanded tenth-canteen name override old printed names', () => {
  for (const venue of catalog.venues) {
    const anchor = venueAnchors[venue.id];
    // 定位原图仍名为“第十食堂.jpg”，网站名称已明确包含同楼的教工食堂。
    const expectedName =
      venue.id === 'v-10'
        ? '第十食堂与教工食堂'
        : venue.id === 'v-hut'
          ? '呢喃小屋'
          : anchor.source.replace(/\.(jpg|png)$/, '');
    assert.equal(venue.name, expectedName);
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
