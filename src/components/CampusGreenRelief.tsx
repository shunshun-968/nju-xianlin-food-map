import { memo, useEffect, useState } from 'react';

type Relief = {
  version: number;
  image: string;
  bounds: [number, number, number, number];
  maskPath: string;
};

/** Baked DEM colors and soft lighting share exactly the map's metric coordinates. */
export const CampusGreenRelief = memo(function CampusGreenRelief() {
  const [relief, setRelief] = useState<Relief | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}osm/campus-green-relief.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((value: Relief) => {
        if (value.version !== 1 || !value.maskPath || value.bounds?.length !== 4)
          throw new Error('绿地地形数据不完整');
        setRelief(value);
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') console.warn('绿地地形加载失败：', error.message);
      });
    return () => controller.abort();
  }, []);
  if (!relief) return null;
  const [left, top, right, bottom] = relief.bounds;
  return (
    <g data-geo-relief pointerEvents="none" aria-hidden="true">
      <defs>
        <clipPath id="geo-relief-greens">
          <path d={relief.maskPath} fillRule="evenodd" clipRule="evenodd" />
        </clipPath>
      </defs>
      <image
        href={`${import.meta.env.BASE_URL}osm/campus-green-relief.png`}
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        preserveAspectRatio="none"
        clipPath="url(#geo-relief-greens)"
      />
    </g>
  );
});
