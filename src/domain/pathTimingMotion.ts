const EPSILON = 1e-9;

export type TimingMotionSettings = {
  acceleration: number;
  deceleration: number;
};

export type SegmentMotionProfile = {
  kind: 'degenerate' | 'bounded';
  distance: number;
  duration: number;
  startVelocity: number;
  endVelocity: number;
  speedLimit: number;
  peakVelocity: number;
  acceleration: number;
  deceleration: number;
  accelerationDuration: number;
  cruiseDuration: number;
  decelerationDuration: number;
  accelerationDistance: number;
  cruiseDistance: number;
  decelerationDistance: number;
};

const clampNonNegative = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
};

const solveTimeForDistance = (
  distance: number,
  startVelocity: number,
  signedAcceleration: number,
): number => {
  if (distance <= EPSILON) {
    return 0;
  }

  if (Math.abs(signedAcceleration) <= EPSILON) {
    return startVelocity > EPSILON ? distance / startVelocity : 0;
  }

  const discriminant = Math.max(
    0,
    startVelocity * startVelocity + 2 * signedAcceleration * distance,
  );

  return Math.max(
    0,
    (Math.sqrt(discriminant) - startVelocity) / signedAcceleration,
  );
};

export const buildSegmentMotionProfile = (
  distance: number,
  startVelocity: number,
  endVelocity: number,
  speedLimit: number,
  settings: TimingMotionSettings,
): SegmentMotionProfile => {
  const normalizedDistance = clampNonNegative(distance);
  const normalizedLimit = clampNonNegative(speedLimit);
  const normalizedStartVelocity = Math.min(
    clampNonNegative(startVelocity),
    normalizedLimit,
  );
  const normalizedEndVelocity = Math.min(
    clampNonNegative(endVelocity),
    normalizedLimit,
  );

  if (normalizedDistance <= EPSILON || normalizedLimit <= EPSILON) {
    return {
      kind: 'degenerate',
      distance: normalizedDistance,
      duration: 0,
      startVelocity: normalizedStartVelocity,
      endVelocity: normalizedEndVelocity,
      speedLimit: normalizedLimit,
      peakVelocity: Math.max(normalizedStartVelocity, normalizedEndVelocity),
      acceleration: settings.acceleration,
      deceleration: settings.deceleration,
      accelerationDuration: 0,
      cruiseDuration: 0,
      decelerationDuration: 0,
      accelerationDistance: 0,
      cruiseDistance: 0,
      decelerationDistance: 0,
    };
  }

  const distanceToAccelerateToLimit =
    normalizedLimit > normalizedStartVelocity
      ? (normalizedLimit * normalizedLimit -
          normalizedStartVelocity * normalizedStartVelocity) /
        (2 * settings.acceleration)
      : 0;
  const distanceToDecelerateFromLimit =
    normalizedLimit > normalizedEndVelocity
      ? (normalizedLimit * normalizedLimit -
          normalizedEndVelocity * normalizedEndVelocity) /
        (2 * settings.deceleration)
      : 0;

  let peakVelocity = normalizedLimit;
  let cruiseDistance =
    normalizedDistance -
    distanceToAccelerateToLimit -
    distanceToDecelerateFromLimit;

  if (cruiseDistance < -EPSILON) {
    const inverseAcceleration = 1 / settings.acceleration;
    const inverseDeceleration = 1 / settings.deceleration;
    const peakVelocitySquared = Math.max(
      0,
      (2 * normalizedDistance +
        normalizedStartVelocity *
          normalizedStartVelocity *
          inverseAcceleration +
        normalizedEndVelocity * normalizedEndVelocity * inverseDeceleration) /
        (inverseAcceleration + inverseDeceleration),
    );
    peakVelocity = Math.min(normalizedLimit, Math.sqrt(peakVelocitySquared));
    cruiseDistance = 0;
  } else {
    cruiseDistance = Math.max(0, cruiseDistance);
  }

  const accelerationDistance =
    peakVelocity > normalizedStartVelocity
      ? (peakVelocity * peakVelocity -
          normalizedStartVelocity * normalizedStartVelocity) /
        (2 * settings.acceleration)
      : 0;
  const decelerationDistance =
    peakVelocity > normalizedEndVelocity
      ? (peakVelocity * peakVelocity -
          normalizedEndVelocity * normalizedEndVelocity) /
        (2 * settings.deceleration)
      : 0;
  const accelerationDuration =
    peakVelocity > normalizedStartVelocity
      ? (peakVelocity - normalizedStartVelocity) / settings.acceleration
      : 0;
  const cruiseDuration =
    peakVelocity > EPSILON ? cruiseDistance / peakVelocity : 0;
  const decelerationDuration =
    peakVelocity > normalizedEndVelocity
      ? (peakVelocity - normalizedEndVelocity) / settings.deceleration
      : 0;

  return {
    kind: 'bounded',
    distance: normalizedDistance,
    duration: accelerationDuration + cruiseDuration + decelerationDuration,
    startVelocity: normalizedStartVelocity,
    endVelocity: normalizedEndVelocity,
    speedLimit: normalizedLimit,
    peakVelocity,
    acceleration: settings.acceleration,
    deceleration: settings.deceleration,
    accelerationDuration,
    cruiseDuration,
    decelerationDuration,
    accelerationDistance: Math.max(0, accelerationDistance),
    cruiseDistance,
    decelerationDistance: Math.max(0, decelerationDistance),
  };
};

