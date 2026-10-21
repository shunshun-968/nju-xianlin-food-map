"""Trace color-coded plan geometry, not its text or decorative legend.

Input: a 1280 x 1920, 24-bit BMP normalized from the user's reference JPG.
Uses only Python standard library. Output paths stay in relative drawing units.
Run: python scripts/trace-campus.py <normalized.bmp> src/data/campus-layout.json
"""
import collections
import json
import math
import random
import struct
import sys

raw = open(sys.argv[1], 'rb').read()
offset = struct.unpack_from('<I', raw, 10)[0]
width, height = struct.unpack_from('<ii', raw, 18)
assert (width, height) == (1280, 1920)
assert struct.unpack_from('<H', raw, 28)[0] == 24
stride = (width * 3 + 3) // 4 * 4
mask = bytearray(width * height)
for y in range(165, 1683):
    row = offset + (height - 1 - y) * stride
    for x in range(44, 1236):
        b, g, r = raw[row + x * 3:row + x * 3 + 3]
        kind = 0
        if g > 65 and r < 65 and b < 115 and g > r * 1.35:
            kind = 1  # woodland
        elif 100 < r < 165 and 130 < g < 190 and b < 85:
            kind = 2  # lawn
        elif b > 145 and g > 130 and r < 155 and b > r + 25 and g > r + 20:
            kind = 3  # water
        elif 65 < r < 175 and max(r, g, b) - min(r, g, b) < 16:
            kind = 4  # streets
        elif b > 90 and r < 105 and g < 105 and b > r * 1.3 and b > g * 1.3:
            kind = 5  # academic buildings
        elif r > 170 and g < 100 and 50 < b < 155:
            kind = 6  # teaching buildings
        elif r > 195 and 50 < g < 200 and b < 85:
            kind = 7  # dorms and services
        elif 100 < r < 195 and 55 < g < 140 and b < 115 and r > g * 1.35:
            kind = 8  # administration
        elif 155 < r < 235 and 100 < g < 200 and 155 < b < 240 and r > g + 18 and b > g + 18:
            kind = 9  # sports
        mask[y * width + x] = kind

def area(points):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:]))) / 2

def simplify(points, epsilon=0.9):
    if len(points) < 3:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    length = math.hypot(bx - ax, by - ay)
    distances = [abs((bx-ax)*(ay-y)-(ax-x)*(by-ay))/length if length else math.hypot(x-ax,y-ay) for x,y in points[1:-1]]
    if not distances or max(distances) < epsilon:
        return [points[0], points[-1]]
    index = distances.index(max(distances)) + 1
    return simplify(points[:index+1],epsilon)[:-1] + simplify(points[index:],epsilon)

def architectural_outline(points):
    """Remove pixel steps, then fit long walls to the footprint's local axes.

    This is geometric cleanup, not a surveyed building model. Oblique wings keep
    their direction; we do not force every building into an axis-aligned box.
    """
    ring = simplify(points, 2.6)[:-1]
    if len(ring) < 3:
        return []
    pairs = list(zip(ring, ring[1:] + ring[:1]))
    # Fourfold orientation treats opposite and perpendicular walls consistently.
    real = imaginary = 0.0
    for (x1,y1),(x2,y2) in pairs:
        angle = math.atan2(y2-y1,x2-x1)
        weight = (x2-x1)**2+(y2-y1)**2
        real += weight*math.cos(4*angle)
        imaginary += weight*math.sin(4*angle)
    axis = math.atan2(imaginary,real)/4
    lines=[]
    for (x1,y1),(x2,y2) in pairs:
        angle=math.atan2(y2-y1,x2-x1)
        fitted=axis+round((angle-axis)/(math.pi/2))*(math.pi/2)
        if abs(angle-fitted)>math.radians(16): fitted=angle
        nx,ny=-math.sin(fitted),math.cos(fitted)
        lines.append((nx,ny,nx*(x1+x2)/2+ny*(y1+y2)/2))
    fitted_ring=[]
    for index,original in enumerate(ring):
        a,b,c=lines[index-1];d,e,f=lines[index]
        determinant=a*e-b*d
        if abs(determinant)<1e-5:
            fitted_ring.append(original);continue
        x,y=(c*e-b*f)/determinant,(a*f-c*d)/determinant
        fitted_ring.append((x,y) if math.hypot(x-original[0],y-original[1])<=4 else original)
    def intersects(ring):
        def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        edges=list(zip(ring,ring[1:]+ring[:1]))
        for i,(a,b) in enumerate(edges):
            for j,(c,d) in enumerate(edges):
                if j<=i+1 or (i==0 and j==len(edges)-1):continue
                if cross(a,b,c)*cross(a,b,d)<-1e-6 and cross(c,d,a)*cross(c,d,b)<-1e-6:return True
        return False
    # A narrow courtyard can fold over when neighboring wall axes are snapped.
    # Keep the simplified straight segments instead in that case.
    if intersects(fitted_ring):fitted_ring=ring
    if intersects(fitted_ring):fitted_ring=simplify(points,1.6)[:-1]
    # Keep offsets subpixel accurate; the SVG renderer handles antialiasing.
    return [(round(x,2),round(y,2)) for x,y in fitted_ring]+[tuple(round(v,2) for v in fitted_ring[0])]

