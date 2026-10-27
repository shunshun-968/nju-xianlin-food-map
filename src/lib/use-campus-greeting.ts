import { useLayoutEffect, useRef, useState } from 'react';
import type { View } from '../domain';

const STORAGE_KEY = 'foodmap:campus-visits';

/** Count campus entries per tab, including reloads, rather than React renders. */
export function useCampusGreeting(level: View['level']) {
  const [alternate, setAlternate] = useState(false);
  const previousLevel = useRef<View['level'] | null>(null);
  const visits = useRef(0);

  useLayoutEffect(() => {
    const entering = level === 'campus' && previousLevel.current !== 'campus';
    // Also guards Strict Mode's effect replay on the initial mount.
    previousLevel.current = level;
    if (!entering) return;

    try {
      const stored = Number(sessionStorage.getItem(STORAGE_KEY));
      if (Number.isSafeInteger(stored) && stored >= 0) visits.current = stored;
    } catch {
      // Keep alternating in memory when browser storage is unavailable.
    }
    visits.current = visits.current < Number.MAX_SAFE_INTEGER ? visits.current + 1 : 1;
    setAlternate(visits.current % 2 === 0);
    try {
      sessionStorage.setItem(STORAGE_KEY, String(visits.current));
    } catch {
      // Navigation still works without storage access.
    }
  }, [level]);

  return alternate;
}
