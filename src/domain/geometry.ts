import type { CanvasTransform } from './models';

export type Point = {
  x: number;
  y: number;
};

export type SnapGuideLine = {
  start: Point;
  end: Point;
};

export type SnapGuide = {
  x: number | null;
  y: number | null;
  line: SnapGuideLine | null;
  point: Point | null;
  label: string | null;
};

export const EMPTY_SNAP_GUIDE: SnapGuide = {
  x: null,
  y: null,
  line: null,
  point: null,
  label: null,
};

export const normalizeAngleDeg = (angle: number): number => {
  const normalized = ((angle % 360) + 360) % 360;
  return normalized;
};

export const shortestAngleDeltaDeg = (from: number, to: number): number => {
  const a = normalizeAngleDeg(from);
  const b = normalizeAngleDeg(to);
  const raw = b - a;

  if (raw > 180) {
    return raw - 360;
  }

  if (raw < -180) {
    return raw + 360;
  }

  return raw;
};

export const interpolateAngleDeg = (
  from: number,
  to: number,
  t: number,
): number => {
  const delta = shortestAngleDeltaDeg(from, to);
  return normalizeAngleDeg(from + delta * t);
};

export const distance = (a: Point, b: Point): number => {
  return Math.hypot(b.x - a.x, b.y - a.y);
};

export const headingDegFromPoints = (a: Point, b: Point): number => {
  return normalizeAngleDeg((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
};

export const toRadians = (deg: number): number => {
  return (deg * Math.PI) / 180;
};

export const pointFromHeading = (
  origin: Point,
  headingDeg: number,
  length: number,
): Point => {
  const rad = toRadians(headingDeg);
  return {
    x: origin.x + Math.cos(rad) * length,
    y: origin.y + Math.sin(rad) * length,
  };
};

export const worldToCanvasPoint = (point: Point): Point => {
  return {
    x: -point.y,
    y: -point.x,
  };
};

export const canvasToWorldPoint = worldToCanvasPoint;

export const screenToWorld = (
  point: Point,
  transform: CanvasTransform,
): Point => {
  return canvasToWorldPoint({
    x: (point.x - transform.x) / transform.k,
    y: (point.y - transform.y) / transform.k,
  });
};

export const worldToScreen = (
  point: Point,
  transform: CanvasTransform,
): Point => {
  const canvasPoint = worldToCanvasPoint(point);
  return {
    x: canvasPoint.x * transform.k + transform.x,
    y: canvasPoint.y * transform.k + transform.y,
  };
};
