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
  initialManifest?: unknown;
};

function isMapManifest(value: unknown): value is MapManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as MapManifest;
  return (
    manifest.version === 1 &&
    typeof manifest.revision === 'string' &&
    !!manifest.revision &&
    typeof manifest.core?.file === 'string' &&
    !!manifest.core.file &&
    Array.isArray(manifest.surrounding) &&
    manifest.metadata?.venues?.length === 7
  );
}

/** Shared parsed values + in-flight requests. Failure is never permanently cached. */
export function createBasemapLoader({
  baseUrl,
  fetcher = fetch,
  openCache,
  initialManifest,
}: LoaderOptions) {
  const values = new Map<string, unknown>();
  type Priority = { background: boolean };
  const pending = new Map<string, { promise: Promise<unknown>; priority: Priority }>();
  const queue: { run: () => void; priority: Priority }[] = [];
  let active = 0;
  // 与 HTML 一同送达的当前版本目录消除首访的一次串行网络等待，不依赖已有缓存。
  let manifestPromise: Promise<MapManifest> | undefined = isMapManifest(initialManifest)
    ? Promise.resolve(initialManifest)
    : undefined;
  function pump() {
    while (active < 2 && queue.length) {
      const foreground = queue.findIndex((job) => !job.priority.background);
      const job = queue.splice(foreground < 0 ? 0 : foreground, 1)[0];
      active++;
      job.run();
    }
  }
  function schedule<T>(operation: () => Promise<T>, priority: Priority): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({
        priority,
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
          const value: unknown = await response.json();
          if (!isMapManifest(value)) throw new Error('地图目录不完整');
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
    const existing = pending.get(key);
    if (existing) {
      // 预取中的区域进入视野时复用请求，并提升尚未开始的任务，不排在旧预取之后。
      if (!background) existing.priority.background = false;
      return existing.promise as Promise<T>;
    }
    const priority = { background };
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
        priority: priority.background ? 'low' : 'high',
      });
      if (!response.ok) throw new Error(`地图分块 HTTP ${response.status}`);
      const saved = response.clone();
      const value: unknown = await response.json();
      if (!validate(value)) throw new Error('地图分块不完整');
      values.set(key, value);
      try {
        // 数据已可绘制；手机缓存写盘较慢时，不应继续挡住首屏和后续请求。
        void cache?.put(url, saved).catch(() => undefined);
      } catch {
        /* Quota failure must not block the map. */
      }
      return value;
    }, priority);
    pending.set(key, { promise, priority });
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
