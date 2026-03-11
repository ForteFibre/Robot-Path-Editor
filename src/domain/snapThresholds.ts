import {
  DEFAULT_CANVAS_SCALE,
  SNAP_ANGLE_DEG,
  SNAP_DISTANCE_SCREEN_PX,
  SNAP_DISTANCE_WORLD_AT_DEFAULT_SCALE,
} from './metricScale';

export type SnapThresholds = {
  point: number;
  angleDeg: number;
};

export const resolveSnapThresholds = (canvasScale: number): SnapThresholds => {
  const safeScale =
    Number.isFinite(canvasScale) && canvasScale > 0
      ? canvasScale
      : DEFAULT_CANVAS_SCALE;
  const screenSpaceWorldThreshold = SNAP_DISTANCE_SCREEN_PX / safeScale;
  const worldBaseline =
    SNAP_DISTANCE_WORLD_AT_DEFAULT_SCALE *
    Math.sqrt(DEFAULT_CANVAS_SCALE / safeScale);

  return {
    point: Math.min(screenSpaceWorldThreshold, worldBaseline),
    angleDeg: SNAP_ANGLE_DEG,
  };
};
