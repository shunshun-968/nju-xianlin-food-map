import type { MapFeature, MapVenue, XY } from './campus-basemap';

export type RoadLight = { id: string; point: XY };
export type WindowLight = { id: string; from: XY; to: XY; opacity: number };

// These are decorative light positions, not a survey of campus lighting assets.
// Every distance is in metres, so zooming never changes the pattern on the ground.
export const roadLightSpacing = 52;
export const maximumRoadLights = 480;
const minimumSeparation = 23;

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

/** Sample full source lines, then deduplicate junctions and overlapping OSM ways. */
export function campusRoadLights(features: MapFeature[]): RoadLight[] {
  const candidates: RoadLight[] = [];
  for (const feature of features) {
    if (feature.kind !== 'road' || !feature.inCampus || feature.footway) continue;
    const edgeOffset = (feature.width || 6) / 2 + 1.4;
    for (const [lineIndex, line] of (feature.lines || []).entries()) {
      let travelled = 0;
      let nextDistance = roadLightSpacing / 2;
      let index = 0;
      for (let segment = 1; segment < line.length; segment++) {
        const [ax, ay] = line[segment - 1];
        const dx = line[segment][0] - ax;
        const dy = line[segment][1] - ay;
        const length = Math.hypot(dx, dy);
        if (!Number.isFinite(length) || !length) continue;
        while (nextDistance <= travelled + length) {
          const fraction = (nextDistance - travelled) / length;
          const side = (hash(feature.id) + index) % 2 ? 1 : -1;
          candidates.push({
            id: `${feature.id}:${lineIndex}:${index}`,
            point: [
              ax + dx * fraction - (dy / length) * edgeOffset * side,
              ay + dy * fraction + (dx / length) * edgeOffset * side,
            ],
          });
          index++;
          nextDistance += roadLightSpacing;
        }
        travelled += length;
      }
    }
  }
  // A stable spatially mixed priority spreads a capped set across the campus,
  // instead of exhausting the budget on the first streets in render order.
  candidates.sort((a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id));
  const lights: RoadLight[] = [];
  const cells = new Map<string, XY[]>();
  for (const candidate of candidates) {
    const [x, y] = candidate.point;
    const cx = Math.floor(x / minimumSeparation);
    const cy = Math.floor(y / minimumSeparation);
    let occupied = false;
    for (let i = cx - 1; i <= cx + 1 && !occupied; i++) {
      for (let j = cy - 1; j <= cy + 1 && !occupied; j++) {
        occupied = (cells.get(`${i}:${j}`) || []).some(
          ([px, py]) => Math.hypot(x - px, y - py) < minimumSeparation,
        );
      }
    }
    if (occupied) continue;
    lights.push(candidate);
    const key = `${cx}:${cy}`;
    cells.set(key, [...(cells.get(key) || []), candidate.point]);
    if (lights.length === maximumRoadLights) break;
  }
  return lights;
}

/** The basemap exporter emits closed M/L/Z polygons. Only use the outer ring. */
function buildingOutline(path: string): XY[] {
  const outerRing = path.split(/[zZ]/, 1)[0];
  return [...outerRing.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
}

/** One short facade per selected building, leaving most of each roof unlit. */
export function campusWindowLights(features: MapFeature[], venues: MapVenue[]): WindowLight[] {
  const foodBuildings = new Set(venues.map((venue) => venue.osmId));
  return features
    .filter(
      (feature) =>
        feature.kind === 'building' &&
        feature.inCampus &&
        feature.area >= 850 &&
        !foodBuildings.has(feature.id) &&
        hash(feature.id) % 4 !== 0,
    )
    .sort((a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id))
    .slice(0, 100)
    .flatMap((feature) => {
      const ring = buildingOutline(feature.path);
      const edges = ring.flatMap((from, index) => {
        const to = ring[(index + 1) % ring.length];
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
        if (length < 18) return [];
        return [{ from, to, length, score: (from[1] + to[1]) / 2 + length * 0.15 }];
      });
      // A lower-facing facade reads as lit windows, rather than a glowing roof outline.
      const edge = edges.sort((a, b) => b.score - a.score)[0];
      if (!edge) return [];
      const unit: XY = [
        (edge.to[0] - edge.from[0]) / edge.length,
        (edge.to[1] - edge.from[1]) / edge.length,
      ];
      const litLength = Math.min(48, edge.length - 8);
      const inset = (edge.length - litLength) / 2;
      const point = (distance: number): XY => [
        edge.from[0] + unit[0] * distance,
        edge.from[1] + unit[1] * distance,
      ];
      return [
        {
          id: feature.id,
          from: point(inset),
          to: point(inset + litLength),
          opacity: 0.38 + (hash(feature.id) % 4) * 0.08,
        },
      ];
    });
}
