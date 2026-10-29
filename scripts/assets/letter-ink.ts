/** 沿用原 SVG 的墨迹 alpha，不收细、不重画；只给暖黑墨色添加固定的微小变化。 */
export function extractLetterInk(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha =
      Math.max(
        0,
        Math.min(1, 3 - (1.33 * pixels[i] + 1.34 * pixels[i + 1] + 1.33 * pixels[i + 2]) / 255),
      ) * pixels[i + 3];
    const noise = 0.4 + (0.2 * ((Math.imul(i + 31, 1103515245) >>> 16) & 255)) / 255;
    pixels[i] = (0.12 + 0.06 * noise) * 255;
    pixels[i + 1] = (0.09 + 0.05 * noise) * 255;
    pixels[i + 2] = (0.065 + 0.04 * noise) * 255;
    pixels[i + 3] = alpha;
  }
}
