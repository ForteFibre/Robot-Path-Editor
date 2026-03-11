import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceAutosave } from '../../features/persistence/useWorkspaceAutosave';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { WorkspacePersistedState } from '../../store/types';

describe('useWorkspaceAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces persisted workspace changes and ignores transient ui changes', async () => {
    const saveCalls: WorkspacePersistedState[] = [];
    const saveWorkspace = (
      workspace: WorkspacePersistedState,
    ): Promise<{ savedAt: number }> => {
      saveCalls.push(workspace);
      return Promise.resolve({ savedAt: 111 });
    };
    const { result } = renderHook(() =>
      useWorkspaceAutosave({
        isSuppressed: false,
        debounceMs: 600,
        saveWorkspace,
      }),
    );

    act(() => {
      useWorkspaceStore.getState().setDragging(true);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(saveCalls).toHaveLength(0);

    act(() => {
      useWorkspaceStore.getState().setRobotSettings({ length: 1.35 });
      useWorkspaceStore.getState().setRobotSettings({ width: 0.82 });
    });

    expect(saveCalls).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(599);
    });

    expect(saveCalls).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(saveCalls).toHaveLength(1);
    expect(result.current.autosaveState).toEqual({
      kind: 'idle',
      savedAt: 111,
      message: null,
    });
  });

  it('cancels pending saves while suppressed and saves only after the next real edit', async () => {
    const saveCalls: WorkspacePersistedState[] = [];
    const saveWorkspace = (
      workspace: WorkspacePersistedState,
    ): Promise<{ savedAt: number }> => {
      saveCalls.push(workspace);
      return Promise.resolve({
        savedAt: workspace.domain.paths.length,
      });
    };
    const { rerender } = renderHook(
      ({ isSuppressed }: { isSuppressed: boolean }) =>
        useWorkspaceAutosave({
          isSuppressed,
          debounceMs: 600,
          saveWorkspace,
        }),
      {
        initialProps: {
          isSuppressed: false,
        },
      },
    );

    act(() => {
      useWorkspaceStore.getState().addPath();
    });

    rerender({ isSuppressed: true });

    act(() => {
      useWorkspaceStore.getState().resetWorkspace();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(saveCalls).toHaveLength(0);

    rerender({ isSuppressed: false });

    act(() => {
      useWorkspaceStore.getState().addPath();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(saveCalls).toHaveLength(1);
    expect(saveCalls[0]?.domain.paths).toHaveLength(2);
  });

  it('can save immediately even while autosave is suppressed', async () => {
    const saveCalls: WorkspacePersistedState[] = [];
    const saveWorkspace = (
      workspace: WorkspacePersistedState,
    ): Promise<{ savedAt: number }> => {
      saveCalls.push(workspace);
      return Promise.resolve({ savedAt: 777 });
    };
    const { result } = renderHook(() =>
      useWorkspaceAutosave({
        isSuppressed: true,
        debounceMs: 600,
        saveWorkspace,
      }),
    );

    act(() => {
      useWorkspaceStore.getState().setRobotSettings({ maxVelocity: 4.2 });
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(saveCalls).toHaveLength(1);
    expect(result.current.autosaveState).toEqual({
      kind: 'idle',
      savedAt: 777,
      message: null,
    });
  });
});
