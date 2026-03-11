import { sampleResolvedDubinsPath } from './dubins';
import { MIN_RENDER_STEP } from './canvas';
import {
  createPointIndex,
  resolvePathModel,
  type ResolvedWaypoint,
} from './pointResolution';
import {
  distance,
  interpolateAngleDeg,
  type Point as GeometryPoint,
} from './geometry';
import type { PathModel, Point } from './models';
import { isStraightSection } from './sectionDubins';
import { resolveSectionDubins } from './sectionRadius';

export type HeadingSample = {
  x: number;
  y: number;
  pathHeading: number;
  robotHeading: number;
  rMinOfSection: number;
  curvatureRadius: number | null;
};

export type SectionSampleRange = {
  sectionIndex: number;
  startSampleIndex: number;
  endSampleIndex: number;
};

export type DiscretizedPath = {
  samples: HeadingSample[];
  sectionSampleRanges: SectionSampleRange[];
};

export type ResolvedSectionPositionSample = HeadingSample & {
  cumulativeDistance: number;
  sectionDistance: number;
  sectionLength: number;
};

export type ProjectedSectionSample = {
  sectionIndex: number;
  sectionRatio: number;
  distanceToPoint: number;
  point: ResolvedSectionPositionSample;
};

type SectionProjectionContext = {
  sectionIndex: number;
  startDistance: number;
  sectionLength: number;
};

const clampSectionRatio = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
};

const getSectionRange = (
  detail: DiscretizedPath,
  sectionIndex: number,
): { startSampleIndex: number; endSampleIndex: number } | null => {
  const range = detail.sectionSampleRanges[sectionIndex];
  if (range === undefined) {
    return null;
  }

  return {
    startSampleIndex:
      sectionIndex === 0
        ? range.startSampleIndex
        : Math.max(0, range.startSampleIndex - 1),
    endSampleIndex: range.endSampleIndex,
  };
};

const interpolateHeadingSample = (
  start: HeadingSample,
  end: HeadingSample,
  t: number,
): HeadingSample => {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    pathHeading: interpolateAngleDeg(start.pathHeading, end.pathHeading, t),
    robotHeading: interpolateAngleDeg(start.robotHeading, end.robotHeading, t),
    rMinOfSection: start.rMinOfSection,
    curvatureRadius:
      start.curvatureRadius === end.curvatureRadius
        ? start.curvatureRadius
        : (start.curvatureRadius ?? end.curvatureRadius),
  };
};

export const getSectionSamples = (
  detail: DiscretizedPath,
  sectionIndex: number,
): HeadingSample[] => {
  const range = getSectionRange(detail, sectionIndex);
  if (range === null) {
    return [];
  }

  return detail.samples.slice(range.startSampleIndex, range.endSampleIndex + 1);
};

export const resolveSectionPositionSample = (
  detail: DiscretizedPath,
  sectionIndex: number,
  sectionRatio: number,
  cumulativeDistances = buildCumulativeDistances(detail.samples),
): ResolvedSectionPositionSample | null => {
  const range = getSectionRange(detail, sectionIndex);
  if (range === null) {
    return null;
  }

  const startSample = detail.samples[range.startSampleIndex];
  const endSample = detail.samples[range.endSampleIndex];
  if (startSample === undefined || endSample === undefined) {
    return null;
  }

  const startDistance = cumulativeDistances[range.startSampleIndex] ?? 0;
  const endDistance =
    cumulativeDistances[range.endSampleIndex] ?? startDistance;
  const sectionLength = Math.max(0, endDistance - startDistance);
  const targetDistance =
    startDistance + sectionLength * clampSectionRatio(sectionRatio);

  if (range.startSampleIndex === range.endSampleIndex || sectionLength === 0) {
    return {
      ...startSample,
      cumulativeDistance: startDistance,
      sectionDistance: 0,
      sectionLength,
    };
  }

  for (
    let sampleIndex = range.startSampleIndex + 1;
    sampleIndex <= range.endSampleIndex;
    sampleIndex += 1
  ) {
    const previousSample = detail.samples[sampleIndex - 1];
    const currentSample = detail.samples[sampleIndex];
    if (previousSample === undefined || currentSample === undefined) {
      continue;
    }

    const previousDistance =
      cumulativeDistances[sampleIndex - 1] ?? startDistance;
    const currentDistance =
      cumulativeDistances[sampleIndex] ?? previousDistance;
    if (
      targetDistance > currentDistance &&
      sampleIndex < range.endSampleIndex
    ) {
      continue;
    }

    const segmentLength = currentDistance - previousDistance;
    const t =
      segmentLength > 0
        ? (targetDistance - previousDistance) / segmentLength
        : 0;
    const interpolated = interpolateHeadingSample(
      previousSample,
      currentSample,
      t,
    );

    return {
      ...interpolated,
      cumulativeDistance: targetDistance,
      sectionDistance: targetDistance - startDistance,
      sectionLength,
    };
  }

  return {
    ...endSample,
    cumulativeDistance: endDistance,
    sectionDistance: sectionLength,
    sectionLength,
  };
};

