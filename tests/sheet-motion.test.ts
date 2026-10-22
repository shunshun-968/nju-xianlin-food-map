import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetRelease } from '../src/lib/sheet-motion';

test('quick sheet releases glide in the finger direction with bounded distance', () => {
  for (const direction of [-1, 1]) {
    const result = sheetRelease(
      [
        { position: 200, time: 0 },
        { position: 200 + direction * 60, time: 50 },
      ],
      { position: 200 + direction * 72, time: 60 },
      0.5,
      400,
    );
    assert((result.progress - 0.5) * direction > 0);
    assert(Math.abs(result.progress - 0.5) * 400 <= 100);
    assert(result.duration > 0 && result.duration <= 300);
  }
});

test('slow releases and holding the handle still preserve the chosen height', () => {
  assert.equal(
    sheetRelease([{ position: 200, time: 0 }], { position: 205, time: 60 }, 0.4, 400).progress,
    0.4,
  );
  assert.equal(
    sheetRelease(
      [
        { position: 200, time: 0 },
        { position: 260, time: 50 },
      ],
      { position: 260, time: 180 },
      0.4,
      400,
    ).duration,
    0,
  );
});

test('sheet momentum stops at both limits and follows a recent direction reversal', () => {
  for (const direction of [-1, 1]) {
    const result = sheetRelease(
      [{ position: 200, time: 0 }],
      { position: 200 + direction * 60, time: 60 },
      direction < 0 ? 0.02 : 0.98,
      400,
    );
    assert.equal(result.progress, direction < 0 ? 0 : 1);
  }
  const reversed = sheetRelease(
    [
      { position: 400, time: 0 },
      { position: 200, time: 100 },
      { position: 230, time: 160 },
    ],
    { position: 240, time: 180 },
    0.5,
    400,
  );
  assert(reversed.progress > 0.5);
});
