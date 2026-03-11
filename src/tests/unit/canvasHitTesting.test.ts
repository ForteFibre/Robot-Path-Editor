import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import {
  getCanvasRenderStep,
  getHeadingHandleDistance,
} from '../../domain/canvas';
import {
  pointFromHeading,
  worldToScreen,
  type Point,
} from '../../domain/geometry';
import { discretizePathDetailed } from '../../domain/interpolation';
import { initialWorkspace, type Workspace } from '../../domain/models';
import {
  createPointIndex,
  resolvePathModel,
} from '../../domain/pointResolution';
import type { RMinDragTarget } from '../../features/canvas/components/CanvasRMinDrag';
import { resolveStageHit } from '../../features/canvas/hooks/canvasHitTesting';

const createStageAtScreen = (x: number, y: number): Konva.Stage => {
  return {
    getPointerPosition: () => ({ x, y }),
  } as unknown as Konva.Stage;
};

const createStageAtWorld = (
  workspace: Workspace,
  worldPoint: Point,
): Konva.Stage => {
  const screenPoint = worldToScreen(worldPoint, workspace.canvasTransform);

  return createStageAtScreen(screenPoint.x, screenPoint.y);
};

const createDiscretizedByPath = (
  workspace: Workspace,
  activePath: Workspace['paths'][number],
) => {
  return new Map([
    [
      activePath.id,
      discretizePathDetailed(
        activePath,
        workspace.points,
        getCanvasRenderStep(workspace.canvasTransform.k),
      ),
    ],
  ]);
};

const createStraightPathFixture = () => {
  const workspace = initialWorkspace();
  const activePath = workspace.paths[0];

  if (activePath === undefined) {
    throw new Error('expected initial active path');
  }

  workspace.canvasTransform = {
    x: 0,
    y: 0,
    k: 1,
  };

  workspace.points = [
    {
      id: 'point-start',
      x: 0,
      y: 0,
      robotHeading: null,
      isLibrary: false,
      name: 'WP 1',
    },
    {
      id: 'point-end',
      x: 100,
      y: 0,
      robotHeading: null,
      isLibrary: false,
      name: 'WP 2',
    },
  ];
  activePath.waypoints = [
    {
      id: 'waypoint-start',
      pointId: 'point-start',
      libraryPointId: null,
      pathHeading: 0,
    },
    {
      id: 'waypoint-end',
      pointId: 'point-end',
      libraryPointId: null,
      pathHeading: 0,
    },
  ];
  activePath.headingKeyframes = [];
  activePath.sectionRMin = [null];
  workspace.activePathId = activePath.id;
  workspace.selection = {
    pathId: activePath.id,
    waypointId: null,
    headingKeyframeId: null,
    sectionIndex: null,
  };

  const resolvedPaths = [
    resolvePathModel(activePath, createPointIndex(workspace.points)),
  ];

  return {
    workspace,
    activePath,
    resolvedPaths,
    discretizedByPath: createDiscretizedByPath(workspace, activePath),
  };
};

describe('resolveStageHit', () => {
  it('prioritizes a waypoint over a section hit', () => {
    const { workspace, activePath, resolvedPaths, discretizedByPath } =
      createStraightPathFixture();

    const hit = resolveStageHit({
      workspace,
      stage: createStageAtWorld(workspace, { x: 0, y: 0 }),
      resolvedPaths,
      discretizedByPath,
      rMinDragTargets: [],
    });

    expect(hit).toEqual({
      kind: 'waypoint',
      pathId: activePath.id,
      waypointId: 'waypoint-start',
    });
  });

  it('prioritizes a path-heading handle over a section hit', () => {
    const { workspace, activePath, resolvedPaths, discretizedByPath } =
      createStraightPathFixture();
    const handlePoint = pointFromHeading(
      { x: 0, y: 0 },
      0,
      getHeadingHandleDistance(workspace.canvasTransform.k),
    );

    const hit = resolveStageHit({
      workspace,
      stage: createStageAtWorld(workspace, handlePoint),
      resolvedPaths,
      discretizedByPath,
      rMinDragTargets: [],
    });

    expect(hit).toEqual({
      kind: 'path-heading',
      pathId: activePath.id,
      waypointId: 'waypoint-start',
    });
  });

  it('prioritizes an rmin handle over a section hit', () => {
    const { workspace, activePath, resolvedPaths, discretizedByPath } =
      createStraightPathFixture();
    const overlappingPoint = { x: 50, y: 0 };
    const rMinDragTargets: RMinDragTarget[] = [
      {
        pathId: activePath.id,
        sectionIndex: 0,
        center: overlappingPoint,
        waypointPoint: { x: 0, y: 0 },
        rMin: 1,
        isAuto: false,
      },
    ];

    const hit = resolveStageHit({
      workspace,
      stage: createStageAtWorld(workspace, overlappingPoint),
      resolvedPaths,
      discretizedByPath,
      rMinDragTargets,
    });

    expect(hit).toEqual({
      kind: 'rmin-handle',
      pathId: activePath.id,
      sectionIndex: 0,
      center: overlappingPoint,
    });
  });

  it('prioritizes the background image while the edit-image tool is active', () => {
    const { workspace, activePath, resolvedPaths } =
      createStraightPathFixture();
    workspace.tool = 'edit-image';
    workspace.backgroundImage = {
      url: 'data:image/png;base64,dGVzdA==',
      width: 10,
      height: 10,
      x: -5,
      y: -5,
      scale: 1,
      alpha: 0.5,
    };
    workspace.canvasTransform = {
      x: 0,
      y: 0,
      k: 1,
    };

    const hit = resolveStageHit({
      workspace,
      stage: createStageAtWorld(workspace, { x: 0, y: 0 }),
      resolvedPaths,
      discretizedByPath: createDiscretizedByPath(workspace, activePath),
      rMinDragTargets: [],
    });

    expect(hit).toEqual({ kind: 'background-image' });
  });
});
