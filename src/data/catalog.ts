import { FACULTY_CANTEEN_FLOOR_ID, facultyCanteenStalls } from './faculty-canteen';
import { TENTH_CANTEEN_FLOOR_ID, tenthCanteenStalls } from './tenth-canteen';
import type { Catalog, Venue } from '../domain';
import { venueAnchors } from './campus';
import { FOURTH_CANTEEN_FLOOR_ID, fourthCanteenStalls } from './fourth-canteen';
import { FIFTH_CANTEEN_FLOOR_ID, fifthCanteenStalls } from './fifth-canteen';
import { SIXTH_CANTEEN_FLOOR_ID, sixthCanteenStalls } from './sixth-canteen';
import { NINTH_CANTEEN_FLOOR_ID, ninthCanteenStalls } from './ninth-canteen';
import { EIGHTH_CANTEEN_FLOOR_ID, eighthCanteenStalls } from './eighth-canteen';
import { MINZU_CANTEEN_FLOOR_ID, minzuCanteenStalls } from './minzu-canteen';
import { TWELFTH_CANTEEN_FLOOR_ID, twelfthCanteenStalls } from './twelfth-canteen';
import { ELEVENTH_CANTEEN_FLOOR_ID, eleventhCanteenStalls } from './eleventh-canteen';
import { SOUTH_GATE_CART_FLOOR_ID, southGateCartStall } from './south-gate-cart';
import { YIFU_KIOSK_FLOOR_ID, yifuKioskStall } from './yifu-kiosk';
import { NINAN_HUT_FLOOR_ID, ninanHutStall } from './ninan-hut';
// Names follow the reference image filenames; positions are drawing units, not GPS.
const definitions: {
  id: string;
  name: string;
  area: string;
  kind: 'canteen' | 'cart';
  floors: number;
}[] = [
  { id: 'v-456', name: '四五六食堂', area: '西南生活区 · 宏育路西侧', kind: 'canteen', floors: 3 },
  {
    id: 'v-891',
    name: '民族食堂 八九食堂',
    area: '中西部 · 远东大道东侧',
    kind: 'canteen',
    floors: 3,
  },
  {
    id: 'v-10',
    name: '第十食堂与教工食堂',
    area: '东部生活区 · 静园南侧',
    kind: 'canteen',
    floors: 2,
  },
  {
    id: 'v-1112',
    name: '十一十二食堂',
    area: '西北生活区 · 科源广场北侧',
    kind: 'canteen',
    floors: 2,
  },
  {
    id: 'v-hut',
    name: '呢喃小屋',
    area: '四五六食堂东侧',
    kind: 'cart',
    floors: 1,
  },
  { id: 'v-south', name: '南门餐车', area: '南大门西侧 · 蓝色 × 标注处', kind: 'cart', floors: 1 },
  {
    id: 'v-yifu',
    name: '逸夫楼快餐售卖点',
    area: '邵逸夫楼北侧 · 蓝色 × 标注处',
    kind: 'cart',
    floors: 1,
  },
];
const venues: Venue[] = definitions.map((venue) => ({
  ...venue,
  shortName: venue.name,
  campusPosition: venueAnchors[venue.id].point,
  footprint: venueAnchors[venue.id].footprint,
  description:
    venue.id === 'v-10'
      ? '第十食堂与二层教工食堂均已按现场照片建立内部窗口模型；教工食堂共 7 个编号窗口。模型尺寸为示意比例。'
      : venue.id === 'v-456'
        ? '第四、第五、第六食堂分处一至三层。选择楼层，查看按照片建立的窗口模型；模型尺寸为示意比例。'
        : venue.id === 'v-891'
          ? '民族食堂、第八食堂、第九食堂分处一至三层，已按现场照片建立内部窗口模型；模型尺寸为示意比例。'
          : venue.id === 'v-1112'
            ? '第十一食堂位于一层、第十二食堂位于二层，均已按现场照片建立单排窗口模型。'
            : venue.id === 'v-south'
              ? '南大门西侧的开棚餐车，白天供应早餐，夜晚陈列炸串。'
              : venue.id === 'v-hut'
                ? '四五六食堂东侧的呢喃小屋，早上在小棚下供应早茶，中午供应饮品，晚上供应烧烤。可切换餐段查看外部场景与详情。'
                : venue.id === 'v-yifu'
                  ? '逸夫楼 B102 休闲食坊，提供早餐、点心、饮品与预订盒饭。按现场照片还原室内陈设，整间售卖点作为一个窗口。'
                  : `位置按“${venueAnchors[venue.id].source}”标注。楼层与窗口目前为演示布局，后续接入实测数据。`,
  verified: false,
}));
const names = ['面食小站', '家常小炒', '热汤米线', '轻食时刻', '香香盖饭', '现做饼铺'];
const positions = [
  [-10, -7, 0],
  [0, -7, 0],
  [10, -7, 0],
  [-10, 7, Math.PI],
  [0, 7, Math.PI],
  [10, 7, Math.PI],
];
const confirmedFloorNames: Record<string, string> = {
  [FOURTH_CANTEEN_FLOOR_ID]: '第四食堂',
  [FIFTH_CANTEEN_FLOOR_ID]: '第五食堂',
  [SIXTH_CANTEEN_FLOOR_ID]: '第六食堂',
  [NINTH_CANTEEN_FLOOR_ID]: '第九食堂',
  [EIGHTH_CANTEEN_FLOOR_ID]: '第八食堂',
  [MINZU_CANTEEN_FLOOR_ID]: '民族食堂',
  [TWELFTH_CANTEEN_FLOOR_ID]: '第十二食堂',
  [TENTH_CANTEEN_FLOOR_ID]: '第十食堂',
  [FACULTY_CANTEEN_FLOOR_ID]: '教工食堂',
  [ELEVENTH_CANTEEN_FLOOR_ID]: '第十一食堂',
  [YIFU_KIOSK_FLOOR_ID]: 'B102 休闲食坊',
  [NINAN_HUT_FLOOR_ID]: '呢喃小屋外部',
};
const floors = venues.flatMap((v) =>
  Array.from({ length: v.floors }, (_, i) => ({
    id: `${v.id}-f${i + 1}`,
    venueId: v.id,
    level: i + 1,
    name: confirmedFloorNames[`${v.id}-f${i + 1}`] ?? `${i + 1}F`,
    width:
      `${v.id}-f${i + 1}` === NINAN_HUT_FLOOR_ID
        ? 22
        : `${v.id}-f${i + 1}` === YIFU_KIOSK_FLOOR_ID
          ? 5.8
          : `${v.id}-f${i + 1}` === TENTH_CANTEEN_FLOOR_ID
            ? 52
            : `${v.id}-f${i + 1}` === ELEVENTH_CANTEEN_FLOOR_ID
              ? 58
              : [
                    NINTH_CANTEEN_FLOOR_ID,
                    TWELFTH_CANTEEN_FLOOR_ID,
                    FACULTY_CANTEEN_FLOOR_ID,
                  ].includes(`${v.id}-f${i + 1}`)
                ? 48
                : confirmedFloorNames[`${v.id}-f${i + 1}`]
                  ? 44
                  : 32,
    depth:
      `${v.id}-f${i + 1}` === NINAN_HUT_FLOOR_ID
        ? 22
        : `${v.id}-f${i + 1}` === YIFU_KIOSK_FLOOR_ID
          ? 6.8
          : `${v.id}-f${i + 1}` === TENTH_CANTEEN_FLOOR_ID
            ? 36
            : `${v.id}-f${i + 1}` === NINTH_CANTEEN_FLOOR_ID
              ? 40
              : `${v.id}-f${i + 1}` === MINZU_CANTEEN_FLOOR_ID
                ? 36
                : 22,
    elevation: i * 4,
    layoutVersion:
      confirmedFloorNames[`${v.id}-f${i + 1}`] || `${v.id}-f${i + 1}` === SOUTH_GATE_CART_FLOOR_ID
        ? 2
        : 1,
  })),
);
export const catalog: Catalog = {
  version: 1,
  coordinateSystem: 'CAMPUS_PLAN_V2',
  venues,
  floors,
  stalls: floors.flatMap((f) =>
    f.id === FACULTY_CANTEEN_FLOOR_ID
      ? facultyCanteenStalls
      : f.id === TENTH_CANTEEN_FLOOR_ID
        ? tenthCanteenStalls
        : f.id === NINAN_HUT_FLOOR_ID
          ? [ninanHutStall]
          : f.id === YIFU_KIOSK_FLOOR_ID
            ? [yifuKioskStall]
            : f.id === SOUTH_GATE_CART_FLOOR_ID
              ? [southGateCartStall]
              : f.id === ELEVENTH_CANTEEN_FLOOR_ID
                ? eleventhCanteenStalls
                : f.id === TWELFTH_CANTEEN_FLOOR_ID
                  ? twelfthCanteenStalls
                  : f.id === FOURTH_CANTEEN_FLOOR_ID
                    ? fourthCanteenStalls
                    : f.id === FIFTH_CANTEEN_FLOOR_ID
                      ? fifthCanteenStalls
                      : f.id === SIXTH_CANTEEN_FLOOR_ID
                        ? sixthCanteenStalls
                        : f.id === NINTH_CANTEEN_FLOOR_ID
                          ? ninthCanteenStalls
                          : f.id === EIGHTH_CANTEEN_FLOOR_ID
                            ? eighthCanteenStalls
                            : f.id === MINZU_CANTEEN_FLOOR_ID
                              ? minzuCanteenStalls
                              : names.map((name, i) => ({
                                  id: `${f.id}-s${i + 1}`,
                                  floorId: f.id,
                                  name,
                                  category: ['面食', '家常菜', '米线', '轻食', '盖饭', '小吃'][i],
                                  position: {
                                    x: positions[i][0],
                                    z: positions[i][1],
                                    rotationY: positions[i][2],
                                    width: 6,
                                    depth: 4,
                                  },
                                  photoKey: null,
                                  dishes: [
                                    {
                                      name: [
                                        '番茄鸡蛋面',
                                        '时蔬小炒',
                                        '鲜汤米线',
                                        '缤纷蔬菜碗',
                                        '香菇鸡肉饭',
                                        '葱香薄饼',
                                      ][i],
                                      price: [12, 15, 13, 16, 14, 8][i],
                                      description: '演示菜品与参考价格，不代表实际在售商品。',
                                      photoKey: null,
                                    },
                                  ],
                                })),
  ),
};
