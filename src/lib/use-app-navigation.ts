import { useCallback, useEffect, useRef, useState } from 'react';
import { catalog } from '../data/catalog';
import { SOUTH_GATE_CART_FLOOR_ID, SOUTH_GATE_CART_VENUE_ID } from '../data/south-gate-cart';
import type { View } from '../domain';

export type NavigationState = { view: View; stallId: string | null; showInfo: boolean };
export function readNavigation(url: URL): NavigationState {
  const floor = catalog.floors.find((f) => f.id === url.searchParams.get('floor'));
  const venue = catalog.venues.find((v) => v.id === url.searchParams.get('venue'));
  const view: View = floor
    ? { level: 'floor', venueId: floor.venueId, floorId: floor.id }
    : venue
      ? { level: 'building', venueId: venue.id }
      : { level: 'campus' };
  // The cart is directly selectable in its building view, without entering a floor.
  const stallFloorId = floor?.id ??
    (view.level === 'building' && view.venueId === SOUTH_GATE_CART_VENUE_ID
      ? SOUTH_GATE_CART_FLOOR_ID
      : undefined);
  const stall = catalog.stalls.find(
    (s) => s.id === url.searchParams.get('stall') && s.floorId === stallFloorId,
  );
  return { view, stallId: stall?.id ?? null, showInfo: url.searchParams.get('info') === '1' };
}
export function navigationPath(state: NavigationState): NavigationState[] {
  const path: NavigationState[] = [{ view: { level: 'campus' }, stallId: null, showInfo: false }];
  if (state.view.level !== 'campus')
    path.push({
      view: { level: 'building', venueId: state.view.venueId },
      stallId: null,
      showInfo: false,
    });
  if (state.view.level === 'floor') path.push({ view: state.view, stallId: null, showInfo: false });
  if (state.stallId) path.push({ ...state, showInfo: false });
  if (state.showInfo) path.push(state);
  return path;
}
export function navigationUrl(state: NavigationState, current: URL) {
  const url = new URL(current);
  for (const key of ['floor', 'venue', 'stall', 'info']) url.searchParams.delete(key);
  if (state.view.level === 'floor') url.searchParams.set('floor', state.view.floorId);
  if (state.view.level === 'building') url.searchParams.set('venue', state.view.venueId);
  if (state.stallId) url.searchParams.set('stall', state.stallId);
  if (state.showInfo) url.searchParams.set('info', '1');
  return url;
}

/** Browser Back/Forward, Escape and in-page breadcrumbs share the same history. */
export function useAppNavigation() {
  const [state, setState] = useState(() => readNavigation(new URL(window.location.href)));
  const current = useRef(state);
  useEffect(() => {
    // Deep links also get their parent levels, without adding duplicates after refresh.
    if (window.history.state?.foodmapNavigation !== 1) {
      navigationPath(current.current).forEach((entry, depth) => {
        const url = navigationUrl(entry, new URL(window.location.href));
        const marker = { foodmapNavigation: 1, depth };
        if (!depth) window.history.replaceState(marker, '', url);
        else window.history.pushState(marker, '', url);
      });
    }
    const pop = () => {
      const next = readNavigation(new URL(window.location.href));
      current.current = next;
      setState(next);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const commit = useCallback((next: NavigationState) => {
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    const ancestors = navigationPath(current.current);
    const nextPath = navigationPath(next);
    if (
      nextPath.length === ancestors.length &&
      JSON.stringify(nextPath.slice(0, -1)) === JSON.stringify(ancestors.slice(0, -1))
    ) {
      window.history.replaceState(
        { foodmapNavigation: 1, depth: nextPath.length - 1 },
        '',
        navigationUrl(next, new URL(window.location.href)),
      );
      current.current = next;
      setState(next);
      return;
    }
    const index = ancestors.findIndex((entry) => JSON.stringify(entry) === JSON.stringify(next));
    if (
      index >= 0 &&
      index < ancestors.length - 1 &&
      window.history.state?.foodmapNavigation === 1
    ) {
      window.history.go(index - ancestors.length + 1);
      return;
    }
    window.history.pushState(
      { foodmapNavigation: 1, depth: navigationPath(next).length - 1 },
      '',
      navigationUrl(next, new URL(window.location.href)),
    );
    current.current = next;
    setState(next);
  }, []);
  return {
    ...state,
    navigate: useCallback(
      (view: View) => commit({ view, stallId: null, showInfo: false }),
      [commit],
    ),
    setStallId: useCallback(
      (stallId: string | null) => commit({ ...current.current, stallId }),
      [commit],
    ),
    setShowInfo: useCallback(
      (showInfo: boolean) => commit({ ...current.current, showInfo }),
      [commit],
    ),
  };
}
