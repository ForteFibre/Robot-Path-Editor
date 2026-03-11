import { normalizePathSections } from '../../domain/models';
import type { EditorMode, Waypoint } from '../../domain/models';
import {
  getEffectiveWaypointName,
  normalizeOptionalName,
} from '../../domain/naming';
import type { DomainState, WaypointUpdatePatch } from '../types';
import { updateLibraryPoint } from './libraryMutators';
import {
  appendWaypoint,
  findWaypoint,
  isWaypointCoordinateLocked,
  isWaypointRobotHeadingLocked,
  normalizeDomainState,
  removeWaypointAt,
  resolveWaypointLibraryPoint,
  resolveWaypointPoint,
  updatePoint,
  updatePath,
} from './shared';

const isWaypointPatchNoOp = (
  waypoint: Waypoint,
  pointName: string | undefined,
  pointRobotHeading: number | null,
  pointX: number,
  pointY: number,
  patch: WaypointUpdatePatch,
): boolean => {
  return (
    (patch.name === undefined ||
      normalizeOptionalName(patch.name) === pointName) &&
    (patch.pathHeading === undefined ||
      patch.pathHeading === waypoint.pathHeading) &&
    (patch.robotHeading === undefined ||
      patch.robotHeading === pointRobotHeading) &&
    (patch.x === undefined || patch.x === pointX) &&
    (patch.y === undefined || patch.y === pointY)
  );
};

const updateWaypointRobotHeadingOnly = (
  domain: DomainState,
  waypoint: Waypoint,
  nextRobotHeading: number | null,
): DomainState => {
  if (isWaypointRobotHeadingLocked(domain, waypoint)) {
    return domain;
  }

  if (waypoint.libraryPointId !== null) {
    return normalizeDomainState(
      updateLibraryPoint(domain, waypoint.libraryPointId, {
        robotHeading: nextRobotHeading,
      }),
    );
  }

  return normalizeDomainState(
    updatePoint(domain, waypoint.pointId, {
      robotHeading: nextRobotHeading,
    }),
  );
};

const buildWaypointPointPatch = (params: {
  currentName: string;
  currentX: number;
  currentY: number;
  patch: WaypointUpdatePatch;
  normalizedNamePatch: string | undefined;
  coordinateLocked: boolean;
  robotHeadingLocked: boolean;
}): Partial<{
  name: string;
  x: number;
  y: number;
  robotHeading: number | null;
}> => {
  const {
    currentName,
    currentX,
    currentY,
    patch,
    normalizedNamePatch,
    coordinateLocked,
    robotHeadingLocked,
  } = params;
  const pointPatch: Partial<{
    name: string;
    x: number;
    y: number;
    robotHeading: number | null;
  }> = {};

  if (patch.name !== undefined) {
    pointPatch.name = normalizedNamePatch ?? currentName;
  }

  if (patch.robotHeading !== undefined && !robotHeadingLocked) {
    pointPatch.robotHeading = patch.robotHeading;
  }

  if (coordinateLocked) {
    return pointPatch;
  }

  if (patch.x !== undefined) {
    pointPatch.x = patch.x ?? currentX;
  }

  if (patch.y !== undefined) {
    pointPatch.y = patch.y ?? currentY;
  }

  return pointPatch;
};

const buildWaypointStatePatch = (
  patch: WaypointUpdatePatch,
): Partial<Pick<Waypoint, 'pathHeading'>> => {
  const waypointPatch: Partial<Pick<Waypoint, 'pathHeading'>> = {};

  if (patch.pathHeading !== undefined) {
    waypointPatch.pathHeading = patch.pathHeading;
  }

  return waypointPatch;
};

type WaypointPointPatch = Partial<{
  name: string;
  x: number;
  y: number;
  robotHeading: number | null;
}>;

