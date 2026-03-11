import type { DiscretizedPath } from '../../domain/interpolation';
import type { ResolvedPathModel } from '../../domain/pointResolution';

const getWaypointSampleIndex = (
  detail: DiscretizedPath | undefined,
  waypointIndex: number,
): number => {
  if (detail === undefined) {
    return -1;
  }

  if (waypointIndex === 0) {
    return 0;
  }

  return (
    detail.sectionSampleRanges[waypointIndex - 1]?.endSampleIndex ??
    detail.samples.length - 1
  );
};

export const resolveWaypointRobotHeadingHandleAngle = (
  path: ResolvedPathModel,
  detail: DiscretizedPath | undefined,
  waypointIndex: number,
): number => {
  const waypoint = path.waypoints[waypointIndex];
  const sampleIndex = getWaypointSampleIndex(detail, waypointIndex);
  const sample = sampleIndex >= 0 ? detail?.samples[sampleIndex] : undefined;

  return sample?.robotHeading ?? waypoint?.pathHeading ?? 0;
};
