import { normalizeAngleDeg, toRadians, type Point } from './geometry';
import { MIN_RENDER_STEP } from './metricScale';

export type DubinsWord = 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'RLR' | 'LRL';
type SegmentType = 'L' | 'S' | 'R';

type DubinsState = {
  alpha: number;
  beta: number;
  d: number;
};

export type DubinsPath = {
  word: DubinsWord;
  segmentTypes: [SegmentType, SegmentType, SegmentType];
  params: [number, number, number];
  normalizedLength: number;
};

export type DubinsSolveOptions = {
  allowTripleCurve?: boolean;
  candidateWords?: readonly DubinsWord[];
};

export type DubinsPoseSample = {
  x: number;
  y: number;
  headingDeg: number;
  distance: number;
  segmentType: SegmentType;
};

export type DubinsEndpoint = {
  x: number;
  y: number;
  headingDeg: number;
};

const TWO_PI = Math.PI * 2;
const LENGTH_EPSILON = 1e-6;
const SOLVER_EPSILON = 1e-10;

const CSC_WORDS: readonly DubinsWord[] = ['LSL', 'RSR', 'LSR', 'RSL'];
const ALL_WORDS: readonly DubinsWord[] = [...CSC_WORDS, 'RLR', 'LRL'] as const;

const segmentTypesByWord: Record<
  DubinsWord,
  [SegmentType, SegmentType, SegmentType]
> = {
  LSL: ['L', 'S', 'L'],
  RSR: ['R', 'S', 'R'],
  LSR: ['L', 'S', 'R'],
  RSL: ['R', 'S', 'L'],
  RLR: ['R', 'L', 'R'],
  LRL: ['L', 'R', 'L'],
};

const mod2Pi = (value: number): number => {
  const wrapped = value % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const sanitizeSquared = (value: number): number | null => {
  if (value < -SOLVER_EPSILON) {
    return null;
  }

  return Math.max(0, value);
};

const headingToVector = (headingDeg: number): { x: number; y: number } => {
  const headingRad = toRadians(headingDeg);
  return {
    x: Math.cos(headingRad),
    y: Math.sin(headingRad),
  };
};

const buildState = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  turningRadius: number,
): DubinsState | null => {
  if (!Number.isFinite(turningRadius) || turningRadius <= 0) {
    return null;
  }

  const dx = (end.x - start.x) / turningRadius;
  const dy = (end.y - start.y) / turningRadius;
  const d = Math.hypot(dx, dy);
  const theta = Math.atan2(dy, dx);

  return {
    alpha: mod2Pi(toRadians(start.headingDeg) - theta),
    beta: mod2Pi(toRadians(end.headingDeg) - theta),
    d,
  };
};

const buildArcOnlyCandidate = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  turningRadius: number,
  turn: 'L' | 'R',
): DubinsPath | null => {
  const startHeading = headingToVector(start.headingDeg);
  const endHeading = headingToVector(end.headingDeg);

  const startCenter =
    turn === 'L'
      ? {
          x: start.x - startHeading.y * turningRadius,
          y: start.y + startHeading.x * turningRadius,
        }
      : {
          x: start.x + startHeading.y * turningRadius,
          y: start.y - startHeading.x * turningRadius,
        };

  const endCenter =
    turn === 'L'
      ? {
          x: end.x - endHeading.y * turningRadius,
          y: end.y + endHeading.x * turningRadius,
        }
      : {
          x: end.x + endHeading.y * turningRadius,
          y: end.y - endHeading.x * turningRadius,
        };

  const centerDistance = Math.hypot(
    startCenter.x - endCenter.x,
    startCenter.y - endCenter.y,
  );
  if (centerDistance > LENGTH_EPSILON) {
    return null;
  }

  const startAngle = Math.atan2(
    start.y - startCenter.y,
    start.x - startCenter.x,
  );
  const endAngle = Math.atan2(end.y - endCenter.y, end.x - endCenter.x);
  const delta =
    turn === 'L'
      ? mod2Pi(endAngle - startAngle)
      : mod2Pi(startAngle - endAngle);

  if (delta <= LENGTH_EPSILON) {
    return null;
  }

  return {
    word: turn === 'L' ? 'LSL' : 'RSR',
    segmentTypes: turn === 'L' ? ['L', 'S', 'L'] : ['R', 'S', 'R'],
    params: [delta, 0, 0],
    normalizedLength: delta,
  };
};

