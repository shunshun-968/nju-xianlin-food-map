import * as THREE from 'three';
import { FOURTH_SIGN_ARTWORK } from '../assets/fourth-canteen/signs';

const urls = [
  ...new Set(Object.values(FOURTH_SIGN_ARTWORK).flatMap(({ sign, menu }) => [sign, menu])),
];
// Images are reusable CPU assets. Every model owns and disposes its own GPU textures.
const images = new Map<string, HTMLImageElement>();
let preparing: Promise<void> | undefined;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    const clearHandlers = () => {
      image.onload = null;
      image.onerror = null;
    };
    image.onerror = () => {
      clearHandlers();
      reject(new Error(`第四食堂牌匾贴图无法加载：${url}`));
    };
    image.onload = () => {
      // Loading bytes alone is insufficient: await decoding before the host compiles the model.
      void image.decode().then(
        () => {
          clearHandlers();
          resolve(image);
        },
        () => {
          clearHandlers();
          reject(new Error(`第四食堂牌匾贴图无法解码：${url}`));
        },
      );
    };
    image.src = url;
  });
}

/** Preload all sign/menu crops once; concurrent callers share the same attempt.
 * Wait for every request to settle before allowing a retry, retaining successful images.
 */
export function prepareFourthSignageAssets(): Promise<void> {
  if (preparing) return preparing;
  const missing = urls.filter((url) => !images.has(url));
  preparing = Promise.allSettled(
    missing.map(async (url) => {
      images.set(url, await loadImage(url));
    }),
  )
    .then((results) => {
      const failures = results.flatMap((result, index) =>
        result.status === 'rejected' ? [missing[index]] : [],
      );
      if (failures.length) throw new Error(`第四食堂牌匾贴图加载失败：${failures.join('、')}`);
    })
    .catch((error: unknown) => {
      preparing = undefined;
      throw error;
    });
  return preparing;
}

/** Create a model-owned texture without copying or redrawing the photographed pixels. */
export function createFourthSignageTexture(url: string): THREE.Texture {
  const image = images.get(url);
  if (!image) throw new Error(`第四食堂牌匾贴图尚未准备：${url}`);
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  texture.userData = { originalArtwork: true, sourceUrl: url };
  return texture;
}
