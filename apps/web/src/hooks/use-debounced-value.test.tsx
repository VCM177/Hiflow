import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './use-debounced-value';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the new value only after the delay has passed', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('ab');
  });

  it('restarts the wait on each change, so fast typing shows only the last value', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: '' } },
    );
    rerender({ value: 'n' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'ng' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('ng');
  });

  it('applies a cleared value at once, without waiting for the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'kế toán' } },
    );
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('kế toán');

    rerender({ value: '' });
    expect(result.current).toBe('');
  });
});
