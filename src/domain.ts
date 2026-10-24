export type Point = [number, number];
export type Venue = {
  id: string;
  name: string;
  shortName: string;
  area: string;
  kind: 'canteen' | 'cart';
  campusPosition: Point;
  footprint: Point;
  floors: number;
  description: string;
  verified: boolean;
};
export type Floor = {
  id: string;
  venueId: string;
  level: number;
  name: string;
  width: number;
  depth: number;
  elevation: number;
  layoutVersion: number;
};
export type StallPosition = {
  x: number;
  z: number;
  rotationY: number;
  width: number;
  depth: number;
};
export type Stall = {
  id: string;
  floorId: string;
  name: string;
  category: string;
  position: StallPosition;
  /** Additional service faces belonging to this same shop and stable stall ID. */
  serviceAreas?: StallPosition[];
  dishes: { name: string; price: number | null; description: string; photoKey: string | null }[];
  photoKey: string | null;
  /** Confirmed breakfast location. Omitted means unknown, not unavailable. */
  breakfast?: boolean;
};
export type Catalog = {
  version: number;
  coordinateSystem: string;
  venues: Venue[];
  floors: Floor[];
  stalls: Stall[];
};
export type View =
  | { level: 'campus' }
  | { level: 'building'; venueId: string }
  | { level: 'floor'; venueId: string; floorId: string };
export type MapTheme = 'garden' | 'paper' | 'night';
export const themes = {
  garden: {
    name: '校园总平面',
    subtitle: '白色建筑 · 浅彩地点',
    ground: '#f0f0e7',
    park: '#cfd7b7',
    water: '#b8d2ce',
    road: '#e7e5df',
    building: '#fffefb',
    accent: '#d8bd82',
    text: '#465746',
  },
  paper: {
    name: '暖纸手绘',
    subtitle: '奶油纸色 · 陶土红',
    ground: '#efe7d8',
    park: '#d4d5b2',
    water: '#b9cfd0',
    road: '#fffaf0',
    building: '#dfd1b9',
    accent: '#b5654e',
    text: '#685944',
  },
  night: {
    name: '紫夜漫游',
    subtitle: '深色底图 · 微光窗口',
    ground: '#242638',
    park: '#313e41',
    water: '#304b61',
    road: '#53545d',
    building: '#48485d',
    accent: '#ba91df',
    text: '#e8e2ee',
  },
} as const;
export function validateCatalog(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return ['invalid catalog'];
  const data = raw as Catalog;
  if (
    data.version !== 1 ||
    typeof data.coordinateSystem !== 'string' ||
    ![data.venues, data.floors, data.stalls].every(Array.isArray)
  )
    return ['invalid catalog structure'];
  if (
    [...data.venues, ...data.floors, ...data.stalls].some(
      (row) => !row || typeof row.id !== 'string' || !row.id || typeof row.name !== 'string',
    )
  )
    return ['invalid entity structure'];
  const errors: string[] = [];
  for (const [kind, rows] of Object.entries({
    venues: data.venues,
    floors: data.floors,
    stalls: data.stalls,
  })) {
    if (new Set(rows.map((r) => r.id)).size !== rows.length) errors.push(`${kind}: duplicate id`);
  }
  for (const f of data.floors) {
    if (!data.venues.some((v) => v.id === f.venueId)) errors.push(`${f.id}: missing venue`);
    if (![f.width, f.depth, f.elevation].every(Number.isFinite) || !(f.width > 0 && f.depth > 0))
      errors.push(`${f.id}: invalid size`);
    if (!Number.isInteger(f.level) || !Number.isInteger(f.layoutVersion) || f.layoutVersion < 1)
      errors.push(`${f.id}: invalid floor version`);
  }
  for (const s of data.stalls) {
    const f = data.floors.find((f) => f.id === s.floorId);
    if (!f) {
      errors.push(`${s.id}: missing floor`);
      continue;
    }
    if (!s.position || !Array.isArray(s.dishes)) {
      errors.push(`${s.id}: invalid stall structure`);
      continue;
    }
    const validatePosition = (value: unknown, label: string) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${label}: invalid position`);
        return;
      }
      const p = value as StallPosition;
      if (
        ![p.x, p.z, p.rotationY, p.width, p.depth].every(Number.isFinite) ||
        p.width <= 0 ||
        p.depth <= 0
      ) {
        errors.push(`${label}: invalid position`);
        return;
      }
      const c = Math.abs(Math.cos(p.rotationY)),
        n = Math.abs(Math.sin(p.rotationY));
      if (
        Math.abs(p.x) + (p.width * c + p.depth * n) / 2 > f.width / 2 + 1e-6 ||
        Math.abs(p.z) + (p.width * n + p.depth * c) / 2 > f.depth / 2 + 1e-6
      )
        errors.push(`${label}: outside floor`);
    };
    validatePosition(s.position, s.id);
    if (s.serviceAreas !== undefined) {
      if (!Array.isArray(s.serviceAreas)) errors.push(`${s.id}: invalid service areas`);
      else
        for (const [index, area] of s.serviceAreas.entries())
          validatePosition(area, `${s.id}: serviceAreas[${index}]`);
    }
  }
  return errors;
}
export function mediaUrl(key: string | null, base: string): string | null {
  if (!key || !base) return null;
  if (
    key.startsWith('/') ||
    key.split('/').some((p) => !p || p === '.' || p === '..') ||
    /[\\?#:]/.test(key)
  )
    throw new Error('Invalid storage key');
  return `${base.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
