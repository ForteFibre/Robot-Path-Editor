import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PathTiming } from '../../domain/pathTiming';
import { buildSegmentMotionProfile } from '../../domain/pathTimingMotion';
import { CanvasPathVelocityOverlay } from '../../features/canvas/components/CanvasPathVelocityOverlay';
import * as pathVelocitySegmentsModule from '../../features/canvas/components/pathVelocitySegments';

type KonvaLineMockProps = {
  points?: number[];
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
};

type KonvaShapeMockProps = {
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  sceneFunc?: (context: CanvasRenderingContext2D, shape: object) => void;
};

const readKonvaLineMockProps = (props: unknown): KonvaLineMockProps => {
  return (props ?? {}) as KonvaLineMockProps;
};

const readKonvaShapeMockProps = (props: unknown): KonvaShapeMockProps => {
  return (props ?? {}) as KonvaShapeMockProps;
};

const recordedShapeProps: unknown[] = [];

type LineSegmentOptions = {
  sectionIndex: number;
  startDistance: number;
  endDistance: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  velocity?: number;
  startVelocity?: number;
  endVelocity?: number;
  motionProfile?: PathTiming['segments'][number]['motionProfile'];
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
        'data-opacity': resolvedProps.opacity?.toString() ?? '',
      });
    },
    Shape: (props: unknown) => {
      const resolvedProps = readKonvaShapeMockProps(props);
      recordedShapeProps.push(resolvedProps);

      return React.createElement('div', {
        'data-testid': 'konva-shape',
        'data-stroke': resolvedProps.stroke ?? '',
        'data-stroke-width': resolvedProps.strokeWidth?.toString() ?? '',
        'data-opacity': resolvedProps.opacity?.toString() ?? '',
      });
    },
  };
});

const createLineSegment = ({
  sectionIndex,
  startDistance,
  endDistance,
  startX,
  startY,
  endX,
  endY,
  velocity = 0,
  startVelocity = velocity,
  endVelocity = velocity,
  motionProfile,
}: LineSegmentOptions): PathTiming['segments'][number] => ({
  geometry: {
    kind: 'line',
    sectionIndex,
    length: endDistance - startDistance,
    startDistance,
    endDistance,
    startX,
    startY,
    endX,
    endY,
    startHeadingDeg: 45,
    endHeadingDeg: 45,
    startHeadingRad: Math.PI / 4,
    endHeadingRad: Math.PI / 4,
    rMinOfSection: 0.5,
    curvatureRadius: null,
  },
  speedLimit: velocity,
  startVelocity,
  endVelocity,
  startTime: 0,
  endTime: endDistance - startDistance,
  motionProfile: motionProfile ?? {
    kind: 'bounded',
    distance: endDistance - startDistance,
    duration: endDistance - startDistance,
    startVelocity,
    endVelocity,
    speedLimit: Math.max(velocity, startVelocity, endVelocity),
    peakVelocity: Math.max(velocity, startVelocity, endVelocity),
    acceleration: 1,
    deceleration: 1,
    accelerationDuration: 0,
    cruiseDuration: endDistance - startDistance,
    decelerationDuration: 0,
    accelerationDistance: 0,
    cruiseDistance: endDistance - startDistance,
    decelerationDistance: 0,
  },
});

const createTiming = (
  segments = [
    createLineSegment({
      sectionIndex: 0,
      startDistance: 0,
      endDistance: 2,
      startX: 1,
      startY: 2,
      endX: 3,
      endY: 4,
      velocity: 0.75,
    }),
  ],
): PathTiming => {
  const totalDistance = segments.reduce(
    (distance, segment) => distance + segment.geometry.length,
    0,
  );
  const totalTime = segments.reduce(
    (duration, segment) => duration + segment.endTime,
    0,
  );

  return {
    samples: [],
    waypointTimings: [],
    totalDistance,
    totalTime,
    maxVelocity: 4,
    motionSettings: {
      acceleration: 1,
      deceleration: 1,
    },
    segments,
    headingProfile: {
      kind: 'implicit',
      totalDistance,
      startHeading: 0,
      endHeading: 0,
    },
  };
};

