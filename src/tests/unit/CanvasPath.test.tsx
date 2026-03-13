import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HeadingSample } from '../../domain/interpolation';
import type { ResolvedPathModel } from '../../domain/pointResolution';
import type { PathGeometrySegment } from '../../domain/pathTimingSegments';
import {
  CanvasPath,
  toCanvasPathSegmentRenderData,
} from '../../features/canvas/components/CanvasPath';

type KonvaLineMockProps = {
  points?: number[];
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  opacity?: number;
};

type KonvaShapeMockProps = {
  stroke?: string;
  strokeWidth?: number;
};

const readKonvaLineMockProps = (props: unknown): KonvaLineMockProps => {
  return (props ?? {}) as KonvaLineMockProps;
};

const readKonvaShapeMockProps = (props: unknown): KonvaShapeMockProps => {
  return (props ?? {}) as KonvaShapeMockProps;
};

vi.mock('react-konva', async () => {
  const React = await import('react');

  return {
    Line: (props: unknown) => {
      const resolvedProps = readKonvaLineMockProps(props);

      return React.createElement('div', {
        'data-testid': 'konva-line',
        'data-points': JSON.stringify(resolvedProps.points ?? []),
        'data-stroke': resolvedProps.stroke ?? '',
        'data-stroke-width': resolvedProps.strokeWidth?.toString() ?? '',
        'data-fill': resolvedProps.fill ?? '',
        'data-opacity': resolvedProps.opacity?.toString() ?? '',
      });
    },
    Shape: (props: unknown) => {
      const resolvedProps = readKonvaShapeMockProps(props);

      return React.createElement('div', {
        'data-testid': 'konva-shape',
        'data-stroke': resolvedProps.stroke ?? '',
        'data-stroke-width': resolvedProps.strokeWidth?.toString() ?? '',
      });
    },
  };
});

const path: ResolvedPathModel = {
  id: 'path-1',
  name: 'Path 1',
  color: '#ff0000',
  visible: true,
  waypoints: [],
  headingKeyframes: [],
  sectionRMin: [],
};

const samples: HeadingSample[] = [
  {
    x: 0,
    y: 0,
    pathHeading: 0,
    robotHeading: 0,
    curvatureRadius: null,
    rMinOfSection: 0.5,
  },
  {
    x: 1,
    y: 0,
    pathHeading: 0,
    robotHeading: 0,
    curvatureRadius: null,
    rMinOfSection: 0.5,
  },
];

const geometrySegments: PathGeometrySegment[] = [
  {
    kind: 'line',
    sectionIndex: 0,
    length: 1,
    startDistance: 0,
    endDistance: 1,
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 0,
    startHeadingDeg: 0,
    endHeadingDeg: 0,
    startHeadingRad: 0,
    endHeadingRad: 0,
    rMinOfSection: 0.5,
    curvatureRadius: null,
  },
];

describe('CanvasPath', () => {
  it('renders the visible stroke for active paths when suppression is disabled', () => {
    render(
      <CanvasPath
        path={path}
        geometrySegments={geometrySegments}
        discretizedSamples={samples}
        k={1}
        isActive={true}
        suppressActiveStroke={false}
        mode="path"
      />,
    );

    const lines = screen.getAllByTestId('konva-line');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveAttribute(
      'data-points',
      JSON.stringify([0, 0, -0, -1]),
    );
  });

  it('does not render active path stroke when suppression is enabled', () => {
    render(
      <CanvasPath
        path={path}
        geometrySegments={geometrySegments}
        discretizedSamples={samples}
        k={1}
        isActive={true}
        suppressActiveStroke={true}
        mode="path"
      />,
    );

    expect(screen.queryByTestId('konva-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('konva-shape')).not.toBeInTheDocument();
  });

  it('heading mode では suppression 中でも heading glyph を維持し、path.color の本体ストロークのみ抑制する', () => {
    render(
      <CanvasPath
        path={path}
        geometrySegments={geometrySegments}
        discretizedSamples={samples}
        k={1}
        isActive={true}
        suppressActiveStroke={true}
        mode="heading"
      />,
    );

    const lines = screen.getAllByTestId('konva-line');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveAttribute('data-stroke', '');
    expect(lines[0]).toHaveAttribute('data-fill', '#ff0000');
    expect(lines[0]).toHaveAttribute('data-opacity', '0.9');
    expect(screen.queryByTestId('konva-shape')).not.toBeInTheDocument();
  });

  it('keeps non-active path stroke rendering even when suppression flag is enabled', () => {
    render(
      <CanvasPath
        path={path}
        geometrySegments={geometrySegments}
        discretizedSamples={samples}
        k={1}
        isActive={false}
        suppressActiveStroke={true}
        mode="path"
      />,
    );

    expect(screen.getAllByTestId('konva-line')).toHaveLength(1);
  });

  it('converts arc geometry into Konva render data with canvas-space angles', () => {
    const renderData = toCanvasPathSegmentRenderData({
      kind: 'arc',
      sectionIndex: 0,
      length: Math.PI / 2,
      startDistance: 0,
      endDistance: Math.PI / 2,
      startX: 1,
      startY: 0,
      endX: 0,
      endY: 1,
      startHeadingDeg: 0,
      endHeadingDeg: 90,
      startHeadingRad: 0,
      endHeadingRad: Math.PI / 2,
      rMinOfSection: 1,
      curvatureRadius: 1,
      turningRadius: 1,
      centerX: 0,
      centerY: 0,
      startAngleRad: 0,
      sweepRad: Math.PI / 2,
    });

    expect(renderData).toMatchObject({
      kind: 'arc',
      center: { x: -0, y: -0 },
      radius: 1,
      anticlockwise: true,
    });
    if (renderData.kind !== 'arc') {
      throw new Error('expected arc render data');
    }

    expect(renderData.startAngle).toBeCloseTo(-Math.PI / 2);
    expect(renderData.endAngle).toBeCloseTo(-Math.PI);
  });
});
