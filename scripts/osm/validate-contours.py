"""Read-only source, geometry, and elevation checks, independent of the builder."""
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.cache/osm-build'))
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates
from shapely.geometry import shape
from shapely.ops import transform, unary_union


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    out = ROOT / 'public/osm'
    scene = read(out / 'campus-render.json')
    report = read(out / 'campus-contours-report.json')
    render = read(out / 'campus-contours.json')
    source = read(ROOT / 'data/dem/raw/source.json')
    require(hashlib.sha256((ROOT / 'data/dem/raw' / source['file']).read_bytes()).hexdigest() == report['sourceSha256'] == source['sha256'], 'DEM checksum mismatch')
    for filename, expected in report['inputHashes'].items():
        require(hashlib.sha256((out / filename).read_bytes()).hexdigest() == expected, f'Stale contours: {filename} changed; rebuild contours')
    p = scene['projection']

    def project(x, y, z=None):
        return ((x - p['origin'][0]) * p['metresPerLongitudeDegree'],
                (p['origin'][1] - y) * p['metresPerLatitudeDegree'])

    campus = transform(project, shape(read(out / 'campus-retention.geojson')['features'][0]['geometry']))
    mask = transform(project, shape(read(out / 'campus-contour-mask.geojson')['features'][0]['geometry']))
    require(mask.is_valid and not mask.is_empty and campus.buffer(.001).covers(mask), 'Mask is invalid or extends outside campus')
    by_id = {f['id']: f for f in read(out / 'campus-map.geojson')['features']}
    greens = []
    for gid in report['greenOsmIds']:
        feature = by_id[gid]
        tags = feature['properties']
        require(not tags.get('sport') and not tags.get('building'), f'Not green space: {gid}')
        require(any(tags.get(key) in {'wood','forest','scrub','grass','grassland','meadow','garden','park','recreation_ground'} for key in ['natural','landuse','leisure']), f'Wrong green tags: {gid}')
        geometry = transform(project, shape(feature['geometry'])).intersection(campus)
        require(geometry.area >= report['minimumGreenAreaM2'], f'Green area too small: {gid}')
        greens.append(geometry)
    require(unary_union(greens).buffer(.001).covers(mask), 'Mask leaves actual green polygons')
    obstacles = []
    for f in scene['features']:
        if f['kind'] in {'building', 'water', 'road'} or f.get('sport'):
            geometry = transform(project, shape(by_id[f['id']]['geometry']))
            if f['kind'] == 'road':
                geometry = geometry.buffer(f.get('width', 6) / 2)
            if geometry.intersects(campus):
                obstacles.append(geometry)
    obstacles = unary_union(obstacles)
    require(mask.intersection(obstacles).area < .001, 'Mask overlaps buildings, roads, water or sport areas')

    rgb = np.asarray(Image.open(ROOT / 'data/dem/raw' / source['file']).convert('RGB'), dtype=float)
    heights = gaussian_filter(rgb[:,:,0]*256 + rgb[:,:,1] + rgb[:,:,2]/256 - 32768,
                              sigma=report['gaussianSigmaPixels'], mode='nearest')
    features = read(out / 'campus-contours.geojson')['features']
    require(len(features) == report['lineCount'] == len(render['lines']) > 0, 'Contour count mismatch')
    require(len({f['id'] for f in features}) == len(features), 'Duplicate contour IDs')
    require(render['intervalMetres'] == report['intervalMetres'] == 5, 'Unexpected contour interval')
    require([(f['id'],f['properties']['elevation_m']) for f in features] == [(f['id'],f['elevation']) for f in render['lines']], 'GeoJSON/render elevations differ')
    max_error = 0
    for f in features:
        g = transform(project, shape(f['geometry']))
        elevation = f['properties']['elevation_m']
        require(g.is_valid and not g.is_empty and g.geom_type == 'LineString', 'Invalid contour geometry')
        require(mask.buffer(.001).covers(g), f'Contour escapes green mask: {f["id"]}')
        require(not g.intersects(obstacles), f'Contour crosses an obstacle: {f["id"]}')
        require(elevation % report['intervalMetres'] == 0, 'Wrong height spacing')
        # Compare every saved vertex with the decoded, smoothed source raster.
        coordinates = np.array(f['geometry']['coordinates'])
        n = 2 ** source['zoom']
        columns = ((coordinates[:,0]+180)/360*n-source['x'])*256-.5
        rows = ((1-np.arcsinh(np.tan(np.radians(coordinates[:,1])))/math.pi)/2*n-source['y'])*256-.5
        sampled = map_coordinates(heights,[rows,columns],order=1)
        max_error = max(max_error, float(np.abs(sampled-elevation).max()))
    require(max_error < .5, f'Contour heights differ from source by {max_error:.3f} m')
    print(json.dumps({'status':'valid', 'lines':len(features), 'greenAreas':len(greens),
                      'intervalMetres':report['intervalMetres'], 'maximumInterpolationResidualM':round(max_error,4),
                      'insideCampusGreens':True, 'avoidsRoadsBuildingsWaterSports':True,
                      'rawDemHashVerified':True}, indent=2))


if __name__ == '__main__':
    main()
