import { forwardRef, useImperativeHandle } from 'react';
import { useCompassPosition } from '../lib/use-compass-position';
import './model-compass.css';

/** The scene writes --model-bearing directly; orbiting never rerenders the React tree. */
export const ModelCompass = forwardRef<HTMLDivElement, { knownNorth?: boolean; hidden?: boolean }>(
  function ModelCompass({ knownNorth = true, hidden = false }, ref) {
    const placement = useCompassPosition(hidden);
    useImperativeHandle(ref, () => placement.root.current!, [placement.root]);
    return (
      <div
        ref={placement.root}
        hidden={hidden}
        className={`model-compass${knownNorth ? '' : ' model-compass-unverified'}${placement.dragging ? ' is-dragging' : ''}`}
        style={
          placement.position
            ? { left: placement.position.x, top: placement.position.y, right: 'auto' }
            : undefined
        }
        role="group"
        aria-label={knownNorth ? '模型指北针' : '模型方位盘，朝向待核实'}
        data-known-north={knownNorth}
      >
        <button
          type="button"
          className="model-compass-handle"
          aria-label="移动罗盘，方向键微调，Home 或双击归位"
          onPointerDown={placement.start}
          onPointerMove={placement.move}
          onPointerUp={placement.finish}
          onPointerCancel={placement.finish}
          onLostPointerCapture={placement.finish}
          onDoubleClick={placement.reset}
          onKeyDown={placement.keyboard}
          onContextMenu={(event) => event.preventDefault()}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <g className="model-compass-surface">
              <circle className="model-compass-paper" cx="50" cy="50" r="47" />
              <circle className="model-compass-rim" cx="50" cy="50" r="43.5" />
              <path className="model-compass-index" d="M48 4.5L50 8L52 4.5" />
              <g className="model-compass-dial">
                {Array.from({ length: 48 }, (_, i) => (
                  <path
                    key={i}
                    className={i % 4 === 0 ? 'model-compass-tick-major' : 'model-compass-tick'}
                    d={`M50 ${i % 4 === 0 ? 17 : 18.5}V21`}
                    transform={`rotate(${i * 7.5} 50 50)`}
                  />
                ))}
                <circle className="model-compass-inner-ring" cx="50" cy="50" r="27" />
                {knownNorth ? (
                  <>
                    <path className="model-compass-needle-south" d="M50 77L43 46L50 50L57 46Z" />
                    <path className="model-compass-needle-north" d="M50 23L43 54L50 50L57 54Z" />
                    <path className="model-compass-needle-light" d="M50 23V50L43 54Z" />
                  </>
                ) : (
                  <>
                    <path
                      className="model-compass-reference"
                      d="M50 27V37M73 50H63M50 73V63M27 50H37"
                    />
                    <circle className="model-compass-reference-dot" cx="50" cy="28" r="2" />
                  </>
                )}
                <circle className="model-compass-pivot" cx="50" cy="50" r="3.5" />
                <circle className="model-compass-pivot-dot" cx="50" cy="50" r="1.25" />
              </g>
            </g>
            {knownNorth && (
              <g className="model-compass-letters">
                {(['N', 'E', 'S', 'W'] as const).map((letter, i) => (
                  <text
                    key={letter}
                    x={50}
                    y={50}
                    data-direction={i * 90}
                    className={letter === 'N' ? 'model-compass-north-letter' : undefined}
                  >
                    {letter}
                  </text>
                ))}
              </g>
            )}
          </svg>
          {knownNorth && (
            <span className="model-compass-horizon" aria-hidden="true">
              平视指北
            </span>
          )}
          {!knownNorth && <span className="model-compass-status">朝向待核实</span>}
          <span className="model-compass-drag-tip" aria-hidden="true">
            拖动 · 双击归位
          </span>
        </button>
      </div>
    );
  },
);
