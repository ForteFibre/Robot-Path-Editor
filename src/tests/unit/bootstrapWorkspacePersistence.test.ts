import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePersistedState } from '../../store/types';
import type { loadLinkedFileHandle } from '../../io/workspaceFileLinkPersistence';
import type { loadWorkspacePersistence } from '../../io/workspacePersistence';

vi.mock('../../io/workspacePersistence', () => {
  return {
    loadWorkspacePersistence: vi.fn(),
  };
});

vi.mock('../../io/workspaceFileLinkPersistence', () => {
  return {
    loadLinkedFileHandle: vi.fn(),
  };
});

const createWorkspace = (): WorkspacePersistedState => {
  return {
    domain: {
      paths: [],
      points: [],
      lockedPointIds: [],
      activePathId: 'path-1',
    },
    ui: {
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
      backgroundImage: null,
      robotPreviewEnabled: true,
      robotSettings: {
        length: 0.9,
        width: 0.7,
        acceleration: 5,
        deceleration: 5,
        maxVelocity: 2,
        centripetalAcceleration: 5,
      },
    },
  };
};

const createWorkspaceJson = (workspace: WorkspacePersistedState): string => {
  return JSON.stringify({
    version: 1,
    coordinateSystem: 'ros-x-up-y-left',
    workspace,
  });
};

const createLinkedHandle = (options?: {
  fileName?: string;
  fileText?: string;
  lastModified?: number;
}) => {
  const {
    fileName = 'linked-workspace.json',
    fileText = createWorkspaceJson(createWorkspace()),
    lastModified = 1_762_000_000_500,
  } = options ?? {};

  return {
    handle: {
      getFile: vi.fn(() =>
        Promise.resolve(
          new File([fileText], fileName, {
            type: 'application/json',
            lastModified,
          }),
        ),
      ),
      kind: 'file',
      name: fileName,
    } as unknown as FileSystemFileHandle,
    lastKnownModifiedAt: lastModified,
  };
};

