/** Deterministic screen-space placement, shared by all map label layers. */
export type LabelRequest = {
  id: string;
  lines: string[];
  x: number;
  y: number;
  priority: number;
  fontSize: number;
  lineHeight?: number;
  rotation?: number;
  badge?: boolean;
  preferred?: readonly [number, number];
  kind?: string;
};
export type PlacedLabel = LabelRequest & {
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  lineHeight: number;
  box: { left: number; top: number; right: number; bottom: number };
};

export function overlaps(a: PlacedLabel['box'], b: PlacedLabel['box']) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function placeMapLabels(
  requests: LabelRequest[],
  viewport: { width: number; height: number },
  reserved: PlacedLabel['box'][] = [],
) {
  const placed: PlacedLabel[] = [];
  for (const item of [...requests].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  )) {
    // Off-screen places never introduce labels for locations outside the view.
    if (item.x < 0 || item.y < 0 || item.x > viewport.width || item.y > viewport.height) continue;
    // Conservative glyph advance including the text halo, badge and letter spacing.
    const width =
      Math.max(
        ...item.lines.map((line) =>
          [...line].reduce((w, c) => w + (/[\u0000-\u007f]/.test(c) ? 0.72 : 1.07), 0),
        ),
      ) *
        item.fontSize +
      (item.badge ? 24 : 10);
    const lineHeight = item.lineHeight ?? 14;
    const height = item.lines.length * lineHeight + (item.badge ? 10 : 6);
    const angle = ((item.rotation || 0) * Math.PI) / 180;
    const boundWidth = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
    const boundHeight = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
    const offsets: readonly (readonly [number, number])[] = item.badge
      ? [
          item.preferred || [0, -24],
          [0, -height / 2 - 15],
          [0, height / 2 + 15],
          [-width / 2 - 20, 0],
          [width / 2 + 20, 0],
          [0, -height - 24],
          [0, height + 24],
          [-width / 2 - 20, -44],
          [width / 2 + 20, 44],
          [-width / 2 - 20, 44],
          [width / 2 + 20, -44],
          [-width / 2 - 64, 0],
          [width / 2 + 64, 0],
          [-width / 2 - 20, -80],
          [width / 2 + 20, -80],
          [-width / 2 - 20, 80],
          [width / 2 + 20, 80],
          [0, -height * 2 - 24],
          [0, height * 2 + 24],
        ]
      : item.kind === 'road'
        ? [[0, 0]]
        : [
            [0, 0],
            [0, -18],
            [0, 18],
          ];
    for (const [dx, dy] of offsets) {
      let x = item.x + dx,
        y = item.y + dy;
      if (item.badge) {
        x = Math.max(boundWidth / 2 + 8, Math.min(viewport.width - boundWidth / 2 - 8, x));
        y = Math.max(boundHeight / 2 + 8, Math.min(viewport.height - boundHeight / 2 - 8, y));
      }
      const box = {
        left: x - boundWidth / 2 - 3,
        right: x + boundWidth / 2 + 3,
        top: y - boundHeight / 2 - 3,
        bottom: y + boundHeight / 2 + 3,
      };
      if (
        box.left < 3 ||
        box.top < 3 ||
        box.right > viewport.width - 3 ||
        box.bottom > viewport.height - 3 ||
        placed.some((other) => overlaps(box, other.box)) ||
        reserved.some((other) => overlaps(box, other))
      )
        continue;
      placed.push({
        ...item,
        anchorX: item.x,
        anchorY: item.y,
        x,
        y,
        width,
        height,
        lineHeight,
        box,
      });
      break;
    }
  }
  return placed;
}
