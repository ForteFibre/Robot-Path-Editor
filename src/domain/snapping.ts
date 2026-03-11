import {
  EMPTY_SNAP_GUIDE,
  headingDegFromPoints,
  normalizeAngleDeg,
  pointFromHeading,
  shortestAngleDeltaDeg,
  toRadians,
  type Point,
  type SnapGuide,
} from './geometry';
import { WORLD_GUIDE_EXTENT } from './metricScale';

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

export type SnapSettingSection = 'point' | 'heading' | 'panel';

export type SnapSettingDefinition = {
  key: SnapToggleKey;
  label: string;
  section: SnapSettingSection;
  description: string;
};

export const SNAP_SETTING_DEFINITIONS: SnapSettingDefinition[] = [
  {
    key: 'alignX',
    label: 'Align X',
    section: 'point',
    description: 'X座標を他のポイントに揃える',
  },
  {
    key: 'alignY',
    label: 'Align Y',
    section: 'point',
    description: 'Y座標を他のポイントに揃える',
  },
  {
    key: 'previousHeadingLine',
    label: 'Prev Heading Line',
    section: 'point',
    description: '前のポイントの角度の延長線にスナップ',
  },
  {
    key: 'segmentParallel',
    label: 'Parallel to Segment',
    section: 'point',
    description: '前のセグメントと平行に移動',
  },
  {
    key: 'segmentPerpendicular',
    label: 'Perpendicular to Segment',
    section: 'point',
    description: '前のセグメントと垂直に移動',
  },
  {
    key: 'previousWaypointHeading',
    label: 'Prev Waypoint Heading',
    section: 'heading',
    description: '前のポイントの角度を維持',
  },
  {
    key: 'cardinalAngles',
    label: '45° Angles',
    section: 'heading',
    description: '45度単位の角度にスナップ',
  },
  {
    key: 'segmentHeading',
    label: 'Segment Heading',
    section: 'heading',
    description: '前のセグメントの方向にスナップ',
  },
];

type PointSnapContext = {
  candidates: Point[];
  previousPoint: Point | null;
  previousHeadingDeg: number | null;
  previousSegmentStart: Point | null;
  settings: SnapSettings;
  threshold: number;
};

type AngleSnapContext = {
  origin: Point;
  target: Point;
  previousHeadingDeg: number | null;
  previousPoint: Point | null;
  previousSegmentStart: Point | null;
  settings: SnapSettings;
  thresholdDeg: number;
  force: boolean;
};

type PointCandidate = {
  point: Point;
  guide: SnapGuide;
  score: number;
};

type AngleCandidate = {
  angle: number;
  guide: SnapGuide;
  score: number;
};

