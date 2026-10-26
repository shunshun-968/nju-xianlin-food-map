import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

type Position = { x: number; y: number };
type Drag = Position & { pointerId: number; clientX: number; clientY: number };

/** Keep user placement through model/mode switches; clamp it to the unobstructed viewport. */
export function useCompassPosition(hidden: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const current = useRef<Position | null>(null);
  const drag = useRef<Drag | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const place = useCallback((next: Position) => {
    const element = root.current,
      parent = element?.parentElement;
    if (!element || !parent || element.hidden) return;
    const styles = getComputedStyle(parent);
    const read = (name: string, fallback: number) =>
      parseFloat(styles.getPropertyValue(name)) || fallback;
    const maxX = Math.max(8, parent.clientWidth - element.offsetWidth - 12);
    const maxY = Math.max(
      8,
      parent.clientHeight - element.offsetHeight - read('--model-overlay-bottom', 16),
    );
    const minX = Math.min(maxX, read('--model-overlay-left', 16));
    const minY = Math.min(maxY, read('--model-overlay-top', 16) + 82);
    const bounded = {
      x: Math.max(minX, Math.min(next.x, maxX)),
      y: Math.max(minY, Math.min(next.y, maxY)),
    };
    current.current = bounded;
    setPosition((previous) =>
      previous?.x === bounded.x && previous.y === bounded.y ? previous : bounded,
    );
  }, []);
  const finish = useCallback(() => {
    const active = drag.current;
    drag.current = null;
    setDragging(false);
    const button = root.current?.querySelector('button');
    if (active && button?.hasPointerCapture(active.pointerId))
      button.releasePointerCapture(active.pointerId);
  }, []);
  const reset = useCallback(() => {
    finish();
    current.current = null;
    setPosition(null);
  }, [finish]);

  useLayoutEffect(() => {
    const element = root.current,
      parent = element?.parentElement;
    if (!element || !parent) return;
    const fit = () => {
      if (current.current) place(current.current);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    observer.observe(element);
    const map = parent.closest('.map-area');
    map?.addEventListener('foodmap:model-layout', fit);
    window.addEventListener('blur', finish);
    fit();
    return () => {
      observer.disconnect();
      map?.removeEventListener('foodmap:model-layout', fit);
      window.removeEventListener('blur', finish);
    };
  }, [place, finish]);
  useLayoutEffect(() => {
    if (hidden) finish();
    else if (current.current) place(current.current);
  }, [hidden, place, finish]);

  const start = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || !root.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: root.current.offsetLeft,
      y: root.current.offsetTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = drag.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    place({
      x: origin.x + event.clientX - origin.clientX,
      y: origin.y + event.clientY - origin.clientY,
    });
  };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    const element = root.current;
    if (!element) return;
    if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      reset();
      return;
    }
    if (event.key === 'Escape' && drag.current) {
      event.preventDefault();
      event.stopPropagation();
      place(drag.current);
      finish();
      return;
    }
    const step = event.shiftKey ? 32 : 12;
    const deltas: Record<string, Position> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    place({ x: element.offsetLeft + delta.x, y: element.offsetTop + delta.y });
  };
  return { root, position, dragging, start, move, finish, reset, keyboard };
}
