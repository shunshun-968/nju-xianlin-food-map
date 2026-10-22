"""Independent checks for fixed woodland texture positions and clearance."""
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.cache/osm-build'))
from shapely.geometry import shape, Point
from shapely.ops import transform, unary_union


def main():
    out=ROOT/'public/osm'
    def read(name):return json.loads((out/name).read_text(encoding='utf-8'))
    data=read('campus-forest-texture.json'); scene=read('campus-render.json'); p=scene['projection']
    def project(x,y,z=None):return (x-p['origin'][0])*p['metresPerLongitudeDegree'],(p['origin'][1]-y)*p['metresPerLatitudeDegree']
    for name,expected in data['inputHashes'].items():
        assert hashlib.sha256((out/name).read_bytes()).hexdigest()==expected, f'Stale texture input: {name}'
    source={f['id']:f for f in read('campus-map.geojson')['features']}
    geometry={gid:transform(project,shape(f['geometry'])) for gid,f in source.items()}
    campus=transform(project,shape(read('campus-retention.geojson')['features'][0]['geometry']))
    mask=transform(project,shape(read('campus-forest-mask.geojson')['features'][0]['geometry']))
    assert mask.is_valid and campus.buffer(.001).covers(mask)
    woods=[]
    for gid in data['forestIds']:
        tags=source[gid]['properties']
        assert tags.get('natural')=='wood' or tags.get('landuse')=='forest', f'Unconfirmed woodland: {gid}'
        woods.append(geometry[gid])
    assert unary_union(woods).buffer(.001).covers(mask)
    obstacles=[]
    for f in scene['features']:
        g=geometry[f['id']]
        if not g.intersects(campus):continue
        if f['kind']=='road':obstacles.append(g.buffer(f.get('width',6)/2+6.9))
        elif f['kind'] in ['building','water'] or f.get('sport'):obstacles.append(g.buffer(8.9))
    obstacles=unary_union(obstacles)
    assert mask.intersection(obstacles).area<.001
    crowns=data['crowns']; ids=set(); counts={}; tiers=set()
    for i,c in enumerate(crowns):
        assert c['id'] not in ids; ids.add(c['id'])
        assert all(math.isfinite(c[k]) for k in ['x','y','radius','rotation'])
        assert 3.8<=c['radius']<=6.2 and c['variant'] in [0,1,2] and c['tier'] in [0,1]
        envelope=Point(c['x'],c['y']).buffer(c['radius']+.49)
        assert mask.buffer(.001).covers(envelope)
        assert geometry[c['forestId']].buffer(.001).covers(envelope)
        assert not envelope.intersects(obstacles)
        assert all(math.hypot(c['x']-other['x'],c['y']-other['y'])>=21.99 for other in crowns[:i])
        counts[c['forestId']]=counts.get(c['forestId'],0)+1; tiers.add(c['tier'])
    assert counts==data['countsByForest'] and tiers=={0,1}
    print(json.dumps({'status':'valid','woodlandAreas':len(woods),'crowns':len(crowns),
                      'onlyConfirmedCampusWoods':True,'roadBuildingWaterClearanceVerified':True,
                      'minimumSpacingMetres':22,'inputHashesVerified':True},indent=2))


if __name__=='__main__':main()