describe('bootstrapWorkspacePersistence', () => {
  let bootstrapWorkspacePersistence: () => Promise<unknown>;
  let resetWorkspacePersistenceBootstrapForTests: () => void;
  let mockedLoadWorkspacePersistence: ReturnType<
    typeof vi.mocked<typeof loadWorkspacePersistence>
  >;
  let mockedLoadLinkedFileHandle: ReturnType<
    typeof vi.mocked<typeof loadLinkedFileHandle>
  >;

  beforeEach(async () => {
    vi.resetModules();

    const workspacePersistenceModule =
      await import('../../io/workspacePersistence');
    const workspaceFileLinkModule =
      await import('../../io/workspaceFileLinkPersistence');
    const bootstrapModule =
      await import('../../features/persistence/bootstrapWorkspacePersistence');

    mockedLoadWorkspacePersistence = vi.mocked(
      workspacePersistenceModule.loadWorkspacePersistence,
    );
    mockedLoadLinkedFileHandle = vi.mocked(
      workspaceFileLinkModule.loadLinkedFileHandle,
    );
    bootstrapWorkspacePersistence =
      bootstrapModule.bootstrapWorkspacePersistence;
    resetWorkspacePersistenceBootstrapForTests =
      bootstrapModule.resetWorkspacePersistenceBootstrapForTests;

    resetWorkspacePersistenceBootstrapForTests();
    mockedLoadWorkspacePersistence.mockReset();
    mockedLoadLinkedFileHandle.mockReset();
  });

  it('loads workspace persistence only once and reuses the same promise', async () => {
    const workspace = createWorkspace();
    mockedLoadWorkspacePersistence.mockResolvedValue({
      kind: 'loaded',
      workspace,
      savedAt: 1_762_000_000_000,
    });
    mockedLoadLinkedFileHandle.mockResolvedValue(null);

    const firstLoad = bootstrapWorkspacePersistence();
    const secondLoad = bootstrapWorkspacePersistence();

    await expect(firstLoad).resolves.toEqual({
      kind: 'autosave-only',
      autosave: workspace,
      savedAt: 1_762_000_000_000,
    });
    await expect(secondLoad).resolves.toEqual({
      kind: 'autosave-only',
      autosave: workspace,
      savedAt: 1_762_000_000_000,
    });
    expect(mockedLoadWorkspacePersistence).toHaveBeenCalledTimes(1);
    expect(mockedLoadLinkedFileHandle).toHaveBeenCalledTimes(1);
  });

  it('clears the cached promise after an error so a later retry can succeed', async () => {
    mockedLoadWorkspacePersistence
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce({ kind: 'missing' });
    mockedLoadLinkedFileHandle.mockResolvedValue(null);

    await expect(bootstrapWorkspacePersistence()).rejects.toThrow(
      'read failed',
    );
    await expect(bootstrapWorkspacePersistence()).resolves.toEqual({
      kind: 'no-restore',
    });
    expect(mockedLoadWorkspacePersistence).toHaveBeenCalledTimes(2);
  });

  it('allows tests to reset the bootstrap cache explicitly', async () => {
    mockedLoadWorkspacePersistence
      .mockResolvedValueOnce({ kind: 'missing' })
      .mockResolvedValueOnce({
        kind: 'recovered',
        reason: 'corrupt',
        cleared: true,
      });
    mockedLoadLinkedFileHandle.mockResolvedValue(null);

    await expect(bootstrapWorkspacePersistence()).resolves.toEqual({
      kind: 'no-restore',
    });

    resetWorkspacePersistenceBootstrapForTests();

    await expect(bootstrapWorkspacePersistence()).resolves.toEqual({
      kind: 'recovered',
      reason: 'corrupt',
      cleared: true,
    });
    expect(mockedLoadWorkspacePersistence).toHaveBeenCalledTimes(2);
  });

  it('returns a conflict candidate when autosave and linked file both exist', async () => {
    const autosaveWorkspace = createWorkspace();
    const linkedBaseWorkspace = createWorkspace();
    const linkedWorkspace = {
      ...linkedBaseWorkspace,
      ui: {
        ...linkedBaseWorkspace.ui,
        robotSettings: {
          ...linkedBaseWorkspace.ui.robotSettings,
          length: 1.25,
        },
      },
    };

    mockedLoadWorkspacePersistence.mockResolvedValue({
      kind: 'loaded',
      workspace: autosaveWorkspace,
      savedAt: 1_762_000_000_000,
    });
    mockedLoadLinkedFileHandle.mockResolvedValue(
      createLinkedHandle({
        fileText: createWorkspaceJson(linkedWorkspace),
        lastModified: 1_762_000_000_500,
      }),
    );

    await expect(bootstrapWorkspacePersistence()).resolves.toMatchObject({
      kind: 'conflict',
      autosave: autosaveWorkspace,
      autoSavedAt: 1_762_000_000_000,
      linkedFileModifiedAt: 1_762_000_000_500,
      linkedFileName: 'linked-workspace.json',
    });

    await expect(bootstrapWorkspacePersistence()).resolves.toMatchObject({
      linkedFile: {
        ui: {
          robotSettings: {
            length: 1.25,
          },
        },
      },
    });
  });

  it('falls back to autosave-only when the linked file cannot be read', async () => {
    const workspace = createWorkspace();

    mockedLoadWorkspacePersistence.mockResolvedValue({
      kind: 'loaded',
      workspace,
      savedAt: 1_762_000_000_000,
    });
    mockedLoadLinkedFileHandle.mockResolvedValue({
      handle: {
        getFile: vi.fn(() => Promise.reject(new Error('no access'))),
        kind: 'file',
        name: 'linked-workspace.json',
      } as unknown as FileSystemFileHandle,
      lastKnownModifiedAt: 1_762_000_000_500,
    });

    await expect(bootstrapWorkspacePersistence()).resolves.toEqual({
      kind: 'autosave-only',
      autosave: workspace,
      savedAt: 1_762_000_000_000,
    });
  });
});
