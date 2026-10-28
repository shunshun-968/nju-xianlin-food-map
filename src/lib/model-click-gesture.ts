export type ModelClickPointer = {
  pointerId: number;
  button: number;
  clientX: number;
  clientY: number;
  isPrimary?: boolean;
};

/**
 * 保存按下时的拾取快照；拖出阈值后再拖回、双指缩放和取消手势都不会被当成点击。
 * payload 由调用方创建为独立快照，本工具不读取相机或 DOM，也不复制泛型对象。
 */
export function createModelClickGesture<T>(threshold = 6) {
  if (!Number.isFinite(threshold) || threshold < 0)
    throw new RangeError('Click movement threshold must be a finite non-negative number');

  const activePointers = new Set<number>();
  let candidate:
    | { pointerId: number; x: number; y: number; payload: T }
    | undefined;
  const finitePosition = (event: ModelClickPointer) =>
    Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
  const staysWithinThreshold = (event: ModelClickPointer) =>
    candidate !== undefined &&
    finitePosition(event) &&
    Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) <= threshold;

  return {
    down(event: ModelClickPointer, payload: T) {
      const startsGesture = activePointers.size === 0;
      activePointers.add(event.pointerId);
      if (
        !startsGesture ||
        event.button !== 0 ||
        event.isPrimary === false ||
        !finitePosition(event)
      ) {
        // 第二个指针（包括重复的 pointerdown）令整轮失效；后续松开一个手指不重新武装。
        candidate = undefined;
        return;
      }
      candidate = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        payload,
      };
    },
    move(event: ModelClickPointer) {
      if (candidate?.pointerId === event.pointerId && !staysWithinThreshold(event))
        candidate = undefined;
    },
    up(event: ModelClickPointer): T | undefined {
      if (!activePointers.has(event.pointerId)) return undefined;
      const clicked =
        candidate?.pointerId === event.pointerId &&
        activePointers.size === 1 &&
        event.button === 0 &&
        event.isPrimary !== false &&
        staysWithinThreshold(event);
      const payload = clicked ? candidate!.payload : undefined;
      activePointers.delete(event.pointerId);
      if (candidate?.pointerId === event.pointerId) candidate = undefined;
      return payload;
    },
    cancel(eventOrPointerId: Pick<ModelClickPointer, 'pointerId'> | number) {
      const pointerId =
        typeof eventOrPointerId === 'number' ? eventOrPointerId : eventOrPointerId.pointerId;
      activePointers.delete(pointerId);
      if (candidate?.pointerId === pointerId) candidate = undefined;
    },
    clear() {
      activePointers.clear();
      candidate = undefined;
    },
  };
}
