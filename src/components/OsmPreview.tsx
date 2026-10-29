import { useEffect, useMemo, useRef, useState } from 'react';
import {
  campusProjection,
  featureName,
  geometryAnchor,
  geometryPath,
  layerIds,
  type LayerId,
  type OsmFeature,
} from '../lib/osm-geometry';
import { createOsmPreviewLoader, type OsmPreviewDataset } from '../lib/osm-preview-loading';
import './osm-preview.css';
import { VenueReviewOverlay, VenueReviewPanel, reviewLines } from './VenueReview';

const titles: Record<LayerId, string> = {
  boundary: '校园边界',
  roads: '道路 / 人行道',
  buildings: '建筑轮廓',
  land: '绿地 / 植被 / 运动设施',
  water: '水体 / 水道',
  pois: '设施 / 商店',
  labels: '原始名称',
};
const previewLoader = createOsmPreviewLoader(`${import.meta.env.BASE_URL}osm/`);
const asset = (file: string) => `${import.meta.env.BASE_URL}osm/${file}`;
type Transform = { x: number; y: number; scale: number };

function landColor(feature: OsmFeature) {
  const p = feature.properties;
  if (['pitch', 'track', 'sports_centre', 'stadium'].includes(String(p.leisure))) return '#e7c8b7';
  if (p.natural === 'water' || p.water) return '#b1dce9';
  if (p.natural === 'wood' || p.landuse === 'forest') return '#b4cba8';
  if (p.landuse === 'residential' || p.landuse === 'construction') return '#e5e0d8';
  return '#d5e3bd';
}

