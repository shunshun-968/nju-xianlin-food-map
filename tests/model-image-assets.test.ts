import test from 'node:test';
import assert from 'node:assert/strict';
import { loadImageAsset, loadModelImage } from '../src/lib/image-assets';
import {
  createModelImageLoader,
  ninanModelImages,
  yifuModelImages,
} from '../src/lib/model-image-assets';

test('navigation preload and model setup share the same image and in-flight decode', async () => {
  let finish!: (image: HTMLImageElement) => void;
  let calls = 0;
  const load = createModelImageLoader(() => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const first = load(yifuModelImages.board);
  assert.equal(load(yifuModelImages.board), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  const image = {} as HTMLImageElement;
  finish(image);
  assert.equal(await first, image);
  assert.equal(await load(yifuModelImages.board), image);
  assert.equal(calls, 1);
  assert.equal(yifuModelImages.crest, ninanModelImages.crest);
  assert.equal(yifuModelImages.logistics, ninanModelImages.logistics);
});

test('failed downloads and decodes are retried without losing other decoded images', async () => {
  const calls = new Map<string, number>();
  const image = {} as HTMLImageElement;
  const load = createModelImageLoader(async (url) => {
    const count = (calls.get(url) ?? 0) + 1;
    calls.set(url, count);
    if (url === 'decode-failure' && count === 1) throw new Error('decode failed');
    return image;
  });
  await load('ready');
  await assert.rejects(load('decode-failure'), /decode failed/);
  assert.equal(await load('decode-failure'), image);
  assert.equal(await load('ready'), image);
  assert.equal(calls.get('decode-failure'), 2);
  assert.equal(calls.get('ready'), 1);
});

test('letter predecode matches normal images while model textures keep anonymous CORS', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const images: FakeImage[] = [];
  class FakeImage {
    crossOrigin: string | null = null;
    decoding = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      images.push(this);
    }
    set src(_url: string) {
      queueMicrotask(() => this.onload?.());
    }
    decode() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else Reflect.deleteProperty(globalThis, 'Image');
  });
  const url = 'test://request-mode';
  const [letter, model] = await Promise.all([loadImageAsset(url), loadModelImage(url)]);
  assert.equal(letter.crossOrigin, null, 'matches the letter <img> and CSS paper background');
  assert.equal(model.crossOrigin, 'anonymous', 'WebGL texture access stays origin-safe');
  assert.notEqual(letter, model, 'request modes have separate bitmap caches');
  assert.equal(await loadImageAsset(url), letter);
  assert.equal(await loadModelImage(url), model);
  assert.equal(images.length, 2, 'each mode reuses its own decoded image on subsequent loads');
});
