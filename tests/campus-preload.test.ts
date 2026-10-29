import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { campusCorePreload, campusCorePreloadScript } from '../scripts/vite-campus-preload.mjs';

const core = 'campus-core.b1248aa03ae4e123.json';
function requested(search: string, base = '/nju-xianlin-food-map/') {
  const links: Record<string, string>[] = [];
  runInNewContext(campusCorePreloadScript(base, core)!, {
    URLSearchParams,
    location: { search },
    document: {
      createElement: () => ({}),
      head: { appendChild: (link: Record<string, string>) => links.push(link) },
    },
  });
  return links;
}

test('campus first visit preloads only the hashed core with matching fetch credentials', () => {
  assert.deepEqual(requested(''), [
    {
      rel: 'preload',
      as: 'fetch',
      crossOrigin: 'anonymous',
      fetchPriority: 'high',
      href: `/nju-xianlin-food-map/osm/runtime/${core}`,
    },
  ]);
  assert.equal(requested('', '/')[0].href, `/osm/runtime/${core}`);
  assert.equal(requested('', './')[0].href, `./osm/runtime/${core}`);
});

test('direct model and OSM preview entries do not download unused campus geometry', () => {
  for (const search of ['?venue=v-yifu', '?venue=v-hut', '?floor=v-456-f1', '?basemap=osm']) {
    assert.deepEqual(requested(search), []);
  }
  for (const file of [undefined, '../other.json', 'campus-core.json', 'campus-core.123.json']) {
    assert.equal(campusCorePreloadScript('/', file), undefined);
  }
});

test('HTML carries the exact deployed manifest so first load skips its network round trip', async () => {
  const plugin = campusCorePreload();
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  await (plugin.configResolved as Function)({ publicDir, base: '/nju-xianlin-food-map/' });
  const tags = await (plugin.transformIndexHtml as Function)();
  const manifest = tags.find((tag: any) => tag.attrs?.id === 'campus-basemap-manifest');
  assert.equal(manifest.attrs.type, 'application/json');
  assert.equal(manifest.injectTo, 'head', 'do not push charset beyond the first 1024 bytes');
  assert.equal(manifest.children.includes('<'), false);
  assert.deepEqual(JSON.parse(manifest.children), JSON.parse(await readFile(new URL('../public/osm/runtime/index.json', import.meta.url), 'utf8')));
});
