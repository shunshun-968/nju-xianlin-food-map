import type { Stall } from '../domain';
import type { FourthCanteenFace } from './fourth-canteen';

export const TWELFTH_CANTEEN_FLOOR_ID = 'v-1112-f2';
// Floor-local coordinates: +X is north (screen right), +Z is east (serving aisle).
// User confirmed 2F and east-facing counters; photo files were renumbered on 2026-10-25.
export const TWELFTH_LAYOUT = { frontOffset: 1, kitchenDepth: 5.2, corner: { x: 0, z: 0 } };
export type TwelfthCanteenFace = FourthCanteenFace & {
  section: 1 | 2 | 3 | 4;
  windowNumbers: number[];
  windowLabels: string[];
  shopIds: string[];
};
const sections = [
  {
    section: 1,
    slug: 'global',
    name: '环球食光',
    photo: 4,
    labels: ['临榆炸鸡腿', '猪排饭', '卫孔记', '牛肉蘸水菜／麻辣烫'],
  },
  {
    section: 2,
    slug: 'noodles',
    name: '粉面食界',
    photo: 3,
    labels: [
      '五谷鱼粉／淮南牛肉汤',
      '土耳其烤肉拌饭／蛋包饭',
      '炒饭／石锅／汤面',
      '法式焗面／瓦罐汤',
    ],
  },
  {
    section: 3,
    slug: 'rice',
    name: '稻香食坊',
    photo: 2,
    labels: ['火爆铁板烧', '江西小炒', '匠心卤', '一人一锅·自由搭配'],
  },
  {
    section: 4,
    slug: 'regional',
    name: '一方食韵',
    photo: 1,
    labels: ['牛肉面', '广味轩·广式烧腊', '黑鸭煲', '瓦香鸡'],
  },
] as const;
export const twelfthCanteenFaces: TwelfthCanteenFace[] = sections.map((row, index) => {
  const id = `${TWELFTH_CANTEEN_FLOOR_ID}-${row.slug}`;
  return {
    id,
    faceId: id,
    shopId: row.slug,
    name: row.name,
    kind: '售餐窗口',
    section: row.section,
    windowCount: 4,
    x: (index - 1.5) * 10.64,
    z: 0,
    width: 10.4,
    rotationY: 0,
    color: '#783327',
    photoNumber: row.photo,
    windowNumbers: Array.from({ length: 4 }, (_, i) => index * 4 + i + 1),
    windowLabels: [...row.labels],
    shopIds: Array.from({ length: 4 }, (_, i) => `${id}-w${i + 1}`),
  };
});
export const twelfthCanteenStalls: Stall[] = twelfthCanteenFaces.flatMap((face) =>
  face.windowNumbers.map((number, index) => ({
    id: `${face.faceId}-w${index + 1}`,
    floorId: TWELFTH_CANTEEN_FLOOR_ID,
    name: `${number}号 · ${face.windowLabels[index] === '待补充' ? '售餐窗口' : face.windowLabels[index]}`,
    category: face.windowLabels[index],
    position: {
      x: face.x - face.width / 2 + ((index + 0.5) * face.width) / 4,
      z: face.z + TWELFTH_LAYOUT.frontOffset - TWELFTH_LAYOUT.kitchenDepth / 2,
      width: face.width / 4,
      depth: TWELFTH_LAYOUT.kitchenDepth,
      rotationY: face.rotationY,
    },
    photoKey: null,
    dishes: [],
  })),
);
