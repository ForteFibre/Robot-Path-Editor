import type { HeadingSample } from '../../domain/pathSampling';
import type { DiscretizedPath } from '../../domain/interpolation';
import {
  createPointIndex,
  resolvePathModel,
  type ResolvedPathModel,
} from '../../domain/pointResolution';
import type { PathModel, Point as ModelPoint } from '../../domain/models';
import { DEFAULT_SNAP_SETTINGS } from '../../domain/snapSettings';
import type { PointerSnapshot } from '../../features/canvas/hooks/pointerMachine/types';
import type { RMinDragTarget } from '../../features/canvas/types/rMinDragTarget';
import type { CanvasInteractionSnapshot } from '../../store/types';

export const createModelPoint = (
  id: string,
  x: number,
  y: number,
  robotHeading: number | null = null,
): ModelPoint => ({
  id,
  x,
  y,
  robotHeading,
  isLibrary: false,
  name: id,
});

export const createSample = (
  x: number,
  y: number,
  pathHeading: number,
): HeadingSample => ({
  x,
  y,
  pathHeading,
  robotHeading: pathHeading,
  rMinOfSection: 1,
  curvatureRadius: null,
});

export const createDiscretizedPath = (): DiscretizedPath => ({
  samples: [createSample(0, 0, 0), createSample(10, 0, 0)],
  sectionSampleRanges: [
    { sectionIndex: 0, startSampleIndex: 0, endSampleIndex: 1 },
  ],
});

export const createPath = (): { path: PathModel; points: ModelPoint[] } => {
  const startPoint = createModelPoint('point-1', 0, 0);
  const endPoint = createModelPoint('point-2', 10, 0);

  return {
    path: {
      id: 'path-1',
      name: 'Path 1',
      color: '#2563eb',
      visible: true,
      waypoints: [
        {
          id: 'waypoint-1',
          pointId: startPoint.id,
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'waypoint-2',
          pointId: endPoint.id,
          libraryPointId: null,
          pathHeading: 0,
        },
      ],
      headingKeyframes: [],
      sectionRMin: [null],
    },
    points: [startPoint, endPoint],
  };
};

export const createWorkspace = (
  overrides: Partial<CanvasInteractionSnapshot> = {},
): CanvasInteractionSnapshot => {
  const { path, points } = createPath();

  return {
    mode: 'path',
    tool: 'select',
    paths: [path],
    points,
    lockedPointIds: [],
    activePathId: path.id,
    selection: {
      pathId: path.id,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    },
    canvasTransform: { x: 200, y: 100, k: 20 },
    backgroundImage: null,
    ...overrides,
  };
};

export const resolvePaths = (
  workspace: CanvasInteractionSnapshot,
): ResolvedPathModel[] => {
  return workspace.paths.map((path) =>
    resolvePathModel(path, createPointIndex(workspace.points)),
  );
};

export const createRMinDragTarget = (
  overrides: Partial<RMinDragTarget> = {},
): RMinDragTarget => ({
  pathId: 'path-1',
  sectionIndex: 0,
  center: { x: 3, y: 2 },
  waypointPoint: { x: 0, y: 0 },
  rMin: 4,
  isAuto: false,
  ...overrides,
});

export const createSnapshot = (
  overrides: Partial<PointerSnapshot> = {},
): PointerSnapshot => {
  const workspace = overrides.workspace ?? createWorkspace();
  const resolvedPaths = overrides.resolvedPaths ?? resolvePaths(workspace);
  const discretizedPath = createDiscretizedPath();
  const discretizedByPath =
    overrides.discretizedByPath ??
    new Map([[workspace.activePathId, discretizedPath]]);
  const rMinTargets = overrides.rMinDragTargets ?? [];

  return {
    pointerId: 1,
    button: 0,
    clientX: 240,
    clientY: 170,
    shiftKey: false,
    altKey: false,
    workspace,
    hit: { kind: 'canvas' },
    world: { x: 5, y: 0 },
    waypointPoints: resolvedPaths.flatMap((path) =>
      path.waypoints.map((waypoint) => ({
        id: waypoint.id,
        x: waypoint.x,
        y: waypoint.y,
      })),
    ),
    resolvedPaths,
    discretizedByPath,
    snapSettings: overrides.snapSettings ?? DEFAULT_SNAP_SETTINGS,
    rMinDragTargets: rMinTargets,
    ...overrides,
  };
};
