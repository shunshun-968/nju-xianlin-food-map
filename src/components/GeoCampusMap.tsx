import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Catalog } from '../domain';
import type { SceneHandle } from './MapScene';
import {
  mapLabels,
  metricScaleBar,
  textWidth,
  initialZoom,
  wheelZoomFactor,
  type CampusBasemap,
  type MapFeature,
  type MapTransform,
  type MapVenue,
  type XY,
} from '../lib/campus-basemap';
import type { PlacedLabel } from '../lib/map-labels';
import { CampusSports, RadioTelescope } from './CampusSports';
import { ForestTexture } from './ForestTexture';
import './geo-campus-map.css';

type Props = { data: Catalog; onPick: (kind: string, id: string) => void; showLabels: boolean };
function landFill(feature: MapFeature, inside = true) {
  if (feature.sport) return inside ? '#dcd8bb' : '#d5d9c8';
  if (['wood', 'forest'].includes(feature.subtype || '')) return inside ? '#c7d4bd' : '#dce3d6';
  if (['grass', 'grassland', 'meadow'].includes(feature.subtype || ''))
    return inside ? '#e6ebd9' : '#e8ece2';
  if (['scrub', 'garden', 'park', 'recreation_ground'].includes(feature.subtype || ''))
    return inside ? '#dce5d1' : '#e3e8de';
  if (['residential', 'construction', 'commercial'].includes(feature.subtype || ''))
    return inside ? '#efdfc1' : '#e3e7de';
  return inside ? '#dce5d1' : '#e3e8de';
}
function cuboid(venue: MapVenue) {
  const angle = (venue.angle * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const points: XY[] = [
    [-venue.width / 2, -venue.depth / 2],
    [venue.width / 2, -venue.depth / 2],
    [venue.width / 2, venue.depth / 2],
    [-venue.width / 2, venue.depth / 2],
  ];
  const base = points.map(
    ([x, y]) => [venue.point[0] + x * c - y * s, venue.point[1] + x * s + y * c] as XY,
  );
  const roof = base.map(([x, y]) => [x, y - venue.height] as XY);
  const polygon = (p: XY[]) => p.map(([x, y]) => `${x},${y}`).join(' ');
  return { base, roof, polygon };
}

/** The outer map only: venue IDs still enter the existing building/floor scenes. */
export const GeoCampusMap = forwardRef<SceneHandle, Props>(function GeoCampusMap(
  { data, onPick, showLabels },
  ref,
) {
  const [map, setMap] = useState<CampusBasemap | null>(null),
    [error, setError] = useState('');
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const size = useRef({ width: 1, height: 1 });
  const transformRef = useRef<MapTransform>({ x: 0, y: 0, scale: 1, zoom: 1 });
  const updateFrame = useRef<number | null>(null);
  const movingWorld = useRef<SVGGElement | null>(null);
  const settleTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [transform, setTransform] = useState(transformRef.current);
  const reserved = useRef<PlacedLabel['box'][]>([]);
  const pointers = useRef(new Map<number, XY>());
  const gesture = useRef({
    x: 0,
    y: 0,
    moved: false,
    multiple: false,
    venue: null as string | null,
  });
  // Cache an overscanned window in ground space. Panning within it updates the
  // world transform instead of rebuilding thousands of unchanged SVG paths.
  const visibilityKey = [
    Math.floor((-transform.x / transform.scale - 100) / 64),
    Math.floor((-transform.y / transform.scale - 100) / 64),
    Math.ceil(((size.current.width - transform.x) / transform.scale + 100) / 64),
    Math.ceil(((size.current.height - transform.y) / transform.scale + 100) / 64),
  ].join(':');
  const groups = useMemo(() => {
    if (!map) return null;
    const foodBuildings = new Set(map.venues.map((v) => v.osmId));
    const [l, t, r, b] = visibilityKey.split(':').map(Number);
    const left = l * 64,
      top = t * 64,
      right = r * 64,
      bottom = b * 64;
    const visible = map.features.filter(
      (f) =>
        f.bounds[2] >= left && f.bounds[0] <= right && f.bounds[3] >= top && f.bounds[1] <= bottom,
    );
    return {
      land: visible.filter((f) => f.kind === 'land').sort((a, b) => b.area - a.area),
      water: visible.filter((f) => f.kind === 'water'),
      roads: visible.filter((f) => f.kind === 'road'),
      buildings: visible.filter((f) => f.kind === 'building' && !foodBuildings.has(f.id)),
    };
  }, [map, visibilityKey]);
  const groundArtwork = useMemo(
    () =>
      map && groups ? (
        <>
          <g
            clipPath="url(#geo-context)"
            pointerEvents="none"
            data-zone="outside-ground"
            shapeRendering="geometricPrecision"
          >
            {groups.land.map((f) => (
              <path key={f.id} d={f.path} fill={landFill(f, false)} fillRule="evenodd" />
            ))}
            {groups.water.map((f) => (
              <path
                key={f.id}
                d={f.path}
                fill={f.area ? '#bdd2ce' : 'none'}
                stroke="#abc2bc"
                strokeWidth={f.area ? 0.7 : 2.5}
                fillRule="evenodd"
              />
            ))}
          </g>
          <path d={map.campusPath} fill="#f3e5c5" />
          <g
            clipPath="url(#geo-campus)"
            pointerEvents="none"
            data-zone="campus-ground"
            shapeRendering="geometricPrecision"
          >
            {groups.land.map((f) => (
              <path key={f.id} d={f.path} fill={landFill(f)} fillRule="evenodd" />
            ))}
            {groups.water.map((f) => (
              <path
                key={f.id}
                d={f.path}
                fill={f.area ? '#b6d9d1' : 'none'}
                stroke="#9fc8bf"
                strokeWidth={f.area ? 0.7 : 2.5}
                fillRule="evenodd"
              />
            ))}
          </g>
        </>
      ) : null,
    [map, groups],
  );
  const roadArtwork = useMemo(
    () =>
      map && groups ? (
        <>
          <CampusSports features={groups.land} />
          <g
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
            data-geo-roads
          >
            {groups.roads
              .filter((f) => !f.footway)
              .map((f) => (
                <path key={f.id} d={f.path} stroke="#aab5a3" strokeWidth={(f.width || 6) + 1.4} />
              ))}
            {groups.roads.map((f) => (
              <path
                key={f.id}
                d={f.path}
                stroke={f.footway ? '#aebaab' : '#bac5b0'}
                strokeWidth={f.width}
                strokeDasharray={f.footway ? '3 2' : undefined}
              />
            ))}
            <g clipPath="url(#geo-campus)" data-zone="campus-roads">
              {groups.roads
                .filter((f) => !f.footway)
                .map((f) => (
                  <path
                    key={`inner-edge-${f.id}`}
                    d={f.path}
                    stroke="#d5cbb3"
                    strokeWidth={(f.width || 6) + 1.4}
                  />
                ))}
              {groups.roads.map((f) => (
                <path
                  key={`inner-${f.id}`}
                  d={f.path}
                  stroke={f.footway ? '#f8f5e9' : '#fff8e9'}
                  strokeWidth={f.width}
                />
              ))}
            </g>
            {groups.roads
              .filter((f) => f.boundaryPath)
              .map((f) => (
                <g key={`boundary-${f.id}`} data-boundary-road={f.id}>
                  <path
                    d={f.boundaryPath}
                    stroke="#acb6a5"
                    strokeWidth={(f.width || 6) + 1.4}
                    strokeLinecap="butt"
                  />
                  <path
                    d={f.boundaryPath}
                    stroke="#c4ccbc"
                    strokeWidth={f.width}
                    strokeLinecap="butt"
                  />
                </g>
              ))}
          </g>
        </>
      ) : null,
    [map, groups],
  );
  const buildingArtwork = useMemo(
    () =>
      map && groups ? (
        <>
          <g pointerEvents="none" data-geo-buildings>
            {groups.buildings.map((f) => (
              <path
                key={`shadow-${f.id}`}
                d={f.path}
                transform="translate(2.5 3.3)"
                fill="#6f7b6e"
                fillOpacity=".16"
                fillRule="evenodd"
              />
            ))}
            {groups.buildings.map((f) => (
              <path
                key={f.id}
                data-building={f.id}
                data-in-campus={f.inCampus}
                d={f.path}
                fill="#fffefa"
                stroke="#b9c2b4"
                strokeWidth=".65"
                fillRule="evenodd"
                strokeLinejoin="round"
              >
                <title>{f.name || (f.inCampus ? '校园建筑' : '周边建筑')}</title>
              </path>
            ))}
            <RadioTelescope point={map.observatory} />
          </g>
        </>
      ) : null,
    [map, groups],
  );
  function update(next: MapTransform) {
    transformRef.current = next;
    // Composite only during motion; return to native SVG when settled so text
    // and building edges are rerasterized sharply at the final zoom.
    const world = movingWorld.current;
    if (world) {
      world.style.transformOrigin = '0 0';
      world.style.willChange = 'transform';
      world.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`;
      world.setAttribute('data-map-moving', 'true');
    }
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      movingWorld.current?.style.removeProperty('transform');
      movingWorld.current?.style.removeProperty('will-change');
      movingWorld.current?.removeAttribute('data-map-moving');
      settleTimer.current = null;
    }, 140);
    // Pointer and wheel events can arrive several times per display frame.
    // Keep the latest pose and reconcile the SVG only once for that frame.
    if (updateFrame.current !== null) return;
    updateFrame.current = requestAnimationFrame(() => {
      updateFrame.current = null;
      setTransform(transformRef.current);
    });
  }
  useEffect(
    () => () => {
      if (updateFrame.current !== null) cancelAnimationFrame(updateFrame.current);
      updateFrame.current = null;
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    },
    [],
  );
  function fitted(): MapTransform {
    if (!map) return transformRef.current;
    const { width, height } = size.current,
      rect = host.current!.getBoundingClientRect();
    const app = host.current!.closest('.app');
    const drawer = app?.querySelector('.sidebar-dock:not(.is-collapsed)')?.getBoundingClientRect();
    const crumbs = app?.querySelector('.breadcrumbs')?.getBoundingClientRect();
    const left = drawer && width > 700 ? Math.max(20, drawer.right - rect.left + 28) : 20;
    const top = Math.max(35, (crumbs?.bottom || rect.top) - rect.top + 20);
    const bottom =
      drawer && width <= 700
        ? Math.max(top + 180, Math.min(height - 35, drawer.top - rect.top - 20))
        : height - 45;
    const [minX, minY, maxX, maxY] = map.bounds;
    const scale =
      initialZoom *
      Math.max(
        0.015,
        Math.min((width - left - 30) / (maxX - minX + 90), (bottom - top) / (maxY - minY + 90)),
      );
    return {
      x: left + (width - left) / 2 - ((minX + maxX) / 2) * scale,
      y: top + (bottom - top) / 2 - ((minY + maxY) / 2) * scale,
      scale,
      zoom: initialZoom,
    };
  }
  function zoomAt(factor: number, x = size.current.width / 2, y = size.current.height / 2) {
    const old = transformRef.current,
      zoom = Math.max(0.75, Math.min(24, old.zoom * factor)),
      ratio = zoom / old.zoom;
    update({
      x: x - (x - old.x) * ratio,
      y: y - (y - old.y) * ratio,
      scale: old.scale * ratio,
      zoom,
    });
  }
  useImperativeHandle(ref, () => ({
    zoom: zoomAt,
    reset: () => update(fitted()),
    rotate: () => {},
  }));
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}osm/campus-render.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((value: CampusBasemap) => {
        if (value.version !== 1 || !value.features?.length || value.venues?.length !== 7)
          throw new Error('底图数据不完整');
        setMap(value);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const element = host.current!,
      surface = svg.current!;
    function measure() {
      const rect = element.getBoundingClientRect();
      size.current = { width: rect.width, height: rect.height };
      reserved.current = [
        ...element
          .closest('.app')!
          .querySelectorAll(
            '.breadcrumbs, .compass, .map-tools, .map-scale, .style-toggle, .sidebar-dock, .sidebar-handle, .header, .header-reveal, .geo-attribution',
          ),
      ]
        .map((node) => node.getBoundingClientRect())
        .filter((r) => r.width && r.height)
        .map((r) => ({
          left: r.left - rect.left - 4,
          top: r.top - rect.top - 4,
          right: r.right - rect.left + 4,
          bottom: r.bottom - rect.top + 4,
        }));
    }
    const observer = new ResizeObserver(() => {
      measure();
      update(fitted());
    });
    observer.observe(element);
    let frame = 0;
    const overlays = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        measure();
        update({ ...transformRef.current });
      });
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      zoomAt(
        wheelZoomFactor(event.deltaY, event.deltaMode),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    surface.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('foodmap:overlays', overlays);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      surface.removeEventListener('wheel', wheel);
      window.removeEventListener('foodmap:overlays', overlays);
    };
  }, [map]);
  const labels = map
    ? mapLabels(map, transform, size.current, reserved.current, showLabels)
    : { food: [], details: [] };
  const scaleBar = metricScaleBar(transform.scale);
  const venueById = new Map(map?.venues.map((v) => [v.id, v]) || []);
  const validVenueIds = new Set(data.venues.map((v) => v.id));
  function point(event: React.PointerEvent): XY {
    const rect = svg.current!.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }
  function pickKey(event: React.KeyboardEvent, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onPick('venue', id);
    }
  }
  return (
    <div className="campus-plan geo-campus-map" ref={host}>
      {!map && (
        <p className="geo-map-status" role={error ? 'alert' : 'status'}>
          {error ? `底图加载失败：${error}` : '正在展开校园地图…'}
        </p>
      )}
      <svg
        ref={svg}
        width="100%"
        height="100%"
        role="group"
        tabIndex={0}
        aria-label="南京大学仙林校区地图，北向上；可拖动缩放，点击彩色食堂和餐车进入"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            zoomAt(1.25);
          }
          if (event.key === '-') {
            event.preventDefault();
            zoomAt(0.8);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            update(fitted());
          }
          const offsets: Record<string, XY> = {
            ArrowLeft: [45, 0],
            ArrowRight: [-45, 0],
            ArrowUp: [0, 45],
            ArrowDown: [0, -45],
          };
          if (offsets[event.key]) {
            event.preventDefault();
            const [x, y] = offsets[event.key],
              old = transformRef.current;
            update({ ...old, x: old.x + x, y: old.y + y });
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const [x, y] = point(event);
          pointers.current.set(event.pointerId, [x, y]);
          if (pointers.current.size === 1)
            gesture.current = {
              x,
              y,
              moved: false,
              multiple: false,
              venue:
                (event.target as Element).closest('[data-venue]')?.getAttribute('data-venue') ||
                null,
            };
          else gesture.current.multiple = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) return;
          const current = point(event),
            other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
          if (other) {
            const before = Math.hypot(previous[0] - other[0], previous[1] - other[1]);
            if (before > 0)
              zoomAt(
                Math.hypot(current[0] - other[0], current[1] - other[1]) / before,
                (previous[0] + other[0]) / 2,
                (previous[1] + other[1]) / 2,
              );
          }
          const old = transformRef.current,
            divisor = other ? 2 : 1;
          update({
            ...old,
            x: old.x + (current[0] - previous[0]) / divisor,
            y: old.y + (current[1] - previous[1]) / divisor,
          });
          if (Math.hypot(current[0] - gesture.current.x, current[1] - gesture.current.y) > 5)
            gesture.current.moved = true;
          pointers.current.set(event.pointerId, current);
        }}
        onPointerUp={(event) => {
          const g = gesture.current;
          if (
            pointers.current.has(event.pointerId) &&
            !g.moved &&
            !g.multiple &&
            g.venue &&
            validVenueIds.has(g.venue)
          )
            onPick('venue', g.venue);
          pointers.current.delete(event.pointerId);
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          gesture.current.multiple = true;
        }}
        onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
      >
        {map && groups && (
          <>
            <defs>
              <clipPath id="geo-campus">
                <path d={map.campusPath} fillRule="evenodd" clipRule="evenodd" />
              </clipPath>
              <clipPath id="geo-context">
                <path d={map.contextPath} fillRule="evenodd" clipRule="evenodd" />
              </clipPath>
            </defs>
            <g
              ref={movingWorld}
              data-geo-world
              data-map-zoom={transform.zoom}
              transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}
            >
              {groundArtwork}
              <ForestTexture
                transform={transform}
                viewport={size.current}
                labelBoxes={[...labels.food.map((l) => l.box), ...labels.details.map((l) => l.box)]}
              />
              {roadArtwork}
              <g>
                {buildingArtwork}
                <g data-geo-food>
                  {map.venues
                    .filter((v) => validVenueIds.has(v.id))
                    .map((venue) => {
                      const { base, roof, polygon } = cuboid(venue);
                      return (
                        <g
                          key={venue.id}
                          data-venue={venue.id}
                          className="geo-venue"
                          role="button"
                          tabIndex={0}
                          aria-label={`进入${venue.name}${venue.indoor ? '（室内）' : ''}`}
                          onKeyDown={(e) => pickKey(e, venue.id)}
                        >
                          <title>
                            {venue.name}
                            {venue.indoor ? ' · 室内' : ''} · 点击进入
                          </title>
                          <polygon
                            points={polygon(base.map(([x, y]) => [x + 3, y + 4]))}
                            fill="#72816f"
                            fillOpacity=".17"
                          />
                          {base.map((point, i) => (
                            <polygon
                              key={i}
                              points={polygon([
                                point,
                                base[(i + 1) % 4],
                                roof[(i + 1) % 4],
                                roof[i],
                              ])}
                              fill={venue.color}
                              stroke="#989f8e"
                              strokeWidth=".45"
                            />
                          ))}
                          <polygon
                            className="geo-venue-roof"
                            points={polygon(roof)}
                            fill={venue.color}
                            stroke="#969f8d"
                            strokeWidth=".8"
                          />
                          <path
                            d={`M${roof[0].join(' ')}L${roof[1].join(' ')}L${roof[2].join(' ')}`}
                            fill="none"
                            stroke="#fffdf3"
                            strokeWidth=".7"
                            strokeOpacity=".65"
                          />
                          <rect
                            x={venue.point[0] - Math.max(venue.width, 24 / transform.scale) / 2}
                            y={
                              venue.point[1] -
                              venue.height -
                              Math.max(venue.depth, 24 / transform.scale) / 2
                            }
                            width={Math.max(venue.width, 24 / transform.scale)}
                            height={Math.max(venue.depth, 24 / transform.scale)}
                            fill="transparent"
                          />
                        </g>
                      );
                    })}
                </g>
              </g>
            </g>
            <g className="geo-detail-labels" pointerEvents="none">
              {labels.details.map((label) => (
                <text
                  key={label.id}
                  data-label-kind={label.kind}
                  data-label-source={label.id}
                  x={label.x}
                  y={label.y}
                  transform={`rotate(${label.angle} ${label.x} ${label.y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={label.fontSize || 9.5}
                  fontWeight={label.overview ? 500 : 400}
                  data-label-overview={label.overview || undefined}
                >
                  {(label.lines || [label.text]).map((line, i, lines) => (
                    <tspan
                      key={line}
                      x={label.x}
                      y={label.y + (i - (lines.length - 1) / 2) * 12}
                      textLength={Math.min(label.width, textWidth(line, label.fontSize || 9.5))}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              ))}
            </g>
            <g className="geo-food-labels">
              {labels.food.map((label) => {
                const venue = venueById.get(label.id)!;
                if (!validVenueIds.has(venue.id)) return null;
                return (
                  <g
                    key={label.id}
                    data-venue={label.id}
                    className="geo-food-label"
                    role="button"
                    tabIndex={0}
                    aria-label={`进入${venue.name}${venue.indoor ? '（室内）' : ''}`}
                    onKeyDown={(e) => pickKey(e, venue.id)}
                  >
                    <path
                      d={`M${label.anchorX} ${label.anchorY}L${label.x} ${label.y}`}
                      fill="none"
                      stroke="#929e89"
                      strokeWidth=".8"
                      pointerEvents="none"
                    />
                    <g transform={`translate(${label.x} ${label.y})`}>
                      <rect
                        x={-label.width / 2}
                        y={-label.height / 2}
                        width={label.width}
                        height={label.height}
                        rx="5"
                        fill="#fffdf7"
                        fillOpacity=".97"
                        stroke="#c7cfbd"
                        strokeWidth=".8"
                      />
                      <circle
                        cx={-label.width / 2 + 8}
                        r="2.8"
                        fill={venue.color}
                        stroke="#9fa88f"
                        strokeWidth=".5"
                      />
                      {label.lines.map((line, i) => (
                        <text
                          key={line}
                          x="4"
                          y={(i - (label.lines.length - 1) / 2) * 14 + 0.5}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={line === '室内' ? 9 : 10.5}
                          fill={line === '室内' ? '#7b8271' : '#4d594b'}
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  </g>
                );
              })}
            </g>
          </>
        )}
      </svg>
      <div className="map-scale" title="WGS84 校区局部米制投影，北向上">
        <div className="scale-reading" style={{ width: scaleBar.pixels }}>
          <span>0</span>
          <span>{scaleBar.label}</span>
        </div>
        <svg width={scaleBar.pixels} height="8" role="img" aria-label={`比例尺 ${scaleBar.label}`}>
          <rect
            x=".5"
            y="1"
            width={Math.max(1, scaleBar.pixels - 1)}
            height="5"
            fill="#f9f4fb"
            stroke="#78518e"
            strokeWidth="1"
          />
          <rect x=".5" y="1" width={scaleBar.pixels / 2} height="5" fill="#78518e" />
        </svg>
      </div>
      <div className="geo-attribution">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap contributors · ODbL
        </a>
      </div>
    </div>
  );
});
