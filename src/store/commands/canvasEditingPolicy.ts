import type { SelectionState, PathModel } from '../../domain/models';

export const resolveWaypointInsertionIndex = (
  path: Pick<PathModel, 'id' | 'waypoints'>,
  selection: SelectionState,
): number => {
  if (selection.pathId !== path.id || selection.waypointId === null) {
    return path.waypoints.length;
  }

  const selectedWaypointIndex = path.waypoints.findIndex(
    (waypoint) => waypoint.id === selection.waypointId,
  );

  return selectedWaypointIndex < 0
    ? path.waypoints.length
    : selectedWaypointIndex + 1;
};

export const isWaypointLocked = (
  waypointId: string,
  paths: Pick<PathModel, 'waypoints'>[],
  lockedPointIds: readonly string[],
): boolean => {
  for (const path of paths) {
    const waypoint = path.waypoints.find(
      (candidate) => candidate.id === waypointId,
    );
    if (waypoint === undefined) {
      continue;
    }

    return (
      waypoint.libraryPointId !== null &&
      lockedPointIds.includes(waypoint.libraryPointId)
    );
  }

  return false;
};
