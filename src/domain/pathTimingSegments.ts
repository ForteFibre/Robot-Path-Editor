import {
  normalizeAngleDeg,
  shortestAngleDeltaDeg,
  toRadians,
} from './geometry';
import type { PathModel, Point } from './models';
import {
  createPointIndex,
  resolvePathModel,
  type ResolvedPathModel,
  type ResolvedWaypoint,
} from './pointResolution';
import { resolveSectionDubins } from './sectionRadius';
import { isStraightSection } from './sectionDubins';

const DISTANCE_EPSILON = 1e-9;

const clampSectionRatio = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
};

const interpolateUnwrappedAngleDeg = (
  from: number,
  to: number,
  ratio: number,
): number => {
  return from + shortestAngleDeltaDeg(from, to) * ratio;
};

type Pose = {
  x: number;
  y: number;
  headingRad: number;
};

const advancePose = (
  pose: Pose,
  segmentType: 'L' | 'S' | 'R',
  distance: number,
  turningRadius: number,
): Pose => {
  if (segmentType === 'S') {
    return {
      x: pose.x + distance * Math.cos(pose.headingRad),
      y: pose.y + distance * Math.sin(pose.headingRad),
      headingRad: pose.headingRad,
    };
  }

  const delta = turningRadius > DISTANCE_EPSILON ? distance / turningRadius : 0;

  if (segmentType === 'L') {
    const nextHeading = pose.headingRad + delta;
    return {
      x:
        pose.x +
        turningRadius * (Math.sin(nextHeading) - Math.sin(pose.headingRad)),
      y:
        pose.y +
        turningRadius * (Math.cos(pose.headingRad) - Math.cos(nextHeading)),
      headingRad: nextHeading,
    };
  }

  const nextHeading = pose.headingRad - delta;
  return {
    x:
      pose.x +
      turningRadius * (Math.sin(pose.headingRad) - Math.sin(nextHeading)),
    y:
      pose.y +
      turningRadius * (Math.cos(nextHeading) - Math.cos(pose.headingRad)),
    headingRad: nextHeading,
  };
};

export type PathGeometrySegment =
  | {
      kind: 'line';
      sectionIndex: number;
      length: number;
      startDistance: number;
      endDistance: number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      startHeadingDeg: number;
      endHeadingDeg: number;
      startHeadingRad: number;
      endHeadingRad: number;
      rMinOfSection: number;
      curvatureRadius: null;
    }
  | {
      kind: 'arc';
      sectionIndex: number;
      length: number;
      startDistance: number;
      endDistance: number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      startHeadingDeg: number;
      endHeadingDeg: number;
      startHeadingRad: number;
      endHeadingRad: number;
      rMinOfSection: number;
      curvatureRadius: number;
      turningRadius: number;
      centerX: number;
      centerY: number;
      startAngleRad: number;
      sweepRad: number;
    };

export type PathSectionBoundary = {
  waypointIndex: number;
  cumulativeDistance: number;
  segmentBoundaryIndex: number;
};

export type RobotHeadingProfile =
  | {
      kind: 'implicit';
      totalDistance: number;
      startHeading: number;
      endHeading: number;
    }
  | {
      kind: 'keyframed';
      totalDistance: number;
      keyframes: {
        distance: number;
        heading: number;
      }[];
    };

export type PathTimingGeometry = {
  waypoints: ResolvedWaypoint[];
  segments: PathGeometrySegment[];
  sectionBoundaries: PathSectionBoundary[];
  headingProfile: RobotHeadingProfile;
  totalDistance: number;
};

type HeadingKeyframeDistance = {
  sectionIndex: number;
  sectionRatio: number;
  name: string;
  distance: number;
  heading: number;
};

