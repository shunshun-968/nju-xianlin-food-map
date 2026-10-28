import { useId, useRef, useState, type Ref } from 'react';
import { UiIcon } from './UiIcon';
import { PaperUnfold } from './PaperUnfold';
import './about-letter.css';

const letterArtwork = new URL('../assets/about/handwritten-letter-original.jpg', import.meta.url)
  .href;

type Props = {
  dialogRef: Ref<HTMLElement>;
  onClose: () => void;
  night: boolean;
};

/** 原图只裁定可见区域并提取深色笔迹；正文不经过字体替换、转录或生成式重绘。 */
export function AboutLetter({ dialogRef, onClose, night }: Props) {
  const instance = useId().replace(/:/g, '');
  const inkId = `about-letter-ink-${instance}`;
  const paperId = `about-letter-paper-${instance}`;
  const [enlarged, setEnlarged] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const localDialog = useRef<HTMLElement | null>(null);
  const toggleEnlarged = () => {
    setEnlarged((value) => !value);
    // 放大时仍使用同一个阅读滚动区，避免嵌套滚动和额外弹窗。
    localDialog.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };
  return (
    <div className={`about-letter-backdrop${night ? ' is-night' : ''}`} onClick={onClose}>
      <section
        ref={(element) => {
          localDialog.current = element;
          if (typeof dialogRef === 'function') dialogRef(element);
          else if (dialogRef) dialogRef.current = element;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        tabIndex={-1}
        className={`about-letter-dialog${enlarged ? ' is-enlarged' : ''}${scrolled ? ' is-scrolled' : ''}`}
        onScroll={(event) =>
          setScrolled(event.currentTarget.scrollTop > 4 || event.currentTarget.scrollLeft > 0)
        }
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && enlarged) {
            event.preventDefault();
            toggleEnlarged();
          }
        }}
      >
        <h2 id="about-title" className="about-letter-accessible">
          关于食光
        </h2>
        <div className="about-letter-heading">
          <button className="about-letter-close" onClick={onClose} aria-label="关闭说明">
            <UiIcon name="close" size={20} />
          </button>
          <div className="about-letter-reading-tools">
            <button
              className="about-letter-zoom"
              onClick={toggleEnlarged}
              aria-expanded={enlarged}
              aria-controls={paperId}
            >
              <UiIcon name={enlarged ? 'minus' : 'plus'} size={14} />
              {enlarged ? '还原大小' : '放大查看'}
            </button>
            {enlarged && <span role="status">左右滑动阅读</span>}
          </div>
        </div>
        <div className="about-letter-unfold-stage">
          <PaperUnfold />
          <div className="about-letter-paper-wrap" id={paperId}>
            <div className="about-letter-paper">
              <div className="about-letter-texture" aria-hidden="true" />
              <div className="about-letter-folds" aria-hidden="true" />
              <div className="about-letter-wrinkles" aria-hidden="true" />
              <svg
                className="about-letter-handwriting"
                viewBox="34 342 1010 1030"
                role="img"
                aria-label="开发者写给使用者的一封手写信，讲述仙林食光的初衷、感谢参与资料收集的同学，并希望大家每天好好吃饭。保留原图的完整笔迹、日期和署名。"
                focusable="false"
              >
                <defs>
                  <filter
                    id={inkId}
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    colorInterpolationFilters="sRGB"
                  >
                    <feColorMatrix
                      type="matrix"
                      values="0 0 0 0 0.15  0 0 0 0 0.115  0 0 0 0 0.085  -1.33 -1.34 -1.33 0 3"
                      result="originalInk"
                    />
                    {/* 墨水只改变微量色深；沿用原始墨迹 alpha，粗细和细笔完全不变。 */}
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.52"
                      numOctaves="3"
                      seed="31"
                      result="pigmentNoise"
                    />
                    <feColorMatrix
                      in="pigmentNoise"
                      type="matrix"
                      values="0.06 0 0 0 0.12  0.05 0 0 0 0.09  0.04 0 0 0 0.065  0 0 0 0 1"
                      result="pigment"
                    />
                    <feComposite in="pigment" in2="originalInk" operator="in" />
                  </filter>
                </defs>
                <image
                  href={letterArtwork}
                  x="0"
                  y="0"
                  width="1079"
                  height="1643"
                  filter={`url(#${inkId})`}
                />
              </svg>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
