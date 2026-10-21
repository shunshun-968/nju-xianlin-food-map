import calibration from '../data/map-calibration.json';

/** Horizontal ground distance represented by a bar in the current SVG viewport. */
export function mapScaleBar(pixelsPerUnit: number, targetPixels = 120) {
  const metersPerPixel = calibration.horizontalMetersPerUnit / pixelsPerUnit;
  const targetMeters = metersPerPixel * targetPixels;
  const magnitude = 10 ** Math.floor(Math.log10(targetMeters));
  const normalized = targetMeters / magnitude;
  const distance = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
  return {
    distance,
    pixels: distance / metersPerPixel,
    label: distance >= 1000 ? `${distance / 1000} km` : `${distance} m`,
  };
}
