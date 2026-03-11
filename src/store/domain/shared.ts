import {
  createPath,
  initialWorkspace,
  makeId,
  normalizePathSections,
} from '../../domain/models';
import type {
  HeadingKeyframe,
  PathModel,
  Point,
  SelectionState,
  Waypoint,
} from '../../domain/models';
import {
  getDefaultHeadingKeyframeName,
  getDefaultWaypointName,
} from '../../domain/naming';
import { collectReferencedPointIds } from '../../domain/pointResolution';
import type { DomainState } from '../types';

const normalizeLinkedWaypointMirrorNames = (
  paths: PathModel[],
  points: Point[],
): Point[] => {
  const pointsById = new Map(points.map((point) => [point.id, point]));
  const linkedPointNames = new Map<string, string>();

  for (const path of paths) {
    for (const waypoint of path.waypoints) {
      if (waypoint.libraryPointId === null) {
        continue;
      }

      const linkedPoint = pointsById.get(waypoint.pointId);
      const libraryPoint = pointsById.get(waypoint.libraryPointId);

      if (
        linkedPoint === undefined ||
        libraryPoint === undefined ||
        !libraryPoint.isLibrary ||
        linkedPoint.name === libraryPoint.name
      ) {
        continue;
      }

      linkedPointNames.set(linkedPoint.id, libraryPoint.name);
    }
  }

  if (linkedPointNames.size === 0) {
    return points;
  }

  return points.map((point) => {
    const mirroredName = linkedPointNames.get(point.id);

    if (mirroredName === undefined) {
      return point;
    }

    return {
      ...point,
      name: mirroredName,
    };
  });
};

const fallbackDomainState = (): DomainState => {
  const workspace = initialWorkspace();

  return {
    paths: workspace.paths,
    points: workspace.points,
    lockedPointIds: workspace.lockedPointIds,
    activePathId: workspace.activePathId,
  };
};

const normalizeWaypointsWithExistingPoints = (
  path: PathModel,
  pointsById: Set<string>,
  libraryPointIds: Set<string>,
): PathModel => {
  return normalizePathSections({
    ...path,
    waypoints: path.waypoints
      .map((waypoint) => {
        if (!pointsById.has(waypoint.pointId)) {
          return null;
        }

        return {
          ...waypoint,
          libraryPointId:
            waypoint.libraryPointId !== null &&
            libraryPointIds.has(waypoint.libraryPointId)
              ? waypoint.libraryPointId
              : null,
        };
      })
      .filter((waypoint): waypoint is Waypoint => waypoint !== null),
  });
};

const normalizePoints = (domain: DomainState): Point[] => {
  const referencedPointIds = collectReferencedPointIds(domain.paths);

  return domain.points.filter(
    (point) => point.isLibrary || referencedPointIds.has(point.id),
  );
};

export const normalizeDomainState = (domain: DomainState): DomainState => {
  const pointIds = new Set(domain.points.map((point) => point.id));
  const libraryPointIds = new Set(
    domain.points.filter((point) => point.isLibrary).map((point) => point.id),
  );
  const paths = domain.paths.map((path) =>
    normalizeWaypointsWithExistingPoints(path, pointIds, libraryPointIds),
  );

  const normalizedPoints = normalizePoints({
    ...domain,
    paths,
  });
  const normalizedPointIdSet = new Set(
    normalizedPoints.map((point) => point.id),
  );
  const normalizedLibraryPointIds = new Set(
    normalizedPoints
      .filter((point) => point.isLibrary)
      .map((point) => point.id),
  );

  const normalizedPaths = paths.map((path) =>
    normalizeWaypointsWithExistingPoints(
      path,
      normalizedPointIdSet,
      normalizedLibraryPointIds,
    ),
  );
  const normalizedMirroredPoints = normalizeLinkedWaypointMirrorNames(
    normalizedPaths,
    normalizedPoints,
  );

  const activePath =
    normalizedPaths.find((path) => path.id === domain.activePathId) ??
    normalizedPaths[0];

  if (activePath === undefined) {
    return fallbackDomainState();
  }

  return {
    ...domain,
    paths: normalizedPaths,
    points: normalizedMirroredPoints,
    lockedPointIds: domain.lockedPointIds.filter((pointId) =>
      normalizedMirroredPoints.some(
        (point) => point.id === pointId && point.isLibrary,
      ),
    ),
    activePathId: activePath.id,
  };
};

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

