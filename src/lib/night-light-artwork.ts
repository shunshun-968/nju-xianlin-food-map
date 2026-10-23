import type { MapFeature, MapVenue } from './campus-basemap';
import { campusRoadLights, campusWindowLights } from './night-lights';

/** Vector resolution at every zoom: no canvas rasterisation or reduction of lights. */
export function nightLightArtwork(features: MapFeature[], venues: MapVenue[], campusPath: string) {
  const lamps = campusRoadLights(features),
    windows = campusWindowLights(features, venues);
  const points = [
    ...lamps.map((lamp) => lamp.point),
    ...windows.flatMap((window) => [window.from, window.to]),
    ...venues.map((venue) => venue.point),
  ];
  const x = Math.min(0, ...points.map((p) => p[0])) - 150;
  const y = Math.min(0, ...points.map((p) => p[1])) - 150;
  const width = Math.max(0, ...points.map((p) => p[0])) - x + 150;
  const height = Math.max(0, ...points.map((p) => p[1])) - y + 150;
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const lamp = (px: number, py: number) => `<use href="#lamp" x="${px}" y="${py}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">
    <defs><clipPath id="campus"><path d="${escape(campusPath)}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>
    <radialGradient id="road"><stop offset="0" stop-color="#ffcf86" stop-opacity=".48"/><stop offset=".25" stop-color="#f6c27d" stop-opacity=".24"/><stop offset=".6" stop-color="#e6b579" stop-opacity=".065"/><stop offset="1" stop-color="#e6b579" stop-opacity="0"/></radialGradient>
    <radialGradient id="food"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".46"/><stop offset=".4" stop-color="#eeb875" stop-opacity=".24"/><stop offset=".75" stop-color="#d7a16d" stop-opacity=".08"/><stop offset="1" stop-color="#d7a16d" stop-opacity="0"/></radialGradient>
    <g id="lamp"><circle r="30" fill="url(#road)"/><circle r="4.5" fill="#ffd28c" opacity=".18"/><circle r="2.1" fill="#ffe2ab" opacity=".95"/><circle r=".8" fill="#fff2cf"/></g></defs>
    <g clip-path="url(#campus)">${lamps.map((l) => lamp(...l.point)).join('')}
    <g fill="none" stroke="#e9c38a" stroke-width="1.7" stroke-dasharray="3 6.5">${windows.map((w) => `<path d="M${w.from.join(' ')}L${w.to.join(' ')}" opacity="${w.opacity}"/>`).join('')}</g></g>
    ${venues.map((v) => `<g transform="translate(${v.point.join(' ')}) rotate(${v.angle})"><ellipse rx="${Math.max(52, v.width * 1.45)}" ry="${Math.max(46, v.depth * 1.35)}" fill="url(#food)"/>${lamp(Math.min(9, v.width * 0.24), v.depth / 2 + 3)}${lamp(-Math.min(9, v.width * 0.24), v.depth / 2 + 3)}</g>`).join('')}</svg>`;
  return { x, y, width, height, href: `data:image/svg+xml,${encodeURIComponent(svg)}` };
}
