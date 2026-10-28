import manifest from '../assets/campus-models/manifest.json';
import type { MapVenue, XY } from './campus-basemap';

export const modeledCampusVenueIds = [
  'v-456',
  'v-891',
  'v-10',
  'v-1112',
  'v-south',
  'v-yifu',
  'v-hut',
] as const;
export type ModeledCampusVenueId = (typeof modeledCampusVenueIds)[number];
export type CampusModelMetadata = {
  /** The pre-rendered image bounds in map metres relative to its unchanged ground anchor. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  referenceWidth: number;
  referenceDepth: number;
  /** The image already contains this orientation. Never rotate it again at runtime. */
  angle: number;
};
const metadata = manifest as Partial<Record<ModeledCampusVenueId, CampusModelMetadata>>;
const artwork: Record<ModeledCampusVenueId, { day: string; night: string }> = {
  'v-456': {
    day: new URL('../assets/campus-models/v-456-day.webp', import.meta.url).href,
    night: new URL('../assets/campus-models/v-456-night.webp', import.meta.url).href,
  },
  'v-891': {
    day: new URL('../assets/campus-models/v-891-day.webp', import.meta.url).href,
    night: new URL('../assets/campus-models/v-891-night.webp', import.meta.url).href,
  },
  'v-10': {
    day: new URL('../assets/campus-models/v-10-day.webp', import.meta.url).href,
    night: new URL('../assets/campus-models/v-10-night.webp', import.meta.url).href,
  },
  'v-1112': {
    day: new URL('../assets/campus-models/v-1112-day.webp', import.meta.url).href,
    night: new URL('../assets/campus-models/v-1112-night.webp', import.meta.url).href,
  },
  'v-south': {
    day: new URL('../assets/campus-models/v-south-day.webp', import.meta.url).href,
    night: new URL('../assets/campus-models/v-south-night.webp', import.meta.url).href,
  },
  'v-yifu': {
    day: new URL('../assets/campus-models/v-yifu-day.webp', import.meta.url).href,
    night: new URL('../assets/campus-models/v-yifu-night.webp', import.meta.url).href,
  },
  'v-hut': {
    day: new URL('../assets/campus-models/v-hut-day.webp', import.meta.url).href,
    night: new URL('../assets/campus-models/v-hut-night.webp', import.meta.url).href,
  },
};

export type CampusModelPlacement = {
  hrefDay: string;
  hrefNight: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: XY;
  groundPolygon: XY[];
  groundWidth: number;
  groundDepth: number;
  boost: number;
  hitBounds: { x: number; y: number; width: number; height: number };
};

export function getCampusModelPlacement(
  venue: MapVenue,
  scale: number,
): CampusModelPlacement | undefined {
  const id = venue.id as ModeledCampusVenueId;
  const asset = artwork[id],
    entry = metadata[id];
  if (!asset || !entry) return undefined;
  const pixelsPerMetre = Number.isFinite(scale) && scale > 0 ? scale : 1;
  // Images are already aligned to the approved map footprint; all geometry uses one uniform factor.
  const referenceScale = Math.min(
    venue.width / entry.referenceWidth,
    venue.depth / entry.referenceDepth,
  );
  let originalBoost =
    id === 'v-south' || id === 'v-hut'
      ? Math.max(1.3 * referenceScale, 18 / (entry.width * pixelsPerMetre))
      : 1.14 * referenceScale;
  // Half the previous visual area at every zoom, with the same ground anchor and pick target.
  let boost = originalBoost * (id === 'v-south' ? Math.SQRT1_2 : 1);
  if (id === 'v-yifu') {
    // B102 是小型售卖点：在每一级缩放下都装入餐车大小的显示框，
    // 只缩放模型图与脚印，绝不改动批准的室内点位坐标。
    const cart = metadata['v-south'];
    if (cart) {
      const cartBoost =
        Math.max(1.3 * referenceScale, 18 / (cart.width * pixelsPerMetre)) * Math.SQRT1_2;
      boost = Math.min(cart.width / entry.width, cart.height / entry.height) * cartBoost * 1.05;
      originalBoost = boost;
    }
  }
  const [anchorX, anchorY] = venue.point;
  const x = anchorX + entry.offsetX * boost,
    y = anchorY + entry.offsetY * boost;
  const width = entry.width * boost,
    height = entry.height * boost;
  const groundWidth = venue.width * (boost / referenceScale);
  const groundDepth = venue.depth * (boost / referenceScale);
  const angle = (venue.angle * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const groundPolygon: XY[] = [
    [-groundWidth / 2, -groundDepth / 2],
    [groundWidth / 2, -groundDepth / 2],
    [groundWidth / 2, groundDepth / 2],
    [-groundWidth / 2, groundDepth / 2],
  ].map(([dx, dy]) => [anchorX + dx * c - dy * s, anchorY + dx * s + dy * c]);
  const minHitRadius = 12 / pixelsPerMetre;
  const hitLeft = Math.min(anchorX + entry.offsetX * originalBoost, anchorX - minHitRadius),
    hitTop = Math.min(anchorY + entry.offsetY * originalBoost, anchorY - minHitRadius);
  const hitRight = Math.max(
      anchorX + (entry.offsetX + entry.width) * originalBoost,
      anchorX + minHitRadius,
    ),
    hitBottom = Math.max(
      anchorY + (entry.offsetY + entry.height) * originalBoost,
      anchorY + minHitRadius,
    );
  return {
    hrefDay: asset.day,
    hrefNight: asset.night,
    x,
    y,
    width,
    height,
    anchor: [anchorX, anchorY],
    groundPolygon,
    groundWidth,
    groundDepth,
    boost,
    hitBounds: { x: hitLeft, y: hitTop, width: hitRight - hitLeft, height: hitBottom - hitTop },
  };
}

/** World-space artwork rectangle; callers apply the current map transform for screen-space labels. */
export function getCampusModelBounds(venue: MapVenue, scale: number) {
  const placement = getCampusModelPlacement(venue, scale);
  return placement
    ? {
        left: placement.x,
        top: placement.y,
        right: placement.x + placement.width,
        bottom: placement.y + placement.height,
      }
    : undefined;
}
