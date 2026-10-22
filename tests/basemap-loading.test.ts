import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  createBasemapLoader,
  chunksForBounds,
  mergeMapFeatures,
  unionBounds,
  viewportBounds,
  type MapManifest,
  type FeatureChunk,
} from '../src/lib/basemap-loading';
import type { CampusBasemap } from '../src/lib/campus-basemap';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest: MapManifest = read('../public/osm/runtime/index.json');
const full: CampusBasemap = read('../public/osm/campus-render.json');
const chunk = (file: string): FeatureChunk => read(`../public/osm/runtime/${file}`);
const baseUrl = 'https://example.test/nju-xianlin-food-map/osm/runtime/';

test('runtime chunks reconstruct every original feature, order, geometry and seven venues', () => {
  const chunks = [manifest.core, ...manifest.surrounding].map((c) => chunk(c.file));
  assert.equal(chunks.reduce((total, c) => total + c.features.length, 0), full.features.length);
  const merged = mergeMapFeatures(chunks);
  assert.equal(merged.length, full.features.length);
  merged.forEach(({ renderOrder, ...feature }, index) => {
    // Only numeric feature metadata is compacted to six decimal places. Paths
    // and IDs are exact, while original GeoJSON and venue coordinates are intact.
    const expected = JSON.stringify(full.features[index], (_key, value) =>
      typeof value === 'number' ? Number(value.toFixed(6)) : value,
    );
    assert.equal(JSON.stringify(feature), expected, feature.id);
  });
  assert.deepEqual(manifest.metadata.venues, full.venues);
  assert.deepEqual(manifest.metadata.bounds, full.bounds);
  const coreIds = new Set(chunks[0].features.map((f) => f.id));
  assert.ok(full.features.filter((f) => f.inCampus).every((f) => coreIds.has(f.id)));
  assert.ok(manifest.core.bytes < 700_000);
  for (const entry of [manifest.core, ...manifest.surrounding, manifest.forest]) {
    const bytes = readFileSync(new URL(`../public/osm/runtime/${entry.file}`, import.meta.url));
    assert.equal(bytes.length, entry.bytes);
    assert.ok(entry.file.includes(createHash('sha256').update(bytes).digest('hex').slice(0, 16)));
  }
});

test('responsive initial windows have full feature coverage without loading the whole map', () => {
  for (const [width, height] of [
    [2048, 1112],
    [2541, 1380],
    [1440, 1000],
    [390, 844],
  ]) {
    const [l, t, r, b] = full.bounds;
    const left = width > 700 ? 380 : 20,
      top = 100,
      bottom = height - 45;
    const scale = 1.2 * Math.min((width - left - 30) / (r - l + 90), (bottom - top) / (b - t + 90));
    const transform = {
      x: left + (width - left) / 2 - ((l + r) / 2) * scale,
      y: top + (bottom - top) / 2 - ((t + b) / 2) * scale,
      scale,
      zoom: 1.2,
    };
    const view = viewportBounds(transform, { width, height });
    const priority = unionBounds(full.bounds, viewportBounds(transform, { width, height }, 80));
    const selected = chunksForBounds(manifest, priority);
    const ids = new Set(
      mergeMapFeatures([chunk(manifest.core.file), ...selected.map((c) => chunk(c.file))]).map(
        (f) => f.id,
      ),
    );
    for (const f of full.features) {
      const a = f.bounds;
      if (a[0] <= view[2] && a[2] >= view[0] && a[1] <= view[3] && a[3] >= view[1])
        assert.ok(ids.has(f.id), `${width}: missing ${f.id}`);
    }
    assert.ok(selected.length < manifest.surrounding.length, `${width}: loaded every chunk`);
  }
});

test('concurrent requests share one fetch and parsed object; later visits reuse persistent cache', async () => {
  let requests = 0;
  const stored = new Map<string, Response>();
  const cache = {
    match: async (key: RequestInfo | URL) => stored.get(String(key))?.clone(),
    put: async (key: RequestInfo | URL, response: Response) => {
      stored.set(String(key), response.clone());
    },
    delete: async (key: RequestInfo | URL) => stored.delete(String(key)),
  };
  const fetcher: typeof fetch = async () => {
    requests++;
    return Response.json(chunk(manifest.core.file));
  };
  const options = { baseUrl, fetcher, openCache: async () => cache };
  const first = createBasemapLoader(options);
  const [a, b] = await Promise.all([
    first.loadChunk(manifest, manifest.core),
    first.loadChunk(manifest, manifest.core),
  ]);
  assert.equal(requests, 1);
  assert.equal(a, b);
  assert.equal(await first.loadChunk(manifest, manifest.core), a);
  const second = createBasemapLoader(options);
  assert.deepEqual(await second.loadChunk(manifest, manifest.core), a);
  assert.equal(requests, 1);
});

test('failed requests retry, corrupt cache falls back, and storage denial does not block loading', async () => {
  let requests = 0;
  const cache = {
    match: async () => Response.json({ broken: true }),
    put: async () => {},
    delete: async () => true,
  };
  const loader = createBasemapLoader({
    baseUrl,
    openCache: async () => cache,
    fetcher: async () => {
      requests++;
      if (requests === 1) return new Response('offline', { status: 503 });
      return Response.json(chunk(manifest.core.file));
    },
  });
  await assert.rejects(loader.loadChunk(manifest, manifest.core), /503/);
  assert.ok((await loader.loadChunk(manifest, manifest.core)).features.length);
  assert.equal(requests, 2);
  const denied = createBasemapLoader({
    baseUrl,
    openCache: async () => {
      throw new Error('denied');
    },
    fetcher: async () => Response.json(chunk(manifest.core.file)),
  });
  assert.ok((await denied.loadChunk(manifest, manifest.core)).features.length);
});

test('new map revisions cannot reuse the old parsed cache', async () => {
  let requests = 0;
  const loader = createBasemapLoader({
    baseUrl,
    fetcher: async () => {
      requests++;
      return Response.json(chunk(manifest.core.file));
    },
  });
  await loader.loadChunk(manifest, manifest.core);
  await loader.loadChunk({ ...manifest, revision: 'next-revision' }, manifest.core);
  assert.equal(requests, 2);
});

test('queued visible chunks take precedence over background prefetch with bounded concurrency', async () => {
  const starts: string[] = [];
  const releases: (() => void)[] = [];
  const loader = createBasemapLoader({
    baseUrl,
    fetcher: async (input) => {
      starts.push(String(input));
      await new Promise<void>((resolve) => releases.push(resolve));
      return Response.json(chunk(manifest.core.file));
    },
  });
  const assets = ['one', 'two', 'background', 'visible'].map((id) => ({
    ...manifest.core,
    id,
    file: `${id}.json`,
  }));
  const a = loader.loadChunk(manifest, assets[0]),
    b = loader.loadChunk(manifest, assets[1]);
  const c = loader.loadChunk(manifest, assets[2], true),
    d = loader.loadChunk(manifest, assets[3]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(starts.length, 2);
  releases.shift()!();
  await a;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(starts[2].endsWith('visible.json'));
  releases.shift()!();
  await b;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(starts[3].endsWith('background.json'));
  releases.splice(0).forEach((release) => release());
  await Promise.all([c, d]);
});
