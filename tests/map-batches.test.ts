import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { batchBuildings, batchRoads } from '../src/lib/map-batches';
import type { CampusBasemap, MapFeature } from '../src/lib/campus-basemap';

const map: CampusBasemap = JSON.parse(readFileSync('public/osm/campus-render.json', 'utf8'));

test('batched roads preserve every original subpath and paint order without mutating sources', () => {
  const roads = map.features.filter((f) => f.kind === 'road');
  const original = JSON.stringify(roads);
  const batches = batchRoads(roads);
  assert.equal(batches.map((f) => f.path).join(' '), roads.map((f) => f.path).join(' '));
  assert.equal(JSON.stringify(roads), original);
  assert.ok(batches.length < roads.length / 2);
  let index = 0;
  for (const batch of batches) {
    let joined = '';
    do {
      const source = roads[index++];
      assert.equal(source.width, batch.width);
      assert.equal(source.footway, batch.footway);
      joined += (joined ? ' ' : '') + source.path;
    } while (joined.length < batch.path.length);
    assert.equal(joined, batch.path);
  }
});

test('outside building batches retain all rings, source coordinates and feature count', () => {
  const buildings = map.features.filter((f) => f.kind === 'building' && !f.inCampus);
  const original = JSON.stringify(buildings);
  const batches = batchBuildings(buildings);
  assert.equal(
    batches.reduce((n, b) => n + b.count, 0),
    buildings.length,
  );
  // Compare exact M…Z rings, including courtyards; no simplification or new edges.
  const rings = (paths: string[]) =>
    paths.flatMap((p) => p.match(/M[^M]+/g)?.map((r) => r.trim()) ?? []).sort();
  assert.deepEqual(rings(batches.map((b) => b.path)), rings(buildings.map((b) => b.path)));
  assert.equal(JSON.stringify(buildings), original);
  assert.ok(batches.length < buildings.length / 3);
});

test('overlapping building polygons cannot cancel each other under even-odd batching', () => {
  const base = map.features.find((f) => f.kind === 'building')!;
  const a: MapFeature = {
    ...base,
    centre: [10, 10],
    bounds: [0, 0, 20, 20],
    path: 'M0 0L20 0L20 20L0 20Z',
  };
  const b: MapFeature = {
    ...a,
    id: 'nested',
    bounds: [5, 5, 15, 15],
    path: 'M5 5L15 5L15 15L5 15Z',
  };
  const c: MapFeature = {
    ...a,
    id: 'separate',
    centre: [50, 10],
    bounds: [40, 0, 60, 20],
    path: 'M40 0L60 0L60 20L40 20Z',
  };
  const batches = batchBuildings([a, b, c]);
  assert.equal(batches.length, 2);
  assert.ok(batches.every((g) => !(g.path.includes(a.path) && g.path.includes(b.path))));
});
