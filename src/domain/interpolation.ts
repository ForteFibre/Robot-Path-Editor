import {
  resolveDiscretizedHeadingKeyframes,
  projectHeadingKeyframesToSamples,
} from './headingKeyframes';
import {
  buildCumulativeDistances,
  discretizeGeometryPath,
  type DiscretizedPath,
  type HeadingSample,
} from './pathSampling';
import { createPointIndex, resolvePathModel } from './pointResolution';
import {
  interpolateAngleDeg,
  normalizeAngleDeg,
  shortestAngleDeltaDeg,
  type Point as GeometryPoint,
} from './geometry';
import type { PathModel, Point } from './models';

export type {
  DiscretizedPath,
  HeadingSample,
  SectionSampleRange,
} from './pathSampling';
export {
  buildHeadingKeyframeRanges,
  getHeadingKeyframeRangePolyline,
  getSectionPositionPoint,
  resolveDiscretizedHeadingKeyframes,
} from './headingKeyframes';

type DiscretizedPathCacheEntry = {
  step: number;
  waypointKey: string;
  headingKeyframeKey: string;
  sectionRMinKey: string;
  pointRefs: (Point | undefined)[];
  detail: DiscretizedPath;
};

const DISCRETIZED_PATH_CACHE_LIMIT = 32;
const discretizedPathCache: DiscretizedPathCacheEntry[] = [];

const getWaypointCacheKey = (path: PathModel): string => {
  return path.waypoints
    .map((waypoint) => `${waypoint.pointId}:${waypoint.pathHeading}`)
    .join('|');
};

const getHeadingKeyframeCacheKey = (path: PathModel): string => {
  return path.headingKeyframes
    .map(
      (keyframe) =>
        `${keyframe.sectionIndex}:${keyframe.sectionRatio}:${keyframe.robotHeading}`,
    )
    .join('|');
};

const getSectionRMinCacheKey = (path: PathModel): string => {
  return path.sectionRMin.map((value) => value ?? 'auto').join('|');
};

const getPointRefsForPath = (
  path: PathModel,
  pointsById: Map<string, Point>,
): (Point | undefined)[] => {
  return path.waypoints.map((waypoint) => pointsById.get(waypoint.pointId));
};

const getCachedDiscretizedPath = (
  entry: Omit<DiscretizedPathCacheEntry, 'detail'>,
): DiscretizedPath | null => {
  const cacheIndex = discretizedPathCache.findIndex((cached) => {
    if (
      cached.step !== entry.step ||
      cached.waypointKey !== entry.waypointKey ||
      cached.headingKeyframeKey !== entry.headingKeyframeKey ||
      cached.sectionRMinKey !== entry.sectionRMinKey ||
      cached.pointRefs.length !== entry.pointRefs.length
    ) {
      return false;
    }

    return cached.pointRefs.every(
      (point, index) => point === entry.pointRefs[index],
    );
  });

  if (cacheIndex < 0) {
    return null;
  }

  const [cached] = discretizedPathCache.splice(cacheIndex, 1);
  if (cached === undefined) {
    return null;
  }

  discretizedPathCache.unshift(cached);
  return cached.detail;
};

const storeCachedDiscretizedPath = (
  entry: DiscretizedPathCacheEntry,
): DiscretizedPath => {
  discretizedPathCache.unshift(entry);
  if (discretizedPathCache.length > DISCRETIZED_PATH_CACHE_LIMIT) {
    discretizedPathCache.length = DISCRETIZED_PATH_CACHE_LIMIT;
  }

  return entry.detail;
};

const interpolateUnwrappedAngleDeg = (
  from: number,
  to: number,
  t: number,
): number => {
  return from + shortestAngleDeltaDeg(from, to) * t;
};

