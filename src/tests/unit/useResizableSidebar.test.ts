import { act, fireEvent, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEFT_SIDEBAR_MAX_WIDTH,
  LEFT_SIDEBAR_MIN_WIDTH,
  useResizableSidebar,
} from '../../features/app-shell/useResizableSidebar';

const STORAGE_KEY = 'path-editor.left-sidebar-width';

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('useResizableSidebar', () => {
  it('restores a stored sidebar width', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '360');

    const { result } = renderHook(() => useResizableSidebar());

    expect(result.current.width).toBe(360);
  });

  it('updates and persists width from keyboard controls', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '300');
    const { result } = renderHook(() => useResizableSidebar());

    act(() => {
      result.current.onResizeKeyDown({
        key: 'ArrowRight',
        preventDefault: vi.fn(),
      } as unknown as Parameters<typeof result.current.onResizeKeyDown>[0]);
    });

    expect(result.current.width).toBe(316);
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe('316');

    act(() => {
      result.current.onResizeKeyDown({
        key: 'Home',
        preventDefault: vi.fn(),
      } as unknown as Parameters<typeof result.current.onResizeKeyDown>[0]);
    });

    expect(result.current.width).toBe(LEFT_SIDEBAR_MIN_WIDTH);
  });

  it('clamps pointer drag resizing to the supported range', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '300');
    const { result } = renderHook(() => useResizableSidebar());

    act(() => {
      result.current.onResizeStart({
        button: 0,
        clientX: 100,
        preventDefault: vi.fn(),
      } as unknown as Parameters<typeof result.current.onResizeStart>[0]);
    });

    expect(result.current.isResizing).toBe(true);

    act(() => {
      fireEvent.pointerMove(window, { clientX: 1000 });
    });

    expect(result.current.width).toBe(LEFT_SIDEBAR_MAX_WIDTH);

    act(() => {
      fireEvent.pointerMove(window, { clientX: -1000 });
    });

    expect(result.current.width).toBe(LEFT_SIDEBAR_MIN_WIDTH);

    act(() => {
      fireEvent.pointerUp(window);
    });

    expect(result.current.isResizing).toBe(false);
  });
});
