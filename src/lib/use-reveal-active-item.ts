import { useEffect, useState } from 'react';

/** Reveal an active row without scrolling the page or stealing keyboard focus. */
export function useRevealActiveItem(activeId: string | null) {
  const [list, setList] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!list || !activeId) return;
    let frame = 0;
    // Stop any previous row's smooth scroll before measuring the new target.
    list.scrollTo({ top: list.scrollTop, behavior: 'instant' });
    const reveal = () => {
      frame = 0;
      const item = Array.from(list.querySelectorAll<HTMLElement>('[data-list-item-id]')).find(
        (row) => row.dataset.listItemId === activeId,
      );
      if (!item || !list.clientHeight) return;
      const bounds = list.getBoundingClientRect();
      const row = item.getBoundingClientRect();
      const top = bounds.top + list.clientTop;
      const bottom = top + list.clientHeight;
      const offset =
        row.top < top || row.height > list.clientHeight
          ? row.top - top
          : row.bottom > bottom
            ? row.bottom - bottom
            : 0;
      if (Math.abs(offset) < 1) return;
      list.scrollBy({
        top: offset,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
    };
    schedule();
    // Also handle asynchronous data, filtering, and mobile sheet resizing.
    const mutation = new MutationObserver(schedule);
    mutation.observe(list, { childList: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      mutation.disconnect();
      resize.disconnect();
    };
  }, [list, activeId]);

  return setList;
}
