import type { Point } from '../domain';

/** Drawing units on the reference image, x right / y down. No geographic CRS. */
export const campusFrame = { x: 115, y: 155, width: 1010, height: 1510 };
export type VenueAnchor = {
  point: Point;
  footprint: Point;
  rotation: number;
  color: string;
  side: string;
  source: string;
  replaces?: string;
  labelOffset: Point;
};
// Blue crosses locate the carts; file basenames are authoritative display names.
export const venueAnchors: Record<string, VenueAnchor> = {
  'v-456': {
    point: [469, 1464],
    footprint: [47, 43],
    rotation: -22,
    color: '#f1dda0',
    side: '#d6c38c',
    source: '四五六食堂.jpg',
    replaces: 'plan-7-230',
    labelOffset: [-53, 13],
  },
  'v-891': {
    point: [484, 1081],
    footprint: [35, 46],
    rotation: -22,
    color: '#eccbd3',
    side: '#cfadb7',
    source: '民族食堂 八九食堂.jpg',
    replaces: 'plan-7-115',
    labelOffset: [-36, -31],
  },
  'v-10': {
    point: [964, 1212],
    footprint: [51, 31],
    rotation: -17,
    color: '#d7cce9',
    side: '#b9acd0',
    source: '第十食堂.jpg',
    replaces: 'plan-7-172',
    labelOffset: [38, -19],
  },
  'v-1112': {
    point: [282, 650],
    footprint: [44, 34],
    rotation: 5,
    color: '#c7dfd3',
    side: '#a8c7b9',
    source: '十一十二食堂.png',
    replaces: 'plan-7-43',
    labelOffset: [-45, -7],
  },
  'v-hut': {
    point: [509, 1465],
    footprint: [13, 9],
    rotation: -22,
    color: '#f2cdb3',
    side: '#d5af95',
    source: '四五六食堂东侧美食小屋／小餐车.jpg',
    labelOffset: [70, -38],
  },
  'v-south': {
    point: [806, 1595],
    footprint: [14, 9],
    rotation: -10,
    color: '#eacddf',
    side: '#c9a8bc',
    source: '南门餐车.jpg',
    labelOffset: [51, 22],
  },
  'v-yifu': {
    point: [780, 1506],
    footprint: [15, 9],
    rotation: -8,
    color: '#c7dce9',
    side: '#a6bdcf',
    source: '逸夫楼快餐售卖点.jpg',
    labelOffset: [68, 0],
  },
};

