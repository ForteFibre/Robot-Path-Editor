import { createPoint } from '../../domain/factories';
import { PATH_EDITOR_DB_NAME, putIndexedDbRecord } from '../../io/indexedDb';
import {
  ACTIVE_WORKSPACE_PERSISTENCE_KEY,
  deleteWorkspacePersistence,
  loadWorkspacePersistence,
  saveWorkspacePersistence,
} from '../../io/workspacePersistence';
import { createInitialDomainState } from '../../store/slices/pathSlice';
import { createInitialUiState } from '../../store/slices/uiSlice';
import type { WorkspaceAutosavePayload } from '../../domain/workspaceContract';
import { normalizeWorkspaceAutosavePayload } from '../../domain/workspaceNormalization';
import * as indexedDb from '../../io/indexedDb';

const deleteTestDatabase = async (): Promise<void> => {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PATH_EDITOR_DB_NAME);

    request.onsuccess = () => {
      resolve(undefined);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to delete IndexedDB test DB'));
    };

    request.onblocked = () => {
      reject(new Error('Deleting IndexedDB test DB was blocked'));
    };
  });
};

const createWorkspaceFixture = (options?: {
  backgroundImageUrl?: string;
}): WorkspaceAutosavePayload => {
  const backgroundImageUrl = options?.backgroundImageUrl;
  const hasBackgroundImage = backgroundImageUrl !== undefined;
  const domain = createInitialDomainState();
  const ui = createInitialUiState();
  const primaryPath = domain.paths[0];

  if (primaryPath === undefined) {
    throw new Error('workspace fixture missing path');
  }

  const libraryPoint = createPoint({
    id: 'library-persisted-point',
    x: 1.5,
    y: -0.25,
    robotHeading: 45,
    isLibrary: true,
    name: 'Persisted Library Point',
  });

  const linkedPoint = createPoint({
    id: 'linked-persisted-point',
    x: libraryPoint.x,
    y: libraryPoint.y,
    robotHeading: null,
    isLibrary: false,
    name: 'Linked Local Name',
  });

  domain.points.push(libraryPoint, linkedPoint);
  primaryPath.waypoints = [
    {
      id: 'persisted-waypoint-1',
      pointId: linkedPoint.id,
      libraryPointId: libraryPoint.id,
      pathHeading: 15,
    },
  ];
  primaryPath.headingKeyframes = [
    {
      id: 'persisted-heading-1',
      sectionIndex: 0,
      sectionRatio: 0,
      robotHeading: 15,
      name: 'Persisted Heading',
    },
  ];
  primaryPath.sectionRMin = [0.08];

  return {
    document: {
      domain,
      backgroundImage: hasBackgroundImage
        ? {
            url: backgroundImageUrl,
            width: 4096,
            height: 2048,
            x: 12.5,
            y: -8.25,
            scale: 0.5,
            alpha: 0.65,
          }
        : ui.backgroundImage,
      robotSettings: {
        ...ui.robotSettings,
        length: 1.2,
        width: 0.9,
        maxVelocity: 3.6,
      },
    },
    session: {
      mode: 'path',
      tool: hasBackgroundImage ? 'edit-image' : ui.tool,
      selection: {
        pathId: domain.activePathId,
        waypointId: null,
        headingKeyframeId: null,
        sectionIndex: 0,
      },
      canvasTransform: {
        ...ui.canvasTransform,
        x: 120,
        y: 80,
        k: 48,
      },
      robotPreviewEnabled: false,
    },
  };
};

