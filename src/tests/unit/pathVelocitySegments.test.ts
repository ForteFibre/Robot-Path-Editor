import type { TimedPathSegment } from '../../domain/pathTiming';
import {
  buildSegmentMotionProfile,
  type SegmentMotionProfile,
} from '../../domain/pathTimingMotion';
import {
  buildVelocityPolylines,
  getVelocityColor,
} from '../../features/canvas/components/pathVelocitySegments';

const createConstantMotionProfile = (
  distance: number,
  velocity: number,
): SegmentMotionProfile => ({
  kind: distance <= 0 || velocity <= 0 ? 'degenerate' : 'bounded',
  distance,
  duration: velocity > 0 ? distance / velocity : 0,
  startVelocity: velocity,
  endVelocity: velocity,
  speedLimit: velocity,
  peakVelocity: velocity,
  acceleration: 1,
  deceleration: 1,
  accelerationDuration: 0,
  cruiseDuration: velocity > 0 ? distance / velocity : 0,
  decelerationDuration: 0,
  accelerationDistance: 0,
  cruiseDistance: distance,
  decelerationDistance: 0,
});

const createTimedLineSegment = (
  overrides: Partial<TimedPathSegment> = {},
): TimedPathSegment => ({
  geometry: {
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
    rMinOfSection: 1,
    curvatureRadius: null,
  },
  speedLimit: 2,
  startVelocity: 2,
  endVelocity: 2,
  startTime: 0,
  endTime: 0.5,
  motionProfile: createConstantMotionProfile(1, 2),
  ...overrides,
});

const createTimedArcSegment = (
  overrides: Partial<TimedPathSegment> = {},
): TimedPathSegment => ({
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
  motionProfile: createConstantMotionProfile(Math.PI / 2, 2),
  ...overrides,
});

const createAcceleratingMotionProfile = (
  distance: number,
  startVelocity: number,
  endVelocity: number,
): SegmentMotionProfile => {
  const acceleration =
    distance > 0
      ? (endVelocity * endVelocity - startVelocity * startVelocity) /
        (2 * distance)
      : 1;

  return buildSegmentMotionProfile(
    distance,
    startVelocity,
    endVelocity,
    endVelocity,
    {
      acceleration: Math.max(acceleration, 1),
      deceleration: Math.max(acceleration, 1),
    },
  );
};

