import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalog } from '../src/data/catalog';
import {
  mapLabels,
  metricScaleBar,
  zoomStepFactor,
  initialZoom,
  detailZoomThreshold,
  landmarkZoomThreshold,
  roadZoomThreshold,
  wheelZoomFactor,
  venueLines,
  type CampusBasemap,
  type DetailLabel,
  type MapTransform,
  type XY,
} from '../src/lib/campus-basemap';

const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const map: CampusBasemap & {
  projection: {
    origin: XY;
    metresPerLongitudeDegree: number;
    metresPerLatitudeDegree: number;
  };
} = read('../public/osm/campus-render.json');
const approved: {
  features: {
    geometry: { coordinates: XY };
    properties: { venue_id: string; indoor?: boolean; review_status: string };
  }[];
} = read('../public/osm/food-venues.geojson');
const source: { features: { id: string }[] } = read('../public/osm/campus-map.geojson');
const overview = { width: 1920, height: 1400 };
const detailViewport = { width: 1440, height: 1000 };

function fitted(zoom = initialZoom): MapTransform {
  const [left, top, right, bottom] = map.bounds;
  const scale =
    zoom *
    Math.min((overview.width - 200) / (right - left), (overview.height - 200) / (bottom - top));
  return {
    x: overview.width / 2 - ((left + right) / 2) * scale,
    y: overview.height / 2 - ((top + bottom) / 2) * scale,
    scale,
    zoom,
  };
}

// Pan across actual named buildings, rather than asserting constraints over an empty label set.
const namedBuildings = map.features.filter(
  (feature) => feature.kind === 'building' && feature.name,
);
const sampleBuildings = [
  ...namedBuildings
    .filter((feature) => feature.inCampus !== false)
    .filter((_, index) => index % 8 === 0),
  ...namedBuildings
    .filter((feature) => feature.inCampus === false)
    .filter((_, index) => index % 50 === 0)
    .slice(0, 6),
];
const detailViews = sampleBuildings.map((feature) => {
  const transform: MapTransform = {
    x: detailViewport.width / 2 - feature.centre[0] * 4,
    y: detailViewport.height / 2 - feature.centre[1] * 4,
    scale: 4,
    zoom: 16,
  };
  return { transform, labels: mapLabels(map, transform, detailViewport, [], true) };
});

function corners(label: DetailLabel): XY[] {
  const angle = (label.angle * Math.PI) / 180;
  return ([-1, 1] as const).flatMap((x) =>
    ([-1, 1] as const).map((y) => {
      const dx = (x * label.width) / 2;
      const dy = (y * label.height) / 2;
      return [
        label.x + dx * Math.cos(angle) - dy * Math.sin(angle),
        label.y + dx * Math.sin(angle) + dy * Math.cos(angle),
      ] as XY;
    }),
  );
}

function distanceToSegment([x, y]: XY, [ax, ay]: XY, [bx, by]: XY) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const u = lengthSquared
    ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared))
    : 0;
  return Math.hypot(x - ax - u * dx, y - ay - u * dy);
}

function project([lon, lat]: XY): XY {
  const p = map.projection;
  return [
    (lon - p.origin[0]) * p.metresPerLongitudeDegree,
    (p.origin[1] - lat) * p.metresPerLatitudeDegree,
  ];
}

test('the seven outer-map venues retain the catalog IDs and explicit canteen name mappings', () => {
  assert.equal(map.venues.length, 7);
  assert.deepEqual(
    map.venues.map((venue) => venue.id).sort(),
    catalog.venues.map((venue) => venue.id).sort(),
  );
  const expected = {
    'v-456': ['way/99814434', '四五六食堂'],
    'v-891': ['way/99814405', '民族食堂、第八、九食堂'],
    'v-10': ['way/188130723', '第十食堂与教工食堂'],
    'v-1112': ['way/350505117', '第十一、十二食堂'],
  };
  for (const [id, [osmId, name]] of Object.entries(expected)) {
    const venue = map.venues.find((v) => v.id === id)!;
    assert.deepEqual([venue.osmId, venue.name], [osmId, name]);
    assert.ok(
      source.features.some((feature) => feature.id === osmId),
      osmId,
    );
  }
});

