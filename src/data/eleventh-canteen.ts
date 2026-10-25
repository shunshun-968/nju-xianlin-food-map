import type { Stall } from '../domain';
import type { FourthCanteenFace } from './fourth-canteen';

export const ELEVENTH_CANTEEN_FLOOR_ID = 'v-1112-f1';
// Horizontal presentation: local +X is north (screen right); the service aisle is +Z.
export const ELEVENTH_LAYOUT = { frontOffset: 1, kitchenDepth: 5.2, corner: { x: 0, z: 0 } };
export type EleventhCanteenFace = FourthCanteenFace & {
  photoNumber: 1 | 2 | 3 | 4 | 5;
  windowNumbers: number[];
  windowLabels: string[];
  shopIds: string[];
};
const rows = [
  {
    slug: 'staples',
    name: '天天主食',
    photo: 5,
    x: -20.2,
    width: 10.4,
    numbers: [1, 2, 3, 4],
    labels: ['早餐', '猪脚饭／笼仔荷叶饭', '泡面工坊', '锅仔系列'],
  },
  {
    slug: 'qinhuai',
    name: '秦淮食坊',
    photo: 4,
    x: -8.9,
    width: 10.4,
    numbers: [5, 6, 7, 8],
    labels: ['金陵老卤面', '鸭血粉丝汤／小笼包', '金陵小吃', '铁板饭'],
  },
  {
    slug: 'jiangnan',
    name: '寻味江南',
    photo: 3,
    x: 2.4,
    width: 10.4,
    numbers: [9, 10, 11, 12],
    labels: ['减脂套餐', '减脂套餐', '学子套餐', '学子套餐'],
  },
  {
    slug: 'xiang',
    name: '食尚湘味',
    photo: 2,
    x: 13.7,
    width: 10.4,
    numbers: [13, 14, 15, 16],
    labels: ['普通饭菜', '普通饭菜', '普通饭菜', '普通饭菜'],
  },
  {
    slug: 'stir-fry',
    name: '靓汤佳肴',
    photo: 1,
    x: 22.3,
    width: 5.2,
    numbers: [17, 18],
    labels: ['现点小炒', '现点小炒'],
  },
] as const;
export const eleventhCanteenFaces: EleventhCanteenFace[] = rows.map((row) => {
  const id = `${ELEVENTH_CANTEEN_FLOOR_ID}-${row.slug}`;
  return {
    id,
    faceId: id,
    shopId: row.slug,
    name: row.name,
    kind: '售餐窗口',
    windowCount: row.numbers.length,
    x: row.x,
    z: 0,
    width: row.width,
    rotationY: 0,
    color: '#d8e5d5',
    photoNumber: row.photo,
    windowNumbers: [...row.numbers],
    windowLabels: [...row.labels],
    shopIds: row.numbers.map((_, i) => `${id}-w${row.photo === 1 ? 1 : i + 1}`),
  };
});
export const eleventhDumplingKiosk: Stall = {
  id: 'v-1112-f1-dumpling-kiosk',
  floorId: ELEVENTH_CANTEEN_FLOOR_ID,
  name: '水饺超市',
  category: '水饺',
  position: { x: -11.7, z: 3, width: 2.7, depth: 1.15, rotationY: -Math.PI / 2 },
  photoKey: null,
  dishes: [],
};
export const eleventhCanteenStalls: Stall[] = [
  ...eleventhCanteenFaces.flatMap((face) =>
    face.windowNumbers.flatMap((number, index) =>
      face.photoNumber === 1 && index === 1
        ? []
        : [
            {
              id: `${face.faceId}-w${index + 1}`,
              floorId: ELEVENTH_CANTEEN_FLOOR_ID,
              name: `${face.photoNumber === 1 ? '17—18' : number}号 · ${face.windowLabels[index] === '待补充' ? '售餐窗口' : face.windowLabels[index]}`,
              category: face.windowLabels[index],
              position: {
                x:
                  face.photoNumber === 1
                    ? face.x
                    : face.x - face.width / 2 + ((index + 0.5) * face.width) / face.windowCount,
                z: 1 - ELEVENTH_LAYOUT.kitchenDepth / 2,
                width: face.photoNumber === 1 ? face.width : face.width / face.windowCount,
                depth: ELEVENTH_LAYOUT.kitchenDepth,
                rotationY: 0,
              },
              photoKey: null,
              dishes: [],
            },
          ],
    ),
  ),
  eleventhDumplingKiosk,
];
