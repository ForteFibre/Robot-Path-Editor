import {
  createLibraryPoint,
  createPoint,
  createWaypoint,
} from '../../domain/models';
import {
  getDefaultWaypointName,
  normalizeOptionalName,
} from '../../domain/naming';
import type { Point, SelectionState } from '../../domain/models';
import type { DomainState } from '../types';
import {
  appendPoint,
  appendWaypoint,
  collectLinkedWaypointPointIds,
  getSelectedWaypoint,
  insertWaypointAt,
  isLockedPoint,
  nextWaypointName,
  normalizeDomainState,
  prependWaypoint,
  resolveWaypointPoint,
  updatePath,
} from './shared';

type LibraryPointMutationResult = {
  domain: DomainState;
  pointId: string | null;
};

const listLibraryPoints = (domain: DomainState): Point[] => {
  return domain.points.filter((point) => point.isLibrary);
};

const getDefaultLibraryPointName = (index: number): string => {
  return `Library Point ${index + 1}`;
};

const resolveLibraryPointName = (
  value: string | undefined,
  fallback: string,
): string => {
  return normalizeOptionalName(value) ?? fallback;
};

const findLibraryPoint = (
  domain: DomainState,
  pointId: string,
): Point | undefined => {
  return domain.points.find((point) => point.id === pointId && point.isLibrary);
};

const buildLibraryPointPatch = (params: {
  domain: DomainState;
  pointId: string;
  patch: Partial<Omit<Point, 'id' | 'isLibrary'>>;
  target: Point;
}): Partial<Omit<Point, 'id'>> => {
  const { domain, pointId, patch, target } = params;
  const pointPatch: Partial<Omit<Point, 'id'>> = {};
  const pointLocked = isLockedPoint(domain, pointId);
  const coordinatePatchLocked =
    (patch.x !== undefined || patch.y !== undefined) && pointLocked;
  const robotHeadingPatchLocked =
    patch.robotHeading !== undefined && pointLocked;

  if (patch.name !== undefined) {
    pointPatch.name = normalizeOptionalName(patch.name) ?? target.name;
  }

  if (patch.robotHeading !== undefined && !robotHeadingPatchLocked) {
    pointPatch.robotHeading = patch.robotHeading;
  }

  if (coordinatePatchLocked) {
    return pointPatch;
  }

  if (patch.x !== undefined) {
    pointPatch.x = patch.x;
  }

  if (patch.y !== undefined) {
    pointPatch.y = patch.y;
  }

  return pointPatch;
};

const buildLinkedPointPatch = (
  pointPatch: Partial<Omit<Point, 'id'>>,
): Partial<Pick<Point, 'name' | 'x' | 'y' | 'robotHeading'>> => {
  const syncPointPatch: Partial<
    Pick<Point, 'name' | 'x' | 'y' | 'robotHeading'>
  > = {};

  if (pointPatch.name !== undefined) {
    syncPointPatch.name = pointPatch.name;
  }

  if (pointPatch.x !== undefined) {
    syncPointPatch.x = pointPatch.x;
  }

  if (pointPatch.y !== undefined) {
    syncPointPatch.y = pointPatch.y;
  }

  if (pointPatch.robotHeading !== undefined) {
    syncPointPatch.robotHeading = pointPatch.robotHeading;
  }

  return syncPointPatch;
};

export const addLibraryPoint = (
  domain: DomainState,
  input: Partial<Omit<Point, 'id' | 'isLibrary'>> = {},
): LibraryPointMutationResult => {
  const libraryPoints = listLibraryPoints(domain);
  const point = createLibraryPoint(
    resolveLibraryPointName(
      input.name,
      getDefaultLibraryPointName(libraryPoints.length),
    ),
    {
      x: input.x ?? 0,
      y: input.y ?? 0,
      robotHeading: input.robotHeading ?? null,
    },
  );

  return {
    domain: {
      ...domain,
      points: [...domain.points, point],
    },
    pointId: point.id,
  };
};

export const addLibraryPointFromSelection = (
  domain: DomainState,
  selection: SelectionState,
): LibraryPointMutationResult => {
  const selected = getSelectedWaypoint(domain, selection);
  if (selected === null) {
    return {
      domain,
      pointId: null,
    };
  }

  const selectedPoint = resolveWaypointPoint(domain, selected);
  if (selectedPoint === undefined) {
    return {
      domain,
      pointId: null,
    };
  }

  const selectedPath = domain.paths.find(
    (path) => path.id === selection.pathId,
  );
  const selectedWaypointIndex =
    selectedPath?.waypoints.findIndex(
      (waypoint) => waypoint.id === selected.id,
    ) ?? -1;

  const result = addLibraryPoint(domain, {
    name: resolveLibraryPointName(
      selectedPoint.name,
      selectedWaypointIndex >= 0
        ? getDefaultWaypointName(selectedWaypointIndex)
        : getDefaultLibraryPointName(listLibraryPoints(domain).length),
    ),
    x: selectedPoint.x,
    y: selectedPoint.y,
    robotHeading: selectedPoint.robotHeading,
  });

  if (result.pointId === null || selection.pathId === null) {
    return result;
  }

  return {
    ...result,
    domain: updatePath(result.domain, selection.pathId, (path) => ({
      ...path,
      waypoints: path.waypoints.map((waypoint) => {
        if (waypoint.id !== selected.id) {
          return waypoint;
        }

        return {
          ...waypoint,
          libraryPointId: result.pointId,
        };
      }),
    })),
  };
};

