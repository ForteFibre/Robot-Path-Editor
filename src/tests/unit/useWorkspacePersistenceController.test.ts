import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorInstance } from '../../errors/appError';
import { deleteWorkspacePersistence } from '../../io/workspacePersistence';
import type {
  WorkspaceAutosavePayload,
  WorkspaceDocument,
} from '../../domain/workspaceContract';
import type {
  WorkspacePersistenceBootstrapResult,
  WorkspacePersistenceRestoreCandidate,
} from '../../features/persistence/types';
import { useWorkspaceAutosave } from '../../features/persistence/useWorkspaceAutosave';
import { useWorkspacePersistenceController } from '../../features/persistence/useWorkspacePersistenceController';
import { useWorkspacePersistenceStoreActions } from '../../features/persistence/useWorkspacePersistenceStoreActions';

vi.mock('../../io/workspacePersistence', () => ({
  deleteWorkspacePersistence: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../features/persistence/useWorkspaceAutosave', () => ({
  useWorkspaceAutosave: vi.fn(),
}));

vi.mock(
  '../../features/persistence/useWorkspacePersistenceStoreActions',
  () => ({
    useWorkspacePersistenceStoreActions: vi.fn(),
  }),
);

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

const createAutosaveOnlyBootstrapResult = (): Extract<
  WorkspacePersistenceBootstrapResult,
  { kind: 'autosave-only' }
> => {
  return {
    kind: 'autosave-only',
    autosave: createAutosavePayload(),
    savedAt: 1_762_000_000_000,
    linkedFileUnreadable: false,
    linkedFileName: null,
  };
};

const createConflictBootstrapResult = (): Extract<
  WorkspacePersistenceBootstrapResult,
  { kind: 'conflict' }
> => {
  return {
    kind: 'conflict',
    autosave: createAutosavePayload(),
    autoSavedAt: 1_762_000_010_000,
    linkedFile: createWorkspaceDocument(),
    linkedFileModifiedAt: 1_762_000_020_000,
    linkedFileName: 'linked-workspace.json',
  };
};

type MockAutosave = {
  autosaveState: ReturnType<typeof useWorkspaceAutosave>['autosaveState'];
  cancelPendingSave: ReturnType<typeof vi.fn<() => void>>;
  saveNow: ReturnType<typeof vi.fn<() => Promise<{ savedAt: number }>>>;
  setIdleState: ReturnType<typeof vi.fn<(savedAt: number | null) => void>>;
  syncTrackedState: ReturnType<typeof vi.fn<() => void>>;
};

type MockStoreActions = {
  importWorkspaceDocument: ReturnType<
    typeof vi.fn<(document: WorkspaceDocument) => void>
  >;
  resetWorkspace: ReturnType<typeof vi.fn<() => void>>;
  restoreWorkspaceAutosave: ReturnType<
    typeof vi.fn<(payload: WorkspaceAutosavePayload) => void>
  >;
};

const createMockAutosave = (
  overrides: Partial<MockAutosave> = {},
): MockAutosave => {
  return {
    autosaveState: {
      kind: 'idle',
      savedAt: null,
      error: null,
    },
    cancelPendingSave: vi.fn(),
    saveNow: vi.fn(() => Promise.resolve({ savedAt: 123 })),
    setIdleState: vi.fn(),
    syncTrackedState: vi.fn(),
    ...overrides,
  };
};