const applyRobotHeadingInterpolation = (
  path: PathModel,
  points: Point[],
  discretized: DiscretizedPath,
): DiscretizedPath => {
  const { samples } = discretized;
  if (samples.length === 0) {
    return discretized;
  }

  if (samples.length === 1) {
    const onlySample = samples[0];
    if (onlySample !== undefined) {
      onlySample.robotHeading = onlySample.pathHeading;
    }
    return discretized;
  }

  const resolvedPath = resolvePathModel(path, createPointIndex(points));
  const headingKeyframes = resolveDiscretizedHeadingKeyframes(
    resolvedPath,
    discretized,
  );
  const cumulativeDistances = buildCumulativeDistances(samples);
  const lastWaypointIndex = resolvedPath.waypoints.length - 1;
  const waypointKeyframes = resolvedPath.waypoints
    .map((waypoint, index) => {
      const waypointRobotHeading = waypoint.point.robotHeading;

      if (waypointRobotHeading === null) {
        return null;
      }

      if (index === 0) {
        return {
          id: `${waypoint.id}-robot-heading`,
          sectionIndex: 0,
          sectionRatio: 0,
          robotHeading: waypointRobotHeading,
          name: `${waypoint.name} Robot H`,
          x: waypoint.x,
          y: waypoint.y,
          pathHeading: waypoint.pathHeading,
        };
      }

      if (index === lastWaypointIndex) {
        return {
          id: `${waypoint.id}-robot-heading`,
          sectionIndex: Math.max(0, lastWaypointIndex - 1),
          sectionRatio: 1,
          robotHeading: waypointRobotHeading,
          name: `${waypoint.name} Robot H`,
          x: waypoint.x,
          y: waypoint.y,
          pathHeading: waypoint.pathHeading,
        };
      }

      return {
        id: `${waypoint.id}-robot-heading`,
        sectionIndex: index - 1,
        sectionRatio: 1,
        robotHeading: waypointRobotHeading,
        name: `${waypoint.name} Robot H`,
        x: waypoint.x,
        y: waypoint.y,
        pathHeading: waypoint.pathHeading,
      };
    })
    .filter(
      (keyframe): keyframe is NonNullable<typeof keyframe> => keyframe !== null,
    );

  type Keyframe = {
    distance: number;
    heading: number;
  };

  const explicitKeyframes = projectHeadingKeyframesToSamples(discretized, [
    ...waypointKeyframes,
    ...headingKeyframes,
  ]).map((keyframe) => ({
    distance: keyframe.cumulativeDistance,
    heading: keyframe.robotHeading,
  }));

  if (explicitKeyframes.length === 0) {
    const startSample = samples[0];
    const endSample = samples.at(-1);
    if (startSample === undefined || endSample === undefined) {
      return discretized;
    }

    const startHeading =
      resolvedPath.waypoints[0]?.pathHeading ?? startSample.pathHeading;
    const endHeading =
      resolvedPath.waypoints.at(-1)?.pathHeading ?? endSample.pathHeading;

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      if (sample === undefined) {
        continue;
      }

      const distance = cumulativeDistances[index] ?? 0;
      const total = cumulativeDistances.at(-1) ?? 0;
      const t = total > 0 ? distance / total : 0;
      sample.robotHeading = interpolateAngleDeg(startHeading, endHeading, t);
    }
    return discretized;
  }

  const startDistance = 0;
  const endDistance = cumulativeDistances.at(-1) ?? 0;
  const startHeading =
    resolvedPath.waypoints[0]?.pathHeading ?? samples[0]?.pathHeading;
  const endHeading =
    resolvedPath.waypoints.at(-1)?.pathHeading ?? samples.at(-1)?.pathHeading;

  const keyframes: Keyframe[] = [...explicitKeyframes];
  const hasStartExplicit = explicitKeyframes.some(
    (keyframe) => keyframe.distance === 0,
  );
  const hasEndExplicit = explicitKeyframes.some(
    (keyframe) => keyframe.distance === endDistance,
  );

  if (!hasStartExplicit && startHeading !== undefined) {
    keyframes.unshift({ distance: startDistance, heading: startHeading });
  }

  if (!hasEndExplicit && endHeading !== undefined) {
    keyframes.push({ distance: endDistance, heading: endHeading });
  }

  keyframes.sort((a, b) => a.distance - b.distance);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === undefined) {
      continue;
    }

    const sampleDistance = cumulativeDistances[index] ?? 0;
    const previous =
      [...keyframes]
        .reverse()
        .find((keyframe) => keyframe.distance <= sampleDistance) ??
      keyframes[0];
    const next =
      keyframes.find((keyframe) => keyframe.distance >= sampleDistance) ??
      keyframes.at(-1);

    if (previous === undefined || next === undefined) {
      continue;
    }

    if (previous.distance === next.distance) {
      sample.robotHeading = normalizeAngleDeg(previous.heading);
      continue;
    }

    const t =
      (sampleDistance - previous.distance) /
      (next.distance - previous.distance);
    sample.robotHeading = normalizeAngleDeg(
      interpolateUnwrappedAngleDeg(previous.heading, next.heading, t),
    );
  }

  return discretized;
};

