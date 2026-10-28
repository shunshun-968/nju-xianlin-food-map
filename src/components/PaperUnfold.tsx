import { useId } from 'react';
import './about-letter-unfold.css';

/** 只负责打开瞬间的无字纸团；阅读内容始终来自同一份原始手写素材。 */
export function PaperUnfold() {
  const gradientId = 'paper-ball-light-' + useId().replace(/:/g, '');
  return (
    <div className="paper-unfold-ball" aria-hidden="true">
      <svg viewBox="0 0 160 176" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0.8" y2="1">
            <stop className="paper-ball-light" offset="0" />
            <stop className="paper-ball-base" offset="0.48" />
            <stop className="paper-ball-shade" offset="1" />
          </linearGradient>
        </defs>
        <path fill={'url(#' + gradientId + ')'}
          d="M44 9 61 15 79 5 98 14 117 10 130 30 143 39 146 60 155 79 146 98 149 117 134 133 126 151 108 155 92 168 70 160 51 165 36 151 19 144 18 123 7 106 14 87 8 67 21 52 24 31Z" />
        <g className="paper-ball-facet paper-ball-facet-left">
          <path className="paper-ball-face-light" d="M44 9 61 15 51 46 24 31Z" />
          <path className="paper-ball-face-mid" d="m24 31 27 15-30 6Z" />
          <path className="paper-ball-face-shadow" d="m21 52 30-6-13 39-30-18Z" />
          <path className="paper-ball-face-light" d="m8 67 30 18-24 2Z" />
          <path className="paper-ball-face-mid" d="m14 87 24-2 15 35-35 3-11-17Z" />
          <path className="paper-ball-face-light" d="m18 123 35-3-17 31-17-7Z" />
          <path className="paper-ball-face-shadow" d="m36 151 17-31 17 40-19 5Z" />
        </g>
        <g className="paper-ball-facet paper-ball-facet-right">
          <path className="paper-ball-face-light" d="m98 14 19-4 13 20-23 20Z" />
          <path className="paper-ball-face-shadow" d="m107 50 23-20 13 9 3 21-24 14Z" />
          <path className="paper-ball-face-mid" d="m122 74 24-14 9 19-9 19-25-3Z" />
          <path className="paper-ball-face-light" d="m121 95 25 3 3 19-15 16-21-12Z" />
          <path className="paper-ball-face-shadow" d="m113 121 21 12-8 18-18 4-7-22Z" />
          <path className="paper-ball-face-light" d="m101 133 7 22-16 13-4-22Z" />
        </g>
        <g className="paper-ball-facet paper-ball-facet-center">
          <path className="paper-ball-face-mid" d="m61 15 18-10 19 9-18 30-29 2Z" />
          <path className="paper-ball-face-light" d="m80 44 18-30 9 36-16 16Z" />
          <path className="paper-ball-face-light" d="m51 46 29-2-14 35-28 6Z" />
          <path className="paper-ball-face-deep" d="m80 44 11 22-25 13Z" />
          <path className="paper-ball-face-mid" d="m91 66 16-16 15 24-1 21-21-5Z" />
          <path className="paper-ball-face-light" d="m66 79 25-13 9 24-20 19Z" />
          <path className="paper-ball-face-shadow" d="m38 85 28-6 14 30-27 11Z" />
          <path className="paper-ball-face-light" d="m53 120 27-11-10 51Z" />
          <path className="paper-ball-face-mid" d="m80 109 20-19 13 31-12 12-13 13Z" />
          <path className="paper-ball-face-shadow" d="m80 109 8 37 4 22-22-8Z" />
        </g>
        <g className="paper-ball-fine-creases" fill="none" strokeLinecap="round">
          <path d="m27 39 22 8-9 34m16-32 22-3-10 29m26-8 10-15 22-18m-58 48 13 24 17-15m-44 33 17 32m32-32 23 7m-8-51 20 14" />
          <path d="m34 65 9-11m13 45 10 7m28-86-6 15m24 64-4 13m-24 21-3 16" />
        </g>
      </svg>
    </div>
  );
}
