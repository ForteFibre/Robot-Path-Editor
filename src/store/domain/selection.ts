import type {
  HeadingKeyframe,
  SelectionState,
  Waypoint,
} from '../../domain/models';
import type { DomainState } from '../types';

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
