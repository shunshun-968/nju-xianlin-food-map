import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { extractLetterInk } from './letter-ink';

// 仅在更换原信时离线运行；Sharp 可来自本机工具包，不加入网页运行时依赖。
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const source = fileURLToPath(
  new URL('../../src/assets/about/handwritten-letter-original.jpg', import.meta.url),
);
const target = fileURLToPath(
  new URL('../../src/assets/about/handwritten-letter-ink.webp', import.meta.url),
);
const width = 1010;
const height = 1030;
const input: Buffer = await sharp(source)
  .extract({ left: 34, top: 342, width, height })
  .ensureAlpha()
  .raw()
  .toBuffer();
const pixels = new Uint8ClampedArray(input);
extractLetterInk(pixels);
await sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } })
  .webp({ lossless: true, effort: 6 })
  .toFile(target);
console.log(`Prepared unchanged letter ink: ${target}`);
