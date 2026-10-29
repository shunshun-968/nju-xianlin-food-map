/** 轻量资源清单：点击地点时即可下载，避免等 Three 和模型代码解析完才开始请求图片。 */
const branding = {
  crest: new URL('../assets/branding/南大校徽.png', import.meta.url).href,
  logistics: new URL('../assets/branding/南大后勤.png', import.meta.url).href,
};

export const yifuModelImages = {
  board: new URL('../assets/yifu-kiosk/b102-board-surface.jpg', import.meta.url).href,
  wall: new URL('../assets/yifu-kiosk/west-wall-art.webp', import.meta.url).href,
  ...branding,
};

export const ninanModelImages = {
  breakfast: new URL('../assets/ninan-hut/breakfast-board.webp', import.meta.url).href,
  drinks: new URL('../assets/ninan-hut/drinks-board.webp', import.meta.url).href,
  east: new URL('../assets/ninan-hut/east-posters.webp', import.meta.url).href,
  ...branding,
};

export { createModelImageLoader, loadModelImage } from './image-assets';
import { loadModelImage } from './image-assets';

export async function preloadVenueModelImages(venueId: string): Promise<void> {
  const images =
    venueId === 'v-yifu' ? yifuModelImages : venueId === 'v-hut' ? ninanModelImages : null;
  if (images) await Promise.all(Object.values(images).map(loadModelImage));
}
