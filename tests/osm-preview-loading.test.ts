import test from 'node:test';
import assert from 'node:assert/strict';
import { layerIds } from '../src/lib/osm-geometry';
import { createOsmPreviewLoader } from '../src/lib/osm-preview-loading';

test('OSM concurrent mounts share downloads and the complete parsed dataset', async () => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested: string[] = [];
  const loader = createOsmPreviewLoader('/osm/', async (input) => {
    const url = String(input);
    requested.push(url);
    await blocked;
    return Response.json({ source: url });
  });
  const first = loader.load();
  const nextMount = loader.load();
  assert.equal(first, nextMount);
  release();
  const data = await nextMount;
  assert.equal(await first, data);
  assert.equal(await loader.load(), data);
  assert.equal(requested.length, 3 + layerIds.length);
  assert.deepEqual(Object.keys(data.layers), [...layerIds]);
  for (const id of layerIds) assert.deepEqual(data.layers[id], { source: `/osm/${id}.geojson` });
});

test('OSM retries only the failed resource and keeps successful layers', async () => {
  const requests = new Map<string, number>();
  const loader = createOsmPreviewLoader('/osm/', async (input) => {
    const url = String(input);
    const attempt = (requests.get(url) ?? 0) + 1;
    requests.set(url, attempt);
    if (url.endsWith('roads.geojson') && attempt === 1) return new Response('', { status: 503 });
    return Response.json({ source: url });
  });
  await assert.rejects(loader.load(), /roads.geojson: HTTP 503/);
  const data = await loader.load();
  assert.deepEqual(data.layers.roads, { source: '/osm/roads.geojson' });
  assert.equal(requests.get('/osm/roads.geojson'), 2);
  for (const [url, count] of requests) if (!url.endsWith('roads.geojson')) assert.equal(count, 1);
});
