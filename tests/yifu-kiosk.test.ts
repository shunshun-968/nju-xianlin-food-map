import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data/catalog';
import { validateCatalog } from '../src/domain';
import { getModelNorth } from '../src/data/model-orientation';
import {
  YIFU_KIOSK_FLOOR_ID,
  YIFU_KIOSK_VENUE_ID,
  yifuKioskStall,
  yifuKioskOfferings,
} from '../src/data/yifu-kiosk';
import { navigationPath, navigationUrl, readNavigation } from '../src/lib/use-app-navigation';

test('Yifu B102 is one service window without leftover demo stalls or invented prices', () => {
  assert.deepEqual(
    catalog.stalls.filter((stall) => stall.floorId === YIFU_KIOSK_FLOOR_ID),
    [yifuKioskStall],
  );
  assert.equal(yifuKioskStall.breakfast, true);
  assert.deepEqual(yifuKioskStall.dishes, []);
  assert.equal(yifuKioskOfferings.length, 3);
  assert.deepEqual(validateCatalog(catalog), []);
});

test('the second-level venue opens its single window and Back has no extra floor step', () => {
  const url = new URL(
    `https://example.test/map/?venue=${YIFU_KIOSK_VENUE_ID}&stall=${yifuKioskStall.id}`,
  );
  const state = readNavigation(url);
  assert.deepEqual(state.view, { level: 'building', venueId: YIFU_KIOSK_VENUE_ID });
  assert.equal(state.stallId, yifuKioskStall.id);
  const path = navigationPath(state);
  assert.deepEqual(
    path.map((entry) => entry.view.level),
    ['campus', 'building', 'building'],
  );
  assert.deepEqual(
    path.map((entry) => entry.stallId),
    [null, null, yifuKioskStall.id],
  );
  for (const entry of path) assert.deepEqual(readNavigation(navigationUrl(entry, url)), entry);
});

test('old Yifu floor links retain the selected window while normalizing to the venue route', () => {
  const state = readNavigation(
    new URL(
      `https://example.test/map/?floor=${YIFU_KIOSK_FLOOR_ID}&stall=${yifuKioskStall.id}&info=1`,
    ),
  );
  assert.equal(state.view.level, 'building');
  assert.equal(state.stallId, yifuKioskStall.id);
  assert.equal(state.showInfo, true);
  const normalized = navigationUrl(state, new URL('https://example.test/map/'));
  assert.equal(normalized.searchParams.get('venue'), YIFU_KIOSK_VENUE_ID);
  assert.equal(normalized.searchParams.has('floor'), false);
  assert.equal(navigationPath(state).length, 4);
});

test('cross-venue window IDs cannot select the Yifu point and north is opposite the open south edge', () => {
  assert.equal(
    readNavigation(new URL(`https://example.test/map/?venue=v-south&stall=${yifuKioskStall.id}`))
      .stallId,
    null,
  );
  assert.equal(
    readNavigation(
      new URL(`https://example.test/map/?venue=${YIFU_KIOSK_VENUE_ID}&stall=v-south-f1-cart`),
    ).stallId,
    null,
  );
  assert.deepEqual(getModelNorth({ level: 'building', venueId: YIFU_KIOSK_VENUE_ID }), {
    x: 0,
    z: -1,
  });
});