describe('useWorkspacePersistenceController', () => {
  const mockedDeleteWorkspacePersistence = vi.mocked(
    deleteWorkspacePersistence,
  );
  const mockedUseWorkspaceAutosave = vi.mocked(useWorkspaceAutosave);
  const mockedUseWorkspacePersistenceStoreActions = vi.mocked(
    useWorkspacePersistenceStoreActions,
  );
  let storeActions: MockStoreActions;
  let autosave: MockAutosave;

  beforeEach(() => {
    vi.resetAllMocks();

    mockedDeleteWorkspacePersistence.mockResolvedValue(undefined);

    storeActions = {
      importWorkspaceDocument: vi.fn(),
      resetWorkspace: vi.fn(),
      restoreWorkspaceAutosave: vi.fn(),
    };
    autosave = createMockAutosave();

    mockedUseWorkspacePersistenceStoreActions.mockReturnValue(
      storeActions as ReturnType<typeof useWorkspacePersistenceStoreActions>,
    );

    mockedUseWorkspaceAutosave.mockReturnValue(
      autosave as ReturnType<typeof useWorkspaceAutosave>,
    );
  });

  it.each([
    ['autosave-only', createAutosaveOnlyBootstrapResult(), 1_762_000_000_000],
    ['conflict', createConflictBootstrapResult(), 1_762_000_010_000],
    ['no-restore', { kind: 'no-restore' } as const, null],
  ])(
    'initializes restore candidate from bootstrap result: %s',
    (
      _label,
      bootstrapResult: WorkspacePersistenceBootstrapResult,
      expectedSavedAt: number | null,
    ) => {
      const { result } = renderHook(() =>
        useWorkspacePersistenceController(bootstrapResult),
      );

      const expectedCandidate: WorkspacePersistenceRestoreCandidate | null =
        bootstrapResult.kind === 'autosave-only' ||
        bootstrapResult.kind === 'conflict'
          ? bootstrapResult
          : null;

      expect(result.current.restoreCandidate).toEqual(expectedCandidate);
      expect(result.current.isRestoreDialogOpen).toBe(
        expectedCandidate !== null,
      );
      expect(mockedUseWorkspaceAutosave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          initialSavedAt: expectedSavedAt,
        }),
      );
    },
  );

  it('suppresses autosave while bootstrap result is unresolved', () => {
    renderHook(() => useWorkspacePersistenceController(null));

    expect(mockedUseWorkspaceAutosave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isSuppressed: true,
      }),
    );
  });

  it('suppresses autosave while there is a restore candidate', () => {
    renderHook(() =>
      useWorkspacePersistenceController(createAutosaveOnlyBootstrapResult()),
    );

    expect(mockedUseWorkspaceAutosave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isSuppressed: true,
      }),
    );
  });

  it('suppresses autosave while workspace mutation is running', async () => {
    let resolveDelete: () => void = () => undefined;
    mockedDeleteWorkspacePersistence.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useWorkspacePersistenceController({ kind: 'no-restore' }),
    );

    expect(mockedUseWorkspaceAutosave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isSuppressed: false,
      }),
    );

    act(() => {
      void result.current.handleNewWorkspace();
    });

    await waitFor(() => {
      expect(mockedUseWorkspaceAutosave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isSuppressed: true,
        }),
      );
    });

    resolveDelete();

    await waitFor(() => {
      expect(mockedUseWorkspaceAutosave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isSuppressed: false,
        }),
      );
    });
  });

  it('maps invalid JSON import source to workspace-import/invalid-format', async () => {
    const { result } = renderHook(() =>
      useWorkspacePersistenceController({ kind: 'no-restore' }),
    );

    const importPromise =
      result.current.handleImportJsonSource('this is not json');

    await expect(importPromise).rejects.toBeInstanceOf(AppErrorInstance);
    await expect(importPromise).rejects.toMatchObject({
      appError: {
        kind: 'workspace-import',
        reason: 'invalid-format',
      },
    });

    expect(storeActions.importWorkspaceDocument).not.toHaveBeenCalled();
  });

  it('runs reset + persistence delete for new workspace and start fresh', async () => {
    const autosaveBootstrap = createAutosaveOnlyBootstrapResult();
    const { result } = renderHook(() =>
      useWorkspacePersistenceController(autosaveBootstrap),
    );

    await act(async () => {
      await result.current.handleNewWorkspace();
      await result.current.handleStartFresh();
    });

    expect(storeActions.resetWorkspace).toHaveBeenCalledTimes(2);
    expect(mockedDeleteWorkspacePersistence).toHaveBeenCalledTimes(2);

    const setIdleStateCalls = autosave.setIdleState.mock.calls;
    expect(setIdleStateCalls.at(-2)).toEqual([null]);
    expect(setIdleStateCalls.at(-1)).toEqual([null]);
  });

  it('restores last edit by applying autosave payload and closes restore dialog', async () => {
    const autosaveBootstrap = createAutosaveOnlyBootstrapResult();
    const { result } = renderHook(() =>
      useWorkspacePersistenceController(autosaveBootstrap),
    );

    await act(async () => {
      await result.current.handleRestoreLastEdit();
    });

    expect(storeActions.restoreWorkspaceAutosave).toHaveBeenCalledWith(
      autosaveBootstrap.autosave,
    );
    expect(autosave.setIdleState).toHaveBeenCalledWith(
      autosaveBootstrap.savedAt,
    );
    expect(result.current.restoreCandidate).toBeNull();
    expect(result.current.isRestoreDialogOpen).toBe(false);
  });
});
