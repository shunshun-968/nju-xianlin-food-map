import type { Catalog, Venue } from '../domain';
import { venueAnchors } from './campus';
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
  { id: 'v-10', name: '第十食堂', area: '东部生活区 · 静园南侧', kind: 'canteen', floors: 2 },
  {
    id: 'v-1112',
    name: '十一十二食堂',
    area: '西北生活区 · 科源广场北侧',
    kind: 'canteen',
    floors: 2,
  },
  {
    id: 'v-hut',
    name: '四五六食堂东侧美食小屋／小餐车',
    area: '四五六食堂东侧 · 蓝色 × 标注处',
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
  description: `位置按“${venueAnchors[venue.id].source}”标注。楼层与窗口目前为演示布局，后续接入实测数据。`,
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
const floors = venues.flatMap((v) =>
  Array.from({ length: v.floors }, (_, i) => ({
    id: `${v.id}-f${i + 1}`,
    venueId: v.id,
    level: i + 1,
    name: `${i + 1}F`,
    width: 32,
    depth: 22,
    elevation: i * 4,
    layoutVersion: 1,
  })),
);
export const catalog: Catalog = {
  version: 1,
  coordinateSystem: 'CAMPUS_PLAN_V2',
  venues,
  floors,
  stalls: floors.flatMap((f) =>
    names.map((name, i) => ({
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
          name: ['番茄鸡蛋面', '时蔬小炒', '鲜汤米线', '缤纷蔬菜碗', '香菇鸡肉饭', '葱香薄饼'][i],
          price: [12, 15, 13, 16, 14, 8][i],
          description: '演示菜品与参考价格，不代表实际在售商品。',
          photoKey: null,
        },
      ],
    })),
  ),
};
