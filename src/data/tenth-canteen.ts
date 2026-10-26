import type { Stall } from '../domain';
import type { IndoorCanteenFace } from './indoor-canteens';
import {
  windows,
  mainFaces,
  KITCHEN_DEPTH,
  NORTH_FRONT_X,
} from '../models/tenth-canteen/layout.js';

export const TENTH_CANTEEN_FLOOR_ID = 'v-10-f1';
export const TENTH_LAYOUT = {
  frontOffset: 0,
  kitchenDepth: KITCHEN_DEPTH,
  corner: { x: NORTH_FRONT_X, z: 0 },
};
const offerings: Record<number, string> = {
  6: '老卤面',
  7: '砂锅',
  11: '学子特价套餐',
  16: '米线／套餐',
  17: '米线／套餐',
};
const rows = [
  {
    photo: 1,
    title: '美食广场',
    x: NORTH_FRONT_X,
    z: -7.275,
    width: 13.85,
    numbers: [1, 2, 3, 4, 5],
    rotationY: -Math.PI / 2,
  },
  ...mainFaces.map((face) => ({ ...face, z: 0, rotationY: 0 })),
];
export const tenthCanteenFaces: IndoorCanteenFace[] = rows.map((row) => {
  const id = `${TENTH_CANTEEN_FLOOR_ID}-photo-${row.photo}`;
  return {
    id,
    faceId: id,
    shopId: id,
    name: row.title,
    kind: '售餐窗口',
    windowCount: row.numbers.length,
    x: row.x,
    z: row.z,
    width: row.width,
    rotationY: row.rotationY,
    color: '#d2d6cd',
    photoNumber: row.photo,
    windowNumbers: row.numbers,
    windowLabels: row.numbers.map((n) => offerings[n] ?? '待补充'),
    shopIds: row.numbers.map((n, index) => `${id}-w${n <= 4 || n >= 16 ? 1 : index + 1}`),
  };
});
export function tenthStallId(number: number): string {
  const face = tenthCanteenFaces.find((face) => face.windowNumbers!.includes(number));
  if (!face) throw new Error(`Unknown tenth canteen window ${number}`);
  return face.shopIds![face.windowNumbers!.indexOf(number)];
}
export const tenthDumplingKiosk: Stall = {
  id: 'v-10-f1-dumpling-kiosk',
  floorId: TENTH_CANTEEN_FLOOR_ID,
  name: '水饺超市',
  category: '水饺',
  position: { x: -20.1, z: -1.7, width: 2.3, depth: 1.1, rotationY: -Math.PI / 2 },
  photoKey: null,
  dishes: [],
};
// Derive picking and lighting footprints from the same coordinates as the model.
export const tenthCanteenStalls: Stall[] = [
  ...windows
    .filter((w) => ![2, 3, 4, 17].includes(w.number))
    .map((w) => ({
      id: tenthStallId(w.number),
      floorId: TENTH_CANTEEN_FLOOR_ID,
      name: `${w.number === 1 ? '1—4' : w.number === 16 ? '16—17' : w.number}号 · ${offerings[w.number] ?? '售餐窗口'}`,
      category: offerings[w.number] ?? '待补充',
      position: {
        x: (w.number === 16 ? mainFaces[5].x : w.x) - (Math.sin(w.rotationY) * KITCHEN_DEPTH) / 2,
        z: (w.number === 1 ? -9 : w.z) - (Math.cos(w.rotationY) * KITCHEN_DEPTH) / 2,
        width: w.number === 1 ? 10.4 : w.number === 16 ? mainFaces[5].width : w.width,
        depth: KITCHEN_DEPTH,
        rotationY: w.rotationY,
      },
      photoKey: null,
      dishes: [],
    })),
  tenthDumplingKiosk,
];
