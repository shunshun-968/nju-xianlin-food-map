import { createBasemapLoader } from './basemap-loading';

const cacheNames = new Map<string, Promise<Cache | undefined>>();
export const basemapLoader = createBasemapLoader({
  baseUrl: `${import.meta.env.BASE_URL}osm/runtime/`,
  openCache: (revision) => {
    if (!cacheNames.has(revision))
      cacheNames.set(
        revision,
        (async () => {
          if (!('caches' in globalThis)) return undefined;
          const name = `nju-basemap-v1-${revision}`;
          const cache = await caches.open(name);
          // Keep the current and one previous map revision, without touching other app caches.
          const old = (await caches.keys()).filter(
            (key) => key.startsWith('nju-basemap-v1-') && key !== name,
          );
          await Promise.all(old.slice(0, -1).map((key) => caches.delete(key)));
          return cache;
        })().catch(() => undefined),
      );
    return cacheNames.get(revision)!;
  },
});
