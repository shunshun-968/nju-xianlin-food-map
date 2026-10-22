import type { CampusBasemap, MapFeature, MapTransform } from './campus-basemap';

export type Bounds = [number, number, number, number];
export type MapAsset = { id: string; file: string; bytes: number };
export type MapChunk = MapAsset & { bounds: Bounds; featureCount: number };
export type MapManifest = {
  version: number;
  revision: string;
  metadata: Omit<CampusBasemap, 'features'>;
  core: MapChunk;
  surrounding: MapChunk[];
  forest: MapAsset;
};
export type FeatureChunk = { version: number; features: MapFeature[] };

export const intersectsBounds = (a: Bounds, b: Bounds) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
export function viewportBounds(
  t: MapTransform,
  size: { width: number; height: number },
  margin = 0,
): Bounds {
  return [
    -t.x / t.scale - margin,
    -t.y / t.scale - margin,
    (size.width - t.x) / t.scale + margin,
    (size.height - t.y) / t.scale + margin,
  ];
}
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}
export function chunksForBounds(manifest: MapManifest, bounds: Bounds) {
  return manifest.surrounding.filter((chunk) => intersectsBounds(chunk.bounds, bounds));
}
export function mergeMapFeatures(chunks: FeatureChunk[]): MapFeature[] {
  const features = new Map<string, MapFeature>();
  for (const chunk of chunks)
    for (const feature of chunk.features) features.set(feature.id, feature);
  return [...features.values()].sort((a, b) => (a.renderOrder ?? 0) - (b.renderOrder ?? 0));
}

type CacheLike = Pick<Cache, 'match' | 'put' | 'delete'>;
type LoaderOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  openCache?: (revision: string) => Promise<CacheLike | undefined>;
};

/** Shared parsed values + in-flight requests. Failure is never permanently cached. */
export function createBasemapLoader({ baseUrl, fetcher = fetch, openCache }: LoaderOptions) {
  const values = new Map<string, unknown>();
  const pending = new Map<string, Promise<unknown>>();
  const queue: { run: () => void; background: boolean }[] = [];
  let active = 0;
  let manifestPromise: Promise<MapManifest> | undefined;
  function pump() {
    while (active < 2 && queue.length) {
      const foreground = queue.findIndex((job) => !job.background);
      const job = queue.splice(foreground < 0 ? 0 : foreground, 1)[0];
      active++;
      job.run();
    }
  }
  function schedule<T>(operation: () => Promise<T>, background: boolean): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({
        background,
        run: () => {
          operation()
            .then(resolve, reject)
            .finally(() => {
              active--;
              pump();
            });
        },
      });
      pump();
    });
  }
  function loadManifest(): Promise<MapManifest> {
    if (!manifestPromise) {
      manifestPromise = fetcher(`${baseUrl}index.json`, { cache: 'no-cache' })
        .then(async (response) => {
          if (!response.ok) throw new Error(`地图目录 HTTP ${response.status}`);
          const value = (await response.json()) as MapManifest;
          if (
            value.version !== 1 ||
            !value.revision ||
            !value.core?.file ||
            !Array.isArray(value.surrounding) ||
            value.metadata?.venues?.length !== 7
          )
            throw new Error('地图目录不完整');
          return value;
        })
        .catch((error) => {
          manifestPromise = undefined;
          throw error;
        });
    }
    return manifestPromise;
  }
  function readAsset<T>(
    manifest: MapManifest,
    asset: MapAsset,
    validate: (value: unknown) => value is T,
    background = false,
  ): Promise<T> {
    const key = `${manifest.revision}/${asset.file}`;
    if (values.has(key)) return Promise.resolve(values.get(key) as T);
    if (pending.has(key)) return pending.get(key) as Promise<T>;
    const url = `${baseUrl}${asset.file}`;
    const promise = schedule(async () => {
      let cache: CacheLike | undefined;
      try {
        cache = await openCache?.(manifest.revision);
      } catch {
        /* Storage can be disabled. */
      }
      try {
        const saved = await cache?.match(url);
        if (saved) {
          const value: unknown = await saved.json();
          if (validate(value)) {
            values.set(key, value);
            return value;
          }
          await cache?.delete(url);
        }
      } catch {
        /* Corrupt or evicted cache entries fall back to the network. */
      }
      const response = await fetcher(url, {
        cache: 'force-cache',
        priority: background ? 'low' : 'high',
      });
      if (!response.ok) throw new Error(`地图分块 HTTP ${response.status}`);
      const saved = response.clone();
      const value: unknown = await response.json();
      if (!validate(value)) throw new Error('地图分块不完整');
      values.set(key, value);
      try {
        await cache?.put(url, saved);
      } catch {
        /* Quota failure must not block the map. */
      }
      return value;
    }, background);
    pending.set(key, promise);
    promise.then(
      () => pending.delete(key),
      () => pending.delete(key),
    );
    return promise;
  }
  const isChunk = (value: unknown): value is FeatureChunk => {
    const chunk = value as FeatureChunk;
    return (
      chunk?.version === 1 &&
      Array.isArray(chunk.features) &&
      chunk.features.every(
        (f) => typeof f.id === 'string' && typeof f.path === 'string' && f.bounds?.length === 4,
      )
    );
  };
  function loadChunk(manifest: MapManifest, chunk: MapChunk, background = false) {
    return readAsset(
      manifest,
      chunk,
      (value): value is FeatureChunk =>
        isChunk(value) &&
        value.features.length === chunk.featureCount &&
        new Set(value.features.map((f) => f.id)).size === value.features.length,
      background,
    );
  }
  function cachedChunk(manifest: MapManifest, chunk: MapChunk) {
    return values.get(`${manifest.revision}/${chunk.file}`) as FeatureChunk | undefined;
  }
  async function loadForest() {
    const manifest = await loadManifest();
    return readAsset(
      manifest,
      manifest.forest,
      (value): value is { version: number; maskPath: string; crowns: unknown[] } => {
        const forest = value as { version: number; maskPath: string; crowns: unknown[] };
        return (
          forest?.version === 1 &&
          typeof forest.maskPath === 'string' &&
          Array.isArray(forest.crowns)
        );
      },
    );
  }
  return { loadManifest, loadChunk, cachedChunk, loadForest };
}
