import type { Stall, StallPosition } from '../domain';
import type { FourthCanteenFace } from './fourth-canteen';

// Confirmed by the owner: third floor; each shop is one continuous serving area.
// North is -Z, east is +X. Dimensions are proportional, not a measured survey.
export const NINTH_CANTEEN_FLOOR_ID = 'v-891-f3';
export const NINTH_LAYOUT = {
  frontOffset: 1,
  kitchenDepth: 8.6,
  corner: { x: -18, z: -2 },
};

export type NinthCanteenFace = FourthCanteenFace & {
  stallId: string | null;
  sourcePhotoNumbers: number[];
  food: string;
  depth: number;
  role: 'counter' | 'recessed' | 'restaurant' | 'feature-wall' | 'return';
  counterInset?: number;
  /** Local service-front origins, independent of the full-width fascia/room. */
  serviceFrontages?: StallPosition[];
  openEnds?: ('left' | 'right')[];
  kitchenBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  displayOnly?: boolean;
};

type FaceInput = Omit<
  NinthCanteenFace,
  'id' | 'faceId' | 'stallId' | 'windowCount' | 'photoNumber' | 'kind'
> & {
  slug?: string;
  primaryShop?: string;
};
const cornerKitchen = { minX: -18, maxX: -12, minZ: -8, maxZ: -2 };
function frontage(input: FaceInput): NinthCanteenFace {
  const { slug = input.shopId, primaryShop = input.shopId, ...face } = input;
  const id = `${NINTH_CANTEEN_FLOOR_ID}-${slug}`;
  return {
    ...face,
    id,
    faceId: id,
    stallId: face.displayOnly ? null : `${NINTH_CANTEEN_FLOOR_ID}-${primaryShop}-w1`,
    windowCount: face.displayOnly ? 0 : 1,
    photoNumber: face.sourcePhotoNumbers[0],
    kind: face.food,
  };
}

export const ninthCanteenFaces: NinthCanteenFace[] = [
  frontage({
    shopId: 'yue-qing-he',
    name: '悦轻荷',
    food: '自选轻餐',
    x: -15,
    z: -3,
    width: 6,
    depth: 6,
    rotationY: 0,
    color: '#748e37',
    role: 'counter',
    sourcePhotoNumbers: [6, 7, 8],
    kitchenBounds: cornerKitchen,
    openEnds: ['left'],
  }),
  frontage({
    shopId: 'chili-pork',
    name: '辣椒炒肉',
    food: '湘味下饭菜',
    x: -9.75,
    z: -3,
    width: 4.5,
    depth: 8.6,
    rotationY: 0,
    color: '#458650',
    role: 'counter',
    sourcePhotoNumbers: [5],
  }),
  frontage({
    shopId: 'jimingtangbao',
    name: '雞鳴湯包',
    food: '汤包、面点',
    x: -5.25,
    z: -3,
    width: 4.5,
    depth: 8.6,
    rotationY: 0,
    color: '#9c4c3b',
    role: 'counter',
    sourcePhotoNumbers: [5],
  }),
  frontage({
    shopId: 'roast-goose',
    name: '項錦記 燒鵝',
    food: '烧鹅、广式烧腊',
    x: -0.25,
    z: -3,
    width: 5.5,
    depth: 8.6,
    rotationY: 0,
    color: '#35584c',
    role: 'counter',
    sourcePhotoNumbers: [4],
    // Photo 4: left glass counter turns into the room; the right 1.85 units stay open.
    serviceFrontages: [
      { x: -0.925, z: 0, width: 3.65, depth: 8.6, rotationY: 0 },
      { x: -0.1, z: -2.6, width: 5.3, depth: 3.65, rotationY: Math.PI / 2 },
    ],
  }),
  frontage({
    shopId: 'roujiamo',
    name: '左左香 · 老潼关肉夹馍',
    food: '肉夹馍、面食',
    x: 5.25,
    z: -3,
    width: 5.5,
    depth: 8.6,
    counterInset: 4.4,
    rotationY: 0,
    color: '#c96a55',
    role: 'recessed',
    sourcePhotoNumbers: [3],
  }),
  frontage({
    shopId: 'hot-dry-noodles',
    name: '武汉热干面',
    food: '热干面、炸酱面',
    x: 10.25,
    z: -3,
    width: 4.5,
    depth: 8.6,
    rotationY: 0,
    color: '#c39c54',
    role: 'counter',
    sourcePhotoNumbers: [1, 2],
  }),
  frontage({
    shopId: 'home-stir-fry',
    name: '百味小炒',
    food: '家常菜、小炒',
    x: 15,
    z: -3,
    width: 5,
    depth: 8.6,
    rotationY: 0,
    color: '#739ca2',
    role: 'counter',
    sourcePhotoNumbers: [1, 2],
  }),
  // Both fronts serve the SAME occupied corner kitchen and select the same shop.
  frontage({
    slug: 'yue-qing-he-west',
    shopId: 'yue-qing-he',
    name: '悦轻荷',
    food: '自选轻餐',
    x: -17,
    z: -5,
    width: 6,
    depth: 6,
    rotationY: -Math.PI / 2,
    color: '#748e37',
    role: 'counter',
    sourcePhotoNumbers: [7, 8],
    kitchenBounds: cornerKitchen,
    openEnds: ['right'],
  }),
  frontage({
    shopId: 'dongbei',
    name: '东北老味道',
    food: '烧烤 · 特色烤鱼',
    x: -17,
    z: -11,
    width: 6,
    depth: 6,
    rotationY: -Math.PI / 2,
    color: '#a59a79',
    role: 'counter',
    sourcePhotoNumbers: [9],
  }),
  frontage({
    shopId: 'seafood-hotpot',
    name: '渔船海鲜 · 自选老火锅',
    food: '海鲜、自选火锅',
    x: -17,
    z: -16.5,
    width: 5,
    depth: 6,
    rotationY: -Math.PI / 2,
    color: '#695146',
    role: 'counter',
    sourcePhotoNumbers: [10],
  }),
  // Facing north: the order in a front-facing photo is reversed relative to the plan.
  frontage({
    shopId: 'pizza-hut',
    name: '必胜客',
    food: '披萨、西式餐点',
    x: -14,
    z: 9.5,
    width: 8,
    depth: 5,
    rotationY: Math.PI,
    color: '#a53737',
    role: 'restaurant',
    sourcePhotoNumbers: [11, 12],
    kitchenBounds: { minX: -18, maxX: -4, minZ: 8.5, maxZ: 13.5 },
  }),
  frontage({
    slug: 'pizza-hut-wall',
    shopId: 'pizza-hut',
    name: 'Pizza Hut',
    food: '必胜客装饰墙',
    x: -7,
    z: 9.5,
    width: 6,
    depth: 5,
    rotationY: Math.PI,
    color: '#a53737',
    role: 'feature-wall',
    sourcePhotoNumbers: [12],
    displayOnly: true,
  }),
  frontage({
    shopId: 'burger-king',
    name: 'BURGER KING 汉堡王',
    food: '汉堡、薯条',
    x: 0,
    z: 9.5,
    width: 8,
    depth: 5,
    counterInset: 1.35,
    rotationY: Math.PI,
    color: '#ac764a',
    role: 'restaurant',
    sourcePhotoNumbers: [13],
  }),
  frontage({
    shopId: 'tray-return',
    name: '餐具回收区',
    food: '餐具回收',
    x: 14.5,
    z: 9.5,
    width: 6,
    depth: 3.5,
    rotationY: Math.PI,
    color: '#b59770',
    role: 'return',
    sourcePhotoNumbers: [14],
    displayOnly: true,
  }),
];

