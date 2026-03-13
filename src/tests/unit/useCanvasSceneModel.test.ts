import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  type BackgroundImage,
  type PathModel,
  type Point,
  type SelectionState,
} from '../../domain/models';
import { DEFAULT_ROBOT_MOTION_SETTINGS } from '../../domain/modelNormalization';
import {
  createPointIndex,
  resolvePathModel,
} from '../../domain/pointResolution';
import { computePathTiming } from '../../domain/pathTiming';
import { useCanvasSceneModel } from '../../features/canvas/hooks/useCanvasSceneModel';

const createPoints = (): Point[] => [
  {
    id: 'point-1',
    x: 0,
    y: 0,
    robotHeading: null,
    isLibrary: false,
    name: 'WP 1',
  },
  {
    id: 'point-2',
    x: 4,
    y: 4,
    robotHeading: null,
    isLibrary: false,
    name: 'WP 2',
  },
  {
    id: 'point-3',
    x: 10,
    y: 0,
    robotHeading: null,
    isLibrary: false,
    name: 'Hidden WP',
  },
];

const createActivePath = (): PathModel => ({
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
});

const createHiddenPath = (): PathModel => ({
  id: 'path-hidden',
  name: 'Hidden Path',
  color: '#6b7280',
  visible: false,
  waypoints: [
    {
      id: 'hidden-waypoint',
      pointId: 'point-3',
      libraryPointId: null,
      pathHeading: 0,
    },
  ],
  headingKeyframes: [],
  sectionRMin: [],
});

const backgroundImage: BackgroundImage = {
  url: 'data:image/png;base64,dGVzdA==',
  width: 100,
  height: 50,
  x: 1,
  y: 2,
  scale: 1,
  alpha: 0.5,
};

const createSelection = (
  overrides: Partial<SelectionState> = {},
): SelectionState => ({
  pathId: 'path-1',
  waypointId: 'waypoint-1',
  headingKeyframeId: null,
  sectionIndex: null,
  ...overrides,
});

const createDerived = ({
  paths,
  points,
  activePath,
}: {
  paths: PathModel[];
  points: Point[];
  activePath: PathModel | null;
}) => {
  const pointsById = createPointIndex(points);
  const resolvedPaths = paths.map((path) => resolvePathModel(path, pointsById));

  return {
    resolvedPaths,
    activeResolvedPath:
      activePath === null
        ? null
        : (resolvedPaths.find((path) => path.id === activePath.id) ?? null),
    activePathTiming:
      activePath === null
        ? null
        : computePathTiming(activePath, points, DEFAULT_ROBOT_MOTION_SETTINGS),
  };
};

describe('useCanvasSceneModel', () => {
  it('builds render and interaction data for the active visible path', () => {
    const points = createPoints();
    const activePath = createActivePath();
    const paths = [activePath, createHiddenPath()];
    const derived = createDerived({
      paths,
      points,
      activePath,
    });

    const { result } = renderHook(() =>
      useCanvasSceneModel({
        mode: 'path',
        tool: 'select',
        paths,
        points,
        lockedPointIds: [],
        activePath,
        selection: createSelection(),
        canvasTransform: { x: 0, y: 0, k: 1 },
        backgroundImage,
        robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
        addPointPreview: {
          kind: 'path-waypoint',
          point: { x: 6, y: 5 },
          pathHeading: 45,
          sourcePoint: { x: 4, y: 4 },
          nextPoint: null,
        },
        derived,
      }),
    );

    expect(result.current.interaction.resolvedPaths).toHaveLength(2);
    expect(result.current.render.visiblePaths).toHaveLength(1);
    expect(
      result.current.interaction.allVisibleWaypointPoints.map(
        (point) => point.id,
      ),
    ).toEqual(['waypoint-1', 'waypoint-2']);
    expect(result.current.render.visiblePaths[0]?.isActive).toBe(true);
    expect(result.current.render.activePathAnimationColor).toBe('#2563eb');
    expect(result.current.render.backgroundImageCanvasOrigin).toEqual({
      x: -2,
      y: -1,
    });
    expect(result.current.render.backgroundImageRenderState).toMatchObject({
      width: 100,
      height: 50,
    });
    expect(result.current.render.addPointPreviewPath?.id).toBe('path-1');
    expect(result.current.render.addPointPreviewWaypoint?.name).toBe('WP 3');
    expect(result.current.render.addPointPreviewHeadingKeyframe).toBeNull();
    expect(
      result.current.interaction.discretizedByPathForInteraction.get('path-1'),
    ).toBeDefined();
    expect(result.current.render.activePathTiming).not.toBeNull();
  });

  it('derives heading preview data in heading add-point mode', () => {
    const points = createPoints();
    const activePath = createActivePath();
    const paths = [activePath];
    const derived = createDerived({
      paths,
      points,
      activePath,
    });

    const { result } = renderHook(() =>
      useCanvasSceneModel({
        mode: 'heading',
        tool: 'add-point',
        paths,
        points,
        lockedPointIds: [],
        activePath,
        selection: createSelection({ waypointId: null }),
        canvasTransform: { x: 0, y: 0, k: 1 },
        backgroundImage: null,
        robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
        addPointPreview: {
          kind: 'heading-keyframe',
          point: { x: 2, y: 2 },
          robotHeading: 180,
          sectionIndex: 0,
          sectionRatio: 0.5,
        },
        derived,
      }),
    );

    expect(result.current.render.addPointPreviewWaypoint).toBeNull();
    expect(result.current.render.addPointPreviewHeadingKeyframe).toMatchObject({
      name: 'Heading 1',
      sectionIndex: 0,
      sectionRatio: 0.5,
      robotHeading: 180,
    });
  });

  it('suppresses base rMin targets in add-point mode but resolves them for an active drag', () => {
    const points = createPoints();
    const activePath = createActivePath();
    const paths = [activePath];
    const derived = createDerived({
      paths,
      points,
      activePath,
    });

    const { result } = renderHook(() =>
      useCanvasSceneModel({
        mode: 'path',
        tool: 'add-point',
        paths,
        points,
        lockedPointIds: [],
        activePath,
        selection: createSelection(),
        canvasTransform: { x: 0, y: 0, k: 1 },
        backgroundImage: null,
        robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
        addPointPreview: null,
        derived,
      }),
    );

    expect(result.current.interaction.baseRMinDragTargets).toEqual([]);
    expect(
      result.current.resolveRMinDragTargets({
        draggingWaypointId: 'waypoint-1',
        draggingPathId: 'path-1',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('keeps shared timing for hidden paths but filters it from canvas rendering', () => {
    const points = createPoints();
    const activePath: PathModel = {
      ...createActivePath(),
      id: 'path-hidden-active',
      name: 'Hidden Active Path',
      visible: false,
    };
    const paths = [activePath];
    const derived = createDerived({
      paths,
      points,
      activePath,
    });

    expect(derived.activePathTiming).not.toBeNull();

    const { result } = renderHook(() =>
      useCanvasSceneModel({
        mode: 'path',
        tool: 'select',
        paths,
        points,
        lockedPointIds: [],
        activePath,
        selection: createSelection({
          pathId: activePath.id,
          waypointId: activePath.waypoints[0]?.id ?? null,
        }),
        canvasTransform: { x: 0, y: 0, k: 1 },
        backgroundImage: null,
        robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
        addPointPreview: null,
        derived,
      }),
    );

    expect(result.current.render.activePathTiming).toBeNull();
  });
});
