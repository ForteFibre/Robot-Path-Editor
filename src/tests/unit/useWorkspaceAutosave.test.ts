import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceAutosavePayload } from '../../domain/workspaceContract';
import { useWorkspaceAutosave } from '../../features/persistence/useWorkspaceAutosave';
import { useWorkspaceStore } from '../../store/workspaceStore';

describe('useWorkspaceAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sets an error state when a scheduled autosave fails', async () => {
    const saveWorkspace = vi.fn<
      (workspace: WorkspaceAutosavePayload) => Promise<{ savedAt: number }>
    >(() => Promise.reject(new Error('disk full')));
    const { result } = renderHook(() =>
      useWorkspaceAutosave({
        isSuppressed: false,
        debounceMs: 600,
        saveWorkspace,
      }),
    );

    act(() => {
      useWorkspaceStore.getState().addPath();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(saveWorkspace).toHaveBeenCalledTimes(1);
    expect(result.current.autosaveState).toEqual({
      kind: 'error',
      savedAt: null,
      error: {
        kind: 'autosave',
        reason: 'write-failed',
      },
    });
  });

  it('debounces persisted workspace changes and ignores transient ui changes', async () => {
    const saveCalls: WorkspaceAutosavePayload[] = [];
    const saveWorkspace = (
      workspace: WorkspaceAutosavePayload,
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
      error: null,
    });
  });

  it('cancels pending saves while suppressed and saves only after the next real edit', async () => {
    const saveCalls: WorkspaceAutosavePayload[] = [];
    const saveWorkspace = (
      workspace: WorkspaceAutosavePayload,
    ): Promise<{ savedAt: number }> => {
      saveCalls.push(workspace);
      return Promise.resolve({
        savedAt: workspace.document.domain.paths.length,
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
    expect(saveCalls[0]?.document.domain.paths).toHaveLength(2);
  });

  it('can save immediately even while autosave is suppressed', async () => {
    const saveCalls: WorkspaceAutosavePayload[] = [];
    const saveWorkspace = (
      workspace: WorkspaceAutosavePayload,
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
    expect(saveCalls[0]?.document.robotSettings.maxVelocity).toBe(4.2);
    expect(result.current.autosaveState).toEqual({
      kind: 'idle',
      savedAt: 777,
      error: null,
    });
  });

  it('uses the latest tracked source when saveNow runs in the same tick as a store mutation', async () => {
    const saveCalls: WorkspaceAutosavePayload[] = [];
    const saveWorkspace = (
      workspace: WorkspaceAutosavePayload,
    ): Promise<{ savedAt: number }> => {
      saveCalls.push(workspace);
      return Promise.resolve({ savedAt: 888 });
    };
    const { result } = renderHook(() =>
      useWorkspaceAutosave({
        isSuppressed: true,
        debounceMs: 600,
        saveWorkspace,
      }),
    );

    let savePromise: Promise<{ savedAt: number }> | null = null;

    act(() => {
      useWorkspaceStore.getState().setRobotSettings({ maxVelocity: 4.2 });
      savePromise = result.current.saveNow();
    });

    await act(async () => {
      await savePromise;
    });

    expect(saveCalls).toHaveLength(1);
    expect(saveCalls[0]?.document.robotSettings.maxVelocity).toBe(4.2);
    expect(result.current.autosaveState).toEqual({
      kind: 'idle',
      savedAt: 888,
      error: null,
    });
  });
});
