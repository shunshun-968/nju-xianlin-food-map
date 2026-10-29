import * as THREE from 'three';
import { loadModelImage } from './image-assets';
import { textureFromImage } from './model-texture-loader';
import { FOURTH_SIGN_ARTWORK } from '../assets/fourth-canteen/signs';

const urls = [
  ...new Set(Object.values(FOURTH_SIGN_ARTWORK).flatMap(({ sign, menu }) => [sign, menu])),
];
// Images are reusable CPU assets. Every model owns and disposes its own GPU textures.
const images = new Map<string, HTMLImageElement>();
let preparing: Promise<void> | undefined;

/** Preload all sign/menu crops once; concurrent callers share the same attempt.
 * Wait for every request to settle before allowing a retry, retaining successful images.
 */
export function prepareFourthSignageAssets(): Promise<void> {
  if (preparing) return preparing;
  const missing = urls.filter((url) => !images.has(url));
  preparing = Promise.allSettled(
    missing.map(async (url) => {
      images.set(url, await loadModelImage(url));
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
  const texture = textureFromImage(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  texture.userData = { originalArtwork: true, sourceUrl: url };
  return texture;
}
