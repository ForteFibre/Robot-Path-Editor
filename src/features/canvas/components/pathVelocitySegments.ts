import type { Point } from '../../../domain/geometry';
import {
  getSegmentTimeAtDistance,
  getSegmentVelocityAtTime,
} from '../../../domain/pathTimingMotion';
import type { TimedPathSegment } from '../../../domain/pathTiming';
import { canvasTheme } from '../canvasTheme';

const EPSILON = 1e-9;
const DEFAULT_MAX_WORLD_STEP_LENGTH = 0.1;

export type VelocityRenderSegment =
  | {
      kind: 'line';
      start: Point;
      end: Point;
      color: string;
    }
  | {
      kind: 'arc';
      center: Point;
      radius: number;
      startAngleRad: number;
      sweepRad: number;
      color: string;
    };

const DEFAULT_VELOCITY_COLOR_BIN_COUNT = 24;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const lerp = (start: number, end: number, ratio: number): number => {
  return start + (end - start) * ratio;
};

const clampRatio = (ratio: number): number => {
  if (!Number.isFinite(ratio)) {
    return 0;
  }

  return Math.min(Math.max(ratio, 0), 1);
};

const clampChannel = (value: number): number => {
  return Math.min(255, Math.max(0, Math.round(value)));
};

const formatHexColor = ({ r, g, b }: RgbColor): string => {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
};

const parseHexColor = (color: string): RgbColor | null => {
  const normalizedColor = color.trim();

  if (!normalizedColor.startsWith('#')) {
    return null;
  }

  const hexBody = normalizedColor.slice(1);
  const expandedHex =
    hexBody.length === 3
      ? hexBody
          .split('')
          .map((digit) => `${digit}${digit}`)
          .join('')
      : hexBody;

  if (!/^[0-9a-f]{6}$/iu.test(expandedHex)) {
    return null;
  }

  return {
    r: Number.parseInt(expandedHex.slice(0, 2), 16),
    g: Number.parseInt(expandedHex.slice(2, 4), 16),
    b: Number.parseInt(expandedHex.slice(4, 6), 16),
  };
};

const parseRgbChannel = (channel: string): number | null => {
  const trimmedChannel = channel.trim();

  if (trimmedChannel.length === 0) {
    return null;
  }

  if (trimmedChannel.endsWith('%')) {
    const percentage = Number.parseFloat(trimmedChannel.slice(0, -1));
    if (!Number.isFinite(percentage)) {
      return null;
    }

    return clampChannel((percentage / 100) * 255);
  }

  const numeric = Number.parseFloat(trimmedChannel);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return clampChannel(numeric);
};

const parseRgbColor = (color: string): RgbColor | null => {
  const rgbColorPattern = /^rgba?\((.+)\)$/iu;
  const match = rgbColorPattern.exec(color.trim());
  if (match === null) {
    return null;
  }

  const rawChannelSource = match[1];
  if (rawChannelSource === undefined) {
    return null;
  }

  const rawChannels = rawChannelSource.replace(/\s*\/\s*[^\s,)]+/u, '').trim();
  const channels = rawChannels.includes(',')
    ? rawChannels.split(',')
    : rawChannels.split(/\s+/u);

  if (channels.length < 3) {
    return null;
  }

  const parsedChannels = channels
    .slice(0, 3)
    .map((channel) => parseRgbChannel(channel));

  if (parsedChannels.includes(null)) {
    return null;
  }

  return {
    r: parsedChannels[0] ?? 0,
    g: parsedChannels[1] ?? 0,
    b: parsedChannels[2] ?? 0,
  };
};

const parseThemeColorToRgb = (color: string): RgbColor => {
  const parsedColor = parseHexColor(color) ?? parseRgbColor(color);
  if (parsedColor !== null) {
    return parsedColor;
  }

  throw new TypeError(
    `Canvas velocity theme color must be hex/rgb format, received: ${color}`,
  );
};

