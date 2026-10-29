import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCampusArtworkSources } from './campus-model-artwork';
import { loadCampusArtwork } from './campus-artwork-loading';

export function useCampusArtwork(nightMode: boolean) {
  const sources = useMemo(() => getCampusArtworkSources(nightMode), [nightMode]);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState({
    sources,
    attempt,
    statuses: new Map<string, 'ready' | 'error'>(),
  });
  const record = useCallback(
    (href: string, status: 'ready' | 'error') => {
      setResults((previous) => ({
        sources,
        attempt,
        statuses: new Map(
          previous.sources === sources && previous.attempt === attempt ? previous.statuses : [],
        ).set(href, status),
      }));
    },
    [sources, attempt],
  );
  useEffect(() => {
    let cancelled = false;
    for (const { href } of sources) {
      void loadCampusArtwork(href).then(
        () => {
          if (!cancelled) record(href, 'ready');
        },
        () => {
          if (!cancelled) record(href, 'error');
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [sources, record]);
  // Returning to a previously failed theme starts a new attempt. Old errors must not
  // count as settled while this theme's current downloads are still in flight.
  const statuses =
    results.sources === sources && results.attempt === attempt ? results.statuses : new Map();
  const readyIds = new Set(
    sources
      .filter(({ href }) => statuses.get(href) !== 'error' && !!loadCampusArtwork.peek(href))
      .map(({ id }) => id as string),
  );
  const failed = sources.filter(({ href }) => statuses.get(href) === 'error').length;
  const settled = readyIds.size + failed;
  const onImageError = useCallback((href: string) => record(href, 'error'), [record]);
  return {
    readyIds,
    failed,
    settled: settled === sources.length,
    progress: settled / sources.length,
    // SVG failures also get the visible retry action. Retry remounts the image; it
    // may reuse already decoded pixels, and never starts an automatic error loop.
    onImageError,
    retry: () => {
      setAttempt((value) => value + 1);
    },
  };
}
