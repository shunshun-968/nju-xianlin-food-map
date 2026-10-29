const PREFIX = 'nju-basemap-v1-';

/** 目录更新不会改变几何分块的内容哈希，允许复用上一版的同名资源。 */
export async function openBasemapStorage(storage: CacheStorage, revision: string) {
  const name = `${PREFIX}${revision}`;
  const current = await storage.open(name);
  const old = (await storage.keys()).filter((key) => key.startsWith(PREFIX) && key !== name);
  const previous = old.length ? await storage.open(old[old.length - 1]) : undefined;
  // 清理不阻塞首屏；只管理本应用的缓存，并保留上一版供哈希资源迁移。
  void Promise.all(old.slice(0, -1).map((key) => storage.delete(key))).catch(() => undefined);
  return {
    async match(request: RequestInfo | URL, options?: CacheQueryOptions) {
      const hit = await current.match(request, options);
      if (hit) return hit;
      const url = request instanceof Request ? request.url : String(request);
      if (!/\.[a-f0-9]{16}\.json(?:\?.*)?$/.test(url)) return undefined;
      const saved = await previous?.match(request, options);
      if (saved) void current.put(request, saved.clone()).catch(() => undefined);
      return saved;
    },
    put: current.put.bind(current),
    delete: current.delete.bind(current),
  };
}