export const getSectionPolylineBetweenRatios = (
  detail: DiscretizedPath,
  sectionIndex: number,
  startRatio: number,
  endRatio: number,
  cumulativeDistances = buildCumulativeDistances(detail.samples),
): HeadingSample[] => {
  const start = resolveSectionPositionSample(
    detail,
    sectionIndex,
    startRatio,
    cumulativeDistances,
  );
  const end = resolveSectionPositionSample(
    detail,
    sectionIndex,
    endRatio,
    cumulativeDistances,
  );
  const range = getSectionRange(detail, sectionIndex);

  if (start === null || end === null || range === null) {
    return [];
  }

  const fromDistance = Math.min(
    start.cumulativeDistance,
    end.cumulativeDistance,
  );
  const toDistance = Math.max(start.cumulativeDistance, end.cumulativeDistance);
  const points: HeadingSample[] = [start];

  for (
    let sampleIndex = range.startSampleIndex + 1;
    sampleIndex < range.endSampleIndex;
    sampleIndex += 1
  ) {
    const sample = detail.samples[sampleIndex];
    const sampleDistance = cumulativeDistances[sampleIndex];
    if (
      sample === undefined ||
      sampleDistance === undefined ||
      sampleDistance <= fromDistance ||
      sampleDistance >= toDistance
    ) {
      continue;
    }

    points.push(sample);
  }

  if (
    Math.abs(end.x - start.x) > Number.EPSILON ||
    Math.abs(end.y - start.y) > Number.EPSILON
  ) {
    points.push(end);
  }

  return start.cumulativeDistance <= end.cumulativeDistance
    ? points
    : [...points].reverse();
};

export const projectPointToSectionSamples = (
  detail: DiscretizedPath,
  point: GeometryPoint,
  cumulativeDistances = buildCumulativeDistances(detail.samples),
): ProjectedSectionSample | null => {
  let best: ProjectedSectionSample | null = null;

  for (const range of detail.sectionSampleRanges) {
    const sectionRange = getSectionRange(detail, range.sectionIndex);
    if (sectionRange === null) {
      continue;
    }

    const startDistance =
      cumulativeDistances[sectionRange.startSampleIndex] ?? 0;
    const endDistance =
      cumulativeDistances[sectionRange.endSampleIndex] ?? startDistance;
    const sectionLength = Math.max(0, endDistance - startDistance);

    const context: SectionProjectionContext = {
      sectionIndex: range.sectionIndex,
      startDistance,
      sectionLength,
    };

    for (
      let sampleIndex = sectionRange.startSampleIndex + 1;
      sampleIndex <= sectionRange.endSampleIndex;
      sampleIndex += 1
    ) {
      const candidate = projectPointToSectionSegment(
        detail.samples[sampleIndex - 1],
        detail.samples[sampleIndex],
        point,
        cumulativeDistances[sampleIndex - 1] ?? startDistance,
        cumulativeDistances[sampleIndex],
        context,
      );

      if (
        candidate === null ||
        (best !== null && candidate.distanceToPoint >= best.distanceToPoint)
      ) {
        continue;
      }

      best = candidate;
    }
  }

  return best;
};

const projectPointToSectionSegment = (
  previousSample: HeadingSample | undefined,
  currentSample: HeadingSample | undefined,
  point: GeometryPoint,
  previousDistance: number,
  currentDistance: number | undefined,
  context: SectionProjectionContext,
): ProjectedSectionSample | null => {
  if (previousSample === undefined || currentSample === undefined) {
    return null;
  }

  const dx = currentSample.x - previousSample.x;
  const dy = currentSample.y - previousSample.y;
  const lengthSq = dx * dx + dy * dy;
  const rawT =
    lengthSq === 0
      ? 0
      : ((point.x - previousSample.x) * dx +
          (point.y - previousSample.y) * dy) /
        lengthSq;
  const t = Math.min(Math.max(rawT, 0), 1);
  const projectedSample = interpolateHeadingSample(
    previousSample,
    currentSample,
    t,
  );
  const distanceToPoint = distance(point, projectedSample);
  const resolvedCurrentDistance = currentDistance ?? previousDistance;
  const cumulativeDistance =
    previousDistance + (resolvedCurrentDistance - previousDistance) * t;
  const sectionDistance = cumulativeDistance - context.startDistance;
  const sectionRatio =
    context.sectionLength > 0 ? sectionDistance / context.sectionLength : 0;

  return {
    sectionIndex: context.sectionIndex,
    sectionRatio,
    distanceToPoint,
    point: {
      ...projectedSample,
      cumulativeDistance,
      sectionDistance,
      sectionLength: context.sectionLength,
    },
  };
};

