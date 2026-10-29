import type { View } from '../domain';
import type { FourthCanteenModel } from '../components/FourthCanteenModel';
import { getIndoorCanteen } from '../data/indoor-canteens';
import { exteriorBuildings } from '../data/exterior-specs';
import { prepareIndoorModel } from './indoor-model-loading';
import { preloadVenueModelImages } from './model-image-assets';

type ModelFactory = () => FourthCanteenModel;
const services = new Map<string, Promise<ModelFactory>>();

/** 只准备当前导航目标；复用下载和解码任务，不共享可变的模型实例。 */
export function prepareSceneModel(view: Exclude<View, { level: 'campus' }>): Promise<ModelFactory | null> {
  const spec = getIndoorCanteen(view.level === 'floor' ? view.floorId : undefined);
  if (spec) return prepareIndoorModel(spec);
  const id = view.venueId;
  if (!['v-south', 'v-yifu', 'v-hut'].includes(id)) return Promise.resolve(null);
  const existing = services.get(id);
  if (existing) return existing;
  const task = (async (): Promise<ModelFactory> => {
    if (id === 'v-yifu') {
      const [module] = await Promise.all([import('../components/YifuKioskModel'), preloadVenueModelImages(id)]);
      await module.prepareYifuKioskAssets();
      return module.createYifuKioskModel;
    }
    if (id === 'v-hut') {
      const [module] = await Promise.all([import('../components/NinanHutModel'), preloadVenueModelImages(id)]);
      await module.prepareNinanHutAssets();
      return module.createNinanHutModel;
    }
    const module = await import('../components/SouthGateCartModel');
    void module.prepareSouthGateCartAssets().catch(() => {});
    return module.createSouthGateCartModel;
  })().catch((error: unknown) => {
    services.delete(id);
    throw error;
  });
  services.set(id, task);
  return task;
}

/** 与场景引擎并行准备目标资源，适用于直达链接、前进后退与站内导航。 */
export async function preloadSceneRoute(view: View): Promise<void> {
  if (view.level === 'campus') return;
  if (view.level === 'building' && exteriorBuildings[view.venueId]) {
    await exteriorBuildings[view.venueId].load();
  } else {
    await prepareSceneModel(view);
  }
}
