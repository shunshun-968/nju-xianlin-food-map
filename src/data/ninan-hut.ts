import type { Stall } from '../domain';

export const NINAN_HUT_VENUE_ID = 'v-hut';
export const NINAN_HUT_FLOOR_ID = 'v-hut-f1';
export type NinanMealMode = 'breakfast' | 'lunch' | 'dinner';

/** 照片10—13：鲜食柜在玻璃门面外，烤台复用白棚内的固定钢柜。 */
export const ninanDinnerLayout = {
  cabinet: { x: 2.6, y: 0.33, z: 2.8, rotationY: Math.PI / 2 },
  grill: { x: 4.4, y: 0.3, z: 6.4 },
} as const;

export function defaultNinanMealMode(night: boolean): NinanMealMode {
  return night ? 'dinner' : 'breakfast';
}

/** 整座小屋共用一个服务点；新版示意图 +X 为北、-Z 为西。尺寸为照片估计比例。 */
export const ninanHutStall: Stall = {
  id: 'v-hut-f1-service',
  floorId: NINAN_HUT_FLOOR_ID,
  name: '呢喃小屋',
  category: '早餐 · 饮品 · 烧烤',
  position: { x: 2, z: -2.8, width: 0.5, depth: 3.9, rotationY: 0 },
  serviceAreas: [
    { x: 4.4, z: 7.5, width: 3.8, depth: 0.5, rotationY: 0 },
    { x: 3.05, z: 2.8, width: 0.5, depth: 2.2, rotationY: 0 },
  ],
  breakfast: true,
  photoKey: null,
  dishes: [],
};