test('the render snapshot uses the three approved coordinates without drift and keeps Yifu indoors', () => {
  assert.equal(approved.features.length, 3);
  for (const feature of approved.features) {
    assert.equal(feature.properties.review_status, 'approved');
    const venue = map.venues.find((v) => v.id === feature.properties.venue_id)!;
    assert.deepEqual(venue.sourceCoordinates, feature.geometry.coordinates);
    const expectedPoint = project(feature.geometry.coordinates);
    assert.ok(Math.hypot(...venue.point.map((n, i) => n - expectedPoint[i])) < 1e-7);
    if (feature.properties.indoor !== undefined) {
      assert.equal(venue.indoor, feature.properties.indoor);
    }
  }
  const yifu = map.venues.find((v) => v.id === 'v-yifu')!;
  assert.deepEqual(venueLines(yifu), [yifu.name]);
});

test('the initial view is one wheel level larger and all building labels appear two levels later', () => {
  assert.equal(zoomStepFactor, 1.2);
  assert.equal(initialZoom, wheelZoomFactor(-100));
  assert.equal(landmarkZoomThreshold, zoomStepFactor ** 2);
  assert.equal(detailZoomThreshold, 1.6 * zoomStepFactor ** 2);
  const originalFit = fitted(1);
  const initial = fitted();
  assert.ok(Math.abs(initial.scale / originalFit.scale - wheelZoomFactor(-100)) < 1e-12);
  assert.equal(initial.zoom, initialZoom);
  const initialLabels = mapLabels(map, initial, overview, [], true);
  assert.equal(initialLabels.details.length, 0);
  assert.deepEqual(initialLabels.food.map((label) => label.id).sort(), []);

  const nextZoom = initialZoom * wheelZoomFactor(-120);
  assert.equal(nextZoom, landmarkZoomThreshold);
  const visible = mapLabels(map, fitted(nextZoom), overview, [], true);
  const hidden = mapLabels(map, fitted(nextZoom), overview, [], false);
  assert.ok(visible.details.some((label) => label.text === '杜厦图书馆'));
  assert.ok(visible.details.length > 0 && visible.details.length <= 5);
  for (const label of visible.details) {
    assert.equal(label.kind, 'building');
    assert.equal(label.overview, true);
    assert.ok(!/宿舍|公寓/.test(label.text));
    assert.notEqual(map.features.find((feature) => feature.id === label.id)!.inCampus, false);
  }
  assert.equal(hidden.details.length, 0);
  assert.deepEqual(
    hidden.food.map((label) => label.id),
    visible.food.map((label) => label.id),
  );
  const detailed = detailViews.find((view) => view.labels.details.length > 0)!;
  assert.ok(detailed, 'fixture must expose real secondary labels');
  assert.equal(mapLabels(map, detailed.transform, detailViewport, [], false).details.length, 0);
});

test('common mouse deltas represent one level while small trackpad deltas remain continuous and reversible', () => {
  assert.equal(wheelZoomFactor(0), 1);
  for (const [delta, mode] of [
    [100, 0],
    [120, 0],
    [3, 1],
    [1, 2],
  ]) {
    assert.equal(wheelZoomFactor(-delta, mode), zoomStepFactor);
    assert.equal(wheelZoomFactor(delta, mode), 1 / zoomStepFactor);
    assert.ok(Math.abs(wheelZoomFactor(delta, mode) * wheelZoomFactor(-delta, mode) - 1) < 1e-12);
  }
  assert.equal(wheelZoomFactor(-240), zoomStepFactor ** 2);
  assert.equal(wheelZoomFactor(-6, 1), zoomStepFactor ** 2);
  const small = wheelZoomFactor(-5);
  assert.ok(small > 1 && small < zoomStepFactor);
  assert.ok(Math.abs(small * wheelZoomFactor(5) - 1) < 1e-12);
});

