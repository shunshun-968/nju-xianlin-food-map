"""Archive a tiled OSM context snapshot around the campus (explicit refresh only)."""
import datetime
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DESTINATION = ROOT / 'data/osm/raw/campus-context'
BBOX = [118.922, 32.102, 118.988, 32.141]
DESTINATION.mkdir(parents=True, exist_ok=True)
sources = []


def fetch(url, filename):
    metadata = DESTINATION / (filename + '.source.json')
    target = DESTINATION / filename
    if target.exists() and metadata.exists():
        record = json.loads(metadata.read_text(encoding='utf-8'))
        body = target.read_bytes()
        if record['url'] == url and hashlib.sha256(body).hexdigest() == record['sha256']:
            sources.append(record)
            print(f'Using archived {filename}', flush=True)
            return json.loads(body)
    request = urllib.request.Request(url, headers={
        'User-Agent': 'NJU-Xianlin-Food-Map/0.1 (campus context snapshot)',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(request, timeout=55) as response:
        body = response.read()
    document = json.loads(body)
    if not document.get('elements'):
        raise ValueError(f'Empty OSM response: {url}')
    target.write_bytes(body)
    record = {'file': filename, 'url': url,
              'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'sha256': hashlib.sha256(body).hexdigest()}
    metadata.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    sources.append(record)
    print(f"Archived {filename}: {len(document['elements'])} elements, {len(body)} bytes", flush=True)
    return document


def main():
    west, south, east, north = BBOX
    midx, midy = (west + east) / 2, (south + north) / 2
    tiles = [(west,south,midx,midy), (midx,south,east,midy),
             (west,midy,midx,north), (midx,midy,east,north)]
    elements = {}
    for index, bounds in enumerate(tiles, 1):
        bbox = ','.join(f'{n:.6f}' for n in bounds)
        document = fetch(f'https://api.openstreetmap.org/api/0.6/map.json?bbox={bbox}', f'tile-{index}.osm.json')
        for element in document['elements']:
            key = (element['type'], element['id'])
            if key not in elements or element.get('version', 0) >= elements[key].get('version', 0):
                elements[key] = element
    known = set(elements)
    for element in list(elements.values()):
        if element['type'] != 'relation' or element.get('tags', {}).get('type') != 'multipolygon':
            continue
        if any((member['type'],member['ref']) not in known for member in element.get('members', [])):
            document = fetch(f"https://api.openstreetmap.org/api/0.6/relation/{element['id']}/full.json", f"relation-{element['id']}.osm.json")
            for member in document['elements']:
                known.add((member['type'],member['id']))
    (DESTINATION / 'sources.json').write_text(json.dumps(sources, indent=2) + '\n', encoding='utf-8')
    (DESTINATION / 'coverage.json').write_text(json.dumps({'bbox': BBOX, 'tiles': tiles}, indent=2) + '\n', encoding='utf-8')
    print(f'Completed {len(sources)} sources; {len(elements)} base OSM elements', flush=True)


if __name__ == '__main__':
    main()
