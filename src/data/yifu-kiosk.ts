import type { Stall } from '../domain';

export const YIFU_KIOSK_VENUE_ID = 'v-yifu';
export const YIFU_KIOSK_FLOOR_ID = 'v-yifu-f1';
export const YIFU_KIOSK_HEIGHT = 3.5;

/** B102 整间售卖点共用一个窗口身份；南侧开口为 +Z，北侧窗帘为 -Z。 */
export const yifuKioskStall: Stall = {
  id: 'v-yifu-f1-kiosk',
  floorId: YIFU_KIOSK_FLOOR_ID,
  name: '逸夫楼 B102 休闲食坊',
  category: '早餐 · 点心 · 饮品 · 盒饭',
  position: { x: 0, z: 0, width: 5.8, depth: 6.8, rotationY: 0 },
  breakfast: true,
  photoKey: null,
  dishes: [],
};

/** 只转录图 3 招牌可辨认的内容，不推断当前库存或新增价格。 */
export const yifuKioskOfferings = [
  { category: '早餐与点心', names: ['手抓饼', '鸡蛋饼', '包子', '玉米', '茶叶蛋'] },
  { category: '饮品', names: ['纯牛奶', '酸奶', '早餐豆浆'] },
  {
    category: '预订餐食',
    names: ['盒饭', '椒麻鸡', '手工水饺', '鸡排饭', '猪排饭', '烤鸭饭', '牛排饭'],
  },
];

export const yifuKioskFoodNames = ['早餐', '点心', '饮品', '盒饭'];
export const yifuKioskServiceNote =
  '招牌注明周一至周五供应，节假日休息；午餐 10 点前、晚餐 5 点前预订。';
