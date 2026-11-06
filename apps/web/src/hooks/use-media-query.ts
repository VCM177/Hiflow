import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches right now and as the window changes. Before the page
 * is in the browser (server render, first paint) it answers `false`, so the narrow layout
 * is the safe default.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
