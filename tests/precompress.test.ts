import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { precompress } from '../scripts/precompress.mjs';

test('server sidecars preserve exact source bytes, timestamps and already compressed media', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foodmap-gzip-'));
  try {
    await mkdir(join(root, 'assets'));
    const path = join(root, 'assets', 'model.js');
    const source = Buffer.from('const label = "仙林食光";\n'.repeat(500));
    const media = Buffer.alloc(2048, 123);
    await writeFile(path, source);
    await writeFile(join(root, 'assets', 'photo.jpg'), media);
    await writeFile(join(root, 'index.html'), '<html></html>');
    const before = await stat(path);
    const first = await precompress(root);
    assert.equal(first.files, 1);
    assert.ok(first.compressedBytes < first.originalBytes / 2);
    assert.deepEqual(await readFile(path), source);
    assert.deepEqual(gunzipSync(await readFile(`${path}.gz`)), source);
    assert.ok(Math.abs((await stat(`${path}.gz`)).mtimeMs - before.mtimeMs) < 2);
    assert.deepEqual(await readFile(join(root, 'assets', 'photo.jpg')), media);
    await assert.rejects(stat(join(root, 'assets', 'photo.jpg.gz')), { code: 'ENOENT' });
    await assert.rejects(stat(join(root, 'index.html.gz')), { code: 'ENOENT' });
    assert.deepEqual(await precompress(root), first, 'running again does not compress .gz files recursively');
    await writeFile(path, 'new small version');
    assert.equal((await precompress(root)).files, 0);
    await assert.rejects(stat(`${path}.gz`), { code: 'ENOENT' });
    assert.equal(await readFile(path, 'utf8'), 'new small version');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
