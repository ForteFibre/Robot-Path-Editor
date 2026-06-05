import { act, fireEvent, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SIDEBAR_PATHS_MAX_HEIGHT,
  SIDEBAR_PATHS_MIN_HEIGHT,
  useResizableSidebarSections,
} from '../../features/sidebar/useResizableSidebarSections';

const STORAGE_KEY = 'path-editor.sidebar-paths-height';

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('useResizableSidebarSections', () => {
  it('restores a stored paths panel height', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '300');

    const { result } = renderHook(() => useResizableSidebarSections());

    expect(result.current.pathsHeight).toBe(300);
  });

  it('updates and persists height from keyboard controls', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '220');
    const { result } = renderHook(() => useResizableSidebarSections());

    act(() => {
      result.current.onResizeKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
      } as unknown as Parameters<typeof result.current.onResizeKeyDown>[0]);
    });

    expect(result.current.pathsHeight).toBe(236);
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe('236');

    act(() => {
      result.current.onResizeKeyDown({
        key: 'Home',
        preventDefault: vi.fn(),
      } as unknown as Parameters<typeof result.current.onResizeKeyDown>[0]);
    });

    expect(result.current.pathsHeight).toBe(SIDEBAR_PATHS_MIN_HEIGHT);
  });

  it('clamps pointer drag resizing to the supported range', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '220');
    const { result } = renderHook(() => useResizableSidebarSections());

    act(() => {
      result.current.onResizeStart({
        button: 0,
        clientY: 100,
        preventDefault: vi.fn(),
      } as unknown as Parameters<typeof result.current.onResizeStart>[0]);
    });

    expect(result.current.isResizing).toBe(true);

    act(() => {
      fireEvent.pointerMove(window, { clientY: 1000 });
    });

    expect(result.current.pathsHeight).toBe(SIDEBAR_PATHS_MAX_HEIGHT);

    act(() => {
      fireEvent.pointerMove(window, { clientY: -1000 });
    });

    expect(result.current.pathsHeight).toBe(SIDEBAR_PATHS_MIN_HEIGHT);

    act(() => {
      fireEvent.pointerUp(window);
    });

    expect(result.current.isResizing).toBe(false);
  });
});
