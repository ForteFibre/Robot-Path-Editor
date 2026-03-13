import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorInstance } from '../../errors';
import type {
  WorkspaceAutosavePayload,
  WorkspaceDocument,
} from '../../domain/workspaceContract';
import type {
  WorkspaceAutosaveState,
  WorkspacePersistenceBootstrapResult,
  WorkspacePersistenceRestoreCandidate,
} from '../../features/persistence/types';
import { bootstrapWorkspacePersistence } from '../../features/persistence/bootstrapWorkspacePersistence';
import { useWorkspaceFileLink } from '../../features/persistence/useWorkspaceFileLink';
import { useWorkspacePersistence } from '../../features/persistence/useWorkspacePersistence';
import { useWorkspacePersistenceController } from '../../features/persistence/useWorkspacePersistenceController';
import { useWorkspaceStore } from '../../store/workspaceStore';

vi.mock('../../features/persistence/bootstrapWorkspacePersistence', () => {
  return {
    bootstrapWorkspacePersistence: vi.fn(),
  };
});

vi.mock('../../features/persistence/useWorkspacePersistenceController', () => {
  return {
    useWorkspacePersistenceController: vi.fn(),
  };
});

vi.mock('../../features/persistence/useWorkspaceFileLink', () => {
  return {
    useWorkspaceFileLink: vi.fn(),
  };
});

type MockController = {
  autosaveState: WorkspaceAutosaveState;
  isRestoreDialogOpen: boolean;
  isRestoreDialogBusy: boolean;
  restoreCandidate: WorkspacePersistenceRestoreCandidate | null;
  handleImportJsonSource: (
    source: string,
    options?: { closeRestoreDialog?: boolean },
  ) => Promise<void>;
  handleNewWorkspace: () => Promise<void>;
  handleImportJson: (file: File) => Promise<void>;
  handleStartFresh: () => Promise<void>;
  handleRestoreLastEdit: () => Promise<void>;
  handleRestoreDialogFileLoad: (file: File) => Promise<void>;
};

type MockWorkspaceFileLink = {
  clearLink: () => Promise<void>;
  confirmOverwrite: () => Promise<FileSystemFileHandle | null>;
  isSupported: boolean;
  linkedFileHandle: FileSystemFileHandle | null;
  linkedFileName: string | null;
  loadLatestFromLinkedFile: () => Promise<boolean>;
  openWithFilePicker: () => Promise<FileSystemFileHandle | null>;
  pendingSaveConflict: {
    fileName: string;
    lastKnownModifiedAt: number;
    linkedFileModifiedAt: number;
  } | null;
  cancelSaveConflict: () => void;
  save: () => Promise<FileSystemFileHandle | null>;
  saveAs: () => Promise<FileSystemFileHandle | null>;
};

type SerializedWorkspaceSnapshot = {
  version: number;
  coordinateSystem: string;
  document: {
    robotSettings: {
      length: number;
    };
  };
};

type SerializedWorkspaceRobotSettingsSnapshot = {
  document: {
    robotSettings: {
      length: number;
    };
  };
};

const createWorkspaceDocument = (): WorkspaceDocument => {
  return {
    domain: {
      paths: [],
      points: [],
      lockedPointIds: [],
      activePathId: 'path-1',
    },
    backgroundImage: null,
    robotSettings: {
      length: 1,
      width: 1,
      acceleration: 1,
      deceleration: 1,
      maxVelocity: 1,
      centripetalAcceleration: 1,
    },
  };
};

const createAutosavePayload = (): WorkspaceAutosavePayload => {
  return {
    document: createWorkspaceDocument(),
    session: {
      mode: 'path',
      tool: 'select',
      selection: {
        pathId: null,
        waypointId: null,
        headingKeyframeId: null,
        sectionIndex: null,
      },
      canvasTransform: {
        x: 0,
        y: 0,
        k: 50,
      },
      robotPreviewEnabled: true,
    },
  };
};

const createRestoreCandidate = (): WorkspacePersistenceRestoreCandidate => {
  return {
    kind: 'autosave-only',
    autosave: createAutosavePayload(),
    savedAt: 1_762_000_000_000,
    linkedFileUnreadable: false,
    linkedFileName: null,
  };
};

const createConflictBootstrapResult =
  (): WorkspacePersistenceBootstrapResult => {
    return {
      kind: 'conflict',
      autosave: createRestoreCandidate().autosave,
      autoSavedAt: 1_762_000_000_000,
      linkedFile: createWorkspaceDocument(),
      linkedFileModifiedAt: 1_762_000_010_000,
      linkedFileName: 'bootstrap-linked.json',
    };
  };

const createConflictRestoreCandidate =
  (): WorkspacePersistenceRestoreCandidate => {
    const bootstrapResult = createConflictBootstrapResult();

    if (bootstrapResult.kind !== 'conflict') {
      throw new TypeError('expected conflict bootstrap result');
    }

    return bootstrapResult;
  };