const calcLSL = (state: DubinsState): [number, number, number] | null => {
  const { alpha, beta, d } = state;
  const tmp = d + Math.sin(alpha) - Math.sin(beta);
  const pSquared = sanitizeSquared(
    2 +
      d * d -
      2 * Math.cos(alpha - beta) +
      2 * d * (Math.sin(alpha) - Math.sin(beta)),
  );

  if (pSquared === null) {
    return null;
  }

  const t = mod2Pi(-alpha + Math.atan2(Math.cos(beta) - Math.cos(alpha), tmp));
  const p = Math.sqrt(pSquared);
  const q = mod2Pi(beta - Math.atan2(Math.cos(beta) - Math.cos(alpha), tmp));
  return [t, p, q];
};

const calcRSR = (state: DubinsState): [number, number, number] | null => {
  const { alpha, beta, d } = state;
  const tmp = d - Math.sin(alpha) + Math.sin(beta);
  const pSquared = sanitizeSquared(
    2 +
      d * d -
      2 * Math.cos(alpha - beta) +
      2 * d * (-Math.sin(alpha) + Math.sin(beta)),
  );

  if (pSquared === null) {
    return null;
  }

  const t = mod2Pi(alpha - Math.atan2(Math.cos(alpha) - Math.cos(beta), tmp));
  const p = Math.sqrt(pSquared);
  const q = mod2Pi(-beta + Math.atan2(Math.cos(alpha) - Math.cos(beta), tmp));
  return [t, p, q];
};

const calcLSR = (state: DubinsState): [number, number, number] | null => {
  const { alpha, beta, d } = state;
  const pSquared = sanitizeSquared(
    -2 +
      d * d +
      2 * Math.cos(alpha - beta) +
      2 * d * (Math.sin(alpha) + Math.sin(beta)),
  );

  if (pSquared === null) {
    return null;
  }

  const p = Math.sqrt(pSquared);
  const tmp =
    Math.atan2(
      -Math.cos(alpha) - Math.cos(beta),
      d + Math.sin(alpha) + Math.sin(beta),
    ) - Math.atan2(-2, p);
  const t = mod2Pi(-alpha + tmp);
  const q = mod2Pi(-beta + tmp);
  return [t, p, q];
};

const calcRSL = (state: DubinsState): [number, number, number] | null => {
  const { alpha, beta, d } = state;
  const pSquared = sanitizeSquared(
    -2 +
      d * d +
      2 * Math.cos(alpha - beta) -
      2 * d * (Math.sin(alpha) + Math.sin(beta)),
  );

  if (pSquared === null) {
    return null;
  }

  const p = Math.sqrt(pSquared);
  const tmp =
    Math.atan2(
      Math.cos(alpha) + Math.cos(beta),
      d - Math.sin(alpha) - Math.sin(beta),
    ) - Math.atan2(2, p);
  const t = mod2Pi(alpha - tmp);
  const q = mod2Pi(beta - tmp);
  return [t, p, q];
};

const calcRLR = (state: DubinsState): [number, number, number] | null => {
  const { alpha, beta, d } = state;
  const tmp =
    (6 -
      d * d +
      2 * Math.cos(alpha - beta) +
      2 * d * (Math.sin(alpha) - Math.sin(beta))) /
    8;

  if (tmp < -1 - SOLVER_EPSILON || tmp > 1 + SOLVER_EPSILON) {
    return null;
  }

  const p = mod2Pi(TWO_PI - Math.acos(clamp(tmp, -1, 1)));
  const t = mod2Pi(
    alpha -
      Math.atan2(
        Math.cos(alpha) - Math.cos(beta),
        d - Math.sin(alpha) + Math.sin(beta),
      ) +
      p / 2,
  );
  const q = mod2Pi(alpha - beta - t + p);
  return [t, p, q];
};

