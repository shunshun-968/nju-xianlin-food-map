import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCampusArtwork } from '../src/lib/campus-artwork-loading';
import { createModelImageLoader } from '../src/lib/image-assets';
import { getCampusArtworkSources } from '../src/lib/campus-model-artwork';

function fakeImage(decode: () => Promise<void> = async () => {}) {
  return { src: '', onload: null, onerror: null, decode } as unknown as HTMLImageElement;
}

test('campus preparation is shared and waits for decoded pixels, not just downloaded bytes', async () => {
  let finishDecode!: () => void;
  const image = fakeImage(
    () =>
      new Promise((resolve) => {
        finishDecode = resolve;
      }),
  );
  let requests = 0;
  const load = createModelImageLoader((url) => {
    requests++;
    return decodeCampusArtwork(url, () => image);
  });
  const task = load('/campus.webp');
  assert.equal(load('/campus.webp'), task);
  assert.equal(requests, 1);
  assert.equal(image.fetchPriority, 'high');
  assert.equal(image.decoding, 'async');
  assert.equal(image.crossOrigin, 'anonymous');
  assert.equal(image.src, '/campus.webp');
  image.onload!(new Event('load'));
  assert.equal(
    load.peek('/campus.webp'),
    undefined,
    'download is not sufficient to remove the fallback',
  );
  finishDecode();
  assert.equal(await task, image);
  assert.equal(load.peek('/campus.webp'), image);
  assert.equal(await load('/campus.webp'), image);
  assert.equal(requests, 1, 'returning from a model reuses the decoded campus image');
});

test('stalled image is bounded and releases handlers, while a later retry can succeed', async () => {
  const images: HTMLImageElement[] = [];
  const load = createModelImageLoader((url) =>
    decodeCampusArtwork(
      url,
      () => {
        const image = fakeImage();
        images.push(image);
        return image;
      },
      10,
    ),
  );
  await assert.rejects(load('/slow.webp'), /超时/);
  assert.equal(images[0].src, '');
  assert.equal(images[0].onload, null);
  assert.equal(images[0].onerror, null);
  assert.equal(load.peek('/slow.webp'), undefined);
  const retry = load('/slow.webp');
  images[1].onload!(new Event('load'));
  assert.equal(await retry, images[1]);
});

test('network and decoding errors settle for fallback instead of leaving progress stuck', async () => {
  const network = fakeImage();
  const unavailable = decodeCampusArtwork('/missing.webp', () => network);
  network.onerror!(new Event('error'));
  await assert.rejects(unavailable, /加载失败/);
  const corrupt = fakeImage(async () => {
    throw new Error('bad pixels');
  });
  const undecodable = decodeCampusArtwork('/corrupt.webp', () => corrupt);
  corrupt.onload!(new Event('load'));
  await assert.rejects(undecodable, /解码失败/);
});

test('campus preloads one theme only and includes all seven interactive venues', () => {
  const day = getCampusArtworkSources(false);
  const night = getCampusArtworkSources(true);
  assert.equal(day.length, 7);
  assert.deepEqual(
    day.map(({ id }) => id),
    night.map(({ id }) => id),
  );
  assert.ok(day.every(({ href }) => href.endsWith('-day.webp')));
  assert.ok(night.every(({ href }) => href.endsWith('-night.webp')));
});
