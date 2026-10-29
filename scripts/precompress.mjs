import { readdir, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

const compress = promisify(gzip);
const textTypes = new Set(['.html', '.js', '.css', '.json', '.geojson', '.svg', '.wasm']);

/** 原文件保持不动；仅为自托管 Nginx 生成可协商的无损 gzip 副本。 */
export async function precompress(root) {
  const result = { files: 0, originalBytes: 0, compressedBytes: 0 };
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) { await visit(path); continue; }
      if (!entry.isFile() || !textTypes.has(extname(path))) continue;
      const source = await readFile(path);
      if (source.length < 1024) { await rm(`${path}.gz`, { force: true }); continue; }
      const compressed = await compress(source, { level: 9 });
      if (compressed.length >= source.length) { await rm(`${path}.gz`, { force: true }); continue; }
      const metadata = await stat(path);
      await writeFile(`${path}.gz`, compressed);
      await utimes(`${path}.gz`, metadata.atime, metadata.mtime);
      result.files++;
      result.originalBytes += source.length;
      result.compressedBytes += compressed.length;
    }
  }
  await visit(root);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(await precompress(resolve(process.argv[2] || 'dist')), null, 2));