test('modeled venue names are revealed one at a time and touch preview reserves its confirmation hint', () => {
  for (const venueId of ['v-456', 'v-891', 'v-10', 'v-1112', 'v-south', 'v-hut']) {
    const hovered = mapLabels(map, fitted(), overview, [], true, { venueId });
    assert.deepEqual(hovered.food.map((label) => label.id).sort(), [venueId]);
    const name = hovered.food.find((label) => label.id === venueId)!;
    assert.ok(name && !name.lines.includes('再点一次进入'));
    const tapped = mapLabels(map, fitted(), overview, [], true, { venueId, touchHint: true });
    const preview = tapped.food.find((label) => label.id === venueId)!;
    assert.equal(preview.lines.at(-1), '再点一次进入');
    assert.equal(preview.height, name.height + 14);
    assert.ok(
      tapped.food.every((label, index) =>
        tapped.food
          .slice(index + 1)
          .every(
            (other) =>
              label.box.right <= other.box.left ||
              label.box.left >= other.box.right ||
              label.box.bottom <= other.box.top ||
              label.box.top >= other.box.bottom,
          ),
      ),
    );
  }
});

test('Yifu reveals its name badge for hover and touch previews', () => {
  for (const zoom of [initialZoom, landmarkZoomThreshold, 4, 12]) {
    for (const touchHint of [false, true]) {
      const transform = fitted(zoom);
      const venue = map.venues.find((item) => item.id === 'v-yifu')!;
      transform.x = overview.width / 2 - venue.point[0] * transform.scale;
      transform.y = overview.height / 2 - venue.point[1] * transform.scale;
      const labels = mapLabels(map, transform, overview, [], true, {
        venueId: 'v-yifu',
        touchHint,
      });
      assert.ok(labels.food.some((label) => label.id === 'v-yifu'));
    }
  }
});

test('all building tiers respect their delayed gates while the road-name gate remains 2.3', () => {
  let ordinaryBuildings = 0;
  let roadLabels = 0;
  let landmarkLabels = 0;
  assert.equal(roadZoomThreshold, 2.3);
  for (const { transform } of detailViews) {
    const beforeLandmarks = mapLabels(
      map,
      { ...transform, zoom: landmarkZoomThreshold - 1e-6 },
      detailViewport,
      [],
      true,
    );
    assert.ok(beforeLandmarks.details.every((label) => label.kind !== 'building'));
    const afterLandmarks = mapLabels(
      map,
      { ...transform, zoom: landmarkZoomThreshold },
      detailViewport,
      [],
      true,
    );
    landmarkLabels += afterLandmarks.details.filter(
      (label) => label.kind === 'building' && label.overview,
    ).length;
    const beforeBuildings = mapLabels(
      map,
      { ...transform, zoom: detailZoomThreshold - 1e-6 },
      detailViewport,
      [],
      true,
    );
    assert.ok(
      beforeBuildings.details
        .filter((label) => label.kind === 'building')
        .every((label) => label.overview),
    );
    const afterBuildings = mapLabels(
      map,
      { ...transform, zoom: detailZoomThreshold },
      detailViewport,
      [],
      true,
    );
    ordinaryBuildings += afterBuildings.details.filter(
      (label) => label.kind === 'building' && !label.overview,
    ).length;
    const beforeRoads = mapLabels(
      map,
      { ...transform, zoom: roadZoomThreshold - 1e-6 },
      detailViewport,
      [],
      true,
    );
    assert.ok(beforeRoads.details.every((label) => label.kind !== 'road'));
    const afterRoads = mapLabels(
      map,
      { ...transform, zoom: roadZoomThreshold },
      detailViewport,
      [],
      true,
    );
    roadLabels += afterRoads.details.filter((label) => label.kind === 'road').length;
  }
  assert.ok(landmarkLabels > 0, 'fixture must expose landmarks at their exact threshold');
  assert.ok(
    ordinaryBuildings >= 20,
    `expected ordinary labels at ${detailZoomThreshold}, got ${ordinaryBuildings}`,
  );
  assert.ok(roadLabels >= 20, `expected road labels at ${roadZoomThreshold}, got ${roadLabels}`);
});