describe('pathVelocitySegments', () => {
  it('maps the minimum velocity ratio to red', () => {
    expect(getVelocityColor(0)).toBe('hsl(0, 85%, 50%)');
  });

  it('maps the maximum velocity ratio to green', () => {
    expect(getVelocityColor(1)).toBe('hsl(120, 85%, 50%)');
  });

  it('returns no segments for empty timed segments', () => {
    expect(buildVelocityPolylines([], 4)).toEqual([]);
  });

  it('normalizes segment colors by the configured max velocity', () => {
    const segments = [
      createTimedLineSegment(),
      createTimedLineSegment({
        geometry: {
          kind: 'line',
          sectionIndex: 1,
          length: 1,
          startDistance: 1,
          endDistance: 2,
          startX: 1,
          startY: 0,
          endX: 2,
          endY: 0,
          startHeadingDeg: 0,
          endHeadingDeg: 0,
          startHeadingRad: 0,
          endHeadingRad: 0,
          rMinOfSection: 1,
          curvatureRadius: null,
        },
        speedLimit: 4,
        startVelocity: 4,
        endVelocity: 4,
        startTime: 0.5,
        endTime: 0.75,
        motionProfile: createConstantMotionProfile(1, 4),
      }),
    ];

    expect(buildVelocityPolylines(segments, 8)).toEqual([
      {
        kind: 'line',
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
        color: getVelocityColor(0.25),
      },
      {
        kind: 'line',
        start: { x: 1, y: 0 },
        end: { x: 2, y: 0 },
        color: getVelocityColor(0.5),
      },
    ]);
  });

  it('supports zoom-dependent bin counts when quantizing colors', () => {
    const segments = [
      createTimedLineSegment({
        speedLimit: 2.56,
        startVelocity: 2.56,
        endVelocity: 2.56,
        motionProfile: createConstantMotionProfile(1, 2.56),
      }),
      createTimedLineSegment({
        geometry: {
          kind: 'line',
          sectionIndex: 1,
          length: 1,
          startDistance: 1,
          endDistance: 2,
          startX: 1,
          startY: 0,
          endX: 2,
          endY: 0,
          startHeadingDeg: 0,
          endHeadingDeg: 0,
          startHeadingRad: 0,
          endHeadingRad: 0,
          rMinOfSection: 1,
          curvatureRadius: null,
        },
        speedLimit: 4,
        startVelocity: 4,
        endVelocity: 4,
        startTime: 0.5,
        endTime: 0.75,
        motionProfile: createConstantMotionProfile(1, 4),
      }),
    ];

    expect(buildVelocityPolylines(segments, 5, 24)[0]?.color).toBe(
      'hsl(60, 85%, 50%)',
    );
    expect(buildVelocityPolylines(segments, 5, 96)[0]?.color).toBe(
      'hsl(61, 85%, 50%)',
    );
  });

  it('subdivides long breakpoint intervals by the configured maximum world step length', () => {
    const segments = [
      createTimedLineSegment({
        startVelocity: 0,
        endVelocity: 4,
        speedLimit: 4,
        motionProfile: createAcceleratingMotionProfile(1, 0, 4),
      }),
    ];

    expect(buildVelocityPolylines(segments, 4, 8, 0.25)).toEqual([
      {
        kind: 'line',
        start: { x: 0, y: 0 },
        end: { x: 0.25, y: 0 },
        color: getVelocityColor(0.125),
      },
      {
        kind: 'line',
        start: { x: 0.25, y: 0 },
        end: { x: 0.5, y: 0 },
        color: getVelocityColor(0.375),
      },
      {
        kind: 'line',
        start: { x: 0.5, y: 0 },
        end: { x: 0.75, y: 0 },
        color: getVelocityColor(0.625),
      },
      {
        kind: 'line',
        start: { x: 0.75, y: 0 },
        end: { x: 1, y: 0 },
        color: getVelocityColor(0.875),
      },
    ]);
  });

  it('merges contiguous line steps when they quantize to the same color bin', () => {
    expect(
      buildVelocityPolylines([createTimedLineSegment()], 2, 24, 0.5),
    ).toEqual([
      {
        kind: 'line',
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
        color: getVelocityColor(1),
      },
    ]);
  });

  it('subdivides arcs into partial arc segments when the maximum world step length is small', () => {
    const segments = buildVelocityPolylines(
      [
        createTimedArcSegment({
          speedLimit: 4,
          startVelocity: 0,
          endVelocity: 4,
          motionProfile: createAcceleratingMotionProfile(Math.PI / 2, 0, 4),
        }),
      ],
      4,
      8,
      0.5,
    );

    const arcSegments = segments.filter(
      (
        segment,
      ): segment is Extract<(typeof segments)[number], { kind: 'arc' }> =>
        segment.kind === 'arc',
    );

    expect(arcSegments).toHaveLength(4);
    expect(
      arcSegments.reduce(
        (totalSweep, segment) => totalSweep + segment.sweepRad,
        0,
      ),
    ).toBeCloseTo(Math.PI / 2);
  });

  it('preserves negative sweep directions for clockwise arc subdivisions', () => {
    const segments = buildVelocityPolylines(
      [
        createTimedArcSegment({
          geometry: {
            kind: 'arc',
            sectionIndex: 0,
            length: Math.PI / 2,
            startDistance: 0,
            endDistance: Math.PI / 2,
            startX: 0,
            startY: 1,
            endX: 1,
            endY: 0,
            startHeadingDeg: 90,
            endHeadingDeg: 0,
            startHeadingRad: Math.PI / 2,
            endHeadingRad: 0,
            rMinOfSection: 1,
            curvatureRadius: 1,
            turningRadius: 1,
            centerX: 0,
            centerY: 0,
            startAngleRad: Math.PI / 2,
            sweepRad: -Math.PI / 2,
          },
          speedLimit: 4,
          startVelocity: 0,
          endVelocity: 4,
          motionProfile: createAcceleratingMotionProfile(Math.PI / 2, 0, 4),
        }),
      ],
      4,
      8,
      0.5,
    );

    const arcSegments = segments.filter(
      (
        segment,
      ): segment is Extract<(typeof segments)[number], { kind: 'arc' }> =>
        segment.kind === 'arc',
    );

    expect(arcSegments).toHaveLength(4);
    expect(arcSegments.every((segment) => segment.sweepRad < 0)).toBe(true);
    expect(
      arcSegments.reduce(
        (totalSweep, segment) => totalSweep + segment.sweepRad,
        0,
      ),
    ).toBeCloseTo(-Math.PI / 2);
  });

  it('preserves arc geometry as analytic arc render segments', () => {
    expect(buildVelocityPolylines([createTimedArcSegment()], 2)).toEqual([
      {
        kind: 'arc',
        center: { x: 0, y: 0 },
        radius: 1,
        startAngleRad: 0,
        sweepRad: Math.PI / 2,
        color: getVelocityColor(1),
      },
    ]);
  });
});