const buildLinkedWaypointSharedPointPatch = (
  pointPatch: WaypointPointPatch,
): Partial<Pick<WaypointPointPatch, 'name' | 'x' | 'y' | 'robotHeading'>> => {
  const sharedPointPatch: Partial<
    Pick<WaypointPointPatch, 'name' | 'x' | 'y' | 'robotHeading'>
  > = {};

  if (pointPatch.name !== undefined) {
    sharedPointPatch.name = pointPatch.name;
  }

  if (pointPatch.x !== undefined) {
    sharedPointPatch.x = pointPatch.x;
  }

  if (pointPatch.y !== undefined) {
    sharedPointPatch.y = pointPatch.y;
  }

  if (pointPatch.robotHeading !== undefined) {
    sharedPointPatch.robotHeading = pointPatch.robotHeading;
  }

  return sharedPointPatch;
};

const applyWaypointPointPatch = (params: {
  domain: DomainState;
  waypoint: Waypoint;
  pointId: string;
  pointPatch: WaypointPointPatch;
}): DomainState => {
  const { domain, waypoint, pointId, pointPatch } = params;

  if (Object.keys(pointPatch).length === 0) {
    return domain;
  }

  if (waypoint.libraryPointId === null) {
    return updatePoint(domain, pointId, pointPatch);
  }

  const sharedPointPatch = buildLinkedWaypointSharedPointPatch(pointPatch);
  if (Object.keys(sharedPointPatch).length === 0) {
    return domain;
  }

  return updateLibraryPoint(domain, waypoint.libraryPointId, sharedPointPatch);
};

export const addWaypoint = (
  domain: DomainState,
  pathId: string,
  waypoint: Waypoint,
): DomainState => {
  return updatePath(domain, pathId, (path) => ({
    ...appendWaypoint(path, waypoint),
  }));
};

export const updateWaypoint = (
  domain: DomainState,
  pathId: string,
  waypointId: string,
  patch: WaypointUpdatePatch,
  mode: EditorMode,
): DomainState => {
  const path = domain.paths.find((candidate) => candidate.id === pathId);
  if (path === undefined) {
    return domain;
  }

  const waypointIndex = path.waypoints.findIndex(
    (candidate) => candidate.id === waypointId,
  );
  if (waypointIndex < 0) {
    return domain;
  }

  const waypoint = path.waypoints[waypointIndex];
  if (waypoint === undefined) {
    return domain;
  }

  const point = resolveWaypointPoint(domain, waypoint);
  if (point === undefined) {
    return domain;
  }
  const libraryPoint = resolveWaypointLibraryPoint(domain, waypoint);

  if (mode === 'heading') {
    if (patch.robotHeading === undefined) {
      return domain;
    }

    const nextRobotHeading = patch.robotHeading;

    if (nextRobotHeading === point.robotHeading) {
      return domain;
    }

    return updateWaypointRobotHeadingOnly(domain, waypoint, nextRobotHeading);
  }

  const normalizedNamePatch =
    patch.name === undefined ? undefined : normalizeOptionalName(patch.name);

  if (
    isWaypointPatchNoOp(
      waypoint,
      getEffectiveWaypointName({
        point,
        libraryPoint,
        index: waypointIndex,
      }),
      point.robotHeading,
      point.x,
      point.y,
      patch,
    )
  ) {
    return domain;
  }

  const coordinateLocked = isWaypointCoordinateLocked(domain, waypoint);
  const robotHeadingLocked = isWaypointRobotHeadingLocked(domain, waypoint);
  const pointPatch = buildWaypointPointPatch({
    currentName: getEffectiveWaypointName({
      point,
      libraryPoint,
      index: waypointIndex,
    }),
    currentX: point.x,
    currentY: point.y,
    patch,
    normalizedNamePatch,
    coordinateLocked,
    robotHeadingLocked,
  });

  let nextDomain = applyWaypointPointPatch({
    domain,
    waypoint,
    pointId: point.id,
    pointPatch,
  });

  const waypointPatch = buildWaypointStatePatch(patch);

  if (Object.keys(waypointPatch).length > 0) {
    nextDomain = updatePath(nextDomain, pathId, (path) => ({
      ...path,
      waypoints: path.waypoints.map((candidate) => {
        if (candidate.id !== waypointId) {
          return candidate;
        }

        return {
          ...candidate,
          ...waypointPatch,
        };
      }),
    }));
  }

  return normalizeDomainState(nextDomain);
};

