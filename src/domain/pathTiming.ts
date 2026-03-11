import {
  normalizeRobotMotionSettings,
  type PathModel,
  type Point,
  type RobotMotionSettings,
} from './models';
import {
  buildSegmentMotionProfile,
  getSegmentDistanceAtTime,
  getSegmentTimeAtDistance,
  getSegmentVelocityAtTime,
  type SegmentMotionProfile,
  type TimingMotionSettings,
} from './pathTimingMotion';
import { getEffectiveWaypointName } from './naming';
import {
  buildPathTimingGeometry,
  sampleGeometrySegmentAtDistance,
  sampleRobotHeadingAtDistance,
  type PathGeometrySegment,
  type PathSectionBoundary,
  type RobotHeadingProfile,
} from './pathTimingSegments';

const EPSILON = 1e-9;
const ARC_DISPLAY_STEP_RAD = Math.PI / 12;

export type PathTimingSample = {
  x: number;
  y: number;
  pathHeading: number;
  robotHeading: number;
  rMinOfSection: number;
  curvatureRadius: number | null;
  cumulativeDistance: number;
  speedLimit: number;
  velocity: number;
  time: number;
};

export type WaypointTiming = {
  waypointId: string;
  name: string;
  index: number;
  cumulativeDistance: number;
  time: number;
  velocity: number;
};

export type TimedPathSegment = {
  geometry: PathGeometrySegment;
  speedLimit: number;
  startVelocity: number;
  endVelocity: number;
  startTime: number;
  endTime: number;
  motionProfile: SegmentMotionProfile;
};

type PathTimingCacheEntry = {
  path: PathModel;
  points: Point[];
  settingsKey: string;
  timing: PathTiming;
};

const PATH_TIMING_CACHE_LIMIT = 8;
const pathTimingCache: PathTimingCacheEntry[] = [];

export type PathTiming = {
  samples: PathTimingSample[];
  waypointTimings: WaypointTiming[];
  totalDistance: number;
  totalTime: number;
  maxVelocity: number;
  motionSettings: TimingMotionSettings;
  segments: TimedPathSegment[];
  headingProfile: RobotHeadingProfile;
};

export type TimedPathPose = {
  x: number;
  y: number;
  pathHeading: number;
  robotHeading: number;
  velocity: number;
  cumulativeDistance: number;
  time: number;
};

const toTimingMotionSettings = (
  settings: RobotMotionSettings,
): TimingMotionSettings => ({
  acceleration: settings.acceleration,
  deceleration: settings.deceleration,
});

const toTimingCacheSettingsKey = (settings: RobotMotionSettings): string => {
  return [
    settings.acceleration,
    settings.deceleration,
    settings.maxVelocity,
    settings.centripetalAcceleration,
  ].join(':');
};

const getCachedPathTiming = (
  path: PathModel,
  points: Point[],
  settingsKey: string,
): PathTiming | null => {
  const cacheIndex = pathTimingCache.findIndex(
    (entry) =>
      entry.path === path &&
      entry.points === points &&
      entry.settingsKey === settingsKey,
  );

  if (cacheIndex < 0) {
    return null;
  }

  const [entry] = pathTimingCache.splice(cacheIndex, 1);
  if (entry === undefined) {
    return null;
  }

  pathTimingCache.unshift(entry);
  return entry.timing;
};

const storeCachedPathTiming = (
  entry: PathTimingCacheEntry,
): PathTimingCacheEntry['timing'] => {
  pathTimingCache.unshift(entry);
  if (pathTimingCache.length > PATH_TIMING_CACHE_LIMIT) {
    pathTimingCache.length = PATH_TIMING_CACHE_LIMIT;
  }

  return entry.timing;
};

const resolveSegmentSpeedLimit = (
  settings: RobotMotionSettings,
  segment: PathGeometrySegment,
): number => {
  if (segment.curvatureRadius === null) {
    return settings.maxVelocity;
  }

  return Math.min(
    settings.maxVelocity,
    Math.sqrt(settings.centripetalAcceleration * segment.curvatureRadius),
  );
};