const calcLRL = (state: DubinsState): [number, number, number] | null => {
  const { alpha, beta, d } = state;
  const tmp =
    (6 -
      d * d +
      2 * Math.cos(alpha - beta) +
      2 * d * (-Math.sin(alpha) + Math.sin(beta))) /
    8;

  if (tmp < -1 - SOLVER_EPSILON || tmp > 1 + SOLVER_EPSILON) {
    return null;
  }

  const p = mod2Pi(TWO_PI - Math.acos(clamp(tmp, -1, 1)));
  const t = mod2Pi(
    -alpha -
      Math.atan2(
        Math.cos(alpha) - Math.cos(beta),
        d + Math.sin(alpha) - Math.sin(beta),
      ) +
      p / 2,
  );
  const q = mod2Pi(mod2Pi(beta) - alpha - t + p);
  return [t, p, q];
};

const solvers: Record<
  DubinsWord,
  (state: DubinsState) => [number, number, number] | null
> = {
  LSL: calcLSL,
  RSR: calcRSR,
  LSR: calcLSR,
  RSL: calcRSL,
  RLR: calcRLR,
  LRL: calcLRL,
};

const advancePose = (
  pose: { x: number; y: number; headingRad: number },
  segmentType: SegmentType,
  distance: number,
  turningRadius: number,
): { x: number; y: number; headingRad: number } => {
  if (segmentType === 'S') {
    return {
      x: pose.x + distance * Math.cos(pose.headingRad),
      y: pose.y + distance * Math.sin(pose.headingRad),
      headingRad: pose.headingRad,
    };
  }

  const delta = distance / turningRadius;

  if (segmentType === 'L') {
    const nextHeading = pose.headingRad + delta;
    return {
      x:
        pose.x +
        turningRadius * (Math.sin(nextHeading) - Math.sin(pose.headingRad)),
      y:
        pose.y +
        turningRadius * (Math.cos(pose.headingRad) - Math.cos(nextHeading)),
      headingRad: nextHeading,
    };
  }

  const nextHeading = pose.headingRad - delta;
  return {
    x:
      pose.x +
      turningRadius * (Math.sin(pose.headingRad) - Math.sin(nextHeading)),
    y:
      pose.y +
      turningRadius * (Math.cos(nextHeading) - Math.cos(pose.headingRad)),
    headingRad: nextHeading,
  };
};

const toDubinsPath = (
  word: DubinsWord,
  params: [number, number, number],
): DubinsPath => {
  return {
    word,
    segmentTypes: segmentTypesByWord[word],
    params,
    normalizedLength: params[0] + params[1] + params[2],
  };
};

export const computeDubinsPathForWord = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  turningRadius: number,
  word: DubinsWord,
): DubinsPath | null => {
  const state = buildState(start, end, turningRadius);
  if (state === null) {
    return null;
  }

  const params = solvers[word](state);
  let best = params === null ? null : toDubinsPath(word, params);

  if (word === 'LSL' || word === 'RSR') {
    const arcOnly = buildArcOnlyCandidate(
      start,
      end,
      turningRadius,
      word === 'LSL' ? 'L' : 'R',
    );

    if (
      arcOnly !== null &&
      (best === null || arcOnly.normalizedLength < best.normalizedLength)
    ) {
      best = arcOnly;
    }
  }

  return best;
};

export const computeShortestDubinsPath = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  turningRadius: number,
  options?: DubinsSolveOptions,
): DubinsPath | null => {
  const candidateWords =
    options?.candidateWords ??
    (options?.allowTripleCurve === true ? ALL_WORDS : CSC_WORDS);

  let best: DubinsPath | null = null;

  for (const word of candidateWords) {
    const candidate = computeDubinsPathForWord(start, end, turningRadius, word);
    if (candidate === null) {
      continue;
    }

    if (best === null || candidate.normalizedLength < best.normalizedLength) {
      best = candidate;
    }
  }

  return best;
};

