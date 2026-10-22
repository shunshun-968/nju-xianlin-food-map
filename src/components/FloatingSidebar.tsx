import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UiIcon } from './UiIcon';

/** Desktop side drawer; mobile bottom sheet. Both are controlled manually. */
export function FloatingSidebar({
  children,
  campus = false,
}: {
  children: ReactNode;
  campus?: boolean;
}) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  const [progress, setProgress] = useState(() =>
    window.matchMedia('(max-width: 700px)').matches ? 1 : 0,
  );
  const [dragging, setDragging] = useState(false);
  const [searchRequest, setSearchRequest] = useState(0);
  const pendingSearchFocus = useRef(false);
  const dock = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: number;
    origin: number;
    start: number;
    travel: number;
    mobile: boolean;
    moved: boolean;
  } | null>(null);
  const collapsed = progress === 1;
  const collapsedHeight = 28;
  const expandedHeight = 'min(54dvh, 430px, calc(100dvh - 100px))';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const changed = () => {
      setMobile(media.matches);
      setProgress(media.matches ? 1 : 0);
      setDragging(false);
      gesture.current = null;
    };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new Event('foodmap:overlays'));
  }, [progress, mobile]);
  useEffect(() => {
    if (!campus || mobile || dragging || (progress !== 0 && progress !== 1)) return;
    // Measure the settled drawer once, including when transitions are disabled.
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300;
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('foodmap:drawer')), delay);
    return () => window.clearTimeout(timer);
  }, [progress, mobile, campus, dragging]);
  useEffect(() => {
    if (!campus) return;
    const expandForSearch = () => {
      pendingSearchFocus.current = true;
      setProgress(0);
      setDragging(false);
      gesture.current = null;
      setSearchRequest((request) => request + 1);
    };
    window.addEventListener('foodmap:search', expandForSearch);
    return () => window.removeEventListener('foodmap:search', expandForSearch);
  }, [campus]);
  useEffect(() => {
    if (!campus || !pendingSearchFocus.current) return;
    // Focus after React has removed inert from the expanded content.
    dock.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    pendingSearchFocus.current = false;
  }, [searchRequest, campus]);

  function settle(value: number) {
    if (campus && !mobile) value = value >= 0.5 ? 1 : 0;
    setProgress(value);
    setDragging(false);
    gesture.current = null;
  }

  return (
    <div
      ref={dock}
      className={`sidebar-dock ${dragging ? 'is-dragging' : ''} ${collapsed ? 'is-collapsed' : ''}`}
      style={
        mobile
          ? {
              transform: 'none',
              height: `calc(${collapsedHeight}px + (${expandedHeight} - ${collapsedHeight}px) * ${1 - progress})`,
            }
          : { transform: `translateX(calc((-100% - 20px) * ${progress}))` }
      }
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget) window.dispatchEvent(new Event('foodmap:overlays'));
      }}
    >
      <div id="place-drawer" className="sidebar-content" inert={collapsed}>
        {children}
      </div>
      <button
        className="sidebar-handle"
        aria-controls="place-drawer"
        aria-expanded={!collapsed}
        aria-label={collapsed ? '展开地点列表' : '收起地点列表'}
        title={mobile ? '向上拉展开，向下拉收起；也可点击' : '左右拖动或点击，收起／展开地点列表'}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = {
            id: e.pointerId,
            origin: mobile ? e.clientY : e.clientX,
            start: progress,
            travel: Math.max(
              1,
              mobile
                ? Math.min(
                    (dock.current?.closest('.workspace')?.clientHeight || window.innerHeight) *
                      0.54,
                    430,
                    (dock.current?.closest('.workspace')?.clientHeight || window.innerHeight) - 100,
                  ) - collapsedHeight
                : (dock.current?.offsetWidth || 328) + 20,
            ),
            mobile,
            moved: false,
          };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          const delta = (g.mobile ? e.clientY : e.clientX) - g.origin;
          if (Math.abs(delta) > 5) g.moved = true;
          setProgress(Math.max(0, Math.min(1, g.start + (delta * (g.mobile ? 1 : -1)) / g.travel)));
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          const delta = ((g.mobile ? e.clientY : e.clientX) - g.origin) * (g.mobile ? 1 : -1);
          const next = Math.max(0, Math.min(1, g.start + delta / g.travel));
          settle(
            !g.moved
              ? g.start > 0.5
                ? 0
                : 1
              : g.mobile
                ? next
                : delta > 40
                  ? 1
                  : delta < -40
                    ? 0
                    : next >= 0.5
                      ? 1
                      : 0,
          );
        }}
        onPointerCancel={() => settle(mobile ? progress : progress >= 0.5 ? 1 : 0)}
        onLostPointerCapture={() => {
          if (gesture.current) settle(mobile ? progress : progress >= 0.5 ? 1 : 0);
        }}
        onClick={(e) => {
          if (e.detail === 0) settle(collapsed ? 0 : 1);
        }}
        onKeyDown={(e) => {
          const closeKey = mobile ? 'ArrowDown' : 'ArrowLeft';
          const openKey = mobile ? 'ArrowUp' : 'ArrowRight';
          if (e.key === closeKey || e.key === openKey) {
            e.preventDefault();
            settle(e.key === closeKey ? 1 : 0);
          }
        }}
      >
        <UiIcon name="chevron-right" size={14} className={collapsed ? '' : 'points-left'} />
      </button>
    </div>
  );
}