const sampleLinearSection = (
  start: ResolvedWaypoint,
  end: ResolvedWaypoint,
  step: number,
  sectionRMin: number,
  includeFirstSample: boolean,
): HeadingSample[] => {
  const segmentLength = distance(start, end);
  const count = Math.max(1, Math.ceil(segmentLength / step));
  const points: HeadingSample[] = [];

  for (let stepIndex = 0; stepIndex <= count; stepIndex += 1) {
    if (!includeFirstSample && stepIndex === 0) {
      continue;
    }

    const t = stepIndex / count;
    points.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      pathHeading: interpolateAngleDeg(start.pathHeading, end.pathHeading, t),
      robotHeading: 0,
      rMinOfSection: sectionRMin,
      curvatureRadius: null,
    });
  }

  return points;
};

const sampleResolvedSection = (
  start: ResolvedWaypoint,
  end: ResolvedWaypoint,
  step: number,
  manualSectionRMin: number | null,
  includeFirstSample: boolean,
): HeadingSample[] => {
  const startEndpoint = {
    x: start.x,
    y: start.y,
    headingDeg: start.pathHeading,
  };
  const endEndpoint = {
    x: end.x,
    y: end.y,
    headingDeg: end.pathHeading,
  };
  if (isStraightSection(startEndpoint, endEndpoint)) {
    return sampleLinearSection(
      start,
      end,
      step,
      distance(start, end),
      includeFirstSample,
    );
  }

  const resolved = resolveSectionDubins(start, end, manualSectionRMin);
  if (resolved === null) {
    return [];
  }

  const dubins = sampleResolvedDubinsPath(
    startEndpoint,
    endEndpoint,
    resolved.turningRadius,
    resolved.path,
    step,
  );

  const points: HeadingSample[] = [];

  for (
    let sampleIndex = 0;
    sampleIndex < dubins.samples.length;
    sampleIndex += 1
  ) {
    if (!includeFirstSample && sampleIndex === 0) {
      continue;
    }

    const sample = dubins.samples[sampleIndex];
    if (sample === undefined) {
      continue;
    }

    points.push({
      x: sample.x,
      y: sample.y,
      pathHeading: sample.headingDeg,
      robotHeading: 0,
      rMinOfSection: resolved.turningRadius,
      curvatureRadius:
        sample.segmentType === 'S' ? null : resolved.turningRadius,
    });
  }

  return points;
};

export const discretizeGeometryPath = (
  path: PathModel,
  points: Point[],
  step: number,
): DiscretizedPath => {
  const pointsById = createPointIndex(points);
  const resolvedPath = resolvePathModel(path, pointsById);

  if (resolvedPath.waypoints.length === 0) {
    return { samples: [], sectionSampleRanges: [] };
  }

  if (resolvedPath.waypoints.length === 1) {
    const point = resolvedPath.waypoints[0];
    if (point === undefined) {
      return { samples: [], sectionSampleRanges: [] };
    }

    return {
      samples: [
        {
          x: point.x,
          y: point.y,
          pathHeading: point.pathHeading,
          robotHeading: point.pathHeading,
          rMinOfSection: 1,
          curvatureRadius: null,
        },
      ],
      sectionSampleRanges: [],
    };
  }

  const samples: HeadingSample[] = [];
  const sectionSampleRanges: SectionSampleRange[] = [];
  const sampleStep = Math.max(MIN_RENDER_STEP, step);

  for (let index = 0; index < resolvedPath.waypoints.length - 1; index += 1) {
    const start = resolvedPath.waypoints[index];
    const end = resolvedPath.waypoints[index + 1];

    if (start === undefined || end === undefined) {
      continue;
    }

    const manualSectionRMin = resolvedPath.sectionRMin[index] ?? null;
    const includeFirstSample = index === 0;
    const startSampleIndex = samples.length;
    const sectionSamples = sampleResolvedSection(
      start,
      end,
      sampleStep,
      manualSectionRMin,
      includeFirstSample,
    );
    samples.push(...sectionSamples);
    sectionSampleRanges.push({
      sectionIndex: index,
      startSampleIndex,
      endSampleIndex: Math.max(startSampleIndex, samples.length - 1),
    });
  }

  return {
    samples,
    sectionSampleRanges,
  };
};

export const buildCumulativeDistances = (
  samples: HeadingSample[],
): number[] => {
  const cumulativeDistances = Array.from<number>({
    length: samples.length,
  }).fill(0);

  for (let index = 1; index < samples.length; index += 1) {
    const prev = samples[index - 1];
    const curr = samples[index];
    if (prev !== undefined && curr !== undefined) {
      cumulativeDistances[index] =
        (cumulativeDistances[index - 1] ?? 0) + distance(prev, curr);
    }
  }

  return cumulativeDistances;
};

export const toGeometryPolyline = (
  samples: HeadingSample[],
): GeometryPoint[] => {
  return samples.map((sample) => ({ x: sample.x, y: sample.y }));
};