export function ninthArea(face: NinthCanteenFace): StallPosition {
  const offset = NINTH_LAYOUT.frontOffset - face.depth / 2;
  return {
    x: face.x + offset * Math.sin(face.rotationY),
    z: face.z + offset * Math.cos(face.rotationY),
    width: face.width,
    depth: face.depth,
    rotationY: face.rotationY,
  };
}

export function ninthServiceArea(face: NinthCanteenFace, service: StallPosition): StallPosition {
  const offset = NINTH_LAYOUT.frontOffset - service.depth / 2;
  const x = service.x + offset * Math.sin(service.rotationY);
  const z = service.z + offset * Math.cos(service.rotationY);
  return {
    x: face.x + x * Math.cos(face.rotationY) + z * Math.sin(face.rotationY),
    z: face.z - x * Math.sin(face.rotationY) + z * Math.cos(face.rotationY),
    width: service.width,
    depth: service.depth,
    rotationY: face.rotationY + service.rotationY,
  };
}

export const ninthCanteenStalls: Stall[] = ninthCanteenFaces
  .filter(
    (face, index, all) =>
      face.stallId && all.findIndex((f) => f.stallId === face.stallId) === index,
  )
  .map((face) => {
    const serviceAreas = face.serviceFrontages?.map((service) => ninthServiceArea(face, service));
    const extra = ninthCanteenFaces
      .filter((f) => f !== face && f.stallId === face.stallId)
      .map(ninthArea);
    if (serviceAreas) extra.push(...serviceAreas.slice(1));
    if (face.counterInset) {
      const depth = face.depth - face.counterInset;
      const offset = 1 - face.counterInset - depth / 2;
      extra.push({
        x: face.x + offset * Math.sin(face.rotationY),
        z: face.z + offset * Math.cos(face.rotationY),
        width: face.width,
        depth,
        rotationY: face.rotationY,
      });
    }
    return {
      id: face.stallId!,
      floorId: NINTH_CANTEEN_FLOOR_ID,
      name: face.name,
      category: face.food,
      position: serviceAreas?.[0] ?? ninthArea(face),
      ...(extra.length ? { serviceAreas: extra } : {}),
      photoKey: null,
      dishes: [],
    };
  });
