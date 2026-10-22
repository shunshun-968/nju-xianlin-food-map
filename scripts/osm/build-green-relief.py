"""Render a restrained elevation ramp and soft hillshade for five campus greens.

This is a DEM-derived cartographic raster, not a texture painted onto invented terrain.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.cache/osm-build'))
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates, distance_transform_edt
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union
from shapely import contains_xy

OUT=ROOT/'public/osm'
STEP=4
RAMP=['#b4c69c','#c6d3aa','#dbe0b7']


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def path(geometry):
    if geometry.geom_type=='Polygon':
        return ''.join(''.join(('M' if i==0 else 'L')+f'{x:.3f} {y:.3f}' for i,(x,y) in enumerate(r.coords))+'Z' for r in [geometry.exterior,*geometry.interiors])
    return ''.join(path(g) for g in geometry.geoms) if hasattr(geometry,'geoms') else ''


def main():
    scene=read(OUT/'campus-render.json')
    p=scene['projection']; lon0,lat0=p['origin']
    mx,my=p['metresPerLongitudeDegree'],p['metresPerLatitudeDegree']
    def project(lon,lat,z=None):return (lon-lon0)*mx,(lat0-lat)*my
    def inverse(x,y,z=None):return lon0+x/mx,lat0-y/my
    targets=read(OUT/'campus-contours-report.json')['greenOsmIds']
    by_id={f['id']:f for f in read(OUT/'campus-map.geojson')['features']}
    campus=transform(project,shape(read(OUT/'campus-retention.geojson')['features'][0]['geometry']))
    green=unary_union([transform(project,shape(by_id[gid]['geometry'])) for gid in targets]).intersection(campus)
    exclusions=[transform(project,shape(by_id[f['id']]['geometry'])) for f in scene['features'] if f['kind'] in ['building','water'] or f.get('sport')]
    mask=green.difference(unary_union(exclusions))
    # Roads are painted above the raster; the same slope continues beneath crossings.
    assert not mask.is_empty and mask.is_valid
    west,north,east,south=mask.buffer(20).bounds
    west,north=math.floor(west/STEP)*STEP,math.floor(north/STEP)*STEP
    width,height=math.ceil((east-west)/STEP),math.ceil((south-north)/STEP)
    xs=west+(np.arange(width)+.5)*STEP; ys=north+(np.arange(height)+.5)*STEP
    xx,yy=np.meshgrid(xs,ys)
    source=read(ROOT/'data/dem/raw/source.json')
    raw=ROOT/'data/dem/raw'/source['file']
    assert hashlib.sha256(raw.read_bytes()).hexdigest()==source['sha256']
    rgb=np.asarray(Image.open(raw).convert('RGB'),dtype=float)
    elevation=rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768
    assert np.isfinite(elevation).all() and np.all(elevation>-32768)
    elevation=gaussian_filter(elevation,sigma=.8,mode='nearest')
    lon,lat=inverse(xx,yy); n=2**source['zoom']
    columns=((lon+180)/360*n-source['x'])*256-.5
    rows=((1-np.arcsinh(np.tan(np.radians(lat)))/math.pi)/2*n-source['y'])*256-.5
    assert min(columns.min(),rows.min())>=3 and max(columns.max(),rows.max())<=252
    grid=map_coordinates(elevation,[rows,columns],order=1,mode='nearest')
    # A gentle 8 m display smoothing removes bilinear derivative seams in lighting.
    grid=gaussian_filter(grid,sigma=2,mode='nearest')
    inside=contains_xy(mask,xx,yy)
    low,high=float(grid[inside].min()),float(grid[inside].max())
    # One shared scale for all five greens, never normalise each patch separately.
    minimum,maximum=5,85
    t=np.clip((grid-minimum)/(maximum-minimum),0,1)
    colors=np.array([[int(color[i:i+2],16) for i in (1,3,5)] for color in RAMP],dtype=float)
    paint=np.stack([np.interp(t,[0,.5,1],colors[:,channel]) for channel in range(3)],axis=-1)
    # Local Y points south: negative X/Y places the light in the northwest.
    dy,dx=np.gradient(grid,STEP,STEP)
    exaggeration=1.4
    nx,ny=-dx*exaggeration,-dy*exaggeration
    norm=np.sqrt(nx*nx+ny*ny+1)
    illumination=(nx*(-.5)+ny*(-.5)+math.sqrt(.5))/norm
    brightness=np.clip(1+.45*(illumination-math.sqrt(.5)),.90,1.08)
    paint=np.clip(paint*brightness[:,:,None],0,255)
    # Only the perimeter softens into the original ground color; no rectangular edge.
    distance=distance_transform_edt(inside)*STEP
    fade=np.clip(distance/12,0,1)
    alpha=(fade*fade*(3-2*fade)*inside*255).round().astype(np.uint8)
    pixels=np.dstack([paint.round().astype(np.uint8),alpha])
    image_name='campus-green-relief.png'
    Image.fromarray(pixels).save(OUT/image_name,optimize=True)
    report={'version':1,'image':image_name,'bounds':[west,north,west+width*STEP,north+height*STEP],
            'pixelSizeMetres':STEP,'width':width,'height':height,'greenOsmIds':targets,
            'elevationRangeMetres':[round(low,2),round(high,2)],'rampRangeMetres':[minimum,maximum],
            'ramp':RAMP,'lightAzimuthDegrees':315,'lightAltitudeDegrees':45,
            'verticalExaggeration':exaggeration,'shadeStrength':.45,'edgeFadeMetres':12,
            'sourceGaussianSigmaPixels':.8,'displayGaussianSigmaMetres':8,
            'sourceSha256':source['sha256'],'sourceUrl':source['url'],
            'source':'Mapzen / Tilezen; USGS SRTM / GMTED',
            'imageSha256':hashlib.sha256((OUT/image_name).read_bytes()).hexdigest(),
            'inputHashes':{name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in
                           ['campus-render.json','campus-map.geojson','campus-retention.geojson']}}
    (OUT/'campus-green-relief.json').write_text(json.dumps({**report,'maskPath':path(mask)},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    (OUT/'campus-green-relief-mask.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[
        {'type':'Feature','properties':{'role':'five-green-relief'},'geometry':mapping(transform(inverse,mask))}]},separators=(',',':'))+'\n',encoding='utf-8')
    (OUT/'campus-green-relief-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
