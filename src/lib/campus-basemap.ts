import { overlaps, placeMapLabels, type PlacedLabel } from './map-labels';

export type XY = [number, number];
export type MapFrame = { matrix: number[]; width: number; height: number };
export type MapFeature = {
  renderOrder?: number;
  id: string;
  kind: 'road' | 'building' | 'water' | 'land';
  name: string;
  path: string;
  area: number;
  bounds: [number, number, number, number];
  centre: XY;
  width?: number;
  footway?: boolean;
  boundaryPath?: string;
  lines?: XY[][];
  subtype?: string;
  labelPoint?: XY;
  labelRadius?: number;
  sport?: string;
  frame?: MapFrame;
  inCampus?: boolean;
};
export type MapVenue = {
  id: string;
  name: string;
  osmId?: string;
  point: XY;
  width: number;
  depth: number;
  angle: number;
  height: number;
  color: string;
  indoor: boolean;
  sourceCoordinates?: XY;
};
export type CampusBasemap = {
  version: number;
  bounds: [number, number, number, number];
  campusPath: string;
  retainedPath: string;
  contextPath: string;
  coverageBounds: [number, number, number, number];
  southBufferMetres: number;
  features: MapFeature[];
  venues: MapVenue[];
  observatory: XY;
};
export type CampusContours = {
  version: number;
  intervalMetres: number;
  maskPath: string;
  endpointFadeMetres?: number;
  lines: {
    id: string;
    elevation: number;
    path: string;
    bounds?: [number, number, number, number];
    endpoints?: XY[];
  }[];
};
export type MapTransform = { x: number; y: number; scale: number; zoom: number };
export type DetailLabel = {
  id: string;
  kind: 'road' | 'building';
  text: string;
  x: number;
  y: number;
  angle: number;
  width: number;
  height: number;
  box: PlacedLabel['box'];
  roadWidth?: number;
  sourceArea?: number;
  sourceRadius?: number;
  fontSize?: number;
  lines?: string[];
  overview?: boolean;
};

export const zoomStepFactor = 1.2;
export const initialZoom = zoomStepFactor;
export const landmarkZoomThreshold = zoomStepFactor ** 2;
export const detailZoomThreshold = 1.6 * zoomStepFactor ** 2;
export const roadZoomThreshold = 2.3;
/** A physical mouse detent is one level; small trackpad deltas stay continuous. */
export function wheelZoomFactor(deltaY: number, deltaMode = 0) {
  if (!deltaY) return 1;
  const magnitude = Math.abs(deltaY);
  const steps =
    deltaMode === 1
      ? magnitude / 3
      : deltaMode === 2
        ? magnitude
        : magnitude < 40
          ? magnitude / 100
          : Math.max(1, Math.round(magnitude / 100));
  return zoomStepFactor ** (-Math.sign(deltaY) * Math.min(6, steps));
}
export const textWidth = (text: string, fontSize: number) =>
  [...text].reduce((sum, c) => sum + (/[\u0000-\u007f]/.test(c) ? 0.68 : 1.07) * fontSize, 0);

export function venueLines(venue: MapVenue) {
  if (venue.id === 'v-891') return ['民族食堂', '第八、九食堂'];
  if (venue.id === 'v-hut') return ['四五六食堂东侧', '美食小&小餐车'];
  return venue.indoor ? [venue.name, '室内'] : [venue.name];
}

