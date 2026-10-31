export type GuideRect = { left: number; top: number; right: number; bottom: number };

/** Choose a quiet area in the default view. No pixel reads or continuous polling. */
export function placeModelGuide(
  area: GuideRect,
  width: number,
  height: number,
  occupied: GuideRect[],
) {
  const roomX = Math.max(0, area.right - area.left - width);
  const roomY = Math.max(0, area.bottom - area.top - height);
  let best = { x: area.left + width / 2, y: area.top + height / 2, score: Infinity };
  for (const y of [0, 0.25, 0.5, 0.75, 1]) {
    for (const x of [0.5, 0, 1, 0.25, 0.75]) {
      const left = area.left + roomX * x,
        top = area.top + roomY * y;
      let overlap = 0;
      for (const rect of occupied) {
        overlap +=
          Math.max(0, Math.min(left + width + 8, rect.right) - Math.max(left - 8, rect.left)) *
          Math.max(0, Math.min(top + height + 8, rect.bottom) - Math.max(top - 8, rect.top));
      }
      // Prefer high, central whitespace when several candidates clear the model.
      const score = overlap + roomY * y * 0.1 + Math.abs(x - 0.5) * roomX * 0.02;
      if (score < best.score) best = { x: left + width / 2, y: top + height / 2, score };
    }
  }
  return { x: best.x, y: best.y };
}
