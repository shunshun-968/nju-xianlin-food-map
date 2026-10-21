import type { Catalog, Venue } from '../domain';
// 所有位置为校园局部示意坐标，不是测量值或导航坐标。名称来自用户提供的采集目录。
const venues: Venue[] = [
  { id: 'v-456', name: '四五六食堂', shortName: '四五六', area: '学生生活区', kind: 'canteen', campusPosition: [-29, 11], footprint: [11, 8], floors: 3, description: '从日常的一碗面，到下课后的一顿热饭。未来在这里查看各层窗口与菜品。', verified: false },
  { id: 'v-891', name: '民族食堂 · 八九食堂', shortName: '八九食堂', area: '北部生活区', kind: 'canteen', campusPosition: [-31, -48], footprint: [12, 7], floors: 3, description: '多种风味的相遇。名称分组来自采集计划，具体建筑与楼层关系待现场核实。', verified: false },
  { id: 'v-10', name: '十食堂', shortName: '十食堂', area: '校园生活区', kind: 'canteen', campusPosition: [-27, 40], footprint: [9, 7], floors: 2, description: '校园里的日常好味道。空间和菜单等待同学们一起补全。', verified: false },
  { id: 'v-1112', name: '十一 · 十二食堂', shortName: '十一十二', area: '南部生活区', kind: 'canteen', campusPosition: [-16, 58], footprint: [11, 7], floors: 2, description: '今天想吃什么？后续将接入实拍照片、窗口位置与营业信息。', verified: false },
  { id: 'v-hut', name: '美食小屋 · 小餐车', shortName: '美食小屋', area: '四五六食堂东侧', kind: 'cart', campusPosition: [-13, 12], footprint: [5, 4], floors: 1, description: '一份顺路带走的小食。示例点位，尚未进行现场定位。', verified: false },
  { id: 'v-south', name: '南门小餐车', shortName: '南门餐车', area: '南门附近', kind: 'cart', campusPosition: [5, 76], footprint: [5, 4], floors: 1, description: '路过南门，把美味也带上。餐车位置和营业时间待采集。', verified: false },
  { id: 'v-yifu', name: '逸夫楼快餐售卖点', shortName: '逸夫楼', area: '教学区', kind: 'cart', campusPosition: [23, 38], footprint: [5, 4], floors: 1, description: '课堂之间的一餐。快餐售卖点的具体位置待核实。', verified: false },
];
const names = ['面食小站', '家常小炒', '热汤米线', '轻食时刻', '香香盖饭', '现做饼铺'];
const positions = [ [-10, -7, 0], [0, -7, 0], [10, -7, 0], [-10, 7, Math.PI], [0, 7, Math.PI], [10, 7, Math.PI] ];
const floors = venues.flatMap(v => Array.from({ length: v.floors }, (_, i) => ({ id: `${v.id}-f${i + 1}`, venueId: v.id, level: i + 1, name: `${i + 1}F`, width: 32, depth: 22, elevation: i * 4, layoutVersion: 1 })));
export const catalog: Catalog = { version: 1, coordinateSystem: 'CAMPUS_SCHEMATIC_V1', venues, floors,
  stalls: floors.flatMap(f => names.map((name, i) => ({ id: `${f.id}-s${i + 1}`, floorId: f.id, name, category: ['面食', '家常菜', '米线', '轻食', '盖饭', '小吃'][i], position: { x: positions[i][0], z: positions[i][1], rotationY: positions[i][2], width: 6, depth: 4 }, photoKey: null, dishes: [{ name: ['番茄鸡蛋面', '时蔬小炒', '鲜汤米线', '缤纷蔬菜碗', '香菇鸡肉饭', '葱香薄饼'][i], price: [12, 15, 13, 16, 14, 8][i], description: '演示菜品与参考价格，不代表实际在售商品。', photoKey: null }] }))) };
