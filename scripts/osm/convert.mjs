import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BBOX,
  BOUNDARY_ID,
  collection,
  convertOSM,
  normalizeGeoJSON,
  splitLayers,
} from './lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const raw = path.join(root, 'data/osm/raw');
const output = path.join(root, 'public/osm');
const input = process.argv[2];
const read = async (file) => JSON.parse(await readFile(file, 'utf8'));
const acquisition = await read(path.join(raw, 'acquisition.json'));
let geojson, sources;
if (input) {
  // Keep the exact manually exported file, and give its acquisition source explicitly.
  const sourceUrl = process.env.OSM_IMPORT_SOURCE;
  const retrievedAt = process.env.OSM_IMPORT_RETRIEVED_AT;
  if (!sourceUrl || !retrievedAt || Number.isNaN(Date.parse(retrievedAt)))
    throw new Error(
      'Manual import requires OSM_IMPORT_SOURCE and OSM_IMPORT_RETRIEVED_AT (ISO date).',
    );
  const bytes = await readFile(path.resolve(input));
  const document = JSON.parse(bytes.toString('utf8'));
  const hash = createHash('sha256').update(bytes).digest('hex');
  const filename = `imports/${hash}.${document.type === 'FeatureCollection' ? 'geojson' : 'osm.json'}`;
  await mkdir(path.join(raw, 'imports'), { recursive: true });
  await writeFile(path.join(raw, filename), bytes);
  geojson =
    document.type === 'FeatureCollection' ? normalizeGeoJSON(document) : convertOSM([document]);
  // Boundary verified independently; available even when the manual export omits it.
  const boundarySource = acquisition.sources.find((s) =>
    path.basename(s.file).startsWith('boundary-'),
  );
  const boundary = convertOSM([await read(path.join(raw, boundarySource.file))]);
  if (!geojson.features.some((f) => f.id === BOUNDARY_ID))
    geojson.features.push(boundary.features.find((f) => f.id === BOUNDARY_ID));
  sources = [boundarySource, { file: filename, url: sourceUrl, retrievedAt, sha256: hash }];
} else {
  sources = acquisition.sources;
  const documents = [];
  for (const source of sources) {
    const bytes = await readFile(path.join(raw, source.file));
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
      throw new Error(`Raw source checksum mismatch: ${source.file}`);
    documents.push(JSON.parse(bytes.toString('utf8')));
  }
  geojson = convertOSM(documents);
}
const { layers, rejected, ignored } = splitLayers(geojson);
if (rejected.length)
  throw new Error(
    `Incomplete thematic geometries; fetch full relations first: ${rejected.join(', ')}`,
  );
const boundary = layers.boundary.features.find((f) => f.id === BOUNDARY_ID);
if (
  boundary?.geometry.type !== 'Polygon' ||
  boundary.geometry.coordinates[0].length < 4 ||
  boundary.properties.amenity !== 'university' ||
  !boundary.properties.name?.includes('仙林')
)
  throw new Error('Campus boundary verification failed');
const ring = boundary.geometry.coordinates[0];
const boundaryBbox = [
  Math.min(...ring.map((p) => p[0])),
  Math.min(...ring.map((p) => p[1])),
  Math.max(...ring.map((p) => p[0])),
  Math.max(...ring.map((p) => p[1])),
];
if (
  boundaryBbox[0] < 118.93 ||
  boundaryBbox[2] > 118.98 ||
  boundaryBbox[1] < 32.1 ||
  boundaryBbox[3] > 32.14
)
  throw new Error('Boundary is outside the expected Xianlin location');
const unique = new Map(
  Object.values(layers)
    .flatMap((l) => l.features)
    .map((f) => [f.id, f]),
);
const counts = Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.features.length]));
const buildingsWithCourtyards = layers.buildings.features.filter((f) =>
  f.geometry.type === 'Polygon'
    ? f.geometry.coordinates.length > 1
    : f.geometry.type === 'MultiPolygon' && f.geometry.coordinates.some((p) => p.length > 1),
).length;
const manifest = {
  title: '南京大学仙林校区 OSM 底图可用性预览',
  crs: 'OGC:CRS84 (WGS84 longitude, latitude)',
  bbox: BBOX,
  boundary: {
    id: boundary.id,
    name: boundary.properties.name,
    bbox: boundaryBbox,
    address: `${boundary.properties['addr:street']} ${boundary.properties['addr:housenumber']} 号`,
    version: boundary.properties.osm_meta?.version,
  },
  method: input ? 'manual-export' : acquisition.method,
  sources,
  overpassAttempts: acquisition.overpassAttempts,
  license: 'ODbL-1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution: '© OpenStreetMap contributors',
  attributionUrl: 'https://www.openstreetmap.org/copyright',
  counts,
  uniqueFeatures: unique.size,
  buildingsWithCourtyards,
  rejectedIncompleteFeatures: rejected,
  ignoredRouteRelations: ignored,
  notes: [
    'Counts cover the bounding box and intersecting complete ways, not only the campus polygon.',
    'The bbox includes nearby roads; full geometries may extend beyond it and are not clipped in GeoJSON.',
    'Layers overlap by tag; their counts must not be summed as a unique-feature count.',
    'OSM completeness and current names require human review; no food-venue mapping is inferred.',
  ],
};
await mkdir(output, { recursive: true });
for (const [name, layer] of Object.entries(layers))
  await writeFile(path.join(output, `${name}.geojson`), JSON.stringify(layer) + '\n');
await writeFile(
  path.join(output, 'all.geojson'),
  JSON.stringify(collection([...unique.values()])) + '\n',
);
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({ counts, buildingsWithCourtyards, uniqueFeatures: unique.size }, null, 2),
);
