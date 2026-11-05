import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCountdown } from './use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useCountdown());
    expect(result.current.secondsLeft).toBe(0);
  });

  it('falls one per second and stops at zero', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(3));
    expect(result.current.secondsLeft).toBe(3);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.secondsLeft).toBe(2);
    // One tick per act: each render schedules the next second.
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.secondsLeft).toBe(0);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.secondsLeft).toBe(0);
  });

  it('can begin at a given value', () => {
    const { result } = renderHook(() => useCountdown(2));
    expect(result.current.secondsLeft).toBe(2);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.secondsLeft).toBe(1);
  });

  it('restarts from a new value', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(10));
    act(() => vi.advanceTimersByTime(4000));
    act(() => result.current.start(2));
    expect(result.current.secondsLeft).toBe(2);
  });

  it('ignores a negative or fractional start', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(-5));
    expect(result.current.secondsLeft).toBe(0);
    act(() => result.current.start(1.2));
    expect(result.current.secondsLeft).toBe(2);
  });
});
