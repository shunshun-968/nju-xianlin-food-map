import * as THREE from 'three';
import { loadModelImage } from './image-assets';

const sources = new WeakMap<TexImageSource, THREE.Source>();

/** 像素源共用；每个模型仍独立持有、释放自己的纹理与材质。 */
export function textureFromImage(image: TexImageSource): THREE.Texture {
  const texture = new THREE.Texture(image);
  let source = sources.get(image);
  if (!source) {
    source = texture.source;
    sources.set(image, source);
  }
  texture.source = source;
  texture.needsUpdate = true;
  return texture;
}

/** 兼容同步模型构造器：已准备图片直接使用，未完成的非关键贴图继续渐进加载。 */
export function loadModelTexture(
  url: string,
  onLoad?: (texture: THREE.Texture) => void,
): THREE.Texture {
  const image = loadModelImage.peek(url);
  if (image) {
    const texture = textureFromImage(image);
    onLoad?.(texture);
    return texture;
  }
  const texture = new THREE.Texture();
  let disposed = false;
  const onDispose = () => {
    disposed = true;
    texture.removeEventListener('dispose', onDispose);
  };
  texture.addEventListener('dispose', onDispose);
  void loadModelImage(url)
    .then((loaded) => {
      if (disposed) return;
      texture.removeEventListener('dispose', onDispose);
      let source = sources.get(loaded);
      if (!source) {
        source = new THREE.Source(loaded);
        sources.set(loaded, source);
      }
      texture.source = source;
      texture.needsUpdate = true;
      onLoad?.(texture);
    })
    .catch((error: unknown) => {
      if (!disposed) console.error(error);
    });
  return texture;
}