export const deleteLibraryPoint = (
  domain: DomainState,
  pointId: string,
): DomainState => {
  const target = findLibraryPoint(domain, pointId);
  if (target === undefined) {
    return domain;
  }

  const paths = domain.paths.map((path) => ({
    ...path,
    waypoints: path.waypoints.map((waypoint) => {
      if (waypoint.libraryPointId !== target.id) {
        return waypoint;
      }

      return {
        ...waypoint,
        libraryPointId: null,
      };
    }),
  }));

  return normalizeDomainState({
    ...domain,
    paths,
    points: domain.points.filter((point) => point.id !== target.id),
    lockedPointIds: domain.lockedPointIds.filter(
      (lockedId) => lockedId !== target.id,
    ),
  });
};

export const updateLibraryPoint = (
  domain: DomainState,
  pointId: string,
  patch: Partial<Omit<Point, 'id' | 'isLibrary'>>,
): DomainState => {
  const target = findLibraryPoint(domain, pointId);
  if (target === undefined) {
    return domain;
  }

  const pointPatch = buildLibraryPointPatch({
    domain,
    pointId,
    patch,
    target,
  });

  if (Object.keys(pointPatch).length === 0) {
    return domain;
  }

  const linkedWaypointPointIds = collectLinkedWaypointPointIds(
    domain,
    target.id,
  );
  const syncPointPatch = buildLinkedPointPatch(pointPatch);

  return normalizeDomainState({
    ...domain,
    points: domain.points.map((point) => {
      if (point.id === target.id) {
        return {
          ...point,
          ...pointPatch,
        };
      }

      if (
        linkedWaypointPointIds.has(point.id) &&
        Object.keys(syncPointPatch).length > 0
      ) {
        return {
          ...point,
          ...syncPointPatch,
        };
      }

      return point;
    }),
  });
};

export const updateLibraryPointRobotHeading = (
  domain: DomainState,
  pointId: string,
  robotHeading: number | null,
): DomainState => {
  return updateLibraryPoint(domain, pointId, { robotHeading });
};

export const toggleLibraryPointLock = (
  domain: DomainState,
  pointId: string,
): DomainState => {
  const point = findLibraryPoint(domain, pointId);
  if (point === undefined) {
    return domain;
  }

  const isLocked = domain.lockedPointIds.includes(pointId);

  return {
    ...domain,
    lockedPointIds: isLocked
      ? domain.lockedPointIds.filter((lockedId) => lockedId !== pointId)
      : [...domain.lockedPointIds, pointId],
  };
};

type InsertLibraryWaypointInput = {
  pathId: string;
  x: number;
  y: number;
  libraryPointId?: string;
  linkToLibrary?: boolean;
  coordinateSource?: 'input' | 'library';
  afterWaypointId?: string | null | undefined;
};

type InsertLibraryWaypointResult = {
  domain: DomainState;
  waypointId: string | null;
};

export const insertLibraryWaypoint = (
  domain: DomainState,
  input: InsertLibraryWaypointInput,
): InsertLibraryWaypointResult => {
  const libraryPoint =
    input.libraryPointId === undefined
      ? undefined
      : findLibraryPoint(domain, input.libraryPointId);
  const shouldLink = input.linkToLibrary ?? libraryPoint !== undefined;

  if (libraryPoint === undefined && shouldLink) {
    return {
      domain,
      waypointId: null,
    };
  }

  const activePath = domain.paths.find((path) => path.id === input.pathId);
  const referenceWaypoint =
    input.afterWaypointId === undefined
      ? activePath?.waypoints.at(-1)
      : (activePath?.waypoints.find(
          (waypoint) => waypoint.id === input.afterWaypointId,
        ) ?? activePath?.waypoints.at(-1));
  const heading = referenceWaypoint?.pathHeading ?? 0;
  const useLibraryCoordinates = input.coordinateSource === 'library';
  const targetX =
    libraryPoint !== undefined && useLibraryCoordinates
      ? libraryPoint.x
      : input.x;
  const targetY =
    libraryPoint !== undefined && useLibraryCoordinates
      ? libraryPoint.y
      : input.y;
  const pointName =
    libraryPoint?.name ??
    (activePath === undefined
      ? getDefaultWaypointName(0)
      : nextWaypointName(activePath));
  const point = createPoint({
    x: targetX,
    y: targetY,
    robotHeading: libraryPoint?.robotHeading ?? null,
    isLibrary: false,
    name: pointName,
  });
  const waypoint = createWaypoint({
    pointId: point.id,
    libraryPointId:
      shouldLink && libraryPoint !== undefined ? libraryPoint.id : null,
    pathHeading: heading,
  });

  const nextDomainWithPoint = appendPoint(domain, point);
  const nextDomain = updatePath(nextDomainWithPoint, input.pathId, (path) => {
    if (input.afterWaypointId === null) {
      return prependWaypoint(path, waypoint);
    }

    if (input.afterWaypointId !== undefined) {
      const afterIndex = path.waypoints.findIndex(
        (candidate) => candidate.id === input.afterWaypointId,
      );
      if (afterIndex >= 0) {
        return insertWaypointAt(path, waypoint, afterIndex);
      }
    }

    return appendWaypoint(path, waypoint);
  });

  return {
    domain: nextDomain,
    waypointId: waypoint.id,
  };
};

export const insertLibraryWaypointAtEndOfPath = (
  domain: DomainState,
  libraryPointId: string,
  pathId: string,
): InsertLibraryWaypointResult => {
  const libraryPoint = findLibraryPoint(domain, libraryPointId);
  const path = domain.paths.find((candidate) => candidate.id === pathId);

  if (libraryPoint === undefined || path === undefined) {
    return {
      domain,
      waypointId: null,
    };
  }

  return insertLibraryWaypoint(domain, {
    pathId,
    libraryPointId,
    x: libraryPoint.x,
    y: libraryPoint.y,
    linkToLibrary: true,
    coordinateSource: 'library',
    afterWaypointId: path.waypoints.at(-1)?.id,
  });
};
