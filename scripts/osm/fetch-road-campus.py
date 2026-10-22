"""Archive OSM map data covering the four-road campus boundary, including Weidi Road."""
import datetime
import hashlib
import json
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parents[2]
destination = root / 'data/osm/raw/road-bounded-campus'
destination.mkdir(parents=True, exist_ok=True)
sources = []


def fetch(url, filename):
    request = urllib.request.Request(url, headers={
        'User-Agent': 'NJU-Xianlin-Food-Map/0.1 (road-bounded campus snapshot)',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(request, timeout=55) as response:
        body = response.read()
    document = json.loads(body)
    if not document.get('elements'):
        raise ValueError('Empty OSM response')
    (destination / filename).write_bytes(body)
    sources.append({'file': filename, 'url': url,
                    'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'sha256': hashlib.sha256(body).hexdigest()})
    return document


document = fetch('https://api.openstreetmap.org/api/0.6/map.json?bbox=118.9442,32.1093,118.9621,32.1325', 'campus.osm.json')
known = {(e['type'], e['id']) for e in document['elements']}
for element in document['elements']:
    if element['type'] == 'relation' and element.get('tags', {}).get('type') == 'multipolygon':
        if any((m['type'], m['ref']) not in known for m in element.get('members', [])):
            fetch(f"https://api.openstreetmap.org/api/0.6/relation/{element['id']}/full.json",
                  f"relation-{element['id']}.osm.json")
(destination / 'sources.json').write_text(json.dumps(sources, indent=2) + '\n', encoding='utf-8')
print(f"Archived {len(document['elements'])} OSM elements and {len(sources)} source responses")
