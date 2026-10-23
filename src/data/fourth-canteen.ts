import type { Stall } from '../domain';

export const FOURTH_CANTEEN_FLOOR_ID = 'v-456-f1';
export const FOURTH_LAYOUT = {
  frontOffset: 1,
  kitchenDepth: 3.5,
  corner: { x: -17.5, z: 7.3 },
} as const;

/** Photo numbers identify reference segments, not individual service windows. */
export type FourthCanteenFace = {
  id: string;
  faceId: string;
  shopId: string;
  name: string;
  windowCount: number;
  x: number;
  z: number;
  width: number;
  rotationY: number;
  color: string;
  photoNumber: number;
  kind: string;
};

const mainWindows = [
  { slug: 'maijindi', name: '优品麦选', color: '#e5bd48', photoNumber: 6, kind: '面点' },
  { slug: 'zhongyuan', name: '中原风味', color: '#bf5652', photoNumber: 5, kind: '中原风味' },
  { slug: 'fujian', name: '福建风味', color: '#9079a7', photoNumber: 4, kind: '福建风味' },
  { slug: 'xiang-egang', name: '湘鄂赣风味', color: '#669b76', photoNumber: 4, kind: '湘鄂赣风味' },
  { slug: 'chuanyu', name: '川渝风味', color: '#d59854', photoNumber: 3, kind: '川渝风味' },
  { slug: 'xibei', name: '西北风味', color: '#be5652', photoNumber: 3, kind: '西北风味' },
  { slug: 'guangshi', name: '广式风味', color: '#6c9a71', photoNumber: 2, kind: '广式风味' },
  { slug: 'dongbei', name: '东北风味', color: '#638ca9', photoNumber: 2, kind: '东北风味' },
  {
    slug: 'chuangyi',
    name: '创意融合',
    color: '#b96d59',
    photoNumber: 1,
    kind: '融合风味',
    width: 2.2,
    windowCount: 1,
  },
  {
    slug: 'jitang-mixian',
    name: '蒙自源鸡汤米线',
    color: '#b6b870',
    photoNumber: 1,
    kind: '米线',
    width: 3,
    windowCount: 2,
  },
];

export const fourthCanteenFaces: FourthCanteenFace[] = [
  ...mainWindows.map((window, index) => ({
    id: `${FOURTH_CANTEEN_FLOOR_ID}-${window.slug}`,
    faceId: `${FOURTH_CANTEEN_FLOOR_ID}-${window.slug}`,
    shopId: window.slug,
    name: window.name,
    windowCount: window.windowCount ?? 2,
    x:
      -17.5 +
      mainWindows.slice(0, index).reduce((total, row) => total + (row.width ?? 3.5), 0) +
      (window.width ?? 3.5) / 2,
    z: 6.3,
    width: window.width ?? 3.5,
    rotationY: 0,
    color: window.color,
    photoNumber: window.photoNumber,
    kind: window.kind,
  })),
  {
    // Both 麦金地 frontages share one occupied kitchen across the convex corner.
    id: `${FOURTH_CANTEEN_FLOOR_ID}-maijindi-side`,
    faceId: `${FOURTH_CANTEEN_FLOOR_ID}-maijindi-side`,
    shopId: 'maijindi',
    name: '酱香醇厚',
    windowCount: 1,
    x: -16.5,
    z: 5.55,
    width: 3.5,
    rotationY: -Math.PI / 2,
    color: '#e5bd48',
    photoNumber: 6,
    kind: '面点',
  },
  {
    id: `${FOURTH_CANTEEN_FLOOR_ID}-jinling`,
    faceId: `${FOURTH_CANTEEN_FLOOR_ID}-jinling`,
    shopId: 'jinling',
    name: '金陵风味',
    windowCount: 2,
    x: -16.5,
    z: 2.05,
    width: 3.5,
    rotationY: -Math.PI / 2,
    color: '#b3a6c5',
    photoNumber: 7,
    kind: '金陵风味',
  },
  {
    id: `${FOURTH_CANTEEN_FLOOR_ID}-shuijiao-huntun`,
    faceId: `${FOURTH_CANTEEN_FLOOR_ID}-shuijiao-huntun`,
    shopId: 'shuijiao-huntun',
    name: '京兜水饺馄饨',
    windowCount: 2,
    x: -16.5,
    z: -1.45,
    width: 3.5,
    rotationY: -Math.PI / 2,
    color: '#99a7ae',
    photoNumber: 7,
    kind: '水饺馄饨',
  },
];

/** Local +Z faces the corridor; the kitchen extends behind the service plane. */
export function fourthKitchenBounds(face: FourthCanteenFace) {
  const clean = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);
  const cosine = clean(Math.cos(face.rotationY));
  const sine = clean(Math.sin(face.rotationY));
  const corners = [-face.width / 2, face.width / 2].flatMap((localX) =>
    [FOURTH_LAYOUT.frontOffset, FOURTH_LAYOUT.frontOffset - FOURTH_LAYOUT.kitchenDepth].map(
      (localZ) => ({
        x: face.x + localX * cosine + localZ * sine,
        z: face.z - localX * sine + localZ * cosine,
      }),
    ),
  );
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minZ: Math.min(...corners.map((point) => point.z)),
    maxZ: Math.max(...corners.map((point) => point.z)),
  };
}

// User confirmed: 创意融合 1; 蒙自源 2 smaller windows; 麦金地 2 + 1 across the corner.
export const fourthCanteenStalls: Stall[] = fourthCanteenFaces.flatMap((face) =>
  Array.from({ length: face.windowCount }, (_, index) => {
    const width = face.width / face.windowCount;
    const localX = -face.width / 2 + width * (index + 0.5);
    const localZ = FOURTH_LAYOUT.frontOffset - FOURTH_LAYOUT.kitchenDepth / 2;
    return {
      id: `${face.faceId}-w${index + 1}`,
      floorId: FOURTH_CANTEEN_FLOOR_ID,
      name: `${face.name} · ${index + 1}号窗口`,
      category: face.kind,
      position: {
        x: face.x + localX * Math.cos(face.rotationY) + localZ * Math.sin(face.rotationY),
        z: face.z - localX * Math.sin(face.rotationY) + localZ * Math.cos(face.rotationY),
        width,
        depth: FOURTH_LAYOUT.kitchenDepth,
        rotationY: face.rotationY,
      },
      photoKey: null,
      dishes: [],
    };
  }),
);