const resolveBoundarySpeedLimits = (segmentSpeedLimits: number[]): number[] => {
  if (segmentSpeedLimits.length === 0) {
    return [0];
  }

  return Array.from({ length: segmentSpeedLimits.length + 1 }, (_, index) => {
    if (index === 0 || index === segmentSpeedLimits.length) {
      return 0;
    }

    return Math.min(
      segmentSpeedLimits[index - 1] ?? 0,
      segmentSpeedLimits[index] ?? 0,
    );
  });
};

const computeBoundaryVelocities = (
  segments: PathGeometrySegment[],
  boundarySpeedLimits: number[],
  motionSettings: TimingMotionSettings,
): number[] => {
  if (segments.length === 0) {
    return [0];
  }

  const forwardVelocities = Array.from<number>({
    length: segments.length + 1,
  }).fill(0);

  for (let index = 1; index <= segments.length; index += 1) {
    const geometry = segments[index - 1];
    if (geometry === undefined) {
      continue;
    }

    const previousVelocity = forwardVelocities[index - 1] ?? 0;
    const reachableVelocity = Math.sqrt(
      Math.max(
        0,
        previousVelocity * previousVelocity +
          2 * motionSettings.acceleration * geometry.length,
      ),
    );

    forwardVelocities[index] = Math.min(
      boundarySpeedLimits[index] ?? 0,
      reachableVelocity,
    );
  }

  const resolvedVelocities = [...forwardVelocities];
  resolvedVelocities[segments.length] = 0;

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const geometry = segments[index];
    if (geometry === undefined) {
      continue;
    }

    const nextVelocity = resolvedVelocities[index + 1] ?? 0;
    const reachableVelocity = Math.sqrt(
      Math.max(
        0,
        nextVelocity * nextVelocity +
          2 * motionSettings.deceleration * geometry.length,
      ),
    );

    resolvedVelocities[index] = Math.min(
      resolvedVelocities[index] ?? 0,
      boundarySpeedLimits[index] ?? 0,
      reachableVelocity,
    );
  }

  return resolvedVelocities;
};

const buildTimedSegments = (
  geometrySegments: PathGeometrySegment[],
  settings: RobotMotionSettings,
): TimedPathSegment[] => {
  if (geometrySegments.length === 0) {
    return [];
  }

  const motionSettings = toTimingMotionSettings(settings);
  const segmentSpeedLimits = geometrySegments.map((segment) =>
    resolveSegmentSpeedLimit(settings, segment),
  );
  const boundarySpeedLimits = resolveBoundarySpeedLimits(segmentSpeedLimits);
  const boundaryVelocities = computeBoundaryVelocities(
    geometrySegments,
    boundarySpeedLimits,
    motionSettings,
  );

  let currentTime = 0;

  return geometrySegments.map((geometry, index) => {
    const speedLimit = segmentSpeedLimits[index] ?? 0;
    const startVelocity = boundaryVelocities[index] ?? 0;
    const endVelocity = boundaryVelocities[index + 1] ?? 0;
    const motionProfile = buildSegmentMotionProfile(
      geometry.length,
      startVelocity,
      endVelocity,
      speedLimit,
      motionSettings,
    );
    const startTime = currentTime;
    const endTime = startTime + motionProfile.duration;
    currentTime = endTime;

    return {
      geometry,
      speedLimit,
      startVelocity,
      endVelocity,
      startTime,
      endTime,
      motionProfile,
    };
  });
};

const buildBoundaryTimes = (segments: TimedPathSegment[]): number[] => {
  const times = [0];

  for (const segment of segments) {
    times.push(segment.endTime);
  }

  return times;
};

const resolveWaypointBoundary = (
  boundaries: PathSectionBoundary[],
  waypointIndex: number,
): PathSectionBoundary | null => {
  if (boundaries.length === 0) {
    return null;
  }

  return boundaries[Math.min(waypointIndex, boundaries.length - 1)] ?? null;
};