describe('CanvasPathVelocityOverlay', () => {
  it('renders velocity segments in canvas coordinates with scale-aware stroke width', () => {
    recordedShapeProps.length = 0;
    render(<CanvasPathVelocityOverlay timing={createTiming()} k={4} />);

    const lines = screen.getAllByTestId('konva-line');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveAttribute(
      'data-points',
      JSON.stringify([-2, -1, -4, -3]),
    );
    expect(lines[0]).toHaveAttribute('data-stroke', 'hsl(23, 85%, 50%)');
    expect(lines[0]).toHaveAttribute('data-stroke-width', '0.5');
    expect(lines[0]).toHaveAttribute('data-opacity', '0.55');
  });

  it('recomputes quantized velocity colors when the zoom level changes', () => {
    const timing = createTiming([
      createLineSegment({
        sectionIndex: 0,
        startDistance: 0,
        endDistance: 1,
        startX: 1,
        startY: 2,
        endX: 3,
        endY: 4,
        velocity: 2.56,
      }),
      createLineSegment({
        sectionIndex: 1,
        startDistance: 1,
        endDistance: 2,
        startX: 3,
        startY: 4,
        endX: 5,
        endY: 6,
        velocity: 4,
      }),
    ]);

    const { rerender } = render(
      <CanvasPathVelocityOverlay timing={timing} k={1} />,
    );

    let lines = screen.getAllByTestId('konva-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute('data-stroke', 'hsl(75, 85%, 50%)');
    expect(lines[1]).toHaveAttribute('data-stroke', 'hsl(120, 85%, 50%)');
    expect(lines[0]).toHaveAttribute('data-stroke-width', '2');

    rerender(<CanvasPathVelocityOverlay timing={timing} k={4} />);

    lines = screen.getAllByTestId('konva-line');
    expect(lines[0]).toHaveAttribute('data-stroke', 'hsl(76, 85%, 50%)');
    expect(lines[1]).toHaveAttribute('data-stroke', 'hsl(120, 85%, 50%)');
    expect(lines[0]).toHaveAttribute('data-stroke-width', '0.5');
  });

  it('increases the velocity overlay sampling density as the zoom level increases', () => {
    const timing = createTiming([
      createLineSegment({
        sectionIndex: 0,
        startDistance: 0,
        endDistance: 1,
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 0,
        velocity: 4,
        startVelocity: 0,
        endVelocity: 4,
        motionProfile: buildSegmentMotionProfile(1, 0, 4, 4, {
          acceleration: 8,
          deceleration: 8,
        }),
      }),
    ]);

    const { rerender } = render(
      <CanvasPathVelocityOverlay timing={timing} k={1} />,
    );

    expect(screen.getAllByTestId('konva-line')).toHaveLength(10);

    rerender(<CanvasPathVelocityOverlay timing={timing} k={4} />);

    expect(screen.getAllByTestId('konva-line')).toHaveLength(40);
  });

  it('passes zoom-dependent binning and sampling arguments to buildVelocityPolylines', () => {
    const timing = createTiming();
    const buildVelocityPolylinesSpy = vi
      .spyOn(pathVelocitySegmentsModule, 'buildVelocityPolylines')
      .mockReturnValue([]);

    const { rerender } = render(
      <CanvasPathVelocityOverlay timing={timing} k={1} />,
    );

    expect(buildVelocityPolylinesSpy).toHaveBeenNthCalledWith(
      1,
      timing.segments,
      timing.maxVelocity,
      24,
      0.1,
    );

    rerender(<CanvasPathVelocityOverlay timing={timing} k={4} />);

    expect(buildVelocityPolylinesSpy).toHaveBeenNthCalledWith(
      2,
      timing.segments,
      timing.maxVelocity,
      96,
      0.025,
    );

    buildVelocityPolylinesSpy.mockRestore();
  });

  it('does not render anything when timing has no segments', () => {
    const timing = createTiming();
    timing.segments = [];

    render(<CanvasPathVelocityOverlay timing={timing} k={1} />);

    expect(screen.queryByTestId('konva-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('konva-shape')).not.toBeInTheDocument();
  });

  it('renders curved velocity overlays with analytic arc drawing', () => {
    recordedShapeProps.length = 0;
    const timing = createTiming();
    timing.segments = [
      {
        geometry: {
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
        },
        speedLimit: 2,
        startVelocity: 2,
        endVelocity: 2,
        startTime: 0,
        endTime: Math.PI / 4,
        motionProfile: {
          kind: 'bounded',
          distance: Math.PI / 2,
          duration: Math.PI / 4,
          startVelocity: 2,
          endVelocity: 2,
          speedLimit: 2,
          peakVelocity: 2,
          acceleration: 1,
          deceleration: 1,
          accelerationDuration: 0,
          cruiseDuration: Math.PI / 4,
          decelerationDuration: 0,
          accelerationDistance: 0,
          cruiseDistance: Math.PI / 2,
          decelerationDistance: 0,
        },
      },
    ];

    render(<CanvasPathVelocityOverlay timing={timing} k={1} />);

    const shapes = screen.getAllByTestId('konva-shape');
    expect(shapes).toHaveLength(1);

    const shapeProps = readKonvaShapeMockProps(recordedShapeProps[0]);
    const beginPath = vi.fn();
    const arc = vi.fn();
    const strokeShape = vi.fn();
    const context = {
      beginPath,
      arc,
      strokeShape,
    } as unknown as CanvasRenderingContext2D;
    const shape = {};

    shapeProps.sceneFunc?.(context, shape);

    expect(beginPath).toHaveBeenCalledTimes(1);
    expect(arc).toHaveBeenCalledWith(-0, -0, 1, -Math.PI / 2, -Math.PI, true);
    expect(strokeShape).toHaveBeenCalledWith(shape);
  });
});
