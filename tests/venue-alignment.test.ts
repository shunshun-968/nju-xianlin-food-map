import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalog } from '../src/data/catalog';

const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const venues = read('../public/osm/food-venues.geojson').features;
const references = read('../public/osm/venue-references.geojson').features;
const osm = read('../public/osm/all.geojson').features;

test('approved food locations retain stable venue IDs and the exact approved coordinates', () => {
  const expected: Record<string, number[]> = {
    'v-yifu': [118.9546736, 32.1130478],
    'v-hut': [118.9505923, 32.1133618],
    'v-south': [118.955167, 32.1117357],
  };
  assert.equal(venues.length, 3);
  assert.equal(new Set(venues.map((f: { id: string }) => f.id)).size, 3);
  for (const venue of venues) {
    const id = venue.properties.venue_id;
    assert.ok(catalog.venues.some((v) => v.id === id));
    assert.equal(venue.id, `venue/${id}`);
    assert.equal(venue.geometry.type, 'Point');
    assert.deepEqual(venue.geometry.coordinates, expected[id]);
    assert.equal(venue.properties.review_status, 'approved');
    assert.equal(venue.properties.surveyed, false);
  }
});

test('Yifu takeaway stays explicitly indoors; the south cart remains a point beside the reference path', () => {
  const yifu = venues.find(
    (f: { properties: { venue_id: string } }) => f.properties.venue_id === 'v-yifu',
  );
  assert.equal(yifu.properties.indoor, true);
  assert.equal(yifu.properties.location_note, '位于室内');
  const south = venues.find(
    (f: { properties: { venue_id: string } }) => f.properties.venue_id === 'v-south',
  );
  assert.equal(south.properties.reference_osm_id, 'way/1230586795');
  for (const reference of references) {
    const original = osm.find((f: { id: string }) => f.id === reference.id);
    assert.ok(original);
    assert.deepEqual(reference.geometry, original.geometry);
  }
  assert.equal(
    references.find((f: { id: string }) => f.id === 'way/1230586795').geometry.type,
    'LineString',
  );
});
