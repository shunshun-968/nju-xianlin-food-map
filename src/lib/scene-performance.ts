/** 开发环境可在 Performance 面板按 foodmap: 筛选；不在生产环境持续收集。 */
export function modelPhase(venue: string, phase: string, start: number, detail = {}) {
  if (!import.meta.env?.DEV) return;
  performance.measure(`foodmap:${venue}:${phase}`, { start, detail });
}
