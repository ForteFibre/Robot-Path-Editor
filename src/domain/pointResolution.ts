import type { HeadingKeyframe, PathModel, Point, Waypoint } from './models';
import { interpolateAngleDeg } from './geometry';
import { getHeadingKeyframeName, getEffectiveWaypointName } from './naming';

const pointIndexCache = new WeakMap<Point[], Map<string, Point>>();

export type ResolvedWaypoint = Waypoint & {
  point: Point;
  libraryPoint: Point | null;
  name: string;
  x: number;
  y: number;
};

export type ResolvedPathModel = Omit<PathModel, 'waypoints'> & {
  waypoints: ResolvedWaypoint[];
};

export type ResolvedHeadingKeyframe = HeadingKeyframe & {
  x: number;
  y: number;
  pathHeading: number;
};

export const createPointIndex = (points: Point[]): Map<string, Point> => {
  const cached = pointIndexCache.get(points);
  if (cached !== undefined) {
    return cached;
  }

  const index = new Map(points.map((point) => [point.id, point]));
  pointIndexCache.set(points, index);
  return index;
};

export const resolveWaypoint = (
  waypoint: Waypoint,
  pointsById: Map<string, Point>,
  index: number,
): ResolvedWaypoint | null => {
  const point = pointsById.get(waypoint.pointId);
  if (point === undefined) {
    return null;
  }

  const libraryPoint =
    waypoint.libraryPointId === null
      ? null
      : (pointsById.get(waypoint.libraryPointId) ?? null);

  return {
    ...waypoint,
    point,
    libraryPoint,
    name: getEffectiveWaypointName({
      point,
      libraryPoint,
      index,
    }),
    x: point.x,
    y: point.y,
  };
};

export const resolvePathModel = (
  path: PathModel,
  pointsById: Map<string, Point>,
): ResolvedPathModel => {
  const maybeHeadingKeyframes = (path as Partial<PathModel>).headingKeyframes;
  const headingKeyframes: PathModel['headingKeyframes'] = Array.isArray(
    maybeHeadingKeyframes,
  )
    ? maybeHeadingKeyframes
    : [];

  return {
    ...path,
    headingKeyframes: headingKeyframes.map((keyframe, index) => ({
      ...keyframe,
      name: getHeadingKeyframeName(keyframe, index),
    })),
    waypoints: path.waypoints
      .map((waypoint, index) => resolveWaypoint(waypoint, pointsById, index))
      .filter((waypoint): waypoint is ResolvedWaypoint => waypoint !== null),
  };
};

export const resolveHeadingKeyframes = (
  path: ResolvedPathModel,
): ResolvedHeadingKeyframe[] => {
  if (path.waypoints.length < 2) {
    return [];
  }

  return path.headingKeyframes
    .map((keyframe) => {
      const start = path.waypoints[keyframe.sectionIndex];
      const end = path.waypoints[keyframe.sectionIndex + 1];

      if (start === undefined || end === undefined) {
        return null;
      }

      const t = Math.min(Math.max(keyframe.sectionRatio, 0), 1);

      return {
        ...keyframe,
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        pathHeading: interpolateAngleDeg(start.pathHeading, end.pathHeading, t),
      };
    })
    .filter(
      (keyframe): keyframe is ResolvedHeadingKeyframe => keyframe !== null,
    );
};

export const collectReferencedPointIds = (paths: PathModel[]): Set<string> => {
  const pointIds = new Set<string>();

  for (const path of paths) {
    for (const waypoint of path.waypoints) {
      pointIds.add(waypoint.pointId);
    }
  }

  return pointIds;
};

export const isPointLocked = (
  lockedPointIds: string[],
  pointId: string,
): boolean => {
  return lockedPointIds.includes(pointId);
};
