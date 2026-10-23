import type { Stall } from '../domain';
import { FOURTH_LAYOUT, type FourthCanteenFace } from './fourth-canteen';

export const SIXTH_CANTEEN_FLOOR_ID = 'v-456-f3';
export const SIXTH_LAYOUT = FOURTH_LAYOUT;

export type SixthCanteenFace = FourthCanteenFace & {
  screenTexts: string[];
  sourcePhotoNumbers: number[];
  kitchenBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  pickup?: boolean;
  enclosed?: boolean;
  displayOnly?: boolean;
};

const jinlingKitchenBounds = { minX: -17.5, maxX: -12.25, minZ: -7.5, maxZ: 7.3 };
// The main row reaches X=8.75 after Jinling (5.25) and six 3.5-wide frontages.
const huaiyangKitchenBounds = { minX: 8.75, maxX: 14, minZ: 3.8, maxZ: 7.3 };
const mainFrontages = [
  {
    slug: 'jinling-kitchen',
    name: '金陵小厨',
    windowCount: 3,
    width: 5.25,
    screenTexts: ['自选菜', '自选菜', '自选菜'],
    sourcePhotoNumbers: [9],
  },
  {
    slug: 'zhongshi-miandian',
    name: '中式面点',
    windowCount: 2,
    width: 3.5,
    screenTexts: ['自选菜', '自选菜'],
    sourcePhotoNumbers: [8],
  },
  {
    slug: 'meishi-dangkou',
    name: '美食档口',
    windowCount: 2,
    width: 3.5,
    screenTexts: ['麻辣香锅窗口\n素菜15元/斤\n荤菜32.5元/斤\n晚餐销售', '自选菜'],
    sourcePhotoNumbers: [7],
  },
  {
    slug: 'baibian-chuangkou',
    name: '百变窗口',
    windowCount: 2,
    width: 3.5,
    screenTexts: ['贵州蘸水菜', '自选减脂餐窗口'],
    sourcePhotoNumbers: [6],
  },
  {
    slug: 'difang-tese',
    name: '地方特色',
    windowCount: 2,
    width: 3.5,
    screenTexts: ['自选菜', '自选菜'],
    sourcePhotoNumbers: [5],
  },
  {
    slug: 'fengwei-xiaochi',
    name: '风味小吃',
    windowCount: 2,
    width: 3.5,
    screenTexts: ['广式烧腊', '自选菜'],
    sourcePhotoNumbers: [4],
  },
  {
    slug: 'tianfu-caiyao',
    name: '天府菜肴',
    windowCount: 2,
    width: 3.5,
    screenTexts: ['自选菜', '自选菜'],
    sourcePhotoNumbers: [3],
  },
  {
    // Photographs 1 and 2 show the same four-screen section with two service openings.
    slug: 'huaiyang-caipin',
    name: '淮扬菜品',
    windowCount: 2,
    width: 5.25,
    screenTexts: ['自选菜', '自选菜', '自选菜', '自选菜'],
    sourcePhotoNumbers: [1, 2],
  },
];

