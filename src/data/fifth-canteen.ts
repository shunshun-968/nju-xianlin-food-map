import type { Stall } from '../domain';
import { FOURTH_LAYOUT, type FourthCanteenFace } from './fourth-canteen';

export const FIFTH_CANTEEN_FLOOR_ID = 'v-456-f2';
export const FIFTH_LAYOUT = FOURTH_LAYOUT;

/** One sign frontage; windowNumbers are the photographed numbers in local +X order. */
export type FifthCanteenFace = FourthCanteenFace & { windowNumbers: number[] };

const mainFrontages = [
  {
    slug: 'nanzhou-beimian',
    shopId: 'nanzhou-shuijiao',
    name: '南粥北面',
    windowNumbers: [16, 15],
    color: '#b89b67',
    photoNumber: 5,
  },
  {
    slug: 'weidao-zuofang',
    shopId: 'weidao-zuofang',
    name: '味道作坊',
    windowNumbers: [14, 13],
    color: '#a66f59',
    photoNumber: 5,
  },
  {
    slug: 'qiaochu-tiandi',
    shopId: 'qiaochu-tiandi',
    name: '巧厨天地',
    windowNumbers: [12, 11],
    color: '#b88c54',
    photoNumber: 4,
  },
  {
    slug: 'xiangji-bafang',
    shopId: 'xiangji-bafang',
    name: '香積八方',
    windowNumbers: [10, 9, 8, 7],
    color: '#8a9d75',
    photoNumber: 3,
  },
  {
    slug: 'jiachang-weidao',
    shopId: 'jiachang-weidao',
    name: '家常味道',
    windowNumbers: [6, 5, 4, 3],
    color: '#b67361',
    photoNumber: 2,
  },
  {
    slug: 'shicheng-ziwei',
    shopId: 'shicheng-ziwei',
    name: '石城滋味',
    windowNumbers: [2, 1],
    color: '#9d7e65',
    photoNumber: 1,
  },
];

export const fifthCanteenFaces: FifthCanteenFace[] = [
  ...mainFrontages.map((frontage, index) => {
    const width = frontage.windowNumbers.length * 1.75;
    return {
      id: `${FIFTH_CANTEEN_FLOOR_ID}-${frontage.slug}`,
      faceId: `${FIFTH_CANTEEN_FLOOR_ID}-${frontage.slug}`,
      shopId: frontage.shopId,
      name: frontage.name,
      windowCount: frontage.windowNumbers.length,
      windowNumbers: frontage.windowNumbers,
      x:
        FIFTH_LAYOUT.corner.x +
        mainFrontages
          .slice(0, index)
          .reduce((sum, row) => sum + row.windowNumbers.length * 1.75, 0) +
        width / 2,
      z: 6.3,
      width,
      rotationY: 0,
      color: frontage.color,
      photoNumber: frontage.photoNumber,
      kind: '食堂窗口',
    };
  }),
  {
    id: `${FIFTH_CANTEEN_FLOOR_ID}-shougong-shuijiao`,
    faceId: `${FIFTH_CANTEEN_FLOOR_ID}-shougong-shuijiao`,
    shopId: 'nanzhou-shuijiao',
    name: '手工·水饺',
    windowCount: 2,
    windowNumbers: [18, 17],
    x: -16.5,
    z: 5.55,
    width: 3.5,
    rotationY: -Math.PI / 2,
    color: '#b89b67',
    photoNumber: 7,
    kind: '食堂窗口',
  },
  {
    id: `${FIFTH_CANTEEN_FLOOR_ID}-wuwei-zachen`,
    faceId: `${FIFTH_CANTEEN_FLOOR_ID}-wuwei-zachen`,
    shopId: 'wuwei-zachen',
    name: '五味杂陈',
    windowCount: 3,
    windowNumbers: [21, 20, 19],
    x: -16.5,
    z: 1.175,
    width: 5.25,
    rotationY: -Math.PI / 2,
    color: '#a59377',
    photoNumber: 8,
    kind: '食堂窗口',
  },
];

/** Each catalog record keeps a local stable ID and the actual number on its sign. */
export const fifthCanteenStalls: Stall[] = fifthCanteenFaces.flatMap((face) =>
  face.windowNumbers.map((windowNumber, index) => {
    const width = face.width / face.windowCount;
    const localX = -face.width / 2 + width * (index + 0.5);
    const localZ = FIFTH_LAYOUT.frontOffset - FIFTH_LAYOUT.kitchenDepth / 2;
    return {
      id: `${face.faceId}-w${index + 1}`,
      floorId: FIFTH_CANTEEN_FLOOR_ID,
      name: `${face.name} · ${windowNumber}号窗口`,
      category: face.kind,
      position: {
        x: face.x + localX * Math.cos(face.rotationY) + localZ * Math.sin(face.rotationY),
        z: face.z - localX * Math.sin(face.rotationY) + localZ * Math.cos(face.rotationY),
        width,
        depth: FIFTH_LAYOUT.kitchenDepth,
        rotationY: face.rotationY,
      },
      photoKey: null,
      dishes: [],
    };
  }),
);
