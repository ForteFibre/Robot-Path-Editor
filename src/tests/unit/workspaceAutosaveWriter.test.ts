import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceAutosavePayload } from '../../domain/workspaceContract';
import { persistWorkspaceAutosaveSource } from '../../features/persistence/workspaceAutosaveWriter';
import {
  toWorkspaceAutosavePayloadFromSource,
  type WorkspaceAutosaveSource,
} from '../../store/adapters/workspacePersistence';

const createAutosaveSource = (): WorkspaceAutosaveSource => {
  return {
    domain: {
      paths: [
        {
          id: 'path-1',
          name: 'Path 1',
          color: '#2563eb',
          visible: true,
          waypoints: [
            {
              id: 'waypoint-1',
              pointId: 'point-1',
              libraryPointId: null,
              pathHeading: 0,
            },
            {
              id: 'waypoint-2',
              pointId: 'point-2',
              libraryPointId: null,
              pathHeading: 90,
            },
          ],
          headingKeyframes: [],
          sectionRMin: [2],
        },
      ],
      points: [
        {
          id: 'point-1',
          x: 0,
          y: 0,
          robotHeading: null,
          isLibrary: false,
          name: 'P1',
        },
        {
          id: 'point-2',
          x: 5,
          y: 5,
          robotHeading: null,
          isLibrary: false,
          name: 'P2',
        },
      ],
      lockedPointIds: [],
      activePathId: 'path-1',
    },
    mode: 'path',
    tool: 'add-point',
    selection: {
      pathId: 'path-1',
      waypointId: 'waypoint-2',
      headingKeyframeId: null,
      sectionIndex: 0,
    },
    canvasTransform: {
      x: 12,
      y: 24,
      k: 60,
    },
    backgroundImage: {
      url: 'blob:background-image',
      width: 1280,
      height: 720,
      x: 10,
      y: 20,
      scale: 1.25,
      alpha: 0.5,
    },
    robotPreviewEnabled: false,
    robotSettings: {
      length: 1.2,
      width: 0.8,
      acceleration: 2.5,
      deceleration: 2,
      maxVelocity: 4.2,
      centripetalAcceleration: 3.1,
    },
  };
};

describe('workspaceAutosaveWriter', () => {
  it('converts the tracked source into an autosave payload before saving', async () => {
    const source = createAutosaveSource();
    const saveWorkspace = vi.fn<
      (workspace: WorkspaceAutosavePayload) => Promise<{ savedAt: number }>
    >(() => Promise.resolve({ savedAt: 123 }));

    await expect(
      persistWorkspaceAutosaveSource(source, saveWorkspace),
    ).resolves.toEqual({ savedAt: 123 });

    expect(saveWorkspace).toHaveBeenCalledWith(
      toWorkspaceAutosavePayloadFromSource(source),
    );
  });

  it('propagates persistence errors from the save implementation', async () => {
    const source = createAutosaveSource();
    const error = new Error('disk full');
    const saveWorkspace = vi.fn<
      (workspace: WorkspaceAutosavePayload) => Promise<{ savedAt: number }>
    >(() => Promise.reject(error));

    await expect(
      persistWorkspaceAutosaveSource(source, saveWorkspace),
    ).rejects.toBe(error);
  });
});
