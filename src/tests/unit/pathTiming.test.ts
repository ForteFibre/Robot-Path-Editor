import {
  computePathTiming,
  getLoopedPathTime,
  sampleTimedPathAtTime,
} from '../../domain/pathTiming';
import * as interpolation from '../../domain/interpolation';
import type {
  PathModel,
  Point,
  RobotMotionSettings,
} from '../../domain/models';
import { vi } from 'vitest';

const createStraightPath = (
  distance: number,
): {
  path: PathModel;
  points: Point[];
} => {
  const startPointId = 'pt-start';
  const endPointId = 'pt-end';

  return {
    points: [
      {
        id: startPointId,
        x: 0,
        y: 0,
        robotHeading: 0,
        isLibrary: false,
        name: 'WP 1',
      },
      {
        id: endPointId,
        x: distance,
        y: 0,
        robotHeading: 0,
        isLibrary: false,
        name: 'WP 2',
      },
    ],
    path: {
      id: 'path-1',
      name: 'Path 1',
      color: '#1f77b4',
      visible: true,
      waypoints: [
        {
          id: 'wp-1',
          pointId: startPointId,
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'wp-2',
          pointId: endPointId,
          libraryPointId: null,
          pathHeading: 0,
        },
      ],
      headingKeyframes: [],
      sectionRMin: [null],
    },
  };
};

const createQuarterTurnPath = (): {
  path: PathModel;
  points: Point[];
} => {
  return {
    points: [
      {
        id: 'arc-start',
        x: 0,
        y: 0,
        robotHeading: 0,
        isLibrary: false,
        name: 'WP Start',
      },
      {
        id: 'arc-end',
        x: 1,
        y: 1,
        robotHeading: 90,
        isLibrary: false,
        name: 'WP End',
      },
    ],
    path: {
      id: 'path-quarter-turn',
      name: 'Quarter Turn',
      color: '#1f77b4',
      visible: true,
      waypoints: [
        {
          id: 'wp-start',
          pointId: 'arc-start',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'wp-end',
          pointId: 'arc-end',
          libraryPointId: null,
          pathHeading: 90,
        },
      ],
      headingKeyframes: [],
      sectionRMin: [1],
    },
  };
};

const createStraightCurveStraightPath = (): {
  path: PathModel;
  points: Point[];
} => {
  return {
    points: [
      {
        id: 'p-1',
        x: 0,
        y: 0,
        robotHeading: 0,
        isLibrary: false,
        name: 'WP 1',
      },
      {
        id: 'p-2',
        x: 6,
        y: 0,
        robotHeading: 0,
        isLibrary: false,
        name: 'WP 2',
      },
      {
        id: 'p-3',
        x: 7,
        y: 1,
        robotHeading: 90,
        isLibrary: false,
        name: 'WP 3',
      },
      {
        id: 'p-4',
        x: 7,
        y: 7,
        robotHeading: 90,
        isLibrary: false,
        name: 'WP 4',
      },
    ],
    path: {
      id: 'path-straight-curve-straight',
      name: 'Straight Curve Straight',
      color: '#1f77b4',
      visible: true,
      waypoints: [
        {
          id: 'wp-1',
          pointId: 'p-1',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'wp-2',
          pointId: 'p-2',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'wp-3',
          pointId: 'p-3',
          libraryPointId: null,
          pathHeading: 90,
        },
        {
          id: 'wp-4',
          pointId: 'p-4',
          libraryPointId: null,
          pathHeading: 90,
        },
      ],
      headingKeyframes: [],
      sectionRMin: [null, 1, null],
    },
  };
};

const DEFAULT_SETTINGS: RobotMotionSettings = {
  length: 0.9,
  width: 0.7,
  acceleration: 1,
  deceleration: 1,
  maxVelocity: 10,
  centripetalAcceleration: 10,
};

