// Drawing units are metres estimated from photographs, never survey measurements.
// North points left (-X). +Z is the main serving aisle.
export const MAIN_FRONT_Z = 0;
export const NORTH_FRONT_X = -18.3;
export const KITCHEN_DEPTH = 4.3;
export const mainFaces = [
  { photo: 4, title: '美食广场', x: -14.8, width: 5.6, numbers: [6, 7] },
  { photo: 5, title: '中式美点', x: -8.5, width: 5.6, numbers: [8, 9], perpendicular: true },
  { photo: 6, title: '舌尖美肴', x: -2.9, width: 5.6, numbers: [10, 11], perpendicular: true },
  { photo: 7, title: '巴蜀风味', x: 3.4, width: 5.6, numbers: [12, 13], perpendicular: true },
  { photo: 8, title: '精品维扬', x: 9, width: 5.6, numbers: [14, 15], perpendicular: true },
  { photo: 9, title: '风味排档', x: 15.4, width: 5.6, numbers: [16, 17] },
];
export const windows = [
  ...[1, 2, 3, 4].map((number, index) => ({
    number,
    id: `tenth-window-${number}`,
    groupId: 'tenth-stall-1-4',
    photo: number < 4 ? 1 : 2,
    title: '美食广场',
    x: NORTH_FRONT_X,
    z: -12.9 + index * 2.6,
    width: 2.6,
    rotationY: -Math.PI / 2,
    perpendicular: false,
  })),
  {
    number: 5,
    id: 'tenth-window-5',
    groupId: 'tenth-window-5',
    photo: 3,
    title: '美食广场 · 值班窗口',
    x: NORTH_FRONT_X,
    z: -1.725,
    width: 2.75,
    rotationY: -Math.PI / 2,
    perpendicular: false,
  },
  ...mainFaces.flatMap((face) =>
    face.numbers.map((number, index) => ({
      number,
      id: `tenth-window-${number}`,
      groupId: number >= 16 ? 'tenth-stall-16-17' : `tenth-window-${number}`,
      photo: face.photo,
      title: face.title,
      x: face.x - face.width / 4 + (index * face.width) / 2,
      z: 0,
      width: face.width / 2,
      rotationY: 0,
      perpendicular: !!face.perpendicular,
    })),
  ),
];
export const columns = [
  { id: 'north-row', x: -18.15, z: -3.45, width: 0.7, depth: 0.7, height: 2.73 },
  { id: 'corner', x: -17.95, z: 0, width: 0.7, depth: 0.7 },
  { id: 'after-photo-4', x: -11.65, z: -0.2, width: 0.7, depth: 0.7 },
  { id: 'between-photo-6-7', x: 0.25, z: -0.2, width: 0.7, depth: 0.7 },
  { id: 'before-photo-9', x: 12.2, z: -0.45, width: 0.8, depth: 0.7 },
  { id: 'after-photo-9', x: 18.55, z: -0.2, width: 0.7, depth: 0.7 },
];
export const facts = {
  5: '值班窗口，前方为水饺超市。',
  6: '老卤面',
  7: '美味砂锅系列',
  8: '菜品台与窗口垂直，向厨房内部延伸。',
  9: '菜品台与窗口垂直；原照片保留“地科用餐窗口”小牌。',
  10: '学子特价套餐窗口；菜品台与窗口垂直。',
  11: '学子特价套餐窗口／深夜食堂窗口；菜品台与窗口垂直。',
  12: '菜品台与窗口垂直。',
  13: '值班窗口；菜品台与窗口垂直。',
  14: '菜品台与窗口垂直。',
  15: '菜品台与窗口垂直；右侧为消防柜。',
  16: '米线系列；与17号是同一档口，此处点餐。',
  17: '与16号是同一档口，此处取餐。',
};
