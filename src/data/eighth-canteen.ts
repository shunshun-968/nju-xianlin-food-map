import type { Stall } from '../domain';
import { FOURTH_LAYOUT, fourthKitchenBounds, type FourthCanteenFace } from './fourth-canteen';

/** Temporary route in the existing building; this is not a surveyed floor assignment. */
export const EIGHTH_CANTEEN_FLOOR_ID = 'v-891-f2';
export const EIGHTH_LAYOUT = {
  ...FOURTH_LAYOUT,
  corner: { x: 12, z: 4 },
};

export type EighthCanteenFace = FourthCanteenFace & {
  /** Actual photographed numbers, ordered along the frontage's local +X axis. */
  windowNumbers: number[];
  /** Current offerings confirmed by the user; unrelated to the decorative sign. */
  windowLabels: string[];
  /** Operating groups; separate from shopId, which identifies the model's room. */
  shopIds: string[];
  kitchenBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
};

const cornerKitchen = { minX: 7.5, maxX: 12, minZ: -0.5, maxZ: 4 };

// Coordinates are explicit: changing the array's display order cannot move a window.
// +X is east, -Z is north. The long counter serves south; the short counter serves east.
const frontages = [
  {
    slug: 'lu-shui',
    name: '卤水',
    x: -12.75,
    z: 3,
    rotationY: 0,
    windowNumbers: [1, 2],
    windowLabels: ['减脂餐', '减脂餐'],
    shopIds: ['eighth-fat-loss', 'eighth-fat-loss'],
    shopId: 'eighth-lu-shui-kitchen',
    photoNumber: 5,
  },
  {
    slug: 'te-se',
    name: '特色',
    x: -8.25,
    z: 3,
    rotationY: 0,
    windowNumbers: [3, 4],
    windowLabels: ['3号窗口', '自选菜'],
    shopIds: ['eighth-window-3', 'eighth-self-select'],
    shopId: 'eighth-te-se-kitchen',
    photoNumber: 5,
  },
  {
    slug: 'wei-dao',
    name: '味道',
    x: -3.75,
    z: 3,
    rotationY: 0,
    windowNumbers: [5, 6],
    windowLabels: ['自选菜', '自选菜'],
    shopIds: ['eighth-self-select', 'eighth-self-select'],
    shopId: 'eighth-wei-dao-kitchen',
    photoNumber: 4,
  },
  {
    slug: 'zhu-shi',
    name: '主食',
    x: 0.75,
    z: 3,
    rotationY: 0,
    windowNumbers: [7, 8],
    windowLabels: ['自选菜', '吊梨汤'],
    shopIds: ['eighth-self-select', 'eighth-pear-soup'],
    shopId: 'eighth-zhu-shi-kitchen',
    photoNumber: 4,
  },
  {
    slug: 'tie-ban',
    name: '铁板',
    x: 5.25,
    z: 3,
    rotationY: 0,
    windowNumbers: [9, 10],
    windowLabels: ['鸡排饭·牛排饭', '面食'],
    shopIds: ['eighth-steak-rice', 'eighth-noodles'],
    shopId: 'eighth-tie-ban-kitchen',
    photoNumber: 3,
  },
  {
    slug: 'mian-fang',
    name: '面坊',
    x: 9.75,
    z: 3,
    rotationY: 0,
    windowNumbers: [11, 12],
    windowLabels: ['面食', '暂无售卖'],
    shopIds: ['eighth-noodles', 'eighth-inactive-12'],
    shopId: 'eighth-corner-kitchen',
    kitchenBounds: cornerKitchen,
    photoNumber: 3,
  },
  {
    slug: 'mei-shi',
    name: '美食',
    x: 11,
    z: 1.75,
    rotationY: Math.PI / 2,
    windowNumbers: [13, 14],
    windowLabels: ['椰子鸡', '椰子鸡'],
    shopIds: ['eighth-coconut-chicken', 'eighth-coconut-chicken'],
    shopId: 'eighth-corner-kitchen',
    kitchenBounds: cornerKitchen,
    photoNumber: 1,
  },
];

export const eighthCanteenFaces: EighthCanteenFace[] = frontages.map(({ slug, ...face }) => ({
  ...face,
  id: `${EIGHTH_CANTEEN_FLOOR_ID}-${slug}`,
  faceId: `${EIGHTH_CANTEEN_FLOOR_ID}-${slug}`,
  windowCount: face.windowNumbers.length,
  width: 4.5,
  color: '#dfb51b',
  kind: '食堂窗口',
}));

/** Explicit shared corner room; all other room footprints follow their service frontage. */
export function eighthKitchenBounds(face: EighthCanteenFace) {
  return face.kitchenBounds ?? fourthKitchenBounds(face);
}

/** Standalone freezer in the corridor, not an additional numbered service window. */
export const eighthDumplingKiosk = {
  id: `${EIGHTH_CANTEEN_FLOOR_ID}-dumpling-kiosk`,
  name: '水饺超市',
  position: { x: 9, z: 7.4, width: 3.4, depth: 1.5, rotationY: Math.PI / 2 },
} satisfies Pick<Stall, 'id' | 'name' | 'position'>;

export const eighthCanteenStalls: Stall[] = [
  ...eighthCanteenFaces.flatMap((face) =>
    face.windowNumbers.map((windowNumber, index) => {
      const width = face.width / face.windowCount;
      const localX = -face.width / 2 + width * (index + 0.5);
      const localZ = EIGHTH_LAYOUT.frontOffset - EIGHTH_LAYOUT.kitchenDepth / 2;
      const offering = face.windowLabels[index];
      return {
        id: `${face.faceId}-w${index + 1}`,
        floorId: EIGHTH_CANTEEN_FLOOR_ID,
        name: windowNumber === 3 ? '3号窗口' : `${offering} · ${windowNumber}号窗口`,
        category: windowNumber === 3 ? '待补充' : offering,
        position: {
          x: face.x + localX * Math.cos(face.rotationY) + localZ * Math.sin(face.rotationY),
          z: face.z - localX * Math.sin(face.rotationY) + localZ * Math.cos(face.rotationY),
          width,
          depth: EIGHTH_LAYOUT.kitchenDepth,
          rotationY: face.rotationY,
        },
        photoKey: null,
        dishes: [],
      };
    }),
  ),
  {
    ...eighthDumplingKiosk,
    floorId: EIGHTH_CANTEEN_FLOOR_ID,
    category: '水饺',
    photoKey: null,
    dishes: [],
  },
];

/** Resolve by stable window ID; the kiosk deliberately has no invented window number. */
export function getEighthWindow(
  stallId: string | undefined,
): { face: EighthCanteenFace; windowNumber: number; offering: string; shopId: string } | undefined {
  if (!stallId) return undefined;
  for (const face of eighthCanteenFaces) {
    const index = face.windowNumbers.findIndex(
      (_, index) => `${face.faceId}-w${index + 1}` === stallId,
    );
    if (index >= 0)
      return {
        face,
        windowNumber: face.windowNumbers[index],
        offering: face.windowLabels[index],
        shopId: face.shopIds[index],
      };
  }
  return undefined;
}
