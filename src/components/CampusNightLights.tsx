import { memo, useId, useMemo } from 'react';
import type { MapFeature, MapVenue } from '../lib/campus-basemap';
import { campusRoadLights, campusWindowLights } from '../lib/night-lights';

/** Static, decorative illumination in map metres; it never receives pointer input. */
export const CampusNightLights = memo(function CampusNightLights({
  features,
  venues,
}: {
  features: MapFeature[];
  venues: MapVenue[];
}) {
  const id = `night-${useId().replace(/:/g, '')}`;
  const lamps = useMemo(() => campusRoadLights(features), [features]);
  const windows = useMemo(() => campusWindowLights(features, venues), [features, venues]);
  return (
    <g data-geo-night-lights pointerEvents="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-road-glow`}>
          <stop offset="0" stopColor="#ffcf86" stopOpacity=".48" />
          <stop offset=".25" stopColor="#f6c27d" stopOpacity=".24" />
          <stop offset=".6" stopColor="#e6b579" stopOpacity=".065" />
          <stop offset="1" stopColor="#e6b579" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-food-glow`}>
          <stop offset="0" stopColor="#ffcf8a" stopOpacity=".46" />
          <stop offset=".4" stopColor="#eeb875" stopOpacity=".24" />
          <stop offset=".75" stopColor="#d7a16d" stopOpacity=".08" />
          <stop offset="1" stopColor="#d7a16d" stopOpacity="0" />
        </radialGradient>
        <g id={`${id}-lamp`}>
          <circle r="30" fill={`url(#${id}-road-glow)`} />
          <circle r="4.5" fill="#ffd28c" opacity=".18" />
          <circle r="2.1" fill="#ffe2ab" opacity=".95" />
          <circle r=".8" fill="#fff2cf" />
        </g>
      </defs>
      <g clipPath="url(#geo-campus)">
        <g data-night-road-lamps>
          {lamps.map((lamp) => (
            <use key={lamp.id} href={`#${id}-lamp`} x={lamp.point[0]} y={lamp.point[1]} />
          ))}
        </g>
        <g fill="none" stroke="#e9c38a" strokeWidth="1.7" strokeDasharray="3 6.5">
          {windows.map((window) => (
            <path
              key={window.id}
              data-night-facade={window.id}
              d={`M${window.from.join(' ')}L${window.to.join(' ')}`}
              opacity={window.opacity}
            />
          ))}
        </g>
      </g>
      <g data-night-food-glows>
        {venues.map((venue) => (
          <g
            key={venue.id}
            transform={`translate(${venue.point.join(' ')}) rotate(${venue.angle})`}
          >
            <ellipse
              rx={Math.max(52, venue.width * 1.45)}
              ry={Math.max(46, venue.depth * 1.35)}
              fill={`url(#${id}-food-glow)`}
            />
            <use href={`#${id}-lamp`} x={Math.min(9, venue.width * 0.24)} y={venue.depth / 2 + 3} />
            <use
              href={`#${id}-lamp`}
              x={-Math.min(9, venue.width * 0.24)}
              y={venue.depth / 2 + 3}
            />
          </g>
        ))}
      </g>
    </g>
  );
});
