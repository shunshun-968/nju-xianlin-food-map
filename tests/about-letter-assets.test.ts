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
      (url) =>
        !url.includes('handwritten-letter-original') &&
        !url.endsWith('.svg') &&
        !url.startsWith('data:'),
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

test('letter progress follows decoded assets and cached opens need no loading phase', async () => {
  const paper = deferred<HTMLImageElement>();
  const ink = deferred<HTMLImageElement>();
  const image = {} as HTMLImageElement;
  const loader = createAboutLetterAssetLoader((url) =>
    url.includes('paper-fiber-runtime') ? paper.promise : ink.promise,
  );
  const updates: number[] = [];
  const unsubscribe = loader.subscribe(() => updates.push(loader.getProgress()));
  const loading = loader.load();
  assert.equal(loader.getProgress(), 0.08);
  paper.resolve(image);
  await Promise.resolve();
  assert.equal(loader.getProgress(), 0.4, 'decoded paper advances to writing');
  assert.equal(loader.peek(), undefined, 'ink still needs decoding');
  ink.resolve(image);
  await loading;
  assert.equal(loader.getProgress(), 1);
  assert.ok(
    updates.some((value) => value >= 0.85 && value < 1),
    'both images reach signing',
  );
  assert.ok(updates.every((value, index) => index === 0 || value >= updates[index - 1]));
  const updateCount = updates.length;
  const ready = loader.peek();
  assert.ok(ready, 'a reopened dialog can render cached pixels immediately');
  assert.equal(await loader.load(), ready);
  assert.equal(updates.length, updateCount, 'cached opens never reset the progress animation');
  unsubscribe();
});

test('an unfinished asset from a failed load cannot change the retry progress', async () => {
  const stalePaper = deferred<HTMLImageElement>();
  const retryPaper = deferred<HTMLImageElement>();
  const retryInk = deferred<HTMLImageElement>();
  const image = {} as HTMLImageElement;
  let attempt = 0;
  const loader = createAboutLetterAssetLoader((url) => {
    if (url.includes('handwritten-letter-ink')) {
      attempt += 1;
      return attempt === 1 ? Promise.reject(new Error('offline')) : retryInk.promise;
    }
    return attempt === 1 ? stalePaper.promise : retryPaper.promise;
  });
  await assert.rejects(loader.load(), /offline/);
  assert.equal(loader.getProgress(), 0);
  const retry = loader.load();
  stalePaper.resolve(image);
  await Promise.resolve();
  assert.equal(loader.getProgress(), 0.08, 'only the current attempt can advance progress');
  retryInk.resolve(image);
  retryPaper.resolve(image);
  await retry;
  assert.equal(loader.getProgress(), 1);
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
