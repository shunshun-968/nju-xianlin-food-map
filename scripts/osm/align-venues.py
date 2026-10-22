"""Reproduce screenshot alignment from reviewed pixel/OSM control pairs (stdlib only)."""
import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'data/osm/venue-alignment.json'
OUTPUT = ROOT / 'public/osm'
METRES_PER_DEGREE = math.pi * 6371008.8 / 180
ORIGIN = [118.95, 32.12]
LON_SCALE = METRES_PER_DEGREE * math.cos(math.radians(ORIGIN[1]))


def project(coordinate):
    return [(coordinate[0] - ORIGIN[0]) * LON_SCALE,
            (ORIGIN[1] - coordinate[1]) * METRES_PER_DEGREE]


def unproject(point):
    return [ORIGIN[0] + point[0] / LON_SCALE,
            ORIGIN[1] - point[1] / METRES_PER_DEGREE]


def solve(matrix, vector):
    """3x3 linear system, pivoted Gaussian elimination."""
    rows = [list(row) + [value] for row, value in zip(matrix, vector)]
    for column in range(3):
        pivot = max(range(column, 3), key=lambda i: abs(rows[i][column]))
        rows[column], rows[pivot] = rows[pivot], rows[column]
        if abs(rows[column][column]) < 1e-12:
            raise ValueError('Collinear alignment controls')
        divisor = rows[column][column]
        rows[column] = [value / divisor for value in rows[column]]
        for row in range(3):
            if row != column:
                factor = rows[row][column]
                rows[row] = [a - factor * b for a, b in zip(rows[row], rows[column])]
    return [row[3] for row in rows]


def fit(pixels, targets):
    centre = [sum(p[i] for p in pixels) / len(pixels) for i in range(2)]
    scale = max(math.dist(p, centre) for p in pixels)
    design = [[(p[0] - centre[0]) / scale, (p[1] - centre[1]) / scale, 1] for p in pixels]
    normal = [[sum(row[i] * row[j] for row in design) for j in range(3)] for i in range(3)]
    coefficients = [solve(normal, [sum(row[i] * target[axis] for row, target in zip(design, targets))
                                  for i in range(3)]) for axis in range(2)]

    def transform(pixel):
        row = [(pixel[0] - centre[0]) / scale, (pixel[1] - centre[1]) / scale, 1]
        return [sum(a * b for a, b in zip(row, axis)) for axis in coefficients]

    return transform, {'pixelCentre': centre, 'pixelScale': scale, 'coefficients': coefficients,
                       'localOriginLonLat': ORIGIN, 'localLongitudeMetresPerDegree': LON_SCALE,
                       'localLatitudeMetresPerDegree': METRES_PER_DEGREE}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--images-dir', type=Path, help='Optionally verify the original reference image SHA-256s')
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    all_features = json.loads((OUTPUT / 'all.geojson').read_text(encoding='utf-8'))
    by_id = {f['id']: f for f in all_features['features']}
    venues, references, reports = [], [], []
    for entry in config['venues']:
        if args.images_dir:
            source = args.images_dir / entry['sourceImage']
            if hashlib.sha256(source.read_bytes()).hexdigest() != entry['sourceSha256']:
                raise ValueError(f"Reference image changed: {source}; review its controls and blue mark again")
        reference = by_id[entry['referenceOsmId']]
        geometry = reference['geometry']
        vertices = geometry['coordinates'][0] if geometry['type'] == 'Polygon' else geometry['coordinates']
        pixels = [c['pixel'] for c in entry['controls']]
        targets = [project(vertices[c['vertex']]) for c in entry['controls']]
        transform, model = fit(pixels, targets)
        errors = [math.dist(transform(pixel), target) for pixel, target in zip(pixels, targets)]
        if max(errors) > 1:
            raise ValueError(f"Control mismatch >1m for {entry['venueId']}: {errors}")
        held_out_errors = []
        for i in range(len(pixels)):
            other_pixels = pixels[:i] + pixels[i + 1:]
            other_targets = targets[:i] + targets[i + 1:]
            held_out, _ = fit(other_pixels, other_targets)
            held_out_errors.append(math.dist(held_out(pixels[i]), targets[i]))
        point = [round(value, 7) for value in unproject(transform(entry['markedPixel']))]
        feature = {'type': 'Feature', 'id': f"venue/{entry['venueId']}",
                   'geometry': {'type': 'Point', 'coordinates': point}, 'properties': {
                       'name': entry['name'], 'venue_id': entry['venueId'],
                       'catalog_name': entry['catalogName'], 'reference_osm_id': reference['id'],
                       'source_image': entry['sourceImage'], 'source_sha256': entry['sourceSha256'],
                       'alignment_method': 'visual-screenshot-affine', 'review_status': entry['reviewStatus'],
                       'surveyed': False, 'visual_review_radius_m': entry['visualReviewRadiusMetres'],
                       'placement_note': entry['placementNote'],
                       **({'indoor': entry['indoor']} if 'indoor' in entry else {}),
                       **({'location_note': entry['locationNote']} if 'locationNote' in entry else {}),
                       **({'reviewed_at': entry['reviewedAt']} if 'reviewedAt' in entry else {}),
                   }}
        venues.append(feature)
        references.append({**reference, 'properties': {**reference['properties'], 'review_for': entry['venueId']}})
        report = {**entry, 'featureId': feature['id'], 'coordinates': point,
                  'referenceGeometry': geometry, 'transform': model,
                  'controlRmsMetres': math.sqrt(sum(e * e for e in errors) / len(errors)),
                  'controlMaxMetres': max(errors), 'leaveOneOutMaxMetres': max(held_out_errors),
                  'controlErrorsMetres': errors}
        reports.append(report)
        print(f"{entry['venueId']}: {point}; fit RMS {report['controlRmsMetres']:.3f}m; "
              f"max held-out control {max(held_out_errors):.3f}m (not field accuracy)")
    for filename, value in [
        ('food-venues.geojson', {'type': 'FeatureCollection', 'features': venues}),
        ('venue-references.geojson', {'type': 'FeatureCollection', 'features': references}),
        ('venue-alignment-report.json', {'version': config['version'], 'method': config['method'],
                                         'warning': config['reviewWarning'], 'venues': reports}),
    ]:
        (OUTPUT / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