type VelocityColorScale = {
  low: RgbColor;
  high: RgbColor;
};

let cachedVelocityColorScale: VelocityColorScale | null = null;

const getVelocityColorScale = (): VelocityColorScale => {
  if (cachedVelocityColorScale !== null) {
    return cachedVelocityColorScale;
  }

  cachedVelocityColorScale = {
    low: parseThemeColorToRgb(canvasTheme.velocity.low),
    high: parseThemeColorToRgb(canvasTheme.velocity.high),
  };

  return cachedVelocityColorScale;
};

const interpolateChannel = (
  start: number,
  end: number,
  ratio: number,
): number => {
  return clampChannel(start + (end - start) * ratio);
};

export function getVelocityColor(ratio: number): string {
  const normalizedRatio = clampRatio(ratio);
  const velocityColorScale = getVelocityColorScale();

  return formatHexColor({
    r: interpolateChannel(
      velocityColorScale.low.r,
      velocityColorScale.high.r,
      normalizedRatio,
    ),
    g: interpolateChannel(
      velocityColorScale.low.g,
      velocityColorScale.high.g,
      normalizedRatio,
    ),
    b: interpolateChannel(
      velocityColorScale.low.b,
      velocityColorScale.high.b,
      normalizedRatio,
    ),
  });
}

const quantizeVelocityRatio = (ratio: number, numBins: number): number => {
  const normalizedRatio = clampRatio(ratio);
  const safeNumBins =
    Number.isFinite(numBins) && numBins >= 1 ? Math.floor(numBins) : 1;

  return Math.floor(normalizedRatio * safeNumBins) / safeNumBins;
};

export function buildVelocityPolylines(
  segments: TimedPathSegment[],
  maxVelocity: number,
  numBins = DEFAULT_VELOCITY_COLOR_BIN_COUNT,
  maxWorldStepLength = DEFAULT_MAX_WORLD_STEP_LENGTH,
): VelocityRenderSegment[] {
  if (segments.length === 0) {
    return [];
  }

  const rawSegments = segments.flatMap((segment) =>
    buildRawVelocityRenderSegments(segment, maxWorldStepLength),
  );
  const safeMaxVelocity = Math.max(0, maxVelocity);

  return rawSegments.reduce<VelocityRenderSegment[]>(
    (resolvedSegments, segment) => {
      const color = getVelocityColor(
        quantizeVelocityRatio(
          safeMaxVelocity > 0
            ? segment.representativeVelocity / safeMaxVelocity
            : 0,
          numBins,
        ),
      );

      const nextSegment =
        segment.kind === 'line'
          ? ({
              kind: 'line',
              start: segment.start,
              end: segment.end,
              color,
            } satisfies VelocityRenderSegment)
          : ({
              kind: 'arc',
              center: segment.center,
              radius: segment.radius,
              startAngleRad: segment.startAngleRad,
              sweepRad: segment.sweepRad,
              color,
            } satisfies VelocityRenderSegment);

      const previousSegment = resolvedSegments.at(-1);

      if (
        previousSegment?.color === color &&
        canMergeVelocityRenderSegments(previousSegment, nextSegment)
      ) {
        resolvedSegments[resolvedSegments.length - 1] =
          mergeVelocityRenderSegments(previousSegment, nextSegment);

        return resolvedSegments;
      }

      resolvedSegments.push(nextSegment);
      return resolvedSegments;
    },
    [],
  );
}

const areNumbersClose = (left: number, right: number): boolean => {
  return Math.abs(left - right) <= EPSILON;
};

const arePointsClose = (left: Point, right: Point): boolean => {
  return areNumbersClose(left.x, right.x) && areNumbersClose(left.y, right.y);
};

