import {
  headingDegFromPoints,
  shortestAngleDeltaDeg,
  toRadians,
} from './geometry';
import {
  computeShortestDubinsPath,
  type DubinsEndpoint,
  type DubinsPath,
  type DubinsWord,
} from './dubins';

export type AutoSectionConnection = 's-curve' | 'curve-line';

export type AutoDubinsPath = {
  turningRadius: number;
  path: DubinsPath;
  connection: AutoSectionConnection;
};

export type SectionDubinsPath = {
  mode: 'auto' | 'manual';
  turningRadius: number;
  path: DubinsPath;
  connection: AutoSectionConnection | null;
};

type AutoCandidateWord = 'LSL' | 'RSR' | 'LSR' | 'RSL';

type AutoCandidate = {
  word: AutoCandidateWord;
  radius: number;
  path: DubinsPath;
  connection: AutoSectionConnection;
  totalArc: number;
};

const TWO_PI = Math.PI * 2;
const LENGTH_EPSILON = 1e-6;
const SOLVER_EPSILON = 1e-10;
const ZERO_SEGMENT_EPSILON = 1e-5;

const AUTO_WORD_PRIORITY: Record<AutoCandidateWord, number> = {
  LSL: 0,
  RSR: 1,
  LSR: 2,
  RSL: 3,
};

const mod2Pi = (value: number): number => {
  const wrapped = value % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const cross = (
  left: { x: number; y: number },
  right: { x: number; y: number },
): number => {
  return left.x * right.y - left.y * right.x;
};

const dot = (
  left: { x: number; y: number },
  right: { x: number; y: number },
): number => {
  return left.x * right.x + left.y * right.y;
};

const headingRadToVector = (headingRad: number): { x: number; y: number } => {
  return {
    x: Math.cos(headingRad),
    y: Math.sin(headingRad),
  };
};

const computeNormalizedArcDelta = (
  headingRad: number,
  turn: 'L' | 'R',
  angle: number,
): { x: number; y: number } => {
  if (turn === 'L') {
    return {
      x: Math.sin(headingRad + angle) - Math.sin(headingRad),
      y: Math.cos(headingRad) - Math.cos(headingRad + angle),
    };
  }

  return {
    x: Math.sin(headingRad) - Math.sin(headingRad - angle),
    y: Math.cos(headingRad - angle) - Math.cos(headingRad),
  };
};

const toDubinsPath = (
  word: DubinsWord,
  params: [number, number, number],
): DubinsPath => {
  const segmentTypes: Record<
    DubinsWord,
    ['L' | 'S' | 'R', 'L' | 'S' | 'R', 'L' | 'S' | 'R']
  > = {
    LSL: ['L', 'S', 'L'],
    RSR: ['R', 'S', 'R'],
    LSR: ['L', 'S', 'R'],
    RSL: ['R', 'S', 'L'],
    RLR: ['R', 'L', 'R'],
    LRL: ['L', 'R', 'L'],
  };

  return {
    word,
    segmentTypes: segmentTypes[word],
    params,
    normalizedLength: params[0] + params[1] + params[2],
  };
};

const totalLengthOf = (path: DubinsPath, turningRadius: number): number => {
  return path.normalizedLength * turningRadius;
};

const computeAutoTotalArc = (
  path: DubinsPath,
  connection: AutoSectionConnection,
): number => {
  switch (connection) {
    case 's-curve':
      return path.params[0] + path.params[2];
    case 'curve-line':
      return Math.max(path.params[0], path.params[2]);
  }
};

const advancePose = (
  pose: { x: number; y: number; headingRad: number },
  segmentType: 'L' | 'S' | 'R',
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

const matchesEndpoint = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  turningRadius: number,
  path: DubinsPath,
): boolean => {
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

    pose = advancePose(
      pose,
      segmentType,
      normalizedLength * turningRadius,
      turningRadius,
    );
  }

  return (
    Math.hypot(pose.x - end.x, pose.y - end.y) <= 1e-4 &&
    Math.abs(
      shortestAngleDeltaDeg((pose.headingRad * 180) / Math.PI, end.headingDeg),
    ) <= 1e-4
  );
};

