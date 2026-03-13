import {
  EMPTY_SNAP_GUIDE,
  headingDegFromPoints,
  normalizeAngleDeg,
  shortestAngleDeltaDeg,
  type SnapGuide,
} from '../geometry';
import {
  buildLineGuide,
  getPreviousSegmentHeading,
  pickBestCandidate,
} from './shared';
import type { AngleCandidate, AngleSnapContext } from './types';

const collectPreviousWaypointHeadingCandidate = (
  rawAngle: number,
  context: AngleSnapContext,
): AngleCandidate | null => {
  if (
    !context.settings.previousWaypointHeading ||
    context.previousHeadingDeg === null
  ) {
    return null;
  }

  const delta = Math.abs(
    shortestAngleDeltaDeg(rawAngle, context.previousHeadingDeg),
  );
  if (!context.force && delta > context.thresholdDeg) {
    return null;
  }

  return {
    angle: context.previousHeadingDeg,
    score: delta + 0.05,
    guide: buildLineGuide(
      context.origin,
      context.previousHeadingDeg,
      'prev waypoint heading',
    ),
  };
};

const collectCardinalAngleCandidates = (
  rawAngle: number,
  context: AngleSnapContext,
): AngleCandidate[] => {
  if (!context.settings.cardinalAngles) {
    return [];
  }

  const candidates: AngleCandidate[] = [];
  for (let angle = 0; angle < 360; angle += 45) {
    const delta = Math.abs(shortestAngleDeltaDeg(rawAngle, angle));
    if (!context.force && delta > context.thresholdDeg) {
      continue;
    }

    candidates.push({
      angle,
      score: delta + 0.15,
      guide: buildLineGuide(context.origin, angle, `${angle} deg`),
    });
  }

  return candidates;
};

const collectSegmentHeadingCandidate = (
  rawAngle: number,
  context: AngleSnapContext,
): AngleCandidate | null => {
  if (!context.settings.segmentHeading) {
    return null;
  }

  const segmentHeading = getPreviousSegmentHeading(
    context.previousSegmentStart,
    context.previousPoint,
  );
  if (segmentHeading === null) {
    return null;
  }

  const delta = Math.abs(shortestAngleDeltaDeg(rawAngle, segmentHeading));
  if (!context.force && delta > context.thresholdDeg) {
    return null;
  }

  return {
    angle: segmentHeading,
    score: delta + 0.2,
    guide: buildLineGuide(context.origin, segmentHeading, 'segment heading'),
  };
};

const pickBestAngleCandidate = (
  candidates: readonly AngleCandidate[],
): AngleCandidate | null => pickBestCandidate(candidates);

export const resolveAngleSnap = (
  context: AngleSnapContext,
): { angle: number; guide: SnapGuide } => {
  const rawAngle = headingDegFromPoints(context.origin, context.target);
  const candidates: AngleCandidate[] = [];

  const previousWaypointCandidate = collectPreviousWaypointHeadingCandidate(
    rawAngle,
    context,
  );
  if (previousWaypointCandidate !== null) {
    candidates.push(previousWaypointCandidate);
  }

  candidates.push(...collectCardinalAngleCandidates(rawAngle, context));

  const segmentHeadingCandidate = collectSegmentHeadingCandidate(
    rawAngle,
    context,
  );
  if (segmentHeadingCandidate !== null) {
    candidates.push(segmentHeadingCandidate);
  }

  const bestCandidate = pickBestAngleCandidate(candidates);
  if (bestCandidate === null) {
    return {
      angle: rawAngle,
      guide: EMPTY_SNAP_GUIDE,
    };
  }

  return {
    angle: normalizeAngleDeg(bestCandidate.angle),
    guide: bestCandidate.guide,
  };
};
