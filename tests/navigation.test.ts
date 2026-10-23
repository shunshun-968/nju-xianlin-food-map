import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigationPath, navigationUrl, readNavigation } from '../src/lib/use-app-navigation';
import { catalog } from '../src/data/catalog';

test('direct floor links contain campus and building ancestors, with reversible URLs', () => {
  for (const floor of catalog.floors) {
    const state = readNavigation(new URL(`https://example.test/map/?floor=${floor.id}`));
    const path = navigationPath(state);
    assert.deepEqual(
      path.map((entry) => entry.view.level),
      ['campus', 'building', 'floor'],
    );
    for (const entry of path)
      assert.deepEqual(
        readNavigation(navigationUrl(entry, new URL('https://example.test/map/'))),
        entry,
      );
  }
});
test('detail and about each add one dismissible history level', () => {
  const stall = catalog.stalls[0];
  const state = readNavigation(
    new URL(`https://example.test/map/?floor=${stall.floorId}&stall=${stall.id}&info=1`),
  );
  const path = navigationPath(state);
  assert.equal(path.length, 5);
  assert.equal(path[3].stallId, stall.id);
  assert.equal(path[3].showInfo, false);
  assert.equal(path[4].showInfo, true);
});
test('unknown and mismatched route IDs fall back safely', () => {
  assert.equal(
    readNavigation(new URL('https://example.test/map/?floor=unknown')).view.level,
    'campus',
  );
  assert.equal(
    readNavigation(new URL('https://example.test/map/?venue=v-south&stall=unknown')).stallId,
    null,
  );
});
