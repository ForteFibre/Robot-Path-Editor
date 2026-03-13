import type { Waypoint } from '../../domain/models';
import type { DomainState } from '../types';

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
