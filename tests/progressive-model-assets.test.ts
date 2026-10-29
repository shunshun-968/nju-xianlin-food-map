import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ProgressiveModelAssets, setPhotoPixels } from '../src/lib/progressive-model-assets';
import { createModelImageLoader } from '../src/lib/image-assets';

const microtasks = () => new Promise<void>((resolve) => setImmediate(resolve));
function frames() {
  const pending = new Set<() => void>();
  return {
    defer(work: () => void) {
      pending.add(work);
      return () => {
        pending.delete(work);
      };
    },
    tick() {
      const work = [...pending][0];
      if (work) {
        pending.delete(work);
        work();
      }
    },
    get size() {
      return pending.size;
    },
  };
}

test('slow photos do not block independent artwork; uploads are spread across frames and cached', async () => {
  let release!: (image: HTMLImageElement) => void;
  let downloads = 0;
  const fast = {} as HTMLImageElement,
    slow = {} as HTMLImageElement;
  const load = createModelImageLoader((url) => {
    downloads++;
    return url === 'slow'
      ? new Promise((resolve) => {
          release = resolve;
        })
      : Promise.resolve(fast);
  });
  const clock = frames(),
    scope = new ProgressiveModelAssets(load, clock.defer);
  const applied: HTMLImageElement[] = [],
    uploads: THREE.Texture[] = [];
  let failures: number | undefined;
  for (const url of ['slow', 'fast', 'fast'])
    scope.add([url], ([image]) => {
      applied.push(image);
      return new THREE.Texture();
    });
  scope.start(
    (map) => uploads.push(map),
    (count) => {
      failures = count;
    },
  );
  await microtasks();
  assert.equal(applied.length, 0);
  clock.tick();
  assert.deepEqual(applied, [fast]);
  clock.tick();
  assert.deepEqual(applied, [fast, fast]);
  assert.equal(failures, undefined);
  release(slow);
  await microtasks();
  clock.tick();
  assert.equal(failures, 0);
  assert.equal(downloads, 2);
  assert.equal(uploads.length, 3);
  scope.start();
  await microtasks();
  assert.equal(clock.size, 0);
  assert.equal(downloads, 2);
  scope.dispose();
  uploads.forEach((map) => map.dispose());
});

test('exit cancels queued work and stale callbacks; reentry retries failures and resumes cached downloads', async () => {
  let release!: (image: HTMLImageElement) => void;
  let attempts = 0,
    applied = 0;
  const load = createModelImageLoader((url) => {
    if (url === 'bad' && ++attempts === 1) return Promise.reject(new Error('offline'));
    return url === 'slow'
      ? new Promise((resolve) => {
          release = resolve;
        })
      : Promise.resolve({} as HTMLImageElement);
  });
  const clock = frames(),
    scope = new ProgressiveModelAssets(load, clock.defer);
  const map = new THREE.Texture();
  for (const url of ['bad', 'slow'])
    scope.add([url], () => {
      applied++;
      return map;
    });
  scope.start();
  await microtasks();
  scope.pause();
  release({} as HTMLImageElement);
  await microtasks();
  clock.tick();
  assert.equal(applied, 0);
  let failures: number | undefined;
  scope.start(undefined, (count) => {
    failures = count;
  });
  await microtasks();
  assert.equal(clock.size, 1);
  clock.tick();
  clock.tick();
  assert.equal(applied, 2);
  assert.equal(failures, 0);
  assert.equal(attempts, 2);
  scope.dispose();
  map.dispose();
});

test('disposing before decode or before scheduled upload prevents any texture mutation', async () => {
  for (const beforeDecode of [true, false]) {
    let release!: (image: HTMLImageElement) => void;
    const clock = frames();
    const scope = new ProgressiveModelAssets(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      clock.defer,
    );
    scope.add(['photo'], () => {
      throw new Error('disposed model must not update');
    });
    let settled = false;
    scope.start(
      () => assert.fail('no upload'),
      () => {
        settled = true;
      },
    );
    if (beforeDecode) scope.dispose();
    release({} as HTMLImageElement);
    await microtasks();
    if (!beforeDecode) scope.dispose();
    clock.tick();
    scope.start();
    assert.equal(clock.size, 0);
    assert.equal(settled, false);
  }
});

test('replacement releases old GPU allocation before changing Source, preserving texture settings and shared pixels', () => {
  const a = new THREE.Texture(),
    b = new THREE.Texture();
  const original = a.source,
    image = {} as HTMLImageElement;
  let released = false;
  a.colorSpace = THREE.SRGBColorSpace;
  a.anisotropy = 8;
  a.addEventListener('dispose', () => {
    if (!released) assert.equal(a.source, original);
    released = true;
  });
  setPhotoPixels(a, image);
  const version = a.source.version;
  setPhotoPixels(b, image);
  assert.ok(released);
  assert.equal(a.image, image);
  assert.equal(a.source, b.source);
  assert.equal(a.source.version, version, 'second surface must not invalidate uploaded pixels');
  assert.equal(a.anisotropy, 8);
  assert.equal(a.colorSpace, THREE.SRGBColorSpace);
  a.dispose();
  b.dispose();
});