export const findPointById = (
  domain: DomainState,
  pointId: string,
): Point | undefined => {
  return domain.points.find((point) => point.id === pointId);
};

export const findWaypoint = (
  domain: DomainState,
  pathId: string,
  waypointId: string,
): Waypoint | undefined => {
  return domain.paths
    .find((path) => path.id === pathId)
    ?.waypoints.find((waypoint) => waypoint.id === waypointId);
};

export const findHeadingKeyframe = (
  domain: DomainState,
  pathId: string,
  headingKeyframeId: string,
): HeadingKeyframe | undefined => {
  return domain.paths
    .find((path) => path.id === pathId)
    ?.headingKeyframes.find((keyframe) => keyframe.id === headingKeyframeId);
};

export const resolveWaypointPoint = (
  domain: DomainState,
  waypoint: Waypoint,
): Point | undefined => {
  return findPointById(domain, waypoint.pointId);
};

export const resolveWaypointLibraryPoint = (
  domain: DomainState,
  waypoint: Waypoint,
): Point | undefined => {
  if (waypoint.libraryPointId === null) {
    return undefined;
  }

  return findPointById(domain, waypoint.libraryPointId);
};

export const collectLinkedWaypointPointIds = (
  domain: DomainState,
  libraryPointId: string,
): Set<string> => {
  const linkedWaypointPointIds = new Set<string>();

  for (const path of domain.paths) {
    for (const waypoint of path.waypoints) {
      if (waypoint.libraryPointId === libraryPointId) {
        linkedWaypointPointIds.add(waypoint.pointId);
      }
    }
  }

  return linkedWaypointPointIds;
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

export const isLockedPoint = (
  domain: DomainState,
  pointId: string,
): boolean => {
  return domain.lockedPointIds.includes(pointId);
};

const isWaypointLinkedLibraryPointLocked = (
  domain: DomainState,
  waypoint: Waypoint,
): boolean => {
  return (
    waypoint.libraryPointId !== null &&
    isLockedPoint(domain, waypoint.libraryPointId)
  );
};

export const isWaypointCoordinateLocked = (
  domain: DomainState,
  waypoint: Waypoint,
): boolean => {
  return isWaypointLinkedLibraryPointLocked(domain, waypoint);
};

export const isWaypointRobotHeadingLocked = (
  domain: DomainState,
  waypoint: Waypoint,
): boolean => {
  return isWaypointLinkedLibraryPointLocked(domain, waypoint);
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
  for (let i = 0; i < nextWaypoints.length - 1; i++) {
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

export const getSelectedWaypoint = (
  domain: DomainState,
  selection: SelectionState,
): Waypoint | null => {
  if (selection.pathId === null || selection.waypointId === null) {
    return null;
  }

  const path = domain.paths.find(
    (candidate) => candidate.id === selection.pathId,
  );
  if (path === undefined) {
    return null;
  }

  return (
    path.waypoints.find((waypoint) => waypoint.id === selection.waypointId) ??
    null
  );
};

export const getSelectedHeadingKeyframe = (
  domain: DomainState,
  selection: SelectionState,
): HeadingKeyframe | null => {
  if (selection.pathId === null || selection.headingKeyframeId === null) {
    return null;
  }

  const path = domain.paths.find(
    (candidate) => candidate.id === selection.pathId,
  );
  if (path === undefined) {
    return null;
  }

  return (
    path.headingKeyframes.find(
      (keyframe) => keyframe.id === selection.headingKeyframeId,
    ) ?? null
  );
};
