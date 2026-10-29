import {
  memo,
  useLayoutEffect,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Catalog } from '../domain';
import type { SceneHandle } from './MapScene';
import {
  mapLabels,
  metricScaleBar,
  textWidth,
  initialZoom,
  wheelZoomFactor,
  type MapFeature,
  type MapTransform,
  type MapVenue,
  type XY,
} from '../lib/campus-basemap';
import type { PlacedLabel } from '../lib/map-labels';
import { CampusSports, RadioTelescope } from './CampusSports';
import { ForestTexture } from './ForestTexture';
import { CampusNightLights } from './CampusNightLights';
import { useCampusData } from '../lib/use-campus-data';
import { unionBounds, viewportBounds, type Bounds } from '../lib/basemap-loading';
import { campusViewArea } from '../lib/campus-view-area';
import { batchRoads, batchBuildings } from '../lib/map-batches';
import { CampusVenueModel } from './CampusVenueModel';
import { getCampusModelPlacement } from '../lib/campus-model-artwork';
import { CampusVenueName } from './CampusVenueName';
import {
  isModeledCampusVenue,
  nextCampusVenueTap,
  nearestCampusVenue,
} from '../lib/campus-venue-interaction';
import './geo-campus-map.css';

type Props = {
  data: Catalog;
  onPick: (kind: string, id: string) => void;
  showLabels: boolean;
  highlightedVenueId?: string | null;
  onHighlightVenue?: (id: string | null) => void;
  onExplore?: () => void;
  // The UI keeps its mobile presentation; both devices use the approved OSM data.
  legacyMobile?: boolean;
  nightMode?: boolean;
};
function landFill(feature: MapFeature, inside = true) {
  if (feature.sport) return inside ? 'var(--map-sport, #dcd8bb)' : 'var(--map-outer-land, #d5d9c8)';
  if (['wood', 'forest'].includes(feature.subtype || ''))
    return inside ? 'var(--map-forest, #c7d4bd)' : 'var(--map-outer-forest, #dce3d6)';
  if (['grass', 'grassland', 'meadow'].includes(feature.subtype || ''))
    return inside ? 'var(--map-grass, #e6ebd9)' : 'var(--map-outer-land, #e8ece2)';
  if (['scrub', 'garden', 'park', 'recreation_ground'].includes(feature.subtype || ''))
    return inside ? 'var(--map-park, #dce5d1)' : 'var(--map-outer-land, #e3e8de)';
  if (['residential', 'construction', 'commercial'].includes(feature.subtype || ''))
    return inside ? 'var(--map-developed, #efdfc1)' : 'var(--map-outer-developed, #e3e7de)';
  return inside ? 'var(--map-park, #dce5d1)' : 'var(--map-outer-land, #e3e8de)';
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
const GeoCampusMapView = forwardRef<SceneHandle, Props>(function GeoCampusMap(
  {
    data,
    onPick,
    showLabels,
    highlightedVenueId,
    onHighlightVenue,
    onExplore,
    nightMode = false,
    legacyMobile = false,
  },
  ref,
) {
  const [priorityBounds, setPriorityBounds] = useState<Bounds | null>(null);
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const size = useRef({ width: 1, height: 1 });
  const transformRef = useRef<MapTransform>({ x: 0, y: 0, scale: 1, zoom: initialZoom });
  const updateFrame = useRef<number | null>(null);
  const movingWorld = useRef<SVGGElement | null>(null);
  const committedPose = useRef(transformRef.current);
  const [overlayVersion, setOverlayVersion] = useState(0);
  const settleTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [transform, setTransform] = useState(transformRef.current);
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null);
  const [touchPreviewId, setTouchPreviewId] = useState<string | null>(null);
  const touchPreview = useRef<string | null>(null);
  const revealedVenueId = touchPreviewId ?? hoveredModelId ?? focusedModelId;
  const touchNameHint = touchPreviewId !== null;
  function previewTouch(id: string | null) {
    touchPreview.current = id;
    setTouchPreviewId(id);
  }
  function clearNamePreview() {
    previewTouch(null);
    setHoveredModelId(null);
    setFocusedModelId(null);
  }
  const reserved = useRef<PlacedLabel['box'][]>([]);
  const pointers = useRef(new Map<number, XY>());
  const overview = useRef(true);
  const exploreCallback = useRef(onExplore);
  exploreCallback.current = onExplore;
  const {
    baseMap,
    map,
    error,
    outerError,
    unlocked,
    priorityReady,
    prefetched,
    activeBounds,
    retry,
  } = useCampusData({
    transform,
    viewport: size.current,
    priorityBounds,
    isInteracting: () => pointers.current.size > 0 || settleTimer.current !== null,
  });
  const gesture = useRef({
    x: 0,
    y: 0,
    moved: false,
    multiple: false,
    venue: null as string | null,
  });
  // Cache an overscanned window in ground space. Panning within it updates the
  // world transform instead of rebuilding thousands of unchanged SVG paths.
  const overscan = Math.max(100, 180 / transform.scale);
  const visibilityKey = [
    Math.floor((-transform.x / transform.scale - overscan) / 64),
    Math.floor((-transform.y / transform.scale - overscan) / 64),
    Math.ceil(((size.current.width - transform.x) / transform.scale + overscan) / 64),
    Math.ceil(((size.current.height - transform.y) / transform.scale + overscan) / 64),
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
  const roadBatches = useMemo(() => (groups ? batchRoads(groups.roads) : []), [groups]);
  const outerBuildings = useMemo(
    () => (groups ? batchBuildings(groups.buildings.filter((f) => !f.inCampus)) : []),
    [groups],
  );
  const innerBuildings = useMemo(() => groups?.buildings.filter((f) => f.inCampus) ?? [], [groups]);
  const campusGroups = useMemo(() => {
    if (!groups || !map) return null;
    const [l, t, r, b] = map.bounds;
    const intersects = (f: MapFeature) =>
      f.bounds[2] >= l && f.bounds[0] <= r && f.bounds[3] >= t && f.bounds[1] <= b;
    return {
      land: groups.land.filter(intersects),
      water: groups.water.filter(intersects),
      roads: batchRoads(groups.roads.filter(intersects)),
    };
  }, [groups, map]);
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
                fill={f.area ? 'var(--map-outer-water, #bdd2ce)' : 'none'}
                stroke="var(--map-water-edge, #abc2bc)"
                strokeWidth={f.area ? 0.7 : 2.5}
                fillRule="evenodd"
              />
            ))}
          </g>
          <path d={map.campusPath} fill="var(--map-ground, #f3e5c5)" />
          <g
            clipPath="url(#geo-campus)"
            pointerEvents="none"
            data-zone="campus-ground"
            shapeRendering="geometricPrecision"
          >
            {campusGroups?.land.map((f) => (
              <path key={f.id} d={f.path} fill={landFill(f)} fillRule="evenodd" />
            ))}
            {campusGroups?.water.map((f) => (
              <path
                key={f.id}
                d={f.path}
                fill={f.area ? 'var(--map-water, #b6d9d1)' : 'none'}
                stroke="var(--map-water-edge, #9fc8bf)"
                strokeWidth={f.area ? 0.7 : 2.5}
                fillRule="evenodd"
              />
            ))}
          </g>
        </>
      ) : null,
    [map, groups, campusGroups],
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
            {roadBatches
              .filter((f) => !f.footway)
              .map((f) => (
                <path
                  key={f.id}
                  d={f.path}
                  stroke="var(--map-outer-road-edge, #aab5a3)"
                  strokeWidth={(f.width || 6) + 1.4}
                />
              ))}
            {roadBatches.map((f) => (
              <path
                key={f.id}
                d={f.path}
                stroke={
                  f.footway ? 'var(--map-outer-path, #aebaab)' : 'var(--map-outer-road, #bac5b0)'
                }
                strokeWidth={f.width}
                strokeDasharray={f.footway ? '3 2' : undefined}
              />
            ))}
            <g clipPath="url(#geo-campus)" data-zone="campus-roads">
              {campusGroups?.roads
                .filter((f) => !f.footway)
                .map((f) => (
                  <path
                    key={`inner-edge-${f.id}`}
                    d={f.path}
                    stroke="var(--map-road-edge, #d5cbb3)"
                    strokeWidth={(f.width || 6) + 1.4}
                  />
                ))}
              {campusGroups?.roads.map((f) => (
                <path
                  key={`inner-${f.id}`}
                  d={f.path}
                  stroke={f.footway ? 'var(--map-path, #f8f5e9)' : 'var(--map-road, #fff8e9)'}
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
                    stroke="var(--map-outer-road-edge, #acb6a5)"
                    strokeWidth={(f.width || 6) + 1.4}
                    strokeLinecap="butt"
                  />
                  <path
                    d={f.boundaryPath}
                    stroke="var(--map-outer-road, #c4ccbc)"
                    strokeWidth={f.width}
                    strokeLinecap="butt"
                  />
                </g>
              ))}
          </g>
        </>
      ) : null,
    [map, groups, roadBatches, campusGroups],
  );
  const buildingArtwork = useMemo(
    () =>
      map && groups ? (
        <>
          <g pointerEvents="none" data-geo-buildings>
            <g data-outside-building-batches>
              {outerBuildings.map((f) => (
                <path
                  key={`shadow-${f.id}`}
                  d={f.path}
                  transform="translate(1.2 1.6)"
                  fill="var(--map-shadow, #6f7b6e)"
                  fillOpacity=".09"
                  fillRule="evenodd"
                />
              ))}
            </g>
            {innerBuildings.map((f) => (
              <path
                key={`shadow-${f.id}`}
                d={f.path}
                transform="translate(1.2 1.6)"
                fill="var(--map-shadow, #6f7b6e)"
                fillOpacity=".09"
                fillRule="evenodd"
              />
            ))}
            <g data-outside-building-batches>
              {outerBuildings.map((f) => (
                <path
                  key={f.id}
                  data-building-batch={f.count}
                  d={f.path}
                  fill="var(--map-outer-building, #fffefa)"
                  stroke="var(--map-outer-building-edge, #b9c2b4)"
                  strokeWidth=".65"
                  fillRule="evenodd"
                  strokeLinejoin="round"
                />
              ))}
            </g>
            {innerBuildings.map((f) => (
              <path
                key={f.id}
                data-building={f.id}
                data-in-campus={f.inCampus}
                d={f.path}
                fill="var(--map-building, #fffefa)"
                stroke="var(--map-building-edge, #b9c2b4)"
                strokeWidth=".65"
                fillRule="evenodd"
                strokeLinejoin="round"
              >
                {f.inCampus !== false && <title>{f.name || '校园建筑'}</title>}
              </path>
            ))}
            <RadioTelescope point={map.observatory} />
          </g>
        </>
      ) : null,
    [map, groups, innerBuildings, outerBuildings],
  );
  function paintMotion() {
    const next = transformRef.current,
      snapshot = committedPose.current;
    const ratio = next.scale / snapshot.scale;
    // Promote the SVG viewport, not an inner <g>: browsers can composite this
    // cached surface without repainting every path on each pinch frame.
    const surface = svg.current;
    if (surface) {
      surface.style.transformOrigin = '0 0';
      surface.style.willChange = 'transform';
      surface.style.transform = `translate(${next.x - snapshot.x * ratio}px, ${next.y - snapshot.y * ratio}px) scale(${ratio})`;
    }
    movingWorld.current?.setAttribute('data-map-moving', 'true');
  }
  function settleMotion() {
    if (pointers.current.size) {
      settleTimer.current = window.setTimeout(settleMotion, 160);
      return;
    }
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = null;
    // Reconcile geometry and screen-sized labels only after the gesture pauses.
    setTransform({ ...transformRef.current });
  }
  function update(next: MapTransform) {
    transformRef.current = next;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settleMotion, 160);
    if (updateFrame.current !== null) return;
    updateFrame.current = requestAnimationFrame(() => {
      updateFrame.current = null;
      paintMotion();
      const next = transformRef.current;
      const snapshot = committedPose.current;
      const ratio = next.scale / snapshot.scale;
      // Long drags refresh before leaving the overscanned window; small moves
      // and ordinary pinches never reconcile the scene once per pointer frame.
      if (
        Math.abs(next.x - snapshot.x * ratio) > 140 ||
        Math.abs(next.y - snapshot.y * ratio) > 140 ||
        ratio < 0.7 ||
        ratio > 1.45
      )
        setTransform({ ...transformRef.current });
    });
  }
  useLayoutEffect(() => {
    committedPose.current = transform;
    svg.current?.style.removeProperty('transform');
    svg.current?.style.removeProperty('will-change');
    movingWorld.current?.removeAttribute('data-map-moving');
    if (settleTimer.current !== null) paintMotion();
  }, [transform]);
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
    if (!baseMap) return transformRef.current;
    const { width, height } = size.current;
    const { left, top, bottom, centerX, centerY } = campusViewArea(host.current!, width, height);
    const [minX, minY, maxX, maxY] = baseMap.bounds;
    const scale =
      initialZoom *
      Math.max(
        0.015,
        Math.min((width - left - 30) / (maxX - minX + 90), (bottom - top) / (maxY - minY + 90)),
      );
    return {
      x: centerX - ((minX + maxX) / 2) * scale,
      y: centerY - ((minY + maxY) / 2) * scale,
      scale,
      zoom: initialZoom,
    };
  }
  function zoomAt(factor: number, x = size.current.width / 2, y = size.current.height / 2) {
    clearNamePreview();
    overview.current = false;
    const old = transformRef.current,
      zoom = Math.max(0.75, Math.min(24, old.zoom * factor)),
      ratio = zoom / old.zoom;
    if (ratio !== 1) exploreCallback.current?.();
    update({
      x: x - (x - old.x) * ratio,
      y: y - (y - old.y) * ratio,
      scale: old.scale * ratio,
      zoom,
    });
  }
  useImperativeHandle(ref, () => ({
    zoom: zoomAt,
    reset,
    rotate: () => {},
  }));
  function reset() {
    clearNamePreview();
    overview.current = true;
    const next = fitted();
    if (baseMap)
      setPriorityBounds(unionBounds(baseMap.bounds, viewportBounds(next, size.current, 80)));
    update(next);
  }
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
            '.breadcrumbs, .compass, .map-tools, .map-scale, .style-toggle, .sidebar-dock, .sidebar-handle, .header, .header-reveal, .geo-attribution, .geo-context-retry',
          ),
      ]
        // On phones the sheet covers the map; labels stay at their map positions.
        .filter(
          (node) =>
            !window.matchMedia('(max-width: 700px)').matches ||
            !node.matches('.sidebar-dock, .sidebar-handle'),
        )
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
      const next = fitted();
      if (baseMap)
        setPriorityBounds(unionBounds(baseMap.bounds, viewportBounds(next, size.current, 80)));
      if (overview.current || window.matchMedia('(max-width: 700px)').matches) update(next);
      else update({ ...transformRef.current });
    });
    observer.observe(element);
    let frame = 0;
    const overlays = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const before = JSON.stringify(reserved.current);
        measure();
        if (before !== JSON.stringify(reserved.current)) setOverlayVersion((v) => v + 1);
      });
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomAt(
        wheelZoomFactor(event.deltaY, event.deltaMode),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    surface.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('foodmap:overlays', overlays);
    const drawer = () => {
      measure();
      if (overview.current) reset();
      else setOverlayVersion((v) => v + 1);
    };
    window.addEventListener('foodmap:drawer', drawer);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      surface.removeEventListener('wheel', wheel);
      window.removeEventListener('foodmap:overlays', overlays);
      window.removeEventListener('foodmap:drawer', drawer);
    };
  }, [baseMap]);
  const placedLabels = useMemo(
    () =>
      map
        ? mapLabels(map, transform, size.current, reserved.current, showLabels, {
            venueId: revealedVenueId,
            touchHint: touchNameHint,
          })
        : { food: [], details: [] },
    [map, transform, showLabels, overlayVersion, revealedVenueId, touchNameHint],
  );
  const labels = { ...placedLabels };
  // Labels are in screen coordinates, outside the clipped world group. Keep
  // their full boxes inside the same revealed area when panning before zoom-out.
  if (activeBounds)
    labels.details = labels.details.filter(
      ({ box }) =>
        box.left >= activeBounds[0] * transform.scale + transform.x &&
        box.top >= activeBounds[1] * transform.scale + transform.y &&
        box.right <= activeBounds[2] * transform.scale + transform.x &&
        box.bottom <= activeBounds[3] * transform.scale + transform.y,
    );
  const scaleBar = metricScaleBar(transform.scale);
  const venueById = new Map(map?.venues.map((v) => [v.id, v]) || []);
  const validVenueIds = new Set(data.venues.map((v) => v.id));
  function point(event: React.PointerEvent): XY {
    const rect = host.current!.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }
  function pickKey(event: React.KeyboardEvent, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      clearNamePreview();
      onPick('venue', id);
    }
  }
  return (
    <div
      className="campus-plan geo-campus-map"
      data-map-theme={nightMode ? 'night' : 'day'}
      ref={host}
      data-priority-ready={priorityReady}
      data-periphery-unlocked={unlocked}
      data-periphery-cached={prefetched}
      data-camera-mode={overview.current ? 'overview' : 'exploring'}
    >
      {!map && (
        <p className="geo-map-status" role={error ? 'alert' : 'status'}>
          {error ? `底图加载失败：${error}` : '正在展开校园地图…'}
          {error && (
            <button type="button" onClick={retry}>
              重试
            </button>
          )}
        </p>
      )}
      {outerError && (
        <button type="button" className="geo-context-retry" onClick={retry}>
          部分周边地图加载失败，点击重试
        </button>
      )}
      <svg
        ref={svg}
        width="100%"
        height="100%"
        role="group"
        tabIndex={0}
        aria-label="南京大学仙林校区地图，北向上；可拖动缩放，点击食堂建筑和餐车进入"
        onKeyDown={(event) => {
          const targetId = (event.target as Element)
            .closest('[data-venue]')
            ?.getAttribute('data-venue');
          if (
            targetId &&
            validVenueIds.has(targetId) &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            pickKey(event, targetId);
            return;
          }
          if (event.target !== event.currentTarget) return;
          host.current!.dataset.mapInput = 'keyboard';
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
            reset();
          }
          const offsets: Record<string, XY> = {
            ArrowLeft: [45, 0],
            ArrowRight: [-45, 0],
            ArrowUp: [0, 45],
            ArrowDown: [0, -45],
          };
          if (offsets[event.key]) {
            event.preventDefault();
            clearNamePreview();
            overview.current = false;
            exploreCallback.current?.();
            const [x, y] = offsets[event.key],
              old = transformRef.current;
            update({ ...old, x: old.x + x, y: old.y + y });
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          host.current!.dataset.mapInput = 'pointer';
          if (event.pointerType !== 'mouse' || legacyMobile) {
            setHoveredModelId(null);
            setFocusedModelId(null);
          }
          const [x, y] = point(event);
          const target = event.target as Element;
          let tappedVenue = target.closest('[data-venue]')?.getAttribute('data-venue') || null;
          if (tappedVenue && target.closest('.geo-venue') && map) {
            const pose = transformRef.current;
            tappedVenue =
              nearestCampusVenue(
                map.venues.filter((v) => validVenueIds.has(v.id)),
                [(x - pose.x) / pose.scale, (y - pose.y) / pose.scale],
                pose.scale,
              ) ?? tappedVenue;
          }
          pointers.current.set(event.pointerId, [x, y]);
          if (pointers.current.size === 1)
            gesture.current = {
              x,
              y,
              moved: false,
              multiple: false,
              venue: tappedVenue,
            };
          else {
            gesture.current.multiple = true;
            clearNamePreview();
          }
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onBlur={(event) => {
          if (event.target === event.currentTarget) delete host.current!.dataset.mapInput;
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) return;
          const current = point(event),
            other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
          if (
            other ||
            Math.hypot(current[0] - gesture.current.x, current[1] - gesture.current.y) > 5
          ) {
            overview.current = false;
            if (!gesture.current.moved) {
              clearNamePreview();
              exploreCallback.current?.();
            }
          }
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
          if (pointers.current.has(event.pointerId) && !g.moved && !g.multiple) {
            const venueId = g.venue && validVenueIds.has(g.venue) ? g.venue : null;
            const next = nextCampusVenueTap(
              touchPreview.current,
              venueId,
              (legacyMobile || event.pointerType !== 'mouse') && isModeledCampusVenue(venueId),
            );
            previewTouch(next.preview);
            if (next.preview) onHighlightVenue?.(next.preview);
            if (!venueId) {
              clearNamePreview();
              onHighlightVenue?.(null);
            }
            if (next.enter) {
              clearNamePreview();
              onPick('venue', next.enter);
            }
          }
          pointers.current.delete(event.pointerId);
        }}
        onPointerCancel={(event) => {
          clearNamePreview();
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
              {activeBounds && (
                <clipPath id="geo-active-coverage">
                  <rect
                    x={activeBounds[0]}
                    y={activeBounds[1]}
                    width={activeBounds[2] - activeBounds[0]}
                    height={activeBounds[3] - activeBounds[1]}
                  />
                </clipPath>
              )}
            </defs>
            <g
              ref={movingWorld}
              data-geo-world
              data-map-zoom={transform.zoom}
              transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}
              clipPath={activeBounds ? 'url(#geo-active-coverage)' : undefined}
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
                {nightMode && (
                  <CampusNightLights
                    campusPath={map.campusPath}
                    features={baseMap?.features ?? map.features}
                    venues={map.venues}
                  />
                )}
                <g data-geo-food>
                  {map.venues
                    .filter((v) => validVenueIds.has(v.id))
                    .map((venue) => {
                      const { base, roof, polygon } = cuboid(venue);
                      return (
                        <g
                          key={venue.id}
                          data-venue={venue.id}
                          className={`geo-venue${highlightedVenueId === venue.id ? ' is-highlighted' : ''}`}
                          role="button"
                          tabIndex={0}
                          aria-label={`进入${venue.name}${venue.indoor ? '（室内）' : ''}`}
                          onKeyDown={(e) => pickKey(e, venue.id)}
                          onPointerEnter={(e) => {
                            if (
                              e.pointerType === 'mouse' &&
                              !legacyMobile &&
                              pointers.current.size === 0
                            ) {
                              previewTouch(null);
                              setHoveredModelId(isModeledCampusVenue(venue.id) ? venue.id : null);
                              onHighlightVenue?.(venue.id);
                            }
                          }}
                          onPointerLeave={(e) => {
                            if (e.pointerType === 'mouse') {
                              setHoveredModelId(null);
                              onHighlightVenue?.(null);
                            }
                          }}
                          onFocus={(e) => {
                            if (e.currentTarget.matches(':focus-visible')) {
                              setFocusedModelId(isModeledCampusVenue(venue.id) ? venue.id : null);
                            }
                            onHighlightVenue?.(venue.id);
                          }}
                          onBlur={() => {
                            setFocusedModelId(null);
                            onHighlightVenue?.(null);
                          }}
                        >
                          {!isModeledCampusVenue(venue.id) && (
                            <title>
                              {venue.name}
                              {venue.indoor && venue.id !== 'v-yifu' ? ' · 室内' : ''} · 点击进入
                            </title>
                          )}
                          {getCampusModelPlacement(venue, transform.scale) ? (
                            <CampusVenueModel
                              venue={venue}
                              scale={transform.scale}
                              nightMode={nightMode}
                              highlighted={highlightedVenueId === venue.id}
                            />
                          ) : (
                            <>
                              <polygon
                                points={polygon(base.map(([x, y]) => [x + 3, y + 4]))}
                                fill="var(--map-shadow, #72816f)"
                                fillOpacity=".17"
                              />
                              {base.map((point, i) => (
                                <polygon
                                  key={i}
                                  className="geo-venue-wall"
                                  points={polygon([
                                    point,
                                    base[(i + 1) % 4],
                                    roof[(i + 1) % 4],
                                    roof[i],
                                  ])}
                                  fill={venue.color}
                                  stroke="var(--map-venue-edge, #989f8e)"
                                  strokeWidth=".45"
                                />
                              ))}
                              <polygon
                                className="geo-venue-roof"
                                points={polygon(roof)}
                                fill={venue.color}
                                stroke="var(--map-venue-edge, #969f8d)"
                                strokeWidth=".8"
                              />
                              <path
                                className="geo-venue-rim"
                                d={`M${roof[0].join(' ')}L${roof[1].join(' ')}L${roof[2].join(' ')}`}
                                fill="none"
                                stroke="var(--map-venue-rim, #fffdf3)"
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
                            </>
                          )}
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
              {labels.food
                .filter((label) => !isModeledCampusVenue(label.id))
                .map((label) => {
                  const venue = venueById.get(label.id)!;
                  if (!validVenueIds.has(venue.id)) return null;
                  return (
                    <g
                      key={label.id}
                      data-venue={label.id}
                      className={`geo-food-label${highlightedVenueId === venue.id ? ' is-highlighted' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`进入${venue.name}${venue.indoor ? '（室内）' : ''}`}
                      onKeyDown={(e) => pickKey(e, venue.id)}
                      onPointerEnter={(e) => {
                        if (e.pointerType === 'mouse') onHighlightVenue?.(venue.id);
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType === 'mouse') onHighlightVenue?.(null);
                      }}
                      onFocus={() => onHighlightVenue?.(venue.id)}
                      onBlur={() => onHighlightVenue?.(null)}
                    >
                      <path
                        d={`M${label.anchorX} ${label.anchorY}L${label.x} ${label.y}`}
                        fill="none"
                        stroke="var(--map-label-leader, #929e89)"
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
                          fill="var(--map-label-paper, #fffdf7)"
                          fillOpacity=".97"
                          stroke="var(--map-label-border, #c7cfbd)"
                          strokeWidth=".8"
                        />
                        <circle
                          cx={-label.width / 2 + 8}
                          r="2.8"
                          fill={`var(--map-label-dot, ${venue.color})`}
                          stroke="var(--map-label-border, #9fa88f)"
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
                            fill={
                              line === '室内'
                                ? 'var(--map-label-muted, #7b8271)'
                                : 'var(--map-label-ink, #4d594b)'
                            }
                          >
                            {line}
                          </text>
                        ))}
                      </g>
                    </g>
                  );
                })}
            </g>
            <CampusVenueName
              label={
                labels.food.find(
                  (label) => label.id === revealedVenueId && isModeledCampusVenue(label.id),
                ) ?? null
              }
              touchHint={touchNameHint}
            />
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

export const GeoCampusMap = memo(GeoCampusMapView);
