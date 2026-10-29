/** 轻量资源清单：点击地点时即可下载，避免等 Three 和模型代码解析完才开始请求图片。 */
const branding = {
  crest: new URL('../assets/branding/南大校徽.png', import.meta.url).href,
  logistics: new URL('../assets/branding/南大后勤.png', import.meta.url).href,
};

export const yifuModelImages = {
  board: new URL('../assets/yifu-kiosk/b102-board.jpg', import.meta.url).href,
  wall: new URL('../assets/yifu-kiosk/west-wall-art.webp', import.meta.url).href,
  ...branding,
};

export const ninanModelImages = {
  breakfast: new URL('../assets/ninan-hut/breakfast-board.webp', import.meta.url).href,
  drinks: new URL('../assets/ninan-hut/drinks-board.webp', import.meta.url).href,
  east: new URL('../assets/ninan-hut/east-reference.webp', import.meta.url).href,
  ...branding,
};

function decodeModelImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().then(() => resolve(image), reject);
      else resolve(image);
    };
    image.onerror = () => reject(new Error(`模型图片加载失败：${url}`));
    image.src = url;
  });
}

/** 预加载和模型初始化共享同一解码任务；失败移除缓存，下次进入可重试。 */
export function createModelImageLoader(
  decode: (url: string) => Promise<HTMLImageElement> = decodeModelImage,
) {
  const pending = new Map<string, Promise<HTMLImageElement>>();
  return (url: string) => {
    const existing = pending.get(url);
    if (existing) return existing;
    const task = Promise.resolve()
      .then(() => decode(url))
      .catch((error: unknown) => {
        pending.delete(url);
        throw error;
      });
    pending.set(url, task);
    return task;
  };
}

export const loadModelImage = createModelImageLoader();

export async function preloadVenueModelImages(venueId: string): Promise<void> {
  const images =
    venueId === 'v-yifu' ? yifuModelImages : venueId === 'v-hut' ? ninanModelImages : null;
  if (images) await Promise.all(Object.values(images).map(loadModelImage));
}
