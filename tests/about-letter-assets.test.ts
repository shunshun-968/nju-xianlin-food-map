import test from 'node:test';
import assert from 'node:assert/strict';
import { createAboutLetterAssetLoader } from '../src/lib/about-letter-assets';
import { extractLetterInk } from '../scripts/assets/letter-ink';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('letter waits for both raster images, while inline paper SVGs require no image requests', async () => {
  const texture = deferred<HTMLImageElement>();
  const finalInk = deferred<HTMLImageElement>();
  const inkRequested = deferred<void>();
  const image = {} as HTMLImageElement;
  const requested: string[] = [];
  const loader = createAboutLetterAssetLoader(async (url) => {
    requested.push(url);
    if (url.includes('paper-fiber-runtime')) return texture.promise;
    if (url.includes('handwritten-letter-ink')) {
      inkRequested.resolve();
      return finalInk.promise;
    }
    return image;
  });

  const first = loader.load();
  assert.equal(first, loader.load(), 'Strict Mode and repeated opens share the same task');
  await Promise.resolve();
  assert.equal(loader.peek(), undefined);
  await inkRequested.promise;
  assert.ok(
    requested.some((url) => url.includes('paper-fiber-runtime')),
    'ink and paper load in parallel',
  );
  texture.resolve(image);
  await Promise.resolve();
  assert.equal(loader.peek(), undefined, 'prepared pixels alone must not expose the paper');
  finalInk.resolve(image);
  const ready = await first;
  assert.equal(loader.peek(), ready);
  assert.equal(await loader.load(), ready);
  assert.equal(
    requested.length,
    2,
    'only the paper photograph and transparent ink, with no separate SVG requests',
  );
  assert.ok(
    requested.every(
      (url) => !url.includes('handwritten-letter-original') && !url.endsWith('.svg') && !url.startsWith('data:'),
    ),
  );
});

test('failed asset preparation can retry without caching a broken letter', async () => {
  const image = {} as HTMLImageElement;
  let failures = 1;
  const loader = createAboutLetterAssetLoader(async (url) => {
    if (url.includes('handwritten-letter-ink') && failures-- > 0) throw Error('offline');
    return image;
  });
  await assert.rejects(loader.load(), /offline/);
  assert.equal(loader.peek(), undefined);
  assert.match((await loader.load()).inkUrl, /handwritten-letter-ink\.webp/);
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
