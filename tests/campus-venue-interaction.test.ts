import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCampusModelPlacement, modeledCampusVenueIds } from '../src/lib/campus-model-artwork';
import {
  isModeledCampusVenue,
  nextCampusVenueTap,
  nearestCampusVenue,
} from '../src/lib/campus-venue-interaction';
import type { CampusBasemap } from '../src/lib/campus-basemap';

test('the modeled venue registry includes Yifu and Ninan hut and excludes unknown places', () => {
  assert.equal(modeledCampusVenueIds.length, 7);
  for (const id of modeledCampusVenueIds) assert.equal(isModeledCampusVenue(id), true);
  for (const id of [null, 'unknown', 'v-10-f1']) assert.equal(isModeledCampusVenue(id), false);
});

test('two completed taps on the same modeled place reveal its name then enter once', () => {
  for (const id of modeledCampusVenueIds.filter((venueId) => venueId !== 'v-yifu')) {
    const first = nextCampusVenueTap(null, id, true);
    assert.deepEqual(first, { preview: id, enter: null });
    const second = nextCampusVenueTap(first.preview, id, true);
    assert.deepEqual(second, { preview: null, enter: id });
    // Returning to the map starts a fresh confirmation rather than keeping an armed place.
    assert.deepEqual(nextCampusVenueTap(second.preview, id, true), first);
  }
});

test('Yifu has no name-preview step and enters directly on the first touch', () => {
  for (const preview of [null, 'v-yifu', 'v-south']) {
    for (const confirmation of [false, true])
      assert.deepEqual(nextCampusVenueTap(preview, 'v-yifu', confirmation), {
        preview: null,
        enter: 'v-yifu',
      });
  }
});

test('switching places replaces the preview and blank or cancelled navigation disarms it', () => {
  const first = nextCampusVenueTap(null, 'v-456', true);
  const switched = nextCampusVenueTap(first.preview, 'v-891', true);
  assert.deepEqual(switched, { preview: 'v-891', enter: null });
  assert.deepEqual(nextCampusVenueTap(switched.preview, 'v-456', true), {
    preview: 'v-456',
    enter: null,
  });
  const cleared = nextCampusVenueTap(switched.preview, null, true);
  assert.deepEqual(cleared, { preview: null, enter: null });
  assert.deepEqual(nextCampusVenueTap(cleared.preview, 'v-891', true), switched);
  assert.deepEqual(nextCampusVenueTap(null, null, false), cleared);
});

test('desktop and unmodeled places enter directly without inheriting a touch preview', () => {
  for (const currentPreview of [null, 'v-456', 'v-10']) {
    for (const id of [...modeledCampusVenueIds, 'unmodeled-example'])
      assert.deepEqual(nextCampusVenueTap(currentPreview, id, false), {
        preview: null,
        enter: id,
      });
  }
  // A highlighted/focused place is not an argument: a first touch remains a preview.
  assert.deepEqual(nextCampusVenueTap(null, 'v-456', true), {
    preview: 'v-456',
    enter: null,
  });
});

test('overlapping overview hit regions prefer the actual model instead of the later-painted hut', () => {
  const map: CampusBasemap = JSON.parse(
    readFileSync(new URL('../public/osm/campus-render.json', import.meta.url), 'utf8'),
  );
  for (const scale of [0.15, 0.25, 0.4, 1])
    for (const venues of [map.venues, [...map.venues].reverse()]) {
      for (const id of modeledCampusVenueIds) {
        const venue = venues.find((v) => v.id === id)!;
        const model = getCampusModelPlacement(venue, scale)!;
        assert.equal(
          nearestCampusVenue(
            venues,
            [model.x + model.width / 2, model.y + model.height / 2],
            scale,
          ),
          id,
        );
      }
      const hut = venues.find((v) => v.id === 'v-hut')!;
      assert.equal(
        nearestCampusVenue(venues, [hut.point[0], hut.point[1] - hut.height], scale),
        hut.id,
      );
      assert.equal(nearestCampusVenue(venues, [-1000, -1000], scale), null);
    }
});