export const getSegmentDistanceAtTime = (
  profile: SegmentMotionProfile,
  elapsedTime: number,
): number => {
  const clampedElapsed = Math.min(Math.max(elapsedTime, 0), profile.duration);

  if (profile.kind === 'degenerate') {
    return 0;
  }

  if (clampedElapsed <= profile.accelerationDuration) {
    const distanceTravelled =
      profile.startVelocity * clampedElapsed +
      0.5 * profile.acceleration * clampedElapsed * clampedElapsed;

    return Math.min(Math.max(distanceTravelled, 0), profile.distance);
  }

  if (clampedElapsed <= profile.accelerationDuration + profile.cruiseDuration) {
    const cruiseElapsed = clampedElapsed - profile.accelerationDuration;
    return Math.min(
      profile.distance,
      profile.accelerationDistance + profile.peakVelocity * cruiseElapsed,
    );
  }

  const decelerationElapsed = Math.min(
    Math.max(
      clampedElapsed - profile.accelerationDuration - profile.cruiseDuration,
      0,
    ),
    profile.decelerationDuration,
  );

  const distanceTravelled =
    profile.accelerationDistance +
    profile.cruiseDistance +
    profile.peakVelocity * decelerationElapsed -
    0.5 * profile.deceleration * decelerationElapsed * decelerationElapsed;

  return Math.min(Math.max(distanceTravelled, 0), profile.distance);
};

export const getSegmentVelocityAtTime = (
  profile: SegmentMotionProfile,
  elapsedTime: number,
): number => {
  const clampedElapsed = Math.min(Math.max(elapsedTime, 0), profile.duration);

  if (profile.kind === 'degenerate') {
    return profile.endVelocity;
  }

  if (clampedElapsed <= profile.accelerationDuration) {
    return Math.max(
      0,
      profile.startVelocity + profile.acceleration * clampedElapsed,
    );
  }

  if (clampedElapsed <= profile.accelerationDuration + profile.cruiseDuration) {
    return profile.peakVelocity;
  }

  const decelerationElapsed = Math.min(
    Math.max(
      clampedElapsed - profile.accelerationDuration - profile.cruiseDuration,
      0,
    ),
    profile.decelerationDuration,
  );

  return Math.max(
    0,
    profile.peakVelocity - profile.deceleration * decelerationElapsed,
  );
};

export const getSegmentTimeAtDistance = (
  profile: SegmentMotionProfile,
  distance: number,
): number => {
  const clampedDistance = Math.min(Math.max(distance, 0), profile.distance);

  if (profile.kind === 'degenerate') {
    return 0;
  }

  if (clampedDistance <= profile.accelerationDistance + EPSILON) {
    return Math.min(
      profile.duration,
      solveTimeForDistance(
        clampedDistance,
        profile.startVelocity,
        profile.acceleration,
      ),
    );
  }

  if (
    clampedDistance <=
    profile.accelerationDistance + profile.cruiseDistance + EPSILON
  ) {
    return Math.min(
      profile.duration,
      profile.accelerationDuration +
        (clampedDistance - profile.accelerationDistance) /
          Math.max(profile.peakVelocity, EPSILON),
    );
  }

  const decelerationDistance =
    clampedDistance - profile.accelerationDistance - profile.cruiseDistance;

  return Math.min(
    profile.duration,
    profile.accelerationDuration +
      profile.cruiseDuration +
      solveTimeForDistance(
        decelerationDistance,
        profile.peakVelocity,
        -profile.deceleration,
      ),
  );
};
