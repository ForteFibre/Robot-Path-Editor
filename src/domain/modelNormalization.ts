import type { PathModel, RobotMotionSettings } from './models';

const MIN_ROBOT_DIMENSION = 0.01;
const MIN_MOTION_CONSTRAINT = 0.001;

export const DEFAULT_ROBOT_MOTION_SETTINGS: RobotMotionSettings = {
  length: 0.9,
  width: 0.7,
  acceleration: 5,
  deceleration: 5,
  maxVelocity: 5,
  centripetalAcceleration: 5,
};

const normalizePositiveFinite = (
  value: number | undefined,
  fallback: number,
  minimum: number,
): number => {
  const resolvedValue = value ?? fallback;

  if (!Number.isFinite(resolvedValue)) {
    return fallback;
  }

  return Math.max(minimum, resolvedValue);
};

export const normalizeRobotMotionSettings = (
  settings?: Partial<RobotMotionSettings>,
): RobotMotionSettings => {
  return {
    length: normalizePositiveFinite(
      settings?.length,
      DEFAULT_ROBOT_MOTION_SETTINGS.length,
      MIN_ROBOT_DIMENSION,
    ),
    width: normalizePositiveFinite(
      settings?.width,
      DEFAULT_ROBOT_MOTION_SETTINGS.width,
      MIN_ROBOT_DIMENSION,
    ),
    acceleration: normalizePositiveFinite(
      settings?.acceleration,
      DEFAULT_ROBOT_MOTION_SETTINGS.acceleration,
      MIN_MOTION_CONSTRAINT,
    ),
    deceleration: normalizePositiveFinite(
      settings?.deceleration,
      DEFAULT_ROBOT_MOTION_SETTINGS.deceleration,
      MIN_MOTION_CONSTRAINT,
    ),
    maxVelocity: normalizePositiveFinite(
      settings?.maxVelocity,
      DEFAULT_ROBOT_MOTION_SETTINGS.maxVelocity,
      MIN_MOTION_CONSTRAINT,
    ),
    centripetalAcceleration: normalizePositiveFinite(
      settings?.centripetalAcceleration,
      DEFAULT_ROBOT_MOTION_SETTINGS.centripetalAcceleration,
      MIN_MOTION_CONSTRAINT,
    ),
  };
};

export const normalizePathSections = (path: PathModel): PathModel => {
  const sectionCount = Math.max(0, path.waypoints.length - 1);

  const sectionRMin = Array.from({ length: sectionCount }, (_value, index) => {
    const sectionValue = path.sectionRMin[index];

    if (sectionValue === null || sectionValue === undefined) {
      return null;
    }

    if (!Number.isFinite(sectionValue)) {
      return null;
    }

    return sectionValue > 0 ? sectionValue : null;
  });

  return {
    ...path,
    headingKeyframes:
      sectionCount === 0
        ? []
        : path.headingKeyframes
            .map((keyframe) => ({
              ...keyframe,
              sectionIndex: Math.min(
                Math.max(0, keyframe.sectionIndex),
                sectionCount - 1,
              ),
              sectionRatio: Number.isFinite(keyframe.sectionRatio)
                ? Math.min(Math.max(keyframe.sectionRatio, 0), 1)
                : 0,
            }))
            .sort((a, b) => {
              if (a.sectionIndex !== b.sectionIndex) {
                return a.sectionIndex - b.sectionIndex;
              }

              if (a.sectionRatio !== b.sectionRatio) {
                return a.sectionRatio - b.sectionRatio;
              }

              return a.name.localeCompare(b.name);
            }),
    sectionRMin,
  };
};
