import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getCampusModelBounds,
  getCampusModelPlacement,
  modeledCampusVenueIds,
  type CampusModelMetadata,
} from '../src/lib/campus-model-artwork';
import type { CampusBasemap } from '../src/lib/campus-basemap';

const map: CampusBasemap = JSON.parse(
  readFileSync(new URL('../public/osm/campus-render.json', import.meta.url), 'utf8'),
);
const manifest: Record<string, CampusModelMetadata> = JSON.parse(
  readFileSync(new URL('../src/assets/campus-models/manifest.json', import.meta.url), 'utf8'),
);
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('seven model artworks have paired local day/night resources and positive framing metadata', () => {
  assert.deepEqual(
    [...modeledCampusVenueIds].sort(),
    ['v-10', 'v-1112', 'v-456', 'v-891', 'v-south', 'v-yifu', 'v-hut'].sort(),
  );
  for (const id of modeledCampusVenueIds) {
    const venue = map.venues.find((v) => v.id === id)!;
    const entry = manifest[id];
    assert.ok(entry);
    for (const number of Object.values(entry)) assert.ok(Number.isFinite(number));
    for (const dimension of [entry.width, entry.height, entry.referenceWidth, entry.referenceDepth])
      assert.ok(dimension > 0);
    close(entry.referenceWidth, venue.width);
    close(entry.referenceDepth, venue.depth);
    const placement = getCampusModelPlacement(venue, 1)!;
    for (const href of [placement.hrefDay, placement.hrefNight]) {
      assert.ok(existsSync(fileURLToPath(href)), `Missing sprite ${href}`);
      const signature = readFileSync(new URL(href));
      assert.equal(signature.subarray(0, 4).toString(), 'RIFF');
      assert.equal(signature.subarray(8, 12).toString(), 'WEBP');
    }
  }
});

test('enlargement preserves approved anchors and applies the same factor to the image, offsets and footprint', () => {
  for (const venue of map.venues) {
    const entry = manifest[venue.id];
    const p = getCampusModelPlacement(venue, 2);
    if (!modeledCampusVenueIds.includes(venue.id as (typeof modeledCampusVenueIds)[number])) {
      assert.equal(p, undefined);
      assert.equal(getCampusModelBounds(venue, 2), undefined);
      continue;
    }
    assert.ok(p);
    assert.deepEqual(p.anchor, venue.point);
    close(p.x - venue.point[0], entry.offsetX * p.boost);
    close(p.y - venue.point[1], entry.offsetY * p.boost);
    close(p.width / entry.width, p.height / entry.height);
    if (!['v-south', 'v-yifu', 'v-hut'].includes(venue.id)) close(p.boost, 1.14);
    const centre = p.groundPolygon.reduce(([x, y], [px, py]) => [x + px / 4, y + py / 4], [0, 0]);
    close(centre[0], venue.point[0]);
    close(centre[1], venue.point[1]);
    assert.deepEqual(getCampusModelBounds(venue, 2), {
      left: p.x,
      top: p.y,
      right: p.x + p.width,
      bottom: p.y + p.height,
    });
    const shifted = getCampusModelPlacement(
      { ...venue, point: [venue.point[0] + 120, venue.point[1] - 75] },
      2,
    )!;
    close(shifted.x - p.x, 120);
    close(shifted.y - p.y, -75);
    close(shifted.width, p.width);
    close(shifted.height, p.height);
  }
});

test('Yifu stays indoors at its approved anchor and never exceeds a cart-sized display', () => {
  const yifu = map.venues.find((venue) => venue.id === 'v-yifu')!;
  const cart = map.venues.find((venue) => venue.id === 'v-south')!;
  assert.equal(yifu.indoor, true);
  for (const scale of [0.08, 0.2, 0.5, 1, 4, 12]) {
    const model = getCampusModelPlacement(yifu, scale)!;
    const reference = getCampusModelPlacement(cart, scale)!;
    assert.deepEqual(model.anchor, yifu.point);
    assert.ok(model.width <= reference.width * 1.05 + 1e-7);
    assert.ok(model.height <= reference.height * 1.05 + 1e-7);
    assert.ok(model.width * model.height <= reference.width * reference.height * 1.105);
    assert.ok(Math.max(model.width, model.height) * scale >= 12);
  }
});

test('cart stays visible at overview and every model retains a 24px pick target without moving its ground anchor', () => {
  for (const scale of [0.08, 0.2, 0.5, 1, 4, 12])
    for (const venue of map.venues.filter((v) =>
      modeledCampusVenueIds.includes(v.id as (typeof modeledCampusVenueIds)[number]),
    )) {
      const p = getCampusModelPlacement(venue, scale)!;
      assert.deepEqual(p.anchor, venue.point);
      if (venue.id === 'v-south') {
        assert.ok(p.width * scale >= 18 * Math.SQRT1_2 - 1e-7);
        const entry = manifest[venue.id];
        const previousBoost = Math.max(1.3, 18 / (entry.width * scale));
        close((p.width * p.height) / (entry.width * entry.height * previousBoost ** 2), 0.5);
      }
      if (venue.id === 'v-hut') assert.ok(p.width * scale >= 18 - 1e-7);
      assert.ok(p.hitBounds.width * scale >= 24 - 1e-7);
      assert.ok(p.hitBounds.height * scale >= 24 - 1e-7);
      assert.ok(p.hitBounds.x <= p.x && p.hitBounds.y <= p.y);
      assert.ok(p.hitBounds.x + p.hitBounds.width >= p.x + p.width - 1e-7);
      assert.ok(p.hitBounds.y + p.hitBounds.height >= p.y + p.height - 1e-7);
    }
});
