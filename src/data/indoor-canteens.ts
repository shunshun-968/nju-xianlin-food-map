import {
  FOURTH_CANTEEN_FLOOR_ID,
  FOURTH_LAYOUT,
  fourthCanteenFaces,
  type FourthCanteenFace,
} from './fourth-canteen';
import { FIFTH_CANTEEN_FLOOR_ID, FIFTH_LAYOUT, fifthCanteenFaces } from './fifth-canteen';
import { SIXTH_CANTEEN_FLOOR_ID, SIXTH_LAYOUT, sixthCanteenFaces } from './sixth-canteen';
import { NINTH_CANTEEN_FLOOR_ID, NINTH_LAYOUT, ninthCanteenFaces } from './ninth-canteen';
import { EIGHTH_CANTEEN_FLOOR_ID, EIGHTH_LAYOUT, eighthCanteenFaces } from './eighth-canteen';
import { MINZU_CANTEEN_FLOOR_ID, MINZU_LAYOUT, minzuCanteenFaces } from './minzu-canteen';
import { TWELFTH_CANTEEN_FLOOR_ID, TWELFTH_LAYOUT, twelfthCanteenFaces } from './twelfth-canteen';
import {
  ELEVENTH_CANTEEN_FLOOR_ID,
  ELEVENTH_LAYOUT,
  eleventhCanteenFaces,
} from './eleventh-canteen';

import { TENTH_CANTEEN_FLOOR_ID, TENTH_LAYOUT, tenthCanteenFaces } from './tenth-canteen';

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
  style:
    'fourth' | 'fifth' | 'sixth' | 'eighth' | 'minzu' | 'ninth' | 'twelfth' | 'eleventh' | 'tenth';
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
  showWindowNumbers: false,
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

export const ninthCanteenSpec: IndoorCanteenSpec = {
  id: NINTH_CANTEEN_FLOOR_ID,
  name: '第九食堂',
  faces: ninthCanteenFaces,
  style: 'ninth',
  showWindowNumbers: false,
  layout: NINTH_LAYOUT,
  cornerShopId: 'yue-qing-he',
  cornerTitle: '悦轻荷',
  cornerSubtitle: '自选轻餐 · 连续转角柜台',
  description:
    '两排店面相向，中间为就餐区。11 家店铺按连续售餐区点选；悦轻荷为同店转角，左左香柜台位于内凹区域后端。尺寸依照片与草图按比例示意。',
  stage: { width: 48, depth: 38, x: 0, z: -2 },
  frame: {
    x: -1,
    z: -2,
    planRange: 20.5,
    spatialRange: 21,
    halfWidth: 25,
    spatialOffset: { x: -31, y: 32, z: 40 },
  },
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

export const twelfthCanteenSpec: IndoorCanteenSpec = {
  id: TWELFTH_CANTEEN_FLOOR_ID,
  name: '第十二食堂',
  faces: twelfthCanteenFaces,
  style: 'twelfth',
  facadeHeight: 3.95,
  layout: TWELFTH_LAYOUT,
  cornerShopId: '',
  cornerTitle: '',
  cornerSubtitle: '',
  description:
    '单排连续柜台，四块主牌匾下设 1—16 号窗口。初始视图横向排列，右侧为北；牌匾与实际售卖分别标注。尺寸按照片比例示意。',
  stage: { width: 47, depth: 17, x: 0, z: 1 },
  frame: {
    x: 0,
    z: 0.3,
    planRange: 10,
    spatialRange: 15,
    halfWidth: 24,
    spatialOffset: { x: -27, y: 25, z: 36 },
  },
};

export const eleventhCanteenSpec: IndoorCanteenSpec = {
  id: ELEVENTH_CANTEEN_FLOOR_ID,
  name: '第十一食堂',
  faces: eleventhCanteenFaces,
  style: 'eleventh',
  facadeHeight: 4.03,
  layout: ELEVENTH_LAYOUT,
  cornerShopId: '',
  cornerTitle: '',
  cornerSubtitle: '',
  description:
    '五组连续柜台，保留 1—18 号实际窗口；17、18 号为同一家现点小炒，水饺超市独立点选。初始视图横向排列，右侧为北；尺寸按照片比例示意。',
  stage: { width: 57, depth: 15, x: 0, z: 0 },
  frame: {
    x: 0,
    z: 0,
    planRange: 9.5,
    spatialRange: 16,
    halfWidth: 29,
    spatialOffset: { x: -29, y: 25, z: 38 },
  },
};

export const tenthCanteenSpec: IndoorCanteenSpec = {
  id: TENTH_CANTEEN_FLOOR_ID,
  name: '第十食堂',
  style: 'tenth',
  faces: tenthCanteenFaces,
  layout: TENTH_LAYOUT,
  facadeHeight: 3.86,
  cornerShopId: '',
  cornerTitle: '',
  cornerSubtitle: '',
  description:
    'L 形柜台，左侧为北。保留 1—17 号实际窗口；1—4 号合为一个售餐区，16、17 号属于同一家店，分别点餐和取餐；水饺超市独立点选。尺寸按照片比例示意。',
  stage: { width: 50, depth: 29.4, x: -1.5, z: -2.4 },
  frame: {
    x: -2,
    z: -2.5,
    planRange: 18.3,
    spatialRange: 20,
    halfWidth: 27,
    spatialOffset: { x: -32, y: 31, z: 41.5 },
  },
};

/** Sign labels and operating groups are independent from the physical opening number. */
export function getIndoorWindow(spec: IndoorCanteenSpec | undefined, stallId: string) {
  const face = spec?.faces.find((row) => row.faceId === stallId.replace(/-w\d+$/, ''));
  const index = Number(stallId.match(/-w(\d+)$/)?.[1]) - 1;
  if (!face?.windowLabels || !Number.isInteger(index) || index < 0 || index >= face.windowCount)
    return undefined;
  const shopId = face.shopIds?.[index] ?? stallId;
  const windowNumbers = face.shopIds
    ? face.shopIds.flatMap((id, i) => (id === shopId ? [face.windowNumbers?.[i] ?? i + 1] : []))
    : [face.windowNumbers?.[index] ?? index + 1];
  return {
    face,
    windowNumber: face.windowNumbers?.[index] ?? index + 1,
    windowNumbers,
    offering: face.windowLabels[index],
    signName: (face.windowSignNames?.[index] ?? [face.name]).join('／'),
    shopId,
  };
}

export function getIndoorCanteen(floorId: string | undefined): IndoorCanteenSpec | undefined {
  if (floorId === TENTH_CANTEEN_FLOOR_ID) return tenthCanteenSpec;
  if (floorId === ELEVENTH_CANTEEN_FLOOR_ID) return eleventhCanteenSpec;
  if (floorId === TWELFTH_CANTEEN_FLOOR_ID) return twelfthCanteenSpec;
  if (floorId === FOURTH_CANTEEN_FLOOR_ID) return fourthCanteenSpec;
  if (floorId === FIFTH_CANTEEN_FLOOR_ID) return fifthCanteenSpec;
  if (floorId === SIXTH_CANTEEN_FLOOR_ID) return sixthCanteenSpec;
  if (floorId === NINTH_CANTEEN_FLOOR_ID) return ninthCanteenSpec;
  if (floorId === EIGHTH_CANTEEN_FLOOR_ID) return eighthCanteenSpec;
  if (floorId === MINZU_CANTEEN_FLOOR_ID) return minzuCanteenSpec;
  return undefined;
}
