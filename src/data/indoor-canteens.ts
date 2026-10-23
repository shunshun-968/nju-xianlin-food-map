import {
  FOURTH_CANTEEN_FLOOR_ID,
  FOURTH_LAYOUT,
  fourthCanteenFaces,
  type FourthCanteenFace,
} from './fourth-canteen';
import { FIFTH_CANTEEN_FLOOR_ID, FIFTH_LAYOUT, fifthCanteenFaces } from './fifth-canteen';
import { SIXTH_CANTEEN_FLOOR_ID, SIXTH_LAYOUT, sixthCanteenFaces } from './sixth-canteen';

export type IndoorCanteenFace = FourthCanteenFace & {
  windowNumbers?: number[];
  screenTexts?: string[];
  kitchenBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  enclosed?: boolean;
  pickup?: boolean;
  displayOnly?: boolean;
};
export type IndoorCanteenSpec = {
  id: string;
  name: string;
  faces: IndoorCanteenFace[];
  style: 'fourth' | 'fifth' | 'sixth';
  showWindowNumbers?: boolean;
  layout: typeof FOURTH_LAYOUT;
  cornerShopId: string;
  cornerTitle: string;
  cornerSubtitle: string;
  description: string;
  stage: { width: number; depth: number; x: number; z: number };
  frame: { x: number; z: number; planRange: number; spatialRange: number; halfWidth: number };
};

export const fourthCanteenSpec: IndoorCanteenSpec = {
  id: FOURTH_CANTEEN_FLOOR_ID,
  name: '第四食堂',
  faces: fourthCanteenFaces,
  style: 'fourth',
  layout: FOURTH_LAYOUT,
  cornerShopId: 'maijindi',
  cornerTitle: '麦金地',
  cornerSubtitle: '优品麦选 · 酱香醇厚',
  description: 'L 形布局，共 13 个牌坊面、24 个窗口。优品麦选与酱香醇厚属于麦金地同一家转角店。',
  stage: { width: 45, depth: 21, x: -0.5, z: 3 },
  frame: { x: -1, z: 3, planRange: 12, spatialRange: 15.5, halfWidth: 23 },
};

export const fifthCanteenSpec: IndoorCanteenSpec = {
  id: FIFTH_CANTEEN_FLOOR_ID,
  name: '第五食堂',
  faces: fifthCanteenFaces,
  style: 'fifth',
  layout: FIFTH_LAYOUT,
  cornerShopId: 'nanzhou-shuijiao',
  cornerTitle: '南粥北面',
  cornerSubtitle: '手工·水饺 · 同店转角',
  description:
    'L 形布局，共 8 个牌坊面、21 个窗口。南粥北面与手工水饺共用转角店铺，保留 1—21 号实际窗口编号。',
  stage: { width: 38, depth: 18, x: -3.5, z: 3 },
  frame: { x: -3.5, z: 3, planRange: 10.5, spatialRange: 14, halfWidth: 19.5 },
};

export const sixthCanteenSpec: IndoorCanteenSpec = {
  id: SIXTH_CANTEEN_FLOOR_ID,
  name: '第六食堂',
  faces: sixthCanteenFaces,
  style: 'sixth',
  layout: SIXTH_LAYOUT,
  showWindowNumbers: false,
  cornerShopId: 'jinling-kitchen',
  cornerTitle: '金陵小厨',
  cornerSubtitle: '主窗口 · 转角玻璃窗 · 侧面取餐口',
  description:
    '共 20 个窗口，包含金陵小厨转角玻璃窗。金陵小厨转角玻璃窗与侧面取餐口属于同一长厨房，淮扬菜品主面两窗、侧面一窗。',
  stage: { width: 45, depth: 22, x: -0.5, z: 1 },
  frame: { x: -1, z: 1, planRange: 12, spatialRange: 15.5, halfWidth: 23 },
};

export function getIndoorCanteen(floorId: string | undefined): IndoorCanteenSpec | undefined {
  if (floorId === FOURTH_CANTEEN_FLOOR_ID) return fourthCanteenSpec;
  if (floorId === FIFTH_CANTEEN_FLOOR_ID) return fifthCanteenSpec;
  if (floorId === SIXTH_CANTEEN_FLOOR_ID) return sixthCanteenSpec;
  return undefined;
}
