import { createTenthModel } from '../models/tenth-canteen/model.js';
import { loadSignageAssets } from '../models/tenth-canteen/signage.js';
import type { FourthCanteenModel } from './FourthCanteenModel';

export async function prepareTenthCanteenModel() {
  const result = await loadSignageAssets();
  if (!result.complete) throw new Error(`第十食堂牌匾加载失败：${result.missing.join('、')}`);
}
export function createTenthCanteenModel(): FourthCanteenModel {
  const model = createTenthModel();
  // The host owns picking, cards and selection lights; remove standalone hit planes.
  for (const target of [...model.planTargets, ...model.spatialTargets]) {
    target.removeFromParent();
    target.geometry.dispose();
  }
  model.setMode('plan');
  return {
    group: model.group,
    setMode: model.setMode,
    tick: model.tick,
    setInterfaceTheme: () => {},
  };
}
