import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from '../../io/workspaceIO';
import { useWorkspaceFileLink } from '../../features/persistence/useWorkspaceFileLink';
import { useWorkspacePersistenceActions } from '../../features/persistence/useWorkspacePersistenceActions';
import type {
  WorkspacePersistenceBootstrapResult,
  WorkspacePersistenceRestoreCandidate,
} from '../../features/persistence/types';

vi.mock('../../io/workspaceIO', () => ({
  downloadText: vi.fn(),
}));

vi.mock('../../features/persistence/useWorkspaceFileLink', () => ({
  useWorkspaceFileLink: vi.fn(),
}));

type MockWorkspaceFileLink = ReturnType<typeof useWorkspaceFileLink>;

const createFileHandle = (name: string): FileSystemFileHandle => {
  return { name } as FileSystemFileHandle;
};

const createWorkspaceFileLinkResult = (
  overrides: Partial<MockWorkspaceFileLink> = {},
): MockWorkspaceFileLink => {
  return {
    cancelSaveConflict: vi.fn(),
    clearLink: vi.fn(() => Promise.resolve()),
    confirmOverwrite: vi.fn(() => Promise.resolve(null)),
    isSupported: true,
    linkedFileHandle: null,
    linkedFileName: 'linked-workspace.json',
    loadLatestFromLinkedFile: vi.fn(() => Promise.resolve(true)),
    openWithFilePicker: vi.fn(() => Promise.resolve(null)),
    pendingSaveConflict: null,
    save: vi.fn(() => Promise.resolve(null)),
    saveAs: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  };
};

const createConflictBootstrapResult = (
  linkedFileName = 'bootstrap-linked.json',
): WorkspacePersistenceBootstrapResult => {
  return {
    kind: 'conflict',
    autosave: {
      document: {
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
      },
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
    },
    autoSavedAt: 1_762_000_000_000,
    linkedFile: {
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
    },
    linkedFileModifiedAt: 1_762_000_010_000,
    linkedFileName,
  };
};

const createRestoreCandidate = (
  linkedFileName = 'restore-linked.json',
): WorkspacePersistenceRestoreCandidate => {
  const bootstrapResult = createConflictBootstrapResult(linkedFileName);

  if (bootstrapResult.kind !== 'conflict') {
    throw new TypeError('expected conflict bootstrap result');
  }

  return bootstrapResult;
};

const createOptions = (
  overrides: Partial<Parameters<typeof useWorkspacePersistenceActions>[0]> = {},
): Parameters<typeof useWorkspacePersistenceActions>[0] => {
  return {
    bootstrapResult: null,
    getSerializedWorkspace: vi.fn(() => '{"version":2}'),
    handleImportJson: vi.fn(() => Promise.resolve()),
    handleImportJsonSource: vi.fn(() => Promise.resolve()),
    handleNewWorkspace: vi.fn(() => Promise.resolve()),
    handleRestoreDialogFileLoad: vi.fn(() => Promise.resolve()),
    handleStartFresh: vi.fn(() => Promise.resolve()),
    restoreCandidate: null,
    ...overrides,
  };
};

describe('useWorkspacePersistenceActions', () => {
  const mockedDownloadText = vi.mocked(downloadText);
  const mockedUseWorkspaceFileLink = vi.mocked(useWorkspaceFileLink);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseWorkspaceFileLink.mockReturnValue(createWorkspaceFileLinkResult());
  });

  it('falls back to downloading the workspace when file system access is unsupported', async () => {
    mockedUseWorkspaceFileLink.mockReturnValue(
      createWorkspaceFileLinkResult({
        isSupported: false,
      }),
    );

    const { result } = renderHook(() =>
      useWorkspacePersistenceActions(createOptions()),
    );

    let actionResult = null;
    await act(async () => {
      actionResult = await result.current.saveWorkspace();
    });

    expect(actionResult).toEqual({ fileName: 'workspace.json' });
    expect(mockedDownloadText).toHaveBeenCalledWith(
      'workspace.json',
      '{"version":2}',
      'application/json',
    );
    expect(result.current.isFileSystemAccessSupported).toBe(false);
  });

  it('clears the linked file after creating a new workspace or importing json', async () => {
    const workspaceFileLink = createWorkspaceFileLinkResult();
    const options = createOptions();

    mockedUseWorkspaceFileLink.mockReturnValue(workspaceFileLink);

    const { result } = renderHook(() =>
      useWorkspacePersistenceActions(options),
    );

    await act(async () => {
      await result.current.newWorkspace();
      await result.current.importJsonFile(
        new File(['{}'], 'workspace.json', { type: 'application/json' }),
      );
    });

    expect(options.handleNewWorkspace).toHaveBeenCalledTimes(1);
    expect(options.handleImportJson).toHaveBeenCalledTimes(1);
    expect(workspaceFileLink.clearLink).toHaveBeenCalledTimes(2);
  });

  it('uses restore candidate and bootstrap names when no linked file is currently loaded', () => {
    type HookProps = {
      bootstrapResult: WorkspacePersistenceBootstrapResult | null;
      candidate: WorkspacePersistenceRestoreCandidate | null;
    };

    mockedUseWorkspaceFileLink.mockReturnValue(
      createWorkspaceFileLinkResult({
        linkedFileName: null,
      }),
    );

    const restoreCandidate = createRestoreCandidate('restore-name.json');
    const initialProps: HookProps = {
      bootstrapResult: null,
      candidate: restoreCandidate,
    };

    const { result, rerender } = renderHook(
      ({ bootstrapResult, candidate }: HookProps) =>
        useWorkspacePersistenceActions(
          createOptions({
            bootstrapResult,
            restoreCandidate: candidate,
          }),
        ),
      {
        initialProps,
      },
    );

    expect(result.current.linkedFileName).toBe('restore-name.json');

    rerender({
      bootstrapResult: createConflictBootstrapResult('bootstrap-name.json'),
      candidate: null,
    });

    expect(result.current.linkedFileName).toBe('bootstrap-name.json');
  });

  it('maps linked-file restore and overwrite confirmation results to filenames', async () => {
    mockedUseWorkspaceFileLink.mockReturnValue(
      createWorkspaceFileLinkResult({
        linkedFileName: null,
        loadLatestFromLinkedFile: vi.fn(() => Promise.resolve(true)),
        confirmOverwrite: vi.fn(() =>
          Promise.resolve(createFileHandle('confirmed-save.json')),
        ),
      }),
    );

    const { result } = renderHook(() =>
      useWorkspacePersistenceActions(
        createOptions({
          restoreCandidate: createRestoreCandidate('restore-linked.json'),
        }),
      ),
    );

    let restoredResult = null;
    let confirmedResult = null;
    await act(async () => {
      restoredResult = await result.current.restoreLinkedWorkspace();
      confirmedResult = await result.current.confirmOverwriteSaveConflict();
    });

    expect(restoredResult).toEqual({ fileName: 'restore-linked.json' });
    expect(confirmedResult).toEqual({ fileName: 'confirmed-save.json' });
  });
});
