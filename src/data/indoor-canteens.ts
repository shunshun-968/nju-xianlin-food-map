import {
  FOURTH_CANTEEN_FLOOR_ID,
  FOURTH_LAYOUT,
  fourthCanteenFaces,
  type FourthCanteenFace,
} from './fourth-canteen';
import { FIFTH_CANTEEN_FLOOR_ID, FIFTH_LAYOUT, fifthCanteenFaces } from './fifth-canteen';
import { SIXTH_CANTEEN_FLOOR_ID, SIXTH_LAYOUT, sixthCanteenFaces } from './sixth-canteen';
import { EIGHTH_CANTEEN_FLOOR_ID, EIGHTH_LAYOUT, eighthCanteenFaces } from './eighth-canteen';
import { MINZU_CANTEEN_FLOOR_ID, MINZU_LAYOUT, minzuCanteenFaces } from './minzu-canteen';

export type IndoorCanteenFace = FourthCanteenFace & {
  windowNumbers?: number[];
  windowLabels?: string[];
  windowSignNames?: string[][];
  shopIds?: string[];
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
  style: 'fourth' | 'fifth' | 'sixth' | 'eighth' | 'minzu';
  showWindowNumbers?: boolean;
  facadeHeight?: number;
  layout: { frontOffset: number; kitchenDepth: number; corner: { x: number; z: number } };
  cornerShopId: string;
  cornerTitle: string;
  cornerSubtitle: string;
  description: string;
  stage: { width: number; depth: number; x: number; z: number };
  frame: {
    x: number;
    z: number;
    planRange: number;
    spatialRange: number;
    halfWidth: number;
    spatialOffset?: { x: number; y: number; z: number };
  };
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

export const eighthCanteenSpec: IndoorCanteenSpec = {
  id: EIGHTH_CANTEEN_FLOOR_ID,
  name: '第八食堂',
  faces: eighthCanteenFaces,
  style: 'eighth',
  layout: EIGHTH_LAYOUT,
  cornerShopId: 'eighth-corner-kitchen',
  cornerTitle: '面坊 · 美食',
  cornerSubtitle: '转角窗口',
  description:
    '按手绘图与现场照片建立的 L 形布局：14 个窗口及独立水饺超市。牌坊与实际售卖分别标注；3 号餐品待补充，12 号暂无售卖。尺寸为示意比例。',
  stage: { width: 38, depth: 20, x: 0, z: 2 },
  frame: {
    x: 0,
    z: 2.2,
    planRange: 10.5,
    spatialRange: 13,
    halfWidth: 20,
    spatialOffset: { x: 25, y: 22, z: 36 },
  },
};

export const minzuCanteenSpec: IndoorCanteenSpec = {
  id: MINZU_CANTEEN_FLOOR_ID,
  name: '民族食堂',
  faces: minzuCanteenFaces,
  style: 'minzu',
  facadeHeight: 4.5,
  layout: MINZU_LAYOUT,
  cornerShopId: 'minzu-corner',
  cornerTitle: '民族风味 · 边陲风情',
  cornerSubtitle: '转角窗口',
  description:
    '按现场照片与手绘位置建立的 L 形布局，共 10 个编号窗口。保留原牌匾字形；3、5 号跨牌匾分界，8—10 号均可购买自选菜，8 号设暖心早餐窗口。尺寸为示意比例。',
  stage: { width: 22, depth: 30, x: -1, z: -3.75 },
  frame: {
    x: -1,
    z: -3.75,
    planRange: 15.5,
    spatialRange: 18,
    halfWidth: 11.5,
    spatialOffset: { x: -26, y: 28, z: 35 },
  },
};

/** Sign labels and operating groups are independent from the physical opening number. */
export function getIndoorWindow(spec: IndoorCanteenSpec | undefined, stallId: string) {
  const face = spec?.faces.find((row) => row.faceId === stallId.replace(/-w\d+$/, ''));
  const index = Number(stallId.match(/-w(\d+)$/)?.[1]) - 1;
  if (!face?.windowLabels || !Number.isInteger(index) || index < 0 || index >= face.windowCount)
    return undefined;
  return {
    face,
    windowNumber: face.windowNumbers?.[index] ?? index + 1,
    offering: face.windowLabels[index],
    signName: (face.windowSignNames?.[index] ?? [face.name]).join('／'),
    shopId: face.shopIds?.[index] ?? stallId,
  };
}

export function getIndoorCanteen(floorId: string | undefined): IndoorCanteenSpec | undefined {
  if (floorId === FOURTH_CANTEEN_FLOOR_ID) return fourthCanteenSpec;
  if (floorId === FIFTH_CANTEEN_FLOOR_ID) return fifthCanteenSpec;
  if (floorId === SIXTH_CANTEEN_FLOOR_ID) return sixthCanteenSpec;
  if (floorId === EIGHTH_CANTEEN_FLOOR_ID) return eighthCanteenSpec;
  if (floorId === MINZU_CANTEEN_FLOOR_ID) return minzuCanteenSpec;
  return undefined;
}
