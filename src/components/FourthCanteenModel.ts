// 保留同步构造入口供现有离线工具和测试使用；网页通过 indoor-model-loading 按需加载。
import type * as THREE from 'three';
import { fourthCanteenSpec, type IndoorCanteenSpec } from '../data/indoor-canteens';
import { createFourthFifthCanteenModel, type FourthCanteenModel } from './FourthFifthCanteenModel';
import { createFacultyCanteenModel } from './FacultyCanteenModel';
import { createTenthCanteenModel } from './TenthCanteenModel';
import { createSixthCanteenModel } from './SixthCanteenModel';
import { createNinthCanteenModel } from './NinthCanteenModel';
import { createEighthCanteenModel } from './EighthCanteenModel';
import { createMinzuCanteenModel } from './MinzuCanteenModel';
import { createTwelfthCanteenModel } from './TwelfthCanteenModel';
import { createEleventhCanteenModel } from './EleventhCanteenModel';

export { FOURTH_HEIGHTS } from './FourthFifthCanteenModel';
export type { FourthViewMode, FourthCanteenModel } from './FourthFifthCanteenModel';

export function createFourthCanteenModel(loadSignTexture?: (url: string) => THREE.Texture): FourthCanteenModel {
  return createFourthFifthCanteenModel(fourthCanteenSpec, loadSignTexture);
}

export function createCanteenModel(spec: IndoorCanteenSpec, loadFourthSignTexture?: (url: string) => THREE.Texture): FourthCanteenModel {
  if (spec.style === 'faculty') return createFacultyCanteenModel(spec);
  if (spec.style === 'tenth') return createTenthCanteenModel();
  if (spec.style === 'eleventh') return createEleventhCanteenModel(spec);
  if (spec.style === 'twelfth') return createTwelfthCanteenModel(spec);
  if (spec.style === 'ninth') return createNinthCanteenModel(spec);
  if (spec.style === 'minzu') return createMinzuCanteenModel(spec);
  if (spec.style === 'eighth') return createEighthCanteenModel(spec);
  if (spec.style === 'sixth') return createSixthCanteenModel(spec);
  return createFourthFifthCanteenModel(spec, loadFourthSignTexture);
}