const buildRobotHeadingProfile = (
  path: ResolvedPathModel,
  sectionBoundaries: PathSectionBoundary[],
): RobotHeadingProfile => {
  const totalDistance = sectionBoundaries.at(-1)?.cumulativeDistance ?? 0;
  const firstWaypoint = path.waypoints[0];
  const lastWaypoint = path.waypoints.at(-1);
  const startHeading = firstWaypoint?.pathHeading ?? 0;
  const endHeading = lastWaypoint?.pathHeading ?? startHeading;

  const explicitKeyframes: HeadingKeyframeDistance[] = [];

  path.waypoints.forEach((waypoint, index) => {
    const waypointRobotHeading = waypoint.point.robotHeading;

    if (waypointRobotHeading === null) {
      return;
    }

    const lastIndex = path.waypoints.length - 1;
    const sectionIndex =
      index === 0 ? 0 : Math.max(0, Math.min(index - 1, lastIndex - 1));
    const sectionRatio = index === 0 ? 0 : 1;
    const distance =
      sectionBoundaries[index]?.cumulativeDistance ?? totalDistance;

    explicitKeyframes.push({
      sectionIndex,
      sectionRatio,
      name: waypoint.name,
      distance,
      heading: waypointRobotHeading,
    });
  });

  path.headingKeyframes.forEach((keyframe) => {
    const startDistance =
      sectionBoundaries[keyframe.sectionIndex]?.cumulativeDistance ??
      totalDistance;
    const endDistance =
      sectionBoundaries[keyframe.sectionIndex + 1]?.cumulativeDistance ??
      startDistance;
    const sectionLength = Math.max(0, endDistance - startDistance);
    const sectionRatio = clampSectionRatio(keyframe.sectionRatio);

    explicitKeyframes.push({
      sectionIndex: keyframe.sectionIndex,
      sectionRatio,
      name: keyframe.name,
      distance: startDistance + sectionLength * sectionRatio,
      heading: keyframe.robotHeading,
    });
  });

  explicitKeyframes.sort((left, right) => {
    if (left.sectionIndex !== right.sectionIndex) {
      return left.sectionIndex - right.sectionIndex;
    }

    if (left.sectionRatio !== right.sectionRatio) {
      return left.sectionRatio - right.sectionRatio;
    }

    return left.name.localeCompare(right.name);
  });

  if (explicitKeyframes.length === 0) {
    return {
      kind: 'implicit',
      totalDistance,
      startHeading,
      endHeading,
    };
  }

  const keyframes = explicitKeyframes.map((keyframe) => ({
    distance: keyframe.distance,
    heading: keyframe.heading,
  }));

  const hasStart = keyframes.some(
    (keyframe) => Math.abs(keyframe.distance) <= DISTANCE_EPSILON,
  );
  const hasEnd = keyframes.some(
    (keyframe) =>
      Math.abs(keyframe.distance - totalDistance) <= DISTANCE_EPSILON,
  );

  if (!hasStart) {
    keyframes.unshift({ distance: 0, heading: startHeading });
  }

  if (!hasEnd) {
    keyframes.push({ distance: totalDistance, heading: endHeading });
  }

  keyframes.sort((left, right) => left.distance - right.distance);

  return {
    kind: 'keyframed',
    totalDistance,
    keyframes,
  };
};

const buildStraightSegment = (
  start: ResolvedWaypoint,
  end: ResolvedWaypoint,
  sectionIndex: number,
  startDistance: number,
): PathGeometrySegment | null => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length <= DISTANCE_EPSILON) {
    return null;
  }

  return {
    kind: 'line',
    sectionIndex,
    length,
    startDistance,
    endDistance: startDistance + length,
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    startHeadingDeg: normalizeAngleDeg(start.pathHeading),
    endHeadingDeg: normalizeAngleDeg(end.pathHeading),
    startHeadingRad: toRadians(start.pathHeading),
    endHeadingRad: toRadians(end.pathHeading),
    rMinOfSection: length,
    curvatureRadius: null,
  };
};

