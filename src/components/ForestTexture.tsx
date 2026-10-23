import { memo, useEffect, useMemo, useState } from 'react';
import type { MapTransform } from '../lib/campus-basemap';
import type { PlacedLabel } from '../lib/map-labels';
import { basemapLoader } from '../lib/basemap-cache';

type Crown = {
  id: string;
  x: number;
  y: number;
  radius: number;
  rotation: number;
  variant: number;
  tier: 0 | 1;
};
type Forest = { version: number; maskPath: string; crowns: Crown[] };
const smoothstep = (low: number, high: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

/** Fixed ground positions; zoom changes opacity, never the layout or the random seed. */
export const ForestTexture = memo(function ForestTexture({
  transform: t,
  viewport,
  labelBoxes,
}: {
  transform: MapTransform;
  viewport: { width: number; height: number };
  labelBoxes: PlacedLabel['box'][];
}) {
  const [data, setData] = useState<Forest | null>(null);
  const needed = t.zoom > 1.55;
  useEffect(() => {
    if (!needed || data) return;
    let cancelled = false;
    basemapLoader
      .loadForest()
      .then((loaded) => {
        const value = loaded as Forest;
        if (value.version !== 1 || !value.maskPath || !value.crowns?.length)
          throw new Error('林地纹理数据不完整');
        if (!cancelled) setData(value);
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') console.warn('林地纹理加载失败：', error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [needed, data]);
  const opacity = [smoothstep(1.55, 2.8, t.zoom) * 0.34, smoothstep(3.1, 5.5, t.zoom) * 0.28];
  const crownNodes = useMemo(
    () =>
      new Map(
        data?.crowns.map((c) => [
          c.id,
          <use
            key={c.id}
            data-crown={c.id}
            data-tier={c.tier}
            href={`#canopy-${c.variant}`}
            transform={`translate(${c.x} ${c.y}) rotate(${c.rotation}) scale(${c.radius})`}
            fill="var(--map-canopy, #a8ba9d)"
            opacity={opacity[c.tier]}
          />,
        ]) ?? [],
      ),
    [data, opacity[0], opacity[1]],
  );
  if (!data) return null;
  const visible = data.crowns.filter((c) => {
    if (opacity[c.tier] <= 0.001) return false;
    const x = c.x * t.scale + t.x,
      y = c.y * t.scale + t.y,
      radius = c.radius * t.scale;
    if (
      x + radius < 0 ||
      y + radius < 0 ||
      x - radius > viewport.width ||
      y - radius > viewport.height
    )
      return false;
    return !labelBoxes.some(
      (b) =>
        x + radius > b.left - 6 &&
        x - radius < b.right + 6 &&
        y + radius > b.top - 6 &&
        y - radius < b.bottom + 6,
    );
  });
  return (
    <g
      data-geo-forest-texture
      pointerEvents="none"
      aria-hidden="true"
      clipPath="url(#geo-forest-mask)"
    >
      <defs>
        <clipPath id="geo-forest-mask">
          <path d={data.maskPath} fillRule="evenodd" clipRule="evenodd" />
        </clipPath>
        <g id="canopy-0">
          <path d="M-.85-.22C-.99-.61-.54-.86-.29-.75C-.1-1 .46-.92 .53-.63C.99-.55 .97-.06 .77.13C.93.49.43.82.18.7C-.15.96-.66.7-.61.42C-.99.34-1-.02-.85-.22Z" />
          <path
            d="M-.5-.43Q-.18-.7.15-.48Q-.18-.32-.5-.43Z"
            fill="var(--map-canopy-light, #eff3e8)"
            opacity=".35"
          />
        </g>
        <g id="canopy-1">
          <path d="M-.81-.38C-.8-.85-.31-.92-.1-.7C.22-.98.69-.65.58-.34C.95-.19.91.29.63.37C.64.87.12.91-.1.68C-.48.89-.9.53-.74.22C-1.01.03-.98-.24-.81-.38Z" />
          <path
            d="M-.54-.45Q-.28-.73-.12-.48Q-.28-.24-.54-.45Z"
            fill="var(--map-canopy-light, #eff3e8)"
            opacity=".35"
          />
        </g>
        <g id="canopy-2">
          <path d="M-.68-.39C-.63-.88-.16-.9.09-.67C.5-.81.86-.45.68-.11C.98.2.62.69.31.59C.12.95-.41.89-.5.51C-.94.46-1.01-.13-.68-.39Z" />
          <path
            d="M-.44-.42Q-.22-.65.04-.45Q-.15-.24-.44-.42Z"
            fill="var(--map-canopy-light, #eff3e8)"
            opacity=".35"
          />
        </g>
      </defs>
      {visible.map((c) => crownNodes.get(c.id))}
    </g>
  );
});
