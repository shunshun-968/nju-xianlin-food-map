"""Archive the public Terrarium DEM tile covering Xianlin campus; no API key."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/dem/raw'
OUT.mkdir(parents=True, exist_ok=True)
ZOOM, X, Y = 12, 3401, 1661
url = f'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{ZOOM}/{X}/{Y}.png'
request = Request(url, headers={'User-Agent': 'nju-xianlin-food-map/0.1 (campus terrain visualization)'})
with urlopen(request, timeout=45) as response:
    content = response.read()
    headers = dict(response.headers.items())
if not content.startswith(b'\x89PNG\r\n\x1a\n'):
    raise ValueError('Expected a Terrarium PNG, received another response')
filename = f'terrarium-{ZOOM}-{X}-{Y}.png'
(OUT / filename).write_bytes(content)
manifest = {
    'dataset': 'Mapzen / Tilezen Terrain Tiles on AWS',
    'accessedDateLocal': datetime.now(timezone(timedelta(hours=8))).date().isoformat(),
    'retrievedAt': datetime.now(timezone.utc).isoformat(),
    'url': url, 'file': filename, 'zoom': ZOOM, 'x': X, 'y': Y,
    'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content),
    'headers': headers,
    'registry': 'https://registry.opendata.aws/terrain-tiles/',
    'formats': 'https://github.com/tilezen/joerd/blob/master/docs/formats.md',
    'sourceDocumentation': 'https://github.com/tilezen/joerd/blob/master/docs/data-sources.md',
    'attributionUrl': 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    'attribution': 'Mapzen / Tilezen; SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey',
    'sourceNote': 'Global mid/high-zoom land tiles use SRTM; inspect archived source headers for tile-specific provenance.',
    'encoding': 'elevation_m = R * 256 + G + B / 256 - 32768',
}
(OUT / 'source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
