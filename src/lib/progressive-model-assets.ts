import * as THREE from 'three';
import { loadModelImage } from './image-assets';

type Job = {
  urls: string[];
  apply: ((images: HTMLImageElement[]) => THREE.Texture) | null;
  done: boolean;
};
type Schedule = (work: () => void) => () => void;
/** 每帧最多处理一张贴图，并让浏览器先绘制上一帧；取消时同时清除 RAF 和定时器。 */
const schedule: Schedule = (work) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(work, 0);
  });
  return () => {
    cancelAnimationFrame(frame);
    if (timer !== undefined) clearTimeout(timer);
  };
};

/** 每个模型独立持有更新队列；下载/解码复用全站缓存，不持有共享 GPU 纹理。 */
export class ProgressiveModelAssets {
  private jobs: Job[] = [];
  private generation = 0;
  private disposed = false;
  private cancelFrame?: () => void;
  private callbacks?: {
    upload: (texture: THREE.Texture) => void;
    settled: (failures: number) => void;
  };
  constructor(
    private load: (url: string) => Promise<HTMLImageElement> = loadModelImage,
    private defer: Schedule = schedule,
  ) {}
  add(urls: string[], apply: NonNullable<Job['apply']>) {
    this.jobs.push({ urls, apply, done: false });
  }
  start(
    upload: (texture: THREE.Texture) => void = () => {},
    settled: (failures: number) => void = () => {},
  ) {
    this.pause();
    if (this.disposed) return;
    this.callbacks = { upload, settled };
    const generation = this.generation;
    const active = () => !this.disposed && generation === this.generation;
    const waiting = this.jobs.filter((job) => !job.done);
    const queue: { job: Job; images: HTMLImageElement[] }[] = [];
    let remaining = waiting.length,
      failures = 0;
    const finish = () => {
      if (--remaining === 0 && active()) {
        const complete = this.callbacks?.settled;
        this.callbacks = undefined;
        complete?.(failures);
      }
    };
    const drain = () => {
      if (!active() || this.cancelFrame || !queue.length) return;
      this.cancelFrame = this.defer(() => {
        this.cancelFrame = undefined;
        if (!active()) return;
        const { job, images } = queue.shift()!;
        try {
          this.callbacks?.upload(job.apply!(images));
          job.done = true;
          job.apply = null;
        } catch {
          failures++;
        }
        finish();
        drain();
      });
    };
    if (!remaining) {
      const complete = this.callbacks?.settled;
      this.callbacks = undefined;
      complete?.(0);
      return;
    }
    for (const job of waiting) {
      void Promise.all(job.urls.map((url) => this.load(url))).then(
        (images) => {
          if (!active()) return;
          queue.push({ job, images });
          drain();
        },
        () => {
          if (active()) {
            failures++;
            finish();
          }
        },
      );
    }
  }
  pause() {
    this.generation++;
    this.callbacks = undefined;
    this.cancelFrame?.();
    this.cancelFrame = undefined;
  }
  dispose() {
    this.pause();
    this.disposed = true;
    // 即使网络永不返回，未完成的 Promise 也不再通过回调持有已销毁模型的材质/纹理。
    for (const job of this.jobs) job.apply = null;
    this.jobs = [];
  }
}

const scopes = new WeakMap<THREE.Group, ProgressiveModelAssets>();
export function attachModelAssets(group: THREE.Group) {
  const assets = new ProgressiveModelAssets();
  scopes.set(group, assets);
  return assets;
}
export const modelAssets = (group: THREE.Group) => scopes.get(group);

const sources = new WeakMap<object, THREE.Source>();
export function setPhotoPixels(map: THREE.Texture, image: TexImageSource) {
  let source = sources.get(image);
  if (!source) {
    source = new THREE.Source(image);
    source.needsUpdate = true;
    sources.set(image, source);
  }
  // WebGL 的已分配纹理尺寸不能从 1×1 直接改为照片尺寸。先释放旧 GPU 分配，
  // 保持材质引用的 Texture 对象，再绑定新的共享 Source。
  map.dispose();
  map.source = source;
  // 像素源已解码且不再变化；只更新此纹理版本，避免同照片的第二块牌重复上传。
  map.version++;
  return map;
}
export function photoPlaceholder(color: string | null) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  if (color) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
  }
  // 使用普通 Texture，让高清替换前后保持相同采样器、色彩空间和材质编译分支。
  const map = new THREE.Texture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.needsUpdate = true;
  return map;
}
