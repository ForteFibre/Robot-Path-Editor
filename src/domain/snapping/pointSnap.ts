import {
  EMPTY_SNAP_GUIDE,
  normalizeAngleDeg,
  type Point,
  type SnapGuide,
} from '../geometry';
import {
  buildLineGuide,
  getPreviousSegmentHeading,
  pickBestCandidate,
  projectOntoLine,
  resolveClosestAxisValue,
} from './shared';
import type { PointCandidate, PointSnapContext } from './types';

const getAxisSnapLabel = (
  bestX: number | null,
  bestY: number | null,
): string => {
  if (bestX !== null && bestY !== null) {
    return 'align x/y';
  }

  if (bestX !== null) {
    return 'align x';
  }

  return 'align y';
};

const collectAxisSnapCandidate = (
  source: Point,
  context: PointSnapContext,
): PointCandidate | null => {
  const { settings, threshold } = context;
  if (!settings.alignX && !settings.alignY) {
    return null;
  }

  const bestX = settings.alignX
    ? resolveClosestAxisValue(source.x, context.candidates, 'x', threshold)
    : null;
  const bestY = settings.alignY
    ? resolveClosestAxisValue(source.y, context.candidates, 'y', threshold)
    : null;

  if (bestX === null && bestY === null) {
    return null;
  }

  const deltaX = bestX === null ? 0 : Math.abs(bestX - source.x);
  const deltaY = bestY === null ? 0 : Math.abs(bestY - source.y);

  return {
    point: {
      x: bestX ?? source.x,
      y: bestY ?? source.y,
    },
    score: deltaX + deltaY,
    guide: {
      ...EMPTY_SNAP_GUIDE,
      x: bestX,
      y: bestY,
      label: getAxisSnapLabel(bestX, bestY),
    },
  };
};

const collectPreviousHeadingLineCandidate = (
  source: Point,
  context: PointSnapContext,
): PointCandidate | null => {
  if (
    !context.settings.previousHeadingLine ||
    context.previousPoint === null ||
    context.previousHeadingDeg === null
  ) {
    return null;
  }

  const projected = projectOntoLine(
    source,
    context.previousPoint,
    context.previousHeadingDeg,
  );
  if (projected.distance > context.threshold) {
    return null;
  }

  return {
    point: projected.point,
    score: projected.distance + 0.15,
    guide: buildLineGuide(
      context.previousPoint,
      context.previousHeadingDeg,
      'prev heading line',
    ),
  };
};

const collectSegmentParallelCandidate = (
  source: Point,
  previousPoint: Point,
  previousSegmentHeading: number,
  threshold: number,
): PointCandidate | null => {
  const projected = projectOntoLine(
    source,
    previousPoint,
    previousSegmentHeading,
  );
  if (projected.distance > threshold) {
    return null;
  }

  return {
    point: projected.point,
    score: projected.distance + 0.25,
    guide: buildLineGuide(
      previousPoint,
      previousSegmentHeading,
      'parallel segment',
    ),
  };
};

const collectSegmentPerpendicularCandidate = (
  source: Point,
  previousPoint: Point,
  previousSegmentHeading: number,
  threshold: number,
): PointCandidate | null => {
  const perpendicularHeading = normalizeAngleDeg(previousSegmentHeading + 90);
  const projected = projectOntoLine(
    source,
    previousPoint,
    perpendicularHeading,
  );
  if (projected.distance > threshold) {
    return null;
  }

  return {
    point: projected.point,
    score: projected.distance + 0.35,
    guide: buildLineGuide(
      previousPoint,
      perpendicularHeading,
      'perpendicular segment',
    ),
  };
};

const pickBestPointCandidate = (
  candidates: readonly PointCandidate[],
): PointCandidate | null => pickBestCandidate(candidates);

export const resolvePointSnap = (
  source: Point,
  context: PointSnapContext,
): { point: Point; guide: SnapGuide } => {
  const candidates: PointCandidate[] = [];

  const axisCandidate = collectAxisSnapCandidate(source, context);
  if (axisCandidate !== null) {
    candidates.push(axisCandidate);
  }

  const previousHeadingLineCandidate = collectPreviousHeadingLineCandidate(
    source,
    context,
  );
  if (previousHeadingLineCandidate !== null) {
    candidates.push(previousHeadingLineCandidate);
  }

  const previousSegmentHeading = getPreviousSegmentHeading(
    context.previousSegmentStart,
    context.previousPoint,
  );

  if (previousSegmentHeading !== null && context.previousPoint !== null) {
    if (context.settings.segmentParallel) {
      const parallelCandidate = collectSegmentParallelCandidate(
        source,
        context.previousPoint,
        previousSegmentHeading,
        context.threshold,
      );
      if (parallelCandidate !== null) {
        candidates.push(parallelCandidate);
      }
    }

    if (context.settings.segmentPerpendicular) {
      const perpendicularCandidate = collectSegmentPerpendicularCandidate(
        source,
        context.previousPoint,
        previousSegmentHeading,
        context.threshold,
      );
      if (perpendicularCandidate !== null) {
        candidates.push(perpendicularCandidate);
      }
    }
  }

  const bestCandidate = pickBestPointCandidate(candidates);
  if (bestCandidate === null) {
    return {
      point: source,
      guide: EMPTY_SNAP_GUIDE,
    };
  }

  return {
    point: bestCandidate.point,
    guide: bestCandidate.guide,
  };
};
