import { modelPhase } from './scene-performance';
/** 全站图片共用下载与解码任务；不依赖 Three，也不包含任何场所的资源清单。 */
function decodeImage(
  url: string,
  crossOrigin: 'anonymous' | null = 'anonymous',
): Promise<HTMLImageElement> {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    if (crossOrigin) image.crossOrigin = crossOrigin;
    const clear = () => {
      image.onload = null;
      image.onerror = null;
    };
    image.onerror = () => {
      clear();
      reject(new Error(`图片加载失败：${url}`));
    };
    image.onload = () => {
      modelPhase('image', 'download', started, { url });
      const decodeStarted = performance.now();
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      void decoded.then(
        () => {
          modelPhase('image', 'decode', decodeStarted, { url });
          clear();
          resolve(image);
        },
        (error: unknown) => {
          clear();
          reject(error);
        },
      );
    };
    image.src = url;
  });
}

export function createModelImageLoader(
  decode: (url: string) => Promise<HTMLImageElement> = decodeImage,
) {
  const pending = new Map<string, Promise<HTMLImageElement>>();
  const ready = new Map<string, HTMLImageElement>();
  const load = (url: string) => {
    const existing = pending.get(url);
    if (existing) return existing;
    // 立即启动网络，让图片传输与当前模型的同步构建重叠。
    let decoding: Promise<HTMLImageElement>;
    try {
      decoding = decode(url);
    } catch (error) {
      decoding = Promise.reject(error);
    }
    const task = decoding
      .then((image) => {
        ready.set(url, image);
        return image;
      })
      .catch((error: unknown) => {
        pending.delete(url);
        throw error;
      });
    pending.set(url, task);
    return task;
  };
  return Object.assign(load, { peek: (url: string) => ready.get(url) });
}

export const loadModelImage = createModelImageLoader();
// 普通 <img> 与 CSS 背景默认使用 no-CORS；预解码也使用同一请求模式，
// 才能复用已准备好的位图，避免显示信纸时再次请求。WebGL 材质仍保持匿名 CORS。
export const loadImageAsset = createModelImageLoader((url) => decodeImage(url, null));

export async function prepareImages(urls: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(urls)].map(loadModelImage));
}
