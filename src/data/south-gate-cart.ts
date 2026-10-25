import type { Stall } from '../domain';

export const SOUTH_GATE_CART_VENUE_ID = 'v-south';
export const SOUTH_GATE_CART_FLOOR_ID = 'v-south-f1';
export const SOUTH_GATE_CART_HEIGHT = 3.55;

/** The entire cart is one service point; +Z faces the extended selling counter. */
export const southGateCartStall: Stall = {
  id: 'v-south-f1-cart',
  floorId: SOUTH_GATE_CART_FLOOR_ID,
  name: '南门餐车',
  category: '早餐 · 炸串',
  position: { x: 0, z: 0.4, width: 6.75, depth: 3.2, rotationY: 0 },
  breakfast: true,
  photoKey: null,
  dishes: [],
};

export const southGateCartFoodNames = {
  day: ['早餐汉堡', '饭团', '玉米', '茶叶蛋', '咖啡'],
  night: ['肉串', '香肠', '蔬菜串', '豆制品', '玉米串'],
};
