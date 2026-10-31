import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  dismissModelGuide,
  hasSeenModelGuide,
  type ModelGuideKind,
} from '../lib/model-guide-session';
import './model-interaction-guide.css';
import { MouseLesson, TouchLesson } from './ModelGuideIllustrations';
import { placeModelGuide, type GuideRect } from '../lib/model-guide-layout';

const mouseTitle = '单击右键进入旋转模式';
const touchQuery = '(max-width: 700px), (pointer: coarse)';
type Flight = { x: number; y: number; dx: number; dy: number; scale: number };
type Props = {
  host: RefObject<HTMLDivElement | null>;
  rotationMode: boolean;
  night: boolean;
  getOccupiedRects: () => GuideRect[];
  onMouseIntroChange: (visible: boolean) => void;
  allowIntro: boolean;
};

function Guide({
  host,
  rotationMode,
  night,
  kind,
  getOccupiedRects,
  onMouseIntroChange,
  allowIntro,
}: Props & { kind: ModelGuideKind }) {
  const [phase, setPhase] = useState<'intro' | 'closing' | 'done'>(() =>
    !allowIntro || hasSeenModelGuide(kind) ? 'done' : 'intro',
  );
  const [center, setCenter] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [flight, setFlight] = useState<Flight | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLSpanElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const flyingText = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dismiss = () => {
    if (phase !== 'intro') return;
    dismissModelGuide(kind);
    const from = title.current?.getBoundingClientRect();
    const to = hint.current?.getBoundingClientRect();
    if (
      kind === 'mouse' &&
      from?.width &&
      to?.width &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setFlight({
        x: from.left,
        y: from.top,
        dx: to.left - from.left,
        dy: to.top - from.top,
        scale: to.width / from.width,
      });
      setPhase('closing');
    } else setPhase('done');
  };
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  useEffect(() => {
    if (phase !== 'intro' || kind !== 'mouse') return;
    onMouseIntroChange(true);
    return () => onMouseIntroChange(false);
  }, [phase, kind, onMouseIntroChange]);

  useEffect(() => {
    if (phase !== 'intro' || kind !== 'mouse') return;
    let total = 0;
    const scene = host.current;
    const rotated = (event: Event) => {
      const radians = (event as CustomEvent<number>).detail;
      if (!Number.isFinite(radians) || radians <= 0) return;
      total += radians;
      if (total > Math.PI / 4) dismissRef.current();
    };
    // The transparent lesson lets right-click and hover movement reach the real
    // canvas. Consume left clicks separately so dismissal never opens a window.
    const blockLeftPointer = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const leftClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissRef.current();
    };
    scene?.addEventListener('foodmap:model-orbit', rotated);
    window.addEventListener('pointerdown', blockLeftPointer, true);
    window.addEventListener('pointerup', blockLeftPointer, true);
    window.addEventListener('click', leftClick, true);
    return () => {
      scene?.removeEventListener('foodmap:model-orbit', rotated);
      window.removeEventListener('pointerdown', blockLeftPointer, true);
      window.removeEventListener('pointerup', blockLeftPointer, true);
      window.removeEventListener('click', leftClick, true);
    };
  }, [phase, kind, host]);

  useLayoutEffect(() => {
    if (phase !== 'intro') return;
    const map = host.current?.closest<HTMLElement>('.map-area');
    const measure = () => {
      if (!map) return;
      const rect = map.getBoundingClientRect();
      const style = getComputedStyle(map);
      if (kind === 'mouse') {
        const width = panel.current?.offsetWidth ?? 320;
        const height = panel.current?.offsetHeight ?? 220;
        const left = rect.left + (parseFloat(style.getPropertyValue('--model-overlay-left')) || 16);
        const top = rect.top + (parseFloat(style.getPropertyValue('--model-info-top')) || 100) + 30;
        const occupied = getOccupiedRects();
        // Leave the compass corner quiet, including the space around its thin dial.
        occupied.push({
          left: rect.right - 200,
          top: rect.top,
          right: rect.right,
          bottom: top + 160,
        });
        for (const element of map.querySelectorAll('.model-compass, .map-tools')) {
          const bounds = element.getBoundingClientRect();
          occupied.push(bounds);
        }
        setCenter(
          placeModelGuide(
            { left, top, right: rect.right - 20, bottom: rect.bottom - 36 },
            width,
            height,
            occupied,
          ),
        );
        return;
      }
      const x =
        rect.left + (parseFloat(style.getPropertyValue('--loading-center-x')) || rect.width / 2);
      const y =
        rect.top + (parseFloat(style.getPropertyValue('--loading-center-y')) || rect.height / 2);
      const halfWidth = (panel.current?.offsetWidth ?? 420) / 2 + 16;
      const halfHeight = (panel.current?.offsetHeight ?? 330) / 2 + 16;
      setCenter({
        x: Math.max(halfWidth, Math.min(window.innerWidth - halfWidth, x)),
        y: Math.max(halfHeight, Math.min(window.innerHeight - halfHeight, y)),
      });
    };
    measure();
    map?.addEventListener('foodmap:model-layout', measure);
    window.addEventListener('resize', measure);
    return () => {
      map?.removeEventListener('foodmap:model-layout', measure);
      window.removeEventListener('resize', measure);
    };
  }, [host, phase, kind, getOccupiedRects]);

  useEffect(() => {
    if (phase !== 'intro') return;
    const previousFocus = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      // Consume dismissal keys before app-level navigation and model shortcuts.
      if (['Escape', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) dismissRef.current();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        (closeButton.current ?? panel.current)?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== 'closing' || !flight || !flyingText.current) return;
    const animation = flyingText.current.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.scale})`,
          opacity: 1,
        },
      ],
      { duration: 520, easing: 'cubic-bezier(.22, .7, .22, 1)', fill: 'forwards' },
    );
    animation.onfinish = () => setPhase('done');
    return () => animation.cancel();
  }, [phase, flight]);

  return (
    <>
      {kind === 'mouse' && (
        <div
          ref={hint}
          className="interaction-hint"
          style={{ visibility: phase === 'done' ? 'visible' : 'hidden' }}
          role="status"
          aria-live="polite"
        >
          {rotationMode ? '旋转中·左键临时平移·右键/Esc退出' : mouseTitle}
        </div>
      )}
      {phase !== 'done' &&
        createPortal(
          <div
            className={`model-guide-backdrop model-guide-${kind}${phase === 'closing' ? ' is-closing' : ''}`}
            data-night={night}
            aria-hidden={phase === 'closing' || undefined}
            onClick={(event) => {
              if (event.button === 0) {
                event.stopPropagation();
                dismiss();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              ref={panel}
              className="model-guide-panel"
              role={phase === 'intro' ? 'dialog' : undefined}
              aria-modal={phase === 'intro' ? true : undefined}
              tabIndex={-1}
              aria-labelledby={kind === 'mouse' ? 'model-guide-title' : undefined}
              aria-label={kind === 'touch' ? '双指旋转与缩放教学' : undefined}
              aria-describedby="model-guide-description"
              style={{ left: center.x, top: center.y }}
            >
              {kind === 'mouse' ? <MouseLesson /> : <TouchLesson />}
              {kind === 'mouse' && (
                <h2 id="model-guide-title">
                  <span ref={title}>{mouseTitle}</span>
                </h2>
              )}
              <p id="model-guide-description">
                {kind === 'mouse' ? '无需按住，移动鼠标即可旋转' : '单指拖动，也能平移视角'}
              </p>
              {kind === 'touch' && (
                <button ref={closeButton} type="button" className="model-guide-dismiss">
                  轻触任意处退出
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
      {phase === 'closing' &&
        flight &&
        createPortal(
          <div
            ref={flyingText}
            className="model-guide-flight"
            data-night={night}
            style={{ left: flight.x, top: flight.y }}
            aria-hidden="true"
          >
            {mouseTitle}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Only mounted after the model's first frame, and only in a rotatable view. */
export function ModelInteractionGuide(props: Props) {
  const [touch, setTouch] = useState(() => window.matchMedia(touchQuery).matches);
  useEffect(() => {
    const media = window.matchMedia(touchQuery);
    const changed = () => setTouch(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  return <Guide key={touch ? 'touch' : 'mouse'} kind={touch ? 'touch' : 'mouse'} {...props} />;
}
