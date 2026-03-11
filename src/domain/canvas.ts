import type { CanvasTransform } from './models';
import {
  MAX_CANVAS_SCALE as MAX_CANVAS_SCALE_VALUE,
  MIN_CANVAS_SCALE as MIN_CANVAS_SCALE_VALUE,
  MIN_RENDER_STEP as MIN_RENDER_STEP_VALUE,
} from './metricScale';

export {
  DEFAULT_CANVAS_SCALE,
  MAX_CANVAS_SCALE,
  MIN_CANVAS_SCALE,
  MIN_RENDER_STEP,
} from './metricScale';

const ZOOM_SENSITIVITY = 0.0015;
const TARGET_RENDER_STEP_PX = 8;
const TARGET_GRID_STEP_PX = 96;
const GRID_STEP_SERIES = [1, 2, 5] as const;
const MAX_RENDER_STEP = 2;
export const HEADING_HANDLE_SCREEN_DISTANCE = 32;

export const clampCanvasScale = (scale: number): number => {
  return Math.min(
    MAX_CANVAS_SCALE_VALUE,
    Math.max(MIN_CANVAS_SCALE_VALUE, scale),
  );
};

export const getNextCanvasScale = (
  currentScale: number,
  delta: number,
): number => {
  return clampCanvasScale(currentScale * Math.exp(-delta * ZOOM_SENSITIVITY));
};

export const zoomCanvasTransformAtPoint = (
  transform: CanvasTransform,
  centerX: number,
  centerY: number,
  delta: number,
): CanvasTransform => {
  const newK = getNextCanvasScale(transform.k, delta);

  return {
    x: centerX - (centerX - transform.x) * (newK / transform.k),
    y: centerY - (centerY - transform.y) * (newK / transform.k),
    k: newK,
  };
};

export const getCanvasRenderStep = (scale: number): number => {
  return Math.min(
    MAX_RENDER_STEP,
    Math.max(MIN_RENDER_STEP_VALUE, TARGET_RENDER_STEP_PX / scale),
  );
};

export const getCanvasGridSize = (scale: number): number => {
  const targetWorldStep = TARGET_GRID_STEP_PX / scale;
  const exponent = Math.floor(Math.log10(targetWorldStep));
  const candidateSizes = new Set<number>();

  for (const offset of [-1, 0, 1]) {
    const base = 10 ** (exponent + offset);

    for (const multiplier of GRID_STEP_SERIES) {
      candidateSizes.add(multiplier * base);
    }
  }

  let bestSize = targetWorldStep;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const size of candidateSizes) {
    const distance = Math.abs(size - targetWorldStep);

    if (distance < smallestDistance) {
      smallestDistance = distance;
      bestSize = size;
    }
  }

  return bestSize;
};

export const getCanvasGridValues = (
  min: number,
  max: number,
  step: number,
): number[] => {
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const values: number[] = [];

  for (let value = start; value <= end; value += step) {
    values.push(Number(value.toFixed(6)));
  }

  return values;
};

export const getHeadingHandleDistance = (scale: number): number => {
  return HEADING_HANDLE_SCREEN_DISTANCE / scale;
};