const canMergeLineVelocityRenderSegments = (
  previous: Extract<VelocityRenderSegment, { kind: 'line' }>,
  next: Extract<VelocityRenderSegment, { kind: 'line' }>,
): boolean => {
  if (!arePointsClose(previous.end, next.start)) {
    return false;
  }

  const previousDx = previous.end.x - previous.start.x;
  const previousDy = previous.end.y - previous.start.y;
  const nextDx = next.end.x - next.start.x;
  const nextDy = next.end.y - next.start.y;
  const cross = previousDx * nextDy - previousDy * nextDx;
  const dot = previousDx * nextDx + previousDy * nextDy;

  return Math.abs(cross) <= EPSILON && dot >= -EPSILON;
};

const canMergeArcVelocityRenderSegments = (
  previous: Extract<VelocityRenderSegment, { kind: 'arc' }>,
  next: Extract<VelocityRenderSegment, { kind: 'arc' }>,
): boolean => {
  const previousEndAngle = previous.startAngleRad + previous.sweepRad;
  const sameDirection =
    (previous.sweepRad >= -EPSILON && next.sweepRad >= -EPSILON) ||
    (previous.sweepRad <= EPSILON && next.sweepRad <= EPSILON);

  return (
    arePointsClose(previous.center, next.center) &&
    areNumbersClose(previous.radius, next.radius) &&
    areNumbersClose(previousEndAngle, next.startAngleRad) &&
    sameDirection
  );
};

const canMergeVelocityRenderSegments = (
  previous: VelocityRenderSegment,
  next: VelocityRenderSegment,
): boolean => {
  if (previous.kind === 'line' && next.kind === 'line') {
    return canMergeLineVelocityRenderSegments(previous, next);
  }

  if (previous.kind === 'arc' && next.kind === 'arc') {
    return canMergeArcVelocityRenderSegments(previous, next);
  }

  return false;
};

const mergeVelocityRenderSegments = (
  previous: VelocityRenderSegment,
  next: VelocityRenderSegment,
): VelocityRenderSegment => {
  if (previous.kind === 'line' && next.kind === 'line') {
    return {
      kind: 'line',
      start: previous.start,
      end: next.end,
      color: previous.color,
    };
  }

  if (previous.kind === 'arc' && next.kind === 'arc') {
    return {
      kind: 'arc',
      center: previous.center,
      radius: previous.radius,
      startAngleRad: previous.startAngleRad,
      sweepRad: previous.sweepRad + next.sweepRad,
      color: previous.color,
    };
  }

  return next;
};

type RawVelocityRenderSegment =
  | {
      kind: 'line';
      start: Point;
      end: Point;
      representativeVelocity: number;
    }
  | {
      kind: 'arc';
      center: Point;
      radius: number;
      startAngleRad: number;
      sweepRad: number;
      representativeVelocity: number;
    };

const pushUniqueDistance = (distances: number[], value: number): void => {
  if (distances.some((distance) => Math.abs(distance - value) <= EPSILON)) {
    return;
  }

  distances.push(value);
};

const collectVelocityBreakpoints = (segment: TimedPathSegment): number[] => {
  const distances = [0, segment.geometry.length];
  const profile = segment.motionProfile;

  pushUniqueDistance(distances, profile.accelerationDistance);
  pushUniqueDistance(
    distances,
    profile.accelerationDistance + profile.cruiseDistance,
  );

  return distances
    .filter(
      (distance) =>
        distance >= -EPSILON && distance <= segment.geometry.length + EPSILON,
    )
    .map((distance) => Math.min(Math.max(distance, 0), segment.geometry.length))
    .sort((left, right) => left - right);
};

const getVelocityAtLocalDistance = (
  segment: TimedPathSegment,
  localDistance: number,
): number => {
  if (localDistance <= EPSILON) {
    return segment.startVelocity;
  }

  if (segment.geometry.length - localDistance <= EPSILON) {
    return segment.endVelocity;
  }

  const localTime = getSegmentTimeAtDistance(
    segment.motionProfile,
    localDistance,
  );
  return getSegmentVelocityAtTime(segment.motionProfile, localTime);
};

