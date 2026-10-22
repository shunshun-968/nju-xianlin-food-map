"""Build a metric, clipped render snapshot. Requires shapely from requirements-basemap.txt."""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.cache/osm-build'))
from shapely.geometry import shape, mapping, Polygon, LineString, Point, box
from shapely.ops import transform, polylabel
from shapely import make_valid

OUT = ROOT / 'public/osm'
M = math.pi * 6371008.8 / 180
LON = M * math.cos(math.radians(32.12))
def project(x, y, z=None): return ((x - 118.9442) * LON, (32.1325 - y) * M)
def inverse(x, y, z=None): return (118.9442 + x / LON, 32.1325 - y / M)
def read(path): return json.loads(path.read_text(encoding='utf-8'))
source = read(ROOT / '.cache/campus-source.geojson')
by_id = {f['id']: f for f in source['features']}

def segment(osm_id, start, end):
    points = by_id[osm_id]['geometry']['coordinates']
    a, b = points.index(start), points.index(end)
    return points[a:b + 1] if a <= b else list(reversed(points[b:a + 1]))

# Explicit shared OSM junctions; campus-facing carriageway centre lines for divided roads.
sw, nw, ne, se = [118.9504956, 32.1108737], [118.9461348, 32.128642], [118.9589676, 32.1312984], [118.9611835, 32.1130469]
west = segment('way/947821616', sw, nw)
north = segment('way/583452478', nw, ne)
east = segment('way/89911078', ne, se)
south = segment('way/187480895', se, [118.9566981, 32.1116004]) + segment('way/964850671', [118.9566981, 32.1116004], sw)[1:]
campus = transform(project, Polygon(west + north[1:] + east[1:] + south[1:]))
assert campus.is_valid and campus.area > 2000000
south_line = transform(project, LineString(south))
# Shapely uses Cartesian orientation even though local Y increases southwards.
# For this east-to-west line, its negative/right side is geographically south.
south_buffer = south_line.buffer(-100, single_sided=True, cap_style=2, join_style=1).difference(campus)
assert not south_buffer.is_empty and south_buffer.area > south_line.length * 80
midpoint = south_line.interpolate(.5, normalized=True)
assert south_buffer.covers(Point(midpoint.x, midpoint.y + 50)), 'Southern buffer points north'
retained = make_valid(campus.union(south_buffer))
coverage = read(ROOT / 'data/osm/raw/campus-context/coverage.json')
query = transform(project, box(*coverage['bbox']))
boundary_corridors = {name: transform(project, LineString(points)).buffer(45, cap_style=2, join_style=1)
                      for name, points in [('九乡河东路', west), ('纬地路', north), ('元化路', east), ('仙林大道', south)]}

def path(geom):
    def line(coords, closed=False):
        return ''.join(('M' if i == 0 else 'L') + f'{x:.2f} {y:.2f}' for i, (x,y) in enumerate(coords)) + ('Z' if closed else '')
    if geom.geom_type == 'Polygon': return line(geom.exterior.coords, True) + ''.join(line(r.coords, True) for r in geom.interiors)
    if geom.geom_type == 'LineString': return line(geom.coords)
    if hasattr(geom, 'geoms'): return ''.join(path(g) for g in geom.geoms)
    return ''

def frame(geom):
    r = list(geom.minimum_rotated_rectangle.exterior.coords)[:4]
    a,b = max(zip(r, r[1:] + r[:1]), key=lambda pair: math.dist(*pair))
    vx,vy = b[0]-a[0],b[1]-a[1]
    length = math.hypot(vx,vy); vx,vy=vx/length,vy/length
    if vy < 0: vx,vy=-vx,-vy
    ux,uy=vy,-vx
    xs=[x*ux+y*uy for x,y in r]; ys=[x*vx+y*vy for x,y in r]
    return {'matrix':[ux,uy,vx,vy,ux*min(xs)+vx*min(ys),uy*min(xs)+vy*min(ys)], 'width':max(xs)-min(xs), 'height':max(ys)-min(ys)}

def largest_polygon(geom):
    if geom.geom_type=='Polygon': return geom
    if geom.geom_type=='MultiPolygon': return max(geom.geoms,key=lambda g:g.area)
    return None

venue_defs = [
    ('v-456','四五六食堂','way/99814434','#e4d2a4'),
    ('v-891','民族食堂、第八、九食堂','way/99814405','#e1c8cf'),
    ('v-10','第十食堂','way/188130723','#d6cee4'),
    ('v-1112','第十一、十二食堂','way/350505117','#c9dcd1'),
]
venues=[]
for venue_id,name,osm_id,color in venue_defs:
    g=transform(project,shape(by_id[osm_id]['geometry'])); f=frame(g)
    c=g.centroid
    # Illustrative cuboid footprint derives from this mapped building, not list ordering.
    venues.append({'id':venue_id,'name':name,'osmId':osm_id,'point':[c.x,c.y],
                   'width':f['width']*.84,'depth':f['height']*.84,'angle':math.degrees(math.atan2(f['matrix'][1],f['matrix'][0])),
                   'height':4,'color':color,'indoor':False})
approved=read(OUT/'food-venues.geojson')
for f in approved['features']:
    p=f['properties']; xy=project(*f['geometry']['coordinates'])
    assert p['review_status']=='approved' and retained.covers(Point(xy))
    venues.append({'id':p['venue_id'],'name':p['name'],'point':xy,'width':11 if p['venue_id']=='v-hut' else 9,
                   'depth':7 if p['venue_id']=='v-hut' else 5,'angle':-10,'height':2.3,
                   'color':{'v-yifu':'#c5dbe3','v-hut':'#e7d1b8','v-south':'#decedb'}[p['venue_id']],
                   'indoor':p.get('indoor',False),'sourceCoordinates':f['geometry']['coordinates']})

