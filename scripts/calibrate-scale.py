"""Fit the drawing's metric from OSM building bounding-box centers.

Run with an official OSM /api/0.6/map XML extract. No network access at runtime.
An affine fit allows different horizontal/vertical scale in the illustrated plan.
It does not change the relative-coordinate drawing or create GPS navigation.
"""
import json, math, sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = ET.parse(sys.argv[1]).getroot()
nodes = {n.attrib['id']: (float(n.attrib['lon']),float(n.attrib['lat'])) for n in root.findall('node')}
ways = {w.attrib['id']:w for w in root.findall('way')}
controls = [('99814434','四五六食堂',[469,1464]),('99814405','民族食堂 八九食堂',[484,1081]),('188130723','第十食堂',[964,1212]),('448907847','天文与空间科学学院',[764.25,470.5]),('188142630','左涤江天文台',[811,716.5])]
points=[]
for way_id,name,plan in controls:
    coords=[nodes[n.attrib['ref']] for n in ways[way_id].findall('nd')]
    lon,lat=[(min(p[i] for p in coords)+max(p[i] for p in coords))/2 for i in (0,1)]
    points.append(dict(name=name,plan=plan,longitude=lon,latitude=lat,source=f'https://www.openstreetmap.org/way/{way_id}'))

# Local WGS84 tangent metric (east/north); error over this 2 km campus is tiny
# compared with the manually illustrated source's local distortions.
lon0=sum(p['longitude'] for p in points)/len(points)
lat0=sum(p['latitude'] for p in points)/len(points)
lat=math.radians(lat0); a=6378137; e2=6.69437999014e-3
n=a/math.sqrt(1-e2*math.sin(lat)**2)
m=a*(1-e2)/(1-e2*math.sin(lat)**2)**1.5
for p in points:
    p['east'] = math.radians(p['longitude']-lon0)*n*math.cos(lat)
    p['north'] = math.radians(p['latitude']-lat0)*m

def solve(matrix, vector):
    rows=[list(row)+[v] for row,v in zip(matrix,vector)]
    for i in range(3):
        pivot=max(range(i,3),key=lambda j:abs(rows[j][i]))
        rows[i],rows[pivot]=rows[pivot],rows[i]
        s=rows[i][i]; rows[i]=[v/s for v in rows[i]]
        for j in range(3):
            if i!=j:
                s=rows[j][i]; rows[j]=[v-s*w for v,w in zip(rows[j],rows[i])]
    return [r[-1] for r in rows]

x=[[p['plan'][0],p['plan'][1],1] for p in points]
normal=[[sum(r[i]*r[j] for r in x) for j in range(3)] for i in range(3)]
east=solve(normal,[sum(r[i]*p['east'] for r,p in zip(x,points)) for i in range(3)])
north=solve(normal,[sum(r[i]*p['north'] for r,p in zip(x,points)) for i in range(3)])
errors=[math.hypot(sum(a*b for a,b in zip(r,east))-p['east'],sum(a*b for a,b in zip(r,north))-p['north']) for r,p in zip(x,points)]
result=dict(source='© OpenStreetMap contributors',retrieved='2026-10-21',coordinateSystem='CAMPUS_PLAN_V2',
    method='WGS84 local tangent metric; least-squares affine fit to building bounding-box centers',
    controls=points,eastCoefficients=east,northCoefficients=north,
    horizontalMetersPerUnit=math.hypot(east[0],north[0]),verticalMetersPerUnit=math.hypot(east[1],north[1]),
    rmsResidualMeters=math.sqrt(sum(e*e for e in errors)/len(errors)),maxResidualMeters=max(errors))
Path('src/data/map-calibration.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:result[k] for k in ['horizontalMetersPerUnit','verticalMetersPerUnit','rmsResidualMeters','maxResidualMeters']}))
