import { useLayoutEffect, useRef, useState } from 'react';
import type { PlacedLabel } from '../lib/map-labels';
import './campus-venue-name.css';

type Props = {
  label: PlacedLabel | null;
  /** The parent reserves an extra final line containing the second-tap hint. */
  touchHint?: boolean;
};
type Presentation = { label: PlacedLabel; touchHint: boolean };

/** Screen-space name bubble. Navigation remains in the map's existing pointer controller. */
export function CampusVenueName({ label, touchHint = false }: Props) {
  const retained = useRef<Presentation | null>(label ? { label, touchHint } : null);
  const [mounted, setMounted] = useState(!!label);
  const [raised, setRaised] = useState(false);
  // Keep the last position and copy for a graceful exit; normal map movement updates immediately.
  if (label) retained.current = { label, touchHint };

  useLayoutEffect(() => {
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (label) {
      setMounted(true);
      setRaised(reduced);
      if (!reduced)
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => setRaised(true));
        });
    } else {
      setRaised(false);
      timer = setTimeout(() => setMounted(false), reduced ? 0 : 180);
    }
    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [label?.id]);

  const display = label ? { label, touchHint } : retained.current;
  if ((!label && !mounted) || !display) return null;
  const item = display.label;
  const tapTarget = !!label && touchHint;
  const visible = !!label && raised;
  const nameLines = display.touchHint ? item.lines.slice(0, -1) : item.lines;

  return (
    <g
      className="campus-venue-name"
      data-popup-venue={item.id}
      data-popup-visible={visible}
      data-venue={tapTarget ? item.id : undefined}
      role={tapTarget ? 'button' : 'tooltip'}
      tabIndex={tapTarget ? 0 : undefined}
      aria-label={tapTarget ? `再次点击进入${nameLines.join('')}` : nameLines.join('')}
      aria-hidden={!label}
      pointerEvents={tapTarget ? 'auto' : 'none'}
      transform={`translate(${item.x} ${item.y})`}
    >
      <g className={`campus-venue-name-motion${visible ? ' is-visible' : ''}`}>
        <rect
          className="campus-venue-name-paper"
          x={-item.width / 2}
          y={-item.height / 2}
          width={item.width}
          height={item.height}
          rx={Math.min(11, item.height / 2)}
        />
        {item.lines.map((line, index) => {
          const hint = display.touchHint && index === item.lines.length - 1;
          return (
            <text
              key={`${index}-${line}`}
              className={hint ? 'campus-venue-name-hint' : 'campus-venue-name-text'}
              x="0"
              y={(index - (item.lines.length - 1) / 2) * item.lineHeight + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={hint ? 9 : item.fontSize}
            >
              {line}
            </text>
          );
        })}
      </g>
    </g>
  );
}
