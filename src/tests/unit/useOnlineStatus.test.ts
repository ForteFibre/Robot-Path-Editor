import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOnlineStatus } from '../../pwa/useOnlineStatus';

const setNavigatorOnline = (isOnline: boolean): void => {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: isOnline,
  });
};

describe('useOnlineStatus', () => {
  it('uses navigator.onLine as the initial value', () => {
    setNavigatorOnline(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });

  it('reacts to online and offline events', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);

    act(() => {
      globalThis.window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);

    act(() => {
      globalThis.window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });
});