const buildWaypointTimings = (
  path: PathModel,
  points: Point[],
  sectionBoundaries: PathSectionBoundary[],
  boundaryTimes: number[],
  boundaryVelocities: number[],
): WaypointTiming[] => {
  if (path.waypoints.length === 0) {
    return [];
  }

  const lastBoundary = sectionBoundaries.at(-1);

  const pointsById = new Map(points.map((point) => [point.id, point]));

  return path.waypoints.map((waypoint, index) => {
    const boundary =
      resolveWaypointBoundary(sectionBoundaries, index) ?? lastBoundary;
    const boundaryIndex = Math.min(
      boundary?.segmentBoundaryIndex ?? 0,
      boundaryTimes.length - 1,
    );

    return {
      waypointId: waypoint.id,
      name: getEffectiveWaypointName({
        point: pointsById.get(waypoint.pointId) ?? { name: '' },
        libraryPoint:
          waypoint.libraryPointId === null
            ? null
            : (pointsById.get(waypoint.libraryPointId) ?? null),
        index,
      }),
      index,
      cumulativeDistance: boundary?.cumulativeDistance ?? 0,
      time: boundaryTimes[boundaryIndex] ?? 0,
      velocity: boundaryVelocities[boundaryIndex] ?? 0,
    };
  });
};