export const unlinkWaypointPoint = (
  domain: DomainState,
  pathId: string,
  waypointId: string,
): DomainState => {
  const waypoint = findWaypoint(domain, pathId, waypointId);
  if (
    waypoint?.libraryPointId === undefined ||
    waypoint.libraryPointId === null
  ) {
    return domain;
  }

  const localPoint = resolveWaypointPoint(domain, waypoint);
  const libraryPoint = resolveWaypointLibraryPoint(domain, waypoint);
  const nextDomain =
    localPoint !== undefined &&
    libraryPoint !== undefined &&
    localPoint.name !== libraryPoint.name
      ? updatePoint(domain, waypoint.pointId, {
          name: libraryPoint.name,
        })
      : domain;

  return updatePath(nextDomain, pathId, (path) => ({
    ...path,
    waypoints: path.waypoints.map((candidate) => {
      if (candidate.id !== waypointId) {
        return candidate;
      }

      return {
        ...candidate,
        libraryPointId: null,
      };
    }),
  }));
};

export const deleteWaypoint = (
  domain: DomainState,
  pathId: string,
  waypointId: string,
): DomainState => {
  return updatePath(domain, pathId, (path) => ({
    ...removeWaypointAt(
      path,
      path.waypoints.findIndex((waypoint) => waypoint.id === waypointId),
    ),
  }));
};

export const setSectionRMin = (
  domain: DomainState,
  pathId: string,
  sectionIndex: number,
  rMin: number | null,
): DomainState => {
  const path = domain.paths.find((candidate) => candidate.id === pathId);
  if (path === undefined) {
    return domain;
  }

  if (sectionIndex < 0 || sectionIndex >= path.waypoints.length - 1) {
    return domain;
  }

  let normalizedRMin: number | null = null;

  if (rMin !== null && Number.isFinite(rMin) && rMin > 0) {
    normalizedRMin = rMin;
  }

  if (path.sectionRMin[sectionIndex] === normalizedRMin) {
    return domain;
  }

  return updatePath(domain, pathId, (path) => {
    if (sectionIndex < 0 || sectionIndex >= path.waypoints.length - 1) {
      return path;
    }

    const sectionRMin = [...path.sectionRMin];
    sectionRMin[sectionIndex] = normalizedRMin;

    return {
      ...path,
      sectionRMin,
    };
  });
};

export const reorderWaypoint = (
  domain: DomainState,
  pathId: string,
  waypointId: string,
  newIndex: number,
): DomainState => {
  return updatePath(domain, pathId, (path) => {
    const oldIndex = path.waypoints.findIndex((wp) => wp.id === waypointId);
    if (
      oldIndex === -1 ||
      newIndex === oldIndex ||
      newIndex < 0 ||
      newIndex >= path.waypoints.length
    ) {
      return path;
    }

    const nextWaypoints = [...path.waypoints];
    const movedWaypoint = nextWaypoints[oldIndex];
    if (movedWaypoint === undefined) {
      return path;
    }

    nextWaypoints.splice(oldIndex, 1);

    nextWaypoints.splice(newIndex, 0, movedWaypoint);

    // Reordering invalidates section properties around the source and destination
    // For simplicity and safety, we null out sectionRMin.
    const nextSectionRMin: (number | null)[] = Array.from(
      { length: Math.max(0, nextWaypoints.length - 1) },
      (): number | null => null,
    );

    return normalizePathSections({
      ...path,
      waypoints: nextWaypoints,
      sectionRMin: nextSectionRMin,
    });
  });
};
