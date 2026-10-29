/** 全站图片共用下载与解码任务；不依赖 Three，也不包含任何场所的资源清单。 */
function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    const clear = () => {
      image.onload = null;
      image.onerror = null;
    };
    image.onerror = () => {
      clear();
      reject(new Error(`图片加载失败：${url}`));
    };
    image.onload = () => {
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      void decoded.then(
        () => {
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
export const loadImageAsset = loadModelImage;

export async function prepareImages(urls: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(urls)].map(loadModelImage));
}
