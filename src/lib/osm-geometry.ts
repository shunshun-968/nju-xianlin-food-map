export type Position = [number, number];
export type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'MultiPoint'; coordinates: Position[] }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };
export type OsmFeature = {
  type: 'Feature';
  id: string;
  geometry: Geometry;
  properties: Record<string, unknown>;
};
export type OsmCollection = { type: 'FeatureCollection'; features: OsmFeature[] };
export const layerIds = [
  'boundary',
  'roads',
  'buildings',
  'land',
  'water',
  'pois',
  'labels',
] as const;
export type LayerId = (typeof layerIds)[number];
export type OsmManifest = {
  bbox: [number, number, number, number];
  boundary: { id: string; name: string; bbox: number[]; address: string; version: number };
  sources: { file: string; url: string; retrievedAt: string; sha256: string }[];
  method: string;
  counts: Record<LayerId, number>;
  buildingsWithCourtyards: number;
  uniqueFeatures: number;
};

/** Local metric approximation at campus latitude. Data stays in WGS84 lon/lat. */
export function campusProjection(bbox: [number, number, number, number]) {
  const [west, south, east, north] = bbox;
  const metres = (Math.PI * 6371008.8) / 180;
  const longitudeScale = metres * Math.cos((((south + north) / 2) * Math.PI) / 180);
  return {
    project: ([lon, lat]: Position): Position => [
      (lon - west) * longitudeScale,
      (north - lat) * metres,
    ],
    unproject: ([x, y]: Position): Position => [west + x / longitudeScale, north - y / metres],
    width: (east - west) * longitudeScale,
    height: (north - south) * metres,
  };
}

export function geometryPath(geometry: Geometry, project: (point: Position) => Position): string {
  const line = (points: Position[], closed = false) =>
    points
      .map((p, i) => {
        const [x, y] = project(p);
        return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join('') + (closed ? 'Z' : '');
  switch (geometry.type) {
    case 'Point':
    case 'MultiPoint':
      return '';
    case 'LineString':
      return line(geometry.coordinates);
    case 'MultiLineString':
      return geometry.coordinates.map((points) => line(points)).join('');
    case 'Polygon':
      return geometry.coordinates.map((ring) => line(ring, true)).join('');
    case 'MultiPolygon':
      return geometry.coordinates
        .flatMap((polygon) => polygon.map((ring) => line(ring, true)))
        .join('');
  }
}

/** A display anchor, not a surveyed entrance or venue position. */
export function geometryAnchor(geometry: Geometry): Position {
  if (geometry.type === 'Point') return geometry.coordinates;
  if (geometry.type === 'LineString' || geometry.type === 'MultiPoint')
    return geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
  if (geometry.type === 'MultiLineString') return geometry.coordinates[0][0];
  const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
  return [
    (Math.min(...ring.map((p) => p[0])) + Math.max(...ring.map((p) => p[0]))) / 2,
    (Math.min(...ring.map((p) => p[1])) + Math.max(...ring.map((p) => p[1]))) / 2,
  ];
}

export function featureName(feature: OsmFeature): string {
  return String(
    feature.properties['name:zh'] ||
      feature.properties.name ||
      feature.properties['name:en'] ||
      '未命名要素',
  );
}
