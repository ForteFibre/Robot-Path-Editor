import { projectPointToPathSections } from '../../domain/headingKeyframes';
import type { Point } from '../../domain/geometry';
import type { DiscretizedPath } from '../../domain/interpolation';
import type { ResolvedPathModel } from '../../domain/pointResolution';

export const resolveDropInsertionAfterWaypointId = (params: {
  activePath: ResolvedPathModel | null;
  detail: DiscretizedPath | undefined;
  worldPoint: Point;
}): string | null | undefined => {
  const { activePath, detail, worldPoint } = params;

  if (activePath === null || activePath.waypoints.length === 0) {
    return undefined;
  }

  if (activePath.waypoints.length === 1) {
    return activePath.waypoints[0]?.id;
  }

  if (detail === undefined) {
    return activePath.waypoints.at(-1)?.id;
  }

  const projected = projectPointToPathSections(detail, worldPoint);

  if (projected === null) {
    return activePath.waypoints.at(-1)?.id;
  }

  if (projected.sectionIndex === 0 && projected.sectionRatio < 0.02) {
    return null;
  }

  const isLastSection =
    projected.sectionIndex === activePath.waypoints.length - 2;

  if (isLastSection && projected.sectionRatio > 0.98) {
    return activePath.waypoints.at(-1)?.id;
  }

  return activePath.waypoints[projected.sectionIndex]?.id;
};
