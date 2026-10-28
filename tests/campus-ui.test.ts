import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data/catalog';
import { campusFrame, venueAnchors } from '../src/data/campus';
import { overlaps, placeMapLabels, type LabelRequest } from '../src/lib/map-labels';

test('Original dining labels reserve their full multiline height and icon padding', () => {
  const [label] = placeMapLabels(
    [
      {
        id: 'minzu',
        lines: ['民族食堂', '第八、九食堂'],
        x: 200,
        y: 200,
        priority: 0,
        badge: true,
        fontSize: 10.5,
        lineHeight: 14,
      },
    ],
    { width: 400, height: 400 },
  );
  assert.equal(label.lineHeight, 14);
  assert.equal(label.height, 38);
  assert(label.width >= 6 * 10.5 + 24);
  assert(label.box.bottom - label.box.top > label.height);
});

test('dining labels stay clear of overlays at desktop and phone overview sizes', () => {
  for (const [width, height, left, top, right, bottom] of [
    [1416, 876, 370, 90, 1338, 832],
    [1342, 744, 370, 90, 1264, 700],
    [374, 828, 20, 82, 350, 742],
  ]) {
    const scale = Math.min((right - left) / campusFrame.width, (bottom - top) / campusFrame.height);
    const x = (left + right) / 2 - (campusFrame.x + campusFrame.width / 2) * scale;
    const y = (top + bottom) / 2 - (campusFrame.y + campusFrame.height / 2) * scale;
    const reserved = [
      { left: 0, top: 0, right: width, bottom: top - 12 },
      { left: 0, top: height - 60, right: width, bottom: height },
      ...(width > 700 ? [{ left: 0, top, right: left - 20, bottom: height }] : []),
    ];
    const requests: LabelRequest[] = catalog.venues.map((venue) => ({
      id: venue.id,
      lines: [venue.name],
      x: x + venue.campusPosition[0] * scale,
      y: y + venue.campusPosition[1] * scale,
      priority: 0,
      badge: true,
      fontSize: 10.5,
      lineHeight: 14,
      preferred: venueAnchors[venue.id].labelOffset,
    }));
    const placed = placeMapLabels(requests, { width, height }, reserved);
    assert.equal(placed.length, 7, `${width}×${height}: all seven dining labels should fit`);
    for (const [index, label] of placed.entries()) {
      assert(reserved.every((box) => !overlaps(label.box, box)));
      assert(placed.slice(index + 1).every((other) => !overlaps(label.box, other.box)));
    }
  }
});