test('actual road-name rectangles remain inside their vehicle-road corridor at detailed views', () => {
  let checked = 0;
  for (const { transform, labels } of detailViews) {
    for (const label of labels.details.filter((item) => item.kind === 'road')) {
      const sourceId = label.id.slice(0, label.id.lastIndexOf('-'));
      const road = map.features.find((feature) => feature.id === sourceId)!;
      assert.equal(road.kind, 'road');
      assert.equal(road.footway, false);
      assert.equal(label.text, road.name);
      const screenLines = road.lines!.map((line) =>
        line.map(
          ([x, y]) => [x * transform.scale + transform.x, y * transform.scale + transform.y] as XY,
        ),
      );
      for (const corner of corners(label)) {
        const distance = Math.min(
          ...screenLines.flatMap((line) =>
            line.slice(1).map((point, i) => distanceToSegment(corner, line[i], point)),
          ),
        );
        assert.ok(distance <= (road.width! * transform.scale) / 2 + 1e-7, label.id);
      }
      checked++;
    }
  }
  assert.ok(checked >= 20, `expected substantial road coverage, got ${checked}`);
});

test('building labels including overview labels remain inside the envelope with at most 10% total overflow', () => {
  let checked = 0;
  const views = [
    ...detailViews,
    {
      transform: fitted(landmarkZoomThreshold),
      labels: mapLabels(map, fitted(landmarkZoomThreshold), overview, [], true),
    },
  ];
  for (const { transform, labels } of views) {
    for (const label of labels.details.filter((item) => item.kind === 'building')) {
      const building = map.features.find((feature) => feature.id === label.id)!;
      const [left, top, right, bottom] = building.bounds;
      const padX = (right - left) * 0.05;
      const padY = (bottom - top) * 0.05;
      assert.ok(label.fontSize! > 0 && label.lines!.length > 0, label.id);
      assert.ok(label.height >= label.fontSize! * label.lines!.length, label.id);
      if (!label.overview) assert.equal(label.lines!.join(''), building.name);
      for (const corner of corners(label)) {
        const world: XY = [
          (corner[0] - transform.x) / transform.scale,
          (corner[1] - transform.y) / transform.scale,
        ];
        assert.ok(
          world[0] >= left - padX - 1e-7 && world[0] <= right + padX + 1e-7,
          `${label.id}: horizontal envelope overflow exceeds 10%`,
        );
        assert.ok(
          world[1] >= top - padY - 1e-7 && world[1] <= bottom + padY + 1e-7,
          `${label.id}: vertical envelope overflow exceeds 10%`,
        );
      }
      checked++;
    }
  }
  assert.ok(checked >= 20, `expected substantial building coverage, got ${checked}`);
});

test('metric scale-bar length corresponds to ground metres across zoom levels', () => {
  assert.deepEqual(metricScaleBar(2), { distance: 50, pixels: 100, label: '50 m' });
  assert.deepEqual(metricScaleBar(0.05), { distance: 2000, pixels: 100, label: '2 km' });
  for (const scale of [0.015, 0.1, 0.25, 0.75, 1, 2, 4, 8]) {
    const bar = metricScaleBar(scale);
    assert.ok(bar.distance > 0 && bar.pixels > 0 && bar.pixels <= 100 + 1e-7);
    assert.ok(Math.abs(bar.pixels / scale - bar.distance) < 1e-7);
  }
});

test('outside buildings and roads never expose detail names at any label tier', () => {
  const building = {
    ...map.features.find((f) => f.kind === 'building' && f.name)!,
    id: 'outside-building',
    name: '校外测试建筑',
    area: 40000,
    bounds: [100, 100, 300, 300] as [number, number, number, number],
    inCampus: false,
  };
  const road = {
    ...map.features.find((f) => f.kind === 'road' && f.name)!,
    id: 'outside-road',
    name: '校外测试道路',
    width: 50,
    footway: false,
    lines: [
      [
        [100, 500],
        [800, 500],
      ],
    ] as XY[][],
    inCampus: false,
  };
  for (const zoom of [2, 4, 8, 16]) {
    const fixture = { ...map, venues: [], features: [building, road] };
    const t = { x: 0, y: 0, scale: 1, zoom };
    assert.equal(mapLabels(fixture, t, { width: 1000, height: 800 }, [], true).details.length, 0);
    const inside = {
      ...fixture,
      features: fixture.features.map((f) => ({ ...f, inCampus: true })),
    };
    if (zoom >= detailZoomThreshold)
      assert.ok(mapLabels(inside, t, { width: 1000, height: 800 }, [], true).details.length > 0);
  }
});
