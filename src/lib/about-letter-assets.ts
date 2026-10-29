const sources = [
  new URL('../assets/about/handwritten-letter-ink.webp', import.meta.url).href,
  new URL('../assets/about/paper-fiber-original.jpg', import.meta.url).href,
  new URL('../assets/about/paper-edge-mask.svg', import.meta.url).href,
  new URL('../assets/about/paper-wrinkles.svg', import.meta.url).href,
];

export type AboutLetterAssets = { inkUrl: string };

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

export function createAboutLetterAssetLoader(
  loadImage: (url: string) => Promise<HTMLImageElement> = decodeImage,
) {
  let cached: AboutLetterAssets | undefined;
  let pending: Promise<AboutLetterAssets> | undefined;
  return {
    peek: () => cached,
    load() {
      if (pending) return pending;
      pending = Promise.all(sources.map(loadImage))
        .then(() => {
          // 墨迹已离线提取并无损保存；手机只需解码，不在首开时遍历百万像素、编码和再次解码。
          cached = { inkUrl: sources[0] };
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
