import { createPath, makeId } from '../../domain/factories';
import { normalizePathSections } from '../../domain/modelNormalization';
import type {
  HeadingKeyframe,
  PathModel,
  Point,
  Waypoint,
} from '../../domain/models';
import {
  getDefaultHeadingKeyframeName,
  getDefaultWaypointName,
} from '../../domain/naming';
import type { DomainState } from '../types';
import { normalizeWorkspaceDomainState as normalizeDomainState } from '../../domain/workspaceNormalization';

export const updatePath = (
  domain: DomainState,
  pathId: string,
  updater: (path: PathModel) => PathModel,
): DomainState => {
  const paths = domain.paths.map((path) => {
    if (path.id !== pathId) {
      return path;
    }

    return normalizePathSections(updater(path));
  });

  return normalizeDomainState({
    ...domain,
    paths,
  });
};

export const duplicatePathModel = (
  source: PathModel,
  index: number,
  pointsById: Map<string, Point>,
): {
  path: PathModel;
  points: Point[];
} => {
  const duplicatedPoints: Point[] = [];

  const waypoints = source.waypoints.map((waypoint) => {
    const sourcePoint = pointsById.get(waypoint.pointId);

    if (sourcePoint === undefined) {
      return {
        ...waypoint,
        id: makeId(),
      };
    }

    const duplicatedPoint: Point = {
      ...sourcePoint,
      id: makeId(),
      isLibrary: false,
      name: sourcePoint.name,
    };

    duplicatedPoints.push(duplicatedPoint);

    return {
      ...waypoint,
      id: makeId(),
      pointId: duplicatedPoint.id,
      libraryPointId:
        waypoint.libraryPointId ??
        (sourcePoint.isLibrary ? sourcePoint.id : null),
    };
  });

  return {
    path: normalizePathSections({
      ...source,
      id: makeId(),
      name: `${source.name} Copy`,
      color: createPath(index).color,
      waypoints,
      headingKeyframes: source.headingKeyframes.map((keyframe) => ({
        ...keyframe,
        id: makeId(),
      })),
      sectionRMin: [...source.sectionRMin],
    }),
    points: duplicatedPoints,
  };
};

export const appendPoint = (domain: DomainState, point: Point): DomainState => {
  return {
    ...domain,
    points: [...domain.points, point],
  };
};

export const updatePoint = (
  domain: DomainState,
  pointId: string,
  patch: Partial<Omit<Point, 'id'>>,
): DomainState => {
  return {
    ...domain,
    points: domain.points.map((point) => {
      if (point.id !== pointId) {
        return point;
      }

      return {
        ...point,
        ...patch,
      };
    }),
  };
};

export const nextWaypointName = (path: PathModel): string => {
  return getDefaultWaypointName(path.waypoints.length);
};

export const appendWaypoint = (
  path: PathModel,
  waypoint: Waypoint,
): PathModel => {
  const previousWaypoint = path.waypoints.at(-1);

  return normalizePathSections({
    ...path,
    waypoints: [...path.waypoints, waypoint],
    sectionRMin:
      previousWaypoint === undefined ? [] : [...path.sectionRMin, null],
  });
};

export const prependWaypoint = (
  path: PathModel,
  waypoint: Waypoint,
): PathModel => {
  if (path.waypoints.length === 0) {
    return appendWaypoint(path, waypoint);
  }

  return normalizePathSections({
    ...path,
    waypoints: [waypoint, ...path.waypoints],
    sectionRMin: [null, ...path.sectionRMin],
  });
};

export const insertWaypointAt = (
  path: PathModel,
  waypoint: Waypoint,
  afterIndex: number,
): PathModel => {
  if (afterIndex < 0 || afterIndex >= path.waypoints.length) {
    return appendWaypoint(path, waypoint);
  }

  const nextWaypoints = [
    ...path.waypoints.slice(0, afterIndex + 1),
    waypoint,
    ...path.waypoints.slice(afterIndex + 1),
  ];

  const nextSectionRMin: (number | null)[] = [];
  for (let i = 0; i < nextWaypoints.length - 1; i += 1) {
    if (i === afterIndex || i === afterIndex + 1) {
      nextSectionRMin.push(null);
    } else if (i < afterIndex) {
      nextSectionRMin.push(path.sectionRMin[i] ?? null);
    } else {
      nextSectionRMin.push(path.sectionRMin[i - 1] ?? null);
    }
  }

  return normalizePathSections({
    ...path,
    waypoints: nextWaypoints,
    sectionRMin: nextSectionRMin,
  });
};

export const nextHeadingKeyframeName = (path: PathModel): string => {
  return getDefaultHeadingKeyframeName(path.headingKeyframes.length);
};

export const appendHeadingKeyframe = (
  path: PathModel,
  headingKeyframe: HeadingKeyframe,
): PathModel => {
  return normalizePathSections({
    ...path,
    headingKeyframes: [...path.headingKeyframes, headingKeyframe],
  });
};

export const removeHeadingKeyframe = (
  path: PathModel,
  headingKeyframeId: string,
): PathModel => {
  return normalizePathSections({
    ...path,
    headingKeyframes: path.headingKeyframes.filter(
      (keyframe) => keyframe.id !== headingKeyframeId,
    ),
  });
};

export const removeWaypointAt = (
  path: PathModel,
  removeIndex: number,
): PathModel => {
  if (removeIndex < 0 || removeIndex >= path.waypoints.length) {
    return path;
  }

  const nextWaypoints = path.waypoints.filter(
    (_, index) => index !== removeIndex,
  );
  if (nextWaypoints.length <= 1) {
    return {
      ...path,
      waypoints: nextWaypoints,
      sectionRMin: [],
    };
  }

  const nextSectionRMin: (number | null)[] = [];

  for (let index = 0; index < nextWaypoints.length - 1; index += 1) {
    if (index < removeIndex - 1) {
      nextSectionRMin.push(path.sectionRMin[index] ?? null);
      continue;
    }

    if (index === removeIndex - 1) {
      const start = nextWaypoints[index];
      const end = nextWaypoints[index + 1];
      if (start !== undefined && end !== undefined) {
        nextSectionRMin.push(null);
      }
      continue;
    }

    nextSectionRMin.push(path.sectionRMin[index + 1] ?? null);
  }

  return normalizePathSections({
    ...path,
    waypoints: nextWaypoints,
    sectionRMin: nextSectionRMin,
  });
};
