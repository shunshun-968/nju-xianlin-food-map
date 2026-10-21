import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Catalog } from '../domain';
import type { SceneHandle } from './MapScene';
import layout from '../data/campus-layout.json';
import { campusFrame, campusLabels, venueAnchors } from '../data/campus';

type Transform = { x: number; y: number; scale: number; zoom: number };
type Props = { data: Catalog; onPick: (kind: string, id: string) => void; showLabels: boolean };
const replaced = new Set(Object.values(venueAnchors).map((anchor) => anchor.replaces));
const features = layout.features.filter((feature) => !replaced.has(feature.id));
const woodland = features
  .filter((f) => f.kind === 1)
  .map((f) => f.path)
  .join(' ');

/** A flat, local-coordinate plan. Only food venues have an illustrative raised top. */
export const CampusMap = forwardRef<SceneHandle, Props>(function CampusMap(
  { data, onPick, showLabels },
  ref,
) {
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const size = useRef({ width: 1, height: 1 }),
    transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1, zoom: 1 });
  const [transform, setTransform] = useState(transformRef.current);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    x: 0,
    y: 0,
    moved: false,
    multiple: false,
    venue: null as string | null,
  });
  function update(next: Transform) {
    transformRef.current = next;
    setTransform(next);
  }
  function fitted() {
    const { width, height } = size.current;
    const scale = Math.max(
      0.01,
      Math.min((width - 32) / campusFrame.width, (height - 55) / campusFrame.height),
    );
    return {
      x: width / 2 - (campusFrame.x + campusFrame.width / 2) * scale,
      y: height / 2 - (campusFrame.y + campusFrame.height / 2) * scale,
      scale,
      zoom: 1,
    };
  }
  function zoomAt(factor: number, x = size.current.width / 2, y = size.current.height / 2) {
    const old = transformRef.current;
    const zoom = Math.max(0.85, Math.min(8, old.zoom * factor)),
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
    const element = host.current!,
      surface = svg.current!;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      size.current = { width: rect.width, height: rect.height };
      update(fitted());
    });
    observer.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    surface.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      surface.removeEventListener('wheel', wheel);
    };
  }, []);
  const point = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const inv = 1 / transform.scale;
  return (
    <div ref={host} className="campus-plan">
      <svg
        ref={svg}
        width="100%"
        height="100%"
        role="group"
        aria-label="仙林校区相对位置平面图，可拖动缩放；浅彩色地点可点击"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            zoomAt(1.2);
          }
          if (event.key === '-') {
            event.preventDefault();
            zoomAt(1 / 1.2);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            update(fitted());
          }
          const offset: Record<string, [number, number]> = {
            ArrowLeft: [45, 0],
            ArrowRight: [-45, 0],
            ArrowUp: [0, 45],
            ArrowDown: [0, -45],
          };
          if (offset[event.key]) {
            event.preventDefault();
            const [x, y] = offset[event.key];
            update({
              ...transformRef.current,
              x: transformRef.current.x + x,
              y: transformRef.current.y + y,
            });
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
              venue:
                (event.target as Element).closest('[data-venue]')?.getAttribute('data-venue') ||
                null,
            };
          else gesture.current.multiple = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const oldPoint = pointers.current.get(event.pointerId);
          if (!oldPoint) return;
          const p = point(event),
            old = transformRef.current;
          if (pointers.current.size === 2) {
            const other = [...pointers.current.entries()].find(
              ([id]) => id !== event.pointerId,
            )![1];
            const before = Math.hypot(oldPoint.x - other.x, oldPoint.y - other.y),
              after = Math.hypot(p.x - other.x, p.y - other.y);
            if (before > 0)
              zoomAt(after / before, (oldPoint.x + other.x) / 2, (oldPoint.y + other.y) / 2);
            const current = transformRef.current;
            update({
              ...current,
              x: current.x + (p.x - oldPoint.x) / 2,
              y: current.y + (p.y - oldPoint.y) / 2,
            });
          } else update({ ...old, x: old.x + p.x - oldPoint.x, y: old.y + p.y - oldPoint.y });
          if (Math.hypot(p.x - gesture.current.x, p.y - gesture.current.y) > 5)
            gesture.current.moved = true;
          pointers.current.set(event.pointerId, p);
        }}
        onPointerUp={(event) => {
          const g = gesture.current;
          if (pointers.current.has(event.pointerId) && !g.moved && !g.multiple && g.venue)
            onPick('venue', g.venue);
          pointers.current.delete(event.pointerId);
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          gesture.current.multiple = true;
        }}
        onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
      >
        <defs>
          <radialGradient id="tree-leaf">
            <stop stopColor="#b5c39a" />
            <stop offset=".68" stopColor="#8eaa78" />
            <stop offset="1" stopColor="#7d946c" stopOpacity=".55" />
          </radialGradient>
          <symbol id="plan-tree" viewBox="-10 -10 20 20">
            <ellipse cx="2" cy="3" rx="7" ry="6" fill="#6a735c" opacity=".13" />
            <circle r="7" fill="url(#tree-leaf)" />
            <circle cx="-2" cy="-2" r="4" fill="#c6d1ae" opacity=".45" />
            <path d="M-4 2L3-3M0-5L1 5" stroke="#6e855b" strokeWidth=".5" opacity=".3" />
          </symbol>
          <pattern id="contours" width="270" height="220" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#f8f8e9" strokeWidth="1" opacity=".42">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <path
                  key={i}
                  d={`M${-40 + i * 9} 220 C${180 + i * 9} 160 ${-80 + i * 9} 60 ${90 + i * 10} -20`}
                />
              ))}
            </g>
          </pattern>
          <pattern
            id="lawn-lines"
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-20)"
          >
            <path d="M0 0V9" stroke="#faf9e9" strokeWidth="1" opacity=".23" />
          </pattern>
        </defs>
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          <path
            d="M218 500Q232 370 250 165L1000 165Q1124 500 1062 990L1040 1280 1140 1525Q850 1650 442 1658Q277 1260 203 916Q174 724 218 500Z"
            fill="#e4e6d5"
            stroke="#d8dbca"
            strokeWidth="2"
          />
          {features
            .filter((f) => f.kind === 1 || f.kind === 2)
            .map((f) => (
              <path
                key={f.id}
                d={f.path}
                fill={f.kind === 1 ? '#cfd7b7' : '#d4dbb8'}
                stroke="#c4cdab"
                strokeWidth="1"
                fillRule="evenodd"
              />
            ))}
          <path d={woodland} fill="url(#contours)" fillRule="evenodd" />
          {features
            .filter((f) => f.kind === 3)
            .map((f) => (
              <g key={f.id}>
                <path
                  d={f.path}
                  fill="#b8d2ce"
                  stroke="#a8c4c0"
                  strokeWidth="1.2"
                  fillRule="evenodd"
                />
                <path d={f.path} fill="url(#lawn-lines)" />
              </g>
            ))}
          {features
            .filter((f) => f.kind === 4)
            .map((f) => (
              <path
                key={f.id}
                d={f.path}
                fill="#e7e5df"
                stroke="#c9c9bf"
                strokeWidth="1.2"
                strokeLinejoin="round"
                fillRule="evenodd"
              />
            ))}
          {features
            .filter((f) => f.kind === 9)
            .map((f) => (
              <g key={f.id}>
                <path
                  d={f.path}
                  fill="#d9d6c2"
                  stroke="#f5f4e9"
                  strokeWidth="1.5"
                  fillRule="evenodd"
                />
                <path d={f.path} fill="url(#lawn-lines)" />
              </g>
            ))}
          {layout.trees.map(([x, y, s], i) => (
            <use
              key={i}
              href="#plan-tree"
              x={x - 8 * s}
              y={y - 8 * s}
              width={16 * s}
              height={16 * s}
              opacity=".82"
            />
          ))}
          <g className="ordinary-buildings">
            {features
              .filter((f) => f.kind >= 5 && f.kind <= 8)
              .map((f) => (
                <g key={f.id}>
                  <path
                    d={f.path}
                    transform="translate(2 3)"
                    fill="#7f8477"
                    opacity=".17"
                    fillRule="evenodd"
                  />
                  <path
                    d={f.path}
                    fill="#fffefb"
                    stroke="#b8bcaf"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    fillRule="evenodd"
                  />
                </g>
              ))}
          </g>
          {showLabels && (
            <g className="plan-labels" pointerEvents="none">
              {campusLabels
                .filter(
                  (l) =>
                    l.tier === 0 ||
                    (l.tier === 1 && transform.zoom >= 1.35) ||
                    transform.zoom >= 2.5,
                )
                .map((l) => (
                  <text
                    key={l.name}
                    x={l.x}
                    y={l.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={l.rotation ? `rotate(${l.rotation} ${l.x} ${l.y})` : undefined}
                    className={`plan-label ${l.kind || 'building'}`}
                    fontSize={Math.max(l.tier === 2 ? 10 : 13, (l.tier === 0 ? 10.5 : 9.5) * inv)}
                  >
                    {l.name}
                  </text>
                ))}
            </g>
          )}
          {data.venues.map((venue) => {
            const anchor = venueAnchors[venue.id];
            if (!anchor) return null;
            const [x, y] = venue.campusPosition,
              [w, h] = venue.footprint,
              raised = 5;
            const labelLines =
              venue.id === 'v-hut' ? ['四五六食堂东侧', '美食小屋／小餐车'] : [venue.name];
            const labelWidth = Math.max(...labelLines.map((t) => t.length)) * 10.5 + 18,
              labelHeight = labelLines.length * 14 + 10;
            const dx = anchor.labelOffset[0] * inv,
              dy = anchor.labelOffset[1] * inv;
            return (
              <g
                key={venue.id}
                className="plan-venue"
                data-venue={venue.id}
                role="button"
                tabIndex={0}
                aria-label={`进入${venue.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPick('venue', venue.id);
                  }
                }}
              >
                <title>{venue.name} · 点击进入</title>
                <g transform={`translate(${x} ${y}) rotate(${anchor.rotation})`}>
                  <rect
                    x={-w / 2 + 3}
                    y={-h / 2 + 4}
                    width={w}
                    height={h}
                    rx="1"
                    fill="#6e7465"
                    opacity=".18"
                  />
                  <path
                    d={`M${-w / 2} ${h / 2 - raised}H${w / 2}V${h / 2}H${-w / 2}Z`}
                    fill={anchor.side}
                  />
                  <path
                    d={`M${w / 2} ${-h / 2 - raised}V${h / 2 - raised + raised}L${w / 2 - 3} ${h / 2 - raised}V${-h / 2 - raised}Z`}
                    fill={anchor.side}
                  />
                  <rect
                    className="venue-roof"
                    x={-w / 2}
                    y={-h / 2 - raised}
                    width={w}
                    height={h}
                    rx="1.5"
                    fill={anchor.color}
                    stroke="#a8a58f"
                    strokeWidth=".9"
                  />
                  <rect
                    x={-w / 2 + 3}
                    y={-h / 2 - raised + 3}
                    width={Math.max(2, w - 6)}
                    height={Math.max(2, h - 6)}
                    fill="none"
                    stroke="#fffef5"
                    strokeOpacity=".5"
                    strokeWidth=".8"
                  />
                  <rect
                    x={-Math.max(w, 24 * inv) / 2}
                    y={-Math.max(h, 24 * inv) / 2}
                    width={Math.max(w, 24 * inv)}
                    height={Math.max(h, 24 * inv)}
                    fill="transparent"
                  />
                </g>
                {showLabels && (
                  <g className="venue-map-label" transform={`translate(${x} ${y})`}>
                    <path
                      d={`M0 ${-raised}L${dx} ${dy}`}
                      stroke="#929681"
                      strokeWidth={0.8 * inv}
                      fill="none"
                      opacity=".7"
                    />
                    <g transform={`translate(${dx} ${dy}) scale(${inv})`}>
                      <rect
                        x={-labelWidth / 2}
                        y={-labelHeight / 2}
                        width={labelWidth}
                        height={labelHeight}
                        rx="5"
                        fill="#fffdf5"
                        fillOpacity=".96"
                        stroke="#d6d9c9"
                        strokeWidth=".8"
                      />
                      <circle cx={-labelWidth / 2 + 7} cy="0" r="2.3" fill={anchor.side} />
                      {labelLines.map((line, i) => (
                        <text
                          key={line}
                          x="4"
                          y={(i - (labelLines.length - 1) / 2) * 14 + 0.5}
                          dominantBaseline="middle"
                          textAnchor="middle"
                          fontSize="10.5"
                          fill="#555b4c"
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="plan-caption">
        <span>仙林校园 · 总平面</span>
        <small>按参考图相对位置绘制</small>
      </div>
    </div>
  );
});
