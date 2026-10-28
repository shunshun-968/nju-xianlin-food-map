import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelClickGesture, type ModelClickPointer } from '../src/lib/model-click-gesture';

function pointer(
  pointerId: number,
  clientX = 100,
  clientY = 200,
  extra: Partial<ModelClickPointer> = {},
): ModelClickPointer {
  return { pointerId, button: 0, clientX, clientY, ...extra };
}

test('a single primary click returns its exact pointerdown payload once, including touch-sized jitter', () => {
  const gesture = createModelClickGesture<{ ray: number[] }>();
  const snapshot = { ray: [1, 2, 3, 0, 0, -1] };
  gesture.down(pointer(1), snapshot);
  gesture.move(pointer(1, 103, 204, { button: -1 }));
  assert.equal(gesture.up(pointer(1, 106, 200)), snapshot, 'The 6px boundary remains a click');
  assert.equal(gesture.up(pointer(1)), undefined, 'A duplicate up cannot select twice');
  const touchSnapshot = { ray: [4, 5, 6, 0, -1, 0] };
  gesture.down(pointer(7, 15, 40, { isPrimary: true }), touchSnapshot);
  assert.equal(gesture.up(pointer(7, 16, 42)), touchSnapshot);
});

test('any excursion beyond 6px permanently rejects the gesture even when it returns to its origin', () => {
  const gesture = createModelClickGesture<string>();
  gesture.down(pointer(1), 'counter');
  gesture.move(pointer(1, 105, 204)); // sqrt(5² + 4²) > 6
  gesture.move(pointer(1));
  assert.equal(gesture.up(pointer(1)), undefined);
  gesture.down(pointer(1), 'next click');
  assert.equal(gesture.up(pointer(1)), 'next click', 'A completed drag does not poison later clicks');
});

test('pointerup also checks movement when no pointermove was delivered', () => {
  const gesture = createModelClickGesture<number>();
  gesture.down(pointer(1), 0);
  assert.equal(gesture.up(pointer(1, 106.01)), undefined);
  gesture.down(pointer(1), 0);
  assert.equal(gesture.up(pointer(1)), 0, 'Falsy payloads remain valid');
});

test('a second pointer suppresses the whole gesture regardless of release order', () => {
  for (const firstRelease of [1, 2]) {
    const gesture = createModelClickGesture<string>();
    gesture.down(pointer(1), 'first');
    gesture.down(pointer(2, 120, 200, { isPrimary: false }), 'second');
    assert.equal(gesture.up(pointer(firstRelease)), undefined);
    assert.equal(gesture.up(pointer(firstRelease === 1 ? 2 : 1)), undefined);
    gesture.down(pointer(3), 'fresh');
    assert.equal(gesture.up(pointer(3)), 'fresh');
  }
});

test('cancelling one pointer after a pinch never rearms the remaining pointer', () => {
  const gesture = createModelClickGesture<string>();
  gesture.down(pointer(1), 'first');
  gesture.down(pointer(2), 'second');
  gesture.cancel({ pointerId: 2 });
  assert.equal(gesture.up(pointer(1)), undefined);
  gesture.down(pointer(3), 'third');
  gesture.cancel(3);
  assert.equal(gesture.up(pointer(3)), undefined);
  gesture.down(pointer(4), 'fourth');
  assert.equal(gesture.up(pointer(4)), 'fourth');
});

test('right or middle buttons, non-primary pointers and duplicate downs cannot start a click', () => {
  for (const extra of [{ button: 1 }, { button: 2 }, { isPrimary: false }]) {
    const gesture = createModelClickGesture<string>();
    gesture.down(pointer(1, 100, 200, extra), 'invalid');
    assert.equal(gesture.up(pointer(1)), undefined);
  }
  const gesture = createModelClickGesture<string>();
  gesture.down(pointer(1), 'original');
  gesture.down(pointer(1), 'duplicate');
  assert.equal(gesture.up(pointer(1)), undefined);
  gesture.down(pointer(1), 'left');
  gesture.down(pointer(1, 100, 200, { button: 2 }), 'right chord');
  assert.equal(gesture.up(pointer(1)), undefined);
});

test('unmatched releases never emit a payload and clear discards every active pointer', () => {
  const gesture = createModelClickGesture<string>();
  assert.equal(gesture.up(pointer(2)), undefined);
  gesture.down(pointer(1), 'matching');
  assert.equal(gesture.up(pointer(2)), undefined);
  assert.equal(gesture.up(pointer(1)), 'matching');
  gesture.down(pointer(3), 'before clear');
  gesture.down(pointer(4), 'second');
  gesture.clear();
  assert.equal(gesture.up(pointer(3)), undefined);
  assert.equal(gesture.up(pointer(4)), undefined);
  gesture.down(pointer(5), 'after clear');
  assert.equal(gesture.up(pointer(5)), 'after clear');
});

test('non-finite coordinates reject clicks and custom thresholds retain the same drag semantics', () => {
  const gesture = createModelClickGesture<string>(3);
  gesture.down(pointer(1), 'too far');
  assert.equal(gesture.up(pointer(1, 104)), undefined);
  gesture.down(pointer(1, NaN), 'invalid down');
  assert.equal(gesture.up(pointer(1)), undefined);
  gesture.down(pointer(1), 'invalid move');
  gesture.move(pointer(1, Infinity));
  assert.equal(gesture.up(pointer(1)), undefined);
  gesture.down(pointer(1), 'invalid up');
  assert.equal(gesture.up(pointer(1, NaN)), undefined);
  for (const threshold of [-1, Infinity, NaN])
    assert.throws(() => createModelClickGesture(threshold), RangeError);
});
