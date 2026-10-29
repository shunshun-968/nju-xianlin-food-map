import { layerIds, type LayerId, type OsmCollection, type OsmManifest } from './osm-geometry';

export type OsmPreviewDataset = {
  manifest: OsmManifest;
  layers: Record<LayerId, OsmCollection>;
  venues: OsmCollection;
  references: OsmCollection;
};

/** 与正式地图一样共享下载与解析结果；StrictMode 或页面重进不会重启同一批资源。 */
export function createOsmPreviewLoader(baseUrl: string, fetcher: typeof fetch = fetch) {
  const files = new Map<string, Promise<unknown>>();
  let dataset: Promise<OsmPreviewDataset> | undefined;
  function get(file: string) {
    const existing = files.get(file);
    if (existing) return existing;
    const pending = fetcher(`${baseUrl}${file}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
        return response.json();
      })
      .catch((error: unknown) => {
        files.delete(file);
        throw error;
      });
    files.set(file, pending);
    return pending;
  }
  return {
    load(): Promise<OsmPreviewDataset> {
      dataset ??= Promise.all([
        get('manifest.json'),
        get('food-venues.geojson'),
        get('venue-references.geojson'),
        ...layerIds.map((id) => get(`${id}.geojson`)),
      ])
        .then(([manifest, venues, references, ...layers]) => ({
          manifest: manifest as OsmManifest,
          venues: venues as OsmCollection,
          references: references as OsmCollection,
          layers: Object.fromEntries(layerIds.map((id, index) => [id, layers[index]])) as Record<
            LayerId,
            OsmCollection
          >,
        }))
        .catch((error: unknown) => {
          dataset = undefined;
          throw error;
        });
      return dataset;
    },
  };
}