const buildSectionSegments = (
  path: ResolvedPathModel,
  sectionIndex: number,
  startDistance: number,
): PathGeometrySegment[] => {
  const start = path.waypoints[sectionIndex];
  const end = path.waypoints[sectionIndex + 1];

  if (start === undefined || end === undefined) {
    return [];
  }

  const startEndpoint = {
    x: start.x,
    y: start.y,
    headingDeg: start.pathHeading,
  };
  const endEndpoint = {
    x: end.x,
    y: end.y,
    headingDeg: end.pathHeading,
  };

  if (isStraightSection(startEndpoint, endEndpoint)) {
    const segment = buildStraightSegment(
      start,
      end,
      sectionIndex,
      startDistance,
    );
    return segment === null ? [] : [segment];
  }

  const resolved = resolveSectionDubins(
    start,
    end,
    path.sectionRMin[sectionIndex] ?? null,
  );
  if (resolved === null) {
    throw new Error(`failed to resolve section ${sectionIndex} Dubins path`);
  }

  const poseStart: Pose = {
    x: start.x,
    y: start.y,
    headingRad: toRadians(start.pathHeading),
  };
  const exactEndHeadingRad = toRadians(end.pathHeading);
  const nonZeroSegments = resolved.path.segmentTypes
    .map((segmentType, index) => ({
      segmentType,
      length: (resolved.path.params[index] ?? 0) * resolved.turningRadius,
    }))
    .filter((segment) => segment.length > DISTANCE_EPSILON);

  const segments: PathGeometrySegment[] = [];
  let pose = poseStart;
  let cumulativeDistance = startDistance;

  nonZeroSegments.forEach((segment, nonZeroIndex) => {
    const isLast = nonZeroIndex === nonZeroSegments.length - 1;
    const nextPose = advancePose(
      pose,
      segment.segmentType,
      segment.length,
      resolved.turningRadius,
    );
    const endPose = isLast
      ? { x: end.x, y: end.y, headingRad: exactEndHeadingRad }
      : nextPose;

    if (segment.segmentType === 'S') {
      segments.push({
        kind: 'line',
        sectionIndex,
        length: segment.length,
        startDistance: cumulativeDistance,
        endDistance: cumulativeDistance + segment.length,
        startX: pose.x,
        startY: pose.y,
        endX: endPose.x,
        endY: endPose.y,
        startHeadingDeg: normalizeAngleDeg((pose.headingRad * 180) / Math.PI),
        endHeadingDeg: normalizeAngleDeg((endPose.headingRad * 180) / Math.PI),
        startHeadingRad: pose.headingRad,
        endHeadingRad: endPose.headingRad,
        rMinOfSection: resolved.turningRadius,
        curvatureRadius: null,
      });
    } else {
      const headingVector = {
        x: Math.cos(pose.headingRad),
        y: Math.sin(pose.headingRad),
      };
      const center =
        segment.segmentType === 'L'
          ? {
              x: pose.x - headingVector.y * resolved.turningRadius,
              y: pose.y + headingVector.x * resolved.turningRadius,
            }
          : {
              x: pose.x + headingVector.y * resolved.turningRadius,
              y: pose.y - headingVector.x * resolved.turningRadius,
            };
      const startAngleRad = Math.atan2(pose.y - center.y, pose.x - center.x);
      const sweepRad =
        segment.segmentType === 'L'
          ? segment.length / resolved.turningRadius
          : -segment.length / resolved.turningRadius;

      segments.push({
        kind: 'arc',
        sectionIndex,
        length: segment.length,
        startDistance: cumulativeDistance,
        endDistance: cumulativeDistance + segment.length,
        startX: pose.x,
        startY: pose.y,
        endX: endPose.x,
        endY: endPose.y,
        startHeadingDeg: normalizeAngleDeg((pose.headingRad * 180) / Math.PI),
        endHeadingDeg: normalizeAngleDeg((endPose.headingRad * 180) / Math.PI),
        startHeadingRad: pose.headingRad,
        endHeadingRad: endPose.headingRad,
        rMinOfSection: resolved.turningRadius,
        curvatureRadius: resolved.turningRadius,
        turningRadius: resolved.turningRadius,
        centerX: center.x,
        centerY: center.y,
        startAngleRad,
        sweepRad,
      });
    }

    cumulativeDistance += segment.length;
    pose = endPose;
  });

  return segments;
};

export const buildPathTimingGeometry = (
  path: PathModel,
  points: Point[],
): PathTimingGeometry => {
  const resolvedPath = resolvePathModel(path, createPointIndex(points));
  const sectionBoundaries: PathSectionBoundary[] = [
    {
      waypointIndex: 0,
      cumulativeDistance: 0,
      segmentBoundaryIndex: 0,
    },
  ];
  const segments: PathGeometrySegment[] = [];
  let totalDistance = 0;

  for (
    let sectionIndex = 0;
    sectionIndex < resolvedPath.waypoints.length - 1;
    sectionIndex += 1
  ) {
    const sectionSegments = buildSectionSegments(
      resolvedPath,
      sectionIndex,
      totalDistance,
    );
    segments.push(...sectionSegments);
    totalDistance = sectionSegments.at(-1)?.endDistance ?? totalDistance;
    sectionBoundaries.push({
      waypointIndex: sectionIndex + 1,
      cumulativeDistance: totalDistance,
      segmentBoundaryIndex: segments.length,
    });
  }

  return {
    waypoints: resolvedPath.waypoints,
    segments,
    sectionBoundaries,
    headingProfile: buildRobotHeadingProfile(resolvedPath, sectionBoundaries),
    totalDistance,
  };
};

