import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePersistenceFacade } from '../../features/persistence/types';
import { useWorkspaceConflictDialogController } from '../../features/workspace-file/useWorkspaceConflictDialogController';

type MockPersistence = WorkspacePersistenceFacade;

const createPersistence = (
  overrides?: Partial<MockPersistence>,
): MockPersistence => {
  return {
    autosaveState: {
      kind: 'idle',
      savedAt: null,
      error: null,
    },
    recoveredNotification: null,
    restoreDialog: {
      result: null,
      isBusy: false,
      onStartFresh: vi.fn(),
      onRestoreLastEdit: vi.fn(),
      onRestoreLinkedFile: vi.fn(),
      onLoadFromFile: vi.fn(() => Promise.resolve()),
    },
    pendingSaveConflict: null,
    linkedFileName: 'linked-workspace.json',
    isFileSystemAccessSupported: true,
    newWorkspace: vi.fn(() => Promise.resolve()),
    importJsonFile: vi.fn((file: File) =>
      Promise.resolve({ fileName: file.name }),
    ),
    openLinkedWorkspace: vi.fn(() => Promise.resolve(null)),
    saveWorkspace: vi.fn(() => Promise.resolve(null)),
    saveWorkspaceAs: vi.fn(() => Promise.resolve(null)),
    restoreLinkedWorkspace: vi.fn(() =>
      Promise.resolve({ fileName: 'linked-workspace.json' }),
    ),
    startFresh: vi.fn(() => Promise.resolve()),
    cancelSaveConflict: vi.fn(),
    confirmOverwriteSaveConflict: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  };
};

describe('useWorkspaceConflictDialogController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the latest linked workspace and uses the persistence facade file name', async () => {
    const setNotification = vi.fn();
    const persistence = createPersistence({
      restoreLinkedWorkspace: vi.fn(() =>
        Promise.resolve({ fileName: 'bootstrap-linked.json' }),
      ),
    });

    const { result } = renderHook(() =>
      useWorkspaceConflictDialogController({
        persistence,
        setNotification,
      }),
    );

    act(() => {
      result.current.conflictDialogProps.onLoadLatestFromFile();
    });

    await waitFor(() => {
      expect(persistence.restoreLinkedWorkspace).toHaveBeenCalledTimes(1);
      expect(setNotification).toHaveBeenLastCalledWith({
        kind: 'success',
        message: 'JSONを「bootstrap-linked.json」から読み込みました。',
      });
    });
  });

  it('tracks busy state for the conflict dialog while confirming overwrite', async () => {
    const setNotification = vi.fn();
    let resolveOverwrite: (value: { fileName: string } | null) => void = () =>
      undefined;
    const overwritePromise = new Promise<{ fileName: string } | null>(
      (resolve) => {
        resolveOverwrite = resolve;
      },
    );
    const persistence = createPersistence({
      pendingSaveConflict: {
        fileName: 'linked-workspace.json',
        lastKnownModifiedAt: 100,
        linkedFileModifiedAt: 200,
      },
      confirmOverwriteSaveConflict: vi.fn(() => overwritePromise),
    });

    const { result } = renderHook(() =>
      useWorkspaceConflictDialogController({
        persistence,
        setNotification,
      }),
    );

    act(() => {
      result.current.conflictDialogProps.onConfirmOverwrite();
    });

    await waitFor(() => {
      expect(result.current.conflictDialogProps.isBusy).toBe(true);
    });

    resolveOverwrite({ fileName: 'linked-workspace.json' });

    await waitFor(() => {
      expect(result.current.conflictDialogProps.isBusy).toBe(false);
    });

    expect(setNotification).toHaveBeenLastCalledWith({
      kind: 'success',
      message: 'JSONを「linked-workspace.json」に保存しました。',
    });
  });
});