const discretizeResolvedPath = (
  path: PathModel,
  points: Point[],
  step: number,
): DiscretizedPath => {
  return applyRobotHeadingInterpolation(
    path,
    points,
    discretizeGeometryPath(path, points, step),
  );
};

export const discretizePathDetailed = (
  path: PathModel,
  points: Point[],
  step: number,
): DiscretizedPath => {
  const pointsById = createPointIndex(points);
  const cacheEntry = {
    step,
    waypointKey: getWaypointCacheKey(path),
    headingKeyframeKey: getHeadingKeyframeCacheKey(path),
    sectionRMinKey: getSectionRMinCacheKey(path),
    pointRefs: getPointRefsForPath(path, pointsById),
  };
  const cached = getCachedDiscretizedPath(cacheEntry);

  if (cached !== null) {
    return cached;
  }

  return storeCachedDiscretizedPath({
    ...cacheEntry,
    detail: discretizeResolvedPath(path, points, step),
  });
};

export const discretizePath = (
  path: PathModel,
  points: Point[],
  step: number,
): HeadingSample[] => {
  return discretizeResolvedPath(path, points, step).samples;
};

export { toGeometryPolyline } from './pathSampling';

export const samplePathPointAtDistance = (
  samples: HeadingSample[],
  distanceAlongPath: number,
): (GeometryPoint & { pathHeading: number; robotHeading: number }) | null => {
  if (samples.length === 0) {
    return null;
  }

  if (samples.length === 1) {
    const sample = samples[0];
    if (sample === undefined) {
      return null;
    }

    return {
      x: sample.x,
      y: sample.y,
      pathHeading: sample.pathHeading,
      robotHeading: sample.robotHeading,
    };
  }

  const cumulativeDistances = buildCumulativeDistances(samples);
  const clampedDistance = Math.min(
    Math.max(distanceAlongPath, 0),
    cumulativeDistances.at(-1) ?? 0,
  );

  for (let index = 1; index < samples.length; index += 1) {
    const startDistance = cumulativeDistances[index - 1] ?? 0;
    const endDistance = cumulativeDistances[index] ?? 0;
    if (clampedDistance > endDistance) {
      continue;
    }

    const start = samples[index - 1];
    const end = samples[index];
    if (start === undefined || end === undefined) {
      continue;
    }

    const segmentLength = endDistance - startDistance;
    const t =
      segmentLength > 0 ? (clampedDistance - startDistance) / segmentLength : 0;

    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      pathHeading: interpolateAngleDeg(start.pathHeading, end.pathHeading, t),
      robotHeading: interpolateAngleDeg(
        start.robotHeading,
        end.robotHeading,
        t,
      ),
    };
  }

  const last = samples.at(-1);
  if (last === undefined) {
    return null;
  }

  return {
    x: last.x,
    y: last.y,
    pathHeading: last.pathHeading,
    robotHeading: last.robotHeading,
  };
};
