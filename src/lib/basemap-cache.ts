import { createBasemapLoader } from './basemap-loading';
import { openBasemapStorage } from './basemap-storage';

const cacheNames = new Map<
  string,
  Promise<Awaited<ReturnType<typeof openBasemapStorage>> | undefined>
>();
function embeddedManifest(): unknown {
  try {
    const text = document.getElementById('campus-basemap-manifest')?.textContent;
    return text ? JSON.parse(text) : undefined;
  } catch {
    // 旧 HTML 或无内嵌目录的开发入口继续走原来的网络加载与重试。
    return undefined;
  }
}
export const basemapLoader = createBasemapLoader({
  baseUrl: `${import.meta.env.BASE_URL}osm/runtime/`,
  initialManifest: embeddedManifest(),
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
