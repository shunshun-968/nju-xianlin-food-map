"""Explicit, occasional snapshot refresh; never called by the browser or CI."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/osm/raw'
SNAPSHOT = RAW / 'snapshots' / datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
QUERIES = ROOT / 'data/osm/queries'
BBOX = [118.9442, 32.1099, 118.9621, 32.1297]
ENDPOINTS = [os.environ.get('OVERPASS_URL', 'https://overpass-api.de/api/interpreter'),
             'https://overpass.private.coffee/api/interpreter']
records, attempts = [], []


def request(url, data=None):
    req = urllib.request.Request(url, data=data, headers={
        'User-Agent': 'NJU-Xianlin-Food-Map/0.1 (campus basemap snapshot)',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=45) as response:
        body = response.read()
    document = json.loads(body)
    if document.get('remark') or not document.get('elements'):
        raise ValueError(document.get('remark', 'Empty or invalid OSM response'))
    return body, document


def save(filename, url, response, query_file=None):
    body, document = response
    SNAPSHOT.mkdir(parents=True, exist_ok=True)
    target = SNAPSHOT / filename
    target.write_bytes(body)
    record = {'file': target.relative_to(RAW).as_posix(), 'url': url,
                    'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'sha256': hashlib.sha256(body).hexdigest()}
    if query_file:
        record['queryFile'] = query_file
    records.append(record)
    print(f'Saved {filename}: {len(body)} bytes', flush=True)
    return document


def overpass(query_name):
    data = urllib.parse.urlencode({'data': (QUERIES / query_name).read_text(encoding='utf-8')}).encode()
    for endpoint in ENDPOINTS:
        try:
            response = request(endpoint, data)
            attempts.append({'endpoint': endpoint, 'query': query_name, 'result': 'success'})
            return endpoint, response
        except (OSError, ValueError, urllib.error.URLError) as error:
            attempts.append({'endpoint': endpoint, 'query': query_name, 'result': str(error)})
            print(f'Overpass unavailable: {endpoint}: {error}', flush=True)
    return None


boundary_result = overpass('boundary.overpassql')
if boundary_result:
    endpoint, response = boundary_result
    boundary = save('boundary-overpass.osm.json', endpoint, response, 'boundary.overpassql')
else:
    url = 'https://api.openstreetmap.org/api/0.6/way/89910837/full.json'
    boundary = save('boundary-api.openstreetmap.org.osm.json', url, request(url))
way = next(e for e in boundary['elements'] if e['type'] == 'way' and e['id'] == 89910837)
if '仙林' not in way.get('tags', {}).get('name', ''):
    raise ValueError('Boundary name verification failed; do not query another campus')

# The preview deliberately retains nearby roads; area-only query is supplied separately.
bbox_result = overpass('campus-bbox.overpassql') if boundary_result else None
if bbox_result:
    endpoint, response = bbox_result
    campus = save('campus-bbox.osm.json', endpoint, response, 'campus-bbox.overpassql')
    method = 'overpass-bbox'
else:
    url = 'https://api.openstreetmap.org/api/0.6/map.json?bbox=' + ','.join(map(str, BBOX))
    campus = save('campus-bbox.osm.json', url, request(url))
    method = 'osm-api-bbox-fallback'

# The map API returns parent relations but may omit members outside the bbox.
# Complete thematic multipolygons; do not download entire transit route relations.
known = {(e['type'], e['id']) for e in campus['elements']}
for relation in campus['elements']:
    if relation['type'] != 'relation' or relation.get('tags', {}).get('type') != 'multipolygon':
        continue
    if any((member['type'], member['ref']) not in known for member in relation.get('members', [])):
        url = f"https://api.openstreetmap.org/api/0.6/relation/{relation['id']}/full.json"
        save(f"relation-{relation['id']}.osm.json", url, request(url))

(RAW / 'acquisition.json').write_text(json.dumps({
    'method': method, 'bbox': BBOX, 'overpassAttempts': attempts, 'sources': records,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Next: node scripts/osm/convert.mjs', flush=True)
