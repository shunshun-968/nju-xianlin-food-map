import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UiIcon } from './UiIcon';

/** A manually controlled drawer; map hover never changes its position. */
export function FloatingSidebar({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(() =>
    window.matchMedia('(max-width: 700px)').matches ? 1 : 0,
  );
  const [dragging, setDragging] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    start: number;
    travel: number;
    moved: boolean;
  } | null>(null);
  const collapsed = progress === 1;
  useEffect(() => {
    window.dispatchEvent(new Event('foodmap:overlays'));
  }, [progress]);
  function settle(value: number) {
    setProgress(value);
    setDragging(false);
    gesture.current = null;
  }
  return (
    <div
      ref={dock}
      className={`sidebar-dock ${dragging ? 'is-dragging' : ''} ${collapsed ? 'is-collapsed' : ''}`}
      style={{ transform: `translateX(calc((-100% - 12px) * ${progress}))` }}
      onTransitionEnd={() => window.dispatchEvent(new Event('foodmap:overlays'))}
    >
      <div id="place-drawer" className="sidebar-content" inert={collapsed}>
        {children}
      </div>
      <button
        className="sidebar-handle"
        aria-controls="place-drawer"
        aria-expanded={!collapsed}
        aria-label={collapsed ? '展开地点列表' : '收起地点列表'}
        title="左右拖动或点击，收起／展开地点列表"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = {
            id: e.pointerId,
            x: e.clientX,
            start: progress,
            travel: (dock.current?.offsetWidth || 338) + 12,
            moved: false,
          };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          const delta = e.clientX - g.x;
          if (Math.abs(delta) > 5) g.moved = true;
          setProgress(Math.max(0, Math.min(1, g.start - delta / g.travel)));
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          const delta = e.clientX - g.x;
          settle(
            !g.moved
              ? g.start > 0.5
                ? 0
                : 1
              : delta < -40
                ? 1
                : delta > 40
                  ? 0
                  : progress >= 0.5
                    ? 1
                    : 0,
          );
        }}
        onPointerCancel={() => settle(progress >= 0.5 ? 1 : 0)}
        onLostPointerCapture={() => {
          if (gesture.current) settle(progress >= 0.5 ? 1 : 0);
        }}
        onClick={(e) => {
          if (e.detail === 0) settle(collapsed ? 0 : 1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            settle(e.key === 'ArrowLeft' ? 1 : 0);
          }
        }}
      >
        <UiIcon name="chevron-right" size={14} className={collapsed ? '' : 'points-left'} />
      </button>
    </div>
  );
}
