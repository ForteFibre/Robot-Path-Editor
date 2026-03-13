import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePersistenceFacade } from '../../features/persistence/types';
import { useWorkspaceFileCommands } from '../../features/workspace-file/useWorkspaceFileCommands';

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

describe('useWorkspaceFileCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the linked workspace and emits a success notification', async () => {
    const setNotification = vi.fn();
    const persistence = createPersistence({
      saveWorkspace: vi.fn(() =>
        Promise.resolve({
          fileName: 'linked-workspace.json',
        }),
      ),
    });

    const { result } = renderHook(() =>
      useWorkspaceFileCommands({
        persistence,
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.workspaceCommands.save();
    });

    expect(persistence.saveWorkspace).toHaveBeenCalledTimes(1);
    expect(setNotification).toHaveBeenNthCalledWith(1, null);
    expect(setNotification).toHaveBeenNthCalledWith(2, {
      kind: 'success',
      message: 'JSONを「linked-workspace.json」に保存しました。',
    });
  });

  it('reports downloads for save in unsupported browsers', async () => {
    const setNotification = vi.fn();
    const persistence = createPersistence({
      isFileSystemAccessSupported: false,
      saveWorkspace: vi.fn(() =>
        Promise.resolve({
          fileName: 'workspace.json',
        }),
      ),
    });

    const { result } = renderHook(() =>
      useWorkspaceFileCommands({
        persistence,
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.workspaceCommands.save();
    });

    expect(setNotification).toHaveBeenLastCalledWith({
      kind: 'success',
      message: 'workspace.json をダウンロードしました。',
    });
  });

  it('starts a new workspace via persistence and emits a success notification', async () => {
    const setNotification = vi.fn();
    const persistence = createPersistence();

    const { result } = renderHook(() =>
      useWorkspaceFileCommands({
        persistence,
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.workspaceCommands.newWorkspace();
    });

    expect(persistence.newWorkspace).toHaveBeenCalledTimes(1);
    expect(setNotification).toHaveBeenLastCalledWith({
      kind: 'success',
      message: '新しいワークスペースを開始しました。',
    });
  });
});