render=[]; clipped=[]; core=[]; excluded=0
for feature in source['features']:
    p=feature['properties']; gid=feature['id']; kind=None
    if p.get('highway'): kind='road'
    elif p.get('building') or p.get('building:part'): kind='building'
    elif p.get('waterway') or p.get('water') or p.get('natural')=='water' or p.get('landuse')=='reservoir': kind='water'
    elif p.get('landuse') or p.get('leisure') or p.get('natural'): kind='land'
    # Other POIs still enter the clipped GeoJSON, but are not drawn as cluttering dots.
    if gid=='way/89910837': continue
    original=transform(project,shape(feature['geometry']))
    if not original.is_valid: original=make_valid(original)
    g=original.intersection(query)
    if g.is_empty: excluded+=1;continue
    if g.geom_type=='GeometryCollection':
        compatible=[part for part in g.geoms if part.geom_type in ['Polygon','MultiPolygon','LineString','MultiLineString','Point']]
        if not compatible: continue
        from shapely.ops import unary_union
        g=unary_union(compatible)
    clipped.append({**feature,'geometry':mapping(transform(inverse,g))})
    core_geometry = g if kind == 'road' else g.intersection(retained)
    if not core_geometry.is_empty:
        core.append({**feature,'geometry':mapping(transform(inverse,core_geometry))})
    if kind is None or g.geom_type in ['Point','MultiPoint','GeometryCollection']: continue
    item={'id':gid,'kind':kind,'name':p.get('name:zh',p.get('name','')),'path':path(g),'area':g.area,
          'bounds':list(g.bounds),'centre':[g.centroid.x,g.centroid.y],
          'inCampus':campus.covers(g.representative_point())}
    if kind=='road':
        foot=p['highway'] in ['footway','path','steps','pedestrian','cycleway','bridleway']
        default={'motorway':11,'primary':12,'secondary':10,'tertiary':10,'residential':8,'service':6,'unclassified':7}.get(p['highway'],4)
        try: width=float(str(p.get('width',default)).split()[0])
        except ValueError: width=default
        item.update({'width':1.8 if foot else max(4,min(20,width)),'footway':foot,
                     'lines':[list(line.coords) for line in (g.geoms if g.geom_type=='MultiLineString' else [g])] if g.geom_type in ['LineString','MultiLineString'] else []})
        # Emphasize only the enclosing portion, including its parallel carriageway.
        # Flat caps at road junctions exclude continuation tails of the same named road.
        if item['name'] in boundary_corridors:
            highlighted = g.intersection(boundary_corridors[item['name']])
            if not highlighted.is_empty:
                item['boundaryPath'] = path(highlighted)
    else:
        item['subtype']=p.get('natural',p.get('landuse',p.get('leisure','')))
        polygon=largest_polygon(g)
        if polygon:
            centre=polylabel(polygon,tolerance=.4) if kind=='building' and item['name'] else polygon.representative_point()
            item['labelPoint']=[centre.x,centre.y]
            item['labelRadius']=centre.distance(polygon.boundary)
            if p.get('sport') and not p.get('building') and '室内' not in item['name']:
                item['sport']=p['sport']; item['frame']=frame(polygon)
    render.append(item)

observatory=transform(project,shape(by_id['way/188142630']['geometry'])).centroid
data={'version':1,'projection':{'origin':[118.9442,32.1325],'metresPerLongitudeDegree':LON,'metresPerLatitudeDegree':M},
      'bounds':list(retained.bounds),'coverageBounds':list(query.bounds),
      'campusPath':path(campus),'retainedPath':path(retained),'contextPath':path(query.difference(campus)),
      'southBufferMetres':100,'features':render,'venues':venues,'observatory':[observatory.x,observatory.y],
      'source':'© OpenStreetMap contributors','license':'ODbL-1.0'}
for name,value in [('campus-render.json',data),('campus-map.geojson',{'type':'FeatureCollection','features':clipped}),
                   ('campus-core.geojson',{'type':'FeatureCollection','features':core}),
                   ('campus-retention.geojson',{'type':'FeatureCollection','features':[
                       {'type':'Feature','id':'campus-four-roads','properties':{'role':'campus'},'geometry':mapping(transform(inverse,campus))},
                       {'type':'Feature','id':'south-buffer-100m','properties':{'role':'south-buffer','distance_m':100},'geometry':mapping(transform(inverse,south_buffer))}]}),
                   ('campus-build-report.json',{'retainedFeatures':len(clipped),'coreFeatures':len(core),'excludedFeatures':excluded,'renderFeatures':len(render),
                      'contextBuildingFeatures':sum(f['kind']=='building' and not f['inCampus'] for f in render),
                      'contextRoadFeatures':sum(f['kind']=='road' and not f['inCampus'] for f in render),
                      'coverageBbox':coverage['bbox'],'coverageBounds':list(query.bounds),
                      'campusAreaM2':campus.area,'southBufferM2':south_buffer.area,'boundaryRoadWays':['way/947821616','way/583452478','way/89911078','way/187480895','way/964850671'],
                      'foodGeometryUnchanged':True,'sources':[{**s,'directory':directory} for directory in ['road-bounded-campus','campus-context']
                           for s in read(ROOT/f'data/osm/raw/{directory}/sources.json')]})]:
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(f'Campus area {campus.area:.0f} m2; retained {len(clipped)}, excluded {excluded}; rendered {len(render)}; venues {len(venues)}')
