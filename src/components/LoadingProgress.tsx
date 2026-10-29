import { useState } from 'react';
import './loading-progress.css';

type LoadingKind = 'campus' | 'model' | 'about';
type Props = { kind: LoadingKind; progress?: number; className?: string };

const titles: Record<LoadingKind, string> = {
  campus: '展开校园地图',
  model: '正在展开模型',
  about: '准备“关于食光”',
};
const mapQuotes = ['制图之体有六，缺一不可言精', '图设分率，则宇内地域皆可绘于一尺'];

/** 进度由资源准备阶段驱动；不另开计时器，不推算虚假的下载百分比。 */
export function LoadingProgress({ kind, progress = 0, className = '' }: Props) {
  const [mapQuote] = useState(() => mapQuotes[Math.random() < 0.5 ? 0 : 1]);
  const value = Number.isFinite(progress) ? Math.max(0.04, Math.min(1, progress)) : 0.04;
  const message =
    kind === 'campus'
      ? value < 0.16
        ? '正在蘸墨水'
        : value < 0.55
          ? mapQuote
          : value < 0.88
            ? '正在拔高建筑'
            : '即将展开'
      : kind === 'model'
        ? value < 0.3
          ? '正在打地基'
          : value < 0.75
            ? '正在打理窗口'
            : '正在备菜'
        : value < 0.35
          ? '正在寻找牛皮纸'
          : value < 0.85
            ? '正在挥斥方遒'
            : '正在署名';

  return (
    <div className={`loading-progress loading-progress--${kind} ${className}`.trim()}>
      <span className="loading-progress-title">{titles[kind]}</span>
      <div
        className="loading-progress-track"
        role="progressbar"
        aria-label={titles[kind]}
        aria-valuetext={message}
      >
        <span className="loading-progress-fill" style={{ transform: `scaleX(${value})` }} />
      </div>
      <span className="loading-progress-caption" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
