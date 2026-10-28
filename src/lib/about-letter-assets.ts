const sources = [
  new URL('../assets/about/handwritten-letter-original.jpg', import.meta.url).href,
  new URL('../assets/about/paper-fiber-original.jpg', import.meta.url).href,
  new URL('../assets/about/paper-edge-mask.svg', import.meta.url).href,
  new URL('../assets/about/paper-wrinkles.svg', import.meta.url).href,
];

export type AboutLetterAssets = { inkUrl: string };

/** 沿用原 SVG 的墨迹 alpha，不收细、不重画；只给暖黑墨色添加固定的微小变化。 */
export function extractLetterInk(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha =
      Math.max(
        0,
        Math.min(1, 3 - (1.33 * pixels[i] + 1.34 * pixels[i + 1] + 1.33 * pixels[i + 2]) / 255),
      ) * pixels[i + 3];
    const noise = 0.4 + (0.2 * ((Math.imul(i + 31, 1103515245) >>> 16) & 255)) / 255;
    pixels[i] = (0.12 + 0.06 * noise) * 255;
    pixels[i + 1] = (0.09 + 0.05 * noise) * 255;
    pixels[i + 2] = (0.065 + 0.04 * noise) * 255;
    pixels[i + 3] = alpha;
  }
}

function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().then(() => resolve(image), reject);
      else resolve(image);
    };
    image.onerror = () => reject(new Error('信件图片加载失败'));
    image.src = url;
  });
}

async function renderInk(original: HTMLImageElement) {
  // 先让“加载中”完成一帧绘制，再做一次性的像素处理。
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const canvas = document.createElement('canvas');
  canvas.width = 1010;
  canvas.height = 1030;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('无法准备手写信');
  // 与之前的 viewBox 完全相同，正文、名单、日期和署名均在此范围内。
  context.drawImage(original, 34, 342, 1010, 1030, 0, 0, 1010, 1030);
  const ink = context.getImageData(0, 0, canvas.width, canvas.height);
  extractLetterInk(ink.data);
  context.putImageData(ink, 0, 0);
  return canvas.toDataURL('image/png');
}

export function createAboutLetterAssetLoader(
  loadImage: (url: string) => Promise<HTMLImageElement> = decodeImage,
  prepareInk: (image: HTMLImageElement) => Promise<string> = renderInk,
) {
  let cached: AboutLetterAssets | undefined;
  let pending: Promise<AboutLetterAssets> | undefined;
  return {
    peek: () => cached,
    load() {
      if (pending) return pending;
      pending = Promise.all(sources.map(loadImage))
        .then(async ([original]) => {
          const inkUrl = await prepareInk(original);
          // 连透明笔迹 PNG 也完成解码以后才允许显示纸面。
          await loadImage(inkUrl);
          cached = { inkUrl };
          return cached;
        })
        .catch((error: unknown) => {
          pending = undefined;
          throw error;
        });
      return pending;
    },
  };
}

export const aboutLetterAssets = createAboutLetterAssetLoader();
