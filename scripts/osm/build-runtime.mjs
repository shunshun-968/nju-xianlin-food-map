import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

/** Each full geometry has one owner chunk. Bounds include every straddling feature. */
export function partitionBasemap(map, cellSize = 1024) {
  const core = [],
    shared = [],
    cells = new Map();
  map.features.forEach((feature, renderOrder) => {
    const item = { ...feature, renderOrder },
      b = feature.bounds;
    if (overlaps(b, map.bounds)) {
      core.push(item);
      return;
    }
    if (b[2] - b[0] > cellSize || b[3] - b[1] > cellSize) {
      shared.push(item);
      return;
    }
    const x = Math.floor((b[0] + b[2]) / 2 / cellSize),
      y = Math.floor((b[1] + b[3]) / 2 / cellSize);
    const id = `tile-${x}_${y}`;
    if (!cells.has(id)) cells.set(id, { id, bounds: [...b], features: [] });
    const cell = cells.get(id);
    cell.bounds = [
      Math.min(cell.bounds[0], b[0]),
      Math.min(cell.bounds[1], b[1]),
      Math.max(cell.bounds[2], b[2]),
      Math.max(cell.bounds[3], b[3]),
    ];
    cell.features.push(item);
  });
  return {
    core: { id: 'campus-core', bounds: map.bounds, features: core },
    surrounding: [
      { id: 'context-shared', bounds: map.coverageBounds, features: shared },
      ...cells.values(),
    ].filter((c) => c.features.length),
  };
}

export async function buildRuntime() {
  const root = new URL('../../public/osm/', import.meta.url);
  const output = new URL('runtime/', root);
  const map = JSON.parse(await readFile(new URL('campus-render.json', root), 'utf8'));
  const forest = JSON.parse(await readFile(new URL('campus-forest-texture.json', root), 'utf8'));
  const { features, ...metadata } = map;
  const partition = partitionBasemap(map);
  await mkdir(output, { recursive: true });
  async function asset(id, value, compactNumbers = false) {
    // Rendering paths stay byte-for-byte identical. Numeric feature metadata
    // retains six decimal places; source GeoJSON, venue coordinates and map metadata stay intact.
    const replacer = compactNumbers
      ? (_key, item) => (typeof item === 'number' ? Number(item.toFixed(6)) : item)
      : undefined;
    const bytes = Buffer.from(JSON.stringify(value, replacer) + '\n');
    const file = `${id}.${hash(bytes)}.json`;
    await writeFile(new URL(file, output), bytes);
    return { id, file, bytes: bytes.length };
  }
  async function chunk(value) {
    return {
      ...(await asset(value.id, { version: 1, features: value.features }, true)),
      bounds: value.bounds,
      featureCount: value.features.length,
    };
  }
  const core = await chunk(partition.core);
  const surrounding = [];
  for (const value of partition.surrounding) surrounding.push(await chunk(value));
  const texture = await asset('forest-texture', forest);
  const manifest = { version: 1, metadata, core, surrounding, forest: texture, cellSize: 1024 };
  const revision = hash(JSON.stringify(manifest));
  await writeFile(new URL('index.json', output), JSON.stringify({ ...manifest, revision }) + '\n');
  console.log(
    JSON.stringify(
      {
        revision,
        coreFeatures: core.featureCount,
        coreBytes: core.bytes,
        surroundingChunks: surrounding.length,
        manifestBytes: Buffer.byteLength(JSON.stringify({ ...manifest, revision })),
        sourceBytes: (await readFile(new URL('campus-render.json', root))).length,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildRuntime();
