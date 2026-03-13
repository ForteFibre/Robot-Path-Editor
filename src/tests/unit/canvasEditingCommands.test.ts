import { describe, expect, it, vi } from 'vitest';
import {
  createCanvasEditingCommands,
  type CanvasEditingCommandDeps,
} from '../../store/commands/canvasEditingCommands';
import {
  isWaypointLocked,
  resolveWaypointInsertionIndex,
} from '../../store/commands/canvasEditingPolicy';
import { createPath, createWorkspace } from './pointerMachineTestUtils';

const createDeps = (
  overrides: Partial<CanvasEditingCommandDeps> = {},
): CanvasEditingCommandDeps => {
  const workspace = createWorkspace();

  return {
    getWorkspace: () => workspace,
    insertLibraryWaypoint: vi.fn(() => 'waypoint-new'),
    addHeadingKeyframe: vi.fn(),
    setSelection: vi.fn(),
    setTool: vi.fn(),
    updateWaypoint: vi.fn(),
    setSectionRMin: vi.fn(),
    clearSelection: vi.fn(),
    ...overrides,
  };
};

describe('canvasEditingPolicy', () => {
  it('inserts after the selected waypoint when the selection belongs to the path', () => {
    const { path } = createPath();

    expect(
      resolveWaypointInsertionIndex(path, {
        pathId: path.id,
        waypointId: 'waypoint-1',
        headingKeyframeId: null,
        sectionIndex: null,
      }),
    ).toBe(1);
  });

  it('falls back to appending when the selection does not target a waypoint in the path', () => {
    const { path } = createPath();

    expect(
      resolveWaypointInsertionIndex(path, {
        pathId: 'other-path',
        waypointId: 'waypoint-1',
        headingKeyframeId: null,
        sectionIndex: null,
      }),
    ).toBe(path.waypoints.length);
  });

  it('treats linked locked waypoints as non-draggable', () => {
    const { path } = createPath();
    const [firstWaypoint, secondWaypoint] = path.waypoints;

    if (firstWaypoint === undefined || secondWaypoint === undefined) {
      throw new Error('expected base path waypoints');
    }

    const lockedPath = {
      ...path,
      waypoints: [
        {
          ...firstWaypoint,
          libraryPointId: 'library-1',
        },
        secondWaypoint,
      ],
    };

    expect(isWaypointLocked('waypoint-1', [lockedPath], ['library-1'])).toBe(
      true,
    );
    expect(isWaypointLocked('waypoint-2', [lockedPath], ['library-1'])).toBe(
      false,
    );
  });
});

describe('createCanvasEditingCommands', () => {
  it('executes add-waypoint with the resolved insertion point', () => {
    const workspace = createWorkspace({
      selection: {
        pathId: 'path-1',
        waypointId: 'waypoint-1',
        headingKeyframeId: null,
        sectionIndex: null,
      },
    });
    const deps = createDeps({
      getWorkspace: () => workspace,
    });
    const commands = createCanvasEditingCommands(deps);

    const waypointId = commands.executeAddWaypoint({
      pathId: 'path-1',
      pointId: 'point-new',
      waypointId: 'waypoint-new',
      x: 5,
      y: 2,
    });

    expect(waypointId).toBe('waypoint-new');
    expect(deps.insertLibraryWaypoint).toHaveBeenCalledWith({
      pathId: 'path-1',
      pointId: 'point-new',
      waypointId: 'waypoint-new',
      x: 5,
      y: 2,
      linkToLibrary: false,
      afterWaypointId: 'waypoint-1',
    });
  });

  it('creates, names, and selects heading keyframes', () => {
    const deps = createDeps();
    const commands = createCanvasEditingCommands(deps);

    const headingKeyframeId = commands.executeAddHeadingKeyframe({
      pathId: 'path-1',
      headingKeyframeId: 'heading-new',
      sectionIndex: 0,
      sectionRatio: 0.5,
      robotHeading: 135,
    });

    expect(headingKeyframeId).toBe('heading-new');
    expect(deps.addHeadingKeyframe).toHaveBeenCalledWith(
      'path-1',
      expect.objectContaining({
        id: 'heading-new',
        name: 'HP 1',
        sectionIndex: 0,
        sectionRatio: 0.5,
        robotHeading: 135,
      }),
    );
    expect(deps.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: null,
      headingKeyframeId: 'heading-new',
      sectionIndex: null,
    });
  });

  it('resets waypoint robot heading and reselects the waypoint', () => {
    const deps = createDeps();
    const commands = createCanvasEditingCommands(deps);

    commands.resetWaypointRobotHeading('waypoint-2');

    expect(deps.updateWaypoint).toHaveBeenCalledWith('path-1', 'waypoint-2', {
      robotHeading: null,
    });
    expect(deps.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: 'waypoint-2',
      headingKeyframeId: null,
      sectionIndex: null,
    });
  });

  it('resets section rMin and keeps the section selected', () => {
    const deps = createDeps();
    const commands = createCanvasEditingCommands(deps);

    commands.resetSectionRMin({ pathId: 'path-1', sectionIndex: 1 });

    expect(deps.setSectionRMin).toHaveBeenCalledWith('path-1', 1, null);
    expect(deps.setSelection).toHaveBeenCalledWith({
      pathId: 'path-1',
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: 1,
    });
  });

  it('clears selection for pan interactions and resets add-point mode to select', () => {
    const deps = createDeps();
    const commands = createCanvasEditingCommands(deps);

    commands.executePanSelectionClear();
    commands.completeAddWaypointMode();

    expect(deps.clearSelection).toHaveBeenCalledTimes(1);
    expect(deps.setTool).toHaveBeenCalledWith('select');
  });
});
