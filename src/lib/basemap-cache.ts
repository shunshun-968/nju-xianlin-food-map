import { createBasemapLoader } from './basemap-loading';
import { openBasemapStorage } from './basemap-storage';

const cacheNames = new Map<
  string,
  Promise<Awaited<ReturnType<typeof openBasemapStorage>> | undefined>
>();
export const basemapLoader = createBasemapLoader({
  baseUrl: `${import.meta.env.BASE_URL}osm/runtime/`,
  openCache: (revision) => {
    if (!cacheNames.has(revision))
      cacheNames.set(
        revision,
        (async () => {
          if (!('caches' in globalThis)) return undefined;
          return openBasemapStorage(caches, revision);
        })().catch(() => undefined),
      );
    return cacheNames.get(revision)!;
  },
});
