import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiscretizedPath } from '../../domain/interpolation';
import type { SelectionState } from '../../domain/models';
import type {
  ResolvedPathModel,
  ResolvedWaypoint,
} from '../../domain/pointResolution';
import type { CanvasSceneVisiblePath } from '../../features/canvas/hooks/canvasScene/types';
import { CanvasResolvedPathLayer } from '../../features/canvas/components/CanvasResolvedPathLayer';

vi.mock('react-konva', async () => {
  const React = await import('react');

  return {
    Group: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Line: () => React.createElement('div', { 'data-testid': 'konva-line' }),
  };
});

vi.mock('../../domain/interpolation', () => {
  return {
    buildHeadingKeyframeRanges: vi.fn(() => [{ startIndex: 0, endIndex: 1 }]),
    getHeadingKeyframeRangePolyline: vi.fn(() => [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]),
    resolveDiscretizedHeadingKeyframes: vi.fn(() => [
      {
        id: 'hk-1',
        name: 'Heading 1',
        sectionIndex: 0,
        sectionRatio: 0.5,
        robotHeading: 180,
        x: 1,
        y: 1,
        pathHeading: 45,
      },
    ]),
  };
});

vi.mock('../../features/canvas/waypointHeading', () => {
  return {
    resolveWaypointRobotHeadingHandleAngle: vi.fn(() => 90),
  };
});

vi.mock('../../features/canvas/components/CanvasPath', async () => {
  const React = await import('react');

  return {
    CanvasPath: () =>
      React.createElement('div', { 'data-testid': 'canvas-path' }),
  };
});

vi.mock('../../features/canvas/components/CanvasWaypoint', async () => {
  const React = await import('react');

  return {
    CanvasWaypoint: ({ waypoint }: { waypoint: ResolvedWaypoint }) =>
      React.createElement('div', {
        'data-testid': 'canvas-waypoint',
        'data-waypoint-id': waypoint.id,
      }),
  };
});

vi.mock('../../features/canvas/components/CanvasHeadingKeyframe', async () => {
  const React = await import('react');

  return {
    CanvasHeadingKeyframe: ({
      headingKeyframe,
    }: {
      headingKeyframe: { id: string };
    }) =>
      React.createElement('div', {
        'data-testid': 'canvas-heading-keyframe',
        'data-heading-keyframe-id': headingKeyframe.id,
      }),
  };
});

vi.mock('../../features/canvas/components/CanvasRMinDrag', async () => {
  const React = await import('react');

  return {
    CanvasRMinDrag: ({
      rMinDragTarget,
    }: {
      rMinDragTarget: { sectionIndex: number };
    }) =>
      React.createElement('div', {
        'data-testid': 'canvas-rmin-drag',
        'data-section-index': rMinDragTarget.sectionIndex.toString(),
      }),
  };
});

const selection: SelectionState = {
  pathId: 'path-1',
  waypointId: 'wp-1',
  headingKeyframeId: 'hk-1',
  sectionIndex: null,
};

const createWaypoint = (
  id: string,
  pointId: string,
  x: number,
  y: number,
): ResolvedWaypoint => {
  return {
    id,
    pointId,
    libraryPointId: null,
    name: id,
    pathHeading: 0,
    point: {
      id: pointId,
      x,
      y,
      robotHeading: null,
      isLibrary: false,
      name: id,
    },
    libraryPoint: null,
    x,
    y,
  };
};

const resolvedPath: ResolvedPathModel = {
  id: 'path-1',
  name: 'Path 1',
  color: '#2563eb',
  visible: true,
  waypoints: [
    createWaypoint('wp-1', 'pt-1', 0, 0),
    createWaypoint('wp-2', 'pt-2', 2, 2),
  ],
  headingKeyframes: [
    {
      id: 'hk-1',
      name: 'Heading 1',
      sectionIndex: 0,
      sectionRatio: 0.5,
      robotHeading: 180,
    },
  ],
  sectionRMin: [2],
};

const createVisiblePath = (isActive: boolean): CanvasSceneVisiblePath => {
  return {
    path: resolvedPath,
    detail: {} as DiscretizedPath,
    geometrySegments: [],
    selection,
    lockedPointIds: [],
    isActive,
  };
};

describe('CanvasResolvedPathLayer', () => {
  it('active path にだけ rMin drag UI を表示する', () => {
    const rMinDragTargets = [
      {
        pathId: 'path-1',
        sectionIndex: 0,
        center: { x: 1, y: 1 },
        waypointPoint: { x: 0, y: 0 },
        rMin: 2,
        isAuto: false,
      },
      {
        pathId: 'path-2',
        sectionIndex: 0,
        center: { x: 2, y: 2 },
        waypointPoint: { x: 1, y: 1 },
        rMin: 3,
        isAuto: false,
      },
    ];

    const { rerender } = render(
      <CanvasResolvedPathLayer
        visiblePath={createVisiblePath(true)}
        mode="path"
        k={1}
        rMinDragTargets={rMinDragTargets}
      />,
    );

    expect(screen.getAllByTestId('canvas-rmin-drag')).toHaveLength(1);

    rerender(
      <CanvasResolvedPathLayer
        visiblePath={createVisiblePath(false)}
        mode="path"
        k={1}
        rMinDragTargets={rMinDragTargets}
      />,
    );

    expect(screen.queryByTestId('canvas-rmin-drag')).not.toBeInTheDocument();
  });

  it('waypoint を正しく描画する', () => {
    render(
      <CanvasResolvedPathLayer
        visiblePath={createVisiblePath(true)}
        mode="path"
        k={1}
        rMinDragTargets={[]}
      />,
    );

    const waypoints = screen.getAllByTestId('canvas-waypoint');

    expect(waypoints).toHaveLength(2);
    expect(waypoints[0]).toHaveAttribute('data-waypoint-id', 'wp-1');
    expect(waypoints[1]).toHaveAttribute('data-waypoint-id', 'wp-2');
  });

  it('heading keyframe を描画する', () => {
    render(
      <CanvasResolvedPathLayer
        visiblePath={createVisiblePath(true)}
        mode="heading"
        k={1}
        rMinDragTargets={[]}
      />,
    );

    expect(screen.getByTestId('canvas-heading-keyframe')).toHaveAttribute(
      'data-heading-keyframe-id',
      'hk-1',
    );
    expect(screen.getByTestId('konva-line')).toBeInTheDocument();
  });
});
