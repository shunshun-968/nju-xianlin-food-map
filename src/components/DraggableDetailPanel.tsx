import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import './draggable-detail-panel.css';

type Position = { x: number; y: number };
type Drag = Position & { pointerId: number; clientX: number; clientY: number };

/** Position the outer shell so the card can keep its own entrance animation. */
export function DraggableDetailPanel({ children }: { children: ReactNode }) {
  const anchor = useRef<HTMLDivElement>(null);
  const currentPosition = useRef<Position | null>(null);
  const moved = useRef(false);
  const drag = useRef<Drag | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);

  const place = useCallback((next: Position) => {
    const element = anchor.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const margin = 12;
    const bounded = {
      x: Math.max(margin, Math.min(next.x, parent.clientWidth - element.offsetWidth - margin)),
      y: Math.max(margin, Math.min(next.y, parent.clientHeight - element.offsetHeight - margin)),
    };
    currentPosition.current = bounded;
    setPosition((previous) =>
      previous?.x === bounded.x && previous.y === bounded.y ? previous : bounded,
    );
  }, []);

  const fit = useCallback(() => {
    const element = anchor.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    // A long menu scrolls inside the card, keeping its drag handle and close button reachable.
    element.style.setProperty('--detail-panel-max-height', `${Math.max(0, parent.clientHeight - 24)}px`);
    if (moved.current && currentPosition.current) {
      place(currentPosition.current);
      return;
    }
    const compact = window.matchMedia('(max-width: 700px)').matches;
    place({
      x: parent.clientWidth - element.offsetWidth - (compact ? 16 : 80),
      y: parent.clientHeight - element.offsetHeight - (compact ? 20 : 48),
    });
  }, [place]);

  useLayoutEffect(() => {
    const element = anchor.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit]);

  useLayoutEffect(fit, [children, fit]);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      !(target instanceof Element) ||
      !target.closest('.detail-top') ||
      target.closest('button, a, input, select, textarea') ||
      !currentPosition.current
    ) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      ...currentPosition.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const origin = drag.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    event.preventDefault();
    moved.current = true;
    place({
      x: origin.x + event.clientX - origin.clientX,
      y: origin.y + event.clientY - origin.clientY,
    });
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || !event.target.matches('.detail-top')) return;
    const previous = currentPosition.current;
    const step = event.shiftKey ? 32 : 12;
    const directions: Record<string, Position> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = directions[event.key];
    if (!previous || !delta) return;
    event.preventDefault();
    event.stopPropagation();
    moved.current = true;
    place({ x: previous.x + delta.x, y: previous.y + delta.y });
  };

  return (
    <div
      ref={anchor}
      className={`detail-panel-anchor${dragging ? ' is-dragging' : ''}`}
      style={{ left: position?.x ?? 0, top: position?.y ?? 0, visibility: position ? 'visible' : 'hidden' }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onKeyDown={moveWithKeyboard}
    >
      {children}
    </div>
  );
}
