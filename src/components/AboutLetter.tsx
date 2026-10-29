import { useEffect, useState, useSyncExternalStore, type Ref } from 'react';
import { UiIcon } from './UiIcon';
import { PaperUnfold } from './PaperUnfold';
import { LoadingProgress } from './LoadingProgress';
import { aboutLetterAssets } from '../lib/about-letter-assets';
import './about-letter.css';

type Props = {
  dialogRef: Ref<HTMLElement>;
  onClose: () => void;
  night: boolean;
};

/** 原图笔迹先解码为透明图片，准备完毕后才挂载信纸与展开动画。 */
export function AboutLetter({ dialogRef, onClose, night }: Props) {
  const [assets, setAssets] = useState(aboutLetterAssets.peek);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const progress = useSyncExternalStore(aboutLetterAssets.subscribe, aboutLetterAssets.getProgress);

  useEffect(() => {
    let active = true;
    setFailed(false);
    void aboutLetterAssets.load().then(
      (ready) => {
        if (active) setAssets(ready);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    // 关闭弹窗不取消共用准备任务；完成后缓存供下次打开使用。
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <div className={`about-letter-backdrop${night ? ' is-night' : ''}`} onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        aria-busy={!assets && !failed}
        tabIndex={-1}
        className="about-letter-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
          event.stopPropagation();
        }}
      >
        <h2 id="about-title" className="about-letter-accessible">
          关于食光
        </h2>
        <button className="about-letter-close" onClick={onClose} aria-label="关闭说明">
          <UiIcon name="close" size={20} />
        </button>
        <div className={`about-letter-sheet-position${assets ? '' : ' is-loading'}`}>
          {!assets ? (
            <div className="about-letter-loading" role={failed ? 'alert' : undefined}>
              {failed ? (
                <button
                  className="about-letter-retry"
                  onClick={(event) => {
                    event.currentTarget
                      .closest('[role="dialog"]')
                      ?.querySelector<HTMLButtonElement>('.about-letter-close')
                      ?.focus({ preventScroll: true });
                    setFailed(false);
                    setAttempt((value) => value + 1);
                  }}
                >
                  暂时无法加载，点击重试
                </button>
              ) : (
                <LoadingProgress kind="about" progress={progress} />
              )}
            </div>
          ) : (
            <div className="about-letter-unfold-stage">
              <PaperUnfold />
              <div className="about-letter-paper-wrap">
                <div className="about-letter-paper">
                  <div className="about-letter-texture" aria-hidden="true" />
                  <div className="about-letter-folds" aria-hidden="true" />
                  <div className="about-letter-wrinkles" aria-hidden="true" />
                  <img
                    className="about-letter-handwriting"
                    src={assets.inkUrl}
                    width="1010"
                    height="1030"
                    alt="开发者写给使用者的一封手写信，讲述仙林食光的初衷、感谢参与资料收集的同学，并希望大家每天好好吃饭。保留原图的完整笔迹、日期和署名。"
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
