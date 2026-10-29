import { createModelImageLoader } from './image-assets';

/** SVG image requests otherwise start only after the complete basemap has mounted. */
export function decodeCampusArtwork(
  url: string,
  createImage: () => HTMLImageElement = () => new Image(),
  timeoutMs = 15_000,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = createImage();
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.crossOrigin = 'anonymous';
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    };
    const timer = setTimeout(() => {
      finish(new Error('建筑图片加载超时'));
      image.src = '';
    }, timeoutMs);
    image.onerror = () => finish(new Error('建筑图片加载失败'));
    image.onload = () => {
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      void decoded.then(
        () => finish(),
        () => finish(new Error('建筑图片解码失败')),
      );
    };
    image.src = url;
  });
}

// Reuse downloads/decoded pixels on React StrictMode, back navigation, and theme switches.
export const loadCampusArtwork = createModelImageLoader(decodeCampusArtwork);
