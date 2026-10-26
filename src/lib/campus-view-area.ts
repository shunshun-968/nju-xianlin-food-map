/** 校园默认取景与加载提示共用同一个可见区域中心。 */
export function campusViewArea(host: HTMLElement, width = host.clientWidth, height = host.clientHeight) {
  const rect = host.getBoundingClientRect();
  const originX = rect.left + host.clientLeft;
  const originY = rect.top + host.clientTop;
  const app = host.closest('.app');
  const drawer = app?.querySelector('.sidebar-dock:not(.is-collapsed)')?.getBoundingClientRect();
  const crumbs = app?.querySelector('.breadcrumbs')?.getBoundingClientRect();
  const left = drawer && width > 700 ? Math.max(20, drawer.right - originX + 28) : 20;
  const top = Math.max(35, (crumbs?.bottom ?? originY) - originY + 20);
  const bottom = drawer && width <= 700
    ? Math.max(top + 180, Math.min(height - 35, drawer.top - originY - 20))
    : height - 45;
  return { left, top, bottom, centerX: left + (width - left) / 2, centerY: top + (bottom - top) / 2 };
}
