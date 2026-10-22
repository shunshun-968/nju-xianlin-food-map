import osmtogeojson from 'osmtogeojson';

export const BBOX = [118.9442, 32.1099, 118.9621, 32.1297];
export const BOUNDARY_ID = 'way/89910837';
export const LAYERS = ['boundary', 'roads', 'buildings', 'land', 'water', 'pois', 'labels'];
export const collection = (features) => ({ type: 'FeatureCollection', features });

// More than one thematic layer may reference the same stable OSM ID.
export function layerNames(feature) {
  const p = feature.properties;
  const layers = [];
  if (feature.id === BOUNDARY_ID) layers.push('boundary');
  if (p.highway) layers.push('roads');
  if (p.building || p['building:part']) layers.push('buildings');
  if (p.landuse || p.leisure || p.natural) layers.push('land');
  if (p.waterway || p.water || p.natural === 'water' || p.landuse === 'reservoir')
    layers.push('water');
  if (p.amenity || p.shop) layers.push('pois');
  if (p.name || p['name:zh'] || p['name:en']) layers.push('labels');
  return layers;
}

export function normalizeGeoJSON(input) {
  if (input.type !== 'FeatureCollection' || !Array.isArray(input.features))
    throw new Error('Expected a GeoJSON FeatureCollection');
  return collection(
    input.features.map((feature) => {
      const original = feature.properties || {};
      const tags = original.tags || original;
      const osmId =
        feature.id ||
        original['@id'] ||
        (original.type && original.id ? `${original.type}/${original.id}` : null);
      if (!osmId || !/^(node|way|relation)\/\d+$/.test(String(osmId)))
        throw new Error('GeoJSON must preserve stable OSM IDs (Overpass Turbo export)');
      if (!feature.geometry) throw new Error(`Missing geometry: ${osmId}`);
      return {
        type: 'Feature',
        id: String(osmId),
        geometry: feature.geometry,
        properties: {
          ...tags,
          osm_id: String(osmId),
          ...(original.meta ? { osm_meta: original.meta } : {}),
          ...(original.tainted || original['@tainted'] ? { osm_tainted: true } : {}),
        },
      };
    }),
  );
}

export function convertOSM(documents) {
  const elements = new Map();
  for (const document of documents) {
    if (!Array.isArray(document.elements) || document.remark)
      throw new Error(`Incomplete OSM response: ${document.remark || 'missing elements'}`);
    for (const e of document.elements) {
      const key = `${e.type}/${e.id}`,
        old = elements.get(key);
      if (!old || (e.version || 0) >= (old.version || 0)) elements.set(key, e);
    }
  }
  return normalizeGeoJSON(
    osmtogeojson({ elements: [...elements.values()] }, { flatProperties: false }),
  );
}

export function splitLayers(geojson) {
  const layers = Object.fromEntries(LAYERS.map((name) => [name, collection([])]));
  const rejected = [],
    ignored = [];
  for (const feature of geojson.features) {
    // Routes aren't base-map geometries. The individual highway ways are retained.
    if (feature.properties.type === 'route' || feature.properties.type === 'route_master') {
      ignored.push(feature.id);
      continue;
    }
    const names = layerNames(feature);
    if (!names.length) continue;
    if (feature.properties.osm_tainted) {
      rejected.push(feature.id);
      continue;
    }
    for (const name of names) layers[name].features.push(feature);
  }
  for (const layer of Object.values(layers))
    layer.features.sort((a, b) => a.id.localeCompare(b.id));
  return { layers, rejected, ignored };
}