const interpolateLinePoint = (
  segment: TimedPathSegment,
  localDistance: number,
): Point => {
  if (segment.geometry.kind !== 'line') {
    throw new Error('expected line geometry for line velocity segment');
  }

  const ratio =
    segment.geometry.length > EPSILON
      ? localDistance / segment.geometry.length
      : 0;

  return {
    x: lerp(segment.geometry.startX, segment.geometry.endX, ratio),
    y: lerp(segment.geometry.startY, segment.geometry.endY, ratio),
  };
};

const buildLineVelocityRenderSegment = (
  segment: TimedPathSegment,
  startLocalDistance: number,
  endLocalDistance: number,
  representativeVelocity: number,
): RawVelocityRenderSegment => ({
  kind: 'line',
  start: interpolateLinePoint(segment, startLocalDistance),
  end: interpolateLinePoint(segment, endLocalDistance),
  representativeVelocity,
});

const buildArcVelocityRenderSegment = (
  segment: TimedPathSegment,
  startLocalDistance: number,
  endLocalDistance: number,
  representativeVelocity: number,
): RawVelocityRenderSegment => {
  if (segment.geometry.kind !== 'arc') {
    throw new Error('expected arc geometry for arc velocity segment');
  }

  const startRatio =
    segment.geometry.length > EPSILON
      ? startLocalDistance / segment.geometry.length
      : 0;
  const endRatio =
    segment.geometry.length > EPSILON
      ? endLocalDistance / segment.geometry.length
      : 0;
  const startAngleRad =
    segment.geometry.startAngleRad + segment.geometry.sweepRad * startRatio;

  return {
    kind: 'arc',
    center: {
      x: segment.geometry.centerX,
      y: segment.geometry.centerY,
    },
    radius: segment.geometry.turningRadius,
    startAngleRad,
    sweepRad: segment.geometry.sweepRad * (endRatio - startRatio),
    representativeVelocity,
  };
};

const buildRawVelocityRenderSegments = (
  segment: TimedPathSegment,
  maxWorldStepLength: number,
): RawVelocityRenderSegment[] => {
  const breakpoints = collectVelocityBreakpoints(segment);
  const rawSegments: RawVelocityRenderSegment[] = [];
  const safeMaxWorldStepLength =
    Number.isFinite(maxWorldStepLength) && maxWorldStepLength > EPSILON
      ? maxWorldStepLength
      : Number.POSITIVE_INFINITY;

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const startLocalDistance = breakpoints[index] ?? 0;
    const endLocalDistance = breakpoints[index + 1] ?? startLocalDistance;
    const subLength = endLocalDistance - startLocalDistance;

    if (subLength <= EPSILON) {
      continue;
    }

    const startVelocity = getVelocityAtLocalDistance(
      segment,
      startLocalDistance,
    );
    const endVelocity = getVelocityAtLocalDistance(segment, endLocalDistance);
    const steps = Math.max(1, Math.ceil(subLength / safeMaxWorldStepLength));

    for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
      const tStart = stepIndex / steps;
      const tEnd = (stepIndex + 1) / steps;
      const stepStartLocalDistance = startLocalDistance + subLength * tStart;
      const stepEndLocalDistance = startLocalDistance + subLength * tEnd;
      const velocityAtStart = lerp(startVelocity, endVelocity, tStart);
      const velocityAtEnd = lerp(startVelocity, endVelocity, tEnd);
      const representativeVelocity = Math.max(
        0,
        (velocityAtStart + velocityAtEnd) / 2,
      );

      rawSegments.push(
        segment.geometry.kind === 'line'
          ? buildLineVelocityRenderSegment(
              segment,
              stepStartLocalDistance,
              stepEndLocalDistance,
              representativeVelocity,
            )
          : buildArcVelocityRenderSegment(
              segment,
              stepStartLocalDistance,
              stepEndLocalDistance,
              representativeVelocity,
            ),
      );
    }
  }

  return rawSegments;
};
