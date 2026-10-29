import { memo, type CSSProperties } from 'react';
import type { MapVenue } from '../lib/campus-basemap';
import { getCampusModelPlacement } from '../lib/campus-model-artwork';
import './campus-venue-model.css';

type Props = {
  venue: MapVenue;
  scale: number;
  nightMode: boolean;
  highlighted?: boolean;
  imageReady?: boolean;
  onImageError?: (href: string) => void;
};

/** Artwork only: the enclosing venue group retains the map's keyboard and pointer navigation. */
export const CampusVenueModel = memo(function CampusVenueModel({
  venue,
  scale,
  nightMode,
  highlighted = false,
  imageReady = true,
  onImageError,
}: Props) {
  const model = getCampusModelPlacement(venue, scale);
  if (!model) return null;
  const unit = 1 / Math.max(0.001, scale);
  const glowId = `campus-model-glow-${venue.id}`;
  const [x, y] = model.anchor;
  const href = nightMode ? model.hrefNight : model.hrefDay;
  const showArtwork = imageReady;
  const base = model.groundPolygon;
  const roof = base.map(([px, py]) => [px, py - Math.max(venue.height, 5 * unit)]);
  const points = (vertices: number[][]) => vertices.map((p) => p.join(',')).join(' ');
  return (
    <g
      className={`campus-venue-model${highlighted ? ' is-highlighted' : ''}`}
      data-model-venue={venue.id}
      data-model-theme={nightMode ? 'night' : 'day'}
      data-artwork-ready={showArtwork}
      style={
        {
          '--campus-model-lift': `${-1.4 * unit}px`,
          '--campus-model-glow-size': `${1.4 * unit}px`,
        } as CSSProperties
      }
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0" className="campus-model-glow-core" />
          <stop offset=".66" className="campus-model-glow-edge" />
          <stop offset="1" className="campus-model-glow-clear" />
        </radialGradient>
      </defs>
      <g pointerEvents="none" aria-hidden="true">
        <ellipse
          className="campus-model-ground-shadow"
          cx={x + 1.5}
          cy={y + 2.5}
          rx={model.groundWidth * 0.5}
          ry={model.groundDepth * 0.48}
          transform={`rotate(${venue.angle} ${x} ${y})`}
        />
        <ellipse
          className="campus-model-aura"
          cx={x}
          cy={y}
          rx={model.groundWidth * 0.68 + 2}
          ry={model.groundDepth * 0.66 + 2}
          transform={`rotate(${venue.angle} ${x} ${y})`}
          fill={`url(#${glowId})`}
        />
        <g className="campus-venue-image">
          {!showArtwork && (
            <g data-campus-model-placeholder>
              {base.map((point, index) => (
                <polygon
                  key={index}
                  points={points([
                    point,
                    base[(index + 1) % 4],
                    roof[(index + 1) % 4],
                    roof[index],
                  ])}
                  fill={venue.color}
                  stroke="var(--map-venue-edge, #989f8e)"
                  strokeWidth={0.7 * unit}
                />
              ))}
              <polygon
                points={points(roof)}
                fill={venue.color}
                stroke="var(--map-venue-rim, #fffdf3)"
                strokeWidth={unit}
              />
            </g>
          )}
          {showArtwork && (
            <image
              className="campus-venue-model-image"
              href={href}
              crossOrigin="anonymous"
              onError={() => onImageError?.(href)}
              x={model.x}
              y={model.y}
              width={model.width}
              height={model.height}
              preserveAspectRatio="none"
            />
          )}
        </g>
      </g>
      <rect
        data-campus-model-hit
        x={model.hitBounds.x}
        y={model.hitBounds.y}
        width={model.hitBounds.width}
        height={model.hitBounds.height}
        fill="transparent"
      />
    </g>
  );
});
