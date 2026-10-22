"""Offline DEM contours, restricted to large campus green areas.

The static output is used by the outer map only; ordinary builds need no GIS stack.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.cache/osm-build'))
import contourpy
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates
from shapely.geometry import shape, mapping, LineString
from shapely.ops import transform, unary_union
from shapely import contains_xy

OUT = ROOT / 'public/osm'
RAW = ROOT / 'data/dem/raw'
INTERVAL = 5
MIN_GREEN_AREA = 10000
SMOOTH_SIGMA = 0.8
GRID_STEP = 8  # Interpolated display grid, not additional measurement resolution.
GREEN_TYPES = {'wood', 'forest', 'scrub', 'grass', 'grassland', 'meadow', 'garden', 'park', 'recreation_ground'}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def parts(geometry, kind):
    if geometry.geom_type == kind:
        yield geometry
    elif hasattr(geometry, 'geoms'):
        for child in geometry.geoms:
            yield from parts(child, kind)


def svg_path(geometry):
    if geometry.geom_type == 'LineString':
        return ''.join(('M' if i == 0 else 'L') + f'{x:.2f} {y:.2f}' for i, (x, y) in enumerate(geometry.coords))
    if geometry.geom_type == 'Polygon':
        return ''.join(svg_path(LineString(ring.coords)) + 'Z' for ring in [geometry.exterior, *geometry.interiors])
    return ''.join(svg_path(g) for g in geometry.geoms) if hasattr(geometry, 'geoms') else ''


def main():
    scene = read(OUT / 'campus-render.json')
    projection = scene['projection']
    lon0, lat0 = projection['origin']
    mx, my = projection['metresPerLongitudeDegree'], projection['metresPerLatitudeDegree']

    def project(lon, lat, z=None):
        return (lon - lon0) * mx, (lat0 - lat) * my

    def inverse(x, y, z=None):
        return lon0 + x / mx, lat0 - y / my

    campus = transform(project, shape(read(OUT / 'campus-retention.geojson')['features'][0]['geometry']))
    geometries = {f['id']: transform(project, shape(f['geometry'])) for f in read(OUT / 'campus-map.geojson')['features']}
    greens, green_ids, exclusions = [], [], []
    for f in scene['features']:
        geometry = geometries[f['id']]
        if not geometry.intersects(campus):
            continue
        if f['kind'] == 'land' and f.get('subtype') in GREEN_TYPES and not f.get('sport'):
            large = [p for p in parts(geometry.intersection(campus), 'Polygon') if p.area >= MIN_GREEN_AREA]
            if large:
                greens.extend(large)
                green_ids.append(f['id'])
        if f['kind'] in {'building', 'water'} or f.get('sport'):
            exclusions.append(geometry.buffer(3))
        elif f['kind'] == 'road':
            exclusions.append(geometry.buffer(f.get('width', 6) / 2 + 2))
    if not greens:
        raise ValueError('No eligible campus green polygons')
    green = unary_union(greens).intersection(campus)
    mask = green.buffer(-2).difference(unary_union(exclusions))
    if mask.is_empty or not mask.is_valid:
        raise ValueError('Invalid contour display mask')

    source = read(RAW / 'source.json')
    raw_file = RAW / source['file']
    if hashlib.sha256(raw_file.read_bytes()).hexdigest() != source['sha256']:
        raise ValueError('Archived DEM checksum mismatch')
    rgb = np.asarray(Image.open(raw_file).convert('RGB'), dtype=np.float64)
    if rgb.shape != (256, 256, 3):
        raise ValueError('Expected a 256x256 Terrarium tile')
    elevations = rgb[:, :, 0] * 256 + rgb[:, :, 1] + rgb[:, :, 2] / 256 - 32768
    if not np.isfinite(elevations).all() or np.any(elevations <= -32768):
        raise ValueError('DEM contains missing or non-finite elevations')
    smoothed = gaussian_filter(elevations, sigma=SMOOTH_SIGMA, mode='nearest')

    # Sample pixel centres (not edges), converting Web Mercator XYZ to the same
    # local metric projection used by the existing OSM map.
    left, top, right, bottom = campus.buffer(100).bounds
    xs, ys = np.arange(left, right + GRID_STEP, GRID_STEP), np.arange(top, bottom + GRID_STEP, GRID_STEP)
    xx, yy = np.meshgrid(xs, ys)
    lon, lat = inverse(xx, yy)
    n = 2 ** source['zoom']
    columns = ((lon + 180) / 360 * n - source['x']) * 256 - 0.5
    rows = ((1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * n - source['y']) * 256 - 0.5
    if min(columns.min(), rows.min()) < 3 or max(columns.max(), rows.max()) > 252:
        raise ValueError('DEM does not fully cover campus plus smoothing margin')
    grid = map_coordinates(smoothed, [rows, columns], order=1, mode='nearest')
    inside = contains_xy(green, xx, yy)
    low, high = float(grid[inside].min()), float(grid[inside].max())
    generator = contourpy.contour_generator(x=xs, y=ys, z=grid, name='serial', line_type='Separate')
    features, rendered = [], []
    for height in range(math.ceil(low / INTERVAL) * INTERVAL, math.floor(high / INTERVAL) * INTERVAL + 1, INTERVAL):
        for coordinates in generator.lines(height):
            # Simplification is much smaller than the source grid. Reclip after
            # simplification so lines can never cut across a road or an inner hole.
            line = LineString(coordinates).simplify(0.7).intersection(mask)
            for segment in parts(line, 'LineString'):
                if segment.length < 18:
                    continue
                identifier = f'contour-{height}-{len(features)}'
                features.append({'type': 'Feature', 'id': identifier,
                                 'properties': {'elevation_m': height, 'interval_m': INTERVAL},
                                 'geometry': mapping(transform(inverse, segment))})
                rendered.append({'id': identifier, 'elevation': height, 'path': svg_path(segment)})

    if not rendered:
        raise ValueError('DEM generated no contours in campus green areas')
    spacing = math.cos(math.radians(lat0)) * 2 * math.pi * 6378137 / (256 * n)
    report = {
        'version': 1, 'intervalMetres': INTERVAL, 'elevationRangeMetres': [round(low, 2), round(high, 2)],
        'source': source['dataset'], 'sourceUrl': source['url'], 'sourceSha256': source['sha256'],
        'retrievedAt': source['retrievedAt'], 'tileSources': source['headers'].get('x-amz-meta-x-imagery-sources'),
        'sourceGridSpacingMetres': round(spacing, 2), 'gaussianSigmaPixels': SMOOTH_SIGMA,
        'interpolatedGridMetres': GRID_STEP, 'minimumGreenAreaM2': MIN_GREEN_AREA,
        'greenOsmIds': green_ids, 'displayAreaM2': round(mask.area, 2), 'lineCount': len(rendered),
        'attribution': 'Mapzen / Tilezen; SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey',
        'use': 'Smoothed terrain illustration; contour interval is not a statement of vertical accuracy.',
        'inputHashes': {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest()
                        for name in ['campus-map.geojson', 'campus-retention.geojson', 'campus-render.json']},
    }
    outputs = {
        'campus-contours.geojson': {'type': 'FeatureCollection', 'features': features},
        'campus-contour-mask.geojson': {'type': 'FeatureCollection', 'features': [
            {'type': 'Feature', 'properties': {'role': 'contour-display-mask'}, 'geometry': mapping(transform(inverse, mask))}]},
        'campus-contours.json': {**report, 'maskPath': svg_path(mask), 'lines': rendered},
        'campus-contours-report.json': report,
    }
    for filename, value in outputs.items():
        (OUT / filename).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