const buildCurveLineCandidate = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  turn: 'L' | 'R',
  arcAt: 'start' | 'end',
): AutoCandidate | null => {
  const startHeading = toRadians(start.headingDeg);
  const endHeading = toRadians(end.headingDeg);
  const deltaAngle =
    turn === 'L'
      ? mod2Pi(endHeading - startHeading)
      : mod2Pi(startHeading - endHeading);

  if (deltaAngle <= ZERO_SEGMENT_EPSILON) {
    return null;
  }

  const arcVector = computeNormalizedArcDelta(startHeading, turn, deltaAngle);
  const chord = { x: end.x - start.x, y: end.y - start.y };
  const lineVector =
    arcAt === 'start'
      ? headingRadToVector(endHeading)
      : headingRadToVector(startHeading);
  const determinant = cross(
    arcAt === 'start' ? arcVector : lineVector,
    arcAt === 'start' ? lineVector : arcVector,
  );

  if (Math.abs(determinant) <= SOLVER_EPSILON) {
    return null;
  }

  const radius =
    arcAt === 'start'
      ? cross(chord, lineVector) / determinant
      : cross(lineVector, chord) / determinant;
  const lineLength =
    arcAt === 'start'
      ? cross(arcVector, chord) / determinant
      : cross(chord, arcVector) / determinant;

  if (radius <= LENGTH_EPSILON || lineLength < -LENGTH_EPSILON) {
    return null;
  }

  const clampedLineLength = Math.max(0, lineLength);
  const params: [number, number, number] =
    arcAt === 'start'
      ? [deltaAngle, clampedLineLength / radius, 0]
      : [0, clampedLineLength / radius, deltaAngle];
  const word = turn === 'L' ? 'LSL' : 'RSR';
  const path = toDubinsPath(word, params);
  if (!matchesEndpoint(start, end, radius, path)) {
    return null;
  }

  return {
    word,
    radius,
    path,
    connection: 'curve-line',
    totalArc: computeAutoTotalArc(path, 'curve-line'),
  };
};

const buildSCurveCandidates = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  word: 'LSR' | 'RSL',
): AutoCandidate[] => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chordLength = Math.hypot(dx, dy);
  if (chordLength <= LENGTH_EPSILON) {
    return [];
  }

  const startHeading = toRadians(start.headingDeg);
  const endHeading = toRadians(end.headingDeg);
  const startSin = Math.sin(startHeading);
  const endSin = Math.sin(endHeading);
  const startCos = Math.cos(startHeading);
  const endCos = Math.cos(endHeading);

  const target =
    (dy * (startSin + endSin) + dx * (startCos + endCos)) / (2 * chordLength);
  if (target < -1 - SOLVER_EPSILON || target > 1 + SOLVER_EPSILON) {
    return [];
  }

  const clampedTarget = clamp(target, -1, 1);
  const axisAngle = Math.atan2(dy, dx);
  const offset = Math.acos(clampedTarget);
  const tangentHeadings = [axisAngle + offset, axisAngle - offset];
  const candidates: AutoCandidate[] = [];

  for (const tangentHeading of tangentHeadings) {
    const firstArc =
      word === 'LSR'
        ? mod2Pi(tangentHeading - startHeading)
        : mod2Pi(startHeading - tangentHeading);
    const secondArc =
      word === 'LSR'
        ? mod2Pi(tangentHeading - endHeading)
        : mod2Pi(endHeading - tangentHeading);

    const displacement =
      word === 'LSR'
        ? {
            x: 2 * Math.sin(tangentHeading) - startSin - endSin,
            y: startCos + endCos - 2 * Math.cos(tangentHeading),
          }
        : {
            x: startSin + endSin - 2 * Math.sin(tangentHeading),
            y: 2 * Math.cos(tangentHeading) - startCos - endCos,
          };
    const displacementMagnitudeSq = dot(displacement, displacement);
    if (displacementMagnitudeSq <= SOLVER_EPSILON) {
      continue;
    }

    const radius =
      dot({ x: dx, y: dy }, displacement) / displacementMagnitudeSq;
    if (radius <= LENGTH_EPSILON) {
      continue;
    }

    if (Math.abs(cross(displacement, { x: dx, y: dy })) > 1e-4) {
      continue;
    }

    const path = toDubinsPath(word, [firstArc, 0, secondArc]);
    if (!matchesEndpoint(start, end, radius, path)) {
      continue;
    }
    candidates.push({
      word,
      radius,
      path,
      connection: 's-curve',
      totalArc: computeAutoTotalArc(path, 's-curve'),
    });
  }

  return candidates;
};

