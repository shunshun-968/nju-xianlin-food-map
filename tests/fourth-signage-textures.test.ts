import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FOURTH_SIGN_ARTWORK } from '../src/assets/fourth-canteen/signs';
import {
  createFourthSignageTexture,
  prepareFourthSignageAssets,
} from '../src/lib/fourth-signage-textures';

test('fourth sign images share preload/decode work, retry failed crops and create model-owned textures', async () => {
  const urls = Object.values(FOURTH_SIGN_ARTWORK).flatMap(({ sign, menu }) => [sign, menu]);
  assert.equal(urls.length, 26);
  assert.equal(new Set(urls).size, 26);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const requests: FakeImage[] = [];

  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = '';
    decodeCalls = 0;
    url = '';
    decoded!: () => void;
    failDecode!: (error: Error) => void;
    private decodedImage = new Promise<void>((resolve, reject) => {
      this.decoded = resolve;
      this.failDecode = reject;
    });

    set src(url: string) {
      this.url = url;
      requests.push(this);
    }

    decode() {
      this.decodeCalls++;
      return this.decodedImage;
    }
  }

  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
  const textures: THREE.Texture[] = [];
  try {
    assert.throws(() => createFourthSignageTexture(urls[0]), /尚未准备/);
    const first = prepareFourthSignageAssets();
    assert.equal(prepareFourthSignageAssets(), first, 'Concurrent callers share one attempt');
    assert.deepEqual(requests.map((image) => image.url).sort(), [...urls].sort());
    assert.ok(requests.every((image) => image.decoding === 'async'));
    const failedAttempt = assert.rejects(first, /牌匾贴图加载失败/);

    // One crop fails to download; another downloads but cannot decode.
    requests[0].onerror!();
    requests.slice(1).forEach((image) => image.onload!());
    assert.ok(requests.slice(1).every((image) => image.decodeCalls === 1));
    await Promise.resolve();
    assert.equal(prepareFourthSignageAssets(), first, 'Do not duplicate still-decoding requests');
    assert.throws(() => createFourthSignageTexture(urls[2]), /尚未准备/);
    requests[1].failDecode(new Error('Invalid WebP'));
    requests.slice(2).forEach((image) => image.decoded());
    await failedAttempt;

    const retry = prepareFourthSignageAssets();
    assert.notEqual(retry, first);
    assert.equal(prepareFourthSignageAssets(), retry);
    assert.equal(requests.length, urls.length + 2, 'Retain all 24 successfully decoded images');
    const retriedImages = requests.slice(urls.length);
    assert.deepEqual(retriedImages.map((image) => image.url).sort(), urls.slice(0, 2).sort());
    retriedImages.forEach((image) => {
      image.onload!();
      image.decoded();
    });
    await retry;
    assert.equal(prepareFourthSignageAssets(), retry);
    assert.equal(requests.length, urls.length + 2);
    assert.ok(requests.every((image) => image.onload === null && image.onerror === null));

    const decoded = requests.findLast((image) => image.url === urls[0]);
    const firstTexture = createFourthSignageTexture(urls[0]);
    const secondTexture = createFourthSignageTexture(urls[0]);
    textures.push(firstTexture, secondTexture);
    assert.notEqual(firstTexture, secondTexture);
    assert.notEqual(firstTexture.source, secondTexture.source);
    for (const texture of textures) {
      assert.equal(texture.image, decoded, 'Preserve the loaded photograph without redrawing it');
      assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
      assert.equal(texture.anisotropy, 8);
      assert.ok(texture.version > 0, 'The new texture is ready for renderer upload');
      assert.equal(texture.userData.sourceUrl, urls[0]);
      assert.equal(texture.userData.originalArtwork, true);
    }
    let secondDisposed = false;
    secondTexture.addEventListener('dispose', () => {
      secondDisposed = true;
    });
    firstTexture.dispose();
    assert.equal(
      secondDisposed,
      false,
      'Disposing one model must not dispose another model texture',
    );
    const replacement = createFourthSignageTexture(urls[0]);
    textures.push(replacement);
    assert.notEqual(replacement, firstTexture);
    assert.equal(replacement.image, decoded);
    assert.throws(() => createFourthSignageTexture('missing-sign.webp'), /尚未准备/);
  } finally {
    textures.forEach((texture) => texture.dispose());
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else Reflect.deleteProperty(globalThis, 'Image');
  }
});