export const sampleResolvedDubinsPath = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  turningRadius: number,
  path: DubinsPath,
  step: number,
): {
  path: DubinsPath;
  samples: DubinsPoseSample[];
  totalLength: number;
} => {
  const sampleStep = Math.max(MIN_RENDER_STEP, step);
  const totalLength = path.normalizedLength * turningRadius;

  const samples: DubinsPoseSample[] = [
    {
      x: start.x,
      y: start.y,
      headingDeg: normalizeAngleDeg(start.headingDeg),
      distance: 0,
      segmentType: path.segmentTypes[0],
    },
  ];

  let pose = {
    x: start.x,
    y: start.y,
    headingRad: toRadians(start.headingDeg),
  };
  let traveled = 0;

  for (let index = 0; index < path.segmentTypes.length; index += 1) {
    const segmentType = path.segmentTypes[index];
    const normalizedLength = path.params[index];
    if (segmentType === undefined || normalizedLength === undefined) {
      continue;
    }

    const segmentLength = normalizedLength * turningRadius;
    let segmentProgress = 0;

    while (segmentProgress + sampleStep < segmentLength) {
      segmentProgress += sampleStep;
      traveled += sampleStep;
      pose = advancePose(pose, segmentType, sampleStep, turningRadius);
      samples.push({
        x: pose.x,
        y: pose.y,
        headingDeg: normalizeAngleDeg((pose.headingRad * 180) / Math.PI),
        distance: traveled,
        segmentType,
      });
    }

    const tail = segmentLength - segmentProgress;
    if (tail > SOLVER_EPSILON) {
      traveled += tail;
      pose = advancePose(pose, segmentType, tail, turningRadius);
      samples.push({
        x: pose.x,
        y: pose.y,
        headingDeg: normalizeAngleDeg((pose.headingRad * 180) / Math.PI),
        distance: traveled,
        segmentType,
      });
    }
  }

  const endpointSample: DubinsPoseSample = {
    x: end.x,
    y: end.y,
    headingDeg: normalizeAngleDeg(end.headingDeg),
    distance: totalLength,
    segmentType: path.segmentTypes.at(-1) ?? 'S',
  };

  if (samples.length === 0) {
    samples.push(endpointSample);
  } else {
    samples[samples.length - 1] = endpointSample;
  }

  return {
    path,
    samples,
    totalLength,
  };
};

export type DubinsCenters = {
  startCenter?: Point;
  endCenter?: Point;
};

export const computeDubinsArcCentersForPath = (
  start: DubinsEndpoint,
  path: DubinsPath,
  turningRadius: number,
): DubinsCenters => {
  const centers: DubinsCenters = {};
  let pose = {
    x: start.x,
    y: start.y,
    headingRad: toRadians(start.headingDeg),
  };

  for (let index = 0; index < path.segmentTypes.length; index += 1) {
    const segmentType = path.segmentTypes[index];
    const normalizedLength = path.params[index];
    if (segmentType === undefined || normalizedLength === undefined) {
      continue;
    }

    const segmentLength = normalizedLength * turningRadius;
    if (
      segmentLength > LENGTH_EPSILON &&
      (segmentType === 'L' || segmentType === 'R')
    ) {
      const headingVector = {
        x: Math.cos(pose.headingRad),
        y: Math.sin(pose.headingRad),
      };

      let center: Point;
      if (segmentType === 'L') {
        center = {
          x: pose.x - headingVector.y * turningRadius,
          y: pose.y + headingVector.x * turningRadius,
        };
      } else {
        center = {
          x: pose.x + headingVector.y * turningRadius,
          y: pose.y - headingVector.x * turningRadius,
        };
      }

      if (index === 0) {
        centers.startCenter = center;
      } else if (index === path.segmentTypes.length - 1) {
        centers.endCenter = center;
      }
    }

    pose = advancePose(pose, segmentType, segmentLength, turningRadius);
  }

  return centers;
};