const compareAutoCandidates = (
  left: AutoCandidate,
  right: AutoCandidate,
): number => {
  if (Math.abs(left.totalArc - right.totalArc) > LENGTH_EPSILON) {
    return left.totalArc - right.totalArc;
  }

  if (Math.abs(left.radius - right.radius) > LENGTH_EPSILON) {
    return right.radius - left.radius;
  }

  const leftLength = totalLengthOf(left.path, left.radius);
  const rightLength = totalLengthOf(right.path, right.radius);
  if (Math.abs(leftLength - rightLength) > LENGTH_EPSILON) {
    return leftLength - rightLength;
  }

  return AUTO_WORD_PRIORITY[left.word] - AUTO_WORD_PRIORITY[right.word];
};

export const isStraightSection = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
): boolean => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= LENGTH_EPSILON) {
    return true;
  }

  const chordHeading = headingDegFromPoints(start, end);
  return (
    Math.abs(shortestAngleDeltaDeg(start.headingDeg, chordHeading)) <=
      ZERO_SEGMENT_EPSILON &&
    Math.abs(shortestAngleDeltaDeg(end.headingDeg, chordHeading)) <=
      ZERO_SEGMENT_EPSILON
  );
};

export const computeManualSectionDubinsPath = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  turningRadius: number,
): SectionDubinsPath | null => {
  const path = computeShortestDubinsPath(start, end, turningRadius, {
    allowTripleCurve: true,
  });
  if (path === null) {
    return null;
  }

  return {
    mode: 'manual',
    turningRadius,
    path,
    connection: null,
  };
};

export const computeAutoSectionDubinsPath = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
): AutoDubinsPath | null => {
  const candidates: AutoCandidate[] = [
    ...buildSCurveCandidates(start, end, 'LSR'),
    ...buildSCurveCandidates(start, end, 'RSL'),
  ];

  for (const turn of ['L', 'R'] as const) {
    const startArcCandidate = buildCurveLineCandidate(
      start,
      end,
      turn,
      'start',
    );
    if (startArcCandidate !== null) {
      candidates.push(startArcCandidate);
    }

    const endArcCandidate = buildCurveLineCandidate(start, end, turn, 'end');
    if (endArcCandidate !== null) {
      candidates.push(endArcCandidate);
    }
  }

  candidates.sort(compareAutoCandidates);
  const best = candidates[0];
  if (best === undefined) {
    return null;
  }

  return {
    turningRadius: best.radius,
    path: best.path,
    connection: best.connection,
  };
};

export const resolveSectionDubinsPath = (
  start: DubinsEndpoint,
  end: DubinsEndpoint,
  manualRadius: number | null,
): SectionDubinsPath | null => {
  if (manualRadius !== null) {
    if (!Number.isFinite(manualRadius) || manualRadius <= 0) {
      return null;
    }

    return computeManualSectionDubinsPath(start, end, manualRadius);
  }

  const auto = computeAutoSectionDubinsPath(start, end);
  if (auto === null) {
    return null;
  }

  return {
    mode: 'auto',
    turningRadius: auto.turningRadius,
    path: auto.path,
    connection: auto.connection,
  };
};
