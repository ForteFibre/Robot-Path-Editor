export const SECTION_R_MIN_INPUT_STEP = 0.001;
export const DEFAULT_COORDINATE_INPUT_STEP = 0.001;
export const DEFAULT_ANGLE_INPUT_STEP = 0.1;
export const DEFAULT_CSV_EXPORT_STEP = 0.005;
export const MIN_CSV_EXPORT_STEP = 0.001;
export const MIN_RENDER_STEP = 0.005;
export const MIN_CANVAS_SCALE = 5;
export const MAX_CANVAS_SCALE = 2000;
export const DEFAULT_CANVAS_SCALE = 20;
export const WORLD_GUIDE_EXTENT = 100;
export const SNAP_DISTANCE_SCREEN_PX = 6;
export const SNAP_DISTANCE_WORLD_AT_DEFAULT_SCALE = 0.02;
export const SNAP_ANGLE_DEG = 4;

export const trimTrailingZeros = (value: string): string => {
  return value.replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');
};

export const formatMetricValue = (value: number, decimals = 3): string => {
  if (!Number.isFinite(value)) {
    return '';
  }

  return trimTrailingZeros(value.toFixed(decimals));
};

export const getMetricStepDecimals = (
  step: number,
  maxDecimals = 3,
): number => {
  if (!Number.isFinite(step) || step <= 0) {
    return maxDecimals;
  }

  return Math.min(maxDecimals, Math.max(0, Math.ceil(-Math.log10(step))));
};
