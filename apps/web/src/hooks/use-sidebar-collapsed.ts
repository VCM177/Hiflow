import * as React from 'react';

const STORAGE_KEY = 'hf-sidebar-collapsed';

const listeners = new Set<() => void>();
// Used when the browser refuses storage (private window, blocked site data), so the
// toggle still works for the life of the page.
let fallback = false;

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return fallback;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Whether the sidebar is collapsed, remembered across visits in this browser. */
export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  // The server has no storage, so it renders expanded; the browser then corrects it.
  const collapsed = React.useSyncExternalStore(subscribe, read, () => false);

  const setCollapsed = React.useCallback((next: boolean) => {
    fallback = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Not remembered; the in-memory value above still applies.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [collapsed, setCollapsed];
}
