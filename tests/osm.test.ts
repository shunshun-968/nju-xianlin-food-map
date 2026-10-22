import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { campusProjection, geometryPath } from '../src/lib/osm-geometry';
import { convertOSM, normalizeGeoJSON, splitLayers } from '../scripts/osm/lib.mjs';

test('WGS84 projection has north up, metre distances, and reversible lon/lat', () => {
  const p = campusProjection([118.9442, 32.1099, 118.9621, 32.1297]);
  assert.deepEqual(p.project([118.9442, 32.1297]), [0, 0]);
  const source: [number, number] = [118.95, 32.12];
  const result = p.unproject(p.project(source));
  assert.ok(Math.abs(result[0] - source[0]) < 1e-10);
  assert.ok(Math.abs(result[1] - source[1]) < 1e-10);
  assert.ok(p.width > 1600 && p.width < 1750 && p.height > 2100 && p.height < 2300);
});

test('polygon and multipolygon paths retain inner courtyard rings', () => {
  const rings: [number, number][][] = [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 0],
    ],
    [
      [1, 1],
      [2, 1],
      [1, 2],
      [1, 1],
    ],
  ];
  const polygon = geometryPath({ type: 'Polygon', coordinates: rings }, (p) => p);
  assert.equal((polygon.match(/Z/g) || []).length, 2);
  const multi = geometryPath({ type: 'MultiPolygon', coordinates: [rings, [rings[0]]] }, (p) => p);
  assert.equal((multi.match(/Z/g) || []).length, 3);
});

test('conversion joins split relation members and preserves a courtyard', () => {
  const nodes = [
    [0, 0],
    [5, 0],
    [5, 5],
    [0, 5],
    [1, 1],
    [2, 1],
    [2, 2],
    [1, 2],
  ].map(([lon, lat], i) => ({ type: 'node', id: i + 1, lon, lat }));
  const data = {
    elements: [
      ...nodes,
      { type: 'way', id: 11, nodes: [1, 2, 3] },
      { type: 'way', id: 12, nodes: [1, 4, 3] },
      { type: 'way', id: 13, nodes: [5, 6, 7, 8, 5] },
      {
        type: 'relation',
        id: 20,
        tags: { type: 'multipolygon', building: 'yes', name: '测试建筑' },
        members: [
          { type: 'way', ref: 12, role: 'outer' },
          { type: 'way', ref: 11, role: 'outer' },
          { type: 'way', ref: 13, role: 'inner' },
        ],
      },
    ],
  };
  const result = splitLayers(convertOSM([data]));
  assert.deepEqual(result.rejected, []);
  const building = result.layers.buildings.features[0];
  assert.equal(building.id, 'relation/20');
  assert.equal(building.geometry.type, 'Polygon');
  assert.equal(building.geometry.coordinates.length, 2);
  assert.equal(result.layers.labels.features[0].id, building.id);
});

test('manual Turbo exports preserve IDs and reject incomplete geometry from thematic layers', () => {
  const converted = normalizeGeoJSON({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { '@id': 'way/123', building: 'yes', '@tainted': true },
        geometry: {
          type: 'LineString',
          coordinates: [
            [118.95, 32.12],
            [118.951, 32.12],
          ],
        },
      },
    ],
  });
  assert.deepEqual(splitLayers(converted).rejected, ['way/123']);
  assert.equal(splitLayers(converted).layers.buildings.features.length, 0);
});

test('checked-in campus snapshot has closed, finite geometry and no tainted features', () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(new URL(`../public/osm/${name}`, import.meta.url), 'utf8'));
  const manifest = read('manifest.json');
  const all = read('all.geojson');
  assert.equal(new Set(all.features.map((f: { id: string }) => f.id)).size, all.features.length);
  const boundary = read('boundary.geojson').features[0];
  assert.equal(boundary.id, 'way/89910837');
  assert.match(boundary.properties.name, /南京大学.*仙林/);
  function checkCoordinates(coords: unknown) {
    assert.ok(Array.isArray(coords) && coords.length > 0);
    if (typeof coords[0] === 'number') {
      assert.equal(coords.length, 2);
      assert.ok(coords.every((n) => Number.isFinite(n)));
      assert.ok(coords[0] > 118 && coords[0] < 120 && coords[1] > 31 && coords[1] < 33);
    } else coords.forEach(checkCoordinates);
  }
  for (const feature of all.features) {
    assert.ok(!feature.properties.osm_tainted, feature.id);
    checkCoordinates(feature.geometry.coordinates);
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.type === 'MultiPolygon'
          ? feature.geometry.coordinates
          : [];
    for (const polygon of polygons)
      for (const ring of polygon) {
        assert.ok(ring.length >= 4, feature.id);
        assert.deepEqual(ring[0], ring.at(-1), feature.id);
      }
  }
  assert.equal(all.features.length, manifest.uniqueFeatures);
  for (const [layer, count] of Object.entries(manifest.counts))
    assert.equal(read(`${layer}.geojson`).features.length, count);
  assert.ok(manifest.buildingsWithCourtyards > 0);
});
