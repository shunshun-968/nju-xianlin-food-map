import test from 'node:test';
import assert from 'node:assert/strict';
import { createAboutLetterAssetLoader, extractLetterInk } from '../src/lib/about-letter-assets';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('letter stays pending until all paper assets and the transparent ink image are decoded', async () => {
  const texture = deferred<HTMLImageElement>();
  const finalInk = deferred<HTMLImageElement>();
  const inkRequested = deferred<void>();
  const image = {} as HTMLImageElement;
  const requested: string[] = [];
  let prepared = 0;
  const loader = createAboutLetterAssetLoader(
    async (url) => {
      requested.push(url);
      if (url.includes('paper-fiber-original')) return texture.promise;
      if (url === 'data:prepared-ink') {
        inkRequested.resolve();
        return finalInk.promise;
      }
      return image;
    },
    async () => {
      prepared++;
      return 'data:prepared-ink';
    },
  );

  const first = loader.load();
  assert.equal(first, loader.load(), 'Strict Mode and repeated opens share the same task');
  await Promise.resolve();
  assert.equal(prepared, 0);
  assert.equal(loader.peek(), undefined);
  texture.resolve(image);
  await inkRequested.promise;
  assert.equal(loader.peek(), undefined, 'prepared pixels alone must not expose the paper');
  finalInk.resolve(image);
  const ready = await first;
  assert.equal(loader.peek(), ready);
  assert.equal(await loader.load(), ready);
  assert.equal(requested.length, 5, 'four original assets and one prepared ink image');
  assert.equal(prepared, 1);
});

test('failed asset preparation can retry without caching a broken letter', async () => {
  const image = {} as HTMLImageElement;
  let failures = 1;
  let prepared = 0;
  const loader = createAboutLetterAssetLoader(
    async (url) => {
      if (url.includes('handwritten-letter-original') && failures-- > 0) throw Error('offline');
      return image;
    },
    async () => {
      prepared++;
      return 'data:ink';
    },
  );
  await assert.rejects(loader.load(), /offline/);
  assert.equal(loader.peek(), undefined);
  assert.equal(prepared, 0);
  assert.equal((await loader.load()).inkUrl, 'data:ink');
  assert.equal(prepared, 1);
});

test('ink extraction clears the paper, keeps solid strokes and preserves soft edge alpha', () => {
  const pixels = new Uint8ClampedArray([
    255,
    255,
    255,
    255, // white page
    0,
    0,
    0,
    255, // solid ink
    160,
    160,
    160,
    255, // antialiased edge
    0,
    0,
    0,
    0, // transparent source
  ]);
  extractLetterInk(pixels);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[7], 255);
  assert.equal(pixels[11], 125);
  assert.equal(pixels[15], 0);
  assert.ok(pixels[4] > pixels[5] && pixels[5] > pixels[6], 'same warm-black ink');
  const again = new Uint8ClampedArray([0, 0, 0, 255]);
  const repeat = again.slice();
  extractLetterInk(again);
  extractLetterInk(repeat);
  assert.deepEqual(again, repeat, 'pigment does not change on rerenders or theme switches');
});