const buildLineGuide = (
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

const projectOntoLine = (
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

const resolveClosestAxisValue = (
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

const getPreviousSegmentHeading = (
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

export const resolvePointSnap = (
  source: Point,
  context: PointSnapContext,
): { point: Point; guide: SnapGuide } => {
  const candidates: PointCandidate[] = [];
  const { settings, threshold } = context;

  if (settings.alignX || settings.alignY) {
    const bestX = settings.alignX
      ? resolveClosestAxisValue(source.x, context.candidates, 'x', threshold)
      : null;
    const bestY = settings.alignY
      ? resolveClosestAxisValue(source.y, context.candidates, 'y', threshold)
      : null;

    if (bestX !== null || bestY !== null) {
      const deltaX = bestX === null ? 0 : Math.abs(bestX - source.x);
      const deltaY = bestY === null ? 0 : Math.abs(bestY - source.y);
      const label =
        bestX !== null && bestY !== null
          ? 'align x/y'
          : bestX !== null
            ? 'align x'
            : 'align y';
      candidates.push({
        point: {
          x: bestX ?? source.x,
          y: bestY ?? source.y,
        },
        score: deltaX + deltaY,
        guide: {
          ...EMPTY_SNAP_GUIDE,
          x: bestX,
          y: bestY,
          label,
        },
      });
    }
  }

  if (
    settings.previousHeadingLine &&
    context.previousPoint !== null &&
    context.previousHeadingDeg !== null
  ) {
    const projected = projectOntoLine(
      source,
      context.previousPoint,
      context.previousHeadingDeg,
    );
    if (projected.distance <= threshold) {
      candidates.push({
        point: projected.point,
        score: projected.distance + 0.15,
        guide: buildLineGuide(
          context.previousPoint,
          context.previousHeadingDeg,
          'prev heading line',
        ),
      });
    }
  }

  const previousSegmentHeading = getPreviousSegmentHeading(
    context.previousSegmentStart,
    context.previousPoint,
  );

  if (previousSegmentHeading !== null && context.previousPoint !== null) {
    if (settings.segmentParallel) {
      const projected = projectOntoLine(
        source,
        context.previousPoint,
        previousSegmentHeading,
      );
      if (projected.distance <= threshold) {
        candidates.push({
          point: projected.point,
          score: projected.distance + 0.25,
          guide: buildLineGuide(
            context.previousPoint,
            previousSegmentHeading,
            'parallel segment',
          ),
        });
      }
    }

    if (settings.segmentPerpendicular) {
      const perpendicularHeading = normalizeAngleDeg(
        previousSegmentHeading + 90,
      );
      const projected = projectOntoLine(
        source,
        context.previousPoint,
        perpendicularHeading,
      );
      if (projected.distance <= threshold) {
        candidates.push({
          point: projected.point,
          score: projected.distance + 0.35,
          guide: buildLineGuide(
            context.previousPoint,
            perpendicularHeading,
            'perpendicular segment',
          ),
        });
      }
    }
  }

  if (candidates.length === 0) {
    return {
      point: source,
      guide: EMPTY_SNAP_GUIDE,
    };
  }

  const bestCandidate = candidates.reduce((best, candidate) => {
    return candidate.score < best.score ? candidate : best;
  });

  return {
    point: bestCandidate.point,
    guide: bestCandidate.guide,
  };
};

export const resolveAngleSnap = (
  context: AngleSnapContext,
): { angle: number; guide: SnapGuide } => {
  const rawAngle = headingDegFromPoints(context.origin, context.target);
  const candidates: AngleCandidate[] = [];

  if (
    context.settings.previousWaypointHeading &&
    context.previousHeadingDeg !== null
  ) {
    const delta = Math.abs(
      shortestAngleDeltaDeg(rawAngle, context.previousHeadingDeg),
    );
    if (context.force || delta <= context.thresholdDeg) {
      candidates.push({
        angle: context.previousHeadingDeg,
        score: delta + 0.05,
        guide: buildLineGuide(
          context.origin,
          context.previousHeadingDeg,
          'prev waypoint heading',
        ),
      });
    }
  }

  if (context.settings.cardinalAngles) {
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
  }

  if (context.settings.segmentHeading) {
    const segmentHeading = getPreviousSegmentHeading(
      context.previousSegmentStart,
      context.previousPoint,
    );
    if (segmentHeading !== null) {
      const delta = Math.abs(shortestAngleDeltaDeg(rawAngle, segmentHeading));
      if (context.force || delta <= context.thresholdDeg) {
        candidates.push({
          angle: segmentHeading,
          score: delta + 0.2,
          guide: buildLineGuide(
            context.origin,
            segmentHeading,
            'segment heading',
          ),
        });
      }
    }
  }

  if (candidates.length === 0) {
    return {
      angle: rawAngle,
      guide: EMPTY_SNAP_GUIDE,
    };
  }

  const bestCandidate = candidates.reduce((best, candidate) => {
    return candidate.score < best.score ? candidate : best;
  });

  return {
    angle: normalizeAngleDeg(bestCandidate.angle),
    guide: bestCandidate.guide,
  };
};
