import type { HeadingKeyframe, Point } from './models';

export const normalizeOptionalName = (
  value: string | undefined,
): string | undefined => {
  const trimmed = value?.trim();

  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
};

export const getDefaultWaypointName = (index: number): string => {
  return `WP ${index + 1}`;
};

export const getDefaultHeadingKeyframeName = (index: number): string => {
  return `HP ${index + 1}`;
};

export const getEffectiveWaypointName = (params: {
  point: Pick<Point, 'name'>;
  libraryPoint?: Pick<Point, 'name'> | null | undefined;
  index: number;
}): string => {
  const { point, libraryPoint, index } = params;

  return (
    normalizeOptionalName(libraryPoint?.name ?? point.name) ??
    getDefaultWaypointName(index)
  );
};

export const getHeadingKeyframeName = (
  keyframe: Pick<HeadingKeyframe, 'name'>,
  index: number,
): string => {
  return (
    normalizeOptionalName(keyframe.name) ?? getDefaultHeadingKeyframeName(index)
  );
};