const findTimedSegmentIndexAtTime = (
  segments: TimedPathSegment[],
  time: number,
): number => {
  if (segments.length === 0) {
    return -1;
  }

  let low = 0;
  let high = segments.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const segment = segments[mid];
    if (segment === undefined) {
      break;
    }

    if (time > segment.endTime) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

const findTimedSegmentIndexAtDistance = (
  segments: TimedPathSegment[],
  distance: number,
): number => {
  if (segments.length === 0) {
    return -1;
  }

  let low = 0;
  let high = segments.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const segment = segments[mid];
    if (segment === undefined) {
      break;
    }

    if (distance > segment.geometry.endDistance) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

const samplePoseAtDistance = (
  segments: TimedPathSegment[],
  headingProfile: RobotHeadingProfile,
  distance: number,
): {
  x: number;
  y: number;
  pathHeading: number;
  robotHeading: number;
  rMinOfSection: number;
  curvatureRadius: number | null;
} | null => {
  if (segments.length === 0) {
    return null;
  }

  const clampedDistance = Math.min(
    Math.max(distance, 0),
    segments.at(-1)?.geometry.endDistance ?? 0,
  );
  const segmentIndex = findTimedSegmentIndexAtDistance(
    segments,
    clampedDistance,
  );
  const segment = segments[segmentIndex];
  if (segment === undefined) {
    return null;
  }

  const geometrySample = sampleGeometrySegmentAtDistance(
    segment.geometry,
    clampedDistance,
  );

  return {
    ...geometrySample,
    robotHeading: sampleRobotHeadingAtDistance(headingProfile, clampedDistance),
  };
};

const resolveDisplaySampleSpeedLimit = (
  segments: TimedPathSegment[],
  segmentIndex: number,
  localDistance: number,
): number => {
  const segment = segments[segmentIndex];
  if (segment === undefined) {
    return 0;
  }

  if (localDistance <= EPSILON) {
    if (segmentIndex === 0) {
      return 0;
    }

    return Math.min(
      segment.speedLimit,
      segments[segmentIndex - 1]?.speedLimit ?? segment.speedLimit,
    );
  }

  if (segment.geometry.length - localDistance <= EPSILON) {
    if (segmentIndex === segments.length - 1) {
      return 0;
    }

    return Math.min(
      segment.speedLimit,
      segments[segmentIndex + 1]?.speedLimit ?? segment.speedLimit,
    );
  }

  return segment.speedLimit;
};

const pushUniqueDistance = (distances: number[], value: number): void => {
  if (distances.some((distance) => Math.abs(distance - value) <= EPSILON)) {
    return;
  }

  distances.push(value);
};

const collectDisplayLocalDistances = (segment: TimedPathSegment): number[] => {
  const distances = [0, segment.geometry.length];
  const profile = segment.motionProfile;

  pushUniqueDistance(distances, profile.accelerationDistance);
  pushUniqueDistance(
    distances,
    profile.accelerationDistance + profile.cruiseDistance,
  );

  if (segment.geometry.kind === 'arc') {
    const pieceCount = Math.max(
      1,
      Math.ceil(Math.abs(segment.geometry.sweepRad) / ARC_DISPLAY_STEP_RAD),
    );

    for (let pieceIndex = 1; pieceIndex < pieceCount; pieceIndex += 1) {
      pushUniqueDistance(
        distances,
        (segment.geometry.length * pieceIndex) / pieceCount,
      );
    }
  }

  return distances
    .filter(
      (distance) =>
        distance >= -EPSILON && distance <= segment.geometry.length + EPSILON,
    )
    .map((distance) => Math.min(Math.max(distance, 0), segment.geometry.length))
    .sort((left, right) => left - right);
};

const buildDisplaySamples = (
  segments: TimedPathSegment[],
  headingProfile: RobotHeadingProfile,
): PathTimingSample[] => {
  if (segments.length === 0) {
    return [];
  }

  const samples: PathTimingSample[] = [];

  segments.forEach((segment, segmentIndex) => {
    const localDistances = collectDisplayLocalDistances(segment);

    localDistances.forEach((localDistance) => {
      if (segmentIndex > 0 && localDistance <= EPSILON) {
        return;
      }

      const cumulativeDistance = segment.geometry.startDistance + localDistance;
      const pose = sampleGeometrySegmentAtDistance(
        segment.geometry,
        cumulativeDistance,
      );
      const localTime = getSegmentTimeAtDistance(
        segment.motionProfile,
        localDistance,
      );
      let velocity = getSegmentVelocityAtTime(segment.motionProfile, localTime);
      if (localDistance <= EPSILON) {
        velocity = segment.startVelocity;
      } else if (segment.geometry.length - localDistance <= EPSILON) {
        velocity = segment.endVelocity;
      }

      samples.push({
        ...pose,
        robotHeading: sampleRobotHeadingAtDistance(
          headingProfile,
          cumulativeDistance,
        ),
        cumulativeDistance,
        speedLimit: resolveDisplaySampleSpeedLimit(
          segments,
          segmentIndex,
          localDistance,
        ),
        velocity,
        time: segment.startTime + localTime,
      });
    });
  });

  return samples;
};

const buildTimingForStationaryPath = (
  path: PathModel,
  points: Point[],
  settings: RobotMotionSettings,
): PathTiming => {
  const geometry = buildPathTimingGeometry(path, points);
  const motionSettings = toTimingMotionSettings(settings);
  const onlyWaypoint = geometry.waypoints[0];

  if (onlyWaypoint === undefined) {
    return {
      samples: [],
      waypointTimings: [],
      totalDistance: 0,
      totalTime: 0,
      maxVelocity: settings.maxVelocity,
      motionSettings,
      segments: [],
      headingProfile: geometry.headingProfile,
    };
  }

  const sample: PathTimingSample = {
    x: onlyWaypoint.x,
    y: onlyWaypoint.y,
    pathHeading: onlyWaypoint.pathHeading,
    robotHeading: sampleRobotHeadingAtDistance(geometry.headingProfile, 0),
    rMinOfSection: 1,
    curvatureRadius: null,
    cumulativeDistance: 0,
    speedLimit: 0,
    velocity: 0,
    time: 0,
  };

  return {
    samples: [sample],
    waypointTimings: buildWaypointTimings(
      path,
      points,
      geometry.sectionBoundaries,
      [0],
      [0],
    ),
    totalDistance: 0,
    totalTime: 0,
    maxVelocity: settings.maxVelocity,
    motionSettings,
    segments: [],
    headingProfile: geometry.headingProfile,
  };
};

const buildPathTiming = (
  path: PathModel,
  points: Point[],
  settings: RobotMotionSettings,
): PathTiming => {
  const geometry = buildPathTimingGeometry(path, points);
  const motionSettings = toTimingMotionSettings(settings);

  if (geometry.waypoints.length <= 1 || geometry.segments.length === 0) {
    return buildTimingForStationaryPath(path, points, settings);
  }

  const segments = buildTimedSegments(geometry.segments, settings);
  const boundaryTimes = buildBoundaryTimes(segments);
  const boundaryVelocities = [
    segments[0]?.startVelocity ?? 0,
    ...segments.map((segment) => segment.endVelocity),
  ];
  const samples = buildDisplaySamples(segments, geometry.headingProfile);

  return {
    samples,
    waypointTimings: buildWaypointTimings(
      path,
      points,
      geometry.sectionBoundaries,
      boundaryTimes,
      boundaryVelocities,
    ),
    totalDistance: geometry.totalDistance,
    totalTime: segments.at(-1)?.endTime ?? 0,
    maxVelocity: settings.maxVelocity,
    motionSettings,
    segments,
    headingProfile: geometry.headingProfile,
  };
};

export const computePathTiming = (
  path: PathModel,
  points: Point[],
  settingsInput: RobotMotionSettings,
): PathTiming => {
  const settings = normalizeRobotMotionSettings(settingsInput);
  const settingsKey = toTimingCacheSettingsKey(settings);
  const cachedTiming = getCachedPathTiming(path, points, settingsKey);

  if (cachedTiming !== null) {
    return cachedTiming;
  }

  const timing = buildPathTiming(path, points, settings);

  return storeCachedPathTiming({
    path,
    points,
    settingsKey,
    timing,
  });
};

export const sampleTimedPathAtTime = (
  timing: PathTiming,
  time: number,
): TimedPathPose | null => {
  if (timing.samples.length === 0) {
    return null;
  }

  if (timing.segments.length === 0 || timing.totalTime <= EPSILON) {
    const sample = timing.samples[0];
    if (sample === undefined) {
      return null;
    }

    return {
      x: sample.x,
      y: sample.y,
      pathHeading: sample.pathHeading,
      robotHeading: sample.robotHeading,
      velocity: sample.velocity,
      cumulativeDistance: sample.cumulativeDistance,
      time: sample.time,
    };
  }

  const clampedTime = Math.min(Math.max(time, 0), timing.totalTime);
  const segmentIndex = findTimedSegmentIndexAtTime(
    timing.segments,
    clampedTime,
  );
  const segment = timing.segments[segmentIndex];
  if (segment === undefined) {
    return null;
  }

  const elapsedTime = Math.min(
    Math.max(clampedTime - segment.startTime, 0),
    segment.motionProfile.duration,
  );
  const localDistance = getSegmentDistanceAtTime(
    segment.motionProfile,
    elapsedTime,
  );
  const cumulativeDistance = segment.geometry.startDistance + localDistance;
  const pose = samplePoseAtDistance(
    timing.segments,
    timing.headingProfile,
    cumulativeDistance,
  );

  if (pose === null) {
    return null;
  }

  return {
    x: pose.x,
    y: pose.y,
    pathHeading: pose.pathHeading,
    robotHeading: pose.robotHeading,
    velocity: getSegmentVelocityAtTime(segment.motionProfile, elapsedTime),
    cumulativeDistance,
    time: clampedTime,
  };
};

export const getLoopedPathTime = (
  elapsedSeconds: number,
  totalTime: number,
  startWaitSeconds: number,
  endWaitSeconds: number,
): number => {
  if (totalTime <= EPSILON) {
    return 0;
  }

  const cycleDuration = startWaitSeconds + totalTime + endWaitSeconds;
  const remainder = elapsedSeconds % cycleDuration;
  const normalizedRemainder =
    remainder >= 0 ? remainder : remainder + cycleDuration;

  if (normalizedRemainder < startWaitSeconds) {
    return 0;
  }

  if (normalizedRemainder < startWaitSeconds + totalTime) {
    return normalizedRemainder - startWaitSeconds;
  }

  return totalTime;
};
