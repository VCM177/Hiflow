import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSidebarCollapsed } from './use-sidebar-collapsed';

describe('useSidebarCollapsed', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts expanded', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it('remembers the choice for the next visit', () => {
    const first = renderHook(() => useSidebarCollapsed());
    act(() => first.result.current[1](true));
    expect(first.result.current[0]).toBe(true);
    expect(window.localStorage.getItem('hf-sidebar-collapsed')).toBe('1');
    first.unmount();

    const second = renderHook(() => useSidebarCollapsed());
    expect(second.result.current[0]).toBe(true);
  });

  it('keeps two components in step', () => {
    const a = renderHook(() => useSidebarCollapsed());
    const b = renderHook(() => useSidebarCollapsed());
    act(() => a.result.current[1](true));
    expect(b.result.current[0]).toBe(true);
    act(() => a.result.current[1](false));
    expect(b.result.current[0]).toBe(false);
  });

  it('still toggles when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});
