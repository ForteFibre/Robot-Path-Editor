import type { HeadingKeyframe, Point, Waypoint } from '../../domain/models';
import type { DomainState } from '../types';

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