seen = bytearray(len(mask))
features = []
for start in range(165 * width, 1683 * width):
    kind = mask[start]
    if not kind or seen[start]:
        continue
    seen[start] = 1
    queue = collections.deque([start])
    component = []
    while queue:
        pos = queue.popleft()
        component.append(pos)
        for nxt in (pos-1,pos+1,pos-width,pos+width):
            if 0 <= nxt < len(mask) and not seen[nxt] and mask[nxt] == kind:
                seen[nxt] = 1
                queue.append(nxt)
    if len(component) < (130 if kind == 4 else 70):
        continue
    xs = [pos % width for pos in component]
    ys = [pos // width for pos in component]
    bounds = [min(xs),min(ys),max(xs)-min(xs)+1,max(ys)-min(ys)+1]
    if min(bounds[2:]) < 7:
        continue
    edges = collections.defaultdict(list)
    for pos in component:
        x,y=pos%width,pos//width
        if mask[pos-width] != kind: edges[(x,y)].append((x+1,y))
        if mask[pos+1] != kind: edges[(x+1,y)].append((x+1,y+1))
        if mask[pos+width] != kind: edges[(x+1,y+1)].append((x,y+1))
        if mask[pos-1] != kind: edges[(x,y+1)].append((x,y))
    contours=[]
    while edges:
        first=next(iter(edges))
        points=[first]
        current=first
        while current in edges:
            nxt=edges[current].pop()
            if not edges[current]: del edges[current]
            points.append(nxt)
            current=nxt
            if current == first: break
        if len(points)>3 and area(points)> (28 if kind>=5 else 80):
            signed_area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]))/2
            # Small negative rings are mostly holes made by printed text, not courtyards.
            if 5<=kind<=8 and signed_area<0 and abs(signed_area)<120:
                continue
            points=architectural_outline(points) if 5<=kind<=8 else simplify(points)
            if len(points)>=4:
                contours.append('M'+'L'.join(f'{x},{y}' for x,y in points[:-1])+'Z')
    if contours:
        features.append({'id':f'plan-{kind}-{len(features)}','kind':kind,'bounds':bounds,'path':' '.join(contours)})

rng=random.Random(456891)
trees=[]
for _ in range(4800):
    x,y=rng.randrange(190,1080),rng.randrange(210,1620)
    if mask[y*width+x] in (1,2) and all(mask[(y+dy)*width+x+dx] in (1,2) for dx,dy in [(6,0),(-6,0),(0,6),(0,-6)]):
        if all((x-t[0])**2+(y-t[1])**2>200 for t in trees):trees.append([x,y,round(rng.uniform(0.7,1.25),2)])
result={'width':width,'height':height,'coordinateSystem':'CAMPUS_PLAN_V2','source':'仙林校区平面图.jpg','features':features,'trees':trees}
with open(sys.argv[2],'w',encoding='utf8') as handle:
    json.dump(result,handle,ensure_ascii=False,separators=(',',':'))
print('Traced relative plan features:',dict(collections.Counter(f['kind'] for f in features)))
