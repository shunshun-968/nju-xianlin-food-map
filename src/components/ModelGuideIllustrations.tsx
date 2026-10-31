import './model-guide-illustrations.css';

/** Six independent faces retain real depth while turning; no skewed flat drawing. */
function TeachingCube({ zoom = false }: { zoom?: boolean }) {
  return (
    <div className={`mi-guide-cube-stage${zoom ? ' is-zoom' : ''}`}>
      <div className="mi-guide-cube">
        {['front', 'right', 'back', 'left', 'top', 'bottom'].map((face) => (
          <span key={face} className={`mi-guide-cube-face is-${face}`} />
        ))}
      </div>
    </div>
  );
}

export function MouseLesson() {
  return (
    <div className="mi-guide-mouse-lesson" aria-hidden="true">
      <svg className="mi-guide-mouse" viewBox="0 0 110 112">
        <g transform="translate(7 -2)">
          <g className="mi-guide-mouse-body">
            <path className="mi-guide-right-button" d="M48 9c17 0 28 12 28 29v13H48Z" />
            <rect x="20" y="9" width="56" height="92" rx="28" />
            <path d="M48 9v42M20 51h56" />
            <rect className="mi-guide-wheel" x="45" y="25" width="6" height="14" rx="3" />
            <circle className="mi-guide-click" cx="62" cy="32" r="12" />
          </g>
        </g>
        <path className="mi-guide-mouse-travel" d="m29 100-7 5 7 5m52-10 7 5-7 5m-58-5h64" />
      </svg>
    </div>
  );
}

export function TouchLesson() {
  return (
    <div className="mi-guide-touch-lesson">
      <div className="mi-guide-touch-example">
        <div className="mi-guide-touch-animation" aria-hidden="true">
          <TeachingCube />
          <div className="mi-guide-fingers is-drag">
            <span className="mi-guide-finger" />
            <span className="mi-guide-finger" />
          </div>
        </div>
        <span className="mi-guide-touch-label">双指拖动 · 旋转</span>
      </div>
      <div className="mi-guide-touch-example">
        <div className="mi-guide-touch-animation" aria-hidden="true">
          <TeachingCube zoom />
          <div className="mi-guide-fingers is-pinch">
            <span className="mi-guide-finger" />
            <span className="mi-guide-finger" />
          </div>
        </div>
        <span className="mi-guide-touch-label">双指捏合 · 缩放</span>
      </div>
    </div>
  );
}
