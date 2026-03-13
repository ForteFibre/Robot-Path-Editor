import {
  EMPTY_SNAP_GUIDE,
  headingDegFromPoints,
  pointFromHeading,
  toRadians,
  type Point,
  type SnapGuide,
} from '../geometry';
import { WORLD_GUIDE_EXTENT } from '../metricScale';

export const buildLineGuide = (
  origin: Point,
  headingDeg: number,
  label: string,
): SnapGuide => {
  const backward = pointFromHeading(
    origin,
    headingDeg + 180,
    WORLD_GUIDE_EXTENT,
  );
  const forward = pointFromHeading(origin, headingDeg, WORLD_GUIDE_EXTENT);
  return {
    ...EMPTY_SNAP_GUIDE,
    line: {
      start: backward,
      end: forward,
    },
    point: origin,
    label,
  };
};

export const projectOntoLine = (
  source: Point,
  origin: Point,
  headingDeg: number,
): { point: Point; distance: number } => {
  const rad = toRadians(headingDeg);
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const offsetX = source.x - origin.x;
  const offsetY = source.y - origin.y;
  const distanceAlongLine = offsetX * dx + offsetY * dy;
  const point = {
    x: origin.x + dx * distanceAlongLine,
    y: origin.y + dy * distanceAlongLine,
  };

  return {
    point,
    distance: Math.hypot(point.x - source.x, point.y - source.y),
  };
};

export const resolveClosestAxisValue = (
  sourceValue: number,
  candidates: Point[],
  axis: 'x' | 'y',
  threshold: number,
): number | null => {
  let best: number | null = null;

  for (const candidate of candidates) {
    const candidateValue = candidate[axis];
    if (Math.abs(candidateValue - sourceValue) > threshold) {
      continue;
    }

    if (
      best === null ||
      Math.abs(candidateValue - sourceValue) < Math.abs(best - sourceValue)
    ) {
      best = candidateValue;
    }
  }

  return best;
};

export const getPreviousSegmentHeading = (
  previousSegmentStart: Point | null,
  previousPoint: Point | null,
): number | null => {
  if (previousSegmentStart === null || previousPoint === null) {
    return null;
  }

  if (
    previousSegmentStart.x === previousPoint.x &&
    previousSegmentStart.y === previousPoint.y
  ) {
    return null;
  }

  return headingDegFromPoints(previousSegmentStart, previousPoint);
};

export const pickBestCandidate = <TCandidate extends { score: number }>(
  candidates: readonly TCandidate[],
): TCandidate | null => {
  let best: TCandidate | null = null;

  for (const candidate of candidates) {
    if (best === null || candidate.score < best.score) {
      best = candidate;
    }
  }

  return best;
};
