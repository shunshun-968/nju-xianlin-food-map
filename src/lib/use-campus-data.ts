import { useEffect, useMemo, useRef, useState } from 'react';
import { initialZoom, type CampusBasemap, type MapTransform } from './campus-basemap';
import { basemapLoader } from './basemap-cache';
import {
  chunksForBounds,
  mergeMapFeatures,
  viewportBounds,
  type Bounds,
  type FeatureChunk,
  type MapManifest,
} from './basemap-loading';

export function useCampusData({
  transform,
  viewport,
  priorityBounds,
  isInteracting,
}: {
  transform: MapTransform;
  viewport: { width: number; height: number };
  priorityBounds: Bounds | null;
  isInteracting: () => boolean;
}) {
  const [manifest, setManifest] = useState<MapManifest | null>(null);
  const [baseMap, setBaseMap] = useState<CampusBasemap | null>(null);
  const [activated, setActivated] = useState<Map<string, FeatureChunk>>(new Map());
  const [error, setError] = useState('');
  const [outerError, setOuterError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [priorityReady, setPriorityReady] = useState(false);
  const [prefetched, setPrefetched] = useState(false);
  const busyCheck = useRef(isInteracting);
  busyCheck.current = isInteracting;
  useEffect(() => {
    let cancelled = false;
    setError('');
    basemapLoader
      .loadManifest()
      .then(async (value) => {
        const core = await basemapLoader.loadChunk(value, value.core);
        if (!cancelled) {
          setManifest((previous) => previous ?? value);
          setBaseMap((previous) => previous ?? { ...value.metadata, features: core.features });
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    // Keep shared requests alive across StrictMode and interior/campus navigation.
    return () => {
      cancelled = true;
    };
  }, [retry]);

  useEffect(() => {
    if (priorityBounds && transform.zoom < initialZoom - 1e-5) setUnlocked(true);
  }, [priorityBounds, transform.zoom]);
  const wantedBounds =
    priorityBounds && (unlocked ? viewportBounds(transform, viewport, 100) : priorityBounds);
  const wanted = manifest && wantedBounds ? chunksForBounds(manifest, wantedBounds) : [];
  const wantedKey = wanted
    .map((chunk) => chunk.id)
    .sort()
    .join('|');
  const priorityKey =
    manifest && priorityBounds
      ? chunksForBounds(manifest, priorityBounds)
          .map((c) => c.id)
          .sort()
          .join('|')
      : '';
  useEffect(() => {
    if (!manifest || !priorityBounds) return;
    let cancelled = false;
    setOuterError(false);
    // Finish the initial window even if the user changes zoom while it is loading.
    const priority = chunksForBounds(manifest, priorityBounds);
    const chunks = [...new Map([...priority, ...wanted].map((c) => [c.id, c])).values()];
    const already = chunks.filter((c) => basemapLoader.cachedChunk(manifest, c));
    if (already.length)
      setActivated((previous) => {
        const next = new Map(previous);
        for (const c of already) next.set(c.id, basemapLoader.cachedChunk(manifest, c)!);
        return [...next.keys()].every((id) => previous.has(id)) ? previous : next;
      });
    Promise.allSettled(chunks.map((chunk) => basemapLoader.loadChunk(manifest, chunk))).then(
      (results) => {
        if (cancelled) return;
        setActivated((previous) => {
          const next = new Map(previous);
          results.forEach((result, i) => {
            if (result.status === 'fulfilled') next.set(chunks[i].id, result.value);
          });
          return [...next.keys()].every((id) => previous.has(id)) ? previous : next;
        });
        setOuterError(results.some((r) => r.status === 'rejected'));
        setPriorityReady(priority.every((c) => !!basemapLoader.cachedChunk(manifest, c)));
      },
    );
    return () => {
      cancelled = true;
    };
    // Chunk IDs, not every pointer event, define a data-loading boundary.
  }, [manifest, wantedKey, priorityKey, retry]);

  useEffect(() => {
    if (!manifest || !priorityReady) return;
    let cancelled = false,
      cursor = 0;
    let timeout: ReturnType<typeof window.setTimeout> | undefined;
    let idle: number | undefined;
    const remaining = manifest.surrounding.filter((c) => !basemapLoader.cachedChunk(manifest, c));
    function schedule() {
      if (cancelled) return;
      if (cursor >= remaining.length) {
        setPrefetched(
          manifest!.surrounding.every((c) => !!basemapLoader.cachedChunk(manifest!, c)),
        );
        return;
      }
      if (busyCheck.current() || document.visibilityState !== 'visible') {
        timeout = window.setTimeout(schedule, 350);
        return;
      }
      const run = () => {
        if (cancelled) return;
        if (busyCheck.current() || document.visibilityState !== 'visible') {
          timeout = window.setTimeout(schedule, 350);
          return;
        }
        const chunk = remaining[cursor++];
        // Only one low-priority background request; it never activates SVG layers.
        basemapLoader
          .loadChunk(manifest!, chunk, true)
          .catch(() => undefined)
          .finally(schedule);
      };
      if (typeof window.requestIdleCallback === 'function')
        idle = window.requestIdleCallback(run, { timeout: 1800 });
      else timeout = window.setTimeout(run, 100);
    }
    timeout = window.setTimeout(schedule, 450);
    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, [manifest, priorityReady]);

  const map = useMemo(
    () =>
      baseMap && {
        ...baseMap,
        features: mergeMapFeatures([
          { version: 1, features: baseMap.features },
          ...activated.values(),
        ]),
      },
    [baseMap, activated],
  );
  return {
    baseMap,
    map,
    error,
    outerError,
    unlocked,
    priorityReady,
    prefetched,
    activeBounds: unlocked ? (baseMap?.coverageBounds ?? null) : priorityBounds,
    retry: () => setRetry((value) => value + 1),
  };
}