export function mapLabels(
  data: CampusBasemap,
  t: MapTransform,
  viewport: { width: number; height: number },
  reserved: PlacedLabel['box'][],
  showDetails: boolean,
) {
  const screen = ([x, y]: XY): XY => [x * t.scale + t.x, y * t.scale + t.y];
  const preferred: Record<string, XY> = {
    'v-456': [-60, 8],
    'v-hut': [75, 12],
    'v-yifu': [64, -31],
    'v-south': [61, 28],
  };
  // Primary food labels have no zoom threshold. Overlay avoidance follows the existing UI contract.
  const food = placeMapLabels(
    data.venues.map((v) => {
      const [x, y] = screen(v.point);
      return {
        id: v.id,
        lines: venueLines(v),
        x,
        y: y - v.height * t.scale,
        priority: 0,
        fontSize: 10.5,
        badge: true,
        preferred: preferred[v.id],
      };
    }),
    viewport,
    reserved,
  );
  const details: DetailLabel[] = [];
  if (!showDetails) return { food, details };
  const occupied = [...reserved, ...food.map((label) => label.box)];
  const venueBuildings = new Set(data.venues.map((v) => v.osmId));
  const envelopeArea = (f: MapFeature) => (f.bounds[2] - f.bounds[0]) * (f.bounds[3] - f.bounds[1]);
  const overviewBuildings = new Set(
    data.features
      .filter(
        (f) =>
          f.kind === 'building' &&
          f.name &&
          f.area >= 6000 &&
          f.inCampus !== false &&
          !/宿舍|公寓/.test(f.name) &&
          !venueBuildings.has(f.id),
      )
      .sort((a, b) => envelopeArea(b) - envelopeArea(a))
      .slice(0, 5)
      .map((f) => f.id),
  );
  const overviewLines: Record<string, string[]> = {
    'relation/8461730': ['现代工程与', '应用科学学院'],
    'way/99814435': ['敬文学生', '活动中心'],
  };
  function add(label: Omit<DetailLabel, 'box'>) {
    const r = (label.angle * Math.PI) / 180;
    const w = Math.abs(label.width * Math.cos(r)) + Math.abs(label.height * Math.sin(r));
    const h = Math.abs(label.width * Math.sin(r)) + Math.abs(label.height * Math.cos(r));
    const box = {
      left: label.x - w / 2 - 2,
      right: label.x + w / 2 + 2,
      top: label.y - h / 2 - 2,
      bottom: label.y + h / 2 + 2,
    };
    if (
      box.left < 6 ||
      box.right > viewport.width - 6 ||
      box.top < 6 ||
      box.bottom > viewport.height - 6 ||
      occupied.some((other) => overlaps(box, other))
    )
      return false;
    details.push({ ...label, box });
    occupied.push(box);
    return true;
  }
  for (const feature of data.features
    .filter((f) => f.kind === 'building' && f.name && !venueBuildings.has(f.id))
    .sort(
      (a, b) =>
        Number(overviewBuildings.has(b.id)) - Number(overviewBuildings.has(a.id)) ||
        envelopeArea(b) - envelopeArea(a),
    )) {
    const overview = overviewBuildings.has(feature.id);
    if (overview && t.zoom < landmarkZoomThreshold) continue;
    if (!overview && t.zoom < detailZoomThreshold) continue;
    const fontSize = overview && t.zoom < detailZoomThreshold ? 9.5 : 10.5;
    const lines = overviewLines[feature.id] || [feature.name];
    const naturalWidth = Math.max(...lines.map((line) => textWidth(line, fontSize))),
      height = lines.length * 12;
    const [left, top, right, bottom] = feature.bounds;
    const maxWidth = (right - left) * t.scale * 1.1,
      maxHeight = (bottom - top) * t.scale * 1.1;
    // Names can use the building's envelope (including its courtyard); at most
    // 10% total overflow in either dimension. Slight compression keeps key overview names readable.
    const width = Math.min(naturalWidth, maxWidth);
    if (width < naturalWidth * 0.8 || height > maxHeight) continue;
    const [x, y] = screen([(left + right) / 2, (top + bottom) / 2]);
    add({
      id: feature.id,
      kind: 'building',
      text: feature.name,
      x,
      y,
      angle: 0,
      width,
      height,
      sourceArea: envelopeArea(feature),
      fontSize,
      lines,
      overview,
    });
  }
  const roads: (Omit<DetailLabel, 'box'> & { score: number })[] = [];
  for (const feature of data.features.filter(
    (f) => t.zoom >= roadZoomThreshold && f.kind === 'road' && f.name && !f.footway,
  )) {
    const height = 10,
      width = textWidth(feature.name, 9.5),
      roadWidth = (feature.width || 0) * t.scale;
    if (roadWidth < height + 3) continue;
    for (const line of feature.lines || [])
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = screen(line[i - 1]),
          [bx, by] = screen(line[i]);
        const dx = bx - ax,
          dy = by - ay,
          length = Math.hypot(dx, dy);
        if (length < width + 16) continue;
        const margin = (width / 2 + 8) / length;
        const u = Math.max(
          margin,
          Math.min(
            1 - margin,
            ((viewport.width / 2 - ax) * dx + (viewport.height / 2 - ay) * dy) / (length * length),
          ),
        );
        const x = ax + dx * u,
          y = ay + dy * u;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        roads.push({
          id: `${feature.id}-${i}`,
          kind: 'road',
          text: feature.name,
          x,
          y,
          angle,
          width,
          height,
          roadWidth,
          score: Math.hypot(x - viewport.width / 2, y - viewport.height / 2),
        });
      }
  }
  const named = new Set<string>();
  for (const road of roads.sort((a, b) => a.score - b.score))
    if (!named.has(road.text) && add(road)) named.add(road.text);
  return { food, details };
}

export function metricScaleBar(pixelsPerMetre: number, targetPixels = 100) {
  const target = targetPixels / pixelsPerMetre,
    power = 10 ** Math.floor(Math.log10(target));
  const normal = target / power,
    distance = (normal >= 5 ? 5 : normal >= 2 ? 2 : 1) * power;
  return {
    distance,
    pixels: distance * pixelsPerMetre,
    label: distance >= 1000 ? `${distance / 1000} km` : `${distance} m`,
  };
}
