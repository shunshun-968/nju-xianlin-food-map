import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSceneModel } from '../src/lib/scene-loading';

test('both model factories become available while all image downloads remain unresolved', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  let requested = 0;
  class SlowImage {
    onload = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      requested++;
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: SlowImage });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const started = performance.now();
  try {
    const factories = await Promise.race([
      Promise.all(
        ['v-yifu', 'v-hut'].map((venueId) => prepareSceneModel({ level: 'building', venueId })),
      ),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('model blocked on photos')), 5000);
      }),
    ]);
    assert.ok(factories.every((factory) => typeof factory === 'function'));
    assert.equal(requested, 7, 'two shared branding files are requested only once');
    t.diagnostic(
      `Both modules ready in ${Math.round(performance.now() - started)} ms with 7 image requests still blocked`,
    );
  } finally {
    clearTimeout(timeout);
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else Reflect.deleteProperty(globalThis, 'Image');
  }
});