type Label = {
  name: string;
  x: number;
  y: number;
  tier: 0 | 1 | 2;
  kind?: 'water' | 'land' | 'building' | 'road';
  rotation?: number;
};
export const campusLabels: Label[] = [
  { name: '南雍山', x: 865, y: 784, tier: 0, kind: 'land' },
  { name: '梅岭', x: 615, y: 954, tier: 0, kind: 'land' },
  { name: '杜厦图书馆', x: 768, y: 1261, tier: 0 },
  { name: '第一运动场', x: 629, y: 1418, tier: 0 },
  { name: '第二运动场', x: 333, y: 817, tier: 0 },
  { name: '基础实验楼', x: 581, y: 1543, tier: 0 },
  { name: '南大门', x: 842, y: 1578, tier: 1 },
  { name: '中大门', x: 239, y: 1013, tier: 1 },
  { name: '科源广场', x: 296, y: 715, tier: 1, kind: 'land' },
  { name: '香雪海', x: 368, y: 927, tier: 1, kind: 'water' },
  { name: '临洲池', x: 528, y: 750, tier: 1, kind: 'water' },
  { name: '藜照湖', x: 845, y: 1273, tier: 1, kind: 'water' },
  { name: '梦川', x: 693, y: 1331, tier: 1, kind: 'water' },
  { name: '菜根谭', x: 561, y: 1261, tier: 2, kind: 'water' },
  { name: '天文与空间科学学院', x: 766, y: 475, tier: 1 },
  { name: '量子材料微结构研究中心', x: 721, y: 440, tier: 2 },
  { name: '大数据与人工智能科研楼', x: 440, y: 675, tier: 1 },
  { name: '军民融合研发中心', x: 501, y: 679, tier: 1 },
  { name: '现代工程与应用科学学院', x: 467, y: 756, tier: 1 },
  { name: '医学院', x: 432, y: 848, tier: 1 },
  { name: '生命科学学院', x: 457, y: 891, tier: 1 },
  { name: '化学化工学院', x: 291, y: 947, tier: 1 },
  { name: '环境学院', x: 330, y: 1052, tier: 1 },
  { name: '大气科学学院', x: 468, y: 1004, tier: 1 },
  { name: '毓秀院', x: 570, y: 881, tier: 2 },
  { name: '左涤江天文台', x: 807, y: 714, tier: 1 },
  { name: '新闻传播学院', x: 743, y: 864, tier: 1 },
  { name: '历史学院', x: 728, y: 929, tier: 1 },
  { name: '社会学院', x: 762, y: 983, tier: 1 },
  { name: '政府管理学院', x: 751, y: 1043, tier: 1 },
  { name: '国际关系学院', x: 798, y: 1068, tier: 2 },
  { name: '信息管理学院', x: 787, y: 1094, tier: 2 },
  { name: '哲学系', x: 703, y: 1091, tier: 2 },
  { name: '文学院', x: 751, y: 1125, tier: 1 },
  { name: '外国语学院', x: 819, y: 1120, tier: 1 },
  { name: '游泳馆', x: 675, y: 1121, tier: 2 },
  { name: '校医院', x: 333, y: 1143, tier: 1 },
  { name: '学生活动中心', x: 659, y: 1276, tier: 1 },
  { name: '展览馆', x: 659, y: 1233, tier: 2 },
  { name: '520广场', x: 701, y: 1300, tier: 2, kind: 'land' },
  { name: '体育馆', x: 526, y: 1385, tier: 1 },
  { name: '思源楼', x: 728, y: 1390, tier: 1 },
  { name: '择善楼', x: 741, y: 1453, tier: 1 },
  { name: '地理与海洋科学学院', x: 871, y: 1388, tier: 1 },
  { name: '地球科学与工程学院', x: 870, y: 1445, tier: 1 },
  { name: '电子科学与工程学院', x: 871, y: 1524, tier: 1 },
  { name: '计算机科学与技术系', x: 969, y: 1507, tier: 1 },
  { name: '国际学院', x: 716, y: 1530, tier: 2 },
  { name: '行政楼北楼', x: 956, y: 1365, tier: 1 },
  { name: '行政楼南楼', x: 957, y: 1414, tier: 1 },
  { name: '星云楼 · 会议中心', x: 956, y: 1274, tier: 1 },
  { name: '档案馆', x: 742, y: 1199, tier: 2 },
  { name: '信息化建设管理服务中心', x: 801, y: 1194, tier: 2 },
  { name: '第二体育馆', x: 240, y: 765, tier: 1 },
  { name: '智慧园', x: 890, y: 235, tier: 1 },
  { name: '大学城科技园', x: 980, y: 430, tier: 1 },
];
const dorms: [number, number, number][] = [
  [1, 414, 1342],
  [2, 473, 1269],
  [3, 357, 1272],
  [4, 443, 1195],
  [5, 335, 1210],
  [6, 646, 1191],
  [7, 610, 1153],
  [8, 584, 1124],
  [9, 523, 1162],
  [10, 550, 1119],
  [11, 523, 1068],
  [12, 892, 1230],
  [13, 865, 1170],
  [14, 925, 1170],
  [15, 982, 1171],
  [16, 233, 658],
  [17, 234, 602],
  [18, 242, 540],
  [19, 289, 540],
  [20, 338, 537],
  [21, 385, 535],
  [22, 294, 579],
  [23, 360, 585],
  [24, 352, 648],
  [25, 719, 496],
  [26, 443, 556],
  [27, 446, 601],
];
campusLabels.push(
  ...dorms.map(([n, x, y]) => ({ name: `学生公寓${n}幢`, x, y, tier: 2 as const })),
);
