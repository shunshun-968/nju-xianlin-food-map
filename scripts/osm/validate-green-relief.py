"""Validate georeferencing and isolation of the five-green relief raster."""
import hashlib
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.cache/osm-build'))
import numpy as np
from PIL import Image
from shapely.geometry import shape, box
from shapely.ops import transform, unary_union
from shapely import contains_xy


def main():
    out=ROOT/'public/osm'
    def read(name):return json.loads((out/name).read_text(encoding='utf-8'))
    report=read('campus-green-relief-report.json')
    scene=read('campus-render.json'); p=scene['projection']
    def project(x,y,z=None):return ((x-p['origin'][0])*p['metresPerLongitudeDegree'],(p['origin'][1]-y)*p['metresPerLatitudeDegree'])
    for name,expected in report['inputHashes'].items():
        assert hashlib.sha256((out/name).read_bytes()).hexdigest()==expected, f'Changed input: {name}'
    source=json.loads((ROOT/'data/dem/raw/source.json').read_text(encoding='utf-8'))
    assert hashlib.sha256((ROOT/'data/dem/raw'/source['file']).read_bytes()).hexdigest()==report['sourceSha256']==source['sha256']
    assert hashlib.sha256((out/report['image']).read_bytes()).hexdigest()==report['imageSha256']
    ids=report['greenOsmIds']
    assert len(ids)==5 and ids==read('campus-contours-report.json')['greenOsmIds']
    by_id={f['id']:f for f in read('campus-map.geojson')['features']}
    greens=[transform(project,shape(by_id[gid]['geometry'])) for gid in ids]
    campus=transform(project,shape(read('campus-retention.geojson')['features'][0]['geometry']))
    mask=transform(project,shape(read('campus-green-relief-mask.geojson')['features'][0]['geometry']))
    assert mask.is_valid and not mask.is_empty
    assert campus.buffer(.001).covers(mask) and unary_union(greens).buffer(.001).covers(mask)
    for feature in scene['features']:
        if feature['kind'] in ['building','water'] or feature.get('sport'):
            geometry=transform(project,shape(by_id[feature['id']]['geometry']))
            assert mask.intersection(geometry).area<.001, f'Relief overlaps {feature["id"]}'
    pixels=np.asarray(Image.open(out/report['image']))
    assert pixels.shape==(report['height'],report['width'],4)
    left,top,right,bottom=report['bounds']; step=report['pixelSizeMetres']
    assert right-left==pixels.shape[1]*step and bottom-top==pixels.shape[0]*step
    assert box(left,top,right,bottom).covers(mask)
    xx,yy=np.meshgrid(left+(np.arange(pixels.shape[1])+.5)*step,top+(np.arange(pixels.shape[0])+.5)*step)
    alpha=pixels[:,:,3]
    assert not np.any((alpha>0)&~contains_xy(mask.buffer(.001),xx,yy)), 'Opaque pixels outside the green mask'
    counts={gid:int(np.count_nonzero((alpha>0)&contains_xy(g,xx,yy))) for gid,g in zip(ids,greens)}
    assert all(counts.values()), 'One of five greens has no elevation color'
    render=read('campus-green-relief.json')
    assert render['maskPath'] and render['bounds']==report['bounds']
    print(json.dumps({'status':'valid','greenAreas':len(ids),'pixelsByGreen':counts,
                      'noOutsidePixels':True,'buildingsWaterSportsUnchanged':True,
                      'sourceAndMapHashesVerified':True,'imageBytes':(out/report['image']).stat().st_size},indent=2))


if __name__=='__main__':main()
