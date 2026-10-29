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
  let progress = 0;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: number) => {
    progress = next;
    for (const listener of listeners) listener();
  };
  return {
    peek: () => cached,
    getProgress: () => progress,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load() {
      if (pending) return pending;
      const current = ++generation;
      const decoded = new Set<number>();
      publish(0.08);
      pending = Promise.all(
        sources.map(async (url, index) => {
          await loadImage(url);
          if (current !== generation) return;
          decoded.add(index);
          // 真正完成图片解码后才推进；纸纹与墨迹并行，不为播放动画增加等待。
          publish(0.08 + (decoded.has(0) ? 0.5 : 0) + (decoded.has(1) ? 0.32 : 0));
        }),
      )
        .then(() => {
          // 两个 SVG 随 CSS 内联，只有原纸纹与无损墨迹需要网络加载和位图解码。
          cached = { inkUrl: sources[0] };
          publish(1);
          return cached;
        })
        .catch((error: unknown) => {
          // 失败任务里仍在下载的另一张图片不能覆盖重试任务的进度。
          generation += 1;
          pending = undefined;
          publish(0);
          throw error;
        });
      return pending;
    },
  };
}

export const aboutLetterAssets = createAboutLetterAssetLoader();
