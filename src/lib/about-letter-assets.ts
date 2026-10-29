import { loadImageAsset } from './image-assets';

const sources = [
  new URL('../assets/about/handwritten-letter-ink.webp', import.meta.url).href,
  new URL('../assets/about/paper-fiber-runtime.jpg', import.meta.url).href,
];

export type AboutLetterAssets = { inkUrl: string };

export function createAboutLetterAssetLoader(
  loadImage: (url: string) => Promise<HTMLImageElement> = loadImageAsset,
) {
  let cached: AboutLetterAssets | undefined;
  let pending: Promise<AboutLetterAssets> | undefined;
  return {
    peek: () => cached,
    load() {
      if (pending) return pending;
      pending = Promise.all(sources.map(loadImage))
        .then(() => {
          // 两个 SVG 随 CSS 内联，只有原纸纹与无损墨迹需要网络加载和位图解码。
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