export const sixthCanteenFaces: SixthCanteenFace[] = [
  ...mainFrontages.map((frontage, index) => ({
    id: `${SIXTH_CANTEEN_FLOOR_ID}-${frontage.slug}`,
    faceId: `${SIXTH_CANTEEN_FLOOR_ID}-${frontage.slug}`,
    shopId: frontage.slug,
    name: frontage.name,
    windowCount: frontage.windowCount,
    x:
      SIXTH_LAYOUT.corner.x +
      mainFrontages.slice(0, index).reduce((sum, row) => sum + row.width, 0) +
      frontage.width / 2,
    z: 6.3,
    width: frontage.width,
    rotationY: 0,
    color: '#e3dfd3',
    photoNumber: frontage.sourcePhotoNumbers[0],
    sourcePhotoNumbers: frontage.sourcePhotoNumbers,
    screenTexts: frontage.screenTexts,
    kind: '食堂窗口',
    ...(frontage.slug === 'jinling-kitchen'
      ? { kitchenBounds: jinlingKitchenBounds, enclosed: true }
      : frontage.slug === 'huaiyang-caipin'
        ? { kitchenBounds: huaiyangKitchenBounds }
        : {}),
  })),
  {
    id: `${SIXTH_CANTEEN_FLOOR_ID}-jinling-side-window`,
    faceId: `${SIXTH_CANTEEN_FLOOR_ID}-jinling-side-window`,
    shopId: 'jinling-kitchen',
    name: '金陵小厨转角玻璃窗',
    windowCount: 1,
    x: -16.5,
    z: 5.5,
    width: 1.75,
    rotationY: -Math.PI / 2,
    color: '#e3dfd3',
    photoNumber: 10,
    sourcePhotoNumbers: [10],
    screenTexts: ['自选菜'],
    kind: '食堂窗口',
    enclosed: true,
    displayOnly: true,
    kitchenBounds: jinlingKitchenBounds,
  },
  {
    id: `${SIXTH_CANTEEN_FLOOR_ID}-jinling-pickup`,
    faceId: `${SIXTH_CANTEEN_FLOOR_ID}-jinling-pickup`,
    shopId: 'jinling-kitchen',
    name: '金陵小厨取餐口',
    windowCount: 1,
    x: -16.5,
    z: -4.5,
    width: 1.75,
    rotationY: -Math.PI / 2,
    color: '#e3dfd3',
    photoNumber: 10,
    sourcePhotoNumbers: [10],
    screenTexts: ['自选菜'],
    kind: '取餐口',
    pickup: true,
    enclosed: true,
    kitchenBounds: jinlingKitchenBounds,
  },
  {
    id: `${SIXTH_CANTEEN_FLOOR_ID}-huaiyang-side`,
    faceId: `${SIXTH_CANTEEN_FLOOR_ID}-huaiyang-side`,
    shopId: 'huaiyang-caipin',
    name: '淮扬菜品',
    windowCount: 1,
    x: 13,
    z: 5.5,
    width: 1.75,
    rotationY: Math.PI / 2,
    color: '#e3dfd3',
    photoNumber: 1,
    sourcePhotoNumbers: [1, 2],
    screenTexts: ['自选菜', '自选菜'],
    kind: '食堂窗口',
    kitchenBounds: huaiyangKitchenBounds,
  },
];

/** Local indices identify selectable openings; the photographs do not confirm window numbers. */
export const sixthCanteenStalls: Stall[] = sixthCanteenFaces
  .filter((face) => !face.displayOnly)
  .flatMap((face) =>
    Array.from({ length: face.windowCount }, (_, index) => {
      const width = face.width / face.windowCount;
      const localX = -face.width / 2 + width * (index + 0.5);
      const depth = face.kitchenBounds
        ? Math.abs(Math.cos(face.rotationY)) > 0.5
          ? face.kitchenBounds.maxZ - face.kitchenBounds.minZ
          : face.kitchenBounds.maxX - face.kitchenBounds.minX
        : SIXTH_LAYOUT.kitchenDepth;
      const localZ = SIXTH_LAYOUT.frontOffset - depth / 2;
      const positionLabel =
        face.windowCount === 1
          ? '侧面'
          : face.windowCount === 3
            ? ['左侧', '中间', '右侧'][index]
            : ['左侧', '右侧'][index];
      return {
        id: `${face.faceId}-w${index + 1}`,
        floorId: SIXTH_CANTEEN_FLOOR_ID,
        name: face.pickup ? face.name : `${face.name} · ${positionLabel}窗口`,
        category: face.kind,
        position: {
          x: face.x + localX * Math.cos(face.rotationY) + localZ * Math.sin(face.rotationY),
          z: face.z - localX * Math.sin(face.rotationY) + localZ * Math.cos(face.rotationY),
          width,
          depth,
          rotationY: face.rotationY,
        },
        photoKey: null,
        dishes: [],
      };
    }),
  );
