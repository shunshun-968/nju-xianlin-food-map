import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { convertOSM, splitLayers, collection } from './lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const documents = [];
// Preserve the previously reviewed campus snapshot when the same OSM version
// occurs in both archives; surrounding objects come from the tiled context.
for (const directory of ['campus-context', 'road-bounded-campus']) {
  const raw = new URL(`../../data/osm/raw/${directory}/`, import.meta.url);
  const sources = JSON.parse(await readFile(new URL('sources.json', raw), 'utf8'));
  for (const source of sources) {
    const bytes = await readFile(new URL(source.file, raw));
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
      throw new Error(`OSM checksum mismatch: ${directory}/${source.file}`);
    documents.push(JSON.parse(bytes.toString('utf8')));
  }
}
const converted = convertOSM(documents);
// Map API also returns partially covered district/subdistrict boundary relations.
// They are not campus basemap objects; retain their raw records without fetching entire districts.
converted.features = converted.features.filter(
  (f) => !(f.id.startsWith('relation/') && f.properties.boundary === 'administrative'),
);
const { layers, rejected } = splitLayers(converted);
if (rejected.length) throw new Error(`Incomplete geometries: ${rejected.join(', ')}`);
const unique = new Map(
  Object.values(layers)
    .flatMap((l) => l.features)
    .map((f) => [f.id, f]),
);
await mkdir(new URL('../../.cache/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../../.cache/campus-source.geojson', import.meta.url),
  JSON.stringify(collection([...unique.values()])),
);
const result = spawnSync('python', ['scripts/osm/build-campus.py'], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