describe('workspace persistence', () => {
  beforeEach(async () => {
    await deleteTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteTestDatabase();
  });

  it('saves and loads a serialized workspace round-trip', async () => {
    const workspace = createWorkspaceFixture();
    const expectedWorkspace = normalizeWorkspaceAutosavePayload(workspace);
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_762_000_000_000);

    const saved = await saveWorkspacePersistence(workspace);
    const loaded = await loadWorkspacePersistence();

    expect(saved).toEqual({ savedAt: 1_762_000_000_000 });
    expect(loaded).toEqual({
      kind: 'loaded',
      workspace: expectedWorkspace,
      savedAt: 1_762_000_000_000,
    });

    nowSpy.mockRestore();
  });

  it('returns missing after deleting a saved workspace', async () => {
    await saveWorkspacePersistence(createWorkspaceFixture());

    await deleteWorkspacePersistence();

    await expect(loadWorkspacePersistence()).resolves.toEqual({
      kind: 'missing',
    });
  });

  it('returns missing when no persisted data exists', async () => {
    await expect(loadWorkspacePersistence()).resolves.toEqual({
      kind: 'missing',
    });
  });

  it('recovers from corrupt JSON by clearing the persisted record', async () => {
    await putIndexedDbRecord({
      key: ACTIVE_WORKSPACE_PERSISTENCE_KEY,
      savedAt: 123,
      payloadJson: '{"workspace":',
    });

    await expect(loadWorkspacePersistence()).resolves.toEqual({
      kind: 'recovered',
      reason: 'corrupt',
      cleared: true,
    });
    await expect(loadWorkspacePersistence()).resolves.toEqual({
      kind: 'missing',
    });
  });

  it('recovers from unsupported workspace format by clearing the persisted record', async () => {
    await putIndexedDbRecord({
      key: ACTIVE_WORKSPACE_PERSISTENCE_KEY,
      savedAt: 456,
      payloadJson: JSON.stringify({
        version: 99,
        coordinateSystem: 'ros-x-up-y-left',
        workspace: createWorkspaceFixture(),
      }),
    });

    await expect(loadWorkspacePersistence()).resolves.toEqual({
      kind: 'recovered',
      reason: 'unsupported-format',
      cleared: true,
    });
    await expect(loadWorkspacePersistence()).resolves.toEqual({
      kind: 'missing',
    });
  });

  it('recovers from unreadable records by clearing the persisted record', async () => {
    await putIndexedDbRecord({
      key: ACTIVE_WORKSPACE_PERSISTENCE_KEY,
      savedAt: Number.NaN,
      payloadJson: 'not-used',
    });

    await expect(loadWorkspacePersistence()).resolves.toEqual({
      kind: 'recovered',
      reason: 'unreadable',
      cleared: true,
    });
    await expect(loadWorkspacePersistence()).resolves.toEqual({
      kind: 'missing',
    });
  });

  it('loads large persisted payloads that include a background image', async () => {
    const largeImagePayload = `data:image/png;base64,${'A'.repeat(300_000)}`;
    const workspace = createWorkspaceFixture({
      backgroundImageUrl: largeImagePayload,
    });

    await saveWorkspacePersistence(workspace);
    const loaded = await loadWorkspacePersistence();

    expect(loaded.kind).toBe('loaded');

    if (loaded.kind !== 'loaded') {
      throw new Error('expected persisted workspace to load');
    }

    expect(loaded.workspace.document.backgroundImage?.url).toBe(
      largeImagePayload,
    );
    expect(loaded.workspace.document.backgroundImage?.width).toBe(4096);
    expect(loaded.workspace.document.backgroundImage?.height).toBe(2048);
  });

  it('propagates IndexedDB write failures during save', async () => {
    vi.spyOn(indexedDb, 'putIndexedDbRecord').mockRejectedValue(
      new Error('write failed'),
    );

    await expect(
      saveWorkspacePersistence(createWorkspaceFixture()),
    ).rejects.toThrow('write failed');
  });

  it('propagates IndexedDB read failures during load', async () => {
    vi.spyOn(indexedDb, 'getIndexedDbRecord').mockRejectedValue(
      new Error('read failed'),
    );

    await expect(loadWorkspacePersistence()).rejects.toThrow('read failed');
  });

  it('propagates IndexedDB delete failures during delete', async () => {
    vi.spyOn(indexedDb, 'deleteIndexedDbRecord').mockRejectedValue(
      new Error('delete failed'),
    );

    await expect(deleteWorkspacePersistence()).rejects.toThrow('delete failed');
  });
});
