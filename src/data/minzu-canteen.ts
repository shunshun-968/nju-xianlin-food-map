import type { Stall } from '../domain';
import type { FourthCanteenFace } from './fourth-canteen';

/** Temporary interior entry; external building/floor alignment will be revised separately. */
export const MINZU_CANTEEN_FLOOR_ID = 'v-891-f1';
export const MINZU_LAYOUT = {
  frontOffset: 1,
  kitchenDepth: 3.5,
  corner: { x: -5, z: 8.5 },
};
export type MinzuSignKey = 'lanzhou' | 'paidang' | 'minzu' | 'bianchui';
export type MinzuCanteenFace = FourthCanteenFace & {
  signKey: MinzuSignKey;
  windowNumbers: number[];
  windowLabels: string[];
  windowSignNames: string[][];
  shopIds: string[];
  emptyWindows: number[];
};

// These groups assemble numbered openings. The physical signboards below have independent bounds.
const openings = [
  {
    slug: 'lanzhou',
    name: '回味无穷·兰州拉面',
    signKey: 'lanzhou' as const,
    x: -4,
    z: -12.5,
    width: 7,
    rotationY: -Math.PI / 2,
    photoNumber: 4,
    windowNumbers: [1, 2],
    windowLabels: ['拉面／刀削面／炒面／炒米粉', '脆皮鸡排饭'],
    windowSignNames: [['回味无穷·兰州拉面'], ['回味无穷·兰州拉面']],
    shopIds: ['minzu-noodles', 'minzu-chicken-rice'],
    emptyWindows: [],
  },
  {
    slug: 'paidang',
    name: '美食排档',
    signKey: 'paidang' as const,
    x: -4,
    z: -3.75,
    width: 10.5,
    rotationY: -Math.PI / 2,
    photoNumber: 3,
    windowNumbers: [3, 4, 5],
    windowLabels: ['学子特价套餐', '麻辣烫', '暂无售卖'],
    windowSignNames: [['回味无穷·兰州拉面', '美食排档'], ['美食排档'], ['美食排档', '民族风味']],
    shopIds: ['minzu-student-special', 'minzu-malatang', 'minzu-empty-5'],
    emptyWindows: [5],
  },
  {
    slug: 'minzu',
    name: '民族风味',
    signKey: 'minzu' as const,
    x: -4,
    z: 5,
    width: 7,
    rotationY: -Math.PI / 2,
    photoNumber: 2,
    windowNumbers: [6, 7],
    windowLabels: ['拌面／盖饭／水饺', '暂无售卖'],
    windowSignNames: [['民族风味'], ['民族风味']],
    shopIds: ['minzu-mixed-noodles-rice-dumplings', 'minzu-empty-7'],
    emptyWindows: [7],
  },
  {
    slug: 'bianchui',
    name: '边陲风情',
    signKey: 'bianchui' as const,
    x: 0.25,
    z: 7.5,
    width: 10.5,
    rotationY: 0,
    photoNumber: 1,
    windowNumbers: [8, 9, 10],
    windowLabels: ['自选菜', '自选菜', '自选菜'],
    windowSignNames: [['边陲风情'], ['边陲风情'], ['边陲风情']],
    // Buying the same food at all three windows does not establish common business ownership.
    shopIds: ['minzu-self-select-8', 'minzu-self-select-9', 'minzu-self-select-10'],
    emptyWindows: [],
  },
];

export const minzuCanteenFaces: MinzuCanteenFace[] = openings.map(({ slug, ...face }) => ({
  ...face,
  id: `${MINZU_CANTEEN_FLOOR_ID}-${slug}`,
  faceId: `${MINZU_CANTEEN_FLOOR_ID}-${slug}`,
  shopId: `minzu-structure-${slug}`,
  windowCount: face.windowNumbers.length,
  color: face.signKey === 'lanzhou' || face.signKey === 'bianchui' ? '#406c91' : '#665073',
  kind: '食堂窗口',
}));

/** Actual sign boundaries bisect windows 3 and 5, rather than following the glass dividers. */
export const minzuSignBoards: {
  id: string;
  name: string;
  signKey: MinzuSignKey;
  x: number;
  z: number;
  width: number;
  rotationY: number;
}[] = [
  {
    id: 'minzu-sign-lanzhou',
    name: '回味无穷·兰州拉面',
    signKey: 'lanzhou',
    x: -4,
    z: -11.625,
    width: 8.75,
    rotationY: -Math.PI / 2,
  },
  {
    id: 'minzu-sign-paidang',
    name: '美食排档',
    signKey: 'paidang',
    x: -4,
    z: -3.75,
    width: 7,
    rotationY: -Math.PI / 2,
  },
  {
    id: 'minzu-sign-minzu',
    name: '民族风味',
    signKey: 'minzu',
    x: -4,
    z: 4.125,
    width: 8.75,
    rotationY: -Math.PI / 2,
  },
  {
    id: 'minzu-sign-bianchui',
    name: '边陲风情',
    signKey: 'bianchui',
    x: 0.25,
    z: 7.5,
    width: 10.5,
    rotationY: 0,
  },
];

/** Two visual food zones of 1.5 windows each; all three numbered windows accept purchases. */
export const minzuSelfSelectAreas = [
  {
    id: 'minzu-self-select-west',
    x: -2.375,
    z: 10,
    width: 5.25,
    label: '自选菜',
    windowNumbers: [8, 9, 10],
  },
  {
    id: 'minzu-self-select-east',
    x: 2.875,
    z: 10,
    width: 5.25,
    label: '自选菜',
    windowNumbers: [8, 9, 10],
  },
];

export const minzuCanteenStalls: Stall[] = minzuCanteenFaces.flatMap((face) =>
  face.windowNumbers.map((windowNumber, index) => {
    const width = face.width / face.windowCount;
    const localX = -face.width / 2 + width * (index + 0.5);
    const localZ = MINZU_LAYOUT.frontOffset - MINZU_LAYOUT.kitchenDepth / 2;
    const offering = face.windowLabels[index];
    return {
      id: `${face.faceId}-w${index + 1}`,
      floorId: MINZU_CANTEEN_FLOOR_ID,
      name: `${offering} · ${windowNumber}号窗口`,
      category: offering,
      position: {
        x: face.x + localX * Math.cos(face.rotationY) + localZ * Math.sin(face.rotationY),
        z: face.z - localX * Math.sin(face.rotationY) + localZ * Math.cos(face.rotationY),
        width,
        depth: MINZU_LAYOUT.kitchenDepth,
        rotationY: face.rotationY,
      },
      ...(windowNumber === 8 ? { breakfast: true } : {}),
      photoKey: null,
      dishes: [],
    };
  }),
);
