import type { Stall } from '../domain';
import type { FourthCanteenFace } from './fourth-canteen';

export const FACULTY_CANTEEN_FLOOR_ID = 'v-10-f2';
/** Local -X is north (left); +Z is the dining aisle. Dimensions are schematic. */
export const FACULTY_LAYOUT = { frontOffset: 1, kitchenDepth: 5.2, corner: { x: 0, z: 0 } };
export type FacultyCanteenFace = FourthCanteenFace & {
  windowNumbers: number[];
  windowLabels: string[];
  windowSignNames: string[][];
  shopIds: string[];
};

// Physical spans are explicit and independent of sidebar sorting. Photos show a corridor between 1 and 2.
const rows = [
  {
    number: 7,
    width: 6.6,
    gapAfter: 0.25,
    sign: '明档小炒 · 金陵小炒',
    offering: '明档小炒',
    color: '#744a72',
  },
  {
    number: 6,
    width: 5.6,
    gapAfter: 0.45,
    sign: '营养汤 · 免费汤',
    offering: '营养汤／免费汤',
    color: '#c5a34f',
  },
  {
    number: 5,
    width: 5.6,
    gapAfter: 0.45,
    sign: '面坊',
    offering: '面食／教工下饭菜',
    color: '#c45749',
  },
  {
    number: 4,
    width: 5.2,
    gapAfter: 0.15,
    sign: '普通饭菜',
    offering: '普通饭菜／晚餐滑蛋饭',
    color: '#c3a141',
  },
  {
    number: 3,
    width: 5.2,
    gapAfter: 0.65,
    sign: '普通饭菜',
    offering: '普通饭菜（值班窗口）',
    color: '#c3a141',
  },
  {
    number: 2,
    width: 4.6,
    gapAfter: 1.5,
    sign: '午餐供应 · 晚餐供应',
    offering: '普通饭菜／麻辣香锅／特色小炒／麻辣烫',
    color: '#c65049',
  },
  { number: 1, width: 3.4, gapAfter: 0, sign: '轻食能量站', offering: '轻食', color: '#4caa86' },
] as const;
const rowWidth = rows.reduce((total, row) => total + row.width + row.gapAfter, 0);
export const facultyCanteenFaces: FacultyCanteenFace[] = rows.map((row, index) => {
  const id = `${FACULTY_CANTEEN_FLOOR_ID}-window-${row.number}`;
  return {
    id,
    faceId: id,
    shopId: id,
    name: row.sign,
    kind: '售餐窗口',
    windowCount: 1,
    x:
      -rowWidth / 2 +
      rows.slice(0, index).reduce((sum, item) => sum + item.width + item.gapAfter, 0) +
      row.width / 2,
    z: 0,
    width: row.width,
    rotationY: 0,
    color: row.color,
    photoNumber: row.number,
    windowNumbers: [row.number],
    windowLabels: [row.offering],
    windowSignNames: [[row.sign]],
    shopIds: [`${id}-w1`],
  };
});

export const facultyCanteenStalls: Stall[] = [...facultyCanteenFaces]
  .sort((a, b) => a.windowNumbers[0] - b.windowNumbers[0])
  .map((face) => ({
    id: `${face.faceId}-w1`,
    floorId: FACULTY_CANTEEN_FLOOR_ID,
    name: `${face.windowNumbers[0]}号 · ${face.windowLabels[0]}`,
    category: face.windowLabels[0],
    position: {
      x: face.x,
      z: FACULTY_LAYOUT.frontOffset - FACULTY_LAYOUT.kitchenDepth / 2,
      width: face.width,
      depth: FACULTY_LAYOUT.kitchenDepth,
      rotationY: 0,
    },
    photoKey: null,
    dishes: [],
  }));

/** Photographed notices, not a live service schedule or verified current menu/prices. */
export const facultyServiceNotes = {
  2: { lunch: '普通饭菜', dinner: '麻辣香锅／特色小炒', additionalNotice: '本窗口新增麻辣烫' },
  3: { notice: '值班窗口', photographedClosingTimes: { lunch: '13:30', dinner: '19:30' } },
  4: { notice: '低脂低盐低油 · 无糖窗口', dinner: '滑蛋饭' },
  5: {
    offerings: ['九鲜大碗面', '特色小煮面', '炒面', '干拌面', '教工下饭菜'],
    confirmedTogetherByUser: true,
  },
} as const;