export default function OsmPreview() {
  const [dataset, setDataset] = useState<OsmPreviewDataset | null>(null);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState<Record<LayerId, boolean>>({
    boundary: true,
    roads: true,
    buildings: true,
    land: true,
    water: true,
    pois: true,
    labels: true,
  });
  const [selection, setSelection] = useState<OsmFeature | null>(null);
  const [showVenues, setShowVenues] = useState(true);
  const [campusOnly, setCampusOnly] = useState(false);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  const host = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ x: 0, y: 0, moved: false, multiple: false, id: '' });
  const projection = useMemo(
    () => (dataset ? campusProjection(dataset.manifest.bbox) : null),
    [dataset],
  );
  const features = useMemo(
    () =>
      new Map(
        dataset
          ? [
              ...Object.values(dataset.layers).flatMap((l) => l.features),
              ...dataset.venues.features,
            ].map((f) => [f.id, f])
          : [],
      ),
    [dataset],
  );
  const paths = useMemo(
    () =>
      new Map(
        projection
          ? [...features.values()].map((f) => [f.id, geometryPath(f.geometry, projection.project)])
          : [],
      ),
    [features, projection],
  );

  function update(next: Transform) {
    transformRef.current = next;
    setTransform(next);
  }
  function fit() {
    if (!projection) return;
    const scale = Math.min(
      (size.width - 60) / projection.width,
      (size.height - 60) / projection.height,
    );
    update({
      x: (size.width - projection.width * scale) / 2,
      y: (size.height - projection.height * scale) / 2,
      scale: Math.max(0.01, scale),
    });
  }
  function zoom(factor: number, x = size.width / 2, y = size.height / 2) {
    const previous = transformRef.current;
    const scale = Math.max(0.06, Math.min(12, previous.scale * factor));
    const ratio = scale / previous.scale;
    update({ scale, x: x - (x - previous.x) * ratio, y: y - (y - previous.y) * ratio });
  }
  function focusVenue(venue: OsmFeature) {
    if (!projection || !dataset || venue.geometry.type !== 'Point') return;
    const reference = dataset.references.features.find(
      (f) => f.id === venue.properties.reference_osm_id,
    );
    const geometry = reference?.geometry;
    const vertices =
      geometry?.type === 'Polygon'
        ? geometry.coordinates[0]
        : geometry?.type === 'LineString'
          ? geometry.coordinates
          : [];
    const points = [...vertices, venue.geometry.coordinates].map(projection.project);
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    const left = Math.min(...xs),
      right = Math.max(...xs),
      top = Math.min(...ys),
      bottom = Math.max(...ys);
    const scale = Math.max(
      0.06,
      Math.min(
        6,
        (size.width - 70) / Math.max(150, right - left + 70),
        (size.height - 100) / Math.max(150, bottom - top + 70),
      ),
    );
    setSelection(venue);
    setShowVenues(true);
    update({
      scale,
      x: size.width / 2 - ((left + right) / 2) * scale,
      y: size.height / 2 - ((top + bottom) / 2) * scale,
    });
  }
  useEffect(() => {
    let cancelled = false;
    previewLoader.load()
      .then((value) => {
        if (!cancelled) setDataset(value);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    // 只取消当前组件接收结果；共享请求留给重新挂载的预览页面继续使用。
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    fit();
    const requested = new URLSearchParams(window.location.search).get('venue');
    const venue = dataset?.venues.features.find((f) => f.properties.venue_id === requested);
    if (venue && size.width > 50 && size.height > 50) focusVenue(venue);
  }, [projection, size.width, size.height]);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoom(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [size]);

  // Greedy screen-space placement keeps raw names readable without changing source data.
  const labels: { feature: OsmFeature; x: number; y: number; width: number }[] = [];
  const reviewBoxes =
    projection && dataset && showVenues
      ? dataset.venues.features.flatMap((venue) => {
          if (venue.geometry.type !== 'Point') return [];
          const [px, py] = projection.project(venue.geometry.coordinates),
            lines = reviewLines(venue);
          return [
            {
              left: px * transform.scale + transform.x + 15,
              right:
                px * transform.scale +
                transform.x +
                17 +
                Math.max(...lines.map((l) => l.length)) * 12 +
                38,
              top: py * transform.scale + transform.y - (lines.length * 17 + 30),
              bottom: py * transform.scale + transform.y - 16,
            },
          ];
        })
      : [];
  if (dataset && projection && enabled.labels) {
    const candidates = [...dataset.layers.labels.features]
      .filter((f) => f.id !== 'way/89910837')
      .sort(
        (a, b) =>
          Number(Boolean(b.properties.building || b.properties.highway)) -
          Number(Boolean(a.properties.building || a.properties.highway)),
      );
    for (const feature of candidates) {
      const [px, py] = projection.project(geometryAnchor(feature.geometry));
      const x = px * transform.scale + transform.x,
        y = py * transform.scale + transform.y;
      const width = Math.min(180, featureName(feature).length * 10 + 8);
      if (
        reviewBoxes.some(
          (box) =>
            x + width / 2 > box.left &&
            x - width / 2 < box.right &&
            y + 10 > box.top &&
            y - 10 < box.bottom,
        )
      )
        continue;
      if (x < width / 2 || x > size.width - width / 2 || y < 15 || y > size.height - 15) continue;
      if (
        labels.some((l) => Math.abs(l.y - y) < 20 && Math.abs(l.x - x) < (l.width + width) / 2 + 8)
      )
        continue;
      labels.push({ feature, x, y, width });
    }
  }
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const scaleMetres =
    [5, 10, 20, 50, 100, 200, 500, 1000].filter((m) => m * transform.scale <= 120).at(-1) || 5;
  const path = (feature: OsmFeature, layer: LayerId) => {
    const polygon = feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon';
    const footway = ['footway', 'path', 'steps', 'pedestrian', 'cycleway'].includes(
      String(feature.properties.highway),
    );
    return (
      <path
        key={feature.id}
        data-osm={feature.id}
        d={paths.get(feature.id)}
        fillRule="evenodd"
        fill={
          layer === 'buildings'
            ? '#fffdfa'
            : layer === 'land'
              ? landColor(feature)
              : layer === 'water' && polygon
                ? '#a9d6e4'
                : 'none'
        }
        stroke={
          layer === 'boundary'
            ? '#8061ad'
            : layer === 'buildings'
              ? '#9b9c99'
              : layer === 'water'
                ? '#74b8d1'
                : layer === 'roads'
                  ? footway
                    ? '#c7baa2'
                    : '#a8a9aa'
                  : '#b9c5ad'
        }
        strokeWidth={layer === 'roads' ? (footway ? 2.1 : 5) : layer === 'water' ? 2 : 1}
        strokeDasharray={
          layer === 'boundary' ? '7 5' : layer === 'roads' && footway ? '3 2' : undefined
        }
        vectorEffect={layer === 'roads' || layer === 'water' ? undefined : 'non-scaling-stroke'}
      >
        <title>
          {featureName(feature)} · {feature.id}
        </title>
      </path>
    );
  };

  return (
    <main className="osm-preview">
      <header className="osm-header">
        <div>
          <h1>仙林校区 · OSM 底图检查</h1>
          <p>
            补充 3 个地点的视觉对齐预览 ·{' '}
            {dataset?.venues.features.every((f) => f.properties.review_status === 'approved')
              ? '已审核'
              : '待审查'}
          </p>
        </div>
        <a href={import.meta.env.BASE_URL}>返回美食地图</a>
      </header>
      <div className="osm-layout">
        <aside className="osm-panel" aria-label="数据与图层">
          {error && (
            <p role="alert">数据加载失败：{error}。请运行 node scripts/osm/convert.mjs 后刷新。</p>
          )}
          {!dataset && !error && <p role="status">正在读取本地 GeoJSON…</p>}
          {dataset && (
            <>
              <VenueReviewPanel venues={dataset.venues} onFocus={focusVenue} />
              <label className="osm-clip">
                <input
                  type="checkbox"
                  checked={showVenues}
                  onChange={(event) => setShowVenues(event.target.checked)}
                />
                显示补充地点与参照轮廓
              </label>
              <h2>数据范围</h2>
              <p>
                {dataset.manifest.boundary.name}
                <br />
                {dataset.manifest.boundary.address}
              </p>
              <p className="osm-muted">
                获取日期：
                {new Date(dataset.manifest.sources.at(-1)!.retrievedAt).toLocaleDateString(
                  'zh-CN',
                  { timeZone: 'Asia/Shanghai' },
                )}
                <br />
                WGS84 · 北向上 · 周边道路一并保留
                <br />
                来源：
                {dataset.manifest.method === 'osm-api-bbox-fallback'
                  ? 'OSM 官方 API（Overpass 不可用）'
                  : dataset.manifest.method}
              </p>
              <h2>图层与数量</h2>
              {layerIds.map((id) => (
                <label className={`osm-layer osm-layer-${id}`} key={id}>
                  <input
                    type="checkbox"
                    checked={enabled[id]}
                    onChange={(e) => setEnabled({ ...enabled, [id]: e.target.checked })}
                  />
                  <i aria-hidden="true" />
                  {titles[id]}
                  <span>{dataset.manifest.counts[id]}</span>
                </label>
              ))}
              <label className="osm-clip">
                <input
                  type="checkbox"
                  checked={campusOnly}
                  onChange={(e) => setCampusOnly(e.target.checked)}
                />
                仅显示校园边界内
              </label>
              <p className="osm-muted">
                数量按整个查询框统计，各层可重叠。{dataset.manifest.buildingsWithCourtyards}{' '}
                个建筑含内院孔洞。 勾选校园范围仅改变显示，不裁剪下载数据。
              </p>
              <div className="osm-downloads">
                <a href={asset('all.geojson')} download>
                  下载 OSM 底图 GeoJSON
                </a>
                <a href={asset('manifest.json')} download>
                  来源与统计
                </a>
              </div>
              <h2>点击要素检查</h2>
              {selection ? (
                <section className="osm-selection" aria-live="polite">
                  <strong>{featureName(selection)}</strong>
                  <a
                    href={`https://www.openstreetmap.org/${String(selection.properties.reference_osm_id || selection.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selection.properties.venue_id
                      ? `参照 ${selection.properties.reference_osm_id}`
                      : selection.id}{' '}
                    ↗
                  </a>
                  <p>{selection.geometry.type}</p>
                  {selection.geometry.type === 'Point' &&
                    Boolean(selection.properties.venue_id) && (
                      <>
                        <p className="osm-review-status">
                          视觉对齐 ·{' '}
                          {selection.properties.review_status === 'approved' ? '已审核' : '待审查'}
                          {selection.properties.indoor === true ? ' · 位于室内' : ''}
                        </p>
                        <p className="osm-muted">
                          经度 {selection.geometry.coordinates[0].toFixed(7)}
                          <br />
                          纬度 {selection.geometry.coordinates[1].toFixed(7)}
                          <br />
                          {String(selection.properties.placement_note)}
                        </p>
                      </>
                    )}
                  <dl>
                    {Object.entries(selection.properties)
                      .filter(
                        ([key, value]) =>
                          key !== 'osm_meta' && key !== 'osm_id' && typeof value !== 'object',
                      )
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ))}
                  </dl>
                </section>
              ) : (
                <p className="osm-muted">
                  点击建筑、道路、水体或橙色设施点，查看原始名称、标签与 OSM ID。
                </p>
              )}
            </>
          )}
        </aside>
        <div className="osm-map" ref={host}>
          <svg
            ref={svg}
            width="100%"
            height="100%"
            role="group"
            tabIndex={0}
            aria-label="南京大学仙林校区 OSM 地图，可拖动缩放，点击要素查看属性"
            onKeyDown={(event) => {
              if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                zoom(1.3);
              }
              if (event.key === '-') {
                event.preventDefault();
                zoom(1 / 1.3);
              }
              if (event.key === 'Home') {
                event.preventDefault();
                fit();
              }
              const deltas: Record<string, [number, number]> = {
                ArrowLeft: [60, 0],
                ArrowRight: [-60, 0],
                ArrowUp: [0, 60],
                ArrowDown: [0, -60],
              };
              if (deltas[event.key]) {
                event.preventDefault();
                const [x, y] = deltas[event.key];
                const old = transformRef.current;
                update({ ...old, x: old.x + x, y: old.y + y });
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const p = point(event);
              pointers.current.set(event.pointerId, p);
              if (pointers.current.size === 1)
                gesture.current = {
                  ...p,
                  moved: false,
                  multiple: false,
                  id:
                    (event.target as Element).closest('[data-osm]')?.getAttribute('data-osm') || '',
                };
              else gesture.current.multiple = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const previous = pointers.current.get(event.pointerId);
              if (!previous) return;
              const p = point(event),
                other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
              if (other) {
                const before = Math.hypot(previous.x - other.x, previous.y - other.y);
                if (before > 0)
                  zoom(
                    Math.hypot(p.x - other.x, p.y - other.y) / before,
                    (previous.x + other.x) / 2,
                    (previous.y + other.y) / 2,
                  );
              }
              const old = transformRef.current,
                divisor = other ? 2 : 1;
              update({
                ...old,
                x: old.x + (p.x - previous.x) / divisor,
                y: old.y + (p.y - previous.y) / divisor,
              });
              if (Math.hypot(p.x - gesture.current.x, p.y - gesture.current.y) > 5)
                gesture.current.moved = true;
              pointers.current.set(event.pointerId, p);
            }}
            onPointerUp={(event) => {
              const g = gesture.current;
              if (pointers.current.has(event.pointerId) && !g.moved && !g.multiple && g.id)
                setSelection(features.get(g.id) || null);
              pointers.current.delete(event.pointerId);
            }}
            onPointerCancel={(event) => {
              pointers.current.delete(event.pointerId);
              gesture.current.multiple = true;
            }}
            onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
          >
            <defs>
              <clipPath id="osm-campus-clip">
                <path d={paths.get('way/89910837')} fillRule="evenodd" clipRule="evenodd" />
              </clipPath>
            </defs>
            {dataset && projection && (
              <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                <rect width={projection.width} height={projection.height} fill="#f2f1ea" />
                <path
                  d={paths.get('way/89910837')}
                  fill="#e8eddf"
                  fillRule="evenodd"
                  pointerEvents="none"
                />
                <g clipPath={campusOnly ? 'url(#osm-campus-clip)' : undefined}>
                  {(['land', 'water', 'roads', 'buildings'] as LayerId[]).map(
                    (id) =>
                      enabled[id] && (
                        <g key={id} data-layer={id}>
                          {dataset.layers[id].features.map((f) => path(f, id))}
                        </g>
                      ),
                  )}
                  {enabled.pois && (
                    <g data-layer="pois">
                      {dataset.layers.pois.features
                        .filter((f) => f.id !== 'way/89910837')
                        .map((f) => {
                          const [x, y] = projection.project(geometryAnchor(f.geometry));
                          return (
                            <circle
                              key={f.id}
                              data-osm={f.id}
                              cx={x}
                              cy={y}
                              r={3 / transform.scale}
                              fill="#ce8047"
                              stroke="#fffdf8"
                              strokeWidth={1 / transform.scale}
                            >
                              <title>
                                {featureName(f)} · {f.id}
                              </title>
                            </circle>
                          );
                        })}
                    </g>
                  )}
                  {selection && (
                    <g pointerEvents="none">
                      <path
                        d={paths.get(selection.id)}
                        fill="none"
                        stroke="#e66a32"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                      />
                      {(() => {
                        const [x, y] = projection.project(geometryAnchor(selection.geometry));
                        return (
                          <circle
                            cx={x}
                            cy={y}
                            r={7 / transform.scale}
                            fill="none"
                            stroke="#e66a32"
                            strokeWidth={2 / transform.scale}
                          />
                        );
                      })()}
                    </g>
                  )}
                </g>
                {enabled.boundary && path(dataset.layers.boundary.features[0], 'boundary')}
              </g>
            )}
            <g
              transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}
              pointerEvents="none"
            >
              <g clipPath={campusOnly ? 'url(#osm-campus-clip)' : undefined}>
                <g
                  className="osm-labels"
                  transform={`translate(${-transform.x / transform.scale} ${-transform.y / transform.scale}) scale(${1 / transform.scale})`}
                >
                  {labels.map(({ feature, x, y }) => (
                    <text
                      key={feature.id}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {featureName(feature)}
                    </text>
                  ))}
                </g>
              </g>
            </g>
            {dataset && projection && showVenues && (
              <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                <g clipPath={campusOnly ? 'url(#osm-campus-clip)' : undefined}>
                  <VenueReviewOverlay
                    venues={dataset.venues}
                    references={dataset.references}
                    project={projection.project}
                    scale={transform.scale}
                    onFocus={focusVenue}
                  />
                </g>
              </g>
            )}
          </svg>
          <div className="osm-map-tools">
            <button aria-label="放大" onClick={() => zoom(1.4)}>
              ＋
            </button>
            <button aria-label="缩小" onClick={() => zoom(1 / 1.4)}>
              −
            </button>
            <button onClick={fit}>全图</button>
          </div>
          <div className="osm-map-note">
            北 ↑ · 拖动平移 / 滚轮或双指缩放
            <br />
            <span
              style={{
                display: 'inline-block',
                width: scaleMetres * transform.scale,
                borderBottom: '2px solid #4c5553',
              }}
            />{' '}
            {scaleMetres} 米
          </div>
          <div className="osm-attribution">
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap contributors
            </a>
            {' · '}
            <a
              href="https://opendatacommons.org/licenses/odbl/1-0/"
              target="_blank"
              rel="noreferrer"
            >
              ODbL
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
