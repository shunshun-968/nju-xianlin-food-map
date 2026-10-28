import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data/catalog';
import { validateCatalog } from '../src/domain';
import {
  NINAN_HUT_FLOOR_ID,
  NINAN_HUT_VENUE_ID,
  defaultNinanMealMode,
  ninanHutStall,
} from '../src/data/ninan-hut';
import { navigationPath, navigationUrl, readNavigation } from '../src/lib/use-app-navigation';

test('Ninan hut is one named service point with no demo stalls or invented prices', () => {
  const venue = catalog.venues.find((row) => row.id === NINAN_HUT_VENUE_ID)!;
  assert.equal(venue.name, '呢喃小屋');
  assert.equal(venue.shortName, '呢喃小屋');
  assert.deepEqual(
    catalog.stalls.filter((row) => row.floorId === NINAN_HUT_FLOOR_ID),
    [ninanHutStall],
  );
  assert.deepEqual(ninanHutStall.dishes, []);
  assert.equal(ninanHutStall.breakfast, true);
  assert.deepEqual(validateCatalog(catalog), []);
});

test('day defaults to breakfast and night defaults to dinner independently of model availability', () => {
  assert.equal(defaultNinanMealMode(false), 'breakfast');
  assert.equal(defaultNinanMealMode(true), 'dinner');
});

test('Ninan hut detail deep links and legacy floor links share an exterior-only route', () => {
  for (const query of [`venue=${NINAN_HUT_VENUE_ID}`, `floor=${NINAN_HUT_FLOOR_ID}`]) {
    const url = new URL(`https://example.test/map/?${query}&stall=${ninanHutStall.id}`);
    const state = readNavigation(url);
    assert.deepEqual(state.view, { level: 'building', venueId: NINAN_HUT_VENUE_ID });
    assert.equal(state.stallId, ninanHutStall.id);
    const path = navigationPath(state);
    assert.deepEqual(
      path.map((row) => row.view.level),
      ['campus', 'building', 'building'],
    );
    for (const entry of path) assert.deepEqual(readNavigation(navigationUrl(entry, url)), entry);
    const normalized = navigationUrl(state, url);
    assert.equal(normalized.searchParams.has('floor'), false);
    assert.equal(normalized.searchParams.get('venue'), NINAN_HUT_VENUE_ID);
  }
  assert.equal(
    readNavigation(new URL(`https://example.test/?venue=v-south&stall=${ninanHutStall.id}`))
      .stallId,
    null,
  );
  assert.equal(
    readNavigation(new URL(`https://example.test/?venue=v-hut&stall=v-south-f1-cart`)).stallId,
    null,
  );
});