describe('pathTiming', () => {
  it('computes a triangular profile for a short straight path', () => {
    const { path, points } = createStraightPath(1);

    const timing = computePathTiming(path, points, DEFAULT_SETTINGS);

    expect(timing.totalDistance).toBeCloseTo(1, 3);
    expect(timing.totalTime).toBeCloseTo(2, 2);
    expect(timing.waypointTimings[0]?.time).toBe(0);
    expect(timing.waypointTimings[1]?.time).toBeCloseTo(2, 2);
  });

  it('honors the max velocity cap on a long straight path', () => {
    const { path, points } = createStraightPath(10);

    const timing = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      maxVelocity: 2,
    });

    const peakVelocity = Math.max(
      ...timing.samples.map((sample) => sample.velocity),
    );

    expect(peakVelocity).toBeLessThanOrEqual(2.001);
    expect(timing.totalTime).toBeCloseTo(7, 1);
  });

  it('limits speed on curved sections using centripetal acceleration', () => {
    const points: Point[] = [
      {
        id: 'a',
        x: 0,
        y: 0,
        robotHeading: 0,
        isLibrary: false,
        name: 'WP A',
      },
      {
        id: 'b',
        x: 1,
        y: 1,
        robotHeading: 90,
        isLibrary: false,
        name: 'WP B',
      },
    ];
    const path: PathModel = {
      id: 'curve-path',
      name: 'Curve',
      color: '#1f77b4',
      visible: true,
      waypoints: [
        {
          id: 'wp-a',
          pointId: 'a',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'wp-b',
          pointId: 'b',
          libraryPointId: null,
          pathHeading: 90,
        },
      ],
      headingKeyframes: [],
      sectionRMin: [0.5],
    };

    const timing = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      maxVelocity: 5,
      acceleration: 20,
      deceleration: 20,
      centripetalAcceleration: 0.5,
    });

    const curvedSampleVelocities = timing.samples
      .filter((sample) => sample.curvatureRadius !== null)
      .map((sample) => sample.velocity);
    const peakVelocity = Math.max(...curvedSampleVelocities);

    expect(peakVelocity).toBeLessThanOrEqual(0.501);
  });

  it('propagates reduced boundary velocities into and out of a slow curve', () => {
    const { path, points } = createStraightCurveStraightPath();
    const timing = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      acceleration: 8,
      deceleration: 8,
      maxVelocity: 5,
      centripetalAcceleration: 0.5,
    });

    const curvedSegmentIndices = timing.segments
      .map((segment, index) =>
        segment.geometry.curvatureRadius === null ? -1 : index,
      )
      .filter((index) => index >= 0);
    const firstCurvedSegmentIndex = curvedSegmentIndices[0];
    const lastCurvedSegmentIndex = curvedSegmentIndices.at(-1);

    if (
      firstCurvedSegmentIndex === undefined ||
      lastCurvedSegmentIndex === undefined
    ) {
      throw new Error('expected curved segments in the test path');
    }

    const beforeCurve = timing.segments[firstCurvedSegmentIndex - 1];
    const firstCurved = timing.segments[firstCurvedSegmentIndex];
    const lastCurved = timing.segments[lastCurvedSegmentIndex];
    const afterCurve = timing.segments[lastCurvedSegmentIndex + 1];

    if (
      beforeCurve === undefined ||
      firstCurved === undefined ||
      lastCurved === undefined ||
      afterCurve === undefined
    ) {
      throw new Error('expected segments around the curved section');
    }

    const maxStraightPeakVelocity = Math.max(
      ...timing.segments
        .filter((segment) => segment.geometry.curvatureRadius === null)
        .map((segment) => segment.motionProfile.peakVelocity),
    );

    expect(firstCurved.speedLimit).toBeLessThan(beforeCurve.speedLimit);
    expect(lastCurved.speedLimit).toBeLessThan(afterCurve.speedLimit);
    expect(maxStraightPeakVelocity).toBeGreaterThan(firstCurved.speedLimit + 1);
    expect(beforeCurve.endVelocity).toBeCloseTo(firstCurved.startVelocity, 9);
    expect(afterCurve.startVelocity).toBeCloseTo(lastCurved.endVelocity, 9);
    expect(beforeCurve.endVelocity).toBeLessThanOrEqual(
      firstCurved.speedLimit + 1e-9,
    );
    expect(afterCurve.startVelocity).toBeLessThanOrEqual(
      lastCurved.speedLimit + 1e-9,
    );
  });

  it('keeps adjacent segment boundary velocities continuous', () => {
    const { path, points } = createStraightCurveStraightPath();
    const timing = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      acceleration: 8,
      deceleration: 8,
      maxVelocity: 5,
      centripetalAcceleration: 0.5,
    });

    expect(timing.segments.length).toBeGreaterThan(1);

    timing.segments.slice(0, -1).forEach((segment, index) => {
      const nextSegment = timing.segments[index + 1];

      expect(nextSegment).toBeDefined();
      expect(segment.endVelocity).toBeCloseTo(
        nextSegment?.startVelocity ?? Number.NaN,
        9,
      );
    });
  });

  it('samples pose by time along the timed path', () => {
    const { path, points } = createStraightPath(2);
    const timing = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      maxVelocity: 1,
    });

    const pose = sampleTimedPathAtTime(timing, timing.totalTime / 2);

    expect(pose).not.toBeNull();
    expect(pose?.x).toBeGreaterThan(0.5);
    expect(pose?.x).toBeLessThan(1.5);
    expect(pose?.velocity).toBeGreaterThan(0);
  });

  it('loops animation time with waits at both ends of the path', () => {
    const totalTime = 4;
    const startWaitSeconds = 1.5;
    const endWaitSeconds = 1.5;

    expect(
      getLoopedPathTime(0.8, totalTime, startWaitSeconds, endWaitSeconds),
    ).toBe(0);
    expect(
      getLoopedPathTime(1.5, totalTime, startWaitSeconds, endWaitSeconds),
    ).toBe(0);
    expect(
      getLoopedPathTime(2, totalTime, startWaitSeconds, endWaitSeconds),
    ).toBeCloseTo(0.5, 9);
    expect(
      getLoopedPathTime(5.8, totalTime, startWaitSeconds, endWaitSeconds),
    ).toBe(4);
    expect(
      getLoopedPathTime(7.2, totalTime, startWaitSeconds, endWaitSeconds),
    ).toBe(0);
  });

  it('samples curved poses analytically along a curved path', () => {
    const { path, points } = createQuarterTurnPath();
    const timing = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      acceleration: 2,
      deceleration: 2,
      maxVelocity: 10,
      centripetalAcceleration: 20,
    });

    const midpointPose = sampleTimedPathAtTime(timing, timing.totalTime / 2);

    expect(midpointPose).not.toBeNull();
    expect(midpointPose?.x).toBeCloseTo(Math.SQRT1_2, 3);
    expect(midpointPose?.y).toBeCloseTo(1 - Math.SQRT1_2, 3);
  });

  it('uses segment kinematics instead of raw time ratio inside a segment', () => {
    const { path, points } = createStraightPath(0.01);
    const timing = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      acceleration: 1,
      deceleration: 1,
      maxVelocity: 100,
    });

    const quarterPose = sampleTimedPathAtTime(timing, timing.totalTime / 4);
    const midpointPose = sampleTimedPathAtTime(timing, timing.totalTime / 2);

    expect(timing.samples).toHaveLength(3);
    expect(timing.totalTime).toBeCloseTo(0.2, 6);
    expect(quarterPose).not.toBeNull();
    expect(midpointPose).not.toBeNull();
    expect(quarterPose?.x).toBeCloseTo(0.00125, 6);
    expect(quarterPose?.x).toBeLessThan(0.002);
    expect(midpointPose?.x).toBeCloseTo(0.005, 6);
  });

  it('reuses cached timing analysis without discretizing the path', () => {
    const { path, points } = createStraightPath(1.5);
    const discretizeSpy = vi.spyOn(interpolation, 'discretizePathDetailed');

    const firstTiming = computePathTiming(path, points, DEFAULT_SETTINGS);
    const secondTiming = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
    });

    expect(secondTiming).toBe(firstTiming);
    expect(discretizeSpy).not.toHaveBeenCalled();
  });

  it('reuses cached timing when only robot geometry changes', () => {
    const { path, points } = createStraightPath(1.5);

    const firstTiming = computePathTiming(path, points, DEFAULT_SETTINGS);
    const secondTiming = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      length: 1.4,
      width: 1.1,
    });

    expect(secondTiming).toBe(firstTiming);
    expect(secondTiming.totalTime).toBe(firstTiming.totalTime);
  });

  it.each([
    {
      label: 'acceleration',
      faster: { acceleration: 2 },
      slower: { acceleration: 0.5 },
    },
    {
      label: 'deceleration',
      faster: { deceleration: 2 },
      slower: { deceleration: 0.5 },
    },
  ])('changes total time when %s changes', ({ faster, slower }) => {
    const { path, points } = createStraightPath(4);

    const fasterTiming = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      maxVelocity: 10,
      ...faster,
    });
    const slowerTiming = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      maxVelocity: 10,
      ...slower,
    });

    expect(slowerTiming.totalTime).toBeGreaterThan(fasterTiming.totalTime);
    expect(slowerTiming.waypointTimings.at(-1)?.time).toBeCloseTo(
      slowerTiming.totalTime,
      6,
    );
  });

  it('changes total time when centripetal acceleration changes', () => {
    const points: Point[] = [
      {
        id: 'a',
        x: 0,
        y: 0,
        robotHeading: 0,
        isLibrary: false,
        name: 'WP A',
      },
      {
        id: 'b',
        x: 1,
        y: 1,
        robotHeading: 90,
        isLibrary: false,
        name: 'WP B',
      },
    ];
    const path: PathModel = {
      id: 'curve-path-for-time',
      name: 'Curve Time',
      color: '#1f77b4',
      visible: true,
      waypoints: [
        {
          id: 'wp-a',
          pointId: 'a',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'wp-b',
          pointId: 'b',
          libraryPointId: null,
          pathHeading: 90,
        },
      ],
      headingKeyframes: [],
      sectionRMin: [0.5],
    };

    const relaxedTiming = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      maxVelocity: 5,
      acceleration: 20,
      deceleration: 20,
      centripetalAcceleration: 2,
    });
    const constrainedTiming = computePathTiming(path, points, {
      ...DEFAULT_SETTINGS,
      maxVelocity: 5,
      acceleration: 20,
      deceleration: 20,
      centripetalAcceleration: 0.5,
    });

    expect(constrainedTiming.totalTime).toBeGreaterThan(
      relaxedTiming.totalTime,
    );
  });
});
