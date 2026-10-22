"""Sparse fixed canopy texture inside OSM-confirmed campus woods only."""
import hashlib
import json
import math
import random
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.cache/osm-build'))
from shapely.geometry import shape, Point, mapping
from shapely.ops import transform, unary_union
from shapely.prepared import prep

OUT=ROOT/'public/osm'
SEED=20261022


def read(name):return json.loads((OUT/name).read_text(encoding='utf-8'))


def svg_path(g):
    if g.geom_type=='Polygon':
        return ''.join(''.join(('M' if i==0 else 'L')+f'{x:.3f} {y:.3f}' for i,(x,y) in enumerate(r.coords))+'Z' for r in [g.exterior,*g.interiors])
    return ''.join(svg_path(p) for p in g.geoms) if hasattr(g,'geoms') else ''


def main():
    scene=read('campus-render.json'); p=scene['projection']
    def project(x,y,z=None):return (x-p['origin'][0])*p['metresPerLongitudeDegree'],(p['origin'][1]-y)*p['metresPerLatitudeDegree']
    geometries={f['id']:transform(project,shape(f['geometry'])) for f in read('campus-map.geojson')['features']}
    campus=transform(project,shape(read('campus-retention.geojson')['features'][0]['geometry']))
    blocks=[]
    for f in scene['features']:
        g=geometries[f['id']]
        if not g.intersects(campus):continue
        if f['kind'] in ['building','water'] or f.get('sport'):blocks.append(g.buffer(9))
        elif f['kind']=='road':blocks.append(g.buffer(f.get('width',6)/2+7))
    blocks.extend([Point(scene['observatory']).buffer(35),*[Point(v['point']).buffer(38) for v in scene['venues']]])
    exclusion=unary_union(blocks)
    crowns=[]; regions=[]; area_ids=[]; counts={}; grid={}
    for f in scene['features']:
        # No inference of a forest from a generic park, grass, scrub or green color.
        if f['kind']!='land' or f.get('subtype') not in ['wood','forest']:continue
        forest=geometries[f['id']].intersection(campus)
        if forest.area<10000:continue
        area=forest.buffer(-4).difference(exclusion)
        if area.is_empty:continue
        regions.append(area); area_ids.append(f['id']); counts[f['id']]=0
        prepared=prep(area)
        rng=random.Random(SEED+int(hashlib.sha256(f['id'].encode()).hexdigest()[:8],16))
        left,top,right,bottom=area.bounds
        target=round(area.area/2000)
        for _ in range(target*50):
            if counts[f['id']]>=target:break
            x,y=round(rng.uniform(left,right),2),round(rng.uniform(top,bottom),2)
            radius=round(rng.uniform(3.8,6.2),2)
            # A soft density field leaves natural gaps without tiled rows.
            if rng.random()>.44+.4*math.sin(x/97+.65*math.sin(y/113))*math.cos(y/89):continue
            if not prepared.covers(Point(x,y).buffer(radius+.5)):continue
            cell=(math.floor(x/24),math.floor(y/24))
            nearby=[c for i in range(cell[0]-1,cell[0]+2) for j in range(cell[1]-1,cell[1]+2) for c in grid.get((i,j),[])]
            if any(math.hypot(x-c['x'],y-c['y'])<22 for c in nearby):continue
            crown={'id':f'{f["id"]}-{counts[f["id"]]}','forestId':f['id'],'x':x,'y':y,
                   'radius':radius,'rotation':rng.randrange(360),'variant':rng.randrange(3),
                   'tier':0 if rng.random()<.55 else 1}
            crowns.append(crown); grid.setdefault(cell,[]).append(crown); counts[f['id']]+=1
    mask=unary_union(regions)
    result={'version':1,'seed':SEED,'forestIds':area_ids,'countsByForest':counts,
            'description':'Decorative top-down canopy texture within mapped woodland, not surveyed individual trees',
            'maskPath':svg_path(mask),'crowns':crowns,
            'inputHashes':{name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in ['campus-render.json','campus-map.geojson','campus-retention.geojson']}}
    (OUT/'campus-forest-texture.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    (OUT/'campus-forest-mask.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'role':'woodland-texture'},'geometry':mapping(transform(lambda x,y,z=None:(p['origin'][0]+x/p['metresPerLongitudeDegree'],p['origin'][1]-y/p['metresPerLatitudeDegree']),mask))}]},separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'forests':area_ids,'counts':counts,'crowns':len(crowns)},indent=2))


if __name__=='__main__':main()
