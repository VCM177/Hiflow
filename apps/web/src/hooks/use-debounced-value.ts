import { useEffect, useState } from 'react';

/**
 * Returns `value` once it has stopped changing for `delay` ms (search boxes use 300 ms).
 * Clearing the value to '' applies at once: a reset must show the unfiltered list
 * right away, not after the delay. The clear is synced during render so the old
 * term is never returned, not even for one frame.
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  if ((value as unknown) === '' && (debounced as unknown) !== '') {
    setDebounced(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debounced;
}
