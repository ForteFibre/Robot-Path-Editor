export type SnapToggleKey =
  | 'alignX'
  | 'alignY'
  | 'previousHeadingLine'
  | 'segmentParallel'
  | 'segmentPerpendicular'
  | 'previousWaypointHeading'
  | 'cardinalAngles'
  | 'segmentHeading';

export type SnapSettings = Record<SnapToggleKey, boolean>;

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  alignX: true,
  alignY: true,
  previousHeadingLine: true,
  segmentParallel: true,
  segmentPerpendicular: true,
  previousWaypointHeading: true,
  cardinalAngles: true,
  segmentHeading: true,
};
