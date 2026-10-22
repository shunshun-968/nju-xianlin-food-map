import type { MapFeature } from './campus-basemap';

/** Combine consecutive identical road styles, keeping the original paint order. */
export function batchRoads(features: MapFeature[]) {
  const batches: MapFeature[] = [];
  for (const f of features) {
    const last = batches.at(-1);
    if (last && last.width === f.width && last.footway === f.footway) last.path += ` ${f.path}`;
    else batches.push({ ...f });
  }
  return batches;
}

/** Disjoint polygons can share even-odd paths without cancelling overlapping fills.
 * Batches are spatially bounded; no source ring or courtyard is simplified. */
export function batchBuildings(features: MapFeature[]) {
  const cells = new Map<string, { path: string; members: MapFeature[] }[]>();
  for (const f of features) {
    const key = `${Math.floor(f.centre[0] / 512)}:${Math.floor(f.centre[1] / 512)}`;
    const groups = cells.get(key) ?? [];
    const group = groups.find((g) =>
      g.members.every((other) => {
        const a = f.bounds,
          b = other.bounds;
        return a[2] + 5 < b[0] || a[0] - 5 > b[2] || a[3] + 5 < b[1] || a[1] - 5 > b[3];
      }),
    );
    if (group) {
      group.path += ` ${f.path}`;
      group.members.push(f);
    } else groups.push({ path: f.path, members: [f] });
    cells.set(key, groups);
  }
  return [...cells.entries()].flatMap(([cell, groups]) =>
    groups.map((g, i) => ({
      id: `${cell}:${i}`,
      path: g.path,
      count: g.members.length,
    })),
  );
}
