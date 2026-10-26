"""Extract original fascia artwork; usage: python scripts/build-tenth-signs.py PHOTO_DIR."""
from pathlib import Path
import sys
from PIL import Image

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'src/assets/tenth-canteen'
target.mkdir(parents=True, exist_ok=True)
quads = {
    4: [(0,278),(1824,354),(1824,607),(0,547)],
    5: [(220,408),(1648,438),(1648,664),(210,643)],
    6: [(197,281),(1676,311),(1676,551),(193,538)],
    7: [(123,398),(1482,408),(1482,627),(121,621)],
    8: [(174,331),(1654,356),(1654,591),(174,580)],
    9: [(61,121),(1803,166),(1804,480),(61,463)],
}
def project(number, quad, width):
    image = Image.open(source / f'{number}.jpg').convert('RGB')
    p = [(x/1824*image.width,y/1368*image.height) for x,y in quad]
    dx1,dx2 = p[1][0]-p[2][0],p[3][0]-p[2][0]
    dy1,dy2 = p[1][1]-p[2][1],p[3][1]-p[2][1]
    dx3,dy3 = p[0][0]-p[1][0]+p[2][0]-p[3][0],p[0][1]-p[1][1]+p[2][1]-p[3][1]
    det = dx1*dy2-dx2*dy1
    g,h = (dx3*dy2-dx2*dy3)/det,(dx1*dy3-dx3*dy1)/det
    a,b = p[1][0]-p[0][0]+g*p[1][0],p[3][0]-p[0][0]+h*p[3][0]
    d,e = p[1][1]-p[0][1]+g*p[1][1],p[3][1]-p[0][1]+h*p[3][1]
    return image.transform((width,384),Image.Transform.PERSPECTIVE,
        (a/width,b/384,p[0][0],d/width,e/384,p[0][1],g/width,h/384),Image.Resampling.BICUBIC)
def save(image, name):
    image = image.point([round(v if v<=236 else 236+(v-236)*.45) for v in range(256)]*3)
    image.save(target / f'{name}.webp',quality=92)
for number,quad in quads.items():
    save(project(number,quad,2048),number)
north = Image.new('RGB',(4096,384))
split = round(4096*.49)
north.paste(project(1,[(0,430),(1508,402),(1508,602),(0,612)],split),(0,0))
north.paste(project(2,[(0,82),(1824,350),(1824,517),(0,396)],4096-split),(split,0))
save(north,'north')
