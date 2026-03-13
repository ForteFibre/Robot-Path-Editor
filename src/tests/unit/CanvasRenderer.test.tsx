import type Konva from 'konva';
import { createRef, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasTransform } from '../../domain/canvasTransform';
import { EMPTY_SNAP_GUIDE } from '../../domain/geometry';
import type { RobotMotionSettings, SelectionState } from '../../domain/models';
import type { PathTiming } from '../../domain/pathTiming';
import type { CanvasSceneRenderModel } from '../../features/canvas/hooks/canvasScene/types';
import type { PathAnimationState } from '../../features/canvas/hooks/usePathAnimation';
import type { CanvasViewportSize } from '../../features/canvas/hooks/useCanvasViewport';
import { CanvasRenderer } from '../../features/canvas/components/CanvasRenderer';

type KonvaContainerMockProps = {
  children?: ReactNode;
};

type CanvasResolvedPathLayerMockProps = {
  isVelocityOverlayVisible: boolean;
};

const readKonvaContainerProps = (props: unknown): KonvaContainerMockProps => {
  return (props ?? {}) as KonvaContainerMockProps;
};

const readCanvasResolvedPathLayerMockProps = (
  props: unknown,
): CanvasResolvedPathLayerMockProps => {
  return (props ?? {}) as CanvasResolvedPathLayerMockProps;
};

vi.mock('react-konva', async () => {
  const React = await import('react');

  return {
    Stage: (props: unknown) => {
      const resolvedProps = readKonvaContainerProps(props);
      return React.createElement(
        'div',
        { 'data-testid': 'konva-stage' },
        resolvedProps.children,
      );
    },
    Layer: (props: unknown) => {
      const resolvedProps = readKonvaContainerProps(props);
      return React.createElement(React.Fragment, null, resolvedProps.children);
    },
    Group: (props: unknown) => {
      const resolvedProps = readKonvaContainerProps(props);
      return React.createElement(React.Fragment, null, resolvedProps.children);
    },
    Image: () => React.createElement('div', { 'data-testid': 'konva-image' }),
  };
});

vi.mock('../../features/canvas/components/CanvasGrid', () => {
  return {
    CanvasGrid: () => null,
  };
});

vi.mock('../../features/canvas/components/CanvasGuides', () => {
  return {
    CanvasGuides: () => null,
  };
});

vi.mock(
  '../../features/canvas/components/CanvasResolvedPathLayer',
  async () => {
    const React = await import('react');

    return {
      CanvasResolvedPathLayer: (props: unknown) => {
        const resolvedProps = readCanvasResolvedPathLayerMockProps(props);
        return React.createElement('div', {
          'data-testid': 'canvas-resolved-path-layer',
          'data-is-velocity-overlay-visible':
            resolvedProps.isVelocityOverlayVisible ? 'true' : 'false',
        });
      },
    };
  },
);

vi.mock(
  '../../features/canvas/components/CanvasPathVelocityOverlay',
  async () => {
    const React = await import('react');

    return {
      CanvasPathVelocityOverlay: () =>
        React.createElement('div', {
          'data-testid': 'canvas-path-velocity-overlay',
        }),
    };
  },
);

vi.mock('../../features/canvas/components/CanvasPreviewOverlay', () => {
  return {
    CanvasPreviewOverlay: () => null,
  };
});

vi.mock('../../features/canvas/components/CanvasRobotLayer', () => {
  return {
    CanvasRobotLayer: () => null,
  };
});

const selection: SelectionState = {
  pathId: null,
  waypointId: null,
  headingKeyframeId: null,
  sectionIndex: null,
};

const baseVisiblePath: CanvasSceneRenderModel['visiblePaths'][number] = {
  path: {
    id: 'path-1',
    name: 'Path 1',
    color: '#2563eb',
    visible: true,
    waypoints: [],
    headingKeyframes: [],
    sectionRMin: [],
  },
  detail: undefined,
  geometrySegments: [],
  selection,
  lockedPointIds: [],
  isActive: true,
};

const createTiming = (): PathTiming => {
  return {
    samples: [],
    waypointTimings: [],
    totalDistance: 0,
    totalTime: 0,
    maxVelocity: 1,
    motionSettings: {
      acceleration: 1,
      deceleration: 1,
    },
    segments: [],
    headingProfile: {
      kind: 'implicit',
      totalDistance: 0,
      startHeading: 0,
      endHeading: 0,
    },
  };
};

const createScene = (
  activePathTiming: PathTiming | null,
): CanvasSceneRenderModel => {
  return {
    visiblePaths: [baseVisiblePath],
    activePathTiming,
    activePathAnimationColor: null,
    backgroundImageRenderState: null,
    backgroundImageCanvasOrigin: null,
    addPointPreviewPath: null,
    addPointPreviewWaypoint: null,
    addPointPreviewHeadingKeyframe: null,
  };
};

const viewportSize: CanvasViewportSize = {
  width: 1024,
  height: 768,
};

const canvasTransform: CanvasTransform = {
  x: 0,
  y: 0,
  k: 1,
};

const robotAnimation: PathAnimationState = {
  currentTime: 0,
  totalTime: 0,
  progress: 0,
  pose: null,
};

const robotSettings: RobotMotionSettings = {
  length: 0.8,
  width: 0.7,
  acceleration: 1,
  deceleration: 1,
  maxVelocity: 4,
  centripetalAcceleration: 2,
};

describe('CanvasRenderer', () => {
  it('activePathTiming の有無で isVelocityOverlayVisible の伝搬を切り替える', () => {
    const stageRef = createRef<Konva.Stage>();

    const { rerender } = render(
      <CanvasRenderer
        stageRef={stageRef}
        viewportSize={viewportSize}
        canvasTransform={canvasTransform}
        mode="path"
        scene={createScene(null)}
        rMinDragTargets={[]}
        backgroundImageElement={null}
        backgroundImageOpacity={1}
        robotAnimation={robotAnimation}
        isRobotAnimationEnabled={false}
        robotSettings={robotSettings}
        snapGuide={EMPTY_SNAP_GUIDE}
        addPointPreview={null}
      />,
    );

    expect(screen.getByTestId('canvas-resolved-path-layer')).toHaveAttribute(
      'data-is-velocity-overlay-visible',
      'false',
    );
    expect(
      screen.queryByTestId('canvas-path-velocity-overlay'),
    ).not.toBeInTheDocument();

    rerender(
      <CanvasRenderer
        stageRef={stageRef}
        viewportSize={viewportSize}
        canvasTransform={canvasTransform}
        mode="path"
        scene={createScene(createTiming())}
        rMinDragTargets={[]}
        backgroundImageElement={null}
        backgroundImageOpacity={1}
        robotAnimation={robotAnimation}
        isRobotAnimationEnabled={false}
        robotSettings={robotSettings}
        snapGuide={EMPTY_SNAP_GUIDE}
        addPointPreview={null}
      />,
    );

    expect(screen.getByTestId('canvas-resolved-path-layer')).toHaveAttribute(
      'data-is-velocity-overlay-visible',
      'true',
    );
    expect(
      screen.getByTestId('canvas-path-velocity-overlay'),
    ).toBeInTheDocument();
  });
});
