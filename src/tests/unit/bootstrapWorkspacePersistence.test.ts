import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WorkspaceAutosavePayload,
  WorkspaceDocument,
} from '../../domain/workspaceContract';
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
      length: 0.9,
      width: 0.7,
      acceleration: 5,
      deceleration: 5,
      maxVelocity: 2,
      centripetalAcceleration: 5,
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

const createWorkspaceJson = (workspace: WorkspaceDocument): string => {
  return JSON.stringify({
    version: 1,
    coordinateSystem: 'ros-x-up-y-left',
    document: workspace,
  });
};

const createLinkedHandle = (options?: {
  fileName?: string;
  fileText?: string;
  lastModified?: number;
}) => {
  const {
    fileName = 'linked-workspace.json',
    fileText = createWorkspaceJson(createWorkspaceDocument()),
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
    mockedLoadWorkspacePersistence.mockReset();
    mockedLoadLinkedFileHandle.mockReset();
  });

  it('loads workspace persistence fresh on each invocation', async () => {
    const workspace = createAutosavePayload();
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
      linkedFileUnreadable: false,
      linkedFileName: null,
    });
    await expect(secondLoad).resolves.toEqual({
      kind: 'autosave-only',
      autosave: workspace,
      savedAt: 1_762_000_000_000,
      linkedFileUnreadable: false,
      linkedFileName: null,
    });
    expect(mockedLoadWorkspacePersistence).toHaveBeenCalledTimes(2);
    expect(mockedLoadLinkedFileHandle).toHaveBeenCalledTimes(2);
  });

  it('retries cleanly after an error without requiring an explicit reset', async () => {
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

  it('returns fresh results on later calls without any reset helper', async () => {
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

    await expect(bootstrapWorkspacePersistence()).resolves.toEqual({
      kind: 'recovered',
      reason: 'corrupt',
      cleared: true,
    });
    expect(mockedLoadWorkspacePersistence).toHaveBeenCalledTimes(2);
  });

  it('returns a conflict candidate when autosave and linked file both exist', async () => {
    const autosaveWorkspace = createAutosavePayload();
    const linkedBaseWorkspace = createWorkspaceDocument();
    const linkedWorkspace = {
      ...linkedBaseWorkspace,
      robotSettings: {
        ...linkedBaseWorkspace.robotSettings,
        length: 1.25,
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
        robotSettings: {
          length: 1.25,
        },
      },
    });
  });

  it('falls back to autosave-only when the linked file cannot be read', async () => {
    const workspace = createAutosavePayload();

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
      linkedFileUnreadable: true,
      linkedFileName: 'linked-workspace.json',
    });
  });

  it('marks the linked file unreadable when parsing the linked file fails', async () => {
    const workspace = createAutosavePayload();

    mockedLoadWorkspacePersistence.mockResolvedValue({
      kind: 'loaded',
      workspace,
      savedAt: 1_762_000_000_000,
    });
    mockedLoadLinkedFileHandle.mockResolvedValue(
      createLinkedHandle({
        fileText: '{"version":2,"document":',
      }),
    );

    await expect(bootstrapWorkspacePersistence()).resolves.toEqual({
      kind: 'autosave-only',
      autosave: workspace,
      savedAt: 1_762_000_000_000,
      linkedFileUnreadable: true,
      linkedFileName: 'linked-workspace.json',
    });
  });
});
