import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data/catalog';
import { validateCatalog, mediaUrl } from '../src/domain';
test('all demo stalls have valid floor-relative spatial mappings', () =>
  assert.deepEqual(validateCatalog(catalog), []));
test('malformed external catalogs fail validation instead of crashing', () => {
  for (const value of [
    null,
    {},
    [],
    { version: 1, coordinateSystem: 'test', venues: [null], floors: [], stalls: [] },
  ])
    assert(validateCatalog(value).length > 0);
});
test('orphan and rotated out-of-bounds layouts are rejected', () => {
  const data = structuredClone(catalog);
  data.stalls[0].floorId = 'missing';
  const floor = data.floors.find((f) => f.id === data.stalls[1].floorId)!;
  data.stalls[1].position = {
    x: floor.width / 2 - 1,
    z: 0,
    width: 6,
    depth: 6,
    rotationY: Math.PI / 4,
  };
  const errors = validateCatalog(data);
  assert(errors.some((e) => e.includes('missing floor')));
  assert(errors.some((e) => e.includes('outside floor')));
});
test('duplicate IDs are rejected, independent of display order', () => {
  const data = structuredClone(catalog);
  data.stalls.reverse();
  assert.deepEqual(validateCatalog(data), []);
  data.stalls[1].id = data.stalls[0].id;
  assert(validateCatalog(data).some((e) => e.includes('duplicate id')));
});
test('media URL can migrate hosts without changing stable keys', () => {
  assert.equal(
    mediaUrl('stalls/面食/a.webp', 'https://media.example.edu/'),
    'https://media.example.edu/stalls/%E9%9D%A2%E9%A3%9F/a.webp',
  );
  for (const key of ['../secret', '/secret', 'a/../b', 'https://evil.test/a', 'a\\b', 'a?b'])
    assert.throws(() => mediaUrl(key, 'https://media.example.edu'));
  assert.equal(mediaUrl(null, 'https://media.example.edu'), null);
});
