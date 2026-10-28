import { getCampusModelPlacement, modeledCampusVenueIds } from './campus-model-artwork';
import type { MapVenue, XY } from './campus-basemap';

const modeledVenues: ReadonlySet<string> = new Set(modeledCampusVenueIds);

export function isModeledCampusVenue(id: string | null): boolean {
  return id !== null && modeledVenues.has(id);
}

/** Only completed taps update confirmation; hover/focus are deliberately separate. */
export function nextCampusVenueTap(
  currentPreview: string | null,
  venueId: string | null,
  requiresConfirmation: boolean,
): { preview: string | null; enter: string | null } {
  if (venueId === null) return { preview: null, enter: null };
  // B102 不显示地图文字标牌，因此触摸直接进入，避免无反馈的第一下点击。
  if (venueId === 'v-yifu') return { preview: null, enter: venueId };
  if (!requiresConfirmation || currentPreview === venueId) return { preview: null, enter: venueId };
  return { preview: venueId, enter: null };
}

/** Expanded touch targets can overlap at overview: prefer the nearest visible landmark, not SVG paint order. */
export function nearestCampusVenue(venues: MapVenue[], point: XY, scale: number): string | null {
  const candidates = venues.flatMap((venue) => {
    const model = getCampusModelPlacement(venue, scale);
    const width = Math.max(venue.width, 24 / scale),
      height = Math.max(venue.depth, 24 / scale);
    const bounds = model?.hitBounds ?? {
      x: venue.point[0] - width / 2,
      y: venue.point[1] - venue.height - height / 2,
      width,
      height,
    };
    if (
      point[0] < bounds.x ||
      point[0] > bounds.x + bounds.width ||
      point[1] < bounds.y ||
      point[1] > bounds.y + bounds.height
    )
      return [];
    const center: XY = model
      ? [model.x + model.width / 2, model.y + model.height / 2]
      : [venue.point[0], venue.point[1] - venue.height];
    return [{ id: venue.id, distance: Math.hypot(point[0] - center[0], point[1] - center[1]) }];
  });
  return (
    candidates.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))[0]?.id ?? null
  );
}
