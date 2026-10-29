import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModelTexture } from '../src/lib/model-texture-loader';
import { loadModelImage } from '../src/lib/image-assets';

test('late shared image completion cannot revive a disposed model texture', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const requests: FakeImage[] = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 390;
    height = 180;
    set src(_url: string) {
      requests.push(this);
    }
    decode() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
  const url = 'https://example.invalid/texture-ownership-test.png';
  let closedCallbacks = 0,
    liveCallbacks = 0;
  const closed = loadModelTexture(url, () => {
    closedCallbacks++;
  });
  const live = loadModelTexture(url, () => {
    liveCallbacks++;
  });
  try {
    assert.equal(requests.length, 1, 'every model shares the same request and decode');
    closed.dispose();
    requests[0].onload!();
    await loadModelImage(url);
    assert.equal(closed.image, null);
    assert.equal(closedCallbacks, 0);
    assert.equal(live.image, requests[0]);
    assert.equal(liveCallbacks, 1);
    const ready = loadModelTexture(url);
    try {
      assert.notEqual(ready, live);
      assert.equal(ready.source, live.source, 'same decoded pixels share one renderer source');
      live.dispose();
      assert.equal(ready.image, requests[0], 'sibling texture keeps its pixels after disposal');
    } finally {
      ready.dispose();
    }
  } finally {
    closed.dispose();
    live.dispose();
    if (descriptor) Object.defineProperty(globalThis, 'Image', descriptor);
    else Reflect.deleteProperty(globalThis, 'Image');
  }
});
