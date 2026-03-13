import { describe, expect, it } from 'vitest';
import type { PathModel, Point } from '../../domain/models';
import { DEFAULT_ROBOT_MOTION_SETTINGS } from '../../domain/modelNormalization';
import { computePathTiming } from '../../domain/pathTiming';
import { createInitialDomainState } from '../../store/slices/pathSlice';
import { createInitialUiState } from '../../store/slices/uiSlice';
import { type WorkspaceStoreState } from '../../store/workspaceStore';
import {
  computeActivePathTiming,
  computeActiveResolvedPath,
  computeResolvedPaths,
  computeWorkspaceDerivedState,
  selectActivePathTiming,
  selectActiveResolvedPath,
  selectResolvedPaths,
  selectWorkspaceDerivedInputs,
  selectWorkspaceDerived,
} from '../../store/workspaceDerivedSelectors';

const createPoints = (): Point[] => [
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
    x: 4,
    y: 4,
    robotHeading: null,
    isLibrary: false,
    name: 'P2',
  },
  {
    id: 'point-3',
    x: 8,
    y: 0,
    robotHeading: null,
    isLibrary: false,
    name: 'P3',
  },
  {
    id: 'point-4',
    x: 12,
    y: 4,
    robotHeading: null,
    isLibrary: false,
    name: 'P4',
  },
];

const createPath = (
  id: string,
  waypointIds: [string, string],
  visible = true,
): PathModel => ({
  id,
  name: id,
  color: visible ? '#2563eb' : '#6b7280',
  visible,
  waypoints: [
    {
      id: `${id}-waypoint-1`,
      pointId: waypointIds[0],
      libraryPointId: null,
      pathHeading: 0,
    },
    {
      id: `${id}-waypoint-2`,
      pointId: waypointIds[1],
      libraryPointId: null,
      pathHeading: 90,
    },
  ],
  headingKeyframes: [],
  sectionRMin: [2],
});

const createState = ({
  paths,
  points,
  activePathId,
}: {
  paths: PathModel[];
  points: Point[];
  activePathId: string;
}): WorkspaceStoreState => {
  const domain = createInitialDomainState();
  const ui = createInitialUiState();

  return {
    domain: {
      ...domain,
      paths,
      points,
      activePathId,
      lockedPointIds: [],
    },
    ui: {
      ...ui,
      mode: 'path',
      tool: 'select',
      selection: {
        pathId: activePathId,
        waypointId: null,
        headingKeyframeId: null,
        sectionIndex: null,
      },
      robotSettings: DEFAULT_ROBOT_MOTION_SETTINGS,
    },
  } as unknown as WorkspaceStoreState;
};

describe('workspaceDerivedSelectors', () => {
  it('computes resolved paths without relying on module-global cache identity reuse', () => {
    const points = createPoints();
    const paths = [
      createPath('path-1', ['point-1', 'point-2']),
      createPath('path-2', ['point-3', 'point-4']),
    ];
    const state = createState({
      paths,
      points,
      activePathId: 'path-1',
    });

    const first = selectResolvedPaths(state);
    const second = selectResolvedPaths(state);
    const computed = computeResolvedPaths(paths, points);

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    expect(computed).toEqual(first);
    expect(first[0]?.waypoints[1]?.x).toBe(4);

    const updatedPoints = points.map((point) => {
      if (point.id !== 'point-2') {
        return point;
      }

      return {
        ...point,
        x: 6,
      };
    });

    const recalculated = selectResolvedPaths(
      createState({
        paths,
        points: updatedPoints,
        activePathId: 'path-1',
      }),
    );

    expect(recalculated[0]?.waypoints[1]?.x).toBe(6);
  });

  it('returns the resolved active path for the current active path id', () => {
    const points = createPoints();
    const paths = [
      createPath('path-1', ['point-1', 'point-2']),
      createPath('path-2', ['point-3', 'point-4']),
    ];

    const firstActive = selectActiveResolvedPath(
      createState({
        paths,
        points,
        activePathId: 'path-1',
      }),
    );
    const secondActive = selectActiveResolvedPath(
      createState({
        paths,
        points,
        activePathId: 'path-2',
      }),
    );
    const resolvedPaths = computeResolvedPaths(paths, points);
    const computedActive = computeActiveResolvedPath('path-2', resolvedPaths);

    expect(firstActive?.id).toBe('path-1');
    expect(secondActive?.id).toBe('path-2');
    expect(firstActive).not.toBe(secondActive);
    expect(computedActive?.id).toBe('path-2');
  });

  it('keeps active path timing available even when the active path is hidden', () => {
    const points = createPoints();
    const hiddenPath = createPath('path-hidden', ['point-1', 'point-2'], false);
    const state = createState({
      paths: [hiddenPath],
      points,
      activePathId: hiddenPath.id,
    });

    const timing = selectActivePathTiming(state);
    const computedTiming = computeActivePathTiming(
      computeActiveResolvedPath(
        hiddenPath.id,
        computeResolvedPaths([hiddenPath], points),
      ),
      points,
      DEFAULT_ROBOT_MOTION_SETTINGS,
    );
    const expectedTiming = computePathTiming(
      hiddenPath,
      points,
      DEFAULT_ROBOT_MOTION_SETTINGS,
    );

    expect(timing).not.toBeNull();
    expect(computedTiming).not.toBeNull();
    expect(timing?.totalTime).toBe(expectedTiming.totalTime);
    expect(computedTiming?.totalTime).toBe(expectedTiming.totalTime);
    expect(
      timing?.waypointTimings.map((waypoint) => waypoint.waypointId),
    ).toEqual(
      expectedTiming.waypointTimings.map((waypoint) => waypoint.waypointId),
    );
  });

  it('builds the complete derived selector result from store state', () => {
    const points = createPoints();
    const paths = [
      createPath('path-1', ['point-1', 'point-2']),
      createPath('path-2', ['point-3', 'point-4']),
    ];

    const derived = selectWorkspaceDerived(
      createState({
        paths,
        points,
        activePathId: 'path-2',
      }),
    );

    expect(derived.resolvedPaths).toHaveLength(2);
    expect(derived.activeResolvedPath?.id).toBe('path-2');
    expect(derived.activePathTiming).not.toBeNull();
  });

  it('shares the same pure derivation between selector inputs and direct computation', () => {
    const points = createPoints();
    const paths = [
      createPath('path-1', ['point-1', 'point-2']),
      createPath('path-2', ['point-3', 'point-4']),
    ];
    const state = createState({
      paths,
      points,
      activePathId: 'path-1',
    });

    expect(
      computeWorkspaceDerivedState(selectWorkspaceDerivedInputs(state)),
    ).toEqual(selectWorkspaceDerived(state));
    expect(selectResolvedPaths(state)).toEqual(
      selectWorkspaceDerived(state).resolvedPaths,
    );
    expect(selectActiveResolvedPath(state)).toEqual(
      selectWorkspaceDerived(state).activeResolvedPath,
    );
    expect(selectActivePathTiming(state)?.totalTime).toBe(
      selectWorkspaceDerived(state).activePathTiming?.totalTime,
    );
  });
});
