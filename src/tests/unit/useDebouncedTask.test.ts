import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedTask } from '../../features/persistence/useDebouncedTask';

describe('useDebouncedTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('schedules only the latest task and lets cancel stop pending work', async () => {
    const calls: string[] = [];
    const { result } = renderHook(() => useDebouncedTask());

    act(() => {
      result.current.schedule(() => calls.push('first'), 100);
      result.current.schedule(() => calls.push('second'), 100);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(99);
    });

    expect(calls).toEqual([]);

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(calls).toEqual([]);

    act(() => {
      result.current.schedule(() => calls.push('third'), 100);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(calls).toEqual(['third']);
  });

  it('runs the latest closure after a reschedule across renders', async () => {
    const calls: string[] = [];
    const { result, rerender } = renderHook(
      ({ label }: { label: string }) => {
        const debouncedTask = useDebouncedTask();

        return {
          ...debouncedTask,
          label,
        };
      },
      {
        initialProps: {
          label: 'first',
        },
      },
    );

    act(() => {
      const label = result.current.label;
      result.current.schedule(() => calls.push(label), 100);
    });

    rerender({ label: 'second' });

    act(() => {
      const label = result.current.label;
      result.current.schedule(() => calls.push(label), 100);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(calls).toEqual(['second']);
  });

  it('cancels pending work when the hook unmounts', async () => {
    const scheduledTask = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedTask());

    act(() => {
      result.current.schedule(scheduledTask, 100);
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(scheduledTask).not.toHaveBeenCalled();
  });
});
