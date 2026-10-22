import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UiIcon } from './UiIcon';
import { sheetRelease, type DragSample } from '../lib/sheet-motion';

const collapsedHeight = 28;
const expandedHeight = 'min(54dvh, 430px, calc(100dvh - 100px))';
const mobileHeight = (progress: number) =>
  `calc(${collapsedHeight}px + (${expandedHeight} - ${collapsedHeight}px) * ${1 - progress})`;
const clampProgress = (value: number) => Math.max(0, Math.min(1, value));

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
  const heightGuide = useRef<HTMLDivElement>(null);
  const liveProgress = useRef(progress);
  const dragFrame = useRef<number | null>(null);
  const gesture = useRef<{
    id: number;
    origin: number;
    start: number;
    travel: number;
    mobile: boolean;
    moved: boolean;
    tapTarget: number;
    samples: DragSample[];
  } | null>(null);
  const collapsed = progress === 1;

  function cancelDragFrame() {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
  }
  function notifyOverlays() {
    window.dispatchEvent(new Event('foodmap:overlays'));
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const changed = () => {
      cancelDragFrame();
      dock.current?.style.removeProperty('transition');
      liveProgress.current = media.matches ? 1 : 0;
      setMobile(media.matches);
      setProgress(media.matches ? 1 : 0);
      setDragging(false);
      gesture.current = null;
    };
    media.addEventListener('change', changed);
    return () => {
      media.removeEventListener('change', changed);
      cancelDragFrame();
    };
  }, []);
  useEffect(() => {
    if (!mobile) notifyOverlays();
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
      settle(0);
      setSearchRequest((request) => request + 1);
    };
    window.addEventListener('foodmap:search', expandForSearch);
    return () => window.removeEventListener('foodmap:search', expandForSearch);
  }, [campus, mobile]);
  useEffect(() => {
    if (!campus || !pendingSearchFocus.current) return;
    // Focus after React has removed inert from the expanded content.
    dock.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    pendingSearchFocus.current = false;
  }, [searchRequest, campus]);

  function settle(value: number, duration = 0) {
    if (campus && !mobile) value = value >= 0.5 ? 1 : 0;
    cancelDragFrame();
    if (mobile && dock.current) {
      // Freeze the final finger position before restoring the tap animation.
      // This also lets a new drag interrupt an in-flight opening without a jump.
      if (gesture.current) {
        dock.current.style.height = mobileHeight(liveProgress.current);
        dock.current.getBoundingClientRect();
      }
      dock.current.style.removeProperty('transition');
      dock.current.classList.remove('is-dragging');
      if (duration > 0)
        dock.current.style.transition = `height ${duration}ms cubic-bezier(.33, .67, .67, 1)`;
      dock.current.style.height = mobileHeight(value);
    }
    liveProgress.current = value;
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
              height: mobileHeight(progress),
            }
          : { transform: `translateX(calc((-100% - 20px) * ${progress}))` }
      }
      onTransitionEnd={(e) => {
        if (e.target !== e.currentTarget || gesture.current) return;
        if (mobile) e.currentTarget.style.removeProperty('transition');
        else notifyOverlays();
      }}
    >
      {mobile && (
        <div
          ref={heightGuide}
          className="sidebar-height-guide"
          style={{ height: expandedHeight }}
          aria-hidden="true"
        />
      )}
      <div id="place-drawer" className="sidebar-content" inert={collapsed && !dragging}>
        {children}
      </div>
      <button
        className="sidebar-handle"
        aria-controls="place-drawer"
        aria-expanded={!collapsed}
        aria-label={collapsed ? '展开地点列表' : '收起地点列表'}
        title={mobile ? '向上拉展开，向下拉收起；也可点击' : '左右拖动或点击，收起／展开地点列表'}
        onPointerDown={(e) => {
          if (e.button !== 0 || gesture.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          let start = progress;
          const travel = Math.max(
            1,
            mobile
              ? (heightGuide.current?.getBoundingClientRect().height || collapsedHeight) -
                  collapsedHeight
              : (dock.current?.offsetWidth || 328) + 20,
          );
          if (mobile && dock.current) {
            cancelDragFrame();
            const height = dock.current.getBoundingClientRect().height;
            start = clampProgress(1 - (height - collapsedHeight) / travel);
            dock.current.style.transition = 'none';
            dock.current.style.height = `${height}px`;
          }
          liveProgress.current = start;
          gesture.current = {
            id: e.pointerId,
            origin: mobile ? e.clientY : e.clientX,
            start,
            travel,
            mobile,
            moved: false,
            tapTarget: progress > 0.5 ? 0 : 1,
            samples: [{ position: mobile ? e.clientY : e.clientX, time: e.timeStamp }],
          };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          const delta = (g.mobile ? e.clientY : e.clientX) - g.origin;
          if (Math.abs(delta) > 5) g.moved = true;
          const next = clampProgress(g.start + (delta * (g.mobile ? 1 : -1)) / g.travel);
          if (g.mobile) {
            if (!g.moved) return;
            g.samples.push({ position: e.clientY, time: e.timeStamp });
            while (g.samples.length > 2 && e.timeStamp - g.samples[1].time > 100) g.samples.shift();
            liveProgress.current = next;
            if (dragFrame.current === null) {
              dragFrame.current = requestAnimationFrame(() => {
                dragFrame.current = null;
                if (dock.current) dock.current.style.height = mobileHeight(liveProgress.current);
              });
            }
          } else setProgress(next);
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          const delta = ((g.mobile ? e.clientY : e.clientX) - g.origin) * (g.mobile ? 1 : -1);
          const next = Math.max(0, Math.min(1, g.start + delta / g.travel));
          if (g.mobile && g.moved) liveProgress.current = next;
          if (g.mobile && g.moved) {
            const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? { progress: next, duration: 0 }
              : sheetRelease(g.samples, { position: e.clientY, time: e.timeStamp }, next, g.travel);
            settle(motion.progress, motion.duration);
            return;
          }
          settle(
            !g.moved
              ? g.tapTarget
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
        onPointerCancel={(e) => {
          if (gesture.current?.id === e.pointerId)
            settle(mobile ? liveProgress.current : progress >= 0.5 ? 1 : 0);
        }}
        onLostPointerCapture={(e) => {
          if (gesture.current?.id === e.pointerId)
            settle(mobile ? liveProgress.current : progress >= 0.5 ? 1 : 0);
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
