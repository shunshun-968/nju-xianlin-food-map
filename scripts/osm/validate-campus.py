"""Read-only checks for the generated campus clipping and approved venue snapshot.

Run after `npm run osm:build-campus`. Requires the same Shapely dependency as the
builder, but deliberately does not import or execute the builder.
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.cache/osm-build'))

from shapely.geometry import LineString, Point, shape, box
from shapely.ops import nearest_points, transform

OUTPUT = ROOT / 'public/osm'
RAW = ROOT / 'data/osm/raw/road-bounded-campus'
METRES_PER_DEGREE = math.pi * 6371008.8 / 180
LONGITUDE_SCALE = METRES_PER_DEGREE * math.cos(math.radians(32.12))
DISTANCE_TOLERANCE_M = 0.01
AREA_TOLERANCE_M2 = 0.0001


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def project(x, y, z=None):
    return ((x - 118.9442) * LONGITUDE_SCALE,
            (32.1325 - y) * METRES_PER_DEGREE)


def southern_road():
    """Reconstruct the southern edge independently from archived OSM nodes."""
    elements = {}
    for source in read(RAW / 'sources.json'):
        for element in read(RAW / source['file'])['elements']:
            key = (element['type'], element['id'])
            previous = elements.get(key)
            if previous is None or element.get('version', 0) >= previous.get('version', 0):
                elements[key] = element

    def way_coordinates(way_id):
        way = elements['way', way_id]
        return [[elements['node', node_id]['lon'], elements['node', node_id]['lat']]
                for node_id in way['nodes']]

    east_section = way_coordinates(187480895)
    southeast_junction = [118.9611835, 32.1130469]
    east_section = east_section[east_section.index(southeast_junction):]
    west_section = way_coordinates(964850671)
    require(east_section[-1] == west_section[0], 'Southern road sections do not join')
    require(west_section[-1] == [118.9504956, 32.1108737], 'Unexpected southwest junction')
    return transform(project, LineString(east_section + west_section[1:]))


def boundary_samples(geometry, spacing=5):
    """Include every vertex and dense samples, avoiding missed small protrusions."""
    polygons = [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)
    for polygon in polygons:
        require(polygon.geom_type == 'Polygon', 'Buffer must contain only polygons')
        yield polygon.representative_point()
        for ring in [polygon.exterior, *polygon.interiors]:
            for coordinate in ring.coords:
                yield Point(coordinate)
            count = max(1, math.ceil(ring.length / spacing))
            for i in range(count + 1):
                yield ring.interpolate(i / count, normalized=True)


def main():
    retention = {feature['id']: feature for feature in read(OUTPUT / 'campus-retention.geojson')['features']}
    campus = transform(project, shape(retention['campus-four-roads']['geometry']))
    buffer = transform(project, shape(retention['south-buffer-100m']['geometry']))
    require(not campus.is_empty and campus.is_valid, 'Campus polygon is empty or invalid')
    require(not buffer.is_empty and buffer.is_valid, 'Southern 100 m buffer is empty or invalid')
    require(buffer.area > 0, 'Southern buffer has zero area')
    require(buffer.intersection(campus).area <= AREA_TOLERANCE_M2,
            'Southern buffer overlaps the campus interior')

    south = southern_road()
    require(buffer.area > south.length * 80, 'Southern buffer is incomplete or points into the campus')
    allowed_distance = south.buffer(100 + DISTANCE_TOLERANCE_M, quad_segs=64)
    require(buffer.difference(allowed_distance).area <= AREA_TOLERANCE_M2,
            'Southern buffer extends farther than 100 m from the southern road')
    max_distance = 0
    for point in boundary_samples(buffer):
        nearest = nearest_points(south, point)[0]
        # Local Y increases geographically southwards.
        require(point.y >= nearest.y - DISTANCE_TOLERANCE_M,
                'Southern buffer contains a point north of its nearest southern road position')
        max_distance = max(max_distance, point.distance(south))
    require(max_distance <= 100 + DISTANCE_TOLERANCE_M,
            f'Southern buffer distance is {max_distance:.6f} m, exceeding tolerance')
    for fraction in [.05, .25, .5, .75, .95]:
        on_road = south.interpolate(fraction, normalized=True)
        require(buffer.buffer(DISTANCE_TOLERANCE_M).covers(Point(on_road.x, on_road.y + 50)),
                f'Southern 50 m sample missing at road fraction {fraction}')

    retained = campus.union(buffer)
    require(retained.is_valid, 'Combined retention geometry is invalid')
    relaxed = retained.buffer(DISTANCE_TOLERANCE_M)
    features = read(OUTPUT / 'campus-map.geojson')['features']
    core_features = read(OUTPUT / 'campus-core.geojson')['features']
    scene = read(OUTPUT / 'campus-render.json')
    coverage = box(*scene['coverageBounds'])
    require(coverage.covers(retained), 'Context coverage omits part of the campus/core')
    require(len({feature['id'] for feature in features}) == len(features), 'Duplicate context OSM IDs')
    require(len({feature['id'] for feature in core_features}) == len(core_features), 'Duplicate core OSM IDs')
    require(len({feature['id'] for feature in scene['features']}) == len(scene['features']), 'Duplicate rendered OSM IDs')
    outside_buildings = outside_roads = 0
    for feature in features:
        geometry = transform(project, shape(feature['geometry']))
        require(not geometry.is_empty and geometry.is_valid,
                f"Empty or invalid context geometry: {feature['id']}")
        require(coverage.buffer(DISTANCE_TOLERANCE_M).covers(geometry),
                f"Feature beyond archived context coverage: {feature['id']}")
        if not campus.covers(geometry.representative_point()):
            outside_buildings += bool(feature['properties'].get('building') or feature['properties'].get('building:part'))
            outside_roads += bool(feature['properties'].get('highway'))
    require(outside_buildings > 100 and outside_roads > 100, 'Context is missing outside buildings or roads')

    non_roads = 0
    for feature in core_features:
        geometry = transform(project, shape(feature['geometry']))
        require(not geometry.is_empty and geometry.is_valid,
                f"Empty or invalid clipped geometry: {feature['id']}")
        if not feature['properties'].get('highway'):
            non_roads += 1
            require(relaxed.covers(geometry), f"Non-road feature outside retention region: {feature['id']}")

    require(scene.get('contextPath'), 'Outside-campus styling path is missing')
    context = coverage.difference(campus)
    require(context.is_valid and context.intersection(campus).area < AREA_TOLERANCE_M2,
            'Outside-campus background overlaps the campus')
    by_id = {feature['id']: feature for feature in features}
    for feature in scene['features']:
        geometry = transform(project, shape(by_id[feature['id']]['geometry']))
        require(feature.get('inCampus') == campus.covers(geometry.representative_point()),
                f"Incorrect inCampus classification: {feature['id']}")

    # The root renderer centres on the original campus bounds and increases its
    # fit by one 1.2x wheel step. Check common full-window areas, including under UI overlays.
    left, top, right, bottom = scene['bounds']
    coverage_cases = []
    for width, height in [(1440,1000),(1967,1395),(1920,1080),(2560,1440),(390,844)]:
        for drawer in ([0,340] if width>700 else [0]):
            inset = drawer+28 if drawer else 20
            inset_top, screen_bottom = 100, height-45
            scale = min((width-inset-30)/(right-left+90),
                        (screen_bottom-inset_top)/(bottom-top+90))*1.2
            x = inset+(width-inset)/2-(left+right)/2*scale
            y = inset_top+(screen_bottom-inset_top)/2-(top+bottom)/2*scale
            viewport = box(-x/scale,-y/scale,(width-x)/scale,(height-y)/scale)
            require(coverage.covers(viewport), f'Context omits initial viewport {width}x{height}, drawer={drawer}')
            coverage_cases.append(f'{width}x{height}/drawer={drawer}')
    expected = {'v-456', 'v-891', 'v-10', 'v-1112', 'v-hut', 'v-south', 'v-yifu'}
    venues = scene['venues']
    require(len(venues) == 7 and {venue['id'] for venue in venues} == expected,
            'Expected exactly seven distinct food venue IDs')
    approved = {feature['properties']['venue_id']: feature
                for feature in read(OUTPUT / 'food-venues.geojson')['features']}
    for venue in venues:
        require(relaxed.covers(Point(venue['point'])), f"Venue outside retention region: {venue['id']}")
        if venue['id'] in approved:
            original = approved[venue['id']]
            coordinates = original['geometry']['coordinates']
            require(venue.get('sourceCoordinates') == coordinates,
                    f"Approved source coordinates changed: {venue['id']}")
            require(Point(venue['point']).distance(Point(project(*coordinates))) < 0.00001,
                    f"Approved point projection changed: {venue['id']}")
            require(original['properties']['review_status'] == 'approved', 'Unapproved supplemental venue')
            if venue['id'] == 'v-yifu':
                require(venue['indoor'] is True, 'Yifu takeaway must remain explicitly indoors')

    report = read(OUTPUT / 'campus-build-report.json')
    require(report['retainedFeatures'] == len(features), 'Clipped feature count differs from build report')
    require(report['coreFeatures'] == len(core_features), 'Core feature count differs from build report')
    require(abs(report['southBufferM2'] - buffer.area) < AREA_TOLERANCE_M2,
            'Southern buffer area differs from build report')
    print(json.dumps({
        'status': 'valid', 'contextFeatures': len(features), 'coreFeatures': len(core_features), 'nonRoadCoreFeaturesChecked': non_roads,
        'outsideBuildings': outside_buildings, 'outsideRoads': outside_roads, 'initialViewportCoverageChecks': coverage_cases,
        'southBufferAreaM2': round(buffer.area, 3), 'maximumBufferDistanceM': round(max_distance, 6),
        'southernSamplePointsChecked': 5, 'venuesChecked': len(venues),
        'approvedCoordinatesUnchanged': True, 'yifuIndoors': True,
    }, indent=2))


if __name__ == '__main__':
    main()