const createController = (
  overrides?: Partial<MockController>,
): MockController => {
  return {
    autosaveState: {
      kind: 'idle',
      savedAt: null,
      error: null,
    },
    isRestoreDialogOpen: false,
    isRestoreDialogBusy: false,
    restoreCandidate: null,
    handleImportJsonSource: vi.fn(() => Promise.resolve()),
    handleNewWorkspace: vi.fn(() => Promise.resolve()),
    handleImportJson: vi.fn(() => Promise.resolve()),
    handleStartFresh: vi.fn(() => Promise.resolve()),
    handleRestoreLastEdit: vi.fn(() => Promise.resolve()),
    handleRestoreDialogFileLoad: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
};

const createWorkspaceFileLink = (
  overrides?: Partial<MockWorkspaceFileLink>,
): MockWorkspaceFileLink => {
  return {
    clearLink: vi.fn(() => Promise.resolve()),
    confirmOverwrite: vi.fn(() => Promise.resolve(null)),
    isSupported: true,
    linkedFileHandle: null,
    linkedFileName: 'linked-workspace.json',
    loadLatestFromLinkedFile: vi.fn(() => Promise.resolve(true)),
    openWithFilePicker: vi.fn(() => Promise.resolve(null)),
    pendingSaveConflict: null,
    cancelSaveConflict: vi.fn(),
    save: vi.fn(() => Promise.resolve(null)),
    saveAs: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  };
};

describe('useWorkspacePersistence', () => {
  const mockedBootstrapWorkspacePersistence = vi.mocked(
    bootstrapWorkspacePersistence,
  );
  const mockedUseWorkspacePersistenceController = vi.mocked(
    useWorkspacePersistenceController,
  );
  const mockedUseWorkspaceFileLink = vi.mocked(useWorkspaceFileLink);
  const parseJson = (source: string): unknown => {
    return JSON.parse(source) as unknown;
  };
  const getLatestWorkspaceFileLinkOptions = (): Parameters<
    typeof useWorkspaceFileLink
  >[0] => {
    const latestCall = mockedUseWorkspaceFileLink.mock.calls.at(-1);

    if (latestCall === undefined) {
      throw new TypeError('expected useWorkspaceFileLink to be called');
    }

    return latestCall[0];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseWorkspacePersistenceController.mockReturnValue(createController());
    mockedUseWorkspaceFileLink.mockReturnValue(createWorkspaceFileLink());
  });

  it('runs bootstrap on mount and emits a recovered notice notification', async () => {
    const setNotification = vi.fn();

    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'recovered',
      reason: 'corrupt',
      cleared: true,
    });

    const { result } = renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(mockedBootstrapWorkspacePersistence).toHaveBeenCalledTimes(1);
      expect(setNotification).toHaveBeenCalledWith({
        kind: 'info',
        message: '保存データが破損していたため自動削除して起動しました。',
      });
    });

    expect(result.current.recoveredNotification).toEqual({
      kind: 'info',
      message: '保存データが破損していたため自動削除して起動しました。',
    });
  });

  it('shows an info notification when the previous linked file cannot be read at startup', async () => {
    const setNotification = vi.fn();

    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'autosave-only',
      autosave: createAutosavePayload(),
      savedAt: 1_762_000_000_000,
      linkedFileUnreadable: true,
      linkedFileName: 'linked-workspace.json',
    });

    renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(setNotification).toHaveBeenCalledWith({
        kind: 'info',
        message:
          '前回リンクしたファイル「linked-workspace.json」を読み込めませんでした。自動保存データのみ復元できます。',
      });
    });
  });

  it('passes a serializer callback to useWorkspaceFileLink that reads the latest workspace document', async () => {
    const setNotification = vi.fn();
    const controller = createController();

    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'no-restore',
    });
    mockedUseWorkspacePersistenceController.mockReturnValue(controller);

    renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(mockedUseWorkspaceFileLink).toHaveBeenCalled();
    });

    const initialOptions = getLatestWorkspaceFileLinkOptions();
    expect(initialOptions.importWorkspaceJsonSource).toBe(
      controller.handleImportJsonSource,
    );
    const initialSerialized = parseJson(
      initialOptions.getSerializedWorkspace(),
    ) as SerializedWorkspaceSnapshot;
    expect(initialSerialized.version).toBe(1);
    expect(initialSerialized.coordinateSystem).toBe('ros-x-up-y-left');
    expect(typeof initialSerialized.document.robotSettings.length).toBe(
      'number',
    );

    act(() => {
      useWorkspaceStore.setState((state) => ({
        ui: {
          ...state.ui,
          robotSettings: {
            ...state.ui.robotSettings,
            length: 9,
          },
        },
      }));
    });

    await waitFor(() => {
      const updatedOptions = getLatestWorkspaceFileLinkOptions();
      const updatedSerialized = parseJson(
        updatedOptions.getSerializedWorkspace(),
      ) as SerializedWorkspaceRobotSettingsSnapshot;

      expect(updatedSerialized.document.robotSettings.length).toBe(9);
    });
  });

  it('runs bootstrap separately for each mounted hook instance', async () => {
    const setNotification = vi.fn();

    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'no-restore',
    });

    const firstRender = renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(mockedBootstrapWorkspacePersistence).toHaveBeenCalledTimes(1);
    });

    firstRender.unmount();

    renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(mockedBootstrapWorkspacePersistence).toHaveBeenCalledTimes(2);
    });
  });

  it('converts autosave errors into AppNotification error payloads', async () => {
    const setNotification = vi.fn();
    const autosaveError = {
      kind: 'autosave',
      reason: 'write-failed',
    } as const;

    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'no-restore',
    });
    mockedUseWorkspacePersistenceController.mockImplementation(
      (bootstrapResult) => {
        return createController({
          autosaveState:
            bootstrapResult === null
              ? {
                  kind: 'idle',
                  savedAt: null,
                  error: null,
                }
              : {
                  kind: 'error',
                  savedAt: 123,
                  error: autosaveError,
                },
        });
      },
    );

    renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    await waitFor(() => {
      expect(setNotification).toHaveBeenCalledWith({
        kind: 'error',
        error: autosaveError,
      });
    });
  });

  it('clears the linked file inside newWorkspace', async () => {
    const setNotification = vi.fn();
    const controller = createController();
    const workspaceFileLink = createWorkspaceFileLink();

    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'no-restore',
    });
    mockedUseWorkspacePersistenceController.mockReturnValue(controller);
    mockedUseWorkspaceFileLink.mockReturnValue(workspaceFileLink);

    const { result } = renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.newWorkspace();
    });

    expect(controller.handleNewWorkspace).toHaveBeenCalledTimes(1);
    expect(workspaceFileLink.clearLink).toHaveBeenCalledTimes(1);
  });

  it('builds restore dialog props that start fresh and clear linked files', async () => {
    const setNotification = vi.fn();
    const controller = createController({
      restoreCandidate: createRestoreCandidate(),
    });
    const workspaceFileLink = createWorkspaceFileLink();

    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'autosave-only',
      autosave: createRestoreCandidate().autosave,
      savedAt: 1_762_000_000_000,
      linkedFileUnreadable: false,
      linkedFileName: null,
    });
    mockedUseWorkspacePersistenceController.mockReturnValue(controller);
    mockedUseWorkspaceFileLink.mockReturnValue(workspaceFileLink);

    const { result } = renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    act(() => {
      result.current.restoreDialog.onStartFresh();
    });

    await waitFor(() => {
      expect(controller.handleStartFresh).toHaveBeenCalledTimes(1);
      expect(workspaceFileLink.clearLink).toHaveBeenCalledTimes(1);
    });
  });

  it('uses the bootstrap linked file name when restoring from the startup conflict dialog', async () => {
    const setNotification = vi.fn();
    const controller = createController({
      restoreCandidate: createConflictRestoreCandidate(),
    });
    const workspaceFileLink = createWorkspaceFileLink({
      linkedFileName: null,
      loadLatestFromLinkedFile: vi.fn(() => Promise.resolve(true)),
    });

    mockedBootstrapWorkspacePersistence.mockResolvedValue(
      createConflictBootstrapResult(),
    );
    mockedUseWorkspacePersistenceController.mockReturnValue(controller);
    mockedUseWorkspaceFileLink.mockReturnValue(workspaceFileLink);

    const { result } = renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    act(() => {
      result.current.restoreDialog.onRestoreLinkedFile();
    });

    await waitFor(() => {
      expect(workspaceFileLink.loadLatestFromLinkedFile).toHaveBeenCalledTimes(
        1,
      );
      expect(setNotification).toHaveBeenLastCalledWith({
        kind: 'success',
        message: 'JSONを「bootstrap-linked.json」から読み込みました。',
      });
    });
  });

  it('maps restore dialog import errors to notifications', async () => {
    const setNotification = vi.fn();
    const controller = createController({
      restoreCandidate: createRestoreCandidate(),
      handleRestoreDialogFileLoad: vi.fn(() =>
        Promise.reject(
          new AppErrorInstance({
            kind: 'workspace-import',
            reason: 'invalid-format',
          }),
        ),
      ),
    });

    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'autosave-only',
      autosave: createRestoreCandidate().autosave,
      savedAt: 1_762_000_000_000,
      linkedFileUnreadable: false,
      linkedFileName: null,
    });
    mockedUseWorkspacePersistenceController.mockReturnValue(controller);

    const { result } = renderHook(() =>
      useWorkspacePersistence({
        setNotification,
      }),
    );

    await act(async () => {
      await result.current.restoreDialog.onLoadFromFile(
        new File(['{}'], 'workspace.json', { type: 'application/json' }),
      );
    });

    expect(setNotification).toHaveBeenCalledWith({
      kind: 'error',
      error: {
        kind: 'workspace-import',
        reason: 'invalid-format',
      },
    });
  });
});
