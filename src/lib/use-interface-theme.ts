import { useEffect, useState } from 'react';

export type InterfaceTheme = 'day' | 'night';

const STORAGE_KEY = 'foodmap:interface-theme';

function readTheme(): InterfaceTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'night' ? 'night' : 'day';
  } catch {
    return 'day';
  }
}

export function useInterfaceTheme() {
  const [interfaceTheme, setInterfaceTheme] = useState<InterfaceTheme>(readTheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, interfaceTheme);
    } catch {
      // The current session still supports switching when browser storage is unavailable.
    }
  }, [interfaceTheme]);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setInterfaceTheme(readTheme());
      }
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  return [interfaceTheme, setInterfaceTheme] as const;
}
