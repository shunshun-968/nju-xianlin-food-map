import { useLayoutEffect, type RefObject } from 'react';
import { campusViewArea } from './campus-view-area';

/** Share live navigation offsets across campus, building and floor views. */
export function useModelOverlayLayout(host: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const map = host.current?.closest<HTMLElement>('.map-area');
    const app = map?.closest<HTMLElement>('.app.floating-shell');
    if (!map || !app) return;
    const header = app.querySelector<HTMLElement>('.header');
    const drawer = app.querySelector<HTMLElement>('.sidebar-dock');
    const handle = drawer?.querySelector<HTMLElement>('.sidebar-handle');
    const breadcrumbs = map.querySelector<HTMLElement>('.breadcrumbs');
    const mobile = window.matchMedia('(max-width: 700px)');
    const transitions = new Set<string>();
    let frame = 0;
    let pendingFrames = 0;
    let transitionDeadline = 0;
    let disposed = false;
    let previousLayout = '';

    const writePixel = (name: string, value: number) => {
      const next = `${Math.round(value * 100) / 100}px`;
      if (map.style.getPropertyValue(name) !== next) map.style.setProperty(name, next);
    };

    const measure = () => {
      const bounds = map.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      // CSS positions start inside the border, unlike getBoundingClientRect.
      const originX = bounds.left + map.clientLeft;
      const originY = bounds.top + map.clientTop;
      let left = 16;
      let top = 16;
      let bottom = 16;
      if (mobile.matches && drawer)
        bottom = Math.max(16, map.clientHeight - (drawer.getBoundingClientRect().top - originY) + 12);
      if (!mobile.matches && drawer) {
        const drawerBounds = drawer.getBoundingClientRect();
        if (drawerBounds.width && drawerBounds.right > originX + 1) {
          const right = Math.max(drawerBounds.right, handle?.getBoundingClientRect().right ?? 0);
          left = Math.max(left, right - originX + 12);
        }
      }
      if (header) {
        const headerBounds = header.getBoundingClientRect();
        if (headerBounds.height && headerBounds.bottom > originY)
          top = Math.max(top, headerBounds.bottom - originY + 12);
      }
      left = Math.min(left, Math.max(16, map.clientWidth - 32));
      top = Math.min(top, Math.max(16, map.clientHeight - 32));
      const width = Math.max(0, map.clientWidth - left - 16);
      writePixel('--model-overlay-left', left);
      writePixel('--model-overlay-top', top);
      writePixel('--model-overlay-width', width);
      writePixel('--model-overlay-bottom', Math.min(bottom, map.clientHeight * 0.65));
      const stacked = String(width < 560);
      if (map.dataset.modelOverlayStacked !== stacked) map.dataset.modelOverlayStacked = stacked;
      // 用真实导航／视图按钮的底边定位说明和罗盘，不为不存在的按钮预留空行。
      let navigationBottom = top;
      for (const element of [breadcrumbs, map.querySelector<HTMLElement>('.fourth-view-controls')]) {
        if (element?.offsetHeight)
          navigationBottom = Math.max(navigationBottom, element.getBoundingClientRect().bottom - originY);
      }
      const infoTop = navigationBottom + 8;
      writePixel('--model-info-top', infoTop);
      // 提示本身锚定中心点，栏位拖动／展开时重新居中，而非只改变边距。
      const center = app.classList.contains('view-campus')
        ? campusViewArea(map)
        : {
            centerX: left + width / 2,
            centerY: (infoTop + 32 + map.clientHeight - Math.min(bottom, map.clientHeight * 0.65)) / 2,
          };
      writePixel('--loading-center-x', center.centerX);
      writePixel('--loading-center-y', center.centerY);
      const layout = [left, top, width, bottom, infoTop, map.clientHeight].map((value) => value.toFixed(2)).join('/');
      if (layout !== previousLayout) {
        previousLayout = layout;
        map.dispatchEvent(new Event('foodmap:model-layout'));
      }
    };

    const animate = (time: number) => {
      frame = 0;
      if (disposed) return;
      measure();
      pendingFrames = Math.max(0, pendingFrames - 1);
      // Transition events normally stop the loop; the deadline also handles
      // interrupted transitions or a document that was hidden mid-animation.
      if (time >= transitionDeadline) transitions.clear();
      if (pendingFrames || transitions.size) frame = requestAnimationFrame(animate);
    };

    const requestMeasure = () => {
      if (disposed) return;
      pendingFrames = 2;
      if (!frame) frame = requestAnimationFrame(animate);
    };

    const transitionKey = (event: TransitionEvent) =>
      `${event.target === header ? 'header' : 'drawer'}:${event.propertyName}`;
    const startTransition = (event: TransitionEvent) => {
      if (event.target !== header && event.target !== drawer) return;
      transitions.add(transitionKey(event));
      transitionDeadline = performance.now() + 2000;
      requestMeasure();
    };
    const endTransition = (event: TransitionEvent) => {
      if (event.target !== header && event.target !== drawer) return;
      transitions.delete(transitionKey(event));
      requestMeasure();
    };

    // Only navigation attributes are observed. The CSS variables written on
    // the map cannot trigger this observer or create a measurement feedback loop.
    const mutation = new MutationObserver(requestMeasure);
    mutation.observe(app, { attributes: true, attributeFilter: ['class'] });
    for (const element of [header, drawer]) {
      if (!element) continue;
      mutation.observe(element, { attributes: true, attributeFilter: ['class', 'style'] });
      element.addEventListener('transitionrun', startTransition);
      element.addEventListener('transitionend', endTransition);
      element.addEventListener('transitioncancel', endTransition);
    }
    const resize = new ResizeObserver(requestMeasure);
    for (const element of [map, header, drawer, handle, breadcrumbs]) if (element) resize.observe(element);
    window.addEventListener('resize', requestMeasure);
    window.addEventListener('foodmap:overlays', requestMeasure);
    window.addEventListener('foodmap:drawer', requestMeasure);
    mobile.addEventListener('change', requestMeasure);
    measure();
    requestMeasure();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      mutation.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', requestMeasure);
      window.removeEventListener('foodmap:overlays', requestMeasure);
      window.removeEventListener('foodmap:drawer', requestMeasure);
      mobile.removeEventListener('change', requestMeasure);
      for (const element of [header, drawer]) {
        element?.removeEventListener('transitionrun', startTransition);
        element?.removeEventListener('transitionend', endTransition);
        element?.removeEventListener('transitioncancel', endTransition);
      }
      for (const name of ['--model-overlay-left', '--model-overlay-top', '--model-overlay-width', '--model-overlay-bottom', '--model-info-top', '--loading-center-x', '--loading-center-y'])
        map.style.removeProperty(name);
      delete map.dataset.modelOverlayStacked;
    };
  }, [host]);
}
