export type DragSample = { position: number; time: number };

/** Project a short, decelerating glide in the last direction of the finger. */
export function sheetRelease(
  samples: DragSample[],
  release: DragSample,
  progress: number,
  travel: number,
) {
  const stopped = { progress, duration: 0 };
  const last = samples.at(-1);
  if (!last || travel <= 0 || release.time - last.time > 80) return stopped;
  const first = samples.find((sample) => release.time - sample.time <= 100);
  if (!first || release.time - first.time < 8) return stopped;
  const velocity = Math.max(
    -1.2,
    Math.min(1.2, (release.position - first.position) / (release.time - first.time)),
  );
  if (Math.abs(velocity) < 0.12) return stopped;
  const distance = Math.sign(velocity) * Math.min(100, velocity ** 2 / (2 * 0.004));
  const target = Math.max(0, Math.min(1, progress + distance / travel));
  const actualDistance = Math.abs(target - progress) * travel;
  if (actualDistance < 3) return stopped;
  return {
    progress: target,
    duration: Math.round(Math.max(80, Math.min(300, (2 * actualDistance) / Math.abs(velocity)))),
  };
}
