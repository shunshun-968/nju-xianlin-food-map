import { memo, useMemo } from 'react';
import type { MapFeature, MapVenue } from '../lib/campus-basemap';
import { nightLightArtwork } from '../lib/night-light-artwork';

/** Immutable vector artwork: original gradients and positions, one composited layer. */
export const CampusNightLights = memo(function CampusNightLights({
  features,
  venues,
  campusPath,
}: {
  features: MapFeature[];
  venues: MapVenue[];
  campusPath: string;
}) {
  const artwork = useMemo(
    () => nightLightArtwork(features, venues, campusPath),
    [features, venues, campusPath],
  );
  return (
    <image
      data-geo-night-lights
      pointerEvents="none"
      aria-hidden="true"
      href={artwork.href}
      x={artwork.x}
      y={artwork.y}
      width={artwork.width}
      height={artwork.height}
    />
  );
});