export const sampleRobotHeadingAtDistance = (
  profile: RobotHeadingProfile,
  distance: number,
): number => {
  const clampedDistance = Math.min(
    Math.max(distance, 0),
    profile.totalDistance,
  );

  if (profile.kind === 'implicit') {
    if (profile.totalDistance <= DISTANCE_EPSILON) {
      return normalizeAngleDeg(profile.startHeading);
    }

    const ratio = clampedDistance / profile.totalDistance;
    return normalizeAngleDeg(
      interpolateUnwrappedAngleDeg(
        profile.startHeading,
        profile.endHeading,
        ratio,
      ),
    );
  }

  const first = profile.keyframes[0];
  const last = profile.keyframes.at(-1);
  if (first === undefined || last === undefined) {
    return 0;
  }

  let previous = first;
  for (const keyframe of profile.keyframes) {
    if (keyframe.distance <= clampedDistance + DISTANCE_EPSILON) {
      previous = keyframe;
      continue;
    }

    break;
  }

  const next =
    profile.keyframes.find(
      (keyframe) => keyframe.distance >= clampedDistance - DISTANCE_EPSILON,
    ) ?? last;

  if (Math.abs(next.distance - previous.distance) <= DISTANCE_EPSILON) {
    return normalizeAngleDeg(previous.heading);
  }

  const ratio =
    (clampedDistance - previous.distance) / (next.distance - previous.distance);

  return normalizeAngleDeg(
    interpolateUnwrappedAngleDeg(previous.heading, next.heading, ratio),
  );
};

export const findGeometrySegmentIndexAtDistance = (
  segments: PathGeometrySegment[],
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

    if (distance > segment.endDistance) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

export const sampleGeometrySegmentAtDistance = (
  segment: PathGeometrySegment,
  distance: number,
): {
  x: number;
  y: number;
  pathHeading: number;
  rMinOfSection: number;
  curvatureRadius: number | null;
} => {
  const localDistance = Math.min(
    Math.max(distance - segment.startDistance, 0),
    segment.length,
  );

  if (localDistance <= DISTANCE_EPSILON) {
    return {
      x: segment.startX,
      y: segment.startY,
      pathHeading: segment.startHeadingDeg,
      rMinOfSection: segment.rMinOfSection,
      curvatureRadius: segment.curvatureRadius,
    };
  }

  if (segment.length - localDistance <= DISTANCE_EPSILON) {
    return {
      x: segment.endX,
      y: segment.endY,
      pathHeading: segment.endHeadingDeg,
      rMinOfSection: segment.rMinOfSection,
      curvatureRadius: segment.curvatureRadius,
    };
  }

  if (segment.kind === 'line') {
    return {
      x: segment.startX + Math.cos(segment.startHeadingRad) * localDistance,
      y: segment.startY + Math.sin(segment.startHeadingRad) * localDistance,
      pathHeading: normalizeAngleDeg((segment.startHeadingRad * 180) / Math.PI),
      rMinOfSection: segment.rMinOfSection,
      curvatureRadius: null,
    };
  }

  const ratio =
    segment.length > DISTANCE_EPSILON ? localDistance / segment.length : 0;
  const angle = segment.startAngleRad + segment.sweepRad * ratio;
  const headingRad = segment.startHeadingRad + segment.sweepRad * ratio;

  return {
    x: segment.centerX + segment.turningRadius * Math.cos(angle),
    y: segment.centerY + segment.turningRadius * Math.sin(angle),
    pathHeading: normalizeAngleDeg((headingRad * 180) / Math.PI),
    rMinOfSection: segment.rMinOfSection,
    curvatureRadius: segment.curvatureRadius,
  };
};
